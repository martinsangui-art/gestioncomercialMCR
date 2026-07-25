import { useState } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'
import { useIsMobile } from '../hooks/useIsMobile'
import { C, F } from '../lib/theme'

const NAV = [
  { id: 'dashboard', icon: '◎', label: 'Dashboard' },
  { id: 'sedes',     icon: '⊞', label: 'Sedes' },
  { id: 'historial', icon: '◷', label: 'Historial' },
  { id: 'envio',     icon: '✉', label: 'Envío' },
]

export default function Sidebar({ view, onView, campanaActiva, campanas, onCampana, onLogout }) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(!isMobile)
  const [hovered, setHovered] = useState(null)

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 z-40 transition-all duration-300"
      style={{
        width: expanded ? 226 : 64,
        background: C.ink,
        backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 26px)`,
        borderRight: `1px solid rgba(169,129,46,0.18)`,
        flexShrink: 0,
      }}
    >
      {/* Membrete */}
      <div
        className="flex items-center gap-3 px-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        title={expanded ? 'Colapsar' : 'Expandir'}
        style={{ minHeight: 68, borderBottom: '1px solid rgba(169,129,46,0.18)' }}
      >
        <img src={ISOTIPO_B64} alt="UCASAL" style={{ width: 30, height: 'auto', display: 'block', flexShrink: 0 }} />
        {expanded && (
          <div className="animate-fadeIn overflow-hidden">
            <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 16, lineHeight: 1.1, letterSpacing: '0.01em' }}>UCASAL</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontFamily: F.mono, letterSpacing: '0.03em', marginTop: 2 }}>Gestión Comercial</div>
          </div>
        )}
      </div>

      {/* Campaña activa */}
      {expanded && campanas?.length > 0 && (
        <div className="animate-fadeIn" style={{ padding: '14px 12px', borderBottom: '1px solid rgba(169,129,46,0.18)' }}>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, padding: '0 4px' }}>
            Campaña
          </div>
          <div className="flex flex-col gap-0.5">
            {campanas.map(c => {
              const activa = campanaActiva === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => onCampana(c.id)}
                  className="flex items-center gap-2.5 text-left transition-all duration-150"
                  style={{
                    padding: '7px 9px',
                    background: activa ? 'rgba(169,129,46,0.12)' : 'transparent',
                    borderLeft: `2px solid ${activa ? C.brass : 'transparent'}`,
                    fontFamily: F.body,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: c.estado === 'activa' ? '#4CA678' : 'rgba(255,255,255,0.25)' }}
                  />
                  <span style={{ color: activa ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: activa ? 600 : 500 }} className="truncate">
                    {c.nombre}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Índice de secciones */}
      <nav className="flex-1" style={{ padding: '10px 0' }}>
        {NAV.map(item => {
          const active = view === item.id
          return (
            <div
              key={item.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                onClick={() => onView(item.id)}
                className="flex items-center gap-3 transition-all duration-150 w-full text-left"
                style={{
                  padding: expanded ? '10px 16px' : '10px 0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  background: active ? 'rgba(156,43,52,0.14)' : 'transparent',
                  borderLeft: `3px solid ${active ? C.crimson : 'transparent'}`,
                }}
              >
                <span style={{ fontSize: 15, color: active ? '#e8828a' : 'rgba(255,255,255,0.4)', width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {expanded && (
                  <span className="animate-fadeIn" style={{
                    fontFamily: F.body, fontSize: 13.5, fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  }}>
                    {item.label}
                  </span>
                )}
              </button>
              {!expanded && hovered === item.id && (
                <div style={{
                  position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
                  marginLeft: 8, background: C.ink, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: F.body,
                  padding: '6px 12px', borderRadius: 3, zIndex: 99, whiteSpace: 'nowrap',
                  pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.3)', border: `1px solid rgba(169,129,46,0.3)`,
                }}>
                  {item.label}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Pie */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid rgba(169,129,46,0.18)' }}>
        {expanded ? (
          <div className="animate-fadeIn">
            <button
              onClick={onLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 9px', marginBottom: 12,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.45)', fontSize: 11.5, fontFamily: F.body, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(156,43,52,0.5)'; e.currentTarget.style.color = '#e8828a' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
            >
              <span style={{ fontSize: 13 }}>⏻</span> Cerrar sesión
            </button>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, lineHeight: 1.6, fontFamily: F.mono }}>
              Dirección Operativa SEAD<br />Zona Buenos Aires
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: 9.5, color: 'rgba(255,255,255,0.18)', lineHeight: 1.7, fontFamily: F.mono,
            }}>
              Diseño y desarrollo<br />
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>Martín Sanguinetti</span><br />
              martinsangui@gmail.com
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button onClick={onLogout} title="Cerrar sesión" style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontSize: 14,
            }}>⏻</button>
          </div>
        )}
      </div>
    </aside>
  )
}
