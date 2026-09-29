<template>
  <div class="flex min-h-full flex-col bg-muted">

    <!-- ══ TAB BAR ══════════════════════════════════════════════════════════ -->
    <div class="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-border bg-card px-3.5 py-1.5 shadow-xs">
      <CreditCardIcon class="size-4 text-unergy-purple" />
      <span class="text-base font-bold text-foreground whitespace-nowrap mr-2">Costos</span>
      <div class="inline-flex rounded-lg border border-border bg-muted p-0.5">
        <button
          v-for="(tab, i) in TABS"
          :key="i"
          class="relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-bold transition-all duration-150"
          :class="activeTab === i
            ? 'bg-unergy-purple text-unergy-avena shadow-sm'
            : 'text-muted-foreground hover:bg-unergy-purple/10 hover:text-unergy-deep'"
          @click="activeTab = i"
        >
          <component :is="tab.icon" class="size-3" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Exportar Excel mensual consolidado (visible desde cualquier pestaña) -->
      <div class="flex items-center gap-2 ml-auto">
        <input type="month" v-model="exportPeriodo"
          class="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20" />
        <Button label="Descargar Excel" size="small" :loading="exportando" @click="onExportExcel" class="bg-unergy-purple border-unergy-purple">
          <template #icon><FileSpreadsheetIcon class="size-4" /></template>
        </Button>
      </div>
    </div>

    <!-- ══ TAB 0 — MANTENIMIENTO ══════════════════════════════════════════ -->
    <div v-if="activeTab === 0" class="bg-muted px-5 pt-4 pb-8 max-sm:p-3">

      <!-- ── 1. Panel O&M Mensual — contenedor con borde propio ──────────── -->
      <div class="overflow-hidden rounded-xl border border-border bg-card">
        <!-- Header del panel — NO sticky, no hereda mon-tab-bar -->
        <div class="flex items-center justify-between gap-2.5 border-b border-border bg-card px-3.5 py-2">
          <div class="flex items-center gap-2">
            <CalculatorIcon class="size-4 text-unergy-purple" />
            <span class="text-sm font-semibold text-unergy-deep">Panel O&amp;M Mensual</span>
          </div>
          <div class="inline-flex rounded-lg border border-border bg-muted p-0.5">
            <button
              v-for="(tab, i) in SUBTABS_OM"
              :key="i"
              class="relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-bold transition-all duration-150"
              :class="activeSubTabOM === i
                ? 'bg-unergy-purple text-unergy-avena shadow-sm'
                : 'text-muted-foreground hover:bg-unergy-purple/10 hover:text-unergy-deep'"
              @click="activeSubTabOM = i"
            >
              <component :is="tab.icon" class="size-3" />
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Contenido del panel — tabla queda dentro del card -->
        <div class="bg-muted">
          <OMAOperaciones v-if="activeSubTabOM === 0" />
          <OMAProveedor   v-if="activeSubTabOM === 1" />
        </div>
      </div>

      <!-- ── 2. Separador ─────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 my-5">
        <div class="h-px flex-1 bg-border" />
        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary"
          >
          Comparación facturas emitidas vs cobrado a inversionistas
        </span>
        <div class="h-px flex-1 bg-border" />
      </div>

      <!-- ── 3. Selector de proyecto ────────────────────────────────────── -->
      <div class="mb-3 flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
        <ZapIcon class="flex-shrink-0 size-4 text-unergy-purple" />
        <span class="text-sm font-semibold whitespace-nowrap text-unergy-deep">Proyecto</span>
        <Select
          v-model="proyectoSeleccionado"
          :options="proyectos"
          optionLabel="nombre_comercial"
          optionValue="id"
          placeholder="Selecciona un proyecto…"
          filter
          showClear
          :loading="loadingProyectos"
          class="min-w-50 max-w-95 sm:min-w-65"
          @change="onProyectoChange"
        />
        <span v-if="proyectoSeleccionado && proyectoNombre"
          class="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap bg-primary/10 text-primary"
          >
          {{ proyectoNombre }}
        </span>
      </div>

      <!-- ── 4. Contenido del proyecto ─────────────────────────────────── -->
      <div v-if="loadingContrato" class="flex justify-center py-10">
        <LoaderCircleIcon class="size-6 animate-spin text-unergy-purple" />
      </div>

      <div v-else-if="proyectoSeleccionado" class="space-y-4 mt-3">

        <!-- Facturas históricas -->
        <FacturasMantenimiento :contrato-id="contratoMantenimientoId" />

        <!-- Cargar factura -->
        <div class="rounded-xl border bg-white overflow-hidden border-border">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div class="flex items-center gap-2">
              <UploadIcon class="size-3 text-unergy-purple" />
              <span class="text-sm font-semibold text-unergy-deep">Cargar factura</span>
            </div>
            <button type="button"
              class="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              @click="showCargarFactura = !showCargarFactura">
              <ChevronDownIcon class="text-xs transition-transform duration-200 size-4" :class="{ 'rotate-180': showCargarFactura }" />
              {{ showCargarFactura ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>

          <div v-show="showCargarFactura" class="px-4 py-3">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <!-- Tipo (siempre visible, primer campo) -->
              <div class="flex flex-col gap-1 md:col-span-2">
                <label class="text-xs font-medium text-muted-foreground">Tipo <span class="text-destructive">*</span></label>
                <div class="flex gap-2">
                  <label
                    class="flex-1 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
                    :class="facturaForm.tipo === 'solenium'
                      ? 'border-primary/50 bg-primary/5 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:border-border'">
                    <input type="radio" v-model="facturaForm.tipo" value="solenium" class="accent-unergy-purple" />
                    Proveedor O&amp;M (Solenium)
                  </label>
                  <label
                    class="flex-1 flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
                    :class="facturaForm.tipo === 'inversionistas'
                      ? 'border-chart-2/50 bg-chart-2/10 text-chart-2 font-semibold'
                      : 'border-border text-muted-foreground hover:border-border'">
                    <input type="radio" v-model="facturaForm.tipo" value="inversionistas" class="accent-chart-2" />
                    Cobros a clientes (Inversionistas)
                  </label>
                </div>
              </div>
              <!-- Período -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">Mes / Año</label>
                <input
                  type="month"
                  v-model="facturaForm.periodo"
                  class="text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <!-- N° Factura -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">N° Factura</label>
                <input
                  type="text"
                  v-model="facturaForm.numero"
                  placeholder="Ej: SOFV001"
                  class="text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <!-- Monto -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">Monto (COP)</label>
                <input
                  type="number"
                  v-model.number="facturaForm.monto"
                  placeholder="0"
                  class="text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <!-- Archivo -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">Archivo (PDF / imagen)</label>
                <label class="flex items-center gap-2 text-sm border border-dashed border-border rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-primary/50 transition-colors">
                  <PaperclipIcon class="text-muted-foreground size-3" />
                  <TruncatedText :text="facturaForm.archivo ? facturaForm.archivo.name : 'Seleccionar archivo…'" class="text-xs text-muted-foreground min-w-0" />
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
              <label class="text-xs font-medium text-muted-foreground">
                O pega el link de Google Drive / soporte digital
              </label>
              <input
                type="url"
                v-model="facturaForm.enlace"
                placeholder="https://drive.google.com/…"
                class="text-sm border border-border rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <!-- Botón -->
            <div class="flex items-center gap-3 mt-3">
              <button type="button"
                :disabled="!puedeGuardarFactura || guardandoFactura"
                class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 bg-unergy-purple text-primary-foreground border-0 cursor-pointer"
                @click="guardarFactura">
                <LoaderCircleIcon v-if="guardandoFactura" class="size-3 animate-spin" />
                <CheckIcon v-else class="size-3" />
                {{ guardandoFactura ? 'Guardando…' : 'Guardar factura' }}
              </button>
              <span v-if="facturaOk" class="text-xs text-success flex items-center gap-1">
                <CircleCheckIcon class="size-3" />Factura registrada
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- ══ TAB 1 — ARRIENDOS ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 1" class="bg-muted px-5 pt-4 pb-8 max-sm:p-3">
      <div class="overflow-hidden rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between gap-2.5 border-b border-border bg-card px-3.5 py-2">
          <div class="flex items-center gap-2">
            <BuildingIcon class="size-4 text-unergy-purple" />
            <span class="text-sm font-semibold text-unergy-deep">Panel Arriendos Mensual</span>
          </div>
          <div class="inline-flex rounded-lg border border-border bg-muted p-0.5">
            <button
              v-for="(tab, i) in SUBTABS_ARR"
              :key="i"
              class="relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-xs font-bold transition-all duration-150"
              :class="activeSubTabArr === i
                ? 'bg-unergy-purple text-unergy-avena shadow-sm'
                : 'text-muted-foreground hover:bg-unergy-purple/10 hover:text-unergy-deep'"
              @click="activeSubTabArr = i"
            >
              <component :is="tab.icon" class="size-3" />
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="bg-muted">
          <ArriendosOperaciones v-if="activeSubTabArr === 0" />
          <ArriendosInfo        v-if="activeSubTabArr === 1" />
        </div>
      </div>
    </div>

    <!-- ══ TAB 2 — SERVICIOS DE INTERNET ══════════════════════════════════ -->
    <div v-if="activeTab === 2" class="bg-muted px-5 pt-4 pb-8 max-sm:p-3">
      <div class="overflow-hidden rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between gap-2.5 border-b border-border bg-card px-3.5 py-2">
          <div class="flex items-center gap-2">
            <WifiIcon class="size-4 text-unergy-purple" />
            <span class="text-sm font-semibold text-unergy-deep">Starlink — Procesador de facturas PDF</span>
          </div>
        </div>
        <div class="bg-muted">
          <StarlinkPDF />
        </div>
      </div>
    </div>

    <!-- ══ TAB 3 — MANDATOS ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 3" class="bg-muted px-5 pt-4 pb-8 max-sm:p-3">
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
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()
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
      catalogoProyectos.cargar(),
      // Las minigranjas salen del mismo catalogo: antes era una segunda
      // peticion identica con un filtro que el propio dato ya trae.
      catalogoProyectos.cargar().then(l => l.filter(p => p.tipo_proyecto === 'minigranja')),
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
