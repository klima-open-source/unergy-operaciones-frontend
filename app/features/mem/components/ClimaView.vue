<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader title="Inteligencia Climática" subtitle="ENSO, precipitación y correlación con precios de energía" />

    <!-- No data banner -->
    <div v-if="!oniData.length && !priceData.length" class="rounded-xl p-4 flex items-center gap-3"
         style="background: rgba(145,91,216,0.06); border: 1px solid rgba(145,91,216,0.15);">
      <InfoIcon class="size-[1em]" style="color: var(--color-unergy-purple);" />
      <p class="text-sm" style="color: #6b5a8a;">Datos climáticos no disponibles — EVO API no configurada. Se mostrarán cuando el servicio esté activo.</p>
    </div>

    <!-- Current ENSO Status -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="kpi in ensoKpis" :key="kpi.label"
           class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <p class="text-xs uppercase tracking-wide font-semibold" style="color: #6b5a8a;">{{ kpi.label }}</p>
        <p class="text-2xl font-bold mt-1" :style="{ color: kpi.color }">{{ kpi.value }}</p>
        <p v-if="kpi.sub" class="text-xs mt-0.5" style="color: var(--color-unergy-purple);">{{ kpi.sub }}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-white rounded-lg p-1 shadow-sm" style="border: 1px solid #e8e0f0;">
      <button v-for="(tab, i) in TABS" :key="tab" @click="activeTab = i"
              class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              :style="activeTab === i
                ? { backgroundColor: 'var(--color-unergy-purple)', color: 'white' }
                : { color: '#6b5a8a' }">
        {{ tab }}
      </button>
    </div>

    <!-- Tab 0: ONI Timeline -->
    <div v-if="activeTab === 0" class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
      <h3 class="text-sm font-semibold mb-4" style="color: var(--color-unergy-deep);">Índice ONI (Oceanic Niño Index)</h3>
      <div class="overflow-x-auto">
        <svg viewBox="0 0 900 250" class="w-full" style="min-width: 600px;">
          <!-- Background bands -->
          <rect x="40" y="10" :width="840" :height="oniChartMid - 10" fill="rgba(214,68,85,0.05)" />
          <rect x="40" :y="oniChartMid" :width="840" :height="230 - oniChartMid" fill="rgba(59,130,246,0.05)" />

          <!-- Zero line -->
          <line x1="40" :y1="oniChartMid" x2="880" :y2="oniChartMid" stroke="#9CA3AF" stroke-width="0.5" stroke-dasharray="4" />
          <!-- Threshold lines -->
          <line x1="40" :y1="oniToY(0.5)" x2="880" :y2="oniToY(0.5)" stroke="#D64455" stroke-width="0.5" stroke-dasharray="2" />
          <line x1="40" :y1="oniToY(-0.5)" x2="880" :y2="oniToY(-0.5)" stroke="#3B82F6" stroke-width="0.5" stroke-dasharray="2" />

          <!-- ONI line -->
          <polyline v-if="oniPoints.length" :points="oniPointsStr" fill="none" stroke="var(--color-unergy-purple)" stroke-width="1.5" />

          <!-- Y axis labels -->
          <text x="35" :y="oniToY(2) + 4" fill="#D64455" font-size="9" text-anchor="end">2.0</text>
          <text x="35" :y="oniToY(1) + 4" fill="#D64455" font-size="9" text-anchor="end">1.0</text>
          <text x="35" :y="oniToY(0.5) + 4" fill="#9CA3AF" font-size="8" text-anchor="end">0.5</text>
          <text x="35" :y="oniChartMid + 4" fill="#6b5a8a" font-size="9" text-anchor="end">0</text>
          <text x="35" :y="oniToY(-0.5) + 4" fill="#9CA3AF" font-size="8" text-anchor="end">-0.5</text>
          <text x="35" :y="oniToY(-1) + 4" fill="#3B82F6" font-size="9" text-anchor="end">-1.0</text>
          <text x="35" :y="oniToY(-2) + 4" fill="#3B82F6" font-size="9" text-anchor="end">-2.0</text>

          <!-- X axis year labels -->
          <template v-for="(label, idx) in oniXLabels" :key="idx">
            <text :x="label.x" y="248" fill="#6b5a8a" font-size="9" text-anchor="middle">{{ label.year }}</text>
          </template>

          <!-- Labels -->
          <text x="880" :y="oniToY(1.5)" fill="#D64455" font-size="9" text-anchor="end">El Niño</text>
          <text x="880" :y="oniToY(-1.5)" fill="#3B82F6" font-size="9" text-anchor="end">La Niña</text>
        </svg>
      </div>
    </div>

    <!-- Tab 1: Price vs ENSO -->
    <div v-if="activeTab === 1" class="space-y-4">
      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <h3 class="text-sm font-semibold mb-4" style="color: var(--color-unergy-deep);">Precio Energía vs Fase ENSO (26 años)</h3>
        <div class="overflow-x-auto">
          <svg viewBox="0 0 900 280" class="w-full" style="min-width: 600px;">
            <!-- ENSO phase backgrounds -->
            <template v-for="(band, idx) in phaseBands" :key="idx">
              <rect :x="band.x" y="10" :width="band.w" :height="230"
                    :fill="band.phase === 'El Niño' ? 'rgba(214,68,85,0.08)' : band.phase === 'La Niña' ? 'rgba(59,130,246,0.08)' : 'transparent'" />
            </template>

            <!-- Price line -->
            <polyline v-if="pricePoints.length" :points="pricePointsStr" fill="none" stroke="var(--color-unergy-purple)" stroke-width="1.5" />

            <!-- Y axis -->
            <template v-for="tick in priceTicks" :key="tick">
              <text x="35" :y="priceToY(tick) + 4" fill="#6b5a8a" font-size="9" text-anchor="end">${{ tick }}</text>
              <line x1="40" :y1="priceToY(tick)" x2="880" :y2="priceToY(tick)" stroke="#e8e0f0" stroke-width="0.5" />
            </template>

            <!-- X axis -->
            <template v-for="(label, idx) in priceXLabels" :key="idx">
              <text :x="label.x" y="258" fill="#6b5a8a" font-size="9" text-anchor="middle">{{ label.year }}</text>
            </template>
          </svg>
        </div>
      </div>

      <!-- Phase stats -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div v-for="phase in phaseStats" :key="phase.name"
             class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: phase.color }" />
            <h4 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ phase.name }}</h4>
          </div>
          <p class="text-3xl font-bold" style="color: var(--color-unergy-deep);">${{ phase.avgPrice }}</p>
          <p class="text-xs" style="color: #6b5a8a;">COP/kWh promedio · {{ phase.count }} meses</p>
        </div>
      </div>
    </div>

    <!-- Tab 2: Precipitation -->
    <div v-if="activeTab === 2" class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Precipitación Región Andina</h3>
        <select v-model="precipRegion" @change="loadPrecip"
                class="text-sm px-3 py-1.5 rounded-lg border" style="border-color: #e8e0f0;">
          <option v-for="r in REGIONS" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>

      <div class="overflow-x-auto">
        <svg viewBox="0 0 900 250" class="w-full" style="min-width: 600px;">
          <!-- Climatology area -->
          <polyline v-if="precipClimatology.length" :points="precipClimatologyStr"
                    fill="rgba(59,130,246,0.08)" stroke="#3B82F6" stroke-width="0.5" stroke-dasharray="3" />

          <!-- Actual precip bars -->
          <template v-for="(bar, idx) in precipBars" :key="idx">
            <rect :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
                  :fill="bar.anomaly > 0 ? '#3B82F6' : '#F0C040'" :opacity="0.7" rx="1" />
          </template>

          <!-- X axis -->
          <template v-for="(label, idx) in precipXLabels" :key="idx">
            <text :x="label.x" y="248" fill="#6b5a8a" font-size="9" text-anchor="middle">{{ label.year }}</text>
          </template>
        </svg>
      </div>

      <!-- Anomaly stats -->
      <div class="grid grid-cols-3 gap-4 mt-4">
        <div class="p-3 rounded-lg" style="background: #f8f6fb;">
          <p class="text-xs" style="color: #6b5a8a;">Último mes</p>
          <p class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ precipStats.lastMonth }} mm</p>
          <p class="text-xs" :style="{ color: precipStats.lastAnomaly > 0 ? '#3B82F6' : '#F0C040' }">
            {{ precipStats.lastAnomaly > 0 ? '+' : '' }}{{ precipStats.lastAnomaly }}%
          </p>
        </div>
        <div class="p-3 rounded-lg" style="background: #f8f6fb;">
          <p class="text-xs" style="color: #6b5a8a;">Promedio 12m</p>
          <p class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ precipStats.avg12m }} mm</p>
        </div>
        <div class="p-3 rounded-lg" style="background: #f8f6fb;">
          <p class="text-xs" style="color: #6b5a8a;">Climatología</p>
          <p class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ precipStats.climatology }} mm</p>
        </div>
      </div>
    </div>

    <!-- Tab 3: Data Table -->
    <div v-if="activeTab === 3" class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
      <DataTable :value="oniData.slice(0, 120)" size="small" stripedRows :rowHover="true"
                 :paginator="true" :rows="24" scrollable scrollHeight="500px" class="text-sm">
        <Column header="Fecha" style="min-width:100px">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.year }}-{{ String(data.month).padStart(2, '0') }}</span>
          </template>
        </Column>
        <Column field="oni_value" header="ONI" style="min-width:80px" sortable>
          <template #body="{ data }">
            <span class="font-mono text-sm" :style="{
              color: data.oni_value > 0.5 ? '#D64455' : data.oni_value < -0.5 ? '#3B82F6' : '#6b5a8a'
            }">{{ data.oni_value?.toFixed(2) ?? '—' }}</span>
          </template>
        </Column>
        <Column field="enso_phase" header="Fase" style="min-width:100px">
          <template #body="{ data }">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="{
              'bg-red-100 text-red-600': data.enso_phase === 'El Niño',
              'bg-blue-100 text-blue-600': data.enso_phase === 'La Niña',
              'bg-gray-100 text-gray-600': !data.enso_phase || data.enso_phase === 'Neutral',
            }">{{ data.enso_phase || 'Neutral' }}</span>
          </template>
        </Column>
        <Column field="soi_value" header="SOI" style="min-width:80px">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.soi_value?.toFixed(1) ?? '—' }}</span>
          </template>
        </Column>
        <Column field="pdo_value" header="PDO" style="min-width:80px">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.pdo_value?.toFixed(2) ?? '—' }}</span>
          </template>
        </Column>
        <Column field="mjo_amplitude" header="MJO Amp" style="min-width:80px">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.mjo_amplitude?.toFixed(1) ?? '—' }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { EvoService } from '~/features/mem/services/evo'
import { InfoIcon } from '@lucide/vue'

const evoService = new EvoService()

const TABS = ['ENSO Timeline', 'Precio vs ENSO', 'Precipitación', 'Datos ONI']
const REGIONS = ['Andina', 'Caribe', 'Pacifica', 'Orinoquia', 'Amazonia']
const activeTab = ref(0)
const precipRegion = ref('Andina')

const oniData = ref([])
const priceData = ref([])
const precipData = ref([])

const oniChartMid = 120

function oniToY(val) {
  return oniChartMid - val * 50
}

const oniPoints = computed(() => {
  const sorted = [...oniData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalMonths = (last.year - first.year) * 12 + (last.month - first.month)
  if (totalMonths <= 0) return []

  return sorted.map(d => {
    const idx = (d.year - first.year) * 12 + (d.month - first.month)
    return { x: 40 + (idx / totalMonths) * 840, y: oniToY(d.oni_value || 0) }
  })
})

const oniPointsStr = computed(() => oniPoints.value.map(p => `${p.x},${p.y}`).join(' '))

const oniXLabels = computed(() => {
  const sorted = [...oniData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalMonths = (last.year - first.year) * 12 + (last.month - first.month)
  if (totalMonths <= 0) return []
  const labels = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 10))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = (y - first.year) * 12
    labels.push({ x: 40 + (idx / totalMonths) * 840, year: y })
  }
  return labels
})

const ensoKpis = computed(() => {
  if (!oniData.value.length) return []
  const latest = oniData.value[0]
  const oni = latest.oni_value ?? 0
  const phase = latest.enso_phase || 'Neutral'

  const ninoMonths = oniData.value.filter(d => d.enso_phase === 'El Niño').length
  const ninaMonths = oniData.value.filter(d => d.enso_phase === 'La Niña').length

  return [
    {
      label: 'ONI Actual',
      value: oni.toFixed(2),
      color: oni > 0.5 ? '#D64455' : oni < -0.5 ? '#3B82F6' : '#6b5a8a',
      sub: `${latest.year}-${String(latest.month).padStart(2, '0')}`,
    },
    {
      label: 'Fase ENSO',
      value: phase,
      color: phase === 'El Niño' ? '#D64455' : phase === 'La Niña' ? '#3B82F6' : '#6b5a8a',
    },
    {
      label: 'Meses El Niño',
      value: ninoMonths,
      color: '#D64455',
      sub: `de ${oniData.value.length} registros`,
    },
    {
      label: 'Meses La Niña',
      value: ninaMonths,
      color: '#3B82F6',
      sub: `de ${oniData.value.length} registros`,
    },
  ]
})

// Price vs ENSO chart
const priceMax = computed(() => Math.max(...priceData.value.map(d => d.price_cop_kwh || 0), 1))
const priceTicks = computed(() => {
  const max = priceMax.value
  const step = max > 1000 ? 500 : max > 500 ? 200 : 100
  const ticks = []
  for (let v = 0; v <= max * 1.1; v += step) ticks.push(Math.round(v))
  return ticks
})

function priceToY(val) {
  return 230 - (val / (priceMax.value * 1.1)) * 220 + 10
}

const pricePoints = computed(() => {
  const sorted = [...priceData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalMonths = (last.year - first.year) * 12 + (last.month - first.month)
  if (totalMonths <= 0) return []
  return sorted.map(d => {
    const idx = (d.year - first.year) * 12 + (d.month - first.month)
    return { x: 40 + (idx / totalMonths) * 840, y: priceToY(d.price_cop_kwh || 0) }
  })
})

const pricePointsStr = computed(() => pricePoints.value.map(p => `${p.x},${p.y}`).join(' '))

const priceXLabels = computed(() => {
  const sorted = [...priceData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalMonths = (last.year - first.year) * 12 + (last.month - first.month)
  if (totalMonths <= 0) return []
  const labels = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 8))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = (y - first.year) * 12
    labels.push({ x: 40 + (idx / totalMonths) * 840, year: y })
  }
  return labels
})

const phaseBands = computed(() => {
  const sorted = [...priceData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalMonths = (last.year - first.year) * 12 + (last.month - first.month)
  if (totalMonths <= 0) return []

  const bands = []
  let currentPhase = null
  let startIdx = 0

  sorted.forEach((d, i) => {
    const phase = d.enso_phase || 'Neutral'
    if (phase !== currentPhase) {
      if (currentPhase && currentPhase !== 'Neutral') {
        const idx = (d.year - first.year) * 12 + (d.month - first.month)
        bands.push({
          x: 40 + (startIdx / totalMonths) * 840,
          w: ((idx - startIdx) / totalMonths) * 840,
          phase: currentPhase,
        })
      }
      currentPhase = phase
      startIdx = (d.year - first.year) * 12 + (d.month - first.month)
    }
  })
  return bands
})

const phaseStats = computed(() => {
  const groups = { 'El Niño': [], 'Neutral': [], 'La Niña': [] }
  priceData.value.forEach(d => {
    const phase = d.enso_phase || 'Neutral'
    if (groups[phase]) groups[phase].push(d.price_cop_kwh || 0)
  })
  return [
    { name: 'El Niño', color: '#D64455', avgPrice: avg(groups['El Niño']).toFixed(1), count: groups['El Niño'].length },
    { name: 'Neutral', color: '#6b5a8a', avgPrice: avg(groups['Neutral']).toFixed(1), count: groups['Neutral'].length },
    { name: 'La Niña', color: '#3B82F6', avgPrice: avg(groups['La Niña']).toFixed(1), count: groups['La Niña'].length },
  ]
})

function avg(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

// Precipitation
const precipBars = computed(() => {
  const sorted = [...precipData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const maxPrecip = Math.max(...sorted.map(d => d.precip_mm || 0), 1)
  const n = sorted.length
  const barW = Math.max(1, 840 / n - 1)
  return sorted.map((d, i) => {
    const h = ((d.precip_mm || 0) / maxPrecip) * 200
    return {
      x: 40 + (i / n) * 840,
      y: 230 - h,
      w: barW,
      h,
      anomaly: d.anomaly_pct || 0,
    }
  })
})

const precipClimatology = computed(() => {
  const sorted = [...precipData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const maxPrecip = Math.max(...sorted.map(d => d.precip_mm || 0), 1)
  const n = sorted.length
  return sorted.map((d, i) => {
    const y = 230 - ((d.climatology_mm || 0) / maxPrecip) * 200
    return `${40 + (i / n) * 840},${y}`
  })
})

const precipClimatologyStr = computed(() => precipClimatology.value.join(' '))

const precipXLabels = computed(() => {
  const sorted = [...precipData.value].sort((a, b) => a.year - b.year || a.month - b.month)
  if (!sorted.length) return []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const n = sorted.length
  const labels = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 8))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = sorted.findIndex(d => d.year === y && d.month === 1)
    if (idx >= 0) labels.push({ x: 40 + (idx / n) * 840, year: y })
  }
  return labels
})

const precipStats = computed(() => {
  if (!precipData.value.length) return { lastMonth: '—', lastAnomaly: 0, avg12m: '—', climatology: '—' }
  const latest = precipData.value[0]
  const last12 = precipData.value.slice(0, 12)
  return {
    lastMonth: (latest.precip_mm || 0).toFixed(0),
    lastAnomaly: (latest.anomaly_pct || 0).toFixed(0),
    avg12m: avg(last12.map(d => d.precip_mm || 0)).toFixed(0),
    climatology: (latest.climatology_mm || 0).toFixed(0),
  }
})

async function loadPrecip() {
  try {
    const res = await evoService.obtenerPrecipitacion(precipRegion.value, 10)
    if (res) precipData.value = res
  } catch { /* degrade */ }
}

onMounted(async () => {
  const [oniRes, pricesRes] = await Promise.all([
    evoService.obtenerOni(10).catch(() => null),
    evoService.obtenerPreciosHistoricos(26).catch(() => null),
  ])
  if (oniRes) oniData.value = oniRes
  if (pricesRes) priceData.value = pricesRes
  loadPrecip()
})
</script>
