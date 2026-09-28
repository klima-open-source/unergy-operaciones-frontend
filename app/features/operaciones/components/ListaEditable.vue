<template>
  <div class="flex flex-col gap-1.5">
    <span v-if="label" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {{ label }}
    </span>
    <div v-for="(item, index) in modelValue" :key="index" class="flex items-center gap-1.5">
      <Input
        :model-value="item"
        :placeholder="placeholder"
        @update:model-value="setItem(index, $event)"
      />
      <Button variant="destructive" size="icon-sm" title="Quitar" @click="quitar(index)">
        <XIcon class="size-3.5" />
      </Button>
    </div>
    <Button variant="outline" size="sm" class="self-start" @click="agregar">
      <PlusIcon class="size-3.5" /> Agregar
    </Button>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon, XIcon } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string[]
    label?: string
    placeholder?: string
  }>(),
  { modelValue: () => [], label: '', placeholder: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

function setItem(index: number, value: string | number) {
  const nueva = [...props.modelValue]
  nueva[index] = String(value)
  emit('update:modelValue', nueva)
}

function agregar() {
  emit('update:modelValue', [...props.modelValue, ''])
}

function quitar(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, idx) => idx !== index),
  )
}
</script>
