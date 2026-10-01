<template>
  <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
      >
        <ZapIcon class="size-3.5 text-warning" />
        Reconectador
      </span>
      <span :class="['rounded-md px-2 py-0.5 text-xs font-extrabold', badgeClass]">{{
        badgeText
      }}</span>
      <span class="flex items-center gap-1 text-xs text-muted-foreground">
        <ClockIcon class="size-3" /> {{ tiempo }}
      </span>
      <Button
        v-if="puedeReconectar"
        size="sm"
        class="ml-auto"
        title="Encender o apagar el reconectador"
        @click="emit('reconectar')"
      >
        <PowerIcon /> Reconectar
      </Button>
    </div>

    <!-- Las mismas medidas que el panel del movil (y que el de Solenium), en una fila. -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="grid grid-cols-4 gap-1.5">
        <div
          v-for="m in resumen"
          :key="m.label"
          class="flex flex-col rounded-md bg-card px-2 py-1.5"
        >
          <span class="text-xs font-medium text-muted-foreground">{{ m.label }}</span>
          <b class="text-sm font-bold whitespace-nowrap text-foreground tabular-nums">
            {{ m.valor }} <i v-if="m.unidad" class="text-xs font-semibold">{{ m.unidad }}</i>
          </b>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th></th>
              <th v-for="f in ['A', 'B', 'C', 'N']" :key="f" :class="thColClass">{{ f }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th :class="thRowClass">
                I <span class="font-medium text-muted-foreground/70">(A)</span>
              </th>
              <td :class="tdClass">{{ fmt(relay.corriente_a, 1) }}</td>
              <td :class="tdClass">{{ fmt(relay.corriente_b, 1) }}</td>
              <td :class="tdClass">{{ fmt(relay.corriente_c, 1) }}</td>
              <td :class="tdClass">{{ fmt(relay.corriente_n, 1) }}</td>
            </tr>
            <tr>
              <th :class="thRowClass">
                U <span class="font-medium text-muted-foreground/70">(V)</span>
              </th>
              <td :class="tdClass">{{ fmt(relay.voltaje_a, 0) }}</td>
              <td :class="tdClass">{{ fmt(relay.voltaje_b, 0) }}</td>
              <td :class="tdClass">{{ fmt(relay.voltaje_c, 0) }}</td>
              <td class="py-0.5 text-right text-xs font-medium text-muted-foreground/60">—</td>
            </tr>
          </tbody>
        </table>
        <div class="flex justify-between gap-2 border-t border-border pt-1.5">
          <span
            v-for="u in lineas"
            :key="u.label"
            class="text-xs font-semibold text-muted-foreground"
          >
            {{ u.label }} <b class="font-bold text-foreground tabular-nums">{{ u.valor }} V</b>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ClockIcon, PowerIcon, ZapIcon } from '@lucide/vue'
import type { EstadoReconectador } from '~/features/mobile/types'

const props = defineProps<{
  /** Registro de `/reconectadores/estados`: estado del relay + telemetría de SolarView. */
  relay: EstadoReconectador
  /** Solo presentación: el backend vuelve a exigir el rol al recibir el comando. */
  puedeReconectar?: boolean
}>()
const emit = defineEmits<{ reconectar: [] }>()

const thColClass = 'pb-1 text-right text-xs font-bold text-muted-foreground'
const thRowClass = 'text-left text-xs font-bold text-muted-foreground'
const tdClass = 'py-0.5 text-right text-xs font-semibold text-foreground tabular-nums'

const badgeText = computed(() =>
  props.relay.active === true ? 'ON' : props.relay.active === false ? 'OFF' : '—',
)
const badgeClass = computed(() =>
  props.relay.active === true
    ? 'bg-success/10 text-success'
    : props.relay.active === false
      ? 'bg-destructive/10 text-destructive'
      : 'bg-muted text-muted-foreground',
)

const resumen = computed(() => [
  { label: 'Activa', valor: fmt(props.relay.potencia_kw, 1), unidad: 'kW' },
  { label: 'Reactiva', valor: fmt(props.relay.reactiva_kva, 1), unidad: 'kVA' },
  { label: 'PF', valor: fmt(props.relay.factor_potencia, 2), unidad: '' },
  { label: 'F_ABC', valor: fmt(props.relay.frecuencia_hz, 1), unidad: 'Hz' },
])

const lineas = computed(() => [
  { label: 'U_R', valor: fmt(props.relay.voltaje_r, 0) },
  { label: 'U_S', valor: fmt(props.relay.voltaje_s, 0) },
  { label: 'U_T', valor: fmt(props.relay.voltaje_t, 0) },
])

/** Solenium puede no reportar una medida: null se muestra como guion. */
function fmt(v: unknown, dec = 1): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const d = Math.abs(n) >= 1000 ? 0 : dec
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d })
}

const tiempo = computed(() => {
  const raw = props.relay.ultima_actualizacion
  if (!raw) return 'Sin lectura'
  // Solenium manda "2026-08-18 07:25:16"; Safari necesita la T.
  const d = new Date(String(raw).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(raw)
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})
</script>
