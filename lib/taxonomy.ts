/**
 * GoAmaze Taxonomy Definition & Validation Engine
 * 
 * Defines the approved 3 Primary Lifestyle Themes, Canonical Product Categories,
 * and Seasonal Collections, along with validation and legacy mapping rules.
 */

export interface ThemeDefinition {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  image: string;
  displayOrder: number;
  isActive: boolean;
  type: "permanent" | "seasonal" | "miscellaneous";
  productTypes: string[];
  defaultKeywords: string[];
}

export interface CategoryDefinition {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  amazonSearchIndex: string;
  subcategories: string[];
}

export interface CollectionDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  banner: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FIVE ADMIN THEMES (3 Permanent Storefront Themes + Seasonal + Misc)
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_THEMES: ThemeDefinition[] = [
  {
    id: "theme_smart_living",
    slug: "smart-living",
    name: "Smart Living",
    icon: "🛋️",
    description: "Products that make homes more comfortable, organized, attractive, and functional.",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
    displayOrder: 1,
    isActive: true,
    type: "permanent",
    productTypes: [
      "Home décor and decorative lighting",
      "Furniture and furnishings",
      "Storage and organization",
      "Smart home devices",
      "Smart bulbs, plugs, and home security devices",
      "Cleaning tools",
      "Comfort and wellness accessories",
      "Space-saving products",
      "Useful household gadgets",
    ],
    defaultKeywords: [
      "smart bulbs",
      "home organizers",
      "decorative lamps",
      "storage solutions",
      "smart home devices",
      "scented candles aromatherapy",
      "minimalist home decor",
    ],
  },
  {
    id: "theme_work_study_gaming",
    slug: "work-study-gaming",
    name: "Work, Study & Gaming",
    icon: "🖥️",
    description: "Products for productive workspaces, learning environments, computer setups, and gaming.",
    image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&q=80",
    displayOrder: 2,
    isActive: true,
    type: "permanent",
    productTypes: [
      "Laptops and computer accessories",
      "Monitors and display accessories",
      "Keyboards and mice",
      "Headphones and gaming headsets",
      "Webcams and microphones",
      "Gaming peripherals",
      "Desk lamps and desk organizers",
      "Study accessories and stationery",
      "Workspace furniture",
    ],
    defaultKeywords: [
      "computer monitors",
      "wireless keyboards",
      "gaming headsets",
      "study lamps",
      "webcams",
      "ergonomic desk mat",
      "laptop stand",
    ],
  },
  {
    id: "theme_kitchen_everyday_essentials",
    slug: "kitchen-everyday-essentials",
    name: "Kitchen & Everyday Essentials",
    icon: "🍳",
    description: "Products that make cooking, kitchen organization, beverages, and daily household tasks easier.",
    image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80",
    displayOrder: 3,
    isActive: true,
    type: "permanent",
    productTypes: [
      "Kitchen appliances",
      "Air fryers, mixers, and choppers",
      "Cookware and kitchen utensils",
      "Coffee makers, kettles, mugs, and coffee accessories",
      "Kitchen storage and organizers",
      "Useful everyday household products",
    ],
    defaultKeywords: [
      "air fryers",
      "coffee makers",
      "electric kettles",
      "kitchen storage",
      "cookware",
      "food processor",
      "spice grinder",
    ],
  },
  {
    id: "theme_festival_diwali",
    slug: "festival-special-diwali",
    name: "Festival Special - Diwali",
    icon: "🪔",
    description: "Handcrafted brass thalis, terracotta diyas & festive gift hampers for festive seasons.",
    image: "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?w=800&q=80",
    displayOrder: 4,
    isActive: true,
    type: "seasonal",
    productTypes: [
      "Terracotta diyas & brass lamps",
      "Festive LED lights & fairy lanterns",
      "Traditional brass thalis & tableware",
      "Diwali gift hampers & sweet boxes",
      "Pooja accessories & festive home decor",
    ],
    defaultKeywords: [
      "diwali decoration lights",
      "festive gifts",
      "diyas",
      "brass thali",
      "fairy lights",
      "pooja accessories",
    ],
  },
  {
    id: "theme_miscellaneous",
    slug: "miscellaneous",
    name: "Miscellaneous",
    icon: "✨",
    description: "Trending gadgets, lifestyle accessories, and versatile multi-purpose discoveries.",
    image: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&q=80",
    displayOrder: 5,
    isActive: true,
    type: "miscellaneous",
    productTypes: [
      "Trending lifestyle gadgets",
      "Everyday utility accessories",
      "Multi-purpose tools",
      "Curated gifts & novelties",
    ],
    defaultKeywords: [
      "trending gadgets",
      "lifestyle accessories",
      "cool utility gadgets",
      "everyday essentials",
    ],
  },
];

// The 3 permanent lifestyle themes for storefront main navigation
export const PRIMARY_THEMES: ThemeDefinition[] = ADMIN_THEMES.filter((t) => t.type === "permanent");

// ─────────────────────────────────────────────────────────────────────────────
// 2. CANONICAL PRODUCT CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export const CANONICAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: "cat_mobiles",
    slug: "mobiles",
    name: "Mobiles",
    icon: "📱",
    description: "Smartphones, feature phones, and handheld cellular devices",
    displayOrder: 1,
    isActive: true,
    amazonSearchIndex: "Electronics",
    subcategories: ["Smartphones", "Feature Phones", "Refurbished Handsets", "Basic Phones"],
  },
  {
    id: "cat_mobile_accessories",
    slug: "mobile-accessories",
    name: "Mobile Accessories",
    icon: "🔌",
    description: "Phone cases, screen guards, chargers, power banks, cables, and mounts",
    displayOrder: 2,
    isActive: true,
    amazonSearchIndex: "Electronics",
    subcategories: ["Phone Stands & Mounts", "Fast Chargers & Adapters", "Power Banks", "USB-C & Lightning Cables", "Protective Cases & Covers", "Screen Protectors"],
  },
  {
    id: "cat_electronics",
    slug: "electronics",
    name: "Electronics",
    icon: "⚡",
    description: "Consumer electronics, gadgets, power adapters, and entertainment devices",
    displayOrder: 3,
    isActive: true,
    amazonSearchIndex: "Electronics",
    subcategories: ["Smart Wearables & Watches", "Power Strips & Surge Protectors", "Streaming Sticks & TV Adapters", "Portable Gadgets", "Electronic Organizers"],
  },
  {
    id: "cat_audio_accessories",
    slug: "audio-accessories",
    name: "Audio Accessories",
    icon: "🎧",
    description: "Headphones, wireless earbuds, soundbars, microphones, and audio gear",
    displayOrder: 4,
    isActive: true,
    amazonSearchIndex: "Electronics",
    subcategories: ["True Wireless Earbuds", "Over-Ear Headphones", "Gaming Headsets with Mic", "Bluetooth Speakers", "Studio & USB Microphones", "Soundbars"],
  },
  {
    id: "cat_computers",
    slug: "computers",
    name: "Computers",
    icon: "💻",
    description: "Laptops, desktops, mini PCs, and tablets",
    displayOrder: 5,
    isActive: true,
    amazonSearchIndex: "Computers",
    subcategories: ["Thin & Light Laptops", "Gaming Laptops", "Computer Monitors", "Mini PCs & Desktops", "Tablets & E-Readers"],
  },
  {
    id: "cat_computer_accessories",
    slug: "computer-accessories",
    name: "Computer Accessories",
    icon: "⌨️",
    description: "Keyboards, mice, monitors, monitor arms, USB hubs, and webcams",
    displayOrder: 6,
    isActive: true,
    amazonSearchIndex: "Computers",
    subcategories: ["Mechanical & Wireless Keyboards", "Ergonomic Mice", "Laptop Stands & Risers", "Monitor Arms & Mounts", "USB-C Hubs & Docking Stations", "Webcams & Stream Cams", "Desk Mats & Mousepads"],
  },
  {
    id: "cat_smart_home",
    slug: "smart-home",
    name: "Smart Home",
    icon: "🏠",
    description: "Smart bulbs, smart plugs, home security, sensors, and automation controllers",
    displayOrder: 7,
    isActive: true,
    amazonSearchIndex: "HomeAndKitchen",
    subcategories: ["Smart Bulbs & Ambient Lights", "Smart Wi-Fi Plugs & Sockets", "Home Security Cameras", "Smart Video Doorbells", "Motion Sensors & Controllers"],
  },
  {
    id: "cat_home_kitchen",
    slug: "home-kitchen",
    name: "Home & Kitchen",
    icon: "🏡",
    description: "Home decoration, storage, cleaning supplies, and kitchenware",
    displayOrder: 8,
    isActive: true,
    amazonSearchIndex: "HomeAndKitchen",
    subcategories: ["Storage Bins & Organizers", "Decorative Vases & Accents", "Kitchen Countertop Racks", "Stainless Steel Bottles & Tumblers", "Cleaning Mops & Tools", "Aromatherapy & Incense"],
  },
  {
    id: "cat_kitchen_appliances",
    slug: "kitchen-appliances",
    name: "Kitchen Appliances",
    icon: "🍳",
    description: "Air fryers, food processors, mixers, blenders, kettles, and toaster ovens",
    displayOrder: 9,
    isActive: true,
    amazonSearchIndex: "Appliances",
    subcategories: ["Air Fryers & Halogen Ovens", "Mixer Grinders & Blenders", "Electric Gooseneck Kettles", "Mini Food Processors & Choppers", "Coffee Makers & Espresso Machines", "Hand Frothers & Coffee Grinders", "Toaster Ovens & Induction Cooktops"],
  },
  {
    id: "cat_furniture",
    slug: "furniture",
    name: "Furniture",
    icon: "🪑",
    description: "Ergonomic desk chairs, standing desks, risers, bookshelves, and tables",
    displayOrder: 10,
    isActive: true,
    amazonSearchIndex: "Furniture",
    subcategories: ["Ergonomic Mesh Chairs", "Motorized Standing Desks", "Solid Wood Desk Risers", "Compact Bookshelves", "Side Tables & Accent Stools"],
  },
  {
    id: "cat_lighting",
    slug: "lighting",
    name: "Lighting",
    icon: "💡",
    description: "Desk lamps, architectural lamps, fairy lights, LED lightbars, and night lights",
    displayOrder: 11,
    isActive: true,
    amazonSearchIndex: "HomeAndKitchen",
    subcategories: ["Architect LED Desk Lamps", "Monitor Screen Lightbars", "Sunset Projection Lamps", "Fairy String Lights", "Floor Lamps with Dimmer", "Rechargeable Night Lights"],
  },
  {
    id: "cat_personal_care",
    slug: "personal-care",
    name: "Personal Care",
    icon: "🧴",
    description: "Wellness products, massagers, grooming appliances, and skincare accessories",
    displayOrder: 12,
    isActive: true,
    amazonSearchIndex: "HealthAndPersonalCare",
    subcategories: ["Ionic Hair Dryers & Stylers", "Beard & Body Trimmers", "Deep Tissue Massage Guns", "Ultrasonic Essential Oil Diffusers", "Electric Toothbrushes", "Foot & Neck Massagers"],
  },
  {
    id: "cat_travel_accessories",
    slug: "travel-accessories",
    name: "Travel Accessories",
    icon: "🧳",
    description: "Luggage, packing organizers, travel pouches, tumblers, and passport wallets",
    displayOrder: 13,
    isActive: true,
    amazonSearchIndex: "LuggageAndBags",
    subcategories: ["Cabin Hardside Trolleys", "Compression Packing Cubes", "Travel Toiletry Pouches", "Memory Foam Neck Pillows", "Universal Travel Adapters", "RFID Passport Wallets"],
  },
  {
    id: "cat_gifts",
    slug: "gifts",
    name: "Gifts",
    icon: "🎁",
    description: "Thoughtful gift hampers, premium desk sets, and festive gift boxes",
    displayOrder: 14,
    isActive: true,
    amazonSearchIndex: "All",
    subcategories: ["Festive Gift Hampers", "Corporate Executive Sets", "Handcrafted Decor Gift Boxes", "Artisan Coffee Gift Kits", "Gourmet Dry Fruit Boxes"],
  },
  {
    id: "cat_sports_fitness",
    slug: "sports-fitness",
    name: "Sports & Fitness",
    icon: "🏋️",
    description: "Workout equipment, resistance bands, yoga mats, and active lifestyle gear",
    displayOrder: 15,
    isActive: true,
    amazonSearchIndex: "SportsAndOutdoors",
    subcategories: ["Non-Slip TPE Yoga Mats", "Loop Resistance Band Sets", "Adjustable Dumbbells", "High-Density Foam Rollers", "Skipping Ropes & Grips"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. SEASONAL COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const SEASONAL_COLLECTIONS: CollectionDefinition[] = [
  {
    id: "col_diwali",
    slug: "festival-special-diwali",
    name: "Festival Special - Diwali",
    description: "Handcrafted brass thalis, terracotta diyas & festive gift hampers",
    banner: "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?w=800&q=80",
    startDate: "2026-10-01",
    endDate: "2026-11-30",
    isActive: true,
  },
];

// Lookup maps for O(1) slug resolution
const THEME_SLUG_MAP = new Map<string, ThemeDefinition>();
ADMIN_THEMES.forEach((t) => THEME_SLUG_MAP.set(t.slug.toLowerCase(), t));

const CATEGORY_SLUG_MAP = new Map<string, CategoryDefinition>();
CANONICAL_CATEGORIES.forEach((c) => {
  CATEGORY_SLUG_MAP.set(c.slug.toLowerCase(), c);
  CATEGORY_SLUG_MAP.set(c.name.toLowerCase(), c);
});

const COLLECTION_SLUG_MAP = new Map<string, CollectionDefinition>();
SEASONAL_COLLECTIONS.forEach((col) => COLLECTION_SLUG_MAP.set(col.slug.toLowerCase(), col));

// ─────────────────────────────────────────────────────────────────────────────
// 4. TAXONOMY HELPER & VALIDATION METHODS
// ─────────────────────────────────────────────────────────────────────────────

export function getThemeBySlug(slug?: string | null): ThemeDefinition | undefined {
  if (!slug) return undefined;
  return THEME_SLUG_MAP.get(slug.trim().toLowerCase());
}

export function isValidThemeSlug(slug?: string | null): boolean {
  if (!slug) return false;
  return THEME_SLUG_MAP.has(slug.trim().toLowerCase());
}

/**
 * Returns all 5 theme options available to GoAmaze administrators:
 * - 3 Permanent Lifestyle Themes (Smart Living, Work Study Gaming, Kitchen Essentials)
 * - 1 Seasonal Collection (Festival Special - Diwali)
 * - 1 General Organization Theme (Miscellaneous)
 */
export function getAdminThemes(): ThemeDefinition[] {
  return ADMIN_THEMES.filter((t) => t.isActive);
}

/**
 * Returns the 3 permanent lifestyle themes for storefront navigation.
 */
export function getPermanentThemes(): ThemeDefinition[] {
  return PRIMARY_THEMES.filter((t) => t.isActive);
}

export function getCategoryBySlug(slugOrName?: string | null): CategoryDefinition | undefined {
  if (!slugOrName) return undefined;
  return CATEGORY_SLUG_MAP.get(slugOrName.trim().toLowerCase());
}

export function isValidCategorySlug(slugOrName?: string | null): boolean {
  if (!slugOrName) return false;
  return CATEGORY_SLUG_MAP.has(slugOrName.trim().toLowerCase());
}

/**
 * Returns subcategories for a given category slug or name.
 */
export function getCategorySubcategories(slugOrName?: string | null): string[] {
  const cat = getCategoryBySlug(slugOrName);
  return cat?.subcategories || [];
}

export function getCollectionBySlug(slug?: string | null): CollectionDefinition | undefined {
  if (!slug) return undefined;
  return COLLECTION_SLUG_MAP.get(slug.trim().toLowerCase());
}

export function isValidCollectionSlug(slug?: string | null): boolean {
  if (!slug) return false;
  return COLLECTION_SLUG_MAP.has(slug.trim().toLowerCase());
}

/**
 * Returns all active theme slugs.
 */
export function getActiveThemeSlugs(): string[] {
  return ADMIN_THEMES.filter((t) => t.isActive).map((t) => t.slug);
}

/**
 * Returns all active category slugs.
 */
export function getActiveCategorySlugs(): string[] {
  return CANONICAL_CATEGORIES.filter((c) => c.isActive).map((c) => c.slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LEGACY THEME / CATEGORY MAPPING LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyTaxonomyMapping {
  categories: string[]; // Slugs of canonical categories
  themes: string[];     // Slugs of primary lifestyle themes
  collections?: string[];
}

/**
 * Maps legacy GoAmaze categories or search terms to the canonical taxonomy.
 */
export function mapLegacyCategoryToTaxonomy(legacyCategoryName?: string | null, productTitle?: string): LegacyTaxonomyMapping {
  const clean = (legacyCategoryName || "").trim().toLowerCase();
  const text = `${clean} ${productTitle || ""}`.toLowerCase();

  // 1. Festival Special - Diwali
  if (clean.includes("diwali") || clean.includes("festival")) {
    return {
      categories: ["gifts", "lighting", "home-kitchen"],
      themes: ["festival-special-diwali"],
      collections: ["festival-special-diwali"],
    };
  }

  // 2. Smart Kitchen / Kitchen Appliances / Food Items
  if (clean.includes("smart kitchen") || clean.includes("kitchen appliances") || clean.includes("food items") || clean.includes("kitchen")) {
    const isAppliance = /\b(air fryer|blender|processor|chopper|cooker|kettle|refrigerator|microwave|oven|toaster)\b/i.test(text);
    return {
      categories: isAppliance ? ["kitchen-appliances", "home-kitchen"] : ["home-kitchen"],
      themes: ["kitchen-everyday-essentials"],
    };
  }

  // 3. Coffee Corner
  if (clean.includes("coffee corner") || clean.includes("coffee")) {
    return {
      categories: ["kitchen-appliances", "home-kitchen"],
      themes: ["kitchen-everyday-essentials"],
    };
  }

  // 4. Aesthetic Living / Home Decoration
  if (clean.includes("aesthetic living") || clean.includes("home decoration") || clean.includes("home decor")) {
    const isLighting = /\b(lamp|light|lantern|bulb|led|glow)\b/i.test(text);
    const isFurniture = /\b(chair|table|desk|shelf|stool|stand|sofa|cushion)\b/i.test(text);
    const cats = ["home-kitchen"];
    if (isLighting) cats.push("lighting");
    if (isFurniture) cats.push("furniture");
    return {
      categories: cats,
      themes: ["smart-living"],
    };
  }

  // 5. Cozy Wellness
  if (clean.includes("cozy wellness") || clean.includes("wellness")) {
    return {
      categories: ["personal-care", "home-kitchen"],
      themes: ["smart-living"],
    };
  }

  // 6. Green Living
  if (clean.includes("green living") || clean.includes("plants") || clean.includes("garden")) {
    return {
      categories: ["home-kitchen"],
      themes: ["smart-living"],
    };
  }

  // 7. Desk Setup / Study & Workspace
  if (clean.includes("desk setup") || clean.includes("study & workspace") || clean.includes("workspace")) {
    const isElectronics = /\b(monitor|keyboard|mouse|dock|hub|cable|charger|lamp)\b/i.test(text);
    return {
      categories: isElectronics ? ["computer-accessories", "electronics", "furniture"] : ["computer-accessories", "furniture"],
      themes: ["work-study-gaming"],
    };
  }

  // 8. Gaming Zone
  if (clean.includes("gaming zone") || clean.includes("gaming") || clean.includes("game")) {
    return {
      categories: ["computer-accessories", "audio-accessories", "electronics"],
      themes: ["work-study-gaming"],
    };
  }

  // 9. Study Space
  if (clean.includes("study space") || clean.includes("study")) {
    return {
      categories: ["furniture", "lighting", "computer-accessories"],
      themes: ["work-study-gaming"],
    };
  }

  // 10. Mobiles & Mobile Accessories
  if (/\b(phone case|cover|back cover|tempered glass|charger|cable|power bank|strap)\b/i.test(text)) {
    return {
      categories: ["mobile-accessories", "electronics"],
      themes: [], // Category-only accessory unless specific setup
    };
  }
  if (/\b(mobile|smartphone|iphone|samsung galaxy|redmi|oneplus|vivo|oppo|realme)\b/i.test(text)) {
    return {
      categories: ["mobiles", "electronics"],
      themes: [], // Category-only product unless specific lifestyle use case
    };
  }

  // 11. Electronics & Audio
  if (/\b(headphone|earbud|earphone|headset|audio|soundbar|mic)\b/i.test(text)) {
    const isGaming = /\b(gaming|rgb|gamer)\b/i.test(text);
    return {
      categories: ["audio-accessories", "electronics"],
      themes: isGaming ? ["work-study-gaming"] : [],
    };
  }

  // 12. Gym / Sports
  if (clean.includes("gym") || clean.includes("fitness") || clean.includes("sports")) {
    return {
      categories: ["sports-fitness"],
      themes: [],
    };
  }

  // 13. Miscellaneous / General Lifestyle
  if (clean.includes("miscellaneous") || clean.includes("misc")) {
    return {
      categories: ["electronics", "home-kitchen"],
      themes: ["miscellaneous"],
    };
  }

  // Fallback for General products
  return {
    categories: ["electronics", "home-kitchen"],
    themes: ["miscellaneous"],
  };
}
