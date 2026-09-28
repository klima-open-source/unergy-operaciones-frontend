<script setup lang="ts">
import type { EstadoMetrica } from '~/features/retos/types'
import { estadoColor } from '../retosUi'

interface PuntoSerie {
  semana?: number
  valor: number | null | undefined
}

const props = withDefaults(
  defineProps<{
    /** Serie del contrato: [{ semana, valor }] con nulos donde no hay dato. */
    serie?: PuntoSerie[]
    estado?: EstadoMetrica | null
    w?: number
    h?: number
  }>(),
  { serie: () => [], estado: 'sin_datos', w: 58, h: 18 },
)

interface Punto {
  x: number
  y: number
}

const color = computed(() => estadoColor(props.estado))

const PAD = 2 // deja aire para que el trazo y el punto no se corten

/**
 * Puntos con dato, ya proyectados. Los nulos no producen punto, así que la
 * línea se parte en segmentos en vez de interpolar huecos inexistentes.
 */
const segmentos = computed<Punto[][]>(() => {
  const s = Array.isArray(props.serie) ? props.serie : []
  const valores = s.map((p) =>
    p?.valor === null || p?.valor === undefined ? null : Number(p.valor),
  )
  const conDato = valores.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!conDato.length) return []

  const max = Math.max(...conDato)
  const min = Math.min(0, ...conDato)
  const rango = max - min
  if (rango === 0) {
    // Todo igual (típicamente todo en cero): una recta a media altura.
    const y = props.h / 2
    const pts = valores.map((v, i) => (v === null ? null : { x: proyX(i, valores.length), y }))
    return partir(pts)
  }

  const pts = valores.map((v, i) => {
    if (v === null || !Number.isFinite(v)) return null
    const y = props.h - PAD - ((v - min) / rango) * (props.h - PAD * 2)
    return { x: proyX(i, valores.length), y }
  })
  return partir(pts)
})

function proyX(i: number, total: number) {
  if (total <= 1) return props.w / 2
  return PAD + (i / (total - 1)) * (props.w - PAD * 2)
}

/** Corta la lista en tramos contiguos de puntos no nulos. */
function partir(pts: (Punto | null)[]): Punto[][] {
  const out: Punto[][] = []
  let actual: Punto[] = []
  for (const p of pts) {
    if (p === null) {
      if (actual.length) out.push(actual)
      actual = []
    } else {
      actual.push(p)
    }
  }
  if (actual.length) out.push(actual)
  // Un tramo de un solo punto no dibuja polyline visible: se duplica para que se vea.
  return out.map((seg) =>
    seg.length === 1 ? [seg[0]!, { x: seg[0]!.x + 0.6, y: seg[0]!.y }] : seg,
  )
}

const ultimo = computed<Punto | null>(() => {
  const segs = segmentos.value
  if (!segs.length) return null
  const last = segs[segs.length - 1]!
  return last[last.length - 1] ?? null
})

function areaDe(seg: Punto[]) {
  if (!seg.length) return ''
  const base = props.h
  const cabeza = `M ${seg[0]!.x},${base} L ${seg.map((p) => `${p.x},${p.y}`).join(' L ')}`
  return `${cabeza} L ${seg[seg.length - 1]!.x},${base} Z`
}
</script>

<template>
  <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`" aria-hidden="true" class="block">
    <!-- Sin datos suficientes: solo una línea base -->
    <line
      v-if="!segmentos.length"
      :x1="0"
      :y1="h / 2"
      :x2="w"
      :y2="h / 2"
      stroke="var(--border)"
      stroke-width="1"
    />
    <template v-else>
      <path
        v-for="(seg, i) in segmentos"
        :key="`a${i}`"
        :d="areaDe(seg)"
        :fill="color"
        opacity="0.12"
      />
      <polyline
        v-for="(seg, i) in segmentos"
        :key="`l${i}`"
        :points="seg.map((p) => `${p.x},${p.y}`).join(' ')"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle v-if="ultimo" :cx="ultimo.x" :cy="ultimo.y" r="2" :fill="color" />
    </template>
  </svg>
</template>
