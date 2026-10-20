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

export class GroqProvider implements AIProductAnalyzerProvider {
  readonly id = "groq";
  readonly name = "Groq Cloud (Llama 3.3 70B Versatile Free Tier)";
  readonly modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  readonly isFreeTier = true;

  private getApiKey(): string | null {
    return process.env.GROQ_API_KEY || null;
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
      contextWindow: "128,000 tokens",
      rateLimitNote: "30 requests/min, 6,000 requests/day (Free tier via console.groq.com)",
      description: "Ultra-fast inference speed, OpenAI-compatible JSON mode, strong open reasoning.",
    };
  }

  async analyzeProducts(
    category: string,
    products: NormalizedCreatorProduct[],
    options?: AnalysisOptions
  ): Promise<CategoryAnalysisResult> {
    const weights = options?.weights || DEFAULT_SCORING_WEIGHTS;

    if (!this.isConfigured()) {
      const fallback = analyzeProductsHeuristic(category, products, weights);
      return {
        ...fallback,
        providerUsed: "Groq Cloud (Fallback: Heuristic Engine - Set GROQ_API_KEY in .env)",
      };
    }

    const apiKey = this.getApiKey()!;
    const startTime = Date.now();

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

    const systemPrompt = `You are a product recommendation system for GoAmaze.
Evaluate, score, compare, and rank these Amazon products for the category: "${category}".
Return a JSON object conforming strictly to this format:
{
  "bestOverallAsin": "ASIN",
  "bestValueAsin": "ASIN",
  "bestBudgetAsin": "ASIN",
  "products": [
    {
      "asin": "ASIN",
      "overallScore": 90,
      "rank": 1,
      "award": "Best Overall" | "Best Value for Money" | "Best Budget Pick" | "Premium Choice" | null,
      "scoreBreakdown": {
        "customerSatisfaction": 88,
        "productQuality": 90,
        "valueForMoney": 85,
        "categoryRelevance": 92,
        "popularity": 80
      },
      "aiSummary": "2 concise sentences about the product.",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Limitation 1"],
      "bestFor": "Best For Label",
      "recommendationReason": "Evidence-based reason.",
      "targetAudience": "Target audience",
      "confidenceLevel": "high" | "medium" | "low",
      "dataQualityFlags": []
    }
  ]
}
Return only valid JSON.`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(productPayload) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        console.warn(`[GroqProvider] Error ${res.status}. Falling back to Heuristic Engine.`);
        const fallback = analyzeProductsHeuristic(category, products, weights);
        return {
          ...fallback,
          providerUsed: `Groq (${this.modelName} error ${res.status} -> Fallback Heuristic)`,
        };
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      const aiProducts: any[] = Array.isArray(parsed.products) ? parsed.products : [];

      const inputMap = new Map<string, NormalizedCreatorProduct>();
      products.forEach((p) => inputMap.set(p.asin.toUpperCase(), p));
      const now = new Date().toISOString();

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

        const breakdown: ScoreBreakdown = {
          customerSatisfaction: Number(item.scoreBreakdown?.customerSatisfaction ?? 80),
          productQuality: Number(item.scoreBreakdown?.productQuality ?? 80),
          valueForMoney: Number(item.scoreBreakdown?.valueForMoney ?? 80),
          categoryRelevance: Number(item.scoreBreakdown?.categoryRelevance ?? 85),
          popularity: Number(item.scoreBreakdown?.popularity ?? 75),
        };

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

          overallScore: Number(item.overallScore || 80),
          rank: Number(item.rank || mergedList.length + 1),
          award,
          awardBadgeColor: badgeColor,
          scoreBreakdown: breakdown,
          aiSummary: String(item.aiSummary || original.description || original.title),
          pros: Array.isArray(item.pros) ? item.pros : ["Verified quality selection"],
          cons: Array.isArray(item.cons) ? item.cons : ["Subject to stock changes"],
          bestFor: String(item.bestFor || `Best for ${category}`),
          recommendationReason: String(item.recommendationReason || `Ranked highly for ${category}`),
          targetAudience: String(item.targetAudience || `Shoppers interested in ${category}`),
          confidenceLevel: (item.confidenceLevel as ConfidenceLevel) || "high",
          dataQualityFlags: Array.isArray(item.dataQualityFlags) ? item.dataQualityFlags : [],
          curationStatus: "pending",
          lastAnalyzedAt: now,
        });
      }

      if (mergedList.length < products.length) {
        const analyzedAsins = new Set(mergedList.map((m) => m.asin));
        const missing = products.filter((p) => !analyzedAsins.has(p.asin.toUpperCase()));
        if (missing.length > 0) {
          const fallbackMissing = analyzeProductsHeuristic(category, missing, weights);
          mergedList.push(...fallbackMissing.rankedProducts);
        }
      }

      mergedList.sort((a, b) => b.overallScore - a.overallScore);
      mergedList.forEach((item, idx) => {
        item.rank = idx + 1;
      });

      return {
        category,
        totalProducts: mergedList.length,
        bestOverall: mergedList.find((p) => p.award === "Best Overall") || mergedList[0],
        bestValue: mergedList.find((p) => p.award === "Best Value for Money"),
        bestBudget: mergedList.find((p) => p.award === "Best Budget Pick"),
        rankedProducts: mergedList,
        providerUsed: `Groq (${this.modelName})`,
        modelUsed: this.modelName,
        executionTimeMs: Date.now() - startTime,
        timestamp: now,
        weightsUsed: weights,
      };
    } catch (err: any) {
      console.error("[GroqProvider] Execution error:", err.message);
      const fallback = analyzeProductsHeuristic(category, products, weights);
      return {
        ...fallback,
        providerUsed: `Groq (Failed: ${err.message} -> Fallback Heuristic)`,
      };
    }
  }
}
