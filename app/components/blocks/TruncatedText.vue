<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

/**
 * Texto que se recorta con `truncate` y muestra el contenido completo en un Tooltip, pero
 * solo cuando de verdad está recortado. El ancho lo acota quien lo usa (`max-w-*`, o el
 * layout padre con `min-w-0`); este bloque nunca fija un ancho.
 */
const props = defineProps<{
  text: string | number | null | undefined
  /** Líneas visibles antes de recortar; sin valor, una sola línea con `truncate`. */
  lines?: 2 | 3
  class?: HTMLAttributes['class']
}>()

const CLASE_LINEAS = { 2: 'line-clamp-2', 3: 'line-clamp-3' } as const

const el = ref<HTMLElement | null>(null)
const recortado = ref(false)

function medir() {
  const nodo = el.value
  recortado.value =
    !!nodo && (nodo.scrollWidth > nodo.clientWidth || nodo.scrollHeight > nodo.clientHeight)
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <Tooltip :disabled="!recortado">
      <TooltipTrigger as-child>
        <span
          ref="el"
          :class="cn(props.lines ? CLASE_LINEAS[props.lines] : 'block truncate', props.class)"
          @pointerenter="medir"
        >
          <slot>{{ text }}</slot>
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ text }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
