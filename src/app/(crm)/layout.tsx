'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CRMProvider, useCRM } from '@/store/crm-store';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { logger } from '@/lib/logger';
import { monitor } from '@/lib/monitor';
import { alertManager } from '@/lib/alerts';

function CRMInner({ children }: { children: React.ReactNode }) {
  const { dispatch } = useCRM();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [initError, setInitError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init(attempt = 1) {
      if (cancelled) return;
      const done = monitor.startTimer('crm.init');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alertManager.trackAuthFailure();
        logger.warn('auth.no_session', { metadata: { redirect: '/login' } });
        router.replace('/login');
        return;
      }

      logger.info('auth.session_ok', { userId: session.user.id });

      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios').select('*').eq('id', session.user.id).single();

      if (usuarioError || !usuario) {
        // Banco indisponível — tenta novamente até 3x com backoff
        if (attempt < 4 && !cancelled) {
          logger.warn('crm.init.retry', { metadata: { attempt, error: usuarioError?.message } });
          const delay = attempt * 2000; // 2s, 4s, 6s
          await new Promise((r) => setTimeout(r, delay));
          return init(attempt + 1);
        }
        // Após 3 tentativas, verifica se é problema de autenticação ou de banco
        if (usuarioError?.code === 'PGRST116' || !usuario) {
          logger.warn('auth.usuario_not_found', { userId: session.user.id });
          router.replace('/login');
          return;
        }
        throw usuarioError;
      }

      if (cancelled) return;
      setInitError(false);

      dispatch({ type: 'SET_USER', payload: {
        ...usuario,
        role: (usuario.perfil === 'gestor' || usuario.perfil === 'admin') ? 'admin' : 'vendedor',
      } });

      const { data: cliente } = await supabase
        .from('clientes').select('*').eq('id', usuario.cliente_id).single();
      if (cliente) dispatch({ type: 'SET_CLIENTE', payload: cliente });

      const { data: leads, count } = await supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('cliente_id', usuario.cliente_id)
        .order('created_at', { ascending: false })
        .range(0, 49);

      if (leads) {
        // Pré-carrega o último histórico de cada lead para stale detection
        let latestPerLead: Record<string, string> = {};
        if (leads.length > 0) {
          const ids = leads.map((l: { id: string }) => l.id);
          const { data: histData } = await supabase
            .from('leads_historico')
            .select('lead_id, descricao')
            .in('lead_id', ids)
            .order('created_at', { ascending: false });
          if (histData) {
            for (const h of histData as { lead_id: string; descricao: string }[]) {
              if (!latestPerLead[h.lead_id]) latestPerLead[h.lead_id] = h.descricao;
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatch({ type: 'SET_LEADS', payload: leads.map((l: any) => ({ ...l, hist: [], lastContact: latestPerLead[l.id] })) });
        dispatch({ type: 'SET_PAGINATION', payload: { page: 1, hasMore: leads.length === 50, totalCount: count ?? 0 } });
      }

      done({ userId: session.user.id, leadsCount: leads?.length ?? 0 });
      logger.info('crm.init.complete', {
        userId: session.user.id,
        clienteId: usuario.cliente_id,
        metadata: { leads_loaded: leads?.length ?? 0 },
      });
    }

    init().catch((err) => {
      if (!cancelled) {
        logger.exception('crm.init.fatal', err);
        setInitError(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        logger.info('auth.signed_out');
        router.replace('/login');
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [dispatch, router]);

  async function handleRetry() {
    setRetrying(true);
    setInitError(false);
    // Força reload completo da página pra reiniciar o init limpo
    window.location.reload();
  }

  // Tela de erro de conexão — exibida quando init() falha após todas as tentativas
  if (initError) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060608', fontFamily: 'Inter, sans-serif', padding: 24,
      }}>
        <div style={{
          maxWidth: 400, width: '100%',
          background: '#111118', border: '1px solid rgba(240,71,71,0.2)',
          borderRadius: 14, padding: '32px 28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(240,71,71,0.1)', border: '1px solid rgba(240,71,71,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 18px',
          }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EFEFEF', marginBottom: 8 }}>
            Problema de conexão
          </div>
          <div style={{ fontSize: 12, color: '#6E6E80', lineHeight: 1.6, marginBottom: 24 }}>
            Não foi possível conectar ao servidor. Isso pode ser uma instabilidade temporária.
            Aguarde alguns instantes e tente novamente.
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              width: '100%', padding: '11px',
              background: retrying ? 'rgba(201,162,39,0.3)' : 'var(--gold, #C9A227)',
              border: 'none', borderRadius: 8,
              color: '#080808', fontSize: 13, fontWeight: 700,
              cursor: retrying ? 'not-allowed' : 'pointer',
            }}
          >
            {retrying ? 'Reconectando…' : 'Tentar novamente'}
          </button>
          <button
            onClick={() => router.replace('/login')}
            style={{
              width: '100%', marginTop: 8, padding: '10px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#6E6E80', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Hamburger — rendered outside <aside> to avoid CSS transform inheritance on mobile */}
      <button
        className="mob-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Overlay — closes sidebar when tapping outside */}
      {mobileOpen && (
        <div className="mob-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="content">
        <div className="body" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {children}
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary context="crm-layout">
      <CRMProvider>
        <CRMInner>{children}</CRMInner>
      </CRMProvider>
    </ErrorBoundary>
  );
}
