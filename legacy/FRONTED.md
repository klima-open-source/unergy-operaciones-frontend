# Plataforma Operaciones Unergy — Frontend

## Qué es esto

Dashboard web para el equipo interno de operaciones de Unergy. Gestiona proyectos
solares, clientes, contratos/servicios, fallas, generación, alertas, liquidaciones,
garantías y el módulo MEM (mercado de energía mayorista).

## Stack

- **Vue 3** (Composition API + `<script setup>`)
- **Vite 5** (bundler)
- **PrimeVue 4** (componentes UI — tema **Aura** con preset propio `UnergPreset` en morado)
- **Pinia 2** (estado global)
- **Vue Router 4** (rutas + guard de auth/roles)
- **Axios** (cliente HTTP con JWT automático)
- **Tailwind CSS 3** (estilos utilitarios)
- **Chart.js 4** + **vue-chartjs** (gráficas)
- **MapLibre GL** (mapas de fallas/fronteras)
- **xlsx** / **xlsx-js-style** (exportar/leer Excel)
- **vuedraggable** (drag & drop, ej. kanban de fallas)

## URLs

- **Producción:** https://frontend-taupe-six-252g9aw47x.vercel.app
- **API backend:** https://operaciones.uner.gy
- **Dev local:** http://localhost:5173 (proxea `/api` a localhost:8000)

## Estructura de carpetas

```
src/
├── main.js              # Inicializa Vue, Pinia, Router, PrimeVue (preset UnergPreset),
│                        #   Toast/Confirmation services, registra InfoField y PageHeader globales
├── App.vue              # Layout raíz: <AppSidebar> + <main><RouterView></main> + <Toast> + <ConfirmDialog>
├── api/
│   └── client.js        # Axios: baseURL /api/v1, JWT automático, redirect 401, toast 403
├── stores/
│   └── auth.js          # useAuthStore: login, logout, token, user, role, can(); decodifica JWT
├── router/
│   └── index.js         # Rutas + guard (auth, meta.roles, meta.requireEmail)
├── composables/
│   ├── useSidebar.js            # estado del sidebar (colapsado / móvil) + localStorage
│   └── useEnergizationProjects.js  # proyectos próximos a energizarse
├── constants/
│   └── liquidaciones.js
├── utils/
│   ├── liquidaciones.js         # construirEstadoResultados() y cálculos
│   ├── proyectoActivo.js
│   └── rptStyles.js             # estilos de informes/reportes
├── assets/
│   ├── main.css                 # estilos globales (fondo avena, etc.)
│   └── *.js                     # datasets estáticos (ipc, arriendos, facturas, contratos CGM)
├── components/
│   ├── AppSidebar.vue           # menú lateral por grupos (navGroups), colapsable
│   ├── AppTopbar.vue
│   ├── PageHeader.vue           # header de página estándar (global)
│   ├── InfoField.vue            # campo etiqueta/valor (global)
│   ├── NuevoClienteDialog.vue
│   └── ProyectosProximosEnergizar.vue
└── views/
    ├── LoginView.vue · ForgotPasswordView.vue · ResetPasswordView.vue   # públicas
    ├── DashboardView.vue
    ├── Clientes/        # ClientesListView, ClienteDetailView, ClienteForm
    ├── Proyectos/       # ProyectosListView, ProyectoDetailView, ProyectoForm
    ├── Servicios/       # PPAView, OperacionView, RepresentacionView, FacturasMantenimiento
    ├── Contratos/       # ContratosListView, ContratoDetailView, ContratoServicioWizard, PPAContratoWizard
    ├── Fallas/          # MonitoreoView, FallaDetailView/Detalle, FallaForm, FallaArchivos,
    │                    #   CalendarioFallas, FallasMapView, FallasListView
    ├── Operaciones/     # InformesMensualesView (+ paneles), InformeDetailView, GestionFallasView,
    │                    #   GeneracionView, EnvioMensualPanel, PortafoliosGestionPanel
    ├── Solar/           # SolarView, SolarLiveView
    ├── GeneracionSolarView.vue
    ├── Alertas/         # AlertasView, AlertasMonitoreoView, AlertasContratosPPAView
    ├── Liquidaciones/   # LiquidacionesView, LiquidacionDetailView, LiquidacionPdfView,
    │                    #   LiquidacionesPorInversionistaView, CargaExcelView, TablaDetalleLiquidacion
    │                    #   + components/ (EstadoResultados, charts) + panels/
    ├── Finanzas/        # CostosView, OMAOperaciones, OMAProveedor
    ├── Garantias/       # GarantiasView
    ├── MEM/             # CumplimientoV2View, DescubrimientosView, GesconView, FronterasView,
    │                    #   PrecioBolsaView, BalanceView, ClimaView
    └── Admin/           # AdminUsuariosView, UsuarioForm, ApiKeysDialog, DiagnosticoEnlacesView
```

## Layout raíz (App.vue)

- En rutas públicas (`/login`, etc.) renderiza solo el `<RouterView>`.
- En el resto: `<AppSidebar>` + `<main>` con scroll. El sidebar es **colapsable** y
  **responsive** (overlay móvil con botón hamburguesa) vía el composable `useSidebar`.
- `<Toast position="top-right">` y `<ConfirmDialog>` montados a nivel global.

## Colores de marca (Unergy)

Definidos en `tailwind.config.js` bajo el namespace `unergy`:

```js
purple:        '#915BD8'   // Púrpura Energético — principal, botones, activos
deep:          '#2C2039'   // Púrpura Profundo — sidebar, textos oscuros
avena:         '#FDFAF7'   // Avena — fondo general
yellow:        '#F6FF72'   // Amarillo Solar — acentos, CTAs especiales
'purple-light':'#B08AE2'
'purple-dark': '#6E3FB8'
'deep-light':  '#3D2F52'
```

Usar con clases `text-unergy-purple`, `bg-unergy-deep`, etc., o con `style=""`.
El preset de PrimeVue (`UnergPreset` en `main.js`) mapea `primary` al morado, así que
los componentes de PrimeVue salen en la paleta de marca por defecto.

**Tipografías:** `font-display` (Forma DJR Display / Inter) y `font-body` (Lato / Inter).

## Logos disponibles (en /public/logos/)

- `Logo_avena.png` — horizontal blanco (fondos oscuros)
- `Logo_lineal_purpura_energico.png` — horizontal púrpura
- `Logo_linea_purpura_profundo.png` — horizontal púrpura profundo
- `Stacked_Logo_pupura_energico.png` — apilado púrpura
- `Icono_purpura_energico.png` / `Icono_purpura_profundo.png` — solo ícono

## Rutas y menú lateral

Las rutas viven en `src/router/index.js`. El menú lateral se arma en
`AppSidebar.vue` a partir del array **`navGroups`**, organizado en grupos:

| Grupo                | Entradas (ruta → label)                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **General**          | `/dashboard` · `/clientes` · `/proyectos` · `/servicios`                                                                          |
| **Operaciones**      | `/solar-live` · `/operaciones/informes-mensuales` · `/fallas` · `/alertas/monitoreo` (Alarmas MGS) · `/mem/fronteras`             |
| **Comercialización** | `/mem/cumplimiento` · `/mem/descubrimientos` · `/garantias` · `/mem/gescon` · `/mem/precio-bolsa` · `/mem/balance` · `/mem/clima` |
| **Finanzas**         | `/liquidaciones` · `/liquidaciones?tab=inversionistas` · `/liquidaciones?tab=cargar` · `/finanzas/costos`                         |
| **Alertas**          | `/alertas` (Centro de Alertas)                                                                                                    |
| **Admin**            | `/admin/usuarios` · `/admin/diagnostico` (solo email `juanjose@unergy.io`)                                                        |

> Detalle de proyecto/contrato (`/proyectos/:id`, `/contratos/:id`, `/liquidaciones/:id`, etc.)
> se navega desde las listas, no desde el menú.

## Roles y permisos

Roles del sistema: `admin` · `operaciones` · `monitoreo` · `liquidaciones`.
El guard de router lee `meta.roles` de cada ruta y `auth.can(...roles)`.
**`admin` siempre pasa** (`can()` lo permite explícitamente).

```js
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()

auth.user // { id, rol, nombre, email }
auth.role // 'admin' | 'operaciones' | 'monitoreo' | 'liquidaciones'
auth.isAuthenticated // true/false (valida también expiración del JWT)
auth.can('admin', 'operaciones') // true si el rol está en la lista (o es admin)
auth.login(email, password) // POST /api/v1/auth/token (form-urlencoded)
auth.logout()
```

El store reconstruye el usuario decodificando el payload del JWT si `localStorage.user`
se perdió pero el token sigue vivo.

## Cómo agregar una vista nueva

### 1. Crear el archivo de vista

```vue
<!-- src/views/MiModulo/MiModuloListView.vue -->
<template>
  <div class="space-y-4">
    <PageHeader title="Mi Módulo">
      <template #actions>
        <button
          @click="abrirForm"
          class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style="background: #915BD8;"
        >
          + Nuevo
        </button>
      </template>
    </PageHeader>

    <div class="rounded-xl bg-white shadow-sm" style="border: 1px solid #e8e0f0;">
      <!-- tabla o lista -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api/client'

const items = ref([])
onMounted(async () => {
  const { data } = await api.get('/mi-modulo')
  items.value = data
})
</script>
```

### 2. Agregar la ruta (`src/router/index.js`)

```js
{ path: '/mi-modulo', name: 'MiModulo',
  component: () => import('@/views/MiModulo/MiModuloListView.vue'),
  meta: { roles: ['admin', 'operaciones'] } }   // omitir meta.roles si es pública para todo logueado
```

### 3. Agregar al menú (`src/components/AppSidebar.vue` → `navGroups`)

```js
// dentro del grupo correspondiente, en su array items:
{ to: '/mi-modulo', label: 'Mi Módulo', icon: 'pi pi-star', roles: ['admin', 'operaciones'] }
```

`roles` (y `requireEmail`) en el item del sidebar lo ocultan a quien no corresponda;
el guard del router hace cumplir el permiso aunque alguien entre por URL.

## Llamadas a la API

```js
import api from '@/api/client'

const { data } = await api.get('/proyectos?page=1&size=20') // data.items, data.total, data.page
const { data } = await api.post('/proyectos', { nombre: '...', cliente_id: '...' })
await api.put(`/proyectos/${id}`, payload)
await api.delete(`/proyectos/${id}`)
```

- `baseURL` = `VITE_API_BASE_URL` o `/api/v1` por defecto.
- El JWT (`localStorage.token`) se adjunta automáticamente en cada request.
- **401** → limpia sesión y redirige a `/login`.
- **403** → muestra un toast de "Acceso denegado" con el `detail` del backend.

## Componentes y servicios globales

Registrados en `main.js` (no requieren import en cada vista):

- **`<PageHeader>`** — header de página estándar (título + slot de acciones).
- **`<InfoField>`** — campo etiqueta/valor para detalles.
- **ToastService** (`useToast`) y **ConfirmationService** (`useConfirm`) de PrimeVue.

PrimeVue (importar desde `primevue/<nombre>`): `DataTable`+`Column`, `Dialog`,
`InputText`/`Textarea`/`Select`, `Button`, `Tag`, `Card`. Gráficas con `vue-chartjs`.

```js
import { useToast } from 'primevue/usetoast'
const toast = useToast()
toast.add({ severity: 'success', summary: 'Guardado', life: 3000 })
```

## Íconos

**PrimeIcons**, prefijo `pi pi-`:
`pi-home` `pi-bolt` `pi-building` `pi-dollar` `pi-wrench` `pi-bell` `pi-sun`
`pi-globe` `pi-shield` `pi-file-edit` `pi-exclamation-triangle` `pi-check` `pi-times`
`pi-pencil` `pi-trash` `pi-plus` `pi-search`. Lista: https://primevue.org/icons/

## Variables de entorno (.env local)

```
VITE_API_BASE_URL=/api/v1     # usado por api/client.js (default /api/v1, proxy de Vite al backend)
VITE_API_URL=                 # usado por stores/auth.js para el login (default "", mismo origen)
```

En dev, Vite proxea `/api` → `http://localhost:8000`, así que normalmente basta con
los valores por defecto.

## Correr localmente

```bash
npm install
npm run dev
# Disponible en http://localhost:5173
# Requiere el backend corriendo en localhost:8000
```

## Producción

- **Plataforma:** Vercel
- **Deploy:** automático al hacer push a `master` en GitHub
- **Build:** `npm run build` (output `dist/`)

## Convenciones de estilo

- Fondo de página: `#FDFAF7` (avena) — definido globalmente.
- Cards/paneles: `bg-white rounded-xl` con `border: 1px solid #e8e0f0`.
- Textos principales: `color: #2C2039`; secundarios/labels: `color: #6b5a8a`.
- Botón primario: `background: #915BD8; color: white`.
- No usar colores hardcodeados fuera de la paleta Unergy.
- Espaciado entre secciones: `space-y-4` / `space-y-6`.
- Usar `<PageHeader>` para los encabezados de vista (consistencia entre módulos).
