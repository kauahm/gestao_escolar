import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatarMoeda, formatarDataHora } from '../../utils/formatters';

// Ícones e Componentes UI
import { 
  Wrench, RefreshCcw, Receipt, Plus, ArrowRight, MapPin, CheckCircle, AlertTriangle 
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const initialFormState = {
  descricao: '',
  localDentroEscola: '',
  prioridade: 'Média',
  observacoes: ''
};

export default function DiretoraDashboard() {
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [manutencoes, setManutencoes] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [contas, setContas] = useState([]);

  // Estados do Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!userProfile?.unidadeId) return;

    const unsubs = [];
    
    // Filtros específicos para a unidade da diretora
    const qManutencoes = query(collection(db, 'manutencoes'), where('escolaId', '==', userProfile.unidadeId));
    const qCiclos = query(collection(db, 'ciclos'), where('escolaId', '==', userProfile.unidadeId));
    const qContas = query(collection(db, 'contas'), where('escolaId', '==', userProfile.unidadeId));

    unsubs.push(onSnapshot(qManutencoes, snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(qCiclos, snap => {
      setCiclos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(qContas, snap => {
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

  const dataAtualFormatada = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  }).format(new Date());

  // Métricas
  const metricas = useMemo(() => {
    const manutencoesAbertas = manutencoes.filter(m => m.status !== 'Concluído');
    const contasDaUnidade = contas.filter(c => c.status === 'A enviar');
    
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

  // Handlers do Modal de Manutenção (Reaproveitado)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.descricao.trim()) errors.descricao = 'A descrição do problema é obrigatória';
    if (!formData.localDentroEscola.trim()) errors.localDentroEscola = 'Informe o local exato na escola';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        escolaId: userProfile.unidadeId,
        escolaNome: userProfile.unidadeNome,
        responsavel: 'A definir',
        status: 'Pendente',
        solicitadaPor: currentUser.uid,
        solicitadaPorNome: userProfile.nome,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      };

      await addDoc(collection(db, 'manutencoes'), dataToSave);
      showToast('Solicitação enviada com sucesso! Aguarde o retorno da administração.');
      setIsFormModalOpen(false);
      setFormData(initialFormState);
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      showToast('Erro ao enviar solicitação. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">{getSaudacao()}, {userProfile?.nome}!</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{dataAtualFormatada}</p>
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
                        <Badge label={c.status} color={c.status === 'A enviar' ? 'yellow' : 'green'} />
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

      {/* Modal: Nova Solicitação (Reaproveitado do Prompt 3) */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title="Nova Solicitação de Manutenção" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-md mb-4 border border-blue-100">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <MapPin size={16} /> Solicitando para: <strong>{userProfile?.unidadeNome}</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local exato na escola *</label>
            <input 
              type="text" 
              name="localDentroEscola" 
              value={formData.localDentroEscola} 
              onChange={handleInputChange} 
              placeholder="Ex: Casa de banho das crianças, Cozinha, Sala 4..." 
              className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.localDentroEscola ? 'border-red-500' : 'border-gray-300'}`} 
            />
            {formErrors.localDentroEscola && <p className="text-red-500 text-xs mt-1">{formErrors.localDentroEscola}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição detalhada do problema *</label>
            <textarea 
              name="descricao" 
              value={formData.descricao} 
              onChange={handleInputChange} 
              rows="4" 
              placeholder="Descreva o que se avariou, deixou de funcionar ou necessita de reparação..." 
              className={`w-full px-3 py-2 border rounded-md outline-none resize-none focus:border-primary ${formErrors.descricao ? 'border-red-500' : 'border-gray-300'}`}
            ></textarea>
            {formErrors.descricao && <p className="text-red-500 text-xs mt-1">{formErrors.descricao}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade sugerida *</label>
            <select 
              name="prioridade" 
              value={formData.prioridade} 
              onChange={handleInputChange} 
              className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary"
            >
              <option value="Baixa">Baixa - Pode aguardar</option>
              <option value="Média">Média - Necessita de atenção em breve</option>
              <option value="Alta">Alta - Urgente / Impede atividades</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações adicionais (Opcional)</label>
            <textarea 
              name="observacoes" 
              value={formData.observacoes} 
              onChange={handleInputChange} 
              rows="2" 
              placeholder="Horário preferencial de atendimento, aviso sobre alunos na sala..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none resize-none focus:border-primary"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark w-40 flex justify-center">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </Modal>

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}