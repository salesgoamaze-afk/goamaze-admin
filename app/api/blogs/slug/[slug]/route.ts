import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import productsJsonFallback from "@/data/products.json";

/** GET /api/blogs/slug/[slug] — public article data */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const blog = await db.getBlogBySlug(slug);

    if (!blog) {
      return NextResponse.json({ success: false, message: "Article not found" }, { status: 404 });
    }

    // Resolve associated product IDs to full product objects
    let attachedProducts: any[] = [];
    if (Array.isArray(blog.productIds) && blog.productIds.length > 0) {
      const resolved = await Promise.all(
        blog.productIds.map(async (pid: string) => {
          const fromDb = await db.getProductById(pid);
          if (fromDb) return fromDb;
          // Check static JSON fallback
          const fromFallback = (productsJsonFallback as any[]).find(
            (p) => String(p.id) === String(pid) || p.title.toLowerCase().includes(pid.toLowerCase())
          );
          return fromFallback || null;
        })
      );
      attachedProducts = resolved.filter(Boolean);
    }

    // Fetch related blogs (same category or latest, excluding current)
    const allBlogs = await db.getBlogs({ published: true, limit: 10 });
    const relatedBlogs = allBlogs
      .filter((b) => b.slug !== blog.slug)
      .slice(0, 3);

    return NextResponse.json({
      success: true,
      data: {
        ...blog,
        products: attachedProducts,
        relatedBlogs,
      },
    });
  } catch (err) {
    console.error("[GET /api/blogs/slug/[slug]]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
