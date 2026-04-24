import { useState, useCallback, useRef, useEffect } from 'react';
import { searchAddresses } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

export interface AddressSuggestion {
  id: string;
  address: string;
  mainText: string;
  secondaryText: string;
}

interface UseAddressAutocompleteProps {
  debounceMs?: number;
}

export function useAddressAutocomplete({
  debounceMs = 300,
}: UseAddressAutocompleteProps = {}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const { t } = useLanguage();
  const me = (t as any).mapErrors || {};

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await searchAddresses(searchQuery, 5);

      const formattedSuggestions: AddressSuggestion[] = data.map((item: any) => {
        const parts = item.display_name.split(', ');
        return {
          id: item.place_id.toString(),
          address: item.display_name,
          mainText: parts[0] || item.display_name,
          secondaryText: parts.slice(1, 4).join(', ') || '',
        };
      });

      setSuggestions(formattedSuggestions);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setError(me.failedToFetchSuggestions || 'Failed to fetch address suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, debounceMs);
  }, [fetchSuggestions, debounceMs]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    query,
    suggestions,
    isLoading,
    error,
    search,
    clearSuggestions,
    isApiConfigured: true,
  };
}
