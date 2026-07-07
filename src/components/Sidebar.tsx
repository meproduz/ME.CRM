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

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useCRM();

  const urgentes = state.leads.filter(
    (l) => l.status === 'novo' || isStale(l.hist, l.data, l.status)
  ).length;

  const followupsVencidos = state.leads.filter((l) => {
    if (!l.followup || l.status === 'fechado' || l.status === 'perdido') return false;
    const [d, mo, y] = (l.followup ?? '').split('/').map(Number);
    if (!d || !mo || !y) return false;
    const fuDate = new Date(y, mo - 1, d);
    fuDate.setHours(23, 59, 59, 0);
    return fuDate < new Date();
  }).length;

  const totalAlertas = urgentes + followupsVencidos;

  const userInitials = (state.currentUser?.nome ?? 'MP')
    .split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  function handleNav(href: string) {
    router.push(href);
    onMobileClose?.();
  }

  async function handleLogout() {
    if (!confirm('Sair do sistema?')) return;
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <aside className={`sidebar${mobileOpen ? ' mob-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo" onClick={() => handleNav('/dashboard')} style={{ cursor: 'pointer' }}>
        <Logo variant="sidebar" />
      </div>

      {/* Nav */}
      <div className="nav-section">
        {NAV_VENDEDOR.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const badgeCount =
            item.href === '/pipeline' ? urgentes :
            item.href === '/dashboard' ? followupsVencidos : 0;
          return (
            <div
              key={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => handleNav(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {badgeCount > 0 && (
                <span className="nav-badge" style={{ display: 'block',
                  background: item.href === '/dashboard' ? '#F97316' : undefined,
                }}>{badgeCount}</span>
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
                  onClick={() => handleNav(item.href)}
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
        {totalAlertas > 0 && (
          <div style={{
            margin: '0 10px 8px', padding: '8px 12px', borderRadius: 10,
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }} onClick={() => handleNav('/dashboard')}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', background: '#F97316',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>{totalAlertas}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316' }}>
                {totalAlertas} alerta{totalAlertas > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1.3 }}>
                {urgentes > 0 && `${urgentes} urgente${urgentes > 1 ? 's' : ''}`}
                {urgentes > 0 && followupsVencidos > 0 && ' · '}
                {followupsVencidos > 0 && `${followupsVencidos} FU vencido${followupsVencidos > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        )}
        <div
          className={`nav-item${pathname === '/configuracoes' ? ' active' : ''}`}
          onClick={() => handleNav('/configuracoes')}
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
