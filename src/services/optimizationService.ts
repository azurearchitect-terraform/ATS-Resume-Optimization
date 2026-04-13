import crypto from 'crypto';
import { GoogleGenerativeAI } from "@google/generative-ai";

// In-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface OptimizationInput {
  resumeText: string;
  jobDescription: string;
  mode: string;
  targetAudience: string;
  customPrompt?: string;
}

/**
 * Generates a unique cache key based on input parameters
 */
export function generateCacheKey(input: OptimizationInput): string {
  const { resumeText, jobDescription, mode, targetAudience, customPrompt } = input;
  const content = `${resumeText}|${jobDescription}|${mode}|${targetAudience}|${customPrompt || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Retrieves a result from the cache if it exists and is not expired
 */
export function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Cache] Hit for key: ${key}`);
      return cached.data;
    }
    console.log(`[Cache] Expired for key: ${key}`);
    cache.delete(key);
  }
  return null;
}

/**
 * Saves a result to the cache
 */
export function saveToCache(key: string, data: any): void {
  console.log(`[Cache] Saving result for key: ${key}`);
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Step 1: Extract only the most relevant data from the resume using Gemini (cheap)
 */
export async function extractRelevantResumeData(resumeText: string, geminiApiKey: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Extract the most important information from this resume for a job application.
    Focus on:
    1. Key skills (technical and soft)
    2. Most recent 3-4 professional experiences (Role, Company, Key Achievements)
    3. Education summary
    4. Certifications
    
    Return the data as a clean, structured JSON object.
    
    RESUME:
    ${resumeText}
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    // Basic JSON extraction from markdown if needed
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse extracted resume data:", e);
    return { raw: resumeText.substring(0, 2000) }; // Fallback
  }
}

/**
 * Step 1b: Extract key requirements and keywords from the JD using Gemini (cheap)
 */
export async function extractJDKeywords(jobDescription: string, geminiApiKey: string): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Extract the top 15-20 essential keywords and requirements from this job description.
    Include technical skills, tools, methodologies, and soft skills mentioned.
    
    Return only a JSON array of strings.
    
    JOB DESCRIPTION:
    ${jobDescription}
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JD keywords:", e);
    return [];
  }
}

/**
 * Step 2: Trim and structure content to minimize tokens for the expensive AI call
 */
export function trimContentForAI(structuredData: any, keywords: string[]): any {
  // Limit bullets per job to save tokens
  if (structuredData.experience && Array.isArray(structuredData.experience)) {
    structuredData.experience = structuredData.experience.map((exp: any) => ({
      ...exp,
      achievements: exp.achievements ? exp.achievements.slice(0, 5) : []
    }));
  }

  // Remove redundant or low-value fields if they exist
  delete structuredData.references;
  delete structuredData.hobbies;

  return {
    ...structuredData,
    target_keywords: keywords
  };
}
