<!--
  Segunda vista: la misma información en tabla, para filtrar en volumen y
  exportar. Click en la fila abre el DRAWER de la oferta — antes navegaba a la
  ficha del cliente y perdías de vista la oferta que habías clickeado.
-->
<script setup lang="ts">
import type {
  DataTableColumn,
  DataTableRow,
  DataTableSort,
} from '~/components/blocks/DataTable.vue'
import type { Oferta } from '~/features/comercial/types'
import { FileSpreadsheetIcon, LoaderCircleIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { type ColumnaExportable, exportarExcel } from '~/utils/exportarExcel'
import {
  alarmante,
  diasDesde,
  fmtFecha,
  fmtMwh,
  labelEtapa,
  labelTipo,
  mesDelCodigo,
  mwhMes,
  severidadEtapa,
} from './comercial'

const props = withDefaults(defineProps<{ ofertas?: Oferta[] }>(), { ofertas: () => [] })
const emit = defineEmits<{ abrir: [oferta: Oferta] }>()

function asOferta(row: DataTableRow): Oferta {
  return row as unknown as Oferta
}

const columnas: DataTableColumn[] = [
  { key: 'codigo_seguimiento', header: 'Código', sortable: true },
  { key: 'estado', header: 'Etapa', sortable: true },
  { key: 'planta_nombre', header: 'Planta', sortable: true },
  { key: 'cliente_razon_social', header: 'Cliente', sortable: true },
  { key: 'tipo', header: 'Tipo', sortable: true },
  { key: 'energia', header: 'Energía', sortable: true },
  { key: 'municipio', header: 'Municipio', sortable: true },
  { key: 'precio_detalle', header: 'Precio' },
  { key: 'fecha_oferta', header: 'Enviada', sortable: true },
  { key: 'seguimientos', header: 'Toques', sortable: true },
  { key: 'fecha_ultima_respuesta', header: 'Última respuesta', sortable: true },
  { key: 'contrato', header: 'Contrato' },
  { key: 'alerta', header: '' },
]

// Paginado y ordenado 100% en cliente: las ofertas ya están todas en memoria
// (`useOfertas`), así que no hay ningún refetch que disparar al cambiar de
// página u ordenar — es el mismo patrón de `AdminUsuariosView.vue`.
const sort = ref<DataTableSort | null>(null)
const pagination = usePagination(25)

function valorOrdenable(o: Oferta, key: string): string | number {
  switch (key) {
    case 'estado':
      return labelEtapa(o.estado)
    case 'tipo':
      return labelTipo(o.tipo)
    case 'energia':
      return mwhMes(o)
    case 'municipio':
      return o.ficha?.municipio || ''
    case 'fecha_oferta':
      return o.fecha_oferta ? new Date(o.fecha_oferta).getTime() : 0
    case 'fecha_ultima_respuesta':
      return o.fecha_ultima_respuesta ? new Date(o.fecha_ultima_respuesta).getTime() : 0
    case 'seguimientos':
      return o.seguimientos || 0
    default:
      return String((o as unknown as Record<string, unknown>)[key] ?? '')
  }
}

const ordenadas = computed(() => {
  if (!sort.value) return props.ofertas
  const { key, direction } = sort.value
  const factor = direction === 'asc' ? 1 : -1
  return [...props.ofertas].sort((a, b) => {
    const left = valorOrdenable(a, key)
    const right = valorOrdenable(b, key)
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right), 'es') * factor
  })
})

const paginadas = computed(() =>
  ordenadas.value.slice(
    pagination.offset.value,
    pagination.offset.value + pagination.pageSize.value,
  ),
)

watch(
  ordenadas,
  (rows) => {
    pagination.total.value = rows.length
  },
  { immediate: true },
)

// Un cambio en los filtros de arriba puede dejar la página actual vacía.
watch(
  () => props.ofertas,
  () => pagination.reset(),
)

const exportando = ref(false)

const COLUMNAS_EXCEL: ColumnaExportable<Oferta>[] = [
  { header: 'Código de seguimiento', value: (o) => o.codigo_seguimiento || o.numero_oferta || '' },
  { header: 'Etapa', value: (o) => labelEtapa(o.estado) },
  { header: 'Cliente', value: (o) => o.cliente_razon_social || '' },
  { header: 'NIT', value: (o) => o.cliente_nit || '' },
  { header: 'Planta', value: (o) => o.planta_nombre || o.ficha?.proyecto_nombre || '' },
  {
    header: 'Plantas del contrato',
    value: (o) => (o.plantas || []).map((p) => p.nombre_comercial).join(' · '),
  },
  { header: 'Tipo', value: (o) => labelTipo(o.tipo) },
  { header: 'Municipio', value: (o) => o.ficha?.municipio || '' },
  { header: 'Departamento', value: (o) => o.ficha?.departamento || '' },
  { header: 'Operador de red', value: (o) => o.ficha?.operador_red || '' },
  { header: 'Energía estimada (MWh/mes)', value: (o) => mwhMes(o) || '' },
  { header: 'Precio', value: (o) => o.precio_detalle || '' },
  { header: 'Enviada', value: (o) => o.fecha_oferta || '' },
  { header: 'Toques', value: (o) => o.seguimientos || 0 },
  { header: 'Última respuesta', value: (o) => o.fecha_ultima_respuesta || '' },
  { header: 'Días sin movimiento', value: (o) => o.dias_sin_respuesta ?? '' },
  { header: 'Contrato PPA', value: (o) => o.ppa_contrato_id || '' },
]

async function exportar() {
  exportando.value = true
  try {
    // Se exporta lo que estás viendo (ya filtrado y ordenado), no la tabla entera.
    const hoy = new Date().toISOString().slice(0, 10)
    await exportarExcel(props.ofertas, COLUMNAS_EXCEL, `comercial_ofertas_${hoy}`, 'Ofertas')
  } catch (err) {
    const e = normalizeError(err)
    logger.error('comercial.exportar', e)
    toast.error('No se pudo exportar', { description: e.message })
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="text-xs text-muted-foreground">{{ ofertas.length }} ofertas</span>
      <Button variant="outline" size="sm" :disabled="exportando" @click="exportar">
        <LoaderCircleIcon v-if="exportando" class="animate-spin" />
        <FileSpreadsheetIcon v-else class="size-4" />
        Excel
      </Button>
    </div>

    <DataTable
      :columns="columnas"
      :rows="paginadas as unknown as DataTableRow[]"
      row-key="id"
      :sort="sort"
      :page="pagination.page.value"
      :page-size="pagination.pageSize.value"
      :total="pagination.total.value"
      empty-message="No hay ofertas con esos filtros."
      @row-click="(row) => emit('abrir', asOferta(row))"
      @update:sort="sort = $event"
      @update:page="pagination.goTo($event)"
    >
      <template #cell="{ row, column }">
        <template v-if="column.key === 'codigo_seguimiento'">
          <span class="font-mono text-xs">{{
            asOferta(row).codigo_seguimiento || asOferta(row).numero_oferta || '—'
          }}</span>
        </template>
        <template v-else-if="column.key === 'estado'">
          <GBadge :color="severidadEtapa(asOferta(row).estado)">{{
            labelEtapa(asOferta(row).estado)
          }}</GBadge>
        </template>
        <template v-else-if="column.key === 'planta_nombre'">
          <div class="flex items-center gap-1.5">
            <span>{{
              asOferta(row).planta_nombre || asOferta(row).ficha?.proyecto_nombre || '—'
            }}</span>
            <GTooltip v-if="(asOferta(row).plantas?.length ?? 0) > 1">
              <GTooltipTrigger as-child>
                <span class="rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                  +{{ asOferta(row).plantas!.length - 1 }}
                </span>
              </GTooltipTrigger>
              <GTooltipContent>{{
                asOferta(row)
                  .plantas!.map((p) => p.nombre_comercial)
                  .join(' · ')
              }}</GTooltipContent>
            </GTooltip>
          </div>
        </template>
        <template v-else-if="column.key === 'cliente_razon_social'">
          {{ asOferta(row).cliente_razon_social }}
        </template>
        <template v-else-if="column.key === 'tipo'">{{ labelTipo(asOferta(row).tipo) }}</template>
        <!-- Energía: MWh/mes derivado de kWh crudo -->
        <template v-else-if="column.key === 'energia'">
          <span v-if="mwhMes(asOferta(row))">{{ fmtMwh(mwhMes(asOferta(row))) }}</span>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'municipio'">
          {{ asOferta(row).ficha?.municipio || '—' }}
        </template>
        <template v-else-if="column.key === 'precio_detalle'">
          {{ asOferta(row).precio_detalle || '—' }}
        </template>
        <template v-else-if="column.key === 'fecha_oferta'">
          <span v-if="asOferta(row).fecha_oferta" :title="fmtFecha(asOferta(row).fecha_oferta)">
            hace {{ diasDesde(asOferta(row).fecha_oferta) }} d
          </span>
          <!-- Sin fecha registrada, el mes vive dentro del propio código. Se
               muestra como aproximado y no se guarda nada. -->
          <GTooltip v-else-if="mesDelCodigo(asOferta(row))">
            <GTooltipTrigger as-child>
              <span class="text-muted-foreground/60">≈ {{ mesDelCodigo(asOferta(row)) }}</span>
            </GTooltipTrigger>
            <GTooltipContent
              >Aproximado: sale del mes que trae el código, no de una fecha
              registrada</GTooltipContent
            >
          </GTooltip>
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'seguimientos'">
          <span :class="alarmante(asOferta(row)) ? 'font-semibold text-destructive' : ''">
            {{ asOferta(row).seguimientos || 0 }}
          </span>
        </template>
        <template v-else-if="column.key === 'fecha_ultima_respuesta'">
          <span v-if="asOferta(row).fecha_ultima_respuesta">{{
            fmtFecha(asOferta(row).fecha_ultima_respuesta)
          }}</span>
          <span v-else-if="asOferta(row).fecha_oferta" class="text-xs text-destructive"
            >sin respuesta</span
          >
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'contrato'">
          <NuxtLink
            v-if="asOferta(row).ppa_contrato_id"
            :to="`/contratos/${asOferta(row).ppa_contrato_id}`"
            class="text-xs text-primary underline"
            @click.stop
            >PPA</NuxtLink
          >
          <span v-else class="text-muted-foreground/60">—</span>
        </template>
        <template v-else-if="column.key === 'alerta'">
          <GBadge v-if="asOferta(row).alerta" color="destructive" class="scale-90"
            >⚠ {{ asOferta(row).dias_sin_respuesta }}d</GBadge
          >
        </template>
      </template>
    </DataTable>
  </div>
</template>
