// Camada de gravação do sistema.
//
// As telas importam addDoc, updateDoc, setDoc e deleteDoc DAQUI, e não direto
// de 'firebase/firestore'. As assinaturas são as mesmas do Firebase, então o
// código das telas não muda. O que muda é o que acontece por trás:
//
// 1. EXCLUIR NÃO APAGA DE VERDADE. O documento é copiado para a coleção
//    `lixeira` e só então removido, na mesma operação (tudo ou nada). Se a
//    cópia falhar, nada é excluído. Pela tela "Segurança dos dados" o admin
//    restaura com um clique.
// 2. TODA ALTERAÇÃO FICA REGISTRADA na coleção `historico`: quem fez, quando,
//    o que era antes e o que ficou depois.
//
// O histórico é gravado em seguida, em "melhor esforço": se ele falhar, a
// operação principal já foi feita e o erro só aparece no console. Assim um
// problema no registro nunca impede o trabalho do dia a dia.

import {
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  addDoc as fbAddDoc,
  updateDoc as fbUpdateDoc,
  setDoc as fbSetDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { tituloDoRegistro } from '../utils/tituloDoRegistro.js';

export const COLECAO_LIXEIRA = 'lixeira';
export const COLECAO_HISTORICO = 'historico';

// Campos que não interessam no "antes/depois" do histórico.
const CAMPOS_IGNORADOS = new Set(['atualizadoEm', 'criadoEm']);

/** Nome da coleção de uma referência (documento ou coleção). */
const nomeDaColecao = (ref) => (ref.type === 'collection' ? ref.id : ref.parent.id);

export { tituloDoRegistro };

/**
 * As telas montam o formulário copiando o registro inteiro, inclusive o `id`
 * (que é o nome do documento, não um campo dele). Sem este filtro, editar um
 * registro gravava um campo "id" dentro do próprio documento.
 */
const semId = (dados = {}) => {
  if (!dados || typeof dados !== 'object' || !('id' in dados)) return dados;
  const { id, ...resto } = dados; // eslint-disable-line no-unused-vars
  return resto;
};

/** Remove sentinelas do Firebase (ex.: serverTimestamp) para guardar no histórico. */
const limparParaHistorico = (dados = {}) => {
  const saida = {};
  Object.entries(dados).forEach(([chave, valor]) => {
    if (CAMPOS_IGNORADOS.has(chave)) return;
    if (valor && typeof valor === 'object' && typeof valor._methodName === 'string') return; // sentinela
    if (valor === undefined) return;
    saida[chave] = valor;
  });
  return saida;
};

/** Mantém só as chaves que mudaram de fato. */
const diferencas = (antes = {}, depois = {}) => {
  const a = {};
  const d = {};
  Object.keys(depois).forEach((chave) => {
    const va = antes[chave];
    const vd = depois[chave];
    if (JSON.stringify(va ?? null) !== JSON.stringify(vd ?? null)) {
      a[chave] = va ?? null;
      d[chave] = vd ?? null;
    }
  });
  return { antes: a, depois: d };
};

const quemEsta = () => ({
  porUid: auth.currentUser?.uid || null,
  porEmail: auth.currentUser?.email || null,
});

/** Grava uma linha no histórico sem nunca derrubar a operação principal. */
const registrar = async (entrada) => {
  try {
    await fbAddDoc(collection(db, COLECAO_HISTORICO), {
      ...entrada,
      ...quemEsta(),
      em: serverTimestamp(),
    });
  } catch (erro) {
    console.warn('[historico] não foi possível registrar a alteração:', erro?.code || erro);
  }
};

// ---------------------------------------------------------------------------
// Mesmas assinaturas do Firebase
// ---------------------------------------------------------------------------

export async function addDoc(collectionRef, dadosRecebidos) {
  const dados = semId(dadosRecebidos);
  const ref = await fbAddDoc(collectionRef, dados);
  const limpo = limparParaHistorico(dados);
  registrar({
    acao: 'criar',
    colecao: nomeDaColecao(collectionRef),
    docId: ref.id,
    titulo: tituloDoRegistro(limpo),
    antes: null,
    depois: limpo,
  });
  return ref;
}

export async function setDoc(docRef, dadosRecebidos, opcoes) {
  const dados = semId(dadosRecebidos);
  let anterior = null;
  try {
    const snap = await getDoc(docRef);
    anterior = snap.exists() ? snap.data() : null;
  } catch {
    anterior = null;
  }

  await (opcoes ? fbSetDoc(docRef, dados, opcoes) : fbSetDoc(docRef, dados));

  const limpo = limparParaHistorico(dados);
  const { antes, depois } = anterior ? diferencas(anterior, limpo) : { antes: null, depois: limpo };
  registrar({
    acao: anterior ? 'alterar' : 'criar',
    colecao: nomeDaColecao(docRef),
    docId: docRef.id,
    titulo: tituloDoRegistro({ ...(anterior || {}), ...limpo }),
    antes,
    depois,
  });
}

export async function updateDoc(docRef, dadosRecebidos) {
  const dados = semId(dadosRecebidos);
  // Lê o estado anterior para o histórico mostrar "era X, ficou Y".
  let anterior = {};
  try {
    const snap = await getDoc(docRef);
    anterior = snap.exists() ? snap.data() : {};
  } catch {
    anterior = {};
  }

  await fbUpdateDoc(docRef, dados);

  const limpo = limparParaHistorico(dados);
  const { antes, depois } = diferencas(anterior, limpo);
  if (Object.keys(depois).length === 0) return; // nada mudou de fato

  registrar({
    acao: 'alterar',
    colecao: nomeDaColecao(docRef),
    docId: docRef.id,
    titulo: tituloDoRegistro({ ...anterior, ...limpo }),
    antes,
    depois,
  });
}

/**
 * "Excluir": guarda uma cópia completa na lixeira e remove o original,
 * numa única operação. Se a cópia não puder ser feita, nada é excluído.
 */
export async function deleteDoc(docRef) {
  const snap = await getDoc(docRef);
  if (!snap.exists()) return; // já não existe: nada a fazer

  const dados = snap.data();
  const colecao = nomeDaColecao(docRef);
  const titulo = tituloDoRegistro(dados);
  const { porUid, porEmail } = quemEsta();

  const lote = writeBatch(db);
  lote.set(doc(collection(db, COLECAO_LIXEIRA)), {
    colecao,
    docId: docRef.id,
    titulo,
    dados,
    excluidoEm: serverTimestamp(),
    excluidoPor: porUid,
    excluidoPorEmail: porEmail,
  });
  lote.delete(docRef);
  await lote.commit();

  registrar({
    acao: 'excluir',
    colecao,
    docId: docRef.id,
    titulo,
    antes: limparParaHistorico(dados),
    depois: null,
  });
}

/**
 * Restaura um item da lixeira para o lugar original (mesmo id).
 * Se já existir um registro com aquele id, não sobrescreve.
 */
export async function restaurarDaLixeira(itemLixeira) {
  const destino = doc(db, itemLixeira.colecao, itemLixeira.docId);
  const existente = await getDoc(destino);
  if (existente.exists()) {
    throw new Error('Já existe um registro com este identificador. Nada foi alterado.');
  }

  const lote = writeBatch(db);
  lote.set(destino, itemLixeira.dados);
  lote.delete(doc(db, COLECAO_LIXEIRA, itemLixeira.id));
  await lote.commit();

  registrar({
    acao: 'restaurar',
    colecao: itemLixeira.colecao,
    docId: itemLixeira.docId,
    titulo: itemLixeira.titulo || tituloDoRegistro(itemLixeira.dados),
    antes: null,
    depois: limparParaHistorico(itemLixeira.dados),
  });
}
