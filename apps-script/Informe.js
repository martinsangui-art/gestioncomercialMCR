// ═══════════════════════════════════════════════════════════════════════
// INFORME SEMANAL — bitácora de Cele + redacción con Gemini
// ═══════════════════════════════════════════════════════════════════════
// Cele anota durante la semana en la pestaña 'bitacora' de esta planilla
// (una fila por actividad). La app lee las filas de la semana, arma la
// tabla "Cómo vamos" con los cortes y le pide a Gemini solo que pula la
// redacción. Los números nunca pasan por la IA.

var BITACORA_HOJA = 'bitacora';
var BITACORA_COLUMNAS = ['fecha', 'tipo', 'sede', 'hora', 'motivo', 'resultado', 'acciones_mejora'];
var BITACORA_TIPOS = ['Reunión', 'Auditoría', 'Observación', 'Toda la semana'];
var BITACORA_AYUDA = {
  fecha: 'Día de la actividad. Para "Toda la semana", cualquier día de esa semana.',
  tipo: 'Reunión · Auditoría · Observación · Toda la semana. Define en qué parte del informe aparece.',
  sede: 'Sede (elegila de la lista) o el tema si no es de una sede: "Salesforce", "Reunión con Fernando Gamarra"…',
  hora: 'Solo para reuniones (ej. 8:30). Opcional.',
  motivo: 'Reuniones: los temas que se trataron. Uno por renglón (Alt+Enter) o separados por ";". Pueden ser notas sueltas: la IA las redacta.',
  resultado: 'Reuniones: qué se acordó o se hizo. Auditorías: el resultado. Observaciones: qué pasó. Notas sueltas está bien.',
  acciones_mejora: 'Solo auditorías: las acciones de mejora.'
};

// Redacción con Gemini (Google). La clave va en Propiedades del script como
// GEMINI_API_KEY. Se prueban los modelos en orden: si Google contesta que uno
// está saturado (pasa seguido con el más nuevo) o ya no existe, se usa el
// siguiente. Con la propiedad GEMINI_MODEL se puede poner otro primero.
var INFORME_MODELOS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];
function modelosGemini() {
  var preferido = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL');
  var lista = INFORME_MODELOS.slice();
  if (preferido) lista = [preferido].concat(lista.filter(function(m) { return m !== preferido; }));
  return lista;
}

function getBitacoraSheet() {
  var h = SS.getSheetByName(BITACORA_HOJA);
  if (h) return h;
  // Dos pedidos a la vez la primera vez: el segundo espera y la encuentra hecha
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    h = SS.getSheetByName(BITACORA_HOJA);
    if (h) return h;
    return crearBitacoraSheet();
  } finally { lock.releaseLock(); }
}

function crearBitacoraSheet() {
  var h = SS.insertSheet(BITACORA_HOJA);
  var n = BITACORA_COLUMNAS.length;
  var enc = h.getRange(1, 1, 1, n);
  enc.setValues([BITACORA_COLUMNAS]);
  enc.setBackground('#1B2A6B').setFontColor('#ffffff').setFontWeight('bold');
  BITACORA_COLUMNAS.forEach(function(c, i) { h.getRange(1, i + 1).setNote(BITACORA_AYUDA[c]); });
  h.setFrozenRows(1);
  h.setColumnWidth(1, 95); h.setColumnWidth(2, 120); h.setColumnWidth(3, 230); h.setColumnWidth(4, 60);
  h.setColumnWidth(5, 340); h.setColumnWidth(6, 380); h.setColumnWidth(7, 280);
  var filas = 1000;
  h.getRange(2, 1, filas, 1).setNumberFormat('dd/mm/yyyy')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Fecha de la actividad').build());
  h.getRange(2, 2, filas, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(BITACORA_TIPOS, true).setAllowInvalid(false).build());
  // La lista de sedes es una sugerencia: también se puede escribir un tema
  var nombres = getSedes().map(function(s) { return String(s.sede); }).filter(String);
  if (nombres.length) {
    h.getRange(2, 3, filas, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(nombres, true).setAllowInvalid(true).build());
  }
  h.getRange(2, 4, filas, 1).setNumberFormat('HH:mm');
  h.getRange(2, 5, filas, 3).setWrap(true).setVerticalAlignment('top');
  SpreadsheetApp.flush();
  return h;
}

function normTexto(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function normTipo(v) {
  var t = normTexto(v);
  if (!t) return '';
  if (t.indexOf('reun') === 0) return 'reunion';
  if (t.indexOf('audit') === 0) return 'auditoria';
  if (t.indexOf('toda') === 0 || t.indexOf('semana') !== -1) return 'semana';
  if (t.indexOf('obs') === 0) return 'observacion';
  return 'desconocido';
}

// Fechas con la zona horaria de la planilla (no la del script): si difieren,
// formatear con la del script corre el día.
function fechaIso(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SS.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // dd/mm/aaaa (formato argentino)
  if (m) {
    var a = m[3].length === 2 ? '20' + m[3] : m[3];
    return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return '';
}

// La hora se toma como se ve en la celda: Sheets la guarda como fecha de
// 1899 y al formatearla aparecen minutos corridos por la zona histórica.
function horaTexto(visible) {
  var s = String(visible || '').trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) + ':' + m[2] : s;
}

// Filas de la bitácora entre desde y hasta (inclusive). Las filas que no
// se pueden ubicar en una fecha vuelven aparte, para que la app avise y no
// se pierdan en silencio.
function getBitacora(desde, hasta) {
  if (!desde || !hasta) throw new Error('Falta el rango de fechas');
  var h = getBitacoraSheet();
  var rango = h.getDataRange();
  var rows = rango.getValues();
  var visibles = rango.getDisplayValues();
  if (rows.length <= 1) return { items: [], sinFecha: [], hoja: true };
  var keys = rows[0].map(function(k) { return normTexto(k).replace(/\s+/g, '_'); });
  // Una columna renombrada o borrada haría perder ese dato en todas las filas
  var faltan = BITACORA_COLUMNAS.filter(function(c) { return keys.indexOf(c) === -1; });
  if (faltan.length) throw new Error('En la pestaña bitacora faltan las columnas: ' + faltan.join(', ') + ' (la fila 1 tiene que decir: ' + BITACORA_COLUMNAS.join(', ') + ')');
  var col = function(r, nombre) { return r[keys.indexOf(nombre)]; };
  var anio = Number(Utilities.formatDate(new Date(), SS.getSpreadsheetTimeZone(), 'yyyy'));
  var items = [], sinFecha = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var texto = [col(r, 'tipo'), col(r, 'sede'), col(r, 'motivo'), col(r, 'resultado'), col(r, 'acciones_mejora')]
      .map(function(v) { return String(v || '').trim(); });
    if (!texto.join('')) continue; // fila vacía
    var item = {
      id: 'f' + (i + 1), // número de fila en la hoja
      fila: i + 1,
      fecha: fechaIso(col(r, 'fecha')),
      tipo: normTipo(col(r, 'tipo')),
      tipoOriginal: texto[0],
      sede: texto[1],
      hora: horaTexto(col(visibles[i], 'hora')),
      motivo: texto[2],
      resultado: texto[3],
      acciones: texto[4]
    };
    if (!item.fecha) { sinFecha.push(item); continue; }
    var a = Number(item.fecha.slice(0, 4));
    if (a < anio - 1 || a > anio + 1) { sinFecha.push(item); continue; } // año mal tipeado
    if (item.fecha >= desde && item.fecha <= hasta) items.push(item);
  }
  items.sort(function(a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.fila - b.fila; });
  return { items: items, sinFecha: sinFecha, hoja: true };
}

// ── Redacción con IA ──────────────────────────────────────────────────────
var INFORME_SISTEMA = [
  'Sos el asistente de la Coordinación Zonal Buenos Aires de UCASAL (universidad).',
  'Redactás las anotaciones de la coordinadora para el informe semanal que lee su jefa.',
  '',
  'Reglas que no se negocian:',
  '- No agregues hechos, nombres, cifras, fechas, compromisos ni conclusiones que no estén en la nota. Si algo es ambiguo, dejalo tal cual en lugar de interpretarlo.',
  '- No omitas nada de lo anotado: cada dato de la nota tiene que aparecer en tu versión.',
  '- Respetá exactamente nombres propios, sedes, cifras, horarios y siglas.',
  '- Corregí ortografía, puntuación y redacción. Español rioplatense profesional, claro, sin frases vacías ni adjetivos de relleno.',
  '',
  'Estilo (igual a los informes anteriores):',
  '- motivo (reuniones): temas tratados como frases nominales cortas, una por viñeta, con mayúscula inicial y punto final. Ej.: "Participación en ferias y expos educativas."',
  '- resultado (reuniones) y resultado/acciones (auditorías): una viñeta por acuerdo o acción, en impersonal y pasado. Ej.: "Se acordó retomar con mayor continuidad el planner de publicaciones."',
  '- texto (observaciones): una o dos oraciones que empiezan en minúscula (van después de "Sede:"), en sustantivo o impersonal. Ej.: "confección del banner institucional y de los dos modelos de folletería personalizados para la sede. El material ya fue enviado a imprenta."',
  '',
  'Respondé SOLO con un objeto JSON, sin texto antes ni después, con esta forma:',
  '{"items":[{"id":"...","motivo":["..."],"resultado":["..."],"acciones":["..."],"texto":"..."}]}',
  'Incluí todos los ids que recibís. Usá solo los campos que corresponden al tipo:',
  '- reunion: motivo y resultado.  - auditoria: resultado y acciones.  - observacion o semana: texto.'
].join('\n');

// Las anotaciones van en tandas de hasta 12: una semana cargada no se corta
// por largo.
var INFORME_TANDA = 12;

function redactarInforme(body) {
  var items = body.items || [];
  if (!items.length) return { items: [] };
  if (items.length > 120) throw new Error('Demasiadas anotaciones para una semana (' + items.length + ')');
  var entrada = items.map(function(it) {
    return {
      id: String(it.id), tipo: it.tipo, sede_o_tema: it.sede || '',
      motivo: it.motivo || '', resultado: it.resultado || '', acciones: it.acciones || ''
    };
  });
  var porId = {}, modelo = '';
  for (var i = 0; i < entrada.length; i += INFORME_TANDA) {
    var r = llamarGemini(INFORME_SISTEMA, 'Anotaciones de la semana:\n' + JSON.stringify(entrada.slice(i, i + INFORME_TANDA), null, 1), 8192);
    modelo = r._modelo;
    (r.items || []).forEach(function(x) { if (x && x.id) porId[String(x.id)] = x; });
  }
  var lista = function(v) { return Array.isArray(v) ? v.map(String).filter(function(s) { return s.trim(); }) : (v ? [String(v)] : []); };
  return {
    modelo: modelo,
    items: items.map(function(it) {
      var x = porId[String(it.id)];
      if (!x) return { id: String(it.id), faltante: true };
      return { id: String(it.id), motivo: lista(x.motivo), resultado: lista(x.resultado), acciones: lista(x.acciones), texto: String(x.texto || '') };
    })
  };
}

// ── Notas en Word → filas de la bitácora ────────────────────────────────────
// Cele junta sus notas de la semana (WhatsApp, Word, lo que sea) en un Word y
// lo sube en la app. Gemini solo las ORDENA en filas; Cele las revisa en la
// app y recién ahí se guardan (agregar_bitacora).
var INFORME_INTERPRETAR = [
  'Sos el asistente de la Coordinación Zonal Buenos Aires de UCASAL (universidad).',
  'Recibís las notas sueltas que la coordinadora juntó durante una semana y las tenés que ORDENAR en filas para su bitácora. No redactes ni pulas: eso se hace después.',
  '',
  'Reglas que no se negocian:',
  '- Una fila por actividad (una reunión, una auditoría, una gestión o novedad). Si una nota habla de dos cosas distintas, son dos filas.',
  '- No inventes nada. Copiá el contenido con las palabras de la nota (podés quitar muletillas y repeticiones, nada más). No agregues datos, conclusiones ni compromisos.',
  '- No pierdas nada: todo lo que dice el texto tiene que quedar en alguna fila.',
  '- fecha: AAAA-MM-DD. Si la nota da el día ("lunes", "el 12", "ayer" con referencia clara) calculalo dentro de la semana indicada y marcá fecha_deducida = true. Si no hay forma de saberlo, dejala vacía "". Nunca la inventes.',
  '- tipo: "reunion", "auditoria", "observacion" (gestión o novedad puntual) o "semana" (algo que se hizo a lo largo de toda la semana, sin día).',
  '- sede: si es de una sede, escribí el nombre EXACTO de la lista de sedes que te paso. Si es otro tema (una persona, Salesforce, un evento), poné ese tema corto. Si no se sabe, "".',
  '- hora: solo si la nota la dice (ej. "8:30"). Si no, "".',
  '- motivo: en reuniones, los temas tratados, uno por renglón (separados con \\n).',
  '- resultado: en reuniones, lo acordado o hecho (uno por renglón); en auditorías, el resultado; en observaciones, qué pasó.',
  '- acciones: solo auditorías, las acciones de mejora.',
  '- cita: el fragmento literal del texto original del que sale la fila (hasta 200 caracteres), para poder verificarla.',
  '',
  'Respondé SOLO con JSON: {"filas":[{"fecha":"","fecha_deducida":false,"tipo":"","sede":"","hora":"","motivo":"","resultado":"","acciones":"","cita":""}]}'
].join('\n');

function llamarGemini(sistema, texto, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('SIN_API_KEY');
  var intentos = [];
  var modelos = modelosGemini();
  for (var k = 0; k < modelos.length; k++) {
    var modelo = modelos[k];
    var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ text: texto }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: maxTokens || 16384 }
      })
    });
    var code = resp.getResponseCode();
    var txt = resp.getContentText();
    if (code === 400 && /API key/i.test(txt)) throw new Error('La clave de Gemini (GEMINI_API_KEY) no es válida');
    if (code === 401 || code === 403) throw new Error('La clave de Gemini (GEMINI_API_KEY) no es válida o no tiene permiso');
    // Saturado, sin cupo o retirado: probar con el modelo siguiente
    if (code === 503 || code === 500 || code === 429 || code === 404) { intentos.push(modelo + ' ' + code); continue; }
    if (code !== 200) throw new Error('Gemini respondió ' + code + ': ' + txt.slice(0, 200));
    var data = JSON.parse(txt);
    var cand = (data.candidates || [])[0];
    if (!cand) throw new Error('Gemini no devolvió respuesta');
    if (cand.finishReason === 'MAX_TOKENS') throw new Error('Las notas son demasiado largas para procesarlas de una vez: dividilas en dos');
    var salida = ((cand.content && cand.content.parts) || []).map(function(p) { return p.text || ''; }).join('');
    var a = salida.indexOf('{'), z = salida.lastIndexOf('}');
    if (a === -1 || z === -1) throw new Error('Gemini no devolvió el formato esperado');
    var json = JSON.parse(salida.slice(a, z + 1));
    json._modelo = modelo;
    return json;
  }
  throw new Error('Gemini está saturado en este momento (' + intentos.join(', ') + '): probá de nuevo en unos minutos');
}

// { texto, desde, hasta } → { filas: [...] } (nada se guarda acá)
function interpretarNotas(body) {
  var texto = String(body.texto || '').trim();
  if (!texto) throw new Error('El Word no tiene texto');
  if (texto.length > 60000) throw new Error('El Word es demasiado largo (' + texto.length + ' caracteres): dividilo en partes');
  var sedes = getSedes().map(function(s) { return String(s.sede); }).filter(String);
  var pedido = 'Semana: del ' + body.desde + ' (lunes) al ' + body.hasta + ' (domingo).\n' +
    'Sedes (nombres exactos): ' + JSON.stringify(sedes) + '\n\nNotas de la semana:\n"""\n' + texto + '\n"""';
  var r = llamarGemini(INFORME_INTERPRETAR, pedido);
  var tipos = { reunion: 1, auditoria: 1, observacion: 1, semana: 1 };
  var filas = (r.filas || []).map(function(f) {
    var fecha = String(f.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fecha = '';
    var tipo = normTipo(f.tipo);
    return {
      fecha: fecha, fechaDeducida: !!f.fecha_deducida && !!fecha,
      tipo: tipos[tipo] ? tipo : 'observacion',
      sede: String(f.sede || '').trim(), hora: String(f.hora || '').trim(),
      motivo: String(f.motivo || '').trim(), resultado: String(f.resultado || '').trim(),
      acciones: String(f.acciones || '').trim(), cita: String(f.cita || '').trim().slice(0, 300)
    };
  }).filter(function(f) { return f.motivo || f.resultado || f.acciones; });
  return { filas: filas };
}

// Guarda en la bitácora las filas que Cele revisó y confirmó en la app
var TIPO_ETIQUETA = { reunion: 'Reunión', auditoria: 'Auditoría', observacion: 'Observación', semana: 'Toda la semana' };
function agregarBitacora(body) {
  var filas = body.filas || [];
  if (!filas.length) throw new Error('No hay filas para agregar');
  if (filas.length > 200) throw new Error('Demasiadas filas de una vez');
  var tz = SS.getSpreadsheetTimeZone();
  var valores = filas.map(function(f, i) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha || ''))) throw new Error('La fila ' + (i + 1) + ' no tiene fecha');
    if (!TIPO_ETIQUETA[f.tipo]) throw new Error('La fila ' + (i + 1) + ' tiene un tipo inválido');
    if (!String(f.motivo || '').trim() && !String(f.resultado || '').trim() && !String(f.acciones || '').trim()) throw new Error('La fila ' + (i + 1) + ' está vacía');
    var porCol = {
      fecha: Utilities.parseDate(f.fecha, tz, 'yyyy-MM-dd'),
      tipo: TIPO_ETIQUETA[f.tipo],
      sede: String(f.sede || ''),
      hora: f.hora ? "'" + String(f.hora) : '', // como texto: Sheets no la corre de huso
      motivo: String(f.motivo || ''),
      resultado: String(f.resultado || ''),
      acciones_mejora: String(f.acciones || '')
    };
    return porCol;
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var h = getBitacoraSheet();
    var enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0]
      .map(function(k) { return normTexto(k).replace(/\s+/g, '_'); });
    var faltan = BITACORA_COLUMNAS.filter(function(c) { return enc.indexOf(c) === -1; });
    if (faltan.length) throw new Error('En la pestaña bitacora faltan las columnas: ' + faltan.join(', '));
    var matriz = valores.map(function(v) { return enc.map(function(k) { return v.hasOwnProperty(k) ? v[k] : ''; }); });
    // Primera fila libre mirando la columna de fecha y la de tipo (las
    // validaciones de 1000 filas hacen que getLastRow no sirva)
    var datos = h.getRange(1, 1, Math.max(h.getLastRow(), 1), enc.length).getValues();
    var ultima = 1;
    for (var i = datos.length - 1; i >= 1; i--) {
      if (datos[i].join('').trim()) { ultima = i + 1; break; }
    }
    h.getRange(ultima + 1, 1, matriz.length, enc.length).setValues(matriz);
    SpreadsheetApp.flush();
    return { agregadas: matriz.length, desdeFila: ultima + 1 };
  } finally { lock.releaseLock(); }
}
