import { useState, useRef, useEffect } from 'react'
import { C, F, rotulo } from '../lib/theme'
import ModalShell from './ModalShell'
import { cargarXLSX } from '../lib/xlsxLoader'
import { leerDocx, partirTexto } from '../lib/leerWord'
import { interpretarNotas, agregarBitacora } from '../hooks/useSheets'
import { fmtFecha } from '../lib/formato'
import { normHora } from '../lib/informe'

// Subir el Word con las notas de la semana: Gemini las ordena en filas,
// Cele las revisa acá y recién al confirmar se guardan en la bitácora.

const TIPOS = [['reunion', 'Reunión'], ['auditoria', 'Auditoría'], ['observacion', 'Observación'], ['semana', 'Toda la semana']]
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ¿Ya está en la bitácora? Misma fecha, mismo tipo y el texto empieza igual
function pareceDuplicada(f, existentes) {
  const clave = norm(`${f.motivo} ${f.resultado} ${f.acciones}`).slice(0, 40)
  if (!clave) return false
  return existentes.some(e => e.fecha === f.fecha && e.tipo === f.tipo &&
    norm(`${e.motivo} ${e.resultado} ${e.acciones}`).slice(0, 40) === clave)
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.rule}`,
  fontFamily: F.body, fontSize: 13.5, color: C.ink, background: '#fff',
}

function Fila({ f, i, semana, sedes, onCambio }) {
  const fuera = f.fecha && (f.fecha < semana.lunes || f.fecha > semana.domingo)
  const textarea = (campo, label) => (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkSoft, marginBottom: 2 }}>{label}</div>
      <textarea value={f[campo]} onChange={e => onCambio(campo, e.target.value)} disabled={!f.incluir}
        rows={Math.max(2, Math.min(6, String(f[campo] || '').split('\n').length + 1))} style={{ ...input, resize: 'vertical', lineHeight: 1.45 }} />
    </label>
  )
  return (
    <div style={{
      border: `1px solid ${C.rule}`, borderLeft: `4px solid ${!f.incluir ? C.rule : !f.fecha ? C.crimson : C.navy}`,
      borderRadius: 8, padding: 12, background: f.incluir ? '#fff' : C.ruleSoft, opacity: f.incluir ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: C.ink, alignSelf: 'center' }}>
          <input type="checkbox" checked={f.incluir} onChange={e => onCambio('incluir', e.target.checked)} style={{ accentColor: C.navy, width: 16, height: 16 }} />
          #{i + 1}
        </label>
        <label style={{ width: 150 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: !f.fecha && f.incluir ? C.crimson : C.inkSoft, marginBottom: 2 }}>
            Fecha{f.fechaDeducida ? ' (deducida)' : ''}
          </div>
          <input type="date" value={f.fecha} onChange={e => onCambio('fecha', e.target.value)} disabled={!f.incluir}
            style={{ ...input, borderColor: !f.fecha && f.incluir ? C.crimson : C.rule }} />
        </label>
        <label style={{ width: 150 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkSoft, marginBottom: 2 }}>Tipo</div>
          <select value={f.tipo} onChange={e => onCambio('tipo', e.target.value)} disabled={!f.incluir} style={input}>
            {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkSoft, marginBottom: 2 }}>Sede o tema</div>
          <input list="sedes-informe" value={f.sede} onChange={e => onCambio('sede', e.target.value)} disabled={!f.incluir} style={input} />
        </label>
        {f.tipo === 'reunion' && (
          <label style={{ width: 80 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkSoft, marginBottom: 2 }}>Hora</div>
            <input value={f.hora} onChange={e => onCambio('hora', e.target.value)} disabled={!f.incluir} placeholder="8:30" style={input} />
          </label>
        )}
      </div>
      {(f.duplicada || fuera || (!f.fecha && f.incluir)) && (
        <div style={{ fontSize: 12.5, color: C.crimson, fontWeight: 700, marginBottom: 8 }}>
          {!f.fecha && f.incluir && 'Falta la fecha: completala o destildá la fila. '}
          {fuera && `Esta fecha no es de la semana del ${fmtFecha(semana.lunes)}: va a aparecer en el informe de su semana. `}
          {f.duplicada && 'Parece que ya está en la bitácora (por eso quedó destildada).'}
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: f.tipo === 'reunion' || f.tipo === 'auditoria' ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr' }}>
        {f.tipo === 'reunion' && textarea('motivo', 'Motivo (uno por renglón)')}
        {textarea('resultado', f.tipo === 'reunion' ? 'Resultado (uno por renglón)' : f.tipo === 'auditoria' ? 'Resultado' : 'Qué pasó')}
        {f.tipo === 'auditoria' && textarea('acciones', 'Acciones de mejora')}
      </div>
      {f.tipo !== 'reunion' && f.motivo && (
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>Además dice: {f.motivo} <span style={{ fontStyle: 'italic' }}>(se suma al texto)</span></div>
      )}
      {f.cita && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8, fontStyle: 'italic' }}>Del Word: “{f.cita}”</div>}
      <datalist id="sedes-informe">{sedes.map(s => <option key={s.cod_sede} value={s.sede} />)}</datalist>
    </div>
  )
}

export default function ImportarWord({ semana, sedes, existentes, onAgregadas, disabled, onOcupado }) {
  const inputRef = useRef(null)
  const [paso, setPaso] = useState(null) // null | 'leyendo' | 'revisar' | 'guardando'
  const [archivo, setArchivo] = useState('')
  const [filas, setFilas] = useState([])
  const [error, setError] = useState(null)
  const [avance, setAvance] = useState(null)   // 'parte 2 de 3' al leer un Word largo
  const idLote = useRef(null)                  // mismo id en los reintentos: el servidor no duplica
  const enCurso = useRef(false)                // guarda contra el doble click

  // Mientras se lee o se guarda, la pantalla de atrás no se puede usar
  useEffect(() => { onOcupado?.(paso === 'leyendo' || paso === 'guardando') }, [paso]) // eslint-disable-line

  const elegir = async (file) => {
    if (!file) return
    setError(null); setArchivo(file.name); setPaso('leyendo')
    try {
      if (!/\.docx$/i.test(file.name)) throw new Error('Tiene que ser un Word .docx. Si es un .doc viejo o un PDF, abrilo en Word y guardalo como .docx.')
      const texto = await leerDocx(await file.arrayBuffer(), cargarXLSX)
      if (texto.replace(/\s/g, '').length < 10) throw new Error('El Word está vacío o no tiene texto.')
      if (texto.length > 40000) throw new Error(`El Word es muy largo (${Math.round(texto.length / 1000)} mil caracteres). Para una semana alcanza con las notas de esa semana: dividilo en partes.`)
      // Un Word largo va en partes (una llamada a Gemini por parte): cada una
      // entra holgada en el tiempo y la respuesta no se corta
      const partes = partirTexto(texto, 7000)
      let todas = []
      for (let k = 0; k < partes.length; k++) {
        setAvance(partes.length > 1 ? `parte ${k + 1} de ${partes.length}` : null)
        const r = await interpretarNotas(partes[k], semana.lunes, semana.domingo)
        todas = todas.concat(r?.filas || [])
      }
      const propuestas = todas.map(f => {
        const fila = {
          ...f,
          hora: normHora(f.hora),
          // En observaciones el motivo no tiene casillero: se suma al texto
          resultado: f.tipo === 'reunion' || f.tipo === 'auditoria' ? f.resultado : [f.motivo, f.resultado].filter(Boolean).join(' '),
          motivo: f.tipo === 'reunion' || f.tipo === 'auditoria' ? f.motivo : '',
        }
        if (f.tipo === 'auditoria' && f.motivo) { fila.resultado = [f.motivo, f.resultado].filter(Boolean).join('\n'); fila.motivo = '' }
        const duplicada = pareceDuplicada(fila, existentes)
        return { ...fila, duplicada, incluir: !duplicada }
      })
      if (!propuestas.length) throw new Error('Gemini no encontró actividades en el Word. Revisá que sea el archivo de notas.')
      idLote.current = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      setFilas(propuestas); setPaso('revisar')
    } catch (e) {
      setPaso(null)
      setError(e.message === 'SIN_API_KEY'
        ? 'Todavía no está cargada la clave de Gemini en el Apps Script (GEMINI_API_KEY): sin ella no se puede leer el Word. Mientras tanto, las notas se pueden cargar a mano en la pestaña bitacora.'
        : e.message)
    } finally {
      setAvance(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const cambiar = (i, campo, valor) => setFilas(fs => fs.map((f, j) => j === i ? { ...f, [campo]: valor } : f))
  const elegidas = filas.filter(f => f.incluir)
  const sinFecha = elegidas.filter(f => !f.fecha).length

  const guardar = async () => {
    if (enCurso.current) return
    enCurso.current = true
    setError(null); setPaso('guardando')
    try {
      const r = await agregarBitacora(elegidas.map(({ fecha, tipo, sede, hora, motivo, resultado, acciones }) =>
        ({ fecha, tipo, sede, hora: tipo === 'reunion' ? hora : '', motivo, resultado, acciones: tipo === 'auditoria' ? acciones : '' })), idLote.current)
      setPaso(null); setFilas([])
      onAgregadas?.(r?.agregadas ?? elegidas.length, !!r?.repetido)
    } catch (e) {
      setPaso('revisar')
      // Si no hubo respuesta puede haberse guardado: el reintento usa el mismo
      // lote, así que el servidor no lo vuelve a escribir
      const sinRespuesta = /no respondió|Sin conexión|algo inesperado/i.test(e.message)
      setError(sinRespuesta
        ? `La planilla no respondió (${e.message.split(':')[0]}). Tocá "Agregar" de nuevo: si ya se había guardado, no se duplica.`
        : `No se pudo guardar en la planilla: ${e.message}. No se guardó nada; probá de nuevo.`)
    } finally { enCurso.current = false }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: 'none' }} onChange={e => elegir(e.target.files?.[0])} />
      <button onClick={() => inputRef.current?.click()} disabled={disabled || paso === 'leyendo'} className="btn-press" style={{
        height: 40, padding: '0 16px', borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: F.body, whiteSpace: 'nowrap',
        background: '#fff', color: C.navy, border: `1px solid ${C.rule}`, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}>
        {paso === 'leyendo' ? `Leyendo el Word${avance ? ` (${avance})` : '…'}` : 'Subir Word con notas'}
      </button>
      {error && !paso && (
        <div role="alert" style={{ flexBasis: '100%', borderLeft: `4px solid ${C.crimson}`, background: '#FBE7EA', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontSize: 13.5, color: C.ink }}>
          {error}
        </div>
      )}
      {(paso === 'revisar' || paso === 'guardando') && (
        <ModalShell onClose={() => { if (paso !== 'guardando') { setPaso(null); setFilas([]) } }} cerrable={paso !== 'guardando'}
          title="Notas del Word" sub={`${archivo} · revisá cada fila antes de guardarla en la bitácora`} maxWidth={920}>
          <div style={{ overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: F.body }}>
            <div style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>
              Gemini ordenó el Word en <b style={{ color: C.ink }}>{filas.length}</b> actividades, con las palabras de tus notas. Corregí lo que haga falta y destildá lo que no va.
              Nada se guarda hasta que toques el botón de abajo.
            </div>
            {error && <div role="alert" style={{ borderLeft: `4px solid ${C.crimson}`, background: '#FBE7EA', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontSize: 13.5 }}>{error}</div>}
            {filas.map((f, i) => <Fila key={i} f={f} i={i} semana={semana} sedes={sedes} onCambio={(c, v) => cambiar(i, c, v)} />)}
          </div>
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.rule}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: F.body }}>
            <span style={{ ...rotulo, color: sinFecha ? C.crimson : C.inkSoft }}>
              {sinFecha ? `${sinFecha} sin fecha` : `${elegidas.length} de ${filas.length} para guardar`}
            </span>
            <button onClick={guardar} disabled={!elegidas.length || sinFecha > 0 || paso === 'guardando'} className="btn-press" style={{
              marginLeft: 'auto', height: 42, padding: '0 18px', borderRadius: 8, border: 'none', fontSize: 14.5, fontWeight: 800, fontFamily: F.body,
              background: C.navy, color: '#fff', cursor: 'pointer', opacity: !elegidas.length || sinFecha > 0 ? 0.45 : 1,
            }}>
              {paso === 'guardando' ? 'Guardando…' : `Agregar ${elegidas.length} a la bitácora`}
            </button>
          </div>
        </ModalShell>
      )}
    </>
  )
}
