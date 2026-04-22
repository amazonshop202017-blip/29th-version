import { useState } from 'react';
import { CircleUser, Settings, LogOut, Sun, Moon, Palette } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { InterfaceThemePopup } from './InterfaceThemePopup';

export const SidebarAccountMenu = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';
  const [showThemePopup, setShowThemePopup] = useState(false);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || user?.email?.split('@')[0] || 'Account';
  const initial = (user?.firstName?.[0] || displayName[0] || 'U').toUpperCase();
  const avatarUrl = user?.avatarDataUrl || null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 rounded-lg transition-all duration-200 hover:bg-sidebar-accent",
                isCollapsed ? "justify-center p-2" : "px-3 py-2.5"
              )}
            >
              <div className={cn(
                "rounded-full bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden",
                isCollapsed ? "w-8 h-8" : "w-9 h-9"
              )}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary-foreground uppercase">
                    {initial}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-medium overflow-hidden whitespace-nowrap text-sm truncate text-sidebar-foreground"
                  >
                    {displayName}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right">
            <p>{user?.email || 'Account'}</p>
          </TooltipContent>
        )}
      </Tooltip>

      <PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-0 dark:bg-[#0d0d0d]">
        {showThemePopup ? (
          <InterfaceThemePopup onClose={() => setShowThemePopup(false)} />
        ) : (
          <div className="w-40 p-2">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between px-2 py-2 rounded-lg">
              <span className={cn("text-xs font-medium transition-colors", !isDark ? "text-foreground" : "text-muted-foreground")}>Light</span>
              <button
                onClick={toggleTheme}
                className={cn(
                  "relative inline-flex h-7 w-[52px] items-center rounded-full mx-1.5 border overflow-hidden transition-colors duration-500",
                  isDark
                    ? "bg-[hsl(222_47%_18%)] border-[hsl(215_20%_30%)]"
                    : "bg-primary border-primary"
                )}
              >
                <span className={cn(
                  "absolute z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-md transition-all duration-500 ease-in-out",
                  isDark ? "translate-x-[27px] bg-[hsl(215_20%_30%)]" : "translate-x-[3px] bg-background"
                )}>
                  <Sun className={cn("absolute w-3.5 h-3.5 text-yellow-500 transition-all duration-500", isDark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100")} />
                  <Moon className={cn("absolute w-3.5 h-3.5 text-white transition-all duration-500", isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0")} />
                </span>
              </button>
              <span className={cn("text-xs font-medium transition-colors", isDark ? "text-foreground" : "text-muted-foreground")}>Dark</span>
            </div>

            <button
              onClick={() => setShowThemePopup(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Palette className="w-4 h-4" /> Customization
            </button>

            <Separator className="my-1" />

            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <Settings className="w-4 h-4" /> Settings
            </button>

            <button
              onClick={() => navigate('/account')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                location.pathname === '/account' ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <CircleUser className="w-4 h-4" /> Account
            </button>

            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
