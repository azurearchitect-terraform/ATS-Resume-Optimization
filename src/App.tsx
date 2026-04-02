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
  AlignJustify,
  Building,
  HelpCircle,
  Maximize
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from './components/SortableSection';
import { AdditionalTools } from './components/AdditionalTools';
import { useResumeStore } from './store';
import { detectOverflow } from './overflowDetection';
import { useFormatting, DEFAULT_STYLE } from './context/FormattingContext';
import { optimizeResume, fetchJobDescription, analyzeBestAudiences, OptimizationResult, EngineType, EngineConfig } from './services/geminiService';
import { RouterConfig } from './services/aiRouter';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type OptimizationMode = 'conservative' | 'balanced' | 'aggressive';

const MODE_DESCRIPTIONS = {
  conservative: "Minimal edits. Preserves your original structure and wording while ensuring basic keyword alignment.",
  balanced: "The 'Sweet Spot'. Improves clarity, strengthens action verbs, and strategically aligns keywords. Recommended.",
  aggressive: "Maximum Impact. Rewrites bullets for peak ATS compatibility and high-stakes competitive roles."
};

const AUDIENCES = [
  { id: 'cloud-architect', label: 'Cloud Architect', icon: '☁️' },
  { id: 'cloud-ops', label: 'Cloud Ops Engineer', icon: '⚙️' },
  { id: 'leadership', label: 'Leadership / Manager', icon: '👔' },
  { id: 'solution-architect', label: 'Solution Architect', icon: '🏗️' },
  { id: 'infra-engineer', label: 'Infra Engineer', icon: '🛠️' },
  { id: 'microsoft', label: 'Microsoft / Enterprise', icon: '🏢' },
  { id: 'startup', label: 'Startup / Agile', icon: '🚀' },
  { id: 'technical', label: 'Deep Technical / Engineering', icon: '💻' },
  { id: 'consulting', label: 'Consulting / Client-Facing', icon: '🤝' }
];

const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  // OpenAI
  'gpt-5.4': { input: 5.00, output: 15.00 },
  'gpt-5.4-mini': { input: 0.15, output: 0.60 },
  'gpt-5.4-nano': { input: 0.05, output: 0.20 },
  'o1': { input: 15.00, output: 60.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'gpt-4.5': { input: 75.00, output: 150.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  // Gemini
  'gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-flash-preview': { input: 0.075, output: 0.30 },
  'gemini-flash-latest': { input: 0.075, output: 0.30 },
  'gemini-3.1-flash-lite-preview': { input: 0.075, output: 0.30 },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [encryptedApiKey, setEncryptedApiKey] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.masterResume) {
              setResumeText(data.masterResume);
            }
            if (data.encryptedApiKey) {
              setEncryptedApiKey(data.encryptedApiKey);
              setApiKey('••••••••••••••••'); // Placeholder
              setOpenaiApiKey('••••••••••••••••'); // Placeholder
              setIsApiKeySaved(true);
            }
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      } else {
        setApiKey('');
        setOpenaiApiKey('');
        setEncryptedApiKey('');
        setIsApiKeySaved(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
      alert("Failed to login.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      alert("Please login first.");
      return;
    }
    if (!resumeText) {
      alert("Please provide your master resume.");
      return;
    }

    setIsSavingProfile(true);
    try {
      let finalEncryptedKey = encryptedApiKey;

      // If the user entered a new API key (not the placeholder)
      if ((apiKey && apiKey !== '••••••••••••••••') || (openaiApiKey && openaiApiKey !== '••••••••••••••••')) {
        const keysToEncrypt = JSON.stringify({
          gemini: apiKey !== '••••••••••••••••' ? apiKey : '',
          openai: openaiApiKey !== '••••••••••••••••' ? openaiApiKey : ''
        });

        const response = await fetch('/api/encrypt-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apiKey: keysToEncrypt,
            existingEncryptedKey: encryptedApiKey
          })
        });
        if (!response.ok) throw new Error("Failed to encrypt API keys");
        const data = await response.json();
        finalEncryptedKey = data.encryptedKey;
        setEncryptedApiKey(finalEncryptedKey);
        if (apiKey) setApiKey('••••••••••••••••');
        if (openaiApiKey) setOpenaiApiKey('••••••••••••••••');
        setIsApiKeySaved(true);
      }

      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        encryptedApiKey: finalEncryptedKey,
        masterResume: resumeText,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("Profile saved successfully!");
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetKeys = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to clear your saved API keys? You will need to re-enter them.")) return;
    
    try {
      await setDoc(doc(db, 'users', user.uid), {
        encryptedApiKey: "",
        updatedAt: serverTimestamp()
      }, { merge: true });
      setApiKey('');
      setOpenaiApiKey('');
      setEncryptedApiKey('');
      setIsApiKeySaved(false);
      alert("API keys cleared successfully.");
    } catch (err) {
      console.error("Error resetting keys:", err);
      alert("Failed to reset keys.");
    }
  };

  const [resumeText, setResumeText] = useState(() => {
    const saved = localStorage.getItem('resumeText');
    if (saved) return saved;
    
    return "";
  });
  const [jobDescription, setJobDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'style' | 'tools' | 'profile' | 'guide'>('config');
  const [targetRole, setTargetRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mode, setMode] = useState<OptimizationMode>('balanced');
  const [fastMode, setFastMode] = useState(false);
  const [recruiterSimulationMode, setRecruiterSimulationMode] = useState(false);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['microsoft']);
  const [isAudienceDropdownOpen, setIsAudienceDropdownOpen] = useState(false);
  const audienceDropdownRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audienceDropdownRef.current && !audienceDropdownRef.current.contains(event.target as Node)) {
        setIsAudienceDropdownOpen(false);
      }
    };

    if (isAudienceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAudienceDropdownOpen]);
  const { state: formattingState, dispatch: formattingDispatch } = useFormatting();
  const { activeSection, styles: sectionStyles } = formattingState;
  const { 
    data,
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

  // Profile Overrides
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || '');
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('profileLocation') || '');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('profileEmail') || '');
  const [profilePhone, setProfilePhone] = useState(() => localStorage.getItem('profilePhone') || '');
  const [profileLinkedIn, setProfileLinkedIn] = useState(() => localStorage.getItem('profileLinkedIn') || '');
  const [profileLinkedInText, setProfileLinkedInText] = useState(() => localStorage.getItem('profileLinkedInText') || '');

  useEffect(() => {
    localStorage.setItem('profileName', profileName);
  }, [profileName]);

  useEffect(() => {
    localStorage.setItem('profileLocation', profileLocation);
  }, [profileLocation]);

  useEffect(() => {
    localStorage.setItem('profileEmail', profileEmail);
  }, [profileEmail]);

  useEffect(() => {
    localStorage.setItem('profilePhone', profilePhone);
  }, [profilePhone]);

  useEffect(() => {
    localStorage.setItem('profileLinkedIn', profileLinkedIn);
  }, [profileLinkedIn]);

  useEffect(() => {
    localStorage.setItem('profileLinkedInText', profileLinkedInText);
  }, [profileLinkedInText]);

  useEffect(() => {
    localStorage.setItem('resumeText', resumeText);
  }, [resumeText]);

  useEffect(() => {
    localStorage.setItem('linkedInUrl', linkedInUrl);
  }, [linkedInUrl]);

  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    localStorage.setItem('linkedInPdfText', linkedInPdfText);
  }, [linkedInPdfText]);

  useEffect(() => {
    localStorage.setItem('linkedInFileName', linkedInFileName);
  }, [linkedInFileName]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  // Sync results with ResumeStore
  useEffect(() => {
    if (activeAudience && results[activeAudience]) {
      const res = results[activeAudience];
      setData({
        personal_info: {
          name: profileName,
          location: profileLocation,
          email: profileEmail,
          phone: profilePhone,
          summary: res.summary
        },
        experience: res.experience.map((e, i) => ({ ...e, id: `exp_${i}` })),
        skills: res.skills as any, // Cast to any to handle both structures
        education: res.education as any,
        projects: res.projects?.map(p => typeof p === 'string' ? p : { title: (p as any).title, description: (p as any).description, isOptional: true as const }) as any,
        certifications: res.certifications || []
      });
    }
  }, [activeAudience, results, setData, profileName, profileLocation, profileEmail, profilePhone]);

  const overflow = detectOverflow(pages);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showInsights, setShowInsights] = useState(false);
  
  const [engineConfig, setEngineConfig] = useState<Record<string, any>>({
    gemini: { model: 'gemini-3.1-pro-preview', apiKey: '' },
    openai: { model: 'gpt-5.4-nano', apiKey: '' },
    production: { model: 'auto', apiKey: '' }
  });
  const [selectedEngine, setSelectedEngine] = useState<EngineType | 'production'>('gemini');
  const [showEngineSettings, setShowEngineSettings] = useState(false);
  
  const getSectionStyle = (sectionId: string) => {
    const style = sectionStyles[sectionId] || {};
    return { ...DEFAULT_STYLE, ...style };
  };

  const [configWidth, setConfigWidth] = useState(40); // percentage
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetLayout = () => {
    setConfigWidth(40);
  };

  const [error, setError] = useState<string | null>(null);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationStatus, setOptimizationStatus] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tokenUsage, setTokenUsage] = useState(() => {
    const saved = localStorage.getItem('tokenUsage');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.available !== undefined) {
        return { input: 0, output: 0, total: 0 };
      }
      return parsed;
    }
    return {
      input: 0,
      output: 0,
      total: 0
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
    
    let animationFrameId: number;
    
    const observer = new ResizeObserver((entries) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        for (let entry of entries) {
          const containerWidth = entry.contentRect.width;
          const targetWidth = 794; // A4 width in px
          const padding = 64; // 32px padding on each side
          const availableWidth = containerWidth - padding;
          
          if (availableWidth < targetWidth) {
            setZoom(availableWidth / targetWidth);
          } else {
            setZoom(Math.min(1.5, availableWidth / targetWidth));
          }
        }
      });
    });

    observer.observe(previewContainerRef.current);
    return () => {
      observer.disconnect();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeAudience, isAutoZoom]); // Re-run when audience or auto-zoom changes

  useEffect(() => {
    console.log("isOptimizing changed:", isOptimizing);
  }, [isOptimizing]);

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
    
    // Fallback to empty if no text uploaded
    return "";
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

  const getRouterConfig = (): RouterConfig => {
    return {
      mode: selectedEngine as any,
      geminiConfig: {
        engine: 'gemini',
        model: engineConfig.gemini.model,
        apiKey: encryptedApiKey || engineConfig.gemini.apiKey
      },
      openaiConfig: {
        engine: 'openai',
        model: engineConfig.openai.model,
        apiKey: encryptedApiKey || engineConfig.openai.apiKey
      }
    };
  };

  const handleFetchJobDescription = async () => {
    if (!jobUrl) {
      setError('Please enter a job URL first.');
      return;
    }
    
    setIsFetchingJob(true);
    setError(null);
    try {
      const text = await fetchJobDescription(jobUrl, getRouterConfig());
      
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
    console.log("handleOptimize called");
    setError("Optimization started...");
    if (!jobDescription && !jobUrl) {
      setError('Please provide a job description or job URL to optimize against.');
      return;
    }

    let currentAudiences = [...selectedAudiences];
    if (currentAudiences.length === 0) {
      if (!jobDescription && !jobUrl) {
        setError('Please provide a job description or job URL to optimize against.');
        return;
      }
      
      setIsOptimizing(true);
      setError(null);
      
      try {
        const bestAudiences = await analyzeBestAudiences(jobDescription || jobUrl || "", targetRole || "Professional Candidate", getRouterConfig());
        if (bestAudiences && bestAudiences.length > 0) {
          setSelectedAudiences(bestAudiences);
          currentAudiences = bestAudiences;
        } else {
          setError('Could not auto-select audience. Please select at least one manually.');
          setIsOptimizing(false);
          return;
        }
      } catch (err) {
        console.error("Auto-selection failed:", err);
        setError('Auto-selection failed. Please select an audience manually.');
        setIsOptimizing(false);
        return;
      }
    } else {
      setIsOptimizing(true);
    }
    setCurrentOptimizingEngine(selectedEngine);
    setError(null);
    setResults({});
    setActiveAudience(null);
    setOptimizationProgress(0);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      setOptimizationProgress(prev => {
        if (prev < 30) return prev + Math.floor(Math.random() * 3) + 1;
        if (prev < 60) return prev + Math.floor(Math.random() * 2) + 1;
        if (prev < 85) return prev + 1;
        if (prev < 95) return prev + (Math.random() > 0.5 ? 1 : 0);
        if (prev < 98) return prev + (Math.random() > 0.8 ? 1 : 0);
        return prev;
      });
    }, 200);
    
    const engineName = selectedEngine === 'production' ? 'Hybrid Mode (Gemini + OpenAI)' : selectedEngine.toUpperCase();
    setOptimizationStatus(`Initializing ${engineName}...`);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const finalResumeText = resumeText || "";
      const finalTargetRole = targetRole || "Professional Candidate";
      
      const routerConfig = getRouterConfig();
      let completedAudiences = 0;
      const totalAudiences = currentAudiences.length;
      const engineName = selectedEngine === 'production' ? 'Hybrid Mode (Gemini + OpenAI)' : selectedEngine.toUpperCase();

      // Run all audience optimizations in parallel
      await Promise.all(currentAudiences.map(async (audienceId) => {
        if (controller.signal.aborted) return;
        
        try {
          const audienceLabel = AUDIENCES.find(a => a.id === audienceId)?.label || audienceId;
          setOptimizationStatus(`Optimizing for ${audienceLabel} using ${engineName}...`);
          
          const data = await optimizeResume(
            finalResumeText, 
            jobDescription, 
            finalTargetRole, 
            mode, 
            audienceLabel, 
            routerConfig, 
            linkedInUrl, 
            linkedInPdfText, 
            jobUrl, 
            fastMode, 
            recruiterSimulationMode
          );
          
          completedAudiences++;
          
          // Update token usage
          if (data._usage) {
            setTokenUsage(prev => ({
              input: (prev.input || 0) + (data._usage!.promptTokenCount || 0),
              output: (prev.output || 0) + (data._usage!.candidatesTokenCount || 0),
              total: (prev.total || 0) + (data._usage!.totalTokenCount || 0)
            }));
          }

          // Update results incrementally using functional update to avoid race conditions
          setResults(prev => {
            const newResults = { 
              ...prev, 
              [audienceId]: { 
                ...data, 
                _engine: selectedEngine, 
                _model: engineConfig[selectedEngine].model 
              } as any
            };
            
            // Set active audience to the first one that completes if none is set
            if (!activeAudience) {
              setActiveAudience(audienceId);
            }
            
            return newResults;
          });
        } catch (innerErr: any) {
          console.error(`Error optimizing for ${audienceId}:`, innerErr);
          const isRateLimit = innerErr?.message?.includes("429") || innerErr?.message?.includes("RESOURCE_EXHAUSTED") || innerErr?.message?.includes("quota");
          if (isRateLimit) {
            setError(`Rate limit or quota exceeded for ${audienceId}. Please try again in a few minutes or switch to a different AI engine in the settings.`);
          } else {
            setError(`Failed to optimize for ${audienceId}. ${innerErr.message || ''}`);
          }
        }
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Optimization aborted');
      } else {
        console.error(err);
        const errorMessage = err.message || 'Failed to optimize resume. Please try again.';
        if (errorMessage.includes('DECRYPTION_FAILED')) {
          setError('Your session or encryption key has changed. Please go to the Profile tab and re-save your API keys.');
        } else {
          setError(errorMessage);
        }
      }
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setOptimizationProgress(100);
      setIsOptimizing(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
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
${profileName}
${profileLocation} | ${profileEmail} | ${profilePhone}

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
${(res.certifications || [] as string[]).join('\n')}

EDUCATION
${(res.education || [] as any[]).map(edu => typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (Expected ${edu.expected_completion})`).join('\n')}
    `.trim();
    
    navigator.clipboard.writeText(text);
    alert('Resume text copied to clipboard! You can paste this into Word or any other editor.');
  };

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    setIsResizingWidth(true);
    e.preventDefault();
  };

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingWidth || !containerRef.current) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (isResizingWidth) {
          const rect = containerRef.current!.getBoundingClientRect();
          const newWidthPx = e.clientX - rect.left;
          const newWidthPercent = (newWidthPx / rect.width) * 100;
          setConfigWidth(Math.max(20, Math.min(60, newWidthPercent)));
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizingWidth(false);
    };

    if (isResizingWidth) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingWidth]);

  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPDF = async () => {
    const element = document.getElementById('resume-container');
    if (!element) return;

    // Temporarily clear active section for clean PDF
    const previousActiveSection = activeSection;
    formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: null });
    setIsDownloading(true);

    try {
      // Small delay to allow React to re-render without highlights
      await new Promise(resolve => setTimeout(resolve, 400));

      // Extract all styles from the document to ensure the PDF matches the preview
      const styles = Array.from(document.styleSheets)
        .map((styleSheet) => {
          try {
            return Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join("");
          } catch (e) {
            // Handle cross-origin stylesheets (like Google Fonts)
            return "";
          }
        })
        .join("\n");

      // Get any custom fonts injected via @font-face
      const customFonts = Array.from(document.querySelectorAll('style'))
        .filter(s => s.innerHTML.includes('@font-face'))
        .map(s => s.innerHTML)
        .join('\n');

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: element.outerHTML,
          css: styles,
          fonts: customFonts
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF on server');
      }

      const blob = await response.blob();
      if (blob.type !== 'application/pdf') {
        throw new Error('Server did not return a valid PDF file');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = companyName ? companyName.replace(/\s+/g, '_') : (targetRole || "Expert").replace(/\s+/g, '_');
      
      a.href = url;
      a.download = `Professional_Resume_${baseName}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Small delay before cleanup to ensure download starts correctly
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);

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
        const personalInfo: any = results[activeAudience!]?.personal_info || {
          name: profileName || data.personal_info.name,
          location: profileLocation || data.personal_info.location,
          email: profileEmail || data.personal_info.email,
          phone: profilePhone || data.personal_info.phone,
          linkedin: profileLinkedIn || data.personal_info.linkedin,
          linkedinText: profileLinkedInText
        };
        return (
          <div 
            key="header"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'header' })}
            className={`cursor-pointer transition-all rounded p-2 -m-2 mb-2 resume-section ${activeSection === 'header' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('header').fontFamily, 
              textAlign: 'center',
              lineHeight: getSectionStyle('header').lineHeight,
              color: getSectionStyle('header').color,
              letterSpacing: `${getSectionStyle('header').letterSpacing}em`,
              padding: `${getSectionStyle('header').padding}px`,
              marginBottom: `${getSectionStyle('header').margin}px`,
            }}
          >
            <h1 className="font-bold uppercase tracking-[0.2em] mb-1" style={{ fontSize: '26px' }}>
              {personalInfo.name}
            </h1>
            <div className="font-semibold opacity-80 border-t-2 border-black/10 pt-3 flex justify-center items-center gap-x-4 gap-y-1 flex-wrap" style={{ fontSize: '11px', lineHeight: '1.2' }}>
              <span className="whitespace-nowrap">{personalInfo.location}</span>
              <span className="opacity-30">|</span>
              <span className="whitespace-nowrap">{personalInfo.email}</span>
              <span className="opacity-30">|</span>
              <span className="whitespace-nowrap">{personalInfo.phone}</span>
              {personalInfo.linkedin && (
                <>
                  <span className="opacity-30">|</span>
                  <span className="whitespace-nowrap">LinkedIn: {personalInfo.linkedinText || personalInfo.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}</span>
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
            className={`mb-2 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'summary' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('summary').fontFamily, 
              textAlign: 'justify',
              lineHeight: getSectionStyle('summary').lineHeight,
              color: getSectionStyle('summary').color,
              letterSpacing: `${getSectionStyle('summary').letterSpacing}em`,
              padding: `${getSectionStyle('summary').padding}px`,
              marginBottom: `${getSectionStyle('summary').margin}px`,
              fontSize: `${getSectionStyle('summary').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Summary
            </h2>
            <p className="opacity-90 leading-relaxed">{results[activeAudience!]?.summary || data.personal_info.summary}</p>
          </div>
        );
      case 'skills':
        return (
          <div 
            key="skills"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'skills' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'skills' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('skills').fontFamily, 
              lineHeight: getSectionStyle('skills').lineHeight,
              color: getSectionStyle('skills').color,
              letterSpacing: `${getSectionStyle('skills').letterSpacing}em`,
              padding: `${getSectionStyle('skills').padding}px`,
              marginBottom: `${getSectionStyle('skills').margin}px`,
              fontSize: `${getSectionStyle('skills').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Core Competencies
            </h2>
            {results[activeAudience!]?.skills && !Array.isArray(results[activeAudience!].skills) ? (
              <div className="flex flex-col gap-1.5">
                {Object.entries(results[activeAudience!].skills).map(([category, items]) => (
                  <div key={category} className="text-[11px] leading-tight">
                    <span className="font-bold uppercase text-emerald-700 mr-2">{category}:</span>
                    <span className="opacity-90">{(items as unknown as string[]).join(' • ')}</span>
                  </div>
                ))}
              </div>
            ) : typeof data.skills === 'object' && !Array.isArray(data.skills) ? (
              <div className="flex flex-col gap-1.5">
                {Object.entries(data.skills as any).map(([category, items]) => (
                  <div key={category} className="text-[11px] leading-tight">
                    <span className="font-bold uppercase text-emerald-700 mr-2">{category}:</span>
                    <span className="opacity-90">{(items as unknown as string[]).join(' • ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 list-none p-0 m-0">
                {((
                  activeAudience && results[activeAudience]?.skills 
                    ? (Array.isArray(results[activeAudience].skills) 
                        ? results[activeAudience].skills 
                        : Object.values(results[activeAudience].skills).flat())
                    : data.skills
                ) as string[]).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] opacity-90 leading-tight">
                    <span className="mt-1.5 w-1 h-1 bg-black rounded-full shrink-0 opacity-60"></span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case 'certifications':
        return (
          <div 
            key="certifications"
            onClick={() => formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: 'certifications' })}
            className={`mb-2 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'certifications' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('certifications').fontFamily, 
              lineHeight: getSectionStyle('certifications').lineHeight,
              color: getSectionStyle('certifications').color,
              letterSpacing: `${getSectionStyle('certifications').letterSpacing}em`,
              padding: `${getSectionStyle('certifications').padding}px`,
              marginBottom: `${getSectionStyle('certifications').margin}px`,
              fontSize: `${getSectionStyle('certifications').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Certifications
            </h2>
            <div className="grid grid-cols-1 gap-1">
              {(results[activeAudience!]?.certifications || data.certifications || []).map((cert, i) => (
                <div key={i} className="resume-bullet-item">
                  <div className="resume-bullet-dot" />
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
            className={`cursor-pointer transition-all rounded p-2 -m-2 mb-2 resume-section ${activeSection === 'experience' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('experience').fontFamily, 
              lineHeight: getSectionStyle('experience').lineHeight,
              color: getSectionStyle('experience').color,
              letterSpacing: `${getSectionStyle('experience').letterSpacing}em`,
              padding: `${getSectionStyle('experience').padding}px`,
              marginBottom: `${getSectionStyle('experience').margin}px`,
              fontSize: `${getSectionStyle('experience').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Professional Experience
            </h2>
            {(() => {
              const allExp = results[activeAudience!]?.experience || data.experience;
              return allExp.map((exp, i) => (
                <div key={i} className="mb-3 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex justify-between font-bold items-baseline mb-0.5">
                    <span style={{ fontSize: '13px' }}>{exp.role}</span>
                    <span className="opacity-70 font-medium italic" style={{ fontSize: '11px' }}>{exp.duration}</span>
                  </div>
                  <div className="font-semibold mb-2 text-emerald-700" style={{ fontSize: '12px' }}>{exp.company}</div>
                  <div className="space-y-1">
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="resume-bullet-item">
                        <div className="resume-bullet-dot" />
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
            className={`mb-2 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'projects' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('projects').fontFamily, 
              lineHeight: getSectionStyle('projects').lineHeight,
              color: getSectionStyle('projects').color,
              letterSpacing: `${getSectionStyle('projects').letterSpacing}em`,
              padding: `${getSectionStyle('projects').padding}px`,
              marginBottom: `${getSectionStyle('projects').margin}px`,
              fontSize: `${getSectionStyle('projects').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Key Strategic Projects
            </h2>
            <div className="space-y-3">
              {results[activeAudience!].projects.map((proj, i) => (
                <div key={i} className="mb-3 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
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
            className={`mb-2 cursor-pointer transition-all rounded p-2 -m-2 resume-section ${activeSection === 'education' ? 'bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30' : 'hover:bg-black/5'}`}
            style={{ 
              fontFamily: getSectionStyle('education').fontFamily, 
              lineHeight: getSectionStyle('education').lineHeight,
              color: getSectionStyle('education').color,
              letterSpacing: `${getSectionStyle('education').letterSpacing}em`,
              padding: `${getSectionStyle('education').padding}px`,
              marginBottom: `${getSectionStyle('education').margin}px`,
              fontSize: `${getSectionStyle('education').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Education
            </h2>
            {(results[activeAudience!]?.education || data.education || []).map((edu, i) => (
              <div key={i} className="mb-1 last:mb-0" style={{ pageBreakInside: 'avoid' }}>
                <div className="resume-bullet-item">
                  <div className="resume-bullet-dot" />
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
    <div className={`min-h-screen transition-colors duration-300 overflow-x-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#1A1A1A]'} font-sans selection:bg-emerald-500/30`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 transition-colors w-full ${isDarkMode ? 'bg-[#0A0A0A]/80 backdrop-blur-md border-white/10' : 'bg-white/80 backdrop-blur-md border-black/5'}`}>
        <div className="w-full px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-emerald-500' : 'bg-black'}`}>
              <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-black' : 'text-emerald-400'}`} />
            </div>
            <span className="font-bold text-xl tracking-tight">ATS.OPTIMIZER</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={resetLayout}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-black/5 text-emerald-600'}`}
              title="Reset Layout"
            >
              <Maximize className="w-5 h-5" />
            </button>
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

      <div className="w-full px-4 md:px-8 py-4 md:py-8">
        <div className="relative w-full">
          <div className="flex flex-row relative w-full">
            <div 
              ref={containerRef}
              className="flex flex-col md:flex-row gap-4 md:gap-0 relative w-full flex-1"
              style={{ 
                height: isMobile ? 'auto' : 'calc(100vh - 128px)'
              }}
            >
          {/* Configuration Pane */}
          <div 
            ref={leftPanelRef}
            className={`w-full md:flex-shrink-0 md:h-full md:overflow-y-auto custom-scrollbar rounded-2xl border ${isDarkMode ? 'bg-[#0A0A0A] border-white/10' : 'bg-white border-black/5'} shadow-xl`}
            style={{ 
              width: isMobile ? '100%' : `${configWidth}%`,
              minWidth: isMobile ? '100%' : '320px',
              maxWidth: isMobile ? '100%' : '800px'
            }}
          >
            <div className={`sticky top-0 bg-white dark:bg-[#0A0A0A] z-20 p-2 md:p-4 border-b border-black/5 dark:border-white/10 ${!isDarkMode ? '!bg-white' : ''}`}>
                    <div className="flex gap-1 p-1 bg-gray-200 dark:bg-white/5 rounded-lg">
                      {(['config', 'profile', 'style', 'tools', 'guide'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
                            activeTab === tab
                              ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-300 text-black shadow-sm')
                              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/60 hover:text-black')
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
            </div>
            
            <div className="p-2 md:p-4 space-y-6">
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
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Target Role (Optional)</label>
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
                      {/* Company Name */}
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Company Name (Optional)</label>
                        <div className="relative">
                          <Building className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30`} />
                          <input 
                            type="text"
                            placeholder="e.g. Microsoft"
                            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                          />
                        </div>
                      </div>
                      {/* Audience Selection */}
                      <div className="relative" ref={audienceDropdownRef}>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Target Audiences (Multi-select)</label>
                        <button
                          onClick={() => setIsAudienceDropdownOpen(!isAudienceDropdownOpen)}
                          className={`w-full px-3 py-2 text-xs border rounded-lg flex items-center justify-between ${
                            isDarkMode ? 'bg-[#1A1A1A] border-white/10 text-white' : 'bg-white border-black/10 text-black'
                          }`}
                        >
                          <span className="truncate">
                            {selectedAudiences.length > 0
                              ? selectedAudiences.map(id => AUDIENCES.find(a => a.id === id)?.label).join(', ')
                              : 'Select audiences...'}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </button>
                        {isAudienceDropdownOpen && (
                          <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                            isDarkMode ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-black/5'
                          }`}>
                            {AUDIENCES.map((audience) => (
                              <button
                                key={audience.id}
                                onClick={() => toggleAudience(audience.id)}
                                className={`w-full px-3 py-2 text-xs flex items-center gap-2 ${
                                  selectedAudiences.includes(audience.id)
                                    ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-700')
                                    : (isDarkMode ? 'text-white hover:bg-white/5' : 'text-black hover:bg-black/5')
                                }`}
                              >
                                <span>{audience.icon}</span>
                                {audience.label}
                                {selectedAudiences.includes(audience.id) && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Optimization Mode */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`block text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Optimization Mode</label>
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
                        
                        <div className="mt-4 space-y-2">
                          <button
                            onClick={() => setRecruiterSimulationMode(!recruiterSimulationMode)}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between border transition-all ${
                              recruiterSimulationMode
                                ? (isDarkMode ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-red-50 border-red-500 text-red-800')
                                : (isDarkMode ? 'bg-white/5 border-white/10 text-white/60' : 'bg-white border-black/5 text-black/60')
                            }`}
                          >
                            Recruiter Simulation Mode
                            <div className={`w-3 h-3 rounded-full ${recruiterSimulationMode ? 'bg-red-500' : 'bg-gray-400'}`} />
                          </button>
                          
                          <button
                            onClick={async () => {
                              console.log('Auto-select button clicked');
                              if (!jobDescription && !jobUrl) {
                                setError('Please provide a Job Description or Job URL.');
                                return;
                              }
                              try {
                                setIsOptimizing(true); // Reuse optimizing state for loading indicator
                                const bestAudiences = await analyzeBestAudiences(jobDescription || jobUrl || "", targetRole || "Professional Candidate", getRouterConfig());
                                console.log('Best audiences found:', bestAudiences);
                                if (bestAudiences && bestAudiences.length > 0) {
                                  setSelectedAudiences(bestAudiences);
                                }
                              } catch (error) {
                                console.error('Error auto-selecting audience:', error);
                                setError('Failed to auto-select audience. Please try again.');
                              } finally {
                                setIsOptimizing(false);
                              }
                            }}
                            disabled={isOptimizing}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${
                              isOptimizing ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-black/5 text-black/60 hover:bg-black/5'
                            }`}
                          >
                            Auto-select Audience
                          </button>
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
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Current Resume (Optional)</label>
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
                      <div className={`rounded-xl border p-6 transition-all resize-y overflow-auto min-h-[300px] shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                        <div className="flex items-center gap-3 mb-8">
                          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                            <Cpu className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <span className="text-[12px] font-black uppercase tracking-[0.2em] block">AI Engine Settings</span>
                            <span className="text-[9px] opacity-40 uppercase tracking-widest">Configure your intelligence layer</span>
                          </div>
                        </div>
                        
                        <div className="space-y-10">
                          <div>
                            <label className="block text-[11px] font-black uppercase tracking-[0.15em] mb-4 opacity-50">Select Engine</label>
                            <div className="grid grid-cols-3 gap-3">
                              {(['gemini', 'openai', 'production'] as const).map((eng) => (
                                <button
                                  key={eng}
                                  onClick={() => setSelectedEngine(eng)}
                                  className={`py-3 text-[10px] font-black rounded-xl border transition-all capitalize tracking-widest ${
                                    selectedEngine === eng 
                                      ? (isDarkMode ? 'bg-emerald-500 text-black border-emerald-500 shadow-xl shadow-emerald-500/20 scale-[1.02]' : 'bg-black text-white border-black shadow-xl shadow-black/20 scale-[1.02]')
                                      : (isDarkMode ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10' : 'bg-white text-black/60 border-black/5 hover:bg-black/5')
                                  }`}
                                >
                                  {eng === 'production' ? 'Auto' : eng}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-8">
                           {selectedEngine !== 'production' ? (
                             <div className="space-y-3">
                               <label className="block text-[11px] font-black uppercase tracking-[0.15em] mb-2 opacity-50">Model Configuration</label>
                               <div className="relative">
                                 <select 
                                   className={`w-full px-4 py-3.5 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none ${
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
                                       <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Recommended)</option>
                                       <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                                       <option value="gemini-flash-latest">Gemini Flash Latest</option>
                                       <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                                     </>
                                   )}
                                   {selectedEngine === 'openai' && (
                                     <>
                                       <option value="gpt-5.4">GPT-5.4 (Latest)</option>
                                       <option value="gpt-5.4-mini">GPT-5.4 mini</option>
                                       <option value="o1">o1 (Reasoning)</option>
                                       <option value="o3-mini">o3-mini</option>
                                       <option value="gpt-4o">GPT-4o</option>
                                       <option value="gpt-4o-mini">GPT-4o-mini</option>
                                     </>
                                   )}
                                 </select>
                                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                   <ChevronDown className="w-4 h-4" />
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <div className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                               <div className="flex items-start gap-4">
                                 <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/20' : 'bg-white shadow-sm'}`}>
                                   <Zap className="w-5 h-5 text-emerald-500" />
                                 </div>
                                 <div>
                                   <p className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em]">Smart Routing Active</p>
                                   <p className="text-[11px] opacity-70 mt-2 leading-relaxed font-medium">
                                     Dynamic orchestration: Gemini handles structural extraction while OpenAI powers high-fidelity content generation.
                                   </p>
                                 </div>
                               </div>
                             </div>
                           )}

                           <div className="space-y-4">
                             <label className="block text-[11px] font-black uppercase tracking-[0.15em] mb-2 opacity-50">
                               Authentication Keys
                             </label>
                             <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                               <p className="text-xs opacity-70">
                                 API keys are now managed securely in your <button onClick={() => setActiveTab('profile')} className="text-emerald-500 font-bold hover:underline">Profile</button>.
                               </p>
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                     {/* LinkedIn Profile */}
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>LinkedIn Profile (Optional)</label>
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
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Job Description</label>
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
                            className={`w-full h-32 p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-y text-sm leading-relaxed ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                          />
                          
                          {/* Optimize Button Section */}
                          <div className="pt-4 border-t border-black/5 dark:border-white/10">
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  if (isOptimizing || isExtracting) {
                                    console.log("Button disabled");
                                    return;
                                  }
                                  console.log("Button clicked");
                                  handleOptimize();
                                }}
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
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Token Usage & Pricing</span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{selectedEngine}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-black/5 dark:border-white/5">
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Model</span>
                                  <span className="text-[10px] font-mono font-bold truncate" title={engineConfig[selectedEngine].model}>{engineConfig[selectedEngine].model}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Input / 1M</span>
                                  <span className="text-[10px] font-mono font-bold">${MODEL_PRICING[engineConfig[selectedEngine].model]?.input.toFixed(2) || 'N/A'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Output / 1M</span>
                                  <span className="text-[10px] font-mono font-bold">${MODEL_PRICING[engineConfig[selectedEngine].model]?.output.toFixed(2) || 'N/A'}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Input Tokens</span>
                                  <span className="text-xs font-mono font-bold">{(tokenUsage.input / 1000).toFixed(1)}k</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Output Tokens</span>
                                  <span className="text-xs font-mono font-bold">{(tokenUsage.output / 1000).toFixed(1)}k</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] uppercase opacity-40 font-bold">Est. Cost</span>
                                  <span className="text-xs font-mono font-bold text-emerald-500">
                                    ${((tokenUsage.input / 1000000) * (MODEL_PRICING[engineConfig[selectedEngine].model]?.input || 0) + (tokenUsage.output / 1000000) * (MODEL_PRICING[engineConfig[selectedEngine].model]?.output || 0)).toFixed(4)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Users className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <h2 className="font-semibold text-lg">Account Settings</h2>
                      </div>
                      <button 
                        onClick={user ? handleLogout : handleLogin}
                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full transition-colors ${
                          isDarkMode 
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30' 
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                        }`}
                      >
                        {user ? 'Logout' : 'Login'}
                      </button>
                    </div>
                    
                    {user ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-sm font-medium">Logged in as: {user.email}</p>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Gemini API Key</label>
                          <input 
                            type="password"
                            placeholder="Enter your Gemini API Key"
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">OpenAI API Key</label>
                          <input 
                            type="password"
                            placeholder="Enter your OpenAI API Key"
                            value={openaiApiKey}
                            onChange={(e) => {
                              setOpenaiApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                          <p className="text-xs opacity-50 mt-2">Your API keys are encrypted before being stored and are never exposed to the frontend.</p>
                        </div>

                        <button
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                            isSavingProfile
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          }`}
                        >
                          {isSavingProfile ? 'Saving...' : 'Save Profile & Master Resume'}
                        </button>

                        <button
                          onClick={async () => {
                            if (confirm("Are you sure you want to clear your saved API keys?")) {
                              setApiKey('');
                              setOpenaiApiKey('');
                              setEncryptedApiKey('');
                              setIsApiKeySaved(false);
                              // Also update Firestore
                              await setDoc(doc(db, 'users', user.uid), {
                                encryptedApiKey: ''
                              }, { merge: true });
                              alert("API keys cleared.");
                            }
                          }}
                          className="w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                        >
                          Clear Saved API Keys
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8 opacity-60">
                        <p>Please login to save your API key and master resume.</p>
                      </div>
                    )}
                  </section>

                  <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
                    <div className="flex items-center gap-2 mb-6">
                      <Users className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <h2 className="font-semibold text-lg">Profile Overrides</h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Full Name</label>
                        <input 
                          type="text"
                          placeholder="Full Name"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Location</label>
                        <input 
                          type="text"
                          placeholder="Location (City, State)"
                          value={profileLocation}
                          onChange={(e) => setProfileLocation(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Email Address</label>
                        <input 
                          type="email"
                          placeholder="Email Address"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Phone Number</label>
                        <input 
                          type="text"
                          placeholder="Phone Number"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">LinkedIn URL</label>
                        <input 
                          type="url"
                          placeholder="LinkedIn Profile URL"
                          value={profileLinkedIn}
                          onChange={(e) => setProfileLinkedIn(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">LinkedIn Display Text (Optional)</label>
                        <input 
                          type="text"
                          placeholder="e.g. HarnishJariwala"
                          value={profileLinkedInText}
                          onChange={(e) => setProfileLinkedInText(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                            isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                          }`}
                        />
                        <p className="text-[9px] opacity-40 mt-1 italic">If empty, the end of the LinkedIn URL will be used.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setProfileName('');
                          setProfileLocation('');
                          setProfileEmail('');
                          setProfilePhone('');
                          setProfileLinkedIn('');
                          setProfileLinkedInText('');
                        }}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {activeTab === 'guide' && (
                <div className="space-y-6">
                  <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
                    <div className="flex items-center gap-2 mb-6">
                      <HelpCircle className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <h2 className="font-semibold text-lg">User Guide</h2>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">1. Configuration</h3>
                        <p className="text-[11px] leading-relaxed opacity-70">
                          Start by uploading your current resume (PDF) or use the default Master Resume. Paste the Job Description of the role you're targeting. Select your target role and optimization mode.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">2. Profile Customization</h3>
                        <p className="text-[11px] leading-relaxed opacity-70">
                          Use the <strong>Profile</strong> tab to override your personal details. You can even set a custom display text for your LinkedIn link to keep it clean (e.g., "HarnishJariwala" instead of the full URL).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">3. Optimization</h3>
                        <p className="text-[11px] leading-relaxed opacity-70">
                          Click <strong>Optimize Resume</strong> to let the AI rewrite your resume. It will align your skills and experience with the job description while maintaining a professional 2-page layout.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">4. Advanced Tools</h3>
                        <div className="text-[11px] leading-relaxed opacity-70">
                          Check the <strong>Tools</strong> tab for:
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li><strong>Gap Analysis:</strong> See which skills are missing.</li>
                            <li><strong>Interview Prep:</strong> Generate likely interview questions.</li>
                            <li><strong>Cover Letter:</strong> Create a tailored cover letter instantly.</li>
                            <li><strong>Versions:</strong> Save and restore different versions of your resume.</li>
                          </ul>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">5. Styling & Export</h3>
                        <p className="text-[11px] leading-relaxed opacity-70">
                          Customize fonts, colors, and layout in the <strong>Style</strong> tab. Once satisfied, use the <strong>Download PDF</strong> button to save your professional resume.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {activeTab === 'style' && (
                <div className="space-y-6">
                  {/* Resume Structure */}
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Resume Structure</label>
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
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Typography & Styling</label>
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
                            <span>{getSectionStyle(activeSection || 'header').fontSize}px</span>
                          </div>
                          <input 
                            type="range" min="8" max="24" step="0.5"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={getSectionStyle(activeSection || 'header').fontSize}
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
                            <span>{getSectionStyle(activeSection || 'header').lineHeight}</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="3" step="0.1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={getSectionStyle(activeSection || 'header').lineHeight}
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
                            <span>{getSectionStyle(activeSection || 'header').letterSpacing}</span>
                          </div>
                          <input 
                            type="range" min="-0.1" max="0.5" step="0.01"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={getSectionStyle(activeSection || 'header').letterSpacing}
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
                            <span>{getSectionStyle(activeSection || 'header').padding}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="50" step="1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={getSectionStyle(activeSection || 'header').padding}
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
                            <span>{getSectionStyle(activeSection || 'header').margin}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="50" step="1"
                            className="w-full h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer"
                            value={getSectionStyle(activeSection || 'header').margin}
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
                    targetRole={targetRole}
                    isDarkMode={isDarkMode}
                    engineConfig={engineConfig}
                    selectedEngine={selectedEngine as any}
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
                      {showInsights && activeAudience && results[activeAudience] && (
                        <div className="p-4 pt-0 text-xs leading-relaxed opacity-80 space-y-4">
                          {results[activeAudience].match_score !== undefined && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
                              <span className="font-bold">Match Score</span>
                              <span className={`font-bold text-sm ${results[activeAudience].match_score >= 80 ? 'text-emerald-500' : results[activeAudience].match_score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {results[activeAudience].match_score}%
                              </span>
                            </div>
                          )}
                          
                          {results[activeAudience].rejection_reasons && results[activeAudience].rejection_reasons!.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-bold text-red-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                Recruiter Rejection Reasons
                              </h4>
                              <ul className="list-disc pl-5 space-y-1 text-red-400">
                                {results[activeAudience].rejection_reasons!.map((reason, i) => (
                                  <li key={i}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {results[activeAudience].improvement_notes && results[activeAudience].improvement_notes!.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-bold text-emerald-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Improvement Notes
                              </h4>
                              <ul className="list-disc pl-5 space-y-1">
                                {results[activeAudience].improvement_notes!.map((note, i) => (
                                  <li key={i}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {results[activeAudience].audience_alignment_notes && (
                            <div className="space-y-2">
                              <h4 className="font-bold text-blue-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Audience Alignment
                              </h4>
                              <p>{results[activeAudience].audience_alignment_notes}</p>
                            </div>
                          )}

                          {results[activeAudience].keyword_gap && results[activeAudience].keyword_gap!.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-bold text-yellow-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                Missing Keywords
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {results[activeAudience].keyword_gap!.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px]">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        {/* Vertical Resize Handle (Left/Right) */}
          <div 
            onMouseDown={handleMouseDownDivider}
            className="hidden md:flex w-8 cursor-col-resize justify-center items-center group z-10 shrink-0"
          >
            <div className={`w-1 h-16 rounded-full transition-colors ${isResizingWidth ? 'bg-emerald-500' : 'bg-black/20 dark:bg-white/20 group-hover:bg-emerald-500/50'}`} />
          </div>

          {/* Result Section */}
          <div className="flex-1 min-w-0 flex flex-col h-full">
            <AnimatePresence mode="wait">
              {isOptimizing && Object.keys(results).length === 0 ? (
                <motion.div 
                  key="optimizing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed ${
                    isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/10'
                  }`}
                >
                  <div className="w-full max-w-md space-y-12">
                    <div className="relative w-32 h-32 mx-auto">
                      {/* Outer Ring */}
                      <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full" />
                      {/* Progress Ring */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="60"
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-emerald-500"
                          strokeDasharray={377}
                          strokeDashoffset={377 - (377 * optimizationProgress) / 100}
                          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Cpu className="w-12 h-12 text-emerald-500 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <h3 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Optimizing Resume</h3>
                      
                      <div className="flex justify-between items-end">
                        <p className="text-xs font-mono text-emerald-500 uppercase tracking-[0.2em] text-left max-w-[70%] leading-relaxed">
                          {optimizationStatus}
                        </p>
                        <span className="text-4xl font-black font-mono text-emerald-500">
                          {optimizationProgress}%
                        </span>
                      </div>
                      
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                        <motion.div 
                          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${optimizationProgress}%` }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-30">
                        <span>Analyzing Job Context</span>
                        <span>Generating Content</span>
                        <span>Finalizing</span>
                      </div>
                    </div>

                    <p className="opacity-40 text-sm leading-relaxed italic font-serif">
                      "Tailoring your experience for maximum impact..."
                    </p>
                  </div>
                </motion.div>
              ) : (Object.keys(results).length === 0) ? (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className={`h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 md:p-16 rounded-3xl border border-dashed relative overflow-hidden ${
                    isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/10'
                  }`}
                >
                  {/* Background Accents */}
                  <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
                  </div>

                  <div className="w-full max-w-3xl space-y-12 relative z-10">
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
                        <Zap className="w-3 h-3" />
                        AI-Powered Optimization
                      </div>
                      <h3 className={`text-4xl md:text-6xl font-black tracking-tight leading-[1.1] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Professional Identity</span>
                      </h3>
                      <p className="opacity-60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                        Upload your resume and target a specific role. Our AI will craft a high-impact version tailored for ATS success.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4 group">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Upload className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm uppercase tracking-widest">1. Input</h4>
                          <p className="text-xs opacity-40">Load your current experience</p>
                        </div>
                      </div>
                      <div className="space-y-4 group">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Target className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm uppercase tracking-widest">2. Target</h4>
                          <p className="text-xs opacity-40">Define your dream role</p>
                        </div>
                      </div>
                      <div className="space-y-4 group">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Zap className="w-8 h-8 text-yellow-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm uppercase tracking-widest">3. Optimize</h4>
                          <p className="text-xs opacity-40">Get your ATS-ready resume</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8">
                      <div className="flex items-center justify-center gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-5 h-5" />
                          <span className="text-xs font-bold uppercase tracking-widest">Hybrid Engine</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layout className="w-5 h-5" />
                          <span className="text-xs font-bold uppercase tracking-widest">Smart Layout</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          <span className="text-xs font-bold uppercase tracking-widest">ATS Scoring</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 h-full flex flex-col"
                >
                  {/* Resume Preview Pane */}
                  <div className={`flex-1 flex flex-col rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5 shadow-xl'}`}>
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
                      className={`flex-1 p-4 md:p-8 ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-200/50'} custom-scrollbar overflow-auto w-full`}
                    >
                      <div 
                        className="flex flex-col gap-8 w-max mx-auto"
                        style={{
                          zoom: zoom
                        }}
                      >
                        <div 
                          id="resume-container"
                          className={`resume-page transition-all duration-300 relative ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : 'shadow-2xl'}`}
                        >
                          {sectionOrder.map((sectionId) => renderSection(sectionId))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Download Button */}
                    <div className="p-2 border-t border-white/10 flex justify-center bg-white/5">
                      <button 
                        onClick={downloadPDF}
                        disabled={isDownloading}
                        className="px-6 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all transform hover:scale-105 font-bold uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100"
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
    </div>
  </div>

    <footer className={`w-full px-4 md:px-8 py-12 border-t mt-12 transition-colors ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
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
