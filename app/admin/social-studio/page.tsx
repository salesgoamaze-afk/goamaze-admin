"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Product {
  _id: string;
  title: string;
  subtitle?: string;
  category: string;
  price: string;
  originalPrice?: string;
  rating: number;
  reviews?: number;
  image: string;
  images?: string[];
  affiliateLink: string;
  instagramUrl?: string;
  badge?: string;
}

function getHumanModelTarget(p: Product | null): { modelDescription: string; personaBadge: string } {
  if (!p) {
    return {
      modelDescription: "photorealistic AI human model",
      personaBadge: "👩/👨 Model (Unisex)",
    };
  }

  const cat = (p.category || "").toLowerCase();
  const title = (p.title || "").toLowerCase();
  const text = `${title} ${cat}`;

  // 1. TV & Home Entertainment (High Priority)
  if (
    /\b(tv|television|oled|qled|soundbar|projector|home theatre|home theater|4k screen)\b/i.test(text) ||
    title.includes("smart tv") ||
    title.includes("led tv")
  ) {
    return {
      modelDescription: "photorealistic AI model (modern couple or family enjoying a high-end cinematic home theater in a cozy luxury dim-lit living room with warm ambient backlighting)",
      personaBadge: "📺 TV & Cinema AI Model (Couple/Family)",
    };
  }

  // 2. Kitchen Appliances & Refrigerators
  if (
    cat.includes("kitchen") ||
    /\b(refrigerator|fridge|food processor|air fryer|mixer grinder|blender|kettle|cooktop|oven|microwave)\b/i.test(text)
  ) {
    return {
      modelDescription: "photorealistic AI model (stylish home chef or modern homeowner in a bright sunlit luxury aesthetic kitchen)",
      personaBadge: "🍳 Kitchen & Chef AI Model",
    };
  }

  // 3. Fitness & Gym (Fixed: uses regex with word boundaries to avoid false positives like 'dual-band' or 'broadband')
  if (/\b(gym|fitness|resistance bands?|workout|exercise|ab roller|yoga|dumbbells?|pull up)\b/i.test(text)) {
    return {
      modelDescription: "photorealistic AI athletic fitness model (toned athletic woman or man in clean modern home gym setup)",
      personaBadge: "🏋️ Athletic AI Model (Female / Male)",
    };
  }

  // 4. Feminine / Aesthetic decor / Beauty
  if (
    cat.includes("decor") ||
    /\b(vase|skincare|beauty|diffuser|candle|aesthetic|floral|decor|sculpture)\b/i.test(text)
  ) {
    return {
      modelDescription: "photorealistic AI female model (stylish, elegant woman in modern aesthetic cozy interior with warm natural lighting)",
      personaBadge: "👩 Aesthetic Home & Lifestyle AI Model",
    };
  }

  // 5. Masculine / Men's Grooming
  if (/\b(shaving|beard|trimmer|shaver|grooming|men's)\b/i.test(text)) {
    return {
      modelDescription: "photorealistic AI male model (sharp, well-groomed modern athletic man in luxury bathroom)",
      personaBadge: "👨 Male Grooming AI Model",
    };
  }

  // 6. Workspace / Study
  if (
    cat.includes("workspace") ||
    cat.includes("study") ||
    /\b(desk|laptop stand|ergonomic|mouse pad|workstation|office chair)\b/i.test(text)
  ) {
    return {
      modelDescription: "photorealistic AI creative professional (focused young woman or man at a clean minimalist workstation)",
      personaBadge: "💼 Creative Pro (Female/Male)",
    };
  }

  return {
    modelDescription: "photorealistic AI human model (stylish young adult or couple interacting naturally with product)",
    personaBadge: "👩/👨 Model (Adaptive)",
  };
}

function getPainPointAndSolution(p: Product | null) {
  if (!p) {
    return {
      pain: "Looking for a reliable upgrade?",
      solution: "Here is our top curated recommendation.",
      visualCue: "Show everyday struggle transition to effortless product usage.",
    };
  }

  const cat = (p.category || "").toLowerCase();
  const title = (p.title || "").toLowerCase();
  const text = `${title} ${cat}`;

  // 1. TV & Home Cinema
  if (
    /\b(tv|television|oled|qled|soundbar|projector|home theatre|home theater|4k screen)\b/i.test(text) ||
    title.includes("smart tv") ||
    title.includes("led tv")
  ) {
    return {
      pain: "Tired of watching movies on a dull, low-contrast screen with washed-out colors and tinny speakers?",
      solution: "Turn your living room into a pure 4K Ultra HD cinema with vibrant HDR contrast and room-filling acoustics.",
      visualCue: "Scene 1: Person squinting at a dull, washed-out TV screen. Scene 2: Cinematic reveal of razor-sharp 4K HDR visuals popping on screen with rich deep blacks. Scene 3: Cozy couple or family immersed in stunning movie night entertainment.",
    };
  }

  // 2. Kitchen & Refrigerators
  if (
    cat.includes("kitchen") ||
    /\b(refrigerator|fridge|food processor|air fryer|mixer grinder|blender|kettle|cooktop|oven|microwave)\b/i.test(text)
  ) {
    return {
      pain: "Spending 45+ minutes on messy kitchen prep and struggling with spoiled food or cluttered counters?",
      solution: "This smart high-efficiency appliance cuts your cooking prep time by 70% and keeps everything fresh.",
      visualCue: "Scene 1: Cluttered cutting board & tired cook. Scene 2: Ultra-fast effortless prep in seconds with modern touch controls. Scene 3: Clean aesthetic luxury kitchen hero shot.",
    };
  }

  // 3. Gym & Fitness
  if (/\b(gym|fitness|resistance bands?|workout|exercise|ab roller|yoga|dumbbells?|pull up)\b/i.test(text)) {
    return {
      pain: "No time to commute to crowded gyms or pay ₹3,000/month expensive gym memberships?",
      solution: "A complete full-body progressive strength workout anywhere in a compact 6x6 foot space.",
      visualCue: "Scene 1: Checking clock and crowded gym bag. Scene 2: High-energy home workout with intense muscle activation. Scene 3: Compact pack-away in seconds.",
    };
  }

  // 4. Decor & Aesthetics
  if (cat.includes("decor") || /\b(vase|lamp|rug|diffuser|candle|aesthetic|wall art)\b/i.test(text)) {
    return {
      pain: "Your room feels empty, flat, or lacking that cozy Pinterest aesthetic vibe?",
      solution: "Instant luxury room makeover that elevates your space with warm designer ambiance.",
      visualCue: "Scene 1: Plain empty corner. Scene 2: Placing the aesthetic designer piece. Scene 3: Soft warm sunlight hitting rich textures with cozy lighting.",
    };
  }

  // 5. Workspace / Study
  if (
    cat.includes("workspace") ||
    cat.includes("study") ||
    /\b(desk|laptop stand|ergonomic|mouse pad|workstation|office chair)\b/i.test(text)
  ) {
    return {
      pain: "Messy tangled cables, poor posture, and cluttered desk making you lose focus and productivity?",
      solution: "A clean minimalist workstation setup engineered for deep work, posture support, and zero distraction.",
      visualCue: "Scene 1: Chaotic tangled desk and bad posture. Scene 2: Satisfying smooth desk setup placement. Scene 3: Focused productive workstation with warm ambient glow.",
    };
  }

  return {
    pain: "Struggling with low-quality, overpriced products that break in weeks?",
    solution: "Handpicked, tested, and thoughtfully curated top performer built to last.",
    visualCue: "Scene 1: Frustration with old alternative. Scene 2: Unboxing and smooth effortless usage. Scene 3: Aesthetic product hero shot.",
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2
) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      if (lineCount === maxLines - 1) {
        ctx.fillText(line.trim() + "...", x, y);
        return;
      }
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function drawImageProp(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX: number = 0.5,
  offsetY: number = 0.5
) {
  const iw = (img as HTMLImageElement).width || 800;
  const ih = (img as HTMLImageElement).height || 800;
  const r = Math.min(w / iw, h / ih);
  let nw = iw * r;
  let nh = ih * r;
  let ar = 1;

  if (nw < w) ar = w / nw;
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
  nw *= ar;
  nh *= ar;

  let cw = iw / (nw / w);
  let ch = ih / (nh / h);

  let cx = (iw - cw) * offsetX;
  let cy = (ih - ch) * offsetY;

  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
}

function SocialStudioContent() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [styleTheme, setStyleTheme] = useState<"dark" | "minimal" | "sunset">("dark");
  const [customTagline, setCustomTagline] = useState("");
  const [reelLinkInput, setReelLinkInput] = useState("");
  const [savingReel, setSavingReel] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          setProducts(r.data);
          if (initialProductId) {
            const found = r.data.find((p: Product) => p._id === initialProductId);
            if (found) {
              setSelectedProduct(found);
              setReelLinkInput(found.instagramUrl || "");
            }
          } else if (r.data.length > 0) {
            setSelectedProduct(r.data[0]);
            setReelLinkInput(r.data[0].instagramUrl || "");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [initialProductId]);

  const renderCanvas = (img: HTMLImageElement | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedProduct) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1000;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;

    // Background
    if (styleTheme === "dark") {
      ctx.fillStyle = "#070D1A";
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createRadialGradient(W / 2, 400, 50, W / 2, 400, 600);
      grad.addColorStop(0, "rgba(59,130,246,0.18)");
      grad.addColorStop(1, "rgba(7,13,26,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (styleTheme === "sunset") {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#1e1b4b");
      grad.addColorStop(0.5, "#311042");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, W, H);
    }

    // Top Header: GoAmaze Branding
    ctx.fillStyle = styleTheme === "minimal" ? "#3B82F6" : "#A78BFA";
    ctx.font = "bold 32px 'Montserrat', sans-serif";
    ctx.fillText("✦ GOAMAZE PICKS", 80, 100);

    // Tagline / Category Badge
    ctx.fillStyle = styleTheme === "minimal" ? "#0F172A" : "#FFFFFF";
    ctx.font = "800 46px 'Montserrat', sans-serif";
    const categoryText = (selectedProduct.category || "Curated").toUpperCase();
    ctx.fillText(categoryText, 80, 160);

    // Product Image Card Container
    const imgX = 80;
    const imgY = 220;
    const imgW = 840;
    const imgH = 750;

    // Card background & shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = styleTheme === "minimal" ? "#FFFFFF" : "#131C31";
    roundRect(ctx, imgX, imgY, imgW, imgH, 32);
    ctx.fill();
    ctx.restore();

    // Clip image inside rounded card
    ctx.save();
    roundRect(ctx, imgX, imgY, imgW, imgH, 32);
    ctx.clip();
    if (img) {
      drawImageProp(ctx, img, imgX, imgY, imgW, imgH, 0.5, 0.5);
    } else {
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Product Preview", W / 2, imgY + imgH / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    // Floating Badge on image
    const badgeText = customTagline || selectedProduct.badge || "Top Rated";
    ctx.fillStyle = "rgba(59, 130, 246, 0.95)";
    roundRect(ctx, imgX + 30, imgY + 30, 320, 56, 16);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px 'Montserrat', sans-serif";
    ctx.fillText("🔥 " + badgeText, imgX + 50, imgY + 68);

    // Quality Badge
    ctx.fillStyle = "#A78BFA";
    ctx.font = "bold 28px 'Montserrat', sans-serif";
    ctx.fillText("✦ Curated Quality Pick", 80, 1030);

    // Title Text (wrapped)
    ctx.fillStyle = styleTheme === "minimal" ? "#0F172A" : "#FFFFFF";
    ctx.font = "bold 44px 'Montserrat', sans-serif";
    wrapText(ctx, selectedProduct.title, 80, 1090, 840, 54, 2);

    // Price and Save CTA Pill
    const bottomY = 1320;
    ctx.fillStyle = "#10B981";
    ctx.font = "800 52px 'Montserrat', sans-serif";
    ctx.fillText(selectedProduct.price, 80, bottomY);

    if (selectedProduct.originalPrice) {
      ctx.fillStyle = "#64748B";
      ctx.font = "32px 'Montserrat', sans-serif";
      ctx.fillText("M.R.P: " + selectedProduct.originalPrice, 80, bottomY + 45);
    }

    // Save on Pinterest / Social Button
    const btnW = 340;
    const btnH = 80;
    const btnX = W - 80 - btnW;
    const btnY = bottomY - 60;
    ctx.fillStyle = "#E60023";
    roundRect(ctx, btnX, btnY, btnW, btnH, 40);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px 'Montserrat', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📌 Save on Pinterest", btnX + btnW / 2, btnY + 50);
    ctx.textAlign = "left";

    // Footer link
    ctx.fillStyle = styleTheme === "minimal" ? "#64748B" : "#94A3B8";
    ctx.font = "24px 'Montserrat', sans-serif";
    ctx.fillText("🔗 Curated on goamaze.in", 80, 1440);
  };

  const renderCanvases = () => {
    if (!selectedProduct) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      renderCanvas(img);
    };
    img.onerror = () => {
      renderCanvas(null);
    };
    img.src = selectedProduct.image;
  };

  useEffect(() => {
    if (selectedProduct) {
      setReelLinkInput(selectedProduct.instagramUrl || "");
      setCustomTagline(selectedProduct.badge || "Editor's Pick — Must-Have Find");
      renderCanvases();
    }
  }, [selectedProduct, styleTheme]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setReelLinkInput(p.instagramUrl || "");
    setCustomTagline(p.badge || "Editor's Pick — Must-Have Find");
    setSaveSuccess(false);
  };

  const handleSaveReelLink = async () => {
    if (!selectedProduct) return;
    setSavingReel(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/products/${selectedProduct._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUrl: reelLinkInput.trim() }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setSelectedProduct({
          ...selectedProduct,
          instagramUrl: reelLinkInput.trim(),
        });
        setProducts((prev) =>
          prev.map((p) =>
            p._id === selectedProduct._id
              ? { ...p, instagramUrl: reelLinkInput.trim() }
              : p
          )
        );
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setSavingReel(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadCanvasAsPng = () => {
    if (!canvasRef.current) return;
    try {
      const link = document.createElement("a");
      link.download = `goamaze-${selectedProduct?.category || "product"}-${selectedProduct?._id || "pin"}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    } catch {
      alert(
        "Direct export blocked by image CORS. You can right-click the preview image and choose 'Save Image As...'"
      );
    }
  };

  // Helper text generators
  const cleanTitle = selectedProduct?.title || "Product";
  const { pain, solution, visualCue } = getPainPointAndSolution(selectedProduct);
  const { modelDescription, personaBadge } = getHumanModelTarget(selectedProduct);

  const pinTitle = `${cleanTitle} — Curated Buying Guide`;
  const pinDescription = `🔥 Problem: ${pain}\n✨ Solution: ${solution}\n\nThoughtfully curated design find.\n\n🔗 View Details: ${selectedProduct?.affiliateLink || "https://goamaze.store"}\n\n#PinterestFinds #GoAmaze #CuratedFinds #HomeHacks #ModernLiving`;

  const instaCaption = `😫 Problem: ${pain}\n✨ Solution: ${solution}\n\n✦ Product: ${cleanTitle}\n\nWhy it is worth every rupee:\n✅ Solves daily clutter & friction\n✅ Thoughtfully Selected for Quality\n\n🔗 Direct link in Bio & Story!\n👉 Follow @salesgoamaze for daily smart living finds.\n\n#goamaze #curatedliving #problemandproduct #smartliving`;

  // 🎬 PAS Video Prompt for Google Flow (with AI Human Model)
  const googleFlowVideoPrompt = `Vertical 9:16 cinematic commercial featuring a ${modelDescription}. Scene 1: ${modelDescription} visibly frustrated dealing with "${pain}". Scene 2: Satisfying seamless transition showing them happily using "${cleanTitle}" to solve the problem effortlessly. Scene 3: Clean luxury aesthetic product in motion with warm lighting, 4K resolution, 60fps, commercial quality.`;

  // 🖼️ Image Generation Prompt for Google Flow / Imagen (with AI Human Model)
  const googleFlowImagePrompt = `Photorealistic luxury editorial commercial photography featuring a ${modelDescription} naturally interacting with and using ${cleanTitle} to solve "${pain}". Soft natural sunlight, modern aesthetic room backdrop, shallow depth of field, authentic candid expression, 8K ultra-detailed commercial render.`;

  // 🎙️ PAS 15-second Voiceover Script
  const reelVoiceoverScript = `[0-3s PAIN HOOK]: "Stop! Are you still ${pain.toLowerCase().replace(/\?$/, "")}?"\n[4-10s SOLUTION]: "Meet the ${cleanTitle.slice(0, 45)} — ${solution}"\n[11-15s CTA]: "Check latest details and price link in our bio!"`;

  return (
    <AdminLayout title="Social Media Studio">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#F8FAFC",
              fontFamily: "'Montserrat', sans-serif",
              margin: "0 0 4px",
            }}
          >
            🎨 1-Click Social Studio & AI Human Model Prompts ($0)
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "0.85rem", margin: 0 }}>
            Generates tailored AI Human Model (Female / Male / Couple) prompts for Google Flow + Pinterest & Instagram packs.
          </p>
        </div>

        <Link
          href="/admin/products"
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#E2E8F0",
            textDecoration: "none",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          ← Back to Products
        </Link>
      </div>

      {/* Main Grid: Left Selector, Center Single Visual & Prompts, Right Captions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "270px 480px 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* ── 1. Left: Product Selector ── */}
        <div
          style={{
            background: "rgba(15,23,42,0.8)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#F8FAFC",
              margin: "0 0 10px",
            }}
          >
            🛍️ Select Product ({products.length})
          </h3>

          <input
            type="text"
            placeholder="Search product..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              fontSize: "0.8rem",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              maxHeight: "720px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {loading ? (
              <p style={{ color: "#64748B", fontSize: "0.82rem" }}>Loading products...</p>
            ) : (
              products
                .filter((p) =>
                  p.title.toLowerCase().includes(filter.toLowerCase())
                )
                .map((p) => {
                  const isSelected = selectedProduct?._id === p._id;
                  return (
                    <div
                      key={p._id}
                      onClick={() => handleSelectProduct(p)}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25))"
                          : "rgba(255,255,255,0.02)",
                        border: isSelected
                          ? "1px solid rgba(139,92,246,0.5)"
                          : "1px solid rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <img
                        src={p.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: isSelected ? "#FFFFFF" : "#CBD5E1",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.title}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#10B981" }}>
                          {p.price} • {p.instagramUrl ? "🎬 Reel Linked" : "No Reel"}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* ── 2. Center: SINGLE Visual Card & AI Human Prompts ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Controls Bar */}
          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", color: "#94A3B8", fontWeight: 600 }}>Theme:</span>
              {(["dark", "minimal", "sunset"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setStyleTheme(t)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "7px",
                    border: styleTheme === t ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.1)",
                    background: styleTheme === t ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)",
                    color: styleTheme === t ? "#FFFFFF" : "#94A3B8",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={downloadCanvasAsPng}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #E60023, #D97706)",
                border: "none",
                color: "white",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(230,0,35,0.3)",
              }}
            >
              ⬇️ Download Image (PNG)
            </button>
          </div>

          {/* SINGLE Aesthetic Card Preview */}
          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "380px",
                aspectRatio: "2/3",
                borderRadius: "14px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#000",
                boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
              }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>

          {/* 🎬 AI Human Model Video Reel Prompt Box */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))",
              borderRadius: "16px",
              border: "1px solid rgba(139,92,246,0.35)",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "18px" }}>🎬</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#F8FAFC" }}>
                  Google Flow Video Prompt ({personaBadge})
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(googleFlowVideoPrompt, "flow-video")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "7px",
                  background: copiedKey === "flow-video" ? "#10B981" : "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiedKey === "flow-video" ? "✓ Copied!" : "📋 Copy Video Prompt"}
              </button>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.45)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#E2E8F0",
                fontSize: "0.78rem",
                lineHeight: 1.5,
                fontFamily: "monospace",
              }}
            >
              {googleFlowVideoPrompt}
            </div>
          </div>

          {/* 🖼️ AI Image Generator Prompt Box with Human Model */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "16px" }}>🖼️</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F8FAFC" }}>
                  Google Flow / Imagen Image Prompt ({personaBadge})
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(googleFlowImagePrompt, "flow-image")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: copiedKey === "flow-image" ? "#10B981" : "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {copiedKey === "flow-image" ? "✓ Copied!" : "Copy Image Prompt"}
              </button>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.35)",
                padding: "8px 10px",
                borderRadius: "8px",
                color: "#94A3B8",
                fontSize: "0.75rem",
                lineHeight: 1.4,
                fontFamily: "monospace",
              }}
            >
              {googleFlowImagePrompt}
            </div>
          </div>
        </div>

        {/* ── 3. Right: Copy Packs (Pinterest, Instagram, Reel Sync) ── */}
        <div
          style={{
            background: "rgba(15,23,42,0.8)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* AI Persona Target Badge */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(244,114,182,0.12), rgba(139,92,246,0.12))",
              borderRadius: "12px",
              border: "1px solid rgba(244,114,182,0.3)",
              padding: "12px",
            }}
          >
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#F472B6", marginBottom: "4px" }}>
              👤 Targeted AI Human Persona:
            </div>
            <div style={{ fontSize: "0.75rem", color: "#FBCFE8", lineHeight: 1.4, marginBottom: "8px" }}>
              {personaBadge}
            </div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#34D399", marginBottom: "4px" }}>
              ✨ Pain & Solution Angle:
            </div>
            <div style={{ fontSize: "0.74rem", color: "#A7F3D0", lineHeight: 1.4 }}>
              &quot;{pain}&quot; → &quot;{solution}&quot;
            </div>
          </div>

          <h3
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#F8FAFC",
              margin: "0 0 2px",
            }}
          >
            📋 Ready-to-Post Copy Packs
          </h3>

          {/* 📌 Pinterest Pack */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#E2E8F0" }}>
                📌 Pinterest Title & Pin
              </span>
              <button
                onClick={() =>
                  copyToClipboard(`${pinTitle}\n\n${pinDescription}`, "pin")
                }
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: copiedKey === "pin" ? "#10B981" : "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {copiedKey === "pin" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p
              style={{
                color: "#94A3B8",
                fontSize: "0.74rem",
                lineHeight: 1.5,
                margin: 0,
                maxHeight: "90px",
                overflowY: "auto",
              }}
            >
              <strong>{pinTitle}</strong>
              <br />
              {pinDescription}
            </p>
          </div>

          {/* 📸 Instagram Pack */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#E2E8F0" }}>
                📸 Instagram Caption & Tags
              </span>
              <button
                onClick={() => copyToClipboard(instaCaption, "insta")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: copiedKey === "insta" ? "#10B981" : "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {copiedKey === "insta" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p
              style={{
                color: "#94A3B8",
                fontSize: "0.74rem",
                lineHeight: 1.5,
                margin: 0,
                maxHeight: "95px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {instaCaption}
            </p>
          </div>

          {/* 🎙️ Reel Voiceover Script */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#E2E8F0" }}>
                🎙️ 15s PAS Voiceover Script
              </span>
              <button
                onClick={() => copyToClipboard(reelVoiceoverScript, "voice")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: copiedKey === "voice" ? "#10B981" : "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {copiedKey === "voice" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p
              style={{
                color: "#94A3B8",
                fontSize: "0.74rem",
                lineHeight: 1.5,
                margin: 0,
                maxHeight: "95px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {reelVoiceoverScript}
            </p>
          </div>

          {/* 🎬 Attach Reel Video URL */}
          <div
            style={{
              background: "rgba(139,92,246,0.1)",
              borderRadius: "12px",
              border: "1px solid rgba(139,92,246,0.3)",
              padding: "14px",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F8FAFC", display: "block", marginBottom: "4px" }}>
              🎬 Attach Live Reel URL to Product
            </span>
            <p style={{ color: "#94A3B8", fontSize: "0.72rem", margin: "0 0 10px" }}>
              Paste your Instagram Reel or YouTube Shorts URL to show the &quot;Watch Reel&quot; button on your storefront.
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={reelLinkInput}
                onChange={(e) => setReelLinkInput(e.target.value)}
                placeholder="https://instagram.com/reel/..."
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFFFFF",
                  fontSize: "0.78rem",
                }}
              />
              <button
                onClick={handleSaveReelLink}
                disabled={savingReel || !selectedProduct}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: saveSuccess ? "#10B981" : "linear-gradient(135deg,#3B82F6,#8B5CF6)",
                  border: "none",
                  color: "white",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {savingReel ? "..." : saveSuccess ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function SocialStudioPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "white" }}>Loading Social Studio...</div>}>
      <SocialStudioContent />
    </Suspense>
  );
}
