<template>
  <button
    v-if="doc != null"
    type="button"
    class="inline-flex items-center justify-center size-7 rounded-lg transition-colors hover:bg-primary/10 text-primary"
    :title="tooltip || doc.nombre_archivo || 'Ver documento'"
    @click="$emit('click', doc)">
    <FileTextIcon class="size-4" />
  </button>
  <span
    v-else
    class="inline-flex items-center justify-center size-7 cursor-default text-muted-foreground"
    title="Sin documento">
    <FileTextIcon class="size-4" />
  </span>
</template>

<script setup>
import { FileTextIcon } from '@lucide/vue'
defineProps({
  doc:     { type: Object, default: null },   // null → estado vacío
  tooltip: { type: String, default: null },
})
defineEmits(['click'])
</script>
