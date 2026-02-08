
export interface Character {
  name: string;
  role: string;
  description: string;
  dialogueStyles: string[];
  personality: string[];
  expressions: string[];
  kinks: string[];
  kinkContexts?: Record<string, string>;
  // Granular Physicals
  physicalBody?: string[];
  physicalHair?: string[];
  physicalMarkers?: string[];
  physicalEyes?: string;
  physicalSkin?: string;
  physicalHeight?: string;
  physicalBuild?: string;
  imageUrl?: string;
}

export interface Revision {
  id: string;
  timestamp: number;
  content: string;
  label: string;
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
  revisions: Record<number, Revision[]>;
  aiSuggestions: Record<number, string[]>;
  storyboard: { id: string; url: string; prompt: string }[];
}

export type AppStep = 'ideate' | 'style' | 'write' | 'archive' | 'storyboard';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  links?: { title: string; uri: string }[];
}
