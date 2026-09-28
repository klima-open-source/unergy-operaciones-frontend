<script setup lang="ts">
import type { Component } from 'vue'
import type { AlertasContratosPpa } from '~/features/alertas/types'
import type { KpisOperativos } from '~/types/dashboard'
import { CircleAlertIcon, WrenchIcon, ZapIcon } from '@lucide/vue'
import { AlertasService } from '~/features/alertas/services/alertas'

type Tono = 'destructive' | 'success' | 'warning'

const TONO_CLASES: Record<Tono, string> = {
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
}

const alertasService = new AlertasService()

const kpis = ref<KpisOperativos>({})
const ppaAlerts = ref<Pick<AlertasContratosPpa, 'huerfanos' | 'duplicados'>>({
  huerfanos: [],
  duplicados: [],
})

const totalAlertasPpa = computed(
  () => (ppaAlerts.value.huerfanos?.length || 0) + (ppaAlerts.value.duplicados?.length || 0),
)

const summaryStats = computed<{ label: string; value: number; tono: Tono }[]>(() => {
  const fp = kpis.value.fallas_por_prioridad || {}
  const fallasAbiertas = kpis.value.fallas_abiertas || 0
  const fallasCriticas = fp.critica || 0
  const alarmasMgs = kpis.value.alarmas_mgs ?? 0
  return [
    {
      label: 'Fallas activas',
      value: fallasAbiertas,
      tono: fallasAbiertas > 0 ? 'destructive' : 'success',
    },
    {
      label: 'Fallas críticas',
      value: fallasCriticas,
      tono: fallasCriticas > 0 ? 'destructive' : 'success',
    },
    { label: 'Alarmas MGS', value: alarmasMgs, tono: alarmasMgs > 0 ? 'warning' : 'success' },
    {
      label: 'Alertas PPA',
      value: totalAlertasPpa.value,
      tono: totalAlertasPpa.value > 0 ? 'warning' : 'success',
    },
  ]
})

interface Modulo {
  to: string
  label: string
  desc: string
  icon: Component
  tono: 'warning' | 'primary'
  count: number
}

const MODULOS = computed<Modulo[]>(() => [
  {
    to: '/alertas/contratos-ppa',
    label: 'Contratos PPA',
    desc: 'Proyectos huérfanos y duplicados en GESCON',
    icon: ZapIcon,
    tono: 'warning',
    count: totalAlertasPpa.value,
  },
  {
    to: '/fallas',
    label: 'Fallas Operativas',
    desc: 'Fallas activas por prioridad y estado',
    icon: WrenchIcon,
    tono: 'primary',
    count: kpis.value.fallas_abiertas || 0,
  },
])

onMounted(async () => {
  const [kpisRes, ppaRes] = await Promise.all([
    alertasService.obtenerKpis().catch(() => null),
    alertasService.obtenerContratosPpa().catch(() => null),
  ])
  if (kpisRes) kpis.value = kpisRes
  if (ppaRes) ppaAlerts.value = ppaRes
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader title="Centro de Alertas" subtitle="Estado operacional de la plataforma">
      <template #lead>
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10"
        >
          <CircleAlertIcon class="size-4 text-destructive" />
        </div>
      </template>
    </PageHeader>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card v-for="stat in summaryStats" :key="stat.label" size="sm">
        <CardContent>
          <p class="text-3xl font-bold" :class="TONO_CLASES[stat.tono]">{{ stat.value ?? '—' }}</p>
          <p class="mt-1 text-xs font-semibold text-muted-foreground">{{ stat.label }}</p>
        </CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
      <Card
        v-for="mod in MODULOS"
        :key="mod.to"
        class="gap-0 p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <NuxtLink :to="mod.to" class="flex flex-col items-center gap-4 p-8 text-center">
          <div
            class="relative flex size-16 items-center justify-center rounded-full"
            :class="mod.tono === 'warning' ? 'bg-warning/10' : 'bg-primary/10'"
          >
            <component
              :is="mod.icon"
              class="size-7"
              :class="mod.tono === 'warning' ? 'text-warning' : 'text-primary'"
            />
            <GBadge v-if="mod.count > 0" class="absolute -top-1 -right-1" color="destructive">
              {{ mod.count > 99 ? '99+' : mod.count }}
            </GBadge>
          </div>
          <div>
            <p class="font-semibold">{{ mod.label }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ mod.desc }}</p>
          </div>
        </NuxtLink>
      </Card>
    </div>
  </div>
</template>
