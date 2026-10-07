import type { Component } from 'vue'
import type { Permission } from '~/config/permissions'
import {
  BookIcon,
  BriefcaseIcon,
  CalculatorIcon,
  ChartColumnIcon,
  ChartLineIcon,
  CircleAlertIcon,
  ClockIcon,
  CloudIcon,
  CreditCardIcon,
  DatabaseIcon,
  DollarSignIcon,
  FilePenIcon,
  FileTextIcon,
  FlagIcon,
  GlobeIcon,
  HouseIcon,
  LinkIcon,
  NetworkIcon,
  ShieldIcon,
  SunIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
  ZapIcon,
} from '@lucide/vue'

/**
 * The buckets the sidebar renders, in this order. A group with no visible items
 * is not rendered, so adding one costs an entry here and a label below.
 */
export enum NavigationGroup {
  General = 'general',
  Comercial = 'comercial',
  Operaciones = 'operaciones',
  Fronteras = 'fronteras',
  RegistrosCnd = 'registros-cnd',
  Comercializacion = 'comercializacion',
  Finanzas = 'finanzas',
  Alertas = 'alertas',
  Admin = 'admin',
}

export const NAVIGATION_GROUP_LABELS: Record<NavigationGroup, string> = {
  [NavigationGroup.General]: 'General',
  [NavigationGroup.Comercial]: 'Comercial',
  [NavigationGroup.Operaciones]: 'Operaciones',
  [NavigationGroup.Fronteras]: 'Fronteras Comerciales',
  [NavigationGroup.RegistrosCnd]: 'Registros CND/ASIC',
  [NavigationGroup.Comercializacion]: 'Comercialización',
  [NavigationGroup.Finanzas]: 'Finanzas',
  [NavigationGroup.Alertas]: 'Alertas',
  [NavigationGroup.Admin]: 'Admin',
}

/** Un hijo de submenú: solo destino y etiqueta, sin icono propio. */
export interface NavigationSubItem {
  title: string
  to: string
}

export interface NavigationItem {
  title: string
  icon: Component
  group: NavigationGroup
  /** Ausente cuando el item solo despliega un submenú (ver `children`). */
  to?: string
  /**
   * Hides the item when the user lacks it. Presentation only — the route
   * middleware is what enforces the page, and it looks the permission up in
   * AUTH_ROUTE_PERMISSIONS. Keep the two in agreement or the menu will offer a
   * link that 403s. Con `children`, el permiso cubre al padre y a todos los
   * hijos por igual: comparten rol en `contexto/inventario-rutas.md`.
   */
  requiredPermission: Permission
  /** Submenú colapsable. Cuando está presente, el item no navega por sí mismo. */
  children?: NavigationSubItem[]
}

// ─── Navigation items ─────────────────────────────────────────────────────────
// Add/remove items here. The sidebar derives from this list. Fusionado con lo
// que era `LEGACY_NAV_ITEMS` en la fase 3, ola 1: cada `roles: [...]` del router
// legacy ya se tradujo a un permiso en `~/config/permissions`.
export const NAVIGATION_ITEMS: NavigationItem[] = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    title: 'Dashboard',
    icon: HouseIcon,
    to: '/dashboard',
    group: NavigationGroup.General,
    requiredPermission: 'dashboard:read',
  },
  // Reemplaza a las tres entradas que había antes (Clientes, Proyectos y
  // Servicios). La base es el portafolio de plantas, y clientes y contratos son
  // formas de reagrupar ese mismo portafolio. Las rutas /clientes, /proyectos y
  // /servicios siguen vivas: solo salieron del menú.
  {
    title: 'Proyectos',
    icon: ZapIcon,
    to: '/servicios-unificado',
    group: NavigationGroup.General,
    requiredPermission: 'servicios:read',
  },
  {
    title: 'Operadores de Red',
    icon: NetworkIcon,
    to: '/mem/operadores-red',
    group: NavigationGroup.General,
    requiredPermission: 'mem-frontera:read',
  },
  {
    title: 'Próximos a energizar',
    icon: ClockIcon,
    to: '/general/proximos-energizar',
    group: NavigationGroup.General,
    requiredPermission: 'general:read',
  },
  {
    title: 'Retos Q',
    icon: FlagIcon,
    to: '/general/retos',
    group: NavigationGroup.General,
    requiredPermission: 'retos:read',
  },

  // ── Comercial ──────────────────────────────────────────────────────────────
  {
    title: 'Pipeline',
    icon: BriefcaseIcon,
    to: '/comercial',
    group: NavigationGroup.Comercial,
    requiredPermission: 'comercial:read',
  },

  // ── Operaciones ────────────────────────────────────────────────────────────
  {
    title: 'Generación Solar',
    icon: SunIcon,
    to: '/solar-live',
    group: NavigationGroup.Operaciones,
    requiredPermission: 'solar:read',
  },
  {
    title: 'Informes Mensuales',
    icon: FilePenIcon,
    to: '/operaciones/informes-mensuales',
    group: NavigationGroup.Operaciones,
    requiredPermission: 'informes:read',
  },
  {
    title: 'Gestión de Fallas',
    icon: WrenchIcon,
    to: '/fallas',
    group: NavigationGroup.Operaciones,
    requiredPermission: 'fallas:read',
  },
  {
    title: 'Informe de Puesta en Marcha',
    icon: FileTextIcon,
    to: '/operaciones/informe-om',
    group: NavigationGroup.Operaciones,
    requiredPermission: 'informe-om:read',
  },
  {
    title: 'Pólizas',
    icon: ShieldIcon,
    to: '/operaciones/polizas',
    group: NavigationGroup.Operaciones,
    requiredPermission: 'polizas:read',
  },

  // ── Fronteras Comerciales ──────────────────────────────────────────────────
  {
    title: 'General',
    icon: GlobeIcon,
    to: '/mem/fronteras',
    group: NavigationGroup.Fronteras,
    requiredPermission: 'mem-frontera:read',
  },
  {
    title: 'Reporte de Energía',
    icon: FilePenIcon,
    to: '/mem/reporte-energia',
    group: NavigationGroup.Fronteras,
    requiredPermission: 'mem-frontera:read',
  },

  // ── Registros CND/ASIC ─────────────────────────────────────────────────────
  {
    title: 'Proyectos en conexión',
    icon: FlagIcon,
    to: '/registros-cnd-asic',
    group: NavigationGroup.RegistrosCnd,
    requiredPermission: 'registros-cnd:read',
  },

  // ── Comercialización ───────────────────────────────────────────────────────
  {
    title: 'Cumplimiento PPA',
    icon: ShieldIcon,
    to: '/mem/cumplimiento',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },
  {
    title: 'Descubrimientos',
    icon: ZapIcon,
    to: '/mem/descubrimientos',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },
  {
    title: 'SIMEM',
    icon: DatabaseIcon,
    to: '/mem/simem',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },
  {
    title: 'Garantías',
    icon: WalletIcon,
    to: '/garantias',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'liquidaciones:read',
  },
  {
    title: 'GESCON / ASIC',
    icon: BookIcon,
    to: '/mem/gescon',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-frontera:read',
  },
  {
    title: 'Precio de Bolsa',
    icon: ChartLineIcon,
    to: '/mem/precio-bolsa',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },
  {
    title: 'Balance Energía',
    icon: ChartColumnIcon,
    to: '/mem/balance',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },
  {
    title: 'Clima & ENSO',
    icon: CloudIcon,
    to: '/mem/clima',
    group: NavigationGroup.Comercializacion,
    requiredPermission: 'mem-mercado:read',
  },

  // ── Finanzas ───────────────────────────────────────────────────────────────
  {
    title: 'Liquidaciones',
    icon: DollarSignIcon,
    group: NavigationGroup.Finanzas,
    requiredPermission: 'liquidaciones:read',
    children: [
      // Entrada directa: antes solo se llegaba a la pestaña de Facturación
      // entrando por Panel Contable → Minigranjas/Autoconsumo.
      { to: '/liquidaciones?tab=facturacion', title: 'Facturación de energía' },
      { to: '/finanzas/ids-proyectos', title: 'IDs proyectos' },
      { to: '/finanzas/contratos-energia', title: 'Contratos de energía' },
      { to: '/finanzas/despachos-liquidados', title: 'Despachos liquidados' },
      { to: '/finanzas/consumo', title: 'Consumo' },
      { to: '/finanzas/costos-comercializacion', title: 'Costos comercialización' },
      { to: '/finanzas/facturas-xm', title: 'Facturas de XM' },
      { to: '/finanzas/verificacion-costos', title: 'Verificación de costos' },
      { to: '/finanzas/estados-resultados', title: 'Estados de resultados' },
      { to: '/finanzas/mandatos', title: 'Mandatos' },
    ],
  },
  {
    title: 'Panel Contable',
    icon: CalculatorIcon,
    group: NavigationGroup.Finanzas,
    requiredPermission: 'liquidaciones:read',
    children: [
      { to: '/panel-contable', title: 'Panel contable' },
      { to: '/liquidaciones?tipo=minigranja', title: 'Minigranjas' },
      { to: '/liquidaciones?tipo=autoconsumo', title: 'Autoconsumo' },
      { to: '/liquidaciones/inversionista', title: 'Por Inversionista' },
    ],
  },
  {
    title: 'Herramientas liquidaciones',
    icon: WrenchIcon,
    group: NavigationGroup.Finanzas,
    requiredPermission: 'liquidaciones:read',
    children: [
      { to: '/validador-mandatos', title: 'Validador de Mandatos' },
      { to: '/finanzas/descarga-xm', title: 'Descarga de XM' },
    ],
  },
  {
    title: 'Costos',
    icon: CreditCardIcon,
    to: '/finanzas/costos',
    group: NavigationGroup.Finanzas,
    requiredPermission: 'liquidaciones:read',
  },

  // ── Alertas ────────────────────────────────────────────────────────────────
  {
    title: 'Centro de Alertas',
    icon: CircleAlertIcon,
    to: '/alertas',
    group: NavigationGroup.Alertas,
    requiredPermission: 'alertas:read',
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  // El legacy restringía estas dos además a un correo puntual; el modelo
  // rol→permiso no expresa esa segunda restricción — ver la nota junto a
  // `/admin` en `~/config/permissions`.
  {
    title: 'Usuarios',
    icon: UsersIcon,
    to: '/admin/usuarios',
    group: NavigationGroup.Admin,
    requiredPermission: 'admin:manage',
  },
  {
    title: 'Diagnóstico',
    icon: LinkIcon,
    to: '/admin/diagnostico',
    group: NavigationGroup.Admin,
    requiredPermission: 'admin:manage',
  },
]
