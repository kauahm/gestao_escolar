import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { 
  Plus, Search, RefreshCcw, CheckCircle2, AlertTriangle, 
  Trash2, Edit2, Clock, Filter, CalendarCheck, Calendar, X
} from 'lucide-react';

const CICLOS_PADRAO = {
  "Limpeza de caixa d'água": 180,
  "Inspeção de DR e DS": 365,
  "Troca/recarga de extintores": 365,
  "Troca de filtros de água": 90
};

const initialFormState = {
  escolaId: '',
  escolaNome: '',
  tipo: '',
  periodicidadeDias: '',
  ultimaExecucao: '',
  proximaExecucao: '',
  observacoes: ''
};

export default function Ciclos() {
  // Estados de dados
  const [ciclos, setCiclos] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros e Visualização
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [viewMode, setViewMode] = useState('unidade'); // 'unidade' ou 'tipo'

  // Estados de Modais e Formulário
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmExecucaoOpen, setIsConfirmExecucaoOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedCiclo, setSelectedCiclo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Buscar escolas
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

  // Buscar ciclos
  useEffect(() => {
    const q = collection(db, 'ciclos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ciclosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCiclos(ciclosData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar ciclos:", error);
      showToast("Erro ao carregar lista de ciclos.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Lógica de Datas e Status
  const calcularDiasRestantes = (dataStr) => {
    if (!dataStr) return 0;
    const [ano, mes, dia] = dataStr.split('-');
    const dataAlvo = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.ceil((dataAlvo - hoje) / (1000 * 60 * 60 * 24));
  };

  const calcularStatus = (diasRestantes) => {
    if (diasRestantes < 0) return 'Vencido';
    if (diasRestantes <= 30) return 'Vencendo em breve';
    return 'Em dia';
  };

  const calcularProximaExecucao = (ultimaExec, dias) => {
    if (!ultimaExec || !dias) return '';
    const [ano, mes, dia] = ultimaExec.split('-');
    const data = new Date(ano, mes - 1, dia);
    data.setDate(data.getDate() + Number(dias));
    return data.toISOString().split('T')[0];
  };

  const formatDataString = (dateStr) => {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Contadores globais
  const contadores = useMemo(() => {
    let vencidos = 0, vencendo = 0, emDia = 0;
    ciclos.forEach(c => {
      const dias = calcularDiasRestantes(c.proximaExecucao);
      const status = calcularStatus(dias);
      if (status === 'Vencido') vencidos++;
      else if (status === 'Vencendo em breve') vencendo++;
      else emDia++;
    });
    return { vencidos, vencendo, emDia };
  }, [ciclos]);

  // Filtragem e Agrupamento
  const groupedCiclos = useMemo(() => {
    const filtrados = ciclos.filter(c => {
      const dias = calcularDiasRestantes(c.proximaExecucao);
      const statusReal = calcularStatus(dias);
      
      const matchEscola = filterEscola === 'Todas' ? true : c.escolaId === filterEscola;
      const matchTipo = filterTipo === 'Todos' ? true : c.tipo === filterTipo;
      const matchStatus = filterStatus === 'Todos' ? true : statusReal === filterStatus;
      
      return matchEscola && matchTipo && matchStatus;
    });

    // Ordenação (vencidos primeiro, depois por data mais próxima)
    filtrados.sort((a, b) => {
      return calcularDiasRestantes(a.proximaExecucao) - calcularDiasRestantes(b.proximaExecucao);
    });

    // Agrupamento
    const grupos = {};
    filtrados.forEach(c => {
      const key = viewMode === 'unidade' ? c.escolaNome : c.tipo;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    });

    // Ordenar chaves dos grupos alfabeticamente
    return Object.keys(grupos).sort().reduce((acc, key) => {
      acc[key] = grupos[key];
      return acc;
    }, {});
  }, [ciclos, filterEscola, filterTipo, filterStatus, viewMode]);

  const clearFilters = () => {
    setFilterEscola('Todas');
    setFilterTipo('Todos');
    setFilterStatus('Todos');
  };

  // Handlers do Formulário
  const handleOpenForm = (ciclo = null) => {
    if (ciclo) {
      setFormData({
        ...initialFormState,
        ...ciclo
      });
      setSelectedCiclo(ciclo);
    } else {
      setFormData(initialFormState);
      setSelectedCiclo(null);
    }
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedCiclo(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'escolaId') {
      const escola = escolas.find(es => es.id === value);
      newFormData.escolaNome = escola ? escola.nome : '';
    }

    if (name === 'tipo') {
      const diasPadrao = CICLOS_PADRAO[value] || '';
      newFormData.periodicidadeDias = diasPadrao;
      newFormData.proximaExecucao = calcularProximaExecucao(newFormData.ultimaExecucao, diasPadrao);
    }

    if (name === 'ultimaExecucao' || name === 'periodicidadeDias') {
      newFormData.proximaExecucao = calcularProximaExecucao(
        name === 'ultimaExecucao' ? value : formData.ultimaExecucao, 
        name === 'periodicidadeDias' ? value : formData.periodicidadeDias
      );
    }

    setFormData(newFormData);
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.escolaId) errors.escolaId = 'Selecione uma escola';
    if (!formData.tipo) errors.tipo = 'Selecione o tipo de ciclo';
    if (!formData.ultimaExecucao) errors.ultimaExecucao = 'Informe a data da última execução';
    if (!formData.periodicidadeDias || Number(formData.periodicidadeDias) <= 0) errors.periodicidadeDias = 'Periodicidade inválida';
    
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
        periodicidadeDias: Number(formData.periodicidadeDias),
        atualizadoEm: serverTimestamp()
      };

      if (selectedCiclo) {
        await updateDoc(doc(db, 'ciclos', selectedCiclo.id), dataToSave);
        showToast('Ciclo atualizado com sucesso!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'ciclos'), dataToSave);
        showToast('Ciclo registrado com sucesso!');
      }
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar ciclo:", error);
      showToast('Erro ao salvar os dados do ciclo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler de Ação Rápida
  const handleConfirmExecucao = async () => {
    if (!selectedCiclo) return;
    try {
      const hojeStr = new Date().toISOString().split('T')[0];
      const proximaStr = calcularProximaExecucao(hojeStr, selectedCiclo.periodicidadeDias);

      await updateDoc(doc(db, 'ciclos', selectedCiclo.id), {
        ultimaExecucao: hojeStr,
        proximaExecucao: proximaStr,
        atualizadoEm: serverTimestamp()
      });
      showToast(`Execução registrada! Próximo serviço em ${formatDataString(proximaStr)}.`);
      setIsConfirmExecucaoOpen(false);
      setSelectedCiclo(null);
    } catch (error) {
      showToast('Erro ao registrar execução.', 'error');
    }
  };

  // Handler de Exclusão
  const handleConfirmDelete = async () => {
    if (!selectedCiclo) return;
    try {
      await deleteDoc(doc(db, 'ciclos', selectedCiclo.id));
      showToast('Registro movido para a lixeira. Dá para restaurar em Segurança dos dados.');
      setIsConfirmDeleteOpen(false);
      setSelectedCiclo(null);
    } catch (error) {
      showToast('Erro ao excluir registro.', 'error');
    }
  };

  // Utilitários Visuais
  const getBadgeColor = (status) => {
    if (status === 'Vencido') return 'red';
    if (status === 'Vencendo em breve') return 'yellow';
    return 'green';
  };

  const getRowStyle = (status) => {
    if (status === 'Vencido') return 'bg-red-50';
    if (status === 'Vencendo em breve') return 'bg-orange-50';
    return 'bg-white';
  };

  return (
    <div className="w-full">
      {/* Header & Resumo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Ciclos</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">
              <AlertTriangle size={14} /> {contadores.vencidos} vencidos
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
              <Clock size={14} /> {contadores.vencendo} vencendo em breve
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800">
              <CheckCircle2 size={14} /> {contadores.emDia} em dia
            </span>
          </div>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} /> Registrar Ciclo
        </button>
      </div>

      {/* Filtros e Toggle View */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <select value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
              <option value="Todas">Todas as Unidades</option>
              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
              <option value="Todos">Todos os Tipos</option>
              {Object.keys(CICLOS_PADRAO).map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
              <option value="Todos">Todos os Status</option>
              <option value="Em dia">Em dia</option>
              <option value="Vencendo em breve">Vencendo em breve</option>
              <option value="Vencido">Vencido</option>
            </select>
            <button onClick={clearFilters} className="p-2 text-gray-500 hover:text-gray-700 bg-gray-100 rounded-md" title="Limpar Filtros">
              <X size={20} />
            </button>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg w-full lg:w-auto justify-center">
            <button 
              onClick={() => setViewMode('unidade')} 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'unidade' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Agrupar por Unidade
            </button>
            <button 
              onClick={() => setViewMode('tipo')} 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'tipo' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Agrupar por Tipo
            </button>
          </div>
        </div>
      </div>

      {/* Listagem Agrupada */}
      {loading ? (
        <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : Object.keys(groupedCiclos).length === 0 ? (
        <EmptyState 
          message="Nenhum ciclo encontrado com os filtros atuais." 
          actionLabel="Registrar Ciclo" 
          onAction={() => handleOpenForm()} 
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCiclos).map(([groupName, items]) => (
            <div key={groupName} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  {viewMode === 'unidade' ? <CalendarCheck className="text-primary w-5 h-5"/> : <RefreshCcw className="text-primary w-5 h-5"/>}
                  {groupName} 
                  <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full ml-2">{items.length} itens</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{viewMode === 'unidade' ? 'Tipo' : 'Unidade'}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Execução</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Próxima Execução</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dias Restantes</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => {
                      const diasRestantes = calcularDiasRestantes(item.proximaExecucao);
                      const status = calcularStatus(diasRestantes);
                      
                      return (
                        <tr key={item.id} className={`transition-colors ${getRowStyle(status)}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {viewMode === 'unidade' ? item.tipo : item.escolaNome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDataString(item.ultimaExecucao)}
                            <div className="text-[10px] text-gray-400 mt-0.5">A cada {item.periodicidadeDias} dias</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {formatDataString(item.proximaExecucao)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge label={status} color={getBadgeColor(status)} />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                            {status === 'Em dia' && <span className="text-green-600">+{diasRestantes} dias</span>}
                            {status === 'Vencendo em breve' && <span className="text-orange-600">{diasRestantes === 0 ? 'Vence hoje' : `${diasRestantes} dias`}</span>}
                            {status === 'Vencido' && <span className="text-red-600">Vencido há {Math.abs(diasRestantes)} dias</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => { setSelectedCiclo(item); setIsConfirmExecucaoOpen(true); }} 
                                className="text-green-600 hover:bg-green-100 p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold mr-2 border border-transparent hover:border-green-200"
                                title="Marcar como executado hoje"
                              >
                                <Calendar size={14} /> Hoje
                              </button>
                              <button onClick={() => handleOpenForm(item)} className="text-gray-600 hover:bg-gray-200 p-1.5 rounded-md transition-colors" title="Editar">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => { setSelectedCiclo(item); setIsConfirmDeleteOpen(true); }} className="text-red-600 hover:bg-red-100 p-1.5 rounded-md transition-colors" title="Excluir">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Registrar/Editar Ciclo */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedCiclo ? "Editar Ciclo" : "Registrar Ciclo"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Escolar *</label>
            <select name="escolaId" value={formData.escolaId} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none bg-white ${formErrors.escolaId ? 'border-red-500' : 'border-gray-300'}`}>
              <option value="">Selecione a escola</option>
              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {formErrors.escolaId && <p className="text-red-500 text-xs mt-1">{formErrors.escolaId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço *</label>
            <select name="tipo" value={formData.tipo} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none bg-white ${formErrors.tipo ? 'border-red-500' : 'border-gray-300'}`}>
              <option value="">Selecione o tipo de ciclo</option>
              {Object.keys(CICLOS_PADRAO).map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            {formErrors.tipo && <p className="text-red-500 text-xs mt-1">{formErrors.tipo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Última Execução *</label>
              <input type="date" name="ultimaExecucao" value={formData.ultimaExecucao} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none ${formErrors.ultimaExecucao ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.ultimaExecucao && <p className="text-red-500 text-xs mt-1">{formErrors.ultimaExecucao}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Periodicidade <span className="text-gray-400 text-xs font-normal">(dias)</span> *
              </label>
              <input type="number" min="1" name="periodicidadeDias" value={formData.periodicidadeDias} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md focus:ring-primary outline-none ${formErrors.periodicidadeDias ? 'border-red-500' : 'border-gray-300'}`} />
              {formErrors.periodicidadeDias && <p className="text-red-500 text-xs mt-1">{formErrors.periodicidadeDias}</p>}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Cálculo Automático: Próxima Execução</label>
            <div className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <CalendarCheck size={20} />
              {formData.proximaExecucao ? formatDataString(formData.proximaExecucao) : '--/--/----'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
            <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary outline-none resize-none" placeholder="Detalhes técnicos, nome da empresa que executou..."></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-md hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark w-32 flex justify-center transition-colors">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar Ciclo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmações */}
      <ConfirmDialog 
        isOpen={isConfirmExecucaoOpen} 
        title="Registrar Nova Execução" 
        message={`Confirma que o serviço '${selectedCiclo?.tipo}' foi realizado HOJE na unidade ${selectedCiclo?.escolaNome}? A próxima data será recalculada automaticamente.`} 
        onConfirm={handleConfirmExecucao} 
        onCancel={() => setIsConfirmExecucaoOpen(false)} 
      />

      <ConfirmDialog 
        isOpen={isConfirmDeleteOpen} 
        title="Excluir ciclo" 
        message="Tem certeza que deseja excluir este registro de controle de ciclo? Ele sai da Agenda da unidade, mas fica na lixeira e pode ser restaurado." 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setIsConfirmDeleteOpen(false)} 
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}