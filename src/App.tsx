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
import { useResumeStore } from './store';
import { detectOverflow } from './overflowDetection';
import { useFormatting, DEFAULT_STYLE } from './context/FormattingContext';
import { optimizeResume, OptimizationResult, EngineType, EngineConfig } from './services/geminiService';
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
  const { setData, pages } = useResumeStore();

  // Sync results with ResumeStore
  useEffect(() => {
    if (activeAudience && results[activeAudience]) {
      const res = results[activeAudience];
      setData({
        personal_info: {
          ...masterResume.personal_info,
          summary: res.summary
        },
        experience: res.experience.map((e, i) => ({ ...e, id: `exp_${i}` })),
        early_career: res.early_career,
        skills: res.skills as any, // Cast to any to handle both structures
        education: res.education as any,
        projects: res.projects?.map(p => typeof p === 'string' ? p : { title: (p as any).title, description: (p as any).description, isOptional: true as const }) as any,
        certifications: res.certifications || masterResume.certifications
      });
    }
  }, [activeAudience, results, setData]);

  const overflow = detectOverflow(pages);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showInsights, setShowInsights] = useState(false);
  
  const [engineConfig, setEngineConfig] = useState<Record<string, any>>({
    gemini: { model: 'gemini-3.1-pro-preview', apiKey: '' },
    openai: { model: 'gpt-4o', apiKey: '' },
    anthropic: { model: 'claude-3-5-sonnet-20240620', apiKey: '' }
  });
  const [selectedEngine, setSelectedEngine] = useState<EngineType>('gemini');
  const [showEngineSettings, setShowEngineSettings] = useState(false);
  
  const { state: formattingState, dispatch: formattingDispatch } = useFormatting();
  const { activeSection, styles: sectionStyles } = formattingState;

  const getSectionStyle = (sectionId: string) => sectionStyles[sectionId] || DEFAULT_STYLE;

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
      for (let i = 0; i < selectedAudiences.length; i++) {
        const audienceId = selectedAudiences[i];
        if (controller.signal.aborted) break;
        
        // Add a small delay between requests to avoid hitting RPM limits (especially for free tier)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          const audienceLabel = AUDIENCES.find(a => a.id === audienceId)?.label || audienceId;
          const currentEngineConfig = {
            engine: selectedEngine,
            model: engineConfig[selectedEngine].model,
            apiKey: engineConfig[selectedEngine].apiKey
          };
          const data = await optimizeResume(finalResumeText, jobDescription, finalTargetRole, mode, audienceLabel, currentEngineConfig);
          
          // Update results incrementally
          setResults(prev => ({ ...prev, [audienceId]: data }));
          if (!firstAudienceId) {
            firstAudienceId = audienceId;
            setActiveAudience(audienceId);
          }
        } catch (innerErr: any) {
          console.error(`Error optimizing for ${audienceId}:`, innerErr);
          const isRateLimit = innerErr?.message?.includes("429") || innerErr?.message?.includes("RESOURCE_EXHAUSTED") || innerErr?.message?.includes("quota");
          if (isRateLimit) {
            setError(`Rate limit or quota exceeded for ${audienceId}. Please try again in a few minutes or switch to a different AI engine in the settings.`);
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
    
    const skillsText = Array.isArray(res.skills) 
      ? res.skills.join(', ') 
      : Object.entries(res.skills).map(([cat, items]) => `${cat.toUpperCase()}: ${(items as string[]).join(', ')}`).join('\n');

    const text = `
${masterResume.personal_info.name}
${masterResume.personal_info.location} | ${masterResume.personal_info.email} | ${masterResume.personal_info.phone}

PROFESSIONAL SUMMARY
${res.summary}

SKILLS
${skillsText}

PROFESSIONAL EXPERIENCE
${res.experience.map(exp => `
${exp.role} | ${exp.duration}
${exp.company}
${exp.bullets.join('\n')}
`).join('\n')}

${res.early_career && res.early_career.length > 0 ? `SELECTED EARLY CAREER\n${res.early_career.join('\n')}\n` : ''}

CERTIFICATIONS
${(res.certifications || masterResume.certifications).join('\n')}

EDUCATION
${(res.education || [masterResume.education]).map(edu => typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (Expected ${edu.expected_completion})`).join('\n')}
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

  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPDF = async () => {
    const page1 = document.getElementById('resume-page-1');
    const page2 = document.getElementById('resume-page-2');
    if (!page1) return;

    // Temporarily clear active section for clean PDF
    const previousActiveSection = activeSection;
    formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: null });
    setIsDownloading(true);

    try {
      // Small delay to allow React to re-render with legacy-colors and without highlights
      await new Promise(resolve => setTimeout(resolve, 400));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm

      const captureOptions = {
        scale: 3, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794, // Force exact A4 width in px at 96dpi
        height: 1123, // Force exact A4 height in px at 96dpi
        onclone: (clonedDoc: Document) => {
          const page1Clone = clonedDoc.getElementById('resume-page-1');
          const page2Clone = clonedDoc.getElementById('resume-page-2');
          if (page1Clone) {
            page1Clone.style.width = '794px';
            page1Clone.style.height = '1123px';
            page1Clone.style.transform = 'none';
          }
          if (page2Clone) {
            page2Clone.style.width = '794px';
            page2Clone.style.height = '1123px';
            page2Clone.style.transform = 'none';
          }
        }
      };

      // Capture Page 1
      const canvas1 = await html2canvas(page1, captureOptions);
      const imgData1 = canvas1.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      // Capture Page 2
      if (page2) {
        pdf.addPage();
        const canvas2 = await html2canvas(page2, captureOptions);
        const imgData2 = canvas2.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }
      
      const fileName = `Professional_Resume_${(targetRole || "Expert").replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      // Restore active section
      if (previousActiveSection) {
        formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: previousActiveSection });
      }
      setIsDownloading(false);
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
        <div className="flex gap-8 relative">
          {/* Configuration Pane */}
          <div 
            style={{ width: `${configWidth}px` }}
            className={`flex-shrink-0 pr-4`}
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

                {/* AI Engine Settings */}
                <div className={`rounded-xl border p-4 transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                  <button 
                    onClick={() => setShowEngineSettings(!showEngineSettings)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">AI Engine Settings</span>
                    </div>
                    {showEngineSettings ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                  </button>
                  
                  <AnimatePresence>
                    {showEngineSettings && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 space-y-4 overflow-hidden"
                      >
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1 opacity-40">Select Engine</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(['gemini', 'openai', 'anthropic'] as const).map((eng) => (
                              <button
                                key={eng}
                                onClick={() => setSelectedEngine(eng)}
                                className={`py-1.5 text-[10px] font-bold rounded border transition-all capitalize ${
                                  selectedEngine === eng 
                                    ? (isDarkMode ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-black text-white border-black')
                                    : (isDarkMode ? 'bg-white/5 text-white/60 border-white/10' : 'bg-white text-black/60 border-black/5')
                                }`}
                              >
                                {eng}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1 opacity-40">Model</label>
                          <select 
                            className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-black/10 text-black'
                            }`}
                            value={engineConfig[selectedEngine].model}
                            onChange={(e) => setEngineConfig({
                              ...engineConfig,
                              [selectedEngine]: { ...engineConfig[selectedEngine], model: e.target.value }
                            })}
                          >
                            {selectedEngine === 'gemini' && (
                              <>
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                              </>
                            )}
                            {selectedEngine === 'openai' && (
                              <>
                                <option value="gpt-4o">GPT-4o</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                              </>
                            )}
                            {selectedEngine === 'anthropic' && (
                              <>
                                <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
                                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest mb-1 opacity-40">API Key (Optional if env set)</label>
                          <input 
                            type="password"
                            placeholder={`Enter ${selectedEngine} API key`}
                            className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-black/10 text-black'
                            }`}
                            value={engineConfig[selectedEngine].apiKey}
                            onChange={(e) => setEngineConfig({
                              ...engineConfig,
                              [selectedEngine]: { ...engineConfig[selectedEngine], apiKey: e.target.value }
                            })}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                                <th className="pb-2">Baseline</th>
                                <th className="pb-2">Optimized</th>
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
                                          <span className="opacity-50 font-bold">{res.baseline_score}%</span>
                                        ) : (
                                          <span className="opacity-30">--</span>
                                        )}
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
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {isOptimizing && Object.keys(results).length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed ${
                    isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/10'
                  }`}
                >
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <Cpu className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Optimizing Your Resume</h3>
                  <p className="opacity-50 max-w-sm text-sm">
                    Our AI is analyzing the job description and tailoring your experience for your target audiences...
                  </p>
                </motion.div>
              ) : Object.keys(results).length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed ${
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
                        {overflow.isOverflowing && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            OVERFLOW DETECTED
                          </div>
                        )}
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
                          disabled={isDownloading}
                          className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download PDF
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-8 bg-gray-200/50 custom-scrollbar flex flex-col items-center gap-8">
                      {/* Page 1 */}
                      <div 
                        id="resume-page-1"
                        className={`resume-page shadow-2xl transition-all duration-300 ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : ''}`}
                      >
                        {/* Header */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'header' })}
                          className={`cursor-pointer transition-all rounded p-2 -m-2 mb-6 ${activeSection === 'header' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('header').fontFamily, 
                            textAlign: 'center',
                            lineHeight: 1.4,
                            color: getSectionStyle('header').color,
                          }}
                        >
                          <h1 className="font-bold uppercase tracking-[0.15em] mb-2" style={{ fontSize: '24px' }}>
                            {masterResume.personal_info.name}
                          </h1>
                          <div className="font-medium opacity-80 border-t border-black/10 pt-2 flex justify-center gap-4 flex-wrap" style={{ fontSize: '12px' }}>
                            <span>{masterResume.personal_info.location}</span>
                            <span>&bull;</span>
                            <span>{masterResume.personal_info.email}</span>
                            <span>&bull;</span>
                            <span>{masterResume.personal_info.phone}</span>
                            {masterResume.personal_info.linkedin && (
                              <>
                                <span>&bull;</span>
                                <span>LinkedIn: {masterResume.personal_info.linkedin.replace('https://', '')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Professional Summary */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'summary' })}
                          className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'summary' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('summary').fontFamily, 
                            textAlign: 'justify',
                            lineHeight: 1.4,
                            color: getSectionStyle('summary').color,
                          }}
                        >
                          <h2 className="font-semibold mb-2 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                            Professional Summary
                          </h2>
                          <p className="opacity-90" style={{ fontSize: '11px' }}>{results[activeAudience]?.summary || masterResume.professional_summary_base}</p>
                        </div>

                        {/* Skills */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'skills' })}
                          className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'skills' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('skills').fontFamily, 
                            lineHeight: 1.4,
                            color: getSectionStyle('skills').color,
                          }}
                        >
                          <h2 className="font-semibold mb-2 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                            Core Competencies
                          </h2>
                          {results[activeAudience]?.skills && !Array.isArray(results[activeAudience].skills) ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2" style={{ fontSize: '11px' }}>
                              {Object.entries(results[activeAudience].skills).map(([category, items]) => (
                                <div key={category}>
                                  <div className="font-bold uppercase text-[10px] opacity-60 mb-0.5">{category}</div>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                    {(items as string[]).map((s, i) => (
                                      <span key={i} className="opacity-90">{s}{i < (items as string[]).length - 1 ? ',' : ''}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5" style={{ fontSize: '11px' }}>
                              {(Array.isArray(results[activeAudience]?.skills) ? results[activeAudience].skills as string[] : masterResume.core_competencies).map((s, i) => (
                                <div key={i} className="resume-bullet-item">
                                  <div className="resume-bullet-dot" />
                                  <span className="resume-bullet-text opacity-90">{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Experience (Page 1) */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'experience' })}
                          className={`cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('experience').fontFamily, 
                            lineHeight: 1.4,
                            color: getSectionStyle('experience').color,
                          }}
                        >
                          <h2 className="font-semibold mb-3 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                            Professional Experience
                          </h2>
                          {(() => {
                            const allExp = results[activeAudience]?.experience || masterResume.experience;
                            const splitIndex = Math.floor(allExp.length / 2);
                            return allExp.slice(0, splitIndex).map((exp, i) => (
                              <div key={i} className="mb-4 last:mb-0">
                                <div className="flex justify-between font-bold items-baseline mb-0.5">
                                  <span style={{ fontSize: '12px' }}>{exp.role}</span>
                                  <span className="opacity-70 font-normal italic" style={{ fontSize: '11px' }}>{exp.duration}</span>
                                </div>
                                <div className="font-medium mb-1 text-emerald-700" style={{ fontSize: '11px' }}>{exp.company}</div>
                                <div className="space-y-0.5">
                                  {exp.bullets.map((b, bi) => (
                                    <div key={bi} className="resume-bullet-item" style={{ fontSize: '11px' }}>
                                      <div className="resume-bullet-dot" />
                                      <span className="resume-bullet-text opacity-90">{b}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Page 2 */}
                      <div 
                        id="resume-page-2"
                        className={`resume-page shadow-2xl transition-all duration-300 relative overflow-hidden ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : ''}`}
                      >
                        {/* Experience Continued */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'experience' })}
                          className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('experience').fontFamily, 
                            lineHeight: 1.4,
                            color: getSectionStyle('experience').color,
                          }}
                        >
                          {(() => {
                            const allExp = results[activeAudience]?.experience || masterResume.experience;
                            const splitIndex = Math.floor(allExp.length / 2);
                            return allExp.slice(splitIndex).map((exp, i) => (
                              <div key={i} className="mb-4 last:mb-0">
                                <div className="flex justify-between font-bold items-baseline mb-0.5">
                                  <span style={{ fontSize: '12px' }}>{exp.role}</span>
                                  <span className="opacity-70 font-normal italic" style={{ fontSize: '11px' }}>{exp.duration}</span>
                                </div>
                                <div className="font-medium mb-1 text-emerald-700" style={{ fontSize: '11px' }}>{exp.company}</div>
                                <div className="space-y-0.5">
                                  {exp.bullets.map((b, bi) => (
                                    <div key={bi} className="resume-bullet-item" style={{ fontSize: '11px' }}>
                                      <div className="resume-bullet-dot" />
                                      <span className="resume-bullet-text opacity-90">{b}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ));
                          })()}

                          {/* Early Career */}
                          {results[activeAudience]?.early_career && results[activeAudience].early_career.length > 0 && (
                            <div className="mt-4">
                              <h2 className="font-semibold mb-2 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                                Selected Early Career
                              </h2>
                              <div className="space-y-0.5">
                                {results[activeAudience].early_career.map((b, i) => (
                                  <div key={i} className="resume-bullet-item" style={{ fontSize: '11px' }}>
                                    <div className="resume-bullet-dot" />
                                    <span className="resume-bullet-text opacity-90">{b}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Certifications */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'certifications' })}
                          className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'certifications' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('certifications').fontFamily, 
                            lineHeight: 1.4,
                            color: getSectionStyle('certifications').color,
                          }}
                        >
                          <h2 className="font-semibold mb-2 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                            Professional Certifications
                          </h2>
                          <div className="grid grid-cols-1 gap-0.5" style={{ fontSize: '11px' }}>
                            {(results[activeAudience]?.certifications || masterResume.certifications).map((cert, i) => (
                              <div key={i} className="resume-bullet-item">
                                <div className="resume-bullet-dot" />
                                <span className="resume-bullet-text opacity-90">{cert}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Projects */}
                        {results[activeAudience]?.projects && results[activeAudience].projects.length > 0 && (
                          <div 
                            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'projects' })}
                            className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'projects' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                            style={{ 
                              fontFamily: getSectionStyle('projects').fontFamily, 
                              lineHeight: 1.4,
                              color: getSectionStyle('projects').color,
                            }}
                          >
                            <h2 className="font-semibold mb-3 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                              Key Strategic Projects
                            </h2>
                            <div className="space-y-2">
                              {results[activeAudience].projects.map((proj, i) => (
                                <div key={i} className="resume-bullet-item" style={{ fontSize: '11px' }}>
                                  <div className="resume-bullet-dot" />
                                  <span className="resume-bullet-text opacity-90">
                                    {typeof proj === 'string' ? proj : (proj as any).title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Education */}
                        <div 
                          onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'education' })}
                          className={`mb-5 cursor-pointer transition-all rounded p-2 -m-2 ${activeSection === 'education' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
                          style={{ 
                            fontFamily: getSectionStyle('education').fontFamily, 
                            lineHeight: 1.4,
                            color: getSectionStyle('education').color,
                          }}
                        >
                          <h2 className="font-semibold mb-2 uppercase tracking-widest border-b border-black/20 pb-1" style={{ fontSize: '14px' }}>
                            Education
                          </h2>
                          {(results[activeAudience]?.education || [masterResume.education]).map((edu, i) => (
                            <div key={i} className="mb-2 last:mb-0">
                              <div className="resume-bullet-item" style={{ fontSize: '11px' }}>
                                <div className="resume-bullet-dot" />
                                <span className="resume-bullet-text opacity-90">
                                  {typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (${edu.expected_completion})`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Download Button */}
                    <div className="p-4 border-t border-white/10 flex justify-center bg-white/5">
                      <button 
                        onClick={downloadPDF}
                        disabled={isDownloading}
                        className="px-8 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all transform hover:scale-105 font-bold uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {isDownloading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            Finalize & Download Resume
                          </>
                        )}
                      </button>
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
