<script setup lang="ts">
/**
 * Detalle contable de un proyecto (Preliquidación/Oficial): el 100% del
 * proyecto y, expandible, el desglose editable por inversionista. Casi
 * autónomo: llama la API directamente y edita las líneas de `panel` en el
 * sitio, pero cuando el backend devuelve el panel entero (remapear una celda,
 * renombrar/agregar/quitar una fuente) emite `actualizar-panel` — reemplazar
 * el objeto sería mutar la prop, que le pertenece a `paneles` en el padre.
 */
import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { BLOQUES_PLANO, SECCIONES_DETALLE } from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import {
  type DocumentoContable,
  type InversionistaPanel,
  type LineaPanel,
  type PanelContable,
  GrupoLinea,
  OrigenPanel,
  TipoPanel,
} from '~/features/panel-contable/types'
import {
  fmt,
  fuenteLabel,
  fuenteOrigen,
  fuenteTitle,
  montoPlano,
  parseCeldaOrigen,
  parseMonto,
  shortName,
} from '~/features/panel-contable/utils/formatters'

const props = defineProps<{
  panel: PanelContable
  periodo: string
  tab: TipoPanel
  defaultOpen: boolean
  bloqueFiltro: DocumentoContable | ''
}>()

const emit = defineEmits<{
  'actualizar-panel': [panel: PanelContable]
}>()

const panelContableService = new PanelContableService()
const confirm = useConfirm()

const activo = computed(() => !!(props.panel.liquidar_ingresos || props.panel.liquidar_costos))

const dirty = ref(false)
const savedAt = ref(false)
const invOpen = ref(false)
const editandoMonto = ref<number | null>(null)
const subiendoSoporte = ref<string | null>(null)

function markDirty() {
  dirty.value = true
  savedAt.value = false
}

const bloquesMostrados = computed(() =>
  props.bloqueFiltro ? BLOQUES_PLANO.filter((b) => b.key === props.bloqueFiltro) : BLOQUES_PLANO,
)

function lineas100Bloque(bloque: (typeof BLOQUES_PLANO)[number]): LineaPanel[] {
  return (props.panel.total_100 || []).filter((l) => bloque.keys.includes(l.grupo))
}
function total100Bloque(bloque: (typeof BLOQUES_PLANO)[number]): number {
  return lineas100Bloque(bloque).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
}
const utilidad100 = computed(() =>
  (props.panel.total_100 || []).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0),
)

function lineasSec(inv: InversionistaPanel, keys: GrupoLinea[]): LineaPanel[] {
  return inv.lineas.filter((l) => keys.includes(l.grupo))
}
function totalSec(inv: InversionistaPanel, keys: GrupoLinea[]): number {
  return lineasSec(inv, keys).reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
}

// Subtotales "Valor a pagar" por bloque contable: mismas combinaciones que `BLOQUES_PLANO`.
const KEYS_INGRESOS_COMERCIALIZACION = [GrupoLinea.INGRESOS, GrupoLinea.COMERCIALIZACION]
const KEYS_COSTOS = [GrupoLinea.COSTOS]
const KEYS_FACTURAS = [GrupoLinea.FACTURAS]
function utilidad(inv: InversionistaPanel): number {
  return inv.lineas.reduce((s, l) => s + (Number(l.valor_cop) || 0), 0)
}
function invKeyOf(inv: InversionistaPanel): number | string {
  return inv.proyecto_inversionista_id ?? inv.nombre ?? ''
}

function sopKey(ln: LineaPanel): string {
  return `${ln.grupo}|${ln.concepto}`
}

function commitMonto(ln: LineaPanel, ev: FocusEvent) {
  const v = parseMonto((ev.target as HTMLInputElement).value)
  if (v !== Number(ln.valor_cop)) {
    ln.valor_cop = v
    markDirty()
  }
  editandoMonto.value = null
}

async function guardar() {
  const lineas: { id: number; valor_cop: number; comprobante_contable?: string }[] = []
  props.panel.inversionistas.forEach((inv) =>
    inv.lineas.forEach((l) => {
      lineas.push({
        id: l.id,
        valor_cop: Number(l.valor_cop) || 0,
        comprobante_contable: l.comprobante_contable,
      })
    }),
  )
  try {
    await panelContableService.actualizarPanel(props.panel.id, { lineas })
    dirty.value = false
    savedAt.value = true
    toast.success('Guardado', { description: props.panel.proyecto, duration: 2500 })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo guardar', { description: normalizeError(err).message, duration: 4000 })
  }
}

async function descargarEr() {
  try {
    const data = await panelContableService.descargarEstadoResultados(props.panel.id)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `Estado resultados ${props.panel.proyecto_nombre || props.panel.proyecto} ${props.periodo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo generar el ER', {
      description: normalizeError(err).message,
      duration: 6000,
    })
  }
}

function aplicarSoporte(grupo: GrupoLinea, concepto: string, soporte: LineaPanel['soporte']) {
  for (const inv of props.panel.inversionistas) {
    for (const l of inv.lineas) {
      if (l.grupo === grupo && l.concepto === concepto) l.soporte = soporte
    }
  }
  for (const l of props.panel.total_100) {
    if (l.grupo === grupo && l.concepto === concepto) l.soporte = soporte
  }
}

function pickSoporte(ln: LineaPanel) {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = () => {
    const f = input.files?.[0]
    if (f) subirSoporte(ln, f)
  }
  input.click()
}

async function subirSoporte(ln: LineaPanel, file: File) {
  subiendoSoporte.value = sopKey(ln)
  try {
    const data = await panelContableService.subirSoporte(props.panel.id, {
      archivo: file,
      grupo: ln.grupo,
      concepto: ln.concepto,
    })
    aplicarSoporte(ln.grupo, ln.concepto, {
      archivo_url: data.archivo_url,
      archivo_nombre: data.archivo_nombre,
    })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo subir el soporte', {
      description: normalizeError(err).message,
      duration: 4500,
    })
  } finally {
    subiendoSoporte.value = null
  }
}

function eliminarSoporte(ln: LineaPanel) {
  confirm({
    title: 'Quitar soporte',
    description: `¿Quitar el soporte de "${ln.concepto}"? El archivo queda en Drive.`,
    confirmLabel: 'Quitar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await panelContableService.eliminarSoporte(props.panel.id, ln.grupo, ln.concepto)
        aplicarSoporte(ln.grupo, ln.concepto, null)
      } catch (err) {
        logger.error('panel-contable', err)
        toast.error('No se pudo quitar el soporte', {
          description: normalizeError(err).message,
          duration: 4500,
        })
      }
    },
  })
}

async function renombrarFuente(ln: LineaPanel, nuevaEtiqueta: string) {
  if (!ln.hoja || !ln.celda) {
    toast.warning('Sin celda de origen', {
      description: 'Esta fuente no tiene celda de origen; primero asígnale una',
      duration: 4000,
    })
    return
  }
  const etiqueta = nuevaEtiqueta.trim()
  if (!etiqueta || etiqueta === ln.concepto) return
  try {
    const data = await panelContableService.renombrarFuente({
      proyecto_id: props.panel.proyecto_id,
      periodo: props.periodo,
      tipo: props.tab,
      columna_origen: ln.origen || `${ln.hoja}!${ln.celda}`,
      etiqueta,
    })
    emit('actualizar-panel', data)
    toast.success('Fuente renombrada', { description: etiqueta, duration: 2500 })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo renombrar la fuente', {
      description: normalizeError(err).message,
      duration: 4500,
    })
  }
}

function quitarFuente(ln: LineaPanel) {
  confirm({
    title: 'Quitar fuente',
    description: `¿Quitar la fuente "${ln.concepto}"?`,
    confirmLabel: 'Quitar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        const data = await panelContableService.quitarFuenteIngreso({
          proyecto_id: props.panel.proyecto_id,
          periodo: props.periodo,
          tipo: props.tab,
          columna_origen: ln.origen || `${ln.hoja}!${ln.celda}`,
        })
        emit('actualizar-panel', data)
        toast.success('Fuente quitada', { description: ln.concepto, duration: 2500 })
      } catch (err) {
        logger.error('panel-contable', err)
        toast.error('No se pudo quitar la fuente', {
          description: normalizeError(err).message,
          duration: 4500,
        })
      }
    },
  })
}

// ── Agregar fuente de ingreso: diálogo (reemplaza los `window.prompt` del legacy) ──
const agregarFuenteOpen = ref(false)
const agregarFuenteEtiqueta = ref('')
const agregarFuenteCelda = ref('')

function abrirAgregarFuente() {
  agregarFuenteEtiqueta.value = ''
  agregarFuenteCelda.value = ''
  agregarFuenteOpen.value = true
}

async function confirmarAgregarFuente() {
  const etiqueta = agregarFuenteEtiqueta.value.trim()
  if (!etiqueta) return
  const celda = parseCeldaOrigen(agregarFuenteCelda.value)
  if (!celda) {
    toast.warning('Formato inválido', {
      description: 'Usa hoja!celda, ej. Sheet1!H35',
      duration: 3500,
    })
    return
  }
  try {
    const data = await panelContableService.agregarFuenteIngreso({
      proyecto_id: props.panel.proyecto_id,
      periodo: props.periodo,
      tipo: props.tab,
      etiqueta,
      hoja: celda.hoja,
      celda: celda.celda,
    })
    emit('actualizar-panel', data)
    agregarFuenteOpen.value = false
    toast.success('Fuente agregada', { description: etiqueta, duration: 2500 })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo agregar la fuente', {
      description: normalizeError(err).message,
      duration: 4500,
    })
  }
}
</script>

<template>
  <Collapsible
    v-slot="{ open }"
    :default-open="defaultOpen"
    class="overflow-hidden rounded-xl border bg-card transition-opacity"
    :class="{ 'opacity-45': !activo }"
  >
    <CollapsibleTrigger as-child>
      <div
        role="button"
        tabindex="0"
        class="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-muted/40"
      >
        <ChevronRightIcon
          class="size-3.5 shrink-0 text-muted-foreground transition-transform"
          :class="{ 'rotate-90': open }"
        />
        <span class="min-w-36 flex-1 text-sm font-semibold text-foreground">{{
          panel.proyecto
        }}</span>
        <GBadge v-if="!panel.tiene_costos" color="warning">sin costos</GBadge>
        <GBadge v-if="panel.tiene_bolsa" color="information">bolsa</GBadge>
        <GBadge v-if="panel.generar_mandatos" color="success">genera mandatos</GBadge>
        <GBadge v-if="panel.liquidar_ingresos && !panel.liquidar_costos" color="information"
          >solo ingresos</GBadge
        >
        <GBadge v-if="!panel.liquidar_ingresos && panel.liquidar_costos" color="information"
          >solo costos</GBadge
        >
        <GBadge v-if="!activo" color="default">no liquida</GBadge>

        <!-- Con qué se armó el panel: los ingresos no tienen columna `fuente`, así que sin esto no habría forma de saberlo. -->
        <GTooltip>
          <GTooltipTrigger as-child>
            <GBadge :color="panel.origen === OrigenPanel.API ? 'success' : 'default'">{{
              panel.origen === OrigenPanel.API ? 'API' : 'Excel'
            }}</GBadge>
          </GTooltipTrigger>
          <GTooltipContent side="top">{{
            panel.origen === OrigenPanel.API
              ? 'Armado desde la API de Liquidaciones'
              : 'Armado desde el Excel del Estado de Resultados'
          }}</GTooltipContent>
        </GTooltip>

        <div class="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span
            >Ing:
            <b class="text-foreground">{{
              tab === TipoPanel.OFICIAL ? (panel.consecutivo_ingresos ?? '—') : '—'
            }}</b></span
          >
          <span
            >Cost:
            <b class="text-foreground">{{
              tab === TipoPanel.OFICIAL ? (panel.consecutivo_costos ?? '—') : '—'
            }}</b></span
          >
          <GTooltip>
            <GTooltipTrigger as-child>
              <Button variant="outline" size="xs" @click.stop="descargarEr">
                <DownloadIcon class="size-3.5" />
                ER
              </Button>
            </GTooltipTrigger>
            <GTooltipContent side="left"
              >Descargar el Estado de Resultados de este proyecto</GTooltipContent
            >
          </GTooltip>
        </div>
      </div>
    </CollapsibleTrigger>

    <CollapsibleContent class="border-t">
      <!-- Tabla plana 100% (vista por defecto) -->
      <div class="overflow-x-auto">
        <GTable>
          <GTableHeader>
            <GTableRow>
              <GTableHead>Concepto</GTableHead>
              <GTableHead>Fuente</GTableHead>
              <GTableHead class="text-right">Valor</GTableHead>
              <GTableHead>Comprobante</GTableHead>
              <GTableHead>Soporte</GTableHead>
            </GTableRow>
          </GTableHeader>
          <GTableBody>
            <template v-for="blk in bloquesMostrados" :key="blk.key">
              <GTableRow class="bg-muted/30 hover:bg-muted/30">
                <GTableCell
                  colspan="5"
                  class="text-[11px] font-semibold tracking-wide text-primary uppercase"
                  >{{ blk.label }}</GTableCell
                >
              </GTableRow>
              <GTableRow v-for="(ln, i) in lineas100Bloque(blk)" :key="blk.key + i">
                <GTableCell :class="{ 'text-muted-foreground italic': ln.derivada }">
                  {{ ln.concepto }}
                  <GBadge v-if="ln.derivada" size="sm" color="information" class="ml-1.5"
                    >impuesto</GBadge
                  >
                </GTableCell>
                <GTableCell>
                  <GTooltip v-if="ln.fuente">
                    <GTooltipTrigger as-child>
                      <GBadge size="sm" color="success">{{ fuenteLabel(ln.fuente) }}</GBadge>
                    </GTooltipTrigger>
                    <GTooltipContent>{{ fuenteTitle(ln.fuente) }}</GTooltipContent>
                  </GTooltip>
                  <span v-else-if="!ln.derivada" class="text-[11px] text-muted-foreground">ER</span>
                </GTableCell>
                <GTableCell
                  class="text-right tabular-nums"
                  :class="{ 'text-destructive': (ln.valor_cop ?? 0) < 0 }"
                  >{{ fmt(ln.valor_cop) }}</GTableCell
                >
                <GTableCell class="text-muted-foreground">{{
                  ln.comprobante_contable || ''
                }}</GTableCell>
                <GTableCell>
                  <template v-if="ln.derivada" />
                  <template v-else-if="ln.soporte">
                    <a
                      class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                      :href="ln.soporte.archivo_url"
                      target="_blank"
                      rel="noopener"
                      :title="ln.soporte.archivo_nombre || 'Ver soporte'"
                      ><PaperclipIcon class="size-3" /> ver</a
                    >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Quitar soporte"
                      class="ml-1 text-muted-foreground hover:text-destructive"
                      @click="eliminarSoporte(ln)"
                      ><XIcon class="size-3.5"
                    /></Button>
                  </template>
                  <Button
                    v-else
                    variant="outline"
                    size="xs"
                    class="border-dashed"
                    :disabled="subiendoSoporte === sopKey(ln)"
                    title="Subir soporte"
                    @click="pickSoporte(ln)"
                  >
                    <LoaderCircleIcon v-if="subiendoSoporte === sopKey(ln)" class="animate-spin" />
                    <PaperclipIcon v-else />
                    subir
                  </Button>
                </GTableCell>
              </GTableRow>
              <GTableRow class="bg-muted/20 font-medium hover:bg-muted/20">
                <GTableCell colspan="2">Valor a pagar</GTableCell>
                <GTableCell
                  class="text-right tabular-nums"
                  :class="{ 'text-destructive': total100Bloque(blk) < 0 }"
                  >{{ fmt(total100Bloque(blk)) }}</GTableCell
                >
                <GTableCell colspan="2" />
              </GTableRow>
            </template>
            <GTableRow
              class="border-t-2 border-t-primary bg-muted/30 font-semibold hover:bg-muted/30"
            >
              <GTableCell colspan="2" class="text-foreground"
                >RESULTADO · Valor a pagar (100%)</GTableCell
              >
              <GTableCell
                class="text-right tabular-nums"
                :class="{ 'text-destructive': utilidad100 < 0 }"
                >{{ fmt(utilidad100) }}</GTableCell
              >
              <GTableCell colspan="2" />
            </GTableRow>
          </GTableBody>
        </GTable>
      </div>

      <!-- Desglose por inversionista (expandible; aquí se editan valores/comprobante) -->
      <Collapsible v-model:open="invOpen">
        <CollapsibleTrigger as-child>
          <Button variant="ghost" size="sm" class="m-3">
            <ChevronRightIcon
              class="size-3.5 transition-transform"
              :class="{ 'rotate-90': invOpen }"
            />
            {{ invOpen ? 'Ocultar' : 'Ver' }} desglose por inversionista ({{
              panel.inversionistas.length
            }})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div v-for="inv in panel.inversionistas" :key="invKeyOf(inv)" class="border-t">
            <div class="flex items-center gap-3 bg-muted/40 px-4 py-2">
              <span class="flex-1 text-xs font-semibold text-foreground"
                >{{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%</span
              >
              <span class="text-xs text-muted-foreground tabular-nums"
                >Ing:
                <b class="text-foreground">{{
                  tab === TipoPanel.OFICIAL && panel.liquidar_ingresos
                    ? (panel.consecutivo_ingresos ?? '—')
                    : '—'
                }}</b></span
              >
              <span class="text-xs text-muted-foreground tabular-nums"
                >Cost:
                <b class="text-foreground">{{
                  tab === TipoPanel.OFICIAL && panel.liquidar_costos
                    ? (panel.consecutivo_costos ?? '—')
                    : '—'
                }}</b></span
              >
            </div>

            <!-- Acordeones por sección: colapsados → solo título + total -->
            <template v-for="sec in SECCIONES_DETALLE" :key="sec.key">
              <Collapsible
                v-if="lineasSec(inv, sec.keys).length || sec.key === 'ingresos'"
                v-slot="{ open: secAbierta }"
                class="border-t"
              >
                <CollapsibleTrigger as-child>
                  <div class="flex cursor-pointer items-center gap-2 px-4 py-2.5 hover:bg-muted/30">
                    <ChevronRightIcon
                      class="size-3 shrink-0 text-muted-foreground transition-transform"
                      :class="{ 'rotate-90': secAbierta }"
                    />
                    <span
                      class="flex-1 text-[11px] font-semibold tracking-wide text-foreground uppercase"
                      >{{ sec.label }}</span
                    >
                    <span
                      class="text-sm font-bold tabular-nums"
                      :class="totalSec(inv, sec.keys) < 0 ? 'text-destructive' : 'text-foreground'"
                      >{{ fmt(totalSec(inv, sec.keys)) }}</span
                    >
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div class="overflow-x-auto border-t">
                    <GTable>
                      <GTableHeader>
                        <GTableRow>
                          <GTableHead>Concepto</GTableHead>
                          <GTableHead class="text-right"
                            >Valor ({{ shortName(inv.nombre) }})</GTableHead
                          >
                          <GTableHead>Comprobante</GTableHead>
                          <GTableHead>Soporte</GTableHead>
                        </GTableRow>
                      </GTableHeader>
                      <GTableBody>
                        <GTableRow
                          v-for="ln in lineasSec(inv, sec.keys)"
                          :key="ln.id || ln.grupo + '|' + ln.concepto"
                        >
                          <GTableCell>
                            <div v-if="sec.key === 'ingresos'" class="flex items-center gap-1">
                              <Input
                                class="h-7 w-48"
                                :model-value="ln.concepto"
                                @change="
                                  renombrarFuente(ln, ($event.target as HTMLInputElement).value)
                                "
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                title="Quitar fuente"
                                class="text-muted-foreground hover:text-destructive"
                                @click="quitarFuente(ln)"
                                ><XIcon class="size-3.5"
                              /></Button>
                            </div>
                            <div v-else :class="{ 'text-muted-foreground italic': ln.derivada }">
                              {{ ln.concepto }}
                              <GBadge
                                v-if="ln.derivada"
                                size="sm"
                                color="information"
                                class="ml-1.5"
                                >impuesto</GBadge
                              >
                              <GTooltip v-if="ln.fuente">
                                <GTooltipTrigger as-child>
                                  <GBadge size="sm" color="success" class="ml-1.5">{{
                                    fuenteLabel(ln.fuente)
                                  }}</GBadge>
                                </GTooltipTrigger>
                                <GTooltipContent>{{ fuenteTitle(ln.fuente) }}</GTooltipContent>
                              </GTooltip>
                            </div>
                            <!-- Valor de módulo (O&M / Arriendos): no viene de una celda del ER. -->
                            <p
                              v-if="!ln.derivada && ln.fuente"
                              class="mt-0.5 text-[10px] text-emerald-600"
                            >
                              ↳ {{ fuenteOrigen(ln.fuente) }}
                            </p>
                          </GTableCell>
                          <GTableCell class="text-right">
                            <Input
                              v-if="!ln.derivada"
                              class="h-7 w-32 text-right tabular-nums"
                              :class="{ 'text-destructive': (ln.valor_cop ?? 0) < 0 }"
                              type="text"
                              inputmode="decimal"
                              :model-value="
                                editandoMonto === ln.id
                                  ? montoPlano(ln.valor_cop)
                                  : fmt(ln.valor_cop)
                              "
                              @focus="editandoMonto = ln.id"
                              @blur="commitMonto(ln, $event)"
                              @keyup.enter="($event.target as HTMLInputElement).blur()"
                            />
                            <span
                              v-else
                              class="text-xs text-muted-foreground tabular-nums"
                              :class="{ 'text-destructive': (ln.valor_cop ?? 0) < 0 }"
                              >{{ fmt(ln.valor_cop) }}</span
                            >
                          </GTableCell>
                          <GTableCell>
                            <Input
                              v-if="!ln.derivada"
                              v-model="ln.comprobante_contable"
                              class="h-7 w-28"
                              placeholder="comprob."
                              @change="markDirty"
                            />
                          </GTableCell>
                          <GTableCell>
                            <template v-if="ln.derivada" />
                            <template v-else-if="ln.soporte">
                              <a
                                class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                                :href="ln.soporte.archivo_url"
                                target="_blank"
                                rel="noopener"
                                :title="ln.soporte.archivo_nombre || 'Ver soporte'"
                                ><PaperclipIcon class="size-3" /> ver</a
                              >
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                title="Quitar soporte"
                                class="ml-1 text-muted-foreground hover:text-destructive"
                                @click="eliminarSoporte(ln)"
                                ><XIcon class="size-3.5"
                              /></Button>
                            </template>
                            <Button
                              v-else
                              variant="outline"
                              size="xs"
                              class="border-dashed"
                              :disabled="subiendoSoporte === sopKey(ln)"
                              title="Subir soporte"
                              @click="pickSoporte(ln)"
                            >
                              <LoaderCircleIcon
                                v-if="subiendoSoporte === sopKey(ln)"
                                class="animate-spin"
                              />
                              <PaperclipIcon v-else />
                              subir
                            </Button>
                          </GTableCell>
                        </GTableRow>
                        <GTableRow v-if="sec.key === 'ingresos'">
                          <GTableCell colspan="4">
                            <Button
                              variant="outline"
                              size="xs"
                              class="border-dashed"
                              @click="abrirAgregarFuente"
                            >
                              <PlusIcon />
                              Agregar fuente de ingreso
                            </Button>
                          </GTableCell>
                        </GTableRow>
                      </GTableBody>
                    </GTable>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <!-- Subtotales "Valor a pagar" por bloque contable (Mandato/Costos/Facturas) -->
              <div
                v-if="sec.key === 'comercializacion'"
                class="flex items-center gap-3 border-t border-dashed bg-muted/20 px-4 py-1.5"
              >
                <span class="flex-1 text-xs font-medium text-muted-foreground italic"
                  >Valor a pagar (Ingresos − Comercialización)</span
                >
                <span
                  class="text-xs font-bold tabular-nums"
                  :class="
                    totalSec(inv, KEYS_INGRESOS_COMERCIALIZACION) < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  "
                  >{{ fmt(totalSec(inv, KEYS_INGRESOS_COMERCIALIZACION)) }}</span
                >
              </div>
              <div
                v-else-if="sec.key === 'costos'"
                class="flex items-center gap-3 border-t border-dashed bg-muted/20 px-4 py-1.5"
              >
                <span class="flex-1 text-xs font-medium text-muted-foreground italic"
                  >Valor a pagar (Costos Operativos)</span
                >
                <span
                  class="text-xs font-bold tabular-nums"
                  :class="
                    totalSec(inv, KEYS_COSTOS) < 0 ? 'text-destructive' : 'text-muted-foreground'
                  "
                  >{{ fmt(totalSec(inv, KEYS_COSTOS)) }}</span
                >
              </div>
              <div
                v-else-if="sec.key === 'facturas'"
                class="flex items-center gap-3 border-t border-dashed bg-muted/20 px-4 py-1.5"
              >
                <span class="flex-1 text-xs font-medium text-muted-foreground italic"
                  >Valor a pagar (Facturas de Servicio)</span
                >
                <span
                  class="text-xs font-bold tabular-nums"
                  :class="
                    totalSec(inv, KEYS_FACTURAS) < 0 ? 'text-destructive' : 'text-muted-foreground'
                  "
                  >{{ fmt(totalSec(inv, KEYS_FACTURAS)) }}</span
                >
              </div>
            </template>

            <!-- RESULTADO · valor a pagar: siempre visible -->
            <div class="flex items-center gap-3 border-t bg-primary/5 px-4 py-3">
              <span class="flex-1 text-xs font-semibold text-primary"
                >RESULTADO · Valor a pagar</span
              >
              <span
                class="text-sm font-bold tabular-nums"
                :class="utilidad(inv) < 0 ? 'text-destructive' : 'text-primary'"
                >{{ fmt(utilidad(inv)) }}</span
              >
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div class="flex items-center gap-3 border-t px-4 py-3">
        <Button :disabled="!dirty" @click="guardar">
          <SaveIcon />
          Guardar cambios
        </Button>
        <span v-if="savedAt" class="inline-flex items-center gap-1 text-xs text-emerald-600"
          ><CheckIcon class="size-3.5" /> guardado</span
        >
      </div>
    </CollapsibleContent>
  </Collapsible>

  <Dialog v-model:open="agregarFuenteOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Agregar fuente de ingreso</DialogTitle>
        <DialogDescription
          >Se toma de una celda del ER, como las demás fuentes de Ingresos.</DialogDescription
        >
      </DialogHeader>
      <div class="space-y-3">
        <Field>
          <FieldLabel>Nombre de la fuente</FieldLabel>
          <Input v-model="agregarFuenteEtiqueta" placeholder="ej. Ingreso Bruto PPA" />
        </Field>
        <Field>
          <FieldLabel>Celda de origen</FieldLabel>
          <Input v-model="agregarFuenteCelda" placeholder="hoja!celda, ej. Sheet1!H35" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="agregarFuenteOpen = false">Cancelar</Button>
        <Button
          :disabled="!agregarFuenteEtiqueta.trim() || !agregarFuenteCelda.trim()"
          @click="confirmarAgregarFuente"
          >Agregar</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
