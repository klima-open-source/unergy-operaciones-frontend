<template>
  <div class="space-y-4">
    <!-- Header -->
    <PageHeader title="Proyectos" subtitle="Portafolio de plantas y servicios">
      <template #actions>
        <Button label="Inversores minigranja" size="small" severity="secondary" outlined :loading="invBackfillLoading" @click="previewInversoresBackfill" v-tooltip.bottom="'Crea los 5 inversores típicos para minigranjas'">
          <template #icon><ZapIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar Excel" size="small" severity="secondary" outlined @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Nuevo proyecto" size="small" @click="openNew">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Aviso: proyectos pendientes de Sun Factory / Quoia -->
    <div v-if="pendientes.length" class="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
         style="background: rgba(214,68,85,0.06); border: 1.5px solid rgba(214,68,85,0.25);">
      <span class="text-sm font-medium" style="color: #D64455;">
        <TriangleAlertIcon class="text-xs mr-1.5 size-[1em]" />
        Proyectos pendientes ({{ pendientes.length }})
      </span>
      <Button label="Revisar" size="small" text style="color: #D64455;" @click="abrirPendientes" />
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filters.q" placeholder="Nombre comercial…" class="w-56" />
        </IconField>
      </div>
      <div>
        <label class="field-label">Estado</label>
        <Select v-model="filters.estado" :options="ESTADO_OPTIONS" optionLabel="label" optionValue="value"
                class="w-40" placeholder="Todos" showClear />
      </div>
      <div>
        <label class="field-label">Tipo</label>
        <Select v-model="filters.tipo_proyecto" :options="TIPO_OPTIONS" optionLabel="label" optionValue="value"
                class="w-44" placeholder="Todos" showClear />
      </div>
      <div>
        <label class="field-label">Departamento</label>
        <Select v-model="filters.departamento" :options="departamentoOptions" filter
                class="w-48" placeholder="Todos" showClear />
      </div>
      <div>
        <label class="field-label">Portafolio</label>
        <Select v-model="filters.portafolio_id" :options="portafolios" optionLabel="nombre" optionValue="id"
                filter class="w-48" placeholder="Todos" showClear />
      </div>
      <div>
        <label class="field-label">PPA</label>
        <MultiSelect v-model="filters.ppa" :options="ppaOptions" optionLabel="label" optionValue="value"
                     filter display="chip" class="w-64" placeholder="Todos"
                     :maxSelectedLabels="1" selectedItemsLabel="{0} PPAs" showClear />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-10 flex justify-center">
      <LoaderCircleIcon class="text-2xl text-gray-400 size-[1em] animate-spin" />
    </div>

    <!-- Sections by tipo -->
    <template v-else>
      <div v-if="!sectionList.length"
           class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-400">
        No se encontraron proyectos con los filtros aplicados.
      </div>

      <div v-for="section in sectionList" :key="section.tipo"
           class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">

        <!-- Section header (toggle) -->
        <button
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left select-none
                 hover:bg-gray-50 transition-colors duration-150"
          @click="toggleSection(section.tipo)">
          <!-- color dot -->
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :style="{ background: TIPO_DOT[section.tipo] || '#9CA3AF' }" />
          <!-- label -->
          <span class="font-semibold text-gray-800 text-sm flex-1">
            {{ TIPO_LABELS[section.tipo] || section.tipo }}
          </span>
          <!-- count -->
          <span class="text-xs text-gray-400 font-medium">
            ({{ section.items.length }})
          </span>
          <!-- chevron -->
          <ChevronDownIcon class="text-gray-400 text-xs ml-2 chevron-icon transition-transform duration-200 size-[1em]" :class="{ 'rotate-180': openSections.has(section.tipo) }" />
        </button>

        <!-- Collapsible table -->
        <div class="section-collapse" :class="{ open: openSections.has(section.tipo) }">
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-gray-50 border-t border-gray-100">
                  <!-- Sticky: Nombre + TSF -->
                  <th class="sticky-col text-left px-4 py-2.5 font-medium text-gray-500 text-xs
                              uppercase tracking-wide align-bottom" style="min-width:250px">
                    <span class="block text-[10px] text-gray-400 font-normal normal-case tracking-normal">
                      Cód. TSF
                    </span>
                    <span>Nombre comercial</span>
                  </th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom">Estado</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom">Tipo</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom">Ubicación</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom" style="min-width:130px">
                    <span class="block text-[10px] text-gray-400 font-normal normal-case tracking-normal">
                      1er día con generación
                    </span>
                    <span>Inicio comercialización</span>
                  </th>
                  <th class="text-right px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom">
                    <span class="block text-[10px] text-gray-400 font-normal normal-case tracking-normal">kWp</span>
                    <span>Cap. instalada</span>
                  </th>
                  <th class="text-right px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom">
                    <span class="block text-[10px] text-gray-400 font-normal normal-case tracking-normal">kW</span>
                    <span>Potencia AC</span>
                  </th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom" style="min-width:140px">Servicios</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom" style="min-width:150px">PPA</th>
                  <th class="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide
                              whitespace-nowrap align-bottom" style="min-width:110px">Inversionistas</th>
                  <th class="px-4 py-2.5 align-bottom" style="width:116px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in section.items" :key="row.id"
                    class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100 row-hover">

                  <!-- Nombre + TSF (sticky) -->
                  <td class="sticky-col px-4 py-2" style="min-width:250px">
                    <span class="block text-[11px] leading-tight"
                          :class="row.codigo_tsf ? 'text-gray-400' : 'text-gray-300'">
                      {{ row.codigo_tsf || '—' }}
                    </span>
                    <button type="button"
                            class="block text-left text-sm text-gray-800 font-medium leading-snug mt-0.5
                                   proyecto-nombre-link"
                            @click="goDetail(row)"
                            v-tooltip.bottom="'Ver detalle'">
                      {{ formatearNombreProyecto(row.nombre_comercial) }}
                    </button>
                  </td>

                  <!-- Estado -->
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span class="estado-badge inline-flex items-center gap-1.5"
                          :class="ESTADO_CLASS[row.estado] || 'estado-default'">
                      <span v-if="row.estado === 'en_operacion'" class="pulse-dot" />
                      {{ ESTADO_LABELS[row.estado] || row.estado || '—' }}
                    </span>
                  </td>

                  <!-- Tipo -->
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span class="tipo-badge"
                          :class="TIPO_BADGE_CLASS[row.tipo_proyecto] || 'badge-otro'">
                      {{ TIPO_LABELS[row.tipo_proyecto] || row.tipo_proyecto || '—' }}
                    </span>
                  </td>

                  <!-- Ubicación -->
                  <td class="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    <span v-if="row.municipio || row.departamento">
                      {{ row.municipio || '—' }}<span v-if="row.departamento">, {{ row.departamento }}</span>
                    </span>
                    <span v-else class="text-gray-300">—</span>
                  </td>

                  <!-- Inicio de comercialización (autoderivada del 1er día con generación) -->
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span v-if="row.fecha_inicio_comercializacion"
                          class="font-mono text-xs text-gray-600">
                      {{ fmtFecha(row.fecha_inicio_comercializacion) }}
                      <span v-if="row.fecha_comercializacion_editada_manual"
                            class="ml-1 text-[10px] text-gray-400 font-sans">manual</span>
                    </span>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>

                  <!-- Capacidad instalada (pestaña Técnico) -->
                  <td class="px-4 py-2 text-right font-mono text-xs text-gray-500">
                    {{ row.info_tecnica?.capacidad_instalada_kwp ?? '—' }}
                  </td>

                  <!-- Potencia AC (pestaña Técnico) -->
                  <td class="px-4 py-2 text-right font-mono text-xs text-gray-500">
                    {{ row.info_tecnica?.potencia_ac_kw ?? '—' }}
                  </td>

                  <!-- Servicios -->
                  <td class="px-4 py-2">
                    <div class="flex gap-1 flex-wrap">
                      <template v-for="srv in SERVICIOS_BADGES" :key="srv.key">
                        <span v-if="row[srv.key]"
                              class="srv-badge"
                              :class="{ 'tip': srv.tooltip }"
                              :data-tip="srv.tooltip || undefined">
                          {{ srv.badge }}
                        </span>
                      </template>
                    </div>
                  </td>

                  <!-- PPA asociado (un proyecto puede estar en varios contratos) -->
                  <td class="px-4 py-2">
                    <div v-if="row.ppa_contratos?.length" class="flex gap-1 flex-wrap">
                      <button v-for="c in row.ppa_contratos" :key="c.id"
                              type="button"
                              class="ppa-chip"
                              v-tooltip.bottom="ppaTooltip(c)"
                              @click="goPPA(row)">
                        {{ ppaLabel(c) }}
                      </button>
                    </div>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>

                  <!-- Inversionistas (avatares) -->
                  <td class="px-4 py-2">
                    <div v-if="row.inversionistas?.length"
                         class="avatar-stack"
                         :style="{ width: avatarStackWidth(Math.min(row.inversionistas.length, 4)) }">
                      <span v-for="(inv, idx) in row.inversionistas.slice(0, 3)" :key="inv.id"
                            class="avatar-circle tip"
                            :style="{ ...avatarColor(inv.cliente_nombre), left: (idx * 20) + 'px', zIndex: 10 - idx }"
                            :data-tip="inv.cliente_nombre">
                        {{ getInitials(inv.cliente_nombre) }}
                      </span>
                      <span v-if="row.inversionistas.length > 3"
                            class="avatar-circle avatar-more"
                            :style="{ left: '60px', zIndex: 7 }">
                        +{{ row.inversionistas.length - 3 }}
                      </span>
                    </div>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>

                  <!-- Acciones -->
                  <td class="px-4 py-2">
                    <div class="flex gap-0.5 justify-end">
                      <Button text size="small" @click="goDetail(row)" v-tooltip="'Ver detalle'">
                        <template #icon><EyeIcon class="size-[1em]" /></template>
                      </Button>
                      <Button text size="small" severity="info" @click="goEdit(row)" v-tooltip="'Editar'">
                        <template #icon><PencilIcon class="size-[1em]" /></template>
                      </Button>
                      <Button text size="small" severity="danger" @click="confirmDelete(row)" v-tooltip="'Eliminar'">
                        <template #icon><Trash2Icon class="size-[1em]" /></template>
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Dialog: Nuevo proyecto -->
    <Dialog v-model:visible="dialogVisible" header="Nuevo proyecto" modal class="w-full max-w-xl">
      <ProyectoForm @save="onCreate" @cancel="dialogVisible = false" />
    </Dialog>

    <!-- Dialog: Confirmar eliminación -->
    <Dialog v-model:visible="deleteVisible" header="Eliminar proyecto" modal class="w-full max-w-sm">
      <p class="text-sm text-gray-700 mb-4">
        ¿Estás seguro de que deseas eliminar
        <strong>{{ formatearNombreProyecto(deleteProyecto?.nombre_comercial) }}</strong>?
        Esta acción no se puede deshacer.
      </p>
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" @click="deleteVisible = false" />
        <Button label="Eliminar" severity="danger" :loading="deleting" @click="doDelete" />
      </div>
    </Dialog>

    <!-- Dialog: sembrar inversores típicos de minigranja -->
    <Dialog v-model:visible="invBackfillVisible" header="Inversores típicos de minigranja" modal class="w-full max-w-2xl">
      <div v-if="invBackfillReport" class="space-y-3 text-sm">
        <p class="text-gray-700">
          Se crearán los inversores típicos en cada proyecto que aún <b>no tiene ninguno</b>
          (nunca duplica): <b>Inversor 1, 2, 3</b> de 300 kW, <b>Inversor 4</b> de 50 kW y
          <b>Inversor 5</b> de 40 kW. Los números identifican cada inversor al reportar fallas.
        </p>

        <label class="flex items-center gap-2 text-gray-700 select-none cursor-pointer">
          <input type="checkbox" v-model="invBackfillSoloMini" @change="previewInversoresBackfill" />
          Solo proyectos con tipo <b>minigranja</b>
          <span class="text-xs text-gray-400">(desmarca para incluir cualquier proyecto sin inversores)</span>
        </label>

        <div class="flex flex-wrap gap-4 p-3 rounded-lg" style="background:#F6F3FB;">
          <span style="color:#16a34a;"><b>{{ invBackfillReport.a_sembrar }}</b> se sembrarán</span>
          <span style="color:#7a6e8a;"><b>{{ invBackfillReport.ya_tienen_inversores }}</b> ya tienen inversores</span>
          <span class="text-gray-400">{{ invBackfillReport.total_candidatos }} candidatos en total</span>
        </div>

        <div v-if="invBackfillReport.sembrados.length" class="max-h-60 overflow-y-auto border rounded-lg" style="border-color:#eee;">
          <table class="w-full text-xs">
            <tbody>
              <tr v-for="r in invBackfillReport.sembrados" :key="r.id" class="border-t" style="border-color:#f0f0f0;">
                <td class="px-3 py-1.5 text-gray-400">ID {{ r.id }}</td>
                <td class="px-3 py-1.5">{{ r.nombre }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-xs" style="color:#7a6e8a;">No hay proyectos pendientes de sembrar.</p>
      </div>

      <template #footer>
        <Button label="Cancelar" text @click="invBackfillVisible = false" :disabled="invBackfillExecuting" />
        <Button label="Sembrar" :loading="invBackfillExecuting" :disabled="!invBackfillReport || !invBackfillReport.a_sembrar" @click="applyInversoresBackfill">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

    <!-- Dialog: Nombre parecido a uno existente -->
    <Dialog v-model:visible="duplicadoVisible" header="Proyecto parecido ya existe" modal class="w-full max-w-sm">
      <p class="text-sm text-gray-700 mb-4">
        Ya existe un proyecto con un nombre muy parecido:
        <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
        (ID {{ duplicadoInfo?.candidato_id }}).
        Si de verdad es un proyecto distinto, puedes crearlo igual.
      </p>
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" @click="duplicadoVisible = false" />
        <Button label="Crear de todos modos" :loading="forzando" @click="duplicadoConfirmAction()" />
      </div>
    </Dialog>

    <!-- Dialog: Proyectos pendientes (Sun Factory / Quoia) -->
    <Dialog v-model:visible="pendientesVisible" header="Proyectos pendientes" modal class="w-full max-w-3xl">
      <p class="text-sm mb-4" style="color: #6b5a8a;">
        Sun Factory y Quoia reportan estos proyectos. Confirma para crearlos o
        actualizar el registro existente, o ignóralos si no aplican.
      </p>
      <div v-if="loadingPendientes" class="flex items-center justify-center py-8">
        <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
      </div>
      <div v-else-if="!pendientes.length" class="text-center py-8 text-sm" style="color: #9b89b5;">
        No hay proyectos pendientes por revisar.
      </div>
      <div v-else class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        <div v-for="p in pendientes" :key="p.clave" class="rounded-xl p-3" style="border: 1.5px solid #e8e0f0;">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="chip" :class="p.tipo_sugerencia === 'crear' ? 'chip-new' : 'chip-update'">
                  {{ p.tipo_sugerencia === 'crear' ? 'Nuevo' : 'Actualizar' }}
                </span>
                <span class="text-xs" style="color:#9b89b5;">{{ p.fuentes.join(' + ') }}</span>
              </div>
              <p class="text-sm font-semibold truncate" style="color:var(--color-unergy-deep);">
                {{ p.proyecto_nombre_actual || p.nombre_sugerido }}
              </p>
              <p v-if="p.tipo_sugerencia === 'actualizar' && p.proyecto_nombre_actual" class="text-xs" style="color:#9b89b5;">
                Sugerido: {{ p.nombre_sugerido }}
              </p>
            </div>
            <Button text severity="secondary" size="small" :loading="p._loading === 'ignorar'" @click="ignorarPendiente(p)" v-tooltip="'Ignorar'">
              <template #icon><XIcon class="size-[1em]" /></template>
            </Button>
          </div>

          <!-- Cambios sugeridos -->
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style="color:#6b5a8a;">
            <span v-if="p.estado_sugerido && p.estado_sugerido !== p.estado_actual">
              Estado: <b>{{ p.estado_actual ? `${ESTADO_LABELS[p.estado_actual] || p.estado_actual} → ` : '' }}{{ ESTADO_LABELS[p.estado_sugerido] || p.estado_sugerido }}</b>
            </span>
            <span v-if="p.fase_construccion_sugerida && p.fase_construccion_sugerida !== p.fase_construccion_actual">
              Fase: <b>{{ p.fase_construccion_sugerida }}</b>
            </span>
            <span v-if="p.potencia_ac_kw">Potencia AC: <b>{{ p.potencia_ac_kw.toFixed(1) }} kW</b></span>
            <span v-if="p.capacidad_instalada_kwp">Capacidad instalada: <b>{{ p.capacidad_instalada_kwp.toFixed(1) }} kWp</b></span>
            <span v-if="p.municipio">{{ p.municipio }}<span v-if="p.departamento">, {{ p.departamento }}</span></span>
          </div>

          <!-- Overrides editables (solo aplican al crear) -->
          <div v-if="p.tipo_sugerencia === 'crear'" class="flex flex-wrap gap-2 items-end">
            <div>
              <label class="field-label">Nombre comercial</label>
              <InputText v-model="p._nombre" class="w-56" />
            </div>
            <div>
              <label class="field-label">Tipo</label>
              <Select v-model="p._tipo" :options="TIPOS_PROYECTO" class="w-40" placeholder="Tipo" />
            </div>
            <Button label="Crear" size="small" :loading="p._loading === 'confirmar'" :disabled="!p._nombre" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" @click="confirmarPendiente(p)">
              <template #icon><CheckIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <div v-else class="flex justify-end">
            <Button label="Actualizar" size="small" :loading="p._loading === 'confirmar'" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" @click="confirmarPendiente(p)">
              <template #icon><CheckIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import ProyectoForm from './ProyectoForm.vue'
import { formatearNombreProyecto } from './proyectosUi'
import { exportarExcel } from '~/utils/exportarExcel'
import { CheckIcon, ChevronDownIcon, EyeIcon, FileSpreadsheetIcon, LoaderCircleIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, XIcon, ZapIcon } from '@lucide/vue'

const proyectosService = new ProyectosService()
const portafoliosService = new PortafoliosService()

const router = useRouter()
const route  = useRoute()

// ── Backfill inversores típicos de minigranja ────────────────────────────────
const invBackfillVisible   = ref(false)
const invBackfillReport    = ref(null)
const invBackfillLoading   = ref(false)
const invBackfillExecuting = ref(false)
const invBackfillSoloMini  = ref(true)

async function previewInversoresBackfill() {
  invBackfillLoading.value = true
  try {
    const data = await proyectosService.backfillInversores({
      dryRun: true,
      soloMinigranja: invBackfillSoloMini.value,
    })
    invBackfillReport.value = data
    invBackfillVisible.value = true
  } catch (e) {
    toast.error('No se pudo previsualizar', {
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  } finally {
    invBackfillLoading.value = false
  }
}

async function applyInversoresBackfill() {
  invBackfillExecuting.value = true
  try {
    const data = await proyectosService.backfillInversores({
      dryRun: false,
      soloMinigranja: invBackfillSoloMini.value,
    })
    toast.success('Inversores sembrados', {
      description: `${data.a_sembrar} proyectos ahora tienen sus 5 inversores`,
      duration: 5000,
    })
    invBackfillVisible.value = false
    invBackfillReport.value = null
    await load()
  } catch (e) {
    toast.error('El backfill falló', { description: e.data?.detail || e.message, duration: 6000 })
  } finally {
    invBackfillExecuting.value = false
  }
}

// ── Catálogos ──────────────────────────────────────────────────────────────────
const ESTADOS       = ['en_desarrollo', 'en_operacion', 'suspendido', 'cancelado']
const TIPOS_PROYECTO = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica']

const SERVICIOS_BADGES = [
  { key: 'srv_operacion',    badge: 'OP',   tooltip: null },
  { key: 'srv_representacion', badge: 'REP', tooltip: 'Reporte de energía producida' },
  { key: 'srv_cgm',          badge: 'CGM',  tooltip: 'Control y gestión de medición' },
  { key: 'srv_ppa',          badge: 'PPA',  tooltip: null },
  { key: 'srv_promotor',     badge: 'PROM', tooltip: null },
  { key: 'srv_rec',          badge: 'REC',  tooltip: null },
]

const TIPO_LABELS = {
  minigranja:        'Minigranja',
  autoconsumo:       'Autoconsumo',
  gd:                'GD',
  movilidad_electrica: 'Movilidad',
  otro:              'Otro',
}

// Dot color for section header
const TIPO_DOT = {
  minigranja:        '#10B981',
  autoconsumo:       '#6366F1',
  gd:                '#3B82F6',
  movilidad_electrica: '#8B5CF6',
  otro:              '#9CA3AF',
}

// CSS class for tipo pill
const TIPO_BADGE_CLASS = {
  minigranja:        'badge-minigranja',
  autoconsumo:       'badge-autoconsumo',
  gd:                'badge-gd',
  movilidad_electrica: 'badge-movilidad',
  otro:              'badge-otro',
}

// CSS class for estado pill
const ESTADO_CLASS = {
  en_operacion:   'estado-operacion',
  suspendido:     'estado-suspendido',
  en_construccion:'estado-construccion',
  en_desarrollo:  'estado-default',
  cancelado:      'estado-default',
}

const ESTADO_LABELS = {
  en_operacion:    'En operación',
  en_desarrollo:   'En desarrollo',
  suspendido:      'Suspendido',
  cancelado:       'Cancelado',
  en_construccion: 'En construcción',
}

// Opciones legibles para los filtros de Estado/Tipo (v-model sigue guardando el valor crudo)
const ESTADO_OPTIONS = ESTADOS.map(v => ({ value: v, label: ESTADO_LABELS[v] || v }))
const TIPO_OPTIONS   = TIPOS_PROYECTO.map(v => ({ value: v, label: TIPO_LABELS[v] || v }))

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: '#E1F5EE', fg: '#085041' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FAECE7', fg: '#712B13' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#FBEAF0', fg: '#72243E' },
]

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function avatarColor(name) {
  const c = AVATAR_PALETTE[hashStr(name || '') % AVATAR_PALETTE.length]
  return { background: c.bg, color: c.fg }
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Container width for N avatars (28px diameter, 20px step, 2px border overlap)
function avatarStackWidth(n) {
  return (28 + Math.max(0, n - 1) * 20) + 'px'
}

// ── Estado ─────────────────────────────────────────────────────────────────────
const allItems    = ref([])
const portafolios = ref([])
const loading     = ref(false)
const dialogVisible = ref(false)
const deleteVisible = ref(false)
const deleteProyecto = ref(null)
const deleting    = ref(false)
const duplicadoVisible = ref(false)
const duplicadoInfo = ref(null)   // { mensaje, candidato_id, candidato_nombre }
const pendingPayload = ref(null)  // payload a reintentar con forzar=true
const pendingInfoTecnica = ref(null)  // potencia_ac_kw/capacidad_instalada_kwp a reintentar junto con pendingPayload
// Qué reintentar con forzar=true al confirmar el diálogo -- crearForzado() para
// el alta manual, o un cierre sobre confirmarPendiente(p, true) para Pendientes.
const duplicadoConfirmAction = ref(null)
const forzando = ref(false)
const openSections = ref(new Set())    // reactive Set via full replacement

// Valor centinela del filtro de PPA: "proyectos sin ningún PPA asociado".
// Ningún contrato real tiene id negativo, así que puede convivir con los ids
// reales en la misma lista de opciones.
const PPA_SIN = -1

// Los filtros se sincronizan con la URL (?q=&estado=&tipo_proyecto=&portafolio_id=&departamento=&ppa=)
// para que se sostengan al volver con el boton "atras" o al refrescar --
// antes vivian solo en memoria local y se perdian en cada montaje del componente.
const filters = reactive({
  q: route.query.q || '',
  estado: route.query.estado || null,
  tipo_proyecto: route.query.tipo_proyecto || null,
  portafolio_id: route.query.portafolio_id ? Number(route.query.portafolio_id) : null,
  departamento: route.query.departamento || null,
  ppa: parsePpaQuery(route.query.ppa),
})

// ?ppa=12,45 -> [12, 45] (el centinela "sin PPA" viaja como -1)
function parsePpaQuery(raw) {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map(v => Number(v))
    .filter(v => Number.isInteger(v))
}

watch(filters, (f) => {
  const query = {}
  if (f.q) query.q = f.q
  if (f.estado) query.estado = f.estado
  if (f.tipo_proyecto) query.tipo_proyecto = f.tipo_proyecto
  if (f.portafolio_id) query.portafolio_id = f.portafolio_id
  if (f.departamento) query.departamento = f.departamento
  if (f.ppa?.length) query.ppa = f.ppa.join(',')
  router.replace({ query })
})

// Estado/Tipo/Portafolio/PPA ahora se filtran en el backend (antes se traian
// TODOS los proyectos -- hasta 500 -- y se filtraban en el cliente, así que un
// total mayor a 500 truncaba en silencio cualquier filtro). q y Departamento
// siguen siendo client-side: el backend no tiene esas columnas como filtro.
watch(
  () => [filters.estado, filters.tipo_proyecto, filters.portafolio_id, filters.ppa.join(',')],
  () => { load() },
)

// Departamentos presentes en los proyectos cargados, para el filtro (orden alfabético)
const departamentoOptions = computed(() => {
  const set = new Set(allItems.value.map(p => p.departamento).filter(Boolean))
  return [...set].sort((a, b) => a.localeCompare(b))
})

// ── PPA ────────────────────────────────────────────────────────────────────────
// Un proyecto puede estar en varios contratos PPA a la vez (relación N a N), así
// que el filtro es "tiene al menos uno de los PPA seleccionados".

function ppaLabel(c) {
  return c?.nombre_interno || c?.numero_codigo_contrato || `PPA ${c?.id}`
}

function ppaTooltip(c) {
  const partes = []
  if (c?.nombre_interno && c?.numero_codigo_contrato) partes.push(c.numero_codigo_contrato)
  if (c?.comprador_nombre) partes.push(`Comprador: ${c.comprador_nombre}`)
  const desde = c?.fecha_inicio ? fmtFecha(c.fecha_inicio) : null
  const hasta = c?.fecha_fin ? fmtFecha(c.fecha_fin) : null
  if (desde || hasta) partes.push(`${desde || '—'} → ${hasta || '—'}`)
  return partes.length ? `${ppaLabel(c)} · ${partes.join(' · ')}` : ppaLabel(c)
}

// Contratos presentes en los proyectos cargados, deduplicados por id
const ppaOptions = computed(() => {
  const porId = new Map()
  let sinPpa = 0
  for (const p of allItems.value) {
    if (!p.ppa_contratos?.length) { sinPpa++; continue }
    for (const c of p.ppa_contratos) {
      if (!porId.has(c.id)) porId.set(c.id, c)
    }
  }
  const opciones = [...porId.values()]
    .map(c => ({ value: c.id, label: ppaLabel(c) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  if (sinPpa) opciones.unshift({ value: PPA_SIN, label: `Sin PPA (${sinPpa})` })
  return opciones
})

function goPPA(row) { router.push(`/proyectos/${row.id}/ppa`) }

// ── Fechas ─────────────────────────────────────────────────────────────────────
function fmtFecha(v) {
  return v ? String(v).slice(0, 10) : '—'
}

// ── Filtrado + agrupación ──────────────────────────────────────────────────────
const filteredItems = computed(() => {
  let list = allItems.value
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(p => p.nombre_comercial?.toLowerCase().includes(q))
  }
  if (filters.estado)        list = list.filter(p => p.estado === filters.estado)
  if (filters.tipo_proyecto) list = list.filter(p => p.tipo_proyecto === filters.tipo_proyecto)
  if (filters.portafolio_id) list = list.filter(p => p.portafolio_id === filters.portafolio_id)
  if (filters.departamento)  list = list.filter(p => p.departamento === filters.departamento)
  if (filters.ppa?.length) {
    const sel = new Set(filters.ppa)
    list = list.filter(p => {
      const suyos = p.ppa_contratos || []
      if (!suyos.length) return sel.has(PPA_SIN)
      return suyos.some(c => sel.has(c.id))
    })
  }
  return list
})

const TIPO_ORDER = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica', 'otro']

const sectionList = computed(() => {
  const groups = {}
  for (const item of filteredItems.value) {
    const t = item.tipo_proyecto || 'otro'
    if (!groups[t]) groups[t] = []
    groups[t].push(item)
  }
  return TIPO_ORDER
    .filter(t => groups[t]?.length)
    .map(t => ({ tipo: t, items: groups[t] }))
})

// ── Secciones colapsables ──────────────────────────────────────────────────────
function toggleSection(tipo) {
  const s = new Set(openSections.value)
  if (s.has(tipo)) s.delete(tipo)
  else s.add(tipo)
  openSections.value = s
}

// ── Carga de datos ─────────────────────────────────────────────────────────────
async function loadPortafolios() {
  const data = await portafoliosService.listar()
  portafolios.value = data.portafolios ?? []
}

// Estado/Tipo/Portafolio/PPA se mandan al backend (ProyectosService.listarPaginado);
// pagina en loop (en vez de un solo page=1&size=500) para no truncar en
// silencio cuando el total supera 500 -- el bug que tenía la version anterior,
// que nunca mandaba filtros al backend. q y Departamento siguen client-side.
//
// `cargaVigente`: si el usuario cambia de filtro mientras load() todavia esta
// paginando la carga anterior (varias llamadas encadenadas por filtro rapido),
// una respuesta vieja que llega tarde ya NO debe pisar allItems con resultados
// de un filtro que el usuario ya no tiene seleccionado.
let cargaVigente = 0

async function load() {
  const idCarga = ++cargaVigente
  loading.value = true
  try {
    const ppaIds = filters.ppa.filter(v => v !== PPA_SIN)
    const sinPpa = filters.ppa.includes(PPA_SIN)

    const items = []
    let page = 1
    for (;;) {
      const data = await proyectosService.listarPaginado({
        page,
        size: 500,
        estado: filters.estado || undefined,
        tipo_proyecto: filters.tipo_proyecto || undefined,
        portafolio_id: filters.portafolio_id || undefined,
        ppaIds,
        sinPpa,
      })
      if (idCarga !== cargaVigente) return
      items.push(...(data.items ?? []))
      if (!data.items?.length) break
      if (data.total != null && items.length >= data.total) break
      page++
    }
    if (idCarga !== cargaVigente) return
    allItems.value = items
    // Abrir la primera sección automáticamente en la carga inicial
    if (openSections.value.size === 0) {
      const first = sectionList.value[0]?.tipo
      if (first) openSections.value = new Set([first])
    }
  } finally {
    if (idCarga === cargaVigente) loading.value = false
  }
}

onMounted(() => {
  load()
  loadPortafolios()
  loadPendientes()
})

function goDetail(row) { router.push(`/proyectos/${row.id}`) }
function goEdit(row)   { router.push(`/proyectos/${row.id}?edit=true`) }
function openNew()     { dialogVisible.value = true }

function nombrePortafolio(id) {
  return portafolios.value.find(pf => pf.id === id)?.nombre ?? null
}

async function descargarExcel() {
  await exportarExcel(filteredItems.value, [
    { header: 'Cód. TSF', value: p => p.codigo_tsf || '' },
    { header: 'Nombre comercial', value: p => formatearNombreProyecto(p.nombre_comercial) },
    { header: 'Estado', value: p => ESTADO_LABELS[p.estado] || p.estado || '' },
    { header: 'Tipo', value: p => TIPO_LABELS[p.tipo_proyecto] || p.tipo_proyecto || '' },
    { header: 'Portafolio', value: p => nombrePortafolio(p.portafolio_id) || '' },
    { header: 'Municipio', value: p => p.municipio || '' },
    { header: 'Departamento', value: p => p.departamento || '' },
    { header: 'Inicio comercialización', value: p => p.fecha_inicio_comercializacion ? fmtFecha(p.fecha_inicio_comercializacion) : '' },
    { header: 'Capacidad instalada (kWp)', value: p => p.info_tecnica?.capacidad_instalada_kwp ?? '' },
    { header: 'Potencia AC (kW)', value: p => p.info_tecnica?.potencia_ac_kw ?? '' },
    { header: 'PPA', value: p => (p.ppa_contratos || []).map(ppaLabel).join(', ') },
    { header: 'Inversionistas', value: p => (p.inversionistas || []).map(i => i.cliente_nombre).join(', ') },
  ], `proyectos_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Proyectos')
}

function confirmDelete(row) {
  deleteProyecto.value = row
  deleteVisible.value  = true
}

async function guardarInfoTecnicaSiAplica(proyectoId, infoTecnica) {
  if (!infoTecnica || (infoTecnica.potencia_ac_kw == null && infoTecnica.capacidad_instalada_kwp == null && infoTecnica.cantidad_total_paneles == null)) return
  try {
    await proyectosService.guardarInfoTecnica(proyectoId, infoTecnica)
  } catch (e) {
    toast.warning('Proyecto creado, pero la ficha técnica no se pudo guardar', {
      description: e.data?.detail,
      duration: 5000,
    })
  }
}

async function onCreate(payload, infoTecnica) {
  try {
    const proyecto = await proyectosService.crear(payload)
    await guardarInfoTecnicaSiAplica(proyecto.id, infoTecnica)
    toast.success('Proyecto creado', { duration: 3000 })
    dialogVisible.value = false
    load()
  } catch (e) {
    const detail = e.data?.detail
    // Aviso de nombre parecido (409 estructurado): se puede confirmar y crear
    // igual. Distinto de un choque real de columna única (detail es un string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      pendingPayload.value = payload
      pendingInfoTecnica.value = infoTecnica
      duplicadoConfirmAction.value = crearForzado
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'Error al guardar',
      duration: 4000,
    })
  }
}

async function crearForzado() {
  forzando.value = true
  try {
    const proyecto = await proyectosService.crear(pendingPayload.value, true)
    await guardarInfoTecnicaSiAplica(proyecto.id, pendingInfoTecnica.value)
    toast.success('Proyecto creado', { duration: 3000 })
    duplicadoVisible.value = false
    dialogVisible.value = false
    load()
  } catch (e) {
    const detail = e.data?.detail
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'Error al guardar',
      duration: 4000,
    })
  } finally {
    forzando.value = false
  }
}

async function doDelete() {
  deleting.value = true
  try {
    await proyectosService.eliminar(deleteProyecto.value.id)
    toast.success('Proyecto eliminado', { duration: 3000 })
    deleteVisible.value = false
    load()
  } catch (e) {
    const detail = e.data?.detail || 'Error al eliminar'
    toast.error('No se pudo eliminar', { description: detail, duration: 5000 })
  } finally {
    deleting.value = false
  }
}

// ── Proyectos pendientes (Sun Factory + Quoia) ──────────────────────────────
const pendientes = ref([])
const loadingPendientes = ref(false)
const pendientesVisible = ref(false)

async function loadPendientes() {
  try {
    const data = await proyectosService.listarPendientes()
    pendientes.value = data.map(p => ({
      ...p,
      _nombre: p.nombre_sugerido,
      _tipo: p.tipo_proyecto_sugerido || null,
      _loading: null,
    }))
  } catch {
    // Sun Factory/Quoia sin configurar u otro error -- no bloquea la vista.
    pendientes.value = []
  }
}

function abrirPendientes() {
  pendientesVisible.value = true
  loadingPendientes.value = true
  loadPendientes().finally(() => { loadingPendientes.value = false })
}

async function confirmarPendiente(p, forzar = false) {
  p._loading = 'confirmar'
  try {
    await proyectosService.confirmarPendiente(p.clave, {
      nombre_comercial: p.tipo_sugerencia === 'crear' ? p._nombre : undefined,
      tipo_proyecto: p.tipo_sugerencia === 'crear' ? p._tipo : undefined,
    }, forzar)
    pendientes.value = pendientes.value.filter(x => x.clave !== p.clave)
    duplicadoVisible.value = false
    toast.success(p.tipo_sugerencia === 'crear' ? 'Proyecto creado' : 'Proyecto actualizado', {
      duration: 3000,
    })
    load()
  } catch (e) {
    const detail = e.data?.detail
    // Mismo aviso de "nombre parecido" que en el alta manual -- evita que dos
    // candidatos pendientes distintos (p. ej. Sun Factory duplicado) creen el
    // mismo proyecto dos veces sin ningún aviso.
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      duplicadoConfirmAction.value = async () => {
        forzando.value = true
        try {
          await confirmarPendiente(p, true)
        } finally {
          forzando.value = false
        }
      }
      duplicadoVisible.value = true
      return
    }
    toast.error('No se pudo confirmar', {
      description: typeof detail === 'string' ? detail : (detail?.mensaje || e.message),
      duration: 5000,
    })
  } finally {
    p._loading = null
  }
}

function ignorarPendiente(p) {
  p._loading = 'ignorar'
  proyectosService.ignorarPendiente(p.clave)
    .then(() => {
      pendientes.value = pendientes.value.filter(x => x.clave !== p.clave)
    })
    .catch(e => {
      toast.error('No se pudo ignorar', {
        description: e.data?.detail || e.message,
        duration: 5000,
      })
    })
    .finally(() => { p._loading = null })
}
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
/* ── Misc ────────────────────────────────────────────────────────────────────── */
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }

/* Nombre del proyecto: clickeable -> abre el detalle */
.proyecto-nombre-link {
  cursor: pointer;
  transition: color 0.12s;
}
.proyecto-nombre-link:hover {
  color: var(--color-unergy-purple);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Sticky primera columna ──────────────────────────────────────────────────── */
.sticky-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #ffffff;
  border-right: 1px solid #E5E7EB;
  transition: background 0.1s;
}
thead .sticky-col {
  background: #F9FAFB;
  z-index: 3;
}
.row-hover:hover .sticky-col {
  background: #F8FAFC;
}

/* ── Collapsible sections ────────────────────────────────────────────────────── */
.section-collapse {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-out;
}
.section-collapse.open {
  /* Antes 4000px -- con secciones grandes (ej. Minigranja con 80+ filas de
     2 líneas cada una) el contenido superaba ese límite y se cortaba. Un
     valor bien holgado no cuesta nada (solo es el destino de la transición
     de max-height, no se reserva espacio real). */
  max-height: 20000px;
  transition: max-height 0.45s ease-in;
}

.chevron-icon {
  display: inline-block;
}

/* ── Chips: Proyectos pendientes (crear / actualizar) ─────────────────────────── */
.chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.chip-new    { background: #D1FAE5; color: #065F46; }
.chip-update { background: #EEEDFE; color: #3C3489; }

/* ── Estado badges ───────────────────────────────────────────────────────────── */
.estado-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.estado-operacion   { background: #D1FAE5; color: #065F46; }
.estado-suspendido  { background: #FEF3C7; color: #92400E; }
.estado-construccion{ background: #DBEAFE; color: #1E40AF; }
.estado-default     { background: #F3F4F6; color: #374151; }

/* ── Pulse dot (en_operacion) ────────────────────────────────────────────────── */
.pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  flex-shrink: 0;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { transform: scale(1);   opacity: 1;   }
  50%       { transform: scale(1.4); opacity: 0.65; }
}

/* ── Tipo badges ─────────────────────────────────────────────────────────────── */
.tipo-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge-minigranja  { background: #D1FAE5; color: #065F46; }
.badge-gd          { background: #DBEAFE; color: #1E40AF; }
.badge-autoconsumo { background: #E1F5EE; color: #085041; }
.badge-movilidad   { background: #EEEDFE; color: #3C3489; }
.badge-otro        { background: #F3F4F6; color: #374151; }

/* ── Service badges ──────────────────────────────────────────────────────────── */
.srv-badge {
  @apply bg-green-100 text-green-800 text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-default;
}

/* ── PPA chips (abren la pestaña PPA del proyecto) ───────────────────────────── */
.ppa-chip {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #EEEDFE;
  color: #3C3489;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.ppa-chip:hover {
  background: var(--color-unergy-purple);
  color: #ffffff;
}

/* ── Avatar stack ────────────────────────────────────────────────────────────── */
.avatar-stack {
  position: relative;
  height: 28px;
  flex-shrink: 0;
}
.avatar-circle {
  position: absolute;
  top: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  cursor: default;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.avatar-circle:hover {
  transform: translateY(-2px) scale(1.1);
  box-shadow: 0 3px 8px rgba(0,0,0,0.15);
  z-index: 30 !important;
}
.avatar-more {
  background: #F3F4F6;
  color: #6B7280;
  font-size: 9px;
}

/* ── Tooltip CSS puro (srv-badge y avatar-circle) ────────────────────────────── */
.tip {
  position: relative;
}
/* caja oscura */
.tip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  background: #1a1a1a;
  color: #fff;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 200;
}
/* flecha */
.tip::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 1px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  border: 5px solid transparent;
  border-top-color: #1a1a1a;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 200;
}
.tip:hover::after,
.tip:hover::before {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
