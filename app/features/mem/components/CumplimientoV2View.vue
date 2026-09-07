<template>
  <div class="p-5 space-y-5 min-h-screen" style="background: var(--color-unergy-avena); color: var(--color-unergy-deep);">

    <!-- Header -->
    <PageHeader title="Cumplimiento PPA" subtitle="Generación vs. compromisos contractuales de energía">
      <template #lead>
        <div class="cv-icon-tile"><ZapIcon class="size-[1em]" /></div>
      </template>
      <template #actions>
        <button @click="abrirResponsables"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style="border: 1px solid rgba(145,91,216,0.3); color: var(--color-unergy-purple); background: rgba(145,91,216,0.05);"
          v-tooltip.bottom="'Empresa responsable de cada PPA. Los contratos de un responsable no relevante se ocultan en toda esta página.'">
          <BuildingIcon class="text-xs size-[1em]" />
          Responsables
        </button>
        <label class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          :style="verOcultos
            ? 'border: 1px solid rgba(214,68,85,0.35); color: #b03446; background: rgba(214,68,85,0.07);'
            : 'border: 1px solid rgba(44,32,57,0.12); color: #7a6e8a;'"
          v-tooltip.bottom="'Muestra en TODAS las pestañas los contratos cuyo responsable está marcado como no relevante'">
          <Checkbox v-model="verOcultos" :binary="true" />
          Ver ocultos
        </label>
        <span v-if="cacheSize" class="text-xs font-mono px-2 py-1 rounded" style="background: rgba(145,91,216,0.08); color: var(--color-unergy-purple);">
          caché: {{ cacheSize }}
        </span>
        <button @click="clearCacheAndReload"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style="border: 1px solid rgba(214,68,85,0.3); color: #D64455; background: rgba(214,68,85,0.05);"
          :style="cacheClearing ? 'opacity: 0.6; pointer-events: none;' : ''">
          <RefreshCwIcon class="text-xs size-[1em]" :class="{ 'animate-spin': cacheClearing }" />
          Borrar caché y consultar energía
        </button>
      </template>
    </PageHeader>

    <!-- Tab bar -->
    <div class="flex gap-1 border-b -mt-1" style="border-color: rgba(44,32,57,0.08);">
      <button
        v-for="(tab, i) in TABS"
        :key="i"
        @click="activeTab = i"
        class="cv-tab"
        :class="{ active: activeTab === i }"
      >{{ tab }}</button>
    </div>

    <!-- ═══════════════ CUMPLIMIENTO TAB ═══════════════ -->
    <div v-show="activeTab === 1" class="space-y-6">

      <!-- Selectors -->
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="selectedYear" :options="years" class="w-24" @change="onYearChange" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Contrato</label>
          <Select
            v-model="selectedContratoId"
            :options="contratos"
            optionLabel="label"
            optionValue="id"
            placeholder="Seleccionar contrato"
            class="w-72"
            @change="loadAnnualData"
          />
        </div>
        <div class="flex gap-2 ml-auto">
          <Button label="Exportar (Excel)" size="small" outlined :disabled="!anualData || chartLoading || exportingExcel || exportingPdf" :loading="exportingExcel" @click="exportarAnualExcel" v-tooltip.bottom="selectedContratoId === CONSOLIDADO_ID ? 'Una hoja por contrato + resumen consolidado, con plantas participantes' : 'Detalle mensual del contrato con plantas participantes'" style="color:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
            <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
          </Button>
          <Button label="Descargar PDF" size="small" outlined :disabled="!anualData || chartLoading || exportingExcel || exportingPdf" :loading="exportingPdf" @click="exportarAnualPdf" v-tooltip.bottom="'PDF presentable para compartir con el inversionista'" style="color:var(--color-unergy-deep); border-color:var(--color-unergy-deep);">
            <template #icon><FileTextIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

      <!-- Chart loading -->
      <div v-if="chartLoading" class="flex flex-col items-center justify-center py-20 gap-3">
        <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
        <p class="text-sm" style="color: #7a6e8a;">Consultando generación para 12 meses…</p>
      </div>

      <!-- Chart error -->
      <Message v-else-if="chartError" severity="error" :closable="false">{{ chartError }}</Message>

      <!-- Chart -->
      <template v-else-if="anualData">
        <div class="flex items-center gap-2 text-sm flex-wrap" style="color: #7a6e8a;">
          <span class="font-semibold text-base" style="color: var(--color-unergy-deep);">
            {{ anualData.contrato.nombre_interno || anualData.contrato.numero_codigo_contrato }}
          </span>
          <span>·</span>
          <span>{{ anualData.contrato.comprador_nombre }}</span>
          <span>·</span>
          <span>{{ anualData.year }}</span>
          <span v-if="selectedContratoId === CONSOLIDADO_ID" class="text-xs px-2 py-0.5 rounded-full font-medium" style="background: rgba(145,91,216,0.12); color: var(--color-unergy-purple);">
            Suma de todos los contratos
          </span>
        </div>

        <div class="cv-panel p-4">
          <div ref="chartBox" class="relative select-none" style="width: 100%; height: 360px;">
            <svg
              :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
              preserveAspectRatio="xMidYMid meet"
              style="width: 100%; height: 100%;"
              @mousemove="onSvgMousemove"
              @mouseleave="hovered = null"
              @click="onSvgClick"
            >
              <g v-for="gl in yGridLines" :key="gl.val">
                <line :x1="PAD_L" :y1="gl.y" :x2="SVG_W - PAD_R" :y2="gl.y" stroke="rgba(44,32,57,0.07)" stroke-width="1" />
                <text :x="PAD_L - 7" :y="gl.y + 4" text-anchor="end" font-size="10" fill="#7a6e8a">{{ fmtShort(gl.val) }}</text>
              </g>

              <g v-for="(mes, i) in anualData.meses" :key="i">
                <!-- Background highlights -->
                <rect v-if="isCurrentMonth(mes)" :x="slotX(i)" y="0" :width="slotW" :height="SVG_H - PAD_B + 2" fill="rgba(145,91,216,0.06)" />
                <rect v-if="selectedMonthIdx === i" :x="slotX(i)" y="0" :width="slotW" :height="SVG_H - PAD_B + 2" fill="rgba(240,192,64,0.08)" />
                <!-- Commitment zone (green band) -->
                <rect v-if="mes.min_mwh !== null && mes.max_mwh !== null" :x="slotX(i)" :y="toY(mes.max_mwh)" :width="slotW" :height="toY(mes.min_mwh) - toY(mes.max_mwh)" fill="rgba(46,125,50,0.10)" />

                <!-- CURRENT MONTH: two bars side by side -->
                <template v-if="mes.tipo_datos === 'mes_actual'">
                  <!-- Left bar: actual generation (solid) -->
                  <rect v-if="mes.gen_mwh > 0"
                    :x="dualBarLeftX(i)" :y="toY(mes.gen_mwh)" :width="dualBarW" :height="toY(0) - toY(mes.gen_mwh)"
                    fill="var(--color-unergy-purple)" rx="1" />
                  <!-- Right bar: projected close (lighter + pattern) -->
                  <rect v-if="cierreVal(mes) > 0"
                    :x="dualBarRightX(i)" :y="toY(cierreVal(mes))" :width="dualBarW" :height="toY(0) - toY(cierreVal(mes))"
                    fill="rgba(59,186,220,0.65)" rx="1" />
                  <rect v-if="cierreVal(mes) > 0"
                    :x="dualBarRightX(i)" :y="toY(cierreVal(mes))" :width="dualBarW" :height="toY(0) - toY(cierreVal(mes))"
                    fill="none" stroke="rgba(59,186,220,0.9)" stroke-width="1" stroke-dasharray="3,2" rx="1" />
                  <!-- Deficit/excedent shading on projection bar -->
                  <rect v-if="mes.estado === 'deficit' && mes.min_mwh !== null && cierreVal(mes) > 0 && cierreVal(mes) < mes.min_mwh"
                    :x="dualBarRightX(i)" :y="toY(mes.min_mwh)" :width="dualBarW" :height="toY(cierreVal(mes)) - toY(mes.min_mwh)"
                    fill="rgba(214,68,85,0.32)" />
                  <rect v-if="mes.estado === 'excedente' && mes.max_mwh !== null && cierreVal(mes) > mes.max_mwh"
                    :x="dualBarRightX(i)" :y="toY(cierreVal(mes))" :width="dualBarW" :height="toY(mes.max_mwh) - toY(cierreVal(mes))"
                    fill="rgba(20,184,166,0.5)" />
                </template>

                <!-- PAST / FUTURE months: single bar -->
                <template v-else>
                  <rect v-if="genVal(mes) > 0" :x="barX(i)" :y="toY(genVal(mes))" :width="barW" :height="toY(0) - toY(genVal(mes))"
                    :fill="mes.tipo_datos === 'proyeccion_historica' ? 'rgba(59,186,220,0.55)' : 'var(--color-unergy-purple)'" />
                  <rect v-if="genVal(mes) > 0 && mes.tipo_datos === 'proyeccion_historica'" :x="barX(i)" :y="toY(genVal(mes))" :width="barW" :height="toY(0) - toY(genVal(mes))"
                    fill="none" stroke="rgba(59,186,220,0.9)" stroke-width="1" stroke-dasharray="3,2" />
                  <rect v-if="mes.estado === 'deficit' && mes.min_mwh !== null && genVal(mes) > 0 && genVal(mes) < mes.min_mwh"
                    :x="barX(i)" :y="toY(mes.min_mwh)" :width="barW" :height="toY(genVal(mes)) - toY(mes.min_mwh)"
                    fill="rgba(214,68,85,0.32)" />
                  <rect v-if="mes.estado === 'excedente' && mes.max_mwh !== null && genVal(mes) > mes.max_mwh"
                    :x="barX(i)" :y="toY(genVal(mes))" :width="barW" :height="toY(mes.max_mwh) - toY(genVal(mes))"
                    fill="rgba(20,184,166,0.5)" />
                </template>

                <!-- Min/max lines -->
                <line v-if="mes.min_mwh !== null" :x1="slotX(i)" :y1="toY(mes.min_mwh)" :x2="slotX(i) + slotW" :y2="toY(mes.min_mwh)" stroke="rgba(214,68,85,0.50)" stroke-width="1" />
                <line v-if="mes.max_mwh !== null" :x1="slotX(i)" :y1="toY(mes.max_mwh)" :x2="slotX(i) + slotW" :y2="toY(mes.max_mwh)" stroke="rgba(145,91,216,0.50)" stroke-width="1" />
                <!-- Hover highlight -->
                <rect v-if="hovered === i && selectedMonthIdx !== i" :x="slotX(i)" :y="PAD_T" :width="slotW" :height="PLOT_H" fill="rgba(145,91,216,0.07)" />
                <!-- Month label -->
                <circle v-if="selectedMonthIdx === i" :cx="slotX(i) + slotW / 2" :cy="SVG_H - PAD_B + 30" r="3" fill="#F0C040" />
                <text :x="slotX(i) + slotW / 2" :y="SVG_H - PAD_B + 17" text-anchor="middle" font-size="11"
                  :fill="selectedMonthIdx === i ? '#F0C040' : isCurrentMonth(mes) ? 'var(--color-unergy-deep)' : '#7a6e8a'"
                  :font-weight="selectedMonthIdx === i || isCurrentMonth(mes) ? '700' : '400'"
                >{{ MESES_CORTOS[i] }}</text>
                <!-- Clickable area -->
                <rect :x="slotX(i)" :y="PAD_T" :width="slotW" :height="PLOT_H" fill="transparent" style="cursor: pointer;" />
              </g>

              <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="PAD_T + PLOT_H" stroke="rgba(44,32,57,0.18)" stroke-width="1" />
              <line :x1="PAD_L" :y1="PAD_T + PLOT_H" :x2="SVG_W - PAD_R" :y2="PAD_T + PLOT_H" stroke="rgba(44,32,57,0.18)" stroke-width="1" />
            </svg>

            <!-- Tooltip -->
            <div
              v-if="hovered !== null && anualData.meses[hovered]"
              class="absolute pointer-events-none z-10 rounded-xl shadow-lg text-sm"
              style="background: var(--color-unergy-deep); color: var(--color-unergy-avena); padding: 10px 14px; min-width: 200px;"
              :style="{ left: tooltipX + 'px', top: tooltipY + 'px', transform: 'translateY(-100%)' }"
            >
              <div class="font-bold mb-2" style="color: #F0C040;">
                {{ MESES[hovered] }} {{ selectedYear }}
                <span v-if="anualData.meses[hovered].tipo_datos === 'mes_actual'" class="ml-1 text-xs font-normal" style="color: rgba(59,186,220,0.85);">mes en curso</span>
                <span v-else-if="anualData.meses[hovered].tipo_datos === 'proyeccion_historica'" class="ml-1 text-xs font-normal" style="color: rgba(253,250,247,0.55);">proyección</span>
              </div>
              <div class="space-y-1">
                <!-- Current month: show both actual and projection -->
                <template v-if="anualData.meses[hovered].tipo_datos === 'mes_actual'">
                  <div class="flex justify-between gap-6">
                    <span style="color: #c4a1f0;">Generación actual</span>
                    <span class="font-mono font-semibold" style="color: #c4a1f0;">{{ fmtMwh(anualData.meses[hovered].gen_mwh) }}</span>
                  </div>
                  <div v-if="cierreVal(anualData.meses[hovered])" class="flex justify-between gap-6">
                    <span style="color: rgba(59,186,220,0.9);">Proy. cierre</span>
                    <span class="font-mono font-bold" style="color: rgba(59,186,220,0.95);">{{ fmtMwh(cierreVal(anualData.meses[hovered])) }}</span>
                  </div>
                  <div v-if="anualData.meses[hovered].dias_restantes != null" class="text-xs mt-0.5" style="color: rgba(253,250,247,0.40);">
                    {{ anualData.meses[hovered].dia_actual }}d transcurridos · {{ anualData.meses[hovered].dias_restantes }}d restantes
                  </div>
                </template>
                <!-- Past / Future: single value -->
                <template v-else>
                  <div class="flex justify-between gap-6">
                    <span style="color: rgba(253,250,247,0.65);">Generación</span>
                    <span class="font-mono font-semibold">{{ fmtMwh(genVal(anualData.meses[hovered])) }}</span>
                  </div>
                </template>
                <div v-if="anualData.meses[hovered].min_mwh !== null" class="flex justify-between gap-6">
                  <span style="color: rgba(253,250,247,0.65);">Mínimo</span>
                  <span class="font-mono">{{ fmtMwh(anualData.meses[hovered].min_mwh) }}</span>
                </div>
                <div v-if="anualData.meses[hovered].max_mwh !== null" class="flex justify-between gap-6">
                  <span style="color: rgba(253,250,247,0.65);">Máximo</span>
                  <span class="font-mono">{{ fmtMwh(anualData.meses[hovered].max_mwh) }}</span>
                </div>
                <div v-if="anualData.meses[hovered].estado === 'deficit'" class="flex justify-between gap-6 mt-2 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                  <span style="color: #D64455;">Déficit (proy.)</span>
                  <span class="font-mono font-bold" style="color: #D64455;">{{ fmtMwh(anualData.meses[hovered].compras_bolsa_mwh) }}</span>
                </div>
                <div v-if="anualData.meses[hovered].estado === 'excedente'" class="flex justify-between gap-6 mt-2 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                  <span style="color: #2DD4BF;">Excedente (proy.)</span>
                  <span class="font-mono font-bold" style="color: #2DD4BF;">{{ fmtMwh(anualData.meses[hovered].excedentes_bolsa_mwh) }}</span>
                </div>
              </div>
              <div class="mt-2 pt-1 text-xs" style="color: rgba(253,250,247,0.35);">Clic para ver desglose</div>
            </div>
          </div>

          <!-- Legend -->
          <div class="flex flex-wrap gap-5 mt-3 pl-1">
            <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(46,125,50,0.18); border: 1px solid rgba(46,125,50,0.45);"></div>Zona de cumplimiento</div>
            <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: var(--color-unergy-purple);"></div>Generación real</div>
            <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(59,186,220,0.65); border: 1px dashed rgba(59,186,220,0.9);"></div>Proyección cierre (prom. 30d)</div>
            <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(214,68,85,0.38);"></div>Brecha de déficit</div>
            <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(20,184,166,0.6);"></div>Excedente contractual</div>
          </div>
        </div>
      </template>

      <!-- Empty chart state -->
      <div v-else-if="!chartLoading && !chartError" class="text-center py-16 cv-panel" style="color: #7a6e8a;">
        <ChartColumnIcon class="text-4xl mb-3 block size-[1em]" style="color: var(--color-unergy-purple);" />
        <p>Selecciona un año y un contrato para ver el cumplimiento anual.</p>
      </div>

      <!-- Summary table -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold" style="color: var(--color-unergy-deep);">Resumen anual por contrato — {{ selectedYear }}</h2>
          <span v-if="tableLoading" class="text-xs" style="color: #7a6e8a;">Cargando…</span>
        </div>
        <DataTable
          :value="tableDataWithTotal"
          size="small"
          stripedRows
          class="cv-panel overflow-hidden cursor-pointer"
          @row-click="e => selectContrato(e.data.id)"
          :rowClass="row => row.id === selectedContratoId ? 'row-selected' : row.id === CONSOLIDADO_ID ? 'row-consolidado' : ''"
        >
          <Column header="Contrato" style="min-width: 200px;">
            <template #body="{ data: row }">
              <div class="font-semibold text-sm" style="color: var(--color-unergy-deep);">{{ row.nombre_interno || row.numero_codigo_contrato }}</div>
              <div class="text-xs mt-0.5" style="color: #7a6e8a;">{{ row.comprador_nombre }}<span v-if="esOculto(row)" class="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1.5" style="background: rgba(214,68,85,0.12); color: #b03446;" v-tooltip.top="'Responsable: ' + row.responsable + ' — normalmente oculto en Cumplimiento'">{{ row.responsable }}</span></div>
            </template>
          </Column>
          <Column header="Vigencia" style="width: 190px;">
            <template #body="{ data: row }">
              <span class="text-xs" style="color: #7a6e8a;">{{ fmtFecha(row.fecha_inicio) }} – {{ fmtFecha(row.fecha_fin) }}</span>
            </template>
          </Column>
          <Column header="Mín anual" style="width: 130px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.total_min_mwh !== null" class="font-mono text-sm">{{ fmtMwh(row.total_min_mwh) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column header="Máx anual" style="width: 130px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.total_max_mwh !== null" class="font-mono text-sm">{{ fmtMwh(row.total_max_mwh) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column header="Meses" style="width: 90px; text-align: center;">
            <template #body="{ data: row }">
              <span class="font-mono text-sm">{{ row.meses_con_compromisos }}<span class="text-xs" style="color: #7a6e8a;">/12</span></span>
            </template>
          </Column>
          <Column style="width: 44px; text-align: center;">
            <template #body="{ data: row }">
              <ChartColumnIcon v-if="row.id === selectedContratoId" class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
              <ChevronRightIcon v-else class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
            </template>
          </Column>
        </DataTable>
      </div>

    </div>

    <!-- ═══════════════ SIMULADOR TAB ═══════════════ -->
    <div v-show="activeTab === 0" class="space-y-5">

      <!-- Controls -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="simYear" :options="years" class="w-24" @change="loadSimulator" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Mes</label>
          <Select v-model="simMonth" :options="MESES_OPTIONS" optionLabel="label" optionValue="value" class="w-36" @change="loadSimulator" />
        </div>
        <button @click="resetSim" class="cv-btn">
          <RefreshCwIcon class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />Resetear
        </button>
        <button v-if="hiddenContratos.size > 0" @click="showAllContratos" class="cv-btn">
          <EyeIcon class="text-xs size-[1em]" style="color: #2e7d32;" />Mostrar ocultos ({{ hiddenContratos.size }})
        </button>
        <button
          @click="sortDesc = !sortDesc"
          class="cv-btn"
          v-tooltip="sortDesc ? 'Mayor cumplimiento primero' : 'Menor cumplimiento primero'"
        >
          <ArrowDownWideNarrowIcon v-if="sortDesc" class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
          <ArrowUpNarrowWideIcon v-else class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
          {{ sortDesc ? '↓ Mayor %' : '↑ Menor %' }}
        </button>

        <!-- Filtro por estado (derivado de la proyección de cierre) -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            @click="estadoFiltro = null"
            class="cv-btn"
            :style="estadoFiltro === null ? 'border-color:var(--color-unergy-purple); background:rgba(145,91,216,0.10); color:var(--color-unergy-purple); font-weight:700;' : ''"
          >Todos</button>
          <button
            v-for="f in ESTADO_FILTROS"
            :key="f.key"
            @click="toggleEstadoFiltro(f.key)"
            class="cv-btn"
            :style="estadoFiltro === f.key ? `border-color:${f.color}; background:${f.color}1f; color:${f.color}; font-weight:700;` : ''"
            v-tooltip="f.tip"
          >
            <span class="inline-block rounded-full" :style="`width:8px; height:8px; background:${f.color};`"></span>
            {{ f.label }}
            <b class="ml-0.5">{{ estadoCounts[f.key] }}</b>
          </button>
        </div>

        <!-- Filtro por offtaker (comprador del contrato) -->
        <MultiSelect v-model="offtakersFiltro" :options="offtakerOpts" optionLabel="label" optionValue="value"
                     filter :showToggleAll="false" placeholder="Todos los offtakers"
                     :maxSelectedLabels="2" selectedItemsLabel="{0} offtakers" class="text-sm" style="min-width:12rem;"
                     v-tooltip.bottom="'Filtrar contratos por offtaker (comprador)'" />

        <div class="flex-1"></div>
        <button @click="showNuevoForm = true" class="cv-btn-cta">
          <PlusIcon class="text-xs size-[1em]" />PPA nuevo
        </button>
        <span class="w-full text-xs" style="color: #9b8fb0;">Arrastra las plantas entre contratos para simular</span>
      </div>

      <!-- Formulario PPA nuevo -->
      <div v-if="showNuevoForm" class="rounded-xl border p-5" style="background: white; border-color: rgba(240,192,64,0.4);">
        <div class="flex items-center gap-2 mb-4">
          <ZapIcon class="size-[1em]" style="color: #F0C040;" />
          <span class="font-bold text-sm" style="color: var(--color-unergy-deep);">Nuevo PPA nuevo</span>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold" style="color: #7a6e8a;">Nombre</label>
            <InputText v-model="ficticioNombre" placeholder="Ej: PPA Simulado 1" class="w-48" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold" style="color: #7a6e8a;">Mínimo (MWh)</label>
            <InputText v-model.number="ficticioMin" type="number" placeholder="0" class="w-32" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold" style="color: #7a6e8a;">Máximo (MWh)</label>
            <InputText v-model.number="ficticioMax" type="number" placeholder="0" class="w-32" />
          </div>
          <div class="flex gap-2">
            <button
              @click="crearNuevo"
              :disabled="!ficticioNombre || ficticioMax <= 0"
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition"
              :style="!ficticioNombre || ficticioMax <= 0
                ? 'background: rgba(44,32,57,0.08); color: rgba(44,32,57,0.3); cursor: not-allowed;'
                : 'background: var(--color-unergy-purple); color: white; cursor: pointer;'"
            >
              <CheckIcon class="text-xs size-[1em]" />Crear
            </button>
            <button
              @click="showNuevoForm = false"
              class="px-3 py-2 rounded-lg text-sm transition"
              style="color: #7a6e8a;"
            >Cancelar</button>
          </div>
        </div>
      </div>

      <div v-if="simLoading" class="flex flex-col items-center justify-center py-20 gap-3">
        <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
        <p class="text-sm" style="color: #7a6e8a;">Cargando generación promedio de las plantas…</p>
      </div>

      <div v-else-if="simError" class="flex flex-col items-center gap-3 py-10">
        <Message severity="error" :closable="false">{{ simError }}</Message>
        <button @click="loadSimulator()"
          class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style="background: var(--color-unergy-purple); color: white;">
          <RefreshCwIcon class="mr-1 size-[1em]" /> Reintentar
        </button>
      </div>

      <template v-else-if="simData">

        <!-- Contract columns (responsive grid) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="c in visibleContratos"
              :key="c.id"
              class="cv-card flex flex-col"
              :class="{ 'cv-card-dragover': dragOver === c.id }"
              @dragover.prevent="onDragOver(c.id)"
              @drop.prevent="onDrop(c.id)"
            >
              <!-- Contract header -->
              <div
                class="px-4 pt-3 pb-2 border-b flex items-start justify-between gap-2 cursor-pointer select-none"
                style="border-color: rgba(44,32,57,0.07);"
                @click="toggleExpand(c.id)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <ChevronDownIcon v-if="expandedContratos.includes(c.id)" class="text-xs transition-transform flex-shrink-0 size-[1em]" style="color: var(--color-unergy-purple);" />
                  <ChevronRightIcon v-else class="text-xs transition-transform flex-shrink-0 size-[1em]" style="color: var(--color-unergy-purple);" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-bold text-sm break-words" style="color: var(--color-unergy-deep);">{{ c.nombre }}</span>
                      <span v-if="c._ficticio" class="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style="background: rgba(240,192,64,0.18); color: #9a6700;">Nuevo</span>
                      <span v-if="simResults[c.id]?.plantasEsp != null"
                        class="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                        :style="estadoBadge(simResults[c.id].estadoPlantas)"
                        v-tooltip="'Plantas inscritas (registradas y despachando vía GESCON) / plantas contrato (exigidas) — este mes'"
                      >{{ simResults[c.id].plantasReg }}/{{ simResults[c.id].plantasEsp }} plantas</span>
                      <span v-else class="text-xs font-mono flex-shrink-0" style="color: #7a6e8a;">{{ (simAssignments[c.id] || []).length }} plantas</span>
                      <span v-if="simResults[c.id]?.pct !== null && simResults[c.id]?.pct !== undefined"
                        class="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                        :style="estadoBadge(simResults[c.id].estado)"
                      >{{ Math.round(simResults[c.id].pct) }}%</span>
                    </div>
                    <div class="text-xs mt-0.5 truncate" style="color: #7a6e8a;">{{ c.comprador_nombre }}<span v-if="esOculto(c)" class="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1.5" style="background: rgba(214,68,85,0.12); color: #b03446;" v-tooltip.top="'Responsable: ' + c.responsable + ' — normalmente oculto en Cumplimiento'">{{ c.responsable }}</span></div>
                  </div>
                </div>
                <div class="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    @click.stop="abrirDetalleCapa(c)"
                    class="rounded-md p-1 transition-colors hover:bg-purple-50"
                    style="color: var(--color-unergy-purple);"
                    v-tooltip="'Ver detalle de la capa'"
                  >
                    <MaximizeIcon class="text-xs size-[1em]" />
                  </button>
                  <button
                    v-if="c._ficticio"
                    @click.stop="eliminarNuevo(c.id)"
                    class="rounded-md p-1 transition-colors hover:bg-red-50"
                    style="color: #D64455;"
                    v-tooltip="'Eliminar PPA'"
                  >
                    <Trash2Icon class="text-xs size-[1em]" />
                  </button>
                  <button
                    @click.stop="hideContrato(c.id)"
                    class="rounded-md p-1 transition-colors hover:bg-red-50"
                    style="color: #b0a0c0;"
                    v-tooltip="'Ocultar contrato'"
                  >
                    <EyeOffIcon class="text-xs size-[1em]" />
                  </button>
                </div>
              </div>

              <!-- Cumplimiento — tabla de energías + barras consecutivas -->
              <div class="px-4 py-3 border-b" style="border-color: rgba(44,32,57,0.07);" v-if="simResults[c.id]">
                <!-- Tabla: títulos + valores -->
                <div class="grid grid-cols-3 gap-x-3 mb-3">
                  <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wide leading-tight" style="color: #7a6e8a;">Energía entregada</div>
                    <div class="flex items-baseline gap-1 mt-1 flex-wrap">
                      <span class="font-mono text-xs font-bold" style="color: var(--color-unergy-deep);">{{ fmtMwh(simResults[c.id].gen) }}</span>
                      <span v-if="simResults[c.id].genDup > 0"
                        class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style="background: rgba(240,192,64,0.22); color: #9a6700;"
                        v-tooltip="'De lo entregado, esta parte es compra en bolsa'"
                      ><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />{{ fmtMwh(simResults[c.id].genDup) }} bolsa</span>
                    </div>
                  </div>
                  <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wide leading-tight" style="color: #7a6e8a;">Energía mínima</div>
                    <div class="font-mono text-xs font-bold mt-1" style="color: var(--color-unergy-deep);">{{ simResults[c.id].min !== null ? fmtMwh(simResults[c.id].min) : '—' }}</div>
                  </div>
                  <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wide leading-tight" style="color: #7a6e8a;">Energía proyectada</div>
                    <div class="font-mono text-xs font-bold mt-1" style="color: var(--color-unergy-deep);">{{ simResults[c.id].genProy != null && simResults[c.id].genProy > 0 ? fmtMwh(simResults[c.id].genProy) : '—' }}</div>
                  </div>
                </div>

                <!-- Bullet chart: una barra con zonas déficit / en rango / excedente -->
                <div class="space-y-1.5">
                  <div class="relative rounded-md overflow-hidden" style="height: 26px; background: rgba(44,32,57,0.04);">
                    <!-- Zonas de fondo -->
                    <template v-if="simResults[c.id].bullet.hasZones">
                      <div v-if="simResults[c.id].bullet.hasMin" class="absolute inset-y-0"
                        :style="{ left: '0', width: simResults[c.id].bullet.minPct + '%', background: 'rgba(214,68,85,0.10)' }" />
                      <div class="absolute inset-y-0"
                        :style="{ left: simResults[c.id].bullet.minPct + '%', width: (simResults[c.id].bullet.maxPct - simResults[c.id].bullet.minPct) + '%', background: 'rgba(46,125,50,0.11)' }" />
                      <div v-if="simResults[c.id].bullet.hasMax" class="absolute inset-y-0"
                        :style="{ left: simResults[c.id].bullet.maxPct + '%', right: '0', background: 'rgba(20,184,166,0.14)' }" />
                    </template>
                    <!-- Energía entregada (color = estado) -->
                    <div class="absolute rounded-sm transition-all duration-300"
                      style="top: 50%; transform: translateY(-50%); height: 10px; left: 0;"
                      :style="{ width: simResults[c.id].bullet.measurePct + '%', background: estadoColor(simResults[c.id].estado) }" />
                    <!-- Compra en bolsa: tramo amarillo DENTRO de la barra entregada -->
                    <div v-if="simResults[c.id].bullet.dupW"
                      class="absolute transition-all duration-300"
                      style="top: 50%; transform: translateY(-50%); height: 10px; background: #E0A800; opacity: 0.92;"
                      :style="{ left: simResults[c.id].bullet.bolsaStartPct + '%', width: simResults[c.id].bullet.dupW + '%' }"
                      v-tooltip="'Compra en bolsa (origen del suministro)'" />
                    <!-- Marcas mín / máx -->
                    <div v-if="simResults[c.id].bullet.hasMin" class="absolute rounded"
                      style="top: -1px; bottom: -1px; width: 2px; background: var(--color-unergy-deep); opacity: 0.45;"
                      :style="{ left: simResults[c.id].bullet.minPct + '%' }" v-tooltip="'Mínimo: ' + fmtMwh(simResults[c.id].min)" />
                    <div v-if="simResults[c.id].bullet.hasMax" class="absolute rounded"
                      style="top: -1px; bottom: -1px; width: 2px; background: var(--color-unergy-deep); opacity: 0.45;"
                      :style="{ left: simResults[c.id].bullet.maxPct + '%' }" v-tooltip="'Máximo: ' + fmtMwh(simResults[c.id].max)" />
                    <!-- Proyección de cierre (diamante) -->
                    <div v-if="simResults[c.id].bullet.proyPct != null" class="absolute"
                      style="top: 50%; width: 11px; height: 11px; transform: translate(-50%,-50%) rotate(45deg); background: #fff; border: 2px solid var(--color-unergy-deep); border-radius: 2px;"
                      :style="{ left: simResults[c.id].bullet.proyPct + '%' }"
                      v-tooltip="'Proyección de cierre: ' + fmtMwh(simResults[c.id].genProy)" />
                  </div>
                  <!-- Estados -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :style="estadoBadge(simResults[c.id].estado)">
                      {{ estadoLabel(simResults[c.id].estado) }}
                    </span>
                    <span v-if="simResults[c.id].genProy != null && simResults[c.id].genProy > 0"
                      class="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      :style="estadoBadge(simResults[c.id].estadoProy)">
                      ◆ proy. {{ estadoLabel(simResults[c.id].estadoProy) }}
                    </span>
                  </div>
                </div>

              </div>

              <!-- Plant drop zone (collapsible) -->
              <div v-show="expandedContratos.includes(c.id)" class="p-3 space-y-1.5 overflow-y-auto sim-plant-zone" style="min-height: 64px; max-height: 220px;">
                <div
                  v-for="p in (simAssignments[c.id] || [])"
                  :key="p.id"
                  draggable="true"
                  @dragstart="onDragStart(p, c.id)"
                  @dragend="onDragEnd"
                  class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs select-none"
                  :style="[
                    p.comprado_por_unergy
                      ? 'background: rgba(240,192,64,0.12); cursor: grab; border: 1px solid rgba(240,192,64,0.4);'
                      : 'background: rgba(145,91,216,0.08); cursor: grab; border: 1px solid rgba(145,91,216,0.15);',
                    dragPlanta && dragPlanta.id === p.id ? 'opacity: 0.35;' : '',
                  ]"
                >
                  <div class="min-w-0">
                    <span class="font-medium truncate block" style="color: var(--color-unergy-deep); max-width: 128px;">{{ p.nombre }}</span>
                    <span v-if="p.es_duplicado && !p.comprado_por_unergy" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5"
                      style="background: rgba(240,192,64,0.22); color: #9a6700;"
                      v-tooltip="'Compra en bolsa — cuenta para el contrato, origen bolsa'"
                    ><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Compra bolsa</span>
                    <span v-else-if="p.comprado_por_unergy" class="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                      style="background: rgba(240,192,64,0.25); color: #9a6700;"
                      v-tooltip="p.contrato_compra_nombre || 'Contrato de compra'"
                    >Compra Unergy</span>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="font-mono font-semibold" :style="p.es_duplicado ? 'color: #9a6700;' : p.comprado_por_unergy ? 'color: #9a6700;' : 'color: var(--color-unergy-purple);'">
                      {{ p.month_mwh != null ? fmtMwh(p.month_mwh * p.pct_despacho) : '—' }}
                    </div>
                    <div style="color: #7a6e8a;">{{ (p.pct_despacho * 100).toFixed(0) }}%</div>
                  </div>
                </div>
                <div
                  v-if="dragOver === c.id"
                  class="flex items-center justify-center py-3 rounded-lg text-xs border border-dashed"
                  style="color: var(--color-unergy-purple); border-color: rgba(145,91,216,0.4); background: rgba(145,91,216,0.04);"
                >
                  Soltar aquí
                </div>
                <div
                  v-else-if="!(simAssignments[c.id] || []).length"
                  class="flex items-center justify-center py-3 rounded-lg text-xs border border-dashed"
                  style="color: rgba(44,32,57,0.22); border-color: rgba(44,32,57,0.12);"
                >
                  Arrastra plantas aquí
                </div>
              </div>
            </div>
        </div>

        <!-- Sin contrato pool -->
        <div
          class="rounded-xl border p-4 transition-shadow"
          style="border-color: rgba(44,32,57,0.12); background: white;"
          :style="dragOver === 'none' ? 'border-color: var(--color-unergy-purple); box-shadow: 0 0 0 2px rgba(145,91,216,0.18);' : ''"
          @dragover.prevent="dragOver = 'none'"
          @drop.prevent="onDrop(null)"
        >
          <p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: #7a6e8a;">
            Sin contrato
            <span class="ml-1 font-normal normal-case tracking-normal" style="color: rgba(44,32,57,0.3);">(no contribuye al cumplimiento)</span>
          </p>
          <div class="flex flex-wrap gap-2 min-h-8">
            <div
              v-for="p in (simAssignments['none'] || [])"
              :key="p.id"
              draggable="true"
              @dragstart="onDragStart(p, null)"
              @dragend="onDragEnd"
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs select-none"
              :style="[
                p.comprado_por_unergy
                  ? 'background: rgba(240,192,64,0.15); cursor: grab; border: 1px solid rgba(240,192,64,0.4);'
                  : 'background: rgba(44,32,57,0.06); cursor: grab; border: 1px solid rgba(44,32,57,0.10);',
                dragPlanta && dragPlanta.id === p.id ? 'opacity: 0.35;' : '',
              ]"
            >
              <span class="font-medium" style="color: var(--color-unergy-deep);">{{ p.nombre }}</span>
              <span v-if="p.es_duplicado && !p.comprado_por_unergy" class="font-semibold px-1.5 py-0.5 rounded"
                style="background: rgba(240,192,64,0.22); color: #9a6700;"
                v-tooltip="'Compra en bolsa'"
              >Bolsa</span>
              <span v-else-if="p.comprado_por_unergy" class="font-semibold px-1.5 py-0.5 rounded"
                style="background: rgba(240,192,64,0.25); color: #9a6700;"
                v-tooltip="p.contrato_compra_nombre || 'Contrato de compra'"
              >Compra</span>
              <span class="font-mono" :style="p.es_duplicado ? 'color: #9a6700;' : p.comprado_por_unergy ? 'color: #9a6700;' : 'color: #7a6e8a;'">
                {{ p.month_mwh != null ? fmtMwh(p.month_mwh) : '—' }}
              </span>
            </div>
            <div
              v-if="dragOver === 'none'"
              class="flex items-center justify-center px-4 py-1.5 rounded-lg text-xs border border-dashed"
              style="color: var(--color-unergy-purple); border-color: rgba(145,91,216,0.4); background: rgba(145,91,216,0.04);"
            >
              Soltar aquí
            </div>
            <span v-else-if="!(simAssignments['none'] || []).length" class="text-xs py-1" style="color: rgba(44,32,57,0.3);">
              No hay plantas sin contrato
            </span>
          </div>
        </div>

      </template>

    </div>

    <!-- ═══════════════ PROYECTOS TAB ═══════════════ -->
    <div v-show="activeTab === 2" class="space-y-5">

      <!-- Month selector + mode switch -->
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="pcYear" :options="years" class="w-24" @change="loadPlantasContratos" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Mes</label>
          <Select v-model="pcMonth" :options="MESES_OPTIONS" optionLabel="label" optionValue="value" class="w-40" @change="loadPlantasContratos" />
        </div>
        <!-- Estados estandarizados a-f (catálogo GET /clasificacion-energia/categorias) -->
        <div class="flex flex-wrap items-end gap-3">
          <div v-for="grupo in PC_GRUPOS" :key="grupo.label" class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wider" style="color: #9b89b5;">{{ grupo.label }}</span>
            <div class="flex rounded-lg overflow-hidden border" style="border-color: rgba(44,32,57,0.15);">
              <button
                v-for="mode in grupo.modes" :key="mode.key"
                @click="pcMode = mode.key"
                class="px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                :style="pcMode === mode.key
                  ? `background: ${mode.bg}; color: ${mode.color};`
                  : 'background: transparent; color: #7a6e8a;'"
              >
                {{ mode.agente }}
                <span v-if="pcCounts" class="font-mono text-[10px] px-1 rounded"
                  style="background: rgba(44,32,57,0.08);"
                  v-tooltip.bottom="pcFechaCorte ? `Vigentes al ${pcFechaCorte}` : 'Vigentes'">{{ pcCountsVigentes[mode.key] ?? 0 }}</span>
                <span v-if="pcCountsTerminados[mode.key]" class="font-mono text-[10px] px-1 rounded"
                  style="background: rgba(214,68,85,0.14); color: #D64455;"
                  v-tooltip.bottom="`${pcCountsTerminados[mode.key]} terminaron durante el mes (siguen listados abajo, en rojo)`">+{{ pcCountsTerminados[mode.key] }}</span>
              </button>
            </div>
          </div>
        </div>
        <span class="text-xs max-w-md" style="color: #7a6e8a;">
          {{ PC_MODE_DESC[pcMode] }}
          <span v-if="pcFechaCorte" class="block mt-0.5" style="color: #9b89b5;">
            El contador cuenta lo vigente al {{ pcFechaCorte }}; en
            <span style="color: #D64455; font-weight: 600;">rojo</span> lo que terminó durante el mes.
          </span>
        </span>
        <Button label="Exportar resumen (Excel)" size="small" outlined class="ml-auto" :disabled="!pcData || pcLoading" @click="exportarResumenPlantasContratos" v-tooltip.bottom="'Descarga TODAS las categorías del mes, incl. plantas externas (todos los contratos y plantas), sin importar el filtro activo'" style="color:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <div v-if="pcLoading" class="flex flex-col items-center justify-center py-20 gap-3">
        <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
        <p class="text-sm" style="color: #7a6e8a;">Cargando plantas y contratos…</p>
      </div>

      <Message v-else-if="pcError" severity="error" :closable="false">{{ pcError }}</Message>

      <template v-else-if="pcData">

        <!-- a. PPA Venta (UNGG) -->
        <template v-if="pcMode === 'ppa_venta_ungg'">
          <!-- Filtro por modalidad de suministro: propio / compra en bolsa / uso del recurso -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-semibold uppercase tracking-wider mr-1" style="color: #9b89b5;">Modalidad</span>
            <button @click="pcModalidad = null" class="cv-btn"
              :style="pcModalidad === null ? 'border-color:var(--color-unergy-purple); background:rgba(145,91,216,0.10); color:var(--color-unergy-purple); font-weight:700;' : ''"
              v-tooltip.bottom="'Todas las plantas del contrato de venta'">
              Todas <b class="ml-0.5">{{ pcVentaDupInfo.total }}</b>
            </button>
            <button v-for="f in PC_MODALIDAD_FILTROS" :key="f.key"
              @click="pcModalidad = pcModalidad === f.key ? null : f.key" class="cv-btn"
              :style="pcModalidad === f.key ? `border-color:${f.color}; background:${f.color}1f; color:${f.color}; font-weight:700;` : ''"
              v-tooltip.bottom="f.tip">
              <span class="inline-block rounded-full" :style="`width:8px; height:8px; background:${f.color};`"></span>
              {{ f.label }} <b class="ml-0.5">{{ pcModalidadCounts[f.key] }}</b>
            </button>
          </div>

          <!-- Resumen de modalidades: duplicados (compra en bolsa) y uso del recurso -->
          <div v-if="pcVentaDupInfo.dup || pcVentaDupInfo.ur" class="flex flex-col gap-1 px-4 py-2.5 rounded-lg text-xs"
            style="background: rgba(44,32,57,0.03); border: 1px solid rgba(44,32,57,0.12); color: var(--color-unergy-deep);">
            <div class="flex items-center flex-wrap gap-x-3 gap-y-1">
              <span><b>{{ pcVentaDupInfo.total }}</b> plantas en total.</span>
              <span v-if="pcVentaDupInfo.dup" class="inline-flex items-center gap-1" style="color: #9a6700;">
                <ShoppingCartIcon class="size-[1em]" style="font-size: 10px;" /><b>{{ pcVentaDupInfo.dup }}</b> duplicados (compra en bolsa)
              </span>
              <span v-if="pcVentaDupInfo.ur" class="inline-flex items-center gap-1" style="color: #0369a1;">
                <RefreshCwIcon class="size-[1em]" style="font-size: 10px;" /><b>{{ pcVentaDupInfo.ur }}</b> uso del recurso
              </span>
              <span style="color: #7a6e8a;">· resto suministro propio.</span>
            </div>
            <span style="color: #7a6e8a;">
              Duplicados y uso del recurso también aparecen en «Compra en bolsa (UNGG)» — el duplicado se compra en bolsa (genera garantías); el uso del recurso se le paga al cliente a precio bolsa (sin garantías).
            </span>
          </div>
          <div v-if="!ppaVentaFiltrado.length" class="text-center py-12 text-sm" style="color: #7a6e8a;">
            <template v-if="pcModalidad">No hay plantas de «{{ PC_MODALIDAD_FILTROS.find(f => f.key === pcModalidad)?.label }}» en {{ MESES[pcMonth - 1] }} {{ pcYear }}.</template>
            <template v-else>No hay contratos de venta (UNGG) vigentes en {{ MESES[pcMonth - 1] }} {{ pcYear }}.</template>
          </div>
          <div v-for="c in ppaVentaFiltrado" :key="c.id" class="cv-card">
            <div class="px-4 py-3 flex items-center justify-between cv-row-click"
              style="background: rgba(145,91,216,0.04); border-bottom: 1px solid rgba(44,32,57,0.07);"
              @click="abrirDetalleContrato(c, 'ppa_venta_ungg')"
              v-tooltip.right="'Ver detalle del contrato (PPA + GESCON)'">
              <div>
                <span class="font-bold text-sm" style="color: var(--color-unergy-deep);">{{ c.nombre }}</span>
                <span class="ml-2 text-xs" style="color: #7a6e8a;">{{ c.comprador_nombre }}</span><span v-if="esOculto(c)" class="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1.5" style="background: rgba(214,68,85,0.12); color: #b03446;" v-tooltip.top="'Responsable: ' + c.responsable + ' — normalmente oculto en Cumplimiento'">{{ c.responsable }}</span>
                <InfoIcon class="ml-1.5 size-[1em]" style="font-size: 11px; color: #9b89b5;" />
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-xs font-mono px-2 py-0.5 rounded"
                  style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);">
                  {{ c.plantas.length }} plantas
                </span>
                <span v-if="c.plantas.filter(p => p.es_duplicado && !p.uso_del_recurso).length"
                  class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                  style="background: rgba(240,192,64,0.22); color: #9a6700;"
                  v-tooltip.bottom="'Plantas de este contrato que son compra en bolsa (duplicados)'">
                  <ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />{{ c.plantas.filter(p => p.es_duplicado && !p.uso_del_recurso).length }} duplicadas
                </span>
                <span v-if="c.plantas.filter(p => p.uso_del_recurso).length"
                  class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                  style="background: rgba(2,132,199,0.14); color: #0369a1;"
                  v-tooltip.bottom="'Plantas de este contrato marcadas como uso del recurso'">
                  <RefreshCwIcon class="size-[1em]" style="font-size: 9px;" />{{ c.plantas.filter(p => p.uso_del_recurso).length }} uso recurso
                </span>
                <button
                  @click.stop="copiarImagenVenta(c)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                  :style="copiadoVentaId === c.id ? 'background: rgba(46,125,50,0.12); color: #2e7d32;' : 'background: var(--color-unergy-purple); color: white;'"
                  v-tooltip.left="'Copia la imagen al portapapeles (o la descarga si el navegador no lo permite)'"
                >
                  <CheckIcon v-if="copiadoVentaId === c.id" class="text-xs size-[1em]" />
                  <ImageIcon v-else class="text-xs size-[1em]" />
                  {{ copiadoVentaId === c.id ? '¡Copiado!' : 'Copiar imagen' }}
                </button>
              </div>
            </div>
            <div v-if="c.plantas.length" class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in c.plantas" :key="filaKey(p)" class="px-4 py-2.5 flex items-center justify-between text-sm cv-row-click"
                :style="p.uso_del_recurso ? 'background: rgba(2,132,199,0.06);' : p.es_duplicado ? 'background: rgba(240,192,64,0.08);' : ''"
                @click="abrirDetalleContrato(c, 'ppa_venta_ungg')"
                v-tooltip.left="'Ver detalle del contrato (PPA + GESCON)'">
                <div class="flex items-center gap-2">
                  <span class="font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span v-if="filaTerminada(p)" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(214,68,85,0.12); color: #D64455;"
                    v-tooltip="'Salió de esta modalidad durante el mes — su tramo siguiente está en otra piscina'"><LogOutIcon class="size-[1em]" style="font-size: 9px;" />Terminó</span>
                  <span v-if="p.uso_del_recurso" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(2,132,199,0.14); color: #0369a1;"
                    v-tooltip="'Uso del recurso: la planta está en bolsa y se le paga al cliente su generación a precio bolsa — también listada en c. Compra en Bolsa (UNGG). No genera garantías.'"><RefreshCwIcon class="size-[1em]" style="font-size: 9px;" />Uso del recurso</span>
                  <span v-else-if="p.es_duplicado" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(240,192,64,0.22); color: #9a6700;"
                    v-tooltip="'Duplicado: suministra a este contrato con origen bolsa — también listado en c. Compra en Bolsa (UNGG). Genera garantías.'"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Duplicado</span>
                  <span v-if="p.codigo_sic" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(44,32,57,0.06); color: #7a6e8a;">{{ p.codigo_sic }}</span>
                  <span v-if="p.pct_despacho != null" class="text-xs font-mono" style="color: var(--color-unergy-purple);">{{ (p.pct_despacho * 100).toFixed(0) }}%</span>
                </div>
                <div class="text-xs font-mono text-right" :style="filaColorFecha(p) || 'color: #7a6e8a;'">
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-4 text-xs text-center" style="color: rgba(44,32,57,0.3);">
              Sin plantas asignadas en GESCON para {{ MESES[pcMonth - 1] }} {{ pcYear }}
            </div>
          </div>
        </template>

        <!-- b. PPA Compra (UNGC) -->
        <template v-if="pcMode === 'ppa_compra_ungc'">
          <div v-if="!pcPools.ppa_compra_ungc.length" class="text-center py-12 text-sm" style="color: #7a6e8a;">
            No hay contratos de compra vigentes en {{ MESES[pcMonth - 1] }} {{ pcYear }}
          </div>
          <div v-for="c in pcPools.ppa_compra_ungc" :key="c.id" class="cv-card-gold">
            <div class="px-4 py-3 flex items-center justify-between cv-row-click"
              style="background: rgba(240,192,64,0.08); border-bottom: 1px solid rgba(240,192,64,0.2);"
              @click="abrirDetalleContrato(c, 'ppa_compra_ungc')"
              v-tooltip.right="'Ver detalle del contrato (PPA + GESCON)'">
              <div>
                <span class="font-bold text-sm" style="color: #9a6700;">{{ c.nombre }}</span>
                <span class="ml-2 text-xs" style="color: #7a6e8a;">Vendedor: {{ c.vendedor_nombre }}</span>
                <InfoIcon class="ml-1.5 size-[1em]" style="font-size: 11px; color: #9b89b5;" />
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded"
                style="background: rgba(240,192,64,0.18); color: #9a6700;">
                {{ c.plantas.length }} plantas
              </span>
            </div>
            <div v-if="c.plantas.length" class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in c.plantas" :key="filaKey(p)" class="px-4 py-2.5 flex items-center justify-between text-sm cv-row-click"
                @click="abrirDetalleContrato(c, 'ppa_compra_ungc')"
                v-tooltip.left="'Ver detalle del contrato (PPA + GESCON)'">
                <span class="font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</span>
                <div class="text-xs font-mono text-right" :style="filaColorFecha(p) || 'color: #7a6e8a;'">
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- g. Plantas externas: PPAs de compra directa a terceros, fuera de GESCON -->
        <template v-if="pcMode === 'ppa_compra_externa'">
          <Message v-if="externasSinPlantas.length" severity="warn" :closable="false">
            <span v-if="externasSinPlantas.length === 1">
              El contrato <b>{{ externasSinPlantas[0].nombre }}</b> no tiene plantas vinculadas:
              no sabemos a qué planta le estamos comprando. Asóciala en el módulo PPA.
            </span>
            <span v-else>
              {{ externasSinPlantas.length }} contratos de compra externa no tienen plantas vinculadas:
              <b>{{ externasSinPlantas.map(c => c.nombre).join(', ') }}</b>.
              Asócialas en el módulo PPA para saber a qué planta le compramos.
            </span>
          </Message>
          <div v-if="!pcPools.ppa_compra_externa.length" class="text-center py-12 text-sm" style="color: #7a6e8a;">
            No hay PPAs de compra a plantas externas vigentes en {{ MESES[pcMonth - 1] }} {{ pcYear }}.<br/>
            <span class="text-xs">Se registran en el módulo PPA con tipo de contrato «compra» (sin código GESCON).</span>
          </div>
          <div v-for="c in pcPools.ppa_compra_externa" :key="c.id" class="cv-card-gold">
            <div class="px-4 py-3 flex items-center justify-between cv-row-click"
              style="background: rgba(240,192,64,0.08); border-bottom: 1px solid rgba(240,192,64,0.2);"
              @click="abrirDetalleContrato(c, 'ppa_compra_externa')"
              v-tooltip.right="'Ver detalle del contrato PPA'">
              <div>
                <span class="font-bold text-sm" style="color: #9a6700;">{{ c.nombre }}</span>
                <span class="ml-2 text-xs" style="color: #7a6e8a;">
                  Le compramos a: <span class="font-semibold" style="color: var(--color-unergy-deep);">{{ c.vendedor_nombre || '—' }}</span>
                  <span v-if="c.vendedor_nit"> · NIT {{ c.vendedor_nit }}</span>
                </span>
                <InfoIcon class="ml-1.5 size-[1em]" style="font-size: 11px; color: #9b89b5;" />
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span v-if="c.tarifa_base != null" class="text-xs font-mono px-2 py-0.5 rounded"
                  style="background: rgba(240,192,64,0.18); color: #9a6700;"
                  v-tooltip="'Tarifa base del PPA'">{{ Number(c.tarifa_base).toLocaleString('es-CO') }} $/kWh</span>
                <span v-if="!c.plantas.length" class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                  style="background: rgba(214,68,85,0.12); color: #D64455;"
                  v-tooltip="'No sabemos a qué planta le compramos — asóciala en el módulo PPA'">
                  <TriangleAlertIcon class="size-[1em]" style="font-size: 10px;" />Sin plantas vinculadas
                </span>
                <span v-else class="text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(240,192,64,0.18); color: #9a6700;">
                  {{ c.plantas.length }} plantas
                </span>
              </div>
            </div>
            <div v-if="c.plantas.length" class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in c.plantas" :key="filaKey(p)" class="px-4 py-2.5 flex items-center justify-between text-sm cv-row-click"
                @click="abrirDetalleContrato(c, 'ppa_compra_externa')"
                v-tooltip.left="'Ver detalle del contrato PPA'">
                <span class="font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</span>
                <div class="text-xs font-mono text-right" :style="filaColorFecha(p) || 'color: #7a6e8a;'">
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-4 text-xs text-center" style="color: rgba(44,32,57,0.3);">
              Sin plantas vinculadas — asócialas al contrato en el módulo PPA
            </div>
          </div>
        </template>

        <!-- c. Compra en Bolsa (UNGG): duplicados agrupados por el contrato al que aportan -->
        <template v-if="pcMode === 'bolsa_compra_ungg'">
          <div v-if="!pcPools.bolsa_compra_ungg.length" class="cv-card">
            <div class="px-4 py-8 text-xs text-center" style="color: rgba(44,32,57,0.35);">
              Sin compras en bolsa de UNGG en {{ MESES[pcMonth - 1] }} {{ pcYear }}.<br/>
              Aquí aparecen las plantas duplicadas (origen bolsa) y las de uso del recurso que aportan a un contrato de venta.
              Los contratos PLC entrarán cuando se liquiden en plataforma.
            </div>
          </div>
          <div v-if="pcPools.bolsa_compra_ungg.length" class="flex flex-col gap-1.5 px-4 py-2.5 rounded-lg text-xs"
            style="background: rgba(44,32,57,0.03); border: 1px solid rgba(44,32,57,0.12); color: var(--color-unergy-deep);">
            <span>
              La misma planta también suministra a un contrato de venta (aparece en «Venta · UNGG»);
              aquí se agrupa por el contrato al que aporta. Hay <b>dos modalidades</b>:
            </span>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span class="inline-flex items-center gap-1" style="color: #9a6700;">
                <ShoppingCartIcon class="size-[1em]" style="font-size: 10px;" /><b>Duplicado</b> — su energía se compra en bolsa (genera garantías).
              </span>
              <span class="inline-flex items-center gap-1" style="color: #0369a1;">
                <RefreshCwIcon class="size-[1em]" style="font-size: 10px;" /><b>Uso del recurso</b> — se le paga al cliente a precio bolsa (sin garantías).
              </span>
            </div>
          </div>
          <div v-for="c in pcPools.bolsa_compra_ungg" :key="c.id" class="cv-card-gold">
            <div class="px-4 py-3 flex items-center justify-between cv-row-click"
              style="background: rgba(240,192,64,0.08); border-bottom: 1px solid rgba(240,192,64,0.2);"
              @click="abrirDetalleContrato(c, 'bolsa_compra_ungg')"
              v-tooltip.right="'Ver detalle del contrato (PPA + GESCON)'">
              <div>
                <span class="font-bold text-sm" style="color: #9a6700;">{{ c.nombre }}</span>
                <span class="ml-2 text-xs" style="color: #7a6e8a;">compra en bolsa para cumplir este contrato · {{ c.comprador_nombre }}</span>
                <InfoIcon class="ml-1.5 size-[1em]" style="font-size: 11px; color: #9b89b5;" />
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(240,192,64,0.18); color: #9a6700;">
                {{ c.plantas.length }} plantas
              </span>
            </div>
            <div class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in c.plantas" :key="filaKey(p)" class="px-4 py-2.5 flex items-center justify-between text-sm cv-row-click"
                @click="abrirDetalleContrato(c, 'bolsa_compra_ungg')"
                v-tooltip.left="'Ver detalle del contrato (PPA + GESCON)'">
                <div class="flex items-center gap-2">
                  <RefreshCwIcon v-if="p.uso_del_recurso" class="size-[1em]" :style="`font-size: 10px; color: ${p.uso_del_recurso ? '#0369a1' : '#9a6700'};`" />
                  <ShoppingCartIcon v-else class="size-[1em]" :style="`font-size: 10px; color: ${p.uso_del_recurso ? '#0369a1' : '#9a6700'};`" />
                  <span class="font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span v-if="p.uso_del_recurso" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(2,132,199,0.14); color: #0369a1;"
                    v-tooltip="'Uso del recurso: la planta está en bolsa y también suministra a un contrato de venta (Venta · UNGG); se le paga al cliente a precio bolsa. No genera garantías.'">Uso del recurso</span>
                  <span v-else class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(240,192,64,0.22); color: #9a6700;"
                    v-tooltip="'Duplicado: esta planta también suministra a un contrato de venta (Venta · UNGG); su energía a este contrato se compra en bolsa. Genera garantías.'">Duplicado</span>
                  <span v-if="p.codigo_sic" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(44,32,57,0.06); color: #7a6e8a;">{{ p.codigo_sic }}</span>
                </div>
                <div class="text-xs font-mono" :style="filaColorFecha(p) || 'color: #7a6e8a;'">
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- d. Compra en Bolsa (UNGC): reglas por definir -->
        <template v-if="pcMode === 'bolsa_compra_ungc'">
          <div class="cv-card">
            <div class="px-4 py-10 text-center space-y-2">
              <CompassIcon class="size-[1em]" style="font-size: 22px; color: #9b89b5;" />
              <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Compra en Bolsa (UNGC) — reglas por definir</p>
              <p class="text-xs max-w-lg mx-auto" style="color: #7a6e8a;">
                Ocurre cuando UNGC debe comprar en bolsa, pero todavía no hay reglas de negocio
                definidas para clasificarlo. La categoría queda reservada en el estándar
                (<span class="font-mono">bolsa_compra_ungc</span>) y se activará cuando se definan.
              </p>
            </div>
          </div>
        </template>

        <!-- e. Venta en Bolsa (UNGG): sin contrato GESCON -->
        <template v-if="pcMode === 'bolsa_venta_ungg'">
          <div v-if="pcPools.bolsa_venta_ungg.length" class="cv-card">
            <div class="px-4 py-3" style="background: rgba(44,32,57,0.04); border-bottom: 1px solid rgba(44,32,57,0.07);">
              <span class="font-bold text-sm" style="color: var(--color-unergy-deep);">Venta en Bolsa (UNGG)</span>
              <span class="ml-2 text-xs" style="color: #7a6e8a;">Días de {{ MESES[pcMonth - 1] }} {{ pcYear }} sin contrato en GESCON — venden en bolsa como generador</span>
              <span class="ml-2 text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(44,32,57,0.08); color: #7a6e8a;">
                {{ pcPools.bolsa_venta_ungg.length }}
              </span>
            </div>
            <div class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in pcPools.bolsa_venta_ungg" :key="filaKey(p)" class="px-4 py-2.5 text-sm cv-row-click flex items-center justify-between"
                @click="abrirDetallePlanta(p, 'bolsa_venta_ungg')"
                v-tooltip.left="'Ver historial GESCON de la planta'">
                <div class="flex items-center gap-2">
                  <span class="font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span v-if="filaTerminada(p)" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(214,68,85,0.12); color: #D64455;"
                    v-tooltip="'Estuvo libre en bolsa solo este tramo del mes; después entró a otra modalidad'"><LogOutIcon class="size-[1em]" style="font-size: 9px;" />Terminó</span>
                </div>
                <div class="text-xs font-mono" :style="filaColorFecha(p) || 'color: #7a6e8a;'">
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="cv-card">
            <div class="px-4 py-8 text-xs text-center" style="color: rgba(44,32,57,0.3);">
              Todas las plantas tuvieron asignación GESCON todos los días del mes
            </div>
          </div>
        </template>

        <!-- f. Venta en Bolsa (UNGC): SIC vigente con comprador UNGC -->
        <template v-if="pcMode === 'bolsa_venta_ungc'">
          <div v-if="pcPools.bolsa_venta_ungc.length" class="cv-card">
            <div class="px-4 py-3" style="background: rgba(44,32,57,0.04); border-bottom: 1px solid rgba(44,32,57,0.07);">
              <span class="font-bold text-sm" style="color: var(--color-unergy-deep);">Venta en Bolsa (UNGC)</span>
              <span class="ml-2 text-xs" style="color: #7a6e8a;">UNGC compra la energía a UNGG (usualmente a precio de bolsa) para venderla en bolsa — SIC vigente con comprador UNGC</span>
              <span class="ml-2 text-xs font-mono px-2 py-0.5 rounded" style="background: rgba(44,32,57,0.08); color: #7a6e8a;">
                {{ pcPools.bolsa_venta_ungc.length }}
              </span>
            </div>
            <div class="divide-y" style="border-color: rgba(44,32,57,0.05);">
              <div v-for="p in pcPools.bolsa_venta_ungc" :key="filaKey(p)" class="px-4 py-2.5 text-sm font-medium cv-row-click" :style="filaColorNombre(p)"
                @click="abrirDetallePlanta(p, 'bolsa_venta_ungc')"
                v-tooltip.left="'Ver detalle GESCON de la planta'">
                <div class="flex items-center gap-2">
                  <span>{{ p.nombre }}</span>
                  <span v-if="p.codigo_sic" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(44,32,57,0.06); color: #7a6e8a;">{{ p.codigo_sic }}</span>
                  <span v-if="filaTerminada(p)" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style="background: rgba(214,68,85,0.12); color: #D64455;"
                    v-tooltip="'Estuvo en esta modalidad solo un tramo del mes'"><LogOutIcon class="size-[1em]" style="font-size: 9px;" />Terminó</span>
                </div>
                <div v-if="ventanaBolsa(p)" class="text-xs mt-0.5" style="color: #7a6e8a;"
                     v-tooltip.right="'Vigencia del registro SIC con comprador UNGC que pone la planta en esta modalidad'">
                  <CalendarIcon class="size-[1em]" style="font-size: 10px;" /> {{ ventanaBolsa(p) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="cv-card">
            <div class="px-4 py-8 text-xs text-center" style="color: rgba(44,32,57,0.3);">
              Ninguna planta está en bolsa con el comercializador este mes
            </div>
          </div>
        </template>

      </template>
    </div>

    <!-- ═══════════════ ENERGÍA TRANSADA TAB ═══════════════ -->
    <div v-show="activeTab === 3" class="space-y-5">

      <!-- Selectors -->
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="etYear" :options="etYearOptions" class="w-24" @change="onEtPeriodChange" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Mes</label>
          <Select v-model="etMonth" :options="etMonthOptions" optionLabel="label" optionValue="value" class="w-40" @change="onEtPeriodChange" />
        </div>
        <span v-if="etData" class="text-xs px-2 py-1 rounded" style="background: rgba(145,91,216,0.08); color: var(--color-unergy-purple);">
          {{ etPeriodoLabel }}
        </span>
        <span v-if="etFromCache" class="text-xs px-2 py-1 rounded" style="background: rgba(44,32,57,0.06); color: #7a6e8a;" title="Datos del histórico guardado en este navegador">
          <HistoryIcon class="text-xs mr-1 size-[1em]" />histórico local
        </span>
      </div>

      <div v-if="etLoading" class="flex flex-col items-center justify-center py-20 gap-3">
        <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
        <p class="text-sm" style="color: #7a6e8a;">Consultando energía transada de {{ MESES[etMonth - 1] }}…</p>
      </div>

      <Message v-else-if="etError" severity="error" :closable="false">{{ etError }}</Message>

      <template v-else-if="etData">

        <Message v-if="etData.warning" severity="warn" :closable="false">{{ etData.warning }}</Message>

        <!-- Summary cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="cv-card px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: #7a6e8a;">Total transada</p>
            <p class="text-2xl font-bold font-mono" style="color: var(--color-unergy-deep);">{{ fmtMwh(etData.totales.gen_mwh) }} <span class="text-sm font-normal">MWh</span></p>
            <p class="text-xs mt-0.5" style="color: #7a6e8a;">{{ etData.totales.n_plantas }} proyectos con datos</p>
          </div>
          <div class="cv-card px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: var(--color-unergy-purple);">Vía PPA</p>
            <p class="text-2xl font-bold font-mono" style="color: var(--color-unergy-purple);">{{ fmtMwh(etData.totales.ppa_mwh) }} <span class="text-sm font-normal">MWh</span></p>
            <p class="text-xs mt-0.5" style="color: #7a6e8a;">{{ etPct(etData.totales.ppa_mwh) }}% del total</p>
          </div>
          <div class="cv-card px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: var(--color-unergy-deep);">En bolsa</p>
            <p class="text-2xl font-bold font-mono" style="color: var(--color-unergy-deep);">{{ fmtMwh(etData.totales.bolsa_mwh) }} <span class="text-sm font-normal">MWh</span></p>
            <p class="text-xs mt-0.5" style="color: #7a6e8a;">{{ etPct(etData.totales.bolsa_mwh) }}% del total</p>
          </div>
        </div>

        <!-- Tabla por proyecto -->
        <div class="cv-card overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr style="color: #7a6e8a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(145,91,216,0.04);">
                <th class="text-left px-4 py-3">Proyecto</th>
                <th class="text-left px-2 py-3">Cómo se transó</th>
                <th class="text-right px-2 py-3">PPA (MWh)</th>
                <th class="text-right px-2 py-3">Bolsa (MWh)</th>
                <th class="text-right px-4 py-3">Total (MWh)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in etData.plantas" :key="p.id" style="border-top: 1px solid rgba(44,32,57,0.06);">
                <td class="px-4 py-2.5 font-medium" style="color: var(--color-unergy-deep);">
                  {{ p.nombre }}
                  <span v-if="p.modo === 'sin_datos'" class="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(214,68,85,0.12); color: #D64455;">sin datos</span>
                </td>
                <td class="px-2 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="c in p.contratos.filter(c => !c.es_duplicado)" :key="c.id"
                      class="text-xs px-1.5 py-0.5 rounded font-medium"
                      style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);"
                      :title="`${c.dias_activos} días activos`">
                      {{ c.nombre }} · {{ (c.pct * 100).toFixed(0) }}%
                    </span>
                    <span v-if="p.modo === 'bolsa' || p.modo === 'mixto'"
                      class="text-xs px-1.5 py-0.5 rounded font-medium"
                      style="background: rgba(44,32,57,0.08); color: var(--color-unergy-deep);">Bolsa</span>
                    <span v-if="p.modo === 'sin_datos'" class="text-xs" style="color: #7a6e8a;">—</span>
                  </div>
                </td>
                <td class="px-2 py-2.5 text-right font-mono" style="color: var(--color-unergy-purple);">{{ p.ppa_mwh !== null ? fmtMwh(p.ppa_mwh) : '—' }}</td>
                <td class="px-2 py-2.5 text-right font-mono" style="color: var(--color-unergy-deep);">{{ p.bolsa_mwh !== null ? fmtMwh(p.bolsa_mwh) : '—' }}</td>
                <td class="px-4 py-2.5 text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">{{ p.gen_mwh !== null ? fmtMwh(p.gen_mwh) : '—' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid rgba(44,32,57,0.12); background: rgba(145,91,216,0.04);">
                <td class="px-4 py-3 font-bold" style="color: var(--color-unergy-deep);">TOTAL ENERGÍA TRANSADA</td>
                <td></td>
                <td class="px-2 py-3 text-right font-mono font-bold" style="color: var(--color-unergy-purple);">{{ fmtMwh(etData.totales.ppa_mwh) }}</td>
                <td class="px-2 py-3 text-right font-mono font-bold" style="color: var(--color-unergy-deep);">{{ fmtMwh(etData.totales.bolsa_mwh) }}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-base" style="color: var(--color-unergy-deep);">{{ fmtMwh(etData.totales.gen_mwh) }}</td>
              </tr>
            </tfoot>
          </table>
          <div v-if="!etData.plantas.length" class="px-4 py-10 text-sm text-center" style="color: rgba(44,32,57,0.35);">
            Sin proyectos con energía transada en {{ MESES[etMonth - 1] }} {{ etYear }}
          </div>
        </div>

      </template>
    </div>

    <!-- ═══════════════ MATRIZ ANUAL TAB ═══════════════ -->
    <div v-show="activeTab === 4" class="space-y-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <Select v-model="anualMatrizYear" :options="years" class="w-28" @change="loadAnualMatriz" />
          <label class="flex items-center gap-1.5 text-sm" style="color:#7a6e8a;">
            <Checkbox v-model="matrizSoloNoCumple" :binary="true" /> Solo no cumple
          </label>
          <InputText v-model="matrizBusqueda" placeholder="Buscar contrato…" class="text-sm" />
          <MultiSelect v-model="matrizContratosSel" :options="matrizContratoOpts" optionLabel="label" optionValue="value"
                       filter :showToggleAll="false" placeholder="Todos los contratos"
                       :maxSelectedLabels="2" selectedItemsLabel="{0} contratos" class="text-sm" style="min-width:13rem;">
            <template #option="{ option }">
              <div class="flex flex-col leading-tight">
                <span>{{ option.label }}</span>
                <span v-if="option.offtaker" class="text-xs" style="color:#7a6e8a;">{{ option.offtaker }}</span>
              </div>
            </template>
          </MultiSelect>
          <MultiSelect v-model="matrizOfftakersSel" :options="matrizOfftakerOpts"
                       filter :showToggleAll="false" placeholder="Todos los offtakers"
                       :maxSelectedLabels="2" selectedItemsLabel="{0} offtakers" class="text-sm" style="min-width:12rem;" />
        </div>
        <div class="flex items-center gap-2">
          <span v-if="matrizFilasCargando" class="text-xs" style="color:#7a6e8a;">Cargando contratos…</span>
          <Button label="Exportar Excel" size="small" outlined :disabled="!anualMatrizData || matrizFilasCargando" @click="exportarMatrizExcel">
            <template #icon><DownloadIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
      <ProgressSpinner v-if="anualMatrizLoading" />
      <Message v-else-if="anualMatrizError" severity="error" :closable="false">{{ anualMatrizError }}</Message>
      <div v-if="anualMatrizData" class="overflow-x-auto border rounded-lg" style="border-color:rgba(44,32,57,0.08);">
        <table class="cv-matriz text-sm">
          <thead>
            <tr>
              <th class="sticky-col text-left px-3 py-2">Contrato / Proyecto</th>
              <th v-for="(mes, i) in MESES" :key="i" class="px-2 py-2 text-right">{{ mes.slice(0,3) }}</th>
              <th class="px-3 py-2 text-right">Total</th>
              <th class="px-3 py-2 text-center">Estado</th>
              <th class="px-3 py-2 text-center">Energía</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="c in matrizFiltrada" :key="c.id">
              <!-- Fila contrato -->
              <tr class="cv-matriz-contrato cursor-pointer" @click="toggleMatriz(c.id)">
                <td class="sticky-col px-3 py-1.5">
                  <ChevronDownIcon v-if="expandedMatriz.includes(c.id)" class="text-xs mr-1 size-[1em]" />
                  <ChevronRightIcon v-else class="text-xs mr-1 size-[1em]" />
                  <span class="font-semibold">{{ c.nombre_interno || c.numero_codigo_contrato }}</span>
                  <span class="text-xs ml-1" style="color:#7a6e8a;">{{ c.comprador_nombre }}<span v-if="c.n_plantas != null"> · {{ c.n_plantas }} pl.</span></span>
                  <span v-if="c.responsable" class="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1.5 align-middle"
                        :style="responsableChip(c)"
                        v-tooltip.top="c.responsable_relevante === false
                          ? `Responsable: ${c.responsable} — normalmente oculto en esta matriz`
                          : `Responsable: ${c.responsable}`">
                    {{ c.responsable }}
                  </span>
                  <LoaderCircleIcon class="text-xs ml-1 size-[1em] animate-spin" v-if="c._loading" style="color:var(--color-unergy-purple);" />
                </td>
                <td v-for="i in 12" :key="i" class="px-2 py-1.5 text-right font-mono"
                    :style="{ color: c.meses[i-1] ? estadoColor(c.meses[i-1].estado) : '#c9c0d8' }"
                    v-tooltip.top="c.meses[i-1] ? (estadoLabel(c.meses[i-1].estado) + ' · ' + c.meses[i-1].tipo_datos) : ''">
                  <span v-if="c.meses[i-1]">{{ fmtNum(c.meses[i-1].valor_mwh) }}</span>
                  <span v-else-if="c._error" style="color:#D64455;">!</span>
                  <span v-else style="color:#d4cce0;">·</span>
                </td>
                <td class="px-3 py-1.5 text-right font-mono font-bold">{{ c.total_anual_mwh != null ? fmtNum(c.total_anual_mwh) : '·' }}</td>
                <td class="px-3 py-1.5 text-center">
                  <span v-if="c._loading" class="text-[11px]" style="color:#b0a0c0;">…</span>
                  <span v-else-if="c._error" class="text-[11px]" style="color:#D64455;">error</span>
                  <span v-else class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        :style="estadoBadge(c.estado_cumplimiento === 'cumple' ? 'ok' : 'deficit')"
                        v-tooltip.top="c.meses_en_deficit + ' mes(es) en déficit'">
                    {{ c.estado_cumplimiento === 'cumple' ? '✓ Cumple' : '✗ No cumple' }}
                  </span>
                </td>
                <td class="px-3 py-1.5 text-center">
                  <span v-if="c._loading" class="text-[11px]" style="color:#b0a0c0;">…</span>
                  <span v-else-if="c._error" class="text-[11px]" style="color:#D64455;">—</span>
                  <span v-else class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        :style="estadoBadge(c.requiere_bolsa ? 'excedente' : 'ok')"
                        v-tooltip.top="c.requiere_bolsa ? (fmtMwh(c.bolsa_anual_mwh) + ' vía bolsa') : 'Cubierto con generación real'">
                    {{ c.requiere_bolsa ? '◆ Bolsa' : '● Real' }}
                  </span>
                </td>
              </tr>
              <!-- Filas proyecto (expandidas) -->
              <template v-if="expandedMatriz.includes(c.id)">
                <tr v-for="p in c.proyectos" :key="c.id + '-' + p.id" class="cv-matriz-proyecto">
                  <td class="sticky-col px-3 py-1 pl-8">
                    <span>{{ p.nombre }}</span>
                    <span class="text-xs ml-1" style="color:#7a6e8a;">{{ Math.round((p.pct_despacho_rep||0)*100) }}% part.</span>
                  </td>
                  <td v-for="(m, i) in p.meses" :key="i" class="px-2 py-1 text-right font-mono text-xs" style="color:#5a5168;">
                    {{ fmtNum(m.valor_mwh) }}
                  </td>
                  <td colspan="3"></td>
                </tr>
              </template>
            </template>
            <!-- Total general -->
            <tr class="cv-matriz-total">
              <td class="sticky-col px-3 py-2 font-bold">TOTAL ({{ matrizFiltrada.length }})</td>
              <td v-for="(t, i) in matrizTotalesMensuales" :key="i" class="px-2 py-2 text-right font-mono font-bold">{{ fmtNum(t) }}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════ BALANCE DE ENERGÍA TAB ═══════════════ -->
    <div v-show="activeTab === 5" class="space-y-5">

      <!-- Selectors -->
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="beYear" :options="years" class="w-24" @change="loadBalance" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Mes</label>
          <Select v-model="beMonth" :options="MESES_OPTIONS" optionLabel="label" optionValue="value" class="w-40" @change="loadBalance" />
        </div>
        <span v-if="beData" class="text-xs px-2 py-1 rounded" style="background: rgba(145,91,216,0.08); color: var(--color-unergy-purple);">
          {{ bePeriodoLabel }}
        </span>
        <label v-if="beData && beData.advertencias.compra_externa_en_bolsa.length"
          class="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded"
          style="background: rgba(214,68,85,0.06); color: var(--color-unergy-deep);">
          <Checkbox v-model="beExcluirExterna" binary @change="loadBalance" />
          Excluir plantas de compra externa
        </label>
      </div>

      <div v-if="beLoading" class="flex flex-col items-center justify-center py-20 gap-3">
        <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
        <p class="text-sm" style="color: #7a6e8a;">Calculando el balance de {{ MESES[beMonth - 1] }}…</p>
      </div>

      <Message v-else-if="beError" severity="error" :closable="false">{{ beError }}</Message>

      <template v-else-if="beData">

        <Message v-if="beData.warning" severity="warn" :closable="false">{{ beData.warning }}</Message>

        <Message v-if="beData.periodo.es_mes_futuro" severity="info" :closable="false">
          {{ MESES[beMonth - 1] }} {{ beYear }} todavía no empieza: no hay generación real con la que construir un balance.
        </Message>

        <template v-else>

          <!-- ── Libro mayor ─────────────────────────────────────────────── -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <!-- UNGG -->
            <div class="cv-card px-5 py-4">
              <div class="flex items-baseline justify-between mb-1">
                <h3 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-unergy-deep);">UNGG · generador</h3>
                <span class="text-[11px]" style="color: #7a6e8a;">MWh</span>
              </div>
              <p class="text-xs mb-3" style="color: #7a6e8a;">
                Su venta y sus compras en bolsa se contrarrestan: es el mismo agente en la misma liquidación.
              </p>

              <table class="w-full text-sm">
                <thead>
                  <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th class="text-left pb-2"></th>
                    <th class="text-right pb-2 w-24">Real</th>
                    <th class="text-right pb-2 w-24">Proyectado</th>
                    <th class="text-right pb-2 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="be-linea" :class="{ activa: beFiltro === 'e' }" @click="beAbrirCapa('e')" :title="beTitulo('e')">
                    <td class="py-2">
                      <span class="font-medium" style="color: var(--color-unergy-deep);">Venta en bolsa</span>
                      <span class="be-chip be-chip-alerta"><TriangleAlertIcon class="size-[1em]" /> cargos regulatorios</span>
                    </td>
                    <td class="text-right font-mono" style="color: var(--color-unergy-deep);">{{ fmtNum1(beB.ungg.venta_bolsa.real) }}</td>
                    <td class="text-right font-mono" style="color: #7a6e8a;">{{ fmtNum1(beB.ungg.venta_bolsa.proyectado) }}</td>
                    <td class="text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">{{ fmtNum1(beB.ungg.venta_bolsa.total) }}</td>
                  </tr>

                  <tr>
                    <td colspan="4" class="pt-3 pb-1 text-xs font-semibold uppercase tracking-wider" style="color: #7a6e8a;">Compras en bolsa</td>
                  </tr>
                  <tr class="be-linea" :class="{ activa: beFiltro === 'c' }" @click="beAbrirCapa('c')" :title="beTitulo('c')">
                    <td class="py-2 pl-3">
                      <span style="color: var(--color-unergy-deep);">· Directas — duplicados</span>
                      <span class="be-chip be-chip-alerta"><ShieldIcon class="size-[1em]" /> garantías</span>
                    </td>
                    <td class="text-right font-mono" style="color: var(--color-unergy-deep);">−{{ fmtNum1(beB.ungg.compra_bolsa_directa.real) }}</td>
                    <td class="text-right font-mono" style="color: #7a6e8a;">−{{ fmtNum1(beB.ungg.compra_bolsa_directa.proyectado) }}</td>
                    <td class="text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">−{{ fmtNum1(beB.ungg.compra_bolsa_directa.total) }}</td>
                  </tr>
                  <tr class="be-linea" :class="{ activa: beFiltro === 'uso' }" @click="beAbrirCapa('uso')" :title="beTitulo('uso')">
                    <td class="py-2 pl-3">
                      <span style="color: var(--color-unergy-deep);">· No directas — uso del recurso</span>
                      <span class="be-chip be-chip-neutro">sin garantía</span>
                    </td>
                    <td class="text-right font-mono" style="color: var(--color-unergy-deep);">−{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.real) }}</td>
                    <td class="text-right font-mono" style="color: #7a6e8a;">−{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.proyectado) }}</td>
                    <td class="text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">−{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.total) }}</td>
                  </tr>
                  <tr style="border-top: 1px solid rgba(44,32,57,0.08);">
                    <td class="py-2 pl-3 text-xs font-semibold" style="color: #7a6e8a;">Total compras en bolsa</td>
                    <td class="text-right font-mono text-xs" style="color: #7a6e8a;">−{{ fmtNum1(beB.ungg.compra_bolsa_total.real) }}</td>
                    <td class="text-right font-mono text-xs" style="color: #7a6e8a;">−{{ fmtNum1(beB.ungg.compra_bolsa_total.proyectado) }}</td>
                    <td class="text-right font-mono text-xs font-semibold" style="color: #7a6e8a;">−{{ fmtNum1(beB.ungg.compra_bolsa_total.total) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid rgba(44,32,57,0.12);">
                    <td class="pt-3 font-bold" style="color: var(--color-unergy-deep);" :title="BE_AYUDA.neto">
                      NETO UNGG
                      <span class="be-chip" :style="beNetoEstilo">{{ beNetoEtiqueta }}</span>
                    </td>
                    <td class="pt-3 text-right font-mono font-bold" style="color: var(--color-unergy-deep);">{{ fmtSigno(beB.ungg.neto.real) }}</td>
                    <td class="pt-3 text-right font-mono font-bold" style="color: #7a6e8a;">{{ fmtSigno(beB.ungg.neto.proyectado) }}</td>
                    <td class="pt-3 text-right font-mono font-bold text-base" :style="`color: ${beNetoColor};`">{{ fmtSigno(beB.ungg.neto.total) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- UNGC -->
            <div class="cv-card px-5 py-4">
              <div class="flex items-baseline justify-between mb-1">
                <h3 class="text-sm font-bold uppercase tracking-wider" style="color: var(--color-unergy-deep);">UNGC · comercializador</h3>
                <span class="text-[11px]" style="color: #7a6e8a;">MWh</span>
              </div>
              <p class="text-xs mb-3" style="color: #7a6e8a;">
                Va aparte: es otro agente, así que no se contrarresta con las compras de UNGG.
              </p>

              <table class="w-full text-sm">
                <thead>
                  <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th class="text-left pb-2"></th>
                    <th class="text-right pb-2 w-24">Real</th>
                    <th class="text-right pb-2 w-24">Proyectado</th>
                    <th class="text-right pb-2 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="be-linea" :class="{ activa: beFiltro === 'f' }" @click="beAbrirCapa('f')" :title="beTitulo('f')">
                    <td class="py-2">
                      <span class="font-medium" style="color: var(--color-unergy-deep);">Venta en bolsa</span>
                      <span class="be-chip be-chip-ok">solo cartera</span>
                    </td>
                    <td class="text-right font-mono" style="color: var(--color-unergy-deep);">{{ fmtNum1(beB.ungc.venta_bolsa.real) }}</td>
                    <td class="text-right font-mono" style="color: #7a6e8a;">{{ fmtNum1(beB.ungc.venta_bolsa.proyectado) }}</td>
                    <td class="text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">{{ fmtNum1(beB.ungc.venta_bolsa.total) }}</td>
                  </tr>
                  <tr>
                    <td colspan="4" class="pt-3 text-xs" style="color: #7a6e8a;">
                      Compra en bolsa (UNGC): reglas de negocio aún por definir — la categoría existe reservada, sin filas.
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="mt-4 pt-3 text-xs" style="border-top: 1px solid rgba(44,32,57,0.08); color: #7a6e8a;">
                <p class="mb-1">
                  <strong style="color: var(--color-unergy-deep);">{{ beB.ungg.venta_bolsa.n_plantas }}</strong> plantas venden en bolsa por UNGG ·
                  <strong style="color: var(--color-unergy-deep);">{{ beB.ungc.venta_bolsa.n_plantas }}</strong> por UNGC
                </p>
                <p>
                  Balance de <strong style="color: var(--color-unergy-deep);">{{ MESES[beMonth - 1] }} {{ beYear }}</strong>
                  <template v-if="beData.periodo.es_mes_actual">
                    · real del 1 al {{ beData.periodo.dia_corte }}, proyectado del
                    {{ beData.periodo.dia_corte + 1 }} al {{ beData.periodo.dias_mes }}
                    con el promedio diario de cada planta este mes
                  </template>
                  <template v-else>· mes cerrado, todo real</template>
                </p>
              </div>
            </div>
          </div>

          <!-- ── Advertencias ────────────────────────────────────────────── -->
          <Message v-if="beData.advertencias.compra_externa_en_bolsa.length" severity="warn" :closable="false">
            <p class="font-semibold mb-1">
              {{ beData.advertencias.compra_externa_en_bolsa.length }}
              {{ beData.advertencias.compra_externa_en_bolsa.length === 1 ? 'planta con PPA de compra externa está cayendo' : 'plantas con PPA de compra externa están cayendo' }}
              en el residuo de bolsa.
            </p>
            <p class="text-xs mb-1">
              Su energía ya está comprada por contrato fuera de GESCON, así que contarlas como venta en bolsa
              infla la línea de cargos regulatorios. Marca la casilla de arriba para ver el balance sin ellas.
            </p>
            <p class="text-xs font-mono">
              {{ beData.advertencias.compra_externa_en_bolsa.map(a => `${a.frontera} (${fmtNum1(a.mwh_total)})`).join(' · ') }}
            </p>
          </Message>

          <Message v-if="beData.advertencias.pct_anomalos.length" severity="warn" :closable="false">
            <p class="font-semibold mb-1">Porcentajes de despacho fuera de rango en GESCON</p>
            <p class="text-xs font-mono">
              {{ beData.advertencias.pct_anomalos.map(a => `${a.planta} — ${a.motivo}`).join(' · ') }}
            </p>
          </Message>

          <Message v-if="beData.advertencias.sin_datos.length" severity="secondary" :closable="false">
            <p class="text-xs">
              <strong>{{ beData.advertencias.sin_datos.length }}</strong> plantas sin generación en el mes, excluidas del balance:
              {{ beData.advertencias.sin_datos.map(a => a.planta).join(', ') }}
            </p>
          </Message>

          <Message v-if="beData.advertencias.tramos_estimados.length" severity="secondary" :closable="false">
            <p class="text-xs">
              {{ beData.advertencias.tramos_estimados.length }} tramos sin lecturas de su rango exacto: se estimaron con el
              promedio diario del mes.
            </p>
          </Message>

          <!-- ── Inventario ──────────────────────────────────────────────── -->
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-bold" style="color: var(--color-unergy-deep);">
                Inventario · {{ beFilas.length }} de {{ beData.inventario.length }} filas
              </h3>
              <span v-if="beFiltro" class="text-xs px-2 py-1 rounded cursor-pointer"
                style="background: rgba(145,91,216,0.12); color: var(--color-unergy-purple);" @click="beFiltro = null">
                {{ BE_CATEGORIAS[beFiltro].label }} <XIcon class="text-[10px] ml-1 size-[1em]" />
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <InputText v-model="beBusqueda" placeholder="Buscar frontera o contrato…" class="w-64" />
              <button @click="exportarBalanceExcel"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style="background: var(--color-unergy-purple); color: #fff;">
                <DownloadIcon class="text-xs size-[1em]" /> Exportar
              </button>
            </div>
          </div>

          <div class="cv-card overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: #7a6e8a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(145,91,216,0.04);">
                  <th class="text-left px-4 py-3">Frontera</th>
                  <th class="text-left px-2 py-3">Estado</th>
                  <th class="text-left px-2 py-3">Método</th>
                  <th class="text-right px-2 py-3">%</th>
                  <th class="text-left px-2 py-3">Desde</th>
                  <th class="text-left px-2 py-3">Hasta</th>
                  <th class="text-right px-2 py-3">Real</th>
                  <th class="text-right px-2 py-3">Proy.</th>
                  <th class="text-right px-4 py-3">Total MWh</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in beFilas" :key="`${f.proyecto_id}-${f.desde}-${f.categoria}-${i}`"
                  style="border-top: 1px solid rgba(44,32,57,0.06);">
                  <td class="px-4 py-2.5 font-medium" style="color: var(--color-unergy-deep);">
                    {{ f.frontera }}
                    <span v-if="f.frontera !== f.planta" class="block text-[11px]" style="color: #7a6e8a;">{{ f.planta }}</span>
                  </td>
                  <td class="px-2 py-2.5" style="color: var(--color-unergy-deep);">{{ f.estado }}</td>
                  <td class="px-2 py-2.5">
                    <span class="text-xs px-1.5 py-0.5 rounded font-medium" :style="BE_CATEGORIAS[f.categoria].badge">
                      {{ f.metodo }}
                    </span>
                  </td>
                  <td class="px-2 py-2.5 text-right font-mono text-xs" style="color: #7a6e8a;">
                    {{ f.pct !== null && f.pct !== undefined ? (f.pct * 100).toFixed(0) + '%' : '—' }}
                  </td>
                  <td class="px-2 py-2.5 font-mono text-xs" style="color: #7a6e8a;">{{ f.desde || '—' }}</td>
                  <td class="px-2 py-2.5 font-mono text-xs" style="color: #7a6e8a;">{{ f.hasta || '—' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono" style="color: var(--color-unergy-deep);">{{ f.mwh_real !== null ? fmtNum1(f.mwh_real) : '—' }}</td>
                  <td class="px-2 py-2.5 text-right font-mono" style="color: #7a6e8a;">{{ f.mwh_proyectado !== null ? fmtNum1(f.mwh_proyectado) : '—' }}</td>
                  <td class="px-4 py-2.5 text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">{{ f.mwh_total !== null ? fmtNum1(f.mwh_total) : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="!beFilas.length" class="px-4 py-10 text-sm text-center" style="color: rgba(44,32,57,0.35);">
              Sin filas para este filtro
            </div>
          </div>

        </template>
      </template>
    </div>

    <!-- ═══════════════ REVISIÓN DEL MES TAB ═══════════════ -->
    <!-- Tres cosas que conviene mirar cada mes, sobre la MISMA fuente que la
         pestaña Proyectos (/cumplimiento/plantas-contratos): plantas repetidas,
         plantas sin contrato y plantas con UNGC. No agrega endpoints: si ya se
         abrió Proyectos con ese mes, sale de la caché. -->
    <div v-show="activeTab === 6" class="space-y-5">

      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
          <Select v-model="revYear" :options="years" class="w-24" @change="loadRevision" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Mes</label>
          <Select v-model="revMonth" :options="MESES_OPTIONS" optionLabel="label" optionValue="value"
                  class="w-40" @change="loadRevision" />
        </div>
        <div class="flex flex-col gap-1 flex-1" style="min-width: 200px;">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Buscar</label>
          <InputText v-model="revBusqueda" placeholder="Planta, contrato o SIC…" class="text-sm w-full" />
        </div>
      </div>

      <ProgressSpinner v-if="revLoading" />
      <Message v-else-if="revError" severity="error" :closable="false">{{ revError }}</Message>

      <template v-else-if="revData">

        <!-- Resumen: tres contadores -->
        <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
          <div v-for="s in revResumen" :key="s.key"
               class="rounded-xl px-4 py-3 border" :style="`border-color: ${s.borde}; background: ${s.fondo};`">
            <div class="text-3xl font-bold leading-none" :style="`color: ${s.color};`">{{ s.n }}</div>
            <div class="text-xs font-semibold mt-1.5" style="color: var(--color-unergy-deep);">{{ s.titulo }}</div>
            <div class="text-[11px] mt-0.5" style="color: #7a6e8a;">{{ s.detalle }}</div>
          </div>
        </div>

        <p class="text-xs" style="color: #9b89b5;">
          Al {{ revData.fecha_corte }}. Las filas en <span :style="`color:${ROJO_FIN}; font-weight:600;`">rojo</span>
          son tramos que ya terminaron dentro del mes: la bolsa se calcula por días, así que una misma
          planta puede aparecer en más de una fila.
          <span class="block mt-1">
            <b>Duplicada</b> = compromete más del 100% <b>al mismo tiempo</b> (se suman los % de los
            contratos que se solapan día a día), o está marcada como compra en bolsa / uso del recurso.
            Repartir 50% y 50% entre dos contratos <b>no</b> es duplicar, y sucederse en el tiempo tampoco.
          </span>
        </p>

        <!-- 1 · Plantas duplicadas -->
        <div class="rounded-xl border overflow-hidden" style="border-color: rgba(44,32,57,0.08);">
          <div class="px-4 py-2.5" style="background: rgba(240,192,64,0.14);">
            <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">Plantas duplicadas en el mes</span>
            <span class="text-xs ml-2" style="color: #7a6e8a;">
              Duplicada es la que compromete <b>más del 100% a la vez</b>: ese excedente se cubre
              comprando en bolsa. Estar en varios contratos no basta —repartir 50% y 50% sigue
              siendo su 100%—. También entran las marcadas como <b>compra en bolsa</b>; el uso del
              recurso es otra figura y va en su propia sección.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background: #faf8fd; color: #7a6e8a;">
                <th class="text-left px-4 py-2 font-medium">Planta</th>
                <th class="text-right px-4 py-2 font-medium" style="width: 110px;">% a la vez</th>
                <th class="text-left px-4 py-2 font-medium">Aparece en</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 230px;">Motivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revDuplicadas" :key="p.id" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                <td class="px-4 py-2 font-medium" style="color: var(--color-unergy-deep);">{{ p.nombre }}</td>
                <td class="px-4 py-2 text-right font-mono font-semibold"
                    :style="revPct(p.maxPct) > 100 ? 'color:#9a6700;' : 'color:#7a6e8a;'">
                  {{ p.escalaRota || p.sinPct ? '—' : revPct(p.maxPct) + '%' }}
                </td>
                <td class="px-4 py-2">
                  <div v-for="(a, i) in p.apariciones" :key="i" class="flex flex-wrap items-center gap-1.5 py-0.5">
                    <span :style="a.estado === 'terminado' ? `color:${ROJO_FIN};` : 'color:var(--color-unergy-deep);'">{{ a.contrato }}</span>
                    <span v-if="a.codigo_sic" class="font-mono text-[11px] px-1 rounded"
                          style="background: rgba(44,32,57,0.06); color: #5b3fa6;">{{ a.codigo_sic }}</span>
                    <span v-if="a.pct" class="text-[11px] font-semibold" style="color: #7a6e8a;">{{ revPct(a.pct) }}%</span>
                    <span v-else class="text-[11px]" style="color: #c0a0a0;">sin %</span>
                    <span v-if="a.marca" class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style="background: rgba(240,192,64,0.22); color: #9a6700;">{{ a.marca }}</span>
                    <span class="text-[11px]" style="color: #9b89b5;">{{ fmtFechaDia(a.desde) }} → {{ fmtFechaDia(a.hasta) }}</span>
                  </div>
                </td>
                <td class="px-4 py-2 text-xs" style="color: #7a6e8a;">{{ p.motivo }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!revDuplicadas.length" class="px-4 py-8 text-sm text-center" style="color: rgba(44,32,57,0.35);">
            Ninguna planta duplicada este mes
          </div>
          <!-- Repartidas: la contraprueba de que la regla es por % y no por nº de contratos -->
          <details v-if="revRepartidas.length" class="px-4 py-2.5 text-xs"
                   style="border-top: 1px solid rgba(44,32,57,0.06); background: #faf8fd;">
            <summary class="cursor-pointer select-none" style="color: #7a6e8a;">
              {{ revRepartidas.length }} planta(s) repartidas entre varios contratos sumando 100% o menos
              — no son duplicados
            </summary>
            <table class="w-full mt-2">
              <tbody>
                <tr v-for="p in revRepartidas" :key="p.id" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                  <td class="py-1.5 pr-4 font-medium" style="color: var(--color-unergy-deep); width: 220px;">{{ p.nombre }}</td>
                  <td class="py-1.5 pr-4 font-mono text-right" style="color: #2e7d32; width: 70px;">{{ revPct(p.maxPct) }}%</td>
                  <td class="py-1.5" style="color: #7a6e8a;">
                    <span v-for="(a, i) in p.apariciones" :key="i">
                      <span v-if="i"> + </span>{{ revPct(a.pct) }}%
                      <span v-if="a.modalidad_pago" class="font-semibold uppercase" style="color: var(--color-unergy-purple);">{{ a.modalidad_pago }}</span>
                      {{ a.contrato }}
                      <span v-if="a.repartido" style="color: #b0a0c0;">(registrado {{ revPct(a.pctOriginal) }}%)</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-2" style="color: #9b89b5;">
              Un par <b>PLG + PLC</b> es la misma planta repartida entre dos contratos: cada uno la
              registra al 100% porque así se firmó, y aquí se lee prorrateada. El % almacenado no se
              modifica y la energía en Cumplimiento se sigue atribuyendo igual.
            </p>
          </details>
        </div>

        <!-- 2 · Plantas sin contrato -->
        <div class="rounded-xl border overflow-hidden" style="border-color: rgba(44,32,57,0.08);">
          <div class="px-4 py-2.5" style="background: rgba(44,32,57,0.06);">
            <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">Libres en bolsa — sin contrato</span>
            <span class="text-xs ml-2" style="color: #7a6e8a;">
              Sin PPA <b>y sin registro GESCON vigente</b> sobre el tramo: venden en bolsa desde UNGG.
            </span>
          </div>
          <div v-if="revAsicError" class="px-4 py-2 text-xs"
               style="background: rgba(214,68,85,0.07); color: #D64455;">
            No se pudo consultar GESCON para contrastar: puede haber plantas listadas aquí que sí
            tengan un contrato con código SIC vigente.
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background: #faf8fd; color: #7a6e8a;">
                <th class="text-left px-4 py-2 font-medium">Planta</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 300px;">Tramo sin contrato</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 120px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revSinContrato" :key="filaKey(p)" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                <td class="px-4 py-2 font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</td>
                <td class="px-4 py-2 text-xs" style="color: #7a6e8a;">
                  {{ fmtFechaDia(p.segmento_inicio) }} → {{ fmtFechaDia(p.segmento_fin) }}
                </td>
                <td class="px-4 py-2">
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" :style="revEstadoBadge(p.estado)">
                    {{ revEstadoLabel(p.estado) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!revSinContrato.length" class="px-4 py-8 text-sm text-center" style="color: rgba(44,32,57,0.35);">
            Todas las plantas tienen contrato este mes
          </div>
        </div>

        <!-- 2b · Tienen SIC vigente pero el mes no las cuenta en ningún contrato -->
        <div v-if="revSicSinPpa.length" class="rounded-xl border overflow-hidden" style="border-color: rgba(214,68,85,0.28);">
          <div class="px-4 py-2.5" style="background: rgba(214,68,85,0.07);">
            <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">Con contrato GESCON, pero fuera del cálculo del mes</span>
            <span class="text-xs ml-2" style="color: #7a6e8a;">
              Tienen un registro con código SIC vigente en el tramo, pero Cumplimiento no las asignó
              a ningún contrato y las contó como bolsa. Suele ser que el registro no cruza con un PPA
              (contrato interno vacío o distinto) o que el contrato es de un responsable oculto —
              prueba con <b>Ver ocultos</b>. No son plantas libres.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background: #faf8fd; color: #7a6e8a;">
                <th class="text-left px-4 py-2 font-medium">Planta</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 90px;">SIC</th>
                <th class="text-left px-4 py-2 font-medium">Contrato en GESCON</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 120px;">Vigente hasta</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 230px;">Tramo contado como bolsa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revSicSinPpa" :key="filaKey(p)" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                <td class="px-4 py-2 font-medium" style="color: var(--color-unergy-deep);">{{ p.nombre }}</td>
                <td class="px-4 py-2 font-mono text-xs" style="color: #5b3fa6;">{{ p._sic.codigo_sic_contrato || '—' }}</td>
                <td class="px-4 py-2 text-xs" style="color: #7a6e8a;">
                  {{ p._sic.contrato_interno || p._sic.nombre_interno || 'sin contrato interno' }}
                </td>
                <td class="px-4 py-2 text-xs" style="color: #7a6e8a;">
                  {{ fmtFechaDia(p._sic.fecha_fin_efectiva || p._sic.fecha_fin) }}
                </td>
                <td class="px-4 py-2 text-xs" style="color: #9b89b5;">
                  {{ fmtFechaDia(p.segmento_inicio) }} → {{ fmtFechaDia(p.segmento_fin) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 3 · Uso del recurso -->
        <div class="rounded-xl border overflow-hidden" style="border-color: rgba(2,132,199,0.28);">
          <div class="px-4 py-2.5" style="background: rgba(2,132,199,0.10);">
            <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">Uso del recurso</span>
            <span class="text-xs ml-2" style="color: #7a6e8a;">
              El cliente está en bolsa y su planta entra al contrato pagándole la generación a
              precio de bolsa. <b>No genera garantías y no es una duplicación</b>: es una figura
              distinta a la compra en bolsa.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background: #faf8fd; color: #7a6e8a;">
                <th class="text-left px-4 py-2 font-medium">Planta</th>
                <th class="text-left px-4 py-2 font-medium">Contrato</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 90px;">SIC</th>
                <th class="text-right px-4 py-2 font-medium" style="width: 90px;">Despacho</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 230px;">Ventana</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in revUsoRecurso" :key="a._key" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                <td class="px-4 py-2 font-medium" style="color: var(--color-unergy-deep);">{{ a.planta }}</td>
                <td class="px-4 py-2 text-xs" :style="a.estado === 'terminado' ? `color:${ROJO_FIN};` : 'color:var(--color-unergy-deep);'">{{ a.contrato }}</td>
                <td class="px-4 py-2 font-mono text-xs" style="color: #5b3fa6;">{{ a.codigo_sic || '—' }}</td>
                <td class="px-4 py-2 text-right font-mono text-xs" style="color: #7a6e8a;">
                  {{ a.pct ? revPct(a.pct) + '%' : '—' }}
                </td>
                <td class="px-4 py-2 text-xs" style="color: #9b89b5;">
                  {{ fmtFechaDia(a.desde) }} → {{ fmtFechaDia(a.hasta) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!revUsoRecurso.length" class="px-4 py-8 text-sm text-center" style="color: rgba(44,32,57,0.35);">
            Ninguna planta bajo uso del recurso este mes
          </div>
        </div>

        <!-- 4 · Plantas con UNGC -->
        <div class="rounded-xl border overflow-hidden" style="border-color: rgba(44,32,57,0.08);">
          <div class="px-4 py-2.5" style="background: rgba(145,91,216,0.10);">
            <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">Plantas en contratos con UNGC</span>
            <span class="text-xs ml-2" style="color: #7a6e8a;">
              Contratos GESCON donde UNGC compra (piscina b) y plantas sin PPA cuyo SIC vigente
              tiene a UNGC de comprador (piscina f).
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background: #faf8fd; color: #7a6e8a;">
                <th class="text-left px-4 py-2 font-medium">Planta</th>
                <th class="text-left px-4 py-2 font-medium">Contrato</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 90px;">SIC</th>
                <th class="text-left px-4 py-2 font-medium" style="width: 250px;">Ventana</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revUngc" :key="p._key" class="border-t" style="border-color: rgba(44,32,57,0.06);">
                <td class="px-4 py-2 font-medium" :style="filaColorNombre(p)">{{ p.nombre }}</td>
                <td class="px-4 py-2 text-xs">
                  <span v-if="p.contrato" style="color: var(--color-unergy-deep);">{{ p.contrato }}</span>
                  <span v-else class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style="background: rgba(44,32,57,0.08); color: #7a6e8a;">Sin PPA · bolsa UNGC</span>
                </td>
                <td class="px-4 py-2 font-mono text-xs" style="color: #5b3fa6;">{{ p.codigo_sic || '—' }}</td>
                <td class="px-4 py-2 text-xs" style="color: #7a6e8a;">
                  {{ fmtFechaDia(p.desde) }} → {{ fmtFechaDia(p.hasta) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!revUngc.length" class="px-4 py-8 text-sm text-center" style="color: rgba(44,32,57,0.35);">
            Ninguna planta con UNGC este mes
          </div>
        </div>

      </template>
    </div>

    <!-- Floating: desglose de una capa del balance — de qué plantas sale la cifra -->
    <Teleport to="body">
      <template v-if="beCapa">
        <div class="fixed inset-0" style="z-index: 60; background: rgba(44,32,57,0.28);" @click="beCerrarCapa" />
        <div
          class="fixed shadow-2xl"
          style="z-index: 61; background: #ffffff; width: 1020px; max-width: 96vw; max-height: 90vh; overflow-y: auto; border-radius: 16px; border: 1px solid rgba(44,32,57,0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"
          @click.stop
        >
          <div style="height: 6px; background: var(--color-unergy-purple); border-radius: 16px 16px 0 0;" />

          <div class="px-6 pt-4 pb-3" style="border-bottom: 1px solid rgba(44,32,57,0.08);">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-bold text-lg" style="color: var(--color-unergy-deep);">{{ BE_CATEGORIAS[beCapa].label }}</div>
                <div class="text-sm mt-1" style="color: #7a6e8a;">{{ BE_AYUDA[beCapa] }}</div>
                <span class="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);">
                  <CalendarIcon class="text-[10px] size-[1em]" /> {{ MESES[beMonth - 1] }} {{ beYear }} · {{ bePeriodoLabel }}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button @click="beVerEnTabla"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);">
                  <FilterIcon class="text-xs size-[1em]" /> Ver en la tabla
                </button>
                <button class="rounded-lg p-1.5 transition-colors hover:bg-gray-100" style="color: #7a6e8a;" @click="beCerrarCapa"><XIcon class="text-sm size-[1em]" /></button>
              </div>
            </div>
          </div>

          <!-- Cómo se calcula -->
          <div class="px-6 py-3 text-xs" style="background: rgba(145,91,216,0.04); color: #7a6e8a;">
            <span class="font-semibold" style="color: var(--color-unergy-deep);">Cómo sale cada fila:</span>
            generación del tramo × porcentaje = aporte.
            La generación del tramo es la producción real de la planta en esos días exactos (suma de lecturas,
            no una regla de tres sobre el mes).
            <template v-if="beData?.periodo?.es_mes_actual">
              Los días del {{ beData.periodo.dia_corte + 1 }} al {{ beData.periodo.dias_mes }} se proyectan
              con el promedio diario de cada planta este mes.
            </template>
          </div>

          <!-- Desglose -->
          <div class="px-6 py-4">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  <th class="text-left pb-2">Frontera</th>
                  <th class="text-left pb-2">Tramo</th>
                  <th class="text-right pb-2">Días</th>
                  <th class="text-right pb-2">Gen. tramo</th>
                  <th class="text-right pb-2">%</th>
                  <th class="text-right pb-2">Real</th>
                  <th class="text-right pb-2">Proy.</th>
                  <th class="text-right pb-2">Aporte</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in beCapaFilas" :key="`${f.proyecto_id}-${f.desde}-${i}`"
                  style="border-top: 1px solid rgba(44,32,57,0.06);">
                  <td class="py-2 pr-2">
                    <span class="font-medium" style="color: var(--color-unergy-deep);">{{ f.frontera }}</span>
                    <span v-if="f.frontera !== f.planta" class="block text-[11px]" style="color: #7a6e8a;">{{ f.planta }}</span>
                    <span v-if="f.contrato" class="block text-[11px]" style="color: var(--color-unergy-purple);">{{ f.contrato }}</span>
                  </td>
                  <td class="py-2 pr-2 font-mono text-xs" style="color: #7a6e8a;">
                    {{ f.desde }} → {{ f.hasta }}
                    <span v-if="f.estimado" class="be-chip be-chip-neutro" title="No hubo lecturas del rango exacto: se estimó con el promedio diario del mes">estimado</span>
                  </td>
                  <td class="py-2 text-right font-mono text-xs" style="color: #7a6e8a;">{{ f.dias }}</td>
                  <td class="py-2 text-right font-mono" style="color: #7a6e8a;">
                    {{ f.gen_tramo_real !== null ? fmtNum1((f.gen_tramo_real || 0) + (f.gen_tramo_proyectado || 0)) : '—' }}
                  </td>
                  <td class="py-2 text-right font-mono text-xs" style="color: #7a6e8a;">
                    {{ f.pct !== null && f.pct !== undefined ? (f.pct * 100).toFixed(0) + '%' : '—' }}
                  </td>
                  <td class="py-2 text-right font-mono" style="color: var(--color-unergy-deep);">{{ f.mwh_real !== null ? fmtNum1(f.mwh_real) : '—' }}</td>
                  <td class="py-2 text-right font-mono" style="color: #7a6e8a;">{{ f.mwh_proyectado !== null ? fmtNum1(f.mwh_proyectado) : '—' }}</td>
                  <td class="py-2 text-right font-mono font-semibold" style="color: var(--color-unergy-deep);">{{ f.mwh_total !== null ? fmtNum1(f.mwh_total) : '—' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid rgba(44,32,57,0.12);">
                  <td class="pt-3 font-bold" style="color: var(--color-unergy-deep);">
                    TOTAL · {{ beCapaPlantas }} {{ beCapaPlantas === 1 ? 'planta' : 'plantas' }}
                    <span v-if="beCapaFilas.length !== beCapaPlantas" class="text-xs font-normal" style="color: #7a6e8a;">
                      ({{ beCapaFilas.length }} tramos)
                    </span>
                  </td>
                  <td colspan="4"></td>
                  <td class="pt-3 text-right font-mono font-bold" style="color: var(--color-unergy-deep);">{{ fmtNum1(beCapaTotales.real) }}</td>
                  <td class="pt-3 text-right font-mono font-bold" style="color: #7a6e8a;">{{ fmtNum1(beCapaTotales.proyectado) }}</td>
                  <td class="pt-3 text-right font-mono font-bold text-base" style="color: var(--color-unergy-deep);">{{ fmtNum1(beCapaTotales.total) }}</td>
                </tr>
              </tfoot>
            </table>

            <div v-if="!beCapaFilas.length" class="py-10 text-sm text-center" style="color: rgba(44,32,57,0.35);">
              Ninguna planta aporta a esta capa en {{ MESES[beMonth - 1] }}
            </div>

            <!-- Lo que NO entró -->
            <div v-if="beData?.advertencias?.sin_datos?.length"
              class="mt-4 pt-3 text-xs" style="border-top: 1px solid rgba(44,32,57,0.08); color: #7a6e8a;">
              <span class="font-semibold" style="color: var(--color-unergy-deep);">Fuera del cálculo:</span>
              {{ beData.advertencias.sin_datos.length }} plantas sin generación en el mes —
              {{ beData.advertencias.sin_datos.map(a => `${a.planta} (${a.motivo})`).join(' · ') }}
            </div>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating: detalle de la capa (misma información que la imagen) -->
    <Teleport to="body">
      <template v-if="detalleCapa">
        <div class="fixed inset-0" style="z-index: 60; background: rgba(44,32,57,0.28);" @click="cerrarDetalleCapa" />
        <div
          class="fixed shadow-2xl"
          style="z-index: 61; background: #ffffff; width: 700px; max-width: 94vw; max-height: 88vh; overflow-y: auto; border-radius: 16px; border: 1px solid rgba(44,32,57,0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"
          @click.stop
        >
          <div style="height: 6px; background: var(--color-unergy-purple); border-radius: 16px 16px 0 0;" />
          <!-- Header -->
          <div class="px-6 pt-4 pb-3" style="border-bottom: 1px solid rgba(44,32,57,0.08);">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-bold text-lg truncate" style="color: var(--color-unergy-deep);">{{ detalleCapa.c.nombre }}</div>
                <div class="text-sm truncate" style="color: #7a6e8a;">{{ detalleCapa.c.comprador_nombre }}</div>
                <span class="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);">
                  <CalendarIcon class="text-[10px] size-[1em]" /> Período de consulta: {{ periodoSimLabel }}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span v-if="detalleCapa.res.pct != null && detalleCapa.res.pct !== undefined" class="text-xs font-semibold px-2 py-0.5 rounded-full" :style="estadoBadge(detalleCapa.res.estado)">{{ Math.round(detalleCapa.res.pct) }}%</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full" :style="estadoBadge(detalleCapa.res.estado)">{{ estadoLabel(detalleCapa.res.estado) }}</span>
                <button
                  @click="copiarImagenCapa(detalleCapa.c)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  :style="copiadoCapaId === detalleCapa.c.id ? 'background: rgba(46,125,50,0.12); color: #2e7d32;' : 'background: var(--color-unergy-purple); color: white;'"
                  v-tooltip="'Copia la imagen al portapapeles (o la descarga si el navegador no lo permite)'"
                >
                  <CheckIcon v-if="copiadoCapaId === detalleCapa.c.id" class="text-xs size-[1em]" />
                  <ImageIcon v-else class="text-xs size-[1em]" />
                  {{ copiadoCapaId === detalleCapa.c.id ? '¡Copiado!' : 'Copiar imagen' }}
                </button>
                <button class="rounded-lg p-1.5 transition-colors hover:bg-gray-100" style="color: #7a6e8a;" @click="cerrarDetalleCapa"><XIcon class="text-sm size-[1em]" /></button>
              </div>
            </div>
            <!-- Métricas (energía duplicada como 4ª columna si aplica) -->
            <div class="grid gap-3 mt-3" :class="detalleCapa.res.genDup > 0 ? 'grid-cols-4' : 'grid-cols-3'">
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-wide" style="color: #7a6e8a;">Energía entregada</div>
                <div class="font-mono text-sm font-bold mt-0.5" style="color: var(--color-unergy-deep);">{{ fmtMwh(detalleCapa.res.gen) }}</div>
              </div>
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-wide" style="color: #7a6e8a;">Energía mínima</div>
                <div class="font-mono text-sm font-bold mt-0.5" style="color: var(--color-unergy-deep);">{{ detalleCapa.res.min != null ? fmtMwh(detalleCapa.res.min) : '—' }}</div>
              </div>
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-wide" style="color: #7a6e8a;">Energía proyectada</div>
                <div class="font-mono text-sm font-bold mt-0.5" style="color: var(--color-unergy-deep);">{{ detalleCapa.res.genProy != null && detalleCapa.res.genProy > 0 ? fmtMwh(detalleCapa.res.genProy) : '—' }}</div>
              </div>
              <div v-if="detalleCapa.res.genDup > 0" v-tooltip.bottom="'De la energía entregada, esta parte se suministra con compra en bolsa (cuenta para el contrato, origen bolsa)'">
                <div class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style="color: #9a6700;"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Compra en bolsa</div>
                <div class="font-mono text-sm font-bold mt-0.5" style="color: #9a6700;">{{ fmtMwh(detalleCapa.res.genDup) }}</div>
              </div>
            </div>
          </div>
          <!-- Tabla -->
          <div class="px-6 py-4">
            <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">{{ detalleCapa.plantas.length }} proyecto{{ detalleCapa.plantas.length === 1 ? '' : 's' }} en el contrato</p>
            <table class="w-full text-sm">
              <thead>
                <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                  <th class="text-left pb-2">Proyecto</th>
                  <th class="text-right pb-2">% Despacho</th>
                  <th class="text-right pb-2">Energía generada</th>
                  <th class="text-right pb-2">Proyección cierre del mes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in detalleCapa.plantas" :key="p.id" style="border-top: 1px solid rgba(44,32,57,0.06);">
                  <td class="py-2 pr-2 font-medium" :style="p.es_duplicado ? 'color:#9a6700' : p.comprado_por_unergy ? 'color:#9a6700' : 'color:var(--color-unergy-deep)'">
                    {{ p.nombre }}
                    <span v-if="p.es_duplicado && !p.comprado_por_unergy" class="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.22); color: #9a6700;" v-tooltip="'Compra en bolsa'"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Compra bolsa</span>
                    <span v-else-if="p.comprado_por_unergy" class="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.25); color: #9a6700;">Compra</span>
                  </td>
                  <td class="py-2 px-2 text-right font-mono text-xs" style="color: #7a6e8a;">{{ (p.pct_despacho * 100).toFixed(0) }}%</td>
                  <td class="py-2 px-2 text-right font-mono font-semibold" :style="p.es_duplicado ? 'color:#9a6700' : 'color:var(--color-unergy-deep)'">{{ p.month_mwh != null ? fmtMwh(p.month_mwh * p.pct_despacho) : '—' }}</td>
                  <td class="py-2 pl-2 text-right font-mono font-semibold" style="color: var(--color-unergy-purple);">
                    <template v-if="plantaProyMwh(p) != null">◆ {{ fmtMwh(plantaProyMwh(p)) }}</template>
                    <span v-else style="color: rgba(44,32,57,0.3);">—</span>
                  </td>
                </tr>
                <tr v-if="!detalleCapa.plantas.length">
                  <td colspan="4" class="py-6 text-center text-sm" style="color: rgba(44,32,57,0.35);">Sin proyectos asignados</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid rgba(44,32,57,0.12);">
                  <td class="pt-3 text-sm font-bold" style="color: var(--color-unergy-deep);">Total · {{ detalleCapa.plantas.length }} proyecto{{ detalleCapa.plantas.length === 1 ? '' : 's' }}</td>
                  <td></td>
                  <td class="pt-3 text-right font-mono font-bold text-base" style="color: var(--color-unergy-purple);">{{ fmtMwh(detalleCapa.res.gen) }}</td>
                  <td class="pt-3 text-right font-mono font-bold text-base" style="color: var(--color-unergy-purple);">{{ detalleCapa.res.genProy != null && detalleCapa.res.genProy > 0 ? fmtMwh(detalleCapa.res.genProy) : '—' }}</td>
                </tr>
                <tr v-if="detalleCapa.res.genDup > 0">
                  <td colspan="2"></td>
                  <td class="pt-1 text-right font-mono text-xs font-semibold" style="color: #9a6700;">de ello, {{ fmtMwh(detalleCapa.res.genDup) }} compra en bolsa</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <!-- Veredicto -->
            <div class="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3" :style="{ background: veredictoCapa(detalleCapa.res).bg }">
              <component :is="veredictoCapa(detalleCapa.res).icon" class="mt-0.5 size-[1em]"
                    :style="{ color: veredictoCapa(detalleCapa.res).fg }" />
              <div>
                <div class="font-bold text-sm" :style="{ color: veredictoCapa(detalleCapa.res).fg }">{{ veredictoCapa(detalleCapa.res).txt }}</div>
                <div v-if="veredictoCapa(detalleCapa.res).sub" class="text-xs mt-0.5" style="color: #7a6e8a;">{{ veredictoCapa(detalleCapa.res).sub }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating month breakdown -->
    <Teleport to="body">
      <template v-if="selectedMonthIdx !== null && anualData && anualData.meses[selectedMonthIdx]">
        <div class="fixed inset-0" style="z-index: 40; background: rgba(44,32,57,0.25);" @click="selectedMonthIdx = null" />
        <div
          class="fixed rounded-2xl shadow-2xl"
          style="z-index: 50; background: var(--color-unergy-avena); width: 600px; max-height: 80vh; overflow-y: auto; border: 1px solid rgba(44,32,57,0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"
          @click.stop
        >
          <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid rgba(44,32,57,0.10);">
            <div>
              <span class="font-bold text-base" style="color: var(--color-unergy-deep);">{{ MESES[selectedMonthIdx] }} {{ selectedYear }}</span>
              <span v-if="anualData.meses[selectedMonthIdx].tipo_datos !== 'real'" class="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style="background: rgba(145,91,216,0.12); color: var(--color-unergy-purple);">proyección</span>
            </div>
            <button class="rounded-lg p-1.5" style="color: #7a6e8a;" @click="selectedMonthIdx = null">
              <XIcon class="text-sm size-[1em]" />
            </button>
          </div>
          <div class="px-5 py-4">
            <p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--color-unergy-purple);">Desglose por planta</p>
            <table class="w-full text-sm">
              <thead>
                <tr style="color: #7a6e8a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  <th class="text-left pb-2">Planta</th>
                  <th class="text-right pb-2">%</th>
                  <th class="text-right pb-2">Gen. planta</th>
                  <th class="text-right pb-2">Gen. contrato</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, pi) in anualData.meses[selectedMonthIdx].plantas" :key="pi"
                  style="border-top: 1px solid rgba(44,32,57,0.06);"
                  :style="p.es_duplicado ? 'background: rgba(240,192,64,0.08);' : ''"
                >
                  <td class="py-2 pr-2 font-medium" style="color: var(--color-unergy-deep);">
                    {{ p.nombre }}
                    <span v-if="p.es_duplicado" class="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.22); color: #9a6700;" v-tooltip="'Compra en bolsa'"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Compra bolsa</span>
                    <span v-if="p.contrato" class="ml-1 text-xs font-normal px-1.5 py-0.5 rounded" style="color: var(--color-unergy-purple); background: rgba(145,91,216,0.08);">{{ p.contrato }}</span>
                    <span v-if="p.dias_en_contrato && p.dias_mes && p.dias_en_contrato < p.dias_mes" class="ml-1 text-xs font-normal" style="color: #7a6e8a;">{{ p.dias_en_contrato }}/{{ p.dias_mes }} días</span>
                  </td>
                  <td class="py-2 px-2 text-right font-mono text-xs" style="color: #7a6e8a;">{{ (p.pct_despacho * 100).toFixed(0) }}%</td>
                  <td class="py-2 px-2 text-right font-mono" style="color: var(--color-unergy-deep);">{{ p.gen_planta_mwh !== null ? fmtMwh(p.gen_planta_mwh) : '—' }}</td>
                  <td class="py-2 pl-2 text-right font-mono font-semibold" :style="p.es_duplicado ? 'color: #9a6700;' : 'color: var(--color-unergy-purple);'">{{ p.gen_contrato_mwh !== null ? fmtMwh(p.gen_contrato_mwh) : '—' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid rgba(44,32,57,0.12);">
                  <td colspan="3" class="pt-3 text-sm font-semibold" style="color: var(--color-unergy-deep);">Total al contrato</td>
                  <td class="pt-3 text-right font-mono font-bold" style="color: var(--color-unergy-deep);">{{ fmtMwh(genVal(anualData.meses[selectedMonthIdx])) }}</td>
                </tr>
                <tr v-if="anualData.meses[selectedMonthIdx].exposicion_bolsa_duplicados_mwh">
                  <td colspan="3" class="pt-1 text-sm font-semibold" style="color: #9a6700;">de ello, compra en bolsa</td>
                  <td class="pt-1 text-right font-mono font-bold" style="color: #9a6700;">{{ fmtMwh(anualData.meses[selectedMonthIdx].exposicion_bolsa_duplicados_mwh) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating: detalle completo de contrato (tab Proyectos) — PPA formal + GESCON + plantas -->
    <Teleport to="body">
      <template v-if="detalleContrato">
        <div class="fixed inset-0" style="z-index: 60; background: rgba(44,32,57,0.28);" @click="cerrarDetalleContrato" />
        <div
          class="fixed shadow-2xl"
          style="z-index: 61; background: #ffffff; width: 860px; max-width: 96vw; max-height: 90vh; overflow-y: auto; border-radius: 16px; border: 1px solid rgba(44,32,57,0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"
          @click.stop
        >
          <div style="height: 6px; background: var(--color-unergy-purple); border-radius: 16px 16px 0 0;" />
          <!-- Header -->
          <div class="px-6 pt-4 pb-3" style="border-bottom: 1px solid rgba(44,32,57,0.08);">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-lg" style="color: var(--color-unergy-deep);">{{ detalleContrato.c.nombre }}</span>
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" :style="`background: ${dcTipo.bg}; color: ${dcTipo.color};`">{{ dcTipo.label }}</span>
                </div>
                <div v-if="dcContraparte" class="text-sm mt-0.5" style="color: #7a6e8a;">{{ dcContraparte }}</div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <a v-if="dcPpa?.carpeta_link" :href="dcPpa.carpeta_link" target="_blank" rel="noopener"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style="background: rgba(145,91,216,0.10); color: var(--color-unergy-purple);"
                  v-tooltip.left="'Abrir la carpeta del contrato'"><FolderOpenIcon class="text-xs size-[1em]" />Carpeta</a>
                <button class="rounded-lg p-1.5 transition-colors hover:bg-gray-100" style="color: #7a6e8a;" @click="cerrarDetalleContrato"><XIcon class="text-sm size-[1em]" /></button>
              </div>
            </div>
          </div>

          <div v-if="dcLoading" class="flex flex-col items-center justify-center py-16 gap-3">
            <ProgressSpinner style="width:40px;height:40px;" strokeWidth="4" animationDuration=".8s" />
            <p class="text-sm" style="color: #7a6e8a;">Cargando contrato…</p>
          </div>

          <div v-else class="px-6 py-4 space-y-6">
            <Message v-if="dcError" severity="warn" :closable="false">{{ dcError }}</Message>

            <!-- 1. Contrato formal (módulo PPA) -->
            <div>
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">Contrato formal (PPA)</p>
              <Message v-if="!dcPpa && !dcError" severity="info" :closable="false">
                Este contrato no está registrado en el módulo PPA — solo existe como registro GESCON (abajo).
              </Message>
              <div v-else-if="dcPpa" class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <div v-for="f in dcCamposFormales" :key="f.label">
                  <div class="text-[10px] font-semibold uppercase tracking-wide" style="color: #7a6e8a;">{{ f.label }}</div>
                  <div class="text-sm mt-0.5 break-words" style="color: var(--color-unergy-deep);" :class="f.mono ? 'font-mono' : ''">{{ f.value }}</div>
                </div>
              </div>
            </div>

            <!-- 2. Cantidades comprometidas por mes -->
            <div v-if="dcCompromisos.length">
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">Cantidades comprometidas por mes</p>
              <div class="overflow-auto rounded-lg border" style="max-height: 230px; border-color: rgba(44,32,57,0.10);">
                <table class="w-full text-sm">
                  <thead class="sticky top-0" style="background: rgba(145,91,216,0.06);">
                    <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                      <th class="text-left px-3 py-2">Período</th>
                      <th class="text-right px-3 py-2">Mín (kWh/mes)</th>
                      <th class="text-right px-3 py-2">Máx (kWh/mes)</th>
                      <th class="text-right px-3 py-2">Plantas esperadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in dcCompromisos" :key="r.id" style="border-top: 1px solid rgba(44,32,57,0.05);"
                      :style="r['año'] === pcYear && r.mes === pcMonth ? 'background: rgba(145,91,216,0.08);' : ''">
                      <td class="px-3 py-1.5 font-mono text-xs" style="color: var(--color-unergy-deep);">{{ MESES[r.mes - 1] }} {{ r['año'] }}</td>
                      <td class="px-3 py-1.5 text-right font-mono" style="color: var(--color-unergy-deep);">{{ fmtQ(r.energia_minima) }}</td>
                      <td class="px-3 py-1.5 text-right font-mono" style="color: var(--color-unergy-deep);">{{ fmtQ(r.energia_maxima) }}</td>
                      <td class="px-3 py-1.5 text-right font-mono" style="color: #7a6e8a;">{{ r.cantidad_proyectos ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3. Tarifas por mes -->
            <div v-if="dcTarifas.length">
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">Tarifas por mes ($/kWh)</p>
              <div class="overflow-auto rounded-lg border" style="max-height: 200px; border-color: rgba(44,32,57,0.10);">
                <table class="w-full text-sm">
                  <thead class="sticky top-0" style="background: rgba(145,91,216,0.06);">
                    <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                      <th class="text-left px-3 py-2">Período</th>
                      <th class="text-right px-3 py-2">Tarifa</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in dcTarifas" :key="r.id" style="border-top: 1px solid rgba(44,32,57,0.05);"
                      :style="r['año'] === pcYear && r.mes === pcMonth ? 'background: rgba(145,91,216,0.08);' : ''">
                      <td class="px-3 py-1.5 font-mono text-xs" style="color: var(--color-unergy-deep);">{{ MESES[r.mes - 1] }} {{ r['año'] }}</td>
                      <td class="px-3 py-1.5 text-right font-mono" style="color: var(--color-unergy-deep);">{{ fmtQ(r.tarifa) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 4. GESCON -->
            <div>
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">GESCON — registros ante el ASIC</p>
              <div v-if="dcGesconResumen.length" class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mb-3 px-3 py-2.5 rounded-lg" style="background: rgba(240,192,64,0.08);">
                <div v-for="f in dcGesconResumen" :key="f.label">
                  <div class="text-[10px] font-semibold uppercase tracking-wide" style="color: #9a6700;">{{ f.label }}</div>
                  <div class="text-sm mt-0.5" style="color: var(--color-unergy-deep);" :class="f.mono ? 'font-mono' : ''">{{ f.value }}</div>
                </div>
              </div>
              <div v-if="dcGescon.length" class="overflow-auto rounded-lg border" style="max-height: 280px; border-color: rgba(44,32,57,0.10);">
                <table class="w-full text-sm">
                  <thead class="sticky top-0" style="background: rgba(145,91,216,0.06);">
                    <tr style="color: #7a6e8a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                      <th class="text-left px-3 py-2">Planta</th>
                      <th class="text-left px-2 py-2">SIC</th>
                      <th class="text-left px-2 py-2">Tipo</th>
                      <th class="text-right px-2 py-2">% Desp.</th>
                      <th class="text-left px-2 py-2">Inicio</th>
                      <th class="text-left px-2 py-2">Fin (efectivo)</th>
                      <th class="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in dcGescon" :key="r.id" style="border-top: 1px solid rgba(44,32,57,0.05);"
                      :style="!r.es_version_vigente ? 'opacity: 0.55;' : ''">
                      <td class="px-3 py-1.5 font-medium" style="color: var(--color-unergy-deep);">
                        {{ r.planta_nombre || (r.proyecto_id ? `Proyecto ${r.proyecto_id}` : '—') }}
                        <span v-if="r.es_duplicado" class="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.22); color: #9a6700;"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Duplicado</span>
                        <span v-if="r.uso_del_recurso" class="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(20,184,166,0.14); color: #0f766e;">Uso del recurso</span>
                      </td>
                      <td class="px-2 py-1.5 font-mono text-xs" style="color: #7a6e8a;">{{ r.codigo_sic_contrato || '—' }}</td>
                      <td class="px-2 py-1.5 text-xs" style="color: #7a6e8a;">{{ r.tipo_solicitud }}</td>
                      <td class="px-2 py-1.5 text-right font-mono text-xs" style="color: var(--color-unergy-purple);">{{ r.porcentaje_despacho != null ? (r.porcentaje_despacho * 100).toFixed(0) + '%' : '—' }}</td>
                      <td class="px-2 py-1.5 font-mono text-xs" style="color: #7a6e8a;">{{ r.fecha_inicio || '—' }}</td>
                      <td class="px-2 py-1.5 font-mono text-xs" style="color: #7a6e8a;">{{ r.fecha_fin_efectiva || r.fecha_fin || 'abierta' }}</td>
                      <td class="px-3 py-1.5">
                        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded" :style="dcEstadoStyle(r.estado_solicitud)">{{ r.estado_solicitud }}</span>
                        <span v-if="r.es_version_vigente" class="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(46,125,50,0.12); color: #2e7d32;">vigente</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="px-4 py-4 text-xs text-center rounded-lg border" style="color: rgba(44,32,57,0.35); border-color: rgba(44,32,57,0.08);">
                <template v-if="detalleContrato.c._proyecto_id">Sin registros GESCON para esta planta — vende en bolsa como generador</template>
                <template v-else>Sin registros GESCON para este contrato{{ detalleContrato.modo === 'ppa_compra_externa' ? ' — es una compra directa fuera del MEM' : '' }}</template>
              </div>
            </div>

            <!-- 5. Plantas del mes consultado (lo que ve la piscina) -->
            <div v-if="detalleContrato.c.plantas?.length">
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">
                {{ detalleContrato.c._proyecto_id ? 'Planta consultada' : 'Plantas en el contrato' }} · {{ MESES[pcMonth - 1] }} {{ pcYear }} ({{ detalleContrato.c.plantas.length }})
              </p>
              <div class="rounded-lg border divide-y" style="border-color: rgba(44,32,57,0.10);">
                <div v-for="p in detalleContrato.c.plantas" :key="p.id" class="px-3 py-2 flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <span class="font-medium" style="color: var(--color-unergy-deep);">{{ p.nombre }}</span>
                    <span v-if="p.codigo_sic" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(44,32,57,0.06); color: #7a6e8a;">{{ p.codigo_sic }}</span>
                    <span v-if="p.pct_despacho != null" class="text-xs font-mono" style="color: var(--color-unergy-purple);">{{ (p.pct_despacho * 100).toFixed(0) }}%</span>
                    <span v-if="p.es_duplicado" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.22); color: #9a6700;"><ShoppingCartIcon class="size-[1em]" style="font-size: 9px;" />Compra bolsa</span>
                  </div>
                  <div class="text-xs font-mono" style="color: #7a6e8a;">
                    <span v-if="p.fecha_inicio">{{ p.fecha_inicio }}</span>
                    <span v-if="p.fecha_inicio && p.fecha_fin"> → </span>
                    <span v-if="p.fecha_fin">{{ p.fecha_fin }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating: empresas responsables de PPA (catálogo + asignación) -->
    <Teleport to="body">
      <template v-if="respAbierto">
        <div class="fixed inset-0" style="z-index: 60; background: rgba(44,32,57,0.28);" @click="cerrarResponsables" />
        <div
          class="fixed shadow-2xl"
          style="z-index: 61; background: #ffffff; width: 760px; max-width: 94vw; max-height: 88vh; overflow-y: auto; border-radius: 16px; border: 1px solid rgba(44,32,57,0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"
          @click.stop
        >
          <div style="height: 6px; background: var(--color-unergy-purple); border-radius: 16px 16px 0 0;" />
          <div class="px-6 pt-4 pb-3 flex items-start justify-between gap-3" style="border-bottom: 1px solid rgba(44,32,57,0.08);">
            <div>
              <div class="font-bold text-lg" style="color: var(--color-unergy-deep);">Empresas responsables de PPA</div>
              <div class="text-xs mt-0.5" style="color: #7a6e8a;">
                Los contratos de un responsable marcado como <b>no relevante</b> no aparecen en la Matriz anual.
                Un contrato sin responsable siempre aparece.
              </div>
            </div>
            <button class="text-sm px-2 py-1 rounded" style="color:#7a6e8a;" @click="cerrarResponsables"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="px-6 py-4 space-y-5">
            <Message v-if="respError" severity="error" :closable="false">{{ respError }}</Message>

            <!-- Catálogo -->
            <div>
              <p class="text-xs font-bold uppercase tracking-widest mb-2" style="color: var(--color-unergy-purple);">Catálogo</p>
              <div class="rounded-lg border divide-y" style="border-color: rgba(44,32,57,0.10);">
                <div v-for="r in responsables" :key="r.id" class="px-3 py-2 flex items-center gap-3">
                  <InputText v-model="r.nombre" class="text-sm flex-1" @change="guardarResponsable(r)" />
                  <label class="flex items-center gap-1.5 text-xs whitespace-nowrap" style="color:#7a6e8a;"
                         v-tooltip.top="'Destildado = sus contratos se ocultan de la Matriz anual'">
                    <Checkbox v-model="r.incluir_en_cumplimiento" :binary="true" @change="guardarResponsable(r)" /> Relevante
                  </label>
                  <span class="text-xs font-mono w-20 text-right" style="color:#7a6e8a;">{{ r.n_contratos }} contr.</span>
                  <button class="text-xs px-2 py-1 rounded" :style="r.n_contratos ? 'color:#c9c0d8; cursor:not-allowed;' : 'color:#D64455;'"
                          :disabled="!!r.n_contratos" @click="borrarResponsable(r)"
                          v-tooltip.top="r.n_contratos ? 'Reasigna sus contratos primero' : 'Eliminar'">
                    <Trash2Icon class="size-[1em]" />
                  </button>
                </div>
                <div v-if="!responsables.length" class="px-3 py-4 text-sm text-center" style="color: rgba(44,32,57,0.35);">Sin responsables todavía</div>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <InputText v-model="respNuevo" placeholder="Nueva empresa responsable…" class="text-sm flex-1"
                           @keyup.enter="crearResponsable" />
                <Button label="Agregar" size="small" outlined :disabled="!respNuevo.trim()" @click="crearResponsable">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
            </div>

            <!-- Asignación -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-xs font-bold uppercase tracking-widest" style="color: var(--color-unergy-purple);">
                  Asignar contratos ({{ respContratos.length }})
                </p>
                <div class="flex items-center gap-2">
                  <Select v-model="respAsignarA" :options="respOpcionesAsignar" optionLabel="label" optionValue="value"
                          placeholder="Asignar seleccionados a…" class="text-sm" style="min-width:14rem;" />
                  <Button label="Aplicar" size="small" :disabled="!respSel.length || !respAsignarA || respGuardando"
                          @click="asignarSeleccionados" />
                </div>
              </div>
              <InputText v-model="respBusqueda" placeholder="Buscar contrato…" class="text-sm w-full mb-2" />
              <div class="rounded-lg border divide-y overflow-y-auto" style="border-color: rgba(44,32,57,0.10); max-height: 300px;">
                <label v-for="c in respContratosFiltrados" :key="c.id"
                       class="px-3 py-1.5 flex items-center gap-2.5 text-sm cursor-pointer hover:bg-[#faf8fd]">
                  <Checkbox v-model="respSel" :value="c.id" />
                  <span class="flex-1 truncate" style="color:var(--color-unergy-deep);">
                    {{ c.nombre_interno || c.numero_codigo_contrato }}
                    <span class="text-xs ml-1" style="color:#7a6e8a;">{{ c.comprador_nombre }}</span>
                  </span>
                  <span class="text-xs px-1.5 py-0.5 rounded" :style="responsableChip(c)">
                    {{ c.responsable || 'sin responsable' }}
                  </span>
                </label>
                <div v-if="!respContratosFiltrados.length" class="px-3 py-4 text-sm text-center" style="color: rgba(44,32,57,0.35);">
                  {{ respCargando ? 'Cargando…' : 'Sin contratos' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { proyectoActivoEnMes } from '~/utils/proyectoActivo'
import { maxConcurrente, aPorcentaje, motivoDuplicada, esRepartida, repartirPares, claveContrato } from './cumplimientoRevision.js'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { isAirError } from '@korastd/air'
import { logger } from '~/core/logger'
import { CumplimientoService } from '~/features/mem/services/cumplimiento'
import { PpaService } from '~/features/contratos/services/ppa'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

const cumplimientoService = new CumplimientoService()
const ppaService = new PpaService()
const proyectosService = new ProyectosService()
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon, BuildingIcon, CalendarIcon, ChartColumnIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleCheckIcon, CircleMinusIcon, CompassIcon, DownloadIcon, EyeIcon, EyeOffIcon, FileSpreadsheetIcon, FileTextIcon, FilterIcon, FolderOpenIcon, HistoryIcon, ImageIcon, InfoIcon, LoaderCircleIcon, LogOutIcon, MaximizeIcon, PlusIcon, RefreshCwIcon, ShieldIcon, ShoppingCartIcon, Trash2Icon, TriangleAlertIcon, XIcon, ZapIcon } from '@lucide/vue'

// ── LocalStorage cache ───────────────────────────────────────────────────────
const CACHE_PREFIX = 'cumpl_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheKey(endpoint, params) {
  return CACHE_PREFIX + endpoint + '|' + JSON.stringify(params)
}

function cacheGet(endpoint, params) {
  try {
    const raw = localStorage.getItem(cacheKey(endpoint, params))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(endpoint, params))
      return null
    }
    return data
  } catch { return null }
}

function cacheSet(endpoint, params, data) {
  try {
    localStorage.setItem(cacheKey(endpoint, params), JSON.stringify({ ts: Date.now(), data }))
  } catch { /* quota exceeded — ignore */ }
}

function cacheClearAll() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k)
  }
  keys.forEach(k => localStorage.removeItem(k))
}

function cacheGetSize() {
  let bytes = 0, count = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_PREFIX)) {
      bytes += (localStorage.getItem(k) || '').length * 2
      count++
    }
  }
  if (!count) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB (${count})` : `${(bytes / 1024).toFixed(0)} KB (${count})`
}

// ── Empresa responsable: interruptor global de la página ──────────────────────
// El backend oculta por defecto los contratos de un responsable marcado como no
// relevante en TODAS las vistas de /mem/cumplimiento. Este check los trae de vuelta
// (para reclasificar o auditar) y aplica a todas las pestañas a la vez, así ninguna
// queda contando un universo distinto que otra.
const verOcultos = ref(false)
// Se pasa como param a cada endpoint (no dentro de cachedGet) para que también
// entre en la llave de caché: la vista filtrada y la completa no deben pisarse.
const incluirTodos = () => verOcultos.value

async function cachedGet(cacheEndpointKey, params, loader) {
  const cached = cacheGet(cacheEndpointKey, params)
  if (cached) return cached
  const data = await loader()
  cacheSet(cacheEndpointKey, params, data)
  return data
}

const cacheSize = ref(cacheGetSize())
const cacheClearing = ref(false)

function updateCacheSize() { cacheSize.value = cacheGetSize() }

async function clearCacheAndReload() {
  cacheClearing.value = true
  cacheClearAll()
  cacheSize.value = ''
  anualData.value = null
  simData.value = null
  pcData.value = null
  etData.value = null
  beData.value = null
  revData.value = null
  tableData.value = []
  try {
    await Promise.all([loadAnnualData(), loadTableData()])
    if (activeTab.value === 0) await loadSimulator()
    if (activeTab.value === 2) await loadPlantasContratos()
    if (activeTab.value === 3) await loadEnergiaTransada()
    if (activeTab.value === 5) await loadBalance()
    if (activeTab.value === 6) await loadRevision()
  } finally {
    cacheClearing.value = false
    updateCacheSize()
  }
}

// Recarga las pestañas tras un cambio de universo (interruptor "Ver ocultos"
// o reclasificación de responsables). No borra la caché: el param incluir_todos
// ya forma parte de la llave, así que cada universo tiene su propia entrada.
// Lo que está fuera de la pestaña activa se descarta y se recarga al abrirla.
async function recargarPorResponsables() {
  contratos.value = []
  anualData.value = null
  simData.value   = null
  pcData.value    = null
  etData.value    = null
  beData.value    = null
  revData.value   = null
  tableData.value = []
  anualMatrizData.value = null
  await loadContratos()
  await Promise.all([loadAnnualData(), loadTableData()])
  if (activeTab.value === 0) await loadSimulator()
  if (activeTab.value === 2) await loadPlantasContratos()
  if (activeTab.value === 3) await loadEnergiaTransada()
  if (activeTab.value === 4) await loadAnualMatriz()
  if (activeTab.value === 5) await loadBalance()
  if (activeTab.value === 6) await loadRevision()
  updateCacheSize()
}

watch(verOcultos, () => { recargarPorResponsables() })

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS      = ['Estrategia', 'Cumplimiento', 'Proyectos', 'Energía transada', 'Matriz anual', 'Balance de energía', 'Revisión del mes']
const activeTab = ref(0)

// ── Chart constants ───────────────────────────────────────────────────────────
const SVG_W  = 820
const SVG_H  = 340
const PAD_L  = 62
const PAD_R  = 22
const PAD_T  = 18
const PAD_B  = 42
const PLOT_W = SVG_W - PAD_L - PAD_R
const PLOT_H = SVG_H - PAD_T - PAD_B
const N      = 12
const slotW  = PLOT_W / N
const barW   = slotW * 0.54

// ── Labels ────────────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_OPTIONS = MESES.map((m, i) => ({ label: m, value: i + 1 }))

// ── Shared ────────────────────────────────────────────────────────────────────
const now   = new Date()
const years = Array.from({ length: 18 }, (_, i) => 2024 + i)

// ── Cumplimiento state ────────────────────────────────────────────────────────
const contratos          = ref([])
const selectedYear       = ref(now.getFullYear())
const selectedContratoId = ref(null)
const anualData          = ref(null)
const chartLoading       = ref(false)
const chartError         = ref(null)
const tableData          = ref([])
const tableLoading       = ref(false)
const hovered            = ref(null)
const tooltipX           = ref(0)
const tooltipY           = ref(0)
const selectedMonthIdx   = ref(null)
const chartBox           = ref(null)

// ── Backend proyectos (para filtrar por fecha_fin_representacion) ─────────────
const backendProyectos = ref([])

async function loadBackendProyectos() {
  try {
    backendProyectos.value = await proyectosService.listar({ size: 500 })
  } catch { /* degradar silenciosamente */ }
}

// ── Simulador state ───────────────────────────────────────────────────────────
const simYear          = ref(now.getFullYear())
const simMonth         = ref(now.getMonth() + 1)
const simData          = ref(null)
const simLoading       = ref(false)
const simError         = ref(null)
const simAssignments   = ref({})
const hiddenContratos  = ref(new Set())
const ficticioContratos = ref([])
const showNuevoForm = ref(false)
const ficticioNombre   = ref('')
const ficticioMin      = ref(0)
const ficticioMax      = ref(0)
let ficticioNextId     = 1
const expandedContratos = ref([])
const sortDesc         = ref(true)
// Filtro por estado (deriva de la proyección, ver estadoEfectivo en simResults).
// null = todos | 'ok' (cumplido) | 'deficit' (incumplido) | 'excedente' (exposición en bolsa)
const estadoFiltro     = ref(null)
const ESTADO_FILTROS = [
  { key: 'ok',        label: 'Cumplido',            color: '#2e7d32', tip: 'Entre el mínimo y el máximo (por proyección de cierre)' },
  { key: 'deficit',   label: 'Incumplido',          color: '#D64455', tip: 'Déficit: por debajo del mínimo (por proyección de cierre)' },
  { key: 'excedente', label: 'Exposición en bolsa', color: '#14B8A6', tip: 'Excedente sobre el máximo o plantas duplicadas (compra en bolsa)' },
]
function toggleEstadoFiltro(k) { estadoFiltro.value = estadoFiltro.value === k ? null : k }
// Filtro por offtaker (comprador del contrato). Vacío = todos. Opciones derivadas
// de los contratos cargados; '' agrupa los que no tienen comprador (ej. PPA nuevo).
const offtakersFiltro = ref([])
const offtakerOpts = computed(() => {
  const nombres = new Set(allContratos.value.map(c => c.comprador_nombre || ''))
  const opts = [...nombres].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
    .map(n => ({ label: n, value: n }))
  if (nombres.has('')) opts.push({ label: '(Sin offtaker)', value: '' })
  return opts
})
function contratoMatchOfftaker(c) {
  if (!offtakersFiltro.value.length) return true
  return offtakersFiltro.value.includes(c.comprador_nombre || '')
}
// Exposición en bolsa = excedente (vende en bolsa) O plantas duplicadas (compra en bolsa,
// genDup>0), aunque el contrato esté cumplido/déficit. Los demás estados son excluyentes.
function contratoMatchEstado(r, key) {
  if (!r) return false
  if (key === 'excedente') return r.estadoEfectivo === 'excedente' || r.tieneDup
  return r.estadoEfectivo === key
}
const dragPlanta       = ref(null)
const dragFromContrato = ref(undefined)
const dragOver         = ref(null)

// ── Proyectos tab state ──────────────────────────────────────────────────────
// Estados estandarizados a-f (mismo catálogo que GET /clasificacion-energia/categorias
// en el backend): agente UNGG (generador) / UNGC (comercializador) × PPA / bolsa × rol.
const PC_GRUPOS = [
  { label: 'PPA', modes: [
    { key: 'ppa_venta_ungg',  agente: 'Venta · UNGG',  bg: 'rgba(145,91,216,0.12)', color: '#915BD8' },
    { key: 'ppa_compra_ungc', agente: 'Compra · UNGC', bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
    { key: 'ppa_compra_externa', agente: 'Plantas externas', bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
  ]},
  { label: 'Compra en bolsa', modes: [
    { key: 'bolsa_compra_ungg', agente: 'UNGG', bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
    { key: 'bolsa_compra_ungc', agente: 'UNGC', bg: 'rgba(44,32,57,0.10)',   color: '#2C2039' },
  ]},
  { label: 'Venta en bolsa', modes: [
    { key: 'bolsa_venta_ungg', agente: 'UNGG', bg: 'rgba(44,32,57,0.10)', color: '#2C2039' },
    { key: 'bolsa_venta_ungc', agente: 'UNGC', bg: 'rgba(44,32,57,0.10)', color: '#2C2039' },
  ]},
]
const PC_MODE_DESC = {
  ppa_venta_ungg:   'a. Plantas en contratos GESCON donde UNGG le vende a otro agente (Terpel, NEU, …).',
  ppa_compra_ungc:  'b. Contratos en que UNGC compra energía a algún agente en GESCON (usualmente a UNGG).',
  ppa_compra_externa: 'g. Plantas externas: PPAs firmados para comprarle energía directamente a terceros, SIN registro en GESCON — aquí está el detalle de a quién le compramos.',
  bolsa_compra_ungg:'c. Compras de UNGG a precio de bolsa: plantas duplicadas que aportan a un contrato con origen bolsa (los PLC entrarán cuando se liquiden).',
  bolsa_compra_ungc:'d. UNGC comprando en bolsa — reglas de negocio por definir.',
  bolsa_venta_ungg: 'e. Plantas sin contrato en GESCON: venden en bolsa desde UNGG.',
  bolsa_venta_ungc: 'f. UNGC compra la energía a UNGG (usualmente a precio de bolsa) para venderla en bolsa.',
}
const pcYear    = ref(now.getFullYear())
const pcMonth   = ref(now.getMonth() + 1)
const pcMode    = ref('ppa_venta_ungg')
const pcData    = ref(null)
const pcLoading = ref(false)
const pcError   = ref(null)

// Sub-listas de bolsa (backend de828e3): comercializador (SIC vigente, comprador UNGC)
// vs libre (sin SIC vigente). Fallback a partir de "piscina" si el backend solo trae bolsa.
const pcBolsaComercializador = computed(() => {
  const d = pcData.value
  if (!d) return []
  if (Array.isArray(d.bolsa_comercializador)) return d.bolsa_comercializador
  return (d.bolsa || []).filter(p => p.piscina === 'comercializador')
})
const pcBolsaLibre = computed(() => {
  const d = pcData.value
  if (!d) return []
  if (Array.isArray(d.bolsa_libre)) return d.bolsa_libre
  return (d.bolsa || []).filter(p => p.piscina !== 'comercializador')
})

// Piscinas estandarizadas a-f: usa `pools` del backend; si aún no llega
// (deploy en tránsito), las deriva client-side con la misma regla.
const pcPools = computed(() => {
  const d = pcData.value
  if (!d) return { ppa_venta_ungg: [], ppa_compra_ungc: [], bolsa_compra_ungg: [],
                   bolsa_compra_ungc: [], bolsa_venta_ungg: [], bolsa_venta_ungc: [],
                   ppa_compra_externa: [] }
  // ppa_compra_externa por delante: un payload cacheado de un backend viejo puede no traerla
  if (d.pools) return { ppa_compra_externa: d.compra_externa || [], ...d.pools }
  const a = [], c = []
  for (const ct of (d.venta || [])) {
    const dup = (ct.plantas || []).filter(p => p.es_duplicado)
    // (a) muestra TODAS las plantas (duplicadas con badge); (c) agrupa las duplicadas
    a.push({ ...ct, plantas: ct.plantas || [] })
    if (dup.length) c.push({ ...ct, plantas: dup })
  }
  return {
    ppa_venta_ungg: a,
    ppa_compra_ungc: d.compra || [],
    bolsa_compra_ungg: c,
    bolsa_compra_ungc: [],
    bolsa_venta_ungg: pcBolsaLibre.value,
    bolsa_venta_ungc: pcBolsaComercializador.value,
    ppa_compra_externa: d.compra_externa || [],
  }
})
// Resumen de modalidades en Venta·UNGG: total de plantas vs cuántas son compra
// en bolsa (duplicado) y cuántas uso del recurso. Alimenta el banner y los chips
// de la piscina de venta. uso_del_recurso y es_duplicado son excluyentes.
const pcVentaDupInfo = computed(() => {
  let total = 0, dup = 0, ur = 0
  for (const c of (pcPools.value.ppa_venta_ungg || [])) {
    for (const p of (c.plantas || [])) {
      total++
      if (p.uso_del_recurso) ur++
      else if (p.es_duplicado) dup++
    }
  }
  return { total, dup, ur }
})

// ── Filtro por modalidad de suministro en Venta·UNGG (a) ─────────────────────
// null = todas. Las tres modalidades son excluyentes y usan las MISMAS reglas
// que los badges de la fila: uso del recurso tiene prioridad sobre duplicado.
const pcModalidad = ref(null)
const PC_MODALIDAD_FILTROS = [
  { key: 'propio',      label: 'Suministro propio', color: '#7a6e8a', tip: 'Plantas con suministro propio (sin compra en bolsa ni uso del recurso)' },
  { key: 'duplicado',   label: 'Compra en bolsa',   color: '#9a6700', tip: 'Plantas duplicadas: aportan al contrato con origen bolsa (genera garantías)' },
  { key: 'uso_recurso', label: 'Uso del recurso',   color: '#0369a1', tip: 'Plantas en bolsa que se pagan al cliente a precio bolsa (sin garantías)' },
]
function modalidadPlanta(p) {
  if (p.uso_del_recurso) return 'uso_recurso'
  if (p.es_duplicado) return 'duplicado'
  return 'propio'
}
const pcModalidadCounts = computed(() => {
  const { total, dup, ur } = pcVentaDupInfo.value
  return { propio: total - dup - ur, duplicado: dup, uso_recurso: ur }
})
// Piscina de venta filtrada: filtra las plantas de cada contrato por modalidad y
// oculta los contratos que queden sin plantas que cumplan el filtro.
const ppaVentaFiltrado = computed(() => {
  const pools = pcPools.value.ppa_venta_ungg || []
  if (!pcModalidad.value) return pools
  return pools
    .map(c => ({ ...c, plantas: (c.plantas || []).filter(p => modalidadPlanta(p) === pcModalidad.value) }))
    .filter(c => c.plantas.length)
})

// Contratos de compra externa sin plantas vinculadas: no sabemos a qué planta
// le compramos — se alerta arriba de las tarjetas (g).
const externasSinPlantas = computed(() =>
  (pcPools.value.ppa_compra_externa || []).filter(c => !(c.plantas || []).length)
)

// ── Detalle de contrato (tab Proyectos): PPA formal + GESCON ─────────────────
// Click en una tarjeta → modal con el contrato del módulo PPA (indexaciones,
// cantidades, tarifas, compromisos) + los registros GESCON del contrato
// (vigencia efectiva) + las plantas del mes consultado.
const detalleContrato = ref(null)   // { c: tarjeta de la piscina, modo: clave a-g }
const dcPpa     = ref(null)
const dcGescon  = ref([])
const dcLoading = ref(false)
const dcError   = ref(null)

const DC_TIPOS = {
  ppa_venta_ungg:     { label: 'Venta PPA · UNGG',   bg: 'rgba(145,91,216,0.10)', color: '#915BD8' },
  ppa_compra_ungc:    { label: 'Compra PPA · UNGC',  bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
  ppa_compra_externa: { label: 'Compra externa (fuera de GESCON)', bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
  bolsa_compra_ungg:  { label: 'Compra en bolsa · UNGG', bg: 'rgba(240,192,64,0.18)', color: '#9a6700' },
  bolsa_venta_ungg:   { label: 'Venta en bolsa · UNGG', bg: 'rgba(44,32,57,0.08)', color: '#2C2039' },
  bolsa_venta_ungc:   { label: 'Venta en bolsa · UNGC', bg: 'rgba(44,32,57,0.08)', color: '#2C2039' },
}
const dcTipo = computed(() => DC_TIPOS[detalleContrato.value?.modo] || DC_TIPOS.ppa_venta_ungg)

const fmtQ = v => (v == null || v === '' ? '—' : Number(v).toLocaleString('es-CO'))

const dcContraparte = computed(() => {
  const c = detalleContrato.value?.c || {}
  const p = dcPpa.value
  const vnd = p?.vendedor_nombre || c.vendedor_nombre
  const cmp = p?.comprador_nombre || c.comprador_nombre
  const parts = []
  if (vnd) parts.push(`Vendedor: ${vnd}${p?.vendedor_nit ? ` (NIT ${p.vendedor_nit})` : ''}`)
  if (cmp) parts.push(`Comprador: ${cmp}${p?.comprador_nit ? ` (NIT ${p.comprador_nit})` : ''}`)
  return parts.join('  ·  ')
})

// Campos del contrato formal, en el orden en que se muestran en la grilla
const dcCamposFormales = computed(() => {
  const p = dcPpa.value
  if (!p) return []
  return [
    { label: 'Número / código',        value: p.numero_codigo_contrato || '—', mono: true },
    { label: 'Tipo de contrato',       value: p.tipo_contrato || 'venta' },
    { label: 'Vigencia',               value: `${p.fecha_inicio || '—'} → ${p.fecha_fin || 'indefinida'}`, mono: true },
    { label: 'Tarifa base ($/kWh)',    value: fmtQ(p.tarifa_base), mono: true },
    { label: 'Índice de indexación',   value: p.indice_indexacion || '—' },
    { label: 'Periodicidad indexación', value: p.periodicidad_indexacion || '—' },
    { label: 'Período base indexación', value: p.periodo_indexacion_base ? `${p.periodo_indexacion_base}${p.valor_indexacion_base != null ? ` = ${fmtQ(p.valor_indexacion_base)}` : ''}` : '—', mono: true },
    { label: 'Cantidad mínima (kWh/mes)', value: fmtQ(p.cantidad_minima_kwh_mes), mono: true },
    { label: 'Cantidad máxima (kWh/mes)', value: fmtQ(p.cantidad_maxima_kwh_mes), mono: true },
    { label: 'Periodicidad facturación', value: p.periodicidad_facturacion || '—' },
    { label: 'Tiempo de pago',         value: p.tiempo_pago != null ? `${p.tiempo_pago} días` : '—' },
    { label: 'Condiciones de pago',    value: p.condiciones_pago || '—' },
  ]
})

// Resumen GESCON del propio contrato PPA (condiciones registradas ante el ASIC)
const dcGesconResumen = computed(() => {
  const p = dcPpa.value
  if (!p || !(p.gescon_codigo || p.gescon_fecha_inicio || p.gescon_precio || p.gescon_cantidades_kwh)) return []
  return [
    { label: 'Código GESCON', value: p.gescon_codigo || '—', mono: true },
    { label: 'Vigencia GESCON', value: `${p.gescon_fecha_inicio || '—'} → ${p.gescon_fecha_fin || '—'}`, mono: true },
    { label: 'Precio GESCON ($/kWh)', value: fmtQ(p.gescon_precio), mono: true },
    { label: 'Cantidades GESCON (kWh)', value: fmtQ(p.gescon_cantidades_kwh), mono: true },
  ]
})

const dcCompromisos = computed(() =>
  [...(dcPpa.value?.compromisos_energia || [])].sort((a, b) => a['año'] - b['año'] || a.mes - b.mes)
)
const dcTarifas = computed(() =>
  [...(dcPpa.value?.tarifas || [])].sort((a, b) => a['año'] - b['año'] || a.mes - b.mes)
)

function dcEstadoStyle(e) {
  if (e === 'publicado') return 'background: rgba(46,125,50,0.12); color: #2e7d32;'
  if (e === 'desistimiento' || e === 'rechazado') return 'background: rgba(214,68,85,0.12); color: #D64455;'
  return 'background: rgba(44,32,57,0.08); color: #7a6e8a;'
}

async function abrirDetalleContrato(c, modo) {
  detalleContrato.value = { c, modo }
  dcPpa.value = null; dcGescon.value = []; dcError.value = null; dcLoading.value = true
  try {
    // 1) Contrato formal del módulo PPA (si la tarjeta tiene id real)
    const ppaId = c.contrato_ppa_id || (typeof c.id === 'number' ? c.id : null)
    let ppa = null
    if (ppaId) {
      try { ppa = await ppaService.obtener(ppaId) } catch { ppa = null }
    }
    // 2) Registros GESCON del contrato (por contrato_interno; fallback por SIC;
    //    último fallback: historial GESCON de la planta, para capas sin contrato)
    let gescon = []
    const ci = c.numero_codigo_contrato || c.contrato_interno || ppa?.numero_codigo_contrato
    if (ci) {
      try { gescon = await ppaService.listarAsic({ contrato_interno: ci }) } catch { gescon = [] }
    }
    if (!gescon.length && c._proyecto_id) {
      try { gescon = await ppaService.listarAsic({ proyecto_id: c._proyecto_id }) } catch { /* sin fallback */ }
    }
    if (!gescon.length && modo !== 'ppa_compra_externa') {
      const sic = (c.plantas || []).find(p => p.codigo_sic)?.codigo_sic
      if (sic) {
        try { gescon = await ppaService.listarAsic({ codigo_sic_contrato: sic }) } catch { /* sin fallback */ }
      }
    }
    // Vigentes primero, luego por fecha de inicio descendente
    gescon.sort((a, b) => (b.es_version_vigente === true) - (a.es_version_vigente === true)
      || String(b.fecha_inicio || '').localeCompare(String(a.fecha_inicio || '')))
    // 3) Contrato actual desde GESCON: si la capa no traía PPA, el registro
    //    vigente puede apuntar al contrato con contrato_ppa_id
    if (!ppa) {
      const vig = gescon.find(r => r.es_version_vigente && r.contrato_ppa_id)
      if (vig) {
        try { ppa = await ppaService.obtener(vig.contrato_ppa_id) } catch { ppa = null }
      }
    }
    dcPpa.value = ppa
    dcGescon.value = gescon
    if (!ppa && !gescon.length) {
      dcError.value = c._proyecto_id
        ? 'No se encontraron datos: la planta no tiene registros GESCON ni contrato en el módulo PPA.'
        : 'No se encontraron datos: el contrato no está en el módulo PPA ni tiene registros GESCON.'
    }
  } finally {
    dcLoading.value = false
  }
}
// Detalle desde una capa de PLANTA (piscinas e/f, sin tarjeta de contrato):
// tarjeta sintética con la planta; abrirDetalleContrato resuelve GESCON por
// SIC o por proyecto_id y el contrato actual desde el registro vigente.
function abrirDetallePlanta(p, modo) {
  abrirDetalleContrato({ id: null, nombre: p.nombre, plantas: [p], _proyecto_id: p.id }, modo)
}
function cerrarDetalleContrato() { detalleContrato.value = null }
const pcCounts = computed(() => {
  const d = pcData.value
  if (!d) return null
  if (d.counts) return d.counts
  const P = pcPools.value
  const nPlantas = list => list.reduce((s, ct) => s + (ct.plantas?.length || 0), 0)
  return {
    ppa_venta_ungg: nPlantas(P.ppa_venta_ungg),
    ppa_compra_ungc: nPlantas(P.ppa_compra_ungc),
    bolsa_compra_ungg: nPlantas(P.bolsa_compra_ungg),
    bolsa_compra_ungc: 0,
    bolsa_venta_ungg: P.bolsa_venta_ungg.length,
    bolsa_venta_ungc: P.bolsa_venta_ungc.length,
    ppa_compra_externa: nPlantas(P.ppa_compra_externa || []),
  }
})

// Los chips muestran VIGENTES a la fecha de corte (hoy si el mes es el actual,
// cierre de mes si no) y, al lado, cuántos terminaron durante el mes. Fallback
// a `counts` si el backend aún no manda los nuevos campos (deploy en tránsito).
const pcFechaCorte = computed(() => pcData.value?.fecha_corte || null)
const pcCountsVigentes = computed(() => pcData.value?.counts_vigentes || pcCounts.value || {})
const pcCountsTerminados = computed(() => pcData.value?.counts_terminados || {})

// Exporta un resumen plano y filtrable: cada contrato (venta + compra) con sus plantas,
// y al final las plantas SIN contrato (libre) o en bolsa con el comercializador UNGC.
async function exportarResumenPlantasContratos() {
  if (!pcData.value) return
  const XLSX = await import('xlsx-js-style')
  const mes = MESES[pcMonth.value - 1]
  const pct = v => (v != null ? Number((v * 100).toFixed(0)) : '')

  const aoa = [[`UNERGY — Resumen contratos y plantas · ${mes} ${pcYear.value}`], []]
  const header = ['Categoría', 'Contrato', 'Contraparte', 'Planta', 'SIC', '% Despacho', 'Inicio', 'Fin', 'Nota']
  const headerRow = aoa.length
  aoa.push(header)

  // Categorías estandarizadas a-f (mismo catálogo que GET /clasificacion-energia)
  const P = pcPools.value
  for (const c of P.ppa_venta_ungg) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push(['a. PPA Venta (UNGG)', c.nombre, c.comprador_nombre || '', p.nombre, p.codigo_sic || '',
          pct(p.pct_despacho), p.fecha_inicio || '', p.fecha_fin || '', p.es_duplicado ? 'Duplicado — ver c.' : ''])
    } else {
      aoa.push(['a. PPA Venta (UNGG)', c.nombre, c.comprador_nombre || '', '(sin plantas en GESCON)', '', '', '', '', ''])
    }
  }
  for (const c of P.ppa_compra_ungc) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push(['b. PPA Compra (UNGC)', c.nombre, c.vendedor_nombre || '', p.nombre, '', '', p.fecha_inicio || '', p.fecha_fin || '', ''])
    } else {
      aoa.push(['b. PPA Compra (UNGC)', c.nombre, c.vendedor_nombre || '', '(sin plantas)', '', '', '', '', ''])
    }
  }
  for (const c of P.ppa_compra_externa || []) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push(['g. Plantas externas (PPA)', c.nombre, c.vendedor_nombre || '', p.nombre, '', '', p.fecha_inicio || '', p.fecha_fin || '', 'Compra directa fuera de GESCON'])
    } else {
      aoa.push(['g. Plantas externas (PPA)', c.nombre, c.vendedor_nombre || '', '(sin plantas vinculadas)', '', '', c.fecha_inicio || '', c.fecha_fin || '', 'Compra directa fuera de GESCON'])
    }
  }
  for (const c of P.bolsa_compra_ungg)
    for (const p of c.plantas)
      aoa.push(['c. Compra en Bolsa (UNGG)', c.nombre, c.comprador_nombre || '', p.nombre, p.codigo_sic || '',
        pct(p.pct_despacho), p.fecha_inicio || '', p.fecha_fin || '', 'Duplicado — origen bolsa'])
  // e/f llevan el tramo del mes: una planta puede tener varios (entró/salió de contrato)
  const notaTramo = (p, base) => filaTerminada(p) ? `${base} — tramo terminado en el mes` : base
  for (const p of P.bolsa_venta_ungg)
    aoa.push(['e. Venta en Bolsa (UNGG)', '', '', p.nombre, '', '',
      p.segmento_inicio || '', p.segmento_fin || '', notaTramo(p, 'Sin SIC vigente')])
  for (const p of P.bolsa_venta_ungc)
    aoa.push(['f. Venta en Bolsa (UNGC)', '', 'UNGC (comercializador)', p.nombre, p.codigo_sic || '', '',
      p.fecha_inicio || p.segmento_inicio || '', p.fecha_fin || p.segmento_fin || '',
      notaTramo(p, 'SIC con comprador UNGC')])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  for (let c = 0; c < header.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = { font: { bold: true, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.morado } }, alignment: { horizontal: 'center' } }
  }
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 })
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }]
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 10 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 16 }]
  ws['!autofilter'] = { ref: `A${headerRow + 1}:I${aoa.length}` }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Resumen ${mes} ${pcYear.value}`.slice(0, 31))
  XLSX.writeFile(wb, `resumen_contratos_plantas_${pcYear.value}_${String(pcMonth.value).padStart(2, '0')}.xlsx`)
}

// ── Energía transada state ────────────────────────────────────────────────────
// Histórico por mes en localStorage: los meses cerrados son inmutables y se
// guardan sin TTL; el mes actual siempre se consulta fresco y se va guardando
// como parcial. Un prefetch silencioso completa el histórico del año.
const ET_PREFIX  = 'cumpl_et_'
const etYear     = ref(now.getFullYear())
const etMonth    = ref(now.getMonth() + 1)
const etData     = ref(null)
const etLoading  = ref(false)
const etError    = ref(null)
const etFromCache = ref(false)
let etPrefetching = false

const etYearOptions = computed(() => years.filter(y => y <= now.getFullYear()))

const etMonthOptions = computed(() => {
  const maxMonth = etYear.value === now.getFullYear() ? now.getMonth() + 1 : 12
  return MESES_OPTIONS.filter(o => o.value <= maxMonth)
})

const etPeriodoLabel = computed(() => {
  const p = etData.value?.periodo
  if (!p) return ''
  return p.es_mes_actual
    ? `Del 1 al ${p.dia_corte} de ${MESES[p.month - 1].toLowerCase()} ${p.year}`
    : `Mes completo · ${MESES[p.month - 1]} ${p.year}`
})

function etPct(val) {
  const total = etData.value?.totales?.gen_mwh
  if (!total || val === null) return '0'
  return (val / total * 100).toFixed(1)
}

function etIsCurrentMonth(y, m) {
  return y === now.getFullYear() && m === now.getMonth() + 1
}

function etCacheKey(y, m) { return `${ET_PREFIX}${y}_${String(m).padStart(2, '0')}` }

function etCacheGet(y, m) {
  try {
    const raw = localStorage.getItem(etCacheKey(y, m))
    if (!raw) return null
    const { data, partial } = JSON.parse(raw)
    // Un mes guardado como parcial (era el mes en curso) deja de valer cuando el mes cierra
    if (partial && !etIsCurrentMonth(y, m)) {
      localStorage.removeItem(etCacheKey(y, m))
      return null
    }
    return data
  } catch { return null }
}

function etCacheSet(y, m, data) {
  try {
    localStorage.setItem(etCacheKey(y, m), JSON.stringify({
      ts: Date.now(),
      partial: etIsCurrentMonth(y, m),
      data,
    }))
  } catch { /* quota exceeded — ignorar */ }
}

async function etFetch(y, m) {
  const data = await cumplimientoService.obtenerEnergiaTransada({
    year: y, month: m, incluir_todos: incluirTodos(),
  })
  etCacheSet(y, m, data)
  return data
}

async function loadEnergiaTransada() {
  const y = etYear.value, m = etMonth.value
  etError.value = null
  etFromCache.value = false

  // Mes cerrado ya guardado → instantáneo desde el histórico local
  if (!etIsCurrentMonth(y, m)) {
    const cached = etCacheGet(y, m)
    if (cached) {
      etData.value = cached
      etFromCache.value = true
      prefetchEtHistory()
      return
    }
  }

  etLoading.value = true
  try {
    etData.value = await etFetch(y, m)
    updateCacheSize()
    prefetchEtHistory()
  } catch (e) {
    const status = isAirError(e) ? e.status : undefined
    etError.value = (isAirError(e) ? e.data?.detail : undefined)
      || (status === 401 ? 'Sesión expirada — inicia sesión de nuevo.'
         : e.name === 'TimeoutError' ? 'Tiempo de espera agotado — el servidor tardó demasiado.'
         : 'Error al consultar la energía transada.')
  } finally {
    etLoading.value = false
  }
}

// Completa en segundo plano el histórico del año (meses cerrados que falten),
// secuencial para no saturar el backend. El usuario no ve nada de esto.
async function prefetchEtHistory() {
  if (etPrefetching) return
  etPrefetching = true
  try {
    const y = etYear.value
    const lastClosed = y === now.getFullYear() ? now.getMonth() : (y < now.getFullYear() ? 12 : 0)
    for (let m = 1; m <= lastClosed; m++) {
      if (etCacheGet(y, m)) continue
      try { await etFetch(y, m) } catch { break /* backend con problemas — reintentar en próxima visita */ }
    }
    updateCacheSize()
  } finally {
    etPrefetching = false
  }
}

function onEtPeriodChange() {
  const maxMonth = etYear.value === now.getFullYear() ? now.getMonth() + 1 : 12
  if (etMonth.value > maxMonth) etMonth.value = maxMonth
  loadEnergiaTransada()
}

// ── Matriz anual state ────────────────────────────────────────────────────────
const anualMatrizData    = ref(null)
const anualMatrizLoading = ref(false)
const anualMatrizError   = ref('')
const anualMatrizYear    = ref(now.getFullYear())
const expandedMatriz     = ref([])
const matrizSoloNoCumple = ref(false)
const matrizBusqueda     = ref('')
const matrizContratosSel = ref([])   // ids de contratos elegidos (vacío = todos)
const matrizOfftakersSel = ref([])   // nombres de offtaker elegidos (vacío = todos)

// Carga progresiva: primero la lista de contratos (instantánea, sin generación) para pintar la
// tabla, y luego el detalle de cada contrato en peticiones independientes con concurrencia limitada.
// Evita el timeout de una sola petición agregada que golpea la API de Unergy por todos los contratos.
let matrizLoadId = 0
async function loadAnualMatriz() {
  anualMatrizLoading.value = true
  anualMatrizError.value = ''
  expandedMatriz.value = []
  matrizContratosSel.value = []
  matrizOfftakersSel.value = []
  const year = anualMatrizYear.value
  // Token de carga: el año ya no basta como guarda (cambiar "Ver ocultos" recarga
  // sin cambiarlo), y sin esto los workers de la carga anterior siguen pidiendo.
  const loadId = ++matrizLoadId
  try {
    const data = await cumplimientoService.obtenerAnualMatrizContratos({ year, incluir_todos: incluirTodos() })
    const contratos = (data.contratos || []).map(c => ({
      ...c,
      meses: [], proyectos: [],
      estado_cumplimiento: null, meses_en_deficit: 0, requiere_bolsa: false,
      total_anual_mwh: null, bolsa_anual_mwh: null, n_plantas: null,
      _loading: true, _error: false,
    }))
    anualMatrizData.value = { year, contratos }
    anualMatrizLoading.value = false
  } catch (e) {
    anualMatrizError.value = e.data?.detail || e.message
    anualMatrizLoading.value = false
    return
  }

  // Filas reactivas a llenar (se mutan a través del proxy reactivo para disparar el render).
  const rows = anualMatrizData.value.contratos
  const queue = rows.map((_, i) => i)
  const CONC = 4
  const worker = async () => {
    while (queue.length) {
      if (matrizLoadId !== loadId) return  // llegó otra carga: abortar la vieja
      const idx = queue.shift()
      const row = rows[idx]
      try {
        const det = await cumplimientoService.obtenerAnualMatrizContrato(row.id, { year })
        if (matrizLoadId !== loadId) return
        Object.assign(row, det, { _loading: false, _error: false })
      } catch (e) {
        Object.assign(row, { _loading: false, _error: true })
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))
}

function toggleMatriz(id) {
  const i = expandedMatriz.value.indexOf(id)
  if (i >= 0) expandedMatriz.value.splice(i, 1)
  else expandedMatriz.value.push(id)
}

async function exportarMatrizExcel() {
  if (!anualMatrizData.value) return
  const XLSX = await import('xlsx-js-style')
  const { construirMatrizAOA } = await import('./cumplimientoMatrizExcel.js')
  const { aoa, rowLevels, formulaCells, totalRow, headerRow } =
    construirMatrizAOA(anualMatrizData.value, anualMatrizYear.value)

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Fórmulas
  for (const fc of formulaCells) {
    const ref = XLSX.utils.encode_cell({ r: fc.r, c: fc.c })
    ws[ref] = { t: 'n', f: fc.f }
  }

  // Outline (filas de proyecto colapsables bajo su contrato)
  ws['!rows'] = rowLevels.map(l => (l > 0 ? { level: l } : {}))

  // Paleta de marca Unergy
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }

  // Estilo encabezado (fila headerRow)
  for (let c = 0; c < 17; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = {
      font: { bold: true, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.morado } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
  }

  // Estilo fila total general
  for (let c = 0; c < 17; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRow, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = { font: { bold: true, color: { rgb: C.oscuro } } }
  }

  // Título
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 })
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }

  // Merges, anchos de columna, autofiltro
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }]
  ws['!cols'] = [
    { wch: 34 },
    ...Array(12).fill({ wch: 8 }),
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ]
  ws['!autofilter'] = { ref: `A${headerRow + 1}:Q${totalRow + 1}` }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Matriz anual')
  XLSX.writeFile(wb, `matriz_anual_cumplimiento_${anualMatrizYear.value}.xlsx`)
}

// Opciones de los dropdowns: se construyen de los contratos ya cargados, así
// aparecen apenas llega la lista (antes de que termine el detalle de cada fila).
const matrizContratoOpts = computed(() =>
  (anualMatrizData.value?.contratos || []).map(c => ({
    value: c.id,
    label: c.nombre_interno || c.numero_codigo_contrato || ('#' + c.id),
    offtaker: c.comprador_nombre || '',
  }))
)
const matrizOfftakerOpts = computed(() => {
  const set = new Set()
  for (const c of anualMatrizData.value?.contratos || [])
    if (c.comprador_nombre) set.add(c.comprador_nombre)
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
})

const matrizFiltrada = computed(() => {
  const cs = anualMatrizData.value?.contratos || []
  const q = matrizBusqueda.value.trim().toLowerCase()
  const cSel = matrizContratosSel.value
  const oSel = matrizOfftakersSel.value
  return cs.filter(c =>
    (!matrizSoloNoCumple.value || c.estado_cumplimiento === 'no_cumple') &&
    (!cSel.length || cSel.includes(c.id)) &&
    (!oSel.length || oSel.includes(c.comprador_nombre)) &&
    (!q || (c.nombre_interno || c.numero_codigo_contrato || '').toLowerCase().includes(q)
        || (c.comprador_nombre || '').toLowerCase().includes(q))
  )
})

const matrizTotalesMensuales = computed(() => {
  const tot = Array.from({ length: 12 }, () => 0)
  for (const c of matrizFiltrada.value)
    (c.meses || []).forEach((m, i) => { tot[i] += m.valor_mwh || 0 })
  return tot
})

// Formato compacto para celdas de la matriz (sin sufijo " MWh", que recargaba 12 columnas).
function fmtNum(v) {
  return v == null ? '·' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

// True mientras alguna fila de contrato aún está cargando su detalle (deshabilita el export).
const matrizFilasCargando = computed(() =>
  (anualMatrizData.value?.contratos || []).some(c => c._loading)
)

// ── Empresas responsables de PPA ──────────────────────────────────────────────
// El responsable es un catálogo (no texto libre) para que los filtros de la
// plataforma trabajen sobre valores consistentes. `incluir_en_cumplimiento=false`
// esconde sus contratos de la Matriz anual; sin responsable = siempre visible.
const respAbierto    = ref(false)
const respDirty      = ref(false)   // hubo cambios → recargar la matriz al cerrar
const respError      = ref('')
const respCargando   = ref(false)
const respGuardando  = ref(false)
const responsables   = ref([])
const respNuevo      = ref('')
const respContratos  = ref([])   // TODOS los contratos, incluidos los ocultos
const respSel        = ref([])
const respAsignarA   = ref(null)
const respBusqueda   = ref('')

// Fila que normalmente NO se vería: solo aparece con "Ver ocultos" encendido, y se
// marca para que quede claro por qué está ahí. Las filas de responsable relevante o
// sin responsable no llevan chip, para no ensuciar el uso diario.
function esOculto(c) {
  return !!c && c.responsable_relevante === false
}

function responsableChip(c) {
  if (!c.responsable) return 'background: rgba(44,32,57,0.06); color: #7a6e8a;'
  return c.responsable_relevante === false
    ? 'background: rgba(214,68,85,0.12); color: #b03446;'   // oculto de la matriz
    : 'background: rgba(145,91,216,0.10); color: #915BD8;'
}

// Sentinel en vez de null: con optionValue=null el Select vuelve a mostrar el
// placeholder al elegir "Sin responsable" y parece que no se seleccionó nada.
const SIN_RESPONSABLE = '__sin__'
const respOpcionesAsignar = computed(() => [
  { value: SIN_RESPONSABLE, label: 'Sin responsable' },
  ...responsables.value.map(r => ({
    value: r.id,
    label: r.incluir_en_cumplimiento ? r.nombre : `${r.nombre} (oculto)`,
  })),
])

const respContratosFiltrados = computed(() => {
  const q = respBusqueda.value.trim().toLowerCase()
  if (!q) return respContratos.value
  return respContratos.value.filter(c =>
    (c.nombre_interno || c.numero_codigo_contrato || '').toLowerCase().includes(q) ||
    (c.comprador_nombre || '').toLowerCase().includes(q) ||
    (c.responsable || '').toLowerCase().includes(q)
  )
})

async function cargarResponsables() {
  responsables.value = await ppaService.listarResponsables()
}

async function abrirResponsables() {
  respAbierto.value = true
  respDirty.value = false
  respError.value = ''
  respSel.value = []
  respAsignarA.value = null
  respBusqueda.value = ''
  respCargando.value = true
  try {
    // incluir_todos: para reclasificar hay que ver también los que están ocultos.
    const [, contratos] = await Promise.all([
      cargarResponsables(),
      cumplimientoService.obtenerAnualMatrizContratos({ year: anualMatrizYear.value, incluir_todos: true }),
    ])
    respContratos.value = contratos.contratos || []
  } catch (e) {
    respError.value = e.data?.detail || e.message
  } finally {
    respCargando.value = false
  }
}

async function crearResponsable() {
  const nombre = respNuevo.value.trim()
  if (!nombre) return
  respError.value = ''
  try {
    await ppaService.crearResponsable({ nombre, incluir_en_cumplimiento: true })
    respNuevo.value = ''
    await cargarResponsables()
  } catch (e) {
    respError.value = e.data?.detail || e.message
  }
}

async function guardarResponsable(r) {
  respError.value = ''
  try {
    await ppaService.actualizarResponsable(r.id, {
      nombre: r.nombre,
      incluir_en_cumplimiento: r.incluir_en_cumplimiento,
    })
    await refrescarTrasCambio()
  } catch (e) {
    respError.value = e.data?.detail || e.message
    await cargarResponsables()   // revierte el input al valor real
  }
}

async function borrarResponsable(r) {
  respError.value = ''
  try {
    await ppaService.eliminarResponsable(r.id)
    await cargarResponsables()
  } catch (e) {
    respError.value = e.data?.detail || e.message
  }
}

async function asignarSeleccionados() {
  if (!respSel.value.length || !respAsignarA.value) return
  respGuardando.value = true
  respError.value = ''
  try {
    await ppaService.asignarResponsables({
      contrato_ids: respSel.value,
      responsable_id: respAsignarA.value === SIN_RESPONSABLE ? null : respAsignarA.value,
    })
    respSel.value = []
    await refrescarTrasCambio()
  } catch (e) {
    respError.value = e.data?.detail || e.message
  } finally {
    respGuardando.value = false
  }
}

// Tras cualquier cambio: refrescar catálogo y lista del diálogo. Las pestañas NO
// se recargan aquí — hacerlo por clic dispararía una tanda de llamadas a Unergy
// cada vez; se recargan una sola vez al cerrar (ver cerrarResponsables).
async function refrescarTrasCambio() {
  respDirty.value = true
  await cargarResponsables()
  const data = await cumplimientoService.obtenerAnualMatrizContratos({ year: anualMatrizYear.value, incluir_todos: true })
  respContratos.value = data.contratos || []
}

function cerrarResponsables() {
  respAbierto.value = false
  if (respDirty.value) {
    respDirty.value = false
    // Reclasificar cambia el universo de TODAS las pestañas, no solo la matriz.
    recargarPorResponsables()
  }
}

const allContratos = computed(() => {
  if (!simData.value) return []
  return [...simData.value.contratos, ...ficticioContratos.value]
})

const visibleContratos = computed(() => {
  const res = simResults.value
  const filtered = allContratos.value.filter(c => {
    if (hiddenContratos.value.has(c.id)) return false
    if (!contratoMatchOfftaker(c)) return false
    if (estadoFiltro.value && !contratoMatchEstado(res[c.id], estadoFiltro.value)) return false
    return true
  })
  return filtered.slice().sort((a, b) => {
    const pctA = res[a.id]?.pct ?? -1
    const pctB = res[b.id]?.pct ?? -1
    return sortDesc.value ? pctB - pctA : pctA - pctB
  })
})

// Conteo por estado (sobre los contratos no ocultos, respetando el filtro de
// offtaker) para mostrar en los botones de filtro.
const estadoCounts = computed(() => {
  const res = simResults.value
  const counts = { ok: 0, deficit: 0, excedente: 0 }
  for (const c of allContratos.value) {
    if (hiddenContratos.value.has(c.id)) continue
    if (!contratoMatchOfftaker(c)) continue
    // Conteos por propiedad (no excluyentes: un contrato cumplido puede tener exposición).
    for (const k of ['ok', 'deficit', 'excedente']) {
      if (contratoMatchEstado(res[c.id], k)) counts[k]++
    }
  }
  return counts
})

// ── Table with consolidated row ──────────────────────────────────────────────
const tableDataWithTotal = computed(() => {
  if (!tableData.value.length) return []
  const rows = tableData.value
  const totalMin = rows.reduce((s, r) => s + (r.total_min_mwh || 0), 0)
  const totalMax = rows.reduce((s, r) => s + (r.total_max_mwh || 0), 0)
  const maxMeses = Math.max(...rows.map(r => r.meses_con_compromisos || 0))
  return [
    {
      id: CONSOLIDADO_ID,
      nombre_interno: 'Consolidado (todos)',
      comprador_nombre: `${rows.length} contratos`,
      fecha_inicio: null,
      fecha_fin: null,
      total_min_mwh: Math.round(totalMin * 10) / 10,
      total_max_mwh: Math.round(totalMax * 10) / 10,
      meses_con_compromisos: maxMeses,
    },
    ...rows,
  ]
})

// ── Chart math ────────────────────────────────────────────────────────────────
const yMaxVal = computed(() => {
  if (!anualData.value) return 1000
  let m = 0
  for (const mes of anualData.value.meses) m = Math.max(m, mes.max_mwh || 0, genVal(mes), cierreVal(mes))
  return m > 0 ? m * 1.18 : 1000
})

const yGridLines = computed(() => {
  const step = niceStep(yMaxVal.value)
  const lines = []
  for (let v = 0; v <= yMaxVal.value; v += step) lines.push({ val: v, y: toY(v) })
  return lines
})

function niceStep(max) {
  const rough = max / 5
  const mag   = Math.pow(10, Math.floor(Math.log10(rough || 1)))
  const mult  = rough / mag
  if (mult < 1.5) return mag
  if (mult < 3.5) return 2 * mag
  if (mult < 7.5) return 5 * mag
  return 10 * mag
}

function toY(val)  { return PAD_T + PLOT_H * (1 - (val || 0) / yMaxVal.value) }
function slotX(i)  { return PAD_L + i * slotW }
function barX(i)   { return PAD_L + i * slotW + (slotW - barW) / 2 }
function genVal(mes) { return mes.gen_proyectada_mwh ?? mes.gen_mwh ?? 0 }
function cierreVal(mes) { return mes.gen_proyectada_cierre ?? 0 }
function isCurrentMonth(mes) { return selectedYear.value === now.getFullYear() && mes.month === (now.getMonth() + 1) }

// Dual-bar geometry for current month (two narrower bars side by side)
const dualBarW = slotW * 0.26
const dualGap  = slotW * 0.03
function dualBarLeftX(i)  { return PAD_L + i * slotW + (slotW - dualBarW * 2 - dualGap) / 2 }
function dualBarRightX(i) { return dualBarLeftX(i) + dualBarW + dualGap }

// ── Chart interaction ─────────────────────────────────────────────────────────
function monthIdxFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const svgX = (event.clientX - rect.left) * (SVG_W / rect.width)
  const idx  = Math.floor((svgX - PAD_L) / slotW)
  return (idx >= 0 && idx < N && svgX >= PAD_L) ? idx : null
}

function onSvgMousemove(event) {
  const idx = monthIdxFromEvent(event)
  hovered.value = idx
  if (idx !== null && chartBox.value) {
    const r = chartBox.value.getBoundingClientRect()
    tooltipX.value = Math.min(event.clientX - r.left + 12, r.width - 215)
    tooltipY.value = event.clientY - r.top - 10
  }
}

function onSvgClick(event) {
  const idx = monthIdxFromEvent(event)
  if (idx === null) return
  selectedMonthIdx.value = selectedMonthIdx.value === idx ? null : idx
}

// ── Simulador computed ────────────────────────────────────────────────────────
const simResults = computed(() => {
  if (!simData.value || !Object.keys(simAssignments.value).length) return {}
  const out = {}
  const esActual = simData.value.es_mes_actual
  const diaAct = simData.value.dia_actual
  const diasRest = simData.value.dias_restantes
  for (const c of allContratos.value) {
    const plantas = simAssignments.value[c.id] || []
    let genReal = 0, genDup = 0, genProy = 0
    for (const p of plantas) {
      if (p.month_mwh == null) continue
      const mwh = p.month_mwh * p.pct_despacho
      // Todo el suministro cuenta para el cumplimiento (real o compra en bolsa);
      // genDup es el subconjunto cuyo origen es bolsa (informativo). Una planta
      // comprada por Unergy (comprado_por_unergy) NO es bolsa: su origen es el
      // contrato de compra, así que se excluye de genDup aunque sea duplicado.
      genReal += mwh
      if (p.es_duplicado && !p.comprado_por_unergy) genDup += mwh
      if (esActual && p.month_mwh_proyectado != null) {
        genProy += p.month_mwh_proyectado * p.pct_despacho
      }
    }
    const gen = genReal
    const { min_mwh: min, max_mwh: max } = c
    let estado = 'sin_compromisos'
    if (min !== null || max !== null) {
      const effectiveMin = min ?? 0
      if (gen < effectiveMin) estado = 'deficit'
      else if (max !== null && gen > max) estado = 'excedente'
      else estado = 'ok'
    }
    const pct = max != null ? (gen / max * 100) : min != null ? (gen / min * 100) : null
    const dupPct = genDup > 0 && (max != null || min != null)
      ? (genDup / (max ?? min) * 100) : null
    const proyPct = esActual && genProy > 0 && (max != null || min != null)
      ? (genProy / (max ?? min) * 100) : null
    let estadoProy = 'sin_compromisos'
    if (esActual && genProy > 0 && (min !== null || max !== null)) {
      const effMin = min ?? 0
      if (genProy < effMin) estadoProy = 'deficit'
      else if (max !== null && genProy > max) estadoProy = 'excedente'
      else estadoProy = 'ok'
    }
    // ── Geometría del bullet chart (zonas déficit/rango/excedente sobre un eje común) ──
    const hasMin = min !== null
    const hasMax = max !== null
    let axisMax
    if (hasMax)      axisMax = Math.max(max * 1.2, gen * 1.06, (genProy || 0) * 1.06)
    else if (hasMin) axisMax = Math.max(min * 1.4, gen * 1.1, (genProy || 0) * 1.1)
    else             axisMax = Math.max(gen, genProy || 0, 1) * 1.1
    const clampPct = v => Math.max(0, Math.min(100, (v / axisMax) * 100))
    const bullet = {
      hasMin, hasMax,
      hasZones: hasMin || hasMax,
      minPct: hasMin ? clampPct(min) : 0,
      maxPct: hasMax ? clampPct(max) : 100,
      measurePct: clampPct(gen),
      // Tramo de "compra en bolsa" DENTRO de la barra entregada (al final): de
      // (gen - genDup) hasta gen. Se pinta amarillo sobre la barra de estado.
      bolsaStartPct: genDup > 0 ? clampPct(Math.max(0, gen - genDup)) : null,
      dupW: genDup > 0 ? Math.max(0, clampPct(gen) - clampPct(Math.max(0, gen - genDup))) : 0,
      proyPct: (esActual && genProy > 0) ? clampPct(genProy) : null,
    }

    // ── Cumplimiento de plantas: plantas INSCRITAS = registradas y despachando vía GESCON (numerador) vs PLANTAS CONTRATO exigidas (denominador) ──
    const plantasEsp = c.plantas_esperadas ?? null
    const plantasReg = plantas.length
    let estadoPlantas = 'sin_compromisos'
    if (plantasEsp !== null) {
      if (plantasReg < plantasEsp) estadoPlantas = 'deficit'
      else if (plantasReg > plantasEsp) estadoPlantas = 'excedente'
      else estadoPlantas = 'ok'
    }
    // Barra: si aún no hay meta inscrita (0), llena al 100% cuando ya hay plantas registradas y 0 si no.
    const plantasPct = plantasEsp != null
      ? (plantasEsp > 0 ? Math.min(100, (plantasReg / plantasEsp) * 100) : (plantasReg > 0 ? 100 : 0))
      : null

    // Estado para filtrar: la proyección de cierre cuando existe (mes en curso),
    // si no, el estado real (meses ya cerrados o sin proyección disponible).
    const estadoEfectivo = (esActual && genProy > 0 && estadoProy !== 'sin_compromisos')
      ? estadoProy : estado

    out[c.id] = {
      gen: Math.round(gen * 10) / 10,
      genDup: Math.round(genDup * 10) / 10,
      tieneDup: genDup > 0,
      genProy: esActual ? Math.round(genProy * 10) / 10 : null,
      estado, estadoProy, estadoEfectivo, pct, dupPct, proyPct, min, max,
      diaActual: diaAct, diasRestantes: diasRest, bullet,
      plantasReg, plantasEsp, estadoPlantas, plantasPct,
    }
  }
  return out
})

// ── Simulador drag-and-drop ───────────────────────────────────────────────────
function initAssignments(data) {
  const proyMap = Object.fromEntries(backendProyectos.value.map(p => [p.id, p]))
  const a = { none: [] }
  for (const c of data.contratos) a[c.id] = []
  for (const p of data.plantas) {
    const proy = proyMap[p.id]
    if (proy && !proyectoActivoEnMes(proy, simYear.value, simMonth.value)) continue
    const key = p.contrato_id ?? 'none'
    if (!a[key]) a[key] = []
    a[key].push({ ...p })
  }
  simAssignments.value = a
}

function resetSim() {
  if (simData.value) initAssignments(simData.value)
  ficticioContratos.value = []
  hiddenContratos.value = new Set()
  expandedContratos.value = []
}

function crearNuevo() {
  if (!ficticioNombre.value || ficticioMax.value <= 0) return
  const id = `__ficticio_${ficticioNextId++}`
  const contrato = {
    id,
    nombre: ficticioNombre.value.trim(),
    comprador_nombre: 'Simulado',
    min_mwh: ficticioMin.value || 0,
    max_mwh: ficticioMax.value,
    _ficticio: true,
  }
  ficticioContratos.value = [...ficticioContratos.value, contrato]
  simAssignments.value[id] = []
  ficticioNombre.value = ''
  ficticioMin.value = 0
  ficticioMax.value = 0
  showNuevoForm.value = false
}

function eliminarNuevo(contratoId) {
  const plantas = simAssignments.value[contratoId] || []
  if (plantas.length) {
    if (!simAssignments.value['none']) simAssignments.value['none'] = []
    simAssignments.value['none'].push(...plantas)
  }
  delete simAssignments.value[contratoId]
  ficticioContratos.value = ficticioContratos.value.filter(c => c.id !== contratoId)
  hiddenContratos.value = new Set([...hiddenContratos.value].filter(id => id !== contratoId))
}

function toggleExpand(contratoId) {
  const idx = expandedContratos.value.indexOf(contratoId)
  if (idx >= 0) expandedContratos.value.splice(idx, 1)
  else expandedContratos.value.push(contratoId)
}

function hideContrato(contratoId) {
  hiddenContratos.value = new Set([...hiddenContratos.value, contratoId])
}

function showAllContratos() {
  hiddenContratos.value = new Set()
}

function onDragOver(contratoId) {
  dragOver.value = contratoId
  if (!expandedContratos.value.includes(contratoId)) {
    expandedContratos.value.push(contratoId)
  }
}

function onDragStart(planta, fromContratoId) {
  dragPlanta.value = { ...planta }
  dragFromContrato.value = fromContratoId ?? 'none'
}

function onDragEnd() {
  dragPlanta.value = null
  dragFromContrato.value = undefined
  dragOver.value = null
}

function onDrop(toContratoId) {
  if (!dragPlanta.value) return
  const from = dragFromContrato.value
  const to   = toContratoId ?? 'none'
  if (from === to) { dragOver.value = null; return }

  const fromList = simAssignments.value[from]
  if (fromList) {
    const idx = fromList.findIndex(p => p.id === dragPlanta.value.id)
    if (idx >= 0) fromList.splice(idx, 1)
  }
  if (!simAssignments.value[to]) simAssignments.value[to] = []
  simAssignments.value[to].push({ ...dragPlanta.value })

  dragPlanta.value = null
  dragFromContrato.value = undefined
  dragOver.value = null
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtMwh(val) {
  if (val === null || val === undefined) return '—'
  return val.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh'
}
function fmtShort(val) {
  if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(val).toString()
}
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  return `${MESES_CORTOS[parseInt(m) - 1]} ${y}`
}
function fmtFechaDia(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES_CORTOS[parseInt(m) - 1].toLowerCase()} ${y}`
}
// Ventana de la modalidad Venta en Bolsa (UNGC): fecha_inicio del registro SIC
// y fecha_fin EFECTIVA (recortada por relevos) que envía el backend.
function ventanaBolsa(p) {
  // Sin registro SIC con fechas, la ventana que aplica es el tramo del mes.
  if (!p.fecha_inicio && !p.fecha_fin && p.segmento_inicio) {
    return filaTerminada(p)
      ? `En bolsa UNGC del ${fmtFechaDia(p.segmento_inicio)} al ${fmtFechaDia(p.segmento_fin)}`
      : `En bolsa UNGC desde ${fmtFechaDia(p.segmento_inicio)} · vigente`
  }
  if (!p.fecha_inicio && !p.fecha_fin) return ''
  if (!p.fecha_fin) return `En bolsa UNGC desde ${fmtFechaDia(p.fecha_inicio)} · vigente`
  if (!p.fecha_inicio) return `En bolsa UNGC hasta ${fmtFechaDia(p.fecha_fin)}`
  return `En bolsa UNGC del ${fmtFechaDia(p.fecha_inicio)} al ${fmtFechaDia(p.fecha_fin)}`
}

// ── Historial intra-mes (backend: segmento_inicio/segmento_fin/estado) ───────
// Una planta que cambió de modalidad a mitad de mes se lista en TODAS las
// piscinas por las que pasó. Las filas cuyo tramo ya terminó van en rojo; las
// vigentes en color normal. Los contadores solo cuentan las vigentes.
const ROJO_FIN = '#D64455'

function filaTerminada(p) {
  return p?.estado === 'terminado'
}

// Clave única: la misma planta puede tener dos tramos en el mismo mes
// (p. ej. libre 1→9, contrato 10→20, libre 21→31).
function filaKey(p) {
  return p?.segmento_inicio ? `${p.id}-${p.segmento_inicio}` : p?.id
}

function filaColorNombre(p) {
  return filaTerminada(p) ? `color: ${ROJO_FIN};` : 'color: #2C2039;'
}

function filaColorFecha(p) {
  if (filaTerminada(p)) return `color: ${ROJO_FIN}; font-weight: 600;`
  return p?.fecha_fin && isExpiringSoon(p.fecha_fin) ? `color: ${ROJO_FIN}; font-weight: 600;` : ''
}

// Ventana a mostrar. Prioriza la ventana real (contrato / registro SIC); para
// los tramos de bolsa libre, que no tienen registro, usa el tramo del mes.
function ventanaFila(p) {
  if (!p) return ''
  const ini = p.fecha_inicio || p.segmento_inicio || null
  const fin = p.fecha_fin || (filaTerminada(p) ? p.segmento_fin : null) || null
  if (!ini && !fin) return ''
  if (ini && !fin) return `desde ${ini}`
  if (!ini && fin) return `hasta ${fin}`
  return `${ini} → ${fin}`
}

// ── Helpers de barras de cumplimiento (simulador) ─────────────────────────────
function estadoColor(estado) {
  return estado === 'ok'        ? '#2e7d32'
       : estado === 'deficit'   ? '#D64455'
       : estado === 'excedente' ? '#14B8A6'
       : '#b0a0c0'
}
function estadoBadge(estado) {
  return estado === 'ok'        ? 'background: rgba(46,125,50,0.12); color: #2e7d32;'
       : estado === 'deficit'   ? 'background: rgba(214,68,85,0.12); color: #D64455;'
       : estado === 'excedente' ? 'background: rgba(20,184,166,0.16); color: #0F766E;'
       : 'background: rgba(44,32,57,0.06); color: #7a6e8a;'
}
function estadoLabel(estado) {
  return estado === 'ok'        ? '✓ OK'
       : estado === 'deficit'   ? '↓ Déficit'
       : estado === 'excedente' ? '↑ Excedente'
       : '— Sin datos'
}

// ── Copiar imagen de una capa (contrato + sus proyectos) ──────────────────────
// Renderiza la capa a un PNG con Canvas (sin dependencias) y lo copia al
// portapapeles. Si el navegador no permite escribir imágenes al portapapeles,
// cae a descargar el PNG. Muestra el total de proyectos del contrato y las
// cantidades (energía por planta + agregados).
const copiadoCapaId = ref(null)

// ── Panel flotante "ver detalle de la capa" (misma info que la imagen) ────────
const detalleCapaId = ref(null)
const esMesActualSim = computed(() => !!(simData.value && simData.value.es_mes_actual))
const periodoSimLabel = computed(() => `${MESES[simMonth.value - 1]} ${simYear.value}`)

function abrirDetalleCapa(c) { detalleCapaId.value = c.id }
function cerrarDetalleCapa() { detalleCapaId.value = null }

const detalleCapa = computed(() => {
  if (detalleCapaId.value == null) return null
  const c = allContratos.value.find(x => x.id === detalleCapaId.value)
  if (!c) return null
  return { c, plantas: simAssignments.value[c.id] || [], res: simResults.value[c.id] || {} }
})

// Proyección de cierre del mes por planta (mes en curso; incluye duplicados,
// porque la compra en bolsa también cubre el contrato).
function plantaProyMwh(p) {
  return (esMesActualSim.value && p.month_mwh_proyectado != null)
    ? p.month_mwh_proyectado * p.pct_despacho
    : null
}

// Veredicto de riesgo / probabilidad (proyección vs mínimo) — espeja la imagen
function veredictoCapa(res) {
  const minDef = res.min != null
  const proyOk = esMesActualSim.value && res.genProy != null && res.genProy > 0
  if (minDef && proyOk) {
    if (res.genProy >= res.min) {
      return { icon: CircleCheckIcon, txt: 'Probabilidad de cumplimiento alta',
        sub: `Proyección ${fmtMwh(res.genProy)} ≥ mínimo ${fmtMwh(res.min)}`,
        bg: 'rgba(46,125,50,0.10)', fg: '#2e7d32' }
    }
    return { icon: TriangleAlertIcon, txt: 'Riesgo de incumplimiento',
      sub: `Proyección ${fmtMwh(res.genProy)} < mínimo ${fmtMwh(res.min)}`,
      bg: 'rgba(214,68,85,0.10)', fg: '#D64455' }
  }
  if (minDef) {
    return { icon: CircleMinusIcon, txt: 'Sin proyección del mes para evaluar',
      sub: `Mínimo ${fmtMwh(res.min)}`, bg: 'rgba(44,32,57,0.05)', fg: '#7a6e8a' }
  }
  return { icon: CircleMinusIcon, txt: 'Contrato sin energía mínima definida',
    sub: '', bg: 'rgba(44,32,57,0.05)', fg: '#7a6e8a' }
}

function _estadoTextoPlano(estado) {
  return estado === 'ok' ? 'En rango'
       : estado === 'deficit' ? 'Déficit'
       : estado === 'excedente' ? 'Excedente'
       : 'Sin datos'
}

function _truncarTexto(ctx, texto, maxW) {
  if (ctx.measureText(texto).width <= maxW) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function _dibujarPill(ctx, x, y, texto, bg, fg, font) {
  ctx.font = font
  const padX = 9, h = 21
  const w = ctx.measureText(texto).width + padX * 2
  const r = h / 2
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, x + padX, y + h / 2 + 0.5)
  return w
}

function _renderCapaCanvas(c) {
  const plantas = simAssignments.value[c.id] || []
  const res = simResults.value[c.id] || {}
  const esActual = !!(simData.value && simData.value.es_mes_actual)

  const DARK = '#2C2039', GREY = '#7a6e8a', PURPLE = '#915BD8'
  const RED = '#D64455', GOLD = '#9a6700'
  const scale = 2
  const W = 880, padX = 36
  const headerH = 156, tableHeadH = 32, rowH = 36, totalH = 52, riskH = 56, footerH = 50
  const bodyTop = headerH + tableHeadH
  const H = bodyTop + Math.max(plantas.length, 1) * rowH + totalH + riskH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  // Fondo + barra de acento
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = PURPLE
  ctx.fillRect(0, 0, W, 6)

  // ── Header: nombre + comprador ──
  ctx.fillStyle = DARK
  ctx.font = 'bold 23px Inter, Arial, sans-serif'
  ctx.fillText(_truncarTexto(ctx, c.nombre || 'Contrato', W - padX * 2 - 150), padX, 44)
  ctx.fillStyle = GREY
  ctx.font = '13px Inter, Arial, sans-serif'
  ctx.fillText(_truncarTexto(ctx, c.comprador_nombre || '', W - padX * 2 - 150), padX, 64)
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 11px Inter, Arial, sans-serif'
  ctx.fillText(`Período de consulta: ${MESES[simMonth.value - 1]} ${simYear.value}`, padX, 84)

  // Pills estado + % (arriba a la derecha)
  const estado = res.estado || 'sin_compromisos'
  const badgeBg = estado === 'ok' ? 'rgba(46,125,50,0.12)' : estado === 'deficit' ? 'rgba(214,68,85,0.12)'
                : estado === 'excedente' ? 'rgba(20,184,166,0.16)' : 'rgba(44,32,57,0.06)'
  const badgeFg = estado === 'ok' ? '#2e7d32' : estado === 'deficit' ? RED
                : estado === 'excedente' ? '#0F766E' : GREY
  ctx.textBaseline = 'middle'
  const pctTxt = (res.pct !== null && res.pct !== undefined) ? Math.round(res.pct) + '%' : null
  let pillX = W - padX
  const f = 'bold 12px Inter, Arial, sans-serif'
  // se dibujan de derecha a izquierda
  if (pctTxt) {
    ctx.font = f
    const w = ctx.measureText(pctTxt).width + 18
    pillX -= w
    _dibujarPill(ctx, pillX, 32, pctTxt, badgeBg, badgeFg, f)
    pillX -= 8
  }
  {
    const lbl = _estadoTextoPlano(estado)
    ctx.font = f
    const w = ctx.measureText(lbl).width + 18
    pillX -= w
    _dibujarPill(ctx, pillX, 32, lbl, badgeBg, badgeFg, f)
  }
  ctx.textBaseline = 'alphabetic'

  // ── Métricas (energía duplicada se suma como 4ª columna si aplica) ──
  const metrics = [
    ['ENERGÍA ENTREGADA', fmtMwh(res.gen), DARK],
    ['ENERGÍA MÍNIMA', res.min !== null && res.min !== undefined ? fmtMwh(res.min) : '—', DARK],
    ['ENERGÍA PROYECTADA', (res.genProy != null && res.genProy > 0) ? fmtMwh(res.genProy) : '—', DARK],
  ]
  if (res.genDup > 0) metrics.push(['COMPRA EN BOLSA', fmtMwh(res.genDup), GOLD])
  const colW = (W - padX * 2) / metrics.length
  metrics.forEach(([lbl, val, valColor], i) => {
    const x = padX + i * colW
    ctx.fillStyle = valColor === DARK ? GREY : valColor
    ctx.font = 'bold 9px Inter, Arial, sans-serif'
    ctx.fillText(lbl, x, 100)
    ctx.fillStyle = valColor
    ctx.font = 'bold 16px Inter, Arial, sans-serif'
    ctx.fillText(val, x, 120)
  })

  // Línea divisoria + "N proyectos"
  ctx.strokeStyle = 'rgba(44,32,57,0.10)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(padX, 138); ctx.lineTo(W - padX, 138); ctx.stroke()
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 12px Inter, Arial, sans-serif'
  ctx.fillText(`${plantas.length} proyecto${plantas.length === 1 ? '' : 's'} en el contrato`, padX, headerH - 4)

  // ── Cabecera de tabla ──
  const colProyR = W - padX            // proyección cierre del mes (derecha)
  const colEneR  = W - padX - 200      // energía generada
  const colPctR  = W - padX - 360      // % despacho
  const yHead = headerH + 20
  ctx.fillStyle = GREY
  ctx.font = 'bold 10px Inter, Arial, sans-serif'
  ctx.fillText('PROYECTO', padX, yHead)
  ctx.textAlign = 'right'
  ctx.fillText('% DESPACHO', colPctR, yHead)
  ctx.font = 'bold 9px Inter, Arial, sans-serif'
  ctx.fillText('ENERGÍA GENERADA', colEneR, yHead)
  ctx.fillText('PROYECCIÓN CIERRE DEL MES', colProyR, yHead)
  ctx.textAlign = 'left'

  // ── Filas de proyectos ──
  if (!plantas.length) {
    ctx.fillStyle = 'rgba(44,32,57,0.35)'
    ctx.font = 'italic 13px Inter, Arial, sans-serif'
    ctx.fillText('Sin proyectos asignados', padX, bodyTop + 24)
  }
  plantas.forEach((p, i) => {
    const yTop = bodyTop + i * rowH
    const yMid = yTop + rowH / 2
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(145,91,216,0.04)'
      ctx.fillRect(padX - 8, yTop, W - padX * 2 + 16, rowH)
    }
    const mwh = p.month_mwh != null ? p.month_mwh * p.pct_despacho : null
    const colName = p.es_duplicado ? GOLD : p.comprado_por_unergy ? GOLD : DARK
    ctx.textBaseline = 'middle'
    // Nombre
    ctx.fillStyle = colName
    ctx.font = '600 13px Inter, Arial, sans-serif'
    let nameMaxW = colPctR - padX - 90
    const nombre = _truncarTexto(ctx, p.nombre || `Proyecto ${p.id}`, nameMaxW)
    ctx.fillText(nombre, padX, yMid)
    // Tag duplicado / compra
    const nx = padX + ctx.measureText(nombre).width + 8
    if (p.es_duplicado && !p.comprado_por_unergy) {
      _dibujarPill(ctx, nx, yMid - 9, 'Compra bolsa', 'rgba(240,192,64,0.22)', GOLD, 'bold 10px Inter, Arial, sans-serif')
    } else if (p.comprado_por_unergy) {
      _dibujarPill(ctx, nx, yMid - 9, 'Compra', 'rgba(240,192,64,0.25)', GOLD, 'bold 10px Inter, Arial, sans-serif')
    }
    // % despacho
    ctx.textAlign = 'right'
    ctx.fillStyle = GREY
    ctx.font = '12px Inter, Arial, sans-serif'
    ctx.fillText((p.pct_despacho * 100).toFixed(0) + '%', colPctR, yMid)
    // Energía generada
    ctx.fillStyle = colName
    ctx.font = 'bold 13px Inter, Arial, sans-serif'
    ctx.fillText(mwh != null ? fmtMwh(mwh) : '—', colEneR, yMid)
    // Proyección cierre del mes (mes en curso; incluye duplicados — bolsa también cubre)
    const mwhProy = (esActual && p.month_mwh_proyectado != null)
      ? p.month_mwh_proyectado * p.pct_despacho : null
    if (mwhProy != null) {
      ctx.fillStyle = PURPLE
      ctx.font = 'bold 13px Inter, Arial, sans-serif'
      ctx.fillText('◆ ' + fmtMwh(mwhProy), colProyR, yMid)
    } else {
      ctx.fillStyle = 'rgba(44,32,57,0.3)'
      ctx.font = '13px Inter, Arial, sans-serif'
      ctx.fillText('—', colProyR, yMid)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })

  // ── Fila total ──
  const yTotalTop = bodyTop + Math.max(plantas.length, 1) * rowH + 6
  ctx.strokeStyle = 'rgba(44,32,57,0.14)'
  ctx.beginPath(); ctx.moveTo(padX, yTotalTop); ctx.lineTo(W - padX, yTotalTop); ctx.stroke()
  const yTotalMid = yTotalTop + totalH / 2
  ctx.textBaseline = 'middle'
  ctx.fillStyle = DARK
  ctx.font = 'bold 14px Inter, Arial, sans-serif'
  ctx.fillText(`Total · ${plantas.length} proyecto${plantas.length === 1 ? '' : 's'}`, padX, yTotalMid)
  ctx.textAlign = 'right'
  // Total energía generada
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 16px Inter, Arial, sans-serif'
  ctx.fillText(fmtMwh(res.gen), colEneR, yTotalMid)
  if (res.genDup > 0) {
    ctx.fillStyle = GOLD
    ctx.font = 'bold 11px Inter, Arial, sans-serif'
    ctx.fillText(`de ello, ${fmtMwh(res.genDup)} compra en bolsa`, colEneR, yTotalMid + 17)
  }
  // Total proyección cierre del mes
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 16px Inter, Arial, sans-serif'
  const totalProy = (esActual && res.genProy != null && res.genProy > 0) ? fmtMwh(res.genProy) : '—'
  ctx.fillText(totalProy, colProyR, yTotalMid)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // ── Veredicto: riesgo / probabilidad de cumplimiento (proyección vs mínimo) ──
  const yRiskTop = bodyTop + Math.max(plantas.length, 1) * rowH + totalH
  const minDef = res.min != null
  const proyOk = esActual && res.genProy != null && res.genProy > 0
  let riskBg, riskFg, riskIcon, riskTxt, riskSub
  if (minDef && proyOk) {
    if (res.genProy >= res.min) {
      riskBg = 'rgba(46,125,50,0.10)'; riskFg = '#2e7d32'; riskIcon = '✓'
      riskTxt = 'Probabilidad de cumplimiento alta'
      riskSub = `Proyección ${fmtMwh(res.genProy)} ≥ mínimo ${fmtMwh(res.min)}`
    } else {
      riskBg = 'rgba(214,68,85,0.10)'; riskFg = RED; riskIcon = '⚠'
      riskTxt = 'Riesgo de incumplimiento'
      riskSub = `Proyección ${fmtMwh(res.genProy)} < mínimo ${fmtMwh(res.min)}`
    }
  } else if (minDef) {
    riskBg = 'rgba(44,32,57,0.05)'; riskFg = GREY; riskIcon = '•'
    riskTxt = 'Sin proyección del mes para evaluar'
    riskSub = `Mínimo ${fmtMwh(res.min)}`
  } else {
    riskBg = 'rgba(44,32,57,0.05)'; riskFg = GREY; riskIcon = '•'
    riskTxt = 'Contrato sin energía mínima definida'
    riskSub = ''
  }
  ctx.fillStyle = riskBg
  ctx.beginPath(); ctx.roundRect(padX, yRiskTop + 6, W - padX * 2, riskH - 12, 10); ctx.fill()
  ctx.textBaseline = 'middle'
  const yRiskMid = yRiskTop + riskH / 2
  ctx.fillStyle = riskFg
  ctx.font = 'bold 15px Inter, Arial, sans-serif'
  ctx.fillText(`${riskIcon}  ${riskTxt}`, padX + 16, yRiskMid - (riskSub ? 8 : 0))
  if (riskSub) {
    ctx.font = '11px Inter, Arial, sans-serif'
    ctx.fillText(riskSub, padX + 16, yRiskMid + 10)
  }
  ctx.textBaseline = 'alphabetic'

  // ── Footer ──
  ctx.fillStyle = '#faf8fc'
  ctx.fillRect(0, H - footerH, W, footerH)
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 12px Inter, Arial, sans-serif'
  ctx.fillText('Unergy', padX, H - footerH / 2 + 1)
  ctx.fillStyle = GREY
  ctx.font = '11px Inter, Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Cumplimiento PPA', padX + 58, H - footerH / 2 + 1)
  ctx.textAlign = 'right'
  ctx.fillText(`${MESES[simMonth.value - 1]} ${simYear.value}`, W - padX, H - footerH / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return canvas
}

async function copiarImagenCapa(c) {
  let canvas
  try {
    canvas = _renderCapaCanvas(c)
  } catch (e) {
    logger.error('mem', e)
    return
  }
  canvas.toBlob(async (blob) => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      copiadoCapaId.value = c.id
      setTimeout(() => { if (copiadoCapaId.value === c.id) copiadoCapaId.value = null }, 2200)
    } catch (e) {
      // Fallback: el navegador no permite escribir imágenes al portapapeles → descargar
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `capa-${(c.nombre || 'contrato').replace(/[^\w-]+/g, '_')}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  }, 'image/png')
}

// ── Copiar imagen de un contrato de venta (tab Proyectos → modo Venta) ────────
// Mismo mecanismo que copiarImagenCapa: Canvas → PNG → portapapeles, con
// fallback a descarga si el navegador no permite escribir imágenes.
const copiadoVentaId = ref(null)

function _renderVentaCanvas(c) {
  const plantas = c.plantas || []
  const DARK = '#2C2039', GREY = '#7a6e8a', PURPLE = '#915BD8', GOLD = '#9a6700'
  const scale = 2
  const W = 760, padX = 36
  const headerH = 96, tableHeadH = 30, rowH = 34, footerH = 46
  const bodyTop = headerH + tableHeadH
  const H = bodyTop + Math.max(plantas.length, 1) * rowH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  // Fondo + barra de acento
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = PURPLE
  ctx.fillRect(0, 0, W, 6)

  // ── Header: nombre + comprador ──
  ctx.fillStyle = DARK
  ctx.font = 'bold 21px Inter, Arial, sans-serif'
  ctx.fillText(_truncarTexto(ctx, c.nombre || 'Contrato', W - padX * 2 - 130), padX, 42)
  ctx.fillStyle = GREY
  ctx.font = '13px Inter, Arial, sans-serif'
  ctx.fillText(_truncarTexto(ctx, c.comprador_nombre || '', W - padX * 2 - 130), padX, 62)
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 11px Inter, Arial, sans-serif'
  ctx.fillText(`Período de consulta: ${MESES[pcMonth.value - 1]} ${pcYear.value}`, padX, 80)

  // Pill "N plantas" arriba a la derecha
  ctx.textBaseline = 'middle'
  const pillTxt = `${plantas.length} planta${plantas.length === 1 ? '' : 's'}`
  const f = 'bold 12px Inter, Arial, sans-serif'
  ctx.font = f
  const pillW = ctx.measureText(pillTxt).width + 18
  _dibujarPill(ctx, W - padX - pillW, 30, pillTxt, 'rgba(145,91,216,0.12)', PURPLE, f)
  ctx.textBaseline = 'alphabetic'

  // ── Cabecera de tabla ──
  const colVigR = W - padX
  const colPctR = W - padX - 150
  const colSicR = W - padX - 260
  const yHead = headerH + 20
  ctx.fillStyle = GREY
  ctx.font = 'bold 10px Inter, Arial, sans-serif'
  ctx.fillText('PROYECTO', padX, yHead)
  ctx.textAlign = 'right'
  ctx.fillText('CÓDIGO SIC', colSicR, yHead)
  ctx.fillText('% DESPACHO', colPctR, yHead)
  ctx.fillText('VIGENCIA', colVigR, yHead)
  ctx.textAlign = 'left'

  // ── Filas de plantas ──
  if (!plantas.length) {
    ctx.fillStyle = 'rgba(44,32,57,0.35)'
    ctx.font = 'italic 13px Inter, Arial, sans-serif'
    ctx.fillText(`Sin plantas asignadas en GESCON para ${MESES[pcMonth.value - 1]} ${pcYear.value}`, padX, bodyTop + 24)
  }
  plantas.forEach((p, i) => {
    const yTop = bodyTop + i * rowH
    const yMid = yTop + rowH / 2
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(145,91,216,0.04)'
      ctx.fillRect(padX - 8, yTop, W - padX * 2 + 16, rowH)
    }
    ctx.textBaseline = 'middle'
    // Nombre + tag duplicado
    ctx.fillStyle = p.es_duplicado ? GOLD : DARK
    ctx.font = '600 13px Inter, Arial, sans-serif'
    const nameMaxW = colSicR - padX - (p.es_duplicado ? 190 : 100)
    const nombre = _truncarTexto(ctx, p.nombre || `Proyecto ${p.id}`, nameMaxW)
    ctx.fillText(nombre, padX, yMid)
    if (p.es_duplicado) {
      const nx = padX + ctx.measureText(nombre).width + 8
      _dibujarPill(ctx, nx, yMid - 9, 'Compra bolsa', 'rgba(240,192,64,0.22)', GOLD, 'bold 10px Inter, Arial, sans-serif')
    }
    // Código SIC
    ctx.textAlign = 'right'
    ctx.fillStyle = GREY
    ctx.font = '12px Inter, Arial, sans-serif'
    ctx.fillText(p.codigo_sic || '—', colSicR, yMid)
    // % despacho
    ctx.fillStyle = PURPLE
    ctx.font = 'bold 12px Inter, Arial, sans-serif'
    ctx.fillText(p.pct_despacho != null ? (p.pct_despacho * 100).toFixed(0) + '%' : '—', colPctR, yMid)
    // Vigencia (rojo si vence pronto)
    const vigencia = (p.fecha_inicio || p.fecha_fin) ? `${p.fecha_inicio || '—'} → ${p.fecha_fin || '—'}` : '—'
    const vence = p.fecha_fin && isExpiringSoon(p.fecha_fin)
    ctx.fillStyle = vence ? '#D64455' : GREY
    ctx.font = (vence ? 'bold ' : '') + '12px Inter, Arial, sans-serif'
    ctx.fillText(vigencia, colVigR, yMid)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })

  // ── Footer ──
  ctx.fillStyle = '#faf8fc'
  ctx.fillRect(0, H - footerH, W, footerH)
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 12px Inter, Arial, sans-serif'
  ctx.fillText('Unergy', padX, H - footerH / 2 + 1)
  ctx.fillStyle = GREY
  ctx.font = '11px Inter, Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Plantas y contratos · Venta', padX + 58, H - footerH / 2 + 1)
  ctx.textAlign = 'right'
  ctx.fillText(`${MESES[pcMonth.value - 1]} ${pcYear.value}`, W - padX, H - footerH / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return canvas
}

async function copiarImagenVenta(c) {
  let canvas
  try {
    canvas = _renderVentaCanvas(c)
  } catch (e) {
    logger.error('mem', e)
    return
  }
  canvas.toBlob(async (blob) => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      copiadoVentaId.value = c.id
      setTimeout(() => { if (copiadoVentaId.value === c.id) copiadoVentaId.value = null }, 2200)
    } catch (e) {
      // Fallback: el navegador no permite escribir imágenes al portapapeles → descargar
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `venta-${(c.nombre || 'contrato').replace(/[^\w-]+/g, '_')}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  }, 'image/png')
}

// ── Data loading ──────────────────────────────────────────────────────────────
const CONSOLIDADO_ID = '__consolidado__'

async function loadContratos() {
  try {
    const res = await cumplimientoService.listarPpa({ incluir_todos: incluirTodos() })
    const mapped = res.map(c => ({
      ...c,
      label: c.nombre_interno || c.numero_codigo_contrato || `Contrato ${c.id}`,
    }))
    contratos.value = [
      { id: CONSOLIDADO_ID, label: '📊 Consolidado (todos)' },
      ...mapped,
    ]
    if (mapped.length > 0) {
      selectedContratoId.value = CONSOLIDADO_ID
    }
  } catch (e) {
    logger.error('mem', e)
  }
}

async function loadAnnualData() {
  if (!selectedContratoId.value) return
  chartLoading.value = true
  chartError.value   = null
  anualData.value    = null
  hovered.value      = null
  selectedMonthIdx.value = null
  try {
    if (selectedContratoId.value === CONSOLIDADO_ID) {
      await loadConsolidado()
    } else {
      anualData.value = await cachedGet(
        `/cumplimiento/ppa/${selectedContratoId.value}/anual`,
        { year: selectedYear.value },
        () => cumplimientoService.obtenerAnualPorContrato(selectedContratoId.value, { year: selectedYear.value }),
      )
    }
    updateCacheSize()
  } catch (e) {
    chartError.value = e.data?.detail || 'Error al cargar los datos anuales.'
  } finally {
    chartLoading.value = false
  }
}

async function loadConsolidado() {
  const realContratos = contratos.value.filter(c => c.id !== CONSOLIDADO_ID)
  if (!realContratos.length) return

  const results = await Promise.allSettled(
    realContratos.map(c =>
      cachedGet(
        `/cumplimiento/ppa/${c.id}/anual`,
        { year: selectedYear.value },
        () => cumplimientoService.obtenerAnualPorContrato(c.id, { year: selectedYear.value }),
      )
    )
  )
  updateCacheSize()

  const successful = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)

  if (!successful.length) {
    chartError.value = 'No se pudo cargar ningún contrato.'
    return
  }

  const meses = []
  for (let i = 0; i < 12; i++) {
    let totalGen = 0, totalProy = null, totalCierre = null, totalMin = 0, totalMax = 0
    let hasMin = false, hasMax = false, totalBolsaDup = 0
    let diaActual = null, diasRestantes = null
    const allPlantas = []

    for (const data of successful) {
      const mes = data.meses[i]
      totalGen += mes.gen_mwh || 0
      if (mes.gen_proyectada_mwh !== null && mes.gen_proyectada_mwh !== undefined) {
        totalProy = (totalProy || 0) + mes.gen_proyectada_mwh
      }
      if (mes.gen_proyectada_cierre !== null && mes.gen_proyectada_cierre !== undefined) {
        totalCierre = (totalCierre || 0) + mes.gen_proyectada_cierre
      }
      if (mes.min_mwh !== null) { totalMin += mes.min_mwh; hasMin = true }
      if (mes.max_mwh !== null) { totalMax += mes.max_mwh; hasMax = true }
      if (mes.exposicion_bolsa_duplicados_mwh) totalBolsaDup += mes.exposicion_bolsa_duplicados_mwh
      if (mes.dia_actual != null) diaActual = mes.dia_actual
      if (mes.dias_restantes != null) diasRestantes = mes.dias_restantes
      for (const p of (mes.plantas || [])) {
        allPlantas.push({
          ...p,
          contrato: data.contrato.nombre_interno || data.contrato.numero_codigo_contrato,
        })
      }
    }

    const minMwh = hasMin ? Math.round(totalMin * 1000) / 1000 : null
    const maxMwh = hasMax ? Math.round(totalMax * 1000) / 1000 : null
    const gen = Math.round(totalGen * 1000) / 1000
    const cierre = totalCierre !== null ? Math.round(totalCierre * 1000) / 1000 : null
    const val = cierre ?? (totalProy !== null ? Math.round(totalProy * 1000) / 1000 : gen)

    let estado = 'sin_compromisos', compras = null, excedentes = null
    if (minMwh !== null || maxMwh !== null) {
      const effectiveMin = minMwh ?? 0
      if (val < effectiveMin) { estado = 'deficit'; compras = Math.round((effectiveMin - val) * 1000) / 1000; excedentes = 0 }
      else if (maxMwh !== null && val > maxMwh) { estado = 'excedente'; compras = 0; excedentes = Math.round((val - maxMwh) * 1000) / 1000 }
      else { estado = 'ok'; compras = 0; excedentes = 0 }
    }

    const ref = successful[0].meses[i]
    meses.push({
      month: i + 1,
      gen_mwh: gen,
      gen_proyectada_mwh: totalProy !== null ? Math.round(totalProy * 1000) / 1000 : null,
      gen_proyectada_cierre: cierre,
      dia_actual: diaActual,
      dias_restantes: diasRestantes,
      min_mwh: minMwh,
      max_mwh: maxMwh,
      estado,
      tipo_datos: ref.tipo_datos,
      compras_bolsa_mwh: compras,
      excedentes_bolsa_mwh: excedentes,
      exposicion_bolsa_duplicados_mwh: totalBolsaDup > 0 ? Math.round(totalBolsaDup * 1000) / 1000 : null,
      plantas: allPlantas,
      n_plantas: allPlantas.length,
    })
  }

  anualData.value = {
    contrato: {
      id: CONSOLIDADO_ID,
      nombre_interno: 'Consolidado',
      numero_codigo_contrato: `${successful.length} contratos`,
      comprador_nombre: 'Todos los compradores',
    },
    year: selectedYear.value,
    meses,
  }
}

async function loadTableData() {
  tableLoading.value = true
  try {
    tableData.value = await cachedGet(
      '/cumplimiento/ppa/resumen-anual',
      { year: selectedYear.value, incluir_todos: incluirTodos() },
      () => cumplimientoService.obtenerResumenAnual({ year: selectedYear.value, incluir_todos: incluirTodos() }),
    )
    updateCacheSize()
  } catch (e) {
    logger.error('mem', e)
  } finally {
    tableLoading.value = false
  }
}

function onYearChange() { loadAnnualData(); loadTableData() }
function selectContrato(id) {
  selectedContratoId.value = id
  loadAnnualData()
}

// ── Exportar matriz anual (Excel / PDF) ────────────────────────────────────────
// Respeta el filtro activo de la pestaña Cumplimiento: un contrato puntual, o
// CONSOLIDADO_ID (todos). Reutiliza cachedGet, así que en modo consolidado el
// detalle por contrato normalmente ya está en caché (loadConsolidado lo trajo).
const exportingExcel = ref(false)
const exportingPdf   = ref(false)

async function fetchContratoAnualCached(id, year) {
  return cachedGet(
    `/cumplimiento/ppa/${id}/anual`,
    { year },
    () => cumplimientoService.obtenerAnualPorContrato(id, { year }),
  )
}

function styleAnualSheet(XLSX, ws, built) {
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  const setStyle = (r, c, s) => {
    const ref = XLSX.utils.encode_cell({ r, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = s
  }
  setStyle(0, 0, { font: { bold: true, sz: 13, color: { rgb: C.oscuro } } })
  setStyle(1, 0, { font: { bold: true, sz: 12, color: { rgb: C.morado } } })
  setStyle(2, 0, { font: { italic: true, color: { rgb: '7A6E8A' } } })

  for (let c = 0; c < built.nCols; c++) {
    setStyle(built.headerRow, c, { font: { bold: true, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.morado } }, alignment: { horizontal: 'center' } })
    setStyle(built.totalRow, c, { font: { bold: true, color: { rgb: C.oscuro } } })
  }
  setStyle(built.plantHeaderRow - 1, 0, { font: { bold: true, sz: 11, color: { rgb: C.morado } } })
  for (let c = 0; c < built.plantCols; c++) {
    setStyle(built.plantHeaderRow, c, { font: { bold: true, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.oscuro } }, alignment: { horizontal: 'center' } })
    setStyle(built.plantTotalRow, c, { font: { bold: true, color: { rgb: C.oscuro } } })
  }
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: built.nCols - 1 } },
    { s: { r: built.plantHeaderRow - 1, c: 0 }, e: { r: built.plantHeaderRow - 1, c: built.plantCols - 1 } },
  ]
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }]
}

async function exportarAnualExcel() {
  if (!anualData.value) return
  exportingExcel.value = true
  try {
    const XLSX = await import('xlsx-js-style')
    const { construirContratoAnualAOA, sheetNameSafe, slugify } = await import('./cumplimientoAnualExport.js')
    const year = selectedYear.value
    const consolidado = selectedContratoId.value === CONSOLIDADO_ID
    const wb = XLSX.utils.book_new()
    const usedNames = new Set()

    function addSheet(built, label) {
      const ws = XLSX.utils.aoa_to_sheet(built.aoa)
      styleAnualSheet(XLSX, ws, built)
      let name = sheetNameSafe(label)
      let i = 2
      while (usedNames.has(name)) { name = sheetNameSafe(`${label} ${i}`); i++ }
      usedNames.add(name)
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    if (consolidado) {
      const realContratos = contratos.value.filter(c => c.id !== CONSOLIDADO_ID)
      const builtConsolidado = construirContratoAnualAOA({
        contrato: {
          nombre_interno: 'Consolidado',
          numero_codigo_contrato: `${realContratos.length} contratos`,
          comprador_nombre: 'Todos los compradores',
        },
        year,
        meses: anualData.value.meses,
        consolidado: true,
      })
      addSheet(builtConsolidado, 'Consolidado')

      const resultados = await Promise.allSettled(realContratos.map(c => fetchContratoAnualCached(c.id, year)))
      resultados.forEach((r, i) => {
        if (r.status !== 'fulfilled') return
        const data = r.value
        const built = construirContratoAnualAOA({ contrato: data.contrato, year, meses: data.meses, consolidado: false })
        addSheet(built, data.contrato.nombre_interno || data.contrato.numero_codigo_contrato || `Contrato ${realContratos[i].id}`)
      })
    } else {
      const built = construirContratoAnualAOA({ contrato: anualData.value.contrato, year, meses: anualData.value.meses, consolidado: false })
      addSheet(built, anualData.value.contrato.nombre_interno || anualData.value.contrato.numero_codigo_contrato || 'Contrato')
    }

    const slug = consolidado ? 'consolidado' : slugify(anualData.value.contrato.nombre_interno || anualData.value.contrato.numero_codigo_contrato || 'contrato')
    XLSX.writeFile(wb, `matriz_anual_cumplimiento_${year}_${slug}.xlsx`)
  } catch (e) {
    logger.error('mem', e)
    chartError.value = 'No se pudo generar el Excel de la matriz anual.'
  } finally {
    exportingExcel.value = false
  }
}

// Rasteriza el SVG del gráfico (100% atributos inline, sin CSS externo) a PNG
// vía canvas, para poder incrustarlo en el PDF con jsPDF.addImage.
function svgElementToPngDataUrl(svgEl, w, h, scale = 2) {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', w)
    clone.setAttribute('height', h)
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0')
    bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h))
    bg.setAttribute('fill', '#FFFFFF')
    clone.insertBefore(bg, clone.firstChild)

    const xml = new XMLSerializer().serializeToString(clone)
    const svg64 = btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;base64,' + svg64
  })
}

async function exportarAnualPdf() {
  if (!anualData.value) return
  exportingPdf.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const { prepararFilasMensuales, totalizarFilasMensuales, agregarPlantasAnuales, fmtNumExport, slugify } = await import('./cumplimientoAnualExport.js')

    const svgEl = chartBox.value?.querySelector('svg')
    const chartImg = svgEl ? await svgElementToPngDataUrl(svgEl, SVG_W, SVG_H, 2).catch(() => null) : null

    const year = selectedYear.value
    const consolidado = selectedContratoId.value === CONSOLIDADO_ID
    const contrato = anualData.value.contrato
    const filas = prepararFilasMensuales(anualData.value.meses)
    const totales = totalizarFilasMensuales(filas)
    const plantas = agregarPlantasAnuales(anualData.value.meses, { incluirContrato: consolidado })

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 40

    doc.setFillColor(44, 32, 57) // #2C2039
    doc.rect(0, 0, pageW, 64, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('UNERGY', marginX, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Cumplimiento PPA · Matriz anual de cumplimiento', marginX, 47)

    let y = 90
    doc.setTextColor(44, 32, 57)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(contrato.nombre_interno || contrato.numero_codigo_contrato || 'Contrato', marginX, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(122, 110, 138)
    const infoLine = consolidado
      ? `Consolidado · ${contrato.numero_codigo_contrato || ''} · Año ${year}`
      : `Contrato ${contrato.numero_codigo_contrato || '—'} · ${contrato.comprador_nombre || '—'} · Año ${year}`
    doc.text(infoLine, marginX, y)
    y += 20

    if (chartImg) {
      const renderW = pageW - marginX * 2
      const renderH = renderW * (SVG_H / SVG_W)
      doc.addImage(chartImg, 'PNG', marginX, y, renderW, renderH)
      y += renderH + 20
    }

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Mes', 'Generación (MWh)', 'Mínimo (MWh)', 'Máximo (MWh)', 'Estado', 'Compras bolsa (MWh)', 'Excedentes (MWh)']],
      body: filas.map(f => [f.mes, fmtNumExport(f.genMwh), fmtNumExport(f.minMwh), fmtNumExport(f.maxMwh), f.estadoLabel, fmtNumExport(f.comprasBolsaMwh), fmtNumExport(f.excedentesMwh)]),
      foot: [['TOTAL', fmtNumExport(totales.genMwh), fmtNumExport(totales.minMwh), fmtNumExport(totales.maxMwh), '', fmtNumExport(totales.comprasBolsaMwh), fmtNumExport(totales.excedentesMwh)]],
      headStyles: { fillColor: [145, 91, 216], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [246, 255, 114], textColor: [44, 32, 57], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      theme: 'grid',
    })

    let y2 = doc.lastAutoTable.finalY + 24
    if (y2 > pageH - 140) { doc.addPage(); y2 = 40 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(44, 32, 57)
    doc.text(`Plantas participantes (${plantas.length})`, marginX, y2)

    const plantHead = consolidado
      ? ['Planta', 'Contrato', '% Despacho', 'Generación aportada (MWh)']
      : ['Planta', '% Despacho', 'Generación aportada (MWh)']
    const plantBody = plantas.map(p => consolidado
      ? [p.nombre, p.contrato, p.pctDespacho != null ? Math.round(p.pctDespacho * 100) + '%' : '—', fmtNumExport(p.genAportadaMwh)]
      : [p.nombre, p.pctDespacho != null ? Math.round(p.pctDespacho * 100) + '%' : '—', fmtNumExport(p.genAportadaMwh)])

    autoTable(doc, {
      startY: y2 + 10,
      margin: { left: marginX, right: marginX },
      head: [plantHead],
      body: plantBody,
      headStyles: { fillColor: [44, 32, 57], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      theme: 'grid',
    })

    const pageCount = doc.internal.getNumberOfPages()
    const fechaGen = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Generado el ${fechaGen} · Unergy`, marginX, pageH - 20)
      doc.text(`Página ${p} de ${pageCount}`, pageW - marginX - 60, pageH - 20)
    }

    const slug = consolidado ? 'consolidado' : slugify(contrato.nombre_interno || contrato.numero_codigo_contrato || 'contrato')
    doc.save(`matriz_anual_cumplimiento_${year}_${slug}.pdf`)
  } catch (e) {
    logger.error('mem', e)
    chartError.value = 'No se pudo generar el PDF de la matriz anual.'
  } finally {
    exportingPdf.value = false
  }
}

async function loadSimulator(retry = true) {
  simLoading.value = true
  simError.value   = null
  try {
    const filtros = { year: simYear.value, month: simMonth.value, incluir_todos: incluirTodos() }
    const data = await cachedGet(
      '/cumplimiento/simulador',
      filtros,
      () => cumplimientoService.obtenerSimulador(filtros),
    )
    simData.value = data
    initAssignments(data)
    updateCacheSize()
  } catch (e) {
    if (retry && (!isAirError(e) || e.status >= 500)) {
      logger.error('mem', e)
      return loadSimulator(false)
    }
    const detail = isAirError(e) ? e.data?.detail : undefined
    const status = isAirError(e) ? e.status : undefined
    simError.value = detail
      || (status === 401 ? 'Sesión expirada — inicia sesión de nuevo.'
         : status === 503 ? 'API de generación no disponible temporalmente. Intenta en unos minutos.'
         : e.name === 'TimeoutError' ? 'Tiempo de espera agotado — el servidor tardó demasiado.'
         : 'Error al cargar el simulador.')
  } finally {
    simLoading.value = false
  }
}

async function loadPlantasContratos() {
  pcLoading.value = true
  pcError.value   = null
  try {
    const filtros = { year: pcYear.value, month: pcMonth.value, incluir_todos: incluirTodos() }
    pcData.value = await cachedGet(
      '/cumplimiento/plantas-contratos',
      filtros,
      () => cumplimientoService.obtenerPlantasContratos(filtros),
    )
    updateCacheSize()
  } catch (e) {
    pcError.value = e.data?.detail || 'Error al cargar plantas y contratos.'
  } finally {
    pcLoading.value = false
  }
}

// ── Revisión del mes ─────────────────────────────────────────────────────────
// Tres cosas que conviene mirar cada mes. Sale de /cumplimiento/plantas-contratos,
// la MISMA fuente de la pestaña Proyectos: no reimplementa la resolución de GESCON
// ni agrega endpoints, y si Proyectos ya cargó ese mes es un acierto de caché.
const revYear    = ref(now.getFullYear())
const revMonth   = ref(now.getMonth() + 1)
const revData    = ref(null)
const revLoading = ref(false)
const revError   = ref(null)
const revBusqueda = ref('')

// Registros GESCON crudos. Hacen falta para no llamar "sin contrato" a una
// planta que sí tiene SIC vigente: la piscina e del backend agrupa las dos
// cosas (ver revTramosLibres). null = no se pudo cruzar.
const revAsic = ref(null)
const revAsicError = ref(false)

async function loadRevision() {
  revLoading.value = true
  revError.value   = null
  try {
    const filtros = { year: revYear.value, month: revMonth.value, incluir_todos: incluirTodos() }
    revData.value = await cachedGet(
      '/cumplimiento/plantas-contratos',
      filtros,
      () => cumplimientoService.obtenerPlantasContratos(filtros),
    )
    try {
      revAsic.value = await cachedGet('/asic', {}, () => ppaService.listarAsic())
      revAsicError.value = false
    } catch {
      revAsic.value = null
      revAsicError.value = true
    }
    updateCacheSize()
  } catch (e) {
    revError.value = e.data?.detail || 'Error al cargar la revisión del mes.'
  } finally {
    revLoading.value = false
  }
}

// Registros de contrato (registro/modificación publicados) por planta. Se usa
// fecha_fin_efectiva: una versión superada por un relevo ya viene recortada, así
// que no reclama una ventana que ya no le corresponde.
const revAsicPorProyecto = computed(() => {
  const mapa = new Map()
  for (const r of revAsic.value || []) {
    if (!r.proyecto_id) continue
    if (r.estado_solicitud !== 'publicado') continue
    if (r.tipo_solicitud !== 'registro' && r.tipo_solicitud !== 'modificacion') continue
    if (!mapa.has(r.proyecto_id)) mapa.set(r.proyecto_id, [])
    mapa.get(r.proyecto_id).push(r)
  }
  return mapa
})

function revSicVigenteEnTramo(proyectoId, desde, hasta) {
  if (!revAsic.value) return null
  for (const r of revAsicPorProyecto.value.get(proyectoId) || []) {
    const ini = r.fecha_inicio
    const fin = r.fecha_fin_efectiva || r.fecha_fin
    if ((!ini || !hasta || ini <= hasta) && (!fin || !desde || fin >= desde)) return r
  }
  return null
}

function revCoincide(...campos) {
  const q = revBusqueda.value.trim().toLowerCase()
  if (!q) return true
  return campos.some(c => (c || '').toString().toLowerCase().includes(q))
}

// Solo 'compra en bolsa' cuenta como duplicación. "Uso del recurso" es otra
// figura (el cliente está en bolsa y se le paga su generación a precio bolsa,
// sin garantías) y tiene su propia sección.
function revMarca(p) {
  return p.es_duplicado ? 'Compra en bolsa' : null
}

// Las reglas de duplicación viven en cumplimientoRevision.js: son la parte que
// se puede razonar sola y ahí están documentadas y verificadas.
const revPct = aPorcentaje

// Agrupa por planta las apariciones en contratos de VENTA. Solo venta a
// propósito: una planta que además aparece en un contrato de compra UNGC es la
// MISMA energía vista desde el otro lado, no un duplicado (va en la sección 3).
const revPorPlantaVenta = computed(() => {
  const d = revData.value
  if (!d) return []
  const porPlanta = new Map()
  for (const c of d.venta || []) {
    for (const p of c.plantas || []) {
      const acc = porPlanta.get(p.id) || { id: p.id, nombre: p.nombre, apariciones: [], marcada: false }
      acc.apariciones.push({
        contrato: c.nombre,
        codigo_sic: p.codigo_sic,
        pct: p.pct_despacho,
        marca: revMarca(p),
        uso_del_recurso: !!p.uso_del_recurso,
        modalidad_pago: p.modalidad_pago || null,
        desde: p.segmento_inicio || p.fecha_inicio,
        hasta: p.segmento_fin || p.fecha_fin,
        estado: p.estado,
      })
      if (revMarca(p)) acc.marcada = true
      porPlanta.set(p.id, acc)
    }
  }
  return [...porPlanta.values()].map(p => ({
    ...p,
    // Por SIC, no por nombre: un mismo contrato comercial puede estar
    // registrado bajo varios códigos (Nitro con Cacica: 88747 y 88750).
    nContratos: new Set(p.apariciones.map(claveContrato)).size,
  }))
})

// 1 · Duplicadas. El motivo lo decide motivoDuplicada(): pasa del 100% a la vez,
// está marcada, o está en varios contratos sin % verificable.
const revDuplicadas = computed(() =>
  revPorPlantaVenta.value
    .map(p => {
      const veredicto = motivoDuplicada(p)
      return veredicto ? { ...p, ...veredicto } : null
    })
    .filter(Boolean)
    .filter(p => revCoincide(p.nombre, ...p.apariciones.map(a => a.contrato), ...p.apariciones.map(a => a.codigo_sic)))
    .sort((a, b) => b.maxPct - a.maxPct || (a.nombre || '').localeCompare(b.nombre || ''))
)

// Repartidas: en varios contratos pero sumando 100% o menos. NO son duplicados
// — se listan aparte justamente para dejarlo claro.
const revRepartidas = computed(() =>
  revPorPlantaVenta.value
    .filter(esRepartida)
    .map(p => {
      const apariciones = repartirPares(p.apariciones)
      return { ...p, apariciones, maxPct: maxConcurrente(apariciones) }
    })
    .filter(p => revCoincide(p.nombre, ...p.apariciones.map(a => a.contrato)))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
)

// 2 · Los tramos que el mes dejó fuera de todo contrato PPA (piscina e). OJO:
// esa piscina NO significa "sin contrato" — significa "sin PPA resuelto en
// Cumplimiento". Una planta con registro GESCON vigente cae aquí igual si su
// contrato no cruzó (contrato_interno sin PPA que casar, responsable oculto…).
// Por eso cada tramo se contrasta contra /asic antes de llamarlo "sin contrato".
const revTramosLibres = computed(() => {
  const d = revData.value
  if (!d) return []
  const libres = Array.isArray(d.bolsa_libre)
    ? d.bolsa_libre
    : (d.bolsa || []).filter(p => p.piscina !== 'comercializador')
  return libres
    .filter(p => revCoincide(p.nombre))
    .map(p => ({ ...p, _sic: revSicVigenteEnTramo(p.id, p.segmento_inicio, p.segmento_fin) }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
})

// Sin contrato de verdad: ni PPA ni registro GESCON vigente sobre ese tramo.
const revSinContrato = computed(() => revTramosLibres.value.filter(p => !p._sic))

// Tiene SIC vigente, pero el mes no lo cuenta en ningún contrato: inconsistencia
// a corregir en GESCON o en el PPA, no una planta libre en bolsa.
const revSicSinPpa = computed(() => revTramosLibres.value.filter(p => p._sic))

// 3 · UNGC: contratos GESCON donde UNGC compra (b) + remanente cuyo SIC vigente
// tiene a UNGC de comprador (f). Dos orígenes distintos, una sola lista.
const revUngc = computed(() => {
  const d = revData.value
  if (!d) return []
  const out = []
  for (const c of d.compra || []) {
    for (const p of c.plantas || []) {
      out.push({
        _key: `b-${c.id}-${p.id}-${p.segmento_inicio || ''}`,
        nombre: p.nombre, contrato: c.nombre, codigo_sic: p.codigo_sic,
        desde: p.fecha_inicio || p.segmento_inicio,
        hasta: p.fecha_fin || p.segmento_fin,
        estado: p.estado,
      })
    }
  }
  const comercializador = Array.isArray(d.bolsa_comercializador)
    ? d.bolsa_comercializador
    : (d.bolsa || []).filter(p => p.piscina === 'comercializador')
  for (const p of comercializador) {
    out.push({
      _key: `f-${p.id}-${p.segmento_inicio || ''}`,
      nombre: p.nombre, contrato: null, codigo_sic: p.codigo_sic,
      desde: p.fecha_inicio || p.segmento_inicio,
      hasta: p.fecha_fin || p.segmento_fin,
      estado: p.estado,
    })
  }
  return out
    .filter(p => revCoincide(p.nombre, p.contrato, p.codigo_sic))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
})

// Uso del recurso: el cliente está en bolsa y su planta entra al contrato
// pagándole la generación a precio de bolsa. No genera garantías y no es una
// duplicación — por eso va en su propia sección.
const revUsoRecurso = computed(() =>
  revPorPlantaVenta.value
    .flatMap(p => p.apariciones
      .filter(a => a.uso_del_recurso)
      .map(a => ({ ...a, _key: `${p.id}-${a.codigo_sic}-${a.desde}`, planta: p.nombre })))
    .filter(a => revCoincide(a.planta, a.contrato, a.codigo_sic))
    .sort((a, b) => (a.planta || '').localeCompare(b.planta || ''))
)

const revResumen = computed(() => [
  {
    key: 'dup', n: revDuplicadas.value.length, titulo: 'Plantas duplicadas',
    detalle: 'Pasan del 100% a la vez, o marcadas',
    color: '#9a6700', fondo: 'rgba(240,192,64,0.10)', borde: 'rgba(240,192,64,0.35)',
  },
  {
    key: 'sin', n: revSinContrato.value.length, titulo: 'Libres en bolsa',
    detalle: 'Sin PPA y sin registro GESCON',
    color: '#2C2039', fondo: 'rgba(44,32,57,0.04)', borde: 'rgba(44,32,57,0.14)',
  },
  {
    key: 'uso', n: revUsoRecurso.value.length, titulo: 'Uso del recurso',
    detalle: 'Se le paga al cliente a precio bolsa',
    color: '#0369a1', fondo: 'rgba(2,132,199,0.08)', borde: 'rgba(2,132,199,0.28)',
  },
  {
    key: 'inc', n: revSicSinPpa.value.length, titulo: 'Con SIC, fuera del cálculo',
    detalle: 'Tienen GESCON pero el mes no los cuenta',
    color: '#D64455', fondo: 'rgba(214,68,85,0.07)', borde: 'rgba(214,68,85,0.28)',
  },
  {
    key: 'ungc', n: revUngc.value.length, titulo: 'Plantas con UNGC',
    detalle: 'Contrato de compra o SIC con UNGC',
    color: '#915BD8', fondo: 'rgba(145,91,216,0.08)', borde: 'rgba(145,91,216,0.28)',
  },
])

function revEstadoBadge(estado) {
  return estado === 'terminado' ? 'background: rgba(214,68,85,0.12); color: #D64455;'
       : estado === 'futuro'    ? 'background: rgba(44,32,57,0.06); color: #7a6e8a;'
       : 'background: rgba(46,125,50,0.12); color: #2e7d32;'
}
function revEstadoLabel(estado) {
  return estado === 'terminado' ? 'Terminado' : estado === 'futuro' ? 'Futuro' : 'Vigente'
}

// ── Balance de energía ───────────────────────────────────────────────────────
// Libro mayor de bolsa del mes: cuánto se compra o se compraría en bolsa. El
// neteo ocurre DENTRO de cada agente — UNGC va aparte porque es otro agente y
// su venta en bolsa no cancela las compras de UNGG.
const beYear    = ref(now.getFullYear())
const beMonth   = ref(now.getMonth() + 1)
const beData    = ref(null)
const beLoading = ref(false)
const beError   = ref(null)
const beFiltro  = ref(null)      // categoría seleccionada desde el libro mayor
const beBusqueda = ref('')
const beExcluirExterna = ref(false)

const BE_AYUDA = {
  e: 'Venta en bolsa (UNGG). Energía que entra a la bolsa directamente como generador: '
   + 'los días sin contrato y el porcentaje no despachado de los días con contrato. '
   + 'Acarrea cargos regulatorios altos — es la línea que conviene mantener baja.',
  f: 'Venta en bolsa (UNGC). UNGG le vende a UNGC y el comercializador inyecta a la bolsa. '
   + 'No acarrea cargos regulatorios; acarrea cartera. Sale de las plantas con registro SIC '
   + 'vigente con comprador UNGC.',
  c: 'Compra directa en bolsa. Plantas duplicadas: la energía no existe, así que Unergy la '
   + 'compra en la bolsa para cubrir el contrato duplicado (por ejemplo Klik sobre Uruaco). '
   + 'Genera garantías.',
  uso: 'Compra no directa en bolsa (uso del recurso). La energía sí existe y se entrega al '
   + 'contrato, pero se le paga al dueño de la planta a precio de bolsa. El contrato paga su '
   + 'tarifa y Unergy asume la diferencia. No genera garantías.',
  neto: 'Venta en bolsa de UNGG menos sus compras en bolsa. Positivo = UNGG termina el mes '
   + 'vendiendo neto a la bolsa; negativo = comprando neto.',
}

const BE_CATEGORIAS = {
  a:   { label: 'Registrado en contrato', badge: 'background: rgba(145,91,216,0.10); color: #915BD8;' },
  c:   { label: 'Compra directa — duplicados', badge: 'background: rgba(154,103,0,0.12); color: #9a6700;' },
  uso: { label: 'Compra no directa — uso del recurso', badge: 'background: rgba(3,105,161,0.12); color: #0369a1;' },
  e:   { label: 'Venta en bolsa UNGG', badge: 'background: rgba(214,68,85,0.12); color: #D64455;' },
  f:   { label: 'Venta en bolsa UNGC', badge: 'background: rgba(20,184,166,0.14); color: #0f766e;' },
  g:   { label: 'Compra externa', badge: 'background: rgba(44,32,57,0.08); color: #2C2039;' },
}

const beB = computed(() => beData.value?.balance || {
  ungg: {
    venta_bolsa: {}, compra_bolsa_directa: {}, compra_bolsa_no_directa: {},
    compra_bolsa_total: {}, neto: {},
  },
  ungc: { venta_bolsa: {} },
})

const bePeriodoLabel = computed(() => {
  const p = beData.value?.periodo
  if (!p) return ''
  return p.es_mes_actual
    ? `Real 1–${p.dia_corte} · Proyectado ${p.dia_corte + 1}–${p.dias_mes}`
    : `Mes cerrado · ${p.dias_mes} días`
})

// Positivo (vende neto a bolsa) es lo esperado; negativo significa que el mes
// se cierra comprando en bolsa, que es lo que dispara garantías.
const beNetoColor = computed(() => (beB.value.ungg.neto?.total ?? 0) < 0 ? '#D64455' : '#2C2039')
const beNetoEtiqueta = computed(() => (beB.value.ungg.neto?.total ?? 0) < 0 ? 'compra neta' : 'venta neta')
const beNetoEstilo = computed(() => (beB.value.ungg.neto?.total ?? 0) < 0
  ? 'background: rgba(214,68,85,0.12); color: #D64455;'
  : 'background: rgba(20,184,166,0.14); color: #0f766e;')

const beFilas = computed(() => {
  let filas = beData.value?.inventario || []
  if (beFiltro.value) filas = filas.filter(f => f.categoria === beFiltro.value)
  const q = beBusqueda.value.trim().toLowerCase()
  if (q) {
    filas = filas.filter(f =>
      (f.frontera || '').toLowerCase().includes(q) ||
      (f.planta || '').toLowerCase().includes(q) ||
      (f.estado || '').toLowerCase().includes(q) ||
      (f.contrato || '').toLowerCase().includes(q))
  }
  return filas
})

// Click en una capa del libro mayor: abre el desglose de dónde sale la cifra.
// Filtrar la tabla de abajo queda a un botón dentro del modal, para que las dos
// acciones no compitan por el mismo click.
const beCapa = ref(null)

function beTitulo(categoria) {
  return `${BE_AYUDA[categoria]}\n\nClick para ver de qué plantas sale la cifra.`
}

function beAbrirCapa(categoria) { beCapa.value = categoria }
function beCerrarCapa() { beCapa.value = null }
function beVerEnTabla() {
  beFiltro.value = beCapa.value
  beCapa.value = null
}

const beCapaFilas = computed(() => {
  if (!beCapa.value) return []
  return (beData.value?.inventario || [])
    .filter(f => f.categoria === beCapa.value)
    .slice()
    .sort((a, b) => (b.mwh_total ?? -1) - (a.mwh_total ?? -1))
})

const beCapaPlantas = computed(() => new Set(beCapaFilas.value.map(f => f.proyecto_id)).size)

const beCapaTotales = computed(() => {
  const t = { real: 0, proyectado: 0, total: 0 }
  for (const f of beCapaFilas.value) {
    t.real += f.mwh_real || 0
    t.proyectado += f.mwh_proyectado || 0
    t.total += f.mwh_total || 0
  }
  return t
})

function fmtNum1(val) {
  if (val === null || val === undefined) return '—'
  return Math.abs(val).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function fmtSigno(val) {
  if (val === null || val === undefined) return '—'
  return (val < 0 ? '−' : '+') + fmtNum1(val)
}

async function loadBalance() {
  beLoading.value = true
  beError.value   = null
  const params = {
    year: beYear.value,
    month: beMonth.value,
    excluir_compra_externa: beExcluirExterna.value,
    incluir_todos: incluirTodos(),
  }
  // El mes en curso cambia todos los días (avanza el real, se encoge la
  // proyección): se consulta fresco. Los meses cerrados sí van a caché.
  const esMesActual = beYear.value === now.getFullYear() && beMonth.value === now.getMonth() + 1
  try {
    beData.value = esMesActual
      ? await cumplimientoService.obtenerBalanceEnergia(params, 120_000)
      : await cachedGet(
          '/cumplimiento/balance-energia',
          params,
          () => cumplimientoService.obtenerBalanceEnergia(params),
        )
    updateCacheSize()
  } catch (e) {
    beError.value = e.data?.detail || 'Error al calcular el balance de energía.'
  } finally {
    beLoading.value = false
  }
}

async function exportarBalanceExcel() {
  if (!beData.value) return
  const XLSX = await import('xlsx-js-style')
  const mes = MESES[beMonth.value - 1]
  const b = beB.value

  const aoa = [[`UNERGY — Balance de energía en bolsa · ${mes} ${beYear.value}`], [bePeriodoLabel.value], []]
  const linea = (etiqueta, celda, signo = 1) => aoa.push([
    etiqueta, '', '',
    signo * (celda.real ?? 0), signo * (celda.proyectado ?? 0), signo * (celda.total ?? 0),
  ])

  aoa.push(['LIBRO MAYOR', '', '', 'Real (MWh)', 'Proyectado (MWh)', 'Total (MWh)'])
  const filaLibro = aoa.length - 1
  aoa.push(['UNGG · generador'])
  linea('  Venta en bolsa — cargos regulatorios', b.ungg.venta_bolsa)
  linea('  Compra directa — duplicados (garantías)', b.ungg.compra_bolsa_directa, -1)
  linea('  Compra no directa — uso del recurso', b.ungg.compra_bolsa_no_directa, -1)
  linea('  Total compras en bolsa', b.ungg.compra_bolsa_total, -1)
  linea('  NETO UNGG', b.ungg.neto)
  aoa.push(['UNGC · comercializador'])
  linea('  Venta en bolsa — solo cartera', b.ungc.venta_bolsa)
  aoa.push([])

  // Se exporta también la generación BASE del tramo: sin el multiplicando, el
  // Excel no permite reconstruir de dónde sale cada aporte.
  const header = ['Frontera', 'Planta', 'Estado', 'Método', 'Contrato', 'Desde', 'Hasta', 'Días',
                  'Gen. tramo (MWh)', '% Despacho', 'Real (MWh)', 'Proyectado (MWh)',
                  'Total (MWh)', 'Nota']
  const filaHeader = aoa.length
  aoa.push(header)
  for (const f of beData.value.inventario) {
    const genBase = f.gen_tramo_real !== null && f.gen_tramo_real !== undefined
      ? Number(((f.gen_tramo_real || 0) + (f.gen_tramo_proyectado || 0)).toFixed(3))
      : ''
    aoa.push([
      f.frontera, f.planta, f.estado, f.metodo, f.contrato || '',
      f.desde || '', f.hasta || '', f.dias ?? '',
      genBase,
      f.pct !== null && f.pct !== undefined ? Number((f.pct * 100).toFixed(0)) : '',
      f.mwh_real ?? '', f.mwh_proyectado ?? '', f.mwh_total ?? '',
      f.estimado ? 'Generación estimada con el promedio diario del mes' : '',
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  for (const fila of [filaLibro, filaHeader]) {
    for (let c = 0; c < header.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: fila, c })
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = { font: { bold: true, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.morado } } }
    }
  }
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 })
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }]
  ws['!cols'] = [{ wch: 34 }, { wch: 30 }, { wch: 26 }, { wch: 22 }, { wch: 22 },
                 { wch: 12 }, { wch: 12 }, { wch: 7 }, { wch: 17 }, { wch: 11 },
                 { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 44 }]
  ws['!autofilter'] = { ref: `A${filaHeader + 1}:N${aoa.length}` }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Balance ${mes} ${beYear.value}`.slice(0, 31))
  XLSX.writeFile(wb, `balance_energia_${beYear.value}_${String(beMonth.value).padStart(2, '0')}.xlsx`)
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false
  const end = new Date(dateStr + 'T00:00:00')
  const diff = (end - now) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 60
}

watch(activeTab, (tab) => {
  if (tab === 0 && !simData.value) loadSimulator()
  if (tab === 1 && !anualData.value) { loadAnnualData(); loadTableData() }
  if (tab === 2 && !pcData.value) loadPlantasContratos()
  if (tab === 3 && !etData.value) loadEnergiaTransada()
  if (tab === 4 && !anualMatrizData.value) loadAnualMatriz()
  if (tab === 5 && !beData.value) loadBalance()
  if (tab === 6 && !revData.value) loadRevision()
})

onMounted(async () => {
  await Promise.all([loadContratos(), loadBackendProyectos()])
  loadSimulator()
})
</script>

<style scoped>
/* ── Matriz anual ── */
.cv-matriz { width: 100%; border-collapse: separate; border-spacing: 0; }
.cv-matriz thead th { position: sticky; top: 0; background: #faf8fd; z-index: 2; font-weight: 600; color: var(--color-unergy-deep); border-bottom: 1px solid rgba(44,32,57,0.1); }
.cv-matriz .sticky-col { position: sticky; left: 0; background: #fff; z-index: 1; min-width: 240px; }
.cv-matriz thead .sticky-col { z-index: 3; background: #faf8fd; }
.cv-matriz-contrato:hover { background: #f6f2fb; }
.cv-matriz-contrato .sticky-col { background: #fff; }
.cv-matriz-proyecto { background: #fbfafd; }
.cv-matriz-proyecto .sticky-col { background: #fbfafd; }
.cv-matriz-total td { border-top: 2px solid rgba(44,32,57,0.15); background: #f3eefb; }
.cv-matriz-total .sticky-col { background: #f3eefb; }

/* ── Rediseño Notion + brand Unergy (header, tabs, toolbar, tarjetas) ── */
.cv-icon-tile {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  display: grid; place-items: center;
  background: rgba(145,91,216,0.12); color: var(--color-unergy-purple); font-size: 17px;
}
.cv-tab {
  font-size: 13.5px; font-weight: 700; color: #9b8fb0;
  padding: 9px 13px; border: 0; background: none; cursor: pointer;
  border-radius: 8px 8px 0 0; border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: background .12s, color .12s;
}
.cv-tab:hover { background: rgba(44,32,57,0.04); color: var(--color-unergy-deep); }
.cv-tab.active { color: var(--color-unergy-deep); border-bottom-color: var(--color-unergy-purple); }

/* ── Balance de energía ─────────────────────────────────────────────────────
   Cada línea del libro mayor es clicable (filtra el inventario) y explica en
   hover qué es y qué riesgo implica. */
.be-linea { cursor: pointer; transition: background-color .12s; }
.be-linea:hover { background: rgba(145,91,216,0.06); }
.be-linea.activa { background: rgba(145,91,216,0.10); }
.be-linea td:first-child { border-left: 2px solid transparent; padding-left: 6px; }
.be-linea.activa td:first-child { border-left-color: var(--color-unergy-purple); }

/* El riesgo nunca se comunica solo con color: el chip lleva su etiqueta. */
.be-chip {
  display: inline-flex; align-items: center; gap: 3px;
  margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  font-size: 10px; font-weight: 600; white-space: nowrap; vertical-align: middle;
}
.be-chip-alerta { background: rgba(214,68,85,0.12); color: #D64455; }
.be-chip-ok     { background: rgba(20,184,166,0.14); color: #0f766e; }
.be-chip-neutro { background: rgba(44,32,57,0.07); color: #7a6e8a; }

.cv-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 34px;
  padding: 0 12px; border-radius: 9px; border: 1px solid rgba(44,32,57,0.12);
  background: #fff; color: var(--color-unergy-deep); font-size: 13px; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.cv-btn:hover { background: rgba(44,32,57,0.04); border-color: rgba(145,91,216,0.40); }
.cv-btn-cta {
  display: inline-flex; align-items: center; gap: 6px; height: 34px;
  padding: 0 14px; border-radius: 9px; border: 0;
  background: var(--color-unergy-yellow); color: var(--color-unergy-deep); font-size: 13px; font-weight: 700; cursor: pointer;
  box-shadow: 0 1px 0 rgba(44,32,57,0.04); transition: filter .12s, box-shadow .12s;
}
.cv-btn-cta:hover { filter: brightness(0.97); box-shadow: 0 3px 12px rgba(246,255,114,0.55); }

.cv-card {
  background: #fff; border: 1px solid rgba(44,32,57,0.07); border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(44,32,57,0.04), 0 2px 10px rgba(44,32,57,0.035);
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.cv-card:hover {
  border-color: rgba(145,91,216,0.32);
  box-shadow: 0 10px 28px rgba(44,32,57,0.11);
  transform: translateY(-2px);
}
.cv-card-dragover { border-color: var(--color-unergy-purple) !important; box-shadow: 0 0 0 2px rgba(145,91,216,0.18) !important; }
/* Fila/encabezado que abre el detalle (ventana emergente) al hacer click */
.cv-row-click { cursor: pointer; transition: background .12s; }
.cv-row-click:hover { background: rgba(145,91,216,0.06); }
.cv-panel {
  background: #fff; border: 1px solid rgba(44,32,57,0.07); border-radius: 16px;
  box-shadow: 0 1px 2px rgba(44,32,57,0.04), 0 2px 10px rgba(44,32,57,0.035);
}
.cv-card-gold {
  background: #fff; border: 1px solid rgba(240,192,64,0.5); border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(154,103,0,0.05), 0 2px 10px rgba(154,103,0,0.04);
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.cv-card-gold:hover { border-color: rgba(240,192,64,0.9); box-shadow: 0 10px 28px rgba(154,103,0,0.12); transform: translateY(-2px); }

:deep(.p-datatable .p-datatable-thead th) {
  background: rgba(44,32,57,0.05);
  color: #7a6e8a;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px;
}
:deep(.p-datatable .p-datatable-tbody td) {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-unergy-deep);
}
:deep(.p-datatable .p-datatable-tbody tr:hover td) {
  background: rgba(145,91,216,0.05) !important;
}
:deep(.p-datatable .row-selected td) {
  background: rgba(145,91,216,0.09) !important;
}
:deep(.p-datatable .row-consolidado td) {
  background: rgba(145,91,216,0.05) !important;
  border-bottom: 2px solid rgba(145,91,216,0.18) !important;
  font-weight: 600;
}
.sim-plant-zone::-webkit-scrollbar {
  width: 4px;
}
.sim-plant-zone::-webkit-scrollbar-thumb {
  background: rgba(145,91,216,0.2);
  border-radius: 2px;
}
.sim-plant-zone::-webkit-scrollbar-track {
  background: transparent;
}
</style>
