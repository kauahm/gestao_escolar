import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, BellOff, Bell, ChevronDown, ChevronUp, Wrench, RefreshCcw, Receipt, ArrowRight, Stethoscope, Wallet,
} from 'lucide-react';

import { useAlertas } from '../../contexts/AlertasContext';
import { useAuth } from '../../hooks/useAuth';
import { GRAVIDADE, PRAZO_POR_PRIORIDADE } from '../../utils/alertas';
import {
  abrirChamadoDoCiclo, adiarAlerta, marcarContaComoEnviada, registrarExecucaoDoCiclo, voltarACobrar,
} from '../../services/acoesDosAlertas';
import ConfirmDialog from '../ui/ConfirmDialog';
import Toast from '../ui/Toast';

// Quadro "Precisa de atenção hoje" do painel da administração: cada alerta com
// a ação que resolve ali mesmo, e "Ciente, lembrar depois" para tirar da frente
// por alguns dias o que já está sendo cuidado.

const COR = {
  [GRAVIDADE.CRITICO]: { ponto: 'bg-red-500', rotulo: 'Crítico' },
  [GRAVIDADE.ATENCAO]: { ponto: 'bg-amber-500', rotulo: 'Atenção' },
  [GRAVIDADE.AVISO]: { ponto: 'bg-blue-500', rotulo: 'Aviso' },
};
const ICONE = { chamado: Wrench, ciclo: RefreshCcw, conta: Receipt, 'contas-vencidas': Receipt, aso: Stethoscope, saldo: Wallet };
const VISIVEIS = 8;
const dataBr = (ymd) => ymd.split('-').reverse().join('/');

const botao = 'text-xs font-medium px-2.5 py-1 rounded-md border whitespace-nowrap';
const botaoPrincipal = `${botao} bg-primary text-white border-primary hover:bg-primary-dark`;
const botaoSecundario = `${botao} bg-white text-gray-700 border-gray-300 hover:bg-gray-50`;

export default function PainelDeAlertas() {
  const { alertas, carregando } = useAlertas();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [verTodos, setVerTodos] = useState(false);
  const [querVerAdiados, setVerAdiados] = useState(false);
  const [menuAdiar, setMenuAdiar] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { titulo, mensagem, acao }
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const avisar = (message, type = 'success') => setToast({ show: true, message, type });

  if (carregando) return null;

  const ativos = alertas.filter((a) => !a.adiadoAte);
  const cobrando = ativos.filter((a) => a.gravidade <= GRAVIDADE.ATENCAO).length; // mesmo número do menu e da aba
  const avisos = ativos.length - cobrando;
  const adiados = alertas.filter((a) => a.adiadoAte);
  // Sem adiados (ex.: o último voltou a cobrar), volta sozinho para a lista normal.
  const verAdiados = querVerAdiados && adiados.length > 0;
  const lista = verAdiados ? adiados : ativos;
  const mostrados = verTodos ? lista : lista.slice(0, VISIVEIS);

  const executar = async (chave, acao, sucesso) => {
    setOcupado(chave);
    try {
      const r = await acao();
      if (sucesso) avisar(typeof sucesso === 'function' ? sucesso(r) : sucesso);
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível concluir a ação. Tente de novo.', 'error');
    } finally {
      setOcupado(null);
    }
  };

  const acoesDe = (a) => {
    const ocupadoAqui = ocupado === a.chave;
    if (a.tipo === 'chamado') {
      return [<Link key="abrir" to={a.link} className={botaoPrincipal}>Abrir chamado</Link>];
    }
    if (a.tipo === 'ciclo') {
      return [
        <button
          key="feito"
          type="button"
          disabled={ocupadoAqui}
          className={botaoPrincipal}
          onClick={() => setConfirmar({
            titulo: 'Registrar execução',
            mensagem: `Registrar que "${a.alvo.tipo}" foi feito hoje no ${a.escolaNome}? A próxima data é calculada sozinha.`,
            acao: () => executar(a.chave, () => registrarExecucaoDoCiclo(a.alvo), (proxima) => `Registrado. Próximo serviço em ${dataBr(proxima)}.`),
          })}
        >
          Já foi feito
        </button>,
        a.chamado ? (
          <Link key="ver" to={`/admin/manutencoes/${a.chamado.id}`} className={botaoSecundario}>Ver chamado</Link>
        ) : (
          <button
            key="chamado"
            type="button"
            disabled={ocupadoAqui}
            className={botaoSecundario}
            onClick={() => executar(a.chave, async () => {
              const id = await abrirChamadoDoCiclo(a.alvo, userProfile?.nome);
              navigate(`/admin/manutencoes/${id}`);
            })}
          >
            Abrir chamado
          </button>
        ),
      ];
    }
    if (a.tipo === 'conta') {
      return [
        <button
          key="enviada"
          type="button"
          disabled={ocupadoAqui}
          className={botaoPrincipal}
          onClick={() => executar(a.chave, () => marcarContaComoEnviada(a.alvo), 'Conta marcada como enviada.')}
        >
          Marcar como enviada
        </button>,
      ];
    }
    if (a.tipo === 'saldo') {
      return [<Link key="ver" to={a.link} className={botaoPrincipal}>Ver controle de saldo</Link>];
    }
    if (a.tipo === 'aso') {
      return [<Link key="ver" to={a.link} className={botaoPrincipal}>Ver funcionários</Link>];
    }
    return [<Link key="ver" to={a.link} className={botaoPrincipal}>Ver contas</Link>];
  };

  return (
    <section className={`rounded-xl border ${ativos.length ? 'bg-white border-gray-200' : 'bg-green-50 border-green-200'} shadow-sm`}>
      <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
        <h2 className={`font-bold flex items-center gap-2 ${ativos.length ? 'text-gray-900' : 'text-green-800'}`}>
          {ativos.length ? <AlertTriangle size={20} className="text-amber-500" /> : <CheckCircle size={20} />}
          {ativos.length ? `Precisa de atenção hoje (${cobrando})` : 'Tudo em dia!'}
          {avisos > 0 && <span className="text-sm font-normal text-gray-500">+ {avisos} {avisos === 1 ? 'aviso' : 'avisos'}</span>}
        </h2>
        {adiados.length > 0 && (
          <button type="button" onClick={() => { setVerAdiados(!verAdiados); setVerTodos(false); }} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5">
            {verAdiados ? <><Bell size={15} /> Voltar aos que cobram</> : <><BellOff size={15} /> {adiados.length} {adiados.length === 1 ? 'adiado' : 'adiados'}</>}
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="p-4 text-sm text-green-800">
          Nenhum chamado atrasado, ciclo vencido ou conta perto de vencer. Chamados pendentes passam a cobrar depois de{' '}
          {Object.entries(PRAZO_POR_PRIORIDADE).filter(([p]) => p !== 'Urgente').map(([p, d]) => `${d} dias (${p.toLowerCase()})`).join(', ')}.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {mostrados.map((a) => {
            const Icone = ICONE[a.tipo] || AlertTriangle;
            return (
              <li key={a.chave} className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span role="img" className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${COR[a.gravidade].ponto}`} title={COR[a.gravidade].rotulo} aria-label={COR[a.gravidade].rotulo} />
                  <Icone size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{a.titulo}</span>
                      {a.escolaNome && <span className="text-gray-600"> · {a.escolaNome}</span>}
                    </p>
                    <p className="text-xs text-gray-600">{a.detalhe}</p>
                    {a.adiadoAte && <p className="text-xs text-gray-500 mt-0.5">Adiado até {dataBr(a.adiadoAte)}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end pl-8 sm:pl-0 relative">
                  {a.adiadoAte ? (
                    <button type="button" className={botaoSecundario} onClick={() => executar(a.chave, () => voltarACobrar(a.chave), 'O alerta voltou a cobrar.')}>
                      Voltar a cobrar
                    </button>
                  ) : (
                    <>
                      {acoesDe(a)}
                      <button
                        type="button"
                        className={`${botaoSecundario} flex items-center gap-1`}
                        aria-expanded={menuAdiar === a.chave}
                        onClick={() => setMenuAdiar(menuAdiar === a.chave ? null : a.chave)}
                      >
                        <BellOff size={13} /> Ciente
                      </button>
                      {menuAdiar === a.chave && (
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-48">
                          <p className="px-2 py-1 text-xs text-gray-500">Lembrar de novo em:</p>
                          {[1, 3, 7].map((dias) => (
                            <button
                              key={dias}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100"
                              onClick={() => {
                                setMenuAdiar(null);
                                executar(a.chave, () => adiarAlerta(a.chave, dias), (ate) => `Certo. Este alerta volta em ${dataBr(ate)}.`);
                              }}
                            >
                              {dias === 1 ? 'amanhã' : `${dias} dias`}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lista.length > VISIVEIS && (
        <button type="button" onClick={() => setVerTodos(!verTodos)} className="w-full p-3 text-sm text-primary hover:bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1.5 rounded-b-xl">
          {verTodos ? <><ChevronUp size={16} /> Mostrar menos</> : <><ChevronDown size={16} /> Ver todos ({lista.length})</>}
        </button>
      )}
      {!verAdiados && ativos.length > 0 && (
        <p className="px-4 pb-3 pt-1 text-xs text-gray-500 flex items-center gap-1">
          <ArrowRight size={12} /> Os alertas aparecem quando alguém abre o sistema; avisos por e-mail ou celular dependem do plano pago do Firebase.
        </p>
      )}

      <ConfirmDialog
        isOpen={!!confirmar}
        title={confirmar?.titulo}
        message={confirmar?.mensagem}
        tom="normal"
        rotuloConfirmar="Registrar"
        onConfirm={() => { const c = confirmar; setConfirmar(null); c.acao(); }}
        onCancel={() => setConfirmar(null)}
      />
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </section>
  );
}
