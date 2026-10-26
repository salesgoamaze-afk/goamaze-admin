"use client";

import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { STOREFRONT_THEMES } from "@/app/admin/amazon-import/page";
import {
  ProductAIAnalysis,
  CategoryAnalysisResult,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  RecommendationAward,
} from "@/lib/ai/types";

interface AIProviderInfo {
  id: string;
  name: string;
  model: string;
  configured: boolean;
  isFreeTier: boolean;
  rateLimitNote: string;
  description: string;
}

export default function AIRecommendationsPage() {
  // Theme & Query selection
  const [selectedCategory, setSelectedCategory] = useState("Smart Kitchen");
  const [keywords, setKeywords] = useState("");
  const [itemLimit, setItemLimit] = useState(20);
  const [asinsInput, setAsinsInput] = useState("");
  const [queryMode, setQueryMode] = useState<"category" | "asins">("category");

  // Scoring Weights state
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);

  // Provider state
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");
  const [activeProviderName, setActiveProviderName] = useState<string>("");

  // Analysis result state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CategoryAnalysisResult | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [awardFilter, setAwardFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Inline editing state for admin refinement
  const [editedFields, setEditedFields] = useState<Record<string, { bestFor?: string; aiSummary?: string }>>({});

  // Action status feedback
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [approvingAsin, setApprovingAsin] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Load AI providers & check for existing saved recommendation batch on mount
  useEffect(() => {
    fetch("/api/ai/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProviders(data.providers || []);
          if (data.activeProvider) {
            setActiveProviderName(data.activeProvider.name);
          }
        }
      })
      .catch((err) => console.warn("Failed to load AI providers:", err));

    // Load any existing recommendation run for default category
    loadSavedCategoryBatch(selectedCategory);
  }, []);

  const loadSavedCategoryBatch = async (categoryName: string) => {
    try {
      const res = await fetch(`/api/ai/recommendations?category=${encodeURIComponent(categoryName)}`);
      const data = await res.json();
      if (data.success && data.found && data.batch) {
        setAnalysisResult(data.batch);
      }
    } catch (e) {
      console.warn("Could not load saved batch:", e);
    }
  };

  const handleSelectTheme = (themeName: string, themeKeywords: string) => {
    setSelectedCategory(themeName);
    setKeywords(themeKeywords);
    loadSavedCategoryBatch(themeName);
  };

  // Run AI Analysis
  const handleRunAnalysis = async (forceFresh: boolean = false) => {
    setAnalyzing(true);
    setActionNotice(null);

    try {
      const payload: any = {
        category: selectedCategory,
        weights,
        provider: selectedProvider === "auto" ? undefined : selectedProvider,
        forceFresh,
        limit: itemLimit,
      };

      if (queryMode === "category") {
        if (keywords.trim()) payload.keywords = keywords.trim();
      } else {
        const cleanedAsins = asinsInput
          .split(/[\s,;\n]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z0-9]{10}$/.test(s));

        if (cleanedAsins.length === 0) {
          setActionNotice({
            type: "error",
            text: "Please enter at least one valid 10-character Amazon ASIN.",
          });
          setAnalyzing(false);
          return;
        }
        payload.asins = cleanedAsins;
      }

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionNotice({
          type: "error",
          text: data.error || "AI analysis failed. Please verify API configuration or try again.",
        });
        return;
      }

      setAnalysisResult(data);
      setActionNotice({
        type: "success",
        text: `Analysis complete! Evaluated and ranked ${data.totalProducts} products using ${data.providerUsed}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: "error",
        text: `Network error running AI analysis: ${err.message}`,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Single Product Approval
  const handleApproveProduct = async (product: ProductAIAnalysis) => {
    setApprovingAsin(product.asin);
    setActionNotice(null);

    // Merge any inline admin edits before saving
    const edits = editedFields[product.asin] || {};
    const effectiveProduct: ProductAIAnalysis = {
      ...product,
      bestFor: edits.bestFor !== undefined ? edits.bestFor : product.bestFor,
      aiSummary: edits.aiSummary !== undefined ? edits.aiSummary : product.aiSummary,
      curationStatus: "approved",
    };

    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_single",
          product: effectiveProduct,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Update local state to show approved
        if (analysisResult) {
          const updatedList = analysisResult.rankedProducts.map((p) =>
            p.asin === product.asin ? { ...p, curationStatus: "approved" as const } : p
          );
          setAnalysisResult({ ...analysisResult, rankedProducts: updatedList });
        }
        setActionNotice({
          type: "success",
          text: `"${product.title.slice(0, 45)}…" saved to GoAmaze database and published!`,
        });
      } else {
        setActionNotice({
          type: "error",
          text: data.error || "Failed to approve product.",
        });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: `Approval error: ${err.message}` });
    } finally {
      setApprovingAsin(null);
    }
  };

  // Reject / Dismiss Product
  const handleRejectProduct = async (product: ProductAIAnalysis) => {
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_single",
          category: selectedCategory,
          asin: product.asin,
        }),
      });

      if (res.ok) {
        if (analysisResult) {
          const updatedList = analysisResult.rankedProducts.map((p) =>
            p.asin === product.asin ? { ...p, curationStatus: "rejected" as const } : p
          );
          setAnalysisResult({ ...analysisResult, rankedProducts: updatedList });
        }
        setActionNotice({
          type: "info",
          text: `Product ${product.asin} rejected from recommendations.`,
        });
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message });
    }
  };

  // Batch Approval of Top Picks
  const handleBatchApprove = async (count: number = 3) => {
    if (!analysisResult || analysisResult.rankedProducts.length === 0) return;
    setBulkApproving(true);
    setActionNotice(null);

    // Pick top N products that are not yet approved
    const candidates = analysisResult.rankedProducts
      .filter((p) => p.curationStatus !== "rejected")
      .slice(0, count)
      .map((p) => {
        const edits = editedFields[p.asin] || {};
        return {
          ...p,
          bestFor: edits.bestFor !== undefined ? edits.bestFor : p.bestFor,
          aiSummary: edits.aiSummary !== undefined ? edits.aiSummary : p.aiSummary,
          curationStatus: "approved" as const,
        };
      });

    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_batch",
          products: candidates,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const approvedAsins = new Set(candidates.map((c) => c.asin));
        const updatedList = analysisResult.rankedProducts.map((p) =>
          approvedAsins.has(p.asin) ? { ...p, curationStatus: "approved" as const } : p
        );
        setAnalysisResult({ ...analysisResult, rankedProducts: updatedList });
        setActionNotice({
          type: "success",
          text: data.message || `Approved and published top ${candidates.length} products to GoAmaze database!`,
        });
      } else {
        setActionNotice({
          type: "error",
          text: data.error || "Failed to batch approve products.",
        });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message });
    } finally {
      setBulkApproving(false);
    }
  };

  // Periodic Re-Analysis
  const handleReanalyzeCategory = async () => {
    if (!analysisResult) return;
    setReanalyzing(true);
    setActionNotice(null);

    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reanalyze",
          category: selectedCategory,
          weights,
          provider: selectedProvider === "auto" ? undefined : selectedProvider,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.batch) {
        setAnalysisResult(data.batch);
        setActionNotice({
          type: "success",
          text: data.message || "Re-analysis complete! Updated with latest Amazon prices & ratings.",
        });
      } else {
        setActionNotice({
          type: "error",
          text: data.error || "Could not re-analyze category.",
        });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message });
    } finally {
      setReanalyzing(false);
    }
  };

  // Filtered product list
  const filteredProducts = useMemo(() => {
    if (!analysisResult) return [];
    let list = analysisResult.rankedProducts;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.asin.toLowerCase().includes(q) ||
          p.bestFor.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    if (awardFilter !== "all") {
      if (awardFilter === "top_picks") {
        list = list.filter((p) => Boolean(p.award) || p.rank <= 3);
      } else {
        list = list.filter((p) => p.award?.toLowerCase().includes(awardFilter.toLowerCase()));
      }
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => p.curationStatus === statusFilter);
    }

    return list;
  }, [analysisResult, searchFilter, awardFilter, statusFilter]);

  const publishedCount = useMemo(() => {
    if (!analysisResult) return 0;
    return analysisResult.rankedProducts.filter((p) => p.curationStatus === "approved").length;
  }, [analysisResult]);

  return (
    <AdminLayout title="AI Product Recommendations">
      {/* Notice Feedback Banner */}
      {actionNotice && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: "14px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              actionNotice.type === "success"
                ? "rgba(16,185,129,0.15)"
                : actionNotice.type === "error"
                ? "rgba(239,68,68,0.15)"
                : "rgba(59,130,246,0.15)",
            border: `1px solid ${
              actionNotice.type === "success"
                ? "rgba(16,185,129,0.3)"
                : actionNotice.type === "error"
                ? "rgba(239,68,68,0.3)"
                : "rgba(59,130,246,0.3)"
            }`,
            color:
              actionNotice.type === "success"
                ? "#34D399"
                : actionNotice.type === "error"
                ? "#FCA5A5"
                : "#93C5FD",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          <span>
            {actionNotice.type === "success" ? "✓" : actionNotice.type === "error" ? "⚠️" : "ℹ️"} {actionNotice.text}
          </span>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.9rem" }}>🧠</span>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#F8FAFC",
                fontFamily: "'Montserrat', sans-serif",
                margin: 0,
              }}
            >
              AI Product Analysis & Recommendation Engine
            </h2>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "0.88rem", margin: 0, maxWidth: "720px" }}>
            Transform raw Amazon Creators API catalog data into evidence-based, transparently scored product
            shortlists. Discover top-rated items, review AI pros & cons, tune evaluation weights, and approve picks for publication.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/admin/amazon-import"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#CBD5E1",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🛒 Raw Amazon Import Hub
          </Link>
          <Link
            href="/admin/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#CBD5E1",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🛍️ View Published Catalogue
          </Link>
        </div>
      </div>

      {/* Control Panel Card */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.65)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "20px",
          padding: "24px",
          marginBottom: "28px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Storefront Theme Selector Pills */}
        <div style={{ marginBottom: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🎯 Select GoAmaze Storefront Theme
            </span>
            <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
              Active AI Provider: <strong style={{ color: "#F8FAFC" }}>{activeProviderName || "Auto-Cascade"}</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {STOREFRONT_THEMES.map((theme) => {
              const isActive = selectedCategory.toLowerCase() === theme.name.toLowerCase();
              return (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => handleSelectTheme(theme.name, theme.keywords)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    fontSize: "0.86rem",
                    fontWeight: isActive ? 800 : 600,
                    cursor: "pointer",
                    border: isActive ? "1px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.12)",
                    background: isActive
                      ? "linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)"
                      : "rgba(255, 255, 255, 0.04)",
                    color: isActive ? "#FFFFFF" : "#CBD5E1",
                    boxShadow: isActive ? "0 0 16px rgba(59, 130, 246, 0.45)" : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <span>{theme.icon}</span>
                  <span>{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Parameters Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
            marginBottom: "20px",
          }}
        >
          {/* Query Mode Toggle */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
              Input Source Mode
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setQueryMode("category")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: queryMode === "category" ? "#3B82F6" : "rgba(15,23,42,0.8)",
                  color: queryMode === "category" ? "#FFFFFF" : "#94A3B8",
                }}
              >
                🏷️ By Category
              </button>
              <button
                type="button"
                onClick={() => setQueryMode("asins")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: queryMode === "asins" ? "#3B82F6" : "rgba(15,23,42,0.8)",
                  color: queryMode === "asins" ? "#FFFFFF" : "#94A3B8",
                }}
              >
                🔢 By ASINs
              </button>
            </div>
          </div>

          {/* AI Provider Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
              AI Model Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#F8FAFC",
                fontSize: "0.88rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="auto">✨ Auto (Recommended Free AI)</option>
              <option value="gemini">Google Gemini 1.5 Flash (Free Tier)</option>
              <option value="groq">Groq Cloud - Llama 3.3 70B (Free Tier)</option>
              <option value="heuristic">Heuristic Bayesian Scorer (Built-in)</option>
            </select>
          </div>

          {/* Sample Size Limit */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
              Product Sample Size
            </label>
            <select
              value={itemLimit}
              onChange={(e) => setItemLimit(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#F8FAFC",
                fontSize: "0.88rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value={10}>Top 10 Products</option>
              <option value={20}>Top 20 Products (Recommended)</option>
              <option value={30}>Top 30 Products</option>
              <option value={50}>Deep Scan (50 Products)</option>
            </select>
          </div>

          {/* Analyze CTA Button */}
          <div>
            <button
              type="button"
              disabled={analyzing}
              onClick={() => handleRunAnalysis(true)}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: "12px",
                background: analyzing
                  ? "rgba(148, 163, 184, 0.2)"
                  : "linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%)",
                border: "none",
                color: "#FFFFFF",
                fontSize: "0.95rem",
                fontWeight: 800,
                cursor: analyzing ? "not-allowed" : "pointer",
                boxShadow: analyzing ? "none" : "0 4px 18px rgba(139,92,246,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.2s ease",
              }}
            >
              {analyzing ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Analyzing with AI…</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Fetch & Analyze with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ASIN Input Box (if ASIN mode selected) */}
        {queryMode === "asins" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
              Enter Amazon ASINs (Comma, Space, or Line Separated)
            </label>
            <textarea
              rows={2}
              value={asinsInput}
              onChange={(e) => setAsinsInput(e.target.value)}
              placeholder="e.g. B08N5WRWNW, B09B2SBHQK, B0FN41SQQ7"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#F8FAFC",
                fontSize: "0.85rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Expandable Scoring Weights Tuner */}
        <div>
          <button
            type="button"
            onClick={() => setShowWeightsConfig(!showWeightsConfig)}
            style={{
              background: "none",
              border: "none",
              color: "#93C5FD",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: 0,
            }}
          >
            <span>{showWeightsConfig ? "▼" : "▶"}</span>
            <span>Configure AI Scoring Weights ({Math.round(weights.customerSatisfaction * 100)}% Satisfaction, {Math.round(weights.productQuality * 100)}% Quality, {Math.round(weights.valueForMoney * 100)}% Value)</span>
          </button>

          {showWeightsConfig && (
            <div
              style={{
                marginTop: "14px",
                padding: "16px",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#CBD5E1", marginBottom: "6px" }}>
                  <span>Customer Satisfaction</span>
                  <strong>{Math.round(weights.customerSatisfaction * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={weights.customerSatisfaction}
                  onChange={(e) => setWeights({ ...weights, customerSatisfaction: parseFloat(e.target.value) })}
                  style={{ width: "100%", accentColor: "#3B82F6" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#CBD5E1", marginBottom: "6px" }}>
                  <span>Build Quality & Specs</span>
                  <strong>{Math.round(weights.productQuality * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={weights.productQuality}
                  onChange={(e) => setWeights({ ...weights, productQuality: parseFloat(e.target.value) })}
                  style={{ width: "100%", accentColor: "#8B5CF6" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#CBD5E1", marginBottom: "6px" }}>
                  <span>Value for Money</span>
                  <strong>{Math.round(weights.valueForMoney * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={weights.valueForMoney}
                  onChange={(e) => setWeights({ ...weights, valueForMoney: parseFloat(e.target.value) })}
                  style={{ width: "100%", accentColor: "#10B981" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#CBD5E1", marginBottom: "6px" }}>
                  <span>Category Fit</span>
                  <strong>{Math.round(weights.categoryRelevance * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.4"
                  step="0.05"
                  value={weights.categoryRelevance}
                  onChange={(e) => setWeights({ ...weights, categoryRelevance: parseFloat(e.target.value) })}
                  style={{ width: "100%", accentColor: "#F59E0B" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#CBD5E1", marginBottom: "6px" }}>
                  <span>Popularity & Demand</span>
                  <strong>{Math.round(weights.popularity * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.3"
                  step="0.05"
                  value={weights.popularity}
                  onChange={(e) => setWeights({ ...weights, popularity: parseFloat(e.target.value) })}
                  style={{ width: "100%", accentColor: "#EC4899" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Results Display */}
      {analysisResult && (
        <div>
          {/* Summary KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {/* Best Overall */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(202, 138, 4, 0.05) 100%)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                borderRadius: "18px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>🏆</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#FDE047", textTransform: "uppercase" }}>
                  Best Overall Pick
                </span>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px", lineHeight: 1.3 }}>
                {analysisResult.bestOverall?.title.slice(0, 55)}…
              </div>
              <div style={{ fontSize: "0.82rem", color: "#CBD5E1" }}>
                Score: <strong style={{ color: "#FDE047" }}>{analysisResult.bestOverall?.overallScore}/100</strong> • {analysisResult.bestOverall?.price}
              </div>
            </div>

            {/* Best Value */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(22, 163, 74, 0.05) 100%)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                borderRadius: "18px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>💰</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#86EFAC", textTransform: "uppercase" }}>
                  Best Value for Money
                </span>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px", lineHeight: 1.3 }}>
                {analysisResult.bestValue?.title.slice(0, 55) || "N/A"}…
              </div>
              <div style={{ fontSize: "0.82rem", color: "#CBD5E1" }}>
                Score: <strong style={{ color: "#86EFAC" }}>{analysisResult.bestValue?.overallScore || 0}/100</strong> • {analysisResult.bestValue?.price || ""}
              </div>
            </div>

            {/* Best Budget */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.05) 100%)",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                borderRadius: "18px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>🏷️</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#93C5FD", textTransform: "uppercase" }}>
                  Best Budget Option
                </span>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px", lineHeight: 1.3 }}>
                {analysisResult.bestBudget?.title.slice(0, 55) || "N/A"}…
              </div>
              <div style={{ fontSize: "0.82rem", color: "#CBD5E1" }}>
                Price: <strong style={{ color: "#93C5FD" }}>{analysisResult.bestBudget?.price || ""}</strong> • Score: {analysisResult.bestBudget?.overallScore || 0}/100
              </div>
            </div>

            {/* Batch Stats & Actions */}
            <div
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "18px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>
                  Evaluated with {analysisResult.providerUsed}
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#FFFFFF" }}>
                  {analysisResult.totalProducts} Products Ranked
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  disabled={bulkApproving}
                  onClick={() => handleBatchApprove(3)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "#10B981",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ Approve Top 3
                </button>
                <button
                  type="button"
                  disabled={reanalyzing}
                  onClick={handleReanalyzeCategory}
                  title="Refresh live prices & ratings from Amazon Creators API"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#CBD5E1",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔄 {reanalyzing ? "Syncing…" : "Re-sync"}
                </button>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            {/* Search Input */}
            <div style={{ flex: "1 1 240px", maxWidth: "340px" }}>
              <input
                type="text"
                placeholder="Search ranked products…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#F8FAFC",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setAwardFilter("all")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: awardFilter === "all" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)",
                  color: awardFilter === "all" ? "#FFFFFF" : "#94A3B8",
                }}
              >
                All Ranked ({analysisResult.rankedProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setAwardFilter("top_picks")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: awardFilter === "top_picks" ? "#8B5CF6" : "rgba(255,255,255,0.05)",
                  color: "#FFFFFF",
                }}
              >
                ⭐ Top Award Picks
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: statusFilter === "approved" ? "#10B981" : "rgba(255,255,255,0.05)",
                  color: "#FFFFFF",
                }}
              >
                ✓ Published Only ({publishedCount})
              </button>
            </div>
          </div>

          {/* Ranked Product Cards Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {filteredProducts.map((p) => {
              const isApproved = p.curationStatus === "approved";
              const isRejected = p.curationStatus === "rejected";
              const edits = editedFields[p.asin] || {};

              return (
                <div
                  key={p.asin}
                  style={{
                    background: isApproved
                      ? "rgba(16, 185, 129, 0.06)"
                      : isRejected
                      ? "rgba(239, 68, 68, 0.05)"
                      : "rgba(30, 41, 59, 0.55)",
                    border: isApproved
                      ? "1px solid rgba(16, 185, 129, 0.35)"
                      : isRejected
                      ? "1px solid rgba(239, 68, 68, 0.25)"
                      : p.rank <= 3
                      ? "1px solid rgba(139, 92, 246, 0.35)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "18px",
                    padding: "22px",
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 280px",
                    gap: "20px",
                    alignItems: "start",
                    opacity: isRejected ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Left: Product Image & Rank Badge */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        left: "-8px",
                        background:
                          p.rank === 1
                            ? "#EAB308"
                            : p.rank === 2
                            ? "#94A3B8"
                            : p.rank === 3
                            ? "#D97706"
                            : "rgba(15, 23, 42, 0.9)",
                        color: p.rank <= 3 ? "#000000" : "#FFFFFF",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "0.8rem",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                        zIndex: 2,
                      }}
                    >
                      #{p.rank}
                    </div>

                    <img
                      src={p.image || "/placeholder.png"}
                      alt={p.title}
                      style={{
                        width: "100px",
                        height: "100px",
                        objectFit: "contain",
                        background: "#FFFFFF",
                        borderRadius: "12px",
                        padding: "4px",
                      }}
                    />
                  </div>

                  {/* Center: Title, AI Summary, Pros/Cons, Best For */}
                  <div>
                    {/* Header line: Award badge & Confidence */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      {p.award && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "8px",
                            background: p.awardBadgeColor || "rgba(139, 92, 246, 0.2)",
                            color: "#FFFFFF",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          {p.award === "Best Overall" ? "🏆 " : p.award === "Best Value for Money" ? "💰 " : p.award === "Best Budget Pick" ? "🏷️ " : "✨ "}
                          {p.award}
                        </span>
                      )}

                      {/* Best For Tag (Inline editable) */}
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#93C5FD",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        🎯 {edits.bestFor !== undefined ? edits.bestFor : p.bestFor}
                      </span>

                      {/* Confidence or Warnings */}
                      {p.dataQualityFlags && p.dataQualityFlags.length > 0 && (
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#FCD34D",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                          }}
                          title={p.dataQualityFlags.join(", ")}
                        >
                          ⚠️ {p.dataQualityFlags[0]}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC", margin: "0 0 6px", lineHeight: 1.35 }}>
                      {p.title}
                    </h3>

                    {/* AI Summary */}
                    <p style={{ fontSize: "0.85rem", color: "#CBD5E1", margin: "0 0 12px", lineHeight: 1.45 }}>
                      {edits.aiSummary !== undefined ? edits.aiSummary : p.aiSummary}
                    </p>

                    {/* Pros & Cons Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
                      {/* Pros */}
                      <div
                        style={{
                          background: "rgba(16, 185, 129, 0.06)",
                          border: "1px solid rgba(16, 185, 129, 0.18)",
                          borderRadius: "10px",
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#34D399", textTransform: "uppercase", marginBottom: "4px" }}>
                          ✓ Strengths & Advantages
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                          {p.pros.map((pro, i) => (
                            <li key={i}>{pro}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Cons */}
                      <div
                        style={{
                          background: "rgba(239, 68, 68, 0.05)",
                          border: "1px solid rgba(239, 68, 68, 0.15)",
                          borderRadius: "10px",
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#FCA5A5", textTransform: "uppercase", marginBottom: "4px" }}>
                          ℹ️ Limitations / Caveats
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", color: "#94A3B8", lineHeight: 1.4 }}>
                          {p.cons.map((con, i) => (
                            <li key={i}>{con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Right: Scores & Actions Column */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.75)",
                      borderRadius: "14px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <div>
                      {/* Score Gauge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div>
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>
                            AI Recommendation
                          </span>
                          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: p.overallScore >= 90 ? "#34D399" : p.overallScore >= 80 ? "#60A5FA" : "#FBBF24", lineHeight: 1 }}>
                            {p.overallScore}
                            <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>/100</span>
                          </div>
                        </div>

                        {/* Price & Rating */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF" }}>
                            {p.price}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                            ★ {p.rating.toFixed(1)} ({p.reviews.toLocaleString("en-IN")})
                          </div>
                        </div>
                      </div>

                      {/* Multi-Criteria Score Breakdown Bar */}
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94A3B8", marginBottom: "4px" }}>
                          <span>Satisfaction: {p.scoreBreakdown.customerSatisfaction}</span>
                          <span>Quality: {p.scoreBreakdown.productQuality}</span>
                          <span>Value: {p.scoreBreakdown.valueForMoney}</span>
                        </div>
                        <div style={{ height: "6px", width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${p.scoreBreakdown.customerSatisfaction}%`, background: "#3B82F6" }} title={`Satisfaction: ${p.scoreBreakdown.customerSatisfaction}`} />
                          <div style={{ width: `${p.scoreBreakdown.productQuality}%`, background: "#8B5CF6" }} title={`Quality: ${p.scoreBreakdown.productQuality}`} />
                          <div style={{ width: `${p.scoreBreakdown.valueForMoney}%`, background: "#10B981" }} title={`Value: ${p.scoreBreakdown.valueForMoney}`} />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        type="button"
                        disabled={approvingAsin === p.asin}
                        onClick={() => handleApproveProduct(p)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "10px",
                          background: isApproved
                            ? "rgba(16, 185, 129, 0.25)"
                            : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                          border: isApproved ? "1px solid #10B981" : "none",
                          color: "#FFFFFF",
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          cursor: approvingAsin === p.asin ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        {approvingAsin === p.asin ? (
                          "Publishing…"
                        ) : isApproved ? (
                          "✓ Published to GoAmaze"
                        ) : (
                          "Approve & Publish to Store"
                        )}
                      </button>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <a
                          href={p.affiliateLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            padding: "7px 10px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#CBD5E1",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textAlign: "center",
                            textDecoration: "none",
                          }}
                        >
                          Check on Amazon ↗
                        </a>

                        <button
                          type="button"
                          onClick={() => handleRejectProduct(p)}
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            color: "#FCA5A5",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
