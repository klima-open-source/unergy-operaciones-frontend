<template>
  <div class="space-y-5">
    <!-- Barra superior -->
    <div class="flex flex-wrap gap-2 justify-end">
      <Button label="Exportar a Excel" severity="secondary" outlined size="small" @click="exportarExcel">
        <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Loading (solo en la primera carga, cuando aún no hay datos) -->
    <div v-if="loading && !historial.length" class="text-center py-6 space-y-3" style="color:#6b5a8a">
      <p>Cargando…</p>
      <p class="text-xs" style="color:#9ca3af">Si tarda, el servidor puede estar despertando (arranque en frío).</p>
      <Button label="Reintentar" size="small" outlined @click="cargar()">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Error de carga (solo si no hay datos que mostrar) -->
    <div v-else-if="errorMsg && !historial.length" class="rounded-lg p-4 text-center space-y-2" style="background:#FEF2F2;border:1px solid rgba(214,68,85,0.2)">
      <p class="text-sm" style="color:#D64455">No se pudo cargar el historial: {{ errorMsg }}</p>
      <Button label="Reintentar" size="small" outlined @click="cargar()">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Si ya hay datos, se renderizan siempre (una recarga en curso no oculta el contenido) -->
    <template v-else>
      <p v-if="loading" class="text-xs text-center" style="color:#9ca3af">Actualizando…</p>
      <!-- 1. Gráfica de tendencia -->
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3" style="border:1px solid #e8e0f0">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Tendencia histórica</h3>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex gap-1">
              <button v-for="r in rangos" :key="r.key"
                type="button"
                @click="rangoActivo = r.key"
                class="px-3 py-1 text-xs rounded-lg font-medium transition-colors"
                :style="rangoActivo === r.key
                  ? 'background:var(--color-unergy-purple);color:white'
                  : 'color:#6b5a8a;border:1px solid #e8e0f0'">
                {{ r.label }}
              </button>
            </div>
            <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none" style="color:#374151">
              <input type="checkbox" v-model="agruparPorMes" class="accent-purple-600" />
              Agrupar por mes
            </label>
          </div>
        </div>

        <div v-if="puntosGrafica.length > 1" style="height:300px;position:relative">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <div v-else class="py-12 text-center text-sm" style="color:#6b5a8a">
          Aún no hay suficientes reportes semanales para la tendencia.
        </div>
      </div>

      <!-- 2. Navegación por mes (acordeón) -->
      <div v-if="mesesAgrupados.length" class="space-y-3">
        <div v-for="grupo in mesesAgrupados" :key="grupo.mes"
          class="bg-white rounded-xl shadow-sm overflow-hidden" style="border:1px solid #e8e0f0">
          <!-- Cabecera mes -->
          <button type="button"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors"
            @click="toggleMes(grupo.mes)">
            <span class="flex items-center gap-2">
              <ChevronDownIcon v-if="mesesAbiertos[grupo.mes]" class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
              <ChevronRightIcon v-else class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
              <span class="text-sm font-semibold capitalize" style="color:var(--color-unergy-deep)">{{ grupo.label }}</span>
            </span>
            <span class="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style="background:#f3f0f7;color:var(--color-unergy-purple)">
              {{ grupo.registros.length }} {{ grupo.registros.length === 1 ? 'reporte' : 'reportes' }}
            </span>
          </button>

          <!-- Reportes del mes -->
          <div v-if="mesesAbiertos[grupo.mes]" style="border-top:1px solid #e8e0f0">
            <div v-for="r in grupo.registros" :key="r.id"
              style="border-bottom:1px solid #f0ebf7">
              <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                <span class="text-sm tabular-nums w-24 shrink-0" style="color:var(--color-unergy-deep)">{{ r.fecha }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                  :style="tipoBadge(r.tipo)">
                  {{ r.tipo }}
                </span>
                <span class="flex-1 text-right tabular-nums font-semibold text-sm" style="color:var(--color-unergy-deep)">
                  {{ cifraClave(r) }}
                </span>
                <div class="flex items-center gap-0.5 shrink-0">
                  <Button v-if="r.snapshot" text rounded size="small" severity="secondary" v-tooltip.top="'Ver hoja madre'" :style="snapshotAbierto === r.id ? 'color:var(--color-unergy-purple)' : ''" @click="toggleSnapshot(r.id)">
                    <template #icon><EyeIcon class="size-[1em]" /></template>
                  </Button>
                  <Button v-else text rounded size="small" severity="secondary" disabled v-tooltip.top="'Sin detalle guardado'">
                    <template #icon><EyeOffIcon class="size-[1em]" /></template>
                  </Button>
                  <Button text rounded size="small" severity="secondary" @click="abrirEditar(r)">
                    <template #icon><PencilIcon class="size-[1em]" /></template>
                  </Button>
                  <Button text rounded size="small" severity="danger" @click="eliminar(r.id)">
                    <template #icon><Trash2Icon class="size-[1em]" /></template>
                  </Button>
                </div>
              </div>
              <!-- Hoja madre expandida -->
              <div v-if="snapshotAbierto === r.id && r.snapshot" class="px-4 py-4" style="background:#faf8fd">
                <HojaMadreView :data="r.snapshot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="py-12 text-center" style="color:#6b5a8a">
        <InboxIcon class="text-3xl mb-2 block size-[1em]" style="color:#c4b8d4" />
        No hay registros en el historial. Confirma un reporte desde Semanales, TXR o Mensuales.
      </div>
    </template>

    <EditAjusteDialog
      v-model:visible="editVisible"
      :ajuste="editAjuste"
      @saved="cargar()"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { logger } from '~/core/logger'
import { useGarantiasHistorial } from '../composables/useGarantiasHistorial.js'
import { fmtCOP } from '../utils/formatters.js'
import { exportHistorialExcel } from '../utils/excelExport.js'
import Button from 'primevue/button'
import HojaMadreView from '../HojaMadreView.vue'
import EditAjusteDialog from '../EditAjusteDialog.vue'
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, FileSpreadsheetIcon, InboxIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// Destructuramos las refs/funciones: al ser bindings de nivel superior, Vue las
// auto-desempaqueta en el template (sin .value). Evita el bug de refs anidadas
// (loading) que no se desempaquetan y dejan la condición de carga rota.
const { historial, loading, errorMsg, cargar, eliminar } = useGarantiasHistorial()

onMounted(() => cargar())

/* ------------------ Edición ------------------ */
const editVisible = ref(false)
const editAjuste = ref(null)

function abrirEditar(ajuste) {
  editAjuste.value = ajuste
  editVisible.value = true
}

/* ------------------ Helpers ------------------ */
// Envuelve cálculos de render para que un dato inesperado nunca cuelgue la vista.
function safe(fn, fallback) {
  try { return fn() } catch (e) { logger.error('garantias', e); return fallback }
}

function tipoBadge(tipo) {
  const map = {
    semanal: 'background:#f3f0f7;color:#915BD8',
    txr:     'background:#dbeafe;color:#1d4ed8',
    mensual: 'background:#d1fae5;color:#065f46',
  }
  return map[tipo] || 'background:#f3f4f6;color:#6b7280'
}

function cifraClave(r) {
  if (!r) return '—'
  if (r.tipo === 'semanal') return r.totalConsignar != null ? fmtCOP(r.totalConsignar) : '—'
  return r.totalAjusteTXR != null ? fmtCOP(r.totalAjusteTXR) : '—'
}

function mesLabel(mes) {
  // mes = 'YYYY-MM'
  const [y, m] = String(mes || '').split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  if (isNaN(d.getTime())) return String(mes || '')
  const txt = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/* ------------------ Gráfica ------------------ */
const rangoActivo = ref('12m')
const agruparPorMes = ref(false)

const rangos = [
  { key: '3m',  label: 'Últimos 3 meses' },
  { key: '12m', label: 'Últimos 12 meses' },
  { key: 'all', label: 'Todo' },
]

// Solo semanales con datos de tendencia, ordenados ascendente por fecha
const semanales = computed(() => safe(() =>
  (historial.value || [])
    .filter(r => r && r.tipo === 'semanal' && r.totalConsignar != null && r.pb != null && r.fecha)
    .slice()
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
  []))

const semanalesEnRango = computed(() => safe(() => {
  const all = semanales.value
  if (rangoActivo.value === 'all') return all
  const cutoff = new Date()
  if (rangoActivo.value === '3m') cutoff.setMonth(cutoff.getMonth() - 3)
  else cutoff.setMonth(cutoff.getMonth() - 12)
  const cutStr = cutoff.toISOString().slice(0, 10)
  return all.filter(r => String(r.fecha) >= cutStr)
}, []))

// Puntos efectivos de la gráfica (con o sin agrupación por mes)
const puntosGrafica = computed(() => safe(() => {
  const base = semanalesEnRango.value
  if (!agruparPorMes.value) {
    return base.map(r => ({ label: r.fecha, totalConsignar: r.totalConsignar, pb: r.pb }))
  }
  // Agrupar: último reporte semanal de cada mes
  const ultimoPorMes = new Map()
  for (const r of base) {
    const mes = String(r.fecha).slice(0, 7) // 'YYYY-MM' — base ya viene ascendente, así que el último gana
    ultimoPorMes.set(mes, r)
  }
  return [...ultimoPorMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, r]) => ({ label: mes, totalConsignar: r.totalConsignar, pb: r.pb }))
}, []))

const chartData = computed(() => ({
  labels: puntosGrafica.value.map(p => p.label),
  datasets: [
    {
      label: 'Total a consignar (semanal)',
      data: puntosGrafica.value.map(p => p.totalConsignar),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16,185,129,0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: 'y',
    },
    {
      label: 'Precio de bolsa (PB)',
      data: puntosGrafica.value.map(p => p.pb),
      borderColor: '#915BD8',
      backgroundColor: 'rgba(145,91,216,0.08)',
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: 'y2',
    },
  ],
}))

const pbFmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const milesFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.parsed.y
          if (v == null) return null
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
        callback: (v) => Math.abs(v) >= 1e9 ? '$' + (v / 1e9).toFixed(1) + 'B'
          : Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M'
          : '$' + (v / 1e3).toFixed(0) + 'k',
      },
    },
    y2: {
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: {
        callback: (v) => '$' + pbFmt.format(v),
      },
    },
  },
}))

/* ------------------ Navegación por mes ------------------ */
const mesesAgrupados = computed(() => safe(() => {
  const groups = new Map()
  for (const r of (historial.value || [])) {
    if (!r) continue
    const mes = String(r.fecha || '').slice(0, 7)
    if (!mes) continue
    if (!groups.has(mes)) groups.set(mes, [])
    groups.get(mes).push(r)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // meses desc
    .map(([mes, registros]) => ({
      mes,
      label: mesLabel(mes),
      registros: registros.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))), // fecha desc
    }))
}, []))

const mesesAbiertos = ref({})
const snapshotAbierto = ref(null)
const mesInicialAbierto = ref(false)

function toggleMes(mes) {
  mesesAbiertos.value = { ...mesesAbiertos.value, [mes]: !mesesAbiertos.value[mes] }
}

function toggleSnapshot(id) {
  snapshotAbierto.value = snapshotAbierto.value === id ? null : id
}

// Abrir por defecto el mes más reciente la primera vez que llega el historial
watch(mesesAgrupados, (grupos) => {
  if (!mesInicialAbierto.value && grupos.length) {
    mesesAbiertos.value = { [grupos[0].mes]: true }
    mesInicialAbierto.value = true
  }
}, { immediate: true })

/* ------------------ Export ------------------ */
function exportarExcel() {
  exportHistorialExcel(historial.value)
}
</script>
