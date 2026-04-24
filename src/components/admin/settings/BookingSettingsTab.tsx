import { Calendar, CreditCard, Percent, Receipt, Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FieldError } from './FieldError';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { BookingPolicies, FieldErrors } from './types';

interface BookingSettingsTabProps {
  bookingPolicies: BookingPolicies;
  setBookingPolicies: React.Dispatch<React.SetStateAction<BookingPolicies>>;
  errors: FieldErrors;
}

export function BookingSettingsTab({
  bookingPolicies,
  setBookingPolicies,
  errors,
}: BookingSettingsTabProps) {
  const { currency } = useSystemSettings();
  const { t } = useLanguage();
  const sym = currency.symbol;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t.adminSettings.paymentDeposits}
          </CardTitle>
          <CardDescription>{t.adminSettings.configurePaymentDeposit}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="depositPercentage">{t.adminSettings.depositPercentage}</Label>
            <Input id="depositPercentage" type="number" min={0} max={100} value={bookingPolicies.depositPercentage} onChange={(e) => setBookingPolicies(prev => ({ ...prev, depositPercentage: parseInt(e.target.value) || 0 }))} className={errors['bookingPolicies.depositPercentage'] ? 'border-destructive' : ''} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.depositPercentageHint}</p>
            <FieldError field="bookingPolicies.depositPercentage" errors={errors} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t.adminSettings.bookingRules}
          </CardTitle>
          <CardDescription>{t.adminSettings.bookingRulesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minAdvance">{t.adminSettings.minAdvanceBooking}</Label>
            <Input id="minAdvance" type="number" min={0} value={bookingPolicies.minAdvanceBookingHours} onChange={(e) => setBookingPolicies(prev => ({ ...prev, minAdvanceBookingHours: parseInt(e.target.value) || 0 }))} className={errors['bookingPolicies.minAdvanceBookingHours'] ? 'border-destructive' : ''} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.minAdvanceBookingHint}</p>
            <FieldError field="bookingPolicies.minAdvanceBookingHours" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxAdvance">{t.adminSettings.maxAdvanceBooking}</Label>
            <Input id="maxAdvance" type="number" min={1} value={bookingPolicies.maxAdvanceBookingDays} onChange={(e) => setBookingPolicies(prev => ({ ...prev, maxAdvanceBookingDays: parseInt(e.target.value) || 1 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.maxAdvanceBookingHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickupInterval">{t.adminSettings.pickupTimeInterval}</Label>
            <Select value={String(bookingPolicies.pickupTimeInterval)} onValueChange={(v) => setBookingPolicies(prev => ({ ...prev, pickupTimeInterval: parseInt(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{t.adminSettings.nMinutes.replace('{n}', '5')}</SelectItem>
                <SelectItem value="10">{t.adminSettings.nMinutes.replace('{n}', '10')}</SelectItem>
                <SelectItem value="15">{t.adminSettings.nMinutes.replace('{n}', '15')}</SelectItem>
                <SelectItem value="30">{t.adminSettings.nMinutes.replace('{n}', '30')}</SelectItem>
                <SelectItem value="60">{t.adminSettings.nMinutes.replace('{n}', '60')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.adminSettings.pickupTimeIntervalHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationHours">{t.adminSettings.freeCancellationWindow}</Label>
            <Input id="cancellationHours" type="number" min={0} value={bookingPolicies.cancellationHours} onChange={(e) => setBookingPolicies(prev => ({ ...prev, cancellationHours: parseInt(e.target.value) || 0 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.freeCancellationHint}</p>
          </div>
        </CardContent>
      </Card>

      {/* Commission & Service Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            {t.adminSettings.commissionServiceFees}
          </CardTitle>
          <CardDescription>{t.adminSettings.commissionServiceFeesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commissionPercentage">{t.adminSettings.commissionRate}</Label>
            <Input id="commissionPercentage" type="number" min={0} max={100} step={0.5} value={bookingPolicies.commissionPercentage ?? 15} onChange={(e) => setBookingPolicies(prev => ({ ...prev, commissionPercentage: parseFloat(e.target.value) || 0 }))} className={errors['bookingPolicies.commissionPercentage'] ? 'border-destructive' : ''} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.commissionRateHint}</p>
            <FieldError field="bookingPolicies.commissionPercentage" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookingFee">{t.adminSettings.bookingFee} ({sym})</Label>
            <Input id="bookingFee" type="number" min={0} step={0.5} value={bookingPolicies.bookingFee ?? 0} onChange={(e) => setBookingPolicies(prev => ({ ...prev, bookingFee: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.bookingFeeHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationFee">{t.adminSettings.cancellationFee} ({sym})</Label>
            <Input id="cancellationFee" type="number" min={0} step={0.5} value={bookingPolicies.cancellationFee ?? 0} onChange={(e) => setBookingPolicies(prev => ({ ...prev, cancellationFee: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.cancellationFeeHint}</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t.adminSettings.enableTollCharges}</Label>
                <p className="text-xs text-muted-foreground">{t.adminSettings.enableTollChargesHint}</p>
              </div>
              <Switch checked={bookingPolicies.enableTollCharges ?? true} onCheckedChange={(checked) => setBookingPolicies(prev => ({ ...prev, enableTollCharges: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t.adminSettings.enableAirportCharges}</Label>
                <p className="text-xs text-muted-foreground">{t.adminSettings.enableAirportChargesHint}</p>
              </div>
              <Switch checked={bookingPolicies.enableAirportCharges ?? true} onCheckedChange={(checked) => setBookingPolicies(prev => ({ ...prev, enableAirportCharges: checked }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loyalty & Rewards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {t.adminSettings.loyaltyRewardsProgram}
          </CardTitle>
          <CardDescription>{t.adminSettings.loyaltyRewardsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="loyaltyPointsPerDollar">{t.adminSettings.pointsPerSpent.replace('{sym}', sym)}</Label>
            <Input id="loyaltyPointsPerDollar" type="number" min={0} value={bookingPolicies.loyaltyPointsPerDollar ?? 10} onChange={(e) => setBookingPolicies(prev => ({ ...prev, loyaltyPointsPerDollar: parseInt(e.target.value) || 0 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.pointsPerSpentHint.replace('{sym}', sym)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loyaltyRedemptionRate">{t.adminSettings.pointsPerDiscount.replace('{sym}', sym)}</Label>
            <Input id="loyaltyRedemptionRate" type="number" min={1} value={bookingPolicies.loyaltyRedemptionRate ?? 100} onChange={(e) => setBookingPolicies(prev => ({ ...prev, loyaltyRedemptionRate: parseInt(e.target.value) || 100 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.pointsPerDiscountHint.replace('{sym}', sym)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverMilestoneBonus">{t.adminSettings.driverMilestoneBonus} ({sym})</Label>
            <Input id="driverMilestoneBonus" type="number" min={0} step={5} value={bookingPolicies.driverMilestoneBonus ?? 50} onChange={(e) => setBookingPolicies(prev => ({ ...prev, driverMilestoneBonus: parseFloat(e.target.value) || 0 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.driverMilestoneBonusHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverMilestoneRides">{t.adminSettings.ridesForMilestone}</Label>
            <Input id="driverMilestoneRides" type="number" min={1} value={bookingPolicies.driverMilestoneRides ?? 100} onChange={(e) => setBookingPolicies(prev => ({ ...prev, driverMilestoneRides: parseInt(e.target.value) || 100 }))} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.ridesForMilestoneHint}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}