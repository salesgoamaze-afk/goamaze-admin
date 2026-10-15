import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/seed?secret=YOUR_JWT_SECRET
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.JWT_SECRET || "goamaze-secret";
  if (secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, message: "Unauthorized — pass valid ?secret= param" },
      { status: 401 }
    );
  }

  return runSeed();
}

/**
 * POST /api/seed
 */
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.JWT_SECRET || "goamaze-secret";
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  return runSeed();
}

async function runSeed() {
  try {
    const results = await db.reseed();
    return NextResponse.json({ success: true, message: "Database reseeded successfully", results });
  } catch (err) {
    console.error("[SEED ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Database seeding failed", error: String(err) },
      { status: 500 }
    );
  }
}

