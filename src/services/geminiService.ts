import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { routeTask, RouterConfig } from "./aiRouter";

export interface OptimizationResult {
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
  apiKey?: string;
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
    if (routedConfig.engine === 'openai') {
      const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API Key is missing.");
      }
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: routedConfig.model,
        messages: [
          { role: "system", content: "You are a professional job description extractor." },
          { role: "user", content: prompt }
        ]
      });
      return response.choices[0].message.content || "";
    } else {
      const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
      const response = await ai.models.generateContent({
        model: routedConfig.model,
        contents: prompt,
        config: {
          tools: [{ urlContext: {} }],
        }
      });
      return response.text || "";
    }
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
${recruiterSimulationMode ? '5. Provide specific rejection reasons if the resume does not meet the JD requirements.' : ''}

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
* TARGET: Achieve at least an 80% optimization score by maximizing keyword alignment and impact metrics.
* Ensure every bullet point starts with a strong action verb and includes a measurable result if possible.

CRITICAL ISSUES TO RESOLVE:
1. FULL CAREER HISTORY:
* Include ALL roles from the input resume in the experience section.
* Do NOT summarize older roles into a separate section.
* Every role must have at least 3 high-impact bullet points.
* Include quantifiable metrics (e.g., %, $, time saved) naturally where they make sense, but do not force them into every bullet to keep it looking normal.

2. EDUCATION PARADOX:
* The candidate is completing BCA in 2027 despite senior experience.
* Reframe as: "Continuing Education" or "Degree in Progress".
* Maintain credibility and professionalism.

3. TITLE ALIGNMENT:
* Avoid over-titling. Align titles realistically with responsibilities.
* Maintain senior tone without exaggeration.

4. VISUAL STRUCTURE FOR UI:
* Do NOT include lines, separators, or styling text.
* Skills must be grouped logically for grid display: Infrastructure, DevSecOps, Governance, Observability.
* Keep skills short (1–3 words).

5. SPECIFIC USER CONSTRAINTS:
* The candidate has very little to no experience with CI/CD, Terraform, and DevOps.
* Do NOT focus heavily on these areas. Only include basic knowledge if absolutely necessary, but do not exaggerate or invent experience in these domains.

LAYOUT-SAFE CONTENT RULES (MANDATORY):
- SUMMARY: Minimum 4-5 strong lines, leadership-focused.
- SKILLS: Max 12–15 items total across categories.
- EXPERIENCE: Include ALL roles from the input. For the first role, provide at least 7 bullets. For the second, at least 6. For the third and fourth, at least 5. For all other roles, provide at least 3 bullets. Each bullet max 12 words. Focus on impact. Use quantifiable metrics (e.g., %) only when appropriate and realistic, avoiding an unnatural overload of numbers.
- CERTIFICATIONS: Max 4 items.
- PROJECTS: Max 2 high-impact technical projects. Use the projects from the Master Resume as the source. For each project, generate a concise and impactful 1-2 sentence description if the input is brief or missing. Focus on quantifiable achievements (e.g., "Reduced latency by 40%") and technical details (e.g., "using Azure Kubernetes Service and Terraform") relevant to a Cloud & Collaboration Engineer role. Provide a title and the description.
- EDUCATION: Properly reframed.

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
${recruiterSimulationMode ? '7. Provide specific rejection reasons if the resume does not meet the JD requirements.' : ''}
`;

  const maxRetries = 5;
  let retryCount = 0;
  let currentModel = modelToUse;

  while (retryCount <= maxRetries) {
    try {
      let resultText = "";

      if (routedConfig.engine === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
        const tools = [];
        if (jobUrl || linkedInUrl) {
          tools.push({ urlContext: {} });
        }

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            maxOutputTokens: 8192,
            tools: tools.length > 0 ? tools : undefined,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                skills: {
                  type: Type.OBJECT,
                  properties: {
                    Infrastructure: { type: Type.ARRAY, items: { type: Type.STRING } },
                    DevSecOps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    Governance: { type: Type.ARRAY, items: { type: Type.STRING } },
                    Observability: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["Infrastructure", "DevSecOps", "Governance", "Observability"]
                },
                experience: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      role: { type: Type.STRING },
                      company: { type: Type.STRING },
                      duration: { type: Type.STRING },
                      bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["role", "company", "bullets"]
                  }
                },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["title", "description"]
                  }
                },
                education: { type: Type.ARRAY, items: { type: Type.STRING } },
                ats_keywords_from_jd: { type: Type.ARRAY, items: { type: Type.STRING } },
                ats_keywords_added_to_resume: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyword_gap: { type: Type.ARRAY, items: { type: Type.STRING } },
                match_score: { type: Type.NUMBER },
                baseline_score: { type: Type.NUMBER },
                improvement_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                audience_alignment_notes: { type: Type.STRING },
                rejection_reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: [
                "summary", "skills", "experience", "certifications", "projects", "education",
                "ats_keywords_from_jd", "ats_keywords_added_to_resume", "keyword_gap", 
                "match_score", "baseline_score", "improvement_notes", "audience_alignment_notes"
              ]
            }
          }
        });
        
        resultText = extractJson(response.text || "");
        const usage = response.usageMetadata;
        
        if (!resultText) {
          console.error("Empty response from Gemini");
          throw new Error("The AI returned an empty response. Please try again.");
        }

        try {
          const parsed = JSON.parse(resultText);
          if (usage) {
            parsed._usage = {
              promptTokenCount: usage.promptTokenCount || 0,
              candidatesTokenCount: usage.candidatesTokenCount || 0,
              totalTokenCount: usage.totalTokenCount || 0
            };
          }
          return parsed;
        } catch (e) {
          console.error("Error parsing Gemini response:", e, "Raw text:", resultText);
          throw new Error("JSON_PARSING_ERROR: The AI returned an invalid response format.");
        }
      } else if (routedConfig.engine === 'openai') {
        const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error("OpenAI API Key is missing. Please provide it in the settings or as an environment variable (OPENAI_API_KEY).");
        }
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const response = await openai.chat.completions.create({
          model: currentModel,
          messages: [
            { role: "system", content: "You are a professional resume optimization engine. Return ONLY valid JSON." },
            { role: "user", content: prompt + "\n\nReturn the result in the following JSON format: { summary: string, skills: { Infrastructure: string[], DevSecOps: string[], Governance: string[], Observability: string[] }, experience: { role: string, company: string, duration: string, bullets: string[] }[], projects: { title: string, description: string }[], education: string[], certifications: string[], ats_keywords_from_jd: string[], ats_keywords_added_to_resume: string[], keyword_gap: string[], match_score: number, baseline_score: number, improvement_notes: string[], audience_alignment_notes: string, rejection_reasons: string[] }" }
          ],
          response_format: { type: "json_object" }
        });
        resultText = extractJson(response.choices[0].message.content || "");
      }

      if (!resultText) {
        throw new Error(`No response from ${routedConfig.engine}`);
      }

      try {
        return JSON.parse(resultText);
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
        console.warn(`Error hit on ${routedConfig.engine} (${isRateLimit ? 'Rate Limit' : 'JSON Error'}). Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount}/${maxRetries})`);
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

  if (routedConfig.engine === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
    const tools = [];
    if (jobDescription.startsWith('http') || resumeText.startsWith('http')) {
      tools.push({ urlContext: {} });
    }

    const response = await ai.models.generateContent({
      model: routedConfig.model,
      contents: prompt,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            missing: { type: Type.ARRAY, items: { type: Type.STRING } },
            present: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["missing", "present"]
        }
      }
    });
    const resultText = extractJson(response.text || "");
    return JSON.parse(resultText || '{"missing":[], "present":[]}');
  } else if (routedConfig.engine === 'openai') {
    const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API Key is missing. Please provide it in the settings or as an environment variable (OPENAI_API_KEY).");
    }
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.chat.completions.create({
      model: routedConfig.model,
      messages: [
        { role: "system", content: "You are a professional resume analyzer. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    const resultText = extractJson(response.choices[0].message.content || "");
    return JSON.parse(resultText || '{"missing":[], "present":[]}');
  }
  
  throw new Error(`Unsupported engine: ${routedConfig.engine}`);
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

  if (routedConfig.engine === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
    const tools = [];
    if (jobDescription.startsWith('http')) {
      tools.push({ urlContext: {} });
    }

    const response = await ai.models.generateContent({
      model: routedConfig.model,
      contents: prompt,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        responseMimeType: "application/json",
      }
    });
    try {
      const text = extractJson(response.text || "");
      if (!text) return ['microsoft'];
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : (parsed.audiences || ['microsoft']);
    } catch (e) {
      console.error('Error parsing audiences from Gemini:', e);
      return ['microsoft'];
    }
  } else if (routedConfig.engine === 'openai') {
    const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return ['microsoft'];
    
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.chat.completions.create({
      model: routedConfig.model,
      messages: [
        { role: "system", content: "You are a professional resume analyzer. Return ONLY valid JSON array of audience IDs." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    try {
      const content = extractJson(response.choices[0].message.content || "");
      if (!content) return ['microsoft'];
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : (parsed.audiences || ['microsoft']);
    } catch (e) {
      console.error('Error parsing audiences from OpenAI:', e);
      return ['microsoft'];
    }
  }
  
  return ['microsoft'];
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

  if (routedConfig.engine === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
    const tools = [];
    if (jobDescription.startsWith('http') || resumeText.startsWith('http')) {
      tools.push({ urlContext: {} });
    }

    const response = await ai.models.generateContent({
      model: routedConfig.model,
      contents: prompt,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const resultText = extractJson(response.text || "");
    return JSON.parse(resultText || '[]');
  } else if (routedConfig.engine === 'openai') {
    const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API Key is missing. Please provide it in the settings or as an environment variable (OPENAI_API_KEY).");
    }
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.chat.completions.create({
      model: routedConfig.model,
      messages: [
        { role: "system", content: "You are a professional interview coach. Return ONLY valid JSON array of strings." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    const resultText = extractJson(response.choices[0].message.content || "");
    const parsed = JSON.parse(resultText || '{}');
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
  }

  throw new Error(`Unsupported engine: ${routedConfig.engine}`);
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

  if (routedConfig.engine === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: routedConfig.apiKey || process.env.GEMINI_API_KEY || "" });
    const tools = [];
    if (jobDescription.startsWith('http') || resumeText.startsWith('http')) {
      tools.push({ urlContext: {} });
    }

    const response = await ai.models.generateContent({
      model: routedConfig.model,
      contents: prompt,
      config: {
        tools: tools.length > 0 ? tools : undefined,
      }
    });
    return response.text || "";
  } else if (routedConfig.engine === 'openai') {
    const apiKey = routedConfig.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API Key is missing. Please provide it in the settings or as an environment variable (OPENAI_API_KEY).");
    }
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.chat.completions.create({
      model: routedConfig.model,
      messages: [
        { role: "system", content: "You are a professional career coach." },
        { role: "user", content: prompt }
      ]
    });
    return response.choices[0].message.content || "";
  }

  throw new Error(`Unsupported engine: ${routedConfig.engine}`);
}
