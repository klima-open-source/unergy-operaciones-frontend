<template>
  <!--
    Ritual semanal (spec §6): una pasada por todas las métricas de una semana.
    A diferencia de la matriz, aquí el guardado es EXPLÍCITO — se editan varias
    métricas y se confirman juntas con "Guardar semana". El componente es
    controlado: no llama a la API, usa la prop-función `guardarValor`.
  -->
  <Drawer
    :visible="visible"
    position="right"
    :modal="true"
    :dismissableMask="true"
    :blockScroll="true"
    class="rq-drawer"
    :pt="{ mask: { style: 'backdrop-filter: blur(1px); background: rgba(44,32,57,.28)' } }"
    @update:visible="intentarCerrar"
  >
    <!-- Header ─────────────────────────────────────────────────────────── -->
    <template #header>
      <div class="rq-dw-head">
        <Button text rounded size="small" :disabled="!haySemanaAnterior || guardando" aria-label="Semana anterior" @click="navegar(-1)">
          <template #icon><ChevronLeftIcon class="size-[1em]" /></template>
        </Button>
        <div class="rq-dw-head-centro">
          <div class="rq-dw-titulo">Semana {{ semana?.numero ?? '—' }}</div>
          <div class="rq-dw-sub">
            <span>{{ semana?.rango_label || '' }}</span>
            <span v-if="semana?.es_actual" class="rq-chip rq-chip-actual">En curso</span>
            <span v-else-if="semana?.es_futura" class="rq-chip rq-chip-neutro">Futura</span>
            <span v-if="semana?.parcial" class="rq-chip rq-chip-neutro" v-tooltip.bottom="tooltipParcial">
              Parcial
            </span>
          </div>
        </div>
        <Button text rounded size="small" :disabled="!haySemanaSiguiente || guardando" aria-label="Semana siguiente" @click="navegar(1)">
          <template #icon><ChevronRightIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </template>

    <!-- Cuerpo ─────────────────────────────────────────────────────────── -->
    <div ref="cuerpoEl" class="rq-dw-cuerpo" @keydown="atajos">
      <!-- Progreso de llenado (§6.4) -->
      <div class="rq-dw-progreso">
        <div class="rq-dw-progreso-txt">
          {{ completa ? 'Semana completa' : `${conDato} de ${metricasActivas.length} métricas con dato` }}
        </div>
        <div class="rq-dw-barra">
          <div
            class="rq-dw-barra-fill"
            :class="{ 'rq-dw-barra-ok': completa }"
            :style="{ width: `${pctLlenado}%` }"
          />
        </div>
      </div>

      <!-- Una fila por métrica activa (§6.5) -->
      <div class="rq-dw-filas">
        <div v-for="(m, i) in metricasActivas" :key="m.id" class="rq-dw-fila">
          <!-- 1. Etiqueta -->
          <div class="rq-dw-etiqueta">
            <span class="rq-dw-nombre" v-tooltip.top="m.descripcion || ''">{{ m.nombre }}</span>
            <span v-if="m.responsable" class="rq-dw-responsable">{{ m.responsable }}</span>
            <span v-if="sucia(m)" class="rq-dw-punto" aria-label="Cambio sin guardar" />
          </div>

          <!-- 2. Input + referencia de la semana anterior -->
          <div class="rq-dw-input-fila">
            <div class="rq-dw-input" :data-metrica="m.id">
              <InputNumber
                :modelValue="campos[m.id]?.valor ?? null"
                size="small"
                locale="es-CO"
                :minFractionDigits="decimalesDe(m)"
                :maxFractionDigits="decimalesDe(m)"
                :suffix="sufijoDe(m)"
                :inputStyle="{ textAlign: 'right' }"
                :invalid="!!erroresFila[m.id]"
                placeholder="Sin dato"
                :aria-label="`Valor de ${m.nombre} en la semana ${semana?.numero ?? ''}`"
                @update:modelValue="v => fijarValor(m, v)"
                @keydown.enter.prevent="enfocarInput(i + 1)"
              />
            </div>

            <span v-if="refAnterior(m) !== null" class="rq-dw-ref">
              S{{ semana.numero - 1 }}: {{ fmtNumero(refAnterior(m), decimalesDe(m)) }}
            </span>
            <span v-else-if="haySemanaAnterior" class="rq-dw-ref">S{{ semana.numero - 1 }}: —</span>

            <span v-if="delta(m)" class="rq-dw-delta" :style="{ color: delta(m).color }">
              <component :is="delta(m).icono" class="size-[1em]" v-if="delta(m).icono" />
              {{ delta(m).texto }}
            </span>
          </div>

          <!-- Error de esta fila tras un guardado parcial (§6.7) -->
          <div v-if="erroresFila[m.id]" class="rq-dw-error">{{ erroresFila[m.id] }}</div>

          <!-- 3. Nota -->
          <button
            v-if="!notaAbierta(m)"
            type="button" class="rq-dw-nota-link"
            @click="abrirNota(m)"
          >
            <PencilIcon class="size-[1em]" />
            <span>Agregar nota</span>
          </button>
          <div v-else class="rq-dw-nota">
            <Textarea
              :modelValue="campos[m.id]?.nota ?? ''"
              autoResize rows="2" :maxlength="500"
              class="w-full"
              placeholder="Qué pasó esta semana"
              :aria-label="`Nota de ${m.nombre}`"
              @update:modelValue="v => fijarNota(m, v)"
            />
            <div v-if="(campos[m.id]?.nota || '').length >= 400" class="rq-dw-contador">
              {{ (campos[m.id]?.nota || '').length }}/500
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pie ────────────────────────────────────────────────────────────── -->
    <template #footer>
      <div class="rq-dw-pie">
        <span class="rq-dw-edicion">{{ ultimaEdicion }}</span>
        <span class="rq-dw-espaciador" />
        <Button label="Cancelar" severity="secondary" text size="small" @click="intentarCerrar(false)" />
        <Button label="Guardar semana" size="small" :disabled="!hayCambios" :loading="guardando" @click="guardarSemana()">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </template>
  </Drawer>
</template>

<script setup>
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import { toast } from 'vue-sonner'
import { fmtNumero } from './retosUi'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon } from '@lucide/vue'
import { readDetail } from '~/core/errors'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Semana activa del contrato (`semanas[]` de RetoDetalle). */
  semana: { type: Object, default: null },
  semanas: { type: Array, default: () => [] },
  metricas: { type: Array, default: () => [] },
  valores: { type: Object, default: () => ({}) },
  guardarValor: { type: Function, required: true },
})

const emit = defineEmits(['update:visible', 'navegar'])

const confirm = useConfirm()

const cuerpoEl = ref(null)
const guardando = ref(false)
const campos = reactive({})        // metricaId -> { valor, nota }
const originales = reactive({})    // metricaId -> { valor, nota } ya guardados
const notasForzadas = reactive({}) // metricaId -> true si se abrió el textarea a mano
const erroresFila = reactive({})   // metricaId -> detail del backend

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ── Derivados ───────────────────────────────────────────────────────────
const metricasActivas = computed(() =>
  (props.metricas || [])
    .filter(m => m.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
)

const haySemanaAnterior = computed(() => (props.semana?.numero ?? 1) > 1)

const haySemanaSiguiente = computed(() => {
  const total = (props.semanas || []).length
  return total > 0 && (props.semana?.numero ?? total) < total
})

const semanaAnterior = computed(() => {
  if (!haySemanaAnterior.value) return null
  return (props.semanas || []).find(s => s.numero === props.semana.numero - 1) || null
})

const conDato = computed(
  () => metricasActivas.value.filter(m => campos[m.id]?.valor !== null && campos[m.id]?.valor !== undefined).length,
)

const completa = computed(() => metricasActivas.value.length > 0 && conDato.value === metricasActivas.value.length)

const pctLlenado = computed(() => {
  const total = metricasActivas.value.length
  return total ? Math.round((conDato.value / total) * 100) : 0
})

const hayCambios = computed(() => metricasActivas.value.some(sucia))

/** `Solo del 1 al 5 de julio cae dentro del trimestre` */
const tooltipParcial = computed(() => {
  const s = props.semana
  if (!s?.inicio_efectivo || !s?.fin_efectivo) return 'La semana no cae completa dentro del trimestre'
  const [, mi, di] = String(s.inicio_efectivo).split('-').map(Number)
  const [, mf, df] = String(s.fin_efectivo).split('-').map(Number)
  const izq = mi === mf ? `${di}` : `${di} de ${MESES_LARGOS[mi - 1]}`
  return `Solo del ${izq} al ${df} de ${MESES_LARGOS[mf - 1]} cae dentro del trimestre`
})

/** Del `updated_at` más reciente entre los valores ya guardados de la semana. */
const ultimaEdicion = computed(() => {
  if (!props.semana) return ''
  let mejor = null
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
function decimalesDe(m) {
  return Math.min(Math.max(Number(m.decimales) || 0, 0), 4)
}

/** `%` va pegado; el resto separado. Sin unidad no se pone sufijo. */
function sufijoDe(m) {
  const u = (m.unidad || '').trim()
  if (!u) return undefined
  return u === '%' ? '%' : ` ${u}`
}

function registroDe(m) {
  if (!props.semana) return null
  return props.valores?.[m.id]?.[props.semana.inicio] || null
}

function numeroONulo(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Rehace borradores y originales desde las props. Se pierde lo no guardado. */
function sincronizar() {
  for (const k of Object.keys(campos)) delete campos[k]
  for (const k of Object.keys(originales)) delete originales[k]
  for (const k of Object.keys(notasForzadas)) delete notasForzadas[k]
  for (const k of Object.keys(erroresFila)) delete erroresFila[k]
  for (const m of metricasActivas.value) {
    const reg = registroDe(m)
    const base = { valor: numeroONulo(reg?.valor), nota: reg?.nota ? String(reg.nota) : '' }
    campos[m.id] = { ...base }
    originales[m.id] = { ...base }
  }
}

function sucia(m) {
  const a = campos[m.id]
  const b = originales[m.id]
  if (!a || !b) return false
  return a.valor !== b.valor || (a.nota || '').trim() !== (b.nota || '').trim()
}

function fijarValor(m, v) {
  if (!campos[m.id]) campos[m.id] = { valor: null, nota: '' }
  campos[m.id].valor = numeroONulo(v)
  delete erroresFila[m.id]
}

function fijarNota(m, v) {
  if (!campos[m.id]) campos[m.id] = { valor: null, nota: '' }
  campos[m.id].nota = v ?? ''
  delete erroresFila[m.id]
}

function notaAbierta(m) {
  return !!notasForzadas[m.id] || !!(campos[m.id]?.nota || '').length
}

function abrirNota(m) {
  notasForzadas[m.id] = true
  nextTick(() => {
    const fila = cuerpoEl.value?.querySelector(`.rq-dw-input[data-metrica="${m.id}"]`)?.closest('.rq-dw-fila')
    fila?.querySelector('textarea')?.focus()
  })
}

// ── Referencia y delta contra la semana anterior (§6.5) ─────────────────
function refAnterior(m) {
  const prev = semanaAnterior.value
  if (!prev) return null
  return numeroONulo(props.valores?.[m.id]?.[prev.inicio]?.valor)
}

function delta(m) {
  const prev = refAnterior(m)
  const actual = campos[m.id]?.valor
  if (prev === null || actual === null || actual === undefined) return null

  const d = actual - prev
  const dec = decimalesDe(m)
  if (Math.abs(d) < 10 ** -(dec + 3)) {
    return { texto: `= ${fmtNumero(0, dec)}`, icono: null, color: '#9b8fb0' }
  }
  const sube = d > 0
  const bueno = m.direccion === 'menor_mejor' ? !sube : sube
  return {
    texto: `${sube ? '+' : '−'}${fmtNumero(Math.abs(d), dec)}`,
    icono: sube ? ArrowUpIcon : ArrowDownIcon,
    color: bueno ? '#047857' : '#B0364A',
  }
}

// ── Guardado (§6.7) ─────────────────────────────────────────────────────
async function guardarSemana({ cerrarAlTerminar = true } = {}) {
  const sucias = metricasActivas.value.filter(sucia)
  if (!sucias.length) {
    if (cerrarAlTerminar) cerrar()
    return true
  }
  const numero = props.semana?.numero
  const inicio = props.semana?.inicio
  guardando.value = true
  for (const k of Object.keys(erroresFila)) delete erroresFila[k]

  const resultados = await Promise.allSettled(
    sucias.map(m => props.guardarValor({
      metricaId: m.id,
      semanaInicio: inicio,
      valor: campos[m.id].valor,
      nota: (campos[m.id].nota || '').trim() || null,
    })),
  )
  guardando.value = false

  const ok = []
  const fallos = []
  resultados.forEach((r, i) => {
    const m = sucias[i]
    if (r.status === 'fulfilled') {
      ok.push(m)
      // El padre ya actualizó `valores`; se mueve la línea base para que la
      // fila deje de verse sucia sin perder lo tecleado en las demás.
      originales[m.id] = { ...campos[m.id], nota: (campos[m.id].nota || '').trim() }
    } else {
      fallos.push(m)
      erroresFila[m.id] = detalleError(r.reason)
    }
  })

  if (!fallos.length) {
    toast.success(`Semana ${numero} registrada`, {
      description: `${ok.length} ${ok.length === 1 ? 'métrica actualizada' : 'métricas actualizadas'}`,
      duration: 2500,
    })
    if (cerrarAlTerminar) cerrar()
    return true
  }

  if (ok.length) {
    toast.warning(`Se guardaron ${ok.length} de ${sucias.length} métricas`, { duration: 5000 })
  } else {
    toast.error('No se pudo guardar la semana', {
      description: detalleError(resultados[0]?.reason),
      duration: 5000,
    })
  }
  return false
}

/** `readDetail` sabe leer las tres formas de `detail` que manda la API. */
function detalleError(e) {
  return readDetail(e?.data) ?? readDetail(e) ?? e?.message ?? 'No se pudo guardar el valor'
}

// ── Navegación y cierre ─────────────────────────────────────────────────
async function navegar(delta) {
  if (guardando.value) return
  // Moverse da la semana por buena: se guarda sin preguntar (§6.7).
  if (hayCambios.value) {
    const bien = await guardarSemana({ cerrarAlTerminar: false })
    if (!bien) return   // con errores no se navega: se perderían los cambios
  }
  emit('navegar', delta)
}

function cerrar() {
  emit('update:visible', false)
}

/** ✕, máscara y Escape pasan por aquí; solo se cierra si no hay pendientes. */
function intentarCerrar(v) {
  if (v) { emit('update:visible', true); return }
  if (!hayCambios.value) { cerrar(); return }
  confirm({
    title: 'Cambios sin guardar',
    description: `Tienes cambios en la semana ${props.semana?.numero ?? ''} que no se han guardado.`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Seguir editando',
    variant: 'destructive',
    onConfirm: () => { sincronizar(); cerrar() },
  })
}

// ── Teclado (§6.8) ──────────────────────────────────────────────────────
function atajos(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (hayCambios.value && !guardando.value) guardarSemana()
    return
  }
  if (e.altKey && e.key === 'ArrowLeft' && haySemanaAnterior.value) {
    e.preventDefault(); navegar(-1); return
  }
  if (e.altKey && e.key === 'ArrowRight' && haySemanaSiguiente.value) {
    e.preventDefault(); navegar(1)
  }
}

function inputs() {
  return Array.from(cuerpoEl.value?.querySelectorAll('.rq-dw-input input') || [])
}

function enfocarInput(i) {
  const lista = inputs()
  const el = lista[Math.min(i, lista.length - 1)]
  if (el) { el.focus(); el.select?.() }
}

/** Al abrir, el foco va al primer campo vacío; si están todos llenos, al primero. */
function enfocarPrimeroVacio() {
  const idx = metricasActivas.value.findIndex(m => campos[m.id]?.valor === null || campos[m.id]?.valor === undefined)
  enfocarInput(idx >= 0 ? idx : 0)
}

// ── Formato ─────────────────────────────────────────────────────────────
function fmtEdicion(d) {
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const hoy = new Date()
  const mismoDia = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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
  () => metricasActivas.value.map(m => m.id).join(','),
  () => { if (props.visible && !hayCambios.value) sincronizar() },
)
</script>

<style scoped>
.rq-dw-head { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.rq-dw-head-centro { flex: 1; min-width: 0; }
.rq-dw-titulo { font-size: 16px; font-weight: 800; color: var(--color-unergy-deep); line-height: 1.2; }
.rq-dw-sub {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 12px; font-weight: 400; color: #9b8fb0; margin-top: 1px;
}

.rq-chip {
  font-size: 10px; font-weight: 700; line-height: 1.5;
  padding: 1px 7px; border-radius: 999px; white-space: nowrap;
}
.rq-chip-actual { color: #6D28D9; background: rgba(145, 91, 216, .12); }
.rq-chip-neutro { color: #6b5a8a; background: rgba(44, 32, 57, .06); }

/* Progreso de llenado */
.rq-dw-progreso { padding: 10px 16px; border-bottom: 1px solid #ECE7F2; margin: 0 -1.25rem; }
.rq-dw-progreso-txt { font-size: 11px; font-weight: 600; color: #6b5a8a; margin-bottom: 5px; }
.rq-dw-barra { height: 5px; border-radius: 3px; background: #F1ECF7; overflow: hidden; }
.rq-dw-barra-fill {
  height: 100%; border-radius: 3px; background: var(--color-unergy-purple);
  transition: width .18s ease, background-color .18s ease;
}
.rq-dw-barra-ok { background: #10B981; }

/* Filas */
.rq-dw-filas { padding: 0 16px; margin: 0 -1.25rem; }
.rq-dw-fila { padding-block: 12px; border-bottom: 1px solid #F4F0F9; }
.rq-dw-fila:last-child { border-bottom: 0; }

.rq-dw-etiqueta { display: flex; align-items: center; gap: 6px; min-width: 0; }
.rq-dw-nombre {
  flex: 1; min-width: 0;
  font-size: 12.5px; font-weight: 700; color: var(--color-unergy-deep);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rq-dw-responsable { flex: none; font-size: 10px; font-weight: 600; color: #9b8fb0; }
.rq-dw-punto { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--color-unergy-purple); }

.rq-dw-input-fila { display: flex; align-items: center; gap: 10px; margin-top: 6px; min-width: 0; }
.rq-dw-input { flex: none; width: 190px; }
.rq-dw-input :deep(.p-inputtext) { height: 32px; font-size: 12.5px; width: 100%; }

.rq-dw-ref { font-size: 11px; font-weight: 400; color: #9b8fb0; white-space: nowrap; }
.rq-dw-delta {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.rq-dw-delta svg { font-size: 8px; }

.rq-dw-error { font-size: 10px; color: #B0364A; margin-top: 4px; }

/* Nota */
.rq-dw-nota-link {
  display: inline-flex; align-items: center; gap: 4px; height: 24px; margin-top: 4px;
  font-size: 11px; font-weight: 600; color: var(--color-unergy-purple); background: none; border: 0; padding: 0;
  cursor: pointer;
}
.rq-dw-nota-link svg { font-size: 9px; }
.rq-dw-nota { margin-top: 6px; }
.rq-dw-nota :deep(textarea) { font-size: 11.5px; }
.rq-dw-contador { font-size: 9px; color: #c7bdd8; text-align: right; margin-top: 2px; }

/* Pie */
.rq-dw-pie { display: flex; align-items: center; gap: 8px; width: 100%; }
.rq-dw-edicion { font-size: 10px; font-weight: 400; color: #9b8fb0; min-width: 0; }
.rq-dw-espaciador { flex: 1; }

@media (prefers-reduced-motion: reduce) {
  .rq-dw-barra-fill { transition: none; }
}
</style>

<style>
/* El Drawer se teletransporta fuera del componente: estas no pueden ser scoped. */
.rq-drawer { width: 420px; }
.rq-drawer .p-drawer-header { border-bottom: 1px solid #ECE7F2; padding: 12px 16px; }
.rq-drawer .p-drawer-content { padding: 0 1.25rem; }
.rq-drawer .p-drawer-footer { border-top: 1px solid #ECE7F2; padding: 10px 16px; }

@media (max-width: 640px) {
  .rq-drawer { width: 100%; }
}
</style>
