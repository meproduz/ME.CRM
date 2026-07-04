'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type { Lead, Usuario, Cliente, Produto, WaTemplates } from '@/types';

// ─── Estado global ─────────────────────────────────────────────────────────────

interface CRMState {
  leads: Lead[];
  currentUser: Usuario | null;
  cliente: Cliente | null;
  activeLeadId: string | null;
  activeSeg: string;
  searchQuery: string;
  isLoading: boolean;
  waTemplate: string;
  waTemplates: WaTemplates;
  produtos: Produto[];
  metaMensal: number;
  page: number;
  hasMore: boolean;
  totalCount: number;
  periodoAtivo: 'semana' | 'mes' | 'trim' | 'total';
}

const DEFAULT_WA =
  'Olá {nome}! Tudo bem? Aqui é da MeProduz. Studio 👋 Vi seu interesse e gostaria de te apresentar nossas soluções. Posso te ajudar?';

function loadLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function getInitialState(): CRMState {
  return {
    leads: [],
    currentUser: null,
    cliente: null,
    activeLeadId: null,
    activeSeg: 'Todos',
    searchQuery: '',
    isLoading: false,
    waTemplate: loadLocalStorage('mp_wa_template', DEFAULT_WA),
    waTemplates: loadLocalStorage('mp_wa_templates', {
      novo:       'Olá {nome}! Tudo bem? Somos a MeProduz. Studio 👋 Posso te apresentar nossas soluções?',
      contato:    'Olá {nome}! Tudo bem? Dando um retorno sobre nosso papo 😊 Podemos agendar uma conversa?',
      proposta:   'Olá {nome}! Sua proposta está pronta ✅ Quando posso te apresentar?',
      negociacao: 'Olá {nome}! Tudo certo com a proposta? Posso tirar alguma dúvida? 💬',
      fechado:    'Olá {nome}! Bem-vindo(a) à família MeProduz. Studio! 🎉 Vamos começar?',
      perdido:    'Olá {nome}! Posso ajudar com alguma dúvida ou apresentar uma nova solução?',
    }),
    produtos: loadLocalStorage('mp_produtos', [
      { nome: 'Alicerce',    valor: 1599 },
      { nome: 'Tração',      valor: 1799 },
      { nome: 'Expansão',    valor: 3159 },
      { nome: 'Só tráfego',  valor: 700  },
    ]),
    metaMensal: 60000,
    page: 0,
    hasMore: true,
    totalCount: 0,
    periodoAtivo: 'semana',
  };
}

// ─── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: Usuario | null }
  | { type: 'SET_CLIENTE'; payload: Cliente | null }
  | { type: 'SET_LEADS'; payload: Lead[] }
  | { type: 'APPEND_LEADS'; payload: Lead[] }
  | { type: 'UPDATE_LEAD'; payload: Lead }
  | { type: 'ADD_LEAD'; payload: Lead }
  | { type: 'REMOVE_LEAD'; payload: string }
  | { type: 'SET_ACTIVE_LEAD'; payload: string | null }
  | { type: 'SET_SEG'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_WA_TEMPLATE'; payload: string }
  | { type: 'SET_WA_TEMPLATES'; payload: WaTemplates }
  | { type: 'SET_PRODUTOS'; payload: Produto[] }
  | { type: 'SET_META'; payload: number }
  | { type: 'SET_PAGINATION'; payload: { page: number; hasMore: boolean; totalCount: number } }
  | { type: 'ADD_HIST_ENTRY'; payload: { leadId: string; entry: string } }
  | { type: 'SET_PERIODO'; payload: CRMState['periodoAtivo'] };

function reducer(state: CRMState, action: Action): CRMState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_USER': return { ...state, currentUser: action.payload };
    case 'SET_CLIENTE': return { ...state, cliente: action.payload, metaMensal: action.payload?.meta_mensal ?? state.metaMensal };
    case 'SET_LEADS': return { ...state, leads: action.payload };
    case 'APPEND_LEADS': return { ...state, leads: [...state.leads, ...action.payload] };
    case 'UPDATE_LEAD': return { ...state, leads: state.leads.map((l) => l.id === action.payload.id ? action.payload : l) };
    case 'ADD_LEAD': return { ...state, leads: [action.payload, ...state.leads] };
    case 'REMOVE_LEAD': return { ...state, leads: state.leads.filter((l) => l.id !== action.payload) };
    case 'SET_ACTIVE_LEAD': return { ...state, activeLeadId: action.payload };
    case 'SET_SEG': return { ...state, activeSeg: action.payload };
    case 'SET_SEARCH': return { ...state, searchQuery: action.payload };
    case 'SET_WA_TEMPLATE': return { ...state, waTemplate: action.payload };
    case 'SET_WA_TEMPLATES': return { ...state, waTemplates: action.payload };
    case 'SET_PRODUTOS': return { ...state, produtos: action.payload };
    case 'SET_META': return { ...state, metaMensal: action.payload };
    case 'SET_PAGINATION': return { ...state, ...action.payload };
    case 'SET_PERIODO': return { ...state, periodoAtivo: action.payload };
    case 'ADD_HIST_ENTRY':
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === action.payload.leadId ? { ...l, hist: [...l.hist, action.payload.entry] } : l
        ),
      };
    default: return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface CRMContextValue {
  state: CRMState;
  dispatch: React.Dispatch<Action>;
  getActiveLead: () => Lead | null;
  getFilteredLeads: () => Lead[];
}

const CRMContext = createContext<CRMContextValue | null>(null);

export function CRMProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const getActiveLead = useCallback(
    () => state.leads.find((l) => l.id === state.activeLeadId) ?? null,
    [state.leads, state.activeLeadId]
  );

  const getFilteredLeads = useCallback(() => {
    let fl = state.leads;
    if (state.activeSeg !== 'Todos') fl = fl.filter((l) => l.seg === state.activeSeg);
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      fl = fl.filter((l) =>
        l.nome.toLowerCase().includes(q) ||
        (l.tel ?? '').includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.seg ?? '').toLowerCase().includes(q) ||
        (l.orig ?? '').toLowerCase().includes(q)
      );
    }
    return fl;
  }, [state.leads, state.activeSeg, state.searchQuery]);

  return (
    <CRMContext.Provider value={{ state, dispatch, getActiveLead, getFilteredLeads }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used inside CRMProvider');
  return ctx;
}
