import { db } from '../services/firebase';
import { collection, doc, getDocs, getDoc, query, where, serverTimestamp } from 'firebase/firestore';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../services/db';

export function useFirestore() {
  const getCollection = async (nomeColecao, filtros = []) => {
    try {
      let q = collection(db, nomeColecao);
      if (filtros.length > 0) {
        const condicoes = filtros.map(f => where(f.campo, f.operador, f.valor));
        q = query(q, ...condicoes);
      }
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Erro ao buscar coleção ${nomeColecao}:`, error);
      throw error;
    }
  };

  const getDocument = async (nomeColecao, id) => {
    try {
      const docRef = doc(db, nomeColecao, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error(`Erro ao buscar documento ${id} em ${nomeColecao}:`, error);
      throw error;
    }
  };

  const addDocument = async (nomeColecao, dados) => {
    try {
      const dadosComTimestamps = {
        ...dados,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, nomeColecao), dadosComTimestamps);
      return { id: docRef.id, ...dadosComTimestamps };
    } catch (error) {
      console.error(`Erro ao adicionar em ${nomeColecao}:`, error);
      throw error;
    }
  };

  const updateDocument = async (nomeColecao, id, dados) => {
    try {
      const docRef = doc(db, nomeColecao, id);
      const dadosComTimestamp = {
        ...dados,
        atualizadoEm: serverTimestamp()
      };
      await updateDoc(docRef, dadosComTimestamp);
      return true;
    } catch (error) {
      console.error(`Erro ao atualizar documento ${id} em ${nomeColecao}:`, error);
      throw error;
    }
  };

  const deleteDocument = async (nomeColecao, id) => {
    try {
      const docRef = doc(db, nomeColecao, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error(`Erro ao excluir documento ${id} em ${nomeColecao}:`, error);
      throw error;
    }
  };

  return { getCollection, getDocument, addDocument, updateDocument, deleteDocument };
}