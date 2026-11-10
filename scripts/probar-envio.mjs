// Pruebas de la lógica del envío de mails (src/lib/envio.js).
// Correr con:  node scripts/probar-envio.mjs
// Sin red ni planilla: destinos de cada sede, armado de una tanda, cotejo
// contra log_envios y HTML del mail.
import { destinosDe, yaRecibieron, planDeTanda, registradasEnLog, buildEmailHTML } from '../src/lib/envio.js'

let fallas = 0
const check = (nombre, cond, detalle = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nombre}${!cond && detalle ? '  →  ' + detalle : ''}`)
  if (!cond) fallas++
}
const sede = (cod, email, extra = {}) => ({
  cod_sede: String(cod), sede: `SEDE ${cod}`, email, saludo: 'Estimados',
  objetivo: 20, total: 5, pct: 25, var: 1, fecha: '2026-10-23', ...extra,
})

// 1. Sede con dos direcciones: sale solo a la que falta; si ya salieron las dos, es un reenvío
{
  const d = sede(55, 'a@ucasal.edu.ar, B@ucasal.edu.ar')
  const unaEnviada = { 55: ['a@ucasal.edu.ar'] }
  check('destinos: solo la dirección que falta', JSON.stringify(destinosDe(d, unaEnviada)) === '["B@ucasal.edu.ar"]', JSON.stringify(destinosDe(d, unaEnviada)))
  check('ya recibieron: la que salió', JSON.stringify(yaRecibieron(d, unaEnviada)) === '["a@ucasal.edu.ar"]')
  const lasDos = { 55: ['a@ucasal.edu.ar', 'b@ucasal.edu.ar'] }
  check('destinos: si ya salieron las dos, son las dos (reenvío)', destinosDe(d, lasDos).length === 2, JSON.stringify(destinosDe(d, lasDos)))
  check('destinos: sin envíos previos, todas', destinosDe(d, {}).length === 2)
}

// 2. Tanda: una sede repetida sale una sola vez; sin email se saltea
{
  const plan = planDeTanda([sede(1, 'x@u.ar'), sede(2, ''), sede(1, 'x@u.ar'), sede(3, '  ')])
  const tipos = plan.map(p => `${p.d.cod_sede}:${p.tipo}`).join(',')
  check('tanda: la repetida sale una sola vez', plan.filter(p => p.tipo === 'enviar' && p.d.cod_sede === '1').length === 1, tipos)
  check('tanda: la repetida queda marcada como tal', plan[2].tipo === 'repetida', tipos)
  check('tanda: sin email se saltea', plan[1].tipo === 'sin_email' && plan[3].tipo === 'sin_email', tipos)
  check('tanda: una entrada por sede de la lista, en orden', plan.length === 4 && plan.map(p => p.d.cod_sede).join() === '1,2,1,3', tipos)
}

// 3. Cotejo contra log_envios
{
  const fila = (extra) => ({ fecha: '2026-10-24', hora: '10:00:00', campana: '2do Ingreso 2026', sede: 'SEDE 55', cod_sede: 55, email: 'a@ucasal.edu.ar', estado: 'enviado', ...extra })
  const log = [
    fila({}),                                                        // cuenta
    fila({ cod_sede: 60, email: 'Otra@ucasal.edu.ar' }),             // cuenta (en minúscula)
    fila({ cod_sede: 61, campana: '1er Ingreso 2027' }),             // otra campaña
    fila({ cod_sede: 62, fecha: '2026-10-20' }),                     // anterior a la fecha
    fila({ cod_sede: 63, estado: 'error' }),                         // error
    fila({ cod_sede: '', sede: '[RESUMEN]', email: 'mcrossi@ucasal.edu.ar' }), // resumen a Cele
  ]
  const reg = registradasEnLog(log, { desde: '2026-10-23', campNom: '2do Ingreso 2026' })
  check('cotejo: la fila enviada de la sede y dirección cuenta', reg.has('55|a@ucasal.edu.ar'))
  check('cotejo: compara la dirección en minúscula', reg.has('60|otra@ucasal.edu.ar'))
  check('cotejo: no cuenta otra campaña', !reg.has('61|a@ucasal.edu.ar'))
  check('cotejo: no cuenta lo anterior a la fecha', !reg.has('62|a@ucasal.edu.ar'))
  check('cotejo: no cuenta las de estado error', !reg.has('63|a@ucasal.edu.ar'))
  check('cotejo: no cuenta el [RESUMEN]', ![...reg].some(k => k.includes('mcrossi')), JSON.stringify([...reg]))
  check('cotejo: nada más que esas dos', reg.size === 2, JSON.stringify([...reg]))
}

// 4. HTML del mail: escapa sede y saludo, y un marcador desconocido queda vacío
{
  const d = sede(70, 'x@u.ar', { sede: 'A<B & C', saludo: 'Hola <b>Juan</b> & equipo' })
  const html = buildEmailHTML(d, '2do Ingreso 2026', '<p>{{saludo}}:</p>{{desconocido}}{{tabla}}<p>Fin</p>')
  check('HTML: la sede sale escapada', html.includes('A&lt;B &amp; C') && !html.includes('A<B'), html)
  check('HTML: el saludo sale escapado', html.includes('Hola &lt;b&gt;Juan&lt;/b&gt; &amp; equipo') && !html.includes('<b>Juan'))
  check('HTML: el marcador desconocido queda vacío', !html.includes('{{') && html.includes(':</p><table'), html.slice(0, 120))
  check('HTML: la tabla queda entera', (html.match(/<table/g) || []).length === 1 && (html.match(/<\/table>/g) || []).length === 1 && html.includes('</table><p>Fin</p>'))
  check('HTML: lleva la firma al pie', html.trim().endsWith('</p>') && html.includes('firma-cele-v2.jpg'))
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
