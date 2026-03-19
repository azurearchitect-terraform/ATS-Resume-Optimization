import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface OptimizationResult {
  summary: string;
  skills: string[];
  experience: {
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  projects: {
    title: string;
    description: string;
  }[];
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  match_score: number;
  baseline_score: number;
  improvement_notes: string[];
  audience_alignment_notes: string;
}

export type EngineType = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'groq';

export interface EngineConfig {
  engine: EngineType;
  model: string;
  apiKey?: string;
}

export async function optimizeResume(
  resumeText: string,
  jobDescription: string,
  targetRole: string,
  mode: "conservative" | "balanced" | "aggressive",
  audience: string,
  config: EngineConfig = { engine: 'gemini', model: 'gemini-3.1-pro-preview' }
): Promise<OptimizationResult> {
  const prompt = `
You are an advanced ATS Resume Optimization Engine designed for professional resume rewriting and job alignment.

Your objective is to:
- Analyze a candidate's resume (16+ years of experience). Note: The resume might be provided as raw text or as a structured JSON object (Master Resume).
- Analyze a provided Job Description (JD)
- Optimize the resume to maximize ATS compatibility and recruiter impact.
- Tailor the tone, focus, and terminology specifically for the following target audience: ${audience}
- Maintain complete truthfulness (NO hallucination or fake experience).
- Ensure the final resume content is substantial enough to fill approximately 2 pages when rendered (approx. 800-1000 words).
- CRITICAL: YOU MUST INCLUDE EVERY SINGLE PROFESSIONAL EXPERIENCE ENTRY FROM THE INPUT DATA. DO NOT SKIP ANY ROLES, EVEN IF THEY ARE OLDER OR LESS RELEVANT. THE USER WANTS A COMPLETE CHRONOLOGICAL HISTORY.
- INCLUDE A PROJECTS SECTION: Based on the "strategic_initiatives" or "projects" in the input, optimize them to show high-level impact.
- DO NOT include any meta-headers or info-lines like "16+ YEARS EXPERIENCE" or "TARGET: ..." in the generated summary or any other field.

-----------------------------------
🔒 STRICT RULES (MANDATORY)
-----------------------------------
1. DO NOT add fake skills, projects, or experience.
2. DO NOT assume technologies not mentioned in the resume.
3. You MUST include ALL experience entries provided in the input. Skipping roles is a failure.
4. Use strong action verbs (Designed, Implemented, Optimized, Led, Automated, Architected).
5. Add measurable impact wherever possible (%, cost savings, performance, uptime).
6. Keep content professional, modern, and ATS-friendly.
7. Ensure the resume length is optimized for a 2-page layout.
8. Do NOT output anything outside the defined JSON format.

-----------------------------------
🎯 OPTIMIZATION MODE
-----------------------------------
Mode: ${mode}

Rules:
- conservative → minimal edits, preserve original structure
- balanced → improve clarity + keyword alignment
- aggressive → maximize ATS match, strong bullet rewriting, keyword-rich

-----------------------------------
👥 AUDIENCE & SENIORITY
-----------------------------------
The user has 16+ years of experience. The resume should be tailored to appeal to: ${audience}. 
- If "Microsoft" or "Enterprise" is selected, emphasize enterprise-scale impact, Azure architecture, hybrid cloud, governance, and strategic leadership.
- Demonstrate leadership, mentorship, and architectural decision-making. Focus on "The Why" and "The Result" rather than just "The Task".
- Use professional, high-impact language suitable for a Big Tech or Enterprise environment.

-----------------------------------
📥 INPUT
-----------------------------------
RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

TARGET ROLE:
${targetRole}

-----------------------------------
⚙️ PROCESSING STEPS (FOLLOW STRICTLY)
-----------------------------------
1. Extract key requirements and keywords from JD.
2. Identify gaps between resume and JD.
3. Calculate a BASELINE ATS score (0-100) for the original resume against this JD before optimization.
4. Optimize summary to align with JD and the specific audience: ${audience}.
5. Enhance skills section with proper grouping and ordering. Format as a list of 10-12 key technical skills.
6. Rewrite ALL experience bullets with action verbs and measurable outcomes.
7. Optimize the projects/strategic initiatives section.
8. Ensure ATS keyword density is improved naturally.
9. Calculate approximate optimized match score (0–100).
`;

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      let resultText = "";

      if (config.engine === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.GEMINI_API_KEY || "" });
        const response = await ai.models.generateContent({
          model: config.model,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                ats_keywords_from_jd: { type: Type.ARRAY, items: { type: Type.STRING } },
                ats_keywords_added_to_resume: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyword_gap: { type: Type.ARRAY, items: { type: Type.STRING } },
                match_score: { type: Type.NUMBER },
                baseline_score: { type: Type.NUMBER },
                improvement_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                audience_alignment_notes: { type: Type.STRING }
              },
              required: [
                "summary", "skills", "experience", "projects", "ats_keywords_from_jd", 
                "ats_keywords_added_to_resume", "keyword_gap", "match_score", 
                "baseline_score", "improvement_notes", "audience_alignment_notes"
              ]
            }
          }
        });
        resultText = response.text || "";
      } else if (config.engine === 'openai' || config.engine === 'deepseek' || config.engine === 'groq') {
        let baseURL = undefined;
        if (config.engine === 'deepseek') baseURL = "https://api.deepseek.com";
        if (config.engine === 'groq') baseURL = "https://api.groq.com/openai/v1";

        const openai = new OpenAI({ 
          apiKey: config.apiKey || "", 
          baseURL,
          dangerouslyAllowBrowser: true 
        });

        const response = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: "You are a professional resume optimization engine. Return ONLY valid JSON." },
            { role: "user", content: prompt + "\n\nReturn the result in the following JSON format: { summary: string, skills: string[], experience: { role: string, company: string, duration: string, bullets: string[] }[], projects: { title: string, description: string }[], ats_keywords_from_jd: string[], ats_keywords_added_to_resume: string[], keyword_gap: string[], match_score: number, baseline_score: number, improvement_notes: string[], audience_alignment_notes: string }" }
          ],
          response_format: (config.engine as string) === 'anthropic' ? undefined : { type: "json_object" }
        });
        resultText = response.choices[0].message.content || "";
      } else if (config.engine === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.apiKey || "", dangerouslyAllowBrowser: true });
        const response = await anthropic.messages.create({
          model: config.model,
          max_tokens: 8192,
          messages: [
            { role: "user", content: prompt + "\n\nReturn the result in the following JSON format: { summary: string, skills: string[], experience: { role: string, company: string, duration: string, bullets: string[] }[], projects: { title: string, description: string }[], ats_keywords_from_jd: string[], ats_keywords_added_to_resume: string[], keyword_gap: string[], match_score: number, baseline_score: number, improvement_notes: string[], audience_alignment_notes: string }" }
          ]
        });
        // Anthropic might return text with markdown blocks
        const text = (response.content[0] as any).text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        resultText = jsonMatch ? jsonMatch[0] : text;
      }

      if (!resultText) {
        throw new Error(`No response from ${config.engine}`);
      }

      return JSON.parse(resultText);
    } catch (error: any) {
      const errorString = error?.message || String(error);
      const isRateLimit = errorString.includes("429") || 
                         errorString.includes("RESOURCE_EXHAUSTED") ||
                         errorString.includes("quota") ||
                         errorString.includes("rate limit");
      
      if (isRateLimit && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
        console.warn(`Rate limit hit on ${config.engine}. Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(`Maximum retries exceeded for ${config.engine}. Please try again in a few minutes.`);
}
