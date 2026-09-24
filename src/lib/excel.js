import { obtenerBackup } from '../hooks/useSheets'

// Exportaciones a .xlsx con SheetJS (cargado por CDN en index.html, el mismo
// que usa ExcelUploader para leer).
function xlsx() {
  const X = window.XLSX
  if (!X) throw new Error('SheetJS no disponible — recargá la página')
  return X
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function nombreArchivo(txt) {
  return txt.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
}

// Copia completa de la base (campañas, objetivos, historial, sedes y log de
// envíos) — el respaldo para guardar fuera de la planilla.
export async function descargarBackupExcel() {
  const X = xlsx()
  const data = await obtenerBackup()
  const wb = X.utils.book_new()
  const ahora = new Date()
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([
    ['generado', ahora.toLocaleString('es-AR')],
    ['nota', 'Backup de Gestión Comercial. Para volver a este punto: Dashboard → Restaurar backup.'],
  ]), '_info')
  ;['campanas', 'objetivos', 'historial', 'sedes', 'log_envios'].forEach(nombre => {
    const rows = data[nombre] || []
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{}]), nombre)
  })
  const hora = ahora.toTimeString().slice(0, 5).replace(':', '.')
  X.writeFile(wb, `Backup Gestion Comercial ${hoy()} ${hora}.xlsx`)
}

// Lee un Excel de backup para restaurarlo. Devuelve las hojas como matrices
// (header + filas), listas para mandar al backend, y un resumen para mostrar
// antes de confirmar.
export async function leerBackupExcel(file) {
  const X = xlsx()
  const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const aIso = (v) => {
    // Si alguien abrió y guardó el backup en Excel, las fechas vuelven como Date
    if (v instanceof Date) {
      const p = n => String(n).padStart(2, '0')
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
    }
    return v
  }
  const hojas = {}
  for (const nombre of ['campanas', 'objetivos', 'historial']) {
    const ws = wb.Sheets[nombre]
    if (!ws) throw new Error(`Este archivo no es un backup: falta la hoja "${nombre}"`)
    const filas = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
      .filter(f => f.some(v => v !== ''))
      .map(f => f.map(aIso))
    hojas[nombre] = filas
  }
  const info = wb.Sheets._info ? X.utils.sheet_to_json(wb.Sheets._info, { header: 1, raw: false }) : []
  const generado = info.find(f => f[0] === 'generado')?.[1] || null

  const hCamp = hojas.campanas[0] || []
  const campanas = hojas.campanas.slice(1).map(f => ({
    nombre: f[hCamp.indexOf('nombre')], estado: f[hCamp.indexOf('estado')],
  }))
  const hHist = hojas.historial[0] || []
  const fechas = [...new Set(hojas.historial.slice(1).map(f => String(f[hHist.indexOf('fecha')])))].sort()
  return {
    hojas,
    resumen: { generado, campanas, cortes: fechas.length, ultimoCorte: fechas[fechas.length - 1] || null },
  }
}

// Resultados de una campaña: el corte final por sede + la evolución de cada
// sede corte a corte (una columna por fecha).
export function descargarResultadosExcel(campNombre, data, historial) {
  const X = xlsx()
  const wb = X.utils.book_new()

  const final = [...data].sort((a, b) => b.pct - a.pct).map((d, i) => ({
    Puesto: i + 1,
    Cod: d.cod_sede,
    Sede: d.sede,
    Objetivo: d.objetivo,
    Inscriptos: d.total,
    'Cumplimiento %': d.pct,
    Estado: d.pct >= 50 ? 'En objetivo' : d.total > 0 ? 'En progreso' : 'Sin ingresos',
  }))
  const totIng = data.reduce((a, d) => a + d.total, 0)
  const totObj = data.reduce((a, d) => a + d.objetivo, 0)
  final.push({})
  final.push({ Sede: 'TOTAL', Objetivo: totObj, Inscriptos: totIng, 'Cumplimiento %': totObj ? Math.round(totIng / totObj * 100) : 0 })
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(final), 'Resultado final')

  const fechas = [...new Set(historial.map(r => r.fecha))].sort()
  const porSede = {}
  historial.forEach(r => {
    const cod = String(r.cod_sede)
    if (!porSede[cod]) porSede[cod] = { Cod: cod, Sede: r.sede }
    porSede[cod][r.fecha] = Number(r.total) || 0
  })
  const evol = Object.values(porSede).sort((a, b) => String(a.Sede).localeCompare(String(b.Sede)))
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(evol, { header: ['Cod', 'Sede', ...fechas] }), 'Evolución por corte')

  X.writeFile(wb, nombreArchivo(`Resultados ${campNombre} ${hoy()}`) + '.xlsx')
}
