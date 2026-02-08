
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, MessageSquarePlus, 
  Library, Save, History, Users, Palette, Tag as TagIcon, 
  Flame, Cpu, ExternalLink, X, UserPlus, User as UserIcon, 
  RotateCcw, CheckCircle2, Send, Wind, Settings2, Key, AlertTriangle,
  ChevronRight, ChevronLeft, Trash2, PlusCircle, Search, Lightbulb, Zap
} from 'lucide-react';

import { Novel, AppStep, ChatMessage, Character } from './types.ts';
import * as ai from './services/aiService.ts';
import * as db from './services/dbService.ts';

const App: React.FC = () => {
  // --- UI STATE ---
  const [step, setStep] = useState<AppStep>('archive');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Architecting...");
  const [activeChapter, setActiveChapter] = useState(0);
  const [archive, setArchive] = useState<Novel[]>([]);
  const [showConsultant, setShowConsultant] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  // --- STORY STATE ---
  const [novel, setNovel] = useState<Novel>({
    id: crypto.randomUUID(),
    title: 'New Story',
    lastModified: Date.now(),
    genre: 'Fantasy Romance',
    isR18: false,
    premise: '',
    tone: [],
    tags: [],
    novelStyle: 'Third Person Limited',
    ebookStyle: 'Standard',
    characters: [{ name: 'Protagonist', role: 'Major', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }],
    generatedPremise: '',
    outline: [],
    chapters: {},
    aiSuggestions: {}
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    loadNovels();
    checkApiKey();
  }, []);

  const loadNovels = async () => {
    const data = await db.getAllNovels();
    setArchive(data.sort((a, b) => b.lastModified - a.lastModified));
  };

  const checkApiKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
  };

  const handleOpenKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success as per race condition mitigation guidelines
      setHasApiKey(true);
      setError(null);
    }
  };

  const runAiTask = useCallback(async (task: () => Promise<void>, msg: string) => {
    setError(null);
    setLoadingMessage(msg);
    setLoading(true);
    try {
      await task();
    } catch (e: any) {
      console.error(e);
      const errMsg = e.message || String(e);
      if (errMsg.includes("Requested entity was not found") || errMsg.includes("401") || errMsg.includes("API_KEY_INVALID")) {
        setError("Gemini 3 models require a selected API key with billing enabled.");
        setHasApiKey(false);
        handleOpenKeySelection();
      } else if (errMsg.includes("429")) {
        setError("Rate limit reached. Please wait a moment.");
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const save = async (updated: Novel) => {
    const novelWithTs = { ...updated, lastModified: Date.now() };
    await db.saveNovel(novelWithTs);
    setNovel(novelWithTs);
    loadNovels();
  };

  const handleCreateNew = () => {
    setNovel({
      id: crypto.randomUUID(),
      title: 'Untitled Manuscript',
      lastModified: Date.now(),
      genre: 'Fantasy Romance',
      isR18: false,
      premise: '',
      tone: [],
      tags: [],
      novelStyle: 'Third Person Limited',
      ebookStyle: 'Standard',
      characters: [{ name: 'Protagonist', role: 'Major', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }],
      generatedPremise: '',
      outline: [],
      chapters: {},
      aiSuggestions: {}
    });
    setStep('ideate');
  };

  const handleGenerateOutline = () => runAiTask(async () => {
    const data = await ai.generateOutline(novel);
    await save({ ...novel, generatedPremise: data.premise, outline: data.outline });
  }, "Architecting Structure...");

  const handleGenerateChapter = (idx: number) => runAiTask(async () => {
    const text = await ai.generateChapterContent(idx, novel);
    let suggestions: string[] = [];
    if (novel.outline[idx + 1] && text) {
      try {
        suggestions = await ai.getSuggestions(text, novel.outline[idx + 1]);
      } catch (e) { console.warn("Suggestions failed", e); }
    }
    await save({ 
      ...novel, 
      chapters: { ...novel.chapters, [idx]: text || "" },
      aiSuggestions: { ...novel.aiSuggestions, [idx]: suggestions }
    });
    setActiveChapter(idx);
    setStep('write');
  }, "Drafting Cinematic Prose...");

  const handleConsult = () => runAiTask(async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    const res = await ai.consultArchitect(msg, novel.generatedPremise || novel.premise);
    // @ts-ignore
    setChatHistory(prev => [...prev, { role: 'ai', text: res.text, links: res.links }]);
  }, "Consulting Architect...");

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-slate-900 overflow-hidden selection:bg-indigo-100">
      {/* ERROR HEADER */}
      {error && (
        <div className="bg-rose-600 text-white px-6 py-3 flex justify-between items-center z-[100] animate-in slide-in-from-top duration-300 shadow-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
          </div>
          <div className="flex items-center gap-4">
            {!hasApiKey && (
              <button onClick={handleOpenKeySelection} className="bg-white text-rose-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2">
                <Key size={12}/> Setup Key
              </button>
            )}
            <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100"><X size={18}/></button>
          </div>
        </div>
      )}

      {/* MAIN HEADER */}
      <header className="h-16 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-50 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100"><BookOpen size={20}/></div>
          <h1 className="font-black text-xs uppercase tracking-widest">Architect <span className="text-indigo-600">Studio</span></h1>
        </div>

        <div className="flex items-center gap-3">
          {!hasApiKey && (
            <button onClick={handleOpenKeySelection} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
              <Key size={14}/> Setup API Key
            </button>
          )}
          {step !== 'archive' && (
            <button onClick={() => save(novel)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
              <Save size={16}/> Save
            </button>
          )}
          <button onClick={() => setShowConsultant(!showConsultant)} className={`p-2.5 rounded-xl transition-all ${showConsultant ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-900 text-white hover:bg-black'}`}>
            <MessageSquarePlus size={20}/>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* NAVIGATION RAIL */}
        <aside className="w-20 lg:w-64 border-r bg-white flex flex-col p-4 space-y-2 z-40 transition-all duration-300">
          {[
            { id: 'archive', icon: Library, label: 'Manuscripts' },
            { id: 'ideate', icon: Sparkles, label: 'Ideation Lab' },
            { id: 'style', icon: Users, label: 'Character Cast' },
            { id: 'write', icon: Wand2, label: 'Writing Studio' }
          ].map(s => (
            <button key={s.id} onClick={() => setStep(s.id as AppStep)} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>
              <s.icon size={20}/>
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">{s.label}</span>
            </button>
          ))}
          
          {step !== 'archive' && (
            <div className="pt-8 border-t mt-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-4 mb-3">Narrative Beats</p>
              {novel.outline.map((t, i) => (
                <button key={i} onClick={() => { setActiveChapter(i); setStep('write'); }} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold truncate transition-all ${activeChapter === i && step === 'write' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}>
                  {i+1}. {t}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50/20 custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full">
            {step === 'archive' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
                <div onClick={handleCreateNew} className="h-64 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 hover:bg-white group transition-all">
                  <PlusCircle className="text-slate-200 group-hover:text-indigo-400 transition-colors" size={48}/>
                  <span className="text-[10px] font-black uppercase text-slate-300 group-hover:text-indigo-600">New Manuscript</span>
                </div>
                {archive.map(item => (
                  <div key={item.id} onClick={() => { setNovel(item); setStep('write'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group flex flex-col h-64 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className="text-[9px] font-black px-2 py-1 rounded-full bg-indigo-50 text-indigo-500 uppercase tracking-widest">{item.genre}</span>
                      <button onClick={(e) => { e.stopPropagation(); db.deleteNovel(item.id).then(loadNovels); }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                    <h4 className="font-black text-xl mb-3 text-slate-800 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-4 font-medium leading-relaxed flex-1">{item.generatedPremise || item.premise || "No premise yet..."}</p>
                    {item.isR18 && <div className="absolute -right-6 -bottom-6 opacity-[0.03] rotate-12"><Flame size={120}/></div>}
                  </div>
                ))}
              </div>
            )}

            {step === 'ideate' && (
              <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black uppercase tracking-widest">Ideation Lab</h2>
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                    <span className={`text-[9px] font-black uppercase ${novel.isR18 ? 'text-red-500' : 'text-slate-400'}`}>Unfiltered Mode (R18)</span>
                    <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-12 h-6 rounded-full relative transition-all ${novel.isR18 ? 'bg-red-500' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${novel.isR18 ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Working Title</label>
                      <input type="text" value={novel.title} onChange={e => setNovel({...novel, title: e.target.value})} className="w-full text-2xl font-black bg-slate-50 p-5 rounded-3xl outline-none focus:ring-2 ring-indigo-100 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Story Genre</label>
                      <select value={novel.genre} onChange={e => setNovel({...novel, genre: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl outline-none text-sm font-black uppercase tracking-widest border border-transparent focus:border-indigo-100">
                        {['Fantasy Romance', 'Sci-Fi Thriller', 'Gothic Horror', 'Contemporary Romance', 'Dark Fantasy', 'Erotica'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Core Concept (The Spark)</label>
                    <textarea value={novel.premise} onChange={e => setNovel({...novel, premise: e.target.value})} className="w-full h-40 bg-slate-50 p-8 rounded-[2.5rem] outline-none text-lg font-medium resize-none shadow-inner custom-scrollbar focus:bg-white transition-all" placeholder="A world where..." />
                  </div>
                </div>

                <button onClick={handleGenerateOutline} disabled={loading} className="w-full bg-slate-900 text-white py-7 rounded-[2.5rem] font-black text-lg uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                  <Cpu size={24}/> {loading ? 'Architecting...' : 'Construct Narrative Structure'}
                </button>

                {novel.generatedPremise && (
                  <div className="p-10 bg-indigo-50/50 rounded-[3rem] border border-indigo-100 animate-in slide-in-from-bottom-4">
                    <p className="text-slate-800 leading-relaxed font-semibold text-xl mb-10 whitespace-pre-wrap">{novel.generatedPremise}</p>
                    <button onClick={() => setStep('style')} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl uppercase text-sm tracking-widest">Define the Cast <ChevronRight size={18}/></button>
                  </div>
                )}
              </div>
            )}

            {step === 'style' && (
              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3"><Users className="text-indigo-600" /> Character Casting</h2>
                  <button onClick={() => setNovel({...novel, characters: [...novel.characters, { name: '', role: 'Major', description: '', dialogueStyles: [], personality: [], expressions: [], kinks: [] }]})} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg tracking-widest"><UserPlus size={16}/> New Member</button>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  {novel.characters.map((char, idx) => (
                    <div key={idx} className="p-8 bg-slate-50/30 rounded-[3rem] border border-slate-100 space-y-6 relative group hover:bg-white hover:shadow-xl transition-all">
                      <button onClick={() => setNovel({...novel, characters: novel.characters.filter((_, i) => i !== idx)})} className="absolute top-8 right-8 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Name</label>
                          <input value={char.name} onChange={(e) => {
                            const nc = [...novel.characters]; nc[idx].name = e.target.value; setNovel({...novel, characters: nc});
                          }} className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Role</label>
                          <select value={char.role} onChange={(e) => {
                            const nc = [...novel.characters]; nc[idx].role = e.target.value; setNovel({...novel, characters: nc});
                          }} className="w-full p-4 bg-white rounded-2xl border border-transparent focus:border-indigo-100 outline-none font-bold text-sm shadow-sm">
                            {['Protagonist', 'Antagonist', 'Love Interest', 'Side Character'].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Physicality & Drive</label>
                        <textarea value={char.description} onChange={(e) => {
                          const nc = [...novel.characters]; nc[idx].description = e.target.value; setNovel({...novel, characters: nc});
                        }} className="w-full p-6 bg-white rounded-[2rem] border border-transparent focus:border-indigo-100 outline-none text-xs min-h-[100px] shadow-sm resize-none custom-scrollbar" placeholder="Scents, scars, motivation..."/>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleGenerateChapter(0)} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl">
                  {loading ? <Loader2 className="animate-spin inline" /> : "Commit Cast to Manuscript"}
                </button>
              </div>
            )}

            {step === 'write' && (
              <div className="flex flex-col xl:flex-row gap-8 h-[82vh] animate-in slide-in-from-right-4 duration-500">
                <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl flex flex-col overflow-hidden relative">
                  <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-slate-200">{activeChapter + 1}</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Beat</span>
                        <h3 className="font-black text-slate-900 text-lg leading-tight truncate max-w-md">{novel.outline[activeChapter]}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleGenerateChapter(activeChapter)} disabled={loading} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        {loading ? <Loader2 className="animate-spin" size={14}/> : <Zap size={14}/>} {novel.chapters[activeChapter] ? 'Regenerate' : 'Draft Scene'}
                      </button>
                    </div>
                  </div>
                  
                  <textarea 
                    value={novel.chapters[activeChapter] || ""} 
                    onChange={(e) => setNovel({...novel, chapters: {...novel.chapters, [activeChapter]: e.target.value}})}
                    className="flex-1 p-12 md:p-16 text-xl leading-[1.8] outline-none font-serif font-medium resize-none custom-scrollbar selection:bg-indigo-200"
                    placeholder="Ink flowing onto the page..."
                  />

                  <div className="p-8 border-t bg-slate-50/50 flex justify-between gap-4">
                    <button onClick={() => setActiveChapter(activeChapter - 1)} disabled={activeChapter === 0} className="px-6 py-4 rounded-2xl bg-white border font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all"><ChevronLeft size={16} className="inline mr-2"/> Prev</button>
                    <button 
                      onClick={() => {
                        if (novel.chapters[activeChapter + 1]) setActiveChapter(activeChapter + 1);
                        else handleGenerateChapter(activeChapter + 1);
                      }} 
                      disabled={loading || activeChapter >= novel.outline.length - 1} 
                      className="px-8 py-4 rounded-2xl bg-slate-900 font-black text-[10px] uppercase tracking-widest text-white shadow-xl hover:bg-indigo-600 transition-all disabled:opacity-50"
                    >
                      {novel.chapters[activeChapter + 1] ? "Next Beat" : "Construct Bridge"} <ChevronRight size={16} className="inline ml-2"/>
                    </button>
                  </div>
                </div>

                {/* CONTINUITY TOOLS */}
                <div className="w-full xl:w-96 space-y-6 flex flex-col overflow-y-auto custom-scrollbar pr-2">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                    <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-6 flex items-center gap-2"><Lightbulb size={14}/> Continuity Sparks</h4>
                    <div className="space-y-4">
                      {novel.aiSuggestions[activeChapter]?.map((s, i) => (
                        <div key={i} className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 text-[11px] font-semibold text-slate-700 flex gap-3 animate-in fade-in"><CheckCircle2 size={16} className="text-indigo-400 shrink-0" /> {s}</div>
                      )) || <p className="text-[10px] text-slate-300 font-black uppercase italic tracking-widest">Draft scene to see sparks.</p>}
                    </div>
                  </div>
                  
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-2"><Send size={14}/> Stylistic Directive</p>
                    <textarea className="w-full p-4 bg-white/5 rounded-2xl text-[11px] outline-none border border-white/10 min-h-[100px] focus:border-indigo-400 transition-all placeholder:text-white/20 custom-scrollbar" placeholder="Style shifts, specific plot anchors..." />
                    <button className="w-full mt-4 p-4 bg-indigo-500 rounded-xl text-white hover:bg-indigo-400 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20">Inject Context</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* CONSULTANT PANEL */}
        {showConsultant && (
          <aside className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white border-l shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><Search size={18}/></div>
                <h3 className="font-black uppercase tracking-widest text-xs">Architect AI Consultant</h3>
              </div>
              <button onClick={() => setShowConsultant(false)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50 custom-scrollbar">
              {chatHistory.length === 0 && (
                <div className="text-center p-10 space-y-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-indigo-500"><Wind size={24}/></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Consultant Online</p>
                  <p className="text-xs text-slate-400">Ask about plot holes, historical facts, or world-building logic. Powered by real-time search.</p>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] p-6 rounded-[2rem] text-[13px] font-medium leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white text-slate-700 border border-slate-100'}`}>
                    {m.text}
                    {/* @ts-ignore */}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                        <p className="text-[9px] font-black uppercase text-indigo-400 tracking-tighter">Verified Sources:</p>
                        {/* @ts-ignore */}
                        {m.links.map((link: any, idx: number) => (
                          <a key={idx} href={link.uri} target="_blank" className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:underline truncate">
                            <ExternalLink size={10}/> {link.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="text-[10px] font-black uppercase text-indigo-500 animate-pulse tracking-widest px-4">Processing Intelligence...</div>}
            </div>
            <div className="p-8 border-t bg-white">
              <div className="relative">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleConsult()} className="w-full pl-6 pr-16 py-5 bg-slate-50 rounded-[2.5rem] text-[13px] font-semibold outline-none focus:bg-white border focus:border-indigo-100 transition-all shadow-inner" placeholder="Request blueprint advice..." />
                <button onClick={handleConsult} className="absolute right-2 top-2 p-4 bg-slate-900 text-white rounded-[1.8rem] hover:bg-indigo-600 transition-all shadow-lg"><Send size={18} /></button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-6">
              <Loader2 className="animate-spin text-indigo-600" size={48}/>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">{loadingMessage}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
