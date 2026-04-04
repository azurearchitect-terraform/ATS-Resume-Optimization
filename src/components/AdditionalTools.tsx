import React, { useState, useEffect } from 'react';
import { Zap, Brain, History, Trash2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, FileText, Copy, Download } from 'lucide-react';
import { EngineConfig, EngineType, analyzeSkillGap, generateInterviewQuestions, generateCoverLetter, generateRecruiterMessage } from '../services/geminiService';

interface AdditionalToolsProps {
  resumeText: string;
  jobDescription: string;
  targetRole: string;
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: EngineType;
  onRestore?: (version: any) => void;
  currentResults?: any;
  setResumeText: (text: string) => void;
}

export const AdditionalTools: React.FC<AdditionalToolsProps> = ({ 
  resumeText, 
  jobDescription, 
  targetRole,
  isDarkMode, 
  engineConfig, 
  selectedEngine,
  onRestore,
  currentResults,
  setResumeText
}) => {
  const [activeTab, setActiveTab] = useState<'skillGap' | 'interview' | 'history' | 'coverLetter' | 'recruiterMessage'>('skillGap');
  const [skillGap, setSkillGap] = useState<{missing: string[], present: string[]} | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [recruiterMessage, setRecruiterMessage] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [saveName, setSaveName] = useState('');

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
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setSkillGap(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to analyze skill gap.");
    }
    setIsLoading(false);
  };

  const addMissingSkills = () => {
    if (!skillGap || skillGap.missing.length === 0) return;
    const newResumeText = `${resumeText}\n\nSkills: ${skillGap.missing.join(', ')}`;
    setResumeText(newResumeText);
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
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setInterviewQuestions(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate interview questions.");
    }
    setIsLoading(false);
  };

  const runRecruiterMessage = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateRecruiterMessage(jobDescription, resumeText, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setRecruiterMessage(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate recruiter message.");
    }
    setIsLoading(false);
  };

  const runCoverLetter = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateCoverLetter(jobDescription, resumeText, targetRole, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setCoverLetter(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate cover letter.");
    }
    setIsLoading(false);
  };

  const saveVersion = () => {
    const timestamp = new Date().toISOString();
    const newVersion = { 
      id: Date.now(), 
      timestamp,
      name: saveName || `Version ${new Date(timestamp).toLocaleString()}`,
      data: { 
        resumeText, 
        jobDescription,
        results: currentResults
      } 
    };
    const newHistory = [newVersion, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
    setSaveName('');
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
      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('skillGap')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'skillGap' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
          }`}
        >
          <Zap className="w-5 h-5"/>
          Gap Analysis
        </button>
        <button 
          onClick={() => setActiveTab('interview')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'interview' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
          }`}
        >
          <Brain className="w-5 h-5"/>
          Interview
        </button>
        <button 
          onClick={() => setActiveTab('coverLetter')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'coverLetter' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
          }`}
        >
          <FileText className="w-5 h-5"/>
          Cover Letter
        </button>
        <button 
          onClick={() => setActiveTab('recruiterMessage')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'recruiterMessage' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
          }`}
        >
          <FileText className="w-5 h-5"/>
          Recruiter Msg
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
            activeTab === 'history' 
              ? 'bg-emerald-500 text-black' 
              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
          }`}
        >
          <History className="w-5 h-5"/>
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
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
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
                <button 
                  onClick={addMissingSkills}
                  className="mt-2 w-full bg-red-500 hover:bg-red-400 text-black font-bold py-1 rounded text-[10px] transition-colors"
                >
                  Add Missing Skills
                </button>
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
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
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

      {activeTab === 'coverLetter' && (
        <div className="space-y-4">
          <button 
            onClick={runCoverLetter} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Cover Letter'}
          </button>
          {coverLetter && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                {coverLetter}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(coverLetter);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recruiterMessage' && (
        <div className="space-y-4">
          <button 
            onClick={runRecruiterMessage} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Message'}
          </button>
          {recruiterMessage && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                {recruiterMessage}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(recruiterMessage);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Version name (e.g. Perfect Version)"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className={`flex-1 px-3 py-2 text-[10px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-black/5 text-black'
              }`}
            />
            <button 
              onClick={saveVersion} 
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-3 rounded-xl text-[10px] transition-colors whitespace-nowrap"
            >
              Save Version
            </button>
          </div>
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
