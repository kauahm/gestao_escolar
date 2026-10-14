// Planilhas que o sistema entrega na importação: o modelo para preencher e o
// relatório de erros para corrigir e reenviar.

import { gerarXlsx } from '../utils/planilhaXlsx.js';

const pad = (n) => String(n).padStart(2, '0');

const paraCelula = (v) => {
  if (v instanceof Date) return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return v ?? '';
};

export const baixarArquivo = (blob, nome) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const nomeSeguro = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').toLowerCase();

/** Modelo em branco: uma aba para preencher, uma com instruções e, se precisar, a lista de escolas. */
export const baixarModelo = (esquema, escolas = []) => {
  const abas = [
    {
      nome: 'Preencha aqui',
      colunas: esquema.campos.map((c) => (c.obrigatorio ? `${c.rotulo} *` : c.rotulo)),
      linhas: [],
    },
    {
      nome: 'Como preencher',
      colunas: ['Coluna', 'Obrigatória?', 'Como preencher', 'Exemplo'],
      linhas: [
        ...esquema.campos.map((c) => [c.rotulo, c.obrigatorio ? 'Sim' : 'Não', c.ajuda || '', c.exemplo ?? '']),
        [],
        ['Dicas', '', 'Uma linha por registro. Pode apagar as colunas que não for usar (menos as obrigatórias). Os títulos podem ter outros nomes parecidos: o sistema reconhece e deixa você conferir antes de importar.', ''],
      ],
    },
  ];
  if (esquema.precisaDeEscolas) {
    abas.push({
      nome: 'Escolas cadastradas',
      colunas: ['Nome (escolas ativas)', 'Código'],
      linhas: escolas
        .filter((e) => e.situacao !== 'Inativa')
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        .map((e) => [e.nome, e.codigo || '']),
    });
  }
  baixarArquivo(gerarXlsx(abas), `modelo-importacao-${nomeSeguro(esquema.titulo)}.xlsx`);
};

/** Relatório das linhas com erro ou aviso, com os valores originais, para corrigir e reenviar. */
export const baixarRelatorio = (esquema, registros, nomeArquivo) => {
  const campos = esquema.campos.filter((c) => registros.some((r) => r.original[c.chave] !== undefined));
  const comProblema = registros.filter((r) => r.situacao !== 'ok');
  const linhas = comProblema.map((r) => [
    r.linha,
    r.situacao === 'erro' ? 'Não importada' : 'Importada com aviso',
    [...r.erros, ...r.avisos].join('; '),
    ...campos.map((c) => paraCelula(r.original[c.chave])),
  ]);
  const blob = gerarXlsx([{
    nome: 'Linhas para conferir',
    colunas: ['Linha na planilha', 'Situação', 'O que corrigir', ...campos.map((c) => c.rotulo)],
    linhas,
  }]);
  const base = String(nomeArquivo || 'planilha').replace(/\.[^.]+$/, '');
  baixarArquivo(blob, `relatorio-${nomeSeguro(base)}.xlsx`);
};
