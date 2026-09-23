'use client';

/**
 * PERFORMANCE LAYER: In-memory cache for requestStore.ts
 *
 * Problem: Every call to getAllRequests() / getAllAccounts() / getAuditTrail()
 * re-parses JSON from localStorage synchronously, even if nothing has changed.
 * On pages like Admin, Collector, and RequestList, these functions are called
 * dozens of times per second (each useEffect, each render, each poll tick).
 *
 * Solution:
 * - Keep a single parsed in-memory copy (cache) per key.
 * - Invalidate the cache only when a write happens (setItem intercept) or
 *   when a BroadcastChannel message arrives from another tab.
 * - Export thin wrappers that components import instead of calling localStorage directly.
 */

type CacheKey = 'wastepickup_requests' | 'wastepickup_accounts' | 'wastepickup_admin_audit_trail' | 'wastepickup_notifications' | 'wastepickup_claimed_rewards';

const _cache: Partial<Record<CacheKey, { data: any[]; ts: number }>> = {};

/** Maximum age of a cache entry before it is considered stale (ms). */
const MAX_CACHE_AGE_MS = 2000;

export function readCached<T = any>(key: CacheKey, fallback: T[] = []): T[] {
  if (typeof window === 'undefined') return fallback;
  const entry = _cache[key];
  const now = Date.now();

  // Return cache if fresh
  if (entry && now - entry.ts < MAX_CACHE_AGE_MS) {
    return entry.data as T[];
  }

  // Cache miss or stale — read from localStorage
  try {
    const raw = localStorage.getItem(key);
    const data: T[] = raw ? JSON.parse(raw) : fallback;
    _cache[key] = { data, ts: now };
    return data;
  } catch {
    return fallback;
  }
}

export function writeCached<T = any>(key: CacheKey, data: T[]): void {
  if (typeof window === 'undefined') return;
  // Update in-memory cache immediately (no need to re-parse on next read)
  _cache[key] = { data, ts: Date.now() };
  localStorage.setItem(key, JSON.stringify(data));
}

/** Force-invalidate a cache entry (call after receiving a BroadcastChannel message). */
export function invalidateCache(key: CacheKey): void {
  delete _cache[key];
}

/** Invalidate all caches (e.g., after full data reset). */
export function invalidateAllCaches(): void {
  (Object.keys(_cache) as CacheKey[]).forEach((k) => delete _cache[k]);
}
