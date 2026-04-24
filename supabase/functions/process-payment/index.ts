import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PaymentRequest {
  paymentMethod: 'card' | 'paypal' | 'bank';
  amount: number;
  currency: string;
  bookingReference: string;
  customerEmail: string;
  cardDetails?: {
    cardNumber: string;
    expiryDate: string;
    cvc: string;
    cardholderName: string;
  };
  returnUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      paymentMethod, 
      amount, 
      currency, 
      bookingReference, 
      customerEmail,
      cardDetails,
      returnUrl 
    }: PaymentRequest = await req.json();

    console.log(`Processing ${paymentMethod} payment for booking ${bookingReference}: ${amount} ${currency}`);

    // Fetch payment gateway settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['stripe_settings', 'paypal_settings', 'bank_settings']);

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => { settingsMap[s.key] = s.value; });

    let result: any;

    switch (paymentMethod) {
      case 'card': {
        result = await processStripePayment(
          settingsMap['stripe_settings'],
          amount,
          currency,
          bookingReference,
          customerEmail,
          returnUrl
        );
        break;
      }

      case 'paypal': {
        result = await processPayPalPayment(
          settingsMap['paypal_settings'],
          amount,
          currency,
          bookingReference,
          customerEmail,
          returnUrl
        );
        break;
      }

      case 'bank': {
        result = await processBankTransfer(
          settingsMap['bank_settings'],
          bookingReference
        );
        break;
      }

      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Payment processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ============ STRIPE PAYMENT (Checkout Session) ============
async function processStripePayment(
  stripeSettings: any,
  amount: number,
  currency: string,
  bookingReference: string,
  customerEmail: string,
  returnUrl?: string
) {
  if (!stripeSettings?.enabled) {
    throw new Error('Stripe is not configured');
  }

  const isTestMode = stripeSettings.mode === 'test';
  const secretKey = stripeSettings.secretKey;

  // If no real secret key or demo mode, simulate payment
  if (!secretKey || secretKey === 'demo' || secretKey.length < 20) {
    console.log(`Simulating Stripe payment in ${isTestMode ? 'test' : 'live'} mode (demo/no key)`);
    return {
      success: true,
      transactionId: `pi_demo_${Date.now()}`,
      status: 'succeeded',
      message: `Payment processed successfully (${isTestMode ? 'Test' : 'Demo'} Mode)`,
      gateway: 'stripe',
      mode: isTestMode ? 'test' : 'live',
      isDemo: true,
    };
  }

  // Real Stripe Checkout Session
  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    const amountInCents = Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Ride Booking ${bookingReference}`,
            description: `Payment for booking ${bookingReference}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      metadata: {
        booking_reference: bookingReference,
        customer_email: customerEmail,
        mode: isTestMode ? 'test' : 'live',
      },
      success_url: returnUrl ? `${returnUrl}?payment=success` : undefined,
      cancel_url: returnUrl ? `${returnUrl}?payment=cancelled` : undefined,
    });

    console.log(`Created Stripe Checkout Session: ${session.id} for booking ${bookingReference}`);

    return {
      success: true,
      redirectUrl: session.url,
      sessionId: session.id,
      status: 'pending_redirect',
      message: `Redirect to Stripe Checkout ${isTestMode ? '(Test)' : ''} to complete payment`,
      gateway: 'stripe',
      mode: isTestMode ? 'test' : 'live',
      isDemo: false,
    };
  } catch (stripeError: any) {
    console.error('Stripe API error:', stripeError);
    throw new Error(stripeError.message || 'Stripe payment failed');
  }
}

// ============ PAYPAL PAYMENT ============
async function processPayPalPayment(
  paypalSettings: any,
  amount: number,
  currency: string,
  bookingReference: string,
  customerEmail: string,
  returnUrl?: string
) {
  if (!paypalSettings?.enabled) {
    throw new Error('PayPal is not configured');
  }

  const isTestMode = paypalSettings.mode === 'test';
  const clientId = paypalSettings.clientId;
  const clientSecret = paypalSettings.secretKey;

  // If no real credentials, simulate payment
  const isInvalidCredentials = !clientId || !clientSecret || 
    clientId === 'demo' || clientSecret === 'demo' ||
    clientId.length < 20 || clientSecret.length < 20 ||
    clientId.startsWith('sandbox_demo') || clientSecret.startsWith('sandbox_demo');
  
  if (isInvalidCredentials) {
    console.log(`Simulating PayPal payment in ${isTestMode ? 'test' : 'live'} mode (demo/no credentials)`);
    return {
      success: true,
      transactionId: `PAYPAL_DEMO_${Date.now()}`,
      status: 'succeeded',
      message: `Payment processed successfully (${isTestMode ? 'Sandbox' : 'Demo'} Mode)`,
      gateway: 'paypal',
      mode: isTestMode ? 'test' : 'live',
      isDemo: true,
    };
  }

  // Real PayPal API integration
  const baseUrl = isTestMode
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  // 1. Get access token
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!authResponse.ok) {
    const errText = await authResponse.text();
    console.error('PayPal auth error:', errText);
    throw new Error('Failed to authenticate with PayPal');
  }

  const authData = await authResponse.json();
  const accessToken = authData.access_token;

  // 2. Create order
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: bookingReference,
        description: `Booking ${bookingReference}`,
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2),
        },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Premium Ride Service',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: returnUrl || `${Deno.env.get('SUPABASE_URL')}/`,
            cancel_url: returnUrl || `${Deno.env.get('SUPABASE_URL')}/`,
          },
        },
      },
    }),
  });

  if (!orderResponse.ok) {
    const errText = await orderResponse.text();
    console.error('PayPal order creation error:', errText);
    throw new Error('Failed to create PayPal order');
  }

  const orderData = await orderResponse.json();
  console.log(`Created PayPal order: ${orderData.id} for booking ${bookingReference}`);

  // Find the approval URL
  const approvalLink = orderData.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');

  if (!approvalLink?.href) {
    throw new Error('PayPal did not return an approval URL');
  }

  return {
    success: true,
    redirectUrl: approvalLink.href,
    orderId: orderData.id,
    status: 'pending_redirect',
    message: `Redirect to PayPal ${isTestMode ? '(Sandbox)' : ''} to complete payment`,
    gateway: 'paypal',
    mode: isTestMode ? 'test' : 'live',
    isDemo: false,
  };
}

// ============ BANK TRANSFER ============
async function processBankTransfer(
  bankSettings: any,
  bookingReference: string
) {
  return {
    success: true,
    transactionId: `BANK_${Date.now()}`,
    status: 'pending_verification',
    bankDetails: bankSettings ? {
      bankName: bankSettings.bankName || '',
      accountName: bankSettings.accountName || '',
      iban: bankSettings.iban || '',
      swiftCode: bankSettings.swiftCode || '',
      accountNumber: bankSettings.accountNumber || '',
      routingNumber: bankSettings.routingNumber || '',
      reference: bookingReference,
      instructions: bankSettings.instructions || 'Please include your booking reference in the payment description',
    } : {
      bankName: 'Business Account',
      accountName: 'Company Ltd',
      iban: '',
      swiftCode: 'RFXXUSXX',
      accountNumber: '****4567',
      routingNumber: '****8901',
      reference: bookingReference,
    },
    message: 'Please transfer the amount using the IBAN and booking reference provided',
    gateway: 'bank_transfer',
  };
}

