import React, { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle, Clock, RotateCw } from 'lucide-react';
import { acompanharLeituras } from '../../services/leitura';

// Aviso no topo das telas quando os dados não chegam: sem internet, sem
// permissão, erro do servidor ou demora. Some sozinho quando tudo volta ao normal.

const mensagemDaFalha = (codigo) => {
  if (codigo === 'permission-denied') {
    return 'Sua conta não tem permissão para ver parte destes dados. Se você deveria ter acesso, fale com a administração.';
  }
  if (codigo === 'unavailable' || codigo === 'deadline-exceeded') {
    return 'O servidor não respondeu. Verifique a internet e tente de novo.';
  }
  return 'Não foi possível carregar os dados desta tela. Tente de novo em alguns instantes.';
};

export default function AvisoDeConexao() {
  const [leituras, setLeituras] = useState({ falha: null, demorando: false, semServidor: false });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => acompanharLeituras(setLeituras), []);

  // Ao abrir uma tela, às vezes o que está na memória chega um instante antes
  // da confirmação do servidor. Só avisa se a falta de servidor durar 3 s.
  const [semServidorHaTempo, setSemServidorHaTempo] = useState(false);
  useEffect(() => {
    if (!leituras.semServidor) { setSemServidorHaTempo(false); return undefined; }
    const relogio = setTimeout(() => setSemServidorHaTempo(true), 3000);
    return () => clearTimeout(relogio);
  }, [leituras.semServidor]);

  useEffect(() => {
    const ligar = () => setOnline(true);
    const desligar = () => setOnline(false);
    window.addEventListener('online', ligar);
    window.addEventListener('offline', desligar);
    return () => {
      window.removeEventListener('online', ligar);
      window.removeEventListener('offline', desligar);
    };
  }, []);

  let aviso = null;
  if (!online) {
    aviso = {
      Icone: WifiOff,
      cor: 'bg-gray-800 text-white border-gray-800',
      texto: 'Sem conexão com a internet. A tela mostra o que já estava carregado. O que você salvar agora só é confirmado quando a conexão voltar: não feche esta página até lá.',
      botao: false,
    };
  } else if (leituras.falha) {
    aviso = { Icone: AlertTriangle, cor: 'bg-red-50 text-red-800 border-red-200', texto: mensagemDaFalha(leituras.falha.codigo), botao: true };
  } else if (semServidorHaTempo) {
    aviso = {
      Icone: WifiOff,
      cor: 'bg-amber-50 text-amber-900 border-amber-200',
      texto: 'Sem conexão com o servidor. O que aparece pode estar desatualizado, e o que ainda não carregou aparece assim que a conexão voltar. Nada foi apagado.',
      botao: true,
    };
  } else if (leituras.demorando) {
    aviso = { Icone: Clock, cor: 'bg-amber-50 text-amber-900 border-amber-200', texto: 'Está demorando mais que o normal para carregar. Verifique a internet.', botao: true };
  }

  if (!aviso) return null;
  const { Icone } = aviso;

  return (
    <div role="alert" className={`mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3 text-sm ${aviso.cor}`}>
      <Icone size={20} className="shrink-0" />
      <p className="flex-1">{aviso.texto}</p>
      {aviso.botao && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-md bg-white/80 hover:bg-white border border-current/20 px-3 py-1.5 font-medium whitespace-nowrap"
        >
          <RotateCw size={15} /> Tentar de novo
        </button>
      )}
    </div>
  );
}
