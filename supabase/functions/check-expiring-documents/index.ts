import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExpiringItem {
  type: 'license' | 'document';
  driverId: string;
  driverName: string;
  documentType?: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const warningDays = [30, 14, 7, 3, 1]; // Days before expiry to send warnings
    
    const expiringItems: ExpiringItem[] = [];

    // Check driver licenses expiring soon
    for (const days of warningDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: expiringLicenses, error: licenseError } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, license_expiry, email')
        .eq('is_active', true)
        .eq('license_expiry', targetDateStr);

      if (licenseError) {
        console.error('Error checking licenses:', licenseError);
        continue;
      }

      for (const driver of expiringLicenses || []) {
        expiringItems.push({
          type: 'license',
          driverId: driver.id,
          driverName: `${driver.first_name} ${driver.last_name}`,
          expiryDate: driver.license_expiry,
          daysUntilExpiry: days,
        });
      }
    }

    // Check driver documents expiring soon
    for (const days of warningDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: expiringDocs, error: docError } = await supabase
        .from('driver_documents')
        .select(`
          id,
          document_type,
          expires_at,
          driver_id,
          drivers (
            first_name,
            last_name
          )
        `)
        .eq('status', 'approved')
        .eq('expires_at', targetDateStr);

      if (docError) {
        console.error('Error checking documents:', docError);
        continue;
      }

      for (const doc of expiringDocs || []) {
        const driver = doc.drivers as any;
        if (driver) {
          expiringItems.push({
            type: 'document',
            driverId: doc.driver_id,
            driverName: `${driver.first_name} ${driver.last_name}`,
            documentType: doc.document_type,
            expiryDate: doc.expires_at,
            daysUntilExpiry: days,
          });
        }
      }
    }

    // Also check for already expired items (negative days)
    const { data: expiredLicenses } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, license_expiry')
      .eq('is_active', true)
      .lt('license_expiry', today.toISOString().split('T')[0]);

    for (const driver of expiredLicenses || []) {
      const expiryDate = new Date(driver.license_expiry);
      const daysExpired = Math.ceil((today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      expiringItems.push({
        type: 'license',
        driverId: driver.id,
        driverName: `${driver.first_name} ${driver.last_name}`,
        expiryDate: driver.license_expiry,
        daysUntilExpiry: -daysExpired,
      });
    }

    // Get all admin users to notify
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    // Create notifications for each expiring item
    const notifications = [];
    for (const item of expiringItems) {
      for (const admin of admins || []) {
        let title: string;
        let message: string;
        
        if (item.daysUntilExpiry < 0) {
          // Already expired
          if (item.type === 'license') {
            title = '🚨 Driver License Expired';
            message = `${item.driverName}'s driver license expired ${Math.abs(item.daysUntilExpiry)} days ago on ${item.expiryDate}. Immediate action required.`;
          } else {
            title = '🚨 Document Expired';
            message = `${item.driverName}'s ${formatDocType(item.documentType || '')} expired ${Math.abs(item.daysUntilExpiry)} days ago. Immediate action required.`;
          }
        } else if (item.daysUntilExpiry <= 3) {
          // Critical - expires in 3 days or less
          if (item.type === 'license') {
            title = '⚠️ License Expiring Soon';
            message = `${item.driverName}'s driver license expires in ${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'} on ${item.expiryDate}.`;
          } else {
            title = '⚠️ Document Expiring Soon';
            message = `${item.driverName}'s ${formatDocType(item.documentType || '')} expires in ${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'}.`;
          }
        } else {
          // Warning
          if (item.type === 'license') {
            title = '📋 License Expiry Reminder';
            message = `${item.driverName}'s driver license will expire in ${item.daysUntilExpiry} days on ${item.expiryDate}.`;
          } else {
            title = '📋 Document Expiry Reminder';
            message = `${item.driverName}'s ${formatDocType(item.documentType || '')} will expire in ${item.daysUntilExpiry} days.`;
          }
        }

        // Check if we already sent this notification today
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', admin.user_id)
          .eq('title', title)
          .gte('created_at', todayStart.toISOString())
          .single();

        if (!existingNotification) {
          notifications.push({
            user_id: admin.user_id,
            title,
            message,
            type: 'reminder' as const,
            channel: 'in_app' as const,
          });
        }
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }
    }

    // Send email notifications to admins for critical items (3 days or less)
    const criticalItems = expiringItems.filter(item => item.daysUntilExpiry <= 3);
    
    if (criticalItems.length > 0) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      
      if (resendApiKey) {
        // Get admin emails
        for (const admin of admins || []) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', admin.user_id)
            .single();

          if (profile?.email) {
            const emailHtml = generateExpiryEmailHtml(criticalItems, profile.full_name || 'Admin');
            
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'RideFlow <noreply@rideflow.app>',
                  to: [profile.email],
                  subject: `🚨 ${criticalItems.length} Driver Document${criticalItems.length > 1 ? 's' : ''} Expiring Soon`,
                  html: emailHtml,
                }),
              });
            } catch (emailError) {
              console.error('Error sending email:', emailError);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: {
          expiringItems: expiringItems.length,
          notificationsSent: notifications.length,
          criticalItems: criticalItems.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-expiring-documents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatDocType(docType: string): string {
  const mapping: Record<string, string> = {
    'license_front': 'Driver License (Front)',
    'license_back': 'Driver License (Back)',
    'insurance': 'Insurance Certificate',
    'vehicle_registration': 'Vehicle Registration',
    'background_check': 'Background Check',
    'medical_certificate': 'Medical Certificate',
  };
  return mapping[docType] || docType;
}

function generateExpiryEmailHtml(items: ExpiringItem[], adminName: string): string {
  const expiredItems = items.filter(i => i.daysUntilExpiry < 0);
  const expiringItems = items.filter(i => i.daysUntilExpiry >= 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document Expiry Alert</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <tr>
          <td style="padding: 40px 30px; background-color: #121212; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚨 Document Expiry Alert</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
              Hi ${adminName},
            </p>
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
              The following driver documents require your attention:
            </p>
            
            ${expiredItems.length > 0 ? `
              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
                <h3 style="color: #dc2626; margin: 0 0 10px 0;">❌ Already Expired</h3>
                ${expiredItems.map(item => `
                  <p style="color: #991b1b; margin: 5px 0;">
                    <strong>${item.driverName}</strong> - ${item.type === 'license' ? 'Driver License' : formatDocType(item.documentType || '')}
                    <br><span style="font-size: 14px;">Expired ${Math.abs(item.daysUntilExpiry)} days ago</span>
                  </p>
                `).join('')}
              </div>
            ` : ''}
            
            ${expiringItems.length > 0 ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
                <h3 style="color: #b45309; margin: 0 0 10px 0;">⚠️ Expiring Soon</h3>
                ${expiringItems.map(item => `
                  <p style="color: #92400e; margin: 5px 0;">
                    <strong>${item.driverName}</strong> - ${item.type === 'license' ? 'Driver License' : formatDocType(item.documentType || '')}
                    <br><span style="font-size: 14px;">Expires in ${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'} (${item.expiryDate})</span>
                  </p>
                `).join('')}
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Please review these documents in the admin dashboard and contact the drivers to update their documentation.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; background-color: #f8f8f8; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} RideFlow. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
