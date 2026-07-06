/**
 * Log Ingestion API — Rule #3 (logs estruturados JSON)
 * POST /api/logs
 *
 * Recebe logs do cliente (browser) e os re-emite no stdout do servidor.
 * Permite centralizar todos os logs (client + server) em um único stream —
 * compatível com Vercel Logs, Datadog, Logtail, etc.
 */

import { NextResponse } from 'next/server';
import type { LogEntry } from '@/lib/logger';

const MAX_PAYLOAD_BYTES = 8 * 1024; // 8KB por log entry
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

// Domínios autorizados a enviar logs (própria app)
const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL ?? '',
  'https://meproduz-dashboard.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean));

function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? '';
  // Em produção exige origin conhecida; em dev permite qualquer localhost
  if (process.env.NODE_ENV !== 'production') return true;
  return ALLOWED_ORIGINS.has(origin.replace(/\/$/, ''));
}

// ── Rate Limiter em memória — 30 req/min por IP ───────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 30;

interface RateEntry { count: number; windowStart: number }
const rateLimitMap = new Map<string, RateEntry>();
let cleanupCounter = 0;

function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Limpeza periódica para não vazar memória (a cada 200 requests)
  if (++cleanupCounter % 200 === 0) {
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.windowStart > RATE_WINDOW_MS * 2) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false; // permitido
  }
  if (entry.count >= RATE_MAX) return true; // bloqueado
  entry.count++;
  return false; // permitido
}

export async function POST(req: Request) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const ip = getIp(req);

  // Rejeita requests de origens não autorizadas (evita log pollution)
  if (!isOriginAllowed(req)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden' },
      { status: 403 }
    );
  }

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'rate_limit_exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const text = await req.text();

    // Rejeita payloads gigantes (proteção contra abuso)
    if (text.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'payload_too_large' },
        { status: 413 }
      );
    }

    let entry: Partial<LogEntry>;
    try {
      entry = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_json' },
        { status: 400 }
      );
    }

    // Valida campos obrigatórios
    if (!entry.level || !entry.event || !entry.timestamp) {
      return NextResponse.json(
        { ok: false, error: 'missing_required_fields: level, event, timestamp' },
        { status: 400 }
      );
    }

    if (!VALID_LEVELS.has(entry.level)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_level' },
        { status: 400 }
      );
    }

    // Re-emite como log estruturado do servidor (com fonte marcada como 'client')
    const serverEntry = {
      ...entry,
      source:      'client',
      received_at: new Date().toISOString(),
      server_req:  requestId,
    };

    const line = JSON.stringify(serverEntry);

    switch (entry.level) {
      case 'error': console.error(line); break;
      case 'warn':  console.warn(line);  break;
      default:      console.info(line);  break;
    }

    return NextResponse.json({ ok: true, requestId });
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level:     'error',
      event:     'logs.ingest_error',
      requestId,
      error: {
        message: err instanceof Error ? err.message : String(err),
        stack:   err instanceof Error ? err.stack   : undefined,
      },
    }));

    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 }
    );
  }
}
