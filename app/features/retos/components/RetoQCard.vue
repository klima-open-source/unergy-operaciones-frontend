<script setup lang="ts">
import type { EstadoMetrica, MetricaReto, RetoResumen } from '~/features/retos/types'
import AnilloAvance from './viz/AnilloAvance.vue'
import RetoSparkline from './viz/RetoSparkline.vue'
import {
  estadoBadgeColor,
  estadoLabel,
  fmtNumero,
  fmtRango,
  periodoBadgeColor,
  periodoLabel,
} from './retosUi'

const props = defineProps<{
  /** `RetoResumen` del contrato (§5). */
  reto: RetoResumen
}>()

const emit = defineEmits<{ abrir: [reto: RetoResumen] }>()

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function abrir() {
  emit('abrir', props.reto)
}

const esEnCurso = computed(() => props.reto.estado_periodo === 'en_curso')

const pctGlobal = computed(() => {
  const crudo = props.reto.avance_global_pct
  const n = Number(crudo)
  if (crudo === null || crudo === undefined || !Number.isFinite(n)) return null
  return n
})

/** Mismos umbrales del contrato §4, aplicados al roll-up del trimestre. */
const estadoQ = computed<EstadoMetrica>(() => {
  const p = pctGlobal.value
  if (p === null) return 'sin_datos'
  if (p < 70) return 'en_riesgo'
  if (p < 100) return 'atencion'
  if (p < 110) return 'cumple'
  return 'excede'
})

function mesDe(iso: string | null | undefined) {
  const m = Number(String(iso || '').split('-')[1])
  return m >= 1 && m <= 12 ? MESES[m - 1] : ''
}

/** `jul–sep` (un solo mes si el trimestre no cruza de mes). */
const mesesRango = computed(() => {
  const a = mesDe(props.reto.fecha_inicio)
  const b = mesDe(props.reto.fecha_fin)
  if (!a && !b) return ''
  if (!b || a === b) return a
  if (!a) return b
  return `${a}–${b}`
})

const rangoTxt = computed(() => fmtRango(props.reto.fecha_inicio, props.reto.fecha_fin))

const semanasTxt = computed(() => {
  const total = Number(props.reto.total_semanas) || 0
  const base = `${total} ${total === 1 ? 'semana' : 'semanas'}`
  const actual = props.reto.semana_actual
  if (actual !== null && actual !== undefined) return `${base} · S${actual} de ${total}`
  if (props.reto.estado_periodo === 'cerrado') return `${base} · cerrado`
  return base
})

const metricasActivas = computed(() => {
  const lista = Array.isArray(props.reto.metricas) ? props.reto.metricas : []
  return lista
    .filter((m) => m && m.activa !== false)
    .slice()
    .sort(
      (a, b) =>
        (Number(a.orden) || 0) - (Number(b.orden) || 0) ||
        (Number(a.id) || 0) - (Number(b.id) || 0),
    )
})

const metricasVisibles = computed(() => metricasActivas.value.slice(0, 3))
const metricasRestantes = computed(() => Math.max(metricasActivas.value.length - 3, 0))

const sinMetricas = computed(
  () => !metricasActivas.value.length && !(Number(props.reto.total_metricas) > 0),
)

function consolidadoDe(m: MetricaReto) {
  return fmtNumero(m.consolidado, m.decimales)
}

const pieTxt = computed(() => {
  const nm = Number(props.reto.total_metricas) || 0
  const ns = Number(props.reto.semanas_con_datos) || 0
  const metricas = `${nm} ${nm === 1 ? 'métrica' : 'métricas'}`
  const semanas = `${ns} ${ns === 1 ? 'semana con datos' : 'semanas con datos'}`
  return `${metricas} · ${semanas}`
})
</script>

<template>
  <Card
    class="cursor-pointer gap-2.5 p-3.5 transition-all duration-150 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-px"
    :class="{ 'border-primary ring-3 ring-primary/10': esEnCurso }"
    role="link"
    tabindex="0"
    :aria-label="`Abrir ${reto.nombre || `Retos Q${reto.trimestre}`}`"
    @click="abrir"
    @keydown.enter.prevent="abrir"
    @keydown.space.prevent="abrir"
  >
    <!-- a) Eyebrow -->
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex min-w-0 items-center gap-1">
        <span class="text-xs font-extrabold text-primary">Q{{ reto.trimestre }}</span>
        <span class="text-muted-foreground">·</span>
        <span class="text-xs font-semibold text-muted-foreground">{{ mesesRango }}</span>
      </span>
      <GBadge :color="periodoBadgeColor(reto.estado_periodo)">
        <span
          v-if="esEnCurso"
          class="size-1.25 rounded-full bg-current motion-safe:animate-pulse"
        />
        {{ periodoLabel(reto.estado_periodo) }}
      </GBadge>
    </div>

    <!-- b) Identidad + anillo -->
    <div class="flex items-start justify-between gap-2.5">
      <div class="min-w-0">
        <TruncatedText
          :text="reto.nombre || `Retos Q${reto.trimestre} ${reto.anio}`"
          class="text-base leading-tight font-extrabold"
        />
        <div class="mt-0.5 text-xs text-muted-foreground">{{ rangoTxt }}</div>
        <div class="text-xs text-muted-foreground">{{ semanasTxt }}</div>
      </div>
      <div class="flex shrink-0 flex-col items-center gap-0.5">
        <AnilloAvance :pct="pctGlobal" :estado="estadoQ" />
        <span class="text-xs font-bold tracking-wider text-muted-foreground uppercase">ritmo</span>
      </div>
    </div>

    <!-- c) Chip de estado agregado -->
    <div>
      <GBadge :color="estadoBadgeColor(estadoQ)">{{ estadoLabel(estadoQ) }}</GBadge>
    </div>

    <template v-if="sinMetricas">
      <!-- Tarjeta sin métricas -->
      <div class="rounded-lg border border-dashed px-2.5 py-3.5 text-center">
        <div class="text-xs font-semibold text-muted-foreground">Sin métricas definidas</div>
        <div class="mt-0.5 text-xs font-bold text-primary">Definir métricas</div>
      </div>
    </template>

    <template v-else>
      <!-- d) Separador -->
      <Separator />

      <!-- e) Lista de métricas (máx. 3) -->
      <div class="flex flex-col gap-1.5">
        <div v-for="m in metricasVisibles" :key="m.id" class="min-w-0">
          <TruncatedText :text="m.nombre" class="text-xs font-semibold" />
          <div class="flex items-center gap-2">
            <!-- `m.serie` es `number[]`; `Sparkline` espera `{ valor }[]`. -->
            <RetoSparkline :serie="m.serie?.map((valor) => ({ valor })) ?? []" :estado="m.estado" />
            <span class="flex-1" />
            <span v-if="consolidadoDe(m) === null" class="text-xs font-bold text-muted-foreground"
              >—</span
            >
            <template v-else>
              <span class="text-xs font-bold tabular-nums">{{ consolidadoDe(m) }}</span>
              <span
                v-if="m.unidad"
                class="text-xs font-semibold text-muted-foreground"
                :class="m.unidad === '%' ? '' : 'ml-0.5'"
              >
                {{ m.unidad }}
              </span>
            </template>
          </div>
        </div>
        <div v-if="metricasRestantes > 0" class="text-xs font-semibold text-primary">
          +{{ metricasRestantes }} {{ metricasRestantes === 1 ? 'métrica más' : 'métricas más' }}
        </div>
      </div>

      <!-- f) Pie -->
      <div class="text-xs font-semibold text-muted-foreground">{{ pieTxt }}</div>
    </template>
  </Card>
</template>
