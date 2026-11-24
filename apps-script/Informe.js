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
// GEMINI_API_KEY. El modelo se puede cambiar sin tocar código con la
// propiedad GEMINI_MODEL (si Google retira el de abajo).
var INFORME_MODELO_DEFECTO = 'gemini-3.8-flash';

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

// Las anotaciones van en tandas de hasta 12, todas a la vez (fetchAll): una
// semana cargada no se corta por largo ni hace esperar de más.
var INFORME_TANDA = 12;

function redactarInforme(body) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('SIN_API_KEY');
  var modelo = props.getProperty('GEMINI_MODEL') || INFORME_MODELO_DEFECTO;
  var items = body.items || [];
  if (!items.length) return { items: [] };
  if (items.length > 120) throw new Error('Demasiadas anotaciones para una semana (' + items.length + ')');
  var entrada = items.map(function(it) {
    return {
      id: String(it.id), tipo: it.tipo, sede_o_tema: it.sede || '',
      motivo: it.motivo || '', resultado: it.resultado || '', acciones: it.acciones || ''
    };
  });
  var tandas = [];
  for (var i = 0; i < entrada.length; i += INFORME_TANDA) tandas.push(entrada.slice(i, i + INFORME_TANDA));
  var pedidos = tandas.map(function(t) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent',
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: INFORME_SISTEMA }] },
        contents: [{ role: 'user', parts: [{ text: 'Anotaciones de la semana:\n' + JSON.stringify(t, null, 1) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 }
      })
    };
  });
  var porId = {};
  UrlFetchApp.fetchAll(pedidos).forEach(function(resp) {
    var code = resp.getResponseCode();
    var txt = resp.getContentText();
    if (code === 400 && /API key/i.test(txt)) throw new Error('La clave de Gemini (GEMINI_API_KEY) no es válida');
    if (code === 401 || code === 403) throw new Error('La clave de Gemini (GEMINI_API_KEY) no es válida o no tiene permiso');
    if (code === 404) throw new Error('Google no reconoce el modelo ' + modelo + ': cargá otro en la propiedad GEMINI_MODEL');
    if (code === 429) throw new Error('Se alcanzó el límite de uso de Gemini: probá de nuevo en un rato');
    if (code === 503 || code === 500) throw new Error('Gemini está saturado: probá de nuevo en un minuto');
    if (code !== 200) throw new Error('Gemini respondió ' + code + ': ' + txt.slice(0, 200));
    var data = JSON.parse(txt);
    var cand = (data.candidates || [])[0];
    if (!cand) throw new Error('Gemini no devolvió respuesta' + (data.promptFeedback && data.promptFeedback.blockReason ? ' (' + data.promptFeedback.blockReason + ')' : ''));
    if (cand.finishReason === 'MAX_TOKENS') throw new Error('La respuesta de Gemini salió cortada: probá de nuevo');
    var salida = ((cand.content && cand.content.parts) || []).map(function(p) { return p.text || ''; }).join('');
    var a = salida.indexOf('{'), z = salida.lastIndexOf('}');
    if (a === -1 || z === -1) throw new Error('Gemini no devolvió el formato esperado');
    var parsed = JSON.parse(salida.slice(a, z + 1));
    (parsed.items || []).forEach(function(x) { if (x && x.id) porId[String(x.id)] = x; });
  });
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
