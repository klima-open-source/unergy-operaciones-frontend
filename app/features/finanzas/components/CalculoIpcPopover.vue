<template>
  <!-- Popover de desglose del cálculo IPC. Mismo formato visual que Mantenimiento. -->
  <!-- Se abre a mano (show/hide desde el padre, al pasar el mouse por el ⚠️) y
       se ancla al elemento que lo disparó. Sin foco: es solo lectura. -->
  <Popover :open="abierto" @update:open="abierto = $event">
    <PopoverAnchor :reference="ancla" />
    <PopoverContent class="w-auto" @open-auto-focus.prevent @close-auto-focus.prevent>
    <div class="text-xs text-foreground">
      <p class="font-semibold mb-2 flex items-center gap-1.5 text-primary">
        <ChartColumnIcon class="text-xs size-4" /> Cálculo del Valor a Facturar
      </p>
      <div class="space-y-1 font-mono">
        <div class="flex justify-between gap-6">
          <span class="text-muted-foreground">Valor Base Anual</span>
          <span>{{ formatCOP(valorBaseAnual) }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-muted-foreground">÷ 12 meses</span>
          <span>{{ formatCOP(valorBaseAnual != null ? valorBaseAnual / 12 : null) }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-muted-foreground">Índice IPC aplicado</span>
          <span>× {{ factor != null ? factor.toFixed(5) : '—' }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-muted-foreground">IPC acumulado período</span>
          <span>{{ factor != null ? ((factor - 1) * 100).toFixed(3) : '—' }}%</span>
        </div>
      </div>
      <div class="border-t mt-2 pt-2">
        <div class="flex justify-between gap-6 font-semibold">
          <span>Valor a Facturar</span>
          <span class="text-primary">{{ formatCOP(valorAFacturar) }}</span>
        </div>
      </div>
    </div>
    </PopoverContent>
  </Popover>
</template>

<script setup>
import { ref } from 'vue'
import { formatCOP } from '~/utils/currency'
import { ChartColumnIcon } from '@lucide/vue'

defineProps({
  valorBaseAnual: { type: Number, default: null },
  factor:         { type: Number, default: null },
  valorAFacturar: { type: Number, default: null },
})

const abierto = ref(false)
const ancla = ref(null)

// La misma interfaz que tenía con el Popover de PrimeVue: el padre llama
// show(evento) y hide().
function show(ev) {
  ancla.value = ev?.currentTarget ?? ev?.target ?? null
  abierto.value = true
}
function hide() { abierto.value = false }
defineExpose({ show, hide })
</script>
