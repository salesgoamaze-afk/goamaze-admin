import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePriceDiff,
  recordSyncAudit,
  getAuditLogs,
  getAuditSummary,
} from "../lib/audit-log.ts";
import {
  CANONICAL_CATEGORIES,
  getCategoryBySlug,
  mapLegacyCategoryToTaxonomy,
} from "../lib/taxonomy.ts";
import { classifyProductHeuristic } from "../lib/ai/classifier.ts";

describe("Price Sync Audit Log & Category Workflow Verification", () => {
  it("1.1 calculatePriceDiff correctly computes price drops, increases, and percentages", () => {
    // Price drop from ₹1,000 to ₹800 = -20%
    const drop = calculatePriceDiff("₹1,000.00", "₹800.00");
    assert.equal(drop, -20.0, "Expected -20% price drop");

    // Price increase from ₹500 to ₹600 = +20%
    const increase = calculatePriceDiff("₹500.00", "₹600.00");
    assert.equal(increase, 20.0, "Expected +20% price increase");

    // Identical prices = 0%
    const same = calculatePriceDiff("₹999.00", "₹999.00");
    assert.equal(same, 0.0, "Expected 0% difference");

    // Invalid / missing prices return undefined
    assert.equal(calculatePriceDiff(undefined, "₹999"), undefined, "Expected undefined for missing old price");
  });

  it("1.2 recordSyncAudit persists session and entries and getAuditLogs retrieves them", async () => {
    const testSessionId = `test_session_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const mockSession = {
      sessionId: testSessionId,
      timestamp,
      trigger: "manual",
      totalProducts: 2,
      syncedCount: 2,
      updatedCount: 1,
      priceChangedCount: 1,
      skippedCount: 0,
      errors: [],
    };

    const mockEntries = [
      {
        id: `audit_${testSessionId}_B0TEST001`,
        sessionId: testSessionId,
        timestamp,
        productId: "amz_B0TEST001",
        asin: "B0TEST001",
        title: "Test Smart Lamp with WiFi and Alexa",
        oldPrice: "₹1,299.00",
        newPrice: "₹999.00",
        priceChanged: true,
        priceDiffPercentage: -23.1,
        status: "updated",
        affiliateLink: "https://www.amazon.in/dp/B0TEST001?tag=goamaze06-21",
        image: "https://m.media-amazon.com/test1.jpg",
      },
      {
        id: `audit_${testSessionId}_B0TEST002`,
        sessionId: testSessionId,
        timestamp,
        productId: "amz_B0TEST002",
        asin: "B0TEST002",
        title: "Test Coffee Mug Warmer Desk Pad",
        oldPrice: "₹499.00",
        newPrice: "₹499.00",
        priceChanged: false,
        priceDiffPercentage: 0,
        status: "unchanged",
        affiliateLink: "https://www.amazon.in/dp/B0TEST002?tag=goamaze06-21",
        image: "https://m.media-amazon.com/test2.jpg",
      },
    ];

    await recordSyncAudit(mockSession, mockEntries);

    // Retrieve unfiltered
    const logs = getAuditLogs({ limit: 10 });
    assert.ok(logs.total >= 2, "Expected at least 2 audit entries in total");
    assert.ok(logs.entries.some((e) => e.asin === "B0TEST001"), "Expected B0TEST001 in audit log");

    // Filter by changedOnly
    const changedLogs = getAuditLogs({ changedOnly: true, limit: 10 });
    assert.ok(changedLogs.entries.every((e) => e.priceChanged), "All changedOnly logs must have priceChanged=true");

    // Filter by search
    const searched = getAuditLogs({ search: "B0TEST001" });
    assert.ok(searched.entries.some((e) => e.asin === "B0TEST001"), "Search for B0TEST001 should return entry");

    // Summary verification
    const summary = getAuditSummary();
    assert.ok(summary.totalRuns >= 1, "Expected totalRuns >= 1");
    assert.ok(summary.totalChanges >= 1, "Expected totalChanges >= 1");
  });

  it("1.3 Fast heuristic engine fallback classifies without hanging", () => {
    const start = Date.now();
    const result = classifyProductHeuristic({
      title: "Philips Air Fryer HD9200 with Rapid Air Technology",
      description: "Healthy frying with little to no added oil. 4.1L capacity.",
      categoryHint: "kitchen-appliances",
    });

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `Heuristic classification must be instantaneous, took ${elapsed}ms`);
    assert.ok(result.categories.some((c) => c.slug === "kitchen-appliances"), "Expected kitchen-appliances category");
    assert.ok(result.themes.some((t) => t.slug === "kitchen-everyday-essentials"), "Expected kitchen-everyday-essentials theme");
  });

  it("1.4 Add Product by Category canonical taxonomy mappings", () => {
    // 16 canonical categories
    assert.ok(CANONICAL_CATEGORIES.length >= 14, `Expected at least 14 canonical categories, found ${CANONICAL_CATEGORIES.length}`);

    // Verify subcategories exist for primary departments
    const kitchen = getCategoryBySlug("kitchen-appliances");
    assert.ok(kitchen !== undefined && kitchen.subcategories && kitchen.subcategories.length > 0, "Kitchen appliances must have subcategories");
    assert.ok(kitchen.subcategories.some(s => s.includes("Air Fryer")), "Expected Air Fryer subcategory in kitchen appliances");

    const smartHome = getCategoryBySlug("smart-home");
    assert.ok(smartHome !== undefined && smartHome.subcategories && smartHome.subcategories.length > 0, "Smart home must have subcategories");

    // Map legacy category to taxonomy
    const mapped = mapLegacyCategoryToTaxonomy("Smart Kitchen", "Digital Air Fryer 5.5L");
    assert.ok(mapped.categories.includes("kitchen-appliances") || mapped.categories.includes("home-kitchen"), "Expected kitchen category mapping");
    assert.ok(mapped.themes.includes("kitchen-everyday-essentials"), "Expected kitchen theme mapping");
  });
});
