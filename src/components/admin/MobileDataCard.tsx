import * as React from 'react';
import { cn } from '@/lib/utils';

interface MobileDataCardProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileDataCard({ children, className }: MobileDataCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 space-y-3',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileDataRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileDataRow({ label, children, className }: MobileDataRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm font-medium text-right">{children}</div>
    </div>
  );
}

interface MobileDataHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileDataHeader({ title, actions, className }: MobileDataHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-2', className)}>
      <div className="font-medium">{title}</div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

interface MobileDataListProps {
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  loadingText?: string;
  emptyText?: string;
  isEmpty?: boolean;
}

export function MobileDataList({
  children,
  className,
  isLoading,
  loadingText = 'Loading...',
  emptyText = 'No items found',
  isEmpty,
}: MobileDataListProps) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {loadingText}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="py-8 text-center text-muted-foreground">{emptyText}</div>
    );
  }

  return <div className={cn('space-y-3', className)}>{children}</div>;
}
