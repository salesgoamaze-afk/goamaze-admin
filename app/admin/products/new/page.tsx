"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import ImageUpload from "@/components/admin/ImageUpload";
import Link from "next/link";

const BADGE_OPTIONS = [
  "Editor's Choice", "Trending Now", "Popular Pick", "Customer Favourite",
  "Must Have", "Fresh Pick", "Eco Pick", "Focus Essential", "Calming Pick",
  "People Love This", "Monsoon Essential", "New Arrival",
];

interface Category { _id: string; name: string; icon: string; }

interface FormData {
  title:         string;
  subtitle:      string;
  description:   string;
  price:         string;
  originalPrice: string;
  unitPrice:     string;
  category:      string;
  image:         string;
  images:        string[];
  instagramUrl:  string;
  affiliateLink: string;
  badge:         string;
  rating:        string;
  reviews:       string;
  featured:      boolean;
}

const EMPTY: FormData = {
  title: "", subtitle: "", description: "", price: "", originalPrice: "", unitPrice: "",
  category: "", image: "", images: [], instagramUrl: "", affiliateLink: "", badge: "Editor's Choice",
  rating: "4.5", reviews: "0", featured: false,
};

export default function NewProductPage() {
  const router = useRouter();
  const [form,       setForm]       = useState<FormData>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Creator API live price & attributes fetch state
  const [asinInput, setAsinInput] = useState("");
  const [fetchingCreator, setFetchingCreator] = useState(false);
  const [fetchFeedback, setFetchFeedback] = useState<{
    type: "success" | "error";
    text: string;
    details?: any;
  } | null>(null);

  useEffect(() => {
    fetch("/api/categories", { credentials: "include" })
      .then(r => r.json())
      .then(r => { if (r.success) setCategories(r.data); });
  }, []);

  const handleFetchFromCreator = async (targetInput?: string) => {
    const raw = (targetInput || asinInput || form.affiliateLink || "").trim();
    if (!raw) {
      setFetchFeedback({
        type: "error",
        text: "Please enter an Amazon Product Link or ASIN (e.g. B0FN41SQQ7).",
      });
      return;
    }

    // Extract 10-character ASIN
    let asin = raw.toUpperCase();
    const urlMatch = raw.match(/(?:dp|gp\/product|product|asin|d)\/([A-Z0-9]{10})/i);
    if (urlMatch && urlMatch[1]) {
      asin = urlMatch[1].toUpperCase();
    } else {
      const queryMatch = raw.match(/[?&]asin=([A-Z0-9]{10})/i);
      if (queryMatch && queryMatch[1]) {
        asin = queryMatch[1].toUpperCase();
      }
    }

    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      setFetchFeedback({
        type: "error",
        text: "Could not detect a valid 10-character Amazon ASIN (e.g. B0FN41SQQ7).",
      });
      return;
    }

    setFetchingCreator(true);
    setFetchFeedback(null);

    try {
      const res = await fetch(`/api/amazon?itemIds=${asin}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || data.error || !data.products || data.products.length === 0) {
        setFetchFeedback({
          type: "error",
          text: data.error || data.message || "No product found on Amazon Creator API for ASIN: " + asin,
        });
        return;
      }

      const p = data.products[0];

      // Auto-match category from existing categories
      let matchedCategory = form.category;
      if (!matchedCategory && categories.length > 0) {
        const found = categories.find(
          c => c.name.toLowerCase() === (p.category || "").toLowerCase() ||
               p.title.toLowerCase().includes(c.name.toLowerCase())
        );
        if (found) matchedCategory = found.name;
        else matchedCategory = categories[0].name;
      }

      setForm(prev => ({
        ...prev,
        title: p.title || prev.title,
        subtitle: p.subtitle || prev.subtitle,
        description: p.description || prev.description,
        price: p.price && p.price !== "Check on Amazon" ? p.price : prev.price,
        originalPrice: p.originalPrice && p.originalPrice !== "Check on Amazon" ? p.originalPrice : (p.price || prev.originalPrice),
        unitPrice: p.unitPrice || prev.unitPrice,
        category: matchedCategory || prev.category,
        image: p.image || prev.image,
        images: Array.isArray(p.images) && p.images.length > 0 ? p.images : prev.images,
        rating: p.rating ? String(p.rating) : prev.rating,
        reviews: p.reviews ? String(p.reviews) : prev.reviews,
        affiliateLink: p.affiliateLink || prev.affiliateLink,
        badge: p.badge || prev.badge,
      }));

      const offerText = p.offerDetails?.dealBadge
        ? `[${p.offerDetails.dealBadge}] `
        : p.offerDetails?.savingPercentage
        ? `(${p.offerDetails.savingPercentage}% off) `
        : "";

      setFetchFeedback({
        type: "success",
        text: `✓ Live Price: ${p.price || "Check on Amazon"} ${offerText}| M.R.P.: ${p.originalPrice || p.price} — details auto-filled!`,
        details: p,
      });
    } catch (err: any) {
      setFetchFeedback({
        type: "error",
        text: `Network error querying Creator API: ${err.message}`,
      });
    } finally {
      setFetchingCreator(false);
    }
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image) { setError("Please upload or provide a product image."); return; }
    if (!form.category) { setError("Please select a category."); return; }
    setError("");
    setShowReviewModal(true);
  };

  const executeCreateProduct = async () => {
    setLoading(true);
    setError("");

    try {
      const parsedRating = parseFloat(form.rating);
      const parsedReviews = parseInt(form.reviews, 10);

      const payload = {
        ...form,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || `Authentic ${form.title.trim().slice(0, 60)} — top-rated choice`,
        price: form.price.trim(),
        originalPrice: form.originalPrice.trim() || form.price.trim(),
        unitPrice: form.unitPrice.trim(),
        rating: isNaN(parsedRating) ? 4.5 : Math.max(0, Math.min(5, parsedRating)),
        reviews: isNaN(parsedReviews) ? 0 : Math.max(0, parsedReviews),
      };

      const res = await fetch("/api/products", {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setShowReviewModal(false);
        if (data.errors?.fieldErrors) {
          const detail = Object.entries(data.errors.fieldErrors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
            .join("; ");
          setError(`Validation issue — ${detail}`);
        } else {
          setError(data.message || "Failed to create product.");
        }
        return;
      }

      router.push("/admin/products");
    } catch (err: any) {
      setShowReviewModal(false);
      setError("Network error: " + (err.message || "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F8FAFC",
    fontSize: "0.88rem",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "'Poppins', sans-serif",
    transition: "border-color 0.2s ease",
  };

  const labelStyle = {
    fontSize: "0.82rem",
    fontWeight: 600 as const,
    color: "#CBD5E1",
    display: "block" as const,
    marginBottom: "8px",
  };

  return (
    <AdminLayout title="Add Product">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <Link href="/admin/products" style={{ color: "#64748B", fontSize: "0.85rem", textDecoration: "none" }}>
          ← Products
        </Link>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: 0 }}>
          Add New Product
        </h2>
      </div>

      {/* ⚡ Creator API Auto-Fill / Live Price Fetch Bar */}
      <div style={{
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(249, 115, 22, 0.35)",
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "28px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "1.4rem" }}>⚡</span>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>
              Auto-Fetch Live Price & Attributes via Amazon Creator API
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94A3B8", margin: "2px 0 0" }}>
              Paste an Amazon Product URL or enter a 10-character ASIN to automatically fetch live selling price, M.R.P., gallery images, ratings, and specifications.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="e.g. https://www.amazon.in/dp/B0FN41SQQ7 or ASIN B0FN41SQQ7"
            value={asinInput}
            onChange={(e) => setAsinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFetchFromCreator(asinInput);
              }
            }}
            style={{
              flex: 1,
              minWidth: "260px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#F8FAFC",
              fontSize: "0.88rem",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => handleFetchFromCreator(asinInput)}
            disabled={fetchingCreator}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
              border: "none",
              color: "white",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: fetchingCreator ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
            }}
          >
            {fetchingCreator ? "🔄 Fetching Live Price…" : "⚡ Fetch Price & Details"}
          </button>
        </div>

        {fetchFeedback && (
          <div style={{
            marginTop: "14px",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "0.86rem",
            fontWeight: 600,
            background: fetchFeedback.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${fetchFeedback.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: fetchFeedback.type === "success" ? "#34D399" : "#FCA5A5",
          }}>
            {fetchFeedback.text}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Product Title *</label>
              <input type="text" required value={form.title} onChange={set("title")} placeholder="e.g. Architect LED Desk Lamp" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>

            {/* Subtitle */}
            <div>
              <label style={labelStyle}>Subtitle / Tagline *</label>
              <input type="text" required value={form.subtitle} onChange={set("subtitle")} placeholder="Short catchy description" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea value={form.description} onChange={set("description")} placeholder="Longer product description…" rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>

            {/* Price row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Price *</label>
                <input type="text" required value={form.price} onChange={set("price")} placeholder="₹1,299" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <div>
                <label style={labelStyle}>Original Price *</label>
                <input type="text" required value={form.originalPrice} onChange={set("originalPrice")} placeholder="₹2,199" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
            </div>

            {/* Unit Price / Pack Info */}
            <div>
              <label style={labelStyle}>
                Unit Price / Pack Breakdown (Optional)
                <span style={{ fontSize: "0.72rem", color: "#94A3B8", marginLeft: "6px", fontWeight: 400 }}>
                  (e.g. &quot;6-in-1 • ₹166/pc&quot; or &quot;₹166.50/piece&quot;)
                </span>
              </label>
              <input
                type="text"
                value={form.unitPrice}
                onChange={set("unitPrice")}
                placeholder="e.g. 6-in-1 • ₹166/pc or Pack of 2"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Category */}
            <div>
              <label style={labelStyle}>Category *</label>
              <select required value={form.category} onChange={set("category")} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="" disabled>Select a category</option>
                {categories.map(c => (
                  <option key={c._id} value={c.name} style={{ background: "#1E293B" }}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Badge */}
            <div>
              <label style={labelStyle}>Badge</label>
              <select value={form.badge} onChange={set("badge")} style={{ ...inputStyle, cursor: "pointer" }}>
                {BADGE_OPTIONS.map(b => (
                  <option key={b} value={b} style={{ background: "#1E293B" }}>{b}</option>
                ))}
              </select>
            </div>

            {/* Rating & Reviews */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Rating (0–5)</label>
                <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set("rating")} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <div>
                <label style={labelStyle}>Reviews Count</label>
                <input type="number" min="0" value={form.reviews} onChange={set("reviews")} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                  onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
            </div>

            {/* Affiliate Link */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ ...labelStyle, margin: 0 }}>Amazon Affiliate Link *</label>
                {form.affiliateLink && (
                  <button
                    type="button"
                    onClick={() => handleFetchFromCreator(form.affiliateLink)}
                    disabled={fetchingCreator}
                    style={{
                      background: "rgba(249,115,22,0.18)",
                      border: "1px solid rgba(249,115,22,0.4)",
                      color: "#FB923C",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: fetchingCreator ? "wait" : "pointer",
                    }}
                  >
                    {fetchingCreator ? "🔄 Fetching…" : "⚡ Fetch Live Price from Link"}
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={form.affiliateLink}
                onChange={set("affiliateLink")}
                placeholder="https://www.amazon.in/dp/... or https://amzn.to/..."
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Instagram Link (Optional) */}
            <div>
              <label style={labelStyle}>
                Instagram Reel / Post URL (Optional)
                <span style={{ fontSize: "0.72rem", color: "#94A3B8", marginLeft: "6px", fontWeight: 400 }}>
                  (If empty, automatically redirects to your GoAmaze Instagram Channel)
                </span>
              </label>
              <input
                type="url"
                value={form.instagramUrl}
                onChange={set("instagramUrl")}
                placeholder="https://www.instagram.com/reel/... (optional)"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Featured */}
            <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" checked={form.featured} onChange={set("featured")} style={{ width: "18px", height: "18px", accentColor: "#8B5CF6" }} />
              <span style={{ fontSize: "0.87rem", color: "#CBD5E1", fontWeight: 600 }}>Mark as Featured Product</span>
            </label>
          </div>

          {/* Right column — Images */}
          <div>
            <ImageUpload
              value={form.image}
              images={form.images}
              onChange={url => setForm(f => ({ ...f, image: url }))}
              onImagesChange={imgs => setForm(f => ({ ...f, images: imgs, image: imgs[0] || f.image }))}
              label="Product Images (Multi-Image Gallery) *"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: "20px",
            padding: "14px 18px",
            borderRadius: "12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#FCA5A5",
            fontSize: "0.85rem",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
          <button type="submit" disabled={loading} style={{
            padding: "13px 28px",
            borderRadius: "12px",
            background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#3B82F6,#8B5CF6)",
            border: "none",
            color: "white",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            boxShadow: loading ? "none" : "0 6px 20px rgba(99,102,241,0.35)",
          }}>
            {loading ? "Creating…" : "✓ Create Product"}
          </button>
          <Link href="/admin/products" style={{
            padding: "13px 28px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94A3B8",
            fontSize: "0.9rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}>
            Cancel
          </Link>
        </div>
      </form>

      {/* ── Review Details Confirmation Modal ── */}
      {showReviewModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          background: "rgba(10, 15, 30, 0.85)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflowY: "auto",
            borderRadius: "24px",
            background: "linear-gradient(145deg, #1E293B, #0F172A)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 40px rgba(139, 92, 246, 0.2)",
            padding: "32px",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.4rem" }}>🔍</span>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "'Montserrat', sans-serif", margin: 0 }}>
                  Review Product Details
                </h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Product Summary Grid */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "24px", flexWrap: "wrap" }}>
              {/* Product Thumbnail */}
              <div style={{ width: "120px", height: "120px", borderRadius: "16px", overflow: "hidden", background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt={form.title} referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>

              {/* Core Details */}
              <div style={{ flex: 1, minWidth: "240px" }}>
                <div style={{ marginBottom: "8px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "99px",
                    background: "rgba(139, 92, 246, 0.2)",
                    border: "1px solid rgba(139, 92, 246, 0.4)",
                    color: "#C4B5FD",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}>
                    🏷️ Category: {form.category || "Unassigned"}
                  </span>
                  <span style={{
                    display: "inline-block",
                    marginLeft: "8px",
                    padding: "4px 10px",
                    borderRadius: "99px",
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#FCD34D",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}>
                    {form.badge}
                  </span>
                </div>

                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC", margin: "0 0 6px", lineHeight: 1.4 }}>
                  {form.title}
                </h4>
                <p style={{ fontSize: "0.8rem", color: "#94A3B8", margin: "0 0 8px", lineHeight: 1.5 }}>
                  {form.subtitle}
                </p>
                {form.images && form.images.length > 1 && (
                  <div style={{ fontSize: "0.75rem", color: "#A78BFA", fontWeight: 600 }}>
                    🖼️ {form.images.length} images in gallery
                  </div>
                )}
              </div>
            </div>

            {/* Price & Rating Breakdown Table */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              padding: "16px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginBottom: "24px",
              fontSize: "0.85rem",
            }}>
              <div>
                <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Selling Price</span>
                <span style={{ color: "#34D399", fontWeight: 800, fontSize: "1.1rem" }}>{form.price}</span>
              </div>
              <div>
                <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Original MRP</span>
                <span style={{ color: "#94A3B8", textDecoration: "line-through", fontWeight: 600 }}>{form.originalPrice}</span>
              </div>
              {form.unitPrice && (
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Unit / Pack Breakdown</span>
                  <span style={{ color: "#FCD34D", fontWeight: 600 }}>{form.unitPrice}</span>
                </div>
              )}
              <div>
                <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Rating & Reviews</span>
                <span style={{ color: "#FBBF24", fontWeight: 600 }}>⭐ {form.rating} ({form.reviews} reviews)</span>
              </div>
              <div>
                <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Featured on Home</span>
                <span style={{ color: form.featured ? "#6EE7B7" : "#94A3B8", fontWeight: 600 }}>{form.featured ? "✓ Yes" : "No"}</span>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "#64748B", display: "block", fontSize: "0.75rem" }}>Instagram Link</span>
                <span style={{ color: form.instagramUrl ? "#F472B6" : "#94A3B8", fontSize: "0.8rem" }}>
                  {form.instagramUrl ? `📸 Custom Reel: ${form.instagramUrl}` : "📸 Auto-redirects to GoAmaze Channel"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#CBD5E1",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✏️ Edit Details
              </button>

              <button
                type="button"
                onClick={executeCreateProduct}
                disabled={loading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg,#10B981,#059669)",
                  border: "none",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 6px 20px rgba(16,185,129,0.35)",
                }}
              >
                {loading ? "Publishing…" : "🚀 Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
