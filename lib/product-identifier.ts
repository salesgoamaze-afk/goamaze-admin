/**
 * GoAmaze Product Identifier & Deduplication Utilities
 * Provides robust identification, normalization, and duplicate detection
 * across multiple sources (Amazon, Flipkart, Myntra, Manual, etc.).
 */

export type ProductSource = "amazon" | "flipkart" | "myntra" | "manual" | string;

/**
 * Robustly extracts an Amazon Standard Identification Number (ASIN)
 * from a 10-char string, URL, product ID, or affiliate link.
 */
export function extractAsin(input?: string | null): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // If input itself is an ASIN (10 alphanumeric uppercase characters starting with B or 0-9)
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Common Amazon URL patterns:
  // - /dp/B0DGJ7TGDR
  // - /gp/product/B0DGJ7TGDR
  // - /gp/aw/d/B0DGJ7TGDR
  // - /d/B0DGJ7TGDR
  // - asin=B0DGJ7TGDR
  // - /ASIN/B0DGJ7TGDR
  const asinMatch = trimmed.match(/(?:dp\/|gp\/product\/|gp\/aw\/d\/|\/d\/|asin=|ASIN\/)([A-Za-z0-9]{10})/i);
  if (asinMatch && asinMatch[1]) {
    return asinMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Normalizes affiliate or product links by stripping ephemeral tracking
 * and session query parameters (e.g. tag, ref, linkCode, ascsubtag, etc.)
 */
export function normalizeProductUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();

  // If Amazon ASIN is present, canonicalize to clean Amazon URL
  const asin = extractAsin(trimmed);
  if (asin) {
    // Preserve marketplace domain if present (.in, .com, .co.uk), default to .in
    let domain = "amazon.in";
    const domainMatch = trimmed.match(/amazon\.(in|com|co\.uk|de|fr|ca|com\.au)/i);
    if (domainMatch && domainMatch[1]) {
      domain = `amazon.${domainMatch[1].toLowerCase()}`;
    }
    return `https://www.${domain}/dp/${asin}`;
  }

  try {
    const parsed = new URL(trimmed);
    // Strip common tracking and referrer params
    const trackingParams = [
      "tag", "ref", "linkcode", "ascsubtag", "creative", "creativeasin",
      "camp", "linkid", "utm_source", "utm_medium", "utm_campaign", "utm_content",
      "fbclid", "gclid", "msclkid", "sprefix", "crid", "keywords", "qid"
    ];
    for (const p of trackingParams) {
      parsed.searchParams.delete(p);
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}${parsed.search ? parsed.search : ""}`;
  } catch {
    return trimmed.split("?")[0].toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Normalizes product titles for fuzzy comparison.
 */
export function normalizeTitle(title?: string | null): string {
  if (!title || typeof title !== "string") return "";
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // remove punctuation
    .replace(/\s+/g, " ")      // collapse whitespace
    .trim();
}

/**
 * Determines product source. Defaults to 'amazon'.
 * Future extensible to 'flipkart', 'myntra', 'manual', etc.
 */
export function determineProductSource(input?: { source?: string | null; affiliateLink?: string | null }): ProductSource {
  if (input?.source && typeof input.source === "string" && input.source.trim().length > 0) {
    return input.source.toLowerCase().trim();
  }

  const link = (input?.affiliateLink || "").toLowerCase();
  if (link.includes("amazon.") || link.includes("amzn.to") || link.includes("amzn.in")) {
    return "amazon";
  }
  if (link.includes("flipkart.com") || link.includes("fkrt.it")) {
    return "flipkart";
  }
  if (link.includes("myntra.com")) {
    return "myntra";
  }

  return "amazon";
}

export interface CandidateProduct {
  id?: string;
  title: string;
  category?: string;
  affiliateLink?: string;
  source?: string;
  [key: string]: any;
}

/**
 * Checks if a candidate product is a duplicate of an existing product in the database.
 * Returns the matching existing product if found, or null otherwise.
 */
export function findDuplicateInList<T extends { id: string; title: string; category?: string; affiliateLink?: string; source?: string }>(
  candidate: CandidateProduct,
  existingList: T[]
): T | null {
  if (!existingList || existingList.length === 0) return null;

  const candidateAsin = extractAsin(candidate.affiliateLink) || extractAsin(candidate.id);
  const candidateNormUrl = normalizeProductUrl(candidate.affiliateLink);
  const candidateNormTitle = normalizeTitle(candidate.title);
  const candidateSource = determineProductSource(candidate);
  const candidateId = candidate.id ? String(candidate.id).trim() : null;

  for (const existing of existingList) {
    const existingId = String(existing.id).trim();

    // 1. Direct ID match
    if (candidateId && existingId && candidateId === existingId) {
      return existing;
    }

    // 2. Amazon ASIN match
    if (candidateAsin) {
      const existingAsin = extractAsin(existing.affiliateLink) || extractAsin(existing.id);
      if (existingAsin && candidateAsin === existingAsin) {
        return existing;
      }
    }

    // 3. Normalized Affiliate / Product URL match
    if (candidateNormUrl && existing.affiliateLink) {
      const existingNormUrl = normalizeProductUrl(existing.affiliateLink);
      if (candidateNormUrl === existingNormUrl) {
        return existing;
      }
    }

    // 4. Exact normalized title + category match within the same source
    if (candidateNormTitle && existing.title) {
      const existingNormTitle = normalizeTitle(existing.title);
      const existingSource = determineProductSource(existing);

      if (
        candidateSource === existingSource &&
        candidateNormTitle === existingNormTitle &&
        (!candidate.category || !existing.category || candidate.category.toLowerCase() === existing.category.toLowerCase())
      ) {
        return existing;
      }
    }
  }

  return null;
}
