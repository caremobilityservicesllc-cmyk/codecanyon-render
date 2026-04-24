import { AlertCircle } from 'lucide-react';
import { FieldErrors } from './types';

interface FieldErrorProps {
  field: string;
  errors: FieldErrors;
}

export function FieldError({ field, errors }: FieldErrorProps) {
  if (!errors[field]) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3" />
      {errors[field]}
    </p>
  );
}
