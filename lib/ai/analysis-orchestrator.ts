/**
 * GoAmaze AI Analysis Orchestrator
 * 
 * Orchestrates background and on-demand AI classification and attribute extraction
 * for queued products. Implements idempotent processing, fingerprint diffing,
 * bounded retries, and review queue routing.
 */

import { db, ProductRecord, AnalysisStatus } from "@/lib/db";
import { classifyAndAnalyzeProduct, ClassificationResult } from "./classifier";
import { computeProductDataFingerprint } from "@/lib/product-identifier";

export interface BatchProcessingReport {
  success: boolean;
  timestamp: string;
  totalPending: number;
  processedCount: number;
  analyzedCount: number;
  needsReviewCount: number;
  skippedUnchangedCount: number;
  failedCount: number;
  results: Array<{
    productId: string;
    asin?: string;
    title: string;
    status: AnalysisStatus;
    providerUsed?: string;
    categoriesAssigned: string[];
    themesAssigned: string[];
    requiresReview: boolean;
    error?: string;
  }>;
}

/**
 * Processes pending products in the AI queue.
 */
export async function processPendingAIAnalysisQueue(
  batchSize: number = 10,
  options?: { provider?: string; forceFresh?: boolean }
): Promise<BatchProcessingReport> {
  const timestamp = new Date().toISOString();
  const pendingProducts = await db.getPendingAnalysisProducts(batchSize);

  const report: BatchProcessingReport = {
    success: true,
    timestamp,
    totalPending: pendingProducts.length,
    processedCount: 0,
    analyzedCount: 0,
    needsReviewCount: 0,
    skippedUnchangedCount: 0,
    failedCount: 0,
    results: [],
  };

  if (pendingProducts.length === 0) {
    return report;
  }

  for (const product of pendingProducts) {
    report.processedCount++;

    const currentFingerprint = computeProductDataFingerprint({
      title: product.title,
      description: product.description,
      brand: product.unitPrice,
    });

    // Fingerprint diffing: if product has already been analyzed and data is identical, skip re-running AI
    if (
      !options?.forceFresh &&
      product.analysisStatus === "ANALYZED" &&
      product.dataFingerprint === currentFingerprint &&
      product.categories.length > 0
    ) {
      report.skippedUnchangedCount++;
      report.results.push({
        productId: product.id,
        title: product.title,
        status: "ANALYZED",
        categoriesAssigned: product.categories,
        themesAssigned: product.themes,
        requiresReview: false,
      });
      continue;
    }

    try {
      // Transition state to ANALYZING
      await db.updateAnalysisStatus(product.id, "ANALYZING");

      // Execute AI classification
      const result: ClassificationResult = await classifyAndAnalyzeProduct(
        {
          id: product.id,
          title: product.title,
          brand: product.unitPrice,
          description: product.description,
          features: product.description.includes("•") ? product.description.split("•").map((s) => s.trim()) : [],
          price: product.price,
          rating: product.rating,
          reviews: product.reviews,
          categoryHint: product.category,
        },
        options
      );

      const cls = result.classification;

      // Persist analysis and update many-to-many mappings in database
      const updatedProduct = await db.saveAIAnalysis(product.id, {
        provider: result.providerUsed,
        model: result.providerUsed.includes("(") ? result.providerUsed.split("(")[1].replace(")", "") : "gemini-flash-latest",
        promptVersion: result.promptVersion,
        shortSummary: cls.summary,
        keyFeatures: cls.keyFeatures,
        pros: cls.pros,
        cons: cls.cons,
        bestFor: cls.bestFor.join(", "),
        comparisonAttributes: cls.comparisonAttributes,
        recommendationExplanation: cls.recommendationExplanation,
        categories: cls.categories,
        themes: cls.themes,
        status: result.status,
        dataFingerprint: currentFingerprint,
        overallScore: cls.overallScore,
      });

      if (result.status === "ANALYZED") {
        report.analyzedCount++;
      } else {
        report.needsReviewCount++;
      }

      report.results.push({
        productId: product.id,
        title: product.title,
        status: result.status,
        providerUsed: result.providerUsed,
        categoriesAssigned: cls.categories.map((c) => c.slug),
        themesAssigned: cls.themes.map((t) => t.slug),
        requiresReview: result.requiresReview,
      });
    } catch (err: any) {
      report.failedCount++;
      console.error(`[AI Orchestrator] Failed processing product ${product.id}:`, err.message);

      // Transition to FAILED state without deleting or corrupting product
      await db.updateAnalysisStatus(product.id, "FAILED", err.message);

      report.results.push({
        productId: product.id,
        title: product.title,
        status: "FAILED",
        categoriesAssigned: product.categories,
        themesAssigned: product.themes,
        requiresReview: true,
        error: err.message,
      });
    }
  }

  report.success = report.failedCount === 0;
  return report;
}
