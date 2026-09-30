<template>
  <div class="mt-2 shrink-0 rounded-xl border border-border bg-card px-3 pt-2 pb-2">
    <button class="flex w-full items-center gap-2 pt-0.5 pb-2 text-left" @click="open = !open">
      <ZapIcon class="size-4 text-warning" />
      <span class="flex-1 text-xs font-bold text-foreground">Reconectador</span>
      <span :class="['rounded-md px-2 py-0.5 text-xs font-extrabold', badgeClass]">{{
        badgeText
      }}</span>
      <ChevronUpIcon v-if="open" class="size-3 text-muted-foreground" />
      <ChevronDownIcon v-else class="size-3 text-muted-foreground" />
    </button>

    <!-- Resumen: siempre visible -->
    <div class="flex gap-1.5">
      <div class="flex min-w-0 flex-1 flex-col rounded-lg bg-muted px-1.5 py-1">
        <span class="text-xs font-medium text-muted-foreground">Activa</span>
        <b class="text-xs leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
          >{{ fmt(relay.potencia_kw, 1) }} <i>kW</i></b
        >
      </div>
      <div class="flex min-w-0 flex-1 flex-col rounded-lg bg-muted px-1.5 py-1">
        <span class="text-xs font-medium text-muted-foreground">Reactiva</span>
        <b class="text-xs leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
          >{{ fmt(relay.reactiva_kva, 1) }} <i>kVA</i></b
        >
      </div>
      <div class="flex min-w-0 flex-1 flex-col rounded-lg bg-muted px-1.5 py-1">
        <span class="text-xs font-medium text-muted-foreground">PF</span>
        <b
          class="text-xs leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
          >{{ fmt(relay.factor_potencia, 2) }}</b
        >
      </div>
      <div class="flex min-w-0 flex-1 flex-col rounded-lg bg-muted px-1.5 py-1">
        <span class="text-xs font-medium text-muted-foreground">F_ABC</span>
        <b class="text-xs leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
          >{{ fmt(relay.frecuencia_hz, 1) }} <i>Hz</i></b
        >
      </div>
    </div>

    <!-- Detalle por fase: las columnas del panel de Solenium -->
    <div v-if="open" class="mt-2 border-t border-border pt-2">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th></th>
            <th :class="thColClass">A</th>
            <th :class="thColClass">B</th>
            <th :class="thColClass">C</th>
            <th :class="thColClass">N</th>
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
            <td class="py-0.5 text-right text-xs font-medium text-muted-foreground/60 tabular-nums">
              —
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-1.5 flex justify-between gap-1.5 border-t border-border pt-1.5">
        <span class="text-xs font-semibold text-muted-foreground"
          >U_R
          <b class="font-bold text-foreground tabular-nums"
            >{{ fmt(relay.voltaje_r, 0) }} V</b
          ></span
        >
        <span class="text-xs font-semibold text-muted-foreground"
          >U_S
          <b class="font-bold text-foreground tabular-nums"
            >{{ fmt(relay.voltaje_s, 0) }} V</b
          ></span
        >
        <span class="text-xs font-semibold text-muted-foreground"
          >U_T
          <b class="font-bold text-foreground tabular-nums"
            >{{ fmt(relay.voltaje_t, 0) }} V</b
          ></span
        >
      </div>

      <div class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon class="size-3" /> {{ tiempo }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, ZapIcon } from '@lucide/vue'
import type { EstadoReconectador } from '~/features/mobile/types'

const props = defineProps<{
  /** Registro de `/reconectadores/estados`: estado del relay + telemetría de SolarView. */
  relay: EstadoReconectador
}>()

const open = ref(true)

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

/** Solenium puede no reportar una medida: null se muestra como guion. */
function fmt(v: unknown, dec = 1): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  // Con la planta cargada (miles de kW) el decimal no aporta y no cabe en pantallas de 320px.
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
