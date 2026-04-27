import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatarDataHora } from '../../utils/formatters';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones
import { 
  Plus, Search, MapPin, User, Users, Phone, Mail, 
  Droplets, FileText, Edit2, Trash2, Hash, CheckCircle2, XCircle
} from 'lucide-react';

const initialFormState = {
  nome: '',
  codigo: '',
  situacao: 'Ativa',
  endereco: '',
  bairro: '',
  cep: '',
  telefone: '',
  email: '',
  nomeDiretora: '',
  celularDiretora: '',
  emailDiretora: '',
  numeroAlunos: '',
  capacidadeCaixaDagua: '',
  observacoes: ''
};

export default function Escolas() {
  // Estados de Dados
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtro e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState('Todas');

  // Estados de Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Estados de Formulário e Seleção
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedEscola, setSelectedEscola] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado de Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Buscar escolas em tempo real
  useEffect(() => {
    const q = collection(db, 'escolas');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const escolasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por nome em ordem alfabética
      escolasData.sort((a, b) => a.nome.localeCompare(b.nome));
      setEscolas(escolasData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar escolas:", error);
      showToast("Erro ao carregar lista de escolas.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtragem
  const filteredEscolas = useMemo(() => {
    return escolas.filter(escola => {
      const term = searchTerm.toLowerCase();
      const matchSearch = (
        (escola.nome || '').toLowerCase().includes(term) ||
        (escola.bairro || '').toLowerCase().includes(term) ||
        (escola.nomeDiretora || '').toLowerCase().includes(term)
      );

      const matchStatus = 
        filterSituacao === 'Todas' ? true :
        filterSituacao === 'Ativas' ? escola.situacao === 'Ativa' :
        escola.situacao === 'Inativa';

      return matchSearch && matchStatus;
    });
  }, [escolas, searchTerm, filterSituacao]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Handlers do Formulário
  const handleOpenForm = (escola = null) => {
    if (escola) {
      setFormData({
        ...initialFormState,
        ...escola,
        numeroAlunos: escola.numeroAlunos || '',
        capacidadeCaixaDagua: escola.capacidadeCaixaDagua || ''
      });
      setSelectedEscola(escola);
    } else {
      setFormData(initialFormState);
      setSelectedEscola(null);
    }
    setFormErrors({});
    setIsDetailsModalOpen(false); // Fecha detalhes se vier de lá
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedEscola(null);
  };

  const applyMask = (name, value) => {
    if (name === 'cep') {
      return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    }
    if (name === 'telefone') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 10) {
        return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
      }
      return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
    return value;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData(prev => ({ ...prev, [name]: maskedValue }));
    // Limpa o erro do campo ao digitar
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório';
    if (!formData.endereco.trim()) errors.endereco = 'Endereço é obrigatório';
    if (!formData.bairro.trim()) errors.bairro = 'Bairro é obrigatório';
    if (!formData.nomeDiretora.trim()) errors.nomeDiretora = 'Nome da diretora é obrigatório';
    
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
        numeroAlunos: formData.numeroAlunos ? Number(formData.numeroAlunos) : 0,
        capacidadeCaixaDagua: formData.capacidadeCaixaDagua ? Number(formData.capacidadeCaixaDagua) : 0,
      };

      if (selectedEscola) {
        // Editar
        const docRef = doc(db, 'escolas', selectedEscola.id);
        await updateDoc(docRef, {
          ...dataToSave,
          atualizadoEm: serverTimestamp()
        });
        showToast('Escola atualizada com sucesso!');
      } else {
        // Criar
        await addDoc(collection(db, 'escolas'), {
          ...dataToSave,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });
        showToast('Escola cadastrada com sucesso!');
      }
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar escola:", error);
      showToast('Erro ao salvar os dados da escola.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers de Detalhes e Exclusão
  const handleOpenDetails = (escola) => {
    setSelectedEscola(escola);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setSelectedEscola(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedEscola) return;
    
    try {
      await deleteDoc(doc(db, 'escolas', selectedEscola.id));
      showToast('Escola excluída.', 'error');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir escola:", error);
      showToast('Erro ao excluir a escola.', 'error');
    }
  };

  // Renderização
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escolas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {escolas.length} {escolas.length === 1 ? 'escola cadastrada' : 'escolas cadastradas'}
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} />
          Nova Escola
        </button>
      </div>

      {/* Busca e Filtro */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, bairro ou diretora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={filterSituacao}
            onChange={(e) => setFilterSituacao(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none appearance-none bg-white"
          >
            <option value="Todas">Todas as situações</option>
            <option value="Ativas">Apenas Ativas</option>
            <option value="Inativas">Apenas Inativas</option>
          </select>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredEscolas.length === 0 ? (
        <EmptyState 
          message={searchTerm ? "Nenhuma escola encontrada para a busca." : "Nenhuma escola cadastrada. Clique em 'Nova Escola' para começar."}
          actionLabel={!searchTerm ? "Nova Escola" : null}
          onAction={!searchTerm ? () => handleOpenForm() : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEscolas.map((escola) => (
            <div
              key={escola.id}
              onClick={() => handleOpenDetails(escola)}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-light transition-all cursor-pointer relative group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="pr-16">
                  <h3 className="font-bold text-gray-900 text-lg line-clamp-1 group-hover:text-primary transition-colors">
                    {escola.nome}
                  </h3>
                  <div className="flex items-center text-xs text-gray-500 mt-1 font-medium">
                    <Hash size={12} className="mr-1" />
                    {escola.codigo || 'Sem código'}
                  </div>
                </div>
                <div className="absolute top-5 right-5">
                  <Badge 
                    label={escola.situacao} 
                    color={escola.situacao === 'Ativa' ? 'green' : 'gray'} 
                  />
                </div>
              </div>

              <div className="space-y-2 mt-2 flex-1">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span className="truncate">{escola.bairro}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span className="truncate">{escola.nomeDiretora}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span>{escola.numeroAlunos ? `${escola.numeroAlunos} alunos` : 'Não informado'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Formulário (Criar/Editar) */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={handleCloseForm} 
        title={selectedEscola ? `Editar escola — ${selectedEscola.nome}` : "Nova Escola"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sessão: Identificação */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Escola *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-primary focus:border-primary outline-none ${formErrors.nome ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ex: EMEB Prof. João Silva"
                />
                {formErrors.nome && <p className="text-red-500 text-xs mt-1">{formErrors.nome}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código da Unidade</label>
                <input
                  type="text"
                  name="codigo"
                  value={formData.codigo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: EMEB-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
                <select
                  name="situacao"
                  value={formData.situacao}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  <option value="Ativa">Ativa</option>
                  <option value="Inativa">Inativa</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sessão: Localização */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Localização</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo *</label>
                <input
                  type="text"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-primary focus:border-primary outline-none ${formErrors.endereco ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ex: Rua das Flores, 123"
                />
                {formErrors.endereco && <p className="text-red-500 text-xs mt-1">{formErrors.endereco}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-primary focus:border-primary outline-none ${formErrors.bairro ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ex: Jd. Amanda I"
                />
                {formErrors.bairro && <p className="text-red-500 text-xs mt-1">{formErrors.bairro}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: 13180-000"
                />
              </div>
            </div>
          </div>

          {/* Sessão: Contato da Unidade */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Contato da Unidade</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Fixo</label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: (19) 3800-0000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Institucional</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: escola@hortolandia.sp.gov.br"
                />
              </div>
            </div>
          </div>

          {/* Sessão: Diretora Responsável */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Diretora Responsável</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="nomeDiretora"
                  value={formData.nomeDiretora}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-primary focus:border-primary outline-none ${formErrors.nomeDiretora ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ex: Maria das Graças"
                />
                {formErrors.nomeDiretora && <p className="text-red-500 text-xs mt-1">{formErrors.nomeDiretora}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular (WhatsApp)</label>
                <input
                  type="text"
                  name="celularDiretora"
                  value={formData.celularDiretora}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: (19) 99999-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Pessoal/Profissional</label>
                <input
                  type="email"
                  name="emailDiretora"
                  value={formData.emailDiretora}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: diretora@email.com"
                />
              </div>
            </div>
          </div>

          {/* Sessão: Informações Adicionais */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Informações Adicionais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Alunos</label>
                <input
                  type="number"
                  name="numeroAlunos"
                  value={formData.numeroAlunos}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: 450"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidade Caixa D'água (Litros)</label>
                <input
                  type="number"
                  name="capacidadeCaixaDagua"
                  value={formData.capacidadeCaixaDagua}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: 5000"
                  min="0"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none resize-none"
                  placeholder="Informações relevantes sobre a estrutura ou unidade..."
                ></textarea>
              </div>
            </div>
          </div>

          {/* Footer do Modal */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={handleCloseForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-dark focus:outline-none flex items-center justify-center min-w-[120px]"
            >
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar Escola'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Detalhes */}
      {selectedEscola && !isFormModalOpen && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetails}
          title="Detalhes da Escola"
          size="lg"
        >
          <div className="space-y-6">
            {/* Header Detalhes */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedEscola.nome}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Hash size={14} /> {selectedEscola.codigo || 'S/N'}</span>
                  <Badge label={selectedEscola.situacao} color={selectedEscola.situacao === 'Ativa' ? 'green' : 'gray'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna 1 */}
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Localização</h4>
                  <ul className="space-y-2 text-sm text-gray-800">
                    <li className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-400 mt-0.5" /> 
                      <span>{selectedEscola.endereco} <br/> <span className="text-gray-500">{selectedEscola.bairro} - CEP: {selectedEscola.cep || 'N/I'}</span></span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contato da Unidade</h4>
                  <ul className="space-y-2 text-sm text-gray-800">
                    <li className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" /> 
                      {selectedEscola.telefone || <span className="text-gray-400 italic">Não informado</span>}
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" /> 
                      {selectedEscola.email || <span className="text-gray-400 italic">Não informado</span>}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estrutura</h4>
                  <ul className="space-y-2 text-sm text-gray-800">
                    <li className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" /> 
                      <strong>{selectedEscola.numeroAlunos || 0}</strong> alunos matriculados
                    </li>
                    <li className="flex items-center gap-2">
                      <Droplets size={16} className="text-gray-400" /> 
                      Caixa d'água: <strong>{selectedEscola.capacidadeCaixaDagua || 0}L</strong>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Coluna 2 */}
              <div className="space-y-5">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User size={14} /> Diretora Responsável
                  </h4>
                  <p className="font-semibold text-gray-900 mb-2">{selectedEscola.nomeDiretora}</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center gap-2">
                      <Phone size={14} className="text-blue-400" /> 
                      {selectedEscola.celularDiretora || <span className="text-gray-400 italic">Não informado</span>}
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail size={14} className="text-blue-400" /> 
                      {selectedEscola.emailDiretora || <span className="text-gray-400 italic">Não informado</span>}
                    </li>
                  </ul>
                </div>

                {selectedEscola.observacoes && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Observações</h4>
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedEscola.observacoes}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-400 pt-4">
                  Cadastrado em: {selectedEscola.criadoEm ? formatarDataHora(selectedEscola.criadoEm) : 'N/I'}
                </div>
              </div>
            </div>

            {/* Footer Detalhes */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-6">
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 size={16} /> Excluir
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCloseDetails}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Fechar
                </button>
                <button
                  onClick={() => handleOpenForm(selectedEscola)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
                >
                  <Edit2 size={16} /> Editar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Excluir escola"
        message={`Tem certeza que deseja excluir a unidade ${selectedEscola?.nome}? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />

      {/* Notificações Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}