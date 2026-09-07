<template>
  <div class="bg-white rounded-xl shadow-sm border overflow-hidden" style="border-color:#e8e0f0">
    <div class="px-3 py-2 flex items-center gap-2 border-b" style="border-color:#f0ebf6">
      <ChartColumnIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
      <h3 class="text-sm font-bold" style="color:var(--color-unergy-deep)">Este mes vs promedio del proyecto</h3>
      <span v-if="mesesHist" class="ml-auto text-[10px]" style="color:#9b8fb0">promedio de {{ mesesHist }} mes(es) anteriores</span>
    </div>

    <ProgressSpinner v-if="loading" style="width:32px;height:32px" class="block mx-auto my-6" />

    <div v-else-if="actual" class="p-3">
      <!-- KPIs del mes actual + variación vs promedio -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2" :class="showChart ? 'mb-3' : ''">
        <div v-for="k in kpis" :key="k.label" class="rounded-lg p-2" :style="{ background: k.bg }">
          <p class="text-[10px] uppercase tracking-wide font-semibold" :style="{ color: k.color }">{{ k.label }}</p>
          <p class="text-sm font-bold tabular-nums" :style="{ color: k.color }">
            {{ k.value == null ? '—' : (k.kwh ? fmtKwh(k.value) : (k.pct ? k.value.toFixed(1) + '%' : fmtCompact(k.value))) }}
          </p>
          <p v-if="k.delta != null" class="text-[10px] font-medium" :style="{ color: k.delta >= 0 ? '#10B981' : '#D64455' }">
            {{ k.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(k.delta).toFixed(0) }}% vs prom.
          </p>
        </div>
      </div>

      <div v-if="showChart" style="height: 240px">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-else class="text-center py-10">
      <ChartColumnIcon class="text-3xl mb-2 size-[1em]" style="color:#e0d5f0" />
      <p class="text-xs" style="color:#9b8fb0">Aún no hay cifras para este proyecto.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import ProgressSpinner from 'primevue/progressspinner'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { fmtCompact, fmtCOP } from '~/features/liquidaciones/utils/liquidaciones'
import { ChartColumnIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  proyectoId: { type: [Number, String], required: true },
  proyectoNombre: { type: String, default: '' },
  periodo: { type: String, required: true },   // YYYY-MM-01
  showChart: { type: Boolean, default: true },  // false → solo KPIs (indicador vs promedio)
})

const liquidacionesService = new LiquidacionesService()
const monitoreoLegacyService = new MonitoreoLegacyService()

const loading = ref(false)
const mensual = ref([])   // [{periodo:'YYYY-MM-01', ingresos, costosOp, facturas, neto}] del Panel
const generado = reactive({ actual: null, promedio: null })   // energía (kWh): mes vs prom.

function fmtKwh(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)} MWh`
  return `${v.toFixed(0)} kWh`
}

const actual = computed(() => mensual.value.find(x => x.periodo === props.periodo) || null)

const historico = computed(() =>
  mensual.value
    .filter(x => x.periodo < props.periodo)
    .sort((a, b) => b.periodo.localeCompare(a.periodo))   // más recientes primero
    .slice(0, 3)                                           // promedio de los 3 meses anteriores
)
const mesesHist = computed(() => historico.value.length)

const promedio = computed(() => {
  const h = historico.value
  if (!h.length) return null
  const avg = (k) => h.reduce((s, it) => s + it[k], 0) / h.length
  return { ingresos: avg('ingresos'), costosOp: avg('costosOp'), facturas: avg('facturas'), neto: avg('neto') }
})

const ITEMS = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'costosOp', label: 'Costos op.' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'neto', label: 'Neto' },
]

const kpis = computed(() => {
  const a = actual.value, p = promedio.value
  const costosTot = a.costosOp + a.facturas
  const costosTotProm = p ? p.costosOp + p.facturas : null
  const delta = (cur, prev) => (prev && cur != null ? (cur - prev) / Math.abs(prev) * 100 : null)
  return [
    { label: 'Generado', value: generado.actual, kwh: true, delta: delta(generado.actual, generado.promedio), color: '#6E3FB8', bg: '#f4f1fa' },
    { label: 'Ingresos', value: a.ingresos, delta: delta(a.ingresos, p?.ingresos), color: '#15803d', bg: '#ecfdf3' },
    { label: 'Costos totales', value: costosTot, delta: delta(costosTot, costosTotProm), color: '#b3324a', bg: '#fef2f3' },
    { label: 'Ingreso neto', value: a.neto, delta: delta(a.neto, p?.neto), color: '#915BD8', bg: '#faf7ff' },
    { label: 'Margen', value: a.ingresos ? a.neto / a.ingresos * 100 : 0, delta: null, color: '#6E3FB8', bg: '#faf7ff', pct: true },
  ]
})

const chartData = computed(() => {
  const a = actual.value, p = promedio.value
  const ds = [{
    label: 'Este mes', data: ITEMS.map(i => a[i.key]),
    backgroundColor: '#915BD8', borderRadius: 4, maxBarThickness: 46,
  }]
  if (p) ds.push({
    label: 'Promedio proyecto', data: ITEMS.map(i => p[i.key]),
    backgroundColor: '#D7C9EC', borderRadius: 4, maxBarThickness: 46,
  })
  return { labels: ITEMS.map(i => i.label), datasets: ds }
})

const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: true, labels: { font: { size: 11 }, color: '#6b5a8a', boxWidth: 12, usePointStyle: true } },
    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtCOP(c.parsed.y)}` } },
  },
  scales: {
    x: { ticks: { font: { size: 11 }, color: '#6b5a8a' }, grid: { display: false } },
    y: { ticks: { font: { size: 9 }, color: '#9ca3af', callback: (v) => fmtCompact(v) }, grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true },
  },
}

async function load() {
  // Cifras del Panel Contable (fuente única), ventana de meses para el promedio.
  mensual.value = []
  if (!props.proyectoId || !props.periodo) return
  loading.value = true
  try {
    const per = props.periodo.slice(0, 7)
    const [y, m] = per.split('-').map(Number)
    const d0 = new Date(y, m - 1 - 4, 1)
    const desde = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`
    const data = await liquidacionesService.obtenerResumenPanelRango({
      periodo_desde: desde, periodo_hasta: per, tipo: 'preliquidacion',
    })
    const out = []
    for (const entry of (data.periodos || [])) {
      const p = (entry.proyectos || []).find(x => String(x.proyecto_id) === String(props.proyectoId))
      if (!p) continue
      // Split de costos vs facturas desde grupos_totales (con signo negativo → magnitud).
      let comerc = 0, cost = 0, fact = 0
      for (const inv of (p.inversionistas || [])) {
        const g = inv.grupos_totales || {}
        comerc += g.comercializacion || 0; cost += g.costos || 0; fact += g.facturas || 0
      }
      out.push({
        periodo: entry.periodo + '-01',
        ingresos: p.ingresos_cop || 0,
        costosOp: Math.abs(comerc + cost),
        facturas: Math.abs(fact),
        neto: p.valor_a_pagar_total || 0,   // valor a pagar del Panel (con signo)
      })
    }
    mensual.value = out
  } catch {
    mensual.value = []
  } finally {
    loading.value = false
  }
}

// ── Energía generada (API de monitoreo en vivo): mes actual vs prom. 3 meses ──
const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function ultimoDiaMes(periodo) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mesPrevio(periodo, k) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 1 - k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

async function resolverSub() {
  const data = await monitoreoLegacyService.obtenerProyectos()
  const projects = data?.projects ?? []
  const pid = props.proyectoId != null ? String(props.proyectoId) : null
  const nombre = norm(props.proyectoNombre)
  let match = pid && projects.find(p => String(p.id ?? p.proyecto_id) === pid && p.sub_project)
  if (!match && nombre) match = projects.find(p => norm(p.nombre_comercial) === nombre && p.sub_project)
  if (!match && nombre) match = projects.find(p => p.sub_project && (norm(p.nombre_comercial).includes(nombre) || nombre.includes(norm(p.nombre_comercial))))
  return match?.sub_project ?? null
}

async function totalGen(sub, periodo) {
  const data = await monitoreoLegacyService.obtenerGeneracion({ sub_project: sub, date_from: periodo, date_to: ultimoDiaMes(periodo) })
  if (data && data.ok === false) return null
  let total = 0, has = false
  for (const it of (Array.isArray(data?.data) ? data.data : [])) {
    if (!it || it.kwh == null) continue
    total += Number(it.kwh); has = true
  }
  return has ? total : null
}

async function loadGeneracion() {
  generado.actual = null
  generado.promedio = null
  if (!props.periodo) return
  try {
    const sub = await resolverSub()
    if (!sub) return
    generado.actual = await totalGen(sub, props.periodo)
    const prevs = []
    for (let k = 1; k <= 3; k++) {
      const v = await totalGen(sub, mesPrevio(props.periodo, k))
      if (v != null && v > 0) prevs.push(v)
    }
    if (prevs.length) generado.promedio = prevs.reduce((a, b) => a + b, 0) / prevs.length
  } catch { /* generación opcional */ }
}

function cargar() { load(); loadGeneracion() }

watch(() => [props.proyectoId, props.periodo], cargar)
onMounted(cargar)
</script>
