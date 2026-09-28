<template>
  <Select :model-value="modelValue ?? NONE" @update:model-value="onUpdate">
    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem :value="NONE">—</SelectItem>
      <SelectItem value="aprobado">Aprobado</SelectItem>
      <SelectItem value="pendiente">Pendiente</SelectItem>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
import type { EstadoChecklistOm } from '~/features/operaciones/types'

/** Selector de 3 estados (aprobado/pendiente/sin revisar) para los checklists
 * de `InformeOMView.vue` — se repite en más de diez campos del formulario. */
defineProps<{
  modelValue: EstadoChecklistOm
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EstadoChecklistOm]
}>()

/** `Select` de shadcn solo acepta strings — `null` (sin revisar) se representa con este valor. */
const NONE = '__none__'

function onUpdate(value: unknown) {
  emit('update:modelValue', value === NONE ? null : (value as EstadoChecklistOm))
}
</script>
