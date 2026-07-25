import { useState, useMemo, useEffect } from 'react'
import { obtenerSedesTodas, agregarSede, editarSede, setSedeActiva, obtenerNotasSede, agregarNotaSede } from '../hooks/useSheets'
import { C, F } from '../lib/theme'

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

function ModalShell({ children, onClose, title, sub, maxWidth = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(23,35,63,.6)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.paperRaised, borderRadius: 3, width: '100%', maxWidth, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>
        <div style={{ background: C.ink, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `2px solid ${C.brass}` }}>
          <div>
            <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 16 }}>{title}</div>
            {sub && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11.5, marginTop: 2, fontFamily: F.body }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NotasSedeModal({ d, onClose }) {
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
    <ModalShell onClose={onClose} title={`Notas · ${d.sede}`} sub="Seguimiento de contacto con esta sede">
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: 20, color: C.inkSoft, fontFamily: F.body }}>Cargando…</div>
        ) : notas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: C.inkSoft, fontSize: 13, fontFamily: F.body }}>Todavía no hay notas para esta sede</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notas.map((n, i) => (
              <div key={i} style={{ background: C.paper, border: `1px solid ${C.rule}`, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: C.inkSoft, marginBottom: 4, fontFamily: F.mono }}>{n.fecha}</div>
                <div style={{ fontSize: 13, color: C.ink, fontFamily: F.body }}>{n.nota}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={nueva} onChange={e => setNueva(e.target.value)}
            placeholder="Ej: hablé con Fulano, dijo que cargan el lunes…"
            onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.rule}`, borderRadius: 2, fontSize: 13, fontFamily: F.body }} />
          <button onClick={handleAgregar} disabled={guardando} style={{
            padding: '8px 16px', borderRadius: 2, fontSize: 13, fontWeight: 600, fontFamily: F.body,
            background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1,
          }}>
            {guardando ? '…' : 'Agregar'}
          </button>
        </div>
        {error && <div style={{ color: C.crimson, fontSize: 12, marginTop: 8 }}>❌ {error}</div>}
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

function SedeRow({ d }) {
  const est = getEstado(d)
  const e = E[est]
  const noav = d.var !== null && d.var === 0
  const varColor = d.var > 0 ? C.ok : d.var < 0 ? C.danger : C.inkSoft
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)
  const [mostrarNotas, setMostrarNotas] = useState(false)

  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, transition: 'background 0.15s' }}
      onMouseEnter={e2 => e2.currentTarget.style.background = C.paper}
      onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.inkSoft, border: `1px solid ${C.rule}`, padding: '1px 6px', flexShrink: 0, fontFamily: F.mono }}>{d.cod_sede}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.ink, fontFamily: F.body }}>{d.sede}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1, fontFamily: F.mono }}>{d.email}</div>
          </div>
          {noav && <span style={{ fontSize: 10, fontWeight: 600, color: C.warn, border: `1px solid ${C.warn}55`, padding: '1px 7px', flexShrink: 0, fontFamily: F.mono }}>⚠ Sin avance</span>}
        </div>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: C.inkSoft, fontFamily: F.mono }}>{d.objetivo}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: C.ink, fontFamily: F.mono }}>{d.total}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: C.inkSoft, fontFamily: F.mono }}>{Math.max(0, d.objetivo - d.total)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: varColor, fontFamily: F.mono }}>{varTxt}</td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: C.ruleSoft, overflow: 'hidden', minWidth: 80 }}>
            <div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: e.color, transition: 'width 0.6s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: e.color, width: 40, textAlign: 'right', fontFamily: F.mono }}>{d.pct}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <EstadoTag color={e.color}>{e.label}</EstadoTag>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <button onClick={() => setMostrarNotas(true)} title="Notas de seguimiento" style={{
          border: `1px solid ${C.rule}`, background: '#fff', color: C.inkSoft,
          borderRadius: 2, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
        }}>
          📝
        </button>
        {mostrarNotas && <NotasSedeModal d={d} onClose={() => setMostrarNotas(false)} />}
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

const inputStyle = { width: '100%', padding: '5px 8px', border: `1px solid ${C.rule}`, borderRadius: 2, fontSize: 12, fontFamily: F.body }

function FilaSedeEditable({ s, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ sede: s.sede || '', email: s.email || '', saludo: s.saludo || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const activa = isActiva(s)

  const guardar = async () => {
    setGuardando(true); setError(null)
    try {
      await editarSede({ cod_sede: s.cod_sede, ...form })
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
          <button onClick={() => setEditando(true)} style={{ fontSize: 11, fontWeight: 600, color: C.ink, background: 'none', border: 'none', cursor: 'pointer' }}>✏️ Editar</button>
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
    setAgregando(true); setErrorNueva(null)
    try {
      await agregarSede(nueva)
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
          <div style={{ color: C.crimson, fontSize: 13, fontFamily: F.body }}>❌ {error}</div>
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
          <input placeholder="Email" value={nueva.email} onChange={e => setNueva(n => ({ ...n, email: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
          <input placeholder="Saludo (ej: Estimados)" value={nueva.saludo} onChange={e => setNueva(n => ({ ...n, saludo: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: 'auto' }} />
          <button onClick={handleAgregar} disabled={agregando} style={{
            padding: '7px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600, fontFamily: F.body,
            background: C.ink, color: '#fff', border: 'none', cursor: 'pointer', opacity: agregando ? 0.6 : 1,
          }}>
            {agregando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        {errorNueva && <div style={{ color: C.crimson, fontSize: 12, marginTop: 8 }}>❌ {errorNueva}</div>}
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8, fontFamily: F.body }}>
          💡 Después de agregar una sede nueva, cargale un objetivo en la hoja "objetivos" de Sheets para que aparezca con datos en el dashboard.
        </div>
      </div>
    </ModalShell>
  )
}

export default function Sedes({ data, campanas, campanaActiva, onSedesChanged }) {
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
    <tr style={{ background: C.paper, borderBottom: `1px solid ${C.rule}` }}>
      {['Sede', 'Objetivo', 'Actual', 'Faltan', 'Var.', 'Cumplimiento', 'Estado', 'Notas'].map(h => (
        <th key={h} style={{
          padding: '10px ' + (h === 'Sede' || h === 'Cumplimiento' || h === 'Estado' ? '16px' : '12px'),
          textAlign: h === 'Sede' || h === 'Cumplimiento' ? 'left' : 'center',
          fontSize: 10, fontWeight: 600, color: C.inkSoft,
          textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono,
        }}>{h}</th>
      ))}
    </tr>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F.body }}>

      {/* Toolbar */}
      <div style={{
        background: C.paperRaised, border: `1px solid ${C.rule}`,
        padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input type="text" value={busq} onChange={e => setBusq(e.target.value)}
          placeholder="Buscar sede…"
          style={{ padding: '7px 12px', border: `1px solid ${C.rule}`, borderRadius: 2, fontSize: 13, outline: 'none', width: 200, fontFamily: F.body }} />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${C.rule}`, borderRadius: 2, fontSize: 13, background: '#fff', outline: 'none', fontFamily: F.body }}>
          <option value="">Todas las sedes</option>
          <option value="green">En objetivo (≥50%)</option>
          <option value="amber">En progreso (1–49%)</option>
          <option value="red">Sin ingresos</option>
          <option value="noav">Sin avance vs anterior</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMostrarGestion(true)} style={{
          padding: '7px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600, fontFamily: F.body,
          background: 'transparent', color: C.ink, border: `1px solid ${C.ink}`, cursor: 'pointer',
        }}>
          Gestionar sedes
        </button>
        <div style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.mono }}>{filtered.length} sedes</div>
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
            <div style={{
              padding: '6px 4px 6px 12px', marginBottom: 8,
              borderLeft: `3px solid ${e.color}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: e.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: F.mono }}>
                {e.label} · {items.length} sedes
              </span>
            </div>
            <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>{thead}</thead>
                <tbody>
                  {items.map(d => <SedeRow key={d.cod_sede} d={d} />)}
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
