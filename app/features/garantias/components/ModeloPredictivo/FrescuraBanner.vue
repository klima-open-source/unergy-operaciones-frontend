<script setup lang="ts">
import { CircleCheckIcon, TriangleAlertIcon } from '@lucide/vue'
import type { FrescuraGeneracion } from '~/features/garantias/types'
import { fechaCorta, generacionAtrasada } from './utils/modeloPredictivo'

const props = defineProps<{
  frescura: FrescuraGeneracion | null
}>()

const atrasada = computed(() => generacionAtrasada(props.frescura))
</script>

<template>
  <Alert v-if="atrasada && frescura" variant="destructive">
    <TriangleAlertIcon class="size-4" />
    <AlertDescription>
      Generación al {{ fechaCorta(frescura.fecha_dato_generacion) }} — {{ frescura.dias_atraso }}
      {{ frescura.dias_atraso === 1 ? 'día' : 'días' }} de atraso. El margen de la anticipación
      mensual está comprometido.
    </AlertDescription>
  </Alert>
  <p v-else-if="frescura" class="flex items-center gap-2 text-xs text-muted-foreground">
    <CircleCheckIcon class="size-3.5 text-success" />
    <span>Generación al día ({{ fechaCorta(frescura.fecha_dato_generacion) }})</span>
  </p>
</template>
