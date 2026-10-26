import fs from "fs";
import path from "path";
import { getSupabase } from "./supabase";

export interface PriceSyncAuditEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  productId: string;
  asin: string;
  title: string;
  oldPrice: string;
  newPrice: string;
  oldOriginalPrice?: string;
  newOriginalPrice?: string;
  priceChanged: boolean;
  priceDiffPercentage?: number;
  dealBadge?: string;
  savingPercentage?: string | number;
  status: "updated" | "unchanged" | "error";
  errorMessage?: string;
  affiliateLink: string;
  image: string;
}

export interface PriceSyncSession {
  sessionId: string;
  timestamp: string;
  trigger: "cron" | "manual" | "startup";
  totalProducts: number;
  syncedCount: number;
  updatedCount: number;
  priceChangedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface AuditLogData {
  sessions: PriceSyncSession[];
  entries: PriceSyncAuditEntry[];
}

const AUDIT_FILE = path.join(process.cwd(), "data", "audit-logs", "price-sync-audit.json");

// In-memory cache
let auditCache: AuditLogData | null = null;

function loadAuditData(): AuditLogData {
  if (auditCache) return auditCache;
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, "utf-8");
      auditCache = JSON.parse(raw);
      if (auditCache && Array.isArray(auditCache.entries)) {
        return auditCache;
      }
    }
  } catch (err: any) {
    console.warn("[AuditLog] Could not load audit log from disk:", err.message);
  }

  auditCache = { sessions: [], entries: [] };
  return auditCache;
}

function saveAuditData(data: AuditLogData): void {
  auditCache = data;
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[AuditLog] Could not save audit log to disk:", err.message);
  }
}

/**
 * Calculates percentage difference between two price strings (e.g. "₹999.00" and "₹849.00").
 * Negative means price dropped (discount/deal), positive means price increased.
 */
export function calculatePriceDiff(oldPriceStr?: string, newPriceStr?: string): number | undefined {
  if (!oldPriceStr || !newPriceStr) return undefined;
  const numOld = parseFloat(oldPriceStr.replace(/[^0-9.]/g, ""));
  const numNew = parseFloat(newPriceStr.replace(/[^0-9.]/g, ""));
  if (isNaN(numOld) || isNaN(numNew) || numOld === 0) return undefined;
  const diff = ((numNew - numOld) / numOld) * 100;
  return Math.round(diff * 10) / 10;
}

/**
 * Records a full price sync session along with individual product audit records.
 */
export async function recordSyncAudit(
  session: PriceSyncSession,
  entries: PriceSyncAuditEntry[]
): Promise<void> {
  const data = loadAuditData();

  // Add session (keep last 100 sessions)
  data.sessions.unshift(session);
  if (data.sessions.length > 100) {
    data.sessions = data.sessions.slice(0, 100);
  }

  // Add entries (keep last 5,000 product audit entries)
  data.entries = [...entries, ...data.entries].slice(0, 5000);

  saveAuditData(data);

  // Optional: Also attempt to insert into Supabase table if it exists
  const supabase = getSupabase();
  if (supabase) {
    try {
      const rows = entries.slice(0, 200).map((e) => ({
        id: e.id,
        session_id: e.sessionId,
        product_id: e.productId,
        asin: e.asin,
        title: e.title.slice(0, 300),
        old_price: e.oldPrice,
        new_price: e.newPrice,
        price_changed: e.priceChanged,
        status: e.status,
        timestamp: e.timestamp,
      }));
      await supabase.from("price_sync_audit_logs").insert(rows);
    } catch {
      // Table might not be created in Supabase yet — file-based storage guarantees persistence
    }
  }
}

export interface AuditQueryFilters {
  search?: string;
  changedOnly?: boolean;
  status?: string;
  limit?: number;
  page?: number;
}

/**
 * Retrieves audit log entries with flexible filtering and pagination.
 */
export function getAuditLogs(filters?: AuditQueryFilters) {
  const data = loadAuditData();
  let entries = [...data.entries];

  if (filters?.changedOnly) {
    entries = entries.filter((e) => e.priceChanged);
  }

  if (filters?.status && filters.status !== "all") {
    entries = entries.filter((e) => e.status === filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    entries = entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.asin.toLowerCase().includes(q) ||
        e.productId.toLowerCase().includes(q)
    );
  }

  const total = entries.length;
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.max(5, Math.min(200, filters?.limit || 50));
  const offset = (page - 1) * limit;

  const paginated = entries.slice(offset, offset + limit);

  return {
    entries: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    sessions: data.sessions.slice(0, 10),
  };
}

/**
 * Returns summary stats for the audit dashboard cards.
 */
export function getAuditSummary() {
  const data = loadAuditData();
  const totalRuns = data.sessions.length;
  const lastSession = data.sessions[0] || null;

  let priceDrops = 0;
  let priceIncreases = 0;
  let totalChanges = 0;

  for (const entry of data.entries) {
    if (entry.priceChanged) {
      totalChanges++;
      if (entry.priceDiffPercentage !== undefined) {
        if (entry.priceDiffPercentage < 0) priceDrops++;
        else if (entry.priceDiffPercentage > 0) priceIncreases++;
      }
    }
  }

  return {
    totalRuns,
    lastRunTime: lastSession?.timestamp || null,
    totalChanges,
    priceDrops,
    priceIncreases,
    recentSessionsCount: data.sessions.length,
    auditedProductsCount: data.entries.length,
  };
}
