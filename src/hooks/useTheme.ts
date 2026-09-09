'use client';

import { useCallback, useState } from 'react';

// Preferência pessoal de exibição — por navegador (localStorage), não por
// conta: cada pessoa da equipe pode escolher o próprio tema sem afetar as
// outras. O <script> em src/app/layout.tsx já aplica o valor salvo antes do
// primeiro paint, pra não piscar escuro antes de trocar pro claro; o estado
// inicial aqui lê do mesmo lugar (inicializador lazy, não efeito) só pra o
// label do botão já nascer certo, sem precisar de um re-render extra.

const KEY = 'mp_theme';
export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(KEY) as Theme | null) ?? 'dark';
  });

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
