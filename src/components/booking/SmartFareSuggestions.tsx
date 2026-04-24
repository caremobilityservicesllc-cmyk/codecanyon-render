import { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, TrendingDown, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { TransferType } from '@/types/booking';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTrafficData, TrafficData } from '@/hooks/useTrafficData';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrafficIndicator } from './TrafficIndicator';

interface SmartFareSuggestionsProps {
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: Date | null;
  pickupTime: string;
  routeDistanceKm: number | null;
  passengers: number;
  transferType: TransferType;
  className?: string;
}

interface FareSuggestion {
  title: string;
  description: string;
  savings?: string;
  recommended?: boolean;
}

interface BestValue {
  vehicleName: string;
  reason: string;
  estimatedPrice: number;
}

interface SuggestionsResponse {
  suggestions: FareSuggestion[];
  insights: string[];
  bestValue?: BestValue;
  timingSuggestion?: string;
  trafficAdjustedPrice?: number;
}

export function SmartFareSuggestions({
  pickupLocation,
  dropoffLocation,
  pickupDate,
  pickupTime,
  routeDistanceKm,
  passengers,
  transferType,
  className,
}: SmartFareSuggestionsProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const sf = (t as any).smartFare || {};
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canFetch = pickupLocation && dropoffLocation && pickupDate && pickupTime && routeDistanceKm;

  const { trafficData, isLoading: trafficLoading } = useTrafficData({
    origin: pickupLocation,
    destination: dropoffLocation,
    enabled: !!canFetch,
  });

  useEffect(() => {
    if (!canFetch) {
      setSuggestions(null);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('smart-fare-suggestions', {
          body: {
            pickupLocation,
            dropoffLocation,
            pickupDate: pickupDate.toISOString(),
            pickupTime,
            routeDistanceKm,
            passengers,
          },
        });

        if (fnError) throw fnError;
        setSuggestions(data);
      } catch (err) {
        console.error('Failed to fetch smart suggestions:', err);
        setError(sf.unableToLoad || 'Unable to load smart suggestions');
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [pickupLocation, dropoffLocation, pickupDate, pickupTime, routeDistanceKm, passengers]);

  if (!canFetch) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-4 transition-all hover:border-primary/30",
            isOpen && "border-primary/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-foreground">{sf.title || 'Smart Fare Suggestions'}</h4>
              <p className="text-xs text-muted-foreground">{sf.subtitle || 'AI-powered with real-time traffic analysis'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trafficData && trafficData.trafficLevel !== 'unknown' && (
              <TrafficIndicator trafficData={trafficData} isLoading={trafficLoading} />
            )}
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="mt-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{sf.analyzingFare || 'Analyzing fare data...'}</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : suggestions ? (
            <>
              {trafficData && trafficData.trafficLevel !== 'unknown' && (
                <TrafficIndicator 
                  trafficData={trafficData} 
                  isLoading={trafficLoading} 
                  showDetails={true}
                />
              )}

              {suggestions.bestValue && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-green-700 dark:text-green-300">
                        {(sf.bestValue || 'Best Value: {vehicle}').replace('{vehicle}', suggestions.bestValue.vehicleName)}
                      </h5>
                      <p className="text-sm text-green-600 dark:text-green-400">{suggestions.bestValue.reason}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">
                          {formatPrice(typeof suggestions.bestValue.estimatedPrice === 'number' 
                            ? suggestions.bestValue.estimatedPrice 
                            : Number(suggestions.bestValue.estimatedPrice) || 0)}
                        </span>
                        {trafficData && trafficData.trafficMultiplier > 1.1 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            {(sf.trafficAdjustment || '+{amount} traffic adjustment').replace('{amount}', formatPrice(Math.round(Number(suggestions.bestValue.estimatedPrice) * (trafficData.trafficMultiplier - 1) * 0.1)))}
                          </span>
                        )}
                        {transferType !== 'one-way' && <span className="text-xs text-green-600 dark:text-green-400">{sf.oneWay || '(one way)'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {suggestions.timingSuggestion && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-amber-700 dark:text-amber-300">{sf.timingTip || 'Timing Tip'}</h5>
                    <p className="text-sm text-amber-600 dark:text-amber-400">{suggestions.timingSuggestion}</p>
                  </div>
                </div>
              )}

              {suggestions.suggestions?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    {sf.recommendations || 'Recommendations'}
                  </h5>
                  <div className="space-y-2">
                    {suggestions.suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          suggestion.recommended
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h6 className="font-medium text-foreground text-sm">{suggestion.title}</h6>
                            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
                          </div>
                          {suggestion.savings && (
                            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                              <TrendingDown className="h-3 w-3" />
                              {(sf.save || 'Save {amount}').replace('{amount}', suggestion.savings)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.insights?.length > 0 && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">{sf.insights || 'Insights'}</h5>
                  <ul className="space-y-1">
                    {suggestions.insights.map((insight, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
