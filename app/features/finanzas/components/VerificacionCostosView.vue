<template>
  <div class="space-y-4">
    <PageHeader title="Verificación de costos"
                subtitle="Conceptos que recibe cada proyecto y su AC Power · GD y minigranjas en operación" />

    <!-- Filtros -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" placeholder="Proyecto…" class="w-64" />
        </IconField>
      </div>
      <div class="flex-1" />
      <Button size="small" text rounded :loading="loading" v-tooltip.left="'Recargar'" @click="cargar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
      <div class="text-xs text-gray-400 self-center">
        {{ filtrados.length }} proyecto{{ filtrados.length === 1 ? '' : 's' }}
      </div>
    </div>

    <!-- Tarjetas: AC Power sumado de los proyectos que reciben cada grupo de
         conceptos. Es el denominador de la prorrata que pide el reparto de XM,
         por eso manda el total en kW y no el conteo de proyectos. -->
    <div v-if="!loading && !error" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3" style="border-color:#ECE7F2">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
             style="background:#10B98118">
          <ZapIcon class="text-lg size-[1em]" style="color:#10B981" />
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500">AC Power generador</p>
          <p class="text-xl font-bold" style="color:var(--color-unergy-deep)">
            {{ fmtNum(generador.acPower) }}
            <span class="text-xs font-normal text-gray-400">kW</span>
          </p>
          <p class="text-[11px] text-gray-400">
            {{ generador.total }} proyecto{{ generador.total === 1 ? '' : 's' }} en la API
            <span v-if="generador.sinAcPower" style="color:#B45309">
              · {{ generador.sinAcPower }} sin AC Power
            </span>
          </p>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3" style="border-color:#ECE7F2">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
             style="background:#915BD818">
          <BriefcaseIcon class="text-lg size-[1em]" style="color:var(--color-unergy-purple)" />
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-500">AC Power comercializador</p>
          <p class="text-xl font-bold" style="color:var(--color-unergy-deep)">
            {{ fmtNum(comercializador.acPower) }}
            <span class="text-xs font-normal text-gray-400">kW</span>
          </p>
          <p class="text-[11px] text-gray-400">
            {{ comercializador.total }} proyecto{{ comercializador.total === 1 ? '' : 's' }} en la API
            <span v-if="comercializador.sinAcPower" style="color:#B45309">
              · {{ comercializador.sinAcPower }} sin AC Power
            </span>
          </p>
        </div>
      </div>
    </div>

    <!-- Aviso: la API cobra proyectos que esta base no reconoce por tópico -->
    <div v-if="!loading && topicosSinCruce.length" class="rounded-lg px-3 py-2 text-xs"
         style="background:#FFF8E6; border:1px solid #F5E3B3; color:#7A5C00">
      <TriangleAlertIcon class="mr-1 size-[1em]" />
      <strong>{{ topicosSinCruce.length }}</strong> proyecto{{ topicosSinCruce.length === 1 ? '' : 's' }}
      de la API de Liquidaciones no cruza{{ topicosSinCruce.length === 1 ? '' : 'n' }} con esta base por su
      código base: <span class="font-mono">{{ topicosSinCruce.join(', ') }}</span>.
      Sí cuentan en el AC Power total, pero no aparecen en la tabla de abajo.
    </div>

    <!-- Aviso: el reparto falla sin ac_power -->
    <div v-if="!loading && sinAcPower" class="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
         style="background:#FFF8E6; border:1px solid #F5E3B3; color:#7A5C00">
      <TriangleAlertIcon class="size-[1em]" />
      {{ sinAcPower }} proyecto{{ sinAcPower === 1 ? '' : 's' }} sin AC Power. El reparto de costos de XM
      lo usa como divisor de la prorrata y falla si falta.
    </div>

    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-10 flex justify-center">
      <LoaderCircleIcon class="text-2xl text-gray-400 size-[1em] animate-spin" />
    </div>

    <div v-else-if="error" class="bg-white rounded-xl shadow-sm border p-6 text-center" style="border-color:#ECE7F2">
      <TriangleAlertIcon class="text-2xl mb-2 block size-[1em]" style="color:#D97706" />
      <p class="text-sm text-gray-600">{{ error }}</p>
      <Button label="Reintentar" size="small" outlined class="mt-3" @click="cargar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Proyecto</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:170px">Costos generador</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:190px">Costos comercializador</th>
              <th class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:130px">AC Power (kW)</th>
              <th class="px-4 py-2.5" style="width:56px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtrados" :key="row.proyecto_id"
                class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100">
              <td class="px-4 py-2">
                <span class="text-gray-800">{{ row.nombre_comercial }}</span>
                <span v-if="!row.nombre_topico" class="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                      style="background:#FEF3C7; color:#92400E"
                      title="Sin código base (API ID Unergy): no se puede identificar en la API de Liquidaciones">
                  sin tópico
                </span>
              </td>
              <td class="px-4 py-2 text-center">
                <GBadge v-if="row.from_generator === true" color="success" class="text-[10px]">Sí</GBadge>
                <GBadge v-else-if="row.from_generator === false" color="default" class="text-[10px]">No</GBadge>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-4 py-2 text-center">
                <GBadge v-if="row.from_commercializer === true" color="success" class="text-[10px]">Sí</GBadge>
                <GBadge v-else-if="row.from_commercializer === false" color="default" class="text-[10px]">No</GBadge>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-4 py-2 text-right font-mono text-xs"
                  :class="{ 'text-red-600 font-semibold': !row.ac_power && row.nombre_topico }">
                {{ fmtNum(row.ac_power) }}
              </td>
              <td class="px-4 py-2">
                <div class="flex justify-end">
                  <Button text rounded size="small" severity="info" :disabled="!row.nombre_topico" v-tooltip.left="row.nombre_topico ? 'Editar' : 'Falta el código base del proyecto'" @click="abrirEditar(row)">
                    <template #icon><PencilIcon class="size-[1em]" /></template>
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtrados.length">
              <td colspan="5" class="px-4 py-12 text-center text-sm text-gray-400">
                <SquareCheckIcon class="text-2xl mb-2 block text-gray-300 size-[1em]" />
                No hay proyectos GD/minigranja en operación.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Dialog: editar (va a la API de Liquidaciones) -->
    <Dialog v-model:visible="formVisible" header="Editar verificación de costos" modal class="w-full max-w-md">
      <form @submit.prevent="guardar" class="space-y-4 pt-1">
        <div class="text-sm font-medium text-gray-700">{{ f.nombre_comercial }}</div>
        <p class="text-[11px] text-gray-400 -mt-2">
          Se guarda en la API de Liquidaciones (tópico <b>{{ f.nombre_topico }}</b>).
        </p>

        <div class="flex items-center justify-between rounded-lg border px-3 py-2" style="border-color:#ECE7F2">
          <div>
            <div class="text-sm text-gray-700">Costos generador</div>
            <div class="text-[11px] text-gray-400">Recibe los conceptos del agente generador</div>
          </div>
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="f.from_generator" />
            <span class="text-xs text-gray-500 w-6">{{ f.from_generator ? 'Sí' : 'No' }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg border px-3 py-2" style="border-color:#ECE7F2">
          <div>
            <div class="text-sm text-gray-700">Costos comercializador</div>
            <div class="text-[11px] text-gray-400">Recibe los conceptos del agente comercializador</div>
          </div>
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="f.from_commercializer" />
            <span class="text-xs text-gray-500 w-6">{{ f.from_commercializer ? 'Sí' : 'No' }}</span>
          </div>
        </div>

        <div>
          <label class="field-label">AC Power (kW)</label>
          <InputNumber v-model="f.ac_power" :maxFractionDigits="2" class="w-full" placeholder="ej: 996" />
          <small class="text-[11px] text-gray-400">Divisor de la prorrata al repartir los costos de XM.</small>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" label="Cancelar" severity="secondary" @click="formVisible = false" />
          <Button type="submit" label="Guardar" :loading="guardando">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ToggleSwitch from 'primevue/toggleswitch'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import { formatearNombreProyecto } from '~/features/proyectos/components/proyectosUi'

const liquidacionesApi = new LiquidacionesApiService()
import { BriefcaseIcon, CheckIcon, LoaderCircleIcon, PencilIcon, RefreshCwIcon, SearchIcon, SquareCheckIcon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'


const TIPOS_INCLUIDOS = ['gd', 'minigranja']
const ESTADO_OPERATIVA = 'en_operacion'

const q = ref('')
const loading = ref(true)
const error = ref(null)
const filas = ref([])

const filtrados = computed(() => {
  const term = q.value.trim().toLowerCase()
  return filas.value.filter(f => !term || f.nombre_comercial.toLowerCase().includes(term))
})

// Cuántos de los proyectos listados reciben cada grupo de conceptos.
// AC Power sumado del grupo, más cuántos proyectos lo componen y cuántos de
// ellos no tienen el dato: un proyecto sin AC Power no suma pero sí debería,
// así que el total se queda corto mientras falte.
// Los totales NO se suman de la tabla: la tabla solo trae los proyectos que
// cruzan por tópico con esta base y además son GD/minigranja en operación, y el
// AC Power total es el divisor de la prorrata del reparto. Si un proyecto que la
// API cobra queda fuera del divisor, a todos los demás les toca más costo del
// que les corresponde. Por eso el backend lo calcula sobre el universo de la API.
const totalesApi = ref(null)
const topicosSinCruce = ref([])

const generador = computed(() => ({
  total: totalesApi.value?.generador?.proyectos ?? 0,
  acPower: totalesApi.value?.generador?.ac_power ?? 0,
  sinAcPower: totalesApi.value?.generador?.sin_ac_power ?? 0,
}))
const comercializador = computed(() => ({
  total: totalesApi.value?.comercializador?.proyectos ?? 0,
  acPower: totalesApi.value?.comercializador?.ac_power ?? 0,
  sinAcPower: totalesApi.value?.comercializador?.sin_ac_power ?? 0,
}))

// Sin ac_power el reparto de costos de XM falla: es el divisor de la prorrata.
const sinAcPower = computed(
  () => filas.value.filter(f => f.nombre_topico && !f.ac_power).length
)

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)
}

// ── Edición (PATCH a la API de Liquidaciones) ────────────────────────────────
const formVisible = ref(false)
const guardando = ref(false)
const f = reactive({
  proyecto_id: null, nombre_comercial: '', nombre_topico: '',
  from_generator: false, from_commercializer: false, ac_power: null,
})

function abrirEditar(row) {
  Object.assign(f, {
    proyecto_id: row.proyecto_id,
    nombre_comercial: row.nombre_comercial,
    nombre_topico: row.nombre_topico,
    from_generator: row.from_generator === true,
    from_commercializer: row.from_commercializer === true,
    ac_power: row.ac_power ?? null,
  })
  formVisible.value = true
}

async function guardar() {
  guardando.value = true
  try {
    await liquidacionesApi.actualizarConfigProyecto(f.proyecto_id, {
      from_generator: f.from_generator,
      from_commercializer: f.from_commercializer,
      ac_power: f.ac_power,
    })
    formVisible.value = false
    await cargar()
    toast.success('Guardado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'No se pudo guardar', duration: 4000 })
  } finally {
    guardando.value = false
  }
}

// ── Carga ─────────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  error.value = null
  try {
    const [data, totales] = await Promise.all([
      liquidacionesApi.listarProyectos(),
      liquidacionesApi.obtenerAcPower().catch(() => null),
    ])
    totalesApi.value = totales
    topicosSinCruce.value = totales?.topicos_sin_cruce || []
    filas.value = (data || [])
      .filter(r => TIPOS_INCLUIDOS.includes(r.tipo_proyecto) && r.estado === ESTADO_OPERATIVA)
      .map(r => ({ ...r, nombre_comercial: formatearNombreProyecto(r.nombre_comercial) }))
      .sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial))
  } catch (e) {
    error.value = e.data?.detail || 'No se pudo cargar la configuración de liquidaciones.'
    filas.value = []
  } finally {
    loading.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
