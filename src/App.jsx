import { useState } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import { useSheets, useAuth } from './hooks/useSheets'
import { C, F, useClosingTransition, pageBackgroundStyle } from './lib/theme'
import Sidebar from './components/Sidebar'
import ExcelUploader from './components/ExcelUploader'
import InformesPDF from './components/InformesPDF'
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
        <div style={{ background: 'rgba(156,43,52,0.15)', border: `1px solid rgba(156,43,52,0.35)`, borderRadius: 3, padding: '12px 20px', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ color: '#e8828a', fontSize: 13, lineHeight: 1.5, fontFamily: F.body }}>❌ {error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            border: `3px solid rgba(169,129,46,0.2)`, borderTopColor: C.brass,
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: F.mono }}>Conectando con Google Sheets…</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Tag({ children, tone = 'ink' }) {
  const tones = {
    ink:    { border: 'rgba(23,35,63,0.25)', color: C.ink,     bg: 'transparent' },
    ok:     { border: 'rgba(47,109,79,0.35)', color: C.ok,      bg: 'rgba(47,109,79,0.06)' },
    solid:  { border: C.ink,                  color: '#fff',    bg: C.ink },
  }
  const t = tones[tone]
  return (
    <div style={{
      padding: '5px 11px', borderRadius: 2, background: t.bg,
      border: `1px solid ${t.border}`, fontSize: 10.5, fontWeight: 600, color: t.color,
      fontFamily: F.mono, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

function PageHeader({ title, sub, campana, fecha, sedes, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 18, marginBottom: 26, position: 'relative',
      flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, ...ledgerRuleStyle() }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 25, fontWeight: 600, color: C.ink, letterSpacing: '0.001em' }}>{title}</h1>
        {sub && <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft, fontFamily: F.body }}>{sub}</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {campana && <Tag tone="ok">{campana}</Tag>}
        {fecha && <Tag tone="ink">Corte · {fmtFecha(fecha)}</Tag>}
        {sedes !== undefined && <Tag tone="solid">{sedes} sedes</Tag>}
        {children}
      </div>
    </div>
  )
}

function ledgerRuleStyle() {
  return { height: 1, background: `linear-gradient(90deg, ${C.ink} 0%, ${C.ink} 55%, ${C.crimson} 100%)`, opacity: 0.55 }
}

const VIEW_META = {
  dashboard: { title: 'Dashboard',  sub: 'Visión general de la campaña activa' },
  sedes:     { title: 'Sedes',      sub: 'Estado individual por sede' },
  historial: { title: 'Historial',  sub: 'Evolución semanal y comparación de sedes' },
  envio:     { title: 'Envío',      sub: 'Gestión de emails semanales' },
}

function AppShell({ onLogout }) {
  const [view, setView] = useState('dashboard')
  const [sedesComparacion, setSedesComparacion] = useState([])
  const isMobile = useIsMobile()

  const {
    loading, error, campanas, sedes, campanaActiva, data, historial,
    copied, stats, cargarCampana, markCopied, markAllCopied,
    guardarSemana, subirExcel, refrescarSedes,
  } = useSheets()

  if (loading || error) return <LoadingScreen error={error} />

  const camp = campanas?.find(c => c.id === campanaActiva)
  const fecha = data[0]?.fecha || null
  const meta = VIEW_META[view]

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      ...pageBackgroundStyle(),
    }}>
      <Sidebar
        view={view} onView={setView}
        campanaActiva={campanaActiva} campanas={campanas}
        onCampana={cargarCampana}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px 14px' : '28px 32px', overflowY: 'auto' }}>
        <PageHeader
          title={meta.title} sub={meta.sub}
          campana={camp?.nombre} fecha={fecha}
          sedes={view === 'dashboard' || view === 'sedes' ? data.length : undefined}
        >
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
          {view === 'dashboard' && camp?.estado === 'activa' && (
            <ExcelUploader
              data={data}
              onUpload={subirExcel}
              campanas={campanas}
              campanaActiva={campanaActiva}
              sedesConocidas={sedes}
            />
          )}

          {view === 'dashboard' && (
            <Dashboard data={data} stats={stats} historial={historial} campanas={campanas} campanaActiva={campanaActiva} />
          )}
          {view === 'sedes' && (
            <Sedes data={data} campanas={campanas} campanaActiva={campanaActiva} onSedesChanged={refrescarSedes} />
          )}
          {view === 'historial' && (
            <Historial historial={historial} data={data} campanas={campanas} campanaActiva={campanaActiva} onSeleccionChange={setSedesComparacion} />
          )}
          {view === 'envio' && (
            <Envio
              data={data} copied={copied} onCopied={markCopied}
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
      position: 'fixed', inset: 0, background: 'rgba(23,35,63,0.65)',
      zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{
        background: C.paperRaised, borderRadius: 3, padding: '30px 28px', maxWidth: 380, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,.35)', textAlign: 'center', border: `1px solid ${C.rule}`,
      }}>
        <div style={{ fontSize: 30, marginBottom: 14 }}>⏰</div>
        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Tu sesión expiró</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 22, lineHeight: 1.55, fontFamily: F.body }}>
          Iniciá sesión de nuevo para continuar. Si estabas cargando una semana manualmente, tus valores quedaron guardados y se restauran al volver a entrar.
        </div>
        <button onClick={requestClose} className="btn-press" style={{
          padding: '11px 24px', borderRadius: 3, fontSize: 13, fontWeight: 600, fontFamily: F.body,
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
