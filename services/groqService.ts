
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Groq } from "groq-sdk";

export type AiEngine = 'gemini' | 'groq' | 'auto';

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return null;
  }
  return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

/**
 * Universal AI Caller with engine selection and failover.
 */
async function callAi(
  engine: AiEngine,
  geminiCall: (client: GoogleGenAI) => Promise<any>,
  groqPrompt: string,
  isJson: boolean = false
) {
  // 1. Try Gemini if requested or auto
  if (engine === 'gemini' || engine === 'auto') {
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        return await geminiCall(gemini);
      } catch (error: any) {
        const errStr = JSON.stringify(error).toLowerCase();
        const isQuotaError = errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('limit');
        
        // If user explicitly chose Gemini, don't fail over to Groq automatically
        if (engine === 'gemini' || !isQuotaError) {
          throw error;
        }
        console.warn("Gemini Quota Exhausted. Failing over to Groq...");
      }
    } else if (engine === 'gemini') {
      throw new Error("GEMINI_AUTH_REQUIRED: Please set your API_KEY.");
    }
  }

  // 2. Try Groq (either explicitly chosen or as failover)
  const groq = getGroqClient();
  if (!groq) {
    throw new Error("GROQ_AUTH_REQUIRED: Please set your GROQ_API_KEY.");
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: groqPrompt }],
    temperature: isJson ? 0.2 : 0.85,
    response_format: isJson ? { type: "json_object" } : undefined,
    max_completion_tokens: isJson ? 1024 : 4096,
  });

  const text = completion.choices[0]?.message?.content || "";
  return isJson ? { text } : text;
}

/**
 * 1) OUTLINE GENERATION
 */
export const generateOutline = async (novel: any, engine: AiEngine = 'auto') => {
  const prompt = `You are a professional story architect. Generate a 12-20 chapter outline and a premise for a novel.
Title: ${novel.title}
Genre: ${novel.genre}
R18 Mode: ${novel.isR18 ? "ON" : "OFF"}
Vibes: ${novel.tags.join(", ")}
Premise: ${novel.premise}

Return valid JSON only:
{
  "premise": "Full blurb here",
  "outline": ["Chapter 1: ...", "Chapter 2: ..."]
}`;

  const res = await callAi(
    engine,
    async (ai) => {
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
      return { text: response.text };
    },
    prompt,
    true
  );

  try {
    const jsonStr = typeof res.text === 'string' ? res.text : JSON.stringify(res);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Parse failed", res);
    throw new Error("Invalid response from AI Engine");
  }
};

/**
 * 2) CHAPTER GENERATION (DRAFT)
 */
export const generateDraftChapter = async (index: number, novel: any, directive: string = "", memory: any = null, engine: AiEngine = 'auto') => {
  const charContext = novel.characters.map((c: any) => 
    `- ${c.name} (${c.role}): ${c.personality?.join(", ")}. Physical: ${c.physicalBuild}, ${c.physicalEyes} eyes.`
  ).join("\n");

  const r18Rules = novel.isR18 ? `
CRITICAL R18 SENSORY RULES:
- Focus on wet, tactile sensations and heavy atmosphere.
- AUDITORY PUNCTUATION: Use italicized onomatopoeia: *plop*, *slrk*, *mmph*, *wet pop*, *kiss*, *lick*, *pant*, *gasp*, *thump*, *creak*, *rustle*.
- Insert them naturally during intimate contact or environmental reactions.
- High variety, do not repeat the same sound too often.` : "";

  const prompt = `Write Chapter ${index + 1} of "${novel.title}".
Outline: ${novel.outline[index]}
Genre: ${novel.genre}
Style: ${novel.novelStyle}
Characters:
${charContext}
Memory: ${memory ? JSON.stringify(memory) : "None"}
Directive: ${directive}
${r18Rules}

Write immersive, professional prose. Return ONLY the chapter text.`;

  return await callAi(
    engine,
    async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { temperature: 0.9 },
      });
      return response.text;
    },
    prompt,
    false
  );
};

/**
 * 3) POLISH
 */
export const polishChapterContent = async (text: string, novel: any, engine: AiEngine = 'auto') => {
  const prompt = `Rewrite and polish this novel chapter. 
- Enhance flow and sensory detail.
- If R18, sharpen the wet, breathless atmosphere and perfect the timing of auditory effects (*slrk*, *mmph*, etc).
- Remove repetitive phrasing.

TEXT:
${text}

Return polished prose only.`;

  return await callAi(
    engine,
    async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.7 },
      });
      return response.text;
    },
    prompt,
    false
  );
};

/**
 * 4) STORY MEMORY
 */
export const generateStoryMemory = async (text: string, engine: AiEngine = 'auto') => {
  const prompt = `Extract continuity memory from this text. Return JSON only:
{ "events": [], "character_updates": [], "tone_summary": "" }

TEXT:
${text}`;

  const res = await callAi(
    engine,
    async (ai) => {
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
              tone_summary: { type: Type.STRING },
            },
          },
        },
      });
      return { text: response.text };
    },
    prompt,
    true
  );

  try {
    const jsonStr = typeof res.text === 'string' ? res.text : JSON.stringify(res);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
};

/**
 * UTILS (Visual/Audio remain Gemini-only but fail gracefully)
 */
export const generateVisual = async (prompt: string) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { console.warn("Visual failed", e); }
  return null;
};

export const generateCharacterPortrait = async (char: any, novel: any) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;
    const prompt = `Portrait of ${char.name}, ${char.physicalBuild}, ${char.physicalEyes} eyes. Genre: ${novel.genre}. Style: Cinematic.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { console.warn("Portrait failed", e); }
  return null;
};

export const speakProse = async (text: string) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
};

export const consultArchitect = async (message: string, context: string, engine: AiEngine = 'auto') => {
  const prompt = `Architect advice. Context: ${context}. Message: ${message}`;
  return await callAi(
    engine,
    async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "Lead Story Architect advice.",
          tools: [{ googleSearch: {} }],
        },
      });
      return { text: response.text, links: [] };
    },
    prompt,
    false
  );
};
