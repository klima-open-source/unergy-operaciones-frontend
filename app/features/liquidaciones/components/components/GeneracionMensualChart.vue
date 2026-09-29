<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { ChartColumnIcon, SunIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import type { EntradaIndexacion } from '~/features/contratos/types'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { fmtCOP, formatPeriodo } from '~/features/liquidaciones/utils/liquidaciones'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  proyectoId?: number | string | null
  proyectoNombre?: string
  /** "YYYY-MM-01". */
  periodo: string
}>()

const monitoreoLegacyService = new MonitoreoLegacyService()
const contratosServicioService = new ContratosServicioService()

const loading = ref(false)
const dias = ref<{ date: string; kwh: number }[]>([])
const mensaje = ref('')
const tarifas = reactive<{
  representacion: number | null
  cgm: number | null
  admin: number | null
}>({ representacion: null, cgm: null, admin: null })

const periodoLabel = computed(() => formatPeriodo(props.periodo))

function fmtAdminPct(v: number | null): string {
  if (v == null) return '—'
  const n = Number(v)
  return `${(Math.abs(n) < 1 ? n * 100 : n).toFixed(2)}%`
}

const norm = (s: string | null | undefined) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function fmtKwh(v: number): string {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)} MWh` : `${v.toFixed(0)} kWh`
}

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: dias.value.map((d) => Number(d.date.split('-')[2])),
  datasets: [
    {
      label: 'Generación',
      data: dias.value.map((d) => d.kwh),
      backgroundColor: '#915BD8',
      borderRadius: 3,
      maxBarThickness: 16,
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (c) => fmtKwh(Number(c.parsed.y)),
        title: (items) => `Día ${items[0]?.label}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { font: { size: 9 }, color: '#9ca3af', maxTicksLimit: 16 },
      grid: { display: false },
    },
    y: {
      ticks: { font: { size: 9 }, color: '#9ca3af' },
      grid: { color: 'rgba(0,0,0,0.05)' },
      beginAtZero: true,
    },
  },
}

function ultimoDiaMes(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y!, m!, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Generación (API de monitoreo en vivo) ─────────────────────────────────────
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

async function cargarGeneracion() {
  if (!props.periodo) return
  loading.value = true
  mensaje.value = ''
  dias.value = []
  try {
    const sub = await resolverSub()
    if (!sub) {
      mensaje.value = 'Este proyecto no tiene monitoreo en la API de Unergy.'
      return
    }
    const data = await monitoreoLegacyService.obtenerGeneracion({
      sub_project: sub,
      date_from: props.periodo,
      date_to: ultimoDiaMes(props.periodo),
    })
    if (data && data.ok === false) {
      mensaje.value = 'La API de Unergy no devolvió datos.'
      return
    }
    const porDia = new Map<string, number>()
    for (const it of Array.isArray(data?.data) ? data.data : []) {
      if (!it || it.kwh == null || !it.date) continue
      porDia.set(it.date, (porDia.get(it.date) || 0) + Number(it.kwh))
    }
    dias.value = [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, kwh]) => ({ date, kwh }))
  } catch (e) {
    mensaje.value = normalizeError(e).message || 'No se pudo consultar la generación.'
  } finally {
    loading.value = false
  }
}

// ── Tarifas de servicio (contratos del proyecto, indexadas por año) ───────────
// indexacion_* = [{ año, valor }]. Se toma el valor del año del período; si no hay,
// el del último año <= período; si no, la tarifa base del contrato.
function tarifaDelAnio(
  indexacion: EntradaIndexacion[] | undefined,
  base: number | null | undefined,
  anio: number,
): number | null {
  const arr = Array.isArray(indexacion) ? indexacion.filter((r) => r && r.valor != null) : []
  if (arr.length) {
    const exacta = arr.find((r) => Number(r.año ?? r.anio) === anio)
    if (exacta) return Number(exacta.valor)
    const previas = arr
      .filter((r) => Number(r.año ?? r.anio) <= anio)
      .sort((a, b) => Number(b.año ?? b.anio) - Number(a.año ?? a.anio))
    if (previas.length) return Number(previas[0]!.valor)
  }
  return base != null ? Number(base) : null
}

async function cargarTarifas() {
  tarifas.representacion = null
  tarifas.cgm = null
  tarifas.admin = null
  if (!props.proyectoId) return
  try {
    const contratos = await contratosServicioService.listar({
      proyecto_id: Number(props.proyectoId),
    })
    const anio = Number(props.periodo.split('-')[0])
    for (const c of contratos) {
      if (
        tarifas.representacion == null &&
        (c.indexacion_representacion?.length || c.tarifa_representacion != null)
      )
        tarifas.representacion = tarifaDelAnio(
          c.indexacion_representacion,
          c.tarifa_representacion,
          anio,
        )
      if (tarifas.cgm == null && (c.indexacion_cgm?.length || c.tarifa_cgm != null))
        tarifas.cgm = tarifaDelAnio(c.indexacion_cgm, c.tarifa_cgm, anio)
      if (tarifas.admin == null && c.tarifa_admin != null) tarifas.admin = Number(c.tarifa_admin)
    }
  } catch {
    /* tarifas opcionales */
  }
}

function cargar() {
  cargarGeneracion()
  cargarTarifas()
}

watch(() => [props.proyectoId, props.periodo], cargar)
onMounted(cargar)
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
    <div class="flex items-center gap-2 border-b px-3 py-2">
      <SunIcon class="size-4 text-warning" />
      <h3 class="text-sm font-bold text-foreground">Generación del mes</h3>
      <span class="text-xs text-muted-foreground">kWh por día · datos en vivo</span>
    </div>

    <div class="flex-1 p-3">
      <Spinner v-if="loading" class="mx-auto my-6 block size-6 text-muted-foreground" />

      <template v-else-if="dias.length">
        <div class="h-37.5">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
        <p class="mt-1.5 text-xs text-muted-foreground">
          Fuente: API de monitoreo Unergy (en vivo)
        </p>
      </template>

      <div v-else class="py-6 text-center">
        <ChartColumnIcon class="mx-auto mb-2 size-8 text-muted-foreground/40" />
        <p class="text-xs text-muted-foreground">
          {{ mensaje || 'Sin generación registrada para este período.' }}
        </p>
      </div>
    </div>

    <!-- Tarifas de servicio del cliente para ese mes -->
    <div class="border-t bg-muted/20 px-3 py-2">
      <p class="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Tarifas de servicio · {{ periodoLabel }}
      </p>
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg bg-primary/5 px-2 py-1.5 text-center">
          <p class="text-xs font-semibold tracking-wide text-primary uppercase">
            Representación ($/kWh)
          </p>
          <p class="text-sm font-bold text-foreground tabular-nums">
            {{ fmtCOP(tarifas.representacion) }}
          </p>
        </div>
        <div class="rounded-lg bg-primary/5 px-2 py-1.5 text-center">
          <p class="text-xs font-semibold tracking-wide text-primary uppercase">CGM ($/kWh)</p>
          <p class="text-sm font-bold text-foreground tabular-nums">{{ fmtCOP(tarifas.cgm) }}</p>
        </div>
        <div class="rounded-lg bg-primary/5 px-2 py-1.5 text-center">
          <p class="text-xs font-semibold tracking-wide text-primary uppercase">
            Administración (%)
          </p>
          <p class="text-sm font-bold text-foreground tabular-nums">
            {{ fmtAdminPct(tarifas.admin) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
