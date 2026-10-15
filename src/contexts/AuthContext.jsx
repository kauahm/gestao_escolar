import React, { createContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { definirMunicipioAtivo } from '../services/escopo';

export const AuthContext = createContext();

// A sede escolhe o município em que vai trabalhar; a escolha fica guardada
// neste navegador para não ter de escolher de novo a cada vez que entra.
const CHAVE_DA_ESCOLHA = 'gestaoEscolar.municipioDaSede';
const lerEscolha = () => {
  try { return localStorage.getItem(CHAVE_DA_ESCOLHA) || null; } catch { return null; }
};
const gravarEscolha = (id) => {
  try {
    if (id) localStorage.setItem(CHAVE_DA_ESCOLHA, id);
    else localStorage.removeItem(CHAVE_DA_ESCOLHA);
  } catch { /* navegador sem armazenamento: só não lembra */ }
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Código do erro ao ler o perfil (ex.: 'unavailable' sem internet). null = sem erro.
  const [erroDoPerfil, setErroDoPerfil] = useState(null);
  const [escolhaDaSede, setEscolhaDaSede] = useState(lerEscolha);
  const [municipio, setMunicipio] = useState(null); // { id, nome, uf } do município ativo

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setErroDoPerfil(null);
      if (user) {
        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profileData = docSnap.data();
            if (profileData.situacao === 'inativa') {
              await signOut(auth);
              setUserProfile(null);
              setCurrentUser(null);
              throw new Error('Usuário inativo. Contate o administrador.');
            }
            setUserProfile(profileData);
          } else {
            console.error("Perfil de usuário não encontrado no Firestore");
            setUserProfile(null);
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
          // Erros do Firebase têm código; o "usuário inativo" acima não tem.
          if (error?.code) setErroDoPerfil(error.code);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const ehSede = userProfile?.perfil === 'sede';
  // Município ativo: o do perfil; para a sede, o que ela escolheu (ou nenhum).
  const municipioAtivo = ehSede ? escolhaDaSede : (userProfile?.municipioId || null);
  // Definido aqui, durante a renderização, para as telas já lerem o município certo.
  definirMunicipioAtivo(municipioAtivo);

  // Nome do município ativo (para mostrar no topo). Município apagado ou
  // inacessível: a sede volta para "todos os municípios".
  useEffect(() => {
    let cancelado = false;
    if (!municipioAtivo || !currentUser) { setMunicipio(null); return undefined; }
    getDoc(doc(db, 'municipios', municipioAtivo))
      .then((s) => {
        if (cancelado) return;
        if (s.exists()) setMunicipio({ id: s.id, ...s.data() });
        else if (ehSede) { gravarEscolha(null); setEscolhaDaSede(null); }
        else setMunicipio({ id: municipioAtivo, nome: '' });
      })
      .catch(() => { if (!cancelado) setMunicipio({ id: municipioAtivo, nome: '' }); });
    return () => { cancelado = true; };
  }, [municipioAtivo, currentUser, ehSede]);

  /** Só a sede: entra num município (id) ou volta a ver todos (null). */
  const escolherMunicipio = useCallback((id) => {
    gravarEscolha(id);
    setEscolhaDaSede(id || null);
  }, []);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    currentUser,
    userProfile,
    login,
    logout,
    erroDoPerfil,
    loading,
    ehSede,
    municipioAtivo,
    municipio,
    escolherMunicipio,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
