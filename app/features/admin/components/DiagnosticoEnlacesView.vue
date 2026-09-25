<script setup lang="ts">
import type {
  ContratoDiagnosticoEnlaces,
  DiagnosticoEnlaces,
  ResultadoFixEnlaces,
} from '~/features/admin/types'
import { LinkIcon, RefreshCwIcon, TriangleAlertIcon, WrenchIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { DiagnosticoEnlacesService } from '~/features/admin/services/diagnostico-enlaces'

type BadgeColor = 'default' | 'action' | 'information' | 'success' | 'warning' | 'destructive'

const TIPO_COLOR: Record<string, BadgeColor> = {
  registro: 'success',
  modificacion: 'information',
  terminacion: 'destructive',
  desistimiento: 'default',
}

const ACTION_COLOR: Record<string, BadgeColor> = {
  created: 'success',
  exists: 'information',
  skip: 'warning',
  delete_duplicate: 'destructive',
  unflag_duplicate: 'success',
}

function tipoColor(tipo?: string): BadgeColor {
  return (tipo && TIPO_COLOR[tipo]) || 'default'
}

function actionColor(action: string): BadgeColor {
  return ACTION_COLOR[action] || 'default'
}

function contratoClass(c: ContratoDiagnosticoEnlaces) {
  return c.n_plantas_activas === 0 ? 'border-destructive/40' : ''
}

const diagnosticoEnlacesService = new DiagnosticoEnlacesService()
const diagnosticoQuery = useQuery<DiagnosticoEnlaces>()
const fixing = ref(false)
const fixResult = ref<ResultadoFixEnlaces | null>(null)

async function load() {
  await diagnosticoQuery.run(() => diagnosticoEnlacesService.obtener())
}

onMounted(load)

async function fixEnlaces() {
  fixing.value = true
  fixResult.value = null
  try {
    fixResult.value = await diagnosticoEnlacesService.fixEnlaces()
    await load()
  } catch (err) {
    fixResult.value = {
      actions: [{ action: 'error', reason: normalizeError(err).message, contrato: '—' }],
    }
  } finally {
    fixing.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="Diagnóstico de Enlaces"
      subtitle="Mapeo Contrato → GESCON → Planta → sub_project (API Unergy)"
    >
      <template #lead>
        <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <LinkIcon class="size-4 text-primary" />
        </div>
      </template>
      <template #actions>
        <GTooltip>
          <GTooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="diagnosticoQuery.isLoading"
              @click="load"
            >
              <RefreshCwIcon
                class="size-4"
                :class="{ 'animate-spin': diagnosticoQuery.isLoading }"
              />
            </Button>
          </GTooltipTrigger>
          <GTooltipContent>Recargar</GTooltipContent>
        </GTooltip>
        <Button variant="outline" size="sm" :disabled="fixing" @click="fixEnlaces">
          <WrenchIcon class="size-4" />
          Auto-Fix Enlaces
        </Button>
      </template>
    </PageHeader>

    <Card v-if="fixResult">
      <CardHeader>
        <CardTitle>Resultado del Fix</CardTitle>
      </CardHeader>
      <CardContent class="space-y-1">
        <div
          v-for="(a, i) in fixResult.actions"
          :key="i"
          class="flex flex-wrap items-center gap-1.5 border-b py-1 text-xs last:border-b-0"
        >
          <GBadge :color="actionColor(a.action)">{{ a.action }}</GBadge>
          <b>{{ a.contrato }}</b>
          <span v-if="a.planta">→ {{ a.planta }}</span>
          <span v-if="a.sub_project" class="font-mono text-success">({{ a.sub_project }})</span>
          <span v-if="a.reason" class="text-destructive">{{ a.reason }}</span>
          <span v-if="a.asic_id" class="opacity-50">id={{ a.asic_id }}</span>
        </div>
      </CardContent>
    </Card>

    <AsyncView :query="diagnosticoQuery">
      <template #default="{ data }">
        <div class="space-y-5">
          <Card v-if="data.proyectos_con_sub_project?.length">
            <CardHeader>
              <CardTitle>
                Proyectos con sub_project ({{ data.proyectos_con_sub_project.length }})
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-2">
              <GBadge
                v-for="p in data.proyectos_con_sub_project"
                :key="p.id"
                :color="p.estado === 'en_operacion' ? 'success' : 'default'"
              >
                {{ p.nombre }} → <b>{{ p.sub_project }}</b>
              </GBadge>
            </CardContent>
          </Card>

          <Card v-for="c in data.contratos" :key="c.contrato_id" :class="contratoClass(c)">
            <CardHeader class="flex flex-row flex-wrap items-center gap-3">
              <CardTitle>{{ c.nombre_interno || '(sin nombre)' }}</CardTitle>
              <GBadge>{{ c.numero_codigo_contrato || '(sin código)' }}</GBadge>
              <span class="text-xs text-muted-foreground">{{ c.comprador }}</span>
              <GBadge :color="c.tipo === 'compra' ? 'information' : 'default'">{{ c.tipo }}</GBadge>
              <span
                class="ml-auto text-xs font-bold"
                :class="c.n_plantas_activas > 0 ? 'text-success' : 'text-destructive'"
              >
                {{ c.n_plantas_activas }} planta(s) activa(s)
              </span>
            </CardHeader>

            <CardContent class="space-y-4">
              <div v-if="c.gescon_raw?.length" class="space-y-2">
                <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Registros GESCON ({{ c.gescon_raw.length }})
                </p>
                <GTable>
                  <GTableHeader>
                    <GTableRow>
                      <GTableHead>ID</GTableHead>
                      <GTableHead>Tipo</GTableHead>
                      <GTableHead>Estado</GTableHead>
                      <GTableHead>SIC</GTableHead>
                      <GTableHead>Planta</GTableHead>
                      <GTableHead>sub_project</GTableHead>
                      <GTableHead>%Desp</GTableHead>
                      <GTableHead>Dup</GTableHead>
                      <GTableHead>Reemp</GTableHead>
                      <GTableHead>Inicio</GTableHead>
                      <GTableHead>Fin</GTableHead>
                    </GTableRow>
                  </GTableHeader>
                  <GTableBody>
                    <GTableRow
                      v-for="r in c.gescon_raw"
                      :key="r.id"
                      :class="r.estado !== 'publicado' ? 'opacity-40' : ''"
                    >
                      <GTableCell class="font-mono">{{ r.id }}</GTableCell>
                      <GTableCell
                        ><GBadge :color="tipoColor(r.tipo)">{{ r.tipo }}</GBadge></GTableCell
                      >
                      <GTableCell>{{ r.estado }}</GTableCell>
                      <GTableCell class="font-mono">{{ r.codigo_sic }}</GTableCell>
                      <GTableCell class="font-semibold">{{ r.planta || '—' }}</GTableCell>
                      <GTableCell
                        class="font-mono"
                        :class="r.sub_project ? 'text-success' : 'font-bold text-destructive'"
                      >
                        {{ r.sub_project || 'NULL' }}
                      </GTableCell>
                      <GTableCell>{{
                        r.pct_despacho != null ? `${(r.pct_despacho * 100).toFixed(0)}%` : '—'
                      }}</GTableCell>
                      <GTableCell>{{ r.es_duplicado ? 'SÍ' : '' }}</GTableCell>
                      <GTableCell>{{ r.reemplaza_anterior ? 'SÍ' : '' }}</GTableCell>
                      <GTableCell>{{ r.fecha_inicio || '—' }}</GTableCell>
                      <GTableCell>{{ r.fecha_fin || '—' }}</GTableCell>
                    </GTableRow>
                  </GTableBody>
                </GTable>
              </div>

              <div v-if="c.gescon_resolved?.length" class="space-y-2">
                <p class="text-xs font-semibold tracking-wide text-success uppercase">
                  Plantas resueltas para este mes
                </p>
                <div class="flex flex-wrap gap-2">
                  <GBadge
                    v-for="p in c.gescon_resolved"
                    :key="p.asic_id"
                    :color="p.es_duplicado ? 'warning' : 'success'"
                  >
                    {{ p.planta }}
                    <span class="opacity-70">({{ p.sub_project || 'SIN API ID' }})</span>
                    <span v-if="p.pct_despacho != null" class="opacity-70">
                      {{ (p.pct_despacho * 100).toFixed(0) }}%
                    </span>
                    <span v-if="p.es_duplicado" class="font-bold">DUP</span>
                  </GBadge>
                </div>
              </div>

              <Empty v-if="!c.gescon_raw?.length && !c.gescon_resolved?.length" class="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon" class="bg-destructive/10 text-destructive">
                    <TriangleAlertIcon />
                  </EmptyMedia>
                  <EmptyTitle class="text-destructive">Sin registros GESCON</EmptyTitle>
                  <EmptyDescription>
                    {{
                      !c.numero_codigo_contrato
                        ? 'No tiene código de contrato'
                        : `No hay AsicSolicitud con contrato_interno = ${c.numero_codigo_contrato}`
                    }}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        </div>
      </template>
    </AsyncView>
  </div>
</template>
