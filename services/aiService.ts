import { GoogleGenAI, Type } from "@google/genai";

/**
 * Creates a fresh instance of the Gemini AI client.
 * Always creates a new instance right before a call to ensure it picks up 
 * the latest key from the selection dialog or environment.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: apiKey as string });
};

/**
 * Generates a full story outline and blurb.
 */
export const generateOutline = async (novel: any) => {
  const ai = getAiClient();
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
};

/**
 * Drafts a specific chapter based on the outline and story context.
 */
export const generateDraftChapter = async (index: number, novel: any, directive: string = "", memory: any = null) => {
  const ai = getAiClient();
  const chars = novel.characters.map((c: any) => `- ${c.name}: ${c.description}`).join("\n");
  const storyMemory = memory ? `Continuity Points (Previous Events): ${JSON.stringify(memory)}` : "";
  const r18Rules = novel.isR18 ? `\nSensory Protocol: Use visceral details and italicized auditory cues (e.g. *slrk*, *wet pop*) to enhance intimacy and atmosphere.` : "";

  const prompt = `Write Chapter ${index + 1}: ${novel.outline[index]} for "${novel.title}".
Characters:
${chars}
${storyMemory}
Style: ${novel.novelStyle}
Genre: ${novel.genre}
Directive: ${directive}
${r18Rules}

Draft professional novel prose with deep character interiority. Return ONLY the chapter text.`;

  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: prompt, 
    config: { temperature: 0.85 } 
  });
  
  return response.text;
};

/**
 * Extracts continuity data from a chapter to maintain story logic.
 */
export const generateStoryMemory = async (text: string) => {
  const ai = getAiClient();
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
};

/**
 * Generates an image for a character.
 */
export const generateCharacterPortrait = async (char: any, novel: any) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `High-quality character portrait of ${char.name}, ${char.description}, style: ${novel.genre} cinematic concept art.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

/**
 * Generates an environment visual for a scene.
 */
export const generateVisual = async (prompt: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
};

/**
 * A search-grounded assistant for research and plotting.
 */
export const consultArchitect = async (message: string, context: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Expert Novel Architect consultation. 
Story Context: ${context}. 
User Question: ${message}`,
    config: { tools: [{ googleSearch: {} }] }
  });

  const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
    title: c.web?.title || "Reference Source", 
    uri: c.web?.uri 
  })).filter((l: any) => l.uri) || [];

  return { text: response.text, links };
};