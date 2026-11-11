# Continuación: auditoría-fable (pasos 0, 10-estrés y 13)

> Prompt para la próxima sesión de Claude Code, **corriendo en la Mac de Martín**,
> en `~/Documents/GitHub/gestioncomercialMCR`. Borrar este archivo antes del merge a `main`.

## Contexto en dos líneas
La auditoría ya está implementada en la rama `auditoria-fable` (28 commits, pusheada, sin PR):
front (pasos 1–11) y Apps Script (AS-1 a AS-7). **No se desplegó nada.** Falta lo que solo
se puede hacer en la Mac: verificar el Apps Script desplegado, la prueba de estrés con el
Excel real, `clasp push` y el deploy.

## Reglas (no se negocian)
- No tocar `main`: ni push ni merge. No abrir PR salvo que Martín lo pida.
- **`clasp push` sí. `clasp deploy` NO hasta que Martín escriba "deployá".**
- **Nunca crear un deployment nuevo** (cambia la URL `/exec` y rompe la app). Solo actualizar el existente:
  `AKfycbyqeOBpxtYxavx-Uc8mTVRhsqb6HhY6N1RETcvNNVorRuuHMb111XLh_pVYhbSBry4`
- No tocar `apps-script/Utilidades.js` (gitignored, vive solo en la Mac) ni `appsscript.json`.
  No cambiar propiedades del script (secretos).
- `clasp push` reemplaza TODO el proyecto con los archivos de `apps-script/`: si falta un
  archivo localmente, se borra en Google. Por eso el paso 0 compara también `Utilidades.js`.
- Comandos en sintaxis clasp 2. En clasp 3: `list-deployments`, `create-version`, `update-deployment`
  (verificar con `clasp --help`).
- Responder a Martín en español argentino, directo y corto.

## Paso 0 · Verificar que lo desplegado es lo de `main` (antes de subir nada)
```bash
cd ~/Documents/GitHub/gestioncomercialMCR && git fetch origin && git checkout auditoria-fable && git pull
ls apps-script                         # tienen que estar Código.js, Utilidades.js y appsscript.json
clasp show-authorized-user || clasp login --status   # si no hay sesión: frenar y pedirle a Martín `clasp login`
clasp deployments                      # anotar la @versión del ID de arriba → ANTERIOR (para el rollback)
T=$(mktemp -d); cp .clasp.json "$T"; sed -i '' 's#"rootDir": *"apps-script"#"rootDir": "."#' "$T/.clasp.json"
(cd "$T" && clasp pull) && ls "$T"     # si hay archivos además de Código.js, Utilidades.js y appsscript.json: frenar y avisar
git show "origin/main:apps-script/Código.js" > "$T/main.js"
diff --strip-trailing-cr "$T/Código.js" "$T/main.js" && echo "HEAD = main"
diff "$T/Utilidades.js" apps-script/Utilidades.js && echo "Utilidades = copia local"
ANTERIOR=NN; T2=$(mktemp -d); cp "$T/.clasp.json" "$T2"
(cd "$T2" && clasp pull --versionNumber $ANTERIOR) && diff --strip-trailing-cr "$T2/Código.js" "$T/main.js" && echo "desplegado = main"
```
**Si cualquiera de los tres `diff` no da vacío: frenar y mostrarle el diff a Martín.** Los cambios
de AS-1..AS-7 se hicieron sobre el `Código.js` de `main`; si Google tiene otra cosa, hay que
reconciliar antes de pushear.

## Paso 10 · Estrés con el Excel real (valida C3, C4 y C5)
Pedirle a Martín las rutas del Excel nacional real, del backup (.xlsx) y del oráculo (.json):
```bash
npm ci
node scripts/estres-excel-real.mjs "<Excel nacional>" "<backup.xlsx>" "<oraculo.json>"
```
Tiene que terminar sin "silenciosos". Si falla, no seguir: revisar `src/lib/parserCorte.js`.

## Paso 13 · Push y deploy
```bash
node --check apps-script/Código.js && npm test && npm run build
TZ=UTC npm test
clasp push                             # actualiza HEAD; producción sigue en la versión fija
```
Confirmar también el hash de SheetJS (G2), tiene que imprimir `vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw`:
```bash
curl -s https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```
Después **frenar** y pasarle a Martín: el resultado de lo anterior, `git diff origin/main -- apps-script/Código.js`,
y estos comandos con los números reales. **Correrlos solo si escribe "deployá":**
```bash
clasp version "auditoria-fable"        # → NUEVA
clasp deploy -i AKfycbyqeOBpxtYxavx-Uc8mTVRhsqb6HhY6N1RETcvNNVorRuuHMb111XLh_pVYhbSBry4 -V NUEVA -d "auditoria-fable"
clasp deployments                      # el mismo ID, ahora @NUEVA
```
Rollback:
```bash
clasp deploy -i AKfycbyqeOBpxtYxavx-Uc8mTVRhsqb6HhY6N1RETcvNNVorRuuHMb111XLh_pVYhbSBry4 -V ANTERIOR -d "rollback"
```

## Orden de salida (importante)
1. Deploy del backend. Es compatible con el front de producción: las acciones por GET siguen iguales.
2. Martín prueba la app publicada (checklist de abajo).
3. Recién ahí, merge del front a `main` (GitHub Desktop).
**Nunca al revés:** el front nuevo manda los mails por POST (AS-5) y con el backend viejo cada
envío falla con "action no reconocida: enviar_email".

## Checklist para Martín
**Después del deploy, antes del merge** (backend nuevo + front viejo):
- [ ] Entrar a la app publicada: tablero, Sedes e Historial como siempre.
- [ ] Contraseña mal 3 veces: dice "incorrecta", no bloquea (bloquea recién a las 10, por 15 min).
- [ ] "Registro de envíos": se ve el historial de siempre.
- [ ] Cambios esperados ya con el front viejo: las sedes desactivadas salen del corte (AS-6) y
      `log_envios` suma la columna `fecha_corte`.
- [ ] Si algo falla: rollback.

**Después del merge**, primera tanda real: las filas nuevas de `log_envios` tienen `fecha_corte` y
ninguna sede recibió el mail dos veces.

## Qué hay en la rama (para orientarse)
- Envío: la tanda vive en `src/hooks/useSheets.js` (`lanzarTanda`, `enviarSede`, candado `ocupado`);
  lógica pura en `src/lib/envio.js` con pruebas en `scripts/probar-envio.mjs`.
- Lector del Excel: `src/lib/parserCorte.js` + `verificarCorte.js`, pruebas en `scripts/probar-parser.mjs`.
- `npm test` = 78 pruebas (45 lector + 33 envío). CI: `.github/workflows/deploy-pages.yml` corre `npm test`.
- Apps Script: `enviarEmailMake` con candado e idempotencia (`yaSalioEsteMail`), `destinatarioPermitido`,
  tope de login, `chequearEstadoMakeTrigger` que avisa, `agregarSemana` con candado y `perteneceACampana`,
  POST de `enviar_email`/`resumen_cele`, `getSemanaActual` solo con sedes activas, backup con notas y config.

## Decisiones ya tomadas (no re-discutir)
- C5: la regla es +12 h; `22/10 23:59:30` da 23 (la prueba del prompt decía 22, era inconsistente).
- G2: el hash se calculó del archivo de npm 0.18.5 (cdnjs estaba bloqueado en la nube); confirmar con el `curl`.
- AS-1/AS-6: códigos de sede comparados normalizados ("060" = 60).
- Quedan sin arreglo en `npm audit`: esbuild/vite (pide versión mayor) y xlsx (sin fix). No migrar.
