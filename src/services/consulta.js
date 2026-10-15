// Consultas já filtradas pelo município ativo (ver services/escopo.js).
//
// As regras do Firestore só deixam a administração ler uma coleção se a
// consulta pedir explicitamente "só do meu município". Por isso as telas usam
// doMunicipio('contas') no lugar de collection(db, 'contas').
//
// Sem município ativo (só a sede, vendo todos os municípios), a consulta não
// é filtrada.

import { collection, doc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { municipioAtivo } from './escopo';

/** query(collection(db, nome), where('municipioId', '==', ativo), ...restricoes) */
export const doMunicipio = (nome, ...restricoes) => {
  const id = municipioAtivo();
  return id
    ? query(collection(db, nome), where('municipioId', '==', id), ...restricoes)
    : query(collection(db, nome), ...restricoes);
};

/** Documento guardado dentro do município ativo: municipios/{id}/<caminho>. */
export const docDoMunicipio = (...caminho) => doc(db, 'municipios', municipioAtivo() || '-', ...caminho);

/** Coleção guardada dentro do município ativo: municipios/{id}/<caminho>. */
export const colecaoDoMunicipio = (...caminho) => collection(db, 'municipios', municipioAtivo() || '-', ...caminho);
