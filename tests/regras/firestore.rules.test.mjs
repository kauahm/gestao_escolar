// Testes das regras de segurança do Firestore (firestore.rules).
//
// Rodam SOMENTE contra o emulador local, com um projeto fictício ("demo-...").
// Nunca tocam no projeto real. Para rodar:  npm run test:regras
// (precisa de Java 11+ instalado, exigência do emulador do Firestore).

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

const USUARIOS = {
  admin: { nome: 'Ana Admin', perfil: 'admin', situacao: 'ativa', unidadeId: null },
  adminInativo: { nome: 'Ivo Inativo', perfil: 'admin', situacao: 'inativa', unidadeId: null },
  rh: { nome: 'Rita RH', perfil: 'administrativo', situacao: 'ativa', unidadeId: null },
  diretoraA: { nome: 'Dora A', perfil: 'diretora', situacao: 'ativa', unidadeId: 'escolaA' },
  diretoraB: { nome: 'Bia B', perfil: 'diretora', situacao: 'ativa', unidadeId: 'escolaB' },
  diretoraInativa: { nome: 'Inês Inativa', perfil: 'diretora', situacao: 'inativa', unidadeId: 'escolaA' },
  // 'semPerfil' tem conta no Auth, mas nenhum documento em /usuarios.
};

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
    ['escolaA', 'escolaB'].forEach((id) => {
      lote.set(doc(bd, 'escolas', id), { nome: id });
      lote.set(doc(bd, 'manutencoes', `m_${id}`), { escolaId: id, descricao: 'Chamado', status: 'Pendente' });
      lote.set(doc(bd, 'contas', `c_${id}`), { escolaId: id, tipo: 'CPFL', valor: 100, status: 'A enviar' });
      lote.set(doc(bd, 'ciclos', `k_${id}`), { escolaId: id, tipo: 'Extintores' });
    });
    lote.set(doc(bd, 'prestadores', 'p1'), { nome: 'João Encanador', telefone: '19999990000' });
    lote.set(doc(bd, 'curriculos', 'cv1'), { nome: 'Candidata Um', status: 'Disponível' });
    lote.set(doc(bd, 'candidatos', 'cand1'), { nome: 'Candidato Um' });
    lote.set(doc(bd, 'eventos', 'e1'), { titulo: 'Reunião' });
    lote.set(doc(bd, 'config', 'backup'), { formato: 'xlsx' });
    lote.set(doc(bd, 'historico', 'h1'), { acao: 'criar', colecao: 'escolas', porUid: 'admin' });
    lote.set(doc(bd, 'lixeira', 'lx_escola'), { colecao: 'escolas', docId: 'escolaZ', dados: { nome: 'Escola Z' }, excluidoPor: 'admin' });
    lote.set(doc(bd, 'lixeira', 'lx_cv'), { colecao: 'curriculos', docId: 'cvZ', dados: { nome: 'Currículo Z' }, excluidoPor: 'rh' });
    await lote.commit();
  });
});

// ---------------------------------------------------------------------------

describe('quem não está logado ou não tem perfil', () => {
  test('visitante sem login não lê nem grava nada', async () => {
    const bd = anonimo();
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertFails(getDoc(doc(bd, 'usuarios', 'admin')));
    await assertFails(getDocs(collection(bd, 'prestadores')));
    await assertFails(addDoc(collection(bd, 'manutencoes'), chamadoDaDiretora()));
  });

  test('conta criada no Auth sem documento em /usuarios fica sem acesso', async () => {
    const bd = como('semPerfil');
    await assertFails(getDoc(doc(bd, 'escolas', 'escolaA')));
    await assertFails(getDocs(collection(bd, 'prestadores')));
    await assertFails(addDoc(collection(bd, 'historico'), linhaDeHistorico('semPerfil')));
    // E não consegue se dar um perfil.
    await assertFails(setDoc(doc(bd, 'usuarios', 'semPerfil'), { perfil: 'admin', situacao: 'ativa' }));
  });

  test('coleção que não existe nas regras é negada até para o admin', async () => {
    await assertFails(getDoc(doc(como('admin'), 'qualquerCoisa', 'x')));
    await assertFails(setDoc(doc(como('admin'), 'qualquerCoisa', 'x'), { a: 1 }));
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

  test('admin inativo perde tudo, inclusive a leitura de manutenções', async () => {
    const bd = como('adminInativo');
    await assertFails(getDocs(collection(bd, 'manutencoes')));
    await assertFails(getDocs(collection(bd, 'usuarios')));
    await assertFails(getDocs(collection(bd, 'prestadores')));
    await assertFails(updateDoc(doc(bd, 'usuarios', 'adminInativo'), { situacao: 'ativa' }));
    await assertFails(deleteDoc(doc(bd, 'lixeira', 'lx_escola')));
  });

  test('inativo ainda lê o próprio perfil (é assim que o app descobre e desloga)', async () => {
    await assertSucceeds(getDoc(doc(como('diretoraInativa'), 'usuarios', 'diretoraInativa')));
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
  });

  test('não lê nada de outra escola', async () => {
    const bd = como('diretoraA');
    await assertFails(getDoc(doc(bd, 'manutencoes', 'm_escolaB')));
    await assertFails(getDoc(doc(bd, 'contas', 'c_escolaB')));
    await assertFails(getDoc(doc(bd, 'ciclos', 'k_escolaB')));
    for (const colecao of ['manutencoes', 'contas', 'ciclos']) {
      await assertFails(getDocs(query(collection(bd, colecao), where('escolaId', '==', 'escolaB'))));
      await assertFails(getDocs(collection(bd, colecao))); // sem filtro = tentaria ler todas
    }
  });

  test('não acessa o que é da administração ou do RH', async () => {
    const bd = como('diretoraA');
    for (const colecao of ['prestadores', 'curriculos', 'candidatos', 'eventos', 'historico', 'lixeira', 'config', 'usuarios']) {
      await assertFails(getDocs(collection(bd, colecao)));
    }
    await assertFails(setDoc(doc(bd, 'escolas', 'escolaA'), { nome: 'Outra' }));
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

  test('status diferente de "Pendente" é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ status: 'Concluído' })));
    await assertFails(abrir(chamadoDaDiretora({ status: 'Em andamento' })));
  });

  test('em outra escola ou em nome de outra pessoa é recusado', async () => {
    await assertFails(abrir(chamadoDaDiretora({ escolaId: 'escolaB' })));
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

describe('prestadores: só admin', () => {
  test('admin lê e grava', async () => {
    const bd = como('admin');
    await assertSucceeds(getDocs(collection(bd, 'prestadores')));
    await assertSucceeds(addDoc(collection(bd, 'prestadores'), { nome: 'Maria Eletricista' }));
    await assertSucceeds(updateDoc(doc(bd, 'prestadores', 'p1'), { telefone: '19988887777' }));
  });

  test('diretora, RH, sem perfil e visitante não leem nem gravam', async () => {
    for (const bd of [como('diretoraA'), como('rh'), como('semPerfil'), anonimo()]) {
      await assertFails(getDoc(doc(bd, 'prestadores', 'p1')));
      await assertFails(getDocs(collection(bd, 'prestadores')));
      await assertFails(addDoc(collection(bd, 'prestadores'), { nome: 'Intruso' }));
      await assertFails(updateDoc(doc(bd, 'prestadores', 'p1'), { pix: 'outro' }));
      await assertFails(deleteDoc(doc(bd, 'prestadores', 'p1')));
    }
  });
});

describe('administrativo (RH): só currículos e candidatos', () => {
  test('lê e grava currículos e candidatos', async () => {
    const bd = como('rh');
    await assertSucceeds(getDocs(collection(bd, 'curriculos')));
    await assertSucceeds(getDocs(query(collection(bd, 'curriculos'), where('status', '==', 'Entrevista Agendada'))));
    await assertSucceeds(addDoc(collection(bd, 'curriculos'), { nome: 'Nova Candidata', status: 'Disponível' }));
    await assertSucceeds(updateDoc(doc(bd, 'curriculos', 'cv1'), { status: 'Aprovado', feedback: 'Ótima' }));
    await assertSucceeds(getDocs(collection(bd, 'candidatos')));
    await assertSucceeds(updateDoc(doc(bd, 'candidatos', 'cand1'), { nome: 'Outro nome' }));
  });

  test('não lê o resto do sistema', async () => {
    const bd = como('rh');
    for (const colecao of ['manutencoes', 'contas', 'ciclos', 'prestadores', 'eventos', 'historico', 'config', 'usuarios']) {
      await assertFails(getDocs(collection(bd, colecao)));
    }
    await assertFails(getDoc(doc(bd, 'usuarios', 'admin')));
  });

  test('não grava fora do RH', async () => {
    const bd = como('rh');
    await assertFails(setDoc(doc(bd, 'escolas', 'escolaA'), { nome: 'Outra' }));
    await assertFails(addDoc(collection(bd, 'manutencoes'), chamadoDaDiretora({ solicitadaPor: 'rh' })));
    await assertFails(addDoc(collection(bd, 'contas'), { escolaId: 'escolaA', valor: 1 }));
    await assertFails(addDoc(collection(bd, 'eventos'), { titulo: 'x' }));
  });
});

describe('usuários', () => {
  test('cada um lê só o próprio perfil; admin lê todos', async () => {
    await assertSucceeds(getDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA')));
    await assertFails(getDoc(doc(como('diretoraA'), 'usuarios', 'diretoraB')));
    await assertSucceeds(getDocs(collection(como('admin'), 'usuarios')));
  });

  test('ninguém se promove nem troca a própria escola', async () => {
    await assertFails(updateDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA'), { perfil: 'admin' }));
    await assertFails(updateDoc(doc(como('diretoraA'), 'usuarios', 'diretoraA'), { unidadeId: 'escolaB' }));
    await assertFails(updateDoc(doc(como('rh'), 'usuarios', 'rh'), { perfil: 'admin' }));
    await assertFails(updateDoc(doc(como('diretoraInativa'), 'usuarios', 'diretoraInativa'), { situacao: 'ativa' }));
  });

  test('admin cria e edita, mas ninguém apaga usuário', async () => {
    const bd = como('admin');
    await assertSucceeds(setDoc(doc(bd, 'usuarios', 'nova'), { uid: 'nova', perfil: 'diretora', situacao: 'ativa', unidadeId: 'escolaB' }));
    await assertSucceeds(updateDoc(doc(bd, 'usuarios', 'diretoraA'), { situacao: 'inativa' }));
    await assertFails(deleteDoc(doc(bd, 'usuarios', 'diretoraA')));
  });
});

describe('histórico: só acrescenta', () => {
  test('qualquer usuário ativo registra em nome próprio', async () => {
    for (const uid of ['admin', 'rh', 'diretoraA']) {
      await assertSucceeds(addDoc(collection(como(uid), 'historico'), linhaDeHistorico(uid)));
    }
  });

  test('registrar em nome de outra pessoa ou com ação inventada é recusado', async () => {
    const bd = como('diretoraA');
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

  test('ninguém altera nem apaga, nem o admin (fora do ambiente de demonstração)', async () => {
    const bd = como('admin');
    await assertFails(updateDoc(doc(bd, 'historico', 'h1'), { acao: 'excluir' }));
    await assertFails(setDoc(doc(bd, 'historico', 'h1'), linhaDeHistorico('admin')));
    await assertFails(deleteDoc(doc(bd, 'historico', 'h1')));
  });

  test('só o admin lê', async () => {
    await assertSucceeds(getDocs(collection(como('admin'), 'historico')));
    await assertFails(getDoc(doc(como('rh'), 'historico', 'h1')));
    await assertFails(getDoc(doc(como('diretoraA'), 'historico', 'h1')));
  });
});

describe('lixeira e restauração', () => {
  /** Reproduz o deleteDoc de src/services/db.js: copia para a lixeira e apaga, tudo ou nada. */
  const excluirComLixeira = (uid, colecao, docId) => {
    const bd = como(uid);
    const lote = writeBatch(bd);
    lote.set(doc(collection(bd, 'lixeira')), itemDeLixeira(uid, colecao, docId));
    lote.delete(doc(bd, colecao, docId));
    return lote.commit();
  };

  test('admin exclui qualquer registro mandando a cópia para a lixeira', async () => {
    await assertSucceeds(excluirComLixeira('admin', 'escolas', 'escolaB'));
    await assertSucceeds(excluirComLixeira('admin', 'contas', 'c_escolaA'));
    await assertSucceeds(excluirComLixeira('admin', 'curriculos', 'cv1'));
  });

  test('RH exclui currículo e candidato, mas nada além disso', async () => {
    await assertSucceeds(excluirComLixeira('rh', 'curriculos', 'cv1'));
    await assertSucceeds(excluirComLixeira('rh', 'candidatos', 'cand1'));
    await assertFails(excluirComLixeira('rh', 'escolas', 'escolaA'));
    await assertFails(excluirComLixeira('rh', 'contas', 'c_escolaA'));
    // Nem consegue plantar na lixeira um item de outra coleção.
    await assertFails(addDoc(collection(como('rh'), 'lixeira'), itemDeLixeira('rh', 'escolas', 'escolaA')));
  });

  test('diretora não exclui nem mexe na lixeira', async () => {
    await assertFails(excluirComLixeira('diretoraA', 'manutencoes', 'm_escolaA'));
    await assertFails(addDoc(collection(como('diretoraA'), 'lixeira'), itemDeLixeira('diretoraA', 'manutencoes', 'm_escolaA')));
    await assertFails(getDocs(collection(como('diretoraA'), 'lixeira')));
  });

  test('item da lixeira não pode ser gravado em nome de outra pessoa nem alterado', async () => {
    await assertFails(addDoc(collection(como('admin'), 'lixeira'), itemDeLixeira('rh', 'escolas', 'escolaA')));
    await assertFails(updateDoc(doc(como('admin'), 'lixeira', 'lx_escola'), { titulo: 'Adulterado' }));
  });

  test('admin lê toda a lixeira; RH só o que é de currículos e candidatos', async () => {
    await assertSucceeds(getDocs(collection(como('admin'), 'lixeira')));
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

  test('admin restaura (recria no lugar original e tira da lixeira)', async () => {
    await assertSucceeds(restaurar('admin', 'lx_escola', 'escolas', 'escolaZ', { nome: 'Escola Z' }));
    await assertSucceeds(restaurar('admin', 'lx_cv', 'curriculos', 'cvZ', { nome: 'Currículo Z' }));
  });

  test('restaurar é só do admin', async () => {
    await assertFails(restaurar('rh', 'lx_cv', 'curriculos', 'cvZ', { nome: 'Currículo Z' }));
    await assertFails(deleteDoc(doc(como('rh'), 'lixeira', 'lx_cv')));
    await assertFails(deleteDoc(doc(como('diretoraA'), 'lixeira', 'lx_escola')));
  });
});

describe('ambiente de demonstração', () => {
  const marcarComoDemo = (valor = { demo: true }) =>
    ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'ambiente'), valor));

  test('ninguém consegue marcar o projeto como demonstração pelo app', async () => {
    for (const uid of ['admin', 'rh', 'diretoraA']) {
      await assertFails(setDoc(doc(como(uid), 'config', 'ambiente'), { demo: true }));
    }
    await marcarComoDemo({ demo: false });
    await assertFails(updateDoc(doc(como('admin'), 'config', 'ambiente'), { demo: true }));
    await assertFails(deleteDoc(doc(como('admin'), 'config', 'ambiente')));
  });

  test('sem a marca (projeto real), o histórico não pode ser apagado', async () => {
    await assertFails(deleteDoc(doc(como('admin'), 'historico', 'h1')));
    await marcarComoDemo({ demo: false });
    await assertFails(deleteDoc(doc(como('admin'), 'historico', 'h1')));
  });

  test('com a marca, só o admin apaga o histórico; alterar continua proibido', async () => {
    await marcarComoDemo();
    await assertFails(deleteDoc(doc(como('rh'), 'historico', 'h1')));
    await assertFails(deleteDoc(doc(como('diretoraA'), 'historico', 'h1')));
    await assertFails(updateDoc(doc(como('admin'), 'historico', 'h1'), { acao: 'excluir' }));
    await assertSucceeds(deleteDoc(doc(como('admin'), 'historico', 'h1')));
  });

  test('restaurar dados de demonstração se recusa a rodar sem a marca e não apaga nada', async () => {
    await assert.rejects(resetarDemo(como('admin')), /não está marcado/);
    const escola = await getDoc(doc(como('admin'), 'escolas', 'escolaA'));
    assert.equal(escola.exists(), true);
  });

  test('restaurar dados de demonstração troca tudo pelos dados fictícios e preserva os usuários', async () => {
    await marcarComoDemo();
    const bd = como('admin');
    const resultado = await resetarDemo(bd);
    const esperado = gerarDadosDemo();
    const totalEsperado = Object.values(esperado).reduce((soma, lista) => soma + lista.length, 0);
    assert.equal(resultado.criados, totalEsperado);

    for (const [colecao, lista] of Object.entries(esperado)) {
      const snap = await getDocs(collection(bd, colecao));
      assert.equal(snap.size, lista.length, `coleção ${colecao}`);
    }
    for (const colecao of ['historico', 'lixeira', 'candidatos']) {
      assert.equal((await getDocs(collection(bd, colecao))).size, 0, `coleção ${colecao} deveria estar vazia`);
    }
    assert.equal((await getDoc(doc(bd, 'escolas', 'escolaA'))).exists(), false);
    assert.equal((await getDocs(collection(bd, 'usuarios'))).size, Object.keys(USUARIOS).length);
    assert.equal((await getDoc(doc(bd, 'config', 'ambiente'))).data().demo, true);

    // Rodar de novo dá no mesmo resultado (identificadores fixos).
    await resetarDemo(bd);
    assert.equal((await getDocs(collection(bd, 'escolas'))).size, esperado.escolas.length);
  });

  test('RH e diretora não conseguem restaurar os dados de demonstração', async () => {
    await marcarComoDemo();
    await assert.rejects(resetarDemo(como('rh')));
    await assert.rejects(resetarDemo(como('diretoraA')));
    assert.equal((await getDoc(doc(como('admin'), 'escolas', 'escolaA'))).exists(), true);
  });

  test('dados fictícios: toda conta, ciclo e chamado aponta para uma escola que existe', () => {
    const dados = gerarDadosDemo();
    const ids = new Set(dados.escolas.map((e) => e.id));
    for (const colecao of ['contas', 'ciclos', 'manutencoes']) {
      for (const registro of dados[colecao]) assert.ok(ids.has(registro.escolaId), `${colecao}/${registro.id}`);
    }
    const todosOsIds = Object.values(dados).flatMap((lista) => lista.map((r) => r.id));
    assert.equal(new Set(todosOsIds).size, todosOsIds.length, 'identificadores repetidos');
    const prestadores = new Set(dados.prestadores.map((p) => p.nome));
    for (const m of dados.manutencoes) assert.ok(m.responsavel === 'A definir' || prestadores.has(m.responsavel), m.responsavel);
  });
});

describe('importação de planilhas', () => {
  const usuario = (uid) => ({ uid, email: emailDe(uid) });
  const escolaNova = (nome) => ({ dados: { nome, codigo: '', situacao: 'Ativa', bairro: 'Centro', numeroAlunos: 0, capacidadeCaixaDagua: 0 } });
  const curriculoNovo = (nome) => ({ dados: { nome, telefone: '(19) 99999-0000', vaga: 'Cozinheira', exp: 'Não', status: 'Disponível' } });

  test('admin importa escolas: registros, histórico e registro da importação', async () => {
    const bd = como('admin');
    const { importacaoId, importados } = await importarRegistros({
      db: bd, esquema: ESQUEMAS.escolas, registros: [escolaNova('CEI Um'), escolaNova('CEI Dois')], arquivo: 'escolas.xlsx', usuario: usuario('admin'),
    });
    assert.equal(importados, 2);
    const criadas = await getDocs(query(collection(bd, 'escolas'), where('importacaoId', '==', importacaoId)));
    assert.equal(criadas.size, 2);
    assert.ok(criadas.docs.every((d) => d.data().criadoEm && d.data().atualizadoEm));
    const importacao = (await getDoc(doc(bd, 'importacoes', importacaoId))).data();
    assert.equal(importacao.status, 'concluida');
    assert.equal(importacao.importados, 2);
    assert.equal(importacao.ids.length, 2);
    const historico = await getDocs(query(collection(bd, 'historico'), where('acao', '==', 'criar')));
    const ids = new Set(criadas.docs.map((d) => d.id));
    assert.equal(historico.docs.filter((h) => ids.has(h.data().docId)).length, 2);
  });

  test('importação grande é gravada em vários lotes', async () => {
    const registros = Array.from({ length: 450 }, (_, i) => escolaNova(`CEI ${i}`));
    const { importados } = await importarRegistros({ db: como('admin'), esquema: ESQUEMAS.escolas, registros, arquivo: 'grande.csv', usuario: usuario('admin') });
    assert.equal(importados, 450);
    assert.equal((await getDocs(collection(como('admin'), 'escolas'))).size, 452); // + as 2 de partida
  });

  test('admin desfaz: tudo vai para a lixeira, com histórico, e a importação fica marcada', async () => {
    const bd = como('admin');
    const { importacaoId } = await importarRegistros({ db: bd, esquema: ESQUEMAS.escolas, registros: [escolaNova('CEI Um'), escolaNova('CEI Dois')], arquivo: 'x.xlsx', usuario: usuario('admin') });
    const { removidos } = await desfazerImportacao({ db: bd, importacao: { id: importacaoId, colecao: 'escolas' }, usuario: usuario('admin') });
    assert.equal(removidos, 2);
    assert.equal((await getDocs(query(collection(bd, 'escolas'), where('importacaoId', '==', importacaoId)))).size, 0);
    const lixeira = await getDocs(query(collection(bd, 'lixeira'), where('colecao', '==', 'escolas')));
    assert.equal(lixeira.docs.filter((d) => d.data().dados.importacaoId === importacaoId).length, 2);
    assert.equal((await getDoc(doc(bd, 'importacoes', importacaoId))).data().status, 'desfeita');
    const excluidos = await getDocs(query(collection(bd, 'historico'), where('acao', '==', 'excluir')));
    assert.equal(excluidos.size, 2);
  });

  test('RH importa e desfaz currículos, mas não importa escolas nem contas', async () => {
    const bd = como('rh');
    const { importacaoId } = await importarRegistros({ db: bd, esquema: ESQUEMAS.curriculos, registros: [curriculoNovo('Ana')], arquivo: 'cv.csv', usuario: usuario('rh') });
    await assert.doesNotReject(desfazerImportacao({ db: bd, importacao: { id: importacaoId, colecao: 'curriculos' }, usuario: usuario('rh') }));
    await assert.rejects(importarRegistros({ db: bd, esquema: ESQUEMAS.escolas, registros: [escolaNova('CEI X')], arquivo: 'x', usuario: usuario('rh') }));
    assert.equal((await getDocs(collection(como('admin'), 'escolas'))).size, 2);
  });

  test('diretora não importa nada', async () => {
    await assert.rejects(importarRegistros({ db: como('diretoraA'), esquema: ESQUEMAS.curriculos, registros: [curriculoNovo('Ana')], arquivo: 'x', usuario: usuario('diretoraA') }));
    await assert.rejects(importarRegistros({ db: como('diretoraA'), esquema: ESQUEMAS.escolas, registros: [escolaNova('CEI X')], arquivo: 'x', usuario: usuario('diretoraA') }));
  });

  test('o registro da importação não pode ser forjado, alterado à vontade nem apagado', async () => {
    const bd = como('admin');
    const base = { colecao: 'escolas', arquivo: 'x', total: 1, importados: 0, ids: [], porEmail: emailDe('admin'), em: serverTimestamp() };
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'rh', status: 'em andamento' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'concluida' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento', colecao: 'usuarios' }));
    await assertFails(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento', em: new Date('2020-01-01') }));
    const ref = await assertSucceeds(addDoc(collection(bd, 'importacoes'), { ...base, porUid: 'admin', status: 'em andamento' }));
    await assertFails(updateDoc(ref, { ids: ['outro'] }));
    await assertFails(updateDoc(ref, { status: 'qualquer' }));
    await assertSucceeds(updateDoc(ref, { status: 'concluida', importados: 1 }));
    await assertFails(deleteDoc(ref));
    await assertFails(getDoc(doc(como('rh'), 'importacoes', ref.id)));
  });

  test('restaurar a demonstração também limpa as importações', async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'config', 'ambiente'), { demo: true }));
    const bd = como('admin');
    await importarRegistros({ db: bd, esquema: ESQUEMAS.escolas, registros: [escolaNova('CEI Um')], arquivo: 'x', usuario: usuario('admin') });
    await resetarDemo(bd);
    assert.equal((await getDocs(collection(bd, 'importacoes'))).size, 0);
  });
});

describe('admin: uso normal das telas', () => {
  test('lê todas as coleções que o painel, a agenda e a cópia de segurança usam', async () => {
    const bd = como('admin');
    for (const colecao of ['escolas', 'manutencoes', 'prestadores', 'contas', 'ciclos', 'eventos', 'curriculos', 'candidatos', 'usuarios', 'lixeira', 'historico']) {
      await assertSucceeds(getDocs(collection(bd, colecao)));
    }
    await assertSucceeds(getDoc(doc(bd, 'config', 'backup')));
  });

  test('grava nas coleções de trabalho e registra a data da cópia', async () => {
    const bd = como('admin');
    await assertSucceeds(addDoc(collection(bd, 'manutencoes'), { escolaId: 'escolaB', descricao: 'Pintura', status: 'Em andamento' }));
    await assertSucceeds(updateDoc(doc(bd, 'contas', 'c_escolaA'), { status: 'Enviada' }));
    await assertSucceeds(addDoc(collection(bd, 'eventos'), { titulo: 'Visita' }));
    await assertSucceeds(setDoc(doc(bd, 'config', 'backup'), { ultimoEm: serverTimestamp(), formato: 'json' }));
  });
});
