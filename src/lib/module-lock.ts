// In-memory module lock to prevent concurrent orchestrator runs for the same module.
//
// Assumption: single Node.js process (next dev / next start).
// If the app moves to serverless or worker threads, this needs to be replaced
// with a database-level lock (e.g., Postgres advisory lock or a processing flag).

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — stale lock threshold

const activeLocks = new Map<string, number>();

export function acquireModuleLock(moduleId: string): boolean {
  const existing = activeLocks.get(moduleId);

  if (existing !== undefined) {
    // If the lock is older than the TTL, treat it as stale (e.g., OpenAI hung)
    if (Date.now() - existing < LOCK_TTL_MS) {
      return false; // Legitimately locked
    }
    // Stale — fall through and steal it
  }

  activeLocks.set(moduleId, Date.now());
  return true;
}

export function releaseModuleLock(moduleId: string): void {
  activeLocks.delete(moduleId);
}
