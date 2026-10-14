// Testes do leitor de planilhas (src/utils/lerPlanilha.js).
// Rodar: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { ErroDePlanilha, lerCsvTexto, lerPlanilha } from '../../src/utils/lerPlanilha.js';
import { partesDoXlsx } from '../../src/utils/planilhaXlsx.js';

const fixture = (nome) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('xlsx gerado por outra biblioteca (openpyxl)', async () => {
  const { formato, abas } = await lerPlanilha(fixture('openpyxl.xlsx'), 'openpyxl.xlsx');

  test('reconhece o formato e lê todas as abas visíveis, na ordem', () => {
    assert.equal(formato, 'xlsx');
    assert.deepEqual(abas.map((a) => a.nome), ['Escolas', 'Outra aba']);
  });

  test('textos com acento, aspas e símbolos', () => {
    assert.deepEqual(abas[0].linhas[0], ['Nome da escola', 'Código', 'Alunos', 'Valor', 'Vencimento', 'Ativa']);
    assert.equal(abas[0].linhas[1][0], 'CEI São José');
    assert.equal(abas[0].linhas[2][0], 'Escola "Aspas" & <Símbolos>');
  });

  test('números, verdadeiro/falso e células vazias', () => {
    assert.equal(abas[0].linhas[1][2], 120);
    assert.equal(abas[0].linhas[1][3], 1234.56);
    assert.equal(abas[0].linhas[2][2], 80.5);
    assert.equal(abas[0].linhas[2][3], '');
    assert.equal(abas[0].linhas[1][5], true);
    assert.equal(abas[0].linhas[2][5], false);
  });

  test('datas viram Date no dia certo (com e sem hora)', () => {
    const d1 = abas[0].linhas[1][4];
    const d2 = abas[0].linhas[2][4];
    assert.ok(d1 instanceof Date && d2 instanceof Date);
    assert.equal(ymd(d1), '2026-10-05');
    assert.equal(ymd(d2), '2026-01-31');
    assert.equal(d2.getHours(), 14);
    assert.equal(d2.getMinutes(), 30);
  });

  test('linhas vazias no meio e colunas distantes mantêm a posição', () => {
    assert.deepEqual(abas[0].linhas[3], []);
    assert.equal(abas[0].linhas[4][0], 'Depois da linha vazia');
    assert.equal(abas[0].linhas[6][9], 'longe');
    assert.equal(abas[0].linhas[6][0], '');
  });
});

describe('xlsx no formato que o Excel grava', async () => {
  const { abas } = await lerPlanilha(fixture('estilo_excel.xlsx'), 'estilo_excel.xlsx');

  test('ignora aba oculta e lê nome com entidade XML', () => {
    assert.deepEqual(abas.map((a) => a.nome), ['Contas & Água']);
  });

  test('textos compartilhados em partes, sem a fonética', () => {
    assert.deepEqual(abas[0].linhas[0], ['Escola', 'Vencimento', 'Valor']);
    assert.equal(abas[0].linhas[1][0], 'CEI Girassol');
  });

  test('texto direto na célula com caracteres codificados', () => {
    assert.equal(abas[0].linhas[2][0], 'Inline ção');
  });

  test('data com formato personalizado no sistema de datas de 1904', () => {
    assert.equal(ymd(abas[0].linhas[1][1]), '2025-10-06');
    assert.equal(ymd(abas[0].linhas[2][1]), '1904-01-01');
  });

  test('formato de moeda continua número; erro de fórmula vira vazio', () => {
    assert.equal(abas[0].linhas[1][2], 1500.5);
    assert.equal(abas[0].linhas[2][2], '');
  });
});

describe('xlsx gerado pelo próprio sistema (modelo e cópia de segurança)', () => {
  test('ida e volta preserva textos e números', async () => {
    const bytes = new Uint8Array(await new Blob(partesDoXlsx([
      { nome: 'Modelo', colunas: ['Nome', 'Valor'], linhas: [['CEI Ação & Cia', 10.5], ['Outra', '']] },
    ])).arrayBuffer());
    const { abas } = await lerPlanilha(bytes, 'modelo.xlsx');
    assert.deepEqual(abas[0].linhas, [['Nome', 'Valor'], ['CEI Ação & Cia', 10.5], ['Outra']]);
  });
});

describe('CSV', () => {
  test('ponto e vírgula, aspas e codificação antiga do Windows', async () => {
    const { formato, abas } = await lerPlanilha(fixture('latin1.csv'), 'latin1.csv');
    assert.equal(formato, 'csv');
    assert.deepEqual(abas[0].linhas, [
      ['Escola', 'Valor', 'Observações'],
      ['CEI Ação', '1.234,56', 'tem "aspas"; e ponto e vírgula'],
      ['CEI B', '10', ''],
    ]);
  });

  test('UTF-8 com BOM e vírgula como separador', async () => {
    const bytes = new TextEncoder().encode('﻿Nome,Valor\n"Silva, Ana",3\n');
    const { abas } = await lerPlanilha(bytes, 'x.csv');
    assert.deepEqual(abas[0].linhas, [['Nome', 'Valor'], ['Silva, Ana', '3']]);
  });

  test('quebra de linha dentro de aspas', () => {
    assert.deepEqual(lerCsvTexto('a;b\r\n"linha 1\nlinha 2";x'), [['a', 'b'], ['linha 1\nlinha 2', 'x']]);
  });
});

describe('arquivos que não são planilhas', () => {
  test('Excel antigo (.xls) tem mensagem explicando o que fazer', async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    await assert.rejects(lerPlanilha(xls, 'velho.xls'), (e) => e instanceof ErroDePlanilha && /Salvar como/.test(e.message));
  });

  test('arquivo vazio, .xlsx corrompido e PDF são recusados', async () => {
    await assert.rejects(lerPlanilha(new Uint8Array(), 'vazio.csv'), ErroDePlanilha);
    await assert.rejects(lerPlanilha(new TextEncoder().encode('isto não é zip'), 'falso.xlsx'), ErroDePlanilha);
    await assert.rejects(lerPlanilha(new TextEncoder().encode('%PDF-1.4'), 'doc.pdf'), ErroDePlanilha);
  });
});
