import type { NormalizedCreatorProduct } from "../amazon-creator";
import { AIProductAnalyzerProvider } from "./provider-interface";
import {
  CategoryAnalysisResult,
  AnalysisOptions,
  AIProviderStatus,
  DEFAULT_SCORING_WEIGHTS,
} from "./types";
import { analyzeProductsHeuristic } from "./heuristic-engine";

export class HeuristicProvider implements AIProductAnalyzerProvider {
  readonly id = "heuristic";
  readonly name = "GoAmaze Heuristic AI Engine (Deterministic & Bayesian)";
  readonly modelName = "Deterministic-Rule-v1.2";
  readonly isFreeTier = true;

  isConfigured(): boolean {
    return true; // Always available, zero setup required
  }

  getStatus(): AIProviderStatus {
    return {
      id: this.id,
      name: this.name,
      model: this.modelName,
      configured: true,
      isFreeTier: true,
      contextWindow: "Unlimited (In-Memory Local Engine)",
      rateLimitNote: "Unlimited (0 ms network overhead, 100% operational guarantee)",
      description: "Bayesian smoothed ratings, multi-attribute trade-off scoring, keyword relevance matching, zero hallucinations.",
    };
  }

  async analyzeProducts(
    category: string,
    products: NormalizedCreatorProduct[],
    options?: AnalysisOptions
  ): Promise<CategoryAnalysisResult> {
    const weights = options?.weights || DEFAULT_SCORING_WEIGHTS;
    return analyzeProductsHeuristic(category, products, weights);
  }
}
