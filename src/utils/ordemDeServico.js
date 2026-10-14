// Ordem de serviço (O.S.) de um chamado de manutenção: mensagem de WhatsApp
// para o prestador e versão para imprimir. Usada na lista de manutenções e na
// tela de detalhe do chamado.

import logoImg from '../assets/logo-topo.png';

/**
 * Abre o WhatsApp com a O.S. para o prestador.
 * @returns {boolean} false se o prestador não tiver telefone
 */
export function abrirWhatsAppDaOS(item, prestador) {
  if (!prestador || !prestador.telefone) return false;
  const numero = prestador.telefone.replace(/\D/g, ''); // remove parênteses, traços e espaços
  const mensagem = `Olá, ${prestador.nome}!

Temos uma nova Ordem de Serviço na Associação:

🏫 *Unidade:* ${item.escolaNome}
📍 *Local:* ${item.localDentroEscola}
⚠️ *Problema:* ${item.descricao}
🔴 *Prioridade:* ${item.prioridade}

Por favor, acesse o sistema ou entre em contato com a diretoria para mais detalhes.`;
  window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
  return true;
}

/**
 * Abre a O.S. formatada numa nova janela e chama a impressão.
 * @returns {boolean} false se o navegador bloqueou a janela
 */
export function imprimirOrdemDeServico(item) {
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
  if (!printWindow) return false;

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
              <div class="info-section-title">Registro de Execução</div>
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
  return true;
}
