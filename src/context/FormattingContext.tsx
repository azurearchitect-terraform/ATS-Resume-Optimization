import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export const DEFAULT_STYLE = {
  fontFamily: 'Inter',
  fontSize: 10.5,
  lineHeight: 1.4,
  color: '#1a1a1a',
};

interface FormattingState {
  activeSection: string | null;
  styles: Record<string, any>;
}

type FormattingAction =
  | { type: 'SET_ACTIVE_SECTION'; sectionId: string | null }
  | { type: 'UPDATE_STYLE'; sectionId: string; style: any };

const initialState: FormattingState = {
  activeSection: null,
  styles: {},
};

function formattingReducer(state: FormattingState, action: FormattingAction): FormattingState {
  switch (action.type) {
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSection: action.sectionId };
    case 'UPDATE_STYLE':
      return {
        ...state,
        styles: {
          ...state.styles,
          [action.sectionId]: { ...state.styles[action.sectionId], ...action.style },
        },
      };
    default:
      return state;
  }
}

const FormattingContext = createContext<{
  state: FormattingState;
  dispatch: React.Dispatch<FormattingAction>;
} | undefined>(undefined);

export function FormattingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formattingReducer, initialState);

  return (
    <FormattingContext.Provider value={{ state, dispatch }}>
      {children}
    </FormattingContext.Provider>
  );
}

export function useFormatting() {
  const context = useContext(FormattingContext);
  if (context === undefined) {
    throw new Error('useFormatting must be used within a FormattingProvider');
  }
  return context;
}
