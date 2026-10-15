"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  HiArrowLeft,
  HiSave,
  HiSparkles,
  HiOutlineGlobeAlt,
  HiOutlineQuestionMarkCircle,
  HiPlus,
  HiTrash,
} from "react-icons/hi";

interface ProductOption {
  id: string;
  _id?: string;
  title: string;
  price: string;
  category: string;
  image: string;
}

interface CategoryOption {
  name: string;
}

export default function AdminNewBlogPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&q=80",
    category: "Kitchen Appliances",
    author: "GoAmaze Editorial",
    readTime: "5 min read",
    seoTitle: "",
    seoDescription: "",
    keywordsStr: "best products India, buying guide 2026, curated essentials",
    aeoSummary: "",
    geoTarget: "Pan-India & Metro Cities",
    featured: false,
    published: true,
  });

  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([
    { question: "", answer: "" },
  ]);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    // Load products and categories for dropdown/checkboxes
    Promise.all([
      fetch("/api/products?limit=100").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([prodRes, catRes]) => {
        if (prodRes.success && Array.isArray(prodRes.data)) {
          setProductsList(prodRes.data);
        }
        if (catRes.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
          setCategoriesList(catRes.data.map((c: any) => c.name));
          if (catRes.data[0]?.name) {
            setForm((f) => ({ ...f, category: catRes.data[0].name }));
          }
        } else {
          setCategoriesList([
            "Kitchen Appliances",
            "Home Decoration",
            "Lifestyle Products",
            "Study & Workspace",
            "Gym",
          ]);
        }
      })
      .catch((err) => console.error("Error loading resources:", err));
  }, []);

  function handleTitleChange(val: string) {
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((f) => ({
      ...f,
      title: val,
      slug: f.slug ? f.slug : autoSlug,
      seoTitle: f.seoTitle ? f.seoTitle : val,
    }));
  }

  function handleAddFaq() {
    setFaqs((prev) => [...prev, { question: "", answer: "" }]);
  }

  function handleRemoveFaq(index: number) {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFaqChange(index: number, field: "question" | "answer", val: string) {
    setFaqs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  }

  function toggleProduct(pid: string) {
    setSelectedProductIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.excerpt.trim()) {
      alert("Please fill in the title, excerpt, and content.");
      return;
    }

    setSubmitting(true);
    try {
      const keywords = form.keywordsStr
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());

      const payload = {
        ...form,
        keywords,
        faqSchema: validFaqs,
        productIds: selectedProductIds,
      };

      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/admin/blogs");
      } else {
        alert(data.message || "Failed to create article");
      }
    } catch (err) {
      console.error(err);
      alert("Network error creating article");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Create Buying Guide">
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <Link
              href="/admin/blogs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#94A3B8",
                textDecoration: "none",
                fontSize: "0.85rem",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "12px",
              }}
            >
              <HiArrowLeft size={14} /> Back to Guides List
            </Link>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>
              Write New Buying Guide & SEO/AEO Article
            </h1>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 28px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              color: "white",
              fontWeight: 700,
              fontSize: "0.9rem",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            }}
          >
            <HiSave size={18} /> {submitting ? "Saving Article…" : "Publish / Save Article"}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          
          {/* Section 1: Basic Information */}
          <div style={{
            background: "rgba(15,23,42,0.7)",
            padding: "28px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "20px", color: "#F8FAFC" }}>
              1. Article Overview
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Top 5 Multi-Function Food Processors in India (2026 Buying Guide)"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontSize: "0.95rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="top-5-food-processors-india-2026"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#A78BFA",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "#0F172A",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="GoAmaze Editorial"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                    Read Time
                  </label>
                  <input
                    type="text"
                    value={form.readTime}
                    onChange={(e) => setForm({ ...form, readTime: e.target.value })}
                    placeholder="5 min read"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                  Cover Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={form.coverImage}
                  onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                  Short Excerpt / Teaser *
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.excerpt}
                  onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value, seoDescription: prev.seoDescription || e.target.value }))}
                  placeholder="Summary paragraph displayed on blog cards and search snippets…"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: SEO, AEO & GEO Optimization */}
          <div style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 100%)",
            padding: "28px",
            borderRadius: "16px",
            border: "1px solid rgba(139,92,246,0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <HiSparkles style={{ color: "#A78BFA", fontSize: "1.4rem" }} />
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#F8FAFC" }}>
                2. SEO, AEO & GEO Engine Optimization
              </h2>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#94A3B8", marginBottom: "20px" }}>
              Craft direct answers for Google AI Overviews, Perplexity & ChatGPT (AEO) and geographic targeting (GEO).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* AEO Direct Answer */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "#A78BFA", marginBottom: "6px" }}>
                  <span>✦ AEO Quick Answer Summary (AI Engine Highlight)</span>
                </label>
                <p style={{ fontSize: "0.78rem", color: "#94A3B8", margin: "0 0 6px" }}>
                  A clear, concise 2-3 sentence answer to the user's primary query. Rendered prominently at the top of the article.
                </p>
                <textarea
                  rows={3}
                  value={form.aeoSummary}
                  onChange={(e) => setForm({ ...form, aeoSummary: e.target.value })}
                  placeholder="e.g. The best overall food processor in India for 2026 is the Inalsa 1000W model due to its pure copper motor, dedicated atta kneader, and citrus juicer attachments."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "rgba(139,92,246,0.1)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    color: "white",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>

              {/* GEO Target */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "#38BDF8", marginBottom: "6px" }}>
                    <HiOutlineGlobeAlt size={16} />
                    <span>GEO Target Region / Audience</span>
                  </label>
                  <input
                    type="text"
                    value={form.geoTarget}
                    onChange={(e) => setForm({ ...form, geoTarget: e.target.value })}
                    placeholder="e.g. Pan-India, Tier-1 Metro Cities (Bangalore, Mumbai, Delhi)"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "6px" }}>
                    SEO & GEO Target Keywords (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.keywordsStr}
                    onChange={(e) => setForm({ ...form, keywordsStr: e.target.value })}
                    placeholder="best food processor India, Inalsa review, kitchen appliances Delhi"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Interactive FAQ Builder */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "#CBD5E1" }}>
                    <HiOutlineQuestionMarkCircle size={16} style={{ color: "#34D399" }} />
                    <span>FAQ Items (Automatically generates Google JSON-LD FAQPage Schema)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      background: "rgba(52,211,153,0.15)",
                      border: "1px solid rgba(52,211,153,0.3)",
                      color: "#34D399",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <HiPlus size={14} /> Add FAQ
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => handleFaqChange(idx, "question", e.target.value)}
                          placeholder={`Question #${idx + 1} (e.g. Which is the best food processor in India?)`}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "white",
                            fontSize: "0.82rem",
                            outline: "none",
                          }}
                        />
                        {faqs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFaq(idx)}
                            style={{
                              padding: "8px",
                              borderRadius: "8px",
                              background: "rgba(239,68,68,0.15)",
                              border: "none",
                              color: "#F87171",
                              cursor: "pointer",
                            }}
                          >
                            <HiTrash size={14} />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => handleFaqChange(idx, "answer", e.target.value)}
                        placeholder={`Direct, authoritative answer for Question #${idx + 1}…`}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#CBD5E1",
                          fontSize: "0.82rem",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Article Content (Markdown) */}
          <div style={{
            background: "rgba(15,23,42,0.7)",
            padding: "28px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#F8FAFC" }}>
                3. Article Content (Markdown)
              </h2>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab("edit")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: previewTab === "edit" ? "#8B5CF6" : "rgba(255,255,255,0.05)",
                    color: previewTab === "edit" ? "white" : "#94A3B8",
                  }}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("preview")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: previewTab === "preview" ? "#8B5CF6" : "rgba(255,255,255,0.05)",
                    color: previewTab === "preview" ? "white" : "#94A3B8",
                  }}
                >
                  Preview
                </button>
              </div>
            </div>

            {previewTab === "edit" ? (
              <textarea
                rows={16}
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Write your article in markdown. Use ## for headings, - for lists, and **bold** for emphasis…"
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#F8FAFC",
                  fontSize: "0.9rem",
                  fontFamily: "monospace",
                  lineHeight: 1.7,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <div style={{
                padding: "20px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: "260px",
                whiteSpace: "pre-wrap",
                color: "#E2E8F0",
                lineHeight: 1.8,
                fontSize: "0.92rem",
              }}>
                {form.content || "Nothing to preview yet."}
              </div>
            )}
          </div>

          {/* Section 4: Attach Affiliate Products */}
          <div style={{
            background: "rgba(15,23,42,0.7)",
            padding: "28px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px", color: "#F8FAFC" }}>
              4. Attach Featured Products (Affiliate Buy Cards)
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#94A3B8", marginBottom: "16px" }}>
              Selected products will automatically be embedded inside the article with live Amazon prices and direct affiliate purchase buttons.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "12px",
              maxHeight: "280px",
              overflowY: "auto",
              padding: "8px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "12px",
            }}>
              {productsList.map((p) => {
                const pid = p.id || p._id || "";
                const isChecked = selectedProductIds.includes(pid);
                return (
                  <div
                    key={pid}
                    onClick={() => toggleProduct(pid)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: isChecked ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)",
                      border: isChecked ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: "pointer" }}
                    />
                    <img
                      src={p.image}
                      alt={p.title}
                      referrerPolicy="no-referrer"
                      style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "6px" }}
                    />
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#34D399", fontWeight: 700 }}>
                        {p.price}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Publish Settings */}
          <div style={{
            background: "rgba(15,23,42,0.7)",
            padding: "24px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}>
            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                />
                <span>Publish Publicly</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                />
                <span>Feature in Hero Banner</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                color: "white",
                fontWeight: 700,
                fontSize: "0.9rem",
                border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <HiSave size={18} /> {submitting ? "Publishing…" : "Publish Article"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
