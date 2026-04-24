import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Clear action
    if (body.action === "clear") {
      await supabase
        .from("system_settings")
        .upsert({
          key: "email_provider",
          value: { provider: "resend", configured: false, preview: "", fromEmail: "", fromName: "" },
          category: "integrations",
          description: "Email delivery provider configuration",
        }, { onConflict: "key" });

      return new Response(JSON.stringify({ message: "Email provider settings cleared" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider, apiKey, fromEmail, fromName, smtpHost, smtpPort } = body;

    if (!provider || !apiKey) {
      return new Response(JSON.stringify({ error: "Provider and API key are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preview = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);

    const settingsValue: Record<string, unknown> = {
      provider,
      configured: true,
      preview,
      fromEmail: fromEmail || "",
      fromName: fromName || "",
      apiKey,
    };

    if (provider === "smtp") {
      settingsValue.smtpHost = smtpHost || "";
      settingsValue.smtpPort = smtpPort || 587;
    }

    await supabase
      .from("system_settings")
      .upsert({
        key: "email_provider",
        value: settingsValue,
        category: "integrations",
        description: "Email delivery provider configuration",
      }, { onConflict: "key" });

    await supabase.from("settings_audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      setting_key: "email_provider",
      action: "update",
      new_value: { provider, fromEmail, fromName, configured: true },
    });

    return new Response(
      JSON.stringify({ message: `${provider === 'resend' ? 'Resend' : provider === 'sendgrid' ? 'SendGrid' : 'SMTP'} email provider configured successfully` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error updating email provider:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
