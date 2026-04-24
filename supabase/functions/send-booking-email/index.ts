import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface EmailProviderConfig {
  provider: "resend" | "sendgrid" | "smtp";
  configured: boolean;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  smtpHost?: string;
  smtpPort?: number;
}

async function getEmailProviderConfig(): Promise<EmailProviderConfig> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_provider")
      .single();
    if (data?.value && typeof data.value === "object") {
      const val = data.value as any;
      if (val.configured && val.apiKey) {
        return {
          provider: val.provider || "resend",
          configured: true,
          apiKey: val.apiKey,
          fromEmail: val.fromEmail || "",
          fromName: val.fromName || "",
          smtpHost: val.smtpHost,
          smtpPort: val.smtpPort,
        };
      }
    }
  } catch (e) {
    console.log("Could not fetch email provider config, using default Resend:", e);
  }
  // Fallback to RESEND_API_KEY env var
  return {
    provider: "resend",
    configured: true,
    apiKey: Deno.env.get("RESEND_API_KEY") || "",
    fromEmail: "",
    fromName: "",
  };
}

async function sendWithResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const resend = new Resend(apiKey);
  return await resend.emails.send({ from, to: [to], subject, html });
}

async function sendWithSendGrid(apiKey: string, from: string, fromName: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from || "noreply@example.com", name: fromName || undefined },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SendGrid API error [${response.status}]: ${errorBody}`);
  }
  return { id: `sendgrid-${Date.now()}` };
}

async function sendWithSmtp(config: EmailProviderConfig, from: string, to: string, subject: string, html: string) {
  // SMTP via a simple HTTP-to-SMTP relay isn't natively supported in Deno edge functions.
  // For now, we throw a descriptive error. Users should use Resend or SendGrid.
  throw new Error("SMTP provider is not yet supported in edge functions. Please use Resend or SendGrid.");
}

async function sendEmail(config: EmailProviderConfig, companyName: string, to: string, subject: string, html: string) {
  const fromEmail = config.fromEmail || "onboarding@resend.dev";
  const fromName = config.fromName || companyName;
  const from = `${fromName} <${fromEmail}>`;

  switch (config.provider) {
    case "sendgrid":
      return await sendWithSendGrid(config.apiKey!, config.fromEmail || "noreply@example.com", fromName, to, subject, html);
    case "smtp":
      return await sendWithSmtp(config, from, to, subject, html);
    case "resend":
    default:
      return await sendWithResend(config.apiKey!, from, to, subject, html);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingEmailRequest {
  type: "created" | "updated" | "cancelled" | "reminder" | "rescheduled" | "share_accepted" | "share_invitation" | "share_invitation_updated" | "share_declined" | "share_counter_proposal" | "share_proposal_accepted" | "bank_payment_confirmed";
  email: string;
  bookingReference: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  vehicleName: string;
  passengers: number;
  status?: string;
  previousDate?: string;
  previousTime?: string;
  acceptedByEmail?: string;
  costSplitPercentage?: number;
  totalPrice?: number;
  sharerName?: string;
  shareLink?: string;
  declinedByEmail?: string;
  proposedByEmail?: string;
  proposedPercentage?: number;
  originalPercentage?: number;
  acceptedPercentage?: number;
}

async function getCompanyName(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "business_info")
      .single();
    if (data?.value && typeof data.value === "object" && (data.value as any).companyName) {
      return (data.value as any).companyName;
    }
  } catch (e) {
    console.log("Could not fetch company name, using default:", e);
  }
  return "RideFlow";
}

const getEmailContent = (data: BookingEmailRequest, companyName: string) => {
  const { type, bookingReference, pickupLocation, dropoffLocation, pickupDate, pickupTime, vehicleName, passengers, status, previousDate, previousTime, acceptedByEmail, costSplitPercentage, totalPrice, sharerName, shareLink, declinedByEmail, proposedByEmail, proposedPercentage, originalPercentage, acceptedPercentage } = data;

  const headerHtml = `
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center;">
      <h1 style="color: #2dd4bf; margin: 0;">${companyName}</h1>
    </div>`;

  const footerHtml = `
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>`;

  const bookingDetails = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Booking Reference</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${bookingReference}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Pickup Location</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${pickupLocation}</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Dropoff Location</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${dropoffLocation}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Date</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${pickupDate}</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Time</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${pickupTime}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Vehicle</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${vehicleName}</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Passengers</td>
        <td style="padding: 12px; border: 1px solid #dee2e6;">${passengers}</td>
      </tr>
      ${status ? `
      <tr>
        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Status</td>
        <td style="padding: 12px; border: 1px solid #dee2e6; text-transform: capitalize;">${status}</td>
      </tr>
      ` : ''}
    </table>
  `;

  switch (type) {
    case "created":
      return {
        subject: `Booking Confirmed - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Booking Confirmed! 🎉</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Thank you for your booking. We've received your reservation and it's now being processed.
              </p>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                You will receive another email when your booking status is updated.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "updated":
      return {
        subject: `Booking Updated - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Booking Updated 📝</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Your booking has been updated. Here are the current details:
              </p>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact us.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "cancelled":
      return {
        subject: `Booking Cancelled - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ef4444; margin-top: 0;">Booking Cancelled ❌</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Your booking has been cancelled. Here were the booking details:
              </p>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                We hope to serve you again in the future!
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "reminder":
      return {
        subject: `Reminder: Your Ride Tomorrow - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Your Ride is Tomorrow! 🚗</h2>
              <p style="color: #64748b; line-height: 1.6;">
                This is a friendly reminder that your ride is scheduled for <strong>tomorrow</strong>. 
                Please make sure you're ready at the pickup location on time.
              </p>
              ${bookingDetails}
              <div style="background-color: #f0fdfa; border-left: 4px solid #2dd4bf; padding: 15px; margin: 20px 0;">
                <p style="color: #0f766e; margin: 0; font-weight: 500;">
                  📍 Be ready at: ${pickupLocation}<br>
                  🕐 Time: ${pickupTime}
                </p>
              </div>
              <p style="color: #64748b; line-height: 1.6;">
                If you need to make any changes to your booking, please contact us as soon as possible.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "rescheduled":
      const dateChanged = previousDate && previousDate !== pickupDate;
      const timeChanged = previousTime && previousTime !== pickupTime;
      
      let changeDescription = '';
      if (dateChanged && timeChanged) {
        changeDescription = `from <strong>${previousDate} at ${previousTime}</strong> to <strong>${pickupDate} at ${pickupTime}</strong>`;
      } else if (dateChanged) {
        changeDescription = `from <strong>${previousDate}</strong> to <strong>${pickupDate}</strong>`;
      } else if (timeChanged) {
        changeDescription = `from <strong>${previousTime}</strong> to <strong>${pickupTime}</strong>`;
      }

      return {
        subject: `Booking Rescheduled - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Booking Rescheduled 📅</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Your booking has been rescheduled ${changeDescription}.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="color: #92400e; margin: 0; font-weight: 500;">
                  📅 New Date: ${pickupDate}<br>
                  🕐 New Time: ${pickupTime}
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                Please make note of the new schedule. If you have any questions, please don't hesitate to contact us.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_accepted":
      const yourShare = totalPrice && costSplitPercentage 
        ? ((totalPrice * (100 - costSplitPercentage)) / 100).toFixed(2)
        : null;
      const theirShare = totalPrice && costSplitPercentage 
        ? ((totalPrice * costSplitPercentage) / 100).toFixed(2)
        : null;

      return {
        subject: `Ride Share Accepted - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Ride Share Accepted! 🎉</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Great news! <strong>${acceptedByEmail || 'Your invited guest'}</strong> has accepted your ride share invitation.
              </p>
              <div style="background-color: #f0fdfa; border-left: 4px solid #2dd4bf; padding: 15px; margin: 20px 0;">
                <p style="color: #0f766e; margin: 0; font-weight: 500;">
                  💰 Cost Split Summary<br>
                  ${yourShare ? `Your share: $${yourShare} (${100 - (costSplitPercentage || 50)}%)` : `Your share: ${100 - (costSplitPercentage || 50)}%`}<br>
                  ${theirShare ? `Their share: $${theirShare} (${costSplitPercentage}%)` : `Their share: ${costSplitPercentage}%`}
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                You can view your shared rides in the "My Bookings" section of your account.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_invitation":
      const inviteeShare = totalPrice && costSplitPercentage 
        ? ((totalPrice * costSplitPercentage) / 100).toFixed(2)
        : null;

      return {
        subject: `You've Been Invited to Share a Ride - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">You're Invited to Share a Ride! 🚗</h2>
              <p style="color: #64748b; line-height: 1.6;">
                <strong>${sharerName || 'Someone'}</strong> has invited you to share a ride and split the cost.
              </p>
              <div style="background-color: #f0fdfa; border-left: 4px solid #2dd4bf; padding: 15px; margin: 20px 0;">
                <p style="color: #0f766e; margin: 0; font-weight: 500;">
                  💰 Your Cost Share: ${costSplitPercentage || 50}%${inviteeShare ? ` ($${inviteeShare})` : ''}
                </p>
              </div>
              ${bookingDetails}
              <div style="text-align: center; margin: 30px 0;">
                <a href="${shareLink}" style="display: inline-block; background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); color: #0f172a; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #64748b; line-height: 1.6; font-size: 14px;">
                Or copy this link: <a href="${shareLink}" style="color: #2dd4bf;">${shareLink}</a>
              </p>
              <p style="color: #94a3b8; line-height: 1.6; font-size: 12px;">
                If you don't want to share this ride, you can simply ignore this email.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_invitation_updated":
      const updatedInviteeShare = totalPrice && costSplitPercentage 
        ? ((totalPrice * costSplitPercentage) / 100).toFixed(2)
        : null;

      return {
        subject: `Cost Split Updated - Ride Share Invitation ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Cost Split Has Been Updated 📝</h2>
              <p style="color: #64748b; line-height: 1.6;">
                <strong>${sharerName || 'The ride organizer'}</strong> has updated the cost split for a ride share invitation you received.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="color: #92400e; margin: 0; font-weight: 500;">
                  💰 New Cost Share: ${costSplitPercentage || 50}%${updatedInviteeShare ? ` ($${updatedInviteeShare})` : ''}
                </p>
              </div>
              ${bookingDetails}
              <div style="text-align: center; margin: 30px 0;">
                <a href="${shareLink}" style="display: inline-block; background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); color: #0f172a; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Review & Accept Invitation
                </a>
              </div>
              <p style="color: #64748b; line-height: 1.6; font-size: 14px;">
                Or copy this link: <a href="${shareLink}" style="color: #2dd4bf;">${shareLink}</a>
              </p>
              <p style="color: #94a3b8; line-height: 1.6; font-size: 12px;">
                If you don't want to share this ride, you can simply ignore this email.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_declined":
      return {
        subject: `Ride Share Invitation Declined - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Ride Share Invitation Declined</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Unfortunately, <strong>${declinedByEmail || 'the invited passenger'}</strong> has declined your ride share invitation for booking <strong>${bookingReference}</strong>.
              </p>
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                <p style="color: #991b1b; margin: 0;">
                  The full fare will apply to your booking unless you invite another passenger.
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                You can invite another passenger to share this ride from your booking details page.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_counter_proposal":
      const proposedShare = totalPrice && proposedPercentage 
        ? ((totalPrice * proposedPercentage) / 100).toFixed(2) 
        : null;
      const originalShare = totalPrice && originalPercentage 
        ? ((totalPrice * originalPercentage) / 100).toFixed(2) 
        : null;
      return {
        subject: `Counter-Proposal for Ride Share - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">New Cost Split Proposal 💬</h2>
              <p style="color: #64748b; line-height: 1.6;">
                <strong>${proposedByEmail || 'The invited passenger'}</strong> has proposed a different cost split for your ride share invitation.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="color: #92400e; margin: 0 0 10px 0; font-weight: bold;">Proposed Change:</p>
                <p style="color: #92400e; margin: 0;">
                  Original: You pay ${100 - (originalPercentage || 50)}%${originalShare ? ` ($${originalShare})` : ''} / They pay ${originalPercentage || 50}%
                </p>
                <p style="color: #92400e; margin: 5px 0 0 0; font-weight: bold;">
                  Proposed: You pay ${100 - (proposedPercentage || 50)}%${proposedShare ? ` ($${((totalPrice || 0) * (100 - (proposedPercentage || 50)) / 100).toFixed(2)})` : ''} / They pay ${proposedPercentage || 50}%${proposedShare ? ` ($${proposedShare})` : ''}
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                Go to your booking to accept or decline this counter-proposal.
              </p>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${shareLink || '#'}" style="display: inline-block; background-color: #2dd4bf; color: #0f172a; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Review Proposal</a>
              </div>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "share_proposal_accepted":
      const acceptedShare = totalPrice && acceptedPercentage 
        ? ((totalPrice * acceptedPercentage) / 100).toFixed(2) 
        : null;
      return {
        subject: `Your Cost Split Proposal Was Accepted! - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #1e293b; margin-top: 0;">Proposal Accepted! ✅</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Great news! The sharer has accepted your proposed cost split of <strong>${acceptedPercentage}%</strong> for ride <strong>${bookingReference}</strong>.
              </p>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <p style="color: #065f46; margin: 0; font-weight: bold;">
                  Your share: ${acceptedPercentage}%${acceptedShare ? ` ($${acceptedShare})` : ''}
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                You can now accept the ride share invitation to confirm your spot.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    case "bank_payment_confirmed":
      return {
        subject: `Bank Transfer Payment Verified - ${bookingReference}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${headerHtml}
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #10b981; margin-top: 0;">Payment Verified ✅</h2>
              <p style="color: #64748b; line-height: 1.6;">
                Great news! Your bank transfer payment for booking <strong>${bookingReference}</strong> has been verified and confirmed by our team.
              </p>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <p style="color: #065f46; margin: 0; font-weight: 500;">
                  ✅ Payment Status: <strong>Verified</strong><br>
                  📋 Booking Status: <strong>Confirmed</strong>
                </p>
              </div>
              ${bookingDetails}
              <p style="color: #64748b; line-height: 1.6;">
                Your booking is now fully confirmed. You will receive further updates as your ride date approaches.
              </p>
            </div>
            ${footerHtml}
          </div>
        `,
      };

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: BookingEmailRequest = await req.json();
    
    console.log("Sending booking email:", { type: data.type, email: data.email, reference: data.bookingReference });

    if (!data.email || !data.bookingReference || !data.type) {
      console.error("Missing required fields:", { email: !!data.email, reference: !!data.bookingReference, type: !!data.type });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const companyName = await getCompanyName();
    const emailConfig = await getEmailProviderConfig();
    
    if (!emailConfig.apiKey) {
      console.error("No email provider API key configured");
      return new Response(
        JSON.stringify({ error: "Email provider not configured. Please set up an email provider in Admin Settings > Integrations." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { subject, html } = getEmailContent(data, companyName);

    console.log(`Sending email via ${emailConfig.provider} provider`);
    
    // Create supabase client for logging
    const logSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
      const emailResponse = await sendEmail(emailConfig, companyName, data.email, subject, html);
      console.log("Email sent successfully:", emailResponse);

      // Log successful email
      await logSupabase.from("email_logs").insert({
        recipient_email: data.email,
        subject,
        email_type: data.type || "booking",
        provider: emailConfig.provider,
        status: "sent",
        booking_reference: data.bookingReference || null,
        metadata: { response_id: (emailResponse as any)?.id || null },
      });

      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (sendError: any) {
      console.error("Email send failed:", sendError);

      // Log failed email
      await logSupabase.from("email_logs").insert({
        recipient_email: data.email,
        subject,
        email_type: data.type || "booking",
        provider: emailConfig.provider,
        status: "failed",
        error_message: sendError.message,
        booking_reference: data.bookingReference || null,
      });

      throw sendError;
    }
  } catch (error: any) {
    console.error("Error sending booking email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
