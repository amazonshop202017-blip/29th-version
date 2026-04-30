import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, Wallet, Tag, Ruler, Target, DollarSign, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type SettingsTab = 'main' | 'accounts' | 'custom-tags' | 'symbol-tick' | 'tpsl' | 'fees';

export const settingsMenuItems: { icon: typeof Settings; label: string; tab: SettingsTab }[] = [
  { icon: Settings, label: 'Main', tab: 'main' },
  { icon: Wallet, label: 'Accounts', tab: 'accounts' },
  { icon: Tag, label: 'Custom Tags', tab: 'custom-tags' },
  { icon: Ruler, label: 'Symbol Tick / Pip', tab: 'symbol-tick' },
  { icon: Target, label: 'TP / SL Settings', tab: 'tpsl' },
  { icon: DollarSign, label: 'Fees Settings', tab: 'fees' },
];

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsSidebar = ({ activeTab, onTabChange }: SettingsSidebarProps) => {
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[229px] bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo Section */}
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

      {/* Back Button */}
      <div className="p-4">
        <motion.button
          onClick={() => navigate('/')}
          className="w-full h-11 text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: 'hsl(var(--primary-active))' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to App</span>
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</span>
        </div>

        {settingsMenuItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className="block w-full text-left"
            >
              <motion.div
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                whileHover={{ x: isActive ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </motion.div>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">Manage your settings</p>
      </div>
    </aside>
  );
};
