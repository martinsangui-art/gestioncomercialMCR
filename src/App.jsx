import { useState } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import { useSheets, useAuth } from './hooks/useSheets'
import { C, F, useClosingTransition, pageBackgroundStyle, rotulo } from './lib/theme'
import TopBar from './components/TopBar'
import ExcelUploader from './components/ExcelUploader'
import InformesPDF from './components/InformesPDF'
import CampanaBar from './components/CampanaBar'
import Login from './components/Login'
import Dashboard from './views/Dashboard'
import Sedes from './views/Sedes'
import Historial from './views/Historial'
import Envio from './views/Envio'
import { ISOTIPO_B64 } from './assets/isotipo'

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

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
function PageHeader({ title, campana, fecha, sedes, children }) {
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

function AppShell({ onLogout }) {
  const [view, setView] = useState('dashboard')
  const [sedesComparacion, setSedesComparacion] = useState([])
  const [uploaderAbierto, setUploaderAbierto] = useState(null) // null = automático
  const isMobile = useIsMobile()

  const {
    loading, error, campanas, sedes, campanaActiva, data, historial,
    copied, stats, cargarCampana, markCopied, markUncopied, markAllCopied,
    guardarSemana, subirExcel, refrescarSedes, refrescarCampanas,
  } = useSheets()

  if (loading || error) return <LoadingScreen error={error} />

  const camp = campanas?.find(c => c.id === campanaActiva)
  const fecha = data[0]?.fecha || null
  const meta = VIEW_META[view]

  return (
    <div style={{ minHeight: '100vh', ...pageBackgroundStyle() }}>
      <TopBar
        view={view} onView={setView}
        campanaActiva={campanaActiva} campanas={campanas}
        onCampana={cargarCampana}
        onLogout={onLogout}
      />

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '32px 24px 64px' }}>
        <PageHeader
          title={meta.title}
          campana={camp?.nombre} fecha={fecha}
          sedes={view === 'dashboard' || view === 'sedes' ? data.length : undefined}
        >
          {view === 'dashboard' && camp?.estado === 'activa' && data.length > 0 && !uploaderAbierto && (
            <button onClick={() => setUploaderAbierto(true)} className="btn-press" style={{
              height: 38, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: C.navy, color: '#fff', fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              Cargar Excel del corte
            </button>
          )}
          {data.length > 0 && (
            <InformesPDF
              data={data} historial={historial}
              campanas={campanas} campanaActiva={campanaActiva}
              sedesSeleccionadas={sedesComparacion}
            />
          )}
        </PageHeader>

        {/* key={view} fuerza un remonte al cambiar de sección, así la
            transición de entrada (.view-enter) se dispara cada vez — la
            navegación se siente como un cambio de pantalla, no un corte. */}
        <div key={view} className="view-enter">
          {view === 'dashboard' && (
            <CampanaBar
              campanas={campanas} campanaActiva={campanaActiva}
              data={data} stats={stats} sedes={sedes} historial={historial}
              onCampanasChanged={refrescarCampanas}
              onRecargarCampana={cargarCampana}
            />
          )}

          {view === 'dashboard' && camp?.estado === 'activa' && (
            <ExcelUploader
              data={data}
              onUpload={subirExcel}
              campanas={campanas}
              campanaActiva={campanaActiva}
              sedesConocidas={sedes}
              abierto={uploaderAbierto} onAbierto={setUploaderAbierto}
            />
          )}

          {view === 'dashboard' && (
            <Dashboard data={data} stats={stats} historial={historial} campanas={campanas} campanaActiva={campanaActiva} />
          )}
          {view === 'sedes' && (
            <Sedes data={data} historial={historial} campanas={campanas} campanaActiva={campanaActiva} onSedesChanged={refrescarSedes} />
          )}
          {view === 'historial' && (
            <Historial historial={historial} data={data} campanas={campanas} campanaActiva={campanaActiva} onSeleccionChange={setSedesComparacion} />
          )}
          {view === 'envio' && (
            <Envio
              data={data} copied={copied} onCopied={markCopied} onUncopied={markUncopied}
              campanas={campanas} campanaActiva={campanaActiva}
              guardarSemana={guardarSemana}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function SessionExpiredModal({ onDismiss }) {
  const [closing, requestClose] = useClosingTransition(onDismiss)
  return (
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,51,0.65)',
      zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{
        background: C.paperRaised, borderRadius: 8, padding: '30px 28px', maxWidth: 380, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,.35)', textAlign: 'center', border: `1px solid ${C.rule}`,
      }}>
        <div style={{ fontSize: 30, marginBottom: 14 }}></div>
        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Tu sesión expiró</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 22, lineHeight: 1.55, fontFamily: F.body }}>
          Iniciá sesión de nuevo para continuar. Si estabas cargando una semana manualmente, tus valores quedaron guardados y se restauran al volver a entrar.
        </div>
        <button onClick={requestClose} className="btn-press" style={{
          padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body,
          background: C.crimson, color: '#fff', border: 'none', cursor: 'pointer', width: '100%',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Iniciar sesión de nuevo
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
