<template>
  <div class="space-y-5">
    <PageHeader title="Centro de Alertas" subtitle="Estado operacional de la plataforma">
      <template #lead>
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background: rgba(214,68,85,0.1);">
          <CircleAlertIcon class="text-sm size-[1em]" style="color: #D64455;" />
        </div>
      </template>
    </PageHeader>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="stat in summaryStats" :key="stat.label"
           class="rounded-xl p-4" :style="{ border: `1px solid ${stat.borderColor}`, background: stat.bg }">
        <p class="text-3xl font-bold" :style="{ color: stat.valueColor }">{{ stat.value ?? '—' }}</p>
        <p class="text-xs font-semibold mt-1" :style="{ color: stat.labelColor }">{{ stat.label }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <RouterLink
        v-for="mod in MODULOS"
        :key="mod.to"
        :to="mod.to"
        class="flex flex-col items-center gap-4 rounded-2xl p-8 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 select-none text-center bg-white shadow-sm"
        :style="`border: 2px solid ${mod.count > 0 ? mod.color + '40' : '#e8e0f0'};`"
      >
        <div class="w-16 h-16 rounded-full flex items-center justify-center relative"
          :style="`background: ${mod.color}18`">
          <component :is="mod.icon" class="text-3xl size-[1em]" :style="`color: ${mod.color}`" />
          <span v-if="mod.count > 0"
                class="absolute -top-1 -right-1 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                :style="`background: ${mod.color};`">
            {{ mod.count > 99 ? '99+' : mod.count }}
          </span>
        </div>
        <div>
          <p class="font-semibold" style="color: var(--color-unergy-deep);">{{ mod.label }}</p>
          <p class="text-xs mt-1" style="color: #6b5a8a;">{{ mod.desc }}</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertasService } from '~/features/alertas/services/alertas'
import { CircleAlertIcon, WrenchIcon, ZapIcon } from '@lucide/vue'

const alertasService = new AlertasService()

const kpis = ref({})
const ppaAlerts = ref({ huerfanos: [], duplicados: [] })

const summaryStats = computed(() => {
  const fp = kpis.value.fallas_por_prioridad || {}
  return [
    {
      label: 'Fallas activas',
      value: kpis.value.fallas_abiertas,
      bg: kpis.value.fallas_abiertas > 0 ? 'rgba(214,68,85,0.05)' : 'rgba(16,185,129,0.05)',
      borderColor: kpis.value.fallas_abiertas > 0 ? 'rgba(214,68,85,0.2)' : 'rgba(16,185,129,0.2)',
      valueColor: kpis.value.fallas_abiertas > 0 ? '#D64455' : '#10B981',
      labelColor: '#6b5a8a',
    },
    {
      label: 'Fallas críticas',
      value: fp.critica || 0,
      bg: fp.critica > 0 ? 'rgba(220,38,38,0.05)' : 'rgba(16,185,129,0.05)',
      borderColor: fp.critica > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)',
      valueColor: fp.critica > 0 ? '#DC2626' : '#10B981',
      labelColor: '#6b5a8a',
    },
    {
      label: 'Alarmas MGS',
      value: kpis.value.alarmas_mgs ?? 0,
      bg: kpis.value.alarmas_mgs > 0 ? 'rgba(234,88,12,0.05)' : 'rgba(16,185,129,0.05)',
      borderColor: kpis.value.alarmas_mgs > 0 ? 'rgba(234,88,12,0.2)' : 'rgba(16,185,129,0.2)',
      valueColor: kpis.value.alarmas_mgs > 0 ? '#EA580C' : '#10B981',
      labelColor: '#6b5a8a',
    },
    {
      label: 'Alertas PPA',
      value: (ppaAlerts.value.huerfanos?.length || 0) + (ppaAlerts.value.duplicados?.length || 0),
      bg: 'rgba(240,192,64,0.08)',
      borderColor: 'rgba(240,192,64,0.25)',
      valueColor: '#CA8A04',
      labelColor: '#6b5a8a',
    },
  ]
})

const MODULOS = computed(() => [
  {
    to: '/alertas/contratos-ppa',
    label: 'Contratos PPA',
    desc: 'Proyectos huérfanos y duplicados en GESCON',
    icon: ZapIcon,
    color: '#f59e0b',
    count: (ppaAlerts.value.huerfanos?.length || 0) + (ppaAlerts.value.duplicados?.length || 0),
  },
  {
    to: '/fallas',
    label: 'Fallas Operativas',
    desc: 'Fallas activas por prioridad y estado',
    icon: WrenchIcon,
    color: '#915BD8',
    count: kpis.value.fallas_abiertas || 0,
  },
])

onMounted(async () => {
  try {
    const [kpisRes, ppaRes] = await Promise.all([
      alertasService.obtenerKpis().catch(() => null),
      alertasService.obtenerContratosPpa().catch(() => null),
    ])
    if (kpisRes) kpis.value = kpisRes
    if (ppaRes) ppaAlerts.value = ppaRes
  } catch {
    // degrade gracefully
  }
})
</script>
