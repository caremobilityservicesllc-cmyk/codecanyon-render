import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  titleExtra?: ReactNode;
  className?: string;
}

export function AdminPageHeader({ 
  title, 
  description, 
  actions,
  titleExtra,
  className 
}: AdminPageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6",
      className
    )}>
      <div>
        <div className="flex items-center gap-3 rtl-inline-icon">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {titleExtra}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
