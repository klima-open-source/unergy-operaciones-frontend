<template>
  <div class="ev-wrap">
    <div v-if="modelValue?.length" class="ev-list">
      <div v-for="archivo in modelValue" :key="archivo.id" class="ev-chip">
        <component :is="iconoPara(archivo.tipo_mime)" class="size-[1em]" />
        <a :href="archivo.url" target="_blank" rel="noopener" class="ev-chip-name" :title="archivo.nombre">
          {{ archivo.nombre }}
        </a>
        <button class="ev-chip-del" title="Quitar" :disabled="eliminando === archivo.id" @click="eliminar(archivo.id)">
          <LoaderCircleIcon v-if="eliminando === archivo.id" class="size-[1em] animate-spin" />
          <XIcon v-else class="size-[1em]" />
        </button>
      </div>
    </div>

    <label class="ev-upload" :class="{ 'ev-upload--busy': subiendo }">
      <LoaderCircleIcon v-if="subiendo" class="size-[1em] animate-spin" />
      <PaperclipIcon v-else class="size-[1em]" />
      {{ subiendo ? 'Subiendo…' : (modelValue?.length ? 'Agregar otro archivo' : 'Subir evidencia') }}
      <input type="file" class="ev-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        :disabled="subiendo" @change="subir" />
    </label>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { InformeOmService } from '~/features/operaciones/services/informe-om'
import { FileIcon, ImageIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from '@lucide/vue'

const informeOmService = new InformeOmService()

const props = defineProps({
  proyectoId: { type: [Number, String], required: true },
  seccion: { type: String, required: true },
  modelValue: { type: Array, default: () => [] },
  basePath: { type: String, default: 'inicio-operacion' },
})
const emit = defineEmits(['update:modelValue', 'error'])

const subiendo = ref(false)
const eliminando = ref(null)

function iconoPara(mime) {
  if (mime?.startsWith('image/')) return ImageIcon
  return FileIcon
}

async function subir(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  subiendo.value = true
  try {
    const data = await informeOmService.subirEvidencia(
      props.basePath, props.proyectoId, props.seccion, file,
    )
    emit('update:modelValue', [...(props.modelValue || []), data])
  } catch (e) {
    emit('error', e?.data?.detail || 'No se pudo subir el archivo')
  } finally {
    subiendo.value = false
  }
}

async function eliminar(archivoId) {
  eliminando.value = archivoId
  try {
    await informeOmService.eliminarEvidencia(props.basePath, props.proyectoId, props.seccion, archivoId)
    emit('update:modelValue', (props.modelValue || []).filter((a) => a.id !== archivoId))
  } catch (e) {
    emit('error', e?.data?.detail || 'No se pudo eliminar el archivo')
  } finally {
    eliminando.value = null
  }
}
</script>

<style scoped>
.ev-wrap { display: flex; flex-direction: column; gap: 8px; }
.ev-list { display: flex; flex-wrap: wrap; gap: 6px; }
.ev-chip {
  display: flex; align-items: center; gap: 6px;
  background: #f5f3fa; border: 1px solid #e8e0f0; border-radius: 8px;
  padding: 5px 6px 5px 10px; font-size: 12.5px; color: var(--color-unergy-deep); max-width: 220px;
}
.ev-chip svg { color: var(--color-unergy-purple); font-size: 12px; flex-shrink: 0; }
.ev-chip-name { color: var(--color-unergy-deep); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-chip-name:hover { text-decoration: underline; color: var(--color-unergy-purple-dark); }
.ev-chip-del { border: none; background: none; color: #9ca3af; width: 20px; height: 20px; border-radius: 5px; cursor: pointer; flex-shrink: 0; }
.ev-chip-del:hover { background: #fee2e2; color: #b91c1c; }
.ev-chip-del:disabled { opacity: .6; cursor: default; }

.ev-upload {
  display: inline-flex; align-items: center; gap: 7px; width: fit-content;
  border: 1.5px dashed #cbb8e8; background: #faf8fd; color: var(--color-unergy-purple-dark);
  font-size: 12.5px; font-weight: 700; padding: 7px 12px; border-radius: 9px; cursor: pointer;
}
.ev-upload:hover { background: #f3edfb; }
.ev-upload--busy { opacity: .7; cursor: default; }
.ev-input { display: none; }
</style>
