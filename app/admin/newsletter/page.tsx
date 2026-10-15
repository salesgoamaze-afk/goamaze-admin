"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

interface Subscriber {
  _id: string;
  email: string;
  status: string;
  createdAt: string;
}

export default function NewsletterAdminPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");

  const fetchSubscribers = () => {
    setLoading(true);
    fetch("/api/newsletter")
      .then(r => r.json())
      .then(r => { if (r.success) setSubscribers(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const filtered = subscribers.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      ["Email,Status,Subscribed Date", ...subscribers.map(s => `${s.email},${s.status},${s.createdAt}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `goamaze-subscribers-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout title="Newsletter Subscribers">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: "0 0 4px" }}>
            Subscribers ({subscribers.length})
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>People signed up for GoAmaze newsletter updates</p>
        </div>

        {subscribers.length > 0 && (
          <button
            onClick={exportCSV}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#F8FAFC",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📥 Export CSV
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Filter by email…"
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

      {/* Table */}
      <div style={{
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 200px",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          fontSize: "0.72rem",
          color: "#64748B",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          <span>Subscriber Email</span>
          <span>Status</span>
          <span>Date Subscribed</span>
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>Loading subscribers…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>No subscribers found.</div>
        ) : (
          filtered.map((s, i) => (
            <div
              key={s._id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 200px",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <span style={{ fontSize: "0.88rem", color: "#F8FAFC", fontWeight: 600 }}>{s.email}</span>
              <span style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "99px",
                background: "rgba(16,185,129,0.12)",
                color: "#34D399",
                fontSize: "0.75rem",
                fontWeight: 600,
                width: "fit-content",
              }}>
                {s.status}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                {new Date(s.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
