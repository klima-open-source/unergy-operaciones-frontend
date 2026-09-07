# Contexto — Plataforma de Operaciones Unergy

> Documento 1 de 3. Explica **qué es la plataforma, qué hace el negocio, cómo está construida
> hoy (`legacy/`), qué es el template destino (`v2/`) y en qué consiste la tarea**.
> Los otros dos: [`02-specs.md`](./02-specs.md) (requerimientos de producto) y
> [`03-roadmap.md`](./03-roadmap.md) (plan de migración por fases).

---

## 1. Qué es la plataforma

**Unergy Operaciones** es la herramienta interna con la que el equipo de Unergy opera su
portafolio de generación solar distribuida en Colombia. No es un producto para clientes
finales: es el sistema de registro y de trabajo diario del equipo de operaciones, comercial,
comercialización de energía y finanzas.

La plataforma cubre el ciclo de vida completo de una planta solar:

```
Oportunidad comercial  →  Oferta firmada  →  Proyecto  →  Construcción y conexión
        ↓                                                        ↓
   Pipeline CRM                                     Registro CND/ASIC · Frontera comercial
        ↓                                                        ↓
   Contrato (PPA / Operación / Representación)  →  Energización  →  Operación
                                                                    ↓
                              Monitoreo · Fallas · Informes mensuales · Generación en vivo
                                                                    ↓
                      Mercado (XM/MEM): despachos, bolsa, cumplimiento PPA, garantías
                                                                    ↓
                      Liquidación mensual → Panel contable → Facturación → Mandatos
```

Es, en la práctica, cuatro productos que comparten sesión, catálogo de proyectos y navegación:

| Producto interno             | Usuarios                         | Qué resuelve                                                                |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| **Operaciones / O&M**        | operaciones, monitoreo, técnicos | Que las plantas generen: monitoreo, fallas, informes, pólizas               |
| **Comercialización / MEM**   | comercialización                 | Que la energía se venda bien: cumplimiento PPA, bolsa, fronteras, garantías |
| **Finanzas / Liquidaciones** | liquidaciones, contabilidad      | Que la plata cuadre: liquidación mensual, costos, mandatos, facturación     |
| **Comercial**                | comercial                        | Que entren proyectos: pipeline de ofertas y oportunidades                   |

Además hay una **app móvil PWA independiente** (`/m/*`) para monitoreo en campo y reporte de
fallas desde el celular, con su propio login, layout y navegación.

### URLs y entornos

| Entorno               | URL                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- |
| Producción (frontend) | `https://frontend-taupe-six-252g9aw47x.vercel.app` (Vercel, deploy en push a `master`) |
| API backend           | `https://operaciones.uner.gy` (Railway, FastAPI)                                       |
| Dev local             | `http://localhost:5173`, proxy `/api` → `localhost:8000`                               |

---

## 2. Glosario de dominio

Sin esto, la mitad del código es ilegible. Los términos aparecen en nombres de rutas,
endpoints, variables y componentes.

**Mercado de energía (Colombia)**

- **MEM** — Mercado de Energía Mayorista. El mercado donde se transa la energía.
- **XM** — el operador del mercado y del sistema (CND + ASIC). Publica precios, liquida
  despachos y emite facturas.
- **CND** — Centro Nacional de Despacho. Registra y aprueba plantas para operar.
- **ASIC** — Administrador del Sistema de Intercambios Comerciales. Liquida las transacciones.
- **GESCON** — sistema de XM para registrar contratos bilaterales de energía. Un contrato PPA
  del negocio se registra allí y adquiere un código GESCON.
- **Frontera comercial** — punto de medida registrado ante XM. Es la unidad de medición
  comercial: sin frontera, la energía no se puede transar ni liquidar.
- **Precio de bolsa** — precio spot horario del MEM. Lo que no está cubierto por contrato se
  compra/vende a bolsa.
- **Despacho** — energía asignada/liquidada por XM para un agente en un período.
- **TXF / TXR / TX3…TX8** — versiones del ciclo de liquidación de XM. `TXF` es la liquidación
  inicial; las `TXn` son reliquidaciones posteriores que corrigen la anterior.
- **Ajustes XM / Garantías** — ajustes que XM aplica sobre las liquidaciones y las garantías
  financieras que exige al agente.
- **ENSO / ONI** — índices climáticos (El Niño / La Niña) que correlacionan con el precio de
  bolsa; se usan como señal de trading.

**Negocio Unergy**

- **PPA** — Power Purchase Agreement: contrato de venta de energía a largo plazo, con
  compromisos de energía mínima/máxima por período y tarifas.
- **Contrato de servicio** — los otros servicios que Unergy presta sobre una planta:
  **Operación (O&M)**, **Representación** ante el mercado, **REC** (certificados renovables),
  **mantenimiento**.
- **Minigranja** — planta pequeña conectada a red que inyecta al MEM.
- **Autoconsumo / GD** — generación distribuida detrás del medidor del cliente.
- **Inversionista** — dueño del capital de una planta (o de una fracción). Recibe liquidación.
- **Mandato** — figura contractual por la cual Unergy factura y recauda en nombre del
  inversionista. Genera documentos firmados que hay que conciliar.
- **Liquidación** — cierre mensual por proyecto: ingresos, costos, neto, estado de resultados.
- **Arriendo** — pago al dueño del predio donde está la planta; se indexa por IPC.
- **OMA** — Operación y Mantenimiento Anual: contrato/factura del proveedor de O&M, indexado.
- **IPC / IPP** — índices de indexación que ajustan tarifas, arriendos y OMA.
- **Reto Q** — sistema interno de OKR trimestrales con métricas y matriz semanal.

**Integraciones externas**

- **Solenium** — proveedor de datos de inversores (generación por inversor).
- **Gaia** — medidores. Segunda fuente de generación, se cruza con Solenium para detectar
  desconexiones.
- **Quoia** — sistema de gestión de fronteras/energía de terceros.
- **Sun Factory (TSF)** — origen del pipeline comercial de proyectos próximos a energizar.
- **Google Drive / Gmail** — donde viven estados de resultados, soportes y correos del CGM.
- **Starlink** — conectividad de las plantas; sus facturas se procesan y reparten.
- **Agente local XM** — proceso que la usuaria corre en su propio computador
  (`http://127.0.0.1:8420`) porque el FTP de XM solo acepta IPs conocidas y Railway no puede
  llegar. El frontend le habla directo.

---

## 3. Arquitectura mental del producto (navegación real)

La navegación del sidebar es la mejor descripción de la arquitectura de información. Hoy
(`legacy/src/components/AppSidebar.vue`):

| Grupo                     | Entradas                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **General**               | Dashboard · Proyectos (vista unificada) · Operadores de Red · Próximos a energizar · Retos Q                    |
| **Comercial**             | Pipeline                                                                                                        |
| **Operaciones**           | Generación Solar · Informes Mensuales · Gestión de Fallas · Informe de Puesta en Marcha · Pólizas               |
| **Fronteras Comerciales** | General · Reporte de Energía                                                                                    |
| **Registros CND/ASIC**    | Proyectos en conexión                                                                                           |
| **Comercialización**      | Cumplimiento PPA · Descubrimientos · Garantías · GESCON/ASIC · Precio de Bolsa · Balance Energía · Clima & ENSO |
| **Finanzas**              | Liquidaciones (10 subentradas) · Panel Contable (4) · Herramientas liquidaciones (2) · Costos                   |
| **Alertas**               | Centro de Alertas                                                                                               |
| **Admin**                 | Usuarios · Diagnóstico (restringido por email)                                                                  |

Fuera del menú, alcanzables solo por navegación: detalles de cliente, proyecto, contrato,
liquidación, falla, informe, oportunidad, reto, operador de red y registro CND.

**Roles del sistema:** `admin`, `operaciones`, `monitoreo`, `liquidaciones`, `comercial`,
`coordinador`, `tecnico`. Hoy `admin` hace bypass de toda verificación.

---

## 4. Cómo está construido hoy (`legacy/`)

### Stack

| Capa       | Tecnología                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | Vue 3.4, Composition API, `<script setup>`                              |
| Build      | Vite 5 (SPA pura, sin SSR)                                              |
| Lenguaje   | **JavaScript** — cero archivos TypeScript                               |
| Router     | vue-router 4, rutas declaradas a mano en un solo archivo                |
| Estado     | Pinia 2 — **un solo store** (`auth`)                                    |
| HTTP       | Axios 1.7, instancia única con interceptores                            |
| UI         | **PrimeVue 4** (tema Aura + preset propio morado) + PrimeIcons          |
| CSS        | Tailwind 3 + estilos inline con hex de marca                            |
| Gráficas   | Chart.js 4 + vue-chartjs                                                |
| Mapas      | MapLibre GL                                                             |
| Documentos | xlsx, xlsx-js-style, exceljs, jspdf, jspdf-autotable, pdfjs-dist, jszip |
| Otros      | vuedraggable                                                            |
| Deploy     | Vercel (rewrites como proxy) + Dockerfile alterno (nginx)               |

### Estructura

```
legacy/src/
├── main.js            # bootstrap: Pinia, router, PrimeVue, componentes globales
├── App.vue            # shell: sidebar + main + Toast + ConfirmDialog
├── api/               # client.js (axios) + 3 clientes de API específicos
├── stores/auth.js     # el único store
├── router/index.js    # 75 rutas (67 vistas + 8 redirecciones) + guard
├── composables/       # 3 composables
├── constants/         # 1 archivo
├── utils/             # 20 utilidades puras + 5 tests .mjs caseros
├── assets/            # CSS global + datasets estáticos .js
├── components/        # 13 componentes compartidos + reports/
├── mobile/            # app PWA completa, aislada por carpeta y por ruta
└── views/             # 21 carpetas de módulo, ~150 vistas
```

### Números del codebase

| Métrica                                 | Valor                                                            |
| --------------------------------------- | ---------------------------------------------------------------- |
| Archivos en `src/`                      | 237                                                              |
| Líneas de código                        | ~95.000                                                          |
| Componentes `.vue`                      | 177 (176 con `<script setup>`)                                   |
| Archivos TypeScript                     | **0**                                                            |
| Archivos > 500 líneas                   | 56                                                               |
| Archivos > 1.000 líneas                 | 23 (el mayor: `CumplimientoV2View.vue`, 5.425)                   |
| Archivos que importan PrimeVue          | **120** de 237                                                   |
| Archivos con `style="…"` inline         | 158                                                              |
| Literales hex de la paleta hardcodeados | ~2.528                                                           |
| Endpoints distintos consumidos          | 341                                                              |
| Archivos que tocan `window.`            | 30                                                               |
| Archivos que tocan `document.`          | 26                                                               |
| Archivos que tocan `localStorage`       | 14                                                               |
| Tests                                   | 6 archivos `.test.mjs` con runner casero (`node`), sin framework |

### Patrones actuales

1. **Todo el estado es local a la vista.** `ref`/`reactive` dentro de cada `.vue`, sin capa de
   dominio. Cero stores fuera de `auth`.
2. **Las vistas llaman a la API directamente** con `api.get(...)` de axios. No hay services;
   las tres excepciones (`api/liquidacionesApi.js`, `garantiasProyecciones.js`, `xm.js`) son
   módulos de funciones sueltas.
3. **Los datos se cargan en `onMounted`** y se pintan; el estado de carga es un
   `ProgressSpinner` y el de error, un toast.
4. **Los colores de marca están escritos a mano** como hex en `style=` inline, no como tokens.
5. **Auth por JWT en `localStorage`**, decodificado en el cliente para sacar rol y nombre.
6. **Permisos por `meta.roles` en la ruta** + `auth.can(...roles)` en el sidebar, con bypass
   incondicional de `admin`.
7. **Excel y PDF se generan en el navegador**, con hojas de estilo y fórmulas construidas a
   mano (`cumplimientoMatrizExcel.js`, `excelExport.js`, `rptStyles.js`).
8. **Pegado desde Excel** como método de entrada masiva en varias vistas (tarifas, cantidades).
9. **Deep-links por query string** (`?tab=`, `?oferta=`, `?tipo=`) para que un estado de UI
   sobreviva un F5 y se pueda compartir.

### Deuda técnica conocida y ya documentada

- `SECURITY.md` del legacy documenta que el access token en `localStorage` **no protege ante
  XSS**, y que la solución real (refresh token en cookie `httpOnly`) exige backend. **El
  template v2 ya implementa exactamente ese esquema** — la migración lo resuelve de paso.
- Hay una CSP en modo _report-only_ en `index.html` que no se ha podido endurecer porque el
  código usa `style=` inline por todas partes.
- `composables/useSidebar.js` declara `ref` a nivel de módulo — inofensivo en una SPA,
  **prohibido y peligroso bajo SSR**.
- `views/Servicios/OperacionView.vue` define 8 componentes con `template:` como string, lo que
  obliga al build completo de Vue con compilador en runtime (alias en `vite.config.js`).
- Vistas muertas señaladas en la propia documentación: `FallasListView.vue`,
  `FallaDetalle.vue`, `MemPlaceholder.vue`.
- La documentación de arquitectura del legacy (`FRONTEND_ARCHITECTURE.md`) está desactualizada:
  describe 42 vistas cuando hay ~150, y rutas que ya no existen. `FRONTED.md` está más al día.

---

## 5. Qué es `v2/` (el template destino)

`v2/` es un template de consultoría ya configurado, **sin nada del dominio Unergy todavía**.
Su contrato está en `v2/AGENTS.md` y es de obligado cumplimiento.

### Stack

| Capa        | Tecnología                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | **Nuxt 4.5** + Vue 3.5 (SSR + Nitro)                                                                                            |
| Lenguaje    | **TypeScript estricto** — `any` prohibido sin excepciones                                                                       |
| Estilos     | **Tailwind 4** (CSS-first) + tokens semánticos + dark mode                                                                      |
| UI          | **shadcn-vue** (`components/ui/`, intocable) + **Gandalf** (`components/gandalf/`, sistema de diseño propio, también intocable) |
| Formularios | vee-validate + zod                                                                                                              |
| Gráficas    | `@unovis/vue` (vía el `chart` de shadcn)                                                                                        |
| Iconos      | `@lucide/vue`                                                                                                                   |
| Toasts      | vue-sonner                                                                                                                      |
| Estado      | `useState` / composables (`useAuth`, `useQuery`, `useFilters`, `usePagination`, `useDisclosure`) + Pinia disponible             |
| Tests       | Vitest                                                                                                                          |
| Calidad     | ESLint (`@nuxt/eslint`) + Prettier + husky + lint-staged                                                                        |
| Runtime     | Bun                                                                                                                             |

### Arquitectura que impone

```
app/
├── core/          # api, service, errors, logger, permissions — infraestructura
├── config/        # app.ts (por proyecto), navigation.ts, permissions.ts
├── types/         # tipos compartidos por más de un slice
├── utils/         # funciones puras (auto-import)
├── composables/   # estado reactivo compartido (auto-import)
├── features/      # slices verticales: services/, components/, types.ts
├── components/    # ui/ · gandalf/{base,kit} · blocks/ · layout/
├── layouts/       # default (shell con sidebar) · auth
├── middleware/    # auth.global.ts — el guard de páginas
└── pages/         # rutas (file-based routing)
server/
├── middleware/    # auth.ts — resuelve sesión e instala el guard
├── utils/         # session, guard, auth-api (único que conoce la API de auth)
├── api/           # endpoints JSON propios
└── routes/        # rutas navegables (OAuth)
```

### Las reglas que cambian cómo se escribe el código

Del `AGENTS.md`, las que más impactan esta migración:

1. **Services son los únicos que llaman a la API.** Nada de `$fetch` ni axios en componentes o
   composables. Un service extiende `BaseService` y vive en `features/<slice>/services/`.
2. **Nunca `any`**, tampoco `as any`. Si la forma es desconocida, `unknown` + narrowing.
3. **Prohibido magic strings.** Constantes tipadas o `enum` para estados, keys y rutas de API.
4. **Cero barrels propios.** Importar por ruta real con `~/…`.
5. **`ref` a nivel de módulo prohibido para datos de usuario** — bajo SSR es una fuga de datos
   entre usuarios, no una molestia de estilo. El estado por request va en `useState`.
6. **Tailwind siempre**, CSS custom solo si es estrictamente imposible.
7. **Gandalf primero, shadcn después.** `ui/` y `gandalf/` son intocables (código vendido).
   `gandalf/` es genérico: nada de `Factura` ni `Cliente` ahí.
8. **Permisos deny-by-default.** Rol desconocido → sin permisos. Ruta no declarada → denegada.
   Un endpoint propio sin `requirePermission` lo detecta un test.
9. **Errores por `normalizeError` → `AppError`.** Nada de `console.error` suelto: `logger.error`.
10. **Cero exports sin consumidor.** La tercera repetición justifica una abstracción.
11. **Definición de terminado:** `bun run lint`, `bun run typecheck` y `bun run test` en verde.

### Lo que el template ya trae resuelto

- Autenticación completa con **cookies `httpOnly`** puestas por rutas Nitro propias; el
  navegador nunca habla con la API de auth, y el `access_token` no toca el cliente.
- Sistema de permisos por capacidad (`recurso:acción`) con matriz rol → permisos y matriz
  ruta → permiso, aplicado en middleware global (SSR y navegación de cliente) y por endpoint.
- Layout con sidebar inset, header, navegación derivada de `config/navigation.ts`.
- `useQuery` + `AsyncView` para los cuatro estados de una llamada (cargando, error, vacío, dato).
- Login con password y/o Google, ambos tras feature flag.
- Modo sin backend (`NUXT_PUBLIC_AUTH_ENABLED=false`) para trabajar la UI en seco.

---

## 6. El delta: `legacy/` → `v2/`

Esta tabla es el mapa de todo lo que hay que traducir. Cada fila es trabajo real.

| Eje        | Legacy                                         | v2                                                 | Impacto                                  |
| ---------- | ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| Framework  | Vite SPA, `main.js`                            | Nuxt 4 SSR + Nitro                                 | Bootstrap, layouts, plugins              |
| Lenguaje   | JavaScript                                     | TypeScript estricto                                | **237 archivos a tipar**                 |
| Routing    | `router/index.js`, 75 rutas a mano             | file-based `app/pages/`                            | 67 archivos de página                    |
| Auth       | JWT en `localStorage`, Pinia                   | cookies `httpOnly` + `useState` + Nitro            | Reescribir el flujo completo             |
| Permisos   | `meta.roles` + bypass de `admin`               | tags `recurso:acción`, deny-by-default, sin bypass | Rediseñar la matriz de acceso            |
| HTTP       | axios global, llamado desde vistas             | services `extends BaseService`, ofetch             | **341 endpoints a encapsular**           |
| UI         | PrimeVue 4                                     | shadcn-vue + Gandalf                               | **120 archivos** con imports de PrimeVue |
| Iconos     | PrimeIcons (`pi pi-*`)                         | `@lucide/vue`                                      | Mapeo 1:1, mecánico pero masivo          |
| Estilos    | Tailwind 3 + hex inline                        | Tailwind 4 + tokens semánticos                     | **~2.528 hex, 158 archivos**             |
| Estado     | `ref` locales + `ref` de módulo                | `useState`, composables                            | Auditoría SSR obligatoria                |
| Feedback   | `useToast` de PrimeVue + `window.__primeToast` | vue-sonner                                         | 75 llamadas a `useToast`                 |
| Gráficas   | Chart.js + vue-chartjs (12 archivos)           | `@unovis/vue`                                      | Reescribir 12 gráficas                   |
| Errores    | interceptor axios + toast                      | `normalizeError`/`AppError` + `logger`             | Homogeneizar                             |
| Tests      | 6 `.test.mjs`, runner casero                   | Vitest                                             | Portar + ampliar                         |
| Deploy     | Vercel rewrites como proxy                     | Nitro (routes/proxy propios)                       | Reconfigurar                             |
| Documentos | xlsx/exceljs/jspdf/pdfjs en el cliente         | igual, pero **client-only**                        | Aislar del SSR                           |
| Mapas      | maplibre-gl                                    | igual, **client-only**                             | Aislar del SSR                           |

### Lo que **no** cambia

- La API backend. Los 341 endpoints siguen siendo los mismos; solo cambia quién los llama.
- Las reglas de negocio: conciliación de mandatos, cálculo de estado de resultados, validación
  de contratos, parseo COP, cálculo fasorial, vigencia de PPA. Son funciones puras en `utils/`
  y se migran casi textualmente (a TypeScript).
- Las bibliotecas de documentos (xlsx, exceljs, jspdf, pdfjs, jszip) y de mapas. No hay
  equivalente mejor y reescribirlas no aporta.
- La arquitectura de información: los grupos de navegación y las rutas del usuario.

---

## 7. La tarea

Migrar `legacy/` a `v2/` aplicando buena ingeniería, en tres fases sucesivas:

1. **Trasladar** los archivos y carpetas de `legacy/` a `v2/` tal cual están, y dejar la app
   corriendo.
2. **Reorganizar** en la estructura de `v2/`, asegurando que todos los imports sigan
   funcionando.
3. **Migrar progresivamente** el código a las reglas, patrones y estándares del template,
   refactorizando lo necesario.

El plan detallado, con entregables y criterios de aceptación por fase, está en
[`03-roadmap.md`](./03-roadmap.md).

### Principios que rigen la migración

- **Ninguna funcionalidad se pierde en silencio.** Si algo se descarta, se descarta
  explícitamente y queda escrito (ver la lista de candidatos en `02-specs.md`).
- **La app corre en todo momento.** Ninguna fase termina con la aplicación rota. Se migra por
  rebanadas verticales, no por capas horizontales.
- **Refactor solo en la fase 3.** Mezclar traslado con rediseño es la forma más segura de no
  poder distinguir un bug nuevo de una diferencia de comportamiento.
- **El legacy es la especificación.** Ante una duda de comportamiento, el código de `legacy/`
  manda sobre su documentación, que en varios puntos está desactualizada.

### Restricciones

- El equipo sigue usando la plataforma en producción durante la migración. Cualquier cambio de
  comportamiento visible debe ser intencional y anunciado.
- La API backend no se modifica como parte de esta migración. Si un endpoint estorba, se
  documenta como petición al backend, no se cambia por cuenta propia.
- `app/components/ui/` y `app/components/gandalf/` son intocables: son código vendido que
  sincroniza el sistema de diseño.
