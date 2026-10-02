<template>
  <div class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
    <!-- Igual que el panel de SolarView: título, interruptor y recargar. -->
    <div class="flex items-center gap-2">
      <h3 class="flex-1 text-sm font-bold text-foreground">Reconectador</h3>
      <span
        v-if="pendiente"
        class="flex items-center gap-1 text-xs font-semibold text-warning"
        title="Comando enviado: esperando que SolarView reporte el nuevo estado"
      >
        <LoaderCircleIcon class="size-3 animate-spin" />
        Aplicando {{ relay.active === true ? 'ON' : 'OFF' }}…
      </span>
      <span
        v-else
        :class="[
          'text-xs font-semibold',
          relay.active === true
            ? 'text-success'
            : relay.active === false
              ? 'text-muted-foreground'
              : 'text-muted-foreground/60',
        ]"
      >
        {{ relay.active === true ? 'Activa' : relay.active === false ? 'Inactiva' : 'Sin dato' }}
      </span>
      <!-- El interruptor no cambia nada por sí solo: abre la confirmación. Mientras
           un comando se aplica queda bloqueado, para no mandarlo dos veces. -->
      <GSwitch
        :model-value="relay.active === true"
        :disabled="!puedeReconectar || pendiente"
        :title="
          pendiente
            ? 'Esperando confirmación del comando anterior'
            : puedeReconectar
              ? 'Encender o apagar el reconectador'
              : 'Solo admin y operaciones pueden reconectar'
        "
        @update:model-value="emit('reconectar')"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        title="Actualizar lectura"
        :disabled="recargando"
        @click="emit('refrescar')"
      >
        <RefreshCwIcon :class="recargando ? 'animate-spin' : ''" />
      </Button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-xs whitespace-nowrap">
        <thead>
          <tr class="border-b border-border">
            <th class="py-2 pr-4 text-left font-semibold text-muted-foreground">Tiempo</th>
            <th
              v-for="c in columnas"
              :key="c.label"
              class="px-2 py-2 text-left font-semibold text-muted-foreground"
            >
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="py-2 pr-4 text-foreground tabular-nums">
              {{ tiempo }}
              <span
                v-if="relay.lectura_fallida"
                class="ml-1 text-warning"
                title="SolarView no respondió en la última consulta: esta es la última lectura conocida"
                >· última conocida</span
              >
            </td>
            <td v-for="c in columnas" :key="c.label" class="px-2 py-2 text-foreground tabular-nums">
              {{ c.valor }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircleIcon, RefreshCwIcon } from '@lucide/vue'
import type { EstadoReconectador } from '~/features/mobile/types'

const props = defineProps<{
  /** Registro de `/reconectadores/estados`: estado del relay + telemetría de SolarView. */
  relay: EstadoReconectador
  /** Solo presentación: el backend vuelve a exigir el rol al recibir el comando. */
  puedeReconectar?: boolean
  recargando?: boolean
  /** Se envió un comando y SolarView aún no reporta una lectura posterior. */
  pendiente?: boolean
}>()
const emit = defineEmits<{ reconectar: []; refrescar: [] }>()

/** Las columnas del panel de SolarView, en su orden. */
const columnas = computed(() => {
  const r = props.relay
  return [
    { label: 'I_A', valor: fmt(r.corriente_a, 1, 'A') },
    { label: 'I_B', valor: fmt(r.corriente_b, 1, 'A') },
    { label: 'I_C', valor: fmt(r.corriente_c, 1, 'A') },
    { label: 'I_N', valor: fmt(r.corriente_n, 1, 'A') },
    { label: 'U_A', valor: fmt(r.voltaje_a, 0, 'V') },
    { label: 'U_B', valor: fmt(r.voltaje_b, 0, 'V') },
    { label: 'U_C', valor: fmt(r.voltaje_c, 0, 'V') },
    { label: 'U_R', valor: fmt(r.voltaje_r, 0, 'V') },
    { label: 'U_S', valor: fmt(r.voltaje_s, 0, 'V') },
    { label: 'U_T', valor: fmt(r.voltaje_t, 0, 'V') },
    { label: 'F_ABC', valor: fmt(r.frecuencia_hz, 1, 'Hz') },
    { label: 'Reactiva', valor: fmt(r.reactiva_kva, 1, 'kVA') },
    { label: 'Activa', valor: fmt(r.potencia_kw, 1, 'kW') },
    { label: 'PF', valor: fmt(r.factor_potencia, 2, '') },
  ]
})

/** Solenium puede no reportar una medida: null se muestra como guion. */
function fmt(v: unknown, dec: number, unidad: string): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  })
  return unidad ? `${n} ${unidad}` : n
}

/** La hora tal como la manda SolarView ("2026-10-01 10:57:18"), sin reformatear. */
const tiempo = computed(() => {
  const raw = props.relay.ultima_actualizacion
  return raw ? String(raw).replace('T', ' ').slice(0, 19) : 'Sin lectura'
})
</script>
