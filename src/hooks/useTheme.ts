'use client';

import { useCallback, useEffect, useState } from 'react';

// Preferência pessoal de exibição — por navegador (localStorage), não por
// conta: cada pessoa da equipe pode escolher o próprio tema sem afetar as
// outras. O <Script> em src/app/layout.tsx já aplica o valor salvo na tag
// <html> antes do primeiro paint, pra a página não piscar escuro antes de
// trocar pro claro.
//
// O estado aqui nasce sempre 'dark' (igual ao que o servidor renderiza,
// que não tem acesso a localStorage) e só é corrigido depois de montado —
// se nascesse já lendo localStorage, o texto/ícone do botão poderiam vir
// diferentes entre o HTML do servidor e o do navegador, e o React trata
// isso como erro de hidratação (a página toda seria re-renderizada do
// zero no cliente). Ler depois do mount evita esse mismatch: a correção
// acontece como uma atualização normal de estado, não durante a hidratação.

const KEY = 'mp_theme';
export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? 'dark';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage após o mount, de propósito (ver comentário acima)
    setTheme(saved);
  }, []);

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
