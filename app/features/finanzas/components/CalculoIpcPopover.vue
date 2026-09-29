<template>
  <!-- Popover de desglose del cálculo IPC. Mismo formato visual que Mantenimiento. -->
  <Popover ref="pop">
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
  </Popover>
</template>

<script setup>
import { ref } from 'vue'
import Popover from 'primevue/popover'
import { formatCOP } from '~/utils/currency'
import { ChartColumnIcon } from '@lucide/vue'

defineProps({
  valorBaseAnual: { type: Number, default: null },
  factor:         { type: Number, default: null },
  valorAFacturar: { type: Number, default: null },
})

const pop = ref(null)

// Reexpone los métodos del Popover de PrimeVue al padre.
function show(ev) { pop.value?.show(ev) }
function hide()   { pop.value?.hide() }
defineExpose({ show, hide })
</script>
