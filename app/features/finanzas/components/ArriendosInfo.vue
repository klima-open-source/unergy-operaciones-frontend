<template>
  <div class="space-y-4 pt-3">

    <!-- ── Barra superior ────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between flex-wrap gap-2 border" style="border-color:#ECE7F2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">{{ periodoLabel }}</span>
        <GBadge color="default" class="text-xs font-mono">{{ periodoActual }}</GBadge>
      </div>
      <p class="text-xs text-gray-400">
        Edita estos datos en Proyecto&gt;Detalle&gt;Servicios&gt;Operación&gt;Arriendos (sección Arrendadores).
      </p>
    </div>

    <!-- ── Filtros ──────────────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Buscar</label>
        <input v-model="filtroTexto" type="text" placeholder="Nombre del proyecto…"
          class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56" style="outline:none" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Tipo de pago</label>
        <select v-model="filtroPeriodicidad" class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-40">
          <option value="todos">Toda periodicidad</option>
          <option value="mensual">Mensual</option>
          <option value="bimestral">Bimestral</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Con anticipo</label>
        <select v-model="filtroAnticipo" class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-36">
          <option value="todos">Todos</option>
          <option value="con">Con anticipo</option>
          <option value="sin">Sin anticipo</option>
        </select>
      </div>
      <div class="ml-auto pb-1.5 text-xs text-gray-400">{{ filasFiltradas.length }} de {{ filas.length }}</div>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-400 border" style="border-color:#ECE7F2">
        Cargando…
      </div>
    </template>
    <template v-else-if="secciones.length">
      <div v-for="sec in secciones" :key="sec.tipo"
        class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">

        <!-- Cabecera de sección (colapsable) -->
        <button type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left select-none hover:bg-gray-50 transition-colors duration-150"
          @click="toggleSection(sec.tipo)">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: sec.dot }" />
          <span class="font-semibold text-gray-800 text-sm flex-1">{{ sec.label }}</span>
          <span class="text-xs text-gray-400 font-medium">({{ sec.items.length }})</span>
          <ChevronDownIcon class="text-gray-400 text-xs ml-2 transition-transform duration-200 size-[1em]" :class="{ 'rotate-180': openSections.has(sec.tipo) }" />
        </button>

        <div class="section-collapse" :class="{ open: openSections.has(sec.tipo) }">
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse" style="min-width:900px; table-layout:fixed">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-100">
                  <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500" style="width:300px">Proyecto</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500" style="width:140px">Tipo de pago</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500" style="width:170px">Anticipo pagado hasta</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500" style="width:160px">Próxima fecha por cobrar</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fila in sec.items" :key="fila.id"
                  class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100">
                  <td class="px-3 py-2.5 font-medium" style="color:var(--color-unergy-deep)">
                    <div class="flex flex-col gap-0.5 max-w-full">
                      <span style="white-space:normal">{{ fila.proyecto }}</span>
                      <span v-if="mostrarArrendador(fila)" class="text-[11px] text-gray-400">
                        {{ fila.nombre_arrendador }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5">
                    <span v-if="fila.periodicidad"
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :style="tipoPagoStyle(fila.periodicidad)">
                      {{ capitalizar(fila.periodicidad) }}
                    </span>
                    <span v-else class="text-xs text-gray-300">—</span>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-gray-600">{{ fmtFecha(fila.anticipo_pagado_hasta) }}</td>
                  <td class="px-3 py-2.5 text-xs text-gray-600">{{ proximaFecha(fila.anticipo_pagado_hasta) }}</td>
                  <td class="px-3 py-2.5 text-xs text-gray-500 max-w-xs truncate" :title="fila.observaciones_arrendador">
                    {{ fila.observaciones_arrendador || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-400 border" style="border-color:#ECE7F2">
      No se encontraron proyectos con los filtros aplicados.
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArriendosCalculoService } from '~/features/finanzas/services/arriendos-calculo'
import { ChevronDownIcon } from '@lucide/vue'

// ── Período (mismo criterio de "período actual" que Panel, sin selector — vista informativa) ──
const arriendosCalculoService = new ArriendosCalculoService()
const hoy = new Date()
const periodoActual = computed(() => {
  const yyyy = hoy.getFullYear()
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
})
const periodoLabel = computed(() => {
  const [yyyy, mm] = periodoActual.value.split('-')
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${MESES[parseInt(mm) - 1]} ${yyyy}`
})

// ── Datos (API — motor real de cálculo) ─────────────────────────────────────────
const loading = ref(false)
const filas   = ref([])

async function cargarDatos() {
  loading.value = true
  try {
    const data = await arriendosCalculoService.obtenerCalculo(periodoActual.value)
    filas.value = data.filas || []
  } catch {
    filas.value = []
  } finally {
    loading.value = false
  }
}

// Mostrar el arrendador como subtítulo solo cuando hay más de un arrendador
// para el mismo proyecto (mismo patrón visual que ArriendosOperaciones.vue).
const conteoPorProyecto = computed(() => {
  const m = {}
  filas.value.forEach(f => { m[f.proyecto] = (m[f.proyecto] || 0) + 1 })
  return m
})
function mostrarArrendador(fila) {
  return !!fila.nombre_arrendador && (conteoPorProyecto.value[fila.proyecto] || 0) > 1
}

// ── Filtros ──────────────────────────────────────────────────────────────────
const filtroTexto        = ref('')
const filtroPeriodicidad = ref('todos')
const filtroAnticipo     = ref('todos')   // todos | con | sin
const filasFiltradas = computed(() => {
  const q = filtroTexto.value.trim().toLowerCase()
  return filas.value.filter(f => {
    if (q && !(f.proyecto || '').toLowerCase().includes(q)) return false
    if (filtroPeriodicidad.value !== 'todos' && (f.periodicidad || 'mensual') !== filtroPeriodicidad.value) return false
    if (filtroAnticipo.value === 'con' && !f.anticipo_pagado_hasta) return false
    if (filtroAnticipo.value === 'sin' && f.anticipo_pagado_hasta) return false
    return true
  })
})

// ── Agrupación por tipo de proyecto (secciones colapsables, como Panel) ──────
const TIPO_LABELS = { minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD', movilidad_electrica: 'Movilidad', otro: 'Otro' }
const TIPO_DOT    = { minigranja: '#10B981', autoconsumo: '#6366F1', gd: '#3B82F6', movilidad_electrica: '#8B5CF6', otro: '#9CA3AF' }
const TIPO_ORDER  = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica', 'otro']
const secciones = computed(() => {
  const groups = {}
  for (const f of filasFiltradas.value) {
    const t = f.tipo_proyecto || 'otro'
    ;(groups[t] ||= []).push(f)
  }
  return TIPO_ORDER.filter(t => groups[t]?.length)
    .map(t => ({ tipo: t, label: TIPO_LABELS[t] || t, dot: TIPO_DOT[t] || '#9CA3AF', items: groups[t] }))
})
const openSections = ref(new Set())
function toggleSection(tipo) {
  const s = new Set(openSections.value)
  s.has(tipo) ? s.delete(tipo) : s.add(tipo)
  openSections.value = s
}
watch(secciones, (s) => {
  if (openSections.value.size === 0 && s.length) openSections.value = new Set(s.map(sec => sec.tipo))
}, { immediate: true })

// ── Helpers visuales ───────────────────────────────────────────────────────────
function capitalizar(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function tipoPagoStyle(periodicidad) {
  const p = (periodicidad || '').toLowerCase()
  if (p === 'mensual')    return 'background:#ede9fe;color:#6d28d9'
  if (p === 'bimestral')  return 'background:#e0e7ff;color:#3730a3'
  if (p === 'trimestral') return 'background:#dbeafe;color:#1e40af'
  if (p === 'semestral')  return 'background:#dcfce7;color:#166534'
  if (p === 'anual')      return 'background:#fef3c7;color:#92400e'
  return 'background:#f3f4f6;color:#6b7280'
}

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-')
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`
  } catch { return iso }
}

// Informativo: mes siguiente al anticipo pagado hasta (no calcula periodicidad exacta).
function proximaFecha(iso) {
  if (!iso) return '—'
  try {
    const [y, m] = iso.split('-').map(Number)
    const d = new Date(y, m, 1) // m ya es "mes siguiente" en índice 0-based del mes original
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`
  } catch { return '—' }
}

watch(periodoActual, cargarDatos)
onMounted(cargarDatos)
</script>

<style scoped>
.section-collapse {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-out;
}
.section-collapse.open {
  max-height: 20000px;
  transition: max-height 0.45s ease-in;
}
</style>
