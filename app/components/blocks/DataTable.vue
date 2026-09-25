<script setup lang="ts" generic="T extends Record<string, unknown>">
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from '@lucide/vue'

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
  rows: T[]
  rowKey: (row: T) => string | number
  sort?: DataTableSort | null
  /** Cuando se pasan `page`/`pageSize`/`total`, el paginador aparece; ordenar y paginar quedan a cargo de quien use el componente (cliente o refetch al servidor). */
  page?: number
  pageSize?: number
  total?: number
  emptyMessage?: string
}>()

const emit = defineEmits<{
  'row-click': [row: T]
  'update:sort': [sort: DataTableSort]
  'update:page': [page: number]
}>()

defineSlots<{
  cell?: (props: { row: T; column: DataTableColumn }) => unknown
  empty?: () => unknown
}>()

const showPagination = computed(
  () =>
    props.page !== undefined && props.pageSize !== undefined && (props.total ?? 0) > props.pageSize,
)

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
    <GTable>
      <GTableHeader>
        <GTableRow>
          <GTableHead v-for="column in columns" :key="column.key" :class="column.class">
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex items-center gap-1 hover:text-foreground"
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
            <slot name="empty">{{ emptyMessage ?? 'Sin resultados.' }}</slot>
          </TableEmpty>
        </template>
        <template v-else>
          <GTableRow
            v-for="row in rows"
            :key="rowKey(row)"
            class="cursor-pointer"
            @click="emit('row-click', row)"
          >
            <GTableCell v-for="column in columns" :key="column.key" :class="column.class">
              <slot name="cell" :row="row" :column="column">{{ row[column.key] }}</slot>
            </GTableCell>
          </GTableRow>
        </template>
      </GTableBody>
    </GTable>

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
