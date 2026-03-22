import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface OptimizationResult {
  summary: string;
  skills: {
    infrastructure: string[];
    devsecops: string[];
    governance: string[];
    observability: string[];
  };
  experience: {
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  early_career: string[];
  certifications: string[];
  projects: string[];
  education: string[];
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  match_score: number;
  baseline_score: number;
  improvement_notes: string[];
  audience_alignment_notes: string;
}

export type EngineType = 'gemini' | 'openai' | 'anthropic';

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
ROLE:
You are an expert Executive Resume Strategist and Technical Recruiter specializing in the Azure Cloud ecosystem for the 2026 job market.

CRITICAL CONTEXT:
The output will be rendered inside a Canva-like resume editor using a fixed A4 layout (794x1123 px per page).
The system supports EXACTLY 2 pages maximum.
You must generate structured, layout-safe content that fits within these constraints.

IMPORTANT:
* Do NOT generate long paragraphs
* Do NOT include any formatting symbols, separators, or decorative elements
* Output must be clean, concise, and spacing-friendly
* The UI system will handle layout, alignment, and styling

TASK:
Analyze and rewrite the resume for the candidate based on the provided input.
Transform it into a high-impact, logically consistent, and ATS-optimized executive-level resume tailored for Azure Cloud roles.

CRITICAL ISSUES TO RESOLVE:
1. EXPERIENCE GAP RESOLUTION:
* The candidate claims 16+ years of experience but recent roles start later.
* Create a section: "Selected Early Career"
* Summarize earlier experience in 2–3 concise bullet points.
* Do NOT expand into full roles. Keep it compact.

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

LAYOUT-SAFE CONTENT RULES (MANDATORY):
- SUMMARY: Max 60 words, leadership-focused.
- SKILLS: Max 12–15 items total across categories.
- EXPERIENCE: Max 5 roles. Each role: Max 4 bullets, each bullet max 12 words. Focus on impact.
- SELECTED EARLY CAREER: 2–3 bullets only.
- CERTIFICATIONS: Max 4 items.
- PROJECTS: Max 2 (optional, concise).
- EDUCATION: Properly reframed.

INPUT:
RESUME: ${resumeText}
JOB DESCRIPTION: ${jobDescription}
TARGET ROLE: ${targetRole}
OPTIMIZATION MODE: ${mode}
TARGET AUDIENCE: ${audience}

-----------------------------------
⚙️ PROCESSING STEPS
-----------------------------------
1. Extract key requirements and keywords from JD.
2. Identify gaps between resume and JD.
3. Calculate a BASELINE ATS score (0-100).
4. Optimize all sections following the STRICT RULES above.
5. Ensure ATS keyword density is improved naturally.
6. Calculate approximate optimized match score (0–100).
`;

  const maxRetries = 5;
  let retryCount = 0;
  let currentModel = config.model;

  while (retryCount <= maxRetries) {
    try {
      let resultText = "";

      if (config.engine === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.GEMINI_API_KEY || "" });
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                skills: {
                  type: Type.OBJECT,
                  properties: {
                    infrastructure: { type: Type.ARRAY, items: { type: Type.STRING } },
                    devsecops: { type: Type.ARRAY, items: { type: Type.STRING } },
                    governance: { type: Type.ARRAY, items: { type: Type.STRING } },
                    observability: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["infrastructure", "devsecops", "governance", "observability"]
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
                early_career: { type: Type.ARRAY, items: { type: Type.STRING } },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } },
                education: { type: Type.ARRAY, items: { type: Type.STRING } },
                ats_keywords_from_jd: { type: Type.ARRAY, items: { type: Type.STRING } },
                ats_keywords_added_to_resume: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyword_gap: { type: Type.ARRAY, items: { type: Type.STRING } },
                match_score: { type: Type.NUMBER },
                baseline_score: { type: Type.NUMBER },
                improvement_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                audience_alignment_notes: { type: Type.STRING }
              },
              required: [
                "summary", "skills", "experience", "early_career", "certifications", "projects", "education",
                "ats_keywords_from_jd", "ats_keywords_added_to_resume", "keyword_gap", 
                "match_score", "baseline_score", "improvement_notes", "audience_alignment_notes"
              ]
            }
          }
        });
        resultText = response.text || "";
      } else if (config.engine === 'openai') {
        const openai = new OpenAI({ apiKey: config.apiKey || "", dangerouslyAllowBrowser: true });
        const response = await openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: "system", content: "You are a professional resume optimization engine. Return ONLY valid JSON." },
            { role: "user", content: prompt + "\n\nReturn the result in the following JSON format: { summary: string, skills: string[], experience: { role: string, company: string, duration: string, bullets: string[] }[], projects: { title: string, description: string }[], education: { degree: string, institution: string, expected_completion: string }[], certifications: string[], ats_keywords_from_jd: string[], ats_keywords_added_to_resume: string[], keyword_gap: string[], match_score: number, baseline_score: number, improvement_notes: string[], audience_alignment_notes: string }" }
          ],
          response_format: { type: "json_object" }
        });
        resultText = response.choices[0].message.content || "";
      } else if (config.engine === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.apiKey || "", dangerouslyAllowBrowser: true });
        const response = await anthropic.messages.create({
          model: config.model,
          max_tokens: 8192,
          messages: [
            { role: "user", content: prompt + "\n\nReturn the result in the following JSON format: { summary: string, skills: string[], experience: { role: string, company: string, duration: string, bullets: string[] }[], projects: { title: string, description: string }[], education: { degree: string, institution: string, expected_completion: string }[], certifications: string[], ats_keywords_from_jd: string[], ats_keywords_added_to_resume: string[], keyword_gap: string[], match_score: number, baseline_score: number, improvement_notes: string[], audience_alignment_notes: string }" }
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
        
        // Fallback to Flash if Pro fails with rate limit
        if (config.engine === 'gemini' && currentModel.includes('pro')) {
          console.warn(`Rate limit hit on Gemini Pro. Falling back to Gemini Flash for retry ${retryCount}...`);
          currentModel = 'gemini-3-flash-preview';
        }

        const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
        console.warn(`Rate limit hit on ${config.engine}. Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(`Maximum retries exceeded for ${config.engine}. Please try again in a few minutes.`);
}
