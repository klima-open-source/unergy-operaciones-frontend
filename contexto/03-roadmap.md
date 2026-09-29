# Roadmap de migración — `legacy/` → `v2/`

> Documento 3 de 3. Plan de ejecución. Presupone
> [`01-contexto.md`](./01-contexto.md) (qué es cada cosa) y
> [`02-specs.md`](./02-specs.md) (qué no se puede perder).

---

## Estrategia en una página

El error clásico de una migración de este tamaño es intentar trasladar y rediseñar a la vez:
cuando algo se rompe, ya no se puede distinguir un bug nuevo de una diferencia intencional. Por
eso las tres fases son **secuenciales y de naturaleza distinta**:

| Fase                   | Qué cambia                               | Qué **no** cambia                  | Riesgo                                                   |
| ---------------------- | ---------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| **1 · Traslado**       | Dónde vive el código y quién lo arranca  | El código en sí                    | Alto pero acotado: falla o funciona, de forma visible    |
| **2 · Reorganización** | La estructura de carpetas y los imports  | El comportamiento, línea por línea | Bajo: mecánico y verificable por build                   |
| **3 · Migración**      | El código: tipos, patrones, UI, permisos | El producto que ve el usuario      | Alto y difuso: es donde se pierden funciones en silencio |

Tres invariantes que no se negocian:

1. **La app corre al final de cada fase y de cada paso dentro de ella.** Nunca hay un estado
   «se arregla al final».
2. **Se migra por rebanadas verticales** (un módulo completo de punta a punta), nunca por capas
   horizontales («ahora todos los servicios de toda la app»).
3. **Cada paso es reversible**: una rama, un commit por rebanada, y el legacy intacto hasta el
   cierre.

```
Fase 0        Fase 1              Fase 2                 Fase 3                    Fase 4
Preparar  →   Trasladar tal cual → Reorganizar         → Migrar por olas        →  Cerrar
              (app/legacy/)        (features/, utils/…)  (TS, services, UI…)       (borrar legacy)
              app corriendo        app idéntica          app equivalente           un solo repo
```

---

## Fase 0 · Preparación

**Objetivo:** tomar las decisiones que condicionan todo lo demás y montar la red de seguridad.
No se toca código de producto.

### 0.1 Cerrar las decisiones abiertas

Están enumeradas en `02-specs.md §20`. Las tres que bloquean el arranque, **decididas el
2026-08-24**:

| Decisión           | ✅ Resuelto                                                           | Por qué                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modo de render** | **`ssr: false` (SPA)** en fases 1–2; evaluar SSR por página en fase 3 | Hoy la app es una SPA. Activar SSR de entrada convierte 70 archivos que tocan `window`/`document`/`localStorage` en 70 fallos simultáneos de una fase que debía ser un traslado. Nuxt sigue aportando file-based routing, auto-imports, Nitro y el ecosistema aunque el render sea de cliente. |
| **Auth**           | **Migrar a cookies `httpOnly` en la fase 3, ola 1** — no en la 1      | Exige coordinación con backend. Hasta entonces, el store legacy funciona sin cambios.                                                                                                                                                                                                          |
| **App móvil**      | **Entra en el alcance, al final (ola 7)**                             | Es un producto aparte con su propio layout y ciclo; migrarla pronto no desbloquea nada.                                                                                                                                                                                                        |

Las demás (rol `admin`, restricción por email, Chart.js vs. Unovis, placeholders,
`OperacionView.vue`) pueden decidirse durante la fase 2 sin bloquear.

### 0.2 Red de seguridad — ✅ completada el 2026-08-24

- [x] **Rama de trabajo** `migration` (ya existe) y una regla: `master` sigue sirviendo el
      legacy en producción hasta el cutover de la fase 4.
- [x] **Portar las 6 pruebas existentes a Vitest** (`conciliacionMandatos`,
      `financialCalculations`, `parseCOP`, `validacionContratos`, `zipSecurityValidator`,
      `comercial`). Ahora importan el módulo de verdad en vez de leer el fuente y evaluarlo con
      `new Function`. **135 pruebas en verde**; los `.test.mjs` originales se retiraron.
      Se corren con `bun run test:legacy` desde `v2/` (config temporal
      `v2/vitest.legacy.config.ts`, que se absorbe en `vitest.config.ts` en la fase 1).
- [x] **Inventario de rutas congelado** → [`inventario-rutas.md`](./inventario-rutas.md).
      75 rutas (67 con vista, 8 redirecciones), con roles, flags y la página Nuxt destino de
      cada una. Es la lista de verificación de las fases 1 y 2.
- [x] **Inventario de endpoints congelado** → [`inventario-endpoints.md`](./inventario-endpoints.md).
      341 endpoints agrupados en 23 slices, con sus archivos consumidores y los 48 que comparte
      más de un slice. Es el índice de los services de la fase 3.
- [x] **Guion de humo manual** → [`guion-humo.md`](./guion-humo.md). 9 bloques, 74 recorridos,
      etiquetados por slice para poder correr solo el subconjunto de cada ola. La cobertura
      automatizada de esta app es ~0; el humo manual es la verificación real y hay que asumirlo
      como tal.

Ambos inventarios se generaron con un script sobre el código, no a mano: son reproducibles y
**no se editan a mano**.

### 0.4 Estado de la base de `v2/`

Verificado el 2026-08-24, todo en verde:

| Comprobación          | Resultado               |
| --------------------- | ----------------------- |
| `bun run lint`        | sin errores             |
| `bun run typecheck`   | 0 errores               |
| `bun run test` (v2)   | 10 archivos, 79 pruebas |
| `bun run test:legacy` | 6 archivos, 135 pruebas |

**Un arreglo necesario para llegar ahí:** `GAccordionTrigger.vue` y `GSwitch.vue` importaban de
`lucide-vue-next` mientras el resto de la app usa `@lucide/vue`, que es el que está instalado —
2 errores de `typecheck` de origen. Se corrigieron los dos imports.

> ⚠️ `app/components/gandalf/` es **intocable** según `AGENTS.md`: lo sincroniza el repo de
> Gandalf y el próximo sync revertirá este arreglo. **Hay que corregirlo también allá**, o
> volverá a romper el `typecheck`.

### 0.3 Definición de terminado (aplica a todo el roadmap)

```sh
bun run lint       # sin errores
bun run typecheck  # cero errores
bun run test       # verde
bun run build      # compila
```

Más: el guion de humo del alcance tocado, ejecutado de verdad.

**Entregable de la fase 0:** decisiones firmadas, pruebas en Vitest, dos inventarios y el guion
de humo.

---

## Fase 1 · Traslado literal

**Objetivo:** que todo el código de `legacy/src/` viva dentro de `v2/` **sin una sola
modificación de lógica**, y que la aplicación arranque y sirva las 75 rutas.

**Regla de la fase:** si un archivo de `legacy/src/` cambia de contenido, hay que poder
explicar por qué en una línea. El objetivo es cero diffs de producto.

### 1.1 Dónde aterriza el código — **corregido durante la ejecución**

> El plan original decía: dejar el árbol en una carpeta de cuarentena `app/legacy/` y declarar
> el alias `@` → `~/legacy`, para no tocar ni un import. **Ese truco no funciona y el plan se
> cambió.** Queda escrito porque la razón importa.

**Por qué no funcionaba:** `@` ya está tomado. Los componentes de shadcn (`app/components/ui/`,
que son intocables) hacen **440 imports** de `@/lib/utils` y `@/components/ui`. Repuntar `@` a la
cuarentena los habría roto todos.

**Lo que se hizo en su lugar:** el código del legacy aterriza **directamente en la estructura de
`app/`**, cada carpeta en su sitio:

| Origen (`legacy/src/`)                                                   | Destino (`v2/app/`)                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `components/`                                                            | `components/` (junto a `ui/`, `gandalf/`, `blocks/`, `layout/`)             |
| `composables/`                                                           | `composables/`                                                              |
| `utils/`                                                                 | `utils/`                                                                    |
| `stores/`                                                                | `stores/`                                                                   |
| `assets/`, `constants/`, `data/`, `api/`, `mobile/`, `router/`, `views/` | mismo nombre en `app/`                                                      |
| `main.js`, `App.vue`                                                     | `legacy/` — sustituidos por un plugin y dos layouts, se borran en la fase 2 |

Y entonces el problema del alias **desaparece solo**: el `@` del legacy significaba `src/`, y el
contenido de `src/` ahora _es_ `app/`, que es exactamente a donde Nuxt apunta `@` y `~`. Los dos
resuelven a `app/*`; `tsconfig.json` no se tocó. Los 338 imports se reescribieron a `~/…`, que es
la convención que pide `AGENTS.md`.

**Lo que esto cuesta:** adelanta a la fase 1 buena parte de la reubicación que era fase 2, y
elimina la red de la carpeta de cuarentena — el legacy ya comparte carpeta con el template. A
cambio, la fase 2 se reduce a repartir `views/` y `mobile/` en slices.

**Cómo se sostiene la separación sin cuarentena:** el legacy es JavaScript y el template es
TypeScript, así que `app/utils/*.js`, `app/composables/*.js` y `app/components/*.vue` los
separan limpiamente. Esa es la lista de exclusión de `eslint.config.mjs` y `.prettierignore`, y
**se vacía sola**: cuando la fase 3 convierte un archivo a `.ts`, deja de estar excluido y el
linter empieza a exigirle. La lista encogiendo _es_ la métrica de avance.

#### Colisiones de auto-import resueltas

`app/components/`, `app/composables/` y `app/utils/` son de auto-import en Nuxt, así que los
nombres compiten. Dos choques reales:

- **`PageHeader`** — el del legacy (props `title`/`subtitle`, slot `lead`) contra el del template
  (props `title`/`description`/`class`). APIs incompatibles: si ganaba el del template, ~100
  vistas perdían el subtítulo **en silencio**. El del template no tenía ni un consumidor, así que
  se borró (`AGENTS.md`: cero exports sin consumidor). Se rehace en la fase 3, ola 0.
- **`AppSidebar`** — el del legacy contra `layout/AppSidebar.vue`. Solo lo usaba
  `layouts/default.vue`, que pasó a importarlo por ruta explícita.

Los exports de `app/utils/` **no** chocaron con los del template (`date.ts`, `string.ts`).

### 1.2 Pasos

1. **Copiar el árbol.**
   - `legacy/src/**` → `v2/app/legacy/**` (sin cambios).
   - `legacy/public/**` → `v2/public/**` (revisar colisiones de `favicon`, `logo.svg`).
   - `legacy/docs/**` → `v2/docs/**` (son especificaciones vivas del dominio, valen).
2. **Dependencias.** Añadir a `v2/package.json` lo que el legacy usa y v2 no tiene: `primevue`,
   `@primevue/themes`, `primeicons`, `axios`, `chart.js`, `vue-chartjs`, `maplibre-gl`, `xlsx`,
   `xlsx-js-style`, `exceljs`, `jspdf`, `jspdf-autotable`, `pdfjs-dist`, `jszip`,
   `vuedraggable`. Todas quedan marcadas como **temporales**: PrimeVue, PrimeIcons, axios,
   Chart.js y vuedraggable salen en la fase 3.
   - Verificar `pinia` (v2 tiene 4, el legacy usa 2) y `vue-router` (v2 tiene 5, el legacy 4).
     El legacy usa la API de _setup stores_ y `useRoute`/`useRouter`, compatibles en ambas.
     Nuxt aporta el router; `createRouter` deja de usarse.
3. **Routing: una página delgada por ruta.** Nuxt es _file-based_; el `router/index.js` no se
   puede usar tal cual. Se **genera con un script** un archivo por ruta:

   ```vue
   <!-- app/pages/clientes/index.vue -->
   <script setup>
   import View from '~/legacy/views/Clientes/ClientesListView.vue'
   definePageMeta({ layout: 'legacy', roles: [] })
   </script>
   <template><View /></template>
   ```

   67 archivos de 5 líneas, generados desde el inventario de la fase 0. Cada uno desaparece
   solo cuando su página real se escribe en la fase 3. Las redirecciones del router se
   convierten en `routeRules` de Nuxt.

4. **Guard.** `router.beforeEach` → `app/middleware/legacy-auth.global.ts`, con la misma lógica
   (público, móvil, roles, `requireEmail`) leyendo el mismo store. Copia fiel, no rediseño.
5. **Layouts.** `App.vue` → `app/layouts/legacy.vue` (sidebar + `<slot/>` + `Toast` +
   `ConfirmDialog`) y `app/layouts/legacy-mobile.vue` (pantalla completa).
6. **Bootstrap.** `main.js` → `app/plugins/legacy-primevue.client.ts`: `PrimeVue` con
   `UnergPreset`, `ToastService`, `ConfirmationService`, directiva `tooltip` y los dos
   componentes globales (`InfoField`, `PageHeader`).
   - El manejo de `vite:preloadError` y el fallback de `router.onError` ya no aplican igual:
     Nuxt trae `app:chunkError`. Se sustituye por el mecanismo equivalente de Nuxt.
7. **Estilos.** Este es el punto delicado del traslado, porque **Tailwind 3 → 4 no es
   transparente**:
   - Reexpresar el `theme.extend` de `tailwind.config.js` (paleta `unergy`, `font-display`,
     `font-body`) como `@theme` en un `app/assets/css/legacy-theme.css`, para que
     `bg-unergy-purple`, `text-unergy-deep`, `font-body`… sigan resolviendo.
   - Barrido de utilidades renombradas o eliminadas en Tailwind 4 sobre los 177 SFC.
   - `assets/main.css` y `primeicons/primeicons.css` se registran en `nuxt.config.css`
     (el de PrimeIcons salió en la ola 0 de la fase 3, §3.2.1).
   - Los ~2.528 hex inline **no se tocan en esta fase**: son fase 3.
8. **Compilador de runtime.** `vue: { runtimeCompiler: true }` en `nuxt.config.ts` para que
   `OperacionView.vue` siga funcionando. Queda anotado como deuda a retirar.
9. **Proxies.** El proxy de `vite.config.js` se traslada a Nitro:
   - `/api` y `/monitoreo` → backend, por `nitro.devProxy` en dev y `routeRules` en producción.
   - `/api/v1/evo` → ruta Nitro propia (`server/routes/api/v1/evo/[...].ts`) que inyecta
     `X-EVO-Token` server-side. **El token no debe llegar nunca al bundle del cliente**; hoy
     esa garantía la daba el proxy de Vite y hay que reproducirla, no perderla.
   - `vercel.json` queda obsoleto: Nitro sirve la app.
10. **Herramientas.** Añadir `app/legacy/**` a `.prettierignore` y a los `ignores` de ESLint —
    de lo contrario 95.000 líneas de errores de lint bloquean la fase. Confirmar que
    `typecheck` no entra a los `.js` de cuarentena (`allowJs` sin `checkJs`).
11. **Pruebas.** Portar las 6 `.test.mjs` a Vitest (si no se hizo en la fase 0) y colocarlas
    junto a su archivo.

### 1.2b Hallazgos del spike (ejecutado)

Antes de cablear las 67 rutas se validó la pila entera con una vista rica
(`ProyectosListView.vue`, 1.104 líneas: DataTable, filtros, diálogos). **El build pasa.** Dos
hallazgos que el plan no anticipaba:

1. **Tailwind 4 rompe `@apply` dentro de `<style>` de un SFC.** Cada bloque se procesa aislado y
   no ve el tema, así que falla con `Cannot apply unknown utility class`. El build **falla en
   duro**, no en silencio, que es la buena noticia. Afecta a **21 archivos / 26 reglas**, todas
   con utilidades core. Se resolvió insertando `@reference 'tailwindcss';` al inicio de cada
   bloque afectado.
2. **La paleta `unergy` había que reexpresarla** como `@theme` de Tailwind 4
   (`app/assets/css/legacy-theme.css`). Sin eso, las ~2.500 clases `bg-unergy-purple`,
   `text-unergy-deep`, `font-body`… **no fallan: simplemente no se generan**, y la aplicación se
   ve rota sin que nada avise. Este es el modo de fallo peligroso de la fase.

También se retiraron las directivas `@tailwind base/components/utilities` de `assets/main.css`
(sintaxis de Tailwind 3, inexistente en Tailwind 4).

### 1.2c Estado de la fase 1 — ✅ completa (salvo revisión visual)

| Paso                                                                            | Estado               |
| ------------------------------------------------------------------------------- | -------------------- |
| Árbol del legacy repartido en `app/` (237 archivos)                             | ✅                   |
| Dependencias del legacy (15 paquetes, marcadas como temporales)                 | ✅                   |
| `ssr: false`, `runtimeCompiler: true`, CSS y `@theme` de Tailwind 4             | ✅                   |
| Plugin de PrimeVue y layouts `legacy` / `legacy-blank`                          | ✅                   |
| Las 75 rutas como páginas en `app/pages/` (67 vistas + 8 redirecciones)         | ✅                   |
| Guard del legacy como middleware global                                         | ✅                   |
| `app/legacy/` y `app/router/` eliminados                                        | ✅                   |
| Navegación del sidebar en `app/config/navigation.ts`                            | ✅                   |
| Proxies de Nitro (`/api/v1`, `/monitoreo`, `/api/v1/evo` con token server-side) | ✅                   |
| `app:chunkError` en lugar de `vite:preloadError`                                | ✅                   |
| Revisión visual de las 67 rutas contra el legacy                                | ☐ (necesita backend) |

**Verificado de punta a punta**, no solo compilado:

- El árbol de rutas derivado de `app/pages/` coincide con `contexto/inventario-rutas.md`:
  **75 de 75**, sin faltantes ni sobrantes.
- El servidor del build responde **200** en rutas con parámetro y anidadas (`/clientes/42`,
  `/proyectos/7/ppa`, `/liquidaciones/9/pdf`, `/m/solar`), **sin ninguna variable de entorno**.
- Los cuatro proxies, contra backends de prueba: ruta y query preservadas, el prefijo
  `/api/v1/evo` recortado y el `X-EVO-Token` inyectado. El token aparece en el bundle de
  servidor y en **cero** archivos del cliente.

#### La regla de nombres de página, y por qué

Toda ruta va a `<segmentos>/index.vue`, nunca a `<segmento>.vue`. En Nuxt, un `clientes.vue` que
convive con una carpeta `clientes/` **deja de ser una página** y pasa a ser el layout padre de sus
hijas: necesita un `<NuxtPage />` dentro, y sin él `/clientes/:id` renderiza vacío **sin dar
ningún error**. Con `index.vue` esa ambigüedad no existe.

Anidadas y con parámetro: `/proyectos/:id/ppa` → `proyectos/[id]/ppa/index.vue`. Y como
vue-router prefiere lo estático a lo dinámico, `liquidaciones/inversionista/` y
`liquidaciones/[id]/` conviven sin pisarse.

#### Dos bugs que el `build` verde no detectaba

Los encontró una auditoría de imports, no las puertas de calidad — que estaban en verde con los
dos presentes. Vale la pena repetirla al final de cada ola:

1. **Cuatro imports rotos.** Un `sed` dejó `~/core/client.js` donde el archivo ya era `.ts`.
   Compilaba porque Vite resuelve `.js` → `.ts` en proyectos TypeScript.
2. **Todas las rutas devolvían 302 a `/login`.** El middleware de servidor del template
   redirigía todo, porque `NUXT_PUBLIC_AUTH_ENABLED=false` vivía solo en `.env` — y un `.env`
   no viaja al build de producción. La app compilaba perfecta y no servía ni una página. El
   arreglo no es poner la variable: es que **el valor por defecto de `nuxt.config.ts` refleje la
   realidad de la fase**. `authEnabled: false` está ahora en la config.

### 1.3 Riesgos de la fase

| Riesgo                                                                | Mitigación                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tailwind 4 rompe estilos de forma difusa (no falla, se ve mal)        | Revisión visual ruta por ruta contra el legacy corriendo en paralelo en otro puerto          |
| PrimeVue 4 bajo Nuxt: CSS layers, `cssLayer: false`, orden de estilos | Probar temprano con una vista rica (`ProyectosListView`) antes de mover todo                 |
| `import.meta.env.VITE_*` disperso por el código                       | Nuxt usa Vite: sigue funcionando. Se documenta como deuda de fase 3 (pasa a `runtimeConfig`) |
| Componentes con `template:` string                                    | `runtimeCompiler: true`                                                                      |
| Colisiones de nombres al auto-importar                                | La cuarentena `app/legacy/` no se auto-importa; todo entra por ruta explícita                |

### 1.4 Criterios de aceptación

- [ ] `bun run dev` arranca sin errores ni advertencias nuevas.
- [ ] Las 67 rutas con vista del inventario cargan y renderizan lo mismo que el legacy (revisión visual
      lado a lado).
- [ ] Login, guard por rol y redirecciones se comportan igual.
- [ ] Las rutas `/m/*` funcionan con su layout propio.
- [ ] `bun run build` produce un artefacto desplegable, y hay un despliegue de vista previa.
- [ ] `lint`, `typecheck` y `test` en verde (con la cuarentena excluida).
- [ ] Guion de humo completo ejecutado.

**Entregable:** una sola aplicación Nuxt que hace todo lo que hacía el legacy.

---

## Fase 2 · Reorganización estructural — ✅ completa

**Ejecutada dentro de la fase 1.** Al no poder usarse la carpeta de cuarentena (ver §1.1), el
código aterrizó directamente en su sitio, así que las dos fases se solaparon.

| Origen                                               | Destino                                                    | Estado |
| ---------------------------------------------------- | ---------------------------------------------------------- | ------ |
| `api/client.js`                                      | `core/client.ts`                                           | ✅     |
| `api/{liquidacionesApi,garantiasProyecciones,xm}.js` | services en `features/<slice>/services/`                   | ✅     |
| `stores/auth.js`                                     | `stores/auth.ts` + `features/auth/services/legacy-auth.ts` | ✅     |
| `utils/security.js`                                  | `utils/security.ts`                                        | ✅     |
| `composables/*.js`                                   | `composables/*.ts` + services + `useState`                 | ✅     |
| `constants/liquidaciones.js`                         | `features/liquidaciones/constants.ts`                      | ✅     |
| `views/**` (150 archivos)                            | `features/<slice>/components/` en 21 slices                | ✅     |
| `mobile/**`                                          | `features/mobile/components/`                              | ✅     |
| `components/`, `assets/`, `data/`                    | sus carpetas en `app/`                                     | ✅     |

`app/views/` y `app/mobile/` ya no existen. 178 archivos movidos con `git mv` (la historia se
conserva) y 88 archivos con imports reescritos.

**Dos cruces de slice que había que romper**, ambos detectados por auditoría:

- `GeneracionSolarView` importaba `./Fallas/FallaForm.vue` — ahora por ruta absoluta al slice.
- `InformeOMView` hacía `import('../MEM/cumplimientoAnualExport.js')`. Este lo dejó pasar la
  primera auditoría porque era un **`import()` dinámico** y el barrido solo miraba `from '…'`.
  La auditoría cubre ahora ambas formas.

### 2.1 Mapa de destino

| Origen (`app/legacy/`)                               | Destino                                             | Nota                                                        |
| ---------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `views/<Modulo>/*.vue`                               | `app/features/<slice>/components/`                  | Las páginas delgadas de la fase 1 apuntan aquí              |
| `components/*.vue` (compartidos)                     | `app/components/blocks/` o el slice que corresponda | `PageHeader` ya existe en `blocks/`: se unifica             |
| `components/reports/*`                               | El slice que los use, o se borran                   | Verificar consumidores antes                                |
| `composables/*.js`                                   | `app/composables/`                                  | `useSidebar` conserva su `ref` de módulo por ahora, anotado |
| `utils/*.js`                                         | `app/utils/`                                        | Funciones puras; las pruebas viajan con ellas               |
| `constants/*.js`                                     | `app/config/`                                       |                                                             |
| `api/client.js`                                      | `app/core/legacy-client.js`                         | Muere en la fase 3                                          |
| `api/{liquidacionesApi,garantiasProyecciones,xm}.js` | `app/features/<slice>/services/`                    | Ya son casi services: son la semilla del patrón             |
| `stores/auth.js`                                     | `app/features/auth/`                                | Se sustituye en la fase 3, ola 1                            |
| `assets/main.css`                                    | `app/assets/css/`                                   |                                                             |
| `assets/*.js` (datasets)                             | `app/features/<slice>/` o se borran                 | Verificar si siguen en uso                                  |
| `data/*.json`                                        | `app/features/<slice>/` o `public/`                 | Verificar si es dato de producción                          |
| `mobile/**`                                          | `app/features/mobile/`                              | Slice propio, se mantiene aislado                           |
| `router/index.js`, `main.js`, `App.vue`              | —                                                   | Ya absorbidos en la fase 1: se borran                       |

### 2.2 Definición de los slices

Derivados de la navegación real, no de las carpetas de `views/`:

```
features/
├── auth/            ├── clientes/        ├── proyectos/       ├── contratos/
├── comercial/       ├── operaciones/     ├── fallas/          ├── solar/
├── alertas/         ├── fronteras/       ├── registros-cnd/   ├── mem/
├── garantias/       ├── liquidaciones/   ├── panel-contable/  ├── finanzas/
├── retos/           ├── operadores-red/  ├── notificaciones/  ├── admin/
└── mobile/
```

Criterio para separar: si dos módulos comparten tipos y endpoints, son el mismo slice; si solo
comparten pantalla, no.

### 2.3 Método

Una rebanada por commit, en este ciclo:

1. Mover los archivos del slice con `git mv` (preserva historia).
2. Reescribir sus imports `@/…` a `~/…` reales, con `sed` acotado al slice.
3. Reescribir los imports que **otros** archivos hacían hacia él.
4. `bun run build` + humo del slice.
5. Commit.

Cuando ya no queda ningún `@/`, se **elimina el alias** de `nuxt.config.ts`. Eso convierte
cualquier import olvidado en un error de build, no en un misterio.

Orden sugerido: primero lo que no depende de nada (`utils/`, `constants/`, `assets/`), luego
los slices de hoja, y al final los que todos usan (`components/`, `composables/`, `api/`).

### 2.4 Criterios de aceptación

- [ ] `app/legacy/` no existe.
- [ ] No queda ningún import `@/…`; el alias está eliminado.
- [ ] No hay barrels propios (`index.ts` que reexporten) fuera de `components/ui/`.
- [ ] La estructura de carpetas coincide con la de `AGENTS.md`.
- [ ] `git log --follow` sigue mostrando la historia de los archivos movidos.
- [ ] Comportamiento idéntico: guion de humo completo.
- [ ] `lint`/`typecheck`/`test`/`build` en verde.

**Entregable:** el código del legacy viviendo en la estructura del template, todavía en
JavaScript y todavía con PrimeVue, pero en su sitio.

---

## Fase 3 · Migración a los estándares del template

**Objetivo:** que el código cumpla `AGENTS.md`. Es la fase larga, y la única donde se
refactoriza.

**Regla de la fase:** se migra **por rebanadas verticales completas**. Un slice se declara
migrado cuando cumple la receta entera, no cuando «ya está en TypeScript».

### 3.1 La receta por slice

Para cada slice, en este orden:

1. **Tipos.** `features/<slice>/types.ts` con la forma real de las respuestas del backend. Lo
   compartido por más de un slice sube a `app/types/`. Nunca `any`; si la forma no se conoce,
   `unknown` y se angosta.
2. **Services.** Un service por agregado, `extends BaseService`, en
   `features/<slice>/services/`. Absorbe todas las llamadas `api.get/post/...` que hoy están
   dentro de los `.vue`. Rutas de API como constantes, jamás magic strings.
3. **Páginas.** La página delgada de la fase 1 se convierte en una página de verdad en
   `app/pages/`, con su `definePageMeta`, su `useQuery`/`useAsyncData` y su `AsyncView`.
4. **Componentes.** Los `.vue` del slice pasan a TypeScript, se les quita PrimeVue y se
   reescriben sobre Gandalf/shadcn. Los que superan las ~400 líneas se parten en
   subcomponentes; los de más de 1.000 se tratan como un mini-proyecto con su propio plan.
5. **Estado.** Lo local se queda en el componente; lo compartido va a un composable con
   `useState`. Se eliminan los `ref` a nivel de módulo.
6. **Errores.** Todo lo que se lanza o atrapa pasa por `normalizeError`; nada de
   `console.log`/`console.error`; `logger.error(scope, err)`.
7. **Permisos.** Se declaran los `Permission` del slice en `config/permissions.ts`, se añaden a
   `AUTH_ROUTE_PERMISSIONS` y a `config/navigation.ts`.
8. **Pruebas.** Vitest sobre la lógica pura del slice (cálculos, validaciones,
   transformaciones). No se persiguen los componentes.
9. **Limpieza.** Se borra lo que quedó sin consumidor. Borrar es borrar.

Y la comprobación final: `lint` + `typecheck` + `test` + humo del slice.

### 3.2 Ola 0 · Fundaciones

Sin esto, cada slice reinventa lo mismo. No cambia nada visible para el usuario.

- ✅ **Tokens de marca — hecho (2026-09-29).** `--primary` es el morado Unergy (`#915bd8`; `#b08ae2`
  en oscuro), `--foreground` el morado profundo, `--background` la avena, y `muted`/`border`/`accent`
  llevan el tinte lavanda del legacy; `--highlight` es el amarillo solar. Las ~830 clases
  `*-unergy-*` y las 54 `var(--color-unergy-*)` pasaron a esos tokens y `legacy-theme.css` se
  borró. Ya no existe `unergy-purple` ni `unergy-deep`: se escribe `primary` y `foreground`.
  `gandalf-tokens.css` es un puente temporal hasta sincronizar el tema de Gandalf.
- **Tokens de marca en Tailwind 4.** La paleta Unergy y los colores semánticos
  (éxito `#2e7d32`, déficit `#D64455`, exceso `#F0C040`, textos apagados, bordes) pasan a
  tokens en `@theme`. A partir de aquí, escribir un hex en un `style=` es un error de revisión.
- **Tabla de equivalencias PrimeVue → Gandalf/shadcn**, ordenada por frecuencia real:

  | PrimeVue                                                       | Usos   | Destino                                                                                 |
  | -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
  | `Button`                                                       | 88     | `ui/button`                                                                             |
  | `useToast`                                                     | 75     | `vue-sonner` — ✅ **hecho** (§3.2.2)                                                    |
  | `InputText`                                                    | 58     | `ui/input`                                                                              |
  | `Select` / `Dropdown`                                          | 60     | `ui/select`                                                                             |
  | `Dialog`                                                       | 48     | `ui/dialog`                                                                             |
  | `Tag`                                                          | 40     | `GBadge`                                                                                |
  | `InputNumber`                                                  | 37     | `ui/number-field`                                                                       |
  | **`DataTable` + `Column`**                                     | **68** | **no existe equivalente — ver abajo**                                                   |
  | `Textarea`                                                     | 29     | `ui/textarea`                                                                           |
  | `DatePicker` / `Calendar`                                      | 30     | `ui/calendar` + `ui/popover`                                                            |
  | `ProgressSpinner`                                              | 25     | `ui/spinner` / `AsyncView`                                                              |
  | `IconField` + `InputIcon`                                      | 50     | `ui/input-group`                                                                        |
  | `MultiSelect`                                                  | 14     | `ui/combobox`                                                                           |
  | `useConfirm` + `ConfirmDialog`                                 | 17     | `ui/alert-dialog` — ✅ **hecho** (§3.2.3)                                               |
  | `Checkbox`, `ToggleSwitch`, `SelectButton`                     | 29     | `ui/checkbox`, `ui/switch`, `ui/toggle-group`                                           |
  | `TabView` + `TabPanel`                                         | 10     | `GTabs`                                                                                 |
  | `Message`                                                      | 8      | `ui/alert`                                                                              |
  | `AutoComplete`                                                 | 5      | `ui/combobox`                                                                           |
  | `Menu`, `Popover`, `Drawer`, `Divider`, `Skeleton`, `Password` | 14     | `ui/dropdown-menu`, `ui/popover`, `ui/sheet`, `ui/separator`, `ui/skeleton`, `ui/input` |

- **⚠️ La tabla de datos es el mayor riesgo de la fase.** `DataTable`/`Column` aparecen 68
  veces con paginación perezosa, ordenamiento, filtros, columnas congeladas y plantillas por
  celda. `ui/table` de shadcn es solo marcado. Hay que **decidir y construir esto antes de la
  ola 2**: un `blocks/DataTable` propio compuesto sobre `ui/table` + `usePagination` +
  `useFilters`, con o sin TanStack Table como dependencia nueva. Si esta pieza no está
  resuelta, cada slice la improvisará distinta y la migración se degrada.
- **Mapa de iconos** PrimeIcons → `@lucide/vue` — ✅ **hecho** (ver §3.2.1).
- **Envoltorios de infraestructura**: notificación (sonner) — ✅ **hecho** (§3.2.2); confirmación
  (`AlertDialog`) — ✅ **hecho** (§3.2.3); quedan formato de moneda/fecha/número en `app/utils/`
  y las utilidades de exportación como módulos `client-only` con import dinámico.
- **Tipos base del dominio** en `app/types/`: `Proyecto`, `Cliente`, `Contrato`, `Falla`,
  `Liquidacion`, `Frontera`, `Inversionista`, y los `enum` de estados y roles.

#### 3.2.1 Iconos · PrimeIcons → `@lucide/vue` — ✅ completo (2026-08-24)

**Estado:** cero `pi pi-*` en `app/`, `primeicons` desinstalado y fuera de `nuxt.config.ts`.
1.822 apariciones en 159 archivos, 156 iconos distintos, todos con equivalente real en
`@lucide/vue` (la lista se validó contra los exports del paquete, no a ojo).

Se hizo con cuatro pasadas de codemod más un puñado de casos a mano; el mapa vive en el script,
no en el runtime: **no hay componente `<Icon name="…">`**. Cada archivo importa por nombre lo
que usa, que es la convención que ya tenían `NavUser.vue`, `AsyncView.vue` y
`config/navigation.ts`. Un mapa string→componente habría sido un magic string con indirección y
habría arrastrado los 156 iconos al bundle.

**Formas convertidas**, por patrón:

| Patrón de origen                              | Destino                                                 | Nº    |
| --------------------------------------------- | ------------------------------------------------------- | ----- |
| `<i class="pi pi-x …">`                       | `<XIcon class="…" />`                                   | 1.032 |
| `<i :class="c ? 'pi pi-a' : 'pi pi-b'">`      | `<AIcon v-if="c" /><BIcon v-else />`                    | 53    |
| `<i class="pi" :class="c ? 'pi-a' : 'pi-b'">` | igual que el anterior                                   | 33    |
| `<Button icon="pi pi-x" />`                   | `<Button><template #icon><XIcon /></template></Button>` | 417   |
| `<InputIcon class="pi pi-x" />`               | `<InputIcon><XIcon /></InputIcon>`                      | 27    |
| `icon: 'pi pi-x'` en arrays de datos          | `icon: XIcon` (un `Component`)                          | 163   |
| `<i :class="tab.icon">`                       | `<component :is="tab.icon" />`                          | 37    |

**Decisiones que hay que conocer antes de tocar un icono:**

1. **Tamaño: `size-[1em]` en todos.** `primeicons.css` **no** fija `font-size` en `.pi`: el
   glifo heredaba el del contenedor. Un SVG de Lucide, en cambio, mide 24 px fijos. `size-[1em]`
   reproduce exactamente el comportamiento anterior y, de paso, hace que las ~200 clases
   `text-xs`/`text-[10px]` y los `style="font-size:…"` que ya había sigan mandando sin tocarlos.
   No es la convención del template (`size-4`, `size-3.5`): **cuando un slice se migre a
   Gandalf/shadcn en su ola, sus iconos pasan a tamaño explícito.** Mientras tanto, paridad
   visual por encima de estilo.
2. **`pi-spin` → `animate-spin`**, y `pi-spinner` → `LoaderCircleIcon` (120 sitios). La
   animación de PrimeIcons dura 2 s y la de Tailwind 1 s: gira más rápido, a propósito no se
   compensó.
3. **Selectores CSS.** 49 reglas apuntaban al elemento (`.dl-tab i { font-size: 11px }`) y 25 a
   la clase (`.rs-card-head .pi`, `.cf-state .pi-spinner`). Todas pasaron a `svg`. **Este era el
   modo de fallo silencioso de esta migración:** el marcado compila igual y el icono se
   descoloca sin que nada avise. Riesgo residual conocido: un `svg` de PrimeVue dentro de esos
   mismos contenedores hereda ahora la regla.
4. **`iconPos="right"` (6 botones).** El slot `#icon` de PrimeVue siempre pinta antes del label,
   y el `data-p` que invertía el orden solo se aplica al span interno. Se resolvió con
   `class="flex-row-reverse"` sobre el botón.
5. **`Menu` de PrimeVue (4 usos).** `item.icon` es una clase CSS, no admite componente. Se usa
   el slot `#itemicon`, que sí recibe el `item`.
6. **`ConfirmDialog`.** `confirm.require({ icon })` tampoco admite componente y su slot `#icon`
   no recibe props, así que el icono se declaró una vez en cada montaje del diálogo
   (`app.vue` y tres vistas) y se quitó de las 20 llamadas. **Cambio cosmético asumido:** la
   confirmación de "duplicar" usaba `pi-clone` y ahora muestra el mismo triángulo que el resto.
   Este workaround completo (icono repetido en cuatro sitios) desapareció al día siguiente, con
   la migración a `AlertDialog` — ver §3.2.3.
7. **Iconos que vienen del backend.** `GET /fallas/estructura` devuelve `icono: 'pi pi-server'`.
   Se dejó de leer ese campo: `iconoCategoriaFalla(codigo)` en `~/utils/fallaTitulo.ts` traduce
   del **código de categoría** al componente, que además es donde ya vivía `ICONO_CAT`. La API
   no se tocó (ver restricciones del §7 de `01-contexto.md`).
8. **Pérdidas de fidelidad, todas anotadas:** `pi-*-fill` no tiene relleno en Lucide → se
   añadió `fill-current` en los 6 sitios de `pi-circle-fill`/`pi-flag-fill`; en
   `config/navigation.ts` "Pipeline" y "Retos Q" comparten ahora `FlagIcon`. `pi-file-pdf` y
   `pi-file-word` caen en `FileTextIcon`/`FileTypeIcon`; `pi-clone` y `pi-copy`, ambos en
   `CopyIcon`.

**Componentes con `template:` de runtime.** `OperacionView.vue` define 8 componentes como
string; un `<XIcon>` ahí dentro **no se resuelve solo** y Vue lo omite con un warning en
consola. Se registraron en el `components:` de cada uno. Si en la ola 2 se parte ese archivo,
esa deuda se va con él.

**Verificado**: `lint`, `typecheck`, `test` (214) y `build` en verde; auditoría de referencias
—todo `<XIcon>` y todo `:is="…"` resuelve a un import o a un componente local— y barrido de
`pi-` a cero. **Falta la revisión visual**, que necesita backend, igual que la de la fase 1.

#### 3.2.2 Avisos · `useToast` de PrimeVue → `vue-sonner` — ✅ completo (2026-08-24)

**Estado:** cero `toast.add(…)` y cero imports de `primevue/toast*` en `app/`. 557 llamadas en
83 archivos, convertidas a la API real de `vue-sonner` — **no hay adaptador con forma de
PrimeVue**. `ToastService` salió del plugin de arranque.

El inventario ayudó: las 531 llamadas a `toast.add` eran **cuatro severidades y una sola forma**
(`severity` + `summary` + `life`, con `detail` opcional). Ni un `group`, ni un `closable`, ni un
toast pegajoso. Eso permitió un codemod con lectura real del objeto literal —comas de primer
nivel, plantillas y propiedades abreviadas incluidas— en vez de un `sed`.

| PrimeVue                                             | vue-sonner                                        |
| ---------------------------------------------------- | ------------------------------------------------- |
| `severity: 'success' \| 'error' \| 'warn' \| 'info'` | `toast.success` / `.error` / `.warning` / `.info` |
| `summary`                                            | primer argumento (título)                         |
| `detail`                                             | `description`                                     |
| `life`                                               | `duration`                                        |

**Lo que se cae de paso — y era deuda escrita:**

- **`window.__primeToast` ya no existe.** El interceptor de axios de `~/core/client.ts` usaba ese
  puente global porque no podía llamar a un composable fuera de un componente. El `toast` de
  sonner es un import normal: el interceptor lo llama directo. Se borraron el puente de
  `app.vue`, sus ~30 usos en móvil/operaciones y el archivo `app/types/window.d.ts` entero, que
  existía solo para tiparlo.
- **`ToastService` fuera de `app/plugins/legacy-primevue.client.ts`** y `<PrimeToast>` fuera de
  `app.vue`. El plugin ya solo instala tema, `ConfirmationService`, `tooltip` y los dos
  componentes globales.

**Decisiones:**

1. **`<Toaster position="top-right" rich-colors close-button />`.** El `<PrimeToast>` estaba en
   `top-right` y Aura colorea por severidad; el defecto de sonner es abajo a la derecha y
   monocromo. `rich-colors` es lo que más se le parece. Es el único sitio donde se decide la
   apariencia de un aviso en toda la app.
2. **`vue-sonner/style.css` registrado en `nuxt.config.ts`.** No lo importa nadie más:
   `components/ui/sonner/Sonner.vue` (que es intocable) da por hecho que el CSS ya está. El
   `<Toaster />` llevaba montado desde la fase 1 y habría salido sin estilo en cuanto alguien lo
   usara. Verificado en el bundle: `entry.*.css` contiene los estilos de sonner.
3. **Tres llamadas con severidad dinámica** (`conError.length ? 'warn' : 'success'`) se
   reescribieron a mano como `if`/`else`: elegir el método por ternario se lee peor que la
   condición explícita.

**Diferencias de comportamiento asumidas:** sonner apila con un máximo de 3 avisos visibles y
los colapsa (PrimeVue los mostraba todos, expandidos).

**Fuera de alcance, decidido a propósito:** cinco vistas —`LiquidacionPdfView`,
`InformesMensualesPanel`, `InformeDetailView`, `PortafoliosGestionPanel`, `EnvioMensualPanel`—
tienen su **propio** toast hecho a mano (`function toast(msg, err)` + un `ref` + CSS
`position: fixed`), que nunca pasó por PrimeVue. No se tocaron. Unificarlos con sonner es
trabajo real y visible (cambian de posición y de estilo) y va en la ola de su slice.
Ojo con `LiquidacionPdfView`: su toast se oculta con `@media print` y uno de sonner, que vive en
un portal, no heredaría esa regla.

**Verificado**: `lint`, `typecheck`, `test` (214) y `build` en verde; barrido a cero de
`toast.add`, `__primeToast` y `primevue/toast`; auditoría cruzada de que no queda ni un `toast`
importado sin usar ni usado sin importar, y de que las cinco vistas con `function toast` propia
no reciben el import (habría sido una redeclaración). Los props del `<Toaster>` los validó
`vue-tsc`, porque `app.vue` sí es TypeScript. **Falta la revisión visual.**

#### 3.2.3 Confirmaciones · `useConfirm`/`ConfirmDialog` de PrimeVue → `AlertDialog` — ✅ completo (2026-08-24)

**Estado:** cero `confirm.require(…)`, cero `primevue/useconfirm`, cero `primevue/confirmdialog`,
`ConfirmationService` fuera del plugin de arranque. 20 llamadas en 13 archivos, todas destinadas
a borrar algo o descartar cambios sin guardar — el inventario no tenía ni un `reject` (nadie
reacciona a "Cancelar") ni un `group` (nunca dos confirmaciones compitiendo en la misma página).

**La pieza nueva, porque `ui/alert-dialog` es solo marcado:**

- **`app/composables/useConfirm.ts`** — estado compartido en `useState('confirm-dialog', …)`,
  con la misma forma que `useAuthState`/`useAuth` en `useAuth.ts`: `useConfirmState()` expone el
  estado crudo, `useConfirm()` expone la función que lo abre. `confirm({ title, description,
confirmLabel, cancelLabel, variant, onConfirm })` reemplaza el `confirm.require({ header,
message, acceptLabel, rejectLabel, acceptSeverity/acceptClass/acceptProps.severity, accept })`
  de PrimeVue — API propia, no un adaptador con su forma.
- **`app/components/blocks/ConfirmDialog.vue`** — el único componente de toda la app que renderiza
  `<AlertDialog>`, montado una vez en `app.vue` (antes eran cuatro montajes: uno global en
  `app.vue` y tres locales, en `ContratosListView`, `PPAView` y `GesconView`, todos idénticos).
  Va en `blocks/` y no en `gandalf/base/` porque **`gandalf/` es intocable** — el wrapper
  correcto según `AGENTS.md` se agrega en el repo de Gandalf, no aquí; mientras tanto se compone
  directo sobre `ui/alert-dialog`, que es la salida que la propia regla contempla.

**Decisiones:**

1. **`confirm` es una función, no un objeto con `.require`.** Con PrimeVue retirado, mantener el
   nombre del método no aportaba nada — se limpia junto con el resto del vocabulario ajeno
   (`header`→`title`, `message`→`description`, `life` no existía aquí). Los 13 call sites solo
   cambian el cuerpo de la llamada, no la línea `const confirm = useConfirm()`.
2. **Variable renombrada en 3 archivos.** `FallaDetailView.vue`, `MonitoreoView.vue` y
   `GestionFallasView.vue` guardaban el composable en `confirmService` en vez de `confirm`, sin
   razón visible. Se unificó a `confirm`, que es lo que usan los otros 10.
3. **`AlertDialogMedia` como icono, con color por variante.** El `ConfirmDialog` de PrimeVue
   pintaba el mismo triángulo neutro para las 20 llamadas, incluida la de "Fusionar contratos
   duplicados", que no es destructiva. El bloque nuevo tiñe el círculo de `AlertDialogMedia` en
   rojo (`bg-destructive/10 text-destructive`) cuando `variant: 'destructive'`, y lo deja neutro
   si no. Es una mejora real de la mayoría de los casos (19 de 20 son "Eliminar…" o "Descartar
   cambios") a costa de una diferencia visual intencional en el caso que no lo es.
4. **Sin estado de carga en el botón de confirmar.** El comportamiento de PrimeVue era cerrar el
   diálogo al aceptar y disparar `accept` sin esperarlo, incluso cuando es `async`; se preservó
   igual — `AlertDialogAction` cierra solo al hacer click (es el comportamiento de Reka UI) y
   `onConfirm()` corre después, sin bloquear el cierre. Ninguna de las 20 llamadas dependía de
   que el diálogo siguiera abierto durante el `await`.
5. **`rejectProps`/`acceptProps` con objeto anidado.** Cinco llamadas (`FallaDetailView` × 2,
   `MonitoreoView`, `GestionFallasView`, `FronterasView` × 2) usaban
   `acceptProps: { label, severity }` en vez de `acceptLabel`/`acceptSeverity` planos. El codemod
   parsea el objeto anidado igual que el plano; no quedó ninguna forma sin traducir.

**Verificado**: `lint`, `typecheck`, `test` (214) y `build` en verde; barrido a cero de
`confirm.require`, `primevue/useconfirm` y `primevue/confirmdialog`; auditoría cruzada de que los
13 archivos con `confirm({…})` declaran `const confirm = useConfirm()` y de que no queda ningún
`acceptLabel`/`rejectSeverity`/`acceptProps` residual. **Falta la revisión visual** — es la más
sensible de las tres migraciones de esta ola porque cambia la única pieza interactiva (antes solo
cambiaban icono y color de fondo).

### 3.3 Ola 1 · Auth, permisos y shell

- ~~Apuntar `server/utils/auth-api.ts` al backend real~~ — **bloqueado**: el backend no expone
  `/auth/me`. La sesión sigue en JWT/`localStorage` (`~/composables/useAuth.ts`, Composition API,
  con manejo de errores tipado y expiración automática), reemplazando `stores/auth.js` (Pinia,
  retirado). El pipeline de cookies httpOnly del template quedó montado pero dormido
  (`authSessionCookiesEnabled: false` en `nuxt.config.ts`) para no tener que rehacerlo cuando el
  endpoint exista.
- ✅ **Traducir roles a permisos.** Los 7 roles reales pasaron a `enum UserRole`; 19 tags
  `recurso:acción` en `~/config/permissions.ts`, `ROLE_PERMISSIONS` completa (`admin` con todo
  explícito, sin bypass) y `AUTH_ROUTE_PERMISSIONS` cubriendo las páginas web por prefijo.
  `legacy-auth.global.ts` se retiró; `auth.global.ts` (el guard real) gobierna, deny-by-default.
- ✅ `config/navigation.ts` fusionado: los 9 grupos y sus permisos en una sola fuente
  (`NAVIGATION_ITEMS`), sin la lista aparte `LEGACY_NAV_ITEMS`.
- ✅ `AppSidebar`/`NavMain`/`NavUser` sobre el sidebar del template — `NavMain.vue` ganó soporte de
  submenú colapsable (`Collapsible` + `SidebarMenuSub`) para Liquidaciones/Panel Contable/
  Herramientas liquidaciones. `LegacyAppSidebar.vue` y el `useSidebar` hecho a mano se retiraron.
  **Pendiente real, no hecho todavía:** la campana se movió a `SiteHeader.vue`
  (`NotificationsBell.vue`) tal cual estaba — mismo `setInterval` de 60s y llamadas `api.` directas,
  no el slice `notificaciones` con service y composable que pide este punto.
- 🟡 App móvil: tiene guard propio (`app/middleware/mobile.global.ts`), pero sigue en
  `app/middleware/`, no "en su slice", y comparte `layouts/legacy-blank.vue` con login/recuperación
  en vez de un layout propio.

### 3.4 Olas 2–7 · Los slices

Orden por dependencia y riesgo creciente. Cada ola termina con humo y despliegue de vista
previa.

| Ola   | Slices                                                                                                   | Por qué aquí                                                                                  | Tamaño     |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| **2** | `clientes`, `proyectos`, `contratos`, `operadores-red`, `retos`, `admin`                                 | CRUD clásico: es donde se afina la receta y se estrena la tabla de datos con riesgo bajo      | Medio      |
| **3** | `fallas`, `operaciones`, `solar`, `alertas`                                                              | Alto tráfico diario; introduce mapas, gráficas y tiempo real                                  | Grande     |
| **4** | `fronteras`, `registros-cnd`, `mem` (gescon, precio bolsa, clima, descubrimientos, balance), `garantias` | Dominio pesado, exportes con fórmulas, parsers                                                | Grande     |
| **5** | `liquidaciones`, `panel-contable`, `finanzas`                                                            | El núcleo financiero: máximo impacto si algo sale mal, se migra cuando la receta está probada | Muy grande |
| **6** | `comercial`                                                                                              | Aislado y ya con pruebas; puede adelantarse si conviene por prioridad de negocio              | Medio      |
| **7** | `mobile`                                                                                                 | Producto aparte, layout propio, sin dependencias de los demás                                 | Medio      |

**Fuera de este orden, como sub-proyectos con plan propio** (son demasiado grandes para una
rebanada normal):

| Archivo                                  | Líneas | Cuándo                                              |
| ---------------------------------------- | ------ | --------------------------------------------------- |
| `MEM/CumplimientoV2View.vue`             | 5.425  | Ola 4, con su propio desglose en 7 pestañas         |
| `Fallas/MonitoreoView.vue`               | 2.992  | Ola 3                                               |
| `GeneracionSolarView.vue`                | 2.885  | Ola 3                                               |
| `Servicios/OperacionView.vue`            | 2.422  | Ola 2 — y aquí se retira `runtimeCompiler`          |
| `Operaciones/InformesMensualesPanel.vue` | 1.969  | Ola 3                                               |
| `Operaciones/GestionFallasView.vue`      | 1.941  | Ola 3                                               |
| `Servicios/ServiciosUnificadoView.vue`   | 1.757  | Ola 2 — es la pantalla de entrada real del producto |
| `PanelContable/PanelContableView.vue`    | 1.644  | Ola 5                                               |

### 3.5 Ola 8 · Retirada

Lo que solo se puede hacer cuando ya no queda nadie usándolo:

- [x] Desinstalar `primeicons` — hecho en la ola 0 (§3.2.1), no hacía falta esperar aquí:
      no lo usaba PrimeVue, solo nuestro marcado.
- [ ] Desinstalar `primevue`, `@primevue/themes`, `axios`, `vuedraggable`.
- [ ] Decidir y ejecutar Chart.js → `@unovis/vue` (12 archivos) o documentar la excepción.
- [ ] Retirar `vue.runtimeCompiler`.
- [ ] Retirar los layouts y el middleware `legacy-*`.
- [ ] Pasar `import.meta.env.VITE_*` a `runtimeConfig`.
- [ ] Reevaluar SSR: activarlo donde aporte (páginas de lectura), dejarlo apagado donde no.
- [ ] Endurecer la CSP: sin `style=` inline, `Content-Security-Policy` en modo bloqueo.
- [ ] Auto-hospedar las fuentes de Google y `pdf.js` para poder cerrar `script-src` y
      `font-src`.

### 3.6 Cómo se mide el avance

Métricas objetivas, verificables con un comando:

| Métrica                                      | Inicio    | Hoy    | Meta                      |
| -------------------------------------------- | --------- | ------ | ------------------------- |
| Archivos en `app/legacy/`                    | 237       | 0      | 0 (al terminar la fase 2) |
| Archivos que importan `primevue`             | 120       | 113    | 0                         |
| **Apariciones de `pi pi-*`**                 | **1.822** | **0**  | **0**                     |
| **Llamadas a `toast.add` de PrimeVue**       | **557**   | **0**  | **0**                     |
| **Llamadas a `confirm.require` de PrimeVue** | **20**    | **0**  | **0**                     |
| Archivos `.js`/`.vue` sin `lang="ts"`        | 237       | 237    | 0                         |
| Llamadas a la API fuera de un service        | 341       | 341    | 0                         |
| Literales hex de la paleta                   | ~2.528    | ~2.528 | 0                         |
| Rutas declaradas en `AUTH_ROUTE_PERMISSIONS` | 1         | 1      | 67                        |
| Slices que cumplen la receta completa        | 0         | 0      | 21                        |

Los comandos, desde `v2/`:

```sh
grep -rl "from 'primevue" app | wc -l           # archivos que importan PrimeVue
grep -roP "(?<![-\w])pi pi-" app | wc -l        # clases de PrimeIcons que quedan
grep -ro "toast\.add(" app | wc -l              # avisos aún en la API de PrimeVue
grep -ro "confirm\.require(" app | wc -l        # confirmaciones aún en la API de PrimeVue
```

---

## Fase 4 · Cierre

- [ ] **Cutover:** desplegar `v2/` como producción; el legacy queda accesible una semana como
      plan de reversión.
- [ ] **Borrar `legacy/`** del repositorio y promover `v2/` a la raíz.
- [ ] **Documentación:** actualizar `AGENTS.md` con lo específico de Unergy, reescribir el
      `README.md`, retirar `FRONTED.md` y `FRONTEND_ARCHITECTURE.md` (desactualizados) y
      conservar `docs/superpowers/` como especificaciones vivas del dominio.
- [ ] **`SECURITY.md`:** reescribir con el esquema nuevo y cerrar los puntos que quedaron
      resueltos por la migración.
- [ ] **Retrospectiva:** qué se descartó y por qué, deuda que queda anotada.

---

## Riesgos transversales

| Riesgo                                                                                                               | Impacto                                       | Mitigación                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **La tabla de datos** no tiene equivalente en shadcn                                                                 | Bloquea 68 usos y contamina 3 olas            | Resolverlo en la ola 0, antes de tocar ningún slice                                                              |
| **Pérdida silenciosa de funciones** en vistas de 2.000+ líneas                                                       | Alto: nadie lo nota hasta el cierre contable  | Inventario de capacidades por vista antes de tocarla; humo por slice                                             |
| **El equipo sigue trabajando en el legacy** durante la migración                                                     | Divergencia de ramas                          | Congelar funcionalidad nueva en `legacy/` durante las fases 1–2; después, toda función nueva se escribe en `v2/` |
| **Los exportes de Excel/PDF** son lógica de negocio disfrazada de formato (fórmulas vivas, outline, estilo de marca) | Alto: son entregables que salen de la empresa | Migrar tal cual, comparar el archivo generado byte a byte contra el del legacy                                   |
| **Auth**: la migración a cookies depende del backend                                                                 | Puede bloquear la ola 1                       | Decidirlo en la fase 0; si el backend no está listo, la ola 1 se reordena                                        |
| Tailwind 4 rompe estilos sin fallar                                                                                  | Difuso, se acumula                            | Revisión visual lado a lado en la fase 1, no al final                                                            |
| Fatiga: 21 slices es largo                                                                                           | Se afloja la receta y se degrada la calidad   | Una ola por vez, con despliegue de vista previa y métricas visibles                                              |

---

## Lo que este roadmap deliberadamente **no** hace

- **No rediseña el producto.** Ninguna fase cambia lo que ve el usuario, salvo por el cambio de
  sistema de diseño. Las mejoras de UX pendientes (dashboard, módulos placeholder, búsqueda
  global) son trabajo posterior, no parte de la migración.
- **No toca el backend.** Salvo la conversación sobre cookies de sesión, que es una petición,
  no un cambio unilateral.
- **No persigue cobertura de pruebas.** Se prueban las reglas de negocio puras, que es donde
  una prueba paga. Los componentes se verifican con el guion de humo.
- **No optimiza rendimiento** más allá de lo que Nuxt da gratis (división de código, imports
  dinámicos de las bibliotecas pesadas).

---

## Resumen ejecutable

| Fase                | Entregable                                                         | Señal de que terminó                                                             |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **0 · Preparar**    | Decisiones firmadas, pruebas en Vitest, inventarios, guion de humo | Las 3 decisiones bloqueantes están cerradas                                      |
| **1 · Trasladar**   | Una app Nuxt que hace todo lo del legacy                           | Las 67 rutas cargan; hay despliegue de vista previa                              |
| **2 · Reorganizar** | El código en la estructura del template                            | `app/legacy/` no existe; el alias `@` está eliminado                             |
| **3 · Migrar**      | Código que cumple `AGENTS.md`                                      | 0 imports de PrimeVue, 0 archivos sin TypeScript, 0 llamadas fuera de un service |
| **4 · Cerrar**      | Un solo repositorio, un solo producto                              | `legacy/` borrado, documentación reescrita                                       |
