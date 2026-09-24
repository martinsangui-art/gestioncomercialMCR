import { useState, useRef, useEffect } from 'react'
import { enviarEmailViaScript, obtenerLogEnvios, enviarResumenCele, onAuthExpired, obtenerConfig, guardarConfig, confirmarEnvioLote } from '../hooks/useSheets'
import { C, F, useClosingTransition, panel, cifra, rotulo } from '../lib/theme'

const BORRADOR_KEY = 'ucasal_borrador_semana'

function getEstado(d) {
  if (d.total === 0) return 'red'
  if (d.pct >= 50) return 'green'
  return 'amber'
}

function estadoColor(est) {
  return { green: C.ok, amber: C.warn, red: C.danger }[est]
}

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0,10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
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
  const color = { green: '#0F8A5F', amber: '#A8752A', red: '#C8102E' }[getEstado(d)]
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

const campoLabelStyle = { display: 'block', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: F.mono }
const campoFieldStyle = { width: '100%', padding: '10px 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontFamily: F.body, lineHeight: 1.5, resize: 'vertical' }
const linkBtnStyle = { fontSize: 11, color: C.inkSoft, fontFamily: F.body, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }

function ModalHeader({ title, sub, onClose, tone = 'ink' }) {
  const bg = tone === 'crimson' ? C.crimson : C.ink
  return (
    <div style={{ background: bg, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `2px solid ${C.brass}` }}>
      <div>
        <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 16 }}>{title}</div>
        {sub && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2, fontFamily: F.body }}>{sub}</div>}
      </div>
      <button onClick={onClose} className="btn-press" style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 27, height: 27, borderRadius: '50%', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}

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
  const [closing, requestClose] = useClosingTransition(onClose)

  const textoFinal = modo === 'simple' ? buildTemplateFromFields(campos) : texto

  const handleGuardar = async () => {
    setGuardando(true); setError(null)
    try {
      await guardarConfig({ EMAIL_TEMPLATE: textoFinal })
      onGuardado(textoFinal)
      requestClose()
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
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,51,.6)',
      zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{
        background: C.paperRaised, borderRadius: 8, width: '100%', maxWidth: 900,
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        <ModalHeader
          title="Editar plantilla del email"
          sub={modo === 'simple'
            ? 'El saludo y la tabla de resultados se arman solos — acá se edita el texto del mensaje'
            : <>Placeholders: <code>{'{{saludo}}'}</code> <code>{'{{fecha}}'}</code> <code>{'{{tabla}}'}</code></>}
          onClose={requestClose}
        />

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
                <div style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono }}>HTML de la plantilla</div>
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
            <div style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: F.mono }}>
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
          {error && <div style={{ color: C.crimson, fontSize: 12, marginRight: 'auto', alignSelf: 'center', maxWidth: 340 }}>{error}</div>}
          <button onClick={requestClose} disabled={guardando} className="btn-press" style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.paper, color: C.inkSoft, border: `1px solid ${C.rule}`, cursor: 'pointer', fontFamily: F.body }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando} className="btn-press" style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
            background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1,
          }}>
            {guardando ? 'Guardando…' : 'Guardar plantilla'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TooltipHelp({ text }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{
        fontSize: 11, color: C.inkSoft, cursor: 'help', border: `1px solid ${C.rule}`,
        borderRadius: '50%', width: 18, height: 18,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
      }}>?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, background: C.ink, color: '#fff', fontSize: 11, fontFamily: F.body,
          padding: '6px 12px', borderRadius: 8, zIndex: 99, width: 260,
          textAlign: 'center', lineHeight: 1.5, pointerEvents: 'none',
        }}>{text}</div>
      )}
    </div>
  )
}

// Modal preview de email por sede
function PreviewModal({ sede, campNombre, template, onClose, onSend }) {
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [closing, requestClose] = useClosingTransition(onClose)
  const htmlBase = buildEmailHTML(sede, campNombre, template)

  // El envío ahora puede fallar de verdad (antes se resolvía siempre): si
  // falla, el modal queda abierto con el error en vez de cerrarse como si
  // hubiera salido todo bien.
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
    requestClose()
  }

  return (
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,51,.6)',
      zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{
        background: C.paperRaised, borderRadius: 8, width: '100%', maxWidth: 620,
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        <ModalHeader title="Vista previa del email" sub={`${sede.sede} · ${sede.email}`} onClose={requestClose} />

        {/* KPIs rápidos */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.rule}`, flexShrink: 0 }}>
          {[['Objetivo', sede.objetivo], ['Total', sede.total], ['Cumplimiento', sede.pct + '%'], ['Variación', sede.var !== null ? (sede.var > 0 ? '+' + sede.var : sede.var) : '—']].map(([l, v]) => (
            <div key={l} style={{ flex: 1, padding: '10px 16px', textAlign: 'center', borderRight: `1px solid ${C.ruleSoft}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, fontFamily: F.mono }}>{v}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1, fontFamily: F.mono, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Preview o editor */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, fontFamily: F.mono }}>
            Vista previa · tabla HTML lista para Gmail
          </div>
          <div style={{
            border: `1px solid ${C.rule}`, borderRadius: 8, padding: '16px',
            fontSize: 13, lineHeight: 1.7, color: '#222', background: C.paper,
          }} dangerouslySetInnerHTML={{ __html: htmlBase }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${C.rule}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0,
        }}>
          {errorEnvio && (
            <div style={{ marginRight: 'auto', fontSize: 12, color: C.danger, fontFamily: F.body }}>
              No salió: {errorEnvio}
            </div>
          )}
          <button onClick={requestClose} className="btn-press" style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.paper, color: C.inkSoft, border: `1px solid ${C.rule}`, cursor: 'pointer', fontFamily: F.body }}>
            Cancelar
          </button>
          <button onClick={handleSend} disabled={enviando} className="btn-press" style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
            background: C.crimson, color: '#fff', border: 'none',
            cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1,
          }}>
            {enviando ? 'Enviando…' : 'Enviar este email'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ tono = 'crimson', title, sub, items, footNote, onClose, onConfirm, confirmLabel }) {
  const [closing, requestClose] = useClosingTransition(onClose)
  return (
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,51,.6)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{ background: C.paperRaised, borderRadius: 8, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <ModalHeader title={title} sub={sub} onClose={requestClose} tone={tono} />
        <div style={{ padding: 20 }}>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12, border: `1px solid ${C.rule}` }}>
            {items.map(d => (
              <div key={d.cod_sede} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: `1px solid ${C.ruleSoft}`, fontSize: 13, fontFamily: F.body }}>
                <span style={{ fontWeight: 500, color: C.ink }}>{d.sede}</span>
                <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: F.mono }}>{d.email}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 16, fontFamily: F.body }}>
            {footNote}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={requestClose} className="btn-press" style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.paper, color: C.inkSoft, border: `1px solid ${C.rule}`, cursor: 'pointer', fontFamily: F.body }}>Cancelar</button>
            <button onClick={onConfirm} className="btn-press" style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body, background: tono === 'crimson' ? C.crimson : C.ink, color: '#fff', border: 'none', cursor: 'pointer' }}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const [nuevaFecha, setNuevaFecha] = useState(new Date().toISOString().slice(0,10))
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

      {/* Contadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { l: 'Sedes',       v: data.length,      c: C.navy },
          { l: 'Enviadas',    v: enviadas.length,   c: C.ok },
          { l: 'Pendientes',  v: pendientes.length, c: pendientes.length > 0 ? C.warn : C.rule },
        ].map(s => (
          <div key={s.l} style={{ ...panel({ padding: '16px 18px 16px 22px' }), position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: s.c }} />
            <div style={rotulo}>{s.l}</div>
            <div style={{ ...cifra(40), color: C.ink, marginTop: 10 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Panel de envío */}
      {!cerrada && (
        <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: C.ink, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 800, fontStretch: '108%', fontSize: 18 }}>Mails del corte</div>
              <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 12, marginTop: 2, fontFamily: F.body }}>
                Desde mcrossi@ucasal.edu.ar vía Make · {aEnviar.length} {seleccionadas.length > 0 ? 'seleccionadas' : 'pendientes'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!enviando && (
                <button onClick={() => setMostrarEditorPlantilla(true)} className="btn-press" style={{
                  height: 38, padding: '0 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, fontFamily: F.body,
                  background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', cursor: 'pointer',
                }}>
                  Plantilla
                </button>
              )}
              {pendientes.length > 0 && !enviando && (
                <button onClick={() => setModalConfirm(true)} className="btn-press" style={{ height: 38, padding: '0 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 800, fontFamily: F.body, background: C.celeste, color: C.ink, border: 'none', cursor: 'pointer' }}>
                  Enviar {aEnviar.length} emails
                </button>
              )}
              {enviando && <div style={{ color: '#fff', fontSize: 13, fontFamily: F.mono }}>Enviando… {progreso}%</div>}
            </div>
          </div>

          {progreso > 0 && (
            <div style={{ height: 3, background: C.ruleSoft }}>
              <div style={{ width: `${progreso}%`, height: '100%', background: C.brass, transition: 'width 0.3s' }} />
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
                <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono }}>
                  Pendientes de envío
                </div>
                <TooltipHelp text="Seleccioná las sedes que querés enviar ahora. Sin selección se envían todas. Usá “Ver” para previsualizar el email — podés editarlo si necesitás." />
                <div style={{ flex: 1 }} />
                <button onClick={selAll} style={{ fontSize: 11, color: C.ink, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: F.body }}>Sel. todas</button>
                <button onClick={deselAll} style={{ fontSize: 11, color: C.inkSoft, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.body }}>Limpiar</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {pendientes.map(d => {
                  const sel = seleccion[d.cod_sede]
                  const pct = d.pct
                  const color = estadoColor(getEstado(d))
                  return (
                    <div key={d.cod_sede} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: sel ? 'rgba(127,178,240,0.08)' : C.paper,
                      border: `1px solid ${sel ? C.brass : C.ruleSoft}`,
                      transition: 'all 0.15s',
                    }}>
                      <div onClick={() => toggleSel(d.cod_sede)} style={{
                        width: 16, height: 16, flexShrink: 0, cursor: 'pointer',
                        border: `2px solid ${sel ? C.ink : C.rule}`,
                        background: sel ? C.ink : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: C.ink, fontFamily: F.body }}>{d.sede}</span>
                      <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.mono }}>{d.email}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: 'right', fontFamily: F.mono }}>{pct}%</span>
                      <button
                        onClick={() => setPreviewSede(d)}
                        style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: F.body,
                          border: `1px solid ${C.rule}`, background: '#fff', color: C.inkSoft,
                          cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.ink; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = C.ink }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.inkSoft; e.currentTarget.style.borderColor = C.rule }}
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
                <div style={{ fontSize: 11.5, fontWeight: 600, color: C.ok, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono }}>
                  ✓ Enviadas esta sesión
                </div>
                <TooltipHelp text="Por si el envío falló en el medio (ej: el escenario de Make estaba caído) y hay que mandarlos de nuevo." />
                <div style={{ flex: 1 }} />
                {!enviando && (
                  <button onClick={() => setModalConfirmReenvio(true)} style={{
                    fontSize: 11, fontWeight: 600, color: C.ink, background: 'transparent', fontFamily: F.body,
                    border: `1px solid ${C.rule}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                  }}>
                    Reenviar todas ({enviadas.length})
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enviadas.map(d => (
                  <span key={d.cod_sede} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: F.body,
                    background: 'rgba(15,138,95,0.08)', color: C.ok, border: `1px solid ${C.ok}45`,
                    padding: '3px 6px 3px 10px', fontWeight: 600,
                  }}>
                    ✓ {d.sede}
                    <button
                      onClick={() => reenviarUno(d)}
                      disabled={!!reenviando[d.cod_sede]}
                      title="Reenviar este email"
                      style={{
                        border: 'none', background: 'rgba(15,138,95,0.15)', color: C.ok,
                        borderRadius: '50%', width: 16, height: 16, fontSize: 9, lineHeight: 1,
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

      {/* Registrar nueva semana */}
      {!cerrada && (
        <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: mostrarNueva ? `1px solid ${C.rule}` : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink }}>Registrar nueva semana</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Ingresá los totales manualmente y guardá en Sheets</div>
            </div>
            <TooltipHelp text="Alternativa a subir el Excel: ingresás los totales manualmente por sede y se guarda en el historial de Google Sheets." />
            <div style={{ width: 12 }} />
            <button onClick={() => { setMostrarNueva(v => !v); setErrorGuardar(null); setModoReemplazarSemana(false) }} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
              background: mostrarNueva ? C.paper : C.ink,
              color: mostrarNueva ? C.inkSoft : '#fff', border: mostrarNueva ? `1px solid ${C.rule}` : 'none', cursor: 'pointer',
            }}>
              {mostrarNueva ? 'Cerrar' : 'Abrir'}
            </button>
          </div>

          {mostrarNueva && (
            <div className="animate-fadeIn" style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>Fecha del corte:</label>
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  style={{ padding: '7px 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontFamily: F.body }} />
                <button onClick={() => { const p = {}; data.forEach(d => { p[d.cod_sede] = d.total }); setValores(p) }}
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: C.paper, border: `1px solid ${C.rule}`, color: C.inkSoft, cursor: 'pointer', fontFamily: F.body }}>
                  Copiar valores actuales
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, marginBottom: 16, maxHeight: 360, overflowY: 'auto' }}>
                {data.map(d => (
                  <div key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.paper, border: `1px solid ${C.ruleSoft}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }}>
                      {d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}
                    </span>
                    <input type="number" min="0"
                      value={valores[d.cod_sede] ?? d.total}
                      onChange={e => setValores(prev => ({ ...prev, [d.cod_sede]: e.target.value }))}
                      style={{ width: 60, padding: '4px 6px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', fontFamily: F.mono }} />
                  </div>
                ))}
              </div>
              {/* Aviso de reemplazo — ya existe un corte para esta fecha */}
              {modoReemplazarSemana && (
                <div style={{
                  background: 'rgba(168,117,42,0.08)', border: `1px solid ${C.warn}55`, borderRadius: 8,
                  padding: '12px 16px', marginBottom: 16, fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, color: C.warn, marginBottom: 6 }}>
                    Ya existe un corte para esta fecha
                  </div>
                  <div style={{ color: C.ink, marginBottom: 12 }}>
                    ¿Querés reemplazar los datos existentes con los nuevos valores? Esta acción no se puede deshacer.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleGuardar(true)}
                      disabled={guardando}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
                        background: C.warn, color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: guardando ? 0.6 : 1,
                      }}
                    >
                      {guardando ? 'Reemplazando…' : 'Sí, reemplazar'}
                    </button>
                    <button
                      onClick={() => setModoReemplazarSemana(false)}
                      disabled={guardando}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
                        background: C.paper, color: C.inkSoft, border: `1px solid ${C.rule}`, cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!modoReemplazarSemana && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => handleGuardar(false)} disabled={guardando} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body, background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando…' : 'Guardar en Sheets'}
                  </button>
                  <button onClick={() => { setMostrarNueva(false); setErrorGuardar(null) }} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body, background: C.paper, color: C.inkSoft, border: `1px solid ${C.rule}`, cursor: 'pointer' }}>Cancelar</button>
                </div>
              )}

              {errorGuardar && (
                <div style={{ marginTop: 12, background: 'rgba(200,16,46,0.06)', border: `1px solid ${C.crimson}45`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.crimson }}>
                  {errorGuardar}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historial de envíos (persistente en Sheets) */}
      <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: mostrarLog ? `1px solid ${C.rule}` : 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink }}>Historial de envíos</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Registro de cuándo se enviaron los emails — se conserva entre sesiones</div>
          </div>
          <button onClick={toggleLog} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
            background: mostrarLog ? C.paper : C.ink,
            color: mostrarLog ? C.inkSoft : '#fff', border: mostrarLog ? `1px solid ${C.rule}` : 'none', cursor: 'pointer',
          }}>
            {mostrarLog ? 'Cerrar' : 'Ver historial'}
          </button>
        </div>

        {mostrarLog && (
          <div className="animate-fadeIn" style={{ padding: '16px 24px' }}>
            {cargandoLog ? (
              <div style={{ textAlign: 'center', padding: '24px', color: C.inkSoft, fontSize: 13 }}>Cargando…</div>
            ) : logAgrupado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: C.inkSoft, fontSize: 13 }}>Todavía no hay envíos registrados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                {logAgrupado.map((g, i) => {
                  const ok = g.items.filter(it => it.estado === 'enviado').length
                  const err = g.items.filter(it => it.estado !== 'enviado').length
                  return (
                    <div key={i} style={{ border: `1px solid ${C.rule}`, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        background: C.paper,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: F.mono }}>
                          {fmtFecha(g.fecha)} · {g.hora?.slice(0,5)}hs
                        </span>
                        {g.campana && (
                          <span style={{ fontSize: 11, color: C.ink, border: `1px solid ${C.rule}`, padding: '2px 8px', fontWeight: 600, fontFamily: F.mono }}>
                            {g.campana}
                          </span>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: C.ok, fontWeight: 600, fontFamily: F.mono }}>✓ {ok} enviados</span>
                          {err > 0 && <span style={{ fontSize: 12, color: C.crimson, fontWeight: 600, fontFamily: F.mono }}>✗ {err} con error</span>}
                          {g.confirmado ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.ink, border: `1px solid ${C.brass}`, padding: '3px 10px', fontFamily: F.body }}>
                              ✓ Entrega confirmada
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmarLote(g)}
                              disabled={confirmando[`${g.fecha} ${g.hora}`]}
                              title="Marcá esto solo si viste de verdad que los mails llegaron (ej: en Gmail o porque una sede te avisó)"
                              style={{
                                fontSize: 11, fontWeight: 600, color: C.warn, background: 'rgba(168,117,42,0.08)', fontFamily: F.body,
                                border: `1px solid ${C.warn}55`, padding: '3px 10px', cursor: 'pointer',
                              }}
                            >
                              {confirmando[`${g.fecha} ${g.hora}`] ? '…' : 'Confirmar entrega'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {g.items.map((it, j) => (
                          <span key={j} style={{
                            fontSize: 11, padding: '2px 9px', fontWeight: 600, fontFamily: F.mono,
                            background: it.estado === 'enviado' ? 'rgba(15,138,95,0.08)' : 'rgba(200,16,46,0.08)',
                            color: it.estado === 'enviado' ? C.ok : C.crimson,
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
          tono="crimson"
          title="Confirmar envío"
          sub={`${aEnviar.length} emails desde mcrossi@ucasal.edu.ar`}
          items={aEnviar}
          footNote='Para revisar o editar un email individual, cerrá y usá el botón "Ver" en cada sede.'
          onClose={() => setModalConfirm(false)}
          onConfirm={() => { setModalConfirm(false); enviarTodos() }}
          confirmLabel="Confirmar y enviar"
        />
      )}

      {/* Modal confirmación de reenvío masivo */}
      {modalConfirmReenvio && (
        <ConfirmModal
          tono="ink"
          title="Confirmar reenvío"
          sub={`${enviadas.length} emails ya marcados como enviados`}
          items={enviadas}
          footNote="Usalo solo si sabés que el envío anterior no llegó de verdad (ej: el escenario de Make estaba caído). Las sedes que ya recibieron el mail van a recibirlo de nuevo."
          onClose={() => setModalConfirmReenvio(false)}
          onConfirm={() => { setModalConfirmReenvio(false); reenviarTodos() }}
          confirmLabel="Confirmar y reenviar"
        />
      )}
    </div>
  )
}
