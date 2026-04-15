import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface InterfaceTheme {
  positive: string;
  negative: string;
  neutral: string;
  mode: 'flat' | 'gradient';
}

const DEFAULT_THEME: InterfaceTheme = {
  positive: '#00c2ab',
  negative: '#d10046',
  neutral: '#4a4a4a',
  mode: 'flat',
};

const BASE_STORAGE_KEY = 'interface-theme';

const getCurrentUserId = (): string | undefined => {
  try {
    const session = localStorage.getItem('auth_session');
    if (session) return JSON.parse(session).userId;
  } catch {}
  return undefined;
};

const getStorageKey = () => {
  const userId = getCurrentUserId();
  return userId ? `${BASE_STORAGE_KEY}-${userId}` : BASE_STORAGE_KEY;
};

function hexToHSL(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyThemeToDOM(theme: InterfaceTheme) {
  const root = document.documentElement;
  const profitHSL = hexToHSL(theme.positive);
  const lossHSL = hexToHSL(theme.negative);
  const neutralHSL = hexToHSL(theme.neutral);

  root.style.setProperty('--profit', profitHSL);
  root.style.setProperty('--loss', lossHSL);
  root.style.setProperty('--neutral-theme', neutralHSL);

  // Also update profit/loss foreground for contrast
  const profitL = parseInt(profitHSL.split('%')[1] || '50');
  root.style.setProperty('--profit-foreground', profitL > 50 ? `${profitHSL.split(' ')[0]} ${profitHSL.split(' ')[1]} 10%` : `${profitHSL.split(' ')[0]} ${profitHSL.split(' ')[1]} 95%`);
  const lossL = parseInt(lossHSL.split('%')[1] || '50');
  root.style.setProperty('--loss-foreground', lossL > 50 ? `${lossHSL.split(' ')[0]} ${lossHSL.split(' ')[1]} 10%` : `${lossHSL.split(' ')[0]} ${lossHSL.split(' ')[1]} 95%`);

  // Update gradient vars
  const [pH, pS, pLStr] = profitHSL.split(' ');
  const pL = parseInt(pLStr);
  root.style.setProperty('--gradient-profit', `linear-gradient(135deg, hsl(${pH} ${pS} ${pL}%) 0%, hsl(${pH} ${pS} ${Math.max(pL - 10, 5)}%) 100%)`);

  const [lH, lS, lLStr] = lossHSL.split(' ');
  const lL = parseInt(lLStr);
  root.style.setProperty('--gradient-loss', `linear-gradient(135deg, hsl(${lH} ${lS} ${lL}%) 0%, hsl(${lH} ${lS} ${Math.max(lL - 10, 5)}%) 100%)`);
}

interface InterfaceThemeContextType {
  theme: InterfaceTheme;
  setThemeColor: (key: 'positive' | 'negative' | 'neutral', color: string) => void;
  setMode: (mode: 'flat' | 'gradient') => void;
  resetToDefaults: () => void;
}

const InterfaceThemeContext = createContext<InterfaceThemeContextType | null>(null);

export const InterfaceThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<InterfaceTheme>(() => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_THEME;
  });

  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem(getStorageKey(), JSON.stringify(theme));
  }, [theme]);

  // Re-apply when theme mode (light/dark) changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyThemeToDOM(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);

  const setThemeColor = useCallback((key: 'positive' | 'negative' | 'neutral', color: string) => {
    setTheme(prev => ({ ...prev, [key]: color }));
  }, []);

  const setMode = useCallback((mode: 'flat' | 'gradient') => {
    setTheme(prev => ({ ...prev, mode }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setTheme(DEFAULT_THEME);
  }, []);

  return (
    <InterfaceThemeContext.Provider value={{ theme, setThemeColor, setMode, resetToDefaults }}>
      {children}
    </InterfaceThemeContext.Provider>
  );
};

export const useInterfaceTheme = () => {
  const ctx = useContext(InterfaceThemeContext);
  if (!ctx) {
    // Fallback for portal rendering outside provider tree
    const fallback: InterfaceThemeContextType = {
      theme: { positive: '#00c2ab', negative: '#d10046', neutral: '#4a4a4a', mode: 'flat' as const },
      setThemeColor: () => {},
      setMode: () => {},
      resetToDefaults: () => {},
    };
    return fallback;
  }
  return ctx;
};
