import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              'mt-1 sm:mt-2 text-xs sm:text-sm font-medium',
              trend.value >= 0 ? 'text-primary' : 'text-destructive'
            )}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6">
          {icon}
        </div>
      </div>
    </div>
  );
}
