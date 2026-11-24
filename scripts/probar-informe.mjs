// Pruebas del informe semanal con los números del informe real del 10 al
// 14 de agosto de 2026 (el modelo que pasó la jefa): la tabla tiene que dar
// exactamente lo mismo que ese Word.
import { readFileSync } from 'node:fs'
import {
  semanaDe, etiquetaSemana, corteDeLaSemana, tablaComoVamos, aVinetas, tituloAnotacion,
  armarInforme, redaccionBase, encabezadoObservacion, fechaColumna, avisosNotas, huellaNotas, nombrePropio,
  porcentaje, controlarRedaccion, huellaItem,
} from '../src/lib/informe.js'

let fallas = 0
const ok = (cond, msg) => { if (cond) console.log('✓', msg); else { fallas++; console.log('✗', msg) } }
const igual = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` → ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`)

// Semanas
igual(semanaDe('2026-08-14'), { lunes: '2026-08-10', viernes: '2026-08-14', domingo: '2026-08-16' }, 'semana: viernes')
igual(semanaDe('2026-08-10').lunes, '2026-08-10', 'semana: lunes')
igual(semanaDe('2026-08-16').lunes, '2026-08-10', 'semana: domingo es de la misma semana')
igual(semanaDe('2026-08-17').lunes, '2026-08-17', 'semana: el lunes siguiente arranca otra')
igual(etiquetaSemana(semanaDe('2026-08-12')), '10 al 14 de agosto de 2026', 'etiqueta como el modelo')
igual(etiquetaSemana(semanaDe('2026-09-02')), '31 de agosto al 4 de septiembre de 2026', 'etiqueta entre meses')
igual(etiquetaSemana(semanaDe('2026-12-31')), '28 de diciembre de 2026 al 1 de enero de 2027', 'etiqueta entre años')
igual(fechaColumna('2026-08-14'), '14/8/26', 'columna del corte como el modelo')

// Corte de la semana: el último ≤ viernes
const modelo = JSON.parse(readFileSync(new URL('./fixture-informe-agosto.json', import.meta.url)))
const data = modelo.map(m => ({ cod_sede: m.cod_sede, sede: m.sede, objetivo: m.objetivo }))
const historial = [
  ...modelo.map(m => ({ fecha: '2026-08-07', cod_sede: m.cod_sede, total: Math.max(0, m.total - 2) })),
  ...modelo.map(m => ({ fecha: '2026-08-14', cod_sede: '0' + m.cod_sede, total: m.total })), // "060" de Sheets = 60
  ...modelo.map(m => ({ fecha: '2026-08-21', cod_sede: m.cod_sede, total: m.total + 5 })),
]
igual(corteDeLaSemana(historial, semanaDe('2026-08-12')), { fecha: '2026-08-14', deEstaSemana: true }, 'corte: el del viernes')
igual(corteDeLaSemana(historial, semanaDe('2026-08-05')), { fecha: '2026-08-07', deEstaSemana: true }, 'corte: semana anterior')
igual(corteDeLaSemana(historial, semanaDe('2026-08-27')), { fecha: '2026-08-21', deEstaSemana: false }, 'corte: semana sin corte usa el anterior y avisa')
igual(corteDeLaSemana(historial, semanaDe('2026-07-01')), { fecha: null, deEstaSemana: false }, 'corte: antes del primero no hay')

// Tabla: idéntica al Word de la jefa
const tabla = tablaComoVamos(data, historial, '2026-08-14')
igual(tabla.totales, { objetivo: 270, total: 231, pct: 86 }, 'tabla: totales 270 · 231 · 86% como el modelo')
igual(tabla.filas.length, 37, 'tabla: 37 sedes')
igual(tabla.faltan, [], 'tabla: no falta ninguna sede en el corte')
const pctModelo = { 22: 38, 33: 70, 41: 233, 89: 27, 112: 0, 180: 243, 213: 167 }
ok(Object.entries(pctModelo).every(([c, p]) => tabla.filas.find(f => f.cod === c).pct === p), 'tabla: % por sede como el modelo')
igual(tabla.filas.map(f => f.cod).slice(0, 4), ['22', '33', '41', '42'], 'tabla: ordenada por código')
const sinUna = tablaComoVamos([...data, { cod_sede: '999', sede: 'NUEVA', objetivo: 2 }], historial, '2026-08-14')
igual(sinUna.faltan, ['NUEVA'], 'tabla: avisa la sede que no está en el corte')
igual(tablaComoVamos([{ cod_sede: '1', sede: 'X', objetivo: 0 }], [{ fecha: 'a', cod_sede: '1', total: 3 }], 'a').filas[0].pct, null, 'tabla: sin objetivo no inventa %')

// Notas → viñetas
igual(aVinetas('Acciones comerciales\nParticipación en ferias'), ['Acciones comerciales', 'Participación en ferias'], 'viñetas por renglón')
igual(aVinetas('ferias; colegios ;  folletos'), ['ferias', 'colegios', 'folletos'], 'viñetas por punto y coma')
igual(aVinetas('- uno\n• dos\n1) tres\n\n'), ['uno', 'dos', 'tres'], 'viñetas: saca guiones y renglones vacíos')
igual(aVinetas(''), [], 'viñetas: vacío')

// Títulos
igual(tituloAnotacion('GONZALEZ CATÁN - BS AS', data), 'Gonzalez Catán', 'título: sede de la lista')
igual(tituloAnotacion('moron - buenos aires', data), 'Morón', 'título: sede escrita a mano')
igual(tituloAnotacion('57', data), 'Morón', 'título: por código')
igual(tituloAnotacion('Salesforce', data), 'Salesforce', 'título: tema libre queda igual')
igual(nombrePropio('DELEGACIÓN SAN MIGUEL - BUENOS AIRES Modo 7'), 'San Miguel', 'nombre: delegación')
igual(nombrePropio('MAR DEL PLATA - CEM - BUENOS AIRES'), 'Mar del Plata - CEM', 'nombre: CEM')

// Informe armado con las notas del modelo
const items = [
  { id: 'f2', fila: 2, fecha: '2026-08-12', tipo: 'reunion', sede: 'MORÓN - BUENOS AIRES', hora: '8:30', motivo: 'Acciones comerciales\nFerias y expos', resultado: 'banner listo; horario se mantiene' },
  { id: 'f3', fila: 3, fecha: '2026-08-10', tipo: 'observacion', sede: 'GONZALEZ CATÁN - BS AS', hora: '', motivo: '', resultado: 'confección del banner. Ya en imprenta.' },
  { id: 'f4', fila: 4, fecha: '2026-08-14', tipo: 'observacion', sede: '', hora: '', motivo: 'envío de actualización de avances', resultado: '' },
  { id: 'f5', fila: 5, fecha: '2026-08-11', tipo: 'semana', sede: '', hora: '', motivo: '', resultado: 'seguimiento con las sedes por el Encuentro de Sedes' },
  { id: 'f6', fila: 6, fecha: '2026-08-13', tipo: 'auditoria', sede: 'PILAR - BUENOS AIRES', hora: '', motivo: '', resultado: 'Bien', acciones: 'Más redes' },
  { id: 'f7', fila: 7, fecha: '2026-08-13', tipo: 'desconocido', tipoOriginal: 'Llamada', sede: 'Salesforce', hora: '', motivo: '', resultado: 'reunión de uso' },
]
const inf = armarInforme({ semana: semanaDe('2026-08-14'), campanaNombre: '2do Ingreso 2026', tabla, fechaCorte: '2026-08-14', items, redaccion: {}, sedes: data })
igual(inf.periodo, '10 al 14 de agosto de 2026', 'informe: período')
igual(inf.columnaObjetivo, 'Objetivo 2do Ingreso 2026', 'informe: columna objetivo como el modelo')
igual(inf.reuniones[0].sede, 'Morón 12/08 8:30 HS', 'informe: reunión con sede, fecha y hora')
igual(inf.reuniones[0].resultado, ['banner listo', 'horario se mantiene'], 'informe: resultado en viñetas')
igual(inf.auditorias[0], { id: 'f6', sede: 'Pilar', resultado: ['Bien'], acciones: ['Más redes'] }, 'informe: auditoría')
igual(inf.observaciones.map(encabezadoObservacion), ['10/08 – Gonzalez Catán:', '13/08 – Salesforce:', '14/08:', 'Durante la semana:'], 'informe: observaciones por fecha, tipo raro incluido y "toda la semana" al final')
igual(redaccionBase(items[2]).texto, 'envío de actualización de avances', 'redacción base de una observación')
const conIA = armarInforme({ semana: semanaDe('2026-08-14'), tabla, fechaCorte: '2026-08-14', items, redaccion: { f2: { motivo: ['Acciones comerciales.'], resultado: ['Se generó el banner.'] } }, sedes: data })
igual(conIA.reuniones[0].resultado, ['Se generó el banner.'], 'informe: usa la redacción de Claude cuando la hay')
ok(avisosNotas(items, [{ fila: 9, sede: 'Lanús' }]).length === 2, 'avisos: tipo raro y fila sin fecha')
ok(huellaNotas(items) !== huellaNotas([{ ...items[0], resultado: 'otro' }, ...items.slice(1)]), 'huella: cambia si cambian las notas')

// Revisión: lo que no se puede perder ni equivocar
igual([23, 41, 51, 87, 97].map(t => porcentaje(t, 40)), [58, 103, 128, 218, 243], '%: redondeo exacto (23/40 = 58%, no 57%)')
const histExtra = [{ fecha: 'x', cod_sede: '1', total: 1 }, { fecha: 'x', cod_sede: '2', sede: 'DESACTIVADA', total: 5 }]
const tx = tablaComoVamos([{ cod_sede: '1', sede: 'A', objetivo: 2 }], histExtra, 'x')
igual(tx.fueraDeLista, [{ cod: '2', sede: 'DESACTIVADA', total: 5 }], 'tabla: avisa la sede del corte que ya no está activa')
igual(redaccionBase({ tipo: 'reunion', motivo: 'a', resultado: 'b', acciones: 'c' }).resultado, ['b', 'c'], 'reunión: las acciones no se pierden')
igual(redaccionBase({ tipo: 'auditoria', motivo: 'm', resultado: 'r', acciones: 'x' }).resultado, ['m', 'r'], 'auditoría: el motivo no se pierde')
igual(encabezadoObservacion(armarInforme({ semana: semanaDe('2026-08-14'), tabla, fechaCorte: '2026-08-14', items: [{ id: 'z', fecha: '2026-08-11', tipo: 'observacion', sede: '', hora: '10:00', resultado: 'x' }], sedes: data }).observaciones[0]), '11/08 10:00 HS:', 'observación: la hora no se pierde')
igual(controlarRedaccion({ tipo: 'reunion', motivo: 'ferias', resultado: 'de 10 a 17 h' }, { motivo: ['Ferias.'], resultado: ['Entre las 10 y las 17 h.'] }), null, 'IA: mismas cifras, ok')
ok(/cifras/.test(controlarRedaccion({ tipo: 'observacion', resultado: '2 folletos' }, { texto: 'tres folletos' })), 'IA: cifra cambiada se marca')
ok(/cifras/.test(controlarRedaccion({ tipo: 'observacion', resultado: 'banner' }, { texto: 'banner para 40 alumnos' })), 'IA: cifra inventada se marca')
ok(/vac/.test(controlarRedaccion({ tipo: 'reunion', motivo: 'a', resultado: 'b' }, { motivo: ['A.'], resultado: [] })), 'IA: resultado vacío se marca')
ok(huellaItem(items[0]) === huellaItem({ ...items[0], id: 'otro', fila: 99 }), 'huella por ítem: no depende de la fila')

if (fallas) { console.log(`\n${fallas} prueba(s) fallaron`); process.exit(1) }
console.log('\nTodo OK')
