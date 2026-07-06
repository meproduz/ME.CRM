'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function LoginPage() {
  const router   = useRouter();
  const [email,   setEmail]   = useState('');
  const [senha,   setSenha]   = useState('');
  const [erro,    setErro]    = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusSenha, setFocusSenha] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return; }
    router.push('/dashboard');
  }

  const GOLD             = '#C9A227';
  const GOLD_GLOW        = 'rgba(201,162,39,0.45)';
  const INPUT_BG         = 'rgba(255,255,255,0.04)';
  const INPUT_BORDER     = 'rgba(255,255,255,0.09)';
  const INPUT_FOCUS_BG   = 'rgba(201,162,39,0.04)';
  const INPUT_FOCUS_BDR  = 'rgba(201,162,39,0.55)';
  const INPUT_FOCUS_SHD  = '0 0 0 3px rgba(201,162,39,0.10)';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 70% -10%, rgba(201,162,39,0.09) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at -10% 100%, rgba(201,162,39,0.05) 0%, transparent 60%), #060608',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'rgba(10,10,14,0.92)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 24,
        padding: '44px 36px 36px',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 0 0 1px rgba(201,162,39,0.08) inset, 0 0 80px rgba(0,0,0,0.6), 0 32px 64px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'slide-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
      }}>

        {/* Linha dourada topo */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: `linear-gradient(90deg, transparent, ${GOLD_GLOW}, transparent)`,
        }} />

        {/* Glow interno */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 220, height: 220,
          background: 'radial-gradient(circle, rgba(201,162,39,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Logo ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, overflow: 'hidden', position: 'relative',
            boxShadow: '0 0 0 1px rgba(201,162,39,0.22), 0 0 24px 6px rgba(201,162,39,0.28), 0 0 60px 12px rgba(201,162,39,0.10)',
          }}>
            <Image src="/logo-mp.png" alt="Mp." fill style={{ objectFit: 'cover' }} sizes="72px" priority />
          </div>

          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <div style={{ fontFamily: "'Comfortaa', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.2px', color: '#fff' }}>
              Mp. <span style={{ color: GOLD }}>CRM</span>
            </div>
            <div style={{
              fontFamily: "'Comfortaa', sans-serif", fontWeight: 300, fontSize: 10.5,
              color: 'rgba(255,255,255,0.28)', letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: 7,
            }}>
              Acesse sua conta
            </div>
          </div>
        </div>

        {/* ── Form ─────────────────────────────────────────────── */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* E-mail */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontWeight: 500, fontSize: 11,
              color: focusEmail ? 'rgba(201,162,39,0.85)' : 'rgba(255,255,255,0.35)',
              letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
              transition: 'color 0.2s', fontFamily: "'Inter', sans-serif",
            }}>E-mail</label>
            <div style={{
              position: 'relative', borderRadius: 12,
              background: focusEmail ? INPUT_FOCUS_BG : INPUT_BG,
              border: `1px solid ${focusEmail ? INPUT_FOCUS_BDR : INPUT_BORDER}`,
              boxShadow: focusEmail ? INPUT_FOCUS_SHD : 'none',
              transition: 'all 0.2s',
            }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1.5" y="3" width="12" height="9" rx="1.5" stroke={focusEmail ? GOLD : 'rgba(255,255,255,0.28)'} strokeWidth="1.2"/>
                <path d="M1.5 5.5L7.5 9l6-3.5" stroke={focusEmail ? GOLD : 'rgba(255,255,255,0.28)'} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="email" placeholder="seu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus
                onFocus={() => setFocusEmail(true)} onBlur={() => setFocusEmail(false)}
                style={{
                  width: '100%', background: 'transparent', border: 'none', borderRadius: 12,
                  padding: '13px 14px 13px 42px', color: '#fff', fontSize: 13.5,
                  fontFamily: "'Inter', sans-serif", fontWeight: 400, letterSpacing: '0.1px',
                  boxSizing: 'border-box' as const, caretColor: GOLD,
                }}
              />
            </div>
          </div>

          {/* Senha */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontWeight: 500, fontSize: 11,
              color: focusSenha ? 'rgba(201,162,39,0.85)' : 'rgba(255,255,255,0.35)',
              letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
              transition: 'color 0.2s', fontFamily: "'Inter', sans-serif",
            }}>Senha</label>
            <div style={{
              position: 'relative', borderRadius: 12,
              background: focusSenha ? INPUT_FOCUS_BG : INPUT_BG,
              border: `1px solid ${focusSenha ? INPUT_FOCUS_BDR : INPUT_BORDER}`,
              boxShadow: focusSenha ? INPUT_FOCUS_SHD : 'none',
              transition: 'all 0.2s',
            }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2.5" y="6.5" width="9" height="6" rx="1.5" stroke={focusSenha ? GOLD : 'rgba(255,255,255,0.28)'} strokeWidth="1.2"/>
                <path d="M4.5 6.5V4.5a2.5 2.5 0 015 0V6.5" stroke={focusSenha ? GOLD : 'rgba(255,255,255,0.28)'} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type={showPw ? 'text' : 'password'} placeholder="••••••••" value={senha}
                onChange={e => setSenha(e.target.value)} required
                onFocus={() => setFocusSenha(true)} onBlur={() => setFocusSenha(false)}
                style={{
                  width: '100%', background: 'transparent', border: 'none', borderRadius: 12,
                  padding: '13px 44px 13px 42px', color: '#fff', fontSize: 13.5,
                  fontFamily: "'Inter', sans-serif", fontWeight: 400,
                  letterSpacing: showPw ? '0.1px' : '3px',
                  boxSizing: 'border-box' as const, caretColor: GOLD,
                }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: '4px 6px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                opacity: showPw ? 0.65 : 0.28, transition: 'opacity 0.2s', color: '#fff',
              }}>
                {showPw ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M1 7.5s2.5-4.5 6.5-4.5S14 7.5 14 7.5s-2.5 4.5-6.5 4.5S1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2"/>
                    <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M2 2l11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M1 7.5s2.5-4.5 6.5-4.5S14 7.5 14 7.5s-2.5 4.5-6.5 4.5S1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2"/>
                    <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              marginBottom: 16, background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 9,
              animation: 'slide-up 0.25s ease both',
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="6.5" cy="6.5" r="5.5" stroke="#EF4444" strokeWidth="1.2"/>
                <path d="M6.5 4v3.2M6.5 9.2v.3" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, color: '#EF4444', fontFamily: "'Inter', sans-serif" }}>{erro}</span>
            </div>
          )}

          {/* Botão */}
          <button
            ref={btnRef}
            type="submit"
            disabled={loading}
            onMouseEnter={() => {
              if (!loading && btnRef.current) {
                btnRef.current.style.transform = 'translateY(-1px)';
                btnRef.current.style.boxShadow = '0 8px 32px rgba(201,162,39,0.45), 0 1px 0 rgba(255,255,255,0.18) inset';
              }
            }}
            onMouseLeave={() => {
              if (btnRef.current) {
                btnRef.current.style.transform = 'translateY(0)';
                btnRef.current.style.boxShadow = '0 4px 20px rgba(201,162,39,0.28), 0 1px 0 rgba(255,255,255,0.12) inset';
              }
            }}
            style={{
              width: '100%', padding: '14px',
              background: loading
                ? 'rgba(201,162,39,0.35)'
                : 'linear-gradient(135deg, #B8901F 0%, #DDB035 40%, #E8BB3A 60%, #C9A227 100%)',
              border: 'none', borderRadius: 12,
              color: loading ? 'rgba(0,0,0,0.45)' : '#07050A',
              fontSize: 13.5, fontWeight: 700,
              fontFamily: "'Comfortaa', sans-serif", letterSpacing: '0.3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.18s, box-shadow 0.18s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(201,162,39,0.28), 0 1px 0 rgba(255,255,255,0.12) inset',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Shimmer sweep */}
            {!loading && (
              <div style={{
                position: 'absolute', top: 0, left: '-100%', width: '55%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                animation: 'shimmer 3s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg style={{ animation: 'spin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5"/>
                  <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Entrando…
              </span>
            ) : 'Entrar'}
          </button>
        </form>

        {/* Rodapé */}
        <div style={{
          textAlign: 'center', marginTop: 28,
          fontFamily: "'Comfortaa', sans-serif", fontWeight: 300, fontSize: 10,
          color: 'rgba(255,255,255,0.16)', letterSpacing: '0.8px',
        }}>
          Me Produz. © {new Date().getFullYear()}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { left:-100%; } 55% { left:150%; } 100% { left:150%; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
