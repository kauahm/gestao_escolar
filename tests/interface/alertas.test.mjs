// Testes dos alertas do painel (src/utils/alertas.js).
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calcularAlertas, contarPendencias, GRAVIDADE } from '../../src/utils/alertas.js';

const HOJE = new Date();
HOJE.setHours(12, 0, 0, 0);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (dias) => { const d = new Date(HOJE); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ts = (dias) => { const d = new Date(HOJE); d.setDate(d.getDate() + dias); return { toMillis: () => d.getTime(), toDate: () => d }; };
const chaves = (lista) => lista.map((a) => a.chave);

describe('chamados', () => {
  test('pendente cobra conforme a prioridade (Alta 2, Média 5, Baixa 10 dias)', () => {
    const manutencoes = [
      { id: 'a1', status: 'Pendente', prioridade: 'Alta', criadoEm: ts(-3) },
      { id: 'a2', status: 'Pendente', prioridade: 'Alta', criadoEm: ts(-1) },
      { id: 'm1', status: 'Pendente', prioridade: 'Média', criadoEm: ts(-6) },
      { id: 'm2', status: 'Pendente', prioridade: 'Média', criadoEm: ts(-4) },
      { id: 'b1', status: 'Pendente', prioridade: 'Baixa', criadoEm: ts(-11) },
      { id: 'b2', status: 'Pendente', prioridade: 'Baixa', criadoEm: ts(-9) },
    ];
    const alertas = calcularAlertas({ manutencoes, hoje: HOJE });
    assert.deepEqual(chaves(alertas).sort(), ['chamado:a1', 'chamado:b1', 'chamado:m1']);
    assert.equal(alertas.find((a) => a.chave === 'chamado:a1').gravidade, GRAVIDADE.CRITICO);
    assert.equal(alertas.find((a) => a.chave === 'chamado:m1').gravidade, GRAVIDADE.ATENCAO);
  });

  test('prazo estourado é crítico; concluído nunca cobra', () => {
    const alertas = calcularAlertas({
      manutencoes: [
        { id: 'p', status: 'Em andamento', prioridade: 'Baixa', prazo: ymd(-2), criadoEm: ts(-3), atualizadoEm: ts(-1) },
        { id: 'c', status: 'Concluído', prioridade: 'Alta', prazo: ymd(-20), criadoEm: ts(-30) },
      ],
      hoje: HOJE,
    });
    assert.deepEqual(chaves(alertas), ['chamado:p']);
    assert.equal(alertas[0].gravidade, GRAVIDADE.CRITICO);
    assert.match(alertas[0].detalhe, /estourado há 2 dias/);
  });

  test('em andamento sem atualização há 7 dias ou mais', () => {
    const alertas = calcularAlertas({
      manutencoes: [
        { id: 'x', status: 'Em andamento', criadoEm: ts(-20), atualizadoEm: ts(-8) },
        { id: 'y', status: 'Em andamento', criadoEm: ts(-20), atualizadoEm: ts(-2) },
      ],
      hoje: HOJE,
    });
    assert.deepEqual(chaves(alertas), ['chamado:x']);
    assert.match(alertas[0].detalhe, /sem atualização há 8 dias/);
  });

  test('vários motivos no mesmo chamado viram um alerta só', () => {
    const alertas = calcularAlertas({
      manutencoes: [{ id: 'z', status: 'Pendente', prioridade: 'Média', prazo: ymd(-1), criadoEm: ts(-10) }],
      hoje: HOJE,
    });
    assert.equal(alertas.length, 1);
    assert.match(alertas[0].detalhe, /estourado.*; pendente há 10 dias/);
  });
});

describe('ciclos', () => {
  test('vencido é crítico; perto de vencer (até 7 dias) é aviso; depois disso, nada', () => {
    const alertas = calcularAlertas({
      ciclos: [
        { id: 'v', tipo: 'Extintores', escolaNome: 'A', proximaExecucao: ymd(-3) },
        { id: 'p', tipo: 'Filtros', escolaNome: 'B', proximaExecucao: ymd(5) },
        { id: 'l', tipo: 'Caixa', escolaNome: 'C', proximaExecucao: ymd(20) },
      ],
      hoje: HOJE,
    });
    assert.deepEqual(alertas.map((a) => [a.chave, a.gravidade]), [['ciclo:v', GRAVIDADE.CRITICO], ['ciclo:p', GRAVIDADE.AVISO]]);
  });

  test('ciclo vencido com chamado aberto fica encaminhado (deixa de ser crítico)', () => {
    const alertas = calcularAlertas({
      ciclos: [{ id: 'v', tipo: 'Extintores', proximaExecucao: ymd(-3) }],
      manutencoes: [{ id: 'm', status: 'Pendente', prioridade: 'Média', cicloId: 'v', criadoEm: ts(0) }],
      hoje: HOJE,
    });
    const ciclo = alertas.find((a) => a.chave === 'ciclo:v');
    assert.equal(ciclo.gravidade, GRAVIDADE.ATENCAO);
    assert.equal(ciclo.chamado.id, 'm');
    assert.match(ciclo.detalhe, /chamado já aberto/);
  });
});

describe('contas', () => {
  test('vencidas viram um alerta resumido; perto de vencer, um por conta', () => {
    const alertas = calcularAlertas({
      contas: [
        { id: 'v1', status: 'A enviar', valor: 100, vencimento: ymd(-10), tipo: 'CPFL' },
        { id: 'v2', status: 'Vencida', valor: 50.5, vencimento: ymd(-2), tipo: 'SABESP' }, // status antigo gravado
        { id: 'h', status: 'A enviar', valor: 30, vencimento: ymd(0), tipo: 'CPFL' },
        { id: 'd', status: 'A enviar', valor: 30, vencimento: ymd(3), tipo: 'Outro', tipoCustomizado: 'Internet' },
        { id: 'l', status: 'A enviar', valor: 30, vencimento: ymd(4), tipo: 'CPFL' },
        { id: 'e', status: 'Enviada', valor: 999, vencimento: ymd(-30), tipo: 'CPFL' },
      ],
      hoje: HOJE,
    });
    const vencidas = alertas.find((a) => a.chave === 'contas-vencidas');
    assert.match(vencidas.titulo, /^2 contas vencidas/);
    assert.match(vencidas.detalhe, /150,50/);
    assert.match(vencidas.detalhe, /há 10 dias/);
    assert.ok(alertas.some((a) => a.chave === 'conta:h' && a.gravidade === GRAVIDADE.ATENCAO && a.detalhe === 'vence hoje'));
    assert.ok(alertas.some((a) => a.chave === 'conta:d' && a.gravidade === GRAVIDADE.AVISO && a.titulo.includes('Internet')));
    assert.ok(!alertas.some((a) => a.chave === 'conta:l' || a.chave === 'conta:e'));
  });
});

describe('adiar ("ciente, lembrar depois") e contagem', () => {
  const dados = {
    ciclos: [{ id: 'v', tipo: 'Extintores', proximaExecucao: ymd(-3) }],
    manutencoes: [{ id: 'a', status: 'Pendente', prioridade: 'Alta', criadoEm: ts(-5) }],
    hoje: HOJE,
  };

  test('alerta adiado até uma data futura fica marcado e não conta', () => {
    const alertas = calcularAlertas({ ...dados, adiados: { 'ciclo:v': { ate: ymd(2) } } });
    assert.equal(alertas.find((a) => a.chave === 'ciclo:v').adiadoAte, ymd(2));
    assert.equal(contarPendencias(alertas), 1);
  });

  test('adiamento vencido (até hoje ou antes) volta a cobrar', () => {
    const alertas = calcularAlertas({ ...dados, adiados: { 'ciclo:v': { ate: ymd(0) } } });
    assert.equal(alertas.find((a) => a.chave === 'ciclo:v').adiadoAte, undefined);
    assert.equal(contarPendencias(alertas), 2);
  });

  test('ordem: mais grave primeiro', () => {
    const alertas = calcularAlertas({
      ...dados,
      ciclos: [...dados.ciclos, { id: 'p', tipo: 'Filtros', proximaExecucao: ymd(2) }],
    });
    assert.deepEqual(alertas.map((a) => a.gravidade), [...alertas.map((a) => a.gravidade)].sort());
  });
});
