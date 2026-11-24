// Informe semanal para la jefa de Cele — la lógica, sin React ni Word.
// Estructura fija (la que pidió la jefa):
//   1. Cómo vamos por sede: objetivo, % y total del último corte ≤ viernes
//   2. Auditorías comerciales  (sede · resultado · acciones de mejora)
//   3. Reuniones               (sede fecha hora · motivo · resultado)
//   4. Observaciones           (dd/mm – tema: texto; "Durante la semana" al final)
// Los números salen de los cortes; las secciones 2 a 4, de la pestaña
// 'bitacora' de la planilla (lo que Cele anota en la semana).

import { nombreCorto } from './formato.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ── Fechas (siempre 'yyyy-mm-dd', al mediodía para no cruzar husos) ────────
const aDate = (iso) => new Date(iso + 'T12:00:00Z')
const aIso = (d) => d.toISOString().slice(0, 10)
export function sumarDias(iso, n) { const d = aDate(iso); d.setUTCDate(d.getUTCDate() + n); return aIso(d) }

// Semana laboral que contiene la fecha: lunes a viernes (domingo = fin de la
// semana anterior, sábado = fin de la misma)
export function semanaDe(iso) {
  const dow = aDate(iso).getUTCDay() // 0 dom … 6 sáb
  const lunes = sumarDias(iso, -((dow + 6) % 7))
  return { lunes, viernes: sumarDias(lunes, 4), domingo: sumarDias(lunes, 6) }
}

// "10 al 14 de agosto de 2026" · "31 de agosto al 4 de septiembre de 2026"
export function etiquetaSemana({ lunes, viernes }) {
  const [a1, m1, d1] = lunes.split('-').map(Number)
  const [a2, m2, d2] = viernes.split('-').map(Number)
  if (a1 !== a2) return `${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`
  if (m1 !== m2) return `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a2}`
  return `${d1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`
}

// '2026-08-14' → '14/8/26' (encabezado de la columna del corte, como el modelo)
export const fechaColumna = (iso) => { const [a, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}/${a.slice(2)}` }
// '2026-08-12' → '12/08'
export const ddmm = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : '' }

const normCod = (c) => String(c ?? '').trim().replace(/^0+(?=\d)/, '')
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

// "GONZALEZ CATÁN - BS AS" → "Gonzalez Catán"; "DELEGACIÓN SAN MIGUEL" → "San Miguel"
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y'])
export function nombrePropio(n) {
  return nombreCorto(n).replace(/^DELEGACI[OÓ]N\s+/i, '').replace(/\s+Modo\s+\d+$/i, '')
    .toLowerCase().split(/(\s+|-)/).map((w, i) =>
      (i > 0 && MINUSCULAS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
    .replace(/\bCem\b/, 'CEM')
}

// ── 1. Cómo vamos por sede ──────────────────────────────────────────────────
// Corte del informe: el más reciente con fecha ≤ viernes de la semana.
export function corteDeLaSemana(historial, semana) {
  const fechas = [...new Set((historial || []).map(r => String(r.fecha).slice(0, 10)))].sort()
  const previas = fechas.filter(f => f <= semana.viernes)
  const fecha = previas[previas.length - 1] || null
  return { fecha, deEstaSemana: !!fecha && fecha >= semana.lunes }
}

// Filas de la tabla: las sedes activas (data, con sus objetivos vigentes) y
// el total de cada una en ese corte. Avisa las que no aparecen en el corte.
export function tablaComoVamos(data, historial, fechaCorte) {
  const enCorte = {}, nombreEnCorte = {}
  ;(historial || []).forEach(r => {
    if (String(r.fecha).slice(0, 10) !== fechaCorte) return
    enCorte[normCod(r.cod_sede)] = Number(r.total) || 0
    nombreEnCorte[normCod(r.cod_sede)] = r.sede || r.cod_sede
  })
  const faltan = []
  const filas = (data || []).map(d => {
    const cod = normCod(d.cod_sede)
    const objetivo = Number(d.objetivo) || 0
    const esta = cod in enCorte
    if (!esta) faltan.push(d.sede)
    const total = esta ? enCorte[cod] : 0
    return { cod, sede: String(d.sede || ''), objetivo, total, pct: porcentaje(total, objetivo) }
  }).sort((a, b) => Number(a.cod) - Number(b.cod) || a.cod.localeCompare(b.cod))
  // Sedes que están en el corte pero no entre las activas (se desactivaron):
  // no se suman, pero se avisan con su número para que nada quede afuera sin verlo
  const activas = new Set(filas.map(f => f.cod))
  const fueraDeLista = Object.keys(enCorte).filter(c => !activas.has(c))
    .map(c => ({ cod: c, sede: String(nombreEnCorte[c]), total: enCorte[c] }))
  const objetivo = filas.reduce((s, f) => s + f.objetivo, 0)
  const total = filas.reduce((s, f) => s + f.total, 0)
  return { filas, faltan, fueraDeLista, totales: { objetivo, total, pct: porcentaje(total, objetivo) } }
}

// Entero exacto: total*100/objetivo (total/objetivo*100 arrastra error de
// coma flotante: 23/40 daba 57% en vez de 58%)
export const porcentaje = (total, objetivo) => objetivo > 0 ? Math.round(total * 100 / objetivo) : null

export const fmtPct = (p) => p === null || p === undefined ? '—' : `${p}%`

// ── 2–4. Anotaciones de la bitácora ─────────────────────────────────────────
// Notas → viñetas: un renglón por viñeta; si es un solo renglón con ";",
// se corta por ahí. Se sacan los guiones/viñetas que haya puesto a mano.
export function aVinetas(texto) {
  const t = String(texto || '').replace(/\r/g, '').trim()
  if (!t) return []
  let partes = t.split('\n')
  if (partes.length === 1 && t.includes(';')) partes = t.split(';')
  return partes.map(p => p.replace(/^\s*(?:[-–•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean)
}

// Título de una anotación: si es una sede conocida, su nombre prolijo; si
// no, el tema tal cual lo escribió Cele.
export function tituloAnotacion(sedeTexto, sedes) {
  const t = String(sedeTexto || '').trim()
  if (!t) return ''
  const clave = sinTildes(t)
  const sede = (sedes || []).find(s => {
    const n = sinTildes(s.sede)
    return n === clave || sinTildes(nombreCorto(s.sede)) === clave || normCod(s.cod_sede) === normCod(t)
  })
  return sede ? nombrePropio(sede.sede) : t
}

const TIPOS = new Set(['reunion', 'auditoria', 'observacion', 'semana'])

// Texto "tal cual" de una anotación, en el formato del informe (sin IA)
export function redaccionBase(it) {
  // Ninguna columna con texto se descarta: en una reunión, las acciones de
  // mejora se suman al resultado; en una auditoría, el motivo va primero.
  if (it.tipo === 'reunion') return { motivo: aVinetas(it.motivo), resultado: [...aVinetas(it.resultado), ...aVinetas(it.acciones)] }
  if (it.tipo === 'auditoria') return { resultado: [...aVinetas(it.motivo), ...aVinetas(it.resultado)], acciones: aVinetas(it.acciones) }
  const texto = [it.motivo, it.resultado, it.acciones].map(s => String(s || '').trim()).filter(Boolean).join(' ')
  return { texto }
}

// Huella de las notas: si Cele cambia la planilla después de redactar, la
// app se da cuenta y no reusa una redacción vieja.
export function huellaNotas(items) {
  return huella(JSON.stringify((items || []).map(i => [i.id, i.fecha, i.tipo, i.sede, i.hora, i.motivo, i.resultado, i.acciones])))
}
export const huellaItem = (i) => huella(JSON.stringify([i.fecha, i.tipo, i.sede, i.hora, i.motivo, i.resultado, i.acciones]))
function huella(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h >>> 0)
}

// Avisos sobre las anotaciones: nada se descarta en silencio.
export function avisosNotas(items, sinFecha) {
  const av = []
  ;(items || []).forEach(it => {
    if (!TIPOS.has(it.tipo)) av.push(`Fila ${it.fila}: el tipo "${it.tipoOriginal || '(vacío)'}" no es Reunión, Auditoría, Observación ni Toda la semana. Va a Observaciones.`)
    if (it.tipo === 'reunion' && !it.sede) av.push(`Fila ${it.fila}: reunión sin sede.`)
    if (it.tipo === 'auditoria' && !it.sede) av.push(`Fila ${it.fila}: auditoría sin sede.`)
  })
  ;(sinFecha || []).forEach(it => av.push(it.fecha
    ? `Fila ${it.fila}: la fecha ${it.fecha.split('-').reverse().join('/')} parece mal tipeada (año ${it.fecha.slice(0, 4)}), no entra en ninguna semana${it.sede ? ` (${it.sede})` : ''}.`
    : `Fila ${it.fila}: no tiene fecha válida, no entra en ninguna semana${it.sede ? ` (${it.sede})` : ''}.`))
  return av
}

// Arma el informe completo a partir del corte, las notas y su redacción
// (redaccion[id] = { motivo, resultado, acciones, texto }).
export function armarInforme({ semana, campanaNombre, tabla, fechaCorte, items, redaccion, sedes }) {
  const red = (it) => redaccion?.[it.id] || redaccionBase(it)
  const tipo = (it) => TIPOS.has(it.tipo) ? it.tipo : 'observacion'
  const auditorias = items.filter(it => tipo(it) === 'auditoria').map(it => ({
    id: it.id, sede: tituloAnotacion(it.sede, sedes), resultado: red(it).resultado || [], acciones: red(it).acciones || [],
  }))
  const reuniones = items.filter(it => tipo(it) === 'reunion').map(it => ({
    id: it.id,
    sede: [tituloAnotacion(it.sede, sedes), ddmm(it.fecha), it.hora ? `${it.hora} HS` : ''].filter(Boolean).join(' '),
    motivo: red(it).motivo || [], resultado: red(it).resultado || [],
  }))
  const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)
  const obs = items.filter(it => tipo(it) === 'observacion').sort(porFecha).map(it => ({
    id: it.id, cuando: [ddmm(it.fecha), it.hora ? `${it.hora} HS` : ''].filter(Boolean).join(' '), titulo: tituloAnotacion(it.sede, sedes), texto: red(it).texto || '',
  }))
  const semanaEntera = items.filter(it => tipo(it) === 'semana').map(it => ({
    id: it.id, cuando: 'Durante la semana', titulo: tituloAnotacion(it.sede, sedes), texto: red(it).texto || '',
  }))
  return {
    titulo: 'INFORME SEMANAL - ZONA BUENOS AIRES',
    periodo: etiquetaSemana(semana),
    columnaObjetivo: `Objetivo ${campanaNombre || ''}`.trim(),
    columnaCorte: fechaCorte ? fechaColumna(fechaCorte) : '',
    tabla, auditorias, reuniones, observaciones: [...obs, ...semanaEntera],
  }
}

// "13/08 – Avellaneda:" · "14/08:" · "Durante la semana:"
export function encabezadoObservacion(o) {
  return o.titulo ? `${o.cuando} – ${o.titulo}:` : `${o.cuando}:`
}

export function nombreArchivo(inf) {
  return `Informe semanal Zona Buenos Aires ${inf.periodo}`.replace(/[\\/:*?"<>|]/g, '-')
}

// Control de lo que devuelve Claude: nada que estaba en la nota puede quedar
// vacío, y las cifras y horas tienen que ser las mismas (ni cambiadas ni
// inventadas). Devuelve el motivo para revisar, o null si está bien.
const numeros = (s) => (String(s || '').match(/\d+(?:[.,:]\d+)?/g) || []).map(n => n.replace(',', '.')).sort()
export function controlarRedaccion(entrada, salida) {
  const textoIn = [entrada.motivo, entrada.resultado, entrada.acciones].join(' ')
  const textoOut = [salida.motivo, salida.resultado, salida.acciones, salida.texto].flat().join(' ')
  if (textoIn.trim() && !textoOut.trim()) return 'Claude la devolvió vacía'
  if (entrada.tipo === 'reunion' && String(entrada.motivo || '').trim() && !(salida.motivo || []).length) return 'Claude dejó el motivo vacío'
  if (entrada.tipo === 'reunion' && String(entrada.resultado || '').trim() && !(salida.resultado || []).length) return 'Claude dejó el resultado vacío'
  if (entrada.tipo === 'auditoria' && String(entrada.acciones || '').trim() && !(salida.acciones || []).length) return 'Claude dejó las acciones vacías'
  const a = numeros(textoIn), b = numeros(textoOut)
  if (a.join('|') !== b.join('|')) return `cambiaron las cifras u horas (nota: ${a.join(', ') || 'ninguna'} · Claude: ${b.join(', ') || 'ninguna'})`
  return null
}

// ── Redacción con Claude por copiar y pegar (sin API, con la suscripción) ───
// La app arma el pedido completo; Cele lo pega en claude.ai (o ChatGPT),
// copia la respuesta y la app la reparte en cada anotación.
const REGLAS_REDACCION = [
  'Sos el asistente de la Coordinación Zonal Buenos Aires de UCASAL (universidad). Redactá las anotaciones de la coordinadora para el informe semanal que lee su jefa.',
  '',
  'Reglas que no se negocian:',
  '- No agregues hechos, nombres, cifras, fechas, compromisos ni conclusiones que no estén en la nota. Si algo es ambiguo, dejalo tal cual en lugar de interpretarlo.',
  '- No omitas nada de lo anotado: cada dato de la nota tiene que aparecer en tu versión.',
  '- Respetá exactamente nombres propios, sedes, cifras, horarios y siglas.',
  '- Corregí ortografía, puntuación y redacción. Español rioplatense profesional, claro, sin frases vacías ni adjetivos de relleno.',
  '',
  'Estilo:',
  '- motivo (reuniones): temas tratados como frases nominales cortas, una por viñeta, con mayúscula inicial y punto final. Ej.: "Participación en ferias y expos educativas."',
  '- resultado (reuniones) y resultado/acciones (auditorías): una viñeta por acuerdo o acción, en impersonal y pasado. Ej.: "Se acordó retomar con mayor continuidad el planner de publicaciones."',
  '- texto (observaciones y "semana"): una o dos oraciones que empiezan en minúscula (van después de "Sede:"), en sustantivo o impersonal. Ej.: "confección del banner institucional y de los dos modelos de folletería personalizados para la sede. El material ya fue enviado a imprenta."',
  '',
  'Usá solo los campos que corresponden al tipo: reunion → motivo y resultado; auditoria → resultado y acciones; observacion o semana → texto.',
  'Incluí TODOS los id que recibís, sin cambiarlos.',
  'Respondé ÚNICAMENTE con un bloque de código JSON, sin comentarios, con esta forma:',
  '{"items":[{"id":"f2","motivo":["..."],"resultado":["..."],"acciones":["..."],"texto":"..."}]}',
].join('\n')

// entradas: [{ id, tipo, sede, motivo, resultado, acciones }]
export function pedidoParaClaude(entradas) {
  const datos = entradas.map(e => ({
    id: e.id, tipo: e.tipo, sede_o_tema: e.sede || '',
    motivo: e.motivo || '', resultado: e.resultado || '', acciones: e.acciones || '',
  }))
  return `${REGLAS_REDACCION}\n\nAnotaciones de la semana:\n${JSON.stringify({ items: datos }, null, 1)}`
}

// Lee la respuesta pegada: acepta el bloque de código con o sin ```json, o
// con texto alrededor. Devuelve un ítem por id esperado (faltante si no vino).
export function leerRespuestaClaude(texto, idsEsperados) {
  const t = String(texto || '').replace(/```(?:json)?/gi, '')
  const a = t.indexOf('{'), z = t.lastIndexOf('}')
  if (a === -1 || z <= a) throw new Error('No encuentro el bloque de respuesta. Copiá la respuesta completa de Claude (el bloque de código) y pegala acá.')
  let parsed
  try { parsed = JSON.parse(t.slice(a, z + 1)) }
  catch { throw new Error('La respuesta está incompleta o cortada. Copiala de nuevo entera (el botón de copiar del bloque de código).') }
  const lista = Array.isArray(parsed) ? parsed : parsed.items
  if (!Array.isArray(lista)) throw new Error('La respuesta no tiene el formato esperado. Volvé a copiar el pedido y pegáselo a Claude tal cual.')
  const porId = {}
  lista.forEach(x => { if (x && x.id != null) porId[String(x.id)] = x })
  const aLista = (v) => Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : (v ? [String(v).trim()] : [])
  const items = idsEsperados.map(id => {
    const x = porId[String(id)]
    if (!x) return { id, faltante: true }
    return { id, motivo: aLista(x.motivo), resultado: aLista(x.resultado), acciones: aLista(x.acciones), texto: String(x.texto || '').trim() }
  })
  const desconocidos = Object.keys(porId).filter(id => !idsEsperados.includes(id))
  if (!items.some(i => !i.faltante)) throw new Error('Ninguna anotación de la respuesta coincide con las de esta semana. ¿Es la respuesta al pedido de esta semana?')
  return { items, desconocidos }
}
