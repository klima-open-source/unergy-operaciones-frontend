<script setup lang="ts">
import type { DetalleVencimiento } from '~/features/garantias/types'
import { fuenteAncho, insumoContaminado } from './utils/modeloPredictivo'

const props = defineProps<{
  abierto: boolean
  detalle: DetalleVencimiento | null
  cargando: boolean
}>()
const emit = defineEmits<{ cerrar: [] }>()

const hayContaminado = computed(() => (props.detalle?.insumos ?? []).some(insumoContaminado))

function onOpenChange(open: boolean) {
  if (!open) emit('cerrar')
}
</script>

<template>
  <Dialog :open="abierto" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Detalle del vencimiento</DialogTitle>
      </DialogHeader>

      <div v-if="cargando" class="text-sm text-muted-foreground">Cargando…</div>

      <div v-else-if="detalle" class="space-y-5">
        <div>
          <p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Cadena de cálculo
          </p>
          <GTable>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Concepto</GTableHead>
                <GTableHead class="text-right">Central</GTableHead>
                <GTableHead class="text-right">P90</GTableHead>
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <GTableRow v-for="(f, i) in detalle.cadena" :key="i">
                <GTableCell class="text-foreground">
                  {{ f.concepto }}
                  <GBadge v-if="f.origen" color="action" class="ml-1">{{ f.origen }}</GBadge>
                </GTableCell>
                <GTableCell class="text-right text-muted-foreground tabular-nums">
                  {{ formatCOP(f.central) }}
                </GTableCell>
                <GTableCell class="text-right text-foreground tabular-nums">
                  {{ formatCOP(f.p90) }}
                </GTableCell>
              </GTableRow>
            </GTableBody>
          </GTable>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            De dónde viene el ancho
          </p>
          <div class="mb-2 flex h-2.5 overflow-hidden rounded-full">
            <div
              v-for="d in detalle.descomposicion_ancho"
              :key="d.fuente"
              :style="{
                width: `${(d.pct * 100).toFixed(1)}%`,
                background: fuenteAncho(d.fuente).color,
              }"
            />
          </div>
          <div class="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span
              v-for="d in detalle.descomposicion_ancho"
              :key="d.fuente"
              class="inline-flex items-center gap-1.5"
            >
              <i
                class="inline-block size-2 rounded-sm"
                :style="{ background: fuenteAncho(d.fuente).color }"
              />
              {{ fuenteAncho(d.fuente).label }} {{ Math.round(d.pct * 100) }}%
            </span>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Insumos usados
          </p>
          <GTable>
            <GTableBody>
              <GTableRow v-for="ins in detalle.insumos" :key="ins.tipo">
                <GTableCell class="text-foreground">{{ ins.tipo }}</GTableCell>
                <GTableCell>
                  <GBadge
                    :color="insumoContaminado(ins) ? 'warning' : 'success'"
                    :title="
                      insumoContaminado(ins)
                        ? 'Versión distinta de tx2: el dato no existía en la fecha de cálculo'
                        : 'Versión tx2, sin leakage'
                    "
                  >
                    {{ ins.version }}
                  </GBadge>
                </GTableCell>
                <GTableCell class="text-muted-foreground">{{ ins.rango }}</GTableCell>
                <GTableCell class="text-right text-muted-foreground"
                  >{{ ins.dias }} días</GTableCell
                >
              </GTableRow>
            </GTableBody>
          </GTable>
          <p v-if="hayContaminado" class="mt-2 text-[11px] text-warning">
            Hay insumos en una versión distinta de tx2. Ese dato no existía en la fecha de cálculo,
            así que este número está contaminado y no debe leerse como definitivo.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
