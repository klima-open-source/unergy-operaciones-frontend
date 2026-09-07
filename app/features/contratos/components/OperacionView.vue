<template>
  <div class="space-y-5">

    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-2">
      <Button text severity="secondary" @click="$router.back()" class="-ml-1">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <div>
        <p class="text-xs leading-none mb-0.5" style="color:#9b89b5">
          <span class="cursor-pointer hover:underline"
            @click="$router.push(`/proyectos/${route.params.id}`)">
            {{ proyectoNombre || '…' }}
          </span>
          <span class="mx-1.5">›</span>
          <span>Servicios</span>
          <span class="mx-1.5">›</span>
          <span class="font-medium" style="color:var(--color-unergy-deep)">Operación</span>
        </p>
        <h2 class="text-lg font-bold" style="color:var(--color-unergy-deep)">Operación</h2>
      </div>
    </div>

    <!-- ── Loading ───────────────────────────────────────────────────────────── -->
    <div v-if="loading" class="flex justify-center py-20">
      <ProgressSpinner />
    </div>

    <!-- ── Tabs ──────────────────────────────────────────────────────────────── -->
    <TabView v-else v-model:activeIndex="activeIndex" @tab-change="onTabChange">

      <!-- ══════════ MANTENIMIENTO ══════════ -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-1.5 px-1">
            <WrenchIcon class="text-xs size-[1em]" />
            <span>Mantenimiento</span>
          </div>
        </template>
        <div class="space-y-5 pt-3">

          <!-- Info card -->
          <template v-if="contratos.mantenimiento">
            <div class="rounded-xl border bg-white p-5" style="border-color:#f59e0b40">
              <!-- Header -->
              <div class="flex items-start justify-between mb-4 gap-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:#fef3c7">
                    <WrenchIcon class="text-sm size-[1em]" style="color:#f59e0b" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 leading-none mb-0.5">Contrato de Mantenimiento O&amp;M</p>
                    <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">{{ proyectoNombre }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <GBadge :color="CONTRATO_SEVERITY[contratos.mantenimiento.estado]" class="text-xs">{{ CONTRATO_LABELS[contratos.mantenimiento.estado] }}</GBadge>
                  <Button label="Editar" size="small" text severity="secondary" @click="openMantenimientoDialog('editar')">
                    <template #icon><PencilIcon class="size-[1em]" /></template>
                  </Button>
                  <Button label="Cargar desde Excel" size="small" severity="secondary" outlined @click="triggerExcelInput">
                    <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
                  </Button>
                  <input ref="excelInputRef" type="file" accept=".xlsx,.xls" class="hidden"
                    @change="cargarDesdeExcel" />
                </div>
              </div>
              <!-- Mini-cards grid -->
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <!-- Contratante -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <UserIcon class="text-xs size-[1em]" style="color:#f59e0b" />Contratante
                  </p>
                  <p class="text-sm font-semibold leading-snug" style="color:#1c1917">
                    {{ contratos.mantenimiento.contratante_nombre || '—' }}
                  </p>
                </div>
                <!-- Prestador -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <BuildingIcon class="text-xs size-[1em]" style="color:#f59e0b" />Prestador
                  </p>
                  <p class="text-sm font-semibold leading-snug" style="color:#1c1917">
                    {{ contratos.mantenimiento.prestador_nombre || '—' }}
                  </p>
                </div>
                <!-- Fecha inicio -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <CalendarIcon class="text-xs size-[1em]" style="color:#f59e0b" />Fecha de inicio O&amp;M
                  </p>
                  <p class="text-sm font-semibold" style="color:#1c1917">
                    {{ formatFecha(contratos.mantenimiento.fecha_inicio_om || contratos.mantenimiento.fecha_inicio) || '—' }}
                  </p>
                </div>
                <!-- Valor anual -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <DollarSignIcon class="text-xs size-[1em]" style="color:#f59e0b" />Valor O&amp;M Anual (BASE)
                  </p>
                  <p class="text-base font-bold" style="color:#d97706">
                    {{ formatCOP(getValorVigente(contratos.mantenimiento.indexacion_anual)?.valor ?? contratos.mantenimiento.tarifa_base) || '—' }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity"
                    style="background:none;border:none;padding:0;cursor:pointer;color:#f59e0b"
                    @click="showIndexacion.anual = !showIndexacion.anual">
                    <ChevronDownIcon class="text-xs transition-transform duration-200 size-[1em]" :style="showIndexacion.anual ? 'transform:rotate(180deg)' : ''" />
                    {{ showIndexacion.anual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Valor mensual -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <CalculatorIcon class="text-xs size-[1em]" style="color:#f59e0b" />Valor mensual
                  </p>
                  <p class="text-base font-bold" style="color:#d97706">
                    {{ formatCOP(getValorVigente(contratos.mantenimiento.indexacion_mensual)?.valor ?? contratos.mantenimiento.tarifa_mensual ?? (contratos.mantenimiento.tarifa_base != null ? Math.round(contratos.mantenimiento.tarifa_base / 12) : null)) || '—' }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity"
                    style="background:none;border:none;padding:0;cursor:pointer;color:#f59e0b"
                    @click="showIndexacion.mensual = !showIndexacion.mensual">
                    <ChevronDownIcon class="text-xs transition-transform duration-200 size-[1em]" :style="showIndexacion.mensual ? 'transform:rotate(180deg)' : ''" />
                    {{ showIndexacion.mensual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Enlace Drive -->
                <div class="rounded-lg p-3.5" style="background:#fffbeb;border:1px solid #fde68a">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#92400e">
                    <FileTextIcon class="text-xs size-[1em]" style="color:#f59e0b" />Contrato en Drive
                  </p>
                  <a v-if="contratos.mantenimiento.enlace_drive && contratos.mantenimiento.enlace_drive.startsWith('http')"
                     :href="contratos.mantenimiento.enlace_drive" target="_blank" rel="noopener"
                     class="text-sm font-semibold flex items-center gap-1.5 hover:underline" style="color:#f59e0b">
                    <ExternalLinkIcon class="text-xs size-[1em]" />Ver contrato
                  </a>
                  <button v-else @click="openMantenimientoDialog('editar')"
                    class="text-sm font-medium flex items-center gap-1.5" style="color:#f59e0b">
                    <CirclePlusIcon class="text-xs size-[1em]" />Agregar enlace
                  </button>
                </div>
              </div>

              <!-- ── Paneles de indexación O&M ─────────────────────────────────── -->

              <!-- Panel ANUAL -->
              <div :style="{ overflow: 'hidden', transition: 'max-height 0.35s ease', maxHeight: showIndexacion.anual ? '800px' : '0px' }">
                <div class="pt-3">
                  <div class="rounded-xl border border-amber-200 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-amber-50">
                      <span class="text-xs font-semibold" style="color:#92400e">
                        <DollarSignIcon class="text-xs mr-1.5 size-[1em]" style="color:#f59e0b" />Indexación anual O&M
                      </span>
                      <span class="text-xs text-gray-400">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500">Valor anual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!contratos.mantenimiento.indexacion_anual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-gray-400">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de inicio O&amp;M (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (contratos.mantenimiento.indexacion_anual || [])" :key="fila.anio"
                          class="border-b border-gray-50 hover:bg-amber-50/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-amber-50/50' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-semibold"
                                :style="fila.anio === ANIO_ACTUAL ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                                style="background:#fef3c7;color:#d97706">actual</span>
                              <ArrowLeftIcon class="text-xs size-[1em]" v-if="fila.anio === ANIO_ACTUAL" style="color:#d97706" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-gray-400 text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums" style="color:#374151">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td class="px-4 py-2.5 text-right font-semibold tabular-nums"
                            :style="fila.anio === ANIO_ACTUAL ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#dcfce7;color:#166534">
                              <CheckIcon class="text-xs size-[1em]" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#fef3c7;color:#d97706">
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#f3f4f6;color:#9ca3af">
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
                      <ZapIcon class="text-xs size-[1em]" style="color:#f59e0b" />
                      Calculado automáticamente desde la Fecha de inicio O&amp;M y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel MENSUAL -->
              <div :style="{ overflow: 'hidden', transition: 'max-height 0.35s ease', maxHeight: showIndexacion.mensual ? '800px' : '0px' }">
                <div class="pt-3">
                  <div class="rounded-xl border border-amber-200 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-amber-50">
                      <span class="text-xs font-semibold" style="color:#92400e">
                        <CalculatorIcon class="text-xs mr-1.5 size-[1em]" style="color:#f59e0b" />Indexación mensual O&M
                      </span>
                      <span class="text-xs text-gray-400">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500">Valor mensual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!contratos.mantenimiento.indexacion_mensual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-gray-400">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de inicio O&amp;M (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (contratos.mantenimiento.indexacion_mensual || [])" :key="fila.anio"
                          class="border-b border-gray-50 hover:bg-amber-50/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-amber-50/50' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-semibold"
                                :style="fila.anio === ANIO_ACTUAL ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                                style="background:#fef3c7;color:#d97706">actual</span>
                              <ArrowLeftIcon class="text-xs size-[1em]" v-if="fila.anio === ANIO_ACTUAL" style="color:#d97706" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-gray-400 text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums" style="color:#374151">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td class="px-4 py-2.5 text-right font-semibold tabular-nums"
                            :style="fila.anio === ANIO_ACTUAL ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#dcfce7;color:#166534">
                              <CheckIcon class="text-xs size-[1em]" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#fef3c7;color:#d97706">
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#f3f4f6;color:#9ca3af">
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
                      <ZapIcon class="text-xs size-[1em]" style="color:#f59e0b" />
                      Calculado automáticamente desde la Fecha de inicio O&amp;M y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-10 text-center">
              <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style="background:#fef3c7">
                <WrenchIcon class="text-xl size-[1em]" style="color:#f59e0b" />
              </div>
              <p class="text-sm font-medium text-gray-600 mb-1">Sin contrato de mantenimiento</p>
              <p class="text-xs text-gray-400 mb-4">Registra el contrato para iniciar el seguimiento de pagos</p>
              <Button label="Crear contrato" size="small" style="background:#f59e0b;border-color:#f59e0b" @click="openMantenimientoDialog('crear')">
                <template #icon><PlusIcon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>

          <!-- Payments section -->
          <PagosTabla
            tipo="mantenimiento"
            color="#f59e0b"
            :contrato-id="contratos.mantenimiento?.id ?? null"
            :pagos="pagos.mantenimiento"
            :loading-pagos="loadingPagos.mantenimiento"
            :filtros="filtros.mantenimiento"
            @open-pago="openNuevoPago('mantenimiento')"
            @eliminar="(id) => eliminarPago('mantenimiento', id)"
          />

          <!-- Facturas -->
          <FacturasCobradas
            :datos="facturasCobradas"
            :proyecto-nombre="proyectoNombre"
          />
          <FacturasEmitidas
            :datos="facturasEmitidas"
            :proyecto-nombre="proyectoNombre"
          />

        </div>
      </TabPanel>

      <!-- ══════════ ARRIENDOS ══════════ -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-1.5 px-1">
            <HouseIcon class="text-xs size-[1em]" />
            <span>Arriendos</span>
          </div>
        </template>
        <div class="space-y-5 pt-3">

          <template v-if="contratos.arriendo">
            <div class="rounded-xl border bg-white p-5" style="border-color:#8b5cf640">
              <!-- Header -->
              <div class="flex items-start justify-between mb-4 gap-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:#f5f3ff">
                    <HouseIcon class="text-sm size-[1em]" style="color:#8b5cf6" />
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 leading-none mb-0.5">Contrato de Arriendo</p>
                    <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">{{ proyectoNombre }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <GBadge :color="CONTRATO_SEVERITY[contratos.arriendo.estado]" class="text-xs">{{ CONTRATO_LABELS[contratos.arriendo.estado] }}</GBadge>
                  <Button label="Editar" size="small" text severity="secondary" @click="openEditContrato('arriendo')">
                    <template #icon><PencilIcon class="size-[1em]" /></template>
                  </Button>
                </div>
              </div>
              <!-- Mini-cards -->
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="rounded-lg p-3.5" style="background:#f5f3ff;border:1px solid #ddd6fe">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#5b21b6">
                    <UserIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Arrendatario
                  </p>
                  <p class="text-sm font-semibold leading-snug" style="color:#1c1917">{{ contratos.arriendo.contratante_nombre || '—' }}</p>
                </div>
                <div class="rounded-lg p-3.5" style="background:#f5f3ff;border:1px solid #ddd6fe">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#5b21b6">
                    <CalendarIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Fecha de contrato
                  </p>
                  <p class="text-sm font-semibold" style="color:#1c1917">{{ formatFecha(contratos.arriendo.fecha_firma_contrato) || '—' }}</p>
                </div>
                <!-- Valor anual con indexación -->
                <div class="rounded-lg p-3.5" style="background:#f5f3ff;border:1px solid #ddd6fe">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#5b21b6">
                    <DollarSignIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Valor anual ({{ ANIO_ACTUAL }})
                  </p>
                  <p class="text-base font-bold" style="color:#7c3aed">
                    {{ formatCOP(getValorVigente(contratos.arriendo.indexacion_anual)?.valor ?? contratos.arriendo.tarifa_base) }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity"
                    style="background:none;border:none;padding:0;cursor:pointer;color:#8b5cf6"
                    @click="showIndexacionArriendo.anual = !showIndexacionArriendo.anual">
                    <ChevronDownIcon class="text-xs transition-transform duration-200 size-[1em]" :style="showIndexacionArriendo.anual ? 'transform:rotate(180deg)' : ''" />
                    {{ showIndexacionArriendo.anual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Valor mensual -->
                <div class="rounded-lg p-3.5" style="background:#f5f3ff;border:1px solid #ddd6fe">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#5b21b6">
                    <CalculatorIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Valor mensual ({{ ANIO_ACTUAL }})
                  </p>
                  <p class="text-base font-bold" style="color:#7c3aed">
                    {{ formatCOP(getValorVigente(contratos.arriendo.indexacion_mensual)?.valor ?? contratos.arriendo.tarifa_mensual ?? (contratos.arriendo.tarifa_base != null ? Math.round(contratos.arriendo.tarifa_base / 12) : null)) }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity"
                    style="background:none;border:none;padding:0;cursor:pointer;color:#8b5cf6"
                    @click="showIndexacionArriendo.mensual = !showIndexacionArriendo.mensual">
                    <ChevronDownIcon class="text-xs transition-transform duration-200 size-[1em]" :style="showIndexacionArriendo.mensual ? 'transform:rotate(180deg)' : ''" />
                    {{ showIndexacionArriendo.mensual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Contrato en Drive -->
                <div class="rounded-lg p-3.5" style="background:#f5f3ff;border:1px solid #ddd6fe">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5" style="color:#5b21b6">
                    <FileTextIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Contrato en Drive
                  </p>
                  <a v-if="contratos.arriendo.enlace_drive?.startsWith('http')"
                     :href="contratos.arriendo.enlace_drive" target="_blank" rel="noopener"
                     class="text-sm font-semibold flex items-center gap-1.5 hover:underline" style="color:#8b5cf6">
                    <ExternalLinkIcon class="text-xs size-[1em]" />Ver contrato
                  </a>
                  <span v-else class="text-sm text-gray-400">Sin enlace</span>
                </div>
              </div>

              <!-- Sección Arrendadores -->
              <div class="rounded-xl border mt-3" style="border-color:#ddd6fe">
                <div class="flex items-center justify-between px-4 py-2.5" style="background:#f5f3ff">
                  <span class="text-xs font-semibold flex items-center gap-1.5" style="color:#5b21b6">
                    <UsersIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Arrendadores
                  </span>
                  <Button label="Agregar arrendador" size="small" text style="color:#8b5cf6" @click="openArrendadorDialog('crear')">
                    <template #icon><PlusIcon class="size-[1em]" /></template>
                  </Button>
                </div>
                <div v-if="!arrendadores.length" class="px-4 py-6 text-center text-xs text-gray-400">
                  Sin arrendadores registrados.
                </div>
                <div v-else class="divide-y divide-gray-100">
                  <div v-for="a in arrendadores" :key="a.id"
                    class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold" style="color:#1c1917">{{ a.nombre }}</span>
                      <span class="text-sm font-mono tabular-nums" style="color:#7c3aed">{{ formatCOP(a.valor_base) }}</span>
                      <span v-if="a.responsable_iva" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                        style="background:#ede9fe;color:#7c3aed">Responsable IVA</span>
                      <span v-if="a.activo === false" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                        style="background:#f3f4f6;color:#9ca3af">Inactivo</span>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <Button size="small" text severity="secondary" @click="openArrendadorDialog('editar', a)">
                        <template #icon><PencilIcon class="size-[1em]" /></template>
                      </Button>
                      <Button size="small" text severity="danger" @click="eliminarArrendador(a)">
                        <template #icon><Trash2Icon class="size-[1em]" /></template>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel indexación ANUAL por arrendador -->
              <div v-for="a in arrendadores" :key="'anual-' + a.id"
                :style="{ overflow: 'hidden', transition: 'max-height 0.35s ease', maxHeight: showIndexacionArriendo.anual ? '800px' : '0px' }">
                <div class="pt-3">
                  <div class="rounded-xl border overflow-hidden" style="border-color:#ddd6fe">
                    <div class="flex items-center justify-between px-4 py-2.5" style="background:#f5f3ff">
                      <span class="text-xs font-semibold" style="color:#5b21b6">
                        <DollarSignIcon class="text-xs mr-1.5 size-[1em]" style="color:#8b5cf6" />Indexación anual de arriendo — {{ a.nombre }}
                      </span>
                      <span class="text-xs text-gray-400">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500">Valor anual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!a.indexacion_anual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-gray-400">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de contrato (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (a.indexacion_anual || [])" :key="fila.anio"
                          class="border-b border-gray-50 hover:bg-violet-50/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-violet-50/40' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-semibold"
                                :style="fila.anio === ANIO_ACTUAL ? 'color:#7c3aed' : 'color:var(--color-unergy-deep)'">
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                                style="background:#ede9fe;color:#7c3aed">actual</span>
                              <ArrowLeftIcon class="text-xs size-[1em]" v-if="fila.anio === ANIO_ACTUAL" style="color:#7c3aed" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-gray-400 text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums" style="color:#374151">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td class="px-4 py-2.5 text-right font-semibold tabular-nums"
                            :style="fila.anio === ANIO_ACTUAL ? 'color:#7c3aed' : 'color:var(--color-unergy-deep)'">
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#dcfce7;color:#166534">
                              <CheckIcon class="text-xs size-[1em]" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#ede9fe;color:#7c3aed">
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#f3f4f6;color:#9ca3af">
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
                      <ZapIcon class="text-xs size-[1em]" style="color:#8b5cf6" />
                      Calculado automáticamente desde la Fecha de contrato y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel indexación MENSUAL por arrendador -->
              <div v-for="a in arrendadores" :key="'mensual-' + a.id"
                :style="{ overflow: 'hidden', transition: 'max-height 0.35s ease', maxHeight: showIndexacionArriendo.mensual ? '800px' : '0px' }">
                <div class="pt-3">
                  <div class="rounded-xl border overflow-hidden" style="border-color:#ddd6fe">
                    <div class="flex items-center justify-between px-4 py-2.5" style="background:#f5f3ff">
                      <span class="text-xs font-semibold" style="color:#5b21b6">
                        <CalculatorIcon class="text-xs mr-1.5 size-[1em]" style="color:#8b5cf6" />Indexación mensual de arriendo — {{ a.nombre }}
                      </span>
                      <span class="text-xs text-gray-400">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500">Valor mensual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!a.indexacion_mensual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-gray-400">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de contrato (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (a.indexacion_mensual || [])" :key="fila.anio"
                          class="border-b border-gray-50 hover:bg-violet-50/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-violet-50/40' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-semibold"
                                :style="fila.anio === ANIO_ACTUAL ? 'color:#7c3aed' : 'color:var(--color-unergy-deep)'">
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                                style="background:#ede9fe;color:#7c3aed">actual</span>
                              <ArrowLeftIcon class="text-xs size-[1em]" v-if="fila.anio === ANIO_ACTUAL" style="color:#7c3aed" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-gray-400 text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums" style="color:#374151">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td class="px-4 py-2.5 text-right font-semibold tabular-nums"
                            :style="fila.anio === ANIO_ACTUAL ? 'color:#7c3aed' : 'color:var(--color-unergy-deep)'">
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#dcfce7;color:#166534">
                              <CheckIcon class="text-xs size-[1em]" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#ede9fe;color:#7c3aed">
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style="background:#f3f4f6;color:#9ca3af">
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
                      <ZapIcon class="text-xs size-[1em]" style="color:#8b5cf6" />
                      Calculado automáticamente desde la Fecha de contrato y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <!-- Dialog Arrendador (crear/editar) -->
            <Dialog v-model:visible="arrendadorDialog.visible" modal
              :header="arrendadorDialog.modo === 'editar' ? 'Editar arrendador' : 'Agregar arrendador'"
              style="width: 26rem">
              <div class="flex flex-col gap-3 pt-2">
                <div>
                  <label class="text-xs font-medium text-gray-600">Nombre <span class="text-red-400">*</span></label>
                  <InputText v-model="arrendadorDialog.form.nombre" class="w-full" placeholder="Nombre o razón social" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Valor base</label>
                  <InputNumber v-model="arrendadorDialog.form.valor_base" class="w-full" mode="currency"
                    currency="COP" locale="es-CO" :maxFractionDigits="0" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Responsable IVA</label>
                  <Select v-model="arrendadorDialog.form.responsable_iva"
                    :options="[{label:'Sí',value:true},{label:'No',value:false}]"
                    optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-600">Activo</label>
                  <Select v-model="arrendadorDialog.form.activo"
                    :options="[{label:'Sí',value:true},{label:'No',value:false}]"
                    optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-gray-600">Anticipo pagado desde</label>
                  <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_desde" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-gray-600">Anticipo pagado hasta</label>
                  <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_hasta" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-gray-600">Observaciones</label>
                  <Textarea v-model="arrendadorDialog.form.observaciones" rows="2" class="w-full" />
                </div>
              </div>
              <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="arrendadorDialog.visible = false" />
                <Button label="Guardar" :loading="arrendadorDialog.guardando" @click="guardarArrendador" />
              </template>
            </Dialog>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-10 text-center">
              <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style="background:#f5f3ff">
                <HouseIcon class="text-xl size-[1em]" style="color:#8b5cf6" />
              </div>
              <p class="text-sm font-medium text-gray-600 mb-1">Sin contrato de arriendo registrado</p>
              <p class="text-xs text-gray-400 mb-4">No se encontró contrato de arriendo para este proyecto</p>
              <Button label="Crear contrato" size="small" style="background:#8b5cf6;border-color:#8b5cf6" @click="openWizard('arriendo')">
                <template #icon><PlusIcon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>

          <PagosTabla
            tipo="arriendo"
            color="#8b5cf6"
            :contrato-id="contratos.arriendo?.id ?? null"
            :pagos="pagos.arriendo"
            :loading-pagos="loadingPagos.arriendo"
            :filtros="filtros.arriendo"
            @open-pago="openNuevoPago('arriendo')"
            @eliminar="(id) => eliminarPago('arriendo', id)"
          />

        </div>
      </TabPanel>

      <!-- ══════════ INTERNET ══════════ -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-1.5 px-1">
            <WifiIcon class="text-xs size-[1em]" />
            <span>Internet</span>
          </div>
        </template>
        <div class="space-y-5 pt-3">

          <template v-if="contratos.internet">
            <div class="rounded-xl border bg-white p-5" style="border-color:#06b6d440">
              <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#ecfeff">
                    <WifiIcon class="text-sm size-[1em]" style="color:#06b6d4" />
                  </div>
                  <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Servicio de Internet</span>
                  <GBadge :color="CONTRATO_SEVERITY[contratos.internet.estado]" class="text-xs">{{ CONTRATO_LABELS[contratos.internet.estado] }}</GBadge>
                </div>
                <Button label="Editar" size="small" text severity="secondary" @click="openEditContrato('internet')">
                  <template #icon><PencilIcon class="size-[1em]" /></template>
                </Button>
                <Button label="Nuevo servicio" size="small" outlined style="border-color:#06b6d4;color:#06b6d4" @click="openWizard('internet')">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <InfoIcon :icon="BuildingIcon" color="#06b6d4" label="Proveedor"
                  :value="contratos.internet.prestador_nombre" />
                <InfoIcon :icon="DatabaseIcon" color="#06b6d4" label="Plan de datos"
                  :value="contratos.internet.plan_datos_gb" />
                <InfoIcon :icon="GaugeIcon" color="#06b6d4" label="Velocidad"
                  :value="contratos.internet.velocidad_mbps != null ? `${contratos.internet.velocidad_mbps} Mbps` : null" />
                <InfoIcon :icon="WifiIcon" color="#06b6d4" label="Tipo de conexión"
                  :value="contratos.internet.tipo_conexion" />
                <InfoIcon :icon="NetworkIcon" color="#06b6d4" label="Línea de servicio"
                  :value="contratos.internet.linea_servicio" />
                <InfoIcon :icon="MonitorIcon" color="#06b6d4" label="ID del router"
                  :value="contratos.internet.id_router" />
                <InfoIcon :icon="BoxIcon" color="#06b6d4" label="Número de kit"
                  :value="contratos.internet.numero_kit" />
                <InfoIcon :icon="ZapIcon" color="#06b6d4" label="Latencia"
                  :value="contratos.internet.latencia_ms != null ? `${contratos.internet.latencia_ms} ms` : null" />
                <InfoIcon :icon="ShieldIcon" color="#06b6d4" label="Seguridad del wifi"
                  :value="contratos.internet.wifi_seguridad" />
                <InfoSecret color="#06b6d4" label="Contraseña wifi"
                  :value="contratos.internet.wifi_password" />
                <InfoLink color="#06b6d4" label="Factura / Contrato en Drive"
                  :href="contratos.internet.enlace_drive" />
              </div>

              <!-- Ubicación del servicio -->
              <div v-if="contratos.internet.ubicacion_lat != null && contratos.internet.ubicacion_lng != null"
                class="mt-5 pt-4 border-t border-gray-100">
                <p class="text-xs font-medium mb-2" style="color:#9b89b5">
                  Ubicación: {{ contratos.internet.ubicacion_lat }},{{ contratos.internet.ubicacion_lng }}
                </p>
                <div ref="internetMapEl" class="rounded-md overflow-hidden" style="height:200px; background:#e5e3df"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-cyan-200 bg-cyan-50/40 p-10 text-center">
              <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style="background:#ecfeff">
                <WifiIcon class="text-xl size-[1em]" style="color:#06b6d4" />
              </div>
              <p class="text-sm font-medium text-gray-600 mb-1">Sin servicio de internet registrado</p>
              <p class="text-xs text-gray-400 mb-4">Registra el proveedor para iniciar el seguimiento de pagos</p>
              <Button label="Registrar servicio" size="small" style="background:#06b6d4;border-color:#06b6d4" @click="openWizard('internet')">
                <template #icon><PlusIcon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>
        </div>
      </TabPanel>

    </TabView>

    <!-- ── Dialog Mantenimiento (crear / editar) ─────────────────────────────── -->
    <Dialog v-model:visible="dialogMant.visible" modal :style="{ width: '520px' }"
      :breakpoints="{ '560px': '95vw' }">
      <template #header>
        <div class="flex items-center gap-2">
          <WrenchIcon class="text-sm size-[1em]" style="color:#f59e0b" />
          <span class="font-semibold text-sm" style="color:var(--color-unergy-deep)">
            {{ dialogMant.modo === 'crear' ? 'Crear contrato de mantenimiento' : 'Editar contrato de mantenimiento' }}
          </span>
        </div>
      </template>
      <div class="space-y-4 pt-1">
        <!-- Contratante / Prestador -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Contratante <span class="text-red-400">*</span></label>
            <InputText v-model="dialogMant.form.contratante_nombre" class="w-full" placeholder="Nombre o razón social" />
            <p v-if="dialogMant.errores.contratante_nombre" class="text-xs text-red-400">{{ dialogMant.errores.contratante_nombre }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Prestador <span class="text-red-400">*</span></label>
            <InputText v-model="dialogMant.form.prestador_nombre" class="w-full" placeholder="Nombre o razón social" />
            <p v-if="dialogMant.errores.prestador_nombre" class="text-xs text-red-400">{{ dialogMant.errores.prestador_nombre }}</p>
          </div>
        </div>
        <!-- Fecha / Estado -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Fecha de inicio O&amp;M <span class="text-red-400">*</span></label>
            <DatePicker v-model="dialogMant.form.fecha_inicio_om" dateFormat="yy-mm-dd"
              class="w-full" showClear placeholder="aaaa-mm-dd" />
            <p class="text-xs text-gray-400">Es la fecha que Costos usa para indexar la tarifa.</p>
            <p v-if="dialogMant.errores.fecha_inicio_om" class="text-xs text-red-400">{{ dialogMant.errores.fecha_inicio_om }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Estado <span class="text-red-400">*</span></label>
            <Select v-model="dialogMant.form.estado" :options="ESTADOS_MANT"
              optionLabel="label" optionValue="value" class="w-full" />
            <p v-if="dialogMant.errores.estado" class="text-xs text-red-400">{{ dialogMant.errores.estado }}</p>
          </div>
        </div>
        <!-- Fecha de suscripción (informativa; no interviene en la indexación) -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Fecha de suscripción del contrato</label>
            <DatePicker v-model="dialogMant.form.fecha_firma_contrato" dateFormat="yy-mm-dd"
              class="w-full" showClear placeholder="aaaa-mm-dd" />
            <p class="text-xs text-gray-400">Solo informativa. La indexación usa la Fecha de inicio O&amp;M.</p>
          </div>
        </div>
        <!-- Periodicidad de cobro -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Periodicidad de cobro <span class="text-red-400">*</span></label>
            <Select v-model="dialogMant.form.periodicidad_pago" :options="PERIODICIDADES"
              optionLabel="label" optionValue="value" class="w-full" placeholder="Selecciona…" />
            <p class="text-xs text-gray-400">Define en qué meses se cobra en el panel de Mantenimiento.</p>
          </div>
        </div>
        <!-- Valor anual / Valor mensual -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Valor O&amp;M Anual (BASE) <span class="text-red-400">*</span></label>
            <InputNumber v-model="dialogMant.form.tarifa_base"
              mode="currency" currency="COP" locale="es-CO" :maxFractionDigits="0"
              class="w-full" placeholder="$ 0"
              @update:modelValue="v => { if (v != null) dialogMant.form.tarifa_mensual = Math.round(v / 12) }" />
            <p v-if="dialogMant.errores.tarifa_base" class="text-xs text-red-400">{{ dialogMant.errores.tarifa_base }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Valor mensual <span class="text-red-400">*</span></label>
            <InputNumber v-model="dialogMant.form.tarifa_mensual"
              mode="currency" currency="COP" locale="es-CO" :maxFractionDigits="0"
              class="w-full" placeholder="$ 0" />
            <p class="text-xs text-gray-400">Sugerido: Valor Anual ÷ 12</p>
          </div>
        </div>
        <!-- Enlace Drive -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Enlace del contrato en Drive</label>
          <InputText v-model="dialogMant.form.enlace_drive" class="w-full"
            placeholder="https://drive.google.com/…" />
          <p v-if="dialogMant.errores.enlace_drive" class="text-xs text-red-400">{{ dialogMant.errores.enlace_drive }}</p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogMant.visible = false" />
        <Button :label="dialogMant.modo === 'crear' ? 'Crear contrato' : 'Guardar cambios'" :loading="guardandoMant" style="background:#f59e0b;border-color:#f59e0b" @click="saveMantenimiento">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

    <!-- ── Wizard nuevo contrato ──────────────────────────────────────────────── -->
    <ContratoServicioWizard
      v-if="wizardVisible"
      :visible="wizardVisible"
      :tipo="wizardTipo"
      :proyecto-id-default="Number(route.params.id)"
      @cerrar="wizardVisible = false"
      @creado="onContratoCreado"
    />

    <!-- ── Dialog editar contrato ───────────────────────────────────────────── -->
    <Dialog v-model:visible="dialogEdit.visible" modal :style="{ width: '480px' }"
      :breakpoints="{ '520px': '95vw' }">
      <template #header>
        <div class="flex items-center gap-2">
          <PencilIcon class="text-sm size-[1em]" :style="`color:${DIALOG_EDIT_COLOR[dialogEdit.tipo]}`" />
          <span class="font-semibold text-sm" style="color:var(--color-unergy-deep)">
            Editar — {{ DIALOG_EDIT_LABEL[dialogEdit.tipo] }}
          </span>
        </div>
      </template>
      <div class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-4">
          <div v-if="dialogEdit.tipo === 'mantenimiento'" class="col-span-2 md:col-span-1 flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Fecha de inicio O&amp;M</label>
            <DatePicker v-model="dialogEdit.form.fecha_inicio"
              dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
          </div>
          <template v-else-if="dialogEdit.tipo === 'arriendo'">
            <div class="col-span-2 md:col-span-1 flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Fecha de inicio O&amp;M</label>
              <DatePicker v-model="dialogEdit.form.fecha_inicio_om"
                dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
              <p class="text-xs text-gray-400">Solo informativa; no interviene en la indexación.</p>
            </div>
            <div class="col-span-2 md:col-span-1 flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Fecha de contrato</label>
              <DatePicker v-model="dialogEdit.form.fecha_firma_contrato"
                dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
              <p class="text-xs text-gray-400">Fecha base para la indexación en Costos.</p>
            </div>
          </template>
          <div v-if="dialogEdit.tipo !== 'internet'" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">
              {{ dialogEdit.tipo === 'mantenimiento' ? 'Valor O&M Anual BASE (COP)' : 'Valor anual BASE (COP)' }}
            </label>
            <InputNumber v-model="dialogEdit.form.tarifa_base"
              mode="currency" currency="COP" locale="es-CO" :maxFractionDigits="0"
              class="w-full" placeholder="$ 0" />
          </div>
        </div>
        <template v-if="dialogEdit.tipo === 'internet'">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Plan de datos</label>
              <InputText v-model="dialogEdit.form.plan_datos_gb" class="w-full" placeholder="50 GB / Ilimitado" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Velocidad contratada</label>
              <InputNumber v-model="dialogEdit.form.velocidad_mbps" suffix=" Mbps" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Tipo de conexión</label>
            <Select v-model="dialogEdit.form.tipo_conexion"
              :options="[{label:'Starlink',value:'Starlink'},{label:'Fibra',value:'Fibra'},{label:'4G',value:'4G'},{label:'Otro',value:'Otro'}]"
              optionLabel="label" optionValue="value" editable placeholder="Selecciona…" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Línea de servicio</label>
              <InputText v-model="dialogEdit.form.linea_servicio" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">ID del router</label>
              <InputText v-model="dialogEdit.form.id_router" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Número de kit</label>
              <InputText v-model="dialogEdit.form.numero_kit" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Latencia</label>
              <InputNumber v-model="dialogEdit.form.latencia_ms" suffix=" ms" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Seguridad del wifi</label>
              <Select v-model="dialogEdit.form.wifi_seguridad"
                :options="[{label:'WPA2',value:'WPA2'},{label:'WPA3',value:'WPA3'},{label:'WPA2/WPA3',value:'WPA2/WPA3'},{label:'WPA3-OWE',value:'WPA3-OWE'},{label:'Remoto RADIUS',value:'Remoto RADIUS'},{label:'A bordo RADIUS',value:'A bordo RADIUS'},{label:'Abierta',value:'Abierta'}]"
                optionLabel="label" optionValue="value" showClear placeholder="Selecciona…" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Contraseña wifi</label>
              <InputText v-model="dialogEdit.form.wifi_password" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">
              Ubicación del servicio
              <span class="text-gray-400 font-normal">— haz clic en el mapa para ubicarlo</span>
            </label>
            <div ref="dialogEditMapEl" class="rounded-md overflow-hidden" style="height:200px; background:#e5e3df"></div>
          </div>
        </template>
        <div v-if="dialogEdit.tipo === 'arriendo'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Periodicidad de cobro</label>
          <Select v-model="dialogEdit.form.periodicidad_pago" :options="PERIODICIDADES"
            optionLabel="label" optionValue="value" class="w-full" placeholder="Selecciona…" />
          <p class="text-xs text-gray-400">Define en qué meses se cobra en el panel de Costos.</p>
        </div>
        <div v-if="dialogEdit.tipo === 'arriendo'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">¿Responsable de IVA?</label>
          <Select v-model="dialogEdit.form.responsable_iva" :options="[{label:'Sí',value:true},{label:'No',value:false}]"
            optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div v-if="dialogEdit.tipo !== 'internet'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Estado del pago</label>
          <Select v-model="dialogEdit.form.estado_pago" :options="ESTADO_PAGO_OPCIONES"
            optionLabel="label" optionValue="value" placeholder="Sin definir" showClear class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Enlace en Drive</label>
          <InputText v-model="dialogEdit.form.enlace_drive"
            placeholder="https://drive.google.com/…" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogEdit.visible = false" />
        <Button label="Guardar cambios" :loading="guardandoContrato" @click="saveContrato" :style="`background:${DIALOG_EDIT_COLOR[dialogEdit.tipo]};border-color:${DIALOG_EDIT_COLOR[dialogEdit.tipo]}`">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

    <!-- ── Dialog nuevo pago ─────────────────────────────────────────────────── -->
    <Dialog v-model:visible="dialogPago.visible" modal header="Registrar pago" :style="{ width: '420px' }"
      :breakpoints="{ '500px': '95vw' }">
      <div class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Mes</label>
            <Select v-model="dialogPago.form.mes" :options="MESES_OPCIONES"
              optionLabel="label" optionValue="value" placeholder="Mes" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">Año</label>
            <InputNumber v-model="dialogPago.form.año" :useGrouping="false"
              :min="2020" :max="2099" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Valor pagado (COP)</label>
          <InputNumber v-model="dialogPago.form.valor_pagado" mode="currency" currency="COP"
            locale="es-CO" :maxFractionDigits="0" class="w-full" placeholder="$ 0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Estado</label>
          <Select v-model="dialogPago.form.estado" :options="ESTADO_PAGO_OPCIONES"
            optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Enlace de factura (Drive)</label>
          <InputText v-model="dialogPago.form.enlace_factura" placeholder="https://drive.google.com/…" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="dialogPago.visible = false" />
        <Button label="Registrar" :loading="guardandoPago" @click="guardarPago">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ArrowLeftIcon, BoxIcon, BuildingIcon, CalculatorIcon, CalendarIcon, CheckIcon, ChevronDownIcon, CirclePlusIcon, CreditCardIcon, DatabaseIcon, DollarSignIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, FileIcon, FileInputIcon, FileOutputIcon, FileSpreadsheetIcon, FileTextIcon, FilterIcon, GaugeIcon, HouseIcon, LinkIcon, LockIcon, MonitorIcon, NetworkIcon, PencilIcon, PlusIcon, ShieldIcon, TableIcon, Trash2Icon, UserIcon, UsersIcon, WifiIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import { toast } from 'vue-sonner'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { formatCOP } from '~/utils/currency'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'

const contratosServicioService = new ContratosServicioService()
const proyectosService = new ProyectosService()
const route = useRoute()
const router = useRouter()

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES_NOMBRES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const MESES_OPCIONES = MESES_NOMBRES.slice(1).map((m, i) => ({ label: m, value: i + 1 }))

const ESTADO_PAGO_OPCIONES = [
  { label: 'Pendiente',  value: 'pendiente' },
  { label: 'Revisado',   value: 'revisado' },
  { label: 'Aprobado',   value: 'aprobado' },
]

const ESTADO_PAGO_LABELS    = { pendiente: 'Pendiente', revisado: 'Revisado', aprobado: 'Aprobado' }
const ESTADO_PAGO_SEVERITY  = { pendiente: 'danger', revisado: 'warn', aprobado: 'success' }

const CONTRATO_LABELS   = { vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación', en_revision: 'En revisión' }
const CONTRATO_SEVERITY = { vigente: 'success', vencido: 'destructive', terminado: 'default', en_renovacion: 'warning', en_revision: 'warning' }

const ESTADOS_MANT = [
  { label: 'Vigente',     value: 'vigente' },
  { label: 'Vencido',     value: 'vencido' },
  { label: 'En revisión', value: 'en_revision' },
]

const PERIODICIDADES = [
  { label: 'Mensual',    value: 'mensual' },
  { label: 'Bimestral',  value: 'bimestral' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Semestral',  value: 'semestral' },
  { label: 'Anual',      value: 'anual' },
]

const TABS_TIPOS = ['mantenimiento', 'arriendo', 'internet']
const activeIndex = ref(Math.max(0, TABS_TIPOS.indexOf(route.query.subtab)))

const DIALOG_EDIT_COLOR = { mantenimiento: '#f59e0b', arriendo: '#8b5cf6', internet: '#06b6d4' }
const DIALOG_EDIT_LABEL = { mantenimiento: 'Mantenimiento', arriendo: 'Arriendo', internet: 'Internet' }

// ── Estado reactivo ───────────────────────────────────────────────────────────
const loading          = ref(true)
const proyectoNombre   = ref('')
const guardandoPago    = ref(false)
const guardandoContrato = ref(false)
const guardandoMant      = ref(false)
const excelInputRef      = ref(null)
const ANIO_ACTUAL        = new Date().getFullYear()
const showIndexacion          = reactive({ anual: false, mensual: false })
const showIndexacionArriendo  = reactive({ anual: false, mensual: false })

const facturasCobradas   = ref([])
const facturasEmitidas   = ref([])

// ── Arrendadores (arriendo con múltiples arrendadores) ─────────────────────────
const arrendadores = ref([])
const arrendadorDialog = reactive({
  visible: false,
  modo: 'crear',
  editId: null,
  guardando: false,
  form: {
    nombre: '', valor_base: null, responsable_iva: false, activo: true,
    anticipo_pagado_desde: null, anticipo_pagado_hasta: null, observaciones: '',
  },
})

const dialogMant = reactive({
  visible: false,
  modo: 'crear',
  form: {
    contratante_nombre: '',
    prestador_nombre: '',
    fecha_inicio_om: null,
    fecha_firma_contrato: null,
    tarifa_base: null,
    tarifa_mensual: null,
    enlace_drive: '',
    estado: 'vigente',
    periodicidad_pago: 'mensual',
  },
  errores: {},
})

const contratos = reactive({ mantenimiento: null, arriendo: null, internet: null })
const pagos     = reactive({ mantenimiento: [],   arriendo: [],   internet: [] })

// ── Mapa de ubicación del servicio de Internet (solo lectura) ─────────────────
const internetMapEl = ref(null)
let internetMap = null
let internetMapRO = null

async function initInternetMap(c) {
  if (!c || c.ubicacion_lat == null || c.ubicacion_lng == null) return
  await nextTick()
  if (!internetMapEl.value || internetMap) return
  const { default: maplibregl } = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')
  if (!internetMapEl.value || internetMap) return

  internetMap = new maplibregl.Map({
    container: internetMapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [c.ubicacion_lng, c.ubicacion_lat],
    zoom: 12,
    attributionControl: false,
    interactive: false,
  })
  new maplibregl.Marker({ color: '#06b6d4' }).setLngLat([c.ubicacion_lng, c.ubicacion_lat]).addTo(internetMap)

  // El contenedor puede tener tamaño 0 si la pestaña Internet no está visible
  // todavía al crear el mapa (p.ej. TabView oculto con display:none); sin este
  // observer el canvas queda en blanco aunque luego se muestre la pestaña.
  internetMapRO = new ResizeObserver(() => internetMap?.resize())
  internetMapRO.observe(internetMapEl.value)
}

// Mapa editable dentro del diálogo "Editar" (clic para mover el marcador)
const dialogEditMapEl = ref(null)
let dialogEditMap = null
let dialogEditMarker = null
let dialogEditMapRO = null

async function initDialogEditMap() {
  if (!dialogEditMapEl.value || dialogEditMap) return
  const { default: maplibregl } = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')
  if (!dialogEditMapEl.value || dialogEditMap) return

  const centro = (dialogEdit.form.ubicacion_lat != null && dialogEdit.form.ubicacion_lng != null)
    ? [dialogEdit.form.ubicacion_lng, dialogEdit.form.ubicacion_lat]
    : [-74.297, 4.571]

  dialogEditMap = new maplibregl.Map({
    container: dialogEditMapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: centro,
    zoom: (dialogEdit.form.ubicacion_lat != null) ? 12 : 5,
    attributionControl: false,
  })

  dialogEditMarker = null
  if (dialogEdit.form.ubicacion_lat != null && dialogEdit.form.ubicacion_lng != null) {
    dialogEditMarker = new maplibregl.Marker({ color: '#06b6d4' }).setLngLat(centro).addTo(dialogEditMap)
  }

  dialogEditMap.on('click', (e) => {
    const { lng, lat } = e.lngLat
    dialogEdit.form.ubicacion_lat = Number(lat.toFixed(6))
    dialogEdit.form.ubicacion_lng = Number(lng.toFixed(6))
    if (dialogEditMarker) dialogEditMarker.setLngLat([lng, lat])
    else dialogEditMarker = new maplibregl.Marker({ color: '#06b6d4' }).setLngLat([lng, lat]).addTo(dialogEditMap)
  })

  dialogEditMapRO = new ResizeObserver(() => dialogEditMap?.resize())
  dialogEditMapRO.observe(dialogEditMapEl.value)
}

onBeforeUnmount(() => {
  internetMapRO?.disconnect()
  internetMap?.remove()
  internetMap = null
  dialogEditMapRO?.disconnect()
  dialogEditMap?.remove()
  dialogEditMap = null
})
const loadingPagos = reactive({ mantenimiento: false, arriendo: false, internet: false })

const filtros = reactive({
  mantenimiento: { año: null, mes: null },
  arriendo:      { año: null, mes: null },
  internet:      { año: null, mes: null },
})

const wizardVisible = ref(false)
const wizardTipo    = ref('mantenimiento')

const dialogEdit = reactive({
  visible: false,
  tipo: 'mantenimiento',
  form: { tarifa_base: null, fecha_firma_contrato: null, fecha_inicio: null, fecha_inicio_om: null, enlace_drive: '', estado_pago: null, periodicidad_pago: 'mensual', responsable_iva: false, plan_datos_gb: '', velocidad_mbps: null, tipo_conexion: null,
    linea_servicio: '', id_router: '', numero_kit: '', latencia_ms: null, wifi_seguridad: null, wifi_password: '', ubicacion_lat: null, ubicacion_lng: null },
})

const dialogPago = reactive({
  visible: false,
  tipo: 'mantenimiento',
  form: { mes: null, año: new Date().getFullYear(), valor_pagado: null, estado: 'pendiente', enlace_factura: '' },
})

// ── Carga inicial ─────────────────────────────────────────────────────────────
onMounted(async () => {
  const proyId = route.params.id
  try {
    const [proyRes, mantRes, arrRes, netRes] = await Promise.allSettled([
      proyectosService.obtener(proyId),
      contratosServicioService.listar({ tipo: 'mantenimiento', proyecto_id: proyId }),
      contratosServicioService.listar({ tipo: 'arriendo', proyecto_id: proyId }),
      contratosServicioService.listar({ tipo: 'internet', proyecto_id: proyId }),
    ])

    if (proyRes.status === 'fulfilled') proyectoNombre.value = proyRes.value.nombre_comercial

    contratos.mantenimiento = mantRes.status === 'fulfilled' && mantRes.value.length ? mantRes.value[0] : null
    contratos.arriendo      = arrRes.status  === 'fulfilled' && arrRes.value.length  ? arrRes.value[0]  : null
    contratos.internet      = netRes.status  === 'fulfilled' && netRes.value.length  ? netRes.value[0]  : null
    await initInternetMap(contratos.internet)

    await cargarIndexacionOM()
    await cargarArrendadores()
    await cargarIndexacionArriendo()
    await loadPagos('mantenimiento')
  } catch (e) {
    toast.error('Error al cargar', { description: e.message, duration: 4000 })
  } finally {
    loading.value = false
  }
})

// ── Pagos ─────────────────────────────────────────────────────────────────────
async function loadPagos(tipo) {
  if (!contratos[tipo]) { pagos[tipo] = []; return }
  loadingPagos[tipo] = true
  try {
    pagos[tipo] = await contratosServicioService.listarPagos(contratos[tipo].id)
  } catch {
    pagos[tipo] = []
  } finally {
    loadingPagos[tipo] = false
  }
}

function onTabChange(e) {
  const tipo = TABS_TIPOS[e.index]
  // Internet no tiene tab de Pagos (PagosTabla no se renderiza para este tipo)
  if (tipo && tipo !== 'internet') loadPagos(tipo)
}

function openNuevoPago(tipo) {
  dialogPago.tipo = tipo
  dialogPago.form = { mes: null, año: new Date().getFullYear(), valor_pagado: null, estado: 'pendiente', enlace_factura: '' }
  dialogPago.visible = true
}

async function guardarPago() {
  const tipo = dialogPago.tipo
  if (!contratos[tipo]) return
  if (!dialogPago.form.mes || !dialogPago.form.año) {
    toast.warning('Completa mes y año', { duration: 2500 })
    return
  }
  guardandoPago.value = true
  try {
    await contratosServicioService.registrarPago(contratos[tipo].id, {
      mes:          dialogPago.form.mes,
      año:          dialogPago.form.año,
      valor_pagado: dialogPago.form.valor_pagado,
      estado:       dialogPago.form.estado,
      enlace_factura: dialogPago.form.enlace_factura || null,
    })
    await loadPagos(tipo)
    dialogPago.visible = false
    toast.success('Pago registrado', { duration: 2500 })
  } catch (e) {
    const msg = e.data?.detail
    const isDup = typeof msg === 'string' && msg.includes('uq_pago_servicio')
    toast.error(isDup ? 'Ya existe un pago para ese período' : 'Error al registrar', {
      description: isDup ? undefined : String(msg ?? ''),
      duration: 4000,
    })
  } finally {
    guardandoPago.value = false
  }
}

async function eliminarPago(tipo, pagoId) {
  if (!contratos[tipo]) return
  if (!confirm('¿Eliminar este pago?')) return
  try {
    await contratosServicioService.eliminarPago(contratos[tipo].id, pagoId)
    pagos[tipo] = pagos[tipo].filter(p => p.id !== pagoId)
    toast.success('Pago eliminado', { duration: 2000 })
  } catch {
    toast.error('Error al eliminar', { duration: 3000 })
  }
}

// ── Edición de contrato ───────────────────────────────────────────────────────
function openEditContrato(tipo) {
  const c = contratos[tipo]
  if (!c) return
  dialogEdit.tipo = tipo
  dialogEdit.form.tarifa_base = c.tarifa_base
  dialogEdit.form.fecha_firma_contrato = c.fecha_firma_contrato ? new Date(c.fecha_firma_contrato) : null
  dialogEdit.form.fecha_inicio = c.fecha_inicio ? new Date(c.fecha_inicio) : null
  dialogEdit.form.enlace_drive = c.enlace_drive || ''
  dialogEdit.form.estado_pago = c.estado_pago || null
  dialogEdit.form.periodicidad_pago = c.periodicidad_pago || 'mensual'
  dialogEdit.form.fecha_inicio_om = c.fecha_inicio_om ? new Date(c.fecha_inicio_om) : null
  dialogEdit.form.responsable_iva = c.responsable_iva ?? false
  dialogEdit.form.plan_datos_gb = c.plan_datos_gb || ''
  dialogEdit.form.velocidad_mbps = c.velocidad_mbps ?? null
  dialogEdit.form.tipo_conexion = c.tipo_conexion || null
  dialogEdit.form.linea_servicio = c.linea_servicio || ''
  dialogEdit.form.id_router = c.id_router || ''
  dialogEdit.form.numero_kit = c.numero_kit || ''
  dialogEdit.form.latencia_ms = c.latencia_ms ?? null
  dialogEdit.form.wifi_seguridad = c.wifi_seguridad || null
  dialogEdit.form.wifi_password = c.wifi_password || ''
  dialogEdit.form.ubicacion_lat = c.ubicacion_lat ?? null
  dialogEdit.form.ubicacion_lng = c.ubicacion_lng ?? null
  dialogEdit.visible = true
  if (tipo === 'internet') {
    dialogEditMapRO?.disconnect(); dialogEditMapRO = null
    dialogEditMap?.remove(); dialogEditMap = null
    nextTick().then(initDialogEditMap)
  }
}

async function saveContrato() {
  const tipo = dialogEdit.tipo
  if (!contratos[tipo]) return
  guardandoContrato.value = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      enlace_drive: dialogEdit.form.enlace_drive?.trim() || null,
    }
    if (tipo !== 'internet') {
      payload.tarifa_base = dialogEdit.form.tarifa_base
      payload.estado_pago = dialogEdit.form.estado_pago || null
    }
    if (tipo === 'mantenimiento') {
      payload.fecha_inicio = toISO(dialogEdit.form.fecha_inicio)
    } else {
      payload.fecha_firma_contrato = toISO(dialogEdit.form.fecha_firma_contrato)
    }
    if (tipo === 'arriendo') {
      payload.periodicidad_pago = dialogEdit.form.periodicidad_pago
      payload.fecha_inicio_om = toISO(dialogEdit.form.fecha_inicio_om)
      payload.responsable_iva = dialogEdit.form.responsable_iva ?? false
    }
    if (tipo === 'internet') {
      payload.plan_datos_gb = dialogEdit.form.plan_datos_gb?.trim() || null
      payload.velocidad_mbps = dialogEdit.form.velocidad_mbps ?? null
      payload.tipo_conexion = dialogEdit.form.tipo_conexion || null
      payload.linea_servicio = dialogEdit.form.linea_servicio?.trim() || null
      payload.id_router = dialogEdit.form.id_router?.trim() || null
      payload.numero_kit = dialogEdit.form.numero_kit?.trim() || null
      payload.latencia_ms = dialogEdit.form.latencia_ms ?? null
      payload.wifi_seguridad = dialogEdit.form.wifi_seguridad || null
      payload.wifi_password = dialogEdit.form.wifi_password?.trim() || null
      payload.ubicacion_lat = dialogEdit.form.ubicacion_lat ?? null
      payload.ubicacion_lng = dialogEdit.form.ubicacion_lng ?? null
    }
    const data = await contratosServicioService.actualizar(contratos[tipo].id, payload)
    contratos[tipo] = { ...contratos[tipo], ...data }
    if (tipo === 'arriendo') await cargarIndexacionArriendo()
    if (tipo === 'internet') {
      internetMapRO?.disconnect(); internetMapRO = null
      internetMap?.remove(); internetMap = null
      await initInternetMap(contratos.internet)
    }
    dialogEdit.visible = false
    toast.success('Contrato actualizado', { duration: 2500 })
  } catch (e) {
    toast.error('Error al guardar', { description: e.data?.detail, duration: 3000 })
  } finally {
    guardandoContrato.value = false
  }
}

// ── Wizard ────────────────────────────────────────────────────────────────────
function openWizard(tipo) {
  wizardTipo.value = tipo
  wizardVisible.value = true
}

async function onContratoCreado() {
  const tipo = wizardTipo.value
  const proyId = route.params.id
  try {
    const data = await contratosServicioService.listar({ tipo, proyecto_id: proyId })
    contratos[tipo] = data.length ? data[0] : null
    if (tipo === 'arriendo') {
      await cargarArrendadores()
      await cargarIndexacionArriendo()
    }
    if (tipo === 'internet') await initInternetMap(contratos.internet)
    await loadPagos(tipo)
  } catch { /* ignore */ }
}

// ── Mantenimiento modal (crear / editar) ──────────────────────────────────────
function openMantenimientoDialog(modo) {
  dialogMant.modo = modo
  dialogMant.errores = {}
  if (modo === 'editar' && contratos.mantenimiento) {
    const c = contratos.mantenimiento
    dialogMant.form.contratante_nombre = c.contratante_nombre || ''
    dialogMant.form.prestador_nombre   = c.prestador_nombre   || ''
    dialogMant.form.fecha_inicio_om    = c.fecha_inicio_om ? new Date(c.fecha_inicio_om)
                                        : (c.fecha_inicio ? new Date(c.fecha_inicio) : null)
    dialogMant.form.fecha_firma_contrato = c.fecha_firma_contrato ? new Date(c.fecha_firma_contrato) : null
    dialogMant.form.tarifa_base        = c.tarifa_base ?? null
    dialogMant.form.tarifa_mensual     = c.tarifa_mensual ?? (c.tarifa_base != null ? Math.round(c.tarifa_base / 12) : null)
    dialogMant.form.enlace_drive       = c.enlace_drive || ''
    dialogMant.form.estado             = c.estado || 'vigente'
    dialogMant.form.periodicidad_pago  = c.periodicidad_pago || 'mensual'
  } else {
    dialogMant.form.contratante_nombre = ''
    dialogMant.form.prestador_nombre   = ''
    dialogMant.form.fecha_inicio_om    = null
    dialogMant.form.fecha_firma_contrato = null
    dialogMant.form.tarifa_base        = null
    dialogMant.form.tarifa_mensual     = null
    dialogMant.form.enlace_drive       = ''
    dialogMant.form.estado             = 'vigente'
    dialogMant.form.periodicidad_pago  = 'mensual'
  }
  dialogMant.visible = true
}

function validarFormMant() {
  const e = {}
  if (!dialogMant.form.contratante_nombre?.trim()) e.contratante_nombre = 'Campo requerido'
  if (!dialogMant.form.prestador_nombre?.trim())   e.prestador_nombre   = 'Campo requerido'
  if (!dialogMant.form.fecha_inicio_om)             e.fecha_inicio_om    = 'Campo requerido'
  if (dialogMant.form.tarifa_base == null)          e.tarifa_base        = 'Campo requerido'
  if (!dialogMant.form.estado)                      e.estado             = 'Campo requerido'
  const link = dialogMant.form.enlace_drive?.trim()
  if (link && !link.startsWith('http')) e.enlace_drive = 'Debe ser una URL válida (debe iniciar con http)'
  dialogMant.errores = e
  return Object.keys(e).length === 0
}

async function saveMantenimiento() {
  if (!validarFormMant()) return
  guardandoMant.value = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      contratante_nombre: dialogMant.form.contratante_nombre.trim(),
      prestador_nombre:   dialogMant.form.prestador_nombre.trim(),
      fecha_inicio_om:    toISO(dialogMant.form.fecha_inicio_om),
      fecha_firma_contrato: toISO(dialogMant.form.fecha_firma_contrato),
      tarifa_base:        dialogMant.form.tarifa_base,
      tarifa_mensual:     dialogMant.form.tarifa_mensual ?? null,
      enlace_drive:       dialogMant.form.enlace_drive?.trim() || null,
      estado:             dialogMant.form.estado,
      periodicidad_pago:  dialogMant.form.periodicidad_pago,
    }
    if (dialogMant.modo === 'crear') {
      const proyId = route.params.id
      payload.servicio_aplica = 'mantenimiento'
      payload.proyecto_id     = Number(proyId)
      await contratosServicioService.crear(payload)
      const data = await contratosServicioService.listar({ tipo: 'mantenimiento', proyecto_id: proyId })
      contratos.mantenimiento = data.length ? data[0] : null
      await loadPagos('mantenimiento')
    } else {
      const data = await contratosServicioService.actualizar(contratos.mantenimiento.id, payload)
      contratos.mantenimiento = { ...contratos.mantenimiento, ...data }
    }
    // Recalcular la indexación automática (cambió tarifa/fecha inicio O&M)
    await cargarIndexacionOM()
    dialogMant.visible = false
    toast.success(dialogMant.modo === 'crear' ? 'Contrato creado' : 'Contrato actualizado', {
      duration: 2500,
    })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    guardandoMant.value = false
  }
}

// ── Importación desde Excel ───────────────────────────────────────────────────
function triggerExcelInput() {
  excelInputRef.value?.click()
}

async function cargarDesdeExcel(event) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''
  try {
    const buffer = await file.arrayBuffer()
    const XLSX   = await import('xlsx')
    const wb     = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' })

    const proyNombre = proyectoNombre.value?.trim().toLowerCase()
    const fila = rows.find(r => {
      const val = r['Proyecto'] ?? r['proyecto'] ?? r['PROYECTO'] ?? ''
      return String(val).trim().toLowerCase() === proyNombre
    })

    if (!fila) {
      toast.error('Proyecto no encontrado en el Excel', {
        description: `No se encontró "${proyectoNombre.value}" en la columna "Proyecto". Verifica el archivo e intenta de nuevo.`,
        duration: 6000,
      })
      return
    }

    const parseNum = v => {
      if (v == null || v === '') return null
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''))
      return isNaN(n) ? null : n
    }

    const parseFecha = v => {
      if (!v) return null
      if (v instanceof Date) return v
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }

    dialogMant.form.contratante_nombre = String(fila['Contratante'] ?? '').trim()
    dialogMant.form.prestador_nombre   = String(fila['Prestador'] ?? '').trim()
    dialogMant.form.fecha_inicio_om    = parseFecha(fila['Fecha de inicio O&M'])
    dialogMant.form.tarifa_base        = parseNum(fila['Valor O&M Anual (BASE)'])
    const mensualExcel                 = parseNum(fila['Valor mensual'])
    dialogMant.form.tarifa_mensual     = mensualExcel ?? (dialogMant.form.tarifa_base != null ? Math.round(dialogMant.form.tarifa_base / 12) : null)
    dialogMant.form.enlace_drive       = String(fila['Enlace del contrato en Drive'] ?? '').trim()
    dialogMant.form.estado             = contratos.mantenimiento?.estado ?? 'vigente'
    dialogMant.errores                 = {}
    dialogMant.modo                    = contratos.mantenimiento ? 'editar' : 'crear'
    dialogMant.visible                 = true

    toast.info('Datos cargados desde Excel', {
      description: 'Revisa los datos y confirma para guardar.',
      duration: 4000,
    })
  } catch (e) {
    toast.error('Error al leer el Excel', { description: e.message, duration: 4000 })
  }
}

// ── Indexación O&M ────────────────────────────────────────────────────────────
function getValorVigente(filas) {
  if (!filas || !filas.length) return null
  return filas.find(f => f.anio === ANIO_ACTUAL) ?? filas[filas.length - 1]
}

// Indexación O&M automática: la calcula el backend (mismo motor que Costos:
// aniversario desde la Fecha de inicio O&M + IPC por año). Reemplaza la carga
// manual por JSON. Inyecta la serie en el contrato para que la usen las tablas
// y el valor vigente de la ficha.
async function cargarIndexacionOM() {
  if (!contratos.mantenimiento?.id) return
  try {
    const data = await contratosServicioService.obtenerIndexacionOm(contratos.mantenimiento.id)
    contratos.mantenimiento.indexacion_anual   = data.anual   || []
    contratos.mantenimiento.indexacion_mensual = data.mensual || []
  } catch {
    contratos.mantenimiento.indexacion_anual   = []
    contratos.mantenimiento.indexacion_mensual = []
  }
}

// Indexación de Arriendo automática: la calcula el backend (mismo motor que
// Costos: aniversario desde la Fecha de contrato + IPC por año). Reemplaza la
// carga manual. Inyecta la serie en el contrato para que la usen las tablas
// y el valor vigente de la ficha.
async function cargarIndexacionArriendo() {
  if (!contratos.arriendo?.id) return
  try {
    const data = await contratosServicioService.obtenerIndexacionArriendo(contratos.arriendo.id)
    contratos.arriendo.indexacion_anual   = data.anual   || []
    contratos.arriendo.indexacion_mensual = data.mensual || []
  } catch {
    contratos.arriendo.indexacion_anual   = []
    contratos.arriendo.indexacion_mensual = []
  }
  // Indexación individual por cada arrendador (usa su propio valor_base)
  await Promise.all(arrendadores.value.map(async (a) => {
    try {
      const data = await contratosServicioService.obtenerIndexacionArriendo(contratos.arriendo.id, a.id)
      a.indexacion_anual   = data.anual   || []
      a.indexacion_mensual = data.mensual || []
    } catch {
      a.indexacion_anual   = []
      a.indexacion_mensual = []
    }
  }))
}

// ── Arrendadores: CRUD ────────────────────────────────────────────────────────
async function cargarArrendadores() {
  if (!contratos.arriendo?.id) { arrendadores.value = []; return }
  try {
    arrendadores.value = await contratosServicioService.listarArrendadores(contratos.arriendo.id)
  } catch {
    arrendadores.value = []
  }
}

function openArrendadorDialog(modo, arrendador = null) {
  arrendadorDialog.modo = modo
  arrendadorDialog.editId = arrendador?.id ?? null
  arrendadorDialog.form.nombre = arrendador?.nombre || ''
  arrendadorDialog.form.valor_base = arrendador?.valor_base ?? null
  arrendadorDialog.form.responsable_iva = arrendador?.responsable_iva ?? false
  arrendadorDialog.form.activo = arrendador?.activo ?? true
  arrendadorDialog.form.anticipo_pagado_desde = arrendador?.anticipo_pagado_desde ? new Date(arrendador.anticipo_pagado_desde) : null
  arrendadorDialog.form.anticipo_pagado_hasta = arrendador?.anticipo_pagado_hasta ? new Date(arrendador.anticipo_pagado_hasta) : null
  arrendadorDialog.form.observaciones = arrendador?.observaciones || ''
  arrendadorDialog.visible = true
}

async function guardarArrendador() {
  if (!contratos.arriendo?.id) return
  if (!arrendadorDialog.form.nombre?.trim()) {
    toast.error('El nombre es obligatorio', { duration: 3000 })
    return
  }
  arrendadorDialog.guardando = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      nombre: arrendadorDialog.form.nombre.trim(),
      valor_base: arrendadorDialog.form.valor_base,
      responsable_iva: arrendadorDialog.form.responsable_iva ?? false,
      activo: arrendadorDialog.form.activo ?? true,
      anticipo_pagado_desde: toISO(arrendadorDialog.form.anticipo_pagado_desde),
      anticipo_pagado_hasta: toISO(arrendadorDialog.form.anticipo_pagado_hasta),
      observaciones: arrendadorDialog.form.observaciones?.trim() || null,
    }
    if (arrendadorDialog.modo === 'editar' && arrendadorDialog.editId) {
      await contratosServicioService.actualizarArrendador(arrendadorDialog.editId, payload)
    } else {
      await contratosServicioService.crearArrendador(contratos.arriendo.id, payload)
    }
    arrendadorDialog.visible = false
    await cargarArrendadores()
    await cargarIndexacionArriendo()
    toast.success('Arrendador guardado', { duration: 2500 })
  } catch (e) {
    toast.error('Error al guardar arrendador', { description: e.data?.detail, duration: 3500 })
  } finally {
    arrendadorDialog.guardando = false
  }
}

async function eliminarArrendador(arrendador) {
  if (!confirm(`¿Eliminar al arrendador "${arrendador.nombre}"?`)) return
  try {
    await contratosServicioService.eliminarArrendador(arrendador.id)
    await cargarArrendadores()
    await cargarIndexacionArriendo()
    toast.success('Arrendador eliminado', { duration: 2500 })
  } catch (e) {
    toast.error('Error al eliminar', {
      description: e.data?.detail || 'No se pudo eliminar el arrendador',
      duration: 3500,
    })
  }
}

// ── Helpers de formato ────────────────────────────────────────────────────────
function formatFecha(f) {
  if (!f) return '—'
  return String(f).slice(0, 10)
}
</script>

<!-- ── Componentes inline ─────────────────────────────────────────────────────── -->
<script>
// Este bloque define componentes con Options API + `template:` como string
// (compilados en runtime, ver `nuxt.config.ts` -> `vue.runtimeCompiler`): el
// auto-import de Nuxt no los alcanza, así que sus dependencias se registran a
// mano en `components: {...}` y por eso necesitan import explícito aquí.
import { computed, ref, toRefs } from 'vue'
import { GBadge } from '~/components/gandalf/base/badge'
import { formatCOP } from '~/utils/currency'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'

const MESES_NOMBRES_STATIC = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const MESES_OPCIONES_STATIC = MESES_NOMBRES_STATIC.slice(1).map((m, i) => ({ label: m, value: i + 1 }))

const ESTADO_PAGO_LABELS_S   = { pendiente: 'Pendiente', revisado: 'Revisado', aprobado: 'Aprobado' }
const ESTADO_PAGO_SEVERITY_S = { pendiente: 'destructive', revisado: 'warning', aprobado: 'success' }

const AÑOS_STATIC = (() => {
  const cur = new Date().getFullYear()
  return Array.from({ length: cur - 2020 + 2 }, (_, i) => 2020 + i)
})()

// Campo con ícono + etiqueta + valor
const InfoIcon = {
  props: {
    /** Componente de `@lucide/vue`. */
    icon: { type: [Object, Function], default: null },
    color: String,
    label: String, value: [String, Number],
  },
  setup(props) {
    return { ...toRefs(props) }
  },
  template: `
    <div class="flex items-start gap-2.5 min-w-0">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        :style="'background:' + color + '18'">
        <component :is="icon" class="text-xs size-[1em]" :style="'color:' + color" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-medium leading-none mb-0.5" style="color:#9b89b5">{{ label }}</p>
        <p class="text-sm font-medium truncate" style="color:#2C2039">{{ value ?? '—' }}</p>
      </div>
    </div>
  `,
}

// Badge de estado de pago con etiqueta
const InfoBadge = {
  components: { GBadge, CreditCardIcon },
  props: { color: String, label: String, estado: String },
  setup(props) {
    return { ...toRefs(props), ESTADO_PAGO_LABELS_S, ESTADO_PAGO_SEVERITY_S }
  },
  template: `
    <div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        :style="'background:' + color + '18'">
        <CreditCardIcon class="text-xs size-[1em]" :style="'color:' + color" />
      </div>
      <div>
        <p class="text-xs font-medium leading-none mb-1" style="color:#9b89b5">{{ label }}</p>
        <GBadge v-if="estado" :color="ESTADO_PAGO_SEVERITY_S[estado]">{{ ESTADO_PAGO_LABELS_S[estado] }}</GBadge>
        <span v-else class="text-sm" style="color:#9ca3af">—</span>
      </div>
    </div>
  `,
}

// Contraseña wifi enmascarada, con botón para revelarla
const InfoSecret = {
  props: { color: String, label: String, value: String },
  components: { EyeIcon, EyeOffIcon, LockIcon },
  setup(props) {
    const visible = ref(false)
    return { ...toRefs(props), visible }
  },
  template: `
    <div class="flex items-start gap-2.5 min-w-0">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        :style="'background:' + color + '18'">
        <LockIcon class="text-xs size-[1em]" :style="'color:' + color" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-medium leading-none mb-0.5" style="color:#9b89b5">{{ label }}</p>
        <p v-if="!value" class="text-sm font-medium" style="color:#2C2039">—</p>
        <button v-else type="button" class="text-sm font-medium inline-flex items-center gap-1"
          style="background:none;border:none;cursor:pointer;padding:0;color:#2C2039"
          @click="visible = !visible">
          {{ visible ? value : '••••••••' }}
          <EyeOffIcon v-if="visible" class="text-xs size-[1em]" style="color:#9b89b5" />
          <EyeIcon v-else class="text-xs size-[1em]" style="color:#9b89b5" />
        </button>
      </div>
    </div>
  `,
}

// Enlace a Drive con ícono clicable (+ botón "Agregar enlace" si editable y vacío)
const InfoLink = {
  props: { color: String, label: String, href: String, editable: Boolean },
  emits: ['editar'],
  components: { CirclePlusIcon, ExternalLinkIcon, LinkIcon },
  setup(props) {
    return { ...toRefs(props) }
  },
  template: `
    <div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        :style="'background:' + color + '18'">
        <LinkIcon class="text-xs size-[1em]" :style="'color:' + color" />
      </div>
      <div>
        <p class="text-xs font-medium leading-none mb-0.5" style="color:#9b89b5">{{ label }}</p>
        <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer"
          class="text-sm font-medium hover:underline inline-flex items-center gap-1"
          style="color:#915BD8">
          <ExternalLinkIcon class="text-xs size-[1em]" />
          Ver en Drive
        </a>
        <template v-else>
          <button v-if="editable" type="button"
            class="text-xs font-medium inline-flex items-center gap-1 hover:underline transition-opacity"
            style="background:none;border:none;cursor:pointer;padding:0;color:#9b89b5"
            @click="$emit('editar')">
            <CirclePlusIcon class="text-xs size-[1em]" />
            Agregar enlace
          </button>
          <span v-else class="text-sm" style="color:#9ca3af">—</span>
        </template>
      </div>
    </div>
  `,
}

// Tabla de pagos mensuales reutilizable
const PagosTabla = {
  components: { GBadge, Button, DataTable, Column, Select, ExternalLinkIcon, FilterIcon, PlusIcon, TableIcon, Trash2Icon, XIcon },
  emits: ['open-pago', 'eliminar'],
  props: {
    tipo: String,
    color: String,
    contratoId: { type: Number, default: null },
    pagos: { type: Array, default: () => [] },
    loadingPagos: Boolean,
    filtros: { type: Object, default: () => ({ año: null, mes: null }) },
  },
  setup(props) {
    // `filtros` es un objeto pasado por el padre y se muta directamente (igual
    // que hacía `this.filtros.año = null`): `toRefs` expone un ref hacia la
    // misma prop reactiva, no una copia, así que la mutación sigue viéndola el
    // padre.
    const { filtros } = toRefs(props)

    const pagosFiltrados = computed(() => {
      let result = props.pagos || []
      if (filtros.value.año) result = result.filter(p => p.año === filtros.value.año)
      if (filtros.value.mes) result = result.filter(p => p.mes === filtros.value.mes)
      return result
    })
    const hayFiltros = computed(() => filtros.value.año || filtros.value.mes)

    function limpiar() {
      filtros.value.año = null
      filtros.value.mes = null
    }
    return {
      ...toRefs(props),
      MESES_NOMBRES_STATIC,
      MESES_OPCIONES_STATIC,
      ESTADO_PAGO_LABELS_S,
      ESTADO_PAGO_SEVERITY_S,
      AÑOS_STATIC,
      pagosFiltrados,
      hayFiltros,
      limpiar,
      formatCOP,
    }
  },
  template: `
    <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#e5e7eb">
      <!-- Header de la tabla -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <TableIcon class="text-sm size-[1em]" :style="'color:' + color" />
          <span class="text-sm font-semibold" style="color:#2C2039">Historial de pagos</span>
        </div>
        <Button v-if="contratoId" label="Registrar pago" size="small" :style="'background:' + color + ';border-color:' + color" @click="$emit('open-pago')">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <!-- Filtros -->
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-50 bg-gray-50/60">
        <div class="flex items-center gap-1.5">
          <FilterIcon class="text-xs text-gray-400 size-[1em]" />
          <span class="text-xs text-gray-400 font-medium">Filtrar por:</span>
        </div>
        <Select v-model="filtros.año" :options="AÑOS_STATIC" placeholder="Año"
          showClear class="text-sm" style="height:32px;min-width:90px" />
        <Select v-model="filtros.mes" :options="MESES_OPCIONES_STATIC"
          optionLabel="label" optionValue="value" placeholder="Mes"
          showClear class="text-sm" style="height:32px;min-width:110px" />
        <Button v-if="hayFiltros" label="Limpiar" text severity="secondary" size="small" @click="limpiar">
          <template #icon><XIcon class="size-[1em]" /></template>
        </Button>
        <span v-if="hayFiltros" class="text-xs text-gray-400 ml-auto">
          {{ pagosFiltrados.length }} resultado{{ pagosFiltrados.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Tabla -->
      <DataTable :value="pagosFiltrados" :loading="loadingPagos" stripedRows
        class="text-sm" rowHover
        emptyMessage="Sin pagos registrados para este período.">
        <Column header="Mes" style="width:120px">
          <template #body="{ data }">
            <span class="font-medium" style="color:#2C2039">{{ MESES_NOMBRES_STATIC[data.mes] }}</span>
          </template>
        </Column>
        <Column field="año" header="Año" style="width:80px">
          <template #body="{ data }">
            <span class="font-mono text-sm">{{ data.año }}</span>
          </template>
        </Column>
        <Column header="Valor pagado" style="width:150px">
          <template #body="{ data }">
            <span class="font-semibold tabular-nums" style="color:#2C2039">
              {{ formatCOP(data.valor_pagado) }}
            </span>
          </template>
        </Column>
        <Column header="Estado" style="width:130px">
          <template #body="{ data }">
            <GBadge :color="ESTADO_PAGO_SEVERITY_S[data.estado]">{{ ESTADO_PAGO_LABELS_S[data.estado] }}</GBadge>
          </template>
        </Column>
        <Column header="Factura" style="width:90px" bodyClass="text-center">
          <template #body="{ data }">
            <a v-if="data.enlace_factura" :href="data.enlace_factura"
              target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              style="color:#915BD8">
              <ExternalLinkIcon class="size-[1em]" />
              Ver
            </a>
            <span v-else class="text-gray-300 text-sm">—</span>
          </template>
        </Column>
        <Column style="width:50px" bodyClass="text-right">
          <template #body="{ data }">
            <Button text severity="danger" size="small" @click="$emit('eliminar', data.id)" v-tooltip.left="'Eliminar'">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </div>
  `,
}

// Acordeón desplegable con animación suave
const Acordeon = {
  props: {
    titulo: String,
    /** Componente de `@lucide/vue`. */
    icono: { type: [Object, Function], default: null },
    color: { type: String, default: '#f59e0b' },
    count: { type: Number, default: 0 },
  },
  components: { ChevronDownIcon },
  setup(props) {
    const abierto = ref(false)
    return { ...toRefs(props), abierto }
  },
  template: `
    <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#e5e7eb">
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors text-left"
        @click="abierto = !abierto">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            :style="'background:' + color + '18'">
            <component :is="icono" class="text-xs size-[1em]" :style="'color:' + color" />
          </div>
          <span class="text-sm font-semibold" style="color:#2C2039">{{ titulo }}</span>
          <span class="inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5 leading-none"
            :style="'background:' + color + '15; color:' + color">{{ count }}</span>
        </div>
        <ChevronDownIcon class="text-xs text-gray-400 transition-transform duration-200 size-[1em]" :style="abierto ? 'transform:rotate(180deg)' : ''" />
      </button>
      <transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div v-if="abierto" class="border-t border-gray-100">
          <slot />
        </div>
      </transition>
    </div>
  `,
}

// Acordeón 1: Facturas cobradas
const FacturasCobradas = {
  components: { DataTable, Column, Select, Acordeon, FileIcon, FilterIcon, XIcon },
  props: {
    datos: { type: Array, default: () => [] },
    proyectoNombre: String,
  },
  setup(props) {
    const filtroAño = ref(null)
    const filtroMes = ref(null)

    const datosFiltrados = computed(() => {
      let r = props.datos
      if (filtroAño.value) r = r.filter(f => f.anio === filtroAño.value)
      if (filtroMes.value) r = r.filter(f => f.mes === filtroMes.value)
      return r
    })
    const hayFiltros = computed(() => filtroAño.value || filtroMes.value)

    function limpiarFiltros() { filtroAño.value = null; filtroMes.value = null }

    return {
      ...toRefs(props),
      filtroAño,
      filtroMes,
      AÑOS_STATIC,
      MESES_OPCIONES_STATIC,
      MESES_NOMBRES_STATIC,
      datosFiltrados,
      hayFiltros,
      limpiarFiltros,
      formatCOP,
    }
  },
  template: `
    <Acordeon titulo="Facturas cobradas" :icono="FileInputIcon" color="#f59e0b" :count="datos.length">
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 bg-gray-50/60 border-b border-gray-100">
        <div class="flex items-center gap-1.5">
          <FilterIcon class="text-xs text-gray-400 size-[1em]" />
          <span class="text-xs text-gray-400 font-medium">Filtrar por:</span>
        </div>
        <Select v-model="filtroAño" :options="AÑOS_STATIC" placeholder="Año"
          showClear class="text-sm" style="height:32px;min-width:90px" />
        <Select v-model="filtroMes" :options="MESES_OPCIONES_STATIC"
          optionLabel="label" optionValue="value" placeholder="Mes"
          showClear class="text-sm" style="height:32px;min-width:110px" />
        <button v-if="hayFiltros" type="button"
          class="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          @click="limpiarFiltros">
          <XIcon class="text-xs size-[1em]" /> Limpiar
        </button>
        <span v-if="hayFiltros" class="text-xs text-gray-400 ml-auto">
          {{ datosFiltrados.length }} resultado{{ datosFiltrados.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <DataTable :value="datosFiltrados" stripedRows rowHover class="text-sm"
        emptyMessage="Sin facturas cobradas registradas.">
        <Column header="Mes" style="min-width:100px">
          <template #body="{ data }">
            <span class="font-medium" style="color:#2C2039">{{ MESES_NOMBRES_STATIC[data.mes] ?? data.mes }}</span>
          </template>
        </Column>
        <Column field="proyecto" header="Proyecto" style="min-width:130px" />
        <Column field="inversionista" header="Inversionista" style="min-width:130px" />
        <Column header="Monto" style="min-width:140px">
          <template #body="{ data }">
            <span class="font-semibold tabular-nums" style="color:#2C2039">{{ formatCOP(data.monto) }}</span>
          </template>
        </Column>
        <Column field="nroFactura" header="N° Factura" style="min-width:110px" />
        <Column header="Soporte" style="width:80px" bodyClass="text-center">
          <template #body="{ data }">
            <a v-if="data.soporteUrl" :href="data.soporteUrl" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-amber-50"
              style="color:#f59e0b" title="Ver soporte">
              <FileIcon class="text-sm size-[1em]" />
            </a>
            <span v-else class="text-gray-300 text-sm">—</span>
          </template>
        </Column>
      </DataTable>
    </Acordeon>
  `,
}

// Acordeón 2: Facturas emitidas
const FacturasEmitidas = {
  components: { DataTable, Column, Select, Acordeon, FileIcon, FilterIcon, XIcon },
  props: {
    datos: { type: Array, default: () => [] },
    proyectoNombre: String,
  },
  setup(props) {
    const filtroAño = ref(null)
    const filtroMes = ref(null)

    const datosFiltrados = computed(() => {
      let r = props.datos
      if (filtroAño.value) {
        r = r.filter(f => {
          const d = f.fecha ? new Date(f.fecha) : null
          return d && d.getFullYear() === filtroAño.value
        })
      }
      if (filtroMes.value) {
        r = r.filter(f => {
          const d = f.fecha ? new Date(f.fecha) : null
          return d && d.getMonth() + 1 === filtroMes.value
        })
      }
      return r
    })
    const hayFiltros = computed(() => filtroAño.value || filtroMes.value)

    function limpiarFiltros() { filtroAño.value = null; filtroMes.value = null }

    return {
      ...toRefs(props),
      filtroAño,
      filtroMes,
      AÑOS_STATIC,
      MESES_OPCIONES_STATIC,
      datosFiltrados,
      hayFiltros,
      limpiarFiltros,
      formatCOP,
    }
  },
  template: `
    <Acordeon titulo="Facturas emitidas" :icono="FileOutputIcon" color="#f59e0b" :count="datos.length">
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 bg-gray-50/60 border-b border-gray-100">
        <div class="flex items-center gap-1.5">
          <FilterIcon class="text-xs text-gray-400 size-[1em]" />
          <span class="text-xs text-gray-400 font-medium">Filtrar por:</span>
        </div>
        <Select v-model="filtroAño" :options="AÑOS_STATIC" placeholder="Año"
          showClear class="text-sm" style="height:32px;min-width:90px" />
        <Select v-model="filtroMes" :options="MESES_OPCIONES_STATIC"
          optionLabel="label" optionValue="value" placeholder="Mes"
          showClear class="text-sm" style="height:32px;min-width:110px" />
        <button v-if="hayFiltros" type="button"
          class="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          @click="limpiarFiltros">
          <XIcon class="text-xs size-[1em]" /> Limpiar
        </button>
        <span v-if="hayFiltros" class="text-xs text-gray-400 ml-auto">
          {{ datosFiltrados.length }} resultado{{ datosFiltrados.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <DataTable :value="datosFiltrados" stripedRows rowHover class="text-sm"
        emptyMessage="Sin facturas emitidas registradas.">
        <Column field="fecha" header="Fecha" style="min-width:110px" />
        <Column field="proyecto" header="Proyecto" style="min-width:130px" />
        <Column field="nroFactura" header="N° Factura" style="min-width:110px" />
        <Column header="Monto" style="min-width:140px">
          <template #body="{ data }">
            <span class="font-semibold tabular-nums" style="color:#2C2039">{{ formatCOP(data.monto) }}</span>
          </template>
        </Column>
        <Column header="Soporte" style="width:80px" bodyClass="text-center">
          <template #body="{ data }">
            <a v-if="data.soporteUrl" :href="data.soporteUrl" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-amber-50"
              style="color:#f59e0b" title="Ver soporte">
              <FileIcon class="text-sm size-[1em]" />
            </a>
            <span v-else class="text-gray-300 text-sm">—</span>
          </template>
        </Column>
      </DataTable>
    </Acordeon>
  `,
}

export default {
  components: { InfoIcon, InfoBadge, InfoLink, PagosTabla, Acordeon, FacturasCobradas, FacturasEmitidas },
}
</script>
