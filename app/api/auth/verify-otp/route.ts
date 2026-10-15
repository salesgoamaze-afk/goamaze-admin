import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, buildCookieHeader } from "@/lib/auth";
import { z } from "zod";

const VerifyOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  otp: z
    .string()
    .length(6, "Verification code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain only numbers"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "Invalid input data",
        },
        { status: 400 }
      );
    }

    const { email, otp } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Fetch active OTP record
    const otpRecord = await db.getAdminOtp(cleanEmail);

    if (!otpRecord) {
      return NextResponse.json(
        {
          success: false,
          message: "Verification code expired or not found. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // 2. Check expiration timestamp
    if (Date.now() > otpRecord.expiresAt) {
      await db.deleteAdminOtp(cleanEmail);
      return NextResponse.json(
        {
          success: false,
          message: "Verification code has expired. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // 3. Check brute-force attempts threshold (max 5)
    if (otpRecord.attempts >= 5) {
      await db.deleteAdminOtp(cleanEmail);
      return NextResponse.json(
        {
          success: false,
          message: "Too many incorrect attempts. This verification code has been invalidated. Please request a new one.",
        },
        { status: 429 }
      );
    }

    // 4. Verify OTP match
    if (otpRecord.otp !== otp.trim()) {
      const updated = await db.incrementOtpAttempts(cleanEmail);
      const remainingAttempts = Math.max(0, 5 - (updated?.attempts || 1));

      return NextResponse.json(
        {
          success: false,
          message: `Incorrect verification code. ${
            remainingAttempts > 0
              ? `${remainingAttempts} attempt(s) remaining.`
              : "This code is now invalidated. Please request a new one."
          }`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    // 5. Success! Clear OTP
    await db.deleteAdminOtp(cleanEmail);

    // 6. Find admin user to construct JWT payload
    const user = await db.getAdminByEmail(cleanEmail);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Administrator account could not be found.",
        },
        { status: 404 }
      );
    }

    // 7. Sign session JWT
    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        user: { name: user.name, email: user.email, role: user.role },
      },
      {
        status: 200,
        headers: { "Set-Cookie": buildCookieHeader(token) },
      }
    );
  } catch (err: any) {
    console.error("[POST /api/auth/verify-otp]", err);
    return NextResponse.json(
      { success: false, message: "Internal server error occurred." },
      { status: 500 }
    );
  }
}
