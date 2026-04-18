import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { routeTask, RouterConfig } from "./aiRouter";
import { SuitabilityResult } from "../types";

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
  why_this_job?: string;
  rejection_reasons?: string[];
  _usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  _geminiUsage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  _intermediateData?: {
    resumeData: any;
    jdKeywords: string[];
  };
  _engine?: string;
  _model?: string;
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
  if (engine === 'openai' && !encryptedKey) {
    throw new Error("OpenAI API Key is missing. Please save your profile first.");
  }

  if (engine === 'gemini') {
    // Gemini MUST be called from the frontend as per guidelines
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("Gemini API key is missing from the environment.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({ 
        model: model || "gemini-3.1-pro-preview",
        generationConfig: {
          responseMimeType: prompt.toLowerCase().includes('json') ? "application/json" : "text/plain",
        }
      });

      const result = await genModel.generateContent(prompt);
      const response = result.response;

      return {
        result: response.text(),
        usage: {
          promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata?.totalTokenCount || 0
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

export async function evaluateSuitability(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig
): Promise<SuitabilityResult> {
  const routedConfig = routeTask('evaluate_suitability', config);
  const modelToUse = routedConfig.engine === 'openai' ? 'gpt-4o-mini' : 'gemini-3.1-pro-preview';

  const prompt = `
You are an expert technical recruiter screening a candidate's resume against a job description.
Your goal is to quickly evaluate if the candidate is a good fit, a stretch, or not recommended.
Look for hard dealbreakers (years of experience, mandatory skills, clearance, role level).

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY a JSON object with the following structure:
{
  "verdict": "Strong Match" | "Stretch Role" | "Not Recommended",
  "matchScore": number (0-100),
  "dealbreakers": string[] (list of major missing requirements, empty if none),
  "strengths": string[] (list of key matching qualifications),
  "reasoning": string (1-2 sentences explaining the verdict)
}
`;

  try {
    const data = await callAI(prompt, modelToUse, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    if (!resultText) throw new Error("No response from AI");
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error evaluating suitability:", error);
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
  recruiterSimulationMode: boolean = false,
  customPrompt?: string,
  pipelineType?: string
): Promise<OptimizationResult> {
  const routedConfig = routeTask(recruiterSimulationMode ? 'recruiter_simulation' : 'rewrite_resume', config);
  
  // Cost-saving logic: If fastMode is enabled, prefer Gemini Flash even in Hybrid mode to reduce OpenAI costs
  let modelToUse = routedConfig.model;
  let engineToUse = routedConfig.engine;
  
  if (fastMode) {
    if (config.mode === 'production') {
      // In Hybrid mode, fastMode forces Gemini to save costs
      engineToUse = 'gemini';
      modelToUse = 'gemini-2.0-flash';
    } else {
      // In single-engine mode, just use the smaller model
      modelToUse = routedConfig.engine === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash';
    }
  }

  const isLeadershipRole = /director|manager|lead|head|executive|vp|chief|principal|senior manager/i.test(targetRole);
  const isTechnicalRole = /engineer|developer|architect|specialist|analyst|technician/i.test(targetRole);

  // V2 PIPELINE INTEGRATION: Use the optimized backend pipeline for production mode
  if ((config.mode === 'production' || pipelineType) && !recruiterSimulationMode && !fastMode) {
    try {
      const response = await fetch('/api/v2/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          targetRole,
          mode,
          audience,
          customPrompt,
          encryptedKey: config.openaiConfig.apiKey,
          pipelineType
        })
      });

      if (response.ok) {
        const data = await response.json();
        const resultText = extractJson(data.result || "");
        const parsed = JSON.parse(resultText);
        
        // Post-processing
        parsed._engine = 'hybrid-v2';
        if (data.usage) parsed._usage = data.usage;
        if (data.geminiUsage) parsed._geminiUsage = data.geminiUsage;
        if (data.intermediateData) parsed._intermediateData = data.intermediateData;
        
        // Apply UI formatting
        const skillCategories = Object.keys(parsed.skills || {});
        const formattedSkills: Record<string, string[]> = {};
        skillCategories.slice(0, 4).forEach(cat => {
          formattedSkills[cat] = parsed.skills[cat];
        });
        const defaultCats = isLeadershipRole 
          ? ["Strategic Leadership", "Management", "Operations", "Technical Proficiency"]
          : ["Core Technical", "Tools & Frameworks", "Process & Methodology", "Soft Skills"];
        while (Object.keys(formattedSkills).length < 4) {
          const nextCat = defaultCats.find(c => !formattedSkills[c]);
          if (nextCat) formattedSkills[nextCat] = [];
          else formattedSkills[`Category ${Object.keys(formattedSkills).length + 1}`] = [];
        }
        parsed.skills = formattedSkills;
        
        // Apply title fix to V2 results as well
        const fixTitle = (obj: any): any => {
          if (typeof obj === 'string') {
            return obj.replace(/Office IT [Cc]um Logistics/g, 'Officer IT cum Logistics');
          }
          if (Array.isArray(obj)) {
            return obj.map(fixTitle);
          }
          if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
              newObj[key] = fixTitle(obj[key]);
            }
            return newObj;
          }
          return obj;
        };

        return fixTitle(parsed);
      }
    } catch (e) {
      console.warn("V2 Pipeline failed, falling back to legacy optimization:", e);
    }
  }

  const prompt = `
ROLE: Senior Executive Resume Strategist.
${recruiterSimulationMode ? 'TASK: Critical Hiring Manager Review. Provide rejection reasons.' : 'TASK: Optimize resume for target role.'}

${customPrompt ? `CUSTOM: ${customPrompt}` : ''}

STRICT RULES:
- PRESERVE TITLES: Do not change job titles. Specifically, NEVER change "Officer IT cum Logistics" to "Office IT cum Logistics". This is a mandatory requirement.
- INCLUDE ALL ROLES: Do not skip older roles. Include every role present in the input.
- MAX 2 PAGES: Content must fit A4 layout (794x1123px).
- TONE: Professional, human-like. Avoid AI clichés (spearheaded, synergized, etc.).
- SCORE: Realistic match score (0-100).
- SECTIONS: Summary (3-4 lines), Experience (Impactful bullets, max 7 for recent, 3 for older), Skills (4 categories), Projects (Max 3), Education & Certs (Preserve existing).

INPUT:
RESUME: ${resumeText}
JD: ${jobDescription}
ROLE: ${targetRole}
MODE: ${mode} | AUDIENCE: ${audience}

OUTPUT: JSON matching OptimizationResult schema.
OUTPUT SCHEMA (MUST MATCH EXACTLY):
{
  "personal_info": { "name": "string", "location": "string", "email": "string", "phone": "string", "linkedin": "string", "linkedinText": "string" },
  "summary": "string",
  "skills": { "Category 1": ["string"], "Category 2": ["string"], "Category 3": ["string"], "Category 4": ["string"] },
  "experience": [ { "role": "string", "company": "string", "duration": "string", "bullets": ["string"] } ],
  "projects": [ { "title": "string", "description": "string" } ],
  "education": ["string"],
  "certifications": ["string"],
  "ats_keywords_from_jd": ["string"],
  "ats_keywords_added_to_resume": ["string"],
  "keyword_gap": ["string"],
  "match_score": 85,
  "baseline_score": 60,
  "improvement_notes": ["string"],
  "audience_alignment_notes": "string",
  "rejection_reasons": ["string"]
}
`;

  const maxRetries = 5;
  let retryCount = 0;
  let currentModel = modelToUse;

  while (retryCount <= maxRetries) {
    try {
      // Use the potentially overridden engine and model
      const currentApiKey = engineToUse === 'openai' ? config.openaiConfig.apiKey : config.geminiConfig.apiKey;
      const data = await callAI(prompt, currentModel, engineToUse, currentApiKey);
      const resultText = extractJson(data.result || "");

      if (!resultText) {
        throw new Error(`No response from ${engineToUse}`);
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

        // Skills must be grouped into 4 categories. We'll use the keys from the AI response.
        const skillCategories = Object.keys(parsed.skills || {});
        const formattedSkills: Record<string, string[]> = {};
        
        // Ensure we have exactly 4 categories for the UI grid
        skillCategories.slice(0, 4).forEach(cat => {
          formattedSkills[cat] = parsed.skills[cat];
        });

        // Fill in missing categories if less than 4
        const defaultCats = isLeadershipRole 
          ? ["Strategic Leadership", "Management", "Operations", "Technical Proficiency"]
          : ["Core Technical", "Tools & Frameworks", "Process & Methodology", "Soft Skills"];
          
        while (Object.keys(formattedSkills).length < 4) {
          const nextCat = defaultCats.find(c => !formattedSkills[c]);
          if (nextCat) formattedSkills[nextCat] = [];
          else formattedSkills[`Category ${Object.keys(formattedSkills).length + 1}`] = [];
        }

        parsed.skills = formattedSkills;
        parsed._engine = engineToUse;

        if (data.usage) {
          parsed._usage = data.usage;
        }

        // FAIL-SAFE: Ensure "Officer IT cum Logistics" is preserved and not changed to "Office IT cum Logistics"
        const fixTitle = (obj: any): any => {
          if (typeof obj === 'string') {
            // Case insensitive match but replace with exact casing
            return obj.replace(/Office IT [Cc]um Logistics/g, 'Officer IT cum Logistics');
          }
          if (Array.isArray(obj)) {
            return obj.map(fixTitle);
          }
          if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
              newObj[key] = fixTitle(obj[key]);
            }
            return newObj;
          }
          return obj;
        };

        return fixTitle(parsed);
      } catch (e) {
        console.error(`Error parsing ${engineToUse} response:`, e, "Raw text:", resultText);
        throw new Error(`JSON_PARSING_ERROR: The ${engineToUse} engine returned an invalid response format.`);
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
        if (engineToUse === 'gemini' && currentModel.includes('pro')) {
          console.warn(`Error hit on Gemini Pro. Falling back to Gemini Flash for retry ${retryCount}...`);
          currentModel = 'gemini-2.0-flash';
        }

        const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
        const retryMsg = isRateLimit 
          ? `AI API quota exceeded. Retrying with exponential backoff (${retryCount}/${maxRetries})...`
          : `Invalid AI response format. Retrying (${retryCount}/${maxRetries})...`;
          
        console.warn(`${retryMsg} (Delay: ${Math.round(delay)}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(`Maximum retries exceeded for ${engineToUse}. Please try again in a few minutes.`);
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
  const modelToUse = 'gemini-3.1-pro-preview';
  const prompt = `
    Analyze the following Job Description and Target Role.
    Select the most appropriate audiences from the following list:
    - microsoft
    - leadership
    - cloud-architect
    - solution-architect
    - consulting
    - cloud-eng-mgr
    - infra-mgr
    - assoc-director
    - director-mid
    - director-large
    - principal-architect
    - cto-vp
    - digital-transform
    - platform-dir
    
    If NONE of the above audiences are a perfect fit for the Target Role and JD, you MUST suggest a custom audience name that best describes the target persona (e.g., "Product Management", "Data Science", "Frontend Engineering").
    
    Return ONLY a JSON array of the IDs or custom names. Example: ["cloud-architect", "leadership"] or ["Product Management"]
    
    JOB DESCRIPTION: ${jobDescription}
    TARGET ROLE: ${targetRole}
  `;

  try {
    const data = await callAI(prompt, modelToUse, 'gemini', routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    const parsed = JSON.parse(resultText || '[]');
    return Array.isArray(parsed) ? parsed : (parsed.audiences || [targetRole]);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      console.warn("Auto-audience selection skipped: Gemini API quota exceeded. Using Target Role as default.");
    } else {
      console.error("Error analyzing best audiences:", errorMsg);
    }
    return [targetRole];
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
      
      CRITICAL: You MUST identify the company name from the job description and use it throughout the letter. Do not use placeholders like "[Company Name]". If the company name is not explicitly clear, use a generic but professional reference like "the team at your organization".
      
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

export async function analyzeLinkedInProfile(
  resumeText: string,
  linkedInText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('linkedin_analysis', config);
  const prompt = `
      You are an expert LinkedIn profile optimizer and career coach.
      Analyze the following candidate's resume and their LinkedIn profile text.
      Provide a comprehensive review of the LinkedIn profile, highlighting strengths, areas for improvement, and specific suggestions to optimize it for better visibility and impact.
      
      RESUME: ${resumeText}
      LINKEDIN PROFILE: ${linkedInText}
      
      Return the review as a structured markdown document.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return data.result || "";
  } catch (error) {
    console.error("Error analyzing LinkedIn profile:", error);
    throw error;
  }
}

export async function generateWhyThisJob(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('recruiter_message', config);
  const prompt = `
      You are a career strategist.
      Recruiters often ask "Why did you apply for this job?" or "What thrilled you about this role?".
      Based on the job description and the candidate's resume, draft a compelling, authentic response (max 150 words).
      Focus on the specific alignment between the company's mission/needs and the candidate's passions/skills.
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      
      Return the response as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return (data.result || "").trim();
  } catch (error) {
    console.error("Error generating Why This Job response:", error);
    return "";
  }
}

export async function optimizeHeadline(
  currentHeadline: string,
  resumeSummary: string,
  keySkills: string[],
  targetRole: string,
  config: RouterConfig
): Promise<{ headline: string; keywords_used: string[] }> {
  const routedConfig = routeTask('optimize_headline', config);
  const prompt = `
    You are a LinkedIn headline optimization expert for IT and Cloud professionals.

    Input:
    - Current Headline: ${currentHeadline}
    - Resume Summary: ${resumeSummary}
    - Key Skills: ${JSON.stringify(keySkills)}
    - Target Role: ${targetRole}

    Tasks:
    1. Rewrite the headline to be:
       - Keyword-rich (ATS and recruiter friendly)
       - Clear and impactful
       - Aligned with target role
    2. Include important keywords like Azure, Cloud, Infrastructure, Migration, etc. if relevant
    3. Keep it under 220 characters

    Constraints:
    - No buzzword stuffing
    - No fake claims
    - Must reflect real experience

    Output (STRICT JSON):
    {
      "headline": "...",
      "keywords_used": ["...", "..."]
    }
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"headline": "", "keywords_used": []}');
  } catch (error) {
    console.error("Error optimizing headline:", error);
    throw error;
  }
}
