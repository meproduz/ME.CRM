/**
 * Métricas de Performance — Rule #7 (tempo, memória, CPU)
 * GET /api/metrics
 *
 * Snapshot instantâneo das métricas do servidor Node.js:
 * - Uptime e versão
 * - Uso de memória (RSS, heap)
 * - Versão do Node
 * - Variáveis de ambiente de contexto (sem secrets)
 */

import { NextResponse } from 'next/server';

const APP_START = Date.now();

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function getServerMemory() {
  try {
    const m = process.memoryUsage();
    return {
      rss_mb:        Math.round(m.rss       / 1048576),
      heap_used_mb:  Math.round(m.heapUsed  / 1048576),
      heap_total_mb: Math.round(m.heapTotal / 1048576),
      external_mb:   Math.round(m.external  / 1048576),
    };
  } catch {
    return null;
  }
}

function isAuthorized(req: Request): boolean {
  const provided = req.headers.get('x-metrics-key');
  const secret   = process.env.METRICS_SECRET;
  return !!secret && provided === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const uptime_ms = Date.now() - APP_START;

  const metrics = {
    timestamp:    new Date().toISOString(),
    requestId,
    app: {
      name:         'mp-crm',
      version:      process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
      env:          process.env.NODE_ENV ?? 'development',
      uptime_ms,
      uptime_human: formatUptime(uptime_ms),
    },
    runtime: {
      node_version: process.version,
      platform:     process.platform,
      arch:         process.arch,
    },
    memory: getServerMemory(),
  };

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level:     'info',
    event:     'metrics.requested',
    requestId,
    metadata:  { uptime_ms, memory: metrics.memory },
  }));

  return NextResponse.json(metrics);
}
