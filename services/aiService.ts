import { GoogleGenAI, Type } from "@google/genai";
import { Groq } from "groq-sdk";

export type AIProviderType = 'gemini' | 'groq';

/**
 * Interface defining the expected behavior for any AI model adapter.
 */
export interface AIProvider {
  type: AIProviderType;
  generateOutline(novel: any): Promise<any>;
  generateDraftChapter(index: number, novel: any, directive: string, memory: any): Promise<string>;
  generateStoryMemory(text: string): Promise<any>;
  consultArchitect(message: string, context: string): Promise<{ text: string; links: any[] }>;
}

/**
 * Helper to get API keys.
 * Prioritizes:
 * 1. Environment Variable (Vite/Platform injected)
 * 2. LocalStorage (User entered in UI)
 */
export const getApiKeyForProvider = (type: AIProviderType): string => {
  if (type === 'groq') {
    const envKey = process.env.GROQ_API_KEY;
    if (envKey && envKey !== 'undefined' && envKey.length > 10) return envKey;

    if (typeof localStorage !== 'undefined') {
      const localKey = localStorage.getItem('GROQ_API_KEY');
      if (localKey) return localKey;
    }
    return '';
  }
  
  // Gemini key is strictly injected via process.env.API_KEY in the execution environment
  return process.env.API_KEY || '';
};

/**
 * Gemini-specific Adapter implementation.
 */
class GeminiAdapter implements AIProvider {
  readonly type = 'gemini';

  private getClient() {
    const key = getApiKeyForProvider('gemini');
    if (!key) throw new Error("GEMINI_API_KEY_MISSING");
    return new GoogleGenAI({ apiKey: key });
  }

  async generateOutline(novel: any) {
    const ai = this.getClient();
    const prompt = `Act as a Master Story Architect. Generate a professional blurb and a 12-20 chapter outline.
Title: ${novel.title}
Genre: ${novel.genre}
Context: ${novel.premise}
${novel.isR18 ? "R18 Protocol: Explicit themes allowed." : "Standard Protocol."}
JSON Output: { "premise": "blurb text", "outline": ["Chapter 1: ..."] }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: { 
          type: Type.OBJECT, 
          properties: { 
            premise: { type: Type.STRING }, 
            outline: { type: Type.ARRAY, items: { type: Type.STRING } } 
          },
          required: ["premise", "outline"]
        } 
      }
    });
    return JSON.parse(response.text);
  }

  async generateDraftChapter(index: number, novel: any, directive: string, memory: any) {
    const ai = this.getClient();
    const chars = novel.characters.map((c: any) => `- ${c.name}: ${c.description}`).join("\n");
    const storyMemory = memory ? `Continuity Points (Previous Events): ${JSON.stringify(memory)}` : "";
    
    const prompt = `Write Chapter ${index + 1}: ${novel.outline[index]} for "${novel.title}".
Characters:
${chars}
${storyMemory}
Style: ${novel.novelStyle}
Genre: ${novel.genre}
Directive: ${directive}
Draft professional novel prose. Return ONLY the chapter text.`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-pro-preview', 
      contents: prompt, 
      config: { temperature: 0.85 } 
    });
    return response.text;
  }

  async generateStoryMemory(text: string) {
    const ai = this.getClient();
    const prompt = `Analyze this chapter text and extract key continuity points.
JSON Output: { "events": [], "character_updates": [], "tone_summary": "" } 
TEXT: ${text}`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: prompt, 
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            events: { type: Type.ARRAY, items: { type: Type.STRING } },
            character_updates: { type: Type.ARRAY, items: { type: Type.STRING } },
            tone_summary: { type: Type.STRING }
          },
          required: ["events", "character_updates", "tone_summary"]
        }
      } 
    });
    return JSON.parse(response.text);
  }

  async consultArchitect(message: string, context: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Expert Novel Architect consultation. Story Context: ${context}. User Question: ${message}`,
      config: { tools: [{ googleSearch: {} }] }
    });

    const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
      title: c.web?.title || "Reference Source", 
      uri: c.web?.uri 
    })).filter((l: any) => l.uri) || [];

    return { text: response.text, links };
  }
}

/**
 * Groq-specific Adapter implementation.
 */
class GroqAdapter implements AIProvider {
  readonly type = 'groq';

  private getClient() {
    const key = getApiKeyForProvider('groq');
    if (!key) throw new Error("GROQ_API_KEY_MISSING");
    return new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
  }

  private async callGroq(prompt: string, jsonMode: boolean = false) {
    const client = this.getClient();
    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
    return chatCompletion.choices[0].message.content || "";
  }

  async generateOutline(novel: any) {
    const prompt = `Act as a Master Story Architect. Generate a professional blurb and a 12-20 chapter outline.
Title: ${novel.title}
Genre: ${novel.genre}
Context: ${novel.premise}
Return a JSON object: { "premise": "text", "outline": ["Chapter 1...", "Chapter 2..."] }`;
    const res = await this.callGroq(prompt, true);
    return JSON.parse(res);
  }

  async generateDraftChapter(index: number, novel: any, directive: string, memory: any) {
    const chars = novel.characters.map((c: any) => `- ${c.name}: ${c.description}`).join("\n");
    const storyMemory = memory ? `Continuity Points: ${JSON.stringify(memory)}` : "";
    const prompt = `Write Chapter ${index + 1}: ${novel.outline[index]} for "${novel.title}".
Characters:
${chars}
${storyMemory}
Style: ${novel.novelStyle}
Genre: ${novel.genre}
Directive: ${directive}
Return ONLY the chapter prose.`;
    return await this.callGroq(prompt);
  }

  async generateStoryMemory(text: string) {
    const prompt = `Analyze this chapter text and extract key continuity points.
Return a JSON object: { "events": [], "character_updates": [], "tone_summary": "" } 
TEXT: ${text}`;
    const res = await this.callGroq(prompt, true);
    return JSON.parse(res);
  }

  async consultArchitect(message: string, context: string) {
    const prompt = `Expert Novel Architect consultation (No Live Search).
Story Context: ${context}. 
User Question: ${message}`;
    const text = await this.callGroq(prompt);
    return { text, links: [] };
  }
}

const adapters: Record<AIProviderType, AIProvider> = {
  gemini: new GeminiAdapter(),
  groq: new GroqAdapter()
};

let activeProviderType: AIProviderType = 'gemini';

export const setProvider = (type: AIProviderType) => {
  activeProviderType = type;
};

export const getProviderType = () => activeProviderType;

const getActiveAdapter = (): AIProvider => adapters[activeProviderType];

export const generateOutline = (novel: any) => 
  getActiveAdapter().generateOutline(novel);

export const generateDraftChapter = (index: number, novel: any, directive: string = "", memory: any = null) => 
  getActiveAdapter().generateDraftChapter(index, novel, directive, memory);

export const generateStoryMemory = (text: string) => 
  getActiveAdapter().generateStoryMemory(text);

export const consultArchitect = (message: string, context: string) => 
  getActiveAdapter().consultArchitect(message, context);

export const generateCharacterPortrait = async (char: any, novel: any) => {
  const key = getApiKeyForProvider('gemini');
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `High-quality character portrait of ${char.name}, ${char.description}, style: ${novel.genre} cinematic concept art.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

export const generateVisual = async (prompt: string) => {
  const key = getApiKeyForProvider('gemini');
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};