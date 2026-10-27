// El logo y la firma que van en los informes PDF pesan ~95 KB en base64. Antes
// viajaban dentro del bundle principal y frenaban la primera pantalla aunque
// casi nunca se imprima un informe. Ahora se piden aparte, apenas la app
// termina de cargar (y de nuevo, por las dudas, al abrir el menú de informes).
// La generación del PDF sigue siendo sincrónica — a propósito: si hubiera un
// await entre el click y la apertura de la pestaña, Safari la bloquea como popup.
export const ASSETS_PDF = { logo: '', firma: '' }

let pedido = null
export function precargarAssetsPDF() {
  if (!pedido) {
    pedido = Promise.all([import('../assets/logo'), import('../assets/firma')])
      .then(([l, f]) => { ASSETS_PDF.logo = l.LOGO_B64; ASSETS_PDF.firma = f.FIRMA_B64 })
      .catch(() => { pedido = null })
  }
  return pedido
}
