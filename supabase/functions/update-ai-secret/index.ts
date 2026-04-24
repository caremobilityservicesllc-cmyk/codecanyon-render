import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: roles } = await supabase.rpc('get_user_roles', { _user_id: user.id });
    if (!roles?.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { provider, apiKey, action } = await req.json();

    const allowedProviders = ['google_gemini', 'openai'];
    if (!allowedProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Allowed: google_gemini, openai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const settingKey = `ai_key_${provider}`;

    if (action === 'clear') {
      await adminClient.from('system_settings').delete().eq('key', settingKey);
      return new Response(
        JSON.stringify({ success: true, message: `${provider} API key removed.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from('system_settings')
      .upsert({
        key: settingKey,
        value: {
          apiKey: apiKey.trim(),
          lastUpdated: new Date().toISOString(),
          preview: apiKey.substring(0, 8) + '...',
          updatedBy: user.id,
        },
        category: 'secrets',
        description: `API key for ${provider}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (updateError) {
      console.error('Error storing AI key:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to store API key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`AI key for ${provider} updated by admin ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: `${provider} API key saved successfully.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error updating AI key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update AI key' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
