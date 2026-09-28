<script setup lang="ts">
import { SearchIcon } from '@lucide/vue'
import type { Id } from '~/types/api'
import type { VencimientoSemanal } from '~/features/garantias/types'
import {
  ESTADO_LABEL,
  ESTADO_SEVERITY,
  ESTADO_TITLE,
  fechaCorta,
  PROCEDENCIA_LABEL,
  PROCEDENCIA_SEVERITY,
  PROCEDENCIA_TITLE,
  rangoCorto,
} from './utils/modeloPredictivo'

defineProps<{
  filas: VencimientoSemanal[]
}>()
const emit = defineEmits<{ detalle: [id: Id] }>()
</script>

<template>
  <GTable>
    <GTableHeader>
      <GTableRow>
        <GTableHead>Vence</GTableHead>
        <GTableHead>Período</GTableHead>
        <GTableHead>Bloque</GTableHead>
        <GTableHead>Estado</GTableHead>
        <GTableHead class="text-right">Central</GTableHead>
        <GTableHead class="text-right">P90</GTableHead>
        <GTableHead class="text-right">Real</GTableHead>
        <GTableHead class="text-center">Ventana</GTableHead>
        <GTableHead />
      </GTableRow>
    </GTableHeader>
    <GTableBody>
      <GTableRow v-for="fila in filas" :key="fila.id">
        <GTableCell class="text-foreground">{{ fechaCorta(fila.vencimiento) }}</GTableCell>
        <GTableCell class="text-muted-foreground">
          {{ rangoCorto(fila.periodo_ini, fila.periodo_fin) }}
        </GTableCell>
        <GTableCell class="text-muted-foreground">{{ fila.etiqueta_periodo }}</GTableCell>
        <GTableCell>
          <GBadge :color="ESTADO_SEVERITY[fila.estado]" :title="ESTADO_TITLE[fila.estado]">
            {{ ESTADO_LABEL[fila.estado] }}
          </GBadge>
        </GTableCell>
        <GTableCell class="text-right text-muted-foreground tabular-nums">
          {{ fila.central == null ? '—' : formatCOP(fila.central) }}
        </GTableCell>
        <GTableCell class="text-right font-semibold text-foreground tabular-nums">
          {{ fila.p90 == null ? '—' : formatCOP(fila.p90) }}
        </GTableCell>
        <GTableCell class="text-right text-muted-foreground tabular-nums">
          {{ fila.real == null ? '—' : formatCOP(fila.real) }}
        </GTableCell>
        <GTableCell class="text-center">
          <GBadge
            :color="PROCEDENCIA_SEVERITY[fila.procedencia_ventana]"
            :title="PROCEDENCIA_TITLE[fila.procedencia_ventana]"
          >
            {{ PROCEDENCIA_LABEL[fila.procedencia_ventana] }}
          </GBadge>
        </GTableCell>
        <GTableCell class="text-right">
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Ver detalle de ${fila.vencimiento}`"
            @click="emit('detalle', fila.id)"
          >
            <SearchIcon class="size-4" />
          </Button>
        </GTableCell>
      </GTableRow>
      <TableEmpty v-if="!filas.length" :colspan="9">
        No hay vencimientos semanales en el horizonte seleccionado.
      </TableEmpty>
    </GTableBody>
  </GTable>
</template>
