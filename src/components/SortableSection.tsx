import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableSectionProps {
  id: string;
  label: string;
  isDarkMode: boolean;
}

export function SortableSection({ id, label, isDarkMode }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 mb-2 rounded border ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/10'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:text-emerald-500">
        <GripVertical className="w-4 h-4 opacity-50" />
      </div>
      <span className="text-xs font-medium capitalize">{label}</span>
    </div>
  );
}
