<template>
  <div class="space-y-4">
    <PageHeader title="Consumo"
                subtitle="Energía contratada hora por hora, según el FTP de XM">
      <template #actions>
        <Button label="Exportar" size="small" outlined
                :disabled="!filtrados.length" @click="exportar">
          <template #icon><DownloadIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Proyecto</label>
        <Select v-model="filtros.proyecto" :options="proyectosOptions" optionLabel="label" optionValue="value"
                class="w-52" showClear filter placeholder="Todos" />
      </div>
      <!-- Mes, año y versión definen el período que se le pide a XM: no se
           filtran en pantalla, se recarga. Por eso no admiten "todos". -->
      <div>
        <label class="field-label">Mes</label>
        <Select v-model="filtros.mes" :options="MESES" optionLabel="label" optionValue="value"
                class="w-32" @change="cargar" />
      </div>
      <div>
        <label class="field-label">Año</label>
        <Select v-model="filtros.anio" :options="aniosOptions" class="w-28" @change="cargar" />
      </div>
      <div>
        <label class="field-label">Versión</label>
        <Select v-model="filtros.version" :options="VERSIONES" class="w-24" @change="cargar" />
      </div>
      <div>
        <label class="field-label">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" placeholder="Proyecto…" class="w-48" />
        </IconField>
      </div>
      <div class="flex-1" />
      <Button size="small" text rounded :loading="loading" v-tooltip.left="'Recargar'" @click="cargar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
      <div class="text-xs text-gray-400 self-center">
        {{ filtrados.length }} registro{{ filtrados.length === 1 ? '' : 's' }}
        <span v-if="filtrados.length" class="block font-mono" style="color:#915BD8">
          {{ fmtNum(totalPeriodo) }} kWh
        </span>
      </div>
    </div>

    <div v-if="error" class="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
         style="background:#FEF2F2; border:1px solid #FECACA; color:#991B1B">
      <CircleXIcon class="size-[1em]" />{{ error }}
    </div>

    <!-- Tabla: 24 horas + total. Las tres primeras columnas quedan fijas para no
         perder de vista el proyecto al desplazarse por las horas. -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="col-fija col-proyecto px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Proyecto</th>
              <th class="col-fija col-fecha px-3 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Fecha</th>
              <th class="col-fija col-version px-3 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Versión</th>
              <th v-for="h in HORAS" :key="h"
                  class="px-2 py-2.5 text-right font-medium text-gray-500 text-[10px] uppercase whitespace-nowrap">
                {{ h }}
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-[11px] uppercase whitespace-nowrap"
                  style="color:var(--color-unergy-deep); border-left:1px solid #EEE;">Total diario</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in filtrados" :key="i"
                class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100 row-hover">
              <td class="col-fija col-proyecto px-4 py-2">{{ row.proyecto || '—' }}</td>
              <td class="col-fija col-fecha px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{{ row.fecha || '—' }}</td>
              <td class="col-fija col-version px-3 py-2 text-xs font-mono uppercase">{{ row.version || '—' }}</td>
              <td v-for="(v, j) in row.horas" :key="j"
                  class="px-2 py-2 text-right font-mono text-[11px] text-gray-600">
                {{ fmtNum(v) }}
              </td>
              <td class="px-3 py-2 text-right font-mono text-xs font-semibold"
                  style="color:var(--color-unergy-purple); border-left:1px solid #F1F1F1;">
                {{ fmtNum(row.total_diario) }}
              </td>
            </tr>
            <tr v-if="loading">
              <td :colspan="HORAS.length + 4" class="px-4 py-12 text-center text-gray-400">
                <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" />
              </td>
            </tr>
            <tr v-else-if="!filtrados.length">
              <td :colspan="HORAS.length + 4" class="px-4 py-12 text-center text-sm text-gray-400">
                <ZapIcon class="text-2xl mb-2 block text-gray-300 size-[1em]" />
                No hay consumo para este período.<br>
                <span class="text-xs">
                  Estos datos los trae «Descargar FTP» desde Despachos liquidados.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { VERSIONES, VERSION_INICIAL } from '~/features/liquidaciones/types'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import { CircleXIcon, DownloadIcon, LoaderCircleIcon, RefreshCwIcon, SearchIcon, ZapIcon } from '@lucide/vue'

const liquidacionesApi = new LiquidacionesApiService()

// Las 24 horas del día, como las nombra XM (CON HOUR01 … CON HOUR24).
const HORAS = Array.from({ length: 24 }, (_, i) => `H${String(i + 1).padStart(2, '0')}`)

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ label, value: i + 1 }))

const aniosOptions = computed(() => {
  const actual = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => actual - i)
})

// Arranca en el mes pasado: el actual todavía no está liquidado.
const mesPasado = new Date()
mesPasado.setMonth(mesPasado.getMonth() - 1)

const filtros = reactive({
  proyecto: null,
  mes: mesPasado.getMonth() + 1,
  anio: mesPasado.getFullYear(),
  version: VERSION_INICIAL,
})
const q = ref('')
const loading = ref(false)
const error = ref('')
const consumos = ref([])
const proyectosOptions = ref([])

// El período ya viene filtrado del servidor; aquí solo se afina por proyecto.
const filtrados = computed(() => {
  const term = q.value.trim().toLowerCase()
  return consumos.value.filter(c => {
    if (filtros.proyecto && c.topico !== filtros.proyecto) return false
    return !term || String(c.proyecto || '').toLowerCase().includes(term)
  })
})

/** Suma de los totales diarios de lo que se está viendo, en kWh. */
const totalPeriodo = computed(
  () => filtrados.value.reduce((s, c) => s + (Number(c.total_diario) || 0), 0),
)

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)
}

async function cargar() {
  loading.value = true
  error.value = ''
  try {
    const data = await liquidacionesApi.listarConsumo({
      month: filtros.mes,
      year: filtros.anio,
      version: filtros.version,
    })
    consumos.value = data.results || []
  } catch (e) {
    error.value = e?.data?.detail
      || 'No se pudo consultar el consumo del período.'
    consumos.value = []
  } finally {
    loading.value = false
  }
}

/** Descarga lo que se está viendo, con una columna por hora. */
function exportar() {
  const cabecera = ['Proyecto', 'Fecha', 'Versión', ...HORAS, 'Total diario']
  const filas = filtrados.value.map(c => [
    c.proyecto ?? '', c.fecha ?? '', c.version ?? '',
    ...c.horas.map(v => (v ?? '')), c.total_diario ?? '',
  ])
  // Se separa con punto y coma: en configuración regional es-CO el Excel espera
  // ese separador, y con coma metería toda la fila en una sola celda.
  const csv = [cabecera, ...filas]
    .map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `consumo_${filtros.anio}-${String(filtros.mes).padStart(2, '0')}_${filtros.version}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function cargarProyectos() {
  try {
    const data = await liquidacionesApi.listarProyectos()
    proyectosOptions.value = (data || [])
      .filter(p => p.nombre_topico)
      .map(p => ({ value: p.nombre_topico, label: p.nombre_comercial }))
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch { /* el filtro queda vacío, la tabla sigue sirviendo */ }
}

onMounted(() => { cargar(); cargarProyectos() })
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }

/* Proyecto, fecha y versión quedan fijas: con 24 horas la tabla se desplaza
   mucho y sin esto se pierde de vista a qué fila corresponde cada número. */
.col-fija {
  position: sticky;
  z-index: 2;
  background: #ffffff;
}
thead .col-fija { background: #F9FAFB; z-index: 3; }
.row-hover:hover .col-fija { background: #F8FAFC; }
.col-proyecto { left: 0; min-width: 190px; }
.col-fecha { left: 190px; }
.col-version { left: 290px; border-right: 1px solid #E5E7EB; }
</style>
