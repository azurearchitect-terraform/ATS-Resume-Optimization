import React from 'react';
import { useResumeStore } from '../store/useResumeStore';
import { X, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const ComparisonModal = () => {
  const { comparisonData, setComparisonData, applyOptimization, darkMode } = useResumeStore();

  if (!comparisonData || !comparisonData.isVisible) return null;

  const handleAccept = () => {
    applyOptimization(comparisonData.optimized);
  };

  const handleReject = () => {
    setComparisonData(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn(
            "rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden transition-colors",
            darkMode ? "bg-gray-800" : "bg-white"
          )}
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
            <div>
              <h2 className="text-xl font-bold">AI Optimization Comparison</h2>
              <p className="text-indigo-100 text-xs">Review the changes made by the AI before applying them to your resume.</p>
            </div>
            <button onClick={handleReject} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Original */}
            <div className={cn("flex-1 border-r flex flex-col", darkMode ? "border-gray-700" : "border-gray-100")}>
              <div className={cn("p-4 font-bold text-xs uppercase tracking-widest", darkMode ? "bg-gray-900 text-gray-500 border-b border-gray-700" : "bg-gray-50 text-gray-500 border-b border-gray-100")}>
                Original Content
              </div>
              <div className={cn("flex-1 overflow-y-auto p-8 space-y-6", darkMode ? "bg-gray-800" : "bg-white")}>
                {comparisonData.original.map((el) => (
                  <div key={el.id} className={cn("p-4 border rounded-xl opacity-60", darkMode ? "border-gray-700" : "border-gray-100")}>
                    <h4 className={cn("text-[10px] font-bold uppercase mb-2", darkMode ? "text-gray-500" : "text-gray-400")}>{el.type}</h4>
                    <div className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                      {el.type === 'text' && el.content.text}
                      {el.type === 'experience' && el.content.items?.map((item: any, i: number) => (
                        <div key={i} className="mb-2">
                          <div className={cn("font-bold", darkMode ? "text-gray-300" : "text-gray-800")}>{item.role} @ {item.company}</div>
                          <div className="text-xs">{item.description}</div>
                        </div>
                      ))}
                      {el.type === 'skills' && el.content.items?.join(', ')}
                      {el.type === 'projects' && el.content.items?.map((item: any, i: number) => (
                        <div key={i} className="mb-2">
                          <div className={cn("font-bold", darkMode ? "text-gray-300" : "text-gray-800")}>{item.title}</div>
                          <div className="text-xs">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimized */}
            <div className="flex-1 flex flex-col">
              <div className={cn("p-4 font-bold text-xs uppercase tracking-widest", darkMode ? "bg-indigo-900/30 text-indigo-400 border-b border-indigo-900/50" : "bg-indigo-50 text-indigo-600 border-b border-indigo-100")}>
                Optimized Content
              </div>
              <div className={cn("flex-1 overflow-y-auto p-8 space-y-6", darkMode ? "bg-gray-800" : "bg-white")}>
                {comparisonData.optimized.map((el) => (
                  <div key={el.id} className={cn("p-4 border rounded-xl", darkMode ? "border-indigo-500/30 bg-indigo-500/5" : "border-indigo-100 bg-indigo-50/30")}>
                    <h4 className={cn("text-[10px] font-bold uppercase mb-2", darkMode ? "text-indigo-500" : "text-indigo-400")}>{el.type}</h4>
                    <div className={cn("text-sm", darkMode ? "text-gray-200" : "text-gray-800")}>
                      {el.type === 'text' && el.content.text}
                      {el.type === 'experience' && el.content.items?.map((item: any, i: number) => (
                        <div key={i} className="mb-2">
                          <div className={cn("font-bold", darkMode ? "text-indigo-400" : "text-indigo-700")}>{item.role} @ {item.company}</div>
                          <div className="text-xs">{item.description}</div>
                        </div>
                      ))}
                      {el.type === 'skills' && el.content.items?.join(', ')}
                      {el.type === 'projects' && el.content.items?.map((item: any, i: number) => (
                        <div key={i} className="mb-2">
                          <div className={cn("font-bold", darkMode ? "text-indigo-400" : "text-indigo-700")}>{item.title}</div>
                          <div className="text-xs">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("p-6 border-t flex items-center justify-end gap-3", darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100")}>
            <button 
              onClick={handleReject}
              className={cn("px-6 py-2.5 text-sm font-bold rounded-xl transition-all", darkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-200")}
            >
              Discard Changes
            </button>
            <button 
              onClick={handleAccept}
              className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <Check size={18} />
              Apply All Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
