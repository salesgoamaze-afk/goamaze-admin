"use client";

import { useEffect, useState, useTransition } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface AuditEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  productId: string;
  asin: string;
  title: string;
  oldPrice: string;
  newPrice: string;
  oldOriginalPrice?: string;
  newOriginalPrice?: string;
  priceChanged: boolean;
  priceDiffPercentage?: number;
  dealBadge?: string;
  savingPercentage?: string;
  status: "updated" | "unchanged" | "error";
  errorMessage?: string;
  affiliateLink: string;
  image: string;
}

interface AuditSummary {
  totalRuns: number;
  lastRunTime: string | null;
  totalChanges: number;
  priceDrops: number;
  priceIncreases: number;
  recentSessionsCount: number;
  auditedProductsCount: number;
}

interface SchedulerStatus {
  enabled: boolean;
  isRunning: boolean;
  lastRunTime: string | null;
  nextRunTime: string | null;
  intervalMs: number;
}

export default function AdminAuditLogsPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (changedOnly) params.set("changedOnly", "true");
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    params.set("page", String(page));
    params.set("limit", "25");
    params.set("t", String(Date.now()));

    fetch(`/api/admin/audit-logs?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          setEntries(r.entries || []);
          setSummary(r.summary || null);
          setScheduler(r.scheduler || null);
          setTotalPages(r.totalPages || 1);
          setTotalCount(r.total || 0);
        } else {
          setNotice({ type: "error", text: r.message || "Failed to load audit logs" });
        }
      })
      .catch((err) => {
        setNotice({ type: "error", text: "Network error loading audit logs: " + err.message });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [search, changedOnly, selectedStatus, page]);

  const handleTriggerSync = async () => {
    setSyncing(true);
    setNotice({ type: "info", text: "Running daily live price sync with Amazon Creator API..." });
    try {
      const res = await fetch("/api/admin/audit-logs", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({
          type: "success",
          text: data.message || "Price sync completed and audit log recorded successfully!",
        });
        setPage(1);
        fetchLogs();
      } else {
        setNotice({ type: "error", text: data.message || "Failed to trigger price sync." });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Sync request failed: " + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "Never";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }) + " IST";
    } catch {
      return isoStr;
    }
  };

  return (
    <AdminLayout title="Price Sync Audit Logs">
      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "12px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              notice.type === "success"
                ? "rgba(16,185,129,0.15)"
                : notice.type === "error"
                ? "rgba(239,68,68,0.15)"
                : "rgba(59,130,246,0.15)",
            border: `1px solid ${
              notice.type === "success"
                ? "rgba(16,185,129,0.3)"
                : notice.type === "error"
                ? "rgba(239,68,68,0.3)"
                : "rgba(59,130,246,0.3)"
            }`,
            color: notice.type === "success" ? "#34D399" : notice.type === "error" ? "#F87171" : "#60A5FA",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Sync Trigger */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#F8FAFC",
              fontFamily: "'Montserrat', sans-serif",
              margin: "0 0 6px",
            }}
          >
            📋 Product Price & MRP Update Audit Log
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>
            Audit trail of daily scheduled price syncs (Runs 4:00 AM IST) and live Amazon Creators API price changes.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              background: syncing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              border: "none",
              color: "#FFFFFF",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: syncing ? "not-allowed" : "pointer",
              boxShadow: syncing ? "none" : "0 4px 14px rgba(16, 185, 129, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            {syncing ? (
              <>
                <span className="animate-spin">🔄</span> Syncing Prices...
              </>
            ) : (
              <>
                <span>⚡</span> Sync Prices Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            Total Sync Sessions
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "#F8FAFC", margin: "6px 0 2px" }}>
            {summary?.totalRuns || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Last run: {formatDate(summary?.lastRunTime)}
          </div>
        </div>

        <div
          style={{
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            Price Changes Logged
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "#38BDF8", margin: "6px 0 2px" }}>
            {summary?.totalChanges || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Across all catalog products
          </div>
        </div>

        <div
          style={{
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            Price Drops (Deals)
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "#34D399", margin: "6px 0 2px" }}>
            {summary?.priceDrops || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            {summary?.priceIncreases || 0} price increases recorded
          </div>
        </div>

        <div
          style={{
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            Daily 24h Scheduler
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: scheduler?.enabled ? "#10B981" : "#EF4444",
              margin: "8px 0 4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{scheduler?.enabled ? "● Active (Armed)" : "○ Inactive"}</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Next: {formatDate(scheduler?.nextRunTime)} (4:00 AM IST)
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: "16px",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Search by ASIN, Product Title, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: "100%",
              maxWidth: "360px",
              padding: "10px 16px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#F8FAFC",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setChangedOnly(!changedOnly);
              setPage(1);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background: changedOnly ? "#F97316" : "rgba(255, 255, 255, 0.05)",
              color: "#FFFFFF",
              transition: "all 0.15s ease",
            }}
          >
            🔥 Price Changed Only
          </button>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#F8FAFC",
              fontSize: "0.8rem",
              fontWeight: 600,
              outline: "none",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="updated">Updated</option>
            <option value="unchanged">Unchanged</option>
            <option value="error">Errors</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table / Cards */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#E2E8F0" }}>
            Audit Records ({totalCount})
          </span>
          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94A3B8" }}>
            <div className="animate-spin" style={{ fontSize: "2rem", marginBottom: "12px" }}>
              ⏳
            </div>
            Loading audit records...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "#94A3B8" }}>
            <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>📋</div>
            <p style={{ fontWeight: 600, margin: "0 0 6px" }}>No audit log entries found.</p>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
              Trigger a manual sync or wait for the daily 4:00 AM IST scheduler to run.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>Product</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>ASIN</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>Price Change</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>M.R.P.</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", color: "#94A3B8", fontWeight: 600 }}>Time (IST)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item, idx) => {
                  const hasPriceDrop = item.priceDiffPercentage !== undefined && item.priceDiffPercentage < 0;
                  const hasPriceIncrease = item.priceDiffPercentage !== undefined && item.priceDiffPercentage > 0;

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        background: item.priceChanged ? "rgba(249, 115, 22, 0.03)" : "transparent",
                      }}
                    >
                      {/* Product Thumbnail & Title */}
                      <td style={{ padding: "14px 18px", maxWidth: "340px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              style={{ width: "42px", height: "42px", objectFit: "contain", borderRadius: "8px", background: "#FFFFFF", padding: "2px" }}
                            />
                          ) : (
                            <div style={{ width: "42px", height: "42px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: "#F8FAFC",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "260px",
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                              {item.dealBadge && (
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(239, 68, 68, 0.2)",
                                    color: "#F87171",
                                    fontWeight: 700,
                                  }}
                                >
                                  {item.dealBadge}
                                </span>
                              )}
                              <a
                                href={item.affiliateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: "0.72rem", color: "#60A5FA", textDecoration: "none" }}
                              >
                                View on Amazon ↗
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ASIN */}
                      <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "#CBD5E1" }}>
                        {item.asin}
                      </td>

                      {/* Price Change */}
                      <td style={{ padding: "14px 18px" }}>
                        {item.priceChanged ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "#94A3B8", textDecoration: "line-through" }}>{item.oldPrice}</span>
                              <span style={{ color: "#F8FAFC" }}>→</span>
                              <span style={{ color: hasPriceDrop ? "#34D399" : "#F87171", fontWeight: 800 }}>
                                {item.newPrice}
                              </span>
                            </div>
                            {item.priceDiffPercentage !== undefined && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  color: hasPriceDrop ? "#34D399" : "#F87171",
                                }}
                              >
                                {hasPriceDrop ? "↓ " : "↑ "}
                                {Math.abs(item.priceDiffPercentage)}% {hasPriceDrop ? "Price Drop" : "Increase"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>{item.newPrice || item.oldPrice}</span>
                        )}
                      </td>

                      {/* MRP */}
                      <td style={{ padding: "14px 18px", color: "#94A3B8" }}>
                        {item.newOriginalPrice || item.oldOriginalPrice || "—"}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background:
                              item.status === "updated"
                                ? "rgba(16, 185, 129, 0.15)"
                                : item.status === "error"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                            color:
                              item.status === "updated"
                                ? "#34D399"
                                : item.status === "error"
                                ? "#F87171"
                                : "#94A3B8",
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Time */}
                      <td style={{ padding: "14px 18px", color: "#64748B", whiteSpace: "nowrap" }}>
                        {formatDate(item.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: page <= 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                color: page <= 1 ? "#64748B" : "#F8FAFC",
                border: "none",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: page >= totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                color: page >= totalPages ? "#64748B" : "#F8FAFC",
                border: "none",
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
