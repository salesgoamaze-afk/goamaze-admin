import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional().default("🏷️"),
});

/** GET /api/categories — public */
export async function GET() {
  try {
    const categories = await db.getCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

/** POST /api/categories — admin only */
export async function POST(req: NextRequest) {
  try {
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized — please login to GoAmaze Admin" }, { status: 401 });
    }

    const body   = await req.json();
    const parsed = CategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const category = await db.createCategory(parsed.data.name, parsed.data.icon);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/categories]", err);
    return NextResponse.json({ success: false, message: "Category may already exist or server error" }, { status: 500 });
  }
}

