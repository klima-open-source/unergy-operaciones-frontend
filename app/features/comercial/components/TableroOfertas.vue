<!--
  Tablero kanban de OFERTAS (la oferta es la unidad del negocio, no el cliente).

  Dos decisiones que cambian el comportamiento viejo:
  1. Soltar en "Firmado" abre el diálogo de firmar en vez de mover la tarjeta
     suelta. Mover a firmado sin crear el contrato dejaba `ppa_contrato_id` en
     NULL: un contrato fantasma que Cumplimiento y Liquidaciones nunca ven.
  2. No hay tope de tarjetas. Antes la columna cortaba en 20 con un "+N más —
     ver en tabla" que te expulsaba de la vista; ahora la columna scrollea.
-->
<script setup lang="ts">
import type { Oferta } from '~/features/comercial/types'
import { SendIcon, XIcon } from '@lucide/vue'
import {
  alarmante,
  COLUMNAS,
  colorEtapa,
  labelTipo,
  mwhMes,
  fmtMwh,
  resumenColumna,
  segmentoTipo,
  sinRespuesta,
  type Columna,
} from './comercial'

const props = defineProps<{
  porColumna: Record<string, Oferta[]>
  ofertaAbiertaId?: number | null
}>()
const emit = defineEmits<{
  abrir: [oferta: Oferta]
  mover: [oferta: Oferta, estado: string]
  firmar: [oferta: Oferta]
  declinar: [oferta: Oferta]
}>()

const arrastrando = ref<number | null>(null)
const arrastreSobre = ref<string | null>(null)
// Cerradas arranca colapsada: casi siempre está vacía y ocupaba una columna
// entera del ancho útil.
const cerradasAbierta = ref(false)

function colapsada(col: Columna): boolean {
  return col.value === 'cerradas' && !cerradasAbierta.value
}

function filas(col: Columna): Oferta[] {
  return props.porColumna[col.value] ?? []
}

function resumen(col: Columna) {
  return resumenColumna(filas(col))
}

function claseSegmento(tipo: string | undefined): string {
  return (
    (
      {
        servicios_operacionales: 'bg-blue-50 text-blue-700',
        compra_energia: 'bg-amber-50 text-amber-700',
        comunidad_energetica: 'bg-emerald-50 text-emerald-700',
      } as Record<string, string>
    )[tipo ?? ''] ?? 'bg-gray-100 text-gray-600'
  )
}

function soltar(col: Columna) {
  const id = arrastrando.value
  arrastrando.value = null
  arrastreSobre.value = null
  if (!id) return
  const oferta = Object.values(props.porColumna)
    .flat()
    .find((o) => o.id === id)
  if (!oferta) return

  // Cerradas agrupa terminado + declinado, pero soltar ahí significa DECLINADO:
  // `terminado` lo pone el job diario cuando pasa la fecha_fin del PPA.
  const destino = col.alSoltar || col.value
  if (oferta.estado === destino) return

  // Firmar crea el contrato: no es un simple cambio de etapa.
  if (destino === 'firmado') {
    emit('firmar', oferta)
    return
  }
  if (destino === 'declinado') {
    emit('declinar', oferta)
    return
  }
  emit('mover', oferta, destino)
}
</script>

<template>
  <div class="flex items-start gap-3 overflow-x-auto pb-2">
    <div
      v-for="col in COLUMNAS"
      :key="col.value"
      class="tablero-col flex flex-shrink-0 flex-col rounded-lg border bg-muted/30"
      :class="colapsada(col) ? 'w-14' : 'w-[85vw] sm:w-[16.5rem]'"
      @dragover.prevent="arrastreSobre = col.value"
      @dragleave="arrastreSobre === col.value && (arrastreSobre = null)"
      @drop="soltar(col)"
    >
      <!-- Columna colapsada: solo el conteo, en vertical -->
      <button
        v-if="colapsada(col)"
        class="flex h-40 w-full flex-col items-center justify-center gap-2"
        @click="cerradasAbierta = true"
      >
        <span
          class="text-xs font-semibold text-muted-foreground"
          style="writing-mode: vertical-rl"
        >
          {{ col.label }}
        </span>
        <span class="text-xs font-semibold text-muted-foreground">{{ resumen(col).n }}</span>
      </button>

      <template v-else>
        <div
          class="flex items-center justify-between gap-1 border-b px-3 py-2"
          :class="arrastreSobre === col.value ? 'bg-primary/5' : ''"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span
                class="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                :style="{ background: colorEtapa(col.estados[0]) }"
              />
              <span class="truncate text-[11px] font-semibold tracking-wide text-foreground uppercase">{{
                col.label
              }}</span>
              <span class="text-[11px] text-muted-foreground">{{ resumen(col).n }}</span>
            </div>
            <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span v-if="resumen(col).energiaMwhMes">{{ fmtMwh(resumen(col).energiaMwhMes) }}</span>
              <span v-if="resumen(col).alertas" class="text-destructive">⚠ {{ resumen(col).alertas }}</span>
            </div>
          </div>
          <Button
            v-if="col.value === 'cerradas'"
            variant="ghost"
            size="icon-sm"
            aria-label="Colapsar"
            @click="cerradasAbierta = false"
          >
            <XIcon class="size-4" />
          </Button>
        </div>

        <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          <article
            v-for="of in filas(col)"
            :key="of.id"
            draggable="true"
            class="cursor-pointer rounded-md border bg-card p-2.5 transition-shadow hover:shadow-md"
            :class="of.id === ofertaAbiertaId ? 'ring-2 ring-primary' : ''"
            :style="{
              borderColor: of.alerta ? 'color-mix(in oklab, var(--destructive) 35%, transparent)' : undefined,
              opacity: arrastrando === of.id ? 0.45 : 1,
            }"
            @dragstart="arrastrando = of.id"
            @dragend="arrastrando = null"
            @click="emit('abrir', of)"
          >
            <div class="flex items-start justify-between gap-1.5">
              <span class="truncate font-mono text-[10px] text-muted-foreground">
                {{ of.codigo_seguimiento || of.numero_oferta || '—' }}
              </span>
              <GTooltip v-if="of.alerta">
                <GTooltipTrigger as-child>
                  <GBadge color="destructive" class="flex-shrink-0 scale-90"
                    >{{ of.dias_sin_respuesta }}d</GBadge
                  >
                </GTooltipTrigger>
                <GTooltipContent>{{ of.dias_sin_respuesta }} días sin movimiento en esta etapa</GTooltipContent>
              </GTooltip>
            </div>

            <h3 class="mt-1 text-sm leading-snug font-medium text-foreground">
              {{ of.planta_nombre || of.ficha?.proyecto_nombre || 'Sin planta' }}
            </h3>
            <p class="truncate text-xs text-muted-foreground">{{ of.cliente_razon_social }}</p>

            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <GTooltip>
                <GTooltipTrigger as-child>
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    :class="claseSegmento(of.tipo)"
                    >{{ segmentoTipo(of.tipo) }}</span
                  >
                </GTooltipTrigger>
                <GTooltipContent>{{ labelTipo(of.tipo) }}</GTooltipContent>
              </GTooltip>
              <span v-if="mwhMes(of)" class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{{
                fmtMwh(mwhMes(of))
              }}</span>
              <GTooltip v-if="of.ppa_contrato_id">
                <GTooltipTrigger as-child>
                  <span class="rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">PPA</span>
                </GTooltipTrigger>
                <GTooltipContent>Tiene contrato PPA</GTooltipContent>
              </GTooltip>
              <GTooltip v-if="(of.plantas?.length ?? 0) > 1">
                <GTooltipTrigger as-child>
                  <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >{{ of.plantas!.length }} plantas</span
                  >
                </GTooltipTrigger>
                <GTooltipContent>{{
                  of.plantas!.map((p) => p.nombre_comercial).join(' · ')
                }}</GTooltipContent>
              </GTooltip>
            </div>

            <div v-if="sinRespuesta(of) || of.seguimientos" class="mt-1.5 flex items-center gap-2 text-[10px]">
              <GTooltip v-if="of.seguimientos">
                <GTooltipTrigger as-child>
                  <span
                    class="inline-flex items-center gap-0.5"
                    :class="alarmante(of) ? 'font-semibold text-destructive' : 'text-muted-foreground'"
                  >
                    <SendIcon class="size-3" /> {{ of.seguimientos }}
                  </span>
                </GTooltipTrigger>
                <GTooltipContent>Toques enviados al cliente</GTooltipContent>
              </GTooltip>
              <span v-if="sinRespuesta(of)" class="text-destructive">sin respuesta</span>
            </div>
          </article>

          <p v-if="!filas(col).length" class="py-6 text-center text-xs text-muted-foreground/70">
            {{ arrastreSobre === col.value ? 'Soltar acá' : 'Vacío' }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* La altura de la columna se mide contra el chrome que tiene encima, y ese
   chrome no mide lo mismo en las dos puntas: en escritorio son el header, la
   banda de indicadores y UNA fila de filtros; en pantalla chica todo eso va
   apilado. Con el valor de escritorio fijo (20rem), en celular la columna
   quedaba como una ventanita con scroll dentro de una página que también
   scrollea — dos barras compitiendo por el mismo gesto.
   `dvh` en vez de `vh` para que la barra de direcciones del navegador móvil,
   que aparece y desaparece, no deje la columna cortada. */
.tablero-col {
  max-height: calc(100vh - 14rem);
  max-height: calc(100dvh - 14rem);
}
@media (min-width: 1024px) {
  .tablero-col {
    max-height: calc(100vh - 20rem);
  }
}
</style>
