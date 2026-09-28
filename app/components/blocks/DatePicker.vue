<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarIcon, XIcon } from '@lucide/vue'
import { getLocalTimeZone, parseDate } from '@internationalized/date'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `ui/calendar` (mismo problema que `blocks/DataTable`) y `typecheck` falla.
import { Calendar } from '~/components/ui/calendar'

withDefaults(defineProps<{ placeholder?: string; clearable?: boolean }>(), {
  placeholder: 'Seleccionar fecha',
  clearable: false,
})

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
        <Calendar v-model="internal" />
      </PopoverContent>
    </Popover>
    <Button v-if="clearable && modelValue" variant="outline" @click="modelValue = null">
      <XIcon class="size-4" />
    </Button>
  </ButtonGroup>
</template>
