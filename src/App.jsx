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

function LoadingScreen({ error }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.ink,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <img src={ISOTIPO_B64} alt="UCASAL" style={{ width: 90, height: 'auto' }} />
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 19, marginBottom: 5 }}>UCASAL · Gestión Comercial</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: F.mono }}>Dirección Operativa SEAD · Buenos Aires</div>
      </div>
      {error ? (
        <div style={{ background: 'rgba(200,16,46,0.15)', border: `1px solid rgba(200,16,46,0.35)`, borderRadius: 8, padding: '12px 20px', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ color: '#e8828a', fontSize: 13, lineHeight: 1.5, fontFamily: F.body }}>{error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            border: `3px solid rgba(127,178,240,0.2)`, borderTopColor: C.brass,
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: F.mono }}>Conectando con Google Sheets…</div>
        </div>
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
