import { useState } from 'react'
import { LOGO_B64 } from '../assets/logo'
import { FIRMA_B64 } from '../assets/firma'
import { C, F } from '../lib/theme'
import ModalShell from './ModalShell'

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

// ── Estilos compartidos del documento ──────────────────────────────────────
// Mismo sistema visual que la app ("señalética"): Archivo para texto y
// cifras expandidas, Chivo Mono para datos, navy + rojo UCASAL, estado en
// verde/ámbar/rojo. Pensado para imprimir en A4 en blanco y negro también.
function estilosPDF() {
  return `<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Chivo+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    @page{size:A4;margin:16mm 15mm}
    *{box-sizing:border-box}
    body{font-family:'Archivo',Arial,sans-serif;margin:0;padding:0;color:#0E1733;font-size:11.5px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{display:flex;align-items:stretch;margin-bottom:22px;border-bottom:3px solid #C8102E}
    .header .marca{background:#0E1733;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
    .header .marca img{height:34px;background:#fff;padding:3px;border-radius:4px}
    .header .marca b{font-weight:800;font-stretch:112%;font-size:15px;display:block;letter-spacing:.01em}
    .header .marca span{font-family:'Chivo Mono',monospace;font-size:9px;opacity:.6}
    .header-txt{padding:12px 18px;flex:1}
    .header-txt h1{font-size:19px;font-weight:800;font-stretch:110%;margin:0;letter-spacing:-.01em}
    .header-txt p{font-size:10px;color:#5A6480;margin:3px 0 0}
    .fecha-badge{padding:12px 18px;text-align:right;display:flex;flex-direction:column;justify-content:center}
    .fecha-badge .n{font-family:'Chivo Mono',monospace;font-size:14px;font-weight:600}
    .fecha-badge .l{font-size:9px;color:#5A6480;text-transform:uppercase;letter-spacing:.08em}
    .sede-title{border-left:6px solid #1B2A6B;padding:6px 0 6px 14px;margin-bottom:16px}
    .sede-title h2{font-size:22px;font-weight:800;font-stretch:110%;margin:0;letter-spacing:-.01em}
    .sede-title p{font-size:10.5px;color:#5A6480;margin:2px 0 0}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}
    .kpi{border:1px solid #DCE1EA;border-left:5px solid #DCE1EA;border-radius:6px;padding:10px 12px}
    .kpi.ok{border-left-color:#0F8A5F}.kpi.warn{border-left-color:#C98A0B}.kpi.bad{border-left-color:#C8102E}.kpi.bl{border-left-color:#1B2A6B}
    .kpi .n{font-size:26px;font-weight:800;font-stretch:125%;letter-spacing:-.02em;line-height:1.05;font-variant-numeric:tabular-nums}
    .kpi .l{font-size:9.5px;color:#5A6480;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    h3{font-size:12.5px;font-weight:800;font-stretch:105%;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid #DCE1EA}
    .alert{border-left:4px solid #C98A0B;background:#FBF0D9;padding:8px 12px;font-size:11px;margin-bottom:12px;border-radius:0 6px 6px 0}
    table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:12px}
    th{text-align:left;font-size:9.5px;font-weight:600;color:#5A6480;padding:6px 8px;border-bottom:2px solid #0E1733;text-transform:uppercase;letter-spacing:.05em}
    td{padding:5px 8px;border-bottom:1px solid #E9EDF3;font-variant-numeric:tabular-nums}
    tr{page-break-inside:avoid}
    .tag-ok,.tag-w,.tag-bad{display:inline-block;padding:1px 8px;border-radius:10px;font-weight:700;font-size:9.5px;color:#fff}
    .tag-ok{background:#0F8A5F}.tag-w{background:#C98A0B}.tag-bad{background:#C8102E}
    .salto{page-break-before:always;break-before:page}
    .footer{margin-top:28px}
    @media print{.no-print{display:none}}
  </style>`
}

function headerPDF(fecha, campNombre, titulo = 'Informe de cumplimiento') {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo} · ${campNombre}</title>${estilosPDF()}</head><body>
    <div class="header">
      <div class="marca"><img src="${LOGO_B64}" alt="UCASAL"><span>Gestión comercial<br>Zona Buenos Aires</span></div>
      <div class="header-txt">
        <h1>${titulo}</h1>
        <p>${campNombre ? campNombre + ' · ' : ''}Coordinación Zonal Buenos Aires · Dirección Operativa SEAD</p>
      </div>
      <div class="fecha-badge"><div class="n">${fmtFecha(fecha)}</div><div class="l">Corte</div></div>
    </div>`
}

function footerPDF(fecha) {
  return `<div class="footer" style="margin-top:32px;border-top:3px solid #C8102E;padding-top:14px">
      <img src="${FIRMA_B64}" alt="Firma Ing. Maria Celeste Rossi" style="max-width:480px;width:100%;display:block;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-family:'Chivo Mono',monospace;font-size:8.5px;color:#5A6480;margin-top:6px">
        <span>Sistema de seguimiento UCASAL · Zona Buenos Aires</span>
        <span>Corte del ${fmtFecha(fecha)}</span>
      </div>
    </div>
    <scr` + `ipt>window.onload=function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print();},300);});}</scr` + `ipt>
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
    const col = isLast ? '#1B2A6B' : v >= obj ? '#0F8A5F' : v > 0 ? '#C98A0B' : '#C8102E'
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

// Antes usaba window.open('', '_blank') + document.write, que varios browsers
// bloquean como popup (sobre todo si hay algo async entre el click y el open).
// Un <a> con blob: URL y target="_blank" es navegación normal, no popup — no
// pide permisos y sigue abriendo la vista previa en una pestaña para Ctrl+P.
function abrirVentanaPDF(html, onToast) {
  try {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Se libera después de que la pestaña nueva tuvo tiempo de cargar el HTML
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    onToast('Informe listo: usá Ctrl+P (o Cmd+P en Mac) y elegí "Guardar como PDF"')
    return true
  } catch (e) {
    onToast('No se pudo generar el informe: ' + e.message)
    return false
  }
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
  abrirVentanaPDF(headerPDF(fecha, campNombre) + cuerpoSede(d, historial, campNombre, conHist) + footerPDF(fecha), onToast)
}

// Contenido de la ficha de una sede (sin membrete ni firma) — se usa suelto
// y también como anexo "una hoja por sede" del informe de cierre.
function cuerpoSede(d, historial, campNombre, conHist) {
  const pct = d.pct + '%'
  const faltan = Math.max(0, d.objetivo - d.total)
  const noav = d.var === 0
  let varTxt = 'Sin datos de semana anterior'
  if (d.var !== null) {
    varTxt = d.var > 0 ? `+${d.var} vs semana anterior` : d.var < 0 ? `${d.var} vs semana anterior` : 'Sin variación vs semana anterior'
  }

  // Historial de esta sede ordenado por fecha
  const fechas = Object.keys(historial).sort()
  const histVals = fechas.map(f => historial[f][String(d.cod_sede)]).filter(v => v !== undefined)
  let tendTxt = ''
  if (histVals.length >= 2) {
    const delta = histVals[histVals.length - 1] - histVals[0]
    tendTxt = delta > 0 ? `Tendencia positiva: +${delta} ingresos desde el inicio` : delta < 0 ? `Tendencia negativa: ${delta} ingresos desde el inicio` : 'Sin variación desde el inicio'
  }
  let histTabla = ''
  fechas.forEach(f => {
    const v = historial[f][String(d.cod_sede)]
    if (v !== undefined) {
      const tag = v === 0 ? 'Sin ingresos' : v >= d.objetivo ? 'Objetivo cumplido' : 'En progreso'
      histTabla += `<tr><td>${fmtFecha(f)}</td><td style="text-align:center;font-weight:700">${v}</td><td>${tag}</td></tr>`
    }
  })

  const kpiClass = d.pct >= 50 ? 'ok' : d.total > 0 ? 'warn' : 'bad'
  const parts = []
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
  return parts.join('')
}

// ── Informe de cierre de campaña ───────────────────────────────────────────
// Resultado final + evolución del total corte a corte + ranking completo +
// destacados. Con porSede, agrega un anexo con la ficha de cada sede en su
// propia hoja (para mandarle a cada una su resultado).
export function generarInformeCierre({ camp, data, historial, porSede = false, onToast = () => {} }) {
  const campNombre = camp?.nombre || ''
  const fecha = data[0]?.fecha || new Date().toISOString().slice(0, 10)
  const cerrada = camp?.estado === 'cerrada'

  const totIng = data.reduce((a, d) => a + d.total, 0)
  const totObj = data.reduce((a, d) => a + d.objetivo, 0)
  const pctGlobal = totObj ? Math.round(totIng / totObj * 100) : 0
  const enObj = data.filter(d => d.pct >= 50).length
  const sinIng = data.filter(d => d.total === 0).length

  // Evolución global por corte
  const porFecha = {}
  historial.forEach(r => {
    if (!porFecha[r.fecha]) porFecha[r.fecha] = { total: 0, obj: 0 }
    porFecha[r.fecha].total += Number(r.total) || 0
    porFecha[r.fecha].obj += Number(r.objetivo) || 0
  })
  const fechas = Object.keys(porFecha).sort()
  const evol = fechas.map(f => ({ fecha: f, total: porFecha[f].total, pct: porFecha[f].obj ? Math.round(porFecha[f].total / porFecha[f].obj * 100) : 0 }))

  let evolSvg = ''
  if (evol.length >= 2) {
    const W = 640, H = 170, mx = Math.max(100, ...evol.map(e => e.pct))
    const step = (W - 40) / evol.length
    const bW = Math.max(10, Math.min(40, step - 6))
    const barras = evol.map((e, i) => {
      const bH = Math.max(2, Math.round(e.pct / mx * (H - 40)))
      const x = 20 + i * step + (step - bW) / 2
      const col = e.pct >= 50 ? '#0F8A5F' : e.pct > 0 ? '#C98A0B' : '#C8102E'
      return `<rect x="${x}" y="${H - 22 - bH}" width="${bW}" height="${bH}" rx="2" fill="${col}"/>
        <text x="${x + bW / 2}" y="${H - 26 - bH}" text-anchor="middle" font-size="9" font-weight="700" fill="#374151">${e.pct}%</text>
        <text x="${x + bW / 2}" y="${H - 8}" text-anchor="middle" font-size="8" fill="#6b7280">${fmtFecha(e.fecha).slice(0, 5)}</text>`
    }).join('')
    const y50 = H - 22 - Math.round(50 / mx * (H - 40))
    evolSvg = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">${barras}
      <line x1="20" y1="${y50}" x2="${W - 20}" y2="${y50}" stroke="#C8102E" stroke-width="1" stroke-dasharray="4,3" opacity=".7"/>
      <text x="${W - 18}" y="${y50 + 3}" font-size="8" fill="#C8102E">50%</text></svg>`
  }

  // Crecimiento de cada sede desde su primer corte
  const primerTotal = {}
  ;[...historial].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach(r => {
    const cod = String(r.cod_sede)
    if (primerTotal[cod] === undefined) primerTotal[cod] = Number(r.total) || 0
  })
  const crec = (d) => d.total - (primerTotal[String(d.cod_sede)] ?? d.total)
  const corto = (n) => n.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')

  const ranking = [...data].sort((a, b) => b.pct - a.pct || b.total - a.total)
  const filas = ranking.map((d, i) => {
    const tag = d.pct >= 50 ? '<span class="tag-ok">En objetivo</span>' : d.total > 0 ? '<span class="tag-w">En progreso</span>' : '<span class="tag-bad">Sin ingresos</span>'
    const c = crec(d)
    return `<tr><td style="text-align:center;font-weight:700">${i + 1}</td><td>${corto(d.sede)}</td>
      <td style="text-align:center">${d.objetivo}</td><td style="text-align:center;font-weight:700">${d.total}</td>
      <td style="text-align:center;font-weight:700">${d.pct}%</td>
      <td style="text-align:center;color:${c > 0 ? '#16a34a' : '#9ca3af'}">${c > 0 ? '+' + c : c === 0 ? '=' : c}</td><td>${tag}</td></tr>`
  }).join('')

  const topCrec = [...data].filter(d => crec(d) > 0).sort((a, b) => crec(b) - crec(a)).slice(0, 5)
  const bajo = ranking.filter(d => d.pct < 50)

  const parts = []
  parts.push(headerPDF(fecha, campNombre, cerrada ? 'Informe de cierre de campaña' : 'Informe de campaña (parcial)'))
  parts.push(`<div class="sede-title"><h2>${campNombre}</h2><p>${camp?.inicio ? 'Inicio ' + fmtFecha(camp.inicio) + ' · ' : ''}Último corte ${fmtFecha(fecha)}${camp?.fecha_cierre ? ' · Cerrada el ' + fmtFecha(camp.fecha_cierre) : ''} · ${fechas.length} cortes</p></div>`)
  parts.push('<div class="kpi-grid">')
  parts.push(`<div class="kpi ${pctGlobal >= 50 ? 'ok' : 'warn'}"><div class="n">${pctGlobal}%</div><div class="l">Cumplimiento global</div></div>`)
  parts.push(`<div class="kpi bl"><div class="n">${totIng}</div><div class="l">Inscriptos de ${totObj}</div></div>`)
  parts.push(`<div class="kpi ok"><div class="n">${enObj}/${data.length}</div><div class="l">Sedes en objetivo</div></div>`)
  parts.push(`<div class="kpi ${sinIng ? 'bad' : 'ok'}"><div class="n">${sinIng}</div><div class="l">Sedes sin ingresos</div></div>`)
  parts.push('</div>')
  if (evolSvg) { parts.push('<h3>Evolución del cumplimiento por corte</h3>'); parts.push(evolSvg) }
  if (topCrec.length) {
    parts.push('<h3>Mayor crecimiento en la campaña</h3><table><tr><th>Sede</th><th>Primer corte</th><th>Final</th><th>Crecimiento</th></tr>')
    topCrec.forEach(d => parts.push(`<tr><td>${corto(d.sede)}</td><td style="text-align:center">${primerTotal[String(d.cod_sede)]}</td><td style="text-align:center;font-weight:700">${d.total}</td><td style="text-align:center;font-weight:700;color:#16a34a">+${crec(d)}</td></tr>`))
    parts.push('</table>')
  }
  if (bajo.length) {
    parts.push(`<div class="alert"><strong>${bajo.length} sedes</strong> cerraron por debajo del 50%: ${bajo.map(d => corto(d.sede) + ' (' + d.pct + '%)').join(', ')}.</div>`)
  }
  parts.push('<h3>Ranking final</h3>')
  parts.push(`<table><tr><th>#</th><th>Sede</th><th>Objetivo</th><th>Inscriptos</th><th>Cumpl.</th><th>Crec.</th><th>Estado</th></tr>${filas}
    <tr><td></td><td style="font-weight:700">TOTAL</td><td style="text-align:center;font-weight:700">${totObj}</td><td style="text-align:center;font-weight:700">${totIng}</td><td style="text-align:center;font-weight:700">${pctGlobal}%</td><td></td><td></td></tr></table>`)

  if (porSede) {
    const histAgrupado = {}
    historial.forEach(r => {
      if (!histAgrupado[r.fecha]) histAgrupado[r.fecha] = {}
      histAgrupado[r.fecha][String(r.cod_sede)] = Number(r.total) || 0
    })
    ;[...data].sort((a, b) => a.sede.localeCompare(b.sede)).forEach(d => {
      parts.push('<div class="salto"></div>')
      parts.push(cuerpoSede(d, histAgrupado, campNombre, true))
    })
  }

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
    const col = pct >= 50 ? '#0F8A5F' : d.total > 0 ? '#C98A0B' : '#C8102E'
    let lbl = d.sede.replace(/ - BUENOS AIRES$/, '').replace(/ - BS AS$/, '')
    if (lbl.length > 26) lbl = lbl.slice(0, 25) + '...'
    return `<rect x="${LBL_W}" y="${y}" width="${BAR_MAX}" height="${BAR_H}" rx="3" fill="#f1f5f9"/>
      <rect x="${LBL_W}" y="${y}" width="${bW}" height="${BAR_H}" rx="3" fill="${col}"/>
      <text x="${LBL_W - 6}" y="${y + BAR_H / 2 + 5}" text-anchor="end" font-size="11" font-family="Archivo, Arial" fill="#374151">${lbl}</text>
      <text x="${LBL_W + bW + 6}" y="${y + BAR_H / 2 + 5}" font-size="11" font-family="Archivo, Arial" font-weight="700" fill="${col}">${pct}% (${d.total}/${d.objetivo})</text>`
  }).join('')
  const x50 = LBL_W + Math.round(0.5 * BAR_MAX)
  svgBars += `<line x1="${x50}" y1="0" x2="${x50}" y2="${SVG_H}" stroke="#C8102E" stroke-width="1" stroke-dasharray="3,3" opacity=".6"/>
    <text x="${x50}" y="${SVG_H + 4}" text-anchor="middle" font-size="9" fill="#C8102E" font-family="Archivo, Arial">50%</text>`
  const svgChart = `<svg width="100%" viewBox="0 0 ${SVG_W} ${SVG_H + 10}" style="display:block">${svgBars}</svg>`

  const filas = sedes.map(d => {
    const ps = d.pct + '%'
    const col = d.pct >= 50 ? '#16a34a' : d.total > 0 ? '#d97706' : '#be123c'
    const estado = d.pct >= 50 ? 'En objetivo' : d.total > 0 ? 'En progreso' : 'Sin ingresos'
    const varTxt = d.var === null ? '—' : d.var > 0 ? '+' + d.var : d.var < 0 ? String(d.var) : 'Sin cambio'

    const fechas = Object.keys(historial).sort()
    const histVals = fechas.map(f => historial[f][String(d.cod_sede)]).filter(v => v !== undefined)
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
  parts.push(`<p style="font-size:11px;color:#6b7280;margin-bottom:18px">${sedes.length} sedes analizadas al ${fmtFecha(fecha)}</p>`)
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
    const medalla = i === 0 ? 'Mejor cumplimiento' : ''
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
  const camp0 = campanas?.find(c => c.id === campanaActiva)
  const [tipo, setTipo] = useState(camp0?.estado === 'cerrada' ? 'cierre' : 'general')
  const [cierrePorSede, setCierrePorSede] = useState(false)
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
    historialAgrupado[r.fecha][String(r.cod_sede)] = Number(r.total) || 0
  })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const handleGenerar = () => {
    if (tipo === 'cierre') {
      generarInformeCierre({ camp, data, historial, porSede: cierrePorSede, onToast: showToast })
    } else if (tipo === 'general') {
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
          position: 'fixed', bottom: 20, right: 20, background: C.ink, color: '#fff', fontFamily: F.body,
          padding: '14px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600, borderLeft: `5px solid ${C.celeste}`,
          zIndex: 9999, maxWidth: 360, lineHeight: 1.45, boxShadow: '0 18px 40px -12px rgba(14,23,51,.55)',
        }}>{toast}</div>
      )}

      <button onClick={() => setOpen(true)} className="btn-press" style={{
        height: 38, padding: '0 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
        background: '#fff', color: C.navy, border: `1px solid ${C.rule}`, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" />
        </svg>
        Informes
      </button>

      {open && (
        <ModalShell onClose={() => setOpen(false)} title="Informes" sub="Se abren en una pestaña nueva, listos para imprimir o guardar como PDF" maxWidth={500}>
          <div style={{ overflow: 'auto' }}>
            <div style={{ padding: 20 }}>
              {/* Tipo de informe */}
              <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 10, fontFamily: F.body }}>¿Qué informe necesitás?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[
                  ['cierre', camp?.estado === 'cerrada' ? 'Cierre de la campaña' : 'La campaña hasta hoy', 'Resultado, evolución, ranking completo y destacados'],
                  ['general', 'Estado del corte', 'Todas las sedes con su número de este corte, agrupadas por estado'],
                  ['sede', 'Una sede', 'La ficha de una sede con su evolución, para mandársela'],
                  ['comparacion', 'Comparación de sedes', sedesSeleccionadas.length ? `${sedesSeleccionadas.length} sedes elegidas en Historial` : 'Primero elegí las sedes en Historial → Comparar sedes'],
                ].map(([val, label, desc]) => (
                  <label key={val} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    border: `2px solid ${tipo === val ? C.navy : C.rule}`,
                    borderRadius: 10, cursor: 'pointer', fontFamily: F.body,
                    background: tipo === val ? C.celesteSoft : '#fff',
                  }}>
                    <input type="radio" name="tipo-informe" checked={tipo === val} onChange={() => setTipo(val)} style={{ marginTop: 3, accentColor: C.navy }} />
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Selector de sede si aplica */}
              {tipo === 'sede' && (
                <div style={{ marginBottom: 16 }}>
                  <select value={sedeElegida} onChange={e => setSedeElegida(e.target.value)} aria-label="Sede" style={{
                    width: '100%', height: 42, padding: '0 12px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 14, fontFamily: F.body, background: '#fff',
                  }}>
                    <option value="">Elegí la sede…</option>
                    {data.map(d => (
                      <option key={d.cod_sede} value={d.cod_sede}>{d.sede}</option>
                    ))}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: C.inkSoft, fontFamily: F.body }}>
                    <input type="checkbox" checked={conHist} onChange={e => setConHist(e.target.checked)} style={{ accentColor: C.navy }} />
                    Con el gráfico y el detalle de cada corte
                  </label>
                </div>
              )}

              {tipo === 'cierre' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: C.inkSoft, fontFamily: F.body }}>
                  <input type="checkbox" checked={cierrePorSede} onChange={e => setCierrePorSede(e.target.checked)} style={{ accentColor: C.navy }} />
                  Sumar una hoja por sede (la ficha de cada una)
                </label>
              )}

              {tipo === 'comparacion' && sedesSeleccionadas.length === 0 && (
                <div style={{ fontSize: 13, color: '#6B4A00', marginBottom: 16, background: '#FBF3E2', padding: '10px 12px', borderRadius: 8, fontFamily: F.body }}>
                  Para este informe, primero elegí las sedes en Historial → Comparar sedes.
                </div>
              )}

              <button onClick={handleGenerar} className="btn-press" disabled={tipo === 'comparacion' && !sedesSeleccionadas.length} style={{
                width: '100%', height: 46, borderRadius: 10, fontSize: 15, fontWeight: 800,
                background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: F.body,
                opacity: tipo === 'comparacion' && !sedesSeleccionadas.length ? 0.45 : 1,
              }}>
                Abrir el informe para imprimir
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
