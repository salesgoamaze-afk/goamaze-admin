import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "goamaze-fallback-secret-32-chars!!"
);

import type { NextRequest } from "next/server";

export const TOKEN_NAME = "goamaze_admin_token";
export const SESSION_MAX_AGE_SECONDS = 30 * 60; // 30 minutes (1800s)
const MAX_AGE = SESSION_MAX_AGE_SECONDS;

/** Sign a JWT for the given admin payload */
export async function signToken(payload: {
  id: string;
  email: string;
  role: string;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(SECRET);
}

/** Verify and decode a JWT. Returns null if invalid. */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

/** Read the admin token from the HTTP-only cookie or Authorization header */
export async function getTokenFromCookies(req?: NextRequest) {
  // 1. Check Authorization Bearer header if req provided
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearer = authHeader.slice(7).trim();
      if (bearer) return bearer;
    }
    // 2. Check req.cookies directly
    const cookieVal = req.cookies.get(TOKEN_NAME)?.value;
    if (cookieVal) return cookieVal;
  }

  // 3. Check next/headers cookies() store
  try {
    const cookieStore = await cookies();
    const storeVal = cookieStore.get(TOKEN_NAME)?.value;
    if (storeVal) return storeVal;
  } catch {}

  return null;
}

/** Set the JWT as an HTTP-only cookie */
export function buildCookieHeader(token: string) {
  const isProd = process.env.NODE_ENV === "production";
  return `${TOKEN_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${isProd ? "; Secure" : ""}`;
}

/** Clear the JWT cookie */
export function buildClearCookieHeader() {
  const isProd = process.env.NODE_ENV === "production";
  return `${TOKEN_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? "; Secure" : ""}`;
}
