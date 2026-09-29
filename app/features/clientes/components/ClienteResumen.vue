<script setup lang="ts">
import type { PanelCliente, ParticipacionHistorico } from '~/features/clientes/types'
import type { Vigencia } from '~/types/cliente'
import { DollarSignIcon, ExternalLinkIcon, FileIcon, SunIcon } from '@lucide/vue'
import { ClientesService } from '~/features/clientes/services/clientes'
import { fmt, fmtFecha, SEMAFORO, servicioLabel } from './clientesUi'
import ParticipacionSparkline from './ParticipacionSparkline.vue'

type BadgeColor = 'default' | 'success' | 'warning' | 'destructive'

const SEMAFORO_COLOR: Record<Vigencia, BadgeColor> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'destructive',
}

const clientesService = new ClientesService()

const props = defineProps<{ clienteId: number | string }>()
const query = useQuery<PanelCliente>()

const historicoPorProyecto = computed(() => {
  if (!query.data) return []
  const grupos = new Map<
    number,
    { proyecto_id: number; nombre?: string; filas: ParticipacionHistorico[] }
  >()
  for (const fila of query.data.participaciones_historico) {
    const grupo = grupos.get(fila.proyecto_id) ?? {
      proyecto_id: fila.proyecto_id,
      nombre: fila.proyecto_nombre,
      filas: [],
    }
    grupo.filas.push(fila)
    grupos.set(fila.proyecto_id, grupo)
  }
  return [...grupos.values()].map((g) => {
    const vigente = g.filas.find((f) => !f.fecha_fin)
    return { ...g, actual: vigente?.porcentaje ?? g.filas[g.filas.length - 1]?.porcentaje ?? null }
  })
})

function renovLabel(v: boolean | null | undefined) {
  return v === true ? 'Renueva auto' : v === false ? 'No renueva' : 'Renovación —'
}
function renovColor(v: boolean | null | undefined): BadgeColor {
  return v === true ? 'success' : 'default'
}

async function cargar() {
  if (!props.clienteId) return
  await query.run(() => clientesService.obtenerPanel(Number(props.clienteId)))
}

watch(() => props.clienteId, cargar, { immediate: true })
</script>

<template>
  <AsyncView :query="query">
    <template #default="{ data: panel }">
      <div class="space-y-5">
        <!-- KPIs -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card size="sm">
            <CardContent>
              <p class="text-2xl font-extrabold">{{ panel.kpis.num_plantas }}</p>
              <p class="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Plantas con nosotros
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p class="text-2xl font-extrabold">{{ panel.kpis.contratos_activos }}</p>
              <p class="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Contratos activos
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p class="text-2xl font-extrabold">{{ panel.kpis.servicios.length }}</p>
              <p class="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Servicios
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p class="pt-1.5 text-base font-extrabold">
                {{ fmtFecha(panel.kpis.proximo_vencimiento) }}
              </p>
              <p class="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Próximo vencimiento
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Plantas contratadas -->
        <Card>
          <CardHeader class="flex flex-row items-center gap-2">
            <SunIcon class="size-4 text-primary" />
            <CardTitle>Plantas contratadas</CardTitle>
            <GBadge>{{ panel.plantas.length }}</GBadge>
          </CardHeader>
          <CardContent>
            <p v-if="!panel.plantas.length" class="py-4 text-center text-sm text-muted-foreground">
              Sin plantas vinculadas.
            </p>
            <div v-else class="space-y-2">
              <Item v-for="p in panel.plantas" :key="p.proyecto_id" variant="outline">
                <ItemContent>
                  <ItemTitle>{{ p.nombre }}</ItemTitle>
                  <ItemDescription>
                    {{ p.potencia_kwp != null ? `${p.potencia_kwp} kWp` : '—' }} · fin contrato:
                    {{ fmtFecha(p.fecha_fin_contrato) }}
                    <span v-if="p.participacion_actual != null">
                      · participación {{ p.participacion_actual }}%
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions class="flex-wrap justify-end gap-1.5">
                  <GBadge v-for="s in p.servicios" :key="s" variant="outline">{{
                    servicioLabel(s)
                  }}</GBadge>
                  <GBadge :color="renovColor(p.renovacion_automatica)">
                    {{ renovLabel(p.renovacion_automatica) }}
                  </GBadge>
                </ItemActions>
              </Item>
            </div>
          </CardContent>
        </Card>

        <!-- Condiciones económicas + histórico participación -->
        <Card>
          <CardHeader class="flex flex-row items-center gap-2">
            <DollarSignIcon class="size-4 text-primary" />
            <CardTitle>Condiciones económicas</CardTitle>
            <GBadge>{{ panel.condiciones.length }}</GBadge>
          </CardHeader>
          <CardContent class="space-y-4">
            <p
              v-if="!panel.condiciones.length"
              class="py-2 text-center text-sm text-muted-foreground"
            >
              Sin condiciones registradas.
            </p>
            <GTable v-else>
              <GTableHeader>
                <GTableRow>
                  <GTableHead>Proyecto</GTableHead>
                  <GTableHead>Servicio</GTableHead>
                  <GTableHead class="text-right">Tarifa repr.</GTableHead>
                  <GTableHead class="text-right">Tarifa CGM</GTableHead>
                  <GTableHead>Índice</GTableHead>
                  <GTableHead>Indexación</GTableHead>
                </GTableRow>
              </GTableHeader>
              <GTableBody>
                <GTableRow v-for="c in panel.condiciones" :key="c.contrato_id">
                  <GTableCell class="font-medium">{{ fmt(c.proyecto_nombre) }}</GTableCell>
                  <GTableCell>{{ servicioLabel(c.servicio) }}</GTableCell>
                  <GTableCell class="text-right tabular-nums">{{
                    fmt(c.tarifa_representacion)
                  }}</GTableCell>
                  <GTableCell class="text-right tabular-nums">{{ fmt(c.tarifa_cgm) }}</GTableCell>
                  <GTableCell>{{ fmt(c.indice_indexacion) }}</GTableCell>
                  <GTableCell>{{ fmtFecha(c.fecha_indexacion) }}</GTableCell>
                </GTableRow>
              </GTableBody>
            </GTable>

            <div v-if="historicoPorProyecto.length" class="space-y-1.5">
              <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Histórico % de participación
              </p>
              <Collapsible
                v-for="g in historicoPorProyecto"
                :key="g.proyecto_id"
                class="rounded-lg border px-3 py-2"
              >
                <CollapsibleTrigger class="flex w-full items-center justify-between">
                  <span class="text-sm font-medium">{{ fmt(g.nombre) }}</span>
                  <span class="flex items-center gap-3">
                    <ParticipacionSparkline
                      :puntos="g.filas.map((f) => ({ porcentaje: f.porcentaje }))"
                    />
                    <span class="text-sm font-bold text-primary tabular-nums">
                      {{ fmt(g.actual) }}<template v-if="g.actual !== null">%</template>
                    </span>
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <table class="mt-2 w-full text-xs">
                    <tbody>
                      <tr v-for="(f, i) in g.filas" :key="i" class="border-t">
                        <td class="py-1.5">
                          {{ fmtFecha(f.fecha_inicio) }} →
                          {{ f.fecha_fin ? fmtFecha(f.fecha_fin) : 'vigente' }}
                        </td>
                        <td class="py-1.5 text-right font-medium tabular-nums">
                          {{ fmt(f.porcentaje) }}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        <!-- Contratos y documentos -->
        <Card>
          <CardHeader class="flex flex-row items-center gap-2">
            <FileIcon class="size-4 text-primary" />
            <CardTitle>Contratos y documentos</CardTitle>
            <GBadge>{{ panel.contratos.length }}</GBadge>
          </CardHeader>
          <CardContent>
            <p
              v-if="!panel.contratos.length"
              class="py-4 text-center text-sm text-muted-foreground"
            >
              Sin contratos registrados.
            </p>
            <div v-else class="space-y-2">
              <Item v-for="c in panel.contratos" :key="`${c.fuente}-${c.id}`" variant="outline">
                <ItemContent>
                  <ItemTitle class="flex flex-wrap items-center gap-2">
                    <GBadge variant="outline">{{
                      c.fuente === 'ppa' ? 'PPA' : servicioLabel(c.tipo ?? '')
                    }}</GBadge>
                    <span>{{ fmt(c.numero) }}</span>
                    <GBadge v-if="c.semaforo" :color="SEMAFORO_COLOR[c.semaforo]">
                      {{ SEMAFORO[c.semaforo].label }}
                    </GBadge>
                  </ItemTitle>
                  <ItemDescription>
                    {{ c.proyectos.join(', ') || '—' }} · {{ fmtFecha(c.fecha_inicio) }} →
                    {{ fmtFecha(c.fecha_fin) }}
                    <span v-if="c.renovacion_automatica === true"> · renueva auto</span>
                    <span v-else-if="c.renovacion_automatica === false"> · no renueva</span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <a
                    v-if="c.link"
                    :href="c.link"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLinkIcon class="size-3.5" /> Abrir contrato
                  </a>
                  <span v-else class="text-xs text-muted-foreground italic">Sin link</span>
                </ItemActions>
              </Item>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
  </AsyncView>
</template>
