import { useEffect, useRef } from 'react'
import { C, F, useClosingTransition } from '../lib/theme'

// Modales abiertos, en orden (el último es el de arriba)
const pilaModales = []

// Modal con encabezado navy + filete dorado, usado por los paneles de gestión.
export default function ModalShell({ children, onClose, title, sub, maxWidth = 480, cerrable = true }) {
  const [closing, requestCloseAnimado] = useClosingTransition(onClose)
  // Mientras se guarda algo el modal no se puede cerrar (ni con ✕ ni con Escape)
  const requestClose = () => { if (cerrable) requestCloseAnimado() }
  // Escape cierra (cada modal decide si en ese momento se puede cerrar: los
  // que están guardando pasan un onClose que no hace nada)
  // Solo el modal de más arriba responde; y si otra capa (ej. el buscador)
  // ya usó el Escape, no se cierra también este.
  const cerrarRef = useRef(requestClose)
  cerrarRef.current = requestClose
  useEffect(() => {
    const yo = {}
    pilaModales.push(yo)
    const esc = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || pilaModales[pilaModales.length - 1] !== yo) return
      cerrarRef.current()
    }
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('keydown', esc)
      const i = pilaModales.indexOf(yo)
      if (i >= 0) pilaModales.splice(i, 1)
    }
  }, []) // eslint-disable-line
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,51,.55)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{ background: C.paperRaised, borderRadius: 14, width: '100%', maxWidth, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(14,23,51,.55)', display: 'flex', flexDirection: 'column', maxHeight: '86vh', textAlign: 'left', cursor: 'default' }}>
        <div style={{ background: C.ink, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexShrink: 0, borderBottom: `3px solid ${C.crimson}` }}>
          <div>
            <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 800, fontStretch: '108%', fontSize: 18 }}>{title}</div>
            {sub && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12.5, marginTop: 3, fontFamily: F.body }}>{sub}</div>}
          </div>
          <button onClick={requestClose} disabled={!cerrable} aria-label="Cerrar" className="btn-press" style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
