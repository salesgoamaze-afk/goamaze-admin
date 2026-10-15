import { NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth";

/** POST /api/auth/logout */
export async function POST() {
  return NextResponse.json(
    { success: true, message: "Logged out successfully" },
    {
      status: 200,
      headers: { "Set-Cookie": buildClearCookieHeader() },
    }
  );
}
