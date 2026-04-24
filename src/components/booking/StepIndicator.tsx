import { Check, MapPin, Car, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const { t } = useLanguage();
  
  const steps = [
    { id: 1, name: t.stepIndicator.location, icon: MapPin },
    { id: 2, name: t.stepIndicator.vehicle, icon: Car },
    { id: 3, name: t.stepIndicator.payment, icon: CreditCard },
  ];

  return (
    <div className="mb-10">
      <div className="mb-6 sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {t.stepIndicator.step} {currentStep} {t.stepIndicator.of} {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {steps[currentStep - 1]?.name}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isComplete = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    'relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isComplete && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary ring-4 ring-primary/20',
                    !isComplete && !isActive && 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                >
                  {isComplete ? (
                    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.4, type: "spring" }}>
                      <Check className="h-5 w-5" strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </motion.div>
                <motion.span
                  className={cn(
                    'mt-3 text-sm font-medium transition-colors duration-300',
                    isComplete && 'text-primary',
                    isActive && 'text-foreground font-semibold',
                    !isComplete && !isActive && 'text-muted-foreground'
                  )}
                  initial={false}
                  animate={{ fontWeight: isActive ? 600 : 500 }}
                >
                  {step.name}
                </motion.span>
              </div>
              {!isLast && (
                <div className="relative mx-6 w-20 sm:w-28 h-0.5">
                  <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
                  <motion.div
                    className="absolute inset-0 bg-primary rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isComplete ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ transformOrigin: 'left' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
