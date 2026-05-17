import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { ReactNode } from 'react';

interface DraggableChartWrapperProps {
  id: string;
  children: ReactNode;
  isEditMode: boolean;
  colSpan?: number;
  rowSpan?: number;
  onRemove?: (id: string) => void;
}

export const DraggableChartWrapper = ({ 
  id, 
  children, 
  isEditMode,
  colSpan = 1,
  rowSpan = 1,
  onRemove
}: DraggableChartWrapperProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colSpanClass = colSpan === 2 ? 'md:col-span-2 lg:col-span-2' : 'col-span-1';
  const rowSpanClass = rowSpan === 2 ? 'md:row-span-2 lg:row-span-2' : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colSpanClass} ${rowSpanClass} relative ${
        isDragging ? 'z-50 opacity-90' : ''
      } ${isEditMode ? 'ring-2 ring-primary/20 ring-dashed rounded-xl' : ''}`}
    >
      {isEditMode && (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute -top-2 -left-2 z-10 p-1.5 bg-primary text-primary-foreground rounded-md cursor-grab active:cursor-grabbing touch-none shadow-lg hover:bg-primary/90 transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <button
            onClick={() => onRemove?.(id)}
            className="absolute -top-2 -right-2 z-10 p-1.5 bg-destructive text-destructive-foreground rounded-md shadow-lg hover:bg-destructive/90 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
      {children}
    </div>
  );
};
