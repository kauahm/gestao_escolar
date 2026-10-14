// Conversões de valores vindos de planilhas para o formato que o sistema grava.
//
// Cada função recebe o valor da célula (texto, número, Date ou vazio) e
// devolve { valor } quando consegue converter, ou { erro } com uma mensagem
// em português que aparece no relatório da importação.

const pad = (n) => String(n).padStart(2, '0');

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Minúsculas, sem acento, sem espaços repetidos. Para comparar textos. */
export const chave = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const vazio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';

/** Texto limpo (sem espaços nas pontas e sem espaços repetidos). */
export const texto = (valor) => (vazio(valor) ? '' : String(valor).replace(/\s+/g, ' ').trim());

const dataValida = (a, m, d) => {
  const data = new Date(a, m - 1, d);
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d;
};

const formatarYmd = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;

/** Data -> "AAAA-MM-DD". Aceita Date, 31/12/2026, 31/12/26, 31-12-2026, 2026-12-31 e número de série do Excel. */
export const data = (valor) => {
  if (vazio(valor)) return { valor: '' };
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return { erro: 'data inválida' };
    return { valor: formatarYmd(valor.getFullYear(), valor.getMonth() + 1, valor.getDate()) };
  }
  if (typeof valor === 'number') {
    // Número de série do Excel (célula de data sem formatação de data).
    if (valor > 20000 && valor < 80000) {
      const base = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86400000);
      return { valor: formatarYmd(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate()) };
    }
    return { erro: `"${valor}" não é uma data` };
  }
  const t = String(valor).trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) {
    const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return dataValida(a, mes, d) ? { valor: formatarYmd(a, mes, d) } : { erro: `"${t}" não é uma data válida` };
  }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    let a = Number(m[3]);
    if (m[3].length === 2) a += a < 70 ? 2000 : 1900;
    const [d, mes] = [Number(m[1]), Number(m[2])];
    return dataValida(a, mes, d) ? { valor: formatarYmd(a, mes, d) } : { erro: `"${t}" não é uma data válida (use dia/mês/ano)` };
  }
  return { erro: `"${t}" não é uma data (use dia/mês/ano, por exemplo 31/12/2026)` };
};

/** Valor em reais -> número. Aceita 1234,56 · 1.234,56 · R$ 1.234,56 · 1234.56 · número. */
export const dinheiro = (valor) => {
  if (vazio(valor)) return { valor: null };
  if (typeof valor === 'number') return Number.isFinite(valor) ? { valor: Math.round(valor * 100) / 100 } : { erro: 'valor inválido' };
  let t = String(valor).replace(/R\$|\s/gi, '').trim();
  const negativo = /^-|^\(.*\)$/.test(t);
  t = t.replace(/[-()]/g, '');
  if (!/^[\d.,]+$/.test(t)) return { erro: `"${valor}" não é um valor em reais` };
  const virgulas = (t.match(/,/g) || []).length;
  const pontos = (t.match(/\./g) || []).length;
  if (virgulas && pontos) {
    // O último separador é o decimal: 1.234,56 (Brasil) ou 1,234.56 (EUA).
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (virgulas) {
    t = virgulas === 1 ? t.replace(',', '.') : t.replace(/,/g, '');   // 1234,56
  } else if (pontos) {
    // Vários pontos ou "1.234" = separador de milhar (padrão brasileiro); senão é decimal.
    if (pontos > 1 || /^\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return { erro: `"${valor}" não é um valor em reais` };
  return { valor: Math.round((negativo ? -n : n) * 100) / 100 };
};

/** Número inteiro (alunos, litros, dias). Aceita "1.500" e "1500". */
export const inteiro = (valor) => {
  if (vazio(valor)) return { valor: null };
  if (typeof valor === 'number') return Number.isInteger(valor) ? { valor } : { valor: Math.round(valor) };
  const t = String(valor).replace(/[.\s]/g, '').replace(/(litros?|l|dias?|alunos?)$/i, '').trim();
  if (!/^\d+$/.test(t)) return { erro: `"${valor}" não é um número inteiro` };
  return { valor: Number(t) };
};

const MESES_CURTOS = MESES.map((m) => chave(m).slice(0, 3));

/** Competência -> "Outubro/2026". Aceita 10/2026, 10/26, out/2026, Outubro/2026, Outubro 2026, 2026-10 e datas. */
export const competencia = (valor) => {
  if (vazio(valor)) return { valor: '' };
  if (valor instanceof Date) return { valor: `${MESES[valor.getMonth()]}/${valor.getFullYear()}` };
  const t = chave(valor);
  let m = t.match(/^(\d{4}) (\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { valor: `${MESES[Number(m[2]) - 1]}/${m[1]}` };
  m = t.match(/^(\d{1,2}) (\d{2}|\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
    const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return { valor: `${MESES[Number(m[1]) - 1]}/${ano}` };
  }
  m = t.match(/^([a-z]+) (?:de )?(\d{2}|\d{4})$/);
  if (m) {
    const i = MESES_CURTOS.indexOf(m[1].slice(0, 3));
    if (i >= 0) {
      const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      return { valor: `${MESES[i]}/${ano}` };
    }
  }
  // Data completa (ex.: 01/10/2026): usa mês e ano.
  const comoData = data(valor);
  if (comoData.valor) {
    const [a, mes] = comoData.valor.split('-');
    return { valor: `${MESES[Number(mes) - 1]}/${a}` };
  }
  return { erro: `"${valor}" não é uma competência (use mês/ano, por exemplo 10/2026 ou Outubro/2026)` };
};

/** Telefone no formato que as telas usam: (19) 99999-9999 ou (19) 3333-3333. */
export const telefone = (valor) => {
  if (vazio(valor)) return { valor: '' };
  let d = String(valor).replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  if (d.length === 11) return { valor: `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` };
  if (d.length === 10) return { valor: `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` };
  return { valor: texto(valor), aviso: `telefone "${valor}" sem DDD ou incompleto` };
};

export const cep = (valor) => {
  if (vazio(valor)) return { valor: '' };
  const d = String(typeof valor === 'number' ? String(valor).padStart(8, '0') : valor).replace(/\D/g, '');
  if (d.length !== 8) return { valor: texto(valor), aviso: `CEP "${valor}" incompleto` };
  return { valor: `${d.slice(0, 5)}-${d.slice(5)}` };
};

export const email = (valor) => {
  if (vazio(valor)) return { valor: '' };
  const t = String(valor).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { valor: t, aviso: `e-mail "${valor}" parece inválido` };
  return { valor: t };
};

/** Sim/Não. */
export const simNao = (valor) => {
  if (vazio(valor)) return { valor: null };
  if (typeof valor === 'boolean') return { valor };
  const t = chave(valor);
  if (['sim', 's', 'x', 'yes', 'y', '1', 'verdadeiro', 'true', 'ativa', 'ativo'].includes(t)) return { valor: true };
  if (['nao', 'n', 'no', '0', 'falso', 'false', 'inativa', 'inativo'].includes(t)) return { valor: false };
  return { erro: `"${valor}" deveria ser Sim ou Não` };
};

/** Soma dias a uma data "AAAA-MM-DD", sem deslocamento de fuso. */
export const somarDias = (ymd, dias) => {
  const [a, m, d] = ymd.split('-').map(Number);
  const r = new Date(a, m - 1, d + Number(dias));
  return formatarYmd(r.getFullYear(), r.getMonth() + 1, r.getDate());
};

// ------------------------------------------------------------ competência ----

/** "Outubro/2026" (ou qualquer formato aceito em competencia()) -> { mes: 10, ano: 2026, texto }. */
export const partesDaCompetencia = (valor) => {
  const r = competencia(valor);
  if (!r.valor) return null;
  const [nome, ano] = r.valor.split('/');
  return { mes: MESES.indexOf(nome) + 1, ano: Number(ano), texto: r.valor };
};

export const competenciaDe = (mes, ano) => `${MESES[mes - 1]}/${ano}`;

/** Número para ordenar competências por data (as que não forem reconhecidas vão para o fim). */
export const ordemDaCompetencia = (valor) => {
  const p = partesDaCompetencia(valor);
  return p ? p.ano * 12 + p.mes : -Infinity;
};

/**
 * Quantos meses separam a competência do mês do vencimento (positivo = vence depois).
 * null se faltar algum dos dois.
 */
export const mesesEntreCompetenciaEVencimento = (comp, vencimentoYmd) => {
  const p = partesDaCompetencia(comp);
  if (!p || !vencimentoYmd) return null;
  const [a, m] = String(vencimentoYmd).split('-').map(Number);
  if (!a || !m) return null;
  return (a * 12 + m) - (p.ano * 12 + p.mes);
};

/** Distância (em meses) a partir da qual a competência provavelmente foi digitada errada. */
export const DISTANCIA_SUSPEITA_DE_COMPETENCIA = 3;
