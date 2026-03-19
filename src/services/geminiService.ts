import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface OptimizationResult {
  summary: string;
  skills: string[];
  experience: {
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  match_score: number;
  improvement_notes: string[];
  audience_alignment_notes: string;
}

export async function optimizeResume(
  resumeText: string,
  jobDescription: string,
  targetRole: string,
  mode: "conservative" | "balanced" | "aggressive",
  audience: string
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
3. Optimize summary to align with JD and the specific audience: ${audience}.
4. Enhance skills section with proper grouping and ordering. Format as a list of 10-12 key technical skills.
5. Rewrite ALL experience bullets with action verbs and measurable outcomes.
6. Ensure ATS keyword density is improved naturally.
7. Calculate approximate match score (0–100).
`;

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              experience: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    role: { type: Type.STRING },
                    company: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    bullets: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["role", "company", "bullets"]
                }
              },
              ats_keywords_from_jd: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              ats_keywords_added_to_resume: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              keyword_gap: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              match_score: { type: Type.NUMBER },
              improvement_notes: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              audience_alignment_notes: { type: Type.STRING }
            },
            required: [
              "summary",
              "skills",
              "experience",
              "ats_keywords_from_jd",
              "ats_keywords_added_to_resume",
              "keyword_gap",
              "match_score",
              "improvement_notes",
              "audience_alignment_notes"
            ]
          }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(response.text);
    } catch (error: any) {
      const isRateLimit = error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED");
      
      if (isRateLimit && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error("Maximum retries exceeded");
}
