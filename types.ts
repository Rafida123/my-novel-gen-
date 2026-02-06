
export interface Character {
  name: string;
  role: string;
  description: string;
  dialogueStyles: string[];
  personality: string[];
  expressions: string[];
  kinks: string[];
}

export interface Novel {
  id: string;
  title: string;
  lastModified: number;
  genre: string;
  isR18: boolean;
  premise: string;
  tone: string[];
  tags: string[];
  novelStyle: string;
  ebookStyle: string;
  characters: Character[];
  generatedPremise: string;
  outline: string[];
  chapters: Record<number, string>;
  aiSuggestions: Record<number, string[]>;
}

export type AppStep = 'ideate' | 'style' | 'write' | 'archive';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}
