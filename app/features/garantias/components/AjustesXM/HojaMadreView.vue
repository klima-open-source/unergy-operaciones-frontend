<script setup lang="ts">
import type { HojaMadre } from './composables/useGarantiasParser'
import BloqueCodigo from './BloqueCodigo.vue'

const props = defineProps<{
  data: HojaMadre | null
}>()

const preciosList = computed(() => {
  const p = props.data?.precios
  if (!p) return []
  return Object.entries(p)
    .filter((entry): entry is [string, number] => entry[1] != null)
    .map(([key, val]) => ({ key, val }))
})

// Negativo = lo disponible en custodia no alcanza para la garantía → hay que
// consignar la diferencia. Positivo/cero = alcanza y sobra ese monto.
const aplicacionAlcanza = computed(() => (props.data?.disponibleAplicacion ?? 0) >= 0)
const aplicacionMonto = computed(() => Math.abs(props.data?.disponibleAplicacion ?? 0))
</script>

<template>
  <div v-if="data" class="space-y-4">
    <!-- Encabezado opcional -->
    <div
      v-if="data.fechaNombre || data.variacionPb != null"
      class="flex flex-wrap items-center gap-2"
    >
      <span v-if="data.fechaNombre" class="text-xs font-semibold text-muted-foreground">{{
        data.fechaNombre
      }}</span>
      <GBadge
        v-if="data.variacionPb != null"
        :color="data.variacionPb >= 0 ? 'destructive' : 'success'"
      >
        PB {{ data.variacionPb > 0 ? '+' : '' }}{{ data.variacionPb }}% vs sem. anterior
      </GBadge>
    </div>

    <!-- Chips de precios -->
    <div v-if="preciosList.length" class="flex flex-wrap gap-2">
      <GBadge v-for="p in preciosList" :key="p.key" color="action">
        {{ p.key.toUpperCase() }}: {{ p.key === 'trm' ? formatCOP(p.val) : p.val.toFixed(2) }}
      </GBadge>
    </div>

    <!-- Bloques UNGC / UNGG -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <BloqueCodigo titulo="UNGC" :rows="data.ungc || []" :total="data.totalUNGC" />
      <BloqueCodigo titulo="UNGG" :rows="data.ungg || []" :total="data.totalUNGG" />
    </div>

    <!-- Total combinado -->
    <div
      class="flex items-center justify-between rounded-xl bg-primary px-4 py-2 text-primary-foreground"
    >
      <span class="text-xs font-bold tracking-wide uppercase">UNGG y UNGC — Total a pagar</span>
      <span class="text-sm font-bold">{{ formatCOP(data.totalConsignar) }}</span>
    </div>

    <!-- Panel custodia (desglose auditable) -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Disponible (crudo)
        </p>
        <p class="text-base font-bold text-foreground">{{ formatCOP(data.disponibleCrudo) }}</p>
      </div>
      <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          (−) Facturas descontadas
        </p>
        <p class="text-base font-bold text-destructive">
          {{ formatCOP(data.facturasDescontadas) }}
        </p>
      </div>
      <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Disponible neto
        </p>
        <p
          class="text-base font-bold"
          :class="(data.disponibleNeto ?? 0) < 0 ? 'text-destructive' : 'text-success'"
        >
          {{ formatCOP(data.disponibleNeto) }}
        </p>
      </div>
      <div
        class="rounded-xl border p-4 text-center"
        :class="
          aplicacionAlcanza
            ? 'border-success/30 bg-success/10'
            : 'border-destructive/30 bg-destructive/10'
        "
      >
        <p
          class="mb-1 text-xs font-semibold tracking-wide uppercase"
          :class="aplicacionAlcanza ? 'text-success' : 'text-destructive'"
        >
          {{ aplicacionAlcanza ? '✅ Alcanza (Aplic. garantía)' : '⚠️ Falta consignar' }}
        </p>
        <p
          class="text-base font-bold"
          :class="aplicacionAlcanza ? 'text-success' : 'text-destructive'"
        >
          {{ formatCOP(aplicacionMonto) }}
        </p>
      </div>
      <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Congelado
        </p>
        <p class="text-base font-bold text-foreground">{{ formatCOP(data.congelado) }}</p>
      </div>
      <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Saldo
        </p>
        <p class="text-base font-bold text-primary">{{ formatCOP(data.saldo) }}</p>
      </div>
    </div>
  </div>
</template>
