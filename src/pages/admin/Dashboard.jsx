import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatarMoeda, formatarDataHora } from '../../utils/formatters';
import { diasEmAberto, statusCiclo } from '../../utils/calcularStatus';

import { 
  Wrench, Receipt, RefreshCcw, Users, AlertTriangle, 
  ArrowRight, Clock, Calendar as CalendarIcon, CheckCircle
} from 'lucide-react';

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [manutencoes, setManutencoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    // Escutar todas as coleções necessárias em tempo real
    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, 'manutencoes'), snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(collection(db, 'contas'), snap => {
      setContas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(collection(db, 'ciclos'), snap => {
      setCiclos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(collection(db, 'candidatos'), snap => {
      setCandidatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(collection(db, 'eventos'), snap => {
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Para fins de loading, consideramos que o último snapshot marca o fim do carregamento inicial
      setLoading(false);
    }));

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  // Saudação e Data
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const dataAtualFormatada = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  }).format(new Date());

  // Métricas para os Cards
  const metricas = useMemo(() => {
    const manutencoesAbertas = manutencoes.filter(m => m.status === 'Pendente' || m.status === 'Em andamento');
    const valorContasAEnviar = contas.filter(c => c.status === 'A enviar').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const contasAEnviar = contas.filter(c => c.status === 'A enviar');
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
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
      contas: contasAEnviar,
      valorContas: valorContasAEnviar,
      ciclos: ciclosCriticos,
      entrevistas: entrevistasMes
    };
  }, [manutencoes, contas, ciclos, candidatos]);

  // Alertas Críticos
  const alertas = useMemo(() => {
    const itens = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Manutenções pendentes há mais de 5 dias
    metricas.manutencoes.filter(m => m.status === 'Pendente' && diasEmAberto(m.criadoEm) > 5).forEach(m => {
      itens.push({ id: `man_${m.id}`, tipo: 'manutencao', texto: `Manutenção pendente há ${diasEmAberto(m.criadoEm)} dias: ${m.escolaNome} - ${m.descricao}`, link: '/admin/manutencoes' });
    });

    // Ciclos vencidos
    metricas.ciclos.forEach(c => {
      const [ano, mes, dia] = c.proximaExecucao.split('-');
      const pDate = new Date(ano, mes - 1, dia);
      if (pDate < hoje) {
        itens.push({ id: `cic_${c.id}`, tipo: 'ciclo', texto: `Ciclo vencido: ${c.tipo} na ${c.escolaNome}`, link: '/admin/ciclos' });
      }
    });

    // Contas com vencimento <= 3 dias
    metricas.contas.forEach(c => {
      const [ano, mes, dia] = c.vencimento.split('-');
      const vDate = new Date(ano, mes - 1, dia);
      const diff = Math.ceil((vDate - hoje) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 3) {
        itens.push({ id: `con_${c.id}`, tipo: 'conta', texto: `Conta a enviar vence em ${diff} dias: ${c.tipo} - ${c.escolaNome}`, link: '/admin/contas' });
      }
    });

    return itens;
  }, [metricas]);

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

  const getContasDaSemana = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return [...metricas.contas].filter(c => {
      const [ano, mes, dia] = c.vencimento.split('-');
      const diff = Math.ceil((new Date(ano, mes - 1, dia) - hoje) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).slice(0, 5);
  };

  const getProximosEventos = () => {
    const hoje = new Date();
    return [...eventos].filter(e => {
      const start = e.inicio?.toDate ? e.inicio.toDate() : new Date(e.inicio);
      return start >= hoje || e.diaInteiro;
    }).sort((a, b) => {
      const startA = a.inicio?.toDate ? a.inicio.toDate() : new Date(a.inicio);
      const startB = b.inicio?.toDate ? b.inicio.toDate() : new Date(b.inicio);
      return startA - startB;
    }).slice(0, 5);
  };

  if (loading) {
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
        <h1 className="text-2xl font-bold text-gray-900">{getSaudacao()}, {userProfile?.nome}!</h1>
        <p className="text-gray-500 text-sm mt-1 capitalize">{dataAtualFormatada}</p>
      </div>

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
        
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600"><Receipt size={24} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Contas a Enviar</p>
            <h3 className="text-2xl font-bold text-gray-900">{metricas.contas.length}</h3>
            <p className="text-xs text-gray-400 mt-1">{formatarMoeda(metricas.valorContas)} pendentes</p>
          </div>
        </div>

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
            <p className="text-xs text-gray-400 mt-1">Candidatos registados</p>
          </div>
        </div>
      </div>

      {/* Alertas Críticos */}
      <div className={`p-4 rounded-lg border ${alertas.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <h3 className={`font-bold flex items-center gap-2 mb-2 ${alertas.length > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
          {alertas.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          {alertas.length > 0 ? 'Atenção: Itens Críticos' : 'Tudo em dia!'}
        </h3>
        {alertas.length > 0 ? (
          <ul className="space-y-2">
            {alertas.map(alerta => (
              <li key={alerta.id} className="text-sm text-yellow-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                <span>{alerta.texto}</span>
                <Link to={alerta.link} className="text-yellow-800 font-medium hover:underline ml-1">Resolver &rarr;</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-green-700">Nenhum item crítico no momento no sistema.</p>
        )}
      </div>

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
            <h3 className="font-bold text-gray-800">Contas a Enviar (Próx. 7 dias)</h3>
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
                {getContasDaSemana().length === 0 ? (
                  <tr><td colSpan="2" className="p-4 text-center text-gray-500">Nenhuma conta para os próximos 7 dias.</td></tr>
                ) : getContasDaSemana().map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{c.escolaNome}</p>
                      <p className="text-xs text-gray-500">{c.tipo === 'Outro' ? c.tipoCustomizado : c.tipo}</p>
                    </td>
                    <td className="p-3 text-right">
                      <p className="font-bold text-gray-900">{formatarMoeda(c.valor)}</p>
                      <p className="text-xs text-gray-500">{c.vencimento.split('-').reverse().join('/')}</p>
                    </td>
                  </tr>
                ))}
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