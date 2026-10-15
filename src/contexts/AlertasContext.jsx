import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ouvir } from '../services/leitura';
import { doMunicipio, docDoMunicipio, colecaoDoMunicipio } from '../services/consulta';
import { useAuth } from '../hooks/useAuth';
import { calcularAlertas, contarPendencias } from '../utils/alertas';

// Alertas da administração, calculados uma vez e compartilhados pelo painel,
// pelo contador do menu e pelo título da aba. Fica montado enquanto a pessoa
// navega entre as telas, então as leituras não se repetem a cada troca de tela.
//
// Dentro de um município (administração, ou sede que escolheu um), tudo é
// lido só daquele município. A sede sem município escolhido lê todos, para a
// Visão da sede; nesse caso não há painel de alertas.

const AlertasContext = createContext({ alertas: [], pendencias: 0, manutencoes: [], contas: [], ciclos: [], carregando: true });

const VAZIO = { manutencoes: null, contas: null, ciclos: null, funcionarios: null, rubricas: null, gastos: null, periodoDoSaldo: null, escolas: null, municipios: null, contratos: null, adiados: {} };

export function AlertasProvider({ children }) {
  const { userProfile, ehSede, municipioAtivo } = useAuth();
  const ativo = userProfile?.perfil === 'admin' || ehSede;
  const todos = ehSede && !municipioAtivo; // sede vendo todos os municípios
  const [dados, setDados] = useState(VAZIO);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) { setDados(VAZIO); return undefined; }
    const lista = (chave) => (s) => setDados((d) => ({ ...d, [chave]: s.docs.map((x) => ({ id: x.id, ...x.data() })) }));
    const parar = [
      ouvir(doMunicipio('manutencoes'), lista('manutencoes')),
      ouvir(doMunicipio('contas'), lista('contas')),
      ouvir(doMunicipio('ciclos'), lista('ciclos')),
      // Funcionários não seguram o carregamento: só somam os alertas de ASO.
      ouvir(doMunicipio('funcionarios'), lista('funcionarios')),
      // Visão da sede: escolas e contratos (alertas de vigência).
      ouvir(doMunicipio('escolas'), lista('escolas')),
      ouvir(doMunicipio('contratos'), lista('contratos')),
    ];
    if (todos) {
      parar.push(ouvir(collection(db, 'municipios'), lista('municipios')));
      setDados((d) => ({ ...d, rubricas: [], gastos: [], periodoDoSaldo: null, adiados: {} }));
    } else {
      parar.push(
        ouvir(doc(db, 'municipios', municipioAtivo || '-'), (s) => setDados((d) => ({ ...d, municipios: s.exists() ? [{ id: s.id, ...s.data() }] : [] })),
          () => setDados((d) => ({ ...d, municipios: [] }))),
        // Controle de saldo: também não segura o carregamento.
        ouvir(doMunicipio('rubricas'), lista('rubricas')),
        ouvir(doMunicipio('gastos'), lista('gastos')),
        ouvir(docDoMunicipio('config', 'saldo'), (s) => setDados((d) => ({ ...d, periodoDoSaldo: s.exists() ? s.data() : null }))),
        ouvir(colecaoDoMunicipio('alertasAdiados'), (s) => {
          const mapa = {};
          s.docs.forEach((x) => { mapa[x.id] = x.data(); });
          setDados((d) => ({ ...d, adiados: mapa }));
        }),
      );
    }
    return () => parar.forEach((p) => p());
  }, [ativo, todos, municipioAtivo]);

  // Recalcula de tempos em tempos: "vence hoje" vira "venceu" depois da meia-noite.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 10 * 60 * 1000);
    return () => clearInterval(relogio);
  }, []);

  const valor = useMemo(() => {
    const carregando = !dados.manutencoes || !dados.contas || !dados.ciclos;
    // Vendo todos os municípios, a sede não tem painel de alertas (cada
    // município tem o seu); o semáforo da Visão da sede faz esse papel.
    const alertas = carregando || todos ? [] : calcularAlertas({
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
  }, [dados, agora, todos]);

  return <AlertasContext.Provider value={valor}>{children}</AlertasContext.Provider>;
}

export const useAlertas = () => useContext(AlertasContext);
