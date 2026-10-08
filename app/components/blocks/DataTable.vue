<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from '@lucide/vue'

export type DataTableRow = Record<string, unknown>

export interface DataTableColumn {
  key: string
  header: string
  sortable?: boolean
  class?: string
}

export interface DataTableSort {
  key: string
  direction: 'asc' | 'desc'
}

const props = defineProps<{
  columns: DataTableColumn[]
  rows: DataTableRow[]
  /** Nombre de la propiedad que identifica cada fila (p. ej. `'id'`). Sin ella, se usa el índice. */
  rowKey?: string
  sort?: DataTableSort | null
  /** Cuando se pasan `page`/`pageSize`/`total`, el paginador aparece; ordenar y paginar quedan a cargo de quien use el componente (cliente o refetch al servidor). */
  page?: number
  pageSize?: number
  total?: number
  emptyMessage?: string
  /** Clases extra por fila (p. ej. resaltar las vencidas). */
  rowClass?: (row: DataTableRow) => HTMLAttributes['class']
  /** Mientras carga y no hay filas, un spinner en lugar del mensaje de vacío. */
  loading?: boolean
  /** Alto máximo (CSS): la tabla hace scroll por dentro y el encabezado queda fijo. */
  maxHeight?: string
  /** `table-layout: fixed`: las columnas se reparten el ancho y la tabla nunca lo excede. */
  fixedLayout?: boolean
  /** Opciones de filas por página; con ellas aparece el selector junto al paginador. */
  pageSizeOptions?: number[]
}>()

const emit = defineEmits<{
  'row-click': [row: DataTableRow]
  'update:sort': [sort: DataTableSort]
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
}>()

defineSlots<{
  cell?: (props: { row: DataTableRow; column: DataTableColumn }) => unknown
  empty?: () => unknown
}>()

const showPagination = computed(
  () =>
    props.page !== undefined && props.pageSize !== undefined && (props.total ?? 0) > props.pageSize,
)

const showPageSize = computed(
  () =>
    !!props.pageSizeOptions?.length &&
    props.pageSize !== undefined &&
    (props.total ?? 0) > Math.min(...props.pageSizeOptions),
)

const tableClass = computed(() => [
  props.maxHeight &&
    '[&_[data-slot=table-container]]:max-h-(--alto-tabla) [&_[data-slot=table-container]]:overflow-y-auto',
  props.fixedLayout && '[&_table]:table-fixed',
])

function toggleSort(column: DataTableColumn) {
  if (!column.sortable) return
  const direction: DataTableSort['direction'] =
    props.sort?.key === column.key && props.sort.direction === 'asc' ? 'desc' : 'asc'
  emit('update:sort', { key: column.key, direction })
}

function sortIcon(column: DataTableColumn) {
  if (props.sort?.key !== column.key) return ArrowUpDownIcon
  return props.sort.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <GTable :class="tableClass" :style="maxHeight ? { '--alto-tabla': maxHeight } : undefined">
      <GTableHeader :class="maxHeight ? 'sticky top-0 z-10' : undefined">
        <GTableRow>
          <GTableHead v-for="column in columns" :key="column.key" :class="column.class">
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
              @click="toggleSort(column)"
            >
              {{ column.header }}
              <component :is="sortIcon(column)" class="size-3.5" />
            </button>
            <template v-else>{{ column.header }}</template>
          </GTableHead>
        </GTableRow>
      </GTableHeader>
      <GTableBody>
        <template v-if="rows.length === 0">
          <TableEmpty :colspan="columns.length">
            <Spinner v-if="loading" class="mx-auto size-5" />
            <slot v-else name="empty">{{ emptyMessage ?? 'Sin resultados.' }}</slot>
          </TableEmpty>
        </template>
        <template v-else>
          <GTableRow
            v-for="(row, index) in rows"
            :key="rowKey ? String(row[rowKey]) : index"
            :class="['cursor-pointer', rowClass?.(row)]"
            @click="emit('row-click', row)"
          >
            <GTableCell v-for="column in columns" :key="column.key" :class="column.class">
              <slot name="cell" :row="row" :column="column">{{ row[column.key] }}</slot>
            </GTableCell>
          </GTableRow>
        </template>
      </GTableBody>
    </GTable>

    <div v-if="showPageSize" class="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      Filas por página
      <Select
        :model-value="String(pageSize)"
        @update:model-value="emit('update:pageSize', Number($event))"
      >
        <SelectTrigger size="sm" class="w-20"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opcion in pageSizeOptions" :key="opcion" :value="String(opcion)">
            {{ opcion }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Pagination
      v-if="showPagination"
      :page="page"
      :items-per-page="pageSize!"
      :total="total!"
      show-edges
      @update:page="emit('update:page', $event)"
    >
      <PaginationContent v-slot="{ items }">
        <PaginationPrevious />
        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            :is-active="item.value === page"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else />
        </template>
        <PaginationNext />
      </PaginationContent>
    </Pagination>
  </div>
</template>
