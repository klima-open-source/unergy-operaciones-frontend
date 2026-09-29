<script setup lang="ts">
import { EyeIcon, SearchIcon } from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
import { RegistrosCndService } from '~/features/registros-cnd/services/registros-cnd'
import type { ResumenRegistroCnd } from '~/features/registros-cnd/types'

const registrosCndService = new RegistrosCndService()
const router = useRouter()

const query = useQuery<ResumenRegistroCnd[]>()
const search = ref('')

const columns: DataTableColumn[] = [
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'avance', header: 'Avance', class: 'w-52' },
  { key: 'siguiente_paso', header: 'Siguiente paso' },
  { key: 'estado', header: '', class: 'w-44' },
]

const filtradas = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return query.data ?? []
  return (query.data ?? []).filter(
    (r) =>
      (r.nombre_comercial || '').toLowerCase().includes(q) ||
      (r.codigo_cnd || '').toLowerCase().includes(q),
  )
})

async function cargar() {
  await query.run(() => registrosCndService.listar())
}

function irDetalle(row: DataTableRow) {
  router.push(`/registros-cnd-asic/${asResumen(row).proyecto_id}`)
}

function asResumen(row: DataTableRow): ResumenRegistroCnd {
  return row as unknown as ResumenRegistroCnd
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Registros CND/ASIC" :subtitle="`${filtradas.length} proyecto(s)`">
      <template #actions>
        <InputGroup class="w-full sm:w-64">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput v-model="search" placeholder="Buscar proyecto…" />
        </InputGroup>
      </template>
    </PageHeader>

    <p class="text-xs text-muted-foreground">
      Aparecen todos los proyectos de la plataforma. Abre uno para ir llenando su información; su
      seguimiento se inicia automáticamente con todos los hitos en pendiente.
    </p>

    <div class="rounded-xl border bg-card">
      <AsyncView :query="query">
        <template #empty>
          <div class="py-12 text-center text-sm text-muted-foreground">Sin proyectos.</div>
        </template>

        <template #default>
          <div v-if="!filtradas.length" class="py-12 text-center text-sm text-muted-foreground">
            Sin resultados para «{{ search }}».
          </div>
          <DataTable
            v-else
            :columns="columns"
            :rows="filtradas as unknown as DataTableRow[]"
            row-key="proyecto_id"
            @row-click="irDetalle"
          >
            <template #cell="{ row, column }">
              <div v-if="column.key === 'proyecto'">
                <div class="font-medium text-foreground">{{ asResumen(row).nombre_comercial }}</div>
                <div class="text-xs text-muted-foreground">
                  {{
                    [
                      asResumen(row).codigo_cnd,
                      asResumen(row).clasificacion_regulatoria,
                      asResumen(row).tecnologia,
                      asResumen(row).operador_red,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }}
                </div>
              </div>

              <div v-else-if="column.key === 'avance'" class="flex items-center gap-2">
                <Progress
                  :model-value="Math.min(100, asResumen(row).avance_pct)"
                  class="h-2 flex-1"
                />
                <span class="w-10 text-right text-xs font-semibold text-primary">
                  {{ asResumen(row).avance_pct }}%
                </span>
              </div>

              <template v-else-if="column.key === 'siguiente_paso'">
                <GBadge v-if="asResumen(row).avance_pct >= 100" color="success">Completo</GBadge>
                <span v-else-if="asResumen(row).siguiente_paso" class="text-xs text-foreground">
                  <span class="font-mono font-semibold text-primary">{{
                    asResumen(row).siguiente_paso!.codigo
                  }}</span>
                  — {{ asResumen(row).siguiente_paso!.descripcion }}
                </span>
              </template>

              <div v-else-if="column.key === 'estado'" class="flex items-center justify-end gap-1">
                <GBadge v-if="!asResumen(row).tiene_registro" color="default">Sin iniciar</GBadge>
                <GBadge v-if="asResumen(row).alertas_pendientes" color="warning">
                  {{ asResumen(row).alertas_pendientes }} alerta(s)
                </GBadge>
                <GBadge v-if="asResumen(row).bloqueos" color="destructive">
                  {{ asResumen(row).bloqueos }} bloqueo(s)
                </GBadge>
                <Button variant="ghost" size="icon-sm" @click.stop="irDetalle(row)">
                  <EyeIcon />
                </Button>
              </div>
            </template>
          </DataTable>
        </template>
      </AsyncView>
    </div>
  </div>
</template>
