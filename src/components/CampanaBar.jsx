import { useState, useEffect, useMemo, useRef } from 'react'
import { obtenerObjetivos, cerrarCampana, obtenerUltimoDeshacer, deshacerUltimo, restaurarBackup, simularRestauracion } from '../hooks/useSheets'
import { C, F, cifra } from '../lib/theme'
import { descargarBackupExcel, descargarResultadosExcel, leerBackupExcel } from '../lib/excel'
import ModalShell from './ModalShell'
import { generarInformeCierre } from './InformesPDF'

function fmtFecha(iso) {
  if (!iso) return ''
  const p = String(iso).slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: F.body }
const inputStyle = { width: '100%', padding: '7px 9px', border: `1px solid ${C.rule}`, borderRadius: 8, fontSize: 13, fontFamily: F.body, background: '#fff' }

function Boton({ children, onClick, disabled, tone = 'ink' }) {
  const tones = {
    ink:     { background: C.navy, color: '#fff', border: 'none' },
    crimson: { background: C.crimson, color: '#fff', border: 'none' },
    ghost:   { background: '#fff', color: C.navy, border: `1px solid ${C.rule}` },
  }
  return (
    <button onClick={onClick} disabled={disabled} className="btn-press" style={{
      height: 38, padding: '0 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, fontFamily: F.body,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, ...tones[tone],
    }}>
      {children}
    </button>
  )
}

function Dato({ label, value, color = C.ink }) {
  return (
    <div style={{ flex: 1, minWidth: 120, borderLeft: `4px solid ${color}`, padding: '2px 0 2px 12px' }}>
      <div style={{ ...cifra(26), color: C.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5 }}>{label}</div>
    </div>
  )
}

// Mismo criterio que el backend: el historial y el log de envíos se asocian
// a la campaña por nombre (con substring), así que dos nombres donde uno
// contiene al otro mezclarían datos.
function nombreSuperpuesto(nombre, campanas) {
  const n = nombre.trim().toLowerCase()
  if (!n) return null
  return campanas.find(c => {
    const o = String(c.nombre || '').toLowerCase()
    return o && (o === n || o.includes(n) || n.includes(o))
  }) || null
}

// Cierre de la campaña activa + apertura de la siguiente con sus objetivos.
// Si no hay ninguna campaña activa, el mismo flujo sirve para abrir una nueva.
function CierreModal({ campanas, campanaActiva, data, stats, sedes, historial, onClose, onDone }) {
  const camp = campanas.find(c => c.id === campanaActiva)
  const cerrando = camp?.estado === 'activa' ? camp : null

  const [paso, setPaso] = useState(cerrando ? 'resumen' : 'nueva')
  const [abrirNueva, setAbrirNueva] = useState(true)
  const [cortesOk, setCortesOk] = useState(false)
  const [nombre, setNombre] = useState('')
  const [fin, setFin] = useState('')
  const [base, setBase] = useState(campanaActiva || campanas[campanas.length - 1]?.id || '')
  const [objetivos, setObjetivos] = useState({}) // cod_sede → string
  const [cargandoObj, setCargandoObj] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const sedesOrdenadas = useMemo(
    () => [...sedes].sort((a, b) => String(a.sede).localeCompare(String(b.sede))),
    [sedes]
  )

  // Precarga los objetivos de la campaña base — lo habitual es partir de los
  // de la campaña anterior y ajustar algunas sedes.
  useEffect(() => {
    if (!base) return
    setCargandoObj(true)
    obtenerObjetivos(base)
      .then(rows => {
        const m = {}
        rows.forEach(r => { m[String(r.cod_sede)] = String(Number(r.objetivo) || '') })
        setObjetivos(m)
      })
      .catch(() => setObjetivos({}))
      .finally(() => setCargandoObj(false))
  }, [base])

  const totalObjetivo = sedesOrdenadas.reduce((acc, s) => acc + (Number(objetivos[String(s.cod_sede)]) || 0), 0)
  const sedesConObjetivo = sedesOrdenadas.filter(s => Number(objetivos[String(s.cod_sede)]) > 0).length
  const choque = nombreSuperpuesto(nombre, campanas)

  const errorNueva = !nombre.trim() ? 'Poné un nombre para la campaña nueva'
    : choque ? `El nombre se superpone con "${choque.nombre}" — agregale el año o algo que lo distinga`
    : !sedesConObjetivo ? 'Cargá al menos un objetivo'
    : null

  const confirmar = async () => {
    setGuardando(true); setError(null)
    // Backup obligatorio antes de cerrar: es lo que permite volver atrás con
    // "Restaurar backup" si algo quedó mal. Si no se pudo bajar, no se cierra.
    if (cerrando) {
      try { await descargarBackupExcel() }
      catch (e) {
        setError('No se pudo descargar el backup, así que no se cerró nada: ' + e.message)
        setGuardando(false)
        return
      }
    }
    try {
      const payload = {}
      if (cerrando) payload.campana_id = cerrando.id
      if (!cerrando || abrirNueva) {
        payload.nueva = {
          nombre: nombre.trim(),
          fin,
          objetivos: sedesOrdenadas
            .map(s => ({ cod_sede: String(s.cod_sede), objetivo: Number(objetivos[String(s.cod_sede)]) || 0 }))
            .filter(o => o.objetivo > 0),
        }
      }
      const res = await cerrarCampana(payload)
      await onDone(res.nueva_id || campanaActiva)
      onClose()
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  const footer = (children) => (
    <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
      {children}
    </div>
  )

  const cuerpo = { flex: 1, overflow: 'auto', padding: '18px 20px', fontFamily: F.body, color: C.ink }

  // Cortes cargados y huecos: dos cortes separados por más de 10 días, o un
  // último corte muy anterior al fin de la campaña, sugieren un Excel que no
  // se subió. Una vez cerrada ya no se pueden cargar, así que se revisa acá.
  const cortes = [...new Set((historial || []).map(r => String(r.fecha).slice(0, 10)))].sort()
  const avisosCortes = []
  for (let i = 1; i < cortes.length; i++) {
    const dias = Math.round((new Date(cortes[i]) - new Date(cortes[i - 1])) / 86400000)
    if (dias > 10) avisosCortes.push(`Pasaron ${dias} días entre el corte del ${fmtFecha(cortes[i - 1])} y el del ${fmtFecha(cortes[i])}`)
  }
  const finCamp = cerrando?.fin ? String(cerrando.fin).slice(0, 10) : null
  if (finCamp && cortes.length) {
    const dias = Math.round((new Date(finCamp) - new Date(cortes[cortes.length - 1])) / 86400000)
    if (dias > 10) avisosCortes.push(`El último corte es del ${fmtFecha(cortes[cortes.length - 1])} y la campaña terminó el ${fmtFecha(finCamp)}`)
  }

  if (paso === 'resumen') {
    const fechaCorte = data[0]?.fecha
    return (
      <ModalShell onClose={onClose} title={`Cerrar ${cerrando.nombre}`} sub="Paso 1 · Resultado final" maxWidth={560}>
        <div style={cuerpo}>
          {data.length ? (
            <>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
                La campaña cierra con el último corte cargado{fechaCorte ? <> — <strong style={{ color: C.ink }}>{fmtFecha(fechaCorte)}</strong></> : null}.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <Dato label="cumplimiento de la zona" value={`${stats.pctGlobal}%`} color={stats.pctGlobal >= 50 ? C.ok : C.warn} />
                <Dato label={`inscriptos de ${stats.totalObj}`} value={stats.totalIng} color={C.navy} />
                <Dato label="sedes en objetivo" value={`${stats.enObj}/${stats.total}`} color={C.ok} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: C.warn, marginBottom: 16 }}>Esta campaña no tiene cortes cargados.</div>
          )}

          <div style={{ background: C.paper, borderLeft: `3px solid ${C.inkSoft}`, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.55, color: C.inkSoft, marginBottom: 16 }}>
            Al cerrarla queda <strong style={{ color: C.ink }}>en modo consulta</strong>: no se pueden subir más cortes ni mandar mails.
            Todo su historial se conserva, y la podés comparar contra la nueva desde <strong style={{ color: C.ink }}>Historial → Comparar campañas</strong>.
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Cortes cargados ({cortes.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: avisosCortes.length ? 10 : 0 }}>
              {cortes.map(f => (
                <span key={f} style={{ fontFamily: F.mono, fontSize: 11, padding: '3px 7px', background: C.paper, border: `1px solid ${C.ruleSoft}` }}>{fmtFecha(f)}</span>
              ))}
            </div>
            {avisosCortes.map(a => (
              <div key={a} style={{ fontSize: 12.5, color: '#6b4d1a', background: 'rgba(168,117,42,0.08)', borderLeft: `3px solid ${C.warn}`, padding: '6px 10px', marginBottom: 6 }}>
                {a} — ¿falta subir algún Excel?
              </div>
            ))}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={cortesOk} onChange={e => setCortesOk(e.target.checked)} style={{ marginTop: 3 }} />
              Confirmo que están subidos todos los Excel de la campaña (después de cerrarla ya no se pueden cargar)
            </label>
          </div>

          {data.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={labelStyle}>Antes de cerrar (opcional)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Boton tone="ghost" onClick={() => generarInformeCierre({ camp: cerrando, data, historial })}>Informe final</Boton>
                <Boton tone="ghost" onClick={() => descargarResultadosExcel(cerrando.nombre, data, historial)}>Resultados en Excel</Boton>
                <BotonBackup />
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={abrirNueva} onChange={e => setAbrirNueva(e.target.checked)} />
            Abrir la campaña siguiente ahora
          </label>
        </div>
        {footer(<>
          <Boton tone="ghost" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={() => setPaso(abrirNueva ? 'nueva' : 'confirmar')} disabled={!cortesOk}>Siguiente</Boton>
        </>)}
      </ModalShell>
    )
  }

  if (paso === 'nueva') {
    return (
      <ModalShell onClose={onClose} title="Campaña nueva" sub={cerrando ? 'Paso 2 · Nombre y objetivos' : 'Nombre y objetivos por sede'} maxWidth={640}>
        <div style={cuerpo}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <div style={labelStyle}>Nombre</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: 1er Ingreso 2027" style={inputStyle} autoFocus />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={labelStyle}>Fin (opcional)</div>
              <input type="date" value={fin} onChange={e => setFin(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {choque && <div style={{ color: C.crimson, fontSize: 12, marginTop: -8, marginBottom: 12 }}>{errorNueva}</div>}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={labelStyle}>Objetivos por sede</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>
                Precargados desde{' '}
                <select value={base} onChange={e => setBase(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '3px 6px', fontSize: 12 }}>
                  {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {' '}— editá los que cambian. Dejá vacío o en 0 para no incluir la sede.
              </div>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, whiteSpace: 'nowrap' }}>
              {sedesConObjetivo} sedes · total <strong>{totalObjetivo}</strong>
            </div>
          </div>

          <div style={{ border: `1px solid ${C.rule}`, opacity: cargandoObj ? 0.5 : 1 }}>
            {sedesOrdenadas.map((s, i) => {
              const cod = String(s.cod_sede)
              return (
                <div key={cod} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px',
                  background: i % 2 ? C.paper : '#fff', borderBottom: i < sedesOrdenadas.length - 1 ? `1px solid ${C.ruleSoft}` : 'none',
                }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, width: 52, flexShrink: 0 }}>{cod}</span>
                  <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(s.sede).replace(/ - BUENOS AIRES.*/, '').replace(/ - BS AS$/, '')}
                  </span>
                  <input
                    type="number" min="0" inputMode="numeric"
                    value={objetivos[cod] ?? ''}
                    onChange={e => setObjetivos(o => ({ ...o, [cod]: e.target.value }))}
                    style={{ ...inputStyle, width: 90, padding: '4px 8px', fontFamily: F.mono, textAlign: 'right' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        {footer(<>
          {!choque && errorNueva && nombre.trim() && <span style={{ color: C.crimson, fontSize: 12, alignSelf: 'center', marginRight: 'auto' }}>{errorNueva}</span>}
          <Boton tone="ghost" onClick={cerrando ? () => setPaso('resumen') : onClose}>{cerrando ? 'Atrás' : 'Cancelar'}</Boton>
          <Boton onClick={() => setPaso('confirmar')} disabled={!!errorNueva || cargandoObj}>Siguiente</Boton>
        </>)}
      </ModalShell>
    )
  }

  // paso === 'confirmar'
  const abre = !cerrando || abrirNueva
  return (
    <ModalShell onClose={onClose} cerrable={!guardando} title="Confirmar" sub="Revisá antes de aplicar" maxWidth={500}>
      <div style={cuerpo}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
          {cerrando && <li>Se cierra <strong>{cerrando.nombre}</strong>{data.length ? <> con <strong>{stats.pctGlobal}%</strong> de cumplimiento</> : null}.</li>}
          {abre && <li>Se abre <strong>{nombre.trim()}</strong> con <strong>{sedesConObjetivo}</strong> sedes y objetivo total <strong>{totalObjetivo}</strong>{fin ? <> (fin {fmtFecha(fin)})</> : null}.</li>}
          {abre && <li>Desde ahí, los Excel que subas cargan los cortes de la campaña nueva.</li>}
          {cerrando && <li>Antes de aplicar se descarga un <strong>backup completo</strong> — guardalo: con "Restaurar backup" se vuelve a este punto.</li>}
        </ul>
        {error && <div style={{ color: C.crimson, fontSize: 12.5, marginTop: 14 }}>{error}</div>}
      </div>
      {footer(<>
        <Boton tone="ghost" onClick={() => setPaso(abre && cerrando ? 'nueva' : cerrando ? 'resumen' : 'nueva')} disabled={guardando}>Atrás</Boton>
        <Boton tone="crimson" onClick={confirmar} disabled={guardando}>
          {guardando ? 'Aplicando…' : cerrando ? (abre ? 'Cerrar y abrir nueva' : 'Cerrar campaña') : 'Abrir campaña'}
        </Boton>
      </>)}
    </ModalShell>
  )
}

function BotonBackup({ tone = 'ghost' }) {
  const [estado, setEstado] = useState(null) // null | 'cargando' | 'error'
  const bajar = async () => {
    setEstado('cargando')
    try { await descargarBackupExcel(); setEstado(null) }
    catch (e) { setEstado('error'); alert('No se pudo generar el backup: ' + e.message) }
  }
  return (
    <Boton tone={tone} onClick={bajar} disabled={estado === 'cargando'}>
      {estado === 'cargando' ? 'Generando…' : 'Backup completo'}
    </Boton>
  )
}

// Backup y restauración juntos en un menú: se usan poco, no merecen dos
// botones permanentes al lado de "Cerrar campaña".
function MenuRespaldo({ onRestaurar }) {
  const [abierto, setAbierto] = useState(false)
  const [bajando, setBajando] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])
  const bajar = async () => {
    setAbierto(false); setBajando(true)
    try { await descargarBackupExcel() } catch (e) { alert('No se pudo generar el backup: ' + e.message) }
    setBajando(false)
  }
  const item = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F.body }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Boton tone="ghost" onClick={() => setAbierto(a => !a)} disabled={bajando}>{bajando ? 'Generando backup…' : 'Respaldo ▾'}</Boton>
      {abierto && (
        <div className="animate-fadeIn" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 280, zIndex: 40, background: '#fff', border: `1px solid ${C.rule}`, borderRadius: 10, padding: 5, boxShadow: '0 16px 40px -12px rgba(14,23,51,0.35)' }}>
          {[
            ['Descargar backup completo', 'Excel con campañas, objetivos, cortes y sedes', bajar],
            ['Restaurar desde un backup', 'Volver la base al punto de un Excel de backup', () => { setAbierto(false); onRestaurar() }],
          ].map(([t, d, fn]) => (
            <button key={t} onClick={fn} style={item}
              onMouseEnter={e => { e.currentTarget.style.background = C.ruleSoft }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{t}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DeshacerModal({ op, onClose, onDone }) {
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState(null)
  const aplicar = async () => {
    setAplicando(true); setError(null)
    try {
      const res = await deshacerUltimo(op.id)
      await onDone(res)
      onClose()
    } catch (e) { setError(e.message); setAplicando(false) }
  }
  const esCierre = op.accion === 'cerrar_campana'
  return (
    <ModalShell onClose={onClose} cerrable={!aplicando} title="Deshacer" sub={`Operación del ${op.fecha_hora}`} maxWidth={480}>
      <div style={{ padding: '18px 20px', fontFamily: F.body, color: C.ink, fontSize: 13.5, lineHeight: 1.6 }}>
        <div style={{ marginBottom: 10 }}>Se va a revertir: <strong>{op.descripcion}</strong>.</div>
        <div style={{ color: C.inkSoft, fontSize: 12.5 }}>
          {esCierre
            ? 'La campaña cerrada vuelve a quedar activa y se elimina la campaña nueva con sus objetivos (solo si todavía no se le cargaron cortes).'
            : 'Se borran los datos de ese corte y, si reemplazó a uno anterior, se restauran los valores que había antes.'}
        </div>
        {error && <div style={{ color: C.crimson, fontSize: 12.5, marginTop: 12 }}>{error}</div>}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton tone="ghost" onClick={onClose} disabled={aplicando}>Cancelar</Boton>
        <Boton tone="crimson" onClick={aplicar} disabled={aplicando}>{aplicando ? 'Deshaciendo…' : 'Deshacer'}</Boton>
      </div>
    </ModalShell>
  )
}

function RestaurarModal({ onClose, onDone }) {
  const inputRef = useRef(null)
  const [leido, setLeido] = useState(null) // { hojas, resumen, fileName }
  const [paso, setPaso] = useState('elegir') // elegir | aplicando
  const [simulacion, setSimulacion] = useState(null) // qué cambiaría, sin escribir nada
  const [error, setError] = useState(null)

  const elegir = async (file) => {
    if (!file) return
    setError(null); setLeido(null); setSimulacion(null)
    try {
      const l = { ...(await leerBackupExcel(file)), fileName: file.name }
      setLeido(l)
      setSimulacion(await simularRestauracion(l.hojas))
    }
    catch (e) { setError(e.message) }
  }

  const aplicar = async () => {
    setPaso('aplicando'); setError(null)
    // Primero un backup del estado actual: así la restauración también se
    // puede revertir (restaurando ese archivo).
    try { await descargarBackupExcel() }
    catch (e) {
      setError('No se pudo descargar el backup del estado actual, así que no se restauró nada: ' + e.message)
      setPaso('elegir'); return
    }
    try {
      await restaurarBackup(leido.hojas)
      await onDone()
      onClose()
    } catch (e) { setError(e.message); setPaso('elegir') }
  }

  const r = leido?.resumen
  return (
    <ModalShell onClose={onClose} cerrable={paso !== 'aplicando'} title="Restaurar backup" sub="Volver campañas, objetivos y cortes a como estaban en un backup" maxWidth={520}>
      <div style={{ padding: '18px 20px', fontFamily: F.body, color: C.ink, fontSize: 13.5, lineHeight: 1.6, overflow: 'auto' }}>
        <input ref={inputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => elegir(e.target.files?.[0])} />
        <Boton tone="ghost" onClick={() => inputRef.current?.click()} disabled={paso === 'aplicando'}>
          {leido ? 'Elegir otro archivo' : 'Elegir el Excel de backup'}
        </Boton>

        {r && (
          <div style={{ marginTop: 14, background: C.paper, border: `1px solid ${C.ruleSoft}`, padding: '12px 14px', fontSize: 13 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginBottom: 6 }}>{leido.fileName}</div>
            {r.generado && <div>Generado: <strong>{r.generado}</strong></div>}
            <div>Campañas: {r.campanas.map(c => `${c.nombre} (${c.estado})`).join(' · ')}</div>
            <div>{r.cortes} cortes en total{r.ultimoCorte ? <> · último: <strong>{fmtFecha(r.ultimoCorte)}</strong></> : null}</div>
          </div>
        )}

        {leido && !simulacion && !error && <div style={{ marginTop: 12, fontSize: 12.5, color: C.inkSoft }}>Comparando con la base actual…</div>}
        {simulacion && (() => {
          const h = simulacion.hojas
          const total = Object.values(h).reduce((a, x) => a + x.celdas_distintas, 0)
          const nombres = { campanas: 'Campañas', objetivos: 'Objetivos', historial: 'Cortes (historial)' }
          return (
            <div style={{ marginTop: 14, fontSize: 12.5 }}>
              <div style={labelStyle}>Qué cambiaría</div>
              {total === 0 ? (
                <div style={{ color: C.ok, fontWeight: 600 }}>✓ El backup es idéntico a la base actual — restaurarlo no cambia nada.</div>
              ) : Object.entries(h).map(([k, x]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <strong>{nombres[k]}</strong>: {x.filas_actuales} filas hoy → {x.filas_backup} en el backup
                  {x.celdas_distintas ? <> · {x.celdas_distintas} celdas distintas</> : ' · sin cambios'}
                  {x.ejemplos.map(e => <div key={e} style={{ fontFamily: F.mono, fontSize: 10.5, color: C.inkSoft, marginLeft: 10 }}>{e}</div>)}
                </div>
              ))}
            </div>
          )
        })()}

        {r && (
          <div style={{ marginTop: 14, borderLeft: `3px solid ${C.crimson}`, background: 'rgba(200,16,46,0.05)', padding: '10px 14px', fontSize: 12.5, color: C.ink }}>
            Todo lo que se haya cargado o cerrado <strong>después</strong> de este backup se reemplaza por lo que tiene el archivo.
            Las sedes (emails, saludos) y el registro de envíos no se tocan. Antes de restaurar se descarga un backup del estado actual, por si hay que volver.
          </div>
        )}
        {error && <div style={{ color: C.crimson, fontSize: 12.5, marginTop: 12 }}>{error}</div>}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton tone="ghost" onClick={onClose} disabled={paso === 'aplicando'}>Cancelar</Boton>
        <Boton tone="crimson" onClick={aplicar} disabled={!leido || !simulacion || paso === 'aplicando'}>
          {paso === 'aplicando' ? 'Restaurando…' : 'Restaurar este backup'}
        </Boton>
      </div>
    </ModalShell>
  )
}

function diasEntre(desdeIso, hastaIso) {
  return Math.round((new Date(hastaIso) - new Date(desdeIso)) / 86400000)
}

// Barra de estado de la campaña, arriba del Dashboard: dónde está parada la
// campaña y las acciones de mantenimiento — cerrar (el botón protagonista),
// deshacer la última carga/cierre, backup, e informes de la campaña cerrada.
export default function CampanaBar({ campanas, campanaActiva, data, stats, sedes, historial, onCampanasChanged, onRecargarCampana }) {
  const [modal, setModal] = useState(null) // 'cierre' | 'deshacer' | 'restaurar'
  const [ultimaOp, setUltimaOp] = useState(null)
  const [informePorSede, setInformePorSede] = useState(false)

  const camp = campanas?.find(c => c.id === campanaActiva)
  const hayActiva = campanas?.some(c => c.estado === 'activa')
  const activa = camp?.estado === 'activa'
  const cerrada = camp?.estado === 'cerrada'

  // Se relee cada vez que cambian los datos (nueva carga, cierre, deshacer)
  useEffect(() => {
    obtenerUltimoDeshacer().then(setUltimaOp).catch(() => setUltimaOp(null))
  }, [historial, campanas])

  const hoyIso = new Date().toISOString().slice(0, 10)
  const fin = camp?.fin ? String(camp.fin).slice(0, 10) : null
  const diasAlFin = activa && fin ? diasEntre(hoyIso, fin) : null
  const vencida = diasAlFin !== null && diasAlFin < 0

  const onDeshecho = async (res) => {
    const id = res.campana_id || campanaActiva
    await onCampanasChanged(id)
    if (id === campanaActiva) onRecargarCampana(id)
  }

  // Después de restaurar, la campaña que se estaba viendo puede no existir
  // más: se vuelve a la activa del backup (o la última).
  const onRestaurado = async () => {
    const lista = await onCampanasChanged()
    const destino = lista.find(c => c.id === campanaActiva) ? campanaActiva
      : (lista.find(c => c.estado === 'activa') || lista[lista.length - 1])?.id
    if (destino === campanaActiva) onRecargarCampana(destino)
    else await onCampanasChanged(destino)
  }

  let detalle
  if (activa) {
    detalle = fin
      ? vencida ? <span style={{ color: C.crimson, fontWeight: 600 }}>Terminó el {fmtFecha(fin)} — cerrala para arrancar la siguiente</span>
        : <>Fin {fmtFecha(fin)} · quedan {diasAlFin} días</>
      : <>En curso{camp?.inicio ? ` desde ${fmtFecha(camp.inicio)}` : ''}</>
  } else if (cerrada) {
    detalle = <>Cerrada{camp?.fecha_cierre ? ` el ${fmtFecha(camp.fecha_cierre)}` : ''}{data.length ? <> · resultado final <strong style={{ color: stats.pctGlobal >= 50 ? C.ok : C.warn }}>{stats.pctGlobal}%</strong></> : null}</>
  }

  return (
    <>
      <div style={{
        background: vencida ? '#FDF2F4' : C.paperRaised, border: `1px solid ${vencida ? 'rgba(200,16,46,0.35)' : C.rule}`,
        borderRadius: 12, padding: '14px 14px 14px 18px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontFamily: F.body,
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: activa ? '#4CA678' : C.inkSoft, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{activa ? 'Campaña activa' : cerrada ? 'Campaña cerrada' : 'Sin campaña activa'}</span>
          </div>
          {detalle && <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 3, marginLeft: 16 }}>{detalle}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {ultimaOp && (
            <button onClick={() => setModal('deshacer')} className="btn-press" title={`${ultimaOp.descripcion} (${ultimaOp.fecha_hora})`} style={{
              height: 38, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: F.body, cursor: 'pointer',
              background: '#fff', color: C.ink, border: `1px solid ${C.rule}`, maxWidth: 300,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {ultimaOp.accion === 'cerrar_campana' ? 'Deshacer cierre' : 'Deshacer última carga'}
            </button>
          )}
          <MenuRespaldo onRestaurar={() => setModal('restaurar')} />
          {cerrada && data.length > 0 && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.inkSoft, cursor: 'pointer' }}>
                <input type="checkbox" checked={informePorSede} onChange={e => setInformePorSede(e.target.checked)} />
                con hoja por sede
              </label>
              <Boton onClick={() => generarInformeCierre({ camp, data, historial, porSede: informePorSede })}>Imprimir informe de cierre</Boton>
              <Boton tone="ghost" onClick={() => descargarResultadosExcel(camp.nombre, data, historial)}>Resultados Excel</Boton>
            </>
          )}
          {activa && (
            <button onClick={() => setModal('cierre')} className="btn-press" style={{
              height: 38, padding: '0 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 800, fontFamily: F.body,
              cursor: 'pointer', background: C.crimson, color: '#fff', border: 'none',
              boxShadow: vencida ? `0 0 0 3px rgba(200,16,46,0.2)` : 'none',
            }}>
              Cerrar campaña
            </button>
          )}
          {!hayActiva && (
            <button onClick={() => setModal('cierre')} className="btn-press" style={{
              height: 38, padding: '0 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 800, fontFamily: F.body,
              cursor: 'pointer', background: C.navy, color: '#fff', border: 'none',
            }}>
              + Nueva campaña
            </button>
          )}
        </div>
      </div>

      {modal === 'cierre' && (
        <CierreModal
          campanas={campanas} campanaActiva={campanaActiva} data={data} stats={stats} sedes={sedes} historial={historial}
          onClose={() => setModal(null)} onDone={onCampanasChanged}
        />
      )}
      {modal === 'restaurar' && (
        <RestaurarModal onClose={() => setModal(null)} onDone={onRestaurado} />
      )}
      {modal === 'deshacer' && ultimaOp && (
        <DeshacerModal op={ultimaOp} onClose={() => setModal(null)} onDone={onDeshecho} />
      )}
    </>
  )
}
