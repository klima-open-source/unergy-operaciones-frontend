<template>
  <div class="space-y-4">
    <PageHeader title="Costos comercialización"
                subtitle="Costos e ingresos fijos por proyecto">
      <template #actions>
        <Button label="Subir Excel costos" size="small" outlined @click="abrirSubirExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Repartir costos de XM" size="small" @click="abrirAcPower">
          <template #icon><ZapIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <input ref="excelInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onExcelSeleccionado" />

    <!-- Dialog: subir Excel -->
    <Dialog v-model:visible="excelVisible" header="Subir Excel de costos" modal class="w-full max-w-lg">
      <div class="space-y-4 pt-1">
        <button type="button" class="dropzone" :disabled="subiendoExcel" @click="seleccionarExcel">
          <FileSpreadsheetIcon class="text-3xl size-[1em]" style="color:var(--color-unergy-purple)" />
          <p class="text-sm font-semibold text-gray-700 mt-2">Seleccionar Excel</p>
          <p class="text-xs text-gray-400">.xlsx o .xls · un archivo por carga</p>
        </button>

        <div v-if="excel" class="flex items-center gap-3 rounded-lg border px-3 py-2" style="border-color:#ECE7F2">
          <FileSpreadsheetIcon class="text-sm shrink-0 size-[1em]" style="color:#9b8fb0" />
          <span class="flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">{{ excel.nombre }}</span>
          <span class="text-[10px] text-gray-400 shrink-0">{{ fmtTamano(excel.tamano) }}</span>
        </div>

        <div v-if="subiendoExcel" class="h-1.5 rounded-full overflow-hidden" style="background:#F1EAF9">
          <div class="h-full rounded-full transition-all duration-200"
               :style="{ width: progresoExcel + '%', background:'var(--color-unergy-purple)' }" />
        </div>

        <p class="text-[11px] text-gray-400">
          <InfoIcon class="mr-1 size-[1em]" />
          No se aceptan los tipos del grupo <strong>xm</strong>: esos los genera el reparto.
          Los anuales se prorratean como valor ÷ 12.
        </p>

        <div class="flex justify-end gap-2 pt-1">
          <Button label="Cerrar" severity="secondary" size="small" :disabled="subiendoExcel"
                  @click="excelVisible = false" />
          <Button label="Subir" size="small" :disabled="!excel" :loading="subiendoExcel" @click="subirExcel">
            <template #icon><UploadIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- Dialog: repartir costos de XM -->
    <Dialog v-model:visible="acVisible" header="Repartir costos de XM" modal class="w-full max-w-md">
      <div class="space-y-3 pt-1">
        <p class="text-xs text-gray-500">
          Reparte las facturas de XM entre los proyectos a prorrata del AC Power.
          Requiere haber liquidado primero y que las facturas del período estén listas.
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Mes</label>
            <Select v-model="ac.month" :options="MESES" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div>
            <label class="field-label">Año</label>
            <InputNumber v-model="ac.year" :useGrouping="false" class="w-full" />
          </div>
        </div>
        <div>
          <label class="field-label">Versión</label>
          <Select v-model="ac.version" :options="VERSIONES" class="w-full" />
        </div>
        <div>
          <label class="field-label">AC Power total del período (kW)</label>
          <InputNumber v-model="ac.total_ac_power" :maxFractionDigits="4" :useGrouping="false"
                       class="w-full" placeholder="ej: 12345.6789" />
          <p class="text-[11px] text-gray-400 mt-1">Es el divisor de la prorrata.</p>
        </div>

        <div class="flex items-start gap-2 rounded-lg px-3 py-2"
             style="background:#FFF8E6; border:1px solid #F5E3B3">
          <Checkbox v-model="ac.override" inputId="ov" binary />
          <label for="ov" class="text-[11px] leading-snug" style="color:#7A5C00">
            <strong>Sobrescribir el reparto anterior.</strong>
            Debe quedar marcado la primera vez que se corre este período: sin marcar y
            sin un reparto previo, la API borra los costos de XM y no crea nada, sin avisar.
          </label>
        </div>

        <p v-if="progresoReparto" class="text-[11px] text-gray-500 flex items-center gap-2">
          <LoaderCircleIcon class="size-[1em] animate-spin" /> {{ progresoReparto }}
        </p>

        <div class="flex justify-end gap-2 pt-1">
          <Button label="Cancelar" severity="secondary" size="small" :disabled="repartiendo"
                  @click="acVisible = false" />
          <Button label="Repartir" size="small" :loading="repartiendo" @click="repartir" />
        </div>
      </div>
    </Dialog>

    <!-- Filtros -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Proyecto</label>
        <Select v-model="filtros.project" :options="proyectosOptions" optionLabel="label"
                optionValue="value" class="w-52" showClear filter placeholder="Todos"
                @change="recargar" />
      </div>
      <div>
        <label class="field-label">Tipo de costo</label>
        <Select v-model="filtros.payment_type" :options="tiposOptions" optionLabel="label"
                optionValue="value" class="w-56" showClear filter placeholder="Todos"
                @change="recargar" />
      </div>
      <div>
        <label class="field-label">Mes</label>
        <Select v-model="filtros.mes" :options="MESES" optionLabel="label" optionValue="value"
                class="w-32" showClear placeholder="Todos" @change="recargar" />
      </div>
      <div>
        <label class="field-label">Año</label>
        <Select v-model="filtros.anio" :options="aniosOptions" class="w-28" showClear
                placeholder="Todos" @change="recargar" />
      </div>
      <div>
        <label class="field-label">Versión</label>
        <Select v-model="filtros.version" :options="VERSIONES" class="w-24" showClear
                placeholder="Todas" @change="recargar" />
      </div>
      <div>
        <label class="field-label">Buscar en la página</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" placeholder="Proyecto, costo…" class="w-48" />
        </IconField>
      </div>
      <div class="flex-1" />
      <Button label="Exportar" size="small" outlined :loading="exportando" :disabled="!total" v-tooltip.top="'Exporta a Excel todo lo que coincide con los filtros'" @click="exportar">
        <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
      </Button>
      <Button size="small" text rounded :loading="loading" v-tooltip.left="'Recargar'" @click="recargar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
      <div class="text-xs text-gray-400 self-center">
        {{ total.toLocaleString('es-CO') }} registro{{ total === 1 ? '' : 's' }}
      </div>
    </div>

    <div v-if="error" class="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
         style="background:#FEF2F2; border:1px solid #FECACA; color:#B42318">
      <CircleXIcon class="size-[1em]" /> {{ error }}
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th v-for="col in COLUMNAS" :key="col.key"
                  class="px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap"
                  :class="col.right ? 'text-right' : 'text-left'">
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtrados" :key="row.id"
                class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100">
              <td class="px-4 py-2 whitespace-nowrap">{{ row.fecha_desde || '—' }}</td>
              <td class="px-4 py-2 whitespace-nowrap">{{ row.fecha_hasta || '—' }}</td>
              <td class="px-4 py-2">{{ row.proyecto || '—' }}</td>
              <td class="px-4 py-2 text-right font-mono text-xs">{{ fmtNum(row.valor) }}</td>
              <td class="px-4 py-2 whitespace-nowrap">{{ FRECUENCIAS[row.frecuencia_pago] || row.frecuencia_pago || '—' }}</td>
              <td class="px-4 py-2">
                {{ row.tipo_pago_nombre || row.tipo_pago || '—' }}
                <GBadge v-if="row.grupo" class="ml-1"
                     :color="row.grupo === 'xm' ? 'warning' : 'default'">{{ row.grupo }}</GBadge>
              </td>
              <td class="px-4 py-2 whitespace-nowrap uppercase text-xs">{{ row.version || '—' }}</td>
            </tr>
            <tr v-if="loading">
              <td :colspan="COLUMNAS.length" class="px-4 py-12 text-center text-gray-400">
                <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" />
              </td>
            </tr>
            <tr v-else-if="!filtrados.length">
              <td :colspan="COLUMNAS.length" class="px-4 py-12 text-center text-sm text-gray-400">
                <WalletIcon class="text-2xl mb-2 block text-gray-300 size-[1em]" />
                No hay costos con esos filtros.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación: la tabla completa pasa de 10.000 filas -->
      <div v-if="total > filtros.size" class="flex items-center justify-between px-4 py-2.5 border-t"
           style="border-color:#ECE7F2">
        <span class="text-xs text-gray-400">
          {{ ((filtros.page - 1) * filtros.size + 1).toLocaleString('es-CO') }}–{{
            Math.min(filtros.page * filtros.size, total).toLocaleString('es-CO') }} de {{ total.toLocaleString('es-CO') }}
        </span>
        <div class="flex gap-1">
          <Button text rounded size="small" :disabled="filtros.page === 1 || loading" @click="irA(filtros.page - 1)">
            <template #icon><ChevronLeftIcon class="size-[1em]" /></template>
          </Button>
          <Button text rounded size="small" :disabled="filtros.page >= ultimaPagina || loading" @click="irA(filtros.page + 1)">
            <template #icon><ChevronRightIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { VERSIONES, VERSION_INICIAL, AccionCiclo } from '~/features/liquidaciones/types'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'

const liquidacionesApi = new LiquidacionesApiService()
import { ChevronLeftIcon, ChevronRightIcon, CircleXIcon, FileSpreadsheetIcon, InfoIcon, LoaderCircleIcon, RefreshCwIcon, SearchIcon, UploadIcon, WalletIcon, ZapIcon } from '@lucide/vue'


const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ label, value: i + 1 }))

const FRECUENCIAS = { monthly: 'Mensual', yearly: 'Anual' }

const COLUMNAS = [
  { key: 'fecha_desde',     label: 'Fecha desde' },
  { key: 'fecha_hasta',     label: 'Fecha hasta' },
  { key: 'proyecto',        label: 'Proyecto' },
  { key: 'valor',           label: 'Valor', right: true },
  { key: 'frecuencia_pago', label: 'Frecuencia' },
  { key: 'tipo_pago',       label: 'Costo' },
  { key: 'version',         label: 'Versión' },
]

// ── Listado ──────────────────────────────────────────────────────────────────
// `xm` es el grupo de comercializacion: lo que produce el reparto de las
// facturas de XM. Intereses, opex, descuentos y ajustes no van en esta vista.
const GRUPO_COMERCIALIZACION = 'xm'
const filtros = reactive({
  project: null, payment_type: null, mes: null, anio: null,
  version: null, page: 1, size: 100,
})

// Catálogos de los selects.
const proyectosOptions = ref([])
const tiposOptions = ref([])
const aniosOptions = computed(() => {
  const actual = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => actual - i)
})
const q = ref('')
const loading = ref(false)
const error = ref(null)
const costos = ref([])
const total = ref(0)

const ultimaPagina = computed(() => Math.max(1, Math.ceil(total.value / filtros.size)))

const filtrados = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return costos.value
  return costos.value.filter(d =>
    [d.proyecto, d.tipo_pago, d.tipo_pago_nombre, d.frecuencia_pago, d.version]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(term)),
  )
})

async function cargar() {
  loading.value = true
  error.value = null
  try {
    const data = await liquidacionesApi.listarCostos({
      grupo: GRUPO_COMERCIALIZACION,
      project: filtros.project || undefined,
      payment_type: filtros.payment_type || undefined,
      mes: filtros.mes || undefined,
      anio: filtros.anio || undefined,
      version: filtros.version || undefined,
      page: filtros.page,
      size: filtros.size,
    })
    costos.value = data.results || []
    total.value = data.total || 0
  } catch (e) {
    error.value = e.data?.detail || 'No se pudieron cargar los costos.'
    costos.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// Cambiar un filtro vuelve a la primera página: si no, se queda en una página
// que ya no existe y la tabla sale vacía sin explicación.
function recargar() {
  filtros.page = 1
  cargar()
}

function irA(pagina) {
  filtros.page = pagina
  cargar()
}

// ── Subir Excel ──────────────────────────────────────────────────────────────
const excelVisible = ref(false)
const excelInput = ref(null)
const excel = ref(null)
const subiendoExcel = ref(false)
const progresoExcel = ref(0)

function abrirSubirExcel() {
  excel.value = null
  progresoExcel.value = 0
  excelVisible.value = true
}
function seleccionarExcel() {
  excelInput.value?.click()
}
function onExcelSeleccionado(e) {
  const f = (e.target.files || [])[0]
  e.target.value = ''
  if (f) excel.value = { nombre: f.name, tamano: f.size, file: f }
}

async function subirExcel() {
  subiendoExcel.value = true
  progresoExcel.value = 0
  try {
    await liquidacionesApi.subirExcelCostos(excel.value.file, { onProgreso: (p) => { progresoExcel.value = p } })
    toast.success('Excel cargado', { duration: 4000 })
    excelVisible.value = false
    excel.value = null
    await cargar()
  } catch (e) {
    toast.error('No se pudo cargar', { description: e.data?.detail || e.message, duration: 8000 })
  } finally {
    subiendoExcel.value = false
  }
}

// ── Repartir costos de XM ────────────────────────────────────────────────────
const hoy = new Date()
const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)

const acVisible = ref(false)
const repartiendo = ref(false)
const progresoReparto = ref('')
const ac = reactive({
  month: null, year: null, version: VERSION_INICIAL, total_ac_power: null, override: true,
})

function abrirAcPower() {
  Object.assign(ac, {
    month: anterior.getMonth() + 1,
    year: anterior.getFullYear(),
    version: VERSION_INICIAL,
    total_ac_power: null,
    override: true,
  })
  progresoReparto.value = ''
  acVisible.value = true
}

async function repartir() {
  if (ac.month == null || ac.year == null || !ac.version || ac.total_ac_power == null) {
    toast.warning('Faltan campos', {
      description: 'Completa mes, año, versión y AC Power total.',
      duration: 4000,
    })
    return
  }

  repartiendo.value = true
  progresoReparto.value = ''
  try {
    const res = await liquidacionesApi.ejecutarAccionCiclo(AccionCiclo.REPARTIR, 
      { ...ac },
      { onEstado: (t) => { progresoReparto.value = t.mensaje } },
    )
    toast.success('Costos repartidos', {
      description: res.message || 'Terminó correctamente.',
      duration: 6000,
    })
    acVisible.value = false
    recargar()
  } catch (e) {
    toast.error('El reparto falló', { description: e.data?.detail || e.message, duration: 10000 })
  } finally {
    repartiendo.value = false
    progresoReparto.value = ''
  }
}

// ── Formato ──────────────────────────────────────────────────────────────────
function fmtTamano(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)
}

// ── Catálogos de los filtros ─────────────────────────────────────────────────
async function cargarOpciones() {
  try {
    const [proyectos, catalogos] = await Promise.all([
      liquidacionesApi.listarProyectos(),
      liquidacionesApi.listarCatalogos(),
    ])
    // La API identifica por tópico, pero se muestra el nombre de esta base.
    proyectosOptions.value = (proyectos || [])
      .filter(p => p.nombre_topico)
      .map(p => ({ value: p.nombre_topico, label: p.nombre_comercial }))
      .sort((a, b) => a.label.localeCompare(b.label))
    tiposOptions.value = (catalogos.tipos_costo || [])
      .filter(t => t.group === GRUPO_COMERCIALIZACION)
      .map(t => ({ value: t.name, label: t.long_name || t.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch {
    // Sin catálogos los filtros quedan vacíos, pero la tabla sigue sirviendo.
  }
}

// ── Exportar ─────────────────────────────────────────────────────────────────
const exportando = ref(false)

async function exportar() {
  exportando.value = true
  try {
    // Se piden todas las filas que cumplen el filtro, no solo la página visible.
    const data = await liquidacionesApi.listarCostos({
      grupo: GRUPO_COMERCIALIZACION,
      project: filtros.project || undefined,
      payment_type: filtros.payment_type || undefined,
      mes: filtros.mes || undefined,
      anio: filtros.anio || undefined,
      version: filtros.version || undefined,
      page: 1,
      size: 5000,
    })
    const filas = data.results || []
    if (!filas.length) {
      toast.warning('Nada que exportar', { duration: 3000 })
      return
    }

    const XLSX = await import('xlsx-js-style')
    const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF', borde: 'ECE4F5' }
    const encabezados = ['Fecha desde', 'Fecha hasta', 'Proyecto', 'Valor', 'Frecuencia', 'Costo', 'Versión']
    const cuerpo = filas.map(f => [
      f.fecha_desde || '', f.fecha_hasta || '', f.proyecto || '',
      f.valor ?? null, FRECUENCIAS[f.frecuencia_pago] || f.frecuencia_pago || '',
      f.tipo_pago_nombre || f.tipo_pago || '', f.version || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...cuerpo])

    const bf = { style: 'thin', color: { rgb: C.borde } }
    const borde = { top: bf, bottom: bf, left: bf, right: bf }
    for (let c = 0; c < encabezados.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c })
      ws[ref].s = {
        font: { bold: true, sz: 10, color: { rgb: C.blanco } },
        fill: { fgColor: { rgb: C.morado } }, border: borde,
      }
    }
    for (let r = 1; r <= cuerpo.length; r++) {
      for (let c = 0; c < encabezados.length; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) continue
        ws[ref].s = { border: borde, font: { color: { rgb: C.oscuro } } }
        if (c === 3) { ws[ref].s.numFmt = '"$"#,##0.00'; ws[ref].s.alignment = { horizontal: 'right' } }
      }
    }
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 42 }, { wch: 9 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Costos comercializacion')
    const periodo = [filtros.anio, filtros.mes ? String(filtros.mes).padStart(2, '0') : null]
      .filter(Boolean).join('-') || 'todos'
    XLSX.writeFile(wb, `Costos_comercializacion_${periodo}.xlsx`)

    if (data.total > filas.length) {
      toast.warning('Exportación parcial', {
        description: `Se exportaron ${filas.length} de ${data.total}. Filtra por período para bajar el resto.`,
        duration: 6000,
      })
    }
  } catch (e) {
    toast.error('No se pudo exportar', { description: e.message, duration: 4000 })
  } finally {
    exportando.value = false
  }
}

onMounted(() => { cargar(); cargarOpciones() })
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }

.dropzone {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 22px 16px;
  border: 2px dashed #D9CCEE;
  border-radius: 12px;
  background: #FBF7FF;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.dropzone:hover { border-color: var(--color-unergy-purple); background: #F4ECFC; }
.dropzone:disabled { opacity: .6; cursor: default; }
</style>
