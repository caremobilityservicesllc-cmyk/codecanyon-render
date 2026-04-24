
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationEmailRequest {
  type: "pending" | "expiring_soon" | "expired";
  userId: string;
  paymentMethodId: string;
  email: string;
  paymentMethodLabel: string;
}

const getEmailContent = (type: string, paymentMethodLabel: string) => {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
      .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
      .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .header { text-align: center; margin-bottom: 24px; }
      .icon { width: 64px; height: 64px; margin: 0 auto 16px; }
      h1 { color: #18181b; font-size: 24px; margin: 0 0 8px; }
      .subtitle { color: #71717a; font-size: 14px; }
      .content { color: #3f3f46; font-size: 15px; line-height: 1.6; }
      .highlight { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0; }
      .highlight.urgent { background: #fee2e2; border-left-color: #ef4444; }
      .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 24px; }
      .footer { text-align: center; margin-top: 32px; color: #a1a1aa; font-size: 12px; }
    </style>
  `;

  if (type === "pending") {
    return {
      subject: "Verify Your Payment Method",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="icon">🔐</div>
                <h1>Payment Method Added</h1>
                <p class="subtitle">Verification required</p>
              </div>
              <div class="content">
                <p>You've added <strong>${paymentMethodLabel}</strong> to your account. To start using it for bookings, we need to verify you own this payment method.</p>
                
                <div class="highlight">
                  <strong>📋 How to verify:</strong>
                  <ol style="margin: 8px 0 0; padding-left: 20px;">
                    <li>Check your bank/card statement for a small test charge (between $0.01 and $0.99)</li>
                    <li>Note the exact amount in cents</li>
                    <li>Enter this amount in your account settings to complete verification</li>
                  </ol>
                </div>
                
                <p>The test charge will be refunded automatically. You have <strong>24 hours</strong> to complete verification.</p>
                
                <center>
                  <a href="#" class="button">Verify Now</a>
                </center>
              </div>
              <div class="footer">
                <p>If you didn't add this payment method, please contact support immediately.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  if (type === "expiring_soon") {
    return {
      subject: "⚠️ Payment Verification Expiring Soon",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="icon">⏰</div>
                <h1>Verification Expiring Soon</h1>
                <p class="subtitle">Action required within 4 hours</p>
              </div>
              <div class="content">
                <p>Your verification for <strong>${paymentMethodLabel}</strong> is about to expire.</p>
                
                <div class="highlight urgent">
                  <strong>⚠️ Time is running out!</strong>
                  <p style="margin: 8px 0 0;">Complete verification in the next few hours or you'll need to restart the process.</p>
                </div>
                
                <p>Check your statement for a small test charge and enter the amount in cents to verify ownership.</p>
                
                <center>
                  <a href="#" class="button">Complete Verification</a>
                </center>
              </div>
              <div class="footer">
                <p>Need help? Contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  // expired
  return {
    subject: "Payment Verification Expired",
    html: `
      <!DOCTYPE html>
      <html>
      <head>${baseStyles}</head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="icon">❌</div>
              <h1>Verification Expired</h1>
              <p class="subtitle">Your payment method requires re-verification</p>
            </div>
            <div class="content">
              <p>The verification period for <strong>${paymentMethodLabel}</strong> has expired.</p>
              
              <p>Don't worry – you can easily restart the verification process from your account settings. We'll make a new small test charge that you can use to verify ownership.</p>
              
              <center>
                <a href="#" class="button">Restart Verification</a>
              </center>
            </div>
            <div class="footer">
              <p>If you no longer wish to use this payment method, you can remove it from your account.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, userId, paymentMethodId, email, paymentMethodLabel }: VerificationEmailRequest = await req.json();

    console.log(`Sending ${type} verification email to ${email} for payment method ${paymentMethodId}`);

    const { subject, html } = getEmailContent(type, paymentMethodLabel);

    const emailResponse = await resend.emails.send({
      from: "RideShare <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    });

    console.log("Verification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending verification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
