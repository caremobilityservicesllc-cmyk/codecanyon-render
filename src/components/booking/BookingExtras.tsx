import { useState } from 'react';
import { Briefcase, Baby, Plus, Minus, ChevronDown, ChevronUp, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { GLOBAL_SETTINGS } from '@/types/booking';
import { useLanguage } from '@/contexts/LanguageContext';

interface BookingExtrasProps {
  luggageCount: number;
  childSeats: number;
  flightNumber: string;
  onLuggageChange: (count: number) => void;
  onChildSeatsChange: (count: number) => void;
  onFlightNumberChange: (flightNumber: string) => void;
}

export function BookingExtras({
  luggageCount,
  childSeats,
  flightNumber,
  onLuggageChange,
  onChildSeatsChange,
  onFlightNumberChange,
}: BookingExtrasProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const hasExtras = luggageCount > 0 || childSeats > 0 || flightNumber.trim() !== '';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all",
            isOpen ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30",
            hasExtras && !isOpen && "border-primary/50 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              isOpen || hasExtras ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}>
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t.bookingExtras.addExtras}</p>
              <p className="text-sm text-muted-foreground">
                {hasExtras ? (
                  <span className="text-primary">
                    {luggageCount > 0 && `${luggageCount} ${t.common.bags}`}
                    {luggageCount > 0 && childSeats > 0 && ' • '}
                    {childSeats > 0 && `${childSeats} ${t.bookingExtras.childSeats.toLowerCase()}`}
                    {(luggageCount > 0 || childSeats > 0) && flightNumber && ' • '}
                    {flightNumber && t.bookingExtras.flightTracking}
                  </span>
                ) : (
                  t.bookingExtras.luggageBagsChildSeats
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
        <div className="mt-3 space-y-4 rounded-lg border border-border bg-card p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Briefcase className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t.bookingExtras.luggage}</p>
                <p className="text-xs text-muted-foreground">{t.bookingExtras.numberOfBags}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onLuggageChange(Math.max(0, luggageCount - 1))} disabled={luggageCount <= 0}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium text-foreground">{luggageCount}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onLuggageChange(luggageCount + 1)} disabled={luggageCount >= 10}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Baby className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t.bookingExtras.childSeats}</p>
                <p className="text-xs text-muted-foreground">{t.bookingExtras.maxPerBooking.replace('{max}', String(GLOBAL_SETTINGS.maxChildSeats))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChildSeatsChange(Math.max(0, childSeats - 1))} disabled={childSeats <= 0}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium text-foreground">{childSeats}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChildSeatsChange(childSeats + 1)} disabled={childSeats >= GLOBAL_SETTINGS.maxChildSeats}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Plane className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <Label htmlFor="flight-number" className="font-medium text-foreground">
                  {t.bookingExtras.flightNumber}
                </Label>
                <p className="text-xs text-muted-foreground">{t.bookingExtras.monitorFlight}</p>
              </div>
            </div>
            <Input
              id="flight-number"
              placeholder="e.g., AA1234, BA789"
              value={flightNumber}
              onChange={(e) => onFlightNumberChange(e.target.value.toUpperCase())}
              className="ml-13 mt-2"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
