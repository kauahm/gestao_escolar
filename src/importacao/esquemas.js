// O que cada módulo aceita numa importação de planilha: colunas, nomes
// alternativos de cabeçalho, campos obrigatórios, conversões e como
// reconhecer um registro repetido.
//
// converter(linha, contexto) recebe { chaveDoCampo: valorDaCélula } e devolve
// { dados, erros: [], avisos: [] }. Linha com erro não é importada; linha com
// aviso é importada e o aviso aparece no relatório.

import * as n from './normalizar.js';

// ------------------------------------------------------------------ escola ----

/**
 * Acha a escola pelo código ou pelo nome (sem diferenciar acentos e maiúsculas).
 * Se só houver uma escola cujo nome contenha o texto (ou o contrário), usa e avisa.
 */
export const acharEscola = (valor, escolas) => {
  const k = n.chave(valor);
  if (!k) return { erro: 'escola não informada' };
  const inativa = (e) => ({ erro: `a escola "${e.nome}" está inativa (reative no cadastro de Escolas para lançar)` });
  const exata = escolas.find((e) => n.chave(e.codigo) === k || n.chave(e.nome) === k);
  if (exata) return exata.situacao === 'Inativa' ? inativa(exata) : { escola: exata };
  const parecidas = escolas.filter((e) => {
    const nome = n.chave(e.nome);
    return nome && (nome.includes(k) || k.includes(nome));
  });
  if (parecidas.length === 1) {
    if (parecidas[0].situacao === 'Inativa') return inativa(parecidas[0]);
    return { escola: parecidas[0], aviso: `escola "${valor}" associada a "${parecidas[0].nome}"` };
  }
  if (parecidas.length > 1) return { erro: `escola "${valor}" é ambígua (${parecidas.map((e) => e.nome).join(', ')})` };
  return { erro: `escola "${valor}" não encontrada no cadastro` };
};

// ---------------------------------------------------------------- utilidades ----

const novoResultado = () => ({ dados: {}, erros: [], avisos: [] });

/** Aplica uma conversão de normalizar.js e acumula erro/aviso com o nome da coluna. */
const aplicar = (r, campo, rotulo, conversao, valor) => {
  const saida = conversao(valor);
  if (saida.erro) r.erros.push(`${rotulo}: ${saida.erro}`);
  if (saida.aviso) r.avisos.push(`${rotulo}: ${saida.aviso}`);
  if (!saida.erro) r.dados[campo] = saida.valor;
  return saida;
};

const exigir = (r, campo, rotulo) => {
  if (n.vazio(r.dados[campo])) r.erros.push(`${rotulo} é obrigatório`);
};

const comEscola = (r, valor, contexto) => {
  const achado = acharEscola(valor, contexto.escolas || []);
  if (achado.erro) { r.erros.push(achado.erro); return; }
  if (achado.aviso) r.avisos.push(achado.aviso);
  r.dados.escolaId = achado.escola.id;
  r.dados.escolaNome = achado.escola.nome;
};

// ------------------------------------------------------------------ escolas ----

const escolas = {
  id: 'escolas',
  colecao: 'escolas',
  titulo: 'Escolas',
  nomeDoRegistro: 'escola',
  campos: [
    { chave: 'nome', rotulo: 'Nome da escola', obrigatorio: true, exemplo: 'CEI Pequenos Passos', sinonimos: ['nome', 'escola', 'unidade', 'nome da unidade', 'unidade escolar', 'cei', 'emei', 'creche'] },
    { chave: 'codigo', rotulo: 'Código', exemplo: 'UE-01', sinonimos: ['codigo da unidade', 'cod', 'codigo da escola', 'ue', 'inep'] },
    { chave: 'situacao', rotulo: 'Situação', exemplo: 'Ativa', ajuda: 'Ativa ou Inativa. Em branco = Ativa.', sinonimos: ['status', 'ativa'] },
    { chave: 'endereco', rotulo: 'Endereço', exemplo: 'Rua das Flores, 100', sinonimos: ['endereco completo', 'logradouro', 'rua'] },
    { chave: 'bairro', rotulo: 'Bairro', exemplo: 'Jardim Amanda', sinonimos: [] },
    { chave: 'cep', rotulo: 'CEP', exemplo: '13180-000', sinonimos: [] },
    { chave: 'telefone', rotulo: 'Telefone', exemplo: '(19) 3800-0000', sinonimos: ['telefone da escola', 'fone', 'tel'] },
    { chave: 'email', rotulo: 'E-mail', exemplo: 'escola@exemplo.org', sinonimos: ['email da escola', 'e mail'] },
    { chave: 'nomeDiretora', rotulo: 'Diretora', exemplo: 'Maria da Silva', sinonimos: ['nome da diretora', 'diretor', 'diretora responsavel', 'responsavel'] },
    { chave: 'celularDiretora', rotulo: 'Celular da diretora', exemplo: '(19) 99999-0000', sinonimos: ['whatsapp da diretora', 'celular', 'whatsapp', 'telefone da diretora'] },
    { chave: 'emailDiretora', rotulo: 'E-mail da diretora', exemplo: 'diretora@exemplo.org', sinonimos: ['email diretora'] },
    { chave: 'numeroAlunos', rotulo: 'Nº de alunos', exemplo: 150, sinonimos: ['alunos', 'numero de alunos', 'quantidade de alunos', 'qtd alunos', 'matriculas'] },
    { chave: 'capacidadeCaixaDagua', rotulo: "Caixa d'água (litros)", exemplo: 3000, sinonimos: ['caixa dagua', 'capacidade da caixa dagua', 'caixa d agua', 'litros'] },
    { chave: 'observacoes', rotulo: 'Observações', exemplo: '', sinonimos: ['obs', 'observacao'] },
  ],
  converter(linha) {
    const r = novoResultado();
    r.dados.nome = n.texto(linha.nome);
    exigir(r, 'nome', 'Nome da escola');
    r.dados.codigo = n.texto(linha.codigo);
    const situacao = n.simNao(linha.situacao);
    if (situacao.erro) r.erros.push('Situação: use Ativa ou Inativa');
    else r.dados.situacao = situacao.valor === false ? 'Inativa' : 'Ativa';
    r.dados.endereco = n.texto(linha.endereco);
    r.dados.bairro = n.texto(linha.bairro);
    aplicar(r, 'cep', 'CEP', n.cep, linha.cep);
    aplicar(r, 'telefone', 'Telefone', n.telefone, linha.telefone);
    aplicar(r, 'email', 'E-mail', n.email, linha.email);
    r.dados.nomeDiretora = n.texto(linha.nomeDiretora);
    aplicar(r, 'celularDiretora', 'Celular da diretora', n.telefone, linha.celularDiretora);
    aplicar(r, 'emailDiretora', 'E-mail da diretora', n.email, linha.emailDiretora);
    aplicar(r, 'numeroAlunos', 'Nº de alunos', n.inteiro, linha.numeroAlunos);
    aplicar(r, 'capacidadeCaixaDagua', "Caixa d'água", n.inteiro, linha.capacidadeCaixaDagua);
    r.dados.numeroAlunos = r.dados.numeroAlunos ?? 0;
    r.dados.capacidadeCaixaDagua = r.dados.capacidadeCaixaDagua ?? 0;
    r.dados.observacoes = n.texto(linha.observacoes);
    if (!r.dados.endereco) r.avisos.push('sem endereço (complete depois na tela de Escolas)');
    if (!r.dados.bairro) r.avisos.push('sem bairro');
    if (!r.dados.nomeDiretora) r.avisos.push('sem diretora');
    return r;
  },
  // Mesma escola = mesmo nome ou mesmo código.
  chavesDeDuplicidade: (d) => [d.nome && `nome:${n.chave(d.nome)}`, d.codigo && `codigo:${n.chave(d.codigo)}`].filter(Boolean),
  resumo: (d) => [d.nome, d.bairro].filter(Boolean).join(' · '),
  carimbos: (agora) => ({ criadoEm: agora, atualizadoEm: agora }),
};

// ------------------------------------------------------------------ contas ----

const TIPOS_DE_CONTA = [
  ['CPFL', ['cpfl', 'energia', 'luz', 'energia eletrica', 'conta de luz', 'conta de energia']],
  ['SABESP', ['sabesp', 'agua', 'agua e esgoto', 'conta de agua']],
  ['Taxa de Limpeza', ['taxa de limpeza', 'limpeza', 'taxa limpeza']],
  ['Nota Fiscal de Serviço', ['nota fiscal de servico', 'nota fiscal', 'nf', 'nfs', 'nfse', 'nfs e', 'nf de servico']],
  ['Outro', ['outro', 'outros']],
];

const tipoDeConta = (valor) => {
  const k = n.chave(valor);
  const achado = TIPOS_DE_CONTA.find(([, sinonimos]) => sinonimos.includes(k));
  if (achado) return { tipo: achado[0], tipoCustomizado: '' };
  return { tipo: 'Outro', tipoCustomizado: n.texto(valor) };
};

const contas = {
  id: 'contas',
  colecao: 'contas',
  titulo: 'Contas a pagar',
  nomeDoRegistro: 'conta',
  precisaDeEscolas: true,
  campos: [
    { chave: 'escola', rotulo: 'Escola', obrigatorio: true, exemplo: 'CEI Pequenos Passos', ajuda: 'Nome ou código da escola, igual ao cadastro.', sinonimos: ['unidade', 'nome da escola', 'escola unidade', 'codigo da escola'] },
    { chave: 'tipo', rotulo: 'Tipo', obrigatorio: true, exemplo: 'CPFL', ajuda: 'CPFL, SABESP, Taxa de Limpeza, Nota Fiscal de Serviço ou outro texto.', sinonimos: ['tipo de conta', 'conta', 'despesa', 'fornecedor'] },
    { chave: 'competencia', rotulo: 'Competência', obrigatorio: true, exemplo: '10/2026', ajuda: 'Mês/ano: 10/2026, out/2026 ou Outubro/2026.', sinonimos: ['mes', 'mes de referencia', 'referencia', 'mes ano'] },
    { chave: 'valor', rotulo: 'Valor (R$)', obrigatorio: true, exemplo: '1.234,56', sinonimos: ['valor', 'valor total', 'total', 'valor r'] },
    { chave: 'vencimento', rotulo: 'Vencimento', obrigatorio: true, exemplo: '15/11/2026', ajuda: 'Dia/mês/ano.', sinonimos: ['data de vencimento', 'vence em', 'data vencimento', 'venc'] },
    { chave: 'numeroDocumento', rotulo: 'Nº do documento', exemplo: '123456', sinonimos: ['numero do documento', 'documento', 'nf', 'numero da nf', 'boleto', 'numero', 'instalacao'] },
    { chave: 'status', rotulo: 'Status', exemplo: 'A enviar', ajuda: '"Enviada" ou "A enviar". Em branco = A enviar.', sinonimos: ['situacao', 'enviada'] },
    { chave: 'observacoes', rotulo: 'Observações', exemplo: '', sinonimos: ['obs', 'observacao'] },
  ],
  converter(linha, contexto) {
    const r = novoResultado();
    comEscola(r, linha.escola, contexto);
    if (n.vazio(linha.tipo)) r.erros.push('Tipo é obrigatório');
    else {
      const t = tipoDeConta(linha.tipo);
      r.dados.tipo = t.tipo;
      r.dados.tipoCustomizado = t.tipoCustomizado;
      if (t.tipo === 'Outro' && t.tipoCustomizado) r.avisos.push(`tipo "${t.tipoCustomizado}" cadastrado como Outro`);
      if (t.tipo === 'Outro' && !t.tipoCustomizado) r.erros.push('Tipo "Outro" precisa dizer qual é a conta');
    }
    aplicar(r, 'competencia', 'Competência', n.competencia, linha.competencia);
    exigir(r, 'competencia', 'Competência');
    const valor = aplicar(r, 'valor', 'Valor', n.dinheiro, linha.valor);
    if (!valor.erro && (valor.valor === null || valor.valor <= 0)) r.erros.push('Valor precisa ser maior que zero');
    aplicar(r, 'vencimento', 'Vencimento', n.data, linha.vencimento);
    if (!r.erros.some((e) => e.startsWith('Vencimento'))) exigir(r, 'vencimento', 'Vencimento');
    r.dados.numeroDocumento = n.texto(linha.numeroDocumento);
    const status = n.chave(linha.status);
    r.dados.status = ['enviada', 'enviado', 'paga', 'pago', 'sim', 'quitada'].includes(status) ? 'Enviada' : 'A enviar';
    r.dados.observacoes = n.texto(linha.observacoes);
    return r;
  },
  // Mesma conta = mesma escola, tipo e competência, e mesmo documento (ou mesmo valor, sem documento).
  chavesDeDuplicidade: (d) => [
    `${d.escolaId}|${n.chave(d.tipo === 'Outro' ? d.tipoCustomizado : d.tipo)}|${n.chave(d.competencia)}|${d.numeroDocumento ? `doc:${n.chave(d.numeroDocumento)}` : `valor:${d.valor}`}`,
  ],
  resumo: (d) => [d.escolaNome, d.tipo === 'Outro' ? d.tipoCustomizado : d.tipo, d.competencia].filter(Boolean).join(' · '),
  carimbos: (agora) => ({ criadoEm: agora, atualizadoEm: agora }),
};

// ------------------------------------------------------------------ ciclos ----

export const CICLOS_PADRAO = {
  "Limpeza de caixa d'água": 180,
  'Inspeção de DR e DS': 365,
  'Troca/recarga de extintores': 365,
  'Troca de filtros de água': 90,
};

const tipoDeCiclo = (valor) => {
  const k = ` ${n.chave(valor)} `;
  if (k.includes('caixa')) return "Limpeza de caixa d'água";
  if (k.includes('extint')) return 'Troca/recarga de extintores';
  if (k.includes('filtro')) return 'Troca de filtros de água';
  if (/ (dr|ds|idr) /.test(k) || k.includes('diferencial') || k.includes('inspecao')) return 'Inspeção de DR e DS';
  return null;
};

const ciclos = {
  id: 'ciclos',
  colecao: 'ciclos',
  titulo: 'Ciclos',
  nomeDoRegistro: 'ciclo',
  precisaDeEscolas: true,
  campos: [
    { chave: 'escola', rotulo: 'Escola', obrigatorio: true, exemplo: 'CEI Pequenos Passos', ajuda: 'Nome ou código da escola, igual ao cadastro.', sinonimos: ['unidade', 'nome da escola', 'codigo da escola'] },
    { chave: 'tipo', rotulo: 'Tipo de ciclo', obrigatorio: true, exemplo: "Limpeza de caixa d'água", ajuda: "Caixa d'água, DR e DS, extintores ou filtros.", sinonimos: ['tipo', 'servico', 'ciclo', 'manutencao preventiva'] },
    { chave: 'ultimaExecucao', rotulo: 'Última execução', obrigatorio: true, exemplo: '15/04/2026', ajuda: 'Dia/mês/ano da última vez que o serviço foi feito.', sinonimos: ['ultima execucao', 'data da ultima execucao', 'ultima', 'data', 'realizado em', 'executado em'] },
    { chave: 'periodicidadeDias', rotulo: 'Periodicidade (dias)', exemplo: 180, ajuda: 'Em branco = padrão do tipo (180, 365 ou 90 dias).', sinonimos: ['periodicidade', 'intervalo', 'dias', 'frequencia'] },
    { chave: 'observacoes', rotulo: 'Observações', exemplo: '', sinonimos: ['obs', 'observacao'] },
  ],
  converter(linha, contexto) {
    const r = novoResultado();
    comEscola(r, linha.escola, contexto);
    if (n.vazio(linha.tipo)) r.erros.push('Tipo de ciclo é obrigatório');
    else {
      const tipo = tipoDeCiclo(linha.tipo);
      if (!tipo) r.erros.push(`tipo de ciclo "${linha.tipo}" desconhecido (use: ${Object.keys(CICLOS_PADRAO).join('; ')})`);
      else r.dados.tipo = tipo;
    }
    aplicar(r, 'ultimaExecucao', 'Última execução', n.data, linha.ultimaExecucao);
    if (!r.erros.some((e) => e.startsWith('Última execução'))) exigir(r, 'ultimaExecucao', 'Última execução');
    const per = aplicar(r, 'periodicidadeDias', 'Periodicidade', n.inteiro, linha.periodicidadeDias);
    if (!per.erro) {
      if (r.dados.periodicidadeDias == null) r.dados.periodicidadeDias = CICLOS_PADRAO[r.dados.tipo] ?? null;
      if (r.dados.tipo && (!r.dados.periodicidadeDias || r.dados.periodicidadeDias <= 0)) r.erros.push('Periodicidade precisa ser maior que zero');
    }
    if (r.dados.ultimaExecucao && r.dados.periodicidadeDias > 0) {
      r.dados.proximaExecucao = n.somarDias(r.dados.ultimaExecucao, r.dados.periodicidadeDias);
    }
    r.dados.observacoes = n.texto(linha.observacoes);
    return r;
  },
  // Um ciclo de cada tipo por escola.
  chavesDeDuplicidade: (d) => [`${d.escolaId}|${d.tipo}`],
  resumo: (d) => [d.escolaNome, d.tipo].filter(Boolean).join(' · '),
  carimbos: (agora) => ({ criadoEm: agora, atualizadoEm: agora }),
};

// --------------------------------------------------------------- currículos ----

const curriculos = {
  id: 'curriculos',
  colecao: 'curriculos',
  titulo: 'Banco de Talentos',
  nomeDoRegistro: 'currículo',
  campos: [
    { chave: 'nome', rotulo: 'Nome', obrigatorio: true, exemplo: 'Ana Souza', sinonimos: ['nome completo', 'candidato', 'candidata', 'nome do candidato'] },
    { chave: 'telefone', rotulo: 'Telefone', obrigatorio: true, exemplo: '(19) 99999-0000', sinonimos: ['celular', 'whatsapp', 'fone', 'contato'] },
    { chave: 'email', rotulo: 'E-mail', exemplo: 'ana@exemplo.org', sinonimos: ['e mail'] },
    { chave: 'vaga', rotulo: 'Vaga pretendida', obrigatorio: true, exemplo: 'Auxiliar de educação infantil', sinonimos: ['vaga', 'cargo', 'funcao', 'cargo pretendido', 'area'] },
    { chave: 'exp', rotulo: 'Tem experiência?', exemplo: 'Sim', ajuda: 'Sim ou Não. Em branco = Não.', sinonimos: ['experiencia', 'possui experiencia', 'exp'] },
    { chave: 'indicacao', rotulo: 'Indicação', exemplo: '', sinonimos: ['indicado por', 'quem indicou'] },
    { chave: 'observacoes', rotulo: 'Observações', exemplo: '', sinonimos: ['obs', 'observacao'] },
  ],
  converter(linha) {
    const r = novoResultado();
    r.dados.nome = n.texto(linha.nome);
    exigir(r, 'nome', 'Nome');
    aplicar(r, 'telefone', 'Telefone', n.telefone, linha.telefone);
    exigir(r, 'telefone', 'Telefone');
    aplicar(r, 'email', 'E-mail', n.email, linha.email);
    r.dados.vaga = n.texto(linha.vaga);
    exigir(r, 'vaga', 'Vaga pretendida');
    const exp = n.simNao(linha.exp);
    if (exp.erro) r.erros.push('Tem experiência?: use Sim ou Não');
    else r.dados.exp = exp.valor ? 'Sim' : 'Não';
    r.dados.indicacao = n.texto(linha.indicacao);
    r.dados.observacoes = n.texto(linha.observacoes);
    r.dados.status = 'Disponível';
    return r;
  },
  // Mesma pessoa = mesmo telefone ou mesmo e-mail.
  chavesDeDuplicidade: (d) => {
    const digitos = String(d.telefone || '').replace(/\D/g, '');
    return [digitos.length >= 10 && `tel:${digitos}`, d.email && `email:${d.email.toLowerCase()}`].filter(Boolean);
  },
  resumo: (d) => [d.nome, d.vaga].filter(Boolean).join(' · '),
  carimbos: (agora) => ({ dataCadastro: agora }),
};

export const ESQUEMAS = { escolas, contas, ciclos, curriculos };
