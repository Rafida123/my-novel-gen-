import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Sparkles, Wand2, Loader2, Library, Save, Users, Palette, 
  Flame, Cpu, ExternalLink, X, UserPlus, User as UserIcon, 
  Send, Wind, Trash2, PlusCircle, Search, Zap, ImageIcon, Key, AlertTriangle
} from 'lucide-react';

import { Novel, AppStep } from './types.ts';
import * as ai from './services/aiService.ts';
import * as db from './services/dbService.ts';

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

  const [novel, setNovel] = useState<any>({
    id: crypto.randomUUID(),
    title: 'New Story',
    lastModified: Date.now(),
    genre: 'Fantasy Romance',
    isR18: false,
    premise: '',
    tone: [],
    tags: [],
    novelStyle: 'Third Person Limited',
    characters: [{ name: 'Protagonist', role: 'Major', description: '' }],
    generatedPremise: '',
    outline: [],
    chapters: {},
    storyboard: []
  });

  useEffect(() => { 
    loadNovels();
    checkKeySelection();
  }, []);

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
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasSelectedKey(true);
      setError(null);
    }
  };

  const save = async (updated: any) => {
    const novelWithTs = { ...updated, lastModified: Date.now() };
    await db.saveNovel(novelWithTs);
    setNovel(novelWithTs);
    loadNovels();
  };

  const wrapAiCall = async (task: () => Promise<void>, msg: string) => {
    setError(null);
    setLoadingMessage(msg);
    setLoading(true);
    try {
      await task();
    } catch (e: any) {
      console.error(e);
      const errMsg = e.message || String(e);
      if (errMsg.includes("Requested entity was not found") || errMsg.includes("401") || errMsg.includes("API_KEY_INVALID")) {
        setError("Invalid or missing Gemini API Key. Please select a valid key.");
        setHasSelectedKey(false);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOutline = () => wrapAiCall(async () => {
    const res = await ai.generateOutline(novel);
    await save({ ...novel, generatedPremise: res.premise, outline: res.outline });
  }, "Architecting Full Structure...");

  const handleDraft = (idx: number) => wrapAiCall(async () => {
    const memory = idx > 0 ? await ai.generateStoryMemory(novel.chapters[idx-1] || "") : null;
    const draft = await ai.generateDraftChapter(idx, novel, "", memory);
    await save({ ...novel, chapters: { ...novel.chapters, [idx]: draft } });
  }, "Drafting Cinematic Scene...");

  const handlePortrait = (idx: number) => wrapAiCall(async () => {
    const url = await ai.generateCharacterPortrait(novel.characters[idx], novel);
    if (url) {
      const chars = [...novel.characters];
      chars[idx].imageUrl = url;
      await save({ ...novel, characters: chars });
    }
  }, "Visualizing Character...");

  const handleMoodboard = () => wrapAiCall(async () => {
    const p = `Cinematic environment art: ${novel.outline[activeChapter] || novel.title}. Style: ${novel.genre}. Atmosphere: 4k, digital painting, atmospheric lighting.`;
    const url = await ai.generateVisual(p);
    if (url) {
      await save({ ...novel, storyboard: [{ id: crypto.randomUUID(), url, prompt: p }, ...(novel.storyboard || [])] });
    }
  }, "Rendering Environment Art...");

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
      if (e.message.includes("401") || e.message.includes("not found")) setHasSelectedKey(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><BookOpen size={20}/></div>
          <h1 className="font-black text-xs uppercase tracking-widest">Architect <span className="text-indigo-600">Studio</span></h1>
        </div>
        <div className="flex gap-3">
          {!hasSelectedKey && (
            <button onClick={handleOpenKeySelection} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
              <Key size={16}/> Setup Key
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
        <div className="bg-red-500 text-white px-6 py-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest z-[60]">
          <div className="flex items-center gap-2">
            {/* Fix: Added missing AlertTriangle icon import from lucide-react */}
            <AlertTriangle size={14}/>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X size={14}/></button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Nav */}
        <aside className="w-20 lg:w-64 border-r bg-white flex flex-col p-4 space-y-2 z-40">
          {[
            { id: 'archive', icon: Library, label: 'Manuscripts' },
            { id: 'ideate', icon: Sparkles, label: 'Ideation' },
            { id: 'style', icon: Users, label: 'Casting' },
            { id: 'write', icon: Wand2, label: 'Studio' },
            { id: 'storyboard', icon: ImageIcon, label: 'Moodboard' }
          ].map(s => (
            <button key={s.id} onClick={() => setStep(s.id as AppStep)} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${step === s.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
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

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/20 custom-scrollbar">
          <div className="max-w-5xl mx-auto w-full">
            {step === 'archive' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                <div onClick={() => { setNovel({ id: crypto.randomUUID(), title: 'Untethered Story', characters: [{ name: 'Protagonist', role: 'Major', description: '' }], outline: [], chapters: {}, storyboard: [] }); setStep('ideate'); }} className="h-64 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 transition-all group">
                  <PlusCircle className="text-slate-200 group-hover:text-indigo-600" size={48}/><span className="text-[10px] font-black uppercase text-slate-300">New Manuscript</span>
                </div>
                {archive.map(item => (
                  <div key={item.id} onClick={() => { setNovel(item); setStep('write'); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group h-64 flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-black px-2 py-1 rounded-full bg-indigo-50 text-indigo-500 uppercase">{item.genre}</span>
                      <button onClick={(e) => { e.stopPropagation(); db.deleteNovel(item.id).then(loadNovels); }} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                    </div>
                    <h4 className="font-black text-xl mb-3 text-slate-800 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed">{item.generatedPremise || item.premise || "Empty Canvas..."}</p>
                    {item.isR18 && <div className="absolute bottom-6 right-6 text-red-100 opacity-20"><Flame size={48}/></div>}
                  </div>
                ))}
              </div>
            )}

            {step === 'ideate' && (
              <div className="bg-white p-12 rounded-[3.5rem] shadow-xl space-y-12 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black uppercase tracking-widest">Ideation Lab</h2>
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                    <span className={`text-[9px] font-black uppercase ${novel.isR18 ? 'text-red-500' : 'text-slate-400'}`}>Sensory Protocol (R18)</span>
                    <button onClick={() => setNovel({...novel, isR18: !novel.isR18})} className={`w-12 h-6 rounded-full relative transition-all ${novel.isR18 ? 'bg-red-500 shadow-md' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${novel.isR18 ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Manuscript Title</label>
                    <input type="text" value={novel.title} onChange={e => setNovel({...novel, title: e.target.value})} className="w-full text-2xl font-black bg-slate-50 p-6 rounded-3xl outline-none focus:ring-2 ring-indigo-100 transition-all" placeholder="The Echoes of Aethelgard..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">The Core Spark (Premise)</label>
                    <textarea value={novel.premise} onChange={e => setNovel({...novel, premise: e.target.value})} className="w-full h-48 bg-slate-50 p-8 rounded-[2.5rem] outline-none text-lg resize-none shadow-inner focus:bg-white transition-all" placeholder="Describe the heart of the story..." />
                  </div>
                  <button onClick={handleGenerateOutline} disabled={loading} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3">
                    <Cpu size={20}/> {loading ? 'Architecting...' : 'Construct Outline'}
                  </button>
                </div>
              </div>
            )}

            {step === 'style' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex justify-between items-end">
                  <h2 className="text-3xl font-black">Casting Office</h2>
                  <button onClick={() => setNovel({...novel, characters: [...novel.characters, { name: '', role: 'Major', description: '' }]})} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition flex items-center gap-2"><UserPlus size={16}/> Add Character</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {novel.characters.map((c: any, i: number) => (
                    <div key={i} className="bg-white p-6 rounded-[2.5rem] border flex gap-6 shadow-sm hover:shadow-xl group relative transition-all">
                      <div className="w-24 h-24 bg-slate-50 rounded-2xl border flex items-center justify-center overflow-hidden relative group/portrait">
                        {c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover"/> : <UserIcon size={32} className="text-slate-200"/>}
                        <button onClick={() => handlePortrait(i)} className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover/portrait:opacity-100 flex items-center justify-center text-white transition-all"><Palette size={20}/></button>
                      </div>
                      <div className="flex-1 space-y-1">
                        <input value={c.name} onChange={e => { const nc = [...novel.characters]; nc[i].name = e.target.value; setNovel({...novel, characters: nc}); }} className="font-black text-lg w-full bg-transparent outline-none focus:text-indigo-600 transition-colors" placeholder="Character Name"/>
                        <textarea value={c.description} onChange={e => { const nc = [...novel.characters]; nc[i].description = e.target.value; setNovel({...novel, characters: nc}); }} className="text-xs text-slate-400 w-full h-16 bg-transparent outline-none resize-none mt-2 custom-scrollbar" placeholder="Drive, motivation, aesthetic..."/>
                      </div>
                      <button onClick={() => { const nc = [...novel.characters]; nc.splice(i, 1); setNovel({...novel, characters: nc}); }} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'write' && (
              <div className="flex flex-col xl:flex-row gap-8 h-[80vh] animate-in slide-in-from-right-4">
                <div className="flex-1 bg-white rounded-[3.5rem] border shadow-2xl flex flex-col overflow-hidden relative">
                  <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">{activeChapter + 1}</div>
                      <h3 className="font-black text-lg truncate max-w-xs">{novel.outline[activeChapter] || "Prologue"}</h3>
                    </div>
                    <button onClick={() => handleDraft(activeChapter)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all"><Zap size={14}/> AI Draft</button>
                  </div>
                  <textarea value={novel.chapters[activeChapter] || ""} onChange={e => setNovel({...novel, chapters: {...novel.chapters, [activeChapter]: e.target.value}})} className="flex-1 p-12 text-xl leading-relaxed outline-none font-serif font-medium resize-none selection:bg-indigo-100 custom-scrollbar" placeholder="The prose begins here..." />
                  <div className="p-8 border-t bg-slate-50/50 flex justify-between gap-4">
                    <button onClick={() => setActiveChapter(Math.max(0, activeChapter - 1))} disabled={activeChapter === 0} className="px-6 py-3 bg-white border rounded-xl text-[10px] font-black uppercase disabled:opacity-30">Prev Beat</button>
                    <button onClick={() => setActiveChapter(Math.min(novel.outline.length-1, activeChapter + 1))} disabled={activeChapter >= novel.outline.length - 1} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-30">Next Beat</button>
                  </div>
                </div>
              </div>
            )}

            {step === 'storyboard' && (
              <div className="space-y-8 animate-in zoom-in-95">
                <div className="flex justify-between items-end">
                  <h2 className="text-3xl font-black">Moodboard</h2>
                  <button onClick={handleMoodboard} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition">Visualize Scene</button>
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

        {/* Consultant Sidebar */}
        {showConsultant && (
          <aside className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-indigo-400"/>
                <h3 className="font-black uppercase tracking-widest text-[10px]">Architect Consultant</h3>
              </div>
              <button onClick={() => setShowConsultant(false)} className="hover:text-indigo-400 transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 custom-scrollbar">
              {chatHistory.length === 0 && (
                <div className="py-10 text-center space-y-4 px-6">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm text-indigo-600"><Wind size={24}/></div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ask for plot advice or research. Powered by Google Search.</p>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-xs leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white ml-4' : 'bg-white border text-slate-700 mr-4'}`}>
                    {m.text}
                    {m.links && m.links.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                        <p className="text-[8px] font-black uppercase text-indigo-500">Sources:</p>
                        {m.links.map((l:any, idx:number) => (
                          <a key={idx} href={l.uri} target="_blank" className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:underline truncate">
                            <ExternalLink size={8}/> {l.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-white flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConsult()} className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none text-xs border border-transparent focus:border-indigo-100 transition-all" placeholder="Ask plotting advice..." />
              <button onClick={handleConsult} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-lg"><Send size={18}/></button>
            </div>
          </aside>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
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