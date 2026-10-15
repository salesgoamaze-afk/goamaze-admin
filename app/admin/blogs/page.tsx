"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiEye,
  HiSearch,
  HiSparkles,
  HiOutlineGlobeAlt,
  HiOutlineDocumentText,
} from "react-icons/hi";

interface BlogItem {
  id: string;
  _id?: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  readTime: string;
  geoTarget?: string;
  featured: boolean;
  published: boolean;
  createdAt: string;
}

export default function AdminBlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBlogs();
  }, []);

  async function fetchBlogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/blogs?all=true&limit=100");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBlogs(data.data);
      }
    } catch (err) {
      console.error("Failed to load blogs:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/blogs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBlogs((prev) => prev.filter((b) => b.id !== id && b._id !== id));
      } else {
        alert(data.message || "Failed to delete blog");
      }
    } catch (err) {
      alert("Error deleting blog");
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePublish(blog: BlogItem) {
    const id = blog.id || blog._id;
    try {
      const res = await fetch(`/api/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !blog.published }),
      });
      const data = await res.json();
      if (data.success) {
        setBlogs((prev) =>
          prev.map((b) => (b.id === id || b._id === id ? { ...b, published: !b.published } : b))
        );
      }
    } catch {
      alert("Failed to toggle publish state");
    }
  }

  const categories = ["All", ...Array.from(new Set(blogs.map((b) => b.category)))];

  const filtered = blogs.filter((b) => {
    const matchCat = categoryFilter === "All" || b.category === categoryFilter;
    const matchSearch =
      !search.trim() ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase()) ||
      (b.geoTarget && b.geoTarget.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <AdminLayout title="Buying Guides & Articles">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 6px", display: "flex", alignItems: "center", gap: "10px", color: "#F8FAFC" }}>
              <HiOutlineDocumentText style={{ color: "#8B5CF6" }} />
              Buying Guides & SEO/AEO Articles
            </h1>
            <p style={{ color: "#64748B", fontSize: "0.88rem", margin: 0 }}>
              Manage affiliate guides, direct AI overview answers (AEO), and location targeting (GEO).
            </p>
          </div>

          <Link
            href="/admin/blogs/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              color: "white",
              fontWeight: 700,
              fontSize: "0.88rem",
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            }}
          >
            <HiPlus size={18} /> Write New Guide
          </Link>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: "280px", flex: 1, maxWidth: "420px" }}>
            <HiSearch size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides, keywords, or location target…"
              style={{
                width: "100%",
                padding: "10px 14px 10px 40px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "0.85rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "99px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: categoryFilter === cat ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.08)",
                  background: categoryFilter === cat ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                  color: categoryFilter === cat ? "#C4B5FD" : "#94A3B8",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        <div style={{
          background: "rgba(15,23,42,0.6)",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#64748B" }}>
              Loading articles…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
              <p style={{ fontSize: "1.1rem", color: "#94A3B8", marginBottom: "8px" }}>No guides found</p>
              <p style={{ fontSize: "0.85rem", marginBottom: "20px" }}>Create your first SEO/AEO buying guide to drive organic traffic.</p>
              <Link
                href="/admin/blogs/new"
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "#8B5CF6",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                + Create Article
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }}>
                    <th style={{ padding: "16px 20px" }}>Title & Slug</th>
                    <th style={{ padding: "16px 20px" }}>Category</th>
                    <th style={{ padding: "16px 20px" }}>GEO Target</th>
                    <th style={{ padding: "16px 20px" }}>Status</th>
                    <th style={{ padding: "16px 20px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const id = b.id || b._id || "";
                    return (
                      <tr
                        key={id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          transition: "background 0.2s",
                        }}
                      >
                        <td style={{ padding: "16px 20px", maxWidth: "420px" }}>
                          <div style={{ fontWeight: 700, color: "#F8FAFC", marginBottom: "4px" }}>
                            {b.title}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace" }}>
                            /blog/{b.slug}
                          </div>
                        </td>

                        <td style={{ padding: "16px 20px" }}>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: "rgba(139,92,246,0.12)",
                            color: "#C4B5FD",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}>
                            {b.category}
                          </span>
                        </td>

                        <td style={{ padding: "16px 20px", color: "#94A3B8", fontSize: "0.8rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <HiOutlineGlobeAlt size={14} style={{ color: "#38BDF8" }} />
                            <span>{b.geoTarget || "India"}</span>
                          </div>
                        </td>

                        <td style={{ padding: "16px 20px" }}>
                          <button
                            type="button"
                            onClick={() => togglePublish(b)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "99px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              border: "none",
                              background: b.published ? "rgba(52,211,153,0.15)" : "rgba(244,63,94,0.15)",
                              color: b.published ? "#34D399" : "#F43F5E",
                            }}
                          >
                            {b.published ? "● Published" : "○ Draft"}
                          </button>
                        </td>

                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                            <Link
                              href={`/blog/${b.slug}`}
                              target="_blank"
                              title="View Public Page"
                              style={{
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(255,255,255,0.04)",
                                color: "#94A3B8",
                                display: "inline-flex",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              <HiEye size={16} />
                            </Link>

                            <Link
                              href={`/admin/blogs/${id}/edit`}
                              title="Edit Article"
                              style={{
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(59,130,246,0.12)",
                                color: "#60A5FA",
                                display: "inline-flex",
                                border: "1px solid rgba(59,130,246,0.25)",
                              }}
                            >
                              <HiPencil size={16} />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDelete(id, b.title)}
                              disabled={deletingId === id}
                              title="Delete Article"
                              style={{
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(239,68,68,0.12)",
                                color: "#F87171",
                                border: "1px solid rgba(239,68,68,0.25)",
                                cursor: "pointer",
                                display: "inline-flex",
                              }}
                            >
                              <HiTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
