import fs from "fs";
import path from "path";
import { db, ProductRecord } from "@/lib/db";
import {
  CategoryAnalysisResult,
  ProductAIAnalysis,
  CurationStatus,
} from "./ai/types";

const DATA_FILE = path.join(process.cwd(), "data", "ai-curation-batches.json");

// In-memory cache for fast access
let memoryBatches: Record<string, CategoryAnalysisResult> = {};

function loadFromDisk(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      memoryBatches = JSON.parse(raw);
    }
  } catch (err: any) {
    console.warn("[RecommendationsStore] Could not load batches from disk:", err.message);
    memoryBatches = {};
  }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryBatches, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[RecommendationsStore] Could not save batches to disk:", err.message);
  }
}

// Initial load
loadFromDisk();

export const recommendationsStore = {
  /**
   * Saves or updates a full category analysis run.
   */
  saveBatch(batch: CategoryAnalysisResult): void {
    const key = batch.category.toLowerCase().trim();
    memoryBatches[key] = batch;
    saveToDisk();
  },

  /**
   * Retrieves the latest analysis run for a given category.
   */
  getBatch(category: string): CategoryAnalysisResult | null {
    const key = category.toLowerCase().trim();
    return memoryBatches[key] || null;
  },

  /**
   * Returns all recent curation batches.
   */
  getAllBatches(): CategoryAnalysisResult[] {
    return Object.values(memoryBatches);
  },

  /**
   * Updates the curation status of a specific product within a batch.
   */
  updateProductStatus(
    category: string,
    asin: string,
    status: CurationStatus
  ): ProductAIAnalysis | null {
    const key = category.toLowerCase().trim();
    const batch = memoryBatches[key];
    if (!batch) return null;

    const prod = batch.rankedProducts.find((p) => p.asin.toUpperCase() === asin.toUpperCase());
    if (prod) {
      prod.curationStatus = status;
      saveToDisk();
      return prod;
    }
    return null;
  },

  /**
   * Approves a product and saves it directly to the GoAmaze product database.
   */
  async approveAndPublishProduct(product: ProductAIAnalysis): Promise<ProductRecord | null> {
    const cleanAsin = product.asin.toUpperCase();

    // Check if product already exists in database
    const existing = await db.checkExistingAsins([cleanAsin]);
    const cleanDescription = product.aiSummary
      ? `${product.aiSummary}\n\nKey Highlights:\n${product.pros.map((p) => `• ${p}`).join("\n")}`
      : product.features.join(" • ");

    // Embed structured AI metadata inside description for zero-dependency persistence
    const aiMetadata = {
      aiScore: product.overallScore,
      scoreBreakdown: product.scoreBreakdown,
      rank: product.rank,
      award: product.award,
      aiSummary: product.aiSummary,
      pros: product.pros,
      cons: product.cons,
      bestFor: product.bestFor,
      recommendationReason: product.recommendationReason,
      confidenceLevel: product.confidenceLevel,
      targetAudience: product.targetAudience,
      dataQualityFlags: product.dataQualityFlags || [],
      curationStatus: "approved",
      lastAnalyzedAt: product.lastAnalyzedAt,
    };
    const enrichedDescription = `${cleanDescription}\n\n<!-- AI_DATA: ${JSON.stringify(aiMetadata)} -->`;

    const productPayload: any = {
      id: `prod_amz_${cleanAsin.toLowerCase()}`,
      title: product.title.trim(),
      subtitle: product.bestFor || product.title.slice(0, 70),
      description: enrichedDescription,
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      category: product.category,
      image: product.image,
      images: product.images && product.images.length > 0 ? product.images : [product.image],
      affiliateLink: product.affiliateLink,
      badge: product.award || "Amazon Pick",
      rating: product.rating,
      reviews: product.reviews,
      featured: product.award === "Best Overall",
      source: "amazon",
      // Include direct AI fields (used if database table has native columns)
      aiScore: product.overallScore,
      aiScoreBreakdown: product.scoreBreakdown,
      rank: product.rank,
      award: product.award,
      aiSummary: product.aiSummary,
      bestFor: product.bestFor,
      pros: product.pros,
      cons: product.cons,
      recommendationReason: product.recommendationReason,
      targetAudience: product.targetAudience,
      confidenceLevel: product.confidenceLevel,
      dataQualityFlags: product.dataQualityFlags || [],
      curationStatus: "approved",
      lastAnalyzedAt: product.lastAnalyzedAt,
    };

    let result: ProductRecord | null = null;

    if (existing && existing.length > 0) {
      // Find the ID to update
      const all = await db.getProducts({ limit: 1000 });
      const target = all.find((p) => p.id.includes(cleanAsin.toLowerCase()) || p.affiliateLink.includes(cleanAsin));
      if (target) {
        result = await db.updateProduct(target.id, productPayload);
      } else {
        result = await db.createProduct(productPayload);
      }
    } else {
      result = await db.createProduct(productPayload);
    }

    // Mark as approved in recommendation store
    this.updateProductStatus(product.category, product.asin, "approved");

    return result;
  },

  /**
   * Batch approve multiple products at once.
   */
  async approveAndPublishBatch(products: ProductAIAnalysis[]): Promise<{ count: number; ids: string[] }> {
    let count = 0;
    const ids: string[] = [];

    for (const p of products) {
      try {
        const saved = await this.approveAndPublishProduct(p);
        if (saved) {
          count++;
          ids.push(saved.id);
        }
      } catch (err: any) {
        console.error(`[RecommendationsStore] Failed to approve ${p.asin}:`, err.message);
      }
    }

    return { count, ids };
  },
};
