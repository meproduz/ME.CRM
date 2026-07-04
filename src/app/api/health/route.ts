/**
 * Health Check Endpoint — Rule #4 (Health Check com status detalhado)
 * GET /api/health
 *
 * Retorna status do sistema:
 * - Conectividade com o banco (Supabase)
 * - Latência do banco
 * - Uso de memória do servidor Node.js
 * - Versão e uptime da aplicação
 *
 * HTTP 200 = ok | HTTP 503 = degraded/down
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_START = Date.now();
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<{
  status: 'ok' | 'degraded' | 'down';
  latency_ms: number;
  error?: string;
}> {
  const t0 = performance.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    // Ping leve: só conta o header de resposta
    const { error } = await supabase.from('usuarios').select('id').limit(1);
    const latency_ms = Math.round(performance.now() - t0);
    return error
      ? { status: 'degraded', latency_ms, error: error.message }
      : { status: 'ok',       latency_ms };
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    };
  }
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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const isAuthorized =
    req.headers.get('x-metrics-key') === process.env.METRICS_SECRET &&
    !!process.env.METRICS_SECRET;

  const db = await checkDatabase();
  const allOk = db.status === 'ok';

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level:     allOk ? 'info' : 'warn',
    event:     'health.check',
    requestId,
    metadata:  { status: allOk ? 'ok' : 'degraded', db_status: db.status, db_latency_ms: db.latency_ms },
  }));

  // Sem chave: resposta mínima (para uptime monitors públicos)
  if (!isAuthorized) {
    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded' },
      { status: allOk ? 200 : 503 }
    );
  }

  // Com chave: resposta completa
  const body = {
    status:    allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    requestId,
    app: {
      name:       'mp-crm',
      version:    APP_VERSION,
      env:        process.env.NODE_ENV,
      uptime_ms:  Date.now() - APP_START,
    },
    checks: {
      database: db,
      memory:   getServerMemory(),
    },
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
