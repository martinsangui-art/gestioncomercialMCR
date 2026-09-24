import { useState, useEffect, useRef, useMemo } from 'react'
import { C, F } from '../lib/theme'
import { nombreCorto, estadoSede, ESTADOS } from './FichaSede'

// Sin tildes ni mayúsculas, para que "lujan" encuentre "LUJÁN"
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// "Ir a una sede": cuando una sede llama o hay que revisar una puntual, se
// escribe parte del nombre (o el código) y Enter abre su ficha. Se abre con
// Ctrl+K / ⌘K desde cualquier pantalla.
export default function BuscadorSedes({ data, onElegir, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const listaRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const resultados = useMemo(() => {
    const n = normalizar(q.trim())
    const base = [...data].sort((a, b) => String(a.sede).localeCompare(String(b.sede)))
    if (!n) return base
    return base
      .filter(d => normalizar(d.sede).includes(n) || String(d.cod_sede).startsWith(n))
      .sort((a, b) => normalizar(a.sede).indexOf(n) - normalizar(b.sede).indexOf(n))
  }, [q, data])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => {
    listaRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && resultados[sel]) { e.preventDefault(); onElegir(resultados[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.nativeEvent.preventDefault(); onClose() }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,51,.5)', zIndex: 9700,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 16px',
    }}>
      <div role="dialog" aria-modal="true" aria-label="Ir a una sede" className="modal-panel" style={{
        width: '100%', maxWidth: 560, background: '#fff', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 30px 80px -20px rgba(14,23,51,.6)', fontFamily: F.body,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: `1px solid ${C.rule}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Nombre o código de la sede" aria-label="Buscar sede"
            role="combobox" aria-expanded="true" aria-controls="lista-sedes" aria-activedescendant={resultados[sel] ? `sede-${resultados[sel].cod_sede}` : undefined}
            style={{ flex: 1, height: 58, border: 'none', outline: 'none', fontSize: 17, fontFamily: F.body, color: C.ink, background: 'transparent' }} />
          <kbd style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, border: `1px solid ${C.rule}`, borderRadius: 5, padding: '2px 6px' }}>Esc</kbd>
        </div>
        <ul id="lista-sedes" role="listbox" ref={listaRef} style={{ listStyle: 'none', margin: 0, padding: 6, maxHeight: '50vh', overflowY: 'auto' }}>
          {resultados.length === 0 && (
            <li style={{ padding: '18px 12px', color: C.inkSoft, fontSize: 14 }}>No hay ninguna sede que coincida con “{q}”.</li>
          )}
          {resultados.map((d, i) => {
            const e = ESTADOS[estadoSede(d)]
            const activo = i === sel
            return (
              <li key={d.cod_sede} id={`sede-${d.cod_sede}`} data-i={i} role="option" aria-selected={activo}
                onMouseEnter={() => setSel(i)} onClick={() => onElegir(d)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: activo ? C.celesteSoft : 'transparent',
                }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{nombreCorto(d.sede)}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft, marginLeft: 8 }}>{d.cod_sede}</span>
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.ink }}>{d.pct}%</span>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: C.inkSoft, width: 58, textAlign: 'right' }}>{d.total}/{d.objetivo}</span>
              </li>
            )
          })}
        </ul>
        <div style={{ display: 'flex', gap: 16, padding: '10px 18px', borderTop: `1px solid ${C.ruleSoft}`, fontSize: 12, color: C.inkSoft, background: '#FAFBFD' }}>
          <span><kbd style={{ fontFamily: F.mono }}>↑ ↓</kbd> moverse</span>
          <span><kbd style={{ fontFamily: F.mono }}>Enter</kbd> abrir la ficha</span>
        </div>
      </div>
    </div>
  )
}
