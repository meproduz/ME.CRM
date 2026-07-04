/**
 * Monitor de Performance — Rule #7 (tempo, memória)
 * Rule #6 — Cache Hit/Miss Tracking
 * Ring buffer de 500 entradas para operações recentes.
 */

import { logger } from './logger';

export interface PerfEntry {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

interface Counters {
  totalOps: number;
  totalErrors: number;
  totalSlowOps: number;
  totalCacheHits: number;
  totalCacheMisses: number;
}

interface CacheStat {
  hits: number;
  misses: number;
}

const SLOW_OP_MS = 1500; // operações acima disso são "lentas"
const RING_BUFFER = 500;

class Monitor {
  private entries: PerfEntry[] = [];
  private counters: Counters = {
    totalOps: 0,
    totalErrors: 0,
    totalSlowOps: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
  };
  private cacheStats: Record<string, CacheStat> = {};
  private readonly startedAt = Date.now();

  // ── Timing ────────────────────────────────────────────────────────────────
  /**
   * Inicia um timer. Chame a função retornada quando a operação terminar.
   * @returns done(metadata?, success?) → PerfEntry
   */
  startTimer(operation: string) {
    const t0 = performance.now();
    this.counters.totalOps++;

    return (metadata?: Record<string, unknown>, success = true): PerfEntry => {
      const duration = Math.round(performance.now() - t0);
      const entry: PerfEntry = {
        operation,
        duration,
        timestamp: new Date().toISOString(),
        success,
        metadata,
      };

      // Ring buffer
      this.entries.push(entry);
      if (this.entries.length > RING_BUFFER) this.entries.shift();

      if (!success) this.counters.totalErrors++;

      if (duration > SLOW_OP_MS) {
        this.counters.totalSlowOps++;
        logger.warn('monitor.slow_operation', {
          metadata: { operation, duration, threshold_ms: SLOW_OP_MS },
        });
      }

      return entry;
    };
  }

  // ── Cache Hit/Miss — Rule #6 ──────────────────────────────────────────────
  cacheHit(key: string) {
    this.counters.totalCacheHits++;
    if (!this.cacheStats[key]) this.cacheStats[key] = { hits: 0, misses: 0 };
    this.cacheStats[key].hits++;
    logger.debug('cache.hit', { metadata: { key } });
  }

  cacheMiss(key: string) {
    this.counters.totalCacheMisses++;
    if (!this.cacheStats[key]) this.cacheStats[key] = { hits: 0, misses: 0 };
    this.cacheStats[key].misses++;
    logger.debug('cache.miss', { metadata: { key } });
  }

  getCacheHitRate(key?: string): number {
    if (key) {
      const s = this.cacheStats[key];
      if (!s) return 0;
      const total = s.hits + s.misses;
      return total === 0 ? 0 : Math.round((s.hits / total) * 100);
    }
    const total = this.counters.totalCacheHits + this.counters.totalCacheMisses;
    return total === 0 ? 0 : Math.round((this.counters.totalCacheHits / total) * 100);
  }

  // ── Memória — Rule #7 ─────────────────────────────────────────────────────
  getMemoryUsage(): Record<string, string> | null {
    if (typeof performance === 'undefined') return null;
    // Chrome Performance Memory API (não standard, mas disponível em Chromium)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (performance as any).memory as
      | { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
      | undefined;
    if (!mem) return null;
    return {
      used:  fmt(mem.usedJSHeapSize),
      total: fmt(mem.totalJSHeapSize),
      limit: fmt(mem.jsHeapSizeLimit),
    };
  }

  // ── Snapshot para /api/metrics ────────────────────────────────────────────
  getSnapshot() {
    const recent = this.entries.slice(-50);
    const avgMs = recent.length
      ? Math.round(recent.reduce((a, e) => a + e.duration, 0) / recent.length)
      : 0;

    return {
      uptime_ms:        Date.now() - this.startedAt,
      counters:         this.counters,
      cache_hit_rate:   this.getCacheHitRate(),
      cache_by_key:     this.cacheStats,
      avg_op_ms:        avgMs,
      memory:           this.getMemoryUsage(),
      recent_ops:       recent.slice(-10),
    };
  }
}

function fmt(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export const monitor = new Monitor();
