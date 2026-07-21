import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveThemeMode, ThemeMode, themePalettes } from '@/constants/colors';

export const lightTheme = themePalettes.light;
export const darkTheme = themePalettes.dark;
export const midnightTheme = themePalettes.midnight;
export const emeraldTheme = themePalettes.emerald;
export const roseTheme = themePalettes.rose;

interface ThemeContextValue {
  theme: ThemeMode;
  colors: typeof darkTheme;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    async function loadTheme() {
      const stored = await AsyncStorage.getItem('@masarif_theme');
      if (
        stored === 'light' ||
        stored === 'dark' ||
        stored === 'midnight' ||
        stored === 'emerald' ||
        stored === 'rose'
      ) {
        setThemeState(stored as ThemeMode);
        setActiveThemeMode(stored as ThemeMode);
      }
    }
    loadTheme();
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    setActiveThemeMode(mode);
    await AsyncStorage.setItem('@masarif_theme', mode);
  };

  const toggleTheme = async () => {
    const themeSequence: ThemeMode[] = ['light', 'dark', 'midnight', 'emerald', 'rose'];
    const currentIndex = themeSequence.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeSequence.length;
    await setTheme(themeSequence[nextIndex]);
  };

  const colors = useMemo(() => {
    return themePalettes[theme];
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
