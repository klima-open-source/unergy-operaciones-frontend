<template>
  <div class="space-y-5">
    <!-- Page header -->
    <PageHeader title="Dashboard" subtitle="Resumen operativo de la plataforma" />

    <!-- Critical Alerts Banner -->
    <div v-if="criticalAlerts.length" class="rounded-xl overflow-hidden" style="border: 2px solid #D64455;">
      <div class="px-4 py-2.5 flex items-center gap-2" style="background-color: #D64455;">
        <TriangleAlertIcon class="text-white size-[1em]" />
        <span class="text-sm font-bold text-white">Alertas Operacionales</span>
        <span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.2); color: white;">
          {{ criticalAlerts.length }}
        </span>
      </div>
      <div class="divide-y" style="background-color: #FEF2F2; border-color: rgba(214,68,85,0.15);">
        <RouterLink v-for="alert in criticalAlerts" :key="alert.key" :to="alert.to"
                    class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-100/60">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
               :style="{ backgroundColor: alert.bgColor }">
            <component :is="alert.icon" class="text-sm size-[1em]" :style="{ color: alert.iconColor }" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ alert.title }}</p>
            <p class="text-xs" style="color: #6b5a8a;">{{ alert.detail }}</p>
          </div>
          <ChevronRightIcon class="text-sm size-[1em]" style="color: #D64455;" />
        </RouterLink>
      </div>
    </div>

    <!-- KPI Cards Row 1 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="kpi in topKpis" :key="kpi.label"
           class="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between"
           style="border: 1px solid #e8e0f0;">
        <div>
          <p class="text-xs uppercase tracking-wide font-semibold" style="color: #6b5a8a;">{{ kpi.label }}</p>
          <p class="text-2xl font-bold mt-1" style="color: var(--color-unergy-deep);">{{ kpi.value ?? '—' }}</p>
          <p v-if="kpi.sub" class="text-xs mt-0.5" :style="{ color: kpi.subColor || 'var(--color-unergy-purple)' }">{{ kpi.sub }}</p>
        </div>
        <div class="w-12 h-12 rounded-xl flex items-center justify-center" :style="{ backgroundColor: kpi.bg }">
          <component :is="kpi.icon" class="text-xl size-[1em]" :style="{ color: kpi.color }" />
        </div>
      </div>
    </div>

    <!-- Row 2: Fleet Power + Precio Bolsa + MGS Alarms -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Generación Flota</h3>
          <RouterLink to="/generacion-solar" class="text-xs font-medium" style="color: var(--color-unergy-purple);">Ver detalle →</RouterLink>
        </div>
        <div v-if="data.fleet_power_kw != null" class="flex items-baseline gap-2">
          <span class="text-3xl font-bold" :style="{ color: data.fleet_power_kw > 0 ? '#10B981' : '#6b5a8a' }">
            {{ data.fleet_power_kw > 1000 ? (data.fleet_power_kw / 1000).toFixed(1) : data.fleet_power_kw }}
          </span>
          <span class="text-sm" style="color: #6b5a8a;">{{ data.fleet_power_kw > 1000 ? 'MW' : 'kW' }}</span>
          <span v-if="data.fleet_online != null" class="text-xs ml-2 px-2 py-0.5 rounded-full"
                style="background: rgba(16,185,129,0.1); color: #10B981;">
            {{ data.fleet_online }}/{{ data.fleet_total || '?' }} online
          </span>
        </div>
        <p v-else class="text-sm" style="color: #6b5a8a;">Solenium no disponible</p>
        <div v-if="data.gen_solenium_last_date" class="mt-2 text-xs" style="color: #6b5a8a;">
          <DatabaseIcon class="text-[10px] mr-1 size-[1em]" style="color: #10B981;" />
          {{ data.gen_solenium_projects }} plantas sincronizadas · último dato {{ data.gen_solenium_last_date }}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Precio de Bolsa</h3>
          <RouterLink to="/mem/precio-bolsa" class="text-xs font-medium" style="color: var(--color-unergy-purple);">Ver detalle →</RouterLink>
        </div>
        <div v-if="data.precio_bolsa_cop_kwh != null" class="flex items-baseline gap-2">
          <span class="text-3xl font-bold" style="color: var(--color-unergy-deep);">${{ data.precio_bolsa_cop_kwh }}</span>
          <span class="text-sm" style="color: #6b5a8a;">COP/kWh</span>
        </div>
        <p v-else class="text-sm" style="color: #6b5a8a;">Sin datos de precio disponibles</p>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Alarmas MGS</h3>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold" :style="{ color: data.alarmas_mgs > 0 ? '#D64455' : '#10B981' }">
            {{ data.alarmas_mgs ?? 0 }}
          </span>
          <span class="text-sm" style="color: #6b5a8a;">{{ data.alarmas_mgs === 1 ? 'alarma activa' : 'alarmas activas' }}</span>
        </div>
        <div v-if="data.alarmas_mgs_criticas > 0" class="mt-2">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background: rgba(214,68,85,0.1); color: #D64455;">
            {{ data.alarmas_mgs_criticas }} críticas
          </span>
        </div>
      </div>
    </div>

    <!-- Row 3: Fallas Severity Breakdown + Cumplimiento Status -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Fallas por Prioridad</h3>
          <RouterLink to="/fallas" class="text-xs font-medium" style="color: var(--color-unergy-purple);">Ver fallas →</RouterLink>
        </div>
        <div v-if="data.fallas_abiertas > 0" class="space-y-2.5">
          <div v-for="bar in fallasBreakdown" :key="bar.code" class="flex items-center gap-3">
            <span class="text-xs font-medium w-14 text-right" :style="{ color: bar.color }">{{ bar.label }}</span>
            <div class="flex-1 h-5 rounded-full overflow-hidden" style="background: #f3f0f7;">
              <div class="h-full rounded-full transition-all duration-500"
                   :style="{ width: bar.pct + '%', backgroundColor: bar.color, minWidth: bar.count > 0 ? '1.5rem' : '0' }" />
            </div>
            <span class="text-sm font-bold w-8" style="color: var(--color-unergy-deep);">{{ bar.count }}</span>
          </div>
        </div>
        <p v-else class="text-sm" style="color: #10B981;">Sin fallas activas</p>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Cumplimiento PPA</h3>
          <RouterLink to="/mem/cumplimiento" class="text-xs font-medium" style="color: var(--color-unergy-purple);">Ver detalle →</RouterLink>
        </div>
        <div v-if="cumplimiento" class="space-y-3">
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold" :style="{ color: cumplimientoColor }">
              {{ cumplimiento.totales?.estado === 'deficit' ? 'DÉFICIT' : cumplimiento.totales?.estado === 'excedente' ? 'EXCEDENTE' : cumplimiento.totales?.estado === 'ok' ? 'OK' : '—' }}
            </span>
          </div>
          <div v-if="cumplimiento.totales?.gen_total_mwh != null" class="grid grid-cols-2 gap-3 text-center">
            <div class="rounded-lg p-2.5" style="background: #f3f0f7;">
              <p class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ cumplimiento.totales.gen_proyectada_mwh?.toFixed(1) || cumplimiento.totales.gen_total_mwh?.toFixed(1) }}</p>
              <p class="text-[10px] uppercase font-semibold" style="color: #6b5a8a;">MWh Generados</p>
            </div>
            <div class="rounded-lg p-2.5" style="background: #f3f0f7;">
              <p class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ cumplimiento.totales.energia_minima_mwh?.toFixed(1) || '—' }}</p>
              <p class="text-[10px] uppercase font-semibold" style="color: #6b5a8a;">MWh Comprometidos</p>
            </div>
          </div>
          <div v-if="cumplimiento.totales?.compras_bolsa_mwh > 0" class="text-xs font-medium px-2.5 py-1.5 rounded-lg" style="background: rgba(214,68,85,0.08); color: #D64455;">
            Compras en bolsa necesarias: {{ cumplimiento.totales.compras_bolsa_mwh.toFixed(1) }} MWh
          </div>
          <div v-if="cumplimientoDeficits.length > 0" class="space-y-1">
            <p class="text-[10px] uppercase font-bold" style="color: #D64455;">Contratos en déficit:</p>
            <p v-for="d in cumplimientoDeficits" :key="d.id" class="text-xs" style="color: #6b5a8a;">
              <span class="font-semibold" style="color: var(--color-unergy-deep);">{{ d.nombre_interno || d.comprador_nombre }}</span>
              — {{ d.compras_bolsa_mwh?.toFixed(1) }} MWh faltantes
            </p>
          </div>
        </div>
        <div v-else-if="cumplimientoLoading" class="flex items-center gap-2">
          <LoaderCircleIcon class="text-sm size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
          <span class="text-sm" style="color: #6b5a8a;">Consultando generación...</span>
        </div>
        <div v-else>
          <p class="text-sm" style="color: #6b5a8a;">{{ data.ppa_con_compromisos || 0 }} contratos con compromisos este mes</p>
        </div>
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to"
                  class="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 transition-all duration-150 hover:shadow-md"
                  style="border: 1px solid #e8e0f0;">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center" :style="{ backgroundColor: link.bg }">
          <component :is="link.icon" class="text-base size-[1em]" :style="{ color: link.color }" />
        </div>
        <span class="text-sm font-medium" style="color: var(--color-unergy-deep);">{{ link.label }}</span>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { DashboardService } from '~/features/dashboard/services/dashboard'
import { BuildingIcon, ChevronRightIcon, DatabaseIcon, FilePenIcon, LoaderCircleIcon, PowerIcon, ShieldIcon, SunIcon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const dashboardService = new DashboardService()

const data = ref({})
const cumplimiento = ref(null)
const cumplimientoLoading = ref(false)

const PRIORIDAD_CONFIG = {
  critica: { label: 'Crítica', color: '#DC2626' },
  grave:   { label: 'Grave',   color: '#EA580C' },
  media:   { label: 'Media',   color: '#CA8A04' },
  leve:    { label: 'Leve',    color: '#16A34A' },
}

const topKpis = computed(() => [
  {
    label: 'Proyectos',
    value: data.value.proyectos_total,
    sub: data.value.proyectos_operacion ? `${data.value.proyectos_operacion} en operación` : null,
    icon: ZapIcon,
    bg: 'rgba(145,91,216,0.1)',
    color: '#915BD8',
  },
  {
    label: 'Clientes',
    value: data.value.clientes_total,
    icon: BuildingIcon,
    bg: 'rgba(44,32,57,0.08)',
    color: '#2C2039',
  },
  {
    label: 'Fallas abiertas',
    value: data.value.fallas_abiertas,
    sub: data.value.fallas_criticas_antiguas > 0 ? `${data.value.fallas_criticas_antiguas} críticas >7 días` : null,
    subColor: data.value.fallas_criticas_antiguas > 0 ? '#D64455' : '#915BD8',
    icon: TriangleAlertIcon,
    bg: data.value.fallas_abiertas > 0 ? 'rgba(214,68,85,0.1)' : 'rgba(16,185,129,0.1)',
    color: data.value.fallas_abiertas > 0 ? '#D64455' : '#10B981',
  },
  {
    label: 'Generación mes',
    value: data.value.mwh_mes ? `${data.value.mwh_mes}` : '—',
    sub: 'MWh',
    icon: SunIcon,
    bg: 'rgba(240,192,64,0.15)',
    color: '#D4A017',
  },
])

const fallasBreakdown = computed(() => {
  const fp = data.value.fallas_por_prioridad || {}
  const total = data.value.fallas_abiertas || 1
  return ['critica', 'grave', 'media', 'leve'].map(code => ({
    code,
    label: PRIORIDAD_CONFIG[code]?.label || code,
    color: PRIORIDAD_CONFIG[code]?.color || '#6b5a8a',
    count: fp[code] || 0,
    pct: Math.round(((fp[code] || 0) / total) * 100),
  }))
})

function fmtCOP(v) {
  if (v == null) return '$0'
  return '$' + Math.round(v).toLocaleString('es-CO')
}

const cumplimientoColor = computed(() => {
  const st = cumplimiento.value?.totales?.estado
  if (st === 'deficit') return '#D64455'
  if (st === 'excedente') return '#F0C040'
  if (st === 'ok') return '#10B981'
  return '#6b5a8a'
})

const cumplimientoDeficits = computed(() => {
  if (!cumplimiento.value?.contratos) return []
  return cumplimiento.value.contratos.filter(c => c.estado === 'deficit')
})

const criticalAlerts = computed(() => {
  const alerts = []
  const fp = data.value.fallas_por_prioridad || {}
  if (fp.critica > 0) {
    alerts.push({
      key: 'fallas-criticas',
      title: `${fp.critica} falla${fp.critica > 1 ? 's' : ''} crítica${fp.critica > 1 ? 's' : ''} sin resolver`,
      detail: data.value.fallas_criticas_antiguas > 0
        ? `${data.value.fallas_criticas_antiguas} con más de 7 días sin atender`
        : 'Requieren atención inmediata',
      icon: TriangleAlertIcon,
      iconColor: '#DC2626',
      bgColor: 'rgba(220,38,38,0.1)',
      to: '/fallas',
    })
  }
  if (cumplimientoDeficits.value.length > 0) {
    const totalDeficit = cumplimientoDeficits.value.reduce((s, c) => s + (c.compras_bolsa_mwh || 0), 0)
    alerts.push({
      key: 'cumplimiento-deficit',
      title: `${cumplimientoDeficits.value.length} contrato${cumplimientoDeficits.value.length > 1 ? 's' : ''} PPA en déficit`,
      detail: `${totalDeficit.toFixed(1)} MWh de compras en bolsa necesarias`,
      icon: ShieldIcon,
      iconColor: '#D64455',
      bgColor: 'rgba(214,68,85,0.1)',
      to: '/mem/cumplimiento',
    })
  }
  if (data.value.fleet_total && data.value.fleet_online != null) {
    const offline = data.value.fleet_total - data.value.fleet_online
    if (offline > 0 && offline / data.value.fleet_total > 0.2) {
      alerts.push({
        key: 'fleet-offline',
        title: `${offline} planta${offline > 1 ? 's' : ''} sin generación`,
        detail: `${data.value.fleet_online}/${data.value.fleet_total} plantas reportando generación`,
        icon: PowerIcon,
        iconColor: '#CA8A04',
        bgColor: 'rgba(202,138,4,0.1)',
        to: '/generacion-solar',
      })
    }
  }
  if (data.value.liquidaciones_pendientes > 0) {
    alerts.push({
      key: 'liquidaciones-pendientes',
      title: `${data.value.liquidaciones_pendientes} proyecto${data.value.liquidaciones_pendientes > 1 ? 's' : ''} sin liquidación este mes`,
      detail: 'Proyectos en operación que requieren liquidación',
      icon: FilePenIcon,
      iconColor: '#915BD8',
      bgColor: 'rgba(145,91,216,0.1)',
      to: '/liquidaciones',
    })
  }
  return alerts
})

const quickLinks = [
  { to: '/generacion-solar', label: 'Generación Solar', icon: SunIcon, bg: 'rgba(240,192,64,0.15)', color: '#D4A017' },
  { to: '/mem/cumplimiento', label: 'Cumplimiento PPA', icon: ShieldIcon, bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
  { to: '/mem/descubrimientos', label: 'Descubrimientos', icon: ZapIcon, bg: 'rgba(240,192,64,0.1)', color: '#F0C040' },
  { to: '/liquidaciones', label: 'Liquidaciones', icon: FilePenIcon, bg: 'rgba(145,91,216,0.08)', color: '#915BD8' },
]

onMounted(async () => {
  try {
    const kpis = await dashboardService.obtenerKpis().catch(() => null)
    if (kpis) data.value = kpis
  } catch {
    // degrade gracefully
  }

  // Load cumplimiento in background (calls Unergy API, slower)
  if (data.value.ppa_con_compromisos > 0) {
    cumplimientoLoading.value = true
    try {
      const now = new Date()
      cumplimiento.value = await dashboardService.obtenerResumenCumplimiento({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
    } catch {
      // non-critical
    } finally {
      cumplimientoLoading.value = false
    }
  }
})
</script>
