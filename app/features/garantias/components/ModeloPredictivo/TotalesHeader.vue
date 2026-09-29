<script setup lang="ts">
import type { TotalesModeloPredictivo } from '~/features/garantias/types'

defineProps<{
  totales: TotalesModeloPredictivo | null
}>()
</script>

<template>
  <div v-if="totales" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <div class="rounded-xl bg-primary/5 p-4">
      <p class="mb-1 text-xs text-muted-foreground">Suma de P90 semanales</p>
      <p class="text-2xl font-bold text-foreground">{{ formatCOP(totales.suma_p90) }}</p>
      <p class="mt-1 text-xs text-muted-foreground">Reservando semana a semana</p>
    </div>

    <div class="rounded-xl bg-primary/5 p-4">
      <p class="mb-1 text-xs text-muted-foreground">P90 del horizonte</p>
      <p class="text-2xl font-bold text-foreground">{{ formatCOP(totales.p90_total) }}</p>
      <p class="mt-1 text-xs text-muted-foreground">Con un pozo común</p>
    </div>

    <div class="rounded-xl bg-success/10 p-4">
      <p class="mb-1 text-xs text-muted-foreground">Libera juntar el pozo</p>
      <p
        class="text-2xl font-bold"
        :class="totales.brecha > 0 ? 'text-success' : 'text-muted-foreground'"
      >
        {{ formatCOP(totales.brecha) }}
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        {{
          totales.brecha > 0
            ? 'Diferencia entre las dos políticas'
            : 'Las semanas están muy correlacionadas: juntar el pozo no libera capital'
        }}
      </p>
    </div>

    <div class="rounded-xl bg-muted p-4">
      <p class="mb-1 text-xs text-muted-foreground">Escenario central</p>
      <p class="text-2xl font-bold text-muted-foreground">{{ formatCOP(totales.central) }}</p>
      <p class="mt-1 text-xs text-muted-foreground">Sin colchón</p>
    </div>
  </div>
</template>
