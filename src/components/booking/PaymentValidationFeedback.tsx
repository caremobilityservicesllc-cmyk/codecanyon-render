import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface ValidationItem {
  id: string;
  label: string;
  isValid: boolean;
  errorMessage?: string;
  isTouched: boolean;
}

interface PaymentValidationFeedbackProps {
  items: ValidationItem[];
  className?: string;
}

export function PaymentValidationFeedback({ items, className }: PaymentValidationFeedbackProps) {
  const { t } = useLanguage();
  const allValid = items.every(item => item.isValid);
  const hasErrors = items.some(item => item.isTouched && !item.isValid);

  return (
    <div className={cn("rounded-lg border p-4", className, 
      allValid ? "border-green-500/30 bg-green-500/5" : 
      hasErrors ? "border-destructive/30 bg-destructive/5" : 
      "border-border bg-card"
    )}>
      <div className="flex items-center gap-2 mb-3">
        {allValid ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : hasErrors ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={cn(
          "font-medium text-sm",
          allValid ? "text-green-600 dark:text-green-400" : 
          hasErrors ? "text-destructive" : 
          "text-foreground"
        )}>
          {allValid ? t.paymentValidation.readyToConfirm : hasErrors ? t.paymentValidation.completeRequiredFields : t.paymentValidation.completeTheseSteps}
        </span>
      </div>
      
      <ul className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2"
            >
              <div className="mt-0.5">
                {item.isValid ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </motion.div>
                ) : item.isTouched ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1">
                <span className={cn(
                  "text-sm",
                  item.isValid ? "text-green-600 dark:text-green-400 line-through opacity-70" : 
                  item.isTouched && !item.isValid ? "text-destructive" : 
                  "text-foreground"
                )}>
                  {item.label}
                </span>
                {item.isTouched && !item.isValid && item.errorMessage && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-destructive mt-0.5"
                  >
                    {item.errorMessage}
                  </motion.p>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
