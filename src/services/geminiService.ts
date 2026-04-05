import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { routeTask, RouterConfig } from "./aiRouter";

export interface OptimizationResult {
  personal_info: {
    name: string;
    location: string;
    email: string;
    phone: string;
    linkedin: string;
    linkedinText?: string;
  };
  summary: string;
  skills: {
    Infrastructure: string[];
    DevSecOps: string[];
    Governance: string[];
    Observability: string[];
  };
  experience: {
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  certifications: string[];
  projects: { title: string; description: string }[];
  education: string[];
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  match_score: number;
  baseline_score: number;
  improvement_notes: string[];
  audience_alignment_notes: string;
  rejection_reasons?: string[];
  _usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export type EngineType = 'gemini' | 'openai';

export interface EngineConfig {
  engine: EngineType;
  model: string;
  apiKey?: string; // This will now hold the encrypted API key
}

function extractJson(text: string): string {
  if (!text) return "";
  
  // Try to find JSON block in markdown
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  let extracted = text;
  if (jsonMatch && jsonMatch[1]) {
    extracted = jsonMatch[1].trim();
  } else {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    if (firstBrace !== -1 && firstBracket !== -1) {
      if (firstBrace < firstBracket) {
        extracted = text.substring(firstBrace).trim();
      } else {
        extracted = text.substring(firstBracket).trim();
      }
    } else if (firstBrace !== -1) {
      extracted = text.substring(firstBrace).trim();
    } else if (firstBracket !== -1) {
      extracted = text.substring(firstBracket).trim();
    } else {
      extracted = text.trim();
    }
  }

  try {
    return jsonrepair(extracted);
  } catch (e) {
    console.error("Failed to repair JSON:", e);
    return extracted;
  }
}

async function callAI(prompt: string, model: string, engine: EngineType, encryptedKey?: string) {
  if (!encryptedKey) {
    throw new Error("API Key is missing. Please save your profile first.");
  }

  if (engine === 'gemini') {
    // Gemini MUST be called from the frontend as per guidelines
    try {
      // First, get the decrypted key from the backend
      const decryptResponse = await fetch('/api/decrypt-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedKey })
      });
      
      if (!decryptResponse.ok) {
        throw new Error("Failed to decrypt API key for frontend use");
      }
      
      const { keys } = await decryptResponse.json();
      const apiKey = keys.gemini;
      
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please save your profile first.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const tools: any[] = [];
      if (prompt.toLowerCase().includes('http') || prompt.toLowerCase().includes('url')) {
        tools.push({ urlContext: {} });
        tools.push({ googleSearch: {} });
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: prompt.toLowerCase().includes('json') ? "application/json" : "text/plain",
          tools: tools.length > 0 ? tools : undefined
        }
      });

      return {
        result: response!.text,
        usage: {
          promptTokenCount: response!.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response!.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response!.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error: any) {
      let errorMessage = error?.message || String(error);
      
      // Try to parse Gemini error if it's a JSON string
      try {
        if (errorMessage.startsWith('{')) {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error?.message) {
            errorMessage = parsed.error.message;
          }
        }
      } catch (e) {
        // Not a JSON string, ignore
      }

      console.error("Gemini Frontend Error:", errorMessage);
      throw new Error(errorMessage);
    }
  } else {
    // OpenAI and other engines can stay on the backend
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        engine,
        encryptedKey
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      const errorMessage = errData.details || errData.error || "Backend AI Call Failed";
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  }
}

export async function fetchJobDescription(url: string, config: RouterConfig): Promise<string> {
  const routedConfig = routeTask('extract_job_description', config);
  const prompt = `
You are an expert recruiter and data extractor.
Please read the following job posting URL and extract the full job description text.
Include the job title, company name, responsibilities, requirements, and any other relevant details.
Format the output as clean, readable text. Do not include any JSON formatting or extra conversational text.

JOB URL: ${url}
`;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return data.result || "";
  } catch (error) {
    console.error("Error fetching job description:", error);
    throw error;
  }
}

export async function optimizeResume(
  resumeText: string,
  jobDescription: string,
  targetRole: string,
  mode: "conservative" | "balanced" | "aggressive",
  audience: string,
  config: RouterConfig,
  linkedInUrl?: string,
  linkedInPdfText?: string,
  jobUrl?: string,
  fastMode: boolean = false,
  recruiterSimulationMode: boolean = false
): Promise<OptimizationResult> {
  const routedConfig = routeTask(recruiterSimulationMode ? 'recruiter_simulation' : 'rewrite_resume', config);
  const modelToUse = fastMode ? (routedConfig.engine === 'openai' ? 'gpt-5.4-mini' : 'gemini-3-flash-preview') : routedConfig.model;
  const prompt = `
ROLE:
You are a senior executive resume strategist.
${recruiterSimulationMode ? 'You are acting as a strict Hiring Manager/Recruiter. Your goal is to critically evaluate the resume against the job description and provide specific, actionable rejection reasons.' : ''}

STRICT RULES:
* Resume must fit within EXACTLY 2 A4 pages
* Do NOT exceed 2 pages
* Do NOT leave large empty spaces
* Use compact but powerful bullet points
* Maintain consistent spacing and alignment
* Ensure no text is cut from left or right margins

TASK:
1. Rewrite the summary (minimum 4–5 strong lines)
2. Optimize experience with impactful bullet points
3. Balance content across 2 pages
4. Ensure proper section distribution
5. Extract and format personal information (Name, Location, Email, Phone, LinkedIn)
${recruiterSimulationMode ? '6. Provide specific rejection reasons if the resume does not meet the JD requirements.' : ''}

FORMAT:
* Clean professional formatting
* Bullet points concise but strong
* No unnecessary spacing
* No explanations, only final resume

IMPORTANT:
The output must be layout-aware and ready for A4 PDF rendering.
The output will be rendered inside a Canva-like resume editor using a fixed A4 layout (794x1123 px per page).
You must generate structured, layout-safe content that fits within these constraints.
* ALWAYS use Smart Bullet Enhancer: rewrite bullets to be high-impact, quantifiable, and action-oriented.
* Calculate a REALISTIC and STRICT match score based on actual keyword overlap and experience match. Do not artificially inflate the score.
* DE-EMPHASIZE TERRAFORM & DEVOPS: The candidate has foundational knowledge in these areas. Do NOT over-focus on them or make them the primary highlight of the resume. Focus more on other core technical strengths and leadership.
* CACHING MECHANISM (PRESERVATION):
  - HEADER: Preserve the personal information exactly as provided.
  - EDUCATION: Do NOT re-optimize or change the education section if it is already well-formatted.
  - CERTIFICATIONS: Preserve existing certifications; only add new ones if they are highly relevant to the JD and missing.
* Ensure every bullet point starts with a strong action verb and includes a measurable result if possible.

CRITICAL ISSUES TO RESOLVE:
1. FULL CAREER HISTORY:
* Include ALL roles from the input resume in the experience section.
* Do NOT summarize older roles into a separate section.
* Every role must have at least 3 high-impact bullet points.
* Include quantifiable metrics (e.g., %, $, time saved) naturally where they make sense, but do not force them into every bullet to keep it looking normal.

2. EDUCATION:
* If a degree is in progress, reframe as: "Continuing Education" or "Degree in Progress".
* Maintain credibility and professionalism.

3. TITLE ALIGNMENT:
* Avoid over-titling. Align titles realistically with responsibilities.
* Maintain senior tone without exaggeration.

4. VISUAL STRUCTURE FOR UI:
* Do NOT include lines, separators, or styling text.
* Skills must be grouped logically for grid display: Infrastructure, DevSecOps, Governance, Observability.
* Keep skills short (1–3 words).

LAYOUT-SAFE CONTENT RULES (MANDATORY):
- SUMMARY: Comprehensive 6-8 line summary, leadership-focused, highlighting key strategic impact and technical vision.
- SKILLS: Max 15–20 items total across categories.
- EXPERIENCE: Include ALL roles from the input. For the 3 most recent roles, provide at most 7 high-impact bullets. For all other roles, provide at most 3-4 bullets. Each bullet max 15 words. Focus on impact and technical depth. Use quantifiable metrics (e.g., %) only when appropriate and realistic, avoiding an unnatural overload of numbers.
- CERTIFICATIONS: Max 5 items.
- PROJECTS: Max 3 high-impact technical projects. Use the projects from the Master Resume as the source. You MUST include this section if projects are present in the input.
- EDUCATION: Properly reframed. You MUST include this section.

INPUT:
RESUME: ${resumeText}
${linkedInPdfText ? `LINKEDIN PROFILE EXPORT: ${linkedInPdfText}` : ''}
${linkedInUrl ? `LINKEDIN PROFILE URL: ${linkedInUrl}` : ''}
${jobDescription ? `JOB DESCRIPTION: ${jobDescription}` : ''}
${jobUrl ? `JOB DESCRIPTION URL: ${jobUrl}` : ''}
TARGET ROLE: ${targetRole}
OPTIMIZATION MODE: ${mode}
TARGET AUDIENCE: ${audience}
RECRUITER SIMULATION MODE: ${recruiterSimulationMode}

-----------------------------------
⚙️ PROCESSING STEPS
-----------------------------------
1. Extract key requirements and keywords from JD (or JD URL).
2. Identify gaps between resume (and LinkedIn profile) and JD.
3. Calculate a BASELINE ATS score (0-100).
4. Optimize all sections following the STRICT RULES above.
5. Ensure ATS keyword density is improved naturally.
6. Calculate approximate optimized match score (0–100).
7. Ensure PROJECTS and EDUCATION are included in the final JSON.
${recruiterSimulationMode ? '8. Provide specific rejection reasons if the resume does not meet the JD requirements.' : ''}

Return the result in the following JSON format: { "personal_info": { "name": string, "location": string, "email": string, "phone": string, "linkedin": string, "linkedinText": string }, "summary": string, "skills": { "Infrastructure": string[], "DevSecOps": string[], "Governance": string[], "Observability": string[] }, "experience": { "role": string, "company": string, "duration": string, "bullets": string[] }[], "projects": { "title": string, "description": string }[], "education": string[], "certifications": string[], "ats_keywords_from_jd": string[], "ats_keywords_added_to_resume": string[], "keyword_gap": string[], "match_score": number, "baseline_score": number, "improvement_notes": string[], "audience_alignment_notes": string, "rejection_reasons": string[] }
`;

  const maxRetries = 5;
  let retryCount = 0;
  let currentModel = modelToUse;

  while (retryCount <= maxRetries) {
    try {
      const data = await callAI(prompt, currentModel, routedConfig.engine, routedConfig.apiKey);
      const resultText = extractJson(data.result || "");

      if (!resultText) {
        throw new Error(`No response from ${routedConfig.engine}`);
      }

      try {
        const parsed = JSON.parse(resultText);
        
        // Ensure scores are present and numeric
        if (typeof parsed.match_score !== 'number') {
          parsed.match_score = parseInt(parsed.match_score) || 70;
        }
        if (typeof parsed.baseline_score !== 'number') {
          parsed.baseline_score = parseInt(parsed.baseline_score) || 50;
        }

        if (data.usage) {
          parsed._usage = data.usage;
        }
        return parsed;
      } catch (e) {
        console.error(`Error parsing ${routedConfig.engine} response:`, e, "Raw text:", resultText);
        throw new Error(`JSON_PARSING_ERROR: The ${routedConfig.engine} engine returned an invalid response format.`);
      }
    } catch (error: any) {
      const errorString = error?.message || String(error);
      const isRateLimit = errorString.includes("429") || 
                         errorString.includes("RESOURCE_EXHAUSTED") ||
                         errorString.includes("quota") ||
                         errorString.includes("rate limit");
      const isJsonError = errorString.includes("JSON_PARSING_ERROR") || 
                          errorString.includes("invalid response format");
      
      if ((isRateLimit || isJsonError) && retryCount < maxRetries) {
        retryCount++;
        
        // Fallback to Flash if Pro fails with rate limit or JSON error
        if (routedConfig.engine === 'gemini' && currentModel.includes('pro')) {
          console.warn(`Error hit on Gemini Pro. Falling back to Gemini Flash for retry ${retryCount}...`);
          currentModel = 'gemini-3-flash-preview';
        }

        const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
        const retryMsg = isRateLimit 
          ? `Gemini API quota exceeded. Retrying with exponential backoff (${retryCount}/${maxRetries})...`
          : `Invalid AI response format. Retrying (${retryCount}/${maxRetries})...`;
          
        console.warn(`${retryMsg} (Delay: ${Math.round(delay)}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(`Maximum retries exceeded for ${routedConfig.engine}. Please try again in a few minutes.`);
}

export async function analyzeSkillGap(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig
): Promise<{ missing: string[], present: string[] }> {
  const routedConfig = routeTask('extract_skills', config);
  const prompt = `
      Analyze the following resume and job description.
      Identify the skills present in the resume and the skills required by the job description that are missing from the resume.
      Return the result as a JSON object: { "missing": string[], "present": string[] }
      
      RESUME: ${resumeText}
      JOB DESCRIPTION: ${jobDescription}
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"missing":[], "present":[]}');
  } catch (error) {
    console.error("Error analyzing skill gap:", error);
    throw error;
  }
}

export async function analyzeBestAudiences(
  jobDescription: string,
  targetRole: string,
  config: RouterConfig
): Promise<string[]> {
  const routedConfig = routeTask('multi_audience', config);
  console.log('analyzeBestAudiences called', { jobDescription, targetRole });
  const prompt = `
    Analyze the following Job Description and Target Role.
    Select the most appropriate audiences from the following list:
    - cloud-architect
    - cloud-ops
    - leadership
    - solution-architect
    - infra-engineer
    - microsoft
    - startup
    - technical
    - consulting
    
    Return ONLY a JSON array of the IDs of the best matching audiences. Example: ["cloud-architect", "leadership"]
    
    JOB DESCRIPTION: ${jobDescription}
    TARGET ROLE: ${targetRole}
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    const parsed = JSON.parse(resultText || '[]');
    return Array.isArray(parsed) ? parsed : (parsed.audiences || ['microsoft']);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      console.warn("Auto-audience selection skipped: Gemini API quota exceeded. Using default audience.");
    } else {
      console.error("Error analyzing best audiences:", errorMsg);
    }
    return ['microsoft'];
  }
}

export async function generateInterviewQuestions(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string[]> {
  const routedConfig = routeTask('interview_questions', config);
  const prompt = `
      Based on the following job description and the candidate's resume, generate 5-10 potential interview questions.
      Return the result as a JSON array of strings: [ "question1", "question2", ... ]
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    const parsed = JSON.parse(resultText || '[]');
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return [];
  }
}

export async function generateRecruiterMessage(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('recruiter_message', config);
  const prompt = `
      You are an expert career coach.
      Write a short, professional, and engaging message for a recruiter to accompany a resume application.
      The message should be concise (max 100 words), highlight the candidate's interest in the role, and briefly mention why they are a good fit based on the job description and resume.
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      
      Return the message as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    let result = data.result || "";
    
    // Try to parse if it looks like JSON
    if (result.includes('{') && result.includes('}')) {
       try {
         const jsonStr = extractJson(result);
         const parsed = JSON.parse(jsonStr);
         if (parsed.message) {
           result = parsed.message;
         } else if (parsed.recruiter_message) {
           result = parsed.recruiter_message;
         }
       } catch (e) {
         // Ignore and use raw result
       }
    }
    return result.trim();
  } catch (error) {
    console.error("Error generating recruiter message:", error);
    return "";
  }
}

export async function generateCoverLetter(
  jobDescription: string,
  resumeText: string,
  targetRole: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('cover_letter', config);
  const prompt = `
      You are an expert career coach and professional writer.
      Write a high-impact, persuasive cover letter for the following job description and candidate resume.
      The cover letter should be professional, concise (max 300-400 words), and specifically highlight how the candidate's experience aligns with the job requirements.
      Focus on the value the candidate brings to the company.
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      TARGET ROLE: ${targetRole}
      
      Return the cover letter as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    let result = data.result || "";
    
    // Try to parse if it looks like JSON
    if (result.includes('{') && result.includes('}')) {
       try {
         const jsonStr = extractJson(result);
         const parsed = JSON.parse(jsonStr);
         if (parsed.cover_letter) {
           result = parsed.cover_letter;
         } else if (parsed.coverLetter) {
           result = parsed.coverLetter;
         }
       } catch (e) {
         // Ignore and use raw result
       }
    }
    return result.trim();
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return "";
  }
}
