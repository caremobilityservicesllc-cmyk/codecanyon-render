import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CreditCard,
  Wallet,
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    booking_reference: string;
    payment_method: 'card' | 'paypal' | 'bank';
    total_price: number | null;
    status: string;
    pickup_location: string;
    dropoff_location: string;
  } | null;
  onRefundComplete?: () => void;
}

const paymentMethodIcons = {
  card: CreditCard,
  paypal: Wallet,
  bank: Building2,
};

export function RefundDialog({
  open,
  onOpenChange,
  booking,
  onRefundComplete,
}: RefundDialogProps) {
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useLanguage();
  const rd = (t as any).refundDialogExt || {};
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    refundId?: string;
  } | null>(null);
  const { toast } = useToast();
  const { formatPrice, currency } = useSystemSettings();

  const paymentMethodLabels: Record<string, string> = {
    card: rd.creditCardStripe || 'Credit Card (Stripe)',
    paypal: rd.paypal || 'PayPal',
    bank: rd.bankTransfer || 'Bank Transfer',
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRefundAmount('');
      setReason('');
      setResult(null);
    }
    onOpenChange(newOpen);
  };

  const handleRefund = async () => {
    if (!booking) return;

    const amount = parseFloat(refundAmount) || booking.total_price || 0;
    if (amount <= 0) {
      toast({
        title: t.refundDialog.invalidAmount,
        description: t.refundDialog.enterValidAmount,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('process-refund', {
        body: {
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
          paymentMethod: booking.payment_method,
          amount,
          reason: reason || 'Admin initiated refund',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          refundId: data.refundId,
        });
        toast({
          title: t.refundDialog.refundProcessed,
          description: data.message,
        });
        onRefundComplete?.();
      } else {
        throw new Error(data.error || 'Refund failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process refund';
      setResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: t.refundDialog.refundFailed,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!booking) return null;

  const PaymentIcon = paymentMethodIcons[booking.payment_method];
  const maxAmount = booking.total_price || 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-accent" />
            {rd.processRefund || 'Process Refund'}
          </DialogTitle>
          <DialogDescription>
            {(rd.issueRefundFor || 'Issue a refund for booking {ref}').replace('{ref}', booking.booking_reference)}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6"
            >
              <div className={`flex flex-col items-center gap-4 p-4 rounded-lg ${
                result.success ? 'bg-accent/10' : 'bg-destructive/10'
              }`}>
                {result.success ? (
                  <CheckCircle2 className="h-12 w-12 text-accent" />
                ) : (
                  <XCircle className="h-12 w-12 text-destructive" />
                )}
                <div className="text-center">
                  <p className={`font-medium ${result.success ? 'text-accent' : 'text-destructive'}`}>
                    {result.success ? (rd.refundProcessed || 'Refund Processed') : (rd.refundFailed || 'Refund Failed')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.message}
                  </p>
                  {result.refundId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {rd.refundId || 'Refund ID'}: {result.refundId}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 py-4"
            >
              {/* Booking Summary */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{rd.paymentMethod || 'Payment Method'}</span>
                  <div className="flex items-center gap-2">
                    <PaymentIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {paymentMethodLabels[booking.payment_method]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{rd.originalAmount || 'Original Amount'}</span>
                  <span className="text-sm font-medium">{formatPrice(maxAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{rd.status || 'Status'}</span>
                  <Badge variant="outline">{booking.status}</Badge>
                </div>
              </div>

              {/* Warning for manual refunds */}
              {booking.payment_method === 'bank' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {rd.bankTransferManualNote || 'Bank transfer refunds require manual processing. You will need to initiate the transfer through your bank.'}
                  </p>
                </div>
              )}

              {/* Refund Amount */}
              <div className="space-y-2">
                <Label htmlFor="refund-amount">{(rd.refundAmount || 'Refund Amount ({symbol})').replace('{symbol}', currency.symbol)}</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAmount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={maxAmount.toFixed(2)}
                />
                <p className="text-xs text-muted-foreground">
                  {(rd.leaveEmptyForFull || 'Leave empty for full refund ({amount})').replace('{amount}', formatPrice(maxAmount))}
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="refund-reason">{rd.reasonOptional || 'Reason (Optional)'}</Label>
                <Textarea
                  id="refund-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={rd.enterReasonPlaceholder || 'Enter reason for refund...'}
                  rows={3}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleOpenChange(false)}>
              {t.common.close}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isProcessing}
              >
                {t.common.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRefund}
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {rd.processing || 'Processing...'}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {rd.processRefund || 'Process Refund'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
