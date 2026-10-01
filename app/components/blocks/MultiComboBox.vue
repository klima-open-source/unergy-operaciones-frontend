<script setup lang="ts">
/**
 * Selección múltiple buscable, con las opciones elegidas como chips —
 * equivalente a `blocks/ComboBox.vue` pero de varios valores a la vez
 * (reemplazo de `MultiSelect` de PrimeVue con `display="chip"`).
 *
 * Los chips van fuera del combobox, encima del input: así el botón de quitar
 * de cada chip no compite por el foco ni el click con el trigger.
 */
import { CheckIcon, XIcon } from '@lucide/vue'

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

const modelValue = defineModel<string[]>({ default: () => [] })

function etiqueta(value: string): string {
  return props.options.find((o) => o.value === value)?.label ?? value
}

function quitar(value: string) {
  modelValue.value = modelValue.value.filter((v) => v !== value)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="modelValue.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="value in modelValue"
        :key="value"
        class="flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium text-secondary-foreground"
      >
        {{ etiqueta(value) }}
        <button
          type="button"
          class="rounded-full p-0.5 hover:bg-secondary-foreground/10 hover:text-destructive"
          :disabled="disabled"
          @click="quitar(value)"
        >
          <XIcon class="size-3" />
        </button>
      </span>
    </div>

    <Combobox v-model="modelValue" multiple open-on-click open-on-focus :disabled="disabled">
      <ComboboxAnchor>
        <ComboboxInput :placeholder="placeholder" />
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
  </div>
</template>
