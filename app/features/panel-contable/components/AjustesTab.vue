<script setup lang="ts">
/**
 * Ajustes de reliquidación: lo que hay que volver a contabilizar de un mes que
 * XM reliquidó.
 *
 * El ER que se emite para la reliquidación ya trae la DIFERENCIA contra la
 * versión anterior, así que acá no se resta nada: lo que se muestra es ese
 * ajuste tal cual. Y solo ingresos y comercialización — el OPEX no se
 * reliquida y un ajuste no emite factura.
 *
 * Autosuficiente, como `DiferenciaTab`: no comparte estado con las demás
 * pestañas y no guarda nada.
 */
import { ChevronDownIcon, FileQuestionIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { SECCIONES_AJUSTE } from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import type { GrupoLinea, PanelContable } from '~/features/panel-contable/types'
import { VersionAjuste } from '~/features/panel-contable/types'
import {
  VERSIONES_AJUSTE,
  ajusteEnCero,
  lineasDeAjuste,
  sumar,
  tipoDeAjuste,
} from '~/features/panel-contable/utils/ajustes'
import { arrow, diffTextClass, fmt } from '~/features/panel-contable/utils/formatters'

const props = defineProps<{
  periodo: string
  periodoLabel: string
}>()

const panelContableService = new PanelContableService()

const version = ref<VersionAjuste>(VersionAjuste.TX3)
const ocultarEnCero = ref(true)
const cargando = ref(false)
const paneles = ref<PanelContable[]>([])
const invAbiertos = ref<Record<number, boolean>>({})

/** Las líneas al 100%: el asiento es del proyecto, no de cada inversionista. */
const lineasDe100 = (p: PanelContable) => lineasDeAjuste(p.total_100 || [])

const lineasDeSeccion = (p: PanelContable, keys: GrupoLinea[]) =>
  lineasDe100(p).filter((l) => keys.includes(l.grupo))

const totalDe = (p: PanelContable) => sumar(lineasDe100(p))

const visibles = computed(() =>
  ocultarEnCero.value
    ? paneles.value.filter((p) => !ajusteEnCero(p.total_100 || []))
    : paneles.value,
)

const totalPeriodo = computed(() => visibles.value.reduce((s, p) => s + totalDe(p), 0))

/** Cuántos quedaron fuera por no mover nada: se dice, no se esconde en silencio. */
const enCero = computed(() => paneles.value.length - visibles.value.length)

async function cargar() {
  cargando.value = true
  try {
    const data = await panelContableService.listar({
      periodo: props.periodo,
      tipo: tipoDeAjuste(version.value),
    })
    paneles.value = data.paneles || []
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudieron cargar los ajustes', {
      description: normalizeError(err).message,
      duration: 4000,
    })
    paneles.value = []
  } finally {
    cargando.value = false
  }
}

watch([() => props.periodo, version], cargar, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <!-- Controles -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Versión
        </span>
        <Button
          v-for="v in VERSIONES_AJUSTE"
          :key="v"
          :variant="v === version ? 'default' : 'outline'"
          size="xs"
          class="tabular-nums"
          @click="version = v"
        >
          {{ v }}
        </Button>
      </div>

      <Button
        :variant="ocultarEnCero ? 'default' : 'outline'"
        size="xs"
        @click="ocultarEnCero = !ocultarEnCero"
      >
        Ocultar los que no movieron nada
      </Button>

      <div v-if="!cargando && visibles.length" class="ml-auto text-sm text-muted-foreground">
        {{ visibles.length }} proyecto{{ visibles.length === 1 ? '' : 's' }} ·
        <b class="tabular-nums" :class="diffTextClass(totalPeriodo) || 'text-foreground'">
          {{ arrow(totalPeriodo) }}{{ fmt(totalPeriodo) }}
        </b>
      </div>
    </div>

    <div v-if="cargando" class="flex justify-center p-8">
      <Spinner class="size-6 text-muted-foreground" />
    </div>

    <div v-else-if="!paneles.length" class="rounded-xl border bg-card p-10 text-center">
      <FileQuestionIcon class="mx-auto mb-2 size-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        No hay ajuste de <b class="text-foreground">{{ version }}</b> para
        {{ periodoLabel }}.<br />
        Sube el estado de resultados de la reliquidación con
        <b class="text-foreground">Cargar ER</b>.
      </p>
    </div>

    <div
      v-else-if="!visibles.length"
      class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground"
    >
      Los {{ paneles.length }} proyectos de {{ version }} quedaron en cero: la reliquidación no
      cambió ninguna cifra.
    </div>

    <template v-else>
      <div v-for="p in visibles" :key="p.id" class="overflow-hidden rounded-xl border bg-card">
        <div class="flex items-baseline justify-between gap-4 border-b px-4 py-3">
          <h3 class="text-sm font-semibold text-foreground">
            {{ p.proyecto_nombre || p.proyecto }}
          </h3>
          <span
            class="text-lg font-semibold tabular-nums"
            :class="diffTextClass(totalDe(p)) || 'text-foreground'"
          >
            {{ arrow(totalDe(p)) }}{{ fmt(totalDe(p)) }}
          </span>
        </div>

        <div class="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
          <div v-for="s in SECCIONES_AJUSTE" :key="s.key" class="bg-card p-4">
            <p class="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">
              {{ s.label }}
            </p>
            <p
              v-if="!lineasDeSeccion(p, s.keys).length"
              class="text-sm text-muted-foreground"
            >
              Sin movimiento
            </p>
            <dl v-else class="space-y-1 text-sm">
              <div
                v-for="(ln, i) in lineasDeSeccion(p, s.keys)"
                :key="s.key + i"
                class="flex items-baseline justify-between gap-4"
              >
                <dt class="text-muted-foreground">{{ ln.concepto }}</dt>
                <dd class="tabular-nums" :class="diffTextClass(ln.valor_cop)">
                  {{ fmt(ln.valor_cop) }}
                </dd>
              </div>
              <div
                class="flex items-baseline justify-between gap-4 border-t pt-1 font-semibold text-foreground"
              >
                <dt>Subtotal</dt>
                <dd class="tabular-nums">{{ fmt(sumar(lineasDeSeccion(p, s.keys))) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <Collapsible v-model:open="invAbiertos[p.id]">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" size="sm" class="m-2">
              <ChevronDownIcon
                class="size-4 transition-transform"
                :class="{ 'rotate-180': invAbiertos[p.id] }"
              />
              Reparto por inversionista
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="border-t">
            <div class="overflow-x-auto">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Inversionista</GTableHead>
                    <GTableHead class="text-right">%</GTableHead>
                    <GTableHead class="text-right">Ajuste</GTableHead>
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow
                    v-for="inv in p.inversionistas"
                    :key="inv.proyecto_inversionista_id || inv.nombre"
                  >
                    <GTableCell class="text-muted-foreground">{{ inv.nombre }}</GTableCell>
                    <GTableCell class="text-right tabular-nums">
                      {{ (inv.porcentaje ?? 0).toFixed(2) }}%
                    </GTableCell>
                    <GTableCell
                      class="text-right tabular-nums"
                      :class="diffTextClass(sumar(lineasDeAjuste(inv.lineas)))"
                    >
                      {{ fmt(sumar(lineasDeAjuste(inv.lineas))) }}
                    </GTableCell>
                  </GTableRow>
                </GTableBody>
              </GTable>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <p v-if="enCero" class="text-center text-xs text-muted-foreground">
        {{ enCero }} proyecto{{ enCero === 1 ? '' : 's' }} sin movimiento
        {{ enCero === 1 ? 'está oculto' : 'están ocultos' }}.
      </p>
    </template>
  </div>
</template>
