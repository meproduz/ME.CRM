// ─── Identidade visual por cliente ───────────────────────────────────────────
// Cada deploy (um por cliente, mesmo código-fonte) define essas variáveis no
// ambiente da Vercel. Sem elas, cai no branding padrão do Mp. CRM.

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || null;
export const BRAND_LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL || null;
export const BRAND_COLOR_PRIMARY = process.env.NEXT_PUBLIC_COLOR_PRIMARY || null;
export const BRAND_COLOR_SECONDARY = process.env.NEXT_PUBLIC_COLOR_SECONDARY || null;

export const HAS_CUSTOM_BRAND = Boolean(BRAND_NAME || BRAND_LOGO_URL);

function hexToRgbParts(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbParts(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hexToRgbTriplet(hex: string): string {
  return hexToRgbParts(hex).join(',');
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mistura a cor com branco (amount 0-1) — tom mais claro da mesma cor. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgbParts(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Mistura a cor com preto (amount 0-1) — tom mais escuro da mesma cor. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgbParts(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
