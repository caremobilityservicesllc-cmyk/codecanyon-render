import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push crypto utilities
async function generateVapidAuthHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = Uint8Array.from(atob(privateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('Missing VAPID configuration');
      return new Response(
        JSON.stringify({ error: 'Push notifications not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending push notification to user ${userId}: ${title}`);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data || {},
    });

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      // Skip browser-only notifications (these use the Notification API directly)
      if (subscription.endpoint.startsWith('browser-')) {
        console.log('Skipping browser-only subscription');
        continue;
      }

      try {
        const url = new URL(subscription.endpoint);
        const audience = `${url.protocol}//${url.host}`;

        const jwt = await generateVapidAuthHeader(
          audience,
          vapidSubject,
          vapidPublicKey,
          vapidPrivateKey
        );

        const response = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
          },
          body: payload,
        });

        if (response.ok) {
          sent++;
          console.log(`Push sent successfully to endpoint`);
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          console.log('Subscription expired, removing');
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
          failed++;
        } else {
          console.error(`Push failed with status ${response.status}`);
          failed++;
        }
      } catch (err) {
        console.error('Error sending push:', err);
        failed++;
      }
    }

    // Also create an in-app notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message: body,
        type: 'booking_confirmed', // Using existing enum value
        channel: 'push',
      });

    if (notifError) {
      console.error('Error creating notification record:', notifError);
    }

    console.log(`Push notifications complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
