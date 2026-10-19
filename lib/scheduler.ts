import { syncAllProductsFromCreatorApi, getLastSyncReport, SyncAllResult } from "./amazon-creator";

// Default interval: 24 hours (in milliseconds)
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the next occurrence of 4:00 AM IST (which is 22:30 UTC).
 * Indian Standard Time is UTC+05:30, so 4:00 AM IST = 22:30 UTC of the previous UTC day.
 */
export function getNext4AmRunTime(): Date {
  const now = new Date();
  const target = new Date(now);

  // Set to 22:30:00.000 UTC
  target.setUTCHours(22, 30, 0, 0);

  // If 22:30 UTC has already passed for today, advance to tomorrow's 22:30 UTC
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target;
}

interface SchedulerState {
  enabled: boolean;
  intervalMs: number;
  lastRunTime: string | null;
  nextRunTime: string | null;
  isRunning: boolean;
  timerRef: NodeJS.Timeout | null;
}

// Global singleton to persist across hot-reloads in development
const globalForScheduler = global as unknown as { __productScheduler?: SchedulerState };

const schedulerState: SchedulerState = globalForScheduler.__productScheduler || {
  enabled: true,
  intervalMs: DEFAULT_INTERVAL_MS,
  lastRunTime: null,
  nextRunTime: getNext4AmRunTime().toISOString(),
  isRunning: false,
  timerRef: null,
};

globalForScheduler.__productScheduler = schedulerState;

/**
 * Executes a single scheduled sync pass across all products.
 */
export async function executeScheduledSync(): Promise<SyncAllResult> {
  if (schedulerState.isRunning) {
    console.log("[Product Scheduler] Sync is already running. Skipping overlapping execution.");
    return (
      getLastSyncReport() || {
        success: false,
        timestamp: new Date().toISOString(),
        totalProducts: 0,
        syncedCount: 0,
        updatedCount: 0,
        priceChangedCount: 0,
        skippedCount: 0,
        errors: ["Sync already in progress"],
        details: [],
      }
    );
  }

  schedulerState.isRunning = true;
  schedulerState.lastRunTime = new Date().toISOString();

  try {
    console.log(`[Product Scheduler] Starting automated product price & attribute sync at ${schedulerState.lastRunTime}...`);
    const result = await syncAllProductsFromCreatorApi();
    console.log(`[Product Scheduler] Completed sync: ${result.updatedCount} products updated, ${result.priceChangedCount} price changes.`);
    return result;
  } catch (error: any) {
    console.error("[Product Scheduler] Error during scheduled sync:", error);
    throw error;
  } finally {
    schedulerState.isRunning = false;
    // Always keep nextRunTime pointing to the upcoming 4:00 AM IST execution
    schedulerState.nextRunTime = getNext4AmRunTime().toISOString();
  }
}

/**
 * Starts or restarts the 24-hour daily scheduler timer targeting 4:00 AM IST.
 */
export function startScheduler(intervalMs?: number) {
  if (schedulerState.timerRef) {
    clearTimeout(schedulerState.timerRef);
    schedulerState.timerRef = null;
  }

  schedulerState.enabled = true;
  schedulerState.intervalMs = intervalMs || DEFAULT_INTERVAL_MS;

  const nextRun = getNext4AmRunTime();
  schedulerState.nextRunTime = nextRun.toISOString();

  const msUntilNextRun = Math.max(1000, nextRun.getTime() - Date.now());

  console.log(
    `[Product Scheduler] Daily 24h scheduler armed. Next execution scheduled at ${schedulerState.nextRunTime} ` +
    `(${nextRun.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST, in ${(msUntilNextRun / (1000 * 60 * 60)).toFixed(2)}h).`
  );

  schedulerState.timerRef = setTimeout(async () => {
    try {
      await executeScheduledSync();
    } catch (err) {
      console.error("[Product Scheduler Error during scheduled run]", err);
    } finally {
      // Re-arm timer for the next daily execution at 4:00 AM IST
      startScheduler();
    }
  }, msUntilNextRun);
}

/**
 * Returns current scheduler operational status.
 */
export function getSchedulerStatus() {
  return {
    enabled: schedulerState.enabled,
    isRunning: schedulerState.isRunning,
    intervalHours: 24,
    scheduleDescription: "Daily at 4:00 AM IST (Every 24h)",
    intervalMs: schedulerState.intervalMs,
    lastRunTime: schedulerState.lastRunTime,
    nextRunTime: schedulerState.nextRunTime || getNext4AmRunTime().toISOString(),
    lastReport: getLastSyncReport(),
  };
}

// Auto-start on server initialization if in Node environment
if (typeof window === "undefined" && !schedulerState.timerRef && process.env.NODE_ENV !== "test") {
  startScheduler();
}
