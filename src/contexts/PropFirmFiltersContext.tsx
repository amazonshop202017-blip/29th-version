import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';

export type PropFirmFilterStatus = 'active' | 'breached' | 'funded';
export type PropFirmFilterPhase = 'evaluation' | 'funded';
export type PropFirmFilterStep = 0 | 1 | 2;

export interface PropFirmFilters {
  firms: string[];
  phases: PropFirmFilterPhase[];
  statuses: PropFirmFilterStatus[];
  sizes: number[];
  steps: PropFirmFilterStep[];
  strategies: string[];
}

export const EMPTY_PROPFIRM_FILTERS: PropFirmFilters = {
  firms: [],
  phases: [],
  statuses: [],
  sizes: [],
  steps: [],
  strategies: [],
};

interface Ctx {
  applied: PropFirmFilters;
  setApplied: (f: PropFirmFilters) => void;
  resetApplied: () => void;
  activeCount: number;
}

const PropFirmFiltersContext = createContext<Ctx | undefined>(undefined);

export function PropFirmFiltersProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<PropFirmFilters>(EMPTY_PROPFIRM_FILTERS);
  const resetApplied = useCallback(() => setApplied(EMPTY_PROPFIRM_FILTERS), []);
  const activeCount = useMemo(
    () =>
      applied.firms.length +
      applied.phases.length +
      applied.statuses.length +
      applied.sizes.length +
      applied.steps.length +
      applied.strategies.length,
    [applied],
  );
  const value = useMemo(() => ({ applied, setApplied, resetApplied, activeCount }), [applied, resetApplied, activeCount]);
  return <PropFirmFiltersContext.Provider value={value}>{children}</PropFirmFiltersContext.Provider>;
}

export function usePropFirmFilters(): Ctx {
  const ctx = useContext(PropFirmFiltersContext);
  if (!ctx) throw new Error('usePropFirmFilters must be used within PropFirmFiltersProvider');
  return ctx;
}

export function countPropFirmFilters(f: PropFirmFilters): number {
  return f.firms.length + f.phases.length + f.statuses.length + f.sizes.length + f.steps.length + f.strategies.length;
}
