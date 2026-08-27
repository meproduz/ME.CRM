'use client';

import Image from 'next/image';
import { BRAND_NAME, BRAND_LOGO_URL, BRAND_COLOR_PRIMARY, hexToRgba } from '@/lib/brand';

interface LogoProps {
  variant?: 'sidebar' | 'login';
}

export default function Logo({ variant = 'sidebar' }: LogoProps) {
  if (variant === 'login') return <LoginLogo />;
  return <SidebarLogo />;
}

const GLOW = BRAND_COLOR_PRIMARY ? hexToRgba(BRAND_COLOR_PRIMARY, 0.35) : 'rgba(201,162,39,0.35)';
const GLOW_SOFT = BRAND_COLOR_PRIMARY ? hexToRgba(BRAND_COLOR_PRIMARY, 0.2) : 'rgba(201,162,39,0.2)';

function SidebarLogo() {
  if (BRAND_LOGO_URL) {
    return (
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 98, aspectRatio: '1 / 1',
        borderRadius: 18, overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 16px 26px -10px rgba(0,0,0,0.65)',
      }}>
        <Image
          src={BRAND_LOGO_URL}
          alt={BRAND_NAME ?? 'Logo'}
          fill
          style={{ objectFit: 'cover' }}
          sizes="128px"
          priority
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Avatar — logo M.p com esfumaçado dourado */}
      <div style={{
        width: 44, height: 44,
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        boxShadow: `0 0 18px 4px ${GLOW}, 0 0 6px 1px ${GLOW_SOFT}`,
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
  if (BRAND_LOGO_URL) {
    return (
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 153, aspectRatio: '1 / 1',
        borderRadius: 24, overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 24px 40px -12px rgba(0,0,0,0.7)',
      }}>
        <Image
          src={BRAND_LOGO_URL}
          alt={BRAND_NAME ?? 'Logo'}
          fill
          style={{ objectFit: 'cover' }}
          sizes="180px"
          priority
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Avatar maior com esfumaçado dourado */}
      <div style={{
        width: 80, height: 80,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        boxShadow: `0 0 32px 8px ${hexToRgba(BRAND_COLOR_PRIMARY ?? '#C9A227', 0.4)}, 0 0 12px 2px ${hexToRgba(BRAND_COLOR_PRIMARY ?? '#C9A227', 0.25)}`,
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
