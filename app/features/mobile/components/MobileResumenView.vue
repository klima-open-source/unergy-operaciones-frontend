<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-muted font-sans text-unergy-deep">
    <!-- ══ TOP BAR ══ -->
    <header
      class="rs-topbar flex shrink-0 items-center gap-2.5 bg-unergy-deep px-3.5 pb-2.5 text-white"
    >
      <span class="flex-1 text-base font-bold tracking-wide"
        ><ChartColumnIcon class="mr-1.5 inline size-4 text-unergy-yellow" /> Resumen del día</span
      >
      <button
        class="size-9 shrink-0 rounded-xl bg-white/10 text-white disabled:opacity-50"
        :disabled="loading"
        @click="cargar()"
        title="Actualizar"
      >
        <LoaderCircleIcon v-if="loading" class="size-4 animate-spin" />
        <RefreshCwIcon v-else class="size-4" />
      </button>
    </header>

    <main class="flex-1 overflow-y-auto px-3 py-3">
      <div class="mx-0.5 mt-0.5 mb-3 text-sm font-semibold text-muted-foreground capitalize">
        {{ fechaLarga }}
      </div>

      <!-- Totales del día -->
      <div class="mb-3.5 flex gap-2.5">
        <div
          class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3"
        >
          <span class="size-2.5 shrink-0 rounded-full bg-chart-2" />
          <div class="flex min-w-0 flex-col">
            <span class="text-xs font-semibold text-muted-foreground">Medidores hoy</span>
            <span
              class="text-xl leading-tight font-extrabold tracking-tight whitespace-nowrap text-unergy-deep"
              >{{ fmtKwh(gen.medidor?.total) }}</span
            >
          </div>
        </div>
        <div
          class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3"
        >
          <span class="size-2.5 shrink-0 rounded-full bg-unergy-purple" />
          <div class="flex min-w-0 flex-col">
            <span class="text-xs font-semibold text-muted-foreground">Inversores hoy</span>
            <span
              class="text-xl leading-tight font-extrabold tracking-tight whitespace-nowrap text-unergy-deep"
              >{{ fmtKwh(gen.inversor?.total) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Top Medidores -->
      <TopCard
        title="Top generación — Medidores"
        :icon="GaugeIcon"
        accent="var(--chart-2)"
        :items="gen.medidor?.top || []"
        :loading="loadingGen"
        :max="maxMedidor"
      />

      <!-- Top Inversores -->
      <TopCard
        title="Top generación — Inversores"
        :icon="ZapIcon"
        accent="var(--color-unergy-purple)"
        :items="gen.inversor?.top || []"
        :loading="loadingGen"
        :max="maxInversor"
      />

      <!-- Fallas de hoy -->
      <section :class="CLS.card">
        <div :class="CLS.cardHead">
          <WrenchIcon class="size-4 text-warning" />
          <h3 :class="CLS.cardTitle">Fallas de hoy</h3>
        </div>

        <div v-if="loadingFallas" :class="CLS.loading">
          <LoaderCircleIcon class="size-4 animate-spin text-unergy-purple" /> Cargando…
        </div>

        <template v-else>
          <!-- Creadas -->
          <div
            class="mx-0.5 mt-1 mb-1.5 flex items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase"
          >
            <CirclePlusIcon class="size-4" /> Creadas
            <span
              class="ml-auto rounded-full bg-unergy-purple/10 px-2 py-px text-xs font-extrabold text-muted-foreground normal-case"
              >{{ fallas.creadas?.length || 0 }}</span
            >
          </div>
          <div v-if="(fallas.creadas?.length || 0) === 0" :class="CLS.emptyRow">
            Ninguna creada hoy
          </div>
          <button
            v-for="f in fallas.creadas || []"
            :key="'c' + f.id"
            class="mb-2 flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left"
            @click="openFalla(f)"
          >
            <span
              class="shrink-0 rounded-md bg-(--c)/15 px-2 py-1 text-xs font-extrabold whitespace-nowrap text-(--c)"
              :style="{ '--c': colorEstado(f.estado?.codigo) }"
              >{{ f.estado?.etiqueta || '—' }}</span
            >
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <TruncatedText
                :text="f.proyecto?.nombre_comercial || '—'"
                class="text-sm font-bold text-unergy-deep"
              />
              <TruncatedText
                :text="f.tipo?.etiqueta || f.tipo_libre || 'Falla'"
                class="text-xs text-muted-foreground"
              />
            </span>
            <ChevronRightIcon class="size-3 shrink-0 text-muted-foreground" />
          </button>

          <!-- Cambios de estado -->
          <div
            class="mx-0.5 mt-3.5 mb-1.5 flex items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase"
          >
            <RefreshCwIcon class="size-4" /> Cambiaron de estado
            <span
              class="ml-auto rounded-full bg-unergy-purple/10 px-2 py-px text-xs font-extrabold text-muted-foreground normal-case"
              >{{ fallas.cambios_estado?.length || 0 }}</span
            >
          </div>
          <div v-if="(fallas.cambios_estado?.length || 0) === 0" :class="CLS.emptyRow">
            Ningún cambio hoy
          </div>
          <button
            v-for="(c, i) in fallas.cambios_estado || []"
            :key="'ch' + (c.falla?.id ?? i) + '_' + (c.hora || i)"
            class="mb-2 flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left"
            @click="openFalla(c.falla)"
          >
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <TruncatedText
                :text="c.falla?.proyecto?.nombre_comercial || '—'"
                class="text-sm font-bold text-unergy-deep"
              />
              <span class="flex flex-wrap items-center gap-1.5">
                <span
                  class="shrink-0 rounded-md bg-(--c)/15 px-1.5 py-0.5 text-xs font-extrabold whitespace-nowrap text-(--c)"
                  :style="{ '--c': colorEstado(c.estado_anterior?.codigo) }"
                  >{{ c.estado_anterior?.etiqueta || '—' }}</span
                >
                <ArrowRightIcon class="size-3 text-muted-foreground" />
                <span
                  class="shrink-0 rounded-md bg-(--c)/15 px-1.5 py-0.5 text-xs font-extrabold whitespace-nowrap text-(--c)"
                  :style="{ '--c': colorEstado(c.estado_nuevo?.codigo) }"
                  >{{ c.estado_nuevo?.etiqueta || '—' }}</span
                >
              </span>
            </span>
            <span class="shrink-0 text-xs font-semibold whitespace-nowrap text-muted-foreground">{{
              horaCorta(c.hora)
            }}</span>
            <ChevronRightIcon class="size-3 shrink-0 text-muted-foreground" />
          </button>
        </template>
      </section>

      <div class="h-2" />
    </main>

    <MobileTabBar />

    <FallaDetailSheet
      :open="fallaDetailOpen"
      :falla="fallaDetail"
      :catalogos="catalogos"
      @close="fallaDetailOpen = false"
      @updated="onFallaUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'
import type { Component, PropType } from 'vue'
import {
  ArrowRightIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  GaugeIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  WrenchIcon,
  ZapIcon,
} from '@lucide/vue'
import type { CambioEstadoFalla, CatalogosFalla, Falla } from '~/features/fallas/types'
import type { ResumenGeneracionDiaFuente, TopGeneracionProyecto } from '~/features/solar/types'
import { logger } from '~/core/logger'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado } from '~/features/fallas/utils/colores'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import FallaDetailSheet from '~/features/mobile/components/components/FallaDetailSheet.vue'

// Clases compartidas por las tarjetas (la del template y la de TopCard).
const CLS = {
  card: 'mb-3.5 rounded-2xl border border-border bg-card px-3 pb-2 pt-3',
  cardHead: 'mb-2.5 flex items-center gap-2',
  cardTitle: 'text-sm font-extrabold text-unergy-deep',
  loading: 'flex items-center gap-2 px-1 py-3.5 text-sm text-muted-foreground',
  emptyRow: 'px-1 py-2.5 text-sm text-muted-foreground',
} as const

// ── Tarjeta de "top" reutilizable (medidores / inversores) ───────────────────
const TopCard = defineComponent({
  props: {
    title: String,
    /** Componente de `@lucide/vue`. */
    icon: { type: [Object, Function] as PropType<Component | null>, default: null },
    accent: String,
    items: { type: Array as PropType<TopGeneracionProyecto[]>, default: () => [] },
    loading: Boolean,
    max: Number,
  },
  setup(props) {
    const medal = (i: number) =>
      i === 0
        ? 'var(--color-unergy-yellow)'
        : i === 1
          ? 'var(--muted-foreground)'
          : i === 2
            ? 'var(--warning)'
            : null
    const fmt = (kwh: number | null | undefined) =>
      kwh == null ? '—' : kwh >= 1000 ? (kwh / 1000).toFixed(2) + ' MWh' : kwh.toFixed(1) + ' kWh'
    return () =>
      h('section', { class: CLS.card }, [
        h('div', { class: CLS.cardHead }, [
          props.icon ? h(props.icon, { class: 'size-4', style: { '--c': props.accent } }) : null,
          h('h3', { class: CLS.cardTitle }, props.title),
        ]),
        props.loading
          ? h('div', { class: CLS.loading }, [
              h(LoaderCircleIcon, { class: 'size-4 animate-spin text-unergy-purple' }),
              ' Cargando…',
            ])
          : props.items.length === 0
            ? h('div', { class: CLS.emptyRow }, 'Sin datos de generación hoy')
            : h(
                'div',
                { class: 'flex flex-col' },
                props.items.map((it, i) =>
                  h(
                    'div',
                    {
                      class:
                        'flex items-center gap-3 border-t border-border px-0.5 py-2 first:border-t-0',
                      key: it.proyecto_id,
                    },
                    [
                      h(
                        'span',
                        {
                          class: [
                            'flex size-6 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold',
                            medal(i)
                              ? 'bg-(--c) text-unergy-deep'
                              : 'bg-unergy-purple/10 text-muted-foreground',
                          ],
                          style: { '--c': medal(i) },
                        },
                        String(i + 1),
                      ),
                      h('div', { class: 'flex min-w-0 flex-1 flex-col gap-1.5' }, [
                        h(
                          'span',
                          { class: 'truncate text-sm font-semibold text-unergy-deep' },
                          it.nombre || '—',
                        ),
                        h('div', { class: 'h-1.5 overflow-hidden rounded-sm bg-muted' }, [
                          h('div', {
                            class: 'h-full w-(--w) rounded-sm bg-(--c) transition-all duration-300',
                            style: {
                              '--w':
                                ((props.max ?? 0) > 0
                                  ? Math.max(3, (it.kwh / props.max!) * 100)
                                  : 0) + '%',
                              '--c': props.accent,
                            },
                          }),
                        ]),
                      ]),
                      h(
                        'span',
                        {
                          class:
                            'shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums text-unergy-deep',
                        },
                        fmt(it.kwh),
                      ),
                    ],
                  ),
                ),
              ),
      ])
  },
})

const fallasService = new FallasService()
const generacionSolarService = new GeneracionSolarService()

// ── Estado ───────────────────────────────────────────────────────────────────
const gen = reactive<{
  medidor: ResumenGeneracionDiaFuente | null
  inversor: ResumenGeneracionDiaFuente | null
  fecha: string | null
}>({ medidor: null, inversor: null, fecha: null })
const fallas = reactive<{
  creadas: Falla[]
  cambios_estado: CambioEstadoFalla[]
  fecha: string | null
}>({ creadas: [], cambios_estado: [], fecha: null })
const loadingGen = ref(false)
const loadingFallas = ref(false)
const loading = computed(() => loadingGen.value || loadingFallas.value)

const catalogos = reactive<CatalogosFalla>({
  estados: [],
  prioridades: [],
  tipos: [],
  resoluciones: [],
})
const fallaDetailOpen = ref(false)
const fallaDetail = ref<Falla | null>(null)

const maxMedidor = computed(() => Math.max(0, ...(gen.medidor?.top || []).map((x) => x.kwh || 0)))
const maxInversor = computed(() => Math.max(0, ...(gen.inversor?.top || []).map((x) => x.kwh || 0)))

const fechaLarga = computed(() => {
  const f = gen.fecha || fallas.fecha
  if (!f) return 'Hoy'
  const d = new Date(f + 'T00:00:00')
  if (isNaN(d.getTime())) return 'Hoy'
  const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
})

function fmtKwh(kwh: number | null | undefined): string {
  if (kwh == null) return '—'
  return kwh >= 1000 ? (kwh / 1000).toFixed(2) + ' MWh' : kwh.toFixed(1) + ' kWh'
}
function horaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
// ── Carga ───────────────────────────────────────────────────────────────────
async function cargarGen(): Promise<void> {
  loadingGen.value = true
  try {
    const data = await generacionSolarService.obtenerResumenDia()
    gen.medidor = data.medidor || { total: 0, top: [] }
    gen.inversor = data.inversor || { total: 0, top: [] }
    gen.fecha = data.fecha ?? null
  } catch (e) {
    logger.error('mobile', e)
    if (!gen.medidor) gen.medidor = { total: 0, top: [] }
    if (!gen.inversor) gen.inversor = { total: 0, top: [] }
  } finally {
    loadingGen.value = false
  }
}

async function cargarFallas(): Promise<void> {
  loadingFallas.value = true
  try {
    const data = await fallasService.obtenerActividadHoy()
    fallas.creadas = data.creadas || []
    fallas.cambios_estado = data.cambios_estado || []
    fallas.fecha = data.fecha ?? null
  } catch (e) {
    logger.error('mobile', e)
  } finally {
    loadingFallas.value = false
  }
}

async function cargarCatalogos(): Promise<void> {
  try {
    const cat = await fallasService.obtenerCatalogos()
    Object.assign(catalogos, cat)
  } catch {
    /* no crítico */
  }
}

function cargar(): void {
  cargarGen()
  cargarFallas()
}

function openFalla(f: Falla | null | undefined): void {
  if (!f) return
  fallaDetail.value = f
  fallaDetailOpen.value = true
}
function onFallaUpdated(): void {
  cargarFallas()
}

onMounted(() => {
  cargar()
  cargarCatalogos()
})
</script>

<style scoped>
/* safe-area: notch superior en la PWA */
.rs-topbar {
  padding-top: calc(0.625rem + env(safe-area-inset-top));
}
</style>
