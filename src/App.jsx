import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import { useSheets, useAuth, obtenerNotasTodas } from './hooks/useSheets'
import { C, F, useClosingTransition, pageBackgroundStyle, rotulo } from './lib/theme'
import TopBar from './components/TopBar'
import ExcelUploader from './components/ExcelUploader'
import InformesPDF from './components/InformesPDF'
import { AccionesCampana, PanelCerrada, DeshacerModal, useUltimaOp, situacionCampana } from './components/CampanaAcciones'
import LineaSemana from './components/LineaSemana'
import FichaSede from './components/FichaSede'
import BuscadorSedes from './components/BuscadorSedes'
import { calcularParaLlamar, ultimaNotaPorSede } from './lib/analisis'
import { fmtFecha, siglasSedes } from './lib/formato'
import Login from './components/Login'
import Dashboard from './views/Dashboard'
import Sedes from './views/Sedes'
import Historial from './views/Historial'
import Envio from './views/Envio'
import { ISOTIPO_B64 } from './assets/isotipo'

// Pantalla de carga: la regla vacía que se va llenando de marcas mientras
// llegan los datos (mismo motivo del login y del tablero).
function LoadingScreen({ error }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.ink, color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24,
      borderTop: `3px solid ${C.crimson}`, fontFamily: F.body,
    }}>
      <img src={ISOTIPO_B64} alt="UCASAL" style={{ width: 44, height: 'auto' }} />
      {error ? (
        <div role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontStretch: '108%' }}>No se pudo conectar con la planilla</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8, lineHeight: 1.5 }}>{error}</div>
          <button onClick={() => window.location.reload()} className="btn-press" style={{
            marginTop: 18, height: 40, padding: '0 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: C.celeste, color: C.ink, fontSize: 14, fontWeight: 800,
          }}>Reintentar</button>
        </div>
      ) : (
        <>
          <svg width="240" height="34" viewBox="0 0 240 34" aria-hidden="true">
            <line x1="4" x2="236" y1="26" y2="26" stroke="rgba(255,255,255,0.35)" />
            {Array.from({ length: 16 }, (_, i) => <line key={i} x1={4 + i * 15.47} x2={4 + i * 15.47} y1="26" y2={i % 5 === 0 ? 32 : 29} stroke="rgba(255,255,255,0.35)" />)}
            <line x1={4 + 232 * 2 / 3} x2={4 + 232 * 2 / 3} y1="4" y2="26" stroke={C.celeste} strokeWidth="1.5" />
            {[14, 38, 62, 86, 110, 134, 158, 182, 206].map((x, i) => (
              <circle key={x} cx={x} cy="18" r="4.5" fill={i < 3 ? '#F5B83D' : '#3DD598'} style={{ animation: `pulse-ring 1.4s ease ${i * 0.12}s infinite` }} />
            ))}
          </svg>
          <div style={{ fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Trayendo los cortes de la planilla…</div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Encabezado de cada sección: la campaña como contexto arriba, el nombre
// de la sección grande y los datos del corte en una línea.
function PageHeader({ title, campana, fecha, sedes, aviso, children }) {
  const meta = [fecha && `Corte del ${fmtFecha(fecha)}`, sedes !== undefined && `${sedes} sedes`].filter(Boolean)
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: 24, flexWrap: 'wrap', gap: 14,
    }}>
      <div>
        {campana && <div style={{ ...rotulo, color: C.navy, marginBottom: 6 }}>{campana}</div>}
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 34, fontWeight: 800, fontStretch: '112%', color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{title}</h1>
        {meta.length > 0 && <div style={{ marginTop: 8, fontSize: 13.5, color: C.inkSoft, fontFamily: F.body }}>{meta.join(' · ')}</div>}
        {aviso && <div role="status" style={{ marginTop: 6, fontSize: 13.5, color: C.crimson, fontWeight: 700, fontFamily: F.body }}>{aviso}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  )
}

const VIEW_META = {
  dashboard: { title: 'Cómo vamos' },
  sedes:     { title: 'Sedes' },
  historial: { title: 'Historial' },
  envio:     { title: 'Envío semanal' },
}

// Aviso breve abajo a la derecha (se va solo)
function Aviso({ aviso, onClose }) {
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(onClose, aviso.ms || 6000)
    return () => clearTimeout(t)
  }, [aviso]) // eslint-disable-line
  if (!aviso) return null
  const tonos = { ok: C.ok, error: C.crimson, info: C.navy }
  return (
    <div role="status" aria-live="polite" className="animate-fadeUp" style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 9800, maxWidth: 380,
      background: C.ink, color: '#fff', borderRadius: 12, padding: '14px 16px 14px 18px',
      borderLeft: `5px solid ${tonos[aviso.tono || 'ok']}`, boxShadow: '0 18px 40px -12px rgba(14,23,51,.55)',
      display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: F.body, fontSize: 14, lineHeight: 1.45,
    }}>
      <span style={{ flex: 1 }}>{aviso.texto}</span>
      <button onClick={onClose} aria-label="Cerrar aviso" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
    </div>
  )
}

function AppShell({ onLogout }) {
  const [view, setView] = useState('dashboard')
  const [sedesComparacion, setSedesComparacion] = useState([])
  const [uploaderAbierto, setUploaderAbierto] = useState(null) // null = automático
  const [fichaCod, setFichaCod] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [deshaciendo, setDeshaciendo] = useState(false)
  const [notas, setNotas] = useState([])
  const [aviso, setAviso] = useState(null)
  const isMobile = useIsMobile()

  const {
    loading, recargando, error, errorRecarga, campanas, sedes, campanaActiva, data, historial,
    copied, stats, cargarCampana, markCopied, markUncopied,
    guardarSemana, subirExcel, refrescarSedes, refrescarCampanas,
  } = useSheets()

  const ultimaOp = useUltimaOp(historial, campanas)

  // Todas las notas de seguimiento, para mostrar la última de cada sede
  const cargarNotas = useCallback(() => {
    obtenerNotasTodas().then(setNotas).catch(() => {})
  }, [])
  useEffect(() => { if (!loading) cargarNotas() }, [loading]) // eslint-disable-line
  const notasPorSede = useMemo(() => ultimaNotaPorSede(notas), [notas])
  const paraLlamar = useMemo(() => calcularParaLlamar(historial, data), [historial, data])
  const siglas = useMemo(() => siglasSedes(data), [data])

  // Ctrl+K / ⌘K abre el buscador de sedes desde cualquier pantalla (si hay
  // un corte cargado: sin datos no hay nada que buscar)
  const hayDatosRef = useRef(false)
  hayDatosRef.current = data.length > 0
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (hayDatosRef.current) setBuscando(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (errorRecarga) setAviso({ texto: `No se pudieron actualizar los datos: ${errorRecarga}`, tono: 'error', ms: 9000 }) }, [errorRecarga])

  if (loading || error) return <LoadingScreen error={error} />

  const camp = campanas?.find(c => c.id === campanaActiva)
  const { activa, cerrada, vencida, fin } = situacionCampana(camp)
  const fecha = data[0]?.fecha || null
  const meta = VIEW_META[view]
  const fichaSede = fichaCod ? data.find(d => String(d.cod_sede) === String(fichaCod)) : null

  const irA = (v) => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const abrirUploader = () => {
    setView('dashboard'); setUploaderAbierto(true)
    setTimeout(() => document.getElementById('carga-excel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const irALlamar = () => {
    setView('dashboard')
    setTimeout(() => document.getElementById('para-llamar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const onDeshecho = async (res) => {
    await refrescarCampanas(res.campana_id || campanaActiva)
    setAviso({ texto: `Listo: se deshizo “${res.descripcion}”.`, tono: 'info' })
  }

  return (
    <div style={{ minHeight: '100vh', ...pageBackgroundStyle() }}>
      <TopBar
        view={view} onView={irA}
        campanaActiva={campanaActiva} campanas={campanas}
        onCampana={cargarCampana}
        onLogout={onLogout}
        onBuscar={data.length ? () => setBuscando(true) : null}
        recargando={recargando}
      />

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '20px 14px 56px' : '32px 24px 72px', opacity: recargando ? 0.72 : 1, transition: 'opacity .2s' }}>
        <PageHeader
          title={meta.title}
          campana={camp?.nombre} fecha={fecha}
          sedes={(view === 'dashboard' || view === 'sedes') && data.length ? data.length : undefined}
          aviso={view === 'dashboard' && vencida ? `La campaña terminó el ${fmtFecha(fin)}: cuando esté todo cargado, cerrala para arrancar la siguiente.` : null}
        >
          {data.length > 0 && (
            <InformesPDF
              data={data} historial={historial}
              campanas={campanas} campanaActiva={campanaActiva}
              sedesSeleccionadas={sedesComparacion}
            />
          )}
          {view === 'dashboard' && (
            <AccionesCampana
              campanas={campanas} campanaActiva={campanaActiva}
              data={data} stats={stats} sedes={sedes} historial={historial}
              onCampanasChanged={refrescarCampanas}
              onRecargarCampana={cargarCampana}
            />
          )}
        </PageHeader>

        {/* key={view} fuerza un remonte al cambiar de sección, así la
            transición de entrada (.view-enter) se dispara cada vez — la
            navegación se siente como un cambio de pantalla, no un corte. */}
        <div key={view} className="view-enter">
          {view === 'dashboard' && activa && (
            <LineaSemana
              data={data} copied={copied} paraLlamar={paraLlamar} ultimaOp={ultimaOp} vencida={vencida}
              onCargarExcel={abrirUploader} onIrEnvio={() => irA('envio')} onIrLlamar={irALlamar}
              onDeshacer={() => setDeshaciendo(true)}
            />
          )}
          {view === 'dashboard' && cerrada && data.length > 0 && (
            <PanelCerrada camp={camp} data={data} stats={stats} historial={historial} />
          )}

          {view === 'dashboard' && activa && (
            <div id="carga-excel" style={{ scrollMarginTop: 90 }}>
              <ExcelUploader
                data={data}
                historial={historial}
                onUpload={subirExcel}
                onGuardado={(txt) => setAviso({ texto: txt, tono: 'ok' })}
                campanas={campanas}
                campanaActiva={campanaActiva}
                sedesConocidas={sedes}
                abierto={uploaderAbierto} onAbierto={setUploaderAbierto}
              />
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard
              data={data} stats={stats} historial={historial} campanas={campanas} campanaActiva={campanaActiva}
              paraLlamar={paraLlamar} notasPorSede={notasPorSede} siglas={siglas}
              onAbrirSede={(d) => setFichaCod(d.cod_sede)}
              vacio={cerrada ? {
                titulo: 'Esta campaña no tiene cortes cargados',
                texto: 'Quedó cerrada sin datos. Elegí otra campaña arriba a la derecha.',
              } : ultimaOp?.accion === 'cerrar_campana' && activa ? {
                titulo: 'Campaña nueva, todavía sin cortes',
                texto: 'Cargá el primer Excel para empezar. Si la abriste por error, podés volver atrás.',
                accion: { label: 'Deshacer el cierre de la campaña anterior', onClick: () => setDeshaciendo(true) },
              } : null}
            />
          )}
          {view === 'sedes' && (
            <Sedes data={data} campanas={campanas} campanaActiva={campanaActiva}
              onSedesChanged={() => { refrescarSedes(); cargarCampana(campanaActiva) }}
              onAbrirSede={(d) => setFichaCod(d.cod_sede)} />
          )}
          {view === 'historial' && (
            <Historial historial={historial} data={data} campanas={campanas} campanaActiva={campanaActiva} onSeleccionChange={setSedesComparacion} />
          )}
          {view === 'envio' && (
            <Envio
              data={data} copied={copied} onCopied={markCopied} onUncopied={markUncopied}
              campanas={campanas} campanaActiva={campanaActiva}
              guardarSemana={guardarSemana} siglas={siglas}
            />
          )}
        </div>
      </main>

      {fichaSede && (
        <FichaSede d={fichaSede} sigla={siglas[String(fichaSede.cod_sede)]} historial={historial} onClose={() => setFichaCod(null)} onNotaAgregada={cargarNotas} />
      )}
      {buscando && (
        <BuscadorSedes data={data} siglas={siglas} onClose={() => setBuscando(false)}
          onElegir={(d) => { setBuscando(false); setFichaCod(d.cod_sede) }} />
      )}
      {deshaciendo && ultimaOp && (
        <DeshacerModal op={ultimaOp} onClose={() => setDeshaciendo(false)} onDone={onDeshecho} />
      )}
      <Aviso aviso={aviso} onClose={() => setAviso(null)} />
    </div>
  )
}

function SessionExpiredModal({ onDismiss }) {
  const [closing, requestClose] = useClosingTransition(onDismiss)
  return (
    <div role="alertdialog" aria-modal="true" aria-label="La sesión venció" className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,51,0.65)',
      zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{
        background: C.paperRaised, borderRadius: 14, padding: '28px 26px 24px', maxWidth: 400, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(14,23,51,.55)', borderTop: `5px solid ${C.crimson}`, fontFamily: F.body,
      }}>
        <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 800, fontStretch: '108%', color: C.ink }}>La sesión venció</div>
        <div style={{ fontSize: 14.5, color: C.inkSoft, margin: '10px 0 22px', lineHeight: 1.55 }}>
          Por seguridad dura unas horas. Volvé a entrar con la contraseña para seguir. Si estabas cargando un corte a mano, los números quedaron guardados y aparecen al volver.
        </div>
        <button onClick={requestClose} className="btn-press" autoFocus style={{
          width: '100%', height: 46, borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: F.body,
          background: C.navy, color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          Volver a entrar
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { authed, loading, error, login, logout, sessionExpired, dismissSessionExpired } = useAuth()

  return (
    <>
      {!authed
        ? <Login onLogin={login} error={error} loading={loading} />
        : <AppShell onLogout={logout} />}
      {sessionExpired && <SessionExpiredModal onDismiss={dismissSessionExpired} />}
    </>
  )
}
