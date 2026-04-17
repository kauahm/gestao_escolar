export const statusCiclo = (proximaExecucao) => {
  if (!proximaExecucao) return "Desconhecido";
  const dataExecucao = proximaExecucao.toDate ? proximaExecucao.toDate() : new Date(proximaExecucao);
  const hoje = new Date();
  const diffTime = dataExecucao.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Vencido";
  if (diffDays <= 7) return "Vencendo em breve";
  return "Em dia";
};

export const diasEmAberto = (criadoEm) => {
  if (!criadoEm) return 0;
  const dataCriacao = criadoEm.toDate ? criadoEm.toDate() : new Date(criadoEm);
  const hoje = new Date();
  const diffTime = hoje.getTime() - dataCriacao.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

export const contaVencida = (vencimento) => {
  if (!vencimento) return false;
  const dataVencimento = vencimento.toDate ? vencimento.toDate() : new Date(vencimento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return dataVencimento < hoje;
};