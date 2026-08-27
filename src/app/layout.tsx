import type { Metadata } from 'next';
import './globals.css';
import { BRAND_NAME, BRAND_COLOR_SECONDARY, hexToRgbTriplet, tint, shade } from '@/lib/brand';

export const metadata: Metadata = {
  title: BRAND_NAME ? `${BRAND_NAME} — CRM` : 'MP. CRM — Me Produz.',
  description: BRAND_NAME ? `CRM de vendas — ${BRAND_NAME}` : 'CRM de vendas da Me Produz.',
};

// A UI inteira usa só a cor SECUNDÁRIA da marca (a menos "de alerta"/saturada das
// duas), em variações de tom — nunca a cor PRIMÁRIA. Isso evita colidir com o
// vermelho semântico de erro/urgente/remover já usado no sistema, e mantém
// qualquer tom "de alerta" da marca restrito à logo (imagem), não à interface.
const BASE = BRAND_COLOR_SECONDARY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        {BASE && (
          <style>{`:root {
            --gold: ${BASE}; --accent: ${BASE};
            --gold2: ${tint(BASE, 0.25)}; --gold3: ${shade(BASE, 0.35)};
            --accent2: ${shade(BASE, 0.2)};
            --gold-rgb: ${hexToRgbTriplet(BASE)};
          }`}</style>
        )}
      </head>
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
