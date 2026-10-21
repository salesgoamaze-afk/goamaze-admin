"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { HiExternalLink, HiCheck, HiOutlineExclamationCircle } from "react-icons/hi";

export interface ComparisonProduct {
  id: string | number;
  _id?: string | number;
  title: string;
  subtitle: string;
  description?: string;
  price: string;
  originalPrice: string;
  unitPrice?: string;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  affiliateLink: string;
  category: string;
  badge: string;
  source?: string;

  // AI Recommendation Structured Fields
  aiScore?: number;
  rank?: number;
  award?: string;
  aiSummary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  recommendationReason?: string;
  targetAudience?: string;
}

interface ProductComparisonTableProps {
  products: ComparisonProduct[];
  categoryName?: string;
}

export default function ProductComparisonTable({
  products,
  categoryName = "Curated Products",
}: ProductComparisonTableProps) {
  const [filterMode, setFilterMode] = useState<"all" | "top_picks" | "score_90">("all");

  // Extract structured AI data if embedded in description
  const parsedProducts = useMemo(() => {
    return products.map((p) => {
      let aiData: any = {};
      const text = `${p.description || ""} ${p.subtitle || ""}`;
      if (text.includes("<!-- AI_DATA:")) {
        try {
          const match = text.match(/<!-- AI_DATA:\s*([\s\S]*?)\s*-->/);
          if (match && match[1]) aiData = JSON.parse(match[1]);
        } catch {}
      }

      const score: number = p.aiScore ?? aiData.aiScore ?? (p.rating ? Math.round(p.rating * 19) : 80);
      const pros: string[] = (Array.isArray(p.pros) && p.pros.length > 0) ? p.pros : (Array.isArray(aiData.pros) ? aiData.pros : ["High customer satisfaction", "Authentic quality"]);
      const cons: string[] = (Array.isArray(p.cons) && p.cons.length > 0) ? p.cons : (Array.isArray(aiData.cons) ? aiData.cons : ["Subject to stock changes"]);
      const bestFor: string = p.bestFor || aiData.bestFor || (p.badge && p.badge.includes("Best") ? p.badge : "General Everyday Use");
      const summary: string = p.aiSummary || aiData.aiSummary || p.subtitle || p.title;
      const reason: string = p.recommendationReason || aiData.recommendationReason || `Ranked with a ${score}/100 AI recommendation score based on rating and value.`;
      const award: string | undefined = p.award || aiData.award || (p.badge && p.badge.includes("Best") ? p.badge : undefined);
      const rank: number | undefined = p.rank || aiData.rank;

      return {
        ...p,
        aiScore: score,
        pros,
        cons,
        bestFor,
        aiSummary: summary,
        recommendationReason: reason,
        award,
        rank,
      };
    });
  }, [products]);

  // Filtered & sorted products (highest score first)
  const sortedProducts = useMemo(() => {
    let list = [...parsedProducts].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));

    if (filterMode === "top_picks") {
      list = list.filter((p) => Boolean(p.award) || (p.rank && p.rank <= 3) || p.badge?.includes("Best") || (p.aiScore || 0) >= 90);
    } else if (filterMode === "score_90") {
      list = list.filter((p) => (p.aiScore || 0) >= 90);
    }

    return list;
  }, [parsedProducts, filterMode]);

  // Top highlight awards
  const bestOverall = sortedProducts.find((p) => p.award?.includes("Overall") || p.badge?.includes("Best Seller") || p.rank === 1) || sortedProducts[0];
  const bestValue = sortedProducts.find((p) => p.award?.includes("Value") || p.bestFor?.includes("Value"));
  const bestBudget = sortedProducts.find((p) => p.award?.includes("Budget") || p.bestFor?.includes("Budget"));

  if (!products || products.length === 0) return null;

  return (
    <div
      style={{
        margin: "32px 0 48px",
        background: "linear-gradient(145deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "24px",
        padding: "28px",
        backdropFilter: "blur(16px)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
        overflow: "hidden",
      }}
    >
      {/* Header & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.6rem" }}>📊</span>
            <h2
              style={{
                fontFamily: "var(--font-montserrat, sans-serif)",
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#F8FAFC",
                margin: 0,
              }}
            >
              AI Product Comparison & Recommendation Matrix
            </h2>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "0.85rem", margin: 0 }}>
            Compare specifications, scores, pros, and recommendation reasons for {categoryName} side-by-side.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            style={{
              padding: "7px 14px",
              borderRadius: "10px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              border: filterMode === "all" ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.1)",
              background: filterMode === "all" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.04)",
              color: filterMode === "all" ? "#93C5FD" : "#CBD5E1",
              transition: "all 0.2s",
            }}
          >
            All Products ({parsedProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("top_picks")}
            style={{
              padding: "7px 14px",
              borderRadius: "10px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              border: filterMode === "top_picks" ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.1)",
              background: filterMode === "top_picks" ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.04)",
              color: filterMode === "top_picks" ? "#C4B5FD" : "#CBD5E1",
              transition: "all 0.2s",
            }}
          >
            ⭐ Top Recommended Only
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("score_90")}
            style={{
              padding: "7px 14px",
              borderRadius: "10px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              border: filterMode === "score_90" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.1)",
              background: filterMode === "score_90" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.04)",
              color: filterMode === "score_90" ? "#86EFAC" : "#CBD5E1",
              transition: "all 0.2s",
            }}
          >
            ✨ 90+ Score Only
          </button>
        </div>
      </div>

      {/* Top Highlights Summary Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        {bestOverall && (
          <div
            style={{
              background: "rgba(234, 179, 8, 0.08)",
              border: "1px solid rgba(234, 179, 8, 0.3)",
              borderRadius: "14px",
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 800, color: "#FDE047", textTransform: "uppercase", marginBottom: "4px" }}>
              <span>🏆</span> Best Overall Choice
            </div>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {bestOverall.title}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#CBD5E1", marginTop: "4px" }}>
              AI Score: <strong style={{ color: "#FDE047" }}>{bestOverall.aiScore}/100</strong> • {bestOverall.price}
            </div>
          </div>
        )}

        {bestValue && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "14px",
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 800, color: "#86EFAC", textTransform: "uppercase", marginBottom: "4px" }}>
              <span>💰</span> Best Value for Money
            </div>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {bestValue.title}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#CBD5E1", marginTop: "4px" }}>
              AI Score: <strong style={{ color: "#86EFAC" }}>{bestValue.aiScore}/100</strong> • {bestValue.price}
            </div>
          </div>
        )}

        {bestBudget && (
          <div
            style={{
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "14px",
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 800, color: "#93C5FD", textTransform: "uppercase", marginBottom: "4px" }}>
              <span>🏷️</span> Best Budget Option
            </div>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {bestBudget.title}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#CBD5E1", marginTop: "4px" }}>
              Price: <strong style={{ color: "#93C5FD" }}>{bestBudget.price}</strong> • Score: {bestBudget.aiScore}/100
            </div>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 10px",
            fontSize: "0.82rem",
            color: "#CBD5E1",
          }}
        >
          <thead>
            <tr style={{ color: "#94A3B8", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
              <th style={{ padding: "8px 14px", textAlign: "left" }}>Product</th>
              <th style={{ padding: "8px 14px", textAlign: "center" }}>AI Score</th>
              <th style={{ padding: "8px 14px", textAlign: "left" }}>Best For</th>
              <th style={{ padding: "8px 14px", textAlign: "left" }}>Key Pros & Cons</th>
              <th style={{ padding: "8px 14px", textAlign: "left" }}>Why We Recommend It</th>
              <th style={{ padding: "8px 14px", textAlign: "right" }}>Price & Ratings</th>
              <th style={{ padding: "8px 14px", textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((p, idx) => {
              const isTop = idx === 0 || p.award === "Best Overall";
              return (
                <tr
                  key={p.id || idx}
                  style={{
                    background: isTop ? "rgba(234, 179, 8, 0.04)" : "rgba(255, 255, 255, 0.02)",
                    border: isTop ? "1px solid rgba(234, 179, 8, 0.25)" : "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                  }}
                >
                  {/* Product Title & Thumbnail */}
                  <td style={{ padding: "14px", borderRadius: "12px 0 0 12px", minWidth: "220px", verticalAlign: "top" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <img
                        src={p.image || "/placeholder.png"}
                        alt={p.title}
                        style={{
                          width: "56px",
                          height: "56px",
                          objectFit: "contain",
                          background: "#FFFFFF",
                          borderRadius: "8px",
                          padding: "3px",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        {p.award && (
                          <div style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 800, color: "#FDE047", marginBottom: "2px" }}>
                            ★ {p.award}
                          </div>
                        )}
                        <div style={{ fontWeight: 700, color: "#F8FAFC", lineHeight: 1.35, fontSize: "0.85rem" }}>
                          {p.title.slice(0, 50)}…
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* AI Score */}
                  <td style={{ padding: "14px", textAlign: "center", minWidth: "90px", verticalAlign: "top" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        background: (p.aiScore || 0) >= 90 ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)",
                        border: (p.aiScore || 0) >= 90 ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
                        color: (p.aiScore || 0) >= 90 ? "#34D399" : "#93C5FD",
                        fontWeight: 900,
                        fontSize: "0.95rem",
                      }}
                    >
                      {p.aiScore}/100
                    </div>
                  </td>

                  {/* Best For Tag */}
                  <td style={{ padding: "14px", minWidth: "150px", verticalAlign: "top" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: "rgba(59, 130, 246, 0.14)",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                        color: "#93C5FD",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      <span>🎯</span> {p.bestFor}
                    </span>
                  </td>

                  {/* Key Pros & Cons */}
                  <td style={{ padding: "14px", minWidth: "200px", verticalAlign: "top" }}>
                    <div style={{ marginBottom: "4px" }}>
                      {p.pros?.slice(0, 2).map((pro: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "4px", color: "#86EFAC", fontSize: "0.74rem", marginBottom: "2px" }}>
                          <span style={{ color: "#34D399" }}>✓</span>
                          <span>{pro}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      {p.cons?.slice(0, 1).map((con: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "4px", color: "#94A3B8", fontSize: "0.72rem" }}>
                          <span style={{ color: "#FCA5A5" }}>•</span>
                          <span>{con}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Why We Recommend It */}
                  <td style={{ padding: "14px", minWidth: "200px", verticalAlign: "top", fontSize: "0.76rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                    {p.recommendationReason}
                  </td>

                  {/* Price & Rating */}
                  <td style={{ padding: "14px", textAlign: "right", minWidth: "110px", verticalAlign: "top" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#FFFFFF" }}>
                      {p.price}
                    </div>
                    {p.rating && (
                      <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: "2px" }}>
                        ★ {p.rating.toFixed(1)} ({p.reviews})
                      </div>
                    )}
                  </td>

                  {/* Action Link */}
                  <td style={{ padding: "14px", textAlign: "center", borderRadius: "0 12px 12px 0", minWidth: "140px", verticalAlign: "top" }}>
                    <a
                      href={p.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                        color: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      Check Price
                      <HiExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "16px", fontSize: "0.72rem", color: "#64748B", textAlign: "center" }}>
        As an Amazon Associate, GoAmaze earns from qualifying purchases. Prices, ratings, and availability are verified through the Amazon Creators API and may change.
      </div>
    </div>
  );
}
