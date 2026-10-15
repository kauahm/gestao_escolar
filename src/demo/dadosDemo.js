// Dados FICTÍCIOS do ambiente de demonstração.
//
// Nenhuma escola, pessoa, telefone, e-mail ou valor aqui é real. As datas são
// calculadas a partir de "hoje", para a demonstração parecer viva em qualquer
// dia: sempre há contas vencidas, contas a vencer, ciclos atrasados, chamados
// parados e compromissos nos próximos dias.
//
// Os identificadores são fixos (demo-...), então restaurar os dados não quebra
// o vínculo da diretora de demonstração com a escola dela.

import { Timestamp } from 'firebase/firestore';

const pad = (n) => String(n).padStart(2, '0');

/** Data local a `dias` de hoje (negativo = passado), no horário indicado. */
const dia = (dias, hora = 9, minuto = 0) => {
  const d = new Date();
  d.setHours(hora, minuto, 0, 0);
  d.setDate(d.getDate() + dias);
  return d;
};

/** "AAAA-MM-DD", o formato que as telas gravam. */
const ymd = (dias) => {
  const d = dia(dias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const carimbo = (dias, hora, minuto) => Timestamp.fromDate(dia(dias, hora, minuto));

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Competência "Mês/Ano" de `mesesAtras` meses atrás. */
const competencia = (mesesAtras) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
};

const ESCOLAS = [
  { nome: 'CEI Pequenos Passos', bairro: 'Jardim Amanda', diretora: 'Helena Barros', alunos: 182, caixa: 5000 },
  { nome: 'CEI Girassol', bairro: 'Jardim Rosolém', diretora: 'Marta Queiroz', alunos: 146, caixa: 3000 },
  { nome: 'CEI Arco-Íris', bairro: 'Remanso Campineiro', diretora: 'Cláudia Teles', alunos: 210, caixa: 5000 },
  { nome: 'CEI Semear', bairro: 'Vila Real', diretora: 'Patrícia Lemos', alunos: 124, caixa: 2000 },
  { nome: 'CEI Casa da Criança', bairro: 'Jardim Nova Hortolândia', diretora: 'Sônia Figueira', alunos: 168, caixa: 3000 },
  { nome: 'CEI Recanto do Saber', bairro: 'Parque Ortolândia', diretora: 'Luciana Prado', alunos: 96, caixa: 2000 },
  { nome: 'CEI Estrela Guia', bairro: 'Jardim São Sebastião', diretora: 'Renata Coelho', alunos: 154, caixa: 3000 },
  { nome: 'CEI Mundo Encantado', bairro: 'Jardim Boa Esperança', diretora: 'Débora Antunes', alunos: 132, caixa: 3000, inativa: true },
];

const idEscola = (i) => `demo-escola-${pad(i + 1)}`;

const escolas = () => ESCOLAS.map((e, i) => ({
  id: idEscola(i),
  nome: e.nome,
  codigo: `UE-${pad(i + 1)}`,
  situacao: e.inativa ? 'Inativa' : 'Ativa',
  endereco: `Rua Exemplo ${i + 1}, ${100 + i * 37}`,
  bairro: e.bairro,
  cep: `13180-0${pad(i + 1)}`,
  telefone: `(19) 3000-00${pad(i + 1)}`,
  email: `escola${pad(i + 1)}@exemplo.org`,
  nomeDiretora: e.diretora,
  celularDiretora: `(19) 99000-00${pad(i + 1)}`,
  emailDiretora: `diretora${pad(i + 1)}@exemplo.org`,
  numeroAlunos: e.alunos,
  capacidadeCaixaDagua: e.caixa,
  observacoes: e.inativa ? 'Unidade em reforma; atendimento transferido temporariamente.' : '',
  criadoEm: carimbo(-200),
  atualizadoEm: carimbo(-30),
}));

const PRESTADORES = [
  { nome: 'José Carlos (manutenção geral)', especialidade: 'Geral', tipo: 'Interno' },
  { nome: 'Elétrica Luz Certa', especialidade: 'Eletricista', tipo: 'Externo' },
  { nome: 'Hidráulica Bom Fluxo', especialidade: 'Encanador', tipo: 'Externo' },
  { nome: 'Antônio Pinturas', especialidade: 'Pintor', tipo: 'Externo' },
  { nome: 'Rede & Micro Informática', especialidade: 'TI / Informática', tipo: 'Externo' },
];

const prestadores = () => PRESTADORES.map((p, i) => ({
  id: `demo-prestador-${pad(i + 1)}`,
  ...p,
  telefone: `(19) 99111-00${pad(i + 1)}`,
  documento: p.tipo === 'Interno' ? '' : `00.000.000/0001-${pad(i + 1)}`,
  pix: p.tipo === 'Interno' ? '' : `prestador${pad(i + 1)}@exemplo.org`,
  criadoEm: carimbo(-180),
  atualizadoEm: carimbo(-180),
}));

// Chamados: [escola, descrição, local, prioridade, status, responsável, aberto há N dias, prazo em N dias, concluído há N dias]
const CHAMADOS = [
  [0, 'Vazamento na torneira do lavatório infantil', 'Banheiro infantil, bloco A', 'Alta', 'Pendente', 'A definir', 9, null, null],
  [2, 'Lâmpadas queimadas no corredor principal', 'Corredor de acesso às salas', 'Média', 'Pendente', 'A definir', 7, null, null],
  [4, 'Portão de entrada não fecha direito', 'Entrada principal', 'Alta', 'Pendente', 'A definir', 2, null, null],
  [1, 'Infiltração no teto da sala 3', 'Sala 3 (maternal)', 'Alta', 'Em andamento', 'Antônio Pinturas', 12, 3, null],
  [3, 'Tomada sem energia na cozinha', 'Cozinha', 'Alta', 'Em andamento', 'Elétrica Luz Certa', 4, 1, null],
  [5, 'Computador da secretaria não liga', 'Secretaria', 'Média', 'Em andamento', 'Rede & Micro Informática', 6, -1, null],
  [6, 'Descarga do banheiro dos funcionários quebrada', 'Banheiro dos funcionários', 'Média', 'Em andamento', 'Hidráulica Bom Fluxo', 3, 5, null],
  [0, 'Pintura do muro externo', 'Muro da frente', 'Baixa', 'Pendente', 'A definir', 1, 20, null],
  [2, 'Troca do vidro trincado da janela', 'Sala 1 (berçário)', 'Alta', 'Concluído', 'José Carlos (manutenção geral)', 20, null, 15],
  [4, 'Conserto do bebedouro', 'Pátio coberto', 'Média', 'Concluído', 'Hidráulica Bom Fluxo', 16, null, 11],
  [1, 'Reparo na fechadura do almoxarifado', 'Almoxarifado', 'Baixa', 'Concluído', 'José Carlos (manutenção geral)', 14, null, 10],
  [6, 'Troca de disjuntor do quadro de energia', 'Quadro de energia', 'Alta', 'Concluído', 'Elétrica Luz Certa', 30, null, 27],
  [3, 'Limpeza das calhas antes das chuvas', 'Telhado', 'Média', 'Concluído', 'José Carlos (manutenção geral)', 25, null, 18],
  [5, 'Ajuste nas dobradiças do armário da cozinha', 'Cozinha', 'Baixa', 'Concluído', 'José Carlos (manutenção geral)', 8, null, 5],
];

const manutencoes = () => CHAMADOS.map(([e, descricao, local, prioridade, status, responsavel, aberto, prazo, concluido], i) => ({
  id: `demo-chamado-${pad(i + 1)}`,
  escolaId: idEscola(e),
  escolaNome: ESCOLAS[e].nome,
  descricao,
  localDentroEscola: local,
  prioridade,
  status,
  responsavel,
  prazo: prazo === null ? '' : ymd(prazo),
  observacoes: '',
  solicitadaPor: 'demo',
  solicitadaPorNome: ESCOLAS[e].diretora,
  criadoEm: carimbo(-aberto, 8 + (i % 8), (i * 7) % 60),
  atualizadoEm: carimbo(concluido === null ? -Math.min(aberto, 1) : -concluido, 15),
  concluidoEm: concluido === null ? null : carimbo(-concluido, 16),
}));

/** Valor estável (não muda a cada restauração) em torno de `base`. */
const valor = (base, semente) => Math.round((base + ((semente * 37) % 100) * (base / 250)) * 100) / 100;

const contas = () => {
  const lista = [];
  const nova = (dados) => lista.push({
    id: `demo-conta-${pad(lista.length + 1)}`,
    tipoCustomizado: '',
    observacoes: '',
    criadoEm: carimbo(-3),
    atualizadoEm: carimbo(-3),
    ...dados,
  });

  ESCOLAS.forEach((e, i) => {
    if (e.inativa) return;
    const base = { escolaId: idEscola(i), escolaNome: e.nome };
    // Energia e água de três meses: o mais antigo já enviado, o do mês passado
    // com algumas vencidas, o deste mês ainda no prazo.
    [2, 1, 0].forEach((mesesAtras) => {
      const vencEnergia = mesesAtras === 2 ? -48 + i : mesesAtras === 1 ? -14 + i * 3 : 4 + i * 2;
      const vencAgua = vencEnergia + 5;
      const enviada = (venc) => mesesAtras === 2 || (mesesAtras === 1 && venc >= -5);
      nova({
        ...base, tipo: 'CPFL', competencia: competencia(mesesAtras),
        valor: valor(e.alunos * 6.2, i + mesesAtras), vencimento: ymd(vencEnergia),
        numeroDocumento: `CPFL-${2600 + lista.length}`, status: enviada(vencEnergia) ? 'Enviada' : 'A enviar',
      });
      nova({
        ...base, tipo: 'SABESP', competencia: competencia(mesesAtras),
        valor: valor(e.alunos * 3.4, i * 3 + mesesAtras), vencimento: ymd(vencAgua),
        numeroDocumento: `SAB-${7100 + lista.length}`, status: enviada(vencAgua) ? 'Enviada' : 'A enviar',
      });
    });
  });

  // Algumas contas avulsas.
  nova({ escolaId: idEscola(0), escolaNome: ESCOLAS[0].nome, tipo: 'Taxa de Limpeza', competencia: competencia(0), valor: 412.5, vencimento: ymd(2), numeroDocumento: 'TL-0098', status: 'A enviar' });
  nova({ escolaId: idEscola(2), escolaNome: ESCOLAS[2].nome, tipo: 'Nota Fiscal de Serviço', competencia: competencia(0), valor: 1280, vencimento: ymd(6), numeroDocumento: 'NF-000451', status: 'A enviar', observacoes: 'Troca do vidro da janela do berçário.' });
  nova({ escolaId: idEscola(4), escolaNome: ESCOLAS[4].nome, tipo: 'Nota Fiscal de Serviço', competencia: competencia(1), valor: 640, vencimento: ymd(-9), numeroDocumento: 'NF-000437', status: 'A enviar', observacoes: 'Conserto do bebedouro.' });
  nova({ escolaId: idEscola(1), escolaNome: ESCOLAS[1].nome, tipo: 'Outro', tipoCustomizado: 'Dedetização', competencia: competencia(1), valor: 890, vencimento: ymd(-20), numeroDocumento: 'NF-000420', status: 'Enviada' });

  return lista;
};

const TIPOS_DE_CICLO = [
  ["Limpeza de caixa d'água", 180],
  ['Inspeção de DR e DS', 365],
  ['Troca/recarga de extintores', 365],
  ['Troca de filtros de água', 90],
];

const ciclos = () => {
  const lista = [];
  ESCOLAS.forEach((e, i) => {
    if (e.inativa) return;
    TIPOS_DE_CICLO.forEach(([tipo, periodicidade], t) => {
      // Dias até a próxima execução: a maioria em dia, algumas perto, poucas vencidas.
      const combinacao = (i * 4 + t) % 9;
      const faltam = combinacao === 2 ? -12 - i : combinacao === 5 ? 6 + i : combinacao === 7 ? 21 : 45 + ((i * 13 + t * 29) % (periodicidade - 60));
      lista.push({
        id: `demo-ciclo-${pad(lista.length + 1)}`,
        escolaId: idEscola(i),
        escolaNome: e.nome,
        tipo,
        periodicidadeDias: periodicidade,
        ultimaExecucao: ymd(faltam - periodicidade),
        proximaExecucao: ymd(faltam),
        observacoes: '',
        criadoEm: carimbo(-200),
        atualizadoEm: carimbo(-40),
      });
    });
  });
  return lista;
};

// Agenda: [título, categoria, cor, local, em N dias, hora de início, duração em horas (0 = dia inteiro)]
const EVENTOS = [
  ['Reunião mensal com as diretoras', 'Reunião', '#185FA5', 'Escritório de Hortolândia', 2, 9, 2],
  ['Visita técnica ao CEI Arco-Íris', 'Visita', '#3B6D11', 'CEI Arco-Íris', 4, 14, 2],
  ['Entrega da prestação de contas do mês', 'Prazo', '#A32D2D', '', 8, 0, 0],
  ['Alinhamento com a equipe de manutenção', 'Compromisso', '#534AB7', 'Escritório de Hortolândia', 1, 8, 1],
  ['Formação de educadoras', 'Outro', '#5F5E5A', 'CEI Pequenos Passos', 12, 0, 0],
  ['Vistoria dos extintores com o fornecedor', 'Visita', '#3B6D11', 'CEI Girassol', 6, 10, 1],
  ['Reunião com a Secretaria de Educação', 'Reunião', '#185FA5', 'Paço Municipal', 15, 15, 2],
  ['Reunião mensal com as diretoras', 'Reunião', '#185FA5', 'Escritório de Hortolândia', -26, 9, 2],
];

const eventos = () => EVENTOS.map(([titulo, categoria, cor, local, em, hora, duracao], i) => ({
  id: `demo-evento-${pad(i + 1)}`,
  titulo,
  descricao: '',
  local,
  categoria,
  cor,
  diaInteiro: duracao === 0,
  inicio: carimbo(em, duracao === 0 ? 0 : hora),
  fim: duracao === 0 ? null : carimbo(em, hora + duracao),
  criadoPor: 'demo',
  criadoEm: carimbo(-10),
  atualizadoEm: carimbo(-10),
}));

// Currículos: [nome, vaga, experiência, indicação, status, entrevista em N dias, hora, feedback]
const CURRICULOS = [
  ['Aline Moreira', 'Auxiliar de educação infantil', 'Sim', '', 'Entrevista Agendada', 2, '10:00', ''],
  ['Bruno Tavares', 'Auxiliar de limpeza', 'Sim', 'Indicação da diretora do CEI Girassol', 'Entrevista Agendada', 3, '14:30', ''],
  ['Camila Rocha', 'Professora de educação infantil', 'Sim', '', 'Entrevista Agendada', 5, '09:00', ''],
  ['Daniela Freitas', 'Cozinheira', 'Sim', '', 'Disponível', null, '', ''],
  ['Eduardo Lima', 'Auxiliar administrativo', 'Não', '', 'Disponível', null, '', ''],
  ['Fabiana Souza', 'Auxiliar de educação infantil', 'Não', 'Indicação de funcionária', 'Disponível', null, '', ''],
  ['Gabriela Nunes', 'Professora de educação infantil', 'Sim', '', 'Aprovado', -6, '10:00', 'Ótima didática e experiência com berçário. Encaminhada para admissão.'],
  ['Heloísa Pinto', 'Auxiliar de limpeza', 'Não', '', 'Reprovado', -8, '15:00', 'Sem disponibilidade para o período da manhã.'],
  ['Isabela Campos', 'Cozinheira', 'Sim', '', 'Disponível', null, '', ''],
];

const curriculos = () => CURRICULOS.map(([nome, vaga, exp, indicacao, status, entrevista, hora, feedback], i) => ({
  id: `demo-curriculo-${pad(i + 1)}`,
  nome,
  telefone: `(19) 99222-00${pad(i + 1)}`,
  email: `candidato${pad(i + 1)}@exemplo.org`,
  vaga,
  exp,
  indicacao,
  observacoes: '',
  status,
  dataCadastro: carimbo(-40 + i * 3, 11),
  ...(entrevista === null ? {} : { dataEntrevista: ymd(entrevista), horaEntrevista: hora }),
  ...(feedback ? { feedback } : {}),
}));

// Funcionários: [nome, escola, cargo, admissão (dias atrás), extra]
// CPF e PIS são gerados só para passar na conferência dos dígitos; não
// pertencem a ninguém de propósito (sequências montadas a partir do número da linha).
const FUNCIONARIOS = [
  ['Adriana Lopes Cardoso', 0, 'Agente de Desenvolvimento Infantil', 900, {}],
  ['Beatriz Fontes Ramos', 0, 'Professor(a) de Educação Infantil', 1500, { asoEm: -12 }],
  ['Carla Mendes Viana', 0, 'Auxiliar de Serviços Gerais', 400, { pcd: true }],
  ['Denise Araújo Paiva', 0, 'Coordenador(a) Pedagógico(a)', 2100, {}],
  ['Elaine Duarte Moura', 0, 'Agente de Desenvolvimento Infantil', 120, { afastadoHa: 15, retornoEm: 20, tipo: 'Doença não relacionada ao trabalho' }],
  ['Fernanda Rezende Costa', 1, 'Agente de Desenvolvimento Infantil', 700, { asoEm: 9 }],
  ['Gisele Martins Prado', 1, 'Professor(a) de Educação Infantil', 1100, {}],
  ['Hugo Barbosa Teixeira', 1, 'Zelador(a)', 1800, {}],
  ['Ingrid Sales Fonseca', 1, 'Auxiliar Administrativo', 300, {}],
  ['Juliana Correia Melo', 1, 'Agente de Desenvolvimento Infantil', 600, { inativaHa: 40 }],
  ['Kátia Nogueira Batista', 2, 'Agente de Desenvolvimento Infantil', 1300, {}],
  ['Larissa Pires Antunes', 2, 'Professor(a) de Educação Especial', 800, { pcd: true }],
  ['Márcia Rocha Vidal', 2, 'Auxiliar de Serviços Gerais', 2500, { asoEm: -40 }],
  ['Natália Gomes Ribeiro', 2, 'Agente de Desenvolvimento Infantil', 200, { afastadoHa: 60, tipo: 'Licença-maternidade', retornoEm: 60 }],
  ['Otávio Cunha Leal', 2, 'Menor Aprendiz', 90, {}],
  ['Paula Freire Monteiro', 3, 'Agente de Desenvolvimento Infantil', 1000, { asoEm: 25 }],
  ['Quitéria Alves Siqueira', 3, 'Auxiliar de Serviços Gerais', 1600, {}],
  ['Regina Castro Dias', 3, 'Professor(a) de Educação Infantil', 500, {}],
  ['Simone Borges Lacerda', 4, 'Agente de Desenvolvimento Infantil', 750, {}],
  ['Tânia Moreira Bastos', 4, 'Assistente Administrativo', 1400, { pcd: true }],
  ['Úrsula Pacheco Brito', 4, 'Professor(a) de Educação Infantil', 950, { asoEm: 4 }],
  ['Valéria Neves Torres', 4, 'Agente de Desenvolvimento Infantil', 350, {}],
  ['Wesley Rangel Farias', 5, 'Auxiliar de Serviços Gerais', 650, { inativaHa: 100 }],
  ['Yara Coutinho Lima', 5, 'Agente de Desenvolvimento Infantil', 1200, {}],
  ['Zilda Matos Ferraz', 5, 'Psicólogo(a)', 1700, {}],
  ['Aparecida Souto Reis', 6, 'Agente de Desenvolvimento Infantil', 850, {}],
  ['Bianca Vilela Campos', 6, 'Professor(a) de Educação Infantil', 450, { asoEm: -3 }],
  ['Cristina Peixoto Lins', 6, 'Auxiliar de Serviços Gerais', 1900, {}],
];

const SALARIOS = {
  'Agente de Desenvolvimento Infantil': 2090,
  'Professor(a) de Educação Infantil': 3150,
  'Professor(a) de Educação Especial': 3300,
  'Auxiliar de Serviços Gerais': 1780,
  'Auxiliar Administrativo': 2010,
  'Assistente Administrativo': 2450,
  'Coordenador(a) Pedagógico(a)': 4200,
  'Zelador(a)': 1850,
  'Psicólogo(a)': 3800,
  'Menor Aprendiz': 793,
};

/** Completa 9 dígitos com os 2 verificadores do CPF. */
const cpfDemo = (i) => {
  const base = `9${pad(i + 1)}${pad(i + 11)}${pad(i + 31)}${pad(i + 51)}`.slice(0, 9);
  const dv = (s) => {
    const r = (s.split('').reduce((t, n, k) => t + Number(n) * (s.length + 1 - k), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d = `${base}${d1}${dv(`${base}${d1}`)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

/** Completa 10 dígitos com o verificador do PIS. */
const pisDemo = (i) => {
  const base = `19${pad(i + 1)}${pad(i + 21)}${pad(i + 41)}${pad(i + 61)}`.slice(0, 10);
  const r = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2].reduce((t, p, k) => t + p * Number(base[k]), 0) % 11;
  const d = `${base}${r < 2 ? 0 : 11 - r}`;
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
};

const funcionarios = () => FUNCIONARIOS.map(([nome, e, cargo, admitidoHa, x], i) => {
  // Último ASO há ~10 meses; quem tem `asoEm` vence nesse número de dias (negativo = vencido).
  const vencAso = x.asoEm ?? 60 + ((i * 23) % 240);
  return {
    id: `demo-funcionario-${pad(i + 1)}`,
    nome,
    escolaId: idEscola(e),
    escolaNome: ESCOLAS[e].nome,
    cargo,
    situacao: x.inativaHa ? 'Inativa' : 'Ativa',
    pcd: !!x.pcd,
    dataNascimento: ymd(-(365 * (22 + ((i * 7) % 30)) + i * 11)),
    dataAdmissao: ymd(-admitidoHa),
    salario: SALARIOS[cargo] || 2000,
    cpf: cpfDemo(i),
    rg: `${pad(10 + i)}.${100 + i * 7}.${200 + i * 3}-${i % 10}`,
    pis: pisDemo(i),
    telefone: `(19) 99333-00${pad(i + 1)}`,
    endereco: `Rua Fictícia ${i + 1}, ${20 + i * 13}`,
    cidade: i % 4 === 3 ? 'Sumaré' : 'Hortolândia',
    dataUltimoAso: ymd(vencAso - 365),
    dataVencimentoAso: ymd(vencAso),
    afastamentoInicio: x.afastadoHa ? ymd(-x.afastadoHa) : '',
    afastamentoRetorno: x.afastadoHa && x.retornoEm ? ymd(x.retornoEm) : '',
    afastamentoTipo: x.tipo || '',
    dataRescisao: x.inativaHa ? ymd(-x.inativaHa) : '',
    observacoes: '',
    criadoEm: carimbo(-200),
    atualizadoEm: carimbo(-10),
  };
});

// Controle de saldo: período de 12 meses que começou há 3 meses, áreas com
// verba mensal e gastos inventados. Uma área passa do teto no mês atual e
// outra fica perto dele, para o painel ter o que mostrar.
const mesRelativo = (meses) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const periodoDoSaldo = () => [{ id: 'saldo', inicio: mesRelativo(-3), meses: 12, atualizadoEm: carimbo(-90) }];

// [nome, verba mensal]
const RUBRICAS = [
  ['Mobiliário', 6000],
  ['Material de Escritório', 1500],
  ['Brinquedos e Livros pedagógicos', 3000],
  ['Material de Higiene, Limpeza/uniforme', 9000],
  ['Material Pedagógico', 3000],
  ['Material de Informática', 2500],
  ['Enxoval', 1000],
  ['Manutenção de Mobiliário e Equipamentos', 2500],
  ['Manutenção civil, hidráulica, elétrica, pintura', 8300],
];
const idRubrica = (i) => `demo-rubrica-${pad(i + 1)}`;

const rubricas = () => RUBRICAS.map(([nome, verbaMensal], i) => ({
  id: idRubrica(i),
  nome,
  verbaMensal,
  observacao: '',
  criadoEm: carimbo(-95),
  atualizadoEm: carimbo(-95),
}));

// [área, meses em relação a hoje (0 = este mês), dia, fornecedor, NF, descrição, valor total, parcelas]
const GASTOS = [
  [8, -3, 8, 'Construtora Exemplo', '1021', 'Troca de calhas e rufos', 7400, 1],
  [8, -2, 14, 'Hidráulica Modelo', '553', 'Reparo da rede de esgoto', 12600, 2],
  [8, -1, 5, 'Pinturas Fictícias', '78', 'Pintura das salas do berçário', 9800, 1],
  [8, 0, 3, 'Elétrica Demonstração', '2290', 'Troca do quadro de distribuição', 14200, 1],
  [3, -3, 2, 'Distribuidora Limpa Bem', '4410', 'Material de limpeza do trimestre', 8100, 1],
  [3, -2, 1, 'Distribuidora Limpa Bem', '4502', 'Fraldas e lenços', 9300, 1],
  [3, -1, 3, 'Uniformes Exemplo', '311', 'Uniformes da equipe', 10800, 3],
  [3, 0, 2, 'Distribuidora Limpa Bem', '4688', 'Material de limpeza', 4200, 1],
  [0, -2, 20, 'Móveis Escolares Modelo', '9012', 'Mesas e cadeiras infantis', 18000, 3],
  [2, -1, 11, 'Livraria Exemplo', '880', 'Livros de histórias', 2600, 1],
  [2, 0, 6, 'Brinquedos Fictícios', '145', 'Brinquedos de encaixe', 2950, 1],
  [4, -3, 15, 'Papelaria Modelo', '3321', 'Tinta guache e papel', 2100, 1],
  [4, -1, 19, 'Papelaria Modelo', '3460', 'Massinha e pincéis', 1750, 1],
  [5, -2, 9, 'Informática Exemplo', '77', 'Notebook da secretaria', 6900, 3],
  [1, -1, 7, 'Papelaria Modelo', '3502', 'Papel sulfite e toner', 980, 1],
  [6, -3, 25, 'Enxovais Demonstração', '204', 'Lençóis e toalhas', 2400, 1],
  [7, -1, 22, 'Manutenção Exemplo', '61', 'Conserto da geladeira', 1350, 1],
];

const gastos = () => GASTOS.map(([r, meses, diaDoMes, fornecedor, notaFiscal, descricao, valorTotal, parcelas], i) => {
  const mes = mesRelativo(meses);
  return {
    id: `demo-gasto-${pad(i + 1)}`,
    data: `${mes}-${pad(diaDoMes)}`,
    fornecedor,
    notaFiscal,
    descricao,
    rubricaId: idRubrica(r),
    rubricaNome: RUBRICAS[r][0],
    valorTotal,
    parcelas,
    primeiraParcela: mes,
    observacao: '',
    criadoEm: carimbo(meses * 30),
    atualizadoEm: carimbo(meses * 30),
  };
});

/**
 * Tudo o que entra no ambiente de demonstração, por coleção.
 * Cada registro traz o `id` do documento; o resto são os campos.
 */
export function gerarDadosDemo() {
  return {
    escolas: escolas(),
    prestadores: prestadores(),
    manutencoes: manutencoes(),
    contas: contas(),
    ciclos: ciclos(),
    eventos: eventos(),
    curriculos: curriculos(),
    funcionarios: funcionarios(),
    rubricas: rubricas(),
    gastos: gastos(),
    // config/saldo: o período do controle de saldo.
    config: periodoDoSaldo(),
  };
}
