// Leitura em tempo real com aviso de falha.
//
// As telas usam ouvir() no lugar do onSnapshot do Firebase (mesma forma de
// chamar). A diferença: se uma leitura falhar (sem permissão, erro do
// servidor) ou demorar demais (internet ruim), o aviso no topo da tela
// (components/shared/AvisoDeConexao) explica o que houve e oferece "Tentar de
// novo", em vez de a tela ficar carregando para sempre sem dizer nada.
//
// Cuidado importante: quando o servidor não responde, o Firebase entrega o que
// tiver na memória ("cache"), que pode ser uma lista VAZIA. Mostrar isso como
// "Nenhuma conta registrada" assustaria quem tem medo de perder dados. Por
// isso, resposta vazia que não veio do servidor não é repassada à tela: ela
// continua carregando e o aviso diz que nada foi apagado.

import { onSnapshot } from 'firebase/firestore';

/** Depois de quanto tempo sem resposta a leitura conta como "demorando". */
export const LIMITE_DE_DEMORA_MS = 15000;

const estado = { falha: null, demorando: false, semServidor: false };
const interessados = new Set();
const leituras = new Set();

const avisar = () => interessados.forEach((f) => f({ ...estado }));

const reavaliar = () => {
  const agora = Date.now();
  const lista = [...leituras];
  const demorando = lista.some((l) => !l.recebeu && agora - l.inicio >= LIMITE_DE_DEMORA_MS);
  const semServidor = lista.some((l) => l.semServidor);
  if (demorando !== estado.demorando || semServidor !== estado.semServidor) {
    estado.demorando = demorando;
    estado.semServidor = semServidor;
    avisar();
  }
};

/** Recebe as mudanças de estado das leituras. Devolve a função para parar. */
export const acompanharLeituras = (f) => {
  interessados.add(f);
  f({ ...estado });
  return () => interessados.delete(f);
};

const estaVazio = (snap) => (typeof snap.empty === 'boolean' ? snap.empty : !snap.exists());

/**
 * Igual ao onSnapshot(alvo, aoReceber, aoFalhar), com o aviso de falha/demora.
 * @returns {() => void} função para parar de ouvir
 */
export function ouvir(alvo, aoReceber, aoFalhar) {
  const leitura = { inicio: Date.now(), recebeu: false, semServidor: false };
  leituras.add(leitura);
  const relogio = setTimeout(reavaliar, LIMITE_DE_DEMORA_MS + 50);

  const parar = onSnapshot(
    alvo,
    { includeMetadataChanges: true }, // para saber quando os dados passam a vir do servidor
    (snap) => {
      const doServidor = !snap.metadata.fromCache;
      leitura.semServidor = !doServidor;
      if (!doServidor && estado.falha) estado.falha = null;
      // Vazio que não veio do servidor: não mostrar como "nada cadastrado".
      if (!doServidor && estaVazio(snap) && !leitura.recebeu) {
        reavaliar();
        return;
      }
      leitura.recebeu = true;
      reavaliar();
      aoReceber(snap);
    },
    (erro) => {
      leitura.recebeu = true;
      console.error('[leitura] falhou:', erro?.code || erro);
      estado.falha = { codigo: erro?.code || 'desconhecido' };
      reavaliar();
      avisar();
      if (aoFalhar) aoFalhar(erro);
    },
  );

  return () => {
    clearTimeout(relogio);
    leituras.delete(leitura);
    parar();
    reavaliar();
  };
}
