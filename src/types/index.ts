// ─── Tipos principais do Mp. CRM ─────────────────────────────────────────────

export type LeadStatus =
  | 'novo'
  | 'contato'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido';

export type LeadOrigem =
  | 'Instagram Ads'
  | 'Facebook Ads'
  | 'Google Ads'
  | 'WhatsApp Ads'
  | 'Instagram Orgânico'
  | 'Facebook Orgânico'
  | 'WhatsApp Direto'
  | 'Indicação'
  | 'Prospecção Ativa'
  | 'Landing Page'
  | 'Site / SEO'
  | 'Outro';

export interface Lead {
  id: string;
  cliente_id: string;
  nome: string;
  tel: string | null;
  email: string | null;
  seg: string | null;
  orig: string | null;
  status: LeadStatus;
  int: string | null;
  valor: number | null;
  data?: string;   // DD/MM — pode não existir no banco; use leadData() para exibir
  hora?: string;   // HH:MM — pode não existir no banco; use leadHora() para exibir
  obs: string | null;
  followup: string | null;
  score: number | null;
  motivo_perda: string | null;
  created_at: string;
  status_changed_at?: string | null;
  icp_score?: number | null;
  icp_label?: string | null;
  // Virtual (não vem do banco diretamente)
  hist: string[];
  lastContact?: string; // último entry do historico — pré-carregado para stale detection sem abrir o lead
  oportunidades?: Oportunidade[]; // pré-carregado em loadLeads (ver useLeads.ts)
}

export interface LeadHistorico {
  id: string;
  lead_id: string;
  descricao: string;
  created_at: string;
}

// ─── Oportunidades — um lead pode ter 1+ (ver supabase-migration-oportunidades.sql) ──

export type OportunidadeStatus = 'aberta' | 'fechada' | 'perdida';

export interface Oportunidade {
  id: string;
  lead_id: string;
  cliente_id: string;
  nome: string | null;
  valor: number | null;
  status: OportunidadeStatus;
  motivo_perda: string | null;
  created_at: string;
  status_changed_at?: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  cliente_id: string;
  role: 'admin' | 'vendedor';
}

export interface Cliente {
  id: string;
  nome: string;
  meta_mensal: number;
  color_primaria: string | null;
  color_secundaria: string | null;
  logo_url: string | null;
  wa_template: string | null;
}

export interface Produto {
  nome: string;
  valor: number;
}

export interface WaTemplates {
  novo: string;
  contato: string;
  proposta: string;
  negociacao: string;
  fechado: string;
  perdido: string;
}

// ─── Kanban — 6 colunas ───────────────────────────────────────────────────────

export interface KanbanCol {
  id: LeadStatus;
  label: string;
  color: string;
}

export const KANBAN_COLS: KanbanCol[] = [
  { id: 'novo',        label: 'Novo',         color: '#C9A227' },
  { id: 'contato',     label: 'Em contato',   color: '#3B82F6' },
  { id: 'proposta',    label: 'Proposta',     color: '#8B5CF6' },
  { id: 'negociacao',  label: 'Negociação',   color: '#F97316' },
  { id: 'fechado',     label: 'Fechado',      color: '#22C55E' },
  { id: 'perdido',     label: 'Perdido',      color: '#E24B4A' },
];

// ─── Origens e cores ──────────────────────────────────────────────────────────

export const ORIGENS_GROUPS: { label: string; items: LeadOrigem[] }[] = [
  { label: '📣 Tráfego Pago',   items: ['Instagram Ads', 'Facebook Ads', 'Google Ads', 'WhatsApp Ads'] },
  { label: '🌱 Orgânico',       items: ['Instagram Orgânico', 'Facebook Orgânico', 'WhatsApp Direto'] },
  { label: '🤝 Relacionamento', items: ['Indicação', 'Prospecção Ativa'] },
  { label: '📂 Outros',         items: ['Landing Page', 'Site / SEO', 'Outro'] },
];

export const ORIGENS: LeadOrigem[] = ORIGENS_GROUPS.flatMap((g) => g.items);

export const ORIG_COLORS: Record<string, string> = {
  // ── Taxonomia atual ──────────────────────────────────────────────────────
  'Instagram Ads':      '#E1306C',
  'Facebook Ads':       '#1877F2',
  'Google Ads':         '#EA4335',
  'WhatsApp Ads':       '#F97316',
  'Instagram Orgânico': '#8B5CF6',
  'Facebook Orgânico':  '#3B82F6',
  'WhatsApp Direto':    '#1D9E75',
  'Indicação':          '#22C55E',
  'Prospecção Ativa':   '#10B981',
  'Landing Page':       '#C9A227',
  'Site / SEO':         '#6366F1',
  'Outro':              '#6B7280',
  // ── Legados (retrocompatibilidade com leads antigos) ─────────────────────
  'Instagram':          '#E1306C',
  'Facebook':           '#1877F2',
  'Indicacao':          '#22C55E',
  'WhatsApp direto':    '#1D9E75',
};

// ─── ICP — badges por classificação ──────────────────────────────────────────

export const ICP_BADGE: Record<string, { bg: string; color: string; icon: string }> = {
  'ICP ideal':   { bg: 'rgba(34,197,94,0.15)',   color: '#22C55E', icon: '✓' },
  'ICP morno':   { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B', icon: '~' },
  'ICP frio':    { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A', icon: '↓' },
  'Fora do ICP': { bg: 'rgba(107,114,128,0.15)', color: '#6B7280', icon: '✗' },
};

// ─── Segmentos ────────────────────────────────────────────────────────────────

export const SEGMENTOS = [
  'Odontologia', 'Industria', 'Logistica', 'Barbearia',
  'Comercio local', 'Servicos', 'Clinica', 'Academia',
  'Arquitetura', 'E-commerce', 'Educacao', 'Outro',
];

// ─── Valores padrão por interesse ────────────────────────────────────────────

export const VAL: Record<string, number> = {
  'Alicerce':    1599,
  'Tracao':      1799,
  'Expansao':    3159,
  'So trafego':  700,
};
