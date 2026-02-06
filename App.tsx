
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, MessageSquarePlus, Send, 
  PenTool, Users, Settings2, UserPlus, X, Palette, Flame, 
  ChevronRight, ChevronLeft, HeartPulse, Menu, RotateCcw, 
  Lightbulb, CheckCircle2, History, Zap, Download, BookMarked,
  Trash2, Mic2, MessageSquareQuote, Tag as TagIcon, Wind, Library,
  Save, PlusCircle, Calendar, Clock, BrainCircuit, Heart, Ghost,
  HandMetal, Check, Search, ArrowUpDown, Filter, Activity, Layers,
  Scissors, ZapOff, Timer, Cpu, MessageSquare, Brain
} from 'lucide-react';
import { Novel, AppStep, ChatMessage, Character } from './types.ts';
import { 
  generateOutline, 
  generateChapterContent, 
  getAiSuggestions, 
  chatWithConsultant,
  AIProvider
} from './services/geminiService.ts';
import * as db from './services/dbService.ts';

const genreOptions = ['Straight Romance', 'Yaoi (B×B)', 'Lesbian (G×G)', 'BDSM / Kink', 'Dark Romance', 'Fantasy Romance', 'Sci-Fi Romance', 'Reverse Harem', 'Omegaverse'];
const atmosphereOptions = {
  "Vibe": ['Flirty', 'Seductive', 'Obsessive', 'Forbidden', 'Slow Burn', 'Enemies to Lovers', 'Sweet', 'Angst', 'Gritty', 'Dark', 'Cozy'],
  "Intensity": ['Steamy', 'Smut', 'Vanilla', 'Hardcore', 'Sensual'],
  "Mood": ['Erotic', 'Dirty Flirty', 'Melancholic', 'Whimsical', 'High-Stakes', 'Tense', 'Poetic']
};
const tagOptions = [
  'Oral Sex', 'Cunnilingus', 'Fellatio', 'Anal Play', 'BDSM', 'Bondage', 'Domination', 'Submission', 'Aftercare', 'First Time', 'Secret Relationship', 'Power Dynamics', 'Age Gap', 'Size Difference', 'Body Worship'
];
const dialoguePresets = [
  'Sarcastic & Blunt', 'Formal & Poetic', 'Soft-Spoken & Shy', 'Arrogant & Commanding', 'Uses Heavy Slang', 'Playful & Teasing', 'Stoic & Minimalist', 'Warm & Nurturing', 'Rough & Dirty', 'Quietly Intense'
];
const personalityPresets = [
  'Stoic', 'Neurotic', 'Caring', 'Aggressive', 'Playful', 'Calculating', 'Innocent', 'Cynical', 'Melancholic', 'Optimistic', 'Rebellious', 'Disciplined'
];
const expressionPresets = [
  'Vocal & Needy', 'Breathless Whispers', 'Deep Groans', 'Silent & Intense', 'Pleading', 'Commanding', 'Animalistic', 'Soft Whimpers', 'Frequent Dirty Talk', 'Crying with Pleasure', 'Rolling Eyes (Intense)', 'Deeply Moany', 'Highly Expressive'
];
const kinkPresets = [
  'Oral Sex', 'Cunnilingus', 'BDSM', 'Impact Play', 'Exhibitionism', 'Praise/Degradation', 'Overstimulation', 'Mirror Play', 'Wax Play', 'Edge Play', 'Breath Play', 'Roleplay', 'Consensual Non-Consent'
];

const LEGACY_STORAGE_KEY = 'novlgen_architect_archive';

type SortOption = 'newest' | 'oldest' | 'title-az' | 'title-za';

const App: React.FC = () => {
  // --- UI STATE ---
  const [step, setStep] = useState<AppStep>('archive'); 
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [customDirective, setCustomDirective] = useState("");
  const [activeChapter, setActiveChapter] = useState(0);
  const [archive, setArchive] = useState<Novel[]>([]);

  // --- CHAPTER CHOREOGRAPHY STATE ---
  const [sceneBlueprint, setSceneBlueprint] = useState("");
  const [intimacyPace, setIntimacyPace] = useState<'Teasing' | 'Rushed' | 'Slow-Burn' | 'Urgent' | 'None'>('None');
  const [intimacyDynamic, setIntimacyDynamic] = useState<'Multiple Orgasms' | 'Overstimulation' | 'Sweet/Tender' | 'Primal/Rough' | 'Standard' | 'None'>('None');

  // --- ARCHIVE FILTER/SORT STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGenre, setFilterGenre] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // --- STORY STATE ---
  const [novel, setNovel] = useState<Novel>({
    id: crypto.randomUUID(),
    title: 'Untitled Project',
    lastModified: Date.now(),
    genre: 'Straight Romance',
    isR18: false,
    premise: 'A shy florist meets a mysterious musician at a summer festival.',
    tone: ['Emotional', 'Flirty'], 
    tags: [],
    novelStyle: 'Third Person Limited',
    ebookStyle: 'Modern Serif',
    characters: [
      { 
        name: 'Elara', 
        role: 'Protagonist', 
        description: 'Quiet, observational, smells like lavender and rain.', 
        dialogueStyles: ['Soft-Spoken & Shy'],
        personality: ['Caring'],
        expressions: ['Soft Whimpers'],
        kinks: ['Praise/Degradation']
      }
    ],
    generatedPremise: '',
    outline: [],
    chapters: {},
    aiSuggestions: {} 
  });

  // --- INITIALIZATION & MIGRATION ---
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          const parsed: Novel[] = JSON.parse(legacyData);
          for (const n of parsed) {
            await db.saveNovel(n);
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        const storedNovels = await db.getAllNovels();
        setArchive(storedNovels);
      } catch (e) {
        console.error("Storage initialization failed", e);
      }
    };
    initializeStorage();
  }, []);

  // --- COMPUTED ARCHIVE ---
  const filteredAndSortedArchive = useMemo(() => {
    let result = [...archive];
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(lowerSearch) || 
        n.premise.toLowerCase().includes(lowerSearch)
      );
    }
    if (filterGenre !== "All") {
      result = result.filter(n => n.genre === filterGenre);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return b.lastModified - a.lastModified;
        case 'oldest': return a.lastModified - b.lastModified;
        case 'title-az': return a.title.localeCompare(b.title);
        case 'title-za': return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
    return result;
  }, [archive, searchTerm, filterGenre, sortBy]);

  // --- PERSISTENCE HELPERS ---
  const saveToArchive = async (updatedNovel: Novel) => {
    try {
      await db.saveNovel(updatedNovel);
      setArchive(prev => {
        const filtered = prev.filter(n => n.id !== updatedNovel.id);
        return [updatedNovel, ...filtered];
      });
    } catch (e) {
      console.error("Failed to save to database", e);
    }
  };

  const deleteFromArchive = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this manuscript?")) return;
    try {
      await db.deleteNovel(id);
      setArchive(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error("Failed to delete from database", e);
    }
  };

  const startNewProject = () => {
    const newNovel: Novel = {
      id: crypto.randomUUID(),
      title: 'New Manuscript',
      lastModified: Date.now(),
      genre: 'Straight Romance',
      isR18: false,
      premise: '',
      tone: [], 
      tags: [],
      novelStyle: 'Third Person Limited',
      ebookStyle: 'Modern Serif',
      characters: [
        { name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }
      ],
      generatedPremise: '',
      outline: [],
      chapters: {},
      aiSuggestions: {} 
    };
    setNovel(newNovel);
    setStep('ideate');
  };

  const loadNovel = (n: Novel) => {
    setNovel(n);
    setActiveChapter(0);
    setStep(n.outline.length > 0 ? 'write' : 'ideate');
  };

  // --- HANDLERS ---
  const handleGenerateOutline = async () => {
    setLoading(true);
    try {
      const data = await generateOutline(novel, provider);
      const updated = { 
        ...novel, 
        generatedPremise: data.premise, 
        outline: data.outline,
        lastModified: Date.now(),
        title: data.outline[0] || novel.title
      };
      setNovel(updated);
      await saveToArchive(updated);
    } catch (err) {
      console.error(err);
      alert("AI Generation failed. Check console and API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChapter = async (index: number, isRegen: boolean = false, directive: string = "") => {
    setLoading(true);
    let finalDirective = directive;
    if (sceneBlueprint.trim()) finalDirective += `\nREQUIRED SCENES: ${sceneBlueprint}`;
    if (intimacyPace !== 'None' || intimacyDynamic !== 'None') {
      finalDirective += `\nINTIMACY BLUEPRINT: 
        ${intimacyPace !== 'None' ? `- Pace: ${intimacyPace}` : ''}
        ${intimacyDynamic !== 'None' ? `- Dynamic: ${intimacyDynamic}` : ''}
      `;
    }

    try {
      const text = await generateChapterContent(index, novel, isRegen, finalDirective, provider);
      const updatedChapters = { ...novel.chapters, [index]: text || "" };
      let updatedSuggestions = { ...novel.aiSuggestions };
      
      if (index < 11 && text) {
        const suggs = await getAiSuggestions(text, novel.outline[index + 1], provider);
        updatedSuggestions[index] = suggs;
      }

      const updatedNovel = {
        ...novel,
        chapters: updatedChapters,
        aiSuggestions: updatedSuggestions,
        lastModified: Date.now()
      };
      
      setNovel(updatedNovel);
      await saveToArchive(updatedNovel);
      setActiveChapter(index);
      setStep('write');
      setCustomDirective("");
    } catch (err) {
      console.error(err);
      alert("Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleTone = (t: string) => {
    setNovel(p => ({
      ...p, 
      tone: p.tone.includes(t) ? p.tone.filter(x => x !== t) : [...p.tone, t]
    }));
  };

  const toggleTag = (tag: string) => {
    setNovel(p => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter(x => x !== tag) : [...p.tags, tag]
    }));
  };

  const updateCharacter = (idx: number, field: keyof Character, value: any) => {
    const chars = [...novel.characters];
    chars[idx] = { ...chars[idx], [field]: value };
    setNovel(p => ({ ...p, characters: chars }));
  };

  const toggleCharList = (charIdx: number, field: 'dialogueStyles' | 'personality' | 'expressions' | 'kinks', item: string) => {
    setNovel(prev => {
      const newChars = [...prev.characters];
      const list = newChars[charIdx][field] as string[];
      const newList = list.includes(item) 
        ? list.filter(s => s !== item) 
        : [...list, item];
      newChars[charIdx] = { ...newChars[charIdx], [field]: newList };
      return { ...prev, characters: newChars };
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistory(p => [...p, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await chatWithConsultant(msg, novel.generatedPremise, provider);
      setChatHistory(p => [...p, { role: 'ai', text: res || "No advice found." }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportText = (n: Novel = novel) => {
    const content = Object.values(n.chapters).join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${n.genre.replace(/\s+/g, '_')}_Draft.txt`;
    a.click();
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans flex flex-col">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b px-4 py-3 md:px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200"><BookOpen size={20} /></div>
            <h1 className="text-sm font-[900] uppercase tracking-tighter">Architect <span className="text-indigo-600">Studio</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {/* PROVIDER TOGGLE */}
           <div className="hidden md:flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mr-2">
              <button 
                onClick={() => setProvider('gemini')} 
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${provider === 'gemini' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Architect
              </button>
              <button 
                onClick={() => setProvider('groq')} 
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${provider === 'groq' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Cerebro
              </button>
           </div>
           
           {step !== 'archive' && (
             <button onClick={() => { saveToArchive(novel); alert("Manuscript checked into the archive."); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-100">
               <Save size={16} /> Save
             </button>
           )}
           <button onClick={() => exportText()} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-100 transition-all"><Download size={18} /></button>
           <button onClick={() => setShowBrainstorm(!showBrainstorm)} className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200"><MessageSquarePlus size={18} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r flex flex-col p-6 transition-transform lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:static lg:block'}`}>
          <div className="space-y-1 mb-10">
            {[
              { id: 'archive', icon: Library, label: 'The Archive' },
              { id: 'ideate', icon: Sparkles, label: 'Ideation' },
              { id: 'style', icon: Settings2, label: 'Cast & Style' },
              { id: 'write', icon: Wand2, label: 'Studio' }
            ].map(s => (
              <button 
                key={s.id} 
                onClick={() => { setStep(s.id as AppStep); setMobileMenuOpen(false); }} 
                className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
              >
                <s.icon size={16} /> {s.label}
              </button>
            ))}
          </div>

          {step !== 'archive' && novel.outline.length > 0 && (
             <div className="flex-1 overflow-y-auto custom-scrollbar">
               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={12}/> Storyline</p>
               <div className="space-y-1">
                 {novel.outline.map((t, i) => (
                   <button 
                    key={i} 
                    onClick={() => { setActiveChapter(i); setStep('write'); }} 
                    className={`w-full text-left p-3 rounded-xl text-[10px] font-bold transition-all border group ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'text-slate-400 border-transparent hover:bg-slate-50'}`}
                   >
                     <div className="flex flex-col gap-0.5">
                       <span className="text-[7px] opacity-40 uppercase">Ch. {i + 1}</span>
                       <span className="truncate">{t}</span>
                       {novel.chapters[i] && <div className="mt-1 w-full h-0.5 bg-indigo-500 rounded-full" />}
                     </div>
                   </button>
                 ))}
               </div>
             </div>
          )}
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full pb-20">
            
            {/* STEP 0: THE ARCHIVE */}
            {step === 'archive' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">The Archive</h2>
                    <p className="text-slate-400 text-sm font-medium mt-1">Manage your collection of AI-crafted manuscripts.</p>
                  </div>
                  <button onClick={startNewProject} className="flex items-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                    <PlusCircle size={20} /> Create New Work
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedArchive.map((item) => (
                    <div key={item.id} onClick={() => loadNovel(item)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-full relative">
                      <div className="flex items-center justify-between mb-6">
                         <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">{item.genre}</span>
                         <button onClick={(e) => deleteFromArchive(item.id, e)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors truncate">{item.title}</h4>
                      <p className="text-xs font-medium text-slate-400 line-clamp-3 mb-8 flex-1 leading-relaxed">
                        {item.generatedPremise || item.premise || "No premise drafted yet."}
                      </p>
                      <div className="pt-6 border-t border-slate-50 flex items-center justify-between mt-auto">
                         <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                           <Calendar size={12}/> {formatDate(item.lastModified)}
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-slate-200">
                              {Object.keys(item.chapters).length}
                            </div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1: IDEATE */}
            {step === 'ideate' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 md:p-12 space-y-12">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className={`p-3 rounded-2xl transition-all ${provider === 'groq' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      <Cpu size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Active Engine</p>
                      <p className="text-sm font-black uppercase">{provider === 'groq' ? 'Llama 3.3 70B (Groq)' : 'Gemini 3 Flash'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Sub-Genre Perspective</label>
                        <div className="grid grid-cols-2 gap-2">
                          {genreOptions.map(g => (
                            <button key={g} onClick={() => setNovel({...novel, genre: g})} className={`text-left px-4 py-3 rounded-2xl text-[10px] font-black border transition-all ${novel.genre === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{g}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center gap-2"><Palette size={12}/> Vibe & Tone</label>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {Object.entries(atmosphereOptions).map(([category, options]) => (
                            <div key={category} className="space-y-2">
                              <p className="text-[8px] font-bold text-slate-300 uppercase">{category}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {options.map(t => (
                                  <button key={t} onClick={() => toggleTone(t)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${novel.tone.includes(t) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-100'}`}>{t}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center gap-2"><TagIcon size={12}/> Content Tags</label>
                        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          {tagOptions.map(tag => (
                            <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-[9px] font-black border transition-all ${novel.tags.includes(tag) ? 'bg-white text-indigo-600 border-indigo-100 shadow-sm' : 'bg-transparent text-slate-400 border-transparent hover:border-slate-200'}`}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4">
                        <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-full p-6 rounded-[2rem] border-2 transition-all group flex items-center justify-between ${novel.isR18 ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          <div className="text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest block">Unfiltered Mode (R18)</span>
                            <span className="text-[9px] font-bold opacity-60">Allows explicit content</span>
                          </div>
                          <Flame size={20} className={novel.isR18 ? 'text-red-500 animate-pulse' : 'text-slate-300'} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Original Concept</label>
                    <textarea value={novel.premise} onChange={(e) => setNovel({...novel, premise: e.target.value})} className="w-full p-8 rounded-[2.5rem] border-2 border-slate-50 bg-slate-50 text-lg font-medium min-h-[150px] outline-none focus:border-indigo-100 focus:bg-white transition-all shadow-inner" placeholder="Tell the architect your story's soul..." />
                  </div>

                  <button onClick={handleGenerateOutline} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-2xl">
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Map the Narrative Arc
                  </button>

                  {novel.generatedPremise && (
                    <div className="p-10 bg-indigo-50/50 rounded-[3rem] border border-indigo-100 animate-in slide-in-from-bottom-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2"><BookMarked size={14}/> The Blueprint</h4>
                      <p className="text-slate-800 leading-relaxed font-semibold text-xl mb-10 whitespace-pre-wrap">{novel.generatedPremise}</p>
                      <button onClick={() => setStep('style')} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl uppercase text-sm">Proceed to Cast <ChevronRight size={18}/></button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: STYLE & CAST */}
            {step === 'style' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm space-y-12">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3"><Users className="text-indigo-600" /> Casting Ledger</h2>
                    <button onClick={() => setNovel(p => ({ ...p, characters: [...p.characters, { name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }] }))} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all shadow-lg">
                      <UserPlus size={14}/> New Character
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-12">
                    {novel.characters.map((char, idx) => (
                      <div key={idx} className="p-8 md:p-12 bg-slate-50/50 rounded-[3rem] border border-slate-100 relative group transition-all hover:bg-white hover:shadow-xl space-y-10">
                        <button onClick={() => { if (novel.characters.length <= 1) return; setNovel(p => ({ ...p, characters: p.characters.filter((_, i) => i !== idx) })); }} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={22} />
                        </button>
                        
                        {/* CHARACTER IDENTITY */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Identity Name</label>
                             <input value={char.name} onChange={(e) => updateCharacter(idx, 'name', e.target.value)} placeholder="e.g., Sebastian Vance" className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Narrative Role</label>
                             <select value={char.role} onChange={(e) => updateCharacter(idx, 'role', e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm">
                               <option>Protagonist</option>
                               <option>Love Interest</option>
                               <option>Antagonist</option>
                               <option>Side Character</option>
                               <option>Catalyst</option>
                             </select>
                          </div>
                        </div>

                        {/* CHARACTER DESCRIPTION */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Physicality & Essence</label>
                          <textarea value={char.description} onChange={(e) => updateCharacter(idx, 'description', e.target.value)} placeholder="Describe their physicality, scent, flaws, and secrets..." className="w-full p-6 bg-white rounded-[2rem] border border-transparent focus:border-indigo-100 outline-none text-xs min-h-[140px] shadow-sm resize-none leading-relaxed" />
                        </div>

                        {/* PERSONALITY TRAITS */}
                        <div className="space-y-4">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2"><Brain size={12} className="text-indigo-400"/> Core Persona Archetypes</label>
                          <div className="flex flex-wrap gap-2">
                            {personalityPresets.map(trait => (
                              <button 
                                key={trait} 
                                onClick={() => toggleCharList(idx, 'personality', trait)} 
                                className={`px-4 py-2 rounded-xl text-[9px] font-black border transition-all ${char.personality.includes(trait) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}
                              >
                                {trait}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* DIALOGUE VOICE */}
                        <div className="space-y-4">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2"><MessageSquare size={12} className="text-indigo-400"/> Dialogue & Voice Tone</label>
                          <div className="flex flex-wrap gap-2">
                            {dialoguePresets.map(voice => (
                              <button 
                                key={voice} 
                                onClick={() => toggleCharList(idx, 'dialogueStyles', voice)} 
                                className={`px-4 py-2 rounded-xl text-[9px] font-black border transition-all ${char.dialogueStyles.includes(voice) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}
                              >
                                {voice}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* INTIMATE PROFILE (FLAME LAYER) */}
                        <div className={`p-8 rounded-[2.5rem] border transition-all space-y-8 ${novel.isR18 ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-100/50 border-slate-200'}`}>
                           <div className="flex items-center gap-2">
                             <div className={`p-2 rounded-lg ${novel.isR18 ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}><Flame size={16}/></div>
                             <p className={`text-[10px] font-black uppercase tracking-widest ${novel.isR18 ? 'text-rose-600' : 'text-slate-400'}`}>Intimate Behavioral Profile</p>
                           </div>

                           <div className="space-y-6">
                              <div className="space-y-3">
                                <label className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Vocal & Sensory Expressions</label>
                                <div className="flex flex-wrap gap-2">
                                  {expressionPresets.map(expr => (
                                    <button 
                                      key={expr} 
                                      onClick={() => toggleCharList(idx, 'expressions', expr)} 
                                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black border transition-all ${char.expressions.includes(expr) ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-100'}`}
                                    >
                                      {expr}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] ml-1">Kinks & Desired Dynamics</label>
                                <div className="flex flex-wrap gap-2">
                                  {kinkPresets.map(kink => (
                                    <button 
                                      key={kink} 
                                      onClick={() => toggleCharList(idx, 'kinks', kink)} 
                                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black border transition-all ${char.kinks.includes(kink) ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-100'}`}
                                    >
                                      {kink}
                                    </button>
                                  ))}
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => handleGenerateChapter(0)} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                    {loading ? <Loader2 className="animate-spin" /> : <PenTool size={20} />} Commit Cast to Studio
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: WRITING STUDIO */}
            {step === 'write' && (
              <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col overflow-hidden min-h-[85vh]">
                  <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-lg ${provider === 'groq' ? 'bg-rose-600' : 'bg-slate-900'}`}>{activeChapter + 1}</div>
                      <div>
                        <h3 className="font-black text-slate-900 text-lg">{novel.outline[activeChapter]}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">{provider === 'groq' ? 'Llama 3.3 Engine' : 'Gemini Engine'}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleGenerateChapter(activeChapter, true, "")} disabled={loading} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-100 text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                      {loading ? <Loader2 size={14} className="animate-spin"/> : <RotateCcw size={14}/>} Rewrite
                    </button>
                  </div>
                  <textarea 
                    value={novel.chapters[activeChapter] || ""} 
                    onChange={(e) => {
                      const updated = { ...novel, chapters: { ...novel.chapters, [activeChapter]: e.target.value }, lastModified: Date.now() };
                      setNovel(updated);
                    }}
                    className="flex-1 p-10 md:p-16 text-xl leading-[1.8] outline-none font-serif font-medium resize-none bg-transparent selection:bg-indigo-100"
                    placeholder="The ink begins to flow..."
                    style={{ minHeight: '60vh' }}
                  />
                  <div className="p-8 border-t bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
                    <button disabled={activeChapter === 0} onClick={() => setActiveChapter(activeChapter - 1)} className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-100 font-black text-[10px] uppercase text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all"><ChevronLeft size={16}/> Back</button>
                    <button 
                      onClick={() => {
                        const next = activeChapter + 1;
                        if (novel.chapters[next]) setActiveChapter(next);
                        else handleGenerateChapter(next, false, "");
                      }} 
                      disabled={activeChapter === 11 || loading}
                      className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 font-black text-[10px] uppercase text-white hover:bg-indigo-700 shadow-xl disabled:opacity-50 transition-all"
                    >
                      {loading ? "Constructing..." : "Bridge Next Chapter"} <ChevronRight size={16}/>
                    </button>
                  </div>
                </div>

                {/* SIDEBAR TOOLS */}
                <div className="w-full xl:w-96 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-8 border-b border-indigo-50 pb-4">
                      <Lightbulb size={14}/> Continuity Spark
                    </h4>
                    <div className="space-y-4">
                      {novel.aiSuggestions[activeChapter]?.map((s, i) => (
                        <div key={i} className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 text-[11px] font-semibold text-slate-700 leading-relaxed flex gap-3 animate-in fade-in slide-in-from-top-2">
                           <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" /> {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-2"><Mic2 size={14}/> Narrator Directives</p>
                     <div className="space-y-6">
                        <textarea value={sceneBlueprint} onChange={(e) => setSceneBlueprint(e.target.value)} placeholder="Key plot points for this scene..." className="w-full p-4 bg-white/5 rounded-2xl text-[11px] font-semibold outline-none border border-white/10 focus:border-indigo-400 transition-all placeholder:text-white/20 min-h-[80px] resize-none" />
                        <div className="relative">
                           <textarea value={customDirective} onChange={(e) => setCustomDirective(e.target.value)} placeholder="Tone adjustment or prose directive..." className="w-full p-4 bg-white/5 rounded-2xl text-[11px] font-semibold outline-none border border-white/10 focus:border-indigo-400 transition-all placeholder:text-white/20 min-h-[80px] resize-none pr-12" />
                           <button onClick={() => handleGenerateChapter(activeChapter, true, customDirective)} disabled={loading} className="absolute right-3 bottom-3 p-3 bg-indigo-500 rounded-xl text-white hover:bg-indigo-400 transition-all shadow-lg">
                              <Send size={14} />
                           </button>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* CONSULTANT CHAT (BRAINSTORM) */}
        {showBrainstorm && (
          <aside className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white border-l shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 p-2 rounded-xl"><Wand2 size={18}/></div>
                <h3 className="font-black uppercase tracking-widest text-xs">Architect AI Consultant</h3>
              </div>
              <button onClick={() => setShowBrainstorm(false)} className="p-2 text-white/50 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50 custom-scrollbar">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] p-6 rounded-[2rem] text-[13px] font-medium leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && <div className="text-[10px] font-black uppercase text-indigo-500 animate-pulse tracking-widest">Architect is thinking...</div>}
            </div>
            <div className="p-8 border-t bg-white">
              <div className="relative">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} className="w-full pl-6 pr-16 py-5 bg-slate-50 rounded-[2rem] text-[13px] font-semibold outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition-all shadow-inner" placeholder="Ask for advice..." />
                <button onClick={sendChatMessage} className="absolute right-2 top-2 p-4 bg-slate-900 text-white rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-lg"><Send size={18} /></button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* SYNC FOOTER */}
      <footer className="bg-white/80 backdrop-blur-md border-t px-8 py-3 text-[9px] font-[900] text-slate-300 uppercase tracking-[0.4em] flex justify-between items-center z-50">
        <div className="flex gap-12">
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" /> ARCHIVE SECURED</div>
          <div className="hidden md:block">LOC: {activeChapter + 1} / 12 CHAPTERS</div>
          <div className="flex items-center gap-2 text-indigo-500">
            <Cpu size={10} /> ENGINE: {provider.toUpperCase()}
          </div>
        </div>
        <div className="text-indigo-600 flex items-center gap-2">VER: 09.2025.A</div>
      </footer>
    </div>
  );
};

export default App;
