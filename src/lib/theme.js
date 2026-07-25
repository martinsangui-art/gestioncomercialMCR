import { useState } from 'react'

// ── Sistema de diseño "Libro de registro" ───────────────────────────────────
// UCASAL gestiona un registro de inscripciones: cupos, cortes semanales,
// sedes. La identidad visual toma eso literalmente — un libro de actas
// académico, no un dashboard SaaS genérico. Navy institucional + papel
// cálido para el contenido, serif con carácter para títulos, mono para
// todo dato numérico (la aritmética de un libro de cuentas).

export const C = {
  ink:        '#17233F', // navy-tinta, texto principal y superficies oscuras
  inkSoft:    '#5C6478', // texto secundario
  paper:      '#F3EFE3', // fondo cálido tipo papel
  paperRaised:'#FFFFFE', // superficie de tarjetas/paneles
  rule:       '#DCD4BE', // líneas finas tipo renglón
  ruleSoft:   '#EAE4D3',
  crimson:    '#9C2B34', // rojo UCASAL, más profundo — acento de marca y alerta
  brass:      '#A9812E', // acento de firma — sello, subrayado del número hero, marca activa
  ok:         '#2F6D4F',
  warn:       '#A8752A',
  danger:     '#9C2B34',
}

export const F = {
  display: `'Fraunces', 'Iowan Old Style', Georgia, serif`,
  body:    `'IBM Plex Sans', system-ui, sans-serif`,
  mono:    `'IBM Plex Mono', ui-monospace, monospace`,
}

// Panel "de registro": línea fina en vez de sombra+blur, sin glassmorphism
export const panel = (extra = {}) => ({
  background: C.paperRaised,
  border: `1px solid ${C.rule}`,
  borderRadius: 10,
  ...extra,
})

// Regla fina superior tipo membrete, usada para separar secciones
export const ledgerRule = {
  height: 1,
  background: `linear-gradient(90deg, ${C.ink} 0%, ${C.ink} 40%, ${C.crimson} 100%)`,
  opacity: 0.8,
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
