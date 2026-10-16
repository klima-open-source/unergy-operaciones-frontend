<script setup lang="ts">
/**
 * Precio de bolsa · SIMEM.
 *
 * Antes era una pestaña de SIMEM; desde el 2026-10-16 es esta página, y la vieja
 * (precios de EVO + clima ENSO) se retiró. Fuente: `GET /facturacion/bolsa-simem`
 * (dataset 709b84 del SIMEM), el mismo cálculo del valor a indemnizar. La
 * tarjeta «Precio de bolsa» del inicio sigue saliendo de EVO: otra fuente.
 */
import { computed, onMounted, ref } from 'vue'
import { normalizeError } from '~/core/errors'
import GraficaDiariaBolsa from '~/features/mem/components/GraficaDiariaBolsa.vue'
import { resumirBolsa } from '~/features/mem/utils/bolsaResumen'
import type { BolsaSimemMes } from '~/features/mem/services/bolsaSimem'
import { BolsaSimemService } from '~/features/mem/services/bolsaSimem'

const bolsaService = new BolsaSimemService()

const hoy = new Date()
const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
const periodo = ref(
  `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`,
)
const bolsa = ref<BolsaSimemMes | null>(null)
const bolsaPrevia = ref<BolsaSimemMes | null>(null)
const cargandoBolsa = ref(false)
const errorBolsa = ref<string | null>(null)

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

const diasBolsa = computed(() => Object.keys(bolsa.value?.detalle ?? {}).sort())

/** Promedio del día, sobre las horas que haya. */
function promedioDia(dia: string): number | null {
  const horas = Object.values(bolsa.value?.detalle?.[dia] ?? {})
  return horas.length ? horas.reduce((s, v) => s + v, 0) / horas.length : null
}

/** `+3,2 %` / `−1,8 %`. El signo va explícito; el color no juzga. */
const signo = (v: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

const fmtPrecio = (v: number | null | undefined) =>
  v == null
    ? '—'
    : v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** El período anterior al pedido (`YYYY-MM`), para la variación. */
function periodoAnterior(per: string): string {
  const [a, m] = per.split('-').map(Number)
  const d = new Date(a!, m! - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const resumen = computed(() =>
  resumirBolsa(bolsa.value?.detalle ?? {}, bolsaPrevia.value?.detalle ?? null),
)

async function cargarBolsa() {
  cargandoBolsa.value = true
  errorBolsa.value = null
  try {
    bolsa.value = await bolsaService.obtenerMes(periodo.value)
    // El mes anterior es para comparar: si falla, la vista sirve igual y la
    // variación simplemente no se muestra.
    bolsaPrevia.value = await bolsaService
      .obtenerMes(periodoAnterior(periodo.value))
      .catch(() => null)
  } catch (e) {
    errorBolsa.value = normalizeError(e).message
    bolsa.value = null
  } finally {
    cargandoBolsa.value = false
  }
}

onMounted(cargarBolsa)
</script>

<template>
  <div class="space-y-5">
    <PageHeader title="Precio de bolsa" subtitle="Precio de bolsa nacional por hora, del SIMEM" />

    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Período</label>
        <Input v-model="periodo" type="month" class="w-40" @change="cargarBolsa" />
      </div>
      <Button size="sm" variant="outline" :disabled="cargandoBolsa" @click="cargarBolsa">
        Consultar
      </Button>
    </div>

    <p class="text-xs text-muted-foreground">
      Precio de bolsa nacional del SIMEM (dataset 709b84), hora a hora. Es el mismo cálculo del
      valor a indemnizar.
    </p>

    <div
      v-if="errorBolsa"
      class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      {{ errorBolsa }}
    </div>

    <Spinner v-else-if="cargandoBolsa" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <template v-else-if="bolsa">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-md border px-4 py-3">
          <div class="text-xs text-muted-foreground">Último precio</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ fmtPrecio(resumen.ultimo?.precio) }}
          </div>
          <div class="text-xs text-muted-foreground">
            <template v-if="resumen.ultimo">
              {{ resumen.ultimo.dia }} · {{ resumen.ultimo.hora }}:00
            </template>
            <template v-else>sin datos</template>
          </div>
        </div>

        <div class="rounded-md border px-4 py-3">
          <div class="text-xs text-muted-foreground">PNBA del mes</div>
          <div class="text-2xl font-semibold tabular-nums">{{ fmtPrecio(bolsa.precio_bolsa) }}</div>
          <div class="text-xs text-muted-foreground">
            <span v-if="resumen.variacionMes != null">
              {{ signo(resumen.variacionMes) }} vs. mes anterior
            </span>
            <span v-else>{{ bolsa.horas }} h · {{ bolsa.dias }} días</span>
          </div>
        </div>

        <div class="rounded-md border px-4 py-3">
          <div class="text-xs text-muted-foreground">Últimos 7 días</div>
          <div class="text-2xl font-semibold tabular-nums">{{ fmtPrecio(resumen.promedio7d) }}</div>
          <div class="text-xs text-muted-foreground">
            <span v-if="resumen.variacion7d != null">
              {{ signo(resumen.variacion7d) }} vs. 7 previos
            </span>
            <span v-else>sin período previo para comparar</span>
          </div>
        </div>

        <div class="rounded-md border px-4 py-3">
          <div class="text-xs text-muted-foreground">Máximo / mínimo</div>
          <div class="text-lg font-semibold tabular-nums">
            {{ fmtPrecio(resumen.maximo?.precio) }} <span class="text-muted-foreground">/</span>
            {{ fmtPrecio(resumen.minimo?.precio) }}
          </div>
          <div class="text-xs text-muted-foreground">
            <template v-if="resumen.maximo && resumen.minimo">
              {{ resumen.maximo.dia.slice(5) }} {{ resumen.maximo.hora }}h ·
              {{ resumen.minimo.dia.slice(5) }} {{ resumen.minimo.hora }}h
            </template>
          </div>
        </div>
      </div>

      <!-- Las horas del PTB van aparte y nombradas: son horas con el precio
             por encima del de escasez, no un dato cualquiera. -->
      <div
        v-if="bolsa.horas_ptb"
        class="rounded-md border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning"
      >
        <b>{{ bolsa.horas_ptb }}</b> hora(s) tomadas del PTB — el precio de bolsa superó el de
        escasez de activación y XM publica el precio de transacciones en su lugar.
      </div>

      <GraficaDiariaBolsa :serie="resumen.serie" />

      <div
        v-if="!diasBolsa.length"
        class="rounded-md border p-8 text-center text-sm text-muted-foreground"
      >
        El SIMEM no devolvió datos para este período.
      </div>

      <div v-else class="overflow-x-auto rounded-md border">
        <table class="w-full text-xs">
          <thead class="bg-muted/50">
            <tr class="border-b">
              <th
                class="px-2 py-2 text-left font-medium tracking-wide text-muted-foreground uppercase"
              >
                Fecha
              </th>
              <th
                v-for="h in HORAS"
                :key="h"
                class="px-1.5 py-2 text-right font-medium text-muted-foreground tabular-nums"
              >
                {{ h }}
              </th>
              <th
                class="px-2 py-2 text-right font-medium tracking-wide text-muted-foreground uppercase"
              >
                Prom.
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in diasBolsa" :key="d" class="border-t hover:bg-muted/40">
              <td class="px-2 py-1.5 whitespace-nowrap">{{ d }}</td>
              <td
                v-for="h in HORAS"
                :key="h"
                class="px-1.5 py-1.5 text-right tabular-nums"
                :class="{ 'text-muted-foreground': bolsa.detalle[d]?.[h] == null }"
              >
                {{ fmtPrecio(bolsa.detalle[d]?.[h]) }}
              </td>
              <td class="px-2 py-1.5 text-right font-medium tabular-nums">
                {{ fmtPrecio(promedioDia(d)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
