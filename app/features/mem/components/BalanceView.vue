<template>
  <div class="space-y-5">
    <PageHeader title="Balance Energético" subtitle="Generación, consumo y precios del mercado">
      <template #actions>
        <Dropdown v-model="days" :options="dayOptions" optionLabel="label" optionValue="value" class="w-40" />
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <template v-else-if="!history.length && !loading">
      <div class="flex flex-col items-center py-16 gap-3" style="color: #6b5a8a;">
        <CloudDownloadIcon class="text-4xl size-[1em]" style="color: #c4b8d4;" />
        <p class="text-sm font-medium">Servicio de balance no disponible</p>
        <p class="text-xs">EVO API no configurada — los datos se mostrarán cuando DailySpot esté activo.</p>
      </div>
    </template>
    <template v-else>
      <!-- KPI row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="kpi in kpis" :key="kpi.label"
             class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
          <p class="text-xs uppercase tracking-wide font-semibold" style="color: #6b5a8a;">{{ kpi.label }}</p>
          <p class="text-2xl font-bold mt-1" :style="{ color: kpi.color }">{{ kpi.value }}</p>
          <p v-if="kpi.sub" class="text-xs mt-0.5" style="color: #6b5a8a;">{{ kpi.sub }}</p>
        </div>
      </div>

      <!-- Price history table -->
      <div class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
        <div class="px-5 py-3 border-b" style="border-color: #e8e0f0;">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Historial Precios de Bolsa</h3>
        </div>
        <DataTable :value="history" :paginator="history.length > 15" :rows="15"
                   responsiveLayout="scroll" stripedRows class="p-datatable-sm">
          <Column field="fecha" header="Fecha" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="font-mono text-sm">{{ data.fecha }}</span>
            </template>
          </Column>
          <Column field="precio_promedio" header="Precio Prom." sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="font-semibold">${{ fmt(data.precio_promedio) }}</span>
            </template>
          </Column>
          <Column field="precio_min" header="Mín" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span style="color: #10B981;">${{ fmt(data.precio_min) }}</span>
            </template>
          </Column>
          <Column field="precio_max" header="Máx" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span style="color: #D64455;">${{ fmt(data.precio_max) }}</span>
            </template>
          </Column>
          <Column field="demanda_gwh" header="Demanda GWh" sortable style="min-width: 120px">
            <template #body="{ data }">
              {{ data.demanda_gwh ? Number(data.demanda_gwh).toFixed(1) : '—' }}
            </template>
          </Column>
          <Column field="hidro_pct" header="Hidro %" sortable style="min-width: 100px">
            <template #body="{ data }">
              {{ data.hidro_pct ? Number(data.hidro_pct).toFixed(1) + '%' : '—' }}
            </template>
          </Column>
          <Column field="spread" header="Spread" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span :style="{ color: data.spread > 0 ? '#D64455' : '#10B981' }">
                {{ data.spread ? '$' + fmt(data.spread) : '—' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>

      <!-- Clima ONI context -->
      <div v-if="climaHistory.length" class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
        <div class="px-5 py-3 border-b" style="border-color: #e8e0f0;">
          <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Contexto Climático (ONI reciente)</h3>
        </div>
        <div class="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div v-for="f in climaHistory.slice(0, 3)" :key="f.id"
               class="p-3 rounded-lg" style="background: #f8f5fd;">
            <p class="text-xs font-semibold" style="color: #6b5a8a;">{{ f.forecast_date }}</p>
            <p class="text-sm mt-1" style="color: var(--color-unergy-deep);">{{ f.model_version }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { logger } from '~/core/logger'
import { EvoService } from '~/features/mem/services/evo'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dropdown from 'primevue/dropdown'
import { CloudDownloadIcon, LoaderCircleIcon } from '@lucide/vue'

const evoService = new EvoService()

const days = ref(30)
const dayOptions = [
  { label: '7 días', value: 7 },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
  { label: '365 días', value: 365 },
]

const history = ref([])
const climaHistory = ref([])
const loading = ref(true)

const kpis = computed(() => {
  if (!history.value.length) return []
  const latest = history.value[0]
  const avg = history.value.reduce((s, r) => s + (Number(r.precio_promedio) || 0), 0) / history.value.length
  const maxPrice = Math.max(...history.value.map(r => Number(r.precio_max) || 0))
  const avgDemand = history.value.reduce((s, r) => s + (Number(r.demanda_gwh) || 0), 0) / history.value.length
  return [
    { label: 'Precio hoy', value: '$' + fmt(latest?.precio_promedio), color: '#2C2039', sub: 'COP/kWh' },
    { label: `Promedio ${days.value}d`, value: '$' + fmt(avg), color: '#915BD8', sub: 'COP/kWh' },
    { label: 'Máximo período', value: '$' + fmt(maxPrice), color: '#D64455', sub: 'COP/kWh' },
    { label: 'Demanda prom.', value: avgDemand.toFixed(1), color: '#10B981', sub: 'GWh/día' },
  ]
})

function fmt(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

async function fetchData() {
  loading.value = true
  try {
    const [h, c] = await Promise.all([
      evoService.obtenerHistoricoSpot(days.value).catch(() => null),
      evoService.obtenerHistoricoClima(5).catch(() => null),
    ])
    if (h) history.value = h
    if (c) climaHistory.value = c
  } catch (e) {
    logger.error('mem', e)
  } finally {
    loading.value = false
  }
}

watch(days, fetchData)
onMounted(fetchData)
</script>
