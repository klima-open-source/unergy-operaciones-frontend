<template>
  <div class="space-y-4">
    <PageHeader title="IDs proyectos"
                subtitle="Códigos SIC de liquidaciones e IDs de Quoia · GD y minigranjas en operación" />

    <!-- Filtro de búsqueda -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border border-border">
      <div>
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-4" /></InputIcon>
          <InputText v-model="q" placeholder="Nombre del proyecto…" />
        </IconField>
      </div>
      <div class="flex-1" />
      <Button size="small" text rounded :loading="loading" v-tooltip.left="'Recargar'" @click="cargar">
        <template #icon><RefreshCwIcon class="size-4" /></template>
      </Button>
      <div class="text-xs text-muted-foreground self-center">
        {{ filtrados.length }} proyecto{{ filtrados.length === 1 ? '' : 's' }}
        <span v-if="resumen.completos" class="text-success">· {{ resumen.completos }} completos</span>
        <span v-if="resumen.pendientes" class="text-warning">· {{ resumen.pendientes }} pendientes</span>
        <span v-if="resumen.sinTopico">· {{ resumen.sinTopico }} sin tópico</span>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-10 flex justify-center">
      <LoaderCircleIcon class="text-muted-foreground size-6 animate-spin" />
    </div>

    <div v-else-if="errorApi" class="bg-white rounded-xl shadow-sm border p-6 text-center border-border">
      <TriangleAlertIcon class="mb-2 block size-6 text-warning" />
      <p class="text-sm text-muted-foreground">{{ errorApi }}</p>
      <Button label="Reintentar" size="small" outlined class="mt-3" @click="cargar">
        <template #icon><RefreshCwIcon class="size-4" /></template>
      </Button>
    </div>

    <template v-else>
      <div v-if="!filtrados.length"
           class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-muted-foreground">
        No se encontraron proyectos GD/minigranja en operación.
      </div>

      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden border border-border">
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-muted/50 border-b border-border">
                <th rowspan="2" class="sticky left-0 z-20 border-r border-border bg-muted text-left px-4 py-2.5 font-medium text-muted-foreground text-xs
                                        uppercase tracking-wide align-bottom">Proyecto</th>
                <th colspan="2" class="text-center px-3 py-2 font-semibold text-xs uppercase tracking-wide text-foreground border-l border-border"
                    >ID liquidaciones</th>
                <th colspan="3" class="text-center px-3 py-2 font-semibold text-xs uppercase tracking-wide text-primary border-l border-border"
                    >ID Quoia</th>
                <th rowspan="2" class="px-3 py-2.5"></th>
              </tr>
              <tr class="bg-muted/50 border-b border-border">
                <th v-for="col in COLUMNAS" :key="col.key"
                    class="text-center px-3 py-2 font-medium text-muted-foreground text-xs whitespace-nowrap"
                    :class="{ 'border-l border-border': col.groupStart }">
                  {{ col.short }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, i) in filtrados" :key="row.proyecto_id">
              <tr v-if="abreGrupo(row, i)" class="border-t border-border">
                <td :colspan="COLUMNAS.length + 2"
                    class="sticky left-0 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide bg-muted text-muted-foreground"
                    >
                  {{ etiquetaGrupo(row) }}
                </td>
              </tr>
              <tr class="border-t border-border hover:bg-muted/50 transition-colors duration-100 group">
                <td class="sticky left-0 z-10 border-r border-border bg-card px-4 py-2 group-hover:bg-muted">
                  <span class="text-sm text-foreground font-medium">{{ row.nombre_comercial }}</span>
                  <span v-if="!row.nombre_topico" class="ml-2 text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning"
                        title="Sin código base (API ID Unergy): no se puede identificar en la API de Liquidaciones">
                    sin tópico
                  </span>
                </td>
                <td v-for="col in COLUMNAS" :key="col.key"
                    class="px-3 py-2 text-center cursor-pointer hover:bg-primary/10"
                    :class="{ 'border-l border-border': col.groupStart }"
                    @click="irAlDetalle(row.proyecto_id, col.tab)"
                    v-tooltip.bottom="tieneValor(row[col.key]) ? String(row[col.key]) : 'Sin registrar · clic para abrir el proyecto'">
                  <CircleCheckIcon class="size-4 text-success" v-if="tieneValor(row[col.key])" />
                  <span v-else class="text-muted-foreground/50">—</span>
                </td>
                <td class="px-3 py-2">
                  <Button text rounded size="small" severity="info" :disabled="!row.nombre_topico" v-tooltip.left="row.nombre_topico ? 'Editar códigos SIC' : 'Falta el código base del proyecto'" @click="abrirEditar(row)">
                    <template #icon><PencilIcon class="size-4" /></template>
                  </Button>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Dialog: editar códigos de liquidaciones (van a la API de Liquidaciones) -->
    <Dialog v-model:visible="formVisible" header="Editar códigos SIC" modal class="w-full max-w-md">
      <form @submit.prevent="guardar" class="space-y-4 pt-1">
        <div class="text-sm font-medium text-foreground">{{ f.nombre_comercial }}</div>
        <p class="text-xs text-muted-foreground -mt-2">
          Se guardan en la API de Liquidaciones (tópico <b>{{ f.nombre_topico }}</b>).
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-muted-foreground">SIC generación</label>
            <InputText v-model="f.sic_gen" class="w-full" placeholder="ej: 3A44" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-muted-foreground">SIC consumo</label>
            <InputText v-model="f.sic_con" class="w-full" placeholder="ej: 3A3P" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" label="Cancelar" severity="secondary" @click="formVisible = false" />
          <Button type="submit" label="Guardar" :loading="guardando">
            <template #icon><CheckIcon class="size-4" /></template>
          </Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import { formatearNombreProyecto } from '~/features/proyectos/components/proyectosUi'
import { entraEnConfiguracion } from '~/features/finanzas/utils/proyectosLiquidaciones'
import { CheckIcon, CircleCheckIcon, LoaderCircleIcon, PencilIcon, RefreshCwIcon, SearchIcon, TriangleAlertIcon } from '@lucide/vue'

const router = useRouter()
const liquidacionesApi = new LiquidacionesApiService()

// Solo GD y minigranjas en operación.
// Todo lo que esté en operación salvo autoconsumo: ver `entraEnConfiguracion`.

// Los códigos SIC viven en la API de Liquidaciones; los IDs de Quoia en esta base.
const COLUMNAS = [
  { key: 'sic_gen', short: 'SIC gen.', groupStart: true,  tab: 'id-liquidaciones' },
  { key: 'sic_con', short: 'SIC con.', groupStart: false, tab: 'id-liquidaciones' },
  { key: 'quoia_reporte_generacion_id', short: 'Rep. Gen.',    groupStart: true,  tab: 'id-quoia' },
  { key: 'quoia_reporte_consumo_id',    short: 'Rep. Consumo', groupStart: false, tab: 'id-quoia' },
  { key: 'quoia_nodo_id',               short: 'Nodo',         groupStart: false, tab: 'id-quoia' },
]

const loading = ref(true)
const errorApi = ref(null)
const filas = ref([])
const q = ref('')

function tieneValor(v) {
  return v !== null && v !== undefined && v !== ''
}

function irAlDetalle(id, tab = 'id-liquidaciones') {
  router.push({ path: `/proyectos/${id}`, query: { edit: 'true', tab } })
}

// Orden por completitud: primero lo que ya está listo, al fondo lo que falta.
// Las que no tienen tópico van de últimas porque sin él la API de Liquidaciones
// no las puede identificar: sus columnas SIC no se pueden llenar desde aquí.
const Completitud = Object.freeze({
  COMPLETO: 0,
  PARCIAL: 1,
  SIN_IDS: 2,
  SIN_TOPICO: 3,
})

function completitud(fila) {
  if (!fila.nombre_topico) return Completitud.SIN_TOPICO
  const puestos = COLUMNAS.filter(c => tieneValor(fila[c.key])).length
  if (puestos === COLUMNAS.length) return Completitud.COMPLETO
  return puestos ? Completitud.PARCIAL : Completitud.SIN_IDS
}

const filtrados = computed(() => {
  const term = q.value.trim().toLowerCase()
  return filas.value
    .filter(f => !term || f.nombre_comercial.toLowerCase().includes(term))
    .sort((a, b) =>
      completitud(a) - completitud(b) ||
      a.nombre_comercial.localeCompare(b.nombre_comercial))
})

// Cuántas quedaron en cada grupo, para no tener que contarlas a ojo en la tabla.
const resumen = computed(() => {
  const filas = filtrados.value
  return {
    completos: filas.filter(f => completitud(f) === Completitud.COMPLETO).length,
    pendientes: filas.filter(f => [Completitud.PARCIAL, Completitud.SIN_IDS].includes(completitud(f))).length,
    sinTopico: filas.filter(f => completitud(f) === Completitud.SIN_TOPICO).length,
  }
})

/** Primera fila de un grupo: sirve para dibujar el separador en la tabla. */
function abreGrupo(fila, indice) {
  if (indice === 0) return false
  return completitud(fila) !== completitud(filtrados.value[indice - 1])
}

const ETIQUETA_GRUPO = {
  [Completitud.COMPLETO]: 'Completos',
  [Completitud.PARCIAL]: 'Con IDs pendientes',
  [Completitud.SIN_IDS]: 'Sin ningún ID registrado',
  [Completitud.SIN_TOPICO]: 'Sin tópico · no se pueden identificar en la API de Liquidaciones',
}

function etiquetaGrupo(fila) {
  return ETIQUETA_GRUPO[completitud(fila)]
}

// ── Edición (va a la API de Liquidaciones vía nuestro backend) ────────────────
const formVisible = ref(false)
const guardando = ref(false)
const f = reactive({ proyecto_id: null, nombre_comercial: '', nombre_topico: '', sic_gen: '', sic_con: '' })

function abrirEditar(row) {
  Object.assign(f, {
    proyecto_id: row.proyecto_id,
    nombre_comercial: row.nombre_comercial,
    nombre_topico: row.nombre_topico,
    sic_gen: row.sic_gen ?? '',
    sic_con: row.sic_con ?? '',
  })
  formVisible.value = true
}

async function guardar() {
  guardando.value = true
  try {
    await liquidacionesApi.actualizarConfigProyecto(f.proyecto_id, {
      sic_gen: f.sic_gen || null,
      sic_con: f.sic_con || null,
    })
    formVisible.value = false
    await cargar()
    toast.success('Códigos guardados', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'No se pudo guardar', duration: 4000 })
  } finally {
    guardando.value = false
  }
}

// ── Carga ─────────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  errorApi.value = null
  try {
    const liq = await liquidacionesApi.listarProyectos()
    filas.value = (liq || [])
      .filter(entraEnConfiguracion)
      .map(r => {
        // Los ids de Quoia son de los subproyectos, no del proyecto -- viven
        // solo en la API de Liquidaciones (ver auditoría 2026-08-31: la
        // columna equivalente en esta base se eliminó por quedar siempre
        // vacía y desconectada de este dato real).
        const sub = (r.subproyectos || [])
        const deLaApi = campo => sub.map(s => s[campo]).find(v => v !== null && v !== '') ?? null
        return {
          ...r,
          nombre_comercial: formatearNombreProyecto(r.nombre_comercial),
          quoia_reporte_generacion_id: deLaApi('quoia_report_gen_id'),
          quoia_reporte_consumo_id: deLaApi('quoia_report_con_id'),
          quoia_nodo_id: deLaApi('quoia_node_id'),
          // Cuántos subproyectos tiene: con más de uno, la columna muestra el
          // primero que tenga valor y hay que abrir el detalle para verlos todos.
          subproyectos_n: sub.length,
        }
      })
      .sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial))
  } catch (e) {
    errorApi.value = e.data?.detail || 'No se pudo cargar la configuración de liquidaciones.'
    filas.value = []
  } finally {
    loading.value = false
  }
}

onMounted(cargar)
</script>
