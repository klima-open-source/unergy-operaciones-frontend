<template>
  <div class="gf-page">

    <!-- ══ TAB BAR ══════════════════════════════════════════════════════════ -->
    <div class="mon-tab-bar">
      <CreditCardIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
      <span class="text-base font-bold text-gray-800 whitespace-nowrap mr-2">Costos</span>
      <div class="mon-tab-group">
        <button
          v-for="(tab, i) in TABS"
          :key="i"
          class="mon-tab"
          :class="{ 'mon-tab--active': activeTab === i }"
          @click="activeTab = i"
        >
          <component :is="tab.icon" class="size-[1em]" style="font-size:12px" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Exportar Excel mensual consolidado (visible desde cualquier pestaña) -->
      <div class="flex items-center gap-2 ml-auto">
        <input type="month" v-model="exportPeriodo"
          class="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-200" />
        <Button label="Descargar Excel" size="small" :loading="exportando" @click="onExportExcel" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- ══ TAB 0 — MANTENIMIENTO ══════════════════════════════════════════ -->
    <div v-if="activeTab === 0" class="mon-tab-view">

      <!-- ── 1. Panel O&M Mensual — contenedor con borde propio ──────────── -->
      <div class="om-panel-card">
        <!-- Header del panel — NO sticky, no hereda mon-tab-bar -->
        <div class="om-panel-header">
          <div class="flex items-center gap-2">
            <CalculatorIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Panel O&amp;M Mensual</span>
          </div>
          <div class="mon-tab-group">
            <button
              v-for="(tab, i) in SUBTABS_OM"
              :key="i"
              class="mon-tab"
              :class="{ 'mon-tab--active': activeSubTabOM === i }"
              @click="activeSubTabOM = i"
            >
              <component :is="tab.icon" class="size-[1em]" style="font-size:12px" />
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Contenido del panel — tabla queda dentro del card -->
        <div class="om-panel-body">
          <OMAOperaciones v-if="activeSubTabOM === 0" />
          <OMAProveedor   v-if="activeSubTabOM === 1" />
        </div>
      </div>

      <!-- ── 2. Separador ─────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 my-5">
        <div class="h-px flex-1" style="background:#ECE7F2" />
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style="background:#F1EAF9;color:#6D28D9">
          Comparación facturas emitidas vs cobrado a inversionistas
        </span>
        <div class="h-px flex-1" style="background:#ECE7F2" />
      </div>

      <!-- ── 3. Selector de proyecto ────────────────────────────────────── -->
      <div class="costos-selector-bar">
        <ZapIcon class="text-sm flex-shrink-0 size-[1em]" style="color:var(--color-unergy-purple)" />
        <span class="text-sm font-semibold whitespace-nowrap" style="color:var(--color-unergy-deep)">Proyecto</span>
        <Select
          v-model="proyectoSeleccionado"
          :options="proyectos"
          optionLabel="nombre_comercial"
          optionValue="id"
          placeholder="Selecciona un proyecto…"
          filter
          showClear
          :loading="loadingProyectos"
          class="costos-selector-select"
          @change="onProyectoChange"
        />
        <span v-if="proyectoSeleccionado && proyectoNombre"
          class="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
          style="background:#F1EAF9; color:#6D28D9">
          {{ proyectoNombre }}
        </span>
      </div>

      <!-- ── 4. Contenido del proyecto ─────────────────────────────────── -->
      <div v-if="loadingContrato" class="flex justify-center py-10">
        <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:1.5rem; color:var(--color-unergy-purple);" />
      </div>

      <div v-else-if="proyectoSeleccionado" class="space-y-4 mt-3">

        <!-- Facturas históricas -->
        <FacturasMantenimiento :contrato-id="contratoMantenimientoId" />

        <!-- Cargar factura -->
        <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#ECE7F2">
          <div class="flex items-center justify-between px-4 py-2.5 border-b" style="border-color:#F3F0FA">
            <div class="flex items-center gap-2">
              <UploadIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
              <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Cargar factura</span>
            </div>
            <button type="button"
              class="text-xs flex items-center gap-1 text-gray-400 hover:text-purple-600 transition-colors"
              @click="showCargarFactura = !showCargarFactura">
              <ChevronDownIcon class="text-[10px] transition-transform duration-200 size-[1em]" :style="showCargarFactura ? 'transform:rotate(180deg)' : ''" />
              {{ showCargarFactura ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>

          <div v-show="showCargarFactura" class="px-4 py-3">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <!-- Tipo (siempre visible, primer campo) -->
              <div class="flex flex-col gap-1 md:col-span-2">
                <label class="text-xs font-medium text-gray-500">Tipo <span class="text-red-400">*</span></label>
                <div class="flex gap-2">
                  <label
                    class="flex-1 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
                    :class="facturaForm.tipo === 'solenium'
                      ? 'border-purple-400 bg-purple-50 text-purple-700 font-semibold'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                    <input type="radio" v-model="facturaForm.tipo" value="solenium" class="accent-purple-600" />
                    Proveedor O&amp;M (Solenium)
                  </label>
                  <label
                    class="flex-1 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
                    :class="facturaForm.tipo === 'inversionistas'
                      ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                    <input type="radio" v-model="facturaForm.tipo" value="inversionistas" class="accent-blue-600" />
                    Cobros a clientes (Inversionistas)
                  </label>
                </div>
              </div>
              <!-- Período -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Mes / Año</label>
                <input
                  type="month"
                  v-model="facturaForm.periodo"
                  class="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              <!-- N° Factura -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">N° Factura</label>
                <input
                  type="text"
                  v-model="facturaForm.numero"
                  placeholder="Ej: SOFV001"
                  class="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              <!-- Monto -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Monto (COP)</label>
                <input
                  type="number"
                  v-model.number="facturaForm.monto"
                  placeholder="0"
                  class="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <!-- Archivo -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Archivo (PDF / imagen)</label>
                <label class="flex items-center gap-2 text-sm border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-purple-400 transition-colors">
                  <PaperclipIcon class="text-xs text-gray-400 size-[1em]" />
                  <span class="text-xs text-gray-400 truncate">
                    {{ facturaForm.archivo ? facturaForm.archivo.name : 'Seleccionar archivo…' }}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    class="hidden"
                    @change="onArchivoChange"
                  />
                </label>
              </div>
            </div>

            <!-- Link Drive (alternativa al archivo) -->
            <div class="flex flex-col gap-1 mt-2.5">
              <label class="text-xs font-medium text-gray-500">
                O pega el link de Google Drive / soporte digital
              </label>
              <input
                type="url"
                v-model="facturaForm.enlace"
                placeholder="https://drive.google.com/…"
                class="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>

            <!-- Botón -->
            <div class="flex items-center gap-3 mt-3">
              <button type="button"
                :disabled="!puedeGuardarFactura || guardandoFactura"
                class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                style="background:var(--color-unergy-purple);color:#fff;border:none;cursor:pointer"
                :style="!puedeGuardarFactura || guardandoFactura ? 'cursor:not-allowed' : 'cursor:pointer'"
                @click="guardarFactura">
                <LoaderCircleIcon v-if="guardandoFactura" class="text-xs size-[1em] animate-spin" />
                <CheckIcon v-else class="text-xs size-[1em]" />
                {{ guardandoFactura ? 'Guardando…' : 'Guardar factura' }}
              </button>
              <span v-if="facturaOk" class="text-xs text-green-600 flex items-center gap-1">
                <CircleCheckIcon class="text-xs size-[1em]" />Factura registrada
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- ══ TAB 1 — ARRIENDOS ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 1" class="mon-tab-view">
      <div class="om-panel-card">
        <div class="om-panel-header">
          <div class="flex items-center gap-2">
            <BuildingIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Panel Arriendos Mensual</span>
          </div>
          <div class="mon-tab-group">
            <button
              v-for="(tab, i) in SUBTABS_ARR"
              :key="i"
              class="mon-tab"
              :class="{ 'mon-tab--active': activeSubTabArr === i }"
              @click="activeSubTabArr = i"
            >
              <component :is="tab.icon" class="size-[1em]" style="font-size:12px" />
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="om-panel-body">
          <ArriendosOperaciones v-if="activeSubTabArr === 0" />
          <ArriendosInfo        v-if="activeSubTabArr === 1" />
        </div>
      </div>
    </div>

    <!-- ══ TAB 2 — SERVICIOS DE INTERNET ══════════════════════════════════ -->
    <div v-if="activeTab === 2" class="mon-tab-view">
      <div class="om-panel-card">
        <div class="om-panel-header">
          <div class="flex items-center gap-2">
            <WifiIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Starlink — Procesador de facturas PDF</span>
          </div>
        </div>
        <div class="om-panel-body">
          <StarlinkPDF />
        </div>
      </div>
    </div>

    <!-- ══ TAB 3 — MANDATOS ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 3" class="mon-tab-view">
      <MandatosOperaciones />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { toast } from 'vue-sonner'
import { StarlinkService } from '~/features/finanzas/services/starlink'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { generarExcelCostos } from './costosExcelExport.js'
import FacturasMantenimiento from '~/features/contratos/components/FacturasMantenimiento.vue'
import OMAOperaciones       from './OMAOperaciones.vue'
import OMAProveedor          from './OMAProveedor.vue'
import ArriendosOperaciones  from './ArriendosOperaciones.vue'
import ArriendosInfo          from './ArriendosInfo.vue'
import StarlinkPDF            from './StarlinkPDF.vue'
import MandatosOperaciones    from './MandatosOperaciones.vue'
import { BuildingIcon, CalculatorIcon, CheckIcon, ChevronDownIcon, CircleCheckIcon, CreditCardIcon, FileCheckIcon, FileSpreadsheetIcon, InfoIcon, LoaderCircleIcon, PaperclipIcon, TableIcon, TruckIcon, UploadIcon, UsersIcon, WifiIcon, WrenchIcon, ZapIcon } from '@lucide/vue'


const starlinkService = new StarlinkService()
const proyectosService = new ProyectosService()
const contratosServicioService = new ContratosServicioService()

const SUBTABS_OM = [
  { label: 'Operaciones', icon: UsersIcon },
  { label: 'Proveedor',   icon: TruckIcon },
]
const activeSubTabOM = ref(0)

const SUBTABS_ARR = [
  { label: 'Panel',       icon: TableIcon },
  { label: 'Información', icon: InfoIcon },
]
const activeSubTabArr = ref(0)


const TABS = [
  { label: 'Mantenimiento',         icon: WrenchIcon },
  { label: 'Arriendos',             icon: BuildingIcon },
  { label: 'Servicios de Internet', icon: WifiIcon },
  { label: 'Mandatos',              icon: FileCheckIcon },
]
const activeTab = ref(0)

// ── Exportar Excel mensual consolidado ──────────────────────────────────────
const _hoy = new Date()
const exportPeriodo = ref(`${_hoy.getFullYear()}-${String(_hoy.getMonth() + 1).padStart(2, '0')}`)
const exportando = ref(false)

async function onExportExcel() {
  if (!exportPeriodo.value) return
  exportando.value = true
  try {
    let starlinkData = null
    try {
      starlinkData = await starlinkService.obtenerFactura(exportPeriodo.value)
    } catch (err) {
      if (err?.status !== 404) throw err
      // 404 = sin factura ese mes, estado normal — no bloquea el export
    }
    const sinAsignar = (starlinkData?.lineas ?? []).filter(l => l.proyecto_id == null && !l.excluido)
    if (sinAsignar.length) {
      const nombres = sinAsignar.map(l => l.descripcion)
      const detalle = nombres.length > 5
        ? `${nombres.slice(0, 5).join(', ')} y ${nombres.length - 5} más`
        : nombres.join(', ')
      toast.error('Hay sitios de Internet sin asignar', {
        description: `Asigna primero: ${detalle}`,
        duration: 6000,
      })
      return
    }

    const res = await generarExcelCostos(exportPeriodo.value)
    if (!res.filas) {
      toast.warning('Sin datos para exportar', {
        description: 'Ningún proyecto seleccionado en Mantenimiento o Arriendos para ese mes.',
        duration: 4000,
      })
    } else {
      toast.success('Excel generado', {
        description: `${res.proyectos} proyectos · ${res.filas} filas`,
        duration: 3000,
      })
    }
  } catch (err) {
    toast.error('Error al generar el Excel', {
      description: err?.message ?? 'Revisa la consola',
      duration: 5000,
    })
  } finally {
    exportando.value = false
  }
}

// ── Proyectos ──────────────────────────────────────────────────────────────────
const proyectos            = ref([])
const loadingProyectos     = ref(false)
const proyectoSeleccionado = ref(null)
const proyectoNombre       = ref('')

// ── Contrato de mantenimiento del proyecto seleccionado ────────────────────────
const contratoMantenimientoId = ref(null)
const loadingContrato         = ref(false)

// ── Cargar factura ─────────────────────────────────────────────────────────────
const showCargarFactura = ref(false)
const guardandoFactura  = ref(false)
const facturaOk         = ref(false)
const facturaForm = ref({
  tipo:    'solenium',                             // 'solenium' | 'inversionistas'
  periodo: new Date().toISOString().slice(0, 7),  // "2026-06"
  numero:  '',
  monto:   null,
  archivo: null,
  enlace:  '',
})

const puedeGuardarFactura = computed(() =>
  !!(facturaForm.value.periodo && facturaForm.value.numero)
)

function onArchivoChange(e) {
  facturaForm.value.archivo = e.target.files?.[0] ?? null
}

async function guardarFactura() {
  if (!puedeGuardarFactura.value || !contratoMantenimientoId.value) return
  guardandoFactura.value = true
  facturaOk.value = false
  try {
    const esInversionistas = facturaForm.value.tipo === 'inversionistas'

    await contratosServicioService.crearFactura(contratoMantenimientoId.value, {
      tipo:           esInversionistas ? 'inversionista' : 'solenium',
      fecha:          facturaForm.value.periodo,
      inversionista:  null,
      numero_factura: facturaForm.value.numero || null,
      monto:          facturaForm.value.monto  || null,
      enlace_soporte: facturaForm.value.enlace || null,
    })

    facturaOk.value = true
    // Resetear formulario (conservar tipo seleccionado)
    const tipoActual = facturaForm.value.tipo
    facturaForm.value = {
      tipo:    tipoActual,
      periodo: new Date().toISOString().slice(0, 7),
      numero:  '',
      monto:   null,
      archivo: null,
      enlace:  '',
    }
    setTimeout(() => { facturaOk.value = false }, 4000)
  } catch {
    toast.error('Error al guardar la factura', { duration: 3000 })
  } finally {
    guardandoFactura.value = false
  }
}

// ── Carga inicial ──────────────────────────────────────────────────────────────
onMounted(async () => {
  loadingProyectos.value = true
  try {
    const [r1, r2] = await Promise.allSettled([
      proyectosService.listar({ size: 500 }),
      proyectosService.listar({ size: 500, tipo_proyecto: 'minigranja' }),
    ])
    const lista1 = r1.status === 'fulfilled' ? r1.value : []
    const lista2 = r2.status === 'fulfilled' ? r2.value : []
    const ids = new Set()
    const todos = [...lista1, ...lista2].filter(p => {
      if (ids.has(p.id)) return false
      ids.add(p.id)
      return true
    })
    proyectos.value = todos.sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial))
  } catch {
    proyectos.value = []
  } finally {
    loadingProyectos.value = false
  }
})

async function onProyectoChange() {
  contratoMantenimientoId.value = null
  proyectoNombre.value = ''
  facturaOk.value = false

  if (!proyectoSeleccionado.value) return

  const proy = proyectos.value.find(p => p.id === proyectoSeleccionado.value)
  proyectoNombre.value = proy?.nombre_comercial ?? ''

  loadingContrato.value = true
  try {
    const data = await contratosServicioService.listar({
      tipo: 'mantenimiento', proyecto_id: proyectoSeleccionado.value,
    })
    contratoMantenimientoId.value = data.length ? data[0].id : null
  } catch {
    contratoMantenimientoId.value = null
  } finally {
    loadingContrato.value = false
  }
}
</script>

<style scoped>
.gf-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #f5f4f8;
}

/* ── Tab bar ── */
.mon-tab-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: #fff;
  border-bottom: 1px solid #ECE7F2;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 25;
}
.mon-tab-group {
  display: inline-flex;
  background: #F4F1FA;
  border: 1px solid #E5E2EC;
  border-radius: 8px;
  padding: 2px;
  gap: 0;
}
.mon-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 5px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  color: #6B5A8A;
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.mon-tab svg { font-size: 12px; }
.mon-tab:hover:not(.mon-tab--active) { color: var(--color-unergy-deep); background: rgba(145,91,216,.08); }
.mon-tab--active {
  background: var(--color-unergy-purple);
  color: var(--color-unergy-avena);
  box-shadow: 0 1px 4px rgba(145,91,216,.3);
}
.mon-tab--active:hover { color: var(--color-unergy-avena); }

/* ── Selector de proyecto ── */
.costos-selector-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #ECE7F2;
  border-radius: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.costos-selector-select {
  min-width: 260px;
  max-width: 380px;
}

/* ── Panel O&M — contenedor aislado, sin sticky ── */
.om-panel-card {
  background: #ffffff;
  border: 1px solid #E5E2EC;
  border-radius: 12px;
  overflow: hidden;          /* tabla no se desborda fuera del card */
  margin-bottom: 0;
}
.om-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  background: #FDFCFF;
  border-bottom: 1px solid #ECE7F2;
  /* sin position:sticky — el header queda fijo dentro del card, no de la página */
}
.om-panel-body {
  padding: 0;               /* OMAOperaciones y OMAProveedor manejan su propio padding */
  background: #f9f8fc;
}

/* ── Contenido ── */
.mon-tab-view {
  padding: 16px 20px 32px;
  background: #f5f4f8;
}
.mon-tab-empty {
  text-align: center;
  padding: 80px 20px;
}
.space-y-4 > * + * { margin-top: 1rem; }

@media (max-width: 640px) {
  .mon-tab-view { padding: 12px; }
  .costos-selector-select { min-width: 200px; }
}
</style>
