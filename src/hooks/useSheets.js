import { useState, useEffect, useCallback } from 'react'

const API = 'https://script.google.com/macros/s/AKfycbyqeOBpxtYxavx-Uc8mTVRhsqb6HhY6N1RETcvNNVorRuuHMb111XLh_pVYhbSBry4/exec'
const WEBHOOK = 'https://hook.us2.make.com/3xhcn02owq56c196s0j3anawf5zesxht'
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
// jsonp/post/enviarEmailViaScript viven fuera de React (no son hooks), así que
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

// Enviar email via Apps Script (evita CORS del browser con Make)
export function enviarEmailViaScript(payload) {
  return new Promise((resolve, reject) => {
    const cb = '_cb_email_' + Date.now()
    const url = API + '?action=enviar_email&callback=' + cb +
      '&token='    + encodeURIComponent(getToken()) +
      '&to='       + encodeURIComponent(payload.to) +
      '&subject='  + encodeURIComponent(payload.subject) +
      '&html='     + encodeURIComponent(payload.html) +
      '&sede='     + encodeURIComponent(payload.sede) +
      '&cod='      + encodeURIComponent(payload.cod) +
      '&fecha='    + encodeURIComponent(payload.fecha) +
      '&campana='  + encodeURIComponent(payload.campana || '')

    const timeout = setTimeout(() => { cleanup(); resolve({ ok: true }) }, 10000)
    window[cb] = (data) => {
      cleanup()
      if (data?.error === 'AUTH_REQUIRED') { setToken(''); notifyAuthExpired(); return }
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
  return fetch(API, { method: 'POST', body: JSON.stringify({ ...body, token: getToken() }) })
    .then(r => r.text())
    .then(t => {
      const r = JSON.parse(t)
      if (!r.ok) {
        if (r.error === 'AUTH_REQUIRED') { setToken(''); notifyAuthExpired() }
        throw new Error(r.error)
      }
      return r.data
    })
}

// ── Hook de autenticación ───────────────────────────────────────────────────
export function useAuth() {
  const [authed, setAuthed] = useState(!!getToken())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Cuando el token vence en cualquier llamada (jsonp/post/enviarEmailViaScript),
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
    loading: true,
    error: null,
    campanas: [],
    sedes: [],
    campanaActiva: null,
    data: [],           // semana actual procesada
    historial: [],      // historial completo
  })

  const [copied, setCopied] = useState({})  // {cod: true}

  // Carga inicial
  useEffect(() => {
    Promise.all([jsonp('campanas'), jsonp('sedes')])
      .then(([campanas, sedes]) => {
        const activa = campanas.find(c => c.estado === 'activa') || campanas[campanas.length - 1]
        setState(s => ({ ...s, campanas, sedes, campanaActiva: activa?.id || null, loading: false }))
      })
      .catch(err => {
        // El modal de "sesión expirada" ya se dispara desde jsonp() vía notifyAuthExpired();
        // acá solo evitamos mostrar un error genérico encima de ese modal.
        if (err.message === 'AUTH_REQUIRED') return
        setState(s => ({ ...s, loading: false, error: err.message }))
      })
  }, [])

  // Cargar datos cuando cambia campaña activa
  const cargarCampana = useCallback((campanaId) => {
    setState(s => ({ ...s, loading: true, error: null, campanaActiva: campanaId, data: [] }))
    setCopied({})

    Promise.all([
      jsonp('semana_actual', { campana: campanaId }),
      jsonp('historial', { campana: campanaId }),
    ]).then(([data, historial]) => {
      setState(s => ({ ...s, loading: false, data, historial }))

      // Sincronizar "enviadas" con el log real de envíos — si Cele recarga la
      // página a mitad de una tanda, al volver a entrar ya ve qué se mandó
      // (en vez de perder el track y tener que adivinar o reenviar de más).
      const fecha = data[0]?.fecha
      const camp = state.campanas.find(c => c.id === campanaId)
      if (fecha && camp) {
        jsonp('log_envios', { limite: 500 })
          .then(log => {
            const enviados = log
              .filter(r => r.fecha === fecha && r.estado === 'enviado' && String(r.campana || '').indexOf(camp.nombre) >= 0)
              .map(r => String(r.cod_sede))
            if (enviados.length) markAllCopied(enviados)
          })
          .catch(() => {}) // no crítico — si falla, simplemente no se pre-marca nada
      }
    }).catch(err => {
      // El modal de "sesión expirada" ya se dispara desde jsonp() vía notifyAuthExpired()
      if (err.message === 'AUTH_REQUIRED') return
      setState(s => ({ ...s, loading: false, error: err.message }))
    })
  }, [state.campanas]) // eslint-disable-line

  useEffect(() => {
    if (state.campanaActiva) cargarCampana(state.campanaActiva)
  }, [state.campanaActiva === null ? null : state.campanaActiva]) // eslint-disable-line

  // Marcar sede como copiada
  const markCopied = useCallback((cod) => {
    setCopied(prev => ({ ...prev, [cod]: true }))
  }, [])

  // Reemplaza el estado completo (útil para desmarcar también)
  const markAllCopied = useCallback((cods) => {
    if (Array.isArray(cods)) {
      setCopied(prev => {
        const next = { ...prev }
        cods.forEach(c => { next[c] = true })
        return next
      })
    } else {
      setCopied(cods)
    }
  }, [])

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
    let fecha = new Date().toISOString().slice(0, 10)
    if (fechaDesdeParser) {
      fecha = fechaDesdeParser
    } else {
      const matchFecha = fileName?.match(/(\d{4}[-_]\d{2}[-_]\d{2})/)
      if (matchFecha) fecha = matchFecha[1].replace(/_/g, '-')
    }

    const sedesSheet = state.sedes || []
    const sedesConCod = sedesData
      .map(s => {
        // Match por código exacto (prioritario), luego por nombre completo,
        // luego por prefijo de 8 caracteres (más conservador que 6)
        let match = sedesSheet.find(sh => String(sh.cod_sede) === String(s.cod))
        if (!match) match = sedesSheet.find(sh =>
          sh.sede?.toLowerCase() === s.sede?.toLowerCase()
        )
        if (!match) match = sedesSheet.find(sh =>
          sh.sede?.toLowerCase().includes(s.sede?.toLowerCase().slice(0, 8))
        )
        if (!match) return null // sede fuera de Buenos Aires — se descarta
        return { cod: match.cod_sede, sede: match.sede, total: s.total }
      })
      .filter(s => s !== null && s.total !== undefined)

    if (!sedesConCod.length) {
      throw new Error('Ninguna sede del Excel coincide con las sedes de Buenos Aires registradas en Sheets.')
    }

    const camp = state.campanas?.find(c => c.id === state.campanaActiva)
    return await post({
      action: 'agregar_semana',
      campana_id: state.campanaActiva,
      campana_nombre: camp?.nombre || '',
      fecha,
      sedes: sedesConCod,
      reemplazar,
    }).then(res => {
      cargarCampana(state.campanaActiva)
      return res
    })
  }, [state.campanaActiva, state.campanas, state.sedes, cargarCampana])

  return {
    ...state,
    copied,
    stats,
    cargarCampana,
    markCopied,
    markAllCopied,
    guardarSemana,
    subirExcel,
    WEBHOOK,
  }
}

// Obtener historial de envíos registrado en Sheets
export function obtenerLogEnvios(limite = 200) {
  return jsonp('log_envios', { limite })
}

// Manda a Cele un resumen consolidado de una tanda de envíos (individual o masiva)
export function enviarResumenCele(campana, fecha, items) {
  return jsonp('resumen_cele', {
    campana,
    fecha,
    items: JSON.stringify(items),
  })
}

export { post, jsonp }
