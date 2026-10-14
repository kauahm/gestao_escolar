import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatarMoeda, formatarDataHora, dataPorExtenso, primeiroNome } from '../../utils/formatters';
import { situacaoConta } from '../../utils/calcularStatus';
import { calcularAlertas, GRAVIDADE } from '../../utils/alertas';

// Ícones e Componentes UI
import { 
  Wrench, RefreshCcw, Receipt, Plus, ArrowRight, MapPin, CheckCircle, AlertTriangle 
} from 'lucide-react';
import SolicitarManutencao from '../../components/shared/SolicitarManutencao';
import Toast from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';


export default function DiretoraDashboard() {
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [manutencoes, setManutencoes] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [contas, setContas] = useState([]);

  // Estados do Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!userProfile?.unidadeId) return;

    const unsubs = [];
    
    // Filtros específicos para a unidade da diretora
    const qManutencoes = query(collection(db, 'manutencoes'), where('escolaId', '==', userProfile.unidadeId));
    const qCiclos = query(collection(db, 'ciclos'), where('escolaId', '==', userProfile.unidadeId));
    const qContas = query(collection(db, 'contas'), where('escolaId', '==', userProfile.unidadeId));

    unsubs.push(ouvir(qManutencoes, snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(ouvir(qCiclos, snap => {
      setCiclos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(ouvir(qContas, snap => {
      setContas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }));

    return () => unsubs.forEach(unsub => unsub());
  }, [userProfile]);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Saudação
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const dataAtualFormatada = dataPorExtenso(new Date());

  // O que precisa de atenção na escola (mesmas regras do painel da administração).
  const alertasDaEscola = useMemo(
    () => calcularAlertas({ manutencoes, contas, ciclos }),
    [manutencoes, contas, ciclos],
  );

  // Métricas
  const metricas = useMemo(() => {
    const manutencoesAbertas = manutencoes.filter(m => m.status !== 'Concluído');
    const contasDaUnidade = contas.filter(c => situacaoConta(c).pendente);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ciclosCriticos = ciclos.filter(c => {
      if (!c.proximaExecucao) return false;
      const [ano, mes, dia] = c.proximaExecucao.split('-');
      const pDate = new Date(ano, mes - 1, dia);
      const diffDias = Math.ceil((pDate - hoje) / (1000 * 60 * 60 * 24));
      return diffDias <= 30; 
    });

    return {
      manutencoes: manutencoesAbertas,
      ciclos: ciclosCriticos,
      contas: contasDaUnidade
    };
  }, [manutencoes, contas, ciclos]);

  // Estruturas de Listagens
  const getUltimasManutencoes = () => {
    return [...manutencoes]
      .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
      .slice(0, 5);
  };

  const getContasOrdenadas = () => {
    return [...contas]
      .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))
      .slice(0, 5);
  };


  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg"></div>)}
        </div>
        <div className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
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
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getSaudacao()}, {primeiroNome(userProfile?.nome)}!</h1>
          <p className="text-gray-500 text-sm mt-1">{dataAtualFormatada}</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-100">
            <MapPin size={16} /> Escola: {userProfile?.unidadeNome || 'Não atribuída'}
          </div>
        </div>
        <button
          onClick={() => setIsFormModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-bold shadow-md w-full md:w-auto justify-center"
        >
          <Plus size={20} /> Solicitar Nova Manutenção
        </button>
      </div>

      {alertasDaEscola.length > 0 && (
        <section className="bg-white rounded-xl border border-amber-200 shadow-sm">
          <h2 className="p-4 border-b border-amber-100 font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" /> Precisa de atenção ({alertasDaEscola.length})
          </h2>
          <ul className="divide-y divide-gray-100">
            {alertasDaEscola.map((a) => (
              <li key={a.chave} className="p-3 sm:px-4 flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${a.gravidade === GRAVIDADE.CRITICO ? 'bg-red-500' : a.gravidade === GRAVIDADE.ATENCAO ? 'bg-amber-500' : 'bg-blue-500'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{a.titulo}</p>
                  <p className="text-xs text-gray-600">
                    {a.detalhe}
                    {a.tipo === 'chamado' && ' · a administração também está vendo este atraso'}
                  </p>
                </div>
                {a.tipo === 'chamado' && (
                  <Link to="/diretora/manutencoes" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Ver chamado</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-3"><Wrench size={24} /></div>
          <h3 className="text-3xl font-bold text-gray-900">{metricas.manutencoes.length}</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Manutenções em curso</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <div className="p-3 bg-orange-50 rounded-full text-orange-600 mb-3"><RefreshCcw size={24} /></div>
          <h3 className="text-3xl font-bold text-gray-900">{metricas.ciclos.length}</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Ciclos críticos</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <div className="p-3 bg-yellow-50 rounded-full text-yellow-600 mb-3"><Receipt size={24} /></div>
          <h3 className="text-3xl font-bold text-gray-900">{metricas.contas.length}</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Contas a enviar</p>
        </div>
      </div>

      {/* Grid de Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Minhas Solicitações Recentes */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Minhas Solicitações Recentes</h3>
            <Link to="/diretora/manutencoes" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">Ver todas <ArrowRight size={16} /></Link>
          </div>
          <div className="p-4 flex-1 space-y-4 overflow-y-auto">
            {getUltimasManutencoes().length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">Nenhuma manutenção solicitada ainda.</p>
            ) : getUltimasManutencoes().map(m => (
              <div key={m.id} className="border border-gray-100 p-3 rounded-lg flex flex-col gap-2 bg-gray-50/50">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900 text-sm truncate">{m.localDentroEscola}</span>
                  <Badge label={m.status} color={m.status === 'Concluído' ? 'green' : m.status === 'Em andamento' ? 'blue' : 'gray'} />
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{m.descricao}</p>
                <div className="flex justify-between items-center mt-1">
                  <Badge label={m.prioridade} color={m.prioridade === 'Alta' ? 'red' : m.prioridade === 'Média' ? 'yellow' : 'green'} />
                  <span className="text-xs text-gray-400">{m.criadoEm ? formatarDataHora(m.criadoEm) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          {/* Ciclos da Escola */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-800">Ciclos da Unidade (Críticos)</h3>
            </div>
            <div className="p-4">
              {metricas.ciclos.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">Todos os ciclos da sua escola estão em dia!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {metricas.ciclos.map(c => {
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    const [ano, mes, dia] = c.proximaExecucao.split('-');
                    const diff = Math.ceil((new Date(ano, mes-1, dia) - hoje) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={c.id} className="flex justify-between items-center p-3 border border-orange-100 bg-orange-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{c.tipo}</p>
                          <p className="text-xs text-orange-700 mt-0.5">{diff < 0 ? `Vencido há ${Math.abs(diff)} dias` : `Vence em ${diff} dias`}</p>
                        </div>
                        <Badge label={diff < 0 ? 'Vencido' : 'Vencendo'} color={diff < 0 ? 'red' : 'yellow'} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Contas da Escola */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex-1">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-800">Contas a Enviar (Próximas)</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b text-gray-500">
                  <tr>
                    <th className="p-3 font-medium">Despesa</th>
                    <th className="p-3 font-medium text-right">Valor / Venc.</th>
                  </tr>
                </thead>
                <tbody>
                  {getContasOrdenadas().length === 0 ? (
                    <tr><td colSpan="2" className="p-4 text-center text-gray-500 text-sm">Nenhuma conta pendente para a unidade.</td></tr>
                  ) : getContasOrdenadas().map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{c.tipo === 'Outro' ? c.tipoCustomizado : c.tipo}</p>
                        <Badge label={situacaoConta(c).rotulo} color={situacaoConta(c).cor} />
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
        </div>
      </div>

      <SolicitarManutencao isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onEnviado={showToast} />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}