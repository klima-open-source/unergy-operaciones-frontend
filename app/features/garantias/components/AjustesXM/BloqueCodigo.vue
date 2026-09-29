<script setup lang="ts">
import type { FilaAjuste } from './composables/useGarantiasParser'

const props = defineProps<{
  titulo: string
  rows?: FilaAjuste[]
  total?: number | null
}>()

const headerClass = computed(() => {
  const map: Record<string, string> = {
    UNGC: 'bg-primary/10 text-primary',
    UNGG: 'bg-information/10 text-information',
  }
  return map[props.titulo] || 'bg-muted text-muted-foreground'
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div class="flex items-center gap-2 px-4 py-2" :class="headerClass">
      <span class="text-xs font-bold tracking-widest uppercase">{{ titulo }}</span>
    </div>
    <table class="w-full text-sm">
      <tbody>
        <tr
          v-for="(row, idx) in rows ?? []"
          :key="idx"
          class="border-t"
          :class="row.label === 'TIE' ? 'bg-muted' : ''"
        >
          <td class="px-4 py-1.5 text-xs text-muted-foreground">
            <span v-if="row.label === 'TIE'" class="font-semibold text-primary">TIE</span>
            <span v-else>{{ row.label }}</span>
          </td>
          <td class="px-4 py-1.5 text-right text-xs font-medium text-foreground tabular-nums">
            {{ formatCOP(row.valor) }}
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="total != null" class="flex items-center justify-between border-t bg-muted px-4 py-2">
      <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total</span>
      <span class="text-sm font-bold text-primary">{{ formatCOP(total) }}</span>
    </div>
  </div>
</template>
