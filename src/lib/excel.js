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
  ;['campanas', 'objetivos', 'historial', 'sedes', 'log_envios'].forEach(nombre => {
    const rows = data[nombre] || []
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{}]), nombre)
  })
  X.writeFile(wb, `Backup Gestion Comercial ${hoy()}.xlsx`)
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
