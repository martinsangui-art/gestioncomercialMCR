import { useState } from 'react'
import { LOGO_SIDEBAR_B64 } from '../assets/logo_sidebar'

const NAV = [
  { id: 'dashboard', icon: '◎', label: 'Dashboard' },
  { id: 'sedes',     icon: '⊞', label: 'Sedes' },
  { id: 'historial', icon: '◷', label: 'Historial' },
  { id: 'envio',     icon: '✉', label: 'Envío' },
]

export default function Sidebar({ view, onView, campanaActiva, campanas, onCampana, onLogout }) {
  const [expanded, setExpanded] = useState(true)
  const camp = campanas?.find(c => c.id === campanaActiva)

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 z-40 transition-all duration-300"
      style={{
        width: expanded ? 220 : 64,
        background: 'linear-gradient(180deg, #0B1730 0%, #0f1d4a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      {/* Logo + toggle */}
      <div
        className="flex items-center px-4 py-5 border-b border-white/5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        title={expanded ? 'Colapsar' : 'Expandir'}
        style={{ minHeight: 64 }}
      >
        {expanded ? (
          <div className="animate-fadeIn" style={{ width: '100%' }}>
            <img
              src={LOGO_SIDEBAR_B64}
              alt="UCASAL Educación Digital"
              style={{ width: '100%', maxWidth: 168, display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            />
            <div className="text-white/40 text-xs mt-1.5">Gestión Comercial</div>
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: '#C8102E', letterSpacing: '-0.5px' }}
          >
            U
          </div>
        )}
      </div>

      {/* Campaña activa */}
      {expanded && campanas?.length > 0 && (
        <div className="px-3 py-3 border-b border-white/5 animate-fadeIn">
          <div className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2 px-1">Campaña</div>
          <div className="flex flex-col gap-1">
            {campanas.map(c => (
              <button
                key={c.id}
                onClick={() => onCampana(c.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150 group"
                style={{
                  background: campanaActiva === c.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: campanaActiva === c.id ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: c.estado === 'activa' ? '#52b788' : '#6b7280' }}
                />
                <span className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">
                  {c.nombre}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-1">
        {NAV.map(item => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => onView(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group w-full text-left"
              style={{
                background: active ? 'rgba(200,16,46,0.15)' : 'transparent',
                border: active ? '1px solid rgba(200,16,46,0.25)' : '1px solid transparent',
              }}
              title={!expanded ? item.label : undefined}
            >
              <span
                className="text-base flex-shrink-0 transition-colors"
                style={{
                  color: active ? '#f87171' : 'rgba(255,255,255,0.4)',
                  width: 20, textAlign: 'center',
                }}
              >
                {item.icon}
              </span>
              {expanded && (
                <span
                  className="text-sm font-medium transition-colors animate-fadeIn"
                  style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}
                >
                  {item.label}
                </span>
              )}
              {active && (
                <span
                  className="ml-auto w-1 h-4 rounded-full flex-shrink-0"
                  style={{ background: '#C8102E' }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/5">
        {expanded ? (
          <div className="animate-fadeIn">
            <button
              onClick={onLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 10px', borderRadius: 8, marginBottom: 10,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)', fontSize: 11.5, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,16,46,0.1)'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            >
              <span style={{ fontSize: 13 }}>⏻</span> Cerrar sesión
            </button>
            <div className="text-white/20 text-xs leading-relaxed">
              Dirección Operativa SEAD<br />
              Zona Buenos Aires
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 10, color: 'rgba(255,255,255,0.15)', lineHeight: 1.6,
            }}>
              Diseño y desarrollo<br />
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>Martín Sanguinetti</span><br />
              martinsangui@gmail.com
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button onClick={onLogout} title="Cerrar sesión" style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', fontSize: 14,
            }}>⏻</button>
            <div className="w-2 h-2 rounded-full" style={{ background: '#C8102E' }} />
          </div>
        )}
      </div>
    </aside>
  )
}
