// Cópia de segurança: baixa tudo do sistema em Excel (para ler) e em JSON
// (cópia fiel, que permite reconstruir os dados se um dia for preciso).

import { collection, getDocs, doc, setDoc as fbSetDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { gerarXlsx } from './planilhaXlsx';
import { situacaoConta } from './calcularStatus';

/** Coleções do sistema, na ordem das abas do Excel. */
export const COLECOES = [
  { id: 'escolas', rotulo: 'Escolas' },
  { id: 'manutencoes', rotulo: 'Manutenções' },
  { id: 'prestadores', rotulo: 'Prestadores' },
  { id: 'contas', rotulo: 'Contas a pagar' },
  { id: 'ciclos', rotulo: 'Ciclos' },
  { id: 'eventos', rotulo: 'Agenda' },
  { id: 'curriculos', rotulo: 'Currículos' },
  { id: 'funcionarios', rotulo: 'Funcionários' },
  { id: 'usuarios', rotulo: 'Usuários' },
];

/** Coleções que entram só no JSON (registro interno). */
const COLECOES_INTERNAS = [
  { id: 'lixeira', rotulo: 'Lixeira' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'importacoes', rotulo: 'Importações' },
];

export const rotuloDaColecao = (id) =>
  [...COLECOES, ...COLECOES_INTERNAS].find((c) => c.id === id)?.rotulo || id;

// Nomes amigáveis para as colunas mais comuns.
const ROTULOS = {
  nome: 'Nome',
  codigo: 'Código',
  bairro: 'Bairro',
  endereco: 'Endereço',
  telefone: 'Telefone',
  email: 'E-mail',
  situacao: 'Situação',
  escolaNome: 'Unidade',
  unidadeNome: 'Unidade',
  tipo: 'Tipo',
  tipoCustomizado: 'Tipo (outro)',
  competencia: 'Competência',
  valor: 'Valor (R$)',
  vencimento: 'Vencimento',
  numeroDocumento: 'Nº do documento',
  status: 'Status',
  observacoes: 'Observações',
  descricao: 'Descrição',
  localDentroEscola: 'Local na escola',
  prioridade: 'Prioridade',
  responsavel: 'Responsável',
  solicitadaPorNome: 'Solicitado por',
  periodicidadeDias: 'Periodicidade (dias)',
  proximaExecucao: 'Próxima execução',
  ultimaExecucao: 'Última execução',
  titulo: 'Título',
  inicio: 'Início',
  fim: 'Fim',
  diaInteiro: 'Dia inteiro',
  categoria: 'Categoria',
  perfil: 'Perfil',
  cargo: 'Cargo',
  dataEntrevista: 'Data da entrevista',
  horaEntrevista: 'Hora da entrevista',
  feedback: 'Feedback',
  dataNascimento: 'Data de nasc.',
  pcd: 'PCD',
  dataAdmissao: 'Admissão',
  salario: 'Salário (R$)',
  cpf: 'CPF',
  rg: 'RG',
  pis: 'PIS',
  cidade: 'Cidade',
  dataUltimoAso: 'Data último ASO',
  dataVencimentoAso: 'Data venc. ASO',
  afastamentoInicio: 'Data início afast.',
  afastamentoRetorno: 'Data retorno afast.',
  afastamentoTipo: 'Tipo de afastamento',
  dataRescisao: 'Data de rescisão',
  criadoEm: 'Criado em',
  atualizadoEm: 'Atualizado em',
};

// Colunas que não ajudam a ler a planilha (identificadores internos).
const OCULTAS_NO_EXCEL = new Set(['escolaId', 'unidadeId', 'solicitadaPor', 'criadoPor', 'uid', 'importacaoId']);

const rotuloDaColuna = (chave) =>
  ROTULOS[chave] ||
  chave
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

const pad = (n) => String(n).padStart(2, '0');

const ehTimestamp = (v) => v && typeof v === 'object' && typeof v.toDate === 'function';

/** Valor de uma célula do Excel, legível para uma pessoa. */
const paraCelula = (v) => {
  if (v === null || v === undefined) return '';
  if (ehTimestamp(v)) {
    const d = v.toDate();
    const temHora = d.getHours() || d.getMinutes();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}${temHora ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''}`;
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split('-');
    return `${d}/${m}/${a}`;
  }
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
};

/** Valor para o JSON, preservando o tipo (datas do Firebase viram marcação). */
const paraJson = (v) => {
  if (ehTimestamp(v)) return { __tipo: 'timestamp', iso: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(paraJson);
  if (v && typeof v === 'object') {
    const o = {};
    Object.entries(v).forEach(([k, x]) => { o[k] = paraJson(x); });
    return o;
  }
  return v;
};

/** Desfaz a marcação do JSON (para uma futura restauração a partir do arquivo). */
export const deJson = (v) => {
  if (v && typeof v === 'object' && v.__tipo === 'timestamp') return Timestamp.fromDate(new Date(v.iso));
  if (Array.isArray(v)) return v.map(deJson);
  if (v && typeof v === 'object') {
    const o = {};
    Object.entries(v).forEach(([k, x]) => { o[k] = deJson(x); });
    return o;
  }
  return v;
};

const lerColecao = async (id) => {
  try {
    const snap = await getDocs(collection(db, id));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (erro) {
    // Sem permissão ou coleção inexistente: segue com as outras.
    console.warn(`[exportar] não foi possível ler "${id}":`, erro?.code || erro);
    return null;
  }
};

const abaDaColecao = (rotulo, registros) => {
  const chaves = [];
  const vistas = new Set();
  // Colunas conhecidas primeiro, na ordem de ROTULOS; depois o resto.
  Object.keys(ROTULOS).forEach((k) => {
    if (registros.some((r) => r[k] !== undefined)) { chaves.push(k); vistas.add(k); }
  });
  registros.forEach((r) => Object.keys(r).forEach((k) => {
    if (k === 'id' || vistas.has(k) || OCULTAS_NO_EXCEL.has(k)) return;
    vistas.add(k);
    chaves.push(k);
  }));
  // "Criado/Atualizado em" e o identificador interno vão para o fim.
  const fim = ['criadoEm', 'atualizadoEm'].filter((k) => vistas.has(k));
  const meio = chaves.filter((k) => !fim.includes(k));
  const ordem = [...meio, ...fim];

  return {
    nome: rotulo,
    colunas: [...ordem.map(rotuloDaColuna), 'ID (sistema)'],
    linhas: registros.map((r) => [...ordem.map((k) => paraCelula(r[k])), r.id]),
  };
};

const carimbo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
};

const baixar = (blob, nomeArquivo) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Marca no banco quando foi feita a última cópia (aparece no painel). */
const registrarCopia = async (formato, totais) => {
  try {
    await fbSetDoc(doc(db, 'config', 'backup'), {
      ultimoEm: serverTimestamp(),
      formato,
      totais,
      porUid: auth.currentUser?.uid || null,
      porEmail: auth.currentUser?.email || null,
    });
  } catch (erro) {
    console.warn('[exportar] não foi possível registrar a data da cópia:', erro?.code || erro);
  }
};

/**
 * Baixa a planilha completa. Retorna um resumo { totais, falhas }.
 */
export async function baixarExcel() {
  const abas = [];
  const totais = {};
  const falhas = [];

  for (const c of COLECOES) {
    const registros = await lerColecao(c.id);
    if (registros === null) { falhas.push(c.rotulo); continue; }
    totais[c.id] = registros.length;
    // Em contas, a planilha mostra a situação real (Vencida é calculada, não gravada).
    const legiveis = c.id === 'contas'
      ? registros.map((r) => ({ ...r, status: situacaoConta(r).rotulo }))
      : registros;
    abas.push(abaDaColecao(c.rotulo, legiveis));
  }

  baixar(gerarXlsx(abas), `gestao-escolar_copia_${carimbo()}.xlsx`);
  await registrarCopia('xlsx', totais);
  return { totais, falhas };
}

/**
 * Baixa a cópia fiel em JSON (inclui lixeira e histórico).
 */
export async function baixarJson() {
  const colecoes = {};
  const totais = {};
  const falhas = [];

  for (const c of [...COLECOES, ...COLECOES_INTERNAS]) {
    const registros = await lerColecao(c.id);
    if (registros === null) { falhas.push(c.rotulo); continue; }
    totais[c.id] = registros.length;
    colecoes[c.id] = registros.map(paraJson);
  }

  const conteudo = {
    sistema: 'Gestão Escolar',
    formato: 'copia-de-seguranca',
    versao: 1,
    geradoEm: new Date().toISOString(),
    geradoPor: auth.currentUser?.email || null,
    totais,
    colecoes,
  };

  baixar(
    new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' }),
    `gestao-escolar_copia_${carimbo()}.json`
  );
  await registrarCopia('json', totais);
  return { totais, falhas };
}

// Exportado para testes.
export const _interno = { abaDaColecao, paraCelula, paraJson };
