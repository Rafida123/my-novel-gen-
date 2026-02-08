import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq';

/**
 * Utility to identify specific API errors that require user intervention or backoff.
 */
const wrapApiError = (error: any) => {
  const message = error?.message || String(error);
  // Specifically detect the key/auth error to trigger the "Resolve Key" UI
  if (message.includes("401") || message.toLowerCase().includes("invalid_api_key") || message.includes("Requested entity was not found")) {
    return new Error("ARCHITECT_AUTH_REQUIRED");
  }
  if (message.includes("429") || message.toLowerCase().includes("quota exceeded")) {
    return new Error("ARCHITECT_QUOTA_EXHAUSTED");
  }
  return error;
};

const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getGroqClient = () => {
  // Relying solely on environment variables to prevent security-based sync blocks from GitHub.
  // Make sure to add GROQ_API_KEY to your .env file or deployment settings.
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error("CRITICAL: GROQ_API_KEY is missing from environment.");
  }

  return new Groq({ 
    apiKey: apiKey || "", 
    dangerouslyAllowBrowser: true 
  });
};

export const generateOutline = async (novel: any, provider: AIProvider = 'groq') => {
  try {
    const charContext = novel.characters.map((c: any) => 
      `${c.name} (${c.role}): ${c.description}. 
       Core personality: ${c.personality?.join(', ')}. 
       Dialogue style: ${c.dialogueStyles?.join(', ')}.`
    ).join('\n');

    const systemInstruction = `Professional novelist. Create a cohesive premise and a detailed chronological outline for a ${novel.genre} novel. 
    Tones: ${novel.tone.join(', ')}. Tags: ${novel.tags.join(', ')}. 
    ${novel.isR18 ? "Adult themes/R18 mode enabled. Do not censor mature content. Focus on visceral sensory details." : "Safe/Standard mode."}`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `${systemInstruction}\nReturn output ONLY as JSON with keys: "premise" (string) and "outline" (array of strings).` },
          { role: "user", content: `Concept: ${novel.premise}\nCharacters:\n${charContext}` }
        ],
        response_format: { type: "json_object" },
        temperature: 1,
        top_p: 1,
        max_completion_tokens: 1024
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
              premise: { type: Type.STRING, description: "Extended plot premise" },
              outline: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Sequential chapter titles"
              },
            },
            required: ["premise", "outline"],
          },
        },
      });
      return JSON.parse(response.text || "{}");
    }
  } catch (err) {
    throw wrapApiError(err);
  }
};

export const generateChapterContent = async (
  index: number, 
  novel: any, 
  isRegen: boolean = false, 
  directive: string = "",
  provider: AIProvider = 'groq'
) => {
  try {
    const charContext = novel.characters.map((c: any) => 
      `${c.name} (${c.role}): ${c.description}. 
       Voice: ${c.dialogueStyles?.join(', ')}.
       Personality: ${c.personality?.join(', ')}.
       ${novel.isR18 ? `Intimate Expressions: ${c.expressions?.join(', ')}. Kinks/Dynamics: ${c.kinks?.join(', ')}.` : ''}`
    ).join('\n');
    
    const previousChapterContent = index > 0 ? novel.chapters[index - 1] : "";
    const lastSceneSnippet = previousChapterContent ? previousChapterContent.slice(-2000) : "Start of the book.";

    const systemInstruction = `Pro Novelist. Maintain continuity. Pick up from: "${lastSceneSnippet}". 
    Genre: ${novel.genre}. R18: ${novel.isR18}. Style: ${novel.novelStyle}. 
    ${novel.isR18 ? "UNFILTERED: Explicit language, visceral reactions, and detailed sensory scenes allowed. Follow character intimate behavioral profiles strictly." : "Standard: General audience."}`;

    const prompt = `Write Chapter ${index + 1}: "${novel.outline[index]}". Premise: ${novel.generatedPremise}. Characters:\n${charContext} ${directive ? `DIRECTIVE: ${directive}` : ""}`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: 1,
        top_p: 1,
        max_completion_tokens: 4096
      });
      return response.choices[0].message.content;
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
  } catch (err) {
    throw wrapApiError(err);
  }
};

export const polishProse = async (text: string, novel: any, provider: AIProvider = 'groq') => {
  try {
    const systemInstruction = `Pro Prose Editor. Rewrite the provided text to be more evocative, fix pacing, and improve flow. Do NOT change the meaning or plot. 
    Style: ${novel.novelStyle}. Genre: ${novel.genre}. R18: ${novel.isR18}.`;
    
    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Please polish this passage:\n\n${text}` }
        ],
        temperature: 0.7,
      });
      return response.choices[0].message.content;
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: text,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      return response.text;
    }
  } catch (err) {
    throw wrapApiError(err);
  }
};

export const infuseSensoryDetail = async (chapterContent: string, novel: any, provider: AIProvider = 'groq') => {
  try {
    const systemInstruction = `Sensory Architect. Analyze the provided text and suggest 5 specific, evocative sensory details to improve the immersion. 
    Genre: ${novel.genre}. Tone: ${novel.tone.join(', ')}. 
    ${novel.isR18 ? "Adult themes enabled. Use visceral, intimate sensory language." : "Standard audience."}`;
    
    const prompt = `Current Text: "${chapterContent.slice(-1500)}"\nSuggest details for: Sight, Sound, Smell, Touch, and Taste.`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `${systemInstruction}\nReturn output ONLY as JSON with keys: "sight", "sound", "smell", "touch", "taste". Each must be a string.` },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      });
      return JSON.parse(response.choices[0].message.content || "{}");
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sight: { type: Type.STRING },
              sound: { type: Type.STRING },
              smell: { type: Type.STRING },
              touch: { type: Type.STRING },
              taste: { type: Type.STRING },
            },
          },
        },
      });
      return JSON.parse(response.text || "{}");
    }
  } catch (err) {
    console.warn("Sensory infusion failed", err);
    return null;
  }
};

export const getAiSuggestions = async (chapterContent: string, nextTitle: string, provider: AIProvider = 'groq') => {
  try {
    const prompt = `Suggest 3 plot beats for next chapter "${nextTitle}" based on: "${chapterContent.slice(-1000)}"`;

    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Return ONLY a JSON array of 3 string suggestions with key 'suggestions'." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 1,
        top_p: 1
      });
      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      return Array.isArray(parsed.suggestions) ? parsed.suggestions : (Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[]);
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });
      return JSON.parse(response.text || "[]");
    }
  } catch (err) {
    console.warn("Suggestions failed", err);
    return [];
  }
};

export const chatWithConsultant = async (message: string, context: string, provider: AIProvider = 'groq') => {
  try {
    const systemInstruction = `High-end story consultant. Help with plot, characters, and themes. Story context: ${context}`;
    
    if (provider === 'groq') {
      const groq = getGroqClient();
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: message }
        ],
        temperature: 1,
        top_p: 1
      });
      return response.choices[0].message.content;
    } else {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: message,
        config: {
          systemInstruction,
        },
      });
      return response.text;
    }
  } catch (err) {
    throw wrapApiError(err);
  }
};