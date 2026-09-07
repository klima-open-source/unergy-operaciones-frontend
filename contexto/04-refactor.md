# Refactor de `app/` — auditoría del estado real y plan de ejecución

**Fecha de la auditoría: 2026-08-31.** Todos los números de este documento se midieron hoy
contra `main` (`4d4badb`) con los comandos que van citados al lado. Si vuelves a este archivo
más adelante, vuelve a correrlos antes de creerte la cifra.

Este documento **no reemplaza** a [`03-roadmap.md`](./03-roadmap.md): la estrategia de migración
por rebanadas verticales, el orden de las olas y la receta por slice siguen siendo los de ahí.
Lo que hace es tres cosas que ese archivo ya no puede hacer:

1. **Corregir su tabla de métricas**, que está desactualizada en las tres cifras que más importan
   y llevaría a ejecutar contra números falsos.
2. **Insertar dos fases delante de la ola 2** — una de vuelta a verde, otra de fundaciones que
   nunca se construyeron — porque sin ellas cada slice que se migre va a improvisar lo mismo 22
   veces.
3. **Convertirlo en un listado de tareas** con identificador, dependencia y comando de
   verificación, en vez de prosa.

---

## 1. El titular

**La base está en rojo, y la regla que dice que no puede estarlo es la última línea de
`AGENTS.md`.**

| Comando             | Resultado hoy                                  |
| ------------------- | ---------------------------------------------- |
| `bun run test`      | ❌ 1 archivo falla (227 tests pasan, 0 fallan) |
| `bun run typecheck` | ❌ 3 errores                                   |
| `bun run lint`      | ❌ 248 errores, 2.128 warnings                 |

Los 3 errores de tipos y el archivo de test caído **tienen una única causa**:
`app/features/auth/schemas.ts` usa `z.email()`, que es la API de zod 4, importando desde la raíz
de `zod`, que está pinneado en `3.25.76`. En esa versión el namespace v4 vive en `zod/v4`. Un
carácter de import y se cierran los dos.

Que un fallo de una línea lleve días sin verse es el hallazgo real: **no hay nada que impida
mergear con la base en rojo**, y eso ya tuvo consecuencias visibles (§2).

---

## 2. Regresiones sobre trabajo declarado completo

`03-roadmap.md` declara `0` en dos invariantes de la ola 0. Hoy no lo son:

| Invariante               | Declarado | Hoy   | Dónde volvió a entrar                              |
| ------------------------ | --------- | ----- | -------------------------------------------------- |
| Apariciones de `pi pi-*` | 0         | **7** | `PanelContableView.vue` (5), `ConsumoView.vue` (2) |
| Llamadas a `toast.add(`  | 0         | **5** | `PanelContableView.vue` (5)                        |

Ninguna de las dos rompe el build, ninguna rompe un test, ninguna la ve el linter. `primeicons`
está desinstalado, así que esos 7 iconos **no se renderizan**: son cuadros vacíos en producción
ahora mismo. Y `toast.add` sobre el `toast` de sonner es un `TypeError` en runtime en el momento
en que el usuario dispare esa acción del panel contable.

Esto es lo que justifica la tarea `R0-4`: los invariantes ganados se fijan con un test, no con
una nota en un `.md`.

---

## 3. Deuda estructural, medida

### 3.1 La regla número uno de `AGENTS.md`, incumplida a escala

> «**Services** son los únicos responsables de llamadas a la API desde el cliente. Nada de
> `$fetch` directo en componentes o composables.»

```sh
grep -rno "api\.\(get\|post\|put\|patch\|delete\)(" app --include='*.vue' | wc -l   # 594
grep -rln "core/client" app --include='*.vue' | wc -l                              # 112
find app/features -path '*/services/*' -name '*.ts' | wc -l                        #   9
```

**594 llamadas HTTP dentro de 112 componentes `.vue`.** La letra de la regla se cumple —hay
`$fetch` directo en cero sitios— porque el transporte es la instancia de axios de
`~/core/client.ts`, no `$fetch`. El espíritu no: la ruta de API, el tipo de la respuesta y el
manejo del error viven dentro del template que los pinta.

Existen 9 services, en 6 de 22 slices. Los cuatro slices más grandes —`finanzas` (11.694
líneas), `operaciones` (11.168), `contratos` (10.859), `mem` (9.942)— suman **2 services entre
los cuatro**.

Y las rutas son magic strings, también prohibidos explícitamente. Las más repetidas:
`` `/fallas/…` `` ×51, `` `/proyectos/…` `` ×37, `` `/clientes/…` `` ×26, `'/contratos-servicio'`
×17, `'/monitoreo/_legacy'` ×17.

### 3.2 TypeScript: 278 archivos fuera

```sh
grep -rL 'lang="ts"' app --include='*.vue' | grep -v '^app/components/ui/' | wc -l   # 255
find app -name '*.js' | wc -l                                                       #  23
```

Y solo **7 de 22 slices tienen `types.ts`** — `auth`, `finanzas`, `fronteras`, `garantias`,
`liquidaciones`, `notificaciones`, `proyectos`, y de esos `notificaciones` no tiene ni un
componente. Hay además 23 `interface`/`type` declarados inline dentro de `.vue`, que la regla
prohíbe.

El lado bueno: **1 solo `any` en todo `app/`** (en `middleware/auth.global.ts`). Esa regla sí se
está respetando, y es la que más cuesta.

### 3.3 Las piezas del template no se están usando

Aquí está la deuda más cara que nadie ha nombrado todavía:

| Pieza del template             | Usos hoy      |
| ------------------------------ | ------------- |
| `useQuery`                     | **0**         |
| `AsyncView`                    | **1**         |
| `usePagination` / `useFilters` | **2**         |
| `useState`                     | 5 composables |

Mientras tanto, **60 componentes de feature declaran su propio par `loading`/`error` a mano**, y
**5 componentes tienen su propia función `toast()`** con un `ref` y CSS `position: fixed`
(`LiquidacionPdfView`, `InformesMensualesPanel`, `PortafoliosGestionPanel`, `EnvioMensualPanel`,
`InformeDetailView` — ya anotados en §3.2.2 de `03-roadmap.md` como fuera de alcance).

Si las olas 2–7 se ejecutan sin resolver esto primero, el resultado es 112 componentes en
TypeScript con la misma deuda de estado asíncrono que tienen hoy. **Migrar el lenguaje sin
migrar el patrón es pintar sobre óxido.**

### 3.4 Componentes: 22 mini-proyectos

```sh
find app/features -name '*.vue' -exec wc -l {} + | awk '$1>1000' | wc -l   # 22
```

| Umbral         | Archivos |
| -------------- | -------- |
| > 2.000 líneas | 4        |
| > 1.000        | 22       |
| > 600          | 39       |
| > 400          | 64       |
| > 200          | 111      |

Media: **492 líneas por componente de feature** (173 archivos, 85.164 líneas). La receta dice
que a partir de 400 se parte. Eso son 64 archivos, no una excepción.

Los cuatro monstruos: `CumplimientoV2View.vue` (5.424), `MonitoreoView.vue` (2.990),
`GeneracionSolarView.vue` (2.891), `OperacionView.vue` (2.463 — y es el que obliga a mantener
`vue.runtimeCompiler`).

### 3.5 Estilos: los tokens de marca no existen todavía

```sh
grep -rno 'style="' app --include='*.vue' | grep -v '^app/components/ui/' | wc -l   # 4.315
grep -rno '#[0-9a-fA-F]\{6\}\b' app --include='*.vue' --include='*.ts' | wc -l      # ~6.400
```

`@theme` con la paleta Unergy es el primer punto de la ola 0 y sigue sin hacerse. Cada hex
suelto es también un bloqueo para la CSP estricta que quiere la ola 8 (`style-src` no puede
cerrarse con 4.315 atributos `style=` inline).

### 3.6 PrimeVue: 114 archivos, y una pieza que no tiene destino

```sh
grep -rl "from 'primevue" app | wc -l   # 114
```

686 imports de componentes concretos. Por frecuencia real:

| PrimeVue                 | Imports | Destino                      |
| ------------------------ | ------- | ---------------------------- |
| `Button`                 | 91      | `ui/button`                  |
| `InputText`              | 58      | `ui/input`                   |
| `Select` + `Dropdown`    | 60      | `ui/select`                  |
| `Dialog`                 | 49      | `ui/dialog`                  |
| `InputNumber`            | 39      | `ui/number-field`            |
| **`DataTable`+`Column`** | **66**  | **no existe** ← ver §4       |
| `Textarea`               | 29      | `ui/textarea`                |
| `DatePicker`+`Calendar`  | 30      | `ui/calendar` + `ui/popover` |
| `IconField`+`InputIcon`  | 50      | `ui/input-group`             |
| `ProgressSpinner`        | 25      | `ui/spinner` / `AsyncView`   |
| resto                    | 60      | según tabla de `03-roadmap`  |

### 3.7 Dependencias: tres librerías de Excel y dos de gráficas

| Librería                 | Archivos | Nota                                                                                                                                     |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `xlsx` (0.18.5)          | 37       | La versión del registro npm está sin mantener y arrastra CVEs conocidas (prototype pollution, ReDoS). El autor publica en su propio CDN. |
| `xlsx-js-style`          | 9        | Fork de `xlsx` — duplica el mismo motor para poder dar estilo                                                                            |
| `exceljs`                | 1        | Tercer motor, para un solo archivo                                                                                                       |
| `chart.js`+`vue-chartjs` | 11       | Decisión abierta en `03-roadmap` §3.5                                                                                                    |
| `@unovis/vue`            | 1        | Lo que trae el template                                                                                                                  |

Además: **14 imports estáticos** de librerías pesadas (`xlsx`, `jspdf`, `pdfjs-dist`, `jszip`,
`maplibre-gl`) que entran al bundle inicial de una SPA sin SSR, y `eslint` + `@nuxt/eslint`
declaradas en `dependencies` en vez de `devDependencies`.

### 3.8 Un `ref` de módulo, y por qué esta vez no es un incidente

`app/features/garantias/components/AjustesXM/composables/useGarantiasHistorial.js:57-59` declara
`historial`, `loading` y `errorMsg` como `ref` a nivel de módulo. `AGENTS.md` marca esto como la
única regla cuya violación es un incidente de seguridad — **pero solo bajo SSR**, y hoy
`ssr: false`. En cliente el módulo es un singleton por pestaña, así que el efecto real es estado
que sobrevive entre navegaciones, no fuga entre usuarios.

Sigue siendo una bomba con temporizador: la ola 8 contempla encender SSR página por página, y el
día que esa página se encienda, esto pasa de molestia a incidente. Va arreglado en la ola de
`garantias`, no antes.

### 3.9 Cobertura de tests

16 archivos de test para ~115.000 líneas. El reparto no sigue el riesgo: los cuatro slices más
grandes (43.663 líneas entre ellos) tienen 2 tests en total, y `contratos` —10.859 líneas,
incluido el wizard de PPA— tiene cero.

Lo que sí está bien cubierto es la infraestructura: `errors`, `logger`, `permissions`, `access`,
`redirect`, `guard`, `auth-api`, `endpoints.guard`. Eso es exactamente lo que hay que proteger.

### 3.10 Restos que sobran

- 30 `console.*` sueltos (la regla dice `logger.error(scope, err)`).
- 161 `Intl.NumberFormat`/`toLocaleString` fuera de `app/utils/`, más 6 `formatDate` y 2
  `formatCurrency` redefinidos.
- `app/components/blocks/ContactosPanel.vue:90` importa `~/core/client`: un componente de
  `blocks/` no debería conocer la API (`blocks/` es genérico, la llamada va en el slice).
- `app/stores/` está vacío. Borrar.
- `app/data/ipc_rates.js` y `app/features/contratos/data/arriendos_data.js`: datos en `.js`.

---

## 4. El cuello de botella: la tabla de datos

**Esta es la tarea que desbloquea el 70% del resto y sigue sin empezar.**

```sh
grep -ro "<DataTable" app | wc -l                    # 54 ocurrencias
grep -rl "primevue/datatable" app/features | wc -l   # 33 archivos, en 15 de 22 slices
```

`03-roadmap.md` ya lo advirtió, con estas palabras: «Hay que **decidir y construir esto antes de
la ola 2**. Si esta pieza no está resuelta, cada slice la improvisará distinta y la migración se
degrada.» Sigue igual, y ninguna ola de slices puede cerrarse sin ella.

Lo que hay que cubrir, sacado de los 54 usos reales: paginación (perezosa y en cliente),
ordenamiento por columna y multi-columna (`sortMode`), filtros por columna, `rowHover`,
`rowsPerPageOptions`, plantillas por celda, `emptyMessage`, selección de fila, columnas
congeladas y `ColumnGroup`/`Row` (un uso cada uno).

**La decisión que hay que tomar antes de escribir código** es TanStack Table (`@tanstack/vue-table`,
dependencia nueva, headless, resuelve orden/filtro/paginación/agrupación y es lo que usa el
`DataTable` de shadcn-vue) contra componer a mano sobre `ui/table` + `usePagination` +
`useFilters`. Con 54 usos y esa lista de capacidades, TanStack es la respuesta razonable y
`AGENTS.md` la contempla («no introduzcas dependencias nuevas **sin necesidad clara**»; 54 tablas
con orden y filtro es necesidad clara). Pero es una decisión de arquitectura y la firma el humano.

---

## 5. Seguridad

### 5.1 `/api/v1/evo/*` es un proxy sin autenticar que presta un token del servidor

`server/routes/api/v1/evo/[...path].ts` inyecta `evoApiToken` server-side, y ese es su motivo de
existir. Pero:

- `server/middleware/auth.ts` retorna temprano cuando `authSessionCookiesEnabled` es `false`
  (lo es, en `nuxt.config.ts`), así que **nunca resuelve una sesión** y `event.context.user`
  queda vacío.
- Ninguna ruta de `server/routes/` llama a `requirePermission` (verificado: `grep -rn
requirePermission server/routes/` → vacío).
- `server/api/endpoints.guard.test.ts` no lo detecta porque su `import.meta.glob('./**/*.ts')`
  se ancla en `server/api/`, y esto vive en `server/routes/`.

Resultado: cualquiera que alcance el Worker desplegado puede hacer `GET /api/v1/evo/clima/forecast`
sin sesión y consumir la cuota de EVO con nuestro token. El impacto es acotado —EVO sirve precio
de bolsa y clima, no datos de clientes— pero es un endpoint que presta credenciales a anónimos, y
el guard que debería haberlo pillado tiene un punto ciego estructural.

Los otros dos proxies (`/api/v1/[...path]` y `/monitoreo/[...path]`) **no** tienen este problema:
reenvían el `Authorization` del navegador y el backend autoriza. Conviene dejarlo escrito para
que nadie "arregle" lo que no está roto.

### 5.2 Token en `localStorage`

Documentado a conciencia en `app/core/security.ts` y bloqueado por el backend (no expone
`/auth/me`). No es una tarea de este refactor; es una tarea de backend con un seguimiento en el
frontend que ya está montado y dormido.

---

## 6. Plan

La estrategia de `03-roadmap.md` es correcta y no se toca. Lo que cambia es que **se insertan dos
fases antes de la ola 2**, y que la receta por slice gana dos pasos.

```
R0 · Volver a verde y clavarlo        ← ~1 día. No toca producto.
R1 · Las fundaciones que faltan       ← el desbloqueo real. Nada visible para el usuario.
R2…R7 · Las olas de slices            ← las de 03-roadmap §3.4, con la receta ampliada
R8 · Retirada                         ← la de 03-roadmap §3.5
```

### La receta por slice, ampliada

A los 9 pasos de `03-roadmap.md` §3.1 se les añaden dos, que son los que evitan repetir la deuda:

- **2b. La capa de datos usa `useQuery`/`AsyncView`.** Un service no basta: si el componente
  sigue con su `loading`/`error` a mano, se ha movido la llamada sin quitar el patrón. Un slice
  no está migrado mientras tenga un `const loading = ref(false)` propio.
- **4b. La tabla es `blocks/DataTable`.** Cero `<DataTable>` de PrimeVue y cero `<table>` a mano
  en el slice.

### Cómo se mide, corregido

Sustituye a la tabla de `03-roadmap.md` §3.6, que está desactualizada:

| Métrica                                             | Inicio | Hoy (31-ago) | Meta |
| --------------------------------------------------- | ------ | ------------ | ---- |
| Archivos en `app/legacy/`                           | 237    | 0            | 0    |
| Archivos que importan `primevue`                    | 120    | **114**      | 0    |
| Apariciones de `pi pi-*`                            | 1.822  | **7** ⚠️     | 0    |
| Llamadas a `toast.add(`                             | 557    | **5** ⚠️     | 0    |
| Llamadas a `confirm.require(`                       | 20     | 0            | 0    |
| Archivos sin TypeScript (`.vue` sin `lang` + `.js`) | 278    | **278**      | 0    |
| Llamadas a la API dentro de un `.vue`               | 594    | **594**      | 0    |
| Slices con `types.ts`                               | 0      | **7**        | 22   |
| Slices con al menos un service                      | 0      | **6**        | 22   |
| Usos de `useQuery`                                  | 0      | **0**        | ≥22  |
| Componentes con `loading`/`error` propio            | 60     | **60**       | 0    |
| Componentes > 400 líneas                            | 64     | **64**       | ~0   |
| Atributos `style=` inline                           | 4.315  | **4.315**    | ~0   |
| `<DataTable>` de PrimeVue                           | 54     | **54**       | 0    |
| Rutas en `AUTH_ROUTE_PERMISSIONS`                   | 1      | **35**       | ~67  |
| `console.*` sueltos                                 | 30     | **30**       | 0    |
| Slices que cumplen la receta completa               | 0      | **0**        | 22   |

Los comandos, desde la raíz:

```sh
grep -rl "from 'primevue" app | wc -l
grep -ro "pi pi-" app | wc -l
grep -ro "toast\.add(" app | wc -l
grep -rL 'lang="ts"' app --include='*.vue' | grep -v '^app/components/ui/' | wc -l
grep -rno "api\.\(get\|post\|put\|patch\|delete\)(" app --include='*.vue' | wc -l
grep -rln "useQuery(" app --include='*.vue' | wc -l
grep -rlc "const loading = ref(\|const cargando = ref(" app/features --include='*.vue' | wc -l
find app/features -name '*.vue' -exec wc -l {} + | awk '$1>400' | wc -l
grep -rno 'style="' app --include='*.vue' | grep -v '^app/components/ui/' | wc -l
grep -ro "<DataTable" app | wc -l
```

---

## 7. Tareas

Prioridad: **P0** bloquea todo lo demás · **P1** desbloquea las olas · **P2** va en la ola del
slice · **P3** cierre.
Tamaño: **S** < media sesión · **M** una sesión · **L** varias · **XL** sub-proyecto con plan propio.

### Fase R0 · Volver a verde y clavarlo

| ID    | P   | T   | Tarea                                                                                                                                                                                                                                              | Verificación                              |
| ----- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| R0-1  | P0  | S   | `app/features/auth/schemas.ts`: importar de `zod/v4` (o subir `zod` a 4.x y revisar el resto). Arregla los 3 errores de tipos y el test caído de una vez.                                                                                          | `bun run typecheck && bun run test`       |
| R0-2  | P0  | S   | Reponer los 7 `pi pi-*` a iconos de `@lucide/vue` en `PanelContableView.vue` y `ConsumoView.vue`. **Hoy son cuadros vacíos en producción.**                                                                                                        | `grep -ro "pi pi-" app \| wc -l` → 0      |
| R0-3  | P0  | S   | Reponer las 5 `toast.add(` de `PanelContableView.vue` a la API de sonner. **Hoy son `TypeError` en runtime.**                                                                                                                                      | `grep -ro "toast\.add(" app \| wc -l` → 0 |
| R0-4  | P0  | M   | **Test de invariantes de migración**: un `.test.ts` que barre `app/` y falla si aparece `pi pi-`, `toast.add(`, `confirm.require(`, `$fetch` en un `.vue`, o un `ref` de módulo en un composable. Es lo que evita que R0-2 y R0-3 vuelvan a pasar. | el test existe y pasa                     |
| R0-5  | P0  | S   | `bun run lint --fix`: se van 32 errores y 2.115 warnings sin decisión humana.                                                                                                                                                                      | `bun run lint` baja a ~216 errores        |
| R0-6  | P0  | M   | Los 216 errores de lint restantes, por regla: 129 `no-unused-vars`, 29 `no-dynamic-delete`, 23 `import/first`, 18 `no-unused-expressions`, 16 `import/no-duplicates`, 12 `no-useless-escape`. Casi todos son borrar código muerto.                 | `bun run lint` → 0 errores                |
| R0-7  | P1  | S   | Los 2.113 warnings restantes: `vue/attribute-hyphenation` y `vue/attributes-order` sobre props de PrimeVue. **Decidir**: silenciarlos hasta que PrimeVue salga, o arreglarlos. Un lint con 2.000 warnings no informa de nada.                      | decisión escrita + `bun run lint` legible |
| R0-8  | P0  | S   | Hook de pre-push (ya hay `husky`) que corre `typecheck` + `test`. Es la razón por la que R0-1 pudo vivir en `main`.                                                                                                                                | `git push` falla con la base en rojo      |
| R0-9  | P1  | S   | Mover `eslint` y `@nuxt/eslint` a `devDependencies`.                                                                                                                                                                                               | `bun run build` sigue verde               |
| R0-10 | P1  | S   | Borrar `app/stores/` (vacío).                                                                                                                                                                                                                      | —                                         |

**Criterio de salida de R0:** `lint`, `typecheck`, `test`, `format:check` y `build` en verde, y un
hook que lo mantenga así.

### Fase R1 · Fundaciones (bloquean las olas 2–7)

| ID    | P      | T     | Tarea                                                                                                                                                                                                                                                                                                         | Verificación                                                      |
| ----- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| R1-1  | P0     | S     | **Cerrar la brecha del EVO** (§5.1): exigir sesión en `server/routes/api/v1/evo/[...path].ts` antes de inyectar el token.                                                                                                                                                                                     | petición sin sesión → 401                                         |
| R1-2  | P0     | M     | Extender `endpoints.guard.test.ts` para que también escanee `server/routes/`, con la lista explícita de excepciones justificadas (los proxies que reenvían el `Authorization` del navegador). Es el punto ciego que dejó pasar R1-1.                                                                          | el test cubre las 5 rutas de `server/routes/`                     |
| R1-3  | **P0** | **L** | **Decidir** TanStack Table vs composición a mano (§4) y **construir `app/components/blocks/DataTable.vue`** cubriendo las capacidades de los 54 usos reales. **Nada de la ola 2 puede empezar antes.**                                                                                                        | el componente existe, con test de orden/filtro/paginación         |
| R1-4  | P0     | M     | Tokens de marca en `@theme` (`assets/css/tailwind.css`): paleta Unergy + semánticos (éxito `#2e7d32`, déficit `#D64455`, exceso `#F0C040`, apagados, bordes). A partir de aquí un hex en un `style=` es error de revisión.                                                                                    | los tokens existen y `legacy-theme.css` se puede empezar a vaciar |
| R1-5  | P0     | M     | **Fijar el patrón de datos de referencia**: migrar un slice pequeño entero (`alertas`, 332 líneas, 2 componentes) a service + `types.ts` + `useQuery` + `AsyncView` + `DataTable`, y **documentarlo como el ejemplo canónico** al que apuntan las 21 olas restantes. Sin esto, cada slice inventa su versión. | `alertas` cumple la receta ampliada de 11 pasos                   |
| R1-6  | P1     | M     | Formato en `app/utils/`: `formatearMoneda`, `formatearFecha`, `formatearNumero`, `formatearPorcentaje`. Absorben los 161 `Intl.NumberFormat`/`toLocaleString` sueltos y los 8 formateadores redefinidos. Codemod.                                                                                             | `grep -c toLocaleString` fuera de `utils/` → ~0                   |
| R1-7  | P1     | M     | Utilidades de exportación (`exportarExcel`, PDF, ZIP) como módulos `client-only` con import dinámico. Se lleva por delante los 14 imports estáticos de libs pesadas.                                                                                                                                          | `xlsx`/`jspdf`/`pdfjs` fuera del chunk de entrada                 |
| R1-8  | P1     | M     | **Decidir y ejecutar la consolidación de Excel**: `xlsx` (37 archivos) + `xlsx-js-style` (9) + `exceljs` (1) → una. `xlsx` 0.18.5 del registro npm arrastra CVEs; `exceljs` cubre estilo y es la única de las tres que se mantiene ahí.                                                                       | una sola librería de Excel en `package.json`                      |
| R1-9  | P1     | M     | Tipos base del dominio en `app/types/`: `Contrato`, `Falla`, `Liquidacion`, `Frontera`, `Inversionista` + los `enum` de estados (ya están `Cliente`, `Proyecto`, `User`). Los comparten varios slices y hoy no existen.                                                                                       | los tipos existen, con `README.md` de `types/` actualizado        |
| R1-10 | P1     | S     | Unificar los 5 `function toast()` hechos a mano con sonner. Ojo con `LiquidacionPdfView`: su toast se oculta con `@media print` y uno en portal no hereda esa regla.                                                                                                                                          | `grep -rl "function toast(" app` → vacío                          |
| R1-11 | P1     | S     | Los 30 `console.*` → `logger.error(scope, err)` / borrar.                                                                                                                                                                                                                                                     | `grep -c 'console\.' app` fuera de `ui/` → 0                      |
| R1-12 | P1     | S     | Sacar la llamada a la API de `blocks/ContactosPanel.vue`: `blocks/` es genérico y no habla con el backend.                                                                                                                                                                                                    | `grep -rn "core/client" app/components` → vacío                   |
| R1-13 | P2     | M     | **Decidir** `chart.js` (11 archivos) vs `@unovis/vue` (1). Decisión abierta desde la ola 0; con 11 archivos y gráficas ya funcionando, documentar la excepción es una respuesta legítima.                                                                                                                     | decisión escrita en este archivo                                  |
| R1-14 | P2     | S     | Tabla de equivalencias PrimeVue → Gandalf/shadcn revisada contra los imports reales (§3.6) y publicada donde el que migra un slice la vea.                                                                                                                                                                    | la tabla está en `03-roadmap` §3.2 corregida                      |

**Criterio de salida de R1:** `alertas` migrado entero como referencia, `DataTable` en producción,
tokens activos y el hueco del guard cerrado.

### Fases R2–R7 · Las olas de slices

El orden de `03-roadmap.md` §3.4 se mantiene. Cada slice es una tarea `R<ola>-<slice>` y se cierra
con la receta ampliada de 11 pasos + `lint`/`typecheck`/`test` + humo.

| Ola | Slices                                                                                                                  | Líneas | T   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| R2  | `clientes` (1.494), `proyectos` (3.598), `contratos` (10.859), `operadores-red` (1.135), `retos` (4.406), `admin` (638) | 22.130 | L   |
| R3  | `fallas` (8.259), `operaciones` (11.168), `solar` (4.949), `alertas` (hecho en R1-5)                                    | 24.376 | L   |
| R4  | `fronteras` (3.577), `registros-cnd` (802), `mem` (9.942), `garantias` (3.866)                                          | 18.187 | L   |
| R5  | `liquidaciones` (5.629), `panel-contable` (1.877), `finanzas` (11.694)                                                  | 19.200 | XL  |
| R6  | `comercial` (3.982)                                                                                                     | 3.982  | M   |
| R7  | `mobile` (4.646)                                                                                                        | 4.646  | M   |
| —   | `dashboard` (346), `notificaciones` (56)                                                                                | 402    | S   |

Sub-proyectos con plan propio, dentro de su ola:

| Archivo                                  | Líneas | Ola | Nota                                                                            |
| ---------------------------------------- | ------ | --- | ------------------------------------------------------------------------------- |
| `mem/CumplimientoV2View.vue`             | 5.424  | R4  | desglose por sus 7 pestañas                                                     |
| `fallas/MonitoreoView.vue`               | 2.990  | R3  | mapas + tiempo real                                                             |
| `solar/GeneracionSolarView.vue`          | 2.891  | R3  |                                                                                 |
| `contratos/OperacionView.vue`            | 2.463  | R2  | **aquí se retira `vue.runtimeCompiler`** (8 componentes con `template:` string) |
| `operaciones/InformesMensualesPanel.vue` | 1.972  | R3  |                                                                                 |
| `operaciones/GestionFallasView.vue`      | 1.948  | R3  |                                                                                 |
| `panel-contable/PanelContableView.vue`   | 1.877  | R5  | el de las regresiones de §2                                                     |
| `contratos/ServiciosUnificadoView.vue`   | 1.792  | R2  | pantalla de entrada real del producto                                           |
| `contratos/ContratoDetailView.vue`       | 1.714  | R2  |                                                                                 |
| `proyectos/ProyectoDetailView.vue`       | 1.428  | R2  |                                                                                 |

Tareas transversales que se resuelven dentro de la ola de su slice, no antes:

| ID   | P   | Tarea                                                                              | Ola     |
| ---- | --- | ---------------------------------------------------------------------------------- | ------- |
| RX-1 | P2  | El `ref` de módulo de `useGarantiasHistorial.js` (§3.8)                            | R4      |
| RX-2 | P2  | Completar `AUTH_ROUTE_PERMISSIONS` de 35 a las ~67 rutas reales                    | por ola |
| RX-3 | P2  | Los 23 tipos inline en `.vue` → `types.ts` del slice                               | por ola |
| RX-4 | P2  | Tests de la lógica pura de cada slice (hoy: 2 tests para los 4 slices más grandes) | por ola |

### Fase R8 · Retirada

La lista de `03-roadmap.md` §3.5, con el estado corregido:

| ID   | P   | Tarea                                                                                               |
| ---- | --- | --------------------------------------------------------------------------------------------------- |
| R8-1 | P3  | Desinstalar `primevue`, `@primevue/themes`, `axios`, `vuedraggable`                                 |
| R8-2 | P3  | Borrar `app/core/client.ts`, `app/core/legacy-service.ts` y `app/plugins/legacy-primevue.client.ts` |
| R8-3 | P3  | Retirar `vue.runtimeCompiler` (depende de R2/`OperacionView`)                                       |
| R8-4 | P3  | Retirar `layouts/legacy.vue`, `layouts/legacy-blank.vue` y `assets/main.css`                        |
| R8-5 | P3  | `import.meta.env.VITE_*` → `runtimeConfig`                                                          |
| R8-6 | P3  | Reevaluar SSR página por página (páginas de lectura sí, el resto no)                                |
| R8-7 | P3  | CSP en modo bloqueo (depende de que los 4.315 `style=` estén en ~0)                                 |
| R8-8 | P3  | Auto-hospedar fuentes de Google y `pdf.js` para cerrar `script-src`/`font-src`                      |
| R8-9 | P3  | Borrar `legacy/` (139.840 líneas) y las 4 decisiones abiertas de `02-specs.md` §20                  |

---

## 8. Los tres riesgos que hundirían esto

1. **Empezar por las olas y no por R1.** Es el riesgo que ya se materializó una vez: la ola 0
   dejó `DataTable`, tokens y capa de datos sin construir, y por eso hoy hay 594 llamadas a la
   API en componentes y 0 usos de `useQuery`. Migrar un slice sin esas piezas produce un slice
   en TypeScript con la misma deuda. **R1-3 y R1-5 son la puerta.**

2. **Confundir «en TypeScript» con «migrado».** Es exactamente lo que la receta de 11 pasos
   existe para evitar, y la tentación es fuerte porque `lang="ts"` se mide fácil y la calidad no.
   La métrica honesta es «slices que cumplen la receta completa»: hoy 0 de 22.

3. **Mergear en rojo.** 248 errores de lint, 3 de tipos y un test caído convivieron con la base
   el tiempo suficiente para que 7 iconos rotos y 5 `TypeError` llegaran a producción. R0-4 y
   R0-8 no son burocracia: son la única razón por la que el resto del plan es verificable.

---

## 9. Lo que este plan deliberadamente no hace

- **No toca la API.** Sigue vigente la restricción de `01-contexto.md` §7.
- **No arregla el token en `localStorage`.** Bloqueado por backend (§5.2).
- **No reescribe funcionalidad.** Un slice migrado hace exactamente lo que hacía; las
  diferencias visuales asumidas se anotan, como se hizo con las tres migraciones de la ola 0.
- **No persigue tests de componentes.** Vitest sobre lógica pura, como dice la receta.
- **No convierte `app/` en un framework.** Cero abstracciones sin tercer caso de uso.
