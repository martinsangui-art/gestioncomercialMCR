// Pruebas del lector del Excel del corte (src/lib/parserCorte.js).
// Correr con:  node scripts/probar-parser.mjs
// Arma Excels en memoria que imitan los formatos reales (recortado, nacional,
// nacional por carrera, fecha ambigua, sin columna de código) y verifica que
// la app tome exactamente las sedes de la red con los totales correctos.
import XLSX from 'xlsx'
import { parseCorte } from '../src/lib/parserCorte.js'
import { verificarCorte } from '../src/lib/verificarCorte.js'

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

// 4. Una sede repetida sin columna de carrera ni modalidad: NO se adivina, se frena
{
  const aoa = [['Cod Sede', 'Sede', fecha], ...Object.entries(RED).map(([c, n]) => [c, n, 5]), [87, 'JUNIN', 9]]
  let msg = ''
  try { parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed }) } catch (e) { msg = e.message }
  check('repetido suelto: frena y dice filas y valores', /87.*2 veces.*filas 5, 7.*5 y 9/.test(msg), msg)
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

// 9. Réplica del formato del Excel nacional REAL (corte 23/10/2026): dos filas
//    de títulos, la fecha del corte como fecha nativa en la segunda, columna
//    "Obj 1er Ingreso", "Año Anterior Misma Fecha", %, #DIV/0!, sedes con
//    varias modalidades donde solo la primera fila trae código, y TOTALES.
{
  const aoa = [
    [null, null, null, 'Total acumulado', 'Año Anterior Misma Fecha', '% sobre Año anterior', '% Cumplimiento objetivo'],
    ['Cod Sede', 'Sede', 'Obj 1er Ingreso', fecha],
    [1, 'SALTA - CASTAÑARES PRESENCIAL', 5921, 1676, 1599, '5%', '28%'],
    [2, 'UCASAL - PELLEGRINI 790', null, null, null, '#DIV/0!', '#DIV/0!'],
    [10, 'DELEGACION S S DE JUJUY - JUJUY Modo 1', 487, 46, 49, '-6%', '9%'],
    [null, 'DELEGACION S S DE JUJUY - JUJUY Modo 7', 398, 37, 42, '-12%', '9%'],
    [null, 'DELEGACION S S DE JUJUY - JUJUY Modo 2', 127, 9, 17, '-47%', '7%'],
    [22, 'PILAR - BUENOS AIRES', 26, 2, 4, '-50%', '8%'],
    [33, 'DELEGACIÓN SAN MIGUEL - BUENOS AIRES Modo 7', 70, 10, 14, '-29%', '14%'],
    [42, 'DELEGACIÓN BAHIA BLANCA - BUENOS AIRES', 93, 10, 17, '-41%', '11%'],
    [87, '87-JUNIN - BS AS ', 84, 15, 8, '88%', '18%'],
    [151, 'TRENQUE LAUQUEN - BUENOS AIRES', 40, 5, 3, '67%', '13%'],
    ...OTRAS.map(([c, n]) => [c, n, 30, 4, 3, '33%', '13%']),
    [null, 'TOTALES', 20000, 3000, 2900, '3%', '15%'],
  ]
  const r = parseCorte(libro([['Como Vamos SEDES 1 Ingreso 2027', aoa]]), XLSX, { codigosRed })
  check('real: fecha del corte 23/10/2026 desde la 2ª fila de títulos', r.meta.fechaCorte === '2026-10-23' && !r.meta.fechaAmbigua, r.meta.fechaCorte)
  check('real: toma las 5 de la red con sus totales', r.sedes.length === 5 && totalDe(r, 42) === 10 && totalDe(r, 87) === 15)
  check('real: reconoce "Obj 1er Ingreso" como objetivo', r.sedes.find(s => s.cod === '87').objetivoExcel === 84)
  check('real: lee "Año Anterior Misma Fecha"', r.sedes.find(s => s.cod === '42').anioAnterior === 17)
  check('real: informa la fila del Excel', r.sedes.find(s => s.cod === '22').filas[0] === 8, JSON.stringify(r.sedes.find(s => s.cod === '22')))
  check('real: es nacional y no lista otras zonas', r.meta.esNacional)
  const conJujuy = parseCorte(libro([['H', aoa]]), XLSX, { codigosRed: [...codigosRed, '10'] })
  check('real: suma las modalidades sin código (Jujuy 46+37+9)', totalDe(conJujuy, 10) === 92 && conJujuy.sedes.find(s => s.cod === '10').filas.length === 3)
  check('real: una sede de varias modalidades no cuenta como repetido', conJujuy.meta.duplicados.length === 0)
}

// 10. Sin título de fecha ni "total": no se adivina la columna
{
  const aoa = [['Cod Sede', 'Sede', 'Objetivo', 'Algo'], ...Object.entries(RED).map(([c, n]) => [c, n, 20, 3])]
  let msg = ''
  try { parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed }) } catch (e) { msg = e.message }
  check('sin columna de corte reconocible → error, no adivina', /columnas esperadas/.test(msg), msg)
}

// 11. Decimales y negativos son inválidos
{
  const aoa = [['Cod Sede', 'Sede', fecha], [22, 'PILAR', 3.5], [33, 'SM', -2], [42, 'BB', 4], [87, 'JUN', 5], [151, 'TL', 6]]
  const r = parseCorte(libro([['Hoja1', aoa]]), XLSX, { codigosRed })
  check('3,5 y -2 son filas inválidas (bloquean)', r.meta.filasInvalidas.map(f => f.cod).join() === '22,33', JSON.stringify(r.meta.filasInvalidas))
}

// 12. Dos hojas con las sedes de la zona → no se elige
{
  const a = [['Cod Sede', 'Sede', fecha], ...Object.entries(RED).map(([c, n]) => [c, n, 5])]
  const b2 = [['Cod Sede', 'Sede', fecha], ...Object.entries(RED).map(([c, n]) => [c, n, 7])]
  let msg = ''
  try { parseCorte(libro([['Semana 1', a], ['Semana 2', b2]]), XLSX, { codigosRed }) } catch (e) { msg = e.message }
  check('dos hojas con la zona → error claro', /dos hojas/.test(msg), msg)
}

// 13. Doble lectura: confirma una lectura correcta y detecta una adulterada
{
  const aoa = [
    [null, null, null, 'Total acumulado', 'Año Anterior Misma Fecha'],
    ['Cod Sede', 'Sede', 'Obj 1er Ingreso', fecha],
    [10, 'JUJUY Modo 1', 487, 46, 49], [null, 'JUJUY Modo 7', 398, 37, 42],
    ...Object.entries(RED).map(([c, n], i) => [Number(c), n, 20, 3 + i, 1]),
    ...OTRAS.map(([c, n]) => [c, n, 30, 4, 3]), [null, 'TOTALES', 1, 1, 1],
  ]
  const buf = libro([['H', aoa]])
  const cods = [...codigosRed, '10']
  const r = parseCorte(buf, XLSX, { codigosRed: cods })
  const v = verificarCorte(buf, XLSX, r, cods)
  check('doble lectura OK en lectura correcta', v.ok && v.sedes === 6 && v.total === 83 + 3 + 4 + 5 + 6 + 7, JSON.stringify(v))
  const adulterado = { ...r, sedes: r.sedes.map(s => s.cod === '42' ? { ...s, total: s.total + 1 } : s) }
  const v2 = verificarCorte(buf, XLSX, adulterado, cods)
  check('doble lectura detecta un número distinto', !v2.ok && v2.problemas.some(p => /42/.test(p)), JSON.stringify(v2.problemas))
  const sinUna = { ...r, sedes: r.sedes.filter(s => s.cod !== '151') }
  check('doble lectura detecta una sede perdida', !verificarCorte(buf, XLSX, sinUna, cods).ok)
  const otraColumna = { ...r, lectura: { ...r.lectura, iTotal: r.lectura.iTotal + 1 } }
  check('doble lectura detecta la columna equivocada', !verificarCorte(buf, XLSX, otraColumna, cods).ok)
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
