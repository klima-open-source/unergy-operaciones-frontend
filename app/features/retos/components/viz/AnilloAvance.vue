<script setup lang="ts">
import type { EstadoMetrica } from '~/features/retos/types'
import { estadoColor, estadoLabel } from '../retosUi'

const props = withDefaults(
  defineProps<{
    /** Porcentaje de cumplimiento contra el ritmo esperado. `null` = sin datos. */
    pct?: number | null
    estado?: EstadoMetrica | null
    size?: number
  }>(),
  { pct: null, estado: 'sin_datos', size: 52 },
)

const CIRCUNFERENCIA = 2 * Math.PI * 22 // 138.23

const pctSeguro = computed(() => {
  const n = Number(props.pct)
  return props.pct === null || props.pct === undefined || !Number.isFinite(n) ? null : n
})

const color = computed(() => estadoColor(props.estado))
const colorExceso = computed(() => estadoColor('excede'))

const dashPrincipal = computed(() => {
  const p = Math.max(Math.min(pctSeguro.value ?? 0, 100), 0)
  return `${(p / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`
})

const excesoPct = computed(() => {
  if (pctSeguro.value === null) return 0
  return Math.min(Math.max(pctSeguro.value - 100, 0), 100)
})

const dashExceso = computed(() => `${(excesoPct.value / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`)

const etiquetaCentro = computed(() =>
  pctSeguro.value === null ? '—' : String(Math.round(pctSeguro.value)),
)

const aria = computed(() => {
  if (pctSeguro.value === null) return 'Ritmo del trimestre: sin datos'
  return `Ritmo del trimestre: ${Math.round(pctSeguro.value)} por ciento, ${estadoLabel(props.estado).toLowerCase()}`
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 52 52" role="img" :aria-label="aria">
    <g transform="rotate(-90 26 26)">
      <!-- Pista -->
      <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" stroke-width="6" />
      <!-- Arco principal -->
      <circle
        v-if="pctSeguro !== null"
        cx="26"
        cy="26"
        r="22"
        fill="none"
        :stroke="color"
        stroke-width="6"
        stroke-linecap="round"
        :stroke-dasharray="dashPrincipal"
        class="an-arco"
      />
      <!-- Segunda vuelta: lo que se pasó del 100% -->
      <circle
        v-if="excesoPct > 0"
        cx="26"
        cy="26"
        r="22"
        fill="none"
        :stroke="colorExceso"
        stroke-width="6"
        stroke-linecap="round"
        :stroke-dasharray="dashExceso"
        opacity="0.9"
        class="an-arco"
      />
    </g>
    <text
      x="26"
      y="26"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="13"
      font-weight="800"
      :class="pctSeguro === null ? 'fill-muted-foreground' : 'fill-foreground'"
      style="font-variant-numeric: tabular-nums"
    >
      {{ etiquetaCentro }}
    </text>
  </svg>
</template>

<style scoped>
.an-arco {
  transition:
    stroke-dasharray 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    stroke 0.2s;
}
</style>
