import XLSX from 'xlsx'; import fs from 'fs'
import { parseCorte } from '../src/lib/parserCorte.js'
import { verificarCorte } from '../src/lib/verificarCorte.js'
const base = XLSX.readFile(process.argv[3]); const red = XLSX.utils.sheet_to_json(base.Sheets.sedes).map(s=>String(s.cod_sede))
const or = Object.fromEntries(JSON.parse(fs.readFileSync(process.argv[4])).map(o=>[o.cod,o.total]))
for (const f of process.argv.slice(5)) {
  const b = fs.readFileSync(f); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  const r = parseCorte(ab, XLSX, { codigosRed: red }); const v = verificarCorte(ab, XLSX, r, red)
  const igual = r.sedes.length === 37 && r.sedes.every(s => or[s.cod] === s.total)
  console.log(f.split('/').pop(), '| sedes', r.sedes.length, '| total', r.sedes.reduce((a,s)=>a+s.total,0), '| doble lectura', v.ok ? 'OK' : v.problemas, '| = carga manual', igual, '| col', r.meta.letraColumna, r.meta.columnaTotal)
}
