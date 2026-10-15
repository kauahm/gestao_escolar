// Testes da visão da sede (src/utils/sede.js e src/utils/contratos.js). Dados inventados.
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SEMAFORO, montarVisaoDaSede, situacaoDoContrato } from '../../src/utils/sede.js';
import { calcularAlertas, GRAVIDADE } from '../../src/utils/alertas.js';
import { gerarDadosDemo } from '../../src/demo/dadosDemo.js';

const HOJE = new Date();
HOJE.setHours(12, 0, 0, 0);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (dias) => { const d = new Date(HOJE); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ts = (dias) => { const d = new Date(HOJE); d.setDate(d.getDate() + dias); return { toMillis: () => d.getTime(), toDate: () => d }; };

describe('situação do contrato', () => {
  test('vigente, avisos de fim (90 e 30 dias), encerrado e ainda não começou', () => {
    assert.equal(situacaoDoContrato({ inicio: ymd(-10), fim: ymd(200) }, HOJE).rotulo, 'Vigente');
    assert.equal(situacaoDoContrato({ fim: ymd(60) }, HOJE).aviso, 'proximo');
    assert.equal(situacaoDoContrato({ fim: ymd(60) }, HOJE).rotulo, 'Vence em 60 dias');
    assert.equal(situacaoDoContrato({ fim: ymd(20) }, HOJE).aviso, 'urgente');
    assert.equal(situacaoDoContrato({ fim: ymd(0) }, HOJE).rotulo, 'Vence hoje');
    assert.equal(situacaoDoContrato({ fim: ymd(-1) }, HOJE).encerrado, true);
    assert.equal(situacaoDoContrato({ inicio: ymd(5) }, HOJE).rotulo, 'Ainda não começou');
    assert.equal(situacaoDoContrato({}, HOJE).vigente, true);
  });
});

describe('semáforo por município', () => {
  const municipios = [{ id: 'm1', nome: 'Alfa', uf: 'SP' }, { id: 'm2', nome: 'Beta', uf: 'SP' }, { id: 'm3', nome: 'Gama', uf: 'SP' }];
  const contratos = [
    { id: 'c1', municipioId: 'm1', numero: 'TC 1', fim: ymd(400) },
    { id: 'c2', municipioId: 'm2', numero: 'TC 2', fim: ymd(400) },
    { id: 'c3', municipioId: 'm3', numero: 'TC 3', fim: ymd(10) }, // vence logo
  ];
  const escolas = [
    { id: 'e1', nome: 'E1', contratoId: 'c1', situacao: 'Ativa', numeroAlunos: 100 },
    { id: 'e2', nome: 'E2', contratoId: 'c1', situacao: 'Ativa', numeroAlunos: 50 },
    { id: 'e3', nome: 'E3', contratoId: 'c2', situacao: 'Ativa', numeroAlunos: 80 },
    { id: 'e4', nome: 'E4', contratoId: 'c3', situacao: 'Ativa', numeroAlunos: 30 },
    { id: 'e5', nome: 'E5', contratoId: '', situacao: 'Ativa', numeroAlunos: 10 },
    { id: 'e6', nome: 'E6', contratoId: 'c2', situacao: 'Inativa', numeroAlunos: 999 },
  ];
  const dados = {
    municipios, contratos, escolas,
    contas: [{ id: 'k1', escolaId: 'e1', status: 'A enviar', vencimento: ymd(-5), valor: 300 }], // crítico em Alfa
    manutencoes: [{ id: 'x', escolaId: 'e3', status: 'Em andamento', prioridade: 'Média', criadoEm: ts(-20), atualizadoEm: ts(-10) }], // atenção em Beta
    ciclos: [],
    funcionarios: [{ escolaId: 'e3', situacao: 'Ativa' }, { escolaId: 'e3', situacao: 'Inativa' }],
    hoje: HOJE,
  };

  test('o pior caso de cada escola decide a cor do município; contrato no fim pede atenção', () => {
    const v = montarVisaoDaSede(dados);
    const cor = Object.fromEntries(v.grupos.map((g) => [g.municipio.nome, g.semaforo]));
    assert.deepEqual(cor, { Alfa: SEMAFORO.CRITICO, Beta: SEMAFORO.ATENCAO, Gama: SEMAFORO.ATENCAO });
    assert.equal(v.grupos[0].municipio.nome, 'Alfa'); // mais grave primeiro
  });

  test('totais por município, escolas inativas e escolas sem contrato', () => {
    const v = montarVisaoDaSede(dados);
    const alfa = v.grupos.find((g) => g.municipio.id === 'm1');
    assert.equal(alfa.totais.escolas, 2);
    assert.equal(alfa.totais.alunos, 150);
    assert.equal(alfa.totais.contasVencidas, 1);
    assert.equal(alfa.totais.valorVencido, 300);
    const beta = v.grupos.find((g) => g.municipio.id === 'm2');
    assert.equal(beta.totais.escolas, 1); // a inativa não conta
    assert.equal(beta.totais.alunos, 80);
    assert.equal(beta.totais.funcionariosAtivos, 1);
    assert.equal(beta.totais.chamadosAbertos, 1);
    assert.deepEqual(v.semMunicipio.escolas.map((i) => i.escola.id), ['e5']);
    assert.equal(v.totais.escolas, 5);
    assert.equal(v.totais.contratosVigentes, 3);
  });
});

describe('alertas de contrato', () => {
  const sede = {
    municipios: [{ id: 'm1', nome: 'Alfa' }],
    contratos: [
      { id: 'a', municipioId: 'm1', numero: 'TC A', fim: ymd(60) },
      { id: 'b', municipioId: 'm1', numero: 'TC B', fim: ymd(15) },
      { id: 'c', municipioId: 'm1', numero: 'TC C', fim: ymd(-3) },
      { id: 'd', municipioId: 'm1', numero: 'TC D', fim: ymd(-3) }, // vencido, mas sem escolas ativas
      { id: 'e', municipioId: 'm1', numero: 'TC E', fim: ymd(300) },
    ],
    escolas: [{ id: 'e1', contratoId: 'c', situacao: 'Ativa' }, { id: 'e2', contratoId: 'd', situacao: 'Inativa' }],
  };

  test('vence em até 90 dias avisa, até 30 cobra atenção; vencido com escola ativa cobra atenção', () => {
    const alertas = calcularAlertas({ sede, hoje: HOJE });
    const por = Object.fromEntries(alertas.map((a) => [a.alvo.id, a]));
    assert.deepEqual(Object.keys(por).sort(), ['a', 'b', 'c']);
    assert.equal(por.a.gravidade, GRAVIDADE.AVISO);
    assert.equal(por.b.gravidade, GRAVIDADE.ATENCAO);
    assert.equal(por.c.gravidade, GRAVIDADE.ATENCAO);
    assert.match(por.c.detalhe, /1 escola ativa ainda ligada/);
    assert.equal(por.a.escolaNome, 'Alfa');
  });
});

test('a demonstração tem municípios, contratos e todas as escolas ligadas', () => {
  const { municipios, contratos, escolas } = gerarDadosDemo();
  const ids = new Set(contratos.map((c) => c.id));
  assert.equal(municipios.length, 4);
  assert.ok(escolas.every((e) => ids.has(e.contratoId)));
  const v = montarVisaoDaSede({ municipios, contratos, escolas });
  assert.equal(v.semMunicipio, null);
  assert.equal(v.totais.municipios, 3); // Sorocaba só tem contrato encerrado
});
