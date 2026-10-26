import { NextRequest, NextResponse } from "next/server";
import { classifyAndAnalyzeProduct } from "@/lib/ai/classifier";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { CANONICAL_CATEGORIES, ADMIN_THEMES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/recommend-taxonomy
 * 
 * Takes product attributes (title, description, features, price, brand, categoryHint)
 * and uses the configured AI model (Gemini / Groq / Heuristic fallback) to recommend:
 * - One or more canonical categories
 * - One or more suitable subcategories
 * - Zero or more lifestyle themes (from the 5 Admin Themes)
 * - Concise reasoning and confidence score
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Action 1: Suggest search keywords for a category / subcategory / theme
    if (body.action === "suggest-keywords") {
      const { category, subcategory, theme } = body;
      const targetCat = CANONICAL_CATEGORIES.find(c => c.slug === category || c.name.toLowerCase() === (category || "").toLowerCase());
      const catName = targetCat ? targetCat.name : (category || "Home & Kitchen");
      const subName = subcategory || "";
      const themeDef = ADMIN_THEMES.find(t => t.slug === theme);

      const generated = [
        subName ? `${subName}` : catName,
        subName ? `${subName} best seller` : `${catName} trending`,
        themeDef ? `${themeDef.name} ${subName || catName}` : `${catName} organizers`,
        subName ? `${subName} top rated for home` : `smart ${catName} essentials`,
      ].filter(Boolean);

      return NextResponse.json({
        success: true,
        data: {
          keywords: subName ? `${subName} ${catName}` : (themeDef?.defaultKeywords || catName),
          suggestions: generated,
          category: catName,
          subcategory: subName,
        },
      });
    }

    const { title, description, features = [], price, brand, categoryHint, provider } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, message: "Product title is required to generate AI recommendations." },
        { status: 400 }
      );
    }

    const aiResult = await classifyAndAnalyzeProduct(
      {
        title: title.trim(),
        description: description || "",
        features: Array.isArray(features) ? features : [],
        price: price ? String(price) : undefined,
        brand: brand || "",
        categoryHint: categoryHint || "",
      },
      { provider: provider || "heuristic" }
    );

    const cls = aiResult.classification;

    // Resolve category names and match possible subcategories
    const categorySlugs = cls.categories.map((c) => c.slug);
    const themeSlugs = cls.themes.map((t) => t.slug);

    // Identify matched subcategories from canonical categories based on title/features
    const matchedSubcategories: string[] = [];
    const textToMatch = `${title} ${description || ""} ${(features || []).join(" ")}`.toLowerCase();

    for (const catSlug of categorySlugs) {
      const cat = CANONICAL_CATEGORIES.find((c) => c.slug === catSlug);
      if (cat && Array.isArray(cat.subcategories)) {
        for (const sub of cat.subcategories) {
          const subTokens = sub.toLowerCase().split(/[\s&,/]+/);
          if (subTokens.some((tok) => tok.length > 3 && textToMatch.includes(tok))) {
            matchedSubcategories.push(sub);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestedCategories: categorySlugs,
        suggestedThemes: themeSlugs,
        suggestedSubcategories: Array.from(new Set(matchedSubcategories)),
        explanation: cls.recommendationExplanation || cls.summary,
        summary: cls.summary,
        bestFor: cls.bestFor,
        pros: cls.pros,
        cons: cls.cons,
        overallScore: cls.overallScore,
        confidenceLevel: cls.confidenceLevel,
        providerUsed: aiResult.providerUsed,
        requiresReview: aiResult.requiresReview,
        reviewReason: aiResult.reviewReason,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/ai/recommend-taxonomy]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to generate taxonomy recommendations." },
      { status: 500 }
    );
  }
}
