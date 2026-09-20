// Gerador simples de arquivo Excel (.xlsx) sem dependências externas.
// Monta o pacote Office Open XML e o compacta num .zip (sem compressão).
// Usado apenas pela exportação "Exportar Excel" dos Relatórios.

export type FormatoXlsx = "moeda" | "kg" | "num";
export type CelulaXlsx = string | number | null | undefined | { valor: number; formato: FormatoXlsx };

// Estilos (posição em cellXfs do styles.xml abaixo)
const ST_NORMAL = 0;
const ST_NEGRITO = 1;
const ST_MOEDA = 2;
const ST_KG = 3;
const ST_MOEDA_NEGRITO = 4;
const ST_KG_NEGRITO = 5;

const encoder = new TextEncoder();

// ── CRC32 + ZIP (armazenado, sem compressão) ───────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipArmazenado(arquivos: { nome: string; dados: Uint8Array }[]): Uint8Array {
  const agora = new Date();
  const dosHora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const dosData = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();

  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const arq of arquivos) {
    const nome = encoder.encode(arq.nome);
    const crc = crc32(arq.dados);
    const tam = arq.dados.length;

    const local = new Uint8Array(30 + nome.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nomes em UTF-8
    lv.setUint16(8, 0, true); // sem compressão
    lv.setUint16(10, dosHora, true);
    lv.setUint16(12, dosData, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, tam, true);
    lv.setUint32(22, tam, true);
    lv.setUint16(26, nome.length, true);
    lv.setUint16(28, 0, true);
    local.set(nome, 30);
    partes.push(local, arq.dados);

    const cd = new Uint8Array(46 + nome.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosHora, true);
    cv.setUint16(14, dosData, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, tam, true);
    cv.setUint32(24, tam, true);
    cv.setUint16(28, nome.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, deslocamento, true);
    cd.set(nome, 46);
    central.push(cd);

    deslocamento += local.length + tam;
  }

  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, arquivos.length, true);
  fv.setUint16(10, arquivos.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, deslocamento, true);

  const todos = [...partes, ...central, fim];
  const total = todos.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(new ArrayBuffer(total));
  let pos = 0;
  for (const p of todos) { saida.set(p, pos); pos += p.length; }
  return saida;
}

// ── XML ────────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letraColuna(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Texto no formato de moeda exibido no sistema ("R$ 1.037,50" / "-R$ 465,00")
// vira número com formato de moeda no Excel (aparece igual, mas soma direito).
const REGEX_MOEDA = /^-?R\$\s*-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
function moedaParaNumero(t: string): number | null {
  const s = t.trim();
  if (!REGEX_MOEDA.test(s)) return null;
  const negativo = s.includes("-");
  const n = parseFloat(s.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

function celulaXml(ref: string, c: CelulaXlsx, negrito: boolean, ehCabecalho: boolean): { xml: string; largura: number } {
  if (c === null || c === undefined || c === "") return { xml: "", largura: 0 };

  if (typeof c === "object") {
    const st = c.formato === "moeda" ? ST_MOEDA_NEGRITO : c.formato === "kg" ? ST_KG_NEGRITO : ST_NEGRITO;
    return { xml: `<c r="${ref}" s="${st}"><v>${c.valor}</v></c>`, largura: 14 };
  }
  if (typeof c === "number") {
    return { xml: `<c r="${ref}" s="${negrito ? ST_NEGRITO : ST_NORMAL}"><v>${c}</v></c>`, largura: String(c).length };
  }

  const texto = String(c);
  if (!ehCabecalho && !negrito) {
    const n = moedaParaNumero(texto);
    if (n !== null) return { xml: `<c r="${ref}" s="${ST_MOEDA}"><v>${n}</v></c>`, largura: 14 };
  }
  const st = ehCabecalho || negrito ? ST_NEGRITO : ST_NORMAL;
  return {
    xml: `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(texto)}</t></is></c>`,
    largura: texto.length,
  };
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.000"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function gerarXlsx(opts: {
  planilha: string;
  colunas: string[];
  linhas: CelulaXlsx[][];
  rodape?: CelulaXlsx[][];
}): Uint8Array {
  const nomePlanilha = (opts.planilha || "Relatório").replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 31) || "Relatório";
  const larguras: number[] = opts.colunas.map((c) => c.length);

  const linhasXml: string[] = [];
  let numLinha = 1;

  function adicionarLinha(celulas: CelulaXlsx[], negrito: boolean, ehCabecalho: boolean) {
    const cel: string[] = [];
    celulas.forEach((c, i) => {
      const { xml, largura } = celulaXml(`${letraColuna(i)}${numLinha}`, c, negrito, ehCabecalho);
      if (xml) cel.push(xml);
      if (i < larguras.length && !negrito && largura > larguras[i]) larguras[i] = largura;
    });
    linhasXml.push(`<row r="${numLinha}">${cel.join("")}</row>`);
    numLinha++;
  }

  adicionarLinha(opts.colunas, true, true);
  for (const l of opts.linhas) adicionarLinha(l, false, false);
  if (opts.rodape && opts.rodape.length) {
    numLinha++; // linha em branco antes do fechamento
    for (const l of opts.rodape) adicionarLinha(l, true, false);
  }

  const cols = larguras
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, w + 2))}" customWidth="1"/>`)
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${linhasXml.join("")}</sheetData></worksheet>`;

  const arquivos = [
    {
      nome: "[Content_Types].xml",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      nome: "_rels/.rels",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nomePlanilha)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nome: "xl/styles.xml", texto: ESTILOS },
    { nome: "xl/worksheets/sheet1.xml", texto: sheet },
  ];

  return zipArmazenado(arquivos.map((a) => ({ nome: a.nome, dados: encoder.encode(a.texto) })));
}

export function baixarXlsx(opts: {
  arquivo: string;
  planilha: string;
  colunas: string[];
  linhas: CelulaXlsx[][];
  rodape?: CelulaXlsx[][];
}) {
  const bytes = gerarXlsx(opts);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.arquivo;
  a.click();
  URL.revokeObjectURL(url);
}
