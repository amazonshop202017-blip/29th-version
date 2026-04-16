import { ReactNode, useState } from 'react';
import { SettingsSidebar, SettingsTab, settingsMenuItems } from './SettingsSidebar';
import { useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SettingsLayoutProps {
  children: ReactNode;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsLayout = ({ children, activeTab, onTabChange }: SettingsLayoutProps) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = settingsMenuItems.find(i => i.tab === activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SettingsSidebar activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {/* Mobile/Tablet top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              {/* Logo */}
              <div className="p-4 border-b border-sidebar-border">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-2xl tracking-tight whitespace-nowrap" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
                    <span className="font-normal text-foreground">Trade</span>
                    <span className="font-bold text-foreground">Valley</span>
                  </span>
                  <span className="text-[9px] tracking-widest uppercase text-muted-foreground mt-0.5 whitespace-nowrap" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
                    Look inward<span className="text-[13px] font-bold text-muted-foreground/70 mx-0.5">/</span>Trade forward
                  </span>
                </div>
              </div>

              {/* Back button */}
              <div className="p-4">
                <motion.button
                  onClick={() => { setMobileOpen(false); navigate('/'); }}
                  className="w-full h-11 bg-muted text-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:bg-muted/80"
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to App</span>
                </motion.button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-3 space-y-1">
                <div className="px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</span>
                </div>
                {settingsMenuItems.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => { onTabChange(item.tab); setMobileOpen(false); }}
                      className="block w-full text-left"
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            {activeItem && <activeItem.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <span className="font-semibold text-sm truncate">{activeItem?.label || 'Settings'}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className={cn(
        "min-h-screen flex flex-col",
        "ml-0 lg:ml-[229px]"
      )}>
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};
