import React, { useState, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, Palette, RotateCcw, Undo2, Redo2,
  ChevronDown, Search, CaseUpper, CaseLower, CaseSensitive
} from 'lucide-react';
import { useFormatting, SectionStyle, TextAlign, TextTransform, DEFAULT_STYLE } from '../context/FormattingContext';

const FONT_FAMILIES = [
  'Arial', 'Calibri', 'Times New Roman', 'Roboto', 'Inter', 'Georgia', 
  'Verdana', 'Helvetica', 'Courier New', 'Montserrat', 'Open Sans'
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

interface ToolbarProps {
  isDarkMode: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ isDarkMode }) => {
  const { state, dispatch } = useFormatting();
  const { activeSection, styles } = state;
  const currentStyle = activeSection ? (styles[activeSection] || DEFAULT_STYLE) : null;

  const [fontSearch, setFontSearch] = useState('');
  const [showFonts, setShowFonts] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(['#000000', '#3B82F6', '#EF4444', '#10B981']);

  const updateStyle = (updates: Partial<SectionStyle>) => {
    if (activeSection) {
      dispatch({ type: 'UPDATE_STYLE', sectionId: activeSection, updates });
    }
  };

  const handleColorChange = (color: string) => {
    updateStyle({ color });
    if (!recentColors.includes(color)) {
      setRecentColors(prev => [color, ...prev.slice(0, 7)]);
    }
  };

  if (!currentStyle) return null;

  return (
    <div className={`flex flex-col gap-3 p-3 border rounded-xl shadow-sm transition-colors ${
      isDarkMode ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-black/5'
    }`}>
      {/* Row 1: Font & Size */}
      <div className="flex items-center gap-2">
        {/* Font Family */}
        <div className="relative flex-1">
          <button 
            onClick={() => setShowFonts(!showFonts)}
            className={`flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-black/5 hover:bg-black/10 text-black'
            }`}
          >
            <span className="truncate">{currentStyle.fontFamily}</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          
          {showFonts && (
            <div className={`absolute top-full left-0 mt-1 w-48 border rounded-xl shadow-xl z-50 p-2 ${
              isDarkMode ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-black/10'
            }`}>
              <div className="relative mb-2">
                <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                <input 
                  type="text" 
                  placeholder="Search fonts..."
                  className={`w-full pl-7 pr-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-white border-black/10 text-black'
                  }`}
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                />
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {FONT_FAMILIES.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(font => (
                  <button
                    key={font}
                    onClick={() => {
                      updateStyle({ fontFamily: font });
                      setShowFonts(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors ${
                      currentStyle.fontFamily === font 
                        ? 'text-emerald-600 font-bold bg-emerald-500/10' 
                        : isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-emerald-50 text-black'
                    }`}
                    style={{ fontFamily: font }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-1">
          <input 
            type="number" 
            className={`w-12 px-2 py-1.5 text-xs font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isDarkMode ? 'bg-white/5 text-white' : 'bg-black/5 text-black'
            }`}
            value={currentStyle.fontSize}
            onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) || 8 })}
            min={8} max={72}
          />
          <span className="text-[10px] opacity-40 font-bold">PT</span>
        </div>
      </div>

      {/* Row 2: Styles & Alignment */}
      <div className="flex items-center justify-between gap-2">
        {/* Style Group */}
        <div className={`flex items-center p-0.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
          <button 
            onClick={() => updateStyle({ fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
            className={`p-1.5 rounded-md transition-colors ${
              currentStyle.fontWeight === 'bold' 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-white text-black'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => updateStyle({ fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
            className={`p-1.5 rounded-md transition-colors ${
              currentStyle.fontStyle === 'italic' 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-white text-black'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => updateStyle({ textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline' })}
            className={`p-1.5 rounded-md transition-colors ${
              currentStyle.textDecoration === 'underline' 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-white text-black'
            }`}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alignment Group */}
        <div className={`flex items-center p-0.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
          {(['left', 'center', 'right'] as TextAlign[]).map(align => (
            <button 
              key={align}
              onClick={() => updateStyle({ textAlign: align })}
              className={`p-1.5 rounded-md transition-colors ${
                currentStyle.textAlign === align 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-white text-black'
              }`}
            >
              {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
              {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
              {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Spacing & Color */}
      <div className="flex items-center justify-between gap-4">
        {/* Line Height */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] font-bold opacity-40 uppercase">Line</span>
          <select 
            className={`flex-1 text-[10px] rounded-lg px-2 py-1.5 focus:outline-none ${
              isDarkMode ? 'bg-white/5 text-white' : 'bg-black/5 text-black'
            }`}
            value={currentStyle.lineHeight}
            onChange={(e) => updateStyle({ lineHeight: parseFloat(e.target.value) })}
          >
            {[1.0, 1.15, 1.2, 1.4, 1.5, 2.0].map(v => <option key={v} value={v} className={isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white'}>{v}</option>)}
          </select>
        </div>

        {/* Color */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold opacity-40 uppercase">Color</span>
          <div className="relative group">
            <input 
              type="color" 
              className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden"
              value={currentStyle.color}
              onChange={(e) => handleColorChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Row 4: History & Reset */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => dispatch({ type: 'UNDO' })} 
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-black/5 text-black'}`} 
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => dispatch({ type: 'REDO' })} 
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-black/5 text-black'}`} 
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button 
          onClick={() => dispatch({ type: 'RESET', sectionId: activeSection })}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
            isDarkMode ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'
          }`}
        >
          <RotateCcw className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Reset</span>
        </button>
      </div>
    </div>
  );
};
