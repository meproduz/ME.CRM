/**
 * DB Query Wrapper — Rule #5 (Query Logging com tempo de execução)
 * Toda operação no banco passa por aqui:
 * - Timing preciso com performance.now()
 * - Log estruturado de cada query
 * - Alerta automático para queries lentas
 * - Stack trace em erros
 */

import { logger } from './logger';
import { monitor } from './monitor';
import { alertManager } from './alerts';

const SLOW_QUERY_MS = 1500;

export interface QueryCtx {
  /** Nome da operação (ex: 'select', 'insert', 'update', 'delete') */
  operation: string;
  /** Tabela alvo */
  table: string;
  /** Request ID para rastreabilidade — Rule #1 */
  requestId?: string;
  /** ID do usuário que executou a query */
  userId?: string;
  /** ID do cliente (tenant) */
  clienteId?: string;
}

/**
 * Envolve uma query Supabase com logging, timing e alertas.
 * Retorno tipado como `any` intencionalmente — o propósito desta função
 * é MONITORAMENTO, não type-safety (que fica a cargo do caller).
 *
 * @example
 * const { data, error } = await dbQuery(
 *   { operation: 'select', table: 'leads', userId: user.id },
 *   () => supabase.from('leads').select('*').eq('cliente_id', cid)
 * )
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbQuery(ctx: QueryCtx, queryFn: () => any): Promise<any> {
  const done = monitor.startTimer(`db.${ctx.operation}.${ctx.table}`);
  const log = logger.withContext({
    requestId: ctx.requestId,
    userId:    ctx.userId,
    clienteId: ctx.clienteId,
  });

  try {
    // Promise.resolve() garante compatibilidade com qualquer PromiseLike (inclui Supabase builders)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await Promise.resolve(queryFn());
    const entry = done(
      { table: ctx.table, operation: ctx.operation },
      !result.error
    );

    if (result.error) {
      log.error('db.query.error', {
        metadata: {
          operation: ctx.operation,
          table: ctx.table,
          duration_ms: entry.duration,
          error: String(result.error),
        },
      });
    } else {
      log.debug('db.query.ok', {
        duration: entry.duration,
        metadata: { operation: ctx.operation, table: ctx.table },
      });
    }

    if (entry.duration > SLOW_QUERY_MS) {
      alertManager.trigger('slow_query', {
        ...ctx,
        duration_ms: entry.duration,
        threshold_ms: SLOW_QUERY_MS,
      });
    }

    return result;
  } catch (err) {
    done({ table: ctx.table, operation: ctx.operation }, false);
    log.exception('db.query.exception', err, {
      metadata: { operation: ctx.operation, table: ctx.table },
    });
    throw err;
  }
}
