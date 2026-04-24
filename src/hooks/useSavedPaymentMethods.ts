import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export type PaymentMethodType = 'card' | 'paypal' | 'bank';

export interface SavedPaymentMethod {
  id: string;
  user_id: string;
  payment_type: PaymentMethodType;
  // Card fields
  card_last_four: string | null;
  card_brand: string | null;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
  cardholder_name: string | null;
  // PayPal fields
  paypal_email: string | null;
  // Bank fields
  bank_name: string | null;
  account_holder_name: string | null;
  account_last_four: string | null;
  // Verification fields
  is_verified: boolean;
  verification_amount_cents: number | null;
  verification_attempts: number;
  verification_expires_at: string | null;
  verified_at: string | null;
  // Common fields
  is_default: boolean;
  created_at: string;
}

export interface NewCardPaymentMethod {
  payment_type: 'card';
  card_last_four: string;
  card_brand: string;
  card_expiry_month: number;
  card_expiry_year: number;
  cardholder_name: string;
  is_default?: boolean;
}

export interface NewPayPalPaymentMethod {
  payment_type: 'paypal';
  paypal_email: string;
  is_default?: boolean;
}

export interface NewBankPaymentMethod {
  payment_type: 'bank';
  bank_name: string;
  account_holder_name: string;
  account_last_four: string;
  is_default?: boolean;
}

export type NewPaymentMethod = NewCardPaymentMethod | NewPayPalPaymentMethod | NewBankPaymentMethod;

export function useSavedPaymentMethods() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPaymentMethods = async () => {
    if (!user) {
      setPaymentMethods([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentMethods((data as SavedPaymentMethod[]) || []);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, [user]);

  const addPaymentMethod = async (method: NewPaymentMethod) => {
    if (!user) {
      toast.error(t.paymentMethods.mustBeLoggedIn);
      return null;
    }

    setIsSaving(true);
    try {
      // If this is the default, unset other defaults first
      if (method.is_default) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const insertData: any = {
        user_id: user.id,
        payment_type: method.payment_type,
        is_default: method.is_default ?? paymentMethods.length === 0, // First method is default
      };

      // Add type-specific fields
      if (method.payment_type === 'card') {
        insertData.card_last_four = method.card_last_four;
        insertData.card_brand = method.card_brand;
        insertData.card_expiry_month = method.card_expiry_month;
        insertData.card_expiry_year = method.card_expiry_year;
        insertData.cardholder_name = method.cardholder_name;
      } else if (method.payment_type === 'paypal') {
        insertData.paypal_email = method.paypal_email;
      } else if (method.payment_type === 'bank') {
        insertData.bank_name = method.bank_name;
        insertData.account_holder_name = method.account_holder_name;
        insertData.account_last_four = method.account_last_four;
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const typeLabels = { card: t.paymentMethods.cardSaved, paypal: t.paymentMethods.paypalSaved, bank: t.paymentMethods.bankSaved };
      toast.success(typeLabels[method.payment_type]);
      await fetchPaymentMethods();
      return data as SavedPaymentMethod;
    } catch (err) {
      console.error('Error saving payment method:', err);
      toast.error(t.paymentMethods.failedToSave);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const deletePaymentMethod = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(t.paymentMethods.methodRemoved);
      await fetchPaymentMethods();
      return true;
    } catch (err) {
      console.error('Error deleting payment method:', err);
      toast.error(t.paymentMethods.failedToRemove);
      return false;
    }
  };

  const setDefaultPaymentMethod = async (id: string) => {
    if (!user) return false;

    // Check if the method is verified
    const method = paymentMethods.find(m => m.id === id);
    if (method && !method.is_verified) {
      toast.error(t.paymentMethods.verifyFirst);
      return false;
    }

    try {
      // Unset all defaults first
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(t.paymentMethods.defaultUpdated);
      await fetchPaymentMethods();
      return true;
    } catch (err) {
      console.error('Error setting default payment method:', err);
      toast.error(t.paymentMethods.failedToUpdateDefault);
      return false;
    }
  };

  const initiateVerification = async (id: string) => {
    if (!user) return null;

    // Generate a random amount between 1-99 cents
    const verificationAmount = Math.floor(Math.random() * 99) + 1;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({
          verification_amount_cents: verificationAmount,
          verification_expires_at: expiresAt.toISOString(),
          verification_attempts: 0,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Get method details for email
      const method = paymentMethods.find(m => m.id === id);
      const spm = (t as any).savedPaymentMethodLabels || {};
      let paymentMethodLabel = spm.yourPaymentMethod || 'your payment method';
      if (method) {
        if (method.payment_type === 'card') {
          paymentMethodLabel = (spm.cardEndingIn || '{brand} ending in {last4}')
            .replace('{brand}', method.card_brand || 'Card')
            .replace('{last4}', method.card_last_four || '');
        } else if (method.payment_type === 'bank') {
          paymentMethodLabel = (spm.bankAccountEndingIn || '{bank} account ending in {last4}')
            .replace('{bank}', method.bank_name || '')
            .replace('{last4}', method.account_last_four || '');
        } else if (method.payment_type === 'paypal') {
          paymentMethodLabel = `PayPal (${method.paypal_email})`;
        }
      }

      // Send verification pending email
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            type: 'pending',
            userId: user.id,
            paymentMethodId: id,
            email: user.email,
            paymentMethodLabel,
          },
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast.success(t.paymentVerification.verificationInitiated);
      await fetchPaymentMethods();
      return verificationAmount;
    } catch (err) {
      console.error('Error initiating verification:', err);
      toast.error(t.paymentVerification.failedToInitiate);
      return null;
    }
  };

  const verifyPaymentMethod = async (id: string, enteredAmount: number) => {
    if (!user) return false;

    const method = paymentMethods.find(m => m.id === id);
    if (!method) return false;

    // Check if expired
    if (method.verification_expires_at && new Date(method.verification_expires_at) < new Date()) {
      toast.error(t.paymentVerification.verificationExpired);
      return false;
    }

    // Check attempts
    if (method.verification_attempts >= 3) {
      toast.error(t.paymentVerification.maxAttemptsReached);
      return false;
    }

    const isCorrect = enteredAmount === method.verification_amount_cents;

    try {
      if (isCorrect) {
        const { error } = await supabase
          .from('payment_methods')
          .update({
            is_verified: true,
            verified_at: new Date().toISOString(),
            verification_amount_cents: null,
            verification_expires_at: null,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast.success(t.paymentVerification.verifiedSuccessfully);
        await fetchPaymentMethods();
        return true;
      } else {
        // Increment attempts
        const { error } = await supabase
          .from('payment_methods')
          .update({
            verification_attempts: (method.verification_attempts || 0) + 1,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        const attemptsLeft = 3 - ((method.verification_attempts || 0) + 1);
        toast.error(t.paymentVerification.incorrectAmount.replace('{remaining}', String(attemptsLeft)));
        await fetchPaymentMethods();
        return false;
      }
    } catch (err) {
      console.error('Error verifying payment method:', err);
      toast.error(t.paymentVerification.failedToVerify);
      return false;
    }
  };

  const getDefaultPaymentMethod = () => {
    return paymentMethods.find(m => m.is_default && m.is_verified) || null;
  };

  const getVerifiedMethods = () => {
    return paymentMethods.filter(m => m.is_verified);
  };

  const getPendingVerificationMethods = () => {
    return paymentMethods.filter(m => !m.is_verified);
  };

  return {
    paymentMethods,
    isLoading,
    isSaving,
    addPaymentMethod,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    getDefaultPaymentMethod,
    getVerifiedMethods,
    getPendingVerificationMethods,
    initiateVerification,
    verifyPaymentMethod,
    refetch: fetchPaymentMethods,
  };
}
