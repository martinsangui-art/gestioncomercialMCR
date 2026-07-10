// ═══════════════════════════════════════════════════════════════════════
// UCASAL — Cómo Vamos · API + utilidades
// ═══════════════════════════════════════════════════════════════════════
//
// Este archivo vive en el editor de Apps Script vinculado a la Google Sheet
// (Extensiones → Apps Script), NO se compila con Vite. Se versiona acá solo
// como referencia/backup — para que tome efecto hay que pegarlo manualmente
// en el editor de Apps Script y volver a implementar (Deploy → Manage
// deployments → Edit → New version).

var SS = SpreadsheetApp.getActiveSpreadsheet();

var AUTH_PASSWORD_HASH = '328e09d18b0a80fe385ef48196d5de1a90333579354eec250ce0f75925bed433';
var AUTH_SECRET = 'ucasal-comovamos-2026-bsas-sead-secreto-interno';
var SESSION_HOURS = 12;

function sha256(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function generarToken() {
  var expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  var expiryStr = String(expiry);
  var firma = sha256(expiryStr + AUTH_SECRET);
  return Utilities.base64EncodeWebSafe(expiryStr) + '.' + firma;
}

function validarToken(token) {
  if (!token || token.indexOf('.') === -1) return false;
  var partes = token.split('.');
  if (partes.length !== 2) return false;
  var expiryStr;
  try { expiryStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString(); }
  catch(e) { return false; }
  var firmaEsperada = sha256(expiryStr + AUTH_SECRET);
  if (firmaEsperada !== partes[1]) return false;
  var expiry = Number(expiryStr);
  if (isNaN(expiry) || Date.now() > expiry) return false;
  return true;
}

function login(password) {
  if (!password) throw new Error('Falta la contraseña');
  var hash = sha256(password);
  if (hash !== AUTH_PASSWORD_HASH) throw new Error('Contraseña incorrecta');
  return { token: generarToken(), expiraEnHoras: SESSION_HOURS };
}

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

function doGet(e) {
  try {
    var action   = e.parameter.action;
    var campana  = e.parameter.campana || null;
    var callback = e.parameter.callback || null;
    var token    = e.parameter.token || null;

    var result;

    if (action === 'login') {
      result = okData(login(e.parameter.password));
    }
    else if (!validarToken(token)) {
      result = { ok: false, error: 'AUTH_REQUIRED' };
    }
    else if (action === 'campanas')      result = okData(getCampanas());
    else if (action === 'sedes')         result = okData(getSedes());
    else if (action === 'objetivos')     result = okData(getObjetivos(campana));
    else if (action === 'historial')     result = okData(getHistorial(campana));
    else if (action === 'semana_actual') result = okData(getSemanaActual(campana));
    else if (action === 'semanas')       result = okData(getSemanas(campana));
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

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (!validarToken(body.token)) return err('AUTH_REQUIRED');

    if (action === 'agregar_semana') return ok(agregarSemana(body));

    return err('action no reconocida: ' + action);
  } catch(ex) {
    return err(ex.message);
  }
}

// ════════════════════════════════════════════════════════════════════════
// EMAIL VIA MAKE
// ════════════════════════════════════════════════════════════════════════
var MAKE_WEBHOOK = 'https://hook.us2.make.com/89qke1tmwlaa6nq2b9ald1ioawcris35';

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

// ── Resumen a Cele — DESACTIVADO (20/06/2026) ────────────────────────────
// MailApp siempre manda desde la cuenta dueña del script (martinsangui@gmail.com)
// no desde mcrossi@ucasal.edu.ar. Cele ve el resumen en "Historial de envíos" en la web.
// Reactivar configurando un escenario de Make con el módulo Gmail de Cele.
var EMAIL_CELE = 'mcrossi@ucasal.edu.ar';

function enviarResumenCele(payload) {
  return { enviado: true, nota: 'Envío de resumen por mail desactivado — ver Historial de envíos en la web' };
}

// ════════════════════════════════════════════════════════════════════════
// LOG DE ENVÍOS
// ════════════════════════════════════════════════════════════════════════
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
  data.reverse();
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
  return rows.slice(1).map(function(r) { return rowToObj(keys, r); });
}

var SEDES_EXCLUIDAS = ['57']; // 57 = MORÓN (desvinculada)

function getSedes() {
  var h = SS.getSheetByName('sedes');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  return data.filter(function(r) { return SEDES_EXCLUIDAS.indexOf(String(r.cod_sede)) === -1; });
}

function getObjetivos(campanaId) {
  var h = SS.getSheetByName('objetivos');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  if (campanaId) data = data.filter(function(r) { return r.campana_id === campanaId; });
  data = data.filter(function(r) { return SEDES_EXCLUIDAS.indexOf(String(r.cod_sede)) === -1; });
  return data;
}

function getHistorial(campanaId) {
  var h = SS.getSheetByName('historial');
  var rows = h.getDataRange().getValues();
  var keys = rows[0];
  var data = rows.slice(1).map(function(r) { return rowToObj(keys, r); });
  if (campanaId) {
    var campanas = getCampanas();
    var campObj = campanas.filter(function(c){ return c.id === campanaId; })[0];
    var nombreExacto = campObj ? campObj.nombre : null;
    data = data.filter(function(r) {
      var val = String(r['campaña'] || r['campana'] || r[3] || '');
      if (nombreExacto) return val === nombreExacto || val.indexOf(nombreExacto) >= 0;
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
  var fechas = {};
  hist.forEach(function(r) { fechas[r.fecha] = true; });
  var sorted = Object.keys(fechas).sort();
  var ultima = sorted[sorted.length - 1];
  var anterior = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  var actual = hist.filter(function(r) { return r.fecha === ultima; });

  var prevMap = {};
  if (anterior) {
    hist.filter(function(r) { return r.fecha === anterior; })
        .forEach(function(r) { prevMap[String(r.cod_sede)] = r.total; });
  }

  var objMap = {};
  getObjetivos(campanaId).forEach(function(o) {
    objMap[String(o.cod_sede)] = Number(o.objetivo);
  });

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
  var campanaId     = body.campana_id;
  var campanaNombre = body.campana_nombre;
  var fecha         = body.fecha;
  var sedes         = body.sedes;
  var reemplazar    = body.reemplazar === true;

  if (!fecha || !sedes || !sedes.length) throw new Error('Faltan datos: fecha y sedes son requeridos');

  // Verificar si ya existe esa fecha para esa campaña
  var hist = getHistorial(campanaId);
  var fechasExistentes = {};
  hist.forEach(function(r) { fechasExistentes[r.fecha] = true; });

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

  var filas = sedes.map(function(s) {
    var cod   = String(s.cod);
    var total = Number(s.total) || 0;
    var obj   = objMap[cod] || 0;
    var pct   = obj > 0 ? Math.round(total / obj * 100) + '%' : '0%';
    return [fecha, cod, s.sede, campanaNombre, total, obj, pct];
  });

  var lastRow = hHist.getLastRow();
  hHist.getRange(lastRow + 1, 1, filas.length, 7).setValues(filas);

  return { insertadas: filas.length, fecha: fecha, campana: campanaId, reemplazado: reemplazar };
}

// ════════════════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════════════════
function rowToObj(keys, row) {
  var obj = {};
  keys.forEach(function(k, i) {
    var val = row[i];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    obj[k] = val;
  });
  return obj;
}
