import { useState, useRef } from 'react'

// Parser de Excel usando SheetJS (cargado via CDN en index.html)
// El formato real: Cod Sede | Sede | Objetivo | % Objetivo | [año pasado misma fecha] | [fecha de hoy, ESTA es la columna de totales]
function parseExcelData(arrayBuffer) {
  const XLSX = window.XLSX
  if (!XLSX) throw new Error('SheetJS no disponible')

  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  if (!rows.length) throw new Error('El archivo está vacío')

  const headerRaw = rows[0]
  const header = headerRaw.map(h => String(h || '').toLowerCase().trim())

  const iCod  = header.findIndex(h => h.includes('cod'))
  const iSede = header.findIndex(h => h.includes('sede') || h.includes('nombre'))

  // Patrón de fecha tipo dd/mm/aa, dd-mm-aaaa, etc — la columna del corte actual
  const fechaPattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/
  let iTotal = header.findIndex(h => h.includes('total') || h.includes('ingresado') || h.includes('acumulado'))
  let detectadoPorFecha = false

  if (iTotal === -1) {
    // Buscamos de derecha a izquierda la última columna cuyo header sea una fecha
    for (let i = header.length - 1; i >= 0; i--) {
      if (fechaPattern.test(header[i].trim())) { iTotal = i; detectadoPorFecha = true; break }
    }
  }
  if (iTotal === -1) {
    // Último recurso: última columna no vacía del header
    for (let i = header.length - 1; i >= 0; i--) {
      if (header[i]) { iTotal = i; break }
    }
  }

  if (iCod === -1 || iTotal === -1) {
    throw new Error('No se encontraron las columnas esperadas (Cod Sede / columna de totales). Verificá el formato del Excel.')
  }

  const sedes = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === undefined || c === '')) continue
    const cod = String(row[iCod] ?? '').trim()
    if (!cod) continue
    const total = Number(row[iTotal])
    if (isNaN(total)) continue
    sedes.push({
      cod,
      sede:  iSede >= 0 ? String(row[iSede] || '').trim() : `Sede ${cod}`,
      total,
    })
  }

  if (!sedes.length) throw new Error('No se encontraron datos válidos en el archivo')

  return {
    sedes,
    meta: {
      columnaTotal: headerRaw[iTotal],
      detectadoPorFecha,
      totalFilas: sedes.length,
    },
  }
}

export default function ExcelUploader({ data, onUpload, campanas, campanaActiva }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [minimized, setMinimized] = useState(false)
  const [preview, setPreview] = useState(null) // { sedes, meta, fileName }
  const [confirmando, setConfirmando] = useState(false)
  const inputRef = useRef(null)

  const camp = campanas?.find(c => c.id === campanaActiva)
  const tieneData = data.length > 0
  const fechaActual = data[0]?.fecha || null

  // Auto-minimizar si ya hay datos
  const isMinimized = minimized || (tieneData && minimized !== false)

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('El archivo debe ser .xlsx o .xls')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const { sedes, meta } = parseExcelData(buffer)
      setPreview({ sedes, meta, fileName: file.name })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const confirmarCarga = async () => {
    if (!preview) return
    setConfirmando(true)
    try {
      await onUpload(preview.sedes, preview.fileName)
      setPreview(null)
      setMinimized(true)
    } catch (e) {
      setError(e.message)
      setPreview(null)
    }
    setConfirmando(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  // Modal de previsualización antes de confirmar guardado
  if (preview) {
    const top5 = preview.sedes.slice(0, 5)
    return (
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #1B2A6B',
        borderRadius: 14, overflow: 'hidden', marginBottom: 4,
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>👀 Confirmá antes de guardar</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            Archivo: {preview.fileName}
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{
            display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{ background: '#eef0f8', border: '1px solid #b8c0e0', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#1B2A6B' }}>
              {preview.meta.totalFilas} sedes detectadas
            </div>
            <div style={{
              background: preview.meta.detectadoPorFecha ? '#ecfdf5' : '#fffbeb',
              border: `1px solid ${preview.meta.detectadoPorFecha ? '#6ee7b7' : '#fde68a'}`,
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              color: preview.meta.detectadoPorFecha ? '#059669' : '#92400e',
            }}>
              Columna de totales: "{preview.meta.columnaTotal}"
              {!preview.meta.detectadoPorFecha && ' ⚠ verificá que sea correcta'}
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Primeras filas detectadas
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Cod</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Sede</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {top5.map(s => (
                  <tr key={s.cod} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 14px', color: '#64748b' }}>{s.cod}</td>
                    <td style={{ padding: '7px 14px', fontWeight: 600 }}>{s.sede}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.sedes.length > 5 && (
              <div style={{ padding: '8px 14px', fontSize: 11, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                + {preview.sedes.length - 5} sedes más
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={confirmarCarga} disabled={confirmando} style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: '#1B2A6B', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: confirmando ? 0.6 : 1,
            }}>
              {confirmando ? 'Guardando…' : '✅ Confirmar y guardar en Sheets'}
            </button>
            <button onClick={() => setPreview(null)} disabled={confirmando} style={{
              padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Versión minimizada — solo un chip con info
  if (isMinimized) {
    return (
      <div style={{
        background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 14 }}>✅</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>
            Datos cargados · {fechaActual || 'semana actual'}
          </span>
          <span style={{ fontSize: 12, color: '#6ee7b7', marginLeft: 8 }}>
            {data.length} sedes
          </span>
        </div>
        <button
          onClick={() => setMinimized(false)}
          style={{ fontSize: 12, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Cambiar archivo
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderTop: '3px solid #1B2A6B',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            📊 Cargar Excel semanal
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            {camp ? `Campaña: ${camp.nombre}` : 'Seleccioná la campaña primero'} · Los datos se guardan automáticamente en Sheets
          </div>
        </div>
        {tieneData && (
          <button onClick={() => setMinimized(true)}
            style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
            Minimizar
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          margin: 16,
          border: `2px dashed ${dragging ? '#1B2A6B' : loading ? '#6ee7b7' : '#cbd5e1'}`,
          borderRadius: 12,
          padding: '32px 20px',
          textAlign: 'center',
          cursor: loading ? 'wait' : 'pointer',
          background: dragging ? '#eef0f8' : loading ? '#f0fdf4' : '#f8fafc',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        <div style={{ fontSize: 32, marginBottom: 12 }}>
          {loading ? '⏳' : dragging ? '📂' : '📊'}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
          {loading ? 'Procesando y guardando en Sheets…' :
           dragging ? 'Soltá el archivo acá' :
           'Arrastrá el Excel acá o hacé click para seleccionar'}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Formatos aceptados: .xlsx · .xls
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 16px 16px',
          background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#be123c',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span>❌</span>
          <div>
            <strong>Error al procesar el archivo</strong><br />
            {error}
          </div>
        </div>
      )}
    </div>
  )
}
