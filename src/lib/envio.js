// ════════════════════════════════════════════════════════════════════════
// Lógica pura del envío de mails (sin React ni red)
// ════════════════════════════════════════════════════════════════════════
// El HTML de cada mail, a qué direcciones va, cómo se arma una tanda, el
// cotejo contra log_envios y el agrupado del "Registro de envíos". Funciones
// puras para poder probarlas en Node: ver scripts/probar-envio.mjs.
import { fmtFecha, estadoSede, direccionesDe } from './formato.js'

// Escapa texto que viene de Sheets (editable por varias personas) antes de
// insertarlo en el HTML que se renderiza con dangerouslySetInnerHTML.
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// Plantilla por defecto — se usa si todavía no se cargó/guardó una propia
// desde el editor. Coincide con el texto que mandaba la app antes de que la
// plantilla fuera editable, para no cambiar nada sin que alguien lo pida.
export const DEFAULT_TEMPLATE = `<p>{{saludo}}:</p>
<p style="margin-top:6px">Enviamos el resultado del <strong>cómo vamos</strong> al {{fecha}}</p>
{{tabla}}
<p style="margin-top:8px">Quedamos a disposición para cualquier consulta o duda que puedas tener.</p>
<p style="margin-top:10px">Feliz fin de semana.<br>Saludos!</p>`

export function renderTemplate(template, vars) {
  return String(template ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export function buildTablaHTML(d, campNombre) {
  const color = { ok: '#0F8A5F', prog: '#A8752A', cero: '#C8102E' }[estadoSede(d)]
  const varTxt = d.var !== null
    ? (d.var > 0 ? ` (+${d.var} vs semana anterior)`
      : d.var < 0 ? ` (${d.var} vs semana anterior)`
      : ' (sin variación)')
    : ''
  return `<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px">
  <tr style="background:#0E1733;color:#fff">
    <th style="padding:7px 10px;text-align:center;font-size:11px">COD SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">OBJETIVO ${campNombre.toUpperCase()}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">TOTAL AL ${fmtFecha(d.fecha)}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">% CUMPLIMIENTO</th>
  </tr>
  <tr>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.cod_sede}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${esc(d.sede)}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.objetivo}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.total}${varTxt}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb;color:${color};font-weight:700">${d.pct}%</td>
  </tr>
</table>`
}

// Firma de Cele al pie de cada mail a las sedes. Va como imagen alojada en
// la propia web (public/ → GitHub Pages) porque Gmail no muestra imágenes
// embebidas en base64. Si se cambia la imagen, subirla con otro nombre
// (-v2, -v3…): Gmail la guarda en caché por URL.
// v1 (firma vieja, Delegación Bahía Blanca) queda publicada para que los mails
// ya enviados la sigan mostrando.
export const FIRMA_URL = 'https://martinsangui-art.github.io/gestioncomercialMCR/firma-cele-v2.jpg'
export const FIRMA_HTML = `<p style="margin-top:18px"><img src="${FIRMA_URL}" width="600" alt="Ing. María Celeste Rossi · Coordinación Nacional de Sedes – Coordinadora Zonal Bs. As. · Dirección Operativa SEAD | Vicerrectorado Académico · UCASAL · mcrossi@ucasal.edu.ar" style="display:block;width:600px;max-width:100%;height:auto;border:0"></p>`

export function buildEmailHTML(d, campNombre, template) {
  return renderTemplate(template || DEFAULT_TEMPLATE, {
    saludo: esc(d.saludo),
    fecha: fmtFecha(d.fecha),
    tabla: buildTablaHTML(d, campNombre),
  }) + '\n' + FIRMA_HTML
}

// Cada dirección de una sede recibe su propio mail (Make no acepta varias
// en "To"). `dirEnviadas` es {cod: ['a@x', ...]} (en minúscula): las que ya
// recibieron este corte.
export function yaRecibieron(d, dirEnviadas = {}) {
  const ya = dirEnviadas[String(d.cod_sede)] || []
  return direccionesDe(d.email).filter(a => ya.includes(a.toLowerCase()))
}

// Al mandar una sede pendiente sale solo a las direcciones que todavía no
// recibieron este corte: si a Morón se le agrega un mail, tocar Morón le
// manda solo al nuevo. Si ya las recibieron todas, es un reenvío (todas).
export function destinosDe(d, dirEnviadas = {}) {
  const todas = direccionesDe(d.email)
  const ya = yaRecibieron(d, dirEnviadas).map(a => a.toLowerCase())
  const faltan = todas.filter(a => !ya.includes(a.toLowerCase()))
  return faltan.length ? faltan : todas
}

// Una sede sin objetivo en la campaña entra al corte con 0% y no recibe el
// mail (un "0 de 0" no le sirve a nadie y confunde).
export const sinObjetivo = (d) => Number(d?.objetivo) === 0

// Plan de una tanda: una entrada por cada sede de la lista, en el mismo orden.
//   'enviar'       → se manda
//   'repetida'     → ya estaba antes en esta tanda: sale una sola vez (el 03/08
//                    Trenque Lauquen salió duplicado)
//   'sin_objetivo' → objetivo 0 en la campaña: no se manda
//   'sin_email'    → no tiene email cargado: se saltea
export function planDeTanda(lista) {
  const vistas = new Set()
  return (lista || []).map(d => {
    const cod = String(d.cod_sede)
    if (vistas.has(cod)) return { d, tipo: 'repetida' }
    vistas.add(cod)
    if (sinObjetivo(d)) return { d, tipo: 'sin_objetivo' }
    if (!String(d.email || '').trim()) return { d, tipo: 'sin_email' }
    return { d, tipo: 'enviar' }
  })
}

// Cotejo contra log_envios: el Set de 'cod|email' (email en minúscula) que
// figuran como 'enviado' para la campaña desde la fecha `desde` (r.fecha es
// el día de ENVÍO). El resumen a Cele ([RESUMEN]) no es el mail de una sede.
// Si la fila dice de qué corte es (fecha_corte, filas nuevas), cuenta solo si
// es `fechaCorte`; las filas viejas, sin esa columna, siguen la regla de antes.
export function registradasEnLog(log, { desde, campNom, fechaCorte } = {}) {
  const registradas = new Set()
  const delCorte = (r) => {
    const fc = String(r.fecha_corte ?? '').trim()
    return !fechaCorte || !fc || fc.slice(0, 10) === String(fechaCorte).slice(0, 10)
  }
  ;(log || [])
    .filter(r => String(r.fecha).slice(0, 10) >= String(desde).slice(0, 10) &&
                 r.estado === 'enviado' &&
                 String(r.sede ?? '') !== '[RESUMEN]' && String(r.cod_sede ?? '') !== '' &&
                 (!campNom || String(r.campana || '').indexOf(campNom) >= 0) &&
                 delCorte(r))
    .forEach(r => direccionesDe(r.email).forEach(a => registradas.add(String(r.cod_sede) + '|' + a.toLowerCase())))
  return registradas
}

// "Registro de envíos": una tanda = filas consecutivas (por fecha y hora) con
// menos de 2 minutos entre una y la siguiente. Antes se agrupaba por minuto
// exacto y una tanda que duraba 3 minutos aparecía partida en tres.
// El resumen a Cele ([RESUMEN]) no cuenta como mail de una sede: va aparte.
// `minutos` son los fecha + hh:mm de la tanda, para confirmarla entera
// (confirmar_envio_lote marca un minuto por vez). Lo más nuevo primero.
const MAX_PAUSA_TANDA_MS = 2 * 60 * 1000
const instante = (r) => {
  const [hh = '', mm = '00', ss = '00'] = String(r.hora ?? '').trim().split(':')
  const p = (x) => String(x).padStart(2, '0')
  return /^\d{1,2}$/.test(hh) ? Date.parse(`${String(r.fecha).slice(0, 10)}T${p(hh)}:${p(mm)}:${p(ss)}`) : NaN
}
const esConfirmado = (r) => String(r.confirmado ?? '').toUpperCase() === 'TRUE'
export function agruparRegistro(log) {
  const filas = (log || []).map(r => ({ r, t: instante(r) }))
    .sort((a, b) => (a.t - b.t) || `${a.r.fecha} ${a.r.hora}`.localeCompare(`${b.r.fecha} ${b.r.hora}`))
  const bloques = []
  let actual = null, tPrevio = NaN
  filas.forEach(({ r, t }) => {
    if (!actual || !(t - tPrevio < MAX_PAUSA_TANDA_MS)) {
      actual = { fecha: r.fecha, hora: r.hora, campana: '', items: [], resumenes: [], minutos: [] }
      bloques.push(actual)
    }
    tPrevio = t
    if (String(r.sede ?? '') === '[RESUMEN]') actual.resumenes.push(r)
    else { actual.items.push(r); if (!actual.campana) actual.campana = r.campana }
    const minuto = `${r.fecha}|${String(r.hora ?? '').slice(0, 5)}`
    if (!actual.minutos.includes(minuto)) actual.minutos.push(minuto)
  })
  bloques.forEach(b => {
    if (!b.campana) b.campana = b.resumenes[0]?.campana || ''
    b.confirmado = (b.items.length ? b.items : b.resumenes).every(esConfirmado)
    b.minutos = b.minutos.map(m => { const [fecha, hora] = m.split('|'); return { fecha, hora } })
  })
  return bloques.reverse()
}
