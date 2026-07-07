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

  useEffect(() => {
    async function init() {
      const done = monitor.startTimer('crm.init');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alertManager.trackAuthFailure();
        logger.warn('auth.no_session', { metadata: { redirect: '/login' } });
        router.replace('/login');
        return;
      }

      logger.info('auth.session_ok', { userId: session.user.id });

      const { data: usuario } = await supabase
        .from('usuarios').select('*').eq('id', session.user.id).single();
      if (!usuario) {
        logger.warn('auth.usuario_not_found', { userId: session.user.id });
        router.replace('/login');
        return;
      }
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
        dispatch({ type: 'SET_LEADS', payload: leads.map((l) => ({ ...l, hist: [] })) });
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
      logger.exception('crm.init.fatal', err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        logger.info('auth.signed_out');
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [dispatch, router]);

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
