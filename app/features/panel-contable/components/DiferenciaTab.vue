<script setup lang="ts">
/**
 * Preliquidación vs. oficial, por proyecto e inversionista. Autosuficiente: no
 * comparte estado con las demás pestañas. No guarda nada, solo compara.
 */
import { ClockIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { GRUPOS_DIFERENCIA } from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import type {
  GrupoLinea,
  InversionistaDiferencia,
  LineaDiferencia,
  RespuestaDiferencia,
} from '~/features/panel-contable/types'
import { arrow, diffTextClass, fmt } from '~/features/panel-contable/utils/formatters'

const props = defineProps<{
  periodo: string
  periodoLabel: string
}>()

const panelContableService = new PanelContableService()
const cargando = ref(false)

function diferenciaVacia(): RespuestaDiferencia {
  return { proyectos: [], resumen: {}, tiene_oficial: false }
}

const diff = ref<RespuestaDiferencia>(diferenciaVacia())

async function cargar() {
  cargando.value = true
  try {
    diff.value = await panelContableService.obtenerDiferencia(props.periodo)
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo cargar la diferencia', {
      description: normalizeError(err).message,
      duration: 4000,
    })
    diff.value = diferenciaVacia()
  } finally {
    cargando.value = false
  }
}

function lineasGrupo(inv: InversionistaDiferencia, keys: GrupoLinea[]): LineaDiferencia[] {
  return inv.lineas.filter((l) => keys.includes(l.grupo))
}

watch(() => props.periodo, cargar, { immediate: true })
</script>

<template>
  <div v-if="cargando" class="flex justify-center p-8">
    <Spinner class="size-6 text-muted-foreground" />
  </div>

  <div v-else-if="!diff.tiene_oficial" class="rounded-xl border bg-card p-10 text-center">
    <ClockIcon class="mx-auto mb-2 size-6 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">
      Aún no hay liquidación oficial para comparar.<br />
      Carga el ER oficial en la pestaña <b class="text-foreground">Oficial</b>.
    </p>
  </div>

  <div
    v-else-if="!diff.proyectos.length"
    class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground"
  >
    Sin datos para comparar en {{ periodoLabel }}.
  </div>

  <div v-else class="space-y-6">
    <div v-for="proy in diff.proyectos" :key="proy.proyecto_id" class="space-y-3">
      <h3 class="text-sm font-semibold text-foreground">{{ proy.proyecto_nombre }}</h3>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Utilidad estimada
          </p>
          <p class="mt-1 text-lg font-semibold text-foreground tabular-nums">
            {{ fmt(proy.utilidad_pre) }}
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Utilidad real
          </p>
          <p class="mt-1 text-lg font-semibold text-foreground tabular-nums">
            {{ proy.tiene_oficial ? fmt(proy.utilidad_oficial) : 'pendiente' }}
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Diferencia
          </p>
          <p
            class="mt-1 text-lg font-semibold tabular-nums"
            :class="diffTextClass(proy.utilidad_dif) || 'text-foreground'"
          >
            {{ arrow(proy.utilidad_dif) }}{{ fmt(proy.utilidad_dif) }}
          </p>
        </div>
      </div>

      <div
        v-for="inv in proy.inversionistas"
        :key="inv.proyecto_inversionista_id || inv.nombre"
        class="overflow-hidden rounded-xl border bg-card"
      >
        <div class="border-b bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground">
          {{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%
        </div>
        <div class="overflow-x-auto">
          <GTable>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Concepto</GTableHead>
                <GTableHead class="text-right">Preliquidación</GTableHead>
                <GTableHead class="text-right">Oficial</GTableHead>
                <GTableHead class="text-right">Diferencia</GTableHead>
                <GTableHead class="text-right">%</GTableHead>
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <template v-for="g in GRUPOS_DIFERENCIA" :key="g.key">
                <template v-if="lineasGrupo(inv, g.keys).length">
                  <GTableRow class="bg-muted/30 hover:bg-muted/30">
                    <GTableCell
                      colspan="5"
                      class="text-[11px] font-semibold tracking-wide text-primary uppercase"
                      >{{ g.label }}</GTableCell
                    >
                  </GTableRow>
                  <GTableRow v-for="(ln, i) in lineasGrupo(inv, g.keys)" :key="g.key + i">
                    <GTableCell class="text-muted-foreground">{{ ln.concepto }}</GTableCell>
                    <GTableCell class="text-right tabular-nums">{{
                      fmt(ln.preliquidacion)
                    }}</GTableCell>
                    <GTableCell class="text-right tabular-nums">{{
                      ln.oficial != null ? fmt(ln.oficial) : '—'
                    }}</GTableCell>
                    <GTableCell
                      class="text-right tabular-nums"
                      :class="diffTextClass(ln.diferencia)"
                      >{{ arrow(ln.diferencia)
                      }}{{ ln.diferencia != null ? fmt(ln.diferencia) : '—' }}</GTableCell
                    >
                    <GTableCell
                      class="text-right tabular-nums"
                      :class="diffTextClass(ln.diferencia)"
                      >{{
                        ln.pct_variacion != null ? `${ln.pct_variacion.toFixed(1)}%` : '—'
                      }}</GTableCell
                    >
                  </GTableRow>
                </template>
              </template>
              <GTableRow class="bg-muted/30 hover:bg-muted/30">
                <GTableCell
                  colspan="5"
                  class="text-[11px] font-semibold tracking-wide text-primary uppercase"
                  >RESULTADO</GTableCell
                >
              </GTableRow>
              <GTableRow class="bg-muted/20 font-semibold hover:bg-muted/20">
                <GTableCell>Utilidad</GTableCell>
                <GTableCell class="text-right tabular-nums">{{ fmt(inv.utilidad_pre) }}</GTableCell>
                <GTableCell class="text-right tabular-nums">{{
                  inv.utilidad_oficial != null ? fmt(inv.utilidad_oficial) : '—'
                }}</GTableCell>
                <GTableCell class="text-right tabular-nums" :class="diffTextClass(inv.utilidad_dif)"
                  >{{ arrow(inv.utilidad_dif)
                  }}{{ inv.utilidad_dif != null ? fmt(inv.utilidad_dif) : '—' }}</GTableCell
                >
                <GTableCell />
              </GTableRow>
            </GTableBody>
          </GTable>
        </div>
      </div>
    </div>
  </div>
</template>
