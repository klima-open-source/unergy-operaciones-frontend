<template>
  <div class="space-y-4 pt-3">

    <div class="flex items-center gap-3">
      <button type="button" @click="cambiarMes(-1)"
        class="size-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted/50">
        <ChevronLeftIcon class="text-muted-foreground size-3" />
      </button>
      <span class="text-sm font-semibold text-unergy-deep text-center">
        {{ periodoLabel }}
      </span>
      <button type="button" @click="cambiarMes(1)"
        class="size-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted/50">
        <ChevronRightIcon class="text-muted-foreground size-3" />
      </button>
      <GBadge color="default" class="text-xs font-mono">{{ periodoActual }}</GBadge>
    </div>

    <div v-if="!filas.length"
      class="rounded-xl border border-dashed p-8 text-center border-primary/30">
      <InboxIcon class="mb-2 block size-6 text-primary" />
      <p class="text-sm text-muted-foreground">No hay proyectos guardados para este período.</p>
      <p class="text-xs text-muted-foreground mt-1">Operaciones aún no guardó la selección del mes.</p>
    </div>
    <div v-else class="rounded-xl border border-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-muted/50 border-b border-border">
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Proyecto</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Mes / Año</th>
              <th class="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Canon a Facturar</th>
              <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Indexación aplicada</th>
              <th class="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filas" :key="fila.id"
              class="border-b border-border hover:bg-muted/50">
              <td class="px-4 py-2.5 font-medium text-unergy-deep">{{ fila.proyecto }}</td>
              <td class="px-4 py-2.5 text-xs text-muted-foreground">{{ periodoLabel }}</td>
              <td class="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                {{ formatCOP(fila.canon_a_facturar) }}
              </td>
              <td class="px-4 py-2.5 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                :title="fila.historial_texto">
                {{ fila.historial_texto }}
              </td>
              <td class="px-4 py-2.5 text-center">
                <button v-if="!facturadoActual[fila.id]" type="button"
                  class="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-success/10 border-success text-success"
                  @click="toggleFacturado(fila.id)">
                  Marcar facturado
                </button>
                <span v-else
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 bg-success/10 text-success"
                  @click="toggleFacturado(fila.id)">
                  <CheckIcon class="text-xs size-4" />FACTURADO
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Soporte del período ─────────────────────────────────────────────── -->
    <div class="rounded-xl border bg-white overflow-hidden border-border">
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-border bg-primary/10"
        >
        <div class="flex items-center gap-2">
          <FileTextIcon class="size-3 text-unergy-purple" />
          <span class="text-sm font-semibold text-unergy-deep">Soporte del período</span>
          <GBadge color="default" class="text-xs font-mono">{{ periodoLabel }}</GBadge>
        </div>
        <span v-if="soporte.enlace"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success"
          >
          <CheckIcon class="text-xs size-4" />Registrado
        </span>
        <span v-else class="text-xs text-muted-foreground">Pendiente</span>
      </div>
      <div class="px-4 py-3 space-y-2">
        <div v-if="soporte.enlace"
          class="flex items-center gap-3 p-2.5 rounded-lg bg-success/10 border border-success/30">
          <ExternalLinkIcon class="flex-shrink-0 size-4 text-success" />
          <a :href="soporte.enlace" target="_blank" rel="noopener"
            class="flex-1 text-xs font-medium truncate hover:underline text-success">
            {{ soporte.enlace }}
          </a>
          <button type="button" @click="soporte.enlace = ''; persistSoporte()"
            class="text-muted-foreground hover:text-destructive text-xs">
            <XIcon class="size-4" />
          </button>
        </div>
        <p class="text-xs text-muted-foreground">{{ soporte.enlace ? 'Reemplazar enlace:' : 'Enlace al soporte (Drive, etc.):' }}</p>
        <div class="flex gap-2">
          <input type="url" v-model="nuevoEnlace"
            placeholder="https://drive.google.com/…"
            class="flex-1 text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <button type="button"
            :disabled="!nuevoEnlace.startsWith('http')"
            class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all bg-unergy-purple text-primary-foreground border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            @click="guardarSoporte">
            <SaveIcon class="size-3" />Guardar
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
