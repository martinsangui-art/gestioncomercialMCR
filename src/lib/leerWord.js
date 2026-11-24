// Texto de un Word (.docx) para mandarle a Gemini: párrafos en orden, las
// viñetas con "- " y cada fila de tabla en un renglón ("celda | celda").
//
// El .docx es un zip. Se abre con lo que trae el navegador
// (DecompressionStream), sin bajar ninguna librería; si el navegador es muy
// viejo, se usa SheetJS (el lector de Excel de la app) como respaldo.

const ENTIDADES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" }
const decodificar = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(lt|gt|amp|quot|apos);/g, (m) => ENTIDADES[m])

const limpiar = (t) => t.replace(/ /g, ' ').replace(//g, '').replace(/[ \t]+/g, ' ').trim()

// ── Con DOMParser (navegador): recorre el árbol, no se confunde con cuadros
// de texto ni tablas dentro de tablas ────────────────────────────────────────
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function textoNodo(nodo) {
  let t = ''
  for (const n of nodo.childNodes) {
    if (n.nodeType !== 1) continue
    const nombre = n.localName
    if (nombre === 't') t += n.textContent
    else if (nombre === 'tab') t += '\t'
    else if (nombre === 'br' || nombre === 'cr') t += '\n'
    else if (nombre === 'txbxContent') t += ' ' + bloques(n).join(' ') + ' '
    else if (nombre !== 'pPr' && nombre !== 'rPr') t += textoNodo(n)
  }
  return t
}
function bloques(contenedor) {
  const lineas = []
  for (const n of contenedor.childNodes) {
    if (n.nodeType !== 1) continue
    if (n.localName === 'p') {
      const t = limpiar(textoNodo(n))
      const vineta = n.getElementsByTagNameNS(W, 'numPr').length > 0
      lineas.push(vineta && t ? `- ${t}` : t)
    } else if (n.localName === 'tbl') {
      for (const tr of n.childNodes) {
        if (tr.localName !== 'tr') continue
        const celdas = [...tr.childNodes].filter(tc => tc.localName === 'tc').map(tc => bloques(tc).filter(Boolean).join(' / '))
        if (celdas.some(Boolean)) lineas.push(celdas.join(' | '))
      }
      lineas.push('')
    } else if (n.localName === 'sdt' || n.localName === 'sdtContent' || n.localName === 'customXml') {
      lineas.push(...bloques(n))
    }
  }
  return lineas
}

// ── Sin DOMParser (pruebas en Node): por expresiones regulares ──────────────
function textoParrafoRegex(p) {
  let t = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g
  let m
  while ((m = re.exec(p))) {
    if (m[1] !== undefined) t += decodificar(m[1])
    else if (m[0] === '<w:tab/>') t += '\t'
    else t += '\n'
  }
  t = limpiar(t)
  return /<w:numPr>/.test(p) && t ? `- ${t}` : t
}
function textoRegex(body) {
  const lineas = []
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  let m
  while ((m = re.exec(body))) {
    const bloque = m[0]
    if (bloque.startsWith('<w:tbl>')) {
      ;(bloque.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).forEach(tr => {
        const celdas = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(tc =>
          (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(textoParrafoRegex).filter(Boolean).join(' / '))
        if (celdas.some(Boolean)) lineas.push(celdas.join(' | '))
      })
      lineas.push('')
    } else lineas.push(textoParrafoRegex(bloque))
  }
  return lineas
}

// document.xml → texto plano
export function docxXmlATexto(xml) {
  let lineas
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const body = doc.getElementsByTagNameNS(W, 'body')[0]
    lineas = body ? bloques(body) : []
  } else {
    lineas = textoRegex((xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [, xml])[1])
  }
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Abrir el zip ─────────────────────────────────────────────────────────────
// Busca word/document.xml en el directorio central del zip y lo descomprime.
async function documentXmlNativo(buffer) {
  const dv = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let fin = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) throw new Error('NO_ZIP')
  const total = dv.getUint16(fin + 10, true)
  let p = dv.getUint32(fin + 16, true)
  const dec = new TextDecoder('utf-8')
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('NO_ZIP')
    const metodo = dv.getUint16(p + 10, true)
    const tamComp = dv.getUint32(p + 20, true)
    const largoNombre = dv.getUint16(p + 28, true), largoExtra = dv.getUint16(p + 30, true), largoComent = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + largoNombre))
    if (nombre === 'word/document.xml') {
      const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
      const datos = bytes.subarray(inicio, inicio + tamComp)
      if (metodo === 0) return dec.decode(datos)
      if (metodo !== 8) throw new Error('NO_ZIP')
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return dec.decode(await new Response(flujo).arrayBuffer())
    }
    p += 46 + largoNombre + largoExtra + largoComent
  }
  throw new Error('NO_DOCX')
}

function documentXmlSheetJS(buffer, XLSX) {
  let zip
  try { zip = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' }) }
  catch { throw new Error('NO_ZIP') }
  const i = zip.FullPaths.findIndex(p => /\/word\/document\.xml$/.test(p))
  if (i === -1) throw new Error('NO_DOCX')
  return new TextDecoder('utf-8').decode(zip.FileIndex[i].content)
}

const MENSAJES = {
  NO_ZIP: 'No se pudo abrir el archivo. ¿Es un Word (.docx)?',
  NO_DOCX: 'El archivo no es un Word (.docx). Si es un .doc viejo, abrilo en Word y guardalo como .docx.',
}

// Archivo → texto. cargarXLSX solo se usa si el navegador no sabe descomprimir.
export async function leerDocx(buffer, cargarXLSX) {
  let xml
  try {
    if (typeof DecompressionStream !== 'undefined') {
      try { xml = await documentXmlNativo(buffer) }
      catch (e) { if (e.message === 'NO_DOCX') throw e; xml = documentXmlSheetJS(buffer, await cargarXLSX()) }
    } else {
      xml = documentXmlSheetJS(buffer, await cargarXLSX())
    }
  } catch (e) {
    throw new Error(MENSAJES[e.message] || e.message)
  }
  return docxXmlATexto(xml)
}

// Compatibilidad con las pruebas: SheetJS ya cargado
export function docxATexto(buffer, XLSX) {
  try { return docxXmlATexto(documentXmlSheetJS(buffer, XLSX)) }
  catch (e) { throw new Error(MENSAJES[e.message] || e.message) }
}

// Parte un texto largo en bloques de hasta `max` caracteres sin cortar
// renglones (un renglón más largo que max va solo)
export function partirTexto(texto, max) {
  const partes = []
  let actual = ''
  for (const linea of texto.split('\n')) {
    if (actual && actual.length + linea.length + 1 > max) { partes.push(actual); actual = '' }
    actual += (actual ? '\n' : '') + linea
  }
  if (actual.trim()) partes.push(actual)
  return partes
}
