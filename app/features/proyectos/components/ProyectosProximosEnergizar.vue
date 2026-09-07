<template>
  <div class="rounded-xl border" style="border-color: rgba(44,32,57,0.12); background: white;">

    <!-- Header -->
    <div class="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style="border-bottom: 1px solid rgba(44,32,57,0.10);">
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="stat-pill">
          <span class="stat-num">{{ projects.length }}</span>
          <span class="stat-label">en pipeline</span>
        </div>
        <button
          type="button"
          class="stat-pill clickable"
          :class="{ active: soloProximosAEnergizar }"
          @click="soloProximosAEnergizar = !soloProximosAEnergizar"
          v-tooltip.bottom="'Tienen frontera asignada o Sun Factory ya los marca \'Próximo a energizar\'.'"
        >
          <span class="stat-num" style="color:#b45309;">{{ proximosAEnergizarCount }}</span>
          <span class="stat-label">próximos a energizar</span>
          <CircleXIcon v-if="soloProximosAEnergizar" class="size-[1em]" style="font-size:0.65rem; color:#b45309;" />
          <FilterIcon v-else class="size-[1em]" style="font-size:0.65rem; color:#b45309;" />
        </button>
        <button
          type="button"
          class="stat-pill clickable"
          :class="{ active: soloConFrontera }"
          @click="soloConFrontera = !soloConFrontera"
          v-tooltip.bottom="'Ya tienen frontera comercial registrada en Quoia.'"
        >
          <span class="stat-num" style="color:#15803d;">{{ conFronteraCount }}</span>
          <span class="stat-label">con frontera asignada</span>
          <CircleXIcon v-if="soloConFrontera" class="size-[1em]" style="font-size:0.65rem;" />
          <FilterIcon v-else class="size-[1em]" style="font-size:0.65rem;" />
        </button>
        <Button label="Actualizar" size="small" :loading="syncing" @click="onSync" v-tooltip.bottom="'Trae de nuevo % de obra, estado y fecha estimada desde Sun Factory'">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar Excel" size="small" severity="secondary" outlined @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
      </div>
      <p class="text-xs" style="color: #7a6e8a;">
        <template v-if="lastSync">última sincronización {{ lastSyncLabel }}</template>
      </p>
    </div>

    <!-- Aviso de origen de datos (config faltante / fuente caída) -->
    <div v-if="warning" class="mx-3 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
      style="background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.35); color: #8a6d00;">
      <TriangleAlertIcon class="mt-0.5 size-[1em]" />
      <span>{{ warning }}</span>
    </div>

    <!-- Sugerencias de vínculo pendientes (el sync no encontró match exacto, pero
         un proyecto existente se parece — necesitan confirmación humana) -->
    <div v-if="sugerencias.length" class="mx-3 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
      style="background: rgba(145,91,216,0.10); border: 1px solid rgba(145,91,216,0.30); color: #6b3fa0;">
      <InfoIcon class="mt-0.5 size-[1em]" />
      <span>
        {{ sugerencias.length }} posible{{ sugerencias.length !== 1 ? 's' : '' }} vínculo{{ sugerencias.length !== 1 ? 's' : '' }} con Sun Factory por confirmar.
        <button type="button" class="underline font-semibold" @click="sugerenciasVisible = true">Revisar</button>
      </span>
    </div>

    <!-- Table -->
    <div class="p-3 overflow-x-auto">
      <DataTable
        :value="filteredProjects"
        dataKey="id"
        size="small"
        stripedRows
        v-model:expandedRows="expandedRows"
        class="energ-table"
      >
        <template #empty>
          <div class="text-center py-8 text-sm" style="color: rgba(44,32,57,0.45);">
            <template v-if="loading">
              <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:1.2rem; color:var(--color-unergy-purple);" />
              <p class="mt-2">Cargando proyectos del pipeline…</p>
            </template>
            <template v-else-if="warning">
              <DatabaseIcon class="size-[1em]" style="font-size:1.4rem; color:#c4b8d4;" />
              <p class="mt-2">No se pudieron cargar los proyectos.</p>
              <p class="mt-1 text-xs" style="color: rgba(44,32,57,0.4);">Revisa el aviso de arriba (configuración / fuente de datos).</p>
            </template>
            <template v-else-if="soloConFrontera">
              Ningún proyecto en construcción tiene frontera asignada todavía.
            </template>
            <template v-else>
              Aún no hay proyectos en el pipeline. Revisa «Proyectos pendientes» en la pestaña Proyectos para traer nuevos desde Sun Factory/Quoia.
            </template>
          </div>
        </template>

        <Column expander style="width: 44px" />

        <!-- Commercial name (read-only, viene de Sun Factory) -->
        <Column header="Proyecto" frozen style="min-width: 340px;">
          <template #body="{ data }">
            <span class="text-sm proyecto-name" v-tooltip.top="data.commercialName">{{ data.commercialName }}</span>
          </template>
        </Column>

        <!-- Origina project code (read-only) -->
        <Column header="Código" style="min-width: 150px;">
          <template #body="{ data }">
            <span class="text-xs font-mono" style="color: rgba(44,32,57,0.5);">{{ data.name || '—' }}</span>
          </template>
        </Column>

        <!-- Status (read-only, viene de Sun Factory) -->
        <Column header="Estado" style="min-width: 200px;">
          <template #body="{ data }">
            <span class="text-sm">{{ data.status }}</span>
          </template>
        </Column>

        <!-- Energization date (read-only, viene de Sun Factory) -->
        <Column header="Energización" style="min-width: 140px;">
          <template #body="{ data }">
            <span class="text-sm font-mono tabular-nums">{{ formatDate(data.energizationDate) }}</span>
          </template>
        </Column>

        <!-- Construction progress (Sun Factory, read-only) -->
        <Column header="% Obra" style="min-width: 90px;">
          <template #body="{ data }">
            <span v-if="data.avancePct != null" class="text-sm font-mono tabular-nums" style="color: var(--color-unergy-deep);">
              {{ Number(data.avancePct).toFixed(1) }}%
            </span>
            <span v-else class="text-sm" style="color: rgba(44,32,57,0.3);">—</span>
          </template>
        </Column>

        <!-- Frontera asignada (señal real de energización inminente) -->
        <Column header="Frontera" style="min-width: 130px;">
          <template #body="{ data }">
            <span v-if="data.tieneFrontera" class="frontera-badge yes" v-tooltip.top="data.codigoFrontera">
              <CircleCheckIcon class="size-[1em]" /> {{ data.codigoFrontera }}
            </span>
            <span v-else class="frontera-badge no">—</span>
          </template>
        </Column>

        <!-- Linked PPA contracts (read-only — se gestionan en el flujo PPA) -->
        <Column header="Contratos" style="min-width: 110px;">
          <template #body="{ data }">
            <span v-if="data.contracts && data.contracts.length" class="contract-badge has-contract"
                  v-tooltip.top="data.contracts.join(', ')">
              <FileIcon class="size-[1em]" />
              {{ data.contracts[0] }}<template v-if="data.contracts.length > 1"> +{{ data.contracts.length - 1 }}</template>
            </span>
            <span v-else class="contract-badge">
              <span class="dot" /> Sin contratos
            </span>
          </template>
        </Column>

        <!-- Expected monthly MWh (read-only, viene de Sun Factory) -->
        <Column header="MWh / mes" style="min-width: 110px;">
          <template #body="{ data }">
            <span class="text-sm font-mono tabular-nums" :class="{ 'mwh-muted': !data.monthlyMwh }">
              {{ Number(data.monthlyMwh).toFixed(2) }}
            </span>
          </template>
        </Column>

        <!-- Actions -->
        <Column style="width: 56px; text-align: center;">
          <template #body="{ data }">
            <Button severity="danger" text rounded size="small" @click="confirmRemove(data)">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>

        <!-- Proyección mensual (detalle expandible por fila) -->
        <template #expansion="{ data }">
          <div class="px-5 py-4" style="background: rgba(145,91,216,0.04);">
            <p class="text-xs font-semibold uppercase tracking-wide mb-2.5" style="color:#7a6e8a; letter-spacing:0.05em;">
              Proyección MWh/mes — {{ data.commercialName }}
            </p>
            <div class="month-grid">
              <div
                v-for="col in monthColumns" :key="col.field"
                class="month-chip"
                :class="{ partial: isProrated(data, col.year, col.month), zero: calculateGeneration(data, col.year, col.month) === 0 }"
                v-tooltip.top="isProrated(data, col.year, col.month) ? 'Mes parcial — prorrateado desde la energización' : ''"
              >
                <div class="m">{{ col.header }}</div>
                <div class="v">{{ calculateGeneration(data, col.year, col.month).toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Dialog: sugerencias de vínculo con Sun Factory -->
    <Dialog v-model:visible="sugerenciasVisible" header="Posibles vínculos con Sun Factory" modal class="w-full max-w-2xl">
      <p class="text-sm text-gray-600 mb-3">
        El sync no encontró un match exacto para estos proyectos de Sun Factory, pero encontró un
        proyecto existente con un nombre parecido. Para cada uno, responde: <b>¿es el mismo proyecto?</b>
        Si confirmas que sí, queda vinculado permanentemente y el sync ya no lo vuelve a duplicar.
      </p>
      <div v-if="!sugerencias.length" class="text-sm text-gray-400 py-6 text-center">
        No quedan sugerencias pendientes.
      </div>
      <div v-else class="space-y-3">
        <div v-for="sug in sugerencias" :key="sug.sunfactory_project_id + '-' + sug.candidato_id"
          class="flex items-center justify-between gap-3 p-3 rounded-lg border" style="border-color:#ECE7F2;">
          <div class="text-sm">
            <div><span class="text-gray-400">Sun Factory:</span> <b>{{ sug.sunfactory_nombre }}</b>
              <span v-if="sug.sunfactory_municipio" class="text-gray-400"> · {{ sug.sunfactory_municipio }}</span>
            </div>
            <div class="mt-0.5"><span class="text-gray-400">Proyecto existente:</span>
              <b>{{ sug.candidato_nombre }}</b> (ID {{ sug.candidato_id }})
              <span v-if="sug.candidato_municipio" class="text-gray-400"> · {{ sug.candidato_municipio }}</span>
            </div>
            <div v-if="sug.candidato_sunfactory_id_previo != null" class="mt-1 text-xs" style="color:#b45309;">
              <TriangleAlertIcon class="size-[1em]" style="font-size:0.7rem;" />
              Este proyecto ya había quedado confirmado antes como el ID {{ sug.candidato_sunfactory_id_previo }}
              de Sun Factory. Si confirmas que también es el {{ sug.sunfactory_project_id }}, ese ID anterior
              se reemplaza por este — puede ser que Sun Factory tenga el mismo proyecto duplicado con dos IDs.
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <Button label="No es el mismo" text severity="secondary" size="small"
              :disabled="vinculandoId === sug.candidato_id" @click="descartarSugerencia(sug)" />
            <Button label="Sí, es el mismo" size="small" :loading="vinculandoId === sug.candidato_id"
              @click="vincular(sug)" />
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { useEnergizationProjects } from '~/composables/useEnergizationProjects'
import { exportarExcel } from '~/utils/exportarExcel'
import { CircleCheckIcon, CircleXIcon, DatabaseIcon, FileIcon, FileSpreadsheetIcon, FilterIcon, InfoIcon, LoaderCircleIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon } from '@lucide/vue'

const proyectosService = new ProyectosService()

const {
  projects, loading, warning, syncing, lastSync,
  loadProjects, removeProject, syncNow,
} = useEnergizationProjects()

const sugerencias = ref([])
const sugerenciasVisible = ref(false)
const vinculandoId = ref(null)
const expandedRows = ref({})
const soloConFrontera = ref(false)
const soloProximosAEnergizar = ref(false)

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatDate(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toISOString().slice(0, 10)
}

onMounted(loadProjects)

// Pregunta frecuente: "¿qué proyectos están por energizar de verdad?" -- en
// construcción + con frontera comercial ya registrada (señal más confiable
// que el estado propio de Sun Factory).
const filteredProjects = computed(() => {
  let list = projects.value
  if (soloConFrontera.value) list = list.filter(p => p.tieneFrontera)
  if (soloProximosAEnergizar.value) list = list.filter(p => p.tieneFrontera || p.status === 'Próximo a energizar')
  return list
})

const conFronteraCount = computed(() => projects.value.filter(p => p.tieneFrontera).length)

// "Próximos a energizar" = unión de dos señales (no se suman, se unen -- un
// proyecto puede cumplir ambas y solo cuenta una vez): tiene frontera asignada
// (la señal real, aunque Sun Factory no lo sepa) O Sun Factory ya lo marca
// como "Próximo a energizar" en su propio pipeline de obra.
const proximosAEnergizarCount = computed(() =>
  projects.value.filter(p => p.tieneFrontera || p.status === 'Próximo a energizar').length
)

const lastSyncLabel = computed(() => {
  if (!lastSync.value) return ''
  const mins = Math.round((Date.now() - lastSync.value.getTime()) / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  // Ahora esta fecha viene de la BD (último sync real, no de esta sesión) --
  // puede tener horas o días, así que no basta con mostrar solo la hora.
  if (hours < 24) return `hace ${hours} h`
  return lastSync.value.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
})

async function descargarExcel() {
  await exportarExcel(filteredProjects.value, [
    { header: 'Código', value: p => p.name || '' },
    { header: 'Proyecto', value: p => p.commercialName || '' },
    { header: 'Estado', value: p => p.status || '' },
    { header: 'Energización', value: p => formatDate(p.energizationDate) },
    { header: '% Obra', value: p => p.avancePct ?? '' },
    { header: 'Frontera asignada', value: p => p.tieneFrontera ? (p.codigoFrontera || 'Sí') : '' },
    { header: 'Contratos', value: p => (p.contracts || []).join(', ') },
    { header: 'MWh/mes', value: p => p.monthlyMwh ?? 0 },
  ], `proximos_a_energizar_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Próximos a energizar')
}

async function onSync() {
  const r = await syncNow()
  if (r) {
    const partes = [
      `Actualizados: ${r.actualizados ?? 0}`,
      r.sin_match ? `Sin vínculo (revisar en Proyectos › Proyectos pendientes): ${r.sin_match}` : null,
      r.errores ? `Errores: ${r.errores}` : null,
    ].filter(Boolean)
    toast.success('Sincronización completa', { description: partes.join(' · '), duration: 4000 })
    if (Array.isArray(r.warnings) && r.warnings.length) {
      toast.warning('Avisos', { description: r.warnings.join(' · '), duration: 6000 })
    }
    if (Array.isArray(r.sugerencias_vinculo) && r.sugerencias_vinculo.length) {
      sugerencias.value = r.sugerencias_vinculo
      sugerenciasVisible.value = true
    }
  }
}

async function vincular(sug) {
  if (sug.candidato_sunfactory_id_previo != null) {
    const ok = window.confirm(
      `"${sug.candidato_nombre}" ya había quedado confirmado antes como el ID ${sug.candidato_sunfactory_id_previo} de Sun Factory. ` +
      `¿Confirmas que también es el ID ${sug.sunfactory_project_id} (se reemplaza el anterior)?`
    )
    if (!ok) return
  }
  vinculandoId.value = sug.candidato_id
  try {
    await proyectosService.vincularSunFactory(sug.candidato_id, sug.sunfactory_project_id)
    sugerencias.value = sugerencias.value.filter(s => s !== sug)
    toast.success('Vinculado', {
      description: `${sug.candidato_nombre} vinculado a Sun Factory`,
      duration: 3000,
    })
  } catch (e) {
    toast.error('No se pudo vincular', { description: e.data?.detail || e.message, duration: 5000 })
  } finally {
    vinculandoId.value = null
  }
}

function descartarSugerencia(sug) {
  // Solo la quita de esta lista local (no persiste "descartado"): si de verdad
  // es un proyecto distinto, el sync la va a volver a sugerir la próxima vez
  // que corra, hasta que alguien la vincule o cree el proyecto correcto a mano.
  sugerencias.value = sugerencias.value.filter(s => s !== sug)
}

function confirmRemove(project) {
  if (window.confirm(`¿Quitar "${project.commercialName}" de la lista? (se marcará como eliminado)`)) {
    removeProject(project.id)
  }
}

// Next 12 months starting from the current month.
const monthColumns = computed(() => {
  const cols = []
  const start = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1 // 1-based
    cols.push({
      field: `${year}-${String(month).padStart(2, '0')}`,
      header: `${MESES_CORTOS[month - 1]} ${year}`,
      year,
      month,
    })
  }
  return cols
})

// Prorated generation for a given column (year, 1-based month).
function calculateGeneration(project, year, month) {
  const ed = project.energizationDate instanceof Date
    ? project.energizationDate
    : new Date(project.energizationDate)
  if (!project.energizationDate || isNaN(ed.getTime())) return 0

  const eYear = ed.getFullYear()
  const eMonth = ed.getMonth() + 1 // 1-based
  const mwh = Number(project.monthlyMwh) || 0

  // Column month is before the energization month → not yet generating.
  if (year < eYear || (year === eYear && month < eMonth)) return 0

  // Same month as energization → prorate by operational days.
  if (year === eYear && month === eMonth) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const operationalDays = daysInMonth - ed.getDate() + 1
    return Math.round((operationalDays / daysInMonth) * mwh * 100) / 100
  }

  // After the energization month → full month.
  return mwh
}

// A value is prorated when it is the first (partial) month of operation.
function isProrated(project, year, month) {
  const ed = project.energizationDate instanceof Date
    ? project.energizationDate
    : new Date(project.energizationDate)
  if (!project.energizationDate || isNaN(ed.getTime())) return false
  return year === ed.getFullYear() && month === (ed.getMonth() + 1) && ed.getDate() > 1
}
</script>

<style scoped>
/* Tarjetas de resumen en el header -- responden "cuántos" de un vistazo,
   y la de "con frontera" duplica como el toggle del filtro (antes un
   checkbox aparte, poco intuitivo). */
.stat-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 10px;
  background: rgba(44,32,57,0.04);
  border: 1.5px solid transparent;
  font-size: 12px;
}
.stat-pill.clickable {
  cursor: pointer;
  background: rgba(22,163,74,0.07);
  transition: background 0.12s, border-color 0.12s;
}
.stat-pill.clickable:hover { background: rgba(22,163,74,0.13); }
.stat-pill.clickable.active {
  background: rgba(22,163,74,0.14);
  border-color: rgba(22,163,74,0.4);
}
.stat-pill.clickable svg { color: #15803d; }
.stat-num { font-size: 15px; font-weight: 800; color: var(--color-unergy-deep); font-variant-numeric: tabular-nums; }
.stat-label { color: #7a6e8a; white-space: nowrap; }

/* Nombres largos: no cortar sin avisar -- el tooltip muestra el valor entero. */
.proyecto-name {
  display: block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.energ-table .p-datatable-thead th) {
  background: rgba(44,32,57,0.05);
  color: #7a6e8a;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 10px;
  white-space: nowrap;
}
:deep(.energ-table .p-datatable-tbody td) {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--color-unergy-deep);
  vertical-align: middle;
}

/* Frontera asignada */
.frontera-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;
}
.frontera-badge.yes { background: rgba(22,163,74,0.10); color: #15803d; }
.frontera-badge.no  { color: rgba(44,32,57,0.3); }

/* Contratos: badge compacto en vez de columna ancha */
.contract-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: rgba(44,32,57,0.35); white-space: nowrap;
}
.contract-badge.has-contract { color: #6b3fa0; font-weight: 600; }
.contract-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(44,32,57,0.25); }

/* MWh/mes apagado cuando es 0 -- se activa visualmente solo si hay dato */
.mwh-muted {
  color: rgba(44,32,57,0.3);
}

/* Proyección mensual expandible */
.month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: 8px;
}
.month-chip {
  background: white;
  border: 1px solid rgba(44,32,57,0.08);
  border-radius: 8px;
  padding: 7px 6px;
  text-align: center;
}
.month-chip .m { font-size: 9.5px; text-transform: uppercase; color: #9b89b5; letter-spacing: 0.04em; }
.month-chip .v { font-size: 13px; font-weight: 700; margin-top: 2px; color: var(--color-unergy-deep); font-variant-numeric: tabular-nums; }
.month-chip.zero .v { color: rgba(44,32,57,0.3); font-weight: 500; }
.month-chip.partial { background: rgba(240,192,64,0.15); border-color: rgba(240,192,64,0.4); }
.month-chip.partial .v { color: #9a6700; }
</style>
