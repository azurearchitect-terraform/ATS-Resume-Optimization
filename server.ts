import express from "express";
import path from "path";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import { google } from "googleapis";
import stream from "stream";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as Optimization from "./server/optimization.js";
import { calculateCost, UsageLog } from "./server/analytics.js";

dotenv.config();

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const app = admin.apps.length 
  ? admin.apps[0] 
  : admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Function to log usage to Firestore
async function logUsage(log: UsageLog) {
  try {
    await db.collection("analytics").add({
      ...log,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging usage to Firestore:", error);
  }
}

// PDF Sessions storage
const pdfSessions = new Map<string, { html: string, css: string, fonts: string, title?: string, timestamp: number }>();

// Cleanup old sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of pdfSessions.entries()) {
    if (now - session.timestamp > 1800000) { // 30 minutes
      pdfSessions.delete(id);
    }
  }
}, 600000);

// Encryption Setup
// We use a stable key derived from GEMINI_API_KEY if ENCRYPTION_KEY is not provided.
// This prevents "bad decrypt" errors after server restarts.
const getEncryptionKey = () => {
  if (process.env.ENCRYPTION_KEY) return process.env.ENCRYPTION_KEY;
  if (process.env.GEMINI_API_KEY) {
    return crypto.createHash('sha256').update(process.env.GEMINI_API_KEY).digest('hex');
  }
  // Fallback for local development if no keys are present
  return "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b"; 
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) throw new Error("Invalid encrypted text format");
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error("Decryption Error:", error);
    if (error.message.includes('bad decrypt') || error.code === 'ERR_OSSL_EVP_BAD_DECRYPT') {
      throw new Error("DECRYPTION_FAILED: The encryption key has changed or the data is corrupted. Please re-save your API keys in your profile.");
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  console.log("Environment Variables Check:");
  console.log("PUPPETEER_EXECUTABLE_PATH:", process.env.PUPPETEER_EXECUTABLE_PATH);
  console.log("HTTP_PROXY:", process.env.HTTP_PROXY);

  // Google Drive Client Setup
  const getDriveClient = (accessToken?: string) => {
    // Ensure accessToken is a valid string and not "null", "undefined", or empty
    const isValidToken = accessToken && 
                        typeof accessToken === 'string' && 
                        accessToken !== 'null' && 
                        accessToken !== 'undefined' && 
                        accessToken.trim() !== '';

    if (isValidToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      return google.drive({ version: 'v3', auth });
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;

    if (!serviceAccountKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set. Please add it to your environment variables.");
    }

    if (folderId && (folderId.startsWith('{') || folderId.includes('service_account'))) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_FOLDER_ID appears to contain a Service Account JSON instead of a Folder ID. Please check your environment variables.");
    }
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not a valid JSON string. Ensure it is the full content of your service account key file.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  };

  app.post("/api/save-to-drive", async (req, res) => {
    const { pdfData, fileName, versioningEnabled, accessToken, parentFolderId } = req.body;
    
    if (!pdfData || !fileName) {
      return res.status(400).json({ error: "PDF data and file name are required" });
    }

    // Escape single quotes in file name for Drive query
    const escapedFileName = fileName.replace(/'/g, "\\'");

    try {
      const drive = getDriveClient(accessToken);
      const folderId = parentFolderId || process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      // Determine mimeType from fileName
      const mimeType = fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf';

      // Convert base64 to stream
      const buffer = Buffer.from(pdfData, 'base64');
      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);

      let fileId = null;
      
      if (!versioningEnabled) {
        // Search for existing file with same name
        const query = folderId 
          ? `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`
          : `name = '${escapedFileName}' and trashed = false`;

        const response = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        
        if (response.data.files && response.data.files.length > 0) {
          fileId = response.data.files[0].id;
        }
      }

      if (fileId) {
        // Update existing file
        await drive.files.update({
          fileId: fileId,
          media: {
            mimeType: mimeType,
            body: bufferStream,
          },
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File updated successfully", fileId });
      } else {
        // Create new file
        const finalFileName = versioningEnabled 
          ? `${fileName.replace(/\.(pdf|csv)$/, '')} (v${new Date().toISOString().replace(/[:.]/g, '-')})${fileName.endsWith('.csv') ? '.csv' : '.pdf'}`
          : fileName;

        const fileMetadata: any = {
          name: finalFileName,
          mimeType: mimeType,
        };

        if (process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID) {
          fileMetadata.parents = [process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID];
        }
        
        const media = {
          mimeType: mimeType,
          body: bufferStream,
        };

        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id',
          supportsAllDrives: true,
        });
        res.json({ success: true, message: "File created successfully", fileId: file.data.id });
      }
    } catch (error: any) {
      console.error("Drive Save Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Save Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to save to Google Drive";
      
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      } else if (error.code === 404) {
        errorMessage = "Folder or File not found. Please verify your GOOGLE_SERVICE_ACCOUNT_FOLDER_ID and ensure the Service Account has 'Editor' access to that folder.";
      } else if (error.message && error.message.includes("storage quota")) {
        errorMessage = "Service Account storage quota exceeded. To fix this, you MUST use a folder inside a 'Shared Drive' (Team Drive) and share it with the Service Account. Service Accounts have 0 quota on personal drives.";
      } else if (error.message && error.message.includes("invalid_grant")) {
        errorMessage = "Authentication failed. Please check your GOOGLE_SERVICE_ACCOUNT_KEY.";
      }

      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.get("/api/list-drive-folders", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      
      const response = await drive.files.list({
        // List folders that are not trashed
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: 1000,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        folders: response.data.files || [] 
      });
    } catch (error: any) {
      console.error("Drive Folder List Error:", error.message || error);
      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: error.message || "Failed to fetch Drive folders"
      });
    }
  });

  app.get("/api/list-drive-files", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      const folderId = process.env.GOOGLE_SERVICE_ACCOUNT_FOLDER_ID;
      
      const query = folderId 
        ? `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`
        : "mimeType = 'application/pdf' and trashed = false";

      const response = await drive.files.list({
        q: query,
        pageSize: 50,
        fields: 'files(id, name, webViewLink, modifiedTime)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ 
        success: true, 
        files: response.data.files || [] 
      });
    } catch (error: any) {
      let errorMessage = error.message || "Failed to fetch Drive files";
      
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
        // Avoid spamming logs for standard expiration
        console.warn("Drive authentication expired.");
      } else {
        console.error("Drive List Error:", error.message || error);
        if (error.response && error.response.data) {
          console.error("Drive List Error Details:", JSON.stringify(error.response.data));
        }
      }

      res.status(error.response?.status || 500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  app.patch("/api/rename-drive-file", express.json(), async (req, res) => {
    const { fileId, newName, accessToken } = req.body;
    if (!fileId || !newName) {
      return res.status(400).json({ error: "Missing fileId or newName" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.update({
        fileId: fileId,
        requestBody: {
          name: newName.endsWith('.pdf') ? newName : `${newName}.pdf`
        },
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File renamed successfully" });
    } catch (error: any) {
      console.error("Drive Rename Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Rename Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to rename file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.delete("/api/delete-drive-file", express.json(), async (req, res) => {
    const { fileId, accessToken } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: "Missing fileId" });
    }
    try {
      const drive = getDriveClient(accessToken);
      await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true,
      });
      res.json({ success: true, message: "File deleted successfully" });
    } catch (error: any) {
      console.error("Drive Delete Error:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Drive Delete Error Details:", JSON.stringify(error.response.data));
      }
      
      let errorMessage = error.message || "Failed to delete file";
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        errorMessage = "AUTH_EXPIRED: Your Google Drive session has expired. Please reconnect your Drive in settings.";
      }
      
      res.status(error.response?.status || 500).json({ error: errorMessage });
    }
  });

  app.get("/api/test-drive", async (req, res) => {
    const accessToken = req.query.accessToken as string | undefined;
    try {
      const drive = getDriveClient(accessToken);
      const response = await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      res.json({ 
        success: true, 
        message: accessToken 
          ? "Connection successful! Authenticated via Google OAuth." 
          : "Connection successful! Drive API is enabled and Service Account is authenticated.",
        filesFound: response.data.files?.length || 0
      });
    } catch (error: any) {
      console.error("Drive Test Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to connect to Google Drive",
        details: accessToken 
          ? "Ensure your Google account has Drive API permissions and the token is valid."
          : "Ensure GOOGLE_SERVICE_ACCOUNT_KEY is correct and Drive API is enabled in Google Cloud Console."
      });
    }
  });

  // API Endpoint to encrypt API Key
  app.post("/api/encrypt-key", (req, res) => {
    const { apiKey, existingEncryptedKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }
    try {
      let keysToEncrypt = apiKey;
      
      // If we're passing a JSON string of keys and an existing encrypted key, merge them
      if (existingEncryptedKey) {
        try {
          const newKeys = JSON.parse(apiKey);
          const decryptedExisting = decrypt(existingEncryptedKey);
          let existingKeys: any = {};
          try {
            existingKeys = JSON.parse(decryptedExisting);
          } catch (e) {
            // If the existing key wasn't JSON, assume it was a Gemini key for backwards compatibility
            existingKeys = { gemini: decryptedExisting };
          }
          
          // Merge keys, keeping existing ones if the new one is empty
          const mergedKeys = {
            gemini: newKeys.gemini || existingKeys.gemini || '',
            openai: newKeys.openai || existingKeys.openai || ''
          };
          keysToEncrypt = JSON.stringify(mergedKeys);
        } catch (e) {
          // Ignore decryption errors, assume existing keys are invalid/inaccessible
        }
      }

      const encryptedKey = encrypt(keysToEncrypt);
      res.json({ encryptedKey });
    } catch (error: any) {
      console.error("Encryption Error:", error);
      res.status(500).json({ error: "Failed to encrypt API key" });
    }
  });

  // API Endpoint to decrypt API keys for frontend use
  app.post("/api/decrypt-keys", (req, res) => {
    const { encryptedKey } = req.body;
    if (!encryptedKey) {
      return res.status(400).json({ error: "Encrypted key is required" });
    }
    try {
      const decryptedString = decrypt(encryptedKey);
      let keys: any = {};
      try {
        keys = JSON.parse(decryptedString);
      } catch (e) {
        // For backwards compatibility if it was a single raw key
        keys = { gemini: decryptedString };
      }
      res.json({ keys });
    } catch (error: any) {
      console.error("Decryption Error:", error);
      res.status(500).json({ error: "Failed to decrypt API keys" });
    }
  });

  // API Endpoint to clear cache
  app.post("/api/cache/clear", (req, res) => {
    Optimization.clearCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  });

  // Admin Analytics Endpoints
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const totalRequests = logs.filter(l => l.endpoint === "/api/v2/optimize").length;
      const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
      const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
      const cacheHits = logs.filter(l => l.cacheHit).length;
      const cacheHitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

      res.json({
        totalRequests,
        totalTokens,
        totalCost,
        cacheHitRatio
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/usage-by-day", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as UsageLog;
      });

      const dailyData: Record<string, { tokens: number, cost: number }> = {};
      
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { tokens: 0, cost: 0 };
        }
        dailyData[date].tokens += log.totalTokens;
        dailyData[date].cost += log.cost;
      });

      const result = Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json(result);
    } catch (error) {
      console.error("Error fetching usage by day:", error);
      res.status(500).json({ error: "Failed to fetch usage by day" });
    }
  });

  app.get("/api/admin/model-usage", async (req, res) => {
    try {
      const snapshot = await db.collection("analytics").get();
      const logs = snapshot.docs.map(doc => doc.data() as UsageLog);

      const modelData: Record<string, number> = {};
      
      logs.forEach(log => {
        const model = log.cacheHit ? "Cache" : log.model;
        modelData[model] = (modelData[model] || 0) + 1;
      });

      const result = Object.entries(modelData).map(([name, value]) => ({
        name,
        value
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching model usage:", error);
      res.status(500).json({ error: "Failed to fetch model usage" });
    }
  });

  // API Endpoint to optimize resume
  app.post("/api/optimize", async (req, res) => {
    const { encryptedKey, prompt, model, engine } = req.body;
    
    if (!encryptedKey || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Caching Layer
    const cacheKey = Optimization.generateCacheKey({ prompt, model, engine });
    const cachedResult = Optimization.getFromCache(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    try {
      const decryptedString = decrypt(encryptedKey);
      let apiKey = decryptedString;
      
      try {
        const parsedKeys = JSON.parse(decryptedString);
        if (engine === 'openai' && parsedKeys.openai) {
          apiKey = parsedKeys.openai;
        } else if (engine === 'gemini' && parsedKeys.gemini) {
          apiKey = parsedKeys.gemini;
        }
      } catch (e) {
        // Not JSON, assume it's a single raw key
      }
      
      if (engine === 'openai') {
        const isJsonRequested = prompt.toLowerCase().includes('json');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            ...(isJsonRequested ? { response_format: { type: "json_object" } } : {})
          })
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || "OpenAI API Error");
        }
        
        const data = await response.json();
        const result = { 
          result: data.choices[0].message.content,
          usage: {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens
          }
        };

        // Save to cache
        Optimization.saveToCache(cacheKey, result);
        
        res.json(result);
      } else {
        res.status(400).json({ error: "Gemini requests must be handled client-side as per security guidelines." });
      }
    } catch (error: any) {
      console.error("Optimization Error:", error);
      res.status(500).json({ error: "Failed to optimize resume", details: error.message || String(error) });
    }
  });

  /**
   * NEW: Optimized Full Pipeline Endpoint (V2)
   * Step 1: Gemini (cheap) -> Extract keywords, Analyze resume
   * Step 2: Internal Logic (free) -> Trim content
   * Step 3: OpenAI (premium) -> Generate final optimized resume
   */
  app.post("/api/v2/optimize", async (req, res) => {
    const { resumeText, jobDescription, targetRole, mode, audience, customPrompt, encryptedKey } = req.body;

    if (!resumeText || !jobDescription || !encryptedKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Check Cache First (Key includes all relevant fields)
    const cacheKey = Optimization.generateCacheKey({ 
      resumeText: Optimization.trimInput(resumeText, 2000), // Hash trimmed version for stability
      jobDescription: Optimization.trimInput(jobDescription, 2000),
      targetRole, 
      mode, 
      audience, 
      customPrompt 
    });
    
    const cachedResult = Optimization.getFromCache(cacheKey);
    if (cachedResult) {
      // Log cache hit
      logUsage({
        userId: "anonymous",
        model: "cache",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheHit: true,
        endpoint: "/api/v2/optimize",
        timestamp: Date.now(),
        cost: 0
      });
      return res.json(cachedResult);
    }

    try {
      // Decrypt keys
      const decryptedString = decrypt(encryptedKey);
      let geminiKey = process.env.GEMINI_API_KEY || "";
      let openaiKey = "";

      try {
        const parsedKeys = JSON.parse(decryptedString);
        openaiKey = parsedKeys.openai || "";
        if (parsedKeys.gemini) geminiKey = parsedKeys.gemini;
      } catch (e) {
        openaiKey = decryptedString; // Fallback
      }

      const pipelineType = req.body.pipelineType || 'hybrid-gemini';

      if (pipelineType === 'hybrid-openai' && !openaiKey) {
        throw new Error("OpenAI API Key is required for Hybrid OpenAI mode.");
      }

      // STEP 1: Gemini (Cheap) - Extraction & Analysis
      console.log("[Pipeline] Step 1: Gemini Extraction...");
      const [resumeExtraction, jdExtraction] = await Promise.all([
        Optimization.extractRelevantResumeData(resumeText, geminiKey),
        Optimization.extractJDKeywords(jobDescription, geminiKey)
      ]);

      const resumeData = resumeExtraction?.data;
      const jdKeywords = jdExtraction?.data || [];
      
      const geminiUsage = {
        promptTokenCount: (resumeExtraction?.usage?.promptTokenCount || 0) + (jdExtraction?.usage?.promptTokenCount || 0),
        candidatesTokenCount: (resumeExtraction?.usage?.candidatesTokenCount || 0) + (jdExtraction?.usage?.candidatesTokenCount || 0),
        totalTokenCount: (resumeExtraction?.usage?.totalTokenCount || 0) + (jdExtraction?.usage?.totalTokenCount || 0)
      };

      if (!resumeData) throw new Error("Failed to extract resume data using Gemini.");

      // STEP 2: Internal Logic (Free) - Trimming
      console.log("[Pipeline] Step 2: Trimming Content...");
      const optimizedInput = Optimization.trimContentForAI(resumeData, jdKeywords);

      // STEP 3: Gemini 3.1 Pro (Premium) - Final Generation
      const finalPrompt = `
        You are a senior executive resume strategist. 
        Optimize this structured resume data for the target role: ${targetRole}.
        Audience: ${audience}. Mode: ${mode}.
        ${customPrompt ? `Custom Instructions: ${customPrompt}` : ''}
        
        INPUT DATA (Optimized):
        ${JSON.stringify(optimizedInput, null, 2)}
        
        STRICT RULES:
        1. Maintain professional tone.
        2. Focus on impact and keywords: ${optimizedInput.jd_keywords.join(', ')}.
        3. PRESERVE TITLES: Do not change job titles. Specifically, NEVER change "Officer IT cum Logistics" to "Office IT cum Logistics". This is a mandatory requirement.
        4. INCLUDE ALL ROLES: You MUST include every single role provided in the INPUT DATA. Do not skip any jobs, even very old ones. This is a strict rule.
        5. BULLET POINT COUNTS:
           - The first role (most recent) MUST have exactly 7 bullet points.
           - The second role MUST have exactly 6 bullet points.
           - The third role MUST have exactly 5 bullet points.
           - The fourth role MUST have exactly 3 bullet points.
           - ALL other roles (5th and older) MUST have at least 3 bullet points each.
        6. WHY THIS JOB: Generate a compelling 100-150 word response to the question "What thrilled you to apply for this job?" based on the JD and resume.
        6. Return ONLY a valid JSON object matching the standard OptimizationResult schema.
        
        OUTPUT SCHEMA (MUST MATCH EXACTLY):
        {
          "personal_info": { "name": "string", "location": "string", "email": "string", "phone": "string", "linkedin": "string", "linkedinText": "string" },
          "summary": "string",
          "skills": { "Category 1": ["string"], "Category 2": ["string"], "Category 3": ["string"], "Category 4": ["string"] },
          "experience": [ { "role": "string", "company": "string", "duration": "string", "bullets": ["string"] } ],
          "projects": [ { "title": "string", "description": "string" } ],
          "education": ["string"],
          "certifications": [
            { "name": "string", "issuer": "string", "date": "string" }
          ],
          "ats_keywords_from_jd": ["string"],
          "ats_keywords_added_to_resume": ["string"],
          "keyword_gap": ["string"],
          "match_score": 85,
          "baseline_score": 60,
          "improvement_notes": ["string"],
          "audience_alignment_notes": "string",
          "why_this_job": "string",
          "rejection_reasons": ["string"]
        }
      `;

      let result;
      let usedModel = pipelineType === 'hybrid-openai' ? "gpt-4o-mini" : "gemini-3.1-pro-preview";

      if (pipelineType === 'hybrid-openai') {
        // OPENAI BRANCH
        console.log(`[Pipeline] Step 3: OpenAI Generation (${usedModel})...`);
        const openai = new OpenAI({ apiKey: openaiKey });
        const chatCompletion = await openai.chat.completions.create({
          model: usedModel,
          messages: [{ 
            role: "system", 
            content: "You are a senior executive resume strategist. Output strictly JSON." 
          }, { 
            role: "user", 
            content: finalPrompt
          }],
          response_format: { type: "json_object" }
        });

        const responseText = chatCompletion.choices[0].message.content || "";
        const genInput = chatCompletion.usage?.prompt_tokens || 0;
        const genOutput = chatCompletion.usage?.completion_tokens || 0;

        logUsage({
          userId: "anonymous",
          model: usedModel,
          inputTokens: genInput,
          outputTokens: genOutput,
          totalTokens: genInput + genOutput,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost(usedModel, genInput, genOutput)
        });

        // Log Gemini Extraction
        logUsage({
          userId: "anonymous",
          model: "gemini-2.0-flash",
          inputTokens: geminiUsage.promptTokenCount,
          outputTokens: geminiUsage.candidatesTokenCount,
          totalTokens: geminiUsage.totalTokenCount,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost("gemini-2.0-flash", geminiUsage.promptTokenCount, geminiUsage.candidatesTokenCount)
        });

        result = {
          result: responseText,
          usage: {
            promptTokenCount: genInput,
            candidatesTokenCount: genOutput,
            totalTokenCount: genInput + genOutput
          },
          geminiUsage,
          intermediateData: { resumeData, jdKeywords },
          _engine: 'hybrid-openai',
          _model: usedModel
        };
      } else {
        // GEMINI BRANCH
        try {
        console.log(`[Pipeline] Step 3: Gemini Generation (${usedModel})...`);
        const genAI = new GoogleGenAI({ apiKey: geminiKey });

        const genResult = await genAI.models.generateContent({
          model: usedModel,
          contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        const text = genResult.text || "";
        
        const genInput = genResult.usageMetadata?.promptTokenCount || 0;
        const genOutput = genResult.usageMetadata?.candidatesTokenCount || 0;

        // Log Gemini Pro usage
        logUsage({
          userId: "anonymous",
          model: usedModel,
          inputTokens: genInput,
          outputTokens: genOutput,
          totalTokens: genResult.usageMetadata?.totalTokenCount || 0,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost(usedModel, genInput, genOutput)
        });

        // Log Gemini 3 usage (extraction steps)
        const geminiInput = geminiUsage.promptTokenCount;
        const geminiOutput = geminiUsage.candidatesTokenCount;
        logUsage({
          userId: "anonymous",
          model: "gemini-3-flash-preview",
          inputTokens: geminiInput,
          outputTokens: geminiOutput,
          totalTokens: geminiUsage.totalTokenCount,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost("gemini-3-flash-preview", geminiInput, geminiOutput)
        });

        result = {
          result: text,
          usage: {
            promptTokenCount: genInput,
            candidatesTokenCount: genOutput,
            totalTokenCount: genResult.usageMetadata?.totalTokenCount || 0
          },
          geminiUsage,
          intermediateData: {
            resumeData,
            jdKeywords
          },
          _model: usedModel,
          _optimized: true
        };
        
        console.log(`[Usage Log] Model: ${usedModel}, In: ${genInput}, Out: ${genOutput}`);

      } catch (genError: any) {
        console.warn("[Pipeline] Gemini Pro Failed, falling back to Gemini Flash...", genError.message);
        
        // FALLBACK: Gemini 2.0 Flash
        const fallbackModelName = "gemini-2.0-flash";
        const genAI = new GoogleGenAI({ apiKey: geminiKey });
        
        const fallbackResult = await genAI.models.generateContent({
          model: fallbackModelName,
          contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        const text = fallbackResult.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error("Fallback Gemini failed to return valid JSON");

        const fallbackInput = fallbackResult.usageMetadata?.promptTokenCount || 0;
        const fallbackOutput = fallbackResult.usageMetadata?.candidatesTokenCount || 0;

        // Log Fallback usage
        logUsage({
          userId: "anonymous",
          model: fallbackModelName,
          inputTokens: fallbackInput,
          outputTokens: fallbackOutput,
          totalTokens: fallbackResult.usageMetadata?.totalTokenCount || 0,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost(fallbackModelName, fallbackInput, fallbackOutput)
        });

        // Log Gemini 3 usage (extraction steps)
        const geminiInput = geminiUsage.promptTokenCount;
        const geminiOutput = geminiUsage.candidatesTokenCount;
        logUsage({
          userId: "anonymous",
          model: "gemini-3-flash-preview",
          inputTokens: geminiInput,
          outputTokens: geminiOutput,
          totalTokens: geminiUsage.totalTokenCount,
          cacheHit: false,
          endpoint: "/api/v2/optimize",
          timestamp: Date.now(),
          cost: calculateCost("gemini-3-flash-preview", geminiInput, geminiOutput)
        });

        result = {
          result: jsonMatch[0],
          usage: {
            promptTokenCount: fallbackResult.usageMetadata?.promptTokenCount || 0, 
            candidatesTokenCount: fallbackResult.usageMetadata?.candidatesTokenCount || 0,
            totalTokenCount: fallbackResult.usageMetadata?.totalTokenCount || 0
          },
          geminiUsage,
          intermediateData: {
            resumeData,
            jdKeywords
          },
          _model: fallbackModelName,
          _optimized: true,
          _fallback: true
        };
        
        console.log(`[Usage Log] Fallback Model: ${fallbackModelName}`);
      }
    }

    // STEP 4: Cache Result
      Optimization.saveToCache(cacheKey, result);

      res.json(result);
    } catch (error: any) {
      console.error("V2 Optimization Error:", error);
      res.status(500).json({ error: "Failed to optimize resume via V2 pipeline", details: error.message });
    }
  });

  // API Endpoint for PDF Generation (Direct)
  app.post("/api/generate-pdf", async (req, res) => {
    const { html, css, fonts } = req.body;
    await handlePdfGeneration(html, css, fonts, res);
  });

  // API Endpoint to create a PDF session
  app.post("/api/pdf-session", (req, res) => {
    const { html, css, fonts, title } = req.body;
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }
    const sessionId = uuidv4();
    pdfSessions.set(sessionId, { html, css, fonts, title, timestamp: Date.now() });
    res.json({ sessionId });
  });

  // API Endpoint to download PDF from session
  app.get("/api/download-pdf/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const session = pdfSessions.get(sessionId);
    if (!session) {
      return res.status(404).send("PDF session expired or not found. Please try generating again.");
    }
    // Optional: delete session after retrieval to save memory
    // pdfSessions.delete(sessionId);
    await handlePdfGeneration(session.html, session.css, session.fonts, res, session.title);
  });

  async function handlePdfGeneration(html: string, css: string, fonts: string, res: any, title: string = "Resume") {
    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    console.log(`Generating PDF. HTML length: ${html.length}`);
    console.log(`CSS length: ${css?.length || 0}`);
    console.log(`Fonts length: ${fonts?.length || 0}`);
    console.log(`CSS snippet: ${css?.substring(0, 500) || ''}`);

    let browser;
    try {
      // In this environment, we often need to force puppeteer to use the installed chrome
      // or let it find its own. Deleting the env var sometimes helps if it points to a wrong path.
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
        ],
      });

      const page = await browser.newPage();
      
      // Set viewport to A4 dimensions at 96 DPI
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

      // Construct a more robust base HTML
      const baseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              /* Reset and Base Styles */
              * { box-sizing: border-box; }
              @page { 
                size: A4; 
                margin: 0; /* No margins to allow fixed-height pages to fit */
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              /* Ensure the resume container takes full width */
              #resume-container, .resume-page {
                width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
              /* Inject User Styles */
              ${css || ''}
              ${fonts || ''}
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Set content and wait for it to load
      await page.setContent(baseHtml, { 
        waitUntil: "networkidle2", // Wait until no more than 2 network connections
        timeout: 30000 
      });

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        pageRanges: "1-2"
      });

      console.log(`PDF generated. Size: ${pdfBuffer.length} bytes`);

      if (pdfBuffer.length < 100) {
        throw new Error("Generated PDF is suspiciously small. It might be empty or corrupted.");
      }

      // Set headers and send
      res.setHeader("Content-Type", "application/pdf");
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);

    } catch (error: any) {
      console.error("CRITICAL PDF ERROR:", error);
      // If we haven't sent headers yet, send a JSON error
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to generate PDF", 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error("Error closing puppeteer:", e);
        }
      }
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
