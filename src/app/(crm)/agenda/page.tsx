'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/store/crm-store';
import { fmtR, fmtFollowup, parseFollowup, getLeadValor, precisaReativar, diasAtras, ultimoContato, leadData } from '@/lib/utils';
import { KANBAN_COLS, type Lead } from '@/types';

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Grupo {
  titulo: string;
  cor: string;
  leads: Lead[];
}

export default function AgendaPage() {
  const { state, dispatch } = useCRM();
  const router = useRouter();

  const grupos = useMemo<Grupo[]>(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    const fimSemana = new Date(hoje); fimSemana.setDate(hoje.getDate() + 7);

    const comAgenda = state.leads
      .filter((l) => l.followup && l.status !== 'fechado' && l.status !== 'perdido')
      .sort((a, b) => parseFollowup(a.followup!).getTime() - parseFollowup(b.followup!).getTime());

    return [
      { titulo: '⚠️ Atrasados', cor: 'var(--red)', leads: comAgenda.filter((l) => parseFollowup(l.followup!) < new Date()) },
      { titulo: 'Hoje', cor: 'var(--gold)', leads: comAgenda.filter((l) => sameDay(parseFollowup(l.followup!), hoje) && parseFollowup(l.followup!) >= new Date()) },
      { titulo: 'Amanhã', cor: '#3B82F6', leads: comAgenda.filter((l) => sameDay(parseFollowup(l.followup!), amanha)) },
      { titulo: 'Esta semana', cor: '#8B5CF6', leads: comAgenda.filter((l) => {
        const d = parseFollowup(l.followup!);
        return d > amanha && d <= fimSemana;
      }) },
      { titulo: 'Mais tarde', cor: 'var(--text3)', leads: comAgenda.filter((l) => parseFollowup(l.followup!) > fimSemana) },
    ];
  }, [state.leads]);

  const paraReativar = useMemo(() =>
    state.leads
      .filter((l) => l.status === 'fechado' && precisaReativar(l))
      .sort((a, b) =>
        diasAtras(ultimoContato(b.hist, leadData(b), b.lastContact)) - diasAtras(ultimoContato(a.hist, leadData(a), a.lastContact))
      ),
  [state.leads]);

  const totalAgenda = grupos.reduce((a, g) => a + g.leads.length, 0);

  function openLead(id: string) {
    dispatch({ type: 'SET_ACTIVE_LEAD', payload: id });
    router.push('/pipeline');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Agenda Comercial</div>
          <div className="page-sub">{totalAgenda} contato{totalAgenda !== 1 ? 's' : ''} com próxima ação marcada</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        {totalAgenda === 0 && paraReativar.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
            Nenhum contato com follow-up ou agendamento marcado ainda.
          </div>
        )}

        {grupos.filter((g) => g.leads.length > 0).map((g) => (
          <div key={g.titulo}>
            <div className="dash-section-title" style={{ color: g.cor, marginBottom: 12 }}>
              {g.titulo} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>· {g.leads.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.leads.map((l) => {
                const col = KANBAN_COLS.find((c) => c.id === l.status);
                const valor = getLeadValor(l);
                const waMsg = encodeURIComponent((state.waTemplates as any)[l.status]?.replace('{nome}', l.nome) ?? '');
                return (
                  <div key={l.id} className="urg-row" onClick={() => openLead(l.id)} style={{ borderLeft: `2px solid ${g.cor}` }}>
                    <div className="urg-av" style={{ background: `${col?.color ?? '#555'}22`, color: col?.color ?? '#888' }}>
                      {l.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="urg-name">{l.nome}</div>
                      <div className="urg-info">
                        📅 {fmtFollowup(l.followup)} · {col?.label ?? l.status}{l.seg ? ` · ${l.seg}` : ''}{valor ? ` · ${fmtR(valor)}` : ''}
                      </div>
                    </div>
                    {l.tel && (
                      <button className="urg-wa" onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/55${l.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank');
                      }}>WA</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {paraReativar.length > 0 && (
          <div>
            <div className="dash-section-title" style={{ color: '#10B981', marginBottom: 4 }}>
              💤 Clientes para reativar <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>· {paraReativar.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Fechados sem nenhuma atividade registrada há 6 meses ou mais — bons candidatos a reengajamento comercial.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paraReativar.map((l) => {
                const dias = diasAtras(ultimoContato(l.hist, leadData(l), l.lastContact));
                const waMsg = encodeURIComponent(`Olá ${l.nome}! Faz um tempo que a gente não conversa — que tal retomarmos o papo? 😊`);
                return (
                  <div key={l.id} className="urg-row" onClick={() => openLead(l.id)} style={{ borderLeft: '2px solid #10B981' }}>
                    <div className="urg-av" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                      {l.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="urg-name">{l.nome}</div>
                      <div className="urg-info">💤 {dias} dias sem atividade{l.seg ? ` · ${l.seg}` : ''}</div>
                    </div>
                    {l.tel && (
                      <button className="urg-wa" onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/55${l.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank');
                      }}>WA</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
