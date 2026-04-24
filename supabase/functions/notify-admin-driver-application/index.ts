import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DriverApplicationRequest {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  licenseNumber: string;
  submittedAt: string;
}

async function getCompanyName(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return "RideFlow";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "business_info")
      .single();
    return (data?.value as any)?.companyName || "RideFlow";
  } catch {
    return "RideFlow";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const companyName = await getCompanyName();

    const { applicantName, applicantEmail, applicantPhone, licenseNumber, submittedAt }: DriverApplicationRequest = await req.json();

    if (!applicantName || !applicantEmail) {
      throw new Error("Missing required fields: applicantName, applicantEmail");
    }

    // Fetch all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminUserIds = adminRoles.map(r => r.user_id);
    const { data: adminProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('id', adminUserIds)
      .not('email', 'is', null);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw profilesError;
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log("No admin profiles with emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminEmails = adminProfiles.map(p => p.email).filter(Boolean) as string[];
    const formattedDate = new Date(submittedAt).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const emailResponse = await resend.emails.send({
      from: `${companyName} <noreply@resend.dev>`,
      to: adminEmails,
      subject: "🚗 New Driver Application Submitted",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Driver Application</h1>
              <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 14px;">A new driver has applied to join ${companyName}</p>
            </div>
            
            <div style="padding: 32px;">
              <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #1e40af; font-weight: 600;">Action Required</p>
                <p style="margin: 8px 0 0 0; color: #3730a3; font-size: 14px;">Please review this application in the Admin Dashboard.</p>
              </div>

              <h2 style="color: #18181b; font-size: 18px; margin: 0 0 16px 0;">Applicant Details</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Full Name</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${applicantName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Email</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${applicantEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Phone</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${applicantPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">License Number</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${licenseNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #71717a; font-size: 14px;">Submitted</td>
                  <td style="padding: 12px 0; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${formattedDate}</td>
                </tr>
              </table>

              <div style="margin-top: 32px; text-align: center;">
                <p style="color: #71717a; font-size: 12px; margin: 0;">Go to Admin Dashboard → Drivers to review and approve this application.</p>
              </div>
            </div>

            <div style="background-color: #f4f4f5; padding: 24px; text-align: center;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Admin notification emails sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailsSent: adminEmails.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-driver-application:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
