import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { CSSProperties, ReactNode } from 'react';

interface DraggableChartWrapperProps {
  id: string;
  children: ReactNode;
  isEditMode: boolean;
  onRemove?: (id: string) => void;
  isActive?: boolean;
  /** Explicit grid placement style (gridColumn / gridRow) */
  placement?: CSSProperties;
}

export const DraggableChartWrapper = ({
  id,
  children,
  isEditMode,
  onRemove,
  isActive = false,
  placement,
}: DraggableChartWrapperProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    animateLayoutChanges: () => true,
    transition: { duration: 220, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...placement,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative min-w-0 ${
        isDragging || isActive ? 'opacity-30' : ''
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

