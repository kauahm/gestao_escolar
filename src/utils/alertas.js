// Alertas que cobram: o que precisa de atenção hoje, do mais grave para o menos.
//
// Função pura (sem Firebase), usada pelo painel da administração, pelo contador
// do menu e pelo início da diretora. As regras (prazos, antecedência) ficam aqui
// em cima, para ajustar num lugar só. Ver docs/17-alertas.md.

import { diasAte, diasEmAberto, situacaoConta } from './calcularStatus.js';
import { formatarMoeda } from './formatters.js';
import { situacaoDoFuncionario, DIAS_AVISO_ASO } from './funcionarios.js';

/** Dias que um chamado pode ficar "Pendente" antes de cobrar, por prioridade. */
export const PRAZO_POR_PRIORIDADE = { Urgente: 1, Alta: 2, 'Média': 5, Baixa: 10 };
/** Chamado "Em andamento" sem nenhuma atualização há este número de dias. */
export const DIAS_SEM_ATUALIZACAO = 7;
/** Antecedência para avisar de ciclo perto de vencer. */
export const DIAS_AVISO_CICLO = 7;
/** Antecedência para avisar de conta perto de vencer. */
export const DIAS_AVISO_CONTA = 3;

/** 1 = crítico (vermelho), 2 = atenção (amarelo), 3 = aviso (azul). */
export const GRAVIDADE = { CRITICO: 1, ATENCAO: 2, AVISO: 3 };

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const dataBr = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const resumir = (texto, max = 70) => {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};
const msDe = (t) => (t?.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : null);

const prazoDoPendente = (prioridade) => PRAZO_POR_PRIORIDADE[prioridade] ?? PRAZO_POR_PRIORIDADE['Média'];

/**
 * @param {{ manutencoes?: object[], contas?: object[], ciclos?: object[], funcionarios?: object[], adiados?: Object<string,{ate:string}>, hoje?: Date }} dados
 * @returns {{ chave, tipo, gravidade, titulo, detalhe, escolaNome, link, alvo, adiadoAte? }[]}
 *   `chave` identifica o alerta para "ciente, lembrar depois"; alertas adiados
 *   (até uma data futura) vêm marcados com `adiadoAte`.
 */
export function calcularAlertas({ manutencoes = [], contas = [], ciclos = [], funcionarios = [], adiados = {}, hoje = new Date() } = {}) {
  const alertas = [];
  const agora = hoje.getTime();
  const chamadosAbertosPorCiclo = new Map();

  // ---------------------------------------------------------- chamados ----
  manutencoes.forEach((m) => {
    if (m.status === 'Concluído') return;
    if (m.cicloId) chamadosAbertosPorCiclo.set(m.cicloId, m);

    const motivos = [];
    let gravidade = null;
    const aberto = diasEmAberto(m.criadoEm);
    const limite = prazoDoPendente(m.prioridade);
    const urgente = m.prioridade === 'Alta' || m.prioridade === 'Urgente';

    const diasDoPrazo = m.prazo ? diasAte(m.prazo) : null;
    if (diasDoPrazo !== null && diasDoPrazo < 0) {
      motivos.push(`prazo de ${dataBr(m.prazo)} estourado há ${plural(-diasDoPrazo, 'dia', 'dias')}`);
      gravidade = GRAVIDADE.CRITICO;
    }
    if (m.status === 'Pendente' && m.criadoEm && aberto > limite) {
      motivos.push(`pendente há ${plural(aberto, 'dia', 'dias')} (prioridade ${m.prioridade || 'Média'}: cobrar após ${plural(limite, 'dia', 'dias')})`);
      gravidade = Math.min(gravidade ?? 9, urgente ? GRAVIDADE.CRITICO : GRAVIDADE.ATENCAO);
    }
    const ultimaMudanca = msDe(m.atualizadoEm) ?? msDe(m.criadoEm);
    if (m.status === 'Em andamento' && ultimaMudanca) {
      const parado = Math.floor((agora - ultimaMudanca) / 86400000);
      if (parado >= DIAS_SEM_ATUALIZACAO) {
        motivos.push(`em andamento sem atualização há ${plural(parado, 'dia', 'dias')}`);
        gravidade = Math.min(gravidade ?? 9, GRAVIDADE.ATENCAO);
      }
    }
    if (!motivos.length) return;

    alertas.push({
      chave: `chamado:${m.id}`,
      tipo: 'chamado',
      gravidade,
      titulo: `Chamado: ${resumir(m.descricao)}`,
      detalhe: motivos.join('; '),
      escolaNome: m.escolaNome || '',
      link: `/admin/manutencoes/${m.id}`,
      alvo: m,
    });
  });

  // ------------------------------------------------------------ ciclos ----
  ciclos.forEach((c) => {
    if (!c.proximaExecucao) return;
    const dias = diasAte(c.proximaExecucao);
    if (dias === null || dias > DIAS_AVISO_CICLO) return;
    const vencido = dias < 0;
    const chamado = chamadosAbertosPorCiclo.get(c.id) || null;
    alertas.push({
      chave: `ciclo:${c.id}`,
      tipo: 'ciclo',
      // Com chamado já aberto para resolver, deixa de ser crítico: está encaminhado.
      gravidade: vencido ? (chamado ? GRAVIDADE.ATENCAO : GRAVIDADE.CRITICO) : GRAVIDADE.AVISO,
      titulo: `${c.tipo}`,
      detalhe: vencido
        ? `venceu em ${dataBr(c.proximaExecucao)} (há ${plural(-dias, 'dia', 'dias')})${chamado ? '; chamado já aberto' : ''}`
        : dias === 0 ? 'vence hoje' : `vence em ${plural(dias, 'dia', 'dias')} (${dataBr(c.proximaExecucao)})`,
      escolaNome: c.escolaNome || '',
      link: '/admin/ciclos',
      alvo: c,
      chamado,
    });
  });

  // ------------------------------------------------------------ contas ----
  const pendentes = contas.filter((c) => situacaoConta(c).pendente);
  const vencidas = pendentes.filter((c) => situacaoConta(c).vencida);
  if (vencidas.length) {
    const total = vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const maisAntiga = Math.max(...vencidas.map((c) => situacaoConta(c).diasDeAtraso));
    alertas.push({
      chave: 'contas-vencidas',
      tipo: 'contas-vencidas',
      gravidade: GRAVIDADE.CRITICO,
      titulo: `${plural(vencidas.length, 'conta vencida', 'contas vencidas')} sem envio`,
      detalhe: `${formatarMoeda(total)} no total; a mais antiga venceu há ${plural(maisAntiga, 'dia', 'dias')}`,
      escolaNome: '',
      link: '/admin/contas?status=Vencida',
      alvo: vencidas,
    });
  }
  pendentes.forEach((c) => {
    const dias = diasAte(c.vencimento);
    if (dias === null || dias < 0 || dias > DIAS_AVISO_CONTA) return;
    alertas.push({
      chave: `conta:${c.id}`,
      tipo: 'conta',
      gravidade: dias <= 1 ? GRAVIDADE.ATENCAO : GRAVIDADE.AVISO,
      titulo: `Conta ${c.tipo === 'Outro' ? c.tipoCustomizado || 'Outro' : c.tipo} de ${formatarMoeda(c.valor)}`,
      detalhe: dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias (${dataBr(c.vencimento)})`,
      escolaNome: c.escolaNome || '',
      link: '/admin/contas',
      alvo: c,
    });
  });

  // ------------------------------------------------------- ASO (exame) ----
  // Um alerta por grupo (vencidos / vencendo), não um por pessoa: com centenas
  // de funcionários, um por pessoa afogaria o painel.
  const comAso = funcionarios
    .map((f) => ({ f, s: situacaoDoFuncionario(f, hoje) }))
    .filter(({ s }) => s.diasParaAso !== null)
    .sort((a, b) => a.s.diasParaAso - b.s.diasParaAso); // mais urgente primeiro
  const asoVencidos = comAso.filter(({ s }) => s.asoVencido);
  const asoVencendo = comAso.filter(({ s }) => s.asoVencendo);
  const nomes = (lista) => {
    const primeiros = lista.slice(0, 3).map(({ f }) => String(f.nome || '').split(' ')[0]).join(', ');
    return lista.length > 3 ? `${primeiros} e mais ${lista.length - 3}` : primeiros;
  };
  if (asoVencidos.length) {
    const maisAntigo = Math.max(...asoVencidos.map(({ s }) => -s.diasParaAso));
    alertas.push({
      chave: 'aso-vencidos',
      tipo: 'aso',
      gravidade: GRAVIDADE.ATENCAO,
      titulo: plural(asoVencidos.length, 'ASO vencido', 'ASOs vencidos'),
      detalhe: `${nomes(asoVencidos)}; o mais antigo venceu há ${plural(maisAntigo, 'dia', 'dias')}`,
      escolaNome: '',
      link: '/admin/funcionarios?mostrar=aso',
      alvo: asoVencidos.map(({ f }) => f),
    });
  }
  if (asoVencendo.length) {
    const proximo = Math.min(...asoVencendo.map(({ s }) => s.diasParaAso));
    alertas.push({
      chave: 'aso-vencendo',
      tipo: 'aso',
      gravidade: GRAVIDADE.AVISO,
      titulo: `${plural(asoVencendo.length, 'ASO vence', 'ASOs vencem')} nos próximos ${DIAS_AVISO_ASO} dias`,
      detalhe: `${nomes(asoVencendo)}; o primeiro ${proximo === 0 ? 'vence hoje' : `vence em ${plural(proximo, 'dia', 'dias')}`}`,
      escolaNome: '',
      link: '/admin/funcionarios?mostrar=aso',
      alvo: asoVencendo.map(({ f }) => f),
    });
  }

  // ------------------------------------------------- adiados e ordenação ----
  const hojeYmd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  alertas.forEach((a) => {
    const adiado = adiados[a.chave];
    if (adiado?.ate && adiado.ate > hojeYmd) a.adiadoAte = adiado.ate;
  });

  return alertas.sort((a, b) => a.gravidade - b.gravidade || a.escolaNome.localeCompare(b.escolaNome, 'pt-BR') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Quantos alertas cobram atenção agora (críticos e de atenção, sem os adiados). */
export const contarPendencias = (alertas) =>
  alertas.filter((a) => !a.adiadoAte && a.gravidade <= GRAVIDADE.ATENCAO).length;
