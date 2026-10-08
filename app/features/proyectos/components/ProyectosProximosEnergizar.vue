<template>
  <div class="rounded-xl border border-foreground/10 bg-card">

    <!-- Header -->
    <div class="px-5 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-foreground/10">
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-transparent text-xs bg-foreground/5">
          <span class="text-base font-extrabold tabular-nums text-foreground">{{ projects.length }}</span>
          <span class="text-muted-foreground whitespace-nowrap">en pipeline</span>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-transparent text-xs cursor-pointer transition-colors duration-150"
          :class="soloProximosAEnergizar ? 'bg-success/15 border-success/40' : 'bg-success/10 hover:bg-success/15'"
          title="Tienen frontera asignada o Sun Factory ya los marca 'Próximo a energizar'."
          @click="soloProximosAEnergizar = !soloProximosAEnergizar"
        >
          <span class="text-base font-extrabold tabular-nums text-warning">{{ proximosAEnergizarCount }}</span>
          <span class="text-muted-foreground whitespace-nowrap">próximos a energizar</span>
          <CircleXIcon v-if="soloProximosAEnergizar" class="size-3 text-warning" />
          <FilterIcon v-else class="size-3 text-warning" />
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-transparent text-xs cursor-pointer transition-colors duration-150"
          :class="soloConFrontera ? 'bg-success/15 border-success/40' : 'bg-success/10 hover:bg-success/15'"
          title="Ya tienen frontera comercial registrada en Quoia."
          @click="soloConFrontera = !soloConFrontera"
        >
          <span class="text-base font-extrabold tabular-nums text-success">{{ conFronteraCount }}</span>
          <span class="text-muted-foreground whitespace-nowrap">con frontera asignada</span>
          <CircleXIcon v-if="soloConFrontera" class="size-3 text-success" />
          <FilterIcon v-else class="size-3 text-success" />
        </button>
        <GTooltip>
          <GTooltipTrigger as-child>
            <Button size="sm" :disabled="syncing" @click="onSync">
              <Spinner v-if="syncing" class="size-4" /><RefreshCwIcon v-else class="size-4" /> Actualizar
            </Button>
          </GTooltipTrigger>
          <GTooltipContent>Trae de nuevo % de obra, estado y fecha estimada desde Sun Factory</GTooltipContent>
        </GTooltip>
        <Button variant="outline" size="sm" @click="descargarExcel">
          <FileSpreadsheetIcon class="size-4" /> Descargar Excel
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        <template v-if="lastSync">última sincronización {{ lastSyncLabel }}</template>
      </p>
    </div>

    <!-- Aviso de origen de datos (config faltante / fuente caída) -->
    <div v-if="warning" class="mx-3 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-warning/10 border border-warning/30 text-warning">
      <TriangleAlertIcon class="mt-0.5 size-3" />
      <span>{{ warning }}</span>
    </div>

    <!-- Sugerencias de vínculo pendientes (el sync no encontró match exacto, pero
         un proyecto existente se parece — necesitan confirmación humana) -->
    <div v-if="sugerencias.length" class="mx-3 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-primary/10 border border-primary/30 text-primary">
      <InfoIcon class="mt-0.5 size-3" />
      <span>
        {{ sugerencias.length }} posible{{ sugerencias.length !== 1 ? 's' : '' }} vínculo{{ sugerencias.length !== 1 ? 's' : '' }} con Sun Factory por confirmar.
        <button type="button" class="underline font-semibold" @click="sugerenciasVisible = true">Revisar</button>
      </span>
    </div>

    <!-- Table -->
    <div class="p-3 overflow-x-auto">
      <!-- GTable a mano y no blocks/DataTable: cada fila se despliega en una
           segunda con la proyección mensual, y el bloque no tiene filas de detalle. -->
      <GTable>
        <GTableHeader>
          <GTableRow>
            <GTableHead class="w-10" />
            <GTableHead v-for="h in ENCABEZADOS" :key="h">{{ h }}</GTableHead>
            <GTableHead class="w-12" />
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <TableEmpty v-if="!filteredProjects.length" :colspan="ENCABEZADOS.length + 2">
            <div class="text-center py-8 text-sm text-muted-foreground whitespace-normal">
              <template v-if="loading">
                <LoaderCircleIcon class="mx-auto size-5 animate-spin text-primary" />
                <p class="mt-2">Cargando proyectos del pipeline…</p>
              </template>
              <template v-else-if="warning">
                <DatabaseIcon class="mx-auto size-6 text-muted-foreground/60" />
                <p class="mt-2">No se pudieron cargar los proyectos.</p>
                <p class="mt-1 text-xs text-muted-foreground">Revisa el aviso de arriba (configuración / fuente de datos).</p>
              </template>
              <template v-else-if="soloConFrontera">
                Ningún proyecto en construcción tiene frontera asignada todavía.
              </template>
              <template v-else>
                Aún no hay proyectos en el pipeline. Revisa «Proyectos pendientes» en la pestaña Proyectos para traer nuevos desde Sun Factory/Quoia.
              </template>
            </div>
          </TableEmpty>
          <template v-for="data in filteredProjects" :key="data.id">
            <GTableRow>
              <GTableCell>
                <Button variant="ghost" size="icon-sm" :aria-expanded="!!expandedRows[data.id]"
                  aria-label="Ver proyección mensual" @click="alternarFila(data.id)">
                  <ChevronRightIcon class="size-4 transition-transform" :class="expandedRows[data.id] ? 'rotate-90' : ''" />
                </Button>
              </GTableCell>
              <!-- Commercial name (read-only, viene de Sun Factory) -->
              <GTableCell><TruncatedText :text="data.commercialName" class="text-sm max-w-80" /></GTableCell>
              <!-- Origina project code (read-only) -->
              <GTableCell><span class="text-xs font-mono text-muted-foreground">{{ data.name || '—' }}</span></GTableCell>
              <!-- Status (read-only, viene de Sun Factory) -->
              <GTableCell><span class="text-sm">{{ data.status }}</span></GTableCell>
              <!-- Energization date (read-only, viene de Sun Factory) -->
              <GTableCell><span class="text-sm font-mono tabular-nums">{{ formatDate(data.energizationDate) }}</span></GTableCell>
              <!-- Construction progress (Sun Factory, read-only) -->
              <GTableCell>
                <span v-if="data.avancePct != null" class="text-sm font-mono tabular-nums text-foreground">
                  {{ Number(data.avancePct).toFixed(1) }}%
                </span>
                <span v-else class="text-sm text-muted-foreground/50">—</span>
              </GTableCell>
              <!-- Frontera asignada (señal real de energización inminente) -->
              <GTableCell>
                <span v-if="data.tieneFrontera" class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full max-w-30 truncate bg-success/10 text-success" :title="data.codigoFrontera">
                  <CircleCheckIcon class="size-4" /> {{ data.codigoFrontera }}
                </span>
                <span v-else class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full max-w-30 truncate text-foreground/30">—</span>
              </GTableCell>
              <!-- Linked PPA contracts (read-only — se gestionan en el flujo PPA) -->
              <GTableCell>
                <span v-if="data.contracts && data.contracts.length" class="inline-flex items-center gap-1 text-xs whitespace-nowrap font-semibold text-primary"
                      :title="data.contracts.join(', ')">
                  <FileIcon class="size-4" />
                  {{ data.contracts[0] }}<template v-if="data.contracts.length > 1"> +{{ data.contracts.length - 1 }}</template>
                </span>
                <span v-else class="inline-flex items-center gap-1 text-xs whitespace-nowrap text-foreground/35">
                  <span class="size-1.5 rounded-full bg-foreground/25" /> Sin contratos
                </span>
              </GTableCell>
              <!-- Expected monthly MWh (read-only, viene de Sun Factory) -->
              <GTableCell>
                <span class="text-sm font-mono tabular-nums" :class="{ 'text-foreground/30': !data.monthlyMwh }">
                  {{ Number(data.monthlyMwh).toFixed(2) }}
                </span>
              </GTableCell>
              <!-- Actions -->
              <GTableCell>
                <Button variant="ghost" size="icon-sm" aria-label="Quitar de la lista" @click="confirmRemove(data)">
                  <Trash2Icon class="size-4 text-destructive" />
                </Button>
              </GTableCell>
            </GTableRow>
            <!-- Proyección mensual (detalle expandible por fila) -->
            <GTableRow v-if="expandedRows[data.id]" class="hover:bg-transparent">
              <GTableCell :colspan="ENCABEZADOS.length + 2" class="p-0 whitespace-normal">
                <div class="px-5 py-4 bg-primary/5">
                  <p class="text-xs font-semibold uppercase tracking-wide mb-2.5 text-muted-foreground">
                    Proyección MWh/mes — {{ data.commercialName }}
                  </p>
                  <div class="month-grid gap-2">
                    <div
                      v-for="col in monthColumns" :key="col.field"
                      class="rounded-lg border px-1.5 py-2 text-center"
                      :class="isProrated(data, col.year, col.month) ? 'bg-warning/15 border-warning/40' : 'bg-card border-foreground/10'"
                      :title="isProrated(data, col.year, col.month) ? 'Mes parcial — prorrateado desde la energización' : undefined"
                    >
                      <div class="text-xs uppercase tracking-wide text-muted-foreground">{{ col.header }}</div>
                      <div
                        class="text-sm mt-0.5 tabular-nums"
                        :class="[
                          calculateGeneration(data, col.year, col.month) === 0 ? 'font-medium' : 'font-bold',
                          isProrated(data, col.year, col.month) ? 'text-warning' : calculateGeneration(data, col.year, col.month) === 0 ? 'text-foreground/30' : 'text-foreground',
                        ]"
                      >{{ calculateGeneration(data, col.year, col.month).toFixed(2) }}</div>
                    </div>
                  </div>
                </div>
              </GTableCell>
            </GTableRow>
          </template>
        </GTableBody>
      </GTable>
    </div>

    <!-- Dialog: sugerencias de vínculo con Sun Factory -->
    <Dialog v-model:open="sugerenciasVisible">
      <DialogContent class="sm:max-w-2xl max-h-dvh overflow-y-auto" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle>Posibles vínculos con Sun Factory</DialogTitle>
        <DialogDescription>
          El sync no encontró un match exacto para estos proyectos de Sun Factory, pero encontró un
          proyecto existente con un nombre parecido. Para cada uno, responde: <b>¿es el mismo proyecto?</b>
          Si confirmas que sí, queda vinculado permanentemente y el sync ya no lo vuelve a duplicar.
        </DialogDescription>
      </DialogHeader>
      <div v-if="!sugerencias.length" class="text-sm text-muted-foreground py-6 text-center">
        No quedan sugerencias pendientes.
      </div>
      <div v-else class="space-y-3">
        <div v-for="sug in sugerencias" :key="sug.sunfactory_project_id + '-' + sug.candidato_id"
          class="flex items-center justify-between gap-3 p-3 rounded-lg border">
          <div class="text-sm">
            <div><span class="text-muted-foreground">Sun Factory:</span> <b>{{ sug.sunfactory_nombre }}</b>
              <span v-if="sug.sunfactory_municipio" class="text-muted-foreground"> · {{ sug.sunfactory_municipio }}</span>
            </div>
            <div class="mt-0.5"><span class="text-muted-foreground">Proyecto existente:</span>
              <b>{{ sug.candidato_nombre }}</b> (ID {{ sug.candidato_id }})
              <span v-if="sug.candidato_municipio" class="text-muted-foreground"> · {{ sug.candidato_municipio }}</span>
            </div>
            <div v-if="sug.candidato_sunfactory_id_previo != null" class="mt-1 text-xs text-warning">
              <TriangleAlertIcon class="size-3" />
              Este proyecto ya había quedado confirmado antes como el ID {{ sug.candidato_sunfactory_id_previo }}
              de Sun Factory. Si confirmas que también es el {{ sug.sunfactory_project_id }}, ese ID anterior
              se reemplaza por este — puede ser que Sun Factory tenga el mismo proyecto duplicado con dos IDs.
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" :disabled="vinculandoId === sug.candidato_id" @click="descartarSugerencia(sug)">
              No es el mismo
            </Button>
            <Button size="sm" :disabled="vinculandoId === sug.candidato_id" @click="vincular(sug)">
              <Spinner v-if="vinculandoId === sug.candidato_id" class="size-4" /> Sí, es el mismo
            </Button>
          </div>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { useEnergizationProjects } from '~/composables/useEnergizationProjects'
import { exportarExcel } from '~/utils/exportarExcel'
import { ChevronRightIcon, CircleCheckIcon, CircleXIcon, DatabaseIcon, FileIcon, FileSpreadsheetIcon, FilterIcon, InfoIcon, LoaderCircleIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon } from '@lucide/vue'

const proyectosService = new ProyectosService()

const {
  projects, loading, warning, syncing, lastSync,
  loadProjects, removeProject, syncNow,
} = useEnergizationProjects()

const sugerencias = ref([])
const sugerenciasVisible = ref(false)
const vinculandoId = ref(null)
// Filas desplegadas, por id del proyecto.
const expandedRows = ref({})

function alternarFila(id) {
  const { [id]: abierta, ...resto } = expandedRows.value
  expandedRows.value = abierta ? resto : { ...resto, [id]: true }
}

const ENCABEZADOS = ['Proyecto', 'Código', 'Estado', 'Energización', '% Obra', 'Frontera', 'Contratos', 'MWh / mes']
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
/* Grilla de la proyección mensual: auto-fill/minmax no tiene utilidad Tailwind. */
.month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--spacing) * 18.5), 1fr));
}
</style>
