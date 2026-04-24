import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldErrorProps {
  error: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function FormFieldError({ error, className, showIcon = true }: FormFieldErrorProps) {
  if (!error) return null;

  return (
    <p className={cn(
      "flex items-center gap-1.5 text-sm text-destructive animate-fade-in mt-1",
      className
    )}>
      {showIcon && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
      <span>{error}</span>
    </p>
  );
}
