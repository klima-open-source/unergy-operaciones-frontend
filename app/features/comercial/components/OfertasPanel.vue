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
<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type { Oferta } from '~/features/comercial/types'
import { CheckIcon, ExternalLinkIcon, FileTextIcon, LoaderCircleIcon, PlusIcon, SendIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DataTable`/`blocks/DatePicker`.
import DataTable from '~/components/blocks/DataTable.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { readDetail } from '~/core/errors'
import { ComercialService } from '~/features/comercial/services/comercial'
import { cargarProyectos, type ProyectoCatalogo } from './catalogos'
import {
  aFechaStr,
  alarmante,
  ayudaPrecio,
  ETAPAS,
  etiquetaPrecio,
  fmtFecha,
  labelTipo,
  placeholderPrecio,
  TIPOS_OFERTA,
} from './comercial'

const props = withDefaults(
  defineProps<{ oportunidadId: number; ofertas?: Oferta[] }>(),
  { ofertas: () => [] },
)
const emit = defineEmits<{ changed: [] }>()
const comercialService = new ComercialService()
const router = useRouter()

function asOferta(row: DataTableRow): Oferta {
  return row as unknown as Oferta
}

const columnas: DataTableColumn[] = [
  { key: 'planta_nombre', header: 'Planta' },
  { key: 'tipo', header: 'Tipo' },
  { key: 'servicios', header: 'Servicios buscados' },
  { key: 'codigo_seguimiento', header: 'Código' },
  { key: 'precio_detalle', header: 'Precio' },
  { key: 'estado', header: 'Etapa' },
  { key: 'fecha_oferta', header: 'Enviada' },
  { key: 'seguimientos', header: 'Toques' },
  { key: 'fecha_ultima_respuesta', header: 'Última respuesta' },
  { key: 'acciones', header: '' },
]

// Al crear solo tienen sentido las dos primeras etapas: firmar crea el contrato
// y se hace desde el tablero, no declarando una etapa.
const ETAPAS_INICIALES = [
  { label: 'Oportunidad — todavía no se envió', value: 'oportunidad' },
  { label: 'Oferta — ya se envió al cliente', value: 'oferta' },
]

const moviendo = ref<number | null>(null)
const tocando = ref<number | null>(null)
const showDialog = ref(false)
const guardando = ref(false)
const proyectos = ref<ProyectoCatalogo[]>([])
const cargandoProyectos = ref(false)

interface FormNuevaOferta {
  tipo: string | null
  planta_nombre: string
  proyecto_ids: number[]
  numero_oferta: string
  estado: string
  precio_detalle: string
  fecha_oferta: string | null
  fecha_tentativa_inicio: string | null
  fecha_fin_tentativa: string | null
}

function formVacio(): FormNuevaOferta {
  return {
    tipo: null,
    planta_nombre: '',
    proyecto_ids: [],
    numero_oferta: '',
    estado: 'oportunidad',
    precio_detalle: '',
    fecha_oferta: null,
    fecha_tentativa_inicio: null,
    fecha_fin_tentativa: null,
  }
}

const form = reactive<FormNuevaOferta>(formVacio())

const opcionesProyecto = computed(() =>
  proyectos.value.map((p) => ({
    label: [p.nombre_comercial, [p.municipio, p.departamento].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' — '),
    value: String(p.id),
  })),
)

// `MultiComboBox` trabaja con strings; el formulario los guarda como números.
const proyectoIdsStr = computed<string[]>({
  get: () => form.proyecto_ids.map(String),
  set: (v) => {
    form.proyecto_ids = v.map(Number)
  },
})

function reset() {
  Object.assign(form, formVacio())
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
    toast.warning('No se pudo cargar la lista de proyectos')
  } finally {
    cargandoProyectos.value = false
  }
})

async function cambiarEtapa(oferta: Oferta, estado: string) {
  if (!estado || estado === oferta.estado) return
  moviendo.value = oferta.id
  try {
    await comercialService.cambiarEstadoOferta(oferta.id, estado)
    emit('changed')
  } catch (err) {
    const e = err as { data?: unknown }
    toast.error('No se pudo cambiar la etapa', { description: readDetail(e.data) ?? '' })
  } finally {
    moviendo.value = null
  }
}

async function registrarSeguimiento(oferta: Oferta) {
  tocando.value = oferta.id
  try {
    await comercialService.registrarSeguimientoOferta(oferta.id)
    emit('changed')
  } catch (err) {
    const e = err as { data?: unknown }
    toast.error('No se pudo registrar el toque', { description: readDetail(e.data) ?? '' })
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
      proyecto_ids: form.proyecto_ids.length ? form.proyecto_ids : null,
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
    const e = err as { data?: unknown }
    toast.error('No se pudo guardar la oferta', { description: readDetail(e.data) ?? '' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm text-muted-foreground">
        {{ ofertas.length }} oferta(s) — una por planta × servicio
      </span>
      <Button size="sm" @click="abrirNueva">
        <PlusIcon class="size-4" />
        Agregar oferta
      </Button>
    </div>

    <DataTable
      :columns="columnas"
      :rows="ofertas as unknown as DataTableRow[]"
      row-key="id"
      empty-message="Sin ofertas todavía."
    >
      <template #cell="{ row, column }">
        <template v-if="column.key === 'planta_nombre'">
          <div>
            <div>{{ asOferta(row).planta_nombre || asOferta(row).ficha?.proyecto_nombre || '—' }}</div>
            <div v-if="asOferta(row).plantas?.length" class="text-[11px] text-muted-foreground">
              {{ asOferta(row).plantas!.map((p) => p.nombre_comercial).join(' · ') }}
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'tipo'">{{ labelTipo(asOferta(row).tipo) }}</template>
        <template v-else-if="column.key === 'servicios'">
          <template v-if="asOferta(row).detalle?.servicios?.length">
            <span
              v-for="s in asOferta(row).detalle!.servicios"
              :key="s"
              class="mr-1 mb-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
              >{{ s }}</span
            >
          </template>
          <span v-else class="text-muted-foreground/60">—</span>
          <div v-if="asOferta(row).detalle?.fpo" class="mt-1 text-xs text-muted-foreground">
            FPO: {{ asOferta(row).detalle!.fpo }}
          </div>
        </template>
        <template v-else-if="column.key === 'codigo_seguimiento'">
          <span class="font-mono text-xs">{{
            asOferta(row).codigo_seguimiento || asOferta(row).numero_oferta || '—'
          }}</span>
        </template>
        <template v-else-if="column.key === 'precio_detalle'">{{
          asOferta(row).precio_detalle || '—'
        }}</template>
        <!-- La etapa es de la oferta: cada una avanza sola. -->
        <template v-else-if="column.key === 'estado'">
          <Select
            :model-value="asOferta(row).estado"
            :disabled="moviendo === asOferta(row).id"
            @update:model-value="(v) => cambiarEtapa(asOferta(row), v as string)"
          >
            <SelectTrigger class="w-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="e in ETAPAS" :key="e.value" :value="e.value">{{ e.label }}</SelectItem>
            </SelectContent>
          </Select>
        </template>
        <template v-else-if="column.key === 'fecha_oferta'">
          <span v-if="asOferta(row).fecha_oferta">{{ fmtFecha(asOferta(row).fecha_oferta) }}</span>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'seguimientos'">
          <div class="flex items-center gap-2">
            <span :class="alarmante(asOferta(row)) ? 'font-semibold text-destructive' : ''">
              {{ asOferta(row).seguimientos || 0 }}
            </span>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :disabled="tocando === asOferta(row).id"
                  @click="registrarSeguimiento(asOferta(row))"
                >
                  <SendIcon class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Registrar un toque (reenvío o llamada de insistencia)</GTooltipContent>
            </GTooltip>
          </div>
        </template>
        <template v-else-if="column.key === 'fecha_ultima_respuesta'">
          <span v-if="asOferta(row).fecha_ultima_respuesta">{{
            fmtFecha(asOferta(row).fecha_ultima_respuesta)
          }}</span>
          <span v-else-if="asOferta(row).fecha_oferta" class="text-xs text-destructive">sin respuesta</span>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'acciones'">
          <div class="flex items-center">
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click="router.push(`/comercial?oferta=${asOferta(row).id}`)"
                >
                  <ExternalLinkIcon class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Abrir en el tablero (editar todo)</GTooltipContent>
            </GTooltip>
            <GTooltip v-if="asOferta(row).documento_url">
              <GTooltipTrigger as-child>
                <a :href="asOferta(row).documento_url" target="_blank" rel="noopener" class="p-2">
                  <FileTextIcon class="size-4 text-primary" />
                </a>
              </GTooltipTrigger>
              <GTooltipContent>Documento de la oferta</GTooltipContent>
            </GTooltip>
          </div>
        </template>
      </template>
    </DataTable>

    <Dialog v-model:open="showDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva oferta</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <div>
            <GLabel required>Tipo de oferta</GLabel>
            <Select
              :model-value="form.tipo ?? undefined"
              @update:model-value="(v) => (form.tipo = v as string)"
            >
              <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_OFERTA" :key="t.value" :value="t.value">{{
                  t.label
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <GLabel>Planta</GLabel>
            <Input v-model.trim="form.planta_nombre" placeholder="Ej: Balmora 1 y 2" />
          </div>
          <div>
            <GLabel>Plantas ya creadas en Proyectos</GLabel>
            <MultiComboBox
              v-model="proyectoIdsStr"
              :options="opcionesProyecto"
              :placeholder="cargandoProyectos ? 'Cargando…' : 'Buscá la planta por nombre, municipio o departamento…'"
              empty-message="No hay plantas cargadas"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <GLabel>Código de seguimiento</GLabel>
              <Input v-model.trim="form.numero_oferta" placeholder="Se autogenera (OP.…) si lo dejás vacío" />
            </div>
            <div>
              <GLabel>Etapa inicial</GLabel>
              <Select v-model="form.estado">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="e in ETAPAS_INICIALES" :key="e.value" :value="e.value">{{
                    e.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <GLabel>{{ etiquetaPrecio(form.tipo) }}</GLabel>
            <Input v-model.trim="form.precio_detalle" :placeholder="placeholderPrecio(form.tipo)" />
            <p v-if="ayudaPrecio(form.tipo)" class="mt-1 text-xs text-muted-foreground">
              {{ ayudaPrecio(form.tipo) }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <GLabel>Fecha de envío</GLabel>
              <DatePicker v-model="form.fecha_oferta" clearable />
            </div>
            <div>
              <GLabel>Inicio tentativo</GLabel>
              <DatePicker v-model="form.fecha_tentativa_inicio" clearable />
            </div>
            <div>
              <GLabel>Fin tentativo</GLabel>
              <DatePicker v-model="form.fecha_fin_tentativa" clearable />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showDialog = false">Cancelar</Button>
          <Button :disabled="!form.tipo || guardando" @click="guardar">
            <LoaderCircleIcon v-if="guardando" class="animate-spin" />
            <CheckIcon v-else class="size-4" />
            Crear oferta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
