import { NextResponse } from "next/server";
import { getAllProviderStatuses, getActiveAIProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/providers
 * Returns information about available free AI providers, configuration status, and limits.
 */
export async function GET() {
  try {
    const providers = getAllProviderStatuses();
    const activeProvider = getActiveAIProvider();

    return NextResponse.json({
      success: true,
      activeProvider: {
        id: activeProvider.id,
        name: activeProvider.name,
        model: activeProvider.modelName,
        isFreeTier: activeProvider.isFreeTier,
      },
      providers,
      setupInstructions: {
        gemini: {
          envVar: "GEMINI_API_KEY",
          url: "https://aistudio.google.com/app/apikey",
          freeTierDetails: "15 requests/min, 1,500 requests/day free forever with Google account.",
        },
        groq: {
          envVar: "GROQ_API_KEY",
          url: "https://console.groq.com/keys",
          freeTierDetails: "30 requests/min, 6,000 requests/day free tier for Llama 3.3 70B.",
        },
        heuristic: {
          envVar: "None required",
          freeTierDetails: "Built-in local Bayesian rating smoothing & deterministic multi-criteria scoring.",
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to inspect AI providers" },
      { status: 500 }
    );
  }
}
