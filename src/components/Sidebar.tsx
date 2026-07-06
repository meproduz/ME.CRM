'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCRM } from '@/store/crm-store';
import { isStale } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

const NAV_VENDEDOR = [
  {
    href: '/dashboard', label: 'Dashboard',
    icon: <svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><rect x="1" y="1" width="7" height="7" rx="1.5"/><rect x="10" y="1" width="7" height="7" rx="1.5"/><rect x="1" y="10" width="7" height="7" rx="1.5"/><rect x="10" y="10" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    href: '/pipeline', label: 'Pipeline', badge: true,
    icon: <svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><rect x="1" y="3" width="4" height="12" rx="1.5"/><rect x="7" y="6" width="4" height="9" rx="1.5"/><rect x="13" y="8" width="4" height="7" rx="1.5"/></svg>,
  },
  {
    href: '/clientes', label: 'Clientes',
    icon: <svg viewBox="0 0 18 18" fill="none" width="18" height="18"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 15c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 8l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: '/relatorios', label: 'Relatórios',
    icon: <svg viewBox="0 0 18 18" fill="none" width="18" height="18"><path d="M2 14V8M6 14V5M10 14V9M14 14V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  },
  {
    href: '/leads', label: 'Leads',
    icon: <svg viewBox="0 0 18 18" fill="none" width="18" height="18"><path d="M2 5h14M2 9h9M2 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
];

const NAV_ADMIN_EXTRA = [
  {
    href: '/gestor', label: 'Painel Gestor',
    icon: <svg viewBox="0 0 18 18" fill="none" width="18" height="18"><circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    gold: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useCRM();

  const urgentes = state.leads.filter(
    (l) => l.status === 'novo' || isStale(l.hist, l.data, l.status)
  ).length;

  const userInitials = (state.currentUser?.nome ?? 'MP')
    .split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  async function handleLogout() {
    if (!confirm('Sair do sistema?')) return;
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
        <Logo variant="sidebar" />
      </div>

      {/* Nav */}
      <div className="nav-section">
        {NAV_VENDEDOR.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <div
              key={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {item.badge && urgentes > 0 && (
                <span className="nav-badge" style={{ display: 'block' }}>{urgentes}</span>
              )}
            </div>
          );
        })}

        {state.currentUser?.role === 'admin' && (
          <>
            <div className="nav-divider" style={{ margin: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            {NAV_ADMIN_EXTRA.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              return (
                <div
                  key={item.href}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  onClick={() => router.push(item.href)}
                  style={item.gold ? {
                    color: 'var(--gold)',
                    borderColor: isActive ? 'rgba(212,175,55,0.3)' : 'transparent',
                  } : undefined}
                >
                  <span className="nav-icon" style={item.gold ? { color: 'var(--gold)' } : undefined}>
                    {item.icon}
                  </span>
                  <span className="nav-text" style={item.gold ? { color: 'var(--gold)', fontWeight: 600 } : undefined}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <div
          className={`nav-item${pathname === '/configuracoes' ? ' active' : ''}`}
          onClick={() => router.push('/configuracoes')}
          style={{ border: '1px solid transparent' }}
        >
          <span className="nav-icon">
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
              <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="nav-text" style={{ fontSize: '12px', color: 'var(--text3)' }}>Configurações</span>
        </div>

        <div className="user-info" onClick={handleLogout}>
          <div className="user-av">{userInitials}</div>
          <div>
            <div className="user-name">{state.currentUser?.nome ?? 'Carregando...'}</div>
            <div className="user-role">{state.currentUser?.role === 'admin' ? 'Gestor' : 'Vendedor'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
