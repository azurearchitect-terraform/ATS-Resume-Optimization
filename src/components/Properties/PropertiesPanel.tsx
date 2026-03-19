import React from 'react';
import { useResumeStore } from '../../store/useResumeStore';
import { 
  Type, 
  AlignCenter, 
  AlignLeft, 
  AlignRight, 
  AlignJustify, 
  Bold, 
  Italic, 
  Underline,
  Palette,
  Layout,
  Maximize2,
  Minimize2,
  CornerUpLeft,
  CornerUpRight,
  Settings2
} from 'lucide-react';
import { cn } from '../../lib/utils';

const FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Playfair Display',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Poppins',
  'Lora',
  'Merriweather',
  'Space Grotesk'
];

export const PropertiesPanel = () => {
  const { selectedElementId, elements, updateElementStyle, undo, redo, historyIndex, history, darkMode } = useResumeStore();
  
  const selectedElement = elements.find(el => el.id === selectedElementId);

  if (!selectedElement) {
    return (
      <aside className={cn(
        "w-72 h-full border-l flex flex-col items-center justify-center p-8 text-center transition-colors",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mb-4",
          darkMode ? "bg-gray-700" : "bg-gray-50"
        )}>
          <Settings2 className={darkMode ? "text-gray-500" : "text-gray-300"} size={32} />
        </div>
        <h3 className={cn("text-sm font-bold mb-2", darkMode ? "text-gray-200" : "text-gray-800")}>No Selection</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Select an element on the canvas to edit its properties and styling.
        </p>
      </aside>
    );
  }

  const style = selectedElement.style;

  const handleStyleChange = (updates: any) => {
    if (selectedElementId) {
      updateElementStyle(selectedElementId, updates);
    }
  };

  return (
    <aside className={cn(
      "w-72 h-full border-l flex flex-col overflow-hidden transition-colors",
      darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
    )}>
      <div className={cn(
        "p-4 border-b flex items-center justify-between",
        darkMode ? "border-gray-700" : "border-gray-100"
      )}>
        <h2 className={cn("text-lg font-bold flex items-center gap-2", darkMode ? "text-gray-100" : "text-gray-800")}>
          <Settings2 className="text-indigo-600" size={20} />
          Properties
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={undo}
            disabled={historyIndex === 0}
            className={cn(
              "p-1.5 rounded-lg disabled:opacity-30 transition-colors",
              darkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"
            )}
          >
            <CornerUpLeft size={16} />
          </button>
          <button 
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className={cn(
              "p-1.5 rounded-lg disabled:opacity-30 transition-colors",
              darkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"
            )}
          >
            <CornerUpRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Typography */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Type size={14} />
            Typography
          </h3>
          <div className="space-y-4">
            <div>
              <label className={cn("text-[10px] font-bold uppercase mb-1 block", darkMode ? "text-gray-400" : "text-gray-500")}>Font Family</label>
              <select 
                value={style.fontFamily}
                onChange={(e) => handleStyleChange({ fontFamily: e.target.value })}
                className={cn(
                  "w-full text-sm border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors",
                  darkMode ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-900"
                )}
              >
                {FONT_FAMILIES.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className={cn("text-[10px] font-bold uppercase mb-1 block", darkMode ? "text-gray-400" : "text-gray-500")}>Size</label>
                <input 
                  type="number"
                  value={style.fontSize}
                  onChange={(e) => handleStyleChange({ fontSize: parseInt(e.target.value) })}
                  className={cn(
                    "w-full text-sm border rounded-lg p-2 outline-none transition-colors",
                    darkMode ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-900"
                  )}
                />
              </div>
              <div className="flex-1">
                <label className={cn("text-[10px] font-bold uppercase mb-1 block", darkMode ? "text-gray-400" : "text-gray-500")}>Weight</label>
                <select 
                  value={style.fontWeight}
                  onChange={(e) => handleStyleChange({ fontWeight: e.target.value })}
                  className={cn(
                    "w-full text-sm border rounded-lg p-2 outline-none transition-colors",
                    darkMode ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-900"
                  )}
                >
                  <option value="normal">Regular</option>
                  <option value="medium">Medium</option>
                  <option value="semibold">Semibold</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>

            <div className={cn("flex items-center gap-1 p-1 rounded-xl transition-colors", darkMode ? "bg-gray-900" : "bg-gray-50")}>
              <button 
                onClick={() => handleStyleChange({ textAlign: 'left' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.textAlign === 'left' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <AlignLeft size={16} className="mx-auto" />
              </button>
              <button 
                onClick={() => handleStyleChange({ textAlign: 'center' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.textAlign === 'center' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <AlignCenter size={16} className="mx-auto" />
              </button>
              <button 
                onClick={() => handleStyleChange({ textAlign: 'right' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.textAlign === 'right' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <AlignRight size={16} className="mx-auto" />
              </button>
              <button 
                onClick={() => handleStyleChange({ textAlign: 'justify' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.textAlign === 'justify' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <AlignJustify size={16} className="mx-auto" />
              </button>
            </div>

            <div className={cn("flex items-center gap-1 p-1 rounded-xl transition-colors", darkMode ? "bg-gray-900" : "bg-gray-50")}>
              <button 
                onClick={() => handleStyleChange({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.fontWeight === 'bold' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <Bold size={16} className="mx-auto" />
              </button>
              <button 
                onClick={() => handleStyleChange({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.fontStyle === 'italic' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <Italic size={16} className="mx-auto" />
              </button>
              <button 
                onClick={() => handleStyleChange({ textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })}
                className={cn(
                  "flex-1 p-2 rounded-lg transition-all", 
                  style.textDecoration === 'underline' 
                    ? (darkMode ? "bg-gray-700 shadow-sm text-indigo-400" : "bg-white shadow-sm text-indigo-600") 
                    : (darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                )}
              >
                <Underline size={16} className="mx-auto" />
              </button>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Palette size={14} />
            Colors
          </h3>
          <div className="space-y-4">
            <div>
              <label className={cn("text-[10px] font-bold uppercase mb-1 block", darkMode ? "text-gray-400" : "text-gray-500")}>Text Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={style.color}
                  onChange={(e) => handleStyleChange({ color: e.target.value })}
                  className="w-10 h-10 rounded-lg border-none p-0 cursor-pointer overflow-hidden"
                />
                <input 
                  type="text" 
                  value={style.color}
                  onChange={(e) => handleStyleChange({ color: e.target.value })}
                  className={cn(
                    "flex-1 text-sm border rounded-lg p-2 outline-none uppercase transition-colors",
                    darkMode ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-900"
                  )}
                />
              </div>
            </div>
            <div>
              <label className={cn("text-[10px] font-bold uppercase mb-1 block", darkMode ? "text-gray-400" : "text-gray-500")}>Background</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={style.backgroundColor === 'transparent' ? '#ffffff' : style.backgroundColor}
                  onChange={(e) => handleStyleChange({ backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border-none p-0 cursor-pointer overflow-hidden"
                />
                <button 
                  onClick={() => handleStyleChange({ backgroundColor: 'transparent' })}
                  className={cn("text-[10px] font-bold transition-colors", darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Layout */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layout size={14} />
            Spacing & Layout
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label className={cn("text-[10px] font-bold uppercase block", darkMode ? "text-gray-400" : "text-gray-500")}>Padding</label>
                <span className="text-[10px] font-bold text-indigo-600">{style.padding}px</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="64" 
                value={style.padding}
                onChange={(e) => handleStyleChange({ padding: parseInt(e.target.value) })}
                className={cn("w-full accent-indigo-600", darkMode ? "opacity-80" : "")}
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className={cn("text-[10px] font-bold uppercase block", darkMode ? "text-gray-400" : "text-gray-500")}>Margin</label>
                <span className="text-[10px] font-bold text-indigo-600">{style.margin}px</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="64" 
                value={style.margin}
                onChange={(e) => handleStyleChange({ margin: parseInt(e.target.value) })}
                className={cn("w-full accent-indigo-600", darkMode ? "opacity-80" : "")}
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className={cn("text-[10px] font-bold uppercase block", darkMode ? "text-gray-400" : "text-gray-500")}>Line Height</label>
                <span className="text-[10px] font-bold text-indigo-600">{style.lineHeight}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1"
                value={style.lineHeight}
                onChange={(e) => handleStyleChange({ lineHeight: parseFloat(e.target.value) })}
                className={cn("w-full accent-indigo-600", darkMode ? "opacity-80" : "")}
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className={cn("text-[10px] font-bold uppercase block", darkMode ? "text-gray-400" : "text-gray-500")}>Letter Spacing</label>
                <span className="text-[10px] font-bold text-indigo-600">{style.letterSpacing}px</span>
              </div>
              <input 
                type="range" 
                min="-2" 
                max="10" 
                step="0.5"
                value={style.letterSpacing}
                onChange={(e) => handleStyleChange({ letterSpacing: parseFloat(e.target.value) })}
                className={cn("w-full accent-indigo-600", darkMode ? "opacity-80" : "")}
              />
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
