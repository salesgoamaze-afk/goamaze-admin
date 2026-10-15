import { NextResponse } from "next/server";

/**
 * POST /api/auth/login
 * Password-based authentication is disabled on this platform.
 * OTP authentication is strictly enforced via /api/auth/send-otp and /api/auth/verify-otp.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Password login is disabled. Please use OTP-based authentication to access the admin portal.",
      authMode: "otp",
      endpoints: {
        sendOtp: "/api/auth/send-otp",
        verifyOtp: "/api/auth/verify-otp",
      },
    },
    { status: 403 }
  );
}
