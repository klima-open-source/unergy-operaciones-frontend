<template>
  <div class="space-y-4 pt-3">

    <!-- ── Barra superior: periodo + guardar + columnas + IPC ──────────── -->
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
        <Button label="Guardar selección" size="small" :loading="guardando" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)" @click="guardarSeleccion">
          <template #icon><SaveIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- ── Filtros ──────────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border" style="border-color:#ECE7F2">
      <div>
        <label class="field-label">Buscar</label>
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filtroTexto" placeholder="Nombre del proyecto…" class="w-56" />
        </IconField>
      </div>
      <div>
        <label class="field-label">Aplica este mes</label>
        <Select v-model="filtroAplica" :options="APLICA_OPTIONS" optionLabel="label" optionValue="value"
                class="w-48" />
      </div>
      <div>
        <label class="field-label">Periodicidad</label>
        <Select v-model="filtroPeriodicidad" :options="PERIODICIDAD_OPTIONS" optionLabel="label" optionValue="value"
                class="w-44" />
      </div>
      <div>
        <label class="field-label">Estado contrato</label>
        <Select v-model="filtroEstadoContrato" :options="ESTADO_CONTRATO_OPTIONS" optionLabel="label" optionValue="value"
                class="w-44" />
      </div>
      <div class="ml-auto pb-1.5 text-xs text-gray-400">
        {{ filasFiltradas.length }} de {{ filas.length }}
      </div>
    </div>

    <!-- ── Notificación de cambio IPC ─────────────────────────────────── -->
    <div v-if="notificacionIPC"
      class="rounded-xl border p-3 flex items-start gap-3"
      style="background:#fef3c7;border-color:#f59e0b40">
      <TriangleAlertIcon class="text-sm flex-shrink-0 mt-0.5 size-[1em]" style="color:#d97706" />
      <div class="flex-1 text-xs">
        <p class="font-semibold mb-1" style="color:#92400e">
          Nueva tasa IPC {{ notificacionIPC.año }}: {{ (notificacionIPC.tasa * 100).toFixed(2) }}%
          — Los valores cambiaron
        </p>
        <div v-for="af in notificacionIPC.afectados" :key="af.contrato_id"
          class="mb-0.5" style="color:#78350f">
          <strong>{{ af.nombre }}</strong>:
          {{ formatCOP(af.valor_anterior) }} → {{ formatCOP(af.valor_nuevo) }}
          <span :class="af.diff_cop > 0 ? 'text-green-700' : 'text-red-700'">
            ({{ af.diff_cop > 0 ? '+' : '' }}{{ formatCOP(af.diff_cop) }},
             {{ af.diff_pct > 0 ? '+' : '' }}{{ af.diff_pct.toFixed(2) }}%)
          </span>
        </div>
      </div>
      <button type="button" @click="notificacionIPC = null" class="text-gray-400 hover:text-gray-600">
        <XIcon class="text-xs size-[1em]" />
      </button>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────── -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-10 flex justify-center border" style="border-color:#ECE7F2">
      <LoaderCircleIcon class="text-2xl text-gray-400 size-[1em] animate-spin" />
    </div>
    <div v-else-if="!filasFiltradas.length"
      class="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-400 border" style="border-color:#ECE7F2">
      No se encontraron proyectos con los filtros aplicados.
    </div>
    <template v-else>
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

      <!-- Tabla colapsable de la sección -->
      <div class="section-collapse" :class="{ open: openSections.has(sec.tipo) }">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse" style="min-width:900px">
          <thead>
            <tr class="bg-gray-50 border-t border-b border-gray-100">
              <th class="px-4 py-2.5 text-left w-10">
                <input type="checkbox" :checked="todosMarcadosSeccion(sec.items)"
                  @change="toggleTodosSeccion(sec.items, $event.target.checked)"
                  class="accent-purple-600" />
              </th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Proyecto</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Estado contrato</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Periodo a facturar</th>
              <th v-if="colsVisibles.n_indexaciones"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">N° IPC</th>
              <th class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Valor Base Anual</th>
              <th v-if="colsVisibles.factor_acumulado"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Factor Acum.</th>
              <th v-if="colsVisibles.valor_anual_indexado"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Val. Anual Indexado</th>
              <th v-if="colsVisibles.valor_mes_completo"
                class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Mes Completo</th>
              <th v-if="colsVisibles.prorrateo"
                class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Prorrateo</th>
              <th class="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wide bg-purple-50 whitespace-nowrap" style="color:#7c3aed">
                Valor a Facturar
              </th>
              <th class="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wide bg-purple-50 whitespace-nowrap" style="color:#7c3aed">
                IVA (19%)
              </th>
              <th class="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wide bg-purple-50 whitespace-nowrap" style="color:#7c3aed">
                Total
              </th>
              <th v-if="colsVisibles.historial"
                class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Historial IPC</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Facturado</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Documento</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in sec.items" :key="fila.contrato_id"
              class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100 row-hover">
              <td class="px-4 py-2 text-center" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                <input type="checkbox"
                  :disabled="!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)"
                  v-model="seleccion[fila.contrato_id]"
                  class="accent-purple-600" />
              </td>
              <!-- Proyecto: se mantiene a opacidad completa aunque no sea facturable, para que el nombre siga siendo legible -->
              <td class="px-4 py-2 font-medium" style="color:var(--color-unergy-deep); white-space:nowrap">
                <span class="block text-[11px] leading-tight"
                      :class="fila.codigo_tsf ? 'text-gray-400' : 'text-gray-300'">
                  {{ fila.codigo_tsf || '—' }}
                </span>
                <button v-if="fila.proyecto_id" type="button"
                        class="text-left hover:underline"
                        style="color:var(--color-unergy-deep)"
                        @click="irADetalleProyecto(fila)"
                        v-tooltip.bottom="'Ver detalle del proyecto'">
                  {{ fila.nombre_proyecto }}
                </button>
                <span v-else>{{ fila.nombre_proyecto }}</span>
                <span v-if="!fila.habilitado && conContrato(fila)"
                  class="inline-flex items-center gap-1 ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full align-middle"
                  style="background:#fef3c7; color:#92400e"
                  :title="fila.historial_indexaciones">
                  <TriangleAlertIcon class="text-[9px] size-[1em]" />{{ fila.historial_indexaciones }}
                </span>
                <span v-else-if="!fila.aplica_este_mes"
                  class="inline-flex items-center gap-1 ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full align-middle"
                  style="background:#e5e7eb; color:#4b5563"
                  title="Según su periodicidad, a este proyecto no le corresponde cobro este mes.">
                  <ClockIcon class="text-[9px] size-[1em]" />no aplica este mes
                </span>
                <span v-if="fila.motivo_exclusion"
                  class="inline-flex items-center gap-1 ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full align-middle cursor-help"
                  style="background:#fee2e2; color:#991b1b"
                  :title="'Excluido este mes — motivo: ' + fila.motivo_exclusion">
                  <MessageSquareIcon class="text-[9px] size-[1em]" />excluido
                </span>
              </td>
              <td class="px-4 py-2 whitespace-nowrap" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                <span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
                  :style="{ background: estadoContratoMeta(fila).bg, color: estadoContratoMeta(fila).fg }">
                  {{ estadoContratoMeta(fila).label }}
                </span>
              </td>
              <td class="px-4 py-2 text-xs text-gray-600 whitespace-nowrap" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">{{ fila.mes_año }}</td>
              <td v-if="colsVisibles.n_indexaciones" class="px-4 py-2 text-right text-xs text-gray-500" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.n_indexaciones }}
              </td>
              <td class="px-4 py-2 text-right font-mono text-xs text-gray-600" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.valor_base_anual != null ? formatCOP(fila.valor_base_anual) : '—' }}
              </td>
              <td v-if="colsVisibles.factor_acumulado" class="px-4 py-2 text-right font-mono text-xs" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.habilitado ? fila.factor_acumulado.toFixed(6) : '—' }}
              </td>
              <td v-if="colsVisibles.valor_anual_indexado" class="px-4 py-2 text-right font-mono text-xs" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.valor_anual_indexado != null ? formatCOP(fila.valor_anual_indexado) : '—' }}
              </td>
              <td v-if="colsVisibles.valor_mes_completo" class="px-4 py-2 text-right font-mono text-xs" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.valor_mes_completo != null ? formatCOP(fila.valor_mes_completo) : '—' }}
              </td>
              <td v-if="colsVisibles.prorrateo" class="px-4 py-2 text-center text-xs text-gray-500" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ fila.prorrateo_label }}
              </td>
              <td class="px-4 py-2 text-right bg-purple-50/30 group"
                :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''"
                style="position:relative; min-width:150px">
                <!-- Valor a facturar: SOLO LECTURA (se edita en Proyecto>Detalle>Servicios) -->
                <div class="flex items-center justify-end gap-1.5">
                  <span class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <InfoIcon class="text-[11px] cursor-pointer size-[1em]" v-if="fila.habilitado" style="color:var(--color-unergy-purple)" title="Ver cálculo" @click="mostrarInfo($event, fila)" />
                  </span>
                  <!-- Indicador de modificación manual (histórico) -->
                  <span v-if="esManual(fila)" title="Valor modificado manualmente"
                    style="color:#f59e0b; font-size:12px; line-height:1">●</span>
                  <!-- Avisos: IPC incompleto (#5) y override desactualizado (#6) -->
                  <TriangleAlertIcon class="text-[10px] size-[1em]" v-if="fila.ipc_incompleto" style="color:#d97706" title="Falta la tasa IPC de algún año; la indexación de este proyecto es parcial." />
                  <TriangleAlertIcon class="text-[10px] size-[1em]" v-if="fila.valor_manual_desactualizado" style="color:#dc2626" title="El valor manual difiere del recalculado; revísalo tras el cambio de IPC." />
                  <span class="font-semibold tabular-nums"
                    :style="(fila.incluido && fila.habilitado) ? 'color:#7c3aed' : 'color:#9ca3af'">
                    {{ valorEfectivo(fila) != null ? formatCOP(valorEfectivo(fila)) : '—' }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2 text-right bg-purple-50/30 font-mono text-xs"
                :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                {{ valorEfectivo(fila) != null ? formatCOP(valorEfectivo(fila) * IVA_TASA) : '—' }}
              </td>
              <td class="px-4 py-2 text-right bg-purple-50/30 font-semibold tabular-nums"
                :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''"
                style="color:#7c3aed">
                {{ valorEfectivo(fila) != null ? formatCOP(valorEfectivo(fila) * (1 + IVA_TASA)) : '—' }}
              </td>
              <td v-if="colsVisibles.historial" class="px-4 py-2 text-xs text-gray-400"
                :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''"
                style="white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis"
                :title="fila.historial_indexaciones">
                {{ fila.historial_indexaciones }}
              </td>
              <td class="px-4 py-2 text-center" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                <button v-if="conContrato(fila)" type="button" @click="toggleFacturado(fila)"
                  class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors"
                  :class="togglingFacturado[fila.contrato_id] ? 'opacity-50 pointer-events-none' : ''"
                  :style="fila.facturado ? 'background:#dcfce7;color:#166534' : 'background:#f3f4f6;color:#9ca3af'"
                  :title="fila.facturado
                    ? 'Facturado — clic para desmarcar (descongela y recalcula el valor)'
                    : 'Clic para marcar como facturado (congela el valor de este mes)'">
                  <CheckIcon v-if="fila.facturado" class="text-[10px] size-[1em]" />
                  <CircleIcon v-else class="text-[10px] size-[1em]" />{{ fila.facturado ? 'Sí' : 'No' }}
                </button>
                <span v-else class="text-xs text-gray-300">—</span>
              </td>
              <td class="px-4 py-2 text-center" :class="(!fila.habilitado || !fila.aplica_este_mes || !conContrato(fila)) ? 'opacity-40' : ''">
                <DocumentoIcon
                  :doc="fila.documento_disponible ? { nombre_archivo: fila.documento_nombre || fila.nombre_proyecto } : null"
                  :tooltip="fila.documento_disponible ? (fila.documento_nombre || fila.nombre_proyecto) : null"
                  @click="descargarDocumento(fila)" />
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
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">IVA (19%)</p>
            <p class="text-sm font-semibold tabular-nums" style="color:var(--color-unergy-deep)">{{ formatCOP(totalIVASeleccionado) }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Total</p>
            <p class="text-base font-bold tabular-nums" style="color:#7c3aed">{{ formatCOP(totalConIVASeleccionado) }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Factura consolidada del proveedor ──────────────────────────── -->
    <div class="flex items-center gap-3 p-3 rounded-xl border"
      :style="facturaProveedor.nombre_archivo
        ? 'background:#f0fdf4;border-color:#bbf7d0'
        : 'background:#fafafa;border-color:#e5e7eb'">
      <FileTextIcon class="text-sm flex-shrink-0 size-[1em]" :style="facturaProveedor.nombre_archivo ? 'color:#16a34a' : 'color:#d1d5db'" />
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold"
          :style="facturaProveedor.nombre_archivo ? 'color:#15803d' : 'color:#9ca3af'">
          Factura consolidada del proveedor — {{ periodoLabel }}
        </p>
        <p class="text-[10px] mt-0.5"
          :style="facturaProveedor.nombre_archivo ? 'color:#166534' : 'color:#9ca3af'">
          {{ facturaProveedor.nombre_archivo
              ? `Subida el ${fmtFechaFactura(facturaProveedor.subido_en)}`
              : 'El proveedor aún no ha subido la factura de este período.' }}
        </p>
      </div>
      <button v-if="facturaProveedor.tiene_archivo" type="button"
        @click="descargarFacturaProveedor"
        class="flex items-center gap-1 text-xs font-medium hover:underline flex-shrink-0"
        style="color:#15803d;background:none;border:none;padding:0;cursor:pointer">
        <DownloadIcon class="text-xs size-[1em]" />Descargar
      </button>
      <a v-else-if="facturaProveedor.enlace_pdf"
        :href="facturaProveedor.enlace_pdf" target="_blank" rel="noopener"
        class="flex items-center gap-1 text-xs font-medium hover:underline flex-shrink-0"
        style="color:var(--color-unergy-purple)">
        <ExternalLinkIcon class="text-xs size-[1em]" />Ver
      </a>
    </div>

    <!-- ── Diálogo: motivo de exclusión (Task 7d) ─────────────────────── -->
    <Dialog v-model:visible="showExclusionDialog" modal header="Motivo de exclusión"
      :style="{ width: '30rem' }">
      <p class="text-sm text-gray-600 mb-3">
        Estos proyectos <b>aplican este mes</b> pero los desmarcaste. Indica el motivo de cada exclusión (queda registrado):
      </p>
      <div v-for="e in exclusionPendientes" :key="e.contrato_id" class="mb-3">
        <label class="text-xs font-semibold text-gray-700">{{ e.nombre }}</label>
        <textarea v-model="e.motivo" rows="2"
          class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 mt-1"
          placeholder="Motivo de la exclusión…"></textarea>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="showExclusionDialog = false" />
        <Button label="Guardar" :disabled="!exclusionValida" @click="confirmarExclusiones"
          style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)" />
      </template>
    </Dialog>

    <!-- ── Popover: desglose del cálculo ──────────────────────────────── -->
    <Popover ref="infoPopover">
      <div v-if="filaInfo" class="text-xs" style="min-width:280px; color:var(--color-unergy-deep)">
        <p class="font-semibold mb-2 flex items-center gap-1.5" style="color:#7c3aed">
          <ChartColumnIcon class="text-[11px] size-[1em]" /> Cálculo del Valor a Facturar
        </p>
        <div class="space-y-1 font-mono">
          <div class="flex justify-between gap-6">
            <span class="text-gray-500">Valor Base Anual</span>
            <span>{{ formatCOP(filaInfo.valor_base_anual) }}</span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-gray-500">÷ 12 meses</span>
            <span>{{ formatCOP(filaInfo.valor_base_anual / 12) }}</span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-gray-500">Índice IPC aplicado</span>
            <span>× {{ filaInfo.factor_acumulado.toFixed(5) }}</span>
          </div>
          <div class="flex justify-between gap-6">
            <span class="text-gray-500">IPC acumulado período</span>
            <span>{{ ipcAcumPct(filaInfo) }}%</span>
          </div>
          <div v-if="filaInfo.prorrateo_label && filaInfo.prorrateo_label !== 'Completo'"
            class="flex justify-between gap-6">
            <span class="text-gray-500">Prorrateo</span>
            <span>{{ filaInfo.prorrateo_label }}</span>
          </div>
        </div>
        <!-- Aviso: falta tasa IPC de algún año (#5) -->
        <div v-if="filaInfo.ipc_incompleto"
          class="mt-2 rounded-md p-2 text-[11px] flex items-start gap-1.5"
          style="background:#fffbeb; color:#92400e">
          <TriangleAlertIcon class="text-[11px] mt-0.5 size-[1em]" style="color:#d97706" />
          <span>Falta la tasa IPC de algún año del período; la indexación mostrada es parcial. Cárgala con el botón IPC.</span>
        </div>
        <div class="border-t mt-2 pt-2">
          <div class="flex justify-between gap-6 font-semibold">
            <span>Valor a Facturar</span>
            <span style="color:#7c3aed">{{ formatCOP(valorEfectivo(filaInfo)) }}</span>
          </div>
        </div>
        <!-- Aviso de modificación manual -->
        <div v-if="esManual(filaInfo)"
          class="mt-2 pt-2 border-t rounded-md p-2 text-[11px] flex items-start gap-1.5"
          style="background:#fffbeb; color:#92400e">
          <TriangleAlertIcon class="text-[11px] mt-0.5 size-[1em]" style="color:#d97706" />
          <div class="flex-1">
            <p>⚠️ Valor modificado manualmente.</p>
            <p class="mt-0.5">Original calculado:
              <strong>{{ formatCOP(filaInfo.valor_calculado) }}</strong>
            </p>
            <p v-if="filaInfo.valor_manual_desactualizado" class="mt-0.5" style="color:#b91c1c">
              El valor manual ya no coincide con el recalculado — revísalo.
            </p>
            <button type="button" class="mt-1 underline" style="color:var(--color-unergy-purple)"
              @click="revertirCalculado(filaInfo)">
              Revertir a calculado
            </button>
          </div>
        </div>
      </div>
    </Popover>

    <!-- ── Dialog administración IPC ─────────────────────────────────── -->
    <Dialog v-model:visible="showIPCDialog" modal header="Tasas IPC" :style="{ width: '420px' }">
      <div class="space-y-3 pt-1">
        <p class="text-xs text-gray-500">
          La tasa del año en que cae cada aniversario del contrato se aplica desde ese
          aniversario, no desde enero. El aniversario se cuenta desde la fecha base —
          max(suscripción, inicio de operación) — y solo indexa una vez que ya se cumplió.
        </p>
        <DataTable :value="ipcTasas" class="text-sm" stripedRows>
          <Column field="año" header="Año" style="width:80px" />
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
              <label class="text-xs text-gray-500">Año</label>
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
          <Button label="Guardar tasa" size="small" :loading="guardandoIPC" @click="guardarIPC" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter }  from 'vue-router'
import Button        from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog        from 'primevue/dialog'
import DataTable     from 'primevue/datatable'
import Column        from 'primevue/column'
import InputNumber   from 'primevue/inputnumber'
import InputText     from 'primevue/inputtext'
import Select        from 'primevue/select'
import IconField     from 'primevue/iconfield'
import InputIcon     from 'primevue/inputicon'
import Popover       from 'primevue/popover'
import { toast } from 'vue-sonner'
import { OmService } from '~/features/finanzas/services/om'
import DocumentoIcon  from '~/features/finanzas/components/DocumentoIcon.vue'
import { parseCOP }   from '~/utils/parseCOP'
import { formatCOP } from '~/utils/currency'
import { ChartColumnIcon, ChartLineIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CircleIcon, ClockIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, InfoIcon, LoaderCircleIcon, MessageSquareIcon, SaveIcon, SearchIcon, TableIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'


// Autofocus para el input de edición inline (expuesto como v-focus)
const vFocus = { mounted: (el) => el.focus() }

const router = useRouter()
const omService = new OmService()

function irADetalleProyecto(fila) {
  if (!fila.proyecto_id) return
  router.push(`/proyectos/${fila.proyecto_id}/operacion?subtab=mantenimiento`)
}

const hoy = new Date()
const periodoOffset = ref(0)

const periodoActual = computed(() => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + periodoOffset.value, 1)
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

const columnasOpcionales = [
  { key: 'n_indexaciones',      label: 'N° de Indexaciones' },
  { key: 'factor_acumulado',    label: 'Factor Acumulado' },
  { key: 'valor_anual_indexado',label: 'Valor Anual Indexado (COP)' },
  { key: 'valor_mes_completo',  label: 'Valor Mes Completo (COP)' },
  { key: 'prorrateo',           label: 'Prorrateo (Días Op.)' },
  { key: 'historial',           label: 'Historial de Indexaciones' },
]
const colsVisibles = reactive({
  n_indexaciones:       false,
  factor_acumulado:     false,
  valor_anual_indexado: false,
  valor_mes_completo:   false,
  prorrateo:            false,
  historial:            false,
})
const showColMenu = ref(false)

const loading   = ref(false)
const descargando = reactive({})
const guardando = ref(false)
const filas     = ref([])
const seleccion = reactive({})
const ipcTasas  = ref([])
const showIPCDialog = ref(false)
const guardandoIPC  = ref(false)
const notificacionIPC = ref(null)
const ipcForm = reactive({ año: new Date().getFullYear(), tasaPct: null, fuente: 'DANE' })

// ── Edición inline del Valor a Facturar ──────────────────────────────────────
const overrides   = reactive({})   // { [contrato_id]: { valor:Number|null, dirty:Boolean } }
const editando    = ref(null)      // contrato_id de la celda en modo input
const inputBuffer = ref('')        // texto crudo del input activo
const infoPopover = ref(null)      // ref al <Popover>
const filaInfo    = ref(null)      // fila cuyo desglose se muestra

const conContrato = (f) => (f.estado_contrato || 'con_contrato') === 'con_contrato'
const filasHabilitadas   = computed(() => filas.value.filter(f => f.habilitado && f.aplica_este_mes && conContrato(f)))
const filasSeleccionadas = computed(() => filasHabilitadas.value.filter(f => seleccion[f.contrato_id]).length)
const totalSeleccionado = computed(() =>
  filas.value
    .filter(f => f.habilitado && conContrato(f) && seleccion[f.contrato_id])
    .reduce((s, f) => s + (valorEfectivo(f) || 0), 0)
)
const IVA_TASA = 0.19
const totalIVASeleccionado    = computed(() => totalSeleccionado.value * IVA_TASA)
const totalConIVASeleccionado = computed(() => totalSeleccionado.value + totalIVASeleccionado.value)

// ── Filtros de la tabla (Task 7a) ────────────────────────────────────────────
const filtroTexto  = ref('')
const filtroAplica = ref('aplica')   // 'todos' | 'aplica' | 'no'
const filtroPeriodicidad = ref('todos')
const filtroEstadoContrato = ref('todos')   // 'todos' | 'con_contrato' | 'en_tramite' | 'sin_contrato'

// Opciones legibles para los Select de filtro (estilo Proyectos)
const APLICA_OPTIONS = [
  { value: 'todos',  label: 'Todos' },
  { value: 'aplica', label: 'Aplican este mes' },
  { value: 'no',     label: 'No aplican este mes' },
]
const PERIODICIDAD_OPTIONS = [
  { value: 'todos',      label: 'Toda periodicidad' },
  { value: 'mensual',    label: 'Mensual' },
  { value: 'bimestral',  label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral' },
  { value: 'anual',      label: 'Anual' },
]
const ESTADO_CONTRATO_OPTIONS = [
  { value: 'todos',        label: 'Todo estado' },
  { value: 'con_contrato', label: 'Con contrato' },
  { value: 'en_tramite',   label: 'En trámite' },
  { value: 'sin_contrato', label: 'Sin contrato' },
]
const filasFiltradas = computed(() => {
  const q = filtroTexto.value.trim().toLowerCase()
  return filas.value.filter(f => {
    if (q && !f.nombre_proyecto.toLowerCase().includes(q)) return false
    if (filtroAplica.value === 'aplica' && !f.aplica_este_mes) return false
    if (filtroAplica.value === 'no' && f.aplica_este_mes) return false
    if (filtroPeriodicidad.value !== 'todos' && (f.periodicidad || 'mensual') !== filtroPeriodicidad.value) return false
    if (filtroEstadoContrato.value !== 'todos' && (f.estado_contrato || 'con_contrato') !== filtroEstadoContrato.value) return false
    return true
  })
})

// Etiqueta/color del estado de contrato (para el badge en la tabla)
const ESTADO_CONTRATO_META = {
  con_contrato: { label: 'Con contrato', bg: '#dcfce7', fg: '#166534' },
  en_tramite:   { label: 'En trámite',   bg: '#fef3c7', fg: '#92400e' },
  sin_contrato: { label: 'Sin contrato', bg: '#e5e7eb', fg: '#4b5563' },
}
const estadoContratoMeta = (f) => ESTADO_CONTRATO_META[f.estado_contrato] || ESTADO_CONTRATO_META.con_contrato

// ── Agrupación por tipo de proyecto (secciones colapsables, como Proyectos) ───
const TIPO_LABELS = {
  minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD',
  movilidad_electrica: 'Movilidad', otro: 'Otro',
}
const TIPO_DOT = {
  minigranja: '#10B981', autoconsumo: '#6366F1', gd: '#3B82F6',
  movilidad_electrica: '#8B5CF6', otro: '#9CA3AF',
}
const TIPO_ORDER = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica', 'otro']

const secciones = computed(() => {
  const groups = {}
  for (const f of filasFiltradas.value) {
    const t = f.tipo_proyecto || 'otro'
    ;(groups[t] ||= []).push(f)
  }
  return TIPO_ORDER
    .filter(t => groups[t]?.length)
    .map(t => ({ tipo: t, label: TIPO_LABELS[t] || t, dot: TIPO_DOT[t] || '#9CA3AF', items: groups[t] }))
})

const openSections = ref(new Set())
function toggleSection(tipo) {
  const s = new Set(openSections.value)
  s.has(tipo) ? s.delete(tipo) : s.add(tipo)
  openSections.value = s
}
// Abrir la primera sección automáticamente cuando aún no hay ninguna abierta
watch(secciones, (s) => {
  if (openSections.value.size === 0 && s.length) openSections.value = new Set([s[0].tipo])
}, { immediate: true })

// Selección "marcar todo" por sección (solo filas facturables de esa sección)
const seccionHabilitadas = (items) =>
  items.filter(f => f.habilitado && f.aplica_este_mes && conContrato(f))
const todosMarcadosSeccion = (items) => {
  const h = seccionHabilitadas(items)
  return h.length > 0 && h.every(f => seleccion[f.contrato_id])
}
function toggleTodosSeccion(items, checked) {
  seccionHabilitadas(items).forEach(f => { seleccion[f.contrato_id] = checked })
}

// Valor a mostrar/guardar: override local dirty → valor del backend (ya resuelto)
function valorEfectivo(fila) {
  const ov = overrides[fila.contrato_id]
  if (ov && ov.dirty) {
    // override revertido (valor null) → mostrar el calculado por IPC
    return ov.valor != null ? ov.valor : (fila.valor_calculado ?? fila.valor_a_facturar)
  }
  return fila.valor_a_facturar
}

// True si la fila tiene override (local dirty o persistido en backend)
function esManual(fila) {
  const ov = overrides[fila.contrato_id]
  if (ov && ov.dirty) return ov.valor != null
  return !!fila.editado_manual
}

function iniciarEdicion(fila) {
  if (!fila.habilitado) return
  editando.value = fila.contrato_id
  inputBuffer.value = String(valorEfectivo(fila) ?? '')
}

function confirmarEdicion(fila) {
  if (editando.value !== fila.contrato_id) return
  const v = parseCOP(inputBuffer.value)
  if (v != null) {
    overrides[fila.contrato_id] = { valor: v, dirty: true }
  }
  editando.value = null
}

function cancelarEdicion() {
  editando.value = null   // descarta el buffer; restaura el valor mostrado
}

function revertirCalculado(fila) {
  // marca para enviar valor_manual:null → vuelve al valor calculado por IPC
  overrides[fila.contrato_id] = { valor: null, dirty: true }
  infoPopover.value?.hide()
}

function mostrarInfo(ev, fila) {
  filaInfo.value = fila
  infoPopover.value?.show(ev)
}

function ipcAcumPct(fila) {
  return ((fila.factor_acumulado - 1) * 100).toFixed(3)
}

async function cargarDatos() {
  const periodoReq = periodoActual.value
  loading.value = true
  try {
    const [calcRes, ipcRes] = await Promise.all([
      omService.obtenerCalculo(periodoReq),
      omService.obtenerIpc(),
    ])
    if (periodoReq !== periodoActual.value) return   // respuesta obsoleta: ya se cambió de mes
    filas.value    = calcRes.filas
    ipcTasas.value = ipcRes

    filas.value.forEach(f => {
      if (seleccion[f.contrato_id] === undefined) {
        seleccion[f.contrato_id] = f.incluido && f.habilitado && f.aplica_este_mes
      }
    })
  } catch (e) {
    if (periodoReq !== periodoActual.value) return   // error de una petición ya descartada
    toast.error('Error al cargar', { duration: 3000 })
  } finally {
    if (periodoReq === periodoActual.value) loading.value = false
  }
}

// #7d: exclusión con observación obligatoria por proyecto
const showExclusionDialog = ref(false)
const exclusionPendientes = ref([])   // [{contrato_id, nombre, motivo}]
const exclusionValida = computed(() =>
  exclusionPendientes.value.every(e => e.motivo.trim().length > 0)
)

async function guardarSeleccion() {
  // Proyectos que aplican este mes pero quedaron desmarcados → exigir motivo antes de guardar.
  const excluidos = filas.value.filter(
    f => f.habilitado && f.aplica_este_mes && conContrato(f) && !seleccion[f.contrato_id]
  )
  if (excluidos.length) {
    exclusionPendientes.value = excluidos.map(f => ({
      contrato_id: f.contrato_id, nombre: f.nombre_proyecto, motivo: '',
    }))
    showExclusionDialog.value = true
    return
  }
  await _ejecutarGuardado({})
}

function confirmarExclusiones() {
  const motivos = {}
  exclusionPendientes.value.forEach(e => { motivos[e.contrato_id] = e.motivo.trim() })
  showExclusionDialog.value = false
  _ejecutarGuardado(motivos)
}

async function _ejecutarGuardado(motivos) {
  guardando.value = true
  try {
    const items = filas.value.filter(f => conContrato(f)).map(f => {
      const ov = overrides[f.contrato_id]
      let valor_manual = null
      if (ov && ov.dirty) valor_manual = ov.valor          // override local (o null si revertido)
      else if (f.editado_manual) valor_manual = f.valor_a_facturar  // conserva override persistido
      return {
        contrato_id: f.contrato_id,
        incluido: !!(seleccion[f.contrato_id] && f.habilitado),
        valor_manual,
        motivo_exclusion: motivos[f.contrato_id] || null,
      }
    })
    await omService.guardarSeleccion(periodoActual.value, items)
    Object.keys(overrides).forEach(k => delete overrides[k])
    await cargarDatos()
    toast.success('Selección guardada', { duration: 2500 })
  } catch {
    toast.error('Error al guardar', { duration: 3000 })
  } finally {
    guardando.value = false
  }
}

async function guardarIPC() {
  if (!ipcForm.año || ipcForm.tasaPct == null) return
  guardandoIPC.value = true
  const filasAntes = filas.value.map(f => ({ contrato_id: f.contrato_id, nombre: f.nombre_proyecto, valor: f.valor_a_facturar }))
  try {
    await omService.guardarIpc(ipcForm.año, {
      tasa: ipcForm.tasaPct / 100,
      confirmado: true,
      fuente: ipcForm.fuente || 'manual',
    })
    toast.success('Tasa IPC guardada', { duration: 2500 })
    ipcTasas.value = await omService.obtenerIpc()
    await cargarDatos()
    // Calcular cambios para notificación
    const afectados = []
    filas.value.forEach(f => {
      // #5: los meses facturados quedan congelados — la nueva tasa IPC no los afecta.
      if (f.facturado) return
      const antes = filasAntes.find(x => x.contrato_id === f.contrato_id)
      if (antes && antes.valor != null && f.valor_a_facturar != null && antes.valor !== f.valor_a_facturar) {
        const diff_cop = f.valor_a_facturar - antes.valor
        const diff_pct = antes.valor > 0 ? (diff_cop / antes.valor) * 100 : 0
        afectados.push({ contrato_id: f.contrato_id, nombre: f.nombre_proyecto, valor_anterior: antes.valor, valor_nuevo: f.valor_a_facturar, diff_cop, diff_pct })
      }
    })
    if (afectados.length) {
      notificacionIPC.value = { año: ipcForm.año, tasa: ipcForm.tasaPct / 100, afectados }
    }
  } catch {
    toast.error('Error al guardar IPC', { duration: 3000 })
  } finally {
    guardandoIPC.value = false
  }
}

// ── Factura del proveedor (lectura desde Operaciones) ─────────────────────────
const facturaProveedor = ref({ nombre_archivo: null, enlace_pdf: null, tiene_archivo: false, subido_en: null })

function fmtFechaFactura(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '' }
}

async function cargarFacturaProveedor() {
  const periodoReq = periodoActual.value
  try {
    const data = await omService.obtenerFactura(periodoReq)
    if (periodoReq !== periodoActual.value) return   // respuesta obsoleta
    facturaProveedor.value = data
  } catch { facturaProveedor.value = { nombre_archivo: null, enlace_pdf: null, tiene_archivo: false, subido_en: null } }
}

// Usa OmService (inyecta el Bearer token vía el cliente air compartido) en vez de un
// <a href> directo — VITE_API_URL no está definida en el build de producción, y aunque
// lo estuviera, el endpoint exige Authorization: Bearer, que un <a> no puede enviar.
async function descargarFacturaProveedor() {
  try {
    const blob = await omService.descargarFacturaArchivo(periodoActual.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = facturaProveedor.value.nombre_archivo || `factura-${periodoActual.value}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  } catch (e) {
    if (e.status === 404) {
      toast.warning('Archivo no disponible', {
        description: 'La factura de este período ya no está en el servidor. Vuelve a subirla desde la pestaña Proveedor.',
        duration: 6000,
      })
    } else {
      toast.error('Error al descargar factura', { duration: 3000 })
    }
  }
}

// Marcar/desmarcar facturado desde el panel. Al desmarcar, el backend descongela
// el valor y vuelve a calcularse; al marcar, lo congela al valor actual.
const togglingFacturado = reactive({})
async function toggleFacturado(fila) {
  if (!conContrato(fila)) return
  togglingFacturado[fila.contrato_id] = true
  try {
    await omService.marcarFacturado(periodoActual.value, fila.contrato_id)
    await cargarDatos()
  } catch {
    toast.error('No se pudo cambiar el estado facturado', { duration: 3000 })
  } finally {
    togglingFacturado[fila.contrato_id] = false
  }
}

async function descargarDocumento(fila) {
  descargando[fila.contrato_id] = true
  try {
    const blob = await omService.descargarDocumento(fila.periodo, fila.contrato_id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SOFV_${fila.nombre_proyecto}_${fila.periodo}_mantenimiento.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  } catch (e) {
    if (e.status === 404) {
      toast.warning('Archivo no disponible', {
        description: 'El documento de este proyecto ya no está en el servidor. Vuelve a subir la factura del período desde Proveedor.',
        duration: 6000,
      })
    } else {
      toast.error('Error al descargar documento', { duration: 3000 })
    }
  } finally {
    descargando[fila.contrato_id] = false
  }
}

watch(periodoActual, () => {
  // overrides se indexa solo por contrato_id (no por período) — si no se limpia al
  // cambiar de mes, un valor editado y sin guardar en el mes anterior queda "pegado"
  // al mismo proyecto en el mes nuevo, y puede terminar guardándose ahí por error.
  const habiaSinGuardar = Object.values(overrides).some(o => o.dirty)
  Object.keys(overrides).forEach(k => delete overrides[k])
  editando.value = null
  if (habiaSinGuardar) {
    toast.warning('Ediciones sin guardar descartadas', {
      description: 'Cambiaste de período sin guardar — los valores editados de ese mes no se aplicaron.',
      duration: 4000,
    })
  }
  cargarDatos()
  cargarFacturaProveedor()
})
onMounted(() => { cargarDatos(); cargarFacturaProveedor() })

onBeforeUnmount(() => {
  // Al cambiar de sub-tab (Operaciones/Proveedor) el v-if desmonta este componente y
  // se perderían las ediciones inline sin guardar. Avisamos, igual que al cambiar de mes.
  if (Object.values(overrides).some(o => o.dirty)) {
    toast.warning('Ediciones sin guardar descartadas', {
      description: 'Saliste de esta vista sin guardar — los valores editados no se aplicaron.',
      duration: 4000,
    })
  }
})
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
/* Coincide con la estética de la vista Proyectos */
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }

/* Realce suave de fila al pasar el cursor (paralelo a Proyectos) */
.row-hover { transition: background 0.1s; }

/* Secciones colapsables por tipo (igual que Proyectos) */
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
