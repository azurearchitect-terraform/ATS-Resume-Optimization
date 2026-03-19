import React, { useRef, useState, useEffect } from 'react';
import { useResumeStore } from '../../store/useResumeStore';
import { cn } from '../../lib/utils';
import { ResumeElement } from '../../types/resume';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SectionRenderer } from './SectionRenderer';
import { ZoomIn, ZoomOut, Maximize, Grid3X3 } from 'lucide-react';

interface SortableSectionProps {
  element: ResumeElement;
  key?: string;
}

const SortableSection = ({ element }: SortableSectionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const { selectElement, selectedElementId, darkMode } = useResumeStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.3 : 1,
  };

  if (!element.isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group cursor-default transition-all duration-200",
        selectedElementId === element.id ? "ring-2 ring-indigo-500 ring-offset-2" : "hover:ring-1 hover:ring-gray-200"
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id);
      }}
    >
      {/* Drag handle overlay on hover */}
      <div 
        {...attributes} 
        {...listeners}
        className={cn(
          "absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 border rounded-lg shadow-sm opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-20",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}
      >
        <Grid3X3 size={14} className={darkMode ? "text-gray-500" : "text-gray-400"} />
      </div>

      <div 
        className="w-full"
        style={{
          fontFamily: element.style.fontFamily,
          fontSize: `${element.style.fontSize}px`,
          fontWeight: element.style.fontWeight,
          fontStyle: element.style.fontStyle,
          textDecoration: element.style.textDecoration,
          textAlign: element.style.textAlign,
          lineHeight: element.style.lineHeight,
          letterSpacing: `${element.style.letterSpacing}px`,
          color: element.style.color,
          backgroundColor: element.style.backgroundColor,
          padding: `${element.style.padding}px`,
          marginTop: `${element.style.margin}px`,
          marginBottom: `${element.style.margin}px`,
          borderRadius: `${element.style.borderRadius}px`,
        }}
      >
        <SectionRenderer element={element} />
      </div>
    </div>
  );
};

export const Canvas = () => {
  const { elements, reorderElements, zoom, setZoom, showGrid, toggleGrid, selectElement, darkMode } = useResumeStore();
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = elements.findIndex((el) => el.id === active.id);
      const newIndex = elements.findIndex((el) => el.id === over.id);
      reorderElements(arrayMove(elements, oldIndex, newIndex));
    }
  };

  return (
    <main className={cn(
      "flex-1 h-full overflow-auto relative flex flex-col items-center transition-colors duration-300",
      darkMode ? "bg-gray-950" : "bg-gray-100"
    )}>
      {/* Toolbar */}
      <div className={cn(
        "sticky top-4 z-30 flex items-center gap-2 p-2 border rounded-2xl shadow-xl mb-8 mt-4 transition-colors",
        darkMode ? "bg-gray-800/80 border-gray-700 backdrop-blur-md text-white" : "bg-white/80 border-gray-200 backdrop-blur-md text-gray-900"
      )}>
        <button 
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button 
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
        >
          <ZoomIn size={18} />
        </button>
        <div className={cn("w-px h-6 mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
        <button 
          onClick={() => setZoom(1)}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
        >
          <Maximize size={18} />
        </button>
        <button 
          onClick={toggleGrid}
          className={cn(
            "p-2 rounded-xl transition-colors",
            showGrid 
              ? (darkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600") 
              : (darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")
          )}
        >
          <Grid3X3 size={18} />
        </button>
      </div>

      {/* A4 Page Container */}
      <div 
        className="flex-1 w-full flex justify-center pb-20"
        onClick={() => selectElement(null)}
      >
        <div 
          id="resume-canvas"
          className={cn(
            "bg-white shadow-2xl origin-top transition-transform duration-200 relative",
            showGrid && (darkMode 
              ? "bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:20px_20px]" 
              : "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]")
          )}
          style={{
            width: '210mm',
            minHeight: '297mm',
            transform: `scale(${zoom})`,
            padding: '20mm',
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={elements.map(el => el.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {elements.map((element) => (
                  <SortableSection key={element.id} element={element} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </main>
  );
};
