export type ElementType = 'text' | 'image' | 'shape';

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  opacity?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: ElementStyle;
  rotation?: number;
  isVisible?: boolean;
}

export interface ResumeState {
  elements: CanvasElement[];
  selectedElementIds: string[];
  history: CanvasElement[][];
  historyIndex: number;
  layoutSettings: {
    zoom: number;
    showGrid: boolean;
  };
}
