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
  EyeOff,
  FileDown,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Building,
  HelpCircle,
  Maximize,
  HardDrive,
  Cloud,
  RefreshCw,
  ExternalLink,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from './components/SortableSection';
import { CareerTools } from './components/CareerTools';
import { AdditionalTools } from './components/AdditionalTools';
import { StatusIndicator } from './components/StatusIndicator';
import { Toast, ConfirmDialog } from './components/UI.tsx';
import { MODE_DESCRIPTIONS, AUDIENCES, MODEL_PRICING } from './constants';
import { downloadDOCX, downloadJSON } from './services/exportService';
import { useResumeStore } from './store';
import { ResumeData, SuitabilityResult } from './types';
import { detectOverflow } from './overflowDetection';
import { useFormatting, DEFAULT_STYLE } from './context/FormattingContext';
import { optimizeResume, fetchJobDescription, analyzeBestAudiences, evaluateSuitability, OptimizationResult, EngineType, EngineConfig } from './services/geminiService';
import { RouterConfig } from './services/aiRouter';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { saveAs } from 'file-saver';

import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, increment, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError } from './lib/firebaseUtils';
import { OperationType } from './types';
import { AdminDashboard } from './components/AdminDashboard';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950">
      <div className="w-full max-w-md p-8 bg-[#141414] rounded-3xl border border-white/10 shadow-2xl space-y-6 text-center">
        <h1 className="text-3xl font-black text-white tracking-tight">AI Resume Optimizer</h1>
        <p className="text-emerald-400/70">Securely optimize your resume for architect-level roles.</p>
        <button
          onClick={onLogin}
          className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

type OptimizationMode = 'conservative' | 'balanced' | 'aggressive';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [encryptedApiKey, setEncryptedApiKey] = useState('');
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isFetchingDriveFiles, setIsFetchingDriveFiles] = useState(false);
  const [renamingDriveFileId, setRenamingDriveFileId] = useState<string | null>(null);
  const [newDriveFileName, setNewDriveFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('driveAccessToken');
  });
  const [versioningEnabled, setVersioningEnabled] = useState(() => {
    return localStorage.getItem('versioningEnabled') === 'true';
  });
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(() => {
    return localStorage.getItem('isAutosaveEnabled') === 'true';
  });
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  useEffect(() => {
    // Clean up URL parameters if they exist (like ?origin=...)
    if (window.location.search) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('versioningEnabled', versioningEnabled.toString());
  }, [versioningEnabled]);

  useEffect(() => {
    localStorage.setItem('isAutosaveEnabled', isAutosaveEnabled.toString());
  }, [isAutosaveEnabled]);

  useEffect(() => {
    if (driveAccessToken) {
      localStorage.setItem('driveAccessToken', driveAccessToken);
    } else {
      localStorage.removeItem('driveAccessToken');
    }
  }, [driveAccessToken]);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void, onCancel: () => void } | null>(null);

  useEffect(() => {
    if (encryptedApiKey) {
      setEngineConfig(prev => ({
        ...prev,
        gemini: { ...prev.gemini, apiKey: encryptedApiKey },
        openai: { ...prev.openai, apiKey: encryptedApiKey },
      }));
    }
  }, [encryptedApiKey]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef).catch(err => {
            handleFirestoreError(err, OperationType.GET, 'users/' + currentUser.uid);
            return undefined;
          });
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            if (data.masterResume) {
              setResumeText(data.masterResume);
            }
            if (data.customPrompt) {
              setCustomPrompt(data.customPrompt);
            }
            if (data.settings) {
              if (typeof data.settings.versioningEnabled === 'boolean') {
                setVersioningEnabled(data.settings.versioningEnabled);
              }
              if (typeof data.settings.isAutosaveEnabled === 'boolean') {
                setIsAutosaveEnabled(data.settings.isAutosaveEnabled);
              }
              if (typeof data.settings.isDriveConnected === 'boolean') {
                setIsDriveConnected(data.settings.isDriveConnected);
              }
            }
            if (data.encryptedApiKey) {
              setEncryptedApiKey(data.encryptedApiKey);
              setOpenaiApiKey('••••••••••••••••'); // Placeholder
              setGeminiApiKey('••••••••••••••••'); // Placeholder
              setIsApiKeySaved(true);
            }
            if (data.driveAccessToken) {
              setDriveAccessToken(data.driveAccessToken);
              setIsDriveConnected(true);
            }
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      } else {
        setOpenaiApiKey('');
        setGeminiApiKey('');
        setEncryptedApiKey('');
        setIsApiKeySaved(false);
        setDriveAccessToken(null);
        setIsDriveConnected(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleTestDrive = async () => {
    setIsTestingDrive(true);
    try {
      const url = driveAccessToken 
        ? `/api/test-drive?accessToken=${driveAccessToken}` 
        : '/api/test-drive';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchDriveFiles();
      } else {
        if (data.error && data.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
        showToast(data.error || 'Connection failed', 'error');
      }
    } catch (err) {
      showToast('Failed to reach server', 'error');
    } finally {
      setIsTestingDrive(false);
    }
  };

  const fetchDriveFiles = async () => {
    if (!driveAccessToken && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return;
    setIsFetchingDriveFiles(true);
    try {
      const url = driveAccessToken 
        ? `/api/list-drive-files?accessToken=${driveAccessToken}` 
        : '/api/list-drive-files';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setDriveFiles(data.files);
      } else if (data.error && data.error.includes('AUTH_EXPIRED')) {
        setDriveAccessToken(null);
      }
    } catch (err) {
      console.error('Failed to fetch Drive files:', err);
    } finally {
      setIsFetchingDriveFiles(false);
    }
  };

  const handleRenameDriveFile = async (fileId: string) => {
    if (!newDriveFileName.trim()) return;
    try {
      const response = await fetch('/api/rename-drive-file', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          newName: newDriveFileName,
          accessToken: driveAccessToken 
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast('File renamed successfully', 'success');
        setRenamingDriveFileId(null);
        setNewDriveFileName('');
        fetchDriveFiles();
      } else {
        if (data.error && data.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
        showToast(data.error || 'Failed to rename file', 'error');
      }
    } catch (err) {
      showToast('Failed to rename file', 'error');
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    setConfirmDialog({
      message: "Are you sure you want to delete this file from Google Drive? This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await fetch('/api/delete-drive-file', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileId,
              accessToken: driveAccessToken 
            })
          });
          const data = await response.json();
          if (data.success) {
            showToast('File deleted successfully', 'success');
            fetchDriveFiles();
          } else {
            if (data.error && data.error.includes('AUTH_EXPIRED')) {
              setDriveAccessToken(null);
            }
            showToast(data.error || 'Failed to delete file', 'error');
          }
        } catch (err) {
          showToast('Failed to delete file', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  useEffect(() => {
    if (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      fetchDriveFiles();
    }
  }, [driveAccessToken]);

  const handleConnectDrive = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
        setIsDriveConnected(true);
        // Save token to Firestore for cross-device autoconnect
        if (user) {
          await setDoc(doc(db, 'users', user.uid), {
            driveAccessToken: credential.accessToken,
            settings: { isDriveConnected: true }
          }, { merge: true });
        }
        showToast('Google Drive connected successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Drive connection error:', error);
      if (error.code === 'auth/cancelled-popup-request') {
        showToast('Login cancelled. Please complete the Google popup to connect Drive.', 'error');
      } else {
        showToast('Failed to connect Google Drive', 'error');
      }
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Add Drive scope for autoconnect
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
        setIsDriveConnected(true);
        // Save token to Firestore for cross-device autoconnect
        if (result.user) {
          await setDoc(doc(db, 'users', result.user.uid), {
            driveAccessToken: credential.accessToken,
            settings: { isDriveConnected: true }
          }, { merge: true });
        }
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/cancelled-popup-request') {
        showToast("Login cancelled. Please complete the Google popup.", "error");
      } else {
        showToast("Failed to login.", "error");
      }
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
      showToast("Please login first.", "error");
      return;
    }
    if (!resumeText) {
      showToast("Please provide your master resume.", "error");
      return;
    }

    setIsSavingProfile(true);
    try {
      let finalEncryptedKey = encryptedApiKey;

      // If the user entered a new API key (not the placeholder)
      if ((openaiApiKey && openaiApiKey !== '••••••••••••••••') || (geminiApiKey && geminiApiKey !== '••••••••••••••••')) {
        const keysToEncrypt = JSON.stringify({
          gemini: geminiApiKey !== '••••••••••••••••' ? geminiApiKey : '',
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
        if (openaiApiKey) setOpenaiApiKey('••••••••••••••••');
        if (geminiApiKey) setGeminiApiKey('••••••••••••••••');
        setIsApiKeySaved(true);
      }

      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        encryptedApiKey: finalEncryptedKey,
        masterResume: resumeText,
        customPrompt: customPrompt,
        settings: {
          versioningEnabled,
          isAutosaveEnabled,
          isDriveConnected: !!driveAccessToken || isDriveConnected
        },
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));

      showToast("Profile saved successfully!", "success");
    } catch (err) {
      console.error("Error saving profile:", err);
      showToast("Failed to save profile.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetKeys = async () => {
    if (!user) return;
    
    setConfirmDialog({
      message: "Are you sure you want to clear your saved API keys? You will need to re-enter them.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await setDoc(doc(db, 'users', user.uid), {
            encryptedApiKey: "",
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid));
          setOpenaiApiKey('');
          setGeminiApiKey('');
          setEncryptedApiKey('');
          setIsApiKeySaved(false);
          showToast("API keys cleared successfully.", "success");
        } catch (err) {
          console.error("Error resetting keys:", err);
          showToast("Failed to reset keys.", "error");
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const [resumeText, setResumeText] = useState(() => {
    const saved = localStorage.getItem('resumeText');
    if (saved) return saved;
    
    return "";
  });
  const [jobDescription, setJobDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'build' | 'style' | 'assets' | 'profile' | 'tools'>('build');
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
  const [suitabilityResult, setSuitabilityResult] = useState<SuitabilityResult | null>(null);
  const [isCheckingSuitability, setIsCheckingSuitability] = useState(false);

  // Profile Overrides
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || '');
  const [profileLocation, setProfileLocation] = useState(() => localStorage.getItem('profileLocation') || 'Hyderabad, Telangana, India');
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
  const [resumeVersions, setResumeVersions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const loadVersions = async () => {
        const q = query(collection(db, 'users', user.uid, 'resumeVersions'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q).catch(err => {
          handleFirestoreError(err, OperationType.LIST, 'users/' + user.uid + '/resumeVersions');
          return undefined;
        });
        if (querySnapshot) {
          const versions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setResumeVersions(versions);
        }
      };
      loadVersions();
    } else {
      setResumeVersions([]);
    }
  }, [user]);

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
    const res = activeAudience ? results[activeAudience] : null;
    if (res) {
      const newData: ResumeData = {
        personal_info: {
          name: profileName || res.personal_info?.name || '',
          location: profileLocation || res.personal_info?.location || '',
          email: profileEmail || res.personal_info?.email || '',
          phone: profilePhone || res.personal_info?.phone || '',
          linkedin: profileLinkedIn || res.personal_info?.linkedin || '',
          linkedinText: profileLinkedInText || res.personal_info?.linkedinText || '',
          summary: res.summary || ''
        },
        experience: (res.experience || []).map((e: any, i: number) => ({ ...e, id: `exp_${i}` })),
        skills: (res.skills || {}) as any,
        education: (res.education && res.education.length > 0) ? res.education as any : data.education,
        projects: (res.projects && res.projects.length > 0) 
          ? res.projects?.map((p: any) => typeof p === 'string' ? p : { title: (p as any).title, description: (p as any).description, isOptional: true as const }) as any
          : data.projects,
        certifications: res.certifications || []
      };

      // Use a more robust comparison to avoid infinite loops
      const currentDataStr = JSON.stringify(data);
      const newDataStr = JSON.stringify(newData);
      
      if (currentDataStr !== newDataStr) {
        setData(newData);
      }
    }
  }, [activeAudience, results, setData, profileName, profileLocation, profileEmail, profilePhone, profileLinkedIn, profileLinkedInText, data]);

  const overflow = detectOverflow(pages);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showInsights, setShowInsights] = useState(true);
  
  const [engineConfig, setEngineConfig] = useState<Record<string, any>>({
    gemini: { model: 'gemini-3.1-pro-preview', apiKey: '' },
    openai: { model: 'gpt-4o-mini', apiKey: '' },
    production: { model: 'auto', apiKey: '' }
  });
  const [selectedEngine, setSelectedEngine] = useState<'gemini' | 'openai' | 'hybrid-gemini' | 'hybrid-openai'>('gemini');
  const [showEngineSettings, setShowEngineSettings] = useState(false);
  
  const getSectionStyle = (sectionId: string) => {
    const style = sectionStyles[sectionId] || {};
    return { ...DEFAULT_STYLE, ...style };
  };

  const [configWidth, setConfigWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1600) return 30;
      if (window.innerWidth >= 1200) return 35;
      return 40;
    }
    return 40;
  }); // percentage
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAutoZoom, setIsAutoZoom] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [previewMode, setPreviewMode] = useState<'standard' | 'simplified'>('standard');
  const [isDownloading, setIsDownloading] = useState(false);

  const saveResumeVersion = async (customName?: string) => {
    const savedHistory = JSON.parse(localStorage.getItem('resumeHistory') || '[]');
    
    // Avoid saving if identical to last entry
    const lastEntry = savedHistory[0];
    if (lastEntry && 
        lastEntry.data.resumeText === resumeText && 
        JSON.stringify(lastEntry.data.results) === JSON.stringify(results)) {
      return;
    }

    if (!user) return;

    const timestamp = new Date().toISOString();
    let generatedName = customName;
    
    if (!generatedName) {
      if (companyName && targetRole) {
        generatedName = `${companyName} - ${targetRole} - ${new Date(timestamp).toLocaleString()}`;
      } else if (companyName) {
        generatedName = `${companyName} - ${new Date(timestamp).toLocaleString()}`;
      } else if (targetRole) {
        generatedName = `${targetRole} - ${new Date(timestamp).toLocaleString()}`;
      } else {
        generatedName = `Auto-save - ${new Date(timestamp).toLocaleString()}`;
      }
    }

    const newVersion = {
      id: Date.now(),
      timestamp,
      name: generatedName,
      data: {
        resumeText,
        jobDescription,
        targetRole,
        companyName,
        results,
        activeAudience,
        selectedAudiences,
        formatting: formattingState
      }
    };

    await addDoc(collection(db, 'users', user.uid, 'resumeVersions'), {
        userId: user.uid,
        timestamp: serverTimestamp(),
        name: generatedName,
        data: {
          resumeText,
          jobDescription,
          targetRole,
          companyName,
          results,
          activeAudience,
          selectedAudiences,
          formatting: formattingState
        }
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'users/' + user.uid + '/resumeVersions'));
    window.dispatchEvent(new CustomEvent('resumeHistoryUpdated'));
  };

  // Auto-save to history mechanism
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!resumeText || resumeText.length < 50) return; // Don't save empty or very short resumes
    
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    
    autoSaveTimerRef.current = setTimeout(() => {
      saveResumeVersion();
    }, 30000); // Auto-save every 30 seconds of inactivity

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [resumeText, jobDescription, targetRole, companyName, results, formattingState]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationStatus, setOptimizationStatus] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tokenUsage, setTokenUsage] = useState({
    gemini: { input: 0, output: 0 },
    openai: { input: 0, output: 0 }
  });

  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getCurrentMonthStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const fetchTokenUsageManual = async () => {
    if (!user) return;
    setIsRefreshingTokens(true);
    const currentMonth = getCurrentMonthStr();
    const path = `users/${user.uid}/tokenUsage/${currentMonth}`;
    const usageRef = doc(db, path);
    
    try {
      const docSnap = await getDoc(usageRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTokenUsage({
          gemini: data.gemini || { input: 0, output: 0 },
          openai: data.openai || { input: 0, output: 0 }
        });
      }
      showToast('Token usage updated', 'success');
    } catch (err) {
      console.error('Failed to refresh tokens:', err);
      showToast('Failed to refresh tokens', 'error');
    } finally {
      setIsRefreshingTokens(false);
    }
  };

  // Fetch token usage from Firestore on login/date change
  useEffect(() => {
    if (!user) {
      setTokenUsage({
        gemini: { input: 0, output: 0 },
        openai: { input: 0, output: 0 }
      });
      return;
    }

    const currentMonth = getCurrentMonthStr();
    const path = `users/${user.uid}/tokenUsage/${currentMonth}`;
    const usageRef = doc(db, path);
    
    // Use onSnapshot for real-time cross-device sync
    const unsubscribe = onSnapshot(usageRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTokenUsage({
          gemini: data.gemini || { input: 0, output: 0 },
          openai: data.openai || { input: 0, output: 0 }
        });
      } else {
        setTokenUsage({
          gemini: { input: 0, output: 0 },
          openai: { input: 0, output: 0 }
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync token usage to Firestore when it changes
  const syncTokenUsage = async (engine: 'gemini' | 'openai', input: number, output: number) => {
    if (!user) return;
    const currentMonth = getCurrentMonthStr();
    const path = `users/${user.uid}/tokenUsage/${currentMonth}`;
    const usageRef = doc(db, path);
    try {
      await setDoc(usageRef, {
        userId: user.uid,
        month: currentMonth,
        [engine]: {
          input: increment(input),
          output: increment(output)
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const generateTokenReport = async () => {
    if (!user) return;
    setIsDownloading(true);
    try {
      const usageCol = collection(db, 'users', user.uid, 'tokenUsage');
      const q = query(usageCol, orderBy('month', 'desc'));
      const querySnapshot = await getDocs(q);
      
      let csv = "Month,Gemini Input,Gemini Output,OpenAI Input,OpenAI Output\n";
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        csv += `${d.month},${d.gemini?.input || 0},${d.gemini?.output || 0},${d.openai?.input || 0},${d.openai?.output || 0}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const fileName = `TokenUsageReport_${user.uid}_${getTodayStr()}.csv`;
      
      // Save locally
      saveAs(blob, fileName);

      // Save to Google Drive if connected
      if (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          try {
            const response = await fetch('/api/save-to-drive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pdfData: base64data,
                fileName: fileName,
                versioningEnabled: false,
                accessToken: driveAccessToken
              })
            });
            const data = await response.json();
            if (data.success) {
              showToast("Report saved to Google Drive", "success");
            }
          } catch (err) {
            console.error("Error saving report to Drive:", err);
          }
        };
      }
      
      showToast("Token usage report generated", "success");
    } catch (err) {
      console.error("Error generating report:", err);
      showToast("Failed to generate report", "error");
    } finally {
      setIsDownloading(false);
    }
  };
  
  const resumePreviewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [customFonts, setCustomFonts] = useState<{name: string, url: string, format: string}[]>([]);

  // Autosave to Drive logic
  useEffect(() => {
    if (!isOptimizing && Object.keys(results).length > 0 && isAutosaveEnabled && (driveAccessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        handleDriveAutosave();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOptimizing, results, isAutosaveEnabled]);

  const handleDriveAutosave = async () => {
    try {
      const element = document.getElementById('resume-container');
      if (!element) return;

      // Get all styles and imports
      const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => {
          if (el.tagName === 'STYLE') return el.innerHTML;
          if (el.tagName === 'LINK') {
            const href = (el as HTMLLinkElement).href;
            if (href.includes('fonts.googleapis.com')) return `@import url('${href}');`;
          }
          return '';
        })
        .join('\n');

      const role = targetRole || 'Resume';
      const company = companyName ? `-${companyName}` : '';
      const pdfTitle = `${role}${company}_Harnish Jariwala`;

      const sessionResponse = await fetch('/api/pdf-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: element.outerHTML,
          css: allStyles,
          title: pdfTitle,
          fonts: customFonts.map(font => `
            @font-face {
              font-family: '${font.name}';
              src: url('${font.url}') format('${font.format}');
            }
          `).join('\n')
        }),
      });

      if (!sessionResponse.ok) return;
      const { sessionId } = await sessionResponse.json();
      
      const pdfResponse = await fetch(`/api/download-pdf/${sessionId}`);
      if (!pdfResponse.ok) return;
      
      const blob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        const saveResponse = await fetch('/api/save-to-drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfData: base64data,
            fileName: `${pdfTitle}.pdf`,
            versioningEnabled: versioningEnabled,
            accessToken: driveAccessToken
          })
        });
        
        const saveData = await saveResponse.json();
        if (saveResponse.ok && saveData.success) {
          showToast('Autosaved to Google Drive', 'success');
          fetchDriveFiles();
        } else if (saveData.error && saveData.error.includes('AUTH_EXPIRED')) {
          setDriveAccessToken(null);
        }
      };
    } catch (err) {
      console.error('Autosave error:', err);
    }
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
      const format = file.name.endsWith('.woff2') ? 'woff2' : file.name.endsWith('.woff') ? 'woff' : 'truetype';
      
      const style = document.createElement('style');
      style.innerHTML = `
        @font-face {
          font-family: '${fontName}';
          src: url('${base64}') format('${format}');
        }
      `;
      document.head.appendChild(style);

      setCustomFonts(prev => [...prev, { name: fontName, url: base64, format }]);
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
    
    const calculateZoom = () => {
      if (!previewContainerRef.current) return;
      
      const container = previewContainerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      if (containerWidth === 0 || containerHeight === 0) return;

      const resumeElement = document.getElementById('resume-container');
      if (!resumeElement) return;

      const currentZoom = zoom || 1;
      const contentWidth = resumeElement.offsetWidth / currentZoom;
      const contentHeight = resumeElement.scrollHeight / currentZoom;
      
      if (contentWidth === 0 || contentHeight === 0) return;

      const padding = window.innerWidth < 768 ? 8 : 32; 
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding;
      
      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      
      let newZoom;
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // On mobile, fit width but don't go too small
        newZoom = Math.max(0.4, Math.min(scaleX, 1.0));
      } else {
        // On desktop/laptop, fit both dimensions to ensure it's fully visible in the pane
        newZoom = Math.max(0.2, Math.min(scaleX, scaleY, 1.1));
      }
      
      if (Math.abs(newZoom - currentZoom) > 0.01) {
        setZoom(newZoom);
      }
    };

    const observer = new ResizeObserver((entries) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        calculateZoom();
      });
    });

    observer.observe(previewContainerRef.current);
    
    // Initial calculation
    calculateZoom();

    return () => {
      observer.disconnect();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeAudience, isAutoZoom, results, data, previewMode]); // Re-run when content or mode changes

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
      } else if (file.type === 'text/plain' || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (file.type === 'application/json') {
            try {
              const json = JSON.parse(content);
              setResumeText(JSON.stringify(json, null, 2));
            } catch (e) {
              setError('Invalid JSON file.');
              return;
            }
          } else {
            setResumeText(content);
          }
          setFileName(file.name);
        };
        reader.readAsText(file);
      } else {
        setError('Please upload a PDF, TXT, or JSON file.');
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
    if (version.data.activeAudience) setActiveAudience(version.data.activeAudience);
    else if (version.data.results && Object.keys(version.data.results).length > 0) {
      setActiveAudience(Object.keys(version.data.results)[0]);
    }
    if (version.data.selectedAudiences) setSelectedAudiences(version.data.selectedAudiences);
    if (version.data.targetRole) setTargetRole(version.data.targetRole);
    if (version.data.companyName) setCompanyName(version.data.companyName);
    if (version.data.formatting) {
      formattingDispatch({ type: 'SET_ALL_STYLES', styles: version.data.formatting.styles || {} });
    }
    
    setActiveTab('build');
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

  const handleCheckSuitability = async () => {
    if (!resumeText || (!jobDescription && !jobUrl)) {
      setError('Please provide both a resume and a job description (or URL).');
      return;
    }

    setIsCheckingSuitability(true);
    setSuitabilityResult(null);
    setError(null);

    try {
      let finalJobDescription = jobDescription;
      if (!finalJobDescription && jobUrl) {
        finalJobDescription = await fetchJobDescription(jobUrl, getRouterConfig());
      }

      const result = await evaluateSuitability(resumeText, finalJobDescription, getRouterConfig());
      setSuitabilityResult(result);
    } catch (err: any) {
      console.error("Suitability check failed:", err);
      setError(err.message || 'Failed to check suitability. Please try again.');
    } finally {
      setIsCheckingSuitability(false);
    }
  };

  const handleOptimize = async () => {
    console.log("handleOptimize called");
    setError("Optimization started...");
    
    const routerConfig = getRouterConfig();
    
    // Check for missing API keys
    if (selectedEngine === 'openai' && !routerConfig.openaiConfig.apiKey) {
      setError("API keys are now managed securely in your Profile. Please go to the Profile tab and save your OpenAI API key.");
      return;
    }
    if (selectedEngine === 'gemini' && !routerConfig.geminiConfig.apiKey) {
      setError("API keys are now managed securely in your Profile. Please go to the Profile tab and save your Gemini API key.");
      return;
    }
    if (selectedEngine === 'hybrid-openai' && (!routerConfig.openaiConfig.apiKey || !routerConfig.geminiConfig.apiKey)) {
      setError("Hybrid OpenAI Mode requires both OpenAI and Gemini API keys.");
      return;
    }
    if (selectedEngine === 'hybrid-gemini' && !routerConfig.geminiConfig.apiKey) {
      setError("Hybrid Gemini Mode requires a Gemini API key.");
      return;
    }

    if (!targetRole.trim() || !companyName.trim()) {
      setError('Target Role and Company Name are mandatory.');
      return;
    }

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
    
    const engineNameMap: Record<string, string> = {
      'gemini': 'GEMINI',
      'openai': 'OPENAI',
      'hybrid-gemini': 'Hybrid (Gemini 3.1 Pro)',
      'hybrid-openai': 'Hybrid (OpenAI GPT-5.4 Nano)'
    };
    const engineName = engineNameMap[selectedEngine as keyof typeof engineNameMap] || selectedEngine.toUpperCase();
    setOptimizationStatus(`Initializing ${engineName}...`);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const finalResumeText = resumeText || "";
      const finalTargetRole = targetRole || "Professional Candidate";
      
      const routerConfig = getRouterConfig();
      let completedAudiences = 0;
      const totalAudiences = currentAudiences.length;
      const engineName = engineNameMap[selectedEngine as keyof typeof engineNameMap] || selectedEngine.toUpperCase();

      // Run all audience optimizations in parallel
      const optimizationPromises = currentAudiences.map(async (audienceId) => {
        const audienceLabel = AUDIENCES.find(a => a.id === audienceId)?.label || audienceId;
        
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
          recruiterSimulationMode,
          customPrompt,
          selectedEngine.includes('hybrid') ? selectedEngine : undefined
        );
        
        completedAudiences++;
        setOptimizationProgress(Math.min(95, (completedAudiences / currentAudiences.length) * 100));
        
        // Update token usage
        if (data._engine === 'hybrid-v2') {
          // Handle V2 Pipeline (OpenAI + Gemini)
          if (data._usage) {
            const openaiInput = data._usage.promptTokenCount || 0;
            const openaiOutput = data._usage.candidatesTokenCount || 0;
            setTokenUsage(prev => ({
              ...prev,
              openai: {
                input: (prev.openai.input || 0) + openaiInput,
                output: (prev.openai.output || 0) + openaiOutput
              }
            }));
            syncTokenUsage('openai', openaiInput, openaiOutput);
          }
          if (data._geminiUsage) {
            const geminiInput = data._geminiUsage.promptTokenCount || 0;
            const geminiOutput = data._geminiUsage.candidatesTokenCount || 0;
            setTokenUsage(prev => ({
              ...prev,
              gemini: {
                input: (prev.gemini.input || 0) + geminiInput,
                output: (prev.gemini.output || 0) + geminiOutput
              }
            }));
            syncTokenUsage('gemini', geminiInput, geminiOutput);
          }
        } else if (data._usage && data._engine) {
          // Handle Legacy Pipeline
          const engine = data._engine === 'gemini' ? 'gemini' : 'openai';
          const inputDelta = data._usage!.promptTokenCount || 0;
          const outputDelta = data._usage!.candidatesTokenCount || 0;
          
          setTokenUsage(prev => ({
            ...prev,
            [engine]: {
              input: (prev[engine].input || 0) + inputDelta,
              output: (prev[engine].output || 0) + outputDelta
            }
          }));
          
          syncTokenUsage(engine, inputDelta, outputDelta);
        }

        // Update results
        setResults(prev => {
          const newResults = { 
            ...prev, 
            [audienceId]: { 
              ...data, 
              _engine: selectedEngine, 
              _model: engineConfig[selectedEngine].model 
            } as any
          };
          
          if (!activeAudience) {
            setActiveAudience(audienceId);
          }
          
          return newResults;
        });

        return data;
      });

      const optimizationResults = await Promise.all(optimizationPromises);
      const matchScore = optimizationResults[0]?.match_score || 0;
      
      // Save version immediately after optimization
      saveResumeVersion(`Optimized - ${companyName} - ${new Date().toLocaleString()}`);

      // Sync to Job Tracker (Firestore)
      if (user) {
        try {
          const docRef = await addDoc(collection(db, 'users', user.uid, 'jobs'), {
            company: companyName || 'Unknown Company',
            role: targetRole || 'Professional Candidate',
            salary: 'Not specified',
            skills: [],
            status: 'Saved',
            dateAdded: Date.now(),
            jd: jobDescription || jobUrl || '',
            score: matchScore,
            updatedAt: serverTimestamp()
          });
          setLastJobId(docRef.id);
        } catch (e) {
          console.error("Failed to sync to Job Tracker (Firestore)", e);
        }
      } else {
        // Fallback to localStorage for guest users
        try {
          const savedJobs = localStorage.getItem('ai_job_tracker');
          const jobs = savedJobs ? JSON.parse(savedJobs) : [];
          const newId = Date.now().toString();
          const newJob = {
            id: newId,
            company: companyName,
            role: targetRole,
            salary: 'Not specified',
            skills: [],
            status: 'Saved',
            dateAdded: Date.now(),
            jd: jobDescription || jobUrl || '',
            score: matchScore
          };
          localStorage.setItem('ai_job_tracker', JSON.stringify([newJob, ...jobs]));
          setLastJobId(newId);
        } catch (e) {
          console.error("Failed to sync to Job Tracker", e);
        }
      }
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
    showToast('Resume text copied to clipboard! You can paste this into Word or any other editor.', 'success');
  };

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownDivider = (e: React.MouseEvent) => {
    setIsResizingWidth(true);
    e.preventDefault();
  };

  const resetLayout = () => {
    if (window.innerWidth >= 1600) setConfigWidth(30);
    else if (window.innerWidth >= 1200) setConfigWidth(35);
    else setConfigWidth(40);
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
          // SaaS constraints: 25% to 55%
          setConfigWidth(Math.max(25, Math.min(55, newWidthPercent)));
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

  const syncJobTrackerApplied = async () => {
    if (!lastJobId) return;

    if (user) {
      try {
        const jobRef = doc(db, 'users', user.uid, 'jobs', lastJobId);
        await updateDoc(jobRef, {
          status: 'Applied',
          appliedDate: Date.now(),
          updatedAt: serverTimestamp()
        });
        showToast("Job status updated to Applied in Tracker", "success");
      } catch (e) {
        console.error("Failed to update job status in Firestore", e);
      }
    } else {
      try {
        const savedJobs = localStorage.getItem('ai_job_tracker');
        if (savedJobs) {
          const jobs = JSON.parse(savedJobs);
          const updatedJobs = jobs.map((j: any) => 
            j.id === lastJobId ? { ...j, status: 'Applied', appliedDate: Date.now() } : j
          );
          localStorage.setItem('ai_job_tracker', JSON.stringify(updatedJobs));
          showToast("Job status updated to Applied in Tracker", "success");
        }
      } catch (e) {
        console.error("Failed to update job status in localStorage", e);
      }
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById('resume-container');
    if (!element) return;

    // Save version automatically
    saveResumeVersion();

    // Sync to Job Tracker as Applied
    syncJobTrackerApplied();


    // Temporarily clear active section for clean PDF
    const previousActiveSection = activeSection;
    formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: null });
    setIsDownloading(true);

    try {
      // Small delay to allow React to re-render without highlights
      await new Promise(resolve => setTimeout(resolve, 1000));

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

      // Get all styles and imports
      const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => {
          if (el.tagName === 'STYLE') {
            return el.innerHTML;
          } else if (el.tagName === 'LINK') {
            // For link tags, we can't easily get the content, but we can try to include the import if it's a font
            const href = (el as HTMLLinkElement).href;
            if (href.includes('fonts.googleapis.com')) {
              return `@import url('${href}');`;
            }
          }
          return '';
        })
        .join('\n');

      const role = targetRole || 'Resume';
      const company = companyName ? `-${companyName}` : '';
      const pdfTitle = `${role}${company}_Harnish Jariwala`;

      const sessionResponse = await fetch('/api/pdf-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: element.outerHTML,
          css: allStyles,
          title: pdfTitle,
          fonts: customFonts.map(font => `
            @font-face {
              font-family: '${font.name}';
              src: url('${font.url}') format('${font.format}');
            }
          `).join('\n')
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create PDF session');
      }

      const { sessionId } = await sessionResponse.json();
      
      const downloadUrl = `/api/download-pdf/${sessionId}`;
      const pdfResponse = await fetch(downloadUrl);
      
      if (!pdfResponse.ok) {
        const errText = await pdfResponse.text();
        throw new Error(`Failed to download PDF: ${errText}`);
      }
      
      const contentType = pdfResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Server did not return a valid PDF file.');
      }
      
      const blob = await pdfResponse.blob();

      // Convert blob to base64 for Drive saving
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        
        // Save to Google Drive
        try {
          const driveSaveResponse = await fetch('/api/save-to-drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfData: base64data,
              fileName: `${pdfTitle}.pdf`,
              versioningEnabled: versioningEnabled,
              accessToken: driveAccessToken
            })
          });
          
          if (driveSaveResponse.ok) {
            showToast('Resume saved to Google Drive!', 'success');
          } else {
            const driveError = await driveSaveResponse.json();
            console.error('Drive save error:', driveError);
            
            if (driveError.error && driveError.error.includes('AUTH_EXPIRED')) {
              setDriveAccessToken(null);
            }

            // Only show error if it's not just a missing env var (which is expected until configured)
            if (driveError.error && !driveError.error.includes("GOOGLE_SERVICE_ACCOUNT_KEY")) {
              showToast('Failed to save to Google Drive', 'error');
            }
          }
        } catch (driveErr) {
          console.error('Drive save fetch error:', driveErr);
        }
      };

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      link.download = `${pdfTitle}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      showToast(err.message || 'Failed to generate PDF. Please try again.', 'error');
    } finally {
      // Restore active section
      if (previousActiveSection) {
        formattingDispatch({ type: 'SET_ACTIVE_SECTION', sectionId: previousActiveSection });
      }
      setIsDownloading(false);
    }
  };

  const handleDownloadDOCX = async () => {
    const res = results[activeAudience!] || data;
    await downloadDOCX(res, targetRole, companyName, showToast);
    
    // Sync to Job Tracker as Applied
    syncJobTrackerApplied();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearInputs = () => {
    setJobDescription('');
    setTargetRole('');
    setCompanyName('');
    setJobUrl('');
    setResults({});
    setActiveAudience(null);
    setSuitabilityResult(null);
    showToast("Job details cleared.", "info");
  };

  const renderSimplifiedResume = () => {
    const res = results[activeAudience!] || data;
    if (!res) return null;

    return (
      <div className="bg-white text-black font-serif leading-tight max-w-[210mm] min-w-[210mm] min-h-[297mm] mx-auto shadow-sm" style={{ padding: '12mm' }}>
        {/* Header - 2 Lines */}
        <div className="text-center mb-4 border-b pb-2">
          <h1 className="text-xl font-bold uppercase mb-0.5 tracking-tight">{res.personal_info?.name || ''}</h1>
          <p className="text-[10px] opacity-80 tracking-wide">
            {res.personal_info?.location || ''} | {res.personal_info?.email || ''} | {res.personal_info?.phone || ''} | {res.personal_info?.linkedin || ''}
          </p>
        </div>

        {/* Summary */}
        <div className="mb-4">
          <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-widest">Professional Summary</h2>
          <p className="text-[11px] text-justify leading-relaxed">{(res as any).summary || (res as any).personal_info?.summary || ""}</p>
        </div>

        {/* Skills */}
        <div className="mb-4">
          <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-wider">Technical Skills</h2>
          <p className="text-[11px] leading-relaxed">
            {Array.isArray(res.skills) 
              ? res.skills.join(", ") 
              : Object.entries(res.skills).map(([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`).join(" | ")}
          </p>
        </div>

        {/* Experience */}
        <div className="mb-4">
          <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-wider">Professional Experience</h2>
          {Array.isArray(res.experience) && res.experience.map((exp: any, i: number) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between font-bold text-[11px]">
                <span>{exp.role}</span>
                <span className="font-normal italic">{exp.duration}</span>
              </div>
              <div className="italic mb-0.5 text-[10.5px] opacity-90">{exp.company}</div>
              <ul className="list-disc ml-4 text-[10.5px] space-y-0.5 opacity-90">
                {Array.isArray(exp.bullets) && exp.bullets.map((bullet: string, bi: number) => (
                  <li key={bi} className="leading-snug">{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Projects */}
        {Array.isArray(res.projects) && res.projects.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-wider">Strategic Projects</h2>
            {res.projects.map((proj: any, i: number) => (
              <div key={i} className="mb-2">
                <div className="font-bold text-[11px]">{typeof proj === 'string' ? proj : proj.title}</div>
                {typeof proj !== 'string' && proj.description && (
                  <ul className="list-disc ml-4 text-[10.5px] space-y-0.5 opacity-90">
                    <li className="leading-snug">{proj.description}</li>
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {Array.isArray(res.certifications) && res.certifications.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-wider">Certifications</h2>
            <ul className="list-disc ml-4 text-[10.5px] space-y-0.5 opacity-90">
              {res.certifications.map((cert: string, i: number) => (
                <li key={i}>{cert}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Education */}
        {Array.isArray(res.education) && res.education.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[12px] font-bold border-b mb-1 uppercase tracking-wider">Education</h2>
            <ul className="list-disc ml-4 text-[10.5px] space-y-0.5 opacity-90">
              {res.education.map((edu: any, i: number) => (
                <li key={i}>
                  {typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (${edu.expected_completion})`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (sectionId: string, customExp?: any[], isContinuation?: boolean) => {
    switch (sectionId) {
      case 'header':
        const personalInfo = {
          ...(results[activeAudience!]?.personal_info as any || {}),
          name: profileName || results[activeAudience!]?.personal_info?.name || data.personal_info?.name || '',
          location: profileLocation || results[activeAudience!]?.personal_info?.location || data.personal_info?.location || '',
          email: profileEmail || results[activeAudience!]?.personal_info?.email || data.personal_info?.email || '',
          phone: profilePhone || results[activeAudience!]?.personal_info?.phone || data.personal_info?.phone || '',
          linkedin: profileLinkedIn || results[activeAudience!]?.personal_info?.linkedin || data.personal_info?.linkedin || '',
          linkedinText: profileLinkedInText || results[activeAudience!]?.personal_info?.linkedinText || '',
          summary: results[activeAudience!]?.summary || data.personal_info?.summary || ''
        } as any;
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
              <span className="opacity-30">•</span>
              <span className="whitespace-nowrap">{personalInfo.email}</span>
              <span className="opacity-30">•</span>
              <span className="whitespace-nowrap">{personalInfo.phone}</span>
              {personalInfo.linkedin && (
                <>
                  <span className="opacity-30">•</span>
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
              padding: `${Math.max(4, getSectionStyle('skills').padding / 2)}px`,
              marginBottom: `${Math.max(4, getSectionStyle('skills').margin / 2)}px`,
              fontSize: `${getSectionStyle('skills').fontSize}px`,
            }}
          >
            <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
              Core Competencies
            </h2>
            {results[activeAudience!]?.skills && !Array.isArray(results[activeAudience!].skills) ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {Object.entries(results[activeAudience!].skills).map(([category, items]) => (
                  <div key={category} className="text-[11px] leading-tight">
                    <div className="font-bold uppercase text-gray-600 mb-1">{category}</div>
                    <div className="opacity-90">{(items as unknown as string[]).join(', ')}</div>
                  </div>
                ))}
              </div>
            ) : typeof data.skills === 'object' && !Array.isArray(data.skills) ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {Object.entries(data.skills as any).map(([category, items]) => (
                  <div key={category} className="text-[11px] leading-tight">
                    <div className="font-bold uppercase text-gray-600 mb-1">{category}</div>
                    <div className="opacity-90">{(items as unknown as string[]).join(', ')}</div>
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
        const allExp = customExp || results[activeAudience!]?.experience || data.experience;
        if (!Array.isArray(allExp) || allExp.length === 0) return null;
        return (
          <div 
            key={isContinuation ? "experience-split-2" : "experience"}
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
            {!isContinuation && (
              <h2 className="font-bold mb-1 uppercase tracking-[0.1em] border-b-2 border-black/10 pb-1" style={{ fontSize: '15px' }}>
                Professional Experience
              </h2>
            )}
            {allExp.map((exp: any, i: number) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex justify-between font-bold items-baseline mb-0.5">
                  <span style={{ fontSize: '13px' }}>{exp.role}</span>
                  <span className="opacity-70 font-medium italic" style={{ fontSize: '11px' }}>{exp.duration}</span>
                </div>
                <div className="font-semibold mb-2 text-emerald-700" style={{ fontSize: '12px' }}>{exp.company}</div>
                <div className="space-y-1">
                  {Array.isArray(exp.bullets) && exp.bullets.map((b: string, bi: number) => (
                    <div key={bi} className="resume-bullet-item">
                      <div className="resume-bullet-dot" />
                      <span className="resume-bullet-text opacity-90 leading-relaxed">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      case 'projects':
        const allProjects = (Array.isArray(results[activeAudience!]?.projects) && results[activeAudience!]?.projects.length > 0) 
          ? results[activeAudience!]?.projects 
          : data.projects;
        if (!Array.isArray(allProjects) || allProjects.length === 0) return null;
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
              {allProjects.map((proj: any, i: number) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="font-bold mb-1" style={{ fontSize: '13px' }}>
                    {typeof proj === 'string' ? proj : (proj as any).title}
                  </div>
                  {typeof proj !== 'string' && (proj as any).description && (
                    <div className="resume-bullet-item">
                      <div className="resume-bullet-dot" />
                      <span className="resume-bullet-text opacity-90 leading-relaxed">
                        {(proj as any).description}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'education':
        const allEdu = (Array.isArray(results[activeAudience!]?.education) && results[activeAudience!]?.education.length > 0) 
          ? results[activeAudience!]?.education 
          : data.education || [];
        if (!Array.isArray(allEdu) || allEdu.length === 0) return null;
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
            {allEdu.map((edu: any, i: number) => (
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

  if (showAdminDashboard) {
    return <AdminDashboard onBack={() => setShowAdminDashboard(false)} isDarkMode={isDarkMode} />;
  }

  if (isAuthReady && !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'} font-sans selection:bg-emerald-500/30`}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDialog && (
        <ConfirmDialog 
          message={confirmDialog.message} 
          onConfirm={confirmDialog.onConfirm} 
          onCancel={confirmDialog.onCancel} 
          isDarkMode={isDarkMode} 
        />
      )}
      {/* Header */}
      <header className={`shrink-0 border-b sticky top-0 z-50 transition-colors w-full ${isDarkMode ? 'bg-neutral-950/80 backdrop-blur-md border-white/10' : 'bg-white/80 backdrop-blur-md border-black/5'}`}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-emerald-500' : 'bg-black'}`}>
              <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-black' : 'text-emerald-400'}`} />
            </div>
            <span className="font-bold text-xl tracking-tight">ATS.OPTIMIZER</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-black/5 text-emerald-600'} ${isFocusMode ? 'bg-emerald-500/20' : ''}`}
              title={isFocusMode ? "Exit Focus Mode" : "Focus Mode"}
            >
              {isFocusMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button 
              onClick={resetLayout}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-black/5 text-emerald-600'}`}
              title="Reset Layout"
            >
              <Maximize className="w-5 h-5" />
            </button>
            {user?.email === 'hackerharnish@gmail.com' && (
              <button
                onClick={() => setShowAdminDashboard(true)}
                className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-black/5 text-emerald-600'}`}
                title="Admin Dashboard"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-amber-400' : 'hover:bg-black/5 text-blue-600'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <span className={`hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest opacity-60 px-2 py-1 rounded bg-white/5 border border-white/10`}>V-3.0.0 - (Ver. 18-04-2026)</span>
            <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-500 animate-pulse`}>
              <Cpu className="w-3 h-3" />
              <span>GEMINI 3.1 PRO (NATIVE)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden max-w-[1600px] w-full mx-auto relative" ref={containerRef}>
        {/* Configuration Pane */}
        <div 
          ref={leftPanelRef}
          className={`flex flex-col h-full border-r relative ${isDarkMode ? 'bg-neutral-950 border-white/10' : 'bg-white border-black/5'} transition-all duration-200 ease-in-out ${isFocusMode ? 'w-0 opacity-0 pointer-events-none border-none' : ''}`}
          style={{ 
            width: isMobile ? '100%' : (isFocusMode ? '0' : `${configWidth}%`),
            minWidth: isMobile ? '100%' : (isFocusMode ? '0' : '320px'),
            maxWidth: isMobile ? '100%' : (isFocusMode ? '0' : '800px')
          }}
        >
          <div className={`sticky top-0 z-20 p-2 md:p-4 border-b ${isDarkMode ? 'bg-neutral-950 border-white/10' : 'bg-white border-black/5'}`}>
            <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/5 rounded-lg">
                      {(['build', 'profile', 'style', 'assets', 'tools'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
                            activeTab === tab
                              ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-300 text-black shadow-sm')
                              : (isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/60 hover:text-black')
                          }`}
                        >
                          {tab === 'assets' ? 'Assets' : tab}
                        </button>
                      ))}
                    </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 space-y-6">
            {activeTab === 'build' && (
                <div className="space-y-6">
                  <section className={`rounded-2xl border p-6 shadow-xl transition-colors ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Layout className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <h2 className="font-semibold text-lg">Builder</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => downloadJSON(activeAudience ? results[activeAudience] : data, targetRole, companyName, showToast)}
                          className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
                            isDarkMode 
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                          title="Export Resume to JSON"
                        >
                          <Download className="w-3 h-3" />
                          JSON
                        </button>
                        <button 
                          onClick={clearInputs}
                          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-white/40 hover:text-red-400' : 'hover:bg-black/5 text-black/40 hover:text-red-600'}`}
                          title="Clear all inputs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {activeAudience && results[activeAudience] && results[activeAudience].match_score !== undefined && (
                      <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div>
                          <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Match Score</h3>
                          <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>Based on current JD</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {results[activeAudience].baseline_score !== undefined && (
                            <div className="text-right">
                              <span className={`text-[10px] uppercase tracking-widest opacity-60 block`}>Old</span>
                              <span className={`font-bold text-lg opacity-60 line-through`}>{results[activeAudience].baseline_score}%</span>
                            </div>
                          )}
                          <div className="text-right">
                            <span className={`text-[10px] uppercase tracking-widest text-emerald-500 block`}>New</span>
                            <span className={`font-bold text-2xl text-emerald-500`}>{results[activeAudience].match_score}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Target Role */}
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Target Role *</label>
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
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Company Name *</label>
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
                          <span className="truncate flex items-center gap-2">
                            {selectedAudiences.length > 0
                              ? (
                                <>
                                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Auto</span>
                                  {selectedAudiences.map(id => AUDIENCES.find(a => a.id === id)?.label || id).join(', ')}
                                </>
                              )
                              : 'Select audiences...'}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </button>
                        {isAudienceDropdownOpen && (
                          <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                            isDarkMode ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-black/5'
                          }`}>
                            <div className="p-2 border-b border-white/10 flex gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAudiences(['microsoft']);
                                }}
                                className="flex-1 py-1 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20 transition-colors"
                              >
                                Reset
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAudiences([]);
                                }}
                                className="flex-1 py-1 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                              >
                                Clear
                              </button>
                            </div>
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
                            <div className="grid grid-cols-2 gap-3">
                              {(['gemini', 'openai', 'hybrid-gemini', 'hybrid-openai'] as const).map((eng) => (
                                <button
                                  key={eng}
                                  onClick={() => setSelectedEngine(eng)}
                                  className={`py-3 text-[10px] font-black rounded-xl border transition-all capitalize tracking-widest ${
                                    selectedEngine === eng 
                                      ? (isDarkMode ? 'bg-emerald-500 text-black border-emerald-500 shadow-xl shadow-emerald-500/20 scale-[1.02]' : 'bg-black text-white border-black shadow-xl shadow-black/20 scale-[1.02]')
                                      : (isDarkMode ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10' : 'bg-white text-black/60 border-black/5 hover:bg-black/5')
                                  }`}
                                >
                                  {eng === 'hybrid-gemini' ? 'Hybrid Gemini' : eng === 'hybrid-openai' ? 'Hybrid OpenAI' : eng}
                                </button>
                              ))}
                            </div>
                            {selectedEngine === 'hybrid-gemini' && (
                              <p className="mt-3 text-[10px] opacity-50 italic leading-relaxed">
                                Hybrid Gemini uses Gemini Flash for extraction and Gemini 3.1 Pro for high-reasoning creative rewriting. (Native & Efficient)
                              </p>
                            )}
                            {selectedEngine === 'hybrid-openai' && (
                              <p className="mt-3 text-[10px] opacity-50 italic leading-relaxed">
                                Hybrid OpenAI uses Gemini Flash for extraction and OpenAI GPT-4o for creative synthesis. (Premium Hybrid)
                              </p>
                            )}
                          </div>

                          <div className="space-y-8">
                           {!selectedEngine.startsWith('hybrid') ? (
                             <div className="space-y-3">
                               <label className="block text-[11px] font-black uppercase tracking-[0.15em] mb-2 opacity-50">Model Configuration</label>
                               <div className="relative">
                                 <select 
                                   className={`w-full px-4 py-3.5 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none ${
                                     isDarkMode ? 'bg-[#1A1A1A] border-white/10 text-white' : 'bg-white border-black/10 text-black'
                                   }`}
                                   value={engineConfig[selectedEngine === 'gemini' ? 'gemini' : 'openai'].model}
                                   onChange={(e) => setEngineConfig({
                                     ...engineConfig,
                                     [selectedEngine === 'gemini' ? 'gemini' : 'openai']: { ...engineConfig[selectedEngine === 'gemini' ? 'gemini' : 'openai'], model: e.target.value }
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
                                       <option value="gpt-4o">GPT-4o (Premium)</option>
                                       <option value="gpt-4o-mini">GPT-4o-mini (Fast)</option>
                                       <option value="o1-preview">o1-preview (Reasoning)</option>
                                       <option value="o1-mini">o1-mini (Reasoning Fast)</option>
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
                             {/* Removed Authentication Keys message per user request */}
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
                          <div className="flex flex-col sm:flex-row gap-2">
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
                              className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 min-w-[100px] ${
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
                          
                          {/* Suitability Check Section */}
                          <div className="pt-2">
                            <button
                              onClick={handleCheckSuitability}
                              disabled={isCheckingSuitability || (!jobDescription && !jobUrl) || !resumeText}
                              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border ${
                                isCheckingSuitability || (!jobDescription && !jobUrl) || !resumeText
                                  ? (isDarkMode ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-black/5 border-black/10 text-black/30 cursor-not-allowed')
                                  : (isDarkMode ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100')
                              }`}
                            >
                              {isCheckingSuitability ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Evaluating Fit...
                                </>
                              ) : (
                                <>
                                  <Search className="w-4 h-4" />
                                  Quick Check Suitability
                                </>
                              )}
                            </button>

                            {suitabilityResult && (
                              <div className={`mt-3 p-4 rounded-xl border ${
                                suitabilityResult.verdict === 'Strong Match' 
                                  ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200')
                                  : suitabilityResult.verdict === 'Stretch Role'
                                    ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200')
                                    : (isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200')
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    {suitabilityResult.verdict === 'Strong Match' && <CheckCircle2 className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />}
                                    {suitabilityResult.verdict === 'Stretch Role' && <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />}
                                    {suitabilityResult.verdict === 'Not Recommended' && <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />}
                                    <span className={`font-bold ${
                                      suitabilityResult.verdict === 'Strong Match' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') :
                                      suitabilityResult.verdict === 'Stretch Role' ? (isDarkMode ? 'text-amber-400' : 'text-amber-700') :
                                      (isDarkMode ? 'text-red-400' : 'text-red-700')
                                    }`}>
                                      {suitabilityResult.verdict}
                                    </span>
                                  </div>
                                  <div className={`text-sm font-bold px-2 py-1 rounded-md ${
                                    suitabilityResult.matchScore >= 80 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                    suitabilityResult.matchScore >= 60 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                    'bg-red-500/20 text-red-600 dark:text-red-400'
                                  }`}>
                                    {suitabilityResult.matchScore}% Match
                                  </div>
                                </div>
                                
                                <p className={`text-sm mb-3 ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>
                                  {suitabilityResult.reasoning}
                                </p>

                                {suitabilityResult.dealbreakers.length > 0 && (
                                  <div className="mb-3">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Dealbreakers</span>
                                    <ul className="mt-1 space-y-1">
                                      {suitabilityResult.dealbreakers.map((db, i) => (
                                        <li key={i} className={`text-xs flex items-start gap-1.5 ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>
                                          <span className="text-red-500 mt-0.5">•</span> {db}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {suitabilityResult.strengths.length > 0 && (
                                  <div>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Key Strengths</span>
                                    <ul className="mt-1 space-y-1">
                                      {suitabilityResult.strengths.map((str, i) => (
                                        <li key={i} className={`text-xs flex items-start gap-1.5 ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>
                                          <span className="text-emerald-500 mt-0.5">•</span> {str}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Custom AI Optimization Prompt */}
                          <div className="mt-4">
                            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>Custom AI Optimization Prompt (Optional)</label>
                            <textarea 
                              placeholder="Add your own instructions for the AI (e.g., 'Focus more on my cloud architecture experience' or 'Use a more formal British English tone')"
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              rows={3}
                              className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm ${
                                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                              }`}
                            />
                            <p className="text-[10px] opacity-40 mt-1">These instructions will be given high priority during the resume optimization process.</p>
                          </div>
                          
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
                              <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2 w-full">
                                  <Cpu className="w-3 h-3 opacity-50" />
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Token Monitor</span>
                                      <button 
                                        onClick={fetchTokenUsageManual}
                                        disabled={isRefreshingTokens}
                                        className={`p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isRefreshingTokens ? 'animate-spin opacity-50' : 'opacity-50 hover:opacity-100'}`}
                                        title="Refresh Token Usage"
                                      >
                                        <RefreshCw className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                    <button 
                                      onClick={generateTokenReport}
                                      disabled={isDownloading}
                                      className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                    >
                                      <Download className="w-3 h-3" />
                                      Generate Report
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end mb-2">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                                  {selectedEngine.includes('hybrid') ? 'Hybrid Mode' : selectedEngine}
                                </span>
                              </div>
                              
                              <div className="space-y-3">
                                {(selectedEngine === 'gemini' || selectedEngine.startsWith('hybrid')) && (
                                  <div className={selectedEngine.startsWith('hybrid') ? 'pb-2 border-b border-black/5 dark:border-white/5' : ''}>
                                    {selectedEngine.startsWith('hybrid') && <span className="text-[9px] font-black uppercase tracking-widest opacity-40 block mb-1">Gemini</span>}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase opacity-40 font-bold">Input Tokens</span>
                                        <span className="text-xs font-mono font-bold">{(tokenUsage.gemini.input / 1000).toFixed(1)}k</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase opacity-40 font-bold">Output Tokens</span>
                                        <span className="text-xs font-mono font-bold">{(tokenUsage.gemini.output / 1000).toFixed(1)}k</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {(selectedEngine === 'openai' || selectedEngine === 'hybrid-openai') && (
                                  <div>
                                    {selectedEngine === 'hybrid-openai' && <span className="text-[9px] font-black uppercase tracking-widest opacity-40 block mb-1">OpenAI</span>}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase opacity-40 font-bold">Input Tokens</span>
                                        <span className="text-xs font-mono font-bold">{(tokenUsage.openai.input / 1000).toFixed(1)}k</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase opacity-40 font-bold">Output Tokens</span>
                                        <span className="text-xs font-mono font-bold">{(tokenUsage.openai.output / 1000).toFixed(1)}k</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                            placeholder="Enter your Gemini API Key (Optional)"
                            value={geminiApiKey}
                            onChange={(e) => {
                              setGeminiApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                          <p className="mt-1 text-[9px] opacity-40 italic">Note: If left empty, the system-wide Gemini key will be used.</p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">OpenAI API Key</label>
                          <input 
                            type="password"
                            placeholder="Enter your OpenAI API Key (Optional)"
                            value={openaiApiKey}
                            onChange={(e) => {
                              setOpenaiApiKey(e.target.value);
                              setIsApiKeySaved(false);
                            }}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
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
                          {isSavingProfile ? 'Saving...' : 'Save All Settings & Profile'}
                        </button>

                        <div className="mt-4">
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Upload Master Resume (PDF, JSON, TXT)</label>
                          <input 
                            type="file"
                            accept=".pdf,.json,.txt"
                            onChange={handleFileUpload}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-[#F9F9F9] border-black/5 text-black'
                            }`}
                          />
                        </div>

                        <button
                          onClick={() => {
                            setConfirmDialog({
                              message: "Are you sure you want to clear your saved API keys?",
                              onConfirm: async () => {
                                if (!user) return;
                                setConfirmDialog(null);
                                setOpenaiApiKey('');
                                setEncryptedApiKey('');
                                setIsApiKeySaved(false);
                                // Also update Firestore
                                await setDoc(doc(db, 'users', user.uid), {
                                  encryptedApiKey: ''
                                }, { merge: true });
                                showToast("API keys cleared.", "success");
                              },
                              onCancel: () => setConfirmDialog(null)
                            });
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
                      <HardDrive className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <h2 className="font-semibold text-lg">Google Drive Settings</h2>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="font-bold text-sm">OAuth Connection</div>
                            <div className="text-xs opacity-60">Connect *any* Google Drive account</div>
                          </div>
                          <button
                            onClick={handleConnectDrive}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                              driveAccessToken 
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                            }`}
                          >
                            {driveAccessToken ? 'Change / Reconnect Drive' : (isDriveConnected ? 'Connect Drive' : 'Connect Drive')}
                          </button>
                        </div>
                        
                        {isDriveConnected && !driveAccessToken && (
                          <div className="mb-4 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            <span>Drive connection expired or not found on this device. Please reconnect to sync your files.</span>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <div className="flex-1">
                            <div className="font-bold text-xs sm:text-sm">Versioning</div>
                            <div className="text-[10px] sm:text-xs opacity-60">Save new versions instead of overwriting</div>
                          </div>
                          <button
                            onClick={() => setVersioningEnabled(!versioningEnabled)}
                            className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all focus:outline-none shrink-0 ${
                              versioningEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                                versioningEnabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-bold text-xs sm:text-sm">Autosave on Generate</div>
                            <div className="text-[10px] sm:text-xs opacity-60">Automatically save to Drive after optimization</div>
                          </div>
                          <button
                            onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                            className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-all focus:outline-none shrink-0 ${
                              isAutosaveEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                                isAutosaveEnabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs opacity-60">
                        <div className={`w-2 h-2 rounded-full ${driveAccessToken ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        Drive Connection: {driveAccessToken ? 'Active' : 'Not Connected'}
                      </div>
                      <div className="flex items-center gap-2 text-xs opacity-60">
                        <div className={`w-2 h-2 rounded-full ${versioningEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        Versioning is {versioningEnabled ? 'Enabled' : 'Disabled'}
                      </div>
                      <button
                        onClick={handleTestDrive}
                        disabled={isTestingDrive}
                        className={`w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                          isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'
                        }`}
                      >
                        {isTestingDrive ? (
                          <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        )}
                        Test Drive Connection
                      </button>
                    </div>
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
                  <CareerTools 
                    isDarkMode={isDarkMode} 
                    engineConfig={engineConfig} 
                    selectedEngine={selectedEngine as any} 
                    resumeData={results[activeAudience]}
                    user={user}
                  />
                </div>
              )}
              {activeTab === 'assets' && (
                <div className="space-y-6">
                  <StatusIndicator
                    resumeText={getEffectiveResumeText()}
                    engineConfig={engineConfig}
                    isDarkMode={isDarkMode}
                  />
                  <AdditionalTools 
                    resumeText={getEffectiveResumeText()}
                    jobDescription={jobDescription}
                    targetRole={targetRole}
                    companyName={companyName}
                    isDarkMode={isDarkMode}
                    engineConfig={engineConfig}
                    selectedEngine={selectedEngine as any}
                    onRestore={restoreVersion}
                    currentResults={results}
                    activeAudience={activeAudience}
                    selectedAudiences={selectedAudiences}
                    setResumeText={setResumeText}
                    runOptimization={handleOptimize}
                    currentHeadline={""}
                    resumeSummary={data.personal_info.summary || ""}
                    keySkills={typeof data.skills === 'object' && !Array.isArray(data.skills) ? Object.values(data.skills).flat() : (data.skills as string[])}
                  />

                  {/* Google Drive Backups */}
                  {driveAccessToken && (
                    <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                      <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                            <Cloud className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">Drive Backups</h3>
                            <p className="text-[10px] opacity-50">PDFs saved to Google Drive</p>
                          </div>
                        </div>
                        <button 
                          onClick={fetchDriveFiles}
                          disabled={isFetchingDriveFiles}
                          className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${isFetchingDriveFiles ? 'animate-spin opacity-50' : ''}`}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {isFetchingDriveFiles && driveFiles.length === 0 ? (
                          <div className="py-8 text-center opacity-40 text-[10px] uppercase tracking-widest">
                            Fetching files...
                          </div>
                        ) : driveFiles.length > 0 ? (
                          <div className="space-y-1">
                            {driveFiles.map((file) => (
                              <div 
                                key={file.id}
                                className={`p-3 rounded-lg flex items-center justify-between group transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                  <FileText className="w-4 h-4 text-red-400 shrink-0" />
                                  <div className="overflow-hidden flex-1">
                                    {renamingDriveFileId === file.id ? (
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="text"
                                          value={newDriveFileName}
                                          onChange={(e) => setNewDriveFileName(e.target.value)}
                                          className="bg-black/20 text-xs p-1 rounded w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameDriveFile(file.id);
                                            if (e.key === 'Escape') setRenamingDriveFileId(null);
                                          }}
                                        />
                                        <button onClick={() => handleRenameDriveFile(file.id)} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => setRenamingDriveFileId(null)} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-xs font-medium truncate">{file.name}</p>
                                        <p className="text-[9px] opacity-40">
                                          {new Date(file.modifiedTime).toLocaleString()} • {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {renamingDriveFileId !== file.id && (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setRenamingDriveFileId(file.id);
                                          setNewDriveFileName(file.name.replace('.pdf', ''));
                                        }}
                                        className="p-1.5 rounded-md text-emerald-500 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/10 transition-all"
                                        title="Rename file"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <a 
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-md text-blue-500 opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 transition-all"
                                        title="View in Google Drive"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                      <button 
                                        onClick={() => handleDeleteDriveFile(file.id)}
                                        className="p-1.5 rounded-md text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                                        title="Delete file"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center opacity-40 text-[10px] uppercase tracking-widest">
                            No PDF backups found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                          
                          {Array.isArray(results[activeAudience].rejection_reasons) && results[activeAudience].rejection_reasons!.length > 0 && (
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

                          {Array.isArray(results[activeAudience].improvement_notes) && results[activeAudience].improvement_notes!.length > 0 && (
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

                          {Array.isArray(results[activeAudience].keyword_gap) && results[activeAudience].keyword_gap!.length > 0 && (
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

                          {results[activeAudience].why_this_job && (
                            <div className="space-y-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <h4 className="font-bold text-emerald-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Why This Job? (Recruiter Response)
                              </h4>
                              <p className="italic">"{results[activeAudience].why_this_job}"</p>
                            </div>
                          )}

                          {results[activeAudience]._intermediateData && (
                            <div className="space-y-2 mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                              <h4 className="font-bold text-purple-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Hybrid Pipeline Data (Gemini Extracted)
                              </h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="font-semibold opacity-70">Extracted JD Keywords:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {results[activeAudience]._intermediateData.jdKeywords?.map((kw: string, i: number) => (
                                      <span key={i} className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]">
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-semibold opacity-70">Parsed Resume Roles:</span>
                                  <ul className="list-disc pl-5 mt-1 opacity-80">
                                    {results[activeAudience]._intermediateData.resumeData?.experience?.map((exp: any, i: number) => (
                                      <li key={i}>{exp.role} at {exp.company}</li>
                                    ))}
                                  </ul>
                                </div>
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
          {!isFocusMode && (
            <div 
              onMouseDown={handleMouseDownDivider}
              onDoubleClick={resetLayout}
              className={`hidden md:flex w-1.5 cursor-col-resize justify-center items-center group z-30 transition-colors ${isResizingWidth ? 'bg-emerald-500' : 'hover:bg-emerald-500/30'}`}
            >
              <div className={`w-0.5 h-12 rounded-full transition-colors ${isResizingWidth ? 'bg-white' : 'bg-neutral-300 dark:bg-neutral-700 group-hover:bg-emerald-500'}`} />
            </div>
          )}

          {/* Result Section */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
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
                  className={`h-full min-h-[500px] flex flex-col items-center justify-start text-center p-8 md:p-16 rounded-3xl border border-dashed relative overflow-y-auto custom-scrollbar ${
                    isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/10'
                  }`}
                >
                  {/* Background Accents */}
                  <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
                  </div>

                  <div className="w-full max-w-4xl space-y-6 md:space-y-10 relative z-10 py-12 my-auto">
                    <div className="space-y-4 md:space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] md:text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
                        <Zap className="w-3 h-3" />
                        AI-Powered Optimization
                      </div>
                      <h3 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight leading-[1.1] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Professional Identity</span>
                      </h3>
                      <p className="opacity-60 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed font-medium px-4">
                        Upload your resume and target a specific role. Our AI will craft a high-impact version tailored for ATS success.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                      <div className="space-y-2 md:space-y-4 group">
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Upload className="w-6 h-6 md:w-8 md:h-8 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">1. Input</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Load your current experience</p>
                        </div>
                      </div>
                      <div className="space-y-2 md:space-y-4 group">
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Target className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">2. Target</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Define your dream role</p>
                        </div>
                      </div>
                      <div className="space-y-2 md:space-y-4 group">
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-black/5'}`}>
                          <Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-[10px] md:text-sm uppercase tracking-widest">3. Optimize</h4>
                          <p className="text-[9px] md:text-xs opacity-40">Get your ATS-ready resume</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 md:pt-8">
                      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Hybrid Engine</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layout className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Smart Layout</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">ATS Scoring</span>
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
                    <div className={`p-2 md:p-4 border-b flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 md:gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
                      <div className="flex flex-row items-center gap-2 md:gap-3">
                        <div className="flex flex-row gap-1 bg-black/20 dark:bg-white/5 p-1 rounded-lg">
                          <button 
                            onClick={() => setPreviewMode('standard')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              previewMode === 'standard' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'opacity-40 hover:opacity-100'
                            }`}
                          >
                            <Layout className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Standard</span>
                          </button>
                          <button 
                            onClick={() => setPreviewMode('simplified')}
                            className={`px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-1 md:gap-2 ${
                              previewMode === 'simplified' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'opacity-40 hover:opacity-100'
                            }`}
                          >
                            <AlignLeft className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="hidden xs:inline">Workday</span>
                          </button>
                        </div>
                        <div className="h-6 md:h-8 w-[1px] bg-white/10 mx-0.5 md:mx-1" />
                        <div className="flex flex-col justify-center">
                          <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest opacity-30 mb-0.5">Editing Section</span>
                          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate max-w-[80px] md:max-w-none">
                            {activeSection || 'Full Resume'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
                        {overflow.isOverflowing && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span>OVERFLOW</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className={`flex items-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 md:py-1 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                            <button 
                              onClick={() => {
                                setIsAutoZoom(false);
                                setZoom(z => Math.max(0.1, z - 0.1));
                              }}
                              className="p-0.5 md:p-1 hover:bg-white/10 rounded transition-colors"
                              title="Zoom Out"
                            >
                              <span className="text-[8px] md:text-[10px] font-bold">-</span>
                            </button>
                            <button
                              onClick={() => setIsAutoZoom(!isAutoZoom)}
                              className={`text-[8px] md:text-[9px] font-mono w-10 md:w-12 text-center hover:text-emerald-500 transition-colors ${isAutoZoom ? 'text-emerald-500' : ''}`}
                              title={isAutoZoom ? "Disable Auto-Zoom" : "Enable Auto-Zoom"}
                            >
                              {Math.round(zoom * 100)}%
                            </button>
                            <button 
                              onClick={() => {
                                setIsAutoZoom(false);
                                setZoom(z => Math.min(2, z + 0.1));
                              }}
                              className="p-0.5 md:p-1 hover:bg-white/10 rounded transition-colors"
                              title="Zoom In"
                            >
                              <span className="text-[8px] md:text-[10px] font-bold">+</span>
                            </button>
                          </div>

                          <button 
                            onClick={copyResumeText}
                            className={`p-1.5 md:p-2 rounded-lg transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                            title="Copy text for selectable use"
                          >
                            <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="hidden lg:inline">Copy</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className={`flex items-center gap-1.5 md:gap-2 px-1.5 md:px-2 py-1 md:py-1.5 rounded-lg border transition-all cursor-pointer hover:opacity-80 ${
                            versioningEnabled 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                              : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                          }`}
                          onClick={() => setVersioningEnabled(!versioningEnabled)}
                          title={versioningEnabled ? "Versioning is ON" : "Versioning is OFF"}
                          >
                            <HardDrive className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                              V: {versioningEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={handleDownloadDOCX}
                              className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 shadow-lg shadow-blue-500/10"
                              title="Download as Word Document"
                            >
                              <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              <span>DOCX</span>
                            </button>
                            <button 
                              onClick={downloadPDF}
                              disabled={isDownloading}
                              className="px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-[8px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                            >
                              {isDownloading ? (
                                <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              )}
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      ref={previewContainerRef}
                      className={`w-full h-full overflow-auto flex items-start justify-center ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-200/50'} custom-scrollbar`}
                    >
                      <div 
                        className="flex flex-col gap-8 w-max mx-auto"
                        style={{
                          zoom: zoom
                        }}
                      >
                        <div 
                          id="resume-container"
                          className={`transition-all duration-300 relative ${activeSection ? 'ring-2 ring-emerald-500/20' : ''} ${isDownloading ? 'legacy-colors' : 'shadow-2xl'}`}
                        >
                          {previewMode === 'standard' ? (
                            <>
                              {/* Page 1 */}
                              <div className={`resume-page ${isDownloading ? 'page-break-after-always' : 'mb-8'}`}>
                                {renderSection('header')}
                                {renderSection('summary')}
                                {renderSection('skills')}
                                {renderSection('certifications')}
                                {renderSection('experience', (results[activeAudience!]?.experience || data.experience).slice(0, 3))}
                              </div>

                              {/* Page 2 */}
                              <div className="resume-page">
                                {renderSection('experience', (results[activeAudience!]?.experience || data.experience).slice(3), true)}
                                {renderSection('projects')}
                                {renderSection('education')}
                              </div>
                            </>
                          ) : (
                            renderSimplifiedResume()
                          )}
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
        </main>

      {/* Bottom Panel / Footer */}
      <footer className={`shrink-0 w-full px-4 md:px-8 py-4 border-t transition-colors ${isDarkMode ? 'bg-neutral-950 border-white/10' : 'bg-white border-black/5'}`}>
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
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
