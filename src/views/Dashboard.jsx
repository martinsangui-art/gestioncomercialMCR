import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useCountUp } from '../hooks/useCountUp'
import { useIsMobile } from '../hooks/useIsMobile'
import { C, F, panel, cifra, rotulo } from '../lib/theme'
import { hace } from '../components/FichaSede'
import { nombreCorto as corto, estadoSede } from '../lib/formato'
import { situacionCampana } from '../components/CampanaAcciones'
import Casillero, { useAnimarTablero } from '../components/Casillero'

function estadoColor(d) {
  return { ok: C.ok, prog: C.warn, cero: C.danger }[estadoSede(d)]
}

// Colores de estado sobre el fondo navy del tablero (más luminosos que los
// de la versión clara para que lean igual de fuerte)
function estadoColorOscuro(d) {
  return { ok: '#3DD598', prog: '#F5B83D', cero: '#FF6B7D' }[estadoSede(d)]
}

function HeroCifra({ pct }) {
  const animated = useCountUp(pct, 1000)
  return (
    <div style={{ ...cifra(104), color: '#fff', marginTop: 14 }} aria-label={`${pct}%`}>
      {animated}<span style={{ fontSize: 46, color: C.celeste, marginLeft: 2 }}>%</span>
    </div>
  )
}

// ── La regla ────────────────────────────────────────────────────────────────
// Cada sede es una marca ubicada según su % de cumplimiento, sobre una escala
// con las líneas del 50% y del 100%. Las marcas que caerían encima de otra se
// apilan hacia arriba, así se ve dónde se amontona la zona y quién quedó sola
// atrás. Por encima del 150% se agrupan en el borde. Al cargar, cada marca
// sale desde el 0% y viaja hasta su lugar: el avance de la campaña, literal.
const REGLA_MAX = 150

function Regla({ data, pctZona, onAbrir }) {
  const [hover, setHover] = useState(null)
  // La etiqueta de la sede señalada se ubica midiendo el espacio real: se
  // corre para no salirse por los costados (las pilas del 0% y del 150%+
  // están pegadas a los bordes) y pasa debajo del punto si arriba no entra.
  const contRef = useRef(null)
  const tipRef = useRef(null)
  const [tipPos, setTipPos] = useState(null)
  // En pantallas chicas el SVG se achica demasiado para leer nombres: las
  // rezagadas se listan debajo en vez de etiquetarse sobre la regla.
  const compacta = useIsMobile()
  const W = 720, PAD_X = 14, R = 6.5, LANE_H = 17
  const x = (pct) => PAD_X + (Math.min(pct, REGLA_MAX) / REGLA_MAX) * (W - PAD_X * 2)

  const puntos = useMemo(() => {
    const orden = [...data].sort((a, b) => a.pct - b.pct)
    const filas = [] // por fila, lista de x ocupadas
    return orden.map(d => {
      const px = x(d.pct)
      let fila = 0
      while ((filas[fila] || []).some(ox => Math.abs(ox - px) < R * 2 + 1.5)) fila++
      ;(filas[fila] = filas[fila] || []).push(px)
      return { d, px, fila }
    })
  }, [data]) // eslint-disable-line

  // Las rezagadas (bajo 50%) llevan su nombre: son las que importan. Cada
  // etiqueta ocupa el primer carril libre de arriba y baja con una línea guía.
  const etiquetas = useMemo(() => {
    if (compacta) return []
    const carriles = [] // borde derecho ocupado por carril
    return puntos.filter(p => p.d.pct < 50).sort((a, b) => a.px - b.px).map(p => {
      const texto = corto(p.d.sede)
      const ancho = texto.length * 6.3 + 10
      const izq = Math.min(Math.max(p.px - 5, 0), W - ancho)
      let carril = 0
      while (carriles[carril] !== undefined && carriles[carril] > izq - 6) carril++
      carriles[carril] = izq + ancho
      return { ...p, texto, izq, carril }
    })
  }, [puntos, compacta])

  const rezagadas = compacta ? puntos.filter(p => p.d.pct < 50) : []
  const nCarriles = etiquetas.length ? Math.max(...etiquetas.map(e => e.carril)) + 1 : 0
  const TOP = nCarriles * LANE_H + (nCarriles ? 10 : 4)
  const maxFila = Math.max(0, ...puntos.map(p => p.fila))
  const EJE_Y = TOP + (maxFila + 1) * (R * 2 + 2) + 10
  const H = EJE_Y + 42
  const cy = (fila) => EJE_Y - 8 - R - fila * (R * 2 + 2)
  const sobreMax = puntos.filter(p => p.d.pct > REGLA_MAX)
  const pilaTope = sobreMax.length ? cy(Math.max(...sobreMax.map(p => p.fila))) : 0

  useLayoutEffect(() => {
    if (!hover || !contRef.current || !tipRef.current) return
    const svg = contRef.current.querySelector('svg')
    const cw = contRef.current.clientWidth
    const sh = svg ? svg.getBoundingClientRect().height : 0
    const tw = tipRef.current.offsetWidth
    const th = tipRef.current.offsetHeight
    const cx = hover.px / W * cw
    const cy = hover.y / H * sh
    const left = Math.min(Math.max(cx - tw / 2, 0), Math.max(0, cw - tw))
    const arriba = cy - th - 14 >= -20
    setTipPos({ left, top: arriba ? cy - th - 14 : cy + 14 })
  }, [hover]) // eslint-disable-line

  return (
    <div ref={contRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="group"
        aria-label={`Las ${data.length} sedes ubicadas según su cumplimiento. Tocá una para abrir su ficha.`}>
        <rect x={x(0)} y={TOP - 4} width={x(50) - x(0)} height={EJE_Y - TOP + 4} fill="rgba(245,184,61,0.06)" />
        <rect x={x(100)} y={TOP - 4} width={x(REGLA_MAX) - x(100)} height={EJE_Y - TOP + 4} fill="rgba(127,178,240,0.10)" />
        <line x1={x(50)} x2={x(50)} y1={TOP - 4} y2={EJE_Y} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" />
        <line x1={x(100)} x2={x(100)} y1={TOP - 4} y2={EJE_Y} stroke={C.celeste} strokeWidth={1.5} />

        {etiquetas.map(e => {
          const ly = 4 + e.carril * LANE_H
          return (
            <g key={'l' + e.d.cod_sede} style={{ cursor: 'pointer' }} onClick={() => onAbrir(e.d)}>
              <line x1={e.px} x2={e.px} y1={ly + 13} y2={cy(e.fila) - R - 1} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <line x1={e.px} x2={e.izq + e.texto.length * 6.3 + 6} y1={ly + 13} y2={ly + 13} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <text x={e.izq + (e.px - 5 < e.izq ? 0 : 5)} y={ly + 9} style={{ fontFamily: F.body, fontSize: 10.5, fontWeight: 600, fill: e.d.total === 0 ? '#FF9AA6' : '#F8CF7A', letterSpacing: '0.02em' }}>{e.texto}</text>
            </g>
          )
        })}

        <line x1={x(0)} x2={x(REGLA_MAX)} y1={EJE_Y} y2={EJE_Y} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        {Array.from({ length: REGLA_MAX / 10 + 1 }, (_, i) => i * 10).map(v => (
          <line key={v} x1={x(v)} x2={x(v)} y1={EJE_Y} y2={EJE_Y + (v % 50 === 0 ? 7 : 4)} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        ))}
        {[0, 50, 100].map(v => (
          <text key={v} x={x(v)} y={EJE_Y + 20} textAnchor={v === 0 ? 'start' : 'middle'} style={{ fontFamily: F.mono, fontSize: 10.5, fill: v === 100 ? C.celeste : 'rgba(255,255,255,0.6)' }}>{v === 100 ? '100% objetivo' : v + '%'}</text>
        ))}
        <text x={x(REGLA_MAX)} y={EJE_Y + 20} textAnchor="end" style={{ fontFamily: F.mono, fontSize: 10.5, fill: 'rgba(255,255,255,0.6)' }}>150%+</text>

        {pctZona != null && (
          <g>
            <path d={`M ${x(pctZona)} ${EJE_Y + 26} l -5 8 h 10 z`} fill="#fff" />
            <text x={x(pctZona)} y={EJE_Y + 42} textAnchor={x(pctZona) > W - 60 ? 'end' : 'middle'} style={{ fontFamily: F.body, fontSize: 10.5, fontWeight: 700, fill: '#fff' }}>zona {pctZona}%</text>
          </g>
        )}

        {sobreMax.length > 0 && (
          <text x={x(REGLA_MAX)} y={pilaTope - R - 5} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, fill: '#3DD598' }}>+{sobreMax.length}</text>
        )}

        {puntos.map(({ d, px, fila }, i) => {
          const activo = hover?.d.cod_sede === d.cod_sede
          return (
            <circle key={d.cod_sede} cx={px} cy={cy(fila)} r={activo ? R + 2 : R}
              fill={estadoColorOscuro(d)} stroke={C.ink} strokeWidth={1.5}
              className="marca-llega" tabIndex={0} role="button"
              aria-label={`${corto(d.sede)}: ${d.pct}%, ${d.total} de ${d.objetivo}. Abrir ficha`}
              style={{ cursor: 'pointer', transition: 'r .12s', '--dx': `${x(0) - px}px`, animationDelay: `${120 + i * 14}ms` }}
              onMouseEnter={() => setHover({ d, px, y: cy(fila) })}
              onMouseLeave={() => { setHover(null); setTipPos(null) }}
              onFocus={() => setHover({ d, px, y: cy(fila) })}
              onBlur={() => { setHover(null); setTipPos(null) }}
              onClick={() => onAbrir(d)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(d) } }}
            />
          )
        })}
      </svg>
      {rezagadas.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
          <span style={{ color: '#F8CF7A', fontWeight: 700 }}>Bajo el 50%: </span>
          {rezagadas.map((p, i) => (
            <span key={p.d.cod_sede}>
              {i > 0 && ' · '}
              <button onClick={() => onAbrir(p.d)} style={{ background: 'none', border: 'none', padding: 0, color: '#fff', fontFamily: F.body, fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                {corto(p.d.sede)}
              </button> ({p.d.pct}%)
            </span>
          ))}
        </div>
      )}
      {hover && (
        <div ref={tipRef} role="tooltip" style={{
          position: 'absolute', left: tipPos?.left ?? 0, top: tipPos?.top ?? 0,
          visibility: tipPos ? 'visible' : 'hidden', pointerEvents: 'none',
          background: '#fff', color: C.ink, borderRadius: 8, padding: '7px 10px', whiteSpace: 'nowrap',
          boxShadow: '0 10px 28px -10px rgba(0,0,0,0.5)', fontFamily: F.body, fontSize: 12.5, zIndex: 5,
        }}>
          <strong>{corto(hover.d.sede)}</strong>
          <span style={{ fontFamily: F.mono, marginLeft: 8, color: C.inkSoft }}>{hover.d.pct}% · {hover.d.total}/{hover.d.objetivo}</span>
        </div>
      )}
    </div>
  )
}

// ── Tablero de casilleros ───────────────────────────────────────────────────
// Un casillero por sede, agrupadas por estado, como el tablero de salidas de
// una terminal: cada placa lleva la sigla de su sede (LUJ, MDP…), la luz de
// su estado, la franja de avance hacia el objetivo y "+N" si sumó en este
// corte. El tamaño de cada grupo se ve sin leer números.
function Casilleros({ data, siglas, onAbrir }) {
  const [hover, setHover] = useState(null)
  const animar = useAnimarTablero()
  const grupos = [
    { k: 'ok',   label: 'En objetivo',  sub: '50% o más' },
    { k: 'prog', label: 'En progreso',  sub: 'entre 1% y 49%' },
    { k: 'cero', label: 'Sin ingresos', sub: 'todavía en cero' },
  ].map(g => ({ ...g, items: data.filter(d => estadoSede(d) === g.k).sort((a, b) => b.pct - a.pct) }))
  const sumaron = data.filter(d => d.var > 0).length
  const h = hover && data.find(d => d.cod_sede === hover)
  let orden = 0

  return (
    <div className="animate-fadeUp" style={{ ...panel({ padding: '20px 22px 16px' }), animationDelay: '60ms' }}>
      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {grupos.map(g => (
          <div key={g.k} style={{ flexGrow: Math.max(g.items.length, 4), flexBasis: 0, minWidth: `min(${Math.min(Math.max(g.items.length, 3), 8) * 68 - 6}px, 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ ...cifra(36), color: C.ink }}>{g.items.length}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{g.label}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{g.sub}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.items.length === 0 && <div style={{ height: 50, fontSize: 12.5, color: C.inkSoft, display: 'flex', alignItems: 'center' }}>Ninguna</div>}
              {g.items.map(d => (
                <Casillero key={d.cod_sede}
                  sigla={siglas[String(d.cod_sede)]} estado={g.k} pct={d.pct} variacion={d.var}
                  animar={animar} retraso={140 + (orden++) * 28}
                  activo={hover === d.cod_sede}
                  onHover={on => setHover(on ? d.cod_sede : null)}
                  onClick={() => onAbrir(d)}
                  etiqueta={`${corto(d.sede)}: ${d.pct}%, ${d.total} de ${d.objetivo}${d.var > 0 ? `, sumó ${d.var} en este corte` : ''}. Abrir ficha`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda: lo que dice cada placa, o la sede señalada */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.ruleSoft}`, fontSize: 13, color: C.inkSoft, minHeight: 26 }}>
        {h ? (
          <span>
            <strong style={{ fontFamily: F.mono, color: C.ink, letterSpacing: '0.06em' }}>{siglas[String(h.cod_sede)]}</strong> = <strong style={{ color: C.ink }}>{corto(h.sede)}</strong>
            {' · '}<span style={{ fontFamily: F.mono }}>{h.pct}% · {h.total} de {h.objetivo}</span>
            {h.var > 0 ? ` · sumó ${h.var} en este corte` : h.var < 0 ? ` · bajó ${-h.var}` : h.var === 0 ? ' · sin cambios' : ''}
            {' · '}tocá para abrir la ficha
          </span>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3DD598', boxShadow: '0 0 0 2px #0E1733' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F5B83D', boxShadow: '0 0 0 2px #0E1733' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B7D', boxShadow: '0 0 0 2px #0E1733' }} />
              estado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 22, height: 4, borderRadius: 2, background: `linear-gradient(90deg, #3DD598 60%, rgba(14,23,51,0.18) 60%)` }} />
              avance hacia el objetivo
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 700, color: C.navy, background: C.celesteSoft, borderRadius: 4, padding: '1px 5px' }}>+2</span>
              sumó en este corte ({sumaron} de {data.length})
            </span>
            <span>Tocá una placa para ver su sede.</span>
          </>
        )}
      </div>
    </div>
  )
}

function Panel({ children, delay = 0, style = {}, id }) {
  return (
    <div id={id} className="animate-fadeUp" style={{ animationDelay: `${delay}ms`, ...panel(), ...style }}>
      {children}
    </div>
  )
}

function TituloPanel({ titulo, sub, derecha }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, fontStretch: '108%', color: C.ink, letterSpacing: '-0.01em' }}>{titulo}</h2>
        {sub && <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3 }}>{sub}</div>}
      </div>
      {derecha}
    </div>
  )
}

// Fila clicable de una lista de sedes (abre la ficha)
function FilaLista({ onClick, children, primera }) {
  return (
    <button onClick={onClick} className="fila-lista" style={{
      display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% + 16px)', textAlign: 'left', padding: '10px 8px', margin: '0 -8px',
      background: 'transparent', border: 'none', borderTop: primera ? 'none' : `1px solid ${C.ruleSoft}`,
      borderRadius: 6, cursor: 'pointer', fontFamily: F.body, boxSizing: 'border-box',
    }}>
      {children}
    </button>
  )
}

// ── Cumplimiento por sede ──────────────────────────────────────────────────
// Filas en HTML para que el texto se lea nítido. Escala hasta 150% con marcas
// en 50 y 100; lo que pasa de 150 se corta con un tope.
function FilaSede({ d, onAbrir }) {
  const color = estadoColor(d)
  const ancho = Math.min(d.pct, REGLA_MAX) / REGLA_MAX * 100
  return (
    <button onClick={() => onAbrir(d)} className="fila-lista" aria-label={`${corto(d.sede)}: ${d.pct}%. Abrir ficha`} style={{
      display: 'grid', gridTemplateColumns: 'minmax(110px, 1.1fr) 2fr 52px', alignItems: 'center', gap: 12, padding: '6px 6px', margin: '0 -6px',
      width: 'calc(100% + 12px)', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: F.body, textAlign: 'left',
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{corto(d.sede)}</span>
      <span style={{ position: 'relative', height: 10, background: C.ruleSoft, borderRadius: 5, display: 'block' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(ancho, d.total > 0 ? 1.5 : 0)}%`, background: color, borderRadius: 5, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
        {d.pct > REGLA_MAX && (
          <span style={{ position: 'absolute', right: -1, top: -2, bottom: -2, width: 4, background: C.paperRaised, borderLeft: `2px solid ${color}` }} />
        )}
        <span style={{ position: 'absolute', left: `${50 / REGLA_MAX * 100}%`, top: -3, bottom: -3, width: 1, background: C.inkSoft, opacity: 0.35 }} />
        <span style={{ position: 'absolute', left: `${100 / REGLA_MAX * 100}%`, top: -3, bottom: -3, width: 2, background: C.navy, opacity: 0.55 }} />
      </span>
      <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600, color: C.ink, textAlign: 'right' }}>{d.pct}%</span>
    </button>
  )
}

export default function Dashboard({ data, stats, historial, campanas, campanaActiva, paraLlamar = [], notasPorSede = {}, siglas = {}, onAbrirSede, vacio }) {
  const camp = campanas?.find(c => c.id === campanaActiva)
  const { activa, vencida } = situacionCampana(camp)
  const isMobile = useIsMobile()

  const evolucion = useMemo(() => {
    if (!historial.length) return []
    const byFecha = {}
    historial.forEach(r => {
      if (!byFecha[r.fecha]) byFecha[r.fecha] = { total: 0, obj: 0 }
      byFecha[r.fecha].total += Number(r.total) || 0
      byFecha[r.fecha].obj   += Number(r.objetivo) || 0
    })
    return Object.entries(byFecha).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, v]) => ({
      fecha: `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`,
      pct: v.obj > 0 ? Math.round(v.total / v.obj * 100) : 0,
    }))
  }, [historial])

  const topCrecimiento = useMemo(() => {
    return [...data]
      .filter(d => d.var !== null && d.var > 0)
      .sort((a, b) => b.var - a.var)
      .slice(0, 5)
  }, [data])

  // Proyección lineal: con el ritmo de ingreso desde el primer corte, ¿a qué
  // % se llegaría para la fecha de fin? Solo tiene sentido antes del fin.
  const proyeccion = useMemo(() => {
    if (!camp?.fin || !activa || vencida || !stats.totalObj) return null
    const fechas = [...new Set(historial.map(r => r.fecha))].sort()
    if (fechas.length < 2) return null
    const totalPorFecha = (fecha) => historial
      .filter(r => r.fecha === fecha)
      .reduce((acc, r) => acc + (Number(r.total) || 0), 0)
    const primera = fechas[0]
    const ultima = fechas[fechas.length - 1]
    const totalPrimera = totalPorFecha(primera)
    const totalUltima = totalPorFecha(ultima)
    const diasTranscurridos = (new Date(ultima) - new Date(primera)) / 86400000
    if (diasTranscurridos <= 0) return null
    const tasaDiaria = (totalUltima - totalPrimera) / diasTranscurridos
    const diasRestantes = Math.max(0, (new Date(camp.fin) - new Date(ultima)) / 86400000)
    const proyectado = Math.max(totalUltima, Math.round(totalUltima + tasaDiaria * diasRestantes))
    return { proyectado, pctProyectado: Math.round(proyectado / stats.totalObj * 100) }
  }, [camp, activa, vencida, historial, stats.totalObj])

  if (!data.length) return (
    <div style={{ ...panel({ padding: '44px 24px' }), textAlign: 'center', fontFamily: F.body }}>
      <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 800, fontStretch: '108%', color: C.ink }}>{vacio?.titulo || 'Todavía no hay cortes en esta campaña'}</div>
      <div style={{ fontSize: 14.5, color: C.inkSoft, marginTop: 8 }}>{vacio?.texto || 'Cuando se cargue el primer Excel, acá se ve cómo viene cada sede.'}</div>
      {vacio?.accion && (
        <button onClick={vacio.accion.onClick} className="btn-press" style={{ marginTop: 18, height: 40, padding: '0 18px', borderRadius: 8, border: `1px solid ${C.rule}`, background: '#fff', color: C.navy, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: F.body }}>
          {vacio.accion.label}
        </button>
      )}
    </div>
  )

  const bajo50 = data.filter(d => d.pct < 50).length
  const cumplido = data.filter(d => d.pct >= 100).length
  const ordenadas = [...data].sort((a, b) => b.pct - a.pct)
  const mitad = Math.ceil(ordenadas.length / 2)
  const maxEvol = Math.max(100, ...evolucion.map(e => e.pct))
  const techoEvol = Math.ceil((maxEvol + 5) / 25) * 25

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F.body }}>

      {/* Tablero: la cifra de la zona + la regla con todas las sedes */}
      <section aria-label="Cumplimiento de la zona" className="animate-fadeUp" style={{
        background: C.ink, borderRadius: 16, color: '#fff', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(240px, 290px) minmax(0, 1fr)',
      }}>
        <div style={{ padding: isMobile ? '24px 22px 8px' : '30px 28px', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ ...rotulo, color: 'rgba(255,255,255,0.6)' }}>Cumplimiento de la zona</div>
          <HeroCifra pct={stats.pctGlobal} />
          <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.88)', marginTop: 12 }}>
            <strong style={{ fontFamily: F.mono }}>{stats.totalIng}</strong> de <strong style={{ fontFamily: F.mono }}>{stats.totalObj}</strong> inscriptos
          </div>
          {proyeccion && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 6 }}>
              Al ritmo actual llega al <strong style={{ color: C.celeste, fontFamily: F.mono }}>{proyeccion.pctProyectado}%</strong> para el fin de la campaña
            </div>
          )}
        </div>
        <div style={{ padding: isMobile ? '12px 16px 22px' : '26px 30px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ ...rotulo, color: 'rgba(255,255,255,0.6)' }}>Dónde está cada sede</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
              <span style={{ color: '#F5B83D', fontWeight: 700 }}>{bajo50}</span> bajo el 50% · <span style={{ color: C.celeste, fontWeight: 700 }}>{cumplido}</span> ya cumplieron
            </div>
          </div>
          <Regla data={data} pctZona={stats.pctGlobal} onAbrir={onAbrirSede} />
        </div>
      </section>

      <Casilleros data={data} siglas={siglas} onAbrir={onAbrirSede} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        <Panel delay={100} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
          <TituloPanel titulo="Evolución" sub="Cumplimiento de la zona en cada corte"
            derecha={evolucion.length > 0 && <span style={{ fontFamily: F.mono, fontSize: 12, color: C.inkSoft, whiteSpace: 'nowrap' }}>{evolucion.length} cortes</span>} />
          {evolucion.length >= 2 ? (
            <div style={{ height: 270 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucion} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.navy} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={C.navy} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.ruleSoft} vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, techoEvol]} ticks={Array.from({ length: techoEvol / 25 + 1 }, (_, i) => i * 25)} tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
                  <ReferenceLine y={100} stroke={C.navy} strokeOpacity={0.5} strokeWidth={1.5}
                    label={{ value: 'objetivo', position: 'insideTopRight', fill: C.navy, fontSize: 11, fontFamily: F.body, fontWeight: 600 }} />
                  <ReferenceLine y={50} stroke={C.inkSoft} strokeOpacity={0.45} strokeDasharray="4 4"
                    label={{ value: '50%', position: 'insideTopRight', fill: C.inkSoft, fontSize: 11, fontFamily: F.mono }} />
                  <Tooltip contentStyle={{ fontSize: 12.5, border: `1px solid ${C.rule}`, borderRadius: 8, background: C.paperRaised, fontFamily: F.body }}
                    formatter={v => [v + '%', 'Cumplimiento de la zona']} labelFormatter={l => `Corte del ${l}`} />
                  <Area type="monotone" dataKey="pct" stroke={C.navy} strokeWidth={2.5}
                    fill="url(#gradNav)" dot={{ r: 3.5, fill: C.navy, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: C.crimson, strokeWidth: 2, stroke: '#fff' }}
                    isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, fontSize: 13.5 }}>
              Con dos cortes cargados aparece la evolución.
            </div>
          )}
        </Panel>
        <Panel delay={140} style={{ padding: '22px 22px 12px' }}>
            <TituloPanel titulo="Subieron en este corte" sub="Más inscriptos que en el corte anterior" />
            {topCrecimiento.length === 0 ? (
              <div style={{ fontSize: 13.5, color: C.inkSoft, padding: '2px 0 12px' }}>Ninguna sede sumó inscriptos en este corte.</div>
            ) : topCrecimiento.map((d, i) => (
              <FilaLista key={d.cod_sede} primera={i === 0} onClick={() => onAbrirSede(d)}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{corto(d.sede)}</span>
                <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.ok }}>+{d.var}</span>
              </FilaLista>
            ))}
        </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <Panel id="para-llamar" delay={120} style={{ padding: '22px 22px 12px', scrollMarginTop: 90 }}>
            <TituloPanel titulo="Para llamar" sub="Dos cortes seguidos sin sumar y todavía bajo el objetivo" />
            {paraLlamar.length === 0 ? (
              <div style={{ fontSize: 13.5, color: C.inkSoft, padding: '2px 0 12px' }}>Ninguna sede está estancada.</div>
            ) : paraLlamar.map((s, i) => {
              const nota = notasPorSede[String(s.cod_sede)]
              return (
                <FilaLista key={s.cod_sede} primera={i === 0} onClick={() => onAbrirSede(s)}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: estadoColor(s), flexShrink: 0, alignSelf: 'flex-start', marginTop: 5 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{corto(s.sede)}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 12.5, color: C.inkSoft }}>{s.pct}%</span>
                    </span>
                    <span title={nota ? `${hace(nota.fecha)}: ${nota.nota}` : undefined} style={{ display: 'block', fontSize: 12.5, color: nota ? C.inkSoft : C.navy, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {nota ? `${hace(nota.fecha)}: ${nota.nota}` : 'Sin seguimiento todavía · anotar llamado'}
                    </span>
                  </span>
                </FilaLista>
              )
            })}
          </Panel>

        </div>
      </div>

      <Panel delay={150} style={{ padding: '22px 24px 16px' }}>
        <TituloPanel titulo="Cumplimiento por sede" sub="De mayor a menor, con marcas en el 50% y en el 100% del objetivo. Tocá una sede para ver su ficha."
          derecha={
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[[C.ok, '50% o más'], [C.warn, 'En progreso'], [C.danger, 'Sin ingresos']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
                </span>
              ))}
            </div>
          } />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 40 }}>
          <div>{ordenadas.slice(0, mitad).map(d => <FilaSede key={d.cod_sede} d={d} onAbrir={onAbrirSede} />)}</div>
          <div>{ordenadas.slice(mitad).map(d => <FilaSede key={d.cod_sede} d={d} onAbrir={onAbrirSede} />)}</div>
        </div>
      </Panel>

    </div>
  )
}
