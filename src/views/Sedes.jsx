import { useState, useMemo, useEffect } from 'react'
import { obtenerSedesTodas, agregarSede, editarSede, setSedeActiva, obtenerNotasSede, agregarNotaSede } from '../hooks/useSheets'
import { C, F } from '../lib/theme'
import ModalShell from '../components/ModalShell'

function getEstado(d) {
  if (d.total === 0) return 'red'
  if (d.pct >= 50) return 'green'
  return 'amber'
}

const E = {
  green: { label: 'En objetivo',  color: C.ok },
  amber: { label: 'En progreso',  color: C.warn },
  red:   { label: 'Sin ingresos', color: C.danger },
}

// Sección de notas de seguimiento — se usa embebida dentro del modal de
// detalle de sede (antes vivía en su propio modal separado).
function NotasSeccion({ d }) {
  const [notas, setNotas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const cargar = () => {
    setCargando(true)
    obtenerNotasSede(d.cod_sede).then(setNotas).catch(e => setError(e.message)).finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line

  const handleAgregar = async () => {
    if (!nueva.trim()) return
    setGuardando(true); setError(null)
    try {
      await agregarNotaSede(d.cod_sede, nueva.trim())
      setNueva('')
      cargar()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  return (
    <div>
      <div style={campoLabelStyle}>Notas de seguimiento</div>
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 16, color: C.inkSoft, fontSize: 13, fontFamily: F.body }}>Cargando…</div>
      ) : notas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: C.inkSoft, fontSize: 13, fontFamily: F.body }}>Todavía no hay notas para esta sede</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
          {notas.map((n, i) => (
            <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: '9px 11px', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: C.inkSoft, marginBottom: 3, fontFamily: F.mono }}>{n.fecha}</div>
              <div style={{ fontSize: 13, color: C.ink, fontFamily: F.body }}>{n.nota}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={nueva} onChange={e => setNueva(e.target.value)}
          placeholder="Ej: hablé con Fulano, dijo que cargan el lunes…"
          onKeyDown={e => e.key === 'Enter' && handleAgregar()}
          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontFamily: F.body }} />
        <button onClick={handleAgregar} disabled={guardando} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
          background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1,
        }}>
          {guardando ? '…' : 'Agregar'}
        </button>
      </div>
      {error && <div style={{ color: C.crimson, fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

const campoLabelStyle = { fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: F.mono }

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || C.ink, fontFamily: F.mono }}>{value}</div>
    </div>
  )
}

// Modal de detalle al clickear una sede — junta todo lo relacionado a esa
// sede en un solo lugar: estado en la campaña activa, evolución histórica de
// esta sede puntual (filtrando el historial general) y notas de seguimiento.
function SedeDetalleModal({ d, historial, onClose }) {
  const est = getEstado(d)
  const e = E[est]
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)
  const varColor = d.var > 0 ? C.ok : d.var < 0 ? C.danger : C.inkSoft

  const evolucion = useMemo(() => {
    return (historial || [])
      .filter(r => String(r.cod_sede) === String(d.cod_sede))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [historial, d.cod_sede])

  return (
    <ModalShell onClose={onClose} title={d.sede} sub={`Cod. ${d.cod_sede} · ${d.email}`} maxWidth={560}>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={campoLabelStyle}>Estado en la campaña activa</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <StatBox label="Objetivo" value={d.objetivo} />
            <StatBox label="Actual" value={d.total} color={C.ink} />
            <StatBox label="Faltan" value={Math.max(0, d.objetivo - d.total)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <StatBox label="Cumplimiento" value={`${d.pct}%`} color={e.color} />
            <StatBox label="Var. semana" value={varTxt} color={varColor} />
            <div style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
              <EstadoTag color={e.color}>{e.label}</EstadoTag>
            </div>
          </div>
        </div>

        <div>
          <div style={campoLabelStyle}>Evolución en esta campaña</div>
          {evolucion.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 14, color: C.inkSoft, fontSize: 13, fontFamily: F.body, border: `1px solid ${C.rule}` }}>
              Sin historial todavía para esta sede
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.rule}`, maxHeight: 140, overflowY: 'auto' }}>
              {evolucion.map((r, i) => {
                const obj = Number(r.objetivo) || 0
                const tot = Number(r.total) || 0
                const pct = obj > 0 ? Math.round(tot / obj * 100) : 0
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', borderBottom: i < evolucion.length - 1 ? `1px solid ${C.ruleSoft}` : 'none',
                    background: i % 2 === 0 ? '#fff' : C.paper,
                  }}>
                    <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.mono }}>{r.fecha.slice(5).replace('-', '/')}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: F.mono }}>{tot}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 50 ? C.ok : pct > 0 ? C.warn : C.danger, fontFamily: F.mono }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <NotasSeccion d={d} />
      </div>
    </ModalShell>
  )
}

function EstadoTag({ color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
      fontSize: 10.5, fontWeight: 600, color, border: `1px solid ${color}55`,
      fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.03em',
    }}>
      <span style={{ width: 5, height: 5, background: color, flexShrink: 0 }} />
      {children}
    </span>
  )
}

function SedeRow({ d, historial }) {
  const est = getEstado(d)
  const e = E[est]
  const noav = d.var !== null && d.var === 0
  const varColor = d.var > 0 ? C.ok : d.var < 0 ? C.danger : C.inkSoft
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)
  const [mostrarDetalle, setMostrarDetalle] = useState(false)

  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, transition: 'background 0.15s', cursor: 'pointer' }}
      onClick={() => setMostrarDetalle(true)}
      onMouseEnter={e2 => e2.currentTarget.style.background = C.paper}
      onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '11px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: C.ink }}>{d.sede}</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11 }}>{d.cod_sede}</span> · {d.email || 'sin email'}
            </div>
          </div>
          {noav && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#8A5D00', background: '#FBF0D9', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>Sin avance</span>}
        </div>
      </td>
      <td style={{ padding: '11px 12px', textAlign: 'right', color: C.inkSoft, fontFamily: F.mono }}>{d.objetivo}</td>
      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: C.ink, fontFamily: F.mono }}>{d.total}</td>
      <td style={{ padding: '11px 12px', textAlign: 'right', color: C.inkSoft, fontFamily: F.mono }}>{Math.max(0, d.objetivo - d.total) || '—'}</td>
      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 600, color: varColor, fontFamily: F.mono }}>{varTxt}</td>
      <td style={{ padding: '11px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: C.ruleSoft, borderRadius: 3, overflow: 'hidden', minWidth: 90 }}>
            <div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: e.color, borderRadius: 3, transition: 'width 0.6s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: 44, textAlign: 'right', fontFamily: F.mono }}>{d.pct}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <button onClick={e2 => { e2.stopPropagation(); setMostrarDetalle(true) }} title="Ver detalle y notas" aria-label="Ver detalle y notas" style={{
          border: `1px solid ${C.rule}`, background: '#fff', color: C.navy,
          borderRadius: 8, width: 32, height: 32, display: 'inline-grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" />
          </svg>
        </button>
        {mostrarDetalle && <SedeDetalleModal d={d} historial={historial} onClose={() => setMostrarDetalle(false)} />}
      </td>
    </tr>
  )
}

function isActiva(s) {
  const v = s.activa
  if (v === undefined || v === null || v === '') return true
  const str = String(v).trim().toUpperCase()
  return !(str === 'FALSE' || str === 'FALSO' || str === '0' || str === 'NO')
}

const inputStyle = { width: '100%', padding: '5px 8px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 12, fontFamily: F.body }

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// Normaliza el campo de email de una sede: acepta 1 o varios destinatarios
// separados por coma, punto y coma, o espacios/saltos de línea (formatos
// comunes al pegar o tipear rápido). Devuelve siempre "a@x.com, b@y.com" —
// el formato que Gmail y el webhook de Make interpretan como múltiples
// destinatarios sin romper el envío. Si algún token no es un email válido,
// devuelve error en vez de guardar algo que rompa el escenario de Make.
function normalizarEmails(raw) {
  const tokens = raw.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { error: 'El email no puede estar vacío' }
  const invalidos = tokens.filter(t => !EMAIL_RE.test(t))
  if (invalidos.length > 0) {
    return { error: `No parece${invalidos.length > 1 ? 'n' : ''} email${invalidos.length > 1 ? 's' : ''} válido${invalidos.length > 1 ? 's' : ''}: ${invalidos.join(', ')}` }
  }
  return { value: tokens.join(', ') }
}

function FilaSedeEditable({ s, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ sede: s.sede || '', email: s.email || '', saludo: s.saludo || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const activa = isActiva(s)

  const guardar = async () => {
    const emailCheck = normalizarEmails(form.email)
    if (emailCheck.error) { setError(emailCheck.error); return }
    setGuardando(true); setError(null)
    try {
      await editarSede({ cod_sede: s.cod_sede, ...form, email: emailCheck.value })
      setEditando(false)
      onGuardado()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  const toggleActiva = async () => {
    setGuardando(true); setError(null)
    try {
      await setSedeActiva(s.cod_sede, !activa)
      onGuardado()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, opacity: activa ? 1 : 0.5, fontFamily: F.body }}>
      <td style={{ padding: '8px 12px', fontSize: 11, color: C.inkSoft, fontFamily: F.mono }}>{s.cod_sede}</td>
      {editando ? (
        <>
          <td style={{ padding: '6px 8px' }}><input value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))} style={inputStyle} /></td>
          <td style={{ padding: '6px 8px' }}><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></td>
          <td style={{ padding: '6px 8px' }}><input value={form.saludo} onChange={e => setForm(f => ({ ...f, saludo: e.target.value }))} style={inputStyle} /></td>
        </>
      ) : (
        <>
          <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink }}>{s.sede}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: C.inkSoft, fontFamily: F.mono }}>{s.email}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: C.inkSoft }}>{s.saludo}</td>
        </>
      )}
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <button onClick={toggleActiva} disabled={guardando} style={{
          fontSize: 10.5, fontWeight: 600, padding: '3px 9px', border: 'none', cursor: 'pointer', fontFamily: F.mono,
          background: 'transparent', color: activa ? C.ok : C.inkSoft, textTransform: 'uppercase',
        }}>
          {activa ? '✓ Activa' : 'Inactiva'}
        </button>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {editando ? (
          <>
            <button onClick={guardar} disabled={guardando} style={{ fontSize: 11, fontWeight: 600, color: C.ok, background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>
              {guardando ? '…' : 'Guardar'}
            </button>
            <button onClick={() => setEditando(false)} disabled={guardando} style={{ fontSize: 11, color: C.inkSoft, background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} style={{ fontSize: 11, fontWeight: 600, color: C.ink, background: 'none', border: 'none', cursor: 'pointer' }}>Editar</button>
        )}
        {error && <div style={{ color: C.crimson, fontSize: 10, marginTop: 2 }}>{error}</div>}
      </td>
    </tr>
  )
}

function GestionSedesModal({ onClose, onChanged }) {
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nueva, setNueva] = useState({ cod_sede: '', sede: '', email: '', saludo: '' })
  const [agregando, setAgregando] = useState(false)
  const [errorNueva, setErrorNueva] = useState(null)

  const cargar = () => {
    setCargando(true)
    obtenerSedesTodas()
      .then(data => setSedes(data.sort((a, b) => String(a.sede).localeCompare(String(b.sede)))))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line

  const handleGuardado = () => { cargar(); onChanged() }

  const handleAgregar = async () => {
    if (!nueva.cod_sede.trim() || !nueva.sede.trim()) {
      setErrorNueva('Cod. sede y nombre son obligatorios'); return
    }
    const emailCheck = normalizarEmails(nueva.email || '')
    if (nueva.email.trim() && emailCheck.error) {
      setErrorNueva(emailCheck.error); return
    }
    setAgregando(true); setErrorNueva(null)
    try {
      await agregarSede({ ...nueva, email: emailCheck.value ?? '' })
      setNueva({ cod_sede: '', sede: '', email: '', saludo: '' })
      handleGuardado()
    } catch (e) { setErrorNueva(e.message) }
    setAgregando(false)
  }

  return (
    <ModalShell onClose={onClose} title="Gestionar sedes" sub="Alta, edición y activar/desactivar — sin tocar la planilla" maxWidth={780}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: 32, color: C.inkSoft, fontFamily: F.body }}>Cargando…</div>
        ) : error ? (
          <div style={{ color: C.crimson, fontSize: 13, fontFamily: F.body }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.paper, borderBottom: `1px solid ${C.rule}` }}>
                {['Cod', 'Sede', 'Email', 'Saludo', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sedes.map(s => <FilaSedeEditable key={s.cod_sede} s={s} onGuardado={handleGuardado} />)}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: F.mono }}>
          Agregar sede nueva
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Cod. sede" value={nueva.cod_sede} onChange={e => setNueva(n => ({ ...n, cod_sede: e.target.value }))}
            style={{ ...inputStyle, width: 90 }} />
          <input placeholder="Nombre" value={nueva.sede} onChange={e => setNueva(n => ({ ...n, sede: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
          <input placeholder="Email (varios: separados por coma)" value={nueva.email} onChange={e => setNueva(n => ({ ...n, email: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
          <input placeholder="Saludo (ej: Estimados)" value={nueva.saludo} onChange={e => setNueva(n => ({ ...n, saludo: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
          <button onClick={handleAgregar} disabled={agregando} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: F.body,
            background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: agregando ? 0.6 : 1,
          }}>
            {agregando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        {errorNueva && <div style={{ color: C.crimson, fontSize: 12, marginTop: 8 }}>{errorNueva}</div>}
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8, fontFamily: F.body }}>
          Después de agregar una sede nueva, cargale un objetivo en la hoja "objetivos" de Sheets para que aparezca con datos en el dashboard.
        </div>
      </div>
    </ModalShell>
  )
}

export default function Sedes({ data, historial, campanas, campanaActiva, onSedesChanged }) {
  const [filtro, setFiltro] = useState('')
  const [busq, setBusq] = useState('')
  const [mostrarGestion, setMostrarGestion] = useState(false)

  const filtered = useMemo(() => {
    return data.filter(d => {
      const est = getEstado(d)
      if (filtro === 'green' && est !== 'green') return false
      if (filtro === 'amber' && est !== 'amber') return false
      if (filtro === 'red'   && est !== 'red')   return false
      if (filtro === 'noav'  && d.var !== 0)     return false
      if (busq && !d.sede.toLowerCase().includes(busq.toLowerCase())) return false
      return true
    }).sort((a, b) => {
      if (a.total === 0 && b.total > 0) return 1
      if (b.total === 0 && a.total > 0) return -1
      return b.pct - a.pct
    })
  }, [data, filtro, busq])

  const grupos = {
    green: filtered.filter(d => getEstado(d) === 'green'),
    amber: filtered.filter(d => getEstado(d) === 'amber'),
    red:   filtered.filter(d => getEstado(d) === 'red'),
  }

  const thead = (
    <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
      {[['Sede', 'left'], ['Objetivo', 'right'], ['Inscriptos', 'right'], ['Faltan', 'right'], ['Var.', 'right'], ['Cumplimiento', 'left'], ['', 'center']].map(([h, al]) => (
        <th key={h || 'notas'} style={{
          padding: '11px ' + (h === 'Sede' || h === 'Cumplimiento' ? '18px' : '12px'),
          textAlign: al, fontSize: 12, fontWeight: 600, color: C.inkSoft,
        }}>{h}</th>
      ))}
    </tr>
  )

  const cuenta = {
    '': data.length,
    green: data.filter(d => getEstado(d) === 'green').length,
    amber: data.filter(d => getEstado(d) === 'amber').length,
    red: data.filter(d => getEstado(d) === 'red').length,
    noav: data.filter(d => d.var === 0).length,
  }
  const FILTROS = [['', 'Todas'], ['green', 'En objetivo'], ['amber', 'En progreso'], ['red', 'Sin ingresos'], ['noav', 'Sin avance']]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F.body }}>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.inkSoft} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12 }}>
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
          </svg>
          <input type="search" value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar sede" aria-label="Buscar sede"
            style={{ height: 40, padding: '0 12px 0 34px', border: `1px solid ${C.rule}`, borderRadius: 10, fontSize: 14, outline: 'none', width: 220, fontFamily: F.body, background: '#fff' }} />
        </div>
        <div role="group" aria-label="Filtrar por estado" style={{ display: 'flex', gap: 4, background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 10, padding: 3, flexWrap: 'wrap' }}>
          {FILTROS.map(([k, l]) => {
            const sel = filtro === k
            return (
              <button key={k} onClick={() => setFiltro(k)} aria-pressed={sel} style={{
                height: 32, padding: '0 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: F.body,
                fontSize: 13, fontWeight: sel ? 700 : 500, background: sel ? C.ink : 'transparent', color: sel ? '#fff' : C.ink,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {l}<span style={{ fontFamily: F.mono, fontSize: 11, opacity: 0.6 }}>{cuenta[k]}</span>
              </button>
            )
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMostrarGestion(true)} className="btn-press" style={{
          height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
          background: '#fff', color: C.navy, border: `1px solid ${C.rule}`, cursor: 'pointer',
        }}>
          Gestionar sedes
        </button>
      </div>

      {mostrarGestion && (
        <GestionSedesModal
          onClose={() => setMostrarGestion(false)}
          onChanged={() => onSedesChanged?.()}
        />
      )}

      {/* Tabla por grupos */}
      {Object.entries(grupos).map(([key, items]) => {
        if (!items.length) return null
        const e = E[key]
        return (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 10px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
              <span style={{ fontSize: 16, fontWeight: 800, fontStretch: '105%', color: C.ink }}>{e.label}</span>
              <span style={{ fontFamily: F.mono, fontSize: 12.5, color: C.inkSoft }}>{items.length}</span>
            </div>
            <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 12, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>{thead}</thead>
                <tbody>
                  {items.map(d => <SedeRow key={d.cod_sede} d={d} historial={historial} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!filtered.length && (
        <div style={{ textAlign: 'center', padding: '48px', color: C.inkSoft, fontSize: 14 }}>
          No hay sedes que coincidan con los filtros
        </div>
      )}
    </div>
  )
}
