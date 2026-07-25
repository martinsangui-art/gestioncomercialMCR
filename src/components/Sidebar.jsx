import { useState } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'
import { useIsMobile } from '../hooks/useIsMobile'
import { C, F } from '../lib/theme'
import { IconDashboard, IconSedes, IconHistorial, IconEnvio } from '../lib/icons'

const NAV = [
  { id: 'dashboard', Icon: IconDashboard, label: 'Dashboard' },
  { id: 'sedes',     Icon: IconSedes,     label: 'Sedes' },
  { id: 'historial', Icon: IconHistorial, label: 'Historial' },
  { id: 'envio',     Icon: IconEnvio,     label: 'Envío' },
]

const ITEM_H = 42

// Envuelve contenido que se esconde/muestra al colapsar el sidebar — en vez
// de montar/desmontar de golpe (lo que hacía que "no se escondiera", solo
// desaparecía), encoge con transición real en ambos sentidos.
function Collapsible({ show, maxHeight = 60, children }) {
  return (
    <div style={{
      maxHeight: show ? maxHeight : 0,
      opacity: show ? 1 : 0,
      overflow: 'hidden',
      transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
    }}>
      {children}
    </div>
  )
}

export default function Sidebar({ view, onView, campanaActiva, campanas, onCampana, onLogout }) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(!isMobile)
  const [hovered, setHovered] = useState(null)
  const activeIndex = NAV.findIndex(i => i.id === view)

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
        className="flex items-center gap-3 px-4 cursor-pointer select-none btn-press"
        onClick={() => setExpanded(e => !e)}
        title={expanded ? 'Colapsar' : 'Expandir'}
        style={{ minHeight: 68, borderBottom: '1px solid rgba(169,129,46,0.18)' }}
      >
        <img src={ISOTIPO_B64} alt="UCASAL" style={{ width: 30, height: 'auto', display: 'block', flexShrink: 0 }} />
        <Collapsible show={expanded} maxHeight={50}>
          <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 16, lineHeight: 1.1, letterSpacing: '0.01em' }}>UCASAL</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontFamily: F.mono, letterSpacing: '0.03em', marginTop: 2 }}>Gestión Comercial</div>
          </div>
        </Collapsible>
      </div>

      {/* Campaña activa */}
      {campanas?.length > 0 && (
        <Collapsible show={expanded} maxHeight={220}>
          <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(169,129,46,0.18)' }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, padding: '0 4px', whiteSpace: 'nowrap' }}>
              Campaña
            </div>
            <div className="flex flex-col gap-0.5">
              {campanas.map(c => {
                const activa = campanaActiva === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => onCampana(c.id)}
                    className="flex items-center gap-2.5 text-left btn-press"
                    style={{
                      padding: '7px 9px',
                      background: activa ? 'rgba(169,129,46,0.12)' : 'transparent',
                      borderLeft: `2px solid ${activa ? C.brass : 'transparent'}`,
                      fontFamily: F.body,
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                      whiteSpace: 'nowrap',
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
        </Collapsible>
      )}

      {/* Índice de secciones */}
      <nav className="flex-1" style={{ padding: '10px 0', position: 'relative' }}>
        {/* Indicador que se desliza al cambiar de sección, en vez de un borde estático por ítem */}
        <div style={{
          position: 'absolute', left: 0, top: 10 + activeIndex * ITEM_H, width: 3, height: ITEM_H,
          background: C.crimson, transition: 'top 0.25s cubic-bezier(0.4,0,0.2,1)',
        }} />
        {NAV.map(item => {
          const active = view === item.id
          const Icon = item.Icon
          return (
            <div
              key={item.id}
              style={{ position: 'relative', height: ITEM_H }}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                onClick={() => onView(item.id)}
                className="flex items-center gap-3 w-full text-left btn-press"
                style={{
                  height: '100%',
                  padding: expanded ? '0 16px' : '0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  background: active ? 'rgba(156,43,52,0.14)' : hovered === item.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <Icon color={active ? '#e8828a' : 'rgba(255,255,255,0.45)'} />
                <Collapsible show={expanded} maxHeight={30}>
                  <span style={{
                    fontFamily: F.body, fontSize: 13.5, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap',
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  }}>
                    {item.label}
                  </span>
                </Collapsible>
              </button>
              {!expanded && hovered === item.id && (
                <div className="animate-fadeIn" style={{
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
        <button
          onClick={onLogout}
          className="btn-press"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7,
            padding: expanded ? '7px 9px' : '7px 0', marginBottom: expanded ? 12 : 0,
            justifyContent: expanded ? 'flex-start' : 'center',
            background: 'transparent', border: expanded ? '1px solid rgba(255,255,255,0.1)' : 'none',
            color: 'rgba(255,255,255,0.45)', fontSize: 11.5, fontFamily: F.body, cursor: 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(156,43,52,0.5)'; e.currentTarget.style.color = '#e8828a' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = expanded ? 'rgba(255,255,255,0.1)' : 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
        >
          <span style={{ fontSize: 13 }}>⏻</span>
          <Collapsible show={expanded} maxHeight={20}><span style={{ whiteSpace: 'nowrap' }}>Cerrar sesión</span></Collapsible>
        </button>
        <Collapsible show={expanded} maxHeight={140}>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, lineHeight: 1.6, fontFamily: F.mono, whiteSpace: 'nowrap' }}>
            Dirección Operativa SEAD<br />Zona Buenos Aires
          </div>
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 9.5, color: 'rgba(255,255,255,0.18)', lineHeight: 1.7, fontFamily: F.mono, whiteSpace: 'nowrap',
          }}>
            Diseño y desarrollo<br />
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Martín Sanguinetti</span><br />
            martinsangui@gmail.com
          </div>
        </Collapsible>
      </div>
    </aside>
  )
}
