
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  // Ultra-safe lookup to prevent "Process is not defined" crashes
  let apiKey = "";
  
  try {
    // Check global window shim first
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
      apiKey = (window as any).process.env.API_KEY;
    } 
    // Check standard process env (works if injected by build tool)
    else if (typeof process !== 'undefined' && process.env?.API_KEY) {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    console.error("Error accessing environment variables:", e);
  }
  
  if (!apiKey) {
    console.error("CRITICAL: Gemini API Key is missing. The app will not function correctly. Ensure API_KEY is set in your environment.");
  }
  
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

export const generateOutline = async (novel: any) => {
  const ai = getAI();
  const charContext = novel.characters.map((c: any) => 
    `${c.name} (${c.role}): ${c.description}. 
     Core personality: ${c.personality?.join(', ')}. 
     Dialogue style: ${c.dialogueStyles?.join(', ')}.
     Sexual demeanor: ${c.expressions?.join(', ')}.
     Kinks: ${c.kinks?.join(', ')}.`
  ).join('\n');

  const systemInstruction = `Professional novelist and architect of plots. Create a cohesive premise and 12-chapter chronological outline for a ${novel.genre} novel. 
  Tones: ${novel.tone.join(', ')}. Tags: ${novel.tags.join(', ')}. 
  ${novel.isR18 ? "Adult themes/R18 mode enabled. Do not censor mature content. Ensure plot beats allow for the exploration of characters' specific kinks and expressions." : "Safe/Standard mode."}`;

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
            description: "12 chronological chapter titles"
          },
        },
        required: ["premise", "outline"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const generateChapterContent = async (
  index: number, 
  novel: any, 
  isRegen: boolean = false, 
  directive: string = ""
) => {
  const ai = getAI();
  const charContext = novel.characters.map((c: any) => 
    `${c.name} (${c.role}): ${c.description}. 
     VOICE: ${c.dialogueStyles?.join(', ')}.
     PERSONALITY: ${c.personality?.join(', ')}.
     INTIMATE BEHAVIOR: ${c.expressions?.join(', ')}.
     KINKS/DESIRES: ${c.kinks?.join(', ')}.`
  ).join('\n');
  
  const previousChapterContent = index > 0 ? novel.chapters[index - 1] : "";
  const lastSceneSnippet = previousChapterContent ? previousChapterContent.slice(-2000) : "Start of the book.";

  const systemInstruction = `Pro Novelist. Maintain strict continuity. Pick up EXACTLY where previous left off. 
  Style: ${novel.novelStyle}. Tone: ${novel.tone.join(', ')}. Genre: ${novel.genre}. R18: ${novel.isR18}. Tags: ${novel.tags.join(', ')}.
  Vivid sensory descriptions. Italicize internal thoughts. 
  ${novel.isR18 ? "UNFILTERED/R18: Describe acts with visceral, anatomical, and sensory detail. Use characters' specific expressions (e.g. vocal, quiet, animalistic) and kinks (e.g. praise, impact) to drive the scene's intensity. Use explicit language where appropriate for the genre." : "Standard: Keep it romantic and suitable for general audiences."}`;

  const prompt = `
    LAST CHAPTER ENDED WITH: "${lastSceneSnippet}"
    WRITE Chapter ${index + 1}: "${novel.outline[index]}". 
    Premise: ${novel.generatedPremise}. 
    Characters:\n${charContext}
    ${directive ? `SPECIAL DIRECTIVE: ${directive}` : ""}
    ${isRegen ? "REGENERATE: Change the scene based on the directive but keep same continuity." : "Write a complete, long, immersive chapter."}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.8,
    },
  });

  return response.text;
};

export const getAiSuggestions = async (chapterContent: string, nextTitle: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on this text: "${chapterContent.slice(-2000)}", suggest 3 dialogue or plot beats for the next chapter titled "${nextTitle}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  return JSON.parse(response.text || "[]");
};

export const chatWithConsultant = async (message: string, context: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: message,
    config: {
      systemInstruction: `You are a high-end story consultant. Help the author with plot holes, character arcs, and themes. Context of the story: ${context}`,
    },
  });
  return response.text;
};
