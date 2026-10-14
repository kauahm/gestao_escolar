import { useEffect, useState } from 'react';
import { acompanharLeituras } from '../services/leitura';

/** Estado das leituras do banco ({ falha, demorando, semServidor }), atualizado em tempo real. */
export function useEstadoDasLeituras() {
  const [estado, setEstado] = useState({ falha: null, demorando: false, semServidor: false });
  useEffect(() => acompanharLeituras(setEstado), []);
  return estado;
}
