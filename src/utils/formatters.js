export const formatarData = (timestamp) => {
  if (!timestamp) return '';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('pt-BR').format(data);
};

export const formatarDataHora = (timestamp) => {
  if (!timestamp) return '';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data).replace(',', ' às');
};

export const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
};

export const formatarTelefone = (tel) => {
  if (!tel) return '';
  const cleaned = ('' + tel).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return tel;
};

/**
 * Data por extenso, como se escreve em português do Brasil:
 * "Terça-feira, 13 de outubro de 2026" (só a primeira letra maiúscula).
 */
export const dataPorExtenso = (data = new Date()) => {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Primeiro nome, para saudações ("Alessandra Martins" -> "Alessandra"). */
export const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';