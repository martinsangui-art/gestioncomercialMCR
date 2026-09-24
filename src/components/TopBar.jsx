import { useState, useEffect, useRef } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'
import { C, F } from '../lib/theme'
import { useIsMobile } from '../hooks/useIsMobile'

const NAV = [
  { id: 'dashboard', label: 'Cómo vamos' },
  { id: 'sedes',     label: 'Sedes' },
  { id: 'historial', label: 'Historial' },
  { id: 'envio',     label: 'Envío' },
]

// Selector de campaña: la campaña es el contexto de toda la app, así que
// vive en la barra y no escondida en una columna lateral.
function SelectorCampana({ campanas, campanaActiva, onCampana }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const actual = campanas?.find(c => c.id === campanaActiva)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', cerrar); document.removeEventListener('keydown', esc) }
  }, [abierto])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto(a => !a)}
        aria-haspopup="listbox" aria-expanded={abierto}
        className="btn-press"
        style={{
          display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 12px 0 11px',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, fontWeight: 600,
          maxWidth: 260,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: actual?.estado === 'activa' ? '#35C28A' : 'rgba(255,255,255,0.35)' }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actual?.nombre || 'Campaña'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, opacity: 0.6, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && (
        <div role="listbox" className="animate-fadeIn" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 240, zIndex: 60,
          background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 10, padding: 5,
          boxShadow: '0 16px 40px -12px rgba(14,23,51,0.35)',
        }}>
          {campanas.map(c => {
            const sel = c.id === campanaActiva
            return (
              <button key={c.id} role="option" aria-selected={sel}
                onClick={() => { onCampana(c.id); setAbierto(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: sel ? C.celesteSoft : 'transparent', fontFamily: F.body,
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = C.ruleSoft }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: c.estado === 'activa' ? C.ok : C.rule }} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: sel ? 700 : 500, color: C.ink }}>{c.nombre}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.inkSoft }}>{c.estado === 'activa' ? 'activa' : 'cerrada'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TopBar({ view, onView, campanaActiva, campanas, onCampana, onLogout }) {
  const isMobile = useIsMobile()
  const nav = (
    <nav aria-label="Secciones" className="topbar-nav" style={{ display: 'flex', alignItems: 'stretch', height: isMobile ? 44 : '100%', gap: 2, flex: 1, minWidth: 0, overflowX: 'auto' }}>
      {NAV.map(item => {
        const active = view === item.id
        return (
          <button key={item.id} onClick={() => onView(item.id)} aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative', padding: '0 14px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: F.body, fontSize: 14, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
              color: active ? '#fff' : 'rgba(255,255,255,0.6)', transition: 'color .15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          >
            {item.label}
            <span style={{
              position: 'absolute', left: 14, right: 14, bottom: 0, height: 3, borderRadius: '3px 3px 0 0',
              background: C.celeste, transform: active ? 'scaleX(1)' : 'scaleX(0)', transition: 'transform .2s cubic-bezier(.16,1,.3,1)',
            }} />
          </button>
        )
      })}
    </nav>
  )
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50, background: C.ink,
      borderBottom: `3px solid ${C.crimson}`,
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: isMobile ? '0 14px' : '0 24px', height: isMobile ? 56 : 60,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img src={ISOTIPO_B64} alt="" style={{ width: 28, height: 'auto', display: 'block' }} />
          <div style={{ lineHeight: 1.05 }} className="hide-mobile">
            <div style={{ fontFamily: F.display, fontStretch: '112%', fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '0.01em' }}>UCASAL</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Gestión comercial · Bs. As.</div>
          </div>
        </div>

        {isMobile ? <div style={{ flex: 1 }} /> : nav}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {campanas?.length > 0 && <SelectorCampana campanas={campanas} campanaActiva={campanaActiva} onCampana={onCampana} />}
          <button onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión" className="btn-press" style={{
            width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
            color: 'rgba(255,255,255,0.65)', cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
      {isMobile && <div style={{ padding: '0 4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>{nav}</div>}
    </header>
  )
}
