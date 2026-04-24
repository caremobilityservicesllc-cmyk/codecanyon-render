import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DocumentNotificationRequest {
  driverId?: string;
  email?: string;
  driverName?: string;
  documentType: string;
  status?: "approved" | "rejected";
  type?: "application_approved" | "application_rejected";
  rejectionReason?: string;
}

const documentTypeLabels: Record<string, string> = {
  license_front: "Driver License (Front)",
  license_back: "Driver License (Back)",
  insurance: "Insurance Certificate",
  vehicle_registration: "Vehicle Registration",
  background_check: "Background Check",
  medical_certificate: "Medical Certificate",
  profile_photo: "Profile Photo",
};

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

const getEmailContent = (
  driverName: string,
  documentType: string,
  status: "approved" | "rejected",
  companyName: string,
  rejectionReason?: string
) => {
  const documentLabel = documentTypeLabels[documentType] || documentType;

  if (status === "approved") {
    return {
      subject: `✅ Document Approved: ${documentLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Document Approved!</h1>
                </td></tr>
                <tr><td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 20px; line-height: 1.6;">Hi ${driverName},</p>
                  <p style="color: #374151; font-size: 16px; margin: 0 0 30px; line-height: 1.6;">Great news! Your <strong>${documentLabel}</strong> has been verified and approved by our team.</p>
                  <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="color: #065f46; margin: 0; font-size: 14px;"><strong>Document:</strong> ${documentLabel}<br><strong>Status:</strong> Approved ✓</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">You can continue uploading any remaining documents to complete your verification. Once all required documents are approved, you'll be ready to start accepting rides!</p>
                </td></tr>
                <tr><td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    };
  } else {
    return {
      subject: `⚠️ Document Requires Attention: ${documentLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr><td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 40px 30px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Document Requires Resubmission</h1>
                </td></tr>
                <tr><td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 20px; line-height: 1.6;">Hi ${driverName},</p>
                  <p style="color: #374151; font-size: 16px; margin: 0 0 30px; line-height: 1.6;">Unfortunately, your <strong>${documentLabel}</strong> could not be approved. Please review the feedback below and upload a new document.</p>
                  <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="color: #991b1b; margin: 0 0 10px; font-size: 14px; font-weight: 600;">Reason for rejection:</p>
                    <p style="color: #b91c1c; margin: 0; font-size: 14px; line-height: 1.6;">${rejectionReason || "The document did not meet our verification requirements. Please ensure the document is clear, valid, and shows all required information."}</p>
                  </div>
                  <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>💡 Tips for successful upload:</strong><br>• Ensure the document is not expired<br>• Make sure all text is clearly readable<br>• Avoid glare, shadows, or blurry images<br>• Include all required information</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">Please log in to your driver portal and upload a new version of your ${documentLabel.toLowerCase()}.</p>
                </td></tr>
                <tr><td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    };
  }
};

const getApplicationEmailContent = (
  driverName: string,
  type: "application_approved" | "application_rejected",
  companyName: string,
  rejectionReason?: string
) => {
  if (type === "application_approved") {
    return {
      subject: `🎉 Welcome to ${companyName} - Your Application is Approved!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Application Approved!</h1>
                </td></tr>
                <tr><td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 20px; line-height: 1.6;">Hi ${driverName},</p>
                  <p style="color: #374151; font-size: 16px; margin: 0 0 30px; line-height: 1.6;">Congratulations! Your driver application has been approved. Welcome to the ${companyName} team!</p>
                  <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="color: #065f46; margin: 0; font-size: 14px;"><strong>What's next?</strong><br><br>1. Log in to your Driver Portal<br>2. Complete any remaining document uploads<br>3. Set your availability and start accepting rides!</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">If you have any questions, feel free to reach out to our driver support team.</p>
                </td></tr>
                <tr><td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    };
  } else {
    return {
      subject: `Update on Your ${companyName} Driver Application`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px 40px 30px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Application Update</h1>
                </td></tr>
                <tr><td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 20px; line-height: 1.6;">Hi ${driverName},</p>
                  <p style="color: #374151; font-size: 16px; margin: 0 0 30px; line-height: 1.6;">Thank you for your interest in becoming a ${companyName} driver. Unfortunately, we are unable to approve your application at this time.</p>
                  <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="color: #991b1b; margin: 0 0 10px; font-size: 14px; font-weight: 600;">Reason:</p>
                    <p style="color: #b91c1c; margin: 0; font-size: 14px; line-height: 1.6;">${rejectionReason || "Your application did not meet our current requirements."}</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">You may reapply in the future once you've addressed the concerns mentioned above. If you believe this was an error, please contact our support team.</p>
                </td></tr>
                <tr><td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const companyName = await getCompanyName();

    const body: DocumentNotificationRequest = await req.json();
    const { driverId, email, driverName, documentType, status, type, rejectionReason } = body;

    // Handle application approval/rejection notifications
    if (type && (type === "application_approved" || type === "application_rejected") && email && driverName) {
      const { subject, html } = getApplicationEmailContent(driverName, type, companyName, rejectionReason);

      const emailResponse = await resend.emails.send({
        from: `${companyName} <noreply@resend.dev>`,
        to: [email],
        subject,
        html,
      });

      console.log("Application notification email sent:", emailResponse);
      return new Response(JSON.stringify({ success: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!driverId || !documentType || !status) {
      throw new Error("Missing required fields: driverId, documentType, status (or type, email, driverName for application notifications)");
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("first_name, last_name, email")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      console.error("Failed to fetch driver:", driverError);
      throw new Error("Driver not found");
    }

    if (!driver.email) {
      console.log("Driver has no email address, skipping notification");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No email address" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const fullDriverName = `${driver.first_name} ${driver.last_name}`;
    const { subject, html } = getEmailContent(fullDriverName, documentType, status, companyName, rejectionReason);

    const emailResponse = await resend.emails.send({
      from: `${companyName} <noreply@resend.dev>`,
      to: [driver.email],
      subject,
      html,
    });

    console.log("Document notification email sent:", emailResponse);
    return new Response(JSON.stringify({ success: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
