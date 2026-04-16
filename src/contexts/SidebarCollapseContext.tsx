import { createContext, useContext, type ReactNode } from 'react';

interface SidebarCollapseContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | undefined>(undefined);

export const SidebarCollapseProvider = ({
  value,
  children,
}: {
  value: SidebarCollapseContextValue;
  children: ReactNode;
}) => (
  <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>
);

export const useSidebarCollapse = () => {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    return { isCollapsed: false, setIsCollapsed: () => {}, toggle: () => {} };
  }
  return ctx;
};
