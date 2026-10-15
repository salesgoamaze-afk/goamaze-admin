import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/categories/:id — admin only */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized — please login to GoAmaze Admin" }, { status: 401 });
    }

    const { id } = await params;
    const cat = await db.deleteCategory(id);

    if (!cat) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (err) {
    console.error("[DELETE /api/categories/:id]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

