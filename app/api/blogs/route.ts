import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

// Production verified route

const FAQItemSchema = z.object({
  question: z.string().min(1),
  answer:   z.string().min(1),
});

const BlogSchema = z.object({
  title:          z.string().min(1).max(300),
  slug:           z.string().optional(),
  excerpt:        z.string().min(1).max(1000),
  content:        z.string().min(1),
  coverImage:     z.string().min(1),
  category:       z.string().min(1),
  author:         z.string().optional().default("GoAmaze Editorial"),
  readTime:       z.string().optional().default("5 min read"),
  seoTitle:       z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
  keywords:       z.array(z.string()).optional().default([]),
  aeoSummary:     z.string().optional().default(""),
  geoTarget:      z.string().optional().default("India"),
  faqSchema:      z.array(FAQItemSchema).optional().default([]),
  productIds:     z.array(z.string()).optional().default([]),
  featured:       z.boolean().optional().default(false),
  published:      z.boolean().optional().default(true),
});

/** GET /api/blogs — public */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category  = searchParams.get("category") || undefined;
    const search    = searchParams.get("search") || undefined;
    const featured  = searchParams.get("featured") ? searchParams.get("featured") === "true" : undefined;
    const published = searchParams.get("all") === "true" ? undefined : true;
    const limit     = parseInt(searchParams.get("limit") || "50");

    const blogs = await db.getBlogs({ category, search, featured, published, limit });
    return NextResponse.json({ success: true, data: blogs });
  } catch (err) {
    console.error("[GET /api/blogs]", err);
    return NextResponse.json({ success: false, message: "Failed to fetch blogs" }, { status: 500 });
  }
}

/** POST /api/blogs — admin only */
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenFromCookies();
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BlogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const blog = await db.createBlog(parsed.data as any);
    return NextResponse.json({ success: true, data: blog }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/blogs]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create blog" },
      { status: 500 }
    );
  }
}
