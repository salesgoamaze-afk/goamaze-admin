import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const EmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Simple in-memory rate limit (per IP, max 3 subscriptions per minute)
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }

  if (entry.count >= 3) return true;

  entry.count++;
  return false;
}

/** GET /api/newsletter — admin only: view all subscribers */
export async function GET() {
  try {
    const subscribers = await db.getSubscribers();
    return NextResponse.json({ success: true, data: subscribers });
  } catch (err) {
    console.error("[GET /api/newsletter]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

/** POST /api/newsletter — public, rate-limited */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body   = await req.json();
    const parsed = EmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid email" },
        { status: 400 }
      );
    }

    const existing = await db.getSubscriberByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json(
        { success: false, message: "This email is already subscribed! 🎉" },
        { status: 409 }
      );
    }

    await db.addSubscriber(parsed.data.email);

    return NextResponse.json(
      { success: true, message: "Successfully subscribed to GoAmaze updates!" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/newsletter]", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

