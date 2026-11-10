import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { direccionesDe, hoyIso, fmtFecha, EMAIL_RE } from '../lib/formato'
import { buildEmailHTML, destinosDe, yaRecibieron, planDeTanda, registradasEnLog } from '../lib/envio'

// Modo demo (solo en `npm run dev`, abriendo con ?demo): datos inventados y
// sin tocar la planilla — para revisar el diseño sin contraseña.
const DEMO = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

const API = 'https://script.google.com/macros/s/AKfycbyqeOBpxtYxavx-Uc8mTVRhsqb6HhY6N1RETcvNNVorRuuHMb111XLh_pVYhbSBry4/exec'
const TOKEN_KEY = 'ucasal_session_token'

// ── Manejo de sesión ────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// ── Aviso de sesión expirada ────────────────────────────────────────────────
// jsonp/post/enviarUnaDireccion viven fuera de React (no son hooks), así que
// usamos un mini pub-sub para avisarle a la app (sin window.location.reload,
// que tira trabajo no guardado) que el token venció y hay que re-loguearse.
const authExpiredListeners = new Set()
function notifyAuthExpired() {
  authExpiredListeners.forEach(fn => fn())
}
export function onAuthExpired(fn) {
  authExpiredListeners.add(fn)
  return () => authExpiredListeners.delete(fn)
}

// Enviar email via Apps Script (evita CORS del browser con Make), a UNA sola
// dirección. El módulo Gmail de Make no acepta varias direcciones en el campo
// "To": con "a@x, b@y" el webhook igual contesta 200 y el mail no sale
// (Morón, 14/08). Por eso una sede con varios mails recibe un mail por
// dirección — mismo contenido y saludo — uno detrás del otro (ver mandarA).
function enviarUnaDireccion(payload) {
  if (direccionesDe(payload.to).length !== 1) return Promise.reject(new Error('Se manda a una sola dirección por vez: ' + payload.to))
  if (DEMO) {
    return import('../dev/demoData').then(m => new Promise(res => setTimeout(() => {
      m.registrarEnvioDemo(payload); res({ ok: true, data: { status: 200 } })
    }, 250)))
  }
  return new Promise((resolve, reject) => {
    const cb = '_cb_email_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    const url = API + '?action=enviar_email&callback=' + cb +
      '&token='    + encodeURIComponent(getToken()) +
      '&to='       + encodeURIComponent(payload.to) +
      '&subject='  + encodeURIComponent(payload.subject) +
      '&html='     + encodeURIComponent(payload.html) +
      '&sede='     + encodeURIComponent(payload.sede) +
      '&cod='      + encodeURIComponent(payload.cod) +
      '&fecha='    + encodeURIComponent(payload.fecha) +
      '&campana='  + encodeURIComponent(payload.campana || '')

    // Antes esto resolvía { ok: true } a los 10 segundos: si Apps Script no
    // contestaba, el front inventaba un éxito, pintaba el tilde verde y seguía
    // con la sede siguiente. Ese era el bug del envío del 03/08 (San Nicolás y
    // Tres Arroyos quedaron "enviadas" en pantalla sin fila en log_envios).
    // Ahora un timeout es un error de verdad, y 10s era además demasiado poco:
    // Apps Script tiene que llamar al webhook de Make antes de contestar.
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout: el envío no respondió a tiempo'))
    }, 30000)
    window[cb] = (data) => {
      cleanup()
      if (data?.error === 'AUTH_REQUIRED') {
        setToken(''); notifyAuthExpired()
        reject(new Error('AUTH_REQUIRED'))
        return
      }
      if (data && data.ok === false) {
        reject(new Error(data.error || 'Error al enviar'))
        return
      }
      // enviarEmailMake devuelve el status HTTP del webhook de Make. Apps Script
      // lo registra como 'error' en log_envios si no es 2xx, así que el front
      // tampoco lo puede dar por enviado.
      const status = data?.data?.status
      if (status != null && (status < 200 || status >= 300)) {
        reject(new Error('El webhook de envío respondió ' + status))
        return
      }
      resolve(data)
    }
    function cleanup() { clearTimeout(timeout); delete window[cb]; if (el?.parentNode) el.parentNode.removeChild(el) }
    const el = document.createElement('script')
    el.src = url
    el.onerror = () => { cleanup(); reject(new Error('Error de red')) }
    document.head.appendChild(el)
  })
}

// JSONP helper — única forma confiable de llamar Apps Script desde el browser
function jsonp(action, params = {}) {
  if (DEMO) return import('../dev/demoData').then(m => m.demoJsonp(action, params))
  return new Promise((resolve, reject) => {
    const cb = '_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    let url = `${API}?action=${action}&callback=${cb}`
    // El login no manda token (todavía no lo tiene); el resto sí
    if (action !== 'login') url += `&token=${encodeURIComponent(getToken())}`
    Object.entries(params).forEach(([k, v]) => { url += `&${k}=${encodeURIComponent(v)}` })

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout al conectar con Google Sheets'))
    }, 20000)

    window[cb] = (data) => {
      cleanup()
      if (data?.ok) resolve(data.data)
      else if (data?.error === 'AUTH_REQUIRED') {
        setToken('')
        notifyAuthExpired()
        reject(new Error('AUTH_REQUIRED'))
      }
      else reject(new Error(data?.error || 'Error en la API'))
    }

    function cleanup() {
      clearTimeout(timeout)
      delete window[cb]
      if (el?.parentNode) el.parentNode.removeChild(el)
    }

    const el = document.createElement('script')
    el.src = url
    el.onerror = () => { cleanup(); reject(new Error('Error de red')) }
    document.head.appendChild(el)
  })
}

function post(body) {
  if (DEMO) return Promise.reject(new Error('Modo demo: no se guardan cambios'))
  return fetch(API, { method: 'POST', body: JSON.stringify({ ...body, token: getToken() }) })
    .catch(() => { throw new Error('Sin conexión con la planilla: revisá internet y probá de nuevo') })
    .then(r => r.text())
    .then(t => {
      let r
      try { r = JSON.parse(t) } catch {
        throw new Error('La planilla respondió algo inesperado (puede estar con demora): probá de nuevo en un minuto')
      }
      if (!r.ok) {
        if (r.error === 'AUTH_REQUIRED') { setToken(''); notifyAuthExpired() }
        throw new Error(r.error)
      }
      return r.data
    })
}

// ── Hook de autenticación ───────────────────────────────────────────────────
export function useAuth() {
  const [authed, setAuthed] = useState(DEMO || !!getToken())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Cuando el token vence en cualquier llamada (jsonp/post/enviarUnaDireccion),
  // volvemos al login vía estado de React — sin window.location.reload().
  useEffect(() => {
    return onAuthExpired(() => {
      setAuthed(false)
      setSessionExpired(true)
    })
  }, [])

  const login = useCallback(async (password) => {
    setLoading(true)
    setError(null)
    try {
      const data = await jsonp('login', { password })
      setToken(data.token)
      setAuthed(true)
      setSessionExpired(false)
    } catch (e) {
      setError(e.message === 'Contraseña incorrecta' ? 'Contraseña incorrecta' : 'Error al conectar. Intentá de nuevo.')
    }
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setAuthed(false)
  }, [])

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), [])

  return { authed, loading, error, login, logout, sessionExpired, dismissSessionExpired }
}

export function useSheets() {
  const [state, setState] = useState({
    loading: true,      // solo el arranque (lista de campañas + primera campaña)
    recargando: false,  // recargas posteriores: la pantalla sigue visible
    errorRecarga: null, // falló una recarga: se avisa sin tapar la app
    error: null,
    campanas: [],
    sedes: [],
    campanaActiva: null,
    data: [],           // semana actual procesada
    historial: [],      // historial completo
  })

  // Qué direcciones ya recibieron el corte en pantalla: {cod: ['a@x', ...]}
  // (en minúscula). Una sede cuenta como enviada recién cuando TODAS sus
  // direcciones están acá — así, si a una sede se le agrega un mail, vuelve a
  // pendientes y al mandarla sale solo a la dirección que falta.
  // El ref es la copia viva (se actualiza en el acto): la tanda de envío
  // calcula los destinos de cada sede contra él, no contra una foto vieja.
  const [dirEnviadas, setDirEnviadasState] = useState({})
  const dirEnviadasRef = useRef({})
  const setDirEnviadas = useCallback((upd) => {
    dirEnviadasRef.current = typeof upd === 'function' ? upd(dirEnviadasRef.current) : upd
    setDirEnviadasState(dirEnviadasRef.current)
  }, [])

  // Carga inicial
  useEffect(() => {
    Promise.all([jsonp('campanas'), jsonp('sedes')])
      .then(([campanas, sedes]) => {
        const activa = campanas.find(c => c.estado === 'activa') || campanas[campanas.length - 1]
        // loading sigue en true hasta que llegue la primera campaña (cargarCampana)
        setState(s => ({ ...s, campanas, sedes, campanaActiva: activa?.id || null, loading: !!activa }))
      })
      .catch(err => {
        // El modal de "sesión expirada" ya se dispara desde jsonp() vía notifyAuthExpired();
        // acá solo evitamos mostrar un error genérico encima de ese modal.
        if (err.message === 'AUTH_REQUIRED') return
        setState(s => ({ ...s, loading: false, error: err.message }))
      })
  }, [])

  // Refrescar la lista de sedes (después de agregar/editar/activar una sede
  // desde el panel de gestión, para que el resto de la app la vea al toque)
  const refrescarSedes = useCallback(() => {
    return jsonp('sedes').then(sedes => {
      setState(s => {
        // semana_actual devuelve cada fila con sede/email/saludo ya copiados
        // desde la hoja 'sedes' al momento de cargar la campaña. Si acá solo
        // se actualizara `sedes`, esa copia dentro de `data` quedaría vieja y
        // el envío seguiría usando el email anterior hasta recargar la página.
        const porCod = {}
        sedes.forEach(x => { porCod[String(x.cod_sede)] = x })
        const data = s.data.map(d => {
          const sed = porCod[String(d.cod_sede)]
          return sed ? { ...d, sede: sed.sede, email: sed.email, saludo: sed.saludo } : d
        })
        return { ...s, sedes, data }
      })
      return sedes
    })
  }, [])

  // Releer la lista de campañas (después de cerrar/abrir una) y pasar a la
  // que corresponda — el cambio de campanaActiva dispara la carga de datos.
  // Releer la lista de campañas (después de cerrar/abrir/deshacer/restaurar)
  // y, si se indica, cargar esa campaña. La campaña visible cambia recién
  // cuando llegan sus datos (ver cargarCampana).
  const cargarRef = useRef(null)
  const refrescarCampanas = useCallback((seleccionarId) => {
    return jsonp('campanas').then(campanas => {
      setState(s => ({ ...s, campanas }))
      if (seleccionarId) cargarRef.current?.(seleccionarId, campanas)
      return campanas
    })
  }, [])

  // Cargar datos cuando cambia campaña activa
  // Pide los datos de una campaña. La primera vez se ve la pantalla de carga;
  // después la app queda visible (con el indicador de "recargando") para no
  // perder lo que había abierto — antes cada recarga tapaba todo.
  const pedidoActual = useRef(0)
  // La campaña seleccionada cambia recién cuando llegan sus datos: si no,
  // durante la carga (o para siempre si falla) se vería el nombre de una
  // campaña con los números de otra, y las acciones apuntarían a la nueva.
  const cargadaRef = useRef(null)
  const cargarCampana = useCallback((campanaId, campanasFrescas) => {
    const pedido = ++pedidoActual.current
    setState(s => ({ ...s, recargando: true, errorRecarga: null }))

    Promise.all([
      jsonp('semana_actual', { campana: campanaId }),
      jsonp('historial', { campana: campanaId }),
    ]).then(([data, historial]) => {
      // Si mientras tanto se pidió otra campaña, esta respuesta ya no sirve
      if (pedido !== pedidoActual.current) return
      setDirEnviadas({})
      cargadaRef.current = campanaId
      setState(s => ({ ...s, loading: false, recargando: false, campanaActiva: campanaId, data, historial }))

      // Sincronizar "enviadas" con el log real de envíos — si Cele recarga la
      // página a mitad de una tanda, al volver a entrar ya ve qué se mandó
      // (en vez de perder el track y tener que adivinar o reenviar de más).
      const fecha = data[0]?.fecha
      const camp = (campanasFrescas || state.campanas).find(c => c.id === campanaId)
      if (fecha && camp) {
        jsonp('log_envios', { limite: 500 })
          .then(log => {
            // r.fecha es el día de ENVÍO; `fecha` es el del corte. Cuenta todo
            // lo mandado desde el corte en adelante (antes exigía el mismo día
            // y un corte mandado otro día quedaba todo como pendiente).
            const porSede = {}
            registradasEnLog(log, { desde: fecha, campNom: camp.nombre }).forEach(k => {
              const i = k.indexOf('|')
              const cod = k.slice(0, i)
              porSede[cod] = porSede[cod] || []
              porSede[cod].push(k.slice(i + 1))
            })
            if (Object.keys(porSede).length) {
              setDirEnviadas(prev => {
                const next = { ...prev }
                Object.entries(porSede).forEach(([cod, dirs]) => {
                  next[cod] = [...new Set([...(next[cod] || []), ...dirs])]
                })
                return next
              })
            }
          })
          .catch(() => {}) // no crítico — si falla, simplemente no se pre-marca nada
      }
    }).catch(err => {
      if (pedido !== pedidoActual.current) return
      // El modal de "sesión expirada" ya se dispara desde jsonp() vía notifyAuthExpired()
      if (err.message === 'AUTH_REQUIRED') return
      setState(s => s.loading
        ? { ...s, loading: false, recargando: false, error: err.message }
        : { ...s, recargando: false, errorRecarga: err.message })
    })
  }, [state.campanas]) // eslint-disable-line

  cargarRef.current = cargarCampana

  // Primera carga: la campaña que eligió el arranque. Las siguientes las pide
  // quien cambia de campaña (cargarCampana / refrescarCampanas).
  useEffect(() => {
    if (state.campanaActiva && state.campanaActiva !== cargadaRef.current) cargarCampana(state.campanaActiva)
  }, [state.campanaActiva === null ? null : state.campanaActiva]) // eslint-disable-line

  // Una sede se marca enviada por dirección. Sin `dirs`, se marcan todas
  // las direcciones que tiene hoy (lo que antes era "toda la sede").
  const dataRef = useRef([])
  dataRef.current = state.data
  const dirsActuales = (cod) => {
    const d = dataRef.current.find(x => String(x.cod_sede) === String(cod))
    return direccionesDe(d?.email).map(a => a.toLowerCase())
  }
  const markCopied = useCallback((cod, dirs) => {
    const k = String(cod)
    const agregar = (dirs || dirsActuales(k)).map(a => a.toLowerCase())
    setDirEnviadas(prev => ({ ...prev, [k]: [...new Set([...(prev[k] || []), ...agregar])] }))
  }, [])

  // Sacar el tilde de una sede (todas sus direcciones, o solo `dirs`) — se usa
  // cuando la verificación contra log_envios muestra que el envío no quedó.
  const markUncopied = useCallback((cod, dirs) => {
    const k = String(cod)
    setDirEnviadas(prev => {
      if (!prev[k]) return prev
      const next = { ...prev }
      if (dirs) {
        const sacar = dirs.map(a => a.toLowerCase())
        next[k] = next[k].filter(a => !sacar.includes(a))
      } else delete next[k]
      return next
    })
  }, [])

  // Enviada = todas sus direcciones actuales ya recibieron el corte
  const copied = useMemo(() => {
    const out = {}
    state.data.forEach(d => {
      const dirs = direccionesDe(d.email).map(a => a.toLowerCase())
      const ya = dirEnviadas[String(d.cod_sede)] || []
      if (dirs.length && dirs.every(a => ya.includes(a))) out[d.cod_sede] = true
    })
    return out
  }, [state.data, dirEnviadas])

  // ── Tanda de envío ────────────────────────────────────────────────────────
  // El estado de la tanda vive acá y no en la vista de Envío: esa vista se
  // desmonta al cambiar de sección y, al volver, nacía de cero con "Enviar N
  // mails" habilitado mientras el bucle anterior seguía corriendo — se podía
  // lanzar una segunda tanda en paralelo y duplicar mails. `ocupado` es el
  // candado: vale para la tanda y para un envío suelto (vista previa o ↻).
  const [envio, setEnvio] = useState({ enviando: false, ocupado: false, progreso: 0, log: [], sedeEnCurso: null })
  const ocupadoRef = useRef(false)

  const addLogEnvio = useCallback((msg, tipo = 'info') => {
    setEnvio(s => ({ ...s, log: [...s.log, { msg, tipo, ts: new Date().toLocaleTimeString() }] }))
  }, [])

  // Mientras sale algo, cerrar o recargar la pestaña pide confirmación
  useEffect(() => {
    if (!envio.ocupado) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [envio.ocupado])

  // Manda el mail de una sede a cada dirección de `dirs`, una por una, y
  // marca cada una apenas sale. Si una falla, el error dice a cuáles ya salió.
  // Una dirección mal escrita (misma regla que Sedes) no se manda: es error.
  const mandarA = useCallback(async (d, dirs, { html, subject, fecha, campNom }) => {
    const invalidas = dirs.filter(a => !EMAIL_RE.test(a))
    const avisoInvalidas = invalidas.length ? ' · dirección inválida: ' + invalidas.join(', ') : ''
    const salieron = []
    for (const to of dirs.filter(a => EMAIL_RE.test(a))) {
      try {
        await enviarUnaDireccion({ to, subject, html, sede: d.sede, cod: String(d.cod_sede), fecha, campana: campNom })
      } catch (e) {
        if (e?.message === 'AUTH_REQUIRED') throw e
        const error = new Error((e?.message || 'Error al enviar') + ' — no salió a ' + to +
          (salieron.length ? ' (sí salió a ' + salieron.join(', ') + ')' : '') + avisoInvalidas)
        error.dir = to
        error.salieron = [...salieron]
        throw error
      }
      salieron.push(to)
      markCopied(d.cod_sede, [to])
    }
    if (invalidas.length) {
      const error = new Error('dirección inválida: ' + invalidas.join(', ') +
        (salieron.length ? ' (sí salió a ' + salieron.join(', ') + ')' : ''))
      error.salieron = [...salieron]
      throw error
    }
    return salieron
  }, [markCopied])

  // Compara lo que el front cree que mandó contra lo que Apps Script realmente
  // registró en log_envios. Devuelve los códigos que no aparecen registrados
  // (faltantes) y los que dieron error pero sí figuran enviados (recuperadas).
  // `desde` es la fecha local en que arrancó la tanda: vale cualquier fila
  // registrada desde ese día (cubre una tanda que cruza la medianoche).
  const verificarContraLog = useCallback(async ({ okCods, okDirs, errDirs, desde, campNom, lista }) => {
    const conError = Object.keys(errDirs).filter(c => errDirs[c].length)
    if (!okCods.length && !conError.length) return { faltantes: [], recuperadas: [] }
    let registro
    try {
      registro = await obtenerLogEnvios(300)
    } catch {
      addLogEnvio('No se pudo verificar contra el log de envíos — revisá el historial a mano.', 'error')
      return { faltantes: [], recuperadas: [] }
    }
    // Registrado = una fila 'enviado' de esa sede y esa dirección desde el
    // día en que arrancó la tanda.
    const registradas = registradasEnLog(registro, { desde, campNom })
    const faltantes = []
    okCods.forEach(cod => {
      const sinRegistro = (okDirs[cod] || []).filter(a => !registradas.has(cod + '|' + a.toLowerCase()))
      if (!sinRegistro.length) return
      faltantes.push(cod)
      const d = lista.find(x => String(x.cod_sede) === cod)
      addLogEnvio(`✗ ${d?.sede || cod}: no quedó registrado el envío a ${sinRegistro.join(', ')}, hay que reenviarlo`, 'error')
      markUncopied(d ? d.cod_sede : cod, sinRegistro)
    })
    if (faltantes.length) {
      addLogEnvio(`${faltantes.length} sede(s) quedaron sin registrar y volvieron a pendientes.`, 'error')
    }
    // Al revés: dio error en pantalla (por ejemplo, la respuesta no llegó)
    // pero Apps Script sí la registró como enviada → no hay que reenviarla.
    const recuperadas = []
    conError.forEach(cod => {
      const si = errDirs[cod].filter(a => registradas.has(cod + '|' + a.toLowerCase()))
      if (!si.length) return
      const d = lista.find(x => String(x.cod_sede) === cod)
      markCopied(d ? d.cod_sede : cod, si)
      addLogEnvio(`✓ ${d?.sede || cod}: figuraba como error pero sí salió`, 'ok')
      recuperadas.push({ cod, dirs: si })
    })
    return { faltantes, recuperadas }
  }, [addLogEnvio, markCopied, markUncopied])

  // Envío en lote, tanto para "Enviar pendientes" como para "Reenviar todos"
  // — misma lógica, distinta lista de entrada. Si ya hay un envío en curso no
  // arranca (devuelve false).
  const lanzarTanda = useCallback(async (lista, { esReenvio = false, template, campNom = '' } = {}) => {
    if (ocupadoRef.current) return false
    ocupadoRef.current = true
    setEnvio({ enviando: true, ocupado: true, progreso: 0, log: [], sedeEnCurso: null })
    const setProgreso = (p) => setEnvio(s => ({ ...s, progreso: p }))
    try {
      addLogEnvio(`${esReenvio ? 'Reenviando' : 'Iniciando envío de'} ${lista.length} emails…`, 'info')
      const resumenItems = []
      const fechaRef = lista[0]?.fecha || hoyIso()
      // Fecha de ENVÍO (local), no de corte: log_envios guarda el día en que se
      // mandó. Comparar contra fechaRef (corte) marcaba todo como error cuando
      // el corte del viernes se mandaba otro día (bug del 19/10, corte 16/10).
      const desdeEnvio = hoyIso()
      // Una sede no se manda dos veces en la misma tanda aunque venga repetida
      // en la lista, y las que no tienen email se saltean (ver planDeTanda).
      const plan = planDeTanda(lista)
      const okCods = []
      const okDirs = {}  // {cod: [direcciones que salieron en esta tanda]}
      const errDirs = {} // {cod: [dirección que dio error]}
      const intentos = {} // {cod: { dirs, salieron }} de las que dieron error
      const itemPorCod = {}

      // Antes de arrancar (no en un reenvío explícito): lo que log_envios ya
      // tiene como enviado para esta campaña desde la fecha del corte no se
      // vuelve a mandar. Cubre la tanda cortada a la mitad (recarga, sesión
      // vencida) y lo mandado desde otra pestaña o compu.
      const avisadas = new Set()
      if (!esReenvio && plan.some(p => p.tipo === 'enviar')) {
        try {
          const reg = registradasEnLog(await obtenerLogEnvios(500), { desde: fechaRef, campNom })
          plan.forEach(({ d, tipo }) => {
            if (tipo !== 'enviar') return
            const cod = String(d.cod_sede)
            const ya = dirEnviadasRef.current[cod] || []
            const salieron = direccionesDe(d.email).filter(a => !ya.includes(a.toLowerCase()) && reg.has(cod + '|' + a.toLowerCase()))
            if (!salieron.length) return
            addLogEnvio(`• ${d.sede}: ya había salido a ${salieron.join(', ')}`, 'info')
            markCopied(d.cod_sede, salieron)
            avisadas.add(cod)
          })
        } catch (e) {
          if (e?.message === 'AUTH_REQUIRED') {
            addLogEnvio('✗ La sesión venció: no salió ningún mail. Volvé a entrar y probá de nuevo.', 'error')
            return true
          }
          addLogEnvio('No se pudo leer el registro de envíos antes de arrancar: se sigue sin ese control.', 'error')
        }
      }

      for (let i = 0; i < plan.length; i++) {
        const { d, tipo } = plan[i]
        const cod = String(d.cod_sede)
        const avance = () => setProgreso(Math.round((i + 1) / lista.length * 100))
        if (tipo === 'repetida') {
          addLogEnvio(`• ${d.sede} ya estaba en esta tanda, se saltea`, 'info')
          avance(); continue
        }
        if (tipo === 'sin_email') {
          addLogEnvio(`✗ ${d.sede} no tiene email cargado: se saltea (cargalo en Sedes → Sedes y objetivos)`, 'error')
          resumenItems.push({ sede: d.sede, email: '', estado: 'error' })
          avance(); continue
        }
        // Destinos contra el estado vivo de lo ya enviado (no contra la foto
        // del momento en que arrancó la tanda): si mientras tanto quedó
        // registrada como enviada, no se le vuelve a mandar.
        const todas = direccionesDe(d.email)
        let dirs = todas
        if (!esReenvio) {
          const ya = yaRecibieron(d, dirEnviadasRef.current)
          if (ya.length && ya.length === todas.length) {
            if (!avisadas.has(cod)) addLogEnvio(`• ${d.sede}: ya había salido a ${ya.join(', ')}`, 'info')
            avance(); continue
          }
          dirs = destinosDe(d, dirEnviadasRef.current)
        }
        const parcial = dirs.length < todas.length
        try {
          const htmlRich = buildEmailHTML(d, campNom, template)
          okDirs[cod] = await mandarA(d, dirs, {
            html: htmlRich, subject: 'Como Vamos — ' + campNom + ' — ' + fmtFecha(d.fecha || fechaRef),
            fecha: d.fecha || fechaRef, campNom,
          })
          okCods.push(cod)
          addLogEnvio(`✓ ${d.sede}${parcial ? ' (solo a ' + dirs.join(', ') + ')' : ''}${esReenvio ? ' (reenviado)' : ''}`, 'ok')
          resumenItems.push(itemPorCod[cod] = { sede: d.sede, email: dirs.join(', '), estado: 'enviado' })
        } catch (e) {
          // Sin sesión no tiene sentido seguir: cada sede daría el mismo error
          if (e?.message === 'AUTH_REQUIRED') {
            addLogEnvio(`✗ La sesión venció: se cortó el envío en ${d.sede}. Volvé a entrar y mandá las que quedaron pendientes.`, 'error')
            return true
          }
          addLogEnvio(`✗ Error en ${d.sede}${e?.message ? ' — ' + e.message : ''}`, 'error')
          resumenItems.push(itemPorCod[cod] = { sede: d.sede, email: dirs.join(', '), estado: 'error' })
          if (e?.dir) { errDirs[cod] = [e.dir]; intentos[cod] = { dirs, salieron: e.salieron || [] } }
        }
        avance()
      }

      // Verificación contra el log real: el tilde verde vale solo si Apps Script
      // dejó la fila en log_envios. Si no quedó registrada, se saca el tilde acá
      // mismo en vez de que la sede aparezca como enviada hasta el próximo F5.
      const { faltantes, recuperadas } = await verificarContraLog({ okCods, okDirs, errDirs, desde: desdeEnvio, campNom, lista })
      faltantes.forEach(cod => { if (itemPorCod[cod]) itemPorCod[cod].estado = 'error' })
      // Una sede que figuraba con error pasa a enviada si todas las
      // direcciones de esta tanda terminaron saliendo
      recuperadas.forEach(({ cod, dirs }) => {
        const it = intentos[cod]
        const ok = new Set([...(it?.salieron || []), ...dirs].map(a => a.toLowerCase()))
        if (it && itemPorCod[cod] && it.dirs.every(a => ok.has(a.toLowerCase()))) itemPorCod[cod].estado = 'enviado'
      })

      addLogEnvio(`Listo. ${plan.filter(p => p.tipo !== 'repetida').length} emails procesados.`, 'ok')
      // Un solo resumen consolidado a Cele con toda la tanda
      enviarResumenCele(campNom, fechaRef, resumenItems).catch(() => {})
      return true
    } finally {
      ocupadoRef.current = false
      setEnvio(s => ({ ...s, enviando: false, ocupado: false }))
    }
  }, [addLogEnvio, markCopied, mandarA, verificarContraLog])

  // Envío suelto de una sede (vista previa o ↻), con el mismo candado que la
  // tanda. Sale a las direcciones que faltan (o a todas si ya las tenía).
  const enviarSede = useCallback(async (d, { template, campNom = '' } = {}) => {
    if (ocupadoRef.current) throw new Error('Hay un envío en curso: esperá a que termine')
    ocupadoRef.current = true
    setEnvio(s => ({ ...s, ocupado: true, sedeEnCurso: String(d.cod_sede) }))
    try {
      const fecha = d.fecha || hoyIso()
      const dirs = destinosDe(d, dirEnviadasRef.current)
      await mandarA(d, dirs, { html: buildEmailHTML(d, campNom, template), subject: 'Como Vamos — ' + campNom + ' — ' + fmtFecha(fecha), fecha, campNom })
      // Resumen a Cele de este envío individual
      enviarResumenCele(campNom, fecha, [{ sede: d.sede, email: dirs.join(', '), estado: 'enviado' }]).catch(() => {})
      return dirs
    } finally {
      ocupadoRef.current = false
      setEnvio(s => ({ ...s, ocupado: false, sedeEnCurso: null }))
    }
  }, [mandarA])

  // Guardar semana nueva en Sheets (o reemplazar si ya existe el corte — misma lógica que subirExcel)
  const guardarSemana = useCallback(async (fecha, sedesData, reemplazar = false) => {
    const camp = state.campanas.find(c => c.id === state.campanaActiva)
    const result = await post({
      action: 'agregar_semana',
      campana_id: state.campanaActiva,
      campana_nombre: camp?.nombre || '',
      fecha,
      sedes: sedesData,
      reemplazar,
    })
    cargarCampana(state.campanaActiva)
    return result
  }, [state.campanaActiva, state.campanas, cargarCampana])

  // Stats derivadas
  const stats = (() => {
    const { data } = state
    if (!data.length) return { total: 0, enObj: 0, enProg: 0, sinIng: 0, sinAv: 0, pctGlobal: 0, totalIng: 0, totalObj: 0 }
    let totalIng = 0, totalObj = 0, enObj = 0, enProg = 0, sinIng = 0, sinAv = 0
    data.forEach(d => {
      totalIng += d.total; totalObj += d.objetivo
      const pct = d.pct || 0
      if (d.total === 0) sinIng++
      else if (pct >= 50) enObj++
      else enProg++
      if (d.var === 0) sinAv++
    })
    return {
      total: data.length, enObj, enProg, sinIng, sinAv,
      pctGlobal: totalObj > 0 ? Math.round(totalIng / totalObj * 100) : 0,
      totalIng, totalObj,
    }
  })()

  // Subir Excel — parsea y guarda como nueva semana. Acepta reemplazar (cuando
  // ya existe un corte para esa fecha) y la fecha detectada por el parser del
  // header (prioritaria sobre la extraída del nombre del archivo).
  const subirExcel = useCallback(async (sedesData, fileName, reemplazar = false, fechaDesdeParser = null) => {
    let fecha = hoyIso()
    if (fechaDesdeParser) {
      fecha = fechaDesdeParser
    } else {
      const matchFecha = fileName?.match(/(\d{4}[-_]\d{2}[-_]\d{2})/)
      if (matchFecha) fecha = matchFecha[1].replace(/_/g, '-')
    }

    // Match únicamente por código — es el mismo criterio que usa la vista
    // previa (ExcelUploader → sinMatch) para avisar qué filas se van a
    // descartar. Antes había además dos fallbacks por nombre (exacto y por
    // prefijo de 8 caracteres) que quedaban efectivamente inactivos porque
    // el nombre que llegaba del Excel era en realidad el código de sede (ver
    // fix de iSede en ExcelUploader.jsx). Ahora que ese nombre es real, esos
    // fallbacks empezarían a matchear filas "por las dudas" que la vista
    // previa ya le dijo al usuario que se iban a descartar — mismo tipo de
    // sorpresa silenciosa que el resto de los arreglos de hoy. Se sacan: si
    // el código no matchea, la fila se descarta tal cual avisa la preview.
    const sedesSheet = state.sedes || []
    const sedesConCod = sedesData
      .map(s => {
        const match = sedesSheet.find(sh => String(sh.cod_sede) === String(s.cod))
        if (!match) return null
        return { cod: match.cod_sede, sede: match.sede, total: s.total }
      })
      .filter(s => s !== null && s.total !== undefined)

    if (!sedesConCod.length) {
      throw new Error('Ninguna sede del Excel coincide con las sedes de Buenos Aires registradas en Sheets.')
    }

    const camp = state.campanas?.find(c => c.id === state.campanaActiva)
    const res = await post({
      action: 'agregar_semana',
      campana_id: state.campanaActiva,
      campana_nombre: camp?.nombre || '',
      fecha,
      sedes: sedesConCod,
      reemplazar,
    })

    // Relectura: se vuelve a pedir a la planilla lo que quedó guardado para esa
    // fecha y se compara sede por sede con lo que se mandó. Si algo no
    // coincide, se avisa en rojo (y el corte se puede deshacer) en vez de dar
    // la carga por buena.
    let verificacion
    try {
      const hist = await jsonp('historial', { campana: state.campanaActiva })
      const guardado = new Map()
      hist.filter(r => String(r.fecha).slice(0, 10) === fecha).forEach(r => {
        const k = String(r.cod_sede)
        guardado.set(k, (guardado.get(k) || 0) + (Number(r.total) || 0))
      })
      const diferencias = []
      sedesConCod.forEach(s => {
        const k = String(s.cod)
        if (!guardado.has(k)) diferencias.push(`${s.sede}: no quedó guardada`)
        else if (guardado.get(k) !== Number(s.total)) diferencias.push(`${s.sede}: se mandó ${s.total} y quedó ${guardado.get(k)}`)
      })
      if (guardado.size !== sedesConCod.length) diferencias.push(`Quedaron ${guardado.size} sedes guardadas para el ${fecha} y se mandaron ${sedesConCod.length}`)
      verificacion = { ok: diferencias.length === 0, diferencias }
    } catch (e) {
      verificacion = { ok: false, diferencias: ['No se pudo releer la planilla para verificar: ' + e.message] }
    }
    cargarCampana(state.campanaActiva)
    return { ...res, verificacion }
  }, [state.campanaActiva, state.campanas, state.sedes, cargarCampana])

  return {
    ...state,
    copied,
    dirEnviadas,
    stats,
    cargarCampana,
    markCopied,
    markUncopied,
    envio,
    lanzarTanda,
    enviarSede,
    addLogEnvio,
    guardarSemana,
    subirExcel,
    refrescarSedes,
    refrescarCampanas,
  }
}

// Obtener historial de envíos registrado en Sheets
export function obtenerLogEnvios(limite = 200) {
  return jsonp('log_envios', { limite })
}

// Historial de una campaña puntual — para comparar campañas sin pisar el
// estado de la campaña activa que ya está cargada en pantalla.
export function obtenerHistorialCampana(campanaId) {
  return jsonp('historial', { campana: campanaId })
}

// El webhook de Make solo confirma que recibió el pedido, no que el mail
// salió de verdad (ver incidente del escenario desactivado) — esto marca a
// mano una tanda como confirmada cuando alguien la vio llegar de verdad.
export function confirmarEnvioLote(fecha, hora) {
  return post({ action: 'confirmar_envio_lote', fecha, hora })
}

// ── Notas por sede (mini-CRM de seguimiento) ────────────────────────────────
export function obtenerNotasSede(cod_sede) {
  return jsonp('notas_sede', { cod_sede })
}
export function agregarNotaSede(cod_sede, nota) {
  return post({ action: 'agregar_nota', cod_sede, nota })
}

// Manda a Cele un resumen consolidado de una tanda de envíos (individual o masiva)
export function enviarResumenCele(campana, fecha, items) {
  return jsonp('resumen_cele', {
    campana,
    fecha,
    items: JSON.stringify(items),
  })
}

// ── Gestión de sedes ────────────────────────────────────────────────────────
export function obtenerSedesTodas() {
  return jsonp('sedes_todas')
}
export function agregarSede(sede) {
  return post({ action: 'agregar_sede', ...sede })
}
export function editarSede(sede) {
  return post({ action: 'editar_sede', ...sede })
}
export function setSedeActiva(cod_sede, activa) {
  return post({ action: 'set_sede_activa', cod_sede, activa })
}
export function setObjetivo(campana_id, cod_sede, objetivo) {
  return post({ action: 'set_objetivo', campana_id, cod_sede, objetivo })
}
// Todas las notas de todas las sedes (la más nueva primero) — para mostrar
// la última nota de cada sede sin abrir su ficha.
export function obtenerNotasTodas() {
  return jsonp('notas_sede', { cod_sede: '' })
}

// ── Cierre de campaña ───────────────────────────────────────────────────────
export function obtenerObjetivos(campanaId) {
  return jsonp('objetivos', { campana: campanaId })
}
// { campana_id?, nueva?: { nombre, fin, objetivos: [{cod_sede, objetivo}] } }
export function cerrarCampana(payload) {
  return post({ action: 'cerrar_campana', ...payload })
}

// ── Deshacer y backup ───────────────────────────────────────────────────────
// Última operación reversible (carga de corte o cierre de campaña), o null
export function obtenerUltimoDeshacer() {
  return jsonp('ultimo_deshacer')
}
export function deshacerUltimo(id) {
  return post({ action: 'deshacer', id })
}
export function obtenerBackup() {
  return jsonp('backup')
}
// hojas: { campanas, objetivos, historial } — cada una [[header...], [fila...]]
export function restaurarBackup(hojas) {
  return post({ action: 'restaurar_backup', hojas })
}
// Misma validación y comparación contra la base actual, sin escribir nada
export function simularRestauracion(hojas) {
  return post({ action: 'restaurar_backup', hojas, simular: true })
}

// ── Configuración editable (plantilla de email, etc.) ───────────────────────
export function obtenerConfig() {
  return jsonp('config')
}
export function guardarConfig(claves) {
  return post({ action: 'set_config', claves })
}

export { post, jsonp }
