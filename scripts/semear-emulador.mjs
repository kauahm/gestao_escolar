// Prepara os emuladores locais do Firebase para testar o sistema no computador:
// cria três usuários de teste, marca o ambiente como demonstração e grava os
// dados fictícios (a mesma restauração do botão "Restaurar dados de demonstração").
//
// Uso (com `npm run emulador` rodando em outro terminal):
//   npm run emulador:dados
// Depois: npm run dev:emulador  e entre com um dos usuários abaixo.
//
// SÓ funciona contra os emuladores em 127.0.0.1: os endereços estão fixos aqui
// e o projeto "demo-gestao-escolar" não existe na nuvem.

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { resetarDemo } from '../src/demo/resetarDemo.js';

const PROJETO = 'demo-gestao-escolar';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';

/** Usuários de teste (só existem no emulador local). */
export const USUARIOS_DE_TESTE = [
  { email: 'admin@demo.test', senha: 'demo-local-123', nome: 'Administração (teste)', perfil: 'admin', unidadeId: null, unidadeNome: null },
  { email: 'diretora@demo.test', senha: 'demo-local-123', nome: 'Helena Barros (teste)', perfil: 'diretora', unidadeId: 'demo-escola-01', unidadeNome: 'CEI Pequenos Passos' },
  { email: 'rh@demo.test', senha: 'demo-local-123', nome: 'RH (teste)', perfil: 'administrativo', unidadeId: null, unidadeNome: null },
];

const campo = (v) => (v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) });

/** Grava um documento passando por cima das regras (só o emulador aceita "owner"). */
const gravarComoDono = async (caminho, dados) => {
  const corpo = { fields: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, campo(v)])) };
  const r = await fetch(`${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`Falha ao gravar ${caminho}: ${r.status} ${await r.text()}`);
};

const criarOuEntrar = async ({ email, senha }) => {
  const chamar = (acao) => fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${acao}?key=chave-ficticia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  }).then((r) => r.json());
  let r = await chamar('signUp');
  if (r.error?.message === 'EMAIL_EXISTS') r = await chamar('signInWithPassword');
  if (!r.localId) throw new Error(`Não foi possível criar ${email}: ${JSON.stringify(r.error || r)}`);
  return r.localId;
};

try {
  await fetch(`${AUTH}/`).catch(() => { throw new Error('Emulador não encontrado. Rode antes, em outro terminal: npm run emulador'); });

  for (const u of USUARIOS_DE_TESTE) {
    const uid = await criarOuEntrar(u);
    await gravarComoDono(`usuarios/${uid}`, {
      uid, nome: u.nome, email: u.email, perfil: u.perfil,
      unidadeId: u.unidadeId, unidadeNome: u.unidadeNome, situacao: 'ativa',
    });
  }
  await gravarComoDono('config/ambiente', { demo: true });

  const app = initializeApp({ apiKey: 'chave-ficticia', projectId: PROJETO, authDomain: `${PROJETO}.firebaseapp.com` });
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await signInWithEmailAndPassword(auth, USUARIOS_DE_TESTE[0].email, USUARIOS_DE_TESTE[0].senha);
  const { criados } = await resetarDemo(db);

  console.log(`Pronto: ${USUARIOS_DE_TESTE.length} usuários de teste e ${criados} registros fictícios no emulador.`);
  console.log('Usuários (senha no próprio script):', USUARIOS_DE_TESTE.map((u) => `${u.email} (${u.perfil})`).join(', '));
  process.exit(0);
} catch (erro) {
  console.error(erro.message || erro);
  process.exit(1);
}
