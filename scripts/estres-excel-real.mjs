// Estrés: cientos de variantes del Excel nacional real. Regla: o da exactamente
// lo esperado (y la doble lectura confirma), o frena con un error/bloqueo. Nunca
// un número equivocado en silencio.
import XLSX from 'xlsx'; import fs from 'fs'
import { parseCorte } from '../src/lib/parserCorte.js'
import { verificarCorte } from '../src/lib/verificarCorte.js'
const [,, realPath, basePath, oraPath] = process.argv
const base = XLSX.readFile(basePath); const red = XLSX.utils.sheet_to_json(base.Sheets.sedes).map(s => String(s.cod_sede))
const oraculo = Object.fromEntries(JSON.parse(fs.readFileSync(oraPath)).map(o => [o.cod, o.total]))
const real = XLSX.readFile(realPath, { cellDates: true }); const sheetName = real.SheetNames[0]
const ROWS = XLSX.utils.sheet_to_json(real.Sheets[sheetName], { header: 1, raw: true, blankrows: true, defval: null })
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const pick = a => a[Math.floor(rnd() * a.length)]
const clone = a => a.map(r => (r ? [...r] : r))
const titulos = ROWS.slice(0, 2), datos = ROWS.slice(2).filter(r => r && r.some(v => v !== null && v !== ''))
// bloques: una fila con código + sus continuaciones (sin código)
const bloques = []; datos.forEach(r => { if (r[0] == null && bloques.length && !/TOTAL/i.test(String(r[1]))) bloques.at(-1).push(r); else bloques.push([r]) })
const libro = (hojas) => { const wb = XLSX.utils.book_new(); hojas.forEach(([n, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), n)); return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) }

const benignas = {
  mezclarFilas: (t, b) => { const bb = b.filter(x => !/TOTAL/i.test(String(x[0][1]))).sort(() => rnd() - 0.5); return [t, [...bb, ...b.filter(x => /TOTAL/i.test(String(x[0][1])))]] },
  filasVacias: (t, b) => [t, b.flatMap(x => (rnd() < 0.15 ? [[], x] : [x]).flat ? (rnd() < 0.15 ? [[[]], x] : [x]) : [x]).map(x => x)],
  columnaExtraAdelante: (t, b) => [t.map((r, i) => [i === 1 ? 'Región' : null, ...r]), b.map(x => x.map(r => (r.length ? ['NOA', ...r] : r)))],
  columnaExtraAtras: (t, b) => [t.map((r, i) => [...r, i === 1 ? 'Observaciones' : null]), b.map(x => x.map(r => (r.length ? [...r, 'ok'] : r)))],
  numerosComoTexto: (t, b) => [t, b.map(x => x.map(r => r.map((v, j) => (j >= 2 && j <= 4 && typeof v === 'number' ? String(v) : v))))],
  codigoConCeros: (t, b) => [t, b.map(x => x.map(r => r.map((v, j) => (j === 0 && typeof v === 'number' ? String(v).padStart(3, '0') : v))))],
  titulosMayus: (t, b) => [t.map(r => r.map(v => (typeof v === 'string' ? v.toUpperCase() : v))), b],
  espaciosEnNombres: (t, b) => [t, b.map(x => x.map(r => r.map((v, j) => (j === 1 && typeof v === 'string' ? '  ' + v + '   ' : v))))],
}
const conHojasExtra = (aoa) => [['Gráficos', [['Resumen nacional'], ['Región', 'Total'], ['NOA', 900], ['BS AS', 200]]], [sheetName, aoa], ['Notas', [['Generado por admisión']]]]
const filasArriba = (aoa, n) => [...Array.from({ length: n }, (_, i) => (i === 0 ? ['UCASAL — Cómo vamos'] : [])), ...aoa]
const armar = (t, b) => [...t, ...b.flat()]

let ok = 0, frenados = 0, silenciosos = 0; const ejemplosMal = []
const evaluar = (nombre, buf, esperado) => {
  let r, v
  try { r = parseCorte(buf, XLSX, { codigosRed: red }); v = verificarCorte(buf, XLSX, r, red) }
  catch (e) { if (esperado === 'error') { frenados++; return } silenciosos++; ejemplosMal.push(`${nombre}: tiró "${e.message}" y se esperaba que cargue`); return }
  const bloquea = !v.ok || r.meta.filasInvalidas.length > 0
  if (esperado === 'error') { if (bloquea) { frenados++; return } silenciosos++; ejemplosMal.push(`${nombre}: NO frenó (sedes ${r.sedes.length}, total ${r.sedes.reduce((a, s) => a + s.total, 0)})`); return }
  const got = Object.fromEntries(r.sedes.map(s => [s.cod, s.total]))
  const igual = Object.keys(esperado).length === Object.keys(got).length && Object.entries(esperado).every(([k, x]) => got[k] === x)
  if (igual && !bloquea && r.meta.fechaCorte === '2026-10-23') ok++
  else if (bloquea) { silenciosos++; ejemplosMal.push(`${nombre}: frenó sin motivo (${(v.problemas || []).slice(0, 2)})`) }
  else { silenciosos++; ejemplosMal.push(`${nombre}: RESULTADO DISTINTO fecha=${r.meta.fechaCorte} ${JSON.stringify(Object.entries(got).filter(([k, x]) => esperado[k] !== x).slice(0, 3))}`) }
}

// A. 500 combinaciones de cambios inocentes → tiene que dar idéntico
const nombres = Object.keys(benignas)
for (let n = 0; n < 500; n++) {
  let t = clone(titulos), b = bloques.map(clone)
  const usados = nombres.filter(() => rnd() < 0.4)
  for (const u of usados) [t, b] = benignas[u](t, b)
  let aoa = armar(t, b)
  if (rnd() < 0.3) aoa = filasArriba(aoa, 1 + Math.floor(rnd() * 4))
  const hojas = rnd() < 0.3 ? conHojasExtra(aoa) : [[sheetName, aoa]]
  evaluar(`inocente#${n}[${usados.join('+')}]`, libro(hojas), oraculo)
}

// B. Cambios que SÍ cambian el dato o rompen el Excel → o da el valor nuevo, o frena
const idx = (cod) => bloques.findIndex(x => String(x[0][0]) === cod)
for (let n = 0; n < 40; n++) {
  const cod = pick(red); const b = bloques.map(clone); const i = idx(cod)
  // B1: cambia el número de una sede → tiene que leer el nuevo
  const nuevo = 50 + n; b[i][0][3] = nuevo
  evaluar(`valorNuevo#${cod}`, libro([[sheetName, armar(titulos, b)]]), { ...oraculo, [cod]: nuevo })
  // B2: la misma sede duplicada con otro valor → frena
  const b2 = bloques.map(clone); b2.splice(idx(pick(red)) + 1, 0, [[...b2[i][0].slice(0, 3), 99, ...b2[i][0].slice(4)]])
  evaluar(`duplicada#${cod}`, libro([[sheetName, armar(titulos, b2)]]), 'error')
  // B3: texto en la celda de una sede → frena
  const b3 = bloques.map(clone); b3[i][0][3] = pick(['s/d', 'N/A', '#REF!', '3,5', '-1']); evaluar(`textoEnCelda#${cod}=${b3[i][0][3]}`, libro([[sheetName, armar(titulos, b3)]]), 'error')
  // B4: falta una sede → no frena el lector, pero tiene que faltar exactamente esa (la app pide confirmación)
  const b4 = bloques.map(clone).filter((_, j) => j !== i); const esp4 = { ...oraculo }; delete esp4[cod]
  evaluar(`falta#${cod}`, libro([[sheetName, armar(titulos, b4)]]), esp4)
}
// B5: sin fecha en el título → frena (no adivina columna)
{ const t = clone(titulos); t[1][3] = 'Inscriptos semana'; t[0][3] = null; const aoa = armar(t, bloques); const buf = libro([[sheetName, aoa]])
  // "Inscriptos" es un título válido de total: debe cargar con la fecha que elija Cele
  let r; try { r = parseCorte(buf, XLSX, { codigosRed: red }) } catch (e) { r = null }
  if (r && r.meta.fechaCorte === null && verificarCorte(buf, XLSX, r, red).ok && r.sedes.every(s => oraculo[s.cod] === s.total)) ok++; else { silenciosos++; ejemplosMal.push('tituloTotalSinFecha: mal') } }
{ const t = clone(titulos); t[1][3] = 'Columna D'; t[0][3] = null; evaluar('sinTituloReconocible', libro([[sheetName, armar(t, bloques)]]), 'error') }
// B6: dos columnas de fecha (semana anterior a la derecha) → tiene que tomar la más reciente
{ const t = clone(titulos); t[1] = [...t[1].slice(0, 4), new Date(2026, 9, 16), ...t[1].slice(5)]; const b = bloques.map(x => x.map(r => [...r.slice(0, 4), 0, ...r.slice(5)]))
  evaluar('dosFechas_anteriorALaDerecha', libro([[sheetName, armar(t, b)]]), oraculo) }
{ const t = clone(titulos); t[1] = [...t[1].slice(0, 4), new Date(2026, 9, 23), ...t[1].slice(5)]; evaluar('dosColumnasMismaFecha', libro([[sheetName, armar(t, bloques)]]), 'error') }
// B7: columnas D y E intercambiadas (título incluido) → sigue la fecha
{ const sw = r => { const c = [...r]; [c[3], c[4]] = [c[4], c[3]]; return c }; evaluar('DyEintercambiadas', libro([[sheetName, armar(titulos.map(sw), bloques.map(x => x.map(sw)))]]), oraculo) }
// B8: dos hojas con la zona (copia con otros números) → frena
{ const b = bloques.map(x => x.map(r => { const c = [...r]; if (typeof c[3] === 'number') c[3] += 1; return c })); evaluar('dosHojasConLaZona', libro([[sheetName, armar(titulos, bloques)], ['Copia', armar(titulos, b)]]), 'error') }

console.log(`Variantes: ${ok + frenados + silenciosos} · correctas ${ok} · frenadas como corresponde ${frenados} · ERRORES SILENCIOSOS ${silenciosos}`)
ejemplosMal.slice(0, 15).forEach(e => console.log('  ✗', e))
