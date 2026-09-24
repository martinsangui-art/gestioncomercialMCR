import { useState, useEffect, useRef } from 'react'
import { C, F } from '../lib/theme'

// ── Casillero: la placa de un tablero de salidas ───────────────────────────
// Cada sede es una placa "split-flap" como las de los carteles de terminales
// y aeropuertos: la sigla en blanco atravesada por la bisagra de la placa,
// una luz de estado en la esquina (verde / ámbar / rojo), la franja de avance
// hacia el objetivo abajo y un "+N" celeste si sumó inscriptos en este corte.
// Al entrar a la página las letras giran hasta frenar en cada sigla.

const LUZ = { ok: '#3DD598', prog: '#F5B83D', cero: '#FF6B7D' }
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const reduceMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Las letras "giran" (letras al azar) y se van fijando de izquierda a derecha
function useLetrasQueGiran(texto, animar, retraso) {
  const [mostrado, setMostrado] = useState(animar ? '   ' : texto)
  useEffect(() => {
    if (!animar || reduceMovimiento()) { setMostrado(texto); return }
    const total = 8 + Math.floor(Math.random() * 4)
    const fija = [total - 4, total - 2, total] // cuándo queda fija cada letra
    let paso = 0, intervalo
    const arranque = setTimeout(() => {
      intervalo = setInterval(() => {
        paso++
        setMostrado(texto.split('').map((l, i) => (paso >= fija[i] ? l : LETRAS[Math.floor(Math.random() * 26)])).join(''))
        if (paso >= total) clearInterval(intervalo)
      }, 55)
    }, retraso)
    return () => { clearTimeout(arranque); clearInterval(intervalo) }
  }, [texto]) // eslint-disable-line
  return mostrado
}

// La animación de entrada corre una sola vez por visita a la página
let tableroYaAnimado = false
export function useAnimarTablero() {
  const [animar] = useState(() => !tableroYaAnimado)
  useEffect(() => { tableroYaAnimado = true }, [])
  return animar
}

export default function Casillero({
  sigla = '···', estado = 'ok', pct = 0, variacion = null,
  encendido = true, alerta = false, compacto = false, animar = false, retraso = 0,
  etiqueta, activo = false, onClick, onHover,
}) {
  const letras = useLetrasQueGiran(sigla, animar, retraso)
  const ref = useRef(null)
  const W = compacto ? 50 : 62, H = compacto ? 38 : 50
  const luz = encendido ? LUZ[estado] : alerta ? LUZ.cero : 'rgba(255,255,255,0.18)'
  const avance = Math.max(0, Math.min(pct, 100))
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      ref={ref}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
      aria-label={etiqueta}
      title={etiqueta}
      className={`placa${activo ? ' placa-activa' : ''}`}
      style={{
        position: 'relative', display: 'inline-block', width: W, height: H, padding: 0, flexShrink: 0,
        borderRadius: 7, border: 'none', cursor: onClick ? 'pointer' : 'default',
        // dos mitades de placa con la bisagra al medio
        background: encendido
          ? 'linear-gradient(180deg, #1C2A4E 0%, #17233F 49.2%, #0A1128 49.2%, #0A1128 50.8%, #0E1733 50.8%, #111C3A 100%)'
          : 'linear-gradient(180deg, #2A3452 0%, #252F4B 49.2%, #161E36 49.2%, #161E36 50.8%, #1E2742 50.8%, #222C47 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 1px 0 rgba(14,23,51,0.35), 0 8px 16px -10px rgba(14,23,51,0.7)',
        transition: 'transform .15s cubic-bezier(.16,1,.3,1), box-shadow .15s, background .4s',
      }}
    >
      {/* luz de estado */}
      <span aria-hidden="true" style={{
        position: 'absolute', top: compacto ? 5 : 6, left: compacto ? 5 : 6,
        width: compacto ? 5 : 6, height: compacto ? 5 : 6, borderRadius: '50%',
        background: luz, boxShadow: encendido || alerta ? `0 0 6px ${luz}` : 'none', transition: 'background .4s, box-shadow .4s',
      }} />

      {/* +N: sumó en este corte */}
      {!compacto && variacion !== null && variacion !== 0 && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 3, right: 5, fontFamily: F.mono, fontSize: 9.5, fontWeight: 700, lineHeight: 1,
          color: variacion > 0 ? C.celeste : '#FF9AA6',
        }}>{variacion > 0 ? `+${variacion}` : `−${-variacion}`}</span>
      )}

      {/* sigla */}
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', paddingTop: compacto ? 0 : 1,
        fontFamily: F.mono, fontSize: compacto ? 13.5 : 17, fontWeight: 700, letterSpacing: '0.08em',
        color: encendido ? '#F4F7FC' : 'rgba(244,247,252,0.38)', textShadow: '0 1px 0 rgba(0,0,0,0.45)',
        transition: 'color .4s', whiteSpace: 'pre',
      }}>{letras}</span>

      {/* bisagra: una línea oscura y un reflejo que cortan las letras */}
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, marginTop: -0.5, background: 'rgba(0,0,0,0.6)' }} />
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, marginTop: 0.5, background: 'rgba(255,255,255,0.05)' }} />

      {/* franja de avance hacia el objetivo */}
      {!compacto && (
        <span aria-hidden="true" style={{ position: 'absolute', left: 7, right: 7, bottom: 5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.13)', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${avance}%`, background: LUZ[estado], borderRadius: 2, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
          {pct > 100 && <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: '#fff' }} />}
        </span>
      )}
    </Tag>
  )
}
