import { NextRequest, NextResponse } from "next/server";
import { processPendingAIAnalysisQueue } from "@/lib/ai/analysis-orchestrator";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/process-queue — admin only
 * 
 * Processes pending items in the AI classification queue with fingerprint diffing.
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

    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : 10;
    const forceFresh = Boolean(body.forceFresh);
    const provider = body.provider || undefined;

    const report = await processPendingAIAnalysisQueue(batchSize, { provider, forceFresh });

    return NextResponse.json({
      success: report.success,
      report,
    });
  } catch (err: any) {
    console.error("[POST /api/ai/process-queue]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Queue processing failed" },
      { status: 500 }
    );
  }
}
