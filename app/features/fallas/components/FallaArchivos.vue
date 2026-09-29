<script setup lang="ts">
/**
 * Archivos adjuntos de una falla: carga, listado y borrado (`GET/POST/DELETE
 * /fallas/:id/archivos`). El endpoint puede no estar disponible (backend
 * viejo sin la ruta) — en ese caso se muestra un aviso en vez de romper.
 */
import type { ArchivoFalla } from '~/features/fallas/types'
import {
  DownloadIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  InfoIcon,
  PaperclipIcon,
  Trash2Icon,
  UploadIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { FallasService } from '~/features/fallas/services/fallas'

const SCOPE = 'fallas.archivos'

const props = defineProps<{
  fallaId: number
}>()

const fallasService = new FallasService()
const confirm = useConfirm()

const archivos = ref<ArchivoFalla[]>([])
const noDisponible = ref(false)
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(str: string | null | undefined): string {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function estaImagen(archivo: ArchivoFalla): boolean {
  return !!archivo.tipo_mime?.startsWith('image/')
}

function iconoArchivo(archivo: ArchivoFalla) {
  const mime = archivo.tipo_mime || ''
  if (mime === 'application/pdf') return FileTextIcon
  if (
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    /\.(xls|xlsx|csv)$/i.test(archivo.nombre || '')
  ) {
    return FileSpreadsheetIcon
  }
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    /\.(doc|docx)$/i.test(archivo.nombre || '')
  ) {
    return FileTypeIcon
  }
  return FileIcon
}

async function cargarArchivos() {
  if (!props.fallaId) return
  noDisponible.value = false
  try {
    archivos.value = await fallasService.listarArchivos(props.fallaId)
  } catch (err) {
    const normalized = normalizeError(err)
    if (normalized.code === 'NOT_FOUND' || normalized.code === 'NETWORK') {
      noDisponible.value = true
    } else {
      // El endpoint existe pero falló por otra razón: se muestra vacío, no se bloquea la vista.
      logger.error(SCOPE, err)
      archivos.value = []
    }
  }
}

function subirArchivo(file: File): Promise<ArchivoFalla> {
  return fallasService.subirArchivo(props.fallaId, file, (porcentaje) => {
    uploadProgress.value = porcentaje
  })
}

async function procesarArchivos(files: File[]) {
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0
  let exitosos = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    try {
      const nuevo = await subirArchivo(file)
      archivos.value.push(nuevo)
      exitosos++
    } catch (err) {
      logger.error(SCOPE, err)
      toast.warning('No se pudo subir', { description: file.name, duration: 3500 })
    }
    // Progreso global entre archivos múltiples
    uploadProgress.value = Math.round(((i + 1) / files.length) * 100)
  }

  uploading.value = false
  uploadProgress.value = 0

  if (exitosos > 0) {
    toast.success(exitosos === 1 ? 'Archivo subido' : `${exitosos} archivos subidos`, {
      duration: 2500,
    })
  }
}

function eliminarArchivo(archivo: ArchivoFalla) {
  confirm({
    title: 'Eliminar archivo',
    description: `¿Deseas eliminar "${archivo.nombre}"?`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await fallasService.eliminarArchivo(props.fallaId, archivo.id)
        archivos.value = archivos.value.filter((a) => a.id !== archivo.id)
        toast.success('Archivo eliminado', { duration: 2000 })
      } catch (err) {
        logger.error(SCOPE, err)
        toast.error('No se pudo eliminar el archivo', { duration: 3000 })
      }
    },
  })
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  procesarArchivos(Array.from(input.files ?? []))
  input.value = ''
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  procesarArchivos(Array.from(event.dataTransfer?.files ?? []))
}

onMounted(cargarArchivos)

watch(
  () => props.fallaId,
  (nuevo) => {
    if (nuevo) {
      archivos.value = []
      cargarArchivos()
    }
  },
)
</script>

<template>
  <section class="rounded-xl border bg-muted/30 p-4">
    <header class="mb-3.5 flex items-center gap-2">
      <PaperclipIcon class="size-4 text-primary" />
      <h3 class="text-sm font-bold text-foreground">Archivos adjuntos</h3>
      <span class="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{{
        archivos.length
      }}</span>
    </header>

    <div
      v-if="noDisponible"
      class="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground"
    >
      <InfoIcon class="size-4 shrink-0 text-primary/60" />
      <span>Archivos no disponibles</span>
    </div>

    <template v-else>
      <!-- Zona de carga -->
      <div
        class="mb-3.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-primary/25 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
        :class="{ 'border-primary bg-primary/5': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="triggerFileInput"
      >
        <UploadIcon class="mb-1 size-5 text-primary/60" />
        <p class="text-sm text-foreground">
          Arrastra archivos aquí o
          <span class="font-semibold text-primary">haz clic para seleccionar</span>
        </p>
        <p class="text-xs text-muted-foreground">Imágenes, PDF, Excel, Word, CSV</p>
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          accept="*"
          multiple
          @change="onFileInputChange"
        />
      </div>

      <!-- Barra de progreso durante carga -->
      <Progress v-if="uploading" :model-value="uploadProgress" class="mb-3.5 h-1" />

      <!-- Lista de archivos -->
      <div v-if="archivos.length" class="flex flex-col gap-1">
        <div
          v-for="archivo in archivos"
          :key="archivo.id"
          class="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-primary/5"
        >
          <div class="size-10 shrink-0">
            <a
              v-if="estaImagen(archivo)"
              :href="archivo.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                :src="archivo.url"
                :alt="archivo.nombre"
                class="size-10 rounded-md border object-cover transition-opacity hover:opacity-85"
              />
            </a>
            <div v-else class="flex size-10 items-center justify-center rounded-md bg-primary/10">
              <component :is="iconoArchivo(archivo)" class="size-4 text-primary" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-foreground" :title="archivo.nombre">
              {{ archivo.nombre }}
            </p>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{{ formatSize(archivo.tamaño) }}</span>
              <span>·</span>
              <span>{{ formatDate(archivo.created_at) }}</span>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <Button as-child variant="ghost" size="icon-sm" title="Descargar">
              <a :href="archivo.url" target="_blank" rel="noopener noreferrer">
                <DownloadIcon class="size-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Eliminar"
              class="text-destructive hover:text-destructive"
              @click="eliminarArchivo(archivo)"
            >
              <Trash2Icon class="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <p v-else class="py-2 text-center text-xs text-muted-foreground">Sin archivos adjuntos</p>
    </template>
  </section>
</template>
