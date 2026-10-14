// Testes das conversões e da validação linha a linha (src/importacao).
// Rodar: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as n from '../../src/importacao/normalizar.js';
import { ESQUEMAS, acharEscola } from '../../src/importacao/esquemas.js';
import {
  camposObrigatoriosFaltando, encontrarCabecalho, resumir, validarLinhas,
} from '../../src/importacao/processar.js';

describe('conversões', () => {
  test('datas em vários formatos', () => {
    assert.equal(n.data('31/12/2026').valor, '2026-12-31');
    assert.equal(n.data('1/2/26').valor, '2026-02-01');
    assert.equal(n.data('2026-03-04').valor, '2026-03-04');
    assert.equal(n.data('05-11-2026').valor, '2026-11-05');
    assert.equal(n.data(new Date(2026, 9, 5, 23, 59)).valor, '2026-10-05');
    assert.equal(n.data(46300).valor, '2026-10-05'); // número de série do Excel
    assert.equal(n.data('').valor, '');
    assert.ok(n.data('31/02/2026').erro);
    assert.ok(n.data('amanhã').erro);
  });

  test('valores em reais', () => {
    assert.equal(n.dinheiro('R$ 1.234,56').valor, 1234.56);
    assert.equal(n.dinheiro('1234,5').valor, 1234.5);
    assert.equal(n.dinheiro('1.234').valor, 1234);
    assert.equal(n.dinheiro('1.234.567,89').valor, 1234567.89);
    assert.equal(n.dinheiro('1,234.56').valor, 1234.56);
    assert.equal(n.dinheiro('99.9').valor, 99.9);
    assert.equal(n.dinheiro(1500.555).valor, 1500.56);
    assert.equal(n.dinheiro('').valor, null);
    assert.ok(n.dinheiro('doze reais').erro);
  });

  test('competência', () => {
    assert.equal(n.competencia('10/2026').valor, 'Outubro/2026');
    assert.equal(n.competencia('3/26').valor, 'Março/2026');
    assert.equal(n.competencia('out/2026').valor, 'Outubro/2026');
    assert.equal(n.competencia('março de 2026').valor, 'Março/2026');
    assert.equal(n.competencia('Outubro/2026').valor, 'Outubro/2026');
    assert.equal(n.competencia('2026-10').valor, 'Outubro/2026');
    assert.equal(n.competencia(new Date(2026, 0, 1)).valor, 'Janeiro/2026');
    assert.equal(n.competencia('01/10/2026').valor, 'Outubro/2026');
    assert.ok(n.competencia('13/2026').erro);
  });

  test('telefone, CEP, e-mail, inteiros e Sim/Não', () => {
    assert.equal(n.telefone('19999990000').valor, '(19) 99999-0000');
    assert.equal(n.telefone('+55 (19) 3800-1234').valor, '(19) 3800-1234');
    assert.ok(n.telefone('9999-0000').aviso);
    assert.equal(n.cep(13180000).valor, '13180-000');
    assert.equal(n.cep('13.180-000').valor, '13180-000');
    assert.ok(n.email('sem-arroba').aviso);
    assert.equal(n.email(' Ana@Exemplo.ORG ').valor, 'ana@exemplo.org');
    assert.equal(n.inteiro('1.500 litros').valor, 1500);
    assert.ok(n.inteiro('muitos').erro);
    assert.equal(n.simNao('SIM').valor, true);
    assert.equal(n.simNao('não').valor, false);
    assert.ok(n.simNao('talvez').erro);
  });

  test('somar dias atravessa meses e anos sem erro de fuso', () => {
    assert.equal(n.somarDias('2026-12-20', 15), '2027-01-04');
    assert.equal(n.somarDias('2026-02-27', 2), '2026-03-01');
  });
});

const ESCOLAS = [
  { id: 'e1', nome: 'CEI Pequenos Passos', codigo: 'UE-01' },
  { id: 'e2', nome: 'CEI Girassol', codigo: 'UE-02' },
  { id: 'e3', nome: 'CEI Girassol II', codigo: 'UE-03' },
  { id: 'e4', nome: 'CEI Fechada', codigo: 'UE-04', situacao: 'Inativa' },
];

describe('achar a escola', () => {
  test('pelo código ou pelo nome, sem ligar para acento e maiúsculas', () => {
    assert.equal(acharEscola('ue-01', ESCOLAS).escola.id, 'e1');
    assert.equal(acharEscola('cei pequenos passos', ESCOLAS).escola.id, 'e1');
    assert.equal(acharEscola('CEI GIRASSOL', ESCOLAS).escola.id, 'e2');
  });

  test('nome parcial único é aceito com aviso; ambíguo ou inexistente é erro', () => {
    const parcial = acharEscola('Pequenos Passos', ESCOLAS);
    assert.equal(parcial.escola.id, 'e1');
    assert.ok(parcial.aviso);
    assert.ok(acharEscola('Girassol', ESCOLAS).erro.includes('ambígua'));
    assert.ok(acharEscola('Escola X', ESCOLAS).erro.includes('não encontrada'));
  });

  test('escola inativa não recebe lançamentos, com mensagem clara', () => {
    assert.ok(acharEscola('UE-04', ESCOLAS).erro.includes('inativa'));
    assert.ok(acharEscola('Fechada', ESCOLAS).erro.includes('inativa'));
  });
});

describe('cabeçalho', () => {
  test('acha a linha de títulos mesmo com título e linha em branco antes', () => {
    const linhas = [['Relatório de contas — outubro'], [], ['Unidade', 'Conta', 'Mês de referência', 'Valor total', 'Data de vencimento', 'Coluna estranha']];
    const { indice, mapeamento } = encontrarCabecalho(linhas, ESQUEMAS.contas);
    assert.equal(indice, 2);
    assert.deepEqual(mapeamento, { 0: 'escola', 1: 'tipo', 2: 'competencia', 3: 'valor', 4: 'vencimento' });
    assert.deepEqual(camposObrigatoriosFaltando(mapeamento, ESQUEMAS.contas), []);
  });

  test('aponta o campo obrigatório que falta', () => {
    const { mapeamento } = encontrarCabecalho([['Escola', 'Valor']], ESQUEMAS.contas);
    assert.deepEqual(camposObrigatoriosFaltando(mapeamento, ESQUEMAS.contas).map((c) => c.chave), ['tipo', 'competencia', 'vencimento']);
  });

  test('o modelo baixado pelo sistema é reconhecido por inteiro', () => {
    for (const esquema of Object.values(ESQUEMAS)) {
      const { mapeamento } = encontrarCabecalho([esquema.campos.map((c) => c.rotulo)], esquema);
      assert.equal(Object.keys(mapeamento).length, esquema.campos.length, esquema.id);
    }
  });
});

describe('validação de contas', () => {
  const titulos = ['Escola', 'Tipo', 'Competência', 'Valor (R$)', 'Vencimento', 'Nº do documento', 'Status'];
  const validar = (linhas, existentes = []) => {
    const { indice, mapeamento } = encontrarCabecalho([titulos, ...linhas], ESQUEMAS.contas);
    return validarLinhas([titulos, ...linhas], indice, mapeamento, ESQUEMAS.contas, { escolas: ESCOLAS, existentes }).registros;
  };

  test('linha boa vira o mesmo formato que a tela grava', () => {
    const [r] = validar([['UE-01', 'Energia', '10/2026', 'R$ 1.234,56', '15/11/2026', 'A-1', 'pago']]);
    assert.equal(r.situacao, 'ok');
    assert.deepEqual(r.dados, {
      escolaId: 'e1', escolaNome: 'CEI Pequenos Passos', tipo: 'CPFL', tipoCustomizado: '',
      competencia: 'Outubro/2026', valor: 1234.56, vencimento: '2026-11-15',
      numeroDocumento: 'A-1', status: 'Enviada', observacoes: '',
    });
    assert.equal(r.linha, 2);
  });

  test('tipo desconhecido vira "Outro" com aviso', () => {
    const [r] = validar([['UE-02', 'Dedetização', '10/2026', '300', '01/11/2026', '', '']]);
    assert.equal(r.situacao, 'aviso');
    assert.equal(r.dados.tipo, 'Outro');
    assert.equal(r.dados.tipoCustomizado, 'Dedetização');
    assert.equal(r.dados.status, 'A enviar');
  });

  test('erros por linha: escola, valor, data e campos em branco', () => {
    const rs = validar([
      ['Escola Inexistente', 'CPFL', '10/2026', '100', '01/11/2026'],
      ['UE-01', 'CPFL', '10/2026', '0', '01/11/2026'],
      ['UE-01', 'CPFL', '10/2026', '100', '31/02/2026'],
      ['UE-01', '', '', '100', ''],
    ]);
    assert.ok(rs[0].erros.some((e) => e.includes('não encontrada')));
    assert.ok(rs[1].erros.some((e) => e.includes('maior que zero')));
    assert.ok(rs[2].erros.some((e) => e.startsWith('Vencimento')));
    assert.ok(rs[3].erros.includes('Tipo é obrigatório'));
    assert.ok(rs[3].erros.includes('Competência é obrigatório'));
    assert.ok(rs[3].erros.includes('Vencimento é obrigatório'));
    assert.ok(rs.every((r) => r.situacao === 'erro'));
  });

  test('repetida na planilha e já cadastrada no sistema', () => {
    const existente = { escolaId: 'e2', tipo: 'SABESP', tipoCustomizado: '', competencia: 'Outubro/2026', numeroDocumento: 'X9', valor: 50 };
    const rs = validar([
      ['UE-01', 'CPFL', '10/2026', '100', '01/11/2026', 'N1'],
      ['ue-01', 'luz', 'outubro/2026', '100,00', '01/11/2026', 'n1'],
      ['UE-02', 'SABESP', '10/2026', '50', '01/11/2026', 'X9'],
    ], [existente]);
    assert.equal(rs[0].situacao, 'ok');
    assert.ok(rs[1].erros[0].includes('repete a linha 2'));
    assert.ok(rs[2].erros[0].includes('já existe uma conta'));
  });

  test('linhas totalmente vazias são ignoradas', () => {
    const rs = validar([[], ['', '', ''], ['UE-01', 'CPFL', '10/2026', '100', '01/11/2026']]);
    assert.equal(rs.length, 1);
    assert.equal(rs[0].linha, 4);
    assert.deepEqual(resumir(rs), { total: 1, ok: 1, aviso: 0, erro: 0, importaveis: 1 });
  });
});

describe('validação de escolas, ciclos e currículos', () => {
  const rodar = (esquema, titulos, linhas, contexto = {}) => {
    const { indice, mapeamento } = encontrarCabecalho([titulos, ...linhas], esquema);
    return validarLinhas([titulos, ...linhas], indice, mapeamento, esquema, { escolas: ESCOLAS, ...contexto }).registros;
  };

  test('escola: só o nome é obrigatório; faltas viram aviso; números e máscaras', () => {
    const [a, b, c] = rodar(ESQUEMAS.escolas, ['Escola', 'Bairro', 'Endereço', 'Diretora', 'Alunos', 'CEP', 'Situação'], [
      ['CEI Novo', 'Centro', 'Rua 1', 'Ana', '1.200', '13180000', 'inativa'],
      ['CEI Sem Dados', '', '', '', '', '', ''],
      ['cei pequenos passos', 'x', 'y', 'z', '', '', ''],
    ], { existentes: ESCOLAS });
    assert.equal(a.situacao, 'ok');
    assert.equal(a.dados.numeroAlunos, 1200);
    assert.equal(a.dados.cep, '13180-000');
    assert.equal(a.dados.situacao, 'Inativa');
    assert.equal(b.situacao, 'aviso');
    assert.equal(b.dados.numeroAlunos, 0);
    assert.equal(b.dados.situacao, 'Ativa');
    assert.ok(c.erros[0].includes('já existe uma escola'));
  });

  test('ciclo: tipo reconhecido por palavra-chave, periodicidade padrão e próxima execução', () => {
    const [a, b, c] = rodar(ESQUEMAS.ciclos, ['Escola', 'Serviço', 'Data da última execução', 'Dias'], [
      ['UE-01', 'limpeza caixa dagua', '15/04/2026', ''],
      ['UE-01', 'Extintores', '01/01/2026', '180'],
      ['UE-02', 'Pintura geral', '01/01/2026', ''],
    ]);
    assert.equal(a.dados.tipo, "Limpeza de caixa d'água");
    assert.equal(a.dados.periodicidadeDias, 180);
    assert.equal(a.dados.proximaExecucao, '2026-10-12');
    assert.equal(b.dados.periodicidadeDias, 180);
    assert.equal(b.dados.proximaExecucao, '2026-06-30');
    assert.ok(c.erros[0].includes('desconhecido'));
  });

  test('currículo: obrigatórios, experiência e pessoa repetida pelo telefone', () => {
    const rs = rodar(ESQUEMAS.curriculos, ['Nome completo', 'Celular', 'Cargo', 'Experiência'], [
      ['Ana Souza', '19 99999-0000', 'Cozinheira', 'sim'],
      ['Ana S.', '(19) 99999-0000', 'Cozinheira', ''],
      ['Sem Telefone', '', 'Auxiliar', ''],
    ]);
    assert.equal(rs[0].situacao, 'ok');
    assert.equal(rs[0].dados.exp, 'Sim');
    assert.equal(rs[0].dados.status, 'Disponível');
    assert.ok(rs[1].erros[0].includes('repete a linha 2'));
    assert.ok(rs[2].erros.includes('Telefone é obrigatório'));
  });
});
