<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button text @click="$router.back()" class="-ml-2">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
        <ZapIcon class="text-amber-500 text-sm size-[1em]" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-800">Alertas — Contratos PPA</h2>
        <p v-if="fechaConsulta" class="text-xs text-gray-400 mt-0.5">
          Fecha de consulta: {{ fechaConsulta }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Resumen -->
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-xl border border-orange-100 bg-orange-50 p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <UserMinusIcon class="text-orange-500 text-xl size-[1em]" />
          </div>
          <div>
            <p class="text-2xl font-bold text-orange-600">{{ huerfanos.length }}</p>
            <p class="text-sm font-medium text-orange-700">Proyectos huérfanos</p>
            <p class="text-xs text-orange-400 mt-0.5">Sin contrato activo en GESCON hoy</p>
          </div>
        </div>
        <div class="rounded-xl border border-red-100 bg-red-50 p-5 flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <CopyIcon class="text-red-500 text-xl size-[1em]" />
          </div>
          <div>
            <p class="text-2xl font-bold text-red-600">{{ duplicados.length }}</p>
            <p class="text-sm font-medium text-red-700">Proyectos duplicados</p>
            <p class="text-xs text-red-400 mt-0.5">Asociados a 2+ contratos activos a la vez</p>
          </div>
        </div>
      </div>

      <!-- ── Sección Huérfanos ── -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <UserMinusIcon class="text-orange-500 size-[1em]" />
          <h3 class="font-semibold text-gray-700">Proyectos huérfanos</h3>
          <GBadge color="warning" class="text-xs">{{ huerfanos.length }}</GBadge>
        </div>
        <p class="text-xs text-gray-400">
          Proyectos que no aparecen en ningún contrato activo del GESCON hoy.
          Pueden estar pendientes de registro o sus contratos haber vencido/terminado.
        </p>

        <div v-if="huerfanos.length === 0"
          class="flex flex-col items-center py-8 gap-2 text-gray-400">
          <CircleCheckIcon class="text-green-400 text-3xl size-[1em]" />
          <p class="text-sm">Todos los proyectos tienen contrato activo en GESCON.</p>
        </div>

        <DataTable v-else :value="huerfanosTabla" size="small" stripedRows :rowHover="true"
          :paginator="huerfanos.length > 15" :rows="15" class="text-sm">
          <Column header="Proyecto" style="min-width:240px">
            <template #body="{ data }">
              <RouterLink :to="`/proyectos/${data.proyecto_id}`"
                class="text-blue-600 hover:underline font-medium">
                {{ data.nombre_comercial }}
              </RouterLink>
            </template>
          </Column>
          <Column header="Tipo" style="min-width:110px">
            <template #body="{ data }">
              <GBadge color="default" class="text-xs">{{ data.tipo_proyecto || '—' }}</GBadge>
            </template>
          </Column>
          <Column header="Estado" style="min-width:110px">
            <template #body="{ data }">
              <GBadge :color="estadoSev(data.estado)" class="text-xs">{{ data.estado }}</GBadge>
            </template>
          </Column>
          <Column header="" style="width:60px">
            <template #body="{ data }">
              <RouterLink :to="`/proyectos/${data.proyecto_id}/ppa`">
                <Button text size="small" severity="warning" v-tooltip="'Ver PPA'">
                  <template #icon><ZapIcon class="size-[1em]" /></template>
                </Button>
              </RouterLink>
            </template>
          </Column>
        </DataTable>
      </div>

      <Divider />

      <!-- ── Sección Duplicados ── -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <CopyIcon class="text-red-500 size-[1em]" />
          <h3 class="font-semibold text-gray-700">Proyectos duplicados</h3>
          <GBadge color="destructive" class="text-xs">{{ duplicados.length }}</GBadge>
        </div>
        <p class="text-xs text-gray-400">
          Proyectos que están activos en 2 o más contratos GESCON simultáneamente.
          Revisar si los porcentajes de despacho suman 100 % o si es un error de registro.
        </p>

        <div v-if="duplicados.length === 0"
          class="flex flex-col items-center py-8 gap-2 text-gray-400">
          <CircleCheckIcon class="text-green-400 text-3xl size-[1em]" />
          <p class="text-sm">No hay proyectos con contratos duplicados.</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="dup in duplicados" :key="dup.proyecto_id"
            class="border border-red-100 rounded-xl bg-white p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <RouterLink :to="`/proyectos/${dup.proyecto_id}`"
                  class="font-semibold text-gray-800 hover:text-blue-600">
                  {{ dup.nombre_comercial }}
                </RouterLink>
                <GBadge color="default" class="text-xs">{{ dup.tipo_proyecto || '—' }}</GBadge>
              </div>
              <GBadge color="destructive" class="text-xs">{{ dup.sics.length }} contratos activos</GBadge>
            </div>

            <DataTable :value="dup.sics" size="small" class="text-xs">
              <Column field="codigo_sic_contrato" header="SIC" style="min-width:90px" />
              <Column field="contrato_interno" header="Contrato" style="min-width:130px" />
              <Column header="Tipo" style="min-width:110px">
                <template #body="{ data }">
                  <GBadge :color="tipoSev(data.tipo_solicitud)" class="text-xs">{{ data.tipo_solicitud }}</GBadge>
                </template>
              </Column>
              <Column header="Inicio" style="min-width:90px">
                <template #body="{ data }">{{ data.fecha_inicio || '—' }}</template>
              </Column>
              <Column header="Fin" style="min-width:90px">
                <template #body="{ data }">{{ data.fecha_fin || '—' }}</template>
              </Column>
              <Column header="% Desp." style="min-width:80px">
                <template #body="{ data }">
                  {{ data.porcentaje_fncer != null ? `${data.porcentaje_fncer}%` : '—' }}
                </template>
              </Column>
              <Column header="" style="width:50px">
                <template #body="{ data }">
                  <RouterLink :to="`/mem/gescon`">
                    <Button text size="small" severity="secondary" v-tooltip="`SIC ${data.codigo_sic_contrato}`">
                      <template #icon><ExternalLinkIcon class="size-[1em]" /></template>
                    </Button>
                  </RouterLink>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Divider from 'primevue/divider'
import { AlertasService } from '~/features/alertas/services/alertas'
import { logger } from '~/core/logger'
import { ArrowLeftIcon, CircleCheckIcon, CopyIcon, ExternalLinkIcon, UserMinusIcon, ZapIcon } from '@lucide/vue'

const alertasService = new AlertasService()

const loading = ref(true)
const fechaConsulta = ref('')
const huerfanos = ref([])
const duplicados = ref([])

// Tabla de huérfanos como ref plano (evita bug PrimeVue 4 con computed)
const huerfanosTabla = ref([])

function estadoSev(e) {
  return { en_operacion: 'success', en_desarrollo: 'information', suspendido: 'warning' }[e] || 'default'
}

function tipoSev(t) {
  return { registro: 'success', modificacion: 'information', terminacion: 'destructive', desistimiento: 'warning' }[t] || 'default'
}

onMounted(async () => {
  try {
    const data = await alertasService.obtenerContratosPpa()
    fechaConsulta.value = data.fecha_consulta
    huerfanos.value = data.huerfanos
    duplicados.value = data.duplicados
    huerfanosTabla.value = data.huerfanos
  } catch (e) {
    logger.error('alertas', e)
  } finally {
    loading.value = false
  }
})
</script>
