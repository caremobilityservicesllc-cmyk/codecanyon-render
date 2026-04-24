import { Check, MapPin, Car, CreditCard, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

export function CompletedJourneyIndicator() {
  const { t } = useLanguage();
  const cj = (t as any).completedJourney || {};

  const steps = [
    { id: 1, name: cj.location || 'Location', icon: MapPin },
    { id: 2, name: cj.vehicle || 'Vehicle', icon: Car },
    { id: 3, name: cj.payment || 'Payment', icon: CreditCard },
    { id: 4, name: cj.confirmed || 'Confirmed', icon: PartyPopper },
  ];

  return (
    <div className="mb-8">
      {/* Mobile View */}
      <div className="mb-6 sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-accent">
            {cj.bookingComplete || 'Booking Complete'}
          </span>
          <span className="text-sm text-muted-foreground">
            {cj.allStepsCompleted || 'All steps completed'}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden sm:flex items-center justify-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isLast 
                      ? 'border-primary bg-primary text-primary-foreground shadow-glow' 
                      : 'border-step-complete bg-step-complete text-primary-foreground'
                  )}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 200 
                  }}
                >
                  {isLast ? (
                    <Icon className="h-5 w-5" />
                  ) : (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 + 0.2, type: "spring" }}
                    >
                      <Check className="h-5 w-5" />
                    </motion.div>
                  )}
                </motion.div>
                <motion.span
                  className={cn(
                    'mt-2 text-sm font-medium transition-colors duration-300',
                    isLast ? 'text-accent font-semibold' : 'text-step-complete'
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 + 0.1 }}
                >
                  {step.name}
                </motion.span>
              </div>

              {!isLast && (
                <div className="relative mx-3 w-12 sm:w-16">
                  <div className="step-connector bg-step-inactive/30" />
                  <motion.div
                    className="step-connector absolute inset-0 bg-step-complete"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.1 + 0.15, ease: "easeOut" }}
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
