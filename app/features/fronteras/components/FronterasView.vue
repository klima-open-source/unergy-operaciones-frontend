<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader title="Fronteras Comerciales" :subtitle="errorCarga ? 'No se pudo cargar' : `${filteredFronteras.length} fronteras registradas`">
      <template #actions>
        <Button label="Descargar Excel" size="small" severity="secondary" outlined @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Nueva Frontera" size="small" @click="abrirCrear">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <!-- flex-nowrap + overflow-x-auto en vez de flex-wrap: si no caben los 5
         grupos en el ancho disponible, se desplaza horizontal en vez de
         partirse en dos líneas o truncar el texto de los dropdowns. -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-nowrap gap-3 items-end border overflow-x-auto" style="border-color:#ECE7F2">
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
        <span class="p-input-icon-left">
          <SearchIcon class="size-[1em]" />
          <InputText v-model="search" placeholder="Buscar frontera..." class="w-48" />
        </span>
      </div>
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-600 mb-1">Estado</label>
        <Dropdown v-model="estadoFilter" :options="estadoOptions" optionLabel="label" optionValue="value"
                  class="w-40" placeholder="Todos" showClear />
      </div>
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-600 mb-1">Proyecto</label>
        <Dropdown v-model="proyectoFilter" :options="proyectoOptions" optionLabel="label" optionValue="value"
                  class="w-48" placeholder="Todos" showClear filter />
      </div>
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-600 mb-1">Operador</label>
        <Dropdown v-model="operadorFilter" :options="operadorOptions" optionLabel="label" optionValue="value"
                  class="w-40" placeholder="Todos" showClear />
      </div>
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-600 mb-1">Registro ASIC</label>
        <div class="flex gap-2">
          <Dropdown v-model="mesFilter" :options="mesOptions" optionLabel="label" optionValue="value"
                    class="w-44" placeholder="Mes" showClear />
          <Dropdown v-model="anioFilter" :options="anioOptions" optionLabel="label" optionValue="value"
                    class="w-32" placeholder="Año" showClear />
        </div>
      </div>
    </div>

    <!-- Resumen Card -->
    <div class="flex flex-wrap gap-4">
      <div v-for="stat in stats" :key="stat.label"
           class="bg-white rounded-xl shadow-sm p-4 h-20 flex-1 min-w-[9rem] flex flex-col justify-center"
           :class="{ 'cursor-pointer select-none': stat.clave }"
           :style="{
             border: stat.clave && soloGenerando ? '1.5px solid #3B82F6' : '1px solid #e8e0f0',
             background: stat.clave && soloGenerando ? 'rgba(59,130,246,0.06)' : '#fff',
           }"
           v-tooltip.top="stat.clave ? 'Clic para filtrar' : undefined"
           @click="stat.clave === 'generando' && (soloGenerando = !soloGenerando)">
        <p class="text-xs uppercase tracking-wide font-semibold" style="color: #6b5a8a;">{{ stat.label }}</p>
        <p class="text-2xl font-bold mt-1" :style="{ color: stat.color }">{{ stat.value }}</p>
      </div>
    </div>

    <!-- Aviso: fronteras nuevas detectadas en Quoia -->
    <div v-if="pendientesQuoia.length" class="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
         style="background: rgba(214,68,85,0.06); border: 1.5px solid rgba(214,68,85,0.25);">
      <span class="text-sm font-medium" style="color: #D64455;">
        <TriangleAlertIcon class="text-xs mr-1.5 size-[1em]" />
        {{ pendientesQuoia.length }} {{ pendientesQuoia.length === 1 ? 'frontera nueva detectada' : 'fronteras nuevas detectadas' }} en Quoia, sin registrar aquí
      </span>
      <Button label="Revisar" size="small" text style="color: #D64455;" @click="abrirPendientes" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <!-- Fallo de carga: explicito, para no confundirlo con "no hay fronteras" -->
    <div v-else-if="errorCarga" class="bg-white rounded-xl shadow-sm p-8 text-center" style="border: 1px solid #f0d0d0;">
      <p class="font-semibold" style="color: #b42318;">No se pudo cargar el listado</p>
      <p class="text-sm mt-1" style="color: #6b7280;">{{ errorCarga }}</p>
      <Button label="Reintentar" size="small" class="mt-4" @click="loadData" />
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
      <DataTable :value="filteredFronteras" :paginator="true" :rows="20"
                 :rowsPerPageOptions="[10, 20, 50]" responsiveLayout="scroll"
                 stripedRows class="p-datatable-sm">
        <Column field="codigo_frontera" header="Código" sortable style="min-width: 140px">
          <template #body="{ data }">
            <span class="font-mono text-sm font-semibold" style="color: var(--color-unergy-purple);">{{ data.codigo_frontera || '—' }}</span>
          </template>
        </Column>
        <Column field="nombre_frontera" header="Nombre" sortable style="min-width: 200px">
          <template #body="{ data }">
            {{ formatearNombre(data.nombre_frontera) }}
          </template>
        </Column>
        <Column field="proyecto_nombre" header="Proyecto" sortable style="min-width: 180px">
          <template #body="{ data }">
            <RouterLink v-if="data.proyecto_id" :to="`/proyectos/${data.proyecto_id}`"
                        class="text-sm underline" style="color: var(--color-unergy-purple);">
              {{ data.proyecto_nombre || `#${data.proyecto_id}` }}
            </RouterLink>
            <span v-else class="text-sm" style="color: #999;">—</span>
          </template>
        </Column>
        <Column field="tipo_frontera" header="Tipo" sortable style="min-width: 130px">
          <template #body="{ data }">
            <GBadge :color="tipoSeverity(data.tipo_frontera)">{{ tipoLabel(data.tipo_frontera) }}</GBadge>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="min-width: 120px">
          <template #body="{ data }">
            <GBadge :color="estadoSeverity(data.estado)">{{ data.estado }}</GBadge>
          </template>
        </Column>
        <Column field="fecha_registro_asic" header="Fecha Registro ASIC" sortable style="min-width: 150px">
          <template #body="{ data }">
            <span v-if="data.fecha_registro_asic" class="text-sm" style="color: #6b5a8a;">{{ data.fecha_registro_asic }}</span>
            <span v-else class="text-xs" style="color: #c4b8d4;">—</span>
          </template>
        </Column>
        <Column field="nro_serie_med_ppal" header="Serial Medidor Principal" style="min-width: 170px">
          <template #body="{ data }">
            <span v-if="data.nro_serie_med_ppal" class="font-mono text-xs" style="color: #6b5a8a;">{{ data.nro_serie_med_ppal }}</span>
            <span v-else class="text-xs" style="color: #c4b8d4;">—</span>
          </template>
        </Column>
        <Column field="nro_serie_med_resp" header="Serial Medidor Respaldo" style="min-width: 170px">
          <template #body="{ data }">
            <span v-if="data.nro_serie_med_resp" class="font-mono text-xs" style="color: #6b5a8a;">{{ data.nro_serie_med_resp }}</span>
            <span v-else class="text-xs" style="color: #c4b8d4;">—</span>
          </template>
        </Column>
        <Column field="operador_comercial" header="Operador" sortable style="min-width: 120px">
          <template #body="{ data }">
            {{ data.operador_comercial || data.operador_red || '—' }}
          </template>
        </Column>
        <Column field="capacidad_efectiva_mw" header="Cap. MW" sortable style="min-width: 100px">
          <template #body="{ data }">
            {{ data.capacidad_efectiva_mw ? Number(data.capacidad_efectiva_mw).toFixed(3) : '—' }}
          </template>
        </Column>
        <Column field="municipio" header="Municipio" sortable style="min-width: 130px" />
        <Column header="" style="width: 90px">
          <template #body="{ data }">
            <Button text rounded size="small" severity="secondary" @click="editFrontera(data)" v-tooltip="'Editar'">
              <template #icon><PencilIcon class="size-[1em]" /></template>
            </Button>
            <Button text rounded size="small" severity="danger" @click="deleteFrontera(data)" v-tooltip="'Eliminar'">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Edit Dialog -->
    <Dialog v-model:visible="showEdit" :header="editingFrontera ? 'Editar Frontera' : 'Frontera'"
      modal class="w-full max-w-2xl">
      <div v-if="editForm" class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Código frontera</label>
            <InputText v-model="editForm.codigo_frontera" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Nombre</label>
            <InputText v-model="editForm.nombre_frontera" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Estado</label>
            <Dropdown v-model="editForm.estado" :options="estadoOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Operador red</label>
            <Dropdown v-model="editForm.operador_red_id" :options="operadoresRedOptions" optionLabel="label"
              optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
          </div>
          <div class="col-span-2">
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Proyecto</label>
            <Dropdown v-model="editForm.proyecto_id" :options="proyectosAll" optionLabel="nombre_comercial"
              optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
          </div>
        </div>

        <!-- Ficha técnica medidor/módem (2026-08-14) -- antes solo vivía la
             marca a nivel de proyecto (un valor para las 4 combinaciones
             posibles ppal/resp x generación/consumo), acá sí se distingue
             cada medidor/módem real de esta frontera. -->
        <div class="pt-2" style="border-top: 1px solid #e8e0f0;">
          <p class="text-xs font-semibold uppercase mb-2" style="color: #6b5a8a;">Medidor principal</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Tipo de extracción</label>
              <InputText v-model="editForm.tipo_extraccion_ppal" class="w-full" placeholder="Ej. DLMS" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Contraseña del medidor</label>
              <InputText v-model="editForm.password_medidor_ppal" class="w-full" />
            </div>
          </div>
          <p class="text-xs font-semibold uppercase mt-3 mb-2" style="color: #6b5a8a;">Módem asociado</p>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Dirección IP</label>
              <InputText v-model="editForm.ip_modem_ppal" class="w-full" placeholder="10.10.10.1" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Puerto</label>
              <InputNumber v-model="editForm.puerto_modem_ppal" class="w-full" :useGrouping="false" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Canal de comunicación</label>
              <InputText v-model="editForm.canal_comunicacion_ppal" class="w-full" placeholder="Ej. IPsec" />
            </div>
          </div>
        </div>

        <div class="pt-2" style="border-top: 1px solid #e8e0f0;">
          <p class="text-xs font-semibold uppercase mb-2" style="color: #6b5a8a;">Medidor respaldo</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Tipo de extracción</label>
              <InputText v-model="editForm.tipo_extraccion_resp" class="w-full" placeholder="Ej. DLMS" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Contraseña del medidor</label>
              <InputText v-model="editForm.password_medidor_resp" class="w-full" />
            </div>
          </div>
          <p class="text-xs font-semibold uppercase mt-3 mb-2" style="color: #6b5a8a;">Módem asociado</p>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Dirección IP</label>
              <InputText v-model="editForm.ip_modem_resp" class="w-full" placeholder="10.10.10.1" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Puerto</label>
              <InputNumber v-model="editForm.puerto_modem_resp" class="w-full" :useGrouping="false" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Canal de comunicación</label>
              <InputText v-model="editForm.canal_comunicacion_resp" class="w-full" placeholder="Ej. IPsec" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="showEdit = false" />
        <Button label="Guardar" :loading="saving" @click="saveFrontera" />
      </template>
    </Dialog>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" header="Nueva Frontera" modal class="w-full max-w-lg">
      <div class="space-y-4 pt-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Proyecto</label>
            <Dropdown v-model="createForm.proyecto_id" :options="proyectosAll" optionLabel="nombre_comercial"
              optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Código frontera</label>
            <InputText v-model="createForm.codigo_frontera" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Nombre *</label>
            <InputText v-model="createForm.nombre_frontera" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Tipo *</label>
            <Dropdown v-model="createForm.tipo_frontera" :options="tipoOptions" optionLabel="label"
              optionValue="value" class="w-full" placeholder="Seleccionar" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Estado</label>
            <Dropdown v-model="createForm.estado" :options="estadoOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase block mb-1" style="color: #6b5a8a;">Operador red</label>
            <Dropdown v-model="createForm.operador_red_id" :options="operadoresRedOptions" optionLabel="label"
              optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="showCreate = false" />
        <Button label="Crear" :loading="creating" :disabled="!createForm.nombre_frontera || !createForm.tipo_frontera"
          @click="crearFrontera" />
      </template>
    </Dialog>

    <!-- Dialog: nombre parecido a una frontera existente -->
    <Dialog v-model:visible="duplicadoVisible" header="Frontera parecida ya existe" modal class="w-full max-w-sm">
      <p class="text-sm mb-4" style="color: #6b5a8a;">
        Ya existe una frontera con un nombre muy parecido:
        <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
        (ID {{ duplicadoInfo?.candidato_id }}).
        Si de verdad es una frontera distinta, puedes {{ pendingConfirmar ? 'agregarla' : 'crearla' }} igual.
      </p>
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" text
          @click="duplicadoVisible = false; pendingConfirmar = null" />
        <Button :label="pendingConfirmar ? 'Agregar de todos modos' : 'Crear de todos modos'"
          :loading="forzando" @click="forzarDuplicado" />
      </div>
    </Dialog>

    <!-- Pendientes de Quoia Dialog -->
    <Dialog v-model:visible="showPendientesDialog" header="Fronteras nuevas en Quoia" modal class="w-full max-w-3xl">
      <p class="text-sm mb-4" style="color: #6b5a8a;">
        Estas fronteras existen en Quoia pero todavía no tienen fila aquí. Asígnales un proyecto para agregarlas,
        o ignóralas si no aplican.
      </p>
      <div v-if="loadingPendientes" class="flex items-center justify-center py-8">
        <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
      </div>
      <div v-else-if="!pendientesQuoia.length" class="text-center py-8 text-sm" style="color: #9b89b5;">
        No hay fronteras pendientes por revisar.
      </div>
      <div v-else class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div v-for="p in pendientesQuoia" :key="p.frt_code"
          class="rounded-xl p-3 flex items-center gap-3" style="border: 1.5px solid #e8e0f0;">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate" style="color: var(--color-unergy-deep);">{{ p.nombre_quoia }}</p>
            <p class="text-xs font-mono" style="color: #9b89b5;">{{ p.frt_code }} · {{ p.categoria }}</p>
          </div>
          <Dropdown v-model="p._proyectoId" :options="proyectosAll" optionLabel="nombre_comercial" optionValue="id"
            placeholder="Proyecto..." filter showClear class="w-64" />
          <Button label="Agregar" size="small" :loading="p._loading === 'confirmar'" :disabled="!p._proyectoId" @click="confirmarPendiente(p)" style="background: var(--color-unergy-purple); border-color: var(--color-unergy-purple);">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
          <Button text severity="secondary" size="small" :loading="p._loading === 'ignorar'" @click="ignorarPendiente(p)" v-tooltip="'Ignorar'">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { logger } from '~/core/logger'
import { FronterasService } from '~/features/fronteras/services/fronteras'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { formatearNombre } from '~/utils/nombreFormato'
import { exportarExcel } from '~/utils/exportarExcel'
import { CheckIcon, FileSpreadsheetIcon, LoaderCircleIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, XIcon } from '@lucide/vue'

const confirm = useConfirm()
const fronterasService = new FronterasService()
const proyectosService = new ProyectosService()
const operadoresRedService = new OperadoresRedService()

const route = useRoute()
const router = useRouter()

const fronteras = ref([])
const loading = ref(true)
/** Mensaje del ultimo fallo de carga; null si la ultima carga salio bien. */
const errorCarga = ref(null)
const saving = ref(false)

// Filtros sincronizados con la URL (?q=&estado=&proyecto=&operador=&mes=&anio=&generando=)
// para que se sostengan al volver con el boton "atras" o al refrescar.
const search = ref(route.query.q || '')
const estadoFilter = ref(route.query.estado || null)
const proyectoFilter = ref(route.query.proyecto ? Number(route.query.proyecto) : null)
const operadorFilter = ref(route.query.operador || null)
const mesFilter = ref(route.query.mes ? Number(route.query.mes) : null)
const anioFilter = ref(route.query.anio ? Number(route.query.anio) : null)
const soloGenerando = ref(route.query.generando === '1')

watch([search, estadoFilter, proyectoFilter, operadorFilter, mesFilter, anioFilter, soloGenerando], ([q, estado, proyecto, operador, mes, anio, generando]) => {
  const query = {}
  if (q) query.q = q
  if (estado) query.estado = estado
  if (proyecto) query.proyecto = proyecto
  if (operador) query.operador = operador
  if (mes) query.mes = mes
  if (anio) query.anio = anio
  if (generando) query.generando = '1'
  router.replace({ query })
})
const showEdit = ref(false)
const editingFrontera = ref(null)
const editForm = ref(null)
function blankCreateForm() {
  return {
    proyecto_id: null,
    codigo_frontera: '',
    nombre_frontera: '',
    tipo_frontera: null,
    estado: 'activa',
    operador_red_id: null,
  }
}

const showCreate = ref(false)
const creating = ref(false)
const createForm = ref(blankCreateForm())

// Aviso de nombre parecido (409 estructurado, igual que en Proyectos): se
// puede confirmar y crear igual con forzar=true.
const duplicadoVisible = ref(false)
const duplicadoInfo = ref(null)   // { mensaje, candidato_id, candidato_nombre }
const forzando = ref(false)

const estadoOptions = [
  { label: 'Activa', value: 'activa' },
  { label: 'En registro', value: 'en_registro' },
  { label: 'En falla', value: 'en_falla' },
  { label: 'Cancelada', value: 'cancelada' },
]

const tipoOptions = [
  { label: 'Generación', value: 'generacion' },
  { label: 'Consumo', value: 'consumo' },
  { label: 'Gen+Consumo', value: 'generacion_consumo' },
  { label: 'Auxiliar', value: 'consumo_auxiliar' },
  { label: 'Propio', value: 'consumo_propio' },
]

const proyectoOptions = computed(() => {
  const seen = new Map()
  for (const f of fronteras.value) {
    if (f.proyecto_id != null && !seen.has(f.proyecto_id)) {
      seen.set(f.proyecto_id, f.proyecto_nombre || `#${f.proyecto_id}`)
    }
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const operadorOptions = computed(() => {
  const seen = new Set()
  for (const f of fronteras.value) {
    const nombre = f.operador_comercial || f.operador_red
    if (nombre) seen.add(nombre)
  }
  return [...seen].sort().map(v => ({ label: v, value: v }))
})

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const mesOptions = MESES.map((label, i) => ({ label, value: i + 1 }))

const anioOptions = computed(() => {
  const seen = new Set()
  for (const f of fronteras.value) {
    if (!f.fecha_registro_asic) continue
    const anio = new Date(f.fecha_registro_asic).getFullYear()
    if (!isNaN(anio)) seen.add(anio)
  }
  return [...seen].sort((a, b) => b - a).map(v => ({ label: String(v), value: v }))
})

const filteredFronteras = computed(() => {
  let list = fronteras.value
  if (estadoFilter.value) list = list.filter(f => f.estado === estadoFilter.value)
  if (proyectoFilter.value) list = list.filter(f => f.proyecto_id === proyectoFilter.value)
  if (operadorFilter.value) list = list.filter(f => (f.operador_comercial || f.operador_red) === operadorFilter.value)
  if (mesFilter.value || anioFilter.value) {
    list = list.filter(f => {
      if (!f.fecha_registro_asic) return false
      const d = new Date(f.fecha_registro_asic)
      if (isNaN(d.getTime())) return false
      if (mesFilter.value && d.getMonth() + 1 !== mesFilter.value) return false
      if (anioFilter.value && d.getFullYear() !== anioFilter.value) return false
      return true
    })
  }
  if (soloGenerando.value) list = list.filter(generaDeVerdad)
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(f =>
      (f.codigo_frontera || '').toLowerCase().includes(s) ||
      (f.nombre_frontera || '').toLowerCase().includes(s) ||
      (f.proyecto_nombre || '').toLowerCase().includes(s) ||
      (f.operador_red || '').toLowerCase().includes(s) ||
      (f.operador_comercial || '').toLowerCase().includes(s) ||
      (f.municipio || '').toLowerCase().includes(s)
    )
  }
  return list
})

const TIPOS_GENERACION = ['generacion', 'generacion_consumo']

// "Genera de verdad" = tipo Generacion Y la corrida mas reciente del
// pipeline Reporte Energia (reporte_energia_generacion, via
// f.generando_actual) reporto energia real > 0. Reemplaza el criterio
// anterior (fecha_inicio_comercializacion contra la API de Unergy): esa
// fuente dejaba fuera fronteras sin identificador de monitoreo resuelto o
// sin datos en Unergy (ej. San Pelayo, Chiriguana N1 -- ambas confirmadas
// generando) aunque el pipeline propio ya las viera generar. f.generando_actual
// es null si el pipeline todavia no ha corrido para esa frontera (no
// implica que no genere) -- esas quedan fuera del conteo igual que antes.
function generaDeVerdad(f) {
  return TIPOS_GENERACION.includes(f.tipo_frontera) && f.generando_actual === true
}

const stats = computed(() => {
  const all = fronteras.value
  return [
    { label: 'Total', value: all.length, color: '#2C2039' },
    { label: 'Activas', value: all.filter(f => f.estado === 'activa').length, color: '#10B981' },
    { label: 'En registro', value: all.filter(f => f.estado === 'en_registro').length, color: '#F0C040' },
    { label: 'Generando actualmente', value: all.filter(generaDeVerdad).length, color: '#3B82F6', clave: 'generando' },
    { label: 'Cap. total MW', value: all.reduce((s, f) => s + (Number(f.capacidad_efectiva_mw) || 0), 0).toFixed(1), color: '#915BD8' },
  ]
})

function tipoLabel(t) {
  const map = { generacion: 'Generación', consumo: 'Consumo', generacion_consumo: 'Gen+Consumo', consumo_auxiliar: 'Auxiliar', consumo_propio: 'Propio' }
  return map[t] || t
}
function tipoSeverity(t) {
  if (t === 'generacion') return 'success'
  if (t === 'consumo') return 'information'
  return 'warning'
}
function estadoSeverity(e) {
  const map = { activa: 'success', en_registro: 'warning', en_falla: 'destructive', cancelada: 'default' }
  return map[e] || 'information'
}

async function descargarExcel() {
  await exportarExcel(filteredFronteras.value, [
    { header: 'Código', value: f => f.codigo_frontera || '' },
    { header: 'Nombre', value: f => formatearNombre(f.nombre_frontera) },
    { header: 'Proyecto', value: f => f.proyecto_nombre || '' },
    { header: 'Tipo', value: f => tipoLabel(f.tipo_frontera) },
    { header: 'Estado', value: f => f.estado || '' },
    { header: 'Fecha Registro ASIC', value: f => f.fecha_registro_asic || '' },
    { header: 'Serial Medidor Principal', value: f => f.nro_serie_med_ppal || '' },
    { header: 'Serial Medidor Respaldo', value: f => f.nro_serie_med_resp || '' },
    { header: 'Operador', value: f => f.operador_comercial || f.operador_red || '' },
    { header: 'Cap. MW', value: f => f.capacidad_efectiva_mw ? Number(f.capacidad_efectiva_mw).toFixed(3) : '' },
    { header: 'Municipio', value: f => f.municipio || '' },
  ], `fronteras_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Fronteras')
}

function editFrontera(f) {
  loadProyectosAll()
  editingFrontera.value = f
  editForm.value = {
    codigo_frontera: f.codigo_frontera,
    nombre_frontera: f.nombre_frontera,
    estado: f.estado,
    operador_red_id: f.operador_red_id || null,
    proyecto_id: f.proyecto_id || null,
    tipo_extraccion_ppal: f.tipo_extraccion_ppal || null,
    password_medidor_ppal: f.password_medidor_ppal || null,
    ip_modem_ppal: f.ip_modem_ppal || null,
    puerto_modem_ppal: f.puerto_modem_ppal || null,
    canal_comunicacion_ppal: f.canal_comunicacion_ppal || null,
    tipo_extraccion_resp: f.tipo_extraccion_resp || null,
    password_medidor_resp: f.password_medidor_resp || null,
    ip_modem_resp: f.ip_modem_resp || null,
    puerto_modem_resp: f.puerto_modem_resp || null,
    canal_comunicacion_resp: f.canal_comunicacion_resp || null,
  }
  showEdit.value = true
}

async function saveFrontera() {
  if (!editingFrontera.value || !editForm.value) return
  saving.value = true
  try {
    await fronterasService.actualizar(editingFrontera.value.id, editForm.value)
    toast.success('Frontera actualizada', { duration: 2000 })
    showEdit.value = false
    await loadData()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'Error al guardar', duration: 4000 })
  } finally {
    saving.value = false
  }
}

function abrirCrear() {
  createForm.value = blankCreateForm()
  showCreate.value = true
  loadProyectosAll()
}

const pendingCreatePayload = ref(null)  // body a reintentar con forzar=true

async function crearFrontera() {
  if (!createForm.value) return
  creating.value = true
  const body = { ...createForm.value, codigo_frontera: createForm.value.codigo_frontera || null }
  try {
    await fronterasService.crear(body)
    toast.success('Frontera creada', { duration: 2500 })
    showCreate.value = false
    await loadData()
  } catch (e) {
    const detail = e.data?.detail
    // Aviso de nombre parecido (409 estructurado): se puede confirmar y crear
    // igual. Distinto de un choque real de columna unica (detail es un string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      pendingCreatePayload.value = body
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'No se pudo crear la frontera',
      duration: 4000,
    })
  } finally {
    creating.value = false
  }
}

async function crearFronteraForzado() {
  forzando.value = true
  try {
    await fronterasService.crear(pendingCreatePayload.value, true)
    toast.success('Frontera creada', { duration: 2500 })
    duplicadoVisible.value = false
    showCreate.value = false
    await loadData()
  } catch (e) {
    const detail = e.data?.detail
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'No se pudo crear la frontera',
      duration: 4000,
    })
  } finally {
    forzando.value = false
  }
}

function deleteFrontera(f) {
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar la frontera ${f.codigo_frontera}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await fronterasService.eliminar(f.id)
        toast.success('Frontera eliminada', { duration: 2000 })
        await loadData()
      } catch (e) {
        toast.error('Error', { description: e.data?.detail || 'Error al eliminar', duration: 4000 })
      }
    },
  })
}

/**
 * Un fallo de carga tiene que VERSE como fallo.
 *
 * Antes este catch solo hacia logger.error() y dejaba `fronteras` en []. El
 * 2026-09-05 el listado llevaba cuatro dias respondiendo 500 (el backend
 * pedia `operador` a un campo que se llama `operador_red`) y la pantalla
 * decia "0 fronteras registradas": indistinguible de no tener ninguna. Nadie
 * lo reporto como error porque no parecia uno.
 */
async function loadData() {
  loading.value = true
  errorCarga.value = null
  try {
    fronteras.value = await fronterasService.listar({ limit: 500 })
  } catch (e) {
    logger.error('fronteras', e)
    errorCarga.value = e?.data?.detail || 'No se pudo cargar el listado de fronteras.'
    fronteras.value = []
    toast.error('Error al cargar fronteras', { description: errorCarga.value, duration: 6000 })
  } finally {
    loading.value = false
  }
}

// ── Fronteras pendientes de Quoia (detectar + confirmar manual) ────────────────
const pendientesQuoia = ref([])
const loadingPendientes = ref(false)
const showPendientesDialog = ref(false)
const proyectosAll = ref([])

async function loadPendientesQuoia() {
  try {
    const data = await fronterasService.listarPendientesQuoia()
    pendientesQuoia.value = data.map(p => ({ ...p, _proyectoId: p.proyecto_sugerido_id ?? null, _loading: null }))
  } catch (e) {
    // Gaia sin configurar u otro error -- no bloquea la vista, solo no se muestra el aviso.
    pendientesQuoia.value = []
  }
}

async function loadProyectosAll() {
  if (proyectosAll.value.length) return
  try {
    proyectosAll.value = await proyectosService.listar({ size: 500 })
  } catch {
    proyectosAll.value = []
  }
}

function abrirPendientes() {
  showPendientesDialog.value = true
  loadingPendientes.value = true
  Promise.all([loadPendientesQuoia(), loadProyectosAll()]).finally(() => { loadingPendientes.value = false })
}

/** Pendiente a reintentar con forzar=true tras confirmar el aviso de parecido. */
const pendingConfirmar = ref(null)

/**
 * Agrega una frontera que Quoia ya tiene y aca todavia no.
 *
 * El 409 de "ya existe una con nombre parecido" es un AVISO reintentable, no un
 * rechazo: el backend acepta `?forzar=true`. crearFrontera() ya lo trataba asi
 * desde siempre, pero este camino no, y el usuario quedaba sin salida -- solo
 * un "No se pudo agregar la frontera" (2026-09-05, al agregar la minigranja de
 * San Luis de Since).
 */
async function confirmarPendiente(p, forzar = false) {
  p._loading = 'confirmar'
  try {
    await fronterasService.confirmarPendienteQuoia(p.frt_code, p._proyectoId, forzar)
    pendientesQuoia.value = pendientesQuoia.value.filter(x => x.frt_code !== p.frt_code)
    duplicadoVisible.value = false
    pendingConfirmar.value = null
    toast.success('Frontera agregada', { duration: 2500 })
    await loadData()
  } catch (e) {
    const detail = e.data?.detail
    if (!forzar && e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      pendingConfirmar.value = p
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : (detail?.mensaje || 'No se pudo agregar la frontera'),
      duration: 5000,
    })
  } finally {
    p._loading = null
  }
}

/** El boton del dialogo de parecidos sirve a los dos caminos: crear y agregar pendiente. */
async function forzarDuplicado() {
  if (pendingConfirmar.value) {
    forzando.value = true
    try {
      await confirmarPendiente(pendingConfirmar.value, true)
    } finally {
      forzando.value = false
    }
    return
  }
  await crearFronteraForzado()
}

function ignorarPendiente(p) {
  confirm({
    title: 'Ignorar frontera de Quoia',
    description: `¿Ignorar "${p.nombre_quoia}" (${p.frt_code})? No volverá a aparecer como pendiente.`,
    confirmLabel: 'Ignorar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      p._loading = 'ignorar'
      try {
        await fronterasService.ignorarPendienteQuoia(p.frt_code)
        pendientesQuoia.value = pendientesQuoia.value.filter(x => x.frt_code !== p.frt_code)
        toast.success('Ignorada', { duration: 2000 })
      } catch (e) {
        toast.error('Error', { description: 'No se pudo ignorar', duration: 4000 })
      } finally {
        p._loading = null
      }
    },
  })
}

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref([])
const operadoresRedOptions = computed(() =>
  operadoresRed.value.map(o => ({ id: o.id, label: o.nombre_comercial || o.nombre_legal }))
)
async function loadOperadoresRed() {
  try {
    operadoresRed.value = await operadoresRedService.listar()
  } catch { /* graceful degrade -- el select queda vacío */ }
}

onMounted(() => {
  loadData()
  loadPendientesQuoia()
  loadOperadoresRed()
})

// Nota: el backfill de marca/modelo/serie de medidor (Quoia) ya no tiene
// botón aquí -- ya se corrió y hoy no queda nada por completar (Quoia no
// tiene más info para dar). El endpoint POST /fronteras/backfill-medidor
// sigue vivo en el backend por si hace falta correrlo puntualmente.
</script>
