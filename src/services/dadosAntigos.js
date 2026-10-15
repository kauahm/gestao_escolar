// Dados antigos: registros de antes da divisão por município (sem municipioId).
//
// Só a sede usa, uma vez, logo depois de publicar a divisão: procura tudo o
// que ainda não tem município e atribui ao município escolhido (no sistema
// real, hoje, tudo é de Hortolândia). As regras deixam a sede apenas
// ACRESCENTAR o município, sem mudar mais nada, inclusive no histórico e na
// lixeira, que de resto nunca se alteram. Ver docs/22-acesso-por-municipio.md.
//
// Recebe o banco por parâmetro para poder ser testado no emulador.

import {
  collection, deleteDoc, doc, getDocs, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { COLECOES_DO_MUNICIPIO } from './escopo.js';

const POR_LOTE = 400; // o limite do Firestore é 500 operações por lote

/** Configurações que passam a ficar dentro do município (municipios/{id}/config/...). */
const CONFIGS_DO_MUNICIPIO = ['saldo', 'backup'];

/**
 * Procura o que ainda não tem município.
 * @returns {{ porColecao: Object<string, string[]>, total: number, configs: string[], alertasAdiados: string[] }}
 */
export async function procurarDadosAntigos(db) {
  const porColecao = {};
  let total = 0;
  for (const nome of COLECOES_DO_MUNICIPIO) {
    const snap = await getDocs(collection(db, nome));
    const ids = snap.docs
      // Só o que NÃO tem o campo. Campo presente e vazio (null) é registro da própria
      // sede (ex.: o histórico de cadastrar um município), que não é de município nenhum.
      .filter((d) => !('municipioId' in d.data()))
      // A conta da sede não pertence a município nenhum.
      .filter((d) => !(nome === 'usuarios' && d.data().perfil === 'sede'))
      .map((d) => d.id);
    if (ids.length) {
      porColecao[nome] = ids;
      total += ids.length;
    }
  }
  const configs = (await getDocs(collection(db, 'config'))).docs
    .filter((d) => CONFIGS_DO_MUNICIPIO.includes(d.id))
    .map((d) => ({ id: d.id, dados: d.data() }));
  const alertasAdiados = (await getDocs(collection(db, 'alertasAdiados'))).docs.map((d) => d.id);
  return { porColecao, total, configs, alertasAdiados };
}

/**
 * Atribui ao município tudo o que foi achado por procurarDadosAntigos.
 * - registros: ganham municipioId (nada mais muda);
 * - config/saldo e config/backup: passam para municipios/{id}/config;
 * - alertas adiados antigos ("ciente, lembrar depois"): são descartados
 *   (eram só preferência de exibição e voltam a aparecer no painel).
 * @returns {{ atualizados: number }}
 */
export async function atribuirDadosAntigos(db, municipioId, achados, usuario) {
  if (!municipioId) throw new Error('Escolha o município.');
  const operacoes = [];
  Object.entries(achados.porColecao).forEach(([nome, ids]) => {
    ids.forEach((id) => operacoes.push((lote) => lote.update(doc(db, nome, id), { municipioId })));
  });
  achados.configs.forEach(({ id, dados }) => {
    operacoes.push((lote) => lote.set(doc(db, 'municipios', municipioId, 'config', id), dados));
  });

  for (let i = 0; i < operacoes.length; i += POR_LOTE) {
    const lote = writeBatch(db);
    operacoes.slice(i, i + POR_LOTE).forEach((aplicar) => aplicar(lote));
    await lote.commit();
  }

  // Os originais só saem depois que as cópias foram gravadas.
  for (const { id } of achados.configs) await deleteDoc(doc(db, 'config', id));
  for (const id of achados.alertasAdiados) await deleteDoc(doc(db, 'alertasAdiados', id));

  // Uma linha só no histórico, com o resumo (em vez de uma por registro).
  const resumo = Object.entries(achados.porColecao).map(([nome, ids]) => `${nome}: ${ids.length}`).join(', ');
  const lote = writeBatch(db);
  lote.set(doc(collection(db, 'historico')), {
    acao: 'alterar',
    colecao: 'municipios',
    docId: municipioId,
    titulo: `Dados antigos atribuídos ao município (${achados.total} registros)`.slice(0, 200),
    antes: null,
    depois: { resumo },
    porUid: usuario.uid,
    porEmail: usuario.email || null,
    em: serverTimestamp(),
    municipioId,
  });
  await lote.commit();

  return { atualizados: achados.total };
}
