import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UpdateSchema = z.object({
  title:         z.string().min(1).max(600).optional(),
  subtitle:      z.string().max(1500).optional().or(z.literal("")),
  description:   z.string().optional().or(z.literal("")),
  price:         z.string().min(1).optional(),
  originalPrice: z.string().optional().or(z.literal("")),
  unitPrice:     z.string().optional().or(z.literal("")),
  category:      z.string().min(1).optional(),
  categories:    z.array(z.string()).optional(),
  themes:        z.array(z.string()).optional(),
  collections:   z.array(z.string()).optional(),
  image:         z.string().min(1).optional(),
  images:        z.array(z.string()).optional(),
  instagramUrl:  z.string().optional().or(z.literal("")),
  affiliateLink: z.string().min(1).optional(),
  badge:         z.string().optional().or(z.literal("")),
  rating:        z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? 4.5 : Math.max(0, Math.min(5, n));
  }),
  reviews:       z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }),
  featured:      z.boolean().optional(),
  analysisStatus: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/products/:id — public */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const product = await db.getProductById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: product });
  } catch (err) {
    console.error("[GET /api/products/:id]", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

/** PUT /api/products/:id — admin only */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body   = await req.json();

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const product = await db.updateProduct(id, parsed.data as any);
    if (!product) {
      return NextResponse.json(
        { success: false, message: `Product "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (err: any) {
    console.error("[PUT /api/products/:id]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/products/:id — admin only */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const product = await db.deleteProduct(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: `Product "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Product deleted",
    });
  } catch (err) {
    console.error("[DELETE /api/products/:id]", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
