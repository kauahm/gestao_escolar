import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, 
  serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatarMoeda } from '../../utils/formatters';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { 
  Plus, Search, Eye, Edit2, Trash2, CheckCircle, 
  X, AlertTriangle, FileText, Filter, Receipt
} from 'lucide-react';

const initialFormState = {
  escolaId: '',
  escolaNome: '',
  tipo: 'CPFL',
  tipoCustomizado: '',
  competencia: '',
  valor: '',
  vencimento: '',
  numeroDocumento: '',
  status: 'A enviar',
  observacoes: ''
};

export default function Contas() {
  // Estados de dados
  const [contas, setContas] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterCompetencia, setFilterCompetencia] = useState('Todas');

  // Modais e Form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedConta, setSelectedConta] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // 1. Buscar Escolas
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

  // 2. Buscar Contas e aplicar lógica de Vencimento Automático
  useEffect(() => {
    const q = collection(db, 'contas');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const contasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Lógica automática: verificar vencidas
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const contasParaAtualizar = contasData.filter(c => {
        if (c.status !== 'A enviar' || !c.vencimento) return false;
        const [ano, mes, dia] = c.vencimento.split('-');
        const vDate = new Date(ano, mes - 1, dia);
        return vDate < hoje;
      });

      // Batch update para as contas que venceram
      if (contasParaAtualizar.length > 0) {
        const batch = writeBatch(db);
        contasParaAtualizar.forEach(c => {
          const ref = doc(db, 'contas', c.id);
          batch.update(ref, { status: 'Vencida', atualizadoEm: serverTimestamp() });
        });
        await batch.commit();
        // A atualização chamará onSnapshot novamente, então retornamos cedo
        return; 
      }

      // Ordenar por vencimento (mais urgente primeiro)
      contasData.sort((a, b) => {
        if (!a.vencimento) return 1;
        if (!b.vencimento) return -1;
        return new Date(a.vencimento) - new Date(b.vencimento);
      });

      setContas(contasData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar contas:", error);
      showToast("Erro ao carregar lista de contas.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Listas Dinâmicas para Filtros
  const competenciasDisponiveis = useMemo(() => {
    const unicas = [...new Set(contas.map(c => c.competencia).filter(Boolean))];
    return unicas.sort(); // Ordenação simples alfabética (pode ser ajustada para data real se necessário)
  }, [contas]);

  // Filtragem
  const filteredContas = useMemo(() => {
    return contas.filter(c => {
      const matchSearch = (
        (c.numeroDocumento || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.observacoes || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchEscola = filterEscola === 'Todas' ? true : c.escolaId === filterEscola;
      const matchTipo = filterTipo === 'Todos' ? true : c.tipo === filterTipo;
      const matchStatus = filterStatus === 'Todos' ? true : c.status === filterStatus;
      const matchCompetencia = filterCompetencia === 'Todas' ? true : c.competencia === filterCompetencia;
      
      return matchSearch && matchEscola && matchTipo && matchStatus && matchCompetencia;
    });
  }, [contas, searchTerm, filterEscola, filterTipo, filterStatus, filterCompetencia]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterEscola('Todas');
    setFilterTipo('Todos');
    setFilterStatus('Todos');
    setFilterCompetencia('Todas');
  };

  // Cálculos de Totais
  const totalAEnviar = contas
    .filter(c => c.status === 'A enviar')
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

  const totalFiltrado = filteredContas
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  
  const contasFiltradasAEnviar = filteredContas.filter(c => c.status === 'A enviar');

  // Helpers de Data
  const formatDataString = (dateStr) => {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getDiasParaVencer = (dateStr) => {
    if (!dateStr) return 999;
    const [ano, mes, dia] = dateStr.split('-');
    const vDate = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.ceil((vDate - hoje) / (1000 * 60 * 60 * 24));
  };

  // Handlers do Formulário
  const handleOpenForm = (conta = null) => {
    if (conta) {
      setFormData({
        ...initialFormState,
        ...conta,
      });
      setSelectedConta(conta);
    } else {
      setFormData(initialFormState);
      setSelectedConta(null);
    }
    setFormErrors({});
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedConta(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'escolaId') {
      const escola = escolas.find(es => es.id === value);
      setFormData(prev => ({
        ...prev,
        escolaId: value,
        escolaNome: escola ? escola.nome : ''
      }));
    } else if (name === 'tipo') {
      setFormData(prev => ({
        ...prev,
        tipo: value,
        tipoCustomizado: value !== 'Outro' ? '' : prev.tipoCustomizado
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.escolaId) errors.escolaId = 'Selecione uma escola';
    if (!formData.competencia.trim()) errors.competencia = 'Competência é obrigatória';
    if (!formData.valor || Number(formData.valor) <= 0) errors.valor = 'Valor inválido';
    if (!formData.vencimento) errors.vencimento = 'Vencimento é obrigatório';
    if (formData.tipo === 'Outro' && !formData.tipoCustomizado.trim()) {
      errors.tipoCustomizado = 'Especifique o tipo';
    }
    
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
        valor: Number(formData.valor),
        atualizadoEm: serverTimestamp()
      };

      if (selectedConta) {
        await updateDoc(doc(db, 'contas', selectedConta.id), dataToSave);
        showToast('Conta atualizada com sucesso!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'contas'), dataToSave);
        showToast('Conta registrada com sucesso!');
      }
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      showToast('Erro ao salvar os dados da conta.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers de Ações
  const handleConfirmSend = async () => {
    if (!selectedConta) return;
    try {
      await updateDoc(doc(db, 'contas', selectedConta.id), {
        status: 'Enviada',
        atualizadoEm: serverTimestamp()
      });
      showToast('Conta marcada como enviada!');
      setIsConfirmSendOpen(false);
      setIsDetailsModalOpen(false);
    } catch (error) {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedConta) return;
    try {
      await deleteDoc(doc(db, 'contas', selectedConta.id));
      showToast('Conta excluída com sucesso.', 'error');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
    } catch (error) {
      showToast('Erro ao excluir conta.', 'error');
    }
  };

  // Utilitários Visuais
  const getStatusBadge = (status) => {
    if (status === 'A enviar') return 'yellow';
    if (status === 'Enviada') return 'green';
    return 'red'; // Vencida
  };

  const getRowStyle = (conta) => {
    if (conta.status === 'Enviada') return 'bg-gray-50';
    if (conta.status === 'A enviar') {
      const dias = getDiasParaVencer(conta.vencimento);
      if (dias <= 3 && dias >= 0) return 'bg-red-50';
    }
    return 'bg-white';
  };

  return (
    <div className="w-full">
      {/* Header & Totalizador Global */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <AlertTriangle size={12} /> Total a enviar: {formatarMoeda(totalAEnviar)}
            </span>
          </div>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} /> Registrar Conta
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por Nº do documento ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary outline-none"
            />
          </div>
          <button 
            onClick={clearFilters}
            className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors whitespace-nowrap"
          >
            <X size={16} /> Limpar filtros
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <select value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Unidades</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Tipos</option>
            <option value="CPFL">CPFL</option>
            <option value="SABESP">SABESP</option>
            <option value="Taxa de Limpeza">Taxa de Limpeza</option>
            <option value="Nota Fiscal de Serviço">Nota Fiscal de Serviço</option>
            <option value="Outro">Outro</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Status</option>
            <option value="A enviar">A enviar</option>
            <option value="Enviada">Enviada</option>
            <option value="Vencida">Vencida</option>
          </select>
          <select value={filterCompetencia} onChange={(e) => setFilterCompetencia(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Competências</option>
            {competenciasDisponiveis.map(comp => <option key={comp} value={comp}>{comp}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela de Contas */}
      {loading ? (
        <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : filteredContas.length === 0 ? (
        <EmptyState 
          message="Nenhuma conta encontrada." 
          actionLabel="Registrar Conta" 
          onAction={() => handleOpenForm()} 
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo / Competência</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Doc</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredContas.map((item) => {
                  const labelTipo = item.tipo === 'Outro' ? item.tipoCustomizado : item.tipo;
                  return (
                    <tr key={item.id} className={`hover:bg-opacity-80 transition-colors ${getRowStyle(item)}`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 max-w-[150px] truncate" title={item.escolaNome}>
                          {item.escolaNome}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 truncate max-w-[150px]" title={labelTipo}>{labelTipo}</div>
                        <div className="text-xs text-gray-500">{item.competencia}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.numeroDocumento || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {formatDataString(item.vencimento)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatarMoeda(item.valor)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge label={item.status} color={getStatusBadge(item.status)} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === 'A enviar' && (
                            <button 
                              onClick={() => { setSelectedConta(item); setIsConfirmSendOpen(true); }} 
                              className="text-green-600 hover:bg-green-100 p-1.5 rounded-full transition-colors" 
                              title="Marcar como Enviada"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button onClick={() => { setSelectedConta(item); setIsDetailsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Ver Detalhes">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => handleOpenForm(item)} className="text-gray-600 hover:bg-gray-100 p-1.5 rounded-md transition-colors" title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => { setSelectedConta(item); setIsConfirmDeleteOpen(true); }} className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Excluir">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Rodapé Tabela */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center text-sm">
            <span className="text-gray-600">
              Listando <strong>{filteredContas.length}</strong> contas
            </span>
            <div className="flex gap-4 mt-2 sm:mt-0">
              <span className="text-gray-600">
                {contasFiltradasAEnviar.length} a enviar
              </span>
              <span className="font-bold text-gray-900">
                Total na lista: {formatarMoeda(totalFiltrado)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Form de Registro/Edição */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedConta ? "Editar Conta" : "Registrar Conta"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Escolar *</label>
            <select name="escolaId" value={formData.escolaId} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none ${formErrors.escolaId ? 'border-red-500' : 'border-gray-300'}`}>
              <option value="">Selecione a escola vinculada</option>
              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {formErrors.escolaId && <p className="text-red-500 text-xs mt-1">{formErrors.escolaId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Despesa *</label>
              <select name="tipo" value={formData.tipo} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                <option value="CPFL">CPFL</option>
                <option value="SABESP">SABESP</option>
                <option value="Taxa de Limpeza">Taxa de Limpeza</option>
                <option value="Nota Fiscal de Serviço">Nota Fiscal de Serviço</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            {formData.tipo === 'Outro' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Especifique o tipo *</label>
                <input type="text" name="tipoCustomizado" value={formData.tipoCustomizado} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.tipoCustomizado ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex: Internet" />
                {formErrors.tipoCustomizado && <p className="text-red-500 text-xs mt-1">{formErrors.tipoCustomizado}</p>}
              </div>
            )}
            <div className={formData.tipo === 'Outro' ? "col-span-2" : "col-span-2 sm:col-span-1"}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Competência *</label>
              <input type="text" name="competencia" value={formData.competencia} onChange={handleInputChange} placeholder="Ex: Abril/2025" className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.competencia ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.competencia && <p className="text-red-500 text-xs mt-1">{formErrors.competencia}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Documento (NF, Boleto)</label>
              <input type="text" name="numeroDocumento" value={formData.numeroDocumento} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" placeholder="Opcional" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                <option value="A enviar">A enviar</option>
                <option value="Enviada">Enviada</option>
                <option value="Vencida">Vencida</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" name="valor" value={formData.valor} onChange={handleInputChange} placeholder="0.00" className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.valor ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.valor && <p className="text-red-500 text-xs mt-1">{formErrors.valor}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento *</label>
              <input type="date" name="vencimento" value={formData.vencimento} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.vencimento ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.vencimento && <p className="text-red-500 text-xs mt-1">{formErrors.vencimento}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
            <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none resize-none focus:border-primary" placeholder="Detalhes, justificativas..."></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-md hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark w-32 flex justify-center transition-colors">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes */}
      {selectedConta && !isFormModalOpen && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes do Lançamento" size="md">
          <div className="space-y-5">
            {/* Header Conta */}
            <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedConta.escolaNome}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1"><Receipt size={14} /> {selectedConta.tipo === 'Outro' ? selectedConta.tipoCustomizado : selectedConta.tipo}</p>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold text-gray-900">{formatarMoeda(selectedConta.valor)}</span>
                <Badge label={selectedConta.status} color={getStatusBadge(selectedConta.status)} />
              </div>
            </div>

            {selectedConta.status === 'A enviar' && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> Esta conta ainda não foi enviada a SP.
                </div>
                <button
                  onClick={() => setIsConfirmSendOpen(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors w-full sm:w-auto justify-center"
                >
                  <CheckCircle size={16} /> Marcar como Enviada
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-4 gap-x-6 px-1">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase">Vencimento</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{formatDataString(selectedConta.vencimento)}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase">Competência</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedConta.competencia}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase">Nº do Documento</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedConta.numeroDocumento || 'Não informado'}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase">Dias para Vencer</span>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {selectedConta.status === 'Vencida' ? 'Já venceu' : getDiasParaVencer(selectedConta.vencimento) + ' dias'}
                </p>
              </div>
            </div>

            {selectedConta.observacoes && (
              <div className="px-1">
                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Observações</span>
                <div className="text-sm text-gray-700 bg-white border p-3 rounded-md min-h-[60px]">
                  {selectedConta.observacoes}
                </div>
              </div>
            )}

            {/* Ações Inferiores */}
            <div className="flex justify-between pt-4 border-t mt-6">
              <button onClick={() => setIsConfirmDeleteOpen(true)} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 transition-colors font-medium">
                <Trash2 size={16} /> Excluir Registro
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsDetailsModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50 transition-colors">Fechar</button>
                <button onClick={() => handleOpenForm(selectedConta)} className="px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary-dark transition-colors flex items-center gap-2">
                  <Edit2 size={16} /> Editar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmações e Notificações */}
      <ConfirmDialog 
        isOpen={isConfirmSendOpen} 
        title="Confirmar Envio" 
        message={`Confirma o envio da conta de ${formatarMoeda(selectedConta?.valor)} (${selectedConta?.escolaNome}) para o escritório de SP?`} 
        onConfirm={handleConfirmSend} 
        onCancel={() => setIsConfirmSendOpen(false)} 
      />

      <ConfirmDialog 
        isOpen={isConfirmDeleteOpen} 
        title="Excluir conta" 
        message="Tem certeza que deseja excluir este registro de conta? Esta ação não pode ser desfeita." 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setIsConfirmDeleteOpen(false)} 
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}