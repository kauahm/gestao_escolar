// Linha do tempo de um chamado de manutenção, montada a partir do histórico
// de alterações (coleção `historico`, gravada por services/db.js).
//
// Chamados criados antes do histórico existir (13/10/2026) não têm as linhas
// de "criar" e de mudança de status; nesses casos, a abertura e a conclusão
// são reconstruídas a partir das datas gravadas no próprio chamado.

import { formatarDataHora } from './formatters.js';

const ROTULOS = {
  status: 'Status',
  responsavel: 'Responsável',
  prioridade: 'Prioridade',
  prazo: 'Prazo',
  escolaNome: 'Escola',
  localDentroEscola: 'Local',
};
const TEXTOS_LONGOS = { descricao: 'Descrição alterada', observacoes: 'Observações internas alteradas' };
const IGNORADOS = new Set(['id', 'concluidoEm', 'responsavelId', 'escolaId', 'atualizadoEm', 'criadoEm', 'solicitadaPor', 'importacaoId']);

const emMs = (t) => (t?.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : null);
const valorLegivel = (campo, v) => {
  if (v === null || v === undefined || v === '') return campo === 'prazo' ? 'sem prazo' : '—';
  if (campo === 'prazo' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  return String(v);
};

/**
 * @param chamado  documento da manutenção
 * @param historico  linhas do histórico desse chamado (qualquer ordem)
 * @param nomeDe  (uid, email) => nome de quem fez
 * @returns {{ id, titulo, detalhes: string[], quem, quando, cor }[]} do mais recente para o mais antigo
 */
export function linhaDoTempoDoChamado(chamado, historico = [], nomeDe = (uid, email) => email || '') {
  const eventos = [];
  let temCriacao = false;
  let temConclusao = false;

  historico.forEach((h) => {
    const quando = emMs(h.em) ?? Date.now(); // ainda sem a hora do servidor = acabou de acontecer
    const quem = nomeDe(h.porUid, h.porEmail);
    if (h.acao === 'criar') {
      temCriacao = true;
      eventos.push({ id: h.id, ms: quando, titulo: 'Chamado aberto', detalhes: [], quem, cor: 'bg-blue-500' });
      return;
    }
    if (h.acao === 'excluir') {
      eventos.push({ id: h.id, ms: quando, titulo: 'Excluído (foi para a lixeira)', detalhes: [], quem, cor: 'bg-red-500' });
      return;
    }
    if (h.acao === 'restaurar') {
      eventos.push({ id: h.id, ms: quando, titulo: 'Restaurado da lixeira', detalhes: [], quem, cor: 'bg-gray-400' });
      return;
    }
    // alterar
    const antes = h.antes || {};
    const depois = h.depois || {};
    const detalhes = [];
    let titulo = 'Chamado alterado';
    let cor = 'bg-gray-400';
    Object.keys(depois).forEach((campo) => {
      if (IGNORADOS.has(campo)) return;
      if (campo === 'status') {
        titulo = `Status: ${valorLegivel(campo, antes.status)} → ${valorLegivel(campo, depois.status)}`;
        if (depois.status === 'Concluído') { cor = 'bg-green-500'; temConclusao = true; } else cor = 'bg-amber-500';
        return;
      }
      if (TEXTOS_LONGOS[campo]) { detalhes.push(TEXTOS_LONGOS[campo]); return; }
      const rotulo = ROTULOS[campo] || campo;
      detalhes.push(`${rotulo}: ${valorLegivel(campo, antes[campo])} → ${valorLegivel(campo, depois[campo])}`);
    });
    if (titulo === 'Chamado alterado' && detalhes.length === 0) return; // só mudou data interna
    eventos.push({ id: h.id, ms: quando, titulo, detalhes, quem, cor });
  });

  if (!temCriacao && chamado?.criadoEm) {
    eventos.push({ id: 'abertura', ms: emMs(chamado.criadoEm) ?? 0, titulo: 'Chamado aberto', detalhes: [], quem: chamado.solicitadaPorNome || '', cor: 'bg-blue-500' });
  }
  if (!temConclusao && chamado?.status === 'Concluído' && chamado?.concluidoEm) {
    eventos.push({ id: 'conclusao', ms: emMs(chamado.concluidoEm) ?? 0, titulo: 'Concluído', detalhes: [], quem: '', cor: 'bg-green-500' });
  }

  return eventos
    .sort((a, b) => b.ms - a.ms)
    .map(({ ms, ...e }) => ({ ...e, quando: ms ? formatarDataHora(new Date(ms)) : '' }));
}
