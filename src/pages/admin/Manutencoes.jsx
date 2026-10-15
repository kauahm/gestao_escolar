import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
import { doMunicipio } from '../../services/consulta';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { prestadorDoChamado, nomeDoResponsavel, responsavelNaoCadastrado, A_DEFINIR } from '../../utils/responsavel';
import { abrirWhatsAppDaOS, imprimirOrdemDeServico } from '../../utils/ordemDeServico';
import { formatarDataHora, formatarData } from '../../utils/formatters';
import { diasEmAberto } from '../../utils/calcularStatus';

// Importação da logo para usar no arquivo PDF

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista, EsqueletoDeCartoes } from '../../components/ui/Esqueleto';

// Ícones (Adicionado o Send para o WhatsApp)
import { Plus, Search, Eye, Edit2, Trash2, AlertTriangle, X, Filter, Printer, Send } from 'lucide-react';

const initialFormState = {
  escolaId: '', escolaNome: '', descricao: '', localDentroEscola: '',
  prioridade: 'Baixa', responsavel: 'A definir', responsavelId: null, status: 'Pendente', prazo: '', observacoes: ''
};

export default function AdminManutencoes() {
  const { currentUser, userProfile } = useAuth();
  
  // Estados
  const [manutencoes, setManutencoes] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [prestadores, setPrestadores] = useState([]); // NOVO: Estado dos Prestadores
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterPrioridade, setFilterPrioridade] = useState('Todas');

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Formulário
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedManutencao, setSelectedManutencao] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Busca Escolas
  useEffect(() => {
    const q = doMunicipio('escolas');
    const unsubscribe = ouvir(q, (snapshot) => {
      const escolasData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.situacao === 'Ativa')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setEscolas(escolasData);
    });
    return () => unsubscribe();
  }, []);

  // NOVO: Busca Prestadores de Serviço
  useEffect(() => {
    const q = doMunicipio('prestadores');
    const unsubscribe = ouvir(q, (snapshot) => {
      const prestadoresData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      prestadoresData.sort((a, b) => a.nome.localeCompare(b.nome));
      setPrestadores(prestadoresData);
    });
    return () => unsubscribe();
  }, []);

  // Busca Manutenções
  useEffect(() => {
    const q = doMunicipio('manutencoes');
    const unsubscribe = ouvir(q, (snapshot) => {
      const manutencoesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      manutencoesData.sort((a, b) => {
        const timeA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
        const timeB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
        return timeB - timeA;
      });
      setManutencoes(manutencoesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro:", error);
      showToast("Erro ao carregar lista.", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'success') => setToast({ show: true, message, type });

  // Vindo da tela de detalhe: "Editar" abre o formulário aqui; a exclusão traz um aviso.
  useEffect(() => {
    const id = parametros.get('editar');
    if (!id || loading || !prestadores) return;
    const item = manutencoes.find(m => m.id === id);
    if (item) handleOpenForm(item);
    setParametros({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros, loading, manutencoes]);

  useEffect(() => {
    if (location.state?.aviso) {
      showToast(location.state.aviso);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const filteredManutencoes = useMemo(() => {
    return manutencoes.filter(m => {
      const matchSearch = m.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEscola = filterEscola === 'Todas' ? true : m.escolaId === filterEscola;
      const matchResponsavel = filterResponsavel === 'Todos' ? true
        : filterResponsavel === A_DEFINIR ? !prestadorDoChamado(m, prestadores) && (!m.responsavel || m.responsavel === A_DEFINIR)
        : prestadorDoChamado(m, prestadores)?.id === filterResponsavel;
      const matchStatus = filterStatus === 'Todos' ? true : m.status === filterStatus;
      const matchPrioridade = filterPrioridade === 'Todas' ? true : m.prioridade === filterPrioridade;
      return matchSearch && matchEscola && matchResponsavel && matchStatus && matchPrioridade;
    });
  }, [manutencoes, prestadores, searchTerm, filterEscola, filterResponsavel, filterStatus, filterPrioridade]);

  const clearFilters = () => {
    setSearchTerm(''); setFilterEscola('Todas'); setFilterResponsavel('Todos');
    setFilterStatus('Todos'); setFilterPrioridade('Todas');
  };

  const handleOpenForm = (manutencao = null) => {
    if (manutencao) {
      setFormData({
        ...initialFormState,
        ...manutencao,
        prazo: manutencao.prazo || '',
        // Registros antigos só tinham o nome: liga ao prestador cadastrado com o mesmo nome.
        responsavelId: manutencao.responsavelId || prestadorDoChamado(manutencao, prestadores)?.id || null,
      });
      setSelectedManutencao(manutencao);
    } else {
      setFormData(initialFormState); setSelectedManutencao(null);
    }
    setFormErrors({}); setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false); setFormData(initialFormState); setFormErrors({}); setSelectedManutencao(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'escolaId') {
      const escolaSelecionada = escolas.find(e => e.id === value);
      setFormData(prev => ({ ...prev, escolaId: value, escolaNome: escolaSelecionada ? escolaSelecionada.nome : '' }));
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
      const dataToSave = { ...formData, atualizadoEm: serverTimestamp() };

      if (isConcluidoNow) dataToSave.concluidoEm = serverTimestamp();
      else if (formData.status !== 'Concluído') dataToSave.concluidoEm = null;

      if (selectedManutencao) {
        await updateDoc(doc(db, 'manutencoes', selectedManutencao.id), dataToSave);
        showToast('Manutenção atualizada!');
      } else {
        dataToSave.criadoEm = serverTimestamp();
        dataToSave.solicitadaPor = currentUser.uid;
        dataToSave.solicitadaPorNome = userProfile?.nome || 'Admin';
        await addDoc(collection(db, 'manutencoes'), dataToSave);
        showToast('Manutenção cadastrada!');
      }
      handleCloseForm();
    } catch (error) {
      showToast('Erro ao salvar manutenção.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedManutencao) return;
    try {
      await deleteDoc(doc(db, 'manutencoes', selectedManutencao.id));
      showToast('Manutenção movida para a lixeira.');
      setIsConfirmDeleteOpen(false);
    } catch (error) {
      showToast('Erro ao excluir manutenção.', 'error');
    }
  };

  const prestadorDe = (item) => prestadorDoChamado(item, prestadores);

  const enviarWhatsApp = (item) => {
    if (!abrirWhatsAppDaOS(item, prestadorDe(item))) {
      showToast('O responsável deste chamado não tem WhatsApp cadastrado.', 'error');
    }
  };

  const gerarArquivo = (item) => {
    if (!imprimirOrdemDeServico({ ...item, responsavel: nomeDoResponsavel(item, prestadores) })) {
      showToast('Permita as janelas pop-up do navegador para gerar a O.S. para impressão.', 'error');
    }
  };

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
          <p className="text-gray-500 text-sm mt-1">{manutencoes.length} {manutencoes.length === 1 ? 'registro' : 'registros no total'}</p>
        </div>
        <button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm">
          <Plus size={20} /> Nova manutenção
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input type="text" placeholder="Buscar por descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none" />
          </div>
          <button onClick={clearFilters} className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"><X size={16} /> Limpar filtros</button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <select aria-label="Filtrar por escola" value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as unidades</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {/* ALTERADO: Mapeamento dinâmico dos Prestadores no Filtro */}
          <select aria-label="Filtrar por responsável" value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os responsáveis</option>
            <option value="A definir">A definir</option>
            {prestadores.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <select aria-label="Filtrar por situação" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
          <select aria-label="Filtrar por prioridade" value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <EsqueletoDeLista linhas={8} />
      ) : filteredManutencoes.length === 0 ? (
        manutencoes.length === 0 ? (
          <EmptyState
            titulo="Nenhum chamado de manutenção"
            mensagem="Os pedidos das diretoras aparecem aqui assim que são abertos. Você também pode registrar um chamado."
            acoes={[{ rotulo: 'Nova manutenção', onClick: () => handleOpenForm() }]}
          />
        ) : (
          <EmptyState
            titulo="Nenhum chamado com estes filtros"
            mensagem="Mude ou limpe os filtros para ver os outros chamados."
            acoes={[{ rotulo: 'Limpar filtros', onClick: clearFilters }]}
          />
        )
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade / Local</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade / Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
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
                      <Link to={`/admin/manutencoes/${item.id}`} className="block text-sm text-gray-900 hover:text-primary hover:underline max-w-xs truncate" title={item.descricao}>{item.descricao}</Link>
                      {isAtrasado && (
                        <div className="flex items-center text-xs text-amber-800 mt-1">
                          <AlertTriangle size={12} className="mr-1" /> Há {diasAberto} dias aberta
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      <div><Badge label={item.prioridade} color={getBadgeColorPriority(item.prioridade)} /></div>
                      <div><Badge label={item.status} color={getBadgeColorStatus(item.status)} /></div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {nomeDoResponsavel(item, prestadores)}
                      {responsavelNaoCadastrado(item, prestadores) && <span className="block text-xs text-amber-700">não cadastrado</span>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      
                      <div className="flex items-center justify-end gap-1.5">
                        {/* NOVO: Botão de Enviar WhatsApp */}
                        <button 
                          onClick={() => enviarWhatsApp(item)} 
                          className="flex items-center gap-1 bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 hover:text-green-800 px-2.5 py-1.5 rounded-md transition-colors shadow-sm" 
                          title="Enviar O.S. pelo WhatsApp"
                        >
                          <Send size={16} />
                          <span className="text-xs font-bold hidden sm:inline">WhatsApp</span>
                        </button>

                        <button 
                          onClick={() => gerarArquivo(item)} 
                          className="flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 px-2.5 py-1.5 rounded-md transition-colors shadow-sm mr-2" 
                          title="Gerar O.S. (PDF)"
                        >
                          <Printer size={16} />
                          <span className="text-xs font-bold hidden sm:inline">Gerar</span>
                        </button>

                        <button onClick={() => navigate(`/admin/manutencoes/${item.id}`)} className="text-gray-500 hover:text-blue-900 p-1" title="Ver detalhes"><Eye size={18} /></button>
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
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedManutencao ? "Editar manutenção" : "Nova manutenção"} size="md">
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
            <input type="text" name="localDentroEscola" value={formData.localDentroEscola} onChange={handleInputChange} placeholder="Ex.: banheiro, pátio..." className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.localDentroEscola ? 'border-red-500' : 'border-gray-300'}`} />
            {formErrors.localDentroEscola && <p className="text-red-500 text-xs mt-1">{formErrors.localDentroEscola}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do problema *</label>
            <textarea name="descricao" value={formData.descricao} onChange={handleInputChange} rows="3" placeholder="Detalhe o que precisa ser reparado..." className={`w-full px-3 py-2 border rounded-md outline-none resize-none focus:border-primary ${formErrors.descricao ? 'border-red-500' : 'border-gray-300'}`}></textarea>
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
              {/* ALTERADO: Mapeamento dinâmico dos Prestadores no Formulário */}
              <select
                name="responsavelId"
                value={prestadorDoChamado(formData, prestadores)?.id || (responsavelNaoCadastrado(formData, prestadores) ? '__antigo__' : '')}
                onChange={(e) => {
                  const valor = e.target.value;
                  if (valor === '__antigo__') return;
                  const p = prestadores.find(x => x.id === valor);
                  setFormData(prev => ({ ...prev, responsavelId: p ? p.id : null, responsavel: p ? p.nome : A_DEFINIR }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary"
              >
                <option value="">A definir</option>
                {responsavelNaoCadastrado(formData, prestadores) && (
                  <option value="__antigo__">{formData.responsavel} (não cadastrado)</option>
                )}
                {prestadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}{p.especialidade ? ` · ${p.especialidade}` : ''}</option>
                ))}
              </select>
              {responsavelNaoCadastrado(formData, prestadores) && (
                <p className="text-amber-700 text-xs mt-1">"{formData.responsavel}" não está no cadastro de Prestadores. Escolha um prestador para poder enviar a O.S. por WhatsApp.</p>
              )}
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


      <ConfirmDialog isOpen={isConfirmDeleteOpen} title="Excluir manutenção" message="Tem certeza que deseja excluir esta solicitação de manutenção? Ela vai para a lixeira e pode ser restaurada." onConfirm={handleConfirmDelete} onCancel={() => setIsConfirmDeleteOpen(false)} />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}