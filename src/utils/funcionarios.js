// Regras do cadastro de funcionários (colaboradores das escolas).
// Funções puras, usadas pela tela, pela importação de planilhas, pelos alertas
// e pelos testes. Ver docs/19-funcionarios.md.

import { chave, vazio } from '../importacao/normalizar.js';

/**
 * Cargos sugeridos (os da planilha da AEMC, com o nome completo; na planilha
 * vêm cortados, como "AGENTE DE DESENVOLVIMENTO INFA"). Outro cargo pode ser
 * digitado à mão.
 */
export const CARGOS = [
  'Agente de Desenvolvimento Infantil',
  'Professor(a) de Educação Infantil',
  'Professor(a) de Educação Especial',
  'Auxiliar de Serviços Gerais',
  'Auxiliar Administrativo',
  'Assistente Administrativo',
  'Coordenador(a) Pedagógico(a)',
  'Diretor(a) Educacional',
  'Psicólogo(a)',
  'Assistente Social',
  'Zelador(a)',
  'Menor Aprendiz',
];

/** Tipos de afastamento sugeridos (os que aparecem na planilha + os mais comuns). */
export const TIPOS_DE_AFASTAMENTO = [
  'Doença não relacionada ao trabalho',
  'Afastamento doença (duração menor que carência vigente)',
  'Acidente de trabalho',
  'Licença-maternidade',
  'Licença-paternidade',
  'Outro',
];

export const SITUACOES = ['Ativa', 'Inativa'];

/** Quantos dias antes do vencimento do ASO o sistema começa a avisar. */
export const DIAS_AVISO_ASO = 30;

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);

/** "AUXILIAR DE SERVICOS" -> "Auxiliar de Servicos" (para cargos digitados à mão em maiúsculas). */
export const capitalizar = (texto) =>
  String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

/**
 * Cargo escrito de qualquer jeito -> cargo da lista, quando for o mesmo
 * (ignora acentos, maiúsculas, "(A)" e nomes cortados pela planilha).
 * Cargo que não está na lista é mantido, só com as maiúsculas arrumadas.
 */
export const normalizarCargo = (valor) => {
  if (vazio(valor)) return '';
  const k = chave(String(valor).replace(/\((a|o|as|os)\)/gi, ''));
  const semFlexao = (c) => chave(c.replace(/\((a|o|as|os)\)/gi, ''));
  const exato = CARGOS.find((c) => semFlexao(c) === k);
  if (exato) return exato;
  // Nome cortado (ex.: "agente de desenvolvimento infa") ou só o começo do cargo.
  if (k.length >= 8) {
    const parecido = CARGOS.filter((c) => semFlexao(c).startsWith(k) || k.startsWith(semFlexao(c)));
    if (parecido.length === 1) return parecido[0];
  }
  // Variações de gênero: "diretora educacional" -> Diretor(a) Educacional.
  const raiz = (s) => s.split(' ').map((p) => p.replace(/(a|o)$/, '')).join(' ');
  const porRaiz = CARGOS.filter((c) => raiz(semFlexao(c)) === raiz(k));
  if (porRaiz.length === 1) return porRaiz[0];
  return capitalizar(valor);
};

const ymdDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const diasEntre = (deYmd, ateYmd) => {
  const [a1, m1, d1] = deYmd.split('-').map(Number);
  const [a2, m2, d2] = ateYmd.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
};

/**
 * O que está acontecendo com o funcionário hoje (calculado pelas datas).
 * @returns {{ ativo, afastado, retornoEmDias, asoVencido, asoVencendo, diasParaAso }}
 */
export function situacaoDoFuncionario(f, hoje = new Date()) {
  const h = ymdDe(hoje);
  const ativo = f?.situacao !== 'Inativa';
  const afastado = ativo && !!f?.afastamentoInicio && f.afastamentoInicio <= h
    && (!f.afastamentoRetorno || f.afastamentoRetorno > h);
  const retornoEmDias = afastado && f.afastamentoRetorno ? diasEntre(h, f.afastamentoRetorno) : null;
  const diasParaAso = ativo && f?.dataVencimentoAso ? diasEntre(h, f.dataVencimentoAso) : null;
  return {
    ativo,
    afastado,
    retornoEmDias,
    diasParaAso,
    asoVencido: diasParaAso !== null && diasParaAso < 0,
    asoVencendo: diasParaAso !== null && diasParaAso >= 0 && diasParaAso <= DIAS_AVISO_ASO,
  };
}

/** Idade em anos completos (ou null sem data de nascimento). */
export const idade = (dataNascimento, hoje = new Date()) => {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split('-').map(Number);
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos -= 1;
  return anos;
};

/** Vencimento sugerido do ASO periódico: um ano depois do último exame. */
export const vencimentoSugeridoDoAso = (ultimoAso) => {
  if (!ultimoAso) return '';
  const [a, m, d] = ultimoAso.split('-').map(Number);
  return ymdDe(new Date(a + 1, m - 1, d));
};
