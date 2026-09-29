<template>
  <div class="space-y-5 bg-unergy-avena text-unergy-deep">
    <!-- Header -->
    <PageHeader
      title="Cumplimiento PPA"
      subtitle="Generación vs. compromisos contractuales de energía"
    >
      <template #lead>
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <ZapIcon class="size-5" />
        </div>
      </template>
      <template #actions>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors"
          title="Empresa responsable de cada PPA. Los contratos de un responsable no relevante se ocultan en toda esta página."
          @click="abrirResponsables"
        >
          <BuildingIcon class="size-3.5" />
          Responsables
        </button>
        <label
          class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
          :class="
            verOcultos
              ? 'border-destructive/35 bg-destructive/7 text-destructive'
              : 'border-foreground/12 text-muted-foreground'
          "
          title="Muestra en TODAS las pestañas los contratos cuyo responsable está marcado como no relevante"
        >
          <Checkbox
            :model-value="verOcultos"
            @update:model-value="(v) => (verOcultos = v === true)"
          />
          Ver ocultos
        </label>
        <span
          v-if="cacheSize"
          class="rounded bg-primary/8 px-2 py-1 font-mono text-xs text-primary"
        >
          caché: {{ cacheSize }}
        </span>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors"
          :class="cacheClearing ? 'pointer-events-none opacity-60' : ''"
          @click="clearCacheAndReload"
        >
          <RefreshCwIcon class="size-3.5" :class="{ 'animate-spin': cacheClearing }" />
          Borrar caché y consultar energía
        </button>
      </template>
    </PageHeader>

    <!-- Tab bar -->
    <GTabs :model-value="String(activeTab)" @update:model-value="(v) => (activeTab = Number(v))">
      <GTabsList variant="outline">
        <GTabsTrigger v-for="(tab, i) in TABS" :key="i" :value="String(i)" variant="outline">
          {{ tab }}
        </GTabsTrigger>
      </GTabsList>
    </GTabs>

    <!-- ═══════════════ CUMPLIMIENTO TAB ═══════════════ -->
    <div v-show="activeTab === 1" class="space-y-6">
      <!-- Selectors -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(selectedYear)"
            @update:model-value="
              (v) => {
                selectedYear = Number(v)
                onYearChange()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase"
            >Contrato</label
          >
          <Select
            :model-value="selectedContratoId != null ? String(selectedContratoId) : undefined"
            @update:model-value="
              (v) => {
                selectedContratoId = contratoIdFromString(v as string)
                loadAnnualData()
              }
            "
          >
            <SelectTrigger class="max-w-72"
              ><SelectValue placeholder="Seleccionar contrato"
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in contratos" :key="c.id" :value="String(c.id)">{{
                c.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            class="border-primary text-primary"
            :disabled="!anualData || chartLoading || exportingExcel || exportingPdf"
            :title="
              selectedContratoId === CONSOLIDADO_ID
                ? 'Una hoja por contrato + resumen consolidado, con plantas participantes'
                : 'Detalle mensual del contrato con plantas participantes'
            "
            @click="exportarAnualExcel"
          >
            <LoaderCircleIcon v-if="exportingExcel" class="animate-spin" />
            <FileSpreadsheetIcon v-else />
            Exportar (Excel)
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="border-foreground text-foreground"
            :disabled="!anualData || chartLoading || exportingExcel || exportingPdf"
            title="PDF presentable para compartir con el inversionista"
            @click="exportarAnualPdf"
          >
            <LoaderCircleIcon v-if="exportingPdf" class="animate-spin" />
            <FileTextIcon v-else />
            Descargar PDF
          </Button>
        </div>
      </div>

      <!-- Chart loading -->
      <div v-if="chartLoading" class="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner class="size-12" />
        <p class="text-sm text-muted-foreground">Consultando generación para 12 meses…</p>
      </div>

      <!-- Chart error -->
      <Alert v-else-if="chartError" variant="destructive">
        <AlertDescription>{{ chartError }}</AlertDescription>
      </Alert>

      <!-- Chart -->
      <template v-else-if="anualData">
        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span class="text-base font-semibold text-unergy-deep">
            {{ anualData.contrato.nombre_interno || anualData.contrato.numero_codigo_contrato }}
          </span>
          <span>·</span>
          <span>{{ anualData.contrato.comprador_nombre }}</span>
          <span>·</span>
          <span>{{ anualData.year }}</span>
          <span
            v-if="selectedContratoId === CONSOLIDADO_ID"
            class="rounded-full bg-unergy-purple/12 px-2 py-0.5 text-xs font-medium text-unergy-purple"
          >
            Suma de todos los contratos
          </span>
        </div>

        <div class="rounded-2xl border border-foreground/7 bg-card p-4 shadow-xs">
          <div ref="chartBox" class="relative h-90 w-full select-none">
            <svg
              class="h-full w-full"
              :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
              preserveAspectRatio="xMidYMid meet"
              @mousemove="onSvgMousemove"
              @mouseleave="hovered = null"
              @click="onSvgClick"
            >
              <g v-for="gl in yGridLines" :key="gl.val">
                <line
                  class="stroke-unergy-deep/7"
                  :x1="PAD_L"
                  :y1="gl.y"
                  :x2="SVG_W - PAD_R"
                  :y2="gl.y"
                  stroke-width="1"
                />
                <text
                  class="fill-muted-foreground"
                  :x="PAD_L - 7"
                  :y="gl.y + 4"
                  text-anchor="end"
                  font-size="10"
                >
                  {{ fmtShort(gl.val) }}
                </text>
              </g>

              <g v-for="(mes, i) in anualData.meses" :key="i">
                <!-- Background highlights -->
                <rect
                  v-if="isCurrentMonth(mes)"
                  class="fill-unergy-purple/6"
                  :x="slotX(i)"
                  y="0"
                  :width="slotW"
                  :height="SVG_H - PAD_B + 2"
                />
                <rect
                  v-if="selectedMonthIdx === i"
                  class="fill-warning/8"
                  :x="slotX(i)"
                  y="0"
                  :width="slotW"
                  :height="SVG_H - PAD_B + 2"
                />
                <!-- Commitment zone (green band) -->
                <rect
                  v-if="mes.min_mwh !== null && mes.max_mwh !== null"
                  class="fill-success/10"
                  :x="slotX(i)"
                  :y="toY(mes.max_mwh)"
                  :width="slotW"
                  :height="toY(mes.min_mwh) - toY(mes.max_mwh)"
                />

                <!-- CURRENT MONTH: two bars side by side -->
                <template v-if="mes.tipo_datos === 'mes_actual'">
                  <!-- Left bar: actual generation (solid) -->
                  <rect
                    v-if="mes.gen_mwh > 0"
                    :x="dualBarLeftX(i)"
                    :y="toY(mes.gen_mwh)"
                    :width="dualBarW"
                    :height="toY(0) - toY(mes.gen_mwh)"
                    fill="var(--color-unergy-purple)"
                    rx="1"
                  />
                  <!-- Right bar: projected close (lighter + pattern) -->
                  <rect
                    v-if="cierreVal(mes) > 0"
                    class="fill-chart-2/65"
                    :x="dualBarRightX(i)"
                    :y="toY(cierreVal(mes))"
                    :width="dualBarW"
                    :height="toY(0) - toY(cierreVal(mes))"
                    rx="1"
                  />
                  <rect
                    v-if="cierreVal(mes) > 0"
                    class="stroke-chart-2/90"
                    :x="dualBarRightX(i)"
                    :y="toY(cierreVal(mes))"
                    :width="dualBarW"
                    :height="toY(0) - toY(cierreVal(mes))"
                    fill="none"
                    stroke-width="1"
                    stroke-dasharray="3,2"
                    rx="1"
                  />
                  <!-- Deficit/excedent shading on projection bar -->
                  <rect
                    v-if="
                      mes.estado === 'deficit' &&
                      mes.min_mwh !== null &&
                      cierreVal(mes) > 0 &&
                      cierreVal(mes) < mes.min_mwh
                    "
                    class="fill-destructive/32"
                    :x="dualBarRightX(i)"
                    :y="toY(mes.min_mwh)"
                    :width="dualBarW"
                    :height="toY(cierreVal(mes)) - toY(mes.min_mwh)"
                  />
                  <rect
                    v-if="
                      mes.estado === 'excedente' &&
                      mes.max_mwh !== null &&
                      cierreVal(mes) > mes.max_mwh
                    "
                    class="fill-chart-2/50"
                    :x="dualBarRightX(i)"
                    :y="toY(cierreVal(mes))"
                    :width="dualBarW"
                    :height="toY(mes.max_mwh) - toY(cierreVal(mes))"
                  />
                </template>

                <!-- PAST / FUTURE months: single bar -->
                <template v-else>
                  <rect
                    v-if="genVal(mes) > 0"
                    :x="barX(i)"
                    :y="toY(genVal(mes))"
                    :width="barW"
                    :height="toY(0) - toY(genVal(mes))"
                    :class="
                      mes.tipo_datos === 'proyeccion_historica'
                        ? 'fill-chart-2/55'
                        : 'fill-unergy-purple'
                    "
                  />
                  <rect
                    v-if="genVal(mes) > 0 && mes.tipo_datos === 'proyeccion_historica'"
                    class="stroke-chart-2/90"
                    :x="barX(i)"
                    :y="toY(genVal(mes))"
                    :width="barW"
                    :height="toY(0) - toY(genVal(mes))"
                    fill="none"
                    stroke-width="1"
                    stroke-dasharray="3,2"
                  />
                  <rect
                    v-if="
                      mes.estado === 'deficit' &&
                      mes.min_mwh !== null &&
                      genVal(mes) > 0 &&
                      genVal(mes) < mes.min_mwh
                    "
                    class="fill-destructive/32"
                    :x="barX(i)"
                    :y="toY(mes.min_mwh)"
                    :width="barW"
                    :height="toY(genVal(mes)) - toY(mes.min_mwh)"
                  />
                  <rect
                    v-if="
                      mes.estado === 'excedente' &&
                      mes.max_mwh !== null &&
                      genVal(mes) > mes.max_mwh
                    "
                    class="fill-chart-2/50"
                    :x="barX(i)"
                    :y="toY(genVal(mes))"
                    :width="barW"
                    :height="toY(mes.max_mwh) - toY(genVal(mes))"
                  />
                </template>

                <!-- Min/max lines -->
                <line
                  v-if="mes.min_mwh !== null"
                  class="stroke-destructive/50"
                  :x1="slotX(i)"
                  :y1="toY(mes.min_mwh)"
                  :x2="slotX(i) + slotW"
                  :y2="toY(mes.min_mwh)"
                  stroke-width="1"
                />
                <line
                  v-if="mes.max_mwh !== null"
                  class="stroke-unergy-purple/50"
                  :x1="slotX(i)"
                  :y1="toY(mes.max_mwh)"
                  :x2="slotX(i) + slotW"
                  :y2="toY(mes.max_mwh)"
                  stroke-width="1"
                />
                <!-- Hover highlight -->
                <rect
                  v-if="hovered === i && selectedMonthIdx !== i"
                  class="fill-unergy-purple/7"
                  :x="slotX(i)"
                  :y="PAD_T"
                  :width="slotW"
                  :height="PLOT_H"
                />
                <!-- Month label -->
                <circle
                  v-if="selectedMonthIdx === i"
                  class="fill-warning"
                  :cx="slotX(i) + slotW / 2"
                  :cy="SVG_H - PAD_B + 30"
                  r="3"
                />
                <text
                  :x="slotX(i) + slotW / 2"
                  :y="SVG_H - PAD_B + 17"
                  text-anchor="middle"
                  font-size="11"
                  :class="
                    selectedMonthIdx === i
                      ? 'fill-warning'
                      : isCurrentMonth(mes)
                        ? 'fill-unergy-deep'
                        : 'fill-muted-foreground'
                  "
                  :font-weight="selectedMonthIdx === i || isCurrentMonth(mes) ? '700' : '400'"
                >
                  {{ MESES_CORTOS[i] }}
                </text>
                <!-- Clickable area -->
                <rect
                  class="cursor-pointer"
                  :x="slotX(i)"
                  :y="PAD_T"
                  :width="slotW"
                  :height="PLOT_H"
                  fill="transparent"
                />
              </g>

              <line
                class="stroke-unergy-deep/18"
                :x1="PAD_L"
                :y1="PAD_T"
                :x2="PAD_L"
                :y2="PAD_T + PLOT_H"
                stroke-width="1"
              />
              <line
                class="stroke-unergy-deep/18"
                :x1="PAD_L"
                :y1="PAD_T + PLOT_H"
                :x2="SVG_W - PAD_R"
                :y2="PAD_T + PLOT_H"
                stroke-width="1"
              />
            </svg>

            <!-- Tooltip -->
            <div
              v-if="hovered !== null && hoveredMes"
              class="pointer-events-none absolute top-(--y) left-(--x) z-10 min-w-50 -translate-y-full rounded-xl bg-unergy-deep px-3.5 py-2.5 text-sm text-unergy-avena shadow-lg"
              :style="{ '--x': tooltipX + 'px', '--y': tooltipY + 'px' }"
            >
              <div class="mb-2 font-bold text-warning">
                {{ MESES[hovered] }} {{ selectedYear }}
                <span
                  v-if="hoveredMes.tipo_datos === 'mes_actual'"
                  class="ml-1 text-xs font-normal text-chart-2/85"
                  >mes en curso</span
                >
                <span
                  v-else-if="hoveredMes.tipo_datos === 'proyeccion_historica'"
                  class="ml-1 text-xs font-normal text-unergy-avena/55"
                  >proyección</span
                >
              </div>
              <div class="space-y-1">
                <!-- Current month: show both actual and projection -->
                <template v-if="hoveredMes.tipo_datos === 'mes_actual'">
                  <div class="flex justify-between gap-6">
                    <span class="text-unergy-purple-light">Generación actual</span>
                    <span class="font-mono font-semibold text-unergy-purple-light">{{
                      fmtMwh(hoveredMes.gen_mwh)
                    }}</span>
                  </div>
                  <div v-if="cierreVal(hoveredMes)" class="flex justify-between gap-6">
                    <span class="text-chart-2/90">Proy. cierre</span>
                    <span class="font-mono font-bold text-chart-2/95">{{
                      fmtMwh(cierreVal(hoveredMes))
                    }}</span>
                  </div>
                  <div
                    v-if="hoveredMes.dias_restantes != null"
                    class="mt-0.5 text-xs text-unergy-avena/40"
                  >
                    {{ hoveredMes.dia_actual }}d transcurridos · {{ hoveredMes.dias_restantes }}d
                    restantes
                  </div>
                </template>
                <!-- Past / Future: single value -->
                <template v-else>
                  <div class="flex justify-between gap-6">
                    <span class="text-unergy-avena/65">Generación</span>
                    <span class="font-mono font-semibold">{{ fmtMwh(genVal(hoveredMes)) }}</span>
                  </div>
                </template>
                <div v-if="hoveredMes.min_mwh !== null" class="flex justify-between gap-6">
                  <span class="text-unergy-avena/65">Mínimo</span>
                  <span class="font-mono">{{ fmtMwh(hoveredMes.min_mwh) }}</span>
                </div>
                <div v-if="hoveredMes.max_mwh !== null" class="flex justify-between gap-6">
                  <span class="text-unergy-avena/65">Máximo</span>
                  <span class="font-mono">{{ fmtMwh(hoveredMes.max_mwh) }}</span>
                </div>
                <div
                  v-if="hoveredMes.estado === 'deficit'"
                  class="mt-2 flex justify-between gap-6 border-t border-t-unergy-avena/10 pt-2"
                >
                  <span class="text-destructive">Déficit (proy.)</span>
                  <span class="font-mono font-bold text-destructive">{{
                    fmtMwh(hoveredMes.compras_bolsa_mwh)
                  }}</span>
                </div>
                <div
                  v-if="hoveredMes.estado === 'excedente'"
                  class="mt-2 flex justify-between gap-6 border-t border-t-unergy-avena/10 pt-2"
                >
                  <span class="text-chart-2">Excedente (proy.)</span>
                  <span class="font-mono font-bold text-chart-2">{{
                    fmtMwh(hoveredMes.excedentes_bolsa_mwh)
                  }}</span>
                </div>
              </div>
              <div class="mt-2 pt-1 text-xs text-unergy-avena/35">Clic para ver desglose</div>
            </div>
          </div>

          <!-- Legend -->
          <div class="mt-3 flex flex-wrap gap-5 pl-1">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <div class="size-4 rounded-sm border border-success/45 bg-success/18"></div>
              Zona de cumplimiento
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <div class="size-4 rounded-sm bg-unergy-purple"></div>
              Generación real
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                class="size-4 rounded-sm border border-dashed border-chart-2/90 bg-chart-2/65"
              ></div>
              Proyección cierre (prom. 30d)
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <div class="size-4 rounded-sm bg-destructive/38"></div>
              Brecha de déficit
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <div class="size-4 rounded-sm bg-chart-2/60"></div>
              Excedente contractual
            </div>
          </div>
        </div>
      </template>

      <!-- Empty chart state -->
      <div
        v-else-if="!chartLoading && !chartError"
        class="rounded-2xl border border-foreground/7 bg-card py-16 text-center text-muted-foreground shadow-xs"
      >
        <ChartColumnIcon class="mx-auto mb-3 block size-9 text-primary" />
        <p>Selecciona un año y un contrato para ver el cumplimiento anual.</p>
      </div>

      <!-- Summary table -->
      <div>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-foreground">
            Resumen anual por contrato — {{ selectedYear }}
          </h2>
          <span v-if="tableLoading" class="text-xs text-muted-foreground">Cargando…</span>
        </div>
        <div class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs">
          <DataTable
            :columns="tablaAnualColumns"
            :rows="tableDataWithTotal as unknown as DataTableRow[]"
            row-key="id"
            @row-click="
              (row) =>
                selectContrato(
                  asFilaAnual(row).id as ContratoCumplimientoPpa['id'] | typeof CONSOLIDADO_ID,
                )
            "
          >
            <template #cell="{ row, column }">
              <template v-if="column.key === 'contrato'">
                <div class="text-sm font-semibold" :class="filaAnualClass(asFilaAnual(row))">
                  {{ asFilaAnual(row).nombre_interno || asFilaAnual(row).numero_codigo_contrato }}
                </div>
                <div class="mt-0.5 text-xs text-muted-foreground">
                  {{ asFilaAnual(row).comprador_nombre }}
                  <span
                    v-if="esOculto(asFilaAnual(row))"
                    class="ml-1.5 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                    :title="
                      'Responsable: ' +
                      asFilaAnual(row).responsable +
                      ' — normalmente oculto en Cumplimiento'
                    "
                    >{{ asFilaAnual(row).responsable }}</span
                  >
                </div>
              </template>
              <span v-else-if="column.key === 'vigencia'" class="text-xs text-muted-foreground">
                {{ fmtFecha(asFilaAnual(row).fecha_inicio) }} –
                {{ fmtFecha(asFilaAnual(row).fecha_fin) }}
              </span>
              <template v-else-if="column.key === 'min_anual'">
                <span v-if="asFilaAnual(row).total_min_mwh !== null" class="font-mono text-sm">{{
                  fmtMwh(asFilaAnual(row).total_min_mwh)
                }}</span>
                <span v-else class="text-xs text-muted-foreground/60">—</span>
              </template>
              <template v-else-if="column.key === 'max_anual'">
                <span v-if="asFilaAnual(row).total_max_mwh !== null" class="font-mono text-sm">{{
                  fmtMwh(asFilaAnual(row).total_max_mwh)
                }}</span>
                <span v-else class="text-xs text-muted-foreground/60">—</span>
              </template>
              <span v-else-if="column.key === 'meses'" class="font-mono text-sm">
                {{ asFilaAnual(row).meses_con_compromisos
                }}<span class="text-xs text-muted-foreground">/12</span>
              </span>
              <template v-else-if="column.key === 'icono'">
                <ChartColumnIcon
                  v-if="asFilaAnual(row).id === selectedContratoId"
                  class="size-3.5 text-primary"
                />
                <ChevronRightIcon v-else class="size-3.5 text-primary" />
              </template>
            </template>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- ═══════════════ SIMULADOR TAB ═══════════════ -->
    <div v-show="activeTab === 0" class="space-y-5">
      <!-- Controls -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(simYear)"
            @update:model-value="
              (v) => {
                simYear = Number(v)
                loadSimulator()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Mes</label>
          <Select
            :model-value="String(simMonth)"
            @update:model-value="
              (v) => {
                simMonth = Number(v)
                loadSimulator()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-foreground/12 bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-foreground/4"
          @click="resetSim"
        >
          <RefreshCwIcon class="size-3 text-unergy-purple" />Resetear
        </button>
        <button
          v-if="hiddenContratos.size > 0"
          class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-foreground/12 bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-foreground/4"
          @click="showAllContratos"
        >
          <EyeIcon class="size-3 text-success" />Mostrar ocultos ({{ hiddenContratos.size }})
        </button>
        <button
          class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-foreground/12 bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-foreground/4"
          :title="sortDesc ? 'Mayor cumplimiento primero' : 'Menor cumplimiento primero'"
          @click="sortDesc = !sortDesc"
        >
          <ArrowDownWideNarrowIcon v-if="sortDesc" class="size-3 text-unergy-purple" />
          <ArrowUpNarrowWideIcon v-else class="size-3 text-unergy-purple" />
          {{ sortDesc ? '↓ Mayor %' : '↑ Menor %' }}
        </button>

        <!-- Filtro por estado (derivado de la proyección de cierre) -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:border-primary/40 hover:bg-foreground/4"
            :class="
              estadoFiltro === null
                ? 'border-unergy-purple bg-unergy-purple/10 font-bold text-unergy-purple'
                : 'border-foreground/12 bg-card text-foreground'
            "
            @click="estadoFiltro = null"
          >
            Todos
          </button>
          <button
            v-for="f in ESTADO_FILTROS"
            :key="f.key"
            class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:border-primary/40 hover:bg-foreground/4"
            :class="
              estadoFiltro === f.key
                ? `${f.activo} font-bold`
                : 'border-foreground/12 bg-card text-foreground'
            "
            :title="f.tip"
            @click="toggleEstadoFiltro(f.key)"
          >
            <span class="inline-block size-2 rounded-full" :class="f.punto"></span>
            {{ f.label }}
            <b class="ml-0.5">{{ estadoCounts[f.key] }}</b>
          </button>
        </div>

        <!-- Filtro por offtaker (comprador del contrato) -->
        <MultiComboBox
          v-model="offtakersFiltro"
          :options="offtakerOpts"
          placeholder="Todos los offtakers"
          class="min-w-48 text-sm"
          title="Filtrar contratos por offtaker (comprador)"
        />

        <div class="flex-1"></div>
        <button
          class="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-unergy-yellow px-3.5 text-sm font-bold text-foreground shadow-xs transition hover:shadow-md hover:brightness-95"
          :title="'Agrega un contrato supuesto para simular. No crea nada: se pierde al recargar.'"
          @click="showNuevoForm = true"
        >
          <PlusIcon class="size-3" />PPA simulado
        </button>
        <span class="w-full text-xs text-muted-foreground/70"
          >Arrastra las plantas entre contratos para simular. Nada de esta pantalla se guarda.</span
        >
      </div>

      <!--
        Formulario del PPA SIMULADO. Ojo: no crea un contrato. `crearNuevo()`
        arma un objeto en memoria con id de texto `__ficticio_N` y bandera
        `_ficticio`, y se pierde al recargar. Pide solo nombre, minimo y maximo
        porque es lo unico que necesita el calculo de cobertura; un PPA de verdad
        se crea en Servicios. La etiqueta decia "PPA nuevo" y se leia como que
        aqui se creaban contratos.
      -->
      <div v-if="showNuevoForm" class="rounded-xl border border-warning/40 bg-card p-5">
        <div class="mb-4 flex items-center gap-2">
          <ZapIcon class="size-4 text-warning" />
          <span class="text-sm font-bold text-unergy-deep">Nuevo PPA simulado</span>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-muted-foreground">Nombre</label>
            <Input v-model="ficticioNombre" placeholder="Ej: PPA Simulado 1" />
            <span class="text-xs text-muted-foreground/70">No se guarda en la plataforma</span>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-muted-foreground">Mínimo (MWh)</label>
            <Input
              :model-value="ficticioMin"
              type="number"
              placeholder="0"
              @update:model-value="(v) => (ficticioMin = Number(v))"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-muted-foreground">Máximo (MWh)</label>
            <Input
              :model-value="ficticioMax"
              type="number"
              placeholder="0"
              @update:model-value="(v) => (ficticioMax = Number(v))"
            />
          </div>
          <div class="flex gap-2">
            <button
              :disabled="!ficticioNombre || ficticioMax <= 0"
              class="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition"
              :class="
                !ficticioNombre || ficticioMax <= 0
                  ? 'cursor-not-allowed bg-unergy-deep/8 text-unergy-deep/30'
                  : 'cursor-pointer bg-unergy-purple text-primary-foreground'
              "
              @click="crearNuevo"
            >
              <CheckIcon class="size-3" />Crear
            </button>
            <button
              class="rounded-lg px-3 py-2 text-sm text-muted-foreground transition"
              @click="showNuevoForm = false"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div v-if="simLoading" class="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner class="size-12" />
        <p class="text-sm text-muted-foreground">Cargando generación promedio de las plantas…</p>
      </div>

      <div v-else-if="simError" class="flex flex-col items-center gap-3 py-10">
        <Alert variant="destructive">
          <AlertDescription>{{ simError }}</AlertDescription>
        </Alert>
        <button
          class="rounded-lg bg-unergy-purple px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors"
          @click="loadSimulator()"
        >
          <RefreshCwIcon class="mr-1 size-4" /> Reintentar
        </button>
      </div>

      <template v-else-if="simData">
        <!-- Contract columns (responsive grid) -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="c in visibleContratos"
            :key="c.id"
            class="flex flex-col overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
            :class="{
              'border-primary! ring-2! ring-unergy-purple/18!': dragOver === c.id,
            }"
            @dragover.prevent="onDragOver(c.id)"
            @drop.prevent="onDrop(c.id)"
          >
            <!-- Contract header -->
            <div
              class="flex cursor-pointer items-start justify-between gap-2 border-b border-unergy-deep/7 px-4 pt-3 pb-2 select-none"
              @click="toggleExpand(c.id)"
            >
              <div class="flex min-w-0 items-center gap-2">
                <ChevronDownIcon
                  v-if="expandedContratos.includes(c.id)"
                  class="size-3 flex-shrink-0 text-unergy-purple transition-transform"
                />
                <ChevronRightIcon
                  v-else
                  class="size-3 flex-shrink-0 text-unergy-purple transition-transform"
                />
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-bold break-words text-unergy-deep">{{
                      c.nombre
                    }}</span>
                    <span
                      v-if="c._ficticio"
                      class="flex-shrink-0 rounded bg-warning/18 px-1.5 py-0.5 text-xs font-medium text-warning"
                      >Simulado</span
                    >
                    <span
                      v-if="resSim(c.id)?.plantasEsp != null"
                      class="flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                      :class="estadoClases(resSim(c.id).estadoPlantas).badge"
                      :title="'Plantas inscritas (registradas y despachando vía GESCON) / plantas contrato (exigidas) — este mes'"
                      >{{ resSim(c.id).plantasReg }}/{{ resSim(c.id).plantasEsp }} plantas</span
                    >
                    <span v-else class="flex-shrink-0 font-mono text-xs text-muted-foreground"
                      >{{ (simAssignments[c.id] || []).length }} plantas</span
                    >
                    <span
                      v-if="resSim(c.id)?.pct !== null && resSim(c.id)?.pct !== undefined"
                      class="flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                      :class="estadoClases(resSim(c.id).estado).badge"
                      >{{ Math.round(resSim(c.id).pct!) }}%</span
                    >
                  </div>
                  <div class="mt-0.5 truncate text-xs text-muted-foreground">
                    {{ c.comprador_nombre
                    }}<span
                      v-if="esOculto(c)"
                      class="ml-1.5 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                      :title="
                        'Responsable: ' + c.responsable + ' — normalmente oculto en Cumplimiento'
                      "
                      >{{ c.responsable }}</span
                    >
                  </div>
                </div>
              </div>
              <div class="flex flex-shrink-0 items-center gap-0.5">
                <button
                  class="rounded-md p-1 text-unergy-purple transition-colors hover:bg-unergy-purple/5"
                  :title="'Ver detalle de la capa'"
                  @click.stop="abrirDetalleCapa(c)"
                >
                  <MaximizeIcon class="size-3" />
                </button>
                <button
                  v-if="c._ficticio"
                  class="rounded-md p-1 text-destructive transition-colors hover:bg-destructive/5"
                  :title="'Eliminar PPA'"
                  @click.stop="eliminarNuevo(c.id)"
                >
                  <Trash2Icon class="size-3" />
                </button>
                <button
                  class="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/5"
                  :title="'Ocultar contrato'"
                  @click.stop="hideContrato(c.id)"
                >
                  <EyeOffIcon class="size-3" />
                </button>
              </div>
            </div>

            <!-- Cumplimiento — tabla de energías + barras consecutivas -->
            <div v-if="resSim(c.id)" class="border-b border-unergy-deep/7 px-4 py-3">
              <!-- Tabla: títulos + valores -->
              <div class="mb-3 grid grid-cols-3 gap-x-3">
                <div>
                  <div
                    class="text-xs leading-tight font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    Energía entregada
                  </div>
                  <div class="mt-1 flex flex-wrap items-baseline gap-1">
                    <span class="font-mono text-xs font-bold text-unergy-deep">{{
                      fmtMwh(resSim(c.id).gen)
                    }}</span>
                    <span
                      v-if="resSim(c.id).genDup > 0"
                      class="inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 font-mono text-xs font-semibold text-warning"
                      :title="'De lo entregado, esta parte es compra en bolsa'"
                      ><ShoppingCartIcon class="size-3" />{{
                        fmtMwh(resSim(c.id).genDup)
                      }}
                      bolsa</span
                    >
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs leading-tight font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    Energía mínima
                  </div>
                  <div class="mt-1 font-mono text-xs font-bold text-unergy-deep">
                    {{ resSim(c.id).min !== null ? fmtMwh(resSim(c.id).min) : '—' }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs leading-tight font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    Energía proyectada
                  </div>
                  <div class="mt-1 font-mono text-xs font-bold text-unergy-deep">
                    {{
                      resSim(c.id).genProy != null && resSim(c.id).genProy! > 0
                        ? fmtMwh(resSim(c.id).genProy)
                        : '—'
                    }}
                  </div>
                </div>
              </div>

              <!-- Bullet chart: una barra con zonas déficit / en rango / excedente -->
              <div class="space-y-1.5">
                <div class="relative h-6.5 overflow-hidden rounded-md bg-unergy-deep/4">
                  <!-- Zonas de fondo -->
                  <template v-if="resSim(c.id).bullet.hasZones">
                    <div
                      v-if="resSim(c.id).bullet.hasMin"
                      class="absolute inset-y-0 left-0 w-(--w) bg-destructive/10"
                      :style="{ '--w': resSim(c.id).bullet.minPct + '%' }"
                    />
                    <div
                      class="absolute inset-y-0 left-(--l) w-(--w) bg-success/11"
                      :style="{
                        '--l': resSim(c.id).bullet.minPct + '%',
                        '--w': resSim(c.id).bullet.maxPct - resSim(c.id).bullet.minPct + '%',
                      }"
                    />
                    <div
                      v-if="resSim(c.id).bullet.hasMax"
                      class="absolute inset-y-0 right-0 left-(--l) bg-chart-2/14"
                      :style="{ '--l': resSim(c.id).bullet.maxPct + '%' }"
                    />
                  </template>
                  <!-- Energía entregada (color = estado) -->
                  <div
                    class="absolute top-1/2 left-0 h-2.5 w-(--w) -translate-y-1/2 rounded-sm transition-all duration-300"
                    :class="estadoClases(resSim(c.id).estado).fondo"
                    :style="{ '--w': resSim(c.id).bullet.measurePct + '%' }"
                  />
                  <!-- Compra en bolsa: tramo amarillo DENTRO de la barra entregada -->
                  <div
                    v-if="resSim(c.id).bullet.dupW"
                    class="absolute top-1/2 left-(--l) h-2.5 w-(--w) -translate-y-1/2 bg-warning opacity-90 transition-all duration-300"
                    :style="{
                      '--l': resSim(c.id).bullet.bolsaStartPct + '%',
                      '--w': resSim(c.id).bullet.dupW + '%',
                    }"
                    :title="'Compra en bolsa (origen del suministro)'"
                  />
                  <!-- Marcas mín / máx -->
                  <div
                    v-if="resSim(c.id).bullet.hasMin"
                    class="absolute -top-px -bottom-px left-(--l) w-0.5 rounded bg-unergy-deep opacity-45"
                    :style="{ '--l': resSim(c.id).bullet.minPct + '%' }"
                    :title="'Mínimo: ' + fmtMwh(resSim(c.id).min)"
                  />
                  <div
                    v-if="resSim(c.id).bullet.hasMax"
                    class="absolute -top-px -bottom-px left-(--l) w-0.5 rounded bg-unergy-deep opacity-45"
                    :style="{ '--l': resSim(c.id).bullet.maxPct + '%' }"
                    :title="'Máximo: ' + fmtMwh(resSim(c.id).max)"
                  />
                  <!-- Proyección de cierre (diamante) -->
                  <div
                    v-if="resSim(c.id).bullet.proyPct != null"
                    class="absolute top-1/2 left-(--l) size-2.75 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-xs border-2 border-unergy-deep bg-card"
                    :style="{ '--l': resSim(c.id).bullet.proyPct + '%' }"
                    :title="'Proyección de cierre: ' + fmtMwh(resSim(c.id).genProy)"
                  />
                </div>
                <!-- Estados -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
                    :class="estadoClases(resSim(c.id).estado).badge"
                  >
                    {{ estadoLabel(resSim(c.id).estado) }}
                  </span>
                  <span
                    v-if="resSim(c.id).genProy != null && resSim(c.id).genProy! > 0"
                    class="rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
                    :class="estadoClases(resSim(c.id).estadoProy).badge"
                  >
                    ◆ proy. {{ estadoLabel(resSim(c.id).estadoProy) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Plant drop zone (collapsible) -->
            <div
              v-show="expandedContratos.includes(c.id)"
              class="sim-plant-zone max-h-55 min-h-16 space-y-1.5 overflow-y-auto p-3"
            >
              <div
                v-for="p in simAssignments[c.id] || []"
                :key="p.id"
                draggable="true"
                class="flex cursor-grab items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs select-none"
                :class="[
                  p.comprado_por_unergy
                    ? 'border-warning/40 bg-warning/12'
                    : 'border-unergy-purple/15 bg-unergy-purple/8',
                  dragPlanta && dragPlanta.id === p.id ? 'opacity-35' : '',
                ]"
                @dragstart="onDragStart(p, c.id)"
                @dragend="onDragEnd"
              >
                <div class="min-w-0">
                  <span class="block max-w-32 truncate font-medium text-unergy-deep">{{
                    p.nombre
                  }}</span>
                  <span
                    v-if="p.es_duplicado && !p.comprado_por_unergy"
                    class="mt-0.5 inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                    :title="'Compra en bolsa — cuenta para el contrato, origen bolsa'"
                    ><ShoppingCartIcon class="size-3" />Compra bolsa</span
                  >
                  <span
                    v-else-if="p.comprado_por_unergy"
                    class="mt-0.5 inline-block rounded bg-warning/25 px-1.5 py-0.5 text-xs font-semibold text-warning"
                    :title="p.contrato_compra_nombre || 'Contrato de compra'"
                    >Compra Unergy</span
                  >
                </div>
                <div class="flex-shrink-0 text-right">
                  <div
                    class="font-mono font-semibold"
                    :class="
                      p.es_duplicado || p.comprado_por_unergy
                        ? 'text-warning'
                        : 'text-unergy-purple'
                    "
                  >
                    {{ p.month_mwh != null ? fmtMwh(p.month_mwh * p.pct_despacho) : '—' }}
                  </div>
                  <div class="text-muted-foreground">{{ (p.pct_despacho * 100).toFixed(0) }}%</div>
                </div>
              </div>
              <div
                v-if="dragOver === c.id"
                class="flex items-center justify-center rounded-lg border border-dashed border-unergy-purple/40 bg-unergy-purple/4 py-3 text-xs text-unergy-purple"
              >
                Soltar aquí
              </div>
              <div
                v-else-if="!(simAssignments[c.id] || []).length"
                class="flex items-center justify-center rounded-lg border border-dashed border-unergy-deep/12 py-3 text-xs text-unergy-deep/22"
              >
                Arrastra plantas aquí
              </div>
            </div>
          </div>
        </div>

        <!-- Sin contrato pool -->
        <div
          class="rounded-xl border bg-card p-4 transition-shadow"
          :class="
            dragOver === 'none'
              ? 'border-unergy-purple ring-2 ring-unergy-purple/18'
              : 'border-unergy-deep/12'
          "
          @dragover.prevent="dragOver = 'none'"
          @drop.prevent="onDrop(null)"
        >
          <p class="mb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Sin contrato
            <span class="ml-1 font-normal tracking-normal text-unergy-deep/30 normal-case"
              >(no contribuye al cumplimiento)</span
            >
          </p>
          <div class="flex min-h-8 flex-wrap gap-2">
            <div
              v-for="p in simAssignments['none'] || []"
              :key="p.id"
              draggable="true"
              class="flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs select-none"
              :class="[
                p.comprado_por_unergy
                  ? 'border-warning/40 bg-warning/15'
                  : 'border-unergy-deep/10 bg-unergy-deep/6',
                dragPlanta && dragPlanta.id === p.id ? 'opacity-35' : '',
              ]"
              @dragstart="onDragStart(p, null)"
              @dragend="onDragEnd"
            >
              <span class="font-medium text-unergy-deep">{{ p.nombre }}</span>
              <span
                v-if="p.es_duplicado && !p.comprado_por_unergy"
                class="rounded bg-warning/22 px-1.5 py-0.5 font-semibold text-warning"
                :title="'Compra en bolsa'"
                >Bolsa</span
              >
              <span
                v-else-if="p.comprado_por_unergy"
                class="rounded bg-warning/25 px-1.5 py-0.5 font-semibold text-warning"
                :title="p.contrato_compra_nombre || 'Contrato de compra'"
                >Compra</span
              >
              <span
                class="font-mono"
                :class="
                  p.es_duplicado || p.comprado_por_unergy ? 'text-warning' : 'text-muted-foreground'
                "
              >
                {{ p.month_mwh != null ? fmtMwh(p.month_mwh) : '—' }}
              </span>
            </div>
            <div
              v-if="dragOver === 'none'"
              class="flex items-center justify-center rounded-lg border border-dashed border-unergy-purple/40 bg-unergy-purple/4 px-4 py-1.5 text-xs text-unergy-purple"
            >
              Soltar aquí
            </div>
            <span
              v-else-if="!(simAssignments['none'] || []).length"
              class="py-1 text-xs text-unergy-deep/30"
            >
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
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(pcYear)"
            @update:model-value="
              (v) => {
                pcYear = Number(v)
                loadPlantasContratos()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Mes</label>
          <Select
            :model-value="String(pcMonth)"
            @update:model-value="
              (v) => {
                pcMonth = Number(v)
                loadPlantasContratos()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <!-- Estados estandarizados a-f (catálogo GET /clasificacion-energia/categorias) -->
        <div class="flex flex-wrap items-end gap-3">
          <div v-for="grupo in PC_GRUPOS" :key="grupo.label" class="flex flex-col gap-1">
            <span class="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">{{
              grupo.label
            }}</span>
            <div class="flex overflow-hidden rounded-lg border border-unergy-deep/15">
              <button
                v-for="mode in grupo.modes"
                :key="mode.key"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="pcMode === mode.key ? mode.tono : 'bg-transparent text-muted-foreground'"
                @click="pcMode = mode.key"
              >
                {{ mode.agente }}
                <span
                  v-if="pcCounts"
                  class="rounded bg-unergy-deep/8 px-1 font-mono text-xs"
                  :title="pcFechaCorte ? `Vigentes al ${pcFechaCorte}` : 'Vigentes'"
                  >{{ pcCountsVigentes[mode.key] ?? 0 }}</span
                >
                <span
                  v-if="pcCountsTerminados[mode.key]"
                  class="rounded bg-destructive/14 px-1 font-mono text-xs text-destructive"
                  :title="`${pcCountsTerminados[mode.key]} terminaron durante el mes (siguen listados abajo, en rojo)`"
                  >+{{ pcCountsTerminados[mode.key] }}</span
                >
              </button>
            </div>
          </div>
        </div>
        <span class="max-w-md text-xs text-muted-foreground">
          {{ PC_MODE_DESC[pcMode] }}
          <span v-if="pcFechaCorte" class="mt-0.5 block text-muted-foreground/70">
            El contador cuenta lo vigente al {{ pcFechaCorte }}; en
            <span class="font-semibold text-destructive">rojo</span> lo que terminó durante el mes.
          </span>
        </span>
        <Button
          variant="outline"
          size="sm"
          class="ml-auto border-primary text-primary"
          :disabled="!pcData || pcLoading"
          title="Descarga TODAS las categorías del mes, incl. plantas externas (todos los contratos y plantas), sin importar el filtro activo"
          @click="exportarResumenPlantasContratos"
        >
          <FileSpreadsheetIcon />
          Exportar resumen (Excel)
        </Button>
      </div>

      <div v-if="pcLoading" class="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner class="size-12" />
        <p class="text-sm text-muted-foreground">Cargando plantas y contratos…</p>
      </div>

      <Alert v-else-if="pcError" variant="destructive">
        <AlertDescription>{{ pcError }}</AlertDescription>
      </Alert>

      <template v-else-if="pcData">
        <!-- a. PPA Venta (UNGG) -->
        <template v-if="pcMode === 'ppa_venta_ungg'">
          <!-- Filtro por modalidad de suministro: propio / compra en bolsa / uso del recurso -->
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class="mr-1 text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase"
              >Modalidad</span
            >
            <button
              class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:border-primary/40 hover:bg-foreground/4"
              :class="
                pcModalidad === null
                  ? 'border-unergy-purple bg-unergy-purple/10 font-bold text-unergy-purple'
                  : 'border-foreground/12 bg-card text-foreground'
              "
              :title="'Todas las plantas del contrato de venta'"
              @click="pcModalidad = null"
            >
              Todas <b class="ml-0.5">{{ pcVentaDupInfo.total }}</b>
            </button>
            <button
              v-for="f in PC_MODALIDAD_FILTROS"
              :key="f.key"
              class="inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:border-primary/40 hover:bg-foreground/4"
              :class="
                pcModalidad === f.key
                  ? `${f.activo} font-bold`
                  : 'border-foreground/12 bg-card text-foreground'
              "
              :title="f.tip"
              @click="pcModalidad = pcModalidad === f.key ? null : f.key"
            >
              <span class="inline-block size-2 rounded-full" :class="f.punto"></span>
              {{ f.label }} <b class="ml-0.5">{{ pcModalidadCounts[f.key] }}</b>
            </button>
          </div>

          <!-- Resumen de modalidades: duplicados (compra en bolsa) y uso del recurso -->
          <div
            v-if="pcVentaDupInfo.dup || pcVentaDupInfo.ur"
            class="flex flex-col gap-1 rounded-lg border border-unergy-deep/12 bg-unergy-deep/3 px-4 py-2.5 text-xs text-unergy-deep"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                ><b>{{ pcVentaDupInfo.total }}</b> plantas en total.</span
              >
              <span v-if="pcVentaDupInfo.dup" class="inline-flex items-center gap-1 text-warning">
                <ShoppingCartIcon class="size-3" /><b>{{ pcVentaDupInfo.dup }}</b>
                duplicados (compra en bolsa)
              </span>
              <span v-if="pcVentaDupInfo.ur" class="inline-flex items-center gap-1 text-chart-3">
                <RefreshCwIcon class="size-3" /><b>{{ pcVentaDupInfo.ur }}</b>
                uso del recurso
              </span>
              <span class="text-muted-foreground">· resto suministro propio.</span>
            </div>
            <span class="text-muted-foreground">
              Duplicados y uso del recurso también aparecen en «Compra en bolsa (UNGG)» — el
              duplicado se compra en bolsa (genera garantías); el uso del recurso se le paga al
              cliente a precio bolsa (sin garantías).
            </span>
          </div>
          <div
            v-if="!ppaVentaFiltrado.length"
            class="py-12 text-center text-sm text-muted-foreground"
          >
            <template v-if="pcModalidad"
              >No hay plantas de «{{
                PC_MODALIDAD_FILTROS.find((f) => f.key === pcModalidad)?.label
              }}» en {{ MESES[pcMonth - 1] }} {{ pcYear }}.</template
            >
            <template v-else
              >No hay contratos de venta (UNGG) vigentes en {{ MESES[pcMonth - 1] }}
              {{ pcYear }}.</template
            >
          </div>
          <div
            v-for="c in ppaVentaFiltrado"
            :key="c.id"
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div
              class="flex cursor-pointer items-center justify-between border-b border-b-unergy-deep/7 bg-unergy-purple/4 px-4 py-3 transition-colors hover:bg-primary/6"
              :title="'Ver detalle del contrato (PPA + GESCON)'"
              @click="abrirDetalleContrato(c, 'ppa_venta_ungg')"
            >
              <div>
                <span class="text-sm font-bold text-unergy-deep">{{ c.nombre }}</span>
                <span class="ml-2 text-xs text-muted-foreground">{{ c.comprador_nombre }}</span
                ><span
                  v-if="esOculto(c)"
                  class="ml-1.5 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                  :title="'Responsable: ' + c.responsable + ' — normalmente oculto en Cumplimiento'"
                  >{{ c.responsable }}</span
                >
                <InfoIcon class="ml-1.5 size-3 text-muted-foreground/70" />
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <span
                  class="rounded bg-unergy-purple/10 px-2 py-0.5 font-mono text-xs text-unergy-purple"
                >
                  {{ c.plantas.length }} plantas
                </span>
                <span
                  v-if="c.plantas.filter((p) => p.es_duplicado && !p.uso_del_recurso).length"
                  class="inline-flex items-center gap-1 rounded bg-warning/22 px-2 py-0.5 text-xs font-semibold text-warning"
                  :title="'Plantas de este contrato que son compra en bolsa (duplicados)'"
                >
                  <ShoppingCartIcon class="size-3" />{{
                    c.plantas.filter((p) => p.es_duplicado && !p.uso_del_recurso).length
                  }}
                  duplicadas
                </span>
                <span
                  v-if="c.plantas.filter((p) => p.uso_del_recurso).length"
                  class="inline-flex items-center gap-1 rounded bg-chart-3/14 px-2 py-0.5 text-xs font-semibold text-chart-3"
                  :title="'Plantas de este contrato marcadas como uso del recurso'"
                >
                  <RefreshCwIcon class="size-3" />{{
                    c.plantas.filter((p) => p.uso_del_recurso).length
                  }}
                  uso recurso
                </span>
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                  :class="
                    copiadoVentaId === c.id
                      ? 'bg-success/12 text-success'
                      : 'bg-unergy-purple text-primary-foreground'
                  "
                  :title="'Copia la imagen al portapapeles (o la descarga si el navegador no lo permite)'"
                  @click.stop="copiarImagenVenta(c)"
                >
                  <CheckIcon v-if="copiadoVentaId === c.id" class="size-3" />
                  <ImageIcon v-else class="size-3" />
                  {{ copiadoVentaId === c.id ? '¡Copiado!' : 'Copiar imagen' }}
                </button>
              </div>
            </div>
            <div v-if="c.plantas.length" class="divide-y border-unergy-deep/5">
              <div
                v-for="p in c.plantas"
                :key="filaKey(p)"
                class="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary/6"
                :class="p.uso_del_recurso ? 'bg-chart-3/6' : p.es_duplicado ? 'bg-warning/8' : ''"
                :title="'Ver detalle del contrato (PPA + GESCON)'"
                @click="abrirDetalleContrato(c, 'ppa_venta_ungg')"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span
                    v-if="filaTerminada(p)"
                    class="inline-flex items-center gap-1 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                    :title="'Salió de esta modalidad durante el mes — su tramo siguiente está en otra piscina'"
                    ><LogOutIcon class="size-3" />Terminó</span
                  >
                  <span
                    v-if="p.uso_del_recurso"
                    class="inline-flex items-center gap-1 rounded bg-chart-3/14 px-1.5 py-0.5 text-xs font-semibold text-chart-3"
                    :title="'Uso del recurso: la planta está en bolsa y se le paga al cliente su generación a precio bolsa — también listada en c. Compra en Bolsa (UNGG). No genera garantías.'"
                    ><RefreshCwIcon class="size-3" />Uso del recurso</span
                  >
                  <span
                    v-else-if="p.es_duplicado"
                    class="inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                    :title="'Duplicado: suministra a este contrato con origen bolsa — también listado en c. Compra en Bolsa (UNGG). Genera garantías.'"
                    ><ShoppingCartIcon class="size-3" />Duplicado</span
                  >
                  <span
                    v-if="p.codigo_sic"
                    class="rounded bg-unergy-deep/6 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >{{ p.codigo_sic }}</span
                  >
                  <span v-if="p.pct_despacho != null" class="font-mono text-xs text-unergy-purple"
                    >{{ (p.pct_despacho * 100).toFixed(0) }}%</span
                  >
                </div>
                <div
                  class="text-right font-mono text-xs"
                  :class="filaColorFecha(p) || 'text-muted-foreground'"
                >
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-4 text-center text-xs text-unergy-deep/30">
              Sin plantas asignadas en GESCON para {{ MESES[pcMonth - 1] }} {{ pcYear }}
            </div>
          </div>
        </template>

        <!-- b. PPA Compra (UNGC) -->
        <template v-if="pcMode === 'ppa_compra_ungc'">
          <div
            v-if="!pcPools.ppa_compra_ungc.length"
            class="py-12 text-center text-sm text-muted-foreground"
          >
            No hay contratos de compra vigentes en {{ MESES[pcMonth - 1] }} {{ pcYear }}
          </div>
          <div
            v-for="c in pcPools.ppa_compra_ungc"
            :key="c.id"
            class="overflow-hidden rounded-2xl border border-warning/50 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-warning/90 hover:shadow-md"
          >
            <div
              class="flex cursor-pointer items-center justify-between border-b border-b-warning/20 bg-warning/8 px-4 py-3 transition-colors hover:bg-primary/6"
              :title="'Ver detalle del contrato (PPA + GESCON)'"
              @click="abrirDetalleContrato(c, 'ppa_compra_ungc')"
            >
              <div>
                <span class="text-sm font-bold text-warning">{{ c.nombre }}</span>
                <span class="ml-2 text-xs text-muted-foreground"
                  >Vendedor: {{ c.vendedor_nombre }}</span
                >
                <InfoIcon class="ml-1.5 size-3 text-muted-foreground/70" />
              </div>
              <span class="rounded bg-warning/18 px-2 py-0.5 font-mono text-xs text-warning">
                {{ c.plantas.length }} plantas
              </span>
            </div>
            <div v-if="c.plantas.length" class="divide-y border-unergy-deep/5">
              <div
                v-for="p in c.plantas"
                :key="filaKey(p)"
                class="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary/6"
                :title="'Ver detalle del contrato (PPA + GESCON)'"
                @click="abrirDetalleContrato(c, 'ppa_compra_ungc')"
              >
                <span class="font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</span>
                <div
                  class="text-right font-mono text-xs"
                  :class="filaColorFecha(p) || 'text-muted-foreground'"
                >
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- g. Plantas externas: PPAs de compra directa a terceros, fuera de GESCON -->
        <template v-if="pcMode === 'ppa_compra_externa'">
          <Alert v-if="externasSinPlantas.length" class="border-warning/40 bg-warning/5">
            <AlertDescription>
              <span v-if="externasSinPlantas.length === 1">
                El contrato <b>{{ externasSinPlantas[0]!.nombre }}</b> no tiene plantas vinculadas:
                no sabemos a qué planta le estamos comprando. Asóciala en el módulo PPA.
              </span>
              <span v-else>
                {{ externasSinPlantas.length }} contratos de compra externa no tienen plantas
                vinculadas: <b>{{ externasSinPlantas.map((c) => c.nombre).join(', ') }}</b
                >. Asócialas en el módulo PPA para saber a qué planta le compramos.
              </span>
            </AlertDescription>
          </Alert>
          <div
            v-if="!pcPools.ppa_compra_externa.length"
            class="py-12 text-center text-sm text-muted-foreground"
          >
            No hay PPAs de compra a plantas externas vigentes en {{ MESES[pcMonth - 1] }}
            {{ pcYear }}.<br />
            <span class="text-xs"
              >Se registran en el módulo PPA con tipo de contrato «compra» (sin código
              GESCON).</span
            >
          </div>
          <div
            v-for="c in pcPools.ppa_compra_externa"
            :key="c.id"
            class="overflow-hidden rounded-2xl border border-warning/50 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-warning/90 hover:shadow-md"
          >
            <div
              class="flex cursor-pointer items-center justify-between border-b border-b-warning/20 bg-warning/8 px-4 py-3 transition-colors hover:bg-primary/6"
              :title="'Ver detalle del contrato PPA'"
              @click="abrirDetalleContrato(c, 'ppa_compra_externa')"
            >
              <div>
                <span class="text-sm font-bold text-warning">{{ c.nombre }}</span>
                <span class="ml-2 text-xs text-muted-foreground">
                  Le compramos a:
                  <span class="font-semibold text-unergy-deep">{{ c.vendedor_nombre || '—' }}</span>
                  <span v-if="c.vendedor_nit"> · NIT {{ c.vendedor_nit }}</span>
                </span>
                <InfoIcon class="ml-1.5 size-3 text-muted-foreground/70" />
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <span
                  v-if="c.tarifa_base != null"
                  class="rounded bg-warning/18 px-2 py-0.5 font-mono text-xs text-warning"
                  :title="'Tarifa base del PPA'"
                  >{{ Number(c.tarifa_base).toLocaleString('es-CO') }} $/kWh</span
                >
                <span
                  v-if="!c.plantas.length"
                  class="inline-flex items-center gap-1 rounded bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive"
                  :title="'No sabemos a qué planta le compramos — asóciala en el módulo PPA'"
                >
                  <TriangleAlertIcon class="size-3" />Sin plantas vinculadas
                </span>
                <span
                  v-else
                  class="rounded bg-warning/18 px-2 py-0.5 font-mono text-xs text-warning"
                >
                  {{ c.plantas.length }} plantas
                </span>
              </div>
            </div>
            <div v-if="c.plantas.length" class="divide-y border-unergy-deep/5">
              <div
                v-for="p in c.plantas"
                :key="filaKey(p)"
                class="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary/6"
                :title="'Ver detalle del contrato PPA'"
                @click="abrirDetalleContrato(c, 'ppa_compra_externa')"
              >
                <span class="font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</span>
                <div
                  class="text-right font-mono text-xs"
                  :class="filaColorFecha(p) || 'text-muted-foreground'"
                >
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-4 text-center text-xs text-unergy-deep/30">
              Sin plantas vinculadas — asócialas al contrato en el módulo PPA
            </div>
          </div>
        </template>

        <!-- c. Compra en Bolsa (UNGG): duplicados agrupados por el contrato al que aportan -->
        <template v-if="pcMode === 'bolsa_compra_ungg'">
          <div
            v-if="!pcPools.bolsa_compra_ungg.length"
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="px-4 py-8 text-center text-xs text-unergy-deep/35">
              Sin compras en bolsa de UNGG en {{ MESES[pcMonth - 1] }} {{ pcYear }}.<br />
              Aquí aparecen las plantas duplicadas (origen bolsa) y las de uso del recurso que
              aportan a un contrato de venta. Los contratos PLC entrarán cuando se liquiden en
              plataforma.
            </div>
          </div>
          <div
            v-if="pcPools.bolsa_compra_ungg.length"
            class="flex flex-col gap-1.5 rounded-lg border border-unergy-deep/12 bg-unergy-deep/3 px-4 py-2.5 text-xs text-unergy-deep"
          >
            <span>
              La misma planta también suministra a un contrato de venta (aparece en «Venta · UNGG»);
              aquí se agrupa por el contrato al que aporta. Hay <b>dos modalidades</b>:
            </span>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span class="inline-flex items-center gap-1 text-warning">
                <ShoppingCartIcon class="size-3" /><b>Duplicado</b> — su energía se compra en bolsa
                (genera garantías).
              </span>
              <span class="inline-flex items-center gap-1 text-chart-3">
                <RefreshCwIcon class="size-3" /><b>Uso del recurso</b> — se le paga al cliente a
                precio bolsa (sin garantías).
              </span>
            </div>
          </div>
          <div
            v-for="c in pcPools.bolsa_compra_ungg"
            :key="c.id"
            class="overflow-hidden rounded-2xl border border-warning/50 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-warning/90 hover:shadow-md"
          >
            <div
              class="flex cursor-pointer items-center justify-between border-b border-b-warning/20 bg-warning/8 px-4 py-3 transition-colors hover:bg-primary/6"
              :title="'Ver detalle del contrato (PPA + GESCON)'"
              @click="abrirDetalleContrato(c, 'bolsa_compra_ungg')"
            >
              <div>
                <span class="text-sm font-bold text-warning">{{ c.nombre }}</span>
                <span class="ml-2 text-xs text-muted-foreground"
                  >compra en bolsa para cumplir este contrato · {{ c.comprador_nombre }}</span
                >
                <InfoIcon class="ml-1.5 size-3 text-muted-foreground/70" />
              </div>
              <span class="rounded bg-warning/18 px-2 py-0.5 font-mono text-xs text-warning">
                {{ c.plantas.length }} plantas
              </span>
            </div>
            <div class="divide-y border-unergy-deep/5">
              <div
                v-for="p in c.plantas"
                :key="filaKey(p)"
                class="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary/6"
                :title="'Ver detalle del contrato (PPA + GESCON)'"
                @click="abrirDetalleContrato(c, 'bolsa_compra_ungg')"
              >
                <div class="flex items-center gap-2">
                  <RefreshCwIcon v-if="p.uso_del_recurso" class="size-3 text-chart-3" />
                  <ShoppingCartIcon v-else class="size-3 text-warning" />
                  <span class="font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span
                    v-if="p.uso_del_recurso"
                    class="inline-flex items-center gap-1 rounded bg-chart-3/14 px-1.5 py-0.5 text-xs font-semibold text-chart-3"
                    :title="'Uso del recurso: la planta está en bolsa y también suministra a un contrato de venta (Venta · UNGG); se le paga al cliente a precio bolsa. No genera garantías.'"
                    >Uso del recurso</span
                  >
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                    :title="'Duplicado: esta planta también suministra a un contrato de venta (Venta · UNGG); su energía a este contrato se compra en bolsa. Genera garantías.'"
                    >Duplicado</span
                  >
                  <span
                    v-if="p.codigo_sic"
                    class="rounded bg-unergy-deep/6 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >{{ p.codigo_sic }}</span
                  >
                </div>
                <div
                  class="font-mono text-xs"
                  :class="filaColorFecha(p) || 'text-muted-foreground'"
                >
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- d. Compra en Bolsa (UNGC): reglas por definir -->
        <template v-if="pcMode === 'bolsa_compra_ungc'">
          <div
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="space-y-2 px-4 py-10 text-center">
              <CompassIcon class="size-6 text-muted-foreground/70" />
              <p class="text-sm font-semibold text-unergy-deep">
                Compra en Bolsa (UNGC) — reglas por definir
              </p>
              <p class="mx-auto max-w-lg text-xs text-muted-foreground">
                Ocurre cuando UNGC debe comprar en bolsa, pero todavía no hay reglas de negocio
                definidas para clasificarlo. La categoría queda reservada en el estándar (<span
                  class="font-mono"
                  >bolsa_compra_ungc</span
                >) y se activará cuando se definan.
              </p>
            </div>
          </div>
        </template>

        <!-- e. Venta en Bolsa (UNGG): sin contrato GESCON -->
        <template v-if="pcMode === 'bolsa_venta_ungg'">
          <div
            v-if="pcPools.bolsa_venta_ungg.length"
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="border-b border-b-unergy-deep/7 bg-unergy-deep/4 px-4 py-3">
              <span class="text-sm font-bold text-unergy-deep">Venta en Bolsa (UNGG)</span>
              <span class="ml-2 text-xs text-muted-foreground"
                >Días de {{ MESES[pcMonth - 1] }} {{ pcYear }} sin contrato en GESCON — venden en
                bolsa como generador</span
              >
              <span
                class="ml-2 rounded bg-unergy-deep/8 px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {{ pcPools.bolsa_venta_ungg.length }}
              </span>
            </div>
            <div class="divide-y border-unergy-deep/5">
              <div
                v-for="p in pcPools.bolsa_venta_ungg"
                :key="filaKey(p)"
                class="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-primary/6"
                :title="'Ver historial GESCON de la planta'"
                @click="abrirDetallePlanta(p, 'bolsa_venta_ungg')"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</span>
                  <span
                    v-if="filaTerminada(p)"
                    class="inline-flex items-center gap-1 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                    :title="'Estuvo libre en bolsa solo este tramo del mes; después entró a otra modalidad'"
                    ><LogOutIcon class="size-3" />Terminó</span
                  >
                </div>
                <div
                  class="font-mono text-xs"
                  :class="filaColorFecha(p) || 'text-muted-foreground'"
                >
                  {{ ventanaFila(p) }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="px-4 py-8 text-center text-xs text-unergy-deep/30">
              Todas las plantas tuvieron asignación GESCON todos los días del mes
            </div>
          </div>
        </template>

        <!-- f. Venta en Bolsa (UNGC): SIC vigente con comprador UNGC -->
        <template v-if="pcMode === 'bolsa_venta_ungc'">
          <div
            v-if="pcPools.bolsa_venta_ungc.length"
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="border-b border-b-unergy-deep/7 bg-unergy-deep/4 px-4 py-3">
              <span class="text-sm font-bold text-unergy-deep">Venta en Bolsa (UNGC)</span>
              <span class="ml-2 text-xs text-muted-foreground"
                >UNGC compra la energía a UNGG (usualmente a precio de bolsa) para venderla en bolsa
                — SIC vigente con comprador UNGC</span
              >
              <span
                class="ml-2 rounded bg-unergy-deep/8 px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {{ pcPools.bolsa_venta_ungc.length }}
              </span>
            </div>
            <div class="divide-y border-unergy-deep/5">
              <div
                v-for="p in pcPools.bolsa_venta_ungc"
                :key="filaKey(p)"
                class="cursor-pointer px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/6"
                :class="filaColorNombre(p)"
                :title="'Ver detalle GESCON de la planta'"
                @click="abrirDetallePlanta(p, 'bolsa_venta_ungc')"
              >
                <div class="flex items-center gap-2">
                  <span>{{ p.nombre }}</span>
                  <span
                    v-if="p.codigo_sic"
                    class="rounded bg-unergy-deep/6 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >{{ p.codigo_sic }}</span
                  >
                  <span
                    v-if="filaTerminada(p)"
                    class="inline-flex items-center gap-1 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                    :title="'Estuvo en esta modalidad solo un tramo del mes'"
                    ><LogOutIcon class="size-3" />Terminó</span
                  >
                </div>
                <div
                  v-if="ventanaBolsa(p)"
                  class="mt-0.5 text-xs text-muted-foreground"
                  :title="'Vigencia del registro SIC con comprador UNGC que pone la planta en esta modalidad'"
                >
                  <CalendarIcon class="size-3" /> {{ ventanaBolsa(p) }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <div class="px-4 py-8 text-center text-xs text-unergy-deep/30">
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
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(etYear)"
            @update:model-value="
              (v) => {
                etYear = Number(v)
                onEtPeriodChange()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in etYearOptions" :key="y" :value="String(y)">{{
                y
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Mes</label>
          <Select
            :model-value="String(etMonth)"
            @update:model-value="
              (v) => {
                etMonth = Number(v)
                onEtPeriodChange()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in etMonthOptions" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span v-if="etData" class="rounded bg-unergy-purple/8 px-2 py-1 text-xs text-unergy-purple">
          {{ etPeriodoLabel }}
        </span>
        <span
          v-if="etFromCache"
          class="rounded bg-unergy-deep/6 px-2 py-1 text-xs text-muted-foreground"
          title="Datos del histórico guardado en este navegador"
        >
          <HistoryIcon class="mr-1 size-3" />histórico local
        </span>
      </div>

      <div v-if="etLoading" class="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner class="size-12" />
        <p class="text-sm text-muted-foreground">
          Consultando energía transada de {{ MESES[etMonth - 1] }}…
        </p>
      </div>

      <Alert v-else-if="etError" variant="destructive">
        <AlertDescription>{{ etError }}</AlertDescription>
      </Alert>

      <template v-else-if="etData">
        <Alert v-if="etData.warning" class="border-warning/40 bg-warning/5">
          <AlertDescription>{{ etData.warning }}</AlertDescription>
        </Alert>

        <!-- Summary cards -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card px-4 py-3 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <p class="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Total transada
            </p>
            <p class="font-mono text-2xl font-bold text-unergy-deep">
              {{ fmtMwh(etData.totales.gen_mwh) }} <span class="text-sm font-normal">MWh</span>
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ etData.totales.n_plantas }} proyectos con datos
            </p>
          </div>
          <div
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card px-4 py-3 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <p class="mb-1 text-xs font-semibold tracking-wider text-unergy-purple uppercase">
              Vía PPA
            </p>
            <p class="font-mono text-2xl font-bold text-unergy-purple">
              {{ fmtMwh(etData.totales.ppa_mwh) }} <span class="text-sm font-normal">MWh</span>
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ etPct(etData.totales.ppa_mwh) }}% del total
            </p>
          </div>
          <div
            class="overflow-hidden rounded-2xl border border-foreground/7 bg-card px-4 py-3 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <p class="mb-1 text-xs font-semibold tracking-wider text-unergy-deep uppercase">
              En bolsa
            </p>
            <p class="font-mono text-2xl font-bold text-unergy-deep">
              {{ fmtMwh(etData.totales.bolsa_mwh) }} <span class="text-sm font-normal">MWh</span>
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ etPct(etData.totales.bolsa_mwh) }}% del total
            </p>
          </div>
        </div>

        <!-- Tabla por proyecto -->
        <div
          class="overflow-hidden rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
        >
          <table class="w-full text-sm">
            <thead>
              <tr
                class="bg-unergy-purple/4 text-xs font-bold tracking-wider text-muted-foreground uppercase"
              >
                <th class="px-4 py-3 text-left">Proyecto</th>
                <th class="px-2 py-3 text-left">Cómo se transó</th>
                <th class="px-2 py-3 text-right">PPA (MWh)</th>
                <th class="px-2 py-3 text-right">Bolsa (MWh)</th>
                <th class="px-4 py-3 text-right">Total (MWh)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in etData.plantas" :key="p.id" class="border-t border-t-unergy-deep/6">
                <td class="px-4 py-2.5 font-medium text-unergy-deep">
                  {{ p.nombre }}
                  <span
                    v-if="p.modo === 'sin_datos'"
                    class="ml-1 rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                    >sin datos</span
                  >
                </td>
                <td class="px-2 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="c in p.contratos.filter((c) => !c.es_duplicado)"
                      :key="c.id"
                      class="rounded bg-unergy-purple/10 px-1.5 py-0.5 text-xs font-medium text-unergy-purple"
                      :title="`${c.dias_activos} días activos`"
                    >
                      {{ c.nombre }} · {{ (c.pct * 100).toFixed(0) }}%
                    </span>
                    <span
                      v-if="p.modo === 'bolsa' || p.modo === 'mixto'"
                      class="rounded bg-unergy-deep/8 px-1.5 py-0.5 text-xs font-medium text-unergy-deep"
                      >Bolsa</span
                    >
                    <span v-if="p.modo === 'sin_datos'" class="text-xs text-muted-foreground"
                      >—</span
                    >
                  </div>
                </td>
                <td class="px-2 py-2.5 text-right font-mono text-unergy-purple">
                  {{ p.ppa_mwh !== null ? fmtMwh(p.ppa_mwh) : '—' }}
                </td>
                <td class="px-2 py-2.5 text-right font-mono text-unergy-deep">
                  {{ p.bolsa_mwh !== null ? fmtMwh(p.bolsa_mwh) : '—' }}
                </td>
                <td class="px-4 py-2.5 text-right font-mono font-semibold text-unergy-deep">
                  {{ p.gen_mwh !== null ? fmtMwh(p.gen_mwh) : '—' }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-t-unergy-deep/12 bg-unergy-purple/4">
                <td class="px-4 py-3 font-bold text-unergy-deep">TOTAL ENERGÍA TRANSADA</td>
                <td></td>
                <td class="px-2 py-3 text-right font-mono font-bold text-unergy-purple">
                  {{ fmtMwh(etData.totales.ppa_mwh) }}
                </td>
                <td class="px-2 py-3 text-right font-mono font-bold text-unergy-deep">
                  {{ fmtMwh(etData.totales.bolsa_mwh) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-base font-bold text-unergy-deep">
                  {{ fmtMwh(etData.totales.gen_mwh) }}
                </td>
              </tr>
            </tfoot>
          </table>
          <div
            v-if="!etData.plantas.length"
            class="px-4 py-10 text-center text-sm text-unergy-deep/35"
          >
            Sin proyectos con energía transada en {{ MESES[etMonth - 1] }} {{ etYear }}
          </div>
        </div>
      </template>
    </div>

    <!-- ═══════════════ MATRIZ ANUAL TAB ═══════════════ -->
    <div v-show="activeTab === 4" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <Select
            :model-value="String(anualMatrizYear)"
            @update:model-value="
              (v) => {
                anualMatrizYear = Number(v)
                loadAnualMatriz()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
          <label class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Checkbox
              :model-value="matrizSoloNoCumple"
              @update:model-value="(v) => (matrizSoloNoCumple = v === true)"
            />
            Solo no cumple
          </label>
          <Input v-model="matrizBusqueda" placeholder="Buscar contrato…" class="text-sm" />
          <MultiComboBox
            v-model="matrizContratosSel"
            :options="matrizContratoOpts"
            placeholder="Todos los contratos"
            class="min-w-52 text-sm"
          />
          <MultiComboBox
            v-model="matrizOfftakersSel"
            :options="matrizOfftakerOpts"
            placeholder="Todos los offtakers"
            class="min-w-48 text-sm"
          />
        </div>
        <div class="flex items-center gap-2">
          <span v-if="matrizFilasCargando" class="text-xs text-muted-foreground"
            >Cargando contratos…</span
          >
          <Button
            variant="outline"
            size="sm"
            :disabled="!anualMatrizData || matrizFilasCargando"
            @click="exportarMatrizExcel"
          >
            <DownloadIcon />
            Exportar Excel
          </Button>
        </div>
      </div>
      <Spinner v-if="anualMatrizLoading" class="size-8" />
      <Alert v-else-if="anualMatrizError" variant="destructive">
        <AlertDescription>{{ anualMatrizError }}</AlertDescription>
      </Alert>
      <div v-if="anualMatrizData" class="overflow-x-auto rounded-lg border border-unergy-deep/8">
        <table class="cv-matriz text-sm">
          <thead>
            <tr>
              <th class="sticky-col px-3 py-2 text-left">Contrato / Proyecto</th>
              <th v-for="(mes, i) in MESES" :key="i" class="px-2 py-2 text-right">
                {{ mes.slice(0, 3) }}
              </th>
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
                  <ChevronDownIcon v-if="expandedMatriz.includes(c.id)" class="mr-1 size-3" />
                  <ChevronRightIcon v-else class="mr-1 size-3" />
                  <span class="font-semibold">{{
                    c.nombre_interno || c.numero_codigo_contrato
                  }}</span>
                  <span class="ml-1 text-xs text-muted-foreground"
                    >{{ c.comprador_nombre
                    }}<span v-if="c.n_plantas != null"> · {{ c.n_plantas }} pl.</span></span
                  >
                  <span
                    v-if="c.responsable"
                    class="ml-1.5 rounded px-1.5 py-0.5 align-middle text-xs font-semibold"
                    :class="responsableChip(c)"
                    :title="
                      c.responsable_relevante === false
                        ? `Responsable: ${c.responsable} — normalmente oculto en esta matriz`
                        : `Responsable: ${c.responsable}`
                    "
                  >
                    {{ c.responsable }}
                  </span>
                  <LoaderCircleIcon
                    v-if="c._loading"
                    class="ml-1 size-3 animate-spin text-unergy-purple"
                  />
                </td>
                <td
                  v-for="i in 12"
                  :key="i"
                  class="px-2 py-1.5 text-right font-mono"
                  :class="
                    c.meses[i - 1]
                      ? estadoClases(c.meses[i - 1]!.estado).texto
                      : 'text-muted-foreground/40'
                  "
                  :title="
                    c.meses[i - 1]
                      ? estadoLabel(c.meses[i - 1]!.estado) + ' · ' + c.meses[i - 1]!.tipo_datos
                      : ''
                  "
                >
                  <span v-if="c.meses[i - 1]">{{ fmtNum(c.meses[i - 1]!.valor_mwh) }}</span>
                  <span v-else-if="c._error" class="text-destructive">!</span>
                  <span v-else class="text-muted-foreground/30">·</span>
                </td>
                <td class="px-3 py-1.5 text-right font-mono font-bold">
                  {{ c.total_anual_mwh != null ? fmtNum(c.total_anual_mwh) : '·' }}
                </td>
                <td class="px-3 py-1.5 text-center">
                  <span v-if="c._loading" class="text-xs text-muted-foreground/60">…</span>
                  <span v-else-if="c._error" class="text-xs text-destructive">error</span>
                  <span
                    v-else
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="
                      estadoClases(c.estado_cumplimiento === 'cumple' ? 'ok' : 'deficit').badge
                    "
                    :title="c.meses_en_deficit + ' mes(es) en déficit'"
                  >
                    {{ c.estado_cumplimiento === 'cumple' ? '✓ Cumple' : '✗ No cumple' }}
                  </span>
                </td>
                <td class="px-3 py-1.5 text-center">
                  <span v-if="c._loading" class="text-xs text-muted-foreground/60">…</span>
                  <span v-else-if="c._error" class="text-xs text-destructive">—</span>
                  <span
                    v-else
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="estadoClases(c.requiere_bolsa ? 'excedente' : 'ok').badge"
                    :title="
                      c.requiere_bolsa
                        ? fmtMwh(c.bolsa_anual_mwh) + ' vía bolsa'
                        : 'Cubierto con generación real'
                    "
                  >
                    {{ c.requiere_bolsa ? '◆ Bolsa' : '● Real' }}
                  </span>
                </td>
              </tr>
              <!-- Filas proyecto (expandidas) -->
              <template v-if="expandedMatriz.includes(c.id)">
                <tr v-for="p in c.proyectos" :key="c.id + '-' + p.id" class="cv-matriz-proyecto">
                  <td class="sticky-col px-3 py-1 pl-8">
                    <span>{{ p.nombre }}</span>
                    <span class="ml-1 text-xs text-muted-foreground"
                      >{{ Math.round((p.pct_despacho_rep || 0) * 100) }}% part.</span
                    >
                  </td>
                  <td
                    v-for="(m, i) in p.meses"
                    :key="i"
                    class="px-2 py-1 text-right font-mono text-xs text-muted-foreground"
                  >
                    {{ fmtNum(m.valor_mwh) }}
                  </td>
                  <td colspan="3"></td>
                </tr>
              </template>
            </template>
            <!-- Total general -->
            <tr class="cv-matriz-total">
              <td class="sticky-col px-3 py-2 font-bold">TOTAL ({{ matrizFiltrada.length }})</td>
              <td
                v-for="(t, i) in matrizTotalesMensuales"
                :key="i"
                class="px-2 py-2 text-right font-mono font-bold"
              >
                {{ fmtNum(t) }}
              </td>
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
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(beYear)"
            @update:model-value="
              (v) => {
                beYear = Number(v)
                loadBalance()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Mes</label>
          <Select
            :model-value="String(beMonth)"
            @update:model-value="
              (v) => {
                beMonth = Number(v)
                loadBalance()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span v-if="beData" class="rounded bg-unergy-purple/8 px-2 py-1 text-xs text-unergy-purple">
          {{ bePeriodoLabel }}
        </span>
        <label
          v-if="beData && beData.advertencias.compra_externa_en_bolsa.length"
          class="flex cursor-pointer items-center gap-2 rounded bg-destructive/6 px-2 py-1.5 text-xs text-unergy-deep"
        >
          <Checkbox
            :model-value="beExcluirExterna"
            @update:model-value="
              (v) => {
                beExcluirExterna = v === true
                loadBalance()
              }
            "
          />
          Excluir plantas de compra externa
        </label>
      </div>

      <div v-if="beLoading" class="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner class="size-12" />
        <p class="text-sm text-muted-foreground">
          Calculando el balance de {{ MESES[beMonth - 1] }}…
        </p>
      </div>

      <Alert v-else-if="beError" variant="destructive">
        <AlertDescription>{{ beError }}</AlertDescription>
      </Alert>

      <template v-else-if="beData">
        <Alert v-if="beData.warning" class="border-warning/40 bg-warning/5">
          <AlertDescription>{{ beData.warning }}</AlertDescription>
        </Alert>

        <Alert v-if="beData.periodo.es_mes_futuro" class="border-chart-3/40 bg-chart-3/5">
          <AlertDescription>
            {{ MESES[beMonth - 1] }} {{ beYear }} todavía no empieza: no hay generación real con la
            que construir un balance.
          </AlertDescription>
        </Alert>

        <template v-else>
          <!-- ── Libro mayor ─────────────────────────────────────────────── -->
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <!-- UNGG -->
            <div
              class="overflow-hidden rounded-2xl border border-foreground/7 bg-card px-5 py-4 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
            >
              <div class="mb-1 flex items-baseline justify-between">
                <h3 class="text-sm font-bold tracking-wider text-unergy-deep uppercase">
                  UNGG · generador
                </h3>
                <span class="text-xs text-muted-foreground">MWh</span>
              </div>
              <p class="mb-3 text-xs text-muted-foreground">
                Su venta y sus compras en bolsa se contrarrestan: es el mismo agente en la misma
                liquidación.
              </p>

              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    <th class="pb-2 text-left"></th>
                    <th class="pb-2 text-right">Real</th>
                    <th class="pb-2 text-right">Proyectado</th>
                    <th class="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="cursor-pointer transition-colors hover:bg-primary/6"
                    :class="{ 'bg-primary/10': beFiltro === 'e' }"
                    :title="beTitulo('e')"
                    @click="beAbrirCapa('e')"
                  >
                    <td
                      class="border-l-2 py-2"
                      :class="beFiltro === 'e' ? 'border-l-primary' : 'border-l-transparent'"
                    >
                      <span class="font-medium text-unergy-deep">Venta en bolsa</span>
                      <span
                        class="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-destructive/12 px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap text-destructive"
                        ><TriangleAlertIcon class="size-4" /> cargos regulatorios</span
                      >
                    </td>
                    <td class="text-right font-mono text-unergy-deep">
                      {{ fmtNum1(beB.ungg.venta_bolsa.real) }}
                    </td>
                    <td class="text-right font-mono text-muted-foreground">
                      {{ fmtNum1(beB.ungg.venta_bolsa.proyectado) }}
                    </td>
                    <td class="text-right font-mono font-semibold text-unergy-deep">
                      {{ fmtNum1(beB.ungg.venta_bolsa.total) }}
                    </td>
                  </tr>

                  <tr>
                    <td
                      colspan="4"
                      class="pt-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      Compras en bolsa
                    </td>
                  </tr>
                  <tr
                    class="cursor-pointer transition-colors hover:bg-primary/6"
                    :class="{ 'bg-primary/10': beFiltro === 'c' }"
                    :title="beTitulo('c')"
                    @click="beAbrirCapa('c')"
                  >
                    <td
                      class="border-l-2 py-2 pl-3"
                      :class="beFiltro === 'c' ? 'border-l-primary' : 'border-l-transparent'"
                    >
                      <span class="text-unergy-deep">· Directas — duplicados</span>
                      <span
                        class="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-destructive/12 px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap text-destructive"
                        ><ShieldIcon class="size-4" /> garantías</span
                      >
                    </td>
                    <td class="text-right font-mono text-unergy-deep">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_directa.real) }}
                    </td>
                    <td class="text-right font-mono text-muted-foreground">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_directa.proyectado) }}
                    </td>
                    <td class="text-right font-mono font-semibold text-unergy-deep">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_directa.total) }}
                    </td>
                  </tr>
                  <tr
                    class="cursor-pointer transition-colors hover:bg-primary/6"
                    :class="{ 'bg-primary/10': beFiltro === 'uso' }"
                    :title="beTitulo('uso')"
                    @click="beAbrirCapa('uso')"
                  >
                    <td
                      class="border-l-2 py-2 pl-3"
                      :class="beFiltro === 'uso' ? 'border-l-primary' : 'border-l-transparent'"
                    >
                      <span class="text-unergy-deep">· No directas — uso del recurso</span>
                      <span
                        class="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-foreground/7 px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground"
                        >sin garantía</span
                      >
                    </td>
                    <td class="text-right font-mono text-unergy-deep">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.real) }}
                    </td>
                    <td class="text-right font-mono text-muted-foreground">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.proyectado) }}
                    </td>
                    <td class="text-right font-mono font-semibold text-unergy-deep">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_no_directa.total) }}
                    </td>
                  </tr>
                  <tr class="border-t border-t-unergy-deep/8">
                    <td class="py-2 pl-3 text-xs font-semibold text-muted-foreground">
                      Total compras en bolsa
                    </td>
                    <td class="text-right font-mono text-xs text-muted-foreground">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_total.real) }}
                    </td>
                    <td class="text-right font-mono text-xs text-muted-foreground">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_total.proyectado) }}
                    </td>
                    <td class="text-right font-mono text-xs font-semibold text-muted-foreground">
                      −{{ fmtNum1(beB.ungg.compra_bolsa_total.total) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="border-t-2 border-t-unergy-deep/12">
                    <td class="pt-3 font-bold text-unergy-deep" :title="BE_AYUDA.neto">
                      NETO UNGG
                      <span
                        class="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap"
                        :class="beNetoClase"
                        >{{ beNetoEtiqueta }}</span
                      >
                    </td>
                    <td class="pt-3 text-right font-mono font-bold text-unergy-deep">
                      {{ fmtSigno(beB.ungg.neto.real) }}
                    </td>
                    <td class="pt-3 text-right font-mono font-bold text-muted-foreground">
                      {{ fmtSigno(beB.ungg.neto.proyectado) }}
                    </td>
                    <td class="pt-3 text-right font-mono text-base font-bold" :class="beNetoColor">
                      {{ fmtSigno(beB.ungg.neto.total) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- UNGC -->
            <div
              class="overflow-hidden rounded-2xl border border-foreground/7 bg-card px-5 py-4 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
            >
              <div class="mb-1 flex items-baseline justify-between">
                <h3 class="text-sm font-bold tracking-wider text-unergy-deep uppercase">
                  UNGC · comercializador
                </h3>
                <span class="text-xs text-muted-foreground">MWh</span>
              </div>
              <p class="mb-3 text-xs text-muted-foreground">
                Va aparte: es otro agente, así que no se contrarresta con las compras de UNGG.
              </p>

              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    <th class="pb-2 text-left"></th>
                    <th class="pb-2 text-right">Real</th>
                    <th class="pb-2 text-right">Proyectado</th>
                    <th class="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    class="cursor-pointer transition-colors hover:bg-primary/6"
                    :class="{ 'bg-primary/10': beFiltro === 'f' }"
                    :title="beTitulo('f')"
                    @click="beAbrirCapa('f')"
                  >
                    <td
                      class="border-l-2 py-2"
                      :class="beFiltro === 'f' ? 'border-l-primary' : 'border-l-transparent'"
                    >
                      <span class="font-medium text-unergy-deep">Venta en bolsa</span>
                      <span
                        class="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-chart-2/14 px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap text-chart-2"
                        >solo cartera</span
                      >
                    </td>
                    <td class="text-right font-mono text-unergy-deep">
                      {{ fmtNum1(beB.ungc.venta_bolsa.real) }}
                    </td>
                    <td class="text-right font-mono text-muted-foreground">
                      {{ fmtNum1(beB.ungc.venta_bolsa.proyectado) }}
                    </td>
                    <td class="text-right font-mono font-semibold text-unergy-deep">
                      {{ fmtNum1(beB.ungc.venta_bolsa.total) }}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="4" class="pt-3 text-xs text-muted-foreground">
                      Compra en bolsa (UNGC): reglas de negocio aún por definir — la categoría
                      existe reservada, sin filas.
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="mt-4 border-t border-t-unergy-deep/8 pt-3 text-xs text-muted-foreground">
                <p class="mb-1">
                  <strong class="text-unergy-deep">{{ beB.ungg.venta_bolsa.n_plantas }}</strong>
                  plantas venden en bolsa por UNGG ·
                  <strong class="text-unergy-deep">{{ beB.ungc.venta_bolsa.n_plantas }}</strong>
                  por UNGC
                </p>
                <p>
                  Balance de
                  <strong class="text-unergy-deep">{{ MESES[beMonth - 1] }} {{ beYear }}</strong>
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
          <Alert
            v-if="beData.advertencias.compra_externa_en_bolsa.length"
            class="border-warning/40 bg-warning/5"
          >
            <AlertDescription>
              <p class="mb-1 font-semibold">
                {{ beData.advertencias.compra_externa_en_bolsa.length }}
                {{
                  beData.advertencias.compra_externa_en_bolsa.length === 1
                    ? 'planta con PPA de compra externa está cayendo'
                    : 'plantas con PPA de compra externa están cayendo'
                }}
                en el residuo de bolsa.
              </p>
              <p class="mb-1 text-xs">
                Su energía ya está comprada por contrato fuera de GESCON, así que contarlas como
                venta en bolsa infla la línea de cargos regulatorios. Marca la casilla de arriba
                para ver el balance sin ellas.
              </p>
              <p class="font-mono text-xs">
                {{
                  beData.advertencias.compra_externa_en_bolsa
                    .map((a) => `${a.frontera} (${fmtNum1(a.mwh_total)})`)
                    .join(' · ')
                }}
              </p>
            </AlertDescription>
          </Alert>

          <Alert
            v-if="beData.advertencias.pct_anomalos.length"
            class="border-warning/40 bg-warning/5"
          >
            <AlertDescription>
              <p class="mb-1 font-semibold">Porcentajes de despacho fuera de rango en GESCON</p>
              <p class="font-mono text-xs">
                {{
                  beData.advertencias.pct_anomalos
                    .map((a) => `${a.planta} — ${a.motivo}`)
                    .join(' · ')
                }}
              </p>
            </AlertDescription>
          </Alert>

          <Alert v-if="beData.advertencias.sin_datos.length">
            <AlertDescription>
              <p class="text-xs">
                <strong>{{ beData.advertencias.sin_datos.length }}</strong> plantas sin generación
                en el mes, excluidas del balance:
                {{ beData.advertencias.sin_datos.map((a) => a.planta).join(', ') }}
              </p>
            </AlertDescription>
          </Alert>

          <Alert v-if="beData.advertencias.tramos_estimados.length">
            <AlertDescription>
              <p class="text-xs">
                {{ beData.advertencias.tramos_estimados.length }} tramos sin lecturas de su rango
                exacto: se estimaron con el promedio diario del mes.
              </p>
            </AlertDescription>
          </Alert>

          <!-- ── Inventario ──────────────────────────────────────────────── -->
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-bold text-unergy-deep">
                Inventario · {{ beFilas.length }} de {{ beData.inventario.length }} filas
              </h3>
              <span
                v-if="beFiltro"
                class="cursor-pointer rounded bg-unergy-purple/12 px-2 py-1 text-xs text-unergy-purple"
                @click="beFiltro = null"
              >
                {{ BE_CATEGORIAS[beFiltro].label }} <XIcon class="ml-1 size-3" />
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Input
                v-model="beBusqueda"
                placeholder="Buscar frontera o contrato…"
                class="min-w-48 flex-1"
              />
              <button
                class="flex items-center gap-1.5 rounded-lg bg-unergy-purple px-3 py-2 text-xs font-semibold text-primary-foreground"
                @click="exportarBalanceExcel"
              >
                <DownloadIcon class="size-3" /> Exportar
              </button>
            </div>
          </div>

          <div
            class="overflow-hidden overflow-x-auto rounded-2xl border border-foreground/7 bg-card shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/32 hover:shadow-md"
          >
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="bg-unergy-purple/4 text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >
                  <th class="px-4 py-3 text-left">Frontera</th>
                  <th class="px-2 py-3 text-left">Estado</th>
                  <th class="px-2 py-3 text-left">Método</th>
                  <th class="px-2 py-3 text-right">%</th>
                  <th class="px-2 py-3 text-left">Desde</th>
                  <th class="px-2 py-3 text-left">Hasta</th>
                  <th class="px-2 py-3 text-right">Real</th>
                  <th class="px-2 py-3 text-right">Proy.</th>
                  <th class="px-4 py-3 text-right">Total MWh</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(f, i) in beFilas"
                  :key="`${f.proyecto_id}-${f.desde}-${f.categoria}-${i}`"
                  class="border-t border-t-unergy-deep/6"
                >
                  <td class="px-4 py-2.5 font-medium text-unergy-deep">
                    {{ f.frontera }}
                    <span
                      v-if="f.frontera !== f.planta"
                      class="block text-xs text-muted-foreground"
                      >{{ f.planta }}</span
                    >
                  </td>
                  <td class="px-2 py-2.5 text-unergy-deep">
                    {{ f.estado }}
                  </td>
                  <td class="px-2 py-2.5">
                    <span
                      class="rounded px-1.5 py-0.5 text-xs font-medium"
                      :class="BE_CATEGORIAS[f.categoria].badge"
                    >
                      {{ f.metodo }}
                    </span>
                  </td>
                  <td class="px-2 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {{
                      f.pct !== null && f.pct !== undefined ? (f.pct * 100).toFixed(0) + '%' : '—'
                    }}
                  </td>
                  <td class="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                    {{ f.desde || '—' }}
                  </td>
                  <td class="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                    {{ f.hasta || '—' }}
                  </td>
                  <td class="px-2 py-2.5 text-right font-mono text-unergy-deep">
                    {{ f.mwh_real !== null ? fmtNum1(f.mwh_real) : '—' }}
                  </td>
                  <td class="px-2 py-2.5 text-right font-mono text-muted-foreground">
                    {{ f.mwh_proyectado !== null ? fmtNum1(f.mwh_proyectado) : '—' }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono font-semibold text-unergy-deep">
                    {{ f.mwh_total !== null ? fmtNum1(f.mwh_total) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!beFilas.length" class="px-4 py-10 text-center text-sm text-unergy-deep/35">
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
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
          <Select
            :model-value="String(revYear)"
            @update:model-value="
              (v) => {
                revYear = Number(v)
                loadRevision()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Mes</label>
          <Select
            :model-value="String(revMonth)"
            @update:model-value="
              (v) => {
                revMonth = Number(v)
                loadRevision()
              }
            "
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex min-w-50 flex-1 flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Buscar</label>
          <Input
            v-model="revBusqueda"
            placeholder="Planta, contrato o SIC…"
            class="w-full text-sm"
          />
        </div>
      </div>

      <Spinner v-if="revLoading" class="size-8" />
      <Alert v-else-if="revError" variant="destructive">
        <AlertDescription>{{ revError }}</AlertDescription>
      </Alert>

      <template v-else-if="revData">
        <!-- Resumen: tres contadores -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div
            v-for="s in revResumen"
            :key="s.key"
            class="rounded-xl border px-4 py-3"
            :class="s.tono"
          >
            <div class="text-3xl leading-none font-bold" :class="s.numero">
              {{ s.n }}
            </div>
            <div class="mt-1.5 text-xs font-semibold text-unergy-deep">
              {{ s.titulo }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ s.detalle }}</div>
          </div>
        </div>

        <p class="text-xs text-muted-foreground/70">
          Al {{ revData.fecha_corte }}. Las filas en
          <span class="font-semibold text-destructive">rojo</span>
          son tramos que ya terminaron dentro del mes: la bolsa se calcula por días, así que una
          misma planta puede aparecer en más de una fila.
          <span class="mt-1 block">
            <b>Duplicada</b> = compromete más del 100% <b>al mismo tiempo</b> (se suman los % de los
            contratos que se solapan día a día), o está marcada como compra en bolsa / uso del
            recurso. Repartir 50% y 50% entre dos contratos <b>no</b> es duplicar, y sucederse en el
            tiempo tampoco.
          </span>
        </p>

        <!-- 1 · Plantas duplicadas -->
        <div class="overflow-hidden rounded-xl border border-unergy-deep/8">
          <div class="bg-warning/14 px-4 py-2.5">
            <span class="text-sm font-semibold text-unergy-deep">Plantas duplicadas en el mes</span>
            <span class="ml-2 text-xs text-muted-foreground">
              Duplicada es la que compromete <b>más del 100% a la vez</b>: ese excedente se cubre
              comprando en bolsa. Estar en varios contratos no basta —repartir 50% y 50% sigue
              siendo su 100%—. También entran las marcadas como <b>compra en bolsa</b>; el uso del
              recurso es otra figura y va en su propia sección.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted text-muted-foreground">
                <th class="px-4 py-2 text-left font-medium">Planta</th>
                <th class="px-4 py-2 text-right font-medium">% a la vez</th>
                <th class="px-4 py-2 text-left font-medium">Aparece en</th>
                <th class="px-4 py-2 text-left font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revDuplicadas" :key="p.id" class="border-t border-unergy-deep/6">
                <td class="px-4 py-2 font-medium text-unergy-deep">
                  {{ p.nombre }}
                </td>
                <td
                  class="px-4 py-2 text-right font-mono font-semibold"
                  :class="revPct(p.maxPct) > 100 ? 'text-warning' : 'text-muted-foreground'"
                >
                  {{ p.escalaRota || p.sinPct ? '—' : revPct(p.maxPct) + '%' }}
                </td>
                <td class="px-4 py-2">
                  <div
                    v-for="(a, i) in p.apariciones"
                    :key="i"
                    class="flex flex-wrap items-center gap-1.5 py-0.5"
                  >
                    <span
                      :class="a.estado === 'terminado' ? 'text-destructive' : 'text-unergy-deep'"
                      >{{ a.contrato }}</span
                    >
                    <span
                      v-if="a.codigo_sic"
                      class="rounded bg-unergy-deep/6 px-1 font-mono text-xs text-primary"
                      >{{ a.codigo_sic }}</span
                    >
                    <span v-if="a.pct" class="text-xs font-semibold text-muted-foreground"
                      >{{ revPct(a.pct) }}%</span
                    >
                    <span v-else class="text-xs text-muted-foreground/50">sin %</span>
                    <span
                      v-if="a.marca"
                      class="rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                      >{{ a.marca }}</span
                    >
                    <span class="text-xs text-muted-foreground/70"
                      >{{ fmtFechaDia(a.desde) }} → {{ fmtFechaDia(a.hasta) }}</span
                    >
                  </div>
                </td>
                <td
                  class="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground"
                  :title="p.motivo"
                >
                  {{ p.motivo }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="!revDuplicadas.length"
            class="px-4 py-8 text-center text-sm text-unergy-deep/35"
          >
            Ninguna planta duplicada este mes
          </div>
          <!-- Repartidas: la contraprueba de que la regla es por % y no por nº de contratos -->
          <details
            v-if="revRepartidas.length"
            class="border-t border-t-unergy-deep/6 bg-muted px-4 py-2.5 text-xs"
          >
            <summary class="cursor-pointer text-muted-foreground select-none">
              {{ revRepartidas.length }} planta(s) repartidas entre varios contratos sumando 100% o
              menos — no son duplicados
            </summary>
            <table class="mt-2 w-full">
              <tbody>
                <tr v-for="p in revRepartidas" :key="p.id" class="border-t border-unergy-deep/6">
                  <td class="py-1.5 pr-4 font-medium text-unergy-deep">
                    {{ p.nombre }}
                  </td>
                  <td class="py-1.5 pr-4 text-right font-mono text-success">
                    {{ revPct(p.maxPct) }}%
                  </td>
                  <td class="py-1.5 text-muted-foreground">
                    <span v-for="(a, i) in p.apariciones" :key="i">
                      <span v-if="i"> + </span>{{ revPct(a.pct) }}%
                      <span
                        v-if="a.modalidad_pago"
                        class="font-semibold text-unergy-purple uppercase"
                        >{{ a.modalidad_pago }}</span
                      >
                      {{ a.contrato }}
                      <span v-if="a.repartido" class="text-muted-foreground/60"
                        >(registrado {{ revPct(a.pctOriginal) }}%)</span
                      >
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-2 text-muted-foreground/70">
              Un par <b>PLG + PLC</b> es la misma planta repartida entre dos contratos: cada uno la
              registra al 100% porque así se firmó, y aquí se lee prorrateada. El % almacenado no se
              modifica y la energía en Cumplimiento se sigue atribuyendo igual.
            </p>
          </details>
        </div>

        <!-- 2 · Plantas sin contrato -->
        <div class="overflow-hidden rounded-xl border border-unergy-deep/8">
          <div class="bg-unergy-deep/6 px-4 py-2.5">
            <span class="text-sm font-semibold text-unergy-deep"
              >Libres en bolsa — sin contrato</span
            >
            <span class="ml-2 text-xs text-muted-foreground">
              Sin PPA <b>y sin registro GESCON vigente</b> sobre el tramo: venden en bolsa desde
              UNGG.
            </span>
          </div>
          <div v-if="revAsicError" class="bg-destructive/7 px-4 py-2 text-xs text-destructive">
            No se pudo consultar GESCON para contrastar: puede haber plantas listadas aquí que sí
            tengan un contrato con código SIC vigente.
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted text-muted-foreground">
                <th class="px-4 py-2 text-left font-medium">Planta</th>
                <th class="px-4 py-2 text-left font-medium">Tramo sin contrato</th>
                <th class="px-4 py-2 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in revSinContrato"
                :key="filaKey(p)"
                class="border-t border-unergy-deep/6"
              >
                <td class="px-4 py-2 font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</td>
                <td class="px-4 py-2 text-xs text-muted-foreground">
                  {{ fmtFechaDia(p.segmento_inicio) }} → {{ fmtFechaDia(p.segmento_fin) }}
                </td>
                <td class="px-4 py-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="revEstadoBadge(p.estado)"
                  >
                    {{ revEstadoLabel(p.estado) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="!revSinContrato.length"
            class="px-4 py-8 text-center text-sm text-unergy-deep/35"
          >
            Todas las plantas tienen contrato este mes
          </div>
        </div>

        <!-- 2b · Tienen SIC vigente pero el mes no las cuenta en ningún contrato -->
        <div
          v-if="revSicSinPpa.length"
          class="overflow-hidden rounded-xl border border-destructive/28"
        >
          <div class="bg-destructive/7 px-4 py-2.5">
            <span class="text-sm font-semibold text-unergy-deep"
              >Con contrato GESCON, pero fuera del cálculo del mes</span
            >
            <span class="ml-2 text-xs text-muted-foreground">
              Tienen un registro con código SIC vigente en el tramo, pero Cumplimiento no las asignó
              a ningún contrato y las contó como bolsa. Suele ser que el registro no cruza con un
              PPA (contrato interno vacío o distinto) o que el contrato es de un responsable oculto
              — prueba con <b>Ver ocultos</b>. No son plantas libres.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted text-muted-foreground">
                <th class="px-4 py-2 text-left font-medium">Planta</th>
                <th class="px-4 py-2 text-left font-medium">SIC</th>
                <th class="px-4 py-2 text-left font-medium">Contrato en GESCON</th>
                <th class="px-4 py-2 text-left font-medium">Vigente hasta</th>
                <th class="px-4 py-2 text-left font-medium">Tramo contado como bolsa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revSicSinPpa" :key="filaKey(p)" class="border-t border-unergy-deep/6">
                <td class="px-4 py-2 font-medium text-unergy-deep">
                  {{ p.nombre }}
                </td>
                <td class="px-4 py-2 font-mono text-xs text-primary">
                  {{ p._sic.codigo_sic_contrato || '—' }}
                </td>
                <td class="px-4 py-2 text-xs text-muted-foreground">
                  {{ p._sic.contrato_interno || p._sic.nombre_interno || 'sin contrato interno' }}
                </td>
                <td class="px-4 py-2 text-xs text-muted-foreground">
                  {{ fmtFechaDia(p._sic.fecha_fin_efectiva || p._sic.fecha_fin) }}
                </td>
                <td class="px-4 py-2 text-xs text-muted-foreground/70">
                  {{ fmtFechaDia(p.segmento_inicio) }} → {{ fmtFechaDia(p.segmento_fin) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 3 · Uso del recurso -->
        <div class="overflow-hidden rounded-xl border border-chart-3/28">
          <div class="bg-chart-3/10 px-4 py-2.5">
            <span class="text-sm font-semibold text-unergy-deep">Uso del recurso</span>
            <span class="ml-2 text-xs text-muted-foreground">
              El cliente está en bolsa y su planta entra al contrato pagándole la generación a
              precio de bolsa. <b>No genera garantías y no es una duplicación</b>: es una figura
              distinta a la compra en bolsa.
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted text-muted-foreground">
                <th class="px-4 py-2 text-left font-medium">Planta</th>
                <th class="px-4 py-2 text-left font-medium">Contrato</th>
                <th class="px-4 py-2 text-left font-medium">SIC</th>
                <th class="px-4 py-2 text-right font-medium">Despacho</th>
                <th class="px-4 py-2 text-left font-medium">Ventana</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in revUsoRecurso" :key="a._key" class="border-t border-unergy-deep/6">
                <td class="px-4 py-2 font-medium text-unergy-deep">
                  {{ a.planta }}
                </td>
                <td
                  class="px-4 py-2 text-xs"
                  :class="a.estado === 'terminado' ? 'text-destructive' : 'text-unergy-deep'"
                >
                  {{ a.contrato }}
                </td>
                <td class="px-4 py-2 font-mono text-xs text-primary">
                  {{ a.codigo_sic || '—' }}
                </td>
                <td class="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                  {{ a.pct ? revPct(a.pct) + '%' : '—' }}
                </td>
                <td class="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground/70">
                  {{ fmtFechaDia(a.desde) }} → {{ fmtFechaDia(a.hasta) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="!revUsoRecurso.length"
            class="px-4 py-8 text-center text-sm text-unergy-deep/35"
          >
            Ninguna planta bajo uso del recurso este mes
          </div>
        </div>

        <!-- 4 · Plantas con UNGC -->
        <div class="overflow-hidden rounded-xl border border-unergy-deep/8">
          <div class="bg-unergy-purple/10 px-4 py-2.5">
            <span class="text-sm font-semibold text-unergy-deep"
              >Plantas en contratos con UNGC</span
            >
            <span class="ml-2 text-xs text-muted-foreground">
              Contratos GESCON donde UNGC compra (piscina b) y plantas sin PPA cuyo SIC vigente
              tiene a UNGC de comprador (piscina f).
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted text-muted-foreground">
                <th class="px-4 py-2 text-left font-medium">Planta</th>
                <th class="px-4 py-2 text-left font-medium">Contrato</th>
                <th class="px-4 py-2 text-left font-medium">SIC</th>
                <th class="px-4 py-2 text-left font-medium">Ventana</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in revUngc" :key="p._key" class="border-t border-unergy-deep/6">
                <td class="px-4 py-2 font-medium" :class="filaColorNombre(p)">{{ p.nombre }}</td>
                <td class="px-4 py-2 text-xs">
                  <span v-if="p.contrato" class="text-unergy-deep">{{ p.contrato }}</span>
                  <span
                    v-else
                    class="rounded bg-unergy-deep/8 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
                    >Sin PPA · bolsa UNGC</span
                  >
                </td>
                <td class="px-4 py-2 font-mono text-xs text-primary">
                  {{ p.codigo_sic || '—' }}
                </td>
                <td class="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                  {{ fmtFechaDia(p.desde) }} → {{ fmtFechaDia(p.hasta) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!revUngc.length" class="px-4 py-8 text-center text-sm text-unergy-deep/35">
            Ninguna planta con UNGC este mes
          </div>
        </div>
      </template>
    </div>

    <!-- Floating: desglose de una capa del balance — de qué plantas sale la cifra -->
    <Teleport to="body">
      <template v-if="beCapa">
        <div class="fixed inset-0 z-60 bg-unergy-deep/28" @click="beCerrarCapa" />
        <div
          class="fixed top-1/2 left-1/2 z-61 max-h-11/12 w-11/12 max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-unergy-deep/12 bg-card shadow-2xl"
          @click.stop
        >
          <div class="h-1.5 rounded-t-2xl bg-unergy-purple" />

          <div class="border-b border-b-unergy-deep/8 px-6 pt-4 pb-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-lg font-bold text-unergy-deep">
                  {{ BE_CATEGORIAS[beCapa].label }}
                </div>
                <div class="mt-1 text-sm text-muted-foreground">{{ BE_AYUDA[beCapa] }}</div>
                <span
                  class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-unergy-purple/10 px-2 py-0.5 text-xs font-semibold text-unergy-purple"
                >
                  <CalendarIcon class="size-3" /> {{ MESES[beMonth - 1] }} {{ beYear }} ·
                  {{ bePeriodoLabel }}
                </span>
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg bg-unergy-purple/10 px-3 py-1.5 text-xs font-semibold text-unergy-purple"
                  @click="beVerEnTabla"
                >
                  <FilterIcon class="size-3" /> Ver en la tabla
                </button>
                <button
                  class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  @click="beCerrarCapa"
                >
                  <XIcon class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Cómo se calcula -->
          <div class="bg-unergy-purple/4 px-6 py-3 text-xs text-muted-foreground">
            <span class="font-semibold text-unergy-deep">Cómo sale cada fila:</span>
            generación del tramo × porcentaje = aporte. La generación del tramo es la producción
            real de la planta en esos días exactos (suma de lecturas, no una regla de tres sobre el
            mes).
            <template v-if="beData?.periodo?.es_mes_actual">
              Los días del {{ beData.periodo.dia_corte + 1 }} al {{ beData.periodo.dias_mes }} se
              proyectan con el promedio diario de cada planta este mes.
            </template>
          </div>

          <!-- Desglose -->
          <div class="px-6 py-4">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <th class="pb-2 text-left">Frontera</th>
                  <th class="pb-2 text-left">Tramo</th>
                  <th class="pb-2 text-right">Días</th>
                  <th class="pb-2 text-right">Gen. tramo</th>
                  <th class="pb-2 text-right">%</th>
                  <th class="pb-2 text-right">Real</th>
                  <th class="pb-2 text-right">Proy.</th>
                  <th class="pb-2 text-right">Aporte</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(f, i) in beCapaFilas"
                  :key="`${f.proyecto_id}-${f.desde}-${i}`"
                  class="border-t border-t-unergy-deep/6"
                >
                  <td class="py-2 pr-2">
                    <span class="font-medium text-unergy-deep">{{ f.frontera }}</span>
                    <span
                      v-if="f.frontera !== f.planta"
                      class="block text-xs text-muted-foreground"
                      >{{ f.planta }}</span
                    >
                    <span v-if="f.contrato" class="block text-xs text-unergy-purple">{{
                      f.contrato
                    }}</span>
                  </td>
                  <td class="py-2 pr-2 font-mono text-xs text-muted-foreground">
                    {{ f.desde }} → {{ f.hasta }}
                    <span
                      v-if="f.estimado"
                      class="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-foreground/7 px-1.5 py-0.5 align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground"
                      title="No hubo lecturas del rango exacto: se estimó con el promedio diario del mes"
                      >estimado</span
                    >
                  </td>
                  <td class="py-2 text-right font-mono text-xs text-muted-foreground">
                    {{ f.dias }}
                  </td>
                  <td class="py-2 text-right font-mono text-muted-foreground">
                    {{
                      f.gen_tramo_real !== null
                        ? fmtNum1((f.gen_tramo_real || 0) + (f.gen_tramo_proyectado || 0))
                        : '—'
                    }}
                  </td>
                  <td class="py-2 text-right font-mono text-xs text-muted-foreground">
                    {{
                      f.pct !== null && f.pct !== undefined ? (f.pct * 100).toFixed(0) + '%' : '—'
                    }}
                  </td>
                  <td class="py-2 text-right font-mono text-unergy-deep">
                    {{ f.mwh_real !== null ? fmtNum1(f.mwh_real) : '—' }}
                  </td>
                  <td class="py-2 text-right font-mono text-muted-foreground">
                    {{ f.mwh_proyectado !== null ? fmtNum1(f.mwh_proyectado) : '—' }}
                  </td>
                  <td class="py-2 text-right font-mono font-semibold text-unergy-deep">
                    {{ f.mwh_total !== null ? fmtNum1(f.mwh_total) : '—' }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-t-unergy-deep/12">
                  <td class="pt-3 font-bold text-unergy-deep">
                    TOTAL · {{ beCapaPlantas }} {{ beCapaPlantas === 1 ? 'planta' : 'plantas' }}
                    <span
                      v-if="beCapaFilas.length !== beCapaPlantas"
                      class="text-xs font-normal text-muted-foreground"
                    >
                      ({{ beCapaFilas.length }} tramos)
                    </span>
                  </td>
                  <td colspan="4"></td>
                  <td class="pt-3 text-right font-mono font-bold text-unergy-deep">
                    {{ fmtNum1(beCapaTotales.real) }}
                  </td>
                  <td class="pt-3 text-right font-mono font-bold text-muted-foreground">
                    {{ fmtNum1(beCapaTotales.proyectado) }}
                  </td>
                  <td class="pt-3 text-right font-mono text-base font-bold text-unergy-deep">
                    {{ fmtNum1(beCapaTotales.total) }}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div v-if="!beCapaFilas.length" class="py-10 text-center text-sm text-unergy-deep/35">
              Ninguna planta aporta a esta capa en {{ MESES[beMonth - 1] }}
            </div>

            <!-- Lo que NO entró -->
            <div
              v-if="beData?.advertencias?.sin_datos?.length"
              class="mt-4 border-t border-t-unergy-deep/8 pt-3 text-xs text-muted-foreground"
            >
              <span class="font-semibold text-unergy-deep">Fuera del cálculo:</span>
              {{ beData.advertencias.sin_datos.length }} plantas sin generación en el mes —
              {{
                beData.advertencias.sin_datos.map((a) => `${a.planta} (${a.motivo})`).join(' · ')
              }}
            </div>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating: detalle de la capa (misma información que la imagen) -->
    <Teleport to="body">
      <template v-if="detalleCapa">
        <div class="fixed inset-0 z-60 bg-unergy-deep/28" @click="cerrarDetalleCapa" />
        <div
          class="fixed top-1/2 left-1/2 z-61 max-h-11/12 w-11/12 max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-unergy-deep/12 bg-card shadow-2xl"
          @click.stop
        >
          <div class="h-1.5 rounded-t-2xl bg-unergy-purple" />
          <!-- Header -->
          <div class="border-b border-b-unergy-deep/8 px-6 pt-4 pb-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-lg font-bold text-unergy-deep">
                  {{ detalleCapa.c.nombre }}
                </div>
                <div class="truncate text-sm text-muted-foreground">
                  {{ detalleCapa.c.comprador_nombre }}
                </div>
                <span
                  class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-unergy-purple/10 px-2 py-0.5 text-xs font-semibold text-unergy-purple"
                >
                  <CalendarIcon class="size-3" /> Período de consulta:
                  {{ periodoSimLabel }}
                </span>
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <span
                  v-if="detalleCapa.res.pct != null && detalleCapa.res.pct !== undefined"
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="estadoClases(detalleCapa.res.estado).badge"
                  >{{ Math.round(detalleCapa.res.pct) }}%</span
                >
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="estadoClases(detalleCapa.res.estado).badge"
                  >{{ estadoLabel(detalleCapa.res.estado) }}</span
                >
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="
                    copiadoCapaId === detalleCapa.c.id
                      ? 'bg-success/12 text-success'
                      : 'bg-unergy-purple text-primary-foreground'
                  "
                  :title="'Copia la imagen al portapapeles (o la descarga si el navegador no lo permite)'"
                  @click="copiarImagenCapa(detalleCapa.c)"
                >
                  <CheckIcon v-if="copiadoCapaId === detalleCapa.c.id" class="size-3" />
                  <ImageIcon v-else class="size-3" />
                  {{ copiadoCapaId === detalleCapa.c.id ? '¡Copiado!' : 'Copiar imagen' }}
                </button>
                <button
                  class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  @click="cerrarDetalleCapa"
                >
                  <XIcon class="size-4" />
                </button>
              </div>
            </div>
            <!-- Métricas (energía duplicada como 4ª columna si aplica) -->
            <div
              class="mt-3 grid gap-3"
              :class="(detalleCapa.res.genDup ?? 0) > 0 ? 'grid-cols-4' : 'grid-cols-3'"
            >
              <div>
                <div class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Energía entregada
                </div>
                <div class="mt-0.5 font-mono text-sm font-bold text-unergy-deep">
                  {{ fmtMwh(detalleCapa.res.gen) }}
                </div>
              </div>
              <div>
                <div class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Energía mínima
                </div>
                <div class="mt-0.5 font-mono text-sm font-bold text-unergy-deep">
                  {{ detalleCapa.res.min != null ? fmtMwh(detalleCapa.res.min) : '—' }}
                </div>
              </div>
              <div>
                <div class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Energía proyectada
                </div>
                <div class="mt-0.5 font-mono text-sm font-bold text-unergy-deep">
                  {{
                    detalleCapa.res.genProy != null && detalleCapa.res.genProy > 0
                      ? fmtMwh(detalleCapa.res.genProy!)
                      : '—'
                  }}
                </div>
              </div>
              <div
                v-if="(detalleCapa.res.genDup ?? 0) > 0"
                :title="'De la energía entregada, esta parte se suministra con compra en bolsa (cuenta para el contrato, origen bolsa)'"
              >
                <div
                  class="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-warning uppercase"
                >
                  <ShoppingCartIcon class="size-3" />Compra en bolsa
                </div>
                <div class="mt-0.5 font-mono text-sm font-bold text-warning">
                  {{ fmtMwh(detalleCapa.res.genDup) }}
                </div>
              </div>
            </div>
          </div>
          <!-- Tabla -->
          <div class="px-6 py-4">
            <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
              {{ detalleCapa.plantas.length }} proyecto{{
                detalleCapa.plantas.length === 1 ? '' : 's'
              }}
              en el contrato
            </p>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th class="pb-2 text-left">Proyecto</th>
                  <th class="pb-2 text-right">% Despacho</th>
                  <th class="pb-2 text-right">Energía generada</th>
                  <th class="pb-2 text-right">Proyección cierre del mes</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in detalleCapa.plantas"
                  :key="p.id"
                  class="border-t border-t-unergy-deep/6"
                >
                  <td
                    class="py-2 pr-2 font-medium"
                    :class="
                      p.es_duplicado || p.comprado_por_unergy ? 'text-warning' : 'text-unergy-deep'
                    "
                  >
                    {{ p.nombre }}
                    <span
                      v-if="p.es_duplicado && !p.comprado_por_unergy"
                      class="ml-1 inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                      :title="'Compra en bolsa'"
                      ><ShoppingCartIcon class="size-3" />Compra bolsa</span
                    >
                    <span
                      v-else-if="p.comprado_por_unergy"
                      class="ml-1 rounded bg-warning/25 px-1.5 py-0.5 text-xs font-semibold text-warning"
                      >Compra</span
                    >
                  </td>
                  <td class="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                    {{ (p.pct_despacho * 100).toFixed(0) }}%
                  </td>
                  <td
                    class="px-2 py-2 text-right font-mono font-semibold"
                    :class="p.es_duplicado ? 'text-warning' : 'text-unergy-deep'"
                  >
                    {{ p.month_mwh != null ? fmtMwh(p.month_mwh * p.pct_despacho) : '—' }}
                  </td>
                  <td class="py-2 pl-2 text-right font-mono font-semibold text-unergy-purple">
                    <template v-if="plantaProyMwh(p) != null"
                      >◆ {{ fmtMwh(plantaProyMwh(p)) }}</template
                    >
                    <span v-else class="text-unergy-deep/30">—</span>
                  </td>
                </tr>
                <tr v-if="!detalleCapa.plantas.length">
                  <td colspan="4" class="py-6 text-center text-sm text-unergy-deep/35">
                    Sin proyectos asignados
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-t-unergy-deep/12">
                  <td class="pt-3 text-sm font-bold text-unergy-deep">
                    Total · {{ detalleCapa.plantas.length }} proyecto{{
                      detalleCapa.plantas.length === 1 ? '' : 's'
                    }}
                  </td>
                  <td></td>
                  <td class="pt-3 text-right font-mono text-base font-bold text-unergy-purple">
                    {{ fmtMwh(detalleCapa.res.gen) }}
                  </td>
                  <td class="pt-3 text-right font-mono text-base font-bold text-unergy-purple">
                    {{
                      detalleCapa.res.genProy != null && detalleCapa.res.genProy > 0
                        ? fmtMwh(detalleCapa.res.genProy!)
                        : '—'
                    }}
                  </td>
                </tr>
                <tr v-if="(detalleCapa.res.genDup ?? 0) > 0">
                  <td colspan="2"></td>
                  <td class="pt-1 text-right font-mono text-xs font-semibold text-warning">
                    de ello, {{ fmtMwh(detalleCapa.res.genDup) }} compra en bolsa
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <!-- Veredicto -->
            <div
              class="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3"
              :class="veredictoCapa(detalleCapa.res).bg"
            >
              <component
                :is="veredictoCapa(detalleCapa.res).icon"
                class="mt-0.5 size-4"
                :class="veredictoCapa(detalleCapa.res).fg"
              />
              <div>
                <div class="text-sm font-bold" :class="veredictoCapa(detalleCapa.res).fg">
                  {{ veredictoCapa(detalleCapa.res).txt }}
                </div>
                <div
                  v-if="veredictoCapa(detalleCapa.res).sub"
                  class="mt-0.5 text-xs text-muted-foreground"
                >
                  {{ veredictoCapa(detalleCapa.res).sub }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Floating month breakdown -->
    <Teleport to="body">
      <template v-if="selectedMonthIdx !== null && selectedMes">
        <div class="fixed inset-0 z-40 bg-unergy-deep/25" @click="selectedMonthIdx = null" />
        <div
          class="fixed top-1/2 left-1/2 z-50 max-h-4/5 w-11/12 max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-unergy-deep/12 bg-unergy-avena shadow-2xl"
          @click.stop
        >
          <div class="flex items-center justify-between border-b border-b-unergy-deep/10 px-5 py-4">
            <div>
              <span class="text-base font-bold text-unergy-deep"
                >{{ MESES[selectedMonthIdx] }} {{ selectedYear }}</span
              >
              <span
                v-if="selectedMes.tipo_datos !== 'real'"
                class="ml-2 rounded-full bg-unergy-purple/12 px-2 py-0.5 text-xs font-medium text-unergy-purple"
                >proyección</span
              >
            </div>
            <button class="rounded-lg p-1.5 text-muted-foreground" @click="selectedMonthIdx = null">
              <XIcon class="size-4" />
            </button>
          </div>
          <div class="px-5 py-4">
            <p class="mb-3 text-xs font-semibold tracking-widest text-unergy-purple uppercase">
              Desglose por planta
            </p>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <th class="pb-2 text-left">Planta</th>
                  <th class="pb-2 text-right">%</th>
                  <th class="pb-2 text-right">Gen. planta</th>
                  <th class="pb-2 text-right">Gen. contrato</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(p, pi) in selectedMes.plantas"
                  :key="pi"
                  class="border-t border-t-unergy-deep/6"
                  :class="p.es_duplicado ? 'bg-warning/8' : ''"
                >
                  <td class="py-2 pr-2 font-medium text-unergy-deep">
                    {{ p.nombre }}
                    <span
                      v-if="p.es_duplicado"
                      class="ml-1 inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                      :title="'Compra en bolsa'"
                      ><ShoppingCartIcon class="size-3" />Compra bolsa</span
                    >
                    <span
                      v-if="p.contrato"
                      class="ml-1 rounded bg-unergy-purple/8 px-1.5 py-0.5 text-xs font-normal text-unergy-purple"
                      >{{ p.contrato }}</span
                    >
                    <span
                      v-if="p.dias_en_contrato && p.dias_mes && p.dias_en_contrato < p.dias_mes"
                      class="ml-1 text-xs font-normal text-muted-foreground"
                      >{{ p.dias_en_contrato }}/{{ p.dias_mes }} días</span
                    >
                  </td>
                  <td class="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                    {{ (p.pct_despacho * 100).toFixed(0) }}%
                  </td>
                  <td class="px-2 py-2 text-right font-mono text-unergy-deep">
                    {{ p.gen_planta_mwh !== null ? fmtMwh(p.gen_planta_mwh) : '—' }}
                  </td>
                  <td
                    class="py-2 pl-2 text-right font-mono font-semibold"
                    :class="p.es_duplicado ? 'text-warning' : 'text-unergy-purple'"
                  >
                    {{ p.gen_contrato_mwh !== null ? fmtMwh(p.gen_contrato_mwh) : '—' }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-t-unergy-deep/12">
                  <td colspan="3" class="pt-3 text-sm font-semibold text-unergy-deep">
                    Total al contrato
                  </td>
                  <td class="pt-3 text-right font-mono font-bold text-unergy-deep">
                    {{ fmtMwh(genVal(selectedMes)) }}
                  </td>
                </tr>
                <tr v-if="selectedMes.exposicion_bolsa_duplicados_mwh">
                  <td colspan="3" class="pt-1 text-sm font-semibold text-warning">
                    de ello, compra en bolsa
                  </td>
                  <td class="pt-1 text-right font-mono font-bold text-warning">
                    {{ fmtMwh(selectedMes.exposicion_bolsa_duplicados_mwh) }}
                  </td>
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
        <div class="fixed inset-0 z-60 bg-unergy-deep/28" @click="cerrarDetalleContrato" />
        <div
          class="fixed top-1/2 left-1/2 z-61 max-h-11/12 w-11/12 max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-unergy-deep/12 bg-card shadow-2xl"
          @click.stop
        >
          <div class="h-1.5 rounded-t-2xl bg-unergy-purple" />
          <!-- Header -->
          <div class="border-b border-b-unergy-deep/8 px-6 pt-4 pb-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-lg font-bold text-unergy-deep">{{
                    detalleContrato.c.nombre
                  }}</span>
                  <span
                    class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="dcTipo.tono"
                    >{{ dcTipo.label }}</span
                  >
                </div>
                <div v-if="dcContraparte" class="mt-0.5 text-sm text-muted-foreground">
                  {{ dcContraparte }}
                </div>
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <a
                  v-if="dcPpa?.carpeta_link"
                  :href="dcPpa.carpeta_link"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-unergy-purple/10 px-3 py-1.5 text-xs font-semibold text-unergy-purple"
                  :title="'Abrir la carpeta del contrato'"
                  ><FolderOpenIcon class="size-3" />Carpeta</a
                >
                <button
                  class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  @click="cerrarDetalleContrato"
                >
                  <XIcon class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="dcLoading" class="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner class="size-10" />
            <p class="text-sm text-muted-foreground">Cargando contrato…</p>
          </div>

          <div v-else class="space-y-6 px-6 py-4">
            <Alert v-if="dcError" class="border-warning/40 bg-warning/5">
              <AlertDescription>{{ dcError }}</AlertDescription>
            </Alert>

            <!-- 1. Contrato formal (módulo PPA) -->
            <div>
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                Contrato formal (PPA)
              </p>
              <Alert v-if="!dcPpa && !dcError" class="border-chart-3/40 bg-chart-3/5">
                <AlertDescription>
                  Este contrato no está registrado en el módulo PPA — solo existe como registro
                  GESCON (abajo).
                </AlertDescription>
              </Alert>
              <div v-else-if="dcPpa" class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div v-for="f in dcCamposFormales" :key="f.label">
                  <div class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {{ f.label }}
                  </div>
                  <div
                    class="mt-0.5 text-sm break-words text-unergy-deep"
                    :class="f.mono ? 'font-mono' : ''"
                  >
                    {{ f.value }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Cantidades comprometidas por mes -->
            <div v-if="dcCompromisos.length">
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                Cantidades comprometidas por mes
              </p>
              <div class="max-h-57.5 overflow-auto rounded-lg border border-unergy-deep/10">
                <table class="w-full text-sm">
                  <thead class="sticky top-0 bg-unergy-purple/6">
                    <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      <th class="px-3 py-2 text-left">Período</th>
                      <th class="px-3 py-2 text-right">Mín (kWh/mes)</th>
                      <th class="px-3 py-2 text-right">Máx (kWh/mes)</th>
                      <th class="px-3 py-2 text-right">Plantas esperadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in dcCompromisos"
                      :key="`${r['año']}-${r.mes}`"
                      class="border-t border-t-unergy-deep/5"
                      :class="r['año'] === pcYear && r.mes === pcMonth ? 'bg-unergy-purple/8' : ''"
                    >
                      <td class="px-3 py-1.5 font-mono text-xs text-unergy-deep">
                        {{ MESES[r.mes - 1] }} {{ r['año'] }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-mono text-unergy-deep">
                        {{ fmtQ(r.energia_minima) }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-mono text-unergy-deep">
                        {{ fmtQ(r.energia_maxima) }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        {{ r.cantidad_proyectos ?? '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3. Tarifas por mes -->
            <div v-if="dcTarifas.length">
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                Tarifas por mes ($/kWh)
              </p>
              <div class="max-h-50 overflow-auto rounded-lg border border-unergy-deep/10">
                <table class="w-full text-sm">
                  <thead class="sticky top-0 bg-unergy-purple/6">
                    <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      <th class="px-3 py-2 text-left">Período</th>
                      <th class="px-3 py-2 text-right">Tarifa</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in dcTarifas"
                      :key="`${r['año']}-${r.mes}`"
                      class="border-t border-t-unergy-deep/5"
                      :class="r['año'] === pcYear && r.mes === pcMonth ? 'bg-unergy-purple/8' : ''"
                    >
                      <td class="px-3 py-1.5 font-mono text-xs text-unergy-deep">
                        {{ MESES[r.mes - 1] }} {{ r['año'] }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-mono text-unergy-deep">
                        {{ fmtQ(r.tarifa) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 4. GESCON -->
            <div>
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                GESCON — registros ante el ASIC
              </p>
              <div
                v-if="dcGescon.length"
                class="max-h-70 overflow-auto rounded-lg border border-unergy-deep/10"
              >
                <table class="w-full text-sm">
                  <thead class="sticky top-0 bg-unergy-purple/6">
                    <tr class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      <th class="px-3 py-2 text-left">Planta</th>
                      <th class="px-2 py-2 text-left">SIC</th>
                      <th class="px-2 py-2 text-left">Tipo</th>
                      <th class="px-2 py-2 text-right">% Desp.</th>
                      <th class="px-2 py-2 text-left">Inicio</th>
                      <th class="px-2 py-2 text-left">Fin (efectivo)</th>
                      <th class="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in dcGescon"
                      :key="r.id"
                      class="border-t border-t-unergy-deep/5"
                      :class="!r.es_version_vigente ? 'opacity-55' : ''"
                    >
                      <td class="px-3 py-1.5 font-medium text-unergy-deep">
                        {{ r.planta_nombre || (r.proyecto_id ? `Proyecto ${r.proyecto_id}` : '—') }}
                        <span
                          v-if="r.es_duplicado"
                          class="ml-1 inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                          ><ShoppingCartIcon class="size-3" />Duplicado</span
                        >
                        <span
                          v-if="r.uso_del_recurso"
                          class="ml-1 rounded bg-chart-2/14 px-1.5 py-0.5 text-xs font-semibold text-chart-2"
                          >Uso del recurso</span
                        >
                      </td>
                      <td class="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {{ r.codigo_sic_contrato || '—' }}
                      </td>
                      <td class="px-2 py-1.5 text-xs text-muted-foreground">
                        {{ r.tipo_solicitud }}
                      </td>
                      <td class="px-2 py-1.5 text-right font-mono text-xs text-unergy-purple">
                        {{
                          r.porcentaje_despacho != null
                            ? (r.porcentaje_despacho * 100).toFixed(0) + '%'
                            : '—'
                        }}
                      </td>
                      <td class="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {{ r.fecha_inicio || '—' }}
                      </td>
                      <td class="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {{ r.fecha_fin_efectiva || r.fecha_fin || 'abierta' }}
                      </td>
                      <td class="px-3 py-1.5">
                        <span
                          class="rounded px-1.5 py-0.5 text-xs font-semibold"
                          :class="dcEstadoClase(r.estado_solicitud)"
                          >{{ r.estado_solicitud }}</span
                        >
                        <span
                          v-if="r.es_version_vigente"
                          class="ml-1 rounded bg-success/12 px-1.5 py-0.5 text-xs font-semibold text-success"
                          >vigente</span
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                v-else
                class="rounded-lg border border-unergy-deep/8 px-4 py-4 text-center text-xs text-unergy-deep/35"
              >
                <template v-if="detalleContrato.c._proyecto_id"
                  >Sin registros GESCON para esta planta — vende en bolsa como generador</template
                >
                <template v-else
                  >Sin registros GESCON para este contrato{{
                    detalleContrato.modo === 'ppa_compra_externa'
                      ? ' — es una compra directa fuera del MEM'
                      : ''
                  }}</template
                >
              </div>
            </div>

            <!-- 5. Plantas del mes consultado (lo que ve la piscina) -->
            <div v-if="detalleContrato.c.plantas?.length">
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                {{
                  detalleContrato.c._proyecto_id ? 'Planta consultada' : 'Plantas en el contrato'
                }}
                · {{ MESES[pcMonth - 1] }} {{ pcYear }} ({{ detalleContrato.c.plantas.length }})
              </p>
              <div class="divide-y rounded-lg border border-unergy-deep/10">
                <div
                  v-for="p in detalleContrato.c.plantas"
                  :key="p.id"
                  class="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-unergy-deep">{{ p.nombre }}</span>
                    <span
                      v-if="p.codigo_sic"
                      class="rounded bg-unergy-deep/6 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                      >{{ p.codigo_sic }}</span
                    >
                    <span v-if="p.pct_despacho != null" class="font-mono text-xs text-unergy-purple"
                      >{{ (p.pct_despacho * 100).toFixed(0) }}%</span
                    >
                    <span
                      v-if="p.es_duplicado"
                      class="inline-flex items-center gap-1 rounded bg-warning/22 px-1.5 py-0.5 text-xs font-semibold text-warning"
                      ><ShoppingCartIcon class="size-3" />Compra bolsa</span
                    >
                  </div>
                  <div class="font-mono text-xs text-muted-foreground">
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
        <div class="fixed inset-0 z-60 bg-unergy-deep/28" @click="cerrarResponsables" />
        <div
          class="fixed top-1/2 left-1/2 z-61 max-h-11/12 w-11/12 max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-unergy-deep/12 bg-card shadow-2xl"
          @click.stop
        >
          <div class="h-1.5 rounded-t-2xl bg-unergy-purple" />
          <div
            class="flex items-start justify-between gap-3 border-b border-b-unergy-deep/8 px-6 pt-4 pb-3"
          >
            <div>
              <div class="text-lg font-bold text-unergy-deep">Empresas responsables de PPA</div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                Los contratos de un responsable marcado como <b>no relevante</b> no aparecen en la
                Matriz anual. Un contrato sin responsable siempre aparece.
              </div>
            </div>
            <button
              class="rounded px-2 py-1 text-sm text-muted-foreground"
              @click="cerrarResponsables"
            >
              <XIcon class="size-4" />
            </button>
          </div>

          <div class="space-y-5 px-6 py-4">
            <Alert v-if="respError" variant="destructive">
              <AlertDescription>{{ respError }}</AlertDescription>
            </Alert>

            <!-- Catálogo -->
            <div>
              <p class="mb-2 text-xs font-bold tracking-widest text-unergy-purple uppercase">
                Catálogo
              </p>
              <div class="divide-y rounded-lg border border-unergy-deep/10">
                <div
                  v-for="r in responsables"
                  :key="r.id"
                  class="flex items-center gap-3 px-3 py-2"
                >
                  <Input
                    v-model="r.nombre"
                    class="flex-1 text-sm"
                    @change="guardarResponsable(r)"
                  />
                  <label
                    class="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground"
                    title="Destildado = sus contratos se ocultan de la Matriz anual"
                  >
                    <Checkbox
                      :model-value="r.incluir_en_cumplimiento"
                      @update:model-value="
                        (v) => {
                          r.incluir_en_cumplimiento = v === true
                          guardarResponsable(r)
                        }
                      "
                    />
                    Relevante
                  </label>
                  <span class="shrink-0 text-right font-mono text-xs text-muted-foreground"
                    >{{ r.n_contratos }} contr.</span
                  >
                  <button
                    class="rounded px-2 py-1 text-xs"
                    :class="
                      r.n_contratos
                        ? 'cursor-not-allowed text-muted-foreground/40'
                        : 'text-destructive'
                    "
                    :disabled="!!r.n_contratos"
                    :title="r.n_contratos ? 'Reasigna sus contratos primero' : 'Eliminar'"
                    @click="borrarResponsable(r)"
                  >
                    <Trash2Icon class="size-4" />
                  </button>
                </div>
                <div
                  v-if="!responsables.length"
                  class="px-3 py-4 text-center text-sm text-unergy-deep/35"
                >
                  Sin responsables todavía
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <Input
                  v-model="respNuevo"
                  placeholder="Nueva empresa responsable…"
                  class="flex-1 text-sm"
                  @keyup.enter="crearResponsable"
                />
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!respNuevo.trim()"
                  @click="crearResponsable"
                >
                  <PlusIcon />
                  Agregar
                </Button>
              </div>
            </div>

            <!-- Asignación -->
            <div>
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-xs font-bold tracking-widest text-unergy-purple uppercase">
                  Asignar contratos ({{ respContratos.length }})
                </p>
                <div class="flex items-center gap-2">
                  <Select
                    :model-value="respAsignarA != null ? String(respAsignarA) : undefined"
                    @update:model-value="(v) => (respAsignarA = v as string)"
                  >
                    <SelectTrigger class="min-w-56 text-sm"
                      ><SelectValue placeholder="Asignar seleccionados a…"
                    /></SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="op in respOpcionesAsignar"
                        :key="op.value"
                        :value="String(op.value)"
                        >{{ op.label }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    :disabled="!respSel.length || !respAsignarA || respGuardando"
                    @click="asignarSeleccionados"
                    >Aplicar</Button
                  >
                </div>
              </div>
              <Input
                v-model="respBusqueda"
                placeholder="Buscar contrato…"
                class="mb-2 w-full text-sm"
              />
              <div
                class="max-h-75 divide-y overflow-y-auto rounded-lg border border-unergy-deep/10"
              >
                <label
                  v-for="c in respContratosFiltrados"
                  :key="c.id"
                  class="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    :model-value="respSel.includes(c.id)"
                    @update:model-value="
                      (v) =>
                        (respSel = v ? [...respSel, c.id] : respSel.filter((id) => id !== c.id))
                    "
                  />
                  <span class="flex-1 truncate text-unergy-deep">
                    {{ c.nombre_interno || c.numero_codigo_contrato }}
                    <span class="ml-1 text-xs text-muted-foreground">{{ c.comprador_nombre }}</span>
                  </span>
                  <span class="rounded px-1.5 py-0.5 text-xs" :class="responsableChip(c)">
                    {{ c.responsable || 'sin responsable' }}
                  </span>
                </label>
                <div
                  v-if="!respContratosFiltrados.length"
                  class="px-3 py-4 text-center text-sm text-unergy-deep/35"
                >
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

<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type { ComboBoxOption } from '~/components/blocks/MultiComboBox.vue'
import type { ContratoPpa, RegistroAsic, ResponsablePpa } from '~/features/contratos/types'
import type { ContratoCumplimientoPpa } from '~/features/mem/types'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  BuildingIcon,
  CalendarIcon,
  ChartColumnIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  CompassIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilterIcon,
  FolderOpenIcon,
  HistoryIcon,
  ImageIcon,
  InfoIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MaximizeIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { isFetchError } from '~/core/errors'
import { logger } from '~/core/logger'
import { PpaService } from '~/features/contratos/services/ppa'
import { CumplimientoService } from '~/features/mem/services/cumplimiento'
import {
  aPorcentaje,
  claveContrato,
  esRepartida,
  maxConcurrente,
  motivoDuplicada,
  repartirPares,
} from './cumplimientoRevision.js'

const cumplimientoService = new CumplimientoService()
const ppaService = new PpaService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

// ── Tipos locales ──────────────────────────────────────────────────────────
// Formas verificadas contra el uso real en esta vista. `~/features/mem/types`
// deja los payloads de estos endpoints como `Record<string, unknown>`
// ("forma libre") a propósito -- viven aquí porque son propios de esta vista.

/** `GET /cumplimiento/ppa/resumen-anual`. */
interface FilaResumenAnual {
  id: number | string
  nombre_interno?: string | null
  numero_codigo_contrato?: string | null
  comprador_nombre?: string | null
  responsable?: string | null
  responsable_relevante?: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  total_min_mwh: number | null
  total_max_mwh: number | null
  meses_con_compromisos: number
}

/** Una planta dentro de `AnualMes.plantas` (desglose por planta de un mes). */
interface PlantaAnualMes {
  nombre: string
  contrato?: string | null
  pct_despacho: number
  gen_planta_mwh?: number | null
  gen_contrato_mwh?: number | null
  es_duplicado?: boolean
  dias_en_contrato?: number | null
  dias_mes?: number | null
}

/** Un mes de `GET /cumplimiento/ppa/:id/anual` (o el consolidado equivalente). */
interface AnualMes {
  month: number
  gen_mwh: number
  gen_proyectada_mwh: number | null
  gen_proyectada_cierre: number | null
  dia_actual: number | null
  dias_restantes: number | null
  min_mwh: number | null
  max_mwh: number | null
  estado: 'ok' | 'deficit' | 'excedente' | 'sin_compromisos' | string
  tipo_datos: 'mes_actual' | 'real' | 'proyeccion_historica' | string
  compras_bolsa_mwh: number | null
  excedentes_bolsa_mwh: number | null
  exposicion_bolsa_duplicados_mwh?: number | null
  plantas: PlantaAnualMes[]
  n_plantas?: number
}

/** `anualData` — el detalle anual de un contrato (o el consolidado armado en `loadConsolidado`). */
/** El "contrato" `__consolidado__` (suma de todos) que arma `loadConsolidado()` —
 *  no existe en el backend, solo en esta vista. */
interface ContratoConsolidadoSentinel {
  id: typeof CONSOLIDADO_ID
  nombre_interno: string
  numero_codigo_contrato: string
  comprador_nombre: string
}

interface AnualDataView {
  contrato: ContratoCumplimientoPpa | ContratoConsolidadoSentinel
  year: number
  meses: AnualMes[]
}

/** Una planta asignada a un contrato en el simulador. */
interface SimPlanta {
  id: number
  nombre: string
  contrato_id?: number | string | null
  month_mwh: number | null
  month_mwh_proyectado?: number | null
  pct_despacho: number
  es_duplicado?: boolean
  uso_del_recurso?: boolean
  comprado_por_unergy?: boolean
  contrato_compra_nombre?: string | null
  codigo_sic?: string | null
}

/** Un contrato del simulador — real (del backend) o `_ficticio` (creado en memoria). */
interface SimContrato {
  id: number | string
  nombre: string
  comprador_nombre?: string | null
  responsable?: string | null
  responsable_relevante?: boolean
  min_mwh: number | null
  max_mwh: number | null
  plantas_esperadas?: number | null
  _ficticio?: boolean
}

/** `GET /cumplimiento/simulador`. */
interface SimuladorData {
  contratos: SimContrato[]
  plantas: SimPlanta[]
  es_mes_actual: boolean
  dia_actual?: number | null
  dias_restantes?: number | null
}

/** Geometría del bullet chart de un contrato (todo en % del eje, 0-100). */
interface BulletGeom {
  hasMin: boolean
  hasMax: boolean
  hasZones: boolean
  minPct: number
  maxPct: number
  measurePct: number
  bolsaStartPct: number | null
  dupW: number
  proyPct: number | null
}

/** Resultado calculado del simulador para un contrato (`simResults`). */
interface SimResultado {
  gen: number
  genDup: number
  tieneDup: boolean
  genProy: number | null
  estado: 'ok' | 'deficit' | 'excedente' | 'sin_compromisos'
  estadoProy: 'ok' | 'deficit' | 'excedente' | 'sin_compromisos'
  estadoEfectivo: 'ok' | 'deficit' | 'excedente' | 'sin_compromisos'
  pct: number | null
  dupPct: number | null
  proyPct: number | null
  min: number | null
  max: number | null
  diaActual: number | null | undefined
  diasRestantes: number | null | undefined
  bullet: BulletGeom
  plantasReg: number
  plantasEsp: number | null
  estadoPlantas: 'ok' | 'deficit' | 'excedente' | 'sin_compromisos'
  plantasPct: number | null
}

/** Una planta dentro de una tarjeta de contrato/piscina de la pestaña Proyectos. */
interface PcPlanta {
  id: number
  nombre: string
  codigo_sic?: string | null
  pct_despacho?: number | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  segmento_inicio?: string | null
  segmento_fin?: string | null
  estado?: 'vigente' | 'terminado' | 'futuro' | string
  es_duplicado?: boolean
  uso_del_recurso?: boolean
  comprado_por_unergy?: boolean
  contrato_compra_nombre?: string | null
  modalidad_pago?: string | null
  piscina?: 'comercializador' | string
}

/** Una tarjeta de contrato de la pestaña Proyectos (piscinas a/b/c/g). */
interface PcContrato {
  id: number
  nombre: string
  comprador_nombre?: string | null
  vendedor_nombre?: string | null
  vendedor_nit?: string | null
  tarifa_base?: number | null
  responsable?: string | null
  responsable_relevante?: boolean
  plantas: PcPlanta[]
  contrato_ppa_id?: number | null
  numero_codigo_contrato?: string | null
  contrato_interno?: string | null
  _proyecto_id?: number | null
  /** Vigencia del contrato mismo (g. Plantas externas, cuando no tiene plantas vinculadas). */
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

/** Piscinas estandarizadas a-g (`pcPools`). */
interface PcPools {
  ppa_venta_ungg: PcContrato[]
  ppa_compra_ungc: PcContrato[]
  ppa_compra_externa: PcContrato[]
  bolsa_compra_ungg: PcContrato[]
  bolsa_compra_ungc: PcContrato[]
  bolsa_venta_ungg: PcPlanta[]
  bolsa_venta_ungc: PcPlanta[]
}

type PcCounts = Record<string, number>

/** `GET /cumplimiento/plantas-contratos` — también la fuente de la pestaña Revisión del mes. */
interface PcData {
  venta?: PcContrato[]
  compra?: PcContrato[]
  compra_externa?: PcContrato[]
  bolsa?: PcPlanta[]
  bolsa_libre?: PcPlanta[]
  bolsa_comercializador?: PcPlanta[]
  pools?: Omit<PcPools, 'ppa_compra_externa'>
  counts?: PcCounts
  counts_vigentes?: PcCounts
  counts_terminados?: PcCounts
  fecha_corte?: string | null
}

interface EtContratoResumen {
  id: number
  nombre: string
  dias_activos?: number
  pct: number
  es_duplicado?: boolean
}

interface EtPlanta {
  id: number
  nombre: string
  modo: 'ppa' | 'bolsa' | 'mixto' | 'sin_datos' | string
  ppa_mwh: number | null
  bolsa_mwh: number | null
  gen_mwh: number | null
  contratos: EtContratoResumen[]
}

/** `GET /cumplimiento/energia-transada`. */
interface EtData {
  periodo?: { es_mes_actual: boolean; dia_corte: number; month: number; year: number }
  warning?: string | null
  totales: { gen_mwh: number; ppa_mwh: number; bolsa_mwh: number; n_plantas: number }
  plantas: EtPlanta[]
}

interface MatrizMes {
  valor_mwh: number | null
  estado?: string
  tipo_datos?: string
}

interface MatrizProyecto {
  id: number
  nombre: string
  pct_despacho_rep?: number | null
  meses: MatrizMes[]
}

/** Una fila de la Matriz anual — la lista viene instantánea (sin generación) y
 *  cada fila se completa por su cuenta (`_loading`/`_error`) en paralelo. */
interface MatrizContratoDetalle {
  id: number
  nombre_interno?: string | null
  numero_codigo_contrato?: string | null
  comprador_nombre?: string | null
  responsable?: string | null
  responsable_relevante?: boolean
  n_plantas: number | null
  meses: MatrizMes[]
  proyectos: MatrizProyecto[]
  estado_cumplimiento: string | null
  meses_en_deficit: number
  requiere_bolsa: boolean
  total_anual_mwh: number | null
  total_min_anual_mwh?: number | null
  bolsa_anual_mwh: number | null
  _loading: boolean
  _error: boolean
}

interface BeCelda {
  real?: number
  proyectado?: number
  total?: number
  n_plantas?: number
}

interface BeBalance {
  ungg: {
    venta_bolsa: BeCelda
    compra_bolsa_directa: BeCelda
    compra_bolsa_no_directa: BeCelda
    compra_bolsa_total: BeCelda
    neto: BeCelda
  }
  ungc: { venta_bolsa: BeCelda }
}

type BeCategoria = 'a' | 'c' | 'uso' | 'e' | 'f' | 'g'

interface BeInventarioFila {
  proyecto_id: number
  desde?: string | null
  hasta?: string | null
  categoria: BeCategoria
  frontera: string
  planta: string
  estado: string
  metodo: string
  contrato?: string | null
  pct?: number | null
  mwh_real: number | null
  mwh_proyectado: number | null
  mwh_total: number | null
  estimado?: boolean
  dias?: number | null
  gen_tramo_real?: number | null
  gen_tramo_proyectado?: number | null
}

/** `GET /cumplimiento/balance-energia`. */
interface BeData {
  balance: BeBalance
  periodo: { es_mes_actual: boolean; dia_corte: number; dias_mes: number; es_mes_futuro: boolean }
  advertencias: {
    compra_externa_en_bolsa: { frontera: string; mwh_total: number }[]
    pct_anomalos: { planta: string; motivo: string }[]
    sin_datos: { planta: string; motivo?: string }[]
    tramos_estimados: unknown[]
  }
  inventario: BeInventarioFila[]
  warning?: string | null
}

/** Una aparición de una planta en un contrato de venta (`revPorPlantaVenta`). */
interface RevAparicion {
  contrato: string
  codigo_sic?: string | null
  pct: number | null
  marca: string | null
  uso_del_recurso: boolean
  modalidad_pago: string | null
  desde: string | null
  hasta: string | null
  estado?: string
  // Agregados por `repartirPares()` — no vienen del backend.
  pctOriginal?: number | null
  repartido?: boolean
}

interface RevPlantaVenta {
  id: number
  nombre: string
  apariciones: RevAparicion[]
  marcada: boolean
  nContratos: number
}

/** Veredicto de `motivoDuplicada()` — `null` si la planta no está duplicada. */
interface RevVeredictoDuplicada {
  motivo: string
  maxPct: number
  escalaRota: boolean
  sinPct: boolean
}

interface Responsable extends ResponsablePpa {
  n_contratos: number
}

/** Lo mínimo que necesitan los helpers de "fila de planta" (filaTerminada,
 *  filaColorNombre, ventanaFila...) — los llaman con `PcPlanta` y con las formas
 *  sintéticas de `revUngc`/`revUsoRecurso`, que no comparten todos los campos. */
interface FilaConEstado {
  id?: number
  estado?: string | null
  segmento_inicio?: string | null
  segmento_fin?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

// ── Formas de los builders puros en cumplimientoMatrizExcel.js / cumplimientoAnualExport.js ──
// Son JS (deliberado: se testean en Node sin depender de xlsx-js-style) — se tipa
// aquí el borde de la importación dinámica, no el archivo en sí.
interface MatrizAoaBuilt {
  aoa: (string | number)[][]
  rowLevels: number[]
  formulaCells: { r: number; c: number; f: string; kind: string }[]
  totalRow: number
  headerRow: number
}
interface CumplimientoMatrizExcelModule {
  construirMatrizAOA: (
    data: { year: number; contratos: MatrizContratoDetalle[] },
    year: number,
  ) => MatrizAoaBuilt
}

interface FilaMensualExport {
  mes: string
  genMwh: number
  minMwh: number | null
  maxMwh: number | null
  estado?: string
  estadoLabel: string
  comprasBolsaMwh: number | null
  excedentesMwh: number | null
}
interface PlantaAnualExport {
  nombre: string
  contrato: string
  pctDespacho: number | null
  genAportadaMwh: number
  esDuplicado: boolean
}
interface ContratoAnualAoaBuilt {
  aoa: (string | number)[][]
  headerRow: number
  totalRow: number
  plantHeaderRow: number
  plantTotalRow: number
  nCols: number
  plantCols: number
}
/** `jspdf-autotable` aumenta el `jsPDF` con `lastAutoTable` en runtime; sus
 *  tipos no lo reflejan (mismo patrón que `InformeOMView.vue`). */
interface DocConAutoTable {
  lastAutoTable: { finalY: number }
}

interface CumplimientoAnualExportModule {
  construirContratoAnualAOA: (opts: {
    contrato: {
      nombre_interno?: string | null
      numero_codigo_contrato?: string | null
      comprador_nombre?: string | null
    }
    year: number
    meses: AnualMes[]
    consolidado?: boolean
  }) => ContratoAnualAoaBuilt
  sheetNameSafe: (name: string) => string
  slugify: (s: string) => string
  prepararFilasMensuales: (meses: AnualMes[]) => FilaMensualExport[]
  totalizarFilasMensuales: (filas: FilaMensualExport[]) => {
    genMwh: number
    minMwh: number
    maxMwh: number
    comprasBolsaMwh: number
    excedentesMwh: number
  }
  agregarPlantasAnuales: (
    meses: AnualMes[],
    opts?: { incluirContrato?: boolean },
  ) => PlantaAnualExport[]
  fmtNumExport: (v: number | null | undefined, decimales?: number) => string
}

/** Registro GESCON tal como lo consume esta vista — más rico que `RegistroAsic`
 *  (que solo afirma lo verificado contra `GesconView.vue`). */
interface RegistroGesconDetalle extends RegistroAsic {
  planta_nombre?: string | null
  proyecto_id?: number | null
  es_duplicado?: boolean
  uso_del_recurso?: boolean
  tipo_solicitud?: string | null
  porcentaje_despacho?: number | null
  fecha_inicio?: string | null
  fecha_fin_efectiva?: string | null
  estado_solicitud?: string | null
  es_version_vigente?: boolean
  contrato_ppa_id?: number | null
  nombre_interno?: string | null
}

// ── LocalStorage cache ───────────────────────────────────────────────────────
const CACHE_PREFIX = 'cumpl_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type CacheParams = Record<string, unknown>

function cacheKey(endpoint: string, params: CacheParams): string {
  return CACHE_PREFIX + endpoint + '|' + JSON.stringify(params)
}

function cacheGet<T>(endpoint: string, params: CacheParams): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(endpoint, params))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T }
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(endpoint, params))
      return null
    }
    return data
  } catch {
    return null
  }
}

function cacheSet<T>(endpoint: string, params: CacheParams, data: T): void {
  try {
    localStorage.setItem(cacheKey(endpoint, params), JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* quota exceeded — ignore */
  }
}

function cacheClearAll(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

function cacheGetSize(): string {
  let bytes = 0,
    count = 0
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

async function cachedGet<T>(
  cacheEndpointKey: string,
  params: CacheParams,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = cacheGet<T>(cacheEndpointKey, params)
  if (cached) return cached
  const data = await loader()
  cacheSet(cacheEndpointKey, params, data)
  return data
}

/** El `detail` que manda el backend legacy en el cuerpo del error, si lo hay. */
function errDetail(e: unknown): string | undefined {
  return isFetchError<{ detail?: string }>(e) ? e.data?.detail : undefined
}

const cacheSize = ref(cacheGetSize())
const cacheClearing = ref(false)

function updateCacheSize() {
  cacheSize.value = cacheGetSize()
}

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
  simData.value = null
  pcData.value = null
  etData.value = null
  beData.value = null
  revData.value = null
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

watch(verOcultos, () => {
  recargarPorResponsables()
})

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  'Estrategia',
  'Cumplimiento',
  'Proyectos',
  'Energía transada',
  'Matriz anual',
  'Balance de energía',
  'Revisión del mes',
]
const activeTab = ref(0)

// ── Chart constants ───────────────────────────────────────────────────────────
const SVG_W = 820
const SVG_H = 340
const PAD_L = 62
const PAD_R = 22
const PAD_T = 18
const PAD_B = 42
const PLOT_W = SVG_W - PAD_L - PAD_R
const PLOT_H = SVG_H - PAD_T - PAD_B
const N = 12
const slotW = PLOT_W / N
const barW = slotW * 0.54

// ── Labels ────────────────────────────────────────────────────────────────────
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const MESES_OPTIONS = MESES.map((m, i) => ({ label: m, value: i + 1 }))

// ── Shared ────────────────────────────────────────────────────────────────────
const now = new Date()
const years = Array.from({ length: 18 }, (_, i) => 2024 + i)

// ── Cumplimiento state ────────────────────────────────────────────────────────
const contratos = ref<
  ((ContratoCumplimientoPpa & { label: string }) | { id: typeof CONSOLIDADO_ID; label: string })[]
>([])
const selectedYear = ref(now.getFullYear())
const selectedContratoId = ref<ContratoCumplimientoPpa['id'] | typeof CONSOLIDADO_ID | null>(null)
const anualData = ref<AnualDataView | null>(null)
const chartLoading = ref(false)
const chartError = ref<string | null>(null)
const tableData = ref<FilaResumenAnual[]>([])
const tableLoading = ref(false)
const hovered = ref<number | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const selectedMonthIdx = ref<number | null>(null)
const chartBox = ref<HTMLDivElement | null>(null)

// ── Backend proyectos (para filtrar por fecha_fin_representacion) ─────────────
const backendProyectos = ref<ProyectoConDetalle[]>([])

async function loadBackendProyectos() {
  try {
    backendProyectos.value = await catalogoProyectos.cargar()
  } catch {
    /* degradar silenciosamente */
  }
}

// ── Simulador state ───────────────────────────────────────────────────────────
const simYear = ref(now.getFullYear())
const simMonth = ref(now.getMonth() + 1)
const simData = ref<SimuladorData | null>(null)
const simLoading = ref(false)
const simError = ref<string | null>(null)
const simAssignments = ref<Record<string, SimPlanta[]>>({})
const hiddenContratos = ref<Set<number | string>>(new Set())
const ficticioContratos = ref<SimContrato[]>([])
const showNuevoForm = ref(false)
const ficticioNombre = ref('')
const ficticioMin = ref(0)
const ficticioMax = ref(0)
let ficticioNextId = 1
const expandedContratos = ref<(number | string)[]>([])
const sortDesc = ref(true)
// Filtro por estado (deriva de la proyección, ver estadoEfectivo en simResults).
// null = todos | 'ok' (cumplido) | 'deficit' (incumplido) | 'excedente' (exposición en bolsa)
const estadoFiltro = ref<'ok' | 'deficit' | 'excedente' | null>(null)
// Tonos semánticos de badge/chip. Van como clases completas porque Tailwind solo
// genera las utilidades que ve literales en el fuente.
const TONO = {
  primario: 'bg-unergy-purple/10 text-unergy-purple',
  ok: 'bg-success/12 text-success',
  deficit: 'bg-destructive/12 text-destructive',
  excedente: 'bg-chart-2/15 text-chart-2',
  aviso: 'bg-warning/18 text-warning',
  info: 'bg-chart-3/12 text-chart-3',
  neutro: 'bg-unergy-deep/6 text-muted-foreground',
  fuerte: 'bg-unergy-deep/8 text-unergy-deep',
} as const

const ESTADO_FILTROS = [
  {
    key: 'ok',
    label: 'Cumplido',
    activo: 'border-success bg-success/12 text-success',
    punto: 'bg-success',
    tip: 'Entre el mínimo y el máximo (por proyección de cierre)',
  },
  {
    key: 'deficit',
    label: 'Incumplido',
    activo: 'border-destructive bg-destructive/12 text-destructive',
    punto: 'bg-destructive',
    tip: 'Déficit: por debajo del mínimo (por proyección de cierre)',
  },
  {
    key: 'excedente',
    label: 'Exposición en bolsa',
    activo: 'border-chart-2 bg-chart-2/12 text-chart-2',
    punto: 'bg-chart-2',
    tip: 'Excedente sobre el máximo o plantas duplicadas (compra en bolsa)',
  },
] as const
function toggleEstadoFiltro(k: 'ok' | 'deficit' | 'excedente') {
  estadoFiltro.value = estadoFiltro.value === k ? null : k
}
// Filtro por offtaker (comprador del contrato). Vacío = todos. Opciones derivadas
// de los contratos cargados; '' agrupa los que no tienen comprador (ej. PPA nuevo).
const offtakersFiltro = ref<string[]>([])
const offtakerOpts = computed<ComboBoxOption[]>(() => {
  const nombres = new Set(allContratos.value.map((c) => c.comprador_nombre || ''))
  const opts = [...nombres]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((n) => ({ label: n, value: n }))
  if (nombres.has('')) opts.push({ label: '(Sin offtaker)', value: '' })
  return opts
})
function contratoMatchOfftaker(c: SimContrato) {
  if (!offtakersFiltro.value.length) return true
  return offtakersFiltro.value.includes(c.comprador_nombre || '')
}
// Exposición en bolsa = excedente (vende en bolsa) O plantas duplicadas (compra en bolsa,
// genDup>0), aunque el contrato esté cumplido/déficit. Los demás estados son excluyentes.
function contratoMatchEstado(r: SimResultado | undefined, key: 'ok' | 'deficit' | 'excedente') {
  if (!r) return false
  if (key === 'excedente') return r.estadoEfectivo === 'excedente' || r.tieneDup
  return r.estadoEfectivo === key
}
const dragPlanta = ref<SimPlanta | null>(null)
const dragFromContrato = ref<number | string | undefined>(undefined)
const dragOver = ref<number | string | null>(null)

// ── Proyectos tab state ──────────────────────────────────────────────────────
// Estados estandarizados a-f (mismo catálogo que GET /clasificacion-energia/categorias
// en el backend): agente UNGG (generador) / UNGC (comercializador) × PPA / bolsa × rol.
const PC_GRUPOS = [
  {
    label: 'PPA',
    modes: [
      {
        key: 'ppa_venta_ungg',
        agente: 'Venta · UNGG',
        tono: TONO.primario,
      },
      {
        key: 'ppa_compra_ungc',
        agente: 'Compra · UNGC',
        tono: TONO.aviso,
      },
      {
        key: 'ppa_compra_externa',
        agente: 'Plantas externas',
        tono: TONO.aviso,
      },
    ],
  },
  {
    label: 'Compra en bolsa',
    modes: [
      { key: 'bolsa_compra_ungg', agente: 'UNGG', tono: TONO.aviso },
      { key: 'bolsa_compra_ungc', agente: 'UNGC', tono: TONO.fuerte },
    ],
  },
  {
    label: 'Venta en bolsa',
    modes: [
      { key: 'bolsa_venta_ungg', agente: 'UNGG', tono: TONO.fuerte },
      { key: 'bolsa_venta_ungc', agente: 'UNGC', tono: TONO.fuerte },
    ],
  },
] as const
const PC_MODE_DESC = {
  ppa_venta_ungg:
    'a. Plantas en contratos GESCON donde UNGG le vende a otro agente (Terpel, NEU, …).',
  ppa_compra_ungc:
    'b. Contratos en que UNGC compra energía a algún agente en GESCON (usualmente a UNGG).',
  ppa_compra_externa:
    'g. Plantas externas: PPAs firmados para comprarle energía directamente a terceros, SIN registro en GESCON — aquí está el detalle de a quién le compramos.',
  bolsa_compra_ungg:
    'c. Compras de UNGG a precio de bolsa: plantas duplicadas que aportan a un contrato con origen bolsa (los PLC entrarán cuando se liquiden).',
  bolsa_compra_ungc: 'd. UNGC comprando en bolsa — reglas de negocio por definir.',
  bolsa_venta_ungg: 'e. Plantas sin contrato en GESCON: venden en bolsa desde UNGG.',
  bolsa_venta_ungc:
    'f. UNGC compra la energía a UNGG (usualmente a precio de bolsa) para venderla en bolsa.',
}
const pcYear = ref(now.getFullYear())
const pcMonth = ref(now.getMonth() + 1)
const pcMode = ref<
  | 'ppa_venta_ungg'
  | 'ppa_compra_ungc'
  | 'ppa_compra_externa'
  | 'bolsa_compra_ungg'
  | 'bolsa_compra_ungc'
  | 'bolsa_venta_ungg'
  | 'bolsa_venta_ungc'
>('ppa_venta_ungg')
const pcData = ref<PcData | null>(null)
const pcLoading = ref(false)
const pcError = ref<string | null>(null)

// Sub-listas de bolsa (backend de828e3): comercializador (SIC vigente, comprador UNGC)
// vs libre (sin SIC vigente). Fallback a partir de "piscina" si el backend solo trae bolsa.
const pcBolsaComercializador = computed<PcPlanta[]>(() => {
  const d = pcData.value
  if (!d) return []
  if (Array.isArray(d.bolsa_comercializador)) return d.bolsa_comercializador
  return (d.bolsa || []).filter((p) => p.piscina === 'comercializador')
})
const pcBolsaLibre = computed<PcPlanta[]>(() => {
  const d = pcData.value
  if (!d) return []
  if (Array.isArray(d.bolsa_libre)) return d.bolsa_libre
  return (d.bolsa || []).filter((p) => p.piscina !== 'comercializador')
})

// Piscinas estandarizadas a-f: usa `pools` del backend; si aún no llega
// (deploy en tránsito), las deriva client-side con la misma regla.
const pcPools = computed<PcPools>(() => {
  const d = pcData.value
  if (!d)
    return {
      ppa_venta_ungg: [],
      ppa_compra_ungc: [],
      bolsa_compra_ungg: [],
      bolsa_compra_ungc: [],
      bolsa_venta_ungg: [],
      bolsa_venta_ungc: [],
      ppa_compra_externa: [],
    }
  // ppa_compra_externa por delante: un payload cacheado de un backend viejo puede no traerla
  if (d.pools) return { ppa_compra_externa: d.compra_externa || [], ...d.pools }
  const a: PcContrato[] = [],
    c: PcContrato[] = []
  for (const ct of d.venta || []) {
    const dup = (ct.plantas || []).filter((p) => p.es_duplicado)
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
  let total = 0,
    dup = 0,
    ur = 0
  for (const c of pcPools.value.ppa_venta_ungg || []) {
    for (const p of c.plantas || []) {
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
const pcModalidad = ref<'propio' | 'duplicado' | 'uso_recurso' | null>(null)
const PC_MODALIDAD_FILTROS = [
  {
    key: 'propio',
    label: 'Suministro propio',
    activo: 'border-muted-foreground bg-muted-foreground/12 text-muted-foreground',
    punto: 'bg-muted-foreground',
    tip: 'Plantas con suministro propio (sin compra en bolsa ni uso del recurso)',
  },
  {
    key: 'duplicado',
    label: 'Compra en bolsa',
    activo: 'border-warning bg-warning/12 text-warning',
    punto: 'bg-warning',
    tip: 'Plantas duplicadas: aportan al contrato con origen bolsa (genera garantías)',
  },
  {
    key: 'uso_recurso',
    label: 'Uso del recurso',
    activo: 'border-chart-3 bg-chart-3/12 text-chart-3',
    punto: 'bg-chart-3',
    tip: 'Plantas en bolsa que se pagan al cliente a precio bolsa (sin garantías)',
  },
] as const
function modalidadPlanta(p: PcPlanta): 'uso_recurso' | 'duplicado' | 'propio' {
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
    .map((c) => ({
      ...c,
      plantas: (c.plantas || []).filter((p) => modalidadPlanta(p) === pcModalidad.value),
    }))
    .filter((c) => c.plantas.length)
})

// Contratos de compra externa sin plantas vinculadas: no sabemos a qué planta
// le compramos — se alerta arriba de las tarjetas (g).
const externasSinPlantas = computed(() =>
  (pcPools.value.ppa_compra_externa || []).filter((c) => !(c.plantas || []).length),
)

// ── Detalle de contrato (tab Proyectos): PPA formal + GESCON ─────────────────
// Click en una tarjeta → modal con el contrato del módulo PPA (indexaciones,
// cantidades, tarifas, compromisos) + los registros GESCON del contrato
// (vigencia efectiva) + las plantas del mes consultado.
type DcModo =
  | 'ppa_venta_ungg'
  | 'ppa_compra_ungc'
  | 'ppa_compra_externa'
  | 'bolsa_compra_ungg'
  | 'bolsa_venta_ungg'
  | 'bolsa_venta_ungc'
/** La "tarjeta" que abrió el detalle: un `PcContrato` real, o el sintético que
 *  arma `abrirDetallePlanta()` para una planta de las piscinas e/f (sin contrato). */
type DcOrigen = Partial<PcContrato> & { nombre: string }
interface DetalleContrato {
  c: DcOrigen
  modo: DcModo
}

const detalleContrato = ref<DetalleContrato | null>(null)
const dcPpa = ref<ContratoPpa | null>(null)
const dcGescon = ref<RegistroGesconDetalle[]>([])
const dcLoading = ref(false)
const dcError = ref<string | null>(null)

const DC_TIPOS: Record<DcModo, { label: string; tono: string }> = {
  ppa_venta_ungg: { label: 'Venta PPA · UNGG', tono: TONO.primario },
  ppa_compra_ungc: { label: 'Compra PPA · UNGC', tono: TONO.aviso },
  ppa_compra_externa: {
    label: 'Compra externa (fuera de GESCON)',
    tono: TONO.aviso,
  },
  bolsa_compra_ungg: {
    label: 'Compra en bolsa · UNGG',
    tono: TONO.aviso,
  },
  bolsa_venta_ungg: { label: 'Venta en bolsa · UNGG', tono: TONO.fuerte },
  bolsa_venta_ungc: { label: 'Venta en bolsa · UNGC', tono: TONO.fuerte },
}
const dcTipo = computed(() =>
  detalleContrato.value ? DC_TIPOS[detalleContrato.value.modo] : DC_TIPOS.ppa_venta_ungg,
)

const fmtQ = (v: number | string | null | undefined) =>
  v == null || v === '' ? '—' : Number(v).toLocaleString('es-CO')

const dcContraparte = computed(() => {
  const c = detalleContrato.value?.c
  const p = dcPpa.value
  const vnd = p?.vendedor_nombre || c?.vendedor_nombre
  const cmp = p?.comprador_nombre || c?.comprador_nombre
  const parts: string[] = []
  if (vnd) parts.push(`Vendedor: ${vnd}${p?.vendedor_nit ? ` (NIT ${p.vendedor_nit})` : ''}`)
  if (cmp) parts.push(`Comprador: ${cmp}${p?.comprador_nit ? ` (NIT ${p.comprador_nit})` : ''}`)
  return parts.join('  ·  ')
})

// Campos del contrato formal, en el orden en que se muestran en la grilla
const dcCamposFormales = computed(() => {
  const p = dcPpa.value
  if (!p) return []
  return [
    { label: 'Número / código', value: p.numero_codigo_contrato || '—', mono: true },
    { label: 'Tipo de contrato', value: p.tipo_contrato || 'venta', mono: false },
    {
      label: 'Vigencia',
      value: `${p.fecha_inicio || '—'} → ${p.fecha_fin || 'indefinida'}`,
      mono: true,
    },
    { label: 'Tarifa base ($/kWh)', value: fmtQ(p.tarifa_base), mono: true },
    { label: 'Índice de indexación', value: p.indice_indexacion || '—', mono: false },
    { label: 'Periodicidad indexación', value: p.periodicidad_indexacion || '—', mono: false },
    {
      label: 'Período base indexación',
      value: p.periodo_indexacion_base
        ? `${p.periodo_indexacion_base}${p.valor_indexacion_base != null ? ` = ${fmtQ(p.valor_indexacion_base)}` : ''}`
        : '—',
      mono: true,
    },
    { label: 'Cantidad mínima (kWh/mes)', value: fmtQ(p.cantidad_minima_kwh_mes), mono: true },
    { label: 'Cantidad máxima (kWh/mes)', value: fmtQ(p.cantidad_maxima_kwh_mes), mono: true },
    { label: 'Periodicidad facturación', value: p.periodicidad_facturacion || '—', mono: false },
    {
      label: 'Tiempo de pago',
      value: p.tiempo_pago != null ? `${p.tiempo_pago} días` : '—',
      mono: false,
    },
    { label: 'Condiciones de pago', value: p.condiciones_pago || '—', mono: false },
  ]
})

const dcCompromisos = computed(() =>
  [...(dcPpa.value?.compromisos_energia || [])].sort(
    (a, b) => a['año'] - b['año'] || a.mes - b.mes,
  ),
)
const dcTarifas = computed(() =>
  [...(dcPpa.value?.tarifas || [])].sort((a, b) => a['año'] - b['año'] || a.mes - b.mes),
)

function dcEstadoClase(e: string | null | undefined) {
  if (e === 'publicado') return TONO.ok
  if (e === 'desistimiento' || e === 'rechazado') return TONO.deficit
  return TONO.neutro
}

async function abrirDetalleContrato(c: DcOrigen, modo: DcModo) {
  detalleContrato.value = { c, modo }
  dcPpa.value = null
  dcGescon.value = []
  dcError.value = null
  dcLoading.value = true
  try {
    // 1) Contrato formal del módulo PPA (si la tarjeta tiene id real)
    const ppaId = c.contrato_ppa_id || (typeof c.id === 'number' ? c.id : null)
    let ppa: ContratoPpa | null = null
    if (ppaId) {
      try {
        ppa = await ppaService.obtener(ppaId)
      } catch {
        ppa = null
      }
    }
    // 2) Registros GESCON del contrato (por contrato_interno; fallback por SIC;
    //    último fallback: historial GESCON de la planta, para capas sin contrato)
    let gescon: RegistroGesconDetalle[] = []
    const ci = c.numero_codigo_contrato || c.contrato_interno || ppa?.numero_codigo_contrato
    if (ci) {
      try {
        gescon = (await ppaService.listarAsic({
          contrato_interno: ci,
        })) as unknown as RegistroGesconDetalle[]
      } catch {
        gescon = []
      }
    }
    if (!gescon.length && c._proyecto_id) {
      try {
        gescon = (await ppaService.listarAsic({
          proyecto_id: c._proyecto_id,
        })) as unknown as RegistroGesconDetalle[]
      } catch {
        /* sin fallback */
      }
    }
    if (!gescon.length && modo !== 'ppa_compra_externa') {
      const sic = (c.plantas || []).find((p) => p.codigo_sic)?.codigo_sic
      if (sic) {
        try {
          gescon = (await ppaService.listarAsic({
            codigo_sic_contrato: sic,
          })) as unknown as RegistroGesconDetalle[]
        } catch {
          /* sin fallback */
        }
      }
    }
    // Vigentes primero, luego por fecha de inicio descendente
    gescon.sort(
      (a, b) =>
        Number(b.es_version_vigente === true) - Number(a.es_version_vigente === true) ||
        String(b.fecha_inicio || '').localeCompare(String(a.fecha_inicio || '')),
    )
    // 3) Contrato actual desde GESCON: si la capa no traía PPA, el registro
    //    vigente puede apuntar al contrato con contrato_ppa_id
    if (!ppa) {
      const vig = gescon.find((r) => r.es_version_vigente && r.contrato_ppa_id)
      if (vig?.contrato_ppa_id) {
        try {
          ppa = await ppaService.obtener(vig.contrato_ppa_id)
        } catch {
          ppa = null
        }
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
function abrirDetallePlanta(p: PcPlanta, modo: DcModo) {
  abrirDetalleContrato({ id: undefined, nombre: p.nombre, plantas: [p], _proyecto_id: p.id }, modo)
}
function cerrarDetalleContrato() {
  detalleContrato.value = null
}
const pcCounts = computed<PcCounts | null>(() => {
  const d = pcData.value
  if (!d) return null
  if (d.counts) return d.counts
  const P = pcPools.value
  const nPlantas = (list: PcContrato[]) => list.reduce((s, ct) => s + (ct.plantas?.length || 0), 0)
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
  const pct = (v: number | null | undefined) => (v != null ? Number((v * 100).toFixed(0)) : '')

  const aoa: (string | number)[][] = [
    [`UNERGY — Resumen contratos y plantas · ${mes} ${pcYear.value}`],
    [],
  ]
  const header = [
    'Categoría',
    'Contrato',
    'Contraparte',
    'Planta',
    'SIC',
    '% Despacho',
    'Inicio',
    'Fin',
    'Nota',
  ]
  const headerRow = aoa.length
  aoa.push(header)

  // Categorías estandarizadas a-f (mismo catálogo que GET /clasificacion-energia)
  const P = pcPools.value
  for (const c of P.ppa_venta_ungg) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push([
          'a. PPA Venta (UNGG)',
          c.nombre,
          c.comprador_nombre || '',
          p.nombre,
          p.codigo_sic || '',
          pct(p.pct_despacho),
          p.fecha_inicio || '',
          p.fecha_fin || '',
          p.es_duplicado ? 'Duplicado — ver c.' : '',
        ])
    } else {
      aoa.push([
        'a. PPA Venta (UNGG)',
        c.nombre,
        c.comprador_nombre || '',
        '(sin plantas en GESCON)',
        '',
        '',
        '',
        '',
        '',
      ])
    }
  }
  for (const c of P.ppa_compra_ungc) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push([
          'b. PPA Compra (UNGC)',
          c.nombre,
          c.vendedor_nombre || '',
          p.nombre,
          '',
          '',
          p.fecha_inicio || '',
          p.fecha_fin || '',
          '',
        ])
    } else {
      aoa.push([
        'b. PPA Compra (UNGC)',
        c.nombre,
        c.vendedor_nombre || '',
        '(sin plantas)',
        '',
        '',
        '',
        '',
        '',
      ])
    }
  }
  for (const c of P.ppa_compra_externa || []) {
    if (c.plantas.length) {
      for (const p of c.plantas)
        aoa.push([
          'g. Plantas externas (PPA)',
          c.nombre,
          c.vendedor_nombre || '',
          p.nombre,
          '',
          '',
          p.fecha_inicio || '',
          p.fecha_fin || '',
          'Compra directa fuera de GESCON',
        ])
    } else {
      aoa.push([
        'g. Plantas externas (PPA)',
        c.nombre,
        c.vendedor_nombre || '',
        '(sin plantas vinculadas)',
        '',
        '',
        c.fecha_inicio || '',
        c.fecha_fin || '',
        'Compra directa fuera de GESCON',
      ])
    }
  }
  for (const c of P.bolsa_compra_ungg)
    for (const p of c.plantas)
      aoa.push([
        'c. Compra en Bolsa (UNGG)',
        c.nombre,
        c.comprador_nombre || '',
        p.nombre,
        p.codigo_sic || '',
        pct(p.pct_despacho),
        p.fecha_inicio || '',
        p.fecha_fin || '',
        'Duplicado — origen bolsa',
      ])
  // e/f llevan el tramo del mes: una planta puede tener varios (entró/salió de contrato)
  const notaTramo = (p: PcPlanta, base: string) =>
    filaTerminada(p) ? `${base} — tramo terminado en el mes` : base
  for (const p of P.bolsa_venta_ungg)
    aoa.push([
      'e. Venta en Bolsa (UNGG)',
      '',
      '',
      p.nombre,
      '',
      '',
      p.segmento_inicio || '',
      p.segmento_fin || '',
      notaTramo(p, 'Sin SIC vigente'),
    ])
  for (const p of P.bolsa_venta_ungc)
    aoa.push([
      'f. Venta en Bolsa (UNGC)',
      '',
      'UNGC (comercializador)',
      p.nombre,
      p.codigo_sic || '',
      '',
      p.fecha_inicio || p.segmento_inicio || '',
      p.fecha_fin || p.segmento_fin || '',
      notaTramo(p, 'SIC con comprador UNGC'),
    ])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  for (let c = 0; c < header.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = {
      font: { bold: true, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.morado } },
      alignment: { horizontal: 'center' },
    }
  }
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 })
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }]
  ws['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 24 },
    { wch: 32 },
    { wch: 10 },
    { wch: 11 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
  ]
  ws['!autofilter'] = { ref: `A${headerRow + 1}:I${aoa.length}` }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Resumen ${mes} ${pcYear.value}`.slice(0, 31))
  XLSX.writeFile(
    wb,
    `resumen_contratos_plantas_${pcYear.value}_${String(pcMonth.value).padStart(2, '0')}.xlsx`,
  )
}

// ── Energía transada state ────────────────────────────────────────────────────
// Histórico por mes en localStorage: los meses cerrados son inmutables y se
// guardan sin TTL; el mes actual siempre se consulta fresco y se va guardando
// como parcial. Un prefetch silencioso completa el histórico del año.
const ET_PREFIX = 'cumpl_et_'
const etYear = ref(now.getFullYear())
const etMonth = ref(now.getMonth() + 1)
const etData = ref<EtData | null>(null)
const etLoading = ref(false)
const etError = ref<string | null>(null)
const etFromCache = ref(false)
let etPrefetching = false

const etYearOptions = computed(() => years.filter((y) => y <= now.getFullYear()))

const etMonthOptions = computed(() => {
  const maxMonth = etYear.value === now.getFullYear() ? now.getMonth() + 1 : 12
  return MESES_OPTIONS.filter((o) => o.value <= maxMonth)
})

const etPeriodoLabel = computed(() => {
  const p = etData.value?.periodo
  if (!p) return ''
  return p.es_mes_actual
    ? `Del 1 al ${p.dia_corte} de ${MESES[p.month - 1]!.toLowerCase()} ${p.year}`
    : `Mes completo · ${MESES[p.month - 1]} ${p.year}`
})

function etPct(val: number | null) {
  const total = etData.value?.totales?.gen_mwh
  if (!total || val === null) return '0'
  return ((val / total) * 100).toFixed(1)
}

function etIsCurrentMonth(y: number, m: number) {
  return y === now.getFullYear() && m === now.getMonth() + 1
}

function etCacheKey(y: number, m: number) {
  return `${ET_PREFIX}${y}_${String(m).padStart(2, '0')}`
}

function etCacheGet(y: number, m: number): EtData | null {
  try {
    const raw = localStorage.getItem(etCacheKey(y, m))
    if (!raw) return null
    const { data, partial } = JSON.parse(raw) as { data: EtData; partial: boolean }
    // Un mes guardado como parcial (era el mes en curso) deja de valer cuando el mes cierra
    if (partial && !etIsCurrentMonth(y, m)) {
      localStorage.removeItem(etCacheKey(y, m))
      return null
    }
    return data
  } catch {
    return null
  }
}

function etCacheSet(y: number, m: number, data: EtData) {
  try {
    localStorage.setItem(
      etCacheKey(y, m),
      JSON.stringify({
        ts: Date.now(),
        partial: etIsCurrentMonth(y, m),
        data,
      }),
    )
  } catch {
    /* quota exceeded — ignorar */
  }
}

async function etFetch(y: number, m: number): Promise<EtData> {
  const data = (await cumplimientoService.obtenerEnergiaTransada({
    year: y,
    month: m,
    incluir_todos: incluirTodos(),
  })) as unknown as EtData
  etCacheSet(y, m, data)
  return data
}

async function loadEnergiaTransada() {
  const y = etYear.value,
    m = etMonth.value
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
    const status = isFetchError(e) ? e.status : undefined
    etError.value =
      errDetail(e) ||
      (status === 401
        ? 'Sesión expirada — inicia sesión de nuevo.'
        : e instanceof Error && e.name === 'TimeoutError'
          ? 'Tiempo de espera agotado — el servidor tardó demasiado.'
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
    const lastClosed = y === now.getFullYear() ? now.getMonth() : y < now.getFullYear() ? 12 : 0
    for (let m = 1; m <= lastClosed; m++) {
      if (etCacheGet(y, m)) continue
      try {
        await etFetch(y, m)
      } catch {
        break /* backend con problemas — reintentar en próxima visita */
      }
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
const anualMatrizData = ref<{ year: number; contratos: MatrizContratoDetalle[] } | null>(null)
const anualMatrizLoading = ref(false)
const anualMatrizError = ref('')
const anualMatrizYear = ref(now.getFullYear())
const expandedMatriz = ref<number[]>([])
const matrizSoloNoCumple = ref(false)
const matrizBusqueda = ref('')
const matrizContratosSel = ref<string[]>([]) // ids (string) de contratos elegidos (vacío = todos)
const matrizOfftakersSel = ref<string[]>([]) // nombres de offtaker elegidos (vacío = todos)

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
    const data = await cumplimientoService.obtenerAnualMatrizContratos({
      year,
      incluir_todos: incluirTodos(),
    })
    const contratos = (data.contratos || []).map((c) => ({
      ...c,
      meses: [],
      proyectos: [],
      estado_cumplimiento: null,
      meses_en_deficit: 0,
      requiere_bolsa: false,
      total_anual_mwh: null,
      bolsa_anual_mwh: null,
      n_plantas: null,
      _loading: true,
      _error: false,
    })) as unknown as MatrizContratoDetalle[]
    anualMatrizData.value = { year, contratos }
    anualMatrizLoading.value = false
  } catch (e) {
    anualMatrizError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
    anualMatrizLoading.value = false
    return
  }

  // Filas reactivas a llenar (se mutan a través del proxy reactivo para disparar el render).
  const rows = anualMatrizData.value.contratos
  const queue = rows.map((_, i) => i)
  const CONC = 4
  const worker = async () => {
    while (queue.length) {
      if (matrizLoadId !== loadId) return // llegó otra carga: abortar la vieja
      const idx = queue.shift()
      if (idx === undefined) continue
      const row = rows[idx]
      if (!row) continue
      try {
        const det = await cumplimientoService.obtenerAnualMatrizContrato(row.id, { year })
        if (matrizLoadId !== loadId) return
        Object.assign(row, det, { _loading: false, _error: false })
      } catch {
        Object.assign(row, { _loading: false, _error: true })
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))
}

function toggleMatriz(id: number) {
  const i = expandedMatriz.value.indexOf(id)
  if (i >= 0) expandedMatriz.value.splice(i, 1)
  else expandedMatriz.value.push(id)
}

async function exportarMatrizExcel() {
  if (!anualMatrizData.value) return
  const XLSX = await import('xlsx-js-style')
  const { construirMatrizAOA } =
    (await import('./cumplimientoMatrizExcel.js')) as unknown as CumplimientoMatrizExcelModule
  const { aoa, rowLevels, formulaCells, totalRow, headerRow } = construirMatrizAOA(
    anualMatrizData.value,
    anualMatrizYear.value,
  )

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Fórmulas
  for (const fc of formulaCells) {
    const ref = XLSX.utils.encode_cell({ r: fc.r, c: fc.c })
    ws[ref] = { t: 'n', f: fc.f }
  }

  // Outline (filas de proyecto colapsables bajo su contrato)
  ws['!rows'] = rowLevels.map((l) => (l > 0 ? { level: l } : {}))

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
const matrizContratoOpts = computed<ComboBoxOption[]>(() =>
  (anualMatrizData.value?.contratos || []).map((c) => ({
    value: String(c.id),
    label: c.comprador_nombre
      ? `${c.nombre_interno || c.numero_codigo_contrato || '#' + c.id} — ${c.comprador_nombre}`
      : c.nombre_interno || c.numero_codigo_contrato || '#' + c.id,
  })),
)
const matrizOfftakerOpts = computed<ComboBoxOption[]>(() => {
  const set = new Set<string>()
  for (const c of anualMatrizData.value?.contratos || [])
    if (c.comprador_nombre) set.add(c.comprador_nombre)
  return [...set].sort((a, b) => a.localeCompare(b, 'es')).map((n) => ({ label: n, value: n }))
})

const matrizFiltrada = computed(() => {
  const cs = anualMatrizData.value?.contratos || []
  const q = matrizBusqueda.value.trim().toLowerCase()
  const cSel = matrizContratosSel.value
  const oSel = matrizOfftakersSel.value
  return cs.filter(
    (c) =>
      (!matrizSoloNoCumple.value || c.estado_cumplimiento === 'no_cumple') &&
      (!cSel.length || cSel.includes(String(c.id))) &&
      (!oSel.length || oSel.includes(c.comprador_nombre ?? '')) &&
      (!q ||
        (c.nombre_interno || c.numero_codigo_contrato || '').toLowerCase().includes(q) ||
        (c.comprador_nombre || '').toLowerCase().includes(q)),
  )
})

const matrizTotalesMensuales = computed(() => {
  const tot = Array.from({ length: 12 }, () => 0)
  for (const c of matrizFiltrada.value)
    (c.meses || []).forEach((m, i) => {
      tot[i] = (tot[i] ?? 0) + (m.valor_mwh || 0)
    })
  return tot
})

// Formato compacto para celdas de la matriz (sin sufijo " MWh", que recargaba 12 columnas).
function fmtNum(v: number | null | undefined) {
  return v == null ? '·' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

// True mientras alguna fila de contrato aún está cargando su detalle (deshabilita el export).
const matrizFilasCargando = computed(() =>
  (anualMatrizData.value?.contratos || []).some((c) => c._loading),
)

// ── Empresas responsables de PPA ──────────────────────────────────────────────
// El responsable es un catálogo (no texto libre) para que los filtros de la
// plataforma trabajen sobre valores consistentes. `incluir_en_cumplimiento=false`
// esconde sus contratos de la Matriz anual; sin responsable = siempre visible.
const respAbierto = ref(false)
const respDirty = ref(false) // hubo cambios → recargar la matriz al cerrar
const respError = ref('')
const respCargando = ref(false)
const respGuardando = ref(false)
const responsables = ref<Responsable[]>([])
const respNuevo = ref('')
const respContratos = ref<MatrizContratoDetalle[]>([]) // TODOS los contratos, incluidos los ocultos
const respSel = ref<number[]>([])
const respAsignarA = ref<string | null>(null)
const respBusqueda = ref('')

// Fila que normalmente NO se vería: solo aparece con "Ver ocultos" encendido, y se
// marca para que quede claro por qué está ahí. Las filas de responsable relevante o
// sin responsable no llevan chip, para no ensuciar el uso diario.
interface ConResponsable {
  responsable?: string | null
  responsable_relevante?: boolean
}

function esOculto(c: ConResponsable | null | undefined) {
  return !!c && c.responsable_relevante === false
}

function responsableChip(c: ConResponsable) {
  if (!c.responsable) return TONO.neutro
  return c.responsable_relevante === false
    ? TONO.deficit // oculto de la matriz
    : TONO.primario
}

// Sentinel en vez de null: el Select solo distingue "sin selección" (undefined,
// muestra el placeholder) de un valor elegido — con null como valor real,
// elegir "Sin responsable" se vería igual que no haber elegido nada.
const SIN_RESPONSABLE = '__sin__'
const respOpcionesAsignar = computed(() => [
  { value: SIN_RESPONSABLE, label: 'Sin responsable' },
  ...responsables.value.map((r) => ({
    value: r.id,
    label: r.incluir_en_cumplimiento ? r.nombre : `${r.nombre} (oculto)`,
  })),
])

const respContratosFiltrados = computed(() => {
  const q = respBusqueda.value.trim().toLowerCase()
  if (!q) return respContratos.value
  return respContratos.value.filter(
    (c) =>
      (c.nombre_interno || c.numero_codigo_contrato || '').toLowerCase().includes(q) ||
      (c.comprador_nombre || '').toLowerCase().includes(q) ||
      (c.responsable || '').toLowerCase().includes(q),
  )
})

async function cargarResponsables() {
  responsables.value = (await ppaService.listarResponsables()) as unknown as Responsable[]
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
      cumplimientoService.obtenerAnualMatrizContratos({
        year: anualMatrizYear.value,
        incluir_todos: true,
      }),
    ])
    respContratos.value = (contratos.contratos || []) as unknown as MatrizContratoDetalle[]
  } catch (e) {
    respError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
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
    respError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
  }
}

async function guardarResponsable(r: Responsable) {
  respError.value = ''
  try {
    await ppaService.actualizarResponsable(r.id, {
      nombre: r.nombre,
      incluir_en_cumplimiento: r.incluir_en_cumplimiento ?? false,
    })
    await refrescarTrasCambio()
  } catch (e) {
    respError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
    await cargarResponsables() // revierte el input al valor real
  }
}

async function borrarResponsable(r: Responsable) {
  respError.value = ''
  try {
    await ppaService.eliminarResponsable(r.id)
    await cargarResponsables()
  } catch (e) {
    respError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
  }
}

async function asignarSeleccionados() {
  if (!respSel.value.length || !respAsignarA.value) return
  respGuardando.value = true
  respError.value = ''
  try {
    await ppaService.asignarResponsables({
      contrato_ids: respSel.value,
      responsable_id: respAsignarA.value === SIN_RESPONSABLE ? null : Number(respAsignarA.value),
    })
    respSel.value = []
    await refrescarTrasCambio()
  } catch (e) {
    respError.value = errDetail(e) || (e instanceof Error ? e.message : undefined) || ''
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
  const data = await cumplimientoService.obtenerAnualMatrizContratos({
    year: anualMatrizYear.value,
    incluir_todos: true,
  })
  respContratos.value = (data.contratos || []) as unknown as MatrizContratoDetalle[]
}

function cerrarResponsables() {
  respAbierto.value = false
  if (respDirty.value) {
    respDirty.value = false
    // Reclasificar cambia el universo de TODAS las pestañas, no solo la matriz.
    recargarPorResponsables()
  }
}

const allContratos = computed<SimContrato[]>(() => {
  if (!simData.value) return []
  return [...simData.value.contratos, ...ficticioContratos.value]
})

const visibleContratos = computed(() => {
  const res = simResults.value
  const filtered = allContratos.value.filter((c) => {
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
    for (const k of ['ok', 'deficit', 'excedente'] as const) {
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
  const maxMeses = Math.max(...rows.map((r) => r.meses_con_compromisos || 0))
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

// ── Tabla resumen anual (DataTable) ───────────────────────────────────────────
const tablaAnualColumns: DataTableColumn[] = [
  { key: 'contrato', header: 'Contrato' },
  { key: 'vigencia', header: 'Vigencia' },
  { key: 'min_anual', header: 'Mín anual', class: 'text-right' },
  { key: 'max_anual', header: 'Máx anual', class: 'text-right' },
  { key: 'meses', header: 'Meses', class: 'text-center' },
  { key: 'icono', header: '', class: 'text-center' },
]

function asFilaAnual(row: DataTableRow): FilaResumenAnual {
  return row as unknown as FilaResumenAnual
}

function filaAnualClass(row: FilaResumenAnual): string {
  if (row.id === selectedContratoId.value) return 'text-primary'
  if (row.id === CONSOLIDADO_ID) return 'text-foreground font-bold'
  return 'text-foreground'
}

// ── Chart math ────────────────────────────────────────────────────────────────
/** El mes bajo el cursor -- computado una vez, para no reindexar `anualData.meses` en cada interpolación del tooltip. */
const hoveredMes = computed<AnualMes | null>(() =>
  hovered.value !== null && anualData.value ? (anualData.value.meses[hovered.value] ?? null) : null,
)
/** El mes elegido para el desglose por planta (click en la barra). */
const selectedMes = computed<AnualMes | null>(() =>
  selectedMonthIdx.value !== null && anualData.value
    ? (anualData.value.meses[selectedMonthIdx.value] ?? null)
    : null,
)

const yMaxVal = computed(() => {
  if (!anualData.value) return 1000
  let m = 0
  for (const mes of anualData.value.meses)
    m = Math.max(m, mes.max_mwh || 0, genVal(mes), cierreVal(mes))
  return m > 0 ? m * 1.18 : 1000
})

const yGridLines = computed(() => {
  const step = niceStep(yMaxVal.value)
  const lines = []
  for (let v = 0; v <= yMaxVal.value; v += step) lines.push({ val: v, y: toY(v) })
  return lines
})

function niceStep(max: number) {
  const rough = max / 5
  const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
  const mult = rough / mag
  if (mult < 1.5) return mag
  if (mult < 3.5) return 2 * mag
  if (mult < 7.5) return 5 * mag
  return 10 * mag
}

function toY(val: number | null | undefined) {
  return PAD_T + PLOT_H * (1 - (val || 0) / yMaxVal.value)
}
function slotX(i: number) {
  return PAD_L + i * slotW
}
function barX(i: number) {
  return PAD_L + i * slotW + (slotW - barW) / 2
}
function genVal(mes: AnualMes) {
  return mes.gen_proyectada_mwh ?? mes.gen_mwh ?? 0
}
function cierreVal(mes: AnualMes) {
  return mes.gen_proyectada_cierre ?? 0
}
function isCurrentMonth(mes: AnualMes) {
  return selectedYear.value === now.getFullYear() && mes.month === now.getMonth() + 1
}

// Dual-bar geometry for current month (two narrower bars side by side)
const dualBarW = slotW * 0.26
const dualGap = slotW * 0.03
function dualBarLeftX(i: number) {
  return PAD_L + i * slotW + (slotW - dualBarW * 2 - dualGap) / 2
}
function dualBarRightX(i: number) {
  return dualBarLeftX(i) + dualBarW + dualGap
}

// ── Chart interaction ─────────────────────────────────────────────────────────
function monthIdxFromEvent(event: MouseEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const svgX = (event.clientX - rect.left) * (SVG_W / rect.width)
  const idx = Math.floor((svgX - PAD_L) / slotW)
  return idx >= 0 && idx < N && svgX >= PAD_L ? idx : null
}

function onSvgMousemove(event: MouseEvent) {
  const idx = monthIdxFromEvent(event)
  hovered.value = idx
  if (idx !== null && chartBox.value) {
    const r = chartBox.value.getBoundingClientRect()
    tooltipX.value = Math.min(event.clientX - r.left + 12, r.width - 215)
    tooltipY.value = event.clientY - r.top - 10
  }
}

function onSvgClick(event: MouseEvent) {
  const idx = monthIdxFromEvent(event)
  if (idx === null) return
  selectedMonthIdx.value = selectedMonthIdx.value === idx ? null : idx
}

// ── Simulador computed ────────────────────────────────────────────────────────
type EstadoCumplimiento = 'ok' | 'deficit' | 'excedente' | 'sin_compromisos'

const simResults = computed<Record<string, SimResultado>>(() => {
  if (!simData.value || !Object.keys(simAssignments.value).length) return {}
  const out: Record<string, SimResultado> = {}
  const esActual = simData.value.es_mes_actual
  const diaAct = simData.value.dia_actual
  const diasRest = simData.value.dias_restantes
  for (const c of allContratos.value) {
    const plantas = simAssignments.value[c.id] || []
    let genReal = 0,
      genDup = 0,
      genProy = 0
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
    let estado: EstadoCumplimiento = 'sin_compromisos'
    if (min !== null || max !== null) {
      const effectiveMin = min ?? 0
      if (gen < effectiveMin) estado = 'deficit'
      else if (max !== null && gen > max) estado = 'excedente'
      else estado = 'ok'
    }
    const pct = max != null ? (gen / max) * 100 : min != null ? (gen / min) * 100 : null
    const dupPct =
      genDup > 0 && (max != null || min != null) ? (genDup / (max ?? min ?? 1)) * 100 : null
    const proyPct =
      esActual && genProy > 0 && (max != null || min != null)
        ? (genProy / (max ?? min ?? 1)) * 100
        : null
    let estadoProy: EstadoCumplimiento = 'sin_compromisos'
    if (esActual && genProy > 0 && (min !== null || max !== null)) {
      const effMin = min ?? 0
      if (genProy < effMin) estadoProy = 'deficit'
      else if (max !== null && genProy > max) estadoProy = 'excedente'
      else estadoProy = 'ok'
    }
    // ── Geometría del bullet chart (zonas déficit/rango/excedente sobre un eje común) ──
    const hasMin = min !== null
    const hasMax = max !== null
    let axisMax: number
    if (hasMax) axisMax = Math.max(max * 1.2, gen * 1.06, (genProy || 0) * 1.06)
    else if (hasMin) axisMax = Math.max(min * 1.4, gen * 1.1, (genProy || 0) * 1.1)
    else axisMax = Math.max(gen, genProy || 0, 1) * 1.1
    const clampPct = (v: number) => Math.max(0, Math.min(100, (v / axisMax) * 100))
    const bullet: BulletGeom = {
      hasMin,
      hasMax,
      hasZones: hasMin || hasMax,
      minPct: hasMin ? clampPct(min as number) : 0,
      maxPct: hasMax ? clampPct(max as number) : 100,
      measurePct: clampPct(gen),
      // Tramo de "compra en bolsa" DENTRO de la barra entregada (al final): de
      // (gen - genDup) hasta gen. Se pinta amarillo sobre la barra de estado.
      bolsaStartPct: genDup > 0 ? clampPct(Math.max(0, gen - genDup)) : null,
      dupW: genDup > 0 ? Math.max(0, clampPct(gen) - clampPct(Math.max(0, gen - genDup))) : 0,
      proyPct: esActual && genProy > 0 ? clampPct(genProy) : null,
    }

    // ── Cumplimiento de plantas: plantas INSCRITAS = registradas y despachando vía GESCON (numerador) vs PLANTAS CONTRATO exigidas (denominador) ──
    const plantasEsp = c.plantas_esperadas ?? null
    const plantasReg = plantas.length
    let estadoPlantas: EstadoCumplimiento = 'sin_compromisos'
    if (plantasEsp !== null) {
      if (plantasReg < plantasEsp) estadoPlantas = 'deficit'
      else if (plantasReg > plantasEsp) estadoPlantas = 'excedente'
      else estadoPlantas = 'ok'
    }
    // Barra: si aún no hay meta inscrita (0), llena al 100% cuando ya hay plantas registradas y 0 si no.
    const plantasPct =
      plantasEsp != null
        ? plantasEsp > 0
          ? Math.min(100, (plantasReg / plantasEsp) * 100)
          : plantasReg > 0
            ? 100
            : 0
        : null

    // Estado para filtrar: la proyección de cierre cuando existe (mes en curso),
    // si no, el estado real (meses ya cerrados o sin proyección disponible).
    const estadoEfectivo: EstadoCumplimiento =
      esActual && genProy > 0 && estadoProy !== 'sin_compromisos' ? estadoProy : estado

    out[String(c.id)] = {
      gen: Math.round(gen * 10) / 10,
      genDup: Math.round(genDup * 10) / 10,
      tieneDup: genDup > 0,
      genProy: esActual ? Math.round(genProy * 10) / 10 : null,
      estado,
      estadoProy,
      estadoEfectivo,
      pct,
      dupPct,
      proyPct,
      min,
      max,
      diaActual: diaAct,
      diasRestantes: diasRest,
      bullet,
      plantasReg,
      plantasEsp,
      estadoPlantas,
      plantasPct,
    }
  }
  return out
})

/** El resultado de un contrato — se lee siempre detrás de un `v-if="simResults[id]"`
 *  (o `?.`) en el template; esta función solo evita repetir el cast ahí. */
function resSim(id: number | string): SimResultado {
  return simResults.value[String(id)] as SimResultado
}

// ── Simulador drag-and-drop ───────────────────────────────────────────────────
function initAssignments(data: SimuladorData) {
  const proyMap = Object.fromEntries(backendProyectos.value.map((p) => [p.id, p]))
  const a: Record<string, SimPlanta[]> = { none: [] }
  for (const c of data.contratos) a[c.id] = []
  for (const p of data.plantas) {
    const proy = proyMap[p.id]
    if (proy && !proyectoActivoEnMes(proy, simYear.value, simMonth.value)) continue
    const key = String(p.contrato_id ?? 'none')
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

function eliminarNuevo(contratoId: number | string) {
  const plantas = simAssignments.value[contratoId] || []
  if (plantas.length) {
    if (!simAssignments.value['none']) simAssignments.value['none'] = []
    simAssignments.value['none']!.push(...plantas)
  }
  Reflect.deleteProperty(simAssignments.value, contratoId)
  ficticioContratos.value = ficticioContratos.value.filter((c) => c.id !== contratoId)
  hiddenContratos.value = new Set([...hiddenContratos.value].filter((id) => id !== contratoId))
}

function toggleExpand(contratoId: number | string) {
  const idx = expandedContratos.value.indexOf(contratoId)
  if (idx >= 0) expandedContratos.value.splice(idx, 1)
  else expandedContratos.value.push(contratoId)
}

function hideContrato(contratoId: number | string) {
  hiddenContratos.value = new Set([...hiddenContratos.value, contratoId])
}

function showAllContratos() {
  hiddenContratos.value = new Set()
}

function onDragOver(contratoId: number | string) {
  dragOver.value = contratoId
  if (!expandedContratos.value.includes(contratoId)) {
    expandedContratos.value.push(contratoId)
  }
}

function onDragStart(planta: SimPlanta, fromContratoId: number | string | null | undefined) {
  dragPlanta.value = { ...planta }
  dragFromContrato.value = fromContratoId ?? 'none'
}

function onDragEnd() {
  dragPlanta.value = null
  dragFromContrato.value = undefined
  dragOver.value = null
}

function onDrop(toContratoId: number | string | null) {
  if (!dragPlanta.value) return
  const draggedId = dragPlanta.value.id
  const from = String(dragFromContrato.value)
  const to = String(toContratoId ?? 'none')
  if (from === to) {
    dragOver.value = null
    return
  }

  const fromList = simAssignments.value[from]
  if (fromList) {
    const idx = fromList.findIndex((p) => p.id === draggedId)
    if (idx >= 0) fromList.splice(idx, 1)
  }
  if (!simAssignments.value[to]) simAssignments.value[to] = []
  simAssignments.value[to]!.push({ ...dragPlanta.value })

  dragPlanta.value = null
  dragFromContrato.value = undefined
  dragOver.value = null
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtMwh(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return (
    val.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh'
  )
}
function fmtShort(val: number) {
  if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(val).toString()
}
function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  return `${MESES_CORTOS[parseInt(m!) - 1]} ${y}`
}
function fmtFechaDia(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES_CORTOS[parseInt(m!) - 1]!.toLowerCase()} ${y}`
}
// Ventana de la modalidad Venta en Bolsa (UNGC): fecha_inicio del registro SIC
// y fecha_fin EFECTIVA (recortada por relevos) que envía el backend.
function ventanaBolsa(p: PcPlanta) {
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
function filaTerminada(p: FilaConEstado | null | undefined) {
  return p?.estado === 'terminado'
}

// Clave única: la misma planta puede tener dos tramos en el mismo mes
// (p. ej. libre 1→9, contrato 10→20, libre 21→31).
function filaKey(p: FilaConEstado | null | undefined) {
  return p?.segmento_inicio ? `${p.id}-${p.segmento_inicio}` : p?.id
}

function filaColorNombre(p: FilaConEstado | null | undefined) {
  return filaTerminada(p) ? 'text-destructive' : 'text-unergy-deep'
}

function filaColorFecha(p: FilaConEstado | null | undefined) {
  if (filaTerminada(p)) return 'font-semibold text-destructive'
  return p?.fecha_fin && isExpiringSoon(p.fecha_fin) ? 'font-semibold text-destructive' : ''
}

// Ventana a mostrar. Prioriza la ventana real (contrato / registro SIC); para
// los tramos de bolsa libre, que no tienen registro, usa el tramo del mes.
function ventanaFila(p: FilaConEstado | null | undefined) {
  if (!p) return ''
  const ini = p.fecha_inicio || p.segmento_inicio || null
  const fin = p.fecha_fin || (filaTerminada(p) ? p.segmento_fin : null) || null
  if (!ini && !fin) return ''
  if (ini && !fin) return `desde ${ini}`
  if (!ini && fin) return `hasta ${fin}`
  return `${ini} → ${fin}`
}

// ── Helpers de barras de cumplimiento (simulador) ─────────────────────────────
// Clases por estado de cumplimiento; cualquier otro valor cae en "neutro".
const ESTADO_CLASES = {
  ok: { badge: TONO.ok, texto: 'text-success', fondo: 'bg-success' },
  deficit: {
    badge: TONO.deficit,
    texto: 'text-destructive',
    fondo: 'bg-destructive',
  },
  excedente: {
    badge: TONO.excedente,
    texto: 'text-chart-2',
    fondo: 'bg-chart-2',
  },
  neutro: {
    badge: TONO.neutro,
    texto: 'text-muted-foreground/60',
    fondo: 'bg-muted-foreground/60',
  },
} as const
function estadoClases(estado: string | null | undefined) {
  return estado === 'ok' || estado === 'deficit' || estado === 'excedente'
    ? ESTADO_CLASES[estado]
    : ESTADO_CLASES.neutro
}
function estadoLabel(estado: string | null | undefined) {
  return estado === 'ok'
    ? '✓ OK'
    : estado === 'deficit'
      ? '↓ Déficit'
      : estado === 'excedente'
        ? '↑ Excedente'
        : '— Sin datos'
}

// ── Copiar imagen de una capa (contrato + sus proyectos) ──────────────────────
// Renderiza la capa a un PNG con Canvas (sin dependencias) y lo copia al
// portapapeles. Si el navegador no permite escribir imágenes al portapapeles,
// cae a descargar el PNG. Muestra el total de proyectos del contrato y las
// cantidades (energía por planta + agregados).
const copiadoCapaId = ref<number | string | null>(null)

// ── Panel flotante "ver detalle de la capa" (misma info que la imagen) ────────
const detalleCapaId = ref<number | string | null>(null)
const esMesActualSim = computed(() => !!(simData.value && simData.value.es_mes_actual))
const periodoSimLabel = computed(() => `${MESES[simMonth.value - 1]} ${simYear.value}`)

function abrirDetalleCapa(c: SimContrato) {
  detalleCapaId.value = c.id
}
function cerrarDetalleCapa() {
  detalleCapaId.value = null
}

const detalleCapa = computed(() => {
  if (detalleCapaId.value == null) return null
  const c = allContratos.value.find((x) => x.id === detalleCapaId.value)
  if (!c) return null
  const res: Partial<SimResultado> = simResults.value[String(c.id)] || {}
  return { c, plantas: simAssignments.value[c.id] || [], res }
})

// Proyección de cierre del mes por planta (mes en curso; incluye duplicados,
// porque la compra en bolsa también cubre el contrato).
function plantaProyMwh(p: SimPlanta) {
  return esMesActualSim.value && p.month_mwh_proyectado != null
    ? p.month_mwh_proyectado * p.pct_despacho
    : null
}

// Veredicto de riesgo / probabilidad (proyección vs mínimo) — espeja la imagen
function veredictoCapa(res: Partial<SimResultado>) {
  const { min, genProy } = res
  const minDef = min != null
  const proyOk = esMesActualSim.value && genProy != null && genProy > 0
  if (min != null && proyOk && genProy != null) {
    if (genProy >= min) {
      return {
        icon: CircleCheckIcon,
        txt: 'Probabilidad de cumplimiento alta',
        sub: `Proyección ${fmtMwh(genProy)} ≥ mínimo ${fmtMwh(min)}`,
        bg: 'bg-success/10',
        fg: 'text-success',
      }
    }
    return {
      icon: TriangleAlertIcon,
      txt: 'Riesgo de incumplimiento',
      sub: `Proyección ${fmtMwh(genProy)} < mínimo ${fmtMwh(min)}`,
      bg: 'bg-destructive/10',
      fg: 'text-destructive',
    }
  }
  if (minDef) {
    return {
      icon: CircleMinusIcon,
      txt: 'Sin proyección del mes para evaluar',
      sub: `Mínimo ${fmtMwh(min)}`,
      bg: 'bg-unergy-deep/5',
      fg: 'text-muted-foreground',
    }
  }
  return {
    icon: CircleMinusIcon,
    txt: 'Contrato sin energía mínima definida',
    sub: '',
    bg: 'bg-unergy-deep/5',
    fg: 'text-muted-foreground',
  }
}

function _estadoTextoPlano(estado: string | null | undefined) {
  return estado === 'ok'
    ? 'En rango'
    : estado === 'deficit'
      ? 'Déficit'
      : estado === 'excedente'
        ? 'Excedente'
        : 'Sin datos'
}

function _truncarTexto(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string {
  if (ctx.measureText(texto).width <= maxW) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function _dibujarPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  texto: string,
  bg: string,
  fg: string,
  font: string,
): number {
  ctx.font = font
  const padX = 9,
    h = 21
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

function _renderCapaCanvas(c: SimContrato): HTMLCanvasElement {
  const plantas = simAssignments.value[c.id] || []
  const res = simResults.value[c.id] || ({} as Partial<SimResultado>)
  const esActual = !!(simData.value && simData.value.es_mes_actual)

  const DARK = '#2C2039',
    GREY = '#7a6e8a',
    PURPLE = '#915BD8'
  const RED = '#D64455',
    GOLD = '#9a6700'
  const scale = 2
  const W = 880,
    padX = 36
  const headerH = 156,
    tableHeadH = 32,
    rowH = 36,
    totalH = 52,
    riskH = 56,
    footerH = 50
  const bodyTop = headerH + tableHeadH
  const H = bodyTop + Math.max(plantas.length, 1) * rowH + totalH + riskH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas')
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
  const badgeBg =
    estado === 'ok'
      ? 'rgba(46,125,50,0.12)'
      : estado === 'deficit'
        ? 'rgba(214,68,85,0.12)'
        : estado === 'excedente'
          ? 'rgba(20,184,166,0.16)'
          : 'rgba(44,32,57,0.06)'
  const badgeFg =
    estado === 'ok'
      ? '#2e7d32'
      : estado === 'deficit'
        ? RED
        : estado === 'excedente'
          ? '#0F766E'
          : GREY
  ctx.textBaseline = 'middle'
  const pctTxt = res.pct !== null && res.pct !== undefined ? Math.round(res.pct) + '%' : null
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
    [
      'ENERGÍA PROYECTADA',
      res.genProy != null && res.genProy > 0 ? fmtMwh(res.genProy) : '—',
      DARK,
    ],
  ]
  if ((res.genDup ?? 0) > 0) metrics.push(['COMPRA EN BOLSA', fmtMwh(res.genDup), GOLD])
  const colW = (W - padX * 2) / metrics.length
  metrics.forEach(([lbl, val, valColor], i) => {
    const x = padX + i * colW
    ctx.fillStyle = valColor === DARK ? GREY : valColor!
    ctx.font = 'bold 9px Inter, Arial, sans-serif'
    ctx.fillText(lbl!, x, 100)
    ctx.fillStyle = valColor!
    ctx.font = 'bold 16px Inter, Arial, sans-serif'
    ctx.fillText(val!, x, 120)
  })

  // Línea divisoria + "N proyectos"
  ctx.strokeStyle = 'rgba(44,32,57,0.10)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padX, 138)
  ctx.lineTo(W - padX, 138)
  ctx.stroke()
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 12px Inter, Arial, sans-serif'
  ctx.fillText(
    `${plantas.length} proyecto${plantas.length === 1 ? '' : 's'} en el contrato`,
    padX,
    headerH - 4,
  )

  // ── Cabecera de tabla ──
  const colProyR = W - padX // proyección cierre del mes (derecha)
  const colEneR = W - padX - 200 // energía generada
  const colPctR = W - padX - 360 // % despacho
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
    const nameMaxW = colPctR - padX - 90
    const nombre = _truncarTexto(ctx, p.nombre || `Proyecto ${p.id}`, nameMaxW)
    ctx.fillText(nombre, padX, yMid)
    // Tag duplicado / compra
    const nx = padX + ctx.measureText(nombre).width + 8
    if (p.es_duplicado && !p.comprado_por_unergy) {
      _dibujarPill(
        ctx,
        nx,
        yMid - 9,
        'Compra bolsa',
        'rgba(240,192,64,0.22)',
        GOLD,
        'bold 10px Inter, Arial, sans-serif',
      )
    } else if (p.comprado_por_unergy) {
      _dibujarPill(
        ctx,
        nx,
        yMid - 9,
        'Compra',
        'rgba(240,192,64,0.25)',
        GOLD,
        'bold 10px Inter, Arial, sans-serif',
      )
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
    const mwhProy =
      esActual && p.month_mwh_proyectado != null ? p.month_mwh_proyectado * p.pct_despacho : null
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
  ctx.beginPath()
  ctx.moveTo(padX, yTotalTop)
  ctx.lineTo(W - padX, yTotalTop)
  ctx.stroke()
  const yTotalMid = yTotalTop + totalH / 2
  ctx.textBaseline = 'middle'
  ctx.fillStyle = DARK
  ctx.font = 'bold 14px Inter, Arial, sans-serif'
  ctx.fillText(
    `Total · ${plantas.length} proyecto${plantas.length === 1 ? '' : 's'}`,
    padX,
    yTotalMid,
  )
  ctx.textAlign = 'right'
  // Total energía generada
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 16px Inter, Arial, sans-serif'
  ctx.fillText(fmtMwh(res.gen), colEneR, yTotalMid)
  if ((res.genDup ?? 0) > 0) {
    ctx.fillStyle = GOLD
    ctx.font = 'bold 11px Inter, Arial, sans-serif'
    ctx.fillText(`de ello, ${fmtMwh(res.genDup)} compra en bolsa`, colEneR, yTotalMid + 17)
  }
  // Total proyección cierre del mes
  ctx.fillStyle = PURPLE
  ctx.font = 'bold 16px Inter, Arial, sans-serif'
  const totalProy = esActual && res.genProy != null && res.genProy > 0 ? fmtMwh(res.genProy) : '—'
  ctx.fillText(totalProy, colProyR, yTotalMid)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // ── Veredicto: riesgo / probabilidad de cumplimiento (proyección vs mínimo) ──
  const yRiskTop = bodyTop + Math.max(plantas.length, 1) * rowH + totalH
  const { min, genProy } = res
  const minDef = min != null
  const proyOk = esActual && genProy != null && genProy > 0
  let riskBg, riskFg, riskIcon, riskTxt, riskSub
  if (min != null && proyOk && genProy != null) {
    if (genProy >= min) {
      riskBg = 'rgba(46,125,50,0.10)'
      riskFg = '#2e7d32'
      riskIcon = '✓'
      riskTxt = 'Probabilidad de cumplimiento alta'
      riskSub = `Proyección ${fmtMwh(genProy)} ≥ mínimo ${fmtMwh(min)}`
    } else {
      riskBg = 'rgba(214,68,85,0.10)'
      riskFg = RED
      riskIcon = '⚠'
      riskTxt = 'Riesgo de incumplimiento'
      riskSub = `Proyección ${fmtMwh(genProy)} < mínimo ${fmtMwh(min)}`
    }
  } else if (minDef) {
    riskBg = 'rgba(44,32,57,0.05)'
    riskFg = GREY
    riskIcon = '•'
    riskTxt = 'Sin proyección del mes para evaluar'
    riskSub = `Mínimo ${fmtMwh(min)}`
  } else {
    riskBg = 'rgba(44,32,57,0.05)'
    riskFg = GREY
    riskIcon = '•'
    riskTxt = 'Contrato sin energía mínima definida'
    riskSub = ''
  }
  ctx.fillStyle = riskBg
  ctx.beginPath()
  ctx.roundRect(padX, yRiskTop + 6, W - padX * 2, riskH - 12, 10)
  ctx.fill()
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

async function copiarImagenCapa(c: SimContrato) {
  let canvas: HTMLCanvasElement | undefined
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
      setTimeout(() => {
        if (copiadoCapaId.value === c.id) copiadoCapaId.value = null
      }, 2200)
    } catch {
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
const copiadoVentaId = ref<number | null>(null)

function _renderVentaCanvas(c: PcContrato): HTMLCanvasElement {
  const plantas = c.plantas || []
  const DARK = '#2C2039',
    GREY = '#7a6e8a',
    PURPLE = '#915BD8',
    GOLD = '#9a6700'
  const scale = 2
  const W = 760,
    padX = 36
  const headerH = 96,
    tableHeadH = 30,
    rowH = 34,
    footerH = 46
  const bodyTop = headerH + tableHeadH
  const H = bodyTop + Math.max(plantas.length, 1) * rowH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas')
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
    ctx.fillText(
      `Sin plantas asignadas en GESCON para ${MESES[pcMonth.value - 1]} ${pcYear.value}`,
      padX,
      bodyTop + 24,
    )
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
      _dibujarPill(
        ctx,
        nx,
        yMid - 9,
        'Compra bolsa',
        'rgba(240,192,64,0.22)',
        GOLD,
        'bold 10px Inter, Arial, sans-serif',
      )
    }
    // Código SIC
    ctx.textAlign = 'right'
    ctx.fillStyle = GREY
    ctx.font = '12px Inter, Arial, sans-serif'
    ctx.fillText(p.codigo_sic || '—', colSicR, yMid)
    // % despacho
    ctx.fillStyle = PURPLE
    ctx.font = 'bold 12px Inter, Arial, sans-serif'
    ctx.fillText(
      p.pct_despacho != null ? (p.pct_despacho * 100).toFixed(0) + '%' : '—',
      colPctR,
      yMid,
    )
    // Vigencia (rojo si vence pronto)
    const vigencia =
      p.fecha_inicio || p.fecha_fin ? `${p.fecha_inicio || '—'} → ${p.fecha_fin || '—'}` : '—'
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

async function copiarImagenVenta(c: PcContrato) {
  let canvas: HTMLCanvasElement | undefined
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
      setTimeout(() => {
        if (copiadoVentaId.value === c.id) copiadoVentaId.value = null
      }, 2200)
    } catch {
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
    const mapped = res.map((c) => ({
      ...c,
      label: c.nombre_interno || c.numero_codigo_contrato || `Contrato ${c.id}`,
    }))
    contratos.value = [{ id: CONSOLIDADO_ID, label: '📊 Consolidado (todos)' }, ...mapped]
    if (mapped.length > 0) {
      selectedContratoId.value = CONSOLIDADO_ID
    }
  } catch (e) {
    logger.error('mem', e)
  }
}

async function loadAnnualData() {
  const contratoId = selectedContratoId.value
  if (!contratoId) return
  chartLoading.value = true
  chartError.value = null
  anualData.value = null
  hovered.value = null
  selectedMonthIdx.value = null
  try {
    if (contratoId === CONSOLIDADO_ID) {
      await loadConsolidado()
    } else {
      anualData.value = (await cachedGet(
        `/cumplimiento/ppa/${contratoId}/anual`,
        { year: selectedYear.value },
        () => cumplimientoService.obtenerAnualPorContrato(contratoId, { year: selectedYear.value }),
      )) as unknown as AnualDataView
    }
    updateCacheSize()
  } catch (e) {
    chartError.value = errDetail(e) || 'Error al cargar los datos anuales.'
  } finally {
    chartLoading.value = false
  }
}

async function loadConsolidado() {
  const realContratos = contratos.value.filter((c) => c.id !== CONSOLIDADO_ID)
  if (!realContratos.length) return

  const results = await Promise.allSettled(
    realContratos.map(
      (c) =>
        cachedGet(`/cumplimiento/ppa/${c.id}/anual`, { year: selectedYear.value }, () =>
          cumplimientoService.obtenerAnualPorContrato(c.id as number, { year: selectedYear.value }),
        ) as unknown as Promise<AnualDataView>,
    ),
  )
  updateCacheSize()

  const successful = results
    .filter((r): r is PromiseFulfilledResult<AnualDataView> => r.status === 'fulfilled')
    .map((r) => r.value)

  if (!successful.length) {
    chartError.value = 'No se pudo cargar ningún contrato.'
    return
  }

  const meses: AnualMes[] = []
  for (let i = 0; i < 12; i++) {
    let totalGen = 0,
      totalProy: number | null = null,
      totalCierre: number | null = null,
      totalMin = 0,
      totalMax = 0
    let hasMin = false,
      hasMax = false,
      totalBolsaDup = 0
    let diaActual: number | null = null,
      diasRestantes: number | null = null
    const allPlantas: PlantaAnualMes[] = []

    for (const data of successful) {
      const mes = data.meses[i]
      if (!mes) continue
      totalGen += mes.gen_mwh || 0
      if (mes.gen_proyectada_mwh !== null && mes.gen_proyectada_mwh !== undefined) {
        totalProy = (totalProy || 0) + mes.gen_proyectada_mwh
      }
      if (mes.gen_proyectada_cierre !== null && mes.gen_proyectada_cierre !== undefined) {
        totalCierre = (totalCierre || 0) + mes.gen_proyectada_cierre
      }
      if (mes.min_mwh !== null) {
        totalMin += mes.min_mwh
        hasMin = true
      }
      if (mes.max_mwh !== null) {
        totalMax += mes.max_mwh
        hasMax = true
      }
      if (mes.exposicion_bolsa_duplicados_mwh) totalBolsaDup += mes.exposicion_bolsa_duplicados_mwh
      if (mes.dia_actual != null) diaActual = mes.dia_actual
      if (mes.dias_restantes != null) diasRestantes = mes.dias_restantes
      for (const p of mes.plantas || []) {
        allPlantas.push({
          ...p,
          contrato: data.contrato.nombre_interno || data.contrato.numero_codigo_contrato || null,
        })
      }
    }

    const minMwh = hasMin ? Math.round(totalMin * 1000) / 1000 : null
    const maxMwh = hasMax ? Math.round(totalMax * 1000) / 1000 : null
    const gen = Math.round(totalGen * 1000) / 1000
    const cierre = totalCierre !== null ? Math.round(totalCierre * 1000) / 1000 : null
    const val = cierre ?? (totalProy !== null ? Math.round(totalProy * 1000) / 1000 : gen)

    let estado: EstadoCumplimiento = 'sin_compromisos'
    let compras: number | null = null
    let excedentes: number | null = null
    if (minMwh !== null || maxMwh !== null) {
      const effectiveMin = minMwh ?? 0
      if (val < effectiveMin) {
        estado = 'deficit'
        compras = Math.round((effectiveMin - val) * 1000) / 1000
        excedentes = 0
      } else if (maxMwh !== null && val > maxMwh) {
        estado = 'excedente'
        compras = 0
        excedentes = Math.round((val - maxMwh) * 1000) / 1000
      } else {
        estado = 'ok'
        compras = 0
        excedentes = 0
      }
    }

    const ref = successful[0]!.meses[i]
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
      tipo_datos: ref?.tipo_datos ?? 'real',
      compras_bolsa_mwh: compras,
      excedentes_bolsa_mwh: excedentes,
      exposicion_bolsa_duplicados_mwh:
        totalBolsaDup > 0 ? Math.round(totalBolsaDup * 1000) / 1000 : null,
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
    tableData.value = (await cachedGet(
      '/cumplimiento/ppa/resumen-anual',
      { year: selectedYear.value, incluir_todos: incluirTodos() },
      () =>
        cumplimientoService.obtenerResumenAnual({
          year: selectedYear.value,
          incluir_todos: incluirTodos(),
        }),
    )) as unknown as FilaResumenAnual[]
    updateCacheSize()
  } catch (e) {
    logger.error('mem', e)
  } finally {
    tableLoading.value = false
  }
}

function onYearChange() {
  loadAnnualData()
  loadTableData()
}
function selectContrato(id: ContratoCumplimientoPpa['id'] | typeof CONSOLIDADO_ID) {
  selectedContratoId.value = id
  loadAnnualData()
}

/** El `Select` de contrato solo maneja strings — recupera el id con su tipo
 *  original (number, o el sentinel `CONSOLIDADO_ID`) desde `contratos`. */
function contratoIdFromString(
  v: string,
): ContratoCumplimientoPpa['id'] | typeof CONSOLIDADO_ID | null {
  const c = contratos.value.find((x) => String(x.id) === v)
  return c ? c.id : null
}

// ── Exportar matriz anual (Excel / PDF) ────────────────────────────────────────
// Respeta el filtro activo de la pestaña Cumplimiento: un contrato puntual, o
// CONSOLIDADO_ID (todos). Reutiliza cachedGet, así que en modo consolidado el
// detalle por contrato normalmente ya está en caché (loadConsolidado lo trajo).
const exportingExcel = ref(false)
const exportingPdf = ref(false)

async function fetchContratoAnualCached(id: number, year: number): Promise<AnualDataView> {
  return cachedGet(`/cumplimiento/ppa/${id}/anual`, { year }, () =>
    cumplimientoService.obtenerAnualPorContrato(id, { year }),
  ) as unknown as Promise<AnualDataView>
}

function styleAnualSheet(
  XLSX: typeof import('xlsx-js-style'),
  ws: import('xlsx-js-style').WorkSheet,
  built: ContratoAnualAoaBuilt,
) {
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  const setStyle = (r: number, c: number, s: import('xlsx-js-style').CellObject['s']) => {
    const ref = XLSX.utils.encode_cell({ r, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref]!.s = s
  }
  setStyle(0, 0, { font: { bold: true, sz: 13, color: { rgb: C.oscuro } } })
  setStyle(1, 0, { font: { bold: true, sz: 12, color: { rgb: C.morado } } })
  setStyle(2, 0, { font: { italic: true, color: { rgb: '7A6E8A' } } })

  for (let c = 0; c < built.nCols; c++) {
    setStyle(built.headerRow, c, {
      font: { bold: true, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.morado } },
      alignment: { horizontal: 'center' },
    })
    setStyle(built.totalRow, c, { font: { bold: true, color: { rgb: C.oscuro } } })
  }
  setStyle(built.plantHeaderRow - 1, 0, { font: { bold: true, sz: 11, color: { rgb: C.morado } } })
  for (let c = 0; c < built.plantCols; c++) {
    setStyle(built.plantHeaderRow, c, {
      font: { bold: true, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.oscuro } },
      alignment: { horizontal: 'center' },
    })
    setStyle(built.plantTotalRow, c, { font: { bold: true, color: { rgb: C.oscuro } } })
  }
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: built.nCols - 1 } },
    {
      s: { r: built.plantHeaderRow - 1, c: 0 },
      e: { r: built.plantHeaderRow - 1, c: built.plantCols - 1 },
    },
  ]
  ws['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
  ]
}

async function exportarAnualExcel() {
  if (!anualData.value) return
  exportingExcel.value = true
  try {
    const XLSX = await import('xlsx-js-style')
    const { construirContratoAnualAOA, sheetNameSafe, slugify } =
      (await import('./cumplimientoAnualExport.js')) as unknown as CumplimientoAnualExportModule
    const year = selectedYear.value
    const consolidado = selectedContratoId.value === CONSOLIDADO_ID
    const wb = XLSX.utils.book_new()
    const usedNames = new Set<string>()
    const anual = anualData.value

    function addSheet(built: ContratoAnualAoaBuilt, label: string) {
      const ws = XLSX.utils.aoa_to_sheet(built.aoa)
      styleAnualSheet(XLSX, ws, built)
      let name = sheetNameSafe(label)
      let i = 2
      while (usedNames.has(name)) {
        name = sheetNameSafe(`${label} ${i}`)
        i++
      }
      usedNames.add(name)
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    if (consolidado) {
      const realContratos = contratos.value.filter((c) => c.id !== CONSOLIDADO_ID)
      const builtConsolidado = construirContratoAnualAOA({
        contrato: {
          nombre_interno: 'Consolidado',
          numero_codigo_contrato: `${realContratos.length} contratos`,
          comprador_nombre: 'Todos los compradores',
        },
        year,
        meses: anual.meses,
        consolidado: true,
      })
      addSheet(builtConsolidado, 'Consolidado')

      const resultados = await Promise.allSettled(
        realContratos.map((c) => fetchContratoAnualCached(c.id as number, year)),
      )
      resultados.forEach((r, i) => {
        if (r.status !== 'fulfilled') return
        const data = r.value
        const built = construirContratoAnualAOA({
          contrato: data.contrato,
          year,
          meses: data.meses,
          consolidado: false,
        })
        addSheet(
          built,
          data.contrato.nombre_interno ||
            data.contrato.numero_codigo_contrato ||
            `Contrato ${realContratos[i]?.id}`,
        )
      })
    } else {
      const built = construirContratoAnualAOA({
        contrato: anual.contrato,
        year,
        meses: anual.meses,
        consolidado: false,
      })
      addSheet(
        built,
        anual.contrato.nombre_interno || anual.contrato.numero_codigo_contrato || 'Contrato',
      )
    }

    const slug = consolidado
      ? 'consolidado'
      : slugify(
          anual.contrato.nombre_interno || anual.contrato.numero_codigo_contrato || 'contrato',
        )
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
function svgElementToPngDataUrl(
  svgEl: SVGSVGElement,
  w: number,
  h: number,
  scale = 2,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0')
    bg.setAttribute('y', '0')
    bg.setAttribute('width', String(w))
    bg.setAttribute('height', String(h))
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
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del canvas'))
        return
      }
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
    const {
      prepararFilasMensuales,
      totalizarFilasMensuales,
      agregarPlantasAnuales,
      fmtNumExport,
      slugify,
    } = (await import('./cumplimientoAnualExport.js')) as unknown as CumplimientoAnualExportModule

    const svgEl = chartBox.value?.querySelector('svg')
    const chartImg = svgEl
      ? await svgElementToPngDataUrl(svgEl, SVG_W, SVG_H, 2).catch(() => null)
      : null

    const year = selectedYear.value
    const consolidado = selectedContratoId.value === CONSOLIDADO_ID
    const contrato = anualData.value.contrato
    const filas = prepararFilasMensuales(anualData.value.meses)
    const totales = totalizarFilasMensuales(filas)
    const plantas = agregarPlantasAnuales(anualData.value.meses, { incluirContrato: consolidado })

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const docConTabla = doc as unknown as DocConAutoTable
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
      head: [
        [
          'Mes',
          'Generación (MWh)',
          'Mínimo (MWh)',
          'Máximo (MWh)',
          'Estado',
          'Compras bolsa (MWh)',
          'Excedentes (MWh)',
        ],
      ],
      body: filas.map((f) => [
        f.mes,
        fmtNumExport(f.genMwh),
        fmtNumExport(f.minMwh),
        fmtNumExport(f.maxMwh),
        f.estadoLabel,
        fmtNumExport(f.comprasBolsaMwh),
        fmtNumExport(f.excedentesMwh),
      ]),
      foot: [
        [
          'TOTAL',
          fmtNumExport(totales.genMwh),
          fmtNumExport(totales.minMwh),
          fmtNumExport(totales.maxMwh),
          '',
          fmtNumExport(totales.comprasBolsaMwh),
          fmtNumExport(totales.excedentesMwh),
        ],
      ],
      headStyles: { fillColor: [145, 91, 216], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [246, 255, 114], textColor: [44, 32, 57], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      theme: 'grid',
    })

    let y2 = docConTabla.lastAutoTable.finalY + 24
    if (y2 > pageH - 140) {
      doc.addPage()
      y2 = 40
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(44, 32, 57)
    doc.text(`Plantas participantes (${plantas.length})`, marginX, y2)

    const plantHead = consolidado
      ? ['Planta', 'Contrato', '% Despacho', 'Generación aportada (MWh)']
      : ['Planta', '% Despacho', 'Generación aportada (MWh)']
    const plantBody = plantas.map((p) =>
      consolidado
        ? [
            p.nombre,
            p.contrato,
            p.pctDespacho != null ? Math.round(p.pctDespacho * 100) + '%' : '—',
            fmtNumExport(p.genAportadaMwh),
          ]
        : [
            p.nombre,
            p.pctDespacho != null ? Math.round(p.pctDespacho * 100) + '%' : '—',
            fmtNumExport(p.genAportadaMwh),
          ],
    )

    autoTable(doc, {
      startY: y2 + 10,
      margin: { left: marginX, right: marginX },
      head: [plantHead],
      body: plantBody,
      headStyles: { fillColor: [44, 32, 57], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      theme: 'grid',
    })

    const pageCount = doc.getNumberOfPages()
    const fechaGen = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Generado el ${fechaGen} · Unergy`, marginX, pageH - 20)
      doc.text(`Página ${p} de ${pageCount}`, pageW - marginX - 60, pageH - 20)
    }

    const slug = consolidado
      ? 'consolidado'
      : slugify(contrato.nombre_interno || contrato.numero_codigo_contrato || 'contrato')
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
  simError.value = null
  try {
    const filtros = { year: simYear.value, month: simMonth.value, incluir_todos: incluirTodos() }
    const data = (await cachedGet('/cumplimiento/simulador', filtros, () =>
      cumplimientoService.obtenerSimulador(filtros),
    )) as unknown as SimuladorData
    simData.value = data
    initAssignments(data)
    updateCacheSize()
  } catch (e) {
    if (retry && (!isFetchError(e) || (e.status ?? 0) >= 500)) {
      logger.error('mem', e)
      return loadSimulator(false)
    }
    const status = isFetchError(e) ? e.status : undefined
    simError.value =
      errDetail(e) ||
      (status === 401
        ? 'Sesión expirada — inicia sesión de nuevo.'
        : status === 503
          ? 'API de generación no disponible temporalmente. Intenta en unos minutos.'
          : e instanceof Error && e.name === 'TimeoutError'
            ? 'Tiempo de espera agotado — el servidor tardó demasiado.'
            : 'Error al cargar el simulador.')
  } finally {
    simLoading.value = false
  }
}

async function loadPlantasContratos() {
  pcLoading.value = true
  pcError.value = null
  try {
    const filtros = { year: pcYear.value, month: pcMonth.value, incluir_todos: incluirTodos() }
    pcData.value = await cachedGet('/cumplimiento/plantas-contratos', filtros, () =>
      cumplimientoService.obtenerPlantasContratos(filtros),
    )
    updateCacheSize()
  } catch (e) {
    pcError.value = errDetail(e) || 'Error al cargar plantas y contratos.'
  } finally {
    pcLoading.value = false
  }
}

// ── Revisión del mes ─────────────────────────────────────────────────────────
// Tres cosas que conviene mirar cada mes. Sale de /cumplimiento/plantas-contratos,
// la MISMA fuente de la pestaña Proyectos: no reimplementa la resolución de GESCON
// ni agrega endpoints, y si Proyectos ya cargó ese mes es un acierto de caché.
const revYear = ref(now.getFullYear())
const revMonth = ref(now.getMonth() + 1)
const revData = ref<PcData | null>(null)
const revLoading = ref(false)
const revError = ref<string | null>(null)
const revBusqueda = ref('')

// Registros GESCON crudos. Hacen falta para no llamar "sin contrato" a una
// planta que sí tiene SIC vigente: la piscina e del backend agrupa las dos
// cosas (ver revTramosLibres). null = no se pudo cruzar.
const revAsic = ref<RegistroGesconDetalle[] | null>(null)
const revAsicError = ref(false)

async function loadRevision() {
  revLoading.value = true
  revError.value = null
  try {
    const filtros = { year: revYear.value, month: revMonth.value, incluir_todos: incluirTodos() }
    revData.value = await cachedGet('/cumplimiento/plantas-contratos', filtros, () =>
      cumplimientoService.obtenerPlantasContratos(filtros),
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
    revError.value = errDetail(e) || 'Error al cargar la revisión del mes.'
  } finally {
    revLoading.value = false
  }
}

// Registros de contrato (registro/modificación publicados) por planta. Se usa
// fecha_fin_efectiva: una versión superada por un relevo ya viene recortada, así
// que no reclama una ventana que ya no le corresponde.
const revAsicPorProyecto = computed(() => {
  const mapa = new Map<number, RegistroGesconDetalle[]>()
  for (const r of revAsic.value || []) {
    if (!r.proyecto_id) continue
    if (r.estado_solicitud !== 'publicado') continue
    if (r.tipo_solicitud !== 'registro' && r.tipo_solicitud !== 'modificacion') continue
    if (!mapa.has(r.proyecto_id)) mapa.set(r.proyecto_id, [])
    mapa.get(r.proyecto_id)!.push(r)
  }
  return mapa
})

function revSicVigenteEnTramo(
  proyectoId: number,
  desde: string | null | undefined,
  hasta: string | null | undefined,
) {
  if (!revAsic.value) return null
  for (const r of revAsicPorProyecto.value.get(proyectoId) || []) {
    const ini = r.fecha_inicio
    const fin = r.fecha_fin_efectiva || r.fecha_fin
    if ((!ini || !hasta || ini <= hasta) && (!fin || !desde || fin >= desde)) return r
  }
  return null
}

function revCoincide(...campos: (string | null | undefined)[]) {
  const q = revBusqueda.value.trim().toLowerCase()
  if (!q) return true
  return campos.some((c) => (c || '').toString().toLowerCase().includes(q))
}

// Solo 'compra en bolsa' cuenta como duplicación. "Uso del recurso" es otra
// figura (el cliente está en bolsa y se le paga su generación a precio bolsa,
// sin garantías) y tiene su propia sección.
function revMarca(p: PcPlanta) {
  return p.es_duplicado ? 'Compra en bolsa' : null
}

// Las reglas de duplicación viven en cumplimientoRevision.js: son la parte que
// se puede razonar sola y ahí están documentadas y verificadas.
const revPct: (fraccion: number | null | undefined) => number = aPorcentaje

// Agrupa por planta las apariciones en contratos de VENTA. Solo venta a
// propósito: una planta que además aparece en un contrato de compra UNGC es la
// MISMA energía vista desde el otro lado, no un duplicado (va en la sección 3).
const revPorPlantaVenta = computed<RevPlantaVenta[]>(() => {
  const d = revData.value
  if (!d) return []
  const porPlanta = new Map<number, RevPlantaVenta>()
  for (const c of d.venta || []) {
    for (const p of c.plantas || []) {
      const acc = porPlanta.get(p.id) || {
        id: p.id,
        nombre: p.nombre,
        apariciones: [],
        marcada: false,
        nContratos: 0,
      }
      acc.apariciones.push({
        contrato: c.nombre,
        codigo_sic: p.codigo_sic,
        pct: p.pct_despacho ?? null,
        marca: revMarca(p),
        uso_del_recurso: !!p.uso_del_recurso,
        modalidad_pago: p.modalidad_pago || null,
        desde: p.segmento_inicio || p.fecha_inicio || null,
        hasta: p.segmento_fin || p.fecha_fin || null,
        estado: p.estado,
      })
      if (revMarca(p)) acc.marcada = true
      porPlanta.set(p.id, acc)
    }
  }
  return [...porPlanta.values()].map((p) => ({
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
    .map((p): (RevPlantaVenta & RevVeredictoDuplicada) | null => {
      const veredicto: RevVeredictoDuplicada | null = motivoDuplicada(p)
      return veredicto ? { ...p, ...veredicto } : null
    })
    .filter((p): p is RevPlantaVenta & RevVeredictoDuplicada => p !== null)
    .filter((p) =>
      revCoincide(
        p.nombre,
        ...p.apariciones.map((a) => a.contrato),
        ...p.apariciones.map((a) => a.codigo_sic),
      ),
    )
    .sort((a, b) => b.maxPct - a.maxPct || (a.nombre || '').localeCompare(b.nombre || '')),
)

// Repartidas: en varios contratos pero sumando 100% o menos. NO son duplicados
// — se listan aparte justamente para dejarlo claro.
const revRepartidas = computed(() =>
  revPorPlantaVenta.value
    .filter((p): boolean => esRepartida(p))
    .map((p) => {
      const apariciones: RevAparicion[] = repartirPares(p.apariciones)
      return { ...p, apariciones, maxPct: maxConcurrente(apariciones) }
    })
    .filter((p) => revCoincide(p.nombre, ...p.apariciones.map((a) => a.contrato)))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
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
    : (d.bolsa || []).filter((p) => p.piscina !== 'comercializador')
  return libres
    .filter((p) => revCoincide(p.nombre))
    .map((p) => ({ ...p, _sic: revSicVigenteEnTramo(p.id, p.segmento_inicio, p.segmento_fin) }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
})

// Sin contrato de verdad: ni PPA ni registro GESCON vigente sobre ese tramo.
const revSinContrato = computed(() => revTramosLibres.value.filter((p) => !p._sic))

// Tiene SIC vigente, pero el mes no lo cuenta en ningún contrato: inconsistencia
// a corregir en GESCON o en el PPA, no una planta libre en bolsa.
const revSicSinPpa = computed(() =>
  revTramosLibres.value.filter((p): p is PcPlanta & { _sic: RegistroGesconDetalle } => !!p._sic),
)

// 3 · UNGC: contratos GESCON donde UNGC compra (b) + remanente cuyo SIC vigente
// tiene a UNGC de comprador (f). Dos orígenes distintos, una sola lista.
// La ventana es el TRAMO del mes (segmento_*), igual que en venta: fecha_inicio/
// fecha_fin son la vigencia completa del registro GESCON, y mostrarlas primero
// hacía ver 01-ene → 31-dic a una planta que estuvo 8 días.
interface FilaRevUngc {
  _key: string
  nombre: string
  contrato: string | null
  codigo_sic?: string | null
  desde?: string | null
  hasta?: string | null
  estado?: string | null
}

const revUngc = computed(() => {
  const d = revData.value
  if (!d) return []
  const out: FilaRevUngc[] = []
  for (const c of d.compra || []) {
    for (const p of c.plantas || []) {
      out.push({
        _key: `b-${c.id}-${p.id}-${p.segmento_inicio || ''}`,
        nombre: p.nombre,
        contrato: c.nombre,
        codigo_sic: p.codigo_sic,
        desde: p.segmento_inicio || p.fecha_inicio,
        hasta: p.segmento_fin || p.fecha_fin,
        estado: p.estado,
      })
    }
  }
  const comercializador = Array.isArray(d.bolsa_comercializador)
    ? d.bolsa_comercializador
    : (d.bolsa || []).filter((p) => p.piscina === 'comercializador')
  for (const p of comercializador) {
    out.push({
      _key: `f-${p.id}-${p.segmento_inicio || ''}`,
      nombre: p.nombre,
      contrato: null,
      codigo_sic: p.codigo_sic,
      desde: p.segmento_inicio || p.fecha_inicio,
      hasta: p.segmento_fin || p.fecha_fin,
      estado: p.estado,
    })
  }
  return out
    .filter((p) => revCoincide(p.nombre, p.contrato, p.codigo_sic))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
})

// Uso del recurso: el cliente está en bolsa y su planta entra al contrato
// pagándole la generación a precio de bolsa. No genera garantías y no es una
// duplicación — por eso va en su propia sección.
const revUsoRecurso = computed(() =>
  revPorPlantaVenta.value
    .flatMap((p) =>
      p.apariciones
        .filter((a) => a.uso_del_recurso)
        .map((a) => ({ ...a, _key: `${p.id}-${a.codigo_sic}-${a.desde}`, planta: p.nombre })),
    )
    .filter((a) => revCoincide(a.planta, a.contrato, a.codigo_sic))
    .sort((a, b) => (a.planta || '').localeCompare(b.planta || '')),
)

const revResumen = computed(() => [
  {
    key: 'dup',
    n: revDuplicadas.value.length,
    titulo: 'Plantas duplicadas',
    detalle: 'Pasan del 100% a la vez, o marcadas',
    tono: 'border-warning/35 bg-warning/10',
    numero: 'text-warning',
  },
  {
    key: 'sin',
    n: revSinContrato.value.length,
    titulo: 'Libres en bolsa',
    detalle: 'Sin PPA y sin registro GESCON',
    tono: 'border-unergy-deep/14 bg-unergy-deep/4',
    numero: 'text-unergy-deep',
  },
  {
    key: 'uso',
    n: revUsoRecurso.value.length,
    titulo: 'Uso del recurso',
    detalle: 'Se le paga al cliente a precio bolsa',
    tono: 'border-chart-3/28 bg-chart-3/8',
    numero: 'text-chart-3',
  },
  {
    key: 'inc',
    n: revSicSinPpa.value.length,
    titulo: 'Con SIC, fuera del cálculo',
    detalle: 'Tienen GESCON pero el mes no los cuenta',
    tono: 'border-destructive/28 bg-destructive/7',
    numero: 'text-destructive',
  },
  {
    key: 'ungc',
    n: revUngc.value.length,
    titulo: 'Plantas con UNGC',
    detalle: 'Contrato de compra o SIC con UNGC',
    tono: 'border-unergy-purple/28 bg-unergy-purple/8',
    numero: 'text-unergy-purple',
  },
])

function revEstadoBadge(estado: string | null | undefined) {
  return estado === 'terminado' ? TONO.deficit : estado === 'futuro' ? TONO.neutro : TONO.ok
}
function revEstadoLabel(estado: string | null | undefined) {
  return estado === 'terminado' ? 'Terminado' : estado === 'futuro' ? 'Futuro' : 'Vigente'
}

// ── Balance de energía ───────────────────────────────────────────────────────
// Libro mayor de bolsa del mes: cuánto se compra o se compraría en bolsa. El
// neteo ocurre DENTRO de cada agente — UNGC va aparte porque es otro agente y
// su venta en bolsa no cancela las compras de UNGG.
const beYear = ref(now.getFullYear())
const beMonth = ref(now.getMonth() + 1)
const beData = ref<BeData | null>(null)
const beLoading = ref(false)
const beError = ref<string | null>(null)
const beFiltro = ref<BeCategoria | null>(null) // categoría seleccionada desde el libro mayor
const beBusqueda = ref('')
const beExcluirExterna = ref(false)

const BE_AYUDA: Record<'e' | 'f' | 'c' | 'uso' | 'neto', string> = {
  e:
    'Venta en bolsa (UNGG). Energía que entra a la bolsa directamente como generador: ' +
    'los días sin contrato y el porcentaje no despachado de los días con contrato. ' +
    'Acarrea cargos regulatorios altos — es la línea que conviene mantener baja.',
  f:
    'Venta en bolsa (UNGC). UNGG le vende a UNGC y el comercializador inyecta a la bolsa. ' +
    'No acarrea cargos regulatorios; acarrea cartera. Sale de las plantas con registro SIC ' +
    'vigente con comprador UNGC.',
  c:
    'Compra directa en bolsa. Plantas duplicadas: la energía no existe, así que Unergy la ' +
    'compra en la bolsa para cubrir el contrato duplicado (por ejemplo Klik sobre Uruaco). ' +
    'Genera garantías.',
  uso:
    'Compra no directa en bolsa (uso del recurso). La energía sí existe y se entrega al ' +
    'contrato, pero se le paga al dueño de la planta a precio de bolsa. El contrato paga su ' +
    'tarifa y Unergy asume la diferencia. No genera garantías.',
  neto:
    'Venta en bolsa de UNGG menos sus compras en bolsa. Positivo = UNGG termina el mes ' +
    'vendiendo neto a la bolsa; negativo = comprando neto.',
}

const BE_CATEGORIAS: Record<BeCategoria, { label: string; badge: string }> = {
  a: {
    label: 'Registrado en contrato',
    badge: TONO.primario,
  },
  c: {
    label: 'Compra directa — duplicados',
    badge: TONO.aviso,
  },
  uso: {
    label: 'Compra no directa — uso del recurso',
    badge: TONO.info,
  },
  e: { label: 'Venta en bolsa UNGG', badge: TONO.deficit },
  f: { label: 'Venta en bolsa UNGC', badge: TONO.excedente },
  g: { label: 'Compra externa', badge: TONO.fuerte },
}

const beB = computed(
  () =>
    beData.value?.balance || {
      ungg: {
        venta_bolsa: {},
        compra_bolsa_directa: {},
        compra_bolsa_no_directa: {},
        compra_bolsa_total: {},
        neto: {},
      },
      ungc: { venta_bolsa: {} },
    },
)

const bePeriodoLabel = computed(() => {
  const p = beData.value?.periodo
  if (!p) return ''
  return p.es_mes_actual
    ? `Real 1–${p.dia_corte} · Proyectado ${p.dia_corte + 1}–${p.dias_mes}`
    : `Mes cerrado · ${p.dias_mes} días`
})

// Positivo (vende neto a bolsa) es lo esperado; negativo significa que el mes
// se cierra comprando en bolsa, que es lo que dispara garantías.
const beNetoColor = computed(() =>
  (beB.value.ungg.neto?.total ?? 0) < 0 ? 'text-destructive' : 'text-unergy-deep',
)
const beNetoEtiqueta = computed(() =>
  (beB.value.ungg.neto?.total ?? 0) < 0 ? 'compra neta' : 'venta neta',
)
const beNetoClase = computed(() =>
  (beB.value.ungg.neto?.total ?? 0) < 0 ? TONO.deficit : TONO.excedente,
)

const beFilas = computed(() => {
  let filas = beData.value?.inventario || []
  if (beFiltro.value) filas = filas.filter((f) => f.categoria === beFiltro.value)
  const q = beBusqueda.value.trim().toLowerCase()
  if (q) {
    filas = filas.filter(
      (f) =>
        (f.frontera || '').toLowerCase().includes(q) ||
        (f.planta || '').toLowerCase().includes(q) ||
        (f.estado || '').toLowerCase().includes(q) ||
        (f.contrato || '').toLowerCase().includes(q),
    )
  }
  return filas
})

// Click en una capa del libro mayor: abre el desglose de dónde sale la cifra.
// Filtrar la tabla de abajo queda a un botón dentro del modal, para que las dos
// acciones no compitan por el mismo click.
const beCapa = ref<'e' | 'f' | 'c' | 'uso' | null>(null)

function beTitulo(categoria: 'e' | 'f' | 'c' | 'uso') {
  return `${BE_AYUDA[categoria]}\n\nClick para ver de qué plantas sale la cifra.`
}

function beAbrirCapa(categoria: 'e' | 'f' | 'c' | 'uso') {
  beCapa.value = categoria
}
function beCerrarCapa() {
  beCapa.value = null
}
function beVerEnTabla() {
  beFiltro.value = beCapa.value
  beCapa.value = null
}

const beCapaFilas = computed(() => {
  if (!beCapa.value) return []
  return (beData.value?.inventario || [])
    .filter((f) => f.categoria === beCapa.value)
    .slice()
    .sort((a, b) => (b.mwh_total ?? -1) - (a.mwh_total ?? -1))
})

const beCapaPlantas = computed(() => new Set(beCapaFilas.value.map((f) => f.proyecto_id)).size)

const beCapaTotales = computed(() => {
  const t = { real: 0, proyectado: 0, total: 0 }
  for (const f of beCapaFilas.value) {
    t.real += f.mwh_real || 0
    t.proyectado += f.mwh_proyectado || 0
    t.total += f.mwh_total || 0
  }
  return t
})

function fmtNum1(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return Math.abs(val).toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function fmtSigno(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return (val < 0 ? '−' : '+') + fmtNum1(val)
}

async function loadBalance() {
  beLoading.value = true
  beError.value = null
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
    beData.value = (esMesActual
      ? await cumplimientoService.obtenerBalanceEnergia(params, 120_000)
      : await cachedGet('/cumplimiento/balance-energia', params, () =>
          cumplimientoService.obtenerBalanceEnergia(params),
        )) as unknown as BeData
    updateCacheSize()
  } catch (e) {
    beError.value = errDetail(e) || 'Error al calcular el balance de energía.'
  } finally {
    beLoading.value = false
  }
}

async function exportarBalanceExcel() {
  if (!beData.value) return
  const XLSX = await import('xlsx-js-style')
  const mes = MESES[beMonth.value - 1]
  const b = beB.value

  const aoa: (string | number)[][] = [
    [`UNERGY — Balance de energía en bolsa · ${mes} ${beYear.value}`],
    [bePeriodoLabel.value],
    [],
  ]
  const linea = (etiqueta: string, celda: BeCelda, signo = 1) =>
    aoa.push([
      etiqueta,
      '',
      '',
      signo * (celda.real ?? 0),
      signo * (celda.proyectado ?? 0),
      signo * (celda.total ?? 0),
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
  const header = [
    'Frontera',
    'Planta',
    'Estado',
    'Método',
    'Contrato',
    'Desde',
    'Hasta',
    'Días',
    'Gen. tramo (MWh)',
    '% Despacho',
    'Real (MWh)',
    'Proyectado (MWh)',
    'Total (MWh)',
    'Nota',
  ]
  const filaHeader = aoa.length
  aoa.push(header)
  for (const f of beData.value.inventario) {
    const genBase =
      f.gen_tramo_real !== null && f.gen_tramo_real !== undefined
        ? Number(((f.gen_tramo_real || 0) + (f.gen_tramo_proyectado || 0)).toFixed(3))
        : ''
    aoa.push([
      f.frontera,
      f.planta,
      f.estado,
      f.metodo,
      f.contrato || '',
      f.desde || '',
      f.hasta || '',
      f.dias ?? '',
      genBase,
      f.pct !== null && f.pct !== undefined ? Number((f.pct * 100).toFixed(0)) : '',
      f.mwh_real ?? '',
      f.mwh_proyectado ?? '',
      f.mwh_total ?? '',
      f.estimado ? 'Generación estimada con el promedio diario del mes' : '',
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const C = { morado: '915BD8', oscuro: '2C2039', blanco: 'FFFFFF' }
  for (const fila of [filaLibro, filaHeader]) {
    for (let c = 0; c < header.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: fila, c })
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = {
        font: { bold: true, color: { rgb: C.blanco } },
        fill: { fgColor: { rgb: C.morado } },
      }
    }
  }
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 })
  if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }]
  ws['!cols'] = [
    { wch: 34 },
    { wch: 30 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 7 },
    { wch: 17 },
    { wch: 11 },
    { wch: 13 },
    { wch: 16 },
    { wch: 13 },
    { wch: 44 },
  ]
  ws['!autofilter'] = { ref: `A${filaHeader + 1}:N${aoa.length}` }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Balance ${mes} ${beYear.value}`.slice(0, 31))
  XLSX.writeFile(
    wb,
    `balance_energia_${beYear.value}_${String(beMonth.value).padStart(2, '0')}.xlsx`,
  )
}

function isExpiringSoon(dateStr: string | null | undefined) {
  if (!dateStr) return false
  const end = new Date(dateStr + 'T00:00:00')
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 60
}

watch(activeTab, (tab) => {
  if (tab === 0 && !simData.value) loadSimulator()
  if (tab === 1 && !anualData.value) {
    loadAnnualData()
    loadTableData()
  }
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
/* ── Matriz anual: encabezado y primera columna fijos (sticky) al hacer scroll
   horizontal, con una celda "sticky" siempre opaca (para tapar el contenido
   que pasa por debajo) independiente del hover de su fila. Esa combinación de
   sticky + hover + capas opacas por celda no se expresa con utilidades de
   Tailwind sin duplicar clases condicionales en cada celda — es la única regla
   de layout que se queda aquí. Nombres de clase sin cambios respecto al resto
   del archivo (ya migrado a Tailwind). ── */
.cv-matriz {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.cv-matriz thead th {
  position: sticky;
  top: 0;
  background: #faf8fd;
  z-index: 2;
  font-weight: 600;
  color: var(--color-unergy-deep);
  border-bottom: 1px solid rgba(44, 32, 57, 0.1);
}
.cv-matriz .sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 1;
  min-width: 240px;
}
.cv-matriz thead .sticky-col {
  z-index: 3;
  background: #faf8fd;
}
.cv-matriz-contrato:hover {
  background: #f6f2fb;
}
.cv-matriz-contrato .sticky-col {
  background: #fff;
}
.cv-matriz-proyecto {
  background: #fbfafd;
}
.cv-matriz-proyecto .sticky-col {
  background: #fbfafd;
}
.cv-matriz-total td {
  border-top: 2px solid rgba(44, 32, 57, 0.15);
  background: #f3eefb;
}
.cv-matriz-total .sticky-col {
  background: #f3eefb;
}

/* Scrollbar angosta del panel de plantas arrastrables del simulador — Tailwind
   no tiene utilidades para pseudo-elementos ::-webkit-scrollbar. */
.sim-plant-zone::-webkit-scrollbar {
  width: 4px;
}
.sim-plant-zone::-webkit-scrollbar-thumb {
  background: rgba(145, 91, 216, 0.2);
  border-radius: 2px;
}
.sim-plant-zone::-webkit-scrollbar-track {
  background: transparent;
}
</style>
