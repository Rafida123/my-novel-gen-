
import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq';

// Use process.env.API_KEY directly for all client initializations as per guidelines
const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getGroqClient = () => {
  return new Groq({ apiKey: process.env.API_KEY, dangerouslyAllowBrowser: true });
};

export const generateOutline = async (novel: any, provider: AIProvider = 'gemini') => {
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

  if (provider === 'groq') {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: `${systemInstruction}\nReturn output ONLY as JSON with keys: "premise" (string) and "outline" (array of 12 strings).` },
        { role: "user", content: `Concept: ${novel.premise}\nCharacters:\n${charContext}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } else {
    // Correct usage of generateContent with model name and prompt in one call
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
              description: "12 chronological chapter titles"
            },
          },
          required: ["premise", "outline"],
        },
      },
    });
    // Access the .text property directly instead of calling it as a method
    return JSON.parse(response.text || "{}");
  }
};

export const generateChapterContent = async (
  index: number, 
  novel: any, 
  isRegen: boolean = false, 
  directive: string = "",
  provider: AIProvider = 'gemini'
) => {
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
  ${novel.isR18 ? "UNFILTERED/R18: Describe acts with visceral, anatomical, and sensory detail. Use characters' specific expressions and kinks to drive intensity. Use explicit language where appropriate." : "Standard: Keep it romantic and suitable for general audiences."}`;

  const prompt = `
    LAST CHAPTER ENDED WITH: "${lastSceneSnippet}"
    WRITE Chapter ${index + 1}: "${novel.outline[index]}". 
    Premise: ${novel.generatedPremise}. 
    Characters:\n${charContext}
    ${directive ? `SPECIAL DIRECTIVE: ${directive}` : ""}
    ${isRegen ? "REGENERATE: Change the scene based on the directive but keep same continuity." : "Write a complete, long, immersive chapter."}
  `;

  if (provider === 'groq') {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_completion_tokens: 4096
    });
    return response.choices[0].message.content;
  } else {
    // Correct usage of generateContent with model name and prompt in one call
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });
    // Access the .text property directly
    return response.text;
  }
};

export const getAiSuggestions = async (chapterContent: string, nextTitle: string, provider: AIProvider = 'gemini') => {
  const prompt = `Based on this text: "${chapterContent.slice(-2000)}", suggest 3 dialogue or plot beats for the next chapter titled "${nextTitle}".`;

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
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
  } else {
    // Correct usage of generateContent with model name and prompt in one call
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
    // Access the .text property directly
    return JSON.parse(response.text || "[]");
  }
};

export const chatWithConsultant = async (message: string, context: string, provider: AIProvider = 'gemini') => {
  const systemInstruction = `You are a high-end story consultant. Help the author with plot holes, character arcs, and themes. Context of the story: ${context}`;
  
  if (provider === 'groq') {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message }
      ],
    });
    return response.choices[0].message.content;
  } else {
    // Correct usage of generateContent with model name and prompt in one call
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        systemInstruction,
      },
    });
    // Access the .text property directly
    return response.text;
  }
};
