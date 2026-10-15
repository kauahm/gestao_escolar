// Visão da sede: municípios, contratos (termos de colaboração) e escolas,
// com um semáforo por município e por escola. Funções puras, usadas pela tela,
// pelos alertas e pelos testes. Ver docs/21-visao-da-sede.md.
//
// O semáforo usa as mesmas regras do quadro "Precisa de atenção hoje"
// (utils/alertas.js), aplicadas escola por escola: há algo crítico, algo que
// pede atenção, ou está tudo em dia.

import { calcularAlertas, GRAVIDADE } from './alertas.js';
import { diasAte, situacaoConta } from './calcularStatus.js';
import { situacaoDoFuncionario } from './funcionarios.js';
import { situacaoDoContrato } from './contratos.js';

export { situacaoDoContrato, DIAS_AVISO_CONTRATO, DIAS_URGENTE_CONTRATO } from './contratos.js';

/** Municípios com contratos ativos no portal de transparência da AEMC (out/2026). Só sugestões. */
export const MUNICIPIOS_SUGERIDOS = [
  ['Bertioga', 'SP'], ['Casa Branca', 'SP'], ['Estância Velha', 'RS'], ['Guaratinguetá', 'SP'],
  ['Hortolândia', 'SP'], ['Indaiatuba', 'SP'], ['Jaguariúna', 'SP'], ['Lins', 'SP'], ['Mogi Guaçu', 'SP'],
  ['Osasco', 'SP'], ['Penápolis', 'SP'], ['Sabino', 'SP'], ['Santa Cruz das Palmeiras', 'SP'],
  ['São José do Rio Pardo', 'SP'], ['São Paulo', 'SP'], ['Sorocaba', 'SP'],
];

/** Objetos de contrato sugeridos (os que aparecem nos contratos da AEMC). Outro pode ser digitado. */
export const OBJETOS_DE_CONTRATO = [
  'Educação infantil (creches)',
  'Apoio escolar',
  'Escola integral',
  'Educação inclusiva',
];

export const SEMAFORO = { CRITICO: 'critico', ATENCAO: 'atencao', EM_DIA: 'em-dia', SEM_DADOS: 'sem-dados' };
export const ROTULO_DO_SEMAFORO = {
  [SEMAFORO.CRITICO]: 'Crítico',
  [SEMAFORO.ATENCAO]: 'Atenção',
  [SEMAFORO.EM_DIA]: 'Em dia',
  [SEMAFORO.SEM_DADOS]: 'Sem escolas ativas',
};
const PESO = { [SEMAFORO.CRITICO]: 3, [SEMAFORO.ATENCAO]: 2, [SEMAFORO.EM_DIA]: 1, [SEMAFORO.SEM_DADOS]: 0 };
const pior = (lista) => lista.reduce((a, b) => (PESO[b] > PESO[a] ? b : a), SEMAFORO.SEM_DADOS);

/** Indicadores e semáforo de uma escola. */
function indicadoresDaEscola(escola, dados, hoje) {
  const daEscola = (lista) => lista.filter((x) => x.escolaId === escola.id);
  const manutencoes = daEscola(dados.manutencoes);
  const contas = daEscola(dados.contas);
  const ciclos = daEscola(dados.ciclos);
  const funcionarios = daEscola(dados.funcionarios);

  const alertas = calcularAlertas({ manutencoes, contas, ciclos, funcionarios, hoje });
  const criticos = alertas.filter((a) => a.gravidade === GRAVIDADE.CRITICO).length;
  const atencao = alertas.filter((a) => a.gravidade === GRAVIDADE.ATENCAO).length;

  const vencidas = contas.filter((c) => situacaoConta(c).vencida);
  const ativos = funcionarios.filter((f) => f.situacao !== 'Inativa');
  const sit = ativos.map((f) => situacaoDoFuncionario(f, hoje));
  const ativa = escola.situacao !== 'Inativa';

  return {
    escola,
    ativa,
    semaforo: !ativa ? SEMAFORO.SEM_DADOS : criticos ? SEMAFORO.CRITICO : atencao ? SEMAFORO.ATENCAO : SEMAFORO.EM_DIA,
    criticos,
    atencao,
    alunos: ativa ? Number(escola.numeroAlunos) || 0 : 0,
    chamadosAbertos: manutencoes.filter((m) => m.status !== 'Concluído').length,
    contasVencidas: vencidas.length,
    valorVencido: vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0),
    ciclosVencidos: ciclos.filter((c) => (diasAte(c.proximaExecucao) ?? 0) < 0).length,
    funcionariosAtivos: ativos.length,
    afastados: sit.filter((s) => s.afastado).length,
    asoVencidos: sit.filter((s) => s.asoVencido).length,
  };
}

const somar = (lista, campo) => lista.reduce((s, x) => s + x[campo], 0);

/**
 * Agrupa escolas por município (campo municipioId) com os indicadores de cada uma.
 * Escolas sem município (dados antigos) ficam num grupo à parte (municipio = null).
 */
export function montarVisaoDaSede({
  municipios = [], contratos = [], escolas = [], manutencoes = [], contas = [], ciclos = [], funcionarios = [], hoje = new Date(),
} = {}) {
  const dados = { manutencoes, contas, ciclos, funcionarios };
  const idsDeMunicipio = new Set(municipios.map((m) => m.id));
  const porEscola = escolas.map((e) => indicadoresDaEscola(e, dados, hoje));

  const montarGrupo = (municipio, contratosDoGrupo, itens) => {
    const situacoes = contratosDoGrupo.map((c) => ({ contrato: c, situacao: situacaoDoContrato(c, hoje), escolas: itens.filter((i) => i.escola.contratoId === c.id).length }));
    const ativas = itens.filter((i) => i.ativa);
    // Contrato que vence logo ou venceu com escolas ainda ligadas também pesa no semáforo.
    const doContrato = situacoes.map((s) => (
      (s.situacao.encerrado && s.escolas > 0) || s.situacao.aviso === 'urgente' ? SEMAFORO.ATENCAO : SEMAFORO.SEM_DADOS
    ));
    const semaforo = ativas.length ? pior([...ativas.map((i) => i.semaforo), ...doContrato]) : pior(doContrato);
    return {
      municipio,
      contratos: situacoes,
      escolas: itens,
      semaforo,
      totais: {
        escolas: ativas.length,
        alunos: somar(ativas, 'alunos'),
        funcionariosAtivos: somar(itens, 'funcionariosAtivos'),
        afastados: somar(itens, 'afastados'),
        chamadosAbertos: somar(itens, 'chamadosAbertos'),
        contasVencidas: somar(itens, 'contasVencidas'),
        valorVencido: somar(itens, 'valorVencido'),
        ciclosVencidos: somar(itens, 'ciclosVencidos'),
        asoVencidos: somar(itens, 'asoVencidos'),
        criticos: somar(ativas, 'criticos'),
        atencao: somar(ativas, 'atencao'),
        contratosVigentes: situacoes.filter((s) => s.situacao.vigente).length,
        // Escolas ativas que ainda não foram ligadas a um contrato do município.
        semContrato: ativas.filter((i) => !contratosDoGrupo.some((c) => c.id === i.escola.contratoId)).length,
      },
    };
  };

  // Cada escola é do município gravado nela (municipioId); o contrato só detalha.
  const grupos = municipios
    .map((m) => montarGrupo(m, contratos.filter((c) => c.municipioId === m.id), porEscola.filter((i) => i.escola.municipioId === m.id)))
    .sort((a, b) => PESO[b.semaforo] - PESO[a.semaforo] || String(a.municipio.nome).localeCompare(String(b.municipio.nome), 'pt-BR'));

  // Escolas antigas, de antes da divisão por município (ver "Dados antigos" na Visão da sede).
  const semMunicipio = porEscola.filter((i) => !idsDeMunicipio.has(i.escola.municipioId));
  const todas = porEscola.filter((i) => i.ativa);

  return {
    grupos,
    semMunicipio: semMunicipio.length ? montarGrupo(null, [], semMunicipio) : null,
    totais: {
      municipios: grupos.filter((g) => g.totais.contratosVigentes > 0 || g.totais.escolas > 0).length,
      contratosVigentes: somar(grupos.map((g) => g.totais), 'contratosVigentes'),
      escolas: todas.length,
      alunos: somar(todas, 'alunos'),
      funcionariosAtivos: somar(porEscola, 'funcionariosAtivos'),
      criticos: grupos.filter((g) => g.semaforo === SEMAFORO.CRITICO).length,
    },
  };
}
