// ─── Tipos principais do Mp. CRM ─────────────────────────────────────────────

export type LeadStatus =
  | 'novo'
  | 'contato'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido';

export type LeadOrigem =
  | 'Instagram'
  | 'Facebook'
  | 'Indicacao'
  | 'WhatsApp direto'
  | 'Landing Page'
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
  data: string;
  hora: string;
  obs: string | null;
  followup: string | null;
  score: number | null;
  motivo_perda: string | null;
  created_at: string;
  // Virtual
  hist: string[];
}

export interface LeadHistorico {
  id: string;
  lead_id: string;
  descricao: string;
  created_at: string;
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

export const ORIGENS: LeadOrigem[] = [
  'Instagram', 'Facebook', 'Indicacao', 'WhatsApp direto', 'Landing Page', 'Outro',
];

export const ORIG_COLORS: Record<string, string> = {
  'Instagram':       '#3B82F6',
  'Facebook':        '#8B5CF6',
  'Indicacao':       '#22C55E',
  'WhatsApp direto': '#1D9E75',
  'Landing Page':    '#C9A227',
  'Outro':           '#555',
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
