import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

const FAQItemSchema = z.object({
  question: z.string().min(1),
  answer:   z.string().min(1),
});

const BlogUpdateSchema = z.object({
  title:          z.string().min(1).max(300).optional(),
  slug:           z.string().optional(),
  excerpt:        z.string().min(1).max(1000).optional(),
  content:        z.string().min(1).optional(),
  coverImage:     z.string().min(1).optional(),
  category:       z.string().min(1).optional(),
  author:         z.string().optional(),
  readTime:       z.string().optional(),
  seoTitle:       z.string().optional(),
  seoDescription: z.string().optional(),
  keywords:       z.array(z.string()).optional(),
  aeoSummary:     z.string().optional(),
  geoTarget:      z.string().optional(),
  faqSchema:      z.array(FAQItemSchema).optional(),
  productIds:     z.array(z.string()).optional(),
  featured:       z.boolean().optional(),
  published:      z.boolean().optional(),
});

/** GET /api/blogs/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blog = await db.getBlogById(id);
    if (!blog) {
      return NextResponse.json({ success: false, message: "Blog not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: blog });
  } catch (err) {
    console.error("[GET /api/blogs/[id]]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

/** PUT /api/blogs/[id] — admin only */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getTokenFromCookies();
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = BlogUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await db.updateBlog(id, parsed.data as any);
    if (!updated) {
      return NextResponse.json({ success: false, message: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[PUT /api/blogs/[id]]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to update blog" },
      { status: 500 }
    );
  }
}

/** DELETE /api/blogs/[id] — admin only */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getTokenFromCookies();
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await db.deleteBlog(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (err: any) {
    console.error("[DELETE /api/blogs/[id]]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to delete blog" },
      { status: 500 }
    );
  }
}
