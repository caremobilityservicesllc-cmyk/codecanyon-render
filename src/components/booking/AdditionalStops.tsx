import { useState } from 'react';
import { MapPin, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { GLOBAL_SETTINGS } from '@/types/booking';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdditionalStopsProps {
  stops: string[];
  onStopsChange: (stops: string[]) => void;
}

export function AdditionalStops({
  stops,
  onStopsChange,
}: AdditionalStopsProps) {
  const [isOpen, setIsOpen] = useState(stops.length > 0);
  const { t } = useLanguage();

  const addStop = () => {
    if (stops.length < GLOBAL_SETTINGS.maxStops) {
      onStopsChange([...stops, '']);
    }
  };

  const removeStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    onStopsChange(newStops);
    if (newStops.length === 0) {
      setIsOpen(false);
    }
  };

  const updateStop = (index: number, value: string) => {
    const newStops = [...stops];
    newStops[index] = value;
    onStopsChange(newStops);
  };

  const hasStops = stops.length > 0 && stops.some(s => s.trim() !== '');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all",
            isOpen ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30",
            hasStops && !isOpen && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              isOpen || hasStops ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}>
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t.additionalStops.addStops}</p>
              <p className="text-sm text-muted-foreground">
                {hasStops ? (
                  <span className="text-primary">
                    {t.additionalStops.stopsAdded.replace('{count}', String(stops.filter(s => s.trim()).length))}
                  </span>
                ) : (
                  t.additionalStops.upToStops.replace('{max}', String(GLOBAL_SETTINGS.maxStops))
                )}
              </p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 animate-fade-in">
          {stops.map((stop, index) => (
            <div key={index} className="flex items-center gap-2 animate-fade-in">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-semibold">{index + 1}</span>
              </div>
              <div className="flex-1">
                <AddressAutocompleteInput
                  id={`stop-${index}`}
                  placeholder={t.additionalStops.enterStopAddress.replace('{num}', String(index + 1))}
                  value={stop}
                  onChange={(value) => updateStop(index, value)}
                  accentColor="green"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeStop(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {stops.length < GLOBAL_SETTINGS.maxStops && (
            <Button
              variant="outline"
              onClick={addStop}
              className="w-full gap-2 border-dashed"
            >
              <Plus className="h-4 w-4" />
              {t.additionalStops.addStop} {stops.length > 0 && `(${stops.length}/${GLOBAL_SETTINGS.maxStops})`}
            </Button>
          )}

          {stops.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {t.additionalStops.stopsAffectPricing}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
