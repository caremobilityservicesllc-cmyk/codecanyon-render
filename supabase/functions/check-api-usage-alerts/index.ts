import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_TIER_LIMITS = {
  google: {
    maps_load: 28000,
    directions: 40000,
    places: 11700,
    geocoding: 40000,
  },
  mapbox: {
    map_load: 50000,
    geocoding: 100000,
    directions: 100000,
  }
};

const ALERT_THRESHOLDS = [
  { percent: 90, priority: 'critical' },
  { percent: 80, priority: 'warning' },
  { percent: 70, priority: 'info' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get start of current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch current month usage
    const { data: usageData, error: usageError } = await supabase
      .from('map_api_usage')
      .select('provider, api_type, request_count')
      .gte('recorded_at', startOfMonth.toISOString().split('T')[0]);

    if (usageError) {
      throw usageError;
    }

    // Aggregate usage by provider and API type
    const usage: Record<string, Record<string, number>> = {
      google: { maps_load: 0, directions: 0, places: 0, geocoding: 0 },
      mapbox: { map_load: 0, geocoding: 0, directions: 0 },
    };

    usageData?.forEach((row) => {
      if (usage[row.provider] && row.api_type in usage[row.provider]) {
        usage[row.provider][row.api_type] += row.request_count;
      }
    });

    // Check thresholds and generate alerts
    const alerts: Array<{
      provider: string;
      apiType: string;
      current: number;
      limit: number;
      percent: number;
      priority: string;
    }> = [];

    // Check Google limits
    for (const [apiType, limit] of Object.entries(FREE_TIER_LIMITS.google)) {
      const current = usage.google[apiType] || 0;
      const percent = (current / limit) * 100;
      
      for (const threshold of ALERT_THRESHOLDS) {
        if (percent >= threshold.percent) {
          alerts.push({
            provider: 'Google Maps',
            apiType: apiType.replace('_', ' '),
            current,
            limit,
            percent: Math.round(percent),
            priority: threshold.priority,
          });
          break; // Only add highest priority alert
        }
      }
    }

    // Check Mapbox limits
    for (const [apiType, limit] of Object.entries(FREE_TIER_LIMITS.mapbox)) {
      const current = usage.mapbox[apiType] || 0;
      const percent = (current / limit) * 100;
      
      for (const threshold of ALERT_THRESHOLDS) {
        if (percent >= threshold.percent) {
          alerts.push({
            provider: 'Mapbox',
            apiType: apiType.replace('_', ' '),
            current,
            limit,
            percent: Math.round(percent),
            priority: threshold.priority,
          });
          break;
        }
      }
    }

    // Get all admin users to notify
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];

    // Create notifications for critical/warning alerts
    const notificationsToCreate = [];
    
    for (const alert of alerts) {
      if (alert.priority === 'critical' || alert.priority === 'warning') {
        // Check if we already sent a similar notification today
        const today = new Date().toISOString().split('T')[0];
        const notificationKey = `api_quota_${alert.provider}_${alert.apiType}_${alert.priority}`.toLowerCase().replace(/\s/g, '_');
        
        const { data: existingNotifications } = await supabase
          .from('notifications')
          .select('id')
          .ilike('title', `%${alert.provider}%`)
          .ilike('message', `%${alert.apiType}%`)
          .gte('created_at', today)
          .limit(1);

        if (!existingNotifications || existingNotifications.length === 0) {
          for (const userId of adminUserIds) {
            notificationsToCreate.push({
              user_id: userId,
              title: `${alert.priority === 'critical' ? '🚨' : '⚠️'} API Quota Alert: ${alert.provider}`,
              message: `${alert.apiType} usage at ${alert.percent}% (${alert.current.toLocaleString()}/${alert.limit.toLocaleString()}). Consider upgrading your plan or optimizing usage.`,
              type: 'promo' as const, // Using promo as closest match for system alerts
              channel: 'in_app' as const,
            });
          }
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (insertError) {
        console.error('Failed to create notifications:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        usage,
        notificationsSent: notificationsToCreate.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking API usage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
