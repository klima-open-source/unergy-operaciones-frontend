<script setup lang="ts">
/**
 * Promedio diario del precio de bolsa del mes.
 *
 * Una sola serie, así que no lleva leyenda: el título la nombra. Los colores
 * salen de los tokens de la plataforma (`--primary`, `--border`, `--muted-foreground`)
 * para que el modo oscuro lo resuelva el tema y no una segunda paleta que haya
 * que mantener aparte.
 *
 * La tabla horaria que va debajo de esta gráfica ES la vista de datos: quien
 * necesite el número exacto de una hora lo tiene ahí, no en un tooltip.
 */
import { computed, ref } from 'vue'
import type { PuntoDia } from '~/features/mem/utils/bolsaResumen'

const props = defineProps<{ serie: PuntoDia[] }>()

// Coordenadas internas; el SVG escala con `viewBox`.
const W = 760
const H = 220
const M = { top: 16, right: 16, bottom: 28, left: 52 }

const hover = ref<number | null>(null)

const anchoUtil = W - M.left - M.right
const altoUtil = H - M.top - M.bottom

const escala = computed(() => {
  const valores = props.serie.map((p) => p.promedio)
  if (!valores.length) return null
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  // Un margen del 8% para que la línea no toque los bordes; si el mes fue
  // plano, se abre un rango mínimo o la línea quedaría pegada a un borde.
  const span = max - min || Math.max(max * 0.1, 1)
  const y0 = min - span * 0.08
  const y1 = max + span * 0.08
  return {
    y0,
    y1,
    x: (i: number) => M.left + (props.serie.length === 1
      ? anchoUtil / 2
      : (i / (props.serie.length - 1)) * anchoUtil),
    y: (v: number) => M.top + altoUtil - ((v - y0) / (y1 - y0)) * altoUtil,
  }
})

const linea = computed(() => {
  const e = escala.value
  if (!e) return ''
  return props.serie.map((p, i) => `${i ? 'L' : 'M'}${e.x(i).toFixed(1)},${e.y(p.promedio).toFixed(1)}`).join(' ')
})

/** Cuatro marcas: suficientes para leer la escala sin ensuciar el fondo. */
const marcasY = computed(() => {
  const e = escala.value
  if (!e) return []
  return [0, 1, 2, 3].map((i) => {
    const v = e.y0 + ((e.y1 - e.y0) * i) / 3
    return { v, y: e.y(v) }
  })
})

/** Un día de cada cinco, para que las etiquetas no se encimen. */
const marcasX = computed(() => {
  const e = escala.value
  if (!e) return []
  const paso = Math.max(1, Math.ceil(props.serie.length / 6))
  return props.serie
    .map((p, i) => ({ i, dia: p.dia }))
    .filter(({ i }) => i % paso === 0)
    .map(({ i, dia }) => ({ x: e.x(i), label: dia.slice(8) }))
})

const fmt = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 })

const puntoHover = computed(() => {
  if (hover.value == null) return null
  const p = props.serie[hover.value]
  const e = escala.value
  return p && e ? { p, x: e.x(hover.value), y: e.y(p.promedio) } : null
})

/** El día más cercano al cursor; el área sensible es toda la gráfica. */
function alMover(ev: MouseEvent) {
  const e = escala.value
  if (!e || !props.serie.length) return
  const caja = (ev.currentTarget as SVGElement).getBoundingClientRect()
  const px = ((ev.clientX - caja.left) / caja.width) * W
  const t = (px - M.left) / anchoUtil
  hover.value = Math.max(0, Math.min(props.serie.length - 1, Math.round(t * (props.serie.length - 1))))
}
</script>

<template>
  <div v-if="serie.length" class="rounded-md border p-3">
    <div class="mb-1 text-xs font-medium">Promedio diario del mes · COP/kWh</div>
    <svg
      :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img"
      aria-label="Promedio diario del precio de bolsa"
      @mousemove="alMover" @mouseleave="hover = null"
    >
      <!-- Rejilla recesiva: guía la lectura sin competir con la línea. -->
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
        :x="m.x" :y="H - 8" text-anchor="middle"
        class="fill-current text-[10px] text-muted-foreground"
      >{{ m.label }}</text>

      <!-- 2px y sin marcadores por punto: con 30 días serían ruido. -->
      <path
:d="linea" fill="none" stroke="currentColor" class="text-primary" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" />

      <g v-if="puntoHover">
        <line
          :x1="puntoHover.x" :x2="puntoHover.x" :y1="M.top" :y2="H - M.bottom"
          stroke="currentColor" class="text-muted-foreground" stroke-width="1" stroke-dasharray="3 3"
        />
        <!-- Anillo del color de la superficie: separa el punto de la línea. -->
        <circle
:cx="puntoHover.x" :cy="puntoHover.y" r="5"
                fill="currentColor" class="text-primary" stroke="var(--background)" stroke-width="2" />
      </g>
    </svg>

    <p class="h-4 text-xs text-muted-foreground">
      <template v-if="puntoHover">
        <b class="text-foreground">{{ puntoHover.p.dia }}</b> ·
        {{ fmt(puntoHover.p.promedio) }} COP/kWh
        <span class="text-[11px]">({{ puntoHover.p.horas }} h)</span>
      </template>
    </p>
  </div>
</template>
