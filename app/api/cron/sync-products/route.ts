import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { executeScheduledSync, getSchedulerStatus, startScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60; // Allow up to 60s for batch catalog sync

/**
 * Validates request authentication:
 * 1. Admin JWT authentication via session cookies.
 * 2. Or secret key authentication via ?secret=... or Authorization: Bearer <secret>
 *    (Compatible with Vercel Cron, GitHub Actions, AWS EventBridge, cron-job.org).
 */
async function isAuthenticated(req: NextRequest): Promise<boolean> {
  // Check Admin session token from cookies
  const token = await getTokenFromCookies(req);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) return true;
  }

  // Check Cron secret from query parameter or headers
  const { searchParams } = new URL(req.url);
  const secretParam = searchParams.get("secret");
  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronHeader = req.headers.get("x-cron-secret");

  const providedSecret = secretParam || authHeader || cronHeader;
  const expectedSecret = process.env.CRON_SECRET || process.env.JWT_SECRET || "goamaze-secret";

  return Boolean(providedSecret && providedSecret === expectedSecret);
}

/**
 * GET /api/cron/sync-products
 * If ?status=true, returns the scheduler status and last sync report.
 * Otherwise, triggers the product attribute & live price sync from Amazon Creator API.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthenticated(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — admin authentication or valid cron secret required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get("status") === "true") {
      const status = getSchedulerStatus();
      return NextResponse.json({
        success: true,
        status,
      });
    }

    const syncResult = await executeScheduledSync();

    return NextResponse.json({
      success: syncResult.success,
      message: `Product sync completed: ${syncResult.updatedCount} products updated (${syncResult.priceChangedCount} price changes).`,
      data: syncResult,
      status: getSchedulerStatus(),
    });
  } catch (error: any) {
    console.error("[GET /api/cron/sync-products error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to execute product sync scheduler" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/sync-products
 * Triggers the product attribute & live price sync from Amazon Creator API.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthenticated(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — admin authentication or valid cron secret required" },
        { status: 401 }
      );
    }

    const syncResult = await executeScheduledSync();

    return NextResponse.json({
      success: syncResult.success,
      message: `Product sync completed: ${syncResult.updatedCount} products updated (${syncResult.priceChangedCount} price changes).`,
      data: syncResult,
      status: getSchedulerStatus(),
    });
  } catch (error: any) {
    console.error("[POST /api/cron/sync-products error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to execute product sync scheduler" },
      { status: 500 }
    );
  }
}
