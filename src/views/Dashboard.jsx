import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useCountUp } from '../hooks/useCountUp'
import { useIsMobile } from '../hooks/useIsMobile'
import { C, F, panel } from '../lib/theme'

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

function estadoColor(pct) {
  return pct >= 50 ? C.ok : pct > 0 ? C.warn : C.danger
}

// El número protagonista del sistema: una cifra serif grande sobre una línea
// de suma, como el total de un libro de cuentas — reemplaza el arco circular
// genérico de "gauge" que tienen la mayoría de los dashboards.
function LedgerHero({ pct }) {
  const color = estadoColor(pct)
  const animated = useCountUp(pct, 1000)
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <div style={{
        fontFamily: F.display, fontSize: 64, fontWeight: 600, color,
        lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
      }}>
        {animated}<span style={{ fontSize: 32, opacity: 0.6 }}>%</span>
      </div>
      <div style={{ margin: '10px auto 0', maxWidth: 150, height: 4, background: C.ruleSoft, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, pct)}%`,
          background: color, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <div style={{
        fontSize: 10, color: C.inkSoft, textAlign: 'center', marginTop: 9,
        fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        Cumplimiento global
      </div>
    </div>
  )
}

function BarChartSVG({ data }) {
  if (!data.length) return null
  const sorted = [...data].sort((a, b) => b.pct - a.pct)
  const BAR_H = 22, GAP = 5, LBL_W = 160, BAR_MAX = 380, PCT_W = 110
  const SVG_W = LBL_W + BAR_MAX + PCT_W + 16
  const SVG_H = (BAR_H + GAP) * sorted.length + 8

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block', minWidth: 480 }}>
        {sorted.map((d, i) => {
          const y = 4 + i * (BAR_H + GAP)
          const fill = estadoColor(d.pct)
          const bW = Math.max(2, Math.round((Math.min(d.pct, 100) / 100) * BAR_MAX))
          let lbl = d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
          if (lbl.length > 20) lbl = lbl.slice(0, 19) + '…'
          return (
            <g key={d.cod_sede}>
              <rect x={LBL_W} y={y} width={BAR_MAX} height={BAR_H} fill={C.ruleSoft} />
              <rect x={LBL_W} y={y} width={bW} height={BAR_H} fill={fill}
                style={{ transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              <text x={LBL_W - 8} y={y + BAR_H / 2 + 4} textAnchor="end"
                style={{ fontSize: 10.5, fontFamily: F.body, fill: C.ink }}>{lbl}</text>
              <text x={LBL_W + bW + 8} y={y + BAR_H / 2 + 4}
                style={{ fontSize: 11, fontFamily: F.mono, fontWeight: 600, fill }}>{d.pct}% ({d.total}/{d.objetivo})</text>
            </g>
          )
        })}
        {(() => {
          const x50 = LBL_W + Math.round(0.5 * BAR_MAX)
          return <>
            <line x1={x50} y1={0} x2={x50} y2={SVG_H} stroke={C.crimson} strokeWidth={1} strokeDasharray="3,3" opacity={0.55} />
            <text x={x50} y={SVG_H + 12} textAnchor="middle" style={{ fontSize: 9, fill: C.crimson, fontFamily: F.mono }}>50%</text>
          </>
        })()}
      </svg>
    </div>
  )
}

function StatCard({ label, value, color, sub, delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, 800)
  const display = typeof value === 'number' ? animated : value
  return (
    <div className="animate-fadeUp" style={{ animationDelay: `${delay}ms`, ...panel({ padding: '15px 18px' }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, background: color, flexShrink: 0 }} />
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: F.mono,
        }}>{label}</div>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 600, color, lineHeight: 1 }}>{display}</div>
      {sub && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 5, fontFamily: F.body }}>{sub}</div>}
    </div>
  )
}

function Panel({ children, delay = 0, topRule, style = {} }) {
  return (
    <div className="animate-fadeUp" style={{
      animationDelay: `${delay}ms`,
      background: C.paperRaised,
      border: `1px solid ${C.rule}`,
      borderTop: topRule ? `2px solid ${topRule}` : `1px solid ${C.rule}`,
      borderRadius: 10,
      ...style,
    }}>
      {children}
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
      if (sinAvance2Cortes) {
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
    <div style={{ textAlign: 'center', padding: '64px', color: C.inkSoft, fontSize: 14, fontFamily: F.body }}>
      Sin datos para esta campaña
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: F.body }}>

      {cerrada && (
        <div style={{
          background: C.paperRaised, border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.inkSoft}`,
          padding: '10px 16px', fontSize: 13, color: C.inkSoft,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          🔒 <span><strong style={{ color: C.ink }}>{camp?.nombre}</strong> está cerrada — resultado final: <strong style={{ color: estadoColor(stats.pctGlobal) }}>{stats.pctGlobal}%</strong></span>
        </div>
      )}

      {diasRestantes !== null && diasRestantes <= 30 && (
        <div style={{
          background: C.paperRaised, border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.warn}`,
          padding: '10px 16px', fontSize: 13, color: '#6b4d1a',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          ⚠️ <span>Quedan <strong>{diasRestantes} días</strong> para el cierre de la campaña · <strong>{sedesBajoObjetivo} sedes</strong> todavía bajo el 50%</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 16, alignItems: 'stretch' }}>
        <Panel topRule={C.ink} style={{ padding: '26px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <LedgerHero pct={stats.pctGlobal} />
          <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: 'center', fontFamily: F.mono }}>
            {stats.totalIng} de {stats.totalObj} inscriptos
          </div>
          {data[0]?.fecha && (
            <div style={{
              fontSize: 10, color: C.ink, textAlign: 'center',
              fontFamily: F.mono, letterSpacing: '0.04em',
              border: `1px solid ${C.rule}`, padding: '3px 9px',
            }}>
              CORTE · {fmtFecha(data[0].fecha)}
            </div>
          )}
          {proyeccion && (
            <div style={{
              fontSize: 10.5, textAlign: 'center', lineHeight: 1.5, fontFamily: F.body,
              color: proyeccion.pctProyectado >= 50 ? C.ok : C.warn,
              border: `1px solid ${C.rule}`, padding: '6px 10px',
            }}>
              Proyección al cierre: <strong style={{ fontFamily: F.mono }}>{proyeccion.pctProyectado}%</strong> ({proyeccion.proyectado})
            </div>
          )}
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          <StatCard label="En objetivo ≥50%" value={stats.enObj} sub={`${stats.enObj} sedes`} color={C.ok} delay={60} />
          <StatCard label="En progreso" value={stats.enProg} sub="1–49%" color={C.warn} delay={100} />
          <StatCard label="Sin ingresos" value={stats.sinIng} sub="en cero" color={C.danger} delay={140} />
          <StatCard label="Sin avance" value={stats.sinAv || 0} sub="vs sem. anterior" color={C.inkSoft} delay={180} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 260px', gap: 16 }}>

        <Panel delay={100} topRule={C.ink} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink }}>Evolución semanal</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Cumplimiento global acumulado por corte</div>
            </div>
            {evolucion.length > 0 && (
              <div style={{ fontSize: 10, color: C.inkSoft, fontFamily: F.mono }}>
                {evolucion.length} CORTE{evolucion.length !== 1 ? 'S' : ''}
              </div>
            )}
          </div>
          {evolucion.length >= 2 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={evolucion} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.ink} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={C.ink} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.ruleSoft} vertical={false} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${C.rule}`, borderRadius: 2, background: C.paperRaised, fontFamily: F.body }}
                  formatter={v => [v + '%', 'Cumplimiento']} />
                <Area type="monotone" dataKey="pct" stroke={C.ink} strokeWidth={2.5}
                  fill="url(#gradNav)" dot={{ r: 3, fill: C.ink, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: C.crimson, strokeWidth: 0 }}
                  isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.rule, fontSize: 13 }}>
              Necesitás al menos 2 cortes para ver la evolución
            </div>
          )}
        </Panel>

        <Panel delay={120} topRule={C.crimson} style={{ padding: '20px' }}>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 2 }}>Mayor crecimiento</div>
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 14 }}>vs semana anterior</div>
          {topCrecimiento.length === 0 ? (
            <div style={{ fontSize: 12, color: C.rule, textAlign: 'center', padding: '20px 0' }}>Sin variación disponible</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {topCrecimiento.map((d, i) => {
                let nombre = d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
                if (nombre.length > 18) nombre = nombre.slice(0, 17) + '…'
                return (
                  <div key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 19, height: 19,
                      background: i === 0 ? C.ink : 'transparent',
                      border: i === 0 ? 'none' : `1px solid ${C.rule}`,
                      color: i === 0 ? '#fff' : C.inkSoft, fontSize: 10, fontWeight: 600, fontFamily: F.mono,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, color: C.ink }}>{nombre}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ok, fontFamily: F.mono }}>+{d.var}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {sedesEnRiesgo.length > 0 && (
        <Panel delay={130} topRule={C.crimson} style={{ padding: '20px 24px' }}>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 4 }}>⚠ Sedes en riesgo</div>
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 14 }}>2 o más cortes seguidos sin avance — conviene un llamado puntual</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sedesEnRiesgo.map(s => {
              let nombre = s.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
              return (
                <div key={s.cod_sede} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  background: 'rgba(156,43,52,0.05)', border: `1px solid rgba(156,43,52,0.25)`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.crimson }}>{nombre}</span>
                  <span style={{ fontSize: 11, color: C.crimson, fontFamily: F.mono, opacity: 0.85 }}>{s.pct !== null ? `${s.pct}%` : '—'} · total {s.total}</span>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <Panel delay={150} topRule={C.ink} style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.ink }}>Cumplimiento por sede</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Ordenado de mayor a menor · línea roja = 50%</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[[C.ok,'≥ 50%'],[C.warn,'En progreso'],[C.danger,'Sin ingresos']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.inkSoft }}>
                <span style={{ width: 8, height: 8, background: c, display: 'inline-block' }} />
                {l}
              </div>
            ))}
          </div>
        </div>
        <BarChartSVG data={data} />
      </Panel>

    </div>
  )
}
