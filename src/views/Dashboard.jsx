import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useCountUp } from '../hooks/useCountUp'
import { useIsMobile } from '../hooks/useIsMobile'
import { C, F, panel, cifra, rotulo } from '../lib/theme'

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

function estadoColor(pct) {
  return pct >= 50 ? C.ok : pct > 0 ? C.warn : C.danger
}

function HeroCifra({ pct }) {
  const animated = useCountUp(pct, 1000)
  return (
    <div style={{ ...cifra(96), color: '#fff', marginTop: 14 }}>
      {animated}<span style={{ fontSize: 44, color: C.celeste, marginLeft: 2 }}>%</span>
    </div>
  )
}

const corto = (n) => String(n || '').replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')

// Colores de estado sobre el fondo navy del tablero (más luminosos que los
// de la versión clara para que lean igual de fuerte)
function estadoColorOscuro(d) {
  return d.total === 0 ? '#FF6B7D' : d.pct >= 50 ? '#3DD598' : '#F5B83D'
}

// ── La regla ────────────────────────────────────────────────────────────────
// Cada sede es una marca ubicada según su % de cumplimiento, sobre una escala
// con las líneas del 50% y del 100%. Las marcas que caerían encima de otra se
// apilan hacia arriba (como fichas), así se ve dónde se amontona la zona y
// quién quedó sola atrás. Por encima del 150% se agrupan en el borde.
const REGLA_MAX = 150

function Regla({ data, pctZona }) {
  const [hover, setHover] = useState(null)
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
    const carriles = [] // borde derecho ocupado por carril
    if (compacta) return []
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

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img"
        aria-label={`Distribución de las ${data.length} sedes según su cumplimiento`}>
        <rect x={x(0)} y={TOP - 4} width={x(50) - x(0)} height={EJE_Y - TOP + 4} fill="rgba(245,184,61,0.06)" />
        <rect x={x(100)} y={TOP - 4} width={x(REGLA_MAX) - x(100)} height={EJE_Y - TOP + 4} fill="rgba(127,178,240,0.10)" />
        <line x1={x(50)} x2={x(50)} y1={TOP - 4} y2={EJE_Y} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" />
        <line x1={x(100)} x2={x(100)} y1={TOP - 4} y2={EJE_Y} stroke={C.celeste} strokeWidth={1.5} />

        {/* Etiquetas de las rezagadas */}
        {etiquetas.map(e => {
          const ly = 4 + e.carril * LANE_H
          return (
            <g key={'l' + e.d.cod_sede}>
              <line x1={e.px} x2={e.px} y1={ly + 13} y2={cy(e.fila) - R - 1} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <line x1={e.px} x2={e.izq + e.texto.length * 6.3 + 6} y1={ly + 13} y2={ly + 13} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <text x={e.izq + (e.px - 5 < e.izq ? 0 : 5)} y={ly + 9} style={{ fontFamily: F.body, fontSize: 10.5, fontWeight: 600, fill: e.d.total === 0 ? '#FF9AA6' : '#F8CF7A', letterSpacing: '0.02em' }}>{e.texto}</text>
            </g>
          )
        })}

        {/* Eje */}
        <line x1={x(0)} x2={x(REGLA_MAX)} y1={EJE_Y} y2={EJE_Y} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        {Array.from({ length: REGLA_MAX / 10 + 1 }, (_, i) => i * 10).map(v => (
          <line key={v} x1={x(v)} x2={x(v)} y1={EJE_Y} y2={EJE_Y + (v % 50 === 0 ? 7 : 4)} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        ))}
        {[0, 50, 100].map(v => (
          <text key={v} x={x(v)} y={EJE_Y + 20} textAnchor={v === 0 ? 'start' : 'middle'} style={{ fontFamily: F.mono, fontSize: 10.5, fill: v === 100 ? C.celeste : 'rgba(255,255,255,0.6)' }}>{v === 100 ? '100% objetivo' : v + '%'}</text>
        ))}
        <text x={x(REGLA_MAX)} y={EJE_Y + 20} textAnchor="end" style={{ fontFamily: F.mono, fontSize: 10.5, fill: 'rgba(255,255,255,0.6)' }}>150%+</text>

        {/* Dónde está la zona */}
        {pctZona != null && (
          <g>
            <path d={`M ${x(pctZona)} ${EJE_Y + 26} l -5 8 h 10 z`} fill="#fff" />
            <text x={x(pctZona)} y={EJE_Y + 42} textAnchor={x(pctZona) > W - 60 ? 'end' : 'middle'} style={{ fontFamily: F.body, fontSize: 10.5, fontWeight: 700, fill: '#fff' }}>zona {pctZona}%</text>
          </g>
        )}

        {sobreMax.length > 0 && (
          <text x={x(REGLA_MAX)} y={pilaTope - R - 5} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 10.5, fontWeight: 600, fill: '#3DD598' }}>+{sobreMax.length}</text>
        )}

        {puntos.map(({ d, px, fila }) => {
          const activo = hover?.d.cod_sede === d.cod_sede
          return (
            <circle key={d.cod_sede} cx={px} cy={cy(fila)} r={activo ? R + 2 : R}
              fill={estadoColorOscuro(d)} stroke={C.ink} strokeWidth={1.5}
              style={{ cursor: 'pointer', transition: 'r .12s' }}
              onMouseEnter={() => setHover({ d, px, y: cy(fila) })}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${corto(d.sede)}: ${d.pct}% (${d.total}/${d.objetivo})`}</title>
            </circle>
          )
        })}
      </svg>
      {rezagadas.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
          <span style={{ color: '#F8CF7A', fontWeight: 700 }}>Bajo el 50%: </span>
          {rezagadas.map(p => `${corto(p.d.sede)} (${p.d.pct}%)`).join(' · ')}
        </div>
      )}
      {hover && (
        <div style={{
          position: 'absolute', left: `${(hover.px / W) * 100}%`, top: `${(hover.y / H) * 100}%`,
          transform: 'translate(-50%, calc(-100% - 12px))', pointerEvents: 'none',
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
// Un casillero por sede, agrupadas por estado, como el tablero de andenes de
// una terminal: el tamaño de cada grupo se ve sin leer números. Las que no
// sumaron nada desde el corte anterior llevan rayado.
function Casilleros({ data }) {
  const [hover, setHover] = useState(null)
  const grupos = [
    { k: 'ok',   label: 'En objetivo',  sub: '50% o más',        color: C.ok,     items: data.filter(d => d.total > 0 && d.pct >= 50) },
    { k: 'prog', label: 'En progreso',  sub: 'entre 1% y 49%',   color: C.warn,   items: data.filter(d => d.total > 0 && d.pct < 50) },
    { k: 'cero', label: 'Sin ingresos', sub: 'todavía en cero',  color: C.danger, items: data.filter(d => d.total === 0) },
  ].map(g => ({ ...g, items: [...g.items].sort((a, b) => b.pct - a.pct) }))
  const sinAvance = data.filter(d => d.var === 0).length

  return (
    <div className="animate-fadeUp" style={{ ...panel({ padding: '20px 22px 18px' }), animationDelay: '60ms' }}>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {grupos.map(g => (
          <div key={g.k} style={{ flexGrow: Math.max(g.items.length, 4), flexBasis: 0, minWidth: 150 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ ...cifra(34), color: C.ink }}>{g.items.length}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{g.label}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{g.sub}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {g.items.length === 0 && <div style={{ height: 22, fontSize: 12.5, color: C.inkSoft, display: 'flex', alignItems: 'center' }}>Ninguna</div>}
              {g.items.map(d => {
                const estancada = d.var === 0
                return (
                  <span key={d.cod_sede}
                    onMouseEnter={() => setHover(d.cod_sede)} onMouseLeave={() => setHover(null)}
                    onClick={() => setHover(h => h === d.cod_sede ? null : d.cod_sede)}
                    title={`${corto(d.sede)} · ${d.pct}%${estancada ? ' · sin avance' : ''}`}
                    style={{
                      width: 22, height: 22, borderRadius: 5, cursor: 'default',
                      background: estancada
                        ? `repeating-linear-gradient(135deg, ${g.color} 0 3px, ${g.color}55 3px 6px)`
                        : g.color,
                      outline: hover === d.cod_sede ? `2px solid ${C.ink}` : 'none', outlineOffset: 1,
                      transition: 'transform .12s', transform: hover === d.cod_sede ? 'scale(1.15)' : 'none',
                    }} />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.ruleSoft}`, fontSize: 12.5, color: C.inkSoft }}>
        <span style={{ width: 14, height: 14, borderRadius: 3, background: `repeating-linear-gradient(135deg, ${C.inkSoft} 0 3px, ${C.inkSoft}55 3px 6px)` }} />
        {(() => {
          const h = hover && data.find(d => d.cod_sede === hover)
          return h
            ? <span><strong style={{ color: C.ink }}>{corto(h.sede)}</strong> · <span style={{ fontFamily: F.mono }}>{h.pct}% · {h.total} de {h.objetivo}</span>{h.var === 0 ? ' · sin avance' : ''}</span>
            : <span><strong style={{ color: C.ink, fontFamily: F.mono }}>{sinAvance}</strong> sin avance (mismo número que en el corte anterior). Pasá el mouse por un casillero, o tocalo, para ver la sede.</span>
        })()}
      </div>
    </div>
  )
}

function Panel({ children, delay = 0, style = {} }) {
  return (
    <div className="animate-fadeUp" style={{ animationDelay: `${delay}ms`, ...panel(), ...style }}>
      {children}
    </div>
  )
}

function TituloPanel({ titulo, sub, derecha }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <div>
        <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 750, fontStretch: '105%', color: C.ink }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 3 }}>{sub}</div>}
      </div>
      {derecha}
    </div>
  )
}

// ── Cumplimiento por sede ──────────────────────────────────────────────────
// Filas en HTML (no SVG) para que el texto se lea nítido. Escala hasta 150%
// con marcas en 50 y 100; lo que pasa de 150 se corta con una flecha.
function FilaSede({ d }) {
  const color = estadoColor(d.pct === 0 && d.total === 0 ? 0 : d.pct)
  const ancho = Math.min(d.pct, REGLA_MAX) / REGLA_MAX * 100
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.1fr) 2fr 52px', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.sede}>{corto(d.sede)}</span>
      <div style={{ position: 'relative', height: 10, background: C.ruleSoft, borderRadius: 5 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(ancho, d.total > 0 ? 1.5 : 0)}%`, background: color, borderRadius: 5, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
        {d.pct > REGLA_MAX && (
          <span style={{ position: 'absolute', right: -1, top: -2, bottom: -2, width: 4, background: C.paperRaised, borderLeft: `2px solid ${color}` }} />
        )}
        <span style={{ position: 'absolute', left: `${50 / REGLA_MAX * 100}%`, top: -3, bottom: -3, width: 1, background: C.inkSoft, opacity: 0.35 }} />
        <span style={{ position: 'absolute', left: `${100 / REGLA_MAX * 100}%`, top: -3, bottom: -3, width: 2, background: C.navy, opacity: 0.55 }} />
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600, color: C.ink, textAlign: 'right' }} title={`${d.total} de ${d.objetivo}`}>{d.pct}%</span>
    </div>
  )
}

export default function Dashboard({ data, stats, historial, campanas, campanaActiva }) {
  const camp = campanas?.find(c => c.id === campanaActiva)
  const cerrada = camp?.estado === 'cerrada'
  const isMobile = useIsMobile()

  const evolucion = useMemo(() => {
    if (!historial.length) return []
    const byFecha = {}
    historial.forEach(r => {
      if (!byFecha[r.fecha]) byFecha[r.fecha] = { total: 0, obj: 0 }
      byFecha[r.fecha].total += Number(r.total) || 0
      byFecha[r.fecha].obj   += Number(r.objetivo) || 0
    })
    return Object.entries(byFecha).sort(([a],[b]) => a.localeCompare(b)).map(([fecha, v]) => ({
      fecha: fecha.slice(5),
      pct: v.obj > 0 ? Math.round(v.total / v.obj * 100) : 0,
    }))
  }, [historial])

  const topCrecimiento = useMemo(() => {
    return [...data]
      .filter(d => d.var !== null && d.var > 0)
      .sort((a, b) => b.var - a.var)
      .slice(0, 5)
  }, [data])

  // Sedes con 2 o más cortes consecutivos sin avance (o retrocediendo) —
  // necesitan un llamado o seguimiento puntual, no solo un número en rojo.
  const sedesEnRiesgo = useMemo(() => {
    if (historial.length < 3) return []
    const porSede = {}
    historial.forEach(r => {
      const cod = String(r.cod_sede)
      if (!porSede[cod]) porSede[cod] = { sede: r.sede, vals: [] }
      porSede[cod].vals.push({ fecha: r.fecha, total: Number(r.total) || 0 })
    })
    const riesgo = []
    Object.entries(porSede).forEach(([cod, info]) => {
      const ordenado = [...info.vals].sort((a, b) => a.fecha.localeCompare(b.fecha))
      if (ordenado.length < 3) return
      const [a, b, c] = ordenado.slice(-3)
      const sinAvance2Cortes = (c.total - b.total) <= 0 && (b.total - a.total) <= 0
      // Una sede que ya pasó su objetivo no necesita un llamado aunque no suba
      const pctActual = data.find(d => String(d.cod_sede) === cod)?.pct ?? 0
      if (sinAvance2Cortes && pctActual < 100) {
        const curr = data.find(d => String(d.cod_sede) === cod)
        riesgo.push({ cod_sede: cod, sede: curr?.sede || info.sede, total: c.total, pct: curr?.pct ?? null })
      }
    })
    return riesgo.sort((x, y) => (x.pct ?? 0) - (y.pct ?? 0))
  }, [historial, data])

  const diasRestantes = useMemo(() => {
    if (!camp?.fin || cerrada) return null
    const fin = new Date(camp.fin)
    const hoy = new Date()
    const dias = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    return dias > 0 ? dias : null
  }, [camp, cerrada])

  // Proyección lineal: con el ritmo de ingreso de las últimas semanas, ¿a qué
  // total/% se llegaría para la fecha de cierre de la campaña?
  const proyeccion = useMemo(() => {
    if (!camp?.fin || cerrada || !stats.totalObj) return null
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
    const diasRestantesCalc = Math.max(0, (new Date(camp.fin) - new Date()) / 86400000)
    const proyectado = Math.max(totalUltima, Math.round(totalUltima + tasaDiaria * diasRestantesCalc))
    const pctProyectado = Math.round(proyectado / stats.totalObj * 100)
    return { proyectado, pctProyectado }
  }, [camp, cerrada, historial, stats.totalObj])

  const sedesBajoObjetivo = data.filter(d => d.pct < 50).length

  if (!data.length) return (
    <div style={{ ...panel({ padding: '56px 24px' }), textAlign: 'center', fontFamily: F.body }}>
      <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 750, color: C.ink }}>Todavía no hay cortes cargados</div>
      <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 8 }}>Subí el primer Excel semanal para ver cómo arranca la campaña.</div>
    </div>
  )

  const bajo50 = data.filter(d => d.pct < 50).length
  const cumplido = data.filter(d => d.pct >= 100).length
  const ordenadas = [...data].sort((a, b) => b.pct - a.pct)
  const mitad = Math.ceil(ordenadas.length / 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F.body }}>

      {/* Tablero: la cifra de la zona + la regla con todas las sedes */}
      <section className="animate-fadeUp" style={{
        background: C.ink, borderRadius: 16, color: '#fff', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(230px, 280px) 1fr',
      }}>
        <div style={{ padding: isMobile ? '24px 22px 8px' : '30px 28px', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ ...rotulo, color: 'rgba(255,255,255,0.6)' }}>Cumplimiento de la zona</div>
          <HeroCifra pct={stats.pctGlobal} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 12 }}>
            <strong style={{ fontFamily: F.mono }}>{stats.totalIng}</strong> de <strong style={{ fontFamily: F.mono }}>{stats.totalObj}</strong> inscriptos
          </div>
          {proyeccion && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              Al ritmo actual cierra en <strong style={{ color: C.celeste, fontFamily: F.mono }}>{proyeccion.pctProyectado}%</strong>
            </div>
          )}
        </div>
        <div style={{ padding: isMobile ? '12px 16px 22px' : '26px 30px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ ...rotulo, color: 'rgba(255,255,255,0.6)' }}>Dónde está cada sede</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: '#F5B83D', fontWeight: 700 }}>{bajo50}</span> bajo el 50% · <span style={{ color: C.celeste, fontWeight: 700 }}>{cumplido}</span> ya cumplieron
            </div>
          </div>
          <Regla data={data} pctZona={stats.pctGlobal} />
        </div>
      </section>

      <Casilleros data={data} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 18, alignItems: 'stretch' }}>
        <Panel delay={100} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
          <TituloPanel titulo="Evolución" sub="Cumplimiento de la zona en cada corte"
            derecha={evolucion.length > 0 && <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft }}>{evolucion.length} cortes</span>} />
          {evolucion.length >= 2 ? (
            <div style={{ flex: 1, minHeight: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucion} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.navy} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.navy} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.ruleSoft} vertical={false} />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
                <Tooltip contentStyle={{ fontSize: 12.5, border: `1px solid ${C.rule}`, borderRadius: 8, background: C.paperRaised, fontFamily: F.body }}
                  formatter={v => [v + '%', 'Cumplimiento']} />
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel delay={120} style={{ padding: '22px 22px 14px' }}>
            <TituloPanel titulo="Para llamar" sub="Dos cortes seguidos sin avance y todavía bajo el objetivo" />
            {sedesEnRiesgo.length === 0 ? (
              <div style={{ fontSize: 13.5, color: C.inkSoft, padding: '4px 0 10px' }}>Ninguna sede está estancada.</div>
            ) : (
              <div>
                {sedesEnRiesgo.map((s, i) => (
                  <div key={s.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${C.ruleSoft}` : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.total === 0 ? C.danger : C.warn, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{corto(s.sede)}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12, color: C.inkSoft }}>{s.pct !== null ? `${s.pct}%` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel delay={140} style={{ padding: '22px 22px 14px' }}>
            <TituloPanel titulo="Subieron esta semana" sub="Más inscriptos que en el corte anterior" />
            {topCrecimiento.length === 0 ? (
              <div style={{ fontSize: 13.5, color: C.inkSoft, padding: '4px 0 10px' }}>Ninguna sede sumó inscriptos en este corte.</div>
            ) : topCrecimiento.map((d, i) => (
              <div key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${C.ruleSoft}` : 'none' }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{corto(d.sede)}</span>
                <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600, color: C.ok }}>+{d.var}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <Panel delay={150} style={{ padding: '22px 24px 18px' }}>
        <TituloPanel titulo="Cumplimiento por sede" sub="De mayor a menor. Marcas en 50% y en 100% del objetivo."
          derecha={
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[[C.ok, '50% o más'], [C.warn, 'En progreso'], [C.danger, 'Sin ingresos']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft }}>
                  <span style={{ width: 10, height: 10, borderRadius: 8, background: c }} />{l}
                </span>
              ))}
            </div>
          } />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', columnGap: 40 }}>
          <div>{ordenadas.slice(0, mitad).map(d => <FilaSede key={d.cod_sede} d={d} />)}</div>
          <div>{ordenadas.slice(mitad).map(d => <FilaSede key={d.cod_sede} d={d} />)}</div>
        </div>
      </Panel>

    </div>
  )
}
