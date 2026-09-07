<template>
  <!-- Popover de desglose del cálculo IPC. Mismo formato visual que Mantenimiento. -->
  <Popover ref="pop">
    <div class="text-xs" style="min-width:280px; color:var(--color-unergy-deep)">
      <p class="font-semibold mb-2 flex items-center gap-1.5" style="color:#7c3aed">
        <ChartColumnIcon class="text-[11px] size-[1em]" /> Cálculo del Valor a Facturar
      </p>
      <div class="space-y-1 font-mono">
        <div class="flex justify-between gap-6">
          <span class="text-gray-500">Valor Base Anual</span>
          <span>{{ formatCOP(valorBaseAnual) }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-gray-500">÷ 12 meses</span>
          <span>{{ formatCOP(valorBaseAnual != null ? valorBaseAnual / 12 : null) }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-gray-500">Índice IPC aplicado</span>
          <span>× {{ factor != null ? factor.toFixed(5) : '—' }}</span>
        </div>
        <div class="flex justify-between gap-6">
          <span class="text-gray-500">IPC acumulado período</span>
          <span>{{ factor != null ? ((factor - 1) * 100).toFixed(3) : '—' }}%</span>
        </div>
      </div>
      <div class="border-t mt-2 pt-2">
        <div class="flex justify-between gap-6 font-semibold">
          <span>Valor a Facturar</span>
          <span style="color:#7c3aed">{{ formatCOP(valorAFacturar) }}</span>
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
