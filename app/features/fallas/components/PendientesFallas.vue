<script setup lang="ts">
/**
 * Pestaña Pendientes de Gestión de Fallas: lo que queda esperando repuesto,
 * garantía o visita. Qué es pendiente lo decide el backend (`en_pendientes`);
 * esta vista no pide nada: recibe las fallas que ya cargó `MonitoreoView.vue`.
 */
import type { EquipoFalla, Falla } from '~/features/fallas/types'
import { ClipboardCheckIcon, ShieldCheckIcon } from '@lucide/vue'
import { colorEstado } from '~/features/fallas/utils/colores'
import { EQUIPOS_FALLA, ETIQUETA_EQUIPO, etiquetaEquipo } from '~/features/fallas/utils/equipo'
import { tituloFalla } from '~/features/fallas/utils/fallaTitulo'
import { formatoFechaDia } from '~/features/fallas/utils/formatoFecha'
import { etiquetaEstado } from '~/features/fallas/utils/grupoEstado'
import { fallasPendientes } from '~/features/fallas/utils/pendientes'

const props = defineProps<{ fallas: Falla[] }>()
const emit = defineEmits<{ abrir: [falla: Falla] }>()

const filtroEquipo = ref<EquipoFalla | null>(null)
const soloGarantia = ref(false)

const pendientes = computed(() => fallasPendientes(props.fallas))
/** Cada fila con su título y el detalle libre del subtipo, si el título no lo trae ya. */
const filas = computed(() =>
  fallasPendientes(pendientes.value, {
    equipo: filtroEquipo.value,
    soloGarantia: soloGarantia.value,
  }).map((falla) => {
    const titulo = tituloFalla(falla)
    const detalle = falla.subtipo_detalle?.trim()
    return { falla, titulo, detalle: detalle && !titulo.includes(detalle) ? detalle : null }
  }),
)

/** Los equipos que tienen alguna pendiente, con cuántas: los únicos que vale la pena ofrecer. */
const equiposConConteo = computed(() =>
  EQUIPOS_FALLA.map((equipo) => ({
    equipo,
    total: pendientes.value.filter((f) => f.equipo === equipo).length,
  })).filter((e) => e.total > 0),
)

const hayFiltros = computed(() => filtroEquipo.value != null || soloGarantia.value)

function limpiarFiltros() {
  filtroEquipo.value = null
  soloGarantia.value = false
}
</script>

<template>
  <div class="flex flex-col gap-3 p-3.5">
    <!-- Filtros rápidos -->
    <div class="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        :variant="filtroEquipo == null ? 'default' : 'outline'"
        @click="filtroEquipo = null"
      >
        Todos · {{ pendientes.length }}
      </Button>
      <Button
        v-for="e in equiposConConteo"
        :key="e.equipo"
        size="sm"
        :variant="filtroEquipo === e.equipo ? 'default' : 'outline'"
        @click="filtroEquipo = e.equipo"
      >
        {{ ETIQUETA_EQUIPO[e.equipo] }} · {{ e.total }}
      </Button>
      <label class="ml-auto flex items-center gap-2 text-sm text-foreground">
        <Checkbox v-model="soloGarantia" />
        Solo en garantía
      </label>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <Empty v-if="!filas.length" class="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{{ hayFiltros ? 'Nada con estos filtros' : 'No hay pendientes' }}</EmptyTitle>
          <EmptyDescription>
            {{
              hayFiltros
                ? 'Prueba con otro equipo o quita «Solo en garantía».'
                : 'Ninguna falla abierta está en garantía ni esperando tracker, string, medidor o estación.'
            }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent v-if="hayFiltros">
          <Button variant="ghost" size="sm" @click="limpiarFiltros">Limpiar filtros</Button>
        </EmptyContent>
      </Empty>

      <GTable v-else>
        <GTableHeader>
          <GTableRow>
            <GTableHead>Proyecto</GTableHead>
            <GTableHead>Equipo</GTableHead>
            <GTableHead>Qué es</GTableHead>
            <GTableHead>Garantía</GTableHead>
            <GTableHead>Estado</GTableHead>
            <GTableHead>Identificada</GTableHead>
            <GTableHead class="text-right">Días abierta</GTableHead>
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <GTableRow
            v-for="{ falla: f, titulo, detalle } in filas"
            :key="f.id"
            class="cursor-pointer"
            tabindex="0"
            @click="emit('abrir', f)"
            @keydown.enter="emit('abrir', f)"
          >
            <GTableCell class="font-semibold">{{ f.proyecto?.nombre_comercial || '—' }}</GTableCell>
            <GTableCell>{{ etiquetaEquipo(f.equipo) }}</GTableCell>
            <GTableCell>
              <div class="flex max-w-md flex-col">
                <TruncatedText :text="titulo" class="text-sm text-foreground" />
                <TruncatedText
                  v-if="detalle"
                  :text="detalle"
                  class="text-xs text-muted-foreground"
                />
                <code class="font-mono text-xs text-muted-foreground">{{ f.codigo_interno }}</code>
              </div>
            </GTableCell>
            <GTableCell>
              <div v-if="f.en_garantia" class="flex max-w-xs flex-col gap-0.5">
                <span class="flex items-center gap-1 text-sm font-semibold text-success">
                  <ShieldCheckIcon class="size-3.5" /> Sí
                </span>
                <TruncatedText
                  v-if="f.garantia_detalle"
                  :text="f.garantia_detalle"
                  class="text-xs text-muted-foreground"
                />
              </div>
              <span v-else class="text-sm text-muted-foreground">No</span>
            </GTableCell>
            <GTableCell>
              <GBadge :color="colorEstado(f.estado?.codigo)">{{ etiquetaEstado(f.estado) }}</GBadge>
            </GTableCell>
            <GTableCell class="whitespace-nowrap">{{
              formatoFechaDia(f.fecha_identificacion)
            }}</GTableCell>
            <GTableCell class="text-right font-semibold">{{
              f.dias_abierta != null ? `${f.dias_abierta} d` : '—'
            }}</GTableCell>
          </GTableRow>
        </GTableBody>
      </GTable>
    </div>
  </div>
</template>
