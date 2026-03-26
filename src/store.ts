import { create } from 'zustand';
import { ResumeData, LayoutBlock, ResumeTemplate } from './types';
import { TEMPLATES } from './templates';

interface ResumeStore {
  data: ResumeData;
  template: ResumeTemplate;
  pages: LayoutBlock[][];
  isGridVisible: boolean;
  isSnapToGrid: boolean;
  isSmartGuidesEnabled: boolean;
  
  setData: (data: ResumeData) => void;
  setTemplate: (templateId: string) => void;
  toggleGrid: () => void;
  updateBlockPosition: (pageIndex: number, blockId: string, x: number, y: number) => void;
}

/**
 * Zustand store for managing resume state, templates, and layout.
 */
export const useResumeStore = create<ResumeStore>((set, get) => ({
  data: {
    personal_info: { 
      name: 'John Doe', 
      email: 'john@example.com', 
      phone: '+1 234 567 890', 
      location: 'San Francisco, CA', 
      summary: 'Experienced Cloud Architect with a focus on Azure and DevOps.' 
    },
    experience: [],
    skills: [],
    education: [],
    projects: [],
  },
  template: TEMPLATES.azureArchitect as unknown as ResumeTemplate,
  pages: [],
  isGridVisible: false,
  isSnapToGrid: true,
  isSmartGuidesEnabled: true,

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
}));
