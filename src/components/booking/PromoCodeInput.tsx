import { useState } from 'react';
import { Tag, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PromoCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onApply?: (code: string) => Promise<{ valid: boolean; discount?: number; message?: string }>;
}

export function PromoCodeInput({ value, onChange, onApply }: PromoCodeInputProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number | null>(null);
  const { t } = useLanguage();
  const pc = (t as any).promoCode || {};

  const handleApply = async () => {
    if (!value.trim() || !onApply) return;

    setIsApplying(true);
    setStatus('idle');
    setMessage(null);

    try {
      const result = await onApply(value.trim().toUpperCase());
      if (result.valid) {
        setStatus('valid');
        setDiscount(result.discount || null);
        setMessage(result.message || pc.applied || 'Promo code applied!');
      } else {
        setStatus('invalid');
        setMessage(result.message || pc.invalid || 'Invalid promo code');
      }
    } catch {
      setStatus('invalid');
      setMessage(pc.failedToValidate || 'Failed to validate code');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setStatus('idle');
    setMessage(null);
    setDiscount(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={pc.placeholder || 'Enter promo code'}
            value={value}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
              if (status !== 'idle') {
                setStatus('idle');
                setMessage(null);
              }
            }}
            className={cn(
              "ps-9 pe-10 uppercase",
              status === 'valid' && "border-green-500 bg-green-500/5",
              status === 'invalid' && "border-destructive bg-destructive/5"
            )}
            disabled={isApplying || status === 'valid'}
          />
          {status === 'valid' && (
            <Check className="absolute inset-inline-end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
          )}
          {status === 'invalid' && (
            <X className="absolute inset-inline-end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
          )}
        </div>
        
        {status === 'valid' ? (
          <Button
            variant="outline"
            onClick={handleClear}
            className="shrink-0"
          >
            {pc.remove || 'Remove'}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleApply}
            disabled={!value.trim() || isApplying}
            className="shrink-0"
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              pc.apply || 'Apply'
            )}
          </Button>
        )}
      </div>

      {message && (
        <p className={cn(
          "text-sm animate-fade-in",
          status === 'valid' ? "text-green-600 dark:text-green-400" : "text-destructive"
        )}>
          {message}
          {discount && status === 'valid' && (
            <span className="ml-1 font-semibold">(-{discount}%)</span>
          )}
        </p>
      )}
    </div>
  );
}