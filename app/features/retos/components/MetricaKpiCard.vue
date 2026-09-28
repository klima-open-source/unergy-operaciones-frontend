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
  <div class="rq-card rq-kpi group" @click="emit('foco', metrica)">
    <!-- 1. Fila título -->
    <div class="rq-kpi-head">
      <GTooltip>
        <GTooltipTrigger as-child>
          <span class="rq-kpi-nombre">{{ metrica.nombre }}</span>
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
            class="rq-kpi-mas"
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
    <div v-if="metaDatos || metrica.direccion === 'menor_mejor'" class="rq-kpi-meta">
      <span v-if="metaDatos">{{ metaDatos }}</span>
      <span v-if="metrica.direccion === 'menor_mejor'" class="rq-chip-dir">menos es mejor</span>
    </div>

    <!-- 3. Fila cifras -->
    <div class="rq-kpi-cifras">
      <span class="rq-kpi-consolidado" :class="{ 'rq-kpi-nulo': consolidadoTxt === null }">
        {{ consolidadoTxt === null ? '—' : consolidadoTxt }}
      </span>
      <span v-if="tieneMeta" class="rq-kpi-meta-valor">/ {{ metaTxt }}</span>
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
      <div class="rq-kpi-pie1">
        <template v-if="tieneMeta">
          <span>{{ fmtPct(metrica.avance_pct) }} de la meta</span>
          <span class="rq-kpi-punto">·</span>
          <span :style="{ color: estadoColor(metrica.estado) }"
            >ritmo {{ fmtPctEntero(metrica.cumplimiento_pct) }}</span
          >
        </template>
        <span v-else class="rq-kpi-sin-meta">Sin meta definida</span>
      </div>
      <div class="rq-kpi-pie2">{{ pie2 }}</div>
    </div>
  </div>
</template>

<style scoped>
.rq-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(44, 32, 57, 0.04);
}

.rq-kpi {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}

/* 1. Título */
.rq-kpi-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.rq-kpi-nombre {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rq-chip-dir {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted-foreground);
  background: color-mix(in oklab, var(--foreground) 6%, transparent);
  padding: 0 6px;
  border-radius: 999px;
}

/* El menú solo aparece cuando la tarjeta está viva: no compite con el dato */
.rq-kpi-mas {
  flex: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.group:hover .rq-kpi-mas,
.group:focus-within .rq-kpi-mas {
  opacity: 1;
}

/* 2. Metadatos */
.rq-kpi-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 10px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-top: -4px;
}

/* 3. Cifras */
.rq-kpi-cifras {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.rq-kpi-consolidado {
  font-size: 20px;
  font-weight: 800;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.rq-kpi-nulo {
  color: var(--muted-foreground);
}
.rq-kpi-meta-valor {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.rq-kpi-cifras :deep(svg) {
  align-self: center;
  flex: none;
}

/* 5 y 6. Pie */
.rq-kpi-pie1 {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  font-size: 11px;
  font-weight: 600;
  color: var(--foreground);
}
.rq-kpi-punto {
  color: var(--muted-foreground);
}
.rq-kpi-sin-meta {
  color: var(--muted-foreground);
  font-weight: 600;
}
.rq-kpi-pie2 {
  font-size: 10px;
  font-weight: 400;
  color: var(--muted-foreground);
  margin-top: 2px;
}
</style>
