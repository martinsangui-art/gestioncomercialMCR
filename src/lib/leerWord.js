// Texto de un Word (.docx) para mandarle a Gemini: párrafos en orden, las
// viñetas con "- " y cada fila de tabla en un renglón ("celda | celda").
// El .docx es un zip: se abre con SheetJS (CFB), que la app ya usa para los
// Excel, así no se suma otra librería.

const ENTIDADES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" }
const decodificar = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(lt|gt|amp|quot|apos);/g, (m) => ENTIDADES[m])

function textoParrafo(p) {
  let t = ''
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g
  let m
  while ((m = re.exec(p))) {
    if (m[1] !== undefined) t += decodificar(m[1])
    else if (m[0] === '<w:tab/>') t += '\t'
    else t += '\n'
  }
  t = t.replace(/[ ]/g, (c) => (c === ' ' ? ' ' : '')).replace(/[ \t]+/g, ' ').trim()
  return /<w:numPr>/.test(p) && t ? `- ${t}` : t
}

// document.xml → texto plano
export function docxXmlATexto(xml) {
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [, xml])[1]
  const lineas = []
  // Bloques de primer nivel: tablas y párrafos, en el orden del documento
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  let m
  while ((m = re.exec(body))) {
    const bloque = m[0]
    if (bloque.startsWith('<w:tbl>')) {
      const filas = bloque.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []
      filas.forEach(tr => {
        const celdas = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(tc =>
          (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(textoParrafo).filter(Boolean).join(' / '))
        if (celdas.some(Boolean)) lineas.push(celdas.join(' | '))
      })
      lineas.push('')
    } else {
      lineas.push(textoParrafo(bloque))
    }
  }
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Archivo (File/ArrayBuffer) → texto. XLSX es SheetJS ya cargado.
export function docxATexto(buffer, XLSX) {
  let zip
  try { zip = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' }) }
  catch { throw new Error('No se pudo abrir el archivo. ¿Es un Word (.docx)?') }
  const i = zip.FullPaths.findIndex(p => /\/word\/document\.xml$/.test(p))
  if (i === -1) throw new Error('El archivo no es un Word (.docx). Si es un .doc viejo, abrilo en Word y guardalo como .docx.')
  const xml = new TextDecoder('utf-8').decode(zip.FileIndex[i].content)
  return docxXmlATexto(xml)
}
