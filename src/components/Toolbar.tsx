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

export const Toolbar: React.FC = () => {
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
    <div className="flex flex-wrap items-center gap-1 p-2 bg-white border border-black/5 rounded-xl shadow-sm mb-4 sticky top-0 z-50">
      {/* History Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1">
        <button onClick={() => dispatch({ type: 'UNDO' })} className="p-1.5 hover:bg-black/5 rounded-lg transition-colors" title="Undo">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={() => dispatch({ type: 'REDO' })} className="p-1.5 hover:bg-black/5 rounded-lg transition-colors" title="Redo">
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Font Family Group */}
      <div className="relative flex items-center border-r border-black/5 pr-2 mr-1">
        <div className="relative">
          <button 
            onClick={() => setShowFonts(!showFonts)}
            className="flex items-center justify-between w-32 px-2 py-1.5 text-xs font-medium bg-black/5 hover:bg-black/10 rounded-lg transition-colors"
          >
            <span className="truncate">{currentStyle.fontFamily}</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          
          {showFonts && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-black/10 rounded-xl shadow-xl z-50 p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-black/40" />
                <input 
                  type="text" 
                  placeholder="Search fonts..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className={`w-full text-left px-2 py-1.5 text-xs hover:bg-emerald-50 rounded-lg transition-colors ${currentStyle.fontFamily === font ? 'text-emerald-600 font-bold bg-emerald-50' : ''}`}
                    style={{ fontFamily: font }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Font Size Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1">
        <input 
          type="number" 
          className="w-12 px-2 py-1.5 text-xs font-medium bg-black/5 hover:bg-black/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          value={currentStyle.fontSize}
          onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) || 8 })}
          min={8} max={72}
        />
      </div>

      {/* Style Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1 gap-0.5">
        <button 
          onClick={() => updateStyle({ fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`p-1.5 rounded-lg transition-colors ${currentStyle.fontWeight === 'bold' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button 
          onClick={() => updateStyle({ fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`p-1.5 rounded-lg transition-colors ${currentStyle.fontStyle === 'italic' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button 
          onClick={() => updateStyle({ textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline' })}
          className={`p-1.5 rounded-lg transition-colors ${currentStyle.textDecoration === 'underline' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
        >
          <Underline className="w-4 h-4" />
        </button>
        <button 
          onClick={() => updateStyle({ textDecoration: currentStyle.textDecoration === 'line-through' ? 'none' : 'line-through' })}
          className={`p-1.5 rounded-lg transition-colors ${currentStyle.textDecoration === 'line-through' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      {/* Color Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1 gap-2">
        <div className="relative group">
          <input 
            type="color" 
            className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden"
            value={currentStyle.color}
            onChange={(e) => handleColorChange(e.target.value)}
          />
          <div className="absolute top-full left-0 mt-2 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border border-black/10 rounded-xl shadow-xl w-24">
            {recentColors.map(c => (
              <button 
                key={c} 
                onClick={() => updateStyle({ color: c })}
                className="w-4 h-4 rounded-full border border-black/5"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Alignment Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1 gap-0.5">
        {(['left', 'center', 'right', 'justify'] as TextAlign[]).map(align => (
          <button 
            key={align}
            onClick={() => updateStyle({ textAlign: align })}
            className={`p-1.5 rounded-lg transition-colors ${currentStyle.textAlign === align ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
          >
            {align === 'left' && <AlignLeft className="w-4 h-4" />}
            {align === 'center' && <AlignCenter className="w-4 h-4" />}
            {align === 'right' && <AlignRight className="w-4 h-4" />}
            {align === 'justify' && <AlignJustify className="w-4 h-4" />}
          </button>
        ))}
      </div>

      {/* Spacing Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1 gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold opacity-40">LH</span>
          <select 
            className="text-xs bg-black/5 rounded px-1 py-1 focus:outline-none"
            value={currentStyle.lineHeight}
            onChange={(e) => updateStyle({ lineHeight: parseFloat(e.target.value) })}
          >
            {[1.0, 1.15, 1.5, 2.0].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold opacity-40">LS</span>
          <input 
            type="range" min="-2" max="10" step="0.5"
            className="w-16 accent-emerald-500"
            value={currentStyle.letterSpacing}
            onChange={(e) => updateStyle({ letterSpacing: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      {/* Transform Group */}
      <div className="flex items-center border-r border-black/5 pr-2 mr-1 gap-0.5">
        {(['none', 'uppercase', 'lowercase', 'capitalize'] as TextTransform[]).map(t => (
          <button 
            key={t}
            onClick={() => updateStyle({ textTransform: t })}
            className={`p-1.5 rounded-lg transition-colors ${currentStyle.textTransform === t ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-black/5'}`}
            title={t}
          >
            {t === 'none' && <CaseSensitive className="w-4 h-4" />}
            {t === 'uppercase' && <CaseUpper className="w-4 h-4" />}
            {t === 'lowercase' && <CaseLower className="w-4 h-4" />}
            {t === 'capitalize' && <span className="text-xs font-bold">Aa</span>}
          </button>
        ))}
      </div>

      {/* Reset Button */}
      <button 
        onClick={() => dispatch({ type: 'RESET', sectionId: activeSection })}
        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors ml-auto"
        title="Reset Formatting"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};
