// Leitor de planilhas (.xlsx e .csv) sem bibliotecas externas.
//
// Um .xlsx é um arquivo ZIP com XMLs dentro. Aqui abrimos o ZIP (o próprio
// navegador descompacta, com DecompressionStream), lemos os XMLs das abas e
// devolvemos as linhas como listas de valores. É o par do gerador
// planilhaXlsx.js.
//
// Uso:
//   const { abas } = await lerPlanilha(arquivo);   // arquivo = File do <input>
//   abas[0].linhas  // [['Nome', 'Bairro'], ['CEI A', 'Centro'], ...]
//
// Valores devolvidos: texto, número, verdadeiro/falso ou Date (para células
// formatadas como data no Excel). Células vazias viram ''.

const decoderUtf8 = new TextDecoder('utf-8');

export class ErroDePlanilha extends Error {}

// ------------------------------------------------------------------ ZIP ----

const lerU16 = (b, i) => b[i] | (b[i + 1] << 8);
const lerU32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Lista os arquivos de um ZIP: { nome -> função que devolve os bytes }. */
const abrirZip = (bytes) => {
  // O "fim do diretório central" fica nos últimos 22 bytes (+ comentário opcional).
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (lerU32(bytes, i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new ErroDePlanilha('O arquivo não parece ser uma planilha .xlsx válida.');

  const total = lerU16(bytes, fim + 10);
  let p = lerU32(bytes, fim + 16);
  const arquivos = new Map();

  for (let n = 0; n < total; n++) {
    if (lerU32(bytes, p) !== 0x02014b50) throw new ErroDePlanilha('A planilha está corrompida (índice do ZIP inválido).');
    const metodo = lerU16(bytes, p + 10);
    const tamanhoCompactado = lerU32(bytes, p + 20);
    const tamanhoNome = lerU16(bytes, p + 28);
    const tamanhoExtra = lerU16(bytes, p + 30);
    const tamanhoComentario = lerU16(bytes, p + 32);
    const inicioLocal = lerU32(bytes, p + 42);
    const nome = decoderUtf8.decode(bytes.subarray(p + 46, p + 46 + tamanhoNome));

    arquivos.set(nome, async () => {
      const inicioDados = inicioLocal + 30 + lerU16(bytes, inicioLocal + 26) + lerU16(bytes, inicioLocal + 28);
      const dados = bytes.subarray(inicioDados, inicioDados + tamanhoCompactado);
      if (metodo === 0) return dados;
      if (metodo === 8) return descompactar(dados);
      throw new ErroDePlanilha('A planilha usa um tipo de compactação que não é suportado. Salve de novo como .xlsx.');
    });

    p += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  return arquivos;
};

const descompactar = async (dados) => {
  const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
};

// ------------------------------------------------------------------ XML ----
// Os XMLs do Excel têm estrutura conhecida e simples; um leitor por
// expressões regulares é suficiente e funciona igual no navegador e no Node.
// O prefixo opcional `(?:\w+:)?` cobre arquivos que usam namespace explícito.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodificarXml = (texto) =>
  texto.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') {
      const codigo = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(codigo);
    }
    return ENTIDADES[e.toLowerCase()];
  });

const atributos = (tag) => {
  const saida = {};
  tag.replace(/([\w:]+)\s*=\s*"([^"]*)"/g, (_, nome, valor) => {
    saida[nome.replace(/^\w+:/, '')] = decodificarXml(valor);
    return '';
  });
  tag.replace(/([\w:]+)\s*=\s*'([^']*)'/g, (_, nome, valor) => {
    saida[nome.replace(/^\w+:/, '')] = decodificarXml(valor);
    return '';
  });
  return saida;
};

/** Junta todo o texto dos <t> de um trecho (ignora a fonética <rPh>). */
const textoDosT = (trecho) => {
  const semFonetica = trecho.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
  let texto = '';
  semFonetica.replace(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g, (_, conteudo) => {
    texto += conteudo ? decodificarXml(conteudo) : '';
    return '';
  });
  return texto;
};

const textosCompartilhados = (xml) => {
  const lista = [];
  if (!xml) return lista;
  xml.replace(/<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g, (_, conteudo) => {
    lista.push(conteudo ? textoDosT(conteudo) : '');
    return '';
  });
  return lista;
};

// ---------------------------------------------------------------- datas ----

// Formatos internos do Excel que são datas/horas.
const FORMATOS_DE_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

const codigoEhData = (codigo) => {
  const limpo = codigo
    .replace(/"[^"]*"/g, '')      // textos entre aspas
    .replace(/\[[^\]]*\]/g, '')   // cores e condições: [Red], [$-416]
    .replace(/\\./g, '');         // caracteres escapados
  return /[dmyhs]/i.test(limpo) && !/^[#0.,%\s]*$/.test(limpo);
};

/** Índices de estilo (atributo s da célula) que formatam a célula como data. */
const estilosDeData = (xml) => {
  const resultado = new Set();
  if (!xml) return resultado;
  const personalizados = new Map();
  xml.replace(/<(?:\w+:)?numFmt\b[^>]*>/g, (tag) => {
    const a = atributos(tag);
    personalizados.set(Number(a.numFmtId), a.formatCode || '');
    return '';
  });
  const bloco = xml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (!bloco) return resultado;
  let indice = 0;
  bloco[1].replace(/<(?:\w+:)?xf\b[^>]*>/g, (tag) => {
    const id = Number(atributos(tag).numFmtId || 0);
    const ehData = personalizados.has(id) ? codigoEhData(personalizados.get(id)) : FORMATOS_DE_DATA.has(id);
    if (ehData) resultado.add(indice);
    indice += 1;
    return '';
  });
  return resultado;
};

/** Número de série do Excel -> Date local (sem deslocamento de fuso). */
const serialParaData = (serial, sistema1904) => {
  const dias = Math.floor(serial);
  const segundos = Math.round((serial - dias) * 86400);
  const base = sistema1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const utc = new Date(base + dias * 86400000);
  return new Date(
    utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(),
    Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60
  );
};

// ---------------------------------------------------------------- abas ----

const indiceDaColuna = (referencia) => {
  const letras = (referencia.match(/^[A-Z]+/i) || [''])[0].toUpperCase();
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
};

const lerAba = (xml, compartilhados, datas, sistema1904) => {
  const linhas = [];
  const corpo = xml.match(/<(?:\w+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/);
  if (!corpo) return linhas;

  let proximaLinha = 0;
  corpo[1].replace(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g, (_, attrsLinha, conteudoLinha) => {
    const aLinha = atributos(attrsLinha);
    const numero = aLinha.r ? Number(aLinha.r) - 1 : proximaLinha;
    proximaLinha = numero + 1;
    const valores = [];
    let proximaColuna = 0;

    (conteudoLinha || '').replace(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g, (__, attrsCelula, conteudo) => {
      const a = atributos(attrsCelula);
      const coluna = a.r ? indiceDaColuna(a.r) : proximaColuna;
      proximaColuna = coluna + 1;
      const v = (conteudo || '').match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/);
      const bruto = v ? decodificarXml(v[1]) : '';
      let valor = '';

      switch (a.t) {
        case 's': valor = compartilhados[Number(bruto)] ?? ''; break;
        case 'inlineStr': valor = textoDosT(conteudo || ''); break;
        case 'str': valor = bruto; break;
        case 'b': valor = bruto === '1'; break;
        case 'e': valor = ''; break; // erro de fórmula (#N/D etc.)
        case 'd': valor = bruto ? new Date(bruto) : ''; break;
        default: {
          if (bruto === '') { valor = ''; break; }
          const numero = Number(bruto);
          valor = datas.has(Number(a.s || 0)) && Number.isFinite(numero)
            ? serialParaData(numero, sistema1904)
            : numero;
        }
      }
      valores[coluna] = valor;
      return '';
    });

    // Preenche buracos (colunas vazias no meio) com ''.
    for (let i = 0; i < valores.length; i++) if (valores[i] === undefined) valores[i] = '';
    linhas[numero] = valores;
    return '';
  });

  for (let i = 0; i < linhas.length; i++) if (!linhas[i]) linhas[i] = [];
  return linhas;
};

const caminhoNoZip = (alvo) => {
  if (alvo.startsWith('/')) return alvo.slice(1);
  return `xl/${alvo}`.replace(/\/\.\//g, '/');
};

const lerXlsx = async (bytes) => {
  const zip = abrirZip(bytes);
  const texto = async (nome) => (zip.has(nome) ? decoderUtf8.decode(await zip.get(nome)()) : '');

  const workbook = await texto('xl/workbook.xml');
  if (!workbook) throw new ErroDePlanilha('O arquivo não parece ser uma planilha .xlsx válida.');
  const rels = await texto('xl/_rels/workbook.xml.rels');
  const alvos = new Map();
  rels.replace(/<(?:\w+:)?Relationship\b[^>]*>/g, (tag) => {
    const a = atributos(tag);
    alvos.set(a.Id, a.Target);
    return '';
  });

  const sistema1904 = /<(?:\w+:)?workbookPr\b[^>]*date1904\s*=\s*"(1|true)"/i.test(workbook);
  const compartilhados = textosCompartilhados(await texto('xl/sharedStrings.xml'));
  const datas = estilosDeData(await texto('xl/styles.xml'));

  const abas = [];
  const tags = workbook.match(/<(?:\w+:)?sheet\b[^>]*>/g) || [];
  for (const tag of tags) {
    const a = atributos(tag);
    if (a.state === 'hidden' || a.state === 'veryHidden') continue;
    const alvo = alvos.get(a.id);
    if (!alvo) continue;
    const xml = await texto(caminhoNoZip(alvo));
    abas.push({ nome: a.name || `Aba ${abas.length + 1}`, linhas: lerAba(xml, compartilhados, datas, sistema1904) });
  }
  if (!abas.length) throw new ErroDePlanilha('A planilha não tem nenhuma aba com dados.');
  return abas;
};

// ------------------------------------------------------------------ CSV ----

/** UTF-8 quando possível; senão, a codificação antiga do Windows (Excel em português). */
const decodificarTexto = (bytes) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};

const detectarSeparador = (texto) => {
  const primeiraLinha = [];
  let entreAspas = false;
  for (const ch of texto) {
    if (ch === '"') entreAspas = !entreAspas;
    else if ((ch === '\n' || ch === '\r') && !entreAspas) break;
    else if (!entreAspas) primeiraLinha.push(ch);
  }
  const contar = (c) => primeiraLinha.filter((x) => x === c).length;
  const candidatos = [';', ',', '\t'].map((c) => [c, contar(c)]).sort((x, y) => y[1] - x[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ';';
};

export const lerCsvTexto = (texto) => {
  const separador = detectarSeparador(texto);
  const linhas = [];
  let linha = [];
  let campo = '';
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (entreAspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else entreAspas = false;
      } else campo += ch;
    } else if (ch === '"') {
      entreAspas = true;
    } else if (ch === separador) {
      linha.push(campo); campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha);
      linha = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};

// ---------------------------------------------------------------- entrada ----

/**
 * Lê uma planilha.
 * @param {File|Blob|ArrayBuffer|Uint8Array} arquivo
 * @param {string} [nomeArquivo] usado só para mensagens e para reconhecer .csv
 * @returns {Promise<{ formato: 'xlsx'|'csv', abas: { nome: string, linhas: any[][] }[] }>}
 */
export async function lerPlanilha(arquivo, nomeArquivo = arquivo?.name || '') {
  let bytes;
  if (arquivo instanceof Uint8Array) bytes = arquivo;
  else if (arquivo instanceof ArrayBuffer) bytes = new Uint8Array(arquivo);
  else bytes = new Uint8Array(await arquivo.arrayBuffer());

  if (bytes.length === 0) throw new ErroDePlanilha('O arquivo está vazio.');

  const assinatura = lerU32(bytes, 0);
  if (assinatura === 0x04034b50) return { formato: 'xlsx', abas: await lerXlsx(bytes) };
  if (assinatura === 0xe011cfd0) {
    throw new ErroDePlanilha('Este é o formato antigo do Excel (.xls). No Excel, use "Salvar como" e escolha "Pasta de Trabalho do Excel (.xlsx)" ou CSV.');
  }
  if (/\.(xlsx|xlsm)$/i.test(nomeArquivo)) {
    throw new ErroDePlanilha('O arquivo não parece ser uma planilha .xlsx válida.');
  }
  if (/\.(ods|numbers|pdf|docx?)$/i.test(nomeArquivo)) {
    throw new ErroDePlanilha('Formato não suportado. Salve a planilha como Excel (.xlsx) ou CSV.');
  }
  const nome = (nomeArquivo || 'Planilha').replace(/\.[^.]+$/, '');
  return { formato: 'csv', abas: [{ nome, linhas: lerCsvTexto(decodificarTexto(bytes)) }] };
}
