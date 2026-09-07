<template>
  <div class="space-y-4 pt-3">

    <div class="flex items-center gap-3">
      <button type="button" @click="cambiarMes(-1)"
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
        <ChevronLeftIcon class="text-xs text-gray-500 size-[1em]" />
      </button>
      <span class="text-sm font-semibold" style="color:var(--color-unergy-deep); min-width:100px; text-align:center">
        {{ periodoLabel }}
      </span>
      <button type="button" @click="cambiarMes(1)"
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
        <ChevronRightIcon class="text-xs text-gray-500 size-[1em]" />
      </button>
      <GBadge color="default" class="text-xs font-mono">{{ periodoActual }}</GBadge>
    </div>

    <div v-if="!filas.length"
      class="rounded-xl border border-dashed p-8 text-center" style="border-color:#915BD840">
      <InboxIcon class="text-2xl mb-2 block size-[1em]" style="color:#c4b5fd" />
      <p class="text-sm text-gray-500">No hay proyectos guardados para este período.</p>
      <p class="text-xs text-gray-400 mt-1">Operaciones aún no guardó la selección del mes.</p>
    </div>
    <div v-else class="rounded-xl border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse" style="min-width:680px">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Proyecto</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Mes / Año</th>
              <th class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Canon a Facturar</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Indexación aplicada</th>
              <th class="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filas" :key="fila.id"
              class="border-b border-gray-50 hover:bg-gray-50/50">
              <td class="px-4 py-2.5 font-medium" style="color:var(--color-unergy-deep)">{{ fila.proyecto }}</td>
              <td class="px-4 py-2.5 text-xs text-gray-500">{{ periodoLabel }}</td>
              <td class="px-4 py-2.5 text-right font-semibold tabular-nums" style="color:#7c3aed">
                {{ formatCOP(fila.canon_a_facturar) }}
              </td>
              <td class="px-4 py-2.5 text-xs text-gray-400"
                style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                :title="fila.historial_texto">
                {{ fila.historial_texto }}
              </td>
              <td class="px-4 py-2.5 text-center">
                <button v-if="!facturadoActual[fila.id]" type="button"
                  class="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-green-50"
                  style="border-color:#15803d;color:#15803d"
                  @click="toggleFacturado(fila.id)">
                  Marcar facturado
                </button>
                <span v-else
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80"
                  style="background:#dcfce7;color:#166534"
                  @click="toggleFacturado(fila.id)">
                  <CheckIcon class="text-[10px] size-[1em]" />FACTURADO
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Soporte del período ─────────────────────────────────────────────── -->
    <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#E5E2EC">
      <div class="flex items-center justify-between px-4 py-2.5 border-b"
        style="border-color:#F3F0FA;background:#FDFCFF">
        <div class="flex items-center gap-2">
          <FileTextIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
          <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Soporte del período</span>
          <GBadge color="default" class="text-xs font-mono">{{ periodoLabel }}</GBadge>
        </div>
        <span v-if="soporte.enlace"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style="background:#dcfce7;color:#166534">
          <CheckIcon class="text-[10px] size-[1em]" />Registrado
        </span>
        <span v-else class="text-xs text-gray-400">Pendiente</span>
      </div>
      <div class="px-4 py-3 space-y-2">
        <div v-if="soporte.enlace"
          class="flex items-center gap-3 p-2.5 rounded-lg" style="background:#f0fdf4;border:1px solid #bbf7d0">
          <ExternalLinkIcon class="text-sm flex-shrink-0 size-[1em]" style="color:#16a34a" />
          <a :href="soporte.enlace" target="_blank" rel="noopener"
            class="flex-1 text-xs font-medium truncate hover:underline" style="color:#15803d">
            {{ soporte.enlace }}
          </a>
          <button type="button" @click="soporte.enlace = ''; persistSoporte()"
            class="text-gray-400 hover:text-red-500 text-xs">
            <XIcon class="size-[1em]" />
          </button>
        </div>
        <p class="text-xs text-gray-500">{{ soporte.enlace ? 'Reemplazar enlace:' : 'Enlace al soporte (Drive, etc.):' }}</p>
        <div class="flex gap-2">
          <input type="url" v-model="nuevoEnlace"
            placeholder="https://drive.google.com/…"
            class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200" />
          <button type="button"
            :disabled="!nuevoEnlace.startsWith('http')"
            class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style="background:var(--color-unergy-purple);color:#fff;border:none"
            :style="!nuevoEnlace.startsWith('http') ? 'opacity:0.4;cursor:not-allowed' : 'cursor:pointer'"
            @click="guardarSoporte">
            <SaveIcon class="text-xs size-[1em]" />Guardar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { ArriendosCalculoService } from '~/features/finanzas/services/arriendos-calculo'
import { formatCOP } from '~/utils/currency'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, FileTextIcon, InboxIcon, SaveIcon, XIcon } from '@lucide/vue'

const arriendosCalculoService = new ArriendosCalculoService()
const hoy           = new Date()
const periodoOffset = ref(0)

const periodoActual = computed(() => {
  const d    = new Date(hoy.getFullYear(), hoy.getMonth() + periodoOffset.value, 1)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
})

const periodoLabel = computed(() => {
  const [yyyy, mm] = periodoActual.value.split('-')
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${MESES[parseInt(mm) - 1]} ${yyyy}`
})

function cambiarMes(delta) { periodoOffset.value += delta }

// ── Datos (API) — solo lectura de lo que Operaciones incluyó ────────────────────
const filas = ref([])

async function cargarDatos() {
  try {
    const data = await arriendosCalculoService.obtenerCalculo(periodoActual.value)
    filas.value = data.filas.filter(f => f.incluido && f.habilitado)
  } catch {
    filas.value = []
  }
}

const facturadoActual = computed(() => {
  const m = {}; filas.value.forEach(f => { m[f.id] = f.facturado }); return m
})

async function toggleFacturado(id) {
  try {
    await arriendosCalculoService.marcarFacturado(periodoActual.value, id)
    await cargarDatos()
  } catch {}
}

// ── Soporte del período (sigue en localStorage; no hay endpoint backend) ─────────
const SOPO_STORAGE_KEY = 'arriendos_soportes'
const soporteStore = reactive({})
const soporte      = computed(() => soporteStore[periodoActual.value] || { enlace: '' })
const nuevoEnlace  = ref('')

function cargarSoporte() {
  try {
    const raw = localStorage.getItem(SOPO_STORAGE_KEY)
    if (raw) Object.assign(soporteStore, JSON.parse(raw))
  } catch {}
}

function guardarSoporte() {
  if (!nuevoEnlace.value.startsWith('http')) return
  if (!soporteStore[periodoActual.value]) soporteStore[periodoActual.value] = {}
  soporteStore[periodoActual.value].enlace = nuevoEnlace.value
  nuevoEnlace.value = ''
  persistSoporte()
}

function persistSoporte() {
  try { localStorage.setItem(SOPO_STORAGE_KEY, JSON.stringify(soporteStore)) } catch {}
}

watch(periodoActual, () => { nuevoEnlace.value = ''; cargarDatos() })
onMounted(() => {
  cargarSoporte()
  cargarDatos()
})
</script>
