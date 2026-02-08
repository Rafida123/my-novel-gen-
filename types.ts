
export interface Character {
  name: string;
  role: string;
  description: string;
  dialogueStyles: string[];
  personality: string[];
  expressions: string[];
  kinks: string[];
  hairColor: string;
  eyeColor: string;
  bodyType: string;
  distinguishingFeatures: string;
  imageUrl?: string;
}

export interface StoryboardItem {
  id: string;
  url: string;
  prompt: string;
}

export interface Novel {
  id: string;
  title: string;
  lastModified: number;
  genre: string;
  isR18: boolean;
  premise: string;
  tone: string[];
  subGenres: string[];
  kinks: string[];
  contentTags: string[];
  tags: string[];
  novelStyle: string;
  ebookStyle: string;
  characters: Character[];
  generatedPremise: string;
  outline: string[];
  chapters: Record<number, string>;
  aiSuggestions: Record<number, string[]>;
  storyboard?: StoryboardItem[];
}

export type AppStep = 'ideate' | 'style' | 'write' | 'archive' | 'storyboard';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}