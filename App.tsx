import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, Library, Save, Users, Palette, 
  Flame, Cpu, ExternalLink, X, UserPlus, User as UserIcon, 
  Send, Wind, Trash2, PlusCircle, Search, Zap, ImageIcon, Key, AlertTriangle, Settings, Check, Fingerprint, Tags, Heart, ShieldAlert, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';

import { Novel, AppStep } from './types.ts';
import * as ai from './services/aiService.ts';
import * as db from './services/dbService.ts';

const PERSONALITY_TRAITS = [
  'Stoic', 'Neurotic', 'Caring', 'Aggressive', 'Playful', 'Calculating', 
  'Innocent', 'Cynical', 'Melancholic', 'Optimistic', 'Rebellious', 'Disciplined'
];

const DIALOGUE_STYLES = [
  'Sarcastic & Blunt', 'Formal & Poetic', 'Soft-Spoken & Shy', 'Arrogant & Commanding', 
  'Uses Heavy Slang', 'Playful & Teasing', 'Stoic & Minimalist', 'Warm & Nurturing', 
  'Rough & Dirty', 'Quietly Intense'
];

const SUB_GENRES = [
  'Straight Romance', 'Yaoi (B×B)', 'Lesbian (G×G)', 'BDSM / Kink', 
  'Dark Romance', 'Fantasy Romance', 'Sci-Fi Romance', 'Reverse Harem', 'Omegaverse'
];

const MOOD_TONES = [
  'Flirty', 'Seductive', 'Obsessive', 'Forbidden', 'Slow Burn', 'Enemies to Lovers', 
  'Sweet', 'Angst', 'Gritty', 'Dark', 'Cozy', 'Steamy', 'Smut', 'Vanilla', 
  'Hardcore', 'Sensual', 'Erotic', 'Dirty Flirty', 'Melancholic', 'Whimsical', 
  'High-Stakes', 'Tense', 'Poetic'
];

const CONTENT_TAGS = [
  'Oral Sex', 'Cunnilingus', 'Fellatio', 'Anal Play', 'BDSM', 'Bondage', 
  'Rape/Non-con', 'Dub-con', 'Exhibitionism', 'Voyeurism', 'Domination', 
  'Submission', 'Aftercare', 'First Time', 'Secret Relationship', 
  'Power Dynamics', 'Age Gap', 'Size Difference', 'Body Worship'
];

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
  const [providerReady, setProviderReady] = useState(true);

  // Check if provider has a valid key
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
      const key = prompt("Paste your Groq API Key (starts with gsk_):");
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

  const toggleTrait = (charIdx: number, trait: string) => {
    const newChars = [...novel.characters];
    const currentTraits = newChars[charIdx].personality || [];
    newChars[charIdx] = {
      ...newChars[charIdx],
      personality: currentTraits.includes(trait) 
        ? currentTraits.filter((t: string) => t !== trait) 
        : [...currentTraits, trait]
    };
    setNovel({ ...novel, characters: newChars });
  };

  const toggleDialogueStyle = (charIdx: number, style: string) => {
    const newChars = [...novel.characters];
    const currentStyles = newChars[charIdx].dialogueStyles || [];
    newChars[charIdx] = {
      ...newChars[charIdx],
      dialogueStyles: currentStyles.includes(style) 
        ? currentStyles.filter((s: string) => s !== style) 
        : [...currentStyles, style]
    };
    setNovel({ ...novel, characters: newChars });
  };

  const toggleIdeationTag = (field: 'subGenres' | 'tone' | 'kinks' | 'contentTags', tag: string) => {
    const current = novel[field] || [];
    const updated = current.includes(tag) 
      ? current.filter((t: string) => t !== tag) 
      : [...current, tag];
    setNovel({ ...novel, [field]: updated });
  };

  const updateCharacterField = (idx: number, field: string, value: string) => {
    const nc = [...novel.characters];
    nc[idx] = { ...nc[idx], [field]: value };
    setNovel({...novel, characters: nc});
  };

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedCharacters);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedCharacters(next);
  };

  const wrapAiCall = async (task: () => Promise<void>, msg: string) => {
    setError(null);
    setLoadingMessage(msg);
    setLoading(true);
    try {
      await task();
    } catch (e: any) {
      console.error("AI Error:", e);
      const errMsg = e.message || String(e);
      if (errMsg.includes("MISSING") || errMsg.includes("401") || errMsg.includes("INVALID_GROQ_KEY") || errMsg.includes("Unauthorized")) {
        setError(`${aiProvider.toUpperCase()} setup required. Tap 'Setup Key' in the header.`);
        setProviderReady(false);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOutline = () => {
    // Check if key is missing first
    if (!isProviderReady()) {
      handleOpenKeySelection();
      return;
    }

    if (!novel.premise || novel.premise.trim().length < 10) {
      setError("Please enter a more detailed premise in the Lab first (at least 10 chars).");
      setStep('ideate');
      return;
    }
    wrapAiCall(async () => {
      const res = await ai.generateOutline(novel);
      await save({ ...novel, generatedPremise: res.premise, outline: res.outline });
    }, "Architecting Full Structure...");
  };

  const handleDraft = (idx: number) => {
    // Check if key is missing first
    if (!isProviderReady()) {
      handleOpenKeySelection();
      return;
    }

    if (!novel.outline || novel.outline.length === 0) {
      setError("Please generate a story outline in the Ideation Lab first.");
      setStep('ideate');
      return;
    }

    wrapAiCall(async () => {
      let memory = null;
      if (idx > 0 && novel.chapters[idx - 1]) {
        try {
          memory = await ai.generateStoryMemory(novel.chapters[idx - 1]);
        } catch (e) {
          console.warn("Continuity check failed", e);
        }
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

  const createDefaultCharacter = () => ({
    name: 'New Character',
    role: 'Major',
    description: '',
    personality: [],
    dialogueStyles: [],
    hairColor: '',
    eyeColor: '',
    bodyType: '',
    distinguishingFeatures: ''
  });

  const [novel, setNovel] = useState<any>({
    id: crypto.randomUUID(),
    title: 'New Story',
    lastModified: Date.now(),
    genre: 'Fantasy Romance',
    isR18: false,
    premise: '',
    tone: [],
    subGenres: [],
    kinks: [],
    contentTags: [],
    tags: [],
    novelStyle: 'Third Person Limited',
    characters: [createDefaultCharacter()],
    generatedPremise: '',
    outline: [],
    chapters: {},
    storyboard: []
  });

  const configured = isProviderReady() && (aiProvider !== 'gemini' || hasSelectedKey);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-slate-900 overflow-hidden">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><BookOpen size={20}/></div>
          <h1 className="font-black text-xs uppercase tracking-widest">Architect <span className="text-indigo-600">Studio</span></h1>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-1.5 shadow-sm">
            <Settings size={14} className="text-slate-400" />
            <select 
              value={aiProvider} 
              onChange={handleProviderChange}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer text-slate-600"
            >
              <option value="gemini">Gemini (Studio)</option>
              <option value="groq">Groq (SDK)</option>
            </select>
          </div>

          {!configured && (
            <button onClick={handleOpenKeySelection} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shadow-sm">
              <Key size={14}/> Setup {aiProvider.toUpperCase()}
            </button>
          )}
          {step !== 'archive' && (
            <button onClick={() => save(novel)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black uppercase tracking-widest">
              <Save size={16}/> Save
            </button>
          )}
          <button onClick={() => setShowConsultant(!showConsultant)} className={`p-2.5 rounded-xl transition-all ${showConsultant ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-900 text-white hover:bg-black'}`}>
            <Search size={20}/>
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500 text-white px-6 py-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest z-[60] shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14}/>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-600 rounded transition-colors"><X size={14}/></button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-20 lg:w-64 border-r bg-white flex flex-col p-4 space-y-2 z-40">
          {[
            { id: 'archive', icon: Library, label: 'Archive' },
            { id: 'ideate', icon: Sparkles, label: 'Ideation' },
            { id: 'style', icon: Users, label: 'Characters' },
            { id: 'write', icon: Wand2, label: 'Manuscript' },
            { id: 'storyboard', icon: ImageIcon, label: 'Storyboard' }
          ].map(s => (
            <button 
              key={s.id} 
              onClick={() => setStep(s.id as AppStep)} 
              className={`flex items-center gap-3 p-4 rounded-2xl transition-all relative ${step === s.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <s.icon size={20}/>
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">{s.label}</span>
            </button>
          ))}
          <div className="pt-8 border-t mt-4 flex-1 overflow-y-auto custom-scrollbar">
             {novel.outline.map((t: string, i: number) => (
                <button key={i} onClick={() => { setActiveChapter(i); setStep('write'); }} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold truncate transition-all ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  {i+1}. {t}
                </button>
             ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/20 custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full">
            {step === 'archive' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                <div onClick={() => { setNovel({ id: crypto.randomUUID(), title: 'Untethered Story', characters: [createDefaultCharacter()], outline: [], chapters: {}, storyboard: [], subGenres: [], tone: [], kinks: [], contentTags: [] }); setStep('ideate'); }} className="h-64 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 transition-all group">
                  <PlusCircle className="text-slate-200 group-hover:text-indigo-600" size={48}/><span className="text-[10px] font-black uppercase text-slate-300">New Story</span>
                </div>
                {archive.map(item => (
                  <div key={item.id} onClick={() => { setNovel(item); setStep('write'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group h-64 flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-black px-2 py-1 rounded-full bg-indigo-50 text-indigo-500 uppercase">{item.genre}</span>
                      <button onClick={(e) => { e.stopPropagation(); db.deleteNovel(item.id).then(loadNovels); }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                    </div>
                    <h4 className="font-black text-xl mb-3 text-slate-800 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed">{item.generatedPremise || item.premise || "No premise yet..."}</p>
                    {item.isR18 && <div className="absolute bottom-6 right-6 text-red-100 opacity-20"><Flame size={48}/></div>}
                  </div>
                ))}
              </div>
            )}

            {step === 'ideate' && (
              <div className="bg-white p-12 rounded-[3.5rem] shadow-xl space-y-12 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black uppercase tracking-widest">Ideation</h2>
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                    <span className={`text-[9px] font-black uppercase ${novel.isR18 ? 'text-red-500' : 'text-slate-400'}`}>R18 MODE</span>
                    <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-12 h-6 rounded-full relative transition-all ${novel.isR18 ? 'bg-red-500 shadow-md' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${novel.isR18 ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Novel Title</label>
                    <input type="text" value={novel.title} onChange={e => setNovel({...novel, title: e.target.value})} className="w-full text-2xl font-black bg-slate-50 p-6 rounded-3xl outline-none focus:ring-2 ring-indigo-100 transition-all" placeholder="Enter title..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Premise / Plot Spark</label>
                    <textarea value={novel.premise} onChange={e => setNovel({...novel, premise: e.target.value})} className="w-full h-48 bg-slate-50 p-8 rounded-[2.5rem] outline-none text-lg resize-none shadow-inner focus:bg-white transition-all" placeholder="Explain your core idea..." />
                  </div>

                  <button 
                    onClick={handleGenerateOutline} 
                    disabled={loading} 
                    className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 ${
                      !isProviderReady() 
                      ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100' 
                      : 'bg-slate-900 text-white hover:bg-indigo-600'
                    }`}
                  >
                    <Cpu size={20}/> 
                    {loading ? 'Architecting...' : (isProviderReady() ? 'Construct Outline' : 'Setup Required to Continue')}
                  </button>
                </div>
              </div>
            )}

            {step === 'style' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-end">
                  <h2 className="text-3xl font-black">Characters</h2>
                  <button onClick={() => {
                    const newChars = [...novel.characters, createDefaultCharacter()];
                    setNovel({...novel, characters: newChars});
                    setExpandedCharacters(new Set(expandedCharacters).add(newChars.length - 1));
                  }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition flex items-center gap-2"><UserPlus size={16}/> Add Character</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {novel.characters.map((c: any, i: number) => {
                    const expanded = expandedCharacters.has(i);
                    return (
                      <div key={i} className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${expanded ? 'shadow-xl ring-2 ring-indigo-50' : 'shadow-sm'}`}>
                        <div onClick={() => toggleExpand(i)} className="p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors group">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                            {c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover"/> : <UserIcon size={20} className="text-slate-300"/>}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-black text-sm uppercase tracking-wider text-slate-700">{c.name || "Unnamed"}</h4>
                            <p className="text-[9px] font-black uppercase text-slate-400">{c.personality?.join(', ') || 'No traits yet'}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); const nc = [...novel.characters]; nc.splice(i, 1); setNovel({...novel, characters: nc}); }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><Trash2 size={16}/></button>
                          {expanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </div>

                        {expanded && (
                          <div className="p-8 border-t border-slate-50 space-y-8 animate-in slide-in-from-top-2">
                             <div className="flex flex-col md:flex-row gap-8">
                                <div className="w-32 h-32 bg-slate-50 rounded-2xl border flex items-center justify-center overflow-hidden group/port relative">
                                  {c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover"/> : <UserIcon size={40} className="text-slate-200"/>}
                                  <button onClick={() => handlePortrait(i)} className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover/port:opacity-100 flex items-center justify-center text-white transition-all"><Palette size={24}/></button>
                                </div>
                                <div className="flex-1 space-y-4">
                                  <input value={c.name} onChange={e => updateCharacterField(i, 'name', e.target.value)} className="font-black text-2xl w-full bg-transparent outline-none" placeholder="Name..."/>
                                  <textarea value={c.description} onChange={e => updateCharacterField(i, 'description', e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl outline-none resize-none text-sm h-24" placeholder="Character bio..."/>
                                </div>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Personality Traits</label>
                                  <div className="flex flex-wrap gap-2">
                                    {PERSONALITY_TRAITS.map(t => {
                                      const isSelected = (c.personality || []).includes(t);
                                      return (
                                        <button key={t} onClick={() => toggleTrait(i, t)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Dialogue Styles</label>
                                  <div className="flex flex-wrap gap-2">
                                    {DIALOGUE_STYLES.map(s => {
                                      const isSelected = (c.dialogueStyles || []).includes(s);
                                      return (
                                        <button key={s} onClick={() => toggleDialogueStyle(i, s)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}>{s}</button>
                                      );
                                    })}
                                  </div>
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
              <div className="flex flex-col gap-8 h-[80vh] animate-in slide-in-from-right-4">
                <div className="flex-1 bg-white rounded-[3.5rem] border shadow-2xl flex flex-col overflow-hidden relative">
                  <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">{activeChapter + 1}</div>
                      <h3 className="font-black text-lg truncate max-w-xs">{novel.outline[activeChapter] || "Unnamed Section"}</h3>
                    </div>
                    <button 
                      onClick={() => handleDraft(activeChapter)} 
                      disabled={loading} 
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                        (!isProviderReady() || novel.outline.length === 0) 
                          ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      <Zap size={14}/> 
                      {novel.outline.length === 0 ? 'Needs Outline' : (isProviderReady() ? 'Draft' : 'Setup Required')}
                    </button>
                  </div>
                  <textarea 
                    value={novel.chapters[activeChapter] || ""} 
                    onChange={e => setNovel({...novel, chapters: {...novel.chapters, [activeChapter]: e.target.value}})} 
                    className="flex-1 p-12 text-xl leading-relaxed outline-none font-serif font-medium resize-none custom-scrollbar" 
                    placeholder="The story begins..." 
                  />
                  <div className="p-8 border-t bg-slate-50/50 flex justify-between gap-4">
                    <button onClick={() => setActiveChapter(Math.max(0, activeChapter - 1))} disabled={activeChapter === 0} className="px-6 py-3 bg-white border rounded-xl text-[10px] font-black uppercase disabled:opacity-30">Prev Beat</button>
                    <button onClick={() => setActiveChapter(Math.min(novel.outline.length-1, activeChapter + 1))} disabled={activeChapter >= novel.outline.length - 1 || novel.outline.length === 0} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-30">Next Beat</button>
                  </div>
                </div>
              </div>
            )}

            {step === 'storyboard' && (
              <div className="space-y-8 animate-in zoom-in-95">
                <div className="flex justify-between items-end">
                  <h2 className="text-3xl font-black">Storyboard</h2>
                  <button onClick={handleMoodboard} disabled={!isProviderReady()} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg disabled:opacity-50">Generate Visual</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {novel.storyboard?.map((s: any) => (
                    <div key={s.id} className="bg-white rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-xl group relative transition-all">
                      <img src={s.url} className="w-full h-48 object-cover" />
                      <div className="p-4"><p className="text-[10px] font-bold text-slate-400 italic line-clamp-2">"{s.prompt}"</p></div>
                      <button onClick={() => setNovel({...novel, storyboard: novel.storyboard.filter((i:any) => i.id !== s.id)})} className="absolute top-4 right-4 p-2 bg-white/80 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {showConsultant && (
          <aside className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-indigo-400"/>
                <h3 className="font-black uppercase tracking-widest text-[10px]">Architect Bot</h3>
              </div>
              <button onClick={() => setShowConsultant(false)} className="hover:text-indigo-400 transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 custom-scrollbar">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-xs leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-700'}`}>
                    {m.text}
                    {/* Render grounding sources if available as required by Gemini API guidelines */}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                        <p className="text-[9px] font-black uppercase text-slate-400">Sources</p>
                        {m.links.map((link: any, li: number) => (
                          <a key={li} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors group/link">
                            <ExternalLink size={10}/>
                            <span className="truncate group-hover/link:underline text-[10px]">{link.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-white flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConsult()} className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none text-xs border focus:border-indigo-100" placeholder="Ask anything..." />
              <button onClick={handleConsult} disabled={!chatInput.trim()} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-lg"><Send size={18}/></button>
            </div>
          </aside>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-6">
            <Loader2 className="animate-spin text-indigo-600" size={48}/>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;