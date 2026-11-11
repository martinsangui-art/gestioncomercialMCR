// SheetJS (el lector/escritor de Excel) pesa unos 900 KB. Antes se cargaba en
// el <head> de index.html y frenaba la primera pantalla en cada visita —sobre
// todo en el celu— aunque solo se usa al subir un Excel o bajar un respaldo.
// Ahora se pide recién cuando hace falta, una sola vez por sesión.
const URL_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
// Integridad (SRI): si el archivo del CDN no es exactamente el de la 0.18.5,
// el navegador no lo ejecuta. Para recalcularlo:
//   curl -s <URL_XLSX> | openssl dgst -sha384 -binary | openssl base64 -A
const SRI_XLSX = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'

let pedido = null

export function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (!pedido) {
    pedido = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = URL_XLSX
      s.async = true
      s.crossOrigin = 'anonymous'
      s.integrity = SRI_XLSX
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('No se pudo cargar el lector de Excel')))
      s.onerror = () => {
        pedido = null // que el próximo intento vuelva a probar
        s.remove()
        reject(new Error('No se pudo cargar el lector de Excel: revisá la conexión y probá de nuevo'))
      }
      document.head.appendChild(s)
    })
  }
  return pedido
}
