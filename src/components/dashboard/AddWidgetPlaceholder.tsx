import { Plus } from 'lucide-react';

interface AddWidgetPlaceholderProps {
  onClick: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const AddWidgetPlaceholder = ({ onClick, size = 'md', className = '' }: AddWidgetPlaceholderProps) => {
  const minH = size === 'sm' ? 'min-h-[88px]' : 'min-h-[200px]';
  const iconBox = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const label = size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 ${minH} h-full w-full rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all cursor-pointer group ${className}`}
    >
      <div className={`${iconBox} rounded-full border-2 border-dashed border-muted-foreground/40 group-hover:border-primary/60 flex items-center justify-center transition-colors`}>
        <Plus className={`${iconSize} text-muted-foreground/60 group-hover:text-primary/80 transition-colors`} />
      </div>
      <span className={`${label} text-muted-foreground/60 group-hover:text-muted-foreground transition-colors`}>
        Click to add widget
      </span>
    </button>
  );
};
