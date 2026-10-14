// "Restaurar dados de demonstração": apaga o conteúdo do ambiente de
// demonstração e grava de novo os dados fictícios de dadosDemo.js.
//
// TRAVAS (todas precisam passar; ver docs/13-ambiente-de-demonstracao.md):
// 1. O botão só existe quando o app roda no modo demo (services/ambiente.js).
// 2. Esta função se recusa a rodar no projeto real, pelo identificador.
// 3. Ela exige o documento `config/ambiente` com `demo: true`. Esse documento
//    só pode ser criado à mão no console do Firebase (as regras proíbem o app
//    de gravá-lo), e só existe no projeto de demonstração.
// 4. As regras só deixam apagar o histórico quando esse documento existe.
//
// Contas de usuário (`usuarios`) e `config/ambiente` nunca são tocados.

import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { gerarDadosDemo } from './dadosDemo.js';

const PROJETO_REAL = 'gestaoescolar-b84c2';

/** Coleções esvaziadas na restauração. */
export const COLECOES_APAGADAS = [
  'escolas', 'manutencoes', 'prestadores', 'contas', 'ciclos',
  'eventos', 'curriculos', 'candidatos', 'lixeira', 'historico',
];

const TAMANHO_DO_LOTE = 400; // o limite do Firestore é 500 operações por lote

const emLotes = async (db, itens, aplicar) => {
  for (let i = 0; i < itens.length; i += TAMANHO_DO_LOTE) {
    const lote = writeBatch(db);
    itens.slice(i, i + TAMANHO_DO_LOTE).forEach((item) => aplicar(lote, item));
    await lote.commit();
  }
};

/**
 * @param db Firestore do ambiente de demonstração.
 * @returns {{ apagados: number, criados: number }}
 */
export async function resetarDemo(db) {
  if (db.app?.options?.projectId === PROJETO_REAL) {
    throw new Error('Recusado: este é o projeto real, não o de demonstração.');
  }

  let marcador;
  try {
    marcador = await getDoc(doc(db, 'config', 'ambiente'));
  } catch {
    marcador = null;
  }
  if (!marcador?.exists() || marcador.data().demo !== true) {
    throw new Error('Recusado: este projeto não está marcado como ambiente de demonstração (config/ambiente).');
  }

  // 1. Apaga o que existe.
  let apagados = 0;
  for (const nome of COLECOES_APAGADAS) {
    const snap = await getDocs(collection(db, nome));
    await emLotes(db, snap.docs, (lote, d) => lote.delete(d.ref));
    apagados += snap.size;
  }
  // A data da última cópia de segurança também volta ao início.
  const loteConfig = writeBatch(db);
  loteConfig.delete(doc(db, 'config', 'backup'));
  await loteConfig.commit();

  // 2. Grava os dados fictícios.
  const dados = gerarDadosDemo();
  const registros = Object.entries(dados).flatMap(([nome, lista]) =>
    lista.map(({ id, ...campos }) => ({ ref: doc(db, nome, id), campos })));
  await emLotes(db, registros, (lote, r) => lote.set(r.ref, r.campos));

  return { apagados, criados: registros.length };
}
