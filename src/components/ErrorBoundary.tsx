'use client';

/**
 * Error Boundary — Rule #2 (Stack Trace completo com texto)
 * Captura erros de render do React antes que quebrem toda a UI.
 * Loga o erro com stack trace completo via logger estruturado.
 * Exibe fallback elegante com error ID para rastreabilidade.
 */

import React from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: React.ReactNode;
  /** Componente de fallback customizado (opcional) */
  fallback?: React.ReactNode;
  /** Contexto para identificar onde o erro ocorreu nos logs */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Gera ID único para rastrear o erro nos logs
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Rule #2: log com stack trace completo
    logger.exception('react.render_error', error, {
      metadata: {
        errorId:        this.state.errorId,
        context:        this.props.context ?? 'unknown',
        componentStack: info.componentStack?.slice(0, 3000),
      },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, errorId } = this.state;
    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#060608',
        padding: 24,
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: '#111118',
          border: '1px solid rgba(240,71,71,0.2)',
          borderRadius: 14,
          padding: '32px 28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40,
              borderRadius: '50%',
              background: 'rgba(240,71,71,0.1)',
              border: '1px solid rgba(240,71,71,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              ⚠️
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#EFEFEF' }}>
                Algo deu errado
              </div>
              <div style={{ fontSize: 10, color: '#44444F', marginTop: 2, fontFamily: 'monospace' }}>
                {errorId}
              </div>
            </div>
          </div>

          {/* Error message */}
          <div style={{
            background: 'rgba(240,71,71,0.06)',
            border: '1px solid rgba(240,71,71,0.15)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 20,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#F04747',
            lineHeight: 1.6,
            wordBreak: 'break-all',
          }}>
            {error?.message ?? 'Erro desconhecido'}
          </div>

          {/* Stack trace — apenas em desenvolvimento */}
          {isDev && error?.stack && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{
                fontSize: 10,
                color: '#44444F',
                cursor: 'pointer',
                marginBottom: 8,
                userSelect: 'none',
              }}>
                Stack trace (dev only)
              </summary>
              <pre style={{
                fontSize: 9,
                color: '#555560',
                lineHeight: 1.6,
                overflow: 'auto',
                maxHeight: 220,
                whiteSpace: 'pre-wrap',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
                padding: '8px 10px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                {error.stack}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={this.handleRetry}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(201,162,39,0.1)',
                border: '1px solid rgba(201,162,39,0.25)',
                borderRadius: 8,
                color: '#E8BB3A',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                color: '#888896',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Dashboard
            </button>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 20,
            fontSize: 10,
            color: '#2A2A35',
            textAlign: 'center',
          }}>
            O erro foi registrado automaticamente · {errorId}
          </div>
        </div>
      </div>
    );
  }
}

/** HOC helper: envolve um componente com ErrorBoundary */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary context={context}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
