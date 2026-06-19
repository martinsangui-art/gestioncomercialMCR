import { useState, useMemo } from 'react'

function getEstado(d) {
  if (d.total === 0) return 'red'
  if (d.pct >= 50) return 'green'
  return 'amber'
}

const E = {
  green: { label: 'En objetivo',  color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  amber: { label: 'En progreso',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  red:   { label: 'Sin ingresos', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
}

function SedeRow({ d }) {
  const est = getEstado(d)
  const e = E[est]
  const noav = d.var === 0
  const varColor = d.var > 0 ? '#059669' : d.var < 0 ? '#e11d48' : '#94a3b8'
  const varTxt = d.var === null ? '—' : d.var > 0 ? `+${d.var}` : String(d.var)

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
      onMouseEnter={e2 => e2.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 20, flexShrink: 0 }}>{d.cod_sede}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{d.sede}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{d.email}</div>
          </div>
          {noav && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>⚠ Sin avance</span>}
        </div>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{d.objetivo}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{d.total}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, d.objetivo - d.total)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: varColor, fontVariantNumeric: 'tabular-nums' }}>{varTxt}</td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
            <div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: e.color, borderRadius: 3, transition: 'width 0.6s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: e.color, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.pct}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
          borderRadius: 20, fontSize: 11, fontWeight: 600, color: e.color, background: e.bg,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
          {e.label}
        </span>
      </td>
    </tr>
  )
}

export default function Sedes({ data, campanas, campanaActiva }) {
  const [filtro, setFiltro] = useState('')
  const [busq, setBusq] = useState('')

  const camp = campanas?.find(c => c.id === campanaActiva)

  const filtered = useMemo(() => {
    return data.filter(d => {
      const est = getEstado(d)
      if (filtro === 'green' && est !== 'green') return false
      if (filtro === 'amber' && est !== 'amber') return false
      if (filtro === 'red'   && est !== 'red')   return false
      if (filtro === 'noav'  && d.var !== 0)     return false
      if (busq && !d.sede.toLowerCase().includes(busq.toLowerCase())) return false
      return true
    }).sort((a, b) => {
      if (a.total === 0 && b.total > 0) return 1
      if (b.total === 0 && a.total > 0) return -1
      return b.pct - a.pct
    })
  }, [data, filtro, busq])

  const grupos = {
    green: filtered.filter(d => getEstado(d) === 'green'),
    amber: filtered.filter(d => getEstado(d) === 'amber'),
    red:   filtered.filter(d => getEstado(d) === 'red'),
  }

  const thead = (
    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      {['Sede', 'Objetivo', 'Actual', 'Faltan', 'Var.', 'Cumplimiento', 'Estado'].map(h => (
        <th key={h} style={{
          padding: '10px ' + (h === 'Sede' || h === 'Cumplimiento' || h === 'Estado' ? '16px' : '12px'),
          textAlign: h === 'Sede' || h === 'Cumplimiento' ? 'left' : 'center',
          fontSize: 10, fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{h}</th>
      ))}
    </tr>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input type="text" value={busq} onChange={e => setBusq(e.target.value)}
          placeholder="🔍 Buscar sede…"
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 200 }} />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
          <option value="">Todas las sedes</option>
          <option value="green">✅ En objetivo (≥50%)</option>
          <option value="amber">⚠️ En progreso (1–49%)</option>
          <option value="red">❌ Sin ingresos</option>
          <option value="noav">🟠 Sin avance vs anterior</option>
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} sedes</div>
      </div>

      {/* Tabla por grupos */}
      {Object.entries(grupos).map(([key, items]) => {
        if (!items.length) return null
        const e = E[key]
        return (
          <div key={key}>
            <div style={{
              padding: '6px 4px 6px 12px', marginBottom: 8,
              borderLeft: `3px solid ${e.color}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: e.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {e.label} · {items.length} sedes
              </span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>{thead}</thead>
                <tbody>
                  {items.map(d => <SedeRow key={d.cod_sede} d={d} />)}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!filtered.length && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: 14 }}>
          No hay sedes que coincidan con los filtros
        </div>
      )}
    </div>
  )
}
