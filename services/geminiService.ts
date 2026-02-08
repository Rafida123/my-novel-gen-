
import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleApiError = (error: any) => {
  const errorMessage = error?.message || String(error);
  console.error("API Error context:", error);
  
  // Handle Invalid API Key or Not Found (often key/project related)
  if (errorMessage.includes("invalid_api_key") || 
      errorMessage.includes("401") || 
      errorMessage.includes("Requested entity was not found")) {
    return new Error("API_KEY_INVALID");
  }
  
  // Handle Rate Limits
  if (errorMessage.includes("429") || errorMessage.includes("quota")) {
    return new Error("QUOTA_EXHAUSTED");
  }

  return error;
};

// Always create a fresh instance to ensure the latest API key from process.env is used
const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getGroqClient = () => {
  return new Groq({ apiKey: process.env.API_KEY, dangerouslyAllowBrowser: true });
};

export const generateOutline = async (novel: any, provider: AIProvider = 'gemini', retryCount = 0): Promise<any> => {
  try {
    const charContext = novel.characters.map((c: any) => 
      `${c.name} (${c.role}): ${c.description}. 
       Personality: ${c.personality?.join(', ')}. 
       Dialogue: ${c.dialogueStyles?.join(', ')}.`
    ).join('\n');

    const systemInstruction = `Professional novelist. Create a cohesive premise and a comprehensive chronological outline for a ${novel.genre} novel. 
    Tones: ${novel.tone.join(', ')}. Tags: ${novel.tags.join(', ')}. 
    ${novel.isR18 ? "R18 mode enabled: Explicit adult themes allowed." : "Standard mode."}
    Suggest an appropriate number of chapters to cover the full story arc.`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `${systemInstruction}\nReturn output ONLY as JSON with keys: "premise" (string) and "outline" (array of strings).` },
          { role: "user", content: `Concept: ${novel.premise}\nCharacters:\n${charContext}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });
      return JSON.parse(response.choices[0].message.content || "{}");
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Concept: ${novel.premise}\nCharacters:\n${charContext}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              premise: { type: Type.STRING },
              outline: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["premise", "outline"],
          },
        },
      });
      return JSON.parse(response.text || "{}");
    }
  } catch (error: any) {
    if ((error.message?.includes("429") || error.status === 429) && retryCount < 3) {
      await delay(Math.pow(2, retryCount) * 1000);
      return generateOutline(novel, provider, retryCount + 1);
    }
    throw handleApiError(error);
  }
};

export const generateChapterContent = async (
  index: number, 
  novel: any, 
  isRegen: boolean = false, 
  directive: string = "",
  provider: AIProvider = 'gemini',
  retryCount = 0
): Promise<string | undefined> => {
  try {
    const charContext = novel.characters.map((c: any) => 
      `${c.name} (${c.role}): ${c.description}. Voice: ${c.dialogueStyles?.join(', ')}.`
    ).join('\n');
    
    const previousChapterContent = index > 0 ? novel.chapters[index - 1] : "";
    const lastSceneSnippet = previousChapterContent ? previousChapterContent.slice(-2000) : "Start of the book.";

    const systemInstruction = `Pro Novelist. Picking up EXACTLY from: "${lastSceneSnippet}". 
    Genre: ${novel.genre}. R18: ${novel.isR18}. Style: ${novel.novelStyle}.`;

    const prompt = `Write Chapter ${index + 1}: "${novel.outline[index]}". Premise: ${novel.generatedPremise}. Characters:\n${charContext} ${directive ? `DIRECTIVE: ${directive}` : ""}`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
      });
      return response.choices[0].message.content || "";
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.8,
        },
      });
      return response.text;
    }
  } catch (error: any) {
    if ((error.message?.includes("429") || error.status === 429) && retryCount < 3) {
      await delay(Math.pow(2, retryCount) * 1000);
      return generateChapterContent(index, novel, isRegen, directive, provider, retryCount + 1);
    }
    throw handleApiError(error);
  }
};

export const getAiSuggestions = async (chapterContent: string, nextTitle: string, provider: AIProvider = 'gemini', retryCount = 0): Promise<string[]> => {
  try {
    const prompt = `Suggest 3 plot beats for "${nextTitle}" based on: "${chapterContent.slice(-1000)}"`;
    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Return ONLY a JSON array of 3 string suggestions." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      const parsed = JSON.parse(response.choices[0].message.content || "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : (Object.values(parsed)[0] as string[]);
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      });
      return JSON.parse(response.text || "[]");
    }
  } catch {
    return [];
  }
};

export const chatWithConsultant = async (message: string, context: string, provider: AIProvider = 'gemini', retryCount = 0): Promise<string> => {
  try {
    const systemInstruction = `Story consultant. Context: ${context}`;
    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [ { role: "system", content: systemInstruction }, { role: "user", content: message } ],
      });
      return response.choices[0].message.content || "";
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: message,
        config: { systemInstruction },
      });
      return response.text || "";
    }
  } catch (error: any) {
    throw handleApiError(error);
  }
};
