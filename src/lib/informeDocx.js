// Informe semanal → Word (.docx) y → PDF (vista para imprimir).
// El Word sigue la estructura del modelo de la jefa y ya lleva el logo y la
// firma: Cele lo retoca si quiere y lo guarda como PDF desde Word. El PDF
// directo sale de lo que está en la app, sin pasar por Word.

import { fmtPct, encabezadoObservacion, nombreArchivo } from './informe.js'

const FUENTE = 'Calibri'
const AMARILLO = 'FFFF00'   // encabezado y total de la tabla, como el modelo
const CELESTE = 'D9EAF7'    // encabezados de auditorías y reuniones
const ANCHO = 10092         // ancho útil A4 con márgenes de 1,6 cm (twips)

// Un salto de línea dentro de una observación va como espacio (Word lo
// ignoraría igual) — así el Word y el PDF muestran lo mismo.
const plano = (s) => String(s || '').replace(/\s*\n+\s*/g, ' ').trim()

const b64aBytes = (dataUrl) => {
  const b64 = String(dataUrl).split(',')[1] || ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function generarDocx(inf) {
  const [d, { LOGO_B64 }, { FIRMA_B64 }] = await Promise.all([
    import('docx'), import('../assets/logo.js'), import('../assets/firma.js'),
  ])
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    ImageRun, Header, ShadingType, LevelFormat, VerticalAlign, TableLayoutType, BorderStyle,
  } = d

  const run = (text, o = {}) => new TextRun({ text, font: FUENTE, size: o.size || 22, bold: o.bold, ...o })
  const par = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 0 }, ...o })
  const vineta = (text, size = 20) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 40 }, children: [run(text, { size })] })
  const celda = (children, o = {}) => new TableCell({
    children: children.length ? children : [par(run(''))],
    width: { size: o.w, type: WidthType.DXA },
    verticalAlign: o.va || VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: o.compacta ? 0 : 40, bottom: o.compacta ? 0 : 40, left: 80, right: 80 },
  })
  const tabla = (anchos, filas) => new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos, layout: TableLayoutType.FIXED, rows: filas,
  })
  const subtitulo = (t) => par(run(t, { bold: true, size: 21 }), { spacing: { before: 280, after: 120 } })

  // 1. Cómo vamos por sede
  const W1 = [900, 5150, 1400, 1150, 1100]
  const enc = (t, i, size = 22) => celda([par(run(t, { bold: true, size }), { alignment: AlignmentType.CENTER })], { w: W1[i], fill: AMARILLO })
  const filaTabla = (f) => new TableRow({ cantSplit: true, children: [
    celda([par(run(f.cod, { size: 20 }))], { w: W1[0], compacta: true }),
    celda([par(run(f.sede, { size: 19 }))], { w: W1[1], compacta: true }),
    celda([par(run(String(f.objetivo), { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })], { w: W1[2], compacta: true }),
    celda([par(run(fmtPct(f.pct), { size: 19 }), { alignment: AlignmentType.RIGHT })], { w: W1[3], compacta: true }),
    celda([par(run(String(f.total), { size: 20 }), { alignment: AlignmentType.CENTER })], { w: W1[4], compacta: true }),
  ] })
  const t = inf.tabla.totales
  const tablaSedes = tabla(W1, [
    new TableRow({ tableHeader: true, cantSplit: true, children: [
      enc('Cod Sede', 0), enc('Sede', 1), enc(inf.columnaObjetivo, 2, 20), enc('% Objetivo', 3, 20), enc(inf.columnaCorte, 4),
    ] }),
    ...inf.tabla.filas.map(filaTabla),
    new TableRow({ cantSplit: true, children: [
      celda([par(run(''))], { w: W1[0], fill: AMARILLO }),
      celda([par(run('TOTAL', { bold: true }), { alignment: AlignmentType.CENTER })], { w: W1[1], fill: AMARILLO }),
      celda([par(run(String(t.objetivo), { bold: true }), { alignment: AlignmentType.CENTER })], { w: W1[2], fill: AMARILLO }),
      celda([par(run(fmtPct(t.pct), { bold: true }), { alignment: AlignmentType.RIGHT })], { w: W1[3], fill: AMARILLO }),
      celda([par(run(String(t.total), { bold: true }), { alignment: AlignmentType.CENTER })], { w: W1[4], fill: AMARILLO }),
    ] }),
  ])

  // 2 y 3. Auditorías y reuniones: tablas de 3 columnas con viñetas
  const tabla3 = (anchos, titulos, filas) => tabla(anchos, [
    new TableRow({ tableHeader: true, cantSplit: true, children: titulos.map((x, i) =>
      celda([par(run(x, { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })], { w: anchos[i], fill: CELESTE })) }),
    ...(filas.length ? filas : [['', [], []]]).map(([sede, a, b]) => new TableRow({ children: [
      celda([par(run(sede, { bold: true, size: 20 }))], { w: anchos[0], va: VerticalAlign.TOP }),
      celda(a.map(x => vineta(x)), { w: anchos[1], va: VerticalAlign.TOP }),
      celda(b.map(x => vineta(x)), { w: anchos[2], va: VerticalAlign.TOP }),
    ] })),
  ])
  const tablaAuditorias = tabla3([2100, 3900, 4092], ['SEDE', 'RESULTADO', 'ACCIONES DE MEJORA'],
    inf.auditorias.map(a => [a.sede, a.resultado, a.acciones]))
  const tablaReuniones = tabla3([1800, 3300, 4992], ['SEDE', 'MOTIVO', 'RESULTADO'],
    inf.reuniones.map(r => [r.sede, r.motivo, r.resultado]))

  // 4. Observaciones
  const observaciones = inf.observaciones.length
    ? inf.observaciones.map(o => new Paragraph({
        numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED,
        children: [run(encabezadoObservacion(o) + ' ', { bold: true }), run(plano(o.texto))],
      }))
    : [par(run('Sin observaciones esta semana.', { italics: true, color: '5A6480' }))]

  const doc = new Document({
    creator: 'Coordinación Zonal Buenos Aires · UCASAL',
    title: `Informe semanal Zona Buenos Aires · ${inf.periodo}`,
    styles: { default: { document: { run: { font: FUENTE, size: 22 } } } },
    numbering: { config: [{ reference: 'vinetas', levels: [{
      level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 300, hanging: 220 } } },
    }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 935, right: 907, bottom: 907, left: 907, header: 400 } } },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'C8102E', space: 4 } },
        children: [new ImageRun({ type: 'jpg', data: b64aBytes(LOGO_B64), transformation: { width: 150, height: 38 } })],
      })] }) },
      children: [
        par(run(inf.titulo, { bold: true, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { before: 120 } }),
        par(run(inf.periodo), { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
        subtitulo('CÓMO VAMOS POR SEDE:'),
        tablaSedes,
        subtitulo('AUDITORÍAS COMERCIALES:'),
        tablaAuditorias,
        subtitulo('REUNIONES:'),
        tablaReuniones,
        subtitulo('OBSERVACIONES:'),
        ...observaciones,
        new Paragraph({ spacing: { before: 480 }, keepLines: true, children: [
          new ImageRun({ type: 'jpg', data: b64aBytes(FIRMA_B64), transformation: { width: 470, height: 96 } }),
        ] }),
      ],
    }],
  })
  return Packer.toBlob(doc)
}

export async function descargarDocx(inf) {
  const blob = await generarDocx(inf)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(inf) + '.docx'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// ── PDF: misma estructura, con el encabezado y la firma de los informes de la app
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const lista = (xs) => xs.length ? `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''

export function htmlInforme(inf, { headerPDF, footerPDF, fechaCorte, campNombre }) {
  const t = inf.tabla.totales
  const filas = inf.tabla.filas.map(f => `<tr><td class="c">${esc(f.cod)}</td><td>${esc(f.sede)}</td><td class="c b">${f.objetivo}</td><td class="r">${fmtPct(f.pct)}</td><td class="c">${f.total}</td></tr>`).join('')
  const tabla3 = (titulos, filas3) => `<table class="t3"><thead><tr>${titulos.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${
    filas3.length ? filas3.map(([s, a, b]) => `<tr><td class="b">${esc(s)}</td><td>${lista(a)}</td><td>${lista(b)}</td></tr>`).join('')
      : '<tr><td>&nbsp;</td><td></td><td></td></tr>'}</tbody></table>`
  const obs = inf.observaciones.length
    ? `<ul class="obs">${inf.observaciones.map(o => `<li><b>${esc(encabezadoObservacion(o))}</b> ${esc(plano(o.texto))}</li>`).join('')}</ul>`
    : '<p class="vacio">Sin observaciones esta semana.</p>'
  return headerPDF(fechaCorte, campNombre, 'Informe semanal · Zona Buenos Aires') + `
    <style>
      .periodo{font-size:15px;font-weight:800;font-stretch:108%;margin:0 0 4px}
      .sec{font-size:12.5px;font-weight:800;font-stretch:105%;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #DCE1EA;text-transform:uppercase;letter-spacing:.03em}
      .tsedes th{background:#FFF7B0;color:#0E1733}
      .tsedes td{padding:3px 8px}
      .tsedes tr.tot td{background:#FFF7B0;font-weight:800;border-top:2px solid #0E1733}
      .c{text-align:center}.r{text-align:right}.b{font-weight:700}
      .t3 th{background:#D9EAF7;color:#0E1733}
      .t3 td{vertical-align:top}
      .t3 ul,.obs{margin:0;padding-left:16px}
      .t3 li{margin-bottom:3px}
      .obs li{margin-bottom:7px;text-align:justify}
      .vacio{color:#5A6480;font-style:italic}
    </style>
    <p class="periodo">${esc(inf.periodo)}</p>
    <div class="sec">Cómo vamos por sede</div>
    <table class="tsedes"><thead><tr><th class="c">Cod</th><th>Sede</th><th class="c">${esc(inf.columnaObjetivo)}</th><th class="r">% Objetivo</th><th class="c">${esc(inf.columnaCorte)}</th></tr></thead>
      <tbody>${filas}<tr class="tot"><td></td><td>TOTAL</td><td class="c">${t.objetivo}</td><td class="r">${fmtPct(t.pct)}</td><td class="c">${t.total}</td></tr></tbody></table>
    <div class="sec">Auditorías comerciales</div>
    ${tabla3(['Sede', 'Resultado', 'Acciones de mejora'], inf.auditorias.map(a => [a.sede, a.resultado, a.acciones]))}
    <div class="sec">Reuniones</div>
    ${tabla3(['Sede', 'Motivo', 'Resultado'], inf.reuniones.map(r => [r.sede, r.motivo, r.resultado]))}
    <div class="sec">Observaciones</div>
    ${obs}
  ` + footerPDF(fechaCorte)
}
