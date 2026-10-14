// Testes das regras do cadastro de funcionários (src/utils/funcionarios.js)
// e da conferência de CPF/PIS (src/importacao/normalizar.js). Dados fictícios.
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  normalizarCargo, situacaoDoFuncionario, idade, vencimentoSugeridoDoAso, capitalizar,
} from '../../src/utils/funcionarios.js';
import { cpf, cpfValido, pis, pisValido } from '../../src/importacao/normalizar.js';
import { gerarDadosDemo } from '../../src/demo/dadosDemo.js';

const HOJE = new Date(2026, 9, 14, 12);

/** Completa 10 dígitos com o verificador do PIS. */
const comDigitoDoPis = (base) => {
  const r = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2].reduce((t, p, k) => t + p * Number(base[k]), 0) % 11;
  return `${base}${r < 2 ? 0 : 11 - r}`;
};

describe('cargo', () => {
  test('nome cortado ou em maiúsculas vira o cargo da lista', () => {
    assert.equal(normalizarCargo('AGENTE DE DESENVOLVIMENTO INFA'), 'Agente de Desenvolvimento Infantil');
    assert.equal(normalizarCargo('PROFESSOR(A) DE EDUCACAO INFANTIL'), 'Professor(a) de Educação Infantil');
    assert.equal(normalizarCargo('Diretora Educacional'), 'Diretor(a) Educacional');
    assert.equal(normalizarCargo('psicologa'), 'Psicólogo(a)');
    assert.equal(normalizarCargo('menor aprendiz'), 'Menor Aprendiz');
  });

  test('cargo fora da lista é mantido, com maiúsculas arrumadas', () => {
    assert.equal(normalizarCargo('COZINHEIRA'), 'Cozinheira');
    assert.equal(normalizarCargo('nutricionista de campo'), 'Nutricionista de Campo');
    assert.equal(normalizarCargo(''), '');
    assert.equal(capitalizar('  AUXILIAR   DE COZINHA '), 'Auxiliar de Cozinha');
  });
});

describe('situação do funcionário', () => {
  test('afastado entre o início e o retorno', () => {
    const f = { situacao: 'Ativa', afastamentoInicio: '2026-10-01', afastamentoRetorno: '2026-10-20' };
    assert.equal(situacaoDoFuncionario(f, HOJE).afastado, true);
    assert.equal(situacaoDoFuncionario(f, HOJE).retornoEmDias, 6);
    assert.equal(situacaoDoFuncionario({ ...f, afastamentoRetorno: '2026-10-14' }, HOJE).afastado, false);
    assert.equal(situacaoDoFuncionario({ ...f, afastamentoRetorno: '' }, HOJE).afastado, true);
    assert.equal(situacaoDoFuncionario({ ...f, situacao: 'Inativa' }, HOJE).afastado, false);
  });

  test('ASO vencido, vencendo (30 dias) e em dia', () => {
    assert.equal(situacaoDoFuncionario({ dataVencimentoAso: '2026-10-13' }, HOJE).asoVencido, true);
    assert.equal(situacaoDoFuncionario({ dataVencimentoAso: '2026-11-13' }, HOJE).asoVencendo, true);
    const emDia = situacaoDoFuncionario({ dataVencimentoAso: '2026-11-14' }, HOJE);
    assert.equal(emDia.asoVencendo || emDia.asoVencido, false);
  });

  test('idade e vencimento sugerido do ASO', () => {
    assert.equal(idade('1990-10-15', HOJE), 35);
    assert.equal(idade('1990-10-14', HOJE), 36);
    assert.equal(vencimentoSugeridoDoAso('2026-03-10'), '2027-03-10');
    assert.equal(vencimentoSugeridoDoAso(''), '');
  });
});

describe('CPF e PIS', () => {
  test('CPF: dígitos verificadores e formato', () => {
    assert.equal(cpfValido('529.982.247-25'), true);
    assert.equal(cpfValido('529.982.247-26'), false);
    assert.equal(cpfValido('111.111.111-11'), false);
    assert.deepEqual(cpf('52998224725'), { valor: '529.982.247-25' });
    assert.ok(cpf('52998224726').aviso);
    assert.equal(cpf(1234567890).valor.length, 14); // o Excel come o zero da frente
  });

  test('PIS: dígito verificador e formato', () => {
    const ok = comDigitoDoPis('1205412143');
    assert.equal(pisValido(ok), true);
    assert.equal(pis(ok).aviso, undefined);
    assert.equal(pis(ok).valor, `${ok.slice(0, 3)}.${ok.slice(3, 8)}.${ok.slice(8, 10)}-${ok.slice(10)}`);
    const errado = `${ok.slice(0, 10)}${(Number(ok[10]) + 1) % 10}`;
    assert.equal(pisValido(errado), false);
    assert.ok(pis(errado).aviso);
  });

  test('os CPFs e PIS da demonstração passam na conferência e não se repetem', () => {
    const { funcionarios } = gerarDadosDemo();
    assert.ok(funcionarios.length >= 20);
    funcionarios.forEach((f) => {
      assert.ok(cpfValido(f.cpf), f.cpf);
      assert.ok(pisValido(f.pis), f.pis);
    });
    assert.equal(new Set(funcionarios.map((f) => f.cpf)).size, funcionarios.length);
  });
});
