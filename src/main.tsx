import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FormattingProvider } from './context/FormattingContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormattingProvider>
      <App />
    </FormattingProvider>
  </StrictMode>,
);
