<template>
  <Teleport to="body">
    <Transition name="isheet">
      <div v-if="open" class="is-root">
        <!-- Encabezado -->
        <header class="is-head">
          <button class="is-back" @click="close"><ChevronLeftIcon class="size-[1em]" /></button>
          <div class="is-titles">
            <span class="is-title">Potencia por inversor</span>
            <span class="is-sub">{{ nombre || '—' }}</span>
          </div>
          <button class="is-icon-btn" :disabled="loading" @click="cargar(true)" title="Actualizar">
            <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
            <RefreshCwIcon v-else class="size-[1em]" />
          </button>
        </header>

        <!-- Selector de líneas -->
        <div v-if="inversores.length" class="is-chips">
          <button v-for="inv in inversores" :key="inv.dev_name"
            :class="['is-chip', ocultos.has(inv.dev_name) && 'is-chip--off']"
            :style="ocultos.has(inv.dev_name) ? {} : { borderColor: inv.color, background: inv.color + '14' }"
            @click="toggle(inv.dev_name)">
            <span class="is-chip-dot" :style="{ background: ocultos.has(inv.dev_name) ? '#cbd5e1' : inv.color }" />
            <span class="is-chip-name">{{ inv.dev_name }}</span>
            <span class="is-chip-peak">{{ fmtKw(inv.peak_kw) }}</span>
          </button>
          <button class="is-chip is-chip--all" @click="todos">
            <EyeIcon v-if="ocultos.size" class="size-[1em]" />
            <EyeOffIcon v-else class="size-[1em]" />
            {{ ocultos.size ? 'Todos' : 'Ninguno' }}
          </button>
        </div>

        <!-- Gráfica -->
        <main class="is-chart">
          <div v-if="loading" class="is-state"><LoaderCircleIcon class="size-[1em] animate-spin" /> <span>Cargando inversores…</span></div>
          <div v-else-if="error" class="is-state">
            <TriangleAlertIcon class="size-[1em]" style="font-size:30px;color:#f59e0b" />
            <span>{{ error }}</span>
            <button class="is-retry" @click="cargar(true)">Reintentar</button>
          </div>
          <div v-else-if="!inversores.length" class="is-state">
            <ChartLineIcon class="size-[1em]" style="font-size:32px;color:#d1d5db" />
            <span>Sin datos de inversores hoy</span>
          </div>
          <div v-else-if="!datasetsVisibles.length" class="is-state">
            <EyeOffIcon class="size-[1em]" style="font-size:30px;color:#d1d5db" />
            <span>Todas las líneas están ocultas</span>
          </div>
          <Line v-else :data="chartData" :options="chartOptions" />
        </main>

        <!-- Pie -->
        <footer class="is-foot">
          <span><CalendarIcon class="size-[1em]" /> {{ fecha }}</span>
          <span v-if="granularidad">{{ granularidad === 'hour' ? 'por hora' : 'cada 5 min' }}</span>
          <span v-if="actualizado" class="is-foot-upd"><ClockIcon class="size-[1em]" /> {{ actualizado }}</span>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Legend, Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { CalendarIcon, ChartLineIcon, ChevronLeftIcon, ClockIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip)

const generacionSolarService = new GeneracionSolarService()

// Misma paleta que la "Comparativa de inversores" del escritorio.
const PALETA = [
  '#915BD8', '#16a34a', '#d97706', '#0ea5e9', '#dc2626',
  '#14b8a6', '#a855f7', '#f59e0b', '#2563eb', '#65a30d',
]

const props = defineProps({
  open:       { type: Boolean, default: false },
  proyectoId: { type: [Number, String], default: null },
  nombre:     { type: String, default: '' },
})
const emit = defineEmits(['close'])

const crudos       = ref([])      // [{ dev_name, points: [{time, kw}], peak_kw }]
const granularidad = ref('')
const fecha        = ref('')
const loading      = ref(false)
const error        = ref('')
const actualizado  = ref('')
const ocultos      = ref(new Set())

// Al abrir: cargar si cambió de proyecto o si no hay nada cacheado.
let cargadoPara = null
// `immediate` para que también cargue si la hoja se monta ya abierta.
watch(() => props.open, (abierta) => {
  if (!abierta) return
  if (cargadoPara !== props.proyectoId) {
    ocultos.value = new Set()
    cargar()
  }
}, { immediate: true })

const inversores = computed(() =>
  crudos.value.map((inv, i) => ({ ...inv, color: PALETA[i % PALETA.length] })))

// Eje X: unión de los tiempos de todos los inversores, ordenada.
const tiempos = computed(() => {
  const set = new Set()
  for (const inv of crudos.value) for (const p of inv.points || []) set.add(p.time)
  return Array.from(set).sort()
})

/** "2026-08-18 08:45" → "08:45" (día suelto) · "18/08 08h" (varios días) */
function fmtTiempo(t) {
  if (!t) return ''
  const [d, hm] = String(t).split(' ')
  if (!hm) return String(t)
  if (granularidad.value === 'hour' && d) {
    const [, mm, dd] = d.split('-')
    return `${dd}/${mm} ${hm.slice(0, 2)}h`
  }
  return hm.slice(0, 5)
}

function fmtKw(kw) {
  if (kw == null) return '—'
  return `${Number(kw).toLocaleString('es-CO', { maximumFractionDigits: kw >= 100 ? 0 : 1 })} kW`
}

const datasetsVisibles = computed(() =>
  inversores.value
    .filter((inv) => !ocultos.value.has(inv.dev_name))
    .map((inv) => {
      const porTiempo = {}
      for (const p of inv.points || []) porTiempo[p.time] = p.kw
      return {
        label: inv.dev_name,
        data: tiempos.value.map((t) => (t in porTiempo ? porTiempo[t] : null)),
        borderColor: inv.color,
        backgroundColor: 'transparent',
        fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.8, spanGaps: true,
      }
    }))

const chartData = computed(() => ({
  labels: tiempos.value.map(fmtTiempo),
  datasets: datasetsVisibles.value,
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  // En el celular el toque debe mostrar todas las potencias de esa hora.
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },   // las líneas se prenden y apagan con los chips
    tooltip: {
      backgroundColor: 'rgba(44,32,57,0.95)',
      padding: 10, titleFont: { size: 12 }, bodyFont: { size: 11.5 },
      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'} kW` },
    },
  },
  scales: {
    x: {
      ticks: { font: { size: 9.5 }, color: '#9ca3af', maxTicksLimit: 7, autoSkip: true, maxRotation: 0 },
      grid: { display: false }, border: { display: false },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Potencia (kW)', font: { size: 10 }, color: '#9ca3af' },
      ticks: { font: { size: 9.5 }, color: '#9ca3af', maxTicksLimit: 6, padding: 4 },
      grid: { color: 'rgba(28,18,50,0.05)' }, border: { display: false },
    },
  },
}

function toggle(devName) {
  const next = new Set(ocultos.value)
  next.has(devName) ? next.delete(devName) : next.add(devName)
  ocultos.value = next
}
function todos() {
  ocultos.value = ocultos.value.size
    ? new Set()
    : new Set(inversores.value.map((i) => i.dev_name))
}

async function cargar(forzar = false) {
  if (!props.proyectoId) return
  if (loading.value && !forzar) return
  loading.value = true
  error.value = ''
  try {
    const data = await generacionSolarService.obtenerPotenciaInversores(props.proyectoId)
    crudos.value = data.inverters ?? []
    granularidad.value = data.granularidad || ''
    fecha.value = data.date_from === data.date_to
      ? (data.date_from || '')
      : `${data.date_from} → ${data.date_to}`
    actualizado.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    cargadoPara = props.proyectoId
  } catch (e) {
    crudos.value = []
    // 422 = el proyecto no está en Solenium; el resto es fallo de red o del servidor.
    error.value = e.status === 422
      ? 'Este proyecto no tiene ID de Solenium configurado.'
      : (e.data?.detail || 'No se pudieron cargar los inversores.')
  } finally {
    loading.value = false
  }
}

function close() { emit('close') }
</script>

<style scoped>
.is-root {
  position: fixed; inset: 0; z-index: 110;
  display: flex; flex-direction: column;
  background: #f3f4f6; color: var(--color-unergy-deep);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Encabezado */
.is-head {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(9px + env(safe-area-inset-top)) 12px 9px;
  background: var(--color-unergy-deep); color: #fff;
}
.is-back, .is-icon-btn {
  width: 36px; height: 36px; flex-shrink: 0; border: none; border-radius: 10px;
  background: rgba(255,255,255,0.1); color: #fff; font-size: 15px;
}
.is-icon-btn:disabled { opacity: .5; }
.is-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.is-title { font-size: clamp(14px, 3.9vw, 16px); font-weight: 700; letter-spacing: .2px; }
.is-sub {
  font-size: 11.5px; color: rgba(255,255,255,0.6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Chips de inversores */
.is-chips {
  display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
  padding: 9px 11px; background: #fff; border-bottom: 1px solid #eceaf2;
}
.is-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 9px; border: 1.5px solid #e8e0f0; border-radius: 10px;
  background: #fff; font-size: 11.5px; font-weight: 600; color: var(--color-unergy-deep);
}
.is-chip--off { color: #9ca3af; background: #f9fafb; border-color: #eceaf2; }
.is-chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.is-chip-name { max-width: 42vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.is-chip-peak { font-size: 10.5px; color: #787774; font-weight: 700; font-variant-numeric: tabular-nums; }
.is-chip--off .is-chip-peak { color: #b6bec9; }
.is-chip--all { color: var(--color-unergy-purple); border-color: #e2d5f5; background: #faf8fd; }

/* Gráfica */
.is-chart { flex: 1; min-height: 0; position: relative; padding: 12px 10px 6px; background: #fff; }
.is-state {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 11px; padding: 0 24px; text-align: center; color: #6b5a8a; font-size: 14px;
}
.is-state svg { font-size: 24px; color: var(--color-unergy-purple); }
.is-retry {
  margin-top: 2px; padding: 10px 20px; border: none; border-radius: 11px;
  background: var(--color-unergy-purple); color: #fff; font-weight: 600; font-size: 14px;
}

/* Pie */
.is-foot {
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  padding: 9px 13px calc(9px + env(safe-area-inset-bottom));
  background: #fff; border-top: 1px solid #eceaf2;
  font-size: 11px; color: #9ca3af;
}
.is-foot svg { margin-right: 4px; }
.is-foot-upd { margin-left: auto; }

.isheet-enter-active, .isheet-leave-active { transition: opacity .2s ease, transform .25s ease; }
.isheet-enter-from, .isheet-leave-to { opacity: 0; transform: translateY(14px); }
</style>
