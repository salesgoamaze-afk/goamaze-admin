"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import StatCard from "@/components/admin/StatCard";
import Link from "next/link";

interface Analytics {
  totalProducts:    number;
  totalCategories:  number;
  totalSubscribers: number;
  featuredProducts: number;
  totalBlogs?:      number;
}

export default function AdminDashboard() {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice,  setNotice]  = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    fetch(`/api/analytics?t=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/products/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setNotice(resData.message || "Catalogue synced successfully!");
        fetchAnalytics();
      } else {
        setNotice(resData.message || "Failed to sync catalogue.");
      }
    } catch (err: any) {
      setNotice("Sync error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AdminLayout title="Dashboard">
      {/* Notice Banner */}
      {notice && (
        <div style={{
          padding: "12px 18px",
          borderRadius: "12px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(16,185,129,0.15)",
          border: "1px solid rgba(16,185,129,0.3)",
          color: "#34D399",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}>
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}

      {/* Welcome */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "36px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: "0 0 6px" }}>
            Welcome back 👋
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.9rem", margin: 0 }}>
            Here&apos;s what&apos;s happening with GoAmaze today.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "11px 20px",
            borderRadius: "12px",
            background: syncing ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.18)",
            border: "1px solid rgba(139,92,246,0.4)",
            color: "#C4B5FD",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: syncing ? "wait" : "pointer",
            transition: "all 0.2s ease",
          }}
          title="Synchronize and restore products catalogue"
        >
          {syncing ? "🔄 Syncing…" : "🔄 Sync Catalogue"}
        </button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "20px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: "120px", borderRadius: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "16px", marginBottom: "40px" }}>
          <StatCard label="Total Products"    value={data?.totalProducts    ?? 0} icon="🛍️" color="#3B82F6" subtitle="All curated products" />
          <StatCard label="Guides & Blogs"    value={data?.totalBlogs       ?? 0} icon="📝" color="#8B5CF6" subtitle="SEO & AEO articles" />
          <StatCard label="Categories"        value={data?.totalCategories  ?? 0} icon="🏷️" color="#06B6D4" subtitle="Product categories" />
          <StatCard label="Newsletter Subs"   value={data?.totalSubscribers ?? 0} icon="📧" color="#10B981" subtitle="Subscribed emails" />
          <StatCard label="Featured Products" value={data?.featuredProducts ?? 0} icon="⭐" color="#F59E0B" subtitle="Highlighted picks" />
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ fontWeight: 700, color: "#94A3B8", marginBottom: "16px", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.78rem" }}>
          Quick Actions
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "14px" }}>
          {[
            { href: "/admin/products/new",  label: "Add New Product",  icon: "➕", color: "#3B82F6" },
            { href: "/admin/blogs/new",     label: "Write Buying Guide",icon: "📝", color: "#8B5CF6" },
            { href: "/admin/blogs",         label: "All Guides & Blogs",icon: "📚", color: "#A855F7" },
            { href: "/admin/categories",    label: "Manage Categories", icon: "🏷️", color: "#06B6D4" },
            { href: "/admin/newsletter",    label: "View Subscribers",  icon: "📧", color: "#10B981" },
            { href: "/admin/products",      label: "All Products",      icon: "📦", color: "#F59E0B" },
          ].map(({ href, label, icon, color }) => (
            <Link key={href} href={href} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px 20px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#CBD5E1",
              textDecoration: "none",
              fontSize: "0.87rem",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = `${color}44`;
              (e.currentTarget as HTMLAnchorElement).style.background = `${color}12`;
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
            }}
            >
              <span style={{ fontSize: "20px" }}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
