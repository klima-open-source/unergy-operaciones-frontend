<template>
  <div class="space-y-5">
    <!-- Header con acción -->
    <PageHeader title="Servicios" subtitle="Gestión de contratos y servicios por tipo">
      <template #actions>
        <Button v-if="servicioActivo === 'ppa'" label="Nuevo contrato PPA" size="small" class="bg-amber-500 border-amber-500 hover:bg-amber-600" @click="showWizard = true">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else-if="servicioActivo !== 'ppa' && servicioActivo !== 'representacion'" :label="`Nuevo ${servicioInfo?.label}`" size="small" :style="`background:${servicioInfo?.color}; border-color:${servicioInfo?.color}`" @click="showServicioWizard = true">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Selector de servicio (tabs compactos) -->
    <div class="flex flex-wrap gap-2">
      <button v-for="srv in SERVICIOS" :key="srv.key" type="button"
        class="svc-tab" :class="{ 'svc-tab--on': servicioActivo === srv.key }"
        :style="servicioActivo === srv.key ? `background:${srv.bg}; border-color:${srv.color}55; color:${srv.color}` : ''"
        @click="seleccionarServicio(srv.key)">
        <component :is="srv.icon" class="size-[1em]" :style="servicioActivo === srv.key ? `color:${srv.color}` : ''" />
        <span>{{ srv.label }}</span>
        <span v-if="conteoServicio(srv.key) > 0" class="svc-tab-count"
          :style="servicioActivo === srv.key ? `background:${srv.color}22; color:${srv.color}` : ''">{{ conteoServicio(srv.key) }}</span>
      </button>
    </div>

    <!-- PPA -->
    <template v-if="servicioActivo === 'ppa'">
      <div class="flex gap-3 items-center">
        <IconField class="flex-1 max-w-sm">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filtroQ" placeholder="Buscar por proyecto, nombre, comprador…"
            class="w-full" @input="buscar" />
        </IconField>
      </div>

      <DataTable
        :value="contratosFiltrados"
        :loading="loading"
        stripedRows
        class="text-sm"
        paginator
        :rows="20"
        :rowsPerPageOptions="[10, 20, 50]"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        emptyMessage="No hay contratos PPA registrados."
        rowHover
        sortField="fecha_inicio"
        :sortOrder="1"
      >
        <Column field="nombre_interno" header="Nombre interno" sortable>
          <template #body="{ data }">
            <span class="font-medium text-gray-800">{{ data.nombre_interno || '—' }}</span>
          </template>
        </Column>
        <Column field="tipo_contrato" header="Tipo" sortable style="width:90px">
          <template #body="{ data }">
            <GBadge :color="(data.tipo_contrato === 'compra') ? '#915BD8' : '#F6FF72'" class="text-xs">{{ (data.tipo_contrato === 'compra') ? 'Compra' : 'Venta' }}</GBadge>
          </template>
        </Column>
        <Column field="numero_codigo_contrato" header="N° contrato" sortable style="width:160px">
          <template #body="{ data }">
            <span class="font-mono text-xs text-gray-500">{{ data.numero_codigo_contrato || '—' }}</span>
          </template>
        </Column>
        <Column header="Comprador">
          <template #body="{ data }">{{ data.comprador_nombre || '—' }}</template>
        </Column>
        <Column header="Vendedor">
          <template #body="{ data }">{{ data.vendedor_nombre || '—' }}</template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable style="width:100px">
          <template #body="{ data }">{{ formatFecha(data.fecha_inicio) }}</template>
        </Column>
        <Column field="fecha_fin" header="Fin" sortable style="width:100px">
          <template #body="{ data }">{{ formatFecha(data.fecha_fin) }}</template>
        </Column>
        <Column header="Días rest." style="width:90px">
          <template #body="{ data }">
            <span v-if="data.dias_restantes != null" class="font-mono text-xs"
              :style="{ color: data.dias_restantes <= 30 ? '#D64455' : data.dias_restantes <= 90 ? '#CA8A04' : '#6b5a8a' }">
              {{ data.dias_restantes }}d
            </span>
            <span v-else class="text-xs" style="color: #9CA3AF;">—</span>
          </template>
        </Column>
        <Column header="Cumplimiento" style="width:120px">
          <template #body="{ data }">
            <GBadge v-if="data.estado_cumplimiento"
              :color="CUMPLIMIENTO_SEVERITY[data.estado_cumplimiento] || 'default'" class="text-xs">{{ CUMPLIMIENTO_LABELS[data.estado_cumplimiento] || data.estado_cumplimiento }}</GBadge>
            <span v-else class="text-xs" style="color: #9CA3AF;">—</span>
          </template>
        </Column>
        <Column header="Cobertura" style="width:120px">
          <template #body="{ data }">
            <div v-if="data.cobertura_actual_pct != null" class="flex items-center gap-1.5">
              <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: #f3f0f7;">
                <div class="h-full rounded-full"
                  :style="{
                    width: Math.min(data.cobertura_actual_pct, 100) + '%',
                    backgroundColor: data.cobertura_actual_pct >= 90 ? '#10B981' : data.cobertura_actual_pct >= 70 ? '#F0C040' : '#D64455'
                  }" />
              </div>
              <span class="text-[10px] font-mono w-8 text-right" style="color: #6b5a8a;">{{ data.cobertura_actual_pct }}%</span>
            </div>
            <span v-else class="text-xs" style="color: #9CA3AF;">—</span>
          </template>
        </Column>
        <Column style="width:120px">
          <template #body="{ data }">
            <Button text size="small" severity="secondary" v-tooltip.top="'Duplicar contrato'" @click.stop="duplicarContrato(data)">
              <template #icon><CopyIcon class="size-[1em]" /></template>
            </Button>
            <Button text size="small" severity="secondary" @click.stop="irAContrato(data)" v-tooltip="'Ver detalle'">
              <template #icon><ArrowRightIcon class="size-[1em]" /></template>
            </Button>
            <Button text size="small" severity="danger" v-tooltip.top="'Eliminar contrato'" @click.stop="confirmarEliminar(data)">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- REPRESENTACIÓN — Lista de plantas -->
    <template v-else-if="servicioActivo === 'representacion'">
      <div class="flex gap-3 items-center">
        <IconField class="flex-1 max-w-sm">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filtroRepresentacion" placeholder="Buscar por planta, representante, comercializador…"
            class="w-full" />
        </IconField>
      </div>

      <DataTable
        :value="plantasRepresentacionFiltradas"
        :loading="loadingPlantas"
        stripedRows
        class="text-sm"
        paginator
        :rows="20"
        :rowsPerPageOptions="[10, 20, 50]"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        emptyMessage="No hay plantas con servicio de representación."
        rowHover
        sortField="nombre_comercial"
        :sortOrder="1"
      >
        <Column field="nombre_comercial" header="Planta" sortable>
          <template #body="{ data }">
            <span class="font-medium text-gray-800">{{ data.nombre_comercial }}</span>
          </template>
        </Column>
        <Column field="potencia_instalada_kwp" header="Potencia AC (kW)" sortable style="width:130px">
          <template #body="{ data }">
            <span class="text-gray-600">{{ data.potencia_instalada_kwp ? Number(data.potencia_instalada_kwp).toLocaleString('es-CO') : '—' }}</span>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width:130px">
          <template #body="{ data }">
            <GBadge :color="ESTADO_PROYECTO_SEVERITY[data.estado]">{{ ESTADO_PROYECTO_LABELS[data.estado] || data.estado }}</GBadge>
          </template>
        </Column>
        <Column header="Ubicación" style="width:180px">
          <template #body="{ data }">
            <span class="text-gray-600 text-xs">{{ [data.municipio, data.departamento].filter(Boolean).join(', ') || '—' }}</span>
          </template>
        </Column>
        <Column header="Representante" style="width:180px">
          <template #body="{ data }">
            <span class="text-gray-700">{{ data.servicio_representacion?.nombre_rf || '—' }}</span>
          </template>
        </Column>
        <Column header="Modalidad venta" style="width:160px">
          <template #body="{ data }">
            <GBadge v-if="data.servicio_representacion?.modalidad_venta"
              color="information">{{ MODALIDAD_LABELS[data.servicio_representacion.modalidad_venta] || data.servicio_representacion.modalidad_venta }}</GBadge>
            <span v-else class="text-gray-300">—</span>
          </template>
        </Column>
        <Column header="Cód. despacho XM" style="width:140px">
          <template #body="{ data }">
            <span class="font-mono text-xs text-gray-500">{{ data.servicio_representacion?.codigo_despacho_xm || '—' }}</span>
          </template>
        </Column>
        <Column header="CGM" style="width:60px">
          <template #body="{ data }">
            <CircleCheckIcon class="text-green-500 size-[1em]" v-if="data.srv_cgm" v-tooltip="'Tiene CGM'" />
            <MinusIcon class="text-gray-300 size-[1em]" v-else />
          </template>
        </Column>
        <Column style="width:50px">
          <template #body="{ data }">
            <Button text size="small" severity="secondary" @click.stop="irAProyecto(data)" v-tooltip="'Ver planta'">
              <template #icon><ArrowRightIcon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- OPERACIÓN / REC — contratos de servicio -->
    <template v-else>
      <div class="flex gap-3 items-center">
        <IconField class="flex-1 max-w-sm">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filtroServicio" placeholder="Buscar por número, contratante, prestador…"
            class="w-full" @input="buscarServicio" />
        </IconField>
      </div>

      <DataTable
        :value="contratosServicioFiltrados"
        :loading="loadingServicio"
        stripedRows
        class="text-sm"
        paginator
        :rows="20"
        :rowsPerPageOptions="[10, 20, 50]"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :emptyMessage="`No hay contratos de ${servicioInfo?.label} registrados.`"
        rowHover
        sortField="fecha_inicio"
        :sortOrder="1"
      >
        <Column field="numero_contrato" header="N° contrato" sortable style="width:160px">
          <template #body="{ data }">
            <span class="font-mono text-xs text-gray-500">{{ data.numero_contrato || '—' }}</span>
          </template>
        </Column>
        <Column header="Contratante">
          <template #body="{ data }">{{ data.contratante_nombre || '—' }}</template>
        </Column>
        <Column header="Prestador">
          <template #body="{ data }">{{ data.prestador_nombre || '—' }}</template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable style="width:100px">
          <template #body="{ data }">{{ formatFecha(data.fecha_inicio) }}</template>
        </Column>
        <Column field="fecha_fin" header="Fin" sortable style="width:100px">
          <template #body="{ data }">{{ formatFecha(data.fecha_fin) }}</template>
        </Column>
        <Column header="Estado" style="width:120px">
          <template #body="{ data }">
            <GBadge :color="ESTADO_SEVERITY[data.estado]">{{ ESTADO_LABELS[data.estado] || data.estado }}</GBadge>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Wizards -->
    <PPAContratoWizard v-if="showWizard" :visible="showWizard"
      :initialData="contratoADuplicar"
      @cerrar="onWizardCerrar" @creado="onContratoCreado" />

    <ContratoServicioWizard
      v-if="showServicioWizard"
      :visible="showServicioWizard"
      :tipo="servicioActivo"
      @cerrar="showServicioWizard = false"
      @creado="onServicioCreado" />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import PPAContratoWizard from './PPAContratoWizard.vue'
import ContratoServicioWizard from './ContratoServicioWizard.vue'
import { PpaService } from '~/features/contratos/services/ppa'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ArrowRightIcon, BadgeCheckIcon, ChartColumnIcon, CircleCheckIcon, CopyIcon, FilePenIcon, MinusIcon, PlusIcon, SearchIcon, Trash2Icon, ZapIcon } from '@lucide/vue'

const ppaService = new PpaService()
const contratosServicioService = new ContratosServicioService()
const proyectosService = new ProyectosService()

const router = useRouter()
const confirm = useConfirm()

const SERVICIOS = [
  { key: 'ppa',           label: 'PPA',           icon: ZapIcon,      color: '#f59e0b', bg: '#fffbeb' },
  { key: 'representacion',label: 'Representación', icon: FilePenIcon, color: '#3b82f6', bg: '#eff6ff' },
  { key: 'operacion',     label: 'Operación',      icon: ChartColumnIcon, color: '#10b981', bg: '#f0fdf4' },
  { key: 'rec',           label: 'REC',            icon: BadgeCheckIcon,  color: '#14b8a6', bg: '#f0fdfa' },
]

const ESTADO_LABELS = {
  vigente:      'Vigente',
  vencido:      'Vencido',
  terminado:    'Terminado',
  en_renovacion:'En renovación',
}
const ESTADO_SEVERITY = {
  vigente:      'success',
  vencido:      'destructive',
  terminado:    'default',
  en_renovacion:'warning',
}

const ESTADO_PROYECTO_LABELS = {
  en_desarrollo: 'En desarrollo',
  en_operacion:  'En operación',
  suspendido:    'Suspendido',
  cancelado:     'Cancelado',
}
const ESTADO_PROYECTO_SEVERITY = {
  en_desarrollo: 'warning',
  en_operacion:  'success',
  suspendido:    'destructive',
  cancelado:     'default',
}

const MODALIDAD_LABELS = {
  bolsa_directa:        'Bolsa directa',
  bolsa_comercializador:'Bolsa comercializador',
  ppa:                  'PPA',
  interna:              'Interna',
}

const CUMPLIMIENTO_LABELS = {
  on_track: 'Al día',
  at_risk: 'En riesgo',
  deficit: 'Déficit',
}
const CUMPLIMIENTO_SEVERITY = {
  on_track: 'success',
  at_risk: 'warning',
  deficit: 'destructive',
}

const servicioActivo = ref('ppa')
const showWizard = ref(false)
const showServicioWizard = ref(false)
const contratoADuplicar = ref(null)

function duplicarContrato(contrato) {
  contratoADuplicar.value = contrato
  showWizard.value = true
}

function confirmarEliminar(contrato) {
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Seguro que deseas eliminar el contrato "${contrato.nombre_interno || contrato.numero_codigo_contrato || 'sin nombre'}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminar(contrato.id)
        contratos.value = contratos.value.filter(c => c.id !== contrato.id)
        toast.success('Contrato eliminado', { duration: 2000 })
      } catch (e) {
        const detail = e.data?.detail
        toast.error('No se puede eliminar', {
          description: detail || 'Error al eliminar el contrato.',
          duration: 6000,
        })
      }
    },
  })
}

function onWizardCerrar() {
  showWizard.value = false
  contratoADuplicar.value = null
}

const servicioInfo = computed(() => SERVICIOS.find(s => s.key === servicioActivo.value))

// PPA
const contratos = ref([])
const loading = ref(false)
const filtroQ = ref('')

const contratosFiltrados = computed(() => {
  const q = filtroQ.value.toLowerCase()
  if (!q) return contratos.value
  return contratos.value.filter(c =>
    (c.nombre_interno ?? '').toLowerCase().includes(q) ||
    (c.numero_codigo_contrato ?? '').toLowerCase().includes(q) ||
    (c.comprador_nombre ?? '').toLowerCase().includes(q) ||
    (c.proyectos ?? []).some(p => (p.nombre_comercial ?? '').toLowerCase().includes(q))
  )
})

// Plantas con representación
const plantasRepresentacion = ref([])
const loadingPlantas = ref(false)
const filtroRepresentacion = ref('')

const plantasRepresentacionFiltradas = computed(() => {
  const q = filtroRepresentacion.value.toLowerCase()
  if (!q) return plantasRepresentacion.value
  return plantasRepresentacion.value.filter(p =>
    (p.nombre_comercial ?? '').toLowerCase().includes(q) ||
    (p.servicio_representacion?.nombre_rf ?? '').toLowerCase().includes(q) ||
    (p.servicio_representacion?.nombre_comercializador ?? '').toLowerCase().includes(q) ||
    (p.departamento ?? '').toLowerCase().includes(q) ||
    (p.municipio ?? '').toLowerCase().includes(q)
  )
})

// Otros servicios (operación, rec)
const contratosServicio = ref([])
const loadingServicio = ref(false)
const filtroServicio = ref('')

const contratosServicioFiltrados = computed(() => {
  const q = filtroServicio.value.toLowerCase()
  if (!q) return contratosServicio.value
  return contratosServicio.value.filter(c =>
    (c.numero_contrato ?? '').toLowerCase().includes(q) ||
    (c.contratante_nombre ?? '').toLowerCase().includes(q) ||
    (c.prestador_nombre ?? '').toLowerCase().includes(q)
  )
})

function conteoServicio(key) {
  if (key === 'ppa') return contratos.value.length
  if (key === 'representacion' && servicioActivo.value === 'representacion') return plantasRepresentacion.value.length
  if (key === servicioActivo.value) return contratosServicio.value.length
  return 0
}

function seleccionarServicio(key) {
  servicioActivo.value = key
  filtroServicio.value = ''
  filtroRepresentacion.value = ''
  if (key === 'ppa') cargar()
  else if (key === 'representacion') cargarPlantasRepresentacion()
  else cargarServicio(key)
}

function formatFecha(f) {
  if (!f) return '—'
  return String(f).slice(0, 10)
}

function irAContrato(data) {
  router.push(`/contratos/${data.id}`)
}

function irAProyecto(data) {
  router.push(`/proyectos/${data.id}`)
}

let buscarTimeout = null
function buscar() {
  clearTimeout(buscarTimeout)
  buscarTimeout = setTimeout(cargar, 350)
}

let buscarServicioTimeout = null
function buscarServicio() {
  clearTimeout(buscarServicioTimeout)
}

function onContratoCreado() {
  cargar()
}

function onServicioCreado() {
  cargarServicio(servicioActivo.value)
}

async function cargar() {
  loading.value = true
  try {
    contratos.value = await ppaService.listar(filtroQ.value ? { q: filtroQ.value } : {})
  } catch (e) {
    toast.error('Error al cargar contratos', { description: e.message, duration: 3000 })
  } finally {
    loading.value = false
  }
}

async function cargarPlantasRepresentacion() {
  loadingPlantas.value = true
  try {
    plantasRepresentacion.value = await proyectosService.listarConServicioRepresentacion()
  } catch (e) {
    toast.error('Error al cargar plantas', { description: e.message, duration: 3000 })
  } finally {
    loadingPlantas.value = false
  }
}

async function cargarServicio(tipo) {
  loadingServicio.value = true
  try {
    contratosServicio.value = await contratosServicioService.listar({ tipo })
  } catch (e) {
    toast.error('Error al cargar contratos', { description: e.message, duration: 3000 })
  } finally {
    loadingServicio.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
.svc-tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border: 1px solid #E5E2EC; border-radius: 9px;
  background: #fff; font-size: 13px; font-weight: 700; color: #6b7280;
  cursor: pointer; transition: border-color .12s, color .12s, background .12s; user-select: none;
}
.svc-tab:hover { border-color: #cbb8e8; color: var(--color-unergy-deep); }
.svc-tab svg { font-size: 14px; color: #9ca3af; }
.svc-tab--on { box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.svc-tab-count {
  background: #EEF0F2; color: #6b7280; border-radius: 999px;
  font-size: 11px; font-weight: 800; padding: 0 7px; min-width: 20px; text-align: center;
}
</style>
