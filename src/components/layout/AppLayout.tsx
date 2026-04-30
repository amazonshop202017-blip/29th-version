import { type ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalHeader } from './GlobalHeader';
import { SelectedFiltersBar } from './SelectedFiltersBar';
import { cn } from '@/lib/utils';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarCollapseProvider } from '@/contexts/SidebarCollapseContext';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isToolsRoute = location.pathname.startsWith('/tools');

  return (
    <SidebarCollapseProvider value={{ isCollapsed, setIsCollapsed, toggle: () => setIsCollapsed(!isCollapsed) }}>
      <div className="h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile hamburger / close toggle */}
        <button
          className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-card border border-border shadow-sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5 text-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-foreground" />
          )}
        </button>

        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        <div className={cn(
          "h-screen transition-all duration-300 pl-1 md:pl-1 lg:pl-1 pr-3 md:pr-4 lg:pr-5 py-2 md:py-2.5 lg:py-3",
          "ml-0 md:ml-[70px] lg:ml-[229px]",
          !isCollapsed ? "lg:ml-[229px]" : "lg:ml-[70px]",
          isCollapsed ? "md:ml-[70px]" : "md:ml-[229px]"
        )}>
          <main className="relative h-full bg-[hsl(210_20%_96%)] dark:bg-[hsl(0_0%_5%)] rounded-2xl shadow-[0_2px_8px_0_hsl(0_0%_0%/0.07)] border border-border/40 flex flex-col overflow-hidden">
            <div className="flex-shrink-0">
              <GlobalHeader />
              <SelectedFiltersBar />
            </div>
            <div className={cn(
              "flex-1 overflow-y-auto",
              isToolsRoute ? "p-0" : "p-4 md:p-6 lg:p-8"
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarCollapseProvider>
  );
};
