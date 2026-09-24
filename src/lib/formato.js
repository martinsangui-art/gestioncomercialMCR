// Formatos y reglas que usa toda la app (fechas, nombres de sede, estado).

// 'yyyy-mm-dd' → 'dd/mm/aaaa'
export function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return String(iso)
  return `${p[2]}/${p[1]}/${p[0]}`
}

// 'yyyy-mm-dd' → 'dd/mm'
export function fmtCorto(iso) {
  const p = String(iso || '').slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : ''
}

// Fecha de hoy en hora local (toISOString da la fecha UTC: a la noche en
// Argentina ya es "mañana")
export function hoyIso() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function diasEntre(desdeIso, hastaIso) {
  return Math.round((new Date(hastaIso + 'T12:00:00') - new Date(desdeIso + 'T12:00:00')) / 86400000)
}

// Nombre de la sede sin el sufijo de la provincia
export const nombreCorto = (n) => String(n || '').replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')

// Estado de una sede según su corte: la misma regla en toda la app
export function estadoSede(d) {
  if (d.total === 0) return 'cero'
  if (d.pct >= 50) return 'ok'
  return 'prog'
}
