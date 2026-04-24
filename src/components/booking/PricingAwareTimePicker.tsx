import { useQuery } from '@tanstack/react-query';
import { Clock, Zap, Moon, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getDay } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface PricingRule {
  id: string;
  name: string;
  multiplier: number;
  start_time: string | null;
  end_time: string | null;
  days_of_week: DayOfWeek[] | null;
}

interface PricingAwareTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  timeSlots: string[];
  selectedDate: Date | null;
  className?: string;
  businessHoursStart?: string;
  businessHoursEnd?: string;
}

const DAY_MAP: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type TimeSlotPricing = 'peak' | 'off-peak' | 'standard';

interface SlotPricingInfo {
  type: TimeSlotPricing;
  rules: PricingRule[];
  maxMultiplier: number;
}

interface CheaperAlternative {
  time: string;
  savings: number;
  type: TimeSlotPricing;
}

export function PricingAwareTimePicker({
  value,
  onChange,
  timeSlots,
  selectedDate,
  className,
  businessHoursStart = '06:00',
  businessHoursEnd = '22:00',
}: PricingAwareTimePickerProps) {
  const { t } = useLanguage();

  const { data: pricingRules } = useQuery({
    queryKey: ['time-pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('id, name, multiplier, start_time, end_time, days_of_week')
        .eq('is_active', true)
        .eq('rule_type', 'time');
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  const getSlotPricingInfo = (time: string): SlotPricingInfo => {
    if (!pricingRules || pricingRules.length === 0 || !selectedDate) {
      return { type: 'standard', rules: [], maxMultiplier: 1 };
    }
    const dayOfWeek = DAY_MAP[getDay(selectedDate)];
    const [hours, minutes] = time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    const applicableRules: PricingRule[] = [];
    for (const rule of pricingRules) {
      if (rule.days_of_week && rule.days_of_week.length > 0) {
        if (!rule.days_of_week.includes(dayOfWeek)) continue;
      }
      if (rule.start_time && rule.end_time) {
        const [startH, startM] = rule.start_time.split(':').map(Number);
        const [endH, endM] = rule.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        let inRange = false;
        if (startMinutes > endMinutes) {
          inRange = timeInMinutes >= startMinutes || timeInMinutes < endMinutes;
        } else {
          inRange = timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
        }
        if (inRange) applicableRules.push(rule);
      }
    }
    const isPeak = applicableRules.some(r => r.multiplier > 1);
    const isOffPeak = applicableRules.some(r => r.multiplier < 1);
    const maxMultiplier = applicableRules.length > 0 
      ? Math.max(...applicableRules.map(r => r.multiplier)) : 1;
    return {
      type: isPeak ? 'peak' : isOffPeak ? 'off-peak' : 'standard',
      rules: applicableRules,
      maxMultiplier,
    };
  };

  const selectedPricingInfo = value ? getSlotPricingInfo(value) : { type: 'standard' as TimeSlotPricing, rules: [], maxMultiplier: 1 };

  const findCheaperAlternatives = (): CheaperAlternative[] => {
    if (!value || selectedPricingInfo.type !== 'peak' || !selectedDate) return [];
    const currentIndex = timeSlots.indexOf(value);
    if (currentIndex === -1) return [];
    const alternatives: CheaperAlternative[] = [];
    const currentMultiplier = selectedPricingInfo.maxMultiplier;
    const searchRange = 8;
    for (let i = Math.max(0, currentIndex - searchRange); i <= Math.min(timeSlots.length - 1, currentIndex + searchRange); i++) {
      if (i === currentIndex) continue;
      const slot = timeSlots[i];
      const slotInfo = getSlotPricingInfo(slot);
      if (slotInfo.maxMultiplier < currentMultiplier) {
        const savings = Math.round((1 - slotInfo.maxMultiplier / currentMultiplier) * 100);
        if (savings > 0) alternatives.push({ time: slot, savings, type: slotInfo.type });
      }
    }
    return alternatives.sort((a, b) => b.savings - a.savings).slice(0, 2);
  };

  const cheaperAlternatives = findCheaperAlternatives();

  const getHourlyPricingMap = () => {
    const hourMap: Record<number, SlotPricingInfo> = {};
    const startHour = parseInt(businessHoursStart.split(':')[0]);
    const endHour = parseInt(businessHoursEnd.split(':')[0]);
    for (let hour = startHour; hour <= endHour; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      hourMap[hour] = getSlotPricingInfo(time);
    }
    return hourMap;
  };

  const hourlyPricing = getHourlyPricingMap();
  const hasPricingRules = pricingRules && pricingRules.length > 0;

  const formatMultiplier = (multiplier: number) => {
    if (multiplier > 1) return `+${Math.round((multiplier - 1) * 100)}%`;
    if (multiplier < 1) return `-${Math.round((1 - multiplier) * 100)}%`;
    return t.pricingTimePicker.standard;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t.pricingTimePicker.time}</Label>
        {hasPricingRules && selectedDate && (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">{t.pricingTimePicker.peak}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">{t.pricingTimePicker.offPeak}</span>
            </div>
          </div>
        )}
      </div>

      {hasPricingRules && selectedDate && (
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-0.5 rounded-lg overflow-hidden h-3 bg-secondary">
            {Object.entries(hourlyPricing).map(([hour, info]) => (
              <Tooltip key={hour}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex-1 transition-colors cursor-pointer hover:opacity-80",
                      info.type === 'peak' && "bg-orange-500",
                      info.type === 'off-peak' && "bg-green-500",
                      info.type === 'standard' && "bg-muted"
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <div className="text-xs">
                    <p className="font-semibold">{hour}:00</p>
                    {info.rules.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {info.rules.map((rule) => (
                          <div key={rule.id} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{rule.name}</span>
                            <span className={cn(
                              "font-medium",
                              rule.multiplier > 1 && "text-orange-500",
                              rule.multiplier < 1 && "text-green-500"
                            )}>
                              {formatMultiplier(rule.multiplier)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t.pricingTimePicker.standardRate}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}

      {hasPricingRules && selectedDate && (
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>{businessHoursStart}</span>
          <span>{businessHoursEnd}</span>
        </div>
      )}

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="booking-input w-full">
          <div className="flex items-center min-w-0 flex-1">
            {selectedPricingInfo.type === 'peak' ? (
              <Zap className="mr-2 h-4 w-4 shrink-0 text-orange-500" />
            ) : selectedPricingInfo.type === 'off-peak' ? (
              <Moon className="mr-2 h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate"><SelectValue placeholder={t.pricingTimePicker.selectTime} /></span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {timeSlots.map((time) => {
            const pricingInfo = getSlotPricingInfo(time);
            return (
              <SelectItem key={time} value={time} className="flex items-center">
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    {pricingInfo.type === 'peak' ? (
                      <Zap className="h-3 w-3 text-orange-500" />
                    ) : pricingInfo.type === 'off-peak' ? (
                      <Moon className="h-3 w-3 text-green-500" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span>{time}</span>
                  </div>
                  {pricingInfo.type !== 'standard' && (
                    <span className={cn(
                      "text-xs",
                      pricingInfo.type === 'peak' && "text-orange-500",
                      pricingInfo.type === 'off-peak' && "text-green-500"
                    )}>
                      {pricingInfo.type === 'peak' ? t.pricingTimePicker.peak : t.pricingTimePicker.offPeak}
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {cheaperAlternatives.length > 0 && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold">{t.pricingTimePicker.saveMoney}</span>
          </div>
          <div className="space-y-1.5">
            {cheaperAlternatives.map((alt) => (
              <Button
                key={alt.time}
                variant="ghost"
                size="sm"
                onClick={() => onChange(alt.time)}
                className="w-full justify-between h-auto py-2 px-3 hover:bg-green-500/10 group"
              >
                <div className="flex items-center gap-2">
                  {alt.type === 'off-peak' ? (
                    <Moon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{alt.time}</span>
                  <span className="text-xs text-muted-foreground">
                    {alt.type === 'off-peak' ? t.pricingTimePicker.offPeak : t.pricingTimePicker.standard}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-green-600 dark:text-green-400">
                    {t.pricingTimePicker.save.replace('{pct}', String(alt.savings))}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
