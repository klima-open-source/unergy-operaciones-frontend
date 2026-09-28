<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarIcon, XIcon } from '@lucide/vue'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `ui/calendar` (mismo problema que `blocks/DataTable`) y `typecheck` falla.
import { Calendar } from '~/components/ui/calendar'

const props = withDefaults(
  defineProps<{
    placeholder?: string
    clearable?: boolean
    /** Fecha mínima seleccionable, en `'yyyy-mm-dd'`. */
    minValue?: string | null
    /** Fecha máxima seleccionable, en `'yyyy-mm-dd'`. */
    maxValue?: string | null
  }>(),
  {
    placeholder: 'Seleccionar fecha',
    clearable: false,
    minValue: null,
    maxValue: null,
  },
)

/** El valor de afuera es siempre `'yyyy-mm-dd'` — nunca un `Date` ni un `DateValue`. */
const modelValue = defineModel<string | null>({ default: null })

const open = ref(false)

const internal = computed<DateValue | undefined>({
  get: () => (modelValue.value ? parseDate(modelValue.value) : undefined),
  set: (value) => {
    modelValue.value = value ? value.toString() : null
    open.value = false
  },
})

const internalMin = computed<DateValue | undefined>(() =>
  props.minValue ? parseDate(props.minValue) : undefined,
)
const internalMax = computed<DateValue | undefined>(() =>
  props.maxValue ? parseDate(props.maxValue) : undefined,
)

const label = computed(() =>
  internal.value
    ? internal.value.toDate(getLocalTimeZone()).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null,
)
</script>

<template>
  <ButtonGroup class="w-full">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button variant="outline" class="w-full flex-1 justify-start font-normal">
          <CalendarIcon class="size-4" />
          {{ label ?? placeholder }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar v-model="internal" :min-value="internalMin" :max-value="internalMax" />
      </PopoverContent>
    </Popover>
    <Button v-if="clearable && modelValue" variant="outline" @click="modelValue = null">
      <XIcon class="size-4" />
    </Button>
  </ButtonGroup>
</template>
