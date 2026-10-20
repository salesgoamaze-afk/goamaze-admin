"use client";

import Link from "next/link";
import Image from "next/image";
import logoImg from "@/public/logo.png";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { href: "/admin",              label: "Dashboard",      icon: "⚡" },
  { href: "/admin/recommendations", label: "AI Recommendations", icon: "🧠" },
  { href: "/admin/products",     label: "Products",       icon: "🛍️" },
  { href: "/admin/amazon-import",label: "Amazon Creator", icon: "🛒" },
  { href: "/admin/social-studio",label: "Social Studio",  icon: "🎨" },
  { href: "/admin/categories",   label: "Categories",     icon: "🏷️" },
  { href: "/admin/blogs",        label: "Guides & Blogs", icon: "📝" },
  { href: "/admin/newsletter",   label: "Newsletter",     icon: "📧" },
];

export default function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div style={{
      width: "240px",
      minHeight: "100%",
      background: "rgba(15,23,42,0.98)",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      flexDirection: "column",
      padding: "0 0 24px",
      boxSizing: "border-box",
      height: "100%",
    }}>
      {/* Logo */}
      <div style={{
        padding: "24px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        marginBottom: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <div style={{
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 2px 8px rgba(139,92,246,0.35))",
            flexShrink: 0,
            position: "relative",
          }}>
            <Image
              src={logoImg}
              alt="GoAmaze Logo"
              width={36}
              height={36}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
            />
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 900, lineHeight: 1.15, display: "flex", alignItems: "center" }}>
              <span style={{ color: "#F8FAFC" }}>Go</span>
              <span style={{
                background: "linear-gradient(135deg, #60A5FA 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>Amaze</span>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#F97316", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin Panel</div>
          </div>
        </div>

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="md:hidden"
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: "0 12px", flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => { if (onClose) onClose(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 14px",
                borderRadius: "12px",
                marginBottom: "4px",
                fontSize: "0.87rem",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#F8FAFC" : "#64748B",
                background: isActive
                  ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))"
                  : "transparent",
                border: isActive
                  ? "1px solid rgba(139,92,246,0.3)"
                  : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.2s ease",
              }}
            >
              <span style={{ fontSize: "16px" }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer note */}
      <div style={{ padding: "0 20px" }}>
        <Link
          href="/"
          target="_blank"
          onClick={() => { if (onClose) onClose(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "12px",
            fontSize: "0.8rem",
            color: "#64748B",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "all 0.2s ease",
          }}
        >
          <span>🌐</span> View Public Site
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Permanent Sidebar */}
      <aside className="hidden md:block" style={{
        width: "240px",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
      }}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (visible only when isOpen on small screens < md) */}
      {isOpen && (
        <div className="md:hidden" style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
        }}>
          {/* Backdrop */}
          <div
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
            }}
          />
          {/* Drawer */}
          <div style={{
            position: "relative",
            zIndex: 10000,
            width: "240px",
            height: "100vh",
            boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
          }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
