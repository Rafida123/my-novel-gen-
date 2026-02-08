
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, MessageSquarePlus, Send, 
  Library, Save, PlusCircle, RotateCcw, ChevronLeft, ChevronRight,
  History, Settings2, Trash2, Mic2, Lightbulb, CheckCircle2, X, Plus, 
  UserPlus, Users, Palette, Tag as TagIcon, Flame, Calendar, Cpu, 
  AlertTriangle, Key, ExternalLink, Menu, Eye, Volume2, Wind, Fingerprint, Coffee, Copy, Maximize2, Minimize2, Highlighter, ShieldAlert, Lock
} from 'lucide-react';

// Core State & Types
import { Novel, AppStep, ChatMessage, Character } from './types.ts';
import { 
  generateOutline, generateChapterContent, getAiSuggestions, 
  chatWithConsultant, AIProvider, infuseSensoryDetail, polishProse
} from './services/geminiService.ts';
import * as db from './services/dbService.ts';

const personaArchetypes = ['Stoic', 'Neurotic', 'Caring', 'Aggressive', 'Playful', 'Calculating', 'Innocent', 'Cynical', 'Melancholic', 'Optimistic', 'Rebellious', 'Disciplined'];
const dialogueTones = ['Sarcastic & Blunt', 'Formal & Poetic', 'Soft-Spoken & Shy', 'Arrogant & Commanding', 'Uses Heavy Slang', 'Playful & Teasing', 'Stoic & Minimalist', 'Warm & Nurturing', 'Rough & Dirty', 'Quietly Intense'];
const sensoryExpressions = ['Vocal & Needy', 'Breathless Whispers', 'Deep Groans', 'Silent & Intense', 'Pleading', 'Commanding', 'Animalistic', 'Soft Whispers', 'Frequent Dirty Talk', 'Crying with Pleasure', 'Rolling Eyes (Intense)', 'Deeply Moany', 'Highly Expressive'];
const kinkDynamics = ['Oral Sex', 'Cunnilingus', 'BDSM', 'Impact Play', 'Exhibitionism', 'Praise/Degradation', 'Overstimulation', 'Mirror Play', 'Wax Play', 'Edge Play', 'Breath Play', 'Roleplay', 'Consensual Non-Consent'];

const genreOptions = ['Straight Romance', 'Yaoi (B×B)', 'Lesbian (G×G)', 'BDSM / Kink', 'Dark Romance', 'Fantasy Romance', 'Sci-Fi Romance', 'Reverse Harem', 'Omegaverse'];
const atmosphereOptions = {
  "Vibe": ['Flirty', 'Seductive', 'Obsessive', 'Forbidden', 'Slow Burn', 'Enemies to Lovers', 'Sweet', 'Angst', 'Gritty', 'Dark', 'Cozy'],
  "Intensity": ['Steamy', 'Smut', 'Vanilla', 'Hardcore', 'Sensual'],
  "Mood": ['Erotic', 'Dirty Flirty', 'Melancholic', 'Whimsical', 'High-Stakes', 'Tense', 'Poetic']
};

const App: React.FC = () => {
  // --- UI STATE ---
  const [step, setStep] = useState<AppStep>('archive'); 
  const [loading, setLoading] = useState(false);
  const [sensoryLoading, setSensoryLoading] = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  // Fixed: Added missing sensorySparks state definition
  const [sensorySparks, setSensorySparks] = useState<{sight: string, sound: string, smell: string, touch: string, taste: string} | null>(null);
  const [provider, setProvider] = useState<AIProvider>('groq'); 
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [archive, setArchive] = useState<Novel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        name: 'Elara', role: 'Protagonist', description: 'Quiet, observational, smells like lavender and rain.', 
        dialogueStyles: ['Soft-Spoken & Shy'], personality: ['Caring'],
        expressions: ['Soft Whimpers'], kinks: ['Praise/Degradation']
      }
    ],
    generatedPremise: '',
    outline: [],
    chapters: {},
    aiSuggestions: {} 
  });

  // --- ANALYTICS ---
  const wordCount = useMemo(() => {
    const text = novel.chapters[activeChapter] || "";
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [novel.chapters, activeChapter]);

  const readingTime = useMemo(() => Math.ceil(wordCount / 200), [wordCount]);

  // --- INITIALIZATION ---
  useEffect(() => {
    db.getAllNovels().then(setArchive).catch(console.error);
    // Auto-detect missing keys on boot
    const geminiKey = process.env.API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!geminiKey || geminiKey.includes('placeholder') || geminiKey.includes('your_') ||
        !groqKey || groqKey.includes('placeholder') || groqKey.includes('your_')) {
      setShowKeyModal(true);
    }
  }, []);

  useEffect(() => {
    if (showBrainstorm) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, showBrainstorm]);

  const filteredArchive = useMemo(() => {
    return archive.sort((a, b) => b.lastModified - a.lastModified);
  }, [archive]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const runAiTask = useCallback(async (task: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await task();
    } catch (e: any) {
      if (e.message === "ARCHITECT_AUTH_REQUIRED") {
        setError("Invalid or Missing API Keys. Please configure your settings.");
        setShowKeyModal(true);
      } else if (e.message === "ARCHITECT_QUOTA_EXHAUSTED") {
        setError("AI Quota exhausted (429). Please wait.");
      } else {
        setError(e.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const saveToArchive = async (updatedNovel: Novel) => {
    await db.saveNovel(updatedNovel);
    setArchive(prev => [updatedNovel, ...prev.filter(n => n.id !== updatedNovel.id)]);
  };

  const handleGenerateOutline = () => runAiTask(async () => {
    const data = await generateOutline(novel, provider);
    const updated = { ...novel, generatedPremise: data.premise, outline: data.outline, lastModified: Date.now() };
    setNovel(updated);
    await saveToArchive(updated);
  });

  const handleGenerateChapter = (index: number, isRegen: boolean = false, directive: string = "") => runAiTask(async () => {
    const text = await generateChapterContent(index, novel, isRegen, directive, provider);
    const updatedChapters = { ...novel.chapters, [index]: text || "" };
    
    if (novel.outline[index + 1] && text) {
      getAiSuggestions(text, novel.outline[index + 1], provider)
        .then(s => setNovel(p => ({ ...p, aiSuggestions: { ...p.aiSuggestions, [index]: s } })))
        .catch(() => {});
    }

    const updatedNovel = { ...novel, chapters: updatedChapters, lastModified: Date.now() };
    setNovel(updatedNovel);
    await saveToArchive(updatedNovel);
    setActiveChapter(index);
    setStep('write');
  });

  const handleInfuseSensory = async () => {
    const content = novel.chapters[activeChapter];
    if (!content) return;
    setSensoryLoading(true);
    try {
      const sparks = await infuseSensoryDetail(content, novel, provider);
      // Fixed: setSensorySparks is now correctly called
      setSensorySparks(sparks);
    } catch (e: any) {
      if (e.message === "ARCHITECT_AUTH_REQUIRED") setShowKeyModal(true);
      setError("Sensory infusion failed.");
    } finally {
      setSensoryLoading(false);
    }
  };

  const handlePolishProse = async () => {
    const content = novel.chapters[activeChapter];
    if (!content || !confirm("Improve current draft with AI Prose Polisher?")) return;
    setPolishLoading(true);
    try {
      const polished = await polishProse(content, novel, provider);
      if (polished) {
        const updatedChapters = { ...novel.chapters, [activeChapter]: polished };
        const updatedNovel = { ...novel, chapters: updatedChapters, lastModified: Date.now() };
        setNovel(updatedNovel);
        await saveToArchive(updatedNovel);
      }
    } catch (e: any) {
      if (e.message === "ARCHITECT_AUTH_REQUIRED") setShowKeyModal(true);
      setError("Prose polish failed.");
    } finally {
      setPolishLoading(false);
    }
  };

  const deleteFromArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this manuscript forever?")) return;
    await db.deleteNovel(id);
    setArchive(prev => prev.filter(n => n.id !== id));
  };

  const toggleList = (idx: number, field: keyof Character, value: string) => {
    const chars = [...novel.characters];
    const currentList = (chars[idx][field] as string[]) || [];
    const updatedList = currentList.includes(value) 
      ? currentList.filter(v => v !== value) 
      : [...currentList, value];
    chars[idx] = { ...chars[idx], [field]: updatedList };
    setNovel(p => ({ ...p, characters: chars }));
  };

  const updateCharacterField = (idx: number, field: keyof Character, value: any) => {
    const chars = [...novel.characters];
    chars[idx] = { ...chars[idx], [field]: value };
    setNovel(p => ({ ...p, characters: chars }));
  };

  const sendChatMessage = () => runAiTask(async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput; setChatInput("");
    setChatHistory(p => [...p, { role: 'user', text: msg }]);
    const res = await chatWithConsultant(msg, novel.generatedPremise || novel.premise, provider);
    setChatHistory(p => [...p, { role: 'ai', text: res || "I'm sorry, I couldn't process that advice." }]);
  });

  return (
    <div className={`min-h-screen ${step === 'write' ? 'bg-white' : 'bg-[#fafafa]'} text-slate-900 font-sans flex flex-col transition-all ${isFocusMode ? 'overflow-hidden' : ''}`}>
      
      {/* API KEY MODAL */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowKeyModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-8 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Lock className="text-indigo-400" size={24}/>
                  <h3 className="text-xl font-black uppercase tracking-tighter">API Configuration</h3>
                </div>
                <button onClick={() => setShowKeyModal(false)} className="opacity-50 hover:opacity-100 transition-opacity"><X/></button>
              </div>
              <p className="mt-4 text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest">
                To enable AI writing, you must add your private keys to your <code className="text-indigo-400">.env</code> file or deployment settings.
              </p>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/> Architect Engine (Gemini)</span>
                   <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1 hover:underline">Get Free Key <ExternalLink size={10}/></a>
                </div>
                <div className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-mono truncate opacity-60">{process.env.API_KEY || 'MISSING'}</p>
                  </div>
                  {(process.env.API_KEY?.includes('placeholder') || !process.env.API_KEY) && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[8px] font-black uppercase"><AlertTriangle size={10}/> Invalid</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/> Cerebro Engine (Groq)</span>
                   <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[9px] font-black uppercase text-rose-600 flex items-center gap-1 hover:underline">Get Free Key <ExternalLink size={10}/></a>
                </div>
                <div className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-mono truncate opacity-60">{process.env.GROQ_API_KEY || 'MISSING'}</p>
                  </div>
                  {(process.env.GROQ_API_KEY?.includes('placeholder') || !process.env.GROQ_API_KEY) && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[8px] font-black uppercase"><AlertTriangle size={10}/> Invalid</span>
                  )}
                </div>
              </div>

              <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-2">Instructions:</h4>
                <ol className="text-[10px] text-slate-600 font-bold space-y-2 list-decimal ml-4">
                  <li>Visit the links above and create your API keys.</li>
                  <li>In your local folder, open <code className="bg-white px-1 py-0.5 rounded">.env</code>.</li>
                  <li>Paste your keys into the file and save it.</li>
                  <li><b>Sync your changes to GitHub.</b></li>
                  <li><b>Important:</b> On your hosting provider (Vercel/Netlify), add these keys to "Environment Variables".</li>
                </ol>
              </div>

              <button onClick={() => setShowKeyModal(false)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-xs hover:bg-indigo-600 transition-all">I have updated the keys</button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR BAR */}
      {error && !showKeyModal && (
        <div className="bg-rose-500 text-white px-8 py-3 flex justify-between items-center sticky top-0 z-[100] shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowKeyModal(true)} className="flex items-center gap-2 px-4 py-1.5 bg-white text-rose-500 rounded-lg text-[9px] font-black uppercase hover:bg-rose-50 transition-all">
              <Key size={12}/> Resolve Key
            </button>
            <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100"><X size={18}/></button>
          </div>
        </div>
      )}

      {/* HEADER */}
      {!isFocusMode && (
        <header className="bg-white border-b px-4 py-3 md:px-8 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-all"><Menu size={20} /></button>
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200"><BookOpen size={20} /></div>
              <h1 className="text-sm font-[900] uppercase tracking-tighter">Architect <span className="text-indigo-600">Studio</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="hidden md:flex bg-slate-100 p-1 rounded-2xl mr-2">
               <button onClick={() => setProvider('groq')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${provider === 'groq' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Cerebro (Llama 3.3)</button>
               <button onClick={() => setProvider('gemini')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${provider === 'gemini' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Architect (Gemini)</button>
             </div>
             {step !== 'archive' && (
               <button onClick={() => saveToArchive(novel)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-[10px] font-black uppercase border border-indigo-100">
                 <Save size={16} /> Save
               </button>
             )}
             <button onClick={() => setShowBrainstorm(!showBrainstorm)} className={`p-2.5 rounded-xl transition-all shadow-lg ${showBrainstorm ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}><MessageSquarePlus size={18} /></button>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r flex flex-col p-6 transition-transform lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:static lg:block'}`}>
          <div className="space-y-1 mb-10">
            {[
              { id: 'archive', icon: Library, label: 'The Archive' },
              { id: 'ideate', icon: Sparkles, label: 'Ideation' },
              { id: 'style', icon: Users, label: 'Cast & Style' },
              { id: 'write', icon: Wand2, label: 'Studio' }
            ].map(s => (
              <button key={s.id} onClick={() => { setStep(s.id as AppStep); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                <s.icon size={16} /> {s.label}
              </button>
            ))}
          </div>
          {step !== 'archive' && (
             <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={12}/> Story Beats</p>
               <div className="space-y-1 flex-1">
                 {novel.outline.map((t, i) => (
                   <button key={i} onClick={() => { setActiveChapter(i); setStep('write'); }} className={`w-full text-left p-3 rounded-xl text-[10px] font-bold transition-all border group ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'text-slate-400 border-transparent hover:bg-slate-50'}`}>
                     <div className="flex justify-between items-center">
                       <span className="truncate pr-2">{t}</span>
                       {novel.chapters[i] && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                     </div>
                   </button>
                 ))}
               </div>
               <button onClick={() => setNovel(p => ({...p, outline: [...p.outline, `New Beat ${p.outline.length + 1}`]}))} className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-200 text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                 <Plus size={14}/> Add New Beat
               </button>
             </div>
          )}
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 overflow-y-auto ${isFocusMode ? 'p-0 bg-white' : 'p-4 md:p-10'} scroll-smooth custom-scrollbar relative`}>
          <div className={`${isFocusMode ? 'max-w-4xl mx-auto min-h-screen flex flex-col' : 'max-w-5xl mx-auto w-full pb-20'}`}>
            
            {/* ARCHIVE STEP */}
            {step === 'archive' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">The Archive</h2>
                  <button onClick={() => { setStep('ideate'); setNovel({ ...novel, id: crypto.randomUUID(), title: 'Untitled Project', chapters: {}, outline: [], generatedPremise: '', characters: [{ name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }] }); }} className="flex items-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-indigo-700 transition-all">
                    <PlusCircle size={20} /> Create New Project
                  </button>
                </div>
                {archive.length === 0 ? (
                  <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    <Library size={32} className="text-slate-300"/>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No Manuscripts Found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredArchive.map(item => (
                      <div key={item.id} onClick={() => { setNovel(item); setStep('write'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <span className="text-[9px] font-black bg-indigo-50 text-indigo-500 px-3 py-1 rounded-full uppercase">{item.genre}</span>
                          <button onClick={(e) => deleteFromArchive(item.id, e)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                        <h4 className="text-xl font-black mb-2 line-clamp-2 relative z-10">{item.title}</h4>
                        <p className="text-xs text-slate-400 flex-1 line-clamp-3 mb-6 relative z-10">{item.generatedPremise || item.premise}</p>
                        <div className="pt-4 border-t border-slate-50 flex justify-between items-center relative z-10">
                          <span className="text-[8px] font-black text-slate-300 uppercase"><Calendar size={10} className="inline mr-1"/> {new Date(item.lastModified).toLocaleDateString()}</span>
                          <span className="text-[10px] font-black text-indigo-600">{Object.keys(item.chapters).length} Drafts</span>
                        </div>
                        {item.isR18 && <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12"><Flame size={120}/></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* IDEATE STEP */}
            {step === 'ideate' && (
              <div className="space-y-12 animate-in slide-in-from-bottom-4">
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 md:p-12 space-y-12">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <div className="space-y-8">
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Genre Select</label>
                         <div className="grid grid-cols-2 gap-2">
                           {genreOptions.map(g => (
                             <button key={g} onClick={() => setNovel({...novel, genre: g})} className={`text-left px-4 py-3 rounded-2xl text-[10px] font-black border transition-all ${novel.genre === g ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{g}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Atmospheric Tags</label>
                         <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                           {Object.entries(atmosphereOptions).map(([cat, opts]) => (
                             <div key={cat} className="space-y-2">
                               <p className="text-[8px] font-bold text-slate-300 uppercase">{cat}</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {opts.map((t: any) => (
                                   <button key={t} onClick={() => setNovel(p => ({ ...p, tone: p.tone.includes(t) ? p.tone.filter(x => x !== t) : [...p.tone, t] }))} className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${novel.tone.includes(t) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-100'}`}>{t}</button>
                                 ))}
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     </div>
                     <div className="space-y-8">
                       <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between ${novel.isR18 ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                         <div className="text-left"><span className="text-[10px] font-black uppercase block">Unfiltered Mode (R18)</span><span className="text-[8px] opacity-60">Visceral sensory immersion</span></div>
                         <Flame size={20} className={novel.isR18 ? 'text-red-500 animate-pulse' : 'text-slate-300'} />
                       </button>
                     </div>
                   </div>
                   <div className="pt-8 border-t">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Core Concept Seed</label>
                     <textarea value={novel.premise} onChange={(e) => setNovel({...novel, premise: e.target.value})} className="w-full p-8 rounded-[2rem] bg-slate-50 text-lg font-medium min-h-[150px] outline-none border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all custom-scrollbar" placeholder="Start your story here..." />
                   </div>
                   <button onClick={handleGenerateOutline} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-lg hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                     {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Construct Blueprint
                   </button>
                   {novel.generatedPremise && (
                     <div className="p-10 bg-indigo-50/50 rounded-[3rem] border border-indigo-100 animate-in slide-in-from-bottom-4">
                       <p className="text-slate-800 leading-relaxed font-semibold text-xl mb-10 whitespace-pre-wrap">{novel.generatedPremise}</p>
                       <button onClick={() => setStep('style')} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl uppercase text-sm">Proceed to Casting <ChevronRight size={18} className="inline ml-2"/></button>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* STYLE STEP */}
            {step === 'style' && (
              <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm space-y-12 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Users className="text-indigo-600" /> Casting Ledger</h2>
                  <button onClick={() => setNovel({...novel, characters: [...novel.characters, { name: '', role: 'Protagonist', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }]})} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg"><UserPlus size={14}/> New Character</button>
                </div>

                <div className="grid grid-cols-1 gap-12">
                  {novel.characters.map((char, idx) => (
                    <div key={idx} className="p-10 bg-slate-50/40 rounded-[3rem] border border-slate-100 space-y-10 relative group transition-all hover:bg-white hover:shadow-2xl">
                      <button onClick={() => setNovel({...novel, characters: novel.characters.filter((_, i) => i !== idx)})} className="absolute top-8 right-8 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Name</label>
                          <input value={char.name} onChange={(e) => updateCharacterField(idx, 'name', e.target.value)} className="w-full p-5 bg-white rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold text-lg shadow-sm" placeholder="Character Name"/>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Role</label>
                          <select value={char.role} onChange={(e) => updateCharacterField(idx, 'role', e.target.value)} className="w-full p-5 bg-white rounded-2xl border border-transparent focus:border-indigo-200 outline-none font-bold text-lg shadow-sm">
                            <option>Protagonist</option>
                            <option>Love Interest</option>
                            <option>Antagonist</option>
                            <option>Side Character</option>
                            <option>Mentor</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Physicality & Essence</label>
                        <textarea value={char.description} onChange={(e) => updateCharacterField(idx, 'description', e.target.value)} className="w-full p-6 bg-white rounded-2xl border border-transparent focus:border-indigo-200 outline-none text-sm min-h-[100px] shadow-sm resize-none custom-scrollbar" placeholder="Appearance, vibe..."/>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Archetypes</label>
                          <div className="flex flex-wrap gap-2">
                            {personaArchetypes.map(v => (
                              <button key={v} onClick={() => toggleList(idx, 'personality', v)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${char.personality?.includes(v) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{v}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Voice Tone</label>
                          <div className="flex flex-wrap gap-2">
                            {dialogueTones.map(v => (
                              <button key={v} onClick={() => toggleList(idx, 'dialogueStyles', v)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${char.dialogueStyles?.includes(v) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{v}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {novel.isR18 && (
                        <div className="pt-8 border-t border-slate-100 space-y-10 animate-in fade-in">
                          <div className="flex items-center gap-3 text-rose-500"><ShieldAlert size={18} /><h4 className="text-[11px] font-black uppercase tracking-widest">Behavioral Profile</h4></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vocal Expressions</label>
                              <div className="flex flex-wrap gap-2">
                                {sensoryExpressions.map(v => (
                                  <button key={v} onClick={() => toggleList(idx, 'expressions', v)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${char.expressions?.includes(v) ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{v}</button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kinks & Dynamics</label>
                              <div className="flex flex-wrap gap-2">
                                {kinkDynamics.map(v => (
                                  <button key={v} onClick={() => toggleList(idx, 'kinks', v)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${char.kinks?.includes(v) ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{v}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep('write')} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 /> Commit to Studio
                </button>
              </div>
            )}

            {/* WRITE STEP (STUDIO) */}
            {step === 'write' && (
              <div className={`flex flex-col ${isFocusMode ? '' : 'xl:flex-row'} gap-8 animate-in slide-in-from-right-4 h-full`}>
                <div className={`flex-1 bg-white flex flex-col ${isFocusMode ? 'min-h-screen' : 'rounded-[3rem] border border-slate-100 shadow-2xl min-h-[85vh] overflow-hidden'}`}>
                  {/* Studio Template Header - Pure White */}
                  <div className={`p-8 border-b bg-white flex flex-col md:flex-row justify-between items-center gap-6 ${isFocusMode ? 'sticky top-0 z-30 backdrop-blur-md' : ''}`}>
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg">{activeChapter + 1}</div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Beat</span>
                          <h3 className="font-black text-slate-900 text-lg leading-tight">{novel.outline[activeChapter]}</h3>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handlePolishProse} title="Polish Prose" disabled={polishLoading || !novel.chapters[activeChapter]} className="flex items-center gap-2 p-3 rounded-2xl bg-white border text-rose-500 hover:bg-rose-50 transition-all shadow-sm">
                        {polishLoading ? <Loader2 size={18} className="animate-spin" /> : <Highlighter size={18}/>}
                      </button>
                      <button onClick={() => setIsFocusMode(!isFocusMode)} title="Toggle Focus Mode" className="flex items-center gap-2 p-3 rounded-2xl bg-white border text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                        {isFocusMode ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                      </button>
                      <button onClick={() => handleGenerateChapter(activeChapter, true)} title="Regenerate Draft" disabled={loading} className="p-3 rounded-2xl bg-white border text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><RotateCcw size={18}/></button>
                    </div>
                  </div>
                  
                  {/* Writing Surface */}
                  <textarea 
                    value={novel.chapters[activeChapter] || ""} 
                    onChange={(e) => setNovel({...novel, chapters: {...novel.chapters, [activeChapter]: e.target.value}})}
                    className={`flex-1 p-10 md:p-16 text-xl leading-[2] outline-none font-serif font-medium resize-none selection:bg-indigo-100 custom-scrollbar ${isFocusMode ? 'max-w-2xl mx-auto w-full' : ''} bg-white`}
                    placeholder="Ink flowing..."
                    spellCheck={false}
                  />
                  
                  {/* Studio Template Footer - Pure White */}
                  <div className={`p-8 border-t bg-white flex flex-col md:flex-row justify-between items-center gap-6 ${isFocusMode ? 'sticky bottom-0 z-30' : ''}`}>
                    <div className="flex gap-8 text-[10px] font-black uppercase text-slate-400">
                      <span>{wordCount} Words</span>
                      <span>~{readingTime} min read</span>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setActiveChapter(activeChapter - 1)} disabled={activeChapter === 0} className="px-6 py-4 rounded-2xl bg-white border text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all shadow-sm"><ChevronLeft size={16}/></button>
                      <button onClick={() => { if (novel.chapters[activeChapter + 1]) setActiveChapter(activeChapter + 1); else handleGenerateChapter(activeChapter + 1); }} disabled={loading} className="px-8 py-4 rounded-2xl bg-indigo-600 font-black text-[10px] uppercase text-white shadow-xl hover:bg-indigo-700 transition-all">
                        {loading ? <Loader2 className="animate-spin mr-2" size={14}/> : (novel.chapters[activeChapter + 1] ? "Next Beat" : "Construct Next")} <ChevronRight size={16} className="inline ml-2"/>
                      </button>
                    </div>
                  </div>
                </div>

                {!isFocusMode && (
                  <div className="w-full xl:w-96 space-y-8 h-fit">
                    {/* SENSORY ARCHITECT PANEL */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group">
                      <div className="flex justify-between items-center mb-8 border-b pb-4">
                        <h4 className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-2"><Wind size={14}/> Sensory Architect</h4>
                        <button onClick={handleInfuseSensory} disabled={sensoryLoading} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                          {sensoryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {sensorySparks ? (
                          <div className="grid grid-cols-1 gap-3">
                            {[
                              { icon: Eye, label: 'Sight', color: 'text-blue-500', value: sensorySparks.sight },
                              { icon: Volume2, label: 'Sound', color: 'text-indigo-500', value: sensorySparks.sound },
                              { icon: Wind, label: 'Smell', color: 'text-emerald-500', value: sensorySparks.smell },
                              { icon: Fingerprint, label: 'Touch', color: 'text-amber-500', value: sensorySparks.touch },
                              { icon: Coffee, label: 'Taste', color: 'text-rose-500', value: sensorySparks.taste },
                            ].map((item, i) => (
                              <div key={i} className="p-4 bg-slate-50 rounded-2xl border hover:border-slate-200 group/spark transition-all">
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`text-[8px] font-black uppercase flex items-center gap-1.5 ${item.color}`}><item.icon size={10}/> {item.label}</span>
                                  <button onClick={() => copyToClipboard(item.value)} className="opacity-0 group-hover/spark:opacity-100 text-slate-400 hover:text-indigo-600"><Copy size={12}/></button>
                                </div>
                                <p className="text-[11px] font-medium leading-relaxed text-slate-600 italic">"{item.value}"</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-300 font-bold uppercase italic text-center py-4">Request sensory details.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* STORY CONSULTANT (RESOURCE) */}
      <div className={`fixed inset-y-0 right-0 z-[60] w-[400px] bg-white border-l shadow-2xl transition-transform flex flex-col ${showBrainstorm ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <MessageSquarePlus size={20} className="text-indigo-400" />
            <h4 className="text-[11px] font-black uppercase tracking-widest">Story Consultant</h4>
          </div>
          <button onClick={() => setShowBrainstorm(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-all"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50">
          {chatHistory.length === 0 ? (
            <div className="text-center py-10">
              <Lightbulb className="mx-auto text-indigo-300 mb-4" size={32}/>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Ask the Architect about pacing, character beats, or thematic resonance.</p>
            </div>
          ) : (
            chatHistory.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-6 border-t bg-white">
          <div className="relative">
            <input 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              className="w-full p-4 pr-12 rounded-xl bg-slate-100 border-none outline-none text-xs font-medium focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="Query the architect..."
            />
            <button 
              onClick={sendChatMessage}
              disabled={loading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      {!isFocusMode && (
        <footer className="bg-white border-t px-8 py-3 text-[9px] font-[900] text-slate-300 uppercase tracking-[0.4em] flex justify-between items-center z-50">
          <div className="flex gap-12">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" /> ARCHIVE SECURED</div>
            <div className="flex items-center gap-2 text-indigo-500 uppercase"><Cpu size={10} /> {provider} Engine ACTIVE</div>
          </div>
          <div className="text-indigo-600 flex items-center gap-2">VER: 09.2025.A <span className="opacity-30">|</span> UNLIMITED ARC</div>
        </footer>
      )}
    </div>
  );
};

export default App;
