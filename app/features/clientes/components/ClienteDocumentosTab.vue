<script setup lang="ts">
import type {
  DocumentoCliente,
  PayloadDocumentoCliente,
  TipoDocumentoCliente,
} from '~/features/clientes/types'
import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { ClientesService } from '~/features/clientes/services/clientes'

const TIPOS_DOC: { value: TipoDocumentoCliente; label: string }[] = [
  { value: 'rut', label: 'RUT' },
  { value: 'cedula_ciudadania', label: 'Cédula de ciudadanía' },
  { value: 'certificado_bancario', label: 'Certificado bancario' },
  { value: 'camara_comercio', label: 'Cámara de comercio' },
  { value: 'oferta', label: 'Oferta de servicio' },
  { value: 'contrato', label: 'Contrato de servicio' },
]

const ESTADOS_DOC = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'aceptado', label: 'Aceptado' },
  { value: 'firmado', label: 'Firmado' },
  { value: 'rechazado', label: 'Rechazado' },
]

const TIPOS_IDENTIFICACION: TipoDocumentoCliente[] = [
  'rut',
  'cedula_ciudadania',
  'certificado_bancario',
  'camara_comercio',
]
const TIPOS_COMERCIAL: TipoDocumentoCliente[] = ['oferta', 'contrato']

const BADGE_COLOR: Record<TipoDocumentoCliente, string> = {
  rut: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cedula_ciudadania: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  certificado_bancario: 'bg-success/10 text-success',
  camara_comercio: 'bg-warning/10 text-warning',
  oferta: 'bg-primary/10 text-primary',
  contrato: 'bg-success/10 text-success',
}

const props = defineProps<{
  clienteId: number
  documentos: DocumentoCliente[]
  nombreCliente: string
}>()
const emit = defineEmits<{ changed: [] }>()

const clientesService = new ClientesService()
const confirm = useConfirm()

const docsIdentificacion = computed(() =>
  props.documentos.filter((d) => TIPOS_IDENTIFICACION.includes(d.tipo)),
)
const docsComerciales = computed(() =>
  [...props.documentos]
    .filter((d) => TIPOS_COMERCIAL.includes(d.tipo))
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'oferta' ? -1 : 1)),
)

function tipoLabel(tipo: TipoDocumentoCliente) {
  return TIPOS_DOC.find((t) => t.value === tipo)?.label ?? tipo
}
function estadoLabel(estado: string) {
  return ESTADOS_DOC.find((e) => e.value === estado)?.label ?? estado
}

function nombreSugerido(tipo: TipoDocumentoCliente) {
  const base = TIPOS_DOC.find((t) => t.value === tipo)?.label ?? ''
  return base ? `${base} — ${props.nombreCliente}` : ''
}

function blankForm() {
  return {
    tipo: '' as TipoDocumentoCliente | '',
    nombre: '',
    numero: '',
    fecha: null as string | null,
    estado: 'borrador',
    archivo_url: '',
    archivo_nombre: '',
    notas: '',
  }
}

const dialogDocumento = ref(false)
const editandoDocumento = ref<DocumentoCliente | null>(null)
const formDoc = reactive(blankForm())
const archivoSeleccionado = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const guardando = ref(false)

function abrirDialogoDocumento(
  doc: DocumentoCliente | null,
  tipoPreset: TipoDocumentoCliente | null = null,
) {
  editandoDocumento.value = doc
  archivoSeleccionado.value = null
  if (doc) {
    Object.assign(formDoc, {
      tipo: doc.tipo,
      nombre: doc.nombre,
      numero: doc.numero ?? '',
      fecha: doc.fecha ?? null,
      estado: doc.estado,
      archivo_url: doc.archivo_url ?? '',
      archivo_nombre: doc.archivo_nombre ?? '',
      notas: doc.notas ?? '',
    })
  } else {
    Object.assign(formDoc, blankForm(), {
      tipo: tipoPreset ?? '',
      nombre: tipoPreset ? nombreSugerido(tipoPreset) : '',
    })
  }
  dialogDocumento.value = true
}

function onTipoChange() {
  if (!editandoDocumento.value && formDoc.tipo) formDoc.nombre = nombreSugerido(formDoc.tipo)
}

function onArchivoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  archivoSeleccionado.value = file
  if (file) formDoc.archivo_url = ''
}

async function guardarDocumento() {
  guardando.value = true
  try {
    const payload: PayloadDocumentoCliente = {
      tipo: formDoc.tipo,
      nombre: formDoc.nombre,
      numero: formDoc.numero || null,
      fecha: formDoc.fecha,
      estado: formDoc.estado,
      archivo_url: archivoSeleccionado.value ? null : formDoc.archivo_url || null,
      archivo_nombre: formDoc.archivo_nombre || null,
      notas: formDoc.notas || null,
    }

    let docId: number
    if (editandoDocumento.value?.id) {
      await clientesService.actualizarDocumento(
        props.clienteId,
        editandoDocumento.value.id,
        payload,
      )
      docId = editandoDocumento.value.id
    } else {
      const documento = await clientesService.crearDocumento(props.clienteId, payload)
      docId = documento.id
    }

    if (archivoSeleccionado.value) {
      await clientesService.subirArchivoDocumento(props.clienteId, docId, archivoSeleccionado.value)
    }

    dialogDocumento.value = false
    toast.success('Documento guardado')
    emit('changed')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    guardando.value = false
  }
}

function confirmarEliminar(doc: DocumentoCliente) {
  confirm({
    title: 'Eliminar documento',
    description: `¿Eliminar "${doc.archivo_nombre || doc.nombre}"?`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminarDocumento(doc),
  })
}

async function eliminarDocumento(doc: DocumentoCliente) {
  try {
    await clientesService.eliminarDocumento(props.clienteId, doc.id)
    toast.success('Eliminado')
    emit('changed')
  } catch (err) {
    toast.error('Error al eliminar', { description: normalizeError(err).message })
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        Documentos del cliente: identificación y comerciales.
      </p>
      <Button size="sm" @click="abrirDialogoDocumento(null)">
        <PlusIcon class="size-4" />
        Agregar documento
      </Button>
    </div>

    <!-- Identificación -->
    <div>
      <h3 class="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Identificación del cliente
      </h3>
      <p
        v-if="docsIdentificacion.length === 0"
        class="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground"
      >
        Sin documentos de identificación. Agrega el RUT, certificado bancario o cámara de comercio.
      </p>
      <div v-else class="space-y-2">
        <Item v-for="doc in docsIdentificacion" :key="doc.id" variant="outline">
          <ItemContent class="flex-row items-center gap-3">
            <GBadge :class="BADGE_COLOR[doc.tipo]">{{ tipoLabel(doc.tipo) }}</GBadge>
            <div>
              <ItemTitle>{{ doc.archivo_nombre || doc.nombre }}</ItemTitle>
              <ItemDescription v-if="doc.notas">{{ doc.notas }}</ItemDescription>
            </div>
          </ItemContent>
          <ItemActions>
            <a
              v-if="doc.archivo_url"
              :href="doc.archivo_url"
              target="_blank"
              class="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon class="size-3.5" /> Ver
            </a>
            <Button variant="ghost" size="icon-sm" @click="abrirDialogoDocumento(doc)">
              <PencilIcon class="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" @click="confirmarEliminar(doc)">
              <Trash2Icon class="size-4 text-destructive" />
            </Button>
          </ItemActions>
        </Item>
      </div>
    </div>

    <!-- Contratos y Ofertas generales (sin servicio vinculado) -->
    <div v-if="docsComerciales.length > 0">
      <h3 class="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Contratos y Ofertas (generales)
      </h3>
      <div class="space-y-2">
        <Item v-for="doc in docsComerciales" :key="doc.id" variant="outline">
          <ItemContent class="flex-row items-center gap-3">
            <GBadge :class="BADGE_COLOR[doc.tipo]">{{ tipoLabel(doc.tipo) }}</GBadge>
            <div>
              <ItemTitle>{{ doc.nombre }}</ItemTitle>
              <ItemDescription>
                {{ doc.numero ? `N° ${doc.numero} · ` : '' }}{{ estadoLabel(doc.estado)
                }}{{ doc.fecha ? ` · ${doc.fecha}` : '' }}
              </ItemDescription>
            </div>
          </ItemContent>
          <ItemActions>
            <a
              v-if="doc.archivo_url"
              :href="doc.archivo_url"
              target="_blank"
              class="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon class="size-3.5" /> Ver
            </a>
            <Button variant="ghost" size="icon-sm" @click="abrirDialogoDocumento(doc)">
              <PencilIcon class="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" @click="confirmarEliminar(doc)">
              <Trash2Icon class="size-4 text-destructive" />
            </Button>
          </ItemActions>
        </Item>
      </div>
    </div>

    <Dialog v-model:open="dialogDocumento">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{
            editandoDocumento?.id ? 'Editar documento' : 'Nuevo documento'
          }}</DialogTitle>
        </DialogHeader>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-1.5">
            <GLabel required>Tipo</GLabel>
            <Select v-model="formDoc.tipo" @update:model-value="onTipoChange">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_DOC" :key="t.value" :value="t.value">{{
                  t.label
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="col-span-2 space-y-1.5">
            <GLabel required>Nombre</GLabel>
            <Input v-model="formDoc.nombre" placeholder="Ej: RUT Empresa XYZ" />
          </div>

          <template v-if="formDoc.tipo === 'oferta' || formDoc.tipo === 'contrato'">
            <div class="space-y-1.5">
              <GLabel>Estado</GLabel>
              <Select v-model="formDoc.estado">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="e in ESTADOS_DOC" :key="e.value" :value="e.value">{{
                    e.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <GLabel>Número</GLabel>
              <Input v-model="formDoc.numero" placeholder="Ej: OFR-001" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Fecha</GLabel>
              <DatePicker v-model="formDoc.fecha" />
            </div>
            <div />
          </template>

          <div class="col-span-2 space-y-1.5">
            <GLabel>Archivo (PDF, JPG, PNG — máx. 20 MB)</GLabel>
            <div class="flex items-center gap-3">
              <input
                ref="fileInputRef"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                class="hidden"
                @change="onArchivoChange"
              />
              <Button type="button" variant="outline" size="sm" @click="fileInputRef?.click()">
                <UploadIcon class="size-4" />
                {{ archivoSeleccionado ? 'Cambiar' : 'Seleccionar archivo' }}
              </Button>
              <span v-if="archivoSeleccionado" class="max-w-48 truncate text-sm">
                {{ archivoSeleccionado.name }}
              </span>
              <span
                v-else-if="formDoc.archivo_nombre"
                class="max-w-48 truncate text-sm text-muted-foreground"
              >
                Actual: {{ formDoc.archivo_nombre }}
              </span>
            </div>
          </div>

          <div class="col-span-2 space-y-1.5">
            <GLabel>O pega un enlace (Google Drive, OneDrive)</GLabel>
            <Input
              v-model="formDoc.archivo_url"
              placeholder="https://drive.google.com/..."
              :disabled="!!archivoSeleccionado"
            />
          </div>

          <div class="col-span-2 space-y-1.5">
            <GLabel>Notas</GLabel>
            <Textarea v-model="formDoc.notas" rows="2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="dialogDocumento = false">Cancelar</Button>
          <Button
            :disabled="!formDoc.tipo || !formDoc.nombre || guardando"
            @click="guardarDocumento"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
