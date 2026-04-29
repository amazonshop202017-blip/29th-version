import { DollarSign, Percent, Eye, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalFilters, DisplayMode } from '@/contexts/GlobalFiltersContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface DisplayOption {
  value: DisplayMode;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const DISPLAY_OPTIONS: DisplayOption[] = [
  { 
    value: 'dollar', 
    label: 'Dollar', 
    icon: <DollarSign className="w-4 h-4" />
  },
  { 
    value: 'percentage', 
    label: 'Percentage', 
    icon: <Percent className="w-4 h-4" />
  },
  { 
    value: 'privacy', 
    label: 'Privacy', 
    icon: <Eye className="w-4 h-4" />
  },
  { 
    value: 'tickpip', 
    label: 'Tick / Pip', 
    icon: <span className="w-4 h-4 flex items-center justify-center text-xs font-semibold">T</span>,
    description: 'Edit in settings'
  },
];

export const DisplayModeSelector = () => {
  const navigate = useNavigate();
  const { displayMode, setDisplayMode } = useGlobalFilters();
  const [open, setOpen] = useState(false);

  const selectedOption = DISPLAY_OPTIONS.find(opt => opt.value === displayMode) || DISPLAY_OPTIONS[0];

  const handleSelect = (option: DisplayOption) => {
    setDisplayMode(option.value);
    setOpen(false);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    navigate('/settings');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 px-3 rounded-md flex items-center gap-1.5 group",
            "border border-border bg-background hover:bg-accent transition-colors",
            "text-sm text-muted-foreground hover:text-accent-foreground"
          )}
        >
          {selectedOption.icon}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-56 p-2 bg-popover border-border z-50"
      >
        <div className="space-y-1">
          {DISPLAY_OPTIONS.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option)}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors",
                displayMode === option.value 
                  ? "bg-accent" 
                  : "hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              {/* Icon Circle */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                "bg-primary/10 text-primary"
              )}>
                {option.icon}
              </div>
              
              {/* Label & Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{option.label}</span>
                  {displayMode === option.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                {option.description && (
                  <button
                    onClick={handleSettingsClick}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {option.description}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};