import React from 'react';
import { useResumeStore } from '../store/useResumeStore';
import { X, Check, ArrowRight, Target, Sparkles, TrendingUp, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const ComparisonModal = () => {
  const { comparisonData, setComparisonData, applyOptimization, darkMode } = useResumeStore();

  if (!comparisonData || !comparisonData.isVisible) return null;

  const handleAccept = () => {
    applyOptimization(comparisonData.optimized);
    setComparisonData(null);
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

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Stats & Notes Sidebar */}
            <div className={cn("w-full md:w-80 border-r flex flex-col overflow-y-auto", darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100")}>
              <div className="p-6 space-y-8">
                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={cn("p-4 rounded-2xl text-center border", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Baseline</div>
                    <div className="text-2xl font-black text-gray-400">{comparisonData.scores?.baseline || 0}%</div>
                  </div>
                  <div className={cn("p-4 rounded-2xl text-center border", darkMode ? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-100")}>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Optimized</div>
                    <div className="text-2xl font-black text-indigo-600">{comparisonData.scores?.optimized || 0}%</div>
                  </div>
                </div>

                {/* Scores Table */}
                <div>
                  <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                    <TrendingUp size={14} className="text-indigo-500" />
                    Score Comparison
                  </h3>
                  <div className={cn("rounded-2xl border overflow-hidden", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className={cn("border-b", darkMode ? "bg-gray-950/50 border-gray-700" : "bg-gray-50 border-gray-100")}>
                          <th className="px-3 py-2 text-left font-bold text-gray-500">Metric</th>
                          <th className="px-2 py-2 text-center font-bold text-gray-500">Base</th>
                          <th className="px-2 py-2 text-center font-bold text-indigo-500">Opt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(comparisonData.scores?.criteria || []).map((c: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-gray-400">{c.name}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{c.baseline}%</td>
                            <td className="px-2 py-2 text-center font-bold text-indigo-500">{c.optimized}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audience Table */}
                <div>
                  <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                    <Users size={14} className="text-indigo-500" />
                    Audience Alignment
                  </h3>
                  <div className={cn("rounded-2xl border overflow-hidden", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className={cn("border-b", darkMode ? "bg-gray-950/50 border-gray-700" : "bg-gray-50 border-gray-100")}>
                          <th className="px-3 py-2 text-left font-bold text-gray-500">Criterion</th>
                          <th className="px-2 py-2 text-center font-bold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(comparisonData.audienceAlignment || []).map((a: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-gray-400">{a.criterion}</td>
                            <td className="px-2 py-2 text-center">
                              {a.status === 'met' ? <Check size={12} className="text-emerald-500 mx-auto" /> : 
                               a.status === 'partially_met' ? <div className="w-2 h-2 rounded-full bg-amber-500 mx-auto" /> :
                               <X size={12} className="text-rose-500 mx-auto" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Improvement Notes */}
                <div>
                  <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2", darkMode ? "text-gray-400" : "text-gray-500")}>
                    <Sparkles size={14} className="text-indigo-500" />
                    Key Improvements
                  </h3>
                  <ul className="space-y-2">
                    {(comparisonData.improvementNotes || []).map((note: string, i: number) => (
                      <li key={i} className="flex gap-2 text-[11px] leading-relaxed">
                        <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Original */}
              <div className={cn("flex-1 border-r flex flex-col", darkMode ? "border-gray-700" : "border-gray-100")}>
                <div className={cn("p-4 font-bold text-xs uppercase tracking-widest", darkMode ? "bg-gray-900 text-gray-500 border-b border-gray-700" : "bg-gray-50 text-gray-500 border-b border-gray-100")}>
                  Original Content
                </div>
                <div className={cn("flex-1 overflow-y-auto p-8 space-y-6", darkMode ? "bg-gray-800" : "bg-white")}>
                  {comparisonData.original.map((el: any) => (
                    <div key={el.id} className={cn("p-4 border rounded-xl opacity-60", darkMode ? "border-gray-700" : "border-gray-100")}>
                      <h4 className={cn("text-[10px] font-bold uppercase mb-2", darkMode ? "text-gray-500" : "text-gray-400")}>{el.type}</h4>
                      <div className={cn("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                        {el.content}
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
                  {comparisonData.optimized.map((el: any) => (
                    <div key={el.id} className={cn("p-4 border rounded-xl", darkMode ? "border-indigo-500/30 bg-indigo-500/5" : "border-indigo-100 bg-indigo-50/30")}>
                      <h4 className={cn("text-[10px] font-bold uppercase mb-2", darkMode ? "text-indigo-500" : "text-indigo-400")}>{el.type}</h4>
                      <div className={cn("text-sm", darkMode ? "text-gray-200" : "text-gray-800")}>
                        {el.content}
                      </div>
                    </div>
                  ))}
                </div>
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
