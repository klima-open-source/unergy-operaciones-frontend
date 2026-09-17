<script setup lang="ts">
import type { ResumenCumplimientoPpa } from '~/features/dashboard/types'
import { CircleAlertIcon, LoaderCircleIcon } from '@lucide/vue'

const props = defineProps<{
  status: 'idle' | 'loading' | 'error' | 'ready'
  data: ResumenCumplimientoPpa | null
  contratosConCompromisos: number
}>()

const ESTADO_LABEL: Record<string, string> = {
  deficit: 'DÉFICIT',
  excedente: 'EXCEDENTE',
  ok: 'OK',
}

const ESTADO_BADGE_COLOR: Record<string, string> = {
  deficit: 'destructive',
  excedente: 'warning',
  ok: 'success',
}

const totales = computed(() => props.data?.totales)

const deficits = computed(() => props.data?.contratos?.filter((c) => c.estado === 'deficit') ?? [])
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Cumplimiento PPA</CardTitle>
      <CardAction>
        <NuxtLink to="/mem/cumplimiento" class="text-xs font-medium text-primary hover:underline">
          Ver detalle →
        </NuxtLink>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div v-if="status === 'loading'" class="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon class="size-4 animate-spin" />
        Consultando generación...
      </div>

      <div v-else-if="status === 'error'" class="flex items-center gap-2 text-sm text-destructive">
        <CircleAlertIcon class="size-4" />
        No se pudo cargar el cumplimiento PPA.
      </div>

      <div v-else-if="status === 'ready'" class="space-y-3">
        <GBadge :color="totales?.estado ? ESTADO_BADGE_COLOR[totales.estado] : 'default'" size="lg">
          {{ totales?.estado ? ESTADO_LABEL[totales.estado] : '—' }}
        </GBadge>

        <div v-if="totales?.gen_total_mwh != null" class="grid grid-cols-2 gap-3 text-center">
          <div class="rounded-lg bg-muted p-2.5">
            <p class="text-lg font-bold text-foreground">
              {{ (totales.gen_proyectada_mwh ?? totales.gen_total_mwh)?.toFixed(1) }}
            </p>
            <p class="text-[10px] font-semibold uppercase text-muted-foreground">MWh generados</p>
          </div>
          <div class="rounded-lg bg-muted p-2.5">
            <p class="text-lg font-bold text-foreground">
              {{ totales.energia_minima_mwh?.toFixed(1) ?? '—' }}
            </p>
            <p class="text-[10px] font-semibold uppercase text-muted-foreground">MWh comprometidos</p>
          </div>
        </div>

        <p
          v-if="totales?.compras_bolsa_mwh && totales.compras_bolsa_mwh > 0"
          class="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive"
        >
          Compras en bolsa necesarias: {{ totales.compras_bolsa_mwh.toFixed(1) }} MWh
        </p>

        <div v-if="deficits.length > 0" class="space-y-1">
          <p class="text-[10px] font-bold uppercase text-destructive">Contratos en déficit:</p>
          <p v-for="d in deficits" :key="d.id" class="text-xs text-muted-foreground">
            <span class="font-semibold text-foreground">{{ d.nombre_interno || d.comprador_nombre }}</span>
            — {{ d.compras_bolsa_mwh?.toFixed(1) }} MWh faltantes
          </p>
        </div>
      </div>

      <p v-else class="text-sm text-muted-foreground">
        {{ contratosConCompromisos }} contrato{{ contratosConCompromisos === 1 ? '' : 's' }} con compromisos este mes
      </p>
    </CardContent>
  </Card>
</template>
