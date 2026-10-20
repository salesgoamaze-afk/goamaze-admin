import { NormalizedCreatorProduct } from "@/lib/amazon-creator";
import { AIProductAnalyzerProvider } from "./provider-interface";
import {
  CategoryAnalysisResult,
  ProductAIAnalysis,
  AnalysisOptions,
  AIProviderStatus,
  DEFAULT_SCORING_WEIGHTS,
  ScoreBreakdown,
  RecommendationAward,
  ConfidenceLevel,
} from "./types";
import { analyzeProductsHeuristic } from "./heuristic-engine";

export class GeminiProvider implements AIProductAnalyzerProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini (Google AI Studio Free Tier)";
  readonly modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  readonly isFreeTier = true;

  private getApiKey(): string | null {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  }

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 10);
  }

  getStatus(): AIProviderStatus {
    const configured = this.isConfigured();
    return {
      id: this.id,
      name: this.name,
      model: this.modelName,
      configured,
      isFreeTier: true,
      contextWindow: "1,000,000+ tokens",
      rateLimitNote: "15 requests/min, 1,500 requests/day (Free tier via Google AI Studio)",
      description: "Generous context window, superior reasoning for multi-product comparison, native JSON output.",
    };
  }

  async analyzeProducts(
    category: string,
    products: NormalizedCreatorProduct[],
    options?: AnalysisOptions
  ): Promise<CategoryAnalysisResult> {
    const weights = options?.weights || DEFAULT_SCORING_WEIGHTS;

    if (!this.isConfigured()) {
      console.warn("[GeminiProvider] GEMINI_API_KEY not configured. Falling back to Heuristic Engine.");
      const heuristicResult = analyzeProductsHeuristic(category, products, weights);
      return {
        ...heuristicResult,
        providerUsed: "Google Gemini (Fallback: Heuristic Engine - Set GEMINI_API_KEY in .env)",
      };
    }

    const apiKey = this.getApiKey()!;
    const startTime = Date.now();

    // Prepare concise product descriptors for Gemini prompt
    const productPayload = products.map((p, idx) => ({
      index: idx,
      asin: p.asin,
      title: p.title,
      brand: p.brand || "Unspecified",
      price: p.price,
      originalPrice: p.originalPrice,
      rating: p.rating,
      reviews: p.reviews,
      badge: p.badge,
      features: p.features.slice(0, 5),
    }));

    const systemPrompt = `You are an expert product analyst and recommendation engine for GoAmaze (an aesthetic, curated e-commerce destination).
Your goal is to evaluate, score, compare, and rank a list of Amazon products for the GoAmaze category/theme: "${category}".

EVALUATION CRITERIA:
1. Customer Satisfaction & Rating: Evaluate ratings (${productPayload.map((p) => p.rating).join(", ")}) and review counts. Balance high stars against review volume (a 5.0 with 2 reviews is unverified; a 4.6 with 2,000 reviews is proven).
2. Product Quality & Specs: Analyze build materials, durability, and feature completeness.
3. Value for Money: Compare price against features and category competitors.
4. Category Relevance: How well each product embodies "${category}".
5. Popularity: Based on review count and demand. Never call a product a 'bestseller' unless authorized evidence supports it.

OUTPUT FORMAT:
Return a JSON object conforming strictly to this structure:
{
  "bestOverallAsin": "ASIN_OF_BEST_PRODUCT",
  "bestValueAsin": "ASIN_OF_BEST_VALUE_PRODUCT",
  "bestBudgetAsin": "ASIN_OF_BEST_BUDGET_PRODUCT",
  "products": [
    {
      "asin": "ASIN",
      "overallScore": 92, // Integer 30-99
      "rank": 1, // 1 to N
      "award": "Best Overall" | "Best Value for Money" | "Best Budget Pick" | "Premium Choice" | "Editor's Top Recommendation" | null,
      "scoreBreakdown": {
        "customerSatisfaction": 90, // 0-100
        "productQuality": 92,        // 0-100
        "valueForMoney": 88,         // 0-100
        "categoryRelevance": 95,     // 0-100
        "popularity": 85             // 0-100
      },
      "aiSummary": "2-3 concise sentences summarizing the product, key strength, and fit for GoAmaze.",
      "pros": ["Concise, evidence-based pro 1", "Evidence-based pro 2", "Evidence-based pro 3"],
      "cons": ["Realistic limitation 1", "Realistic limitation 2"],
      "bestFor": "Clear, specific 'Best For' label (e.g. 'Best for Minimalist Desks', 'Best for Quick Meals')",
      "recommendationReason": "Clear 1-2 sentence evidence-based justification for this score and ranking.",
      "targetAudience": "Intended user or use case",
      "confidenceLevel": "high" | "medium" | "low",
      "dataQualityFlags": [] // e.g. ["Low review count (< 25)"] or []
    }
  ]
}

RULES:
- Rank all ${products.length} products sequentially from 1 (most recommended) to ${products.length} (least recommended).
- OverallScore must reflect the weighted priorities: Satisfaction (${Math.round(weights.customerSatisfaction * 100)}%), Quality (${Math.round(weights.productQuality * 100)}%), Value (${Math.round(weights.valueForMoney * 100)}%), Relevance (${Math.round(weights.categoryRelevance * 100)}%), Popularity (${Math.round(weights.popularity * 100)}%).
- Be completely factual. Do NOT hallucinate features not present in the input.
- Output ONLY valid JSON.`;

    const userPrompt = `Here are the ${products.length} products to analyze for "${category}":\n\n${JSON.stringify(productPayload, null, 2)}`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[GeminiProvider] API Error (${res.status}): ${errorText}. Falling back to Heuristic Engine.`);
        const fallback = analyzeProductsHeuristic(category, products, weights);
        return {
          ...fallback,
          providerUsed: `Google Gemini (${this.modelName} error ${res.status} -> Fallback Heuristic)`,
        };
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed = JSON.parse(rawText);
      const aiProducts: any[] = Array.isArray(parsed.products) ? parsed.products : [];

      // Create ASIN lookup map from input products
      const inputMap = new Map<string, NormalizedCreatorProduct>();
      products.forEach((p) => inputMap.set(p.asin.toUpperCase(), p));

      const now = new Date().toISOString();

      // Merge Gemini analysis with original product records
      const mergedList: ProductAIAnalysis[] = [];

      for (const item of aiProducts) {
        const asin = String(item.asin || "").toUpperCase();
        const original = inputMap.get(asin);
        if (!original) continue;

        let award = item.award as RecommendationAward | undefined;
        let badgeColor = "rgba(255,255,255,0.08)";
        if (award === "Best Overall") badgeColor = "rgba(234, 179, 8, 0.25)";
        else if (award === "Best Value for Money") badgeColor = "rgba(34, 197, 94, 0.25)";
        else if (award === "Best Budget Pick") badgeColor = "rgba(59, 130, 246, 0.25)";
        else if (award === "Premium Choice") badgeColor = "rgba(168, 85, 247, 0.25)";
        else if (award === "Editor's Top Recommendation") badgeColor = "rgba(249, 115, 22, 0.25)";

        const breakdown: ScoreBreakdown = {
          customerSatisfaction: Number(item.scoreBreakdown?.customerSatisfaction ?? 80),
          productQuality: Number(item.scoreBreakdown?.productQuality ?? 80),
          valueForMoney: Number(item.scoreBreakdown?.valueForMoney ?? 80),
          categoryRelevance: Number(item.scoreBreakdown?.categoryRelevance ?? 85),
          popularity: Number(item.scoreBreakdown?.popularity ?? 75),
        };

        const overallScore = Number(item.overallScore || 80);

        mergedList.push({
          asin: original.asin,
          id: original.id,
          title: original.title,
          price: original.price,
          originalPrice: original.originalPrice,
          image: original.image,
          images: original.images || [original.image],
          affiliateLink: original.affiliateLink,
          category: original.category || category,
          rating: original.rating,
          reviews: original.reviews,
          brand: original.brand,
          features: original.features || [],

          overallScore,
          rank: Number(item.rank || mergedList.length + 1),
          award,
          awardBadgeColor: badgeColor,
          scoreBreakdown: breakdown,
          aiSummary: String(item.aiSummary || original.description || original.title),
          pros: Array.isArray(item.pros) ? item.pros : ["Verified customer favorite"],
          cons: Array.isArray(item.cons) ? item.cons : ["Check dimensions before purchase"],
          bestFor: String(item.bestFor || `Best for ${category}`),
          recommendationReason: String(item.recommendationReason || `Ranked highly for ${category}`),
          targetAudience: String(item.targetAudience || `Shoppers interested in ${category}`),
          confidenceLevel: (item.confidenceLevel as ConfidenceLevel) || "high",
          dataQualityFlags: Array.isArray(item.dataQualityFlags) ? item.dataQualityFlags : [],
          curationStatus: "pending",
          lastAnalyzedAt: now,
        });
      }

      // If any items were missed by Gemini, append them using heuristic
      if (mergedList.length < products.length) {
        const analyzedAsins = new Set(mergedList.map((m) => m.asin));
        const missing = products.filter((p) => !analyzedAsins.has(p.asin.toUpperCase()));
        if (missing.length > 0) {
          const fallbackMissing = analyzeProductsHeuristic(category, missing, weights);
          mergedList.push(...fallbackMissing.rankedProducts);
        }
      }

      // Re-sort and re-number ranks 1..N
      mergedList.sort((a, b) => b.overallScore - a.overallScore);
      mergedList.forEach((item, idx) => {
        item.rank = idx + 1;
      });

      // Ensure award assignment
      if (!mergedList.some((p) => p.award === "Best Overall") && mergedList.length > 0) {
        mergedList[0].award = "Best Overall";
        mergedList[0].awardBadgeColor = "rgba(234, 179, 8, 0.25)";
      }

      const duration = Date.now() - startTime;

      return {
        category,
        totalProducts: mergedList.length,
        bestOverall: mergedList.find((p) => p.award === "Best Overall") || mergedList[0],
        bestValue: mergedList.find((p) => p.award === "Best Value for Money"),
        bestBudget: mergedList.find((p) => p.award === "Best Budget Pick"),
        rankedProducts: mergedList,
        providerUsed: `Google Gemini (${this.modelName})`,
        modelUsed: this.modelName,
        executionTimeMs: duration,
        timestamp: now,
        weightsUsed: weights,
      };
    } catch (err: any) {
      console.error("[GeminiProvider] Execution error:", err.message);
      const fallback = analyzeProductsHeuristic(category, products, weights);
      return {
        ...fallback,
        providerUsed: `Google Gemini (Failed: ${err.message} -> Fallback Heuristic)`,
      };
    }
  }
}
