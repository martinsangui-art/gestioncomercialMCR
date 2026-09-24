import { useState, useMemo, useEffect } from 'react'
import { obtenerNotasSede, agregarNotaSede } from '../hooks/useSheets'
import { C, F, cifra } from '../lib/theme'
import ModalShell from './ModalShell'
import { estadoSede, nombreCorto } from '../lib/formato'

export { estadoSede, nombreCorto }
export const ESTADOS = {
  ok:   { label: 'En objetivo',  sub: '50% o más',       color: C.ok },
  prog: { label: 'En progreso',  sub: 'entre 1% y 49%',  color: C.warn },
  cero: { label: 'Sin ingresos', sub: 'todavía en cero', color: C.danger },
}

// "hace 3 días" a partir de una fecha 'yyyy-mm-dd' o 'yyyy-mm-dd HH:mm'
export function hace(fecha) {
  if (!fecha) return ''
  const d = new Date(String(fecha).slice(0, 10) + 'T12:00:00')
  if (isNaN(d)) return ''
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const dias = Math.round((hoy - d) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.round(dias / 30)
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}

const rotuloFicha = { fontSize: 11, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }

// Notas de seguimiento: lo que se habló con la sede. Las frases rápidas son
// las que más se repiten después de un llamado, para anotarlo en un toque.
const FRASES = ['Llamé, no atendieron', 'Llamé, van a cargar esta semana', 'Mandé mail', 'Pidieron material']

function Notas({ d, onNotaAgregada }) {
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

  const agregar = async (texto) => {
    const t = (texto ?? nueva).trim()
    if (!t) return
    setGuardando(true); setError(null)
    try {
      await agregarNotaSede(d.cod_sede, t)
      setNueva('')
      cargar()
      onNotaAgregada?.()
    } catch (e) { setError(e.message) }
    setGuardando(false)
  }

  return (
    <div>
      <div style={rotuloFicha}>Seguimiento</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={nueva} onChange={e => setNueva(e.target.value)} disabled={guardando}
          placeholder="Qué se habló con la sede…" aria-label="Nueva nota de seguimiento"
          onKeyDown={e => { if (e.key === 'Enter') agregar() }}
          style={{ flex: 1, height: 40, padding: '0 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 14, fontFamily: F.body, minWidth: 0 }} />
        <button onClick={() => agregar()} disabled={guardando || !nueva.trim()} className="btn-press" style={{
          height: 40, padding: '0 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
          background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', opacity: (guardando || !nueva.trim()) ? 0.5 : 1,
        }}>
          {guardando ? 'Guardando…' : 'Anotar'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {FRASES.map(f => (
          <button key={f} onClick={() => agregar(f)} disabled={guardando} style={{
            fontSize: 12.5, padding: '5px 10px', borderRadius: 20, border: `1px solid ${C.rule}`,
            background: '#fff', color: C.ink, cursor: 'pointer', fontFamily: F.body,
          }}>{f}</button>
        ))}
      </div>
      {error && <div role="alert" style={{ color: C.crimson, fontSize: 12.5, marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 14 }}>
        {cargando ? (
          <div style={{ padding: '10px 0', color: C.inkSoft, fontSize: 13 }}>Cargando notas…</div>
        ) : notas.length === 0 ? (
          <div style={{ padding: '10px 0', color: C.inkSoft, fontSize: 13 }}>Todavía no hay notas de esta sede.</div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 200, overflowY: 'auto' }}>
            {notas.map((n, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${C.ruleSoft}` : 'none' }}>
                <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft, paddingTop: 2 }} title={String(n.fecha)}>{hace(n.fecha)}</span>
                <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45 }}>{n.nota}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// Recorrido de la sede: una fila por corte (arriba el primero), con su marca
// sobre la misma escala de la regla del tablero y una línea que une un corte
// con el siguiente — se lee como el trayecto de la sede hacia el objetivo.
const RECORRIDO_MAX = 150
function Recorrido({ filas }) {
  const W = 300, FILA = 26
  const x = pct => 6 + Math.min(pct, RECORRIDO_MAX) / RECORRIDO_MAX * (W - 12)
  const H = filas.length * FILA
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 78px', columnGap: 12 }}>
        <div>
          {filas.map(r => (
            <div key={r.fecha} style={{ height: FILA, display: 'flex', alignItems: 'center', fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft }}>{r.fecha.slice(8, 10)}/{r.fecha.slice(5, 7)}</div>
          ))}
        </div>
        <div style={{ position: 'relative', height: H }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
            <rect x={x(0)} y={0} width={x(50) - x(0)} height={H} fill="rgba(201,138,11,0.06)" />
            <rect x={x(100)} y={0} width={x(RECORRIDO_MAX) - x(100)} height={H} fill={C.celesteSoft} />
            <line x1={x(50)} x2={x(50)} y1={0} y2={H} stroke={C.rule} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <line x1={x(100)} x2={x(100)} y1={0} y2={H} stroke={C.navy} strokeWidth={1.5} opacity={0.6} vectorEffect="non-scaling-stroke" />
            <polyline fill="none" stroke={C.ink} strokeWidth={1.5} opacity={0.35} vectorEffect="non-scaling-stroke"
              points={filas.map((r, i) => `${x(r.pct)},${i * FILA + FILA / 2}`).join(' ')} />
          </svg>
          {/* Marcas en HTML encima del SVG: quedan redondas aunque el SVG se estire */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {filas.map((r, i) => {
              const ultima = i === filas.length - 1
              const color = r.total === 0 ? C.danger : r.pct >= 50 ? C.ok : C.warn
              return (
                <span key={r.fecha} style={{
                  position: 'absolute', left: `${x(r.pct) / W * 100}%`, top: i * FILA + FILA / 2,
                  width: ultima ? 14 : 9, height: ultima ? 14 : 9, borderRadius: '50%', transform: 'translate(-50%, -50%)',
                  background: color, border: '2px solid #fff', boxShadow: ultima ? `0 0 0 2px ${color}` : 'none',
                  opacity: ultima ? 1 : 0.55 + 0.45 * (i / filas.length),
                }} />
              )
            })}
          </div>
        </div>
        <div>
          {filas.map(r => (
            <div key={r.fecha} style={{ height: FILA, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontFamily: F.mono, fontSize: 12 }}>
              <span style={{ color: C.inkSoft }}>{r.total}</span>
              <strong style={{ color: C.ink, minWidth: 40, textAlign: 'right' }}>{r.pct}%</strong>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 78px', columnGap: 12, marginTop: 6 }}>
        <span />
        <div style={{ position: 'relative', height: 14, fontFamily: F.mono, fontSize: 10.5, color: C.inkSoft }}>
          <span style={{ position: 'absolute', left: 0 }}>0%</span>
          <span style={{ position: 'absolute', left: `${50 / 1.5}%`, transform: 'translateX(-50%)' }}>50%</span>
          <span style={{ position: 'absolute', left: `${100 / 1.5}%`, transform: 'translateX(-50%)', color: C.navy, fontWeight: 600 }}>100%</span>
          <span style={{ position: 'absolute', right: 0 }}>150%</span>
        </div>
      </div>
    </div>
  )
}

// Ficha de la sede: su número del corte en grande, cómo viene contra el
// objetivo, el recorrido corte a corte y el seguimiento. Se abre desde
// cualquier lugar donde aparece una sede.
export default function FichaSede({ d, historial, onClose, onNotaAgregada }) {
  const e = ESTADOS[estadoSede(d)]
  const faltan = Math.max(0, d.objetivo - d.total)

  const recorrido = useMemo(() => {
    return (historial || [])
      .filter(r => String(r.cod_sede) === String(d.cod_sede))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .map(r => {
        const obj = Number(r.objetivo) || 0, tot = Number(r.total) || 0
        return { fecha: String(r.fecha).slice(0, 10), total: tot, pct: obj > 0 ? Math.round(tot / obj * 100) : 0 }
      })
  }, [historial, d.cod_sede])

  const chip = (txt, fg, bg) => <span style={{ fontSize: 12.5, fontWeight: 600, color: fg, background: bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{txt}</span>

  return (
    <ModalShell onClose={onClose} title={d.sede} sub={`Código ${d.cod_sede} · ${d.email || 'sin email cargado'}`} maxWidth={600}>
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 26, fontFamily: F.body }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ ...cifra(64), color: e.color }}>{d.pct}<span style={{ fontSize: 30 }}>%</span></div>
          <div style={{ paddingBottom: 4, minWidth: 0 }}>
            <div style={{ fontSize: 15, color: C.ink }}><strong style={{ fontFamily: F.mono }}>{d.total}</strong> inscriptos de un objetivo de <strong style={{ fontFamily: F.mono }}>{d.objetivo}</strong></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {chip(e.label, '#fff', e.color)}
              {d.var !== null && d.var !== undefined && chip(
                d.var > 0 ? `+${d.var} en este corte` : d.var === 0 ? 'Sin avance en este corte' : `${d.var} en este corte`,
                d.var > 0 ? C.ok : d.var < 0 ? C.danger : '#8A5D00',
                d.var > 0 ? '#E3F4EC' : d.var < 0 ? '#FBE7EA' : '#FBF0D9')}
              {chip(faltan > 0 ? `Le faltan ${faltan}` : 'Objetivo cumplido', faltan > 0 ? C.ink : C.navy, faltan > 0 ? C.ruleSoft : C.celesteSoft)}
            </div>
          </div>
        </div>

        <div>
          <div style={rotuloFicha}>Recorrido en la campaña</div>
          {recorrido.length === 0
            ? <div style={{ padding: 14, color: C.inkSoft, fontSize: 13.5, background: C.ruleSoft, borderRadius: 8 }}>Todavía no hay cortes de esta sede.</div>
            : <Recorrido filas={recorrido} />}
        </div>

        <Notas d={d} onNotaAgregada={onNotaAgregada} />
      </div>
    </ModalShell>
  )
}
