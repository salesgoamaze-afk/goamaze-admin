import { Resend } from "resend";

export interface SendOtpResult {
  success: boolean;
  message: string;
  devMode?: boolean;
}

/**
 * Send a 6-digit OTP email to the admin.
 * If RESEND_API_KEY is configured, sends via Resend.
 * Otherwise, falls back to server console output for local development.
 */
export async function sendAdminOtpEmail(
  email: string,
  otp: string
): Promise<SendOtpResult> {
  const isProduction = process.env.NODE_ENV === "production";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.ADMIN_FROM_EMAIL?.trim() ||
    process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
    "GoAmaze Security <onboarding@resend.dev>";

  // Check if Resend API key is missing or an unconfigured placeholder
  const isKeyMissingOrPlaceholder =
    !apiKey ||
    apiKey.startsWith("re_xxxx") ||
    apiKey === "re_your_api_key_here";

  if (isKeyMissingOrPlaceholder) {
    if (isProduction) {
      console.error(
        "[sendAdminOtpEmail] RESEND_API_KEY is not configured in production environment variables."
      );
      return {
        success: false,
        devMode: false,
        message:
          "Email service not configured. Please add RESEND_API_KEY to your Vercel Project Environment Variables to receive verification codes.",
      };
    }

    // Local development only fallback
    console.log("\n========================================================");
    console.log("🔐 [GOAMAZE ADMIN OTP - LOCAL DEVELOPMENT]");
    console.log(`👤 Target Admin Email: ${email}`);
    console.log(`🔑 Verification Code : ${otp}`);
    console.log("⏱️  Valid for         : 10 minutes");
    console.log("========================================================\n");
    return {
      success: true,
      devMode: true,
      message: "Development mode: Verification code logged to server console.",
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>GoAmaze Admin Verification Code</title>
      </head>
      <body style="margin: 0; padding: 32px 16px; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
        <div style="max-width: 520px; margin: 0 auto; background: linear-gradient(145deg, #131d33 0%, #0d1527 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="display: inline-block; padding: 10px 18px; border-radius: 9999px; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.3); margin-bottom: 12px;">
              <span style="color: #fb923c; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Admin Portal Security</span>
            </div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
              Go<span style="color: #f97316;">Amaze</span>
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 36px 28px; text-align: center;">
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 10px;">
              Sign-in Verification Code
            </h2>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 28px;">
              Use the single-use verification code below to log in to the GoAmaze Admin Portal. This code expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 2px dashed rgba(249, 115, 22, 0.5); border-radius: 14px; padding: 22px 16px; margin-bottom: 28px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #fb923c; display: block;">
                ${otp}
              </span>
            </div>

            <p style="font-size: 12.5px; color: #64748b; line-height: 1.5; margin: 0;">
              ⚠️ If you did not attempt to sign in to the GoAmaze Admin Portal, please ignore this email or review your account security immediately.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: rgba(11, 17, 32, 0.8); padding: 18px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #475569;">
            GoAmaze Store Platform &bull; Automated Security Delivery
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const resend = new Resend(apiKey);
    let sendResult = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Your GoAmaze Admin Verification Code: ${otp}`,
      html: htmlContent,
    });

    let error = sendResult.error;

    // If custom sender domain failed (e.g. unverified domain in Resend),
    // automatically retry using Resend's default verified testing sender:
    if (
      error &&
      fromEmail !== "GoAmaze Security <onboarding@resend.dev>" &&
      (error.message?.toLowerCase().includes("domain") ||
       error.message?.toLowerCase().includes("verify") ||
       error.name === "validation_error")
    ) {
      console.warn(
        `[sendAdminOtpEmail] Custom sender "${fromEmail}" failed (${error.message}). Retrying with onboarding@resend.dev...`
      );
      const retryResult = await resend.emails.send({
        from: "GoAmaze Security <onboarding@resend.dev>",
        to: email,
        subject: `Your GoAmaze Admin Verification Code: ${otp}`,
        html: htmlContent,
      });
      error = retryResult.error;
    }

    if (error) {
      console.error("[sendAdminOtpEmail Resend Error]", error);
      return {
        success: false,
        devMode: false,
        message: `Failed to deliver email: ${error.message}`,
      };
    }

    return {
      success: true,
      devMode: false,
      message: `Verification code sent to ${email}. Please check your inbox.`,
    };
  } catch (err: any) {
    console.error("[sendAdminOtpEmail Exception]", err);
    return {
      success: false,
      devMode: false,
      message: `Email delivery error: ${err?.message || "Failed to send verification email."}`,
    };
  }
}

export interface ContactMessageInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

/**
 * Send contact form message to salesgoamaze@gmail.com
 */
export async function sendContactFormEmail(
  data: ContactMessageInput
): Promise<{ success: boolean; message: string; devMode?: boolean }> {
  const isProduction = process.env.NODE_ENV === "production";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const targetEmail = "salesgoamaze@gmail.com";
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    process.env.ADMIN_FROM_EMAIL?.trim() ||
    "GoAmaze Contact Form <onboarding@resend.dev>";

  const isKeyMissingOrPlaceholder =
    !apiKey ||
    apiKey.startsWith("re_xxxx") ||
    apiKey === "re_your_api_key_here";

  if (isKeyMissingOrPlaceholder) {
    console.log("\n========================================================");
    console.log("📬 [GOAMAZE CONTACT FORM INQUIRY]");
    console.log(`👤 Name   : ${data.name}`);
    console.log(`✉️ Email  : ${data.email}`);
    console.log(`📌 Subject: ${data.subject || "General Inquiry"}`);
    console.log(`💬 Message: ${data.message}`);
    console.log(`🎯 Target : ${targetEmail}`);
    console.log("========================================================\n");

    return {
      success: true,
      devMode: true,
      message: "Thank you! Your message has been sent. We'll get back to you soon.",
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>New Inquiry from ${data.name}</title>
      </head>
      <body style="margin: 0; padding: 32px 16px; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.3); margin-bottom: 10px;">
              <span style="color: #fb923c; font-weight: 800; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">New Contact Message</span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">
              GoAmaze Inquiry: ${data.subject || "General Message"}
            </h1>
          </div>
          <div style="padding: 32px 24px;">
            <div style="margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
              <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8;"><strong style="color: #f8fafc;">Sender Name:</strong> ${data.name}</p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8;"><strong style="color: #f8fafc;">Sender Email:</strong> <a href="mailto:${data.email}" style="color: #60a5fa;">${data.email}</a></p>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;"><strong style="color: #f8fafc;">Subject:</strong> ${data.subject || "General Inquiry"}</p>
            </div>
            <h3 style="font-size: 15px; color: #cbd5e1; margin: 0 0 10px;">Message:</h3>
            <div style="background: rgba(15,23,42,0.9); padding: 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); font-size: 14px; line-height: 1.7; color: #f1f5f9; white-space: pre-wrap;">${data.message}</div>
            <div style="margin-top: 24px; text-align: center;">
              <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject || "GoAmaze Inquiry")}" style="display: inline-block; padding: 12px 24px; border-radius: 10px; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px;">
                Reply Directly to ${data.name} &rarr;
              </a>
            </div>
          </div>
          <div style="background: rgba(11, 17, 32, 0.8); padding: 14px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
            Delivered to salesgoamaze@gmail.com from GoAmaze Contact Page
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const resend = new Resend(apiKey);
    let sendResult = await resend.emails.send({
      from: fromEmail,
      to: targetEmail,
      replyTo: data.email,
      subject: `[GoAmaze Contact] ${data.subject || "New Message"} - from ${data.name}`,
      html: htmlContent,
    });

    let error = sendResult.error;

    if (
      error &&
      fromEmail !== "GoAmaze Contact Form <onboarding@resend.dev>" &&
      (error.message?.toLowerCase().includes("domain") ||
       error.message?.toLowerCase().includes("verify") ||
       error.name === "validation_error")
    ) {
      const retryResult = await resend.emails.send({
        from: "GoAmaze Contact Form <onboarding@resend.dev>",
        to: targetEmail,
        replyTo: data.email,
        subject: `[GoAmaze Contact] ${data.subject || "New Message"} - from ${data.name}`,
        html: htmlContent,
      });
      error = retryResult.error;
    }

    if (error) {
      console.error("[sendContactFormEmail Resend Error]", error);
      return {
        success: false,
        message: `Failed to deliver email: ${error.message}`,
      };
    }

    return {
      success: true,
      message: "Thank you! Your message has been sent successfully. We'll get back to you soon.",
    };
  } catch (err: any) {
    console.error("[sendContactFormEmail Exception]", err);
    return {
      success: false,
      message: `Error sending message: ${err?.message || "Please try again later."}`,
    };
  }
}
