import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListOrdered, FileText, Target, Plus, ChevronLeft, ChevronRight, BarChart3, ChevronDown, Crosshair, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradeModal } from '@/contexts/TradeModalContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, BookOpen } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarAccountMenu } from './SidebarAccountMenu';

const dashboardItem = { icon: LayoutDashboard, label: 'Dashboard', path: '/' };

const tradingViewItems = [
  { icon: ListOrdered, label: 'Trades', path: '/trades' },
  { icon: Calendar, label: 'Day View', path: '/day-view' },
  { icon: BookOpen, label: 'Diary', path: '/diary' },
];

const analysisItems = [
  { icon: Target, label: 'Setups', path: '/strategies' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Crosshair, label: 'Exit Analyzer', path: '/exit-analyzer' },
];

const chartRoomItems = [
  { label: 'Drawdown', path: '/chart-room/drawdown' },
  { label: 'Consecutive Winners/Losers', path: '/chart-room/consecutive' },
  { label: 'Exit Analysis', path: '/chart-room/exit-analysis' },
  { label: 'Holding Time', path: '/chart-room/holding-time' },
  { label: 'Performance by Symbol', path: '/chart-room/performance-by-symbol' },
  { label: 'Performance by Setup', path: '/chart-room/performance-by-setup' },
  { label: 'Performance by Time', path: '/chart-room/performance-by-time' },
  { label: 'Tags/Comments Analysis', path: '/chart-room/tags-analytics' },
  { label: 'Risk Distribution', path: '/chart-room/risk-distribution' },
  { label: 'Trade Management', path: '/chart-room/trade-management' },
];

const NavItem = ({ icon: Icon, label, path, isCollapsed, isActive }: {
  icon: any; label: string; path: string; isCollapsed: boolean; isActive: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <NavLink to={path} className="block">
        <div
          className={cn(
            "relative flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-200",
            isCollapsed ? "justify-center" : "",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors",
              isActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
          >
            <Icon className="w-[15px] h-[15px]" />
          </span>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap text-sm"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </NavLink>
    </TooltipTrigger>
    {isCollapsed && (
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    )}
  </Tooltip>
);

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen = false, onMobileClose }: SidebarProps) => {
  const location = useLocation();
  const { openModal } = useTradeModal();
  const [chartRoomOpen, setChartRoomOpen] = useState(
    location.pathname.startsWith('/chart-room')
  );

  const isChartRoomActive = location.pathname.startsWith('/chart-room');

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bg-sidebar flex flex-col z-40 transition-all duration-300",
        isCollapsed ? "w-[70px]" : "w-[229px]",
        // Mobile: hidden by default, shown when isMobileOpen
        "max-md:-translate-x-full max-md:w-[229px]",
        isMobileOpen && "max-md:translate-x-0"
      )}
      style={{ height: '100dvh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Collapse/Expand toggle moved to GlobalHeader. Mobile-only spacer kept. */}

      {/* Logo — extra left padding on mobile to avoid overlap with burger/close button */}
      <div className="p-4 max-md:pl-14">
        <div className="flex flex-col items-center justify-center">
          <AnimatePresence>
            {!isCollapsed ? (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden flex flex-col items-center"
              >
                <span className="text-2xl tracking-tight whitespace-nowrap" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
                  <span className="font-normal text-foreground">Trade</span>
                  <span className="font-bold text-foreground">Valley</span>
                </span>
                <span className="text-[9px] tracking-widest uppercase text-muted-foreground mt-0.5 whitespace-nowrap" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
                  Look inward<span className="text-[13px] font-bold text-muted-foreground/70 mx-0.5">/</span>Trade forward
                </span>
              </motion.div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary-foreground" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>TV</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Trade Button */}
      <div className="px-3 pt-3 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              onClick={() => openModal()}
              className={cn(
                "w-full text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90",
                isCollapsed ? "h-10 px-0" : "h-11 px-4"
              )}
              style={{ backgroundColor: 'hsl(var(--primary-active))' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Add Trade
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <p>Add Trade</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-1">
        {/* Dashboard */}
        <NavItem
          icon={dashboardItem.icon}
          label={dashboardItem.label}
          path={dashboardItem.path}
          isCollapsed={isCollapsed}
          isActive={location.pathname === dashboardItem.path}
        />

        {/* Prop Firm */}
        <NavItem
          icon={Building2}
          label="Prop Firm"
          path="/prop-firm"
          isCollapsed={isCollapsed}
          isActive={location.pathname.startsWith('/prop-firm')}
        />

        {/* Separator after Dashboard */}
        <div className="py-2">
          <Separator className="bg-sidebar-border/50" />
        </div>

        {/* Trading Views */}
        {tradingViewItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isCollapsed={isCollapsed}
            isActive={location.pathname === item.path}
          />
        ))}

        {/* Separator */}
        <div className="py-2">
          <Separator className="bg-sidebar-border/50" />
        </div>

        {/* Analysis */}
        {analysisItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isCollapsed={isCollapsed}
            isActive={location.pathname === item.path || (item.path === '/reports' && location.pathname.startsWith('/reports'))}
          />
        ))}

        {/* Chart Room */}
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/chart-room/drawdown" className="block">
                <div
                  className={cn(
                    "relative flex items-center justify-center px-2 py-1.5 rounded-lg transition-all duration-200",
                    isChartRoomActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                      isChartRoomActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground"
                    )}
                  >
                    <BarChart3 className="w-[15px] h-[15px]" />
                  </span>
                </div>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Chart Room</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Collapsible open={chartRoomOpen} onOpenChange={setChartRoomOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "relative w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-200",
                  isChartRoomActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                    isChartRoomActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground"
                  )}
                >
                  <BarChart3 className="w-[15px] h-[15px]" />
                </span>
                <span className="flex-1 text-left text-sm">Chart Room</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    chartRoomOpen ? "rotate-180" : ""
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="relative ml-5 mt-1 pl-4">
                {/* Single continuous trunk — runs from top down to the last item's curve */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 w-px bg-[#bdbdbd] pointer-events-none"
                  style={{
                    height: `calc(100% - ${chartRoomItems.length > 0 ? "1.125rem" : "0px"})`,
                  }}
                />
                <div className="space-y-0.5">
                  {chartRoomItems.map((item) => {
                    const isSubActive = location.pathname === item.path;
                    return (
                      <NavLink key={item.path} to={item.path} className="block">
                        <div
                          className={cn(
                            "relative flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200",
                            isSubActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {/* Curved branch: rounds off the trunk into the horizontal connector */}
                          <svg
                            aria-hidden
                            width="16"
                            height="12"
                            viewBox="0 0 16 12"
                            fill="none"
                            className="absolute -left-4 top-1/2 -translate-y-[6px] text-[#bdbdbd] pointer-events-none"
                          >
                            <path
                              d="M 0.5 0 L 0.5 6 Q 0.5 11.5, 6 11.5 L 16 11.5"
                              stroke="currentColor"
                              strokeWidth="1"
                              fill="none"
                            />
                          </svg>
                          {item.label}
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Separator before Prop Firm */}
        <div className="py-2">
          <Separator className="bg-sidebar-border/50" />
        </div>

        {/* Prop Firm */}
        <NavItem
          icon={Building2}
          label="Prop Firm"
          path="/prop-firm"
          isCollapsed={isCollapsed}
          isActive={location.pathname.startsWith('/prop-firm')}
        />
      </nav>

      {/* Bottom Account */}
      <div className="px-3 pb-3 max-md:pb-8 mt-auto">
        <Separator className="bg-sidebar-border/50 mb-2" />
        <div className="relative rounded-xl overflow-hidden">
          {/* Liquid glass effect background */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent border border-primary/[0.12] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] dark:from-primary/[0.12] dark:via-white/[0.08] dark:to-primary/[0.06] dark:border-white/[0.1] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm pointer-events-none" />
          <div className="relative z-10">
            <SidebarAccountMenu isCollapsed={isCollapsed} />
          </div>
        </div>
      </div>
    </aside>
  );
};
