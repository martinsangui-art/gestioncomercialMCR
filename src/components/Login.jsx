import { useState } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'
import { C, F, cifra, rotulo } from '../lib/theme'
import { useIsMobile } from '../hooks/useIsMobile'

// Eco de "la regla" del tablero: una fila de marcas sobre una escala con la
// línea del 100%. Acá es solo el motivo de la marca (no hay datos todavía).
function ReglaMotivo() {
  const marcas = [8, 17, 23, 31, 36, 44, 47, 52, 55, 58, 61, 63, 66, 68, 71, 74, 77, 79, 82, 86, 88, 91, 95, 98, 103, 108, 114, 122, 131, 140]
  const x = v => 10 + (v / 150) * 380
  const filas = []
  const pts = marcas.map(v => {
    let f = 0
    while ((filas[f] || []).some(o => Math.abs(o - x(v)) < 11)) f++
    ;(filas[f] = filas[f] || []).push(x(v))
    return { v, f }
  })
  return (
    <svg viewBox="0 0 400 70" width="100%" style={{ display: 'block', maxWidth: 420 }} aria-hidden="true">
      <line x1={x(100)} x2={x(100)} y1={4} y2={56} stroke={C.celeste} strokeWidth="1.5" />
      <line x1={x(50)} x2={x(50)} y1={4} y2={56} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 4" />
      <line x1={x(0)} x2={x(150)} y1={56} y2={56} stroke="rgba(255,255,255,0.4)" />
      {Array.from({ length: 16 }, (_, i) => i * 10).map(v => (
        <line key={v} x1={x(v)} x2={x(v)} y1={56} y2={v % 50 === 0 ? 63 : 60} stroke="rgba(255,255,255,0.4)" />
      ))}
      {pts.map(({ v, f }, i) => (
        <circle key={i} cx={x(v)} cy={48 - f * 11} r={4.5}
          fill={v < 50 ? '#F5B83D' : '#3DD598'} stroke={C.ink} strokeWidth="1.2"
          className="animate-fadeIn" style={{ animationDelay: `${i * 25}ms` }} />
      ))}
    </svg>
  )
}

export default function Login({ onLogin, error, loading }) {
  const [password, setPassword] = useState('')
  const isMobile = useIsMobile()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password.trim()) onLogin(password.trim())
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'auto',
      display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr',
      background: C.paper, fontFamily: F.body,
    }}>
      <section style={{
        background: C.ink, color: '#fff', position: 'relative',
        padding: isMobile ? '32px 24px 28px' : '48px 56px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32,
        borderBottom: isMobile ? `3px solid ${C.crimson}` : 'none',
        borderRight: isMobile ? 'none' : `3px solid ${C.crimson}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={ISOTIPO_B64} alt="UCASAL" style={{ width: 34, height: 'auto' }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 800, fontStretch: '112%', fontSize: 16 }}>UCASAL</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Dirección Operativa SEAD · Zona Buenos Aires</div>
          </div>
        </div>

        <div>
          <div style={{ ...rotulo, color: C.celeste, marginBottom: 14 }}>Gestión comercial</div>
          <h1 style={{ ...cifra(isMobile ? 46 : 76), margin: 0, color: '#fff', fontWeight: 850, letterSpacing: '-0.03em', lineHeight: 0.95 }}>
            ¿Cómo<br />vamos?
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', maxWidth: 380, lineHeight: 1.5, margin: '18px 0 26px' }}>
            Inscripciones de cada sede contra su objetivo, corte a corte.
          </p>
          <ReglaMotivo />
        </div>

        <div style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.35)' }} className="hide-mobile">
          Sistema interno · acceso restringido
        </div>
      </section>

      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '28px 20px 40px' : 48 }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, fontStretch: '108%', color: C.ink, letterSpacing: '-0.01em' }}>Ingresar</h2>
          <p style={{ margin: '6px 0 26px', fontSize: 14, color: C.inkSoft }}>Usá la contraseña del equipo.</p>

          <label htmlFor="pw" style={{ ...rotulo, display: 'block', marginBottom: 8 }}>Contraseña</label>
          <input
            id="pw"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            style={{
              width: '100%', height: 46, padding: '0 14px', borderRadius: 10, fontSize: 15, fontFamily: F.body,
              border: `1.5px solid ${error ? C.crimson : C.rule}`, background: '#fff', color: C.ink, outline: 'none',
              transition: 'border-color .15s, box-shadow .15s',
            }}
            onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 4px ${C.celesteSoft}` }}
            onBlur={e => { e.target.style.borderColor = error ? C.crimson : C.rule; e.target.style.boxShadow = 'none' }}
          />
          {error && (
            <div role="alert" style={{ fontSize: 13, color: C.crimson, marginTop: 8 }}>
              {error === 'Contraseña incorrecta' ? 'La contraseña no es correcta. Revisala y probá de nuevo.' : error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="btn-press"
            style={{
              width: '100%', height: 46, marginTop: 18, borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: F.body,
              background: C.navy, color: '#fff', border: 'none',
              cursor: loading ? 'wait' : password.trim() ? 'pointer' : 'default',
              opacity: !password.trim() ? 0.5 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  )
}
