import Image from "next/image";

interface GoAmazeLogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  priority?: boolean;
}

export default function GoAmazeLogo({
  size = 40,
  showText = false,
  textClassName = "",
  priority = false,
}: GoAmazeLogoProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${Math.max(8, Math.round(size * 0.25))}px`,
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative",
          filter: "drop-shadow(0 4px 12px rgba(139, 92, 246, 0.35))",
        }}
      >
        <Image
          src="/logo.png"
          alt="GoAmaze Logo"
          width={size}
          height={size}
          style={{
            objectFit: "contain",
            width: "100%",
            height: "100%",
          }}
          priority={priority}
        />
      </div>

      {showText && (
        <span
          className={textClassName}
          style={{
            fontFamily: "var(--font-heading, var(--font-montserrat), sans-serif)",
            fontSize: `${Math.round(size * 0.55)}px`,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          <span style={{ color: "#F8FAFC" }}>Go</span>
          <span
            style={{
              background: "linear-gradient(135deg, #60A5FA 0%, #A855F7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Amaze
          </span>
        </span>
      )}
    </div>
  );
}
