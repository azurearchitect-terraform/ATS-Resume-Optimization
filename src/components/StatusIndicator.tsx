import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusIndicatorProps {
  resumeText: string;
  engineConfig: Record<string, any>;
  isDarkMode: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ resumeText, engineConfig, isDarkMode }) => {
  const isMasterResumePresent = resumeText.trim().length > 0;
  const isGeminiKeyPresent = !!engineConfig.gemini?.apiKey;
  const isOpenAIKeyPresent = !!engineConfig.openai?.apiKey;

  const StatusItem = ({ label, isPresent }: { label: string, isPresent: boolean }) => (
    <div className="flex items-center gap-2 text-[10px]">
      {isPresent ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
      ) : (
        <AlertCircle className="w-3 h-3 text-red-500" />
      )}
      <span className={isDarkMode ? 'text-white/70' : 'text-black/70'}>{label}</span>
      <span className={`font-bold ${isPresent ? 'text-emerald-500' : 'text-red-500'}`}>
        {isPresent ? 'Present' : 'Missing'}
      </span>
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 mb-6 ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/5'}`}>
      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-white/50' : 'text-black/50'}`}>System Status</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusItem label="Master Resume:" isPresent={isMasterResumePresent} />
        <StatusItem label="Gemini API Key:" isPresent={isGeminiKeyPresent} />
        <StatusItem label="OpenAI API Key:" isPresent={isOpenAIKeyPresent} />
      </div>
    </div>
  );
};
