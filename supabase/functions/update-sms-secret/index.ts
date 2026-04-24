import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map of allowed secret names per provider
const ALLOWED_SECRETS: Record<string, string[]> = {
  twilio: ['SMS_TWILIO_ACCOUNT_SID', 'SMS_TWILIO_AUTH_TOKEN', 'SMS_TWILIO_FROM_NUMBER'],
  nexmo: ['SMS_NEXMO_API_KEY', 'SMS_NEXMO_API_SECRET', 'SMS_NEXMO_FROM_NUMBER'],
  messagebird: ['SMS_MESSAGEBIRD_API_KEY', 'SMS_MESSAGEBIRD_ORIGINATOR'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify admin
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = userData.user.id;
    const { data: roles } = await supabase.rpc('get_user_roles', { _user_id: userId });
    if (!roles?.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { provider, secrets } = await req.json();

    // Validate provider
    if (!provider || !ALLOWED_SECRETS[provider]) {
      return new Response(
        JSON.stringify({ error: 'Invalid SMS provider' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate all secret names are allowed for this provider
    const allowed = ALLOWED_SECRETS[provider];
    const secretEntries = Object.entries(secrets || {}) as [string, string][];
    for (const [name] of secretEntries) {
      if (!allowed.includes(name)) {
        return new Response(
          JSON.stringify({ error: `Secret ${name} is not allowed for provider ${provider}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Build a preview object (first 4 chars of each value)
    const configuredSecrets: Record<string, { configured: boolean; preview: string }> = {};
    for (const [name, value] of secretEntries) {
      if (value && typeof value === 'string' && value.length > 0) {
        configuredSecrets[name] = {
          configured: true,
          preview: value.substring(0, 4) + '••••',
        };
      }
    }

    // Store metadata in system_settings (not the actual secrets)
    const { error: updateError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'sms_secrets_config',
        value: {
          provider,
          secrets: configuredSecrets,
          lastUpdated: new Date().toISOString(),
          updatedBy: userId,
        },
        category: 'secrets',
        description: 'SMS provider credentials configuration status',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (updateError) {
      console.error('Error updating SMS secret config:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update configuration' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`SMS secrets for ${provider} updated by admin ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `SMS credentials for ${provider} saved. Add the actual secret values via Lovable Cloud secrets for production use.`,
        configuredSecrets,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error updating SMS secret:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update SMS credentials' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
