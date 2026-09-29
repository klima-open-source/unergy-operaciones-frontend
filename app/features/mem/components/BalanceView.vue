<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type { RegistroClimaHistorico, RegistroDailySpot } from '~/features/mem/types'
import { CloudDownloadIcon, LoaderCircleIcon } from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { logger } from '~/core/logger'
import { EvoService } from '~/features/mem/services/evo'

const evoService = new EvoService()

const dayOptions = [
  { label: '7 días', value: '7' },
  { label: '30 días', value: '30' },
  { label: '90 días', value: '90' },
  { label: '365 días', value: '365' },
]
const days = ref('30')

const history = ref<RegistroDailySpot[]>([])
const climaHistory = ref<RegistroClimaHistorico[]>([])
const loading = ref(true)

const columns: DataTableColumn[] = [
  { key: 'fecha', header: 'Fecha' },
  { key: 'precio_promedio', header: 'Precio Prom.' },
  { key: 'precio_min', header: 'Mín' },
  { key: 'precio_max', header: 'Máx' },
  { key: 'demanda_gwh', header: 'Demanda GWh' },
  { key: 'hidro_pct', header: 'Hidro %' },
  { key: 'spread', header: 'Spread' },
]

function asRegistro(row: DataTableRow): RegistroDailySpot {
  return row as unknown as RegistroDailySpot
}

interface Kpi {
  label: string
  value: string
  color: string
  sub: string
}

const kpis = computed<Kpi[]>(() => {
  if (!history.value.length) return []
  const latest = history.value[0]
  const avg =
    history.value.reduce((s, r) => s + (Number(r.precio_promedio) || 0), 0) / history.value.length
  const maxPrice = Math.max(...history.value.map((r) => Number(r.precio_max) || 0))
  const avgDemand =
    history.value.reduce((s, r) => s + (Number(r.demanda_gwh) || 0), 0) / history.value.length
  return [
    {
      label: 'Precio hoy',
      value: `$${fmt(latest?.precio_promedio)}`,
      color: 'text-foreground',
      sub: 'COP/kWh',
    },
    {
      label: `Promedio ${days.value}d`,
      value: `$${fmt(avg)}`,
      color: 'text-primary',
      sub: 'COP/kWh',
    },
    {
      label: 'Máximo período',
      value: `$${fmt(maxPrice)}`,
      color: 'text-destructive',
      sub: 'COP/kWh',
    },
    { label: 'Demanda prom.', value: avgDemand.toFixed(1), color: 'text-success', sub: 'GWh/día' },
  ]
})

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return Number(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

async function fetchData() {
  loading.value = true
  try {
    const [h, c] = await Promise.all([
      evoService.obtenerHistoricoSpot(Number(days.value)).catch(() => null),
      evoService.obtenerHistoricoClima(5).catch(() => null),
    ])
    if (h) history.value = h
    if (c) climaHistory.value = c
  } catch (err) {
    logger.error('mem', err)
  } finally {
    loading.value = false
  }
}

watch(days, fetchData)
onMounted(fetchData)
</script>

<template>
  <div class="space-y-5">
    <PageHeader title="Balance Energético" subtitle="Generación, consumo y precios del mercado">
      <template #actions>
        <Select v-model="days">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="op in dayOptions" :key="op.value" :value="op.value">{{
              op.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHeader>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="size-8 animate-spin text-primary" />
    </div>

    <div
      v-else-if="!history.length"
      class="flex flex-col items-center gap-3 py-16 text-muted-foreground"
    >
      <CloudDownloadIcon class="size-10 text-muted-foreground/50" />
      <p class="text-sm font-medium">Servicio de balance no disponible</p>
      <p class="text-xs">
        EVO API no configurada — los datos se mostrarán cuando DailySpot esté activo.
      </p>
    </div>

    <template v-else>
      <!-- KPI row -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="kpi in kpis" :key="kpi.label" class="rounded-xl border bg-card p-4">
          <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {{ kpi.label }}
          </p>
          <p class="mt-1 text-2xl font-bold" :class="kpi.color">{{ kpi.value }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ kpi.sub }}</p>
        </div>
      </div>

      <!-- Price history table -->
      <div class="overflow-hidden rounded-xl border bg-card">
        <div class="border-b px-5 py-3">
          <h3 class="text-sm font-semibold text-foreground">Historial Precios de Bolsa</h3>
        </div>
        <DataTable :columns="columns" :rows="history as unknown as DataTableRow[]">
          <template #cell="{ row, column }">
            <span v-if="column.key === 'fecha'" class="font-mono text-sm">{{
              asRegistro(row).fecha
            }}</span>
            <span v-else-if="column.key === 'precio_promedio'" class="font-semibold"
              >${{ fmt(asRegistro(row).precio_promedio) }}</span
            >
            <span v-else-if="column.key === 'precio_min'" class="text-success"
              >${{ fmt(asRegistro(row).precio_min) }}</span
            >
            <span v-else-if="column.key === 'precio_max'" class="text-destructive"
              >${{ fmt(asRegistro(row).precio_max) }}</span
            >
            <span v-else-if="column.key === 'demanda_gwh'">{{
              asRegistro(row).demanda_gwh ? Number(asRegistro(row).demanda_gwh).toFixed(1) : '—'
            }}</span>
            <span v-else-if="column.key === 'hidro_pct'">{{
              asRegistro(row).hidro_pct != null
                ? `${Number(asRegistro(row).hidro_pct).toFixed(1)}%`
                : '—'
            }}</span>
            <span
              v-else-if="column.key === 'spread'"
              :class="(asRegistro(row).spread ?? 0) > 0 ? 'text-destructive' : 'text-success'"
            >
              {{ asRegistro(row).spread ? `$${fmt(asRegistro(row).spread)}` : '—' }}
            </span>
          </template>
        </DataTable>
      </div>

      <!-- Clima ONI context -->
      <div v-if="climaHistory.length" class="overflow-hidden rounded-xl border bg-card">
        <div class="border-b px-5 py-3">
          <h3 class="text-sm font-semibold text-foreground">Contexto Climático (ONI reciente)</h3>
        </div>
        <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div
            v-for="(f, i) in climaHistory.slice(0, 3)"
            :key="f.id ?? i"
            class="rounded-lg bg-muted p-3"
          >
            <p class="text-xs font-semibold text-muted-foreground">{{ f.forecast_date }}</p>
            <p class="mt-1 text-sm text-foreground">{{ f.model_version }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
