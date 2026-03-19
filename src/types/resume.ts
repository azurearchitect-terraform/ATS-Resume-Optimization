export type ElementType = 'header' | 'text' | 'experience' | 'education' | 'skills' | 'projects';

export interface ResumeStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  margin?: number;
  borderRadius?: number;
}

export interface ResumeElement {
  id: string;
  type: ElementType;
  content: any;
  style: ResumeStyle;
  isVisible: boolean;
}

export interface ResumeState {
  elements: ResumeElement[];
  selectedElementId: string | null;
  history: ResumeElement[][];
  historyIndex: number;
  layoutSettings: {
    zoom: number;
    showGrid: boolean;
  };
}
