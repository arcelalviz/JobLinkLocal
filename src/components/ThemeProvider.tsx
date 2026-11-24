'use client';
import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void; active: 'light' | 'dark' };
const ThemeContext = createContext<ThemeContextValue>({ theme: 'system', setTheme: () => {}, active: 'light' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem('joblink-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') setThemeState(saved);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const active = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => { document.documentElement.dataset.theme = active; document.documentElement.style.colorScheme = active; }, [active]);
  const value = useMemo<ThemeContextValue>(() => ({ theme, active, setTheme(value) { setThemeState(value); window.localStorage.setItem('joblink-theme', value); } }), [theme, active]);
  return <ThemeContext.Provider value={value}><MotionConfig reducedMotion="user" transition={{duration:.20,ease:[0.16,1,0.3,1]}}>{children}</MotionConfig></ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
