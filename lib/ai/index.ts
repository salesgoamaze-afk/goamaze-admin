import { NormalizedCreatorProduct } from "@/lib/amazon-creator";
import { AIProductAnalyzerProvider } from "./provider-interface";
import { GeminiProvider } from "./gemini-provider";
import { GroqProvider } from "./groq-provider";
import { HeuristicProvider } from "./heuristic-provider";
import {
  CategoryAnalysisResult,
  AnalysisOptions,
  AIProviderStatus,
} from "./types";

export * from "./types";
export * from "./heuristic-engine";
export * from "./provider-interface";
export { GeminiProvider } from "./gemini-provider";
export { GroqProvider } from "./groq-provider";
export { HeuristicProvider } from "./heuristic-provider";

// Provider Singletons
const geminiProvider = new GeminiProvider();
const groqProvider = new GroqProvider();
const heuristicProvider = new HeuristicProvider();

const PROVIDERS: Record<string, AIProductAnalyzerProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  heuristic: heuristicProvider,
};

/**
 * Returns the currently active AI provider based on configuration priority:
 * 1. AI_PROVIDER env var (if configured)
 * 2. Gemini (if GEMINI_API_KEY is configured)
 * 3. Groq (if GROQ_API_KEY is configured)
 * 4. Heuristic Engine (zero-dependency fallback)
 */
export function getActiveAIProvider(preferredId?: string): AIProductAnalyzerProvider {
  if (preferredId && PROVIDERS[preferredId.toLowerCase()] && PROVIDERS[preferredId.toLowerCase()].isConfigured()) {
    return PROVIDERS[preferredId.toLowerCase()];
  }

  const envPreferred = process.env.AI_PROVIDER?.toLowerCase();
  if (envPreferred && PROVIDERS[envPreferred] && PROVIDERS[envPreferred].isConfigured()) {
    return PROVIDERS[envPreferred];
  }

  if (groqProvider.isConfigured()) {
    return groqProvider;
  }

  if (geminiProvider.isConfigured()) {
    return geminiProvider;
  }

  return heuristicProvider;
}

/**
 * Returns statuses of all available providers for admin inspection.
 */
export function getAllProviderStatuses(): AIProviderStatus[] {
  return [
    geminiProvider.getStatus(),
    groqProvider.getStatus(),
    heuristicProvider.getStatus(),
  ];
}

// In-memory cache for analysis results (TTL: 15 minutes)
interface CacheEntry {
  result: CategoryAnalysisResult;
  expiresAt: number;
}
const analysisCache = new Map<string, CacheEntry>();

function buildCacheKey(category: string, products: NormalizedCreatorProduct[], options?: AnalysisOptions): string {
  const asins = products.map((p) => p.asin).sort().join(",");
  const weights = options?.weights ? JSON.stringify(options.weights) : "default";
  const provider = options?.provider || "auto";
  return `${category.toLowerCase()}::${asins}::${weights}::${provider}`;
}

/**
 * High-level analysis function with caching and fallback support.
 */
export async function analyzeCategoryProducts(
  category: string,
  products: NormalizedCreatorProduct[],
  options?: AnalysisOptions
): Promise<CategoryAnalysisResult> {
  if (!products || products.length === 0) {
    return heuristicProvider.analyzeProducts(category, [], options);
  }

  const cacheKey = buildCacheKey(category, products, options);

  // Check cache unless forceFresh is requested
  if (!options?.forceFresh) {
    const cached = analysisCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const provider = getActiveAIProvider(options?.provider);

  try {
    const result = await provider.analyzeProducts(category, products, options);

    // Cache the successful result for 15 minutes
    analysisCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return result;
  } catch (err: any) {
    console.warn(`[AI Engine] Provider ${provider.name} failed (${err.message}). Cascading to Heuristic Engine.`);
    const fallbackResult = await heuristicProvider.analyzeProducts(category, products, options);
    return {
      ...fallbackResult,
      providerUsed: `${provider.name} (Error: ${err.message} -> Cascaded to Heuristic)`,
    };
  }
}
