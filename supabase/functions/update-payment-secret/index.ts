import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    const { data: roles } = await supabase
      .rpc('get_user_roles', { _user_id: userId });

    if (!roles?.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keyName, keyValue, gateway } = await req.json();

    if (!ALLOWED_KEYS.includes(keyName)) {
      return new Response(
        JSON.stringify({ error: `Invalid key name. Allowed: ${ALLOWED_KEYS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settingKey = `${gateway}_secret_status`;
    const { error: settingsError } = await supabase
      .from('system_settings')
      .upsert({
        key: settingKey,
        value: {
          configured: true,
          keyName,
          preview: keyValue ? `${keyValue.substring(0, 8)}...` : null,
          updatedAt: new Date().toISOString(),
        },
        category: 'integrations',
        description: `${gateway} API key configuration status`,
      }, { onConflict: 'key' });

    if (settingsError) {
      throw new Error(`Failed to update settings: ${settingsError.message}`);
    }

    await supabase
      .from('settings_audit_log')
      .insert({
        user_id: userId,
        user_email: userData.user.email,
        setting_key: keyName,
        action: 'configure',
        new_value: { configured: true, preview: `${keyValue.substring(0, 4)}****` },
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${keyName} configured successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error updating payment secret:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update secret';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
