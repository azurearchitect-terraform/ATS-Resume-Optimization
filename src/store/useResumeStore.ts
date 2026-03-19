import { create } from 'zustand';
import { ResumeElement, ResumeStyle, ElementType } from '../types/resume';
import masterResume from '../master-resume.json';

interface ResumeStore {
  elements: ResumeElement[];
  selectedElementId: string | null;
  history: ResumeElement[][];
  historyIndex: number;
  zoom: number;
  showGrid: boolean;
  darkMode: boolean;
  
  // AI Config
  jobDescription: string;
  targetRole: string;
  isOptimizing: boolean;
  aiEngine: string;
  comparisonData: {
    original: ResumeElement[];
    optimized: ResumeElement[];
    isVisible: boolean;
  } | null;

  // Actions
  addElement: (type: ElementType) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<ResumeElement>) => void;
  updateElementStyle: (id: string, style: Partial<ResumeStyle>) => void;
  selectElement: (id: string | null) => void;
  reorderElements: (newElements: ResumeElement[]) => void;
  toggleVisibility: (id: string) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleDarkMode: () => void;
  resetResume: () => void;
  updateConfig: (updates: { jobDescription?: string; targetRole?: string; aiEngine?: string }) => void;
  setIsOptimizing: (val: boolean) => void;
  setComparisonData: (data: { original: ResumeElement[]; optimized: ResumeElement[]; isVisible: boolean } | null) => void;
  applyOptimization: (optimizedElements: ResumeElement[]) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

const DEFAULT_STYLE: ResumeStyle = {
  fontFamily: 'Inter',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,
  color: '#1a1a1a',
  backgroundColor: 'transparent',
  padding: 16,
  margin: 8,
  borderRadius: 0,
};

const INITIAL_ELEMENTS: ResumeElement[] = [
  {
    id: 'header-1',
    type: 'header',
    content: {
      name: masterResume.personal_info.name,
      title: masterResume.personal_info.title,
      email: masterResume.personal_info.email,
      phone: masterResume.personal_info.phone,
      location: masterResume.personal_info.location,
      website: masterResume.personal_info.website,
      avatar: 'https://picsum.photos/seed/avatar/150/150',
    },
    style: { ...DEFAULT_STYLE, fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
    isVisible: true,
  },
  {
    id: 'summary-1',
    type: 'text',
    content: {
      title: 'Professional Summary',
      text: masterResume.personal_info.summary,
    },
    style: DEFAULT_STYLE,
    isVisible: true,
  },
  {
    id: 'experience-1',
    type: 'experience',
    content: {
      title: 'Experience',
      items: masterResume.experience,
    },
    style: DEFAULT_STYLE,
    isVisible: true,
  },
  {
    id: 'skills-1',
    type: 'skills',
    content: {
      title: 'Skills',
      items: masterResume.skills,
    },
    style: DEFAULT_STYLE,
    isVisible: true,
  },
  {
    id: 'projects-1',
    type: 'projects',
    content: {
      title: 'Projects',
      items: masterResume.projects,
    },
    style: DEFAULT_STYLE,
    isVisible: true,
  },
  {
    id: 'education-1',
    type: 'education',
    content: {
      title: 'Education',
      items: masterResume.education,
    },
    style: DEFAULT_STYLE,
    isVisible: true,
  },
];

export const useResumeStore = create<ResumeStore>((set, get) => ({
  elements: INITIAL_ELEMENTS,
  selectedElementId: null,
  history: [INITIAL_ELEMENTS],
  historyIndex: 0,
  zoom: 1,
  showGrid: true,
  darkMode: false,
  jobDescription: '',
  targetRole: '',
  isOptimizing: false,
  aiEngine: 'gemini-3-flash-preview',
  comparisonData: null,

  saveToHistory: () => {
    const { elements, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...elements]);
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  addElement: (type) => {
    const id = `${type}-${Date.now()}`;
    let content = {};

    switch (type) {
      case 'text':
        content = { title: 'New Section', text: 'Enter your content here...' };
        break;
      case 'experience':
        content = {
          title: 'Experience',
          items: [{ company: 'Company Name', role: 'Role', period: '2020 - Present', description: 'Key achievements...' }],
        };
        break;
      case 'education':
        content = {
          title: 'Education',
          items: [{ school: 'University Name', degree: 'Degree Name', period: '2016 - 2020' }],
        };
        break;
      case 'skills':
        content = { title: 'Skills', items: ['React', 'TypeScript', 'Tailwind CSS'] };
        break;
      case 'projects':
        content = {
          title: 'Projects',
          items: [{ name: 'Project Name', description: 'Project description...', link: 'https://github.com' }],
        };
        break;
    }

    const newElement: ResumeElement = {
      id,
      type,
      content,
      style: { ...DEFAULT_STYLE },
      isVisible: true,
    };

    set((state) => ({
      elements: [...state.elements, newElement],
      selectedElementId: id,
    }));
    get().saveToHistory();
  },

  removeElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }));
    get().saveToHistory();
  },

  updateElement: (id, updates) => {
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    }));
  },

  updateElementStyle: (id, style) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, style: { ...el.style, ...style } } : el
      ),
    }));
    get().saveToHistory();
  },

  selectElement: (id) => set({ selectedElementId: id }),

  reorderElements: (newElements) => {
    set({ elements: newElements });
    get().saveToHistory();
  },

  toggleVisibility: (id) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, isVisible: !el.isVisible } : el
      ),
    }));
    get().saveToHistory();
  },

  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
  resetResume: () => {
    set({
      elements: INITIAL_ELEMENTS,
      selectedElementId: null,
      history: [INITIAL_ELEMENTS],
      historyIndex: 0,
      zoom: 1,
      showGrid: true,
    });
  },

  updateConfig: (updates) => set((state) => ({ ...state, ...updates })),
  setIsOptimizing: (val) => set({ isOptimizing: val }),
  setComparisonData: (data) => set({ comparisonData: data }),
  applyOptimization: (optimizedElements) => {
    set({
      elements: optimizedElements,
      comparisonData: null,
    });
    get().saveToHistory();
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        elements: [...history[newIndex]],
        historyIndex: newIndex,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        elements: [...history[newIndex]],
        historyIndex: newIndex,
      });
    }
  },
}));
