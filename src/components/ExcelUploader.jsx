import { useState, useRef, useMemo } from 'react'
import { C, F } from '../lib/theme'
import { fmtCorto, hoyIso as hoyLocal, nombreCorto } from '../lib/formato'

// Parser de Excel usando SheetJS (cargado via CDN en index.html)
// Formato esperado: Cod Sede | Sede | Objetivo | % Objetivo | [fecha del corte = columna de totales]
// La columna de totales se detecta automáticamente:
//   1. Por header con texto "total", "ingresado" o "acumulado"
//   2. Por header que sea una fecha (texto dd/mm/aa, objeto Date, o número serial Excel)
//   3. Último recurso: última columna no vacía
function parseExcelData(arrayBuffer) {
  const XLSX = window.XLSX
  if (!XLSX) throw new Error('SheetJS no disponible')

  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' })

  if (!rows.length) throw new Error('El archivo está vacío')

  // La fila de encabezado no siempre es la primera: el 03/08/2026 vino con
  // la fila 1 vacía y los títulos en la fila 2, y eso tiró "error de
  // formato" porque el código asumía rows[0] a ciegas. Ahora se busca entre
  // las primeras filas cuál tiene pinta de encabezado real (una celda con
  // "cod" y otra con "sede"/"nombre") en vez de asumir la posición.
  const pareceHeader = (row) => {
    const cells = (row || []).map(h => String(h || '').toLowerCase().trim())
    return cells.some(h => h.includes('cod')) && cells.some(h => h.includes('sede') || h.includes('nombre'))
  }
  let headerRowIdx0 = rows.slice(0, 20).findIndex(pareceHeader) // índice dentro de `rows` (0 = primera fila del archivo)
  if (headerRowIdx0 === -1) headerRowIdx0 = 0 // no se encontró: se sigue con la fila 1 para no romper, el chequeo de abajo va a avisar

  const headerRaw = rows[headerRowIdx0]
  const header = headerRaw.map(h => String(h || '').toLowerCase().trim())

  const iCod  = header.findIndex(h => h.includes('cod'))
  // Con "Cod Sede" en una sola columna, buscar "sede" sin excluir iCod
  // matchea esa misma columna dos veces y la columna real del nombre (la
  // de al lado) queda sin detectar — el código de sede termina apareciendo
  // como si fuera el nombre en la vista previa. Se excluye iCod acá.
  const iSede = header.findIndex((h, idx) => idx !== iCod && (h.includes('sede') || h.includes('nombre')))

  // Detectar columna de totales — orden de prioridad:
  // 1. Header explícito (total/ingresado/acumulado)
  // 2. Header que sea una fecha en cualquier formato (texto o serializado)
  // 3. Última columna no vacía
  const esFecha = (h) => {
    if (!h) return false
    const s = String(h).trim()
    // Patrones de texto: dd/mm/aa, dd-mm-aaaa, yyyy-mm-dd, etc.
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return true
    if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(s)) return true
    // SheetJS con dateNF convierte fechas a dd/mm/yyyy — ya cubierto arriba
    // Número serial de Excel (fechas suelen ser > 40000)
    if (/^\d{5}$/.test(s) && Number(s) > 40000) return true
    return false
  }

  let iTotal = header.findIndex(h => h.includes('total') || h.includes('ingresado') || h.includes('acumulado'))
  let detectadoPorFecha = false
  let columnaLabel = ''

  if (iTotal === -1) {
    for (let i = header.length - 1; i >= 0; i--) {
      if (esFecha(headerRaw[i]) || esFecha(header[i])) {
        iTotal = i
        detectadoPorFecha = true
        break
      }
    }
  }
  if (iTotal === -1) {
    for (let i = header.length - 1; i >= 0; i--) {
      if (header[i]) { iTotal = i; break }
    }
  }

  if (iCod === -1 || iTotal === -1) {
    throw new Error('No se encontraron las columnas esperadas (Cod Sede / columna de totales). Verificá el formato del Excel.')
  }

  columnaLabel = String(headerRaw[iTotal] || '').trim() || `Columna ${iTotal + 1}`

  // Intentar extraer fecha real del header de la columna de totales.
  //
  // OJO: sheet_to_json fue llamado con raw:false + dateNF más arriba, así que
  // headerRaw[iTotal] SIEMPRE llega como string ya formateado — incluso si en
  // Excel esa celda es una fecha nativa real. Por eso NO alcanza con mirar
  // headerRaw[iTotal]: hay que consultar la celda cruda del worksheet para
  // saber si de verdad es una fecha nativa (sin ambigüedad posible) o texto
  // suelto (donde sí puede haber ambigüedad DD/MM vs MM/DD).
  const range = XLSX.utils.decode_range(ws['!ref'])
  const headerRowIdx = range.s.r + headerRowIdx0 // fila real del encabezado en la planilla (puede no ser la primera)
  const headerCellRef = ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: iTotal })]
  const esFechaNativa = headerCellRef?.t === 'd' // tipo 'd' = fecha real de Excel, con cellDates:true

  let fechaCorte = null
  let fechaAmbigua = false // día y mes ambos <=12: no se puede saber DD/MM vs MM/DD por texto
  const hRaw = esFechaNativa ? headerCellRef.v : headerRaw[iTotal]
  if (esFechaNativa && hRaw instanceof Date) {
    // Fecha nativa de Excel confirmada por el tipo de celda — no hay
    // ambigüedad posible, se usa el valor real sin adivinar nada.
    const d = hRaw
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    fechaCorte = `${yyyy}-${mm}-${dd}`
    columnaLabel = `${dd}/${mm}/${yyyy}`
  } else if (typeof hRaw === 'string') {
    // Intentar parsear string de fecha (encabezado guardado como texto plano)
    const m1 = hRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (m1) {
      let [, d, mo, y] = m1
      const yyyy = y.length === 2 ? '20' + y : y
      // Se espera DD/MM/AAAA. Si el segundo valor no puede ser un mes válido
      // (>12) y el primero sí, es inequívocamente MM/DD/AAAA y se invierte.
      // Pero si AMBOS son <=12 (ej. "8/3/26"), es ambiguo de verdad: no hay
      // forma de saber si es 8 de marzo o 3 de agosto solo con el texto.
      // Antes acá se adivinaba en silencio (bug real del 03/08/2026, guardó
      // el corte como si fuera 8 de marzo). Ahora se deja marcado como
      // ambiguo para que la UI lo muestre en rojo y no pase desapercibido.
      if (Number(mo) > 12 && Number(d) <= 12) {
        [d, mo] = [mo, d]
      } else if (Number(d) !== Number(mo) && Number(d) <= 12 && Number(mo) <= 12) {
        fechaAmbigua = true
      }
      fechaCorte = `${yyyy}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
      columnaLabel = `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${yyyy}`
    }
    const m2 = hRaw.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
    if (m2) {
      fechaCorte = `${m2[1]}-${m2[2]}-${m2[3]}`
      columnaLabel = hRaw
    }
  }

  const sedes = []
  const filasInvalidas = [] // cod presente pero total no numérico — antes se descartaban sin avisar
  const vistos = new Map() // cod → índice en `sedes`, para detectar filas repetidas dentro del mismo archivo
  const duplicados = [] // cods que aparecieron más de una vez (ej: Trenque Lauquén salió dos veces por esto en un envío)
  for (let i = headerRowIdx0 + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === undefined || c === '' || c === null)) continue
    const cod = String(row[iCod] ?? '').trim().replace(/\.0$/, '') // sacar ".0" si vino como número
    if (!cod || cod === 'undefined') continue
    const sede = iSede >= 0 ? String(row[iSede] || '').trim() : `Sede ${cod}`
    const totalRaw = String(row[iTotal] ?? '').replace(',', '.')
    const total = Number(totalRaw)
    if (isNaN(total)) {
      filasInvalidas.push({ cod, sede, valor: String(row[iTotal] ?? '(vacío)') })
      continue
    }
    if (vistos.has(cod)) {
      // Mismo código dos veces en el archivo: se queda con la última fila
      // (la más probable de ser la corrección) y se avisa — antes las dos
      // se mandaban tal cual, duplicando esa sede en el corte.
      sedes[vistos.get(cod)] = { cod, sede, total }
      if (!duplicados.includes(cod)) duplicados.push(cod)
    } else {
      vistos.set(cod, sedes.length)
      sedes.push({ cod, sede, total })
    }
  }

  if (!sedes.length) throw new Error('No se encontraron datos válidos en el archivo')

  return {
    sedes,
    meta: {
      columnaTotal: columnaLabel,
      detectadoPorFecha,
      fechaCorte, // fecha extraída del header, null si no se pudo
      fechaAmbigua, // true si día/mes son ambos <=12: no se sabe con certeza
      duplicados, // cods repetidos dentro del archivo (se quedó con la última fila de cada uno)
      filasInvalidas, // filas con cod válido pero total no numérico (se descartaron)
      totalFilas: sedes.length,
    },
  }
}

// Invierte día y mes de una fecha ISO (yyyy-mm-dd) — usado para ofrecer la
// interpretación alternativa cuando la fecha del corte es ambigua.
function invertirDiaMes(fechaISO) {
  const [yyyy, mo, d] = fechaISO.split('-')
  return `${yyyy}-${d}-${mo}`
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// Fecha ISO en palabras (ej. "3 de agosto de 2026") para que al elegir entre
// las dos interpretaciones ambiguas no haya que leer un ISO crudo y adivinar.
function fechaEnPalabras(fechaISO) {
  const [yyyy, mo, d] = fechaISO.split('-').map(Number)
  return `${d} de ${MESES[mo - 1]} de ${yyyy}`
}

function IconoPlanilla() {
  return (
    <span style={{ width: 40, height: 40, borderRadius: 10, background: C.celesteSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" />
      </svg>
    </span>
  )
}

// Aviso de la vista previa. `tono` define el color: bloquea (rojo), revisar
// (ámbar) o info (celeste). Siempre dice qué pasa si se sigue.
function AvisoCarga({ tono, titulo, children, chips }) {
  const t = {
    bloquea: { borde: C.crimson, fondo: '#FDF1F3', texto: '#8E0C22' },
    revisar: { borde: C.warn, fondo: '#FBF3E2', texto: '#6B4A00' },
    info:    { borde: C.celeste, fondo: C.celesteSoft, texto: C.navy },
  }[tono]
  return (
    <div role={tono === 'bloquea' ? 'alert' : undefined} style={{ borderLeft: `4px solid ${t.borde}`, background: t.fondo, borderRadius: '0 10px 10px 0', padding: '12px 16px', fontSize: 13.5, color: t.texto, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, marginBottom: children ? 4 : 0 }}>{titulo}</div>
      {children}
      {chips?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {chips.map((c, i) => (
            <span key={i} style={{ fontSize: 12, background: '#fff', border: `1px solid ${t.borde}55`, color: t.texto, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const btnPrimario = { height: 44, padding: '0 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.navy, color: '#fff', fontSize: 14.5, fontWeight: 800, fontFamily: F.body }
const btnSecundario = { height: 44, padding: '0 16px', borderRadius: 10, border: `1px solid ${C.rule}`, cursor: 'pointer', background: '#fff', color: C.ink, fontSize: 14, fontWeight: 600, fontFamily: F.body }

export default function ExcelUploader({ data, historial = [], onUpload, onGuardado, campanas, campanaActiva, sedesConocidas = [], abierto, onAbierto }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // null = automático: plegado si la campaña ya tiene cortes. Si el padre
  // pasa `abierto`/`onAbierto`, el botón para abrirlo vive afuera y plegado
  // no se muestra nada.
  const controlado = abierto !== undefined
  const [minLocal, setMinLocal] = useState(null)
  const minimized = controlado ? (abierto === null ? null : !abierto) : minLocal
  const setMinimized = (v) => controlado ? onAbierto(!v) : setMinLocal(v)
  const [preview, setPreview] = useState(null) // { sedes, meta, fileName }
  const [confirmando, setConfirmando] = useState(false)
  const [modoReemplazar, setModoReemplazar] = useState(false) // el servidor avisó que ya existe
  const [fechaElegida, setFechaElegida] = useState(null) // cuando era ambigua o no venía en el Excel
  const inputRef = useRef(null)

  const camp = campanas?.find(c => c.id === campanaActiva)
  const tieneData = data.length > 0
  const fechaActual = data[0]?.fecha ? String(data[0].fecha).slice(0, 10) : null
  const fechasCargadas = useMemo(() => new Set(historial.map(r => String(r.fecha).slice(0, 10))), [historial])

  const isMinimized = minimized || (tieneData && minimized !== false)

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Ese archivo no es un Excel. Tiene que terminar en .xlsx o .xls.')
      return
    }
    setLoading(true)
    setError(null)
    setModoReemplazar(false)
    setFechaElegida(null)
    try {
      const buffer = await file.arrayBuffer()
      const { sedes, meta } = parseExcelData(buffer)
      // Filas del Excel que no coinciden con ninguna sede registrada — se
      // descartarían en silencio al guardar si no se avisa acá primero.
      const sinMatch = sedes.filter(s => !sedesConocidas.some(sc => String(sc.cod_sede) === String(s.cod)))
      setPreview({ sedes, meta: { ...meta, sinMatch }, fileName: file.name })
      if (!meta.fechaCorte) setFechaElegida(hoyLocal())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Todo lo que Cele necesita chequear antes de guardar, comparado contra el
  // último corte cargado
  const chequeo = useMemo(() => {
    if (!preview) return null
    const anterior = {}
    data.forEach(d => { anterior[String(d.cod_sede)] = d.total })
    const conocidas = new Set(sedesConocidas.map(s => String(s.cod_sede)))
    const filas = preview.sedes.map(s => {
      const cod = String(s.cod)
      const prev = anterior[cod]
      const conocida = conocidas.has(cod)
      return { ...s, cod, prev, conocida, dif: prev !== undefined ? s.total - prev : null }
    })
    const enArchivo = new Set(filas.map(f => f.cod))
    // Sedes del tablero que no vienen en el Excel: en este corte no tendrían dato
    const referencia = tieneData ? data.map(d => ({ cod: String(d.cod_sede), sede: d.sede })) : sedesConocidas.map(s => ({ cod: String(s.cod_sede), sede: s.sede }))
    const faltantes = referencia.filter(r => !enArchivo.has(r.cod))
    const bajaron = filas.filter(f => f.conocida && f.dif !== null && f.dif < 0)
    const validas = filas.filter(f => f.conocida)
    const totalNuevo = validas.reduce((a, f) => a + f.total, 0)
    const totalPrevMismas = validas.reduce((a, f) => a + (f.prev ?? 0), 0)
    const orden = (f) => (!f.conocida ? 0 : f.dif !== null && f.dif < 0 ? 1 : 2)
    filas.sort((a, b) => orden(a) - orden(b) || nombreCorto(a.sede).localeCompare(nombreCorto(b.sede)))
    return { filas, faltantes, bajaron, validas, totalNuevo, difTotal: tieneData ? totalNuevo - totalPrevMismas : null }
  }, [preview, data, sedesConocidas, tieneData])

  const fechaFinalEstado = preview ? (fechaElegida || (!preview.meta.fechaAmbigua ? preview.meta.fechaCorte : null)) : null
  const fechaFinal = fechaFinalEstado
  const yaExiste = !!fechaFinal && fechasCargadas.has(fechaFinal)
  const reemplaza = yaExiste || modoReemplazar

  const confirmarCarga = async (fechaOverride) => {
    const fechaFinal = fechaOverride || fechaFinalEstado
    if (!preview || !fechaFinal) return
    setConfirmando(true)
    setError(null)
    try {
      const reemplazar = reemplaza || fechasCargadas.has(fechaFinal)
      await onUpload(preview.sedes, preview.fileName, reemplazar, fechaFinal)
      onGuardado?.(`Corte del ${fmtCorto(fechaFinal)} ${reemplazar ? 'reemplazado' : 'guardado'}: ${chequeo.validas.length} sedes, ${chequeo.totalNuevo} inscriptos.`)
      setPreview(null)
      setModoReemplazar(false)
      setMinimized(true)
    } catch (e) {
      if (e.message && e.message.includes('Ya existe')) {
        setModoReemplazar(true)
        setError(null)
      } else {
        setError(e.message)
      }
    }
    setConfirmando(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const cancelarPreview = () => { setPreview(null); setModoReemplazar(false); setError(null); if (inputRef.current) inputRef.current.value = '' }

  const marco = { background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18, fontFamily: F.body }

  // ── Vista previa: todo lo que hay que mirar antes de guardar ─────────────
  if (preview && chequeo) {
    const m = preview.meta
    const ambiguaSinElegir = m.fechaCorte && m.fechaAmbigua && !fechaElegida
    const puedeGuardar = !!fechaFinal && chequeo.validas.length > 0 && !confirmando
    const anteriorAlUltimo = fechaFinal && fechaActual && fechaFinal < fechaActual

    return (
      <section aria-label="Revisar el Excel antes de guardarlo" className="animate-fadeUp" style={marco}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.ruleSoft}` }}>
          <IconoPlanilla />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, fontStretch: '105%' }}>Revisá el corte antes de guardarlo</div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.fileName}</div>
          </div>
          <button onClick={cancelarPreview} disabled={confirmando} style={{ ...btnSecundario, height: 38 }}>Cancelar</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Los tres datos que definen el corte */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <div style={{ borderLeft: `4px solid ${fechaFinal ? C.navy : C.crimson}`, padding: '2px 0 2px 12px' }}>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Fecha del corte</div>
              {fechaFinal
                ? <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, marginTop: 3 }}>{fechaEnPalabras(fechaFinal)}</div>
                : <div style={{ fontSize: 15, fontWeight: 800, color: C.crimson, marginTop: 3 }}>Elegila abajo</div>}
            </div>
            <div style={{ borderLeft: `4px solid ${chequeo.faltantes.length ? C.warn : C.ok}`, padding: '2px 0 2px 12px' }}>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Sedes</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, marginTop: 3 }}>
                {chequeo.validas.length}{tieneData ? <span style={{ color: C.inkSoft, fontWeight: 600 }}> de {data.length}</span> : ''}
              </div>
            </div>
            <div style={{ borderLeft: `4px solid ${C.navy}`, padding: '2px 0 2px 12px' }}>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Inscriptos</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, marginTop: 3 }}>
                {chequeo.totalNuevo}
                {chequeo.difTotal !== null && (
                  <span style={{ fontSize: 13.5, fontWeight: 700, marginLeft: 8, color: chequeo.difTotal > 0 ? C.ok : chequeo.difTotal < 0 ? C.crimson : C.inkSoft }}>
                    {chequeo.difTotal > 0 ? '+' : ''}{chequeo.difTotal} vs {fmtCorto(fechaActual)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Avisos, de lo que bloquea a lo informativo */}
          {ambiguaSinElegir && (
            <AvisoCarga tono="bloquea" titulo="¿Qué fecha es el corte?">
              El Excel dice “{m.columnaTotal}”, que se puede leer de dos formas. Tocá la correcta y el corte se guarda con esa fecha:
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {[m.fechaCorte, invertirDiaMes(m.fechaCorte)].map(op => (
                  <button key={op} disabled={confirmando} onClick={() => { setFechaElegida(op); confirmarCarga(op) }} style={{ ...btnSecundario, height: 38, borderColor: C.crimson, color: '#8E0C22', fontWeight: 800 }}>
                    Guardar como {fechaEnPalabras(op)}
                  </button>
                ))}
              </div>
            </AvisoCarga>
          )}
          {!m.fechaCorte && (
            <AvisoCarga tono="revisar" titulo="El Excel no trae la fecha del corte">
              Elegí de qué fecha es:
              <input type="date" value={fechaElegida || ''} onChange={e => setFechaElegida(e.target.value)} aria-label="Fecha del corte"
                style={{ display: 'block', marginTop: 8, height: 38, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.rule}`, fontFamily: F.body, fontSize: 14 }} />
            </AvisoCarga>
          )}
          {reemplaza && (
            <AvisoCarga tono="revisar" titulo={`Ya hay un corte del ${fmtCorto(fechaFinal)} cargado`}>
              Si seguís, este Excel lo reemplaza. Si te equivocás, se vuelve atrás con “Deshacer la última carga”.
            </AvisoCarga>
          )}
          {chequeo.faltantes.length > 0 && (
            <AvisoCarga tono="revisar" titulo={`${chequeo.faltantes.length === 1 ? 'Falta 1 sede' : `Faltan ${chequeo.faltantes.length} sedes`} en este Excel`}
              chips={chequeo.faltantes.map(f => nombreCorto(f.sede))}>
              {chequeo.faltantes.length === 1 ? 'No va a tener dato' : 'No van a tener dato'} en este corte y {chequeo.faltantes.length === 1 ? 'desaparece' : 'desaparecen'} del tablero hasta el próximo. ¿Es el Excel completo?
            </AvisoCarga>
          )}
          {m.sinMatch?.length > 0 && (
            <AvisoCarga tono="revisar" titulo={`${m.sinMatch.length === 1 ? '1 fila no corresponde' : `${m.sinMatch.length} filas no corresponden`} a ninguna sede registrada`}
              chips={m.sinMatch.map(s => `${s.cod} · ${s.sede || 'sin nombre'}`)}>
              No se guardan. Si es una sede nueva, sumala primero en Sedes → Sedes y objetivos.
            </AvisoCarga>
          )}
          {chequeo.bajaron.length > 0 && (
            <AvisoCarga tono="revisar" titulo={`${chequeo.bajaron.length === 1 ? '1 sede tiene' : `${chequeo.bajaron.length} sedes tienen`} menos inscriptos que en el corte del ${fmtCorto(fechaActual)}`}
              chips={chequeo.bajaron.map(f => `${nombreCorto(f.sede)} ${f.prev} → ${f.total}`)}>
              {anteriorAlUltimo ? 'Es normal si estás cargando un corte anterior al último.' : 'Los inscriptos se acumulan, así que suele ser un error del Excel. Revisalo antes de guardar.'}
            </AvisoCarga>
          )}
          {m.duplicados?.length > 0 && (
            <AvisoCarga tono="info" titulo={`${m.duplicados.length === 1 ? 'Un código aparece' : `${m.duplicados.length} códigos aparecen`} más de una vez`} chips={m.duplicados}>
              Se guarda la última fila de cada uno.
            </AvisoCarga>
          )}
          {m.filasInvalidas?.length > 0 && (
            <AvisoCarga tono="revisar" titulo={`${m.filasInvalidas.length === 1 ? '1 fila tiene' : `${m.filasInvalidas.length} filas tienen`} un total que no es un número`}
              chips={m.filasInvalidas.map(s => `${s.cod} · “${s.valor}”`)}>
              No se guardan.
            </AvisoCarga>
          )}
          {!m.detectadoPorFecha && m.fechaCorte === null && (
            <AvisoCarga tono="info" titulo={`Se toman los totales de la columna “${m.columnaTotal}”`}>Verificá que sea la columna correcta.</AvisoCarga>
          )}

          {/* Todas las filas: primero las que conviene mirar */}
          <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr>
                    {['Sede', tieneData ? `Corte ${fmtCorto(fechaActual)}` : null, 'Este Excel', tieneData ? 'Diferencia' : null].filter(Boolean).map((h, i) => (
                      <th key={h} style={{ position: 'sticky', top: 0, background: '#FAFBFD', padding: '9px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 12, fontWeight: 600, color: C.inkSoft, borderBottom: `1px solid ${C.rule}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chequeo.filas.map(f => (
                    <tr key={f.cod} style={{ borderTop: `1px solid ${C.ruleSoft}`, background: !f.conocida ? '#FDF1F3' : f.dif !== null && f.dif < 0 ? '#FBF3E2' : 'transparent' }}>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontWeight: 600, color: C.ink }}>{nombreCorto(f.sede) || f.cod}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>{f.cod}</span>
                        {!f.conocida && <span style={{ fontSize: 11.5, color: '#8E0C22', fontWeight: 700, marginLeft: 8 }}>no se guarda</span>}
                      </td>
                      {tieneData && <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: F.mono, color: C.inkSoft }}>{f.prev ?? '—'}</td>}
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: F.mono, fontWeight: 700, color: C.ink }}>{f.total}</td>
                      {tieneData && (
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: F.mono, fontWeight: 700, color: f.dif > 0 ? C.ok : f.dif < 0 ? C.crimson : C.inkSoft }}>
                          {f.dif === null ? '—' : f.dif > 0 ? `+${f.dif}` : f.dif === 0 ? '=' : f.dif}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <AvisoCarga tono="bloquea" titulo="No se pudo guardar">{error}</AvisoCarga>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => confirmarCarga()} disabled={!puedeGuardar} className="btn-press" style={{
              ...btnPrimario, background: reemplaza ? C.warn : C.navy,
              opacity: puedeGuardar ? 1 : 0.45, cursor: puedeGuardar ? 'pointer' : 'not-allowed',
            }}>
              {confirmando ? 'Guardando…'
                : !fechaFinal ? 'Elegí la fecha para guardar'
                : reemplaza ? `Reemplazar el corte del ${fmtCorto(fechaFinal)}`
                : `Guardar el corte del ${fmtCorto(fechaFinal)}`}
            </button>
            <button onClick={cancelarPreview} disabled={confirmando} style={btnSecundario}>Cancelar</button>
            {chequeo.validas.length > 0 && fechaFinal && (
              <span style={{ fontSize: 13, color: C.inkSoft }}>Se guardan {chequeo.validas.length} sedes en {camp?.nombre}.</span>
            )}
          </div>
        </div>
      </section>
    )
  }

  // Plegado: con el padre controlando, el botón vive en la línea de la semana
  if (isMinimized && controlado) return null
  if (isMinimized) {
    return (
      <div style={{ ...marco, padding: '12px 14px 12px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <IconoPlanilla />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Carga semanal</div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>
            Último corte cargado: <strong style={{ color: C.ink }}>{fmtCorto(fechaActual) || '—'}</strong> · {data.length} sedes
          </div>
        </div>
        <button onClick={() => { if (inputRef.current) inputRef.current.value = ''; setMinimized(false) }} className="btn-press" style={{ ...btnPrimario, height: 38 }}>
          Cargar Excel del corte
        </button>
      </div>
    )
  }

  // Abierto: zona para soltar el archivo
  return (
    <section aria-label="Cargar el Excel del corte" className="animate-fadeUp" style={marco}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${C.ruleSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconoPlanilla />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, fontStretch: '105%' }}>Cargar el Excel del corte</div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>
              {camp ? camp.nombre : 'Elegí la campaña primero'} · antes de guardar vas a ver una revisión completa
            </div>
          </div>
        </div>
        {tieneData && (
          <button onClick={() => setMinimized(true)} style={{ ...btnSecundario, height: 38 }}>Cancelar</button>
        )}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        role="button" tabIndex={0} aria-label="Elegir el Excel del corte"
        style={{
          margin: 16, border: `2px dashed ${dragging ? C.navy : loading ? C.celeste : '#C9D0DC'}`,
          borderRadius: 12, padding: '34px 20px', textAlign: 'center',
          cursor: loading ? 'wait' : 'pointer', background: dragging ? C.celesteSoft : '#F6F8FB', transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragging ? C.navy : C.inkSoft} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: loading ? 'pulse-ring 1s ease infinite' : 'none' }} aria-hidden="true">
            <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
          {loading ? 'Leyendo el Excel…' : dragging ? 'Soltalo acá' : 'Arrastrá el Excel acá o tocá para elegirlo'}
        </div>
        <div style={{ fontSize: 12.5, color: C.inkSoft }}>
          El mismo Excel de cada semana (.xlsx o .xls). La fecha y la columna de totales se detectan solas.
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 16px 16px' }}>
          <AvisoCarga tono="bloquea" titulo="No se pudo leer el Excel">{error}</AvisoCarga>
        </div>
      )}
    </section>
  )
}
