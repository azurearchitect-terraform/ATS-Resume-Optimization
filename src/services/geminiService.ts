import { GoogleGenAI, Type } from "@google/genai";
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

export async function evaluateSuitability(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig
): Promise<SuitabilityResult> {
  const routedConfig = routeTask('evaluate_suitability', config);
  const modelToUse = routedConfig.engine === 'openai' ? 'gpt-4o-mini' : 'gemini-3-flash-preview';

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
  customPrompt?: string
): Promise<OptimizationResult> {
  const routedConfig = routeTask(recruiterSimulationMode ? 'recruiter_simulation' : 'rewrite_resume', config);
  const modelToUse = fastMode ? (routedConfig.engine === 'openai' ? 'gpt-5.4-mini' : 'gemini-3-flash-preview') : routedConfig.model;
  const isLeadershipRole = /director|manager|lead|head|executive|vp|chief|principal|senior manager/i.test(targetRole);
  const isTechnicalRole = /engineer|developer|architect|specialist|analyst|technician/i.test(targetRole);

  const prompt = `
ROLE:
You are a senior executive resume strategist.
${recruiterSimulationMode ? 'You are acting as a strict Hiring Manager/Recruiter. Your goal is to critically evaluate the resume against the job description and provide specific, actionable rejection reasons.' : ''}

${customPrompt ? `CUSTOM USER INSTRUCTIONS (PRIORITY):
${customPrompt}
` : ''}

STRICT RULES:
* Resume must fit within EXACTLY 2 A4 pages
* Do NOT exceed 2 pages
* Do NOT leave large empty spaces
* Use compact but powerful bullet points
* Maintain consistent spacing and alignment
* Ensure no text is cut from left or right margins

TASK:
1. Rewrite the summary (medium length, 3-4 strong lines)
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
* HUMAN-LIKE, REALISTIC TONE: The resume MUST sound like it was written by a human professional, not an AI. STRICTLY AVOID common AI buzzwords and clichés such as "spearheaded", "synergized", "testament to", "delved into", "unwavering", "pivotal", "catalyst", "fostered", "orchestrated", "navigated", "seamlessly", "elevated", "championed", or "transformative". Use plain, direct, and professional business language.
* PROFESSIONAL EXPERTISE: Ensure the tone reflects deep expertise and seniority. Use sophisticated but clear vocabulary. Do not oversimplify the candidate's achievements; instead, articulate them with precision and impact.
* Calculate a REALISTIC and STRICT match score based on how well the candidate's strengths align with the JD requirements. Do not artificially cap the score; if it is a 95% match, score it 95%.
${isLeadershipRole ? `* FOCUS ON LEADERSHIP & STRATEGY: Since this is a ${targetRole} role, emphasize strategic vision, team management, stakeholder engagement, budget oversight, and business impact. De-emphasize hands-on technical tasks in favor of high-level outcomes.` : ''}
${isTechnicalRole && !isLeadershipRole ? `* FOCUS ON TECHNICAL DEPTH: Highlight specific tools, architectures, and technical problem-solving. Ensure the resume demonstrates deep expertise in the required tech stack.` : ''}
* TITLE PRESERVATION: STRICTLY preserve the exact role title "Officer IT Cum Logistics" if provided. Do NOT change, rephrase, or correct it, even if it seems like a typo.
* CACHING MECHANISM (PRESERVATION):
  - HEADER: Preserve the personal information exactly as provided.
  - EDUCATION: Do NOT re-optimize or change the education section if it is already well-formatted.
  - CERTIFICATIONS: STRICTLY preserve existing certifications from the input resume. DO NOT invent, hallucinate, or add any new certifications under any circumstances. If the user has 3 certifications, output exactly those 3.
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
* Skills must be grouped logically for grid display into 4 categories.
${isLeadershipRole ? `* Suggested skill categories for this role: Strategic Leadership, Management, Operations, Technical Proficiency.` : `* Suggested skill categories for this role: Core Technical, Tools & Frameworks, Process & Methodology, Soft Skills.`}
* Keep skills short (1–3 words).

LAYOUT-SAFE CONTENT RULES (MANDATORY):
- SUMMARY: Impactful 3-4 line summary, highlighting key strategic impact and relevant expertise.
- SKILLS: Max 15–20 items total across categories.
- EXPERIENCE: Include ALL roles from the input. For the 3 most recent roles, provide at most 7 high-impact bullets. For all other roles, provide at most 3-4 bullets. Each bullet max 15 words. Focus on impact and relevant depth. Use quantifiable metrics (e.g., %) only when appropriate and realistic, avoiding an unnatural overload of numbers.
- CERTIFICATIONS: ONLY include certifications present in the input resume. Do NOT add any new ones.
- PROJECTS: Max 3 high-impact projects. Use the projects from the Master Resume as the source. You MUST include this section if projects are present in the input.
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
        parsed._engine = routedConfig.engine;

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
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
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
