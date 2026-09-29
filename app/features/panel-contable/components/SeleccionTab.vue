<script setup lang="ts">
/**
 * Selección de liquidación: qué proyectos liquidar (ingresos/costos/mandatos)
 * y los consecutivos de Ingresos/Costos (solo en Oficial — la preliquidación
 * no lleva; el mandato oficial es la diferencia). También el mapeo de celdas
 * del ER (Ingresos/Comercialización, lo único que aún viene del Excel).
 */
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import { ChevronRightIcon } from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import {
  type LineaPanel,
  type PanelContable,
  type RespuestaConsecutivosUsados,
  TipoPanel,
} from '~/features/panel-contable/types'
import { lineasMapeables } from '~/features/panel-contable/utils/formatters'
import { formatCOP } from '~/utils/currency'

const props = defineProps<{
  paneles: PanelContable[]
  panelesFiltrados: PanelContable[]
  consInfo: RespuestaConsecutivosUsados | null
  consIngIni: number
  consCosIni: number
  cargaError: boolean
  periodoLabel: string
}>()

const tipo = defineModel<TipoPanel>('tipo', { required: true })

const emit = defineEmits<{
  reintentar: []
  'sel-all': [campo: 'liquidar_ingresos' | 'liquidar_costos' | 'generar_mandatos', val: boolean]
  'sel-ninguno': []
  'flag-changed': [panel: PanelContable]
  'cambiar-consecutivo': [cadena: 'ing' | 'cos', valor: number]
  'usar-siguiente': [cadena: 'ing' | 'cos']
  'celda-cambiada': [panel: PanelContable, linea: LineaPanel, texto: string]
}>()

const columns: DataTableColumn[] = [
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'inversionistas', header: 'Inversionistas' },
  { key: 'ingreso_bruto', header: 'Ingreso bruto' },
  { key: 'liquidar_ingresos', header: 'Liq. Ingresos' },
  { key: 'liquidar_costos', header: 'Liq. Costos' },
  { key: 'generar_mandatos', header: 'Generar mandatos' },
]

function asPanel(row: DataTableRow): PanelContable {
  return row as unknown as PanelContable
}

const nLiqIng = computed(() => props.paneles.filter((p) => p.liquidar_ingresos).length)
const nLiqCost = computed(() => props.paneles.filter((p) => p.liquidar_costos).length)
const nGeneran = computed(() => props.paneles.filter((p) => p.generar_mandatos).length)

// ── Mapeo de celdas del ER ──
const mapeoOpen = reactive<Record<number, boolean>>({})
function toggleMapeo(id: number) {
  mapeoOpen[id] = !mapeoOpen[id]
}
</script>

<template>
  <div class="space-y-3.5">
    <div class="rounded-xl border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h3 class="text-xs font-semibold tracking-wide text-primary uppercase">
          Selección de liquidación
        </h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">Tipo:</span>
          <ToggleGroup v-model="tipo" type="single" variant="outline" size="sm">
            <ToggleGroupItem :value="TipoPanel.PRELIQUIDACION">Preliquidación</ToggleGroupItem>
            <ToggleGroupItem :value="TipoPanel.OFICIAL">Oficial</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <span class="text-xs text-muted-foreground">
          Marca qué liquidar; el detalle contable está en las pestañas Preliquidación / Oficial.
        </span>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="emit('sel-all', 'liquidar_ingresos', true)"
            >Liq. ingresos todos</Button
          >
          <Button variant="outline" size="sm" @click="emit('sel-all', 'liquidar_costos', true)"
            >Liq. costos todos</Button
          >
          <Button variant="outline" size="sm" @click="emit('sel-ninguno')">Ninguno</Button>
          <Button variant="outline" size="sm" @click="emit('sel-all', 'generar_mandatos', true)"
            >Generar todos</Button
          >
        </div>
      </div>

      <div v-if="cargaError" class="p-6 text-center text-sm text-muted-foreground">
        No se pudieron cargar los paneles de {{ periodoLabel }} (error de conexión).
        <Button variant="outline" size="sm" class="ml-2" @click="emit('reintentar')"
          >Reintentar</Button
        >
      </div>

      <div v-else-if="!paneles.length" class="p-6 text-center text-sm text-muted-foreground">
        No hay paneles para {{ periodoLabel }}. Carga uno o varios archivos ER.
      </div>

      <DataTable
        v-else
        :columns="columns"
        :rows="panelesFiltrados as unknown as DataTableRow[]"
        row-key="id"
      >
        <template #cell="{ row, column }">
          <template v-if="column.key === 'proyecto'">
            <span class="font-medium text-foreground">{{ asPanel(row).proyecto }}</span>
            <GBadge v-if="!asPanel(row).tiene_costos" color="warning" class="ml-1.5"
              >sin costos</GBadge
            >
            <GBadge v-if="asPanel(row).tiene_bolsa" color="information" class="ml-1.5"
              >bolsa</GBadge
            >
          </template>
          <span v-else-if="column.key === 'inversionistas'" class="text-xs text-muted-foreground">{{
            asPanel(row)
              .inversionistas.map((i) => i.nombre)
              .join(', ')
          }}</span>
          <span v-else-if="column.key === 'ingreso_bruto'" class="tabular-nums">{{
            formatCOP(asPanel(row).ingreso_bruto_cop)
          }}</span>
          <Checkbox
            v-else-if="column.key === 'liquidar_ingresos'"
            :model-value="!!asPanel(row).liquidar_ingresos"
            @update:model-value="
              (v) => {
                asPanel(row).liquidar_ingresos = !!v
                emit('flag-changed', asPanel(row))
              }
            "
          />
          <Checkbox
            v-else-if="column.key === 'liquidar_costos'"
            :model-value="!!asPanel(row).liquidar_costos"
            :title="
              !asPanel(row).tiene_costos
                ? 'Este mes el ER no trajo costos; puedes marcarlo igual (los costos pueden venir de la vista de costos)'
                : undefined
            "
            @update:model-value="
              (v) => {
                asPanel(row).liquidar_costos = !!v
                emit('flag-changed', asPanel(row))
              }
            "
          />
          <Checkbox
            v-else-if="column.key === 'generar_mandatos'"
            :model-value="!!asPanel(row).generar_mandatos"
            @update:model-value="
              (v) => {
                asPanel(row).generar_mandatos = !!v
                emit('flag-changed', asPanel(row))
              }
            "
          />
        </template>
      </DataTable>

      <!-- Consecutivos: SOLO en oficial (la preliquidación no lleva; el mandato
           oficial = la diferencia). Únicos globalmente por cadena. -->
      <div
        v-if="tipo === TipoPanel.OFICIAL"
        class="flex flex-wrap items-end gap-4 border-t bg-muted/30 px-4 py-3"
      >
        <Field>
          <FieldLabel class="text-xs font-normal text-muted-foreground"
            >Consecutivo Ingresos inicial</FieldLabel
          >
          <NumberField
            :model-value="consIngIni"
            @update:model-value="(v) => emit('cambiar-consecutivo', 'ing', v ?? 0)"
          >
            <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
          </NumberField>
          <FieldDescription
            v-if="consInfo && consInfo.ingresos.usados.includes(consIngIni)"
            class="text-destructive"
          >
            {{ consIngIni }} ya está usado —
            <Button
              variant="link"
              size="sm"
              class="h-auto p-0"
              @click="emit('usar-siguiente', 'ing')"
              >usar {{ consInfo.ingresos.siguiente }}</Button
            >
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel class="text-xs font-normal text-muted-foreground"
            >Consecutivo Costos inicial</FieldLabel
          >
          <NumberField
            :model-value="consCosIni"
            @update:model-value="(v) => emit('cambiar-consecutivo', 'cos', v ?? 0)"
          >
            <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
          </NumberField>
          <FieldDescription
            v-if="consInfo && consInfo.costos.usados.includes(consCosIni)"
            class="text-destructive"
          >
            {{ consCosIni }} ya está usado —
            <Button
              variant="link"
              size="sm"
              class="h-auto p-0"
              @click="emit('usar-siguiente', 'cos')"
              >usar {{ consInfo.costos.siguiente }}</Button
            >
          </FieldDescription>
        </Field>
        <p class="max-w-xs text-xs text-muted-foreground">
          Ingresos y costos numeran por separado y son únicos globalmente (no se repiten entre
          períodos).
          <template v-if="consInfo">
            Siguiente libre: Ing <b class="text-foreground">{{ consInfo.ingresos.siguiente }}</b> ·
            Cost <b class="text-foreground">{{ consInfo.costos.siguiente }}</b
            >.
          </template>
        </p>
        <p class="ml-auto text-xs text-muted-foreground">
          <b class="text-foreground">{{ nLiqIng }}</b> liq. ingresos ·
          <b class="text-foreground">{{ nLiqCost }}</b> liq. costos ·
          <b class="text-foreground">{{ nGeneran }}</b> generan mandatos
        </p>
      </div>
      <p v-else class="border-t px-4 py-2.5 text-xs text-muted-foreground">
        La preliquidación no lleva consecutivos — se asignan en el panel
        <b class="text-foreground">oficial</b> (el mandato = la diferencia).
      </p>
    </div>

    <!-- Mapeo de celdas del ER: solo aplica a Ingresos / Comercialización (lo que aún viene del ER). -->
    <div v-if="paneles.length" class="rounded-xl border bg-card">
      <div class="border-b px-4 py-3">
        <h3 class="text-xs font-semibold tracking-wide text-primary uppercase">
          Mapeo de celdas del ER
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Corrige a qué celda del ER apunta un concepto de Ingresos / Comercialización.
        </p>
      </div>
      <div v-for="p in panelesFiltrados" :key="'m' + p.id" class="border-b last:border-b-0">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40"
          @click="toggleMapeo(p.id)"
        >
          <ChevronRightIcon
            class="size-3.5 text-muted-foreground transition-transform"
            :class="{ 'rotate-90': mapeoOpen[p.id] }"
          />
          <b class="text-sm text-foreground">{{ p.proyecto }}</b>
        </button>
        <div v-show="mapeoOpen[p.id]" class="overflow-x-auto px-4 pb-3">
          <GTable>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Concepto</GTableHead>
                <GTableHead>Celda (hoja!celda)</GTableHead>
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <GTableRow
                v-for="ln in lineasMapeables(p.total_100)"
                :key="ln.grupo + '|' + ln.concepto"
              >
                <GTableCell>{{ ln.concepto }}</GTableCell>
                <GTableCell>
                  <Input
                    :model-value="ln.origen"
                    placeholder="hoja!celda"
                    @change="
                      emit('celda-cambiada', p, ln, ($event.target as HTMLInputElement).value)
                    "
                  />
                </GTableCell>
              </GTableRow>
              <GTableRow v-if="!lineasMapeables(p.total_100).length">
                <GTableCell colspan="2" class="text-muted-foreground"
                  >Sin conceptos mapeables.</GTableCell
                >
              </GTableRow>
            </GTableBody>
          </GTable>
        </div>
      </div>
    </div>
  </div>
</template>
