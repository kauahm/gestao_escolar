import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, query } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAlertas } from '../../contexts/AlertasContext';
import PainelDeAlertas from '../../components/shared/PainelDeAlertas';
import { formatarMoeda, formatarDataHora, dataPorExtenso, primeiroNome } from '../../utils/formatters';
import { diasEmAberto, statusCiclo, situacaoConta, somarValores, diasAte, paraData, hojeZerado } from '../../utils/calcularStatus';

import { 
  Wrench, Receipt, RefreshCcw, Users, AlertTriangle, 
  ArrowRight, Clock, Calendar as CalendarIcon, CheckCircle, ShieldCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Chamados, contas e ciclos já são lidos uma vez para os alertas (contexts/AlertasContext).
  const { manutencoes, contas, ciclos, carregando: carregandoAlertas } = useAlertas();
  const [candidatos, setCandidatos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [backup, setBackup] = useState(undefined); // undefined = carregando

  useEffect(() => {
    // Escutar todas as coleções necessárias em tempo real
    const unsubs = [];

    unsubs.push(ouvir(collection(db, 'candidatos'), snap => {
      setCandidatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(ouvir(collection(db, 'eventos'), snap => {
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Para fins de loading, consideramos que o último snapshot marca o fim do carregamento inicial
      setLoading(false);
    }));

    // Data da última cópia de segurança (lembrete no topo do painel)
    unsubs.push(ouvir(doc(db, 'config', 'backup'),
      snap => setBackup(snap.exists() ? snap.data() : null),
      () => setBackup(null)));

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  // Saudação e Data
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const dataAtualFormatada = dataPorExtenso(new Date());

  // Métricas para os Cards
  const metricas = useMemo(() => {
    const manutencoesAbertas = manutencoes.filter(m => m.status === 'Pendente' || m.status === 'Em andamento');

    // Contas pendentes = tudo que ainda não foi enviado, tenha vencido ou não.
    // Antes o painel só somava status 'A enviar'; como as vencidas eram
    // reescritas como 'Vencida', ele mostrava zero com dezenas de contas em aberto.
    const contasPendentes = contas.filter(c => situacaoConta(c).pendente);
    const contasVencidas = contasPendentes.filter(c => situacaoConta(c).vencida);
    const contasNoPrazo = contasPendentes.filter(c => !situacaoConta(c).vencida);

    const hoje = hojeZerado();

    const ciclosCriticos = ciclos.filter(c => {
      if (!c.proximaExecucao) return false;
      const [ano, mes, dia] = c.proximaExecucao.split('-');
      const pDate = new Date(ano, mes - 1, dia);
      const diffDias = Math.ceil((pDate - hoje) / (1000 * 60 * 60 * 24));
      return diffDias <= 30; // Vencidos (< 0) ou Vencendo em breve (<= 30)
    });

    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const entrevistasMes = candidatos.filter(c => {
      if (!c.dataEntrevista) return false;
      const [ano, mes] = c.dataEntrevista.split('-');
      return Number(ano) === anoAtual && Number(mes) === mesAtual;
    });

    return {
      manutencoes: manutencoesAbertas,
      contas: contasPendentes,
      contasVencidas,
      contasNoPrazo,
      valorContas: somarValores(contasPendentes),
      valorVencido: somarValores(contasVencidas),
      ciclos: ciclosCriticos,
      entrevistas: entrevistasMes
    };
  }, [manutencoes, contas, ciclos, candidatos]);


  // Estruturas de Listagens
  const getUltimasManutencoes = () => {
    return [...metricas.manutencoes]
      .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
      .slice(0, 5);
  };

  const getProximosCiclos = () => {
    return [...metricas.ciclos]
      .sort((a, b) => new Date(a.proximaExecucao) - new Date(b.proximaExecucao))
      .slice(0, 5);
  };

  // Vencidas primeiro (mais atrasada no topo), depois as que vencem em até 7 dias.
  const getContasEmFoco = () => {
    const vencidas = [...metricas.contasVencidas]
      .sort((a, b) => (diasAte(a.vencimento) ?? 0) - (diasAte(b.vencimento) ?? 0));
    const daSemana = [...metricas.contasNoPrazo]
      .filter(c => { const d = diasAte(c.vencimento); return d !== null && d <= 7; })
      .sort((a, b) => (diasAte(a.vencimento) ?? 0) - (diasAte(b.vencimento) ?? 0));
    return [...vencidas, ...daSemana].slice(0, 5);
  };

  // Só o que ainda não aconteceu. Eventos de dia inteiro valem até o fim do dia.
  const getProximosEventos = () => {
    const hoje = hojeZerado();
    const agora = new Date();
    return [...eventos].filter(e => {
      const start = paraData(e.inicio);
      if (!start) return false;
      if (e.diaInteiro) {
        const dia = new Date(start);
        dia.setHours(0, 0, 0, 0);
        return dia >= hoje;
      }
      return start >= agora;
    }).sort((a, b) => {
      const startA = a.inicio?.toDate ? a.inicio.toDate() : new Date(a.inicio);
      const startB = b.inicio?.toDate ? b.inicio.toDate() : new Date(b.inicio);
      return startA - startB;
    }).slice(0, 5);
  };

  if (loading || carregandoAlertas) {
    return (
      <div className="w-full space-y-6">
        <div className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg"></div>)}
        </div>
        <div className="h-40 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 animate-pulse rounded-lg"></div>
          <div className="h-64 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getSaudacao()}, {primeiroNome(userProfile?.nome)}!</h1>
        <p className="text-gray-500 text-sm mt-1">{dataAtualFormatada}</p>
      </div>

      {/* Lembrete de cópia de segurança: aparece se nunca foi feita ou se tem mais de 7 dias */}
      {backup !== undefined && (() => {
        const dias = backup?.ultimoEm?.toDate ? Math.floor((Date.now() - backup.ultimoEm.toDate().getTime()) / 86400000) : null;
        if (dias !== null && dias <= 7) return null;
        return (
          <Link to="/admin/seguranca" className="flex items-center justify-between gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
            <span className="flex items-center gap-3 text-sm text-blue-900">
              <ShieldCheck size={20} className="shrink-0 text-primary" />
              {dias === null
                ? 'Você ainda não baixou nenhuma cópia de segurança dos dados.'
                : `Sua última cópia de segurança foi há ${dias} dias.`}
            </span>
            <span className="text-sm font-semibold text-primary whitespace-nowrap flex items-center gap-1">Baixar agora <ArrowRight size={16} /></span>
          </Link>
        );
      })()}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Wrench size={24} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Manutenções Abertas</p>
            <h3 className="text-2xl font-bold text-gray-900">{metricas.manutencoes.length}</h3>
            <p className="text-xs text-gray-400 mt-1">{metricas.manutencoes.filter(m => m.status === 'Em andamento').length} em andamento</p>
          </div>
        </div>
        
        <Link
          to="/admin/contas"
          className={`bg-white p-5 rounded-xl border shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow ${metricas.contasVencidas.length > 0 ? 'border-red-200' : 'border-gray-200'}`}
        >
          <div className={`p-3 rounded-lg ${metricas.contasVencidas.length > 0 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}><Receipt size={24} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Contas a Enviar</p>
            <h3 className="text-2xl font-bold text-gray-900">{metricas.contas.length}</h3>
            <p className="text-xs text-gray-400 mt-1">{formatarMoeda(metricas.valorContas)} pendentes</p>
            {metricas.contasVencidas.length > 0 && (
              <p className="text-xs font-semibold text-red-600 mt-1">
                {metricas.contasVencidas.length} {metricas.contasVencidas.length === 1 ? 'vencida' : 'vencidas'} · {formatarMoeda(metricas.valorVencido)}
              </p>
            )}
          </div>
        </Link>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600"><RefreshCcw size={24} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Ciclos Críticos</p>
            <h3 className="text-2xl font-bold text-gray-900">{metricas.ciclos.length}</h3>
            <p className="text-xs text-gray-400 mt-1">Vencidos ou vencendo</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600"><Users size={24} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Entrevistas este Mês</p>
            <h3 className="text-2xl font-bold text-gray-900">{metricas.entrevistas.length}</h3>
            <p className="text-xs text-gray-400 mt-1">Candidatos cadastrados</p>
          </div>
        </div>
      </div>

      {/* O que precisa de atenção hoje, com a ação de cada item */}
      <PainelDeAlertas />

      {/* Grid Principal de Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Manutenções */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Últimas Manutenções Abertas</h3>
            <Link to="/admin/manutencoes" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">Ver todas <ArrowRight size={16} /></Link>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-gray-500">
                <tr>
                  <th className="p-3 font-medium">Unidade / Local</th>
                  <th className="p-3 font-medium">Status / Há</th>
                </tr>
              </thead>
              <tbody>
                {getUltimasManutencoes().length === 0 ? (
                  <tr><td colSpan="2" className="p-4 text-center text-gray-500">Nenhuma manutenção pendente.</td></tr>
                ) : getUltimasManutencoes().map(m => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium text-gray-900">{m.escolaNome}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{m.descricao}</p>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${m.status === 'Pendente' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                        {m.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{diasEmAberto(m.criadoEm)} dias</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ciclos */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Próximos Ciclos a Vencer</h3>
            <Link to="/admin/ciclos" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">Ver todos <ArrowRight size={16} /></Link>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-gray-500">
                <tr>
                  <th className="p-3 font-medium">Ciclo / Unidade</th>
                  <th className="p-3 font-medium">Data / Status</th>
                </tr>
              </thead>
              <tbody>
                {getProximosCiclos().length === 0 ? (
                  <tr><td colSpan="2" className="p-4 text-center text-gray-500">Nenhum ciclo crítico.</td></tr>
                ) : getProximosCiclos().map(c => {
                  const hoje = new Date();
                  hoje.setHours(0,0,0,0);
                  const [ano, mes, dia] = c.proximaExecucao.split('-');
                  const diff = Math.ceil((new Date(ano, mes-1, dia) - hoje) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{c.tipo}</p>
                        <p className="text-xs text-gray-500">{c.escolaNome}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-gray-900">{c.proximaExecucao.split('-').reverse().join('/')}</p>
                        <p className={`text-xs font-medium mt-0.5 ${diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                          {diff < 0 ? `Vencido há ${Math.abs(diff)} dias` : `Vence em ${diff} dias`}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contas */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Contas vencidas e dos próximos 7 dias</h3>
            <Link to="/admin/contas" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">Ver todas <ArrowRight size={16} /></Link>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-gray-500">
                <tr>
                  <th className="p-3 font-medium">Unidade / Despesa</th>
                  <th className="p-3 font-medium text-right">Valor / Venc.</th>
                </tr>
              </thead>
              <tbody>
                {getContasEmFoco().length === 0 ? (
                  <tr><td colSpan="2" className="p-4 text-center text-gray-500">Nenhuma conta vencida ou vencendo nos próximos 7 dias.</td></tr>
                ) : getContasEmFoco().map(c => {
                  const s = situacaoConta(c);
                  return (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-gray-50 ${s.vencida ? 'bg-red-50/60' : ''}`}>
                      <td className="p-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{c.escolaNome}</p>
                        <p className="text-xs text-gray-500">{c.tipo === 'Outro' ? c.tipoCustomizado : c.tipo}</p>
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-bold text-gray-900">{formatarMoeda(c.valor)}</p>
                        <p className={`text-xs ${s.vencida ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {(c.vencimento || '').split('-').reverse().join('/')}
                          {s.vencida && ` · há ${s.diasDeAtraso} dias`}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mini Agenda */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Próximos Eventos</h3>
            <Link to="/admin/agenda" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">Ver agenda <ArrowRight size={16} /></Link>
          </div>
          <div className="p-4 flex-1 space-y-4">
            {getProximosEventos().length === 0 ? (
              <p className="text-center text-gray-500 mt-4 text-sm">Nenhum evento agendado.</p>
            ) : getProximosEventos().map(e => {
              const dataStart = e.inicio?.toDate ? e.inicio.toDate() : new Date(e.inicio);
              return (
                <div key={e.id} className="flex items-start gap-3">
                  <div className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.cor || '#185FA5' }}></div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{e.titulo}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <CalendarIcon size={12} /> {dataStart.toLocaleDateString('pt-BR')} 
                      {!e.diaInteiro && <span>às {dataStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}