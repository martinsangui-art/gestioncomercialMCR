import { useState, useMemo, useEffect } from 'react'
import { obtenerSedesTodas, agregarSede, editarSede, setSedeActiva, obtenerNotasSede, agregarNotaSede } from '../hooks/useSheets'

function getEstado(d) {
  if (d.total === 0) return 'red'
  if (d.pct >= 50) return 'green'
  return 'amber'
}

const E = {
  green: { label: 'En objetivo',  color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  amber: { label: 'En progreso',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  red:   { label: 'Sin ingresos', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ background: 'linear-gradient(135deg,#1B2A6B,#0f1d4a)', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>📝 Notas · {d.sede}</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2 }}>Seguimiento de contacto con esta sede</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Cargando…</div>
          ) : notas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Todavía no hay notas para esta sede</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notas.map((n, i) => (
                <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' }}>{n.fecha}</div>
                  <div style={{ fontSize: 13, color: '#0f172a' }}>{n.nota}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={nueva} onChange={e => setNueva(e.target.value)}
              placeholder="Ej: hablé con Fulano, dijo que cargan el lunes…"
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
            <button onClick={handleAgregar} disabled={guardando} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: '#1B2A6B', color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1,
            }}>
              {guardando ? '…' : 'Agregar'}
            </button>
          </div>
          {error && <div style={{ color: '#e11d48', fontSize: 12, marginTop: 8 }}>❌ {error}</div>}
        </div>
      </div>
    </div>
  )
}

function SedeRow({ d }) {
  const est = getEstado(d)
  const e = E[est]
  const noav = d.var !== null && d.var === 0
  const varColor = d.var > 0 ? '#059669' : d.var < 0 ? '#e11d48' : '#94a3b8'
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)
  const [mostrarNotas, setMostrarNotas] = useState(false)

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
      onMouseEnter={e2 => e2.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 20, flexShrink: 0 }}>{d.cod_sede}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{d.sede}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{d.email}</div>
          </div>
          {noav && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>⚠ Sin avance</span>}
        </div>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{d.objetivo}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{d.total}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, d.objetivo - d.total)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: varColor, fontVariantNumeric: 'tabular-nums' }}>{varTxt}</td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
            <div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: e.color, borderRadius: 3, transition: 'width 0.6s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: e.color, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.pct}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
          borderRadius: 20, fontSize: 11, fontWeight: 600, color: e.color, background: e.bg,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
          {e.label}
        </span>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <button onClick={() => setMostrarNotas(true)} title="Notas de seguimiento" style={{
          border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
          borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
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
    <tr style={{ borderBottom: '1px solid #f1f5f9', opacity: activa ? 1 : 0.5 }}>
      <td style={{ padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>{s.cod_sede}</td>
      {editando ? (
        <>
          <td style={{ padding: '6px 8px' }}>
            <input value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
          </td>
          <td style={{ padding: '6px 8px' }}>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
          </td>
          <td style={{ padding: '6px 8px' }}>
            <input value={form.saludo} onChange={e => setForm(f => ({ ...f, saludo: e.target.value }))}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
          </td>
        </>
      ) : (
        <>
          <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{s.sede}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b' }}>{s.email}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b' }}>{s.saludo}</td>
        </>
      )}
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <button onClick={toggleActiva} disabled={guardando} style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
          background: activa ? '#ecfdf5' : '#f1f5f9', color: activa ? '#059669' : '#94a3b8',
        }}>
          {activa ? '✓ Activa' : 'Inactiva'}
        </button>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {editando ? (
          <>
            <button onClick={guardar} disabled={guardando} style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>
              {guardando ? '…' : 'Guardar'}
            </button>
            <button onClick={() => setEditando(false)} disabled={guardando} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} style={{ fontSize: 11, fontWeight: 600, color: '#1B2A6B', background: 'none', border: 'none', cursor: 'pointer' }}>✏️ Editar</button>
        )}
        {error && <div style={{ color: '#e11d48', fontSize: 10, marginTop: 2 }}>{error}</div>}
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 780,
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column', maxHeight: '88vh',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#1B2A6B,#0f1d4a)',
          padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>⚙️ Gestionar sedes</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2 }}>Alta, edición y activar/desactivar — sin tocar la planilla</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Cargando…</div>
          ) : error ? (
            <div style={{ color: '#e11d48', fontSize: 13 }}>❌ {error}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Cod', 'Sede', 'Email', 'Saludo', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sedes.map(s => <FilaSedeEditable key={s.cod_sede} s={s} onGuardado={handleGuardado} />)}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            ➕ Agregar sede nueva
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Cod. sede" value={nueva.cod_sede} onChange={e => setNueva(n => ({ ...n, cod_sede: e.target.value }))}
              style={{ width: 90, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
            <input placeholder="Nombre" value={nueva.sede} onChange={e => setNueva(n => ({ ...n, sede: e.target.value }))}
              style={{ flex: 1, minWidth: 140, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
            <input placeholder="Email" value={nueva.email} onChange={e => setNueva(n => ({ ...n, email: e.target.value }))}
              style={{ flex: 1, minWidth: 140, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
            <input placeholder="Saludo (ej: Estimados)" value={nueva.saludo} onChange={e => setNueva(n => ({ ...n, saludo: e.target.value }))}
              style={{ flex: 1, minWidth: 140, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
            <button onClick={handleAgregar} disabled={agregando} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#1B2A6B', color: '#fff', border: 'none', cursor: 'pointer', opacity: agregando ? 0.6 : 1,
            }}>
              {agregando ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
          {errorNueva && <div style={{ color: '#e11d48', fontSize: 12, marginTop: 8 }}>❌ {errorNueva}</div>}
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
            💡 Después de agregar una sede nueva, cargale un objetivo en la hoja "objetivos" de Sheets para que aparezca con datos en el dashboard.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Sedes({ data, campanas, campanaActiva, onSedesChanged }) {
  const [filtro, setFiltro] = useState('')
  const [busq, setBusq] = useState('')
  const [mostrarGestion, setMostrarGestion] = useState(false)

  const camp = campanas?.find(c => c.id === campanaActiva)

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
    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      {['Sede', 'Objetivo', 'Actual', 'Faltan', 'Var.', 'Cumplimiento', 'Estado', 'Notas'].map(h => (
        <th key={h} style={{
          padding: '10px ' + (h === 'Sede' || h === 'Cumplimiento' || h === 'Estado' ? '16px' : '12px'),
          textAlign: h === 'Sede' || h === 'Cumplimiento' ? 'left' : 'center',
          fontSize: 10, fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{h}</th>
      ))}
    </tr>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input type="text" value={busq} onChange={e => setBusq(e.target.value)}
          placeholder="🔍 Buscar sede…"
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 200 }} />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
          <option value="">Todas las sedes</option>
          <option value="green">✅ En objetivo (≥50%)</option>
          <option value="amber">⚠️ En progreso (1–49%)</option>
          <option value="red">❌ Sin ingresos</option>
          <option value="noav">🟠 Sin avance vs anterior</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMostrarGestion(true)} style={{
          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: '#eef0f8', color: '#1B2A6B', border: '1px solid #b8c0e0', cursor: 'pointer',
        }}>
          ⚙️ Gestionar sedes
        </button>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} sedes</div>
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
              <span style={{ fontSize: 11, fontWeight: 700, color: e.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {e.label} · {items.length} sedes
              </span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
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
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: 14 }}>
          No hay sedes que coincidan con los filtros
        </div>
      )}
    </div>
  )
}
