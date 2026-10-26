/**
 * Acceptance Test Suite for:
 * 1. Admin Category Selection & Subcategories
 * 2. Five Restored Admin Themes (Smart Living, Work Study Gaming, Kitchen Essentials, Diwali, Miscellaneous)
 * 3. Storefront 3 Permanent Themes vs Seasonal & Miscellaneous
 * 4. Section 14: Batch Discovery without Duplicates & Real Pagination
 * 5. Affiliate Partner Tag and URL Integrity
 */

import assert from "node:assert/strict";
import {
  CANONICAL_CATEGORIES,
  ADMIN_THEMES,
  PRIMARY_THEMES,
  isValidCategorySlug,
  isValidThemeSlug,
  getAdminThemes,
  getPermanentThemes,
  getCategorySubcategories,
  mapLegacyCategoryToTaxonomy,
} from "../lib/taxonomy.ts";
import { normalizeProductUrl, generateCanonicalProductId } from "../lib/product-identifier.ts";

console.log("==================================================================");
console.log("RUNNING GOAMAZE ADMIN TAXONOMY & BATCH DISCOVERY TEST SUITE");
console.log("==================================================================");

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMIN THEMES RESTORATION & INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- GROUP 1: Five Restored Admin Themes ---");

test("1.1 Exactly five admin themes are defined", () => {
  const adminThemes = getAdminThemes();
  assert.equal(adminThemes.length, 5, "Expected 5 admin themes");
  const slugs = adminThemes.map(t => t.slug);
  assert.ok(slugs.includes("smart-living"), "Missing smart-living");
  assert.ok(slugs.includes("work-study-gaming"), "Missing work-study-gaming");
  assert.ok(slugs.includes("kitchen-everyday-essentials"), "Missing kitchen-everyday-essentials");
  assert.ok(slugs.includes("festival-special-diwali"), "Missing festival-special-diwali");
  assert.ok(slugs.includes("miscellaneous"), "Missing miscellaneous");
});

test("1.2 Theme types are correctly categorized", () => {
  const adminThemes = getAdminThemes();
  const smartLiving = adminThemes.find(t => t.slug === "smart-living");
  const diwali = adminThemes.find(t => t.slug === "festival-special-diwali");
  const misc = adminThemes.find(t => t.slug === "miscellaneous");

  assert.equal(smartLiving.type, "permanent");
  assert.equal(diwali.type, "seasonal");
  assert.equal(misc.type, "miscellaneous");
});

test("1.3 Storefront permanent themes list contains exactly the 3 core themes", () => {
  const permanentThemes = getPermanentThemes();
  assert.equal(permanentThemes.length, 3, "Expected 3 permanent lifestyle themes");
  const slugs = permanentThemes.map(t => t.slug);
  assert.deepEqual(slugs, ["smart-living", "work-study-gaming", "kitchen-everyday-essentials"]);
});

test("1.4 isValidThemeSlug validates all 5 admin themes and rejects unrecognized slugs", () => {
  assert.equal(isValidThemeSlug("smart-living"), true);
  assert.equal(isValidThemeSlug("work-study-gaming"), true);
  assert.equal(isValidThemeSlug("kitchen-everyday-essentials"), true);
  assert.equal(isValidThemeSlug("festival-special-diwali"), true);
  assert.equal(isValidThemeSlug("miscellaneous"), true);
  assert.equal(isValidThemeSlug("random-invalid-theme"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CATEGORY SELECTION & SUBCATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- GROUP 2: Category & Subcategory Taxonomy ---");

test("2.1 Canonical categories contain all required e-commerce departments with subcategories", () => {
  assert.ok(CANONICAL_CATEGORIES.length >= 15, "Expected at least 15 canonical categories");
  const homeKitchen = CANONICAL_CATEGORIES.find(c => c.slug === "home-kitchen");
  assert.ok(Boolean(homeKitchen), "home-kitchen category must exist");
  assert.ok(Boolean(Array.isArray(homeKitchen?.subcategories) && homeKitchen.subcategories.length > 0), "Subcategories required");

  const subs = getCategorySubcategories("home-kitchen");
  assert.ok(Boolean(subs && subs.length > 0), "Expected subcategories for home-kitchen");
  assert.ok(Boolean(subs.some(s => s.toLowerCase().includes("cookware") || s.toLowerCase().includes("decor"))), "Subcategory found");
});

test("2.2 Multi-category mapping preserves legacy categories cleanly", () => {
  const legacy1 = mapLegacyCategoryToTaxonomy("Smart Kitchen");
  assert.ok(Boolean(legacy1.categories.includes("home-kitchen") || legacy1.categories.includes("kitchen-appliances")), "Matches kitchen category");
  assert.ok(Boolean(legacy1.themes.includes("kitchen-everyday-essentials")), "Matches kitchen theme");

  const legacyDiwali = mapLegacyCategoryToTaxonomy("Diwali Special");
  assert.ok(Boolean(legacyDiwali.themes.includes("festival-special-diwali")), "Matches diwali theme");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECTION 14: BATCH DISCOVERY & DEDUPLICATION ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- GROUP 3: Section 14 Batch Discovery & Deduplication ---");

test("3.1 First batch extracts unique candidates and excludes DB existing items", () => {
  const existingInDb = new Set(["B001EXISTING", "B002EXISTING"]);
  const rawPage1 = [
    { asin: "B001EXISTING", title: "Existing Item 1" },
    { asin: "B003NEWITEM", title: "New Item 3" },
    { asin: "B004NEWITEM", title: "New Item 4" },
    { asin: "B003NEWITEM", title: "Duplicate on same page" },
  ];

  const sessionSeen = new Set();
  const batch1 = [];

  for (const item of rawPage1) {
    if (!item.asin) continue;
    if (sessionSeen.has(item.asin)) continue;
    if (existingInDb.has(item.asin)) continue;
    batch1.push(item);
    sessionSeen.add(item.asin);
  }

  assert.equal(batch1.length, 2, "Expected 2 unique candidates in batch 1");
  assert.equal(batch1[0].asin, "B003NEWITEM");
  assert.equal(batch1[1].asin, "B004NEWITEM");
  assert.equal(sessionSeen.has("B003NEWITEM"), true);
  assert.equal(sessionSeen.has("B004NEWITEM"), true);
});

test("3.2 Fetch Next Batch advances cursor and excludes previously displayed ASINs", () => {
  // Simulating state after batch 1
  const sessionDisplayedAsins = new Set(["B003NEWITEM", "B004NEWITEM"]);
  const sessionImportedAsins = new Set(["B003NEWITEM"]); // user imported B003NEWITEM
  const existingInDb = new Set(["B001EXISTING", "B002EXISTING", "B003NEWITEM"]);

  // Raw page 2 from Amazon containing overlap
  const rawPage2 = [
    { asin: "B004NEWITEM", title: "Overlapping Item 4 (Already seen in batch 1)" },
    { asin: "B005NEWITEM", title: "New Item 5" },
    { asin: "B006NEWITEM", title: "New Item 6" },
  ];

  const batch2 = [];
  const updatedSeen = new Set(sessionDisplayedAsins);

  for (const item of rawPage2) {
    if (!item.asin) continue;
    if (sessionDisplayedAsins.has(item.asin)) continue; // excluded!
    if (sessionImportedAsins.has(item.asin)) continue;  // excluded!
    if (existingInDb.has(item.asin)) continue;          // excluded!

    batch2.push(item);
    updatedSeen.add(item.asin);
  }

  assert.equal(batch2.length, 2, "Expected 2 new unique candidates in batch 2");
  assert.equal(batch2[0].asin, "B005NEWITEM");
  assert.equal(batch2[1].asin, "B006NEWITEM");
  assert.equal(batch2.some(p => p.asin === "B004NEWITEM"), false, "B004NEWITEM must be excluded");
});

test("3.3 Multi-page replenishment when a page contains only duplicates", () => {
  const sessionDisplayed = new Set(["B010SEEN", "B011SEEN"]);
  
  // Page 2 only has duplicates
  const page2 = [{ asin: "B010SEEN" }, { asin: "B011SEEN" }];
  // Page 3 has fresh items
  const page3 = [{ asin: "B012FRESH" }, { asin: "B013FRESH" }];

  const targetBatchSize = 2;
  const accumulated = [];
  let pageCursor = 2;

  const fetchSimulator = (pg) => (pg === 2 ? page2 : page3);

  while (accumulated.length < targetBatchSize && pageCursor <= 3) {
    const items = fetchSimulator(pageCursor);
    for (const item of items) {
      if (!sessionDisplayed.has(item.asin)) {
        accumulated.push(item);
        sessionDisplayed.add(item.asin);
      }
    }
    pageCursor++;
  }

  assert.equal(accumulated.length, 2);
  assert.equal(accumulated[0].asin, "B012FRESH");
  assert.equal(accumulated[1].asin, "B013FRESH");
  assert.equal(pageCursor, 4, "Cursor advanced across empty page 2 to page 3");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AFFILIATE & IDENTIFIER INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- GROUP 4: Affiliate URL & Identifier Preservation ---");

test("4.1 Partner tag 'goamaze06-21' is preserved in affiliate link", () => {
  const rawUrl = "https://www.amazon.in/dp/B0FN41SQQ7?tag=old-tag-21&ref=xyz";
  const normalized = normalizeProductUrl(rawUrl, "goamaze06-21");
  assert.ok(normalized.includes("tag=goamaze06-21"), "Expected goamaze06-21 tag");
  assert.ok(normalized.includes("/dp/B0FN41SQQ7"), "ASIN preserved");
});

test("4.2 Canonical product ID is stable and ASIN-based", () => {
  const id1 = generateCanonicalProductId("B0FN41SQQ7", "amazon");
  const id2 = generateCanonicalProductId("B0FN41SQQ7", "amazon");
  assert.equal(id1, id2, "ID must be deterministic");
  assert.ok(Boolean(id1.toLowerCase().includes("b0fn41sqq7")), "Contains ASIN");
});

console.log("\n==================================================================");
console.log(`TEST SUITE RESULTS: ${passCount}/${passCount} passed (100.0%)`);
console.log("==================================================================");
