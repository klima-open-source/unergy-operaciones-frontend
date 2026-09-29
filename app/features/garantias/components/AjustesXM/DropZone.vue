<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, FileSpreadsheetIcon } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    label?: string
    pattern?: RegExp | null
  }>(),
  {
    label: 'Subir archivo',
    pattern: null,
  },
)

const emit = defineEmits<{
  'update:file': [file: File | null]
  error: [message: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const error = ref('')
const dragging = ref(false)

const dropClass = computed(() => {
  if (error.value) return 'border-destructive bg-destructive/5'
  if (file.value) return 'border-success bg-success/5'
  if (dragging.value) return 'border-primary bg-primary/5'
  return 'border-muted-foreground/30 bg-muted/40'
})

function validate(f: File | null | undefined): boolean {
  if (!f) return false
  if (props.pattern && !props.pattern.test(f.name)) {
    error.value = `Nombre no coincide: "${f.name}"`
    file.value = null
    emit('update:file', null)
    emit('error', error.value)
    return false
  }
  error.value = ''
  file.value = f
  emit('update:file', f)
  return true
}

function onSelect(e: Event) {
  const input = e.target as HTMLInputElement
  validate(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  validate(e.dataTransfer?.files[0])
}

function reset() {
  file.value = null
  error.value = ''
  emit('update:file', null)
}

defineExpose({ reset })
</script>

<template>
  <div
    class="relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors"
    :class="dropClass"
    @click="fileInput?.click()"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onSelect" />

    <div v-if="!file && !error" class="space-y-1">
      <FileSpreadsheetIcon class="mx-auto block size-6 text-muted-foreground/60" />
      <p class="text-sm font-medium text-muted-foreground">{{ label }}</p>
      <p class="text-xs text-muted-foreground/70">Arrastra o haz clic</p>
    </div>

    <div v-else-if="error" class="space-y-1">
      <CircleXIcon class="mx-auto block size-6 text-destructive" />
      <p class="text-sm font-medium text-destructive">{{ error }}</p>
      <p class="text-xs text-muted-foreground/70">Haz clic para intentar de nuevo</p>
    </div>

    <div v-else class="space-y-1">
      <CircleCheckIcon class="mx-auto block size-6 text-success" />
      <TruncatedText
        :text="file!.name"
        class="mx-auto max-w-xs text-sm font-medium text-foreground"
      />
      <p class="text-xs text-success">Archivo cargado</p>
    </div>
  </div>
</template>
