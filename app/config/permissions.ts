import { UserRole } from '~/types/user'

/**
 * What can be done, as `resource:action` — the convention OAuth scopes, GitHub
 * tokens and most RBAC systems use, and for the same reason: it names a
 * capability instead of a place in the UI. A permission like `invoices:delete`
 * still means the same thing after the page that used it is renamed, moved or
 * removed.
 *
 * Add one when something in the app needs it, not before. Every entry here has
 * a caller; a permission nobody asks for protects nothing.
 *
 * Derivado de `contexto/inventario-rutas.md` (roles reales del router legacy,
 * fase 3 ola 1). Todo es `:read` hoy porque las 67 páginas son pantallas de
 * consulta — una acción que mute algo pide su propio permiso de endpoint
 * (`event.context.requirePermission`), no uno de página.
 */
export type Permission =
  | 'dashboard:read'
  | 'clientes:read'
  | 'proyectos:read'
  | 'servicios:read'
  | 'general:read'
  | 'retos:read'
  | 'mem-mercado:read'
  | 'comercial:read'
  | 'informes:read'
  | 'fallas:read'
  | 'solar:read'
  | 'alertas:read'
  | 'alertas-ppa:read'
  | 'informe-om:read'
  | 'polizas:read'
  | 'mem-frontera:read'
  | 'registros-cnd:read'
  | 'liquidaciones:read'
  | 'reconectadores:command'
  | 'admin:manage'

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.OPERACIONES]: 'Operaciones',
  [UserRole.MONITOREO]: 'Monitoreo',
  [UserRole.LIQUIDACIONES]: 'Liquidaciones',
  [UserRole.COMERCIAL]: 'Comercial',
  [UserRole.COORDINADOR]: 'Coordinador',
  [UserRole.TECNICO]: 'Técnico',
}

/** Lo que cualquier sesión autenticada puede ver — el router legacy no le pone rol. */
const BASE_PERMISSIONS: readonly Permission[] = [
  'dashboard:read',
  'clientes:read',
  'proyectos:read',
  'servicios:read',
  'general:read',
  'retos:read',
  'mem-mercado:read',
]

/**
 * What each role may do. This is the whole authorization model, and the one
 * thing both halves of the app share: a permission means the same for a page
 * and for an endpoint, so defining it twice would be two definitions to keep
 * in sync.
 *
 * Read it as a grant list, and grant explicitly: a role holds exactly what is
 * written here. Deny by default then falls out of the data instead of being a
 * check someone can forget — a role the backend invents tomorrow arrives with
 * an empty grant list and can do nothing until you decide otherwise.
 *
 * `admin` no tiene bypass en código: recibe cada permiso explícitamente, igual
 * que cualquier otro rol. Es lo mismo que el atajo del legacy (`role === 'admin'`
 * siempre pasa) pero sin un caso especial que se pueda olvidar al agregar un
 * permiso nuevo.
 */
export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: [
    'dashboard:read',
    'clientes:read',
    'proyectos:read',
    'servicios:read',
    'general:read',
    'retos:read',
    'mem-mercado:read',
    'comercial:read',
    'informes:read',
    'fallas:read',
    'solar:read',
    'alertas:read',
    'alertas-ppa:read',
    'informe-om:read',
    'polizas:read',
    'mem-frontera:read',
    'registros-cnd:read',
    'liquidaciones:read',
    'reconectadores:command',
    'admin:manage',
  ],
  [UserRole.OPERACIONES]: [
    ...BASE_PERMISSIONS,
    'informes:read',
    'fallas:read',
    'solar:read',
    'alertas:read',
    'alertas-ppa:read',
    'informe-om:read',
    'polizas:read',
    'mem-frontera:read',
    'registros-cnd:read',
    // Mismo criterio que `ROLES_COMANDO` del backend.
    'reconectadores:command',
  ],
  [UserRole.MONITOREO]: [
    ...BASE_PERMISSIONS,
    'informes:read',
    'fallas:read',
    'solar:read',
    'alertas:read',
  ],
  [UserRole.LIQUIDACIONES]: [...BASE_PERMISSIONS, 'liquidaciones:read'],
  [UserRole.COMERCIAL]: [...BASE_PERMISSIONS, 'comercial:read'],
  [UserRole.COORDINADOR]: [...BASE_PERMISSIONS],
  [UserRole.TECNICO]: [...BASE_PERMISSIONS],
} as const satisfies Record<UserRole, readonly Permission[]>

/**
 * Reachable without a session. Matched by prefix, so '/login' also covers
 * '/login/callback'. Everything else requires one — that part stays central,
 * because a route that forgets to authenticate must not be a route that opens.
 *
 * `/api/auth` and `/auth/google` are here for the same reason `/login` is: they
 * are how a visitor *gets* a session, so requiring one would close the door
 * from the inside.
 */
export const AUTH_PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/logout',
  '/authorize',
  '/auth/google',
  '/api/auth',
] as const

/**
 * Which permission each **page** needs. Pages are a tree the user navigates, so
 * they are declared as a tree and enforced once, in the global route middleware,
 * before any page renders: every page needs an entry and one that is missing is
 * denied, so a new page fails loudly on the first click instead of shipping open.
 *
 * This is the page axis and only the page axis. Endpoints under `/api/` are
 * deliberately absent — not because a table could not hold them (the value
 * could be keyed by method), but because page access and API access are things
 * you want to move independently: showing someone a screen and letting them
 * call the endpoint behind it are separate decisions. Endpoints ask for their
 * own permission, per method, in the handler.
 *
 * La app móvil (`/m/*`) no está aquí: tiene su propio guard
 * (`app/middleware/mobile.global.ts`), con navegación por rol propia que no
 * encaja en "permitido/denegado" — `auth.global.ts` la deja pasar de largo.
 *
 * Cada entrada es un prefijo: cubre la ruta y todo lo que cuelga de ella
 * (`/proyectos` también autoriza `/proyectos/:id/ppa`). Cuando una hija necesita
 * un permiso más estricto que su padre, se declara aparte y gana por ser el
 * prefijo más largo — así `/alertas/contratos-ppa` no hereda el permiso de
 * `/alertas`.
 */
export const AUTH_ROUTE_PERMISSIONS = {
  '/': 'dashboard:read',
  '/dashboard': 'dashboard:read',
  '/clientes': 'clientes:read',
  '/proyectos': 'proyectos:read',
  '/servicios': 'servicios:read',
  '/servicios-unificado': 'servicios:read',
  '/contratos': 'servicios:read',
  '/general/proximos-energizar': 'general:read',
  '/general/retos': 'retos:read',
  '/mem/precio-bolsa': 'mem-mercado:read',
  '/mem/balance': 'mem-mercado:read',
  '/mem/clima': 'mem-mercado:read',
  '/mem/cumplimiento': 'mem-mercado:read',
  '/mem/descubrimientos': 'mem-mercado:read',
  '/comercial': 'comercial:read',
  '/operaciones/informes-mensuales': 'informes:read',
  '/informes': 'informes:read',
  '/operaciones/gestion-fallas': 'fallas:read',
  '/fallas': 'fallas:read',
  '/solar-live': 'solar:read',
  '/alertas': 'alertas:read',
  '/alertas/contratos-ppa': 'alertas-ppa:read',
  '/operaciones/informe-om': 'informe-om:read',
  '/operaciones/polizas': 'polizas:read',
  '/mem/gescon': 'mem-frontera:read',
  '/mem/fronteras': 'mem-frontera:read',
  '/mem/reporte-energia': 'mem-frontera:read',
  '/mem/operadores-red': 'mem-frontera:read',
  '/registros-cnd-asic': 'registros-cnd:read',
  '/liquidaciones': 'liquidaciones:read',
  '/panel-contable': 'liquidaciones:read',
  '/finanzas': 'liquidaciones:read',
  '/validador-mandatos': 'liquidaciones:read',
  '/garantias': 'liquidaciones:read',
  // El router legacy dejaba `/admin/usuarios` en admin+operaciones, pero el
  // menú (`LEGACY_NAV_ITEMS`) la restringía además a un correo puntual
  // (`EMAIL_ADMIN_PLATAFORMA`) — algo que este modelo rol→permiso no expresa.
  // Entre ampliar a operaciones o quedarse corto, gana quedarse corto: solo
  // admin. Si alguien de operaciones la necesitaba, hay que dárselo a propósito.
  '/admin': 'admin:manage',
} as const satisfies Record<string, Permission>
