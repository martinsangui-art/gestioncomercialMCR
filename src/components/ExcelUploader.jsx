import { useState, useRef, useMemo } from 'react'
import { C, F } from '../lib/theme'
import { fmtCorto, hoyIso as hoyLocal, nombreCorto } from '../lib/formato'
import { cargarXLSX } from '../lib/xlsxLoader'
import { parseCorte } from '../lib/parserCorte'
import { setObjetivo } from '../hooks/useSheets'

// El lector del Excel vive en lib/parserCorte.js (función pura, con pruebas
// en scripts/probar-parser.mjs). Acepta el Excel recortado de siempre o el
// NACIONAL completo: se queda solo con las sedes registradas en la app.

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
          {(chips.length > MAX_CHIPS ? chips.slice(0, MAX_CHIPS - 1) : chips).map((c, i) => (
            <span key={i} style={{ fontSize: 12, background: '#fff', border: `1px solid ${t.borde}55`, color: t.texto, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{c}</span>
          ))}
          {chips.length > MAX_CHIPS && (
            <span style={{ fontSize: 12, color: t.texto, padding: '3px 4px', fontWeight: 700 }}>y {chips.length - MAX_CHIPS + 1} más</span>
          )}
        </div>
      )}
    </div>
  )
}

const MAX_CHIPS = 14

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
  const [objetivosAplicados, setObjetivosAplicados] = useState(false)
  const [aplicandoObj, setAplicandoObj] = useState(false)
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
      const [buffer, XLSX] = await Promise.all([file.arrayBuffer(), cargarXLSX()])
      // Las sedes de la red son las registradas en la app: con eso el lector
      // separa lo propio del resto del país (si el Excel es el nacional).
      const { sedes, meta } = parseCorte(buffer, XLSX, { codigosRed: sedesConocidas.map(s => String(s.cod_sede)) })
      setPreview({ sedes, meta, fileName: file.name })
      setObjetivosAplicados(false)
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
    const anterior = {}, objApp = {}
    data.forEach(d => { anterior[String(d.cod_sede)] = d.total; objApp[String(d.cod_sede)] = d.objetivo })
    // Nombre: el registrado en la app (el del Excel nacional viene con código
    // y provincia pegados, "87-JUNIN - BS AS")
    const nombreApp = new Map(sedesConocidas.map(s => [String(s.cod_sede), s.sede]))
    const filas = preview.sedes.map(s => {
      const cod = String(s.cod)
      const prev = anterior[cod]
      const conocida = nombreApp.has(cod)
      return { ...s, cod, sede: nombreApp.get(cod) || s.sede, prev, conocida, dif: prev !== undefined ? s.total - prev : null }
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
    // El Excel nacional trae el objetivo de cada sede: si no coincide con el
    // cargado en la app, se avisa (y se puede actualizar desde acá mismo).
    const objDistintos = tieneData ? validas
      .filter(f => f.objetivoExcel != null && f.objetivoExcel > 0 && objApp[f.cod] !== undefined && Number(objApp[f.cod]) !== f.objetivoExcel)
      .map(f => ({ ...f, objApp: Number(objApp[f.cod]) })) : []
    return { filas, faltantes, bajaron, validas, totalNuevo, difTotal: tieneData ? totalNuevo - totalPrevMismas : null, objDistintos }
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

  const aplicarObjetivos = async () => {
    setAplicandoObj(true)
    setError(null)
    try {
      for (const f of chequeo.objDistintos) {
        await setObjetivo(campanaActiva, f.cod, f.objetivoExcel)
      }
      setObjetivosAplicados(true)
    } catch (e) {
      setError('No se pudieron actualizar los objetivos: ' + e.message)
    }
    setAplicandoObj(false)
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
    const puedeGuardar = !!fechaFinal && chequeo.validas.length > 0 && !confirmando && !aplicandoObj
    const anteriorAlUltimo = fechaFinal && fechaActual && fechaFinal < fechaActual

    return (
      <section aria-label="Revisar el Excel antes de guardarlo" className="animate-fadeUp" style={marco}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.ruleSoft}` }}>
          <IconoPlanilla />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, fontStretch: '105%' }}>Revisá el corte antes de guardarlo</div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preview.fileName}{preview.meta.esNacional ? ` · Excel nacional: se tomaron las ${chequeo.validas.length} sedes de tu zona` : ''}
            </div>
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
          {/* Con el Excel nacional, lo que no es de la zona no se muestra: a
              Cele solo le importa lo que se tomó. Con el Excel recortado, en
              cambio, una fila sin match es casi seguro una sede propia con el
              código mal, y ahí sí se avisa. */}
          {!m.esNacional && m.sinMatch?.length > 0 && (
            <AvisoCarga tono="revisar"
              titulo={`${m.sinMatch.length === 1 ? '1 fila no corresponde' : `${m.sinMatch.length} filas no corresponden`} a ninguna sede registrada`}
              chips={m.sinMatch.map(s => `${s.cod} · ${nombreCorto(s.sede) || 'sin nombre'}${s.total ? ` (${s.total})` : ''}`)}>
              No se guardan. Si {m.sinMatch.length === 1 ? 'es una sede' : 'son sedes'} de tu red, sumala{m.sinMatch.length === 1 ? '' : 's'} primero en Sedes → Sedes y objetivos y volvé a subir el Excel.
            </AvisoCarga>
          )}
          {m.sumadas?.length > 0 && (
            <AvisoCarga tono="info" titulo={`El Excel viene desglosado: se sumaron las filas de ${m.sumadas.length} sedes`}>
              Cada sede aparece varias veces (por carrera o modalidad) y se toma la suma. Revisá en la tabla que los totales tengan sentido.
            </AvisoCarga>
          )}
          {chequeo.objDistintos.length > 0 && (
            <AvisoCarga tono={objetivosAplicados ? 'info' : 'revisar'}
              titulo={objetivosAplicados
                ? `Listo: se actualizaron ${chequeo.objDistintos.length} objetivos`
                : `${chequeo.objDistintos.length === 1 ? '1 sede tiene' : `${chequeo.objDistintos.length} sedes tienen`} un objetivo distinto al de la app`}
              chips={chequeo.objDistintos.map(f => `${nombreCorto(f.sede)} ${f.objApp} → ${f.objetivoExcel}`)}>
              {objetivosAplicados
                ? 'El corte se va a guardar con los objetivos nuevos.'
                : <>
                    El Excel trae otro objetivo. Si el del Excel es el vigente, actualizalo antes de guardar el corte:
                    <div style={{ marginTop: 10 }}>
                      <button onClick={aplicarObjetivos} disabled={aplicandoObj || confirmando} style={{ ...btnSecundario, height: 36, fontWeight: 800, color: C.navy }}>
                        {aplicandoObj ? 'Actualizando…' : `Usar los objetivos del Excel (${chequeo.objDistintos.length})`}
                      </button>
                    </div>
                  </>}
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
                        {f.filas?.length > 0 && (
                          <span title="Fila del Excel de donde sale el número" style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>
                            · fila {f.filas.join('+')}
                          </span>
                        )}
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
          Sirve el Excel nacional tal como llega, con todas las sedes del país: la app se queda sola con las de tu zona. La fecha y la columna de totales se detectan solas.
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
