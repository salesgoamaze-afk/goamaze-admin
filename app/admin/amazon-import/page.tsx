"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { CANONICAL_CATEGORIES, ADMIN_THEMES } from "@/lib/taxonomy";

interface Category {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  icon?: string;
  subcategories?: string[];
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
  categories?: string[];
  themes?: string[];
  subcategories?: string[];
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

const AMAZON_MARKETPLACES = [
  { label: "Amazon India (amazon.in)", value: "www.amazon.in" },
  { label: "Amazon US (amazon.com)", value: "www.amazon.com" },
  { label: "Amazon UK (amazon.co.uk)", value: "www.amazon.co.uk" },
];

export const STOREFRONT_THEMES = [
  // Primary Lifestyle Themes
  { name: "Smart Living", slug: "smart-living", icon: "🛋️", keywords: "smart bulbs home organizers decorative lamps storage solutions smart home devices" },
  { name: "Work, Study & Gaming", slug: "work-study-gaming", icon: "🖥️", keywords: "computer monitors wireless keyboards gaming headsets study lamps webcams" },
  { name: "Kitchen & Everyday Essentials", slug: "kitchen-everyday-essentials", icon: "🍳", keywords: "air fryers coffee makers electric kettles kitchen storage cookware" },
  // Seasonal Campaign
  { name: "Festival Special - Diwali", slug: "festival-special-diwali", icon: "🪔", keywords: "diwali decoration lights festive gifts diyas" },
  // General / Miscellaneous
  { name: "Miscellaneous", slug: "miscellaneous", icon: "📦", keywords: "trending gadgets lifestyle essentials" },
  // Additional Curated Shortcuts
  { name: "Desk Setup", slug: "work-study-gaming", icon: "🖥️", keywords: "desk setup workstation ergonomics desk mat organizer stand" },
  { name: "Cozy Wellness", slug: "smart-living", icon: "🕯️", keywords: "scented candles aromatherapy wellness diffuser relaxation" },
  { name: "Coffee Corner", slug: "kitchen-everyday-essentials", icon: "☕", keywords: "coffee maker coffee mug frother coffee station accessories" },
  { name: "Gaming Zone", slug: "work-study-gaming", icon: "🎮", keywords: "gaming setup accessories rgb mechanical keyboard mousepad" },
  { name: "Study Space", slug: "work-study-gaming", icon: "📚", keywords: "study lamp table organizers bookshelf stationery accessories" },
];

function AmazonImportContent() {
  const searchParams = useSearchParams();

  // Mode: "category" (Discovery) or "asin" (Direct Lookup)
  const [mode, setMode] = useState<"category" | "asin">("category");

  // Discovery Session State (Section 14: Batch Discovery Without Duplicates)
  const [discoverySessionId, setDiscoverySessionId] = useState<string>("");
  const [currentApiPage, setCurrentApiPage] = useState<number>(1);
  const [sessionDisplayedAsins, setSessionDisplayedAsins] = useState<Set<string>>(new Set());
  const [sessionImportedAsins, setSessionImportedAsins] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetchingBatch, setIsFetchingBatch] = useState<boolean>(false);
  const [batchCount, setBatchCount] = useState<number>(0);

  // Filter & Search Controls
  const [marketplace, setMarketplace] = useState<string>("www.amazon.in");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("home-kitchen");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [assignedThemeSlug, setAssignedThemeSlug] = useState<string>("smart-living");
  const [keywords, setKeywords] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [asinsInput, setAsinsInput] = useState<string>("");
  const [limit, setLimit] = useState<number>(12); // Batch size: default 12
  const [apiSortBy, setApiSortBy] = useState<string>("Featured");

  // AI Assistance States
  const [aiSuggestingKeywords, setAiSuggestingKeywords] = useState<boolean>(false);
  const [aiAnalyzingBatch, setAiAnalyzingBatch] = useState<boolean>(false);
  const [productAiMap, setProductAiMap] = useState<Record<string, any>>({});
  const [analyzingAsin, setAnalyzingAsin] = useState<string | null>(null);

  // Local display sort & pagination
  const [displaySort, setDisplaySort] = useState<"rating_desc" | "reviews_desc" | "price_asc" | "price_desc" | "title_asc">("rating_desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | "all">(12);

  // Products & Database Presence
  const [loading, setLoading] = useState<boolean>(false);
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [existingAsins, setExistingAsins] = useState<Set<string>>(new Set());
  const [selectedAsins, setSelectedAsins] = useState<Set<string>>(new Set());
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  const [editedFields, setEditedFields] = useState<Record<string, Partial<AmazonProduct>>>({});

  // UI Status Notice
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importingAsin, setImportingAsin] = useState<string | null>(null);

  // Load GoAmaze categories on mount
  useEffect(() => {
    fetch("/api/categories", { credentials: "include" })
      .then((r) => r.json())
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setCategories(r.data);
        }
      })
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Compute available subcategories for current selected category
  const availableSubcategories = useMemo(() => {
    const fromCanonical = CANONICAL_CATEGORIES.find((c) => c.slug === selectedCategorySlug)?.subcategories;
    if (fromCanonical && fromCanonical.length > 0) return fromCanonical;
    const fromDb = categories.find((c) => c.slug === selectedCategorySlug)?.subcategories;
    return fromDb || [];
  }, [selectedCategorySlug, categories]);

  // Listen to URL search params (e.g. from Categories page: ?category=kitchen-appliances&subcategory=Air%20Fryer)
  useEffect(() => {
    const qCat = searchParams.get("category");
    const qSub = searchParams.get("subcategory");
    const qKw = searchParams.get("keywords");

    if (qCat) {
      setMode("category");
      setSelectedCategorySlug(qCat);
      if (qSub) setSelectedSubcategory(qSub);
      if (qKw) setKeywords(qKw);

      const matchedCat = CANONICAL_CATEGORIES.find((c) => c.slug === qCat);
      const catName = matchedCat ? matchedCat.name : qCat;
      setNotice({
        type: "info",
        text: `🔍 Loaded category "${catName}"${qSub ? ` > ${qSub}` : ""}. Ready to fetch live Amazon products.`,
      });
    }
  }, [searchParams]);

  // When selected category changes, reset subcategory if not in list
  useEffect(() => {
    if (availableSubcategories.length > 0 && !availableSubcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory("");
    }
  }, [selectedCategorySlug, availableSubcategories, selectedSubcategory]);

  // Check database presence for an ASIN list
  const checkDatabasePresence = async (asinList: string[]): Promise<Set<string>> => {
    if (!asinList.length) return new Set();
    try {
      const res = await fetch(`/api/products/batch?checkAsins=${asinList.join(",")}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.existingAsins)) {
        const found = new Set<string>(data.existingAsins);
        setExistingAsins((prev) => new Set([...prev, ...data.existingAsins]));
        return found;
      }
    } catch (e) {
      console.warn("Could not check ASIN presence:", e);
    }
    return new Set();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 14: Batch-based Product Discovery Engine with Real Pagination & Deduplication
  // ─────────────────────────────────────────────────────────────────────────────

  const executeBatchFetch = async (targetApiPage: number, isNextBatch: boolean) => {
    setIsFetchingBatch(true);
    setLoading(true);
    setNotice(null);

    const targetBatchSize = limit || 12;
    // Base exclusion sets
    const sessionSeen = isNextBatch ? new Set(sessionDisplayedAsins) : new Set<string>();
    const updatedSeen = new Set(sessionSeen);
    const newCandidates: AmazonProduct[] = [];
    let pageCursor = targetApiPage;
    let apiExhausted = false;

    try {
      // Loop across Amazon API pages (up to page 10) until batch is satisfied or API exhausted
      while (newCandidates.length < targetBatchSize && pageCursor <= 10) {
        const catDef = CANONICAL_CATEGORIES.find((c) => c.slug === selectedCategorySlug);
        const effectiveCategory = catDef ? catDef.name : "Home & Kitchen";

        let searchTerms = keywords.trim();
        if (selectedSubcategory && !searchTerms.toLowerCase().includes(selectedSubcategory.toLowerCase())) {
          searchTerms = `${selectedSubcategory} ${searchTerms}`.trim();
        }

        const queryParams = new URLSearchParams();
        queryParams.set("category", effectiveCategory);
        if (searchTerms) queryParams.set("keywords", searchTerms);
        queryParams.set("limit", "10"); // Amazon API returns up to 10 items per page
        queryParams.set("page", String(pageCursor));
        queryParams.set("marketplace", marketplace);
        if (apiSortBy) queryParams.set("sortBy", apiSortBy);

        const res = await fetch(`/api/amazon?${queryParams.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          if (newCandidates.length === 0) {
            setNotice({
              type: "error",
              text: data.error || data.message || "Failed to fetch products from Amazon Creators API.",
            });
          }
          break;
        }

        const items: AmazonProduct[] = data.products || [];
        if (items.length === 0) {
          apiExhausted = true;
          break;
        }

        // Check which items on this page already exist in GoAmaze database
        const pageAsins = items.map((p) => p.asin).filter(Boolean);
        const existingOnPage = await checkDatabasePresence(pageAsins);

        // Filter out:
        // 1) Previously displayed in this session
        // 2) Imported in this session
        // 3) Already in database
        // 4) Price range filters
        for (const item of items) {
          if (!item.asin) continue;
          if (updatedSeen.has(item.asin)) continue;
          if (sessionImportedAsins.has(item.asin)) continue;
          if (existingOnPage.has(item.asin)) continue;
          if (existingAsins.has(item.asin)) continue;

          if (minPrice || maxPrice) {
            const num = parseFloat(item.price?.replace(/[^0-9.]/g, "") || "0");
            if (minPrice && num < parseFloat(minPrice)) continue;
            if (maxPrice && num > parseFloat(maxPrice)) continue;
          }

          newCandidates.push(item);
          updatedSeen.add(item.asin);

          if (newCandidates.length >= targetBatchSize) break;
        }

        pageCursor++;
      }

      setSessionDisplayedAsins(updatedSeen);
      setCurrentApiPage(pageCursor - 1);

      if (newCandidates.length === 0) {
        setHasMore(false);
        setNotice({
          type: "info",
          text: isNextBatch
            ? "No More Products: All available Amazon results for this search have been displayed or imported."
            : "No new unique products found for this search. Try adjusting keywords or selecting another subcategory.",
        });
        if (!isNextBatch) {
          setProducts([]);
        }
      } else {
        newCandidates.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0));
        setProducts(newCandidates);
        setSelectedAsins(new Set());
        setCurrentPage(1);

        const newBatchCount = isNextBatch ? batchCount + 1 : 1;
        setBatchCount(newBatchCount);
        setHasMore(!apiExhausted && pageCursor <= 10);

        setNotice({
          type: "success",
          text: `Batch ${newBatchCount}: Retrieved ${newCandidates.length} new unique products (Amazon pages ${targetApiPage}–${pageCursor - 1}). Session total: ${updatedSeen.size} candidates evaluated without repeating.`,
        });
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: `Error during batch discovery: ${err.message}`,
      });
    } finally {
      setIsFetchingBatch(false);
      setLoading(false);
    }
  };

  // Button 1: Fetch Products (Initiates a brand new discovery session)
  const handleFetchProducts = () => {
    const newSessionId = `disc_sess_${Date.now()}`;
    setDiscoverySessionId(newSessionId);
    setBatchCount(1);
    setHasMore(true);
    setSessionDisplayedAsins(new Set());
    executeBatchFetch(1, false);
  };

  // Button 2: Fetch Next Batch (Advances cursor, excludes sessionDisplayedAsins & DB)
  const handleFetchNextBatch = () => {
    if (isFetchingBatch || !hasMore) return;
    executeBatchFetch(currentApiPage + 1, true);
  };

  // Button 3: Start New Search (Resets session, keeps DB deduplication)
  const handleStartNewSearch = () => {
    setDiscoverySessionId("");
    setCurrentApiPage(1);
    setSessionDisplayedAsins(new Set());
    setProducts([]);
    setSelectedAsins(new Set());
    setBatchCount(0);
    setHasMore(true);
    setProductAiMap({});
    setNotice({
      type: "info",
      text: "Discovery session reset. Database deduplication remains active.",
    });
  };

  // Direct ASIN lookup mode handler
  const handleFetchByAsins = async () => {
    const cleanedAsins = asinsInput
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9]{10}$/.test(s));

    if (cleanedAsins.length === 0) {
      setNotice({
        type: "error",
        text: "Please enter at least one valid 10-character Amazon ASIN (e.g. B09B2SBHQK).",
      });
      return;
    }

    setLoading(true);
    setNotice(null);
    setSelectedAsins(new Set());
    setCurrentPage(1);

    try {
      const res = await fetch(`/api/amazon?itemIds=${cleanedAsins.slice(0, 50).join(",")}&marketplace=${marketplace}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setNotice({
          type: "error",
          text: data.error || data.message || "Failed to fetch ASINs from Amazon Creators API.",
        });
        return;
      }

      const fetchedProducts: AmazonProduct[] = data.products || [];
      if (fetchedProducts.length === 0) {
        setNotice({ type: "info", text: "No products found for the provided ASINs." });
        setProducts([]);
      } else {
        fetchedProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        setProducts(fetchedProducts);
        setNotice({
          type: "success",
          text: `Fetched ${fetchedProducts.length} product(s) by ASIN lookup.`,
        });
        checkDatabasePresence(fetchedProducts.map((p) => p.asin).filter(Boolean));
      }
    } catch (err: any) {
      setNotice({ type: "error", text: `ASIN lookup error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Keyword Suggestion & Product Analysis
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSuggestKeywords = async () => {
    setAiSuggestingKeywords(true);
    try {
      const res = await fetch("/api/ai/recommend-taxonomy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-keywords",
          category: selectedCategorySlug,
          subcategory: selectedSubcategory,
          theme: assignedThemeSlug,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.keywords) {
        setKeywords(data.data.keywords);
        setNotice({
          type: "success",
          text: `AI suggested high-converting keywords: "${data.data.keywords}"`,
        });
      }
    } catch (e: any) {
      console.warn("Keyword suggestion error:", e);
    } finally {
      setAiSuggestingKeywords(false);
    }
  };

  const handleAnalyzeSingleAI = async (product: AmazonProduct) => {
    setAnalyzingAsin(product.asin);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategorySlug || "General",
          products: [
            {
              asin: product.asin,
              id: product.id || `prod_amz_${product.asin}`,
              title: product.title,
              subtitle: product.subtitle,
              description: product.description,
              price: product.price,
              originalPrice: product.originalPrice,
              unitPrice: product.unitPrice,
              image: product.image,
              images: product.images || [product.image],
              affiliateLink: product.affiliateLink,
              category: product.category,
              badge: product.badge,
              rating: product.rating,
              reviews: product.reviews,
              features: product.features || [],
              brand: product.brand || "",
              featured: Boolean(product.featured),
            },
          ],
          provider: "heuristic",
          forceFresh: true,
          saveBatch: false,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.rankedProducts) && data.rankedProducts.length > 0) {
        const item = data.rankedProducts[0];
        const aiInfo = {
          overallScore: item.overallScore,
          rank: item.rank,
          award: item.award,
          awardBadgeColor: item.awardBadgeColor,
          scoreBreakdown: item.scoreBreakdown,
          suggestedCategories: item.suggestedCategories || [],
          suggestedThemes: item.suggestedThemes || [],
          suggestedSubcategories: item.suggestedSubcategories || [],
          bestFor: item.bestFor,
          pros: item.pros || [],
          cons: item.cons || [],
          summary: item.aiSummary || "",
          explanation: item.recommendationReason || "",
          providerUsed: "GoAmaze Heuristic AI Engine",
          applied: true,
        };
        setProductAiMap((prev) => ({ ...prev, [product.asin]: aiInfo }));

        const catName =
          item.suggestedCategoryName ||
          (item.suggestedCategories?.[0]
            ? CANONICAL_CATEGORIES.find((c) => c.slug === item.suggestedCategories[0])?.name
            : undefined);
        const themeSlug = item.suggestedThemes?.[0] || assignedThemeSlug;

        setEditedFields((prev) => ({
          ...prev,
          [product.asin]: {
            ...prev[product.asin],
            category: catName || prev[product.asin]?.category,
            themes: themeSlug ? [themeSlug] : prev[product.asin]?.themes,
            subcategories: item.suggestedSubcategories?.length
              ? item.suggestedSubcategories
              : prev[product.asin]?.subcategories,
            badge: item.suggestedBadge || item.award || prev[product.asin]?.badge || "Amazon Pick",
            subtitle:
              prev[product.asin]?.subtitle ||
              (item.bestFor ? `${item.bestFor} — authentic top-rated choice` : undefined),
          },
        }));

        setNotice({
          type: "success",
          text: `✓ Heuristic AI analysis applied to ${product.title.slice(0, 45)}…`,
        });
      }
    } catch (e: any) {
      console.error("AI single analysis error:", e);
      setNotice({ type: "error", text: "AI analysis issue: " + e.message });
    } finally {
      setAnalyzingAsin(null);
    }
  };

  const handleAnalyzeBatchAI = async () => {
    if (products.length === 0) return;
    setAiAnalyzingBatch(true);
    setNotice({ type: "info", text: "🧠 Applying Heuristic AI analysis across candidate products…" });

    // Target either selected products or all products in current list
    const candidateList =
      selectedAsins.size > 0
        ? products.filter((p) => selectedAsins.has(p.asin))
        : products;

    if (candidateList.length === 0) {
      setAiAnalyzingBatch(false);
      setNotice({ type: "error", text: "No products available to analyze." });
      return;
    }

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategorySlug || "General",
          products: candidateList.map((p) => ({
            asin: p.asin,
            id: p.id || `prod_amz_${p.asin}`,
            title: p.title,
            subtitle: p.subtitle,
            description: p.description,
            price: p.price,
            originalPrice: p.originalPrice,
            unitPrice: p.unitPrice,
            image: p.image,
            images: p.images || [p.image],
            affiliateLink: p.affiliateLink,
            category: p.category,
            badge: p.badge,
            rating: p.rating,
            reviews: p.reviews,
            features: p.features || [],
            brand: p.brand || "",
            featured: Boolean(p.featured),
          })),
          provider: "heuristic",
          forceFresh: true,
          saveBatch: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.rankedProducts)) {
        throw new Error(data.error || "Heuristic analysis failed");
      }

      const newAiMap: Record<string, any> = {};
      const newEdits: Record<string, Partial<AmazonProduct>> = {};
      const newlySelected = new Set(selectedAsins);

      for (const item of data.rankedProducts) {
        const asin = item.asin;
        if (!asin) continue;

        newAiMap[asin] = {
          overallScore: item.overallScore,
          rank: item.rank,
          award: item.award,
          awardBadgeColor: item.awardBadgeColor,
          scoreBreakdown: item.scoreBreakdown,
          suggestedCategories: item.suggestedCategories || [],
          suggestedThemes: item.suggestedThemes || [],
          suggestedSubcategories: item.suggestedSubcategories || [],
          bestFor: item.bestFor,
          pros: item.pros || [],
          cons: item.cons || [],
          summary: item.aiSummary || "",
          explanation: item.recommendationReason || "",
          providerUsed: "GoAmaze Heuristic AI Engine",
          applied: true,
        };

        const currentEdits = editedFields[asin] || {};
        const catName =
          item.suggestedCategoryName ||
          (item.suggestedCategories?.[0]
            ? CANONICAL_CATEGORIES.find((c) => c.slug === item.suggestedCategories[0])?.name
            : undefined);
        const themeSlug = item.suggestedThemes?.[0] || assignedThemeSlug;

        newEdits[asin] = {
          ...currentEdits,
          category: catName || currentEdits.category,
          themes: themeSlug ? [themeSlug] : currentEdits.themes,
          subcategories: item.suggestedSubcategories?.length
            ? item.suggestedSubcategories
            : currentEdits.subcategories,
          badge: item.suggestedBadge || item.award || currentEdits.badge || "Amazon Pick",
          featured: item.award === "Best Overall" || item.overallScore >= 90 ? true : currentEdits.featured,
          subtitle:
            currentEdits.subtitle ||
            (item.bestFor ? `${item.bestFor} — authentic top-rated choice` : undefined),
        };

        if (selectedAsins.size === 0) {
          newlySelected.add(asin);
        }
      }

      setProductAiMap((prev) => ({ ...prev, ...newAiMap }));
      setEditedFields((prev) => ({ ...prev, ...newEdits }));
      if (selectedAsins.size === 0) {
        setSelectedAsins(newlySelected);
      }

      setNotice({
        type: "success",
        text: `✓ Heuristic AI analysis applied to ${data.rankedProducts.length} products! Categories, themes, awards, and badges updated.`,
      });
    } catch (e: any) {
      console.error("[Heuristic AI Batch Error]", e);
      setNotice({ type: "error", text: "Heuristic AI analysis issue: " + e.message });
    } finally {
      setAiAnalyzingBatch(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Effective Product Data & Import Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const getEffectiveProduct = (p: AmazonProduct): AmazonProduct => {
    const edits = editedFields[p.asin] || {};
    const catDef = CANONICAL_CATEGORIES.find((c) => c.slug === selectedCategorySlug);
    const defaultCatName = catDef ? catDef.name : "Home & Kitchen";

    return {
      ...p,
      ...edits,
      category: edits.category || p.category || defaultCatName,
      badge: edits.badge || p.badge || "Amazon Pick",
      price: edits.price || p.price,
      originalPrice: edits.originalPrice || p.originalPrice || edits.price || p.price,
      rating: edits.rating !== undefined ? Number(edits.rating) : Number(p.rating || 4.5),
      reviews: edits.reviews !== undefined ? Number(edits.reviews) : Number(p.reviews || 0),
      featured: edits.featured !== undefined ? edits.featured : Boolean(p.featured),
      instagramUrl: edits.instagramUrl !== undefined ? edits.instagramUrl : (p.instagramUrl || ""),
    };
  };

  const handleImportSingle = async (p: AmazonProduct) => {
    const effective = getEffectiveProduct(p);
    setImportingAsin(p.asin);
    setNotice(null);

    const edits = editedFields[p.asin] || {};
    const productThemes = edits.themes || [assignedThemeSlug];
    const catSlug = CANONICAL_CATEGORIES.find((c) => c.name === effective.category)?.slug || selectedCategorySlug;
    const productCategories = edits.categories || [catSlug];
    const productSubcategories = selectedSubcategory ? [selectedSubcategory] : [];

    try {
      const payload = {
        title: effective.title.trim(),
        subtitle: effective.subtitle.trim() || `Authentic ${effective.title.slice(0, 60)} — top-rated choice`,
        description: effective.description.trim(),
        price: effective.price.trim(),
        originalPrice: effective.originalPrice.trim() || effective.price.trim(),
        unitPrice: effective.unitPrice || "",
        category: effective.category,
        categories: productCategories,
        themes: productThemes,
        subcategories: productSubcategories,
        image: effective.image,
        images: effective.images,
        affiliateLink: effective.affiliateLink,
        badge: effective.badge,
        rating: effective.rating,
        reviews: effective.reviews,
        featured: Boolean(effective.featured),
        source: "amazon",
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
        setSessionImportedAsins((prev) => new Set([...prev, p.asin]));
        setNotice({
          type: "success",
          text: `"${effective.title.slice(0, 40)}…" imported into GoAmaze database successfully!`,
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

  const handleImportSelected = async () => {
    if (selectedAsins.size === 0) return;
    setImporting(true);
    setNotice(null);

    const catDef = CANONICAL_CATEGORIES.find((c) => c.slug === selectedCategorySlug);
    const defaultCatName = catDef ? catDef.name : "Home & Kitchen";

    const itemsToImport = products
      .filter((p) => selectedAsins.has(p.asin))
      .map(getEffectiveProduct)
      .map((item) => {
        const edits = editedFields[item.asin] || {};
        const productThemes = edits.themes || [assignedThemeSlug];
        const catSlug = CANONICAL_CATEGORIES.find((c) => c.name === item.category)?.slug || selectedCategorySlug;
        const productCategories = edits.categories || [catSlug];
        const productSubcategories = selectedSubcategory ? [selectedSubcategory] : [];

        return {
          title: item.title.trim(),
          subtitle: item.subtitle.trim() || `Authentic ${item.title.slice(0, 60)} — top-rated choice`,
          description: item.description.trim(),
          price: item.price.trim(),
          originalPrice: item.originalPrice.trim() || item.price.trim(),
          unitPrice: item.unitPrice || "",
          category: item.category || defaultCatName,
          categories: productCategories,
          themes: productThemes,
          subcategories: productSubcategories,
          image: item.image,
          images: item.images,
          affiliateLink: item.affiliateLink,
          badge: item.badge,
          rating: item.rating,
          reviews: item.reviews,
          featured: Boolean(item.featured),
          source: "amazon",
          instagramUrl: item.instagramUrl?.trim() || "",
        };
      });

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
        setSessionImportedAsins((prev) => new Set([...prev, ...selectedAsins]));
        setNotice({
          type: "success",
          text: data.message || `Successfully imported ${itemsToImport.length} products to GoAmaze!`,
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

  const selectAll = () => setSelectedAsins(new Set(products.map((p) => p.asin)));
  const selectCurrentPage = () => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      paginatedProducts.forEach((p) => next.add(p.asin));
      return next;
    });
  };
  const clearSelection = () => setSelectedAsins(new Set());

  // Inline field editing
  const updateProductField = (asin: string, field: keyof AmazonProduct, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [asin]: {
        ...prev[asin],
        [field]: value,
      },
    }));
  };

  // Sorted and Paginated views
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

  const paginatedProducts = useMemo(() => {
    if (pageSize === "all") return sortedProducts;
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = pageSize === "all" ? 1 : Math.ceil(sortedProducts.length / pageSize);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Amazon Product Discovery & Batch Import">
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

      {/* Header */}
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
              Amazon Product Discovery & Batch Import Hub
            </h2>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "0.88rem", margin: 0, maxWidth: "700px" }}>
            Discover and import live Amazon products filtered by category, subcategory, and lifestyle theme.
            Powered by real Amazon API pagination, session-based deduplication, and AI taxonomy analysis.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
            }}
          >
            ← View Products Catalogue
          </Link>
        </div>
      </div>

      {/* ── Controls Card ── */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.65)",
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
              boxShadow: mode === "category" ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            🏷️ Category & Subcategory Discovery
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
              boxShadow: mode === "asin" ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            🔢 Fetch by ASIN Numbers
          </button>
        </div>

        {mode === "category" ? (
          <div>
            {/* Filter Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              {/* Marketplace */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
                  Marketplace
                </label>
                <select
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                >
                  {AMAZON_MARKETPLACES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Canonical Category Selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
                  Product Category *
                </label>
                <select
                  value={selectedCategorySlug}
                  onChange={(e) => setSelectedCategorySlug(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.85rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {CANONICAL_CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Selector (Dynamic) */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
                  Subcategory (Optional)
                </label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.85rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">All Subcategories</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Theme Selector (All 5 Admin Themes) */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#FB923C", marginBottom: "6px", textTransform: "uppercase" }}>
                  Assign Lifestyle Theme *
                </label>
                <select
                  value={assignedThemeSlug}
                  onChange={(e) => setAssignedThemeSlug(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(249,115,22,0.3)",
                    color: "#FDBA74",
                    fontSize: "0.85rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {ADMIN_THEMES.map((theme) => {
                    const tag =
                      theme.type === "permanent"
                        ? "[Permanent]"
                        : theme.type === "seasonal"
                        ? "[Seasonal]"
                        : "[General]";
                    return (
                      <option key={theme.slug} value={theme.slug}>
                        {theme.icon} {theme.name} {tag}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
                  Price Filter (₹ Min – Max)
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    style={{
                      width: "50%",
                      padding: "11px 10px",
                      borderRadius: "10px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#F8FAFC",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    style={{
                      width: "50%",
                      padding: "11px 10px",
                      borderRadius: "10px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#F8FAFC",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Amazon Sort Order */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>
                  Amazon API Sort
                </label>
                <select
                  value={apiSortBy}
                  onChange={(e) => setApiSortBy(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                    fontSize: "0.85rem",
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
            </div>

            {/* Keywords Search Row with AI Suggest Button */}
            <div style={{ marginBottom: "22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                  Search Keywords
                </label>
                <button
                  type="button"
                  onClick={handleSuggestKeywords}
                  disabled={aiSuggestingKeywords}
                  style={{
                    background: "rgba(139,92,246,0.18)",
                    border: "1px solid rgba(139,92,246,0.4)",
                    color: "#C4B5FD",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: aiSuggestingKeywords ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {aiSuggestingKeywords ? "🧠 AI Thinking…" : "✨ AI Suggest Keywords"}
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. ergonomic wireless mouse, smart bulb, air fryer…"
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

            {/* ── Section 14 Action Buttons & Batch Status Bar ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Batch Action Buttons */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {/* 1. Fetch Products Button */}
                <button
                  type="button"
                  onClick={handleFetchProducts}
                  disabled={isFetchingBatch || loading}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                    border: "none",
                    color: "white",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    cursor: isFetchingBatch || loading ? "wait" : "pointer",
                    boxShadow: "0 4px 15px rgba(249,115,22,0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {isFetchingBatch && batchCount <= 1 ? "🔄 Fetching First Batch…" : "🔍 Fetch Products"}
                </button>

                {/* 2. Fetch Next Batch Button */}
                <button
                  type="button"
                  onClick={handleFetchNextBatch}
                  disabled={isFetchingBatch || loading || !discoverySessionId || !hasMore}
                  style={{
                    padding: "12px 22px",
                    borderRadius: "10px",
                    background:
                      !discoverySessionId || !hasMore
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
                    border: "none",
                    color: !discoverySessionId || !hasMore ? "#64748B" : "white",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    cursor: !discoverySessionId || !hasMore || isFetchingBatch ? "not-allowed" : "pointer",
                    boxShadow: discoverySessionId && hasMore ? "0 4px 15px rgba(139,92,246,0.35)" : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  title={!hasMore ? "No more eligible products on Amazon for this query" : "Fetch next batch excluding already displayed items"}
                >
                  {isFetchingBatch && batchCount > 1
                    ? "🔄 Fetching Next Batch…"
                    : !hasMore && discoverySessionId
                    ? "✓ No More Products"
                    : "⚡ Fetch Next Batch"}
                </button>

                {/* 3. Start New Search Button */}
                {discoverySessionId && (
                  <button
                    type="button"
                    onClick={handleStartNewSearch}
                    style={{
                      padding: "11px 18px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#CBD5E1",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔄 Start New Search
                  </button>
                )}
              </div>

              {/* Session State Badge */}
              {discoverySessionId && (
                <div style={{ fontSize: "0.78rem", color: "#94A3B8", background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span>Session: <strong>{discoverySessionId.slice(-6)}</strong></span>
                  <span style={{ margin: "0 6px" }}>•</span>
                  <span>Batch: <strong style={{ color: "#F97316" }}>{batchCount}</strong></span>
                  <span style={{ margin: "0 6px" }}>•</span>
                  <span>Amazon Page: <strong>{currentApiPage}</strong></span>
                  <span style={{ margin: "0 6px" }}>•</span>
                  <span>Evaluated: <strong>{sessionDisplayedAsins.size}</strong></span>
                  <span style={{ margin: "0 6px" }}>•</span>
                  <span>In DB: <strong style={{ color: "#34D399" }}>{existingAsins.size}</strong></span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ASIN Lookup Mode */
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94A3B8", marginBottom: "8px", textTransform: "uppercase" }}>
              Enter Amazon ASINs (comma, space, or newline separated)
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
                type="button"
                onClick={handleFetchByAsins}
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
      </div>

      {/* ── Candidate Results Toolbar & Grid ── */}
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
          {/* Top Row: Counts, Select Actions, Batch Import & AI Batch Action */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ color: "#F8FAFC", fontWeight: 800, fontSize: "1rem" }}>
                {products.length} Candidate Products in Batch
              </span>

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

            {/* AI Batch Analysis & Batch Import Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleAnalyzeBatchAI}
                disabled={aiAnalyzingBatch || products.length === 0}
                title="Run deterministic Heuristic AI analysis (satisfaction, quality, value, taxonomy & awards) and apply directly to batch"
                style={{
                  padding: "9px 16px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
                  border: "none",
                  color: "white",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: aiAnalyzingBatch ? "wait" : "pointer",
                  boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {aiAnalyzingBatch ? "🧠 Applying Heuristic AI…" : "✨ AI Analyze Batch"}
              </button>

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
                  boxShadow: selectedAsins.size > 0 ? "0 4px 15px rgba(16,185,129,0.35)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {importing ? "🔄 Importing…" : `➕ Import Selected (${selectedAsins.size})`}
              </button>
            </div>
          </div>

          {/* Bottom Row: Sorting by Rating & Client Pagination */}
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

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Cards / View:</span>
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
                  <option value={12}>12</option>
                  <option value={18}>18</option>
                  <option value="all">All ({products.length})</option>
                </select>
              </div>

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
                  <span style={{ fontSize: "0.8rem", color: "#94A3B8", margin: "0 4px" }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: currentPage === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
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

      {/* ── Product Cards Grid ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#94A3B8" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: "16px" }}>🔄</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "6px" }}>
            Querying Amazon Catalog…
          </div>
          <p style={{ fontSize: "0.88rem", color: "#64748B", margin: 0 }}>
            Fetching eligible items, checking duplicates against GoAmaze database and current session…
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
            No candidate products loaded
          </div>
          <p style={{ color: "#64748B", fontSize: "0.88rem", maxWidth: "480px", margin: "0 auto 20px" }}>
            Select a category, subcategory, and lifestyle theme above, then click <strong>Fetch Products</strong>{" "}
            to retrieve unique products directly from Amazon.
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
            const aiData = productAiMap[p.asin];

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
                {/* Top Action Bar */}
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
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: isSelected ? "#FDBA74" : "#E2E8F0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.asin)}
                      style={{ width: "16px", height: "16px", accentColor: "#F97316" }}
                    />
                    <span>{isSelected ? "Selected for Import" : "Select Product"}</span>
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isAlreadyInDb ? (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "rgba(16,185,129,0.2)",
                          border: "1px solid rgba(16,185,129,0.4)",
                          color: "#34D399",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        ✓ In GoAmaze Catalog
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "rgba(59,130,246,0.15)",
                          border: "1px solid rgba(59,130,246,0.3)",
                          color: "#93C5FD",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                        }}
                      >
                        New Candidate
                      </span>
                    )}

                    <span style={{ fontSize: "0.72rem", color: "#64748B", fontFamily: "monospace" }}>
                      {p.asin}
                    </span>
                  </div>
                </div>

                {/* Main Card Content */}
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                  {/* Thumbnail & Gallery */}
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "12px",
                        background: "#0F172A",
                        border: "1px solid rgba(255,255,255,0.08)",
                        overflow: "hidden",
                        flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImg}
                        alt={effective.title}
                        referrerPolicy="no-referrer"
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px" }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: "#F8FAFC",
                          margin: "0 0 6px",
                          lineHeight: 1.35,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                        title={effective.title}
                      >
                        {effective.title}
                      </h4>

                      {/* Price & Rating */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#34D399" }}>
                          {effective.price}
                        </span>
                        {effective.originalPrice && effective.originalPrice !== effective.price && (
                          <span style={{ fontSize: "0.78rem", color: "#94A3B8", textDecoration: "line-through" }}>
                            {effective.originalPrice}
                          </span>
                        )}
                        <span style={{ fontSize: "0.78rem", color: "#FBBF24", fontWeight: 600 }}>
                          ⭐ {effective.rating} ({effective.reviews})
                        </span>
                      </div>

                      {/* Amazon Affiliate Link */}
                      <a
                        href={effective.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.74rem",
                          color: "#F97316",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "2px",
                        }}
                      >
                        View on Amazon ↗
                      </a>
                    </div>
                  </div>

                  {/* Category, Theme & Badge Assignment Selectors */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "#94A3B8", fontWeight: 600, marginBottom: "3px" }}>
                        Category:
                      </span>
                      <select
                        value={effective.category}
                        onChange={(e) => updateProductField(p.asin, "category", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: "#0F172A",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#E2E8F0",
                          fontSize: "0.74rem",
                          outline: "none",
                        }}
                      >
                        {CANONICAL_CATEGORIES.map((c) => (
                          <option key={c.slug} value={c.name}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "#FB923C", fontWeight: 600, marginBottom: "3px" }}>
                        Lifestyle Theme:
                      </span>
                      <select
                        value={editedFields[p.asin]?.themes?.[0] || assignedThemeSlug}
                        onChange={(e) => updateProductField(p.asin, "themes", [e.target.value])}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: "#0F172A",
                          border: "1px solid rgba(249,115,22,0.3)",
                          color: "#FDBA74",
                          fontSize: "0.74rem",
                          outline: "none",
                        }}
                      >
                        {ADMIN_THEMES.map((t) => (
                          <option key={t.slug} value={t.slug}>
                            {t.icon} {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "#FBBF24", fontWeight: 600, marginBottom: "3px" }}>
                        Storefront Badge:
                      </span>
                      <select
                        value={effective.badge}
                        onChange={(e) => updateProductField(p.asin, "badge", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: "#0F172A",
                          border: "1px solid rgba(251,191,36,0.3)",
                          color: "#FDE68A",
                          fontSize: "0.74rem",
                          outline: "none",
                        }}
                      >
                        {BADGE_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            🏷️ {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* AI Recommendation Box */}
                  {aiData ? (
                    <div
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#C4B5FD" }}>
                            🧠 Heuristic Score ({aiData.overallScore || 85}/100)
                          </span>
                          {aiData.award && (
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "8px",
                                background: aiData.awardBadgeColor || "rgba(234, 179, 8, 0.2)",
                                color: "#FDE047",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                              }}
                            >
                              🏆 {aiData.award}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(16,185,129,0.18)",
                            color: "#34D399",
                            border: "1px solid rgba(16,185,129,0.3)",
                          }}
                        >
                          ✓ Heuristic Applied
                        </span>
                      </div>

                      {aiData.bestFor && (
                        <div style={{ fontSize: "0.72rem", color: "#E2E8F0", marginBottom: "3px" }}>
                          <strong style={{ color: "#A78BFA" }}>Best For:</strong>{" "}
                          {Array.isArray(aiData.bestFor) ? aiData.bestFor.slice(0, 2).join(", ") : aiData.bestFor}
                        </div>
                      )}

                      {aiData.pros?.[0] && (
                        <div style={{ fontSize: "0.7rem", color: "#34D399", marginBottom: "3px" }}>
                          ✓ {aiData.pros[0]}
                        </div>
                      )}

                      <div style={{ fontSize: "0.68rem", color: "#94A3B8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                        <span>
                          Theme: <strong style={{ color: "#FDBA74" }}>{aiData.suggestedThemes?.join(", ") || "None"}</strong>
                        </span>
                        {aiData.scoreBreakdown && (
                          <span style={{ color: "#64748B" }}>
                            Quality: {aiData.scoreBreakdown.productQuality} • Value: {aiData.scoreBreakdown.valueForMoney}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => handleAnalyzeSingleAI(p)}
                        disabled={analyzingAsin === p.asin}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(139,92,246,0.3)",
                          color: "#C4B5FD",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: analyzingAsin === p.asin ? "wait" : "pointer",
                        }}
                      >
                        {analyzingAsin === p.asin ? "🧠 Analyzing…" : "✨ AI Analyze Product"}
                      </button>
                    </div>
                  )}

                  {/* Bottom Single Import Action */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "10px",
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
                        fontSize: "0.75rem",
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
                        padding: "7px 14px",
                        borderRadius: "8px",
                        background: isAlreadyInDb
                          ? "rgba(16,185,129,0.15)"
                          : "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                        border: isAlreadyInDb ? "1px solid rgba(16,185,129,0.3)" : "none",
                        color: isAlreadyInDb ? "#34D399" : "white",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: importingAsin === p.asin ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
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

      {/* Pagination Bottom Footer */}
      {products.length > 0 && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "60px" }}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 400, behavior: "smooth" });
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              background: currentPage === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: currentPage === 1 ? "#64748B" : "#F8FAFC",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "0.82rem",
            }}
          >
            ‹ Previous
          </button>
          <span style={{ color: "#94A3B8", fontSize: "0.82rem", margin: "0 8px" }}>
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
              padding: "7px 14px",
              borderRadius: "8px",
              background: currentPage === totalPages ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: currentPage === totalPages ? "#64748B" : "#F8FAFC",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: "0.82rem",
            }}
          >
            Next ›
          </button>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AmazonImportPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#94A3B8", textAlign: "center" }}>Loading Amazon Creator Discovery...</div>}>
      <AmazonImportContent />
    </Suspense>
  );
}