<template>
  <div class="p-4 sm:p-5 space-y-4">

    <ProgressSpinner v-if="loading" class="block mx-auto my-10" />

    <template v-else>
      <!-- ── Aviso de espejo ──────────────────────────────────────── -->
      <div class="flex items-center justify-end">
        <span class="text-[11px]" style="color:#9b8fb0">
          Espejo de lectura del Panel Contable · los valores se editan en Panel Contable
        </span>
      </div>

      <!-- ── Alertas del período ──────────────────────────────────── -->
      <div v-if="alertas.length" class="flex flex-col gap-2">
        <div v-for="a in alertas" :key="a.key"
          class="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          :style="{ background: a.bg, border: `1px solid ${a.border}` }">
          <component :is="a.icon" class="mt-0.5 shrink-0 size-[1em]" :style="{ color: a.color }" />
          <div>
            <span class="font-semibold" :style="{ color: a.color }">{{ a.titulo }}</span>
            <span style="color:#6b5a8a"> — {{ a.detalle }}</span>
          </div>
        </div>
      </div>

      <!-- ── KPIs del período ─────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div v-for="kpi in kpis" :key="kpi.label"
          class="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border"
          style="border-color:#e8e0f0">
          <div class="min-w-0">
            <p class="text-[11px] uppercase tracking-wide font-semibold truncate" style="color:#6b5a8a">{{ kpi.label }}</p>
            <p class="text-xl font-bold mt-1 truncate" style="color:var(--color-unergy-deep)">{{ kpi.value }}</p>
            <p v-if="kpi.sub" class="text-[11px] mt-0.5" :style="{ color: kpi.subColor || 'var(--color-unergy-purple)' }">{{ kpi.sub }}</p>
          </div>
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :style="{ backgroundColor: kpi.bg }">
            <component :is="kpi.icon" class="text-lg size-[1em]" :style="{ color: kpi.color }" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- ── Por tipo de proyecto ───────────────────────────────── -->
        <div class="bg-white rounded-xl shadow-sm p-4 border" style="border-color:#e8e0f0">
          <h3 class="text-sm font-bold mb-3" style="color:var(--color-unergy-deep)">Ingresos por tipo de proyecto</h3>
          <div v-if="porTipo.length" class="space-y-2.5">
            <div v-for="t in porTipo" :key="t.tipo">
              <div class="flex justify-between text-xs mb-1" style="color:var(--color-unergy-deep)">
                <span class="capitalize font-medium">{{ t.tipo }}</span>
                <span class="font-mono" style="color:#6b5a8a">{{ fmtCompact(t.ingresos) }} · {{ t.count }} proy.</span>
              </div>
              <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full rounded-full" :style="{ width: barPct(t.ingresos) + '%', background:'var(--color-unergy-purple)' }" />
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 py-4 text-center">Sin paneles en el período.</p>
        </div>

        <!-- ── Pipeline (firmado / pendiente) ─────────────────────── -->
        <div class="bg-white rounded-xl shadow-sm p-4 border" style="border-color:#e8e0f0">
          <h3 class="text-sm font-bold mb-3" style="color:var(--color-unergy-deep)">Estado del período</h3>
          <div v-if="totalMes" class="space-y-1.5">
            <div class="flex h-3 rounded-full overflow-hidden bg-gray-100">
              <div v-for="s in pipeline" :key="s.estado" class="h-full"
                :style="{ width: (s.count / totalMes * 100) + '%', background: s.color }"
                v-tooltip.top="`${s.label}: ${s.count}`" />
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 pt-2">
              <span v-for="s in pipeline" :key="s.estado" class="flex items-center gap-1.5 text-[11px]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: s.color }" />
                <span style="color:var(--color-unergy-deep)">{{ s.label }}</span>
                <span class="font-mono font-semibold" style="color:#6b5a8a">{{ s.count }}</span>
              </span>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 py-4 text-center">Sin paneles en el período.</p>
        </div>
      </div>

      <!-- ── Tendencia ───────────────────────────────────────────── -->
      <div class="bg-white rounded-xl shadow-sm p-4 border" style="border-color:#e8e0f0">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold" style="color:var(--color-unergy-deep)">Tendencia (últimos 12 meses)</h3>
          <span class="text-[11px]" style="color:#9b8fb0">Ingresos · Costos · Valor a pagar</span>
        </div>
        <div style="height: 240px">
          <Line v-if="tieneTendencia" :data="trendData" :options="trendOptions" />
          <p v-else class="text-xs text-gray-400 py-8 text-center">Sin datos históricos del Panel suficientes.</p>
        </div>
      </div>

      <!-- ── Proyectos del período (Panel) ───────────────────────────── -->
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden" style="border-color:#e8e0f0">
        <div class="px-4 py-2.5 flex items-center gap-2 border-b" style="border-color:#f0ebf6">
          <h3 class="text-sm font-bold" style="color:var(--color-unergy-deep)">Panel Contable de {{ formatPeriodo(periodo) }}</h3>
          <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style="background:#F1EAF9; color:var(--color-unergy-purple-dark)">{{ proyectos.length }}</span>
        </div>
        <DataTable :value="proyectos" v-model:expandedRows="expandedRows" dataKey="panel_id"
          rowHover class="text-sm" :rows="12" paginator :alwaysShowPaginator="false">
          <template #empty>
            <div class="text-center py-6 text-xs text-gray-400">
              Sin paneles para este período. Cárgalos en Panel Contable.
            </div>
          </template>
          <Column expander style="width:3rem" />
          <Column field="proyecto" header="Proyecto" sortable />
          <Column header="Tipo">
            <template #body="{ data }"><span class="capitalize text-xs">{{ data.tipo_proyecto || '—' }}</span></template>
          </Column>
          <Column header="Estado">
            <template #body="{ data }">
              <GBadge :color="estadoFlujoPanel(data, tipo).sev" class="text-[10px]">{{ estadoFlujoPanel(data, tipo).label }}</GBadge>
            </template>
          </Column>
          <Column header="Ingresos" style="width:130px">
            <template #body="{ data }"><span class="font-mono text-xs">{{ fmtCompact(data.ingresos_cop) }}</span></template>
          </Column>
          <Column header="Costos" style="width:120px">
            <template #body="{ data }"><span class="font-mono text-xs text-red-600">{{ fmtCompact(data.costos_cop) }}</span></template>
          </Column>
          <Column header="Valor a pagar" style="width:140px">
            <template #body="{ data }"><span class="font-mono text-xs font-semibold" style="color:var(--color-unergy-purple)">{{ fmtCompact(data.valor_a_pagar_total) }}</span></template>
          </Column>
          <Column header="" style="width:48px">
            <template #body="{ data }">
              <Button v-if="data.liquidacion_id" text rounded size="small" @click.stop="goDetalle(data.liquidacion_id)">
                <template #icon><EyeIcon class="size-[1em]" /></template>
              </Button>
            </template>
          </Column>
          <template #expansion="{ data }">
            <div class="px-4 py-3" style="background:#FAF8FD">
              <p class="text-[11px] font-semibold mb-2" style="color:#6b5a8a">Por inversionista</p>
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-left" style="color:#9b8fb0">
                    <th class="pb-1 font-medium">Inversionista</th>
                    <th class="pb-1 font-medium">%</th>
                    <th class="pb-1 font-medium text-right">Valor a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="inv in data.inversionistas" :key="inv.proyecto_inversionista_id || inv.nombre"
                    class="border-t" style="border-color:#f0ebf6">
                    <td class="py-1.5" style="color:var(--color-unergy-deep)">{{ inv.cliente_nombre || inv.nombre || '—' }}</td>
                    <td class="py-1.5 font-mono" style="color:#6b5a8a">{{ inv.porcentaje != null ? inv.porcentaje.toFixed(2) + '%' : '—' }}</td>
                    <td class="py-1.5 font-mono text-right font-semibold" style="color:var(--color-unergy-purple)">{{ fmtCompact(inv.valor_a_pagar) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { fmtCompact, formatPeriodo, estadoFlujoPanel, ESTADO_FLUJO } from '~/features/liquidaciones/utils/liquidaciones'
import { ArrowDownLeftIcon, ArrowUpRightIcon, CircleCheckIcon, ClockIcon, EyeIcon, InboxIcon, PercentIcon, TriangleAlertIcon, WalletIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps({
  periodo: { type: String, required: true },
  tipo: { type: String, default: 'preliquidacion' },
})
const router = useRouter()
const liquidacionesService = new LiquidacionesService()

const loading = ref(false)
const periodosData = ref([])   // [{periodo, resumen, proyectos}] del Panel (ventana 12m)
const sinPanel = ref([])       // proyectos en operación sin panel este período
const expandedRows = ref({})

const periodoYYYYMM = computed(() => props.periodo.slice(0, 7))

// Ventana de 12 meses terminando en `periodo`
const ventana = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const ini = new Date(y, m - 12, 1)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { desde: iso(ini), hasta: periodoYYYYMM.value }
})

const porPeriodo = computed(() => {
  const map = {}
  for (const p of periodosData.value) map[p.periodo] = p
  return map
})

const entryActual = computed(() => porPeriodo.value[periodoYYYYMM.value] || null)
const proyectos = computed(() => entryActual.value?.proyectos || [])
const totalMes = computed(() => proyectos.value.length)

// ── Alertas del período (#10) ──────────────────────────────────────────────────
const alertas = computed(() => {
  const out = []
  const negativos = proyectos.value.filter(p => (p.valor_a_pagar_total || 0) < 0)
  if (negativos.length) out.push({
    key: 'neg', icon: TriangleAlertIcon, color: '#D64455', bg: '#fef2f3', border: '#f7c7cd',
    titulo: `${negativos.length} proyecto(s) con valor a pagar negativo`,
    detalle: negativos.slice(0, 6).map(p => p.proyecto).join(', ') + (negativos.length > 6 ? '…' : ''),
  })
  const pctRaros = proyectos.value.filter(p => {
    const s = (p.inversionistas || []).reduce((a, i) => a + (i.porcentaje || 0), 0)
    return p.inversionistas?.length && Math.abs(s - 100) > 1
  })
  if (pctRaros.length) out.push({
    key: 'pct', icon: PercentIcon, color: '#CA8A04', bg: '#fefce8', border: '#f4e2a1',
    titulo: `${pctRaros.length} proyecto(s) con participación ≠ 100%`,
    detalle: pctRaros.slice(0, 6).map(p => p.proyecto).join(', ') + (pctRaros.length > 6 ? '…' : ''),
  })
  if (sinPanel.value.length) out.push({
    key: 'sinpanel', icon: InboxIcon, color: '#6E3FB8', bg: '#faf7ff', border: '#e3d5f5',
    titulo: `${sinPanel.value.length} proyecto(s) en operación sin panel este período`,
    detalle: sinPanel.value.slice(0, 6).map(p => p.proyecto).join(', ') + (sinPanel.value.length > 6 ? '…' : ''),
  })
  return out
})

// Meses de la ventana (12) en orden
const mesesVentana = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const out = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
})

const mesPrevYYYYMM = computed(() => {
  const [y, m] = props.periodo.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

const kpis = computed(() => {
  const r = entryActual.value?.resumen || { ingresos_total_cop: 0, costos_total_cop: 0, valor_a_pagar_total: 0, num_proyectos: 0 }
  const prev = porPeriodo.value[mesPrevYYYYMM.value]?.resumen
  const ing = r.ingresos_total_cop || 0
  const cos = r.costos_total_cop || 0
  const vap = r.valor_a_pagar_total || 0
  const margen = ing ? (vap / ing * 100) : 0
  const firmados = proyectos.value.filter(p => p.estado === 'firmado').length
  const pendientes = proyectos.value.length - firmados
  const delta = (cur, p) => {
    if (p == null || !p) return null
    const d = (cur - p) / Math.abs(p) * 100
    return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% vs mes ant.`
  }
  const tint = (hex) => hex + '1a'
  return [
    { label: 'Ingresos', value: fmtCompact(ing), sub: delta(ing, prev?.ingresos_total_cop), subColor: '#10B981', icon: ArrowUpRightIcon, color: '#10B981', bg: tint('#10B981') },
    { label: 'Costos', value: fmtCompact(cos), sub: delta(cos, prev?.costos_total_cop), subColor: '#D64455', icon: ArrowDownLeftIcon, color: '#D64455', bg: tint('#D64455') },
    { label: 'Valor a pagar', value: fmtCompact(vap), icon: WalletIcon, color: '#915BD8', bg: tint('#915BD8') },
    { label: 'Margen', value: `${margen.toFixed(0)}%`, icon: PercentIcon, color: '#6E3FB8', bg: tint('#6E3FB8') },
    { label: 'Firmados', value: String(firmados), icon: CircleCheckIcon, color: '#10B981', bg: tint('#10B981') },
    { label: 'Pendientes', value: String(pendientes), icon: ClockIcon, color: '#CA8A04', bg: tint('#CA8A04') },
  ]
})

const porTipo = computed(() => {
  const map = {}
  for (const p of proyectos.value) {
    const t = p.tipo_proyecto || 'sin tipo'
    if (!map[t]) map[t] = { tipo: t, ingresos: 0, count: 0 }
    map[t].ingresos += p.ingresos_cop || 0
    map[t].count += 1
  }
  return Object.values(map).sort((a, b) => b.ingresos - a.ingresos)
})
const maxTipoIngreso = computed(() => Math.max(1, ...porTipo.value.map(t => t.ingresos)))
const barPct = (v) => Math.round(v / maxTipoIngreso.value * 100)

const pipeline = computed(() => {
  const counts = { cargado: 0, numerado: 0, firmado: 0 }
  for (const p of proyectos.value) counts[estadoFlujoPanel(p, props.tipo).key]++
  return ESTADO_FLUJO
    .map(s => ({ estado: s.key, label: s.label, count: counts[s.key], color: s.color }))
    .filter(s => s.count > 0)
})

// ── Tendencia ────────────────────────────────────────────────────────────────
const tieneTendencia = computed(() => periodosData.value.length > 0)
const trendData = computed(() => {
  const byMes = {}
  for (const p of mesesVentana.value) byMes[p] = { ing: 0, cos: 0, vap: 0 }
  for (const entry of periodosData.value) {
    if (byMes[entry.periodo]) {
      byMes[entry.periodo].ing = entry.resumen.ingresos_total_cop || 0
      byMes[entry.periodo].cos = entry.resumen.costos_total_cop || 0
      byMes[entry.periodo].vap = entry.resumen.valor_a_pagar_total || 0
    }
  }
  const lbl = (ym) => formatPeriodo(ym + '-01')
  return {
    labels: mesesVentana.value.map(lbl),
    datasets: [
      { label: 'Ingresos', data: mesesVentana.value.map(p => byMes[p].ing), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.3, fill: true },
      { label: 'Costos', data: mesesVentana.value.map(p => byMes[p].cos), borderColor: '#D64455', backgroundColor: 'rgba(214,68,85,0.06)', tension: 0.3, fill: false },
      { label: 'Valor a pagar', data: mesesVentana.value.map(p => byMes[p].vap), borderColor: '#915BD8', backgroundColor: 'rgba(145,91,216,0.10)', tension: 0.3, fill: true },
    ],
  }
})
const trendOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: true, labels: { font: { size: 11 }, color: '#6b5a8a', boxWidth: 12 } },
    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtCompact(c.parsed.y)}` } },
  },
  scales: {
    x: { ticks: { font: { size: 10 }, color: '#9ca3af', maxTicksLimit: 12 }, grid: { display: false } },
    y: { ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => fmtCompact(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
  },
}

// ── Carga ─────────────────────────────────────────────────────────────────────
function goDetalle(id) { router.push(`/liquidaciones/${id}`) }

async function load() {
  loading.value = true
  try {
    // Rango (tendencia/tabla) + período único (para 'sin_panel' de las alertas).
    const [rango, unico] = await Promise.allSettled([
      liquidacionesService.obtenerResumenPanelRango({
        periodo_desde: ventana.value.desde, periodo_hasta: ventana.value.hasta, tipo: props.tipo,
      }),
      liquidacionesService.obtenerResumenPanel({ periodo: periodoYYYYMM.value, tipo: props.tipo }),
    ])
    periodosData.value = rango.status === 'fulfilled' ? (rango.value.periodos || []) : []
    sinPanel.value = unico.status === 'fulfilled' ? (unico.value.sin_panel || []) : []
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
