"use client";

import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANONICAL_CATEGORIES, CategoryDefinition } from "@/lib/taxonomy";

interface Category {
  _id: string;
  id?: string;
  name: string;
  icon: string;
  slug: string;
  subcategories?: string[];
  createdAt?: string;
}

export default function CategoriesAdminPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // "Add Product by Category" State
  const [selectedCatSlug, setSelectedCatSlug] = useState<string>("kitchen-appliances");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [categoryKeywords, setCategoryKeywords] = useState<string>("");

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setCategories(r.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Merge canonical categories with database categories for display
  const combinedCategories = useMemo(() => {
    const slugMap = new Map<string, Category>();

    // 1. Add canonical taxonomy categories
    CANONICAL_CATEGORIES.forEach((c) => {
      slugMap.set(c.slug, {
        _id: c.id,
        id: c.id,
        name: c.name,
        icon: c.icon,
        slug: c.slug,
        subcategories: c.subcategories,
      });
    });

    // 2. Overlay any database custom categories
    categories.forEach((c) => {
      if (!slugMap.has(c.slug)) {
        slugMap.set(c.slug, {
          ...c,
          subcategories: c.subcategories || [],
        });
      }
    });

    return Array.from(slugMap.values());
  }, [categories]);

  // Selected category definition for subcategory lookup
  const currentCategoryDef = useMemo(() => {
    return (
      combinedCategories.find((c) => c.slug === selectedCatSlug) ||
      CANONICAL_CATEGORIES.find((c) => c.slug === selectedCatSlug)
    );
  }, [combinedCategories, selectedCatSlug]);

  const availableSubcategories = currentCategoryDef?.subcategories || [];

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon: icon.trim() || "🏷️" }),
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
        setCategories((c) => c.filter((x) => x._id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  // Navigate to Amazon Discovery with category pre-selected
  const handleDiscoverAmazonProducts = (catSlug?: string, subcat?: string) => {
    const slug = catSlug || selectedCatSlug;
    const sub = subcat || selectedSubcategory;
    const params = new URLSearchParams();
    params.set("category", slug);
    if (sub) params.set("subcategory", sub);
    if (categoryKeywords.trim()) params.set("keywords", categoryKeywords.trim());
    router.push(`/admin/amazon-import?${params.toString()}`);
  };

  // Navigate to Manual Add Product with category pre-selected
  const handleManualAddProduct = (catSlug?: string) => {
    const slug = catSlug || selectedCatSlug;
    router.push(`/admin/products/new?category=${slug}`);
  };

  const inputStyle = {
    padding: "11px 14px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F8FAFC",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <AdminLayout title="Categories & Product Discovery">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: "0 0 4px" }}>
            Categories ({combinedCategories.length})
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.85rem", margin: 0 }}>
            Manage product categories and quickly discover or add products directly to any category.
          </p>
        </div>
      </div>

      {/* ── SECTION: ADD PRODUCT BY CATEGORY (IMPORTANT FEATURE) ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)",
          border: "1px solid rgba(249, 115, 22, 0.35)",
          borderRadius: "18px",
          padding: "24px",
          marginBottom: "32px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "1.4rem" }}>🛍️</span>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", margin: "0 0 2px" }}>
              Add Products by Category
            </h3>
            <p style={{ color: "#94A3B8", fontSize: "0.8rem", margin: 0 }}>
              Select a target category and optional subcategory to immediately fetch Amazon products or add manually.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "18px" }}>
          {/* Category Dropdown */}
          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
              Select Target Category *
            </label>
            <select
              value={selectedCatSlug}
              onChange={(e) => {
                setSelectedCatSlug(e.target.value);
                setSelectedSubcategory("");
              }}
              style={{
                ...inputStyle,
                width: "100%",
                background: "#1E293B",
                fontWeight: 600,
              }}
            >
              {combinedCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Dropdown (Dynamic) */}
          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
              Subcategory (Optional)
            </label>
            <select
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
              style={{
                ...inputStyle,
                width: "100%",
                background: "#1E293B",
                fontWeight: 600,
              }}
            >
              <option value="">All {currentCategoryDef?.name || "Subcategories"}</option>
              {availableSubcategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Filter */}
          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
              Search Keywords (Optional)
            </label>
            <input
              type="text"
              placeholder={`e.g. best ${selectedSubcategory || currentCategoryDef?.name || "products"}`}
              value={categoryKeywords}
              onChange={(e) => setCategoryKeywords(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => handleDiscoverAmazonProducts()}
            style={{
              padding: "11px 22px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
              border: "none",
              color: "#FFFFFF",
              fontSize: "0.85rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(249, 115, 22, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🛒</span> Discover & Import from Amazon
          </button>

          <button
            type="button"
            onClick={() => handleManualAddProduct()}
            style={{
              padding: "11px 18px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#F8FAFC",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>➕</span> Add Product Manually
          </button>

          <Link
            href={`/admin/products?category=${selectedCatSlug}`}
            style={{
              padding: "11px 18px",
              borderRadius: "10px",
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              color: "#60A5FA",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🛍️</span> View Products in {currentCategoryDef?.name}
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "28px" }}>
        {/* Create Custom Category Form */}
        <div
          style={{
            padding: "24px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            height: "fit-content",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC", margin: "0 0 16px" }}>
            Add Custom Category
          </h3>

          <form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#CBD5E1", display: "block", marginBottom: "6px" }}>
                Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Travel Gear"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setIcon(e.target.value)}
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
                padding: "11px 20px",
                borderRadius: "10px",
                background: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                border: "none",
                color: "white",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: submitting ? "wait" : "pointer",
                marginTop: "6px",
              }}
            >
              {submitting ? "Adding…" : "+ Create Category"}
            </button>
          </form>
        </div>

        {/* Categories Directory with 1-Click Product Addition */}
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Active Product Categories Directory
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              {combinedCategories.length} categories available
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>Loading categories…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {combinedCategories.map((c, i) => {
                const isCustom = !CANONICAL_CATEGORIES.some((can) => can.slug === c.slug);
                const subCount = c.subcategories?.length || 0;

                return (
                  <div
                    key={c.slug || c._id}
                    style={{
                      padding: "16px 20px",
                      borderBottom: i < combinedCategories.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px",
                      background: selectedCatSlug === c.slug ? "rgba(249, 115, 22, 0.05)" : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Category Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
                      <span style={{ fontSize: "1.6rem" }}>{c.icon}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F8FAFC" }}>{c.name}</span>
                          {isCustom && (
                            <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: "4px", background: "rgba(139, 92, 246, 0.2)", color: "#C4B5FD", fontWeight: 700 }}>
                              Custom
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                          slug: <code style={{ color: "#94A3B8" }}>{c.slug}</code>
                          {subCount > 0 && <span> • {subCount} subcategories</span>}
                        </div>
                        {/* Subcategory Pills Preview */}
                        {c.subcategories && c.subcategories.length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {c.subcategories.slice(0, 4).map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => handleDiscoverAmazonProducts(c.slug, sub)}
                                title={`Discover ${sub} products on Amazon`}
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: "#CBD5E1",
                                  cursor: "pointer",
                                }}
                              >
                                {sub} ↗
                              </button>
                            ))}
                            {c.subcategories.length > 4 && (
                              <span style={{ fontSize: "0.68rem", color: "#64748B", padding: "2px 4px" }}>
                                +{c.subcategories.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons for this Category */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleDiscoverAmazonProducts(c.slug)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          background: "rgba(249, 115, 22, 0.15)",
                          border: "1px solid rgba(249, 115, 22, 0.3)",
                          color: "#FB923C",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <span>🛒</span> Add via Amazon
                      </button>

                      <button
                        type="button"
                        onClick={() => handleManualAddProduct(c.slug)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          background: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#E2E8F0",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        + Add Manually
                      </button>

                      <Link
                        href={`/admin/products?category=${c.slug}`}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          background: "rgba(59, 130, 246, 0.1)",
                          border: "1px solid rgba(59, 130, 246, 0.2)",
                          color: "#60A5FA",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Products
                      </Link>

                      {isCustom && (
                        <button
                          onClick={() => handleDelete(c._id, c.name)}
                          disabled={deleting === c._id}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            color: "#FCA5A5",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {deleting === c._id ? "…" : "✕"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
