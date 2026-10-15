import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/analytics — admin only */
export async function GET(req: NextRequest) {
  try {
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized — please login to GoAmaze Admin" }, { status: 401 });
    }

    const data = await db.getAnalytics();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

