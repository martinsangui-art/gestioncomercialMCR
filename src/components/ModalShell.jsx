import { C, F, useClosingTransition } from '../lib/theme'

// Modal con encabezado navy + filete dorado, usado por los paneles de gestión.
export default function ModalShell({ children, onClose, title, sub, maxWidth = 480 }) {
  const [closing, requestClose] = useClosingTransition(onClose)
  return (
    <div className={`modal-overlay ${closing ? 'modal-closing' : ''}`} style={{ position: 'fixed', inset: 0, background: 'rgba(23,35,63,.6)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className={`modal-panel ${closing ? 'modal-closing' : ''}`} style={{ background: C.paperRaised, borderRadius: 3, width: '100%', maxWidth, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>
        <div style={{ background: C.ink, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `2px solid ${C.brass}` }}>
          <div>
            <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 16 }}>{title}</div>
            {sub && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11.5, marginTop: 2, fontFamily: F.body }}>{sub}</div>}
          </div>
          <button onClick={requestClose} className="btn-press" style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
