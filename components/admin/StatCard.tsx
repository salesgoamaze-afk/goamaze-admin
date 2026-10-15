"use client";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
}

export default function StatCard({ label, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div style={{
      borderRadius: "20px",
      padding: "28px",
      background: "linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
      border: "1px solid rgba(255,255,255,0.09)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "flex-start",
      gap: "20px",
      transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
      cursor: "default",
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = "translateY(-4px)";
      el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.3)`;
      el.style.borderColor = `${color}44`;
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = "translateY(0)";
      el.style.boxShadow = "none";
      el.style.borderColor = "rgba(255,255,255,0.09)";
    }}
    >
      {/* Icon */}
      <div style={{
        width: "52px",
        height: "52px",
        borderRadius: "14px",
        background: `${color}20`,
        border: `1px solid ${color}44`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "22px",
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#F8FAFC",
          lineHeight: 1.1,
          fontFamily: "'Montserrat', sans-serif",
        }}>
          {value}
        </div>
        <div style={{
          fontSize: "0.85rem",
          color: "#94A3B8",
          marginTop: "4px",
          fontWeight: 500,
        }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
