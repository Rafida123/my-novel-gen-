
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, MessageSquarePlus, Send, 
  PenTool, Users, Settings2, UserPlus, X, Palette, Flame, 
  ChevronRight, ChevronLeft, HeartPulse, Menu, RotateCcw, 
  Lightbulb, CheckCircle2, History, Zap, Download, BookMarked,
  Trash2, Mic2, MessageSquareQuote, Tag as TagIcon, Wind, Library,
  Save, PlusCircle, Calendar, Clock, BrainCircuit, Heart, Ghost,
  HandMetal, Check, Search, ArrowUpDown, Filter, Activity, Layers,
  Scissors, ZapOff, Timer
} from 'lucide-react';
import { Novel, AppStep, ChatMessage, Character } from './types';
import { 
  generateOutline, 
  generateChapterContent, 
  getAiSuggestions, 
  chatWithConsultant 
} from './services/geminiService';
import * as db from './services/dbService';

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
        // 1. Check for legacy data
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          const parsed: Novel[] = JSON.parse(legacyData);
          // Migrate to IndexedDB
          for (const n of parsed) {
            await db.saveNovel(n);
          }
          // Clear legacy storage to prevent re-migration
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          console.log("Migration from localStorage to IndexedDB complete.");
        }

        // 2. Load from IndexedDB
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

    // Search
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(lowerSearch) || 
        n.premise.toLowerCase().includes(lowerSearch)
      );
    }

    // Genre Filter
    if (filterGenre !== "All") {
      result = result.filter(n => n.genre === filterGenre);
    }

    // Sort
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
      alert("Error saving manuscript.");
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
      alert("Error deleting manuscript.");
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
      const data = await generateOutline(novel);
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
      alert("Failed to map the narrative. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChapter = async (index: number, isRegen: boolean = false, directive: string = "") => {
    setLoading(true);
    
    // Synthesize structured directives
    let finalDirective = directive;
    if (sceneBlueprint.trim()) {
      finalDirective += `\nREQUIRED SCENES: ${sceneBlueprint}`;
    }
    if (intimacyPace !== 'None' || intimacyDynamic !== 'None') {
      finalDirective += `\nINTIMACY BLUEPRINT: 
        ${intimacyPace !== 'None' ? `- Pace: ${intimacyPace}` : ''}
        ${intimacyDynamic !== 'None' ? `- Dynamic: ${intimacyDynamic}` : ''}
      `;
    }

    try {
      const text = await generateChapterContent(index, novel, isRegen, finalDirective);
      const updatedChapters = { ...novel.chapters, [index]: text || "" };
      let updatedSuggestions = { ...novel.aiSuggestions };
      
      if (index < 11 && text) {
        const suggs = await getAiSuggestions(text, novel.outline[index + 1]);
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
      
      newChars[charIdx] = {
        ...newChars[charIdx],
        [field]: newList
      };
      
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
      const res = await chatWithConsultant(msg, novel.generatedPremise);
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
           {step !== 'archive' && (
             <button onClick={() => { saveToArchive(novel); alert("Manuscript checked into the archive."); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-100">
               <Save size={16} /> Save to Shelf
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

                {/* ARCHIVE CONTROLS */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search title or premise..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-sm font-semibold outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition-all"
                    />
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                      <Filter size={14} className="text-slate-400" />
                      <select 
                        value={filterGenre} 
                        onChange={(e) => setFilterGenre(e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer"
                      >
                        <option value="All">All Genres</option>
                        {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                      <ArrowUpDown size={14} className="text-slate-400" />
                      <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer"
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title-az">Title: A-Z</option>
                        <option value="title-za">Title: Z-A</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedArchive.length === 0 ? (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-30">
                       <Library size={64} className="mb-6" />
                       <h3 className="text-xl font-black uppercase tracking-widest">No Matches Found</h3>
                       <p className="text-sm font-bold">Try adjusting your filters or search terms.</p>
                    </div>
                  ) : (
                    filteredAndSortedArchive.map((item) => (
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
                              <button onClick={(e) => { e.stopPropagation(); exportText(item); }} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors border border-slate-100"><Download size={14}/></button>
                              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-slate-200">
                                {Object.keys(item.chapters).length}
                              </div>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: IDEATE */}
            {step === 'ideate' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 md:p-12 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Sub-Genre Perspective</label>
                        <div className="grid grid-cols-2 gap-2">
                          {genreOptions.map(g => (
                            <button key={g} onClick={() => setNovel({...novel, genre: g})} className={`text-left px-4 py-3 rounded-2xl text-[10px] font-black border transition-all ${novel.genre === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 hover:scale-105 hover:shadow-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'}`}>{g}</button>
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
                                  <button key={t} onClick={() => toggleTone(t)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${novel.tone.includes(t) ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:scale-105 hover:shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{t}</button>
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
                            <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-[9px] font-black border transition-all ${novel.tags.includes(tag) ? 'bg-white text-indigo-600 border-indigo-100 shadow-sm hover:scale-105 hover:shadow-indigo-100' : 'bg-transparent text-slate-400 border-transparent hover:border-slate-200'}`}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4">
                        <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-full p-6 rounded-[2rem] border-2 transition-all group flex items-center justify-between ${novel.isR18 ? 'bg-red-50 border-red-500 text-red-600 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          <div className="text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest block">Unfiltered Mode (R18)</span>
                            <span className="text-[9px] font-bold opacity-60">Allows explicit content & descriptive acts</span>
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

                  <button onClick={handleGenerateOutline} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100">
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Map the Narrative Arc
                  </button>

                  {novel.generatedPremise && (
                    <div className="p-10 bg-indigo-50/50 rounded-[3rem] border border-indigo-100 animate-in slide-in-from-bottom-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2"><BookMarked size={14}/> The Blueprint</h4>
                      <p className="text-slate-800 leading-relaxed font-semibold text-xl mb-10 whitespace-pre-wrap">{novel.generatedPremise}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
                         {novel.outline.map((t, i) => (
                           <div key={i} className="bg-white/80 p-4 rounded-2xl text-[10px] font-bold text-slate-600 border border-indigo-50 shadow-sm">
                             <span className="text-indigo-300 block mb-1">CHAPTER {i+1}</span>
                             {t}
                           </div>
                         ))}
                      </div>
                      <button onClick={() => setStep('style')} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-200 uppercase text-sm">Proceed to Cast <ChevronRight size={18}/></button>
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
                    <button 
                      onClick={() => setNovel(p => ({ ...p, characters: [...p.characters, { name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }] }))} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all shadow-lg"
                    >
                      <UserPlus size={14}/> New Character
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    {novel.characters.map((char, idx) => (
                      <div key={idx} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 relative group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100">
                        <button 
                          onClick={() => {
                            if (novel.characters.length <= 1) return;
                            setNovel(p => ({ ...p, characters: p.characters.filter((_, i) => i !== idx) }));
                          }} 
                          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">Character Identity</label>
                            <input value={char.name} onChange={(e) => updateCharacter(idx, 'name', e.target.value)} placeholder="Name" className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm" />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">Narrative Purpose</label>
                            <select value={char.role} onChange={(e) => updateCharacter(idx, 'role', e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm">
                              <option>Protagonist</option>
                              <option>Love Interest</option>
                              <option>Antagonist</option>
                              <option>Side Character</option>
                            </select>
                          </div>
                        </div>

                        {/* CHARACTER DEPTH GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          {/* Personality Core */}
                          <div className="space-y-4">
                            <label className="text-[11px] font-[900] text-slate-900 uppercase tracking-widest ml-2 flex items-center gap-2"><BrainCircuit size={14} className="text-indigo-500"/> Personality Core</label>
                            <div className="flex flex-wrap gap-2 p-5 bg-white rounded-3xl shadow-sm border border-slate-100">
                              {personalityPresets.map(p => {
                                const active = char.personality?.includes(p);
                                return (
                                  <button key={p} onClick={() => toggleCharList(idx, 'personality', p)} className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all active:scale-95 ${active ? 'bg-indigo-600 text-white border-black shadow-md hover:scale-110 hover:shadow-indigo-300' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-400'}`}>{p}</button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Dialogue Voice */}
                          <div className="space-y-4">
                            <label className="text-[11px] font-[900] text-slate-900 uppercase tracking-widest ml-2 flex items-center gap-2"><MessageSquareQuote size={14} className="text-indigo-500"/> Dialogue Voice</label>
                            <div className="flex flex-wrap gap-2 p-5 bg-white rounded-3xl shadow-sm border border-slate-100">
                              {dialoguePresets.map(p => {
                                const active = char.dialogueStyles?.includes(p);
                                return (
                                  <button key={p} onClick={() => toggleCharList(idx, 'dialogueStyles', p)} className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all active:scale-95 ${active ? 'bg-indigo-600 text-white border-black shadow-md hover:scale-110 hover:shadow-indigo-300' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-400'}`}>{p}</button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* R18 DEPTH GRID */}
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 mb-8 transition-all ${novel.isR18 ? 'opacity-100' : 'opacity-10 grayscale pointer-events-none blur-[1px]'}`}>
                          {/* Sexual Expressions */}
                          <div className="space-y-5">
                            <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                              <label className="text-[13px] font-[900] text-black uppercase tracking-[0.15em] flex items-center gap-3">
                                <Ghost size={18} className="text-rose-600"/> Primal Expressions
                              </label>
                              <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded">Choose Multiple</span>
                            </div>
                            <div className="flex flex-wrap gap-2.5 p-6 bg-white rounded-[2.5rem] shadow-md border-2 border-slate-100">
                              {expressionPresets.map(p => {
                                const active = char.expressions?.includes(p);
                                return (
                                  <button 
                                    key={p} 
                                    onClick={() => toggleCharList(idx, 'expressions', p)} 
                                    className={`px-4 py-3 rounded-2xl text-[11px] font-[900] border-2 flex items-center gap-2 transition-all active:scale-95 ${active ? 'bg-rose-600 text-white border-black shadow-xl -translate-y-1 scale-105 hover:scale-110 hover:shadow-rose-400' : 'bg-white text-slate-900 border-slate-200 hover:border-black'}`}
                                  >
                                    {active && <Check size={14} strokeWidth={3} />}
                                    {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Kinks & Desires */}
                          <div className="space-y-5">
                            <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                              <label className="text-[13px] font-[900] text-black uppercase tracking-[0.15em] flex items-center gap-3">
                                <HandMetal size={18} className="text-slate-900"/> Desires & Kinks
                              </label>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">Choose Multiple</span>
                            </div>
                            <div className="flex flex-wrap gap-2.5 p-6 bg-white rounded-[2.5rem] shadow-md border-2 border-slate-100">
                              {kinkPresets.map(p => {
                                const active = char.kinks?.includes(p);
                                return (
                                  <button 
                                    key={p} 
                                    onClick={() => toggleCharList(idx, 'kinks', p)} 
                                    className={`px-4 py-3 rounded-2xl text-[11px] font-[900] border-2 flex items-center gap-2 transition-all active:scale-95 ${active ? 'bg-black text-white border-black shadow-xl -translate-y-1 scale-105 hover:scale-110 hover:shadow-slate-800' : 'bg-white text-slate-900 border-slate-200 hover:border-black'}`}
                                  >
                                    {active && <Check size={14} strokeWidth={3} className="text-emerald-400" />}
                                    {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-2">Essence & Motivation</label>
                          <textarea value={char.description} onChange={(e) => updateCharacter(idx, 'description', e.target.value)} placeholder="Describe their physicality, scent, flaws, and deepest secrets..." className="w-full p-5 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none text-xs min-h-[120px] shadow-sm resize-none" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => handleGenerateChapter(0)} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                    {loading ? <Loader2 className="animate-spin" /> : <PenTool size={20} />} Enter the Writing Studio
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: WRITING STUDIO */}
            {step === 'write' && (
              <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col overflow-hidden min-h-[85vh]">
                  {/* EDITOR HEADER */}
                  <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-black text-xl shadow-lg">{activeChapter + 1}</div>
                      <div>
                        <h3 className="font-black text-slate-900 text-lg">{novel.outline[activeChapter]}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">{novel.genre}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">{novel.novelStyle}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleGenerateChapter(activeChapter, true)} disabled={loading} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-100 text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                      {loading ? <Loader2 size={14} className="animate-spin"/> : <RotateCcw size={14}/>} {loading ? "Revising..." : "Rewrite"}
                    </button>
                  </div>

                  {/* TEXT AREA */}
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

                  {/* FOOTER NAV */}
                  <div className="p-8 border-t bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
                    <button disabled={activeChapter === 0} onClick={() => setActiveChapter(activeChapter - 1)} className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-100 font-black text-[10px] uppercase text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all"><ChevronLeft size={16}/> Back</button>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Segment {activeChapter + 1} of 12</div>
                    <button 
                      onClick={() => {
                        const next = activeChapter + 1;
                        if (novel.chapters[next]) setActiveChapter(next);
                        else handleGenerateChapter(next);
                      }} 
                      disabled={activeChapter === 11 || loading}
                      className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 font-black text-[10px] uppercase text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all"
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
                      {!novel.aiSuggestions[activeChapter] && !loading && <p className="text-[10px] font-bold text-slate-300 text-center italic py-4">Finish the chapter to see plot threads...</p>}
                      {loading && <div className="animate-pulse space-y-3"><div className="h-12 bg-slate-50 rounded-2xl"/><div className="h-12 bg-slate-50 rounded-2xl"/></div>}
                    </div>
                  </div>
                  
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-2"><Mic2 size={14}/> Narrator Directives</p>
                     
                     {/* CHOREOGRAPHY SECTION */}
                     <div className="space-y-6">
                        <div className="space-y-3">
                           <label className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Scene Blueprint</label>
                           <textarea 
                              value={sceneBlueprint} 
                              onChange={(e) => setSceneBlueprint(e.target.value)}
                              placeholder="Key plot points (e.g. 'They argue in the elevator', 'He notices her bruise')"
                              className="w-full p-4 bg-white/5 rounded-2xl text-[11px] font-semibold outline-none border border-white/10 focus:border-indigo-400 transition-all placeholder:text-white/20 min-h-[80px] resize-none"
                           />
                        </div>

                        {novel.isR18 && (
                           <div className="p-5 bg-white/5 rounded-[2rem] border border-white/10 space-y-6">
                              <div className="space-y-4">
                                 <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><Timer size={12}/> Intimacy Pace</label>
                                 <div className="flex flex-wrap gap-2">
                                    {(['Teasing', 'Rushed', 'Slow-Burn', 'Urgent'] as const).map(p => (
                                       <button 
                                          key={p} 
                                          onClick={() => setIntimacyPace(intimacyPace === p ? 'None' : p)}
                                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${intimacyPace === p ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}
                                       >
                                          {p}
                                       </button>
                                    ))}
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Activity size={12}/> Climactic Dynamic</label>
                                 <div className="flex flex-wrap gap-2">
                                    {(['Multiple Orgasms', 'Overstimulation', 'Sweet/Tender', 'Primal/Rough', 'Standard'] as const).map(d => (
                                       <button 
                                          key={d} 
                                          onClick={() => setIntimacyDynamic(intimacyDynamic === d ? 'None' : d)}
                                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${intimacyDynamic === d ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/20' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}
                                       >
                                          {d}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>

                     <div className="my-6 border-t border-white/10 pt-6 relative">
                       <textarea 
                          value={customDirective} 
                          onChange={(e) => setCustomDirective(e.target.value)}
                          placeholder="Specific tone adjustment or prose directive..."
                          className="w-full p-4 bg-white/5 rounded-2xl text-[11px] font-semibold outline-none border border-white/10 focus:border-indigo-400 transition-all placeholder:text-white/20 min-h-[80px] resize-none pr-12"
                       />
                       <button 
                          onClick={() => handleGenerateChapter(activeChapter, true, customDirective)}
                          disabled={loading}
                          className="absolute right-3 bottom-3 p-3 bg-indigo-500 rounded-xl text-white hover:bg-indigo-400 disabled:opacity-20 transition-all shadow-lg"
                       >
                          <Send size={14} />
                       </button>
                     </div>

                     <div className="space-y-2">
                        <button onClick={() => handleGenerateChapter(activeChapter, true, "Drench the scene in visceral sensory detail: sounds of skin on skin, rhythmic thuds, and the smell of heat.")} disabled={loading} className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-black flex items-center justify-between transition-all group uppercase tracking-widest border border-white/5">
                          <span>Sensory Max</span> <Wind size={14} className="group-hover:text-indigo-300 transition-colors" />
                        </button>
                        <button onClick={() => handleGenerateChapter(activeChapter, true, "Enhance the scene with vivid sensory details, focusing on touch, smell, and sound.")} disabled={loading} className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-black flex items-center justify-between transition-all group uppercase tracking-widest border border-white/5">
                          <span>Sensory Bloom</span> <Sparkles size={14} className="group-hover:text-indigo-300 transition-colors" />
                        </button>
                        <button onClick={() => handleGenerateChapter(activeChapter, true, "Deepen the internal monologue and psychological tension.")} disabled={loading} className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-black flex items-center justify-between transition-all group uppercase tracking-widest border border-white/5">
                          <span>Psych Depth</span> <HeartPulse size={14} className="group-hover:text-red-400 transition-colors" />
                        </button>
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
              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                  <div className="bg-white p-6 rounded-full shadow-xl shadow-slate-200/50"><MessageSquareQuote size={40} className="text-slate-200" /></div>
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Ask for advice on themes, character arcs, or plot holes.</p>
                </div>
              )}
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
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} className="w-full pl-6 pr-16 py-5 bg-slate-50 rounded-[2rem] text-[13px] font-semibold outline-none focus:bg-white border-2 border-transparent focus:border-indigo-100 transition-all shadow-inner" placeholder="Analyze my current arc..." />
                <button onClick={sendChatMessage} className="absolute right-2 top-2 p-4 bg-slate-900 text-white rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-lg"><Send size={18} /></button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* SYNC FOOTER */}
      <footer className="bg-white/80 backdrop-blur-md border-t px-8 py-3 text-[9px] font-[900] text-slate-300 uppercase tracking-[0.4em] flex justify-between items-center z-50">
        <div className="flex gap-12">
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" /> ARCHIVE SECURED (IDB)</div>
          <div className="hidden md:block">LOC: {activeChapter + 1} / 12 CHAPTERS</div>
          <div className="hidden lg:block text-slate-200 uppercase tracking-widest">{novel.id.slice(0, 8)} • MANUSCRIPT ID</div>
        </div>
        <div className="text-indigo-600 flex items-center gap-2">VER: 09.2025.A <span className="text-slate-200">•</span> STUDIO READY</div>
      </footer>
    </div>
  );
};

export default App;
