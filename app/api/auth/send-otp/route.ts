import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAdminOtpEmail } from "@/lib/mail";
import { z } from "zod";
import crypto from "crypto";

const SendOtpSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    // 1. Verify that email belongs to an existing admin
    const admin = await db.getAdminByEmail(email);
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "No administrator account found with this email address.",
        },
        { status: 404 }
      );
    }

    // 2. Check cooldown (60 seconds)
    const cooldownRemaining = await db.getOtpCooldownRemaining(email, 60);
    if (cooldownRemaining > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Please wait ${cooldownRemaining}s before requesting another verification code.`,
          cooldown: cooldownRemaining,
        },
        { status: 429 }
      );
    }

    // 3. Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 4. Save OTP record (10 minutes = 600s TTL)
    await db.saveAdminOtp(email, otp, 600);

    // 5. Send OTP via email (Resend with local dev fallback)
    const mailResult = await sendAdminOtpEmail(email, otp);

    if (!mailResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: mailResult.message || "Failed to deliver verification email.",
        },
        { status: 502 }
      );
    }

    const isProduction = process.env.NODE_ENV === "production";
    const isDev = !isProduction && Boolean(mailResult.devMode);

    return NextResponse.json(
      {
        success: true,
        message: mailResult.message || "Verification code sent to your email.",
        cooldown: 60,
        devMode: isDev,
        // Expose devOtp only during local dev fallback to aid testing
        devOtp: isDev ? otp : undefined,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/auth/send-otp]", err);
    return NextResponse.json(
      { success: false, message: "Internal server error occurred." },
      { status: 500 }
    );
  }
}
