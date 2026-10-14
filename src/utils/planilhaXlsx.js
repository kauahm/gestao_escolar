// Gerador de planilha Excel (.xlsx) sem bibliotecas externas.
//
// Um .xlsx é um arquivo ZIP com alguns XMLs dentro. Aqui montamos esses XMLs
// e empacotamos num ZIP "sem compressão" (método store), que o Excel, o
// Google Planilhas e o LibreOffice abrem normalmente. Assim não é preciso
// instalar dependência nova nem pagar nada.
//
// Uso:
//   const blob = gerarXlsx([
//     { nome: 'Escolas', colunas: ['Nome', 'Bairro'], linhas: [['E.E.I. A', 'Centro']] },
//   ]);

const encoder = new TextEncoder();

// ---------------------------------------------------------------- CRC-32 ----
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// ------------------------------------------------------------ ZIP (store) ----
const dataHoraDos = (d = new Date()) => {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
};

const zipSemCompressao = (arquivos) => {
  const partes = [];
  const central = [];
  let deslocamento = 0;
  const { hora, data } = dataHoraDos();

  arquivos.forEach(({ caminho, conteudo }) => {
    const nome = encoder.encode(caminho);
    const dados = typeof conteudo === 'string' ? encoder.encode(conteudo) : conteudo;
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);        // versão necessária
    local.setUint16(6, 0x0800, true);    // nomes em UTF-8
    local.setUint16(8, 0, true);         // método: store
    local.setUint16(10, hora, true);
    local.setUint16(12, data, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, dados);

    const cab = new DataView(new ArrayBuffer(46));
    cab.setUint32(0, 0x02014b50, true);
    cab.setUint16(4, 20, true);
    cab.setUint16(6, 20, true);
    cab.setUint16(8, 0x0800, true);
    cab.setUint16(10, 0, true);
    cab.setUint16(12, hora, true);
    cab.setUint16(14, data, true);
    cab.setUint32(16, crc, true);
    cab.setUint32(20, dados.length, true);
    cab.setUint32(24, dados.length, true);
    cab.setUint16(28, nome.length, true);
    cab.setUint16(30, 0, true);
    cab.setUint16(32, 0, true);
    cab.setUint16(34, 0, true);
    cab.setUint16(36, 0, true);
    cab.setUint32(38, 0, true);
    cab.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(cab.buffer), nome);

    deslocamento += 30 + nome.length + dados.length;
  });

  const tamanhoCentral = central.reduce((acc, p) => acc + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  return [...partes, ...central, new Uint8Array(fim.buffer)];
};

// ------------------------------------------------------------------ XLSX ----
const escaparXml = (valor) =>
  String(valor)
    // remove caracteres de controle que o XML não aceita
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const letraDaColuna = (indice) => {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const nomeDeAbaValido = (nome, usados) => {
  let base = String(nome).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Planilha';
  let final = base;
  let i = 2;
  while (usados.has(final.toLowerCase())) {
    const sufixo = ` (${i++})`;
    final = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(final.toLowerCase());
  return final;
};

const celula = (ref, valor, estilo) => {
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  }
  if (typeof valor === 'boolean') {
    return `<c r="${ref}" t="inlineStr"${s}><is><t>${valor ? 'Sim' : 'Não'}</t></is></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
};

const xmlDaAba = ({ colunas, linhas }) => {
  const larguras = colunas.map((c, i) => {
    const maior = Math.max(
      String(c).length,
      ...linhas.slice(0, 200).map((l) => String(l[i] ?? '').length)
    );
    return Math.min(60, Math.max(10, maior + 2));
  });

  const cols = larguras
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const cabecalho = `<row r="1">${colunas
    .map((c, i) => celula(`${letraDaColuna(i)}1`, c, 1))
    .join('')}</row>`;

  const corpo = linhas
    .map((linha, r) => {
      const n = r + 2;
      return `<row r="${n}">${linha.map((v, i) => celula(`${letraDaColuna(i)}${n}`, v)).join('')}</row>`;
    })
    .join('');

  const ultima = `${letraDaColuna(Math.max(colunas.length - 1, 0))}${linhas.length + 1}`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols || '<col min="1" max="1" width="12" customWidth="1"/>'}</cols>` +
    `<sheetData>${cabecalho}${corpo}</sheetData>` +
    (colunas.length ? `<autoFilter ref="A1:${ultima}"/>` : '') +
    '</worksheet>'
  );
};

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF185FA5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/**
 * Monta o .xlsx.
 * @param {{nome: string, colunas: string[], linhas: any[][]}[]} abas
 * @returns {Uint8Array[]} partes do arquivo (para `new Blob(partes)`)
 */
export const partesDoXlsx = (abas) => {
  const usados = new Set();
  const lista = (abas.length ? abas : [{ nome: 'Vazio', colunas: [], linhas: [] }]).map((a) => ({
    ...a,
    nome: nomeDeAbaValido(a.nome, usados),
  }));

  const arquivos = [
    {
      caminho: '[Content_Types].xml',
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        lista
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join('') +
        '</Types>',
    },
    {
      caminho: '_rels/.rels',
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      caminho: 'xl/workbook.xml',
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${lista
          .map((a, i) => `<sheet name="${escaparXml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets>` +
        '</workbook>',
    },
    {
      caminho: 'xl/_rels/workbook.xml.rels',
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        lista
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join('') +
        `<Relationship Id="rId${lista.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    },
    { caminho: 'xl/styles.xml', conteudo: ESTILOS },
    ...lista.map((a, i) => ({ caminho: `xl/worksheets/sheet${i + 1}.xml`, conteudo: xmlDaAba(a) })),
  ];

  return zipSemCompressao(arquivos);
};

export const gerarXlsx = (abas) =>
  new Blob(partesDoXlsx(abas), {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
