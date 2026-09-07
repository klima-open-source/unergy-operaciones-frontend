<template>
  <div class="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full" style="border-color:#e8e0f0">
    <div class="px-3 py-2 flex items-center gap-2 border-b" style="border-color:#f0ebf6">
      <SunIcon class="text-sm size-[1em]" style="color:#F0C040" />
      <h3 class="text-sm font-bold" style="color:var(--color-unergy-deep)">Generación del mes</h3>
      <span class="text-[10px]" style="color:#9b8fb0">kWh por día · datos en vivo</span>
    </div>

    <div class="flex-1 p-3">
      <ProgressSpinner v-if="loading" style="width:32px;height:32px" class="block mx-auto my-6" />

      <template v-else-if="dias.length">
        <div style="height: 150px">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
        <p class="text-[10px] mt-1.5" style="color:#9b8fb0">Fuente: API de monitoreo Unergy (en vivo)</p>
      </template>

      <div v-else class="text-center py-6">
        <ChartColumnIcon class="text-3xl mb-2 size-[1em]" style="color:#e0d5f0" />
        <p class="text-xs" style="color:#9b8fb0">{{ mensaje || 'Sin generación registrada para este período.' }}</p>
      </div>
    </div>

    <!-- Tarifas de servicio del cliente para ese mes -->
    <div class="border-t px-3 py-2" style="border-color:#f0ebf6; background:#fcfbfe">
      <p class="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style="color:#9b8fb0">
        Tarifas de servicio · {{ periodoLabel }}
      </p>
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg px-2 py-1.5 text-center" style="background:#F4F1FA">
          <p class="text-[10px] uppercase tracking-wide font-semibold" style="color:var(--color-unergy-purple-dark)">Representación ($/kWh)</p>
          <p class="text-sm font-bold tabular-nums" style="color:var(--color-unergy-deep)">{{ fmtCOP(tarifas.representacion) }}</p>
        </div>
        <div class="rounded-lg px-2 py-1.5 text-center" style="background:#F4F1FA">
          <p class="text-[10px] uppercase tracking-wide font-semibold" style="color:var(--color-unergy-purple-dark)">CGM ($/kWh)</p>
          <p class="text-sm font-bold tabular-nums" style="color:var(--color-unergy-deep)">{{ fmtCOP(tarifas.cgm) }}</p>
        </div>
        <div class="rounded-lg px-2 py-1.5 text-center" style="background:#F4F1FA">
          <p class="text-[10px] uppercase tracking-wide font-semibold" style="color:var(--color-unergy-purple-dark)">Administración (%)</p>
          <p class="text-sm font-bold tabular-nums" style="color:var(--color-unergy-deep)">{{ fmtAdminPct(tarifas.admin) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'
import ProgressSpinner from 'primevue/progressspinner'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { fmtCOP, formatPeriodo } from '~/features/liquidaciones/utils/liquidaciones'
import { ChartColumnIcon, SunIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  proyectoId: { type: [Number, String], default: null },
  proyectoNombre: { type: String, default: '' },
  periodo: { type: String, required: true },   // YYYY-MM-01
})

const monitoreoLegacyService = new MonitoreoLegacyService()
const contratosServicioService = new ContratosServicioService()

const loading = ref(false)
const dias = ref([])
const mensaje = ref('')
const tarifas = reactive({ representacion: null, cgm: null, admin: null })

const periodoLabel = computed(() => formatPeriodo(props.periodo))

function fmtKwh(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)} MWh`
  return `${v.toFixed(0)} kWh`
}

// Administración se cobra como % (no $/kWh). Acepta fracción (0.02) o número (2).
function fmtAdminPct(v) {
  if (v == null) return '—'
  const n = Number(v)
  return `${(Math.abs(n) < 1 ? n * 100 : n).toFixed(2)}%`
}

const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const totalReal = computed(() => dias.value.reduce((s, d) => s + (d.kwh || 0), 0))

const chartData = computed(() => ({
  labels: dias.value.map(d => Number(d.date.split('-')[2])),
  datasets: [{
    label: 'Generación', data: dias.value.map(d => d.kwh),
    backgroundColor: '#915BD8', borderRadius: 3, maxBarThickness: 16,
  }],
}))

const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c) => fmtKwh(c.parsed.y), title: (items) => `Día ${items[0].label}` } },
  },
  scales: {
    x: { ticks: { font: { size: 9 }, color: '#9ca3af', maxTicksLimit: 16 }, grid: { display: false } },
    y: { ticks: { font: { size: 9 }, color: '#9ca3af' }, grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true },
  },
}

function ultimoDiaMes(periodo) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Generación (API de monitoreo en vivo) ─────────────────────────────────────
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

async function cargarGeneracion() {
  if (!props.periodo) return
  loading.value = true
  mensaje.value = ''
  dias.value = []
  try {
    const sub = await resolverSub()
    if (!sub) { mensaje.value = 'Este proyecto no tiene monitoreo en la API de Unergy.'; return }
    const data = await monitoreoLegacyService.obtenerGeneracion({ sub_project: sub, date_from: props.periodo, date_to: ultimoDiaMes(props.periodo) })
    if (data && data.ok === false) { mensaje.value = data.error || 'La API de Unergy no devolvió datos.'; return }
    const porDia = new Map()
    for (const it of (Array.isArray(data?.data) ? data.data : [])) {
      if (!it || it.kwh == null || !it.date) continue
      porDia.set(it.date, (porDia.get(it.date) || 0) + Number(it.kwh))
    }
    dias.value = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, kwh]) => ({ date, kwh }))
  } catch (e) {
    mensaje.value = e?.data?.detail || 'No se pudo consultar la generación.'
  } finally {
    loading.value = false
  }
}

// ── Tarifas de servicio (contratos del proyecto, indexadas por año) ───────────
// indexacion_* = [{ año, valor }]. Se toma el valor del año del período; si no hay,
// el del último año <= período; si no, la tarifa base del contrato.
function tarifaDelAnio(indexacion, base, anio) {
  const arr = Array.isArray(indexacion) ? indexacion.filter(r => r && r.valor != null) : []
  if (arr.length) {
    const exacta = arr.find(r => Number(r.año ?? r.anio) === anio)
    if (exacta) return Number(exacta.valor)
    const previas = arr.filter(r => Number(r.año ?? r.anio) <= anio).sort((a, b) => Number(b.año ?? b.anio) - Number(a.año ?? a.anio))
    if (previas.length) return Number(previas[0].valor)
  }
  return base != null ? Number(base) : null
}

async function cargarTarifas() {
  tarifas.representacion = null; tarifas.cgm = null; tarifas.admin = null
  if (!props.proyectoId) return
  try {
    const data = await contratosServicioService.listar({ proyecto_id: props.proyectoId })
    const contratos = Array.isArray(data) ? data : []
    const anio = Number(props.periodo.split('-')[0])
    for (const c of contratos) {
      if (tarifas.representacion == null && (c.indexacion_representacion?.length || c.tarifa_representacion != null))
        tarifas.representacion = tarifaDelAnio(c.indexacion_representacion, c.tarifa_representacion, anio)
      if (tarifas.cgm == null && (c.indexacion_cgm?.length || c.tarifa_cgm != null))
        tarifas.cgm = tarifaDelAnio(c.indexacion_cgm, c.tarifa_cgm, anio)
      if (tarifas.admin == null && c.tarifa_admin != null)
        tarifas.admin = Number(c.tarifa_admin)
    }
  } catch { /* tarifas opcionales */ }
}

function cargar() { cargarGeneracion(); cargarTarifas() }

watch(() => [props.proyectoId, props.periodo], cargar)
onMounted(cargar)
</script>
