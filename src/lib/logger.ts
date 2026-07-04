/**
 * Structured JSON Logger — Rule #3
 * Todo log é JSON estruturado com: timestamp, level, event, requestId.
 * Todo erro inclui stack trace completo — Rule #2.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  userId?: string;
  clienteId?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MIN_LEVEL: LogLevel =
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'production')
    ? 'info'
    : 'debug';

export function serializeError(err: unknown): LogEntry['error'] {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code: (err as any).code as string | undefined,
    };
  }
  if (typeof err === 'object' && err !== null) {
    return { message: JSON.stringify(err) };
  }
  return { message: String(err) };
}

class Logger {
  private ctx: Partial<LogEntry> = {};

  /** Cria um logger filho com contexto adicional (ex: requestId, userId) */
  withContext(ctx: Partial<LogEntry>): Logger {
    const child = new Logger();
    child.ctx = { ...this.ctx, ...ctx };
    return child;
  }

  private write(level: LogLevel, event: string, meta?: Partial<LogEntry>) {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...this.ctx,
      ...meta,
    };

    const line = JSON.stringify(entry);

    // Sempre JSON estruturado — nunca texto livre
    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info':  console.info(line);  break;
      case 'warn':  console.warn(line);  break;
      case 'error': console.error(line); break;
    }

    // Ship para /api/logs em produção (fire-and-forget, nunca quebra a app)
    if (typeof window !== 'undefined' && level !== 'debug') {
      shipLog(entry).catch(() => { /* silent fail */ });
    }
  }

  debug(event: string, meta?: Partial<LogEntry>) { this.write('debug', event, meta); }
  info (event: string, meta?: Partial<LogEntry>) { this.write('info',  event, meta); }
  warn (event: string, meta?: Partial<LogEntry>) { this.write('warn',  event, meta); }
  error(event: string, meta?: Partial<LogEntry>) { this.write('error', event, meta); }

  /** Loga erro com stack trace completo — Rule #2 */
  exception(event: string, err: unknown, meta?: Partial<LogEntry>) {
    this.write('error', event, {
      ...meta,
      error: serializeError(err),
    });
  }
}

// Envia log estruturado para o servidor (client-side only)
async function shipLog(entry: LogEntry): Promise<void> {
  await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true, // sobrevive ao unload da página
  });
}

export const logger = new Logger();
