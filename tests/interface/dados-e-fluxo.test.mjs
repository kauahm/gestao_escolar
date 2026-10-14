// Testes do bloco D: competência, responsável do chamado e linha do tempo.
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  partesDaCompetencia, competenciaDe, ordemDaCompetencia, mesesEntreCompetenciaEVencimento,
} from '../../src/importacao/normalizar.js';
import { prestadorDoChamado, nomeDoResponsavel, responsavelNaoCadastrado } from '../../src/utils/responsavel.js';
import { linhaDoTempoDoChamado } from '../../src/utils/linhaDoTempo.js';
import { ESQUEMAS } from '../../src/importacao/esquemas.js';
import { encontrarCabecalho, validarLinhas } from '../../src/importacao/processar.js';

describe('competência', () => {
  test('textos antigos digitados à mão viram o formato padrão', () => {
    assert.equal(partesDaCompetencia('ABRIL/2026').texto, 'Abril/2026');
    assert.equal(partesDaCompetencia('MAIO/26').texto, 'Maio/2026');
    assert.equal(partesDaCompetencia('junho/26').texto, 'Junho/2026');
    assert.deepEqual(partesDaCompetencia('Outubro/2026'), { mes: 10, ano: 2026, texto: 'Outubro/2026' });
    assert.equal(partesDaCompetencia('qualquer coisa'), null);
    assert.equal(partesDaCompetencia(''), null);
  });

  test('montar a partir de mês e ano', () => {
    assert.equal(competenciaDe(3, 2026), 'Março/2026');
    assert.equal(competenciaDe(12, 2025), 'Dezembro/2025');
  });

  test('ordenar por data, não em ordem alfabética', () => {
    const lista = ['Abril/2026', 'Janeiro/2026', 'Dezembro/2025', 'texto estranho', 'Outubro/2026'];
    const ordenada = [...lista].sort((a, b) => ordemDaCompetencia(b) - ordemDaCompetencia(a));
    assert.deepEqual(ordenada, ['Outubro/2026', 'Abril/2026', 'Janeiro/2026', 'Dezembro/2025', 'texto estranho']);
  });

  test('distância entre competência e vencimento (o caso "abril/2025 vencendo em maio/2026")', () => {
    assert.equal(mesesEntreCompetenciaEVencimento('Abril/2026', '2026-05-10'), 1);
    assert.equal(mesesEntreCompetenciaEVencimento('Abril/2025', '2026-05-10'), 13);
    assert.equal(mesesEntreCompetenciaEVencimento('Maio/2026', '2026-04-30'), -1);
    assert.equal(mesesEntreCompetenciaEVencimento('', '2026-05-10'), null);
    assert.equal(mesesEntreCompetenciaEVencimento('Abril/2026', ''), null);
  });

  test('importação avisa (sem barrar) competência muito longe do vencimento', () => {
    const titulos = ['Escola', 'Tipo', 'Competência', 'Valor', 'Vencimento'];
    const linhas = [titulos, ['UE-01', 'CPFL', '04/2025', '100', '10/05/2026'], ['UE-01', 'SABESP', '04/2026', '100', '10/05/2026']];
    const { indice, mapeamento } = encontrarCabecalho(linhas, ESQUEMAS.contas);
    const { registros } = validarLinhas(linhas, indice, mapeamento, ESQUEMAS.contas, { escolas: [{ id: 'e1', nome: 'CEI A', codigo: 'UE-01' }] });
    assert.equal(registros[0].situacao, 'aviso');
    assert.ok(registros[0].avisos[0].includes('13 meses'));
    assert.equal(registros[1].situacao, 'ok');
  });
});

const PRESTADORES = [
  { id: 'p1', nome: 'Elétrica Luz Certa', telefone: '(19) 99111-0001' },
  { id: 'p2', nome: 'José Carlos' },
];

describe('responsável do chamado', () => {
  test('pelo identificador, acompanhando o nome atual do cadastro', () => {
    const chamado = { responsavelId: 'p1', responsavel: 'Nome antigo da empresa' };
    assert.equal(prestadorDoChamado(chamado, PRESTADORES).id, 'p1');
    assert.equal(nomeDoResponsavel(chamado, PRESTADORES), 'Elétrica Luz Certa');
    assert.equal(responsavelNaoCadastrado(chamado, PRESTADORES), false);
  });

  test('registro antigo só com o nome: liga pelo nome, se existir', () => {
    assert.equal(prestadorDoChamado({ responsavel: 'José Carlos' }, PRESTADORES).id, 'p2');
  });

  test('nome que não está no cadastro (o caso "Vitor")', () => {
    const chamado = { responsavel: 'Vitor' };
    assert.equal(prestadorDoChamado(chamado, PRESTADORES), null);
    assert.equal(nomeDoResponsavel(chamado, PRESTADORES), 'Vitor');
    assert.equal(responsavelNaoCadastrado(chamado, PRESTADORES), true);
  });

  test('"A definir" e prestador excluído', () => {
    assert.equal(nomeDoResponsavel({ responsavel: 'A definir' }, PRESTADORES), 'A definir');
    assert.equal(responsavelNaoCadastrado({ responsavel: 'A definir' }, PRESTADORES), false);
    assert.equal(nomeDoResponsavel({}, PRESTADORES), 'A definir');
    // Prestador apagado do cadastro: mostra o nome guardado no chamado e avisa.
    const orfao = { responsavelId: 'p9', responsavel: 'Antônio Pinturas' };
    assert.equal(nomeDoResponsavel(orfao, PRESTADORES), 'Antônio Pinturas');
    assert.equal(responsavelNaoCadastrado(orfao, PRESTADORES), true);
  });
});

const ts = (iso) => ({ toMillis: () => new Date(iso).getTime() });

describe('linha do tempo do chamado', () => {
  const nomes = { u1: 'Ana', u2: 'Helena' };
  const nomeDe = (uid, email) => nomes[uid] || email;

  test('monta os eventos do histórico, do mais recente para o mais antigo', () => {
    const chamado = { status: 'Concluído', criadoEm: ts('2026-10-01T09:00:00'), concluidoEm: ts('2026-10-05T16:00:00') };
    const historico = [
      { id: 'h1', acao: 'criar', porUid: 'u2', em: ts('2026-10-01T09:00:00'), depois: { status: 'Pendente' } },
      { id: 'h2', acao: 'alterar', porUid: 'u1', em: ts('2026-10-02T10:00:00'), antes: { status: 'Pendente', responsavel: 'A definir', responsavelId: null }, depois: { status: 'Em andamento', responsavel: 'José Carlos', responsavelId: 'p2' } },
      { id: 'h3', acao: 'alterar', porUid: 'u1', em: ts('2026-10-03T11:00:00'), antes: { prazo: '' , descricao: 'a' }, depois: { prazo: '2026-10-10', descricao: 'b' } },
      { id: 'h4', acao: 'alterar', porUid: 'u1', em: ts('2026-10-05T16:00:00'), antes: { status: 'Em andamento', concluidoEm: null }, depois: { status: 'Concluído' } },
      { id: 'h5', acao: 'alterar', porUid: 'u1', em: ts('2026-10-05T16:01:00'), antes: {}, depois: { concluidoEm: 'x' } }, // só campo interno: some
    ];
    const eventos = linhaDoTempoDoChamado(chamado, historico, nomeDe);
    assert.deepEqual(eventos.map((e) => e.titulo), [
      'Status: Em andamento → Concluído',
      'Chamado alterado',
      'Status: Pendente → Em andamento',
      'Chamado aberto',
    ]);
    assert.deepEqual(eventos[1].detalhes, ['Prazo: sem prazo → 10/10/2026', 'Descrição alterada']);
    assert.deepEqual(eventos[2].detalhes, ['Responsável: A definir → José Carlos']);
    assert.equal(eventos[2].quem, 'Ana');
    assert.equal(eventos[3].quem, 'Helena');
    assert.match(eventos[0].quando, /05\/10\/2026/);
  });

  test('chamado antigo, sem histórico: abertura e conclusão vêm das datas do próprio chamado', () => {
    const chamado = { status: 'Concluído', solicitadaPorNome: 'Helena', criadoEm: ts('2026-09-01T08:00:00'), concluidoEm: ts('2026-09-03T08:00:00') };
    const eventos = linhaDoTempoDoChamado(chamado, [], nomeDe);
    assert.deepEqual(eventos.map((e) => e.titulo), ['Concluído', 'Chamado aberto']);
    assert.equal(eventos[1].quem, 'Helena');
  });
});
