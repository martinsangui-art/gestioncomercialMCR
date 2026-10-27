// ════════════════════════════════════════════════════════════════════════
// Doble lectura del Excel del corte
// ════════════════════════════════════════════════════════════════════════
// El lector (parserCorte.js) lee la hoja como texto formateado. Esta función
// vuelve a leer las MISMAS celdas por otro camino: el valor crudo de cada celda
// de la planilla, sin pasar por el formato de texto. Si los dos caminos no dan
// exactamente lo mismo para cada sede de la zona, el corte no se guarda.
//
// Está escrita a propósito sin reutilizar nada del lector: si un día el lector
// tiene un error, esta verificación no lo hereda.

const p2 = (n) => String(n).padStart(2, '0')

function codigoCrudo(celda) {
  if (!celda || celda.v === undefined || celda.v === null) return ''
  if (celda.t === 'n') return Number.isInteger(celda.v) ? String(celda.v) : ''
  const s = String(celda.v).trim()
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : ''
}

function numeroCrudo(celda) {
  if (!celda || celda.v === undefined || celda.v === null || celda.v === '') return 0
  if (celda.t === 'n') return celda.v
  if (celda.t === 'e') return NaN
  const s = String(celda.v).trim()
  if (s === '' || s === '-' || s === '—') return 0
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10)
  return NaN
}

const sinModalidad = (n) => String(n || '').replace(/\s+mod(o)?\.?\s*\d+\s*$/i, '').trim().toUpperCase()

export function verificarCorte(arrayBuffer, XLSX, resultado, codigosRed) {
  const problemas = []
  const { lectura, meta, sedes } = resultado
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[lectura.hoja]
  if (!ws) return { ok: false, problemas: ['No se encontró la hoja leída'] }
  const R = XLSX.utils.decode_range(ws['!ref'])
  const celda = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]
  const fTit = R.s.r + lectura.hIdx
  const cTot = R.s.c + lectura.iTotal
  const cCod = lectura.iCod >= 0 ? R.s.c + lectura.iCod : -1
  const cSede = lectura.iSede >= 0 ? R.s.c + lectura.iSede : -1

  // 1. La columna leída tiene que ser la del corte: su título es una fecha o
  //    dice total/acumulado/inscriptos. Y si es fecha, la misma que se va a guardar.
  const tit = celda(fTit, cTot)
  const titArriba = fTit > R.s.r ? celda(fTit - 1, cTot) : null
  let fechaTitulo = null
  if (tit && tit.v instanceof Date) {
    const d = tit.v
    fechaTitulo = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  }
  const textoTit = `${tit ? String(tit.w ?? tit.v) : ''} ${titArriba ? String(titArriba.v) : ''}`.toLowerCase()
  const tituloValido = fechaTitulo || /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(textoTit) || /total|acumulad|inscript|ingresad|ingresant/.test(textoTit)
  if (!tituloValido) problemas.push(`La columna ${XLSX.utils.encode_col(cTot)} no tiene un título de corte (fecha o "total")`)
  if (fechaTitulo && meta.fechaCorte && fechaTitulo !== meta.fechaCorte && !meta.fechaAmbigua) {
    problemas.push(`La fecha del título (${fechaTitulo}) no coincide con la del corte (${meta.fechaCorte})`)
  }
  if (/anterior|objetivo|%/.test(tit ? String(tit.w ?? tit.v).toLowerCase() : '')) problemas.push(`La columna ${XLSX.utils.encode_col(cTot)} parece ser "${tit.w ?? tit.v}", no la del corte`)

  // 2. Releer cada fila con los valores crudos de las celdas
  const red = new Set(codigosRed.map(c => String(parseInt(c, 10))))
  const suma = new Map()
  let previo = null
  for (let r = fTit + 1; r <= R.e.r; r++) {
    const nombre = cSede >= 0 ? String(celda(r, cSede)?.v ?? '').trim() : ''
    const codTxt = cCod >= 0 ? String(celda(r, cCod)?.v ?? '').trim() : ''
    if (/total/i.test(nombre) || /total/i.test(codTxt)) { previo = null; continue }
    let cod = cCod >= 0 ? codigoCrudo(celda(r, cCod)) : ''
    if (!cod) { const m = nombre.match(/^(\d{1,4})\s*[-–.)]\s*\S/); if (m) cod = String(parseInt(m[1], 10)) }
    let continua = false
    if (!cod && previo && nombre && sinModalidad(nombre) === previo.base) { cod = previo.cod; continua = true }
    if (!cod) continue
    if (!continua) previo = { cod, base: sinModalidad(nombre) }
    if (!red.has(cod)) continue
    const n = numeroCrudo(celda(r, cTot))
    if (!Number.isInteger(n) || n < 0) { problemas.push(`Fila ${r + 1}: el valor de la sede ${cod} no es un número entero`); continue }
    suma.set(cod, (suma.get(cod) || 0) + n)
  }

  // 3. Comparar sede por sede con lo que leyó el lector
  const delLector = new Map(sedes.map(s => [String(s.cod), s.total]))
  for (const [cod, total] of suma) {
    if (!delLector.has(cod)) problemas.push(`La sede ${cod} está en el Excel (${total}) pero el lector no la tomó`)
    else if (delLector.get(cod) !== total) problemas.push(`Sede ${cod}: el lector leyó ${delLector.get(cod)} y la relectura ${total}`)
  }
  for (const [cod, total] of delLector) {
    if (!suma.has(cod)) problemas.push(`La sede ${cod} (${total}) la tomó el lector pero no aparece en la relectura`)
  }
  const totalLector = sedes.reduce((a, s) => a + s.total, 0)
  const totalRelectura = [...suma.values()].reduce((a, b) => a + b, 0)
  if (totalLector !== totalRelectura) problemas.push(`Total: el lector suma ${totalLector} y la relectura ${totalRelectura}`)

  return { ok: problemas.length === 0, problemas, sedes: suma.size, total: totalRelectura }
}
