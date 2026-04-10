import { GoogleGenAI } from "@google/genai";
import { optimizeResume } from "./geminiService";

export const optimizeFullResume = async (
  resumeData: any,
  jobDescription: string,
  targetRole: string,
  aiEngine: string = "gemini-3-flash-preview",
  audience: string = "Enterprise"
) => {
  try {
    const result = await optimizeResume(
      JSON.stringify(resumeData),
      jobDescription,
      targetRole,
      "balanced",
      audience,
      { 
        mode: 'gemini',
        geminiConfig: {
          engine: 'gemini',
          model: aiEngine,
          apiKey: process.env.GEMINI_API_KEY
        },
        openaiConfig: {
          engine: 'openai',
          model: 'gpt-4o-mini',
          apiKey: process.env.OPENAI_API_KEY
        }
      }
    );

    return result;
  } catch (error) {
    console.error("Full Optimization Error:", error);
    throw error;
  }
};

export const improveTextWithAI = async (
  text: string, 
  context?: { jobDescription?: string; targetRole?: string; aiEngine?: string }
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const modelName = context?.aiEngine || "gemini-3-flash-preview";
    
    const prompt = `
      You are a senior ATS resume strategist.
      
      Tasks:
      1. Rewrite the resume tailored to the job description
      2. Improve keyword alignment
      3. Keep it concise and professional
      4. Maintain bullet formatting
      5. Ensure it fits within 1–2 pages
      6. TITLE PRESERVATION (CRITICAL): STRICTLY preserve ALL exact role titles and job titles exactly as they appear in the original text. Do NOT change, rephrase, correct, or "fix" them (e.g., do not change "Officer IT cum Logistics" to "Office IT cum Logistics"), even if they seem like typos. This is a non-negotiable requirement.
      
      Output:
      - Clean structured resume
      - No explanations
      
      Original Text:
      "${text}"
      
      ${context?.targetRole ? `Target Role: ${context.targetRole}` : ''}
      ${context?.jobDescription ? `Job Description: ${context.jobDescription}` : ''}
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
    });

    const result = response.text?.trim() || text;
    return result.replace(/Office IT [Cc]um Logistics/g, 'Officer IT cum Logistics');
  } catch (error) {
    console.error("AI Improvement Error:", error);
    return text;
  }
};

export const rewriteSectionWithAI = async (
  sectionType: string, 
  content: any, 
  context?: { jobDescription?: string; targetRole?: string; aiEngine?: string }
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const modelName = context?.aiEngine || "gemini-3-flash-preview";

    const prompt = `
      You are a senior ATS resume strategist.
      
      Tasks:
      1. Rewrite the resume tailored to the job description
      2. Improve keyword alignment
      3. Keep it concise and professional
      4. Maintain bullet formatting
      5. Ensure it fits within 1–2 pages
      6. TITLE PRESERVATION (CRITICAL): STRICTLY preserve ALL exact role titles and job titles exactly as they appear in the original text. Do NOT change, rephrase, correct, or "fix" them (e.g., do not change "Officer IT cum Logistics" to "Office IT cum Logistics"), even if they seem like typos. This is a non-negotiable requirement.
      
      Output:
      - Clean structured resume
      - No explanations
      
      Section Type: ${sectionType}
      ${context?.targetRole ? `Target Role: ${context.targetRole}` : ''}
      ${context?.jobDescription ? `Job Description: ${context.jobDescription}` : ''}
      
      Current Content:
      ${JSON.stringify(content, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = response.text?.trim();
    if (!result) return content;

    const parsed = JSON.parse(result);

    // FAIL-SAFE: Ensure "Officer IT cum Logistics" is preserved
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
  } catch (error) {
    console.error("AI Section Rewrite Error:", error);
    return content;
  }
};
