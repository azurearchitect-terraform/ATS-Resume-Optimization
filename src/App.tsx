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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from './components/SortableSection';
import { AdditionalTools } from './components/AdditionalTools';
import { useResumeStore } from './store';
import { detectOverflow } from './overflowDetection';
import { useFormatting, DEFAULT_STYLE } from './context/FormattingContext';
import { optimizeResume, fetchJobDescription, OptimizationResult, EngineType, EngineConfig } from './services/geminiService';
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
  const [activeTab, setActiveTab] = useState<'config' | 'style' | 'tools'>('config');
  const [targetRole, setTargetRole] = useState('');
  const [mode, setMode] = useState<OptimizationMode>('balanced');
  const [fastMode, setFastMode] = useState(false);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['microsoft']);
  const { state: formattingState, dispatch: formattingDispatch } = useFormatting();
  const { activeSection, styles: sectionStyles } = formattingState;
  const { 
    isOptimizing, 
    setIsOptimizing, 
    setData, 
    pages,
    results,
    setResults,
    activeAudience,
    setActiveAudience,
    currentOptimizingEngine,
    setCurrentOptimizingEngine
  } = useResumeStore();

  const [linkedInUrl, setLinkedInUrl] = useState(() => localStorage.getItem('linkedInUrl') || '');
  const [linkedInPdfText, setLinkedInPdfText] = useState(() => localStorage.getItem('linkedInPdfText') || '');
  const [linkedInFileName, setLinkedInFileName] = useState(() => localStorage.getItem('linkedInFileName') || '');
  const [jobUrl, setJobUrl] = useState('');
  const [isExtractingLinkedIn, setIsExtractingLinkedIn] = useState(false);
  const [isFetchingJob, setIsFetchingJob] = useState(false);

  useEffect(() => {
    localStorage.setItem('linkedInUrl', linkedInUrl);
  }, [linkedInUrl]);

  useEffect(() => {
    localStorage.setItem('linkedInPdfText', linkedInPdfText);
  }, [linkedInPdfText]);

  useEffect(() => {
    localStorage.setItem('linkedInFileName', linkedInFileName);
  }, [linkedInFileName]);

  // Initial data load from masterResume
  useEffect(() => {
    setData({
      personal_info: {
        ...masterResume.personal_info,
        summary: masterResume.professional_summary_base
      },
      experience: masterResume.experience.map((e, i) => ({ ...e, id: `exp_${i}` })),
      skills: masterResume.core_competencies,
      education: [masterResume.education],
      projects: masterResume.strategic_initiatives.map((p, i) => ({ 
        title: p.split(' (')[0], 
        description: p, 
        isOptional: true as const 
      })),
      certifications: masterResume.certifications
    });
  }, [setData]);

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
  
  const getSectionStyle = (sectionId: string) => sectionStyles[sectionId] || DEFAULT_STYLE;

  const [configWidth, setConfigWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tokenUsage, setTokenUsage] = useState(() => {
    const saved = localStorage.getItem('tokenUsage');
    return saved ? JSON.parse(saved) : {
      total: 1000000,
      consumed: 0,
      available: 1000000
    };
  });

  useEffect(() => {
    localStorage.setItem('tokenUsage', JSON.stringify(tokenUsage));
  }, [tokenUsage]);
  
  const resumePreviewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isAutoZoom, setIsAutoZoom] = useState(true);
  const [customFonts, setCustomFonts] = useState<{name: string, url: string}[]>([]);

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
      
      const style = document.createElement('style');
      style.innerHTML = `
        @font-face {
          font-family: '${fontName}';
          src: url('${base64}') format('${file.name.endsWith('.woff2') ? 'woff2' : file.name.endsWith('.woff') ? 'woff' : 'truetype'}');
        }
      `;
      document.head.appendChild(style);

      setCustomFonts(prev => [...prev, { name: fontName, url: base64 }]);
    };
    reader.readAsDataURL(file);
  };

  const [sectionOrder, setSectionOrder] = useState<string[]>([
    'header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    if (!previewContainerRef.current || !isAutoZoom) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const containerWidth = entry.contentRect.width;
        const targetWidth = 794; // A4 width in px
        const padding = 64; // 32px padding on each side
        const availableWidth = containerWidth - padding;
        
        if (availableWidth < targetWidth) {
          setZoom(availableWidth / targetWidth);
        } else {
          setZoom(1);
        }
      }
    });

    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [activeAudience, isAutoZoom]); // Re-run when audience or auto-zoom changes

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

  const extractLinkedInTextFromPDF = async (file: File) => {
    setIsExtractingLinkedIn(true);
    setLinkedInFileName(file.name);
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
      
      setLinkedInPdfText(fullText);
    } catch (err) {
      console.error('Error extracting LinkedIn PDF text:', err);
      setError('Failed to extract text from LinkedIn PDF.');
    } finally {
      setIsExtractingLinkedIn(false);
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

  const handleLinkedInFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        extractLinkedInTextFromPDF(file);
      } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setLinkedInPdfText(event.target?.result as string);
          setLinkedInFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        setError('Please upload a PDF or TXT file.');
      }
    }
  };

  const getEffectiveResumeText = () => {
    if (resumeText) return resumeText;
    
    // Fallback to masterResume if no text uploaded
    return `
NAME: ${masterResume.personal_info.name}
SUMMARY: ${masterResume.professional_summary_base}
EXPERIENCE:
${masterResume.experience.map(exp => `- ${exp.role} at ${exp.company} (${exp.duration}): ${exp.bullets.join(' ')}`).join('\n')}
SKILLS: ${masterResume.core_competencies.join(', ')}
EDUCATION: ${masterResume.education.degree} from ${masterResume.education.institution}
    `;
  };

  const restoreVersion = (version: any) => {
    if (version.data.resumeText) setResumeText(version.data.resumeText);
    if (version.data.jobDescription) setJobDescription(version.data.jobDescription);
    if (version.data.results) setResults(version.data.results);
    setActiveTab('config');
  };

  const toggleAudience = (id: string) => {
    setSelectedAudiences(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleFetchJobDescription = async () => {
    if (!jobUrl) {
      setError('Please enter a job URL first.');
      return;
    }
    
    setIsFetchingJob(true);
    setError(null);
    try {
      const currentEngineConfig = {
        engine: selectedEngine as EngineType,
        model: engineConfig[selectedEngine as EngineType].model,
        apiKey: engineConfig[selectedEngine as EngineType].apiKey
      };
      const text = await fetchJobDescription(jobUrl, currentEngineConfig);
      
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes('anti-scraping') || 
        lowerText.includes('blocked by linkedin') || 
        lowerText.includes('security policies currently block') ||
        lowerText.includes('unable to retrieve specific')
      ) {
        setError('LinkedIn prevents automated extraction of this job posting. Please copy and paste the job description text manually into the text area below.');
        setJobDescription('');
      } else {
        setJobDescription(text);
      }
    } catch (err: any) {
      console.error('Error fetching job description:', err);
      setError(`Failed to fetch job description: ${err.message || 'Unknown error'}. You can still paste it manually.`);
    } finally {
      setIsFetchingJob(false);
    }
  };

  const handleOptimize = async () => {
    if (!jobDescription && !jobUrl) {
      setError('Please provide a job description or job URL to optimize against.');
      return;
    }

    if (selectedAudiences.length === 0) {
      setError('Please select at least one target audience.');
      return;
    }

    setIsOptimizing(true);
    setCurrentOptimizingEngine(selectedEngine);
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
          const data = await optimizeResume(finalResumeText, jobDescription, finalTargetRole, mode, audienceLabel, currentEngineConfig, linkedInUrl, linkedInPdfText, jobUrl, fastMode);
          
          // Update token usage
          if (data._usage) {
            setTokenUsage(prev => {
              const newConsumed = prev.consumed + data._usage!.totalTokenCount;
              return {
                ...prev,
                consumed: newConsumed,
                available: Math.max(0, prev.total - newConsumed)
              };
            });
          }

          // Update results incrementally
          setResults({ 
            ...results, 
            [audienceId]: { 
              ...data, 
              _engine: selectedEngine, 
              _model: engineConfig[selectedEngine].model 
            } as any
          });
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

    const projectsText = res.projects?.map(p => typeof p === 'string' ? p : `${p.title}: ${p.description}`).join('\n');

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

${projectsText ? `PROJECTS\n${projectsText}\n` : ''}

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
      requestAnimationFrame(() => {
        const newWidth = Math.max(300, Math.min(800, e.clientX));
        setConfigWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPDF = async () => {
    const element = document.getElementById('resume-container');
    if (!element) return;

    // Temporarily clear active section for clean PDF
    const previousActiveSection = activeSection;
    formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: null });
    setIsDownloading(true);

    try {
      // Small delay to allow React to re-render with legacy-colors and without highlights
      await new Promise(resolve => setTimeout(resolve, 400));

      const opt = {
        margin:       [10, 10, 10, 10] as [number, number, number, number], // Add some margin for safety
        filename:     `Professional_Resume_${(targetRole || "Expert").replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          windowWidth: 794 // Force A4 width for consistent rendering
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak:    { mode: 'css', avoid: '.resume-section' }
      };

      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();

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

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'header':
        return (
          <div 
            key="header"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'header' })}
            className={`cursor-pointer transition-all rounded p-2 -m-2 mb-8 resume-section ${activeSection === 'header' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('header').fontFamily, 
              textAlign: 'center',
              lineHeight: getSectionStyle('header').lineHeight || 1.4,
              color: getSectionStyle('header').color,
              letterSpacing: `${getSectionStyle('header').letterSpacing || 0}em`,
              padding: `${getSectionStyle('header').padding || 0}px`,
              marginBottom: `${getSectionStyle('header').margin || 32}px`,
            }}
          >
            <h1 className="font-bold uppercase tracking-[0.2em] mb-3" style={{ fontSize: '26px' }}>
              {masterResume.personal_info.name}
            </h1>
            <div className="font-semibold opacity-80 border-t-2 border-black/10 pt-3 flex justify-center items-center gap-x-4 gap-y-1 flex-wrap" style={{ fontSize: '11px', lineHeight: '1.2' }}>
              <span className="whitespace-nowrap">{masterResume.personal_info.location}</span>
              <span className="opacity-30">|</span>
              <span className="whitespace-nowrap">{masterResume.personal_info.email}</span>
              <span className="opacity-30">|</span>
              <span className="whitespace-nowrap">{masterResume.personal_info.phone}</span>
              {masterResume.personal_info.linkedin && (
                <>
                  <span className="opacity-30">|</span>
                  <span className="whitespace-nowrap">LinkedIn: {masterResume.personal_info.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}</span>
                </>
              )}
            </div>
          </div>
        );
      case 'summary':
        return (
          <div 
            key="summary"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'summary' })}
            className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'summary' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('summary').fontFamily, 
              textAlign: 'justify',
              lineHeight: getSectionStyle('summary').lineHeight || 1.5,
              color: getSectionStyle('summary').color,
              letterSpacing: `${getSectionStyle('summary').letterSpacing || 0}em`,
              padding: `${getSectionStyle('summary').padding || 0}px`,
              marginBottom: `${getSectionStyle('summary').margin || 24}px`,
              fontSize: `${getSectionStyle('summary').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-2 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Summary
            </h2>
            <p className="opacity-90 leading-relaxed">{results[activeAudience!]?.summary || masterResume.professional_summary_base}</p>
          </div>
        );
      case 'skills':
        return (
          <div 
            key="skills"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'skills' })}
            className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'skills' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('skills').fontFamily, 
              lineHeight: getSectionStyle('skills').lineHeight || 1.4,
              color: getSectionStyle('skills').color,
              letterSpacing: `${getSectionStyle('skills').letterSpacing || 0}em`,
              padding: `${getSectionStyle('skills').padding || 0}px`,
              marginBottom: `${getSectionStyle('skills').margin || 24}px`,
              fontSize: `${getSectionStyle('skills').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-3 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Core Competencies
            </h2>
            {results[activeAudience!]?.skills && !Array.isArray(results[activeAudience!].skills) ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(results[activeAudience!].skills).map(([category, items]) => (
                  <div key={category}>
                    <div className="font-bold uppercase text-[10px] text-emerald-700 mb-1">{category}</div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {(items as unknown as string[]).map((s, i) => (
                        <span key={i} className="opacity-90">{s}{i < (items as unknown as string[]).length - 1 ? ',' : ''}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : typeof masterResume.core_competencies === 'object' ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(masterResume.core_competencies).map(([category, items]) => (
                  <div key={category}>
                    <div className="font-bold uppercase text-[10px] text-emerald-700 mb-1">{category}</div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {(items as unknown as string[]).map((s, i) => (
                        <span key={i} className="opacity-90">{s}{i < (items as unknown as string[]).length - 1 ? ',' : ''}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {((Array.isArray(results[activeAudience!]?.skills) ? results[activeAudience!].skills : Object.values(results[activeAudience!].skills as any).flat()) as any as string[]).map((s, i) => (
                  <div key={i} className="resume-bullet-item">
                    <div className="resume-bullet-dot mt-1.5" />
                    <span className="resume-bullet-text opacity-90">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'certifications':
        return (
          <div 
            key="certifications"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'certifications' })}
            className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'certifications' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('certifications').fontFamily, 
              lineHeight: getSectionStyle('certifications').lineHeight || 1.4,
              color: getSectionStyle('certifications').color,
              letterSpacing: `${getSectionStyle('certifications').letterSpacing || 0}em`,
              padding: `${getSectionStyle('certifications').padding || 0}px`,
              marginBottom: `${getSectionStyle('certifications').margin || 24}px`,
              fontSize: `${getSectionStyle('certifications').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-3 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Certifications
            </h2>
            <div className="grid grid-cols-1 gap-1">
              {(results[activeAudience!]?.certifications || masterResume.certifications).map((cert, i) => (
                <div key={i} className="resume-bullet-item">
                  <div className="resume-bullet-dot mt-1.5" />
                  <span className="resume-bullet-text opacity-90 font-medium">{cert}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'experience':
        return (
          <div 
            key="experience"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'experience' })}
            className={`cursor-pointer transition-all rounded p-2 -m-2 mb-6 resume-section ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('experience').fontFamily, 
              lineHeight: getSectionStyle('experience').lineHeight || 1.4,
              color: getSectionStyle('experience').color,
              letterSpacing: `${getSectionStyle('experience').letterSpacing || 0}em`,
              padding: `${getSectionStyle('experience').padding || 0}px`,
              marginBottom: `${getSectionStyle('experience').margin || 24}px`,
              fontSize: `${getSectionStyle('experience').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-4 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Experience
            </h2>
            {(() => {
              const allExp = results[activeAudience!]?.experience || masterResume.experience;
              return allExp.map((exp, i) => (
                <div key={i} className="mb-5 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex justify-between font-bold items-baseline mb-0.5">
                    <span style={{ fontSize: '13px' }}>{exp.role}</span>
                    <span className="opacity-70 font-medium italic" style={{ fontSize: '11px' }}>{exp.duration}</span>
                  </div>
                  <div className="font-semibold mb-2 text-emerald-700" style={{ fontSize: '12px' }}>{exp.company}</div>
                  <div className="space-y-1">
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="resume-bullet-item">
                        <div className="resume-bullet-dot mt-1.5" />
                        <span className="resume-bullet-text opacity-90 leading-relaxed">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        );
      case 'projects':
        if (!results[activeAudience!]?.projects || results[activeAudience!].projects.length === 0) return null;
        return (
          <div 
            key="projects"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'projects' })}
            className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'projects' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('projects').fontFamily, 
              lineHeight: getSectionStyle('projects').lineHeight || 1.4,
              color: getSectionStyle('projects').color,
              letterSpacing: `${getSectionStyle('projects').letterSpacing || 0}em`,
              padding: `${getSectionStyle('projects').padding || 0}px`,
              marginBottom: `${getSectionStyle('projects').margin || 24}px`,
              fontSize: `${getSectionStyle('projects').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-4 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Key Strategic Projects
            </h2>
            <div className="space-y-5">
              {results[activeAudience!].projects.map((proj, i) => (
                <div key={i} className="mb-5 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                  <div className="font-bold mb-1 text-emerald-700" style={{ fontSize: '13px' }}>
                    {typeof proj === 'string' ? proj : (proj as any).title}
                  </div>
                  <div className="opacity-90 leading-relaxed">
                    {typeof proj === 'string' ? '' : (proj as any).description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'education':
        return (
          <div 
            key="education"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'education' })}
            className={`mb-6 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'education' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('education').fontFamily, 
              lineHeight: getSectionStyle('education').lineHeight || 1.4,
              color: getSectionStyle('education').color,
              letterSpacing: `${getSectionStyle('education').letterSpacing || 0}em`,
              padding: `${getSectionStyle('education').padding || 0}px`,
              marginBottom: `${getSectionStyle('education').margin || 24}px`,
              fontSize: `${getSectionStyle('education').fontSize || 10.5}px`,
            }}
          >
            <h2 className="font-bold mb-3 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Education
            </h2>
            {(results[activeAudience!]?.education || [masterResume.education]).map((edu, i) => (
              <div key={i} className="mb-2 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                <div className="resume-bullet-item">
                  <div className="resume-bullet-dot mt-1.5" />
                  <span className="resume-bullet-text opacity-90 font-medium">
                    {typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (${edu.expected_completion})`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 overflow-x-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#F5F5F5] text-[#1A1A1A]'} font-sans selection:bg-emerald-500/30`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 transition-colors w-full ${isDarkMode ? 'bg-[#0A0A0A]/80 backdrop-blur-md border-white/10' : 'bg-white/80 backdrop-blur-md border-black/5'}`}>
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
            <span className={`hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest opacity-60 px-2 py-1 rounded bg-white/5 border border-white/10`}>V-2.0.0 - STABLE</span>
          </div>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col lg:flex-row gap-8 relative min-h-[calc(100vh-200px)]">
          {/* Configuration Pane */}
          <div 
            className={`w-full lg:flex-shrink-0 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-20 custom-scrollbar`}
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${configWidth}px` : '100%' }}
          >
            <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] z-20 p-4 border-b border-black/5 dark:border-white/10">
              <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-lg">
                {(['config', 'style', 'tools'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
                      activeTab === tab
                        ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-black shadow-sm')
                        : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black')
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 space-y-6">
              {activeTab === 'config' && (
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                        <label className="flex items-center gap-2 mt-4 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={fastMode} 
                            onChange={(e) => setFastMode(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          <span className="text-[11px] font-bold">Fast Mode (Use Flash Model)</span>
                        </label>
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
                              onClick={() => setShowModeInfo(!showModeInfo)}
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
                                    isDarkMode ? 'bg-[#1A1A1A] border-white/10 text-white' : 'bg-white border-black/10 text-black'
                                  }`}
                                  value={engineConfig[selectedEngine].model}
                                  onChange={(e) => setEngineConfig({
                                    ...engineConfig,
                                    [selectedEngine]: { ...engineConfig[selectedEngine], model: e.target.value }
                                  })}
                                >
                                  {selectedEngine === 'gemini' && (
                                    <>
                                      <option value="gemini-3.1-pro-preview" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>Gemini 3.1 Pro</option>
                                      <option value="gemini-3-flash-preview" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>Gemini 3 Flash</option>
                                    </>
                                  )}
                                  {selectedEngine === 'openai' && (
                                    <>
                                      <option value="gpt-4o" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>GPT-4o</option>
                                      <option value="gpt-4-turbo" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>GPT-4 Turbo</option>
                                      <option value="gpt-3.5-turbo" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>GPT-3.5 Turbo</option>
                                    </>
                                  )}
                                  {selectedEngine === 'anthropic' && (
                                    <>
                                      <option value="claude-3-5-sonnet-20240620" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>Claude 3.5 Sonnet</option>
                                      <option value="claude-3-opus-20240229" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>Claude 3 Opus</option>
                                      <option value="claude-3-haiku-20240307" className={isDarkMode ? 'bg-[#1A1A1A] text-white' : ''}>Claude 3 Haiku</option>
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
                                    isDarkMode ? 'bg-[#1A1A1A] border-white/10 text-white' : 'bg-white border-black/10 text-black'
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
                      {/* LinkedIn Profile */}
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>LinkedIn Profile (Optional)</label>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input 
                              type="url"
                              placeholder="https://linkedin.com/in/yourprofile"
                              className={`flex-1 px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                              }`}
                              value={linkedInUrl}
                              onChange={(e) => setLinkedInUrl(e.target.value)}
                            />
                          </div>
                          <div className={`relative border-2 border-dashed rounded-xl p-3 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 hover:border-emerald-500/50' : 'bg-[#F9F9F9] border-black/10 hover:border-emerald-500/50'
                          }`}>
                            <input 
                              type="file"
                              accept=".pdf,.txt"
                              onChange={handleLinkedInFileUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex items-center justify-center gap-2">
                              {isExtractingLinkedIn ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-xs font-medium opacity-60">Extracting...</span>
                                </div>
                              ) : linkedInFileName ? (
                                <div className="flex items-center justify-between w-full px-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-bold truncate max-w-[150px]">{linkedInFileName}</span>
                                  </div>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setLinkedInFileName(''); setLinkedInPdfText(''); }}
                                    className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest z-20 relative"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 opacity-30" />
                                  <span className="text-xs font-medium opacity-60">
                                    Or upload LinkedIn PDF export
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Job Description */}
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Job Description</label>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input 
                              type="url"
                              placeholder="Job Posting URL (Optional)"
                              className={`flex-1 px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                              }`}
                              value={jobUrl}
                              onChange={(e) => setJobUrl(e.target.value)}
                            />
                            <button
                              onClick={handleFetchJobDescription}
                              disabled={!jobUrl || isFetchingJob}
                              className={`px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                                isFetchingJob || !jobUrl
                                  ? (isDarkMode ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-black/5 text-black/30 cursor-not-allowed')
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                              }`}
                            >
                              {isFetchingJob ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Fetching...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3 h-3" />
                                  Fetch
                                </>
                              )}
                            </button>
                          </div>
                          <textarea 
                            placeholder="Paste the target job description here..."
                            className={`w-full h-32 p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm leading-relaxed ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                          />
                          
                          {/* Optimize Button Section */}
                          <div className="pt-4 border-t border-black/5 dark:border-white/10">
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
                                  className="px-6 py-4 rounded-xl font-bold bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all flex items-center gap-2"
                                >
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                  Stop
                                </button>
                              )}
                            </div>

                            {/* Token Usage Display */}
                            <div className={`mt-4 p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <Cpu className="w-3 h-3 opacity-50" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Token Usage</span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Free Account</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Total</span>
                                  <span className="text-xs font-mono font-bold">{(tokenUsage.total / 1000).toFixed(0)}k</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Consumed</span>
                                  <span className="text-xs font-mono font-bold">{(tokenUsage.consumed / 1000).toFixed(1)}k</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Available</span>
                                  <span className="text-xs font-mono font-bold">{(tokenUsage.available / 1000).toFixed(1)}k</span>
                                </div>
                              </div>
                              <div className="mt-2 h-1 w-full bg-black/20 dark:bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 transition-all duration-500" 
                                  style={{ width: `${(tokenUsage.consumed / tokenUsage.total) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {activeTab === 'style' && (
                <div className="space-y-6">
                  {/* Resume Structure */}
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Resume Structure</label>
                    <div className={`p-4 border rounded-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-[#F9F9F9] border-black/5'}`}>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={sectionOrder}
                          strategy={verticalListSortingStrategy}
                        >
                          {sectionOrder.map((id) => (
                            <SortableSection key={id} id={id} label={id} isDarkMode={isDarkMode} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>

                  {/* Typography & Styling */}
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50`}>Typography & Styling</label>
                    <div className={`p-4 border rounded-xl space-y-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-[#F9F9F9] border-black/5'}`}>
                      
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-40">
                          Font Family {activeSection ? `(Editing: ${activeSection})` : '(Editing: All Sections)'}
                        </label>
                        <select 
                          className={`w-full p-2 text-xs border rounded-lg outline-none transition-colors ${isDarkMode ? 'bg-[#1A1A1A] border-white/10 text-white' : 'bg-white border-black/10 text-black'}`}
                          value={activeSection ? getSectionStyle(activeSection).fontFamily : getSectionStyle('header').fontFamily}
                          onChange={(e) => {
                            if (activeSection) {
                              formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { fontFamily: e.target.value } });
                            } else {
                              // Update all sections
                              ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { fontFamily: e.target.value } });
                              });
                            }
                          }}
                        >
                          <option value="Inter">Inter</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Merriweather">Merriweather</option>
                          <option value="Space Grotesk">Space Grotesk</option>
                          <option value="JetBrains Mono">JetBrains Mono</option>
                          {customFonts.map(font => (
                            <option key={font.name} value={font.name}>{font.name} (Custom)</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Font Upload */}
                      <div className="pt-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">
                          Upload Custom Font (.ttf, .otf, .woff)
                        </label>
                        <div className="relative">
                          <input 
                            type="file"
                            accept=".ttf,.otf,.woff,.woff2"
                            onChange={handleFontUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 hover:border-emerald-500/50' : 'bg-white border-black/10 hover:border-emerald-500/50'
                          }`}>
                            <Upload className="w-4 h-4 opacity-30" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Upload Font</span>
                          </div>
                        </div>
                        {customFonts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {customFonts.map(font => (
                              <div key={font.name} className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                                {font.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Typography & Styling Controls */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-40">Typography & Styling</label>
                          <button 
                            onClick={() => formattingDispatch({ type: 'RESET_STYLE', sectionId: activeSection })}
                            className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
                          >
                            Reset
                          </button>
                        </div>

                        {/* Font Size */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 opacity-60">
                            <span>Font Size</span>
                            <span>{activeSection ? (getSectionStyle(activeSection).fontSize || DEFAULT_STYLE.fontSize) : DEFAULT_STYLE.fontSize}px</span>
                          </div>
                          <input 
                            type="range" min="8" max="24" step="0.5"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={activeSection ? (getSectionStyle(activeSection).fontSize || DEFAULT_STYLE.fontSize) : DEFAULT_STYLE.fontSize}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (activeSection) {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { fontSize: val } });
                              } else {
                                ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                  formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { fontSize: val } });
                                });
                              }
                            }}
                          />
                        </div>

                        {/* Line Height */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 opacity-60">
                            <span>Line Height</span>
                            <span>{activeSection ? (getSectionStyle(activeSection).lineHeight || DEFAULT_STYLE.lineHeight) : DEFAULT_STYLE.lineHeight}</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="3" step="0.1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={activeSection ? (getSectionStyle(activeSection).lineHeight || DEFAULT_STYLE.lineHeight) : DEFAULT_STYLE.lineHeight}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (activeSection) {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { lineHeight: val } });
                              } else {
                                ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                  formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { lineHeight: val } });
                                });
                              }
                            }}
                          />
                        </div>
                        
                        {/* Letter Spacing */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 opacity-60">
                            <span>Letter Spacing</span>
                            <span>{activeSection ? (getSectionStyle(activeSection).letterSpacing || DEFAULT_STYLE.letterSpacing) : DEFAULT_STYLE.letterSpacing}</span>
                          </div>
                          <input 
                            type="range" min="-0.1" max="0.5" step="0.01"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={activeSection ? (getSectionStyle(activeSection).letterSpacing || DEFAULT_STYLE.letterSpacing) : DEFAULT_STYLE.letterSpacing}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (activeSection) {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { letterSpacing: val } });
                              } else {
                                ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                  formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { letterSpacing: val } });
                                });
                              }
                            }}
                          />
                        </div>
                        
                        {/* Padding */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 opacity-60">
                            <span>Padding</span>
                            <span>{activeSection ? (getSectionStyle(activeSection).padding || DEFAULT_STYLE.padding) : DEFAULT_STYLE.padding}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="50" step="1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={activeSection ? (getSectionStyle(activeSection).padding || DEFAULT_STYLE.padding) : DEFAULT_STYLE.padding}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (activeSection) {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { padding: val } });
                              } else {
                                ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                  formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { padding: val } });
                                });
                              }
                            }}
                          />
                        </div>
                        
                        {/* Margin */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 opacity-60">
                            <span>Margin</span>
                            <span>{activeSection ? (getSectionStyle(activeSection).margin || DEFAULT_STYLE.margin) : DEFAULT_STYLE.margin}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="50" step="1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={activeSection ? (getSectionStyle(activeSection).margin || DEFAULT_STYLE.margin) : DEFAULT_STYLE.margin}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (activeSection) {
                                formattingDispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, style: { margin: val } });
                              } else {
                                ['header', 'summary', 'skills', 'certifications', 'experience', 'projects', 'education'].forEach(sec => {
                                  formattingDispatch({ type: 'UPDATE_STYLE', sectionId: sec, style: { margin: val } });
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'tools' && (
                <div className="space-y-6">
                  <AdditionalTools 
                    resumeText={getEffectiveResumeText()}
                    jobDescription={jobDescription}
                    isDarkMode={isDarkMode}
                    engineConfig={engineConfig}
                    selectedEngine={selectedEngine}
                    onRestore={restoreVersion}
                    currentResults={results}
                  />
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
                            <h3 className="font-bold text-sm">Strategic Insights</h3>
                            <p className="text-[10px] opacity-50">AI-powered resume optimization</p>
                          </div>
                        </div>
                        {showInsights ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                      </button>
                      {showInsights && (
                        <div className="p-4 pt-0 text-xs leading-relaxed opacity-80">
                          {/* Insights content would go here */}
                          <p>Strategic insights based on your resume and job description analysis.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        {/* Resize Handle */}
          <div 
            onMouseDown={handleMouseDown}
            className={`hidden lg:block w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors self-stretch rounded-full mx-2 ${isResizing ? 'bg-emerald-500' : 'bg-white/10'}`}
          />

          {/* Result Section */}
          <div className="flex-1 min-w-0">
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
                  <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5 shadow-xl'}`}>
                    <div className={`p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
                      <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500/50" />
                        </div>
                        <div className="h-4 w-[1px] bg-white/10 mx-2 hidden sm:block" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                          Editing: <span className="text-emerald-400">{activeSection || 'Select a section'}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                        {overflow.isOverflowing && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">OVERFLOW DETECTED</span>
                            <span className="sm:hidden">OVERFLOW</span>
                          </div>
                        )}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                          <button 
                            onClick={() => {
                              setIsAutoZoom(false);
                              setZoom(z => Math.max(0.2, z - 0.1));
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="Zoom Out"
                          >
                            <span className="text-xs font-bold">-</span>
                          </button>
                          <button
                            onClick={() => setIsAutoZoom(!isAutoZoom)}
                            className={`text-[10px] font-mono w-12 text-center hover:text-emerald-500 transition-colors ${isAutoZoom ? 'text-emerald-500' : ''}`}
                            title={isAutoZoom ? "Disable Auto-Zoom" : "Enable Auto-Zoom"}
                          >
                            {Math.round(zoom * 100)}%
                          </button>
                          <button 
                            onClick={() => {
                              setIsAutoZoom(false);
                              setZoom(z => Math.min(2, z + 0.1));
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="Zoom In"
                          >
                            <span className="text-xs font-bold">+</span>
                          </button>
                        </div>
                        <button 
                          onClick={copyResumeText}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                          title="Copy text for selectable use"
                        >
                          <Copy className="w-4 h-4" />
                          <span className="hidden md:inline">Copy Text</span>
                        </button>
                        <button 
                          onClick={downloadPDF}
                          disabled={isDownloading}
                          className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="hidden sm:inline">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download PDF</span>
                              <span className="sm:hidden">PDF</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div 
                      ref={previewContainerRef}
                      className={`p-4 md:p-8 ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-200/50'} custom-scrollbar overflow-x-auto w-full`}
                    >
                      <div 
                        className="flex flex-col gap-8 w-max mx-auto"
                        style={{
                          zoom: zoom
                        }}
                      >
                        <div 
                          id="resume-container"
                          className={`resume-page transition-all duration-300 relative overflow-hidden ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : 'shadow-2xl'}`}
                        >
                          {sectionOrder.map((sectionId) => renderSection(sectionId))}
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
      </div>

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
