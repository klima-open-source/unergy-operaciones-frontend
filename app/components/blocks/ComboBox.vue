<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'

export interface ComboBoxOption {
  label: string
  value: string
}

const props = defineProps<{
  options: ComboBoxOption[]
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
}>()

const modelValue = defineModel<string | null>({ default: null })

function displayValue(value: string) {
  return props.options.find((option) => option.value === value)?.label ?? ''
}
</script>

<template>
  <Combobox v-model="modelValue" open-on-click open-on-focus :disabled="disabled">
    <ComboboxAnchor>
      <ComboboxInput :display-value="displayValue" :placeholder="placeholder" />
    </ComboboxAnchor>
    <ComboboxList>
      <ComboboxEmpty>{{ emptyMessage ?? 'Sin resultados.' }}</ComboboxEmpty>
      <ComboboxViewport>
        <ComboboxItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :text-value="option.label"
        >
          {{ option.label }}
          <ComboboxItemIndicator>
            <CheckIcon />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
