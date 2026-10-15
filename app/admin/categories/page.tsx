"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface Category {
  _id: string;
  name: string;
  icon: string;
  slug: string;
  createdAt: string;
}

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name,       setName]       = useState("");
  const [icon,       setIcon]       = useState("🏷️");
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/categories")
      .then(r => r.json())
      .then(r => { if (r.success) setCategories(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), icon: icon.trim() || "🏷️" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to add category.");
        return;
      }

      setSuccess(`Category "${name}" added!`);
      setName("");
      setIcon("🏷️");
      fetchCategories();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Delete category "${catName}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories(c => c.filter(x => x._id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  const inputStyle = {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F8FAFC",
    fontSize: "0.88rem",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <AdminLayout title="Categories">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: "0 0 4px" }}>
            Categories ({categories.length})
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>Organize your store collections</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "28px" }}>
        {/* Add Category Form */}
        <div style={{
          padding: "24px",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          height: "fit-content",
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F8FAFC", margin: "0 0 16px" }}>
            Add New Category
          </h3>

          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#CBD5E1", display: "block", marginBottom: "6px" }}>
                Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Travel Gear"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#CBD5E1", display: "block", marginBottom: "6px" }}>
                Emoji Icon
              </label>
              <input
                type="text"
                placeholder="e.g. ✈️"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", color: "#FCA5A5", fontSize: "0.8rem" }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(16,185,129,0.1)", color: "#34D399", fontSize: "0.8rem" }}>
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                border: "none",
                color: "white",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: submitting ? "wait" : "pointer",
                marginTop: "8px",
              }}
            >
              {submitting ? "Adding…" : "+ Add Category"}
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div style={{
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "50px 1fr 100px",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: "0.72rem",
            color: "#64748B",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            <span>Icon</span>
            <span>Category</span>
            <span>Action</span>
          </div>

          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Loading…</div>
          ) : categories.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>No categories yet.</div>
          ) : (
            categories.map((c, i) => (
              <div
                key={c._id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 100px",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom: i < categories.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#F8FAFC" }}>{c.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>slug: {c.slug}</div>
                </div>
                <button
                  onClick={() => handleDelete(c._id, c.name)}
                  disabled={deleting === c._id}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#FCA5A5",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  {deleting === c._id ? "…" : "Delete"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
