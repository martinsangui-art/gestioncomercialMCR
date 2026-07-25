// Iconos de línea a medida para la navegación — reemplazan los glifos Unicode
// planos (◎ ⊞ ◷ ✉) por trazos con la misma lógica visual del resto del
// sistema (ledger/registro): trazo fino, esquinas rectas, sin relleno sólido.
const base = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconDashboard({ color = 'currentColor', strokeWidth = 1.7 }) {
  return (
    <svg {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M3 18 L3 12 L8 12 L8 18" />
      <path d="M9.5 18 L9.5 6 L14.5 6 L14.5 18" />
      <path d="M16 18 L16 10 L21 10 L21 18" />
      <line x1="2" y1="19.5" x2="22" y2="19.5" />
    </svg>
  )
}

export function IconSedes({ color = 'currentColor', strokeWidth = 1.7 }) {
  return (
    <svg {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="4" y="10" width="7" height="10" />
      <rect x="13" y="4" width="7" height="16" />
      <line x1="6.5" y1="13" x2="8.5" y2="13" />
      <line x1="6.5" y1="16" x2="8.5" y2="16" />
      <line x1="15.5" y1="7.5" x2="17.5" y2="7.5" />
      <line x1="15.5" y1="11" x2="17.5" y2="11" />
      <line x1="15.5" y1="14.5" x2="17.5" y2="14.5" />
    </svg>
  )
}

export function IconHistorial({ color = 'currentColor', strokeWidth = 1.7 }) {
  // Libro abierto — el historial es literalmente el libro de actas de la app
  return (
    <svg {...base} stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 6.5 C10.5 5 7.5 4.5 4 5 L4 17.5 C7.5 17 10.5 17.5 12 19" />
      <path d="M12 6.5 C13.5 5 16.5 4.5 20 5 L20 17.5 C16.5 17 13.5 17.5 12 19" />
      <line x1="12" y1="6.5" x2="12" y2="19" />
    </svg>
  )
}

export function IconEnvio({ color = 'currentColor', strokeWidth = 1.7 }) {
  return (
    <svg {...base} stroke={color} strokeWidth={strokeWidth}>
      <rect x="3" y="5.5" width="18" height="13" />
      <path d="M3.5 6.5 L12 13 L20.5 6.5" />
    </svg>
  )
}
