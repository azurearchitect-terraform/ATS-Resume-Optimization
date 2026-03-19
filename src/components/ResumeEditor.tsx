import React from 'react';
import { useFormatting } from '../context/FormattingContext';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}

const SortableSection: React.FC<SectionProps> = ({ id, title, children, isActive, onClick, style }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const combinedStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...style,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={combinedStyle}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group relative p-4 mb-2 rounded transition-all cursor-pointer ${
        isActive 
          ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30' 
          : 'hover:bg-black/5'
      }`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-black/5 rounded"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
        </svg>
      </div>
      {children}
    </div>
  );
};

interface ResumeEditorProps {
  data: any;
  isDarkMode: boolean;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({ data, isDarkMode }) => {
  const { state, dispatch } = useFormatting();
  const { activeSection, styles, sectionOrder: sections } = state;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.indexOf(active.id as string);
      const newIndex = sections.indexOf(over.id as string);
      const newOrder = arrayMove(sections, oldIndex, newIndex);
      dispatch({ type: 'SET_SECTION_ORDER', order: newOrder });
    }
  };

  const getSectionStyle = (id: string) => {
    const s = styles[id] || {};
    return {
      fontFamily: s.fontFamily,
      fontSize: `${s.fontSize}pt`,
      textAlign: s.textAlign as any,
      lineHeight: s.lineHeight,
      color: s.color,
      letterSpacing: `${s.letterSpacing}px`,
      textTransform: s.textTransform as any,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      textDecoration: s.textDecoration
    };
  };

  const renderSectionContent = (id: string) => {
    if (!data) return null;
    
    switch (id) {
      case 'header':
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold uppercase tracking-[0.1em] mb-1">
              {data.personal_info?.name || 'Your Name'}
            </h1>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 border-t border-b border-black py-1 mt-2">
              {(data.personal_info?.location || '').toUpperCase()} | {(data.personal_info?.email || '').toUpperCase()} | {data.personal_info?.phone || ''}
            </div>
          </div>
        );
      case 'summary':
        return (
          <>
            <h2 className="text-sm font-bold mb-2 uppercase tracking-widest flex items-center">
              <span className="bg-white pr-2">Professional Summary</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            <p className="text-sm">{data.summary}</p>
          </>
        );
      case 'skills':
        return (
          <>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-widest text-center flex items-center">
              <div className="flex-1 h-[1px] bg-black/20"></div>
              <span className="px-4">SKILLS</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(data.skills || []).map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </>
        );
      case 'experience':
        return (
          <>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-widest flex items-center">
              <span className="bg-white pr-2">Professional Experience</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            {(data.experience || []).map((exp: any, i: number) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm">{exp.role?.toUpperCase()}</span>
                  <span className="text-xs">{exp.duration}</span>
                </div>
                <div className="text-sm italic mb-1">{exp.company}</div>
                <div className="space-y-1">
                  {(exp.bullets || []).map((b: string, bi: number) => (
                    <div key={bi} className="flex items-start gap-2 text-xs">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-black shrink-0"></span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        );
      case 'education':
        return (
          <>
            <h2 className="text-sm font-bold mb-2 uppercase tracking-widest flex items-center">
              <span className="bg-white pr-2">Education</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-sm">{data.education?.degree}</span>
              <span className="text-xs">Expected {data.education?.expected_completion}</span>
            </div>
            <div className="text-sm opacity-80">{data.education?.institution}</div>
          </>
        );
      case 'certifications':
        return (
          <>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-widest flex items-center">
              <span className="bg-white pr-2">Certifications</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(data.certifications || []).map((cert: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1 h-1 rounded-full bg-black"></span>
                  <span>{cert}</span>
                </div>
              ))}
            </div>
          </>
        );
      case 'projects':
        return (
          <>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-widest flex items-center">
              <span className="bg-white pr-2">Key Projects</span>
              <div className="flex-1 h-[1px] bg-black/20"></div>
            </h2>
            {(data.projects || []).map((project: any, i: number) => (
              <div key={i} className="mb-3">
                <div className="font-bold text-sm">{project.title}</div>
                <div className="text-xs opacity-80">{project.description}</div>
              </div>
            ))}
          </>
        );
      default:
        return null;
    }
  };

  // Split sections into two pages: first 4 on page 1, rest on page 2
  const page1Sections = sections.slice(0, 4);
  const page2Sections = sections.slice(4);

  return (
    <div className="h-full w-full bg-[#F3F4F6] overflow-y-auto custom-scrollbar">
      <div className="flex flex-col items-center gap-12 py-12">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={sections}
            strategy={verticalListSortingStrategy}
          >
            {/* Page 1 */}
            <div className="relative group">
              <div className="absolute -left-16 top-0 h-full flex items-start pt-8">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-20 [writing-mode:vertical-lr] rotate-180">
                  Page One / A4
                </div>
              </div>
              <div 
                className="w-[210mm] min-h-[297mm] bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] p-[20mm] flex flex-col"
                style={{ boxSizing: 'border-box' }}
              >
                {page1Sections.map((id) => (
                  <SortableSection
                    key={id}
                    id={id}
                    title={id}
                    isActive={activeSection === id}
                    onClick={() => dispatch({ type: 'SET_ACTIVE_SECTION', sectionId: id })}
                    style={getSectionStyle(id)}
                  >
                    {renderSectionContent(id)}
                  </SortableSection>
                ))}
                
                {page1Sections.length === 0 && (
                  <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">
                    Drag sections here
                  </div>
                )}
              </div>
            </div>

            {/* Page 2 */}
            <div className="relative group">
              <div className="absolute -left-16 top-0 h-full flex items-start pt-8">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-20 [writing-mode:vertical-lr] rotate-180">
                  Page Two / A4
                </div>
              </div>
              <div 
                className="w-[210mm] min-h-[297mm] bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] p-[20mm] flex flex-col"
                style={{ boxSizing: 'border-box' }}
              >
                {page2Sections.map((id) => (
                  <SortableSection
                    key={id}
                    id={id}
                    title={id}
                    isActive={activeSection === id}
                    onClick={() => dispatch({ type: 'SET_ACTIVE_SECTION', sectionId: id })}
                    style={getSectionStyle(id)}
                  >
                    {renderSectionContent(id)}
                  </SortableSection>
                ))}

                {page2Sections.length === 0 && (
                  <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">
                    Drag content here to overflow to Page 2
                  </div>
                )}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
