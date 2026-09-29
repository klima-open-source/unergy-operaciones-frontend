<script setup lang="ts">
/**
 * Tile de KPI de una métrica del trimestre (spec §4.4).
 * No navega: al hacer clic hace scroll a su fila de la matriz y la resalta.
 */
import type { MetricaReto } from '~/features/retos/types'
import { EllipsisIcon, EyeIcon, EyeOffIcon, PencilIcon, Trash2Icon } from '@lucide/vue'
import BulletMeta from './viz/BulletMeta.vue'
import RetoSparkline from './viz/RetoSparkline.vue'
import {
  estadoBadgeColor,
  estadoColor,
  estadoLabel,
  fmtNumero,
  fmtPct,
  fmtPctEntero,
  fmtValor,
  TIPOS_AGREGACION,
} from './retosUi'

const props = defineProps<{
  metrica: MetricaReto
  totalSemanas?: number
}>()

const emit = defineEmits<{
  foco: [metrica: MetricaReto]
  editar: [metrica: MetricaReto]
  'alternar-activa': [metrica: MetricaReto]
  eliminar: [metrica: MetricaReto]
}>()

function numeroONulo(v: number | null | undefined) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const tieneMeta = computed(() => numeroONulo(props.metrica.meta) !== null)

/** `MWh · suma · Laura` — los tramos vacíos se omiten, no dejan huecos. */
const metaDatos = computed(() => {
  const m = props.metrica
  const partes: string[] = []
  if (m.unidad) partes.push(m.unidad)
  const agg = TIPOS_AGREGACION.find((t) => t.value === m.tipo_agregacion)
  if (agg) partes.push(agg.label.toLowerCase())
  if (m.responsable) partes.push(m.responsable)
  return partes.join(' · ')
})

const consolidadoTxt = computed(() =>
  fmtNumero(props.metrica.consolidado, props.metrica.decimales || 0),
)

const metaTxt = computed(() =>
  fmtValor(props.metrica.meta, props.metrica.decimales || 0, props.metrica.unidad || ''),
)

const pie2 = computed(() => {
  const m = props.metrica
  const semanas = `${m.semanas_con_dato ?? 0} de ${props.totalSemanas ?? 0} semanas con dato`
  if (!tieneMeta.value) return semanas
  const esSuma = m.tipo_agregacion === 'suma'
  // En `suma` la meta se prorratea, así que hay un "esperado a hoy"; en el
  // resto de agregaciones la meta es la misma toda la ventana (contrato §4).
  const valor = fmtValor(esSuma ? m.meta_esperada : m.meta, m.decimales || 0, m.unidad || '')
  return `${esSuma ? 'Esperado a hoy' : 'Meta'} ${valor} · ${semanas}`
})
</script>

<template>
  <div
    class="group flex cursor-pointer flex-col gap-2 rounded-xl border bg-card px-3.5 py-3 shadow-xs"
    @click="emit('foco', metrica)"
  >
    <!-- 1. Fila título -->
    <div class="flex min-w-0 items-center gap-1.5">
      <GTooltip>
        <GTooltipTrigger as-child>
          <span class="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{{
            metrica.nombre
          }}</span>
        </GTooltipTrigger>
        <GTooltipContent v-if="metrica.descripcion">{{ metrica.descripcion }}</GTooltipContent>
      </GTooltip>
      <GBadge v-if="!metrica.activa" variant="outline">Inactiva</GBadge>
      <GBadge :color="estadoBadgeColor(metrica.estado)">{{ estadoLabel(metrica.estado) }}</GBadge>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="flex-none opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
            :aria-label="`Acciones de ${metrica.nombre}`"
            @click.stop
          >
            <EllipsisIcon class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" @click.stop>
          <DropdownMenuItem @click="emit('editar', metrica)">
            <PencilIcon class="size-4" />
            Editar métrica
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('alternar-activa', metrica)">
            <component :is="metrica.activa ? EyeOffIcon : EyeIcon" class="size-4" />
            {{ metrica.activa ? 'Desactivar métrica' : 'Activar métrica' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" @click="emit('eliminar', metrica)">
            <Trash2Icon class="size-4" />
            Eliminar métrica
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- 2. Fila metadatos -->
    <div
      v-if="metaDatos || metrica.direccion === 'menor_mejor'"
      class="-mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground"
    >
      <span v-if="metaDatos">{{ metaDatos }}</span>
      <span
        v-if="metrica.direccion === 'menor_mejor'"
        class="flex-none rounded-full bg-foreground/5 px-1.5 text-xs font-bold text-muted-foreground"
        >menos es mejor</span
      >
    </div>

    <!-- 3. Fila cifras -->
    <div class="flex min-w-0 items-baseline gap-1.5 [&_svg]:flex-none [&_svg]:self-center">
      <span
        class="text-xl leading-tight font-extrabold tabular-nums"
        :class="consolidadoTxt === null ? 'text-muted-foreground' : 'text-foreground'"
      >
        {{ consolidadoTxt === null ? '—' : consolidadoTxt }}
      </span>
      <span
        v-if="tieneMeta"
        class="text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
        >/ {{ metaTxt }}</span
      >
      <span class="flex-1" />
      <!-- `metrica.serie` es `number[]`; `RetoSparkline` espera `{ valor }[]`.
           La versión legacy pasaba los números sueltos y el componente los
           leía como `p?.valor` (siempre `undefined`) — el trazo nunca se veía. -->
      <RetoSparkline
        :serie="metrica.serie?.map((valor) => ({ valor })) ?? []"
        :estado="metrica.estado"
      />
    </div>

    <!-- 4. Bullet -->
    <BulletMeta
      :avance-pct="numeroONulo(metrica.avance_pct)"
      :meta="numeroONulo(metrica.meta)"
      :meta-esperada="numeroONulo(metrica.meta_esperada)"
      :estado="metrica.estado"
      :unidad="metrica.unidad || ''"
      :decimales="metrica.decimales || 0"
    />

    <!-- 5 y 6. Pie -->
    <div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
        <template v-if="tieneMeta">
          <span>{{ fmtPct(metrica.avance_pct) }} de la meta</span>
          <span class="text-muted-foreground">·</span>
          <span class="text-(--c)" :style="{ '--c': estadoColor(metrica.estado) }"
            >ritmo {{ fmtPctEntero(metrica.cumplimiento_pct) }}</span
          >
        </template>
        <span v-else class="font-semibold text-muted-foreground">Sin meta definida</span>
      </div>
      <div class="mt-0.5 text-xs text-muted-foreground">{{ pie2 }}</div>
    </div>
  </div>
</template>
