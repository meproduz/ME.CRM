/**
 * Sistema de Alertas Configuráveis — Rule #9
 * Alertas para: slow query, auth failure, error rate, memory alta.
 * Webhook opcional para Slack / Discord / qualquer endpoint.
 */

import { logger } from './logger';

export type AlertType =
  | 'slow_query'
  | 'slow_operation'
  | 'error_rate_high'
  | 'auth_failure_spike'
  | 'memory_high'
  | 'operation_failed'
  | 'health_degraded';

export interface AlertConfig {
  /** Threshold em ms para slow query (padrão: 1500ms) */
  slow_query_ms: number;
  /** % de erros para disparar alerta de error rate (padrão: 25%) */
  error_rate_pct: number;
  /** Máximo de falhas de auth por minuto (padrão: 5) */
  auth_failures_per_min: number;
  /** Uso de memória JS em MB para alerta (padrão: 400MB) */
  memory_max_mb: number;
  /** URL de webhook para notificações externas (opcional) */
  webhook_url?: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  timestamp: string;
  severity: 'warning' | 'critical';
  metadata: Record<string, unknown>;
  resolved: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
  slow_query_ms:         1500,
  error_rate_pct:        25,
  auth_failures_per_min: 5,
  memory_max_mb:         400,
};

class AlertManager {
  private config: AlertConfig = { ...DEFAULT_CONFIG };
  private history: Alert[] = [];
  private authFailureTimestamps: number[] = [];

  // ── Configuração — Rule #9 (alertas configuráveis) ────────────────────────
  configure(cfg: Partial<AlertConfig>) {
    this.config = { ...this.config, ...cfg };
    logger.info('alerts.configured', { metadata: { config: this.config } });
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  // ── Trigger ───────────────────────────────────────────────────────────────
  trigger(type: AlertType, metadata: Record<string, unknown>): Alert {
    const severity: Alert['severity'] =
      type === 'auth_failure_spike' || type === 'health_degraded' || type === 'error_rate_high'
        ? 'critical'
        : 'warning';

    const alert: Alert = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      severity,
      metadata,
      resolved: false,
    };

    this.history.push(alert);
    if (this.history.length > 200) this.history.shift();

    logger.warn('alert.triggered', { metadata: { alert } });

    if (this.config.webhook_url) {
      this.dispatchWebhook(alert).catch(() => { /* silent */ });
    }

    return alert;
  }

  // ── Detecção: falhas de auth ───────────────────────────────────────────────
  trackAuthFailure() {
    const now = Date.now();
    this.authFailureTimestamps.push(now);
    // Mantém só os últimos 60 segundos
    this.authFailureTimestamps = this.authFailureTimestamps.filter(
      (t) => now - t < 60_000
    );

    if (this.authFailureTimestamps.length >= this.config.auth_failures_per_min) {
      this.trigger('auth_failure_spike', {
        count: this.authFailureTimestamps.length,
        threshold: this.config.auth_failures_per_min,
        window: '60s',
      });
    }
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  getHistory(limit = 50): Alert[] {
    return this.history.slice(-limit);
  }

  getUnresolved(): Alert[] {
    return this.history.filter((a) => !a.resolved);
  }

  resolve(id: string) {
    const alert = this.history.find((a) => a.id === id);
    if (alert) {
      alert.resolved = true;
      logger.info('alert.resolved', { metadata: { alertId: id, type: alert.type } });
    }
  }

  // ── Webhook ───────────────────────────────────────────────────────────────
  private async dispatchWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhook_url) return;
    await fetch(this.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'mp-crm',
        environment: process.env.NODE_ENV,
        alert,
      }),
      keepalive: true,
    });
  }
}

export const alertManager = new AlertManager();
