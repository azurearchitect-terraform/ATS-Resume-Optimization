import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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
  // Increase payload limit for large HTML strings
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  console.log("Environment Variables Check:");
  console.log("PUPPETEER_EXECUTABLE_PATH:", process.env.PUPPETEER_EXECUTABLE_PATH);
  console.log("HTTP_PROXY:", process.env.HTTP_PROXY);

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

  // API Endpoint to optimize resume
  app.post("/api/optimize", async (req, res) => {
    const { encryptedKey, prompt, model, engine } = req.body;
    
    if (!encryptedKey || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const decryptedString = decrypt(encryptedKey);
      console.log(`Decrypted string: ${decryptedString.substring(0, 10)}...`);
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
      
      console.log(`Using ${engine} key (masked): ${apiKey.substring(0, 4)}****`);
      
      if (engine === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || "OpenAI API Error");
        }
        
        const data = await response.json();
        res.json({ 
          result: data.choices[0].message.content,
          usage: {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens
          }
        });
      } else {
        // Default to Gemini
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: model || "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        res.json({ 
          result: response.text,
          usage: {
            promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
            candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokenCount: response.usageMetadata?.totalTokenCount || 0
          }
        });
      }
    } catch (error: any) {
      console.error("Optimization Error:", error);
      // Send the error message back to the frontend for better debugging
      res.status(500).json({ error: "Failed to optimize resume", details: error.message || String(error) });
    }
  });

  // API Endpoint for PDF Generation
  app.post("/api/generate-pdf", async (req, res) => {
    const { html, css, fonts } = req.body;

    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    let browser;
    try {
      // Unconditionally delete PUPPETEER_EXECUTABLE_PATH to force puppeteer to use the locally installed browser
      // which we installed via postinstall script into .cache/puppeteer
      delete process.env.PUPPETEER_EXECUTABLE_PATH;

      // Launch Puppeteer with necessary flags for container environments
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Set a reasonable viewport
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

      // Construct the base HTML
      const baseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A4;
              }
              html, body {
                margin: 0;
                padding: 0;
                height: auto !important;
                min-height: 100% !important;
                -webkit-print-color-adjust: exact;
                background: white;
              }
              /* Ensure the resume-page fits perfectly and allows multiple pages */
              .resume-page {
                box-shadow: none !important;
                margin: 0 !important;
                border: none !important;
                width: 100% !important;
                min-height: 100% !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
                padding: 0 !important;
              }
              .resume-section {
                /* Removed page-break-inside to allow sections to break across pages */
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Set content
      await page.setContent(baseHtml, { waitUntil: "load", timeout: 30000 });

      // Inject styles safely
      if (css) {
        await page.addStyleTag({ content: css });
      }
      if (fonts) {
        await page.addStyleTag({ content: fonts });
      }
      
      // Wait for network to settle a bit for any external assets
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      } catch (e) {
        console.warn("Network idle timeout, proceeding with PDF generation");
      }
      
      // Wait for fonts to be ready
      await page.evaluateHandle('document.fonts.ready');

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        }
      });

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF buffer is empty");
      }

      console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "Content-Length": pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
