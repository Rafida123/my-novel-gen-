import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

export type AIProviderType = 'gemini' | 'groq';

/**
 * Utility to clean AI responses that might be wrapped in markdown code blocks.
 * Safely handles strings that aren't wrapped at all or have conversational pre-text.
 */
const cleanJson = (str: string): string => {
  if (!str) return "{}";
  // Remove markdown blocks if they exist
  const cleaned = str.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
  // Find the first '{' and last '}' to isolate the JSON object if the model was chatty
  const firstBracket = cleaned.indexOf('{');
  const lastBracket = cleaned.lastIndexOf('}');
  if (firstBracket !== -1 && lastBracket !== -1) {
    return cleaned.substring(firstBracket, lastBracket + 1);
  }
  return cleaned;
};

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
 * Helper to get API keys from env or localStorage.
 * Highly defensive against stringified "undefined" or "null" values.
 */
export const getApiKeyForProvider = (type: AIProviderType): string => {
  if (type === 'groq') {
    // Priority 1: Local Storage (User configured)
    if (typeof localStorage !== 'undefined') {
      const localKey = localStorage.getItem('GROQ_API_KEY');
      if (localKey && localKey !== 'undefined' && localKey !== 'null' && localKey.trim().length > 10) {
        return localKey.trim();
      }
    }

    // Priority 2: Environment Variables (Vite/Process shim)
    const envKey = process.env.GROQ_API_KEY;
    if (envKey && envKey !== 'undefined' && envKey !== 'null' && envKey.trim().length > 10) {
      return envKey.trim();
    }
    return '';
  }
  
  // Gemini Keys
  const geminiKey = process.env.API_KEY;
  if (geminiKey && geminiKey !== 'undefined' && geminiKey !== 'null' && geminiKey.trim().length > 10) {
    return geminiKey.trim();
  }
  return '';
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
Sub-Genres: ${novel.subGenres?.join(', ') || 'N/A'}
Mood & Tone: ${novel.tone?.join(', ') || 'N/A'}
Dynamics & Kinks: ${novel.kinks?.join(', ') || 'N/A'}
Content Tags: ${novel.contentTags?.join(', ') || 'N/A'}
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
    const chars = novel.characters.map((c: any) => `- ${c.name}: ${c.description}. Personality: ${c.personality?.join(', ')}. Dialogue Style: ${c.dialogueStyles?.join(', ')}`).join("\n");
    const storyMemory = memory ? `Continuity Points (Previous Events): ${JSON.stringify(memory)}` : "";
    
    let r18Directive = "";
    if (novel.isR18) {
      r18Directive = `
        R18 SENSORY PROTOCOL: 
        For intimate scenes, use visceral language. 
        Incorporate sound effects in italics: *plop*, *slrk*, *mmph*, *wet pop*, *kiss*, *lick*, *pant*, *gasp*.
      `;
    }

    const prompt = `Write Chapter ${index + 1}: ${novel.outline[index]} for "${novel.title}".
Characters:
${chars}
${storyMemory}
Style: ${novel.novelStyle}
Genre: ${novel.genre}
Directive: ${directive}
${r18Directive}
Return ONLY the prose text. No chat, no intro.`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-pro-preview', 
      contents: prompt, 
      config: { temperature: 0.85 } 
    });
    return response.text;
  }

  async generateStoryMemory(text: string) {
    if (!text?.trim()) return { events: [], character_updates: [], tone_summary: "" };
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
    try {
      const chatCompletion = await client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are a Master Story Architect. ${jsonMode ? "CRITICAL: You MUST respond ONLY with a valid JSON object. Do not include any other text, greetings, or explanations. Use the word 'json' in your output." : "Respond with clean, immersive novel prose. Do not include introductory text."}` 
          },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: 0.7,
      });
      return chatCompletion.choices[0].message.content || "";
    } catch (e: any) {
      if (e.message?.includes("invalid_api_key") || e.status === 401) throw new Error("INVALID_GROQ_KEY");
      throw e;
    }
  }

  async generateOutline(novel: any) {
    const prompt = `Generate a professional blurb and a 12-20 chapter outline for "${novel.title}".
Genre: ${novel.genre}
Premise: ${novel.premise}
Mood: ${novel.tone?.join(', ')}
Return exactly this JSON structure: { "premise": "blurb text", "outline": ["Chapter 1: ...", "Chapter 2: ..."] }`;
    const res = await this.callGroq(prompt, true);
    return JSON.parse(cleanJson(res));
  }

  async generateDraftChapter(index: number, novel: any, directive: string, memory: any) {
    const chars = novel.characters.map((c: any) => `- ${c.name}: ${c.description}. Personality: ${c.personality?.join(', ')}`).join("\n");
    const storyMemory = memory ? `Previous Events for Continuity: ${JSON.stringify(memory)}` : "";
    const chapterTitle = novel.outline[index] || "Untitled Chapter";

    const prompt = `Write Chapter ${index + 1}: ${chapterTitle} for the novel "${novel.title}".
Characters Involved:
${chars}
${storyMemory}
Directive: ${directive}
Return ONLY the chapter prose. No preamble.`;
    return await this.callGroq(prompt);
  }

  async generateStoryMemory(text: string) {
    if (!text?.trim()) return { events: [], character_updates: [], tone_summary: "" };
    const prompt = `Analyze this chapter text for plot continuity.
Return JSON: { "events": ["event 1"], "character_updates": ["update 1"], "tone_summary": "summary" } 
TEXT: ${text}`;
    const res = await this.callGroq(prompt, true);
    return JSON.parse(cleanJson(res));
  }

  async consultArchitect(message: string, context: string) {
    const prompt = `Context: ${context}. Question: ${message}`;
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
    contents: { parts: [{ text: `High-quality cinematic character portrait: ${char.name}, ${char.description}, style: ${novel.genre}.` }] },
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