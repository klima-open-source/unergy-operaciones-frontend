<template>
  <div class="mx-auto flex max-w-6xl flex-col pb-20 print:max-w-none print:p-0">
    <!-- Breadcrumb -->
    <div
      class="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground print:hidden"
    >
      <NuxtLink to="/informes" class="font-semibold text-primary hover:underline">
        ← Informes
      </NuxtLink>
      <span>/</span>
      <span class="font-semibold text-foreground">
        {{ query.data?.proyecto_nombre || query.data?.sub_project || '…' }}
      </span>
      <span v-if="query.data?.periodo_display">· {{ query.data.periodo_display }}</span>
    </div>

    <AsyncView :query="query">
      <template #error="{ error }">
        <div class="py-16 text-center text-sm text-destructive">
          {{ error.message }}
          <br />
          <small class="text-xs text-muted-foreground">
            Verifica que el informe exista y tengas permisos.
          </small>
        </div>
      </template>

      <template #default="{ data: informe }">
        <!-- ══ Toolbar ══ -->
        <div
          class="mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 print:hidden"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <Button
              v-if="!editMode && informe.estado === 'borrador'"
              variant="outline"
              size="sm"
              @click="enterEdit(informe)"
            >
              <PencilIcon /> Editar informe
            </Button>
            <Button
              v-if="editMode"
              variant="outline"
              size="sm"
              class="text-destructive hover:bg-destructive/10"
              @click="discardEdit(informe)"
            >
              <Undo2Icon /> Descartar cambios
            </Button>
            <Button
              v-if="editMode"
              variant="outline"
              size="sm"
              :disabled="saving"
              @click="saveEdit(informe)"
            >
              <LoaderCircleIcon v-if="saving" class="animate-spin" />
              <SaveIcon v-else /> Guardar versión
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <GBadge :color="estadoColor(informe.estado)">{{ estadoLabel(informe.estado) }}</GBadge>
            <Button
              v-if="informe.estado === 'borrador'"
              variant="outline"
              size="sm"
              :disabled="changingEstado"
              @click="changeEstado(informe, 'revisado')"
            >
              <EyeIcon /> Marcar revisado
            </Button>
            <Button
              v-if="informe.estado === 'revisado'"
              variant="outline"
              size="sm"
              :disabled="changingEstado"
              @click="changeEstado(informe, 'aprobado')"
            >
              <CircleCheckIcon /> Aprobar y enviar
            </Button>
            <Button
              v-if="informe.estado === 'revisado'"
              variant="outline"
              size="sm"
              class="text-destructive hover:bg-destructive/10"
              :disabled="changingEstado"
              @click="changeEstado(informe, 'borrador')"
            >
              <Undo2Icon /> Devolver a borrador
            </Button>
            <Button size="sm" @click="printInforme"> <PrinterIcon /> Imprimir / PDF </Button>
          </div>
        </div>

        <!-- Hint edición -->
        <p
          v-if="editMode"
          class="mb-3 rounded-lg border bg-primary/5 px-3 py-2 text-xs text-muted-foreground print:hidden"
        >
          Haz clic en cualquier texto para editarlo directamente · Al terminar haz clic en
          <b>Guardar versión</b>
        </p>

        <!-- Panel días en rojo (solo en editMode) -->
        <div
          v-if="editMode && diasDisponibles.length"
          class="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2 print:hidden"
        >
          <span class="mr-1 shrink-0 text-xs font-bold text-destructive">
            <PaletteIcon class="inline size-3.5" /> Días en rojo:
          </span>
          <Select v-if="informe.tipo === 'port'" v-model="subProjectActivo">
            <SelectTrigger size="sm" class="max-w-52">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in proyectosDisponibles" :key="p.sp" :value="p.sp">
                {{ p.nombre }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-for="d in diasDisponibles"
            :key="d.date"
            :variant="diasRojosActivos.has(d.date) ? 'destructive' : 'outline'"
            size="xs"
            @click="toggleDiaRojo(informe, d.date)"
          >
            {{ d.day }}
          </Button>
          <Button
            v-if="diasRojosActivos.size > 0"
            variant="ghost"
            size="xs"
            @click="limpiarDiasRojos(informe)"
          >
            <XIcon /> Limpiar
          </Button>
        </div>

        <!-- ══ Contenido del informe ══ -->
        <div
          ref="contentRef"
          class="outline-none [&[contenteditable=true]]:cursor-text"
          :contenteditable="editMode ? 'true' : 'false'"
          v-html="htmlContent"
        />
      </template>
    </AsyncView>
  </div>
</template>

<script setup lang="ts">
import {
  CircleCheckIcon,
  EyeIcon,
  LoaderCircleIcon,
  PaletteIcon,
  PencilIcon,
  PrinterIcon,
  SaveIcon,
  Undo2Icon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { EstadoInforme, Informe } from '~/features/operaciones/types'
import { InformesService } from '~/features/operaciones/services/informes'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'

interface ProyectoConDatos {
  sp: string
  nombre: string
}

interface DiaConDatos {
  date: string
  day: number
}

const informesService = new InformesService()
const route = useRoute()

const query = useQuery<Informe>()
const editMode = ref(false)
const saving = ref(false)
const changingEstado = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const htmlContent = ref('')

// ── Días en rojo ────────────────────────────────────────────────
const subProjectActivo = ref('')
const diasRojosMap = ref<Record<string, Set<string>>>({})

/** Clave del informe (o del proyecto activo, si es de portafolio) usada para agrupar los días en rojo. */
function claveActiva(informe: Informe): string {
  return informe.tipo === 'port' ? subProjectActivo.value : informe.sub_project || '_'
}

/** El contenedor DOM sobre el que operan los días en rojo: todo el informe, o solo la sección del proyecto activo si es de portafolio. */
function contenedorActivo(informe: Informe): HTMLElement | null {
  if (!contentRef.value) return null
  if (informe.tipo === 'port' && subProjectActivo.value) {
    return (
      contentRef.value.querySelector<HTMLElement>(
        `[data-sub-project="${subProjectActivo.value}"]`,
      ) ?? contentRef.value
    )
  }
  return contentRef.value
}

const proyectosDisponibles = computed<ProyectoConDatos[]>(() => {
  if (!contentRef.value) return []
  return [...contentRef.value.querySelectorAll('[data-sub-project]')].map((el) => {
    const sp = el.getAttribute('data-sub-project') ?? ''
    return { sp, nombre: el.getAttribute('data-nombre') || sp }
  })
})

const diasDisponibles = computed<DiaConDatos[]>(() => {
  const informe = query.data
  const container = informe ? contenedorActivo(informe) : null
  if (!container) return []
  const fechas = new Set<string>()
  container.querySelectorAll('rect[data-date]').forEach((r) => {
    const fecha = r.getAttribute('data-date')
    if (fecha) fechas.add(fecha)
  })
  return [...fechas].sort().map((date) => ({ date, day: Number(date.split('-')[2]) }))
})

const diasRojosActivos = computed<Set<string>>(() => {
  const informe = query.data
  if (!informe) return new Set()
  return diasRojosMap.value[claveActiva(informe)] ?? new Set()
})

function pintarDia(container: HTMLElement, fecha: string, color: string) {
  container
    .querySelectorAll(`rect[data-date="${fecha}"]`)
    .forEach((r) => r.setAttribute('fill', color))
}

function toggleDiaRojo(informe: Informe, fecha: string) {
  const clave = claveActiva(informe)
  const container = contenedorActivo(informe)
  const set = new Set(diasRojosMap.value[clave] ?? [])
  if (set.has(fecha)) {
    set.delete(fecha)
    if (container) pintarDia(container, fecha, '#6B35C0')
  } else {
    set.add(fecha)
    if (container) pintarDia(container, fecha, '#DC3232')
  }
  diasRojosMap.value = { ...diasRojosMap.value, [clave]: set }
}

function limpiarDiasRojos(informe: Informe) {
  const clave = claveActiva(informe)
  const set = diasRojosMap.value[clave] ?? new Set<string>()
  const container = contenedorActivo(informe)
  if (container) set.forEach((fecha) => pintarDia(container, fecha, '#6B35C0'))
  const map = { ...diasRojosMap.value }
  // Diccionario reactivo indexado por clave de proyecto: es el mismo caso que
  // `borrarClave` en `retos/components/retosUi.ts`, aislado acá por ser el
  // único sitio de todo el slice que lo necesita.
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete map[clave]
  diasRojosMap.value = map
}

watch(editMode, (activo) => {
  if (!activo) diasRojosMap.value = {}
})

watch(
  () => query.data?.tipo,
  () => {
    subProjectActivo.value = ''
    nextTick(() => {
      if (proyectosDisponibles.value.length)
        subProjectActivo.value = proyectosDisponibles.value[0]!.sp
    })
  },
)

// ── Cargar ───────────────────────────────────────────────────────
async function cargar() {
  await query.run(() => informesService.obtener(Number(route.params.id)))
  htmlContent.value = query.data?.html_content || ''
}
onMounted(cargar)

// ── Edición ──────────────────────────────────────────────────────
function enterEdit(informe: Informe) {
  editMode.value = true
  diasRojosMap.value = {}
  nextTick(() => {
    contentRef.value?.focus()
    if (informe.tipo === 'port' && proyectosDisponibles.value.length) {
      subProjectActivo.value = proyectosDisponibles.value[0]!.sp
    }
  })
}

function discardEdit(informe: Informe) {
  editMode.value = false
  htmlContent.value = informe.html_content || ''
}

async function saveEdit(informe: Informe) {
  if (!contentRef.value) return
  saving.value = true
  try {
    const nuevoHtml = contentRef.value.innerHTML
    const data = await informesService.guardar({
      tipo: informe.tipo,
      sub_project: informe.sub_project || '',
      periodo_desde: informe.periodo_desde || '',
      periodo_hasta: informe.periodo_hasta || '',
      periodo_display: informe.periodo_display || '',
      proyecto_nombre: informe.proyecto_nombre || '',
      html_content: nuevoHtml,
    })
    Object.assign(informe, data)
    htmlContent.value = nuevoHtml
    editMode.value = false
    toast.success('Informe guardado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    saving.value = false
  }
}

// ── Cambiar estado ───────────────────────────────────────────────
async function changeEstado(informe: Informe, nuevoEstado: EstadoInforme) {
  changingEstado.value = true
  try {
    const data = await informesService.cambiarEstado(informe.id, nuevoEstado)
    Object.assign(informe, data)
    if (nuevoEstado === 'aprobado') {
      try {
        const envio = await informesService.enviar(informe.id)
        toast.success(`Aprobado y enviado a ${envio.enviado_a}`)
      } catch (err) {
        const mensaje = normalizeError(err).message
        toast.success(`Aprobado${mensaje ? ` — ${mensaje}` : ' (correo no enviado)'}`)
      }
    } else {
      toast.success(`Estado: ${nuevoEstado}`)
    }
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    changingEstado.value = false
  }
}

// ── Imprimir ─────────────────────────────────────────────────────
function printInforme() {
  window.print()
}

// ── Estado ───────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, GandalfBadgeColor> = {
  borrador: 'warning',
  revisado: 'information',
  aprobado: 'success',
}

const ESTADO_TEXTO: Record<string, string> = {
  borrador: 'Borrador',
  revisado: 'Revisado',
  aprobado: 'Aprobado',
}

function estadoColor(estado?: EstadoInforme): GandalfBadgeColor {
  return (estado && ESTADO_COLOR[estado]) || 'default'
}

function estadoLabel(estado?: EstadoInforme): string {
  return (estado && ESTADO_TEXTO[estado]) || estado || ''
}
</script>

<!-- ══ CSS del INFORME (no-scoped: aplica al v-html generado por los paneles de informes) ══ -->
<style>
/* Clases del HTML del informe, inyectado con v-html: Tailwind no las ve. */
/* Paleta del informe impreso: el documento es "papel" con marca Unergy, así que
   no sigue el tema claro/oscuro. Todo se deriva de los tokens de marca. */
.rpt-page,
.fmo-page {
  --rpt-paper: white;
  --rpt-ink: var(--color-unergy-deep);
  --rpt-ink-2: color-mix(in oklab, white 6%, var(--color-unergy-deep));
  --rpt-ink-line: color-mix(in oklab, white 12%, var(--color-unergy-deep));
  --rpt-subtle: color-mix(in oklab, var(--color-unergy-deep) 60%, white);
  --rpt-faint: color-mix(in oklab, var(--color-unergy-deep) 40%, white);
  --rpt-line: color-mix(in oklab, var(--color-unergy-purple) 12%, white);
  --rpt-tint: color-mix(in oklab, var(--color-unergy-purple) 6%, white);
  --rpt-ok-bg: color-mix(in oklab, var(--success) 8%, white);
  --rpt-ok-ink: color-mix(in oklab, var(--success) 45%, black);
  --rpt-ok-line: color-mix(in oklab, var(--success) 25%, transparent);
  --rpt-multa-bg: color-mix(in oklab, var(--destructive) 6%, white);
  --rpt-multa-ink: color-mix(in oklab, var(--destructive) 60%, black);
  --rpt-multa-line: color-mix(in oklab, var(--destructive) 25%, transparent);
  --rpt-shadow: color-mix(in oklab, black 25%, transparent);
}
.rpt-page {
  background: var(--rpt-paper);
  color: var(--rpt-ink);
  font-family: 'Sora', sans-serif;
  font-size: 12px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 30px var(--rpt-shadow);
  margin-bottom: 24px;
}
.rpt-header {
  background: var(--rpt-ink);
  padding: 18px 28px;
}
.rpt-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 14px;
  border: 1px solid var(--rpt-ink-line);
  border-radius: 8px;
  overflow: hidden;
}
.rpt-meta-item {
  background: var(--rpt-ink-2);
  padding: 10px 14px;
  border-right: 1px solid var(--rpt-ink-line);
}
.rpt-meta-item:last-child {
  border-right: none;
}
.rpt-meta-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--rpt-subtle);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.rpt-meta-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--rpt-paper);
}
.rpt-section {
  padding: 16px 28px;
  border-bottom: 1px solid var(--rpt-line);
}
.rpt-section:last-of-type {
  border-bottom: none;
}
.rpt-section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--rpt-ink);
  margin-bottom: 13px;
  padding-left: 10px;
  border-left: 3px solid var(--color-unergy-purple);
}
.rpt-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.rpt-kpi {
  background: var(--rpt-tint);
  border: 1px solid var(--rpt-line);
  border-radius: 10px;
  padding: 13px 15px;
}
.rpt-kpi-ico {
  font-size: 17px;
  margin-bottom: 4px;
}
.rpt-kpi-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--rpt-faint);
  letter-spacing: 0.7px;
  text-transform: uppercase;
  margin-bottom: 3px;
}
.rpt-kpi-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--rpt-ink);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
}
.rpt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.rpt-table th {
  background: var(--rpt-ink);
  color: var(--color-unergy-yellow);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 8px 10px;
  text-align: left;
}
.rpt-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--rpt-line);
  vertical-align: top;
  line-height: 1.5;
}
.rpt-table tbody tr:nth-child(even) td {
  background: var(--rpt-tint);
}
.rpt-total-row td {
  background: var(--rpt-line) !important;
  font-weight: 700;
  border-top: 2px solid var(--color-unergy-purple);
}
.rpt-chart-card {
  background: var(--rpt-tint);
  border: 1px solid var(--rpt-line);
  border-radius: 10px;
  padding: 14px;
}
.rpt-obs-title {
  font-size: 9px;
  font-weight: 700;
  color: var(--rpt-faint);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 9px;
}
.rpt-obs-text {
  font-size: 12px;
  color: var(--color-unergy-deep-light);
  line-height: 1.8;
  background: var(--rpt-tint);
  border-radius: 8px;
  padding: 13px 15px;
  border-left: 3px solid var(--success);
}
.rpt-status-box {
  background: var(--rpt-tint);
  border: 1px solid var(--rpt-line);
  border-radius: 10px;
  padding: 15px;
  font-size: 12px;
  color: var(--color-unergy-deep-light);
}
.rpt-status-row {
  font-size: 11px;
  color: var(--rpt-subtle);
  margin-top: 5px;
}
.rpt-footer {
  background: var(--rpt-tint);
  border-top: 1px solid var(--rpt-line);
  padding: 10px 28px;
  font-size: 10px;
  color: var(--rpt-faint);
  display: flex;
  justify-content: space-between;
}
/* FMO */
.fmo-page {
  background: var(--rpt-paper);
  color: var(--rpt-ink);
  font-family: 'Sora', sans-serif;
  font-size: 12px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 30px var(--rpt-shadow);
  margin-bottom: 24px;
}
.fmo-header {
  background: var(--rpt-ink);
  padding: 18px 28px;
}
.fmo-section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--rpt-ink);
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid var(--color-unergy-purple);
}
.fmo-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.fmo-kpi {
  background: var(--rpt-tint);
  border: 1px solid var(--rpt-line);
  border-radius: 10px;
  padding: 12px 14px;
}
.fmo-kpi-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--rpt-faint);
  letter-spacing: 0.7px;
  text-transform: uppercase;
  margin-bottom: 3px;
}
.fmo-kpi-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--rpt-ink);
  font-family: 'JetBrains Mono', monospace;
}
.fmo-ok-box {
  background: var(--rpt-ok-bg);
  border: 1px solid var(--rpt-ok-line);
  border-radius: 10px;
  padding: 14px 18px;
  color: var(--rpt-ok-ink);
  font-size: 12px;
}
.fmo-multa-box {
  background: var(--rpt-multa-bg);
  border: 1px solid var(--rpt-multa-line);
  border-radius: 10px;
  padding: 14px 18px;
  color: var(--rpt-multa-ink);
  font-size: 12px;
}
.fmo-inv-table,
.fmo-mant-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.fmo-inv-table th,
.fmo-mant-table th {
  background: var(--rpt-ink);
  color: var(--color-unergy-yellow);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 8px 10px;
  text-align: left;
}
.fmo-inv-table td,
.fmo-mant-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--rpt-line);
  vertical-align: top;
  line-height: 1.5;
}
/* Print */
@page {
  margin: 6mm 8mm;
  size: A4 portrait;
}
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    background: var(--rpt-paper) !important;
  }
  /* Cada página ocupa el alto imprimible para anclar el pie abajo, sin partir estructura */
  .rpt-page,
  .fmo-page {
    box-shadow: none !important;
    border-radius: 0 !important;
    margin-bottom: 0 !important;
    overflow: visible !important;
    page-break-after: always;
    break-after: page;
    display: flex !important;
    flex-direction: column !important;
    min-height: calc(297mm - 12mm - 1mm);
  }
  .rpt-page:last-child,
  .fmo-page:last-child {
    page-break-after: auto !important;
  }
  .rpt-footer {
    margin-top: auto !important;
  }
  .rpt-section,
  .rpt-kpi-row,
  .rpt-kpi,
  .rpt-chart-card,
  .rpt-status-box,
  .rpt-obs-text,
  .fmo-ok-box,
  .fmo-multa-box {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rpt-section-title,
  .fmo-section-title {
    break-after: avoid;
    page-break-after: avoid;
  }
  .rpt-table tr,
  .fmo-inv-table tr,
  .fmo-mant-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rpt-table thead,
  .fmo-inv-table thead,
  .fmo-mant-table thead {
    display: table-header-group;
  }
  .rpt-header,
  .fmo-header {
    background: var(--rpt-ink) !important;
  }
  .rpt-meta-item {
    background: var(--rpt-ink-2) !important;
  }
  .rpt-table th,
  .fmo-inv-table th,
  .fmo-mant-table th {
    background: var(--rpt-ink) !important;
    color: var(--color-unergy-yellow) !important;
  }
  .rpt-total-row td {
    background: var(--rpt-line) !important;
  }
}
</style>
