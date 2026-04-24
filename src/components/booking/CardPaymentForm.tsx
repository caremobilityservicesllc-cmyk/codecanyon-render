import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Lock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CardPaymentFormProps {
  onCardDetailsChange: (details: CardDetails) => void;
  cardDetails: CardDetails;
}

export interface CardDetails {
  cardNumber: string;
  expiryDate: string;
  cvc: string;
  cardholderName: string;
  isValid: boolean;
}

export const initialCardDetails: CardDetails = {
  cardNumber: '',
  expiryDate: '',
  cvc: '',
  cardholderName: '',
  isValid: false,
};

// Format card number with spaces every 4 digits
const formatCardNumber = (value: string): string => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(' ');
  } else {
    return v;
  }
};

// Format expiry date as MM/YY
const formatExpiryDate = (value: string): string => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4);
  }
  return v;
};

// Detect card type from number
const getCardType = (number: string): string | null => {
  const cleaned = number.replace(/\s/g, '');
  if (cleaned.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  return null;
};

// Luhn algorithm for card validation
const isValidCardNumber = (number: string): boolean => {
  const cleaned = number.replace(/\s/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

const isValidExpiry = (expiry: string): boolean => {
  const [month, year] = expiry.split('/');
  if (!month || !year) return false;
  
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt('20' + year, 10);
  
  if (monthNum < 1 || monthNum > 12) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (yearNum < currentYear) return false;
  if (yearNum === currentYear && monthNum < currentMonth) return false;
  
  return true;
};

export function CardPaymentForm({ onCardDetailsChange, cardDetails }: CardPaymentFormProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const { t } = useLanguage();
  
  const cardType = getCardType(cardDetails.cardNumber);
  const cardNumberValid = isValidCardNumber(cardDetails.cardNumber);
  const expiryValid = isValidExpiry(cardDetails.expiryDate);
  const cvcValid = cardDetails.cvc.length >= 3;
  const nameValid = cardDetails.cardholderName.trim().length > 0;
  
  const updateCardDetails = (updates: Partial<CardDetails>) => {
    const newDetails = { ...cardDetails, ...updates };
    const isValid = 
      isValidCardNumber(newDetails.cardNumber) && 
      isValidExpiry(newDetails.expiryDate) && 
      newDetails.cvc.length >= 3 &&
      newDetails.cardholderName.trim().length > 0;
    
    onCardDetailsChange({ ...newDetails, isValid });
  };
  
  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      updateCardDetails({ cardNumber: formatted });
    }
  };
  
  const handleExpiryChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      updateCardDetails({ expiryDate: formatExpiryDate(cleaned) });
    }
  };
  
  const handleCvcChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      updateCardDetails({ cvc: cleaned });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Lock className="h-4 w-4" />
        <span>{t.cardPayment.securedPayment}</span>
      </div>
      
      {/* Card Number */}
      <div className="space-y-2">
        <Label htmlFor="cardNumber">{t.cardPayment.cardNumber}</Label>
        <div className="relative">
          <Input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            placeholder="1234 5678 9012 3456"
            value={cardDetails.cardNumber}
            onChange={(e) => handleCardNumberChange(e.target.value)}
            onFocus={() => setFocused('cardNumber')}
            onBlur={() => setFocused(null)}
            className={cn(
              "pl-12 pr-12 transition-all",
              focused === 'cardNumber' && "ring-2 ring-primary ring-offset-1",
              cardDetails.cardNumber && !cardNumberValid && "border-destructive"
            )}
          />
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {cardType && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className={cn(
                "text-xs font-semibold uppercase px-1.5 py-0.5 rounded",
                cardType === 'visa' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                cardType === 'mastercard' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                cardType === 'amex' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
                cardType === 'discover' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}>
                {cardType}
              </span>
            </div>
          )}
          {cardNumberValid && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Check className="h-4 w-4 text-green-500" />
            </div>
          )}
        </div>
      </div>
      
      {/* Expiry and CVC Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiry">{t.cardPayment.expiryDate}</Label>
          <Input
            id="expiry"
            type="text"
            inputMode="numeric"
            placeholder="MM/YY"
            value={cardDetails.expiryDate}
            onChange={(e) => handleExpiryChange(e.target.value)}
            onFocus={() => setFocused('expiry')}
            onBlur={() => setFocused(null)}
            className={cn(
              "transition-all",
              focused === 'expiry' && "ring-2 ring-primary ring-offset-1",
              cardDetails.expiryDate.length === 5 && !expiryValid && "border-destructive"
            )}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cvc">{t.cardPayment.cvc}</Label>
          <Input
            id="cvc"
            type="text"
            inputMode="numeric"
            placeholder="123"
            value={cardDetails.cvc}
            onChange={(e) => handleCvcChange(e.target.value)}
            onFocus={() => setFocused('cvc')}
            onBlur={() => setFocused(null)}
            className={cn(
              "transition-all",
              focused === 'cvc' && "ring-2 ring-primary ring-offset-1"
            )}
          />
        </div>
      </div>
      
      {/* Cardholder Name */}
      <div className="space-y-2">
        <Label htmlFor="cardholderName">{t.cardPayment.cardholderName}</Label>
        <Input
          id="cardholderName"
          type="text"
          placeholder={(t as any).placeholders?.cardholderName || "John Smith"}
          value={cardDetails.cardholderName}
          onChange={(e) => updateCardDetails({ cardholderName: e.target.value })}
          onFocus={() => setFocused('cardholderName')}
          onBlur={() => setFocused(null)}
          className={cn(
            "transition-all",
            focused === 'cardholderName' && "ring-2 ring-primary ring-offset-1"
          )}
        />
      </div>
      
      {/* Visual Card Preview */}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 text-white shadow-lg">
        <div className="flex justify-between items-start mb-8">
          <div className="h-8 w-10 rounded bg-gradient-to-br from-yellow-400 to-yellow-500" />
          {cardType && (
            <span className="text-sm font-semibold uppercase opacity-80">{cardType}</span>
          )}
        </div>
        <div className="space-y-4">
          <p className="font-mono text-lg tracking-wider">
            {cardDetails.cardNumber || '•••• •••• •••• ••••'}
          </p>
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-xs opacity-60 uppercase">{t.cardPayment.cardholder}</p>
              <p className="font-medium">
                {cardDetails.cardholderName || 'YOUR NAME'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-60 uppercase">{t.cardPayment.expires}</p>
              <p className="font-medium">
                {cardDetails.expiryDate || 'MM/YY'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Test Card Hint */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>{t.cardPayment.testMode}</strong> {t.cardPayment.testCardHint.replace('{cardNumber}', '4242 4242 4242 4242')}
        </p>
      </div>
    </div>
  );
}
