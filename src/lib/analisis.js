// Cálculos sobre los cortes que se usan en más de una pantalla.

// Sedes para llamar: dos cortes seguidos sin sumar inscriptos (o bajando) y
// todavía por debajo del objetivo. Una sede que ya pasó su objetivo no
// necesita un llamado aunque no suba.
export function calcularParaLlamar(historial, data) {
  if (!historial || historial.length < 3) return []
  const porSede = {}
  historial.forEach(r => {
    const cod = String(r.cod_sede)
    if (!porSede[cod]) porSede[cod] = { sede: r.sede, vals: [] }
    porSede[cod].vals.push({ fecha: String(r.fecha), total: Number(r.total) || 0 })
  })
  const lista = []
  Object.entries(porSede).forEach(([cod, info]) => {
    const ordenado = [...info.vals].sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (ordenado.length < 3) return
    const [a, b, c] = ordenado.slice(-3)
    const estancada = (c.total - b.total) <= 0 && (b.total - a.total) <= 0
    const actual = data.find(d => String(d.cod_sede) === cod)
    if (estancada && actual && actual.pct < 100) lista.push(actual)
  })
  return lista.sort((x, y) => (x.pct ?? 0) - (y.pct ?? 0))
}

// Última nota de cada sede a partir de la lista completa (viene la más
// nueva primero)
export function ultimaNotaPorSede(notas) {
  const m = {}
  ;(notas || []).forEach(n => {
    const cod = String(n.cod_sede)
    if (!m[cod]) m[cod] = n
  })
  return m
}
