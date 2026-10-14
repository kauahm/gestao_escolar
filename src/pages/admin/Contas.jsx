import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ouvir } from '../../services/leitura';
import { useEstadoDasLeituras } from '../../hooks/useEstadoDasLeituras';
import {
  MESES, chave, partesDaCompetencia, competenciaDe, ordemDaCompetencia,
  mesesEntreCompetenciaEVencimento, DISTANCIA_SUSPEITA_DE_COMPETENCIA,
} from '../../importacao/normalizar';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { formatarMoeda } from '../../utils/formatters';
import { situacaoConta, somarValores, diasAte } from '../../utils/calcularStatus';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { EsqueletoDeLista, EsqueletoDeCartoes } from '../../components/ui/Esqueleto';
import ImportarPlanilha from '../../components/shared/ImportarPlanilha';
import { Upload } from 'lucide-react';

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

/** Mês e ano da competência em seletores; grava sempre como "Outubro/2026". */
function SeletorDeCompetencia({ valor, vencimento, erro, aoMudar }) {
  const partes = partesDaCompetencia(valor);
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const anos = [];
  for (let a = anoAtual - 5; a <= anoAtual + 1; a++) anos.push(a);
  if (partes && !anos.includes(partes.ano)) anos.push(partes.ano);
  anos.sort((a, b) => b - a);

  const mudar = (mes, ano) => aoMudar(competenciaDe(mes || hoje.getMonth() + 1, ano || anoAtual));
  const distancia = mesesEntreCompetenciaEVencimento(valor, vencimento);
  const classe = `w-full px-3 py-2 border rounded-md outline-none focus:border-primary bg-white ${erro ? 'border-red-500' : 'border-gray-300'}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Mês da competência" value={partes?.mes || ''} onChange={(e) => mudar(Number(e.target.value), partes?.ano)} className={classe}>
          <option value="" disabled>Mês</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select aria-label="Ano da competência" value={partes?.ano || ''} onChange={(e) => mudar(partes?.mes, Number(e.target.value))} className={classe}>
          <option value="" disabled>Ano</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {valor && !partes && (
        <p className="text-amber-700 text-xs mt-1">O valor antigo "{valor}" não foi reconhecido. Escolha o mês e o ano.</p>
      )}
      {distancia !== null && Math.abs(distancia) > DISTANCIA_SUSPEITA_DE_COMPETENCIA && (
        <p className="text-amber-700 text-xs mt-1">
          A competência está a {Math.abs(distancia)} meses do vencimento. Confira se o mês ou o ano estão certos.
        </p>
      )}
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
    </>
  );
}

export default function Contas() {
  // Estados de dados
  const [contas, setContas] = useState([]);
  const [importarAberto, setImportarAberto] = useState(false);
  const [todasEscolas, setTodasEscolas] = useState([]);
  const leituras = useEstadoDasLeituras();
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEscola, setFilterEscola] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  // ?status=Vencida (vindo do alerta do painel) abre a tela já filtrada.
  const [filterStatus, setFilterStatus] = useState(() => new URLSearchParams(window.location.search).get('status') || 'Todos');
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
    const unsubscribe = ouvir(q, (snapshot) => {
      const todas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const escolasData = todas
        .filter(e => e.situacao === 'Ativa')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setEscolas(escolasData);
      setTodasEscolas(todas); // a importação precisa saber também das inativas
    });
    return () => unsubscribe();
  }, []);

  // 2. Buscar Contas
  //
  // "Vencida" NÃO é mais gravado no banco. Antes, toda conta "A enviar" cujo
  // vencimento passava era reescrita como "Vencida", e o painel — que só somava
  // "A enviar" — passava a mostrar zero enquanto havia contas pendentes.
  // Agora o status guardado é só "A enviar" ou "Enviada", e "vencida" é
  // calculado na hora (ver utils/calcularStatus.js).
  useEffect(() => {
    const q = collection(db, 'contas');
    const unsubscribe = ouvir(q, (snapshot) => {
      const contasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
  // Tipos "Outro" já usados, para sugerir e evitar variações ("TAXA DE LICENÇA" x "Taxa de licença").
  const tiposJaUsados = useMemo(() => {
    const porChave = new Map();
    contas.forEach(c => {
      if (c.tipo === 'Outro' && c.tipoCustomizado && !porChave.has(chave(c.tipoCustomizado))) {
        porChave.set(chave(c.tipoCustomizado), c.tipoCustomizado.trim());
      }
    });
    return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contas]);

  const competenciasDisponiveis = useMemo(() => {
    const unicas = [...new Set(contas.map(c => c.competencia).filter(Boolean))];
    // Mais recente primeiro (antes era em ordem alfabética: "Abril" antes de "Janeiro").
    return unicas.sort((a, b) => ordemDaCompetencia(b) - ordemDaCompetencia(a));
  }, [contas]);

  // Filtragem
  const filteredContas = useMemo(() => {
    return contas.filter(c => {
      const situacao = situacaoConta(c);
      const matchSearch = (
        (c.numeroDocumento || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.observacoes || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchEscola = filterEscola === 'Todas' ? true : c.escolaId === filterEscola;
      const matchTipo = filterTipo === 'Todos' ? true : c.tipo === filterTipo;
      const matchStatus =
        filterStatus === 'Todos' ? true :
        filterStatus === 'Enviada' ? situacao.enviada :
        filterStatus === 'Vencida' ? situacao.vencida :
        /* 'A enviar' */ (situacao.pendente && !situacao.vencida);
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
  const contasVencidas = useMemo(() => contas.filter(c => situacaoConta(c).vencida), [contas]);
  const contasNoPrazo = useMemo(
    () => contas.filter(c => { const s = situacaoConta(c); return s.pendente && !s.vencida; }),
    [contas]
  );

  const totalVencido = somarValores(contasVencidas);
  const totalNoPrazo = somarValores(contasNoPrazo);
  const totalFiltrado = somarValores(filteredContas);
  const contasFiltradasPendentes = filteredContas.filter(c => situacaoConta(c).pendente);

  // Helpers de Data
  const formatDataString = (dateStr) => {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getDiasParaVencer = (dateStr) => {
    const dias = diasAte(dateStr);
    return dias === null ? 999 : dias;
  };

  // Handlers do Formulário
  const handleOpenForm = (conta = null) => {
    if (conta) {
      setFormData({
        ...initialFormState,
        ...conta,
        // Registros antigos podem ter "Vencida" gravado; hoje isso é calculado.
        status: conta.status === 'Enviada' ? 'Enviada' : 'A enviar',
        // Competência digitada à mão no passado ("ABRIL/2026", "MAIO/26") vira "Abril/2026".
        competencia: partesDaCompetencia(conta.competencia)?.texto || conta.competencia || '',
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
    if (!formData.competencia.trim()) errors.competencia = 'Escolha o mês e o ano da competência';
    else if (!partesDaCompetencia(formData.competencia)) errors.competencia = 'Escolha o mês e o ano da competência';
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
        tipoCustomizado: formData.tipo === 'Outro'
          ? (tiposJaUsados.find(t => chave(t) === chave(formData.tipoCustomizado)) || formData.tipoCustomizado.trim())
          : '',
        // Só existem dois status gravados: "A enviar" e "Enviada".
        status: formData.status === 'Enviada' ? 'Enviada' : 'A enviar',
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
      showToast('Conta movida para a lixeira. Dá para restaurar em Segurança dos dados.');
      setIsConfirmDeleteOpen(false);
      setIsDetailsModalOpen(false);
    } catch (error) {
      showToast('Erro ao excluir conta.', 'error');
    }
  };

  // Utilitários Visuais
  const getRowStyle = (conta) => {
    const s = situacaoConta(conta);
    if (s.enviada) return 'bg-gray-50';
    if (s.vencida) return 'bg-red-50';
    if (s.diasParaVencer !== null && s.diasParaVencer <= 3) return 'bg-amber-50';
    return 'bg-white';
  };

  return (
    <div className="w-full">
      {/* Header & Totalizador Global */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a pagar</h1>
          {/* Totais só com os dados confirmados pelo servidor (nunca "R$ 0,00" por falha de leitura). */}
          {!loading && !leituras.falha && !leituras.semServidor && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {contasVencidas.length > 0 && (
              <button
                onClick={() => setFilterStatus('Vencida')}
                className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-red-200 transition-colors"
                title="Ver apenas as contas vencidas"
              >
                <AlertTriangle size={12} />
                {contasVencidas.length} {contasVencidas.length === 1 ? 'vencida' : 'vencidas'}: {formatarMoeda(totalVencido)}
              </button>
            )}
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              {contasNoPrazo.length} a enviar no prazo: {formatarMoeda(totalNoPrazo)}
            </span>
          </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportarAberto(true)}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
          >
            <Upload size={18} /> Importar planilha
          </button>
          <button
            onClick={() => handleOpenForm()}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
          >
            <Plus size={20} /> Registrar conta
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
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
          <select aria-label="Filtrar por escola" value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as unidades</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select aria-label="Filtrar por tipo" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os tipos</option>
            <option value="CPFL">CPFL</option>
            <option value="SABESP">SABESP</option>
            <option value="Taxa de Limpeza">Taxa de Limpeza</option>
            <option value="Nota Fiscal de Serviço">Nota Fiscal de Serviço</option>
            <option value="Outro">Outro</option>
          </select>
          <select aria-label="Filtrar por situação" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os status</option>
            <option value="Vencida">Vencidas</option>
            <option value="A enviar">A enviar (no prazo)</option>
            <option value="Enviada">Enviadas</option>
          </select>
          <select aria-label="Filtrar por competência" value={filterCompetencia} onChange={(e) => setFilterCompetencia(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as competências</option>
            {competenciasDisponiveis.map(comp => <option key={comp} value={comp}>{comp}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela de Contas */}
      {loading ? (
        <EsqueletoDeLista linhas={8} />
      ) : filteredContas.length === 0 ? (
        contas.length === 0 ? (
          <EmptyState
            titulo="Nenhuma conta registrada"
            mensagem="Registre as contas de energia, água, taxas e notas fiscais das escolas, ou importe a planilha que você já usa."
            acoes={[
              { rotulo: 'Registrar conta', onClick: () => handleOpenForm() },
              { rotulo: 'Importar planilha', onClick: () => setImportarAberto(true), icone: Upload },
            ]}
          />
        ) : (
          <EmptyState
            titulo="Nenhuma conta com estes filtros"
            mensagem="Mude ou limpe os filtros para ver as outras contas."
            acoes={[{ rotulo: 'Limpar filtros', onClick: clearFilters }]}
          />
        )
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
                  const s = situacaoConta(item);
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
                        {s.vencida && (
                          <span className="block text-xs font-medium text-red-600">
                            {s.diasDeAtraso === 1 ? 'há 1 dia' : `há ${s.diasDeAtraso} dias`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatarMoeda(item.valor)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge label={s.rotulo} color={s.cor} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {s.pendente && (
                            <button
                              onClick={() => { setSelectedConta(item); setIsConfirmSendOpen(true); }}
                              className="text-green-600 hover:bg-green-100 p-1.5 rounded-full transition-colors"
                              title="Marcar como Enviada"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button onClick={() => { setSelectedConta(item); setIsDetailsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Ver detalhes">
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
                {contasFiltradasPendentes.length} pendentes
              </span>
              <span className="font-bold text-gray-900">
                Total na lista: {formatarMoeda(totalFiltrado)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Form de Registro/Edição */}
      <Modal isOpen={isFormModalOpen} onClose={handleCloseForm} title={selectedConta ? "Editar conta" : "Registrar conta"} size="md">
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
                <input type="text" name="tipoCustomizado" list="tipos-ja-usados" value={formData.tipoCustomizado} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.tipoCustomizado ? 'border-red-500' : 'border-gray-300'}`} placeholder="Ex.: Internet" />
                <datalist id="tipos-ja-usados">
                  {tiposJaUsados.map(t => <option key={t} value={t} />)}
                </datalist>
                {formErrors.tipoCustomizado && <p className="text-red-500 text-xs mt-1">{formErrors.tipoCustomizado}</p>}
              </div>
            )}
            <div className={formData.tipo === 'Outro' ? "col-span-2" : "col-span-2 sm:col-span-1"}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Competência *</label>
              <SeletorDeCompetencia
                valor={formData.competencia}
                vencimento={formData.vencimento}
                erro={formErrors.competencia}
                aoMudar={(valor) => {
                  setFormData(prev => ({ ...prev, competencia: valor }));
                  if (formErrors.competencia) setFormErrors(prev => ({ ...prev, competencia: '' }));
                }}
              />
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
              </select>
              <p className="text-xs text-gray-500 mt-1">"Vencida" é calculado pela data de vencimento.</p>
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
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes do lançamento" size="md">
          <div className="space-y-5">
            {/* Header Conta */}
            <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedConta.escolaNome}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1"><Receipt size={14} /> {selectedConta.tipo === 'Outro' ? selectedConta.tipoCustomizado : selectedConta.tipo}</p>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold text-gray-900">{formatarMoeda(selectedConta.valor)}</span>
                <Badge label={situacaoConta(selectedConta).rotulo} color={situacaoConta(selectedConta).cor} />
              </div>
            </div>

            {situacaoConta(selectedConta).pendente && (
              <div className={`border p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3 ${situacaoConta(selectedConta).vencida ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className={`text-sm ${situacaoConta(selectedConta).vencida ? 'text-red-800' : 'text-yellow-800'}`}>
                  <strong>Atenção:</strong>{' '}
                  {situacaoConta(selectedConta).vencida
                    ? `Esta conta venceu há ${situacaoConta(selectedConta).diasDeAtraso} dias e ainda não foi enviada a SP.`
                    : 'Esta conta ainda não foi enviada a SP.'}
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
                <span className="block text-xs font-bold text-gray-500 uppercase">Vencimento</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{formatDataString(selectedConta.vencimento)}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-500 uppercase">Competência</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedConta.competencia}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-500 uppercase">Nº do Documento</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedConta.numeroDocumento || 'Não informado'}</p>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-500 uppercase">Prazo</span>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {situacaoConta(selectedConta).vencida
                    ? `Venceu há ${situacaoConta(selectedConta).diasDeAtraso} dias`
                    : `Vence em ${getDiasParaVencer(selectedConta.vencimento)} dias`}
                </p>
              </div>
            </div>

            {selectedConta.observacoes && (
              <div className="px-1">
                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações</span>
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
        title="Confirmar envio" 
        message={`Confirma o envio da conta de ${formatarMoeda(selectedConta?.valor)} (${selectedConta?.escolaNome}) para o escritório de SP?`} 
        onConfirm={handleConfirmSend} 
        onCancel={() => setIsConfirmSendOpen(false)} 
      />

      <ConfirmDialog 
        isOpen={isConfirmDeleteOpen} 
        title="Excluir conta" 
        message="Tem certeza que deseja excluir este registro de conta? Ele vai para a lixeira e pode ser restaurado." 
        onConfirm={handleConfirmDelete} 
        onCancel={() => setIsConfirmDeleteOpen(false)} 
      />

      <ImportarPlanilha
        isOpen={importarAberto}
        onClose={() => setImportarAberto(false)}
        tipo="contas"
        escolas={todasEscolas}
        existentes={contas}
      />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}