import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables if running directly
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Supabase credentials not found in environment.");
  process.exit(1);
}

const supabase = createClient(url, key);

function extractNumericPrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function calculateBayesianRating(rawRating, reviewCount, m = 50, C = 4.2) {
  const v = Math.max(0, reviewCount || 0);
  const R = Math.max(1, Math.min(5, rawRating || 4.2));
  const smoothed = (v * R + m * C) / (v + m);

  if (smoothed >= 4.8) return Math.min(99, Math.round(92 + (smoothed - 4.8) * 40));
  if (smoothed >= 4.4) return Math.round(82 + (smoothed - 4.4) * 25);
  if (smoothed >= 4.0) return Math.round(70 + (smoothed - 4.0) * 30);
  if (smoothed >= 3.5) return Math.round(50 + (smoothed - 3.5) * 40);
  return Math.max(20, Math.round(smoothed * 14));
}

function generateBestForTag(title, category, rank, award) {
  if (award === "Best Overall") return "Best Overall Choice";
  if (award === "Best Value for Money") return "Best Value for Money";
  if (award === "Best Budget Pick") return "Best Budget Option";

  const t = title.toLowerCase();
  const c = category.toLowerCase();

  if (c.includes("kitchen")) {
    if (t.includes("fryer") || t.includes("oven")) return "Best for Fast Healthy Cooking";
    if (t.includes("blender") || t.includes("mixer") || t.includes("chopper")) return "Best for Meal Prep & Purees";
    if (t.includes("cooker") || t.includes("pot") || t.includes("pan")) return "Best for Everyday Meals";
    return "Best for Modern Kitchens";
  }
  if (c.includes("desk") || c.includes("workspace") || c.includes("study")) {
    if (t.includes("lamp") || t.includes("light")) return "Best for Eye-Friendly Focus";
    if (t.includes("mat") || t.includes("pad")) return "Best for Minimalist Desks";
    if (t.includes("stand") || t.includes("riser")) return "Best for Ergonomic Comfort";
    return "Best for Productivity";
  }
  if (c.includes("home") || c.includes("decor") || c.includes("aesthetic")) {
    if (t.includes("vase") || t.includes("ceramic")) return "Best for Elegant Shelves & Tables";
    if (t.includes("lamp") || t.includes("light")) return "Best for Warm Evening Ambiance";
    return "Best for Aesthetic Living";
  }
  if (c.includes("wellness") || c.includes("lifestyle")) {
    if (t.includes("candle") || t.includes("scent")) return "Best for Aromatherapy & Calm";
    if (t.includes("diffuser")) return "Best for Fresh Hydrated Air";
    return "Best for Daily Wellness";
  }
  if (c.includes("gym") || c.includes("fitness")) {
    return "Best for Home Workouts";
  }
  if (c.includes("coffee")) {
    return "Best for Café-Style Coffee";
  }
  return `Best for ${category}`;
}

function extractProsAndCons(p, discountPercent) {
  const pros = [];
  const cons = [];

  const rating = Number(p.rating || 4.5);
  const reviews = Number(p.reviews || 0);

  if (rating >= 4.5 && reviews >= 100) {
    pros.push(`Top-rated ${rating.toFixed(1)}★ with high customer satisfaction (${reviews.toLocaleString("en-IN")} reviews)`);
  } else if (rating >= 4.2) {
    pros.push(`Consistently positive verified feedback (${rating.toFixed(1)}★ average)`);
  }

  if (discountPercent >= 20) {
    pros.push(`Exceptional savings: ${discountPercent}% discount from original M.R.P.`);
  } else if (p.price) {
    pros.push(`Accessible value pricing at ${p.price}`);
  }

  pros.push("Authentic Amazon Creators partner product with direct fulfillment");

  if (reviews < 50) {
    cons.push("Emerging product with limited customer review history");
  }
  if (extractNumericPrice(p.price) > 3000) {
    cons.push("Higher upfront investment compared to basic alternatives");
  } else {
    cons.push("Availability and seasonal seller prices may fluctuate on Amazon");
  }

  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

async function enrichAllProducts() {
  console.log("Fetching all products from Supabase...");
  const { data: products, error } = await supabase.from("products").select("*");

  if (error) {
    console.error("Failed to query products from Supabase:", error);
    return;
  }

  console.log(`Found ${products.length} products to enrich with structured AI attributes.`);

  // Group products by category
  const categories = {};
  for (const p of products) {
    const cat = p.category || "General";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  }

  let totalUpdated = 0;

  for (const [catName, catProducts] of Object.entries(categories)) {
    console.log(`\nEvaluating category: "${catName}" (${catProducts.length} items)...`);

    // Calculate median price
    const validPrices = catProducts
      .map((p) => extractNumericPrice(p.price))
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    const median = validPrices.length > 0 ? validPrices[Math.floor(validPrices.length / 2)] : 1000;

    // Score products
    const scored = catProducts.map((p) => {
      const satisfaction = calculateBayesianRating(p.rating, p.reviews);
      const priceNum = extractNumericPrice(p.price);
      const origNum = extractNumericPrice(p.originalPrice);
      const discountPercent = origNum > priceNum ? Math.round(((origNum - priceNum) / origNum) * 100) : 0;

      let value = 75;
      if (discountPercent >= 30) value += 14;
      else if (discountPercent >= 15) value += 8;
      if (median > 0 && priceNum <= median * 0.9) value += 8;

      let quality = 78;
      if (p.rating >= 4.5) quality += 12;
      else if (p.rating >= 4.2) quality += 6;

      const relevance = 90;
      const popularity = (p.reviews || 0) >= 1000 ? 92 : (p.reviews || 0) >= 200 ? 82 : 68;

      const overall = Math.min(99, Math.max(50, Math.round(
        satisfaction * 0.25 + quality * 0.25 + value * 0.25 + relevance * 0.15 + popularity * 0.10
      )));

      return {
        product: p,
        overallScore: overall,
        scoreBreakdown: {
          customerSatisfaction: satisfaction,
          productQuality: quality,
          valueForMoney: value,
          categoryRelevance: relevance,
          popularity,
        },
        discountPercent,
      };
    });

    // Sort descending by overall score
    scored.sort((a, b) => b.overallScore - a.overallScore);

    // Assign awards & rankings
    for (let i = 0; i < scored.length; i++) {
      const item = scored[i];
      const rank = i + 1;
      let award = undefined;

      if (rank === 1) award = "Best Overall";
      else if (item.scoreBreakdown.valueForMoney >= 88 && rank <= 3) award = "Best Value for Money";
      else if (item.discountPercent >= 35 && rank <= 4) award = "Best Budget Pick";

      const bestFor = generateBestForTag(item.product.title, catName, rank, award);
      const { pros, cons } = extractProsAndCons(item.product, item.discountPercent);

      const aiSummary = `${item.product.title} is selected as ${bestFor.toLowerCase()}. Rated ${Number(item.product.rating || 4.5).toFixed(1)}★ across ${item.product.reviews || 0} customer reviews, offering dependable performance for ${catName.toLowerCase()}.`;
      const recommendationReason = `Ranks #${rank} with a ${item.overallScore}/100 composite recommendation score (${item.scoreBreakdown.customerSatisfaction}/100 satisfaction, ${item.scoreBreakdown.productQuality}/100 build quality, and ${item.scoreBreakdown.valueForMoney}/100 value).`;

      const aiMetadata = {
        aiScore: item.overallScore,
        scoreBreakdown: item.scoreBreakdown,
        rank,
        award,
        bestFor,
        aiSummary,
        pros,
        cons,
        recommendationReason,
        targetAudience: `Shoppers looking for top-rated ${catName.toLowerCase()} recommendations.`,
        confidenceLevel: (item.product.reviews || 0) >= 30 ? "high" : "medium",
        dataQualityFlags: [],
        curationStatus: "approved",
        lastAnalyzedAt: new Date().toISOString(),
      };

      // Clean existing description and embed AI metadata
      const cleanDesc = (item.product.description || "").replace(/<!-- AI_DATA:[\s\S]*?-->/g, "").trim();
      const enrichedDesc = cleanDesc
        ? `${cleanDesc}\n\n<!-- AI_DATA: ${JSON.stringify(aiMetadata)} -->`
        : `${aiSummary}\n\nKey Highlights:\n${pros.map((p) => `• ${p}`).join("\n")}\n\n<!-- AI_DATA: ${JSON.stringify(aiMetadata)} -->`;

      // Update payload
      const updateData = {
        description: enrichedDesc,
        badge: award || item.product.badge || "Amazon Pick",
        updatedAt: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", item.product.id);

      if (updateErr) {
        console.error(`Error updating product ${item.product.id}:`, updateErr);
      } else {
        totalUpdated++;
        console.log(`  ✓ Updated #${rank} [${item.overallScore}/100]: "${item.product.title.slice(0, 40)}…" (${award || "Ranked"})`);
      }
    }
  }

  console.log(`\n=================================================`);
  console.log(`SUCCESS! Enriched ${totalUpdated} products with persistent AI attributes.`);
  console.log(`=================================================`);
}

enrichAllProducts().catch(console.error);
