import { useMemo, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useCountUp } from '../hooks/useCountUp'

function ArcGauge({ pct }) {
  const ref = useRef(null)
  const color = pct >= 50 ? '#059669' : pct > 0 ? '#d97706' : '#e11d48'
  const animatedPct = useCountUp(pct, 1100)
  const r = 72, cx = 100, cy = 100
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const filled = (Math.min(pct, 110) / 100) * arc

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'none'
    el.style.strokeDasharray = `0 ${circ}`
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)'
      el.style.strokeDasharray = `${filled} ${circ}`
    })
  }, [pct])

  return (
    <svg viewBox="0 0 200 160" width="200" height="160" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="11"
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <circle ref={ref} cx={cx} cy={cy} r={r} fill="none" stroke="url(#arcGrad)" strokeWidth="11"
        strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill={color}
        style={{ fontSize: 38, fontWeight: 800, fontFamily: 'Inter', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
        {animatedPct}%
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#94a3b8"
        style={{ fontSize: 10.5, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        cumplimiento global
      </text>
    </svg>
  )
}

function BarChartSVG({ data }) {
  if (!data.length) return null
  const sorted = [...data].sort((a, b) => b.pct - a.pct)
  const BAR_H = 24, GAP = 4, LBL_W = 160, BAR_MAX = 380, PCT_W = 110
  const SVG_W = LBL_W + BAR_MAX + PCT_W + 16
  const SVG_H = (BAR_H + GAP) * sorted.length + 8

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block', minWidth: 480 }}>
        {sorted.map((d, i) => {
          const y = 4 + i * (BAR_H + GAP)
          const fill = d.pct >= 50 ? '#52b788' : d.total > 0 ? '#f59e0b' : '#f43f5e'
          const bW = Math.max(2, Math.round((Math.min(d.pct, 100) / 100) * BAR_MAX))
          let lbl = d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
          if (lbl.length > 20) lbl = lbl.slice(0, 19) + '…'
          return (
            <g key={d.cod_sede}>
              <rect x={LBL_W} y={y} width={BAR_MAX} height={BAR_H} rx={3} fill="#f1f5f9" />
              <rect x={LBL_W} y={y} width={bW} height={BAR_H} rx={3} fill={fill}
                style={{ transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              <text x={LBL_W - 6} y={y + BAR_H / 2 + 4} textAnchor="end"
                style={{ fontSize: 10, fontFamily: 'Inter', fill: '#4b5563' }}>{lbl}</text>
              <text x={LBL_W + bW + 6} y={y + BAR_H / 2 + 4}
                style={{ fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill }}>{d.pct}% ({d.total}/{d.objetivo})</text>
            </g>
          )
        })}
        {(() => {
          const x50 = LBL_W + Math.round(0.5 * BAR_MAX)
          return <>
            <line x1={x50} y1={0} x2={x50} y2={SVG_H} stroke="#C8102E" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
            <text x={x50} y={SVG_H + 12} textAnchor="middle" style={{ fontSize: 9, fill: '#C8102E' }}>50%</text>
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
    <div className="animate-fadeUp" style={{
      animationDelay: `${delay}ms`,
      background: 'rgba(255,255,255,0.68)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.9)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.06)',
      borderRadius: 14,
      padding: '16px 20px',
      borderTop: `3px solid ${color}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%',
        background: color, opacity: 0.06, pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'monospace',
      }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{display}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function GlassPanel({ children, delay = 0, style = {} }) {
  return (
    <div className="animate-fadeUp" style={{
      animationDelay: `${delay}ms`,
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.9)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.08)',
      borderRadius: 16,
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function Dashboard({ data, stats, historial, campanas, campanaActiva }) {
  const camp = campanas?.find(c => c.id === campanaActiva)
  const cerrada = camp?.estado === 'cerrada'

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

  const diasRestantes = useMemo(() => {
    if (!camp?.fin || cerrada) return null
    const fin = new Date(camp.fin)
    const hoy = new Date()
    const dias = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    return dias > 0 ? dias : null
  }, [camp, cerrada])

  const sedesBajoObjetivo = data.filter(d => d.pct < 50).length

  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: '64px', color: '#94a3b8', fontSize: 14 }}>
      Sin datos para esta campaña
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {cerrada && (
        <div style={{
          background: 'rgba(248,250,252,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0', borderLeft: '4px solid #6b7280',
          borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#64748b',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          🔒 <span><strong>{camp?.nombre}</strong> está cerrada — resultado final: <strong style={{ color: stats.pctGlobal >= 50 ? '#059669' : '#d97706' }}>{stats.pctGlobal}%</strong></span>
        </div>
      )}

      {diasRestantes !== null && diasRestantes <= 30 && (
        <div style={{
          background: 'rgba(255,251,235,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b',
          borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#78350f',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          ⚠️ <span>Quedan <strong>{diasRestantes} días</strong> para el cierre de la campaña · <strong>{sedesBajoObjetivo} sedes</strong> todavía bajo el 50%</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        <GlassPanel style={{ padding: '20px 12px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <ArcGauge pct={stats.pctGlobal} />
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalIng} de {stats.totalObj} inscriptos
          </div>
          {data[0]?.fecha && (
            <div style={{
              fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4,
              fontFamily: 'monospace', letterSpacing: '0.02em',
              background: '#f1f5f9', padding: '2px 8px', borderRadius: 20,
            }}>
              CORTE · {data[0].fecha}
            </div>
          )}
        </GlassPanel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          <StatCard label="En objetivo ≥50%" value={stats.enObj} sub={`${stats.enObj} sedes`} color="#059669" delay={60} />
          <StatCard label="En progreso" value={stats.enProg} sub="1–49%" color="#d97706" delay={100} />
          <StatCard label="Sin ingresos" value={stats.sinIng} sub="en cero" color="#e11d48" delay={140} />
          <StatCard label="Sin avance" value={stats.sinAv || 0} sub="vs sem. anterior" color="#7c3aed" delay={180} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

        <GlassPanel delay={100} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Evolución semanal</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Cumplimiento global acumulado por corte</div>
            </div>
            {evolucion.length > 0 && (
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                {evolucion.length} CORTE{evolucion.length !== 1 ? 'S' : ''}
              </div>
            )}
          </div>
          {evolucion.length >= 2 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={evolucion} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B2A6B" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1B2A6B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
                <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: 'rgba(255,255,255,0.95)' }}
                  formatter={v => [v + '%', 'Cumplimiento']} />
                <Area type="monotone" dataKey="pct" stroke="#1B2A6B" strokeWidth={2.5}
                  fill="url(#gradNav)" dot={{ r: 3, fill: '#1B2A6B', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#C8102E', strokeWidth: 0 }}
                  isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 13 }}>
              Necesitás al menos 2 cortes para ver la evolución
            </div>
          )}
        </GlassPanel>

        <GlassPanel delay={120} style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Mayor crecimiento</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>vs semana anterior</div>
          {topCrecimiento.length === 0 ? (
            <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', padding: '20px 0' }}>Sin variación disponible</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topCrecimiento.map((d, i) => {
                let nombre = d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
                if (nombre.length > 18) nombre = nombre.slice(0, 17) + '…'
                return (
                  <div key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: i === 0 ? 'linear-gradient(135deg,#1B2A6B,#2d4a9e)' : '#f1f5f9',
                      color: i === 0 ? '#fff' : '#94a3b8', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: '#0f172a' }}>{nombre}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>+{d.var}</span>
                  </div>
                )
              })}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel delay={150} style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Cumplimiento por sede</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Ordenado de mayor a menor · línea roja = 50%</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[['#52b788','≥ 50%'],['#f59e0b','En progreso'],['#f43f5e','Sin ingresos']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                {l}
              </div>
            ))}
          </div>
        </div>
        <BarChartSVG data={data} />
      </GlassPanel>

    </div>
  )
}
