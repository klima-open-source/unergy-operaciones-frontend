<template>
  <div class="flex flex-col gap-2">
    <div v-if="modelValue.length" class="flex flex-wrap gap-1.5">
      <div
        v-for="archivo in modelValue"
        :key="archivo.id"
        class="flex max-w-56 items-center gap-1.5 rounded-md border bg-muted py-1 pr-1 pl-2.5 text-xs"
      >
        <component :is="iconoPara(archivo.tipo_mime)" class="size-3.5 shrink-0 text-primary" />
        <a
          :href="archivo.url"
          target="_blank"
          rel="noopener"
          :title="archivo.nombre"
          class="overflow-hidden text-ellipsis whitespace-nowrap text-foreground hover:underline"
        >
          {{ archivo.nombre }}
        </a>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Quitar"
          :disabled="eliminando === archivo.id"
          @click="eliminar(archivo.id)"
        >
          <LoaderCircleIcon v-if="eliminando === archivo.id" class="size-3.5 animate-spin" />
          <XIcon v-else class="size-3.5" />
        </Button>
      </div>
    </div>

    <label
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
      :class="{ 'pointer-events-none opacity-70': subiendo }"
    >
      <LoaderCircleIcon v-if="subiendo" class="size-3.5 animate-spin" />
      <PaperclipIcon v-else class="size-3.5" />
      {{ subiendo ? 'Subiendo…' : modelValue.length ? 'Agregar otro archivo' : 'Subir evidencia' }}
      <input
        type="file"
        class="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        :disabled="subiendo"
        @change="subir"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { FileIcon, ImageIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from '@lucide/vue'
import { logger } from '~/core/logger'
import type { ArchivoEvidencia } from '~/features/operaciones/types'
import { InformeOmService } from '~/features/operaciones/services/informe-om'

const props = withDefaults(
  defineProps<{
    proyectoId: number | string
    seccion: string
    modelValue?: ArchivoEvidencia[]
    basePath?: string
  }>(),
  { modelValue: () => [], basePath: 'inicio-operacion' },
)

const emit = defineEmits<{
  'update:modelValue': [value: ArchivoEvidencia[]]
  error: [mensaje: string]
}>()

const informeOmService = new InformeOmService()

const subiendo = ref(false)
const eliminando = ref<number | null>(null)

function iconoPara(mime?: string) {
  return mime?.startsWith('image/') ? ImageIcon : FileIcon
}

async function subir(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  subiendo.value = true
  try {
    const data = await informeOmService.subirEvidencia(
      props.basePath,
      Number(props.proyectoId),
      props.seccion,
      file,
    )
    emit('update:modelValue', [...props.modelValue, data])
  } catch (err) {
    emit('error', logger.error('operaciones.evidencia-uploader.subir', err))
  } finally {
    subiendo.value = false
  }
}

async function eliminar(archivoId: number) {
  eliminando.value = archivoId
  try {
    await informeOmService.eliminarEvidencia(
      props.basePath,
      Number(props.proyectoId),
      props.seccion,
      archivoId,
    )
    emit(
      'update:modelValue',
      props.modelValue.filter((a) => a.id !== archivoId),
    )
  } catch (err) {
    emit('error', logger.error('operaciones.evidencia-uploader.eliminar', err))
  } finally {
    eliminando.value = null
  }
}
</script>
