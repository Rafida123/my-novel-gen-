
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, MessageSquarePlus, 
  Library, Save, History, Users, Palette, Tag as TagIcon, 
  Flame, Cpu, ExternalLink, X, UserPlus, User as UserIcon, 
  Volume2, ImageIcon, RotateCcw, CheckCircle2, Send, Wind, Settings2, Fingerprint, Activity,
  PlusCircle, ShieldCheck, Sword, HeartHandshake, Zap, Heart, Scissors, PersonStanding, Highlighter, 
  Eye, Type as FontIcon, BrainCircuit, Info, Upload, Trash2, Ruler, ScanFace, AlertTriangle, Zap as EnergyIcon
} from 'lucide-react';

import { Novel, AppStep, ChatMessage, Character, Revision } from './types.ts';
import * as ai from './services/groqService.ts';
import * as db from './services/dbService.ts';
import { AiEngine } from './services/groqService.ts';

// --- CONSTANTS ---
const GENRES = ["Straight Romance", "Yaoi (B×B)", "Lesbian (G×G)", "BDSM / Kink", "Dark Romance", "Fantasy Romance", "Sci-Fi Romance", "Reverse Harem", "Omegaverse"];
const VIBES = ["Flirty", "Seductive", "Obsessive", "Forbidden", "Slow Burn", "Enemies to Lovers", "Sweet", "Angst", "Gritty", "Dark", "Cozy"];
const ARCHETYPES = ["Stoic", "Neurotic", "Caring", "Aggressive", "Playful", "Calculating", "Innocent", "Cynical", "Melancholic", "Optimistic", "Rebellious", "Disciplined"];
const POV_STYLES = ["First Person", "Third Person Limited", "Third Person Omniscient", "Epistolary", "Second Person"];
const EBOOK_STYLES = ["Classic Serif", "Modern Clean", "Gothic Dark", "Playful Script", "Cinematic Wide"];

// --- SHARED UI COMPONENTS ---
const Chip = ({ label, active, onClick, variant = 'indigo' }: { label: string, active: boolean, onClick: () => void, variant?: 'indigo' | 'orange' | 'emerald' | 'red' | 'white' | 'ghost' | 'slate' | 'zinc' }) => {
  const colors = {
    indigo: active ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100',
    orange: active ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-slate-400 border-slate-100',
    emerald: active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-100',
    red: active ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-white text-slate-300 border-slate-50',
    white: active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200',
    ghost: active ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-50 hover:text-slate-600',
    slate: active ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-400 border-slate-100',
    zinc: active ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' : 'bg-white text-zinc-400 border-zinc-100'
  };
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border-2 ${colors[variant]}`}>
      {label}
    </button>
  );
};

const SectionHeader = ({ title, icon: Icon, children }: { title: string, icon: any, children?: React.ReactNode }) => (
  <div className="flex justify-between items-center mb-6">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Icon size={16}/></div>
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</h3>
    </div>
    {children}
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('archive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Architecting...");
  const [activeChapter, setActiveChapter] = useState(0);
  const [archive, setArchive] = useState<Novel[]>([]);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [editingCharIndex, setEditingCharIndex] = useState<number | null>(null);
  const [aiEngine, setAiEngine] = useState<AiEngine>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [novel, setNovel] = useState<Novel>({
    id: crypto.randomUUID(),
    title: 'Untethered Draft',
    lastModified: Date.now(),
    genre: 'Fantasy Romance',
    isR18: false,
    premise: '',
    tone: [],
    tags: [],
    novelStyle: 'Third Person Limited',
    ebookStyle: 'Classic Serif',
    characters: [{ 
      name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [], kinkContexts: {}, 
      physicalBody: [], physicalHair: [], physicalMarkers: [], physicalEyes: '', physicalSkin: '', physicalHeight: '', physicalBuild: '' 
    }],
    generatedPremise: '',
    outline: [],
    chapters: {},
    revisions: {},
    aiSuggestions: {},
    storyboard: []
  });

  useEffect(() => {
    db.getAllNovels().then(setArchive).catch(console.error);
  }, []);

  const save = async (updated: Novel) => {
    const novelWithTs = { ...updated, lastModified: Date.now() };
    await db.saveNovel(novelWithTs);
    setArchive(prev => [novelWithTs, ...prev.filter(n => n.id !== updated.id)]);
    setNovel(novelWithTs);
  };

  const handleCreateNew = () => {
    const fresh: Novel = {
      id: crypto.randomUUID(),
      title: 'New Manuscript',
      lastModified: Date.now(),
      genre: 'Fantasy Romance',
      isR18: false,
      premise: '',
      tone: [],
      tags: [],
      novelStyle: 'Third Person Limited',
      ebookStyle: 'Classic Serif',
      characters: [{ 
        name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [], kinkContexts: {}, 
        physicalBody: [], physicalHair: [], physicalMarkers: [], physicalEyes: '', physicalSkin: '', physicalHeight: '', physicalBuild: '' 
      }],
      generatedPremise: '',
      outline: [],
      chapters: {},
      revisions: {},
      aiSuggestions: {},
      storyboard: []
    };
    setNovel(fresh);
    setStep('ideate');
  };

  const handleError = (e: any) => {
    const errStr = JSON.stringify(e).toLowerCase();
    if (errStr.includes("quota") || errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("limit")) {
      setError("Quota Exhausted: Too many requests. Try switching AI Engine to Groq.");
    } else if (errStr.includes("auth")) {
      setError("Authentication Failed: Check your API keys in the environment.");
    } else {
      setError(`Architectural Error: ${e.message || "Unknown failure."}`);
    }
  };

  const handleGenerateOutline = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage(`Architecting Premise & Outline via ${aiEngine.toUpperCase()}...`);
    try {
      const data = await ai.generateOutline(novel, aiEngine);
      const updated = { ...novel, generatedPremise: data.premise, outline: data.outline };
      await save(updated);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChapter = async (idx: number, directive = "") => {
    setLoading(true);
    setError(null);
    try {
      const lastMemoryRaw = novel.aiSuggestions[idx - 1]?.[0];
      let memory = null;
      if (lastMemoryRaw && lastMemoryRaw.startsWith("MEMORY: ")) {
        try {
          memory = JSON.parse(lastMemoryRaw.replace("MEMORY: ", ""));
        } catch(e) { /* ignore */ }
      }

      setLoadingMessage(`Drafting Narrative via ${aiEngine.toUpperCase()}...`);
      const draft = await ai.generateDraftChapter(idx, novel, directive, memory, aiEngine);
      
      setLoadingMessage("Polishing Prose Structure...");
      const polished = await ai.polishChapterContent(draft || "", novel, aiEngine);

      const currentText = novel.chapters[idx];
      const updatedRevisions = { ...novel.revisions };
      if (currentText) {
        const rev: Revision = { id: crypto.randomUUID(), timestamp: Date.now(), content: currentText, label: "Previous Draft" };
        updatedRevisions[idx] = [rev, ...(updatedRevisions[idx] || [])].slice(0, 10);
      }
      
      const finalContent = polished || draft || "";
      const updated = { ...novel, chapters: { ...novel.chapters, [idx]: finalContent }, revisions: updatedRevisions };
      await save(updated);
      
      handleExtractMemory(idx, finalContent);
      setActiveChapter(idx);
      setStep('write');
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractMemory = async (idx: number, text: string) => {
    try {
      const memory = await ai.generateStoryMemory(text, aiEngine);
      if (memory) {
        const formattedMem = [`MEMORY: ${JSON.stringify(memory)}`];
        const updated = { ...novel, aiSuggestions: { ...novel.aiSuggestions, [idx]: formattedMem } };
        await save(updated);
      }
    } catch (e) {
      console.warn("Memory extraction failed", e);
    }
  };

  const handleGenerateCharPortrait = async (idx: number) => {
    setLoading(true);
    setLoadingMessage("Rendering Character Portrait...");
    try {
      const char = novel.characters[idx];
      const url = await ai.generateCharacterPortrait(char, novel);
      if (url) {
        const chars = [...novel.characters];
        chars[idx].imageUrl = url;
        setNovel({ ...novel, characters: chars });
        await save({ ...novel, characters: chars });
      }
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPortrait = (event: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const chars = [...novel.characters];
        chars[idx].imageUrl = reader.result as string;
        setNovel({ ...novel, characters: chars });
        save({ ...novel, characters: chars });
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePhysicalField = (idx: number, field: keyof Character, value: string) => {
    const chars = [...novel.characters];
    const char = { ...chars[idx] };
    (char[field] as any) = value;
    chars[idx] = char;
    setNovel({ ...novel, characters: chars });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Protagonist': return <ShieldCheck size={36}/>;
      case 'Antagonist':
      case 'Villain': return <Sword size={36}/>;
      case 'Love Interest': return <Heart size={36}/>;
      case 'Rival':
      case 'Love Rival': return <Zap size={36}/>;
      case 'Mentor': return <HeartHandshake size={36}/>;
      default: return <UserIcon size={36}/>;
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-slate-900 overflow-hidden selection:bg-indigo-100">
      {/* ERROR TOAST */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="bg-white border-2 border-red-500/20 shadow-2xl rounded-[2rem] p-6 flex items-start gap-4">
             <div className="bg-red-50 text-red-600 p-3 rounded-2xl"><AlertTriangle size={20}/></div>
             <div className="flex-1">
               <h5 className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-1">Architectural Fault</h5>
               <p className="text-xs font-bold text-slate-600 leading-relaxed">{error}</p>
             </div>
             <button onClick={() => setError(null)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={16}/></button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-16 border-b bg-white/80 backdrop-blur-md sticky top-0 z-[100] px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><BookOpen size={18}/></div>
          <h1 className="font-black text-xs uppercase tracking-[0.3em]">NovlGen <span className="text-indigo-600">Architect</span></h1>
        </div>
        
        {/* ENGINE TOGGLE */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border">
          <Chip label="Auto" active={aiEngine === 'auto'} onClick={() => setAiEngine('auto')} variant="white" />
          <Chip label="Gemini" active={aiEngine === 'gemini'} onClick={() => setAiEngine('gemini')} variant="indigo" />
          <Chip label="Groq/Llama" active={aiEngine === 'groq'} onClick={() => setAiEngine('groq')} variant="zinc" />
        </div>

        <div className="flex items-center gap-2">
          {step !== 'archive' && (
            <button onClick={() => save(novel)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 transition-all">
              <Save size={14}/> Save Progress
            </button>
          )}
          <button onClick={() => setShowBrainstorm(!showBrainstorm)} className={`p-2.5 rounded-xl transition-all ${showBrainstorm ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-slate-900 text-white'}`}>
            <MessageSquarePlus size={18}/>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* NAV RAIL */}
        <aside className="w-20 lg:w-64 border-r bg-white flex flex-col p-4 space-y-2 z-40 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
          {[
            { id: 'archive', icon: Library, label: 'Manuscripts' },
            { id: 'ideate', icon: Sparkles, label: 'Ideation Lab' },
            { id: 'style', icon: Users, label: 'Casting Ledger' },
            { id: 'write', icon: Wand2, label: 'Architect Studio' },
            { id: 'storyboard', icon: ImageIcon, label: 'Moodboard' }
          ].map(s => (
            <button key={s.id} onClick={() => setStep(s.id as AppStep)} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}>
              <s.icon size={20}/>
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">{s.label}</span>
            </button>
          ))}
          <div className="pt-8 border-t mt-4 flex-1">
             <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-4 mb-3">Blueprint Structure</p>
             <div className="space-y-1 overflow-y-auto max-h-[50vh] custom-scrollbar pr-2">
                {novel.outline.map((t, i) => (
                  <button key={i} onClick={() => { setActiveChapter(i); setStep('write'); }} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold truncate transition-all ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>
                    {i+1}. {t}
                  </button>
                ))}
             </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar bg-slate-50/30">
          <div className="max-w-5xl mx-auto w-full">
            
            {/* ARCHIVE VIEW */}
            {step === 'archive' && (
              <div className="space-y-10 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">The Archive</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Stored Manuscripts ({archive.length})</p>
                  </div>
                  <button onClick={handleCreateNew} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <PlusCircle size={14}/> Start New Architecture
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archive.map(n => (
                    <div key={n.id} onClick={() => { setNovel(n); setStep('write'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group">
                      <div className="flex justify-between mb-6">
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${n.isR18 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>{n.genre}</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{new Date(n.lastModified).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-black text-xl mb-3 text-slate-800 group-hover:text-indigo-600 transition-colors">{n.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-medium">{n.generatedPremise || n.premise}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IDEATION LAB */}
            {step === 'ideate' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-xl space-y-12">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black uppercase tracking-[0.2em] flex items-center gap-4 text-slate-800"><Sparkles className="text-indigo-600"/> Architecture Lab</h2>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Active Core</span>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border">
                           <Chip label="Auto" active={aiEngine === 'auto'} onClick={() => setAiEngine('auto')} variant="white" />
                           <Chip label="Gemini" active={aiEngine === 'gemini'} onClick={() => setAiEngine('gemini')} variant="indigo" />
                           <Chip label="Groq" active={aiEngine === 'groq'} onClick={() => setAiEngine('groq')} variant="zinc" />
                        </div>
                      </div>
                      <div className="h-10 w-px bg-slate-100" />
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${novel.isR18 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>Unfiltered Mode (R18)</span>
                        <button 
                          onClick={() => setNovel(prev => ({ ...prev, isR18: !prev.isR18 }))}
                          className={`w-14 h-7 rounded-full transition-all relative ${novel.isR18 ? 'bg-red-500 shadow-inner' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${novel.isR18 ? 'left-8' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="space-y-6">
                      <SectionHeader title="Core Genre" icon={Palette}/>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {GENRES.map(g => <Chip key={g} label={g} active={novel.genre === g} onClick={() => setNovel({...novel, genre: g})}/>)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <SectionHeader title="Narrative Perspective" icon={Eye}/>
                        <div className="flex flex-wrap gap-2">
                          {POV_STYLES.map(p => <Chip key={p} label={p} active={novel.novelStyle === p} onClick={() => setNovel({...novel, novelStyle: p})} variant="white"/>)}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <SectionHeader title="Ebook Aesthetic" icon={FontIcon}/>
                        <div className="flex flex-wrap gap-2">
                          {EBOOK_STYLES.map(e => <Chip key={e} label={e} active={novel.ebookStyle === e} onClick={() => setNovel({...novel, ebookStyle: e})} variant="white"/>)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <SectionHeader title="Narrative Seed" icon={Cpu}/>
                      <textarea 
                        value={novel.premise} 
                        onChange={(e) => setNovel({...novel, premise: e.target.value})}
                        className="w-full h-40 p-8 bg-slate-50 rounded-[2.5rem] outline-none font-medium text-lg border-2 border-transparent focus:border-indigo-100 transition-all resize-none shadow-inner"
                        placeholder="Type the core concept of your masterpiece here..."
                      />
                    </div>
                    <button 
                      onClick={handleGenerateOutline}
                      disabled={loading}
                      className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.01]"
                    >
                      {loading ? <Loader2 className="animate-spin"/> : <Cpu/>} Initialize Architect Framework
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CASTING LEDGER */}
            {step === 'style' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500">
                 <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Casting Ledger</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Defined Archetypes ({novel.characters.length})</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newChar: Character = { 
                          name: 'New Entity', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [], kinkContexts: {}, 
                          physicalBody: [], physicalHair: [], physicalMarkers: [], physicalEyes: '', physicalSkin: '', physicalHeight: '', physicalBuild: '' 
                        };
                        setNovel({...novel, characters: [...novel.characters, newChar]});
                        setEditingCharIndex(novel.characters.length);
                      }} 
                      className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-2"
                    >
                      <UserPlus size={16}/> Recruit Character
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {novel.characters.map((char, idx) => (
                      <div key={idx} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden">
                        {editingCharIndex === idx ? (
                           <div className="space-y-10">
                              <div className="bg-white p-8 rounded-3xl border-2 border-slate-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] space-y-10">
                                <div className="flex gap-8 items-start">
                                   <div className="w-32 h-32 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex-shrink-0 relative overflow-hidden group/portrait transition-all hover:border-indigo-200">
                                      {char.imageUrl ? (
                                        <>
                                          <img src={char.imageUrl} className="w-full h-full object-cover" />
                                          <button 
                                            onClick={() => {
                                              const chars = [...novel.characters];
                                              chars[idx].imageUrl = undefined;
                                              setNovel({...novel, characters: chars});
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover/portrait:opacity-100 transition-opacity"
                                          >
                                            <Trash2 size={12}/>
                                          </button>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                          <UserIcon size={32}/>
                                          <span className="text-[8px] font-black uppercase">No Portrait</span>
                                        </div>
                                      )}
                                   </div>
                                   <div className="flex-1 space-y-4">
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Entity Designation</label>
                                        <input 
                                          value={char.name}
                                          onChange={(e) => {
                                            const chars = [...novel.characters]; chars[idx].name = e.target.value;
                                            setNovel({...novel, characters: chars});
                                          }}
                                          className="w-full text-2xl font-black outline-none border-b-2 border-indigo-50 focus:border-indigo-600 py-2 transition-all bg-white"
                                          placeholder="Enter Name..."
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                         <button onClick={() => handleGenerateCharPortrait(idx)} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 transition-all"><Sparkles size={14}/> AI Portrait</button>
                                         <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase border border-slate-100 hover:bg-slate-100 transition-all"><Upload size={14}/> Upload</button>
                                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleUploadPortrait(e, idx)} />
                                      </div>
                                   </div>
                                </div>
                                <div className="space-y-4">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Narrative Framework Role</label>
                                  <div className="flex flex-wrap gap-2">
                                    {["Protagonist", "Antagonist", "Love Interest", "Rival", "Mentor"].map(r => <Chip key={r} label={r} active={char.role === r} onClick={() => { const chars = [...novel.characters]; chars[idx].role = r; setNovel({...novel, characters: chars}); }} variant="white" />)}
                                  </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                  <button onClick={() => setEditingCharIndex(null)} className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-3 font-black text-[11px] uppercase tracking-widest"><CheckCircle2 size={20}/> Save Dossier</button>
                                </div>
                              </div>

                              <div className="space-y-10 px-2">
                                <SectionHeader title="Physical Anatomy" icon={PersonStanding}/>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2"><Eye size={10}/> Eye Profile</label>
                                    <input 
                                      value={char.physicalEyes || ''}
                                      onChange={(e) => updatePhysicalField(idx, 'physicalEyes', e.target.value)}
                                      className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-medium outline-none border border-transparent focus:border-indigo-100 transition-all shadow-inner"
                                      placeholder="Color, shape, intensity..."
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2"><ScanFace size={10}/> Skin Profile</label>
                                    <input 
                                      value={char.physicalSkin || ''}
                                      onChange={(e) => updatePhysicalField(idx, 'physicalSkin', e.target.value)}
                                      className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-medium outline-none border border-transparent focus:border-indigo-100 transition-all shadow-inner"
                                      placeholder="Tone, texture..."
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2"><Ruler size={10}/> Height & Stature</label>
                                    <input 
                                      value={char.physicalHeight || ''}
                                      onChange={(e) => updatePhysicalField(idx, 'physicalHeight', e.target.value)}
                                      className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-medium outline-none border border-transparent focus:border-indigo-100 transition-all shadow-inner"
                                      placeholder="Height (e.g. 6'2, petite)..."
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2"><PersonStanding size={10}/> Frame Detail</label>
                                    <input 
                                      value={char.physicalBuild || ''}
                                      onChange={(e) => updatePhysicalField(idx, 'physicalBuild', e.target.value)}
                                      className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-medium outline-none border border-transparent focus:border-indigo-100 transition-all shadow-inner"
                                      placeholder="Specifics (e.g. broad shoulders)..."
                                    />
                                  </div>
                                </div>
                              </div>
                           </div>
                        ) : (
                          <div className="cursor-pointer group h-full flex flex-col" onClick={() => setEditingCharIndex(idx)}>
                            <div className="flex justify-between items-start mb-8">
                              <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-sm overflow-hidden">
                                {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" /> : getRoleIcon(char.role)}
                              </div>
                              <div className="text-right">
                                <h4 className="text-2xl font-black text-slate-800">{char.name || "Unnamed Entity"}</h4>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${char.role === 'Protagonist' ? 'text-indigo-500' : char.role === 'Antagonist' || char.role === 'Villain' ? 'text-red-500' : 'text-slate-400'}`}>{char.role}</span>
                              </div>
                            </div>
                            <div className="flex-1 mb-8">
                               <p className="text-xs text-slate-400 font-medium italic line-clamp-2 leading-relaxed mb-4">"{char.description || "No sensory essence established."}"</p>
                               <div className="flex flex-wrap gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  {char.physicalEyes && <span className="text-[8px] font-black uppercase text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-md">Eyes: {char.physicalEyes}</span>}
                                  {char.physicalHeight && <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{char.physicalHeight}</span>}
                               </div>
                            </div>
                            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"><Settings2 size={18} className="text-slate-200 hover:text-indigo-600 transition-colors"/></div>
                          </div>
                        )}
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {/* Studio Workspace */}
            {step === 'write' && (
              <div className="animate-in slide-in-from-right-10 duration-500">
                <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden min-h-[80vh] flex flex-col">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-xl">{activeChapter+1}</div>
                      <div>
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-tight">{novel.outline[activeChapter]}</h3>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowRevisions(!showRevisions)} title="Continuity & Revisions" className={`p-3 rounded-xl transition-all ${showRevisions ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-400'}`}><History size={20}/></button>
                      <button onClick={() => handleGenerateChapter(activeChapter)} disabled={loading} className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 transition-all hover:rotate-180 duration-500"><RotateCcw size={20}/></button>
                    </div>
                  </div>
                  <div className="relative flex-1 flex">
                    <textarea 
                      value={novel.chapters[activeChapter] || ""}
                      onChange={(e) => { const chapters = { ...novel.chapters, [activeChapter]: e.target.value }; setNovel({ ...novel, chapters }); }}
                      className="flex-1 p-16 text-2xl leading-relaxed font-serif outline-none resize-none bg-transparent selection:bg-indigo-100"
                      placeholder="The architect's canvas is blank. Begin the narrative..."
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODALS AND LOADERS */}
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
              <div className="relative bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-4">
                   <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg animate-bounce">
                     <EnergyIcon size={10} className="text-yellow-400" /> Powered by {aiEngine.toUpperCase()}
                   </div>
                   <Loader2 className="animate-spin text-indigo-600" size={48}/>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">{loadingMessage}</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
