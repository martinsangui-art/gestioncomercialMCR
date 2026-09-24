// ═══════════════════════════════════════════════════════════════════════
// UCASAL — Cómo Vamos · API + utilidades
// Pegá TODO este archivo en Apps Script y hacé Deploy como Web App
// ═══════════════════════════════════════════════════════════════════════

var SS = SpreadsheetApp.getActiveSpreadsheet();

// ── Autenticación ──────────────────────────────────────────────────────────
// Los secretos viven en PropertiesService (fuera del código fuente, no se
// sube a GitHub) en vez de hardcodeados — el repo es público.
var AUTH_PASSWORD_SALT = PropertiesService.getScriptProperties().getProperty('AUTH_PASSWORD_SALT');
var AUTH_PASSWORD_HASH = PropertiesService.getScriptProperties().getProperty('AUTH_PASSWORD_HASH');
var AUTH_SECRET = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
var SESSION_HOURS = 4; // duración de la sesión — corta a propósito: el token viaja en URLs (JSONP) y queda en logs/historial

function sha256(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Genera un token: base64(expiry) + '.' + hash(expiry + secret)
function generarToken() {
  var expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  var expiryStr = String(expiry);
  var firma = sha256(expiryStr + AUTH_SECRET);
  return Utilities.base64EncodeWebSafe(expiryStr) + '.' + firma;
}

// Valida que el token no esté vencido ni manipulado
function validarToken(token) {
  if (!token || token.indexOf('.') === -1) return false;
  var partes = token.split('.');
  if (partes.length !== 2) return false;
  var expiryStr;
  try { expiryStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString(); }
  catch(e) { return false; }
  var firmaEsperada = sha256(expiryStr + AUTH_SECRET);
  if (firmaEsperada !== partes[1]) return false; // token manipulado
  var expiry = Number(expiryStr);
  if (isNaN(expiry) || Date.now() > expiry) return false; // vencido
  return true;
}

function login(password) {
  if (!password) throw new Error('Falta la contraseña');
  var hash = sha256(password + AUTH_PASSWORD_SALT);
  if (hash !== AUTH_PASSWORD_HASH) throw new Error('Contraseña incorrecta');
  return { token: generarToken(), expiraEnHoras: SESSION_HOURS };
}

// Apps Script no soporta addHeader — se usa JSONP para GET, texto plano para POST
function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════════
// doGet — Router de lectura
// Parámetros: ?action=...
//   campanas            → todas las campañas
//   sedes               → todas las sedes con email y saludo
//   objetivos&campana=C2 → objetivos filtrados por campaña
//   historial&campana=C2 → historial filtrado (todas las fechas)
//   semana_actual&campana=C2 → solo la semana más reciente
//   semanas&campana=C2  → lista de fechas disponibles
// ════════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var action   = e.parameter.action;
    var campana  = e.parameter.campana || null;
    var callback = e.parameter.callback || null;  // JSONP support
    var token    = e.parameter.token || null;

    var result;

    // Login es la única acción pública — no requiere token
    if (action === 'login') {
      result = okData(login(e.parameter.password));
    }
    else if (!validarToken(token)) {
      result = { ok: false, error: 'AUTH_REQUIRED' };
    }
    else if (action === 'campanas')      result = okData(getCampanas());
    else if (action === 'sedes')    result = okData(getSedes());
    else if (action === 'sedes_todas') result = okData(getSedesTodas());
    else if (action === 'objetivos') result = okData(getObjetivos(campana));
    else if (action === 'historial') result = okData(getHistorial(campana));
    else if (action === 'semana_actual') result = okData(getSemanaActual(campana));
    else if (action === 'semanas')  result = okData(getSemanas(campana));
    else if (action === 'enviar_email') {
      result = okData(enviarEmailMake({
        to:      e.parameter.to,
        subject: e.parameter.subject,
        html:    e.parameter.html,
        sede:    e.parameter.sede,
        cod:     e.parameter.cod,
        fecha:   e.parameter.fecha,
        campana: e.parameter.campana,
      }));
    }
    else if (action === 'log_envios') {
      result = okData(getLogEnvios(Number(e.parameter.limite) || 200));
    }
    else if (action === 'config') {
      result = okData(getConfig());
    }
    else if (action === 'ultimo_deshacer') {
      result = okData(getUltimoDeshacer());
    }
    else if (action === 'backup') {
      result = okData(getBackup());
    }
    else if (action === 'notas_sede') {
      result = okData(getNotasSede(e.parameter.cod_sede));
    }
    else if (action === 'resumen_cele') {
      var itemsParsed = JSON.parse(e.parameter.items || '[]');
      result = okData(enviarResumenCele({
        campana: e.parameter.campana,
        fecha:   e.parameter.fecha,
        items:   itemsParsed,
      }));
    }
    else result = { ok: false, error: 'action no reconocida: ' + action };

    var json = JSON.stringify(result);
    if (callback) {
      // JSONP — envolver en la función callback
      return ContentService
        .createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch(ex) {
    var errJson = JSON.stringify({ ok: false, error: ex.message });
    var callback2 = (e.parameter && e.parameter.callback) || null;
    if (callback2) {
      return ContentService
        .createTextOutput(callback2 + '(' + errJson + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(errJson)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function okData(data) { return { ok: true, data: data }; }

// ════════════════════════════════════════════════════════════════════════
// doPost — Router de escritura
// Body JSON: { action, ...params }
//   agregar_semana   → agrega una semana nueva al historial
//     { campana_id, campana_nombre, fecha, sedes: [{cod, sede, total}] }
//   eliminar_corte   → borra del historial las filas de una fecha exacta
//     (uso puntual para corregir cortes cargados con fecha corrupta)
//     { fecha, campana_nombre }
//   cerrar_campana   → cierra la campaña activa y/o abre la siguiente
//     { campana_id?, nueva?: { nombre, fin, objetivos: [{cod_sede, objetivo}] } }
//   deshacer         → revierte la última operación registrada en 'deshacer'
//     { id }  (el id que devolvió ultimo_deshacer, para no deshacer otra cosa)
//   restaurar_backup → reemplaza campanas/objetivos/historial por los de un backup
//     { hojas: { campanas: [[header...], [fila...]], objetivos: [...], historial: [...] } }
// ════════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (!validarToken(body.token)) return err('AUTH_REQUIRED');

    if (action === 'agregar_semana') return ok(agregarSemana(body));
    if (action === 'eliminar_corte') return ok(eliminarCorte(body));
    if (action === 'set_password') return ok(setPassword(body));
    if (action === 'set_secret_prop') return ok(setSecretProp(body));
    if (action === 'chequear_make') return ok(chequearEstadoMake());
    if (action === 'chequear_escenario_activo') return ok(chequearEscenarioActivoMake());
    if (action === 'instalar_chequeo_make') return ok(instalarChequeoMakeDiario());
    if (action === 'corregir_log_envios') return ok(corregirLogEnvios(body));
    if (action === 'agregar_sede') return ok(agregarSede(body));
    if (action === 'editar_sede') return ok(editarSede(body));
    if (action === 'set_sede_activa') return ok(setSedeActiva(body));
    if (action === 'set_config') return ok(setConfig(body));
    if (action === 'confirmar_envio_lote') return ok(confirmarEnvioLote(body));
    if (action === 'agregar_nota') return ok(agregarNotaSede(body));
    if (action === 'cerrar_campana') return ok(cerrarCampana(body));
    if (action === 'deshacer') return ok(deshacerUltimo(body));
    if (action === 'restaurar_backup') return ok(restaurarBackup(body));

    return err('action no reconocida: ' + action);
  } catch(ex) {
    return err(ex.message);
  }
}

// Corrige filas de log_envios marcadas 'enviado' que en realidad fallaron
// (ej: escenario de Make caído silenciosamente) — las pasa a 'error' para
// que la app las vuelva a mostrar como pendientes de envío.
function corregirLogEnvios(body) {
  var fecha = body.fecha;
  var campanaNombre = body.campana_nombre || null;
  if (!fecha) throw new Error('Falta fecha');

  var h = getLogSheet();
  var allRows = h.getDataRange().getValues();
  var corregidas = 0;
  for (var i = 1; i < allRows.length; i++) {
    var rowFecha = allRows[i][0];
    if (rowFecha instanceof Date) {
      rowFecha = Utilities.formatDate(rowFecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    rowFecha = String(rowFecha);
    var rowCampana = String(allRows[i][2] || '');
    var rowEstado = String(allRows[i][6] || '');
    if (rowFecha === fecha && rowEstado === 'enviado' && (!campanaNombre || rowCampana.indexOf(campanaNombre) >= 0)) {
      h.getRange(i + 1, 7).setValue('error');
      corregidas++;
    }
  }
  if (corregidas) SpreadsheetApp.flush();
  return { corregidas: corregidas };
}

// Cambia la contraseña de acceso (autenticado — requiere una sesión ya
// válida). Recibe el salt+hash ya calculados, nunca la contraseña en claro.
function setPassword(body) {
  if (!body.salt || !body.hash) throw new Error('Falta salt o hash');
  PropertiesService.getScriptProperties().setProperties({
    AUTH_PASSWORD_SALT: body.salt,
    AUTH_PASSWORD_HASH: body.hash,
  });
  return { ok: true };
}

// Guarda un secreto puntual en PropertiesService — lista blanca cerrada para
// no poder pisar AUTH_SECRET/AUTH_PASSWORD_* por error desde acá. Pensado
// para que el propio usuario lo corra desde la consola del navegador (nunca
// pasando el valor por el chat con el asistente).
var SECRETOS_PERMITIDOS = ['MAKE_API_TOKEN', 'MAKE_SCENARIO_ID', 'MAKE_ZONE', 'ALERTA_EMAIL'];
function setSecretProp(body) {
  if (!body.clave || body.valor === undefined) throw new Error('Falta clave o valor');
  if (SECRETOS_PERMITIDOS.indexOf(body.clave) === -1) throw new Error('Clave no permitida: ' + body.clave);
  PropertiesService.getScriptProperties().setProperty(body.clave, body.valor);
  return { ok: true };
}

// ── Chequeo real del escenario de Make vía su API ───────────────────────────
// El webhook solo confirma que Make RECIBIÓ el pedido (ver incidente del
// escenario desactivado) — esto consulta el historial de ejecuciones real
// de la API de Make para saber si el último envío falló de verdad, y avisa
// por mail directo desde Google (MailApp, no Make) para que la alerta llegue
// incluso si el propio Make está caído.
function chequearEstadoMake() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('MAKE_API_TOKEN');
  var scenarioId = props.getProperty('MAKE_SCENARIO_ID');
  var zone = props.getProperty('MAKE_ZONE') || 'us2';
  var alertaEmail = props.getProperty('ALERTA_EMAIL');
  if (!token || !scenarioId) throw new Error('Falta configurar MAKE_API_TOKEN o MAKE_SCENARIO_ID');

  var headers = { Authorization: 'Token ' + token };
  var base = 'https://' + zone + '.make.com/api/v2/scenarios/' + scenarioId;

  // 1) ¿Está activo el escenario? — esto es exactamente lo que pasó ayer:
  // Make lo desactivó solo y el webhook seguía devolviendo 200 igual.
  var respEscenario = UrlFetchApp.fetch(base, { method: 'get', headers: headers, muteHttpExceptions: true });
  if (respEscenario.getResponseCode() < 200 || respEscenario.getResponseCode() >= 300) {
    return { ok: false, error: 'API de Make (escenario) respondió ' + respEscenario.getResponseCode(), detalle: respEscenario.getContentText() };
  }
  var escenario = JSON.parse(respEscenario.getContentText()).scenario;
  var desactivado = escenario && (escenario.isActive === false || escenario.isPaused === true);

  // 2) ¿La última ejecución registrada terminó en error?
  var respLogs = UrlFetchApp.fetch(base + '/logs?pg[limit]=1&pg[sortDir]=desc', { method: 'get', headers: headers, muteHttpExceptions: true });
  var ultimo = null;
  if (respLogs.getResponseCode() >= 200 && respLogs.getResponseCode() < 300) {
    var dataLogs = JSON.parse(respLogs.getContentText());
    ultimo = dataLogs.scenarioLogs && dataLogs.scenarioLogs[0];
  }
  // status: 0/1 = éxito (con o sin warning), 2 = error — confirmado con un
  // envío real exitoso que devolvió status:1.
  var ultimoFallo = !!(ultimo && (ultimo.status === 2 || ultimo.status === 'error'));

  var fallo = desactivado || ultimoFallo;

  if (fallo && alertaEmail) {
    var motivo = desactivado ? 'El escenario está desactivado o pausado en Make.' : 'La última ejecución registrada en Make terminó con error.';
    MailApp.sendEmail({
      to: alertaEmail,
      subject: '⚠️ Alerta: el escenario de Make de Cómo Vamos no está enviando',
      htmlBody: '<p>' + motivo + '</p>' +
        '<p>Revisá el escenario directamente en Make.com — esta alerta se manda desde Google, no desde Make, para que llegue igual si Make está caído.</p>' +
        '<pre>escenario.isActive: ' + (escenario && escenario.isActive) + '\nescenario.isPaused: ' + (escenario && escenario.isPaused) + '</pre>' +
        (ultimo ? '<pre>' + JSON.stringify(ultimo, null, 2) + '</pre>' : ''),
    });
  }

  return { ok: true, fallo: fallo, desactivado: !!desactivado, ultimoFallo: ultimoFallo, ultimoLog: ultimo };
}

// Chequeo exploratorio: trae el detalle del escenario (no los logs) para ver
// el campo real que indica si está activo/desactivado — se usa una vez para
// confirmar el nombre exacto del campo antes de dejarlo en el chequeo diario.
function chequearEscenarioActivoMake() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('MAKE_API_TOKEN');
  var scenarioId = props.getProperty('MAKE_SCENARIO_ID');
  var zone = props.getProperty('MAKE_ZONE') || 'us2';
  if (!token || !scenarioId) throw new Error('Falta configurar MAKE_API_TOKEN o MAKE_SCENARIO_ID');

  var url = 'https://' + zone + '.make.com/api/v2/scenarios/' + scenarioId;
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Token ' + token },
    muteHttpExceptions: true,
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    return { ok: false, error: 'API de Make respondió ' + status, detalle: response.getContentText() };
  }
  return { ok: true, data: JSON.parse(response.getContentText()) };
}

// Wrapper sin argumentos — los triggers de Apps Script llaman a la función
// por nombre, sin parámetros.
function chequearEstadoMakeTrigger() {
  try { chequearEstadoMake(); } catch (ex) {
    // Si falla la config (token vencido, etc.) no hay mucho más para hacer acá;
    // se ve corriendo 'chequear_make' manualmente para diagnosticar.
  }
}

// Instala (o reinstala, sin duplicar) un chequeo diario del estado real del
// escenario de Make. Se corre una sola vez desde una sesión ya autenticada.
function instalarChequeoMakeDiario() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'chequearEstadoMakeTrigger') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('chequearEstadoMakeTrigger').timeBased().everyDays(1).atHour(18).create();
  return { ok: true };
}

// Borra del historial todas las filas que matcheen exactamente una fecha
// (y opcionalmente una campaña). Uso puntual para limpiar cortes cargados
// con una fecha corrupta antes de volver a insertarlos bien.
function eliminarCorte(body) {
  var fecha = body.fecha;
  var campanaNombre = body.campana_nombre || null;
  if (!fecha) throw new Error('Falta fecha');

  var hHist = SS.getSheetByName('historial');
  var allRows = hHist.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = allRows.length - 1; i >= 1; i--) {
    var rowFecha = allRows[i][0];
    if (rowFecha instanceof Date) {
      rowFecha = Utilities.formatDate(rowFecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    rowFecha = String(rowFecha);
    var rowCampana = String(allRows[i][3] || '');
    if (rowFecha === fecha && (!campanaNombre || rowCampana.indexOf(campanaNombre) >= 0)) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(function(rowNum) { hHist.deleteRow(rowNum); });
  if (rowsToDelete.length) SpreadsheetApp.flush();
  return { eliminadas: rowsToDelete.length, fecha: fecha };
}

// ════════════════════════════════════════════════════════════════════════
// ENVÍO DE EMAIL VIA MAKE (llamado desde el browser via JSONP)
// ════════════════════════════════════════════════════════════════════════
var MAKE_WEBHOOK = PropertiesService.getScriptProperties().getProperty('MAKE_WEBHOOK');

function enviarEmailMake(params) {
  var status = 0;
  try {
    var options = {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        to:      String(params.to || ''),
        subject: String(params.subject || ''),
        html:    String(params.html || ''),
        sede:    String(params.sede || ''),
        cod:     String(params.cod || ''),
        fecha:   String(params.fecha || ''),
        tipo:    'email'
      }),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(MAKE_WEBHOOK, options);
    status = response.getResponseCode();
  } catch(exFetch) {
    registrarEnvio({
      sede: params.sede, cod: params.cod, email: params.to,
      campana: (params.campana || '') + ' [ERROR FETCH: ' + exFetch.message + ']',
      ok: false,
    });
    throw exFetch;
  }

  registrarEnvio({
    sede: params.sede,
    cod: params.cod,
    email: params.to,
    campana: params.campana || '',
    ok: status >= 200 && status < 300,
  });

  return { status: status };
}

// ── Resumen ejecutivo a Cele tras cada tanda de envío ────────────────────
// Reactivado (24/07/2026): se envía por el mismo webhook de Make que ya
// usa enviarEmailMake para las sedes (no se usa MailApp.sendEmail porque
// siempre manda desde la cuenta dueña del Apps Script, no desde
// mcrossi@ucasal.edu.ar).
var EMAIL_CELE = 'mcrossi@ucasal.edu.ar';

function fmtFechaDDMMAAAA(iso) {
  var p = String(iso || '').slice(0, 10).split('-');
  if (p.length !== 3) return String(iso || '');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function enviarResumenCele(payload) {
  var items    = payload.items || [];
  var fecha    = payload.fecha || '';
  var campana  = payload.campana || '';
  var ok       = items.filter(function(it) { return it.estado === 'enviado'; }).length;
  var conError = items.length - ok;

  var filas = items.map(function(it) {
    var color = it.estado === 'enviado' ? '#059669' : '#e11d48';
    var texto = it.estado === 'enviado' ? '✓ Enviado' : '✗ Error';
    return '<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">' + it.sede + '</td>' +
      '<td style="padding:6px 10px;border:1px solid #e5e7eb">' + (it.email || '') + '</td>' +
      '<td style="padding:6px 10px;border:1px solid #e5e7eb;color:' + color + ';font-weight:700">' + texto + '</td></tr>';
  }).join('');

  var html = '<p>Resumen del envío — <strong>' + campana + '</strong> al ' + fmtFechaDDMMAAAA(fecha) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px">' +
    '<tr style="background:#1a1a2e;color:#fff"><th style="padding:7px 10px;text-align:left;font-size:11px">SEDE</th>' +
    '<th style="padding:7px 10px;text-align:left;font-size:11px">EMAIL</th>' +
    '<th style="padding:7px 10px;text-align:left;font-size:11px">ESTADO</th></tr>' +
    filas + '</table>' +
    '<p>' + ok + ' enviados' + (conError > 0 ? ', ' + conError + ' con error' : '') + '.</p>';

  var status = 0;
  try {
    var response = UrlFetchApp.fetch(MAKE_WEBHOOK, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        to:      EMAIL_CELE,
        subject: 'Resumen de envío — Cómo vamos — ' + campana + ' — ' + fmtFechaDDMMAAAA(fecha),
        html:    html,
        sede:    '',
        cod:     '',
        fecha:   fecha,
        tipo:    'email'
      }),
      muteHttpExceptions: true
    });
    status = response.getResponseCode();
  } catch (exFetch) {
    registrarEnvio({ sede: '[RESUMEN]', cod: '', email: EMAIL_CELE, campana: campana + ' [ERROR FETCH: ' + exFetch.message + ']', ok: false });
    return { enviado: false, error: exFetch.message };
  }

  var enviado = status >= 200 && status < 300;
  registrarEnvio({ sede: '[RESUMEN]', cod: '', email: EMAIL_CELE, campana: campana, ok: enviado });
  return { enviado: enviado, status: status };
}

// ── Configuración editable (plantilla de email, etc.) ───────────────────────
var DEFAULT_EMAIL_TEMPLATE = '<p>{{saludo}}:</p>\n' +
  '<p style="margin-top:6px">Enviamos el resultado del <strong>cómo vamos</strong> al {{fecha}}</p>\n' +
  '{{tabla}}\n' +
  '<p style="margin-top:8px">Quedamos a disposición para cualquier consulta o duda que puedas tener.</p>\n' +
  '<p style="margin-top:10px">Feliz fin de semana.<br>Saludos!</p>';

function getConfigSheet() {
  var h = SS.getSheetByName('config');
  if (!h) {
    h = SS.insertSheet('config');
    h.getRange(1, 1, 1, 2).setValues([['clave', 'valor']]);
    h.getRange(1, 1, 1, 2).setBackground('#1B2A6B').setFontColor('#ffffff').setFontWeight('bold');
    h.appendRow(['EMAIL_TEMPLATE', DEFAULT_EMAIL_TEMPLATE]);
    h.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return h;
}

function getConfig() {
  var h = getConfigSheet();
  var rows = h.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    out[rows[i][0]] = rows[i][1];
  }
  if (!out.EMAIL_TEMPLATE) out.EMAIL_TEMPLATE = DEFAULT_EMAIL_TEMPLATE;
  return out;
}

function setConfig(body) {
  if (!body.claves) throw new Error('Falta claves');
  var h = getConfigSheet();
  var rows = h.getDataRange().getValues();
  Object.keys(body.claves).forEach(function(clave) {
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === clave) {
        h.getRange(i + 1, 2).setValue(body.claves[clave]);
        found = true;
        break;
      }
    }
    if (!found) h.appendRow([clave, body.claves[clave]]);
  });
  SpreadsheetApp.flush();
  return { ok: true };
}

// ── Notas por sede (mini-CRM de seguimiento) ────────────────────────────────
function getNotasSheet() {
  var h = SS.getSheetByName('notas_sede');
  if (!h) {
    h = SS.insertSheet('notas_sede');
    h.getRange(1, 1, 1, 3).setValues([['fecha', 'cod_sede', 'nota']]);
    h.getRange(1, 1, 1, 3).setBackground('#1B2A6B').setFontColor('#ffffff').setFontWeight('bold');
    h.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return h;
}

function getNotasSede(cod_sede) {
  var h = getNotasSheet();
  var rows = h.getDataRange().getValues();
  if (rows.length <= 1) return [];
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  if (cod_sede) data = data.filter(function(r) { return String(r.cod_sede) === String(cod_sede); });
  data.reverse();
  return data;
}

function agregarNotaSede(body) {
  if (!body.cod_sede || !body.nota) throw new Error('Falta cod_sede o nota');
  var h = getNotasSheet();
  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  h.appendRow([fecha, body.cod_sede, body.nota]);
  SpreadsheetApp.flush();
  return { ok: true };
}

function getLogSheet() {
  var h = SS.getSheetByName('log_envios');
  if (!h) {
    h = SS.insertSheet('log_envios');
    h.getRange(1,1,1,7).setValues([['fecha','hora','campana','sede','cod_sede','email','estado']]);
    h.getRange(1,1,1,7).setBackground('#1B2A6B').setFontColor('#ffffff').setFontWeight('bold');
    h.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return h;
}

// El webhook de Make devuelve 200 apenas RECIBE el pedido, no cuando termina
// de mandar el mail de verdad (ver incidente del escenario desactivado) —
// no hay forma de confirmar la entrega real solo con código. Esto agrega una
// marca manual: Cele confirma a mano una tanda cuando de verdad la vio llegar.
function getLogSheetConConfirmado() {
  var h = getLogSheet();
  var headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  var idx = headers.indexOf('confirmado');
  if (idx === -1) {
    var nuevaCol = headers.length + 1;
    h.getRange(1, nuevaCol).setValue('confirmado');
    idx = nuevaCol - 1;
  }
  return { sheet: h, idxConfirmado: idx };
}

function confirmarEnvioLote(body) {
  if (!body.fecha || !body.hora) throw new Error('Falta fecha u hora');
  var info = getLogSheetConConfirmado();
  var h = info.sheet;
  var allRows = h.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < allRows.length; i++) {
    var rowFecha = allRows[i][0];
    if (rowFecha instanceof Date) rowFecha = Utilities.formatDate(rowFecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    rowFecha = String(rowFecha);
    var rowHora = allRows[i][1];
    if (rowHora instanceof Date) rowHora = Utilities.formatDate(rowHora, Session.getScriptTimeZone(), 'HH:mm:ss');
    rowHora = String(rowHora);
    if (rowFecha === body.fecha && rowHora.slice(0, 5) === String(body.hora).slice(0, 5)) {
      h.getRange(i + 1, info.idxConfirmado + 1).setValue('TRUE');
      count++;
    }
  }
  if (count) SpreadsheetApp.flush();
  return { confirmadas: count };
}

function registrarEnvio(p) {
  var h = getLogSheet();
  var now = new Date();
  var fecha = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var hora  = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  h.appendRow([fecha, hora, p.campana, p.sede, p.cod, p.email, p.ok ? 'enviado' : 'error']);
  SpreadsheetApp.flush();
}

function getLogEnvios(limite) {
  var h = getLogSheet();
  var rows = h.getDataRange().getValues();
  if (rows.length <= 1) return [];
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  data.reverse(); // más reciente primero
  if (limite) data = data.slice(0, limite);
  return data;
}

// ════════════════════════════════════════════════════════════════════════
// LECTURAS
// ════════════════════════════════════════════════════════════════════════

function getCampanas() {
  var h = SS.getSheetByName('campanas');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  return rows.slice(1).map(function(r) {
    return rowToObj(keys, r);
  });
}

// Una sede se considera activa salvo que la columna 'activa' diga explícitamente
// lo contrario — si la columna no existe todavía (sedes cargadas antes de esta
// función) o está vacía, se toma como activa por defecto.
function esSedeActiva(row) {
  var v = row.activa;
  if (v === undefined || v === null || v === '') return true;
  var s = String(v).trim().toUpperCase();
  return !(s === 'FALSE' || s === 'FALSO' || s === '0' || s === 'NO');
}

function getSedes() {
  var h = SS.getSheetByName('sedes');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  return data.filter(esSedeActiva);
}

// Todas las sedes (activas e inactivas) — para el panel de gestión.
function getSedesTodas() {
  var h = SS.getSheetByName('sedes');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  return rows.slice(1).map(function(r) { return rowToObj(keys, r); });
}

function getObjetivos(campanaId) {
  var h = SS.getSheetByName('objetivos');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  if (campanaId) data = data.filter(function(r) { return r.campana_id === campanaId; });
  var sedesActivas = {};
  getSedes().forEach(function(s) { sedesActivas[String(s.cod_sede)] = true; });
  data = data.filter(function(r) { return sedesActivas[String(r.cod_sede)]; });
  return data;
}

// ── Gestión de sedes (alta / edición / activar-desactivar) ──────────────────
// Se agrega la columna 'activa' sola la primera vez que hace falta, para no
// depender de una migración manual en la planilla.
function getSedesSheetConActiva() {
  var h = SS.getSheetByName('sedes');
  var headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  var idxActiva = headers.indexOf('activa');
  if (idxActiva === -1) {
    var nuevaCol = headers.length + 1;
    h.getRange(1, nuevaCol).setValue('activa');
    var lastRow = h.getLastRow();
    if (lastRow > 1) {
      var vals = [];
      for (var i = 0; i < lastRow - 1; i++) vals.push(['TRUE']);
      h.getRange(2, nuevaCol, lastRow - 1, 1).setValues(vals);
    }
    idxActiva = nuevaCol - 1;
    headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  }
  return { sheet: h, headers: headers, idxActiva: idxActiva };
}

function agregarSede(body) {
  if (!body.cod_sede || !body.sede) throw new Error('Falta cod_sede o sede');
  var info = getSedesSheetConActiva();
  var h = info.sheet;
  var idxCod = info.headers.indexOf('cod_sede');
  var allRows = h.getDataRange().getValues();
  for (var i = 1; i < allRows.length; i++) {
    if (String(allRows[i][idxCod]) === String(body.cod_sede)) {
      throw new Error('Ya existe una sede con ese código');
    }
  }
  var fila = info.headers.map(function(col) {
    if (col === 'cod_sede') return body.cod_sede;
    if (col === 'sede') return body.sede;
    if (col === 'email') return body.email || '';
    if (col === 'saludo') return body.saludo || '';
    if (col === 'activa') return 'TRUE';
    return '';
  });
  h.appendRow(fila);
  SpreadsheetApp.flush();
  return { ok: true };
}

function editarSede(body) {
  if (!body.cod_sede) throw new Error('Falta cod_sede');
  var h = SS.getSheetByName('sedes');
  var headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  var idxCod = headers.indexOf('cod_sede');
  var allRows = h.getDataRange().getValues();
  for (var i = 1; i < allRows.length; i++) {
    if (String(allRows[i][idxCod]) === String(body.cod_sede)) {
      ['sede', 'email', 'saludo'].forEach(function(campo) {
        var idx = headers.indexOf(campo);
        if (idx !== -1 && body[campo] !== undefined) {
          h.getRange(i + 1, idx + 1).setValue(body[campo]);
        }
      });
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  throw new Error('No se encontró la sede');
}

function setSedeActiva(body) {
  if (!body.cod_sede) throw new Error('Falta cod_sede');
  var info = getSedesSheetConActiva();
  var h = info.sheet;
  var idxCod = info.headers.indexOf('cod_sede');
  var allRows = h.getDataRange().getValues();
  for (var i = 1; i < allRows.length; i++) {
    if (String(allRows[i][idxCod]) === String(body.cod_sede)) {
      h.getRange(i + 1, info.idxActiva + 1).setValue(body.activa ? 'TRUE' : 'FALSE');
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  throw new Error('No se encontró la sede');
}

function getHistorial(campanaId) {
  var h = SS.getSheetByName('historial');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  if (campanaId) {
    // Buscar por campana_id en hoja objetivos para obtener nombre exacto
    var campanas = getCampanas();
    var campObj = campanas.filter(function(c){ return c.id === campanaId; })[0];
    var nombreExacto = campObj ? campObj.nombre : null;
    // Nombres exactos de las OTRAS campañas: una fila que es exactamente de
    // otra campaña no se cuenta acá aunque la contenga como substring (ej:
    // "2do Ingreso" no se lleva las filas de "2do Ingreso 2027").
    var otrosNombres = {};
    campanas.forEach(function(c) { if (c.id !== campanaId) otrosNombres[String(c.nombre)] = true; });
    data = data.filter(function(r) {
      var val = String(r['campaña'] || r['campana'] || r[3] || '');
      if (nombreExacto) {
        if (val === nombreExacto) return true;
        if (otrosNombres[val]) return false;
        return val.indexOf(nombreExacto) >= 0;
      }
      // fallback
      var patron = campanaId === 'C1' ? '1er Ingreso' : '2do Ingreso';
      return val.indexOf(patron) >= 0;
    });
  }
  return data;
}

function getSemanas(campanaId) {
  var hist = getHistorial(campanaId);
  var fechas = {};
  hist.forEach(function(r) { fechas[r.fecha] = true; });
  return Object.keys(fechas).sort();
}

function getSemanaActual(campanaId) {
  var hist = getHistorial(campanaId);
  if (!hist.length) return [];
  // Fecha más reciente
  var fechas = {};
  hist.forEach(function(r) { fechas[r.fecha] = true; });
  var sorted = Object.keys(fechas).sort();
  var ultima = sorted[sorted.length - 1];
  var anterior = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  // Datos semana actual
  var actual = hist.filter(function(r) { return r.fecha === ultima; });

  // Mapa semana anterior para calcular variación
  var prevMap = {};
  if (anterior) {
    hist.filter(function(r) { return r.fecha === anterior; })
        .forEach(function(r) { prevMap[String(r.cod_sede)] = r.total; });
  }

  // Objetivos
  var objMap = {};
  getObjetivos(campanaId).forEach(function(o) {
    objMap[String(o.cod_sede)] = Number(o.objetivo);
  });

  // Sedes
  var sedesMap = {};
  getSedes().forEach(function(s) {
    sedesMap[String(s.cod_sede)] = { sede: s.sede, email: s.email, saludo: s.saludo };
  });

  return actual.map(function(r) {
    var cod = String(r.cod_sede);
    var total = Number(r.total) || 0;
    var obj = objMap[cod] || 0;
    var prev = prevMap[cod] !== undefined ? Number(prevMap[cod]) : null;
    var pct = obj > 0 ? Math.round(total / obj * 100) : 0;
    var info = sedesMap[cod] || {};
    return {
      cod_sede:  cod,
      sede:      info.sede || r.sede,
      email:     info.email || '',
      saludo:    info.saludo || '',
      objetivo:  obj,
      total:     total,
      prev:      prev,
      var:       prev !== null ? total - prev : null,
      pct:       pct,
      fecha:     ultima,
      campana:   campanaId
    };
  });
}

// ════════════════════════════════════════════════════════════════════════
// ESCRITURA — Agregar o reemplazar semana
// ════════════════════════════════════════════════════════════════════════
function agregarSemana(body) {
  var hHist = SS.getSheetByName('historial');
  var campanaId   = body.campana_id;
  var campanaNombre = body.campana_nombre;
  var fecha       = body.fecha;       // "2026-06-19"
  var sedes       = body.sedes;       // [{cod, sede, total}]
  var reemplazar  = body.reemplazar === true;

  if (!fecha || !sedes || !sedes.length) throw new Error('Faltan datos: fecha y sedes son requeridos');

  // Verificar si ya existe esa fecha para esa campaña
  var hist = getHistorial(campanaId);
  var fechasExistentes = {};
  hist.forEach(function(r) { fechasExistentes[r.fecha] = true; });

  var reemplazadas = [];
  if (fechasExistentes[fecha]) {
    if (!reemplazar) {
      // El front va a capturar este mensaje y ofrecer el botón de reemplazar
      throw new Error('Ya existe el corte del ' + fecha + ' para ' + campanaId);
    }
    // Borrar las filas existentes para esa fecha y campaña antes de insertar
    var allRows = hHist.getDataRange().getValues();
    var rowsToDelete = [];
    for (var i = allRows.length - 1; i >= 1; i--) {
      var rowFecha = allRows[i][0];
      if (rowFecha instanceof Date) {
        rowFecha = Utilities.formatDate(rowFecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      rowFecha = String(rowFecha);
      var rowCampana = String(allRows[i][3] || '');
      if (rowFecha === fecha && rowCampana.indexOf(campanaNombre) >= 0) {
        rowsToDelete.push(i + 1); // +1 porque getValues es 0-indexed, deleteRow es 1-indexed
        var copia = allRows[i].slice(0, 7);
        copia[0] = rowFecha;
        // Sheets lee '62%' como 0.62 — se guarda de nuevo como texto, igual que al cargar
        var tot = Number(copia[4]) || 0, ob = Number(copia[5]) || 0;
        copia[6] = ob > 0 ? Math.round(tot / ob * 100) + '%' : '0%';
        reemplazadas.push(copia);
      }
    }
    rowsToDelete.forEach(function(rowNum) {
      hHist.deleteRow(rowNum);
    });
    SpreadsheetApp.flush();
  }

  // Objetivos para calcular %
  var objMap = {};
  getObjetivos(campanaId).forEach(function(o) {
    objMap[String(o.cod_sede)] = Number(o.objetivo);
  });

  // Armar filas
  var filas = sedes.map(function(s) {
    var cod   = String(s.cod);
    var total = Number(s.total) || 0;
    var obj   = objMap[cod] || 0;
    var pct   = obj > 0 ? Math.round(total / obj * 100) + '%' : '0%';
    return [fecha, cod, s.sede, campanaNombre, total, obj, pct];
  });

  var lastRow = hHist.getLastRow();
  hHist.getRange(lastRow + 1, 1, filas.length, 7).setValues(filas);

  registrarDeshacer('agregar_semana',
    (reemplazar ? 'Reemplazo' : 'Carga') + ' del corte ' + fmtFechaDDMMAAAA(fecha) + ' · ' + campanaNombre,
    { campana_id: campanaId, campana_nombre: campanaNombre, fecha: fecha, reemplazadas: reemplazadas });

  return { insertadas: filas.length, fecha: fecha, campana: campanaId, reemplazado: reemplazar };
}

// ════════════════════════════════════════════════════════════════════════
// CIERRE DE CAMPAÑA — cierra la activa y abre la siguiente con sus objetivos
// ════════════════════════════════════════════════════════════════════════
// El historial de la campaña cerrada no se toca: queda tal cual para consultar
// y comparar. Cerrar solo cambia su estado (la app ya bloquea carga de Excel y
// envíos en campañas cerradas). Todo se valida antes de escribir, para no dejar
// la planilla a medias si algo viene mal.
function asegurarColumna(sheet, nombre) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf(nombre);
  if (idx !== -1) return idx;
  sheet.getRange(1, headers.length + 1).setValue(nombre);
  return headers.length;
}

function cerrarCampana(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var campanas = getCampanas();
    var aCerrar = null;
    if (body.campana_id) {
      aCerrar = campanas.filter(function(c) { return c.id === body.campana_id; })[0];
      if (!aCerrar) throw new Error('No se encontró la campaña ' + body.campana_id);
      if (aCerrar.estado === 'cerrada') throw new Error('La campaña ya está cerrada');
    }

    var nueva = body.nueva || null;
    var objetivos = [];
    if (nueva) {
      var nombre = String(nueva.nombre || '').trim();
      if (!nombre) throw new Error('Falta el nombre de la campaña nueva');
      // El historial y el log de envíos se asocian a la campaña por nombre
      // (con búsqueda por substring) — dos nombres donde uno contiene al otro
      // mezclarían datos entre campañas.
      var n = nombre.toLowerCase();
      campanas.forEach(function(c) {
        var o = String(c.nombre || '').toLowerCase();
        if (o && (o === n || o.indexOf(n) >= 0 || n.indexOf(o) >= 0)) {
          throw new Error('El nombre se superpone con la campaña existente "' + c.nombre + '". Usá un nombre distinto (ej: con el año).');
        }
      });
      if (nueva.fin && !/^\d{4}-\d{2}-\d{2}$/.test(String(nueva.fin))) throw new Error('Fecha de fin inválida');
      objetivos = (nueva.objetivos || [])
        .map(function(o) { return { cod_sede: String(o.cod_sede), objetivo: Number(o.objetivo) }; })
        .filter(function(o) { return o.cod_sede && o.objetivo > 0; });
      if (!objetivos.length) throw new Error('Cargá al menos un objetivo mayor a 0');
    }
    if (!aCerrar && !nueva) throw new Error('Nada para hacer');

    var resultado = { cerrada: aCerrar ? aCerrar.id : null, nueva_id: null };

    if (nueva) {
      // Id correlativo: C1, C2, ... → siguiente número libre
      var maxNum = 0;
      campanas.forEach(function(c) {
        var m = String(c.id).match(/(\d+)$/);
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
      });
      var nuevaId = 'C' + (maxNum + 1);

      var hCamp = SS.getSheetByName('campanas');
      asegurarColumna(hCamp, 'inicio');
      asegurarColumna(hCamp, 'fin');
      var headersCamp = hCamp.getRange(1, 1, 1, hCamp.getLastColumn()).getValues()[0];
      hCamp.appendRow(headersCamp.map(function(col) {
        if (col === 'id') return nuevaId;
        if (col === 'nombre') return nombre;
        if (col === 'estado') return 'activa';
        if (col === 'inicio') return hoy;
        if (col === 'fin') return nueva.fin || '';
        return '';
      }));

      var nombresSede = {};
      getSedesTodas().forEach(function(s) { nombresSede[String(s.cod_sede)] = s.sede; });
      var hObj = SS.getSheetByName('objetivos');
      var headersObj = hObj.getRange(1, 1, 1, hObj.getLastColumn()).getValues()[0];
      var filas = objetivos.map(function(o) {
        return headersObj.map(function(col) {
          if (col === 'campana_id') return nuevaId;
          if (col === 'cod_sede') return o.cod_sede;
          if (col === 'objetivo') return o.objetivo;
          if (col === 'sede') return nombresSede[o.cod_sede] || '';
          if (col === 'campana' || col === 'campaña' || col === 'campana_nombre') return nombre;
          return '';
        });
      });
      hObj.getRange(hObj.getLastRow() + 1, 1, filas.length, headersObj.length).setValues(filas);
      resultado.nueva_id = nuevaId;
    }

    if (aCerrar) {
      var h = SS.getSheetByName('campanas');
      var idxCierre = asegurarColumna(h, 'fecha_cierre');
      var headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
      var idxId = headers.indexOf('id');
      var idxEstado = headers.indexOf('estado');
      var rows = h.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][idxId]) === String(aCerrar.id)) {
          h.getRange(i + 1, idxEstado + 1).setValue('cerrada');
          h.getRange(i + 1, idxCierre + 1).setValue(hoy);
          break;
        }
      }
    }

    var partes = [];
    if (aCerrar) partes.push('Cierre de ' + aCerrar.nombre);
    if (nueva) partes.push('apertura de ' + nombre);
    registrarDeshacer('cerrar_campana', partes.join(' y '),
      { cerrada_id: resultado.cerrada, nueva_id: resultado.nueva_id });

    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════
// DESHACER — registro de operaciones reversibles
// ════════════════════════════════════════════════════════════════════════
// Antes de cada carga de corte y cada cierre de campaña se guarda en la hoja
// 'deshacer' lo necesario para revertirlo (ej: las filas que un reemplazo
// pisó). Se deshace siempre la última operación pendiente, en orden inverso,
// así cada reversión parte del mismo estado que dejó la operación original.
function getDeshacerSheet() {
  var h = SS.getSheetByName('deshacer');
  if (!h) {
    h = SS.insertSheet('deshacer');
    h.getRange(1, 1, 1, 6).setValues([['id', 'fecha_hora', 'accion', 'descripcion', 'datos', 'deshecho']]);
    h.setFrozenRows(1);
  }
  return h;
}

function registrarDeshacer(accion, descripcion, datos) {
  var h = getDeshacerSheet();
  var ahora = new Date();
  var id = String(ahora.getTime());
  var fechaHora = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  // Texto plano: si no, Sheets convierte la fecha_hora en Date
  h.appendRow(["'" + id, "'" + fechaHora, accion, descripcion, JSON.stringify(datos), '']);
}

// Última operación todavía no deshecha, o null
function ultimaDeshacerFila() {
  var h = getDeshacerSheet();
  var rows = h.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (!rows[i][5]) return { fila: i + 1, id: String(rows[i][0]), fecha_hora: String(rows[i][1]), accion: rows[i][2], descripcion: rows[i][3], datos: rows[i][4] };
  }
  return null;
}

function getUltimoDeshacer() {
  var u = ultimaDeshacerFila();
  if (!u) return null;
  return { id: u.id, fecha_hora: u.fecha_hora, accion: u.accion, descripcion: u.descripcion };
}

function borrarFilasDonde(sheet, cond) {
  var rows = sheet.getDataRange().getValues();
  var n = 0;
  for (var i = rows.length - 1; i >= 1; i--) {
    if (cond(rows[i])) { sheet.deleteRow(i + 1); n++; }
  }
  return n;
}

function deshacerUltimo(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var u = ultimaDeshacerFila();
    if (!u) throw new Error('No hay nada para deshacer');
    if (String(body.id) !== u.id) throw new Error('La última operación cambió mientras tanto — recargá la página y volvé a intentar');
    var datos = JSON.parse(u.datos);
    var tz = Session.getScriptTimeZone();
    var seleccionar = null;

    if (u.accion === 'agregar_semana') {
      var hHist = SS.getSheetByName('historial');
      borrarFilasDonde(hHist, function(r) {
        var f = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]);
        return f === datos.fecha && String(r[3] || '') === datos.campana_nombre;
      });
      if (datos.reemplazadas && datos.reemplazadas.length) {
        hHist.getRange(hHist.getLastRow() + 1, 1, datos.reemplazadas.length, 7).setValues(datos.reemplazadas);
      }
      seleccionar = datos.campana_id;
    }
    else if (u.accion === 'cerrar_campana') {
      if (datos.nueva_id) {
        if (getHistorial(datos.nueva_id).length) {
          throw new Error('La campaña nueva ya tiene cortes cargados — deshacé primero esas cargas');
        }
        borrarFilasDonde(SS.getSheetByName('objetivos'), (function() {
          var hdr = SS.getSheetByName('objetivos').getRange(1, 1, 1, SS.getSheetByName('objetivos').getLastColumn()).getValues()[0];
          var idx = hdr.indexOf('campana_id');
          return function(r) { return String(r[idx]) === String(datos.nueva_id); };
        })());
        var hC = SS.getSheetByName('campanas');
        var idxId = hC.getRange(1, 1, 1, hC.getLastColumn()).getValues()[0].indexOf('id');
        borrarFilasDonde(hC, function(r) { return String(r[idxId]) === String(datos.nueva_id); });
      }
      if (datos.cerrada_id) {
        var h = SS.getSheetByName('campanas');
        var headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
        var rows = h.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][headers.indexOf('id')]) === String(datos.cerrada_id)) {
            h.getRange(i + 1, headers.indexOf('estado') + 1).setValue('activa');
            var idxCierre = headers.indexOf('fecha_cierre');
            if (idxCierre !== -1) h.getRange(i + 1, idxCierre + 1).setValue('');
            break;
          }
        }
        seleccionar = datos.cerrada_id;
      }
    }
    else throw new Error('Operación desconocida: ' + u.accion);

    getDeshacerSheet().getRange(u.fila, 6).setValue("'" + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
    SpreadsheetApp.flush();
    return { accion: u.accion, descripcion: u.descripcion, campana_id: seleccionar };
  } finally {
    lock.releaseLock();
  }
}

// Copia completa de la base para descargar como Excel de respaldo
function getBackup() {
  function hoja(nombre) {
    var h = SS.getSheetByName(nombre);
    if (!h) return [];
    var rows = h.getDataRange().getValues();
    var keys = rows[0];
    return rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  }
  return {
    campanas: hoja('campanas'),
    objetivos: hoja('objetivos'),
    historial: hoja('historial'),
    sedes: hoja('sedes'),
    log_envios: hoja('log_envios'),
  };
}

// Vuelve campañas, objetivos e historial al estado de un Excel de backup
// (el que genera getBackup). Sedes y log de envíos no se tocan: son datos de
// contacto y registro de lo que ya se mandó, no el estado de las campañas.
// Todo se valida antes de escribir la primera hoja.
var HOJAS_RESTAURABLES = {
  campanas:  ['id', 'nombre', 'estado'],
  objetivos: ['campana_id', 'cod_sede', 'objetivo'],
  historial: ['fecha', 'cod_sede', 'total'],
};

function restaurarBackup(body) {
  var hojas = body.hojas || {};
  Object.keys(HOJAS_RESTAURABLES).forEach(function(nombre) {
    var filas = hojas[nombre];
    if (!filas || !filas.length) throw new Error('El backup no tiene la hoja "' + nombre + '"');
    var header = filas[0].map(String);
    HOJAS_RESTAURABLES[nombre].forEach(function(col) {
      if (header.indexOf(col) === -1) throw new Error('La hoja "' + nombre + '" del backup no tiene la columna "' + col + '"');
    });
    if (nombre === 'campanas' && filas.length < 2) throw new Error('El backup no tiene ninguna campaña');
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var resumen = {};
    Object.keys(HOJAS_RESTAURABLES).forEach(function(nombre) {
      var filas = hojas[nombre];
      var header = filas[0].map(String);
      var ancho = header.length;
      var datos = filas.slice(1).map(function(f) {
        var fila = [];
        for (var c = 0; c < ancho; c++) fila.push(f[c] === null || f[c] === undefined ? '' : f[c]);
        return fila;
      });
      // El % del historial se guarda como texto '62%', igual que al cargar
      var idxPct = nombre === 'historial' ? header.indexOf('pct') : -1;
      if (idxPct === -1 && nombre === 'historial' && ancho >= 7) idxPct = 6;
      if (idxPct !== -1) {
        var iTot = header.indexOf('total'), iObj = header.indexOf('objetivo');
        datos.forEach(function(f) {
          var tot = Number(f[iTot]) || 0, ob = iObj !== -1 ? Number(f[iObj]) || 0 : 0;
          f[idxPct] = ob > 0 ? Math.round(tot / ob * 100) + '%' : '0%';
        });
      }
      var h = SS.getSheetByName(nombre);
      h.clearContents();
      h.getRange(1, 1, 1, ancho).setValues([header]);
      if (datos.length) h.getRange(2, 1, datos.length, ancho).setValues(datos);
      resumen[nombre] = datos.length;
    });

    // Las operaciones pendientes de deshacer ya no aplican al estado restaurado
    var hD = getDeshacerSheet();
    var rowsD = hD.getDataRange().getValues();
    for (var i = 1; i < rowsD.length; i++) {
      if (!rowsD[i][5]) hD.getRange(i + 1, 6).setValue('anulada por restauración de backup');
    }

    SpreadsheetApp.flush();
    return resumen;
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════════════════
function rowToObj(keys, row) {
  var obj = {};
  keys.forEach(function(k, i) {
    var val = row[i];
    // Normalizar fechas a string YYYY-MM-DD — salvo la columna 'hora', que
    // Sheets guarda como Date con fecha epoch (1899-12-30) y solo la hora
    // importa; formatearla como fecha perdía la hora real (bug histórico).
    if (val instanceof Date) {
      val = (k === 'hora')
        ? Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm:ss')
        : Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    obj[k] = val;
  });
  return obj;
}