import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/products/sync — Sync / Restore products catalogue from data/products.json
 * GET /api/products/sync
 */
async function handleSync(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;

    // Also allow query secret fallback for automated maintenance or serverless webhooks
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.JWT_SECRET || "goamaze-secret";
    const isSecretValid = secret && secret === expectedSecret;

    if (!payload && !isSecretValid) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — admin authentication required" },
        { status: 401 }
      );
    }

    const result = await db.syncCatalog();

    return NextResponse.json({
      success: true,
      message: `Catalogue synchronized successfully (${result.total} total products active).`,
      count: result.count,
      total: result.total,
    });
  } catch (err: any) {
    console.error("[POST /api/products/sync]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to sync catalogue" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

export async function GET(req: NextRequest) {
  return handleSync(req);
}
