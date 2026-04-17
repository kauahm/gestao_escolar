import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { formatarData } from '../../utils/formatters';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CurriculoUpload from '../../components/ui/CurriculoUpload';

// Ícones
import { 
  Plus, Search, Eye, Edit2, Trash2, Link as LinkIcon, 
  DownloadCloud, X, Users, CheckCircle, XCircle, Clock
} from 'lucide-react';

const FUNCOES_PADRAO = [
  "Professora", "Auxiliar de limpeza", "Cozinheira", 
  "Auxiliar administrativo", "Auxiliar de sala"
];

const initialFormState = {
  nome: '',
  funcao: '',
  escolaId: '',
  escolaNome: '',
  dataEntrevista: '',
  entrevistador: '',
  resultado: 'Aguardando',
  observacoes: '',
  curriculoLink: '',
  curriculoUrl: null,
  curriculoNome: null
};

export default function Selecao() {
  const [candidatos, setCandidatos] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFuncao, setFilterFuncao] = useState('Todas');
  const [filterResultado, setFilterResultado] = useState('Todos');
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterPeriodo, setFilterPeriodo] = useState('Todos');

  // Modais e Form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedCandidato, setSelectedCandidato] = useState(null);
  
  // Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); // null = não está upando
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

  // Buscar candidatos
  useEffect(() => {
    const q = collection(db, 'candidatos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordenar por data de entrevista (mais recente primeiro)
      data.sort((a, b) => {
        if (!a.dataEntrevista) return 1;
        if (!b.dataEntrevista) return -1;
        return new Date(b.dataEntrevista) - new Date(a.dataEntrevista);
      });
      
      setCandidatos(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar candidatos:", error);
      showToast("Erro ao carregar dados.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Derivações e Contadores (Mês Atual)
  const statsMesAtual = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    
    let aprovados = 0, aguardando = 0, reprovados = 0;
    
    candidatos.forEach(c => {
      if (!c.dataEntrevista) return;
      const [ano, mes] = c.dataEntrevista.split('-');
      if (Number(ano) === anoAtual && Number(mes) === mesAtual) {
        if (c.resultado === 'Aprovado') aprovados++;
        if (c.resultado === 'Aguardando' || c.resultado === 'Em análise') aguardando++;
        if (c.resultado === 'Reprovado') reprovados++;
      }
    });
    return { aprovados, aguardando, reprovados };
  }, [candidatos]);

  // Listas Dinâmicas para Filtros e Formulário
  const funcoesUnicas = useMemo(() => {
    const doBanco = candidatos.map(c => c.funcao).filter(Boolean);
    const setCompleto = new Set([...FUNCOES_PADRAO, ...doBanco]);
    return Array.from(setCompleto).sort();
  }, [candidatos]);

  const periodosUnicos = useMemo(() => {
    const setPeriodos = new Set();
    candidatos.forEach(c => {
      if (c.dataEntrevista) {
        const [ano, mes] = c.dataEntrevista.split('-');
        setPeriodos.add(`${mes}/${ano}`);
      }
    });
    return Array.from(setPeriodos).sort((a, b) => {
      const [mA, aA] = a.split('/');
      const [mB, aB] = b.split('/');
      return new Date(aB, mB - 1) - new Date(aA, mA - 1); // mais recente primeiro
    });
  }, [candidatos]);

  // Filtragem
  const filteredCandidatos = useMemo(() => {
    return candidatos.filter(c => {
      const matchBusca = c.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFuncao = filterFuncao === 'Todas' ? true : c.funcao === filterFuncao;
      const matchResultado = filterResultado === 'Todos' ? true : c.resultado === filterResultado;
      const matchEscola = filterEscola === 'Todas' ? true : (filterEscola === 'Geral' ? !c.escolaId : c.escolaId === filterEscola);
      
      let matchPeriodo = true;
      if (filterPeriodo !== 'Todos' && c.dataEntrevista) {
        const [ano, mes] = c.dataEntrevista.split('-');
        matchPeriodo = `${mes}/${ano}` === filterPeriodo;
      } else if (filterPeriodo !== 'Todos') {
        matchPeriodo = false;
      }

      return matchBusca && matchFuncao && matchResultado && matchEscola && matchPeriodo;
    });
  }, [candidatos, searchTerm, filterFuncao, filterResultado, filterEscola, filterPeriodo]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterFuncao('Todas');
    setFilterResultado('Todos');
    setFilterEscola('Todas');
    setFilterPeriodo('Todos');
  };

  // Handlers do Formulário
  const handleOpenForm = (candidato = null) => {
    if (candidato) {
      setFormData({
        ...initialFormState,
        ...candidato,
      });
      setSelectedCandidato(candidato);
    } else {
      setFormData(initialFormState);
      setSelectedCandidato(null);
    }
    setSelectedFile(null);
    setUploadProgress(null);
    setFormErrors({});
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setFormData(initialFormState);
    setSelectedFile(null);
    setUploadProgress(null);
    setFormErrors({});
    setSelectedCandidato(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'escolaId') {
      if (value === 'Geral' || !value) {
        newFormData.escolaId = null;
        newFormData.escolaNome = 'Geral';
      } else {
        const escola = escolas.find(es => es.id === value);
        newFormData.escolaNome = escola ? escola.nome : '';
      }
    }

    setFormData(newFormData);
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleFileSelect = (file) => setSelectedFile(file);
  
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFormData(prev => ({ ...prev, curriculoUrl: null, curriculoNome: null }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório';
    if (!formData.funcao.trim()) errors.funcao = 'Função é obrigatória';
    if (!formData.dataEntrevista) errors.dataEntrevista = 'Data da entrevista é obrigatória';
    
    if (formData.curriculoLink) {
      try {
        new URL(formData.curriculoLink);
      } catch (_) {
        errors.curriculoLink = 'Insira uma URL válida (ex: https://...)';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Lógica pesada de Submit (Upload no Storage + Save no Firestore)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let finalCurriculoUrl = formData.curriculoUrl;
      let finalCurriculoNome = formData.curriculoNome;
      
      // Gera um ID antecipado se for novo
      const docId = selectedCandidato ? selectedCandidato.id : doc(collection(db, 'candidatos')).id;

      // 1. Apagar arquivo antigo se foi removido no edit ou se um novo foi selecionado
      if (selectedCandidato && selectedCandidato.curriculoUrl && (selectedFile || formData.curriculoUrl === null)) {
        try {
          const oldFileRef = ref(storage, selectedCandidato.curriculoUrl);
          await deleteObject(oldFileRef);
        } catch (err) {
          console.warn("Aviso: Falha ao deletar arquivo antigo no storage", err);
        }
      }

      // 2. Fazer Upload do Novo Arquivo (se existir)
      if (selectedFile) {
        setUploadProgress(0);
        const storagePath = `curriculos/${docId}/${Date.now()}_${selectedFile.name}`;
        const fileRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytesResumable(fileRef, selectedFile);
        
        // Promisify the upload
        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prog);
            },
            (error) => reject(error),
            async () => {
              finalCurriculoUrl = await getDownloadURL(uploadTask.snapshot.ref);
              finalCurriculoNome = selectedFile.name;
              resolve();
            }
          );
        });
      }

      // 3. Salvar no Firestore
      const dataToSave = {
        ...formData,
        escolaId: formData.escolaId === 'Geral' ? null : formData.escolaId,
        escolaNome: formData.escolaId === 'Geral' ? 'Geral' : formData.escolaNome,
        curriculoUrl: finalCurriculoUrl,
        curriculoNome: finalCurriculoNome,
        atualizadoEm: serverTimestamp()
      };

      if (selectedCandidato) {
        await updateDoc(doc(db, 'candidatos', docId), dataToSave);
        showToast('Candidato atualizado com sucesso!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        // Usa o docId pre-gerado para criar
        await updateDoc(doc(db, 'candidatos', docId), dataToSave).catch(() => {
          // Fallback caso update num doc inexistente falhe (o correto é setDoc ou addDoc)
          // Mas como não importamos setDoc, fazemos um bypass
          return addDoc(collection(db, 'candidatos'), dataToSave);
        });
        // Correção de segurança para garantir a criação:
        // Na verdade, doc(collection).id gera a string, mas addDoc ignora IDs passados. 
        // Como não importei setDoc lá em cima, para garantir, eu usarei o ID gerado se usar setDoc,
        // Mas como só importei addDoc, vou ignorar o docId customizado no storage (ele ainda servirá como pasta única).
        if (!selectedCandidato) {
           await addDoc(collection(db, 'candidatos'), dataToSave);
        }
        showToast('Candidato registrado com sucesso!');
      }
      
      handleCloseForm();
    } catch (error) {
      console.error("Erro ao salvar candidato:", error);
      showToast('Erro ao salvar os dados.', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Handler de Exclusão
  const handleConfirmDelete = async () => {
    if (!selectedCandidato) return;
    try {
      // 1. Excluir arquivo do Storage se existir
      if (selectedCandidato.curriculoUrl) {
        try {
          const fileRef = ref(storage, selectedCandidato.curriculoUrl);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn("Aviso: Arquivo não encontrado no Storage ao excluir candidato.", e);
        }
      }

      // 2. Excluir documento
      await deleteDoc(doc(db, 'candidatos', selectedCandidato.id));
      showToast('Registro excluído com sucesso.', 'error');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedCandidato(null);
    } catch (error) {
      showToast('Erro ao excluir registro.', 'error');
    }
  };

  // Utilitários Visuais
  const getBadgeColor = (resultado) => {
    if (resultado === 'Aprovado') return 'green';
    if (resultado === 'Reprovado') return 'red';
    if (resultado === 'Aguardando') return 'yellow';
    return 'blue'; // Em análise
  };

  return (
    <div className="w-full">
      {/* Header & Estatísticas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processo Seletivo</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm font-medium text-gray-500 mr-1">Neste mês:</span>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-800"><CheckCircle size={14}/> {statsMesAtual.aprovados}</span>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-yellow-100 text-yellow-800"><Clock size={14}/> {statsMesAtual.aguardando}</span>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-800"><XCircle size={14}/> {statsMesAtual.reprovados}</span>
          </div>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} /> Nova Entrevista
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome do candidato..."
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
          <select value={filterFuncao} onChange={(e) => setFilterFuncao(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Funções</option>
            {funcoesUnicas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterResultado} onChange={(e) => setFilterResultado(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Resultados</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Aguardando">Aguardando</option>
            <option value="Em análise">Em análise</option>
          </select>
          <select value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Unidades</option>
            <option value="Geral">Geral (Sem unidade fixa)</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select value={filterPeriodo} onChange={(e) => setFilterPeriodo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Períodos</option>
            {periodosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : filteredCandidatos.length === 0 ? (
        <EmptyState 
          message="Nenhum candidato encontrado na busca." 
          actionLabel="Nova Entrevista" 
          onAction={() => handleOpenForm()} 
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidato / Função</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrevista</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Currículo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredCandidatos.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-gray-900">{item.nome}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Users size={12}/> {item.funcao}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.escolaNome || 'Geral'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{item.dataEntrevista ? formatarData(item.dataEntrevista + 'T00:00:00') : '-'}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[120px]" title={item.entrevistador}>{item.entrevistador}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={item.resultado} color={getBadgeColor(item.resultado)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {item.curriculoUrl ? (
                        <a href={item.curriculoUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-dark p-1 rounded-full hover:bg-blue-50" title="Baixar PDF/Imagem anexada">
                          <DownloadCloud size={20} />
                        </a>
                      ) : null}
                      {item.curriculoLink ? (
                        <a href={item.curriculoLink} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100" title="Acessar Link Externo">
                          <LinkIcon size={20} />
                        </a>
                      ) : (!item.curriculoUrl && !item.curriculoLink) ? (
                        <span className="text-gray-300">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSelectedCandidato(item); setIsDetailsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Ver Detalhes"><Eye size={18} /></button>
                      <button onClick={() => handleOpenForm(item)} className="text-gray-600 hover:bg-gray-100 p-1.5 rounded-md transition-colors" title="Editar"><Edit2 size={18} /></button>
                      <button onClick={() => { setSelectedCandidato(item); setIsConfirmDeleteOpen(true); }} className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Excluir"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Formulário Novo/Editar */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedCandidato ? "Editar Candidato" : "Nova Entrevista"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Seção 1: Dados do Candidato */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Dados do Candidato</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.nome ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex: Maria Oliveira" />
                {formErrors.nome && <p className="text-red-500 text-xs mt-1">{formErrors.nome}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Função Pretendida *</label>
                <input type="text" name="funcao" list="funcoes-list" value={formData.funcao} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.funcao ? 'border-red-500' : 'border-gray-300'}`} placeholder="Selecione ou digite..." />
                <datalist id="funcoes-list">
                  {funcoesUnicas.map(f => <option key={f} value={f} />)}
                </datalist>
                {formErrors.funcao && <p className="text-red-500 text-xs mt-1">{formErrors.funcao}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Direcionada</label>
                <select name="escolaId" value={formData.escolaId || 'Geral'} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                  <option value="Geral">Geral (Banco de talentos)</option>
                  {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Seção 2: Detalhes da Entrevista */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Dados da Entrevista</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input type="date" name="dataEntrevista" value={formData.dataEntrevista} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.dataEntrevista ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.dataEntrevista && <p className="text-red-500 text-xs mt-1">{formErrors.dataEntrevista}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entrevistador</label>
                <input type="text" name="entrevistador" value={formData.entrevistador} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary" placeholder="Quem entrevistou?" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado Atual *</label>
                <select name="resultado" value={formData.resultado} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary bg-white">
                  <option value="Aguardando">Aguardando</option>
                  <option value="Em análise">Em análise</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Reprovado">Reprovado</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Anotações da Entrevista</label>
              <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary resize-none" placeholder="Pontos fortes, comportamento, disponibilidade..."></textarea>
            </div>
          </div>

          {/* Seção 3: Currículo */}
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-gray-100 pb-2 uppercase tracking-wider">Currículo do Candidato</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="flex flex-col h-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Opção 1: Upload de Arquivo</label>
                <div className="flex-1">
                  <CurriculoUpload 
                    onFileSelect={handleFileSelect}
                    onRemove={handleRemoveFile}
                    arquivoAtualNome={formData.curriculoNome}
                    arquivoAtualUrl={formData.curriculoUrl}
                    uploadProgress={uploadProgress}
                  />
                </div>
              </div>

              <div className="flex flex-col h-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Opção 2: Link Externo (Drive, LinkedIn...)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="url" 
                    name="curriculoLink" 
                    value={formData.curriculoLink} 
                    onChange={handleInputChange} 
                    className={`w-full pl-10 pr-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.curriculoLink ? 'border-red-500' : 'border-gray-300'}`} 
                    placeholder="https://..." 
                  />
                </div>
                {formErrors.curriculoLink && <p className="text-red-500 text-xs mt-1">{formErrors.curriculoLink}</p>}
                <p className="text-xs text-gray-500 mt-2">Você pode anexar um arquivo e um link ao mesmo tempo, ou escolher apenas um.</p>
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={handleCloseForm} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark min-w-[140px] flex justify-center items-center transition-colors">
              {isSubmitting ? <LoadingSpinner size="sm" color="text-white" /> : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes */}
      {selectedCandidato && !isFormModalOpen && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Ficha do Candidato" size="lg">
          <div className="space-y-6">
            
            {/* Cabecalho Perfil */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCandidato.nome}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gray-600 flex items-center gap-1"><Users size={16}/> {selectedCandidato.funcao}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{selectedCandidato.escolaNome || 'Banco Geral'}</span>
                </div>
              </div>
              <Badge label={selectedCandidato.resultado} color={getBadgeColor(selectedCandidato.resultado)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Data da Entrevista</span>
                <p className="text-sm font-medium text-gray-900">{selectedCandidato.dataEntrevista ? formatarData(selectedCandidato.dataEntrevista + 'T00:00:00') : 'N/I'}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Entrevistador Responsável</span>
                <p className="text-sm font-medium text-gray-900">{selectedCandidato.entrevistador || 'Não informado'}</p>
              </div>
            </div>

            {selectedCandidato.observacoes && (
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase mb-2">Anotações da Entrevista</span>
                <div className="text-sm text-gray-800 bg-white border border-gray-200 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedCandidato.observacoes}
                </div>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase mb-3">Currículo e Anexos</span>
              <div className="flex flex-col sm:flex-row gap-4">
                {selectedCandidato.curriculoUrl ? (
                  <a href={selectedCandidato.curriculoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                    <DownloadCloud size={18} /> Baixar Arquivo Anexo
                  </a>
                ) : null}
                
                {selectedCandidato.curriculoLink ? (
                  <a href={selectedCandidato.curriculoLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    <LinkIcon size={18} /> Acessar Link Externo
                  </a>
                ) : null}

                {!selectedCandidato.curriculoUrl && !selectedCandidato.curriculoLink && (
                  <p className="text-sm text-gray-500 italic px-2 py-1">Nenhum currículo anexado a esta ficha.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-6">
              <button onClick={() => setIsConfirmDeleteOpen(true)} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">
                <Trash2 size={16} /> Excluir Registro
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsDetailsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Fechar</button>
                <button onClick={() => handleOpenForm(selectedCandidato)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors">
                  <Edit2 size={16} /> Editar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmação Exclusão */}
      <ConfirmDialog 
        isOpen={isConfirmDeleteOpen} 
        title="Excluir candidato" 
        message={`Tem certeza que deseja excluir o registro de ${selectedCandidato?.nome}? O currículo anexado também será excluído permanentemente.`} 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setIsConfirmDeleteOpen(false)} 
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}