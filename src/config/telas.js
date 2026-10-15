// Nome único de cada tela. O menu lateral, a barra superior e o título da aba
// do navegador leem daqui, para a mesma tela não ter três nomes diferentes.

export const NOME_DO_SISTEMA = 'Gestão Escolar';

export const TELAS = {
  '/admin/dashboard': 'Painel',
  '/admin/sede': 'Visão da sede',
  '/admin/escolas': 'Escolas',
  '/admin/manutencoes': 'Manutenções',
  '/admin/prestadores': 'Prestadores',
  '/admin/contas': 'Contas a pagar',
  '/admin/saldo': 'Controle de saldo',
  '/admin/ciclos': 'Ciclos',
  '/admin/funcionarios': 'Funcionários',
  '/admin/talentos': 'Banco de Talentos',
  '/admin/selecao': 'Processo seletivo',
  '/admin/agenda': 'Agenda',
  '/admin/usuarios': 'Usuários',
  '/admin/seguranca': 'Segurança dos dados',
  '/diretora/dashboard': 'Início',
  '/diretora/manutencoes': 'Meus chamados',
};

/** Nome da tela de um endereço (ou null, se não for uma tela conhecida). */
export const nomeDaTela = (caminho = '') => {
  const limpo = caminho.replace(/\/+$/, '');
  // Endereço com identificador (ex.: /admin/manutencoes/abc123): usa o nome da tela de cima.
  return TELAS[limpo] || TELAS[limpo.replace(/\/[^/]+$/, '')] || null;
};

export const ROTULO_DO_PERFIL = {
  admin: 'Administração',
  administrativo: 'RH',
  diretora: 'Diretora',
};
