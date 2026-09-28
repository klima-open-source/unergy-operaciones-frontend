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
  <div v-if="!tieneMeta" class="bm-wrap" role="img" aria-label="Sin meta definida">
    <div class="bm-track bm-track--vacia" />
  </div>

  <div v-else class="bm-wrap" role="img" :aria-label="aria">
    <div class="bm-track">
      <!-- Zona previa al ritmo esperado: ayuda a leer "voy atrasado" de un golpe -->
      <div v-if="posMarca !== null" class="bm-zona" :style="{ width: `${posMarca}%` }" />
      <div class="bm-fill" :style="{ width: `${anchoRelleno}%`, background: color }" />
      <div v-if="hayExceso" class="bm-exceso" />
    </div>
    <GTooltip v-if="posMarca !== null">
      <GTooltipTrigger as-child>
        <div class="bm-marca" :style="{ left: `${posMarca}%` }" />
      </GTooltipTrigger>
      <GTooltipContent>{{ tooltipMarca }}</GTooltipContent>
    </GTooltip>
  </div>
</template>

<style scoped>
.bm-wrap {
  position: relative;
  height: 14px;
  width: 100%;
}

.bm-track {
  position: absolute;
  top: 3px;
  left: 0;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  overflow: hidden;
}
.bm-track--vacia {
  background: repeating-linear-gradient(135deg, var(--border) 0 4px, transparent 4px 8px);
}

.bm-zona {
  position: absolute;
  top: 0;
  left: 0;
  height: 8px;
  background: color-mix(in oklab, var(--foreground) 5%, transparent);
}

.bm-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 8px;
  border-radius: 4px;
  transition:
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.2s;
}

/* Tapa turquesa: se lee como "se pasó del borde" */
.bm-exceso {
  position: absolute;
  right: 0;
  top: 0;
  width: 6px;
  height: 8px;
  border-radius: 0 4px 4px 0;
  background: #14b8a6;
  box-shadow: -2px 0 0 var(--background);
}

.bm-marca {
  position: absolute;
  top: 0;
  height: 14px;
  width: 2px;
  border-radius: 1px;
  background: var(--foreground);
  opacity: 0.45;
  transform: translateX(-1px);
}
</style>
