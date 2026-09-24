// Datos inventados para revisar el diseño en desarrollo (`npm run dev` y
// abrir con ?demo). No se usa en producción: useSheets solo lo consulta
// cuando import.meta.env.DEV es true.
const NOMBRES = ['AVELLANEDA','BALCARCE','BRAGADO','CARLOS TEJEDOR','COLON','CORONEL PRINGLES','DARREGUEIRA','DELEGACIÓN BAHIA BLANCA','DELEGACIÓN SAN MIGUEL','ESCOBAR','GENERAL PACHECO','GENERAL VILLEGAS','GONZALEZ CATÁN','ITUZAINGÓ','JUNIN','LANÚS','LINCOLN','LUJÁN','MAR DEL PLATA - CEM','MARTINEZ','MÁXIMO PAZ','MORÓN','NECOCHEA','OLAVARRIA','OLIVOS','PEDRO LURO','PEHUAJO','PILAR','QUILMES','SALADILLO','SALTO','SAN ANTONIO DE ARECO','SAN NICOLÁS','SAN PEDRO','TRENQUE LAUQUEN','TRES ARROYOS','ZÁRATE']
const FECHAS = ['2026-06-05','2026-06-12','2026-06-19','2026-07-03','2026-07-24','2026-08-03','2026-08-07','2026-08-14','2026-08-21']

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

const sedes = NOMBRES.map((n, i) => ({ cod_sede: String(40 + i * 5), sede: n, email: n.toLowerCase().replace(/[^a-z]/g, '') + '@ucasal.edu.ar', saludo: 'Estimados', activa: 'TRUE' }))
const r = rnd(7)
const objetivos = sedes.map(s => ({ campana_id: 'C2', cod_sede: s.cod_sede, objetivo: 3 + Math.floor(r() * 25) }))
const finales = objetivos.map((o, i) => i % 11 === 3 ? 0 : Math.round(o.objetivo * (0.2 + r() * 1.9)))

const historial = []
FECHAS.forEach((f, k) => {
  sedes.forEach((s, i) => {
    const obj = objetivos[i].objetivo
    const tot = Math.round(finales[i] * Math.min(1, (k + 1) / FECHAS.length + (i % 4 === 0 ? 0.25 : 0)))
    historial.push({ fecha: f, cod_sede: s.cod_sede, sede: s.sede, 'campaña': '2do Ingreso 2026', total: tot, objetivo: obj, pct: obj ? tot / obj : 0 })
  })
})

const campanas = [
  { id: 'C1', nombre: '1er Ingreso 2025-2026', estado: 'cerrada', inicio: '2025-09-01', fin: '2026-03-31' },
  { id: 'C2', nombre: '2do Ingreso 2026', estado: 'activa', inicio: '2026-06-01', fin: '2026-08-31' },
]

function semanaActual() {
  const ultima = FECHAS[FECHAS.length - 1], anterior = FECHAS[FECHAS.length - 2]
  return sedes.map((s, i) => {
    const act = historial.find(h => h.fecha === ultima && h.cod_sede === s.cod_sede)
    const prev = historial.find(h => h.fecha === anterior && h.cod_sede === s.cod_sede)
    const obj = objetivos[i].objetivo
    return { cod_sede: s.cod_sede, sede: s.sede, email: s.email, saludo: s.saludo, objetivo: obj, total: act.total, prev: prev.total, var: act.total - prev.total, pct: Math.round(act.total / obj * 100), fecha: ultima, campana: 'C2' }
  })
}

// Envíos simulados de esta sesión (para que la verificación contra el log
// y la línea de la semana se comporten como en la realidad)
const enviosDemo = []
export function registrarEnvioDemo(p) {
  const d = new Date(), z = n => String(n).padStart(2, '0')
  enviosDemo.unshift({ fecha: p.fecha, hora: `${z(d.getHours())}:${z(d.getMinutes())}:00`, campana: p.campana, sede: p.sede, cod_sede: p.cod, email: p.to, estado: 'enviado' })
}

const NOTAS = [
  { fecha: '2026-08-20 11:05', cod_sede: '55', nota: 'Llamé, van a cargar esta semana' },
  { fecha: '2026-08-14 16:40', cod_sede: '110', nota: 'Llamé, no atendieron' },
  { fecha: '2026-08-02 10:15', cod_sede: '55', nota: 'Mandé mail' },
]

export function demoJsonp(action, params) {
  const c = params.campana
  switch (action) {
    case 'campanas': return campanas
    case 'sedes': case 'sedes_todas': return sedes
    case 'objetivos': return c === 'C2' ? objetivos : []
    case 'historial': return c === 'C2' ? historial : []
    case 'semana_actual': return c === 'C2' ? semanaActual() : []
    case 'log_envios': return enviosDemo
    case 'ultimo_deshacer': return { id: '1', fecha_hora: '2026-08-21 10:12', accion: 'agregar_semana', descripcion: 'Carga del corte 21/08/2026 · 2do Ingreso 2026' }
    case 'config': return {}
    case 'notas_sede': return params.cod_sede ? NOTAS.filter(n => n.cod_sede === String(params.cod_sede)) : NOTAS
    default: return []
  }
}
