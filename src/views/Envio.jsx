import { useState, useRef } from 'react'
import { enviarEmailViaScript } from '../hooks/useSheets'

const WEBHOOK = 'https://hook.us2.make.com/3xhcn02owq56c196s0j3anawf5zesxht'

function getEstado(d) {
  if (d.total === 0) return 'red'
  if (d.pct >= 50) return 'green'
  return 'amber'
}

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0,10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

function buildEmailHTML(d, campNombre) {
  const color = { green: '#059669', amber: '#d97706', red: '#e11d48' }[getEstado(d)]
  const varTxt = d.var !== null
    ? (d.var > 0 ? ` (+${d.var} vs semana anterior)`
      : d.var < 0 ? ` (${d.var} vs semana anterior)`
      : ' (sin variación)')
    : ''
  return `<p>${d.saludo}:</p>
<p style="margin-top:6px">Enviamos el resultado del <strong>cómo vamos</strong> al ${fmtFecha(d.fecha)}</p>
<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px">
  <tr style="background:#1a1a2e;color:#fff">
    <th style="padding:7px 10px;text-align:center;font-size:11px">COD SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">SEDE</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">OBJETIVO ${campNombre.toUpperCase()}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">TOTAL AL ${fmtFecha(d.fecha)}</th>
    <th style="padding:7px 10px;text-align:center;font-size:11px">% CUMPLIMIENTO</th>
  </tr>
  <tr>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.cod_sede}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.sede}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.objetivo}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb">${d.total}${varTxt}</td>
    <td style="padding:7px 10px;text-align:center;border:1px solid #e5e7eb;color:${color};font-weight:700">${d.pct}%</td>
  </tr>
</table>
<p style="margin-top:8px">Quedamos a disposición para cualquier consulta o duda que puedas tener.</p>
<p style="margin-top:10px">Feliz fin de semana.<br>Saludos!</p>`
}

function TooltipHelp({ text }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{
        fontSize: 11, color: '#94a3b8', cursor: 'help', background: '#f1f5f9',
        borderRadius: '50%', width: 18, height: 18,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
      }}>?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, background: '#0f172a', color: '#fff', fontSize: 11,
          padding: '6px 12px', borderRadius: 6, zIndex: 99, width: 260,
          textAlign: 'center', lineHeight: 1.5, pointerEvents: 'none',
        }}>{text}</div>
      )}
    </div>
  )
}

// Modal preview de email por sede
function PreviewModal({ sede, campNombre, onClose, onSend }) {
  const [enviando, setEnviando] = useState(false)
  const htmlBase = buildEmailHTML(sede, campNombre)

  const handleSend = async () => {
    setEnviando(true)
    await onSend(sede, null)
    setEnviando(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620,
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#1B2A6B,#0f1d4a)',
          padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Vista previa del email</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2 }}>
              {sede.sede} · {sede.email}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {[['Objetivo', sede.objetivo], ['Total', sede.total], ['Cumplimiento', sede.pct + '%'], ['Variación', sede.var !== null ? (sede.var > 0 ? '+' + sede.var : sede.var) : '—']].map(([l, v]) => (
            <div key={l} style={{ flex: 1, padding: '10px 16px', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Preview o editor */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Vista previa · tabla HTML lista para Gmail
          </div>
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px',
            fontSize: 13, lineHeight: 1.7, color: '#222', background: '#fafafa',
          }} dangerouslySetInnerHTML={{ __html: htmlBase }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSend} disabled={enviando} style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'linear-gradient(135deg,#C8102E,#9b0d23)', color: '#fff', border: 'none',
            cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.7 : 1,
          }}>
            {enviando ? 'Enviando…' : '🚀 Enviar este email'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Envio({ data, copied, onCopied, campanas, campanaActiva, guardarSemana }) {
  const [seleccion, setSeleccion] = useState({})
  const [log, setLog] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [modalConfirm, setModalConfirm] = useState(false)
  const [previewSede, setPreviewSede] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState(new Date().toISOString().slice(0,10))
  const [valores, setValores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const logRef = useRef(null)

  const camp = campanas?.find(c => c.id === campanaActiva)
  const cerrada = camp?.estado === 'cerrada'
  const pendientes = data.filter(d => !copied[d.cod_sede])
  const enviadas   = data.filter(d => copied[d.cod_sede])
  const seleccionadas = Object.keys(seleccion).filter(c => seleccion[c])
  const aEnviar = seleccionadas.length > 0
    ? data.filter(d => seleccionadas.includes(String(d.cod_sede)) && !copied[d.cod_sede])
    : pendientes

  const addLog = (msg, tipo = 'info') => {
    setLog(prev => {
      const next = [...prev, { msg, tipo, ts: new Date().toLocaleTimeString() }]
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
      return next
    })
  }

  const toggleSel = (cod) => setSeleccion(prev => ({ ...prev, [cod]: !prev[cod] }))
  const selAll = () => { const n = {}; pendientes.forEach(d => { n[d.cod_sede] = true }); setSeleccion(n) }
  const deselAll = () => setSeleccion({})

  const enviarUno = async (d, htmlCustom = null) => {
    const htmlRich = htmlCustom || buildEmailHTML(d, camp?.nombre || '')
    const fecha = d.fecha || new Date().toISOString().slice(0,10)
    const campNom = camp?.nombre || ''
    await enviarEmailViaScript({
      to:      d.email,
      subject: 'Como Vamos — ' + campNom + ' — ' + fmtFecha(fecha),
      html:    htmlRich,
      sede:    d.sede,
      cod:     String(d.cod_sede),
      fecha:   fecha,
    })
    onCopied(d.cod_sede)
  }

  const enviarTodos = async () => {
    setEnviando(true); setLog([]); setProgreso(0)
    addLog(`Iniciando envío de ${aEnviar.length} emails…`, 'info')
    for (let i = 0; i < aEnviar.length; i++) {
      const d = aEnviar[i]
      try {
        await enviarUno(d)
        addLog(`✓ ${d.sede}`, 'ok')
      } catch {
        addLog(`✗ Error en ${d.sede}`, 'error')
      }
      setProgreso(Math.round((i + 1) / aEnviar.length * 100))
    }
    addLog(`Listo. ${aEnviar.length} emails procesados.`, 'ok')
    setEnviando(false); setSeleccion({})
  }

  const handleGuardar = async () => {
    if (!nuevaFecha) return
    setGuardando(true)
    try {
      const sedes = data.map(d => ({ cod: d.cod_sede, sede: d.sede, total: Number(valores[d.cod_sede] ?? d.total) || 0 }))
      await guardarSemana(nuevaFecha, sedes)
      setMostrarNueva(false); setValores({})
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {previewSede && (
        <PreviewModal
          sede={previewSede}
          campNombre={camp?.nombre || ''}
          onClose={() => setPreviewSede(null)}
          onSend={enviarUno}
        />
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { l: 'Total sedes',  v: data.length,      c: '#1B2A6B' },
          { l: 'Enviadas',     v: enviadas.length,   c: '#059669' },
          { l: 'Pendientes',   v: pendientes.length, c: pendientes.length > 0 ? '#d97706' : '#94a3b8' },
        ].map(s => (
          <div key={s.l} style={{
            background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.06)',
            borderRadius: 14, padding: '18px 24px', borderTop: `3px solid ${s.c}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Panel de envío */}
      {!cerrada && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg,#C8102E,#9b0d23)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Envío semanal</div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2 }}>
                Desde mcrossi@ucasal.edu.ar vía Make · {aEnviar.length} {seleccionadas.length > 0 ? 'seleccionadas' : 'pendientes'}
              </div>
            </div>
            {pendientes.length > 0 && !enviando && (
              <button onClick={() => setModalConfirm(true)} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#fff', color: '#C8102E', border: 'none', cursor: 'pointer' }}>
                🚀 Enviar {aEnviar.length} emails
              </button>
            )}
            {enviando && <div style={{ color: '#fff', fontSize: 13 }}>Enviando… {progreso}%</div>}
          </div>

          {progreso > 0 && (
            <div style={{ height: 4, background: '#f1f5f9' }}>
              <div style={{ width: `${progreso}%`, height: '100%', background: 'linear-gradient(90deg,#C8102E,#f43f5e)', transition: 'width 0.3s' }} />
            </div>
          )}

          {log.length > 0 && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div ref={logRef} style={{ background: '#0f172a', borderRadius: 10, padding: '12px 16px', height: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.tipo === 'ok' ? '#4ade80' : l.tipo === 'error' ? '#f87171' : '#94a3b8', lineHeight: 1.8 }}>
                    <span style={{ color: '#475569', marginRight: 8 }}>{l.ts}</span>{l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendientes.length > 0 && (
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pendientes de envío
                </div>
                <TooltipHelp text="Seleccioná las sedes que querés enviar ahora. Sin selección se envían todas. Usá 👁 Ver para previsualizar el email — podés editarlo si necesitás." />
                <div style={{ flex: 1 }} />
                <button onClick={selAll} style={{ fontSize: 11, color: '#1B2A6B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sel. todas</button>
                <button onClick={deselAll} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {pendientes.map(d => {
                  const sel = seleccion[d.cod_sede]
                  const pct = d.pct
                  const color = pct >= 50 ? '#059669' : pct > 0 ? '#d97706' : '#e11d48'
                  return (
                    <div key={d.cod_sede} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: sel ? '#eef0f8' : '#f8fafc',
                      border: `1px solid ${sel ? '#b8c0e0' : '#e2e8f0'}`,
                      borderRadius: 8, transition: 'all 0.15s',
                    }}>
                      <div onClick={() => toggleSel(d.cod_sede)} style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                        border: `2px solid ${sel ? '#1B2A6B' : '#cbd5e1'}`,
                        background: sel ? '#1B2A6B' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{d.sede}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.email}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      <button
                        onClick={() => setPreviewSede(d)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
                          cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1B2A6B'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#1B2A6B' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                      >
                        👁 Ver
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {enviadas.length > 0 && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                ✓ Enviadas esta sesión
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {enviadas.map(d => (
                  <span key={d.cod_sede} style={{ fontSize: 11, background: '#ecfdf5', color: '#059669', border: '1px solid #6ee7b7', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                    ✓ {d.sede}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registrar nueva semana */}
      {!cerrada && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: mostrarNueva ? '1px solid #e2e8f0' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>📅 Registrar nueva semana</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Ingresá los totales manualmente y guardá en Sheets</div>
            </div>
            <TooltipHelp text="Alternativa a subir el Excel: ingresás los totales manualmente por sede y se guarda en el historial de Google Sheets." />
            <div style={{ width: 12 }} />
            <button onClick={() => setMostrarNueva(v => !v)} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: mostrarNueva ? '#f1f5f9' : '#1B2A6B',
              color: mostrarNueva ? '#64748b' : '#fff', border: 'none', cursor: 'pointer',
            }}>
              {mostrarNueva ? '▲ Cerrar' : '▼ Abrir'}
            </button>
          </div>

          {mostrarNueva && (
            <div className="animate-fadeIn" style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Fecha del corte:</label>
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                <button onClick={() => { const p = {}; data.forEach(d => { p[d.cod_sede] = d.total }); setValores(p) }}
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                  Copiar valores actuales
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, marginBottom: 16, maxHeight: 360, overflowY: 'auto' }}>
                {data.map(d => (
                  <div key={d.cod_sede} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.sede.replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}
                    </span>
                    <input type="number" min="0"
                      value={valores[d.cod_sede] ?? d.total}
                      onChange={e => setValores(prev => ({ ...prev, [d.cod_sede]: e.target.value }))}
                      style={{ width: 60, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleGuardar} disabled={guardando} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#1B2A6B', color: '#fff', border: 'none', cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando…' : '💾 Guardar en Sheets'}
                </button>
                <button onClick={() => setMostrarNueva(false)} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal confirmación masiva */}
      {modalConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            <div style={{ background: 'linear-gradient(135deg,#C8102E,#9b0d23)', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>🚀 Confirmar envío</div>
                <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 4 }}>{aEnviar.length} emails desde mcrossi@ucasal.edu.ar</div>
              </div>
              <button onClick={() => setModalConfirm(false)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {aEnviar.map(d => (
                  <div key={d.cod_sede} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{d.sede}</span>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{d.email}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                💡 Para revisar o editar un email individual, cerrá y usá el botón "👁 Ver" en cada sede.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalConfirm(false)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => { setModalConfirm(false); enviarTodos() }} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#C8102E,#9b0d23)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  ✅ Confirmar y enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
