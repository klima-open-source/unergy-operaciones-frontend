<template>
  <div class="rp-card">
    <button class="rp-head" @click="open = !open">
      <ZapIcon class="rp-ico size-4" />
      <span class="rp-title">Reconectador</span>
      <span :class="['rp-badge', badgeClass]">{{ badgeText }}</span>
      <ChevronUpIcon v-if="open" class="rp-caret size-3" />
      <ChevronDownIcon v-else class="rp-caret size-3" />
    </button>

    <!-- Resumen: siempre visible -->
    <div class="rp-kpis">
      <div class="rp-kpi">
        <span class="rp-kpi-lbl">Activa</span>
        <b class="rp-kpi-val">{{ fmt(relay.potencia_kw, 1) }} <i>kW</i></b>
      </div>
      <div class="rp-kpi">
        <span class="rp-kpi-lbl">Reactiva</span>
        <b class="rp-kpi-val">{{ fmt(relay.reactiva_kva, 1) }} <i>kVA</i></b>
      </div>
      <div class="rp-kpi">
        <span class="rp-kpi-lbl">PF</span>
        <b class="rp-kpi-val">{{ fmt(relay.factor_potencia, 2) }}</b>
      </div>
      <div class="rp-kpi">
        <span class="rp-kpi-lbl">F_ABC</span>
        <b class="rp-kpi-val">{{ fmt(relay.frecuencia_hz, 1) }} <i>Hz</i></b>
      </div>
    </div>

    <!-- Detalle por fase: las columnas del panel de Solenium -->
    <div v-if="open" class="rp-detail">
      <table class="rp-table">
        <thead>
          <tr>
            <th class="rp-th-first"></th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>N</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th class="rp-th-first">I <span>(A)</span></th>
            <td>{{ fmt(relay.corriente_a, 1) }}</td>
            <td>{{ fmt(relay.corriente_b, 1) }}</td>
            <td>{{ fmt(relay.corriente_c, 1) }}</td>
            <td>{{ fmt(relay.corriente_n, 1) }}</td>
          </tr>
          <tr>
            <th class="rp-th-first">U <span>(V)</span></th>
            <td>{{ fmt(relay.voltaje_a, 0) }}</td>
            <td>{{ fmt(relay.voltaje_b, 0) }}</td>
            <td>{{ fmt(relay.voltaje_c, 0) }}</td>
            <td class="rp-na">—</td>
          </tr>
        </tbody>
      </table>

      <div class="rp-urst">
        <span
          >U_R <b>{{ fmt(relay.voltaje_r, 0) }} V</b></span
        >
        <span
          >U_S <b>{{ fmt(relay.voltaje_s, 0) }} V</b></span
        >
        <span
          >U_T <b>{{ fmt(relay.voltaje_t, 0) }} V</b></span
        >
      </div>

      <div class="rp-time"><ClockIcon class="size-3" /> {{ tiempo }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, ZapIcon } from '@lucide/vue'
import type { EstadoReconectador } from '~/features/mobile/types'

const props = defineProps<{
  /** Registro de `/reconectadores/estados`: estado del relay + telemetría de Solenium. */
  relay: EstadoReconectador
}>()

const open = ref(true)

const badgeText = computed(() =>
  props.relay.active === true ? 'ON' : props.relay.active === false ? 'OFF' : '—',
)
const badgeClass = computed(() =>
  props.relay.active === true
    ? 'rp-badge--on'
    : props.relay.active === false
      ? 'rp-badge--off'
      : 'rp-badge--unk',
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

<style scoped>
.rp-card {
  flex-shrink: 0;
  margin-top: 8px;
  background: #fff;
  border: 1px solid #eceaf2;
  border-radius: 14px;
  padding: 8px 11px 9px;
}

.rp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 2px 0 7px;
  border: none;
  background: none;
  text-align: left;
}
.rp-ico {
  color: #eab308;
  font-size: 13px;
}
.rp-title {
  flex: 1;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-unergy-deep);
}
.rp-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 6px;
}
.rp-badge--on {
  background: #dcfce7;
  color: #15803d;
}
.rp-badge--off {
  background: #fee2e2;
  color: #b91c1c;
}
.rp-badge--unk {
  background: #f3f4f6;
  color: #9ca3af;
}
.rp-caret {
  font-size: 10px;
  color: #c4b8d8;
}

/* Resumen */
.rp-kpis {
  display: flex;
  gap: 6px;
}
.rp-kpi {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #faf8fd;
  border-radius: 9px;
  padding: 5px 6px;
}
.rp-kpi-lbl {
  font-size: clamp(8.5px, 2.4vw, 9.5px);
  color: #787774;
  font-weight: 500;
  letter-spacing: 0.2px;
}
.rp-kpi-val {
  font-size: clamp(11px, 3.4vw, 14px);
  font-weight: 700;
  color: var(--color-unergy-deep);
  line-height: 1.2;
  white-space: nowrap;
  letter-spacing: -0.2px;
}
.rp-kpi-val svg {
  font-style: normal;
  font-size: 0.72em;
  font-weight: 600;
  color: #6b5a8a;
}

/* Detalle por fase */
.rp-detail {
  margin-top: 8px;
  border-top: 1px solid #f3f0f9;
  padding-top: 7px;
}
.rp-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.rp-table thead th {
  font-size: clamp(9px, 2.5vw, 10px);
  font-weight: 700;
  color: #9ca3af;
  padding-bottom: 3px;
  text-align: right;
}
.rp-table tbody th {
  font-size: clamp(10px, 2.8vw, 11px);
  font-weight: 700;
  color: #6b5a8a;
  text-align: left;
}
.rp-table tbody th span {
  font-weight: 500;
  color: #b3a8c6;
}
.rp-th-first {
  width: 21%;
}
.rp-table tbody td {
  font-size: clamp(11px, 3.1vw, 12.5px);
  font-weight: 600;
  color: var(--color-unergy-deep);
  text-align: right;
  padding: 2.5px 0;
  font-variant-numeric: tabular-nums;
}
.rp-na {
  color: #cbc4d8 !important;
  font-weight: 500 !important;
}

.rp-urst {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: 6px;
  border-top: 1px solid #f8f6fc;
  padding-top: 6px;
}
.rp-urst span {
  font-size: clamp(9.5px, 2.6vw, 10.5px);
  color: #9ca3af;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.rp-urst b {
  color: var(--color-unergy-deep);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.rp-time {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: clamp(9.5px, 2.6vw, 10.5px);
  color: #9ca3af;
}
</style>
