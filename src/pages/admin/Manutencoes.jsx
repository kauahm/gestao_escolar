import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatarDataHora, formatarData } from '../../utils/formatters';
import { diasEmAberto } from '../../utils/calcularStatus';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { Plus, Search, Eye, Edit2, Trash2, AlertTriangle, X, Filter } from 'lucide-react';

const initialFormState = {
  escolaId: '',
  escolaNome: '',
  descricao: '',
  localDentroEscola: '',
  prioridade: 'Baixa',
  responsavel: 'A definir',
  status: 'Pendente',
  prazo: '',
  observacoes: ''
};

export default function AdminManutencoes() {
  const { currentUser, userProfile } = useAuth();
  
  // Estados
  const [manutencoes, setManutencoes] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterPrioridade, setFilterPrioridade] = useState('Todas');

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Formulário
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedManutencao, setSelectedManutencao] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Buscar escolas (para o select e filtro)
  useEffect(() => {
    const q = collection(db, 'escolas');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const escolasData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.situacao === 'Ativa')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setEscolas(escolasData);
    });
    return () => unsubscribe();
  }, []);

  // Buscar manutenções
  useEffect(() => {
    const q = collection(db, 'manutencoes');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const manutencoesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar localmente por data de criação desc (mais recentes primeiro)
      manutencoesData.sort((a, b) => {
        const timeA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
        const timeB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
        return timeB - timeA;
      });
      setManutencoes(manutencoesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar manutenções:", error);
      showToast("Erro ao carregar lista de manutenções.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Filtros em memória
  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter(m => {
      const matchSearch = m.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEscola = filterEscola === 'Todas' ? true : m.escolaId === filterEscola;
      const matchResponsavel = filterResponsavel === 'Todos' ? true : m.responsavel === filterResponsavel;
      const matchStatus = filterStatus === 'Todos' ? true : m.status === filterStatus;
      const matchPrioridade = filterPrioridade === 'Todas' ? true : m.prioridade === filterPrioridade;
      
      return matchSearch && matchEscola && matchResponsavel && matchStatus && matchPrioridade;
    });
  }, [manutencoes, searchTerm, filterEscola, filterResponsavel, filterStatus, filterPrioridade]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterEscola('Todas');
    setFilterResponsavel('Todos');
    setFilterStatus('Todos');
    setFilterPrioridade('Todas');
  };

  // Handlers
  const handleOpenForm = (manutencao = null) => {
    if (manutencao) {
      setFormData({
        ...initialFormState,
        ...manutencao,
        prazo: manutencao.prazo || ''
      });
      setSelectedManutencao(manutencao);
    } else {
      setFormData(initialFormState);
      setSelectedManutencao(null);
    }
    setFormErrors({});
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedManutencao(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'escolaId') {
      const escolaSelecionada = escolas.find(e => e.id === value);
      setFormData(prev => ({
        ...prev,
        escolaId: value,
        escolaNome: escolaSelecionada ? escolaSelecionada.nome : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.escolaId) errors.escolaId = 'Selecione uma escola';
    if (!formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória';
    if (!formData.localDentroEscola.trim()) errors.localDentroEscola = 'Local é obrigatório';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const isConcluidoNow = formData.status === 'Concluído' && (!selectedManutencao || selectedManutencao.status !== 'Concluído');
      const dataToSave = {
        ...formData,
        atualizadoEm: serverTimestamp(),
      };

      if (isConcluidoNow) {
        dataToSave.concluidoEm = serverTimestamp();
      } else if (formData.status !== 'Concluído') {
        dataToSave.concluidoEm = null; // Remove se foi reaberta
      }

      if (selectedManutencao) {
        await updateDoc(doc(db, 'manutencoes', selectedManutencao.id), dataToSave);
        showToast('Manutenção atualizada com sucesso!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        dataToSave.solicitadaPor = currentUser.uid;
        dataToSave.solicitadaPorNome = userProfile?.nome || 'Admin';
        await addDoc(collection(db, 'manutencoes'), dataToSave);
        showToast('Manutenção cadastrada com sucesso!');
      }
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar manutenção.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedManutencao) return;
    try {
      await deleteDoc(doc(db, 'manutencoes', selectedManutencao.id));
      showToast('Manutenção excluída.', 'error');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
    } catch (error) {
      showToast('Erro ao excluir manutenção.', 'error');
    }
  };

  // Utilitários Visuais
  const getBadgeColorPriority = (prioridade) => {
    if (prioridade === 'Alta') return 'red';
    if (prioridade === 'Média') return 'yellow';
    return 'green';
  };

  const getBadgeColorStatus = (status) => {
    if (status === 'Concluído') return 'green';
    if (status === 'Em andamento') return 'blue';
    return 'gray';
  };

  return (
    <div className="w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutenções</h1>
          <p className="text-gray-500 text-sm mt-1">
            {manutencoes.length} {manutencoes.length === 1 ? 'registro' : 'registros no total'}
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} />
          Nova Manutenção
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <button 
            onClick={clearFilters}
            className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <X size={16} /> Limpar filtros
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <select value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Unidades</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Responsáveis</option>
            <option value="Vitor">Vitor</option>
            <option value="Eduardo">Eduardo</option>
            <option value="A definir">A definir</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
          <select value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : filteredManutencoes.length === 0 ? (
        <EmptyState 
          message="Nenhuma manutenção encontrada." 
          actionLabel="Nova Manutenção" 
          onAction={() => handleOpenForm()} 
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade / Local</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade / Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredManutencoes.map((item) => {
                const diasAberto = diasEmAberto(item.criadoEm);
                const isAtrasado = item.status === 'Pendente' && diasAberto > 5;
                
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isAtrasado ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.escolaNome}</div>
                      <div className="text-sm text-gray-500">{item.localDentroEscola}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={item.descricao}>{item.descricao}</div>
                      {isAtrasado && (
                        <div className="flex items-center text-xs text-yellow-600 mt-1">
                          <AlertTriangle size={12} className="mr-1" /> Há {diasAberto} dias aberta
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      <div><Badge label={item.prioridade} color={getBadgeColorPriority(item.prioridade)} /></div>
                      <div><Badge label={item.status} color={getBadgeColorStatus(item.status)} /></div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.responsavel}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.criadoEm ? formatarData(item.criadoEm) : 'N/I'}
                      {item.prazo && <div className="text-xs mt-1">Prazo: {formatarData(item.prazo + 'T00:00:00')}</div>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setSelectedManutencao(item); setIsDetailsModalOpen(true); }} className="text-blue-600 hover:text-blue-900 p-1" title="Ver Detalhes"><Eye size={18} /></button>
                        <button onClick={() => handleOpenForm(item)} className="text-gray-600 hover:text-gray-900 p-1" title="Editar"><Edit2 size={18} /></button>
                        <button onClick={() => { setSelectedManutencao(item); setIsConfirmDeleteOpen(true); }} className="text-red-600 hover:text-red-900 p-1" title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Formulário */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedManutencao ? "Editar Manutenção" : "Nova Manutenção"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Escolar *</label>
            <select name="escolaId" value={formData.escolaId} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none ${formErrors.escolaId ? 'border-red-500' : 'border-gray-300'}`}>
              <option value="">Selecione uma escola</option>
              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {formErrors.escolaId && <p className="text-red-500 text-xs mt-1">{formErrors.escolaId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local dentro da escola *</label>
            <input type="text" name="localDentroEscola" value={formData.localDentroEscola} onChange={handleInputChange} placeholder="Ex: Banheiro feminino, Quadra..." className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.localDentroEscola ? 'border-red-500' : 'border-gray-300'}`} />
            {formErrors.localDentroEscola && <p className="text-red-500 text-xs mt-1">{formErrors.localDentroEscola}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do problema *</label>
            <textarea name="descricao" value={formData.descricao} onChange={handleInputChange} rows="3" placeholder="Detalhe o que precisa ser consertado..." className={`w-full px-3 py-2 border rounded-md outline-none resize-none focus:border-primary ${formErrors.descricao ? 'border-red-500' : 'border-gray-300'}`}></textarea>
            {formErrors.descricao && <p className="text-red-500 text-xs mt-1">{formErrors.descricao}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade *</label>
              <select name="prioridade" value={formData.prioridade} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <select name="responsavel" value={formData.responsavel} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="A definir">A definir</option>
                <option value="Vitor">Vitor</option>
                <option value="Eduardo">Eduardo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de conclusão</label>
              <input type="date" name="prazo" value={formData.prazo} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
            <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none resize-none focus:border-primary"></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark w-32 flex justify-center">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalhes */}
      {selectedManutencao && !isFormModalOpen && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes da Manutenção" size="md">
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedManutencao.escolaNome}</h3>
              <p className="text-sm text-gray-600 flex items-center gap-2">📍 {selectedManutencao.localDentroEscola}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-gray-500 uppercase">Status</span>
                <Badge label={selectedManutencao.status} color={getBadgeColorStatus(selectedManutencao.status)} />
                {selectedManutencao.status !== 'Concluído' && (
                  <p className="text-xs text-gray-500 mt-1">Em aberto há {diasEmAberto(selectedManutencao.criadoEm)} dias</p>
                )}
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">Prioridade</span>
                <Badge label={selectedManutencao.prioridade} color={getBadgeColorPriority(selectedManutencao.prioridade)} />
              </div>
            </div>

            <div>
              <span className="block text-xs text-gray-500 uppercase mb-1">Descrição do Problema</span>
              <p className="text-sm text-gray-800 bg-white border p-3 rounded-md">{selectedManutencao.descricao}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-gray-500 uppercase">Responsável</span>
                <p className="text-sm font-medium">{selectedManutencao.responsavel}</p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">Solicitado por</span>
                <p className="text-sm">{selectedManutencao.solicitadaPorNome || 'Sistema'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-gray-500 uppercase">Data da Solicitação</span>
                <p className="text-sm">{selectedManutencao.criadoEm ? formatarDataHora(selectedManutencao.criadoEm) : 'N/I'}</p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">Prazo / Conclusão</span>
                <p className="text-sm">
                  {selectedManutencao.status === 'Concluído' && selectedManutencao.concluidoEm 
                    ? `Concluído em: ${formatarData(selectedManutencao.concluidoEm)}` 
                    : (selectedManutencao.prazo ? formatarData(selectedManutencao.prazo + 'T00:00:00') : 'Sem prazo definido')}
                </p>
              </div>
            </div>

            {selectedManutencao.observacoes && (
              <div>
                <span className="block text-xs text-gray-500 uppercase mb-1">Observações Internas</span>
                <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-md border border-yellow-100">{selectedManutencao.observacoes}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setIsConfirmDeleteOpen(true)} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">Excluir</button>
              <button onClick={() => handleOpenForm(selectedManutencao)} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark flex items-center gap-2"><Edit2 size={16} /> Editar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Exclusão */}
      <ConfirmDialog isOpen={isConfirmDeleteOpen} title="Excluir manutenção" message="Tem certeza que deseja excluir esta solicitação de manutenção? Esta ação não pode ser desfeita." onConfirm={handleConfirmDelete} onCancel={() => setIsConfirmDeleteOpen(false)} />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}