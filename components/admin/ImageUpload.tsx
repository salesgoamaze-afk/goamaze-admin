"use client";

import { useRef, useState, useEffect } from "react";

interface ImageUploadProps {
  value: string;
  images?: string[];
  onChange: (primaryUrl: string) => void;
  onImagesChange?: (images: string[]) => void;
  label?: string;
}

export default function ImageUpload({
  value,
  images = [],
  onChange,
  onImagesChange,
  label = "Product Images (Multi-Image Gallery)",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

  // Clear error whenever value changes
  useEffect(() => {
    setError("");
    setFailedThumbnails(new Set());
  }, [value]);

  // Sync images array with value
  const allImages = Array.from(
    new Set([value, ...(images || [])].filter((url): url is string => Boolean(url && url.trim())))
  );

  const handleAddUrl = () => {
    if (!newImageUrl.trim()) return;
    let url = newImageUrl.trim();

    // If user pasted an Amazon product URL or ASIN instead of direct image URL, resolve to official image
    if ((url.includes("amazon.") || url.includes("amzn.") || /^[B0][A-Z0-9]{9}$/i.test(url)) && !url.match(/\.(jpg|jpeg|png|webp)/i)) {
      const asinMatch =
        url.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/ASIN\/|[?&]asin=|\/d\/)([A-Z0-9]{10})/i) ||
        url.match(/\b([B0][A-Z0-9]{9})\b/i);
      if (asinMatch) {
        url = `https://images-eu.ssl-images-amazon.com/images/P/${asinMatch[1].toUpperCase()}.01.MAIN._SCLZZZZZZZ_.jpg`;
      }
    }

    if (!allImages.includes(url)) {
      const updated = [...allImages, url];
      if (onImagesChange) onImagesChange(updated);
      if (!value) onChange(url);
    }
    setNewImageUrl("");
  };

  const handleSetPrimary = (url: string) => {
    onChange(url);
    if (onImagesChange) {
      const rest = allImages.filter(i => i !== url);
      onImagesChange([url, ...rest]);
    }
  };

  const handleRemoveImage = (url: string) => {
    const updated = allImages.filter(i => i !== url);
    if (onImagesChange) onImagesChange(updated);
    if (value === url) {
      onChange(updated[0] || "");
    }
  };

  const handleFile = async (file: File) => {
    setError("");
    setLoading(true);

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, and GIF images are allowed.");
      setLoading(false);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10MB.");
      setLoading(false);
      return;
    }

    // Convert to data URL for immediate use
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const updated = [...allImages, dataUrl];
      if (onImagesChange) onImagesChange(updated);
      if (!value) onChange(dataUrl);
      setLoading(false);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#CBD5E1" }}>
          {label} ({allImages.length} {allImages.length === 1 ? "image" : "images"})
        </label>
        <span style={{ fontSize: "0.72rem", color: "#A78BFA", fontWeight: 600 }}>
          ✨ Multi-Image Gallery Supported
        </span>
      </div>

      {/* Main Image Preview */}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          borderRadius: "18px",
          border: `2px dashed ${dragOver ? "#8B5CF6" : error ? "#EF4444" : "rgba(255,255,255,0.15)"}`,
          background: dragOver ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)",
          padding: "20px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.25s ease",
          position: "relative",
          overflow: "hidden",
          minHeight: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {value ? (
          <div style={{ position: "relative", width: "100%", maxHeight: "220px", overflow: "hidden", borderRadius: "12px", display: "flex", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Primary Preview"
              referrerPolicy="no-referrer"
              onError={() => setError("Could not load primary preview. You can select another image below or enter a custom URL.")}
              onLoad={() => setError("")}
              style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "contain", borderRadius: "10px" }}
            />
            <div style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(139,92,246,0.9)",
              color: "white",
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "0.72rem",
              fontWeight: 700,
              backdropFilter: "blur(6px)",
            }}>
              ⭐ Primary Hero Image
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: "36px" }}>🖼️</div>
            <div style={{ fontSize: "0.85rem", color: "#94A3B8", fontWeight: 500 }}>
              Click to upload or drag & drop image file
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
              PNG, JPG, WebP up to 10MB
            </div>
          </>
        )}
      </div>

      {/* Multi-Image Thumbnails Grid */}
      {allImages.length > 0 && (
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#94A3B8", marginBottom: "8px" }}>
            Image Gallery Thumbnails (Click to set primary, ✕ to delete):
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
            gap: "10px",
            background: "rgba(15,23,42,0.5)",
            padding: "12px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {allImages.map((imgUrl, idx) => {
              const isPrimary = imgUrl === value;
              return (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    aspectRatio: "1/1",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: isPrimary ? "2px solid #8B5CF6" : "1px solid rgba(255,255,255,0.15)",
                    background: "#0F172A",
                    cursor: "pointer",
                    boxShadow: isPrimary ? "0 0 12px rgba(139,92,246,0.4)" : "none",
                  }}
                  onClick={() => handleSetPrimary(imgUrl)}
                  title={isPrimary ? "Primary Image" : "Click to set as primary"}
                >
                  {failedThumbnails.has(imgUrl) ? (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(239,68,68,0.12)",
                      color: "#F87171",
                      fontSize: "0.62rem",
                      fontWeight: 600,
                      padding: "4px",
                      textAlign: "center",
                    }}>
                      <span>⚠️</span>
                      <span>Unavailable</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedThumbnails(prev => new Set(prev).add(imgUrl))}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  {isPrimary && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(139,92,246,0.9)",
                      color: "white",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textAlign: "center",
                      padding: "2px 0",
                    }}>
                      Primary
                    </div>
                  )}
                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(imgUrl);
                    }}
                    style={{
                      position: "absolute",
                      top: 3,
                      right: 3,
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "rgba(239,68,68,0.85)",
                      color: "white",
                      border: "none",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                    title="Remove Image"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Additional Image URL */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="url"
          value={newImageUrl}
          onChange={e => setNewImageUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddUrl(); } }}
          placeholder="Paste extra image URL to add to gallery…"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#F8FAFC",
            fontSize: "0.82rem",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handleAddUrl}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            background: "rgba(139,92,246,0.2)",
            border: "1px solid rgba(139,92,246,0.4)",
            color: "#C4B5FD",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Add Image
        </button>
      </div>

      {error && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "10px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "#FCA5A5",
          fontSize: "0.8rem",
        }}>
          ⚠️ {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

