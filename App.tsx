import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, Library, Save, Users, Palette, 
  Flame, Cpu, ExternalLink, X, UserPlus, User as UserIcon, 
  Send, Search, Zap, ImageIcon, Key, AlertTriangle, Settings, ChevronDown, ChevronUp, UserCheck, Plus, Link as LinkIcon, LibraryBig, Ruler, Smile, Shirt, Scissors,
  PlusCircle, Trash2, Heart, Tags, ChevronRight
} from 'lucide-react';

import { Novel, AppStep, Character } from './types.ts';
import * as ai from './services/aiService.ts';
import * as db from './services/dbService.ts';
import { DIALOGUE_ARCHETYPES, PHYSICAL_LIBRARIES } from './services/libraryService.ts';

const CHARACTER_ROLES = ['Protagonist', 'Antagonist', 'Supporting', 'Minor'];

const FEATURE_GROUPS = [
  { name: 'Core Identity', icon: UserCheck, fields: ['Gender', 'Pronouns', 'Age Range', 'Species/Type'] },
  { name: 'Physical Build', icon: Ruler, fields: ['Height', 'Body Type / Build', 'Skin Tone / Complexion'] },
  { name: 'Facial Details', icon: Smile, fields: ['Hair Style', 'Hair Length', 'Hair Color', 'Eye Color', 'Eye Shape / Eye Features', 'Facial Features', 'Makeup Style'] },
  { name: 'Style & Fashion', icon: Shirt, fields: ['Clothing Style', 'Fashion Aesthetic', 'Accessories'] },
  { name: 'Special Traits', icon: Zap, fields: ['Fantasy/Sci-Fi Traits'] },
];

const TAG_LIBRARIES: Record<string, string[]> = {
  'Genre / Story Type': ['Drama', 'Romance', 'Comedy', 'Thriller', 'Horror', 'Mystery', 'Fantasy', 'Sci-Fi', 'Slice of Life', 'Action'],
  'Relationship Type': ['Straight', 'Yaoi / BL', 'Yuri / GL', 'LGBTQ+', 'Poly', 'Forbidden Love', 'Love Triangle'],
  'Time / Era Settings': [
    'Ancient Era', 'Medieval Era', 'Edo Era', 'Victorian Era', '1920s', '1940s / War Era', '1980s', 
    'Modern / Contemporary', 'Near Future', 'Distant Future', 'Post-Apocalyptic', 'Alternate History'
  ],
  'School / Daily Life Settings': [
    'High School', 'College / University', 'Boarding School', 'Student Council', 'Club / Sports Activities', 
    'Dorm / Hostel', 'Workplace / Office', 'Hospital', 'Coffee Shop / Café', 'Bookstore / Library', 
    'Theater / Stage', 'Small Town', 'Big City / Urban'
  ],
  'Fantasy / Sci-Fi / Supernatural Worlds': [
    'Fantasy Kingdom', 'Magic Academy / Wizard School', 'Dragon / Beast Territory', 'Castle / Palace', 
    'Forest / Enchanted Woods', 'Mountain / Village', 'Underwater Kingdom / Merman Realm', 'Alien Planet', 
    'Space Station', 'Cyberpunk City / Futuristic Metropolis', 'Virtual Reality / Simulation', 
    'Parallel Universe / Alternate Reality', 'Haunted / Cursed Land', 'Demon / Angel Realm'
  ],
  'Adventure / Action Locations': [
    'Battlefield / War Zone', 'Mafia / Gang Hideout', 'Prison / Detention', 'Desert / Wilderness', 
    'Island / Beach', 'Road Trip / Travel', 'Underground / Sewers / Catacombs', 'Tower / Dungeon / Labyrinth'
  ],
  'Miscellaneous / Unique Settings': [
    'Royal Court / Noble Estate', 'Marketplace / Town Square', 'Festival / Carnival', 'Train / Ship / Airship', 
    'Sci-Fi Lab / Research Center', 'Time-Travel Era Locations', 'Post-War Ruins', 'Steampunk City'
  ],
  'Tropes / Plot Themes': ['Enemies to Lovers', 'Friends to Lovers', 'Fake Dating', 'Arranged Marriage', 'Forced Proximity', 'Slow Burn', 'Reincarnation / Regression', 'Time Travel'],
  'Mood / Tone': ['Dark', 'Lighthearted', 'Wholesome', 'Angst', 'Emotional', 'Suspenseful', 'Heartbreaking', 'Cozy'],
  'Romance Dynamics': ['Childhood Friends', 'Rivals to Lovers', 'Mutual Pining', 'Protective Partner', 'Jealous Partner', 'Obsessive Love'],
  'NSFW / R18 / Mature': [
    'R18 / Adult Content', 'Smut', 'Suggestive Scenes', 'Explicit Sex', 'Cunnilingus', 'Fellatio', 'Anal', 'Vaginal', 'Oral', 'Masturbation',
    'Group Sex / Threesome / Foursome', 'Dom/Sub', 'BDSM', 'Bondage', 'Spanking', 'Forced / Non-Consensual', 'Dubcon', 'Voyeurism', 'Exhibitionism',
    'Ageplay', 'Incest (fictional)', 'Pregnancy / Impregnation', 'Roleplay / Fantasy Kinks', 'Tentacles / Monster Sex', 'Gender Play / Transformation'
  ]
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('archive');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Architecting...");
  const [activeChapter, setActiveChapter] = useState(0);
  const [archive, setArchive] = useState<Novel[]>([]);
  const [showConsultant, setShowConsultant] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedKey, setHasSelectedKey] = useState(true);
  const [aiProvider, setAiProvider] = useState<ai.AIProviderType>(ai.getProviderType());
  const [expandedCharacters, setExpandedCharacters] = useState<Set<number>>(new Set([0]));
  const [openFeatureGroups, setOpenFeatureGroups] = useState<Record<number, string | null>>({});
  const [providerReady, setProviderReady] = useState(true);
  const [showLibrary, setShowLibrary] = useState<{charIdx: number, type: 'archetype' | 'feature', field?: string} | null>(null);
  const [expandedTagCategories, setExpandedTagCategories] = useState<Set<string>>(new Set(['Genre / Story Type']));

  const isProviderReady = () => {
    const key = ai.getApiKeyForProvider(aiProvider);
    return !!(key && key.length > 10);
  };

  useEffect(() => { 
    loadNovels();
    checkKeySelection();
    setProviderReady(isProviderReady());
  }, [aiProvider]);

  const loadNovels = async () => {
    try {
      const data = await db.getAllNovels();
      setArchive(data.sort((a, b) => b.lastModified - a.lastModified));
    } catch (e) {
      console.error("Failed to load novels", e);
    }
  };

  const checkKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasSelectedKey(hasKey);
    }
  };

  const handleOpenKeySelection = async () => {
    if (aiProvider === 'groq') {
      const key = prompt("Paste your Groq API Key (starts with gsk_ or check your VITE_GROQ_API_KEY):");
      if (key && key.trim().length > 10) {
        localStorage.setItem('GROQ_API_KEY', key.trim());
        setProviderReady(true);
        setError(null);
      }
      return;
    }
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasSelectedKey(true);
      setProviderReady(true);
      setError(null);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as ai.AIProviderType;
    ai.setProvider(provider);
    setAiProvider(provider);
    setProviderReady(ai.getApiKeyForProvider(provider).length > 10);
  };

  const save = async (updated: any) => {
    const novelWithTs = { ...updated, lastModified: Date.now() };
    await db.saveNovel(novelWithTs);
    setNovel(novelWithTs);
    loadNovels();
  };

  const toggleTag = (tag: string) => {
    const currentTags = novel.tags || [];
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((t: string) => t !== tag)
      : [...currentTags, tag];
    setNovel({ ...novel, tags: nextTags });
  };

  const toggleTagCategory = (category: string) => {
    const next = new Set(expandedTagCategories);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    setExpandedTagCategories(next);
  };

  const updateCharacterField = (idx: number, field: string, value: any) => {
    const nc = [...novel.characters];
    nc[idx] = { ...nc[idx], [field]: value };
    setNovel({...novel, characters: nc});
  };

  const applyArchetype = (charIdx: number, archetype: any) => {
    const nc = [...novel.characters];
    nc[charIdx] = {
      ...nc[charIdx],
      description: `${archetype.name}: ${archetype.traits}. Species: ${archetype.species}. Face: ${archetype.faceVibe}.`,
      dialogueStyles: [archetype.voice],
      personality: archetype.traits.split(', ').slice(0, 3)
    };
    setNovel({...novel, characters: nc});
    setShowLibrary(null);
  };

  const applyFeature = (charIdx: number, field: string, value: string) => {
    const nc = [...novel.characters];
    nc[charIdx] = { ...nc[charIdx], [field]: value };
    setNovel({...novel, characters: nc});
    setShowLibrary(null);
  };

  const addCharacterDynamic = (idx: number) => {
    const nc = [...novel.characters];
    const currentDynamics = nc[idx].dynamics || [];
    nc[idx] = { 
      ...nc[idx], 
      dynamics: [...currentDynamics, { type: '', context: '' }] 
    };
    setNovel({...novel, characters: nc});
  };

  const removeCharacterDynamic = (charIdx: number, dynIdx: number) => {
    const nc = [...novel.characters];
    const updatedDynamics = [...nc[charIdx].dynamics];
    updatedDynamics.splice(dynIdx, 1);
    nc[charIdx] = { ...nc[charIdx], dynamics: updatedDynamics };
    setNovel({...novel, characters: nc});
  };

  const updateCharacterDynamic = (charIdx: number, dynIdx: number, field: 'type' | 'context', value: string) => {
    const nc = [...novel.characters];
    const updatedDynamics = [...nc[charIdx].dynamics];
    updatedDynamics[dynIdx] = { ...updatedDynamics[dynIdx], [field]: value };
    nc[charIdx] = { ...nc[charIdx], dynamics: updatedDynamics };
    setNovel({...novel, characters: nc});
  };

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedCharacters);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedCharacters(next);
  };

  const toggleFeatureGroup = (charIdx: number, groupName: string) => {
    setOpenFeatureGroups(prev => ({
      ...prev,
      [charIdx]: prev[charIdx] === groupName ? null : groupName
    }));
  };

  const wrapAiCall = async (task: () => Promise<void>, msg: string) => {
    setError(null);
    setLoadingMessage(msg);
    setLoading(true);
    try {
      await task();
    } catch (e: any) {
      console.error("AI Error:", e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOutline = () => {
    if (!isProviderReady()) {
      handleOpenKeySelection();
      return;
    }
    wrapAiCall(async () => {
      const res = await ai.generateOutline(novel);
      await save({ ...novel, generatedPremise: res.premise, outline: res.outline });
    }, "Architecting Full Structure...");
  };

  const handleDraft = (idx: number) => {
    if (!isProviderReady()) {
      handleOpenKeySelection();
      return;
    }
    wrapAiCall(async () => {
      let memory = null;
      if (idx > 0 && novel.chapters[idx - 1]) {
        try { memory = await ai.generateStoryMemory(novel.chapters[idx - 1]); } catch (e) {}
      }
      const draft = await ai.generateDraftChapter(idx, novel, "", memory);
      await save({ ...novel, chapters: { ...novel.chapters, [idx]: draft } });
    }, "Drafting Scene...");
  };

  const handlePortrait = (idx: number) => wrapAiCall(async () => {
    const url = await ai.generateCharacterPortrait(novel.characters[idx], novel);
    if (url) {
      const chars = [...novel.characters];
      chars[idx].imageUrl = url;
      await save({ ...novel, characters: chars });
    }
  }, "Visualizing Character...");

  const handleMoodboard = () => wrapAiCall(async () => {
    const p = `Art: ${novel.outline[activeChapter] || novel.title}. Genre: ${novel.genre}.`;
    const url = await ai.generateVisual(p);
    if (url) {
      await save({ ...novel, storyboard: [{ id: crypto.randomUUID(), url, prompt: p }, ...(novel.storyboard || [])] });
    }
  }, "Rendering Art...");

  const handleConsult = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    try {
      const res = await ai.consultArchitect(msg, novel.generatedPremise || novel.premise);
      setChatHistory(prev => [...prev, { role: 'ai', text: res.text, links: res.links }]);
    } catch (e: any) { 
      setChatHistory(prev => [...prev, { role: 'ai', text: `Consultation error: ${e.message}` }]);
    }
  };

  const createDefaultCharacter = (): Character => ({
    name: 'New Actor',
    role: 'Protagonist',
    description: '',
    personality: [],
    dialogueStyles: [],
    expressions: [],
    dynamics: [],
    hairColor: '',
    eyeColor: '',
    bodyType: '',
    distinguishingFeatures: ''
  });

  const [novel, setNovel] = useState<any>({
    id: crypto.randomUUID(),
    title: 'New Story',
    lastModified: Date.now(),
    genre: 'Fantasy',
    isR18: false,
    premise: '',
    tags: [],
    characters: [createDefaultCharacter()],
    outline: [],
    chapters: {},
    storyboard: []
  });

  const configured = isProviderReady() && (aiProvider !== 'gemini' || hasSelectedKey);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900 overflow-hidden text-[11px]">
      <header className="h-10 border-b bg-white flex items-center justify-between px-3 z-50 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="bg-indigo-600 p-1 rounded-md text-white"><BookOpen size={14}/></div>
          <h1 className="font-black text-[9px] uppercase tracking-widest">Architect <span className="text-indigo-600">v2</span></h1>
        </div>
        <div className="flex gap-2 items-center">
          <select value={aiProvider} onChange={handleProviderChange} className="bg-slate-50 border rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest outline-none text-slate-600">
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
          </select>
          {!configured && <button onClick={handleOpenKeySelection} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase"><Key size={10} className="inline mr-1"/> Key</button>}
          <button onClick={() => save(novel)} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 text-[8px] font-black uppercase"><Save size={10} className="inline mr-1"/> Save</button>
          <button onClick={() => setShowConsultant(!showConsultant)} className={`p-1 rounded-md ${showConsultant ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-white'}`}><Search size={14}/></button>
        </div>
      </header>

      {error && <div className="bg-red-500 text-white px-3 py-1 flex justify-between items-center text-[8px] font-black uppercase z-[60] animate-in slide-in-from-top"><div className="flex items-center gap-1.5"><AlertTriangle size={10}/><span>{error}</span></div><button onClick={() => setError(null)}><X size={10}/></button></div>}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-12 lg:w-40 border-r bg-white flex flex-col p-1.5 space-y-1 z-40">
          {[
            { id: 'archive', icon: Library, label: 'Archive' },
            { id: 'ideate', icon: Sparkles, label: 'Ideate' },
            { id: 'style', icon: Users, label: 'Actors' },
            { id: 'write', icon: Wand2, label: 'Draft' },
            { id: 'storyboard', icon: ImageIcon, label: 'Visuals' }
          ].map(s => (
            <button key={s.id} onClick={() => setStep(s.id as AppStep)} className={`flex items-center gap-2 p-2 rounded-lg transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
              <s.icon size={16}/>
              <span className="hidden lg:block text-[8px] font-black uppercase tracking-wider">{s.label}</span>
            </button>
          ))}
          <div className="pt-2 border-t mt-2 flex-1 overflow-y-auto custom-scrollbar">
             {novel.outline.map((t: string, i: number) => (
                <button key={i} onClick={() => { setActiveChapter(i); setStep('write'); }} className={`w-full text-left px-2 py-1 rounded-md text-[8px] font-bold truncate transition-all ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  {i+1}. {t}
                </button>
             ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 bg-slate-50/20 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            {step === 'archive' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div onClick={() => { setNovel({ id: crypto.randomUUID(), title: 'Untethered Story', characters: [createDefaultCharacter()], outline: [], chapters: {}, storyboard: [], tags: [] }); setStep('ideate'); }} className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 group"><PlusCircle className="text-slate-200 group-hover:text-indigo-600" size={24}/><span className="text-[8px] font-black uppercase text-slate-300">New Project</span></div>
                {archive.map(item => (
                  <div key={item.id} onClick={() => { setNovel(item); setStep('write'); }} className="bg-white p-3 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer h-32 flex flex-col relative group">
                    <div className="flex justify-between items-start mb-1"><span className="text-[7px] font-black px-1 py-0.5 rounded bg-indigo-50 text-indigo-500 uppercase">{item.genre}</span><button onClick={(e) => { e.stopPropagation(); db.deleteNovel(item.id).then(loadNovels); }} className="text-slate-200 hover:text-red-500"><Trash2 size={10}/></button></div>
                    <h4 className="font-black text-xs mb-1 text-slate-800 line-clamp-1">{item.title}</h4>
                    <p className="text-[9px] text-slate-400 line-clamp-3 leading-tight">{item.generatedPremise || item.premise || "No premise..."}</p>
                    {item.isR18 && <Flame size={20} className="absolute bottom-2 right-2 text-red-100 opacity-20"/>}
                  </div>
                ))}
              </div>
            )}

            {step === 'ideate' && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
                  <div className="flex justify-between items-center"><h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-indigo-600"/> Ideation Lab</h2><button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-all ${novel.isR18 ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>R18 MODE</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Project Title</label><input type="text" value={novel.title} onChange={e => setNovel({...novel, title: e.target.value})} className="w-full text-lg font-black bg-slate-50 p-3 rounded-lg outline-none border focus:border-indigo-100"/></div>
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Main Genre</label><input type="text" value={novel.genre} onChange={e => setNovel({...novel, genre: e.target.value})} className="w-full text-lg font-black bg-slate-50 p-3 rounded-lg outline-none border focus:border-indigo-100"/></div>
                  </div>
                  <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Core Plot Hook</label><textarea value={novel.premise} onChange={e => setNovel({...novel, premise: e.target.value})} className="w-full h-24 bg-slate-50 p-3 rounded-lg outline-none text-[10px] resize-none border focus:border-indigo-100" placeholder="A brief spark of your story..."/></div>
                </div>

                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2"><Tags size={14} className="text-slate-400"/><h3 className="text-[9px] font-black uppercase text-slate-600">Project Metadata & Tags</h3></div>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(TAG_LIBRARIES).map(([category, tags]) => {
                      if (category === 'NSFW / R18 / Mature' && !novel.isR18) return null;
                      const isExpanded = expandedTagCategories.has(category);
                      
                      return (
                        <div key={category} className="border rounded-xl bg-slate-50/30 overflow-hidden transition-all">
                          <button 
                            onClick={() => toggleTagCategory(category)}
                            className="w-full p-3 flex items-center justify-between hover:bg-white transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              {category === 'NSFW / R18 / Mature' ? <Flame size={12} className="text-red-400"/> : <LibraryBig size={12} className="text-indigo-400"/>}
                              <h4 className="text-[8px] font-black uppercase text-slate-600 tracking-widest">{category}</h4>
                              <span className="text-[7px] text-slate-300 font-bold ml-1">({tags.length})</span>
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-slate-300"/> : <ChevronRight size={14} className="text-slate-300"/>}
                          </button>
                          
                          {isExpanded && (
                            <div className="p-4 pt-0 flex flex-wrap gap-1.5 animate-in slide-in-from-top-1">
                              {tags.map(tag => {
                                const active = (novel.tags || []).includes(tag);
                                return (
                                  <button 
                                    key={tag} 
                                    onClick={() => toggleTag(tag)}
                                    className={`px-2.5 py-1 rounded-md border text-[8px] font-black uppercase transition-all ${active ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                                  >
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button onClick={handleGenerateOutline} disabled={loading} className="w-full py-4 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-2">{loading ? 'Working...' : <><Cpu size={16}/> Architect Full Outline</>}</button>
              </div>
            )}

            {step === 'style' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h2 className="text-sm font-black uppercase tracking-widest">Actor Casting</h2><button onClick={() => { const nc = [...novel.characters, createDefaultCharacter()]; setNovel({...novel, characters: nc}); setExpandedCharacters(new Set(expandedCharacters).add(nc.length-1)); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-indigo-700 transition-all"><UserPlus size={14} className="inline mr-1"/> Add Actor</button></div>
                <div className="grid grid-cols-1 gap-3">
                  {novel.characters.map((c: any, i: number) => {
                    const expanded = expandedCharacters.has(i);
                    return (
                      <div key={i} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                        <div onClick={() => toggleExpand(i)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden shrink-0 border shadow-inner">{c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover"/> : <UserIcon size={18} className="m-auto text-slate-300 block mt-2.5"/>}</div>
                            <div className="flex flex-col">
                              <h4 className="font-black text-[11px] uppercase text-slate-700">{c.name || "New Actor"} 
                                <span className="text-[8px] text-indigo-400 ml-2 py-0.5 px-1.5 bg-indigo-50 rounded uppercase">{c.role}</span>
                              </h4>
                            </div>
                          </div>
                          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                        {expanded && (
                          <div className="p-6 border-t bg-slate-50/30 space-y-6 animate-in slide-in-from-top-2">
                             <div className="flex gap-6">
                                <div className="w-24 h-24 bg-white rounded-2xl border relative shrink-0 overflow-hidden shadow-md group">
                                  {c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover"/> : <UserIcon size={24} className="m-auto text-slate-200 mt-8 block"/>}
                                  <button onClick={() => handlePortrait(i)} className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><Palette size={20}/></button>
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="flex gap-3 items-center">
                                    <div className="flex-1 space-y-1">
                                      <input value={c.name} onChange={e => updateCharacterField(i, 'name', e.target.value)} className="font-black text-base bg-transparent border-b-2 border-transparent focus:border-indigo-200 w-full outline-none" placeholder="Name..."/>
                                      <div className="flex items-center gap-3 pt-1">
                                        <div className="space-y-0.5">
                                          <label className="text-[7px] font-black uppercase text-slate-400 block">Character Role</label>
                                          <select value={c.role} onChange={e => updateCharacterField(i, 'role', e.target.value)} className="bg-white border-2 border-slate-100 rounded-lg px-3 py-1 text-[8px] font-black uppercase outline-none focus:border-indigo-200 shadow-sm">
                                            {CHARACTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                    <button onClick={() => setShowLibrary({charIdx: i, type: 'archetype'})} className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-[8px] font-black uppercase whitespace-nowrap hover:bg-indigo-200 transition-colors">Voice Gallery</button>
                                  </div>
                                  <textarea value={c.description} onChange={e => updateCharacterField(i, 'description', e.target.value)} className="w-full bg-white p-3 rounded-xl text-[10px] h-16 border shadow-inner outline-none focus:border-indigo-200" placeholder="Backstory & Motivations..."/>
                                </div>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {FEATURE_GROUPS.map(group => {
                                 const isGroupOpen = openFeatureGroups[i] === group.name;
                                 return (
                                   <div key={group.name} className={`border rounded-xl bg-white overflow-hidden transition-all ${isGroupOpen ? 'md:col-span-2 shadow-md ring-1 ring-indigo-50' : ''}`}>
                                     <button onClick={() => toggleFeatureGroup(i, group.name)} className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50">
                                       <div className="flex items-center gap-2"><group.icon size={14} className="text-slate-400"/><span className="text-[9px] font-black uppercase text-slate-600">{group.name}</span></div>
                                       {isGroupOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                     </button>
                                     {isGroupOpen && (
                                       <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                                         {group.fields.map(field => (
                                           <div key={field} className="space-y-1">
                                             <div className="flex justify-between items-center"><label className="text-[7px] font-black uppercase text-slate-300">{field}</label><button onClick={() => setShowLibrary({charIdx: i, type: 'feature', field})} className="text-indigo-300 hover:text-indigo-500"><Plus size={10}/></button></div>
                                             <input value={c[field] || ''} onChange={e => updateCharacterField(i, field, e.target.value)} className="w-full bg-slate-50 p-2 rounded-lg text-[9px] font-medium outline-none border focus:border-indigo-200 transition-all" placeholder="..."/>
                                           </div>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                 );
                               })}
                             </div>

                             <div className="space-y-3 pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-indigo-600"><Heart size={14}/><label className="text-[9px] font-black uppercase tracking-widest">Kinks & Dynamics</label></div><button onClick={() => addCharacterDynamic(i)} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase hover:bg-indigo-100 transition-colors">Add Dynamic</button></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {(c.dynamics || []).map((dyn: any, dIdx: number) => (
                                    <div key={dIdx} className="bg-white p-3 rounded-xl border flex flex-col gap-2 relative group shadow-sm">
                                      <button onClick={() => removeCharacterDynamic(i, dIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                                      <div className="flex items-center gap-2"><LinkIcon size={12} className="text-slate-400"/><input value={dyn.type} onChange={e => updateCharacterDynamic(i, dIdx, 'type', e.target.value)} className="bg-transparent font-bold text-[10px] w-full outline-none border-b-2 border-transparent focus:border-indigo-100" placeholder="Type (e.g. Rivals, Soulmates)"/></div>
                                      <textarea value={dyn.context} onChange={e => updateCharacterDynamic(i, dIdx, 'context', e.target.value)} className="w-full bg-slate-50 p-2 rounded-lg text-[9px] h-12 outline-none shadow-inner resize-none" placeholder="Context & specific tension..."/>
                                    </div>
                                  ))}
                                </div>
                             </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 'write' && (
              <div className="flex flex-col gap-4 h-[85vh]">
                <div className="flex-1 bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden relative">
                  <div className="p-4 border-b bg-slate-50/30 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3"><div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-md">{activeChapter + 1}</div><h3 className="font-black text-[10px] truncate max-w-xs uppercase tracking-wider">{novel.outline[activeChapter] || "Untitled Beat"}</h3></div>
                    <button onClick={() => handleDraft(activeChapter)} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase flex items-center gap-2 transition-all hover:bg-indigo-700 shadow-md"><Zap size={14}/> {loading ? 'Drafting...' : 'Draft Prose'}</button>
                  </div>
                  <textarea value={novel.chapters[activeChapter] || ""} onChange={e => setNovel({...novel, chapters: {...novel.chapters, [activeChapter]: e.target.value}})} className="flex-1 p-8 text-[13px] leading-relaxed outline-none font-serif resize-none custom-scrollbar" placeholder="LET THE NARRATIVE BEGIN..."/>
                  <div className="p-3 border-t bg-slate-50/30 flex justify-between shadow-inner">
                    <button onClick={() => setActiveChapter(Math.max(0, activeChapter - 1))} disabled={activeChapter === 0} className="px-4 py-2 bg-white border rounded-xl text-[9px] font-black uppercase disabled:opacity-30 hover:bg-slate-50 transition-colors">Previous Chapter</button>
                    <button onClick={() => setActiveChapter(Math.min(novel.outline.length-1, activeChapter + 1))} disabled={activeChapter >= novel.outline.length-1} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-30 hover:bg-slate-800 transition-colors">Next Chapter</button>
                  </div>
                </div>
              </div>
            )}

            {step === 'storyboard' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h2 className="text-sm font-black uppercase tracking-widest">Storyboard</h2><button onClick={handleMoodboard} disabled={!isProviderReady()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-indigo-700">Render Visuals</button></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {novel.storyboard?.map((s: any) => (
                    <div key={s.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm group relative hover:shadow-md transition-all">
                      <img src={s.url} className="w-full h-40 object-cover" />
                      <div className="p-3"><p className="text-[9px] font-bold text-slate-400 italic line-clamp-2">"{s.prompt}"</p></div>
                      <button onClick={() => setNovel({...novel, storyboard: novel.storyboard.filter((i:any) => i.id !== s.id)})} className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {showConsultant && (
          <aside className="fixed inset-y-0 right-0 w-72 bg-white border-l shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b bg-slate-900 text-white flex justify-between items-center shadow-md"><div className="flex items-center gap-2"><Search size={14}/><h3 className="font-black uppercase text-[9px] tracking-widest">Consultant</h3></div><button onClick={() => setShowConsultant(false)}><X size={20}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] p-3 rounded-2xl text-[10px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-700'}`}>{m.text}</div></div>
              ))}
            </div>
            <div className="p-4 border-t bg-white flex gap-2 shadow-inner"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConsult()} className="flex-1 bg-slate-50 p-2.5 rounded-xl text-[10px] outline-none border focus:border-indigo-100"/><button onClick={handleConsult} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"><Send size={14}/></button></div>
          </aside>
        )}

        {showLibrary && (
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white"><div><h3 className="text-xs font-black uppercase tracking-widest">Architectural Library</h3><p className="text-[8px] font-bold text-indigo-100 uppercase">{showLibrary.field || "Voice Gallery"}</p></div><button onClick={() => setShowLibrary(null)}><X size={20}/></button></div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                {showLibrary.type === 'archetype' ? (
                  Object.entries(DIALOGUE_ARCHETYPES).map(([category, archetypes]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-[8px] font-black uppercase text-slate-300 border-b-2 border-slate-50 pb-1 tracking-widest">{category}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {archetypes.map((arch, idx) => (
                          <div key={idx} onClick={() => applyArchetype(showLibrary.charIdx, arch)} className="bg-slate-50 p-4 rounded-2xl border-2 border-transparent hover:border-indigo-200 hover:bg-white cursor-pointer group flex flex-col gap-2 transition-all shadow-sm hover:shadow-md"><h5 className="font-black text-[10px] group-hover:text-indigo-600 uppercase">{arch.name}</h5><p className="text-[9px] font-serif italic text-slate-500 line-clamp-3">"{arch.example}"</p></div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {(PHYSICAL_LIBRARIES[showLibrary.field!] || []).map(option => (
                      <button key={option} onClick={() => applyFeature(showLibrary.charIdx, showLibrary.field!, option)} className="p-3 bg-slate-50 border-2 border-transparent rounded-xl text-[8px] font-black uppercase text-slate-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-slate-50/50 flex justify-end"><button onClick={() => setShowLibrary(null)} className="px-6 py-2 bg-white border-2 rounded-xl text-[9px] font-black uppercase shadow-sm">Close Library</button></div>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="fixed inset-0 z-[1000] bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in"><div className="bg-white p-8 rounded-2xl shadow-2xl border flex flex-col items-center gap-3"><Loader2 className="animate-spin text-indigo-600" size={32}/><p className="text-[9px] font-black uppercase text-slate-400 animate-pulse tracking-widest">{loadingMessage}</p></div></div>}
    </div>
  );
};

export default App;