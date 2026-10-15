"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import logoImg from "@/public/logo.png";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  // Step 1: "email" | Step 2: "otp"
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoNotice, setInfoNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  // References for the 6 digit inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check for timeout=1 query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("timeout") === "1") {
        setError("Your admin session expired after 30 minutes. Please sign in again.");
      }
    }
  }, []);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus first OTP input when transitioning to step 2
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Handle Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please provide a valid administrator email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoNotice("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send verification code.");
        if (data.cooldown) {
          setCooldown(data.cooldown);
        }
        return;
      }

      setStep("otp");
      setCooldown(data.cooldown || 60);
      setInfoNotice(data.message || "Verification code sent to your email.");
      setDevCode(data.devOtp || null);
    } catch {
      setError("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent, fullCode?: string) => {
    if (e) e.preventDefault();
    const code = fullCode || otp.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits of your verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid verification code.");
        return;
      }

      // Successful verification
      router.push("/admin");
    } catch {
      setError("Network error during verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit box change
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric character
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto advance focus to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // If 6th digit entered, auto submit if full
      const completeCode = newOtp.join("");
      if (completeCode.length === 6) {
        handleVerifyOtp(undefined, completeCode);
      }
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste full 6-digit code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = ["", "", "", "", "", ""];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (pastedData.length === 6) {
      handleVerifyOtp(undefined, pastedData);
    }
  };

  // Auto fill helper for local dev
  const handleFillDevCode = (code: string) => {
    const digits = code.split("").slice(0, 6);
    setOtp(digits);
    handleVerifyOtp(undefined, code);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B1120",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          right: "15%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(249,115,22,0.06)",
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "10%",
          left: "10%",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "rgba(139,92,246,0.08)",
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          borderRadius: "24px",
          padding: "44px 40px",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              filter: "drop-shadow(0 8px 24px rgba(99,102,241,0.5))",
              position: "relative",
            }}
          >
            <Image
              src={logoImg}
              alt="GoAmaze Logo"
              width={80}
              height={80}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
              priority
            />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.25)",
              color: "#FB923C",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            <span>🔐</span> Passwordless Portal
          </div>

          <h1
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "#F8FAFC",
              fontFamily: "'Montserrat', sans-serif",
              margin: 0,
            }}
          >
            Go<span style={{ color: "#F97316" }}>Amaze</span> Admin
          </h1>
          <p style={{ fontSize: "0.86rem", color: "#94A3B8", marginTop: "6px" }}>
            {step === "email"
              ? "Enter your admin email to receive a secure OTP"
              : "Enter the 6-digit verification code sent to your email"}
          </p>
        </div>

        {/* Info Banner */}
        {infoNotice && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#86EFAC",
              fontSize: "0.82rem",
              textAlign: "center",
              marginBottom: "20px",
              lineHeight: 1.4,
            }}
          >
            ✓ {infoNotice}
          </div>
        )}

        {/* Dev Mode Banner with One-Click Fill */}
        {devCode && step === "otp" && (
          <div
            onClick={() => handleFillDevCode(devCode)}
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(249,115,22,0.15)",
              border: "1px dashed rgba(249,115,22,0.5)",
              color: "#FDBA74",
              fontSize: "0.82rem",
              textAlign: "center",
              marginBottom: "20px",
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
            title="Click to auto-fill code"
          >
            ⚡ <strong>Dev Mode Code:</strong>{" "}
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 800,
                fontSize: "1.05rem",
                letterSpacing: "2px",
                color: "#FFFFFF",
              }}
            >
              {devCode}
            </span>{" "}
            <span style={{ textDecoration: "underline", fontSize: "0.75rem" }}>
              (Click to fill)
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#FCA5A5",
              fontSize: "0.82rem",
              textAlign: "center",
              marginBottom: "20px",
              lineHeight: 1.4,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === "email" ? (
          <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#CBD5E1",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Administrator Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="salesgoamaze@gmail.com"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#F8FAFC",
                  fontSize: "0.92rem",
                  outline: "none",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#F97316";
                  e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.12)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <p
                style={{
                  fontSize: "0.74rem",
                  color: "#94A3B8",
                  margin: "8px 0 0 0",
                  textAlign: "left",
                }}
              >
                Allowed emails: <span style={{ color: "#FB923C", fontWeight: 600 }}>salesgoamaze@gmail.com</span>, <span style={{ color: "#CBD5E1" }}>admin@goamaze.com</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: loading
                  ? "rgba(249,115,22,0.5)"
                  : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                border: "none",
                color: "white",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
                transition: "all 0.25s ease",
                boxShadow: loading ? "none" : "0 8px 24px rgba(249,115,22,0.35)",
                marginTop: "4px",
              }}
            >
              {loading ? "Sending Code…" : "Send Verification Code →"}
            </button>
          </form>
        ) : (
          /* STEP 2: Enter 6-Digit OTP */
          <form onSubmit={(e) => handleVerifyOtp(e)} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Target Email display with change link */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                <span style={{ fontSize: "14px" }}>✉️</span>
                <span
                  style={{
                    fontSize: "0.83rem",
                    color: "#E2E8F0",
                    fontWeight: 600,
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError("");
                  setInfoNotice("");
                  setDevCode(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FB923C",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Change
              </button>
            </div>

            {/* 6 Digit Input Boxes */}
            <div>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#CBD5E1",
                  display: "block",
                  marginBottom: "12px",
                  textAlign: "center",
                }}
              >
                Enter 6-Digit Code
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                }}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    style={{
                      width: "48px",
                      height: "56px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.06)",
                      border: digit
                        ? "2px solid #F97316"
                        : "1px solid rgba(255,255,255,0.15)",
                      color: "#FFFFFF",
                      fontSize: "1.4rem",
                      fontWeight: 800,
                      fontFamily: "monospace",
                      textAlign: "center",
                      outline: "none",
                      transition: "all 0.15s ease",
                      boxShadow: digit
                        ? "0 0 12px rgba(249,115,22,0.25)"
                        : "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#F97316";
                      e.target.style.boxShadow = "0 0 14px rgba(249,115,22,0.3)";
                    }}
                    onBlur={(e) => {
                      if (!otp[i]) {
                        e.target.style.borderColor = "rgba(255,255,255,0.15)";
                        e.target.style.boxShadow = "none";
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Resend Cooldown Controls */}
            <div style={{ textAlign: "center", fontSize: "0.82rem", color: "#64748B" }}>
              {cooldown > 0 ? (
                <span>
                  Didn&apos;t receive the code? Resend in{" "}
                  <strong style={{ color: "#E2E8F0" }}>{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#FB923C",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Resend Verification Code
                </button>
              )}
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background:
                  loading || otp.join("").length !== 6
                    ? "rgba(249,115,22,0.35)"
                    : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                border: "none",
                color: "white",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor:
                  loading || otp.join("").length !== 6 ? "not-allowed" : "pointer",
                transition: "all 0.25s ease",
                boxShadow:
                  loading || otp.join("").length !== 6
                    ? "none"
                    : "0 8px 24px rgba(249,115,22,0.35)",
              }}
            >
              {loading ? "Verifying…" : "Verify & Sign In →"}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "28px",
            fontSize: "0.74rem",
            color: "#475569",
            lineHeight: 1.5,
          }}
        >
          Protected by GoAmaze Security Protocol. Single-use dynamic OTPs expire in 10 minutes.
        </p>
      </div>
    </div>
  );
}
