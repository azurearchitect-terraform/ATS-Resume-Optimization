import React, { useState, useEffect } from 'react';
import { Zap, Brain, History, Trash2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { EngineConfig, EngineType, analyzeSkillGap, generateInterviewQuestions } from '../services/geminiService';

interface AdditionalToolsProps {
  resumeText: string;
  jobDescription: string;
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: EngineType;
  onRestore?: (version: any) => void;
  currentResults?: any;
}

export const AdditionalTools: React.FC<AdditionalToolsProps> = ({ 
  resumeText, 
  jobDescription, 
  isDarkMode, 
  engineConfig, 
  selectedEngine,
  onRestore,
  currentResults
}) => {
  const [activeTab, setActiveTab] = useState<'skillGap' | 'interview' | 'history'>('skillGap');
  const [skillGap, setSkillGap] = useState<{missing: string[], present: string[]} | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('resumeHistory') || '[]');
    setHistory(savedHistory);
  }, []);

  const runSkillGap = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await analyzeSkillGap(resumeText, jobDescription, {
        engine: selectedEngine,
        model: engineConfig[selectedEngine].model,
        apiKey: engineConfig[selectedEngine].apiKey
      });
      setSkillGap(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to analyze skill gap.");
    }
    setIsLoading(false);
  };

  const runInterviewQuestions = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateInterviewQuestions(jobDescription, resumeText, {
        engine: selectedEngine,
        model: engineConfig[selectedEngine].model,
        apiKey: engineConfig[selectedEngine].apiKey
      });
      setInterviewQuestions(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate interview questions.");
    }
    setIsLoading(false);
  };

  const saveVersion = () => {
    const timestamp = new Date().toISOString();
    const newVersion = { 
      id: Date.now(), 
      timestamp,
      name: `Version ${new Date(timestamp).toLocaleString()}`,
      data: { 
        resumeText, 
        jobDescription,
        results: currentResults
      } 
    };
    const newHistory = [newVersion, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
  };

  const renameVersion = (id: number) => {
    const newHistory = history.map(v => v.id === id ? { ...v, name: newName } : v);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
    setRenamingId(null);
    setNewName('');
  };

  const deleteVersion = (id: number) => {
    const newHistory = history.filter(v => v.id !== id);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
  };

  return (
    <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button 
          onClick={() => setActiveTab('skillGap')} 
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'skillGap' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:bg-white/5 hover:text-white' : 'text-black/40 hover:bg-black/5 hover:text-black')
          }`}
        >
          <Zap className="w-4 h-4"/>
          Gap Analysis
        </button>
        <button 
          onClick={() => setActiveTab('interview')} 
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'interview' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:bg-white/5 hover:text-white' : 'text-black/40 hover:bg-black/5 hover:text-black')
          }`}
        >
          <Brain className="w-4 h-4"/>
          Interview
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'history' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:bg-white/5 hover:text-white' : 'text-black/40 hover:bg-black/5 hover:text-black')
          }`}
        >
          <History className="w-4 h-4"/>
          Versions
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
      
      {activeTab === 'skillGap' && (
        <div className="space-y-4">
          <button 
            onClick={runSkillGap} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-2 rounded-lg text-xs transition-colors"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Skill Gap'}
          </button>
          {skillGap && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] mb-2 uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  Present Skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {skillGap.present.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px]">{s}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] mb-2 uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  Missing Skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {skillGap.missing.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px]">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'interview' && (
        <div className="space-y-4">
          <button 
            onClick={runInterviewQuestions} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-2 rounded-lg text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Questions'}
          </button>
          {interviewQuestions.length > 0 && (
            <div className="space-y-2">
              {interviewQuestions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 text-[10px] leading-relaxed">
                  <span className="text-emerald-500 font-bold mr-2">Q{i+1}:</span>
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <button 
            onClick={saveVersion} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-lg text-xs transition-colors"
          >
            Save Current Version
          </button>
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className={`text-center text-[10px] py-8 ${isDarkMode ? 'opacity-40' : 'opacity-60'}`}>No saved versions yet.</p>
            ) : (
              history.map((v) => (
                  <div key={v.id} className="group flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all">
                    <div className="flex flex-col flex-1 min-w-0">
                      {renamingId === v.id ? (
                        <div className="flex gap-1">
                          <input 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-black/20 text-[10px] p-1 rounded w-full"
                          />
                          <button onClick={() => renameVersion(v.id)} className="text-emerald-500 text-[10px]">Save</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold truncate">{v.name || `Version ${new Date(v.timestamp).toLocaleString()}`}</span>
                          <span className={`text-[9px] ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>{new Date(v.timestamp).toLocaleTimeString()}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {renamingId !== v.id && (
                        <button 
                          onClick={() => { setRenamingId(v.id); setNewName(v.name || ''); }}
                          className="p-1.5 rounded hover:bg-white/10 text-emerald-500"
                          title="Rename version"
                        >
                          <span className="text-[10px]">Edit</span>
                        </button>
                      )}
                      <button 
                        onClick={() => onRestore?.(v)}
                        className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                        title="Restore this version"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => deleteVersion(v.id)}
                        className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                        title="Delete version"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
