<script setup lang="ts">
/**
 * Selección múltiple buscable, con las opciones elegidas como chips —
 * equivalente a `blocks/ComboBox.vue` pero de varios valores a la vez
 * (reemplazo de `MultiSelect` de PrimeVue con `display="chip"`).
 *
 * Construido sobre `Popover` + `Input` filtrando a mano, como
 * `SelectorCliente.vue` — no sobre `ui/combobox` (`ComboboxRoot` con
 * `multiple`): ese camino exige anidar los chips y su botón de borrar dentro
 * del propio trigger del combobox, con los conflictos de foco/click que eso
 * trae. El patrón de Popover ya está probado en este mismo repo.
 */
import { XIcon } from '@lucide/vue'

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

const open = ref(false)
const query = ref('')

const disponibles = computed(() => props.options.filter((o) => !modelValue.value.includes(o.value)))

const sugerencias = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return disponibles.value
  return disponibles.value.filter((o) => o.label.toLowerCase().includes(q))
})

function etiqueta(value: string): string {
  return props.options.find((o) => o.value === value)?.label ?? value
}

function agregar(value: string) {
  modelValue.value = [...modelValue.value, value]
  query.value = ''
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

    <Popover v-model:open="open">
      <PopoverAnchor as-child>
        <Input
          v-model="query"
          :placeholder="placeholder"
          :disabled="disabled"
          @focus="open = true"
        />
      </PopoverAnchor>
      <PopoverContent
        class="w-(--reka-popover-trigger-width) max-w-none p-1"
        align="start"
        @open-auto-focus.prevent
      >
        <p v-if="!sugerencias.length" class="px-2 py-4 text-center text-sm text-muted-foreground">
          {{ emptyMessage ?? 'Sin resultados.' }}
        </p>
        <button
          v-for="option in sugerencias"
          :key="option.value"
          type="button"
          class="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          @click="agregar(option.value)"
        >
          {{ option.label }}
        </button>
      </PopoverContent>
    </Popover>
  </div>
</template>
