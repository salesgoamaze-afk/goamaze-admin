import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ProductSchema = z.object({
  title:         z.string().min(1).max(600),
  subtitle:      z.string().optional().default("Top-rated essentials recommended on GoAmaze"),
  description:   z.string().optional().default(""),
  price:         z.string().min(1),
  originalPrice: z.string().optional().default(""),
  unitPrice:     z.string().optional().default(""),
  category:      z.string().min(1),
  image:         z.string().min(1),
  images:        z.array(z.string()).optional().default([]),
  instagramUrl:  z.string().optional().default(""),
  affiliateLink: z.string().min(1),
  badge:         z.string().optional().default("New"),
  rating:        z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return 4.5;
    const n = Number(v);
    return isNaN(n) ? 4.5 : Math.max(0, Math.min(5, n));
  }),
  reviews:       z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }),
  featured:      z.boolean().optional().default(false),
});

/** GET /api/products  — public */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const search   = searchParams.get("search") || undefined;
    const featured = searchParams.get("featured") ? searchParams.get("featured") === "true" : undefined;
    const limit    = parseInt(searchParams.get("limit") || "100");

    const products = await db.getProducts({ category, search, featured, limit });

    return NextResponse.json({ success: true, data: products });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/** POST /api/products — admin only */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const dataToCreate = {
      ...parsed.data,
      originalPrice: parsed.data.originalPrice || parsed.data.price,
      subtitle: parsed.data.subtitle || `Authentic ${parsed.data.title.slice(0, 60)} — top-rated choice`,
    };

    const product = await db.createProduct(dataToCreate);
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/products]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create product" },
      { status: 500 }
    );
  }
}

