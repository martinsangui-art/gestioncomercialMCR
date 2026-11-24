import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { C, F, panel, rotulo, cifra } from '../lib/theme'
import { hoyIso, fmtFecha } from '../lib/formato'
import { useIsMobile } from '../hooks/useIsMobile'
import { obtenerBitacora, redactarInforme } from '../hooks/useSheets'
import {
  semanaDe, sumarDias, etiquetaSemana, corteDeLaSemana, tablaComoVamos, armarInforme,
  redaccionBase, huellaNotas, huellaItem, avisosNotas, tituloAnotacion, ddmm, fmtPct, controlarRedaccion,
} from '../lib/informe'
import { descargarDocx, htmlInforme } from '../lib/informeDocx'
import { headerPDF, footerPDF, abrirVentanaPDF } from '../components/InformesPDF'
import { precargarAssetsPDF } from '../lib/assetsPDF'

// Campos editables de cada tipo de anotación (en el editor, una viñeta por renglón)
const CAMPOS = {
  reunion: [['motivo', 'Motivo', true], ['resultado', 'Resultado', true]],
  auditoria: [['resultado', 'Resultado', true], ['acciones', 'Acciones de mejora', true]],
  observacion: [['texto', 'Texto', false]],
  semana: [['texto', 'Texto', false]],
}
const ETIQUETA_TIPO = { reunion: 'Reunión', auditoria: 'Auditoría', observacion: 'Observación', semana: 'Toda la semana' }
const tipoDe = (it) => (CAMPOS[it.tipo] ? it.tipo : 'observacion')
const unir = (...xs) => xs.map(x => String(x || '').trim()).filter(Boolean).join('\n')
function entradaClaude(it) {
  const t = tipoDe(it)
  if (t === 'reunion') return { tipo: t, motivo: it.motivo, resultado: unir(it.resultado, it.acciones), acciones: '' }
  if (t === 'auditoria') return { tipo: t, motivo: '', resultado: unir(it.motivo, it.resultado), acciones: it.acciones }
  return { tipo: t, motivo: '', resultado: unir(it.motivo, it.resultado, it.acciones), acciones: '' }
}

// La redacción se guarda como texto (lo que se ve en el editor) y se pasa a
// viñetas recién al armar el informe: así se puede escribir un renglón nuevo.
const aTexto = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : String(v ?? '')]))
// Las viñetas del editor son una por renglón (el ";" se respeta como texto)
const lineas = (s) => String(s || '').split('\n').map(x => x.replace(/^\s*[-–•*·]\s*/, '').trim()).filter(Boolean)

const claveGuardado = (camp, lunes) => `informe-semanal:${camp}:${lunes}`
function leerGuardado(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento: queda en memoria */ }
}

function Boton({ children, onClick, tono = 'principal', disabled, title }) {
  const estilos = {
    principal: { background: C.navy, color: '#fff', border: 'none' },
    secundario: { background: '#fff', color: C.navy, border: `1px solid ${C.rule}` },
    claude: { background: C.ink, color: '#fff', border: 'none' },
  }[tono]
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="btn-press" style={{
      height: 40, padding: '0 16px', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: F.body,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 8, ...estilos,
    }}>{children}</button>
  )
}

function Aviso({ tono = 'warn', children }) {
  const col = tono === 'error' ? C.crimson : tono === 'info' ? C.navy : C.warn
  const fondo = tono === 'error' ? '#FBE7EA' : tono === 'info' ? C.celesteSoft : '#FBF0D9'
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} style={{
      borderLeft: `4px solid ${col}`, background: fondo, padding: '10px 14px', borderRadius: '0 8px 8px 0',
      fontSize: 13.5, lineHeight: 1.5, color: C.ink, fontFamily: F.body,
    }}>{children}</div>
  )
}

function TablaSedes({ tabla, columnaObjetivo, columnaCorte }) {
  const th = { ...rotulo, fontSize: 10.5, padding: '8px 10px', textAlign: 'left', borderBottom: `2px solid ${C.ink}`, position: 'sticky', top: 0, background: '#FFF7B0' }
  const td = { padding: '5px 10px', borderBottom: `1px solid ${C.ruleSoft}`, fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={{ maxHeight: 420, overflow: 'auto', border: `1px solid ${C.rule}`, borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: F.body }}>
        <thead><tr>
          <th style={th}>Cod</th><th style={th}>Sede</th>
          <th style={{ ...th, textAlign: 'center' }}>{columnaObjetivo}</th>
          <th style={{ ...th, textAlign: 'right' }}>% Objetivo</th>
          <th style={{ ...th, textAlign: 'center' }}>{columnaCorte}</th>
        </tr></thead>
        <tbody>
          {tabla.filas.map(f => (
            <tr key={f.cod}>
              <td style={{ ...td, fontFamily: F.mono, color: C.inkSoft }}>{f.cod}</td>
              <td style={td}>{f.sede}</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 800 }}>{f.objetivo}</td>
              <td style={{ ...td, textAlign: 'right', color: f.pct >= 100 ? C.ok : f.pct === 0 ? C.crimson : C.ink }}>{fmtPct(f.pct)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{f.total}</td>
            </tr>
          ))}
          <tr style={{ background: '#FFF7B0', fontWeight: 800 }}>
            <td style={td} /><td style={td}>TOTAL</td>
            <td style={{ ...td, textAlign: 'center' }}>{tabla.totales.objetivo}</td>
            <td style={{ ...td, textAlign: 'right' }}>{fmtPct(tabla.totales.pct)}</td>
            <td style={{ ...td, textAlign: 'center' }}>{tabla.totales.total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Anotacion({ it, titulo, txt, origen, motivoRevisar, bloqueado, onCambio }) {
  const tipo = tipoDe(it)
  const notaOriginal = [['Motivo', it.motivo], ['Resultado', it.resultado], ['Acciones', it.acciones]].filter(([, v]) => v)
  const etiquetaOrigen = { claude: ['Redactado por Claude', C.ink], editado: ['Editado', C.navy], notas: ['Tus notas', C.inkSoft], faltante: ['Claude no lo devolvió: quedan tus notas', C.crimson], revisar: ['Revisá contra la nota original', C.crimson] }[origen] || ['Tus notas', C.inkSoft]
  return (
    <div style={{ ...panel({ padding: 16 }), borderLeft: `4px solid ${tipo === 'reunion' ? C.navy : tipo === 'auditoria' ? C.warn : C.celeste}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ ...rotulo, color: C.navy }}>{ETIQUETA_TIPO[tipo]}</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>
          {tipo === 'semana' ? 'Durante la semana' : ddmm(it.fecha)}{it.hora ? ` · ${it.hora} HS` : ''}{titulo ? ` — ${titulo}` : ''}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: etiquetaOrigen[1], fontFamily: F.mono }}>{etiquetaOrigen[0]}</span>
      </div>
      {origen === 'revisar' && motivoRevisar && (
        <div style={{ marginBottom: 10 }}><Aviso tono="error">Ojo: {motivoRevisar}. Compará con la nota original y corregí si hace falta.</Aviso></div>
      )}
      {CAMPOS[tipo].map(([campo, label, vinetas]) => (
        <label key={campo} style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 4 }}>
            {label}{vinetas && <span style={{ fontWeight: 400 }}> · una viñeta por renglón</span>}
          </div>
          <textarea
            value={txt[campo] || ''}
            onChange={e => onCambio(campo, e.target.value)}
            readOnly={bloqueado}
            rows={Math.max(2, Math.min(10, (txt[campo] || '').split('\n').length + 1))}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.rule}`,
              fontFamily: F.body, fontSize: 14, lineHeight: 1.5, color: C.ink, resize: 'vertical', background: '#fff',
            }}
          />
        </label>
      ))}
      {origen !== 'notas' && notaOriginal.length > 0 && (
        <details open={origen === 'revisar'} style={{ fontSize: 12.5, color: C.inkSoft }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver la nota original (fila {it.fila} de la planilla)</summary>
          {notaOriginal.map(([k, v]) => (
            <div key={k} style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}><b>{k}:</b> {v}</div>
          ))}
        </details>
      )}
    </div>
  )
}

export default function Informe({ data, historial, campanas, campanaActiva, sedes }) {
  const isMobile = useIsMobile()
  const hoy = hoyIso()
  const lunesHoy = semanaDe(hoy).lunes
  const [lunes, setLunes] = useState(lunesHoy)
  const semana = useMemo(() => semanaDe(lunes), [lunes])
  const camp = campanas?.find(c => c.id === campanaActiva)

  const [bitacora, setBitacora] = useState(null) // { items, sinFecha }
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [textos, setTextos] = useState({})    // id → { campo: texto }
  const [origen, setOrigen] = useState({})    // id → 'notas' | 'claude' | 'editado' | 'faltante' | 'revisar'
  const [revisar, setRevisar] = useState({})  // id → por qué revisar lo de Claude
  const [redactando, setRedactando] = useState(false)
  const [errorClaude, setErrorClaude] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [verTabla, setVerTabla] = useState(false)

  useEffect(() => { precargarAssetsPDF() }, [])

  // Semana que se está mirando ahora: una respuesta que llega tarde (de la
  // planilla o de Claude) para otra semana se descarta, no pisa esta.
  const vigente = useRef(lunes)
  vigente.current = lunes
  const cargar = useCallback(() => {
    const pedida = semana.lunes
    setCargando(true); setError(null); setErrorClaude(null); setBitacora(null)
    obtenerBitacora(semana.lunes, semana.domingo)
      .then(b => { if (vigente.current === pedida) setBitacora({ items: b?.items || [], sinFecha: b?.sinFecha || [] }) })
      .catch(e => { if (vigente.current === pedida) { setBitacora(null); setError(e.message) } })
      .finally(() => { if (vigente.current === pedida) setCargando(false) })
  }, [semana.lunes, semana.domingo])
  useEffect(() => { cargar() }, [cargar])

  const items = bitacora?.items || []
  const huella = useMemo(() => huellaNotas(items), [items])
  const huellaRef = useRef(huella)
  huellaRef.current = huella
  const clave = claveGuardado(campanaActiva, semana.lunes)

  // Al llegar las notas: si hay una redacción guardada de ESTAS mismas notas,
  // se recupera; si no, arranca con las notas tal cual.
  const [redaccionVieja, setRedaccionVieja] = useState(false)
  useEffect(() => {
    if (!bitacora) return
    const g = leerGuardado(clave)
    const base = {}, org = {}
    items.forEach(it => { base[it.id] = aTexto(redaccionBase({ ...it, tipo: tipoDe(it) })); org[it.id] = 'notas' })
    // Se recupera cada anotación cuya nota no cambió desde que se redactó;
    // las que cambiaron (o son nuevas) vuelven a las notas tal cual.
    let cambiaron = 0
    const rev = {}
    if (g?.porItem) {
      items.forEach(it => {
        const guardada = g.porItem[it.id]
        if (!guardada) return
        if (guardada.huella !== huellaItem(it)) { cambiaron++; return }
        base[it.id] = guardada.texto; org[it.id] = guardada.origen || 'editado'
        if (guardada.revisar) rev[it.id] = guardada.revisar
      })
    }
    setRedaccionVieja(cambiaron > 0)
    setTextos(base); setOrigen(org); setRevisar(rev)
  }, [bitacora]) // eslint-disable-line

  useEffect(() => {
    if (!bitacora || !items.length) return
    const porItem = {}
    items.forEach(it => {
      if (!textos[it.id] || origen[it.id] === 'notas' || !origen[it.id]) return
      porItem[it.id] = { huella: huellaItem(it), texto: textos[it.id], origen: origen[it.id], revisar: revisar[it.id] }
    })
    if (!Object.keys(porItem).length) return // nada propio que guardar
    guardar(clave, { porItem, guardado: new Date().toISOString() })
  }, [textos, origen]) // eslint-disable-line

  const corte = useMemo(() => corteDeLaSemana(historial, semana), [historial, semana])
  const ultimoCorte = useMemo(() => (historial || []).reduce((m, r) => (String(r.fecha).slice(0, 10) > m ? String(r.fecha).slice(0, 10) : m), ''), [historial])
  const tabla = useMemo(() => corte.fecha ? tablaComoVamos(data, historial, corte.fecha) : null, [data, historial, corte.fecha])
  const listaSedes = sedes?.length ? sedes : data

  const redaccion = useMemo(() => {
    const r = {}
    Object.entries(textos).forEach(([id, t]) => {
      r[id] = { motivo: lineas(t.motivo), resultado: lineas(t.resultado), acciones: lineas(t.acciones), texto: String(t.texto || '').trim() }
    })
    return r
  }, [textos])

  const informe = useMemo(() => tabla && armarInforme({
    semana, campanaNombre: camp?.nombre, tabla, fechaCorte: corte.fecha, items, redaccion, sedes: listaSedes,
  }), [tabla, semana, camp?.nombre, corte.fecha, items, redaccion, listaSedes])

  const avisos = useMemo(() => avisosNotas(items, bitacora?.sinFecha), [items, bitacora])
  const cuenta = useMemo(() => {
    const c = { reunion: 0, auditoria: 0, observacion: 0, semana: 0 }
    items.forEach(it => { c[tipoDe(it)]++ })
    return c
  }, [items])

  const cambiar = (id, campo, valor) => {
    setTextos(t => ({ ...t, [id]: { ...t[id], [campo]: valor } }))
    setOrigen(o => ({ ...o, [id]: 'editado' }))
  }

  const conClaude = async () => {
    if (Object.values(origen).some(o => o === 'editado') &&
      !window.confirm('Claude va a reescribir todas las anotaciones y se pierden los cambios que hiciste acá. ¿Seguimos?')) return
    const pedida = lunes, huellaPedida = huella
    const entradas = Object.fromEntries(items.map(it => [it.id, entradaClaude(it)]))
    setRedactando(true); setErrorClaude(null)
    try {
      const r = await redactarInforme(items.map(it => ({ id: it.id, sede: tituloAnotacion(it.sede, listaSedes), ...entradas[it.id] })))
      // Cambió la semana o las notas mientras Claude redactaba: no se aplica
      if (vigente.current !== pedida || huellaRef.current !== huellaPedida) return
      const nuevosT = {}, nuevosO = {}, nuevosR = {}
      ;(r?.items || []).forEach(x => {
        const it = items.find(i => i.id === x.id)
        if (!it) return
        if (x.faltante) { nuevosO[x.id] = 'faltante'; return }
        const t = tipoDe(it)
        const salida = t === 'reunion' ? { motivo: x.motivo, resultado: x.resultado }
          : t === 'auditoria' ? { resultado: x.resultado, acciones: x.acciones }
          : { texto: x.texto }
        const problema = controlarRedaccion(entradas[x.id], salida)
        nuevosT[x.id] = aTexto(salida)
        nuevosO[x.id] = problema ? 'revisar' : 'claude'
        if (problema) nuevosR[x.id] = problema
      })
      setTextos(prev => ({ ...prev, ...nuevosT }))
      setOrigen(prev => ({ ...prev, ...nuevosO }))
      setRevisar(nuevosR); setRedaccionVieja(false)
    } catch (e) {
      setErrorClaude(e.message === 'SIN_API_KEY'
        ? 'Todavía no está cargada la clave de Claude en la planilla. Mientras tanto podés armar el informe con tus notas tal cual.'
        : `No se pudo redactar con Claude: ${e.message}`)
    } finally { setRedactando(false) }
  }

  const volverANotas = () => {
    if (!window.confirm('Se descarta la redacción de Claude y tus cambios: vuelven tus notas tal cual. ¿Seguimos?')) return
    const base = {}, org = {}
    items.forEach(it => { base[it.id] = aTexto(redaccionBase({ ...it, tipo: tipoDe(it) })); org[it.id] = 'notas' })
    setTextos(base); setOrigen(org); setRevisar({})
    try { localStorage.removeItem(clave) } catch { /* nada */ }
  }

  const bajarWord = async () => {
    setGenerando(true); setMensaje(null)
    try {
      await descargarDocx(informe)
      setMensaje('Word descargado. Si lo retocás, cerralo con Archivo › Guardar como › PDF: ya lleva el logo y la firma.')
    } catch (e) { setMensaje(`No se pudo armar el Word: ${e.message}`) }
    finally { setGenerando(false) }
  }

  // Sin await antes de abrir: Safari bloquea la pestaña si hay algo asincrónico
  // entre el click y la apertura (el logo y la firma ya se precargaron).
  const abrirPDF = () => {
    abrirVentanaPDF(htmlInforme(informe, { headerPDF, footerPDF, fechaCorte: corte.fecha, campNombre: escHtml(camp?.nombre || '') }), setMensaje)
  }

  const hayClaudeOEdicion = Object.values(origen).some(o => o !== 'notas')
  const puedeGenerar = !!informe && !cargando && !error && !redactando

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F.body }}>
      {/* Semana + acciones */}
      <div style={{ ...panel({ padding: isMobile ? 14 : '16px 20px' }), display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))} disabled={redactando} className="btn-press" style={flecha}>‹</button>
          <div style={{ minWidth: isMobile ? 0 : 290, textAlign: 'center' }}>
            <div style={{ ...rotulo, color: C.navy }}>{lunes === lunesHoy ? 'Esta semana' : 'Semana'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontStretch: '108%', color: C.ink }}>{etiquetaSemana(semana)}</div>
          </div>
          <button aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))} disabled={lunes >= lunesHoy || redactando} className="btn-press" style={{ ...flecha, opacity: lunes >= lunesHoy ? 0.3 : 1 }}>›</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Boton onClick={bajarWord} disabled={!puedeGenerar || generando}>{generando ? 'Armando…' : 'Descargar Word'}</Boton>
          <Boton tono="secundario" onClick={abrirPDF} disabled={!puedeGenerar} title="PDF con lo que está en pantalla, sin pasar por Word">PDF final</Boton>
        </div>
        {mensaje && <div style={{ flexBasis: '100%' }}><Aviso tono="info">{mensaje}</Aviso></div>}
      </div>

      {/* 1. Cómo vamos por sede */}
      <section style={panel({ padding: isMobile ? 14 : 20 })}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={h2}>Cómo vamos por sede</h2>
          {corte.fecha && <span style={{ fontSize: 13, color: C.inkSoft }}>Corte del {fmtFecha(corte.fecha)}</span>}
          {tabla && <button onClick={() => setVerTabla(v => !v)} style={linkBtn}>{verTabla ? 'Ocultar tabla' : 'Ver la tabla como sale en el informe'}</button>}
        </div>
        {!corte.fecha && <Aviso tono="error">No hay ningún corte cargado hasta el viernes {fmtFecha(semana.viernes)} en esta campaña: sin corte no se puede armar el informe.</Aviso>}
        {corte.fecha && !corte.deEstaSemana && (
          <Aviso>Esta semana no se cargó ningún corte: el informe usa el último, del {fmtFecha(corte.fecha)}. Si falta subir el Excel de esta semana, cargalo primero.</Aviso>
        )}
        {tabla?.fueraDeLista.length > 0 && (
          <div style={{ marginTop: 8 }}><Aviso>Están en ese corte pero no entre las sedes activas, así que no se suman ni salen en la tabla: {tabla.fueraDeLista.map(f => `${f.sede} (${f.total})`).join(', ')}.</Aviso></div>
        )}
        {corte.fecha && ultimoCorte && corte.fecha !== ultimoCorte && (
          <div style={{ marginTop: 8 }}><Aviso tono="info">Es una semana anterior: los objetivos son los vigentes hoy en la app.</Aviso></div>
        )}
        {tabla?.faltan.length > 0 && (
          <div style={{ marginTop: 8 }}><Aviso>No están en ese corte (salen con 0): {tabla.faltan.join(', ')}.</Aviso></div>
        )}
        {tabla && (
          <div style={{ display: 'flex', gap: isMobile ? 18 : 36, flexWrap: 'wrap', marginTop: 12 }}>
            {[['Objetivo', tabla.totales.objetivo], ['Inscriptos', tabla.totales.total], ['Cumplimiento', fmtPct(tabla.totales.pct)], ['Sedes', tabla.filas.length]].map(([l, v]) => (
              <div key={l}><div style={cifra(30, { color: C.ink })}>{v}</div><div style={{ ...rotulo, marginTop: 4 }}>{l}</div></div>
            ))}
          </div>
        )}
        {tabla && verTabla && <div style={{ marginTop: 14 }}><TablaSedes tabla={tabla} columnaObjetivo={informe.columnaObjetivo} columnaCorte={informe.columnaCorte} /></div>}
      </section>

      {/* 2–4. Anotaciones */}
      <section style={panel({ padding: isMobile ? 14 : 20 })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <h2 style={h2}>Auditorías, reuniones y observaciones</h2>
          <button onClick={cargar} disabled={cargando || redactando} style={linkBtn}>{cargando ? 'Leyendo la planilla…' : 'Volver a leer la planilla'}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hayClaudeOEdicion && <Boton tono="secundario" onClick={volverANotas} disabled={redactando}>Volver a mis notas</Boton>}
            <Boton tono="claude" onClick={conClaude} disabled={!items.length || redactando || cargando}>
              {redactando ? 'Claude está redactando…' : 'Redactar con Claude'}
            </Boton>
          </div>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>
          Salen de la pestaña <b>bitacora</b> de la planilla. Claude solo pule la redacción: no agrega datos ni toca los números. Revisá y corregí acá antes de bajar el Word.
        </p>

        {error && <Aviso tono="error">No se pudieron leer las anotaciones: {error}</Aviso>}
        {errorClaude && <div style={{ marginBottom: 12 }}><Aviso tono="error">{errorClaude}</Aviso></div>}
        {redaccionVieja && <div style={{ marginBottom: 12 }}><Aviso tono="info">Algunas anotaciones cambiaron en la planilla desde la última redacción: esas vuelven a tus notas tal cual (el resto conserva lo que ya estaba). Si querés, volvé a redactar con Claude.</Aviso></div>}
        {avisos.length > 0 && (
          <div style={{ marginBottom: 12 }}><Aviso>
            <b>Revisá en la planilla:</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{avisos.map(a => <li key={a}>{a}</li>)}</ul>
          </Aviso></div>
        )}

        {bitacora && !items.length && !error && (
          <Aviso tono="info">
            No hay anotaciones del {fmtFecha(semana.lunes)} al {fmtFecha(semana.domingo)}. En la pestaña <b>bitacora</b> va una fila por actividad:
            <b> fecha</b>, <b>tipo</b> (Reunión, Auditoría, Observación o Toda la semana), <b>sede</b> (o el tema), <b>hora</b> (reuniones),
            <b> motivo</b>, <b>resultado</b> y <b>acciones_mejora</b> (auditorías). Pueden ser notas sueltas: Claude las redacta. Sin anotaciones, el informe sale igual con la tabla y las secciones vacías.
          </Aviso>
        )}

        {items.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0 14px', fontSize: 13, color: C.inkSoft }}>
              {[['auditoria', 'auditorías'], ['reunion', 'reuniones'], ['observacion', 'observaciones'], ['semana', 'de toda la semana']].map(([k, l]) => (
                <span key={k}><b style={{ color: C.ink }}>{cuenta[k]}</b> {l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['auditoria', 'reunion', 'observacion', 'semana'].flatMap(t => items.filter(it => tipoDe(it) === t)).map(it => (
                <Anotacion key={it.id} it={it} titulo={tituloAnotacion(it.sede, listaSedes)} bloqueado={redactando}
                  txt={textos[it.id] || {}} origen={origen[it.id]} motivoRevisar={revisar[it.id]} onCambio={(c, v) => cambiar(it.id, c, v)} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const h2 = { margin: 0, fontFamily: F.display, fontSize: 19, fontWeight: 800, fontStretch: '108%', color: C.ink }
const flecha = {
  width: 38, height: 38, borderRadius: 8, border: `1px solid ${C.rule}`, background: '#fff', color: C.navy,
  fontSize: 22, fontWeight: 800, cursor: 'pointer', lineHeight: 1,
}
const linkBtn = { background: 'none', border: 'none', padding: 0, color: C.navy, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: F.body }
