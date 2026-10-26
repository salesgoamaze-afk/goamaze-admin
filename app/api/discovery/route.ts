import { NextRequest, NextResponse } from "next/server";
import { executeProductDiscoveryJob } from "@/lib/product-discovery";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/discovery — admin only
 * 
 * Initiates product discovery from the Amazon Creators API by theme, category, or keywords.
 * Normalizes canonical records, prevents duplicates, and queues for AI processing.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      themeSlug,
      categorySlug,
      searchIndex,
      keywords,
      limit = 10,
      page = 1,
      marketplace,
    } = body;

    const report = await executeProductDiscoveryJob({
      themeSlug,
      categorySlug,
      searchIndex,
      keywords,
      limit,
      page,
      marketplace,
    });

    return NextResponse.json({
      success: report.success,
      report,
    });
  } catch (err: any) {
    console.error("[POST /api/discovery]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Product discovery failed" },
      { status: 500 }
    );
  }
}
