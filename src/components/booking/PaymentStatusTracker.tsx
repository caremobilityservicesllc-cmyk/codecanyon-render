import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  CreditCard,
  Wallet,
  Building2,
  RefreshCw,
  AlertTriangle,
  Radio,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

interface PaymentStatusTrackerProps {
  bookingId: string;
  bookingReference: string;
  paymentMethod: 'card' | 'paypal' | 'bank';
  bookingStatus: string;
  totalPrice: number | null;
  onStatusChange?: (newStatus: string) => void;
}

const paymentMethodIcons = {
  card: CreditCard,
  paypal: Wallet,
  bank: Building2,
};

export function PaymentStatusTracker({
  bookingId,
  bookingReference,
  paymentMethod,
  bookingStatus,
  totalPrice,
  onStatusChange,
}: PaymentStatusTrackerProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [bankTransferDetails, setBankTransferDetails] = useState<any>(null);

  const isBank = paymentMethod === 'bank';

  const paymentMethodLabels = {
    card: t.paymentTracker.creditCard,
    paypal: t.paymentTracker.paypal,
    bank: t.paymentTracker.bankTransfer,
  };

  const statusConfig: Record<PaymentStatus, {
    label: string;
    description: string;
    bankLabel?: string;
    bankDescription?: string;
    icon: typeof Clock;
    bankIcon?: typeof Clock;
    color: string;
    bgColor: string;
    animate?: boolean;
  }> = {
    pending: {
      label: t.paymentTracker.pendingLabel,
      description: t.paymentTracker.pendingDesc,
      bankLabel: t.paymentTracker.awaitingVerification,
      bankDescription: t.paymentTracker.awaitingVerificationDesc,
      icon: Clock,
      bankIcon: FileText,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    processing: {
      label: t.paymentTracker.processingLabel,
      description: t.paymentTracker.processingDesc,
      bankLabel: t.paymentTracker.awaitingVerification,
      bankDescription: t.paymentTracker.awaitingVerificationDesc,
      icon: Loader2,
      bankIcon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      animate: true,
    },
    completed: {
      label: t.paymentTracker.completedLabel,
      description: t.paymentTracker.completedDesc,
      bankLabel: t.paymentTracker.bankVerified,
      bankDescription: t.paymentTracker.bankVerifiedDesc,
      icon: CheckCircle2,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    failed: {
      label: t.paymentTracker.failedLabel,
      description: t.paymentTracker.failedDesc,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    refunded: {
      label: t.paymentTracker.refundedLabel,
      description: t.paymentTracker.refundedDesc,
      icon: RefreshCw,
      color: 'text-secondary-foreground',
      bgColor: 'bg-secondary',
    },
  };

  // Fetch bank transfer details if payment method is bank
  useEffect(() => {
    if (!isBank) return;
    const fetchDetails = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('bank_transfer_details')
        .eq('id', bookingId)
        .single();
      if (data?.bank_transfer_details) {
        setBankTransferDetails(data.bank_transfer_details);
      }
    };
    fetchDetails();
  }, [bookingId, isBank]);

  // Map booking status to payment status
  const derivePaymentStatus = useCallback((status: string, method: string): PaymentStatus => {
    if (method === 'bank') {
      switch (status) {
        case 'confirmed':
        case 'completed':
          return 'completed';
        case 'cancelled':
          return 'refunded';
        default:
          return 'pending';
      }
    }

    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'refunded';
      case 'pending':
      default:
        return 'pending';
    }
  }, []);

  // Initial status derivation
  useEffect(() => {
    const status = derivePaymentStatus(bookingStatus, paymentMethod);
    setPaymentStatus(status);
    setLastUpdated(new Date());
  }, [bookingStatus, paymentMethod, derivePaymentStatus]);

  // Subscribe to real-time booking updates
  useEffect(() => {
    setConnectionStatus('connecting');
    
    const channel = supabase
      .channel(`payment-status-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const newBookingStatus = payload.new.status as string;
          const newPaymentStatus = derivePaymentStatus(newBookingStatus, paymentMethod);
          
          setPaymentStatus((prev) => {
            if (prev !== newPaymentStatus) {
              const config = statusConfig[newPaymentStatus];
              const label = isBank && config.bankLabel ? config.bankLabel : config.label;
              const desc = isBank && config.bankDescription ? config.bankDescription : config.description;
              toast.success(label, { description: desc });
              onStatusChange?.(newBookingStatus);
              return newPaymentStatus;
            }
            return prev;
          });
          
          setLastUpdated(new Date());
          setIsLive(true);
          setTimeout(() => setIsLive(false), 3000);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, paymentMethod, derivePaymentStatus, onStatusChange, isBank]);

  const config = statusConfig[paymentStatus];
  const PaymentMethodIcon = paymentMethodIcons[paymentMethod];
  const StatusIcon = isBank && config.bankIcon ? config.bankIcon : config.icon;
  const statusLabel = isBank && config.bankLabel ? config.bankLabel : config.label;
  const statusDescription = isBank && config.bankDescription ? config.bankDescription : config.description;

  const steps: { status: PaymentStatus; label: string }[] = isBank
    ? [
        { status: 'pending', label: t.paymentTracker.submitted },
        { status: 'processing', label: t.paymentTracker.underReview },
        { status: 'completed', label: t.paymentTracker.verified },
      ]
    : [
        { status: 'pending', label: t.paymentTracker.initiated },
        { status: 'processing', label: t.paymentTracker.processing },
        { status: 'completed', label: t.paymentTracker.completed },
      ];

  const currentStepIndex = paymentStatus === 'failed' || paymentStatus === 'refunded'
    ? -1
    : isBank && paymentStatus === 'pending'
      ? 1
      : steps.findIndex(s => s.status === paymentStatus);

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-6 mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-accent" />
          {t.paymentTracker.title}
        </h3>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {isLive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Badge variant="outline" className="gap-1.5 border-accent text-accent">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Radio className="h-3 w-3" />
                  </motion.div>
                  {t.paymentTracker.liveUpdate}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              connectionStatus === 'connected' && "bg-accent",
              connectionStatus === 'connecting' && "bg-warning animate-pulse",
              connectionStatus === 'disconnected' && "bg-destructive"
            )} />
            <span className="text-xs text-muted-foreground">
              {connectionStatus === 'connected' ? t.paymentTracker.live : connectionStatus === 'connecting' ? t.paymentTracker.connecting : t.paymentTracker.offline}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PaymentMethodIcon className="h-4 w-4" />
            {paymentMethodLabels[paymentMethod]}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={paymentStatus}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "flex items-center gap-3 rounded-lg p-4 mb-4",
            config.bgColor
          )}
        >
          <div className={cn("flex-shrink-0", config.color)}>
            <StatusIcon className={cn("h-6 w-6", config.animate && !isBank && "animate-spin")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium", config.color)}>{statusLabel}</p>
            <p className="text-sm text-muted-foreground">{statusDescription}</p>
          </div>
          {totalPrice && (
            <div className="text-right flex-shrink-0">
              <p className="font-display text-lg font-bold text-foreground">
                {formatPrice(Number(totalPrice))}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bank Transfer Details Section */}
      {isBank && bankTransferDetails && paymentStatus !== 'completed' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t.paymentTracker.submittedTransferDetails}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: t.paymentTracker.senderName, value: bankTransferDetails.senderName },
              { label: t.paymentTracker.bankName, value: bankTransferDetails.bankName },
              { label: t.paymentTracker.transferRef, value: bankTransferDetails.transferReference },
              { label: t.paymentTracker.transferDate, value: bankTransferDetails.transferDate },
              { label: t.paymentTracker.amount, value: bankTransferDetails.amountTransferred },
            ].filter(item => item.value).map((item) => (
              <div key={item.label} className="flex flex-col">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
          {bankTransferDetails.notes && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{t.paymentTracker.notes}</span>
              <p className="text-sm text-foreground">{bankTransferDetails.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Steps */}
      {paymentStatus !== 'failed' && paymentStatus !== 'refunded' && (
        <div className="relative mb-4">
          <div className="flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  <motion.div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors z-10 bg-card",
                      isCompleted && "bg-accent border-accent",
                      isCurrent && "border-accent bg-accent/10",
                      !isCompleted && !isCurrent && "border-muted bg-muted/10"
                    )}
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                    ) : isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted" />
                    )}
                  </motion.div>
                  <span className={cn(
                    "text-xs mt-2 text-center",
                    isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 mx-8">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: '0%' }}
              animate={{ 
                width: currentStepIndex === 0 ? '0%' : 
                       currentStepIndex === 1 ? '50%' : 
                       currentStepIndex === 2 ? '100%' : '0%'
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Failed/Refunded State */}
      {(paymentStatus === 'failed' || paymentStatus === 'refunded') && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-4">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {paymentStatus === 'failed' 
              ? t.paymentTracker.failedRetryHint
              : t.paymentTracker.refundedHint}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <span>{t.paymentTracker.ref}: {bookingReference}</span>
        <span>{t.paymentTracker.updated}: {lastUpdated.toLocaleTimeString()}</span>
      </div>

      {/* Retry Button for Failed Payments */}
      {paymentStatus === 'failed' && (
        <Button 
          variant="default" 
          className="w-full mt-4 gap-2"
          onClick={() => {
            setPaymentStatus('processing');
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {t.paymentTracker.retryPayment}
        </Button>
      )}
    </motion.div>
  );
}
