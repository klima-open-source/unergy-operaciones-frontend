<script setup lang="ts">
import { SearchIcon } from '@lucide/vue'
import type { Id } from '~/types/api'
import type { GarantiaMensual } from '~/features/garantias/types'
import { EstadoVencimiento } from '~/features/garantias/types'
import {
  ESTADO_LABEL,
  ESTADO_SEVERITY,
  ESTADO_TITLE,
  fechaCorta,
  nombreMes,
  PROCEDENCIA_LABEL,
  PROCEDENCIA_SEVERITY,
  PROCEDENCIA_TITLE,
} from './utils/modeloPredictivo'

const props = defineProps<{
  item: GarantiaMensual
}>()
const emit = defineEmits<{ detalle: [id: Id] }>()

const destacada = computed(() => props.item.estado === EstadoVencimiento.ESTIMADO)
</script>

<template>
  <div class="rounded-xl border p-4" :class="destacada ? 'border-primary' : ''">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-foreground">{{ nombreMes(item.mes) }}</span>
        <GBadge :color="ESTADO_SEVERITY[item.estado]" :title="ESTADO_TITLE[item.estado]">
          {{ ESTADO_LABEL[item.estado] }}
        </GBadge>
        <GBadge
          :color="PROCEDENCIA_SEVERITY[item.procedencia_ventana]"
          :title="PROCEDENCIA_TITLE[item.procedencia_ventana]"
        >
          {{ PROCEDENCIA_LABEL[item.procedencia_ventana] }}
        </GBadge>
      </div>
      <div class="text-right">
        <div class="text-xl font-bold text-primary">{{ formatCOP(item.p90) }}</div>
        <div v-if="item.central != null" class="text-xs text-muted-foreground">
          central {{ formatCOP(item.central) }}
        </div>
      </div>
    </div>

    <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <div class="flex justify-between">
        <dt>Ventana cierra</dt>
        <dd class="text-foreground">{{ fechaCorta(item.ventana_cierra) }}</dd>
      </div>
      <div class="flex justify-between">
        <dt>Lo sabés</dt>
        <dd class="text-foreground">{{ fechaCorta(item.objetivo) }}</dd>
      </div>
      <div class="flex justify-between">
        <dt>XM publica</dt>
        <dd class="text-foreground">{{ fechaCorta(item.publica_xm) }}</dd>
      </div>
      <div class="flex justify-between">
        <dt>Ventaja</dt>
        <dd
          class="font-semibold"
          :class="item.dias_ventaja > 0 ? 'text-success' : 'text-destructive'"
        >
          {{ item.dias_ventaja }} {{ item.dias_ventaja === 1 ? 'día' : 'días' }}
        </dd>
      </div>
    </dl>

    <div class="mt-3 flex justify-end">
      <Button variant="ghost" size="sm" @click="emit('detalle', item.id)">
        <SearchIcon class="size-4" />
        Ver detalle
      </Button>
    </div>
  </div>
</template>
