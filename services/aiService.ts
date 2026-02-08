import { GoogleGenAI, Type } from "@google/genai";

/**
 * Validates whether a key is likely valid.
 */
const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const k = String(key).trim();
  return k !== "" && k !== "undefined" && k !== "null" && !k.includes("your_") && k.length > 10;
};

/**
 * Creates a fresh instance of the Gemini AI client.
 * Always creates a new instance to ensure it picks up the latest key from the selection dialog.
 */
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateOutline = async (novel: any) => {
  const ai = getAiClient();
  const prompt = `Act as a Master Story Architect. Create a professional blurb and a 12-20 chapter outline.
Title: ${novel.title}
Genre: ${novel.genre}
Context: ${novel.premise}
${novel.isR18 ? "R18 Mode: Explicit adult themes allowed." : "Standard Mode."}

JSON OUTPUT ONLY:
{
  "premise": "Book blurb content...",
  "outline": ["Chapter 1: ...", "Chapter 2: ..."]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
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

  return JSON.parse(response.text);
};

export const generateChapterContent = async (index: number, novel: any, directive: string = "") => {
  const ai = getAiClient();
  const charContext = novel.characters.map((c: any) => `- ${c.name} (${c.role}): ${c.description}`).join("\n");
  
  const prompt = `Write a cinematic novel chapter for "${novel.title}".
Goal: ${novel.outline[index]}
Genre: ${novel.genre}
POV: ${novel.novelStyle}
Cast:
${charContext}
User Directive: ${directive}
${novel.isR18 ? "\nPROTOCOL: Focus on immersive sensory details and visceral atmosphere." : ""}

Draft professional-grade prose. Return ONLY the chapter content.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      temperature: 0.8,
    },
  });

  return response.text;
};

export const getSuggestions = async (text: string, nextTitle: string) => {
  const ai = getAiClient();
  const prompt = `Based on this text: "${text.slice(-1500)}", suggest 3 specific plot beats for the next chapter titled "${nextTitle}".`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
    },
  });

  return JSON.parse(response.text);
};

export const consultArchitect = async (message: string, context: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Expert Novel Architect consultation. Context: ${context}. Question: ${message}`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => ({
      title: chunk.web?.title || "Reference",
      uri: chunk.web?.uri
    }))
    .filter((link: any) => link.uri) || [];

  return {
    text: response.text,
    links
  };
};
