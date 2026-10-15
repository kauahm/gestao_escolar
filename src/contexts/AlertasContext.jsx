import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ouvir } from '../services/leitura';
import { useAuth } from '../hooks/useAuth';
import { calcularAlertas, contarPendencias } from '../utils/alertas';

// Alertas da administração, calculados uma vez e compartilhados pelo painel,
// pelo contador do menu e pelo título da aba. Fica montado enquanto a pessoa
// navega entre as telas, então as leituras não se repetem a cada troca de tela.

const AlertasContext = createContext({ alertas: [], pendencias: 0, manutencoes: [], contas: [], ciclos: [], carregando: true });

const VAZIO = { manutencoes: null, contas: null, ciclos: null, funcionarios: null, rubricas: null, gastos: null, periodoDoSaldo: null, escolas: null, municipios: null, contratos: null, adiados: {} };

export function AlertasProvider({ children }) {
  const { userProfile } = useAuth();
  const ativo = userProfile?.perfil === 'admin';
  const [dados, setDados] = useState(VAZIO);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) { setDados(VAZIO); return undefined; }
    const lista = (chave) => (s) => setDados((d) => ({ ...d, [chave]: s.docs.map((x) => ({ id: x.id, ...x.data() })) }));
    const parar = [
      ouvir(collection(db, 'manutencoes'), lista('manutencoes')),
      ouvir(collection(db, 'contas'), lista('contas')),
      ouvir(collection(db, 'ciclos'), lista('ciclos')),
      // Funcionários não seguram o carregamento: só somam os alertas de ASO.
      ouvir(collection(db, 'funcionarios'), lista('funcionarios')),
      // Controle de saldo: também não segura o carregamento.
      ouvir(collection(db, 'rubricas'), lista('rubricas')),
      // Visão da sede: escolas, municípios e contratos (alertas de vigência).
      ouvir(collection(db, 'escolas'), lista('escolas')),
      ouvir(collection(db, 'municipios'), lista('municipios')),
      ouvir(collection(db, 'contratos'), lista('contratos')),
      ouvir(collection(db, 'gastos'), lista('gastos')),
      ouvir(doc(db, 'config', 'saldo'), (s) => setDados((d) => ({ ...d, periodoDoSaldo: s.exists() ? s.data() : null }))),
      ouvir(collection(db, 'alertasAdiados'), (s) => {
        const mapa = {};
        s.docs.forEach((x) => { mapa[x.id] = x.data(); });
        setDados((d) => ({ ...d, adiados: mapa }));
      }),
    ];
    return () => parar.forEach((p) => p());
  }, [ativo]);

  // Recalcula de tempos em tempos: "vence hoje" vira "venceu" depois da meia-noite.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 10 * 60 * 1000);
    return () => clearInterval(relogio);
  }, []);

  const valor = useMemo(() => {
    const carregando = !dados.manutencoes || !dados.contas || !dados.ciclos;
    const alertas = carregando ? [] : calcularAlertas({
      manutencoes: dados.manutencoes, contas: dados.contas, ciclos: dados.ciclos, funcionarios: dados.funcionarios || [],
      saldo: dados.periodoDoSaldo ? { rubricas: dados.rubricas || [], gastos: dados.gastos || [], periodo: dados.periodoDoSaldo } : null,
      sede: { municipios: dados.municipios || [], contratos: dados.contratos || [], escolas: dados.escolas || [] },
      adiados: dados.adiados, hoje: agora,
    });
    return {
      carregando,
      alertas,
      pendencias: contarPendencias(alertas),
      manutencoes: dados.manutencoes || [],
      contas: dados.contas || [],
      ciclos: dados.ciclos || [],
      funcionarios: dados.funcionarios || [],
      escolas: dados.escolas || [],
      municipios: dados.municipios || [],
      contratos: dados.contratos || [],
      // A visão da sede espera estes chegarem antes de pintar o semáforo.
      carregandoSede: !dados.escolas || !dados.municipios || !dados.contratos || !dados.funcionarios,
    };
  }, [dados, agora]);

  return <AlertasContext.Provider value={valor}>{children}</AlertasContext.Provider>;
}

export const useAlertas = () => useContext(AlertasContext);
