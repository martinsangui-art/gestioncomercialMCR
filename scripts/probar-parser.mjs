// Pruebas del lector del Excel del corte (src/lib/parserCorte.js).
// Correr con:  node scripts/probar-parser.mjs
// Arma Excels en memoria que imitan los formatos reales (recortado, nacional,
// nacional por carrera, fecha ambigua, sin columna de código) y verifica que
// la app tome exactamente las sedes de la red con los totales correctos.
import XLSX from 'xlsx'
import { parseCorte } from '../src/lib/parserCorte.js'

const RED = { 22: 'PILAR', 33: 'DELEGACIÓN SAN MIGUEL', 42: 'DELEGACIÓN BAHIA BLANCA', 87: 'JUNIN', 151: 'TRENQUE LAUQUEN' }
const codigosRed = Object.keys(RED)
const OTRAS = Array.from({ length: 60 }, (_, i) => [300 + i, `SEDE ${i} - ${['SALTA', 'JUJUY', 'CÓRDOBA', 'TUCUMÁN'][i % 4]}`])

const libro = (hojas) => {
  const wb = XLSX.utils.book_new()
  hojas.forEach(([nombre, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), nombre))
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true })
}
const fecha = new Date(2026, 9, 23) // 23/10/2026 nativa

let fallas = 0
const check = (nombre, cond, detalle = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nombre}${!cond && detalle ? '  →  ' + detalle : ''}`)
  if (!cond) fallas++
}
const totalDe = (r, cod) => r.sedes.find(s => s.cod === String(cod))?.total

// 1. Formato recortado de siempre
{
  const aoa = [['Cod Sede', 'Sede', 'Objetivo', '% Objetivo', fecha],
    ...Object.entries(RED).map(([c, n], i) => [Number(c), `${n} - BUENOS AIRES`, 20, '50%', 10 + i])]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('recortado: 5 sedes', r.sedes.length === 5, r.sedes.length)
  check('recortado: fecha nativa sin ambigüedad', r.meta.fechaCorte === '2026-10-23' && !r.meta.fechaAmbigua, r.meta.fechaCorte)
  check('recortado: no es nacional', !r.meta.esNacional)
  check('recortado: total de Junín', totalDe(r, 87) === 13)
}

// 2. Nacional: títulos arriba, subtotales, total general, otra hoja de resumen
{
  const filas = [
    ['UCASAL — Cómo vamos por sede'], ['Corte semanal'], [],
    ['Región', 'Código', 'Nombre de la sede', 'Objetivo', 'Total ingresados'],
    ...Object.entries(RED).map(([c, n], i) => ['BUENOS AIRES', c, `${c}-${n} - BS AS`, 20, String(10 + i)]),
    ['', '', 'Subtotal Buenos Aires', 100, 60],
    ...OTRAS.map(([c, n]) => ['NOA', c, n, 30, 12]),
    ['', '', 'Subtotal NOA', 1800, 720],
    ['BUENOS AIRES', '999', '999-CHIVILCOY - BUENOS AIRES', 10, 2],
    ['', 'TOTAL GENERAL', '', 1910, 782],
  ]
  const resumen = [['Región', 'Total'], ['BUENOS AIRES', 60], ['NOA', 720]]
  const r = parseCorte(libro([['Resumen', resumen], ['Detalle', filas]]), XLSX, { codigosRed })
  check('nacional: elige la hoja Detalle', r.meta.hoja === 'Detalle', r.meta.hoja)
  check('nacional: solo las 5 de la red', r.sedes.length === 5, r.sedes.map(s => s.cod).join(','))
  check('nacional: detectado como nacional', r.meta.esNacional)
  check('nacional: avisa la sede nueva de Bs As (999)', r.meta.sinMatch.length === 1 && r.meta.sinMatch[0].cod === '999', JSON.stringify(r.meta.sinMatch))
  check('nacional: resume las otras provincias', r.meta.otrasIgnoradas === 60, r.meta.otrasIgnoradas)
  check('nacional: ignora subtotales y total general', r.meta.filasTotalIgnoradas === 3, r.meta.filasTotalIgnoradas)
  check('nacional: referencia del país', r.meta.pais?.pct === Math.round((60 * 12 + 2) / (60 * 30 + 10) * 100), JSON.stringify(r.meta.pais))
  check('nacional: sin fecha en el header → pide fecha', r.meta.fechaCorte === null)
  check('nacional: trae objetivo del Excel', r.sedes[0].objetivoExcel === 20)
}

// 3. Nacional desagregado por carrera: hay que sumar
{
  const filas = [['Cod Sede', 'Sede', 'Carrera', fecha]]
  Object.entries(RED).forEach(([c, n]) => ['Abogacía', 'Contador', 'Psicología'].forEach((car, j) => filas.push([c, n, car, j + 1])))
  OTRAS.forEach(([c, n]) => filas.push([c, n, 'Abogacía', 5]))
  const r = parseCorte(libro([['Datos', filas]]), XLSX, { codigosRed })
  check('por carrera: suma las filas de cada sede', totalDe(r, 42) === 6, totalDe(r, 42))
  check('por carrera: informa que sumó', r.meta.sumadas.length === 5 && r.meta.duplicados.length === 0)
}

// 4. Una corrección suelta (una sede repetida, sin columna de carrera): queda la última
{
  const aoa = [['Cod Sede', 'Sede', fecha], ...Object.entries(RED).map(([c, n]) => [c, n, 5]), [87, 'JUNIN', 9]]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('repetido suelto: se queda con la última fila', totalDe(r, 87) === 9 && r.meta.duplicados[0] === '87')
}

// 5. Fecha ambigua como texto
{
  const aoa = [['Cod Sede', 'Sede', '8/3/26'], ...Object.entries(RED).map(([c, n]) => [c, n, 1])]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('fecha texto 8/3/26 → ambigua', r.meta.fechaAmbigua === true, JSON.stringify(r.meta))
}

// 6. Sin columna de código: lo saca del nombre ("87-JUNIN - BS AS")
{
  const aoa = [['Sede', 'Inscriptos'], ...Object.entries(RED).map(([c, n], i) => [`${c}-${n} - BS AS`, i]), ...OTRAS.map(([c, n]) => [`${c}-${n}`, 3])]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('sin columna código: 5 sedes desde el nombre', r.sedes.length === 5 && totalDe(r, 151) === 4, r.sedes.map(s => s.cod).join(','))
}

// 7. Códigos con ceros adelante y números con separador de miles
{
  const aoa = [['Código', 'Sede', 'Total'], ['022', 'PILAR', '1.234'], ['033', 'SAN MIGUEL', '7'], ['042', 'BAHIA', ''], ['087', 'JUNIN', '-'], ['151', 'TL', 's/d']]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('cod "022" matchea con 22', totalDe(r, 22) === 1234, totalDe(r, 22))
  check('vacío y guion valen 0', totalDe(r, 42) === 0 && totalDe(r, 87) === 0)
  check('"s/d" se informa como fila inválida', r.meta.filasInvalidas.length === 1 && r.meta.filasInvalidas[0].cod === '151')
}

// 8. Archivo que no tiene nada de la red → error claro
{
  const aoa = [['Cod Sede', 'Sede', 'Total'], ...OTRAS.map(([c, n]) => [c, n, 1])]
  let msg = ''
  try { parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed }) } catch (e) { msg = e.message }
  check('ninguna sede de la red → error explicativo', /ninguna de las sedes/.test(msg), msg)
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
