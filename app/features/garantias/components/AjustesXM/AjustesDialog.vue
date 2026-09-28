<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import { useGarantiasHistorial } from './composables/useGarantiasHistorial'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useGarantiasHistorial()

const pbLocal = ref<number | null>(null)
const mencionesLocal = ref('')

watch(
  () => props.visible,
  (v) => {
    if (v) {
      pbLocal.value = store.getPbAnterior()
      mencionesLocal.value = store.getMenciones()
    }
  },
)

function guardar() {
  store.setPbAnterior(pbLocal.value)
  store.setMenciones(mencionesLocal.value)
  emit('close')
}

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Ajustes</DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <GLabel>PB semana anterior ($)</GLabel>
          <NumberField v-model="pbLocal" :min="0" :format-options="{ maximumFractionDigits: 2 }">
            <NumberFieldContent><NumberFieldInput placeholder="Ej: 547.88" /></NumberFieldContent>
          </NumberField>
          <p class="text-xs text-muted-foreground">
            Usado para calcular la variación % en el mensaje semanal.
          </p>
        </div>

        <div class="space-y-1.5">
          <GLabel>Menciones en el mensaje</GLabel>
          <Textarea v-model="mencionesLocal" rows="3" placeholder="@Juan @María @Pedro" />
          <p class="text-xs text-muted-foreground">Se insertan al final del mensaje generado.</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="emit('close')">Cancelar</Button>
        <Button @click="guardar">
          <CheckIcon class="size-4" />
          Guardar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
