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

// Nombre de la sede sin el sufijo de la provincia ("SAN NICOLÁS- BUENOS AIRES",
// "X - BS AS", etc.)
export const nombreCorto = (n) => String(n || '').replace(/\s*-\s*(BUENOS AIRES|BS\.?\s*AS\.?)\b.*$/i, '').trim()

// ── Siglas de sede ──────────────────────────────────────────────────────────
// Tres letras por sede, como las de un cartel de terminal o aeropuerto
// (MDP = Mar del Plata), para reconocer cada casillero a simple vista. Se
// arman solas a partir del nombre y nunca se repiten.
const PALABRAS_VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y'])

function nombreParaSigla(n) {
  return nombreCorto(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/^DELEGACION\s+/, '').replace(/\s*-\s*CEM\s*$/, '')
    .replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function siglasPosibles(nombre) {
  const todas = nombreParaSigla(nombre).split(' ').filter(Boolean)
  const w = todas.filter(p => !PALABRAS_VACIAS.has(p))
  if (!w.length) return []
  const c = []
  if (w.length === 1) {
    const p = w[0]
    c.push(p.slice(0, 3))                                         // LUJ(án)
    const cons = p.slice(1).replace(/[AEIOU]/g, '')
    if (cons.length >= 2) c.push(p[0] + cons.slice(0, 2))        // SLT (Salto)
    c.push(p[0] + p.slice(-2))
    c.push(p.slice(0, 2) + p.slice(-1))
  } else if (w.length === 2 && todas.length === 2) {
    c.push(w[0][0] + w[1].slice(0, 2))                           // CTE (Carlos Tejedor)
    c.push(w[0].slice(0, 2) + w[1][0])
    c.push(w[0][0] + w[1][0] + w[1].slice(-1))
  } else if (w.length === 2) {
    c.push(todas.map(p => p[0]).join('').slice(0, 3))            // MDP (Mar del Plata)
    c.push(w[0][0] + w[1].slice(0, 2))
  } else {
    c.push(w.map(p => p[0]).join('').slice(0, 3))                // SAA (San Antonio de Areco)
    c.push(todas.map(p => p[0]).join('').slice(0, 3))
    c.push(w[0][0] + w[1][0] + w[w.length - 1][0])
  }
  return c.filter(x => x.length === 3)
}

// { cod_sede: 'LUJ', ... } — se reparten en orden de código, así una sede
// conserva su sigla de un corte a otro
export function siglasSedes(lista) {
  const usadas = new Set(), res = {}
  ;[...(lista || [])]
    .sort((a, b) => (Number(a.cod_sede) - Number(b.cod_sede)) || String(a.cod_sede).localeCompare(String(b.cod_sede)))
    .forEach(s => {
      let sigla = siglasPosibles(s.sede).find(c => !usadas.has(c))
      if (!sigla) {
        const base = (nombreParaSigla(s.sede).replace(/ /g, '') + 'XX').slice(0, 2)
        for (let i = 2; i < 10 && !sigla; i++) if (!usadas.has(base + i)) sigla = base + i
        if (!sigla) sigla = String(s.cod_sede).slice(0, 3)
      }
      usadas.add(sigla)
      res[String(s.cod_sede)] = sigla
    })
  return res
}

// Estado de una sede según su corte: la misma regla en toda la app
export function estadoSede(d) {
  if (d.total === 0) return 'cero'
  if (d.pct >= 50) return 'ok'
  return 'prog'
}
