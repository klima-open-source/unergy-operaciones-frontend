<script setup lang="ts">
interface Punto {
  porcentaje?: number | null
}

const props = withDefaults(defineProps<{ puntos?: Punto[] }>(), { puntos: () => [] })

const WIDTH = 120
const HEIGHT = 28
const PADDING = 3

const coords = computed(() => {
  const puntos = props.puntos.filter((p) => p.porcentaje != null)
  if (puntos.length < 2) return []
  const valores = puntos.map((p) => p.porcentaje as number)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  return puntos.map((p, i) => ({
    x: PADDING + (i * (WIDTH - 2 * PADDING)) / (puntos.length - 1),
    y: HEIGHT - PADDING - (((p.porcentaje as number) - min) / rango) * (HEIGHT - 2 * PADDING),
  }))
})

const ultimoPunto = computed(() => coords.value.at(-1) ?? { x: 0, y: 0 })
</script>

<template>
  <svg
    v-if="coords.length >= 2"
    :width="WIDTH"
    :height="HEIGHT"
    class="shrink-0 text-primary"
    aria-hidden="true"
  >
    <polyline
      :points="coords.map((c) => `${c.x},${c.y}`).join(' ')"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle :cx="ultimoPunto.x" :cy="ultimoPunto.y" r="2.5" fill="currentColor" />
  </svg>
  <span v-else class="text-xs text-muted-foreground">—</span>
</template>
