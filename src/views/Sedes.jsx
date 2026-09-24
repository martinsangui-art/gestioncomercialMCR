import { useState, useMemo, useEffect } from 'react'
import { obtenerSedesTodas, agregarSede, editarSede, setSedeActiva, obtenerObjetivos, setObjetivo } from '../hooks/useSheets'
import { C, F } from '../lib/theme'
import ModalShell from '../components/ModalShell'
import { estadoSede, ESTADOS } from '../components/FichaSede'

// Grupos de la tabla: misma regla de estado que el resto de la app
function getEstado(d) {
  const e = estadoSede(d)
  return e === 'ok' ? 'green' : e === 'prog' ? 'amber' : 'red'
}
const E = {
  green: ESTADOS.ok,
  amber: ESTADOS.prog,
  red:   ESTADOS.cero,
}

function SedeRow({ d, onAbrir }) {
  const est = getEstado(d)
  const e = E[est]
  const noav = d.var !== null && d.var === 0
  const varColor = d.var > 0 ? C.ok : d.var < 0 ? C.danger : C.inkSoft
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)

  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, transition: 'background 0.15s', cursor: 'pointer' }}
      onClick={() => onAbrir(d)} tabIndex={0} aria-label={`Abrir la ficha de ${d.sede}`}
      onKeyDown={e2 => { if (e2.key === 'Enter') onAbrir(d) }}
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
        <button onClick={e2 => { e2.stopPropagation(); onAbrir(d) }} title="Ficha y seguimiento" aria-label={`Ficha y seguimiento de ${d.sede}`} tabIndex={-1} style={{
          border: `1px solid ${C.rule}`, background: '#fff', color: C.navy,
          borderRadius: 8, width: 32, height: 32, display: 'inline-grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" />
          </svg>
        </button>
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

const inputStyle = { width: '100%', height: 34, padding: '0 10px', border: `1px solid ${C.rule}`, borderRadius: 7, fontSize: 13, fontFamily: F.body, background: '#fff', minWidth: 0 }

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

const linkBtn = (color = C.navy) => ({ fontSize: 13, fontWeight: 700, color, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.body, padding: '4px 2px' })

function FilaSedeEditable({ s, objetivo, campanaActiva, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ sede: s.sede || '', email: s.email || '', saludo: s.saludo || '', objetivo: objetivo ?? '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const activa = isActiva(s)

  const guardar = async () => {
    const emailCheck = normalizarEmails(form.email)
    if (emailCheck.error) { setError(emailCheck.error); return }
    const obj = form.objetivo === '' ? null : Number(form.objetivo)
    if (obj !== null && !(obj >= 0)) { setError('El objetivo tiene que ser un número'); return }
    setGuardando(true); setError(null)
    try {
      await editarSede({ cod_sede: s.cod_sede, sede: form.sede, email: emailCheck.value, saludo: form.saludo })
      if (campanaActiva && obj !== null && obj !== Number(objetivo)) await setObjetivo(campanaActiva.id, s.cod_sede, obj)
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

  const td = { padding: '9px 10px', verticalAlign: 'middle' }
  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, fontFamily: F.body, background: editando ? C.celesteSoft : 'transparent' }}>
      {editando ? (
        <>
          <td style={td}><input aria-label="Nombre" value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))} style={inputStyle} /></td>
          <td style={td}><input aria-label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></td>
          <td style={td}><input aria-label="Saludo" value={form.saludo} onChange={e => setForm(f => ({ ...f, saludo: e.target.value }))} style={inputStyle} /></td>
          <td style={td}>{campanaActiva
            ? <input aria-label="Objetivo" type="number" min="0" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} style={{ ...inputStyle, width: 72, textAlign: 'right', fontFamily: F.mono }} />
            : <span style={{ color: C.inkSoft }}>—</span>}</td>
        </>
      ) : (
        <>
          <td style={td}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: activa ? C.ink : C.inkSoft }}>{s.sede}</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>{s.cod_sede}</div>
          </td>
          <td style={{ ...td, fontSize: 12.5, color: C.inkSoft, wordBreak: 'break-word' }}>{s.email || <span style={{ color: C.crimson }}>Falta email</span>}</td>
          <td style={{ ...td, fontSize: 12.5, color: C.inkSoft }}>{s.saludo}</td>
          <td style={{ ...td, textAlign: 'right', fontFamily: F.mono, fontWeight: 700, color: objetivo ? C.ink : C.crimson }}>
            {objetivo || (activa ? <span title="Sin objetivo no aparece en el tablero">falta</span> : '—')}
          </td>
        </>
      )}
      <td style={{ ...td, textAlign: 'center' }}>
        <button onClick={toggleActiva} disabled={guardando || editando} role="switch" aria-checked={activa}
          aria-label={`${s.sede}: ${activa ? 'activa' : 'inactiva'}`} title={activa ? 'Desactivar (deja de aparecer y de recibir mails)' : 'Activar'}
          style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', background: activa ? C.ok : C.rule, transition: 'background .15s', opacity: editando ? 0.5 : 1 }}>
          <span style={{ position: 'absolute', top: 3, left: activa ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
        </button>
      </td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {editando ? (
          <>
            <button onClick={guardar} disabled={guardando} style={linkBtn(C.ok)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button onClick={() => { setEditando(false); setError(null) }} disabled={guardando} style={{ ...linkBtn(C.inkSoft), fontWeight: 500, marginLeft: 8 }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} style={linkBtn()}>Editar</button>
        )}
        {error && <div role="alert" style={{ color: C.crimson, fontSize: 11.5, marginTop: 2, whiteSpace: 'normal', maxWidth: 180, marginLeft: 'auto' }}>{error}</div>}
      </td>
    </tr>
  )
}

// Sedes y objetivos: datos de contacto (para los mails), activar/desactivar
// y el objetivo de cada sede en la campaña activa — todo sin tocar la planilla.
function GestionSedesModal({ onClose, onChanged, campanaActiva }) {
  const [sedes, setSedes] = useState([])
  const [objetivos, setObjetivos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nueva, setNueva] = useState({ cod_sede: '', sede: '', email: '', saludo: 'Estimados', objetivo: '' })
  const [agregando, setAgregando] = useState(false)
  const [errorNueva, setErrorNueva] = useState(null)

  const cargar = () => {
    setCargando(true)
    Promise.all([
      obtenerSedesTodas(),
      campanaActiva ? obtenerObjetivos(campanaActiva.id).catch(() => []) : Promise.resolve([]),
    ])
      .then(([data, objs]) => {
        setSedes(data.sort((a, b) => (isActiva(b) - isActiva(a)) || String(a.sede).localeCompare(String(b.sede))))
        const m = {}; objs.forEach(o => { m[String(o.cod_sede)] = Number(o.objetivo) || 0 }); setObjetivos(m)
      })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line

  const handleGuardado = () => { cargar(); onChanged() }

  const handleAgregar = async () => {
    if (!nueva.cod_sede.trim() || !nueva.sede.trim()) {
      setErrorNueva('El código y el nombre son obligatorios'); return
    }
    const emailCheck = normalizarEmails(nueva.email || '')
    if (nueva.email.trim() && emailCheck.error) {
      setErrorNueva(emailCheck.error); return
    }
    if (campanaActiva && !(Number(nueva.objetivo) > 0)) {
      setErrorNueva(`Poné el objetivo de ${campanaActiva.nombre}: sin objetivo la sede no aparece en el tablero`); return
    }
    setAgregando(true); setErrorNueva(null)
    try {
      await agregarSede({ ...nueva, email: emailCheck.value ?? '', campana_id: campanaActiva?.id, objetivo: Number(nueva.objetivo) || 0 })
      setNueva({ cod_sede: '', sede: '', email: '', saludo: 'Estimados', objetivo: '' })
      handleGuardado()
    } catch (e) { setErrorNueva(e.message) }
    setAgregando(false)
  }

  const activas = sedes.filter(isActiva)
  const sinObjetivo = campanaActiva ? activas.filter(s => !objetivos[String(s.cod_sede)]).length : 0
  const th = { padding: '10px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.inkSoft, background: '#fff', position: 'sticky', top: 0, zIndex: 1, borderBottom: `1px solid ${C.rule}` }

  return (
    <ModalShell onClose={onClose} title="Sedes y objetivos"
      sub={campanaActiva ? `Contacto de cada sede y su objetivo en ${campanaActiva.nombre}` : 'Contacto de cada sede'} maxWidth={920}>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        {cargando ? (
          <div style={{ padding: 32, color: C.inkSoft, fontFamily: F.body }}>Cargando sedes…</div>
        ) : error ? (
          <div role="alert" style={{ padding: 20, color: C.crimson, fontSize: 13.5, fontFamily: F.body }}>{error}</div>
        ) : (
          <>
            {sinObjetivo > 0 && (
              <div style={{ margin: '14px 8px 4px', padding: '10px 14px', borderRadius: 8, background: '#FBF0D9', color: '#6B4A00', fontSize: 13, fontFamily: F.body }}>
                <strong>{sinObjetivo} {sinObjetivo === 1 ? 'sede activa no tiene' : 'sedes activas no tienen'} objetivo</strong> en {campanaActiva.nombre}: no aparecen en el tablero hasta que se lo cargues con “Editar”.
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Sede</th><th style={th}>Email para los mails</th><th style={th}>Saludo</th>
                  <th style={{ ...th, textAlign: 'right' }}>Objetivo</th><th style={{ ...th, textAlign: 'center' }}>Activa</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {sedes.map(s => (
                  <FilaSedeEditable key={s.cod_sede + ':' + (objetivos[String(s.cod_sede)] ?? '')} s={s}
                    objetivo={objetivos[String(s.cod_sede)]} campanaActiva={campanaActiva} onGuardado={handleGuardado} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.rule}`, flexShrink: 0, background: '#FAFBFD', fontFamily: F.body }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Sumar una sede</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(70px,90px) minmax(120px,1.4fr) minmax(140px,1.6fr) minmax(90px,1fr) minmax(70px,90px) auto', gap: 8, alignItems: 'center' }} className="grid-sumar-sede">
          <input aria-label="Código de la sede" placeholder="Código" value={nueva.cod_sede} onChange={e => setNueva(n => ({ ...n, cod_sede: e.target.value }))} style={{ ...inputStyle, fontFamily: F.mono }} />
          <input aria-label="Nombre de la sede" placeholder="Nombre" value={nueva.sede} onChange={e => setNueva(n => ({ ...n, sede: e.target.value }))} style={inputStyle} />
          <input aria-label="Email" placeholder="Email (varios, separados por coma)" value={nueva.email} onChange={e => setNueva(n => ({ ...n, email: e.target.value }))} style={inputStyle} />
          <input aria-label="Saludo del mail" placeholder="Saludo" value={nueva.saludo} onChange={e => setNueva(n => ({ ...n, saludo: e.target.value }))} style={inputStyle} />
          <input aria-label="Objetivo" placeholder="Objetivo" type="number" min="0" value={nueva.objetivo} onChange={e => setNueva(n => ({ ...n, objetivo: e.target.value }))} disabled={!campanaActiva} style={{ ...inputStyle, textAlign: 'right', fontFamily: F.mono }} />
          <button onClick={handleAgregar} disabled={agregando} className="btn-press" style={{
            height: 34, padding: '0 16px', borderRadius: 7, fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
            background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', opacity: agregando ? 0.6 : 1, whiteSpace: 'nowrap',
          }}>
            {agregando ? 'Sumando…' : 'Sumar sede'}
          </button>
        </div>
        {errorNueva && <div role="alert" style={{ color: C.crimson, fontSize: 12.5, marginTop: 8 }}>{errorNueva}</div>}
      </div>
    </ModalShell>
  )
}

export default function Sedes({ data, campanas, campanaActiva, onSedesChanged, onAbrirSede }) {
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
          Sedes y objetivos
        </button>
      </div>

      {mostrarGestion && (
        <GestionSedesModal
          onClose={() => setMostrarGestion(false)}
          onChanged={() => onSedesChanged?.()}
          campanaActiva={campanas?.find(c => c.estado === 'activa')}
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
                  {items.map(d => <SedeRow key={d.cod_sede} d={d} onAbrir={onAbrirSede} />)}
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
