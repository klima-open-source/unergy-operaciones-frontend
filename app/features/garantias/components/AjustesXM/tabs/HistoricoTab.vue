<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  InboxIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import type { Id } from '~/types/api'
import { logger } from '~/core/logger'
import { normalizeError } from '~/core/errors'
import type { AjusteGarantiaFE } from '../composables/useGarantiasHistorial'
import { useGarantiasHistorial } from '../composables/useGarantiasHistorial'
import { exportHistorialExcel } from '../utils/excelExport'
import HojaMadreView from '../HojaMadreView.vue'
import EditAjusteDialog from '../EditAjusteDialog.vue'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

// Destructuramos las refs/funciones: al ser bindings de nivel superior, Vue las
// auto-desempaqueta en el template (sin .value).
const { historial, loading, errorMsg, cargar, eliminar } = useGarantiasHistorial()

onMounted(() => cargar())

const confirm = useConfirm()

function confirmarEliminar(r: AjusteGarantiaFE) {
  confirm({
    title: 'Eliminar registro',
    description: `Se eliminará el registro ${r.tipo} del ${r.fecha}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await eliminar(r.id)
      } catch (e) {
        toast.error('No se pudo eliminar', {
          description: normalizeError(e).message,
          duration: 5000,
        })
      }
    },
  })
}

/* ------------------ Edición ------------------ */
const editVisible = ref(false)
const editAjuste = ref<AjusteGarantiaFE | null>(null)

function abrirEditar(ajuste: AjusteGarantiaFE) {
  editAjuste.value = ajuste
  editVisible.value = true
}

/* ------------------ Helpers ------------------ */
// Envuelve cálculos de render para que un dato inesperado nunca cuelgue la vista.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (e) {
    logger.error('garantias', e)
    return fallback
  }
}

const TIPO_SEVERITY: Record<AjusteGarantiaFE['tipo'], GandalfBadgeColor> = {
  semanal: 'action',
  txr: 'information',
  mensual: 'success',
}

function cifraClave(r: AjusteGarantiaFE | undefined): string {
  if (!r) return '—'
  if (r.tipo === 'semanal') return r.totalConsignar != null ? formatCOP(r.totalConsignar) : '—'
  return r.totalAjusteTXR != null ? formatCOP(r.totalAjusteTXR) : '—'
}

function mesLabel(mes: string): string {
  // mes = 'YYYY-MM'
  const [y, m] = String(mes || '').split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  if (isNaN(d.getTime())) return String(mes || '')
  const txt = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/* ------------------ Gráfica ------------------ */
const rangoActivo = ref<'3m' | '12m' | 'all'>('12m')
const agruparPorMes = ref(false)

const rangos: { key: '3m' | '12m' | 'all'; label: string }[] = [
  { key: '3m', label: 'Últimos 3 meses' },
  { key: '12m', label: 'Últimos 12 meses' },
  { key: 'all', label: 'Todo' },
]

// Solo semanales con datos de tendencia, ordenados ascendente por fecha
const semanales = computed(() =>
  safe(
    () =>
      (historial.value || [])
        .filter(
          (r) => r && r.tipo === 'semanal' && r.totalConsignar != null && r.pb != null && r.fecha,
        )
        .slice()
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    [] as AjusteGarantiaFE[],
  ),
)

const semanalesEnRango = computed(() =>
  safe(() => {
    const all = semanales.value
    if (rangoActivo.value === 'all') return all
    const cutoff = new Date()
    if (rangoActivo.value === '3m') cutoff.setMonth(cutoff.getMonth() - 3)
    else cutoff.setMonth(cutoff.getMonth() - 12)
    const cutStr = cutoff.toISOString().slice(0, 10)
    return all.filter((r) => String(r.fecha) >= cutStr)
  }, [] as AjusteGarantiaFE[]),
)

interface PuntoGrafica {
  label: string
  totalConsignar: number | null
  pb: number | null
}

// Puntos efectivos de la gráfica (con o sin agrupación por mes)
const puntosGrafica = computed(() =>
  safe(() => {
    const base = semanalesEnRango.value
    if (!agruparPorMes.value) {
      return base.map((r) => ({ label: r.fecha, totalConsignar: r.totalConsignar, pb: r.pb }))
    }
    // Agrupar: último reporte semanal de cada mes
    const ultimoPorMes = new Map<string, AjusteGarantiaFE>()
    for (const r of base) {
      const mes = String(r.fecha).slice(0, 7) // 'YYYY-MM' — base ya viene ascendente, así que el último gana
      ultimoPorMes.set(mes, r)
    }
    return [...ultimoPorMes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, r]) => ({ label: mes, totalConsignar: r.totalConsignar, pb: r.pb }))
  }, [] as PuntoGrafica[]),
)

const { color } = useThemeColors()

const chartData = computed<ChartData<'line'>>(() => ({
  labels: puntosGrafica.value.map((p) => p.label),
  datasets: [
    {
      label: 'Total a consignar (semanal)',
      data: puntosGrafica.value.map((p) => p.totalConsignar),
      borderColor: color('success'),
      backgroundColor: color('success', 0.12),
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: 'y',
    },
    {
      label: 'Precio de bolsa (PB)',
      data: puntosGrafica.value.map((p) => p.pb),
      borderColor: color('primary'),
      backgroundColor: color('primary', 0.08),
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: 'y2',
    },
  ],
}))

const pbFmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const milesFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'line'>) => {
          const v = ctx.parsed.y
          if (v == null) return ''
          if (ctx.dataset.yAxisID === 'y2') {
            return ` ${ctx.dataset.label}: $${pbFmt.format(v)}`
          }
          return ` ${ctx.dataset.label}: $${milesFmt.format(v)}`
        },
      },
    },
  },
  scales: {
    y: {
      position: 'left',
      ticks: {
        callback: (v) =>
          Math.abs(Number(v)) >= 1e9
            ? '$' + (Number(v) / 1e9).toFixed(1) + 'B'
            : Math.abs(Number(v)) >= 1e6
              ? '$' + (Number(v) / 1e6).toFixed(1) + 'M'
              : '$' + (Number(v) / 1e3).toFixed(0) + 'k',
      },
    },
    y2: {
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: {
        callback: (v) => '$' + pbFmt.format(Number(v)),
      },
    },
  },
}))

/* ------------------ Navegación por mes ------------------ */
interface GrupoMes {
  mes: string
  label: string
  registros: AjusteGarantiaFE[]
}

const mesesAgrupados = computed(() =>
  safe(() => {
    const groups = new Map<string, AjusteGarantiaFE[]>()
    for (const r of historial.value || []) {
      if (!r) continue
      const mes = String(r.fecha || '').slice(0, 7)
      if (!mes) continue
      if (!groups.has(mes)) groups.set(mes, [])
      groups.get(mes)!.push(r)
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0])) // meses desc
      .map(([mes, registros]): GrupoMes => ({
        mes,
        label: mesLabel(mes),
        registros: registros.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))), // fecha desc
      }))
  }, [] as GrupoMes[]),
)

const mesesAbiertos = ref<Record<string, boolean>>({})
const snapshotAbierto = ref<Id | null>(null)
const mesInicialAbierto = ref(false)

function toggleMes(mes: string) {
  mesesAbiertos.value = { ...mesesAbiertos.value, [mes]: !mesesAbiertos.value[mes] }
}

function toggleSnapshot(id: Id) {
  snapshotAbierto.value = snapshotAbierto.value === id ? null : id
}

// Abrir por defecto el mes más reciente la primera vez que llega el historial
watch(
  mesesAgrupados,
  (grupos) => {
    if (!mesInicialAbierto.value && grupos.length) {
      mesesAbiertos.value = { [grupos[0]!.mes]: true }
      mesInicialAbierto.value = true
    }
  },
  { immediate: true },
)

/* ------------------ Export ------------------ */
function exportarExcel() {
  exportHistorialExcel(historial.value)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Barra superior -->
    <div class="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" @click="exportarExcel">
        <FileSpreadsheetIcon class="size-4" />
        Exportar a Excel
      </Button>
    </div>

    <!-- Loading (solo en la primera carga, cuando aún no hay datos) -->
    <div
      v-if="loading && !historial.length"
      class="space-y-3 py-6 text-center text-muted-foreground"
    >
      <p>Cargando…</p>
      <p class="text-xs text-muted-foreground/70">
        Si tarda, el servidor puede estar despertando (arranque en frío).
      </p>
      <Button variant="outline" size="sm" @click="cargar()">
        <RefreshCwIcon class="size-4" />
        Reintentar
      </Button>
    </div>

    <!-- Error de carga (solo si no hay datos que mostrar) -->
    <Alert v-else-if="errorMsg && !historial.length" variant="destructive">
      <AlertDescription class="flex flex-col items-center gap-2 text-center">
        <span>No se pudo cargar el historial: {{ errorMsg }}</span>
        <Button variant="outline" size="sm" @click="cargar()">
          <RefreshCwIcon class="size-4" />
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>

    <!-- Si ya hay datos, se renderizan siempre (una recarga en curso no oculta el contenido) -->
    <template v-else>
      <p v-if="loading" class="text-center text-xs text-muted-foreground">Actualizando…</p>
      <!-- 1. Gráfica de tendencia -->
      <div class="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-foreground">Tendencia histórica</h3>
          <div class="flex flex-wrap items-center gap-3">
            <ToggleGroup v-model="rangoActivo" type="single" variant="outline">
              <ToggleGroupItem v-for="r in rangos" :key="r.key" :value="r.key">{{
                r.label
              }}</ToggleGroupItem>
            </ToggleGroup>
            <label class="flex items-center gap-1.5 text-xs text-foreground">
              <Checkbox v-model="agruparPorMes" />
              Agrupar por mes
            </label>
          </div>
        </div>

        <div v-if="puntosGrafica.length > 1" class="relative h-75">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <div v-else class="py-12 text-center text-sm text-muted-foreground">
          Aún no hay suficientes reportes semanales para la tendencia.
        </div>
      </div>

      <!-- 2. Navegación por mes (acordeón) -->
      <div v-if="mesesAgrupados.length" class="space-y-3">
        <div
          v-for="grupo in mesesAgrupados"
          :key="grupo.mes"
          class="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <!-- Cabecera mes -->
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/60"
            @click="toggleMes(grupo.mes)"
          >
            <span class="flex items-center gap-2">
              <ChevronDownIcon v-if="mesesAbiertos[grupo.mes]" class="size-3.5 text-primary" />
              <ChevronRightIcon v-else class="size-3.5 text-primary" />
              <span class="text-sm font-semibold text-foreground capitalize">{{
                grupo.label
              }}</span>
            </span>
            <GBadge color="action">
              {{ grupo.registros.length }}
              {{ grupo.registros.length === 1 ? 'reporte' : 'reportes' }}
            </GBadge>
          </button>

          <!-- Reportes del mes -->
          <div v-if="mesesAbiertos[grupo.mes]" class="border-t">
            <div v-for="r in grupo.registros" :key="r.id" class="border-b last:border-b-0">
              <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                <span class="shrink-0 text-sm text-foreground tabular-nums">{{ r.fecha }}</span>
                <GBadge :color="TIPO_SEVERITY[r.tipo]" class="shrink-0">{{ r.tipo }}</GBadge>
                <span class="flex-1 text-right text-sm font-semibold text-foreground tabular-nums">
                  {{ cifraClave(r) }}
                </span>
                <div class="flex shrink-0 items-center gap-0.5">
                  <GTooltip>
                    <GTooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        :disabled="!r.snapshot"
                        :class="snapshotAbierto === r.id ? 'text-primary' : ''"
                        @click="toggleSnapshot(r.id)"
                      >
                        <EyeIcon v-if="r.snapshot" class="size-4" />
                        <EyeOffIcon v-else class="size-4" />
                      </Button>
                    </GTooltipTrigger>
                    <GTooltipContent>{{
                      r.snapshot ? 'Ver hoja madre' : 'Sin detalle guardado'
                    }}</GTooltipContent>
                  </GTooltip>
                  <Button variant="ghost" size="icon-sm" @click="abrirEditar(r)">
                    <PencilIcon class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-destructive"
                    @click="confirmarEliminar(r)"
                  >
                    <Trash2Icon class="size-4" />
                  </Button>
                </div>
              </div>
              <!-- Hoja madre expandida -->
              <div v-if="snapshotAbierto === r.id && r.snapshot" class="bg-muted/40 px-4 py-4">
                <HojaMadreView :data="r.snapshot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="py-12 text-center text-muted-foreground">
        <InboxIcon class="mx-auto mb-2 block size-8 text-muted-foreground/60" />
        No hay registros en el historial. Confirma un reporte desde Semanales, TXR o Mensuales.
      </div>
    </template>

    <EditAjusteDialog v-model:visible="editVisible" :ajuste="editAjuste" @saved="cargar()" />
  </div>
</template>
