import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DBLanguage {
  id: string;
  code: string;
  name: string;
  native_name: string;
  flag: string;
  is_active: boolean;
  translation_completeness: number;
}

export function useLanguagesFromDB() {
  const [languages, setLanguages] = useState<DBLanguage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .order('name');

      if (error) throw error;
      setLanguages((data as unknown as DBLanguage[]) || []);
    } catch (err) {
      console.error('Error fetching languages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = async (code: string, active: boolean) => {
    try {
      await supabase
        .from('languages')
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq('code', code);
      
      setLanguages(prev => prev.map(l => l.code === code ? { ...l, is_active: active } : l));
    } catch (err) {
      console.error('Error toggling language:', err);
    }
  };

  const activeLanguages = languages.filter(l => l.is_active);
  const inactiveLanguages = languages.filter(l => !l.is_active);

  return { languages, activeLanguages, inactiveLanguages, isLoading, toggleLanguage, refetch: fetchLanguages };
}
