// Pruebas de la lógica del envío de mails (src/lib/envio.js).
// Correr con:  node scripts/probar-envio.mjs
// Sin red ni planilla: destinos de cada sede, armado de una tanda, cotejo
// contra log_envios y HTML del mail.
import { destinosDe, yaRecibieron, planDeTanda, registradasEnLog, buildEmailHTML, agruparRegistro } from '../src/lib/envio.js'
import { hoyIso } from '../src/lib/formato.js'

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

// 2. Tanda: una sede repetida sale una sola vez; sin email o con objetivo 0 se saltea
{
  const plan = planDeTanda([sede(1, 'x@u.ar'), sede(2, ''), sede(1, 'x@u.ar'), sede(3, '  '), sede(4, 'y@u.ar', { objetivo: 0, pct: 0 }), sede(5, 'z@u.ar', { objetivo: 3 })])
  const tipos = plan.map(p => `${p.d.cod_sede}:${p.tipo}`).join(',')
  check('tanda: la repetida sale una sola vez', plan.filter(p => p.tipo === 'enviar' && p.d.cod_sede === '1').length === 1, tipos)
  check('tanda: la repetida queda marcada como tal', plan[2].tipo === 'repetida', tipos)
  check('tanda: sin email se saltea', plan[1].tipo === 'sin_email' && plan[3].tipo === 'sin_email', tipos)
  check('tanda: con objetivo 0 se saltea', plan[4].tipo === 'sin_objetivo' && plan[5].tipo === 'enviar', tipos)
  check('tanda: una entrada por sede de la lista, en orden', plan.length === 6 && plan.map(p => p.d.cod_sede).join() === '1,2,1,3,4,5', tipos)
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
  // Filas nuevas con fecha_corte: cuentan solo si son de este corte; las viejas
  // (sin fecha_corte) siguen la regla de siempre
  const conCorte = [
    fila({ cod_sede: 70, fecha_corte: '2026-10-23' }),  // de este corte: cuenta
    fila({ cod_sede: 71, fecha_corte: '2026-10-16' }),  // mandada el 24 pero del corte anterior: no cuenta
    fila({ cod_sede: 72 }),                             // vieja, sin fecha_corte: cuenta
  ]
  const reg2 = registradasEnLog(conCorte, { desde: '2026-10-23', campNom: '2do Ingreso 2026', fechaCorte: '2026-10-23' })
  check('cotejo: fila con fecha_corte de este corte cuenta', reg2.has('70|a@ucasal.edu.ar'))
  check('cotejo: fila con fecha_corte de otro corte no cuenta', !reg2.has('71|a@ucasal.edu.ar'))
  check('cotejo: fila vieja sin fecha_corte sigue la regla de antes', reg2.has('72|a@ucasal.edu.ar'))
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

// 5. Agrupado del "Registro de envíos": una tanda de 3 minutos es un solo
//    bloque; dos tandas separadas por 10 minutos son dos. El [RESUMEN] va aparte.
{
  const f = (hora, extra = {}) => ({ fecha: '2026-10-24', hora, campana: '2do Ingreso 2026', sede: 'SEDE', cod_sede: 1, email: 'x@u.ar', estado: 'enviado', ...extra })
  const log = [ // como lo devuelve log_envios: lo más nuevo primero
    f('10:14:30', { sede: '[RESUMEN]', cod_sede: '', estado: 'error' }),
    f('10:13:10'), f('10:13:00'),
    f('10:03:20', { sede: '[RESUMEN]', cod_sede: '' }),
    f('10:03:00', { estado: 'error' }), f('10:02:00'), f('10:01:00'), f('10:00:00', { confirmado: 'TRUE' }),
  ]
  const g = agruparRegistro(log)
  check('registro: una tanda de 3 minutos es un solo bloque', g.length === 2 && g[1].items.length === 4, JSON.stringify(g.map(b => [b.hora, b.items.length])))
  check('registro: dos tandas separadas por 10 minutos son dos bloques', g[0].hora === '10:13:00' && g[1].hora === '10:00:00', JSON.stringify(g.map(b => b.hora)))
  check('registro: el [RESUMEN] no cuenta como enviado ni como error', g[1].items.filter(i => i.estado === 'enviado').length === 3 && g[1].items.filter(i => i.estado !== 'enviado').length === 1)
  check('registro: el resumen a Cele va aparte (✓ y ✗)', g[1].resumenes.length === 1 && g[1].resumenes[0].estado === 'enviado' && g[0].resumenes[0].estado === 'error')
  check('registro: confirmar cubre cada minuto del bloque', JSON.stringify(g[1].minutos.map(m => m.hora)) === '["10:00","10:01","10:02","10:03"]', JSON.stringify(g[1].minutos))
  check('registro: confirmado solo si están todas confirmadas', g[1].confirmado === false)
  const cruzaMedianoche = agruparRegistro([f('23:59:30', { fecha: '2026-10-23' }), f('00:00:40', { fecha: '2026-10-24' })])
  check('registro: una tanda que cruza la medianoche es un bloque', cruzaMedianoche.length === 1 && cruzaMedianoche[0].minutos.length === 2)
}

// 6. "Hoy" es el día de Buenos Aires (UTC-3, sin horario de verano), sea
//    cual sea el huso de la máquina (correr también con TZ=UTC o TZ=Asia/Tokyo)
{
  const antes = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
  const hoy = hoyIso()
  const despues = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
  check('hoyIso: fecha de Buenos Aires', hoy === antes || hoy === despues, `${hoy} vs ${antes}`)
  check('hoyIso: formato yyyy-mm-dd', /^\d{4}-\d{2}-\d{2}$/.test(hoy), hoy)
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
