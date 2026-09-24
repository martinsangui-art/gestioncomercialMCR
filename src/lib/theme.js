import { useState } from 'react'

// ── Sistema de diseño "Señalética" ──────────────────────────────────────────
// La app responde una pregunta por semana: ¿cómo vamos y a quién hay que
// llamar? La identidad toma la lógica de la cartelería vial y del subte:
// lectura de un vistazo, números grandes y expandidos, color que siempre
// significa algo (verde/ámbar/rojo = estado de la sede, celeste = selección).
// Tipografía de Omnibus-Type (Buenos Aires): Archivo, con ancho variable
// para las cifras, y Chivo Mono para códigos y datos chicos.

export const C = {
  ink:        '#0E1733', // navy UCASAL profundo — texto y barra superior
  inkSoft:    '#5A6480', // texto secundario
  paper:      '#EDF0F5', // fondo de la app: gris frío liso
  paperRaised:'#FFFFFF', // tarjetas y paneles
  rule:       '#DCE1EA', // bordes
  ruleSoft:   '#E9EDF3', // separadores internos, fondos de fila
  crimson:    '#C8102E', // rojo UCASAL — solo alertas y acciones irreversibles
  brass:      '#7FB2F0', // celeste — selección, foco, acento sobre navy
  navy:       '#1B2A6B', // azul de marca — acciones principales
  celeste:    '#7FB2F0',
  celesteSoft:'#E4EFFC',
  ok:         '#0F8A5F',
  warn:       '#C98A0B',
  danger:     '#C8102E',
}

export const F = {
  display: `'Archivo', system-ui, sans-serif`,
  body:    `'Archivo', system-ui, sans-serif`,
  mono:    `'Chivo Mono', ui-monospace, monospace`,
}

// Cifras de "cartel": Archivo expandido y pesado, con números tabulares
export const cifra = (size, extra = {}) => ({
  fontFamily: F.display,
  fontSize: size,
  fontWeight: 800,
  fontStretch: '125%',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.02em',
  lineHeight: 1,
  ...extra,
})

// Etiqueta chica en mayúsculas (rótulo de cartel)
export const rotulo = {
  fontFamily: F.body, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: C.inkSoft,
}

export const panel = (extra = {}) => ({
  background: C.paperRaised,
  border: `1px solid ${C.rule}`,
  borderRadius: 12,
  ...extra,
})

export const ledgerRule = { height: 1, background: C.rule }

export function pageBackgroundStyle() {
  return { backgroundColor: C.paper }
}

// Da a cualquier modal una salida animada de verdad: en vez de desmontarse
// de golpe al tocar "cerrar", entra en estado "closing" (dispara la clase
// .modal-closing) y recién después de que termine la transición se llama al
// onClose real que lo saca del árbol. Ver .modal-overlay/.modal-panel en
// index.css.
export function useClosingTransition(onClose, duration = 200) {
  const [closing, setClosing] = useState(false)
  const requestClose = () => {
    setClosing(true)
    setTimeout(onClose, duration)
  }
  return [closing, requestClose]
}
