"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface Product {
  _id:           string;
  id?:           string | number;
  title:         string;
  category:      string;
  price:         string;
  rating:        number;
  featured:      boolean;
  image:         string;
  createdAt:     string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing,  setSyncing]  = useState(false);
  const [notice,   setNotice]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search,   setSearch]   = useState("");

  // Scheduler state & controls
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [schedulerReport, setSchedulerReport] = useState<any>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const loadSchedulerStatus = async () => {
    try {
      const res = await fetch("/api/cron/sync-products?status=true", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success && data.status) {
        setSchedulerStatus(data.status);
        if (data.status.lastReport) {
          setSchedulerReport(data.status.lastReport);
        }
      }
    } catch (e) {
      console.warn("Could not load scheduler status:", e);
    }
  };

  const handleRunSchedulerNow = async () => {
    setSchedulerRunning(true);
    setNotice(null);
    try {
      const res = await fetch("/api/cron/sync-products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSchedulerReport(data.data);
        if (data.status) setSchedulerStatus(data.status);
        setNotice({
          type: "success",
          text: data.message || `Scheduler updated ${data.data?.updatedCount || 0} products with fresh Creator API attributes.`,
        });
        fetchProducts();
      } else {
        setNotice({
          type: "error",
          text: data.message || "Failed to execute price & attribute sync scheduler.",
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Scheduler error: " + err.message });
    } finally {
      setSchedulerRunning(false);
    }
  };

  const fetchProducts = () => {
    setLoading(true);
    fetch(`/api/products?${search ? `search=${encodeURIComponent(search)}&` : ""}t=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(r => r.json())
      .then(r => {
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

  useEffect(() => { fetchProducts(); }, [search]);

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
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setProducts(p => p.filter(x => String(x._id || (x as any).id) !== String(id)));
        setNotice({ type: "success", text: `Deleted "${title}" successfully.` });
      } else {
        const errMsg = data.message || "Failed to delete product.";
        setNotice({ type: "error", text: errMsg });
        alert(`Could not delete: ${errMsg}`);
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Network error deleting product." });
      alert("Network error: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method:  "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ featured: !current }),
      });
      if (res.ok) {
        setProducts(p => p.map(x => String(x._id || (x as any).id) === String(id) ? { ...x, featured: !current } : x));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.message || "Failed to toggle featured status");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  return (
    <AdminLayout title="Products">
      {/* Notice Banner */}
      {notice && (
        <div style={{
          padding: "12px 18px",
          borderRadius: "12px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: notice.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${notice.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: notice.type === "success" ? "#34D399" : "#FCA5A5",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}>
          <span>{notice.type === "success" ? "✓" : "⚠️"} {notice.text}</span>
          <button onClick={() => setNotice(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: "0 0 4px" }}>
            Products ({products.length})
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>Manage your curated product catalogue</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "11px 18px", borderRadius: "12px",
              background: syncing ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.18)",
              border: "1px solid rgba(139,92,246,0.4)",
              color: "#C4B5FD",
              fontSize: "0.87rem", fontWeight: 700,
              cursor: syncing ? "wait" : "pointer",
              transition: "all 0.2s ease",
            }}
            title="Sync all products and categories from catalogue"
          >
            {syncing ? "🔄 Syncing…" : "🔄 Sync Catalogue"}
          </button>
          <Link href="/admin/amazon-import" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "11px 18px", borderRadius: "12px",
            background: "rgba(249,115,22,0.15)",
            border: "1px solid rgba(249,115,22,0.35)",
            color: "#FB923C",
            textDecoration: "none",
            fontSize: "0.87rem", fontWeight: 700,
            transition: "all 0.2s ease",
          }}>
            🛒 Amazon Creator
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowSchedulerModal(true);
              loadSchedulerStatus();
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "11px 18px", borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(234,88,12,0.25) 100%)",
              border: "1px solid rgba(249,115,22,0.5)",
              color: "#FB923C",
              fontSize: "0.87rem", fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(249,115,22,0.15)",
              transition: "all 0.2s ease",
            }}
            title="Auto-sync product prices, offers & attributes from Amazon Creator API"
          >
            ⚡ Auto-Sync Scheduler
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search products…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#F8FAFC",
          fontSize: "0.88rem",
          outline: "none",
          marginBottom: "20px",
          boxSizing: "border-box",
        }}
      />

      {/* Table container */}
      <div style={{
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
        width: "100%",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "50px minmax(0, 1fr) 130px 90px 60px 200px",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          fontSize: "0.72rem",
          color: "#64748B",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          alignItems: "center",
          gap: "12px",
        }}>
          <span>Image</span>
          <span>Product</span>
          <span>Category</span>
          <span>Price</span>
          <span style={{ textAlign: "center" }}>Star</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748B", fontSize: "0.9rem" }}>
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#94A3B8", fontSize: "0.95rem" }}>
            <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>📦</div>
            <div style={{ fontWeight: 700, color: "#F8FAFC", marginBottom: "6px" }}>No products found in catalogue</div>
            <p style={{ color: "#64748B", fontSize: "0.85rem", maxWidth: "420px", margin: "0 auto 20px" }}>
              Your product list is currently empty. You can immediately restore all default products from the catalogue or add a new product manually.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: "10px 22px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: syncing ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                }}
              >
                {syncing ? "🔄 Restoring Catalogue…" : "🔄 Restore & Sync Catalogue Now"}
              </button>
              <Link
                href="/admin/products/new"
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#CBD5E1",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                ➕ Add New Product
              </Link>
            </div>
          </div>
        ) : (
          products.map((p, i) => {
            const pId = String(p._id || (p as any).id);
            return (
              <div key={pId} style={{
                display: "grid",
                gridTemplateColumns: "50px minmax(0, 1fr) 130px 90px 60px 200px",
                padding: "12px 18px",
                alignItems: "center",
                gap: "12px",
                borderBottom: i < products.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
              >
                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} referrerPolicy="no-referrer" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "8px", background: "#1E293B" }} />

                {/* Title (Wrapped & constrained) */}
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#F8FAFC",
                    marginBottom: "2px",
                    lineHeight: 1.35,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748B" }}>⭐ {p.rating}</div>
                </div>

                {/* Category */}
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "4px 8px",
                    borderRadius: "99px",
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "#A78BFA",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}>{p.category}</span>
                </div>

                {/* Price */}
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34D399", whiteSpace: "nowrap" }}>{p.price}</span>

                {/* Featured toggle */}
                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => toggleFeatured(pId, p.featured)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "18px",
                      lineHeight: 1,
                      opacity: p.featured ? 1 : 0.25,
                      transition: "opacity 0.2s ease",
                    }}
                    title={p.featured ? "Remove from featured" : "Mark as featured"}
                  >
                    ⭐
                  </button>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                  <Link href={`/admin/social-studio?productId=${pId}`} style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    background: "rgba(139,92,246,0.15)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    color: "#C4B5FD",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }} title="Generate Pinterest Pin & Instagram Post">🎨 Social</Link>

                  <Link href={`/admin/products/${pId}/edit`} style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    color: "#60A5FA",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}>✏️ Edit</Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(pId, p.title)}
                    disabled={deleting === pId}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "8px",
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "#FCA5A5",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: deleting === pId ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="Delete product"
                  >
                    {deleting === pId ? "…" : "🗑️ Del"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Auto-Sync Scheduler Modal ─────────────────────────────────────── */}
      {showSchedulerModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !schedulerRunning) {
              setShowSchedulerModal(false);
            }
          }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.96)",
              border: "1px solid rgba(249, 115, 22, 0.35)",
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
              color: "#F8FAFC",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.8rem" }}>⚡</span>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#F8FAFC", margin: 0 }}>
                    Product Attribute & Live Price Scheduler
                  </h3>
                  <p style={{ color: "#94A3B8", fontSize: "0.82rem", margin: "4px 0 0" }}>
                    Automated background engine syncing live selling prices, M.R.P., offer discounts, and ratings via Amazon Creator API.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchedulerModal(false)}
                disabled={schedulerRunning}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94A3B8",
                  fontSize: "1.1rem",
                  borderRadius: "10px",
                  width: "34px",
                  height: "34px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Metrics 4-Card Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Engine Status</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#34D399", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }}></span>
                  Active & Scheduled
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Sync Frequency</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#F8FAFC", marginTop: "6px" }}>
                  Every {schedulerStatus?.intervalHours || 6} Hours
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Last Synced</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#CBD5E1", marginTop: "6px" }}>
                  {schedulerStatus?.lastRunTime
                    ? new Date(schedulerStatus.lastRunTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "Not run yet"}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Next Scheduled Run</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#FB923C", marginTop: "6px" }}>
                  {schedulerStatus?.nextRunTime
                    ? new Date(schedulerStatus.nextRunTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "In ~6 hours"}
                </div>
              </div>
            </div>

            {/* Run Sync Trigger Card */}
            <div style={{
              background: "rgba(249, 115, 22, 0.08)",
              border: "1px solid rgba(249, 115, 22, 0.25)",
              borderRadius: "14px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#F8FAFC" }}>
                  On-Demand Catalog Price & Attribute Sync
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: "2px" }}>
                  Trigger immediate batch update across all {products.length} catalog items via Amazon Creator API.
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSchedulerNow}
                disabled={schedulerRunning}
                style={{
                  padding: "11px 22px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                  border: "none",
                  color: "white",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: schedulerRunning ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {schedulerRunning ? "🔄 Syncing with Amazon…" : "⚡ Run Live Sync Now"}
              </button>
            </div>

            {/* Recent Sync Results / Details */}
            {schedulerReport && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase" }}>
                    Last Sync Execution Summary
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#34D399", fontWeight: 700 }}>
                    ✓ {schedulerReport.updatedCount || 0} Updated • {schedulerReport.priceChangedCount || 0} Price Changes
                  </span>
                </div>

                {Array.isArray(schedulerReport.details) && schedulerReport.details.length > 0 ? (
                  <div style={{
                    maxHeight: "260px",
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "8px 12px",
                  }}>
                    {schedulerReport.details.slice(0, 50).map((d: any, idx: number) => {
                      const amazonLink = d.affiliateLink || `https://www.amazon.in/dp/${d.asin}?tag=goamaze06-21`;
                      const editLink = `/admin/products/${d.id}/edit`;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 4px",
                            borderBottom: idx < Math.min(schedulerReport.details.length, 50) - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                            gap: "14px",
                          }}
                        >
                          {/* Product Image & Title + ASIN Link */}
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                            {d.image ? (
                              <img
                                src={d.image}
                                alt={d.title}
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  objectFit: "contain",
                                  borderRadius: "6px",
                                  background: "rgba(255,255,255,0.04)",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "6px",
                                background: "rgba(255,255,255,0.04)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1rem",
                                flexShrink: 0,
                              }}>
                                📦
                              </div>
                            )}

                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                color: "#F1F5F9",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                <Link
                                  href={editLink}
                                  style={{ color: "#F1F5F9", textDecoration: "none" }}
                                  title="View product details in GoAmaze Admin"
                                >
                                  {d.title}
                                </Link>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                                {/* Product link with ASIN number */}
                                <a
                                  href={amazonLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    color: "#FB923C",
                                    background: "rgba(249,115,22,0.14)",
                                    border: "1px solid rgba(249,115,22,0.3)",
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                  }}
                                  title="View product details live on Amazon"
                                >
                                  📦 ASIN: {d.asin} ↗
                                </a>

                                {/* Internal details link */}
                                <Link
                                  href={editLink}
                                  style={{
                                    color: "#60A5FA",
                                    fontSize: "0.72rem",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                  }}
                                  title="View & Edit product details"
                                >
                                  ✏️ View Details
                                </Link>
                              </div>
                            </div>
                          </div>

                          {/* Prices & Deal Badges */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {d.oldPrice && d.oldPrice !== d.newPrice && (
                                <span style={{ color: "#64748B", textDecoration: "line-through", fontSize: "0.75rem" }}>
                                  {d.oldPrice}
                                </span>
                              )}
                              <span style={{ color: "#34D399", fontWeight: 800, fontSize: "0.88rem" }}>
                                {d.newPrice}
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {d.newOriginalPrice && d.newOriginalPrice !== d.newPrice && (
                                <span style={{ color: "#94A3B8", fontSize: "0.7rem" }}>
                                  M.R.P.: {d.newOriginalPrice}
                                </span>
                              )}
                              {d.savingPercentage ? (
                                <span style={{ background: "rgba(16,185,129,0.18)", color: "#34D399", padding: "1px 5px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 700 }}>
                                  {d.savingPercentage}% off
                                </span>
                              ) : null}
                              {d.dealBadge && (
                                <span style={{ background: "rgba(249,115,22,0.2)", color: "#FB923C", padding: "1px 5px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 700 }}>
                                  {d.dealBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "#64748B", padding: "10px 0" }}>
                    All products are up to date with Amazon Creator API.
                  </div>
                )}
              </div>
            )}

            {/* External Cron / Webhook Integration */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              padding: "16px 20px",
            }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: "6px" }}>
                External Webhook & Vercel Cron Endpoint
              </div>
              <p style={{ fontSize: "0.78rem", color: "#64748B", margin: "0 0 10px", lineHeight: 1.4 }}>
                You can trigger automated runs from Vercel Crons, GitHub Actions, AWS EventBridge, or cron-job.org using this secure URL:
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/api/cron/sync-products?secret=goamaze-secret` : "/api/cron/sync-products?secret=goamaze-secret"}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94A3B8",
                    fontSize: "0.76rem",
                    fontFamily: "monospace",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      navigator.clipboard.writeText(`${window.location.origin}/api/cron/sync-products?secret=goamaze-secret`);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#F8FAFC",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedWebhook ? "✓ Copied!" : "📋 Copy URL"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
