import { CreditCard, Star, Building2, Wallet, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSavedPaymentMethods } from '@/hooks/useSavedPaymentMethods';
import { useLanguage } from '@/contexts/LanguageContext';

const paymentTypeIcons: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  paypal: <Wallet className="h-4 w-4" />,
  bank: <Building2 className="h-4 w-4" />,
};

function getMethodLabel(method: { payment_type: string; card_brand?: string | null; card_last_four?: string | null; paypal_email?: string | null; bank_name?: string | null; account_last_four?: string | null }) {
  if (method.payment_type === 'card') {
    return `${method.card_brand || 'Card'} •••• ${method.card_last_four}`;
  }
  if (method.payment_type === 'paypal') {
    return `PayPal (${method.paypal_email})`; // PayPal is a brand name
  }
  if (method.payment_type === 'bank') {
    return `${method.bank_name} •••• ${method.account_last_four}`;
  }
  return 'Unknown method';
}

export function DefaultPaymentMethodSelector() {
  const { t } = useLanguage();
  const dp = (t as any).defaultPaymentMethod || {};
  const {
    paymentMethods,
    isLoading,
    setDefaultPaymentMethod,
    getDefaultPaymentMethod,
    getVerifiedMethods,
  } = useSavedPaymentMethods();

  const verifiedMethods = getVerifiedMethods();
  const defaultMethod = getDefaultPaymentMethod();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {dp.title || 'Default Payment Method'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (verifiedMethods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {dp.title || 'Default Payment Method'}
          </CardTitle>
          <CardDescription>
            {dp.emptyDescription || 'Add and verify a payment method above to set it as your default for bookings.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          {dp.title || 'Default Payment Method'}
        </CardTitle>
        <CardDescription>
          {dp.description || 'Choose which verified payment method is used by default during checkout'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={defaultMethod?.id || ''}
          onValueChange={(id) => setDefaultPaymentMethod(id)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={dp.selectPlaceholder || 'Select a default payment method'} />
          </SelectTrigger>
          <SelectContent>
            {verifiedMethods.map((method) => (
              <SelectItem key={method.id} value={method.id}>
                <span className="flex items-center gap-2">
                  {paymentTypeIcons[method.payment_type]}
                  {getMethodLabel(method)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}