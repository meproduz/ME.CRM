'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'sidebar' | 'login';
}

export default function Logo({ variant = 'sidebar' }: LogoProps) {
  if (variant === 'login') return <LoginLogo />;
  return <SidebarLogo />;
}

function SidebarLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Avatar — logo M.p com esfumaçado dourado */}
      <div style={{
        width: 44, height: 44,
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 0 18px 4px rgba(201,162,39,0.35), 0 0 6px 1px rgba(201,162,39,0.2)',
      }}>
        <Image
          src="/logo-mp.png"
          alt="MP"
          fill
          style={{ objectFit: 'cover' }}
          sizes="44px"
          priority
        />
      </div>

      {/* Wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="logo-mp-bold">
          Mp. <span style={{ color: 'var(--gold2)' }}>CRM</span>
        </span>
      </div>
    </div>
  );
}

function LoginLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Avatar maior com esfumaçado dourado */}
      <div style={{
        width: 80, height: 80,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        boxShadow: '0 0 32px 8px rgba(201,162,39,0.4), 0 0 12px 2px rgba(201,162,39,0.25)',
      }}>
        <Image
          src="/logo-mp.png"
          alt="MP"
          fill
          style={{ objectFit: 'cover' }}
          sizes="80px"
          priority
        />
      </div>

      {/* Wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="logo-login-bold">
          Mp. <span style={{ color: 'var(--gold2)' }}>CRM</span>
        </span>
      </div>
    </div>
  );
}
