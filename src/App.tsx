import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Briefcase, 
  Target, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  Download, 
  Copy,
  Search,
  Layout,
  Cpu,
  BarChart3,
  Info,
  Moon,
  Sun,
  Trash2,
  Upload,
  Users,
  Eye,
  FileDown,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toolbar } from './components/Toolbar';
import { useFormatting } from './context/FormattingContext';
import { optimizeResume, OptimizationResult } from './services/geminiService';
import masterResume from './services/masterResume.json';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type OptimizationMode = 'conservative' | 'balanced' | 'aggressive';

const MODE_DESCRIPTIONS = {
  conservative: "Minimal edits. Preserves your original structure and wording while ensuring basic keyword alignment.",
  balanced: "The 'Sweet Spot'. Improves clarity, strengthens action verbs, and strategically aligns keywords. Recommended.",
  aggressive: "Maximum Impact. Rewrites bullets for peak ATS compatibility and high-stakes competitive roles."
};

const AUDIENCES = [
  { id: 'microsoft', label: 'Microsoft / Enterprise', icon: '🏢' },
  { id: 'startup', label: 'Startup / Agile', icon: '🚀' },
  { id: 'executive', label: 'Executive / Leadership', icon: '👔' },
  { id: 'technical', label: 'Deep Technical / Engineering', icon: '💻' },
  { id: 'consulting', label: 'Consulting / Client-Facing', icon: '🤝' }
];

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [mode, setMode] = useState<OptimizationMode>('balanced');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['microsoft']);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState<Record<string, OptimizationResult>>({});
  const [activeAudience, setActiveAudience] = useState<string | null>(null);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showInsights, setShowInsights] = useState(false);
  
  const { state: formattingState, dispatch: formattingDispatch } = useFormatting();
  const { activeSection, styles: sectionStyles } = formattingState;

  const [configWidth, setConfigWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const resumePreviewRef = useRef<HTMLDivElement>(null);

  const extractTextFromPDF = async (file: File) => {
    setIsExtracting(true);
    setFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      setResumeText(fullText);
    } catch (err) {
      console.error('Error extracting PDF text:', err);
      setError('Failed to extract text from PDF. Please try pasting the text manually.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        extractTextFromPDF(file);
      } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setResumeText(event.target?.result as string);
          setFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        setError('Please upload a PDF or TXT file.');
      }
    }
  };

  const toggleAudience = (id: string) => {
    setSelectedAudiences(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleOptimize = async () => {
    if (!jobDescription) {
      setError('Please provide a job description to optimize against.');
      return;
    }

    if (selectedAudiences.length === 0) {
      setError('Please select at least one target audience.');
      return;
    }

    setIsOptimizing(true);
    setError(null);
    setResults({});
    setActiveAudience(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const finalResumeText = resumeText || JSON.stringify(masterResume, null, 2);
      const finalTargetRole = targetRole || "Professional Candidate";
      
      let firstAudienceId: string | null = null;
      
      // Process audiences one by one
      for (const audienceId of selectedAudiences) {
        if (controller.signal.aborted) break;
        
        try {
          const audienceLabel = AUDIENCES.find(a => a.id === audienceId)?.label || audienceId;
          const data = await optimizeResume(finalResumeText, jobDescription, finalTargetRole, mode, audienceLabel);
          
          // Update results incrementally
          setResults(prev => ({ ...prev, [audienceId]: data }));
          if (!firstAudienceId) {
            firstAudienceId = audienceId;
            setActiveAudience(audienceId);
          }
        } catch (innerErr: any) {
          console.error(`Error optimizing for ${audienceId}:`, innerErr);
          const isRateLimit = innerErr?.message?.includes("429") || innerErr?.message?.includes("RESOURCE_EXHAUSTED");
          if (isRateLimit) {
            setError(`Rate limit exceeded for ${audienceId}. Please wait a moment and try again.`);
          } else {
            setError(`Failed to optimize for ${audienceId}. ${innerErr.message || ''}`);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Optimization aborted');
      } else {
        console.error(err);
        setError('Failed to optimize resume. Please try again.');
      }
    } finally {
      setIsOptimizing(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsOptimizing(false);
      setAbortController(null);
    }
  };

  const toggleReport = (id: string) => {
    setExpandedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyResumeText = () => {
    if (!activeAudience || !results[activeAudience]) return;
    const res = results[activeAudience];
    const text = `
${masterResume.personal_info.name}
${masterResume.personal_info.location} | ${masterResume.personal_info.email} | ${masterResume.personal_info.phone}

PROFESSIONAL SUMMARY
${res.summary}

SKILLS
${res.skills.join('\n')}

PROFESSIONAL EXPERIENCE
${res.experience.map(exp => `
${exp.role} | ${exp.duration}
${exp.company}
${exp.bullets.join('\n')}
`).join('\n')}

CERTIFICATIONS
${masterResume.certifications.join('\n')}

EDUCATION
${masterResume.education.degree} - ${masterResume.education.institution} (Expected ${masterResume.education.expected_completion})
    `.trim();
    
    navigator.clipboard.writeText(text);
    alert('Resume text copied to clipboard! You can paste this into Word or any other editor.');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(800, e.clientX));
      setConfigWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const downloadPDF = async () => {
    if (!resumePreviewRef.current) return;
    
    try {
      // Temporarily show the hidden preview for capturing
      const element = resumePreviewRef.current;
      element.style.position = 'relative';
      element.style.left = '0';
      element.style.visibility = 'visible';
      element.style.pointerEvents = 'auto';

      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        allowTaint: true
      });

      // Restore hidden state
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      element.style.visibility = 'hidden';
      element.style.pointerEvents = 'none';
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4', true);
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const fileName = `Optimized_Resume_${(targetRole || "Professional").replace(/\s+/g, '_')}_${activeAudience}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF. Please try again or use the Copy Text button.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearInputs = () => {
    setResumeText('');
    setJobDescription('');
    setTargetRole('');
    setResults({});
    setActiveAudience(null);
    setFileName(null);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#F5F5F5] text-[#1A1A1A]'} font-sans selection:bg-emerald-500/30`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 transition-colors ${isDarkMode ? 'bg-[#0A0A0A]/80 backdrop-blur-md border-white/10' : 'bg-white/80 backdrop-blur-md border-black/5'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-emerald-500' : 'bg-black'}`}>
              <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-black' : 'text-emerald-400'}`} />
            </div>
            <span className="font-bold text-xl tracking-tight">ATS.OPTIMIZER</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-amber-400' : 'hover:bg-black/5 text-blue-600'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <span className={`text-[10px] font-mono uppercase tracking-widest opacity-40`}>v1.0.0-stable</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="flex gap-8 relative h-[calc(100vh-200px)]">
          {/* Configuration Pane */}
          <div 
            style={{ width: `${configWidth}px` }}
            className={`flex-shrink-0 overflow-y-auto pr-4 custom-scrollbar h-full`}
          >
            <div className="space-y-6">
            <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Layout className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <h2 className="font-semibold text-lg">Configuration</h2>
                </div>
                <button 
                  onClick={clearInputs}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-white/40 hover:text-red-400' : 'hover:bg-black/5 text-black/40 hover:text-red-600'}`}
                  title="Clear all inputs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Target Role */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Target Role (Optional)</label>
                  <div className="relative">
                    <Target className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30`} />
                    <input 
                      type="text"
                      placeholder="e.g. Senior Azure Cloud Architect"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                      }`}
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                    />
                  </div>
                </div>

                {/* Audience Selection */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Target Audiences (Multi-select)</label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCES.map((audience) => (
                      <button
                        key={audience.id}
                        onClick={() => toggleAudience(audience.id)}
                        className={`px-3 py-2 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-2 ${
                          selectedAudiences.includes(audience.id)
                            ? (isDarkMode ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-black text-white border-black')
                            : (isDarkMode ? 'bg-white/5 text-white/60 border-white/10 hover:border-white/30' : 'bg-white text-black/60 border-black/5 hover:border-black/20')
                        }`}
                      >
                        <span>{audience.icon}</span>
                        {audience.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optimization Mode */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest opacity-50`}>Optimization Mode</label>
                    <button 
                      onMouseEnter={() => setShowModeInfo(true)}
                      onMouseLeave={() => setShowModeInfo(false)}
                      className="text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {showModeInfo && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`mb-3 p-3 rounded-lg text-xs leading-relaxed border ${
                          isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        }`}
                      >
                        <p className="font-bold mb-1">Mode Details:</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold">Conservative:</span> {MODE_DESCRIPTIONS.conservative}</li>
                          <li><span className="font-semibold">Balanced:</span> {MODE_DESCRIPTIONS.balanced}</li>
                          <li><span className="font-semibold">Aggressive:</span> {MODE_DESCRIPTIONS.aggressive}</li>
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-3 gap-2">
                    {(['conservative', 'balanced', 'aggressive'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`py-2 text-[11px] font-bold rounded-lg border transition-all capitalize tracking-tight ${
                          mode === m 
                            ? (isDarkMode ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-black text-white border-black')
                            : (isDarkMode ? 'bg-white/5 text-white/60 border-white/10 hover:border-white/30' : 'bg-white text-black/60 border-black/5 hover:border-black/20')
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resume Upload */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Current Resume (Optional)</label>
                  <div className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10 hover:border-emerald-500/50' : 'bg-[#F9F9F9] border-black/10 hover:border-emerald-500/50'
                  }`}>
                    <input 
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      {isExtracting ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium opacity-60">Extracting text...</span>
                        </div>
                      ) : fileName ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-8 h-8 text-emerald-500" />
                          <span className="text-xs font-bold truncate max-w-[200px]">{fileName}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFileName(null); setResumeText(''); }}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 opacity-30" />
                          <span className="text-xs font-medium opacity-60 text-center">
                            Click or drag to upload your resume<br/>
                            <span className="text-[10px] opacity-40">If empty, we'll use your Master Resume JSON</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {resumeText && !isExtracting && (
                    <div className="mt-2">
                      <button 
                        onClick={() => setShowModeInfo(!showModeInfo)} // Reusing state for simplicity in demo
                        className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        {resumeText.length > 100 ? 'Text Extracted' : 'Preview Text'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Job Description */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Job Description</label>
                  <textarea 
                    placeholder="Paste the target job description here..."
                    className={`w-full h-32 p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm leading-relaxed ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                    }`}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>

                {error && (
                  <div className={`p-3 border rounded-lg flex items-center gap-2 text-sm ${
                    isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'
                  }`}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {/* Strategic Optimization Insights (Merged Section) */}
                {Object.keys(results).length > 0 && (
                  <div className={`mb-6 rounded-xl border overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                    <button 
                      onClick={() => setShowInsights(!showInsights)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-bold uppercase tracking-wider">Strategic Optimization Insights</h3>
                          <p className="text-[10px] opacity-50 uppercase font-bold">Compare audiences & view detailed ATS reports</p>
                        </div>
                      </div>
                      {showInsights ? <ChevronDown className="w-5 h-5 opacity-50" /> : <ChevronRight className="w-5 h-5 opacity-50" />}
                    </button>

                    {showInsights && (
                      <div className="p-4 border-t border-white/10">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="opacity-40 uppercase font-bold text-[10px] tracking-widest border-b border-white/10">
                                <th className="pb-2 px-2">Select</th>
                                <th className="pb-2">Target Audience</th>
                                <th className="pb-2">ATS Score</th>
                                <th className="pb-2">Keywords</th>
                                <th className="pb-2">Report</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {selectedAudiences.map((audId) => {
                                const res = results[audId];
                                const aud = AUDIENCES.find(a => a.id === audId);
                                const isExpanded = expandedReports[audId];
                                return (
                                  <React.Fragment key={audId}>
                                    <tr className={`${isDarkMode ? 'border-white/5' : 'border-black/5'} ${activeAudience === audId ? (isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-50') : ''}`}>
                                      <td className="py-3 px-2">
                                        <input 
                                          type="radio" 
                                          name="activeResult"
                                          checked={activeAudience === audId}
                                          onChange={() => setActiveAudience(audId)}
                                          disabled={!res}
                                          className="accent-emerald-500 w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                      <td className="py-3 font-medium">
                                        <div className="flex items-center gap-2">
                                          <span>{aud?.icon}</span>
                                          <span>{aud?.label}</span>
                                        </div>
                                      </td>
                                      <td className="py-3">
                                        {res ? (
                                          <span className="text-emerald-500 font-bold">{res.match_score}%</span>
                                        ) : (
                                          <span className="opacity-30">--</span>
                                        )}
                                      </td>
                                      <td className="py-3">
                                        {res ? (
                                          <span className="text-blue-500 font-bold">{res.ats_keywords_from_jd.length}</span>
                                        ) : (
                                          <span className="opacity-30">--</span>
                                        )}
                                      </td>
                                      <td className="py-3">
                                        <div className="flex items-center gap-3">
                                          {res ? (
                                            <>
                                              <span className="text-[10px] font-bold text-emerald-500 uppercase">Ready</span>
                                              <button 
                                                onClick={() => toggleReport(audId)}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${isExpanded ? 'text-emerald-500' : 'opacity-40'}`}
                                              >
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                              </button>
                                            </>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                              <span className="text-[10px] font-bold opacity-40 uppercase">Pending</span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                    {isExpanded && res && (
                                      <tr>
                                        <td colSpan={5} className={`p-4 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                                          <div className="grid grid-cols-2 gap-4 text-[11px]">
                                            <div>
                                              <h4 className="font-bold uppercase opacity-50 mb-2">Keywords Added</h4>
                                              <div className="flex flex-wrap gap-1">
                                                {res.ats_keywords_added_to_resume.map((k, i) => (
                                                  <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{k}</span>
                                                ))}
                                              </div>
                                            </div>
                                            <div>
                                              <h4 className="font-bold uppercase opacity-50 mb-2">Keyword Gaps</h4>
                                              <div className="flex flex-wrap gap-1">
                                                {res.keyword_gap.map((k, i) => (
                                                  <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">{k}</span>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="col-span-2 mt-2">
                                              <h4 className="font-bold uppercase opacity-50 mb-1">Audience Strategy</h4>
                                              <p className="italic opacity-70">{res.audience_alignment_notes}</p>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleOptimize}
                    disabled={isOptimizing || isExtracting}
                    className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      isOptimizing 
                        ? 'bg-emerald-500/50 cursor-not-allowed' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    }`}
                  >
                    {isOptimizing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Optimize Resume
                      </>
                    )}
                  </button>
                  
                  {isOptimizing && (
                    <button
                      onClick={handleStop}
                      className="px-6 py-4 rounded-xl font-bold bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Resize Handle */}
          <div 
            onMouseDown={handleMouseDown}
            className={`w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors self-stretch rounded-full ${isResizing ? 'bg-emerald-500' : 'bg-white/10'}`}
          />

          {/* Result Section */}
          <div className="flex-1 overflow-y-auto h-full custom-scrollbar">
            <AnimatePresence mode="wait">
              {Object.keys(results).length === 0 && !isOptimizing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`h-full flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed ${
                    isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/10'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <Search className={`w-8 h-8 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Ready for Analysis</h3>
                  <p className="opacity-50 max-w-sm text-sm">
                    Upload your resume and select your target audiences to begin the AI-powered optimization process.
                  </p>
                </motion.div>
              ) : (activeAudience && results[activeAudience]) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Resume Preview Pane */}
                  <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-xl'}`}>
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/5">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500/50" />
                        </div>
                        <div className="h-4 w-[1px] bg-white/10 mx-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                          Editing: <span className="text-emerald-400">{activeSection || 'Select a section'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={copyResumeText}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                          title="Copy text for selectable use"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Text
                        </button>
                        <button 
                          onClick={downloadPDF}
                          className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 border-b border-white/10">
                      <Toolbar />
                    </div>
                    
                    <div className="max-h-[800px] overflow-y-auto p-8 bg-gray-200/50 custom-scrollbar">
                      <div 
                        className={`w-full mx-auto bg-white text-black p-[20mm] shadow-2xl min-h-[297mm] transition-all duration-300 ${activeSection ? 'ring-2 ring-emerald-500/20' : ''}`}
                      >
                        {/* Header - Centered as per screenshot */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'header' })}
                          className={`cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'header' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.header.fontFamily, 
                            fontSize: `${sectionStyles.header.fontSize}pt`,
                            textAlign: sectionStyles.header.textAlign,
                            lineHeight: sectionStyles.header.lineHeight,
                            color: sectionStyles.header.color,
                            letterSpacing: `${sectionStyles.header.letterSpacing}px`,
                            textTransform: sectionStyles.header.textTransform,
                            fontWeight: sectionStyles.header.fontWeight,
                            fontStyle: sectionStyles.header.fontStyle,
                            textDecoration: sectionStyles.header.textDecoration
                          }}
                        >
                          <h1 className="text-4xl font-bold uppercase tracking-[0.1em] mb-1 leading-none" style={{ fontFamily: sectionStyles.header.fontFamily }}>
                            {masterResume.personal_info.name}
                          </h1>
                          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 border-t border-b border-black py-1 mt-2">
                            {masterResume.personal_info.location.toUpperCase()} | {masterResume.personal_info.email.toUpperCase()} | {masterResume.personal_info.phone}
                          </div>
                        </div>
                        
                        {/* Professional Summary */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'summary' })}
                          className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 mt-4 ${activeSection === 'summary' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.summary.fontFamily, 
                            fontSize: `${sectionStyles.summary.fontSize}pt`,
                            textAlign: sectionStyles.summary.textAlign,
                            lineHeight: sectionStyles.summary.lineHeight,
                            color: sectionStyles.summary.color,
                            letterSpacing: `${sectionStyles.summary.letterSpacing}px`,
                            textTransform: sectionStyles.summary.textTransform,
                            fontWeight: sectionStyles.summary.fontWeight,
                            fontStyle: sectionStyles.summary.fontStyle,
                            textDecoration: sectionStyles.summary.textDecoration
                          }}
                        >
                          <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                            <span className="bg-white pr-2">Professional Summary</span>
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                          </h2>
                          <p>{results[activeAudience].summary}</p>
                        </div>

                        {/* Skills - Centered Header, Bulleted List */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'skills' })}
                          className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'skills' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.skills.fontFamily, 
                            fontSize: `${sectionStyles.skills.fontSize}pt`,
                            textAlign: sectionStyles.skills.textAlign,
                            lineHeight: sectionStyles.skills.lineHeight,
                            color: sectionStyles.skills.color,
                            letterSpacing: `${sectionStyles.skills.letterSpacing}px`,
                            textTransform: sectionStyles.skills.textTransform,
                            fontWeight: sectionStyles.skills.fontWeight,
                            fontStyle: sectionStyles.skills.fontStyle,
                            textDecoration: sectionStyles.skills.textDecoration
                          }}
                        >
                          <h2 className="text-sm font-bold border-b border-black mb-3 uppercase tracking-widest text-center flex items-center">
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                            <span className="px-4">SKILLS</span>
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                          </h2>
                          <div className="grid grid-cols-1 gap-y-1">
                            {results[activeAudience].skills.map((s, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Experience */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'experience' })}
                          className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.experience.fontFamily, 
                            fontSize: `${sectionStyles.experience.fontSize}pt`,
                            textAlign: sectionStyles.experience.textAlign,
                            lineHeight: sectionStyles.experience.lineHeight,
                            color: sectionStyles.experience.color,
                            letterSpacing: `${sectionStyles.experience.letterSpacing}px`,
                            textTransform: sectionStyles.experience.textTransform,
                            fontWeight: sectionStyles.experience.fontWeight,
                            fontStyle: sectionStyles.experience.fontStyle,
                            textDecoration: sectionStyles.experience.textDecoration
                          }}
                        >
                          <h2 className="text-sm font-bold border-b border-black mb-3 uppercase tracking-widest flex items-center">
                            <span className="bg-white pr-2">Professional Experience</span>
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                          </h2>
                          {results[activeAudience].experience.map((exp, i) => (
                            <div key={i} className="mb-4">
                              <div className="flex justify-between font-bold items-baseline">
                                <span className="text-[1.1em]">{exp.role.toUpperCase()}</span>
                                <span className="text-[0.9em] opacity-70">{exp.duration}</span>
                              </div>
                              <div className="italic font-medium mb-1 opacity-80">{exp.company}</div>
                              <div className="space-y-1">
                                {exp.bullets.map((b, bi) => (
                                  <div key={bi} className="flex items-start gap-2">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                                    <span>{b}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Certifications */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'certifications' })}
                          className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'certifications' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.certifications.fontFamily, 
                            fontSize: `${sectionStyles.certifications.fontSize}pt`,
                            textAlign: sectionStyles.certifications.textAlign,
                            lineHeight: sectionStyles.certifications.lineHeight,
                            color: sectionStyles.certifications.color,
                            letterSpacing: `${sectionStyles.certifications.letterSpacing}px`,
                            textTransform: sectionStyles.certifications.textTransform,
                            fontWeight: sectionStyles.certifications.fontWeight,
                            fontStyle: sectionStyles.certifications.fontStyle,
                            textDecoration: sectionStyles.certifications.textDecoration
                          }}
                        >
                          <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                            <span className="bg-white pr-2">Certifications</span>
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                          </h2>
                          <div className="grid grid-cols-1 gap-y-1">
                            {masterResume.certifications.map((cert, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                                <span className="text-black">{cert}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Education */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'education' })}
                          className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'education' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: sectionStyles.education.fontFamily, 
                            fontSize: `${sectionStyles.education.fontSize}pt`,
                            textAlign: sectionStyles.education.textAlign,
                            lineHeight: sectionStyles.education.lineHeight,
                            color: sectionStyles.education.color,
                            letterSpacing: `${sectionStyles.education.letterSpacing}px`,
                            textTransform: sectionStyles.education.textTransform,
                            fontWeight: sectionStyles.education.fontWeight,
                            fontStyle: sectionStyles.education.fontStyle,
                            textDecoration: sectionStyles.education.textDecoration
                          }}
                        >
                          <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                            <span className="bg-white pr-2">Education</span>
                            <div className="flex-1 h-[1px] bg-black/20"></div>
                          </h2>
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold">{masterResume.education.degree}</span>
                            <span className="text-[0.9em] opacity-70">Expected {masterResume.education.expected_completion}</span>
                          </div>
                          <div className="italic opacity-80">{masterResume.education.institution}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Download Button */}
                    <div className="p-4 border-t border-white/10 flex justify-center bg-white/5">
                      <button 
                        onClick={downloadPDF}
                        className="px-8 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all transform hover:scale-105 font-bold uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-500/20"
                      >
                        <Download className="w-5 h-5" />
                        Finalize & Download Resume
                      </button>
                    </div>
                  </div>

                  {/* Hidden Preview for PDF Generation */}
                  <div className="fixed -left-[9999px] top-0 pointer-events-none">
                    <div 
                      ref={resumePreviewRef}
                      className={`w-[210mm] min-h-[297mm] p-[20mm] bg-white text-black legacy-colors`}
                    >
                      <div className="text-center mb-6" style={{ 
                        fontFamily: sectionStyles.header.fontFamily, 
                        fontSize: `${sectionStyles.header.fontSize}pt`,
                        textAlign: sectionStyles.header.textAlign,
                        lineHeight: sectionStyles.header.lineHeight,
                        color: sectionStyles.header.color,
                        letterSpacing: `${sectionStyles.header.letterSpacing}px`,
                        textTransform: sectionStyles.header.textTransform,
                        fontWeight: sectionStyles.header.fontWeight,
                        fontStyle: sectionStyles.header.fontStyle,
                        textDecoration: sectionStyles.header.textDecoration
                      }}>
                        <h1 className="text-4xl font-bold uppercase tracking-[0.1em] mb-1 leading-none" style={{ fontFamily: sectionStyles.header.fontFamily }}>
                          {masterResume.personal_info.name}
                        </h1>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 border-t border-b border-black py-1 mt-2">
                          {masterResume.personal_info.location.toUpperCase()} | {masterResume.personal_info.email.toUpperCase()} | {masterResume.personal_info.phone}
                        </div>
                      </div>
                      
                      <div className="mb-6" style={{ 
                        fontFamily: sectionStyles.summary.fontFamily, 
                        fontSize: `${sectionStyles.summary.fontSize}pt`,
                        textAlign: sectionStyles.summary.textAlign,
                        lineHeight: sectionStyles.summary.lineHeight,
                        color: sectionStyles.summary.color,
                        letterSpacing: `${sectionStyles.summary.letterSpacing}px`,
                        textTransform: sectionStyles.summary.textTransform,
                        fontWeight: sectionStyles.summary.fontWeight,
                        fontStyle: sectionStyles.summary.fontStyle,
                        textDecoration: sectionStyles.summary.textDecoration
                      }}>
                        <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                          <span className="bg-white pr-2">Professional Summary</span>
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                        </h2>
                        <p>{results[activeAudience].summary}</p>
                      </div>

                      <div className="mb-6" style={{ 
                        fontFamily: sectionStyles.skills.fontFamily, 
                        fontSize: `${sectionStyles.skills.fontSize}pt`,
                        textAlign: sectionStyles.skills.textAlign,
                        lineHeight: sectionStyles.skills.lineHeight,
                        color: sectionStyles.skills.color,
                        letterSpacing: `${sectionStyles.skills.letterSpacing}px`,
                        textTransform: sectionStyles.skills.textTransform,
                        fontWeight: sectionStyles.skills.fontWeight,
                        fontStyle: sectionStyles.skills.fontStyle,
                        textDecoration: sectionStyles.skills.textDecoration
                      }}>
                        <h2 className="text-sm font-bold border-b border-black mb-3 uppercase tracking-widest text-center flex items-center">
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                          <span className="px-4">SKILLS</span>
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                        </h2>
                        <div className="grid grid-cols-1 gap-y-1">
                          {results[activeAudience].skills.map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6" style={{ 
                        fontFamily: sectionStyles.experience.fontFamily, 
                        fontSize: `${sectionStyles.experience.fontSize}pt`,
                        textAlign: sectionStyles.experience.textAlign,
                        lineHeight: sectionStyles.experience.lineHeight,
                        color: sectionStyles.experience.color,
                        letterSpacing: `${sectionStyles.experience.letterSpacing}px`,
                        textTransform: sectionStyles.experience.textTransform,
                        fontWeight: sectionStyles.experience.fontWeight,
                        fontStyle: sectionStyles.experience.fontStyle,
                        textDecoration: sectionStyles.experience.textDecoration
                      }}>
                        <h2 className="text-sm font-bold border-b border-black mb-3 uppercase tracking-widest flex items-center">
                          <span className="bg-white pr-2">Professional Experience</span>
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                        </h2>
                        {results[activeAudience].experience.map((exp, i) => (
                          <div key={i} className="mb-4">
                            <div className="flex justify-between font-bold items-baseline">
                              <span className="text-[1.1em]">{exp.role.toUpperCase()}</span>
                              <span className="text-[0.9em] opacity-70">{exp.duration}</span>
                            </div>
                            <div className="italic font-medium mb-1 opacity-80">{exp.company}</div>
                            <div className="space-y-1">
                              {exp.bullets.map((b, bi) => (
                                <div key={bi} className="flex items-start gap-2">
                                  <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                                  <span>{b}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mb-6" style={{ 
                        fontFamily: sectionStyles.certifications.fontFamily, 
                        fontSize: `${sectionStyles.certifications.fontSize}pt`,
                        textAlign: sectionStyles.certifications.textAlign,
                        lineHeight: sectionStyles.certifications.lineHeight,
                        color: sectionStyles.certifications.color,
                        letterSpacing: `${sectionStyles.certifications.letterSpacing}px`,
                        textTransform: sectionStyles.certifications.textTransform,
                        fontWeight: sectionStyles.certifications.fontWeight,
                        fontStyle: sectionStyles.certifications.fontStyle,
                        textDecoration: sectionStyles.certifications.textDecoration
                      }}>
                        <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                          <span className="bg-white pr-2">Certifications</span>
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                        </h2>
                        <div className="grid grid-cols-1 gap-y-1">
                          {masterResume.certifications.map((cert, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                              <span>{cert}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6" style={{ 
                        fontFamily: sectionStyles.education.fontFamily, 
                        fontSize: `${sectionStyles.education.fontSize}pt`,
                        textAlign: sectionStyles.education.textAlign,
                        lineHeight: sectionStyles.education.lineHeight,
                        color: sectionStyles.education.color,
                        letterSpacing: `${sectionStyles.education.letterSpacing}px`,
                        textTransform: sectionStyles.education.textTransform,
                        fontWeight: sectionStyles.education.fontWeight,
                        fontStyle: sectionStyles.education.fontStyle,
                        textDecoration: sectionStyles.education.textDecoration
                      }}>
                        <h2 className="text-sm font-bold border-b border-black mb-2 uppercase tracking-widest flex items-center">
                          <span className="bg-white pr-2">Education</span>
                          <div className="flex-1 h-[1px] bg-gray-200"></div>
                        </h2>
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold">{masterResume.education.degree}</span>
                          <span className="text-[0.9em] opacity-70">Expected {masterResume.education.expected_completion}</span>
                        </div>
                        <div className="italic opacity-80">{masterResume.education.institution}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className={`max-w-7xl mx-auto px-4 py-12 border-t mt-12 transition-colors ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 opacity-20" />
            <span className="text-[10px] font-bold opacity-20 uppercase tracking-widest">ATS Optimizer Engine</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-[10px] font-bold opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest">Privacy</a>
            <a href="#" className="text-[10px] font-bold opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest">Terms</a>
            <a href="#" className="text-[10px] font-bold opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
