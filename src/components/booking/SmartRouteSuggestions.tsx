import { useState, useEffect } from 'react';
import { Sparkles, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface RouteSuggestion {
  pickup: string;
  dropoff: string;
}

interface SmartRouteSuggestionsProps {
  pickup: string;
  dropoff: string;
  onSelectRoute: (pickup: string, dropoff: string) => void;
}

export function SmartRouteSuggestions({ pickup, dropoff, onSelectRoute }: SmartRouteSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const shouldFetch =
      (pickup.length >= 3 && dropoff.length < 3) ||
      (dropoff.length >= 3 && pickup.length < 3);

    if (!shouldFetch) {
      setSuggestions([]);
      setHasQueried(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasQueried(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-booking-features', {
          body: {
            feature: 'route_suggestions',
            context: { pickup, dropoff },
          },
        });
        if (!error && data?.result && Array.isArray(data.result)) {
          setSuggestions(data.result.slice(0, 3));
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [pickup, dropoff]);

  if (!hasQueried && suggestions.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {t.smartRoute.smartRouteSuggestions}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t.smartRoute.findingRoutes}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelectRoute(s.pickup, s.dropoff)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors',
                'bg-background hover:bg-accent/10 border border-transparent hover:border-primary/20'
              )}
            >
              <MapPin className="h-3 w-3 shrink-0 text-accent" />
              <span className="truncate font-medium text-foreground">{s.pickup}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{s.dropoff}</span>
            </button>
          ))}
        </div>
      ) : hasQueried ? (
        <p className="text-xs text-muted-foreground py-1">{t.smartRoute.noSuggestions}</p>
      ) : null}
    </div>
  );
}
