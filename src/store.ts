import { create } from 'zustand';
import { ResumeData, LayoutBlock, ResumeTemplate } from './types';
import { TEMPLATES } from './templates';
import { OptimizationResult } from './services/geminiService';

interface ResumeStore {
  data: ResumeData;
  template: ResumeTemplate;
  pages: LayoutBlock[][];
  isGridVisible: boolean;
  isSnapToGrid: boolean;
  isSmartGuidesEnabled: boolean;
  
  // AI Optimization State
  isOptimizing: boolean;
  results: Record<string, OptimizationResult>;
  activeAudience: string | null;
  currentOptimizingEngine: string | null;
  
  setData: (data: ResumeData) => void;
  setTemplate: (templateId: string) => void;
  toggleGrid: () => void;
  updateBlockPosition: (pageIndex: number, blockId: string, x: number, y: number) => void;
  setIsOptimizing: (val: boolean) => void;
  setResults: (results: Record<string, OptimizationResult> | ((prev: Record<string, OptimizationResult>) => Record<string, OptimizationResult>)) => void;
  setActiveAudience: (audience: string | null) => void;
  setCurrentOptimizingEngine: (engine: string | null) => void;
}

/**
 * Zustand store for managing resume state, templates, and layout.
 */
export const useResumeStore = create<ResumeStore>((set, get) => ({
  data: {
    personal_info: { 
      name: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      linkedin: '',
      linkedinText: ''
    },
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: []
  },
  template: TEMPLATES.azureArchitect as unknown as ResumeTemplate,
  pages: [],
  isGridVisible: false,
  isSnapToGrid: true,
  isSmartGuidesEnabled: true,
  
  // AI Optimization State
  isOptimizing: false,
  results: {},
  activeAudience: null,
  currentOptimizingEngine: null,

  setData: (data) => {
    set({ data, pages: [] });
  },

  setTemplate: (templateId) => {
    const template = (TEMPLATES[templateId] || TEMPLATES.azureArchitect) as unknown as ResumeTemplate;
    set({ template, pages: [] });
  },

  toggleGrid: () => set((state) => ({ isGridVisible: !state.isGridVisible })),

  updateBlockPosition: (pageIndex, blockId, x, y) => {
    const newPages = [...get().pages];
    if (newPages[pageIndex]) {
      const block = newPages[pageIndex].find(b => b.id === blockId);
      if (block) {
        block.x = x;
        block.y = y;
        set({ pages: newPages });
      }
    }
  },

  setIsOptimizing: (val) => set({ isOptimizing: val }),
  setResults: (results) => set((state) => ({ 
    results: typeof results === 'function' ? results(state.results) : results 
  })),
  setActiveAudience: (activeAudience) => set({ activeAudience }),
  setCurrentOptimizingEngine: (currentOptimizingEngine) => set({ currentOptimizingEngine }),
}));
