/**
 * Edge Middleware — Rule #1 (Request ID único e rastreável)
 * Executado antes de TODA request. Injeta:
 *   x-request-id   → UUID v4 único por request
 *   x-response-time → tempo de processamento em ms
 * Adiciona security headers em todas as respostas.
 * Loga acesso estruturado em JSON para cada request.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CSP: restringe de onde o browser pode carregar recursos
// connect-src inclui Supabase (REST + Realtime via WebSocket)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // Propaga o requestId para os headers da request (lido pelos handlers)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Request tracing ───────────────────────────────────────────────────────
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${Date.now() - startedAt}ms`);

  // ── Security headers ──────────────────────────────────────────────────────
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Log de acesso estruturado JSON — Rule #3
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'http.request',
    requestId,
    metadata: {
      method:    request.method,
      pathname:  request.nextUrl.pathname,
      ua:        request.headers.get('user-agent')?.slice(0, 120) ?? null,
      referer:   request.headers.get('referer') ?? null,
    },
  }));

  return response;
}

export const config = {
  matcher: [
    // Processa tudo EXCETO assets estáticos e _next internals
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
