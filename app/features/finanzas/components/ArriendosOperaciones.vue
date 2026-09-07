<template>
  <div class="space-y-4 pt-3">

    <!-- ── Barra superior ────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between flex-wrap gap-2 border" style="border-color:#ECE7F2">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <button type="button" @click="cambiarMes(-1)"
            class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeftIcon class="text-xs text-gray-500 size-[1em]" />
          </button>
          <span class="text-sm font-semibold" style="color:var(--color-unergy-deep); min-width:100px; text-align:center">
            {{ periodoLabel }}
          </span>
          <button type="button" @click="cambiarMes(1)"
            class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRightIcon class="text-xs text-gray-500 size-[1em]" />
          </button>
        </div>
        <GBadge color="default" class="text-xs font-mono">{{ periodoActual }}</GBadge>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative">
          <Button label="Columnas" size="small" outlined severity="secondary" @click="showColMenu = !showColMenu">
            <template #icon><TableIcon class="size-[1em]" /></template>
          </Button>
          <div v-if="showColMenu"
            class="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-1"
            style="min-width:240px">
            <p class="text-xs font-semibold text-gray-500 mb-2">Mostrar columnas</p>
            <label v-for="col in columnasOpcionales" :key="col.key"
              class="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
              <input type="checkbox" v-model="colsVisibles[col.key]" class="accent-purple-600" />
              {{ col.label }}
            </label>
          </div>
        </div>
        <Button label="IPC" size="small" outlined @click="showIPCDialog = true" style="border-color:var(--color-unergy-purple);color:var(--color-unergy-purple)">
          <template #icon><ChartLineIcon class="size-[1em]" /></template>
        </Button>
        <ArriendosZipUpload
          :proyectos="filasParaZip"
          :periodo="periodoActual"
          :periodo-label="periodoLabel"
          @docs-actualizados="() => loadDocs(periodoActual.value)" />
        <Button label="Guardar selección" size="small" :loading="guardando" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)" @click="guardarSeleccion">
          <template #icon><SaveIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- ── Filtros ──────────────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Buscar</label>
        <input v-model="filtroTexto" type="text" placeholder="Nombre del proyecto…"
          class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56" style="outline:none" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Estado contrato</label>
        <select v-model="filtroEstado" class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-44">
          <option value="todos">Todos</option>
          <option value="con_contrato">Con contrato</option>
          <option value="en_tramite">En trámite</option>
          <option value="sin_contrato">Sin contrato</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Periodicidad</label>
        <select v-model="filtroPeriodicidad" class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-40">
          <option value="todos">Toda periodicidad</option>
          <option value="mensual">Mensual</option>
          <option value="bimestral">Bimestral</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Aplica este mes</label>
        <select v-model="filtroAplica" class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-48">
          <option value="todos">Todos</option>
          <option value="aplica">Aplican este mes</option>
          <option value="no">No aplican este mes</option>
        </select>
      </div>
      <div class="ml-auto pb-1.5 text-xs text-gray-400">{{ filasFiltradas.length }} de {{ filas.length }}</div>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────────── -->
    <template v-if="filasFiltradas.length">
     <div v-for="sec in secciones" :key="sec.tipo"
       class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">

      <!-- Cabecera de sección (colapsable) -->
      <button type="button"
        class="w-full flex items-center gap-3 px-4 py-2.5 text-left select-none hover:bg-gray-50 transition-colors duration-150"
        @click="toggleSection(sec.tipo)">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: sec.dot }" />
        <span class="font-semibold text-gray-800 text-sm flex-1">{{ sec.label }}</span>
        <span class="text-xs text-gray-400 font-medium">({{ sec.items.length }})</span>
        <ChevronDownIcon class="text-gray-400 text-xs ml-2 transition-transform duration-200 size-[1em]" :class="{ 'rotate-180': openSections.has(sec.tipo) }" />
      </button>

      <div class="section-collapse" :class="{ open: openSections.has(sec.tipo) }">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse" style="min-width:1080px; table-layout:fixed">
          <thead>
            <tr class="bg-gray-50 border-t border-b border-gray-100">
              <th class="px-4 py-2.5 text-left" style="width:40px">
                <input type="checkbox" :checked="todosMarcadosSeccion(sec.items)"
                  @change="toggleTodosSeccion(sec.items, $event.target.checked)"
                  class="accent-purple-600" />
              </th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:320px">Proyecto</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:120px">Estado contrato</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:130px">Periodo a facturar</th>
              <th v-if="colsVisibles.n_indexaciones"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:70px">N° IPC</th>
              <th class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:130px">Valor Base</th>
              <th v-if="colsVisibles.factor_acumulado"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:100px">Factor Acum.</th>
              <th v-if="colsVisibles.valor_anual_indexado"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:150px">Val. Anual Indexado</th>
              <th class="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wide bg-purple-50 whitespace-nowrap" style="color:#7c3aed; width:160px">
                Canon Arrendamiento
              </th>
              <th class="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wide bg-purple-50 whitespace-nowrap" style="color:#7c3aed">IVA</th>
              <th v-if="colsVisibles.historial"
                class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:240px">Historial IPC</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:100px">Documento</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap" style="width:90px">Facturado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in sec.items" :key="fila.id"
              class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100 group">
              <!-- Checkbox — solo facturable (con contrato + aplica este mes) -->
              <td class="px-4 py-2 text-center" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                <input type="checkbox" :disabled="!esFacturable(fila)"
                  v-model="seleccion[fila.id]" class="accent-purple-600" />
              </td>
              <!-- Proyecto: se mantiene a opacidad completa aunque no sea facturable, para que el nombre siga siendo legible -->
              <td class="px-4 py-2 font-medium" style="color:var(--color-unergy-deep); overflow:hidden; text-overflow:ellipsis" :title="fila.proyecto">
                <div class="flex flex-col gap-0.5 max-w-full">
                  <span class="block text-[11px] leading-tight"
                        :class="fila.codigo ? 'text-gray-400' : 'text-gray-300'">
                    {{ fila.codigo || '—' }}
                  </span>
                  <span class="inline-flex flex-wrap items-center gap-1.5 max-w-full">
                    <button v-if="fila.proyecto_id" type="button"
                            class="text-left hover:underline" style="white-space:normal"
                            @click="irADetalleProyecto(fila)"
                            v-tooltip.bottom="'Ver detalle del proyecto'">
                      {{ fila.proyecto }}
                    </button>
                    <span v-else style="white-space:normal">{{ fila.proyecto }}</span>
                    <span v-if="!fila.aplica_este_mes && conContrato(fila)"
                      class="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style="background:#e5e7eb; color:#4b5563"
                      title="Según su periodicidad, a este arriendo no le corresponde cobro este mes.">
                      <ClockIcon class="text-[9px] size-[1em]" />no aplica este mes
                    </span>
                    <span v-if="fila.motivo_exclusion"
                      class="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0"
                      style="background:#fee2e2; color:#991b1b"
                      :title="'Excluido este mes — motivo: ' + fila.motivo_exclusion">
                      <MessageSquareIcon class="text-[9px] size-[1em]" />excluido
                    </span>
                  </span>
                  <span v-if="fila.nombre_arrendador" class="text-[11px] text-gray-400 truncate" :title="fila.nombre_arrendador">
                    {{ fila.nombre_arrendador }}
                  </span>
                </div>
              </td>
              <!-- Estado contrato -->
              <td class="px-4 py-2 whitespace-nowrap" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                <span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
                  :style="{ background: estadoContratoMeta(fila).bg, color: estadoContratoMeta(fila).fg }">
                  {{ estadoContratoMeta(fila).label }}
                </span>
              </td>
              <td class="px-4 py-2 text-xs text-gray-600 whitespace-nowrap" :class="!esFacturable(fila) ? 'opacity-40' : ''">{{ periodoLabel }}</td>
              <td v-if="colsVisibles.n_indexaciones" class="px-4 py-2 text-right text-xs text-gray-500" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                {{ fila.n_indexaciones ?? '—' }}
              </td>
              <td class="px-4 py-2 text-right font-mono text-xs text-gray-600" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                {{ fila.valor_base != null ? formatCOP(fila.valor_base) : '—' }}
              </td>
              <td v-if="colsVisibles.factor_acumulado" class="px-4 py-2 text-right font-mono text-xs" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                {{ fila.factor_acumulado != null ? fila.factor_acumulado.toFixed(6) : '—' }}
              </td>
              <td v-if="colsVisibles.valor_anual_indexado" class="px-4 py-2 text-right font-mono text-xs" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                {{ fila.valor_anual_indexado != null ? formatCOP(fila.valor_anual_indexado) : '—' }}
              </td>
              <!-- Canon calculado -->
              <td class="px-4 py-2 text-right tabular-nums bg-purple-50/30"
                :class="!esFacturable(fila) ? 'opacity-40' : ''"
                :style="seleccion[fila.id] ? 'color:#7c3aed' : 'color:#9ca3af'">
                <span class="inline-flex items-center justify-end gap-1">
                  <span v-if="fila.canon_calculado != null" class="font-semibold">
                    {{ formatCOP(fila.canon_calculado) }}
                  </span>
                  <span v-else class="text-gray-300">—</span>
                  <InfoIcon class="flex-shrink-0 cursor-help opacity-0 group-hover:opacity-100 transition-opacity size-[1em]" v-if="fila.canon_calculado != null" style="font-size:11px;color:var(--color-unergy-purple)" title="Ver cálculo" @mouseenter="mostrarCanon($event, fila)" @mouseleave="ocultarCanon()" />
                </span>
              </td>
              <td class="px-4 py-2 text-right font-mono text-xs bg-purple-50/30" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                {{ fila.iva_calculado != null ? formatCOP(fila.iva_calculado) : '—' }}
              </td>
              <td v-if="colsVisibles.historial" class="px-4 py-2 text-xs text-gray-400"
                :class="!esFacturable(fila) ? 'opacity-40' : ''"
                style="white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis"
                :title="fila.historial_detalle">
                {{ fila.historial_texto || '—' }}
              </td>
              <!-- Documento adjunto -->
              <td class="px-4 py-2 text-center" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                <div class="inline-flex items-center gap-0.5 flex-wrap justify-center">
                  <template v-if="docsPorProyecto[fila.proyecto_id]?.length">
                    <DocumentoIcon
                      v-for="doc in docsPorProyecto[fila.proyecto_id]"
                      :key="doc.id"
                      :doc="doc"
                      :tooltip="tooltipDoc(doc)"
                      @click="downloadDoc(doc.id, doc.nombre_archivo)" />
                  </template>
                  <DocumentoIcon v-else :doc="null" />
                </div>
              </td>
              <td class="px-4 py-2 text-center" :class="!esFacturable(fila) ? 'opacity-40' : ''">
                <button type="button" @click="toggleFacturado(fila.id)">
                  <span v-if="facturadoActual[fila.id]"
                    class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style="background:#dcfce7;color:#166534">
                    <CheckIcon class="text-[10px] size-[1em]" />Sí
                  </span>
                  <span v-else class="text-xs text-gray-300">—</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
     </div>

      <!-- Total general (todas las secciones) -->
      <div class="bg-white rounded-xl shadow-sm border px-4 py-3 flex items-center flex-wrap gap-x-8 gap-y-2 justify-between"
        style="border-color:#ECE7F2">
        <span class="text-xs font-semibold text-gray-600">
          {{ filasSeleccionadas }} proyectos seleccionados
        </span>
        <div class="flex items-center gap-6 ml-auto">
          <div class="text-right">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Subtotal Facturado</p>
            <p class="text-sm font-semibold tabular-nums" style="color:var(--color-unergy-deep)">{{ formatCOP(totalSeleccionado) }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">IVA</p>
            <p class="text-sm font-semibold tabular-nums" style="color:var(--color-unergy-deep)">{{ formatCOP(totalIVASeleccionado) }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Total</p>
            <p class="text-base font-bold tabular-nums" style="color:#7c3aed">{{ formatCOP(totalConIVASeleccionado) }}</p>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-400 border" style="border-color:#ECE7F2">
      No se encontraron arriendos con los filtros aplicados.
    </div>

    <!-- ── Notificación IPC pendiente ─────────────────────────────────────── -->
    <div v-if="proyectosSinIPC.length"
      class="rounded-xl border p-3 flex items-start gap-3"
      style="background:#fef3c7;border-color:#f59e0b40">
      <TriangleAlertIcon class="text-sm flex-shrink-0 mt-0.5 size-[1em]" style="color:#d97706" />
      <div class="flex-1 text-xs" style="color:#92400e">
        <p class="font-semibold mb-1">IPC pendiente para próximos períodos</p>
        <p>{{ proyectosSinIPC.join(', ') }} — agrégalo en el diálogo IPC.</p>
      </div>
    </div>

    <!-- ── Diálogo: motivo de exclusión ─────────────────────────────────── -->
    <Dialog v-model:visible="showExclusionDialog" modal header="Motivo de exclusión" :style="{ width: '30rem' }">
      <p class="text-sm text-gray-600 mb-3">
        Estos arriendos son facturables este mes pero los desmarcaste. Indica el motivo de cada exclusión (queda registrado):
      </p>
      <div v-for="e in exclusionPendientes" :key="e.id" class="mb-3">
        <label class="text-xs font-semibold text-gray-700">{{ e.nombre }}</label>
        <textarea v-model="e.motivo" rows="2"
          class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 mt-1"
          placeholder="Motivo de la exclusión…"></textarea>
      </div>
      <template #footer>
        <button type="button" class="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          @click="showExclusionDialog = false">Cancelar</button>
        <button type="button" :disabled="!exclusionValida"
          class="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style="background:var(--color-unergy-purple);color:#fff;border:none"
          :style="!exclusionValida ? 'opacity:0.4;cursor:not-allowed' : 'cursor:pointer'"
          @click="confirmarExclusiones">Guardar</button>
      </template>
    </Dialog>

    <!-- ── Dialog IPC ─────────────────────────────────────────────────────── -->
    <Dialog v-model:visible="showIPCDialog" modal header="Tasas IPC — Arriendos" :style="{ width: '460px' }">
      <div class="space-y-3 pt-1">
        <p class="text-xs text-gray-500">
          El IPC de diciembre del año N (columna "Año dic") se aplica en el
          <b>aniversario del contrato</b> del año N+1, no cada 1 de enero.
        </p>
        <DataTable :value="ipcTasas" class="text-sm" stripedRows>
          <Column field="año" header="Año dic" style="width:80px" />
          <Column header="Tasa (%)">
            <template #body="{ data }">{{ (data.tasa * 100).toFixed(2) }}%</template>
          </Column>
          <Column header="Estado">
            <template #body="{ data }">
              <GBadge :color="data.confirmado ? 'success' : 'warning'">{{ data.confirmado ? 'Confirmado' : 'Pendiente' }}</GBadge>
            </template>
          </Column>
          <Column header="Fuente">
            <template #body="{ data }">{{ data.fuente || '—' }}</template>
          </Column>
        </DataTable>
        <div class="border-t pt-3 space-y-2">
          <p class="text-xs font-semibold text-gray-600">Agregar / actualizar tasa</p>
          <div class="grid grid-cols-3 gap-2">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Año (dic)</label>
              <InputNumber v-model="ipcForm.año" :useGrouping="false" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Tasa (%)</label>
              <InputNumber v-model="ipcForm.tasaPct" :minFractionDigits="2" :maxFractionDigits="4"
                suffix="%" locale="en-US" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Fuente</label>
              <InputText v-model="ipcForm.fuente" class="w-full" placeholder="DANE" />
            </div>
          </div>
          <Button label="Guardar tasa" size="small" @click="guardarIPC" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- ── Popover desglose del canon (hover sobre ⚠️) ───────────────────────── -->
    <CalculoIpcPopover
      ref="canonPopover"
      :valor-base-anual="filaCanon && filaCanon.valor_base != null ? filaCanon.valor_base * 12 : null"
      :factor="filaCanon ? filaCanon.factor_acumulado : null"
      :valor-a-facturar="filaCanon ? filaCanon.canon_a_facturar : null" />

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button      from 'primevue/button'
import Dialog      from 'primevue/dialog'
import DataTable   from 'primevue/datatable'
import Column      from 'primevue/column'
import InputNumber from 'primevue/inputnumber'
import InputText   from 'primevue/inputtext'
import { toast } from 'vue-sonner'
import { ArriendosCalculoService } from '~/features/finanzas/services/arriendos-calculo'
import ArriendosZipUpload from './ArriendosZipUpload.vue'
import CalculoIpcPopover from '~/features/finanzas/components/CalculoIpcPopover.vue'
const { docsPorProyecto, loadDocs, downloadDoc } = useArriendosDocs()
import DocumentoIcon from '~/features/finanzas/components/DocumentoIcon.vue'
import { formatCOP } from '~/utils/currency'
import { ChartLineIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, InfoIcon, MessageSquareIcon, SaveIcon, TableIcon, TriangleAlertIcon } from '@lucide/vue'

const router = useRouter()
const arriendosCalculoService = new ArriendosCalculoService()

function irADetalleProyecto(fila) {
  if (!fila.proyecto_id) return
  router.push(`/proyectos/${fila.proyecto_id}/operacion?subtab=arriendo`)
}

// ── Tooltip de cálculo del canon (mismo diseño que Mantenimiento) ──────────────
const canonPopover = ref(null)
const filaCanon    = ref(null)
function mostrarCanon(ev, fila) {
  filaCanon.value = fila
  canonPopover.value?.show(ev)
}
function ocultarCanon() {
  canonPopover.value?.hide()
}

// ── Período ────────────────────────────────────────────────────────────────────
const hoy           = new Date()
const periodoOffset = ref(0)

const periodoActual = computed(() => {
  const d    = new Date(hoy.getFullYear(), hoy.getMonth() + periodoOffset.value, 1)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
})

const periodoLabel = computed(() => {
  const [yyyy, mm] = periodoActual.value.split('-')
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${MESES[parseInt(mm) - 1]} ${yyyy}`
})

function cambiarMes(delta) { periodoOffset.value += delta }

// ── Columnas opcionales ────────────────────────────────────────────────────────
const columnasOpcionales = [
  { key: 'n_indexaciones',      label: 'N° de Indexaciones' },
  { key: 'factor_acumulado',    label: 'Factor Acumulado' },
  { key: 'valor_anual_indexado',label: 'Valor Anual Indexado' },
  { key: 'historial',           label: 'Historial de Indexaciones' },
]
const colsVisibles = reactive({
  n_indexaciones:       false,
  factor_acumulado:     false,
  valor_anual_indexado: false,
  historial:            false,
})
const showColMenu = ref(false)

// ── Tasas IPC ──────────────────────────────────────────────────────────────────
const showIPCDialog = ref(false)
const ipcForm       = reactive({ año: new Date().getFullYear() - 1, tasaPct: null, fuente: 'DANE' })

async function guardarIPC() {
  if (!ipcForm.año || ipcForm.tasaPct == null) return
  try {
    await arriendosCalculoService.guardarIpc(ipcForm.año, {
      tasa: ipcForm.tasaPct / 100,
      confirmado: true,
      fuente: ipcForm.fuente || 'DANE',
    })
    toast.success('Tasa IPC guardada', { duration: 2500 })
    await cargarDatos()
  } catch {
    toast.error('Error al guardar IPC', { duration: 3000 })
  }
}

// ── Estado (API) ─────────────────────────────────────────────────────────────
const loading   = ref(false)
const guardando = ref(false)
const filas     = ref([])
const seleccion = reactive({})   // { [id]: bool }
const ipcTasas  = ref([])

async function cargarDatos() {
  loading.value = true
  try {
    const [calc, ipc] = await Promise.all([
      arriendosCalculoService.obtenerCalculo(periodoActual.value),
      arriendosCalculoService.obtenerIpc(),
    ])
    filas.value = calc.filas
    ipcTasas.value = ipc
    filas.value.forEach(f => { seleccion[f.id] = f.incluido && f.habilitado })
  } catch {
    toast.error('Error al cargar arriendos', { duration: 3000 })
  } finally {
    loading.value = false
  }
}

const facturadoActual = computed(() => {
  const m = {}; filas.value.forEach(f => { m[f.id] = f.facturado }); return m
})
// Facturable = con contrato vigente, habilitado y que aplique este mes por periodicidad.
const conContrato  = (f) => (f.estado_contrato || 'con_contrato') === 'con_contrato'
const esFacturable = (f) => f.habilitado && f.aplica_este_mes && conContrato(f)

const ESTADO_CONTRATO_META = {
  con_contrato: { label: 'Con contrato', bg: '#dcfce7', fg: '#166534' },
  en_tramite:   { label: 'En trámite',   bg: '#fef3c7', fg: '#92400e' },
  sin_contrato: { label: 'Sin contrato', bg: '#e5e7eb', fg: '#4b5563' },
}
const estadoContratoMeta = (f) => ESTADO_CONTRATO_META[f.estado_contrato] || ESTADO_CONTRATO_META.con_contrato

// ── Filtros del panel ────────────────────────────────────────────────────────
const filtroTexto        = ref('')
const filtroEstado       = ref('todos')   // todos | con_contrato | en_tramite | sin_contrato
const filtroPeriodicidad = ref('todos')   // todos | mensual | ... | anual
const filtroAplica       = ref('aplica')  // todos | aplica | no
const filasFiltradas = computed(() => {
  const q = filtroTexto.value.trim().toLowerCase()
  return filas.value.filter(f => {
    if (q && !(f.proyecto || '').toLowerCase().includes(q)) return false
    if (filtroEstado.value !== 'todos' && (f.estado_contrato || 'con_contrato') !== filtroEstado.value) return false
    if (filtroPeriodicidad.value !== 'todos' && (f.periodicidad || 'mensual') !== filtroPeriodicidad.value) return false
    if (filtroAplica.value === 'aplica' && !f.aplica_este_mes) return false
    if (filtroAplica.value === 'no' && f.aplica_este_mes) return false
    return true
  })
})

// Agrupación por tipo de proyecto (secciones colapsables, como O&M)
const TIPO_LABELS = { minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD', movilidad_electrica: 'Movilidad', otro: 'Otro' }
const TIPO_DOT    = { minigranja: '#10B981', autoconsumo: '#6366F1', gd: '#3B82F6', movilidad_electrica: '#8B5CF6', otro: '#9CA3AF' }
const TIPO_ORDER  = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica', 'otro']
const secciones = computed(() => {
  const groups = {}
  for (const f of filasFiltradas.value) {
    const t = f.tipo_proyecto || 'otro'
    ;(groups[t] ||= []).push(f)
  }
  return TIPO_ORDER.filter(t => groups[t]?.length)
    .map(t => ({ tipo: t, label: TIPO_LABELS[t] || t, dot: TIPO_DOT[t] || '#9CA3AF', items: groups[t] }))
})
const openSections = ref(new Set())
function toggleSection(tipo) {
  const s = new Set(openSections.value)
  s.has(tipo) ? s.delete(tipo) : s.add(tipo)
  openSections.value = s
}
watch(secciones, (s) => {
  if (openSections.value.size === 0 && s.length) openSections.value = new Set([s[0].tipo])
}, { immediate: true })

// "Marcar todo" por sección (solo filas facturables de esa sección)
const seccionFacturables   = (items) => items.filter(esFacturable)
const todosMarcadosSeccion = (items) => {
  const h = seccionFacturables(items)
  return h.length > 0 && h.every(f => seleccion[f.id])
}
function toggleTodosSeccion(items, checked) {
  seccionFacturables(items).forEach(f => { seleccion[f.id] = checked })
}

const filasHabilitadas   = computed(() => filas.value.filter(esFacturable))
const todosMarcados      = computed(() =>
  filasHabilitadas.value.length > 0 && filasHabilitadas.value.every(f => seleccion[f.id]))
const filasSeleccionadas = computed(() => filasHabilitadas.value.filter(f => seleccion[f.id]).length)
const totalSeleccionado  = computed(() =>
  filas.value.filter(f => esFacturable(f) && seleccion[f.id]).reduce((s, f) => s + (f.canon_a_facturar || 0), 0))
const totalIVASeleccionado    = computed(() =>
  filas.value.filter(f => esFacturable(f) && seleccion[f.id]).reduce((s, f) => s + (f.iva_calculado || 0), 0))
const totalConIVASeleccionado = computed(() => totalSeleccionado.value + totalIVASeleccionado.value)

// IPC faltante no lo expone el backend → notificación deshabilitada
// Proyectos con indexación incompleta por falta de tasa IPC de algún año.
const proyectosSinIPC = computed(() =>
  filas.value.filter(f => f.ipc_incompleto).map(f => f.proyecto)
)

function toggleTodos(e) {
  filasHabilitadas.value.forEach(f => { seleccion[f.id] = e.target.checked })
}

// Exclusión con observación obligatoria (paridad con Mantenimiento)
const showExclusionDialog = ref(false)
const exclusionPendientes = ref([])   // [{id, nombre, motivo}]
const exclusionValida = computed(() =>
  exclusionPendientes.value.every(e => e.motivo.trim().length > 0)
)

async function guardarSeleccion() {
  // Proyectos facturables que quedaron desmarcados → exigir motivo antes de guardar.
  const excluidos = filas.value.filter(f => esFacturable(f) && !seleccion[f.id])
  if (excluidos.length) {
    exclusionPendientes.value = excluidos.map(f => ({ id: f.id, nombre: f.proyecto, motivo: '' }))
    showExclusionDialog.value = true
    return
  }
  await _ejecutarGuardado({})
}

function confirmarExclusiones() {
  const motivos = {}
  exclusionPendientes.value.forEach(e => { motivos[e.id] = e.motivo.trim() })
  showExclusionDialog.value = false
  _ejecutarGuardado(motivos)
}

async function _ejecutarGuardado(motivos) {
  guardando.value = true
  try {
    const items = filas.value.map(f => ({
      arr_arrendador_id: f.id,
      incluido: !!(seleccion[f.id] && esFacturable(f)),
      motivo_exclusion: motivos[f.id] || null,
    }))
    await arriendosCalculoService.guardarSeleccion(periodoActual.value, items)
    toast.success('Selección guardada', { duration: 2500 })
    await cargarDatos()
  } catch {
    toast.error('Error al guardar', { duration: 3000 })
  } finally {
    guardando.value = false
  }
}

async function toggleFacturado(id) {
  try {
    await arriendosCalculoService.marcarFacturado(periodoActual.value, id)
    await cargarDatos()
  } catch {
    toast.error('Error al marcar facturado', { duration: 3000 })
  }
}

// ── Tooltip del ícono de documento: nombre de archivo + pago_id ────────────────
function tooltipDoc(doc) {
  const base = doc.nombre_archivo || doc.numero_cuenta_cobro || 'documento'
  return doc.pago_id ? `${base} · pago ${doc.pago_id}` : base
}

// ── Proyectos para el componente ZipUpload ─────────────────────────────────────
// nombreArrendador/estadoContrato: necesarios para que ArriendosZipUpload pueda
// detectar proyectos con varios arrendadores (varias filas con el mismo código)
// y ofrecer el selector correspondiente al cargar cuentas de cobro.
const filasParaZip = computed(() =>
  filas.value.map(f => ({
    id: f.id,
    proyectoId: f.proyecto_id,
    proyecto: f.proyecto,
    codigo: f.codigo,
    nombreArrendador: f.nombre_arrendador,
    estadoContrato: f.estado_contrato,
  }))
)

watch(periodoActual, (p) => { loadDocs(p); cargarDatos() })
onMounted(() => { loadDocs(periodoActual.value); cargarDatos() })
</script>

<style scoped>
/* Secciones colapsables por tipo (igual que Operaciones/O&M) */
.section-collapse {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-out;
}
.section-collapse.open {
  max-height: 20000px;
  transition: max-height 0.45s ease-in;
}
</style>
