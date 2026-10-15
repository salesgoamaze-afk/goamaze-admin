"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = useCallback(async (isTimeout = false) => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push(isTimeout ? "/admin/login?timeout=1" : "/admin/login");
  }, [router]);

  // 30-minute session inactivity timeout
  useEffect(() => {
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let timeoutTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(() => {
        handleLogout(true);
      }, TIMEOUT_MS);
    };

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start initial timer
    resetTimer();

    return () => {
      clearTimeout(timeoutTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [handleLogout]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0B1120", fontFamily: "var(--font-body, 'Poppins', sans-serif)" }}>
      <AdminSidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          padding: "0 32px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(11,17,32,0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="md:hidden"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "#F8FAFC",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              ☰
            </button>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F8FAFC", margin: 0 }}>
              {title}
            </h1>
          </div>

          <button
            onClick={() => handleLogout(false)}
            style={{
              padding: "8px 20px",
              borderRadius: "99px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#FCA5A5",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.22)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
            }}
          >
            Logout
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "32px", overflow: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
