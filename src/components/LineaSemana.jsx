import { C, F, rotulo } from '../lib/theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { hoyIso, diasEntre, fmtCorto } from '../lib/formato'

// La rutina de cada semana dibujada como una línea de subte: tres estaciones
// en orden (cargar el corte → mandar los mails → llamar a las que no avanzan).
// Muestra en qué estación está Cele y el botón de la derecha cambia según lo
// que toca hacer ahora.
export default function LineaSemana({ data, copied, paraLlamar, ultimaOp, vencida, onCargarExcel, onIrEnvio, onIrLlamar, onDeshacer }) {
  const isMobile = useIsMobile()
  const fecha = data[0]?.fecha ? String(data[0].fecha).slice(0, 10) : null
  const edad = fecha ? diasEntre(fecha, hoyIso()) : null
  // Las sedes sin email no se pueden mandar: no bloquean el paso de los mails
  const conEmail = data.filter(d => String(d.email || '').trim())
  const sinEmail = data.length - conEmail.length
  const enviados = conEmail.filter(d => copied[d.cod_sede]).length
  const total = conEmail.length

  const corteHecho = !!fecha
  const corteViejo = corteHecho && edad > 8 && !vencida
  const mailsHechos = total > 0 && enviados >= total
  const llamadosHechos = paraLlamar.length === 0

  // Qué toca ahora
  let accion
  if (!corteHecho || corteViejo) accion = { label: 'Cargar el Excel del corte', onClick: onCargarExcel }
  else if (!mailsHechos) accion = { label: total - enviados === 1 ? 'Enviar el mail que falta' : `Enviar ${total - enviados} mails`, onClick: onIrEnvio }
  else if (!llamadosHechos) accion = { label: `Ver a quién llamar (${paraLlamar.length})`, onClick: onIrLlamar }
  else accion = null

  const estaciones = [
    {
      titulo: 'Corte cargado',
      estado: !corteHecho ? 'actual' : corteViejo ? 'alerta' : 'hecho',
      detalle: !corteHecho ? 'Todavía no hay cortes' : `Corte del ${fmtCorto(fecha)} · ${edad <= 0 ? 'hoy' : edad === 1 ? 'ayer' : `hace ${edad} días`}`,
      extra: corteViejo ? '¿Llegó el Excel de esta semana?' : null,
      links: corteHecho ? [
        { label: 'Cargar otro corte', onClick: onCargarExcel },
        ...(ultimaOp?.accion === 'agregar_semana' ? [{ label: 'Deshacer la última carga', onClick: onDeshacer }] : []),
      ] : [],
    },
    {
      titulo: 'Mails enviados',
      estado: !corteHecho ? 'pendiente' : mailsHechos ? 'hecho' : 'actual',
      detalle: corteHecho ? `${enviados} de ${total} sedes${sinEmail ? ` · ${sinEmail} sin email` : ''}` : '—',
      links: corteHecho && !mailsHechos ? [{ label: 'Ir a Envío', onClick: onIrEnvio }] : [],
    },
    {
      titulo: 'Llamados',
      estado: !corteHecho ? 'pendiente' : llamadosHechos ? 'hecho' : mailsHechos ? 'actual' : 'pendiente',
      detalle: !corteHecho ? '—' : llamadosHechos ? 'Ninguna sede estancada' : `${paraLlamar.length} ${paraLlamar.length === 1 ? 'sede' : 'sedes'} sin avance`,
      links: !llamadosHechos && corteHecho ? [{ label: 'Ver la lista', onClick: onIrLlamar }] : [],
    },
  ]

  const colorEstado = { hecho: C.navy, actual: C.celeste, alerta: C.warn, pendiente: C.rule }
  const hechas = estaciones.filter(e => e.estado === 'hecho').length

  return (
    <section aria-label="La semana, paso a paso" className="animate-fadeUp" style={{
      background: C.paperRaised, border: `1px solid ${C.rule}`, borderRadius: 14, marginBottom: 18,
      padding: isMobile ? '18px 16px' : '20px 24px', fontFamily: F.body,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ ...rotulo, color: C.navy }}>Esta semana</div>
          <div style={{ fontSize: 15, color: C.ink, marginTop: 4 }}>
            {accion
              ? <><strong>{hechas} de 3</strong> pasos hechos. Lo que sigue: <strong>{accion.label.toLowerCase()}</strong>.</>
              : <><strong>Semana al día.</strong> Corte cargado, mails enviados y nadie estancado.</>}
          </div>
        </div>
        {accion ? (
          <button onClick={accion.onClick} className="btn-press" style={{
            height: 44, padding: '0 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.navy, color: '#fff', fontSize: 14.5, fontWeight: 800, fontFamily: F.body,
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 6px 18px -8px ${C.navy}`,
          }}>
            {accion.label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        ) : (
          <span style={{ height: 44, padding: '0 16px', borderRadius: 10, background: '#E3F4EC', color: C.ok, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            Al día
          </span>
        )}
      </div>

      {/* La línea: tramos entre estaciones pintados según avance */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', position: 'relative' }}>
        {estaciones.map((e, i) => {
          const color = colorEstado[e.estado]
          const siguienteHecha = estaciones[i + 1] && (e.estado === 'hecho')
          return (
            <li key={e.titulo} style={{ position: 'relative', paddingRight: 12, minWidth: 0 }} aria-current={e.estado === 'actual' ? 'step' : undefined}>
              <div style={{ position: 'relative', height: 26, marginBottom: 10 }}>
                {i < estaciones.length - 1 && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', left: 13, right: -13, top: 10, height: 6, borderRadius: 3,
                    background: siguienteHecha ? C.navy : C.ruleSoft,
                  }} />
                )}
                <span aria-hidden="true" className={e.estado === 'actual' ? 'estacion-actual' : undefined} style={{
                  position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%',
                  background: e.estado === 'hecho' ? C.navy : '#fff', border: `5px solid ${color}`,
                  display: 'grid', placeItems: 'center', zIndex: 1,
                }}>
                  {e.estado === 'hecho' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                  )}
                </span>
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14.5, fontWeight: 800, color: e.estado === 'pendiente' ? C.inkSoft : C.ink, fontStretch: '105%' }}>{e.titulo}</div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: e.estado === 'alerta' ? '#8A5D00' : C.inkSoft, marginTop: 3 }}>{e.detalle}</div>
              {e.extra && <div style={{ fontSize: 12.5, color: '#8A5D00', fontWeight: 700, marginTop: 3 }}>{e.extra}</div>}
              {e.links.length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                  {e.links.map(l => (
                    <button key={l.label} onClick={l.onClick} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F.body, textAlign: 'left',
                      fontSize: 12.5, fontWeight: 700, color: C.navy, textDecoration: 'underline', textUnderlineOffset: 3,
                    }}>{l.label}</button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
