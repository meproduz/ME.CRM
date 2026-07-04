'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function LoginPage() {
  const router  = useRouter();
  const [email,  setEmail]  = useState('');
  const [senha,  setSenha]  = useState('');
  const [erro,   setErro]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return; }
    router.push('/dashboard');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow — fundo */}
      <div style={{
        position: 'absolute', top: '-120px', right: '-120px',
        width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(201,162,39,0.12) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-80px',
        width: 360, height: 360,
        background: 'radial-gradient(circle, rgba(201,162,39,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(17,17,22,0.85)',
        border: '1px solid rgba(201,162,39,0.15)',
        borderRadius: 20,
        padding: '48px 40px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'slide-up 0.4s cubic-bezier(0.4,0,0.2,1) both',
      }}>

        {/* Linha dourada topo */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.5), transparent)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <div style={{
            width: 76, height: 76,
            borderRadius: 18,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 28px 6px rgba(201,162,39,0.35), 0 0 10px 2px rgba(201,162,39,0.2)',
          }}>
            <Image src="/logo-mp.png" alt="MP" fill style={{ objectFit: 'cover' }} sizes="76px" priority />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Comfortaa', sans-serif",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '-0.3px',
              color: 'var(--text)',
              lineHeight: 1,
            }}>
              Mp. <span style={{ color: 'var(--gold2)' }}>CRM</span>
            </div>
            <div style={{
              fontFamily: "'Comfortaa', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: 'var(--text3)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginTop: 6,
            }}>
              Acesse sua conta
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>
              E-MAIL
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }}
                width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="white" strokeWidth="1.3"/>
                <path d="M1 4.5l6 4 6-4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '12px 14px 12px 40px',
                  color: 'var(--text)',
                  fontSize: 13,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(201,162,39,0.45)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,162,39,0.08)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>
              SENHA
            </label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }}
                width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="white" strokeWidth="1.3"/>
                <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '12px 40px 12px 40px',
                  color: 'var(--text)',
                  fontSize: 13,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(201,162,39,0.45)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,162,39,0.08)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {/* Toggle mostrar senha */}
              <button type="button" onClick={() => setShowPw(p => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4,
                color: 'white', display: 'flex', alignItems: 'center',
              }}>
                {showPw ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="white" strokeWidth="1.3"/>
                    <circle cx="7" cy="7" r="1.8" stroke="white" strokeWidth="1.3"/>
                    <path d="M2 2l10 10" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="white" strokeWidth="1.3"/>
                    <circle cx="7" cy="7" r="1.8" stroke="white" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              background: 'rgba(240,71,71,0.08)',
              border: '1px solid rgba(240,71,71,0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--red)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 4v3M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {erro}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '13px',
              background: loading
                ? 'rgba(201,162,39,0.4)'
                : 'linear-gradient(135deg, #C9A227 0%, #E8BB3A 50%, #C9A227 100%)',
              backgroundSize: '200% 100%',
              border: 'none',
              borderRadius: 10,
              color: '#080808',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(201,162,39,0.35), 0 1px 0 rgba(255,255,255,0.15) inset',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Comfortaa', sans-serif",
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(201,162,39,0.5), 0 1px 0 rgba(255,255,255,0.15) inset';
                (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(201,162,39,0.35), 0 1px 0 rgba(255,255,255,0.15) inset';
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 28,
          fontFamily: "'Comfortaa', sans-serif",
          fontWeight: 300, fontSize: 10,
          color: 'var(--text3)',
          letterSpacing: '0.5px',
        }}>
          Me Produz. © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
