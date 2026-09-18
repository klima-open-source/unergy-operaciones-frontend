<script setup lang="ts">
import type { DashboardAlert } from '~/features/dashboard/components/DashboardCriticalAlerts.vue'
import type { ResumenCumplimientoPpa } from '~/features/dashboard/types'
import type { KpisOperativos } from '~/types/dashboard'
import {
  BellIcon,
  BuildingIcon,
  CircleAlertIcon,
  DatabaseIcon,
  DollarSignIcon,
  FilePenIcon,
  PowerIcon,
  RefreshCwIcon,
  ShieldIcon,
  SunIcon,
  TriangleAlertIcon,
  ZapIcon,
} from '@lucide/vue'
import { logger } from '~/core/logger'
import DashboardCriticalAlerts from '~/features/dashboard/components/DashboardCriticalAlerts.vue'
import DashboardCumplimientoCard from '~/features/dashboard/components/DashboardCumplimientoCard.vue'
import DashboardKpiCard from '~/features/dashboard/components/DashboardKpiCard.vue'
import { DashboardService } from '~/features/dashboard/services/dashboard'
import { formatCOP } from '~/utils/currency'

const QUICK_LINKS = [
  { to: '/generacion-solar', label: 'Generación Solar', icon: SunIcon, tone: 'warning' as const },
  {
    to: '/mem/cumplimiento',
    label: 'Cumplimiento PPA',
    icon: ShieldIcon,
    tone: 'success' as const,
  },
  { to: '/mem/descubrimientos', label: 'Descubrimientos', icon: ZapIcon, tone: 'primary' as const },
  { to: '/liquidaciones', label: 'Liquidaciones', icon: FilePenIcon, tone: 'muted' as const },
]

const QUICK_LINK_TONE_CLASSES: Record<(typeof QUICK_LINKS)[number]['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
}

const PRIORIDAD_CONFIG: Record<string, { label: string; barClass: string; textClass: string }> = {
  critica: { label: 'Crítica', barClass: 'bg-destructive', textClass: 'text-destructive' },
  grave: { label: 'Grave', barClass: 'bg-destructive/60', textClass: 'text-destructive/80' },
  media: { label: 'Media', barClass: 'bg-warning', textClass: 'text-warning' },
  leve: { label: 'Leve', barClass: 'bg-success', textClass: 'text-success' },
}

const dashboardService = new DashboardService()

const kpisQuery = useQuery<KpisOperativos>()
const cumplimientoQuery = useQuery<ResumenCumplimientoPpa>()

const kpis = computed(() => kpisQuery.data)

const cumplimientoStatus = computed<'idle' | 'loading' | 'error' | 'ready'>(() => {
  if (cumplimientoQuery.isLoading) return 'loading'
  if (cumplimientoQuery.error) return 'error'
  if (cumplimientoQuery.data) return 'ready'
  return 'idle'
})

const fleetPowerDisplay = computed(() => {
  const kw = kpis.value?.fleet_power_kw
  if (kw == null) return null
  return kw > 1000
    ? { value: (kw / 1000).toFixed(1), unit: 'MW' }
    : { value: String(kw), unit: 'kW' }
})

const fallasBreakdown = computed(() => {
  const fp = kpis.value?.fallas_por_prioridad ?? {}
  const total = kpis.value?.fallas_abiertas || 1
  return (['critica', 'grave', 'media', 'leve'] as const).map((code) => {
    const count = fp[code] ?? 0
    return {
      code,
      ...PRIORIDAD_CONFIG[code],
      count,
      pct: Math.round((count / total) * 100),
    }
  })
})

const criticalAlerts = computed<DashboardAlert[]>(() => {
  const k = kpis.value
  if (!k) return []

  const alerts: DashboardAlert[] = []
  const fp = k.fallas_por_prioridad ?? {}

  if ((fp.critica ?? 0) > 0) {
    const count = fp.critica ?? 0
    alerts.push({
      key: 'fallas-criticas',
      title: `${count} falla${count > 1 ? 's' : ''} crítica${count > 1 ? 's' : ''} sin resolver`,
      detail:
        (k.fallas_criticas_antiguas ?? 0) > 0
          ? `${k.fallas_criticas_antiguas} con más de 7 días sin atender`
          : 'Requieren atención inmediata',
      icon: TriangleAlertIcon,
      tone: 'destructive',
      to: '/fallas',
    })
  }

  const deficits = cumplimientoQuery.data?.contratos?.filter((c) => c.estado === 'deficit') ?? []
  if (deficits.length > 0) {
    const totalDeficit = deficits.reduce((s, c) => s + (c.compras_bolsa_mwh ?? 0), 0)
    alerts.push({
      key: 'cumplimiento-deficit',
      title: `${deficits.length} contrato${deficits.length > 1 ? 's' : ''} PPA en déficit`,
      detail: `${totalDeficit.toFixed(1)} MWh de compras en bolsa necesarias`,
      icon: ShieldIcon,
      tone: 'destructive',
      to: '/mem/cumplimiento',
    })
  }

  if (k.fleet_total && k.fleet_online != null) {
    const offline = k.fleet_total - k.fleet_online
    if (offline > 0 && offline / k.fleet_total > 0.2) {
      alerts.push({
        key: 'fleet-offline',
        title: `${offline} planta${offline > 1 ? 's' : ''} sin generación`,
        detail: `${k.fleet_online}/${k.fleet_total} plantas reportando generación`,
        icon: PowerIcon,
        tone: 'warning',
        to: '/generacion-solar',
      })
    }
  }

  if ((k.liquidaciones_pendientes ?? 0) > 0) {
    const count = k.liquidaciones_pendientes ?? 0
    alerts.push({
      key: 'liquidaciones-pendientes',
      title: `${count} proyecto${count > 1 ? 's' : ''} sin liquidación este mes`,
      detail: 'Proyectos en operación que requieren liquidación',
      icon: FilePenIcon,
      tone: 'warning',
      to: '/liquidaciones',
    })
  }

  return alerts
})

async function loadKpis() {
  await kpisQuery.run(() => dashboardService.obtenerKpis())

  const compromisos = kpisQuery.data?.ppa_con_compromisos ?? 0
  if (compromisos <= 0) return

  const now = new Date()
  await cumplimientoQuery.run(() =>
    dashboardService.obtenerResumenCumplimiento({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }),
  )
  if (cumplimientoQuery.error) {
    logger.error('dashboard.cumplimiento', cumplimientoQuery.error)
  }
}

onMounted(loadKpis)
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-extrabold text-foreground">Dashboard</h1>
      <p class="mt-0.5 text-xs text-muted-foreground">Resumen operativo de la plataforma</p>
    </div>

    <AsyncView :query="kpisQuery">
      <template #loading>
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton v-for="i in 4" :key="i" class="h-24" />
          </div>
          <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Skeleton v-for="i in 3" :key="i" class="h-32" />
          </div>
          <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Skeleton v-for="i in 2" :key="i" class="h-40" />
          </div>
        </div>
      </template>

      <template #error="{ error }">
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-12 text-center"
        >
          <CircleAlertIcon class="size-8 text-destructive" />
          <p class="text-sm font-medium text-destructive">
            No se pudieron cargar los KPIs del dashboard
          </p>
          <p class="text-sm text-muted-foreground">{{ error.message }}</p>
          <Button variant="outline" size="sm" @click="loadKpis">
            <RefreshCwIcon class="size-4" />
            Reintentar
          </Button>
        </div>
      </template>

      <template #default>
        <div class="space-y-5">
          <DashboardCriticalAlerts :alerts="criticalAlerts" />

          <!-- KPIs principales -->
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DashboardKpiCard
              label="Proyectos"
              :value="kpis?.proyectos_total ?? null"
              :icon="ZapIcon"
              tone="primary"
              :sub="kpis?.proyectos_operacion ? `${kpis.proyectos_operacion} en operación` : null"
            />
            <DashboardKpiCard
              label="Clientes"
              :value="kpis?.clientes_total ?? null"
              :icon="BuildingIcon"
              tone="muted"
            />
            <DashboardKpiCard
              label="Fallas abiertas"
              :value="kpis?.fallas_abiertas ?? null"
              :icon="TriangleAlertIcon"
              :tone="(kpis?.fallas_abiertas ?? 0) > 0 ? 'destructive' : 'success'"
              :sub="
                (kpis?.fallas_criticas_antiguas ?? 0) > 0
                  ? `${kpis?.fallas_criticas_antiguas} críticas >7 días`
                  : null
              "
              sub-tone="destructive"
            />
            <DashboardKpiCard
              label="Generación mes"
              :value="kpis?.mwh_mes ?? null"
              :icon="SunIcon"
              tone="warning"
              sub="MWh"
            />
          </div>

          <div class="space-y-3">
            <h2 class="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Flota, mercado y alarmas
            </h2>
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-1.5">
                    <PowerIcon class="size-4 text-muted-foreground" />
                    Generación flota
                  </CardTitle>
                  <CardAction>
                    <NuxtLink
                      to="/generacion-solar"
                      class="text-xs font-medium text-primary hover:underline"
                    >
                      Ver detalle →
                    </NuxtLink>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div v-if="fleetPowerDisplay" class="flex items-baseline gap-2">
                    <span
                      class="text-3xl font-bold"
                      :class="
                        (kpis?.fleet_power_kw ?? 0) > 0 ? 'text-success' : 'text-muted-foreground'
                      "
                    >
                      {{ fleetPowerDisplay.value }}
                    </span>
                    <span class="text-sm text-muted-foreground">{{ fleetPowerDisplay.unit }}</span>
                    <GBadge v-if="kpis?.fleet_online != null" color="success" class="ml-2">
                      {{ kpis.fleet_online }}/{{ kpis.fleet_total || '?' }} online
                    </GBadge>
                  </div>
                  <p v-else class="text-sm text-muted-foreground">Solenium no disponible</p>
                  <div
                    v-if="kpis?.gen_solenium_last_date"
                    class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <DatabaseIcon class="size-3 text-success" />
                    {{ kpis.gen_solenium_projects }} plantas sincronizadas · último dato
                    {{ kpis.gen_solenium_last_date }}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-1.5">
                    <DollarSignIcon class="size-4 text-muted-foreground" />
                    Precio de bolsa
                  </CardTitle>
                  <CardAction>
                    <NuxtLink
                      to="/mem/precio-bolsa"
                      class="text-xs font-medium text-primary hover:underline"
                    >
                      Ver detalle →
                    </NuxtLink>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div v-if="kpis?.precio_bolsa_cop_kwh != null" class="flex items-baseline gap-2">
                    <span class="text-3xl font-bold text-foreground">{{
                      formatCOP(kpis.precio_bolsa_cop_kwh)
                    }}</span>
                    <span class="text-sm text-muted-foreground">/kWh</span>
                  </div>
                  <p v-else class="text-sm text-muted-foreground">
                    Sin datos de precio disponibles
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-1.5">
                    <BellIcon class="size-4 text-muted-foreground" />
                    Alarmas MGS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="flex items-baseline gap-2">
                    <span
                      class="text-3xl font-bold"
                      :class="(kpis?.alarmas_mgs ?? 0) > 0 ? 'text-destructive' : 'text-success'"
                    >
                      {{ kpis?.alarmas_mgs ?? 0 }}
                    </span>
                    <span class="text-sm text-muted-foreground">
                      {{ kpis?.alarmas_mgs === 1 ? 'alarma activa' : 'alarmas activas' }}
                    </span>
                  </div>
                  <GBadge
                    v-if="(kpis?.alarmas_mgs_criticas ?? 0) > 0"
                    color="destructive"
                    class="mt-2"
                  >
                    {{ kpis?.alarmas_mgs_criticas }} críticas
                  </GBadge>
                </CardContent>
              </Card>
            </div>
          </div>

          <div class="space-y-3">
            <h2 class="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Fallas por prioridad y cumplimiento PPA
            </h2>
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-1.5">
                    <TriangleAlertIcon class="size-4 text-muted-foreground" />
                    Fallas por prioridad
                  </CardTitle>
                  <CardAction>
                    <NuxtLink to="/fallas" class="text-xs font-medium text-primary hover:underline">
                      Ver fallas →
                    </NuxtLink>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div v-if="(kpis?.fallas_abiertas ?? 0) > 0" class="space-y-2.5">
                    <div
                      v-for="bar in fallasBreakdown"
                      :key="bar.code"
                      class="flex items-center gap-3"
                    >
                      <span class="w-14 text-right text-xs font-medium" :class="bar.textClass">{{
                        bar.label
                      }}</span>
                      <div class="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="bar.barClass"
                          :style="{
                            width: `${bar.pct}%`,
                            minWidth: bar.count > 0 ? '1.5rem' : '0',
                          }"
                        />
                      </div>
                      <span class="w-8 text-sm font-bold text-foreground">{{ bar.count }}</span>
                    </div>
                  </div>
                  <p v-else class="text-sm text-success">Sin fallas activas</p>
                </CardContent>
              </Card>

              <DashboardCumplimientoCard
                :status="cumplimientoStatus"
                :data="cumplimientoQuery.data"
                :contratos-con-compromisos="kpis?.ppa_con_compromisos ?? 0"
              />
            </div>
          </div>

          <div class="space-y-3">
            <h2 class="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Accesos rápidos
            </h2>
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Item
                v-for="link in QUICK_LINKS"
                :key="link.to"
                as-child
                variant="outline"
                class="bg-card"
              >
                <NuxtLink :to="link.to">
                  <ItemMedia
                    variant="icon"
                    :class="[QUICK_LINK_TONE_CLASSES[link.tone], 'size-10 rounded-lg']"
                  >
                    <component :is="link.icon" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{{ link.label }}</ItemTitle>
                  </ItemContent>
                </NuxtLink>
              </Item>
            </div>
          </div>
        </div>
      </template>
    </AsyncView>
  </div>
</template>
