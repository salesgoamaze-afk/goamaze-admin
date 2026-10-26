"use client";

import { useEffect, useState, useTransition } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { PRIMARY_THEMES, CANONICAL_CATEGORIES } from "@/lib/taxonomy";

interface Product {
  _id: string;
  id?: string | number;
  title: string;
  category: string;
  categories?: string[];
  themes?: string[];
  price: string;
  rating: number;
  featured: boolean;
  image: string;
  createdAt: string;
  analysisStatus?: "DISCOVERED" | "PENDING_ANALYSIS" | "ANALYZING" | "ANALYZED" | "NEEDS_REVIEW" | "FAILED" | string;
  aiScore?: number;
  bestFor?: string;
  aiSummary?: string;
  source?: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [queueRunning, setQueueRunning] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Review item modal state
  const [reviewingProduct, setReviewingProduct] = useState<Product | null>(null);
  const [reviewActionRunning, setReviewActionRunning] = useState(false);

  // Scheduler state & controls
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [schedulerReport, setSchedulerReport] = useState<any>(null);

  const fetchProducts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedTheme !== "all") params.set("theme", selectedTheme);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    params.set("limit", "150");
    params.set("t", String(Date.now()));

    fetch(`/api/products?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setProducts(r.data);
        } else {
          setNotice({ type: "error", text: r.message || "Failed to load products" });
        }
      })
      .catch((err) => {
        setNotice({ type: "error", text: "Network error loading products: " + err.message });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedTheme, selectedCategory, selectedStatus]);

  // Run AI Queue processor
  const handleProcessAIQueue = async () => {
    setQueueRunning(true);
    setNotice({ type: "info", text: "Processing pending AI classification queue..." });
    try {
      const res = await fetch("/api/ai/process-queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 15 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({
          type: "success",
          text: `AI Queue processed: ${data.report?.analyzedCount || 0} classified, ${data.report?.needsReviewCount || 0} need review, ${data.report?.skippedUnchangedCount || 0} unchanged.`,
        });
        fetchProducts();
      } else {
        setNotice({ type: "error", text: data.message || "Failed to process AI queue" });
      }
    } catch (e: any) {
      setNotice({ type: "error", text: "AI Queue error: " + e.message });
    } finally {
      setQueueRunning(false);
    }
  };

  // Review modal actions (approve, retry)
  const handleReviewAction = async (action: "approve" | "retry") => {
    if (!reviewingProduct) return;
    setReviewActionRunning(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: reviewingProduct.id || reviewingProduct._id,
          action,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({
          type: "success",
          text: action === "approve" ? "Classification approved!" : "Queued for AI re-analysis.",
        });
        setReviewingProduct(null);
        fetchProducts();
      } else {
        setNotice({ type: "error", text: data.message || "Review action failed" });
      }
    } catch (e: any) {
      setNotice({ type: "error", text: "Error: " + e.message });
    } finally {
      setReviewActionRunning(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/products/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: "success", text: data.message || "Catalogue synchronized successfully!" });
        fetchProducts();
      } else {
        setNotice({ type: "error", text: data.message || "Failed to synchronize catalogue." });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Sync error: " + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setDeleting(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts((p) => p.filter((x) => String(x._id || (x as any).id) !== String(id)));
        setNotice({ type: "success", text: `"${title}" was removed.` });
      } else {
        setNotice({ type: "error", text: data.message || "Delete failed" });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Delete error: " + err.message });
    } finally {
      setDeleting(null);
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !current }),
      });
      if (res.ok) {
        setProducts((p) =>
          p.map((x) => (String(x._id || (x as any).id) === String(id) ? { ...x, featured: !current } : x))
        );
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // Count items needing review
  const needsReviewCount = products.filter((p) => p.analysisStatus === "NEEDS_REVIEW").length;
  const pendingCount = products.filter((p) => p.analysisStatus === "PENDING_ANALYSIS").length;

  return (
    <AdminLayout title="Products & Multi-Theme Catalog">
      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              notice.type === "success"
                ? "rgba(16,185,129,0.15)"
                : notice.type === "info"
                ? "rgba(59,130,246,0.15)"
                : "rgba(239,68,68,0.15)",
            border: `1px solid ${
              notice.type === "success"
                ? "rgba(16,185,129,0.3)"
                : notice.type === "info"
                ? "rgba(59,130,246,0.3)"
                : "rgba(239,68,68,0.3)"
            }`,
            color: notice.type === "success" ? "#34D399" : notice.type === "info" ? "#60A5FA" : "#FCA5A5",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          <span>
            {notice.type === "success" ? "✓" : notice.type === "info" ? "ℹ️" : "⚠️"} {notice.text}
          </span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Main Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#F8FAFC",
              fontFamily: "'Montserrat', sans-serif",
              margin: "0 0 4px",
            }}
          >
            Catalog & Multi-Theme Management ({products.length})
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>
            Curated products mapped to categories and 3 primary lifestyle themes
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* AI Queue Run Button */}
          <button
            type="button"
            onClick={handleProcessAIQueue}
            disabled={queueRunning}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "12px",
              background: queueRunning ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.18)",
              border: "1px solid rgba(59,130,246,0.4)",
              color: "#93C5FD",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: queueRunning ? "wait" : "pointer",
            }}
            title="Classify pending products with AI"
          >
            {queueRunning ? "⏳ Running AI..." : `⚡ Classify Queue (${pendingCount})`}
          </button>

          {/* Quick Review Filter Toggle */}
          {needsReviewCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === "NEEDS_REVIEW" ? "all" : "NEEDS_REVIEW")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 14px",
                borderRadius: "12px",
                background: selectedStatus === "NEEDS_REVIEW" ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.4)",
                color: "#FCD34D",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚠️ Needs Review ({needsReviewCount})
            </button>
          )}

          <Link
            href="/admin/amazon-import"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "12px",
              background: "rgba(249,115,22,0.15)",
              border: "1px solid rgba(249,115,22,0.35)",
              color: "#FB923C",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            🛒 Discover Products
          </Link>

          <Link
            href="/admin/products/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "12px",
              background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
              color: "white",
              textDecoration: "none",
              fontSize: "0.85rem",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
            }}
          >
            ➕ Add Product
          </Link>
        </div>
      </div>

      {/* Filter Toolbar (Search + Theme + Category + Status) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(200px, 1.5fr) repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
          background: "rgba(255,255,255,0.02)",
          padding: "14px",
          borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search by title, ASIN, or keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#F8FAFC",
            fontSize: "0.85rem",
            outline: "none",
          }}
        />

        {/* Theme Filter */}
        <select
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#1E293B",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#F8FAFC",
            fontSize: "0.85rem",
            outline: "none",
          }}
        >
          <option value="all">🌟 All Lifestyle Themes</option>
          {PRIMARY_THEMES.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.icon} {t.name}
            </option>
          ))}
          <option value="festival-special-diwali">🪔 Festival Special - Diwali</option>
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#1E293B",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#F8FAFC",
            fontSize: "0.85rem",
            outline: "none",
          }}
        >
          <option value="all">🏷️ All Categories</option>
          {CANONICAL_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        {/* AI Analysis Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#1E293B",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#F8FAFC",
            fontSize: "0.85rem",
            outline: "none",
          }}
        >
          <option value="all">🤖 All AI Statuses</option>
          <option value="ANALYZED">✓ Analyzed</option>
          <option value="NEEDS_REVIEW">⚠️ Needs Review</option>
          <option value="PENDING_ANALYSIS">⏳ Pending Analysis</option>
          <option value="FAILED">❌ Failed</option>
        </select>
      </div>

      {/* Table container */}
      <div
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          background: "rgba(255,255,255,0.02)",
          width: "100%",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px minmax(0, 1.4fr) 140px 160px 110px 90px 150px",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: "0.72rem",
            color: "#64748B",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span>Image</span>
          <span>Product / ASIN</span>
          <span>Categories</span>
          <span>Lifestyle Themes</span>
          <span>Status</span>
          <span>Price</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748B", fontSize: "0.9rem" }}>
            Loading catalog...
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#94A3B8", fontSize: "0.95rem" }}>
            <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>📦</div>
            <div style={{ fontWeight: 700, color: "#F8FAFC", marginBottom: "6px" }}>No matching products found</div>
            <p style={{ color: "#64748B", fontSize: "0.85rem", maxWidth: "420px", margin: "0 auto 20px" }}>
              No products matched your active filters. Try clearing your search query or filters.
            </p>
          </div>
        ) : (
          products.map((p, i) => {
            const pId = String(p._id || (p as any).id);
            const status = p.analysisStatus || "ANALYZED";
            const assignedCategories = p.categories && p.categories.length > 0 ? p.categories : [p.category];
            const assignedThemes = p.themes || [];

            return (
              <div
                key={pId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px minmax(0, 1.4fr) 140px 160px 110px 90px 150px",
                  padding: "12px 18px",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: i < products.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              >
                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.title}
                  referrerPolicy="no-referrer"
                  style={{
                    width: "42px",
                    height: "42px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    background: "#1E293B",
                  }}
                />

                {/* Title & Details */}
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: "#F8FAFC",
                      marginBottom: "3px",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.title}
                  </div>
                  <div style={{ display: "flex", gap: "8px", fontSize: "0.72rem", color: "#64748B" }}>
                    <span>⭐ {p.rating}</span>
                    {p.aiScore && <span style={{ color: "#34D399" }}>AI Score: {p.aiScore}</span>}
                  </div>
                </div>

                {/* Categories */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {assignedCategories.slice(0, 2).map((cat) => (
                    <span
                      key={cat}
                      style={{
                        padding: "3px 6px",
                        borderRadius: "6px",
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        color: "#C4B5FD",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                  {assignedCategories.length > 2 && (
                    <span style={{ fontSize: "0.68rem", color: "#94A3B8" }}>+{assignedCategories.length - 2}</span>
                  )}
                </div>

                {/* Lifestyle Themes */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {assignedThemes.length === 0 ? (
                    <span style={{ fontSize: "0.72rem", color: "#64748B", fontStyle: "italic" }}>
                      Category-only
                    </span>
                  ) : (
                    assignedThemes.map((th) => {
                      const themeMeta = PRIMARY_THEMES.find((t) => t.slug === th);
                      return (
                        <span
                          key={th}
                          style={{
                            padding: "3px 7px",
                            borderRadius: "6px",
                            background: "rgba(249,115,22,0.12)",
                            border: "1px solid rgba(249,115,22,0.25)",
                            color: "#FB923C",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {themeMeta?.icon || "✨"} {themeMeta?.name || th}
                        </span>
                      );
                    })
                  )}
                </div>

                {/* AI Analysis Status Badge */}
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      background:
                        status === "ANALYZED"
                          ? "rgba(16,185,129,0.15)"
                          : status === "NEEDS_REVIEW"
                          ? "rgba(245,158,11,0.2)"
                          : status === "PENDING_ANALYSIS"
                          ? "rgba(59,130,246,0.15)"
                          : "rgba(239,68,68,0.15)",
                      border: `1px solid ${
                        status === "ANALYZED"
                          ? "rgba(16,185,129,0.3)"
                          : status === "NEEDS_REVIEW"
                          ? "rgba(245,158,11,0.4)"
                          : status === "PENDING_ANALYSIS"
                          ? "rgba(59,130,246,0.3)"
                          : "rgba(239,68,68,0.3)"
                      }`,
                      color:
                        status === "ANALYZED"
                          ? "#34D399"
                          : status === "NEEDS_REVIEW"
                          ? "#FCD34D"
                          : status === "PENDING_ANALYSIS"
                          ? "#93C5FD"
                          : "#FCA5A5",
                    }}
                  >
                    {status === "NEEDS_REVIEW" ? "⚠️ Review" : status === "PENDING_ANALYSIS" ? "⏳ Pending" : status}
                  </span>
                </div>

                {/* Price */}
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34D399", whiteSpace: "nowrap" }}>
                  {p.price}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                  {status === "NEEDS_REVIEW" && (
                    <button
                      onClick={() => setReviewingProduct(p)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        background: "rgba(245,158,11,0.2)",
                        border: "1px solid rgba(245,158,11,0.4)",
                        color: "#FCD34D",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Review AI suggestions"
                    >
                      Review
                    </button>
                  )}

                  <Link
                    href={`/admin/products/${pId}/edit`}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "8px",
                      background: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.25)",
                      color: "#93C5FD",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    ✏️ Edit
                  </Link>

                  <button
                    onClick={() => toggleFeatured(pId, p.featured)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      opacity: p.featured ? 1 : 0.25,
                    }}
                    title={p.featured ? "Unfeature" : "Feature"}
                  >
                    ⭐
                  </button>

                  <button
                    onClick={() => handleDelete(pId, p.title)}
                    disabled={deleting === pId}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      borderRadius: "8px",
                      padding: "5px 7px",
                      color: "#F87171",
                      fontSize: "0.72rem",
                      cursor: deleting === pId ? "wait" : "pointer",
                    }}
                    title="Delete product"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Modal */}
      {reviewingProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0F172A",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: "18px",
              padding: "24px",
              maxWidth: "540px",
              width: "100%",
              color: "#F8FAFC",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>⚠️ Review AI Classification</h3>
              <button
                onClick={() => setReviewingProduct(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#F8FAFC", marginBottom: "4px" }}>
                {reviewingProduct.title}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                Price: {reviewingProduct.price} • ASIN: {reviewingProduct.id}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", marginBottom: "16px" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
                AI Suggested Categories
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(reviewingProduct.categories || [reviewingProduct.category]).map((c) => (
                  <span key={c} style={{ background: "rgba(139,92,246,0.2)", color: "#C4B5FD", padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem" }}>
                    🏷️ {c}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
                AI Suggested Lifestyle Themes
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(reviewingProduct.themes || []).length === 0 ? (
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontStyle: "italic" }}>Category-only product (No lifestyle theme)</span>
                ) : (
                  (reviewingProduct.themes || []).map((t) => (
                    <span key={t} style={{ background: "rgba(249,115,22,0.2)", color: "#FB923C", padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem" }}>
                      ✨ {t}
                    </span>
                  ))
                )}
              </div>
            </div>

            {reviewingProduct.aiSummary && (
              <div style={{ fontSize: "0.8rem", color: "#CBD5E1", marginBottom: "20px", fontStyle: "italic" }}>
                "{reviewingProduct.aiSummary}"
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Link
                href={`/admin/products/${reviewingProduct.id || reviewingProduct._id}/edit`}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#CBD5E1",
                  textDecoration: "none",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                ✏️ Edit Manually
              </Link>
              <button
                onClick={() => handleReviewAction("retry")}
                disabled={reviewActionRunning}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  background: "rgba(59,130,246,0.2)",
                  border: "1px solid rgba(59,130,246,0.4)",
                  color: "#93C5FD",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔄 Re-Analyze
              </button>
              <button
                onClick={() => handleReviewAction("approve")}
                disabled={reviewActionRunning}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg,#10B981,#059669)",
                  border: "none",
                  color: "white",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓ Approve Classification
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
