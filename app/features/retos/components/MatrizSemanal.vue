<template>
  <div class="rq-panel">
    <!-- ── Barra de herramientas (§5.2) ─────────────────────────────────── -->
    <div class="rq-toolbar">
      <span class="rq-tb-title">Matriz semanal</span>

      <span class="rq-guardado" :style="{ color: guardado.color }">
        <template v-if="guardado.texto">
          <component :is="guardado.icono" v-if="guardado.icono" class="size-[1em]"
            :class="{ 'animate-spin': guardado.girando }" />
          <button v-if="guardado.esError" type="button" class="rq-guardado-link" @click="irAPrimerError">
            {{ guardado.texto }}
          </button>
          <span v-else>{{ guardado.texto }}</span>
        </template>
      </span>

      <div class="rq-tb-spacer" />

      <label class="rq-tb-toggle" for="rq-toggle-futuras">
        <ToggleSwitch v-model="ocultarFuturas" inputId="rq-toggle-futuras" />
        <span>Ocultar semanas futuras</span>
      </label>

      <Button text rounded size="small" aria-label="Ayuda de teclado" v-tooltip.left="{ value: AYUDA_TECLADO, escape: false }">
        <template #icon><CircleQuestionMarkIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- ── Banner "sin datos todavía" (§5.9) ────────────────────────────── -->
    <div v-if="metricas.length && !hayAlgunValor" class="rq-banner">
      <span>Todavía no hay valores registrados. Abre una semana para empezar el llenado.</span>
      <Button
        v-if="semanaSugerida"
        :label="`Registrar semana ${semanaSugerida.numero}`"
        size="small"
        text
        @click="emit('abrir-semana', semanaSugerida)"
      />
    </div>

    <!-- ── <768px: la matriz se reemplaza por la lista de semanas (§10) ─── -->
    <div v-if="angosto" class="rq-angosto">
      <p class="rq-angosto-aviso">La matriz semanal necesita una pantalla más ancha.</p>
      <button
        v-for="s in semanasVisibles"
        :key="`m${s.numero}`"
        type="button"
        class="rq-angosto-fila"
        :class="{ 'rq-angosto-actual': s.es_actual }"
        @click="emit('abrir-semana', s)"
      >
        <span class="rq-angosto-s">{{ s.etiqueta || `S${s.numero}` }}</span>
        <span class="rq-angosto-rango">{{ s.rango_label }}</span>
        <span class="rq-angosto-llenado" :style="{ color: colorLlenado(s) }">{{ textoLlenado(s) }}</span>
        <ChevronRightIcon class="size-[1em]" />
      </button>
    </div>

    <!-- ── Matriz ───────────────────────────────────────────────────────── -->
    <div
      v-else
      ref="wrapEl"
      class="rq-matriz-wrap"
      @focusin="activa = true"
      @focusout="onFocusOut"
    >
      <table class="rq-matriz" @mouseleave="hoverCol = null; hoverFila = null">
        <caption class="sr-only">Valores semanales por métrica del trimestre</caption>

        <colgroup>
          <col class="rq-c-metrica" />
          <col v-for="s in semanasVisibles" :key="`c${s.numero}`" class="rq-c-semana" />
          <col class="rq-c-consol" />
          <col class="rq-c-meta" />
          <col class="rq-c-pct" />
        </colgroup>

        <thead>
          <!-- banda de mes -->
          <tr class="rq-meses">
            <th class="rq-sticky-l rq-esquina" rowspan="2" scope="col">MÉTRICA</th>
            <th
              v-for="(g, i) in gruposMes"
              :key="`g${i}`"
              :colspan="g.n"
              scope="colgroup"
              :class="{ 'rq-mes-inicio': i > 0 }"
            >{{ g.label }}</th>
            <th class="rq-sticky-r-3" rowspan="2" scope="col">CONSOLIDADO</th>
            <th class="rq-sticky-r-2" rowspan="2" scope="col">META</th>
            <th class="rq-sticky-r-1" rowspan="2" scope="col">%</th>
          </tr>

          <!-- semanas -->
          <tr class="rq-semanas">
            <th
              v-for="(s, c) in semanasVisibles"
              :key="`h${s.numero}`"
              scope="col"
              class="rq-th-semana"
              :class="[
                columnaClases(s, c),
                { 'rq-parcial': s.parcial, 'rq-mes-inicio': esInicioMes(c) },
              ]"
              :ref="el => setCelda(-1, c, el)"
              :tabindex="foco.fila === -1 && foco.col === c ? 0 : -1"
              :aria-label="`Abrir semana ${s.numero}, ${s.rango_label}`"
              v-tooltip.top="tooltipSemana(s)"
              @click="emit('abrir-semana', s)"
              @keydown="onKeyHeader($event, c)"
              @focus="onFocoCelda(-1, c)"
              @mouseenter="hoverCol = c"
            >
              <span class="rq-th-num">{{ s.etiqueta || `S${s.numero}` }}</span>
              <small class="rq-th-rango">{{ s.rango_label }}</small>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(m, r) in metricasVisibles"
            :key="m.id"
            :class="{ 'rq-fila-inactiva': m.activa === false, 'rq-fila-hover': hoverFila === r }"
            @mouseenter="hoverFila = r"
          >
            <!-- columna de métrica (sticky izquierda) -->
            <th scope="row" class="rq-sticky-l rq-td-metrica">
              <div class="rq-metrica-box">
                <div class="rq-metrica-txt">
                  <span class="rq-metrica-nombre" :title="m.nombre">
                    {{ m.nombre }}
                    <span v-if="m.activa === false" class="rq-chip-inactiva">Inactiva</span>
                  </span>
                  <span class="rq-metrica-meta" :title="metaLinea(m)">{{ metaLinea(m) }}</span>
                </div>
                <Button text rounded size="small" tabindex="-1" class="rq-fila-menu" :aria-label="`Acciones de ${m.nombre}`" @click="abrirMenu($event, m)">
                  <template #icon><EllipsisIcon class="size-[1em]" /></template>
                </Button>
              </div>
            </th>

            <!-- celdas de valor -->
            <td
              v-for="(s, c) in semanasVisibles"
              :key="`${m.id}-${s.inicio}`"
              class="rq-cell"
              :class="[
                columnaClases(s, c),
                estadoCelda(m, s),
                {
                  'rq-cell-hover': hoverCol === c && hoverFila === r,
                  'rq-cell-foco': activa && foco.fila === r && foco.col === c,
                  'rq-cell-editando': !!editando && editando.r === r && editando.c === c,
                  'rq-mes-inicio': esInicioMes(c),
                },
              ]"
              @mouseenter="hoverCol = c; hoverFila = r"
            >
              <div
                class="rq-cell-inner"
                :ref="el => setCelda(r, c, el)"
                :tabindex="foco.fila === r && foco.col === c ? 0 : -1"
                :aria-label="ariaCelda(m, s)"
                @focus="onFocoCelda(r, c)"
                @click="onClickCelda(r, c)"
                @keydown="onKey($event, r, c)"
              >
                <input
                  v-if="editando && editando.r === r && editando.c === c"
                  ref="inputEl"
                  type="text"
                  inputmode="decimal"
                  class="rq-cell-input"
                  :value="texto"
                  :aria-label="ariaCelda(m, s)"
                  @input="texto = $event.target.value"
                  @blur="onBlurInput"
                />
                <template v-else>
                  <TriangleAlertIcon class="rq-inusual size-[1em]" v-if="esInusual(m, s)" v-tooltip.top="'Valor inusual para esta métrica. Se guardó de todas formas.'" />
                  <span v-if="valorDe(m, s) === null" class="rq-vacio">·</span>
                  <span v-else class="rq-num">{{ fmtNumero(valorDe(m, s), m.decimales) }}</span>
                </template>

                <span v-if="notaDe(m, s)" class="rq-nota" v-tooltip.top="tooltipNota(m, s)" />
                <CircleAlertIcon class="rq-err-icon size-[1em]" v-if="errores[clave(m, s)]" v-tooltip.top="errores[clave(m, s)]" @click.stop="reintentar(m, s)" />
                <span v-if="estados[clave(m, s)] === 'guardando'" class="rq-progress" />
              </div>
            </td>

            <!-- columnas finales (sticky derecha, §5.6) -->
            <td class="rq-res rq-consol rq-sticky-r-3" :class="{ 'rq-pulso': pulsos[m.id] }">
              {{ fmtNumero(m.consolidado, m.decimales) ?? '—' }}
            </td>
            <td class="rq-res rq-meta rq-sticky-r-2">
              {{ fmtNumero(m.meta, m.decimales) ?? '—' }}
            </td>
            <td class="rq-res rq-pct rq-sticky-r-1" v-tooltip.left="tooltipPct(m)">
              <span class="rq-pct-num" :style="{ color: estadoColor(m.estado) }">
                {{ fmtPctEntero(m.cumplimiento_pct) }}
              </span>
              <span class="rq-micro">
                <span
                  class="rq-micro-fill"
                  :style="{ width: `${anchoAvance(m)}%`, background: estadoColor(m.estado) }"
                />
                <span v-if="posEsperada(m) !== null" class="rq-micro-marca" :style="{ left: `${posEsperada(m)}%` }" />
              </span>
            </td>
          </tr>
        </tbody>

        <!-- ── Llenado (§5.7) ─────────────────────────────────────────────── -->
        <tfoot>
          <tr class="rq-llenado">
            <th scope="row" class="rq-sticky-l rq-llenado-lbl">Llenado</th>
            <td
              v-for="(s, c) in semanasVisibles"
              :key="`f${s.numero}`"
              class="rq-llenado-td"
              :class="{ 'rq-mes-inicio': esInicioMes(c) }"
              @click="emit('abrir-semana', s)"
            >
              <span class="rq-llenado-txt" :style="{ color: colorLlenado(s) }">{{ textoLlenado(s) }}</span>
              <span v-if="!(s.es_futura && conDato(s) === 0)" class="rq-llenado-bar">
                <span
                  class="rq-llenado-bar-fill"
                  :style="{ width: `${pctLlenado(s)}%`, background: colorLlenado(s) }"
                />
              </span>
            </td>
            <td class="rq-sticky-r-3" />
            <td class="rq-sticky-r-2" />
            <td class="rq-sticky-r-1" />
          </tr>
        </tfoot>
      </table>
    </div>

    <Menu ref="menuEl" :model="itemsMenu" :popup="true">
      <template #itemicon="{ item }"><component :is="item.icon" class="size-[1em]" /></template>
    </Menu>

    <!-- El flash verde no puede ser la única confirmación (§9) -->
    <div aria-live="polite" class="sr-only">{{ anuncio }}</div>
  </div>
</template>

<script setup>
/**
 * Matriz semanal de Retos Q — el punto de llenado del módulo.
 *
 * Es una `<table>` a mano (decisión 1 del spec): necesita la columna de métrica
 * pegada a la izquierda, las tres de resultado pegadas a la derecha, estado por
 * *columna* (actual / futura / parcial) y foco itinerante row-major. Las celdas
 * son `<input type="text">` planos (decisión 2) porque `InputNumber` secuestra
 * ↑↓ y Enter, que es justo lo que se usa para navegar.
 *
 * El componente es controlado: nunca habla con la API. Guarda a través de la
 * prop-función `guardarValor`; cuando esa promesa resuelve, el padre ya dejó
 * `metricas` y `valores` actualizados por reactividad.
 */
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import ToggleSwitch from 'primevue/toggleswitch'
import { fmtNumero, fmtValor, fmtPct, fmtPctEntero, parseValor, estadoColor } from './retosUi'
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, CircleQuestionMarkIcon, EllipsisIcon, LoaderCircleIcon, PencilIcon, Trash2Icon, TriangleAlertIcon } from '@lucide/vue'
import { readDetail } from '~/core/errors'

const props = defineProps({
  metricas: { type: Array, required: true },
  semanas: { type: Array, required: true },
  valores: { type: Object, required: true },
  guardarValor: { type: Function, required: true },
})

const emit = defineEmits(['abrir-semana', 'editar-metrica', 'eliminar-metrica'])

const AYUDA_TECLADO =
  'Enter para editar y bajar &middot; Tab para avanzar &middot; Esc para descartar &middot; Ctrl+Enter abre la semana'
const ERR_PARSEO = 'No se reconoce el número. Usa coma para los decimales.'

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ── Semanas futuras ─────────────────────────────────────────────────────────
const LS_KEY = 'retos:ocultarFuturas'
const ocultarFuturas = ref(leerToggle())

function leerToggle() {
  try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
}
watch(ocultarFuturas, v => {
  try { localStorage.setItem(LS_KEY, v ? '1' : '0') } catch { /* modo privado */ }
})

const semanasVisibles = computed(() =>
  ocultarFuturas.value ? props.semanas.filter(s => !s.es_futura) : props.semanas
)
const metricasVisibles = computed(() => props.metricas)
const metricasActivas = computed(() => props.metricas.filter(m => m.activa !== false))

const semanaSugerida = computed(() => props.semanas.find(s => s.es_actual) || props.semanas[0] || null)

// ── Banda de meses ──────────────────────────────────────────────────────────
function mesDe(s) {
  const [a, m] = String(s.inicio_efectivo || s.inicio || '').split('-').map(Number)
  return { a, m }
}

const gruposMes = computed(() => {
  const out = []
  for (const s of semanasVisibles.value) {
    const { a, m } = mesDe(s)
    const label = m ? MESES_LARGOS[m - 1].toUpperCase() : ''
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.a === a && ultimo.m === m) ultimo.n += 1
    else out.push({ a, m, label, n: 1 })
  }
  return out
})

/** Índices de columna donde arranca un mes: llevan el separador vertical. */
const iniciosMes = computed(() => {
  const set = new Set()
  let i = 0
  for (const g of gruposMes.value) {
    if (i > 0) set.add(i)
    i += g.n
  }
  return set
})
function esInicioMes(c) { return iniciosMes.value.has(c) }

// ── Acceso a los valores ────────────────────────────────────────────────────
/** Valores que el backend rechazó: se conservan para no perder el tecleo. */
const locales = reactive({})
const estados = reactive({})   // clave -> 'guardando' | 'ok' | 'error'
const errores = reactive({})   // clave -> mensaje

function clave(m, s) { return `${m.id}|${s.inicio}` }

function registroDe(m, s) {
  const fila = props.valores?.[m.id]
  return fila ? fila[s.inicio] || null : null
}

function valorDe(m, s) {
  const k = clave(m, s)
  if (k in locales) return locales[k]
  const reg = registroDe(m, s)
  if (!reg || reg.valor === null || reg.valor === undefined) return null
  const n = Number(reg.valor)
  return Number.isFinite(n) ? n : null
}

function notaDe(m, s) {
  const n = registroDe(m, s)?.nota
  return n && String(n).trim() ? String(n).trim() : null
}

function tooltipNota(m, s) {
  const reg = registroDe(m, s)
  if (!reg) return ''
  const quien = reg.actualizado_por ? ` — ${reg.actualizado_por}` : ''
  const cuando = reg.updated_at ? `, ${fechaCortaDe(reg.updated_at)}` : ''
  return `${notaDe(m, s) || ''}${quien}${cuando}`
}

function fechaCortaDe(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

const hayAlgunValor = computed(() =>
  props.metricas.some(m => props.semanas.some(s => valorDe(m, s) !== null))
)

/** Advertencia (no bloqueo): negativo con "más es mejor", o 5× el ritmo esperado. */
function esInusual(m, s) {
  const v = valorDe(m, s)
  if (v === null) return false
  if (v < 0 && m.direccion === 'mayor_mejor') return true
  const meta = Number(m.meta)
  const total = props.semanas.length || 1
  if (m.meta !== null && m.meta !== undefined && Number.isFinite(meta) && meta !== 0) {
    if (Math.abs(v) > 5 * Math.abs(meta / total)) return true
  }
  return false
}

// ── Clases de columna / celda ───────────────────────────────────────────────
function columnaClases(s, c) {
  return {
    'rq-col-actual': !!s.es_actual,
    'rq-col-futura': !!s.es_futura,
    'rq-col-hover': hoverCol.value === c,
  }
}

function estadoCelda(m, s) {
  const e = estados[clave(m, s)]
  return {
    'rq-cell-guardando': e === 'guardando',
    'rq-cell-ok': e === 'ok',
    'rq-cell-error': e === 'error',
    'rq-cell-inusual': esInusual(m, s),
  }
}

function metaLinea(m) {
  return [m.unidad, m.tipo_agregacion, m.responsable].filter(Boolean).join(' · ')
}

function tooltipSemana(s) {
  if (s.parcial) {
    const [, m1, d1] = String(s.inicio_efectivo || s.inicio).split('-').map(Number)
    const [, m2, d2] = String(s.fin_efectivo || s.fin).split('-').map(Number)
    const rango = m1 === m2
      ? `del ${d1} al ${d2} de ${MESES_LARGOS[m2 - 1]}`
      : `del ${d1} de ${MESES_LARGOS[m1 - 1]} al ${d2} de ${MESES_LARGOS[m2 - 1]}`
    return `Semana parcial: ${rango}`
  }
  if (s.es_futura) return 'Semana futura'
  return `Abrir semana ${s.numero}`
}

function ariaCelda(m, s) {
  const v = valorDe(m, s)
  const cifra = v === null ? 'sin dato' : fmtValor(v, m.decimales, m.unidad)
  return `${m.nombre}, semana ${s.numero}, ${s.rango_label}, ${cifra}${s.es_futura ? ', semana futura' : ''}`
}

// ── Columnas de resultado ───────────────────────────────────────────────────
function anchoAvance(m) {
  const p = Number(m.avance_pct)
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(p, 100))
}

function posEsperada(m) {
  const meta = Number(m.meta)
  const esp = Number(m.meta_esperada)
  if (!Number.isFinite(meta) || meta === 0 || !Number.isFinite(esp)) return null
  return Math.max(0, Math.min((esp / meta) * 100, 100))
}

function tooltipPct(m) {
  const partes = [`Consolidado ${fmtValor(m.consolidado, m.decimales, m.unidad)}`]
  if (m.meta_esperada !== null && m.meta_esperada !== undefined) {
    partes.push(`Esperado a hoy ${fmtValor(m.meta_esperada, m.decimales, m.unidad)}`)
  }
  partes.push(`Ritmo ${fmtPct(m.cumplimiento_pct)}`)
  return partes.join(' · ')
}

// ── Llenado ─────────────────────────────────────────────────────────────────
function conDato(s) {
  return metricasActivas.value.filter(m => valorDe(m, s) !== null).length
}
function textoLlenado(s) {
  if (s.es_futura && conDato(s) === 0) return '—'
  return `${conDato(s)}/${metricasActivas.value.length}`
}
function pctLlenado(s) {
  const total = metricasActivas.value.length || 1
  return (conDato(s) / total) * 100
}
function colorLlenado(s) {
  const total = metricasActivas.value.length
  const n = conDato(s)
  if (s.es_futura && n === 0) return '#c7bdd8'
  if (total && n >= total) return '#10B981'
  if (n > 0) return '#CA8A04'
  return '#9b8fb0'
}

// ── Hover cruzado (imprescindible con 14 columnas) ──────────────────────────
const hoverCol = ref(null)
const hoverFila = ref(null)

// ── Foco itinerante ─────────────────────────────────────────────────────────
// Fila -1 = encabezados de semana; 0..N-1 = métricas. Una sola celda con
// tabindex=0: la matriz entera es un único salto de Tab desde fuera.
const foco = reactive({ fila: -1, col: 0 })
const celdas = {}
const wrapEl = ref(null)
const inputEl = ref(null)
const activa = ref(false)

function setCelda(r, c, el) {
  if (el) celdas[`${r}:${c}`] = el
  else delete celdas[`${r}:${c}`]
}

function onFocusOut(e) {
  if (!wrapEl.value?.contains(e.relatedTarget)) activa.value = false
}

const nFilas = computed(() => metricasVisibles.value.length)
const nCols = computed(() => semanasVisibles.value.length)

watch([nFilas, nCols], () => {
  if (foco.fila > nFilas.value - 1) foco.fila = nFilas.value - 1
  if (foco.fila < -1) foco.fila = -1
  if (foco.col > nCols.value - 1) foco.col = Math.max(0, nCols.value - 1)
})

function onFocoCelda(r, c) {
  activa.value = true
  foco.fila = r
  foco.col = c
  hoverFila.value = r >= 0 ? r : null
  hoverCol.value = c
}

async function irA(r, c, { editar = false } = {}) {
  if (editando.value && !confirmar()) return
  const nf = Math.max(-1, Math.min(r, nFilas.value - 1))
  const nc = Math.max(0, Math.min(c, nCols.value - 1))
  foco.fila = nf
  foco.col = nc
  await nextTick()
  const el = celdas[`${nf}:${nc}`]
  if (el) {
    el.focus({ preventScroll: true })
    asegurarVisible(el)
  }
  if (editar && nf >= 0) entrarEdicion(nf, nc)
}

/**
 * `scrollIntoView({block:'nearest'})` no sirve: las columnas sticky tapan
 * ~240px a la izquierda y 238px a la derecha, y el thead 52px arriba.
 */
function asegurarVisible(el) {
  const wrap = wrapEl.value
  if (!wrap || !el) return
  const rw = wrap.getBoundingClientRect()
  const re = el.getBoundingClientRect()

  const izq = wrap.querySelector('.rq-sticky-l')?.offsetWidth || 240
  const der = 238
  if (re.left < rw.left + izq) wrap.scrollLeft -= (rw.left + izq) - re.left
  else if (re.right > rw.right - der) wrap.scrollLeft += re.right - (rw.right - der)

  const arriba = 52   // banda de mes + fila de semanas
  const abajo = 30    // fila de llenado
  if (re.top < rw.top + arriba) wrap.scrollTop -= (rw.top + arriba) - re.top
  else if (re.bottom > rw.bottom - abajo) wrap.scrollTop += re.bottom - (rw.bottom - abajo)
}

// ── Edición ─────────────────────────────────────────────────────────────────
const editando = ref(null)   // { r, c }
const texto = ref('')

function editableEn(r) {
  const m = metricasVisibles.value[r]
  return !!m && m.activa !== false
}

async function entrarEdicion(r, c, semilla = null) {
  if (!editableEn(r)) return
  const m = metricasVisibles.value[r]
  const s = semanasVisibles.value[c]
  if (!m || !s) return
  texto.value = semilla !== null ? semilla : (fmtNumero(valorDe(m, s), m.decimales) ?? '')
  editando.value = { r, c }
  await nextTick()
  const inp = primerInput()
  if (!inp) return
  inp.focus({ preventScroll: true })
  if (semilla === null) inp.select()
  else inp.setSelectionRange(semilla.length, semilla.length)
}

function primerInput() {
  const v = inputEl.value
  if (Array.isArray(v)) return v.find(Boolean) || null
  return v || null
}

function salirEdicion() {
  editando.value = null
  texto.value = ''
}

/** Devuelve false si el texto no parsea: la celda queda en error y el foco dentro. */
function confirmar() {
  if (!editando.value) return true
  const { r, c } = editando.value
  const m = metricasVisibles.value[r]
  const s = semanasVisibles.value[c]
  if (!m || !s) { salirEdicion(); return true }

  const k = clave(m, s)
  const nuevo = parseValor(texto.value)

  if (Number.isNaN(nuevo)) {
    estados[k] = 'error'
    errores[k] = ERR_PARSEO
    return false
  }

  // Solo se dispara el PUT si el valor cambió (o si quedó pendiente un error).
  const cambio = nuevo !== valorDe(m, s) || estados[k] === 'error'
  salirEdicion()
  if (cambio) guardar(m, s, nuevo)
  return true
}

function descartar() {
  if (!editando.value) return
  const { r, c } = editando.value
  const m = metricasVisibles.value[r]
  const s = semanasVisibles.value[c]
  if (m && s) {
    const k = clave(m, s)
    if (errores[k] === ERR_PARSEO) { delete errores[k]; delete estados[k] }
  }
  salirEdicion()
  nextTick(() => celdas[`${foco.fila}:${foco.col}`]?.focus({ preventScroll: true }))
}

/** Autosave al perder el foco (§5.5): si el valor cambió, se dispara el PUT igual. */
function onBlurInput() {
  if (editando.value) confirmar()
}

function onClickCelda(r, c) {
  if (editando.value && editando.value.r === r && editando.value.c === c) return
  foco.fila = r
  foco.col = c
  entrarEdicion(r, c)
}

// ── Guardado ────────────────────────────────────────────────────────────────
const enVuelo = ref(0)
const ultimoOk = ref(null)
const anuncio = ref('')
const pulsos = reactive({})

async function guardar(m, s, valor, nota = undefined) {
  const k = clave(m, s)
  locales[k] = valor           // se muestra lo tecleado mientras viaja
  estados[k] = 'guardando'
  delete errores[k]
  enVuelo.value += 1
  try {
    await props.guardarValor({
      metricaId: m.id,
      semanaInicio: s.inicio,
      valor,
      nota: nota !== undefined ? nota : (notaDe(m, s) ?? null),
    })
    delete locales[k]
    estados[k] = 'ok'
    ultimoOk.value = new Date()
    anuncio.value = `Guardado ${horaCorta(ultimoOk.value)}`
    pulsos[m.id] = true
    setTimeout(() => { delete pulsos[m.id] }, 500)
    setTimeout(() => { if (estados[k] === 'ok') delete estados[k] }, 700)
  } catch (e) {
    // El valor tecleado NO se revierte: queda en `locales` para reintentar.
    estados[k] = 'error'
    errores[k] = detalleError(e)
    anuncio.value = 'No se pudo guardar'
  } finally {
    enVuelo.value -= 1
  }
}

function reintentar(m, s) {
  const k = clave(m, s)
  guardar(m, s, k in locales ? locales[k] : valorDe(m, s))
}

/** `readDetail` sabe leer las tres formas de `detail` que manda la API. */
function detalleError(e) {
  return readDetail(e?.data) ?? readDetail(e) ?? e?.message ?? 'No se pudo guardar el valor'
}

function horaCorta(d) {
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const nErrores = computed(() => Object.keys(errores).length)

const guardado = computed(() => {
  if (enVuelo.value > 0) {
    return { icono: LoaderCircleIcon, girando: true, texto: 'Guardando…', color: '#915BD8', esError: false }
  }
  if (nErrores.value > 0) {
    const t = nErrores.value === 1 ? '1 cambio sin guardar' : `${nErrores.value} cambios sin guardar`
    return { icono: CircleAlertIcon, texto: t, color: '#B0364A', esError: true }
  }
  if (ultimoOk.value) {
    return { icono: CheckIcon, texto: `Guardado ${horaCorta(ultimoOk.value)}`, color: '#6b5a8a', esError: false }
  }
  return { icono: '', texto: '', color: '#6b5a8a', esError: false }
})

function irAPrimerError() {
  const k = Object.keys(errores)[0]
  if (!k) return
  const corte = k.lastIndexOf('|')
  const idTxt = k.slice(0, corte)
  const inicio = k.slice(corte + 1)
  const r = metricasVisibles.value.findIndex(m => String(m.id) === idTxt)
  const c = semanasVisibles.value.findIndex(s => s.inicio === inicio)
  if (r >= 0 && c >= 0) irA(r, c)
}

// ── Teclado (§8) ────────────────────────────────────────────────────────────
const TECLA_NUM = /^[0-9,.\-]$/

function onKeyHeader(e, c) {
  const k = e.key
  if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
    e.preventDefault()
    emit('abrir-semana', semanasVisibles.value[c])
    return
  }
  if (k === 'ArrowRight') { e.preventDefault(); moverH(1); return }
  if (k === 'ArrowLeft') { e.preventDefault(); moverH(-1); return }
  if (k === 'ArrowDown') { e.preventDefault(); irA(0, c); return }
  if (k === 'Home') { e.preventDefault(); irA(-1, 0); return }
  if (k === 'End') { e.preventDefault(); irA(-1, nCols.value - 1); return }
  if (k === 'Tab') { onTab(e); return }
  if (k === 'Escape') { e.preventDefault(); e.target.blur() }
}

function onKey(e, r, c) {
  const k = e.key
  const enEdicion = !!editando.value
  const inp = enEdicion ? e.target : null
  const meta = e.ctrlKey || e.metaKey

  // Ctrl/Cmd + Enter: abre el drawer de esa columna, confirmando antes.
  if (meta && k === 'Enter') {
    e.preventDefault()
    if (enEdicion && !confirmar()) return
    emit('abrir-semana', semanasVisibles.value[c])
    return
  }

  if (meta && k === 'Home') {
    e.preventDefault()
    if (enEdicion && !confirmar()) return
    irA(0, 0)
    return
  }

  if (meta && (k === 'c' || k === 'C') && !enEdicion) {
    const m = metricasVisibles.value[r]
    const s = semanasVisibles.value[c]
    try { navigator.clipboard?.writeText(fmtNumero(valorDe(m, s), m.decimales) ?? '') } catch { /* sin permisos */ }
    return
  }

  if (meta && (k === 'v' || k === 'V') && !enEdicion) {
    e.preventDefault()
    pegar(r, c)
    return
  }

  switch (k) {
    case 'Enter':
      e.preventDefault()
      if (!enEdicion) { entrarEdicion(r, c); return }
      if (!confirmar()) return
      irA(e.shiftKey ? r - 1 : r + 1, c)
      return

    case 'Tab':
      onTab(e)
      return

    case 'Escape':
      e.preventDefault()
      if (enEdicion) descartar()
      else e.target.blur()
      return

    case 'ArrowDown':
      e.preventDefault()
      if (enEdicion && !confirmar()) return
      irA(r + 1, c)
      return

    case 'ArrowUp':
      e.preventDefault()
      if (enEdicion && !confirmar()) return
      irA(r - 1, c)
      return

    // En edición las flechas horizontales solo navegan si el cursor ya está
    // en el extremo del texto; si no, mueven el cursor (comportamiento nativo).
    case 'ArrowRight':
      if (enEdicion && !cursorEnExtremo(inp, 'fin')) return
      e.preventDefault()
      if (enEdicion && !confirmar()) return
      moverH(1)
      return

    case 'ArrowLeft':
      if (enEdicion && !cursorEnExtremo(inp, 'inicio')) return
      e.preventDefault()
      if (enEdicion && !confirmar()) return
      moverH(-1)
      return

    case 'Home':
      if (enEdicion) return
      e.preventDefault()
      irA(r, 0)
      return

    case 'End':
      if (enEdicion) return
      e.preventDefault()
      irA(r, nCols.value - 1)
      return

    case 'Delete':
    case 'Backspace':
      if (enEdicion) return   // comportamiento normal de texto
      e.preventDefault()
      borrar(r, c)
      return
  }

  // Teclear un número entra en edición reemplazando el contenido.
  if (!enEdicion && !meta && !e.altKey && k.length === 1 && TECLA_NUM.test(k)) {
    e.preventDefault()
    entrarEdicion(r, c, k)
  }
}

function onTab(e) {
  const adelante = !e.shiftKey
  const primera = foco.fila === -1 && foco.col === 0
  const ultima = foco.fila === nFilas.value - 1 && foco.col === nCols.value - 1

  // En los extremos se deja salir de la matriz al siguiente control de la página.
  if ((adelante && ultima) || (!adelante && primera)) {
    if (editando.value) confirmar()
    return
  }

  e.preventDefault()
  if (editando.value && !confirmar()) return
  moverH(adelante ? 1 : -1, { editar: true })
}

function moverH(delta, { editar = false } = {}) {
  let r = foco.fila
  let c = foco.col + delta
  const n = nCols.value
  if (c < 0) {
    if (r > -1) { r -= 1; c = n - 1 } else c = 0
  } else if (c >= n) {
    if (r < nFilas.value - 1) { r += 1; c = 0 } else c = n - 1
  }
  irA(r, c, { editar: editar && r >= 0 })
}

function cursorEnExtremo(inp, lado) {
  if (!inp || typeof inp.selectionStart !== 'number') return true
  if (inp.selectionStart !== inp.selectionEnd) return false
  return lado === 'inicio' ? inp.selectionStart === 0 : inp.selectionStart === inp.value.length
}

function borrar(r, c) {
  const m = metricasVisibles.value[r]
  const s = semanasVisibles.value[c]
  if (!m || !s || m.activa === false) return
  if (valorDe(m, s) === null && !errores[clave(m, s)]) return
  guardar(m, s, null)
}

async function pegar(r, c) {
  const m = metricasVisibles.value[r]
  const s = semanasVisibles.value[c]
  if (!m || !s || m.activa === false) return
  let txt = ''
  try { txt = await navigator.clipboard.readText() } catch { return }
  const v = parseValor(txt)
  if (Number.isNaN(v)) {
    const k = clave(m, s)
    estados[k] = 'error'
    errores[k] = ERR_PARSEO
    return
  }
  if (v !== valorDe(m, s)) guardar(m, s, v)
}

// ── Menú de fila ────────────────────────────────────────────────────────────
const menuEl = ref(null)
const metricaMenu = ref(null)
const itemsMenu = computed(() => [
  { label: 'Editar métrica', icon: PencilIcon, command: () => emit('editar-metrica', metricaMenu.value) },
  { separator: true },
  { label: 'Eliminar métrica', icon: Trash2Icon, class: 'rq-menu-danger', command: () => emit('eliminar-metrica', metricaMenu.value) },
])
function abrirMenu(ev, m) {
  metricaMenu.value = m
  menuEl.value?.toggle(ev)
}

// ── Responsive (<768px la matriz se reemplaza, §10) ─────────────────────────
const angosto = ref(false)
let mq = null
function onMq(e) { angosto.value = e.matches }
onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  mq = window.matchMedia('(max-width: 767px)')
  angosto.value = mq.matches
  if (mq.addEventListener) mq.addEventListener('change', onMq)
  else mq.addListener(onMq)
})
onBeforeUnmount(() => {
  if (!mq) return
  if (mq.removeEventListener) mq.removeEventListener('change', onMq)
  else mq.removeListener(onMq)
})

/** Permite al padre llevar el foco a la fila de una métrica (clic en su KPI). */
function enfocarMetrica(metricaId) {
  const r = metricasVisibles.value.findIndex(m => String(m.id) === String(metricaId))
  if (r >= 0) irA(r, foco.col)
}
defineExpose({ enfocarMetrica })
</script>

<style scoped>
.rq-panel {
  background: #fff;
  border: 1px solid #e8e0f0;
  border-radius: 12px;
  overflow: hidden;
}

/* ── Barra de herramientas ─────────────────────────────────────────────── */
.rq-toolbar {
  height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #ECE7F2;
}
.rq-tb-title { font-size: 12.5px; font-weight: 700; color: var(--color-unergy-deep); }
.rq-tb-spacer { flex: 1; }

.rq-guardado {
  min-width: 110px;
  margin-left: 10px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.rq-guardado svg { font-size: 10px; }
.rq-guardado-link {
  background: none; border: 0; padding: 0; cursor: pointer;
  font: inherit; color: inherit; text-decoration: underline;
}

.rq-tb-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: #6b5a8a; cursor: pointer;
  white-space: nowrap;
}

/* ── Banner sin datos ──────────────────────────────────────────────────── */
.rq-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(145, 91, 216, .06);
  border-bottom: 1px solid #ECE7F2;
  padding: 8px 12px;
  font-size: 11.5px;
  color: #6b5a8a;
}
.rq-banner > span:first-child { flex: 1; }

/* ── Zona de scroll ────────────────────────────────────────────────────── */
.rq-matriz-wrap {
  overflow: auto;
  max-height: calc(100vh - 340px);
  min-height: 200px;
}
.rq-matriz-wrap::-webkit-scrollbar { height: 8px; width: 8px; }
.rq-matriz-wrap::-webkit-scrollbar-thumb { background: rgba(145, 91, 216, .25); border-radius: 4px; }
.rq-matriz-wrap::-webkit-scrollbar-track { background: transparent; }

/* ── Tabla ─────────────────────────────────────────────────────────────── */
.rq-matriz {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  width: max-content;
}

/*
 * Todo el color de fondo pasa por --rq-bg. Con `position: sticky` las celdas se
 * superponen, así que ninguna puede quedar transparente; y así el orden de las
 * reglas (todas de una clase) define la prioridad sin peleas de especificidad.
 */
.rq-matriz th, .rq-matriz td { background: var(--rq-bg, #fff); }

.rq-c-metrica { width: 240px; }
.rq-c-semana  { width: 66px; }
.rq-c-consol  { width: 92px; }
.rq-c-meta    { width: 78px; }
.rq-c-pct     { width: 68px; }

@media (max-width: 1279px) {
  .rq-c-metrica { width: 180px; }
}

/* banda de mes */
.rq-meses th {
  position: sticky; top: 0; z-index: 4; height: 18px;
  --rq-bg: #faf8fd;
  font-size: 9px; font-weight: 800; letter-spacing: .08em; color: #9b8fb0;
  border-bottom: 1px solid #ECE7F2;
  text-align: center;
}
/* fila de semanas */
.rq-semanas th {
  position: sticky; top: 18px; z-index: 4; height: 34px;
  --rq-bg: #faf8fd;
  border-bottom: 1px solid #ECE7F2;
  padding: 0 2px;
}

.rq-sticky-l   { position: sticky; left: 0;      z-index: 3; box-shadow: 1px 0 0 #ECE7F2; }
.rq-sticky-r-1 { position: sticky; right: 0;     z-index: 3; }
.rq-sticky-r-2 { position: sticky; right: 68px;  z-index: 3; }
.rq-sticky-r-3 { position: sticky; right: 146px; z-index: 3; box-shadow: -1px 0 0 #ECE7F2; }

thead .rq-sticky-l, thead .rq-sticky-r-1,
thead .rq-sticky-r-2, thead .rq-sticky-r-3 { z-index: 6; --rq-bg: #faf8fd; }

.rq-esquina {
  text-align: left; vertical-align: bottom;
  padding: 0 10px 5px; font-size: 10px; font-weight: 700;
  color: #9b8fb0; letter-spacing: .05em; text-transform: uppercase;
}

.rq-mes-inicio { border-left: 1px solid #ECE7F2; }

/* ── Encabezado de semana ──────────────────────────────────────────────── */
.rq-th-semana { cursor: pointer; text-align: center; line-height: 1.05; }
.rq-th-semana:hover, .rq-th-semana.rq-col-hover { --rq-bg: #f0e9fb; }
.rq-th-semana:focus-visible { outline: 2px solid var(--color-unergy-purple); outline-offset: -2px; }
.rq-th-num { display: block; font-size: 11px; font-weight: 800; color: var(--color-unergy-deep); }
.rq-th-rango { display: block; font-size: 9px; font-weight: 400; color: #9b8fb0; white-space: nowrap; }
.rq-th-semana.rq-col-futura .rq-th-num,
.rq-th-semana.rq-col-futura .rq-th-rango { color: #c7bdd8; }
.rq-th-semana.rq-col-actual { border-top: 2px solid var(--color-unergy-purple); }
.rq-th-semana.rq-col-actual .rq-th-num { color: var(--color-unergy-deep); font-weight: 800; }
.rq-th-semana.rq-parcial { border-bottom: 1px dashed #c7bdd8; }

/* ── Columna de métrica (sticky izquierda) ─────────────────────────────── */
.rq-td-metrica {
  --rq-bg: #fff;
  height: 38px; padding: 0 4px 0 10px; text-align: left;
  border-bottom: 1px solid #F4F0F9; font-weight: 400;
}
tr.rq-fila-hover .rq-td-metrica { --rq-bg: #FBF9FD; }
.rq-metrica-box { display: flex; align-items: center; gap: 4px; }
.rq-metrica-txt { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.rq-metrica-nombre {
  font-size: 12.5px; font-weight: 600; color: var(--color-unergy-deep); line-height: 15px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rq-metrica-meta {
  font-size: 10px; font-weight: 400; color: #6b5a8a; line-height: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rq-chip-inactiva {
  font-size: 9px; font-weight: 700; color: #6b5a8a;
  background: rgba(44, 32, 57, .06); padding: 0 5px; border-radius: 999px;
  margin-left: 4px;
}
.rq-fila-menu { opacity: 0; transition: opacity .12s; flex: none; }
tbody tr:hover .rq-fila-menu,
.rq-td-metrica:focus-within .rq-fila-menu { opacity: 1; }

.rq-fila-inactiva { opacity: .5; }
.rq-fila-inactiva .rq-cell-inner { cursor: default; }

/* ── Celda de valor ────────────────────────────────────────────────────── */
.rq-cell {
  height: 38px; padding: 0;
  border-bottom: 1px solid #F4F0F9;
  position: relative;
}
/* Prioridad de fondo, de menor a mayor: el orden de estas reglas ES la regla. */
tr.rq-fila-hover { --rq-bg: rgba(44, 32, 57, .025); }
.rq-col-actual   { --rq-bg: rgba(145, 91, 216, .045); }
.rq-col-futura   { --rq-bg: #FBFAFC; }
.rq-cell-hover   { --rq-bg: rgba(145, 91, 216, .06); }
.rq-cell-guardando { --rq-bg: rgba(145, 91, 216, .05); }
.rq-cell-foco    { --rq-bg: #fff; }
.rq-cell-editando { --rq-bg: #fff; box-shadow: inset 0 0 0 2px var(--color-unergy-purple); z-index: 2; }
.rq-cell-error   { --rq-bg: rgba(214, 68, 85, .07); box-shadow: inset 0 0 0 2px #D64455; }

.rq-cell-inner {
  position: relative;
  height: 38px; padding: 0 8px;
  display: flex; align-items: center; justify-content: flex-end; gap: 3px;
  text-align: right; font-size: 12.5px;
  font-variant-numeric: tabular-nums; color: var(--color-unergy-deep);
  cursor: cell;
}
.rq-cell-inner:focus { outline: none; }
.rq-cell-inner:focus-visible { outline: 2px solid var(--color-unergy-purple); outline-offset: -2px; }
.rq-vacio { color: #d9d0e6; font-size: 14px; margin: 0 auto; }
.rq-num { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.rq-cell-input {
  width: 100%; height: 36px; border: 0; background: #fff;
  text-align: right; font: inherit; outline: none; padding: 0 8px;
  color: var(--color-unergy-deep);
}

.rq-col-futura .rq-num { color: #c7bdd8; opacity: .55; }
.rq-cell-foco .rq-num { color: var(--color-unergy-deep); opacity: 1; }
.rq-cell-inusual .rq-num { color: #A16207; }
.rq-inusual { font-size: 8px; color: #CA8A04; flex: none; }

.rq-progress {
  position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--color-unergy-purple) 40%, var(--color-unergy-purple) 60%, transparent 100%);
  background-size: 220% 100%;
  animation: rq-indeterminate 1s linear infinite;
}
@keyframes rq-indeterminate {
  0%   { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

/* Flash de guardado: 700ms y se desvanece. Sin ícono, sin toast. */
.rq-cell-ok { animation: rq-flash .7s ease-out; }
@keyframes rq-flash {
  0%   { background-color: rgba(16, 185, 129, .16); }
  100% { background-color: transparent; }
}

.rq-err-icon {
  position: absolute; left: 3px; bottom: 2px;
  font-size: 9px; color: #D64455; cursor: pointer;
}

/* triángulo de nota, patrón "comentario de Excel" */
.rq-nota {
  position: absolute; top: 0; right: 0;
  width: 0; height: 0; border-style: solid;
  border-width: 0 5px 5px 0;
  border-color: transparent var(--color-unergy-purple) transparent transparent;
  cursor: help;
}

/* ── Columnas de resultado ─────────────────────────────────────────────── */
.rq-res {
  --rq-bg: #FDFCFE;
  height: 38px; border-bottom: 1px solid #F4F0F9;
}
.rq-consol {
  text-align: right; padding: 0 10px;
  font-size: 12.5px; font-weight: 700; color: var(--color-unergy-deep);
  font-variant-numeric: tabular-nums;
  transition: color .25s ease-out;
}
.rq-pulso { color: var(--color-unergy-purple); }
.rq-meta {
  text-align: right; padding: 0 10px;
  font-size: 12px; font-weight: 400; color: #6b5a8a;
  font-variant-numeric: tabular-nums;
}
.rq-pct { text-align: center; padding: 0 6px; }
.rq-pct-num { display: block; font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; }
.rq-micro {
  position: relative; display: block; width: 46px; height: 3px; margin: 2px auto 0;
  border-radius: 2px; background: #F1ECF7; overflow: hidden;
}
.rq-micro-fill { position: absolute; left: 0; top: 0; height: 3px; border-radius: 2px; }
.rq-micro-marca { position: absolute; top: 0; width: 1px; height: 3px; background: var(--color-unergy-deep); opacity: .45; }

/* ── Llenado ───────────────────────────────────────────────────────────── */
.rq-llenado th, .rq-llenado td {
  --rq-bg: #faf8fd;
  border-top: 1px solid #ECE7F2; height: 30px;
}
.rq-llenado-lbl {
  text-align: left; padding: 0 10px;
  font-size: 10px; font-weight: 700; color: #9b8fb0;
  letter-spacing: .05em; text-transform: uppercase;
}
.rq-llenado-td { text-align: center; cursor: pointer; padding: 0 4px; }
.rq-llenado-td:hover { --rq-bg: #f0e9fb; }
.rq-llenado-txt { display: block; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rq-llenado-bar {
  display: block; width: 40px; height: 2px; margin: 2px auto 0;
  border-radius: 1px; background: #F1ECF7; overflow: hidden; position: relative;
}
.rq-llenado-bar-fill { position: absolute; left: 0; top: 0; height: 2px; }

/* ── <768px ────────────────────────────────────────────────────────────── */
.rq-angosto { padding: 10px 12px 12px; }
.rq-angosto-aviso { font-size: 11.5px; color: #6b5a8a; margin-bottom: 8px; }
.rq-angosto-fila {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 9px 4px; border: 0; border-bottom: 1px solid #F4F0F9;
  background: none; cursor: pointer; text-align: left;
}
.rq-angosto-actual { background: rgba(145, 91, 216, .045); }
.rq-angosto-s { font-size: 11.5px; font-weight: 800; color: var(--color-unergy-deep); width: 34px; }
.rq-angosto-rango { flex: 1; font-size: 11px; color: #6b5a8a; }
.rq-angosto-llenado { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rq-angosto-fila svg { font-size: 10px; color: #c7bdd8; }

@media (prefers-reduced-motion: reduce) {
  .rq-progress, .rq-cell-ok { animation: none; }
  .rq-consol { transition: none; }
}
</style>
