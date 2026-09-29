<script setup lang="ts">
/**
 * Drawer del ritual semanal (spec §6).
 *
 * Cada métrica tiene un borrador local (`campos`); lo que está en `props.valores`
 * es la verdad ya guardada (`originales`). La diferencia entre ambos es lo que
 * se manda al pulsar Guardar, con un PUT por métrica modificada en paralelo.
 *
 * Navegar con ‹ › guarda solo si hay cambios: moverse implica dar la semana por
 * buena (§6.7). Cerrar, en cambio, pide confirmación — cerrar no es confirmar.
 */
import type { Component } from 'vue'
import type { MetricaReto, SemanaReto, ValoresPorMetrica } from '~/features/retos/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
} from '@lucide/vue'
import { readDetail } from '~/core/errors'
import { toast } from 'vue-sonner'
import { borrarClave, fmtNumero } from './retosUi'

interface Campo {
  valor: number | null
  nota: string
}

interface GuardarValorArgs {
  metricaId: number
  semanaInicio: string
  valor: number | null
  nota: string | null
}

const props = defineProps<{
  visible?: boolean
  /** Semana activa del contrato (`semanas[]` de RetoDetalle). */
  semana?: SemanaReto | null
  semanas?: SemanaReto[]
  metricas?: MetricaReto[]
  valores?: ValoresPorMetrica
  guardarValor: (args: GuardarValorArgs) => Promise<unknown>
}>()

const emit = defineEmits<{ 'update:visible': [visible: boolean]; navegar: [delta: number] }>()

const confirm = useConfirm()

const cuerpoEl = ref<HTMLElement | null>(null)
const guardando = ref(false)
const campos = reactive<Record<number, Campo>>({})
const originales = reactive<Record<number, Campo>>({})
const notasForzadas = reactive<Record<number, boolean>>({})
const erroresFila = reactive<Record<number, string>>({})

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// ── Derivados ───────────────────────────────────────────────────────────
const metricasActivas = computed(() =>
  (props.metricas || [])
    .filter((m) => m.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
)

const haySemanaAnterior = computed(() => (props.semana?.numero ?? 1) > 1)

const haySemanaSiguiente = computed(() => {
  const total = (props.semanas || []).length
  return total > 0 && (props.semana?.numero ?? total) < total
})

const semanaAnterior = computed(() => {
  if (!haySemanaAnterior.value || !props.semana) return null
  return (props.semanas || []).find((s) => s.numero === props.semana!.numero - 1) || null
})

const conDato = computed(
  () =>
    metricasActivas.value.filter(
      (m) => campos[m.id]?.valor !== null && campos[m.id]?.valor !== undefined,
    ).length,
)

const completa = computed(
  () => metricasActivas.value.length > 0 && conDato.value === metricasActivas.value.length,
)

const pctLlenado = computed(() => {
  const total = metricasActivas.value.length
  return total ? Math.round((conDato.value / total) * 100) : 0
})

const hayCambios = computed(() => metricasActivas.value.some(sucia))

/** `Solo del 1 al 5 de julio cae dentro del trimestre` */
const tooltipParcial = computed(() => {
  const s = props.semana
  if (!s?.inicio_efectivo || !s?.fin_efectivo)
    return 'La semana no cae completa dentro del trimestre'
  const [, mi, di] = String(s.inicio_efectivo).split('-').map(Number)
  const [, mf, df] = String(s.fin_efectivo).split('-').map(Number)
  const izq = mi === mf ? `${di}` : `${di} de ${MESES_LARGOS[mi! - 1]}`
  return `Solo del ${izq} al ${df} de ${MESES_LARGOS[mf! - 1]} cae dentro del trimestre`
})

/** Del `updated_at` más reciente entre los valores ya guardados de la semana. */
const ultimaEdicion = computed(() => {
  if (!props.semana) return ''
  let mejor: { t: Date; quien?: string | null } | null = null
  for (const m of metricasActivas.value) {
    const reg = props.valores?.[m.id]?.[props.semana.inicio]
    if (!reg?.updated_at) continue
    const t = new Date(reg.updated_at)
    if (!Number.isFinite(t.getTime())) continue
    if (!mejor || t > mejor.t) mejor = { t, quien: reg.actualizado_por }
  }
  if (!mejor) return 'Sin registros esta semana'
  const quien = mejor.quien ? `${mejor.quien} · ` : ''
  return `Última edición: ${quien}${fmtEdicion(mejor.t)}`
})

// ── Borradores ──────────────────────────────────────────────────────────
function decimalesDe(m: MetricaReto) {
  return Math.min(Math.max(Number(m.decimales) || 0, 0), 4)
}

/** `%` va pegado; el resto separado. Sin unidad no se pone sufijo. */
function sufijoDe(m: MetricaReto) {
  const u = (m.unidad || '').trim()
  if (!u) return undefined
  return u === '%' ? '%' : ` ${u}`
}

function registroDe(m: MetricaReto) {
  if (!props.semana) return null
  return props.valores?.[m.id]?.[props.semana.inicio] || null
}

function numeroONulo(v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Rehace borradores y originales desde las props. Se pierde lo no guardado. */
function sincronizar() {
  for (const k of Object.keys(campos)) borrarClave(campos, Number(k))
  for (const k of Object.keys(originales)) borrarClave(originales, Number(k))
  for (const k of Object.keys(notasForzadas)) borrarClave(notasForzadas, Number(k))
  for (const k of Object.keys(erroresFila)) borrarClave(erroresFila, Number(k))
  for (const m of metricasActivas.value) {
    const reg = registroDe(m)
    const base = { valor: numeroONulo(reg?.valor), nota: reg?.nota ? String(reg.nota) : '' }
    campos[m.id] = { ...base }
    originales[m.id] = { ...base }
  }
}

function sucia(m: MetricaReto) {
  const a = campos[m.id]
  const b = originales[m.id]
  if (!a || !b) return false
  return a.valor !== b.valor || (a.nota || '').trim() !== (b.nota || '').trim()
}

function fijarValor(m: MetricaReto, v: number | null | undefined) {
  if (!campos[m.id]) campos[m.id] = { valor: null, nota: '' }
  campos[m.id]!.valor = numeroONulo(v)
  borrarClave(erroresFila, m.id)
}

function fijarNota(m: MetricaReto, v: string | null | undefined) {
  if (!campos[m.id]) campos[m.id] = { valor: null, nota: '' }
  campos[m.id]!.nota = v ?? ''
  borrarClave(erroresFila, m.id)
}

function notaAbierta(m: MetricaReto) {
  return !!notasForzadas[m.id] || !!(campos[m.id]?.nota || '').length
}

function abrirNota(m: MetricaReto) {
  notasForzadas[m.id] = true
  nextTick(() => {
    const fila = cuerpoEl.value?.querySelector(`[data-metrica="${m.id}"]`)?.closest('.rq-dw-fila')
    fila?.querySelector('textarea')?.focus()
  })
}

// ── Referencia y delta contra la semana anterior (§6.5) ─────────────────
function refAnterior(m: MetricaReto) {
  const prev = semanaAnterior.value
  if (!prev) return null
  return numeroONulo(props.valores?.[m.id]?.[prev.inicio]?.valor)
}

interface Delta {
  texto: string
  icono: Component | null
  clase: string
}

function delta(m: MetricaReto): Delta | null {
  const prev = refAnterior(m)
  const actual = campos[m.id]?.valor
  if (prev === null || actual === null || actual === undefined) return null

  const d = actual - prev
  const dec = decimalesDe(m)
  if (Math.abs(d) < 10 ** -(dec + 3)) {
    return { texto: `= ${fmtNumero(0, dec)}`, icono: null, clase: 'text-muted-foreground' }
  }
  const sube = d > 0
  const bueno = m.direccion === 'menor_mejor' ? !sube : sube
  return {
    texto: `${sube ? '+' : '−'}${fmtNumero(Math.abs(d), dec)}`,
    icono: sube ? ArrowUpIcon : ArrowDownIcon,
    clase: bueno ? 'text-success' : 'text-destructive',
  }
}

// ── Guardado (§6.7) ─────────────────────────────────────────────────────
async function guardarSemana({ cerrarAlTerminar = true }: { cerrarAlTerminar?: boolean } = {}) {
  const sucias = metricasActivas.value.filter(sucia)
  if (!sucias.length) {
    if (cerrarAlTerminar) cerrar()
    return true
  }
  const numero = props.semana?.numero
  const inicio = props.semana?.inicio
  guardando.value = true
  for (const k of Object.keys(erroresFila)) borrarClave(erroresFila, Number(k))

  const resultados = await Promise.allSettled(
    sucias.map((m) =>
      props.guardarValor({
        metricaId: m.id,
        semanaInicio: inicio!,
        valor: campos[m.id]!.valor,
        nota: (campos[m.id]!.nota || '').trim() || null,
      }),
    ),
  )
  guardando.value = false

  const ok: MetricaReto[] = []
  const fallos: MetricaReto[] = []
  resultados.forEach((r, i) => {
    const m = sucias[i]!
    if (r.status === 'fulfilled') {
      ok.push(m)
      // El padre ya actualizó `valores`; se mueve la línea base para que la
      // fila deje de verse sucia sin perder lo tecleado en las demás.
      originales[m.id] = { ...campos[m.id]!, nota: (campos[m.id]!.nota || '').trim() }
    } else {
      fallos.push(m)
      erroresFila[m.id] = detalleError(r.reason)
    }
  })

  if (!fallos.length) {
    toast.success(`Semana ${numero} registrada`, {
      description: `${ok.length} ${ok.length === 1 ? 'métrica actualizada' : 'métricas actualizadas'}`,
    })
    if (cerrarAlTerminar) cerrar()
    return true
  }

  if (ok.length) {
    toast.warning(`Se guardaron ${ok.length} de ${sucias.length} métricas`)
  } else {
    // Si `ok` está vacío, las `sucias` fallaron todas: `resultados[0]` es un rechazo.
    const primerRechazo = resultados.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    toast.error('No se pudo guardar la semana', {
      description: detalleError(primerRechazo?.reason),
    })
  }
  return false
}

/** `readDetail` sabe leer las tres formas de `detail` que manda la API. */
function detalleError(e: unknown): string {
  const err = e as { data?: unknown; message?: string } | undefined
  return readDetail(err?.data) ?? readDetail(err) ?? err?.message ?? 'No se pudo guardar el valor'
}

// ── Navegación y cierre ─────────────────────────────────────────────────
async function navegar(delta: number) {
  if (guardando.value) return
  // Moverse da la semana por buena: se guarda sin preguntar (§6.7).
  if (hayCambios.value) {
    const bien = await guardarSemana({ cerrarAlTerminar: false })
    if (!bien) return // con errores no se navega: se perderían los cambios
  }
  emit('navegar', delta)
}

function cerrar() {
  emit('update:visible', false)
}

/** ✕, máscara y Escape pasan por acá; solo se cierra si no hay pendientes. */
function intentarCerrar(v: boolean) {
  if (v) {
    emit('update:visible', true)
    return
  }
  if (!hayCambios.value) {
    cerrar()
    return
  }
  confirm({
    title: 'Cambios sin guardar',
    description: `Tienes cambios en la semana ${props.semana?.numero ?? ''} que no se han guardado.`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Seguir editando',
    variant: 'destructive',
    onConfirm: () => {
      sincronizar()
      cerrar()
    },
  })
}

// ── Teclado (§6.8) ──────────────────────────────────────────────────────
function atajos(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (hayCambios.value && !guardando.value) guardarSemana()
    return
  }
  if (e.altKey && e.key === 'ArrowLeft' && haySemanaAnterior.value) {
    e.preventDefault()
    navegar(-1)
    return
  }
  if (e.altKey && e.key === 'ArrowRight' && haySemanaSiguiente.value) {
    e.preventDefault()
    navegar(1)
  }
}

function inputs() {
  return Array.from(cuerpoEl.value?.querySelectorAll<HTMLInputElement>('.rq-dw-input input') || [])
}

function enfocarInput(i: number) {
  const lista = inputs()
  const el = lista[Math.min(i, lista.length - 1)]
  if (el) {
    el.focus()
    el.select?.()
  }
}

/** Al abrir, el foco va al primer campo vacío; si están todos llenos, al primero. */
function enfocarPrimeroVacio() {
  const idx = metricasActivas.value.findIndex(
    (m) => campos[m.id]?.valor === null || campos[m.id]?.valor === undefined,
  )
  enfocarInput(idx >= 0 ? idx : 0)
}

// ── Formato ─────────────────────────────────────────────────────────────
function fmtEdicion(d: Date) {
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const hoy = new Date()
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (mismoDia(d, hoy)) return `hoy ${hora}`
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (mismoDia(d, ayer)) return `ayer ${hora}`
  return `${d.getDate()} ${MESES[d.getMonth()]} ${hora}`
}

// ── Ciclo de vida ───────────────────────────────────────────────────────
// Cambiar de semana o reabrir el drawer siempre parte de lo que hay guardado.
watch(
  () => [props.visible, props.semana?.inicio],
  ([abierto]) => {
    if (!abierto) return
    sincronizar()
    nextTick(enfocarPrimeroVacio)
  },
  { immediate: true },
)

// Si el padre recarga el trimestre con el drawer abierto (p. ej. tras copiar
// métricas), se rearman los borradores que no estén sucios.
watch(
  () => metricasActivas.value.map((m) => m.id).join(','),
  () => {
    if (props.visible && !hayCambios.value) sincronizar()
  },
)
</script>

<template>
  <Sheet :open="visible" @update:open="intentarCerrar">
    <SheetContent class="sm:max-w-md" @keydown="atajos">
      <SheetHeader class="flex-row items-center gap-2 border-b">
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!haySemanaAnterior || guardando"
          aria-label="Semana anterior"
          @click="navegar(-1)"
        >
          <ChevronLeftIcon class="size-4" />
        </Button>
        <div class="min-w-0 flex-1">
          <SheetTitle>Semana {{ semana?.numero ?? '—' }}</SheetTitle>
          <SheetDescription class="flex flex-wrap items-center gap-1.5">
            <span>{{ semana?.rango_label || '' }}</span>
            <GBadge v-if="semana?.es_actual" color="action">En curso</GBadge>
            <GBadge v-else-if="semana?.es_futura" variant="outline">Futura</GBadge>
            <GTooltip v-if="semana?.parcial">
              <GTooltipTrigger as-child>
                <span><GBadge variant="outline">Parcial</GBadge></span>
              </GTooltipTrigger>
              <GTooltipContent>{{ tooltipParcial }}</GTooltipContent>
            </GTooltip>
          </SheetDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!haySemanaSiguiente || guardando"
          aria-label="Semana siguiente"
          @click="navegar(1)"
        >
          <ChevronRightIcon class="size-4" />
        </Button>
      </SheetHeader>

      <div ref="cuerpoEl" class="flex-1 overflow-y-auto px-4">
        <!-- Progreso de llenado (§6.4) -->
        <div class="border-b py-2.5">
          <p class="mb-1.5 text-xs font-semibold text-muted-foreground">
            {{
              completa
                ? 'Semana completa'
                : `${conDato} de ${metricasActivas.length} métricas con dato`
            }}
          </p>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full w-(--w) rounded-full transition-all duration-150"
              :class="completa ? 'bg-success' : 'bg-primary'"
              :style="{ '--w': `${pctLlenado}%` }"
            />
          </div>
        </div>

        <!-- Una fila por métrica activa (§6.5) -->
        <div class="flex flex-col">
          <div
            v-for="(m, i) in metricasActivas"
            :key="m.id"
            class="rq-dw-fila border-b py-3 last:border-b-0"
          >
            <!-- 1. Etiqueta -->
            <div class="flex min-w-0 items-center gap-1.5">
              <GTooltip>
                <GTooltipTrigger as-child>
                  <span class="min-w-0 flex-1 truncate text-xs font-bold">{{ m.nombre }}</span>
                </GTooltipTrigger>
                <GTooltipContent v-if="m.descripcion">{{ m.descripcion }}</GTooltipContent>
              </GTooltip>
              <span
                v-if="m.responsable"
                class="shrink-0 text-xs font-semibold text-muted-foreground"
              >
                {{ m.responsable }}
              </span>
              <span
                v-if="sucia(m)"
                class="size-1.5 shrink-0 rounded-full bg-primary"
                aria-label="Cambio sin guardar"
              />
            </div>

            <!-- 2. Input + referencia de la semana anterior -->
            <div class="mt-1.5 flex min-w-0 items-center gap-2.5">
              <NumberField
                class="rq-dw-input min-w-0 flex-1"
                :data-metrica="m.id"
                :model-value="campos[m.id]?.valor ?? null"
                :format-options="{
                  minimumFractionDigits: decimalesDe(m),
                  maximumFractionDigits: decimalesDe(m),
                }"
                @update:model-value="(v) => fijarValor(m, v)"
              >
                <NumberFieldContent>
                  <NumberFieldInput
                    class="text-right"
                    :aria-invalid="!!erroresFila[m.id]"
                    placeholder="Sin dato"
                    :aria-label="`Valor de ${m.nombre} en la semana ${semana?.numero ?? ''}`"
                    @keydown.enter.prevent="enfocarInput(i + 1)"
                  />
                </NumberFieldContent>
              </NumberField>
              <span v-if="sufijoDe(m)" class="shrink-0 text-xs text-muted-foreground">{{
                sufijoDe(m)
              }}</span>

              <span v-if="refAnterior(m) !== null" class="shrink-0 text-xs text-muted-foreground">
                S{{ semana!.numero - 1 }}: {{ fmtNumero(refAnterior(m), decimalesDe(m)) }}
              </span>
              <span v-else-if="haySemanaAnterior" class="shrink-0 text-xs text-muted-foreground">
                S{{ semana!.numero - 1 }}: —
              </span>

              <span
                v-if="delta(m)"
                class="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold"
                :class="delta(m)!.clase"
              >
                <component :is="delta(m)!.icono" v-if="delta(m)!.icono" class="size-3" />
                {{ delta(m)!.texto }}
              </span>
            </div>

            <!-- Error de esta fila tras un guardado parcial (§6.7) -->
            <p v-if="erroresFila[m.id]" class="mt-1 text-xs text-destructive">
              {{ erroresFila[m.id] }}
            </p>

            <!-- 3. Nota -->
            <button
              v-if="!notaAbierta(m)"
              type="button"
              class="mt-1 flex items-center gap-1 text-xs font-semibold text-primary"
              @click="abrirNota(m)"
            >
              <PencilIcon class="size-3" />
              <span>Agregar nota</span>
            </button>
            <div v-else class="mt-1.5">
              <Textarea
                :model-value="campos[m.id]?.nota ?? ''"
                rows="2"
                maxlength="500"
                placeholder="Qué pasó esta semana"
                :aria-label="`Nota de ${m.nombre}`"
                @update:model-value="(v) => fijarNota(m, String(v))"
              />
              <p
                v-if="(campos[m.id]?.nota || '').length >= 400"
                class="mt-0.5 text-right text-xs text-muted-foreground"
              >
                {{ (campos[m.id]?.nota || '').length }}/500
              </p>
            </div>
          </div>
        </div>
      </div>

      <SheetFooter class="flex-row items-center border-t">
        <span class="min-w-0 text-xs text-muted-foreground">{{ ultimaEdicion }}</span>
        <span class="flex-1" />
        <Button variant="secondary" size="sm" @click="intentarCerrar(false)">Cancelar</Button>
        <Button size="sm" :disabled="!hayCambios || guardando" @click="guardarSemana()">
          <CheckIcon class="size-4" />
          Guardar semana
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
