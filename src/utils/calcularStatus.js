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

/** Meia-noite de hoje, para comparar datas sem influência do horário. */
export const hojeZerado = () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
};

/**
 * Converte "AAAA-MM-DD" (ou Timestamp/Date) em Date local, sem fuso atrapalhando.
 * Retorna null quando não há data.
 */
export const paraData = (valor) => {
  if (!valor) return null;
  if (valor.toDate) return valor.toDate();
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') {
    const partes = valor.split('-');
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return new Date(Number(ano), Number(mes) - 1, Number(dia));
    }
    const d = new Date(valor);
    return isNaN(d) ? null : d;
  }
  return null;
};

/** Dias até a data (negativo = já passou). Sem data, retorna null. */
export const diasAte = (valor) => {
  const data = paraData(valor);
  if (!data) return null;
  data.setHours(0, 0, 0, 0);
  return Math.round((data.getTime() - hojeZerado().getTime()) / (1000 * 60 * 60 * 24));
};

export const contaVencida = (vencimento) => {
  const dias = diasAte(vencimento);
  return dias !== null && dias < 0;
};

/**
 * Situação de uma conta a pagar.
 *
 * "Vencida" é uma CONDIÇÃO CALCULADA (o vencimento passou e a conta ainda não
 * foi enviada), nunca um status gravado que apaga o "A enviar". Assim o painel
 * não some com as contas pendentes só porque o prazo passou.
 *
 * Compatível com os registros antigos, em que "Vencida" chegou a ser gravado
 * no campo status: eles continuam contando como pendentes.
 */
export const situacaoConta = (conta) => {
  const enviada = conta?.status === 'Enviada';
  const dias = diasAte(conta?.vencimento);
  const vencida = !enviada && dias !== null && dias < 0;

  return {
    enviada,
    pendente: !enviada,
    vencida,
    diasParaVencer: dias,
    diasDeAtraso: vencida ? Math.abs(dias) : 0,
    rotulo: enviada ? 'Enviada' : (vencida ? 'Vencida' : 'A enviar'),
    cor: enviada ? 'green' : (vencida ? 'red' : 'yellow'),
  };
};

/** Soma o valor de uma lista de contas. */
export const somarValores = (contas) =>
  contas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
