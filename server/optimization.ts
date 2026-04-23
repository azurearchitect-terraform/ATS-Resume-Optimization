import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";

/**
 * Caching Architecture (In-memory, Redis-ready)
 */
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours

export function generateCacheKey(input: any): string {
  // Ensure stable key by sorting keys if it's an object
  const cleanInput = typeof input === 'object' ? 
    Object.keys(input).sort().reduce((acc: any, key) => {
      acc[key] = input[key];
      return acc;
    }, {}) : input;
  return crypto.createHash('sha256').update(JSON.stringify(cleanInput)).digest('hex');
}

export function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Cache] Hit: ${key}`);
    return cached.data;
  }
  return null;
}

export function saveToCache(key: string, data: any): void {
  console.log(`[Cache] Saving: ${key}`);
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(): void {
  console.log(`[Cache] Clearing all entries`);
  cache.clear();
}

/**
 * Token Optimization Strategy
 */

/**
 * Trims input text to a reasonable limit before sending to any AI
 */
export function trimInput(text: string, maxLength: number = 4000): string {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

export async function extractRelevantResumeData(resumeText: string, apiKey: string) {
  // Partial Caching: Check if this specific resume text has been parsed before
  const partialKey = generateCacheKey({ type: 'resume_parse', text: resumeText });
  const cached = getFromCache(partialKey);
  if (cached) return cached;

  const genAI = new GoogleGenAI({ apiKey });
  const trimmedResume = trimInput(resumeText, 6000);

  const prompt = `
    Extract essential professional data from this resume. 
    Focus on high-impact achievements and core skills.
    Return ONLY a JSON object:
    {
      "personal_info": { "name": "", "location": "", "email": "", "phone": "", "linkedin": "" },
      "summary": "Brief professional overview",
      "skills": ["Skill 1", "Skill 2"],
      "experience": [
        {
          "role": "Job Title",
          "company": "Company Name",
          "duration": "Dates",
          "achievements": ["Achievement 1", "Achievement 2"]
        }
      ],
      "projects": [
        { "title": "Project Name", "description": "Description" }
      ],
      "education": ["Degree, School"],
      "certifications": [
        { "name": "Cert Name", "issuer": "Issuing Body", "date": "Date" }
      ]
    }
    STRICT RULE: Extract EVERY SINGLE role present in the resume. Do not skip any jobs, even very old ones.
    Extract up to 10 bullets per role if available to ensure the next stage has enough content.
    
    RESUME:
    ${trimmedResume}
  `;

  // Start with Gemini 3.1 Flash
  let primaryModel = "gemini-3.1-flash-lite-preview";
  let fallbackModel = "gemini-2.0-flash";

  try {
    try {
      console.log(`[Optimization] Step 1: Attempting extraction with ${primaryModel}...`);
      const response = await genAI.models.generateContent({
        model: primaryModel,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      
      if (parsed) {
        const responseObj = { data: parsed, usage: (response as any).usageMetadata, _model: primaryModel };
        saveToCache(partialKey, responseObj);
        return responseObj;
      }
    } catch (quotaError: any) {
      const errorMsg = quotaError?.message?.toLowerCase() || "";
      if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted")) {
        console.warn(`[Optimization] ${primaryModel} quota reached. Falling back to ${fallbackModel}...`);
        const response = await genAI.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        
        if (parsed) {
          const responseObj = { data: parsed, usage: (response as any).usageMetadata, _model: fallbackModel };
          saveToCache(partialKey, responseObj);
          return responseObj;
        }
      } else {
        throw quotaError;
      }
    }
    return { data: null, usage: null };
  } catch (error) {
    console.error("Error extracting resume data:", error);
    return { data: null, usage: null };
  }
}

export async function extractJDKeywords(jobDescription: string, apiKey: string) {
  // Partial Caching: Check if this specific JD has been analyzed before
  const partialKey = generateCacheKey({ type: 'jd_keywords', text: jobDescription });
  const cached = getFromCache(partialKey);
  if (cached) return cached;

  const genAI = new GoogleGenAI({ apiKey });
  const trimmedJD = trimInput(jobDescription, 4000);

  const prompt = `
    Extract the top 12 essential keywords and requirements from this job description.
    Return ONLY a JSON array of strings.
    
    JD:
    ${trimmedJD}
  `;

  // Start with Gemini 3.1 Flash
  let primaryModel = "gemini-3.1-flash-lite-preview";
  let fallbackModel = "gemini-2.0-flash";

  try {
    try {
      console.log(`[Optimization] Step 1: Attempting JD analysis with ${primaryModel}...`);
      const response = await genAI.models.generateContent({
        model: primaryModel,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      if (keywords && keywords.length > 0) {
        const responseObj = { data: keywords, usage: (response as any).usageMetadata, _model: primaryModel };
        saveToCache(partialKey, responseObj);
        return responseObj;
      }
    } catch (quotaError: any) {
      const errorMsg = quotaError?.message?.toLowerCase() || "";
      if (errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("resource_exhausted")) {
        console.warn(`[Optimization] ${primaryModel} quota reached. Falling back to ${fallbackModel}...`);
        const response = await genAI.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        
        if (keywords && keywords.length > 0) {
          const responseObj = { data: keywords, usage: (response as any).usageMetadata, _model: fallbackModel };
          saveToCache(partialKey, responseObj);
          return responseObj;
        }
      } else {
        throw quotaError;
      }
    }
    return { data: [], usage: null };
  } catch (error) {
    console.error("Error extracting JD keywords:", error);
    return { data: [], usage: null };
  }
}

export function trimContentForAI(resumeData: any, keywords: string[]) {
  // Remove duplicates from skills and achievements
  const seenSkills = new Set<string>();
  const uniqueSkills = (resumeData.skills || []).filter((s: string) => {
    const normalized = s.toLowerCase().trim();
    if (seenSkills.has(normalized)) return false;
    seenSkills.add(normalized);
    return true;
  });

  // Ensure we don't exceed reasonable limits but provide enough for Step 3
  return {
    personal_info: resumeData.personal_info || {},
    // Trim summary to ~100 words (approx 6 char/word = 600 chars)
    summary: resumeData.summary?.substring(0, 600),
    skills: uniqueSkills.slice(0, 20),
    experience: (resumeData.experience || []).map((exp: any) => {
      const seenBullets = new Set<string>();
      return {
        role: exp.role,
        company: exp.company,
        duration: exp.duration,
        // Remove duplicate bullets and provide up to 10 for AI selection
        achievements: (exp.achievements || [])
          .filter((a: string) => {
            const normalized = a.toLowerCase().trim();
            if (seenBullets.has(normalized)) return false;
            seenBullets.add(normalized);
            return true;
          })
          .slice(0, 10)
      };
    }),
    projects: (resumeData.projects || []).slice(0, 3),
    education: resumeData.education,
    certifications: resumeData.certifications,
    jd_keywords: (keywords || []).slice(0, 12)
  };
}
