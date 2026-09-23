'use client';

import { readCached, writeCached } from '@/lib/requestStoreCache';

/**
 * LOG TYPES
 * These represent the entities in our administrative "database"
 */
export interface SystemLog {
  id: string;
  action: string;
  timestamp: string;
  performedBy: string;
  details: any;
  type: 'info' | 'warning' | 'error' | 'success';
}

const ADMIN_DB_KEY = 'wastepickup_admin_audit_trail';

/**
 * THE "SEPARATE DATABASE" SERVICE
 */
export const AdminBackendService = {
  /**
   * Fetch all data from the administrative audit table
   */
  getAuditTrail: (): SystemLog[] => {
    return readCached<SystemLog>('wastepickup_admin_audit_trail');
  },

  /**
   * Commits a new log to the administrative database
   */
  logAction: (log: Omit<SystemLog, 'id' | 'timestamp'>): void => {
    if (typeof window === 'undefined') return;
    const history = AdminBackendService.getAuditTrail();
    const newEntry: SystemLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [newEntry, ...history].slice(0, 1000);
    writeCached('wastepickup_admin_audit_trail', updatedHistory);
    // Dispatch a storage event so other tabs pick up changes via the storageListener below
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: ADMIN_DB_KEY }));
    } catch { /* ignore */ }
  },

  /**
   * Nuclear option: Clears the entire admin database
   */
  purgeDatabase: (): void => {
    if (typeof window === 'undefined') return;
    writeCached('wastepickup_admin_audit_trail', []);
  },

  /**
   * Export database to JSON (Simulating a DB Dump)
   */
  dumpDatabase: (): string => {
    const data = AdminBackendService.getAuditTrail();
    return JSON.stringify(data, null, 2);
  },

  /**
   * Subscribe to live database changes
   */
  subscribeToLiveStream: (callback: (entry: SystemLog) => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};
    // Listen for storage events fired by logAction (cross-tab) or same-tab writes
    const handler = () => {
      const latest = AdminBackendService.getAuditTrail();
      if (latest.length > 0) callback(latest[0]);
    };
    window.addEventListener('storage', handler);
    // Also listen via BroadcastChannel for cross-tab (non-storage-event) updates
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('admin_realtime_db');
      channel.onmessage = (e) => {
        if (e.data.type === 'DB_COMMIT') callback(e.data.entry);
      };
    } catch { /* BroadcastChannel not supported */ }
    return () => {
      window.removeEventListener('storage', handler);
      channel?.close();
    };
  },
};
