import { GoogleGenAI } from "@google/genai";
import { optimizeResume } from "./geminiService";

export const optimizeFullResume = async (
  masterResume: any,
  jobDescription: string,
  targetRole: string,
  aiEngine: string = "gemini-3.1-pro-preview",
  audience: string = "Enterprise"
) => {
  try {
    const result = await optimizeResume(
      JSON.stringify(masterResume),
      jobDescription,
      targetRole,
      "balanced",
      audience,
      { engine: 'gemini', model: aiEngine }
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
      You are an expert resume writer. Improve the following resume text to be more impactful, professional, and aligned with industry standards.
      
      ${context?.targetRole ? `Target Role: ${context.targetRole}` : ''}
      ${context?.jobDescription ? `Job Description: ${context.jobDescription}` : ''}
      
      Original Text:
      "${text}"
      
      Requirements:
      - Use strong action verbs.
      - Quantify achievements if possible.
      - Keep it concise and professional.
      - Return ONLY the improved text, no explanations.
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text?.trim() || text;
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
      You are an expert resume writer. Rewrite the following resume section to be more impactful.
      
      Section Type: ${sectionType}
      ${context?.targetRole ? `Target Role: ${context.targetRole}` : ''}
      ${context?.jobDescription ? `Job Description: ${context.jobDescription}` : ''}
      
      Current Content:
      ${JSON.stringify(content, null, 2)}
      
      Requirements:
      - Improve the wording and professional tone.
      - Align with the target role and job description if provided.
      - Return ONLY the improved content as a valid JSON object matching the input structure.
      - No explanations, just the JSON.
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = response.text?.trim();
    return result ? JSON.parse(result) : content;
  } catch (error) {
    console.error("AI Section Rewrite Error:", error);
    return content;
  }
};
