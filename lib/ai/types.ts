import type { NormalizedCreatorProduct } from "../amazon-creator";

export interface ScoringWeights {
  customerSatisfaction: number; // default: 0.25 (25%)
  productQuality: number;        // default: 0.25 (25%)
  valueForMoney: number;         // default: 0.25 (25%)
  categoryRelevance: number;     // default: 0.15 (15%)
  popularity: number;            // default: 0.10 (10%)
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  customerSatisfaction: 0.25,
  productQuality: 0.25,
  valueForMoney: 0.25,
  categoryRelevance: 0.15,
  popularity: 0.10,
};

export interface ScoreBreakdown {
  customerSatisfaction: number; // 0 - 100
  productQuality: number;        // 0 - 100
  valueForMoney: number;         // 0 - 100
  categoryRelevance: number;     // 0 - 100
  popularity: number;            // 0 - 100
}

export type RecommendationAward =
  | "Best Overall"
  | "Best Value for Money"
  | "Best Budget Pick"
  | "Premium Choice"
  | "Editor's Top Recommendation"
  | "Trending Favorite"
  | "Notable Mention";

export type ConfidenceLevel = "high" | "medium" | "low";

export type CurationStatus = "pending" | "approved" | "rejected";

export interface ProductAIAnalysis {
  asin: string;
  id: string;
  title: string;
  price: string;
  originalPrice: string;
  image: string;
  images: string[];
  affiliateLink: string;
  category: string;
  rating: number;
  reviews: number;
  brand?: string;
  features: string[];

  // AI & Scoring additions
  overallScore: number;           // 0 - 100
  rank: number;                   // 1 - N
  award?: RecommendationAward;
  awardBadgeColor?: string;
  scoreBreakdown: ScoreBreakdown;
  aiSummary: string;
  pros: string[];
  cons: string[];
  bestFor: string;                // e.g. "Best for busy home cooks", "Best for minimal desk setups"
  recommendationReason: string;   // Evidence-based explanation
  targetAudience: string;
  confidenceLevel: ConfidenceLevel;
  dataQualityFlags: string[];     // Warnings e.g. ["Low review count (< 25)", "Missing price"]
  curationStatus: CurationStatus;
  lastAnalyzedAt: string;
}

export interface CategoryAnalysisResult {
  category: string;
  totalProducts: number;
  bestOverall?: ProductAIAnalysis;
  bestValue?: ProductAIAnalysis;
  bestBudget?: ProductAIAnalysis;
  rankedProducts: ProductAIAnalysis[];
  providerUsed: string;
  modelUsed: string;
  executionTimeMs: number;
  timestamp: string;
  weightsUsed: ScoringWeights;
}

export interface AnalysisOptions {
  weights?: ScoringWeights;
  provider?: string;
  forceFresh?: boolean;
}

export interface AIProviderStatus {
  id: string;
  name: string;
  model: string;
  configured: boolean;
  isFreeTier: boolean;
  contextWindow: string;
  rateLimitNote: string;
  description: string;
}
