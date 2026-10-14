import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
// Gravações passam pela camada com histórico e lixeira (ver services/db.js)
import { addDoc, updateDoc, deleteDoc } from '../../services/db';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatarDataHora, formatarData } from '../../utils/formatters';
import { diasEmAberto } from '../../utils/calcularStatus';

// Importação da logo para usar no arquivo PDF
import logoImg from '../../assets/logo-topo.png';

// Componentes UI
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Ícones (Adicionado o Send para o WhatsApp)
import { Plus, Search, Eye, Edit2, Trash2, AlertTriangle, X, Filter, Printer, Send } from 'lucide-react';

const initialFormState = {
  escolaId: '', escolaNome: '', descricao: '', localDentroEscola: '',
  prioridade: 'Baixa', responsavel: 'A definir', status: 'Pendente', prazo: '', observacoes: ''
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
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Formulário
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [selectedManutencao, setSelectedManutencao] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Busca Escolas
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

  // NOVO: Busca Prestadores de Serviço
  useEffect(() => {
    const q = collection(db, 'prestadores');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prestadoresData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      prestadoresData.sort((a, b) => a.nome.localeCompare(b.nome));
      setPrestadores(prestadoresData);
    });
    return () => unsubscribe();
  }, []);

  // Busca Manutenções
  useEffect(() => {
    const q = collection(db, 'manutencoes');
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    setSearchTerm(''); setFilterEscola('Todas'); setFilterResponsavel('Todos');
    setFilterStatus('Todos'); setFilterPrioridade('Todas');
  };

  const handleOpenForm = (manutencao = null) => {
    if (manutencao) {
      setFormData({ ...initialFormState, ...manutencao, prazo: manutencao.prazo || '' });
      setSelectedManutencao(manutencao);
    } else {
      setFormData(initialFormState); setSelectedManutencao(null);
    }
    setFormErrors({}); setIsDetailsModalOpen(false); setIsFormModalOpen(true);
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
      setIsConfirmDeleteOpen(false); setIsDetailsModalOpen(false);
    } catch (error) {
      showToast('Erro ao excluir manutenção.', 'error');
    }
  };

  // NOVO: Função para enviar O.S via WhatsApp para o Prestador
  const enviarWhatsApp = (item) => {
    const prestador = prestadores.find(p => p.nome === item.responsavel);
    
    if (!prestador || !prestador.telefone) {
      return showToast('O prestador selecionado não possui WhatsApp cadastrado.', 'error');
    }

    const numero = prestador.telefone.replace(/\D/g, ''); // Remove formatação (traços, parênteses)
    const mensagem = `Olá, ${prestador.nome}!\n\nTemos uma nova Ordem de Serviço na Associação:\n\n🏫 *Unidade:* ${item.escolaNome}\n📍 *Local:* ${item.localDentroEscola}\n⚠️ *Problema:* ${item.descricao}\n🔴 *Prioridade:* ${item.prioridade}\n\nPor favor, acesse o sistema ou entre em contato com a diretoria para mais detalhes.`;
    
    window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // =============== GERADOR DE ARQUIVO PREMIUM (MANTIDO INTACTO) ===============
  const gerarArquivo = (item) => {
    let dataCriacao = new Date();
    if (item.criadoEm) {
      dataCriacao = item.criadoEm.toMillis ? new Date(item.criadoEm.toMillis()) : new Date(item.criadoEm);
    }

    let dataConcluidoFormatada = '—';
    if (item.concluidoEm) {
      const dc = item.concluidoEm.toMillis ? new Date(item.concluidoEm.toMillis()) : new Date(item.concluidoEm);
      dataConcluidoFormatada = dc.toLocaleDateString('pt-BR');
    }

    let dataPrazoFormatada = '—';
    if (item.prazo) {
      const [y, m, d] = item.prazo.split('-');
      dataPrazoFormatada = `${d}/${m}/${y}`;
    }

    const dataFormatada = dataCriacao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const mesAno = dataCriacao.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const escola = item.escolaNome || 'Escola não informada';
    const responsavelTecnico = item.responsavel || 'A definir';
    const solicitante = item.solicitadaPorNome || 'Direção';
    const prioridade = item.prioridade || 'Normal';
    const status = item.status || 'Pendente';
    const numeroOS = item.id ? item.id.slice(0, 8).toUpperCase() : '00000001';
    const observacoes = item.observacoes || '';

    // Garantir que a logo carregue na janela de impressão
    const logoUrl = logoImg.startsWith('http') || logoImg.startsWith('data:') ? logoImg : window.location.origin + logoImg;

    const prioridadeCores = {
      'Alta':  { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444' },
      'Média': { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
      'Baixa': { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', dot: '#22C55E' },
    };
    const statusCores = {
      'Concluído':    { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
      'Em andamento': { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
      'Pendente':     { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569' },
    };
    const pc = prioridadeCores[prioridade] || prioridadeCores['Baixa'];
    const sc = statusCores[status] || statusCores['Pendente'];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Por favor, permita os pop-ups do navegador para gerar o ficheiro.', 'error');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>OS-${numeroOS} — ${escola}</title>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }

            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            body {
              font-family: 'DM Sans', sans-serif;
              color: #0F172A;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .page {
              width: 210mm;
              min-height: 297mm;
              padding: 0;
              position: relative;
              display: flex;
              flex-direction: column;
            }

            /* ── FAIXA LATERAL ESQUERDA (CORES AEMC) ── */
            .sidebar {
              position: fixed;
              top: 0; left: 0;
              width: 6mm;
              height: 297mm;
              background: #1E40AF; /* Azul Principal */
            }
            .sidebar-accent {
              position: fixed;
              top: 0; left: 6mm;
              width: 2mm;
              height: 297mm;
              background: #FBBF24; /* Amarelo Secundário */
            }

            .content {
              margin-left: 14mm;
              padding: 14mm 14mm 10mm 10mm;
              flex: 1;
              display: flex;
              flex-direction: column;
            }

            /* ── LOGO CENTRALIZADA ── */
            .logo-container {
              text-align: center;
              margin-bottom: 25px;
            }
            .logo-container img {
              height: 75px;
              object-fit: contain;
            }

            /* ── CABEÇALHO ── */
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 10mm;
              padding-bottom: 7mm;
              border-bottom: 1px solid #E2E8F0;
            }

            .header-brand {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .brand-icon {
              width: 36px;
              height: 36px;
              background: #1E40AF; /* Azul Principal */
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 8px;
            }

            .brand-icon svg {
              width: 20px;
              height: 20px;
              fill: none;
              stroke: #FBBF24; /* Amarelo */
              stroke-width: 2.5;
              stroke-linecap: round;
              stroke-linejoin: round;
            }

            .doc-type {
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 2.5px;
              text-transform: uppercase;
              color: #1E40AF; /* Azul Principal */
              margin-bottom: 2px;
            }

            .doc-title {
              font-size: 22px;
              font-weight: 600;
              color: #0F172A;
              letter-spacing: -0.5px;
              line-height: 1.1;
            }

            .doc-subtitle {
              font-size: 12px;
              color: #94A3B8;
              margin-top: 3px;
            }

            .header-meta {
              text-align: right;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              gap: 8px;
            }

            .os-badge {
              font-family: 'DM Mono', monospace;
              font-size: 13px;
              font-weight: 500;
              background: #0F172A;
              color: #ffffff;
              padding: 6px 12px;
              border-radius: 6px;
              letter-spacing: 1px;
            }

            .os-date {
              font-size: 11px;
              color: #64748B;
            }

            .status-pill {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              font-size: 11px;
              font-weight: 600;
              padding: 4px 10px;
              border-radius: 20px;
              border: 1px solid ${sc.border};
              background: ${sc.bg};
              color: ${sc.text};
            }

            /* ── ESCOLA DESTAQUE ── */
            .school-block {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-left: 4px solid #FBBF24; /* Amarelo da Logo */
              border-radius: 0 8px 8px 0;
              padding: 12px 16px;
              margin-bottom: 6mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .school-label {
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #1E40AF; /* Azul Principal */
              margin-bottom: 4px;
            }

            .school-name {
              font-size: 16px;
              font-weight: 600;
              color: #0F172A;
            }

            .school-local {
              font-size: 12px;
              color: #64748B;
              margin-top: 2px;
            }

            .priority-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 14px;
              border-radius: 20px;
              border: 1px solid ${pc.border};
              background: ${pc.bg};
              font-size: 12px;
              font-weight: 600;
              color: ${pc.text};
              white-space: nowrap;
            }

            .priority-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${pc.dot};
              flex-shrink: 0;
            }

            /* ── GRID DE INFORMAÇÕES ── */
            .info-section-title {
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 2px;
              text-transform: uppercase;
              color: #94A3B8;
              margin-bottom: 4mm;
            }

            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 7mm;
            }

            .info-card {
              background: #ffffff;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 12px 14px;
            }

            .info-card-label {
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #94A3B8;
              margin-bottom: 5px;
            }

            .info-card-value {
              font-size: 13px;
              font-weight: 600;
              color: #0F172A;
              line-height: 1.3;
            }

            /* ── BLOCO DESCRIÇÃO ── */
            .desc-section {
              margin-bottom: 7mm;
            }

            .desc-box {
              background: #ffffff;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 14px 16px;
              min-height: 50px;
            }

            .desc-text {
              font-size: 13px;
              color: #1E293B;
              line-height: 1.7;
            }

            /* ── TABELA DE EXECUÇÃO ── */
            .exec-section {
              margin-bottom: 7mm;
            }

            .exec-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            .exec-table thead tr {
              background: #0F172A;
            }

            .exec-table th {
              padding: 10px 14px;
              text-align: left;
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #94A3B8;
            }

            .exec-table th:first-child { border-radius: 6px 0 0 6px; }
            .exec-table th:last-child { border-radius: 0 6px 6px 0; }

            .exec-table tbody tr {
              border-bottom: 1px solid #F1F5F9;
            }

            .exec-table tbody tr:last-child { border-bottom: none; }

            .exec-table td {
              padding: 12px 14px;
              font-size: 12px;
              color: #334155;
              vertical-align: middle;
              border-left: 1px solid #F1F5F9;
              border-right: 1px solid #F1F5F9;
            }

            .exec-table td:first-child { border-left: 1px solid #E2E8F0; }
            .exec-table td:last-child { border-right: 1px solid #E2E8F0; }

            .exec-table tbody { border: 1px solid #E2E8F0; border-radius: 0 0 8px 8px; }

            .field-line {
              border-bottom: 1px dashed #CBD5E1;
              min-height: 22px;
              width: 100%;
              display: block;
            }

            /* ── OBSERVAÇÕES ── */
            .obs-section {
              margin-bottom: 7mm;
            }

            .obs-box {
              background: #FFFBEB;
              border: 1px solid #FDE68A;
              border-radius: 8px;
              padding: 12px 16px;
              min-height: 36px;
            }

            .obs-text {
              font-size: 12px;
              color: #78350F;
              line-height: 1.6;
            }

            /* ── ASSINATURAS ── */
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 16px;
              margin-top: auto;
              padding-top: 8mm;
              border-top: 1px solid #E2E8F0;
            }

            .sig-box {
              text-align: center;
            }

            .sig-name {
              font-size: 12px;
              font-weight: 600;
              color: #0F172A;
              margin-bottom: 14px;
            }

            .sig-line-area {
              border-top: 1px solid #0F172A;
              padding-top: 6px;
            }

            .sig-role {
              font-size: 10px;
              color: #64748B;
              letter-spacing: 0.5px;
            }

            /* ── RODAPÉ ── */
            .footer {
              margin-top: 8mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-top: 4mm;
              border-top: 1px solid #F1F5F9;
            }

            .footer-left {
              font-size: 9px;
              color: #CBD5E1;
              letter-spacing: 0.5px;
            }

            .footer-right {
              font-family: 'DM Mono', monospace;
              font-size: 9px;
              color: #CBD5E1;
            }

            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .sidebar, .sidebar-accent { position: fixed; }
            }
          </style>
        </head>
        <body>
          <div class="sidebar"></div>
          <div class="sidebar-accent"></div>

          <div class="page">
            <div class="content">

              <div class="logo-container">
                <img src="${logoUrl}" alt="AEMC Logo" />
              </div>

              <div class="header">
                <div class="header-brand">
                  <div class="brand-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                    </svg>
                  </div>
                  <div class="doc-type">Gestão Escolar · AEMC</div>
                  <div class="doc-title">Ordem de Serviço</div>
                  <div class="doc-subtitle">Solicitação de Manutenção</div>
                </div>
                <div class="header-meta">
                  <div class="os-badge">OS-${numeroOS}</div>
                  <div class="os-date">Emitido em ${dataFormatada}</div>
                  <div class="status-pill">${status}</div>
                </div>
              </div>

              <div class="school-block">
                <div>
                  <div class="school-label">Unidade Escolar</div>
                  <div class="school-name">${escola}</div>
                  <div class="school-local">📍 ${item.localDentroEscola}</div>
                </div>
                <div class="priority-badge">
                  <span class="priority-dot"></span>
                  Prioridade ${prioridade}
                </div>
              </div>

              <div class="info-section-title">Dados da Solicitação</div>
              <div class="info-grid">
                <div class="info-card">
                  <div class="info-card-label">Solicitante</div>
                  <div class="info-card-value">${solicitante}</div>
                </div>
                <div class="info-card">
                  <div class="info-card-label">Técnico Responsável</div>
                  <div class="info-card-value">${responsavelTecnico}</div>
                </div>
                <div class="info-card">
                  <div class="info-card-label">Prazo de Conclusão</div>
                  <div class="info-card-value">${dataPrazoFormatada}</div>
                </div>
                <div class="info-card">
                  <div class="info-card-label">Data de Conclusão</div>
                  <div class="info-card-value">${dataConcluidoFormatada}</div>
                </div>
              </div>

              <div class="desc-section">
                <div class="info-section-title">Descrição do Problema</div>
                <div class="desc-box">
                  <div class="desc-text">${item.descricao}</div>
                </div>
              </div>

              <div class="exec-section">
                <div class="info-section-title">Registo de Execução</div>
                <table class="exec-table">
                  <thead>
                    <tr>
                      <th style="width:5%">#</th>
                      <th style="width:40%">Serviço a Executar</th>
                      <th style="width:20%">Local</th>
                      <th style="width:12%">Data Início</th>
                      <th style="width:12%">Data Término</th>
                      <th style="width:11%">Assinatura</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="background:#fff">
                      <td style="font-family:'DM Mono',monospace;color:#94A3B8;font-size:11px">01</td>
                      <td style="font-weight:600;color:#0F172A">${item.descricao}</td>
                      <td style="color:#475569">${item.localDentroEscola}</td>
                      <td><span class="field-line"></span></td>
                      <td><span class="field-line"></span></td>
                      <td><span class="field-line"></span></td>
                    </tr>
                    <tr style="background:#F8FAFC">
                      <td style="font-family:'DM Mono',monospace;color:#94A3B8;font-size:11px">—</td>
                      <td colspan="5" style="color:#CBD5E1;font-size:11px;font-style:italic">Espaço para serviços adicionais</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              ${observacoes ? `
              <div class="obs-section">
                <div class="info-section-title">Observações Internas</div>
                <div class="obs-box">
                  <div class="obs-text">${observacoes}</div>
                </div>
              </div>
              ` : ''}

              <div class="signatures">
                <div class="sig-box">
                  <div class="sig-name">${solicitante}</div>
                  <div class="sig-line-area">
                    <div class="sig-role">Direção / Solicitante</div>
                  </div>
                </div>
                <div class="sig-box">
                  <div class="sig-name">${responsavelTecnico}</div>
                  <div class="sig-line-area">
                    <div class="sig-role">Técnico Responsável</div>
                  </div>
                </div>
                <div class="sig-box">
                  <div class="sig-name">Visto de Aprovação</div>
                  <div class="sig-line-area">
                    <div class="sig-role">Coordenação / Gestor</div>
                  </div>
                </div>
              </div>

              <div class="footer">
                <div class="footer-left">AEMC · Sistema de Gestão Escolar · Documento oficial gerado automaticamente</div>
                <div class="footer-right">OS-${numeroOS} · ${dataFormatada}</div>
              </div>

            </div>
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          <p className="text-gray-500 text-sm mt-1">{manutencoes.length} {manutencoes.length === 1 ? 'registo' : 'registos no total'}</p>
        </div>
        <button onClick={() => handleOpenForm()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm">
          <Plus size={20} /> Nova Manutenção
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Buscar por descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary outline-none" />
          </div>
          <button onClick={clearFilters} className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"><X size={16} /> Limpar filtros</button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <select value={filterEscola} onChange={(e) => setFilterEscola(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todas">Todas as Unidades</option>
            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {/* ALTERADO: Mapeamento dinâmico dos Prestadores no Filtro */}
          <select value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
            <option value="Todos">Todos os Responsáveis</option>
            <option value="A definir">A definir</option>
            {prestadores.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
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
        <EmptyState message="Nenhuma manutenção encontrada." actionLabel="Nova Manutenção" onAction={() => handleOpenForm()} />
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
                    <td className="px-6 py-4 text-sm text-gray-900">{item.responsavel}</td>
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

                        <button onClick={() => { setSelectedManutencao(item); setIsDetailsModalOpen(true); }} className="text-gray-500 hover:text-blue-900 p-1" title="Ver Detalhes"><Eye size={18} /></button>
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
            <input type="text" name="localDentroEscola" value={formData.localDentroEscola} onChange={handleInputChange} placeholder="Ex: Casa de banho, Recreio..." className={`w-full px-3 py-2 border rounded-md outline-none focus:border-primary ${formErrors.localDentroEscola ? 'border-red-500' : 'border-gray-300'}`} />
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
              <select name="responsavel" value={formData.responsavel} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:border-primary">
                <option value="A definir">A definir</option>
                {prestadores.map(p => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
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

      {/* Modal Detalhes e Exclusão */}
      {selectedManutencao && !isFormModalOpen && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes da Manutenção" size="md">
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedManutencao.escolaNome}</h3>
              <p className="text-sm text-gray-600 flex items-center gap-2">📍 {selectedManutencao.localDentroEscola}</p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase mb-1">Descrição do Problema</span>
              <p className="text-sm text-gray-800 bg-white border p-3 rounded-md">{selectedManutencao.descricao}</p>
            </div>
            {selectedManutencao.observacoes && (
              <div>
                <span className="block text-xs text-gray-500 uppercase mb-1">Observações Internas</span>
                <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-md border border-yellow-100">{selectedManutencao.observacoes}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setIsConfirmDeleteOpen(true)} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">Excluir</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog isOpen={isConfirmDeleteOpen} title="Excluir manutenção" message="Tem certeza que deseja excluir esta solicitação de manutenção? Ela vai para a lixeira e pode ser restaurada." onConfirm={handleConfirmDelete} onCancel={() => setIsConfirmDeleteOpen(false)} />

      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}