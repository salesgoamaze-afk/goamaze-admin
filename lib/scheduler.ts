import { syncAllProductsFromCreatorApi, getLastSyncReport, SyncAllResult } from "./amazon-creator";

// Default interval: 6 hours (in milliseconds)
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

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
  nextRunTime: null,
  isRunning: false,
  timerRef: null,
};

globalForScheduler.__productScheduler = schedulerState;

/**
 * Executes a single scheduled sync pass.
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
    schedulerState.nextRunTime = new Date(Date.now() + schedulerState.intervalMs).toISOString();
  }
}

/**
 * Starts or restarts the in-process background scheduler timer.
 */
export function startScheduler(intervalMs?: number) {
  if (intervalMs && intervalMs > 0) {
    schedulerState.intervalMs = intervalMs;
  }

  if (schedulerState.timerRef) {
    clearInterval(schedulerState.timerRef);
    schedulerState.timerRef = null;
  }

  schedulerState.enabled = true;
  schedulerState.nextRunTime = new Date(Date.now() + schedulerState.intervalMs).toISOString();

  schedulerState.timerRef = setInterval(() => {
    executeScheduledSync().catch((err) => {
      console.error("[Product Scheduler Interval Error]", err);
    });
  }, schedulerState.intervalMs);

  console.log(`[Product Scheduler] In-process scheduler started. Next run at ${schedulerState.nextRunTime} (every ${Math.round(schedulerState.intervalMs / (1000 * 60 * 60))}h).`);
}

/**
 * Returns current scheduler operational status.
 */
export function getSchedulerStatus() {
  return {
    enabled: schedulerState.enabled,
    isRunning: schedulerState.isRunning,
    intervalHours: Math.round(schedulerState.intervalMs / (1000 * 60 * 60)),
    intervalMs: schedulerState.intervalMs,
    lastRunTime: schedulerState.lastRunTime,
    nextRunTime: schedulerState.nextRunTime,
    lastReport: getLastSyncReport(),
  };
}

// Auto-start on server initialization if in Node environment
if (typeof window === "undefined" && !schedulerState.timerRef && process.env.NODE_ENV !== "test") {
  startScheduler();
}
