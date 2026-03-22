import React, { useState, useRef } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import { Canvas } from '../Canvas/Canvas';
import { PropertiesPanel } from '../Properties/PropertiesPanel';
import { Download, Share2, Save, Sparkles, ChevronLeft, Loader2, Moon, Sun } from 'lucide-react';
import { useResumeStore } from '../../store/useResumeStore';
import { ComparisonModal } from '../ComparisonModal';
import { cn } from '../../lib/utils';

export const ResumeEditor = () => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { darkMode, toggleDarkMode, showGrid, setShowGrid, setIsExporting } = useResumeStore();
  const stageRef = useRef<any>(null);

  const handlePreview = () => {
    if (stageRef.current) {
      setIsPreviewOpen(true);
    } else {
      alert("Canvas not ready");
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300",
      darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
    )}>
      <ComparisonModal />
      
      {/* Header / Top Toolbar */}
      <header className={cn(
        "h-16 border-b flex items-center justify-between px-6 z-40 transition-colors",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-4">
          <button className={cn(
            "p-2 rounded-xl transition-colors",
            darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          )}>
            <ChevronLeft size={20} />
          </button>
          <div className={cn("h-6 w-px", darkMode ? "bg-gray-700" : "bg-gray-200")} />
          <div>
            <h1 className="text-sm font-bold">My Professional Resume</h1>
            <p className="text-[10px] text-gray-500 font-medium">Last edited 2 mins ago</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleDarkMode}
            className={cn(
              "p-2 rounded-xl transition-all",
              darkMode ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className={cn("h-6 w-px mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
          
          <button className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
            darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
          )}>
            <Save size={16} />
            Save Draft
          </button>
          <button className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
            darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
          )}>
            <Share2 size={16} />
            Share
          </button>
          <button 
            onClick={handlePreview}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Download size={16} />
            Preview & Download
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <Canvas stageRef={stageRef} />
        <PropertiesPanel />
      </div>

      {/* Footer / Status Bar */}
      <footer className={cn(
        "h-8 border-t flex items-center justify-between px-4 z-40 transition-colors",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Cloud Synced
          </span>
          <span>A4 (210 x 297 mm)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
          <button className="hover:text-indigo-600 transition-colors">Help & Support</button>
          <button className="hover:text-indigo-600 transition-colors">Keyboard Shortcuts</button>
        </div>
      </footer>
    </div>
  );
};
