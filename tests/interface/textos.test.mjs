// Garante que os textos da interface ficam em português do Brasil e que a
// data e a saudação do painel saem no formato combinado.
// Rodar: npm test

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { dataPorExtenso, primeiroNome } from '../../src/utils/formatters.js';
import { TELAS, nomeDaTela, ROTULO_DO_PERFIL } from '../../src/config/telas.js';

const RAIZ = new URL('../../src/', import.meta.url);

const arquivos = (pasta) => readdirSync(pasta).flatMap((nome) => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(jsx?|html)$/.test(nome) ? [caminho] : [];
});

// Palavras e construções de Portugal que já apareceram no sistema (ou são
// comuns de aparecer) e o equivalente no Brasil.
const DE_PORTUGAL = [
  [/\bregistad[oa]s?\b/i, 'cadastrado(s) / registrado(s)'],
  [/\bregistos?\b/i, 'registro(s)'],
  [/\ba carregar\b/i, 'carregando'],
  [/\ba guardar\b/i, 'salvando'],
  [/\ba processar\b/i, 'processando'],
  [/\bcasa de banho\b/i, 'banheiro'],
  [/\bficheiros?\b/i, 'arquivo(s)'],
  [/\butilizador(es)?\b/i, 'usuário(s)'],
  [/\becr[ãa]s?\b/i, 'tela(s)'],
  [/\btelem[óo]ve(l|is)\b/i, 'celular(es)'],
  [/\bpalavra-passe\b/i, 'senha'],
  [/\bequipa\b/i, 'equipe'],
  [/\bcontacto(s)?\b/i, 'contato(s)'],
  [/\bactualiza/i, 'atualiza...'],
  [/\bmorada\b/i, 'endereço'],
  [/\bsecção\b/i, 'seção'],
];

describe('português do Brasil na interface', () => {
  const lista = arquivos(RAIZ.pathname.replace(/^\/([A-Za-z]:)/, '$1'));

  test('há arquivos para conferir', () => {
    assert.ok(lista.length > 30);
  });

  test('nenhuma palavra de Portugal no código das telas', () => {
    const achados = [];
    lista.forEach((caminho) => {
      readFileSync(caminho, 'utf8').split('\n').forEach((linha, i) => {
        DE_PORTUGAL.forEach(([padrao, troca]) => {
          if (padrao.test(linha)) achados.push(`${caminho.split(/[\\/]src[\\/]/)[1]}:${i + 1} -> use "${troca}"`);
        });
      });
    });
    assert.deepEqual(achados, []);
  });
});

describe('data e saudação do painel', () => {
  test('data por extenso só com a primeira letra maiúscula', () => {
    const texto = dataPorExtenso(new Date(2026, 9, 13));
    assert.equal(texto, 'Terça-feira, 13 de outubro de 2026');
  });

  test('primeiro nome', () => {
    assert.equal(primeiroNome('Alessandra Martins'), 'Alessandra');
    assert.equal(primeiroNome('  Ana  '), 'Ana');
    assert.equal(primeiroNome(''), '');
    assert.equal(primeiroNome(undefined), '');
  });
});

describe('nomes das telas', () => {
  test('cada endereço tem um nome, e o nome aceita barra no fim', () => {
    assert.equal(nomeDaTela('/admin/ciclos'), 'Ciclos');
    assert.equal(nomeDaTela('/admin/ciclos/'), 'Ciclos');
    assert.equal(nomeDaTela('/qualquer'), null);
    assert.equal(new Set(Object.values(TELAS)).size, Object.values(TELAS).length, 'nomes repetidos');
  });

  test('perfis aparecem em português', () => {
    assert.deepEqual(ROTULO_DO_PERFIL, { admin: 'Administração', administrativo: 'RH', diretora: 'Diretora' });
  });

  test('toda rota do sistema tem nome na tabela', () => {
    const app = readFileSync(new URL('App.jsx', RAIZ), 'utf8');
    const rotasAdmin = [...app.matchAll(/<Route path="(\w+)" element={<PrivateRoute/g)].map((m) => m[1]);
    rotasAdmin.forEach((r) => assert.ok(nomeDaTela(`/admin/${r}`), `/admin/${r} sem nome em config/telas.js`));
  });
});
