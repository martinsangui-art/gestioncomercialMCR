import { useState } from 'react'
import { LOGO_B64 } from '../assets/logo'
import { FIRMA_B64 } from '../assets/firma'

// ── Estilos compartidos del documento ──────────────────────────────────────
function estilosPDF() {
  return `<style>
    @page{margin:20mm 18mm}
    body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:28px 32px;color:#1a1a2e;font-size:12px;line-height:1.5}
    .header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #C8102E;padding-bottom:14px;margin-bottom:22px}
    .header img{height:42px}
    .header-txt h1{font-size:17px;font-weight:700;color:#1B2A6B;margin:0 0 2px}
    .header-txt p{font-size:10px;color:#6b7280;margin:0}
    .fecha-badge{margin-left:auto;background:#1B2A6B;color:#fff;padding:7px 14px;border-radius:7px;text-align:center;flex-shrink:0}
    .fecha-badge .n{font-size:14px;font-weight:700}
    .fecha-badge .l{font-size:9px;opacity:.65;text-transform:uppercase;letter-spacing:.5px}
    .sede-title{background:#1B2A6B;color:#fff;padding:11px 16px;border-radius:7px;margin-bottom:16px}
    .sede-title h2{font-size:15px;font-weight:700;margin:0 0 2px}
    .sede-title p{font-size:10px;opacity:.65;margin:0}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    .kpi{background:#f8fafc;border-radius:6px;padding:9px 8px;text-align:center;border-top:3px solid #e5e7eb}
    .kpi.ok{border-top-color:#52b788}.kpi.warn{border-top-color:#f59e0b}.kpi.bad{border-top-color:#f43f5e}.kpi.bl{border-top-color:#1B2A6B}
    .kpi .n{font-size:20px;font-weight:800;margin-bottom:2px}
    .kpi .l{font-size:9px;color:#6b7280}
    h3{font-size:11px;font-weight:700;color:#1B2A6B;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 7px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
    .alert{background:#fffbeb;border-left:4px solid #f59e0b;padding:8px 11px;font-size:11px;color:#78350f;margin-bottom:12px;border-radius:0 5px 5px 0}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px}
    th{background:#1B2A6B;color:#fff;padding:6px 10px;text-align:left;font-size:10px}
    td{padding:5px 10px;border-bottom:1px solid #f1f5f9}
    tr:nth-child(even) td{background:#fafafa}
    .footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
    .tag-ok{background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px}
    .tag-w{background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px}
    .tag-bad{background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px}
    @media print{.no-print{display:none}}
  </style>`
}

function headerPDF(fecha, campNombre) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${estilosPDF()}</head><body>
    <div class="header">
      <img src="${LOGO_B64}" alt="UCASAL">
      <div class="header-txt">
        <h1>UCASAL – Informe de Cumplimiento de Ingreso</h1>
        <p>Coordinación Nacional de Sedes · Coordinadora Zonal Bs. As. · Dirección Operativa SEAD | Vicerrectorado Académico</p>
      </div>
      <div class="fecha-badge"><div class="n">${fecha}</div><div class="l">Fecha del reporte</div></div>
    </div>`
}

function footerPDF(fecha) {
  return `<div style="margin-top:32px;border-top:2px solid #C8102E;padding-top:14px">
      <img src="${FIRMA_B64}" alt="Firma Ing. Maria Celeste Rossi" style="max-width:520px;width:100%;display:block;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;margin-top:6px">
        <span>Documento generado por el sistema de seguimiento UCASAL · Zona Buenos Aires</span>
        <span>${fecha}</span>
      </div>
    </div>
    <scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},400);}</scr` + `ipt>
  </body></html>`
}

// Mini gráfico de barras SVG para la evolución de una sede
function miniChartPDF(historialSede, totalActual, obj) {
  const vals = [...historialSede, totalActual]
  if (vals.length < 2) return ''
  const W = 560, H = 130, mx = Math.max(...vals) || 1
  const bW = Math.max(16, Math.floor((W - 40) / vals.length) - 4)
  let bars = vals.map((v, i) => {
    const bH = Math.max(2, Math.round((v / mx) * (H - 25)))
    const x = 20 + i * ((W - 40) / vals.length)
    const isLast = i === vals.length - 1
    const col = isLast ? '#1B2A6B' : v >= obj ? '#52b788' : v > 0 ? '#f59e0b' : '#f43f5e'
    return `<rect x="${x}" y="${H - 20 - bH}" width="${bW}" height="${bH}" rx="2" fill="${col}"/>
      <text x="${x + bW / 2}" y="${H - 20 - bH - 3}" text-anchor="middle" font-size="8" fill="#374151">${v}</text>`
  }).join('')
  if (obj <= mx) {
    const yObj = H - 20 - Math.round((obj / mx) * (H - 25))
    bars += `<line x1="20" y1="${yObj}" x2="${W - 20}" y2="${yObj}" stroke="#C8102E" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="${W - 18}" y="${yObj + 4}" font-size="8" fill="#C8102E">OBJ</text>`
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bars}</svg>`
}

function abrirVentanaPDF(html, onToast) {
  const w = window.open('', '_blank')
  if (!w) { onToast('⚠️ Permitir popups para generar el PDF. Buscá la notificación en la barra del navegador.'); return false }
  w.document.write(html)
  w.document.close()
  onToast('📄 PDF listo — usá Ctrl+P (o Cmd+P en Mac) y elegí "Guardar como PDF"')
  return true
}

// ── Generadores de informes ───────────────────────────────────────────────

function generarPDFGeneral(data, campNombre, fecha, onToast) {
  const sorted = [...data].sort((a, b) => {
    const pa = a.pct >= 50 ? 0 : a.total > 0 ? 1 : 2
    const pb = b.pct >= 50 ? 0 : b.total > 0 ? 1 : 2
    return pa !== pb ? pa - pb : a.sede.localeCompare(b.sede)
  })
  const ok = sorted.filter(d => d.pct >= 50).length
  const warn = sorted.filter(d => d.pct > 0 && d.pct < 50).length
  const zero = sorted.filter(d => d.total === 0).length
  const rows = sorted.map(d => {
    const ps = d.pct + '%'
    const tag = d.pct >= 50 ? '<span class="tag-ok">En objetivo</span>' : d.total > 0 ? '<span class="tag-w">En progreso</span>' : '<span class="tag-bad">Sin ingresos</span>'
    const diff = d.var
    const varStr = diff !== null ? (diff > 0 ? '+' + diff : diff === 0 ? '=' : String(diff)) : '—'
    const varColor = diff > 0 ? '#16a34a' : diff < 0 ? '#be123c' : '#9ca3af'
    return `<tr><td>${d.cod_sede}</td><td>${d.sede}</td><td style="text-align:center">${d.objetivo}</td>
      <td style="text-align:center;font-weight:700">${d.total}</td>
      <td style="text-align:center;font-weight:700;color:${varColor}">${varStr}</td>
      <td style="text-align:center;font-weight:700">${ps}</td><td>${tag}</td></tr>`
  }).join('')
  const promedio = sorted.length ? Math.round(sorted.reduce((a, d) => a + d.pct, 0) / sorted.length) : 0

  const html = headerPDF(fecha, campNombre) +
    `<h3>Resumen ejecutivo</h3>
    <table><tr><th>Total sedes</th><th>En objetivo ≥50%</th><th>En progreso</th><th>Sin ingresos</th><th>Promedio cumplimiento</th></tr>
      <tr><td>${sorted.length}</td><td>${ok}</td><td>${warn}</td><td>${zero}</td><td>${promedio}%</td></tr>
    </table>
    <h3>Detalle por sede</h3>
    <table><tr><th>Cod</th><th>Sede</th><th>Objetivo</th><th>Ingresados</th><th>Var.</th><th>Cumpl.</th><th>Estado</th></tr>${rows}</table>` +
    footerPDF(fecha)
  abrirVentanaPDF(html, onToast)
}

function generarPDFSede(d, historial, campNombre, fecha, conHist, onToast) {
  const pct = d.pct + '%'
  const faltan = Math.max(0, d.objetivo - d.total)
  const noav = d.var === 0
  let varTxt = 'Sin datos de semana anterior'
  if (d.var !== null) {
    varTxt = d.var > 0 ? `+${d.var} vs semana anterior` : d.var < 0 ? `${d.var} vs semana anterior` : 'Sin variación vs semana anterior'
  }

  // Historial de esta sede ordenado por fecha
  const fechas = Object.keys(historial).sort()
  const histVals = fechas.map(f => historial[f][d.cod_sede]).filter(v => v !== undefined)
  let tendTxt = ''
  if (histVals.length >= 2) {
    const delta = histVals[histVals.length - 1] - histVals[0]
    tendTxt = delta > 0 ? `Tendencia positiva: +${delta} ingresos desde el inicio` : delta < 0 ? `Tendencia negativa: ${delta} ingresos desde el inicio` : 'Sin variación desde el inicio'
  }
  let histTabla = ''
  fechas.forEach(f => {
    const v = historial[f][d.cod_sede]
    if (v !== undefined) {
      const tag = v === 0 ? 'Sin ingresos' : v >= d.objetivo ? 'Objetivo cumplido' : 'En progreso'
      histTabla += `<tr><td>${f}</td><td style="text-align:center;font-weight:700">${v}</td><td>${tag}</td></tr>`
    }
  })

  const kpiClass = d.pct >= 50 ? 'ok' : d.total > 0 ? 'warn' : 'bad'
  const parts = []
  parts.push(headerPDF(fecha, campNombre))
  parts.push(`<div class="sede-title"><h2>${d.sede}</h2><p>Código: ${d.cod_sede} - ${campNombre}</p></div>`)
  parts.push('<div class="kpi-grid">')
  parts.push(`<div class="kpi ${kpiClass}"><div class="n">${pct}</div><div class="l">Cumplimiento</div></div>`)
  parts.push(`<div class="kpi bl"><div class="n">${d.objetivo}</div><div class="l">Objetivo</div></div>`)
  parts.push(`<div class="kpi ${d.total > 0 ? 'ok' : 'bad'}"><div class="n">${d.total}</div><div class="l">Ingresados</div></div>`)
  parts.push(`<div class="kpi ${faltan === 0 ? 'ok' : 'warn'}"><div class="n">${faltan === 0 ? 'OK' : faltan}</div><div class="l">${faltan === 0 ? 'Cumplido' : 'Faltan'}</div></div>`)
  parts.push('</div>')
  if (noav) parts.push(`<div class="alert">Sin avance respecto a la semana anterior. ${varTxt}</div>`)
  if (conHist && histVals.length >= 2) {
    parts.push('<h3>Evolución histórica</h3>')
    parts.push(miniChartPDF(histVals.slice(0, -1), d.total, d.objetivo))
    if (tendTxt) parts.push(`<p style="font-size:11px;color:#374151;margin-top:6px">${tendTxt}</p>`)
  }
  if (conHist && histTabla) {
    parts.push('<h3>Detalle por semana</h3>')
    parts.push(`<table><tr><th>Semana</th><th>Ingresados</th><th>Estado</th></tr>${histTabla}</table>`)
  }
  parts.push('<h3>Análisis de variación</h3>')
  parts.push('<table><tr><th>Indicador</th><th>Valor</th></tr>')
  parts.push(`<tr><td>Variación semana anterior</td><td>${varTxt}</td></tr>`)
  if (tendTxt) parts.push(`<tr><td>Tendencia general</td><td>${tendTxt}</td></tr>`)
  parts.push('</table>')
  parts.push(footerPDF(fecha))
  abrirVentanaPDF(parts.join(''), onToast)
}

function generarPDFComparacion(sedesSeleccionadas, campNombre, fecha, historial, onToast) {
  if (!sedesSeleccionadas.length) { onToast('No se encontraron datos'); return }
  const sedes = [...sedesSeleccionadas].sort((a, b) => b.pct - a.pct)

  const BAR_H = 32, GAP = 7, LBL_W = 185, BAR_MAX = 360
  const SVG_W = LBL_W + BAR_MAX + 100
  const SVG_H = (BAR_H + GAP) * sedes.length + 20
  let svgBars = sedes.map((d, i) => {
    const y = 10 + i * (BAR_H + GAP)
    const pct = d.pct
    const bW = Math.max(2, Math.round((pct / 100) * BAR_MAX))
    const col = pct >= 50 ? '#52b788' : d.total > 0 ? '#f59e0b' : '#f43f5e'
    let lbl = d.sede.replace(/ - BUENOS AIRES$/, '').replace(/ - BS AS$/, '')
    if (lbl.length > 26) lbl = lbl.slice(0, 25) + '...'
    return `<rect x="${LBL_W}" y="${y}" width="${BAR_MAX}" height="${BAR_H}" rx="3" fill="#f1f5f9"/>
      <rect x="${LBL_W}" y="${y}" width="${bW}" height="${BAR_H}" rx="3" fill="${col}"/>
      <text x="${LBL_W - 6}" y="${y + BAR_H / 2 + 5}" text-anchor="end" font-size="11" font-family="Arial" fill="#374151">${lbl}</text>
      <text x="${LBL_W + bW + 6}" y="${y + BAR_H / 2 + 5}" font-size="11" font-family="Arial" font-weight="700" fill="${col}">${pct}% (${d.total}/${d.objetivo})</text>`
  }).join('')
  const x50 = LBL_W + Math.round(0.5 * BAR_MAX)
  svgBars += `<line x1="${x50}" y1="0" x2="${x50}" y2="${SVG_H}" stroke="#C8102E" stroke-width="1" stroke-dasharray="3,3" opacity=".6"/>
    <text x="${x50}" y="${SVG_H + 4}" text-anchor="middle" font-size="9" fill="#C8102E" font-family="Arial">50%</text>`
  const svgChart = `<svg width="100%" viewBox="0 0 ${SVG_W} ${SVG_H + 10}" style="display:block">${svgBars}</svg>`

  const filas = sedes.map(d => {
    const ps = d.pct + '%'
    const col = d.pct >= 50 ? '#16a34a' : d.total > 0 ? '#d97706' : '#be123c'
    const estado = d.pct >= 50 ? 'En objetivo' : d.total > 0 ? 'En progreso' : 'Sin ingresos'
    const varTxt = d.var === null ? '—' : d.var > 0 ? '+' + d.var : d.var < 0 ? String(d.var) : 'Sin cambio'

    const fechas = Object.keys(historial).sort()
    const histVals = fechas.map(f => historial[f][d.cod_sede]).filter(v => v !== undefined)
    let tend = '—'
    if (histVals.length >= 2) {
      const delta = histVals[histVals.length - 1] - histVals[0]
      tend = delta > 0 ? `+${delta} acum.` : delta < 0 ? `${delta} acum.` : 'Estable'
    }
    return `<tr>
      <td>${d.sede.replace(/ - BUENOS AIRES$/, '').replace(/ - BS AS$/, '')}</td>
      <td style="text-align:center">${d.objetivo}</td>
      <td style="text-align:center;font-weight:700">${d.total}</td>
      <td style="text-align:center;font-weight:700;color:${col}">${ps}</td>
      <td style="text-align:center">${varTxt}</td>
      <td style="text-align:center">${tend}</td>
      <td style="text-align:center">${estado}</td>
    </tr>`
  }).join('')

  const parts = []
  parts.push(headerPDF(fecha, campNombre))
  parts.push(`<h2 style="font-size:16px;font-weight:700;color:#1B2A6B;margin-bottom:4px">Comparación de sedes seleccionadas</h2>`)
  parts.push(`<p style="font-size:11px;color:#6b7280;margin-bottom:18px">${sedes.length} sedes analizadas al ${fecha}</p>`)
  parts.push('<h3>Cumplimiento comparado</h3>')
  parts.push(svgChart)
  parts.push('<h3 style="margin-top:18px">Tabla comparativa</h3>')
  parts.push('<table><tr><th>Sede</th><th>Objetivo</th><th>Ingresados</th><th>Cumpl.</th><th>Var. sem.</th><th>Tendencia</th><th>Estado</th></tr>')
  parts.push(filas)
  parts.push('</table>')

  parts.push('<h3 style="margin-top:18px">Ranking</h3>')
  parts.push('<table><tr><th>#</th><th>Sede</th><th>Cumplimiento</th><th>Destaque</th></tr>')
  sedes.forEach((d, i) => {
    const ps = d.pct + '%'
    const medalla = i === 0 ? '🥇 Mejor cumplimiento' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
    const col = d.pct >= 50 ? '#16a34a' : d.total > 0 ? '#d97706' : '#be123c'
    parts.push(`<tr><td style="text-align:center;font-weight:700">${i + 1}</td>
      <td>${d.sede.replace(/ - BUENOS AIRES$/, '').replace(/ - BS AS$/, '')}</td>
      <td style="text-align:center;font-weight:700;color:${col}">${ps}</td>
      <td>${medalla}</td></tr>`)
  })
  parts.push('</table>')
  parts.push(footerPDF(fecha))
  abrirVentanaPDF(parts.join(''), onToast)
}

// ── Componente principal ─────────────────────────────────────────────────
export default function InformesPDF({ data, historial, campanas, campanaActiva, sedesSeleccionadas = [] }) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState('general')
  const [sedeElegida, setSedeElegida] = useState('')
  const [conHist, setConHist] = useState(true)
  const [toast, setToast] = useState(null)

  const camp = campanas?.find(c => c.id === campanaActiva)
  const campNombre = camp?.nombre || ''
  const fecha = data[0]?.fecha || new Date().toISOString().slice(0, 10)

  // Reconstruir historial agrupado por fecha->cod_sede->total
  const historialAgrupado = {}
  historial.forEach(r => {
    if (!historialAgrupado[r.fecha]) historialAgrupado[r.fecha] = {}
    historialAgrupado[r.fecha][r.cod_sede] = Number(r.total) || 0
  })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const handleGenerar = () => {
    if (tipo === 'general') {
      generarPDFGeneral(data, campNombre, fecha, showToast)
    } else if (tipo === 'sede') {
      const d = data.find(x => String(x.cod_sede) === String(sedeElegida))
      if (!d) { showToast('Seleccioná una sede'); return }
      generarPDFSede(d, historialAgrupado, campNombre, fecha, conHist, showToast)
    } else if (tipo === 'comparacion') {
      if (sedesSeleccionadas.length < 1) { showToast('Seleccioná al menos una sede para comparar'); return }
      const sedesData = data.filter(d => sedesSeleccionadas.includes(String(d.cod_sede)))
      generarPDFComparacion(sedesData, campNombre, fecha, historialAgrupado, showToast)
    }
  }

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: '#0f172a', color: '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          zIndex: 9999, maxWidth: 320, lineHeight: 1.4,
        }}>{toast}</div>
      )}

      <button onClick={() => setOpen(true)} style={{
        padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
        background: '#fff1f2', color: '#C8102E', border: '1.5px solid #fecdd3', cursor: 'pointer',
      }}>
        📄 Informe PDF
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
            overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)',
          }}>
            <div style={{ background: 'linear-gradient(135deg,#1B2A6B,#0f1d4a)', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Generar informe PDF</div>
                <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginTop: 2 }}>Selecciona el tipo de reporte</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Tipo de informe */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Tipo de informe
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[
                  ['general', '📊 Resumen general', 'Todas las sedes, ordenadas por estado'],
                  ['sede', '🏢 Informe por sede', 'Detalle individual con evolución histórica'],
                  ['comparacion', '🔄 Comparación de sedes', `${sedesSeleccionadas.length} sedes seleccionadas`],
                ].map(([val, label, desc]) => (
                  <label key={val} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    border: `1.5px solid ${tipo === val ? '#1B2A6B' : '#e2e8f0'}`,
                    borderRadius: 10, cursor: 'pointer',
                    background: tipo === val ? '#eef0f8' : '#fff',
                  }}>
                    <input type="radio" checked={tipo === val} onChange={() => setTipo(val)} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Selector de sede si aplica */}
              {tipo === 'sede' && (
                <div style={{ marginBottom: 16 }}>
                  <select value={sedeElegida} onChange={e => setSedeElegida(e.target.value)} style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
                  }}>
                    <option value="">Seleccioná una sede…</option>
                    {data.map(d => (
                      <option key={d.cod_sede} value={d.cod_sede}>{d.sede}</option>
                    ))}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: '#64748b' }}>
                    <input type="checkbox" checked={conHist} onChange={e => setConHist(e.target.checked)} />
                    Incluir gráfico y detalle histórico
                  </label>
                </div>
              )}

              {tipo === 'comparacion' && sedesSeleccionadas.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>
                  💡 Para comparar sedes, primero seleccionalas en la pestaña Historial → Comparar sedes.
                </div>
              )}

              <button onClick={handleGenerar} style={{
                width: '100%', padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg,#1B2A6B,#0f1d4a)', color: '#fff', border: 'none', cursor: 'pointer',
              }}>
                📄 Generar y abrir PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
