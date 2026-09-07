<template>
  <div class="space-y-5">
    <PageHeader title="Diagnóstico de Enlaces" subtitle="Mapeo Contrato → GESCON → Planta → sub_project (API Unergy)">
      <template #lead>
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(145,91,216,0.12);">
          <LinkIcon class="text-lg size-[1em]" style="color: var(--color-unergy-purple);" />
        </div>
      </template>
      <template #actions>
        <Button severity="secondary" text :loading="loading" @click="load">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Auto-Fix Enlaces" severity="warn" size="small" :loading="fixing" @click="fixEnlaces">
          <template #icon><WrenchIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Fix results -->
    <div v-if="fixResult" class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
      <h2 class="text-sm font-bold mb-3" style="color: var(--color-unergy-deep);">Resultado del Fix</h2>
      <div v-for="(a, i) in fixResult.actions" :key="i" class="text-xs py-1 border-b" style="border-color: #f0e8f8;">
        <GBadge :color="actionSev(a.action)" class="text-xs mr-2">{{ a.action }}</GBadge>
        <b>{{ a.contrato }}</b>
        <span v-if="a.planta"> → {{ a.planta }}</span>
        <span v-if="a.sub_project" class="font-mono ml-1" style="color: #059669;">({{ a.sub_project }})</span>
        <span v-if="a.reason" class="ml-1" style="color: #dc2626;">{{ a.reason }}</span>
        <span v-if="a.asic_id" class="ml-1 opacity-50">id={{ a.asic_id }}</span>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <template v-if="data && !loading">
      <!-- Projects with sub_project -->
      <div class="bg-white rounded-xl shadow-sm p-4" style="border: 1px solid #e8e0f0;">
        <h2 class="text-sm font-bold mb-3" style="color: var(--color-unergy-deep);">
          Proyectos con sub_project ({{ data.proyectos_con_sub_project?.length || 0 }})
        </h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in data.proyectos_con_sub_project" :key="p.id"
                class="text-xs px-2 py-1 rounded-full font-mono"
                :style="p.estado === 'en_operacion'
                  ? 'background: rgba(16,185,129,0.1); color: #059669;'
                  : 'background: rgba(107,90,138,0.1); color: #6b5a8a;'">
            {{ p.nombre }} → <b>{{ p.sub_project }}</b>
          </span>
        </div>
      </div>

      <!-- Contracts -->
      <div v-for="c in data.contratos" :key="c.contrato_id"
           class="bg-white rounded-xl shadow-sm overflow-hidden"
           :style="'border: 1px solid ' + (c.n_plantas_activas === 0 ? '#fca5a5' : '#e8e0f0')">

        <div class="px-4 py-3 flex items-center gap-3 flex-wrap"
             :style="'border-bottom: 1px solid #e8e0f0; background: ' + (c.n_plantas_activas === 0 ? '#fef2f2' : '#f8f5fc')">
          <span class="font-bold text-sm" style="color: var(--color-unergy-deep);">{{ c.nombre_interno || '(sin nombre)' }}</span>
          <span class="text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(145,91,216,0.1); color: var(--color-unergy-purple);">
            {{ c.numero_codigo_contrato || '(sin código)' }}
          </span>
          <span class="text-xs" style="color: #6b5a8a;">{{ c.comprador }}</span>
          <GBadge :color="c.tipo === 'compra' ? 'information' : 'default'" class="text-xs">{{ c.tipo }}</GBadge>
          <span class="ml-auto text-xs font-bold"
                :style="'color: ' + (c.n_plantas_activas > 0 ? '#059669' : '#dc2626')">
            {{ c.n_plantas_activas }} planta(s) activa(s)
          </span>
        </div>

        <!-- Raw GESCON records -->
        <div v-if="c.gescon_raw?.length" class="px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-wide mb-2" style="color: #6b5a8a;">
            Registros GESCON ({{ c.gescon_raw.length }})
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-xs" style="border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f5fc;">
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">ID</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Tipo</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Estado</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">SIC</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Planta</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">sub_project</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">%Desp</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Dup</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Reemp</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Inicio</th>
                  <th class="px-2 py-1 text-left" style="border: 1px solid #e8e0f0;">Fin</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in c.gescon_raw" :key="r.id"
                    :style="r.estado !== 'publicado' ? 'opacity: 0.4;' : ''">
                  <td class="px-2 py-1 font-mono" style="border: 1px solid #e8e0f0;">{{ r.id }}</td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">
                    <GBadge :color="tipoSev(r.tipo)" class="text-xs">{{ r.tipo }}</GBadge>
                  </td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.estado }}</td>
                  <td class="px-2 py-1 font-mono" style="border: 1px solid #e8e0f0;">{{ r.codigo_sic }}</td>
                  <td class="px-2 py-1 font-semibold" style="border: 1px solid #e8e0f0; color: var(--color-unergy-deep);">{{ r.planta || '—' }}</td>
                  <td class="px-2 py-1 font-mono" style="border: 1px solid #e8e0f0;"
                      :style="r.sub_project ? 'color: #059669;' : 'color: #dc2626; font-weight: bold;'">
                    {{ r.sub_project || 'NULL' }}
                  </td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.pct_despacho != null ? (r.pct_despacho * 100).toFixed(0) + '%' : '—' }}</td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.es_duplicado ? 'SÍ' : '' }}</td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.reemplaza_anterior ? 'SÍ' : '' }}</td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.fecha_inicio || '—' }}</td>
                  <td class="px-2 py-1" style="border: 1px solid #e8e0f0;">{{ r.fecha_fin || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Resolved plants -->
        <div v-if="c.gescon_resolved?.length" class="px-4 py-3" style="border-top: 1px solid #e8e0f0;">
          <p class="text-xs font-bold uppercase tracking-wide mb-2" style="color: #059669;">
            Plantas resueltas para este mes
          </p>
          <div class="flex flex-wrap gap-2">
            <span v-for="p in c.gescon_resolved" :key="p.asic_id"
                  class="text-xs px-3 py-1.5 rounded-lg font-medium"
                  :style="p.es_duplicado
                    ? 'background: rgba(234,179,8,0.15); color: #a16207; border: 1px solid rgba(234,179,8,0.3);'
                    : 'background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2);'">
              {{ p.planta }}
              <span class="font-mono opacity-70 ml-1">({{ p.sub_project || 'SIN API ID' }})</span>
              <span v-if="p.pct_despacho != null" class="opacity-60 ml-1">{{ (p.pct_despacho * 100).toFixed(0) }}%</span>
              <span v-if="p.es_duplicado" class="ml-1 font-bold">DUP</span>
            </span>
          </div>
        </div>

        <!-- No plants warning -->
        <div v-if="!c.gescon_raw?.length && !c.gescon_resolved?.length" class="px-4 py-6 text-center">
          <TriangleAlertIcon class="text-2xl mb-2 block size-[1em]" style="color: #dc2626;" />
          <p class="text-xs font-semibold" style="color: #dc2626;">
            Sin registros GESCON — {{ !c.numero_codigo_contrato ? 'no tiene código de contrato' : 'no hay AsicSolicitud con contrato_interno = ' + c.numero_codigo_contrato }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { DiagnosticoEnlacesService } from '~/features/admin/services/diagnostico-enlaces'
import { logger } from '~/core/logger'
import Button from 'primevue/button'
import { LinkIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon, WrenchIcon } from '@lucide/vue'

const diagnosticoEnlacesService = new DiagnosticoEnlacesService()

const data = ref(null)
const loading = ref(false)
const fixing = ref(false)
const fixResult = ref(null)

function tipoSev(tipo) {
  return { registro: 'success', modificacion: 'information', terminacion: 'destructive', desistimiento: 'default' }[tipo] || 'default'
}

function actionSev(action) {
  return { created: 'success', exists: 'information', skip: 'warning', delete_duplicate: 'destructive', unflag_duplicate: 'success' }[action] || 'default'
}

async function load() {
  loading.value = true
  try {
    data.value = await diagnosticoEnlacesService.obtener()
  } catch (e) {
    logger.error('admin.diagnostico-enlaces', e)
  } finally {
    loading.value = false
  }
}

async function fixEnlaces() {
  fixing.value = true
  fixResult.value = null
  try {
    fixResult.value = await diagnosticoEnlacesService.fixEnlaces()
    await load()
  } catch (e) {
    logger.error('admin.diagnostico-enlaces', e)
    fixResult.value = { actions: [{ action: 'error', reason: e.data?.detail || e.message, contrato: '—' }] }
  } finally {
    fixing.value = false
  }
}

onMounted(load)
</script>
