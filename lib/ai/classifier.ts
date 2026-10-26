/**
 * GoAmaze AI Product Classifier & Multi-Taxonomy Recommendation Engine
 * 
 * Classifies products into multiple canonical categories and multiple primary lifestyle themes.
 * Validates output strictly against active database taxonomy, enforcing evidence-based attributes.
 */

import { z } from "zod";
import {
  PRIMARY_THEMES,
  CANONICAL_CATEGORIES,
  isValidCategorySlug,
  isValidThemeSlug,
  mapLegacyCategoryToTaxonomy,
} from "@/lib/taxonomy";
import { computeProductDataFingerprint } from "@/lib/product-identifier";

// ─────────────────────────────────────────────────────────────────────────────
// TAXONOMY ENUMS & SCHEMA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_THEME_SLUGS = PRIMARY_THEMES.map((t) => t.slug);
const VALID_CATEGORY_SLUGS = CANONICAL_CATEGORIES.map((c) => c.slug);

export const ProductClassificationSchema = z.object({
  categories: z.array(
    z.object({
      slug: z.string().refine((val) => isValidCategorySlug(val), {
        message: "Invalid category slug",
      }),
      confidence: z.number().min(0).max(1),
    })
  ).min(1, "At least one category required"),

  themes: z.array(
    z.object({
      slug: z.string().refine((val) => isValidThemeSlug(val), {
        message: "Invalid theme slug",
      }),
      confidence: z.number().min(0).max(1),
    })
  ),

  bestFor: z.array(z.string().min(2).max(100)).max(5).default([]),
  keyFeatures: z.array(z.string().min(2).max(150)).max(8).default([]),
  pros: z.array(z.string().min(2).max(150)).max(5).default([]),
  cons: z.array(z.string().min(2).max(150)).max(4).default([]),
  summary: z.string().max(600).default(""),
  comparisonAttributes: z.record(z.string(), z.string()).default({}),
  confidenceLevel: z.enum(["high", "medium", "low"]).default("high"),
  overallScore: z.number().min(30).max(99).default(80),
  recommendationExplanation: z.string().max(400).default(""),
});

export type ValidatedProductClassification = z.infer<typeof ProductClassificationSchema>;

export interface ClassifierInputProduct {
  id?: string;
  asin?: string;
  title: string;
  brand?: string;
  description?: string;
  features?: string[];
  unitPrice?: string;
  price?: string;
  rating?: number;
  reviews?: number;
  categoryHint?: string;
}

export interface ClassificationResult {
  productId?: string;
  asin?: string;
  classification: ValidatedProductClassification;
  providerUsed: string;
  promptVersion: string;
  dataFingerprint: string;
  status: "ANALYZED" | "NEEDS_REVIEW" | "FAILED";
  requiresReview: boolean;
  reviewReason?: string;
}

const CURRENT_PROMPT_VERSION = "v2.0-multi-tax";

// ─────────────────────────────────────────────────────────────────────────────
// HEURISTIC CLASSIFIER (Zero-API Fallback Engine)
// ─────────────────────────────────────────────────────────────────────────────

export function classifyProductHeuristic(product: ClassifierInputProduct): ValidatedProductClassification {
  const text = `${product.title} ${product.brand || ""} ${product.description || ""} ${(product.features || []).join(" ")} ${product.categoryHint || ""}`.toLowerCase();

  // Match canonical categories
  const matchedCategories: { slug: string; confidence: number }[] = [];

  const categoryChecks: Array<{ slug: string; regex: RegExp; weight: number }> = [
    { slug: "mobiles", regex: /\b(iphone|smartphone|android phone|samsung galaxy|redmi|oneplus|vivo|oppo|realme|cellular phone)\b/i, weight: 0.98 },
    { slug: "mobile-accessories", regex: /\b(phone case|phone cover|back cover|tempered glass|screen protector|lightning cable|type-c cable|phone charm|mobile holder|magsafe|charger|charging cable)\b/i, weight: 0.96 },
    { slug: "audio-accessories", regex: /\b(headphone|headphones|headset|earphones|earbuds|airpods|soundbar|speaker|microphone|audio mic)\b/i.test(text) ? (text.includes("case") && !text.includes("headphone") ? /!/ : /./) : /!/, weight: 0.95 },
    { slug: "computers", regex: /\b(laptop|macbook|desktop pc|thinkpad|chromebook|all-in-one pc|notebook pc)\b/i, weight: 0.96 },
    { slug: "computer-accessories", regex: /\b(keyboard|mouse|mousepad|desk mat|webcam|monitor|monitor stand|monitor arm|laptop stand|usb hub|docking station|hdmi cable)\b/i, weight: 0.95 },
    { slug: "smart-home", regex: /\b(smart bulb|smart plug|smart switch|alexa|google assistant|zigbee|home security|smart sensor|smart led)\b/i, weight: 0.94 },
    { slug: "kitchen-appliances", regex: /\b(air fryer|food processor|mixer|grinder|blender|chopper|electric kettle|coffee maker|toaster|microwave|refrigerator|induction)\b/i, weight: 0.96 },
    { slug: "home-kitchen", regex: /\b(kitchen|cookware|utensils|storage jar|rack|sponge holder|pan|pot|dinnerware|home decor|cushion|vase|sculpture|organizer)\b/i, weight: 0.92 },
    { slug: "furniture", regex: /\b(chair|standing desk|desk table|bookshelf|ergonomic chair|table stand|wooden riser|stool)\b/i, weight: 0.92 },
    { slug: "lighting", regex: /\b(lamp|desk lamp|floor lamp|reading light|lightbar|ambient light|led strip|night light|lantern)\b/i, weight: 0.93 },
    { slug: "personal-care", regex: /\b(shampoo|hair mask|conditioner|face wash|skincare|serum|massager|trimmer|hair dryer|diffuser|essential oil)\b/i, weight: 0.92 },
    { slug: "travel-accessories", regex: /\b(backpack|luggage|travel pouch|cable organizer bag|travel tumbler|passport holder)\b/i, weight: 0.90 },
    { slug: "sports-fitness", regex: /\b(gym|dumbbells|resistance band|yoga mat|protein shaker|workout equipment)\b/i, weight: 0.92 },
    { slug: "gifts", regex: /\b(gift set|gift hamper|festive box|brass thali|diya|handmade gift)\b/i, weight: 0.88 },
  ];

  for (const check of categoryChecks) {
    if (check.regex.test(text)) {
      matchedCategories.push({ slug: check.slug, confidence: check.weight });
    }
  }

  // Fallback to legacy mapper if no direct category match
  if (matchedCategories.length === 0) {
    const legacy = mapLegacyCategoryToTaxonomy(product.categoryHint, product.title);
    legacy.categories.forEach((cat) => {
      if (isValidCategorySlug(cat)) {
        matchedCategories.push({ slug: cat, confidence: 0.85 });
      }
    });
  }

  if (matchedCategories.length === 0) {
    matchedCategories.push({ slug: "home-kitchen", confidence: 0.70 });
  }

  // Match primary lifestyle themes
  const matchedThemes: { slug: string; confidence: number }[] = [];

  // Theme A: Smart Living
  if (
    /\b(home decor|vase|living room|scandinavian|nordic|ambient light|curtain|diffuser|candle|smart bulb|smart home|plant|planter|cleaner|organizer|gadget|space-saving)\b/i.test(text) ||
    matchedCategories.some((c) => ["lighting", "smart-home", "home-kitchen"].includes(c.slug))
  ) {
    // Only if not primarily an exclusive office desk item
    if (!/\b(gaming headset|mechanical keyboard|gaming mouse|laptop stand)\b/i.test(text)) {
      matchedThemes.push({ slug: "smart-living", confidence: 0.92 });
    }
  }

  // Theme B: Work, Study & Gaming
  if (
    /\b(desk|workstation|laptop|computer|monitor|keyboard|mouse|headphone|headset|webcam|gaming|study|reading lamp|ergonomic|desk mat|stationery|focus)\b/i.test(text) ||
    matchedCategories.some((c) => ["computer-accessories", "computers", "furniture", "audio-accessories"].includes(c.slug))
  ) {
    matchedThemes.push({ slug: "work-study-gaming", confidence: 0.95 });
  }

  // Theme C: Kitchen & Everyday Essentials
  if (
    /\b(kitchen|cook|food|appliance|fryer|blender|chopper|coffee|kettle|utensil|tumbler|mug|spice|pan|pot|fridge|refrigerator|groceries|chopping)\b/i.test(text) ||
    matchedCategories.some((c) => ["kitchen-appliances"].includes(c.slug))
  ) {
    matchedThemes.push({ slug: "kitchen-everyday-essentials", confidence: 0.95 });
  }

  // Factual extraction for bestFor and keyFeatures
  const bestForList: string[] = [];
  if (matchedThemes.some((t) => t.slug === "work-study-gaming")) {
    bestForList.push("Productive desk setups & study environments");
  }
  if (matchedThemes.some((t) => t.slug === "kitchen-everyday-essentials")) {
    bestForList.push("Daily culinary prep & modern kitchens");
  }
  if (matchedThemes.some((t) => t.slug === "smart-living")) {
    bestForList.push("Comfortable, organized modern living spaces");
  }
  if (bestForList.length === 0) {
    bestForList.push(`Everyday ${matchedCategories[0]?.slug || "lifestyle"} utility`);
  }

  const features = (product.features || []).slice(0, 4);
  const cleanSummary = product.description && product.description.length > 20
    ? product.description.slice(0, 200).trim()
    : `${product.title} curated for GoAmaze catalog.`;

  return {
    categories: matchedCategories.slice(0, 3),
    themes: matchedThemes.slice(0, 2),
    bestFor: bestForList.slice(0, 3),
    keyFeatures: features.length > 0 ? features : ["Authentic quality", "Verified specifications"],
    pros: ["Verified product specifications", "Practical design for everyday use"],
    cons: ["Check sizing and compatibility before purchase"],
    summary: cleanSummary,
    comparisonAttributes: {
      category: matchedCategories[0]?.slug || "General",
      brand: product.brand || "Authentic",
    },
    confidenceLevel: matchedThemes.length > 0 && matchedCategories[0]?.confidence >= 0.90 ? "high" : "medium",
    overallScore: Math.min(95, Math.max(70, Math.round((product.rating || 4.2) * 18))),
    recommendationExplanation: `Recommended for ${matchedCategories.map((c) => c.slug).join(", ")} based on specifications.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER FOR GEMINI / GROQ
// ─────────────────────────────────────────────────────────────────────────────

function buildClassificationSystemPrompt(): string {
  const themesList = PRIMARY_THEMES.map((t) => `- "${t.slug}": ${t.name} (${t.description})`).join("\n");
  const categoriesList = CANONICAL_CATEGORIES.map((c) => `- "${c.slug}": ${c.name} (${c.description})`).join("\n");

  return `You are the expert GoAmaze AI taxonomy classification and product recommendation engine.
Your task is to classify an Amazon product into its valid canonical categories and lifestyle themes.

APPROVED PRIMARY LIFESTYLE THEMES (Use ONLY these slugs):
${themesList}

APPROVED CANONICAL CATEGORIES (Use ONLY these slugs):
${categoriesList}

CRITICAL TAXONOMY RULES:
1. Categories describe WHAT a product is. Themes describe the lifestyle use-case / setup WHERE it is used.
2. A product can have 1 to 3 categories (e.g. A gaming headset belongs to "audio-accessories" AND "electronics").
3. A product can belong to 0, 1, or 2 themes. Do NOT force every product into a theme!
   - Example: A phone case belongs to category "mobile-accessories", but NO lifestyle theme unless specific setup utility exists.
   - Example: A coffee maker belongs to category "kitchen-appliances" AND "home-kitchen", and theme "kitchen-everyday-essentials".
   - Example: A wireless mechanical keyboard belongs to category "computer-accessories" AND theme "work-study-gaming".
4. Only use exact slugs listed above. Reject any invented slugs.
5. Factual grounding: Do NOT invent features, reviews, or specifications not in the input.

OUTPUT FORMAT:
Return JSON conforming strictly to:
{
  "categories": [
    { "slug": "category-slug", "confidence": 0.95 }
  ],
  "themes": [
    { "slug": "theme-slug", "confidence": 0.90 }
  ],
  "bestFor": ["Clear use-case 1", "Clear use-case 2"],
  "keyFeatures": ["Factual feature 1", "Factual feature 2"],
  "pros": ["Evidence-based pro 1", "Evidence-based pro 2"],
  "cons": ["Realistic limitation 1"],
  "summary": "2-3 concise sentences grounded in the provided data.",
  "comparisonAttributes": {
    "keySpec": "value"
  },
  "overallScore": 85,
  "confidenceLevel": "high" | "medium" | "low",
  "recommendationExplanation": "1-2 sentence evidence-based reason for this recommendation."
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASSIFIER SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export async function classifyAndAnalyzeProduct(
  product: ClassifierInputProduct,
  options?: { provider?: string; forceFresh?: boolean }
): Promise<ClassificationResult> {
  const fingerprint = computeProductDataFingerprint({
    title: product.title,
    description: product.description,
    features: product.features,
    brand: product.brand,
    price: product.price,
  });

  const promptVersion = CURRENT_PROMPT_VERSION;

  // 1. Check Gemini Provider
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const preferred = (options?.provider || process.env.AI_PROVIDER || "auto").toLowerCase();

  // Try Groq Cloud first when auto or groq is preferred (Groq gives sub-second 500ms responses)
  if ((preferred === "auto" || preferred === "groq") && groqApiKey && groqApiKey.length > 10) {
    const candidateModels = Array.from(new Set([process.env.GROQ_MODEL || "openai/gpt-oss-120b", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]));
    for (const model of candidateModels) {
      try {
        const userContent = JSON.stringify({
          title: product.title,
          brand: product.brand || "Unspecified",
          description: (product.description || "").slice(0, 1000),
          features: (product.features || []).slice(0, 6),
          categoryHint: product.categoryHint,
        });

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(4000), // 4s strict timeout
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: buildClassificationSystemPrompt() },
              { role: "user", content: `Classify this product:\n${userContent}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const rawText = json.choices?.[0]?.message?.content;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const validated = ProductClassificationSchema.parse(parsed);

            const lowestConf = Math.min(
              ...validated.categories.map((c) => c.confidence),
              ...(validated.themes.length > 0 ? validated.themes.map((t) => t.confidence) : [1.0])
            );

            const requiresReview = lowestConf < 0.70;

            return {
              productId: product.id,
              asin: product.asin,
              classification: validated,
              providerUsed: `Groq Cloud (${model})`,
              promptVersion,
              dataFingerprint: fingerprint,
              status: requiresReview ? "NEEDS_REVIEW" : "ANALYZED",
              requiresReview,
              reviewReason: requiresReview ? `Confidence score ${lowestConf.toFixed(2)} is below 0.70 threshold.` : undefined,
            };
          }
        } else {
          console.warn(`[AI Classifier] Groq model ${model} returned ${res.status}. Trying next candidate if available.`);
        }
      } catch (err: any) {
        console.warn(`[AI Classifier] Groq error (${err.message}) with model ${model}.`);
      }
    }
  }

  // Try Google Gemini
  if ((preferred === "auto" || preferred === "gemini") && geminiApiKey && geminiApiKey.length > 10) {
    const candidateModels = Array.from(new Set([process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]));
    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

        const userContent = JSON.stringify({
          title: product.title,
          brand: product.brand || "Unspecified",
          description: (product.description || "").slice(0, 1000),
          features: (product.features || []).slice(0, 6),
          unitPrice: product.unitPrice,
          price: product.price,
          rating: product.rating,
          reviews: product.reviews,
          categoryHint: product.categoryHint,
        });

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(4000), // 4s strict timeout
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${buildClassificationSystemPrompt()}\n\nAnalyze this product:\n${userContent}` }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const validated = ProductClassificationSchema.parse(parsed);

            // Check confidence threshold
            const lowestConf = Math.min(
              ...validated.categories.map((c) => c.confidence),
              ...(validated.themes.length > 0 ? validated.themes.map((t) => t.confidence) : [1.0])
            );

            const requiresReview = lowestConf < 0.70;

            return {
              productId: product.id,
              asin: product.asin,
              classification: validated,
              providerUsed: `Google Gemini (${model})`,
              promptVersion,
              dataFingerprint: fingerprint,
              status: requiresReview ? "NEEDS_REVIEW" : "ANALYZED",
              requiresReview,
              reviewReason: requiresReview ? `Confidence score ${lowestConf.toFixed(2)} is below 0.70 threshold.` : undefined,
            };
          }
        } else {
          console.warn(`[AI Classifier] Gemini model ${model} returned ${res.status}. Trying next candidate if available.`);
        }
      } catch (err: any) {
        console.warn(`[AI Classifier] Gemini error (${err.message}) with model ${model}.`);
      }
    }
  }

  // Deterministic Heuristic Engine Fallback
  const heuristicResult = classifyProductHeuristic(product);
  const validated = ProductClassificationSchema.parse(heuristicResult);

  return {
    productId: product.id,
    asin: product.asin,
    classification: validated,
    providerUsed: "Deterministic Heuristic Engine",
    promptVersion: `${promptVersion}-heuristic`,
    dataFingerprint: fingerprint,
    status: validated.confidenceLevel === "low" ? "NEEDS_REVIEW" : "ANALYZED",
    requiresReview: validated.confidenceLevel === "low",
    reviewReason: validated.confidenceLevel === "low" ? "Rule-based heuristic classification requires manual verification." : undefined,
  };
}

export const classifyProductWithAI = classifyAndAnalyzeProduct;
