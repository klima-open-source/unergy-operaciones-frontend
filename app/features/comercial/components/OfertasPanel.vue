<!--
  Las ofertas del cliente, dentro de su ficha. La edición completa vive en el
  drawer del tablero (una sola fuente, un solo formulario): desde acá se agrega,
  se mueve de etapa y se salta al drawer.

  Bugs que arregla frente a la versión anterior:
  · Al crear una oferta, el selector «Etapa» se mostraba pero `guardar()` no
    enviaba `estado`: TODA oferta nueva nacía en «oportunidad» aunque eligieras
    otra.
  · No mandaba `proyecto_id` / `proyecto_ids`, así que la planta nunca se podía
    vincular a un proyecto real y la ficha operativa quedaba a medias.
  · No mandaba `fecha_fin_tentativa`, que es lo que le da periodo a un PPA en
    borrador.
-->
<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm" style="color:#7a6e8a">
        {{ ofertas.length }} oferta(s) — una por planta × servicio
      </span>
      <Button label="Agregar oferta" size="small" @click="abrirNueva">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <DataTable :value="ofertas" dataKey="id" class="text-sm" responsiveLayout="scroll">
      <Column header="Planta" style="min-width:12rem">
        <template #body="{ data }">
          <div>
            <div>{{ data.planta_nombre || data.ficha?.proyecto_nombre || '—' }}</div>
            <div v-if="data.plantas?.length" class="text-[11px]" style="color:#9b89b5">
              {{ data.plantas.map((p) => p.nombre_comercial).join(' · ') }}
            </div>
          </div>
        </template>
      </Column>
      <Column header="Tipo">
        <template #body="{ data }">{{ labelTipo(data.tipo) }}</template>
      </Column>
      <Column header="Servicios buscados">
        <template #body="{ data }">
          <template v-if="data.detalle?.servicios?.length">
            <span v-for="s in data.detalle.servicios" :key="s"
                  class="inline-block rounded px-1.5 py-0.5 mr-1 mb-1 text-xs"
                  style="background:#EFF6FF;color:#1D4ED8">{{ s }}</span>
          </template>
          <span v-else style="color:#c4b8d4">—</span>
          <div v-if="data.detalle?.fpo" class="text-xs mt-1" style="color:#9b89b5">
            FPO: {{ data.detalle.fpo }}
          </div>
        </template>
      </Column>
      <Column header="Código">
        <template #body="{ data }">
          <span class="font-mono text-xs">{{ data.codigo_seguimiento || data.numero_oferta || '—' }}</span>
        </template>
      </Column>
      <Column field="precio_detalle" header="Precio">
        <template #body="{ data }">{{ data.precio_detalle || '—' }}</template>
      </Column>
      <!-- La etapa es de la oferta: cada una avanza sola. -->
      <Column header="Etapa" style="min-width:11rem">
        <template #body="{ data }">
          <Select :modelValue="data.estado" :options="ETAPAS" optionLabel="label" optionValue="value"
                  class="w-full text-xs" :loading="moviendo === data.id"
                  @update:modelValue="(v) => cambiarEtapa(data, v)" />
        </template>
      </Column>
      <Column header="Enviada">
        <template #body="{ data }">
          <span v-if="data.fecha_oferta">{{ fmtFecha(data.fecha_oferta) }}</span>
          <span v-else style="color:#c4b8d4">—</span>
        </template>
      </Column>
      <Column header="Toques">
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <span :class="alarmante(data) ? 'font-semibold' : ''"
                  :style="{ color: alarmante(data) ? '#D64455' : 'inherit' }">
              {{ data.seguimientos || 0 }}
            </span>
            <Button text rounded size="small" :loading="tocando === data.id" v-tooltip.top="'Registrar un toque (reenvío o llamada de insistencia)'" @click="registrarSeguimiento(data)">
              <template #icon><SendIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </template>
      </Column>
      <Column header="Última respuesta">
        <template #body="{ data }">
          <span v-if="data.fecha_ultima_respuesta">{{ fmtFecha(data.fecha_ultima_respuesta) }}</span>
          <span v-else-if="data.fecha_oferta" class="text-xs" style="color:#D64455">sin respuesta</span>
          <span v-else style="color:#c4b8d4">—</span>
        </template>
      </Column>
      <Column header="Contrato">
        <template #body="{ data }">
          <router-link v-if="data.ppa_contrato_id" :to="`/contratos/${data.ppa_contrato_id}`"
                       class="text-xs underline" style="color:var(--color-unergy-purple)">PPA</router-link>
          <span v-else style="color:#c4b8d4">—</span>
        </template>
      </Column>
      <Column header="" style="width:8rem">
        <template #body="{ data }">
          <div class="flex items-center">
            <Button text rounded size="small" v-tooltip.left="'Abrir en el tablero (editar todo)'" @click="$router.push(`/comercial?oferta=${data.id}`)">
              <template #icon><ExternalLinkIcon class="size-[1em]" /></template>
            </Button>
            <a v-if="data.documento_url" :href="data.documento_url" target="_blank" rel="noopener"
               class="p-2" v-tooltip.left="'Documento de la oferta'">
              <FileTextIcon class="size-[1em]" style="color:var(--color-unergy-purple)" />
            </a>
          </div>
        </template>
      </Column>
      <template #empty><span class="text-sm" style="color:#9b89b5">Sin ofertas todavía.</span></template>
    </DataTable>

    <Dialog v-model:visible="showDialog" header="Nueva oferta" modal :style="{ width: '32rem' }">
      <div class="flex flex-col gap-3">
        <div>
          <label class="etiqueta">Tipo de oferta *</label>
          <Select v-model="form.tipo" :options="TIPOS_OFERTA" optionLabel="label" optionValue="value"
                  class="w-full" placeholder="Seleccionar…" />
        </div>
        <div>
          <label class="etiqueta">Planta</label>
          <InputText v-model.trim="form.planta_nombre" class="w-full" placeholder="Ej: Balmora 1 y 2" />
        </div>
        <div>
          <label class="etiqueta">Plantas ya creadas en Proyectos</label>
          <MultiSelect v-model="form.proyecto_ids" :options="proyectos" optionLabel="nombre_comercial"
                       :filterFields="['nombre_comercial', 'municipio', 'departamento']"
                       optionValue="id" filter display="chip" class="w-full"
                       :loading="cargandoProyectos"
                       placeholder="Buscá la planta por nombre, municipio o departamento…"
                       :emptyMessage="cargandoProyectos ? 'Cargando…' : 'No hay plantas cargadas'" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="etiqueta">Código de seguimiento</label>
            <InputText v-model.trim="form.numero_oferta" class="w-full"
                       placeholder="Se autogenera (OP.…) si lo dejás vacío" />
          </div>
          <div>
            <label class="etiqueta">Etapa inicial</label>
            <Select v-model="form.estado" :options="ETAPAS_INICIALES" optionLabel="label"
                    optionValue="value" class="w-full" />
          </div>
        </div>
        <div>
          <label class="etiqueta">{{ etiquetaPrecio(form.tipo) }}</label>
          <InputText v-model.trim="form.precio_detalle" class="w-full"
                     :placeholder="placeholderPrecio(form.tipo)" />
          <p v-if="ayudaPrecio(form.tipo)" class="etiqueta mt-1">{{ ayudaPrecio(form.tipo) }}</p>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="etiqueta">Fecha de envío</label>
            <DatePicker v-model="form.fecha_oferta" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
          <div>
            <label class="etiqueta">Inicio tentativo</label>
            <DatePicker v-model="form.fecha_tentativa_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
          <div>
            <label class="etiqueta">Fin tentativo</label>
            <DatePicker v-model="form.fecha_fin_tentativa" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" text severity="secondary" @click="showDialog = false" />
        <Button label="Crear oferta" :disabled="!form.tipo" :loading="guardando" @click="guardar">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import { toast } from 'vue-sonner'
import { ComercialService } from '~/features/comercial/services/comercial'
import {
  ETAPAS, TIPOS_OFERTA, labelTipo, fmtFecha, alarmante, aFechaStr,
  etiquetaPrecio, placeholderPrecio, ayudaPrecio,
} from './comercial.js'
import { cargarProyectos } from './catalogos.js'
import { CheckIcon, ExternalLinkIcon, FileTextIcon, PlusIcon, SendIcon } from '@lucide/vue'

const props = defineProps({
  oportunidadId: { type: [Number, String], required: true },
  ofertas: { type: Array, default: () => [] },
})
const emit = defineEmits(['changed'])
const comercialService = new ComercialService()

// Al crear solo tienen sentido las dos primeras etapas: firmar crea el contrato
// y se hace desde el tablero, no declarando una etapa.
const ETAPAS_INICIALES = [
  { label: 'Oportunidad — todavía no se envió', value: 'oportunidad' },
  { label: 'Oferta — ya se envió al cliente', value: 'oferta' },
]

const moviendo = ref(null)
const tocando = ref(null)
const showDialog = ref(false)
const guardando = ref(false)
const proyectos = ref([])
const cargandoProyectos = ref(false)

const form = reactive({
  tipo: null, planta_nombre: '', proyecto_ids: [], numero_oferta: '', estado: 'oportunidad',
  precio_detalle: '', fecha_oferta: null, fecha_tentativa_inicio: null, fecha_fin_tentativa: null,
})

function reset() {
  Object.assign(form, {
    tipo: null, planta_nombre: '', proyecto_ids: [], numero_oferta: '', estado: 'oportunidad',
    precio_detalle: '', fecha_oferta: null, fecha_tentativa_inicio: null, fecha_fin_tentativa: null,
  })
}

function abrirNueva() {
  reset()
  showDialog.value = true
}

watch(showDialog, async (abierto) => {
  if (!abierto || proyectos.value.length) return
  cargandoProyectos.value = true
  try {
    proyectos.value = await cargarProyectos()
  } catch {
    toast.warning('No se pudo cargar la lista de proyectos', { duration: 4000 })
  } finally {
    cargandoProyectos.value = false
  }
})

async function cambiarEtapa(oferta, estado) {
  if (!estado || estado === oferta.estado) return
  moviendo.value = oferta.id
  try {
    await comercialService.cambiarEstadoOferta(oferta.id, estado)
    emit('changed')
  } catch (err) {
    toast.error('No se pudo cambiar la etapa', {
      description: err.data?.detail ?? '',
      duration: 5000,
    })
  } finally {
    moviendo.value = null
  }
}

async function registrarSeguimiento(oferta) {
  tocando.value = oferta.id
  try {
    await comercialService.registrarSeguimientoOferta(oferta.id)
    emit('changed')
  } catch (err) {
    toast.error('No se pudo registrar el toque', {
      description: err.data?.detail ?? '',
      duration: 5000,
    })
  } finally {
    tocando.value = null
  }
}

async function guardar() {
  guardando.value = true
  try {
    await comercialService.crearOferta(props.oportunidadId, {
      tipo: form.tipo,
      planta_nombre: form.planta_nombre || null,
      proyecto_ids: form.proyecto_ids?.length ? form.proyecto_ids : null,
      numero_oferta: form.numero_oferta || null,
      // Antes no se enviaba: toda oferta nacía en 'oportunidad'.
      estado: form.estado,
      precio_detalle: form.precio_detalle || null,
      fecha_oferta: aFechaStr(form.fecha_oferta),
      fecha_tentativa_inicio: aFechaStr(form.fecha_tentativa_inicio),
      fecha_fin_tentativa: aFechaStr(form.fecha_fin_tentativa),
    })
    showDialog.value = false
    emit('changed')
  } catch (err) {
    toast.error('No se pudo guardar la oferta', {
      description: err.data?.detail ?? '',
      duration: 5000,
    })
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.etiqueta {
  display: block;
  font-size: 11px;
  color: #7a6e8a;
  margin-bottom: 0.15rem;
}
</style>
