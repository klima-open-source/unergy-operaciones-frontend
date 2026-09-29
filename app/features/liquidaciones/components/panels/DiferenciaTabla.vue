<script setup lang="ts">
import type { GrupoLinea, LineaDiferencia } from '~/features/panel-contable/types'
import { fmtCOP } from '~/features/liquidaciones/utils/liquidaciones'

interface GrupoDef {
  key: string
  keys: GrupoLinea[]
  label: string
}

const props = defineProps<{
  grupos: GrupoDef[]
  lineas: LineaDiferencia[]
  utilidad: { pre: number | null; ofi: number | null; dif: number | null }
}>()

function lineasDe(g: GrupoDef): LineaDiferencia[] {
  return props.lineas.filter((l) => g.keys.includes(l.grupo))
}

function celda(v: number | null | undefined): string {
  return v != null ? fmtCOP(v) : '—'
}

function arrow(v: number | null | undefined): string {
  return v == null || v === 0 ? '' : v > 0 ? '▲ ' : '▼ '
}

function diffTextClass(v: number | null | undefined): string {
  if (!v) return 'text-muted-foreground'
  return v > 0 ? 'text-success' : 'text-destructive'
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="bg-muted/30 text-left">
          <th class="px-2 py-1 font-medium text-muted-foreground">Concepto</th>
          <th class="px-2 py-1 text-right font-medium text-muted-foreground">Preliquidación</th>
          <th class="px-2 py-1 text-right font-medium text-muted-foreground">Oficial</th>
          <th class="px-2 py-1 text-right font-medium text-muted-foreground">Diferencia</th>
          <th class="px-2 py-1 text-right font-medium text-muted-foreground">%</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in grupos" :key="g.key">
          <template v-if="lineasDe(g).length">
            <tr>
              <td
                colspan="5"
                class="px-2 pt-2 pb-0.5 text-xs font-bold tracking-wide text-primary uppercase"
              >
                {{ g.label }}
              </td>
            </tr>
            <tr v-for="(ln, i) in lineasDe(g)" :key="g.key + i" class="border-t">
              <td class="px-2 py-1 text-muted-foreground">{{ ln.concepto }}</td>
              <td class="px-2 py-1 text-right font-mono text-muted-foreground tabular-nums">
                {{ celda(ln.preliquidacion) }}
              </td>
              <td class="px-2 py-1 text-right font-mono text-muted-foreground tabular-nums">
                {{ celda(ln.oficial) }}
              </td>
              <td
                class="px-2 py-1 text-right font-mono font-semibold tabular-nums"
                :class="diffTextClass(ln.diferencia)"
              >
                {{ arrow(ln.diferencia) }}{{ celda(ln.diferencia) }}
              </td>
              <td
                class="px-2 py-1 text-right font-mono tabular-nums"
                :class="diffTextClass(ln.diferencia)"
              >
                {{ ln.pct_variacion != null ? ln.pct_variacion.toFixed(1) + '%' : '—' }}
              </td>
            </tr>
          </template>
        </template>
        <tr class="border-t-2 border-primary bg-primary/5">
          <td class="px-2 py-1.5 font-extrabold text-foreground">Valor a pagar (utilidad)</td>
          <td class="px-2 py-1.5 text-right font-mono font-bold text-foreground tabular-nums">
            {{ celda(utilidad.pre) }}
          </td>
          <td class="px-2 py-1.5 text-right font-mono font-bold text-foreground tabular-nums">
            {{ celda(utilidad.ofi) }}
          </td>
          <td
            class="px-2 py-1.5 text-right font-mono font-extrabold tabular-nums"
            :class="diffTextClass(utilidad.dif)"
          >
            {{ arrow(utilidad.dif) }}{{ celda(utilidad.dif) }}
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  </div>
</template>
