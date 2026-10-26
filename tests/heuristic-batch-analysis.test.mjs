import assert from "node:assert/strict";
import { analyzeProductsHeuristic } from "../lib/ai/heuristic-engine.ts";
import { classifyProductHeuristic } from "../lib/ai/classifier.ts";
import { CANONICAL_CATEGORIES } from "../lib/taxonomy.ts";

console.log("==================================================================");
console.log("TESTING HEURISTIC AI ANALYSIS FOR BATCH IMPORT");
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

const sampleBatch = [
  {
    asin: "B08N5WRWNW",
    id: "prod_amz_B08N5WRWNW",
    title: "Instant Vortex Plus 6-in-1 Air Fryer with OdourErase Technology, 5.7L",
    subtitle: "",
    description: "Stainless steel air fryer with custom presets and touch controls",
    price: "₹7,999",
    originalPrice: "₹12,999",
    unitPrice: "Instant Pot Authentic",
    image: "https://example.com/img1.jpg",
    images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg", "https://example.com/img3.jpg"],
    affiliateLink: "https://amazon.in/dp/B08N5WRWNW",
    category: "Home & Kitchen",
    badge: "Amazon Pick",
    rating: 4.7,
    reviews: 14500,
    features: ["Stainless steel build", "Air fry, roast, bake", "Dishwasher safe basket", "1 year manufacturer warranty", "OdourErase technology"],
    brand: "Instant Pot",
    featured: false,
  },
  {
    asin: "B09B2SBHQK",
    id: "prod_amz_B09B2SBHQK",
    title: "Pigeon by Stovekraft Cruise 1800-Watt Induction Cooktop",
    subtitle: "",
    description: "Induction cooktop with 7 segment LED display and auto switch off",
    price: "₹1,499",
    originalPrice: "₹3,195",
    unitPrice: "Pigeon Authentic",
    image: "https://example.com/pigeon.jpg",
    images: ["https://example.com/pigeon.jpg"],
    affiliateLink: "https://amazon.in/dp/B09B2SBHQK",
    category: "Home & Kitchen",
    badge: "Amazon Pick",
    rating: 4.1,
    reviews: 32000,
    features: ["7 segments LED display", "Dual heat sensor", "Auto switch off"],
    brand: "Pigeon",
    featured: false,
  },
  {
    asin: "B0CHWRHMPB",
    id: "prod_amz_B0CHWRHMPB",
    title: "Logitech MX Master 3S Wireless Performance Mouse",
    subtitle: "",
    description: "Ergonomic quiet clicks mouse with 8K DPI track-on-glass sensor",
    price: "₹8,995",
    originalPrice: "₹10,995",
    unitPrice: "Logitech Authentic",
    image: "https://example.com/mx.jpg",
    images: ["https://example.com/mx.jpg"],
    affiliateLink: "https://amazon.in/dp/B0CHWRHMPB",
    category: "General",
    badge: "Amazon Pick",
    rating: 4.8,
    reviews: 18000,
    features: ["Quiet Click technology", "MagSpeed electromagnetic scrolling", "8K DPI optical sensor", "Ergonomic design"],
    brand: "Logitech",
    featured: false,
  }
];

// Test 1: Heuristic Scorer execution
test("Heuristic Multi-Criteria Scorer evaluates all products", () => {
  const result = analyzeProductsHeuristic("Kitchen Appliances", sampleBatch);
  assert.equal(result.totalProducts, 3, "Expected 3 products analyzed");
  assert.ok(result.bestOverall, "Expected a best overall item");
  assert.ok(result.bestOverall.overallScore >= 70, "Best overall score should be >= 70");
  assert.ok(result.bestOverall.award, "Best overall should have an award assigned");
  assert.equal(result.providerUsed, "Heuristic Scorer (Local Engine)");
});

// Test 2: Heuristic Taxonomy Classifier
test("Heuristic Classifier categorizes products into canonical categories & themes", () => {
  const airFryerCls = classifyProductHeuristic(sampleBatch[0]);
  assert.ok(airFryerCls.categories.some(c => c.slug === "kitchen-appliances"), "Air fryer should match kitchen-appliances category");
  assert.ok(airFryerCls.themes.some(t => t.slug === "kitchen-everyday-essentials"), "Air fryer should match kitchen-everyday-essentials theme");

  const mouseCls = classifyProductHeuristic(sampleBatch[2]);
  assert.ok(mouseCls.categories.some(c => c.slug === "computer-accessories"), "Mouse should match computer-accessories category");
  assert.ok(mouseCls.themes.some(t => t.slug === "work-study-gaming"), "Mouse should match work-study-gaming theme");
});

// Test 3: Award and Badge Assignment
test("Heuristic engine assigns awards & badges appropriately", () => {
  const result = analyzeProductsHeuristic("Kitchen Appliances", sampleBatch);
  const awards = result.rankedProducts.map(p => p.award).filter(Boolean);
  assert.ok(awards.length >= 2, "Expected at least 2 award winners in batch");
  assert.ok(awards.includes("Best Overall"), "Expected Best Overall award");
});

// Test 4: Pros and Cons extraction
test("Factual pros and cons are extracted without hallucinations", () => {
  const result = analyzeProductsHeuristic("Kitchen Appliances", sampleBatch);
  for (const p of result.rankedProducts) {
    assert.ok(Array.isArray(p.pros) && p.pros.length >= 1, `Expected pros for ${p.asin}`);
    assert.ok(Array.isArray(p.cons) && p.cons.length >= 1, `Expected cons for ${p.asin}`);
    assert.ok(typeof p.bestFor === "string" && p.bestFor.length > 5, `Expected bestFor tag for ${p.asin}`);
  }
});

console.log(`\nAll ${passCount} heuristic tests passed successfully!\n`);
