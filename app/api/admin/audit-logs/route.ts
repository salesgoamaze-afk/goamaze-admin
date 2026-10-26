import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { getAuditLogs, getAuditSummary } from "@/lib/audit-log";
import { executeScheduledSync, getSchedulerStatus } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/audit-logs
 * Returns paginated price sync audit logs, sessions, and summary metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const changedOnly = searchParams.get("changedOnly") === "true";
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const logData = getAuditLogs({
      search,
      changedOnly,
      status,
      limit,
      page,
    });

    const summary = getAuditSummary();
    const scheduler = getSchedulerStatus();

    return NextResponse.json({
      success: true,
      ...logData,
      summary,
      scheduler,
    });
  } catch (error: any) {
    console.error("[GET /api/admin/audit-logs error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/audit-logs
 * Triggers an immediate price sync and generates an audit log entry.
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const result = await executeScheduledSync();
    const summary = getAuditSummary();
    const scheduler = getSchedulerStatus();

    return NextResponse.json({
      success: result.success,
      message: `Manual price sync completed: ${result.updatedCount} products updated (${result.priceChangedCount} price changes).`,
      result,
      summary,
      scheduler,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/audit-logs error]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to trigger price sync" },
      { status: 500 }
    );
  }
}
