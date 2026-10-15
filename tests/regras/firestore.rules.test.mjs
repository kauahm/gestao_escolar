// Testes das regras de segurança do Firestore (firestore.rules).
//
// Rodam SOMENTE contra o emulador local, com um projeto fictício ("demo-...").
// Nunca tocam no projeto real. Para rodar:  npm run test:regras
// (precisa de Java 11+ instalado, exigência do emulador do Firestore).
//
// Cenário: dois municípios (mA e mB), cada um com a sua administração, RH,
// diretoras e dados, mais a sede, que vê todos. O ponto principal é provar
// que ninguém de um município lê ou altera o que é do outro.
// Ver docs/22-acesso-por-municipio.md.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { gerarDadosDemo } from '../../src/demo/dadosDemo.js';
import { resetarDemo } from '../../src/demo/resetarDemo.js';
import { desfazerImportacao, importarRegistros } from '../../src/importacao/gravar.js';
import { ESQUEMAS } from '../../src/importacao/esquemas.js';
import { atribuirDadosAntigos, procurarDadosAntigos } from '../../src/services/dadosAntigos.js';

const PROJETO = 'demo-gestao-escolar';

// Trava de segurança: sem emulador, não roda (evita qualquer chance de ir à nuvem).
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Emulador do Firestore não encontrado. Use "npm run test:regras".');
}

let ambiente;

// Bancos já autenticados como cada personagem.
const emailDe = (uid) => `${uid}@exemplo.test`;
const como = (uid) => ambiente.authenticatedContext(uid, { email: emailDe(uid) }).firestore();
const anonimo = () => ambiente.unauthenticatedContext().firestore();
const usuario = (uid) => ({ uid, email: emailDe(uid) });

/** Consulta "só do município X", como as telas fazem (services/consulta.js). */
const doMun = (bd, nome, municipioId, ...extra) => query(collection(bd, nome), where('municipioId', '==', municipioId), ...extra);

const USUARIOS = {
  sede: { nome: 'Sônia Sede', perfil: 'sede', situacao: 'ativa', municipioId: null, unidadeId: null },
  admin: { nome: 'Ana Admin A', perfil: 'admin', situacao: 'ativa', municipioId: 'mA', unidadeId: null },
  adminB: { nome: 'Beto Admin B', perfil: 'admin', situacao: 'ativa', municipioId: 'mB', unidadeId: null },
  adminInativo: { nome: 'Ivo Inativo', perfil: 'admin', situacao: 'inativa', municipioId: 'mA', unidadeId: null },
  // Administração antiga, de antes da divisão por município (sem municipioId).
  adminAntigo: { nome: 'Olga Antiga', perfil: 'admin', situacao: 'ativa', unidadeId: null },
  rh: { nome: 'Rita RH A', perfil: 'administrativo', situacao: 'ativa', municipioId: 'mA', unidadeId: null },
  rhB: { nome: 'Rui RH B', perfil: 'administrativo', situacao: 'ativa', municipioId: 'mB', unidadeId: null },
  diretoraA: { nome: 'Dora A', perfil: 'diretora', situacao: 'ativa', municipioId: 'mA', unidadeId: 'escolaA' },
  diretoraB: { nome: 'Bia B', perfil: 'diretora', situacao: 'ativa', municipioId: 'mB', unidadeId: 'escolaB' },
  diretoraInativa: { nome: 'Inês Inativa', perfil: 'diretora', situacao: 'inativa', municipioId: 'mA', unidadeId: 'escolaA' },
  // 'semPerfil' tem conta no Auth, mas nenhum documento em /usuarios.
};

/** Coleções de trabalho, em que todo registro tem municipioId. */
const COLECOES_DO_MUNICIPIO = [
  'escolas', 'manutencoes', 'contas', 'ciclos', 'prestadores', 'eventos', 'curriculos', 'candidatos',
  'funcionarios', 'rubricas', 'gastos', 'contratos', 'usuarios', 'historico', 'lixeira', 'importacoes',
];

/** O mesmo formato que a tela da diretora envia ao abrir um chamado. */
const chamadoDaDiretora = (extra = {}) => ({
  descricao: 'Torneira do banheiro vazando',
  localDentroEscola: 'Banheiro infantil',
  prioridade: 'Média',
  observacoes: '',
  escolaId: 'escolaA',
  escolaNome: 'Escola A',
  responsavel: 'A definir',
  status: 'Pendente',
  solicitadaPor: 'diretoraA',
  solicitadaPorNome: 'Dora A',
  criadoEm: serverTimestamp(),
  atualizadoEm: serverTimestamp(),
  municipioId: 'mA',
  ...extra,
});

const linhaDeHistorico = (uid, extra = {}) => ({
  acao: 'criar',
  colecao: 'manutencoes',
  docId: 'x',
  titulo: 'Teste',
  antes: null,
  depois: { a: 1 },
  porUid: uid,
  porEmail: emailDe(uid),
  em: serverTimestamp(),
  municipioId: USUARIOS[uid]?.municipioId ?? null,
  ...extra,
});

const itemDeLixeira = (uid, colecao, docId, extra = {}) => ({
  colecao,
  docId,
  titulo: 'Registro excluído',
  dados: { nome: 'Qualquer' },
  excluidoEm: serverTimestamp(),
  excluidoPor: uid,
  excluidoPorEmail: `${uid}@exemplo.test`,
  municipioId: 'mA',
  ...extra,
});

before(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await ambiente?.cleanup();
});

beforeEach(async () => {
  await ambiente.clearFirestore();
  // Dados de partida, gravados sem passar pelas regras.
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    const bd = ctx.firestore();
    const lote = writeBatch(bd);
    Object.entries(USUARIOS).forEach(([uid, dados]) => lote.set(doc(bd, 'usuarios', uid), { uid, ...dados }));
    lote.set(doc(bd, 'municipios', 'mA'), { nome: 'Alfa', uf: 'SP' });
    lote.set(doc(bd, 'municipios', 'mB'), { nome: 'Beta', uf: 'SP' });
    lote.set(doc(bd, 'municipios', 'mA', 'config', 'backup'), { formato: 'xlsx' });
    lote.set(doc(bd, 'municipios', 'mB', 'config', 'backup'), { formato: 'xlsx' });
    lote.set(doc(bd, 'contratos', 'ctA'), { municipioId: 'mA', numero: 'TC A' });
    lote.set(doc(bd, 'contratos', 'ctB'), { municipioId: 'mB', numero: 'TC B' });
    [['escolaA', 'mA'], ['escolaA2', 'mA'], ['escolaB', 'mB']].forEach(([id, m]) => {
      lote.set(doc(bd, 'escolas', id), { nome: id, municipioId: m });
      lote.set(doc(bd, 'manutencoes', `m_${id}`), { escolaId: id, descricao: 'Chamado', status: 'Pendente', municipioId: m });
      lote.set(doc(bd, 'contas', `c_${id}`), { escolaId: id, tipo: 'CPFL', valor: 100, status: 'A enviar', municipioId: m });
      lote.set(doc(bd, 'ciclos', `k_${id}`), { escolaId: id, tipo: 'Extintores', municipioId: m });
    });
    ['A', 'B'].forEach((x) => {
      const m = `m${x}`;
      lote.set(doc(bd, 'prestadores', `p${x}`), { nome: `Prestador ${x}`, municipioId: m });
      lote.set(doc(bd, 'curriculos', `cv${x}`), { nome: `Candidata ${x}`, status: 'Disponível', municipioId: m });
      lote.set(doc(bd, 'candidatos', `cand${x}`), { nome: `Candidato ${x}`, municipioId: m });
      lote.set(doc(bd, 'funcionarios', `f${x}`), { nome: `Funcionária ${x}`, escolaId: `escola${x}`, cpf: '000', municipioId: m });
      lote.set(doc(bd, 'eventos', `e${x}`), { titulo: `Reunião ${x}`, municipioId: m });
      lote.set(doc(bd, 'rubricas', `r${x}`), { nome: 'Enxoval', verbaMensal: 100, municipioId: m });
      lote.set(doc(bd, 'gastos', `g${x}`), { rubricaId: `r${x}`, valorTotal: 50, municipioId: m });
      lote.set(doc(bd, 'historico', `h${x}`), { acao: 'criar', colecao: 'escolas', porUid: 'admin', municipioId: m });
      lote.set(doc(bd, 'importacoes', `i${x}`), { colecao: 'escolas', status: 'concluida', municipioId: m });
    });
    lote.set(doc(bd, 'lixeira', 'lx_escola'), { colecao: 'escolas', docId: 'escolaZ', dados: { nome: 'Escola Z', municipioId: 'mA' }, excluidoPor: 'admin', municipioId: 'mA' });
    lote.set(doc(bd, 'lixeira', 'lx_cv'), { colecao: 'curriculos', docId: 'cvZ', dados: { nome: 'Currículo Z', municipioId: 'mA' }, excluidoPor: 'rh', municipioId: 'mA' });
    lote.set(doc(bd, 'lixeira', 'lx_B'), { colecao: 'escolas', docId: 'escolaY', dados: { nome: 'Escola Y', municipioId: 'mB' }, excluidoPor: 'adminB', municipioId: 'mB' });
    // Dados antigos, de antes da divisão por município.
    lote.set(doc(bd, 'escolas', 'escolaAntiga'), { nome: 'Escola Antiga' });
    lote.set(doc(bd, 'historico', 'hAntigo'), { acao: 'criar', colecao: 'escolas', porUid: 'admin', titulo: 'Antigo' });
    lote.set(doc(bd, 'config', 'saldo'), { inicio: '2026-08', meses: 5 });
    lote.set(doc(bd, 'alertasAdiados', 'ciclo:x'), { ate: '2026-10-20' });
    await lote.commit();
  });
});

// ---------------------------------------------------------------------------

describe('quem não está logado ou não tem perfil', () => {
  test('visitante sem login não lê nem grava nada', async () => {
    const bd = anonimo();
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertFails(getDoc(doc(bd, 'usuarios', 'admin')));
    await assertFails(getDocs(doMun(bd, 'prestadores', 'mA')));
    await assertFails(getDoc(doc(bd, 'municipios', 'mA')));
    await assertFails(addDoc(collection(bd, 'manutencoes'), chamadoDaDiretora()));
  });

  test('conta criada no Auth sem documento em /usuarios fica sem acesso', async () => {
    const bd = como('semPerfil');
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertFails(getDocs(doMun(bd, 'prestadores', 'mA')));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('semPerfil')));
    // E não consegue se dar um perfil (nem de sede).
    await assertFails(setDoc(doc(bd, 'usuarios', 'semPerfil'), { perfil: 'sede', situacao: 'ativa' }));
    await assertFails(setDoc(doc(bd, 'usuarios', 'semPerfil'), { perfil: 'admin', situacao: 'ativa', municipioId: 'mA' }));
  });

  test('coleção que não existe nas regras é negada até para a sede', async () => {
    await assertFails(getDoc(doc(como('sede'), 'qualquerCoisa', 'x')));
    await assertFails(setDoc(doc(como('sede'), 'qualquerCoisa', 'x'), { a: 1 }));
  });
});

describe('usuário inativo', () => {
  test('diretora inativa não lê nem grava nada da escola', async () => {
    const bd = como('diretoraInativa');
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertFails(getDoc(doc(bd, 'manutencoes', 'm_escolaA')));
    await assertFails(getDocs(query(collection(bd, 'contas'), where('escolaId', '==', 'escolaA'))));
    await assertFails(addDoc(collection(bd, 'manutencoes'), chamadoDaDiretora({ solicitadaPor: 'diretoraInativa' })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraInativa')));
  });

  test('administração inativa perde tudo', async () => {
    const bd = como('adminInativo');
    await assertFails(getDocs(doMun(bd, 'manutencoes', 'mA')));
    await assertFails(getDocs(doMun(bd, 'usuarios', 'mA')));
    await assertFails(getDocs(doMun(bd, 'prestadores', 'mA')));
    await assertFails(updateDoc(doc(bd, 'usuarios', 'adminInativo'), { situacao: 'ativa' }));
    await assertFails(deleteDoc(doc(bd, 'lixeira', 'lx_escola')));
  });

  test('inativo ainda lê o próprio perfil (é assim que o app descobre e desloga)', async () => {
    await assertSucceeds(getDoc(doc(como('diretoraInativa'), 'usuarios', 'diretoraInativa')));
  });
});

describe('isolamento entre municípios: administração', () => {
  test('lê tudo do próprio município, pedindo "só do meu município"', async () => {
    const bd = como('admin');
    for (const nome of COLECOES_DO_MUNICIPIO) {
      await assertSucceeds(getDocs(doMun(bd, nome, 'mA')));
    }
    await assertSucceeds(getDoc(doc(bd, 'contas', 'c_escolaA')));
    await assertSucceeds(getDoc(doc(bd, 'municipios', 'mA')));
    await assertSucceeds(getDoc(doc(bd, 'municipios', 'mA', 'config', 'backup')));
  });

  test('não lê NADA de outro município', async () => {
    const bd = como('admin');
    for (const nome of COLECOES_DO_MUNICIPIO) {
      await assertFails(getDocs(doMun(bd, nome, 'mB')));
    }
    for (const [colecao, id] of [['escolas', 'escolaB'], ['manutencoes', 'm_escolaB'], ['contas', 'c_escolaB'], ['ciclos', 'k_escolaB'],
      ['prestadores', 'pB'], ['curriculos', 'cvB'], ['funcionarios', 'fB'], ['eventos', 'eB'], ['rubricas', 'rB'], ['gastos', 'gB'],
      ['contratos', 'ctB'], ['historico', 'hB'], ['lixeira', 'lx_B'], ['importacoes', 'iB'], ['usuarios', 'adminB'], ['usuarios', 'diretoraB']]) {
      await assertFails(getDoc(doc(bd, colecao, id)));
    }
    await assertFails(getDoc(doc(bd, 'municipios', 'mB')));
    await assertFails(getDoc(doc(bd, 'municipios', 'mB', 'config', 'backup')));
  });

  test('consulta sem dizer o município é recusada (tentaria ler todos)', async () => {
    const bd = como('admin');
    for (const nome of ['escolas', 'contas', 'manutencoes', 'funcionarios', 'usuarios', 'historico']) {
      await assertFails(getDocs(collection(bd, nome)));
    }
    await assertFails(getDocs(collection(bd, 'municipios')));
  });

  test('não grava em outro município nem muda um registro de município', async () => {
    const bd = como('admin');
    await assertFails(addDoc(collection(bd, 'contas'), { escolaId: 'escolaB', valor: 1, municipioId: 'mB' }));
    await assertFails(addDoc(collection(bd, 'contas'), { escolaId: 'escolaA', valor: 1 })); // sem município
    await assertFails(updateDoc(doc(bd, 'contas', 'c_escolaB'), { status: 'Enviada' }));
    await assertFails(deleteDoc(doc(bd, 'escolas', 'escolaB')));
    await assertFails(updateDoc(doc(bd, 'contas', 'c_escolaA'), { municipioId: 'mB' }));
    await assertFails(setDoc(doc(bd, 'municipios', 'mB', 'config', 'backup'), { formato: 'json' }));
    await assertFails(setDoc(doc(bd, 'municipios', 'mB', 'alertasAdiados', 'x'), { ate: '2026-10-20', porUid: 'admin', porEmail: emailDe('admin'), em: serverTimestamp() }));
  });

  test('grava normalmente no próprio município', async () => {
    const bd = como('admin');
    await assertSucceeds(addDoc(collection(bd, 'manutencoes'), { escolaId: 'escolaA', descricao: 'Pintura', status: 'Em andamento', municipioId: 'mA' }));
    await assertSucceeds(updateDoc(doc(bd, 'contas', 'c_escolaA'), { status: 'Enviada' }));
    await assertSucceeds(addDoc(collection(bd, 'eventos'), { titulo: 'Visita', municipioId: 'mA' }));
    await assertSucceeds(addDoc(collection(bd, 'escolas'), { nome: 'Nova', municipioId: 'mA' }));
    await assertSucceeds(setDoc(doc(bd, 'municipios', 'mA', 'config', 'backup'), { ultimoEm: serverTimestamp(), formato: 'json' }));
    await assertSucceeds(setDoc(doc(bd, 'municipios', 'mA', 'config', 'saldo'), { inicio: '2026-08', meses: 5 }));
    // O histórico do município, mais recente primeiro (como a tela Segurança dos dados).
    await assertSucceeds(getDocs(doMun(bd, 'historico', 'mA', orderBy('em', 'desc'), limit(150))));
  });

  test('não cadastra municípios nem contratos (isso é da sede)', async () => {
    const bd = como('admin');
    await assertFails(addDoc(collection(bd, 'municipios'), { nome: 'Gama', uf: 'SP' }));
    await assertFails(updateDoc(doc(bd, 'municipios', 'mA'), { nome: 'Outro' }));
    await assertFails(addDoc(collection(bd, 'contratos'), { municipioId: 'mA', numero: 'TC novo' }));
    await assertFails(updateDoc(doc(bd, 'contratos', 'ctA'), { numero: 'Mudado' }));
  });

  test('administração antiga (sem município no perfil) não lê nem grava nada', async () => {
    const bd = como('adminAntigo');
    await assertFails(getDocs(doMun(bd, 'contas', 'mA')));
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaAntiga')));
    await assertFails(addDoc(collection(bd, 'contas'), { valor: 1, municipioId: 'mA' }));
  });

  test('registro antigo (sem município) só a sede vê', async () => {
    await assertFails(getDoc(doc(como('admin'), 'escolas', 'escolaAntiga')));
    await assertFails(getDoc(doc(como('adminB'), 'escolas', 'escolaAntiga')));
    await assertSucceeds(getDoc(doc(como('sede'), 'escolas', 'escolaAntiga')));
  });
});

describe('sede', () => {
  test('vê todos os municípios, sem filtro, e cada um por dentro', async () => {
    const bd = como('sede');
    for (const nome of [...COLECOES_DO_MUNICIPIO, 'municipios']) {
      await assertSucceeds(getDocs(collection(bd, nome)));
    }
    await assertSucceeds(getDocs(doMun(bd, 'contas', 'mB')));
    await assertSucceeds(getDoc(doc(bd, 'municipios', 'mB', 'config', 'backup')));
  });

  test('trabalha dentro de qualquer município como a administração dele', async () => {
    const bd = como('sede');
    await assertSucceeds(addDoc(collection(bd, 'contas'), { escolaId: 'escolaB', valor: 1, municipioId: 'mB' }));
    await assertSucceeds(updateDoc(doc(bd, 'contas', 'c_escolaA'), { status: 'Enviada' }));
    await assertSucceeds(setDoc(doc(bd, 'municipios', 'mB', 'alertasAdiados', 'ciclo:y'), { ate: '2026-10-20', porUid: 'sede', porEmail: emailDe('sede'), em: serverTimestamp() }));
  });

  test('cadastra municípios e contratos', async () => {
    const bd = como('sede');
    const m = await assertSucceeds(addDoc(collection(bd, 'municipios'), { nome: 'Gama', uf: 'RS' }));
    await assertSucceeds(addDoc(collection(bd, 'contratos'), { municipioId: m.id, numero: 'TC G' }));
    await assertSucceeds(updateDoc(doc(bd, 'escolas', 'escolaA'), { contratoId: 'ctA' }));
  });

  test('cria a administração de um município; ninguém apaga usuário', async () => {
    const bd = como('sede');
    await assertSucceeds(setDoc(doc(bd, 'usuarios', 'novoAdmin'), { uid: 'novoAdmin', perfil: 'admin', situacao: 'ativa', municipioId: 'mB' }));
    await assertSucceeds(updateDoc(doc(bd, 'usuarios', 'adminB'), { situacao: 'inativa' }));
    await assertFails(deleteDoc(doc(bd, 'usuarios', 'adminB')));
  });

  test('só ACRESCENTA o município em dados antigos (histórico continua imutável)', async () => {
    const bd = como('sede');
    await assertSucceeds(updateDoc(doc(bd, 'escolas', 'escolaAntiga'), { municipioId: 'mA' }));
    await assertFails(updateDoc(doc(bd, 'historico', 'hAntigo'), { municipioId: 'mA', titulo: 'Adulterado' }));
    await assertSucceeds(updateDoc(doc(bd, 'historico', 'hAntigo'), { municipioId: 'mA' }));
    // Depois de ter município, o histórico volta a ser intocável.
    await assertFails(updateDoc(doc(bd, 'historico', 'hAntigo'), { municipioId: 'mB' }));
    await assertFails(updateDoc(doc(bd, 'historico', 'hA'), { municipioId: 'mB' }));
  });
});

describe('dados antigos (organizar depois da divisão por município)', () => {
  test('a sede acha tudo o que não tem município e atribui a um município', async () => {
    const bd = como('sede');
    // Linha do histórico gravada pela própria sede (município vazio de propósito): não é dado antigo.
    await assertSucceeds(addDoc(collection(bd, 'historico'), linhaDeHistorico('sede', { colecao: 'municipios' })));
    const achados = await procurarDadosAntigos(bd);
    assert.deepEqual(achados.porColecao.escolas, ['escolaAntiga']);
    assert.deepEqual(achados.porColecao.historico, ['hAntigo']);
    assert.deepEqual(achados.porColecao.usuarios, ['adminAntigo']); // a conta da sede não entra
    assert.deepEqual(achados.configs.map((c) => c.id), ['saldo']);
    assert.deepEqual(achados.alertasAdiados, ['ciclo:x']);

    const { atualizados } = await atribuirDadosAntigos(bd, 'mA', achados, usuario('sede'));
    assert.equal(atualizados, 3);
    assert.equal((await getDoc(doc(bd, 'escolas', 'escolaAntiga'))).data().municipioId, 'mA');
    assert.equal((await getDoc(doc(bd, 'municipios', 'mA', 'config', 'saldo'))).data().meses, 5);
    assert.equal((await getDoc(doc(bd, 'config', 'saldo'))).exists(), false);
    assert.equal((await getDocs(collection(bd, 'alertasAdiados'))).size, 0);

    const depois = await procurarDadosAntigos(bd);
    assert.equal(depois.total, 0);
    // A administração antiga passa a enxergar o próprio município.
    await assertSucceeds(getDocs(doMun(como('adminAntigo'), 'escolas', 'mA')));
    await assertSucceeds(getDoc(doc(como('admin'), 'escolas', 'escolaAntiga')));
  });

  test('a administração de um município não consegue fazer isso', async () => {
    await assert.rejects(procurarDadosAntigos(como('admin')));
    await assertFails(updateDoc(doc(como('admin'), 'escolas', 'escolaAntiga'), { municipioId: 'mA' }));
    await assertFails(updateDoc(doc(como('admin'), 'historico', 'hAntigo'), { municipioId: 'mA' }));
  });
});

describe('diretora: só a própria escola', () => {
  test('lê chamados, contas e ciclos da própria escola', async () => {
    const bd = como('diretoraA');
    await assertSucceeds(getDoc(doc(bd, 'manutencoes', 'm_escolaA')));
    await assertSucceeds(getDoc(doc(bd, 'contas', 'c_escolaA')));
    await assertSucceeds(getDoc(doc(bd, 'ciclos', 'k_escolaA')));
    for (const colecao of ['manutencoes', 'contas', 'ciclos']) {
      await assertSucceeds(getDocs(query(collection(bd, colecao), where('escolaId', '==', 'escolaA'))));
    }
    await assertSucceeds(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertSucceeds(getDoc(doc(bd, 'municipios', 'mA')));
  });

  test('não lê nada de outra escola nem de outro município', async () => {
    const bd = como('diretoraA');
    await assertFails(getDoc(doc(bd, 'manutencoes', 'm_escolaA2'))); // mesma cidade, outra escola
    await assertFails(getDoc(doc(bd, 'manutencoes', 'm_escolaB')));
    await assertFails(getDoc(doc(bd, 'contas', 'c_escolaB')));
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaB')));
    await assertFails(getDoc(doc(bd, 'municipios', 'mB')));
    for (const colecao of ['manutencoes', 'contas', 'ciclos']) {
      await assertFails(getDocs(query(collection(bd, colecao), where('escolaId', '==', 'escolaB'))));
      await assertFails(getDocs(doMun(bd, colecao, 'mA'))); // o município inteiro, não
    }
  });

  test('não acessa o que é da administração ou do RH', async () => {
    const bd = como('diretoraA');
    for (const colecao of ['prestadores', 'curriculos', 'candidatos', 'eventos', 'historico', 'lixeira', 'usuarios', 'funcionarios', 'contratos', 'rubricas']) {
      await assertFails(getDocs(doMun(bd, colecao, 'mA')));
    }
    await assertFails(getDoc(doc(bd, 'municipios', 'mA', 'config', 'backup')));
    await assertFails(setDoc(doc(bd, 'escolas', 'escolaA'), { nome: 'Outra', municipioId: 'mA' }));
    await assertFails(updateDoc(doc(bd, 'contas', 'c_escolaA'), { status: 'Enviada' }));
    await assertFails(deleteDoc(doc(bd, 'ciclos', 'k_escolaA')));
  });
});

describe('diretora: abertura de chamado', () => {
  const abrir = (dados) => addDoc(collection(como('diretoraA'), 'manutencoes'), dados);

  test('chamado no formato da tela é aceito', async () => {
    await assertSucceeds(abrir(chamadoDaDiretora()));
    await assertSucceeds(abrir(chamadoDaDiretora({ prioridade: 'Alta' })));
  });

  test('em outro município ou sem município é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ municipioId: 'mB' })));
    const { municipioId, ...semMunicipio } = chamadoDaDiretora(); // eslint-disable-line no-unused-vars
    await assertFails(abrir(semMunicipio));
  });

  test('status diferente de "Pendente" é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ status: 'Concluído' })));
    await assertFails(abrir(chamadoDaDiretora({ status: 'Em andamento' })));
  });

  test('em outra escola ou em nome de outra pessoa é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ escolaId: 'escolaB' })));
    await assertFails(abrir(chamadoDaDiretora({ escolaId: 'escolaA2' })));
    await assertFails(abrir(chamadoDaDiretora({ solicitadaPor: 'diretoraB' })));
  });

  test('campo desconhecido, texto gigante ou prioridade inventada são recusados', async () => {
    await assertFails(abrir(chamadoDaDiretora({ concluidoEm: serverTimestamp() })));
    await assertFails(abrir(chamadoDaDiretora({ custo: 999 })));
    await assertFails(abrir(chamadoDaDiretora({ descricao: 'x'.repeat(2001) })));
    await assertFails(abrir(chamadoDaDiretora({ descricao: '' })));
    await assertFails(abrir(chamadoDaDiretora({ observacoes: 'x'.repeat(2001) })));
    await assertFails(abrir(chamadoDaDiretora({ localDentroEscola: 'x'.repeat(301) })));
    await assertFails(abrir(chamadoDaDiretora({ prioridade: 'Máxima' })));
    await assertFails(abrir(chamadoDaDiretora({ escolaNome: 'x'.repeat(201) })));
    await assertFails(abrir(chamadoDaDiretora({ solicitadaPorNome: 'x'.repeat(201) })));
  });

  test('já atribuído a alguém ou com data forjada é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ responsavel: 'Meu cunhado' })));
    await assertFails(abrir(chamadoDaDiretora({ responsavelId: 'p1' })));
    await assertFails(abrir(chamadoDaDiretora({ criadoEm: new Date('2020-01-01') })));
    await assertFails(abrir(chamadoDaDiretora({ atualizadoEm: new Date('2020-01-01') })));
  });

  test('depois de aberto, a diretora não altera nem apaga o chamado', async () => {
    const bd = como('diretoraA');
    await assertFails(updateDoc(doc(bd, 'manutencoes', 'm_escolaA'), { status: 'Concluído' }));
    await assertFails(deleteDoc(doc(bd, 'manutencoes', 'm_escolaA')));
  });
});

describe('RH: funcionários, currículos e processo seletivo do próprio município', () => {
  test('lê e grava no próprio município', async () => {
    const bd = como('rh');
    for (const colecao of ['curriculos', 'candidatos', 'funcionarios']) {
      await assertSucceeds(getDocs(doMun(bd, colecao, 'mA')));
    }
    await assertSucceeds(getDocs(doMun(bd, 'curriculos', 'mA', where('status', '==', 'Entrevista Agendada'))));
    await assertSucceeds(addDoc(collection(bd, 'curriculos'), { nome: 'Nova', status: 'Disponível', municipioId: 'mA' }));
    await assertSucceeds(updateDoc(doc(bd, 'curriculos', 'cvA'), { status: 'Aprovado' }));
    await assertSucceeds(updateDoc(doc(bd, 'candidatos', 'candA'), { nome: 'Outro nome' }));
    const f = await assertSucceeds(addDoc(collection(bd, 'funcionarios'), { nome: 'Fulana', escolaId: 'escolaA', municipioId: 'mA' }));
    await assertSucceeds(updateDoc(f, { situacao: 'Inativa' }));
    await assertSucceeds(getDocs(doMun(bd, 'escolas', 'mA'))); // nomes das escolas no formulário
  });

  test('não lê nem grava no RH de outro município', async () => {
    const bd = como('rh');
    for (const colecao of ['curriculos', 'candidatos', 'funcionarios']) {
      await assertFails(getDocs(doMun(bd, colecao, 'mB')));
    }
    await assertFails(getDoc(doc(bd, 'funcionarios', 'fB')));
    await assertFails(addDoc(collection(bd, 'funcionarios'), { nome: 'Intrusa', municipioId: 'mB' }));
    await assertFails(updateDoc(doc(bd, 'curriculos', 'cvA'), { municipioId: 'mB' }));
  });

  test('não lê o resto do sistema', async () => {
    const bd = como('rh');
    for (const colecao of ['manutencoes', 'contas', 'ciclos', 'prestadores', 'eventos', 'historico', 'usuarios', 'rubricas', 'gastos', 'contratos']) {
      await assertFails(getDocs(doMun(bd, colecao, 'mA')));
    }
    await assertFails(getDoc(doc(bd, 'usuarios', 'admin')));
    await assertFails(addDoc(collection(bd, 'contas'), { escolaId: 'escolaA', valor: 1, municipioId: 'mA' }));
    await assertFails(setDoc(doc(bd, 'escolas', 'escolaA'), { nome: 'Outra', municipioId: 'mA' }));
  });
});

describe('usuários', () => {
  test('cada um lê o próprio perfil; a administração lê a equipe do próprio município', async () => {
    await assertSucceeds(getDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA')));
    await assertFails(getDoc(doc(como('diretoraA'), 'usuarios', 'diretoraB')));
    await assertSucceeds(getDocs(doMun(como('admin'), 'usuarios', 'mA')));
    await assertSucceeds(getDoc(doc(como('admin'), 'usuarios', 'rh')));
    await assertFails(getDoc(doc(como('admin'), 'usuarios', 'rhB')));
    await assertFails(getDoc(doc(como('admin'), 'usuarios', 'sede')));
  });

  test('a administração cria diretoras e RH do próprio município', async () => {
    const bd = como('admin');
    await assertSucceeds(setDoc(doc(bd, 'usuarios', 'nova'), { uid: 'nova', perfil: 'diretora', situacao: 'ativa', unidadeId: 'escolaA2', municipioId: 'mA' }));
    await assertSucceeds(setDoc(doc(bd, 'usuarios', 'novoRh'), { uid: 'novoRh', perfil: 'administrativo', situacao: 'ativa', municipioId: 'mA' }));
    await assertSucceeds(updateDoc(doc(bd, 'usuarios', 'diretoraA'), { situacao: 'inativa' }));
  });

  test('a administração não cria administrador nem sede, nem mexe em outro município', async () => {
    const bd = como('admin');
    await assertFails(setDoc(doc(bd, 'usuarios', 'x1'), { uid: 'x1', perfil: 'admin', situacao: 'ativa', municipioId: 'mA' }));
    await assertFails(setDoc(doc(bd, 'usuarios', 'x2'), { uid: 'x2', perfil: 'sede', situacao: 'ativa' }));
    await assertFails(setDoc(doc(bd, 'usuarios', 'x3'), { uid: 'x3', perfil: 'diretora', situacao: 'ativa', municipioId: 'mB' }));
    await assertFails(updateDoc(doc(bd, 'usuarios', 'diretoraB'), { situacao: 'inativa' }));
    await assertFails(updateDoc(doc(bd, 'usuarios', 'rh'), { perfil: 'admin' })); // promover
    await assertFails(updateDoc(doc(bd, 'usuarios', 'diretoraA'), { municipioId: 'mB' })); // mandar para outro município
    await assertFails(updateDoc(doc(bd, 'usuarios', 'admin'), { municipioId: 'mB' })); // nem a si mesma
    await assertFails(deleteDoc(doc(bd, 'usuarios', 'diretoraA')));
  });

  test('ninguém se promove nem troca a própria escola ou município', async () => {
    await assertFails(updateDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA'), { perfil: 'admin' }));
    await assertFails(updateDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA'), { unidadeId: 'escolaB' }));
    await assertFails(updateDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA'), { municipioId: 'mB' }));
    await assertFails(updateDoc(doc(como('rh'), 'usuarios', 'rh'), { perfil: 'sede' }));
    await assertFails(updateDoc(doc(como('diretoraInativa'), 'usuarios', 'diretoraInativa'), { situacao: 'ativa' }));
  });
});

describe('histórico: só acrescenta', () => {
  test('cada usuário ativo registra em nome próprio, no próprio município', async () => {
    for (const uid of ['admin', 'rh', 'diretoraA', 'sede']) {
      await assertSucceeds(addDoc(collection(como(uid), 'historico'), linhaDeHistorico(uid)));
    }
  });

  test('em outro município, em nome de outra pessoa ou com ação inventada é recusado', async () => {
    const bd = como('diretoraA');
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { municipioId: 'mB' })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('admin')));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { acao: 'hackear' })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { colecao: 123 })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { porEmail: emailDe('admin') })));
  });

  test('data forjada, campo extra ou título gigante são recusados', async () => {
    const bd = como('diretoraA');
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { em: new Date('2020-01-01') })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { lixo: 'x' })));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('diretoraA', { titulo: 'x'.repeat(201) })));
  });

  test('aceita os formatos que o app grava (criar, alterar, excluir, restaurar)', async () => {
    const bd = como('admin');
    await assertSucceeds(addDoc(collection(bd, 'historico'), linhaDeHistorico('admin', { acao: 'alterar', antes: { a: 1 }, depois: { a: 2 } })));
    await assertSucceeds(addDoc(collection(bd, 'historico'), linhaDeHistorico('admin', { acao: 'excluir', depois: null, antes: { a: 1 } })));
    await assertSucceeds(addDoc(collection(bd, 'historico'), linhaDeHistorico('admin', { acao: 'restaurar', titulo: '' })));
  });

  test('ninguém altera nem apaga (fora do ambiente de demonstração)', async () => {
    for (const uid of ['admin', 'sede']) {
      const bd = como(uid);
      await assertFails(updateDoc(doc(bd, 'historico', 'hA'), { acao: 'excluir' }));
      await assertFails(setDoc(doc(bd, 'historico', 'hA'), linhaDeHistorico(uid)));
      await assertFails(deleteDoc(doc(bd, 'historico', 'hA')));
    }
  });

  test('só a administração do município (e a sede) lê', async () => {
    await assertSucceeds(getDoc(doc(como('admin'), 'historico', 'hA')));
    await assertFails(getDoc(doc(como('admin'), 'historico', 'hB')));
    await assertFails(getDoc(doc(como('rh'), 'historico', 'hA')));
    await assertFails(getDoc(doc(como('diretoraA'), 'historico', 'hA')));
    await assertSucceeds(getDoc(doc(como('sede'), 'historico', 'hB')));
  });
});

describe('lixeira e restauração', () => {
  /** Reproduz o deleteDoc de src/services/db.js: copia para a lixeira e apaga, tudo ou nada. */
  const excluirComLixeira = (uid, colecao, docId, municipioId = 'mA') => {
    const bd = como(uid);
    const lote = writeBatch(bd);
    lote.set(doc(collection(bd, 'lixeira')), itemDeLixeira(uid, colecao, docId, { municipioId }));
    lote.delete(doc(bd, colecao, docId));
    return lote.commit();
  };

  test('a administração exclui registros do município mandando a cópia para a lixeira', async () => {
    await assertSucceeds(excluirComLixeira('admin', 'escolas', 'escolaA2'));
    await assertSucceeds(excluirComLixeira('admin', 'contas', 'c_escolaA'));
    await assertSucceeds(excluirComLixeira('admin', 'curriculos', 'cvA'));
  });

  test('não exclui de outro município (nem mentindo o município da lixeira)', async () => {
    await assertFails(excluirComLixeira('admin', 'contas', 'c_escolaB', 'mB'));
    await assertFails(excluirComLixeira('admin', 'contas', 'c_escolaB', 'mA'));
  });

  test('RH exclui currículo, candidato e funcionário do município, mas nada além disso', async () => {
    await assertSucceeds(excluirComLixeira('rh', 'curriculos', 'cvA'));
    await assertSucceeds(excluirComLixeira('rh', 'candidatos', 'candA'));
    await assertSucceeds(excluirComLixeira('rh', 'funcionarios', 'fA'));
    await assertFails(excluirComLixeira('rh', 'escolas', 'escolaA'));
    await assertFails(excluirComLixeira('rh', 'funcionarios', 'fB', 'mB'));
    await assertFails(addDoc(collection(como('rh'), 'lixeira'), itemDeLixeira('rh', 'escolas', 'escolaA')));
  });

  test('diretora não exclui nem mexe na lixeira', async () => {
    await assertFails(excluirComLixeira('diretoraA', 'manutencoes', 'm_escolaA'));
    await assertFails(addDoc(collection(como('diretoraA'), 'lixeira'), itemDeLixeira('diretoraA', 'manutencoes', 'm_escolaA')));
    await assertFails(getDocs(doMun(como('diretoraA'), 'lixeira', 'mA')));
  });

  test('item da lixeira não pode ser gravado em nome de outra pessoa nem alterado', async () => {
    await assertFails(addDoc(collection(como('admin'), 'lixeira'), itemDeLixeira('rh', 'escolas', 'escolaA')));
    await assertFails(updateDoc(doc(como('admin'), 'lixeira', 'lx_escola'), { titulo: 'Adulterado' }));
  });

  test('a administração lê a lixeira do município; RH só currículos, candidatos e funcionários', async () => {
    await assertSucceeds(getDocs(doMun(como('admin'), 'lixeira', 'mA')));
    await assertFails(getDoc(doc(como('admin'), 'lixeira', 'lx_B')));
    await assertSucceeds(getDoc(doc(como('rh'), 'lixeira', 'lx_cv')));
    await assertFails(getDoc(doc(como('rh'), 'lixeira', 'lx_escola')));
  });

  /** Reproduz o restaurarDaLixeira de src/services/db.js. */
  const restaurar = (uid, idLixeira, colecao, docId, dados) => {
    const bd = como(uid);
    const lote = writeBatch(bd);
    lote.set(doc(bd, colecao, docId), dados);
    lote.delete(doc(bd, 'lixeira', idLixeira));
    return lote.commit();
  };

  test('a administração restaura o que é do município', async () => {
    await assertSucceeds(restaurar('admin', 'lx_escola', 'escolas', 'escolaZ', { nome: 'Escola Z', municipioId: 'mA' }));
    await assertSucceeds(restaurar('admin', 'lx_cv', 'curriculos', 'cvZ', { nome: 'Currículo Z', municipioId: 'mA' }));
  });

  test('restaurar é só da administração do município', async () => {
    await assertFails(restaurar('admin', 'lx_B', 'escolas', 'escolaY', { nome: 'Escola Y', municipioId: 'mB' }));
    await assertFails(restaurar('rh', 'lx_cv', 'curriculos', 'cvZ', { nome: 'Currículo Z', municipioId: 'mA' }));
    await assertFails(deleteDoc(doc(como('rh'), 'lixeira', 'lx_cv')));
    await assertFails(deleteDoc(doc(como('diretoraA'), 'lixeira', 'lx_escola')));
  });
});

describe('ambiente de demonstração', () => {
  const marcarComoDemo = (valor = { demo: true }) =>
    ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'ambiente'), valor));

  test('ninguém consegue marcar o projeto como demonstração pelo app', async () => {
    for (const uid of ['sede', 'admin', 'rh', 'diretoraA']) {
      await assertFails(setDoc(doc(como(uid), 'config', 'ambiente'), { demo: true }));
    }
    await marcarComoDemo({ demo: false });
    await assertFails(updateDoc(doc(como('sede'), 'config', 'ambiente'), { demo: true }));
    await assertFails(deleteDoc(doc(como('sede'), 'config', 'ambiente')));
  });

  test('sem a marca (projeto real), o histórico não pode ser apagado', async () => {
    await assertFails(deleteDoc(doc(como('sede'), 'historico', 'hA')));
    await marcarComoDemo({ demo: false });
    await assertFails(deleteDoc(doc(como('sede'), 'historico', 'hA')));
  });

  test('com a marca, só a sede apaga o histórico; alterar continua proibido', async () => {
    await marcarComoDemo();
    await assertFails(deleteDoc(doc(como('admin'), 'historico', 'hA')));
    await assertFails(deleteDoc(doc(como('rh'), 'historico', 'hA')));
    await assertFails(updateDoc(doc(como('sede'), 'historico', 'hA'), { acao: 'excluir' }));
    await assertSucceeds(deleteDoc(doc(como('sede'), 'historico', 'hA')));
  });

  test('restaurar dados de demonstração se recusa a rodar sem a marca e não apaga nada', async () => {
    await assert.rejects(resetarDemo(como('sede')), /não está marcado/);
    assert.equal((await getDoc(doc(como('sede'), 'escolas', 'escolaA'))).exists(), true);
  });

  test('restaurar dados de demonstração troca tudo pelos dados fictícios e preserva os usuários', async () => {
    await marcarComoDemo();
    const bd = como('sede');
    const resultado = await resetarDemo(bd);
    const esperado = gerarDadosDemo();
    const totalEsperado = Object.values(esperado).reduce((soma, lista) => soma + lista.length, 0);
    assert.equal(resultado.criados, totalEsperado);

    for (const [caminho, lista] of Object.entries(esperado)) {
      const snap = await getDocs(collection(bd, caminho));
      assert.equal(snap.size, lista.length, `coleção ${caminho}`);
    }
    for (const colecao of ['historico', 'lixeira', 'candidatos', 'importacoes']) {
      assert.equal((await getDocs(collection(bd, colecao))).size, 0, `coleção ${colecao} deveria estar vazia`);
    }
    assert.equal((await getDocs(collection(bd, 'municipios', 'mA', 'config'))).size, 0, 'config de município antigo');
    assert.equal((await getDoc(doc(bd, 'escolas', 'escolaA'))).exists(), false);
    assert.equal((await getDocs(collection(bd, 'usuarios'))).size, Object.keys(USUARIOS).length);
    assert.equal((await getDoc(doc(bd, 'config', 'ambiente'))).data().demo, true);

    // Rodar de novo dá no mesmo resultado (identificadores fixos).
    await resetarDemo(bd);
    assert.equal((await getDocs(collection(bd, 'escolas'))).size, esperado.escolas.length);
  });

  test('administração do município, RH e diretora não conseguem restaurar a demonstração', async () => {
    await marcarComoDemo();
    for (const uid of ['admin', 'rh', 'diretoraA']) await assert.rejects(resetarDemo(como(uid)));
    assert.equal((await getDoc(doc(como('sede'), 'escolas', 'escolaA'))).exists(), true);
  });

  test('dados fictícios: tudo tem município, e escola, conta, ciclo e chamado batem', () => {
    const dados = gerarDadosDemo();
    const escolas = new Map(dados.escolas.map((e) => [e.id, e]));
    const municipios = new Set(dados.municipios.map((m) => m.id));
    for (const colecao of ['contas', 'ciclos', 'manutencoes', 'funcionarios']) {
      for (const r of dados[colecao]) {
        assert.ok(escolas.has(r.escolaId), `${colecao}/${r.id}`);
        assert.equal(r.municipioId, escolas.get(r.escolaId).municipioId, `${colecao}/${r.id} no município da escola`);
      }
    }
    for (const colecao of ['escolas', 'contratos', 'prestadores', 'eventos', 'curriculos', 'rubricas', 'gastos']) {
      for (const r of dados[colecao]) assert.ok(municipios.has(r.municipioId), `${colecao}/${r.id} sem município`);
    }
    const todosOsIds = Object.entries(dados).flatMap(([c, lista]) => lista.map((r) => `${c}/${r.id}`));
    assert.equal(new Set(todosOsIds).size, todosOsIds.length, 'identificadores repetidos');
    const prestadores = new Set(dados.prestadores.map((p) => p.nome));
    for (const m of dados.manutencoes) assert.ok(m.responsavel === 'A definir' || prestadores.has(m.responsavel), m.responsavel);
  });
});

describe('importação de planilhas', () => {
  const escolaNova = (nome) => ({ dados: { nome, codigo: '', situacao: 'Ativa', bairro: 'Centro', numeroAlunos: 0, capacidadeCaixaDagua: 0 } });
  const curriculoNovo = (nome) => ({ dados: { nome, telefone: '(19) 99999-0000', vaga: 'Cozinheira', exp: 'Não', status: 'Disponível' } });
  const importar = (uid, esquema, registros, municipioId = 'mA') =>
    importarRegistros({ db: como(uid), esquema, registros, arquivo: 'x.xlsx', usuario: usuario(uid), municipioId });

  test('a administração importa no próprio município: registros, histórico e registro da importação', async () => {
    const bd = como('admin');
    const { importacaoId, importados } = await importar('admin', ESQUEMAS.escolas, [escolaNova('CEI Um'), escolaNova('CEI Dois')]);
    assert.equal(importados, 2);
    const criadas = await getDocs(doMun(bd, 'escolas', 'mA', where('importacaoId', '==', importacaoId)));
    assert.equal(criadas.size, 2);
    assert.ok(criadas.docs.every((d) => d.data().criadoEm && d.data().municipioId === 'mA'));
    const importacao = (await getDoc(doc(bd, 'importacoes', importacaoId))).data();
    assert.equal(importacao.status, 'concluida');
    assert.equal(importacao.municipioId, 'mA');
    const historico = await getDocs(doMun(bd, 'historico', 'mA', where('acao', '==', 'criar')));
    const ids = new Set(criadas.docs.map((d) => d.id));
    assert.equal(historico.docs.filter((h) => ids.has(h.data().docId)).length, 2);
  });

  test('importar para outro município é recusado', async () => {
    await assert.rejects(importar('admin', ESQUEMAS.escolas, [escolaNova('CEI X')], 'mB'));
    assert.equal((await getDocs(doMun(como('adminB'), 'escolas', 'mB'))).size, 1);
  });

  test('importação grande é gravada em vários lotes', async () => {
    const { importados } = await importar('admin', ESQUEMAS.escolas, Array.from({ length: 450 }, (_, i) => escolaNova(`CEI ${i}`)));
    assert.equal(importados, 450);
    assert.equal((await getDocs(doMun(como('admin'), 'escolas', 'mA'))).size, 452); // + as 2 de partida
  });

  test('a administração desfaz: tudo vai para a lixeira, com histórico, e a importação fica marcada', async () => {
    const bd = como('admin');
    const { importacaoId } = await importar('admin', ESQUEMAS.escolas, [escolaNova('CEI Um'), escolaNova('CEI Dois')]);
    const { removidos } = await desfazerImportacao({ db: bd, importacao: { id: importacaoId, colecao: 'escolas', municipioId: 'mA' }, usuario: usuario('admin') });
    assert.equal(removidos, 2);
    assert.equal((await getDocs(doMun(bd, 'escolas', 'mA', where('importacaoId', '==', importacaoId)))).size, 0);
    const lixeira = await getDocs(doMun(bd, 'lixeira', 'mA', where('colecao', '==', 'escolas')));
    assert.equal(lixeira.docs.filter((d) => d.data().dados.importacaoId === importacaoId).length, 2);
    assert.equal((await getDoc(doc(bd, 'importacoes', importacaoId))).data().status, 'desfeita');
    assert.equal((await getDocs(doMun(bd, 'historico', 'mA', where('acao', '==', 'excluir')))).size, 2);
  });

  test('RH importa e desfaz currículos e funcionários, mas não escolas', async () => {
    const bd = como('rh');
    const { importacaoId } = await importar('rh', ESQUEMAS.curriculos, [curriculoNovo('Ana')]);
    await assert.doesNotReject(desfazerImportacao({ db: bd, importacao: { id: importacaoId, colecao: 'curriculos', municipioId: 'mA' }, usuario: usuario('rh') }));
    const f = await importar('rh', ESQUEMAS.funcionarios, [{ dados: { nome: 'Outra Pessoa', escolaId: 'escolaA', cargo: 'Zelador(a)', situacao: 'Ativa' } }]);
    await assertSucceeds(getDoc(doc(bd, 'importacoes', f.importacaoId)));
    await assert.rejects(importar('rh', ESQUEMAS.escolas, [escolaNova('CEI X')]));
    await assert.rejects(importar('rh', ESQUEMAS.curriculos, [curriculoNovo('Bia')], 'mB'));
  });

  test('diretora não importa nada', async () => {
    await assert.rejects(importar('diretoraA', ESQUEMAS.curriculos, [curriculoNovo('Ana')]));
    await assert.rejects(importar('diretoraA', ESQUEMAS.escolas, [escolaNova('CEI X')]));
  });

  test('a administração importa e desfaz áreas e gastos do controle de saldo', async () => {
    for (const [esquema, dados] of [[ESQUEMAS.rubricas, { nome: 'Material', verbaMensal: 5000 }], [ESQUEMAS.gastos, { rubricaId: 'rA', valorTotal: 900, parcelas: 3, primeiraParcela: '2026-10' }]]) {
      const { importacaoId } = await importar('admin', esquema, [{ dados }]);
      await assert.doesNotReject(desfazerImportacao({ db: como('admin'), importacao: { id: importacaoId, colecao: esquema.colecao, municipioId: 'mA' }, usuario: usuario('admin') }));
    }
    await assert.rejects(importar('rh', ESQUEMAS.gastos, [{ dados: { rubricaId: 'rA', valorTotal: 1 } }]));
  });

  test('o registro da importação não pode ser forjado, alterado à vontade nem apagado', async () => {
    const bd = como('admin');
    const base = { colecao: 'escolas', arquivo: 'x', total: 1, importados: 0, ids: [], porEmail: emailDe('admin'), em: serverTimestamp(), municipioId: 'mA' };
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'rh', status: 'em andamento' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'concluida' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento', colecao: 'usuarios' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento', em: new Date('2020-01-01') }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento', municipioId: 'mB' }));
    const ref = await assertSucceeds(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento' }));
    await assertFails(updateDoc(ref, { ids: ['outro'] }));
    await assertFails(updateDoc(ref, { status: 'qualquer' }));
    await assertFails(updateDoc(ref, { municipioId: 'mB' }));
    await assertSucceeds(updateDoc(ref, { status: 'concluida', importados: 1 }));
    await assertFails(deleteDoc(ref));
    await assertFails(getDoc(doc(como('rh'), 'importacoes', ref.id)));
    await assertFails(getDoc(doc(como('adminB'), 'importacoes', ref.id)));
  });

  test('restaurar a demonstração também limpa as importações', async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'ambiente'), { demo: true }));
    await importar('admin', ESQUEMAS.escolas, [escolaNova('CEI Um')]);
    await resetarDemo(como('sede'));
    assert.equal((await getDocs(collection(como('sede'), 'importacoes'))).size, 0);
  });
});

describe('alertas adiados ("ciente, lembrar depois") dentro do município', () => {
  const adiar = (uid, extra = {}) => ({ ate: '2026-10-20', porUid: uid, porEmail: emailDe(uid), em: serverTimestamp(), ...extra });
  const ref = (bd, municipio, chave) => doc(bd, 'municipios', municipio, 'alertasAdiados', chave);

  test('a administração adia, muda a data e cancela', async () => {
    const bd = como('admin');
    await assertSucceeds(setDoc(ref(bd, 'mA', 'ciclo:k1'), adiar('admin')));
    await assertSucceeds(setDoc(ref(bd, 'mA', 'ciclo:k1'), adiar('admin', { ate: '2026-10-25' })));
    await assertSucceeds(getDocs(collection(bd, 'municipios', 'mA', 'alertasAdiados')));
    await assertSucceeds(deleteDoc(ref(bd, 'mA', 'ciclo:k1')));
  });

  test('data em formato errado, campo extra ou em nome de outro são recusados', async () => {
    const bd = como('admin');
    await assertFails(setDoc(ref(bd, 'mA', 'x'), adiar('admin', { ate: '20/10/2026' })));
    await assertFails(setDoc(ref(bd, 'mA', 'x'), adiar('admin', { lixo: 1 })));
    await assertFails(setDoc(ref(bd, 'mA', 'x'), adiar('rh')));
  });

  test('RH, diretora e outro município não usam', async () => {
    for (const uid of ['rh', 'diretoraA']) {
      await assertFails(setDoc(ref(como(uid), 'mA', 'x'), adiar(uid)));
      await assertFails(getDocs(collection(como(uid), 'municipios', 'mA', 'alertasAdiados')));
    }
    await assertFails(getDocs(collection(como('adminB'), 'municipios', 'mA', 'alertasAdiados')));
  });
});

describe('contratos', () => {
  test('a administração lê os contratos do município; só a sede cadastra', async () => {
    await assertSucceeds(getDocs(doMun(como('admin'), 'contratos', 'mA')));
    await assertFails(getDoc(doc(como('admin'), 'contratos', 'ctB')));
    await assertFails(addDoc(collection(como('admin'), 'contratos'), { municipioId: 'mA', numero: 'TC' }));
    await assertSucceeds(addDoc(collection(como('sede'), 'contratos'), { municipioId: 'mA', numero: 'TC' }));
    for (const uid of ['rh', 'diretoraA']) await assertFails(getDocs(doMun(como(uid), 'contratos', 'mA')));
  });
});
