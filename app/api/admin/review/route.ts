import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/review — returns products pending review or failed
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "NEEDS_REVIEW";

    const all = await db.getProducts({ limit: 500 });
    const filtered = all.filter((p) => (status === "all" ? p.analysisStatus !== "ANALYZED" : p.analysisStatus === status));

    return NextResponse.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/review — admin action: approve, adjust, or retry analysis
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, action, categories, themes } = body;

    if (!productId) {
      return NextResponse.json({ success: false, message: "productId required" }, { status: 400 });
    }

    const product = await db.getProductById(productId);
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (action === "approve") {
      const updated = await db.updateProduct(productId, {
        analysisStatus: "ANALYZED",
        curationStatus: "approved",
      });
      return NextResponse.json({ success: true, action: "approved", product: updated });
    }

    if (action === "adjust") {
      const updated = await db.updateProduct(productId, {
        categories: Array.isArray(categories) ? categories : product.categories,
        themes: Array.isArray(themes) ? themes : product.themes,
        analysisStatus: "ANALYZED",
        curationStatus: "approved",
      });
      return NextResponse.json({ success: true, action: "adjusted", product: updated });
    }

    if (action === "retry") {
      const updated = await db.updateProduct(productId, {
        analysisStatus: "PENDING_ANALYSIS",
      });
      return NextResponse.json({ success: true, action: "queued_for_retry", product: updated });
    }

    return NextResponse.json({ success: false, message: `Unknown action "${action}"` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
