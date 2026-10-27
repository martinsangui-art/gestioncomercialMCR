// ════════════════════════════════════════════════════════════════════════
// Lector del Excel del corte
// ════════════════════════════════════════════════════════════════════════
// Acepta dos tipos de archivo sin que Cele tenga que elegir nada:
//
//  1. El Excel "recortado" de siempre (solo las sedes de la zona).
//  2. El Excel NACIONAL tal como le llega por mail: todas las sedes del país,
//     una o varias hojas, filas de subtotales, títulos arriba, etc. La app se
//     queda sola con las sedes de su red (las registradas en la hoja 'sedes')
//     y el resto lo usa solo como referencia (cuántas filas, cómo viene el país).
//
// Es una función pura (no toca React ni la red) para poder probarla en Node con
// Excels armados a mano: ver scripts/probar-parser.mjs.
//
// Entrada:  parseCorte(arrayBuffer, XLSX, { codigosRed: ['22', '33', ...] })
// Salida:   { sedes: [{cod, sede, total, objetivoExcel}], meta: {...} }

// Nombres que delatan una sede de la provincia de Buenos Aires / CABA en el
// Excel nacional ("87-JUNIN - BS AS", "PILAR - BUENOS AIRES"). Se usa para
// avisar de sedes nuevas de la zona que todavía no están registradas en la app.
export const REGEX_ZONA = /BUENOS\s*AIRES|\bBS\.?\s*AS\b|\bCABA\b|C\.A\.B\.A/i

// Hasta cuántas filas desconocidas se listan todas una por una. Con más, el
// archivo es claramente el nacional y listar 180 sedes de otras provincias como
// "error" sería ruido: se resumen en una línea.
const MAX_DESCONOCIDAS_DETALLE = 10

// Filas que no son sedes sino totales del propio Excel
const REGEX_FILA_TOTAL = /^(sub\s*)?total(es)?\b|total\s+general|^suma\b/i

// Columnas que indican que el archivo viene desagregado (una fila por carrera
// o modalidad): en ese caso las filas repetidas de una sede se SUMAN.
const REGEX_COL_DESAGREGADA = /carrera|modalidad|programa|plan\b|nivel|facultad|titulo|título/i

export function normCod(v) {
  let s = String(v ?? '').trim().replace(/\.0+$/, '')
  if (/^\d+$/.test(s)) s = String(Number(s)) // "087" → "87"
  return s
}

const lower = (h) => String(h ?? '').toLowerCase().trim()

// "12" → 12 · "1.234" / "1,234" → 1234 · "3,5" → 3.5 · "" o "-" → 0 · "s/d" → NaN
function aNumero(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '')
  if (s === '' || s === '-' || s === '—') return 0
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  return Number(s.replace(',', '.'))
}

function esFechaTexto(h) {
  if (!h) return false
  const s = String(h).trim()
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true
  if (/^\d{4}[/-]\d{2}[/-]\d{2}/.test(s)) return true
  if (/^\d{5}$/.test(s) && Number(s) > 40000) return true // serial de Excel
  return false
}

// ¿Esta fila es el encabezado? Una celda con "cod" y otra con sede/nombre.
function indicesHeader(row) {
  const cells = (row || []).map(lower)
  const iCod = cells.findIndex(h => /\bcod|c[oó]digo|^nro\b|^n[°º]/.test(h))
  const iSede = cells.findIndex((h, i) => i !== iCod && /sede|nombre|unidad|centro|delegaci/.test(h))
  return { iCod, iSede, ok: iCod !== -1 && iSede !== -1, okSoloSede: iSede !== -1 }
}

// Código al principio del nombre: "87-JUNIN - BS AS" → "87"
function codDesdeNombre(nombre) {
  const m = String(nombre || '').trim().match(/^(\d{1,4})\s*[-–.)]\s*\S/)
  return m ? normCod(m[1]) : ''
}

// Lee una hoja. Devuelve null si no tiene forma de corte.
function leerHoja(ws, XLSX, nombreHoja, setRed) {
  if (!ws || !ws['!ref']) return null
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy', blankrows: true })
  if (!rows.length) return null

  // Encabezado: entre las primeras 40 filas (el nacional suele traer títulos,
  // logos o filtros arriba). Primero se busca cod+sede; si no, solo sede (y el
  // código se saca del nombre, "87-JUNIN").
  let hIdx = rows.slice(0, 40).findIndex(r => indicesHeader(r).ok)
  let soloSede = false
  if (hIdx === -1) {
    hIdx = rows.slice(0, 40).findIndex(r => indicesHeader(r).okSoloSede)
    soloSede = hIdx !== -1
  }
  if (hIdx === -1) return null

  const headerRaw = rows[hIdx]
  const header = headerRaw.map(lower)
  let { iCod, iSede } = indicesHeader(headerRaw)
  if (soloSede) iCod = -1

  // Columna de totales: header explícito → header fecha (la de más a la
  // derecha) → última no vacía. Igual que antes.
  let iTotal = header.findIndex(h => /total|ingresad|ingresant|acumulad|inscript/.test(h) && !/%|porc|objetivo|meta/.test(h))
  let detectadoPorFecha = false
  if (iTotal === -1) {
    for (let i = header.length - 1; i >= 0; i--) {
      if (esFechaTexto(headerRaw[i])) { iTotal = i; detectadoPorFecha = true; break }
    }
  }
  if (iTotal === -1) {
    for (let i = header.length - 1; i >= 0; i--) if (header[i]) { iTotal = i; break }
  }
  if (iTotal === -1 || iTotal === iCod || iTotal === iSede) return null

  const iObj = header.findIndex(h => /objetivo|meta/.test(h) && !/%|porc|cumpl/.test(h))
  const desagregado = header.some((h, i) => i !== iSede && REGEX_COL_DESAGREGADA.test(h))

  // ── Fecha del corte desde el header de la columna de totales ──────────
  // sheet_to_json con raw:false devuelve todo como texto, incluso fechas
  // nativas: hay que mirar la celda cruda para saber si es fecha real
  // (sin ambigüedad) o texto suelto (donde DD/MM vs MM/DD puede ser ambiguo).
  const range = XLSX.utils.decode_range(ws['!ref'])
  const celda = ws[XLSX.utils.encode_cell({ r: range.s.r + hIdx, c: range.s.c + iTotal })]
  const esFechaNativa = celda?.t === 'd' || (celda?.t === 'n' && /[dmy]/i.test(String(celda?.z || '')))
  let fechaCorte = null, fechaAmbigua = false
  let columnaTotal = String(headerRaw[iTotal] || '').trim() || `Columna ${iTotal + 1}`
  const p2 = (n) => String(n).padStart(2, '0')
  if (esFechaNativa) {
    let d = celda.v
    if (!(d instanceof Date) && typeof d === 'number') {
      const o = XLSX.SSF.parse_date_code(d)
      d = o ? new Date(o.y, o.m - 1, o.d) : null
    }
    if (d instanceof Date && !isNaN(d)) {
      fechaCorte = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      columnaTotal = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
    }
  } else {
    const hRaw = String(headerRaw[iTotal] || '').trim()
    const m1 = hRaw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (m1) {
      let [, d, mo, y] = m1
      const yyyy = y.length === 2 ? '20' + y : y
      if (Number(mo) > 12 && Number(d) <= 12) [d, mo] = [mo, d]
      else if (Number(d) !== Number(mo) && Number(d) <= 12 && Number(mo) <= 12) fechaAmbigua = true
      fechaCorte = `${yyyy}-${p2(mo)}-${p2(d)}`
      columnaTotal = `${p2(d)}/${p2(mo)}/${yyyy}`
    }
    const m2 = hRaw.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/)
    if (m2) { fechaCorte = `${m2[1]}-${m2[2]}-${m2[3]}`; columnaTotal = hRaw }
  }

  // ── Filas ──────────────────────────────────────────────────────────────
  const filas = []
  const filasInvalidas = []
  let filasTotal = 0
  for (let i = hIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue
    const nombre = iSede >= 0 ? String(row[iSede] ?? '').trim() : ''
    const codTxt = iCod >= 0 ? String(row[iCod] ?? '').trim() : ''
    if (REGEX_FILA_TOTAL.test(nombre) || REGEX_FILA_TOTAL.test(codTxt)) { filasTotal++; continue }
    let cod = iCod >= 0 ? normCod(codTxt) : ''
    if (!cod || !/^\d+$/.test(cod)) cod = codDesdeNombre(nombre) || cod
    if (!cod || cod === 'undefined') continue
    const valor = row[iTotal]
    const total = aNumero(valor)
    if (isNaN(total)) { filasInvalidas.push({ cod, sede: nombre, valor: String(valor ?? '(vacío)') }); continue }
    const objetivoExcel = iObj >= 0 && String(row[iObj] ?? '').trim() !== '' && !isNaN(aNumero(row[iObj])) ? aNumero(row[iObj]) : null
    filas.push({ cod, sede: nombre || `Sede ${cod}`, total, objetivoExcel, enRed: setRed ? setRed.has(cod) : true })
  }
  if (!filas.length) return null

  return {
    nombreHoja, filas, filasInvalidas, filasTotal, desagregado,
    meta: { columnaTotal, detectadoPorFecha, fechaCorte, fechaAmbigua, tieneObjetivo: iObj !== -1, codDesdeNombre: soloSede },
    puntaje: setRed ? filas.filter(f => f.enRed).length : filas.length,
  }
}

export function parseCorte(arrayBuffer, XLSX, { codigosRed = [] } = {}) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const setRed = codigosRed.length ? new Set(codigosRed.map(normCod)) : null

  // Todas las hojas: se elige la que más sedes de la red trae (el nacional a
  // veces viene con una hoja por región, una de resumen, otra de gráficos…).
  const candidatas = wb.SheetNames
    .map(n => { try { return leerHoja(wb.Sheets[n], XLSX, n, setRed) } catch { return null } })
    .filter(Boolean)
    .sort((a, b) => b.puntaje - a.puntaje)
  if (!candidatas.length) {
    throw new Error('No se encontraron las columnas esperadas (código de sede y columna de inscriptos). Verificá que sea el Excel del corte.')
  }
  const h = candidatas[0]
  if (setRed && h.puntaje === 0) {
    throw new Error('El Excel no trae ninguna de las sedes registradas en la app. ¿Es el archivo del corte correcto?')
  }

  // ── Repetidos: ¿corrección o desglose? ─────────────────────────────────
  // Si el archivo viene por carrera/modalidad, cada sede aparece varias veces
  // y hay que sumar. Si viene una fila por sede, un repetido es casi seguro
  // una corrección: se queda la última (comportamiento histórico).
  const porCod = new Map()
  const repetidos = new Set()
  h.filas.filter(f => f.enRed).forEach(f => {
    if (porCod.has(f.cod)) repetidos.add(f.cod)
    porCod.set(f.cod, [...(porCod.get(f.cod) || []), f])
  })
  const unicos = porCod.size
  const sumar = h.desagregado || (repetidos.size >= 3 && repetidos.size / unicos > 0.25)

  const sedes = [...porCod.values()].map(grupo => {
    if (grupo.length === 1 || !sumar) {
      const u = grupo[grupo.length - 1]
      return { cod: u.cod, sede: u.sede, total: u.total, objetivoExcel: u.objetivoExcel }
    }
    const objs = grupo.map(g => g.objetivoExcel).filter(v => v != null)
    return {
      cod: grupo[0].cod, sede: grupo[0].sede,
      total: grupo.reduce((a, g) => a + g.total, 0),
      objetivoExcel: objs.length ? objs.reduce((a, b) => a + b, 0) : null,
      filasSumadas: grupo.length,
    }
  })

  // ── Lo que no es de la red ─────────────────────────────────────────────
  const desconocidas = h.filas.filter(f => !f.enRed)
  const codsDesc = [...new Set(desconocidas.map(f => f.cod))]
  const esNacional = codsDesc.length > MAX_DESCONOCIDAS_DETALLE
  const unaPorCod = (lista) => [...new Map(lista.map(f => [f.cod, f])).values()]
  const posiblesNuevas = unaPorCod(desconocidas.filter(f => REGEX_ZONA.test(f.sede)))
  const sinMatch = esNacional ? posiblesNuevas : unaPorCod(desconocidas)

  // Referencia del resto del país (solo si el Excel trae objetivos)
  let pais = null
  if (esNacional) {
    const tot = desconocidas.reduce((a, f) => a + f.total, 0)
    const obj = desconocidas.reduce((a, f) => a + (f.objetivoExcel || 0), 0)
    pais = { sedes: codsDesc.length, inscriptos: tot, objetivo: obj || null, pct: obj ? Math.round(tot / obj * 100) : null }
  }

  return {
    sedes,
    meta: {
      ...h.meta,
      hoja: h.nombreHoja,
      hojas: wb.SheetNames.length,
      esNacional,
      filasLeidas: h.filas.length,
      filasTotalIgnoradas: h.filasTotal,
      sinMatch,            // filas que no son de la red y conviene mirar
      otrasIgnoradas: esNacional ? codsDesc.length - posiblesNuevas.length : 0,
      pais,
      sumadas: sumar ? [...repetidos] : [],
      duplicados: sumar ? [] : [...repetidos],
      filasInvalidas: h.filasInvalidas.filter(f => !setRed || setRed.has(f.cod)),
      totalFilas: sedes.length,
    },
  }
}
