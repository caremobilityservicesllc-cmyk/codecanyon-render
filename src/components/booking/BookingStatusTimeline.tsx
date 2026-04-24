import { CheckCircle2, Timer, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface BookingStatusTimelineProps {
  currentStatus: BookingStatus;
}

export function BookingStatusTimeline({ currentStatus }: BookingStatusTimelineProps) {
  const { t } = useLanguage();
  const isCancelled = currentStatus === 'cancelled';

  const steps = [
    { status: 'pending' as const, label: t.bookingTimeline.pending, description: t.bookingTimeline.pendingDesc },
    { status: 'confirmed' as const, label: t.bookingTimeline.confirmed, description: t.bookingTimeline.confirmedDesc },
    { status: 'completed' as const, label: t.bookingTimeline.completed, description: t.bookingTimeline.completedDesc },
  ];

  const getStepState = (stepStatus: BookingStatus) => {
    if (isCancelled) return 'cancelled';
    const statusOrder = ['pending', 'confirmed', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepStatus);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <XCircle className="h-6 w-6 text-destructive" />
        <div>
          <p className="font-medium text-destructive">{t.bookingTimeline.cancelled}</p>
          <p className="text-sm text-muted-foreground">{t.bookingTimeline.cancelledDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-inline-start-[19px] top-8 h-[calc(100%-4rem)] w-0.5 bg-border" />
      <div className="absolute inset-inline-start-[19px] top-8 w-0.5 bg-primary transition-all duration-500"
        style={{ height: currentStatus === 'pending' ? '0%' : currentStatus === 'confirmed' ? 'calc(50% - 1rem)' : 'calc(100% - 4rem)' }} />
      <div className="space-y-6">
        {steps.map((step) => {
          const state = getStepState(step.status);
          return (
            <div key={step.status} className="relative flex items-start gap-4">
              <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                state === 'completed' && "border-primary bg-primary text-primary-foreground",
                state === 'current' && "border-primary bg-background text-primary animate-pulse",
                state === 'upcoming' && "border-muted bg-background text-muted-foreground"
              )}>
                {state === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : state === 'current' ? <Timer className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 pt-1.5">
                <p className={cn("font-medium transition-colors", state === 'completed' && "text-primary", state === 'current' && "text-foreground", state === 'upcoming' && "text-muted-foreground")}>{step.label}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {state === 'current' && (
                <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="text-xs font-medium text-accent">{t.bookingTimeline.current}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
