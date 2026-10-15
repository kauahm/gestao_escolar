// Grava uma importação no Firestore e desfaz, se for preciso.
//
// Segue as mesmas garantias da camada services/db.js:
// - cada registro criado ganha uma linha no histórico (na MESMA operação:
//   se o histórico não puder ser gravado, o registro também não é);
// - desfazer não apaga de verdade: os registros vão para a lixeira.
//
// Cada importação fica registrada na coleção `importacoes`, com a lista de
// identificadores criados, e cada registro importado leva `importacaoId`.

import {
  collection, doc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { tituloDoRegistro } from '../utils/tituloDoRegistro.js';
import { municipioAtivo } from '../services/escopo.js';

export const COLECAO_IMPORTACOES = 'importacoes';

// O Firestore aceita até 500 operações por lote. Importar = 2 por registro
// (registro + histórico); desfazer = 3 (lixeira + exclusão + histórico).
const POR_LOTE_IMPORTAR = 200;
const POR_LOTE_DESFAZER = 150;

const linhaDeHistorico = (usuario, acao, colecao, docId, dados, agora, municipioId) => ({
  municipioId,
  acao,
  colecao,
  docId,
  titulo: tituloDoRegistro(dados),
  antes: acao === 'criar' ? null : dados,
  depois: acao === 'criar' ? dados : null,
  porUid: usuario.uid,
  porEmail: usuario.email || null,
  em: agora,
});

/**
 * @param {{ db, esquema, registros: {dados: object}[], arquivo: string, usuario: {uid, email}, municipioId?: string }} p
 *   municipioId: de qual município são os registros (padrão: o município ativo).
 * @returns {Promise<{ importacaoId: string, importados: number }>}
 */
export async function importarRegistros({ db, esquema, registros, arquivo, usuario, municipioId = municipioAtivo() }) {
  if (!registros.length) throw new Error('Nenhuma linha válida para importar.');
  if (!municipioId) throw new Error('Escolha o município antes de importar.');
  const colecao = esquema.colecao;
  const refImportacao = doc(collection(db, COLECAO_IMPORTACOES));
  const refs = registros.map(() => doc(collection(db, colecao)));

  // 1. Registra a importação antes de gravar qualquer coisa: se algo falhar
  //    no meio, ela já existe e pode ser desfeita.
  const inicio = writeBatch(db);
  inicio.set(refImportacao, {
    municipioId,
    colecao,
    arquivo: String(arquivo || '').slice(0, 200),
    total: registros.length,
    importados: 0,
    ids: refs.map((r) => r.id),
    status: 'em andamento',
    porUid: usuario.uid,
    porEmail: usuario.email || null,
    em: serverTimestamp(),
  });
  await inicio.commit();

  // 2. Grava em lotes.
  let importados = 0;
  try {
    for (let i = 0; i < registros.length; i += POR_LOTE_IMPORTAR) {
      const lote = writeBatch(db);
      const agora = serverTimestamp();
      registros.slice(i, i + POR_LOTE_IMPORTAR).forEach(({ dados }, j) => {
        const ref = refs[i + j];
        lote.set(ref, { ...dados, ...esquema.carimbos(agora), importacaoId: refImportacao.id, municipioId });
        lote.set(
          doc(collection(db, 'historico')),
          linhaDeHistorico(usuario, 'criar', colecao, ref.id, { ...dados, importacaoId: refImportacao.id }, agora, municipioId),
        );
      });
      await lote.commit();
      importados = Math.min(registros.length, i + POR_LOTE_IMPORTAR);
    }
  } catch (erro) {
    await marcar(db, refImportacao, { status: 'incompleta', importados });
    const e = new Error(
      importados
        ? `A importação parou no meio: ${importados} de ${registros.length} registros foram gravados. Você pode desfazê-la e tentar de novo.`
        : 'Não foi possível gravar a importação. Nada foi alterado.',
    );
    e.causa = erro;
    e.importacaoId = refImportacao.id;
    throw e;
  }

  await marcar(db, refImportacao, { status: 'concluida', importados });
  return { importacaoId: refImportacao.id, importados };
}

const marcar = async (db, ref, campos) => {
  const lote = writeBatch(db);
  lote.update(ref, campos);
  try { await lote.commit(); } catch (erro) { console.warn('[importacao] não foi possível atualizar o status:', erro?.code || erro); }
};

/**
 * Desfaz uma importação: tudo o que ela criou vai para a lixeira (inclusive
 * registros que tenham sido editados depois).
 * @param {{ db, importacao: {id, colecao, municipioId?}, usuario: {uid, email} }} p
 * @returns {Promise<{ removidos: number }>}
 */
export async function desfazerImportacao({ db, importacao, usuario }) {
  const { id, colecao } = importacao;
  const municipioId = importacao.municipioId || municipioAtivo();
  // A consulta precisa dizer o município: as regras não deixam ler sem ele.
  const snap = await getDocs(query(collection(db, colecao), where('municipioId', '==', municipioId), where('importacaoId', '==', id)));
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += POR_LOTE_DESFAZER) {
    const lote = writeBatch(db);
    const agora = serverTimestamp();
    docs.slice(i, i + POR_LOTE_DESFAZER).forEach((d) => {
      const dados = d.data();
      lote.set(doc(collection(db, 'lixeira')), {
        colecao,
        docId: d.id,
        titulo: tituloDoRegistro(dados),
        dados,
        excluidoEm: agora,
        excluidoPor: usuario.uid,
        excluidoPorEmail: usuario.email || null,
        motivo: 'importação desfeita',
        municipioId,
      });
      lote.delete(d.ref);
      lote.set(doc(collection(db, 'historico')), linhaDeHistorico(usuario, 'excluir', colecao, d.id, dados, agora, municipioId));
    });
    await lote.commit();
  }

  const fim = writeBatch(db);
  fim.update(doc(db, COLECAO_IMPORTACOES, id), {
    status: 'desfeita',
    desfeitaEm: serverTimestamp(),
    desfeitaPor: usuario.uid,
  });
  await fim.commit();
  return { removidos: docs.length };
}
