import { useState } from 'react';
import { CreditCard, Plus, Trash2, Check, Star, Loader2, ShieldCheck, Lock, Building2, Wallet, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSavedPaymentMethods, NewPaymentMethod, PaymentMethodType, SavedPaymentMethod } from '@/hooks/useSavedPaymentMethods';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardPaymentForm, CardDetails, initialCardDetails } from '@/components/booking/CardPaymentForm';
import { Badge } from '@/components/ui/badge';

const cardBrandIcons: Record<string, { color: string; bgColor: string }> = {
  visa: { color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/50' },
  mastercard: { color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/50' },
  amex: { color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/50' },
  discover: { color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/50' },
  unknown: { color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-900/50' },
};

const cardBrandLabels: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  unknown: 'Card',
};

export function SavedPaymentMethods() {
  const { t } = useLanguage();
  const sp = (t as any).savedPaymentMethods || {};
  const { 
    paymentMethods, 
    isLoading, 
    isSaving, 
    addPaymentMethod, 
    deletePaymentMethod, 
    setDefaultPaymentMethod,
    initiateVerification,
    verifyPaymentMethod,
  } = useSavedPaymentMethods();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentMethodType>('card');
  const [verificationAmount, setVerificationAmount] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Card form state
  const [cardDetails, setCardDetails] = useState<CardDetails>(initialCardDetails);
  
  // PayPal form state
  const [paypalEmail, setPaypalEmail] = useState('');
  
  // Bank form state
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
  });

  const resetForms = () => {
    setCardDetails(initialCardDetails);
    setPaypalEmail('');
    setBankForm({ bankName: '', accountHolderName: '', accountNumber: '' });
    setActiveTab('card');
  };

  const handleAddPaymentMethod = async () => {
    let method: NewPaymentMethod | null = null;

    if (activeTab === 'card' && cardDetails.isValid) {
      const cardNumber = cardDetails.cardNumber.replace(/\s/g, '');
      const [month, year] = cardDetails.expiryDate.split('/');
      
      let brand = 'unknown';
      if (cardNumber.startsWith('4')) brand = 'visa';
      else if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) brand = 'mastercard';
      else if (/^3[47]/.test(cardNumber)) brand = 'amex';
      else if (/^6(?:011|5)/.test(cardNumber)) brand = 'discover';

      method = {
        payment_type: 'card',
        card_last_four: cardNumber.slice(-4),
        card_brand: brand,
        card_expiry_month: parseInt(month, 10),
        card_expiry_year: 2000 + parseInt(year, 10),
        cardholder_name: cardDetails.cardholderName,
      };
    } else if (activeTab === 'paypal' && paypalEmail) {
      method = {
        payment_type: 'paypal',
        paypal_email: paypalEmail,
      };
    } else if (activeTab === 'bank' && bankForm.bankName && bankForm.accountHolderName && bankForm.accountNumber) {
      method = {
        payment_type: 'bank',
        bank_name: bankForm.bankName,
        account_holder_name: bankForm.accountHolderName,
        account_last_four: bankForm.accountNumber.slice(-4),
      };
    }

    if (method) {
      const result = await addPaymentMethod(method);
      if (result) {
        setAddDialogOpen(false);
        resetForms();
        // Auto-initiate verification for the new method
        if (result.id) {
          await initiateVerification(result.id);
        }
      }
    }
  };

  const isFormValid = () => {
    if (activeTab === 'card') return cardDetails.isValid;
    if (activeTab === 'paypal') return paypalEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail);
    if (activeTab === 'bank') return bankForm.bankName && bankForm.accountHolderName && bankForm.accountNumber.length >= 4;
    return false;
  };

  const handleDeleteClick = (id: string) => {
    setSelectedMethodId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedMethodId) {
      await deletePaymentMethod(selectedMethodId);
      setDeleteDialogOpen(false);
      setSelectedMethodId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultPaymentMethod(id);
  };

  const handleVerifyClick = (id: string) => {
    setSelectedMethodId(id);
    setVerificationAmount('');
    setVerifyDialogOpen(true);
  };

  const handleResendVerification = async (id: string) => {
    await initiateVerification(id);
  };

  const handleConfirmVerification = async () => {
    if (!selectedMethodId || !verificationAmount) return;
    
    setIsVerifying(true);
    const amount = parseInt(verificationAmount, 10);
    const success = await verifyPaymentMethod(selectedMethodId, amount);
    setIsVerifying(false);
    
    if (success) {
      setVerifyDialogOpen(false);
      setSelectedMethodId(null);
      setVerificationAmount('');
    }
  };

  const getVerificationStatus = (method: SavedPaymentMethod) => {
    if (method.is_verified) return 'verified';
    if (method.verification_expires_at && new Date(method.verification_expires_at) < new Date()) return 'expired';
    if (method.verification_amount_cents) return 'pending';
    return 'unverified';
  };

  const renderPaymentMethodIcon = (method: SavedPaymentMethod) => {
    if (method.payment_type === 'paypal') {
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50">
          <Wallet className="h-6 w-6 text-blue-600" />
        </div>
      );
    }
    if (method.payment_type === 'bank') {
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/50">
          <Building2 className="h-6 w-6 text-green-600" />
        </div>
      );
    }
    const brandStyle = cardBrandIcons[method.card_brand || 'unknown'];
    return (
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", brandStyle.bgColor)}>
        <CreditCard className={cn("h-6 w-6", brandStyle.color)} />
      </div>
    );
  };

  const renderVerificationBadge = (method: SavedPaymentMethod) => {
    const status = getVerificationStatus(method);
    
    if (status === 'verified') {
      return (
        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          {sp.verified || 'Verified'}
        </Badge>
      );
    }
    if (status === 'pending') {
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          {sp.pendingVerification || 'Pending Verification'}
        </Badge>
      );
    }
    if (status === 'expired') {
      return (
        <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          {sp.expired || 'Expired'}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        {sp.unverified || 'Unverified'}
      </Badge>
    );
  };

  const renderPaymentMethodDetails = (method: SavedPaymentMethod) => {
    const verificationBadge = renderVerificationBadge(method);
    
    if (method.payment_type === 'paypal') {
      return (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{sp.paypal || 'PayPal'}</span>
            {method.is_default && method.is_verified && (
              <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent hover:bg-accent/20">
                <Star className="h-3 w-3 fill-current" />
                {sp.default || 'Default'}
              </Badge>
            )}
            {verificationBadge}
          </div>
          <p className="text-sm text-muted-foreground">{method.paypal_email}</p>
        </div>
      );
    }
    if (method.payment_type === 'bank') {
      return (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{method.bank_name}</span>
            <span className="font-mono text-sm text-muted-foreground">•••• {method.account_last_four}</span>
            {method.is_default && method.is_verified && (
              <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent hover:bg-accent/20">
                <Star className="h-3 w-3 fill-current" />
                {sp.default || 'Default'}
              </Badge>
            )}
            {verificationBadge}
          </div>
          <p className="text-sm text-muted-foreground">{method.account_holder_name}</p>
        </div>
      );
    }
    const brandLabel = cardBrandLabels[method.card_brand || 'unknown'];
    return (
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">{brandLabel}</span>
          <span className="font-mono text-sm text-muted-foreground">•••• {method.card_last_four}</span>
          {method.is_default && method.is_verified && (
            <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent hover:bg-accent/20">
              <Star className="h-3 w-3 fill-current" />
              {sp.default || 'Default'}
            </Badge>
          )}
          {verificationBadge}
        </div>
        <p className="text-sm text-muted-foreground">
          {method.cardholder_name} • {sp.expires || 'Expires'} {method.card_expiry_month?.toString().padStart(2, '0')}/{method.card_expiry_year?.toString().slice(-2)}
        </p>
      </div>
    );
  };

  const addPaymentDialogContent = (
    <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {sp.addPaymentMethod || 'Add Payment Method'}
        </DialogTitle>
        <DialogDescription>
          {sp.choosePreferred || 'Choose your preferred payment method'}
        </DialogDescription>
      </DialogHeader>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PaymentMethodType)} className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="card" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {sp.card || 'Card'}
          </TabsTrigger>
          <TabsTrigger value="paypal" className="gap-2">
            <Wallet className="h-4 w-4" />
            {sp.paypal || 'PayPal'}
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Building2 className="h-4 w-4" />
            {sp.bank || 'Bank'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="card" className="mt-4">
          <CardPaymentForm 
            cardDetails={cardDetails}
            onCardDetailsChange={setCardDetails}
          />
        </TabsContent>
        
        <TabsContent value="paypal" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">{sp.payPalAccount || 'PayPal Account'}</h4>
                <p className="text-xs text-muted-foreground">{sp.linkPayPal || 'Link your PayPal for easy payments'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paypal-email">{sp.payPalEmail || 'PayPal Email'}</Label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="your@email.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="bank" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">{sp.bankAccount || 'Bank Account'}</h4>
                <p className="text-xs text-muted-foreground">{sp.addBankForTransfers || 'Add your bank for direct transfers'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bank-name">{sp.bankName || 'Bank Name'}</Label>
                <Input
                  id="bank-name"
                  placeholder={sp.bankNamePlaceholder || 'e.g. Chase, Bank of America'}
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm(prev => ({ ...prev, bankName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-holder">{sp.accountHolderName || 'Account Holder Name'}</Label>
                <Input
                  id="account-holder"
                  placeholder={sp.nameOnAccount || 'Name on the account'}
                  value={bankForm.accountHolderName}
                  onChange={(e) => setBankForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-number">{sp.accountNumber || 'Account Number'}</Label>
                <Input
                  id="account-number"
                  placeholder={sp.yourAccountNumber || 'Your account number'}
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm(prev => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))}
                  maxLength={17}
                />
                <p className="text-xs text-muted-foreground">{sp.last4DigitsStored || 'Only the last 4 digits will be stored for security'}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {sp.secureEncryption || 'Secure encryption'}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForms(); }}>
            {t.common.cancel}
          </Button>
          <Button 
            onClick={handleAddPaymentMethod} 
            disabled={!isFormValid() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {sp.saving || 'Saving...'}
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {t.common.save}
              </>
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {sp.title || 'Payment Methods'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
              {sp.title || 'Payment Methods'}
            </CardTitle>
            <CardDescription>
              {sp.description || 'Manage your saved payment methods'}
            </CardDescription>
          </div>
          {paymentMethods.length > 0 && (
            <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForms(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {sp.addMethod || 'Add Method'}
                </Button>
              </DialogTrigger>
              {addPaymentDialogContent}
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {sp.noSavedMethods || 'No saved payment methods'}
              </h3>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                {sp.addMethodToSpeedUp || 'Add a payment method to speed up your checkout experience'}
              </p>
              <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForms(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {sp.addPaymentMethod || 'Add Payment Method'}
                  </Button>
                </DialogTrigger>
                {addPaymentDialogContent}
              </Dialog>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                {sp.bankLevelEncryption || 'Your data is protected with bank-level encryption'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={cn(
                  "group flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-sm",
                  method.is_default 
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" 
                    : "border-border hover:border-border/80"
                )}
              >
                <div className="flex items-center gap-4">
                  {renderPaymentMethodIcon(method)}
                  {renderPaymentMethodDetails(method)}
                </div>
                <div className="flex items-center gap-1">
                  {!method.is_verified && (
                    <>
                      {getVerificationStatus(method) === 'pending' ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleVerifyClick(method.id)}
                          className="gap-1"
                        >
                           <ShieldCheck className="h-4 w-4" />
                          {sp.verify || 'Verify'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendVerification(method.id)}
                          className="gap-1"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {getVerificationStatus(method) === 'expired' ? (sp.resend || 'Resend') : (sp.start || 'Start')} {sp.verification || 'Verification'}
                        </Button>
                      )}
                    </>
                  )}
                  <div className={cn("flex items-center gap-1", method.is_verified ? "opacity-0 group-hover:opacity-100 transition-opacity" : "")}>
                    {!method.is_default && method.is_verified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        {sp.setDefault || 'Set Default'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(method.id)}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{sp.removePaymentMethod || 'Remove Payment Method'}</AlertDialogTitle>
            <AlertDialogDescription>
              {sp.removeConfirmation || 'Are you sure you want to remove this payment method? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {sp.remove || 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {sp.verifyPaymentMethod || 'Verify Payment Method'}
            </DialogTitle>
            <DialogDescription>
              {sp.verifyDescription || "We've made a small test charge to your account. Enter the exact amount in cents to verify ownership."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                   <p className="text-sm font-medium">{sp.checkStatement || 'Check your statement'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sp.checkStatementDesc || 'Look for a small charge between $0.01 and $0.99. Enter the amount below to confirm.'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="verification-amount">{sp.verificationAmountLabel || 'Verification Amount (cents)'}</Label>
              <div className="relative">
                <span className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-muted-foreground">¢</span>
                <Input
                  id="verification-amount"
                  type="number"
                  min="1"
                  max="99"
                  placeholder="e.g., 42"
                  value={verificationAmount}
                  onChange={(e) => setVerificationAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {sp.attemptsNote || 'You have 3 attempts. The test charge will be refunded automatically.'}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={handleConfirmVerification}
              disabled={!verificationAmount || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {sp.verifying || 'Verifying...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t.common.confirm}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
