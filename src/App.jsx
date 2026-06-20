import { useState } from 'react'
import { useSheets, useAuth } from './hooks/useSheets'
import Sidebar from './components/Sidebar'
import ExcelUploader from './components/ExcelUploader'
import InformesPDF from './components/InformesPDF'
import Login from './components/Login'
import Dashboard from './views/Dashboard'
import Sedes from './views/Sedes'
import Historial from './views/Historial'
import Envio from './views/Envio'
import { LOGO_SIDEBAR_B64 } from './assets/logo_sidebar'

function LoadingScreen({ error }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B1730',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <img
        src={LOGO_SIDEBAR_B64}
        alt="UCASAL Educación Digital"
        style={{ width: 220, filter: 'brightness(0) invert(1)', opacity: 0.95 }}
      />
      <div style={{ textAlign: 'center', marginTop: -8 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Gestión Comercial</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Dirección Operativa SEAD · Buenos Aires</div>
      </div>
      {error ? (
        <div style={{ background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.3)', borderRadius: 10, padding: '12px 20px', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: 13, lineHeight: 1.5 }}>❌ {error}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#C8102E',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Conectando con Google Sheets…</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PageHeader({ title, sub, campana, fecha, sedes, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 20, marginBottom: 24, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #1B2A6B 0%, #1B2A6B 60%, #C8102E 100%)',
        opacity: 0.7,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: '#C8102E', flexShrink: 0 }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{title}</h1>
          {sub && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>{sub}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {campana && (
          <div style={{
            padding: '5px 12px', borderRadius: 7, background: 'rgba(236,253,245,0.8)',
            border: '1px solid #6ee7b7', fontSize: 11, fontWeight: 700, color: '#059669',
            fontFamily: 'monospace', letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>
            {campana}
          </div>
        )}
        {fecha && (
          <div style={{
            padding: '5px 12px', borderRadius: 7, background: 'rgba(27,42,107,0.06)',
            border: '1px solid rgba(27,42,107,0.15)', fontSize: 11, color: '#1B2A6B',
            fontFamily: 'monospace', letterSpacing: '0.03em', fontWeight: 600,
          }}>
            CORTE · {fecha}
          </div>
        )}
        {sedes !== undefined && (
          <div style={{
            padding: '5px 12px', borderRadius: 7, background: '#1B2A6B',
            border: '1px solid #1B2A6B', fontSize: 11, fontWeight: 700, color: '#fff',
            fontFamily: 'monospace', letterSpacing: '0.03em',
          }}>
            {sedes} SEDES
          </div>
        )}
        {children}
      </div>
    </div>
  )
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

  const {
    loading, error, campanas, sedes, campanaActiva, data, historial,
    copied, stats, cargarCampana, markCopied, markAllCopied,
    guardarSemana, subirExcel,
  } = useSheets()

  if (loading || error) return <LoadingScreen error={error} />

  const camp = campanas?.find(c => c.id === campanaActiva)
  const fecha = data[0]?.fecha || null
  const meta = VIEW_META[view]

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'radial-gradient(ellipse 1400px 1000px at 10% -10%, rgba(27,42,107,0.12) 0%, rgba(27,42,107,0.04) 40%, #f8fafc 75%), radial-gradient(ellipse 900px 700px at 100% 100%, rgba(200,16,46,0.05) 0%, transparent 60%)',
    }}>
      <Sidebar
        view={view} onView={setView}
        campanaActiva={campanaActiva} campanas={campanas}
        onCampana={cargarCampana}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px', overflowY: 'auto' }}>
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

        {view === 'dashboard' && camp?.estado === 'activa' && (
          <ExcelUploader
            data={data}
            onUpload={subirExcel}
            campanas={campanas}
            campanaActiva={campanaActiva}
          />
        )}

        {view === 'dashboard' && (
          <Dashboard data={data} stats={stats} historial={historial} campanas={campanas} campanaActiva={campanaActiva} />
        )}
        {view === 'sedes' && (
          <Sedes data={data} campanas={campanas} campanaActiva={campanaActiva} />
        )}
        {view === 'historial' && (
          <Historial historial={historial} data={data} onSeleccionChange={setSedesComparacion} />
        )}
        {view === 'envio' && (
          <Envio
            data={data} copied={copied} onCopied={markCopied}
            campanas={campanas} campanaActiva={campanaActiva}
            guardarSemana={guardarSemana}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  const { authed, loading, error, login, logout } = useAuth()

  if (!authed) {
    return <Login onLogin={login} error={error} loading={loading} />
  }

  return <AppShell onLogout={logout} />
}
