<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Legend, Tooltip } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { ChartColumnIcon } from '@lucide/vue'
import { fmtCompact, fmtCOP } from '~/features/liquidaciones/utils/liquidaciones'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = withDefaults(
  defineProps<{
    proyectoId: number | string
    proyectoNombre?: string
    /** "YYYY-MM-01". */
    periodo: string
    /** false → solo KPIs (indicador vs promedio). */
    showChart?: boolean
  }>(),
  { proyectoNombre: '', showChart: true },
)

interface MesMensual {
  periodo: string
  ingresos: number
  costosOp: number
  facturas: number
  neto: number
}

const liquidacionesService = new LiquidacionesService()
const monitoreoLegacyService = new MonitoreoLegacyService()

const loading = ref(false)
const mensual = ref<MesMensual[]>([]) // del Panel
const generado = reactive<{ actual: number | null; promedio: number | null }>({
  actual: null,
  promedio: null,
})

function fmtKwh(v: number | null): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)} MWh`
  return `${v.toFixed(0)} kWh`
}

const actual = computed(() => mensual.value.find((x) => x.periodo === props.periodo) || null)

const historico = computed(
  () =>
    mensual.value
      .filter((x) => x.periodo < props.periodo)
      .sort((a, b) => b.periodo.localeCompare(a.periodo)) // más recientes primero
      .slice(0, 3), // promedio de los 3 meses anteriores
)
const mesesHist = computed(() => historico.value.length)

const promedio = computed(() => {
  const h = historico.value
  if (!h.length) return null
  const avg = (k: 'ingresos' | 'costosOp' | 'facturas' | 'neto') =>
    h.reduce((s, it) => s + it[k], 0) / h.length
  return {
    ingresos: avg('ingresos'),
    costosOp: avg('costosOp'),
    facturas: avg('facturas'),
    neto: avg('neto'),
  }
})

const ITEMS = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'costosOp', label: 'Costos op.' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'neto', label: 'Neto' },
] as const

interface Kpi {
  label: string
  value: number | null
  kwh?: boolean
  pct?: boolean
  delta: number | null
  color: string
  bg: string
}

const kpis = computed<Kpi[]>(() => {
  const a = actual.value
  const p = promedio.value
  if (!a) return []
  const costosTot = a.costosOp + a.facturas
  const costosTotProm = p ? p.costosOp + p.facturas : null
  const delta = (cur: number | null, prev: number | null | undefined) =>
    prev && cur != null ? ((cur - prev) / Math.abs(prev)) * 100 : null
  return [
    {
      label: 'Generado',
      value: generado.actual,
      kwh: true,
      delta: delta(generado.actual, generado.promedio),
      color: 'var(--primary)',
      bg: 'color-mix(in oklab, var(--primary) 10%, transparent)',
    },
    {
      label: 'Ingresos',
      value: a.ingresos,
      delta: delta(a.ingresos, p?.ingresos),
      color: 'var(--success)',
      bg: 'color-mix(in oklab, var(--success) 10%, transparent)',
    },
    {
      label: 'Costos totales',
      value: costosTot,
      delta: delta(costosTot, costosTotProm),
      color: 'var(--destructive)',
      bg: 'color-mix(in oklab, var(--destructive) 10%, transparent)',
    },
    {
      label: 'Ingreso neto',
      value: a.neto,
      delta: delta(a.neto, p?.neto),
      color: 'var(--primary)',
      bg: 'color-mix(in oklab, var(--primary) 10%, transparent)',
    },
    {
      label: 'Margen',
      value: a.ingresos ? (a.neto / a.ingresos) * 100 : 0,
      delta: null,
      color: 'var(--primary)',
      bg: 'color-mix(in oklab, var(--primary) 10%, transparent)',
      pct: true,
    },
  ]
})

const chartData = computed<ChartData<'bar'>>(() => {
  const a = actual.value
  const p = promedio.value
  if (!a) return { labels: [], datasets: [] }
  const ds = [
    {
      label: 'Este mes',
      data: ITEMS.map((i) => a[i.key]),
      backgroundColor: '#915BD8',
      borderRadius: 4,
      maxBarThickness: 46,
    },
  ]
  if (p)
    ds.push({
      label: 'Promedio proyecto',
      data: ITEMS.map((i) => p[i.key]),
      backgroundColor: '#D7C9EC',
      borderRadius: 4,
      maxBarThickness: 46,
    })
  return { labels: ITEMS.map((i) => i.label), datasets: ds }
})

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      labels: { font: { size: 11 }, color: '#6b5a8a', boxWidth: 12, usePointStyle: true },
    },
    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtCOP(c.parsed.y)}` } },
  },
  scales: {
    x: { ticks: { font: { size: 11 }, color: '#6b5a8a' }, grid: { display: false } },
    y: {
      ticks: { font: { size: 9 }, color: '#9ca3af', callback: (v) => fmtCompact(Number(v)) },
      grid: { color: 'rgba(0,0,0,0.05)' },
      beginAtZero: true,
    },
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
    const d0 = new Date(y!, m! - 1 - 4, 1)
    const desde = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`
    const data = await liquidacionesService.obtenerResumenPanelRango({
      periodo_desde: desde,
      periodo_hasta: per,
      tipo: 'preliquidacion',
    })
    const out: MesMensual[] = []
    for (const entry of data.periodos || []) {
      const p = (entry.proyectos || []).find(
        (x) => String(x.proyecto_id) === String(props.proyectoId),
      )
      if (!p) continue
      // Split de costos vs facturas desde grupos_totales (con signo negativo → magnitud).
      let comerc = 0
      let cost = 0
      let fact = 0
      for (const inv of p.inversionistas || []) {
        const g = inv.grupos_totales || {}
        comerc += g.comercializacion || 0
        cost += g.costos || 0
        fact += g.facturas || 0
      }
      out.push({
        periodo: entry.periodo + '-01',
        ingresos: p.ingresos_cop || 0,
        costosOp: Math.abs(comerc + cost),
        facturas: Math.abs(fact),
        neto: p.valor_a_pagar_total || 0, // valor a pagar del Panel (con signo)
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
const norm = (s: string | null | undefined) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function ultimoDiaMes(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y!, m!, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mesPrevio(periodo: string, k: number): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y!, m! - 1 - k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

async function resolverSub(): Promise<string | null> {
  const data = await monitoreoLegacyService.obtenerProyectos()
  const projects = data?.projects ?? []
  const pid = props.proyectoId != null ? String(props.proyectoId) : null
  const nombre = norm(props.proyectoNombre)
  let match: (typeof projects)[number] | undefined
  if (pid) match = projects.find((p) => String(p.id ?? p.proyecto_id) === pid && p.sub_project)
  if (!match && nombre)
    match = projects.find((p) => norm(p.nombre_comercial) === nombre && p.sub_project)
  if (!match && nombre)
    match = projects.find(
      (p) =>
        p.sub_project &&
        (norm(p.nombre_comercial).includes(nombre) || nombre.includes(norm(p.nombre_comercial))),
    )
  return match?.sub_project ?? null
}

async function totalGen(sub: string, periodo: string): Promise<number | null> {
  const data = await monitoreoLegacyService.obtenerGeneracion({
    sub_project: sub,
    date_from: periodo,
    date_to: ultimoDiaMes(periodo),
  })
  if (data && data.ok === false) return null
  let total = 0
  let has = false
  for (const it of Array.isArray(data?.data) ? data.data : []) {
    if (!it || it.kwh == null) continue
    total += Number(it.kwh)
    has = true
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
    const prevs: number[] = []
    for (let k = 1; k <= 3; k++) {
      const v = await totalGen(sub, mesPrevio(props.periodo, k))
      if (v != null && v > 0) prevs.push(v)
    }
    if (prevs.length) generado.promedio = prevs.reduce((a, b) => a + b, 0) / prevs.length
  } catch {
    /* generación opcional */
  }
}

function cargar() {
  load()
  loadGeneracion()
}

watch(() => [props.proyectoId, props.periodo], cargar)
onMounted(cargar)
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-card">
    <div class="flex items-center gap-2 border-b px-3 py-2">
      <ChartColumnIcon class="size-4 text-primary" />
      <h3 class="text-sm font-bold text-foreground">Este mes vs promedio del proyecto</h3>
      <span v-if="mesesHist" class="ml-auto text-xs text-muted-foreground"
        >promedio de {{ mesesHist }} mes(es) anteriores</span
      >
    </div>

    <Spinner v-if="loading" class="mx-auto my-6 block size-6 text-muted-foreground" />

    <div v-else-if="actual" class="p-3">
      <!-- KPIs del mes actual + variación vs promedio -->
      <div class="grid grid-cols-2 gap-2 md:grid-cols-5" :class="showChart ? 'mb-3' : ''">
        <div
          v-for="k in kpis"
          :key="k.label"
          class="rounded-lg bg-(--bg) p-2"
          :style="{ '--bg': k.bg }"
        >
          <p
            class="text-xs font-semibold tracking-wide text-(--c) uppercase"
            :style="{ '--c': k.color }"
          >
            {{ k.label }}
          </p>
          <p class="text-sm font-bold text-(--c) tabular-nums" :style="{ '--c': k.color }">
            {{
              k.value == null
                ? '—'
                : k.kwh
                  ? fmtKwh(k.value)
                  : k.pct
                    ? k.value.toFixed(1) + '%'
                    : fmtCompact(k.value)
            }}
          </p>
          <p
            v-if="k.delta != null"
            class="text-xs font-medium"
            :class="k.delta >= 0 ? 'text-success' : 'text-destructive'"
          >
            {{ k.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(k.delta).toFixed(0) }}% vs prom.
          </p>
        </div>
      </div>

      <div v-if="showChart" class="h-60">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-else class="py-10 text-center">
      <ChartColumnIcon class="mx-auto mb-2 size-8 text-muted-foreground/40" />
      <p class="text-xs text-muted-foreground">Aún no hay cifras para este proyecto.</p>
    </div>
  </div>
</template>
