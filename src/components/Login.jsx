import { useState } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'
import { C, F } from '../lib/theme'

// Sello/medallón — el elemento de firma del sistema visual, usado acá como
// portada de un "folio" sellado. Se repite (más chico) en el membrete de la
// app para el estado de campaña.
function Seal({ size = 76 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="47" fill="none" stroke={C.brass} strokeWidth="1.5" opacity="0.9" />
      <circle cx="50" cy="50" r="41" fill="none" stroke={C.brass} strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="50" r="35" fill={C.ink} />
      <foreignObject x="21" y="21" width="58" height="58">
        <img src={ISOTIPO_B64} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </foreignObject>
    </svg>
  )
}

export default function Login({ onLogin, error, loading }) {
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password.trim()) onLogin(password.trim())
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: `radial-gradient(ellipse 900px 600px at 50% -10%, #223055 0%, ${C.ink} 55%), ${C.ink}`,
      backgroundImage: `
        repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 28px),
        radial-gradient(ellipse 900px 600px at 50% -10%, #223055 0%, ${C.ink} 55%)
      `,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
      padding: 20,
    }}>
      <Seal />

      <div style={{ textAlign: 'center', margin: '18px 0 28px' }}>
        <div style={{ fontFamily: F.display, color: '#fff', fontWeight: 600, fontSize: 26, letterSpacing: '0.01em' }}>UCASAL</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, marginTop: 5, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Gestión Comercial
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11.5, marginTop: 3, fontFamily: F.mono }}>
          Dirección Operativa SEAD · Buenos Aires
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{
        background: C.paperRaised,
        border: `1px solid rgba(169,129,46,0.4)`,
        borderRadius: 3,
        padding: '30px 30px 26px',
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 24px 60px -12px rgba(0,0,0,0.45)',
      }}>
        <label style={{
          fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase',
          letterSpacing: '0.1em', fontFamily: F.mono, borderBottom: `1px solid ${C.rule}`, paddingBottom: 10,
        }}>
          Acceso privado
        </label>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Contraseña"
          disabled={loading}
          style={{
            padding: '11px 2px', borderRadius: 0, fontSize: 15, fontFamily: F.body,
            border: 'none', borderBottom: `1.5px solid ${C.rule}`,
            background: 'transparent', color: C.ink,
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderBottomColor = C.crimson}
          onBlur={e => e.target.style.borderBottomColor = C.rule}
        />
        {error && (
          <div style={{
            fontSize: 12.5, color: C.crimson, background: 'rgba(156,43,52,0.08)',
            border: `1px solid rgba(156,43,52,0.25)`, borderRadius: 3, padding: '9px 12px', fontFamily: F.body,
          }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            padding: '12px', borderRadius: 3, fontSize: 13, fontWeight: 600, fontFamily: F.body,
            background: loading ? 'rgba(156,43,52,0.55)' : C.crimson,
            color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer',
            opacity: !password.trim() ? 0.45 : 1,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Verificando…' : 'Ingresar'}
        </button>
      </form>

      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 22, fontFamily: F.mono, letterSpacing: '0.04em' }}>
        Acceso restringido · Sistema interno UCASAL
      </div>
    </div>
  )
}
