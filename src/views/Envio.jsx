import { useState, useRef, useEffect } from 'react'
import { enviarEmailViaScript, obtenerLogEnvios, enviarResumenCele, onAuthExpired, obtenerConfig, guardarConfig, confirmarEnvioLote } from '../hooks/useSheets'
import { C, F, panel, cifra } from '../lib/theme'
import ModalShell from '../components/ModalShell'
import { fmtFecha, hoyIso, nombreCorto, estadoSede } from '../lib/formato'

const BORRADOR_KEY = 'ucasal_borrador_semana'

const getEstado = estadoSede
function estadoColor(est) {
  return { ok: C.ok, prog: C.warn, cero: C.danger }[est]
}

// Escapa texto que viene de Sheets (editable por varias personas) antes de
// insertarlo en el HTML que se renderiza con dangerouslySetInnerHTML.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// Plantilla por defecto — se usa si todavía no se cargó/guardó una propia
// desde el editor. Coincide con el texto que mandaba la app antes de que la
// plantilla fuera editable, para no cambiar nada sin que alguien lo pida.
const DEFAULT_TEMPLATE = `<p>{{saludo}}:</p>
<p style="margin-top:6px">Enviamos el resultado del <strong>cómo vamos</strong> al {{fecha}}</p>
{{tabla}}
<p style="margin-top:8px">Quedamos a disposición para cualquier consulta o duda que puedas tener.</p>
<p style="margin-top:10px">Feliz fin de semana.<br>Saludos!</p>`

function renderTemplate(template, vars) {
  return String(template ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function buildTablaHTML(d, campNombre) {
  const color = { ok: '#0F8A5F', prog: '#A8752A', cero: '#C8102E' }[getEstado(d)]
  const varTxt = d.var !== null
    ? (d.var > 0 ? ` (+${d.var} vs semana anterior)`
      : d.var < 0 ? ` (${d.var} vs semana anterior)`
      : ' (sin variación)')
    : ''
  return `<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px">
  <tr style="background:#0E1733;color:#fff">
    <th style="padding:7px 10px;text-align:center;font-size:11px">COD SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">OBJETIVO ${campNombre.toUpperCase()}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">TOTAL AL ${fmtFecha(d.fecha)}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">% CUMPLIMIENTO</th>
  </tr>
  <tr>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.cod_sede}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${esc(d.sede)}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.objetivo}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.total}${varTxt}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb;color:${color};font-weight:700">${d.pct}%</td>
  </tr>
</table>`
}

function buildEmailHTML(d, campNombre, template) {
  return renderTemplate(template || DEFAULT_TEMPLATE, {
    saludo: esc(d.saludo),
    fecha: fmtFecha(d.fecha),
    tabla: buildTablaHTML(d, campNombre),
  })
}

// Convierte **texto** a <strong>texto</strong> — la única marca que alguien
// sin HTML necesita para resaltar algo en el mail — y su inversa, para poder
// mostrar de nuevo una plantilla guardada como texto editable.
const mdBoldToHtml = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
const htmlStrongToMd = (s) => s.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')

const CAMPOS_PLANTILLA_DEFAULT = {
  intro: 'Enviamos el resultado del **cómo vamos** al {{fecha}}',
  cierre: 'Quedamos a disposición para cualquier consulta o duda que puedas tener.',
  despedida: 'Feliz fin de semana.\nSaludos!',
}

// Arma el HTML final a partir de 3 campos de texto plano — quien edita el
// mail no necesita ver nunca una etiqueta HTML ni los placeholders
// {{saludo}}/{{tabla}}, que son siempre automáticos.
function buildTemplateFromFields({ intro, cierre, despedida }) {
  const introHtml = mdBoldToHtml(esc(intro))
  const cierreHtml = mdBoldToHtml(esc(cierre))
  const despedidaHtml = mdBoldToHtml(esc(despedida)).replace(/\n/g, '<br>')
  return `<p>{{saludo}}:</p>
<p style="margin-top:6px">${introHtml}</p>
{{tabla}}
<p style="margin-top:8px">${cierreHtml}</p>
<p style="margin-top:10px">${despedidaHtml}</p>`
}

// Intenta separar una plantilla HTML guardada en los 3 campos del editor
// simple. Si no calza con esa forma (alguien la customizó a mano con otra
// estructura en modo avanzado), devuelve null y el editor abre en avanzado
// para no pisar nada.
function parseTemplateToFields(template) {
  const re = /^<p>\{\{saludo\}\}:<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>\s*\{\{tabla\}\}\s*<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>\s*$/
  const m = String(template ?? '').trim().match(re)
  if (!m) return null
  return {
    intro: htmlStrongToMd(m[1]).trim(),
    cierre: htmlStrongToMd(m[2]).trim(),
    despedida: htmlStrongToMd(m[3]).replace(/<br\s*\/?>/gi, '\n').trim(),
  }
}

const campoLabelStyle = { display: 'block', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: F.body }
const campoFieldStyle = { width: '100%', padding: '10px 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontFamily: F.body, lineHeight: 1.5, resize: 'vertical' }
const linkBtnStyle = { fontSize: 11, color: C.inkSoft, fontFamily: F.body, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }

// Editor de la plantilla del email. Por defecto, 3 campos de texto plano sin
// ninguna etiqueta HTML a la vista — el saludo y la tabla de resultados se
// arman solos. Si la plantilla guardada ya tenía HTML propio que no calza
// con esa forma (editado antes a mano en modo avanzado), abre directo en
// avanzado para no pisar nada.
function EditorPlantillaModal({ template, sedeEjemplo, campNombre, onClose, onGuardado }) {
  const camposIniciales = parseTemplateToFields(template)
  const [modo, setModo] = useState(camposIniciales ? 'simple' : 'avanzado')
  const [campos, setCampos] = useState(camposIniciales || CAMPOS_PLANTILLA_DEFAULT)
  const [texto, setTexto] = useState(template)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const textoFinal = modo === 'simple' ? buildTemplateFromFields(campos) : texto

  const handleGuardar = async () => {
    setGuardando(true); setError(null)
    try {
      await guardarConfig({ EMAIL_TEMPLATE: textoFinal })
      onGuardado(textoFinal)
      onClose()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  const handleRestaurar = () => {
    setCampos(CAMPOS_PLANTILLA_DEFAULT)
    setTexto(DEFAULT_TEMPLATE)
  }

  const irAAvanzado = () => { setTexto(textoFinal); setError(null); setModo('avanzado') }
  const irASimple = () => {
    const parsed = parseTemplateToFields(texto)
    if (parsed) { setCampos(parsed); setError(null); setModo('simple') }
    else setError('Este HTML tiene una estructura personalizada — no se puede pasar al editor simple sin perder cambios. Podés seguir en modo avanzado.')
  }

  const preview = sedeEjemplo ? buildEmailHTML(sedeEjemplo, campNombre, textoFinal) : ''

  return (
    <ModalShell onClose={onClose} cerrable={!guardando} maxWidth={940}
      title="Texto del mail semanal"
      sub={modo === 'simple'
        ? 'El saludo y la tabla con los números de cada sede se arman solos: acá se edita el resto del mensaje'
        : <>Marcadores: <code>{'{{saludo}}'}</code> <code>{'{{fecha}}'}</code> <code>{'{{tabla}}'}</code></>}>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 0 }}>
          <div style={{ flex: 1, padding: '16px 20px', borderRight: `1px solid ${C.rule}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {modo === 'simple' ? (
              <>
                <div>
                  <label style={campoLabelStyle}>
                    Introducción <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>· podés usar {'{{fecha}}'} y **negrita**</span>
                  </label>
                  <textarea value={campos.intro} onChange={e => setCampos(c => ({ ...c, intro: e.target.value }))} rows={3} style={campoFieldStyle} />
                </div>
                <div>
                  <label style={campoLabelStyle}>Mensaje de cierre</label>
                  <textarea value={campos.cierre} onChange={e => setCampos(c => ({ ...c, cierre: e.target.value }))} rows={2} style={campoFieldStyle} />
                </div>
                <div>
                  <label style={campoLabelStyle}>Despedida</label>
                  <textarea value={campos.despedida} onChange={e => setCampos(c => ({ ...c, despedida: e.target.value }))} rows={2} style={campoFieldStyle} />
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={handleRestaurar} style={linkBtnStyle}>Restaurar textos predeterminados</button>
                  <button onClick={irAAvanzado} style={linkBtnStyle}>Editar el HTML directamente (avanzado) →</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.body }}>HTML de la plantilla</div>
                <textarea value={texto} onChange={e => setTexto(e.target.value)} spellCheck={false} style={{
                  flex: 1, minHeight: 320, padding: 12, border: `1px solid ${C.rule}`, borderRadius: 8,
                  fontSize: 12, fontFamily: F.mono, lineHeight: 1.6, resize: 'vertical',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={handleRestaurar} style={linkBtnStyle}>Restaurar plantilla predeterminada</button>
                  <button onClick={irASimple} style={linkBtnStyle}>← Volver al editor simple</button>
                </div>
              </>
            )}
          </div>
          <div style={{ flex: 1, padding: '16px 20px', background: C.paper }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: F.body }}>
              Vista previa {sedeEjemplo ? `· ${sedeEjemplo.sede}` : ''}
            </div>
            {sedeEjemplo ? (
              <div style={{ border: `1px solid ${C.rule}`, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.7, color: '#222', background: '#fff' }}
                dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <div style={{ fontSize: 12, color: C.inkSoft }}>No hay datos de sedes todavía para previsualizar.</div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          {error && <div role="alert" style={{ color: C.crimson, fontSize: 13, marginRight: 'auto', alignSelf: 'center', maxWidth: 380 }}>{error}</div>}
          <button onClick={onClose} disabled={guardando} className="btn-press" style={btnSec}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} className="btn-press" style={{ ...btnPri, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar el texto'}
          </button>
        </div>
    </ModalShell>
  )
}

// Ayuda breve: se abre al pasar el mouse, con el teclado o tocándola
function TooltipHelp({ text }) {
  const [show, setShow] = useState(false)
  const id = useRef('ayuda-' + Math.random().toString(36).slice(2)).current
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button type="button" aria-describedby={show ? id : undefined} aria-label="Ayuda"
        onFocus={() => setShow(true)} onBlur={() => setShow(false)} onClick={() => setShow(v => !v)}
        style={{
          fontSize: 11.5, color: C.inkSoft, cursor: 'help', border: `1px solid ${C.rule}`, background: '#fff',
          borderRadius: '50%', width: 20, height: 20, padding: 0, fontWeight: 700, fontFamily: F.body,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>?</button>
      {show && (
        <span role="tooltip" id={id} style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: -10,
          background: C.ink, color: '#fff', fontSize: 12.5, fontFamily: F.body, fontWeight: 400,
          padding: '8px 12px', borderRadius: 8, zIndex: 99, width: 270, textAlign: 'left', lineHeight: 1.5,
          boxShadow: '0 10px 28px -10px rgba(0,0,0,.5)',
        }}>{text}</span>
      )}
    </span>
  )
}

const btnPri = { height: 40, padding: '0 18px', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: F.body, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }
const btnSec = { height: 40, padding: '0 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: F.body, background: '#fff', color: C.ink, border: `1px solid ${C.rule}`, cursor: 'pointer' }

// Modal preview de email por sede
function PreviewModal({ sede, campNombre, template, onClose, onSend }) {
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const htmlBase = buildEmailHTML(sede, campNombre, template)

  // El envío puede fallar de verdad: si falla, el modal queda abierto con el
  // error en vez de cerrarse como si hubiera salido todo bien.
  const handleSend = async () => {
    setEnviando(true)
    setErrorEnvio(null)
    try {
      await onSend(sede, null)
    } catch (e) {
      setErrorEnvio(e?.message || 'No se pudo enviar')
      setEnviando(false)
      return
    }
    setEnviando(false)
    onClose()
  }

  return (
    <ModalShell onClose={onClose} cerrable={!enviando} maxWidth={640} title={`Mail para ${sede.sede}`} sub={`Para: ${sede.email || 'sin email cargado'}`}>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px', fontFamily: F.body }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 8 }}>Así le llega</div>
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, padding: 18, fontSize: 13.5, lineHeight: 1.7, color: '#222', background: '#fff', boxShadow: '0 1px 0 rgba(14,23,51,.04)' }}
          dangerouslySetInnerHTML={{ __html: htmlBase }} />
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        {errorEnvio && <div role="alert" style={{ marginRight: 'auto', fontSize: 13, color: C.danger }}>No salió: {errorEnvio}</div>}
        <button onClick={onClose} disabled={enviando} className="btn-press" style={btnSec}>Cerrar</button>
        <button onClick={handleSend} disabled={enviando || !sede.email} className="btn-press" style={{ ...btnPri, opacity: (enviando || !sede.email) ? 0.6 : 1 }}>
          {enviando ? 'Enviando…' : 'Enviar solo este mail'}
        </button>
      </div>
    </ModalShell>
  )
}

function ConfirmModal({ title, sub, items, footNote, onClose, onConfirm, confirmLabel }) {
  return (
    <ModalShell onClose={onClose} maxWidth={520} title={title} sub={sub}>
      <div style={{ padding: 20, fontFamily: F.body, overflow: 'auto' }}>
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12, border: `1px solid ${C.rule}`, borderRadius: 10 }}>
          {items.map((d, i) => (
            <div key={d.cod_sede} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderTop: i ? `1px solid ${C.ruleSoft}` : 'none', fontSize: 13.5 }}>
              <span style={{ fontWeight: 600, color: C.ink }}>{d.sede}</span>
              <span style={{ color: d.email ? C.inkSoft : C.crimson, fontSize: 12.5, textAlign: 'right' }}>{d.email || 'sin email: no se envía'}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>{footNote}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-press" style={btnSec}>Cancelar</button>
          <button onClick={onConfirm} className="btn-press" style={btnPri}>{confirmLabel}</button>
        </div>
      </div>
    </ModalShell>
  )
}

export default function Envio({ data, copied, onCopied, onUncopied, campanas, campanaActiva, guardarSemana }) {
  const [seleccion, setSeleccion] = useState({})
  const [log, setLog] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [modalConfirm, setModalConfirm] = useState(false)
  const [modalConfirmReenvio, setModalConfirmReenvio] = useState(false)
  const [reenviando, setReenviando] = useState({})
  const [previewSede, setPreviewSede] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  // Fecha local (toISOString da la fecha UTC: a la noche en Argentina ya es "mañana")
  const [nuevaFecha, setNuevaFecha] = useState(hoyIso)
  const [valores, setValores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)
  const [modoReemplazarSemana, setModoReemplazarSemana] = useState(false)
  const [logEnvios, setLogEnvios] = useState([])
  const [cargandoLog, setCargandoLog] = useState(false)
  const [mostrarLog, setMostrarLog] = useState(false)
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [mostrarEditorPlantilla, setMostrarEditorPlantilla] = useState(false)
  const [confirmando, setConfirmando] = useState({})
  const logRef = useRef(null)

  // Cargar la plantilla de email guardada (si nunca se editó, usa la de siempre)
  useEffect(() => {
    obtenerConfig()
      .then(cfg => { if (cfg?.EMAIL_TEMPLATE) setTemplate(cfg.EMAIL_TEMPLATE) })
      .catch(() => {}) // si falla, se sigue usando DEFAULT_TEMPLATE
  }, [])

  // Restaurar el borrador de "Registrar nueva semana" si quedó guardado de
  // una sesión que expiró a mitad de la carga manual (ver useEffect de abajo).
  useEffect(() => {
    const raw = sessionStorage.getItem(BORRADOR_KEY)
    if (!raw) return
    sessionStorage.removeItem(BORRADOR_KEY)
    try {
      const borrador = JSON.parse(raw)
      if (borrador?.campanaActiva === campanaActiva) {
        setNuevaFecha(borrador.nuevaFecha)
        setValores(borrador.valores || {})
        setMostrarNueva(true)
      }
    } catch { /* borrador corrupto — se descarta */ }
  }, []) // eslint-disable-line

  // Si la sesión expira mientras el formulario de "Nueva semana" está abierto,
  // guardamos lo que Cele ya tenía cargado para no perder el trabajo al re-loguearse.
  useEffect(() => {
    return onAuthExpired(() => {
      if (mostrarNueva) {
        sessionStorage.setItem(BORRADOR_KEY, JSON.stringify({ campanaActiva, nuevaFecha, valores }))
      }
    })
  }, [mostrarNueva, campanaActiva, nuevaFecha, valores])

  const camp = campanas?.find(c => c.id === campanaActiva)
  const cerrada = camp?.estado === 'cerrada'
  const pendientes = data.filter(d => !copied[d.cod_sede])
  const enviadas   = data.filter(d => copied[d.cod_sede])
  const seleccionadas = Object.keys(seleccion).filter(c => seleccion[c])
  const aEnviar = seleccionadas.length > 0
    ? data.filter(d => seleccionadas.includes(String(d.cod_sede)) && !copied[d.cod_sede])
    : pendientes

  const addLog = (msg, tipo = 'info') => {
    setLog(prev => {
      const next = [...prev, { msg, tipo, ts: new Date().toLocaleTimeString() }]
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
      return next
    })
  }

  const toggleSel = (cod) => setSeleccion(prev => ({ ...prev, [cod]: !prev[cod] }))
  const selAll = () => { const n = {}; pendientes.forEach(d => { n[d.cod_sede] = true }); setSeleccion(n) }
  const deselAll = () => setSeleccion({})

  const enviarUno = async (d, htmlCustom = null) => {
    const htmlRich = htmlCustom || buildEmailHTML(d, camp?.nombre || '', template)
    const fecha = d.fecha || new Date().toISOString().slice(0,10)
    const campNom = camp?.nombre || ''
    await enviarEmailViaScript({
      to:      d.email,
      subject: 'Como Vamos — ' + campNom + ' — ' + fmtFecha(fecha),
      html:    htmlRich,
      sede:    d.sede,
      cod:     String(d.cod_sede),
      fecha:   fecha,
      campana: campNom,
    })
    onCopied(d.cod_sede)
    // Resumen a Cele de este envío individual
    enviarResumenCele(campNom, fecha, [{ sede: d.sede, email: d.email, estado: 'enviado' }]).catch(() => {})
  }

  // Reenvío individual de una sede ya marcada como enviada — no toca la
  // selección ni el log grande, solo un indicador puntual en ese chip.
  const reenviarUno = async (d) => {
    setReenviando(prev => ({ ...prev, [d.cod_sede]: true }))
    try {
      await enviarUno(d)
      addLog(`✓ ${d.sede} (reenviado)`, 'ok')
    } catch {
      addLog(`✗ Error al reenviar ${d.sede}`, 'error')
    }
    setReenviando(prev => ({ ...prev, [d.cod_sede]: false }))
  }

  // Envío en lote reutilizado tanto para "Enviar pendientes" como para
  // "Reenviar todas" — misma lógica, distinta lista de entrada.
  const enviarLote = async (lista, { esReenvio = false } = {}) => {
    setEnviando(true); setLog([]); setProgreso(0)
    addLog(`${esReenvio ? 'Reenviando' : 'Iniciando envío de'} ${lista.length} emails…`, 'info')
    const resumenItems = []
    const campNom = camp?.nombre || ''
    const fechaRef = lista[0]?.fecha || new Date().toISOString().slice(0,10)
    // Una sede no se manda dos veces en la misma tanda aunque venga repetida
    // en la lista (el 03/08 Trenque Lauquen salió duplicado).
    const yaMandadas = new Set()
    const okCods = []

    for (let i = 0; i < lista.length; i++) {
      const d = lista[i]
      const cod = String(d.cod_sede)
      if (yaMandadas.has(cod)) {
        addLog(`• ${d.sede} ya estaba en esta tanda, se saltea`, 'info')
        setProgreso(Math.round((i + 1) / lista.length * 100))
        continue
      }
      yaMandadas.add(cod)
      if (!String(d.email || '').trim()) {
        addLog(`✗ ${d.sede} no tiene email cargado: se saltea (cargalo en Sedes → Sedes y objetivos)`, 'error')
        resumenItems.push({ sede: d.sede, email: '', estado: 'error' })
        setProgreso(Math.round((i + 1) / lista.length * 100))
        continue
      }
      try {
        const htmlRich = buildEmailHTML(d, campNom, template)
        await enviarEmailViaScript({
          to: d.email, subject: 'Como Vamos — ' + campNom + ' — ' + fmtFecha(d.fecha || fechaRef),
          html: htmlRich, sede: d.sede, cod, fecha: d.fecha || fechaRef, campana: campNom,
        })
        onCopied(d.cod_sede)
        okCods.push(cod)
        addLog(`✓ ${d.sede}${esReenvio ? ' (reenviado)' : ''}`, 'ok')
        resumenItems.push({ sede: d.sede, email: d.email, estado: 'enviado' })
      } catch (e) {
        addLog(`✗ Error en ${d.sede}${e?.message ? ' — ' + e.message : ''}`, 'error')
        resumenItems.push({ sede: d.sede, email: d.email, estado: 'error' })
      }
      setProgreso(Math.round((i + 1) / lista.length * 100))
    }

    // Verificación contra el log real: el tilde verde vale solo si Apps Script
    // dejó la fila en log_envios. Si no quedó registrada, se saca el tilde acá
    // mismo en vez de que la sede aparezca como enviada hasta el próximo F5.
    const noRegistradas = await verificarContraLog(okCods, fechaRef, campNom, lista)
    lista.forEach(d => {
      const cod = String(d.cod_sede)
      if (!noRegistradas.includes(cod)) return
      const item = resumenItems.find(it => it.sede === d.sede)
      if (item) item.estado = 'error'
    })

    addLog(`Listo. ${yaMandadas.size} emails procesados.`, 'ok')
    setEnviando(false); setSeleccion({})
    // Un solo resumen consolidado a Cele con toda la tanda
    enviarResumenCele(campNom, fechaRef, resumenItems).catch(() => {})
  }

  // Compara lo que el front cree que mandó contra lo que Apps Script realmente
  // registró en log_envios. Devuelve los códigos que no aparecen registrados.
  const verificarContraLog = async (okCods, fechaRef, campNom, lista) => {
    if (!okCods.length) return []
    let registro
    try {
      registro = await obtenerLogEnvios(300)
    } catch {
      addLog('No se pudo verificar contra el log de envíos — revisá el historial a mano.', 'error')
      return []
    }
    const registradas = new Set(
      registro
        .filter(r => String(r.fecha).slice(0,10) === String(fechaRef).slice(0,10) &&
                     r.estado === 'enviado' &&
                     (!campNom || String(r.campana || '').indexOf(campNom) >= 0))
        .map(r => String(r.cod_sede))
    )
    const faltantes = okCods.filter(c => !registradas.has(c))
    faltantes.forEach(cod => {
      const d = lista.find(x => String(x.cod_sede) === cod)
      addLog(`✗ ${d?.sede || cod}: no quedó registrada, hay que reenviarla`, 'error')
      if (onUncopied) onUncopied(d ? d.cod_sede : cod)
    })
    if (faltantes.length) {
      addLog(`${faltantes.length} sede(s) quedaron sin registrar y volvieron a pendientes.`, 'error')
    }
    return faltantes
  }

  const enviarTodos = () => enviarLote(aEnviar)
  const reenviarTodos = () => enviarLote(enviadas, { esReenvio: true })

  const handleGuardar = async (reemplazar = false) => {
    if (!nuevaFecha) return
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const sedes = data.map(d => ({ cod: d.cod_sede, sede: d.sede, total: Number(valores[d.cod_sede] ?? d.total) || 0 }))
      await guardarSemana(nuevaFecha, sedes, reemplazar)
      setMostrarNueva(false); setValores({}); setModoReemplazarSemana(false)
    } catch (e) {
      // Si el error es "ya existe", ofrecer reemplazar (misma lógica que ExcelUploader)
      if (e.message && e.message.includes('Ya existe')) {
        setModoReemplazarSemana(true)
      } else {
        setErrorGuardar(e.message)
      }
    }
    setGuardando(false)
  }

  const toggleLog = async () => {
    const next = !mostrarLog
    setMostrarLog(next)
    if (next) {
      setCargandoLog(true)
      try {
        const datos = await obtenerLogEnvios(300)
        setLogEnvios(datos)
      } catch (e) { /* silencioso */ }
      setCargandoLog(false)
    }
  }

  // Agrupar el log por fecha + hora exacta (cada tanda de envío comparte el mismo minuto/segundo de inicio)
  const logAgrupado = (() => {
    const grupos = {}
    logEnvios.forEach(r => {
      const key = `${r.fecha} ${r.hora?.slice(0,5)}` // agrupa por fecha + hora:minuto
      if (!grupos[key]) grupos[key] = { fecha: r.fecha, hora: r.hora, campana: r.campana, items: [], confirmado: false }
      grupos[key].items.push(r)
      if (String(r.confirmado ?? '').toUpperCase() === 'TRUE') grupos[key].confirmado = true
    })
    return Object.values(grupos).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
  })()

  const handleConfirmarLote = async (g) => {
    const key = `${g.fecha} ${g.hora}`
    setConfirmando(prev => ({ ...prev, [key]: true }))
    try {
      await confirmarEnvioLote(g.fecha, g.hora)
      const datos = await obtenerLogEnvios(300)
      setLogEnvios(datos)
    } catch { /* silencioso — se puede reintentar */ }
    setConfirmando(prev => ({ ...prev, [key]: false }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F.body }}>

      {previewSede && (
        <PreviewModal
          sede={previewSede}
          campNombre={camp?.nombre || ''}
          template={template}
          onClose={() => setPreviewSede(null)}
          onSend={enviarUno}
        />
      )}

      {mostrarEditorPlantilla && (
        <EditorPlantillaModal
          template={template}
          sedeEjemplo={data[0]}
          campNombre={camp?.nombre || ''}
          onClose={() => setMostrarEditorPlantilla(false)}
          onGuardado={setTemplate}
        />
      )}

      {/* Casilleros: uno por sede, se llenan a medida que sale cada mail */}
      <div style={{ ...panel({ padding: '18px 22px' }), display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ ...cifra(40), color: C.ink }}>{enviadas.length}</span>
          <span style={{ fontSize: 15, color: C.inkSoft }}>de <strong style={{ color: C.ink, fontFamily: F.mono }}>{data.length}</strong> mails enviados</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1, minWidth: 260 }} aria-hidden="true">
          {[...enviadas, ...pendientes].map(d => {
            const ok = copied[d.cod_sede]
            return <span key={d.cod_sede} title={`${d.sede} · ${ok ? 'enviado' : 'pendiente'}`} style={{
              width: 18, height: 18, borderRadius: 4,
              background: ok ? C.ok : 'transparent', border: `2px solid ${ok ? C.ok : C.rule}`,
              transition: 'background .3s, border-color .3s',
            }} />
          })}
        </div>
        {pendientes.length === 0 && data.length > 0 && (
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ok }}>Corte enviado completo</span>
        )}
      </div>

      {/* Panel de envío */}
      {!cerrada && (
        <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: C.ink, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 800, fontStretch: '108%', fontSize: 19 }}>Mails del corte {data[0]?.fecha ? fmtFecha(data[0].fecha).slice(0, 5) : ''}</div>
              <div style={{ color: 'rgba(255,255,255,.68)', fontSize: 13, marginTop: 3, fontFamily: F.body }}>
                Salen desde mcrossi@ucasal.edu.ar · {seleccionadas.length > 0 ? `${aEnviar.length} seleccionadas` : `${pendientes.length} sin enviar`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!enviando && (
                <button onClick={() => setMostrarEditorPlantilla(true)} className="btn-press" style={{
                  height: 40, padding: '0 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, fontFamily: F.body,
                  background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.28)', cursor: 'pointer',
                }}>
                  Editar el texto del mail
                </button>
              )}
              {pendientes.length > 0 && !enviando && (
                <button onClick={() => setModalConfirm(true)} className="btn-press" style={{ height: 44, padding: '0 20px', borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: F.body, background: C.celeste, color: C.ink, border: 'none', cursor: 'pointer' }}>
                  {aEnviar.length === 1 ? 'Enviar 1 mail' : `Enviar ${aEnviar.length} mails`}
                </button>
              )}
              {enviando && <div role="status" style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Enviando… <span style={{ fontFamily: F.mono }}>{progreso}%</span></div>}
            </div>
          </div>

          {progreso > 0 && (
            <div style={{ height: 3, background: C.ruleSoft }}>
              <div style={{ width: `${progreso}%`, height: '100%', background: C.celeste, transition: 'width 0.3s' }} />
            </div>
          )}

          {log.length > 0 && (
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.ruleSoft}` }}>
              <div ref={logRef} style={{ background: C.ink, borderRadius: 8, padding: '12px 16px', height: 180, overflowY: 'auto', fontFamily: F.mono, fontSize: 12 }}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.tipo === 'ok' ? '#7fc9a0' : l.tipo === 'error' ? '#e8828a' : 'rgba(255,255,255,.5)', lineHeight: 1.8 }}>
                    <span style={{ color: 'rgba(255,255,255,.35)', marginRight: 8 }}>{l.ts}</span>{l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendientes.length > 0 && (
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                  Pendientes <span style={{ fontFamily: F.mono, fontWeight: 500, color: C.inkSoft, fontSize: 12.5 }}>{pendientes.length}</span>
                </div>
                <TooltipHelp text="Si no tildás ninguna, se envían todas las pendientes. Tildá algunas para mandar solo esas. “Ver” muestra cómo le llega el mail a esa sede." />
                <div style={{ flex: 1 }} />
                <button onClick={selAll} style={{ fontSize: 13, color: C.navy, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: F.body }}>Seleccionar todas</button>
                <button onClick={deselAll} style={{ fontSize: 13, color: C.inkSoft, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.body }}>Limpiar selección</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto', border: `1px solid ${C.rule}`, borderRadius: 10 }}>
                {pendientes.map(d => {
                  const sel = seleccion[d.cod_sede]
                  const pct = d.pct
                  const color = estadoColor(getEstado(d))
                  return (
                    <div key={d.cod_sede} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
                      background: sel ? C.celesteSoft : '#fff',
                      borderBottom: `1px solid ${C.ruleSoft}`,
                      transition: 'background 0.15s',
                    }}>
                      <div role="checkbox" aria-checked={!!sel} tabIndex={0} aria-label={`Seleccionar ${d.sede}`}
                        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSel(d.cod_sede) } }}
                        onClick={() => toggleSel(d.cod_sede)} style={{
                        width: 18, height: 18, flexShrink: 0, cursor: 'pointer', borderRadius: 5,
                        border: `2px solid ${sel ? C.navy : C.rule}`,
                        background: sel ? C.navy : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1, color: C.ink, fontFamily: F.body, minWidth: 0 }}>{d.sede}</span>
                      <span className="hide-mobile" style={{ fontSize: 12.5, color: d.email ? C.inkSoft : C.crimson, fontWeight: d.email ? 400 : 700 }}>{d.email || 'Falta el email'}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, minWidth: 44, textAlign: 'right', fontFamily: F.mono, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{pct}%
                      </span>
                      <button
                        onClick={() => setPreviewSede(d)}
                        style={{
                          height: 30, padding: '0 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: F.body,
                          border: `1px solid ${C.rule}`, background: '#fff', color: C.navy,
                          cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.ink; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = C.ink }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.navy; e.currentTarget.style.borderColor = C.rule }}
                      >
                        Ver
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {enviadas.length > 0 && (
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.ruleSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                  Enviadas <span style={{ fontFamily: F.mono, fontWeight: 500, color: C.inkSoft, fontSize: 12.5 }}>{enviadas.length}</span>
                </div>
                <TooltipHelp text="Para cuando un envío falló en el medio (por ejemplo, si el servicio de mails estaba caído) y hay que mandarlos de nuevo. El ↻ de cada sede reenvía solo ese." />
                <div style={{ flex: 1 }} />
                {!enviando && (
                  <button onClick={() => setModalConfirmReenvio(true)} style={{ ...btnSec, height: 34, fontSize: 13 }}>
                    Reenviar todos ({enviadas.length})
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enviadas.map(d => (
                  <span key={d.cod_sede} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontFamily: F.body,
                    background: '#E3F4EC', color: '#0B6B49', borderRadius: 20,
                    padding: '4px 5px 4px 11px', fontWeight: 600,
                  }}>
                    ✓ {d.sede}
                    <button
                      onClick={() => reenviarUno(d)}
                      disabled={!!reenviando[d.cod_sede]}
                      title="Reenviar este mail" aria-label={`Reenviar el mail a ${d.sede}`}
                      style={{
                        border: 'none', background: 'rgba(15,138,95,0.16)', color: '#0B6B49',
                        borderRadius: '50%', width: 20, height: 20, fontSize: 11, lineHeight: 1,
                        cursor: reenviando[d.cod_sede] ? 'wait' : 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
                      }}
                    >
                      {reenviando[d.cod_sede] ? '…' : '↻'}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cargar un corte a mano (alternativa al Excel) */}
      {!cerrada && (
        <div style={{ ...panel(), overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: mostrarNueva ? `1px solid ${C.rule}` : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, fontStretch: '105%', color: C.ink }}>Cargar un corte a mano</div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Si no tenés el Excel: escribís el total de cada sede y se guarda como un corte más.</div>
            </div>
            <button onClick={() => { setMostrarNueva(v => !v); setErrorGuardar(null); setModoReemplazarSemana(false) }} className="btn-press"
              style={mostrarNueva ? btnSec : { ...btnSec, color: C.navy, fontWeight: 700 }}>
              {mostrarNueva ? 'Cerrar' : 'Cargar a mano'}
            </button>
          </div>

          {mostrarNueva && (
            <div className="animate-fadeIn" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label htmlFor="fecha-manual" style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Fecha del corte</label>
                <input id="fecha-manual" type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  style={{ height: 38, padding: '0 10px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 14, fontFamily: F.body }} />
                <button onClick={() => { const p = {}; data.forEach(d => { p[d.cod_sede] = d.total }); setValores(p) }} style={{ ...btnSec, height: 38, fontSize: 13 }}>
                  Partir de los números del último corte
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8, marginBottom: 16, maxHeight: 380, overflowY: 'auto' }}>
                {data.map(d => (
                  <label key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FAFBFD', border: `1px solid ${C.ruleSoft}`, borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>
                      {nombreCorto(d.sede)}
                    </span>
                    <input type="number" min="0" inputMode="numeric" aria-label={`Total de ${d.sede}`}
                      value={valores[d.cod_sede] ?? d.total}
                      onChange={e => setValores(prev => ({ ...prev, [d.cod_sede]: e.target.value }))}
                      style={{ width: 70, height: 32, padding: '0 8px', border: `1px solid ${C.rule}`, borderRadius: 6, fontSize: 14, fontWeight: 700, textAlign: 'right', fontFamily: F.mono }} />
                  </label>
                ))}
              </div>
              {modoReemplazarSemana ? (
                <div style={{ borderLeft: `4px solid ${C.warn}`, background: '#FBF3E2', borderRadius: '0 10px 10px 0', padding: '12px 16px', fontSize: 13.5, color: '#6B4A00' }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Ya hay un corte del {fmtFecha(nuevaFecha).slice(0, 5)} cargado</div>
                  <div style={{ marginBottom: 12 }}>Si seguís, estos números lo reemplazan. Si te equivocás, se vuelve atrás con “Deshacer la última carga” en Cómo vamos.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleGuardar(true)} disabled={guardando} className="btn-press" style={{ ...btnPri, background: C.warn, opacity: guardando ? 0.6 : 1 }}>
                      {guardando ? 'Reemplazando…' : 'Reemplazar el corte'}
                    </button>
                    <button onClick={() => setModoReemplazarSemana(false)} disabled={guardando} style={btnSec}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleGuardar(false)} disabled={guardando || !nuevaFecha} className="btn-press" style={{ ...btnPri, opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando…' : `Guardar el corte del ${fmtFecha(nuevaFecha).slice(0, 5)}`}
                  </button>
                  <button onClick={() => { setMostrarNueva(false); setErrorGuardar(null) }} style={btnSec}>Cancelar</button>
                </div>
              )}
              {errorGuardar && (
                <div role="alert" style={{ marginTop: 12, borderLeft: `4px solid ${C.crimson}`, background: '#FDF1F3', borderRadius: '0 8px 8px 0', padding: '10px 14px', fontSize: 13, color: '#8E0C22' }}>
                  {errorGuardar}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Registro de envíos (queda guardado en la planilla) */}
      <div style={{ ...panel(), overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: mostrarLog ? `1px solid ${C.rule}` : 'none', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, fontStretch: '105%', color: C.ink }}>Registro de envíos</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Cada tanda de mails: cuándo salió, a quién y si se confirmó que llegó.</div>
          </div>
          <button onClick={toggleLog} className="btn-press" style={mostrarLog ? btnSec : { ...btnSec, color: C.navy, fontWeight: 700 }}>
            {mostrarLog ? 'Cerrar' : 'Ver el registro'}
          </button>
        </div>

        {mostrarLog && (
          <div className="animate-fadeIn" style={{ padding: '16px 22px' }}>
            {cargandoLog ? (
              <div style={{ padding: '20px 0', color: C.inkSoft, fontSize: 13.5 }}>Cargando el registro…</div>
            ) : logAgrupado.length === 0 ? (
              <div style={{ padding: '20px 0', color: C.inkSoft, fontSize: 13.5 }}>Todavía no hay envíos registrados.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                {logAgrupado.map((g, i) => {
                  const ok = g.items.filter(it => it.estado === 'enviado').length
                  const err = g.items.filter(it => it.estado !== 'enviado').length
                  const key = `${g.fecha} ${g.hora}`
                  return (
                    <div key={i} style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FAFBFD', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{fmtFecha(g.fecha)}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 12.5, color: C.inkSoft }}>{g.hora?.slice(0, 5)} hs</span>
                        {g.campana && <span style={{ fontSize: 12, color: C.inkSoft }}>· {g.campana}</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, color: C.ok, fontWeight: 700 }}>{ok} enviados</span>
                          {err > 0 && <span style={{ fontSize: 13, color: C.crimson, fontWeight: 700 }}>{err} con error</span>}
                          {g.confirmado ? (
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, background: C.celesteSoft, padding: '4px 10px', borderRadius: 20 }}>✓ Llegada confirmada</span>
                          ) : (
                            <button onClick={() => handleConfirmarLote(g)} disabled={confirmando[key]}
                              title="Marcalo solo si viste que los mails llegaron (en Gmail o porque una sede avisó)"
                              style={{ fontSize: 12.5, fontWeight: 700, color: '#6B4A00', background: '#FBF3E2', fontFamily: F.body, border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer' }}>
                              {confirmando[key] ? 'Guardando…' : 'Confirmar que llegaron'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {g.items.map((it, j) => (
                          <span key={j} style={{
                            fontSize: 12, padding: '3px 9px', fontWeight: 600, borderRadius: 20,
                            background: it.estado === 'enviado' ? '#E3F4EC' : '#FBE7EA',
                            color: it.estado === 'enviado' ? '#0B6B49' : '#8E0C22',
                          }}>
                            {it.estado === 'enviado' ? '✓' : '✗'} {it.sede}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal confirmación masiva */}
      {modalConfirm && (
        <ConfirmModal
          title={aEnviar.length === 1 ? '¿Enviar 1 mail?' : `¿Enviar ${aEnviar.length} mails?`}
          sub="Salen desde mcrossi@ucasal.edu.ar, uno por sede"
          items={aEnviar}
          footNote={'Cada sede recibe su propio mail con sus números. Para ver cómo le llega a una en particular, cancelá y tocá “Ver” en esa sede.'}
          onClose={() => setModalConfirm(false)}
          onConfirm={() => { setModalConfirm(false); enviarTodos() }}
          confirmLabel={aEnviar.length === 1 ? 'Enviar el mail' : `Enviar los ${aEnviar.length} mails`}
        />
      )}

      {/* Modal confirmación de reenvío masivo */}
      {modalConfirmReenvio && (
        <ConfirmModal
          title={`¿Reenviar ${enviadas.length} mails?`}
          sub="A sedes que ya figuran como enviadas"
          items={enviadas}
          footNote="Usalo solo si el envío anterior no llegó de verdad (por ejemplo, si el servicio de mails estaba caído): las sedes que sí lo recibieron lo van a recibir de nuevo."
          onClose={() => setModalConfirmReenvio(false)}
          onConfirm={() => { setModalConfirmReenvio(false); reenviarTodos() }}
          confirmLabel={`Reenviar los ${enviadas.length} mails`}
        />
      )}
    </div>
  )
}
