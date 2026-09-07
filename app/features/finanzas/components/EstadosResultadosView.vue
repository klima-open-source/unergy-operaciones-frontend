<template>
  <div class="space-y-4">
    <PageHeader title="Estados de resultados"
                subtitle="Archivos generados en Drive · estados de resultados y cruce de facturas">
      <template #actions>
        <Button label="Crear cruce facturas" size="small" outlined @click="abrirCrudo">
          <template #icon><FileIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Generar estado de resultados" size="small" @click="abrirEstado">
          <template #icon><ChartLineIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Documento</label>
        <div class="er-toggle">
          <button v-for="t in TIPOS" :key="t.key" class="er-toggle-btn"
                  :class="{ 'er-toggle-btn--on': tipo === t.key }" @click="tipo = t.key">
            {{ t.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="field-label">Período</label>
        <Select v-model="periodoSel" :options="opcionesPeriodo" optionLabel="label" optionValue="value"
                class="w-44" :loading="cargandoPeriodos" />
      </div>

      <!-- La versión (txf, tx3…tx8) solo está en el nombre del cruce de facturas;
           los estados de resultados no la llevan, así que el filtro no aplica ahí. -->
      <div v-if="versiones.length">
        <label class="field-label">Versión</label>
        <Select v-model="versionSel" :options="opcionesVersion" optionLabel="label" optionValue="value"
                class="w-32" />
      </div>

      <div>
        <label class="field-label">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" placeholder="Cliente o proyecto…" class="w-64" />
        </IconField>
      </div>

      <div class="flex-1" />

      <Button label="Descargar ZIP" size="small" outlined :loading="descargandoZip" :disabled="!archivos.length" v-tooltip.top="'Descarga en un ZIP todo lo que coincide con los filtros'" @click="descargarZip">
        <template #icon><DownloadIcon class="size-[1em]" /></template>
      </Button>
      <Button size="small" text rounded :loading="loading" v-tooltip.left="'Recargar desde Drive'" @click="cargar(true)">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
      <div class="text-xs text-gray-400 self-center">
        {{ filas.length }} archivo{{ filas.length === 1 ? '' : 's' }}
      </div>
    </div>

    <!-- Aviso de listado recortado -->
    <div v-if="truncado" class="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
         style="background:#FFF8E6; border:1px solid #F5E3B3; color:#7A5C00">
      <TriangleAlertIcon class="size-[1em]" />
      Se muestran los {{ archivos.length }} más recientes de {{ totalFiltrados }}. Filtra por período para ver el resto.
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">
      <div v-if="loading" class="p-10 flex justify-center">
        <LoaderCircleIcon class="text-2xl text-gray-400 size-[1em] animate-spin" />
      </div>

      <div v-else-if="error" class="p-10 text-center">
        <CircleXIcon class="text-2xl mb-2 block size-[1em]" style="color:#DC2626" />
        <p class="text-sm text-gray-600">{{ error }}</p>
        <Button label="Reintentar" size="small" outlined class="mt-3" @click="cargar(true)">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Documento</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:110px">Período</th>
              <th v-if="tipo === 'cruce_facturas'"
                  class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:90px">Versión</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:120px">Modificado</th>
              <th class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide" style="width:90px">Tamaño</th>
              <th class="px-4 py-2.5" style="width:70px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filas" :key="a.id"
                class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100">
              <td class="px-4 py-2">
                <FileSpreadsheetIcon class="mr-2 text-xs size-[1em]" style="color:#1D6F42" />
                <span :title="a.nombre">{{ a.descripcion || 'Cruce de facturas' }}</span>
                <span v-if="a.es_copia" class="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                      style="background:#F1EAF9; color:var(--color-unergy-purple-dark)" title="Duplicado creado en Drive">copia</span>
              </td>
              <td class="px-4 py-2 text-xs text-gray-500">{{ fmtPeriodo(a.mes, a.anio) }}</td>
              <td v-if="tipo === 'cruce_facturas'" class="px-4 py-2 text-xs font-mono uppercase">{{ a.version || '—' }}</td>
              <td class="px-4 py-2 text-xs text-gray-500">{{ fmtFecha(a.modificado) }}</td>
              <td class="px-4 py-2 text-right text-xs font-mono text-gray-500">{{ fmtTamano(a.tamano) }}</td>
              <td class="px-4 py-2">
                <div class="flex justify-end gap-1">
                  <Button text rounded size="small" severity="secondary" :loading="descargando === a.id" v-tooltip.left="'Descargar archivo'" @click="descargarUno(a)">
                    <template #icon><DownloadIcon class="size-[1em]" /></template>
                  </Button>
                  <a v-if="a.link" :href="a.link" target="_blank" rel="noopener">
                    <Button text rounded size="small" severity="info" v-tooltip.left="'Abrir en Drive'">
                      <template #icon><ExternalLinkIcon class="size-[1em]" /></template>
                    </Button>
                  </a>
                </div>
              </td>
            </tr>
            <tr v-if="!filas.length">
              <td :colspan="tipo === 'cruce_facturas' ? 6 : 5" class="px-4 py-12 text-center text-sm text-gray-400">
                <FolderOpenIcon class="text-2xl mb-2 block text-gray-300 size-[1em]" />
                {{ q ? 'Ningún archivo coincide con la búsqueda.' : 'No hay archivos para este período.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Dialog: Generar estado de resultados -->
    <Dialog v-model:visible="estadoVisible" header="Generar estado de resultados" modal class="w-full max-w-md">
      <form @submit.prevent="generarEstado" class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Mes</label>
            <InputNumber v-model="er.mes" :min="1" :max="12" :useGrouping="false" class="w-full" placeholder="1–12" />
          </div>
          <div>
            <label class="field-label">Año</label>
            <InputNumber v-model="er.anio" :useGrouping="false" class="w-full" placeholder="ej: 2026" />
          </div>
        </div>
        <div>
          <label class="field-label">Versión</label>
          <Select v-model="er.version" :options="VERSIONES" class="w-full" />
        </div>
        <p class="text-[11px] text-gray-500">
          <InfoIcon class="mr-1 size-[1em]" />
          Genera el archivo para todos los proyectos del período y lo deja en Drive.
          Puede tardar varios minutos.
        </p>
        <p v-if="progresoEr" class="text-[11px] text-gray-500 flex items-center gap-2">
          <LoaderCircleIcon class="size-[1em] animate-spin" /> {{ progresoEr }}
        </p>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" label="Cancelar" severity="secondary" :disabled="generandoEr"
                  @click="estadoVisible = false" />
          <Button type="submit" label="Generar" :loading="generandoEr">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </form>
    </Dialog>

    <!-- Dialog: Crear cruce facturas -->
    <Dialog v-model:visible="crudoVisible" header="Crear cruce facturas" modal class="w-full max-w-md">
      <form @submit.prevent="generarCrudo" class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Mes</label>
            <InputNumber v-model="cr.mes" :min="1" :max="12" :useGrouping="false" class="w-full" placeholder="1–12" />
          </div>
          <div>
            <label class="field-label">Año</label>
            <InputNumber v-model="cr.anio" :useGrouping="false" class="w-full" placeholder="ej: 2026" />
          </div>
        </div>
        <div>
          <label class="field-label">Versión</label>
          <Select v-model="cr.version" :options="VERSIONES" class="w-full" />
        </div>
        <p class="text-[11px] text-gray-500">
          <InfoIcon class="mr-1 size-[1em]" />
          Verifica que lo repartido cuadre con la factura real de XM. Falla si falta cualquier insumo.
        </p>
        <p v-if="progresoCruce" class="text-[11px] text-gray-500 flex items-center gap-2">
          <LoaderCircleIcon class="size-[1em] animate-spin" /> {{ progresoCruce }}
        </p>
        <div class="flex justify-end gap-2 pt-1">
          <Button type="button" label="Cancelar" severity="secondary" :disabled="generandoCruce"
                  @click="crudoVisible = false" />
          <Button type="submit" label="Generar" :loading="generandoCruce">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { EstadosResultadosService } from '~/features/finanzas/services/estados-resultados'
import { VERSIONES, VERSION_INICIAL, AccionCiclo } from '~/features/liquidaciones/types'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import { ChartLineIcon, CheckIcon, CircleXIcon, DownloadIcon, ExternalLinkIcon, FileIcon, FileSpreadsheetIcon, FolderOpenIcon, InfoIcon, LoaderCircleIcon, RefreshCwIcon, SearchIcon, TriangleAlertIcon } from '@lucide/vue'

const liquidacionesApi = new LiquidacionesApiService()
const estadosResultadosService = new EstadosResultadosService()


const TIPOS = [
  { key: 'estado_resultados', label: 'Estados de resultados' },
  { key: 'cruce_facturas', label: 'Cruce de facturas' },
]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ── Listado de archivos de Drive ──────────────────────────────────────────────
// El filtro de tipo y período va al servidor (la carpeta tiene ~1.700 archivos);
// la búsqueda por texto se hace en cliente sobre el período ya cargado.
const TODOS = 'todos'
const LIMITE_TODOS = 1000

const tipo = ref('estado_resultados')
const periodoSel = ref(TODOS)
const versionSel = ref(TODOS)
const q = ref('')

const loading = ref(true)
const cargandoPeriodos = ref(true)
const error = ref('')
const archivos = ref([])
const periodos = ref([])
const versiones = ref([])
const totalFiltrados = ref(0)
const truncado = ref(false)

const opcionesPeriodo = computed(() => [
  { label: 'Todos los períodos', value: TODOS },
  ...periodos.value.map(p => ({
    label: `${fmtPeriodo(p.mes, p.anio)} (${p.total})`,
    value: `${p.anio}-${p.mes}`,
  })),
])
const opcionesVersion = computed(() => [
  { label: 'Todas', value: TODOS },
  ...versiones.value.map(v => ({ label: v.toUpperCase(), value: v })),
])

const filas = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return archivos.value
  return archivos.value.filter(a => (a.nombre || '').toLowerCase().includes(term))
})

function fmtPeriodo(mes, anio) {
  if (!mes || !anio) return '—'
  return `${MESES[mes - 1]} ${anio}`
}
function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTamano(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Filtros que van al servidor. El ZIP usa exactamente estos, así que trae lo
// mismo que la tabla (el texto se filtra en cliente y por eso no entra aquí).
function filtrosServidor() {
  const p = { tipo: tipo.value }
  if (periodoSel.value !== TODOS) {
    const [anio, mes] = String(periodoSel.value).split('-').map(Number)
    p.anio = anio
    p.mes = mes
  }
  if (versionSel.value !== TODOS) p.version = versionSel.value
  return p
}

async function cargar(refrescar = false) {
  loading.value = true
  error.value = ''
  try {
    const params = { ...filtrosServidor(), refrescar }
    if (periodoSel.value === TODOS) params.limite = LIMITE_TODOS
    const data = await estadosResultadosService.listarArchivos(params)
    archivos.value = data.archivos || []
    periodos.value = data.periodos || []
    versiones.value = data.versiones || []
    totalFiltrados.value = data.total_filtrados || 0
    truncado.value = !!data.truncado
    // Al cambiar de tipo la versión seleccionada puede no existir (los ER no
    // tienen versión); se limpia para no dejar un filtro invisible aplicado.
    if (versionSel.value !== TODOS && !versiones.value.includes(versionSel.value)) {
      versionSel.value = TODOS
    }
  } catch (e) {
    archivos.value = []
    error.value = e.data?.detail || 'No se pudo leer la carpeta de Drive'
  } finally {
    loading.value = false
    cargandoPeriodos.value = false
  }
}

// Cambiar tipo, período o versión recarga del servidor; el texto filtra en cliente.
watch([tipo, periodoSel, versionSel], () => cargar())
onMounted(() => cargar())

// ── Descargas ─────────────────────────────────────────────────────────────────
// El backend proxea el archivo con el service account, así que funciona aunque el
// usuario no tenga permisos sobre la carpeta de Drive.
const descargando = ref(null)
const descargandoZip = ref(false)

function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

async function descargarUno(archivo) {
  descargando.value = archivo.id
  try {
    const blob = await estadosResultadosService.descargarArchivo(archivo.id)
    guardarBlob(blob, archivo.nombre)
  } catch {
    toast.error('Error', { description: 'No se pudo descargar el archivo', duration: 4000 })
  } finally {
    descargando.value = null
  }
}

async function descargarZip() {
  descargandoZip.value = true
  try {
    const blob = await estadosResultadosService.descargarZip(filtrosServidor())
    const partes = [tipo.value === 'cruce_facturas' ? 'cruce_facturas' : 'estados_resultados']
    if (periodoSel.value !== TODOS) partes.push(periodoSel.value)
    if (versionSel.value !== TODOS) partes.push(versionSel.value)
    guardarBlob(blob, `${partes.join('_')}.zip`)
  } catch (e) {
    toast.warning('ZIP no generado', { description: e.data?.detail || 'No se pudo generar el ZIP', duration: 6000 })
  } finally {
    descargandoZip.value = false
  }
}

// ── Generación de archivos ────────────────────────────────────────────────────
// Las dos son tareas asíncronas de varios minutos: se sondean y, al terminar, el
// archivo ya está en Drive, así que se recarga el listado saltando el caché.
const mesAnterior = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)

function periodoPorDefecto() {
  return { mes: mesAnterior.getMonth() + 1, anio: mesAnterior.getFullYear(), version: VERSION_INICIAL }
}

function faltanCampos(p) {
  if (p.mes != null && p.anio != null && p.version) return false
  toast.warning('Faltan campos', { description: 'Completa mes, año y versión.', duration: 4000 })
  return true
}

/** Corre la tarea, avisa el resultado y refresca la lista de archivos. */
async function generarArchivo({ accion, periodo, titulo, enCurso, progreso, cerrar }) {
  if (faltanCampos(periodo)) return
  enCurso.value = true
  progreso.value = ''
  try {
    const res = await liquidacionesApi.ejecutarAccionCiclo(
      accion,
      { month: periodo.mes, year: periodo.anio, version: periodo.version },
      { onEstado: (t) => { progreso.value = t.mensaje } },
    )
    toast.success(titulo, {
      description: res.file_name ? `Generado: ${res.file_name}` : (res.message || 'Terminó correctamente.'),
      duration: 8000,
    })
    cerrar()
    await cargar(true)
  } catch (e) {
    toast.error(`${titulo} falló`, { description: e.data?.detail || e.message, duration: 10000 })
  } finally {
    enCurso.value = false
    progreso.value = ''
  }
}

// Estado de resultados
const estadoVisible = ref(false)
const generandoEr = ref(false)
const progresoEr = ref('')
const er = reactive(periodoPorDefecto())

function abrirEstado() {
  Object.assign(er, periodoPorDefecto())
  progresoEr.value = ''
  estadoVisible.value = true
}
function generarEstado() {
  return generarArchivo({
    accion: AccionCiclo.ESTADO_RESULTADOS, periodo: er, titulo: 'Estado de resultados',
    enCurso: generandoEr, progreso: progresoEr,
    cerrar: () => { estadoVisible.value = false },
  })
}

// Cruce de facturas
const crudoVisible = ref(false)
const generandoCruce = ref(false)
const progresoCruce = ref('')
const cr = reactive(periodoPorDefecto())

function abrirCrudo() {
  Object.assign(cr, periodoPorDefecto())
  progresoCruce.value = ''
  crudoVisible.value = true
}
function generarCrudo() {
  return generarArchivo({
    accion: AccionCiclo.CRUCE_FACTURAS, periodo: cr, titulo: 'Cruce de facturas',
    enCurso: generandoCruce, progreso: progresoCruce,
    cerrar: () => { crudoVisible.value = false },
  })
}
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }

.er-toggle {
  display: inline-flex;
  background: #F4F1FA;
  border: 1px solid #E5E2EC;
  border-radius: 8px;
  padding: 2px;
}
.er-toggle-btn {
  background: transparent; border: none;
  padding: 5px 11px; font-size: 12px; font-weight: 700;
  color: #6B5A8A; border-radius: 6px; cursor: pointer; transition: all .15s;
  white-space: nowrap;
}
.er-toggle-btn:hover:not(.er-toggle-btn--on) { color: var(--color-unergy-deep); background: rgba(145, 91, 216, .08); }
.er-toggle-btn--on { background: var(--color-unergy-purple); color: var(--color-unergy-avena); box-shadow: 0 1px 4px rgba(145, 91, 216, .3); }
</style>
