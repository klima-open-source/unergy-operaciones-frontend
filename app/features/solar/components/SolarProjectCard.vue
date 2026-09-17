<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import type { ProyectoMonitoreoSolar, DetalleMonitoreoSolar } from '~/features/solar/types'
import { GripVerticalIcon, LoaderCircleIcon, SunIcon } from '@lucide/vue'
import {
  TIME_LABELS,
  acumuladoInversores,
  acumuladoMedidor,
  fmtKwh,
  haceCuanto,
  hastaInversores,
  hastaMedidor,
  inverterSeries,
  meterSeries,
} from '~/features/solar/serieSolar'

const props = defineProps<{
  proyecto: ProyectoMonitoreoSolar
  detalle: DetalleMonitoreoSolar | undefined
}>()

const STATUS_DOT_CLASSES: Record<string, string> = {
  online: 'bg-success',
  degradado: 'bg-warning',
  caido: 'bg-destructive',
  sin_comunicacion: 'bg-muted-foreground/50',
  offline: 'bg-muted-foreground/30',
}

const statusDotClass = computed(
  () => STATUS_DOT_CLASSES[props.proyecto.status ?? ''] ?? 'bg-muted-foreground/50',
)

// ── Inversores ─────────────────────────────────────────────────────────────

const inversorSerie = computed(() => inverterSeries(props.detalle))

const inversorChartData = computed<ChartData<'line'> | null>(() => {
  if (!inversorSerie.value) return null
  return {
    labels: TIME_LABELS,
    datasets: [
      {
        label: 'Inversores (kW)',
        data: inversorSerie.value,
        borderColor: '#915BD8',
        backgroundColor: 'rgba(145,91,216,0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true,
      },
    ],
  }
})

const acumuladoInv = computed(() => acumuladoInversores(props.detalle))
const hastaInv = computed(() => hastaInversores(props.detalle))

// ── Medidor: el backend ya eligió cuál mostrar (`props.detalle.medidor`) ────

const medidorTipo = computed(() => {
  if (!props.detalle?.medidor_respaldo) return null
  return props.detalle.medidor?.node_id === props.detalle.medidor_principal?.node_id ? 'P' : 'R'
})

const medidorSerie = computed(() => meterSeries(props.detalle))

const medidorChartData = computed<ChartData<'line'> | null>(() => {
  if (!medidorSerie.value) return null
  return {
    labels: TIME_LABELS,
    datasets: [
      {
        label: 'Medidores (kW)',
        data: medidorSerie.value,
        borderColor: '#D4A017',
        backgroundColor: 'rgba(212,160,23,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true,
      },
    ],
  }
})

const acumuladoMed = computed(() => acumuladoMedidor(props.detalle))
const hastaMed = computed(() => hastaMedidor(props.detalle))

// ── % diferencia inversores vs medidor (mejor nodo) ─────────────────────────

const diffPct = computed(() => {
  const inv = acumuladoInv.value
  const med = acumuladoMed.value
  if (inv == null || med == null || med === 0) return null
  return +(((inv - med) / med) * 100).toFixed(1)
})

// ── Escala Y compartida entre Inversores y Medidores del MISMO proyecto ─────
// Si cada gráfica autoescala su propio máximo, dos curvas con magnitudes muy
// distintas pueden verse "igual de altas" aunque haya una diferencia real
// grande. Con un máximo compartido, la diferencia se ve a simple vista.
const chartMax = computed(() => {
  const valores = [...(inversorSerie.value ?? []), ...(medidorSerie.value ?? [])].filter(
    (v): v is number => v != null,
  )
  if (!valores.length) return undefined
  const max = Math.max(...valores)
  // Redondeado al múltiplo de 50 más cercano, +10% de aire para que el pico
  // no toque el borde superior del gráfico.
  return Math.ceil((max * 1.1) / 50) * 50
})

function makeChartOptions(maxY: number | undefined): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#374151',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: (ctx) =>
            `${
              ctx.parsed.y != null
                ? ctx.parsed.y.toLocaleString('es-CO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : '—'
            } kW`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9 }, color: '#9ca3af', maxTicksLimit: 9 },
        grid: { color: 'rgba(28,18,50,0.06)' },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 9 }, color: '#9ca3af' },
        grid: { color: 'rgba(28,18,50,0.06)' },
        title: { display: true, text: 'kW', font: { size: 9 }, color: '#9ca3af' },
        ...(maxY ? { max: maxY } : {}),
      },
    },
  }
}

const inversorChartOptions = computed(() => makeChartOptions(chartMax.value))
const medidorChartOptions = computed(() => makeChartOptions(chartMax.value))

// ── Generación de hoy ────────────────────────────────────────────────────
// El P90 lo manda el propio proyecto (`p90_diario_kwh`); no hay que buscarlo
// en ninguna lista, `proyecto` ya es la fila correcta.
const genHoy = computed(() => {
  const inv = acumuladoInv.value
  const med = acumuladoMed.value

  let real = 0
  let fuente: 'inversor' | 'medidor' | 'sin_dato' = 'sin_dato'
  if (inv != null && inv > 0) {
    real = inv
    fuente = 'inversor'
  } else if (med != null && med > 0) {
    real = med
    fuente = 'medidor'
  }

  real = +real.toFixed(1)
  const p90 = props.proyecto.p90_diario_kwh ?? 0
  const pct = p90 > 0 ? Math.round((real / p90) * 100) : null
  return { real, p90, fuente, pct }
})

const genHoyColor = computed(() => {
  const pct = genHoy.value.pct
  if (pct === null) return 'text-muted-foreground'
  if (pct >= 100) return 'text-success'
  if (pct >= 75) return 'text-warning'
  return 'text-destructive'
})

const genHoyFillClass = computed(() => {
  if (genHoy.value.pct !== null && genHoy.value.pct >= 100) return 'bg-success'
  if (genHoy.value.real > 0) return 'bg-primary/40'
  return 'bg-muted'
})

const genHoyWidth = computed(() => {
  const { real, p90 } = genHoy.value
  return p90 > 0 ? `${Math.min(100, (real / p90) * 100)}%` : '0%'
})
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-sm font-extrabold text-foreground">
        <GripVerticalIcon
          class="drag-handle size-4 shrink-0 cursor-grab text-muted-foreground/50 hover:text-primary active:cursor-grabbing"
          aria-label="Arrastrar para reorganizar"
        />
        <span class="size-2 shrink-0 rounded-full" :class="statusDotClass" />
        <span class="min-w-0 flex-1 truncate">{{ proyecto.nombre }}</span>
      </div>

      <div v-if="!detalle" class="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <LoaderCircleIcon class="size-3.5 animate-spin" />
        Cargando datos...
      </div>

      <template v-else>
        <div v-if="diffPct !== null" class="flex items-center gap-2 text-[11px]">
          <span class="text-muted-foreground">Inversores vs medidor</span>
          <Badge :variant="Math.abs(diffPct) > 5 ? 'destructive' : 'secondary'">
            {{ diffPct > 0 ? '+' : '' }}{{ diffPct }}%
          </Badge>
        </div>

        <div class="grid grid-cols-1 gap-3 [@media(min-width:520px)]:grid-cols-2">
          <SolarChartCard
            title="Inversores"
            dot-class="bg-primary"
            :value="fmtKwh(acumuladoInv)"
            :value-muted="acumuladoInv === null"
            :hasta="hastaInv"
            :hace-cuanto="hastaInv ? haceCuanto(hastaInv) : ''"
            :chart-data="inversorChartData"
            :chart-options="inversorChartOptions"
            empty-label="Sin datos"
          />
          <SolarChartCard
            v-if="detalle.medidor"
            title="Medidores"
            dot-class="bg-warning"
            :badge="medidorTipo"
            :value="fmtKwh(acumuladoMed)"
            :value-muted="acumuladoMed === null"
            :hasta="hastaMed"
            :hace-cuanto="hastaMed ? haceCuanto(hastaMed) : ''"
            :chart-data="medidorChartData"
            :chart-options="medidorChartOptions"
            empty-label="Sin datos"
          />
          <div
            v-else
            class="flex h-full min-h-30 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
          >
            Sin medidor
          </div>
        </div>

        <div class="flex flex-col gap-1.5 border-t border-border pt-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span
              class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-primary uppercase"
            >
              <SunIcon class="size-3" />
              Generación de hoy
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-bold" :class="genHoyColor"
                >{{ genHoy.real.toLocaleString('es-CO') }} kWh</span
              >
              <span class="text-xs text-muted-foreground"
                >/ {{ genHoy.p90.toLocaleString('es-CO') }} kWh P90</span
              >
              <span v-if="genHoy.pct !== null" class="text-xs font-bold" :class="genHoyColor"
                >{{ genHoy.pct }}%</span
              >
              <Badge
                v-if="genHoy.fuente === 'inversor'"
                variant="secondary"
                title="Dato de inversores"
                >INV</Badge
              >
              <Badge
                v-else-if="genHoy.fuente === 'medidor'"
                variant="secondary"
                title="Dato de medidor de frontera"
              >
                MED
              </Badge>
              <Badge v-else variant="outline" title="Sin dato disponible">S/D</Badge>
            </div>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="genHoyFillClass"
              :style="{ width: genHoyWidth }"
            />
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
