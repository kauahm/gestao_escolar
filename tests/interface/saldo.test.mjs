// Testes do controle de saldo (src/utils/saldo.js). Números inventados.
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  SITUACAO, calcularSaldo, comoFicou, mesAtualNoPeriodo, mesesDoPeriodo, parcelasDoGasto, rotuloCurto,
  rotuloDoMes, somarMeses,
} from '../../src/utils/saldo.js';
import { gerarDadosDemo } from '../../src/demo/dadosDemo.js';

const moeda = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const periodo = { inicio: '2026-08', meses: 5 };
const rubricas = [
  { id: 'a', nome: 'Manutenção', verbaMensal: 1000 },
  { id: 'b', nome: 'Enxoval', verbaMensal: 100 },
  { id: 'c', nome: 'Sem verba', verbaMensal: 0 },
];
const gastos = [
  { rubricaId: 'a', valorTotal: 2500, parcelas: 1, data: '2026-08-12' }, // passa do teto de agosto
  { rubricaId: 'a', valorTotal: 900, parcelas: 3, primeiraParcela: '2026-09', data: '2026-09-02' }, // 300 em set, out, nov
  { rubricaId: 'b', valorTotal: 600, parcelas: 1, primeiraParcela: '2026-10' }, // estoura a verba (500)
  { rubricaId: 'b', valorTotal: 200, parcelas: 2, primeiraParcela: '2026-12' }, // 100 em dez e 100 em jan (fora)
];

describe('meses e parcelas', () => {
  test('meses do período, rótulos e mês que a tela abre', () => {
    assert.deepEqual(mesesDoPeriodo(periodo), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    assert.equal(somarMeses('2026-11', 3), '2027-02');
    assert.equal(somarMeses('2026-01', -1), '2025-12');
    assert.equal(rotuloDoMes('2026-10'), 'Outubro/2026');
    assert.equal(rotuloCurto('2026-10'), 'out/26');
    assert.equal(mesAtualNoPeriodo(periodo, new Date(2026, 9, 14)), '2026-10');
    assert.equal(mesAtualNoPeriodo(periodo, new Date(2026, 1, 1)), '2026-08');
    assert.equal(mesAtualNoPeriodo(periodo, new Date(2027, 5, 1)), '2026-12');
    assert.deepEqual(mesesDoPeriodo(null), []);
  });

  test('parcelas: divide igual, centavos que sobram na última, mês da data quando não há 1ª parcela', () => {
    assert.deepEqual(parcelasDoGasto({ valorTotal: 1000, parcelas: 3, primeiraParcela: '2026-11' }), [
      { mes: '2026-11', valor: 333.33 }, { mes: '2026-12', valor: 333.33 }, { mes: '2027-01', valor: 333.34 },
    ]);
    assert.deepEqual(parcelasDoGasto({ valorTotal: 50, data: '2026-08-31' }), [{ mes: '2026-08', valor: 50 }]);
    assert.equal(comoFicou({ valorTotal: 9000, parcelas: 3, primeiraParcela: '2026-10' }, moeda), '3x de R$ 3000,00 (out/26 a dez/26)');
    assert.equal(comoFicou({ valorTotal: 50, data: '2026-08-31' }, moeda), 'À vista em ago/26');
  });
});

describe('saldo e teto do mês (mesma regra da planilha)', () => {
  test('mês que passa do teto diminui o teto dos meses seguintes', () => {
    const ago = calcularSaldo({ rubricas, gastos, periodo, mes: '2026-08' }).linhas[0];
    // (5000 − 900 dos outros meses) ÷ 5 meses = 820
    assert.equal(ago.teto, 820);
    assert.equal(ago.aindaPode, -1680);
    assert.equal(ago.situacao, SITUACAO.PASSOU);

    const set = calcularSaldo({ rubricas, gastos, periodo, mes: '2026-09' }).linhas[0];
    // (5000 − 3100 dos outros meses) ÷ 4 = 475; gastou 300
    assert.equal(set.teto, 475);
    assert.equal(set.aindaPode, 175);
    assert.equal(set.situacao, SITUACAO.DENTRO);

    const out = calcularSaldo({ rubricas, gastos, periodo, mes: '2026-10' }).linhas[0];
    assert.equal(out.verba, 5000);
    assert.equal(out.lancado, 3400);
    assert.equal(out.ateOMes, 3100);
    assert.equal(out.depois, 300);
    assert.equal(out.saldo, 1600);
    assert.equal(out.teto, 633.33);
    assert.equal(out.tetos['2026-12'], 1600);
  });

  test('verba estourada, sem verba, parcelas fora do período e totais', () => {
    const s = calcularSaldo({ rubricas, gastos, periodo, mes: '2026-10' });
    const [, b, c] = s.linhas;
    assert.equal(b.saldo, -200);
    assert.equal(b.situacao, SITUACAO.ESTOURADA);
    assert.equal(b.foraDoPeriodo, 100);
    assert.equal(c.situacao, SITUACAO.SEM_VERBA);
    assert.equal(s.totais.verba, 5500);
    assert.equal(s.totais.lancado, 4100);
    assert.equal(s.totais.foraDoPeriodo, 100);
    // "Pode gastar" soma só o que sobra (quem passou não desconta das outras).
    assert.equal(s.totais.aindaPode, 333.33);
  });

  test('perto do teto (até 20% do teto sobrando) e lançamento de área excluída', () => {
    const r = [{ id: 'x', nome: 'X', verbaMensal: 1000 }];
    const s = calcularSaldo({ rubricas: r, gastos: [{ rubricaId: 'x', valorTotal: 850, primeiraParcela: '2026-08' }, { rubricaId: 'sumiu', valorTotal: 70, primeiraParcela: '2026-08' }], periodo, mes: '2026-08' });
    assert.equal(s.linhas[0].situacao, SITUACAO.PERTO);
    assert.equal(s.semRubrica, 70);
  });

  test('a demonstração tem período, áreas e gastos ligados a áreas existentes', () => {
    const { rubricas: rs, gastos: gs, config } = gerarDadosDemo();
    const per = config.find((c) => c.id === 'saldo');
    assert.equal(per.meses, 12);
    const ids = new Set(rs.map((r) => r.id));
    assert.ok(gs.every((g) => ids.has(g.rubricaId)));
    const s = calcularSaldo({ rubricas: rs, gastos: gs, periodo: per, mes: mesAtualNoPeriodo(per) });
    assert.ok(s.linhas.some((l) => l.situacao === SITUACAO.PASSOU), 'alguma área passa do teto no mês atual');
    assert.ok(s.totais.lancado > 0);
  });
});
