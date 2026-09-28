<script setup lang="ts">
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { AjusteGarantiaFE, CamposAjusteGarantiaFE } from './composables/useGarantiasHistorial'
import { useGarantiasHistorial } from './composables/useGarantiasHistorial'

const props = defineProps<{
  visible: boolean
  ajuste: AjusteGarantiaFE | null
}>()
const emit = defineEmits<{
  'update:visible': [visible: boolean]
  saved: []
}>()

const store = useGarantiasHistorial()

const local = ref<CamposAjusteGarantiaFE>({})

watch(
  () => props.ajuste,
  (val) => {
    if (val) local.value = { ...val }
  },
  { immediate: true },
)

const TIPO_LABEL: Record<string, string> = { semanal: 'Semanal', txr: 'TXR', mensual: 'Mensual' }

async function guardar() {
  if (!props.ajuste) return
  try {
    await store.actualizar(props.ajuste.id, local.value)
    toast.success('Guardado', { description: 'Registro actualizado', duration: 3000 })
    emit('saved')
    emit('update:visible', false)
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 4000 })
  }
}

function onOpenChange(open: boolean) {
  emit('update:visible', open)
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Editar registro</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">Tipo:</span>
          <span class="font-semibold text-foreground">{{
            TIPO_LABEL[ajuste?.tipo ?? ''] ?? ajuste?.tipo
          }}</span>
          <span class="ml-4 text-muted-foreground">Fecha:</span>
          <span class="font-semibold text-foreground">{{ ajuste?.fecha }}</span>
        </div>

        <fieldset class="rounded-md border p-3">
          <legend class="px-1 text-sm font-semibold">Precios</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <GLabel>PB</GLabel>
              <NumberField
                v-model="local.pb"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>Restricciones</GLabel>
              <NumberField
                v-model="local.restricciones"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>STN</GLabel>
              <NumberField
                v-model="local.stn"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>TRM</GLabel>
              <NumberField
                v-model="local.trm"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>PTB</GLabel>
              <NumberField
                v-model="local.ptb"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
          </div>
        </fieldset>

        <fieldset class="rounded-md border p-3">
          <legend class="px-1 text-sm font-semibold">Totales</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <GLabel>Total UNGC</GLabel>
              <NumberField
                v-model="local.totalUNGC"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>Total UNGG</GLabel>
              <NumberField
                v-model="local.totalUNGG"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="col-span-2 flex flex-col gap-1">
              <GLabel>Total a consignar</GLabel>
              <NumberField
                v-model="local.totalConsignar"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
          </div>
        </fieldset>

        <fieldset class="rounded-md border p-3">
          <legend class="px-1 text-sm font-semibold">Custodia</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <GLabel>Disponible custodia</GLabel>
              <NumberField
                v-model="local.disponibleCustodia"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <GLabel>Congelado</GLabel>
              <NumberField
                v-model="local.congelado"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="col-span-2 flex flex-col gap-1">
              <GLabel>Saldo</GLabel>
              <NumberField
                v-model="local.saldo"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
          </div>
        </fieldset>

        <div class="flex flex-col gap-1">
          <GLabel>Total ajuste TXR</GLabel>
          <NumberField
            v-model="local.totalAjusteTXR"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
          >
            <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
          </NumberField>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="onOpenChange(false)">Cancelar</Button>
        <Button @click="guardar">Guardar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
