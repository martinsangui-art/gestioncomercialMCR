import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, Legend } from 'recharts'
import { obtenerHistorialCampana } from '../hooks/useSheets'
import { C, F } from '../lib/theme'

const COLORS = [C.ink, C.crimson, C.ok, C.warn, C.brass]

// % de cumplimiento por corte de un historial, ordenado por fecha e indexado
// por "semana N desde el inicio" en vez de fecha calendario — así se puede
// comparar campañas de años distintos en la misma altura del ciclo. Si se
// pasa codSede, agrupa solo esa sede en vez del total general.
function evolucionPorSemana(hist, codSede) {
  const filtrado = codSede ? hist.filter(r => String(r.cod_sede) === String(codSede)) : hist
  const byFecha = {}
  filtrado.forEach(r => {
    if (!byFecha[r.fecha]) byFecha[r.fecha] = { total: 0, obj: 0 }
    byFecha[r.fecha].total += Number(r.total) || 0
    byFecha[r.fecha].obj += Number(r.objetivo) || 0
  })
  return Object.entries(byFecha).sort(([a], [b]) => a.localeCompare(b)).map(([, v], i) => ({
    semana: i + 1,
    pct: v.obj > 0 ? Math.round(v.total / v.obj * 100) : 0,
  }))
}

// Escala de calor de un solo tono (celeste → navy) según el avance contra el
// objetivo; las celdas en cero van en rojo claro para que salten a la vista.
function calor(pct, cero = false) {
  if (cero) return '#FBE3E7'
  const t = Math.max(0, Math.min(pct, 100)) / 100
  const a = [228, 239, 252], b = [27, 42, 107] // C.celesteSoft → C.navy
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c.join(',')})`
}

export default function Historial({ historial, data, campanas, campanaActiva, onSeleccionChange }) {
  const [tab, setTab] = useState(1)
  const [sedesComp, setSedesComp] = useState([])

  // TAB 3: comparar dos campañas (ej: mismo tipo de ingreso, año contra año)
  const [campA, setCampA] = useState(campanaActiva || '')
  const [campB, setCampB] = useState('')
  const [histA, setHistA] = useState([])
  const [histB, setHistB] = useState([])
  const [cargandoComp, setCargandoComp] = useState(false)
  const [sedeComp3, setSedeComp3] = useState('') // '' = general (todas las sedes)

  useEffect(() => {
    if (!campA && campanaActiva) setCampA(campanaActiva)
  }, [campanaActiva]) // eslint-disable-line

  useEffect(() => {
    if (tab !== 3 || !campA || !campB) return
    setCargandoComp(true)
    Promise.all([
      campA === campanaActiva ? Promise.resolve(historial) : obtenerHistorialCampana(campA),
      campB === campanaActiva ? Promise.resolve(historial) : obtenerHistorialCampana(campB),
    ]).then(([a, b]) => { setHistA(a); setHistB(b) })
      .catch(() => { setHistA([]); setHistB([]) })
      .finally(() => setCargandoComp(false))
  }, [tab, campA, campB]) // eslint-disable-line

  const datosComparacion = useMemo(() => {
    if (!campA || !campB) return []
    const evA = evolucionPorSemana(histA, sedeComp3)
    const evB = evolucionPorSemana(histB, sedeComp3)
    const maxSemanas = Math.max(evA.length, evB.length)
    const rows = []
    for (let i = 0; i < maxSemanas; i++) {
      rows.push({
        semana: `Semana ${i + 1}`,
        [campA]: evA[i]?.pct,
        [campB]: evB[i]?.pct,
      })
    }
    return rows
  }, [histA, histB, campA, campB, sedeComp3])

  // Sedes disponibles para el filtro de la comparación de campañas — la
  // unión de las que aparecen en cualquiera de las dos campañas cargadas.
  const sedesComp3 = useMemo(() => {
    const map = {}
    ;[...histA, ...histB].forEach(r => { if (!map[r.cod_sede]) map[r.cod_sede] = r.sede })
    return Object.entries(map).sort(([, a], [, b]) => a.localeCompare(b))
  }, [histA, histB])

  const nombreCampana = (id) => campanas?.find(c => c.id === id)?.nombre || id

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
      if (!map[r.cod_sede]) map[r.cod_sede] = { sede: r.sede, vals: {}, obj: {} }
      map[r.cod_sede].vals[r.fecha] = Number(r.total) || 0
      map[r.cod_sede].obj[r.fecha] = Number(r.objetivo) || 0
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
    <button onClick={() => setTab(n)} aria-pressed={tab === n} style={{
      height: 34, padding: '0 16px', border: 'none', borderRadius: 7, cursor: 'pointer',
      background: tab === n ? C.ink : 'transparent',
      color: tab === n ? '#fff' : C.ink,
      fontWeight: tab === n ? 700 : 500, fontSize: 13.5, fontFamily: F.body,
      transition: 'background 0.15s, color 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F.body }}>
      <div role="group" aria-label="Vista del historial" style={{ display: 'flex', gap: 4, background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 10, padding: 3, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {tabBtn(1, 'Evolución por sede')}
        {tabBtn(2, 'Comparar sedes')}
        {tabBtn(3, 'Comparar campañas')}
      </div>
      <div style={{ background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* TAB 1: tabla de evolución histórica */}
        {tab === 1 && (
          <div className="animate-fadeIn">
            {fechas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>Sin datos históricos</div>
            ) : (
              <>
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.rule}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: C.inkSoft }}>
                  <span>Inscriptos de cada sede en cada corte. El color es el avance contra su objetivo.</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontFamily: F.mono, fontSize: 11 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: calor(0, true) }} /> en cero
                    <span style={{ width: 90, height: 12, borderRadius: 3, marginLeft: 8, background: `linear-gradient(90deg, ${calor(1)}, ${calor(50)}, ${calor(100)})` }} />
                    0 → 100%+
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12.5, padding: '4px 8px 8px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.inkSoft, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 2 }}>Sede</th>
                        {fechas.map((f, i) => (
                          <th key={f} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: i === fechas.length - 1 ? 700 : 500, color: i === fechas.length - 1 ? C.ink : C.inkSoft, whiteSpace: 'nowrap', fontFamily: F.mono }}>
                            {f.slice(8, 10)}/{f.slice(5, 7)}
                          </th>
                        ))}
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.inkSoft, whiteSpace: 'nowrap' }}>Desde el inicio</th>
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
                            ? <span style={{ color: C.ok, fontWeight: 700 }}>+{delta}</span>
                            : delta < 0
                              ? <span style={{ color: C.crimson, fontWeight: 700 }}>{delta}</span>
                              : <span style={{ color: C.inkSoft }}>sin cambio</span>
                        }
                        return (
                          <tr key={cod}>
                            <td style={{ padding: '0 10px', position: 'sticky', left: 0, background: '#fff', zIndex: 1, whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: C.inkSoft, fontFamily: F.mono }}>{cod}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{nombre.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}</span>
                              </div>
                            </td>
                            {vals.map((v, i) => {
                              if (v === null) return <td key={i} style={{ textAlign: 'center', color: C.rule, fontFamily: F.mono }}>—</td>
                              const ob = entry.obj[fechas[i]] || curr?.objetivo || 0
                              const pct = ob > 0 ? Math.round(v / ob * 100) : 0
                              const fuerte = v > 0 && pct >= 55
                              return (
                                <td key={i} title={`${fechas[i].slice(8, 10)}/${fechas[i].slice(5, 7)}: ${v} de ${ob} (${pct}%)`} style={{
                                  minWidth: 40, height: 30, padding: '0 6px', textAlign: 'center', borderRadius: 5,
                                  background: calor(pct, v === 0), color: v === 0 ? '#9B1027' : fuerte ? '#fff' : C.ink,
                                  fontWeight: i === vals.length - 1 ? 800 : 600, fontFamily: F.mono,
                                  boxShadow: i === vals.length - 1 ? `inset 0 0 0 2px ${C.ink}` : 'none',
                                }}>{v}</td>
                              )
                            })}
                            <td style={{ padding: '0 10px', textAlign: 'right', fontFamily: F.mono, whiteSpace: 'nowrap' }}>{tendencia || '—'}</td>
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
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>
              Seleccioná hasta 5 sedes para comparar su % de cumplimiento por corte
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {todasSedes.map(([cod, nombre], i) => {
                const sel = sedesComp.includes(cod)
                const ci = sedesComp.indexOf(cod)
                const shortName = nombre.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')
                return (
                  <button key={cod} onClick={() => toggleSede(cod)} style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: F.body,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: sel ? `1.5px solid ${COLORS[ci]}` : `1px solid ${C.rule}`,
                    background: sel ? COLORS[ci] + '14' : '#fff',
                    color: sel ? COLORS[ci] : C.inkSoft,
                  }}>{shortName}</button>
                )
              })}
            </div>

            {sedesComp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.inkSoft, fontSize: 13 }}>
                Seleccioná al menos una sede para ver la comparación
              </div>
            ) : (
              <div style={{ background: C.paper, padding: '20px' }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={datosBarras} margin={{ top: 10, right: 20, bottom: 20, left: -10 }}
                    barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false}
                      tickFormatter={v => v + '%'} domain={[0, 110]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: `1px solid ${C.rule}`, borderRadius: 8, background: '#fff', fontFamily: F.body }}
                      formatter={(v, name) => [v !== undefined ? v + '%' : '—', sedeNombre(name)]}
                      labelStyle={{ color: C.inkSoft, fontSize: 11, marginBottom: 6 }}
                    />
                    <Legend
                      formatter={sedeNombre}
                      wrapperStyle={{ fontSize: 12, paddingTop: 12, fontFamily: F.body }}
                    />
                    {sedesComp.map((cod, i) => (
                      <Bar key={cod} dataKey={cod} fill={COLORS[i]}
                        maxBarSize={60} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabla comparativa debajo del gráfico */}
                <div style={{ marginTop: 20, border: `1px solid ${C.rule}`, overflow: 'hidden', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.paper, borderBottom: `1px solid ${C.rule}` }}>
                        <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.body }}>Sede</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.body }}>Objetivo</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.body }}>Total actual</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.body }}>Cumplimiento</th>
                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', fontFamily: F.body }}>Var. semana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sedesComp.map((cod, i) => {
                        const d = data.find(x => String(x.cod_sede) === String(cod))
                        if (!d) return null
                        const pct = d.pct || 0
                        const col = pct >= 50 ? C.ok : pct > 0 ? C.warn : C.danger
                        const diff = d.var
                        return (
                          <tr key={cod} style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                            <td style={{ padding: '9px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 10, height: 10, background: COLORS[i], flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, color: C.ink }}>{sedeNombre(cod)}</span>
                              </div>
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontFamily: F.mono, color: C.inkSoft }}>{d.objetivo}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, fontFamily: F.mono, color: C.ink }}>{d.total}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: col, fontFamily: F.mono }}>{pct}%</td>
                            <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 600, color: diff > 0 ? C.ok : diff < 0 ? C.danger : C.inkSoft, fontFamily: F.mono }}>
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

        {/* TAB 3: comparar dos campañas alineadas por semana desde el inicio */}
        {tab === 3 && (
          <div className="animate-fadeIn" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>
              Compara el % de cumplimiento de dos campañas — general o de una sede puntual — alineadas por semana desde el inicio de cada una (no por fecha calendario), útil para comparar año contra año.
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <select value={campA} onChange={e => setCampA(e.target.value)}
                style={{ padding: '7px 10px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, background: '#fff', fontFamily: F.body }}>
                <option value="">Campaña A…</option>
                {campanas?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={campB} onChange={e => setCampB(e.target.value)}
                style={{ padding: '7px 10px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, background: '#fff', fontFamily: F.body }}>
                <option value="">Campaña B…</option>
                {campanas?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={sedeComp3} onChange={e => setSedeComp3(e.target.value)}
                disabled={!campA || !campB}
                style={{ padding: '7px 10px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, background: '#fff', fontFamily: F.body, color: sedeComp3 ? C.ink : C.inkSoft, opacity: (!campA || !campB) ? 0.5 : 1 }}>
                <option value="">General · todas las sedes</option>
                {sedesComp3.map(([cod, nombre]) => (
                  <option key={cod} value={cod}>{nombre.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}</option>
                ))}
              </select>
            </div>

            {!campA || !campB ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.inkSoft, fontSize: 13 }}>
                Elegí dos campañas para comparar
              </div>
            ) : cargandoComp ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.inkSoft, fontSize: 13 }}>Cargando…</div>
            ) : datosComparacion.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.inkSoft, fontSize: 13 }}>
                {sedeComp3
                  ? `Ninguna de las dos campañas tiene datos históricos de ${sedeNombre(sedeComp3)}`
                  : 'Sin datos históricos para comparar'}
              </div>
            ) : (
              <div style={{ background: C.paper, padding: 20 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={datosComparacion} margin={{ top: 10, right: 20, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.rule} vertical={false} />
                    <XAxis dataKey="semana" tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false}
                      tickFormatter={v => v + '%'} domain={[0, 110]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: `1px solid ${C.rule}`, borderRadius: 8, background: '#fff', fontFamily: F.body }}
                      formatter={(v, name) => [v !== undefined ? v + '%' : '—', nombreCampana(name)]}
                    />
                    <Legend formatter={nombreCampana} wrapperStyle={{ fontSize: 12, paddingTop: 12, fontFamily: F.body }} />
                    <Line type="monotone" dataKey={campA} stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey={campB} stroke={COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
