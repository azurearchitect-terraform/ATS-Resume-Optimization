import crypto from 'crypto';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
      "certifications": ["Cert Name"]
    }
    STRICT RULE: Extract EVERY SINGLE role present in the resume. Do not skip any jobs, even very old ones.
    Extract up to 10 bullets per role if available to ensure the next stage has enough content.
    
    RESUME:
    ${trimmedResume}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    
    if (parsed) {
      const responseObj = { data: parsed, usage: response.usageMetadata };
      saveToCache(partialKey, responseObj);
      return responseObj;
    }
    return { data: parsed, usage: response.usageMetadata };
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const trimmedJD = trimInput(jobDescription, 4000);

  const prompt = `
    Extract the top 12 essential keywords and requirements from this job description.
    Return ONLY a JSON array of strings.
    
    JD:
    ${trimmedJD}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    if (keywords && keywords.length > 0) {
      const responseObj = { data: keywords, usage: response.usageMetadata };
      saveToCache(partialKey, responseObj);
      return responseObj;
    }
    return { data: keywords, usage: response.usageMetadata };
  } catch (error) {
    console.error("Error extracting JD keywords:", error);
    return { data: [], usage: null };
  }
}

export function trimContentForAI(resumeData: any, keywords: string[]) {
  // Ensure we don't exceed reasonable limits
  return {
    personal_info: resumeData.personal_info || {},
    summary: resumeData.summary?.substring(0, 300),
    skills: resumeData.skills?.slice(0, 15),
    experience: resumeData.experience?.map((exp: any) => ({
      role: exp.role,
      company: exp.company,
      duration: exp.duration,
      achievements: exp.achievements?.slice(0, 10)
    })),
    projects: resumeData.projects?.slice(0, 3),
    education: resumeData.education,
    certifications: resumeData.certifications,
    jd_keywords: keywords.slice(0, 10)
  };
}
