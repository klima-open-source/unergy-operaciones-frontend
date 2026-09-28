<script setup lang="ts">
/**
 * Clasificación de liquidación por período: qué tipo (normal/NEU/NITRO) le
 * aplica a cada proyecto. Define cómo se leen los ingresos del ER al cargarlo.
 * Autosuficiente: no comparte estado con las demás pestañas.
 */
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import { InfoIcon, SaveIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { OPCIONES_TIPO_LIQUIDACION } from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import type { ClasificacionProyecto, TipoLiquidacion } from '~/features/panel-contable/types'

const props = defineProps<{
  periodo: string
  periodoLabel: string
}>()

const panelContableService = new PanelContableService()

const proyectos = ref<ClasificacionProyecto[]>([])
const busqueda = ref('')
const cargando = ref(false)
const guardando = ref(false)
const sucio = ref(false)

const columns: DataTableColumn[] = [
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'tipo', header: 'Tipo de liquidación' },
]

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return proyectos.value
  return proyectos.value.filter((c) => (c.proyecto || '').toLowerCase().includes(q))
})

function asFila(row: DataTableRow): ClasificacionProyecto {
  return row as unknown as ClasificacionProyecto
}

function actualizarTipo(fila: ClasificacionProyecto, valor: unknown) {
  if (typeof valor !== 'string' || !valor) return
  fila.tipo = valor as TipoLiquidacion
  sucio.value = true
}

async function cargar() {
  cargando.value = true
  sucio.value = false
  try {
    const data = await panelContableService.obtenerClasificacion(props.periodo)
    proyectos.value = (data.proyectos || []).map((p) => ({ ...p }))
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo cargar la clasificación', {
      description: normalizeError(err).message,
      duration: 4000,
    })
  } finally {
    cargando.value = false
  }
}

async function guardar() {
  guardando.value = true
  try {
    await panelContableService.guardarClasificacion({
      periodo: props.periodo,
      asignaciones: proyectos.value.map((c) => ({ proyecto_id: c.proyecto_id, tipo: c.tipo })),
    })
    sucio.value = false
    toast.success('Clasificación guardada', { description: props.periodoLabel, duration: 3000 })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo guardar la clasificación', {
      description: normalizeError(err).message,
      duration: 4000,
    })
  } finally {
    guardando.value = false
  }
}

watch(() => props.periodo, cargar, { immediate: true })
</script>

<template>
  <div class="rounded-xl border bg-card">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <h3 class="text-xs font-semibold tracking-wide text-primary uppercase">
        Clasificación de liquidación · {{ periodoLabel }}
      </h3>
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="busqueda" class="w-52" placeholder="Buscar proyecto…" />
        <Button :disabled="guardando || !sucio" @click="guardar">
          <SaveIcon class="size-4" />
          Guardar clasificación
        </Button>
      </div>
    </div>

    <div
      class="flex items-start gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground"
    >
      <InfoIcon class="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        La clasificación es <b class="text-foreground">por período</b> — un proyecto puede cambiar
        de tipo entre meses. El tipo define cómo se leen los ingresos del ER al cargarlo.
      </p>
    </div>

    <div v-if="cargando" class="flex justify-center p-8">
      <Spinner class="size-6 text-muted-foreground" />
    </div>
    <div v-else-if="!filtrados.length" class="p-6 text-center text-sm text-muted-foreground">
      Sin proyectos.
    </div>

    <DataTable
      v-else
      :columns="columns"
      :rows="filtrados as unknown as DataTableRow[]"
      row-key="proyecto_id"
    >
      <template #cell="{ row, column }">
        <span v-if="column.key === 'proyecto'" class="font-medium text-foreground">{{
          asFila(row).proyecto
        }}</span>
        <ToggleGroup
          v-else-if="column.key === 'tipo'"
          :model-value="asFila(row).tipo"
          type="single"
          variant="outline"
          size="sm"
          @update:model-value="actualizarTipo(asFila(row), $event)"
        >
          <ToggleGroupItem
            v-for="op in OPCIONES_TIPO_LIQUIDACION"
            :key="op.value"
            :value="op.value"
            >{{ op.label }}</ToggleGroupItem
          >
        </ToggleGroup>
      </template>
    </DataTable>
  </div>
</template>
