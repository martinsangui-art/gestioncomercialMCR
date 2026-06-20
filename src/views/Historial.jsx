import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, Legend } from 'recharts'

const COLORS = ['#1B2A6B','#C8102E','#059669','#d97706','#7c3aed']

export default function Historial({ historial, data, onSeleccionChange }) {
  const [tab, setTab] = useState(1)
  const [sedesComp, setSedesComp] = useState([])

  const fechas = useMemo(() => {
    const set = new Set(historial.map(r => r.fecha))
    return [...set].sort()
  }, [historial])

  const todasSedes = useMemo(() => {
    const map = {}
    historial.forEach(r => { if (!map[r.cod_sede]) map[r.cod_sede] = r.sede })
    return Object.entries(map).sort(([,a],[,b]) => a.localeCompare(b))
  }, [historial])

  const historialPorSede = useMemo(() => {
    const map = {}
    historial.forEach(r => {
      if (!map[r.cod_sede]) map[r.cod_sede] = { sede: r.sede, vals: {} }
      map[r.cod_sede].vals[r.fecha] = Number(r.total) || 0
    })
    return map
  }, [historial])

  // Datos para gráfico de barras agrupadas
  const datosBarras = useMemo(() => {
    if (!sedesComp.length) return []
    // Una barra por sede, mostrando el valor en cada fecha
    // Formato: [{ fecha, cod1: val, cod2: val, ... }]
    return fechas.map(fecha => {
      const row = { fecha: fecha.slice(5) }
      sedesComp.forEach(cod => {
        const entry = historial.find(r => r.fecha === fecha && String(r.cod_sede) === String(cod))
        if (entry) {
          const obj = Number(entry.objetivo) || 0
          const tot = Number(entry.total) || 0
          row[cod] = obj > 0 ? Math.round(tot / obj * 100) : 0
        }
      })
      return row
    })
  }, [sedesComp, fechas, historial])

  const toggleSede = (cod) => {
    setSedesComp(prev =>
      prev.includes(cod) ? prev.filter(c => c !== cod) :
      prev.length < 5 ? [...prev, cod] : prev
    )
  }

  useEffect(() => {
    if (onSeleccionChange) onSeleccionChange(sedesComp)
  }, [sedesComp])

  const sedeNombre = (cod) => {
    const found = todasSedes.find(([c]) => c === cod)?.[1] || cod
    return found.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
  }

  const tabBtn = (n, label) => (
    <button onClick={() => setTab(n)} style={{
      flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer',
      background: tab === n ? '#fff' : '#f8fafc',
      color: tab === n ? '#1B2A6B' : '#94a3b8',
      fontWeight: tab === n ? 700 : 500, fontSize: 12,
      borderBottom: tab === n ? '2px solid #1B2A6B' : '2px solid transparent',
      transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          {tabBtn(1, '📋 Evolución por sede')}
          {tabBtn(2, '📊 Comparar sedes')}
        </div>

        {/* TAB 1: tabla de evolución histórica */}
        {tab === 1 && (
          <div className="animate-fadeIn">
            {fechas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos históricos</div>
            ) : (
              <>
                <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
                  {fechas.length} semanas · Columna azul = semana actual · Color indica nivel de ingresos
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f5f3ff' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', borderBottom: '2px solid #ddd6fe', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#f5f3ff', zIndex: 2 }}>Sede</th>
                        {fechas.map(f => (
                          <th key={f} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', borderBottom: '2px solid #ddd6fe', whiteSpace: 'nowrap' }}>
                            {f.slice(5).replace('-','/')}
                          </th>
                        ))}
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', borderBottom: '2px solid #ddd6fe', whiteSpace: 'nowrap', background: '#dbeafe' }}>Hoy</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', borderBottom: '2px solid #ddd6fe' }}>Tendencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todasSedes.map(([cod, nombre]) => {
                        const entry = historialPorSede[cod]
                        const vals = fechas.map(f => entry?.vals[f] ?? null)
                        const valsCon = vals.filter(v => v !== null)
                        const curr = data.find(d => String(d.cod_sede) === String(cod))
                        let tendencia = null
                        if (valsCon.length >= 2) {
                          const delta = valsCon[valsCon.length-1] - valsCon[0]
                          tendencia = delta > 0
                            ? <span style={{ color:'#16a34a',fontWeight:700 }}>{delta>=5?'🚀':delta>=3?'📈':'⬆️'} +{delta}</span>
                            : delta < 0
                              ? <span style={{ color:'#be123c',fontWeight:700 }}>📉 {delta}</span>
                              : <span style={{ color:'#9ca3af' }}>➡️ sin cambio</span>
                        }
                        return (
                          <tr key={cod} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '7px 14px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 20 }}>{cod}</span>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{nombre.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}</span>
                              </div>
                            </td>
                            {vals.map((v, i) => {
                              if (v === null) return <td key={i} style={{ padding: '7px 12px', textAlign: 'center', color: '#d1d5db' }}>—</td>
                              const bg = v === 0 ? '#fff1f2' : v < 3 ? '#fffbeb' : '#f0fdf4'
                              const col = v === 0 ? '#be123c' : v < 3 ? '#b45309' : '#15803d'
                              return <td key={i} style={{ padding: '7px 12px', textAlign: 'center', background: bg, color: col, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                            })}
                            <td style={{ padding: '7px 12px', textAlign: 'center', background: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                              {curr ? curr.total : '—'}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'center' }}>{tendencia || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: Comparar sedes — barras agrupadas */}
        {tab === 2 && (
          <div className="animate-fadeIn" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              Seleccioná hasta 5 sedes para comparar su % de cumplimiento por corte
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {todasSedes.map(([cod, nombre], i) => {
                const sel = sedesComp.includes(cod)
                const ci = sedesComp.indexOf(cod)
                const shortName = nombre.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
                return (
                  <button key={cod} onClick={() => toggleSede(cod)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: sel ? `2px solid ${COLORS[ci]}` : '1px solid #e2e8f0',
                    background: sel ? COLORS[ci] + '18' : '#fff',
                    color: sel ? COLORS[ci] : '#64748b',
                  }}>{shortName}</button>
                )
              })}
            </div>

            {sedesComp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: 13 }}>
                Seleccioná al menos una sede para ver la comparación
              </div>
            ) : (
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '20px' }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={datosBarras} margin={{ top: 10, right: 20, bottom: 20, left: -10 }}
                    barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      tickFormatter={v => v + '%'} domain={[0, 110]} />
                    {/* Línea del 50% como referencia */}
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}
                      formatter={(v, name) => [v !== undefined ? v + '%' : '—', sedeNombre(name)]}
                      labelStyle={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}
                    />
                    <Legend
                      formatter={sedeNombre}
                      wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    />
                    {sedesComp.map((cod, i) => (
                      <Bar key={cod} dataKey={cod} fill={COLORS[i]} radius={[4, 4, 0, 0]}
                        maxBarSize={60} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabla comparativa debajo del gráfico */}
                <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Sede</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Objetivo</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total actual</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Cumplimiento</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Var. semana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sedesComp.map((cod, i) => {
                        const d = data.find(x => String(x.cod_sede) === String(cod))
                        if (!d) return null
                        const pct = d.pct || 0
                        const col = pct >= 50 ? '#16a34a' : pct > 0 ? '#d97706' : '#be123c'
                        const diff = d.var
                        return (
                          <tr key={cod} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i], flexShrink: 0 }} />
                                <span style={{ fontWeight: 600 }}>{sedeNombre(cod)}</span>
                              </div>
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{d.objetivo}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.total}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums' }}>{pct}%</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: diff > 0 ? '#16a34a' : diff < 0 ? '#be123c' : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                              {diff === null ? '—' : diff > 0 ? `+${diff} ▲` : diff < 0 ? `${diff} ▼` : '= sin cambio'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
