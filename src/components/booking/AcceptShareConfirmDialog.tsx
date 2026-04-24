import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Car, Users, MessageSquare } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

interface BookingDetails {
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  passengers: number;
  total_price: number;
  status: string;
}

interface AcceptShareConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: BookingDetails;
  sharerEmail?: string;
  costSplitPercentage: number;
  onConfirm: () => void;
  onCounterPropose?: (proposedPercentage: number) => void;
  isPending?: boolean;
  isCounterProposePending?: boolean;
  trigger?: React.ReactNode;
}

export function AcceptShareConfirmDialog({
  open,
  onOpenChange,
  booking,
  sharerEmail,
  costSplitPercentage,
  onConfirm,
  onCounterPropose,
  isPending = false,
  isCounterProposePending = false,
  trigger,
}: AcceptShareConfirmDialogProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const d = (t as any).acceptShareDialog || {};
  const as = t.acceptShare;
  const [showCounterProposal, setShowCounterProposal] = useState(false);
  const [proposedPercentage, setProposedPercentage] = useState(costSplitPercentage);

  const yourShare = booking?.total_price 
    ? ((booking.total_price * costSplitPercentage) / 100).toFixed(2)
    : null;
  
  const theirShare = booking?.total_price 
    ? ((booking.total_price * (100 - costSplitPercentage)) / 100).toFixed(2)
    : null;

  const proposedYourShare = booking?.total_price 
    ? ((booking.total_price * proposedPercentage) / 100).toFixed(2)
    : null;
  
  const proposedTheirShare = booking?.total_price 
    ? ((booking.total_price * (100 - proposedPercentage)) / 100).toFixed(2)
    : null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCounterPropose = () => {
    if (onCounterPropose && proposedPercentage !== costSplitPercentage) {
      onCounterPropose(proposedPercentage);
      onOpenChange(false);
      setShowCounterProposal(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setShowCounterProposal(false);
      setProposedPercentage(costSplitPercentage);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showCounterProposal ? (as.proposeDifferentSplit) : (d.acceptAndJoinRide || 'Accept Ride Share Invitation')}
          </DialogTitle>
          <DialogDescription>
            {showCounterProposal ? (
              as.suggestDifferentSplit
            ) : sharerEmail ? (
              <>{d.reviewSharedBy || 'Review the booking details shared by'} <span className="font-medium text-foreground">{sharerEmail}</span></>
            ) : (
              d.reviewBeforeAccepting || 'Review the booking details before accepting'
            )}
          </DialogDescription>
        </DialogHeader>

        {booking ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium">{d.route || 'Route'}</p>
                  <p className="text-sm text-muted-foreground truncate">{booking.pickup_location}</p>
                  <p className="text-xs text-muted-foreground">{d.to || 'to'}</p>
                  <p className="text-sm text-muted-foreground truncate">{booking.dropoff_location}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{d.date || 'Date'}</p>
                    <p className="text-sm font-medium">
                      {format(new Date(booking.pickup_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{d.time || 'Time'}</p>
                    <p className="text-sm font-medium">{booking.pickup_time}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{d.vehicle || 'Vehicle'}</p>
                    <p className="text-sm font-medium">{booking.vehicle_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{d.passengers || 'Passengers'}</p>
                    <p className="text-sm font-medium">{booking.passengers}</p>
                  </div>
                </div>
              </div>
            </div>

            {showCounterProposal ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
                {booking.total_price != null && booking.total_price > 0 && (
                  <div className="text-center pb-3 border-b border-warning/20">
                    <p className="text-xs text-muted-foreground mb-1">{d.totalFare || 'Total Fare'}</p>
                    <p className="text-xl font-bold text-foreground">{formatPrice(booking.total_price)}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium text-center">
                    {(d.yourProposedSharePct || 'Your proposed share: {pct}%').replace('{pct}', String(proposedPercentage))}
                  </p>
                  <Slider
                    value={[proposedPercentage]}
                    onValueChange={([value]) => setProposedPercentage(value)}
                    min={10}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span>90%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {(d.sharerPays || '{name} pays').replace('{name}', sharerEmail ? sharerEmail.split('@')[0] : 'Sharer')}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {100 - proposedPercentage}%
                    </p>
                    {proposedTheirShare && (
                      <p className="text-lg font-semibold text-foreground">{formatPrice(Number(proposedTheirShare))}</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{d.youPay || 'You pay'}</p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {proposedPercentage}%
                    </p>
                    {proposedYourShare && (
                      <p className="text-xl font-bold text-accent">{formatPrice(Number(proposedYourShare))}</p>
                    )}
                  </div>
                </div>

                {proposedPercentage === costSplitPercentage && (
                  <p className="text-xs text-muted-foreground text-center">
                    {d.adjustSlider || 'Adjust the slider to propose a different split'}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                {booking.total_price != null && booking.total_price > 0 && (
                  <div className="text-center pb-3 border-b border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">{d.totalFare || 'Total Fare'}</p>
                    <p className="text-xl font-bold text-foreground">{formatPrice(booking.total_price)}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {(d.sharerPays || '{name} pays').replace('{name}', sharerEmail ? sharerEmail.split('@')[0] : 'Sharer')}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {100 - costSplitPercentage}%
                    </p>
                    {theirShare ? (
                      <p className="text-lg font-semibold text-foreground">{formatPrice(Number(theirShare))}</p>
                    ) : (
                      <Badge variant="outline">{100 - costSplitPercentage}%</Badge>
                    )}
                  </div>

                  <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{d.youPay || 'You pay'}</p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {costSplitPercentage}%
                    </p>
                    {yourShare ? (
                      <p className="text-xl font-bold text-accent">{formatPrice(Number(yourShare))}</p>
                    ) : (
                      <Badge variant="outline" className="text-base">{costSplitPercentage}%</Badge>
                    )}
                  </div>
                </div>

                {yourShare && booking.total_price > 0 && (
                  <div className="text-center pt-2 border-t border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      {(d.youSaveBySharing || 'You save {amount} by sharing this ride').replace('{amount}', `$${theirShare}`)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {showCounterProposal 
                ? (d.sharerNotified || 'The sharer will be notified of your proposal and can accept or modify it.')
                : (d.agreeToShare || 'By accepting, you agree to share this ride and split the cost as shown above.')}
            </p>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>{d.loadingBookingDetails || 'Loading booking details...'}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          {showCounterProposal ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCounterProposal(false);
                  setProposedPercentage(costSplitPercentage);
                }}
                disabled={isCounterProposePending}
              >
                {t.common.back}
              </Button>
              <Button
                onClick={handleCounterPropose}
                disabled={isCounterProposePending || proposedPercentage === costSplitPercentage}
                className="gap-2"
              >
                {isCounterProposePending ? (as.sending) : (as.sendCounterProposal || 'Send Proposal')}
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="flex-1 sm:flex-none"
                >
                  {t.common.cancel}
                </Button>
                {onCounterPropose && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCounterProposal(true)}
                    disabled={isPending}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {d.counter || 'Counter'}
                  </Button>
                )}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={isPending || !booking}
                className="gap-2 w-full sm:w-auto"
              >
                {isPending ? (as.accepting) : (d.acceptAndJoinRide || 'Accept & Join Ride')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
