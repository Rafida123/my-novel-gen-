
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Groq } from "groq-sdk";

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    throw new Error("ARCHITECT_AUTH_REQUIRED");
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
 * Universal Failover Wrapper
 * Logic: Try Gemini -> If 429 or 503 -> Try Groq
 */
async function callAiWithFallback(geminiCall: () => Promise<any>, groqPrompt: string, isJson: boolean = false) {
  try {
    return await geminiCall();
  } catch (error: any) {
    console.warn("Gemini Service Interrupted (Quota or Server). Attempting Failover to Groq...", error);
    
    const groq = getGroqClient();
    if (!groq || (error.message && !error.message.includes('429') && !error.message.includes('RESOURCE_EXHAUSTED') && !error.message.includes('503'))) {
      throw error; 
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: groqPrompt }],
      temperature: 0.85,
      response_format: isJson ? { type: "json_object" } : undefined,
    });

    const text = completion.choices[0]?.message?.content || "";
    return isJson ? { text } : text;
  }
}

/**
 * 1) OUTLINE GENERATION
 */
export const generateOutline = async (novel: any) => {
  const prompt = `You are a bestselling novelist and story architect. Generate a professional novel premise and a 12–20 chapter outline.
Genre: ${novel.genre}
R18 Mode: ${novel.isR18 ? "ON" : "OFF"}
Vibes/Tags: ${novel.tags.join(", ")}
User Premise: ${novel.premise}

STRICT JSON OUTPUT:
{
  "premise": "...",
  "outline": ["Chapter 1: ...", "Chapter 2: ..."]
}`;

  const res = await callAiWithFallback(
    async () => {
      const ai = getGeminiClient();
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
    return JSON.parse(res.text || "{}");
  } catch (e) {
    console.error("Failed to parse outline JSON", e);
    throw new Error("Invalid Outline Format");
  }
};

/**
 * 2) CHAPTER GENERATION (PASS 1: DRAFT)
 */
export const generateDraftChapter = async (index: number, novel: any, directive: string = "", memory: any = null) => {
  const previousText = index > 0 ? novel.chapters[index - 1]?.slice(-1500) : "None";
  const currentDraft = novel.chapters[index] ? novel.chapters[index].slice(0, 1500) : "None";
  
  const memoryContext = memory ? `
STORY MEMORY:
- Events: ${memory.events?.join(" | ")}
- Characters: ${memory.character_updates?.join(" | ")}
- Tone: ${memory.tone_summary}` : "None";

  const charContext = novel.characters.map((c: any) => {
    return `- Name: ${c.name} (${c.role}). Traits: ${c.personality?.join(", ")}. Appearance: ${c.physicalBuild}, ${c.physicalEyes} eyes, ${c.physicalSkin} skin. Distinct markers: ${c.physicalMarkers?.join(", ")}`;
  }).join("\n");

  const r18SensoryInstructions = novel.isR18 ? `
CRITICAL R18 WRITING RULES:
- For intimate/sex scenes, the writing must be highly sensory, visceral, and focused on touch, taste, sound, and atmosphere.
- AUDIO PUNCTUATION: Naturally insert realistic sound effects in italics at key moments.
- SOUND REPERTOIRE: Use *plop*, *slrk*, *mmph*, *wet pop*, *kiss*, *lick*, *pant*, *gasp*, *thump*, *creak*, and *rustle*.
- PLACEMENT: Insert these naturally during mouth actions, kisses, wet contact, heavy body movement, or bed shifting.
- VARIETY: Keep the sounds varied and avoid repeating the same sound effect too often. They should feel like a natural part of the prose, enhancing the immersion.` : "";

  const prompt = `You are a professional published novelist. Write Chapter ${index + 1} of "${novel.title}".
Genre: ${novel.genre}
Style/POV: ${novel.novelStyle}
Characters: ${charContext}
Outline: ${novel.outline[index]}
${memoryContext}
${r18SensoryInstructions}
User Directive: ${directive || "None"}
Previous Chapter Context: ${previousText}

Write immersive, high-quality, professional prose. Return ONLY the chapter text.`;

  return await callAiWithFallback(
    async () => {
      const ai = getGeminiClient();
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
 * 3) POLISH / REWRITE (PASS 2)
 */
export const polishChapterContent = async (text: string, novel: any) => {
  const r18PolishInstructions = novel.isR18 ? `
- Preserve and refine the sensory descriptions.
- Ensure italicized sound effects (*slrk*, *mmph*, *wet pop*, etc.) are placed with perfect timing and feel natural.
- Check for repetition of sounds and ensure a varied, immersive auditory experience.` : "";

  const prompt = `Rewrite the following novel chapter to improve flow, remove repetition, and enhance sensory atmosphere. Keep the plot and character voices intact.
${r18PolishInstructions}

TEXT:
${text}

Return ONLY the polished text.`;

  return await callAiWithFallback(
    async () => {
      const ai = getGeminiClient();
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
 * 4) STORY MEMORY EXTRACTION
 */
export const generateStoryMemory = async (text: string) => {
  const prompt = `Extract story continuity from this chapter. Return JSON.
TEXT:
${text}

JSON SCHEMA: { "events": [], "character_updates": [], "tone_summary": "" }`;

  const res = await callAiWithFallback(
    async () => {
      const ai = getGeminiClient();
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
    return JSON.parse(res.text || "{}");
  } catch (e) {
    return null;
  }
};

export const generateVisual = async (prompt: string) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {
    console.warn("Visual generation failed (Quota).", e);
  }
  return null;
};

export const generateCharacterPortrait = async (char: any, novel: any) => {
  try {
    const ai = getGeminiClient();
    const prompt = `Portrait: ${char.name}, ${char.physicalBuild}, ${char.physicalEyes} eyes, ${char.physicalSkin} skin, ${novel.genre} style.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {
    console.warn("Portrait generation failed (Quota).", e);
  }
  return null;
};

export const speakProse = async (text: string) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    return null;
  }
};

export const consultArchitect = async (message: string, context: string) => {
  const prompt = `Expert advice for novelist. Context: ${context}. Question: ${message}`;
  return await callAiWithFallback(
    async () => {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "You are the Lead Story Architect. Use Google Search for facts.",
          tools: [{ googleSearch: {} }],
        },
      });
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = grounding.map((chunk: any) => ({
        title: chunk.web?.title || "Reference",
        uri: chunk.web?.uri || ""
      })).filter((l: any) => l.uri);
      return { text: response.text, links };
    },
    prompt,
    false
  );
};
