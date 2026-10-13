<script setup lang="ts">
/**
 * Total por día de una columna del dataset consultado.
 *
 * Una sola serie, así que no lleva leyenda: el título dice qué columna es. Los
 * colores salen de los tokens de la plataforma para que el modo oscuro lo
 * resuelva el tema.
 */
import { computed, ref } from 'vue'

export interface PuntoDiario {
  dia: string
  valor: number
}

const props = defineProps<{ puntos: PuntoDiario[], titulo: string, unidad?: string }>()

const W = 760
const H = 230
const M = { top: 16, right: 16, bottom: 30, left: 60 }
const anchoUtil = W - M.left - M.right
const altoUtil = H - M.top - M.bottom

const hover = ref<number | null>(null)

const escala = computed(() => {
  if (!props.puntos.length) return null
  const vals = props.puntos.map((p) => p.valor)
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, 0)
  // El cero SIEMPRE entra: en totales diarios, un día en cero es información y
  // cortar el eje lo escondería.
  const span = max - min || Math.max(Math.abs(max) * 0.1, 1)
  const y1 = max + span * 0.08
  const y0 = min === 0 ? 0 : min - span * 0.08
  return {
    y0,
    y1,
    x: (i: number) => M.left + (props.puntos.length === 1
      ? anchoUtil / 2
      : (i / (props.puntos.length - 1)) * anchoUtil),
    y: (v: number) => M.top + altoUtil - ((v - y0) / (y1 - y0)) * altoUtil,
  }
})

const linea = computed(() => {
  const e = escala.value
  if (!e) return ''
  return props.puntos
    .map((p, i) => `${i ? 'L' : 'M'}${e.x(i).toFixed(1)},${e.y(p.valor).toFixed(1)}`)
    .join(' ')
})

/** El área bajo la línea: ayuda a leer la magnitud sin competir con el trazo. */
const area = computed(() => {
  const e = escala.value
  if (!e || !props.puntos.length) return ''
  const base = e.y(Math.max(e.y0, 0))
  return `${linea.value} L${e.x(props.puntos.length - 1).toFixed(1)},${base.toFixed(1)} `
    + `L${e.x(0).toFixed(1)},${base.toFixed(1)} Z`
})

const marcasY = computed(() => {
  const e = escala.value
  if (!e) return []
  return [0, 1, 2, 3, 4].map((i) => {
    const v = e.y0 + ((e.y1 - e.y0) * i) / 4
    return { v, y: e.y(v) }
  })
})

const marcasX = computed(() => {
  const e = escala.value
  if (!e) return []
  const paso = Math.max(1, Math.ceil(props.puntos.length / 12))
  return props.puntos
    .map((p, i) => ({ i, dia: p.dia }))
    .filter(({ i }) => i % paso === 0)
    .map(({ i, dia }) => ({ x: e.x(i), label: dia.slice(5) }))
})

const fmt = (v: number) =>
  Math.abs(v) >= 10_000
    ? `${(v / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k`
    : v.toLocaleString('es-CO', { maximumFractionDigits: 2 })

const puntoHover = computed(() => {
  if (hover.value == null) return null
  const p = props.puntos[hover.value]
  const e = escala.value
  return p && e ? { p, x: e.x(hover.value), y: e.y(p.valor) } : null
})

function alMover(ev: MouseEvent) {
  const e = escala.value
  if (!e || !props.puntos.length) return
  const caja = (ev.currentTarget as SVGElement).getBoundingClientRect()
  const t = (((ev.clientX - caja.left) / caja.width) * W - M.left) / anchoUtil
  hover.value = Math.max(0, Math.min(props.puntos.length - 1,
    Math.round(t * (props.puntos.length - 1))))
}
</script>

<template>
  <div v-if="puntos.length">
    <svg
      :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="titulo"
      @mousemove="alMover" @mouseleave="hover = null"
    >
      <g>
        <line
          v-for="m in marcasY" :key="m.v"
          :x1="M.left" :x2="W - M.right" :y1="m.y" :y2="m.y"
          stroke="currentColor" class="text-border" stroke-width="1"
        />
        <text
          v-for="m in marcasY" :key="`t${m.v}`"
          :x="M.left - 8" :y="m.y + 3" text-anchor="end"
          class="fill-current text-[10px] text-muted-foreground"
        >{{ fmt(m.v) }}</text>
      </g>

      <text
        v-for="m in marcasX" :key="m.label"
        :x="m.x" :y="H - 10" text-anchor="middle"
        class="fill-current text-[10px] text-muted-foreground"
      >{{ m.label }}</text>

      <path :d="area" class="fill-primary/10" stroke="none" />
      <path
        :d="linea" fill="none" stroke="currentColor" class="text-primary"
        stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
      />
      <!-- Un punto por día: con rangos de pocas semanas se leen bien y marcan
           dónde hay dato, que en estos datasets no es obvio. -->
      <circle
        v-for="(p, i) in puntos" :key="p.dia"
        :cx="escala!.x(i)" :cy="escala!.y(p.valor)" r="2.5"
        fill="currentColor" class="text-primary"
      />

      <g v-if="puntoHover">
        <line
          :x1="puntoHover.x" :x2="puntoHover.x" :y1="M.top" :y2="H - M.bottom"
          stroke="currentColor" class="text-muted-foreground"
          stroke-width="1" stroke-dasharray="3 3"
        />
        <circle
          :cx="puntoHover.x" :cy="puntoHover.y" r="5"
          fill="currentColor" class="text-primary" stroke="var(--background)" stroke-width="2"
        />
      </g>
    </svg>

    <p class="h-4 text-xs text-muted-foreground">
      <template v-if="puntoHover">
        <b class="text-foreground">{{ puntoHover.p.dia }}</b> ·
        {{ puntoHover.p.valor.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }}
        <template v-if="unidad">{{ unidad }}</template>
      </template>
    </p>
  </div>
</template>
