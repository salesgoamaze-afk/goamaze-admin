import { NormalizedCreatorProduct } from "@/lib/amazon-creator";
import {
  CategoryAnalysisResult,
  AnalysisOptions,
  AIProviderStatus,
} from "./types";

export interface AIProductAnalyzerProvider {
  readonly id: string;
  readonly name: string;
  readonly modelName: string;
  readonly isFreeTier: boolean;

  /**
   * Checks whether the necessary API credentials or requirements are available.
   */
  isConfigured(): boolean;

  /**
   * Returns metadata and rate limit information for admin inspection.
   */
  getStatus(): AIProviderStatus;

  /**
   * Analyzes an array of products for a category or theme,
   * returning ranked products with scores, pros, cons, and awards.
   */
  analyzeProducts(
    category: string,
    products: NormalizedCreatorProduct[],
    options?: AnalysisOptions
  ): Promise<CategoryAnalysisResult>;
}
