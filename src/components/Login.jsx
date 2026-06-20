import { useState } from 'react'
import { ISOTIPO_B64 } from '../assets/isotipo'

export default function Login({ onLogin, error, loading }) {
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password.trim()) onLogin(password.trim())
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B1730',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
      padding: 20,
    }}>
      <img
        src={ISOTIPO_B64}
        alt="UCASAL"
        style={{ width: 90, height: 'auto' }}
      />

      <div style={{ textAlign: 'center', marginTop: -10 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 4, letterSpacing: '0.02em' }}>UCASAL</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>Gestión Comercial</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Dirección Operativa SEAD · Buenos Aires</div>
      </div>

      <form onSubmit={handleSubmit} style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Acceso privado
        </label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Contraseña"
          disabled={loading}
          style={{
            padding: '11px 14px', borderRadius: 9, fontSize: 14,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            outline: 'none',
          }}
        />
        {error && (
          <div style={{
            fontSize: 12, color: '#f87171', background: 'rgba(200,16,46,0.15)',
            border: '1px solid rgba(200,16,46,0.3)', borderRadius: 8, padding: '8px 12px',
          }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            padding: '11px', borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: loading ? 'rgba(200,16,46,0.5)' : '#C8102E',
            color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer',
            opacity: !password.trim() ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Verificando…' : 'Ingresar'}
        </button>
      </form>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Acceso restringido · Sistema interno UCASAL
      </div>
    </div>
  )
}
