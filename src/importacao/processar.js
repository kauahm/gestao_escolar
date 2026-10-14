// Da planilha lida (linhas) até a lista de registros validados, prontos para
// a pré-visualização: acha o cabeçalho, liga cada coluna a um campo, converte
// e valida linha a linha e marca repetidos.

import { chave, vazio } from './normalizar.js';

/** Limite por importação, para não estourar a cota gratuita do Firebase num clique. */
export const MAXIMO_DE_LINHAS = 2000;

/** Qual campo do esquema corresponde a um título de coluna (ou null). */
export const campoDoCabecalho = (titulo, esquema) => {
  const k = chave(titulo);
  if (!k) return null;
  const nomes = (c) => [c.rotulo, c.chave, ...(c.sinonimos || [])].map(chave);
  const exato = esquema.campos.find((c) => nomes(c).includes(k));
  if (exato) return exato.chave;
  // Sem nome exato: o título começa com algum nome conhecido ("Valor total pago" -> valor).
  let melhor = null;
  let tamanho = 0;
  esquema.campos.forEach((c) => {
    nomes(c).forEach((nome) => {
      if (nome.length >= 3 && (k.startsWith(`${nome} `) || k === nome) && nome.length > tamanho) {
        melhor = c.chave;
        tamanho = nome.length;
      }
    });
  });
  return melhor;
};

/** Liga as colunas de uma linha de títulos aos campos. Cada campo é usado uma vez só. */
export const mapearCabecalho = (titulos, esquema) => {
  const mapeamento = {};
  const usados = new Set();
  titulos.forEach((titulo, coluna) => {
    const campo = campoDoCabecalho(titulo, esquema);
    if (campo && !usados.has(campo)) {
      mapeamento[coluna] = campo;
      usados.add(campo);
    }
  });
  return mapeamento;
};

/**
 * Procura, nas primeiras linhas, a linha de títulos (às vezes a planilha tem
 * um título ou linhas em branco antes). Escolhe a que mais casa com os campos.
 */
export const encontrarCabecalho = (linhas, esquema) => {
  let melhor = { indice: -1, mapeamento: {}, acertos: 0 };
  linhas.slice(0, 15).forEach((linha, indice) => {
    const mapeamento = mapearCabecalho(linha || [], esquema);
    const acertos = Object.keys(mapeamento).length;
    if (acertos > melhor.acertos) melhor = { indice, mapeamento, acertos };
  });
  return melhor;
};

export const camposObrigatoriosFaltando = (mapeamento, esquema) => {
  const presentes = new Set(Object.values(mapeamento));
  return esquema.campos.filter((c) => c.obrigatorio && !presentes.has(c.chave));
};

/**
 * Converte e valida as linhas de dados.
 * @param {any[][]} linhas  todas as linhas da aba
 * @param {number} indiceCabecalho  linha dos títulos (as de dados vêm depois)
 * @param {Object<number,string>} mapeamento  coluna -> campo
 * @param {object} esquema
 * @param {{ escolas?: object[], existentes?: object[] }} contexto
 * @returns {{ registros: object[], excedeuLimite: boolean }}
 */
export const validarLinhas = (linhas, indiceCabecalho, mapeamento, esquema, contexto = {}) => {
  // Chaves dos registros que já estão no sistema.
  const jaExistem = new Set();
  (contexto.existentes || []).forEach((r) => esquema.chavesDeDuplicidade(r).forEach((k) => jaExistem.add(k)));

  const vistasNoArquivo = new Map(); // chave -> número da linha
  const registros = [];
  let excedeuLimite = false;

  for (let i = indiceCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i] || [];
    const valores = {};
    Object.entries(mapeamento).forEach(([coluna, campo]) => { valores[campo] = linha[Number(coluna)]; });
    if (Object.values(valores).every(vazio)) continue; // linha em branco

    if (registros.length >= MAXIMO_DE_LINHAS) { excedeuLimite = true; break; }

    const numeroDaLinha = i + 1; // como aparece no Excel
    const { dados, erros, avisos } = esquema.converter(valores, contexto);

    if (!erros.length) {
      const chaves = esquema.chavesDeDuplicidade(dados);
      const existente = chaves.find((k) => jaExistem.has(k));
      const repetida = chaves.find((k) => vistasNoArquivo.has(k));
      if (existente) erros.push(`já existe ${artigo(esquema)} ${esquema.nomeDoRegistro} igual no sistema`);
      else if (repetida) erros.push(`repete a linha ${vistasNoArquivo.get(repetida)} da planilha`);
      else chaves.forEach((k) => vistasNoArquivo.set(k, numeroDaLinha));
    }

    registros.push({
      linha: numeroDaLinha,
      original: valores,
      dados,
      erros,
      avisos,
      situacao: erros.length ? 'erro' : avisos.length ? 'aviso' : 'ok',
    });
  }
  return { registros, excedeuLimite };
};

const artigo = (esquema) => (['conta', 'escola'].includes(esquema.nomeDoRegistro) ? 'uma' : 'um');

/** Totais para o resumo da pré-visualização. */
export const resumir = (registros) => ({
  total: registros.length,
  ok: registros.filter((r) => r.situacao === 'ok').length,
  aviso: registros.filter((r) => r.situacao === 'aviso').length,
  erro: registros.filter((r) => r.situacao === 'erro').length,
  importaveis: registros.filter((r) => r.situacao !== 'erro').length,
});
