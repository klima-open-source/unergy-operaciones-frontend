<script setup lang="ts">
import type { EstadoMetrica } from '~/features/retos/types'
import { estadoColor, estadoLabel, fmtValor } from '../retosUi'

const props = withDefaults(
  defineProps<{
    /** consolidado / meta * 100 */
    avancePct?: number | null
    meta?: number | null
    metaEsperada?: number | null
    estado?: EstadoMetrica | null
    unidad?: string
    decimales?: number
  }>(),
  {
    avancePct: null,
    meta: null,
    metaEsperada: null,
    estado: 'sin_datos',
    unidad: '',
    decimales: 0,
  },
)

const tieneMeta = computed(() => {
  const m = Number(props.meta)
  return props.meta !== null && props.meta !== undefined && Number.isFinite(m) && m !== 0
})

const color = computed(() => estadoColor(props.estado))

const anchoRelleno = computed(() => {
  const p = Number(props.avancePct)
  if (!Number.isFinite(p)) return 0
  return Math.max(Math.min(p, 100), 0)
})

const hayExceso = computed(() => Number(props.avancePct) > 100)

/** Posición de la marca de ritmo esperado, en % del ancho. */
const posMarca = computed(() => {
  if (!tieneMeta.value) return null
  const esperada = Number(props.metaEsperada)
  if (props.metaEsperada === null || props.metaEsperada === undefined || !Number.isFinite(esperada))
    return null
  const pos = (esperada / Number(props.meta)) * 100
  return Math.max(Math.min(pos, 100), 0)
})

const tooltipMarca = computed(
  () => `Meta esperada a hoy: ${fmtValor(props.metaEsperada, props.decimales, props.unidad)}`,
)

const aria = computed(() => {
  const av = Number.isFinite(Number(props.avancePct)) ? Math.round(Number(props.avancePct)) : null
  const partes = [av === null ? 'Sin avance registrado' : `Avance ${av} por ciento de la meta`]
  if (posMarca.value !== null)
    partes.push(`esperado a hoy ${Math.round(posMarca.value)} por ciento`)
  partes.push(`estado ${estadoLabel(props.estado).toLowerCase()}`)
  return partes.join(', ')
})
</script>

<template>
  <!-- Sin meta no hay contra qué medir: se muestra una pista rayada, no una barra en cero -->
  <div v-if="!tieneMeta" class="relative h-3.5 w-full" role="img" aria-label="Sin meta definida">
    <div class="bm-track-vacia absolute top-0.75 left-0 h-2 w-full overflow-hidden rounded-sm" />
  </div>

  <div v-else class="relative h-3.5 w-full" role="img" :aria-label="aria">
    <div class="absolute top-0.75 left-0 h-2 w-full overflow-hidden rounded-sm bg-border">
      <!-- Zona previa al ritmo esperado: ayuda a leer "voy atrasado" de un golpe -->
      <div
        v-if="posMarca !== null"
        class="absolute top-0 left-0 h-2 w-(--w) bg-foreground/5"
        :style="{ '--w': `${posMarca}%` }"
      />
      <div
        class="absolute top-0 left-0 h-2 w-(--w) rounded-sm bg-(--c) transition-all duration-300"
        :style="{ '--w': `${anchoRelleno}%`, '--c': color }"
      />
      <div
        v-if="hayExceso"
        class="absolute top-0 right-0 h-2 w-1.5 rounded-r-sm border-l-2 border-background bg-chart-2"
      />
    </div>
    <GTooltip v-if="posMarca !== null">
      <GTooltipTrigger as-child>
        <div
          class="absolute top-0 left-(--l) h-3.5 w-0.5 -translate-x-px rounded-xs bg-foreground opacity-45"
          :style="{ '--l': `${posMarca}%` }"
        />
      </GTooltipTrigger>
      <GTooltipContent>{{ tooltipMarca }}</GTooltipContent>
    </GTooltip>
  </div>
</template>

<style scoped>
/* Pista rayada de "sin meta": el degradado repetido no tiene utilidad de Tailwind. */
.bm-track-vacia {
  background: repeating-linear-gradient(135deg, var(--border) 0 4px, transparent 4px 8px);
}
</style>
