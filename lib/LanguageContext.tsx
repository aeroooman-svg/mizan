import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, getTranslations } from './i18n';

const LANGUAGE_KEY = '@mizan_language';
const LEGACY_LANGUAGE_KEY = '@masarif_language';

export let globalAppLanguage: Language = 'ar';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: ReturnType<typeof getTranslations>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        let saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (!saved) {
          saved = await AsyncStorage.getItem(LEGACY_LANGUAGE_KEY);
        }
        if (saved === 'ar' || saved === 'en') {
          setLanguageState(saved);
          globalAppLanguage = saved;
          const isArabic = saved === 'ar';
          if (I18nManager.isRTL !== isArabic) {
            I18nManager.allowRTL(true);
            I18nManager.forceRTL(isArabic);
          }
        } else {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(true);
        }
      } catch (e) {}
    }
    loadSavedLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    globalAppLanguage = lang;
    const isArabic = lang === 'ar';
    if (I18nManager.isRTL !== isArabic) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(isArabic);
    }
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    await AsyncStorage.setItem(LEGACY_LANGUAGE_KEY, lang);
  }, []);

  const t = useMemo(() => getTranslations(language), [language]);
  const isRTL = language === 'ar';

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    isRTL,
  }), [language, setLanguage, t, isRTL]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
