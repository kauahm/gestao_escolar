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