<template>
  <Teleport to="body">
    <Transition name="isheet">
      <div v-if="open" class="fixed inset-0 z-50 flex flex-col bg-muted font-sans text-unergy-deep">
        <!-- Encabezado -->
        <header
          class="is-head flex shrink-0 items-center gap-2.5 bg-unergy-deep px-3 pb-2 text-white"
        >
          <button class="size-9 shrink-0 rounded-lg bg-white/10 text-white" @click="close">
            <ChevronLeftIcon class="size-4" />
          </button>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-base font-bold">Potencia por inversor</span>
            <TruncatedText :text="nombre || '—'" class="text-xs text-white/60" />
          </div>
          <button
            class="size-9 shrink-0 rounded-lg bg-white/10 text-white disabled:opacity-50"
            :disabled="loading"
            @click="cargar(true)"
            title="Actualizar"
          >
            <LoaderCircleIcon v-if="loading" class="size-4 animate-spin" />
            <RefreshCwIcon v-else class="size-4" />
          </button>
        </header>

        <!-- Selector de líneas -->
        <div
          v-if="inversores.length"
          class="flex shrink-0 flex-wrap gap-1.5 border-b border-border bg-card px-3 py-2"
        >
          <button
            v-for="inv in inversores"
            :key="inv.dev_name"
            :class="[
              CHIP,
              ocultos.has(inv.dev_name)
                ? 'border-border bg-muted text-muted-foreground'
                : 'border-(--c) bg-(--c)/8 text-unergy-deep',
            ]"
            :style="{ '--c': inv.color }"
            @click="toggle(inv.dev_name)"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="ocultos.has(inv.dev_name) ? 'bg-border' : 'bg-(--c)'"
              :style="{ '--c': inv.color }"
            />
            <TruncatedText :text="inv.dev_name" class="max-w-40" />
            <span
              class="text-xs font-bold tabular-nums"
              :class="
                ocultos.has(inv.dev_name) ? 'text-muted-foreground/60' : 'text-muted-foreground'
              "
              >{{ fmtKw(inv.peak_kw) }}</span
            >
          </button>
          <button :class="[CHIP, 'border-border bg-muted text-unergy-purple']" @click="todos">
            <EyeIcon v-if="ocultos.size" class="size-3" />
            <EyeOffIcon v-else class="size-3" />
            {{ ocultos.size ? 'Todos' : 'Ninguno' }}
          </button>
        </div>

        <!-- Gráfica -->
        <main class="relative min-h-0 flex-1 bg-card px-2.5 pt-3 pb-1.5">
          <div v-if="loading" :class="STATE">
            <LoaderCircleIcon class="size-6 animate-spin text-unergy-purple" />
            <span>Cargando inversores…</span>
          </div>
          <div v-else-if="error" :class="STATE">
            <TriangleAlertIcon class="size-8 text-warning" />
            <span>{{ error }}</span>
            <button
              class="mt-0.5 rounded-xl bg-unergy-purple px-5 py-2.5 text-sm font-semibold text-white"
              @click="cargar(true)"
            >
              Reintentar
            </button>
          </div>
          <div v-else-if="!inversores.length" :class="STATE">
            <ChartLineIcon class="size-8 text-muted-foreground" />
            <span>Sin datos de inversores hoy</span>
          </div>
          <div v-else-if="!datasetsVisibles.length" :class="STATE">
            <EyeOffIcon class="size-8 text-muted-foreground" />
            <span>Todas las líneas están ocultas</span>
          </div>
          <Line v-else :data="chartData" :options="chartOptions" />
        </main>

        <!-- Pie -->
        <footer
          class="is-foot flex shrink-0 items-center gap-3 border-t border-border bg-card px-3 pt-2 text-xs text-muted-foreground"
        >
          <span class="flex items-center gap-1"><CalendarIcon class="size-3" /> {{ fecha }}</span>
          <span v-if="granularidad">{{ granularidad === 'hour' ? 'por hora' : 'cada 5 min' }}</span>
          <span v-if="actualizado" class="ml-auto flex items-center gap-1"
            ><ClockIcon class="size-3" /> {{ actualizado }}</span
          >
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { Line } from 'vue-chartjs'
import {
  CalendarIcon,
  ChartLineIcon,
  ChevronLeftIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from '@lucide/vue'
import type { PotenciaInversor } from '~/features/solar/types'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { isFetchError, normalizeError } from '~/core/errors'
import type { TokenColor } from '~/composables/useThemeColors'

const CHIP = 'flex items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-xs font-semibold'
const STATE =
  'absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip)

const generacionSolarService = new GeneracionSolarService()

const { color } = useThemeColors()

// Misma paleta que la "Comparativa de inversores" del escritorio, con tokens del tema.
// Es una función: Chart.js necesita el color resuelto, que depende del modo claro/oscuro.
const PALETA: TokenColor[] = [
  'unergy-purple',
  'success',
  'warning',
  'chart-2',
  'destructive',
  'chart-1',
  'primary',
  'chart-4',
  'chart-5',
  'chart-3',
]

const props = withDefaults(
  defineProps<{
    open?: boolean
    proyectoId?: number | null
    nombre?: string
  }>(),
  { open: false, proyectoId: null, nombre: '' },
)
const emit = defineEmits<{ close: [] }>()

const crudos = ref<PotenciaInversor[]>([])
const granularidad = ref('')
const fecha = ref('')
const loading = ref(false)
const error = ref('')
const actualizado = ref('')
const ocultos = ref(new Set<string>())

// Al abrir: cargar si cambió de proyecto o si no hay nada cacheado.
let cargadoPara: number | null = null
// `immediate` para que también cargue si la hoja se monta ya abierta.
watch(
  () => props.open,
  (abierta) => {
    if (!abierta) return
    if (cargadoPara !== props.proyectoId) {
      ocultos.value = new Set()
      cargar()
    }
  },
  { immediate: true },
)

const inversores = computed(() =>
  crudos.value.map((inv, i) => ({ ...inv, color: color(PALETA[i % PALETA.length]!) })),
)

// Eje X: unión de los tiempos de todos los inversores, ordenada.
const tiempos = computed(() => {
  const set = new Set<string>()
  for (const inv of crudos.value) {
    for (const p of inv.points || []) if (p.time) set.add(p.time)
  }
  return Array.from(set).sort()
})

/** "2026-08-18 08:45" → "08:45" (día suelto) · "18/08 08h" (varios días) */
function fmtTiempo(t: string): string {
  if (!t) return ''
  const [d, hm] = String(t).split(' ')
  if (!hm) return String(t)
  if (granularidad.value === 'hour' && d) {
    const [, mm, dd] = d.split('-')
    return `${dd}/${mm} ${hm.slice(0, 2)}h`
  }
  return hm.slice(0, 5)
}

function fmtKw(kw: number | null | undefined): string {
  if (kw == null) return '—'
  return `${Number(kw).toLocaleString('es-CO', { maximumFractionDigits: kw >= 100 ? 0 : 1 })} kW`
}

const datasetsVisibles = computed(() =>
  inversores.value
    .filter((inv) => !ocultos.value.has(inv.dev_name))
    .map((inv) => {
      const porTiempo: Record<string, number | null | undefined> = {}
      for (const p of inv.points || []) if (p.time) porTiempo[p.time] = p.kw
      return {
        label: inv.dev_name,
        data: tiempos.value.map((t) => (t in porTiempo ? (porTiempo[t] ?? null) : null)),
        borderColor: inv.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.8,
        spanGaps: true,
      }
    }),
)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: tiempos.value.map(fmtTiempo),
  datasets: datasetsVisibles.value,
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // En el celular el toque debe mostrar todas las potencias de esa hora.
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false }, // las líneas se prenden y apagan con los chips
    tooltip: {
      backgroundColor: color('unergy-deep', 0.95),
      padding: 10,
      titleFont: { size: 12 },
      bodyFont: { size: 11.5 },
      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'} kW` },
    },
  },
  scales: {
    x: {
      ticks: {
        font: { size: 9.5 },
        color: color('muted-foreground'),
        maxTicksLimit: 7,
        autoSkip: true,
        maxRotation: 0,
      },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Potencia (kW)',
        font: { size: 10 },
        color: color('muted-foreground'),
      },
      ticks: {
        font: { size: 9.5 },
        color: color('muted-foreground'),
        maxTicksLimit: 6,
        padding: 4,
      },
      grid: { color: color('foreground', 0.05) },
      border: { display: false },
    },
  },
}))

function toggle(devName: string): void {
  const next = new Set(ocultos.value)
  if (next.has(devName)) next.delete(devName)
  else next.add(devName)
  ocultos.value = next
}
function todos(): void {
  ocultos.value = ocultos.value.size ? new Set() : new Set(inversores.value.map((i) => i.dev_name))
}

async function cargar(forzar = false): Promise<void> {
  if (!props.proyectoId) return
  if (loading.value && !forzar) return
  loading.value = true
  error.value = ''
  try {
    const data = await generacionSolarService.obtenerPotenciaInversores(props.proyectoId)
    crudos.value = data.inverters ?? []
    granularidad.value = data.granularidad || ''
    fecha.value =
      data.date_from === data.date_to ? data.date_from || '' : `${data.date_from} → ${data.date_to}`
    actualizado.value = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    })
    cargadoPara = props.proyectoId
  } catch (e) {
    crudos.value = []
    // 422 = el proyecto no está en Solenium; el resto es fallo de red o del servidor.
    error.value =
      isFetchError(e) && e.status === 422
        ? 'Este proyecto no tiene ID de Solenium configurado.'
        : normalizeError(e).message
  } finally {
    loading.value = false
  }
}

function close(): void {
  emit('close')
}
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.is-head {
  padding-top: calc(0.5rem + env(safe-area-inset-top));
}
.is-foot {
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
}

.isheet-enter-active,
.isheet-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}
.isheet-enter-from,
.isheet-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
</style>
