import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKeys } from '@/i18n/translations';
import { useSystemSettings } from './SystemSettingsContext';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Unflatten dot-notation keys into nested object
function unflattenObject(flat: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

// Deep merge: overrides values in base with values from override
function deepMerge(base: any, override: any): any {
  if (!override) return base;
  if (typeof base !== 'object' || typeof override !== 'object') return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key in result && typeof result[key] === 'object' && typeof override[key] === 'object') {
      result[key] = deepMerge(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { defaultLanguage, isLoading: settingsLoading } = useSystemSettings();
  const [language, setLanguageState] = useState<Language>('en');
  const [dbOverrides, setDbOverrides] = useState<Record<string, Record<string, string>>>({});

  // Load translation overrides from DB
  useEffect(() => {
    async function loadOverrides() {
      const PAGE_SIZE = 1000;
      let offset = 0;
      const allRows: Array<{ language_code: string; translation_key: string; translation_value: string }> = [];

      while (true) {
        const { data, error } = await supabase
          .from('translation_overrides')
          .select('language_code, translation_key, translation_value')
          .order('language_code', { ascending: true })
          .order('translation_key', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          console.warn('Failed to load translation overrides:', error);
          return;
        }

        if (!data || data.length === 0) break;
        allRows.push(...data);

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      if (allRows.length > 0) {
        const grouped: Record<string, Record<string, string>> = {};
        for (const row of allRows) {
          if (!grouped[row.language_code]) grouped[row.language_code] = {};
          grouped[row.language_code][row.translation_key] = row.translation_value;
        }
        setDbOverrides(grouped);
      }
    }

    loadOverrides();
  }, []);

  useEffect(() => {
    if (settingsLoading) return;

    const storedLang = localStorage.getItem('language_preference');
    const isExplicit = localStorage.getItem('language_preference_explicit') === 'true';

    if (isExplicit && storedLang && storedLang in translations && storedLang !== defaultLanguage) {
      setLanguageState(storedLang as Language);
    } else {
      setLanguageState(defaultLanguage);
      localStorage.removeItem('language_preference');
      localStorage.removeItem('language_preference_explicit');
    }
  }, [defaultLanguage, settingsLoading]);

  const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];
  const isRTL = RTL_LANGUAGES.includes(language);

  // Sync dir and lang attributes on <html>
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    html.setAttribute('lang', language);
  }, [language, isRTL]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language_preference', lang);
    localStorage.setItem('language_preference_explicit', 'true');
  };

  // Build translations: English base + language-specific overrides + DB overrides
  const englishBase = translations.en as TranslationKeys;
  const langTranslations = (translations[language] || translations.en) as TranslationKeys;
  // Always merge on top of English so missing keys fall back to English
  const mergedBase = language === 'en' ? englishBase : deepMerge(englishBase, langTranslations) as TranslationKeys;
  const langOverrides = dbOverrides[language];
  const t = langOverrides
    ? deepMerge(mergedBase, unflattenObject(langOverrides)) as TranslationKeys
    : mergedBase;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    return {
      language: 'en' as Language,
      setLanguage: (() => {}) as (lang: Language) => void,
      t: translations.en,
      isRTL: false,
    };
  }
  return context;
}

// Helper hook for nested translations
export function useTranslation() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  
  const translate = (key: string): string => {
    const keys = key.split('.');
    let value: any = t;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return { t, translate, language, setLanguage, isRTL };
}
