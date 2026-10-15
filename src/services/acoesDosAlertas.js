// Ações que o quadro "Precisa de atenção" oferece em cada alerta.
//
// O que mexe em dados do trabalho (ciclos, chamados, contas) passa pela camada
// services/db.js, com histórico. "Ciente, lembrar depois" é só uma preferência
// de exibição e vai direto para municipios/{id}/alertasAdiados.

import {
  collection, deleteDoc as fbDeleteDoc, doc, getDoc, serverTimestamp, setDoc as fbSetDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { addDoc, updateDoc } from './db';
import { docDoMunicipio } from './consulta';
import { somarDias } from '../importacao/normalizar';

const pad = (n) => String(n).padStart(2, '0');
export const hojeYmd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Registra que o serviço do ciclo foi feito hoje e calcula a próxima execução. */
export async function registrarExecucaoDoCiclo(ciclo) {
  const hoje = hojeYmd();
  const proxima = somarDias(hoje, Number(ciclo.periodicidadeDias) || 0);
  await updateDoc(doc(db, 'ciclos', ciclo.id), {
    ultimaExecucao: hoje,
    proximaExecucao: proxima,
    atualizadoEm: serverTimestamp(),
  });
  return proxima;
}

/** Mesmo que acima, buscando o ciclo pelo identificador (usado ao concluir o chamado do ciclo). */
export async function registrarExecucaoDoCicloPorId(cicloId) {
  const snap = await getDoc(doc(db, 'ciclos', cicloId));
  if (!snap.exists()) return null;
  return { tipo: snap.data().tipo, proxima: await registrarExecucaoDoCiclo({ id: cicloId, ...snap.data() }) };
}

/** Abre um chamado de manutenção para resolver um ciclo vencido. Devolve o id do chamado. */
export async function abrirChamadoDoCiclo(ciclo, nomeDeQuemAbriu) {
  const venceu = ciclo.proximaExecucao ? ciclo.proximaExecucao.split('-').reverse().join('/') : '';
  const ref = await addDoc(collection(db, 'manutencoes'), {
    escolaId: ciclo.escolaId,
    escolaNome: ciclo.escolaNome,
    descricao: `${ciclo.tipo}${venceu ? ` (ciclo preventivo vencido em ${venceu})` : ''}`,
    localDentroEscola: '',
    prioridade: 'Média',
    status: 'Pendente',
    responsavel: 'A definir',
    responsavelId: null,
    prazo: '',
    observacoes: 'Aberto a partir do controle de ciclos. Ao concluir este chamado, o ciclo é atualizado sozinho.',
    cicloId: ciclo.id,
    solicitadaPor: auth.currentUser?.uid || null,
    solicitadaPorNome: nomeDeQuemAbriu || 'Administração',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function marcarContaComoEnviada(conta) {
  await updateDoc(doc(db, 'contas', conta.id), { status: 'Enviada', atualizadoEm: serverTimestamp() });
}

/** "Ciente, lembrar depois": o alerta some do quadro até a data (volta a cobrar nesse dia). */
export async function adiarAlerta(chave, dias) {
  const ate = somarDias(hojeYmd(), dias);
  await fbSetDoc(docDoMunicipio('alertasAdiados', chave), {
    ate,
    porUid: auth.currentUser?.uid || null,
    porEmail: auth.currentUser?.email || null,
    em: serverTimestamp(),
  });
  return ate;
}

export async function voltarACobrar(chave) {
  await fbDeleteDoc(docDoMunicipio('alertasAdiados', chave));
}
