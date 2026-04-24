import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-200"
      style={{ height: pullDistance }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full p-2 transition-all",
          isRefreshing ? "bg-primary/20" : isReady ? "bg-primary/20" : "bg-muted"
        )}
        style={{
          transform: `rotate(${progress * 180}deg) scale(${0.5 + progress * 0.5})`,
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              "h-5 w-5 transition-colors",
              isReady ? "text-primary" : "text-muted-foreground"
            )}
          />
        )}
      </div>
    </div>
  );
}
