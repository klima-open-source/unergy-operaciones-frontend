<script setup lang="ts">
import type {
  AlertasContratosPpa,
  ContratoDuplicadoPpa,
  ProyectoHuerfanoPpa,
} from '~/features/alertas/types'
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  UserMinusIcon,
  ZapIcon,
} from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `DataTable` y `typecheck` falla (ver `AdminUsuariosView.vue`).
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
import { logger } from '~/core/logger'
import { AlertasService } from '~/features/alertas/services/alertas'

function asHuerfano(row: DataTableRow) {
  return row as unknown as ProyectoHuerfanoPpa
}
function asSic(row: DataTableRow) {
  return row as unknown as ContratoDuplicadoPpa
}

const alertasService = new AlertasService()
const router = useRouter()

const query = useQuery<AlertasContratosPpa>()

function estadoColor(e: string | undefined) {
  return (
    { en_operacion: 'success', en_desarrollo: 'information', suspendido: 'warning' }[e ?? ''] ??
    'default'
  )
}

function tipoColor(t: string | undefined) {
  return (
    {
      registro: 'success',
      modificacion: 'information',
      terminacion: 'destructive',
      desistimiento: 'warning',
    }[t ?? ''] ?? 'default'
  )
}

const columnasHuerfanos: DataTableColumn[] = [
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'tipo', header: 'Tipo' },
  { key: 'estado', header: 'Estado' },
  { key: 'acciones', header: '' },
]

const columnasSics: DataTableColumn[] = [
  { key: 'codigo_sic_contrato', header: 'SIC' },
  { key: 'contrato_interno', header: 'Contrato' },
  { key: 'tipo', header: 'Tipo' },
  { key: 'fecha_inicio', header: 'Inicio' },
  { key: 'fecha_fin', header: 'Fin' },
  { key: 'porcentaje_fncer', header: '% Desp.' },
  { key: 'acciones', header: '' },
]

async function cargar() {
  await query.run(() => alertasService.obtenerContratosPpa())
  if (query.error) logger.error('alertas', query.error)
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon-sm" @click="router.back()">
        <ArrowLeftIcon class="size-4" />
      </Button>
      <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
        <ZapIcon class="size-4 text-warning" />
      </div>
      <div>
        <h2 class="text-xl font-bold">Alertas — Contratos PPA</h2>
        <p v-if="query.data?.fecha_consulta" class="mt-0.5 text-xs text-muted-foreground">
          Fecha de consulta: {{ query.data.fecha_consulta }}
        </p>
      </div>
    </div>

    <AsyncView :query="query">
      <template #default="{ data }">
        <div class="space-y-6">
          <!-- Resumen -->
          <div class="grid grid-cols-2 gap-4">
            <Card class="border-warning/20 bg-warning/5">
              <CardContent class="flex items-center gap-4">
                <div
                  class="flex size-12 shrink-0 items-center justify-center rounded-full bg-warning/10"
                >
                  <UserMinusIcon class="size-5 text-warning" />
                </div>
                <div>
                  <p class="text-2xl font-bold text-warning">{{ data.huerfanos.length }}</p>
                  <p class="text-sm font-medium">Proyectos huérfanos</p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    Sin contrato activo en GESCON hoy
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card class="border-destructive/20 bg-destructive/5">
              <CardContent class="flex items-center gap-4">
                <div
                  class="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/10"
                >
                  <CopyIcon class="size-5 text-destructive" />
                </div>
                <div>
                  <p class="text-2xl font-bold text-destructive">{{ data.duplicados.length }}</p>
                  <p class="text-sm font-medium">Proyectos duplicados</p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    Asociados a 2+ contratos activos a la vez
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- ── Sección Huérfanos ── -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UserMinusIcon class="size-4 text-warning" />
              <h3 class="font-semibold">Proyectos huérfanos</h3>
              <GBadge color="warning">{{ data.huerfanos.length }}</GBadge>
            </div>
            <p class="text-xs text-muted-foreground">
              Proyectos que no aparecen en ningún contrato activo del GESCON hoy. Pueden estar
              pendientes de registro o sus contratos haber vencido/terminado.
            </p>

            <div
              v-if="data.huerfanos.length === 0"
              class="flex flex-col items-center gap-2 py-8 text-muted-foreground"
            >
              <CircleCheckIcon class="size-8 text-success" />
              <p class="text-sm">Todos los proyectos tienen contrato activo en GESCON.</p>
            </div>

            <DataTable
              v-else
              :columns="columnasHuerfanos"
              :rows="data.huerfanos"
              row-key="proyecto_id"
            >
              <template #cell="{ row, column }">
                <NuxtLink
                  v-if="column.key === 'proyecto'"
                  :to="`/proyectos/${asHuerfano(row).proyecto_id}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ asHuerfano(row).nombre_comercial }}
                </NuxtLink>
                <GBadge v-else-if="column.key === 'tipo'">{{
                  asHuerfano(row).tipo_proyecto || '—'
                }}</GBadge>
                <GBadge
                  v-else-if="column.key === 'estado'"
                  :color="estadoColor(asHuerfano(row).estado)"
                >
                  {{ asHuerfano(row).estado }}
                </GBadge>
                <GTooltip v-else-if="column.key === 'acciones'">
                  <GTooltipTrigger as-child>
                    <Button variant="ghost" size="icon-sm" as-child>
                      <NuxtLink :to="`/proyectos/${asHuerfano(row).proyecto_id}/ppa`">
                        <ZapIcon class="size-4 text-warning" />
                      </NuxtLink>
                    </Button>
                  </GTooltipTrigger>
                  <GTooltipContent>Ver PPA</GTooltipContent>
                </GTooltip>
              </template>
            </DataTable>
          </div>

          <Separator />

          <!-- ── Sección Duplicados ── -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <CopyIcon class="size-4 text-destructive" />
              <h3 class="font-semibold">Proyectos duplicados</h3>
              <GBadge color="destructive">{{ data.duplicados.length }}</GBadge>
            </div>
            <p class="text-xs text-muted-foreground">
              Proyectos que están activos en 2 o más contratos GESCON simultáneamente. Revisar si
              los porcentajes de despacho suman 100&nbsp;% o si es un error de registro.
            </p>

            <div
              v-if="data.duplicados.length === 0"
              class="flex flex-col items-center gap-2 py-8 text-muted-foreground"
            >
              <CircleCheckIcon class="size-8 text-success" />
              <p class="text-sm">No hay proyectos con contratos duplicados.</p>
            </div>

            <div v-else class="space-y-4">
              <Card v-for="dup in data.duplicados" :key="dup.proyecto_id">
                <CardContent class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <NuxtLink
                        :to="`/proyectos/${dup.proyecto_id}`"
                        class="font-semibold hover:text-primary"
                      >
                        {{ dup.nombre_comercial }}
                      </NuxtLink>
                      <GBadge>{{ dup.tipo_proyecto || '—' }}</GBadge>
                    </div>
                    <GBadge color="destructive">{{ dup.sics.length }} contratos activos</GBadge>
                  </div>

                  <DataTable :columns="columnasSics" :rows="dup.sics" row-key="codigo_sic_contrato">
                    <template #cell="{ row, column }">
                      <GBadge
                        v-if="column.key === 'tipo'"
                        :color="tipoColor(asSic(row).tipo_solicitud)"
                      >
                        {{ asSic(row).tipo_solicitud }}
                      </GBadge>
                      <span v-else-if="column.key === 'fecha_inicio'">{{
                        asSic(row).fecha_inicio || '—'
                      }}</span>
                      <span v-else-if="column.key === 'fecha_fin'">{{
                        asSic(row).fecha_fin || '—'
                      }}</span>
                      <span v-else-if="column.key === 'porcentaje_fncer'">
                        {{
                          asSic(row).porcentaje_fncer != null
                            ? `${asSic(row).porcentaje_fncer}%`
                            : '—'
                        }}
                      </span>
                      <GTooltip v-else-if="column.key === 'acciones'">
                        <GTooltipTrigger as-child>
                          <Button variant="ghost" size="icon-sm" as-child>
                            <NuxtLink to="/mem/gescon">
                              <ExternalLinkIcon class="size-4" />
                            </NuxtLink>
                          </Button>
                        </GTooltipTrigger>
                        <GTooltipContent>SIC {{ asSic(row).codigo_sic_contrato }}</GTooltipContent>
                      </GTooltip>
                    </template>
                  </DataTable>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </template>
    </AsyncView>
  </div>
</template>
