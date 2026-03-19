import React, { createContext, useContext, useReducer, useCallback } from 'react';

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface SectionStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  textTransform: TextTransform;
}

interface FormattingState {
  activeSection: string | null;
  styles: Record<string, SectionStyle>;
  history: {
    past: Record<string, SectionStyle>[];
    future: Record<string, SectionStyle>[];
  };
}

type FormattingAction =
  | { type: 'SET_ACTIVE_SECTION'; sectionId: string }
  | { type: 'UPDATE_STYLE'; sectionId: string; updates: Partial<SectionStyle> }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; sectionId: string };

const DEFAULT_STYLE: SectionStyle = {
  fontFamily: 'Inter',
  fontSize: 11,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
  textAlign: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,
  textTransform: 'none',
};

const FormattingContext = createContext<{
  state: FormattingState;
  dispatch: React.Dispatch<FormattingAction>;
} | null>(null);

function formattingReducer(state: FormattingState, action: FormattingAction): FormattingState {
  switch (action.type) {
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSection: action.sectionId };

    case 'UPDATE_STYLE': {
      const currentStyles = state.styles[action.sectionId] || DEFAULT_STYLE;
      const newStyles = { ...state.styles, [action.sectionId]: { ...currentStyles, ...action.updates } };
      return {
        ...state,
        styles: newStyles,
        history: {
          past: [...state.history.past, state.styles],
          future: [],
        },
      };
    }

    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      return {
        ...state,
        styles: previous,
        history: {
          past: newPast,
          future: [state.styles, ...state.history.future],
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      return {
        ...state,
        styles: next,
        history: {
          past: [...state.history.past, state.styles],
          future: newFuture,
        },
      };
    }

    case 'RESET':
      return {
        ...state,
        styles: { ...state.styles, [action.sectionId]: DEFAULT_STYLE },
      };

    default:
      return state;
  }
}

export const FormattingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(formattingReducer, {
    activeSection: 'header',
    styles: {
      header: { ...DEFAULT_STYLE, fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
      summary: DEFAULT_STYLE,
      experience: DEFAULT_STYLE,
      skills: DEFAULT_STYLE,
      education: DEFAULT_STYLE,
    },
    history: { past: [], future: [] },
  });

  return (
    <FormattingContext.Provider value={{ state, dispatch }}>
      {children}
    </FormattingContext.Provider>
  );
};

export const useFormatting = () => {
  const context = useContext(FormattingContext);
  if (!context) throw new Error('useFormatting must be used within FormattingProvider');
  return context;
};
