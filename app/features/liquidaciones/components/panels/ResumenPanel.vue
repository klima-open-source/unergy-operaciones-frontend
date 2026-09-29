<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  Legend,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClockIcon,
  EyeIcon,
  InboxIcon,
  PercentIcon,
  TriangleAlertIcon,
  WalletIcon,
} from '@lucide/vue'
import type { ProyectoResumenPanel } from '~/features/liquidaciones/types'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import {
  ESTADO_FLUJO,
  estadoFlujoPanel,
  fmtCompact,
  formatPeriodo,
} from '~/features/liquidaciones/utils/liquidaciones'

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

const props = withDefaults(defineProps<{ periodo: string; tipo?: string }>(), {
  tipo: 'preliquidacion',
})
const router = useRouter()
const liquidacionesService = new LiquidacionesService()

interface PeriodoEntry {
  periodo: string
  proyectos: ProyectoResumenPanel[]
  resumen: { ingresos_total_cop?: number; costos_total_cop?: number; valor_a_pagar_total?: number }
}

const loading = ref(false)
const periodosData = ref<PeriodoEntry[]>([]) // [{periodo, resumen, proyectos}] del Panel (ventana 12m)
const sinPanel = ref<string[]>([]) // proyectos en operación sin panel este período
const expandidos = reactive(new Set<number>())

const periodoYYYYMM = computed(() => props.periodo.slice(0, 7))

// Ventana de 12 meses terminando en `periodo`
const ventana = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const ini = new Date(y!, m! - 12, 1)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { desde: iso(ini), hasta: periodoYYYYMM.value }
})

const porPeriodo = computed(() => {
  const map: Record<string, PeriodoEntry> = {}
  for (const p of periodosData.value) map[p.periodo] = p
  return map
})

const entryActual = computed(() => porPeriodo.value[periodoYYYYMM.value] || null)
const proyectos = computed(() => entryActual.value?.proyectos || [])
const totalMes = computed(() => proyectos.value.length)

interface Alerta {
  key: string
  icon: typeof TriangleAlertIcon
  colorClass: string
  bgClass: string
  titulo: string
  detalle: string
}

// ── Alertas del período (#10) ──────────────────────────────────────────────────
const alertas = computed<Alerta[]>(() => {
  const out: Alerta[] = []
  const negativos = proyectos.value.filter((p) => (p.valor_a_pagar_total || 0) < 0)
  if (negativos.length)
    out.push({
      key: 'neg',
      icon: TriangleAlertIcon,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/5 border-destructive/20',
      titulo: `${negativos.length} proyecto(s) con valor a pagar negativo`,
      detalle:
        negativos
          .slice(0, 6)
          .map((p) => p.proyecto)
          .join(', ') + (negativos.length > 6 ? '…' : ''),
    })
  const pctRaros = proyectos.value.filter((p) => {
    const s = (p.inversionistas || []).reduce((a, i) => a + (i.porcentaje || 0), 0)
    return p.inversionistas?.length && Math.abs(s - 100) > 1
  })
  if (pctRaros.length)
    out.push({
      key: 'pct',
      icon: PercentIcon,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/5 border-warning/20',
      titulo: `${pctRaros.length} proyecto(s) con participación ≠ 100%`,
      detalle:
        pctRaros
          .slice(0, 6)
          .map((p) => p.proyecto)
          .join(', ') + (pctRaros.length > 6 ? '…' : ''),
    })
  if (sinPanel.value.length)
    out.push({
      key: 'sinpanel',
      icon: InboxIcon,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/5 border-primary/20',
      titulo: `${sinPanel.value.length} proyecto(s) en operación sin panel este período`,
      detalle: sinPanel.value.slice(0, 6).join(', ') + (sinPanel.value.length > 6 ? '…' : ''),
    })
  return out
})

// Meses de la ventana (12) en orden
const mesesVentana = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const out: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y!, m! - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
})

const mesPrevYYYYMM = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const d = new Date(y!, m! - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

interface Kpi {
  label: string
  value: string
  sub?: string | null
  subColorClass?: string
  icon: typeof ArrowUpRightIcon
  colorClass: string
  bgClass: string
}

const kpis = computed<Kpi[]>(() => {
  const r = entryActual.value?.resumen || {
    ingresos_total_cop: 0,
    costos_total_cop: 0,
    valor_a_pagar_total: 0,
  }
  const prev = porPeriodo.value[mesPrevYYYYMM.value]?.resumen
  const ing = r.ingresos_total_cop || 0
  const cos = r.costos_total_cop || 0
  const vap = r.valor_a_pagar_total || 0
  const margen = ing ? (vap / ing) * 100 : 0
  const firmados = proyectos.value.filter((p) => p.estado === 'firmado').length
  const pendientes = proyectos.value.length - firmados
  const delta = (cur: number, p: number | null | undefined) => {
    if (p == null || !p) return null
    const d = ((cur - p) / Math.abs(p)) * 100
    return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% vs mes ant.`
  }
  return [
    {
      label: 'Ingresos',
      value: fmtCompact(ing),
      sub: delta(ing, prev?.ingresos_total_cop),
      subColorClass: 'text-success',
      icon: ArrowUpRightIcon,
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      label: 'Costos',
      value: fmtCompact(cos),
      sub: delta(cos, prev?.costos_total_cop),
      subColorClass: 'text-destructive',
      icon: ArrowDownLeftIcon,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
    },
    {
      label: 'Valor a pagar',
      value: fmtCompact(vap),
      icon: WalletIcon,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'Margen',
      value: `${margen.toFixed(0)}%`,
      icon: PercentIcon,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'Firmados',
      value: String(firmados),
      icon: CircleCheckIcon,
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      label: 'Pendientes',
      value: String(pendientes),
      icon: ClockIcon,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
  ]
})

const porTipo = computed(() => {
  const map: Record<string, { tipo: string; ingresos: number; count: number }> = {}
  for (const p of proyectos.value) {
    const t = p.tipo_proyecto || 'sin tipo'
    if (!map[t]) map[t] = { tipo: t, ingresos: 0, count: 0 }
    map[t].ingresos += p.ingresos_cop || 0
    map[t].count += 1
  }
  return Object.values(map).sort((a, b) => b.ingresos - a.ingresos)
})
const maxTipoIngreso = computed(() => Math.max(1, ...porTipo.value.map((t) => t.ingresos)))
const barPct = (v: number) => Math.round((v / maxTipoIngreso.value) * 100)

const pipeline = computed(() => {
  const counts: Record<string, number> = { cargado: 0, numerado: 0, firmado: 0 }
  for (const p of proyectos.value) counts[estadoFlujoPanel(p, props.tipo).key]!++
  return ESTADO_FLUJO.map((s) => ({
    estado: s.key,
    label: s.label,
    count: counts[s.key] || 0,
    color: s.color,
  })).filter((s) => s.count > 0)
})

// ── Tendencia ────────────────────────────────────────────────────────────────
const tieneTendencia = computed(() => periodosData.value.length > 0)
const { color } = useThemeColors()

const trendData = computed<ChartData<'line'>>(() => {
  const byMes: Record<string, { ing: number; cos: number; vap: number }> = {}
  for (const p of mesesVentana.value) byMes[p] = { ing: 0, cos: 0, vap: 0 }
  for (const entry of periodosData.value) {
    if (byMes[entry.periodo]) {
      byMes[entry.periodo]!.ing = entry.resumen.ingresos_total_cop || 0
      byMes[entry.periodo]!.cos = entry.resumen.costos_total_cop || 0
      byMes[entry.periodo]!.vap = entry.resumen.valor_a_pagar_total || 0
    }
  }
  const lbl = (ym: string) => formatPeriodo(ym + '-01')
  return {
    labels: mesesVentana.value.map(lbl),
    datasets: [
      {
        label: 'Ingresos',
        data: mesesVentana.value.map((p) => byMes[p]!.ing),
        borderColor: color('success'),
        backgroundColor: color('success', 0.08),
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Costos',
        data: mesesVentana.value.map((p) => byMes[p]!.cos),
        borderColor: color('destructive'),
        backgroundColor: color('destructive', 0.06),
        tension: 0.3,
        fill: false,
      },
      {
        label: 'Valor a pagar',
        data: mesesVentana.value.map((p) => byMes[p]!.vap),
        borderColor: color('unergy-purple'),
        backgroundColor: color('unergy-purple', 0.1),
        tension: 0.3,
        fill: true,
      },
    ],
  }
})
const trendOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      labels: { font: { size: 11 }, color: color('muted-foreground'), boxWidth: 12 },
    },
    tooltip: {
      callbacks: { label: (c) => `${c.dataset.label}: ${fmtCompact(Number(c.parsed.y))}` },
    },
  },
  scales: {
    x: {
      ticks: { font: { size: 10 }, color: color('muted-foreground'), maxTicksLimit: 12 },
      grid: { display: false },
    },
    y: {
      ticks: {
        font: { size: 10 },
        color: color('muted-foreground'),
        callback: (v) => fmtCompact(Number(v)),
      },
      grid: { color: color('foreground', 0.05) },
    },
  },
}))

// ── Carga ─────────────────────────────────────────────────────────────────────
function goDetalle(id: number) {
  router.push(`/liquidaciones/${id}`)
}

function toggleExpand(panelId: number | undefined) {
  if (panelId == null) return
  if (expandidos.has(panelId)) expandidos.delete(panelId)
  else expandidos.add(panelId)
}

async function load() {
  loading.value = true
  try {
    // Rango (tendencia/tabla) + período único (para 'sin_panel' de las alertas).
    const [rango, unico] = await Promise.allSettled([
      liquidacionesService.obtenerResumenPanelRango({
        periodo_desde: ventana.value.desde,
        periodo_hasta: ventana.value.hasta,
        tipo: props.tipo,
      }),
      liquidacionesService.obtenerResumenPanel({ periodo: periodoYYYYMM.value, tipo: props.tipo }),
    ])
    periodosData.value = rango.status === 'fulfilled' ? rango.value.periodos || [] : []
    sinPanel.value = unico.status === 'fulfilled' ? unico.value.sin_panel || [] : []
  } catch {
    periodosData.value = []
    sinPanel.value = []
  } finally {
    loading.value = false
  }
}

watch([() => props.periodo, () => props.tipo], load)
onMounted(load)
</script>

<template>
  <div class="space-y-4 p-4 sm:p-5">
    <Spinner v-if="loading" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <template v-else>
      <!-- ── Alertas del período (#10) ──────────────────────────────────── -->
      <div v-if="alertas.length" class="flex flex-col gap-2">
        <div
          v-for="a in alertas"
          :key="a.key"
          class="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          :class="a.bgClass"
        >
          <component :is="a.icon" class="mt-0.5 size-4 shrink-0" :class="a.colorClass" />
          <div>
            <span class="font-semibold" :class="a.colorClass">{{ a.titulo }}</span>
            <span class="text-muted-foreground"> — {{ a.detalle }}</span>
          </div>
        </div>
      </div>

      <!-- ── KPIs del período ─────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="flex items-center justify-between rounded-xl border bg-card p-4"
        >
          <div class="min-w-0">
            <p class="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {{ kpi.label }}
            </p>
            <p class="mt-1 truncate text-xl font-bold text-foreground">{{ kpi.value }}</p>
            <p v-if="kpi.sub" class="mt-0.5 text-xs" :class="kpi.subColorClass || 'text-primary'">
              {{ kpi.sub }}
            </p>
          </div>
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-xl"
            :class="kpi.bgClass"
          >
            <component :is="kpi.icon" class="size-5" :class="kpi.colorClass" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- ── Por tipo de proyecto ───────────────────────────────── -->
        <div class="rounded-xl border bg-card p-4">
          <h3 class="mb-3 text-sm font-bold text-foreground">Ingresos por tipo de proyecto</h3>
          <div v-if="porTipo.length" class="space-y-2.5">
            <div v-for="t in porTipo" :key="t.tipo">
              <div class="mb-1 flex justify-between text-xs text-foreground">
                <span class="font-medium capitalize">{{ t.tipo }}</span>
                <span class="font-mono text-muted-foreground"
                  >{{ fmtCompact(t.ingresos) }} · {{ t.count }} proy.</span
                >
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full w-(--w) rounded-full bg-primary"
                  :style="{ '--w': barPct(t.ingresos) + '%' }"
                />
              </div>
            </div>
          </div>
          <p v-else class="py-4 text-center text-xs text-muted-foreground">
            Sin paneles en el período.
          </p>
        </div>

        <!-- ── Pipeline (firmado / pendiente) ─────────────────────── -->
        <div class="rounded-xl border bg-card p-4">
          <h3 class="mb-3 text-sm font-bold text-foreground">Estado del período</h3>
          <div v-if="totalMes" class="space-y-1.5">
            <div class="flex h-3 overflow-hidden rounded-full bg-muted">
              <GTooltip v-for="s in pipeline" :key="s.estado">
                <GTooltipTrigger as-child>
                  <div
                    class="h-full w-(--w) bg-(--c)"
                    :style="{ '--w': (s.count / totalMes) * 100 + '%', '--c': s.color }"
                  />
                </GTooltipTrigger>
                <GTooltipContent side="top">{{ s.label }}: {{ s.count }}</GTooltipContent>
              </GTooltip>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 pt-2">
              <span v-for="s in pipeline" :key="s.estado" class="flex items-center gap-1.5 text-xs">
                <span class="size-2.5 shrink-0 rounded-full bg-(--c)" :style="{ '--c': s.color }" />
                <span class="text-foreground">{{ s.label }}</span>
                <span class="font-mono font-semibold text-muted-foreground">{{ s.count }}</span>
              </span>
            </div>
          </div>
          <p v-else class="py-4 text-center text-xs text-muted-foreground">
            Sin paneles en el período.
          </p>
        </div>
      </div>

      <!-- ── Tendencia ───────────────────────────────────────────── -->
      <div class="rounded-xl border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-bold text-foreground">Tendencia (últimos 12 meses)</h3>
          <span class="text-xs text-muted-foreground">Ingresos · Costos · Valor a pagar</span>
        </div>
        <div class="h-60">
          <Line v-if="tieneTendencia" :data="trendData" :options="trendOptions" />
          <p v-else class="py-8 text-center text-xs text-muted-foreground">
            Sin datos históricos del Panel suficientes.
          </p>
        </div>
      </div>

      <!-- ── Proyectos del período (Panel) ───────────────────────────── -->
      <div class="overflow-hidden rounded-xl border bg-card">
        <div class="flex items-center gap-2 border-b px-4 py-2.5">
          <h3 class="text-sm font-bold text-foreground">
            Panel Contable de {{ formatPeriodo(periodo) }}
          </h3>
          <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{{
            proyectos.length
          }}</span>
        </div>

        <div v-if="!proyectos.length" class="py-6 text-center text-xs text-muted-foreground">
          Sin paneles para este período. Cárgalos en Panel Contable.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th class="px-3 py-2" />
                <th class="px-3 py-2 font-medium">Proyecto</th>
                <th class="px-3 py-2 font-medium">Tipo</th>
                <th class="px-3 py-2 font-medium">Estado</th>
                <th class="px-3 py-2 text-right font-medium">Ingresos</th>
                <th class="px-3 py-2 text-right font-medium">Costos</th>
                <th class="px-3 py-2 text-right font-medium">Valor a pagar</th>
                <th class="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              <template v-for="p in proyectos" :key="p.panel_id">
                <tr class="border-b hover:bg-muted/20">
                  <td class="px-3 py-2">
                    <button
                      class="text-muted-foreground hover:text-foreground"
                      @click="toggleExpand(p.panel_id)"
                    >
                      <ChevronDownIcon v-if="expandidos.has(p.panel_id ?? -1)" class="size-3.5" />
                      <ChevronRightIcon v-else class="size-3.5" />
                    </button>
                  </td>
                  <td class="px-3 py-2 font-medium text-foreground">{{ p.proyecto }}</td>
                  <td class="px-3 py-2 text-xs text-muted-foreground capitalize">
                    {{ p.tipo_proyecto || '—' }}
                  </td>
                  <td class="px-3 py-2">
                    <GBadge :color="estadoFlujoPanel(p, tipo).sev" class="text-xs">{{
                      estadoFlujoPanel(p, tipo).label
                    }}</GBadge>
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-xs">
                    {{ fmtCompact(p.ingresos_cop) }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-xs text-destructive">
                    {{ fmtCompact(p.costos_cop) }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-xs font-semibold text-primary">
                    {{ fmtCompact(p.valor_a_pagar_total) }}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <Button
                      v-if="p.liquidacion_id"
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      @click.stop="goDetalle(p.liquidacion_id)"
                    >
                      <EyeIcon class="size-3.5" />
                    </Button>
                  </td>
                </tr>
                <tr v-if="expandidos.has(p.panel_id ?? -1)" class="border-b bg-muted/10">
                  <td colspan="8" class="px-4 py-3">
                    <p class="mb-2 text-xs font-semibold text-muted-foreground">
                      Por inversionista
                    </p>
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="text-left text-muted-foreground">
                          <th class="pb-1 font-medium">Inversionista</th>
                          <th class="pb-1 font-medium">%</th>
                          <th class="pb-1 text-right font-medium">Valor a pagar</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="inv in p.inversionistas"
                          :key="inv.proyecto_inversionista_id ?? inv.nombre ?? undefined"
                          class="border-t"
                        >
                          <td class="py-1.5 text-foreground">
                            {{ inv.cliente_nombre || inv.nombre || '—' }}
                          </td>
                          <td class="py-1.5 font-mono text-muted-foreground">
                            {{ inv.porcentaje != null ? inv.porcentaje.toFixed(2) + '%' : '—' }}
                          </td>
                          <td class="py-1.5 text-right font-mono font-semibold text-primary">
                            {{ fmtCompact(inv.valor_a_pagar) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
