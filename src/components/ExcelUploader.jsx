import { useState, useRef } from 'react'

// Parser de Excel usando SheetJS (cargado via CDN en index.html)
function parseExcelData(arrayBuffer) {
  const XLSX = window.XLSX
  if (!XLSX) throw new Error('SheetJS no disponible')
  
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  
  // Detectar columnas — buscar cod_sede/sede/total
  if (!rows.length) throw new Error('El archivo está vacío')
  
  const header = rows[0].map(h => String(h || '').toLowerCase().trim())
  
  // Índices flexibles
  const iCod  = header.findIndex(h => h.includes('cod') || h.includes('código') || h === 'id')
  const iSede = header.findIndex(h => h.includes('sede') || h.includes('nombre'))
  const iTotal = header.findIndex(h => h.includes('total') || h.includes('ingresado') || h.includes('acumulado') || h.includes('cantidad'))
  
  if (iTotal === -1) throw new Error('No se encontró columna de totales. Verificá que el Excel tenga una columna "Total" o "Ingresados".')
  
  const sedes = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue
    const total = Number(row[iTotal])
    if (isNaN(total)) continue
    sedes.push({
      cod:   iCod  >= 0 ? String(row[iCod]  || '').trim() : String(i),
      sede:  iSede >= 0 ? String(row[iSede] || '').trim() : `Sede ${i}`,
      total,
    })
  }
  
  if (!sedes.length) throw new Error('No se encontraron datos válidos en el archivo')
  return sedes
}

export default function ExcelUploader({ data, onUpload, campanas, campanaActiva }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [minimized, setMinimized] = useState(false)
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
      const sedes = parseExcelData(buffer)
      await onUpload(sedes, file.name)
      setMinimized(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
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
