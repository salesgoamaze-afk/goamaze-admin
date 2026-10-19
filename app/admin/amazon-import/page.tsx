"use client";

import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

interface Category {
  _id?: string;
  id?: string;
  name: string;
  icon?: string;
}

interface AmazonProduct {
  asin: string;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  originalPrice: string;
  unitPrice: string;
  image: string;
  images: string[];
  affiliateLink: string;
  category: string;
  badge: string;
  rating: number;
  reviews: number;
  features: string[];
  brand?: string;
  featured?: boolean;
  instagramUrl?: string;
}

const BADGE_OPTIONS = [
  "Amazon Pick",
  "Editor's Choice",
  "Trending Now",
  "Popular Pick",
  "Customer Favourite",
  "Must Have",
  "Best Seller",
  "New Arrival",
  "Fresh Pick",
  "Eco Pick",
];

const AMAZON_DEPARTMENTS = [
  "All",
  "Appliances",
  "Apparel",
  "Beauty",
  "Books",
  "Computers",
  "Electronics",
  "Furniture",
  "GardenAndOutdoors",
  "GroceryAndGourmetFoods",
  "HealthAndPersonalCare",
  "HomeAndKitchen",
  "Jewellery",
  "LuggageAndBags",
  "OfficeProducts",
  "PetSupplies",
  "ShoesAndHandbags",
  "SportsAndOutdoors",
  "ToysAndGames",
  "Watches",
];

export default function AmazonImportPage() {
  // Mode: "category" or "asin"
  const [mode, setMode] = useState<"category" | "asin">("category");

  // Filter form states
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Kitchen Appliances");
  const [keywords, setKeywords] = useState("");
  const [asinsInput, setAsinsInput] = useState("");
  const [limit, setLimit] = useState(20); // Default to 20 products
  const [amazonPage, setAmazonPage] = useState(1);
  const [apiSortBy, setApiSortBy] = useState("Featured");

  // Local display sort order (defaulting to descending order of ratings)
  const [displaySort, setDisplaySort] = useState<"rating_desc" | "reviews_desc" | "price_asc" | "price_desc" | "title_asc">("rating_desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(12);

  // Query execution & data states
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [existingAsins, setExistingAsins] = useState<Set<string>>(new Set());
  const [selectedAsins, setSelectedAsins] = useState<Set<string>>(new Set());
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});

  // Inline customizations for products before importing
  const [editedFields, setEditedFields] = useState<Record<string, Partial<AmazonProduct>>>({});

  // UI status feedback
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingAsin, setImportingAsin] = useState<string | null>(null);

  // Load GoAmaze store categories on mount
  useEffect(() => {
    fetch("/api/categories", { credentials: "include" })
      .then((r) => r.json())
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setCategories(r.data);
          if (r.data.length > 0 && !selectedCategory) {
            setSelectedCategory(r.data[0].name);
          }
        }
      })
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Check which ASINs already exist in database
  const checkDatabasePresence = async (asinList: string[]) => {
    if (!asinList.length) return;
    try {
      const res = await fetch(`/api/products/batch?checkAsins=${asinList.join(",")}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.existingAsins)) {
        setExistingAsins(new Set(data.existingAsins));
      }
    } catch (e) {
      console.warn("Could not check ASIN presence:", e);
    }
  };

  // Fetch products via Amazon Creator API
  const handleFetchProducts = async (pageOverride?: number) => {
    setLoading(true);
    setNotice(null);
    setSelectedAsins(new Set());
    setCurrentPage(1);

    const targetAmazonPage = pageOverride || (pageOverride === 1 ? 1 : amazonPage);
    if (pageOverride) setAmazonPage(pageOverride);

    try {
      let endpoint = "";

      if (mode === "category") {
        const queryParams = new URLSearchParams();
        if (selectedCategory) queryParams.set("category", selectedCategory);
        if (keywords.trim()) queryParams.set("keywords", keywords.trim());
        queryParams.set("limit", String(limit));
        queryParams.set("page", String(targetAmazonPage));
        if (apiSortBy) queryParams.set("sortBy", apiSortBy);
        endpoint = `/api/amazon?${queryParams.toString()}`;
      } else {
        // ASIN lookup mode
        const cleanedAsins = asinsInput
          .split(/[\s,;\n]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z0-9]{10}$/.test(s));

        if (cleanedAsins.length === 0) {
          setNotice({
            type: "error",
            text: "Please enter at least one valid 10-character Amazon ASIN (e.g. B09B2SBHQK).",
          });
          setLoading(false);
          return;
        }

        const queryParams = new URLSearchParams();
        queryParams.set("itemIds", cleanedAsins.slice(0, 50).join(","));
        endpoint = `/api/amazon?${queryParams.toString()}`;
      }

      const res = await fetch(endpoint, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setNotice({
          type: "error",
          text: data.error || data.message || "Failed to fetch products from Amazon Creators API.",
        });
        return;
      }

      const fetchedProducts: AmazonProduct[] = data.products || [];
      if (fetchedProducts.length === 0) {
        setNotice({
          type: "info",
          text: "No products found for the specified category or ASIN. Try adjusting your search term.",
        });
        setProducts([]);
      } else {
        // Initial sort descending by rating
        fetchedProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0));
        setProducts(fetchedProducts);
        setNotice({
          type: "success",
          text: `Fetched ${fetchedProducts.length} product${fetchedProducts.length === 1 ? "" : "s"} sorted by highest ratings.`,
        });

        // Check if any returned items already exist in GoAmaze
        const asins = fetchedProducts.map((p) => p.asin).filter(Boolean);
        checkDatabasePresence(asins);
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: `Network error querying Amazon Creator API: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to get effective product data with inline edits applied
  const getEffectiveProduct = (p: AmazonProduct): AmazonProduct => {
    const edits = editedFields[p.asin] || {};
    return {
      ...p,
      ...edits,
      category: edits.category || p.category || selectedCategory || "General",
      badge: edits.badge || p.badge || "Amazon Pick",
      price: edits.price || p.price,
      originalPrice: edits.originalPrice || p.originalPrice || edits.price || p.price,
      rating: edits.rating !== undefined ? Number(edits.rating) : Number(p.rating || 4.5),
      reviews: edits.reviews !== undefined ? Number(edits.reviews) : Number(p.reviews || 0),
      featured: edits.featured !== undefined ? edits.featured : Boolean(p.featured),
      instagramUrl: edits.instagramUrl !== undefined ? edits.instagramUrl : (p.instagramUrl || ""),
    };
  };

  // Sorted products based on displaySort
  const sortedProducts = useMemo(() => {
    const list = [...products];
    switch (displaySort) {
      case "rating_desc":
        return list.sort((a, b) => {
          const rA = editedFields[a.asin]?.rating ?? a.rating ?? 0;
          const rB = editedFields[b.asin]?.rating ?? b.rating ?? 0;
          const revA = editedFields[a.asin]?.reviews ?? a.reviews ?? 0;
          const revB = editedFields[b.asin]?.reviews ?? b.reviews ?? 0;
          return rB - rA || revB - revA;
        });
      case "reviews_desc":
        return list.sort((a, b) => {
          const revA = editedFields[a.asin]?.reviews ?? a.reviews ?? 0;
          const revB = editedFields[b.asin]?.reviews ?? b.reviews ?? 0;
          return revB - revA;
        });
      case "price_asc":
        return list.sort((a, b) => {
          const pA = parseFloat(String(editedFields[a.asin]?.price ?? a.price).replace(/[^0-9.]/g, "")) || 0;
          const pB = parseFloat(String(editedFields[b.asin]?.price ?? b.price).replace(/[^0-9.]/g, "")) || 0;
          return pA - pB;
        });
      case "price_desc":
        return list.sort((a, b) => {
          const pA = parseFloat(String(editedFields[a.asin]?.price ?? a.price).replace(/[^0-9.]/g, "")) || 0;
          const pB = parseFloat(String(editedFields[b.asin]?.price ?? b.price).replace(/[^0-9.]/g, "")) || 0;
          return pB - pA;
        });
      case "title_asc":
        return list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      default:
        return list;
    }
  }, [products, displaySort, editedFields]);

  // Paginated slice
  const paginatedProducts = useMemo(() => {
    if (pageSize === "all") return sortedProducts;
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = pageSize === "all" ? 1 : Math.ceil(sortedProducts.length / pageSize);

  // Handle single product import
  const handleImportSingle = async (p: AmazonProduct) => {
    const effective = getEffectiveProduct(p);
    setImportingAsin(p.asin);
    setNotice(null);

    try {
      const payload = {
        title: effective.title.trim(),
        subtitle: effective.subtitle.trim() || `Authentic ${effective.title.slice(0, 60)} — top-rated choice`,
        description: effective.description.trim(),
        price: effective.price.trim(),
        originalPrice: effective.originalPrice.trim() || effective.price.trim(),
        unitPrice: effective.unitPrice || "",
        category: effective.category,
        image: effective.image,
        images: effective.images,
        affiliateLink: effective.affiliateLink,
        badge: effective.badge,
        rating: effective.rating,
        reviews: effective.reviews,
        featured: Boolean(effective.featured),
        instagramUrl: effective.instagramUrl?.trim() || "",
      };

      const res = await fetch("/api/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setExistingAsins((prev) => new Set([...prev, p.asin]));
        setNotice({
          type: "success",
          text: `"${effective.title.slice(0, 40)}…" added to GoAmaze database successfully!`,
        });
      } else {
        setNotice({
          type: "error",
          text: data.message || "Failed to add product to database.",
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: `Import error: ${err.message}` });
    } finally {
      setImportingAsin(null);
    }
  };

  // Handle batch import of all selected products
  const handleImportSelected = async () => {
    if (selectedAsins.size === 0) return;
    setImporting(true);
    setNotice(null);

    const itemsToImport = products
      .filter((p) => selectedAsins.has(p.asin))
      .map(getEffectiveProduct)
      .map((item) => ({
        title: item.title.trim(),
        subtitle: item.subtitle.trim() || `Authentic ${item.title.slice(0, 60)} — top-rated choice`,
        description: item.description.trim(),
        price: item.price.trim(),
        originalPrice: item.originalPrice.trim() || item.price.trim(),
        unitPrice: item.unitPrice || "",
        category: item.category,
        image: item.image,
        images: item.images,
        affiliateLink: item.affiliateLink,
        badge: item.badge,
        rating: item.rating,
        reviews: item.reviews,
        featured: Boolean(item.featured),
        instagramUrl: item.instagramUrl?.trim() || "",
      }));

    try {
      const res = await fetch("/api/products/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: itemsToImport }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setExistingAsins((prev) => new Set([...prev, ...selectedAsins]));
        setNotice({
          type: "success",
          text: data.message || `Successfully imported ${itemsToImport.length} products to database!`,
        });
        setSelectedAsins(new Set());
      } else {
        setNotice({
          type: "error",
          text: data.message || "Failed to batch import products.",
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: `Batch import error: ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  // Selection toggle helpers
  const toggleSelect = (asin: string) => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedAsins(new Set(products.map((p) => p.asin)));
  };

  const selectCurrentPage = () => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      paginatedProducts.forEach((p) => next.add(p.asin));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedAsins(new Set());
  };

  // Inline field editing helper
  const updateProductField = (asin: string, field: keyof AmazonProduct, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [asin]: {
        ...prev[asin],
        [field]: value,
      },
    }));
  };

  // Combine store categories and Amazon indices for dropdowns
  const availableCategoryNames = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    AMAZON_DEPARTMENTS.forEach((d) => set.add(d));
    return Array.from(set);
  }, [categories]);

  return (
    <AdminLayout title="Amazon Creator API Hub">
      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: "14px",
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
            color:
              notice.type === "success"
                ? "#34D399"
                : notice.type === "error"
                ? "#FCA5A5"
                : "#93C5FD",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          <span>
            {notice.type === "success" ? "✓" : notice.type === "error" ? "⚠️" : "ℹ️"} {notice.text}
          </span>
          <button
            onClick={() => setNotice(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Description */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.8rem" }}>🛒</span>
            <h2
              style={{
                fontSize: "1.45rem",
                fontWeight: 800,
                color: "#F8FAFC",
                fontFamily: "'Montserrat', sans-serif",
                margin: 0,
              }}
            >
              Amazon Creator Catalog Hub
            </h2>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "0.88rem", margin: 0, maxWidth: "660px" }}>
            Browse and import live Amazon products sorted by ratings. Expand limits up to 50 items per query,
            navigate across paginated pages, review customer ratings and reviews, and selectively import products into GoAmaze.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href="/admin/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#CBD5E1",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.2s",
            }}
          >
            ← View Products Catalogue
          </Link>
        </div>
      </div>

      {/* Controls Card */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "18px",
          padding: "24px",
          marginBottom: "28px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        {/* Mode Switcher Tabs */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => setMode("category")}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background:
                mode === "category"
                  ? "linear-gradient(135deg, #F97316 0%, #EA580C 100%)"
                  : "rgba(255,255,255,0.06)",
              color: mode === "category" ? "#FFFFFF" : "#94A3B8",
              boxShadow:
                mode === "category" ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            🏷️ Filter by Category
          </button>
          <button
            type="button"
            onClick={() => setMode("asin")}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background:
                mode === "asin"
                  ? "linear-gradient(135deg, #F97316 0%, #EA580C 100%)"
                  : "rgba(255,255,255,0.06)",
              color: mode === "asin" ? "#FFFFFF" : "#94A3B8",
              boxShadow:
                mode === "asin" ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            🔢 Fetch by ASIN Numbers
          </button>
        </div>

        {/* Filter Controls Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFetchProducts(1);
          }}
        >
          {mode === "category" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "16px",
                alignItems: "end",
              }}
            >
              {/* Category Dropdown */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#94A3B8",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Select Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.9rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <optgroup label="GoAmaze Store Categories">
                    {categories.map((c) => (
                      <option key={c.id || c._id || c.name} value={c.name}>
                        {c.icon || "🏷️"} {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Amazon Global Departments">
                    {AMAZON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        📦 {dept}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Keywords Search */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#94A3B8",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Search Keywords (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. air fryer, blender, dumbbells…"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Increased Item Limit Selector */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#94A3B8",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Items Limit (Expanded)
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.9rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value={10}>10 Products</option>
                  <option value={20}>20 Products (2 Amazon Pages)</option>
                  <option value={30}>30 Products (3 Amazon Pages)</option>
                  <option value={50}>50 Products (5 Amazon Pages)</option>
                </select>
              </div>

              {/* Amazon Query Sort Order */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#94A3B8",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Amazon Department Sort
                </label>
                <select
                  value={apiSortBy}
                  onChange={(e) => setApiSortBy(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.9rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Featured">Featured & Relevance</option>
                  <option value="Price:LowToHigh">Price: Low to High</option>
                  <option value="Price:HighToLow">Price: High to Low</option>
                  <option value="NewestArrivals">Newest Arrivals</option>
                </select>
              </div>

              {/* Submit Fetch Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 22px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                    border: "none",
                    color: "white",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    boxShadow: "0 4px 15px rgba(249,115,22,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? "🔄 Fetching…" : `🔍 Fetch ${limit} Products`}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#94A3B8",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Enter Amazon ASIN Numbers (comma, space, or newline separated)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. B09B2SBHQK, B0D14BB5XY, B0199980K4, B0FN41SQQ7"
                value={asinsInput}
                onChange={(e) => setAsinsInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#F8FAFC",
                  fontSize: "0.9rem",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "16px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                    border: "none",
                    color: "white",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    boxShadow: "0 4px 15px rgba(249,115,22,0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {loading ? "🔄 Fetching ASINs…" : "🔍 Fetch by ASIN"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results Header, Sorting & Pagination Toolbar */}
      {products.length > 0 && (
        <div
          style={{
            background: "rgba(30, 41, 59, 0.75)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Top Row: Counts, Select All, Batch Import */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ color: "#F8FAFC", fontWeight: 800, fontSize: "1rem" }}>
                {products.length} Products Found
              </span>

              {/* Selection action pills */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={selectCurrentPage}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#E2E8F0",
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Select Page ({paginatedProducts.length})
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#E2E8F0",
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Select All ({products.length})
                </button>
                {selectedAsins.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#94A3B8",
                      padding: "5px 10px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Batch Import Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                <strong style={{ color: selectedAsins.size > 0 ? "#F97316" : "#E2E8F0" }}>
                  {selectedAsins.size}
                </strong>{" "}
                selected
              </span>
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selectedAsins.size === 0 || importing}
                style={{
                  padding: "9px 18px",
                  borderRadius: "10px",
                  background:
                    selectedAsins.size > 0
                      ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                      : "rgba(255,255,255,0.06)",
                  border: "none",
                  color: selectedAsins.size > 0 ? "white" : "#64748B",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: selectedAsins.size > 0 && !importing ? "pointer" : "not-allowed",
                  boxShadow:
                    selectedAsins.size > 0 ? "0 4px 15px rgba(16,185,129,0.35)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s",
                }}
              >
                {importing ? "🔄 Importing…" : `➕ Add Selected (${selectedAsins.size}) to GoAmaze`}
              </button>
            </div>
          </div>

          {/* Bottom Row: Sorting by Rating & Client Pagination Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "12px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {/* Sort Options */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                Order By:
              </span>
              <select
                value={displaySort}
                onChange={(e) => setDisplaySort(e.target.value as any)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#FBBF24",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="rating_desc">⭐ Rating: Highest to Lowest</option>
                <option value="reviews_desc">💬 Reviews: Most to Least</option>
                <option value="price_asc">💰 Price: Low to High</option>
                <option value="price_desc">💎 Price: High to Low</option>
                <option value="title_asc">🔤 Title: A to Z</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Page size selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Cards / Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === "all" ? "all" : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#CBD5E1",
                    fontSize: "0.78rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value={6}>6</option>
                  <option value={9}>9</option>
                  <option value={12}>12</option>
                  <option value={18}>18</option>
                  <option value={24}>24</option>
                  <option value="all">All ({products.length})</option>
                </select>
              </div>

              {/* Page number buttons */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: currentPage === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: currentPage === 1 ? "#64748B" : "#F8FAFC",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    ‹ Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCurrentPage(pg)}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "6px",
                        background:
                          currentPage === pg
                            ? "linear-gradient(135deg,#F97316,#EA580C)"
                            : "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: currentPage === pg ? "white" : "#CBD5E1",
                        fontSize: "0.8rem",
                        fontWeight: currentPage === pg ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background:
                        currentPage === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: currentPage === totalPages ? "#64748B" : "#F8FAFC",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#94A3B8" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "16px" }}>🔄</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "6px" }}>
            Querying Amazon Catalog…
          </div>
          <p style={{ fontSize: "0.88rem", color: "#64748B", margin: 0 }}>
            Fetching up to {limit} items, price listings, variant images, and customer ratings
          </p>
        </div>
      ) : products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "18px",
            border: "1px dashed rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📦</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "8px" }}>
            No products loaded yet
          </div>
          <p style={{ color: "#64748B", fontSize: "0.88rem", maxWidth: "460px", margin: "0 auto 20px" }}>
            Select a category above or enter specific Amazon ASINs, then click <strong>Fetch Products</strong>{" "}
            to browse items sorted by rating directly from Amazon's catalog.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          {paginatedProducts.map((p) => {
            const isSelected = selectedAsins.has(p.asin);
            const isAlreadyInDb = existingAsins.has(p.asin);
            const effective = getEffectiveProduct(p);

            const activeImgIndex = activeImageIndices[p.asin] || 0;
            const currentImg =
              effective.images && effective.images[activeImgIndex]
                ? effective.images[activeImgIndex]
                : effective.image;

            return (
              <div
                key={p.asin}
                style={{
                  background: isSelected
                    ? "rgba(30, 41, 59, 0.95)"
                    : "rgba(20, 28, 45, 0.8)",
                  borderRadius: "18px",
                  border: isSelected
                    ? "2px solid #F97316"
                    : isAlreadyInDb
                    ? "1px solid rgba(16,185,129,0.35)"
                    : "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: isSelected
                    ? "0 10px 30px rgba(249,115,22,0.2)"
                    : "0 6px 20px rgba(0,0,0,0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Card Top Action Bar */}
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: isSelected ? "#F97316" : "#E2E8F0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.asin)}
                      style={{
                        width: "18px",
                        height: "18px",
                        accentColor: "#F97316",
                        cursor: "pointer",
                      }}
                    />
                    <span>Select for Import</span>
                  </label>

                  {isAlreadyInDb ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "99px",
                        background: "rgba(16,185,129,0.18)",
                        border: "1px solid rgba(16,185,129,0.35)",
                        color: "#34D399",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Saved in Database
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "99px",
                        background: "rgba(249,115,22,0.12)",
                        border: "1px solid rgba(249,115,22,0.25)",
                        color: "#FB923C",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      ASIN: {p.asin}
                    </span>
                  )}
                </div>

                {/* Primary Image Preview & Gallery Thumbnails */}
                <div
                  style={{
                    padding: "20px",
                    background: "rgba(255,255,255,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "210px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "12px",
                      position: "relative",
                    }}
                  >
                    {currentImg ? (
                      <img
                        src={currentImg}
                        alt={p.title}
                        style={{
                          maxHeight: "100%",
                          maxWidth: "100%",
                          objectFit: "contain",
                          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
                        }}
                      />
                    ) : (
                      <div style={{ color: "#64748B", fontSize: "0.85rem" }}>No Image Available</div>
                    )}
                  </div>

                  {/* Multi-image thumbnail strip */}
                  {effective.images && effective.images.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        overflowX: "auto",
                        maxWidth: "100%",
                        padding: "4px 0",
                      }}
                    >
                      {effective.images.slice(0, 6).map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setActiveImageIndices((prev) => ({ ...prev, [p.asin]: idx }))
                          }
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            padding: "2px",
                            background: "rgba(255,255,255,0.06)",
                            border:
                              activeImgIndex === idx
                                ? "2px solid #F97316"
                                : "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt="thumb"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Content & Editable Attributes */}
                <div style={{ padding: "18px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Brand & Amazon Link */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {p.brand || "Amazon Product"}
                    </span>
                    <a
                      href={p.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "0.78rem",
                        color: "#60A5FA",
                        textDecoration: "none",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      View on Amazon ↗
                    </a>
                  </div>

                  {/* PROMINENT RATINGS DISPLAY */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#FBBF24", fontSize: "1.1rem", lineHeight: 1 }}>★</span>
                      <span style={{ color: "#FDE68A", fontWeight: 800, fontSize: "0.95rem" }}>
                        {effective.rating.toFixed(1)}
                      </span>
                      <span style={{ color: "#FCD34D", fontSize: "0.75rem", fontWeight: 600 }}>/ 5.0</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#FBBF24" }}>💬</span>
                      <span style={{ color: "#CBD5E1", fontSize: "0.78rem", fontWeight: 600 }}>
                        {effective.reviews.toLocaleString()} reviews
                      </span>
                    </div>
                  </div>

                  {/* Title (Editable) */}
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        color: "#64748B",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      PRODUCT TITLE
                    </label>
                    <textarea
                      rows={2}
                      value={effective.title}
                      onChange={(e) => updateProductField(p.asin, "title", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#F8FAFC",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        lineHeight: 1.35,
                        resize: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Subtitle / Hook (Editable) */}
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        color: "#64748B",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      SUBTITLE / HIGHLIGHT
                    </label>
                    <input
                      type="text"
                      value={effective.subtitle}
                      onChange={(e) => updateProductField(p.asin, "subtitle", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Pricing Rows (Editable) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        OFFER PRICE
                      </label>
                      <input
                        type="text"
                        value={effective.price}
                        onChange={(e) => updateProductField(p.asin, "price", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#34D399",
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        ORIGINAL PRICE
                      </label>
                      <input
                        type="text"
                        value={effective.originalPrice}
                        onChange={(e) => updateProductField(p.asin, "originalPrice", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#94A3B8",
                          fontSize: "0.88rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Editable Rating & Reviews Adjustment */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        EDIT RATING (1.0-5.0)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={effective.rating}
                        onChange={(e) => updateProductField(p.asin, "rating", parseFloat(e.target.value) || 4.5)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#FBBF24",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        EDIT REVIEW COUNT
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={effective.reviews}
                        onChange={(e) => updateProductField(p.asin, "reviews", parseInt(e.target.value, 10) || 0)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#CBD5E1",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Category Dropdown & Badge Dropdown */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr",
                      gap: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        GOAMAZE CATEGORY
                      </label>
                      <select
                        value={effective.category}
                        onChange={(e) => updateProductField(p.asin, "category", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          fontSize: "0.8rem",
                          outline: "none",
                        }}
                      >
                        {availableCategoryNames.map((catName) => (
                          <option key={catName} value={catName}>
                            {catName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#64748B",
                          fontWeight: 700,
                          marginBottom: "4px",
                        }}
                      >
                        BADGE
                      </label>
                      <select
                        value={effective.badge}
                        onChange={(e) => updateProductField(p.asin, "badge", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#FB923C",
                          fontSize: "0.8rem",
                          outline: "none",
                        }}
                      >
                        {BADGE_OPTIONS.map((badge) => (
                          <option key={badge} value={badge}>
                            {badge}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Instagram Reel / Post URL (Optional) */}
                  <div style={{ marginBottom: "14px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#F8FAFC",
                        marginBottom: "6px",
                        lineHeight: 1.4,
                      }}
                    >
                      Instagram Reel / Post URL (Optional){" "}
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#94A3B8",
                          fontWeight: 400,
                        }}
                      >
                        (If empty, automatically redirects to your GoAmaze Instagram Channel)
                      </span>
                    </label>
                    <input
                      type="url"
                      value={effective.instagramUrl || ""}
                      onChange={(e) => updateProductField(p.asin, "instagramUrl", e.target.value)}
                      placeholder="https://www.instagram.com/reel/... (optional)"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#F8FAFC",
                        fontSize: "0.84rem",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "'Poppins', sans-serif",
                        transition: "border-color 0.2s ease",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(139, 92, 246, 0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.12)")}
                    />
                  </div>

                  {/* Features Bullets (Foldable Preview) */}
                  {effective.features && effective.features.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <details style={{ cursor: "pointer" }}>
                        <summary
                          style={{
                            fontSize: "0.75rem",
                            color: "#94A3B8",
                            fontWeight: 600,
                            userSelect: "none",
                          }}
                        >
                          📋 Features & Specifications ({effective.features.length} points)
                        </summary>
                        <ul
                          style={{
                            margin: "8px 0 0",
                            paddingLeft: "18px",
                            fontSize: "0.78rem",
                            color: "#CBD5E1",
                            lineHeight: 1.5,
                          }}
                        >
                          {effective.features.map((feat, i) => (
                            <li key={i} style={{ marginBottom: "4px" }}>
                              {feat}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}

                  {/* Bottom Options: Featured Checkbox & Single Import Action */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "14px",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.78rem",
                        color: effective.featured ? "#FCD34D" : "#94A3B8",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(effective.featured)}
                        onChange={(e) => updateProductField(p.asin, "featured", e.target.checked)}
                        style={{ accentColor: "#F59E0B" }}
                      />
                      <span>⭐ Featured</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleImportSingle(p)}
                      disabled={importingAsin === p.asin}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        background: isAlreadyInDb
                          ? "rgba(16,185,129,0.15)"
                          : "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                        border: isAlreadyInDb ? "1px solid rgba(16,185,129,0.3)" : "none",
                        color: isAlreadyInDb ? "#34D399" : "white",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: importingAsin === p.asin ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s",
                      }}
                    >
                      {importingAsin === p.asin
                        ? "🔄 Saving…"
                        : isAlreadyInDb
                        ? "✓ Add Again"
                        : "➕ Add to GoAmaze"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Controls if multiple pages */}
      {products.length > 0 && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            marginBottom: "60px",
          }}
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 400, behavior: "smooth" });
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: currentPage === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: currentPage === 1 ? "#64748B" : "#F8FAFC",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            ‹ Previous Page
          </button>

          <span style={{ color: "#94A3B8", fontSize: "0.85rem", margin: "0 8px" }}>
            Page <strong style={{ color: "#F8FAFC" }}>{currentPage}</strong> of{" "}
            <strong style={{ color: "#F8FAFC" }}>{totalPages}</strong>
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 400, behavior: "smooth" });
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background:
                currentPage === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: currentPage === totalPages ? "#64748B" : "#F8FAFC",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Next Page ›
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
