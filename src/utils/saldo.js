// Controle de saldo das verbas (rubricas): quanto já foi gasto, quanto sobra
// e quanto ainda pode ser gasto em cada mês. Mesma regra da planilha
// "Controle de Saldo" da AEMC. Funções puras, usadas pela tela, pelos alertas
// e pelos testes. Ver docs/20-controle-de-saldo.md.
//
// Meses são guardados como "AAAA-MM".

export const NOMES_DOS_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Áreas sugeridas no cadastro (as da planilha da AEMC). Outras podem ser digitadas. */
export const RUBRICAS_SUGERIDAS = [
  'Mobiliário',
  'Material de Escritório',
  'Brinquedos e Livros pedagógicos',
  'Material de Higiene, Limpeza/uniforme',
  'Material Pedagógico',
  'Material de Informática',
  'Enxoval',
  'Manutenção de Mobiliário e Equipamentos',
  'Manutenção civil, hidráulica, elétrica, pintura',
];

/** Fração do teto abaixo da qual o mês fica "perto do teto" (igual à planilha: 20%). */
export const FRACAO_PERTO_DO_TETO = 0.2;

export const SITUACAO = {
  SEM_VERBA: 'Sem verba',
  ESTOURADA: 'Verba estourada',
  PASSOU: 'Passou do teto do mês',
  PERTO: 'Perto do teto',
  DENTRO: 'Dentro do teto',
};

const arredondar = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** "2026-08" a partir de uma data "2026-08-12" ou de um Date. */
export const mesDe = (data) => {
  if (!data) return '';
  if (data instanceof Date) return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  const m = String(data).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
};

/** Soma (ou subtrai) meses: somarMeses("2026-11", 3) = "2027-02". */
export const somarMeses = (mes, quantos) => {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + quantos;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/** "Outubro/2026" */
export const rotuloDoMes = (mes) => {
  if (!mes) return '';
  const [a, m] = mes.split('-').map(Number);
  return `${NOMES_DOS_MESES[m - 1]}/${a}`;
};

/** "out/26" */
export const rotuloCurto = (mes) => {
  if (!mes) return '';
  const [a, m] = mes.split('-').map(Number);
  return `${CURTOS[m - 1]}/${String(a).slice(2)}`;
};

/** Meses do período: { inicio: "2026-08", meses: 5 } -> ["2026-08", ..., "2026-12"]. */
export const mesesDoPeriodo = (periodo) => {
  const n = Math.max(0, Math.min(24, Math.floor(Number(periodo?.meses) || 0)));
  if (!periodo?.inicio || !n) return [];
  return Array.from({ length: n }, (_, i) => somarMeses(periodo.inicio, i));
};

/** Mês que a tela abre: o mês de hoje, ou a ponta do período se hoje estiver fora dele. */
export const mesAtualNoPeriodo = (periodo, hoje = new Date()) => {
  const meses = mesesDoPeriodo(periodo);
  if (!meses.length) return '';
  const atual = mesDe(hoje);
  if (atual < meses[0]) return meses[0];
  if (atual > meses[meses.length - 1]) return meses[meses.length - 1];
  return atual;
};

/** Quantas parcelas o gasto tem (à vista = 1). */
export const quantidadeDeParcelas = (gasto) => Math.max(1, Math.floor(Number(gasto?.parcelas) || 1));

/** Mês da primeira parcela (ou do gasto à vista): o informado ou o mês da data do gasto. */
export const primeiroMes = (gasto) => gasto?.primeiraParcela || mesDe(gasto?.data);

/**
 * Em que meses o gasto cai e quanto em cada um. O valor é dividido igualmente;
 * os centavos que sobram da divisão vão para a última parcela (como na planilha).
 */
export const parcelasDoGasto = (gasto) => {
  const n = quantidadeDeParcelas(gasto);
  const total = arredondar(gasto?.valorTotal);
  const inicio = primeiroMes(gasto);
  if (!inicio || !total) return [];
  const parcela = arredondar(total / n);
  return Array.from({ length: n }, (_, i) => ({
    mes: somarMeses(inicio, i),
    valor: i === n - 1 ? arredondar(total - parcela * (n - 1)) : parcela,
  }));
};

/** "À vista em ago/26" ou "3x de R$ 3.000,00 (out/26 a dez/26)". */
export const comoFicou = (gasto, formatarMoeda) => {
  const p = parcelasDoGasto(gasto);
  if (!p.length) return '';
  if (p.length === 1) return `À vista em ${rotuloCurto(p[0].mes)}`;
  return `${p.length}x de ${formatarMoeda(p[0].valor)} (${rotuloCurto(p[0].mes)} a ${rotuloCurto(p[p.length - 1].mes)})`;
};

const situacaoDe = ({ verba, saldo, teto, aindaPode }) => {
  if (verba <= 0) return SITUACAO.SEM_VERBA;
  if (saldo < 0) return SITUACAO.ESTOURADA;
  if (aindaPode < 0) return SITUACAO.PASSOU;
  if (aindaPode <= FRACAO_PERTO_DO_TETO * teto) return SITUACAO.PERTO;
  return SITUACAO.DENTRO;
};

/**
 * Situação de cada rubrica no mês escolhido.
 *
 * Teto do mês = (verba do período − o que caiu nos OUTROS meses, inclusive
 * parcelas já assumidas para os meses seguintes) ÷ meses que faltam, contando
 * este. Se um mês passa do teto, o teto dos seguintes diminui sozinho; se
 * sobra, aumenta. O teto nunca fica negativo.
 *
 * @param {{ rubricas: object[], gastos: object[], periodo: {inicio, meses}, mes: string }} p
 */
export function calcularSaldo({ rubricas = [], gastos = [], periodo, mes }) {
  const meses = mesesDoPeriodo(periodo);
  const indice = meses.indexOf(mes);
  const dentro = new Set(meses);

  // Quanto cai em cada mês, por rubrica; e o que fica fora do período.
  const porRubrica = new Map(rubricas.map((r) => [r.id, Object.fromEntries(meses.map((m) => [m, 0]))]));
  const foraDoPeriodo = new Map();
  let semRubrica = 0;
  gastos.forEach((g) => {
    const mapa = porRubrica.get(g.rubricaId);
    parcelasDoGasto(g).forEach(({ mes: m, valor }) => {
      if (!mapa) { semRubrica = arredondar(semRubrica + valor); return; }
      if (dentro.has(m)) mapa[m] = arredondar(mapa[m] + valor);
      else foraDoPeriodo.set(g.rubricaId, arredondar((foraDoPeriodo.get(g.rubricaId) || 0) + valor));
    });
  });

  const tetoNoMes = (verba, porMes, m, i) => {
    const total = Object.values(porMes).reduce((s, v) => s + v, 0);
    return Math.max(0, (verba - (total - porMes[m])) / (meses.length - i));
  };

  const linhas = rubricas.map((r) => {
    const porMes = porRubrica.get(r.id);
    const verba = arredondar((Number(r.verbaMensal) || 0) * meses.length);
    const lancado = arredondar(Object.values(porMes).reduce((s, v) => s + v, 0));
    const ateOMes = indice < 0 ? 0 : arredondar(meses.slice(0, indice + 1).reduce((s, m) => s + porMes[m], 0));
    const depois = arredondar(lancado - ateOMes);
    const saldo = arredondar(verba - lancado);
    const teto = indice < 0 ? 0 : arredondar(tetoNoMes(verba, porMes, mes, indice));
    const gastoNoMes = indice < 0 ? 0 : porMes[mes];
    const aindaPode = arredondar(teto - gastoNoMes);
    const tetos = Object.fromEntries(meses.map((m, i) => [m, arredondar(tetoNoMes(verba, porMes, m, i))]));
    return {
      rubrica: r,
      verba,
      lancado,
      ateOMes,
      depois,
      saldo,
      usado: verba > 0 ? lancado / verba : 0,
      teto,
      gastoNoMes,
      aindaPode,
      porMes,
      tetos,
      foraDoPeriodo: foraDoPeriodo.get(r.id) || 0,
      situacao: situacaoDe({ verba, saldo, teto, aindaPode }),
    };
  });

  const soma = (campo) => arredondar(linhas.reduce((s, l) => s + l[campo], 0));
  const verba = soma('verba');
  const lancado = soma('lancado');
  return {
    meses,
    mes,
    linhas,
    totais: {
      verba,
      lancado,
      saldo: soma('saldo'),
      usado: verba > 0 ? lancado / verba : 0,
      teto: soma('teto'),
      gastoNoMes: soma('gastoNoMes'),
      // Quem passou do teto não "devolve" para as outras: soma só o que sobra.
      aindaPode: arredondar(linhas.reduce((s, l) => s + Math.max(0, l.aindaPode), 0)),
      foraDoPeriodo: soma('foraDoPeriodo'),
    },
    semRubrica,
  };
}
