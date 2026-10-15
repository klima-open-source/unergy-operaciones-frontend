<template>
  <div class="space-y-5">

    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <!-- Dentro de la ficha del proyecto (pestaña Servicios) sobran las migas. -->
    <div v-if="!embebido" class="flex items-center gap-2">
      <Button variant="ghost" size="icon-sm" class="-ml-1" @click="$router.back()"><ArrowLeftIcon class="size-4" /></Button>
      <div>
        <p class="text-xs leading-none mb-0.5 text-muted-foreground">
          <span class="cursor-pointer hover:underline"
            @click="$router.push(`/proyectos/${pid}`)">
            {{ proyectoNombre || '…' }}
          </span>
          <span class="mx-1.5">›</span>
          <span>Servicios</span>
          <span class="mx-1.5">›</span>
          <span class="font-medium text-foreground">Operación</span>
        </p>
        <h2 class="text-lg font-bold text-foreground">Operación</h2>
      </div>
    </div>

    <!-- ── Loading ───────────────────────────────────────────────────────────── -->
    <div v-if="loading" class="flex justify-center py-20">
      <Spinner class="size-8" />
    </div>

    <!-- ── Tabs ──────────────────────────────────────────────────────────────── -->
    <!-- force-mount: el mapa de Internet se crea al cargar aunque su pestaña no se vea
         (ver el ResizeObserver de `initInternetMap`). -->
    <GTabs v-else v-model="pestana">
      <GTabsList v-if="!contratoId">
        <GTabsTrigger value="mantenimiento"><WrenchIcon class="size-3" /> Mantenimiento</GTabsTrigger>
        <GTabsTrigger value="arriendo"><HouseIcon class="size-3" /> Arriendos</GTabsTrigger>
        <GTabsTrigger value="internet"><WifiIcon class="size-3" /> Internet</GTabsTrigger>
      </GTabsList>

      <!-- ══════════ MANTENIMIENTO ══════════ -->
      <GTabsContent value="mantenimiento" force-mount class="data-[state=inactive]:hidden">
        <div class="space-y-5 pt-3">

          <!-- Info card -->
          <template v-if="contratos.mantenimiento">
            <div class="rounded-xl border bg-card p-5 border-warning/25">
              <!-- Header -->
              <div class="flex items-start justify-between mb-4 gap-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <div class="size-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-warning/15">
                    <WrenchIcon class="size-4 text-warning" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground leading-none mb-0.5">Contrato de Mantenimiento O&amp;M</p>
                    <span class="text-sm font-semibold text-foreground">{{ proyectoNombre }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <GBadge :color="CONTRATO_SEVERITY[contratos.mantenimiento.estado]">{{ CONTRATO_LABELS[contratos.mantenimiento.estado] }}</GBadge>
<Button v-if="embebido && !contratoId" variant="ghost" size="sm" as-child><NuxtLink :to="`/contratos/${contratos.mantenimiento.id}`"><ExternalLinkIcon class="size-4" /> Abrir ficha</NuxtLink></Button>
                  <Button variant="ghost" size="sm" @click="openMantenimientoDialog('editar')"><PencilIcon class="size-4" /> Editar</Button>
                  <Button variant="outline" size="sm" @click="triggerExcelInput"><FileSpreadsheetIcon class="size-4" /> Cargar desde Excel</Button>
                  <input ref="excelInputRef" type="file" accept=".xlsx,.xls" class="hidden"
                    @change="cargarDesdeExcel" />
                </div>
              </div>
              <!-- Mini-cards grid -->
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <!-- Contratante -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <UserIcon class="size-3 text-warning" />Contratante
                  </p>
                  <p class="text-sm font-semibold leading-snug text-foreground">
                    {{ contratos.mantenimiento.contratante_nombre || '—' }}
                  </p>
                </div>
                <!-- Prestador -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <BuildingIcon class="size-3 text-warning" />Prestador
                  </p>
                  <p class="text-sm font-semibold leading-snug text-foreground">
                    {{ contratos.mantenimiento.prestador_nombre || '—' }}
                  </p>
                </div>
                <!-- Fecha inicio -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <CalendarIcon class="size-3 text-warning" />Fecha de inicio O&amp;M
                  </p>
                  <p class="text-sm font-semibold text-foreground">
                    {{ formatFecha(contratos.mantenimiento.fecha_inicio_om || contratos.mantenimiento.fecha_inicio) || '—' }}
                  </p>
                </div>
                <!-- Valor anual -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <DollarSignIcon class="size-3 text-warning" />Valor O&amp;M Anual (BASE)
                  </p>
                  <p class="text-base font-bold text-warning">
                    {{ formatCOP(getValorVigente(contratos.mantenimiento.indexacion_anual)?.valor ?? contratos.mantenimiento.tarifa_base) || '—' }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer text-warning"
                   
                    @click="showIndexacion.anual = !showIndexacion.anual">
                    <ChevronDownIcon :class="showIndexacion.anual ? 'rotate-180' : ''" class="transition-transform duration-200 size-3" />
                    {{ showIndexacion.anual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Valor mensual -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <CalculatorIcon class="size-3 text-warning" />Valor mensual
                  </p>
                  <p class="text-base font-bold text-warning">
                    {{ formatCOP(getValorVigente(contratos.mantenimiento.indexacion_mensual)?.valor ?? contratos.mantenimiento.tarifa_mensual ?? (contratos.mantenimiento.tarifa_base != null ? Math.round(contratos.mantenimiento.tarifa_base / 12) : null)) || '—' }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer text-warning"
                   
                    @click="showIndexacion.mensual = !showIndexacion.mensual">
                    <ChevronDownIcon :class="showIndexacion.mensual ? 'rotate-180' : ''" class="transition-transform duration-200 size-3" />
                    {{ showIndexacion.mensual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Enlace Drive -->
                <div class="rounded-lg p-3.5 bg-warning/10 border border-warning/30">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-warning">
                    <FileTextIcon class="size-3 text-warning" />Contrato en Drive
                  </p>
                  <a v-if="contratos.mantenimiento.enlace_drive && contratos.mantenimiento.enlace_drive.startsWith('http')"
                     :href="contratos.mantenimiento.enlace_drive" target="_blank" rel="noopener"
                     class="text-sm font-semibold flex items-center gap-1.5 hover:underline text-warning">
                    <ExternalLinkIcon class="size-3" />Ver contrato
                  </a>
                  <button v-else @click="openMantenimientoDialog('editar')"
                    class="text-sm font-medium flex items-center gap-1.5 text-warning">
                    <CirclePlusIcon class="size-3" />Agregar enlace
                  </button>
                </div>
              </div>

              <!-- ── Paneles de indexación O&M ─────────────────────────────────── -->

              <!-- Panel ANUAL -->
              <div :class="showIndexacion.anual ? 'max-h-200' : 'max-h-0'" class="overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pt-3">
                  <div class="rounded-xl border border-warning/30 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-warning/10">
                      <span class="text-xs font-semibold text-warning">
                        <DollarSignIcon class="mr-1.5 size-3 text-warning" />Indexación anual O&M
                      </span>
                      <span class="text-xs text-muted-foreground">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-muted border-b border-border">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Valor anual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!contratos.mantenimiento.indexacion_anual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-muted-foreground">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de inicio O&amp;M (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (contratos.mantenimiento.indexacion_anual || [])" :key="fila.anio"
                          class="border-b border-border hover:bg-warning/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-warning/50' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span :class="fila.anio === ANIO_ACTUAL ? 'text-warning' : 'text-foreground'" class="font-mono font-semibold"
                               >
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-warning/15 text-warning"
                               >actual</span>
                              <ArrowLeftIcon class="size-3 text-warning" v-if="fila.anio === ANIO_ACTUAL" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-muted-foreground text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums text-foreground">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td :class="fila.anio === ANIO_ACTUAL ? 'text-warning' : 'text-foreground'" class="px-4 py-2.5 text-right font-semibold tabular-nums"
                           >
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success"
                             >
                              <CheckIcon class="size-3" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning"
                             >
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                             >
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/60 text-xs text-muted-foreground">
                      <ZapIcon class="size-3 text-warning" />
                      Calculado automáticamente desde la Fecha de inicio O&amp;M y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel MENSUAL -->
              <div :class="showIndexacion.mensual ? 'max-h-200' : 'max-h-0'" class="overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pt-3">
                  <div class="rounded-xl border border-warning/30 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-warning/10">
                      <span class="text-xs font-semibold text-warning">
                        <CalculatorIcon class="mr-1.5 size-3 text-warning" />Indexación mensual O&M
                      </span>
                      <span class="text-xs text-muted-foreground">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-muted border-b border-border">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Valor mensual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!contratos.mantenimiento.indexacion_mensual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-muted-foreground">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de inicio O&amp;M (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (contratos.mantenimiento.indexacion_mensual || [])" :key="fila.anio"
                          class="border-b border-border hover:bg-warning/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-warning/50' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span :class="fila.anio === ANIO_ACTUAL ? 'text-warning' : 'text-foreground'" class="font-mono font-semibold"
                               >
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-warning/15 text-warning"
                               >actual</span>
                              <ArrowLeftIcon class="size-3 text-warning" v-if="fila.anio === ANIO_ACTUAL" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-muted-foreground text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums text-foreground">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td :class="fila.anio === ANIO_ACTUAL ? 'text-warning' : 'text-foreground'" class="px-4 py-2.5 text-right font-semibold tabular-nums"
                           >
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success"
                             >
                              <CheckIcon class="size-3" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning"
                             >
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                             >
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/60 text-xs text-muted-foreground">
                      <ZapIcon class="size-3 text-warning" />
                      Calculado automáticamente desde la Fecha de inicio O&amp;M y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-warning/30 bg-warning/40 p-10 text-center">
              <div class="size-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-warning/15"
               >
                <WrenchIcon class="size-6 text-warning" />
              </div>
              <p class="text-sm font-medium text-muted-foreground mb-1">Sin contrato de mantenimiento</p>
              <p class="text-xs text-muted-foreground mb-4">Registra el contrato para iniciar el seguimiento de pagos</p>
              <Button size="sm" class="bg-warning border-warning" @click="openMantenimientoDialog('crear')"><PlusIcon class="size-4" /> Crear contrato</Button>
            </div>
          </template>

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
      </GTabsContent>

      <!-- ══════════ ARRIENDOS ══════════ -->
      <GTabsContent value="arriendo" force-mount class="data-[state=inactive]:hidden">
        <div class="space-y-5 pt-3">

          <template v-if="contratos.arriendo">
            <div class="rounded-xl border bg-card p-5 border-primary/25">
              <!-- Header -->
              <div class="flex items-start justify-between mb-4 gap-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <div class="size-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/5">
                    <HouseIcon class="size-4 text-primary" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground leading-none mb-0.5">Contrato de Arriendo</p>
                    <span class="text-sm font-semibold text-foreground">{{ proyectoNombre }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <GBadge :color="CONTRATO_SEVERITY[contratos.arriendo.estado]">{{ CONTRATO_LABELS[contratos.arriendo.estado] }}</GBadge>
                  <SincronizarArriendoTsf v-if="unergyAuth" :proyecto-id="pid" @actualizado="recargarArriendo" />
<Button v-if="embebido && !contratoId" variant="ghost" size="sm" as-child><NuxtLink :to="`/contratos/${contratos.arriendo.id}`"><ExternalLinkIcon class="size-4" /> Abrir ficha</NuxtLink></Button>
                  <Button variant="ghost" size="sm" @click="openEditContrato('arriendo')"><PencilIcon class="size-4" /> Editar</Button>
                </div>
              </div>
              <!-- Mini-cards -->
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="rounded-lg p-3.5 bg-primary/5 border border-primary/20">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-primary">
                    <UserIcon class="size-3 text-primary" />Arrendatario
                  </p>
                  <p class="text-sm font-semibold leading-snug text-foreground">{{ contratos.arriendo.contratante_nombre || '—' }}</p>
                </div>
                <div class="rounded-lg p-3.5 bg-primary/5 border border-primary/20">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-primary">
                    <CalendarIcon class="size-3 text-primary" />Fecha de contrato
                  </p>
                  <p class="text-sm font-semibold text-foreground">{{ formatFecha(contratos.arriendo.fecha_firma_contrato) || '—' }}</p>
                </div>
                <!-- Valor anual con indexación -->
                <div class="rounded-lg p-3.5 bg-primary/5 border border-primary/20">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-primary">
                    <DollarSignIcon class="size-3 text-primary" />Valor anual ({{ ANIO_ACTUAL }})
                  </p>
                  <p class="text-base font-bold text-primary">
                    {{ formatCOP(getValorVigente(contratos.arriendo.indexacion_anual)?.valor ?? contratos.arriendo.tarifa_base) }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer text-primary"
                   
                    @click="showIndexacionArriendo.anual = !showIndexacionArriendo.anual">
                    <ChevronDownIcon :class="showIndexacionArriendo.anual ? 'rotate-180' : ''" class="transition-transform duration-200 size-3" />
                    {{ showIndexacionArriendo.anual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Valor mensual -->
                <div class="rounded-lg p-3.5 bg-primary/5 border border-primary/20">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-primary">
                    <CalculatorIcon class="size-3 text-primary" />Valor mensual ({{ ANIO_ACTUAL }})
                  </p>
                  <p class="text-base font-bold text-primary">
                    {{ formatCOP(getValorVigente(contratos.arriendo.indexacion_mensual)?.valor ?? contratos.arriendo.tarifa_mensual ?? (contratos.arriendo.tarifa_base != null ? Math.round(contratos.arriendo.tarifa_base / 12) : null)) }}
                  </p>
                  <button type="button"
                    class="mt-2 flex items-center gap-1 text-xs font-medium hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer text-primary"
                   
                    @click="showIndexacionArriendo.mensual = !showIndexacionArriendo.mensual">
                    <ChevronDownIcon :class="showIndexacionArriendo.mensual ? 'rotate-180' : ''" class="transition-transform duration-200 size-3" />
                    {{ showIndexacionArriendo.mensual ? 'Ocultar' : 'Ver indexación' }}
                  </button>
                </div>
                <!-- Contrato en Drive -->
                <div class="rounded-lg p-3.5 bg-primary/5 border border-primary/20">
                  <p class="text-xs mb-1.5 flex items-center gap-1.5 text-primary">
                    <FileTextIcon class="size-3 text-primary" />Contrato en Drive
                  </p>
                  <a v-if="contratos.arriendo.enlace_drive?.startsWith('http')"
                     :href="contratos.arriendo.enlace_drive" target="_blank" rel="noopener"
                     class="text-sm font-semibold flex items-center gap-1.5 hover:underline text-primary">
                    <ExternalLinkIcon class="size-3" />Ver contrato
                  </a>
                  <span v-else class="text-sm text-muted-foreground">Sin enlace</span>
                </div>
              </div>

              <!-- Sección Arrendadores -->
              <div class="rounded-xl border mt-3 border-primary/20">
                <div class="flex items-center justify-between px-4 py-2.5 bg-primary/5">
                  <span class="text-xs font-semibold flex items-center gap-1.5 text-primary">
                    <UsersIcon class="size-3 text-primary" />Arrendadores
                  </span>
                  <Button variant="ghost" size="sm" class="text-primary" @click="openArrendadorDialog('crear')"><PlusIcon class="size-4" /> Agregar arrendador</Button>
                </div>
                <div v-if="!arrendadores.length" class="px-4 py-6 text-center text-xs text-muted-foreground">
                  Sin arrendadores registrados.
                </div>
                <div v-else class="divide-y divide-border">
                  <div v-for="a in arrendadores" :key="a.id"
                    class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-foreground">{{ a.nombre }}</span>
                      <span class="text-sm font-mono tabular-nums text-primary">{{ formatCOP(a.valor_base) }}</span>
                      <span v-if="a.responsable_iva" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-primary/10 text-primary"
                       >Responsable IVA</span>
                      <span v-if="a.activo === false" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-muted text-muted-foreground"
                       >Inactivo</span>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon-sm" @click="openArrendadorDialog('editar', a)"><PencilIcon class="size-4" /></Button>
                      <Button variant="ghost" size="icon-sm" @click="eliminarArrendador(a)"><Trash2Icon class="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel indexación ANUAL por arrendador -->
              <div :class="showIndexacionArriendo.anual ? 'max-h-200' : 'max-h-0'" class="overflow-hidden transition-all duration-300 ease-in-out" v-for="a in arrendadores" :key="'anual-' + a.id"
               >
                <div class="pt-3">
                  <div class="rounded-xl border overflow-hidden border-primary/20">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-primary/5">
                      <span class="text-xs font-semibold text-primary">
                        <DollarSignIcon class="mr-1.5 size-3 text-primary" />Indexación anual de arriendo — {{ a.nombre }}
                      </span>
                      <span class="text-xs text-muted-foreground">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-muted border-b border-border">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Valor anual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!a.indexacion_anual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-muted-foreground">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de contrato (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (a.indexacion_anual || [])" :key="fila.anio"
                          class="border-b border-border hover:bg-primary/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-primary/40' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span :class="fila.anio === ANIO_ACTUAL ? 'text-primary' : 'text-foreground'" class="font-mono font-semibold"
                               >
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-primary/10 text-primary"
                               >actual</span>
                              <ArrowLeftIcon class="size-3 text-primary" v-if="fila.anio === ANIO_ACTUAL" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-muted-foreground text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums text-foreground">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td :class="fila.anio === ANIO_ACTUAL ? 'text-primary' : 'text-foreground'" class="px-4 py-2.5 text-right font-semibold tabular-nums"
                           >
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success"
                             >
                              <CheckIcon class="size-3" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                             >
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                             >
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/60 text-xs text-muted-foreground">
                      <ZapIcon class="size-3 text-primary" />
                      Calculado automáticamente desde la Fecha de contrato y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

              <!-- Panel indexación MENSUAL por arrendador -->
              <div :class="showIndexacionArriendo.mensual ? 'max-h-200' : 'max-h-0'" class="overflow-hidden transition-all duration-300 ease-in-out" v-for="a in arrendadores" :key="'mensual-' + a.id"
               >
                <div class="pt-3">
                  <div class="rounded-xl border overflow-hidden border-primary/20">
                    <div class="flex items-center justify-between px-4 py-2.5 bg-primary/5">
                      <span class="text-xs font-semibold text-primary">
                        <CalculatorIcon class="mr-1.5 size-3 text-primary" />Indexación mensual de arriendo — {{ a.nombre }}
                      </span>
                      <span class="text-xs text-muted-foreground">Año vigente: {{ ANIO_ACTUAL }}</span>
                    </div>
                    <table class="w-full text-sm border-collapse">
                      <thead>
                        <tr class="bg-muted border-b border-border">
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Año</th>
                          <th class="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">IPC aplicado</th>
                          <th class="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Valor mensual</th>
                          <th class="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!a.indexacion_mensual?.length">
                          <td colspan="4" class="px-4 py-6 text-center text-xs text-muted-foreground">
                            Sin indexación aún — el contrato todavía no cumple un año desde la Fecha de contrato (o falta esa fecha / el valor base).
                          </td>
                        </tr>
                        <tr v-for="fila in (a.indexacion_mensual || [])" :key="fila.anio"
                          class="border-b border-border hover:bg-primary/20 transition-colors"
                          :class="fila.anio === ANIO_ACTUAL ? 'bg-primary/40' : ''">
                          <td class="px-4 py-2.5">
                            <div class="flex items-center gap-1.5">
                              <span :class="fila.anio === ANIO_ACTUAL ? 'text-primary' : 'text-foreground'" class="font-mono font-semibold"
                               >
                                {{ fila.anio }}
                              </span>
                              <span v-if="fila.anio === ANIO_ACTUAL"
                                class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-primary/10 text-primary"
                               >actual</span>
                              <ArrowLeftIcon class="size-3 text-primary" v-if="fila.anio === ANIO_ACTUAL" />
                            </div>
                          </td>
                          <td class="px-4 py-2.5">
                            <span v-if="fila.ipc_aplicado == null" class="text-muted-foreground text-xs">— (base)</span>
                            <span v-else class="font-mono tabular-nums text-foreground">{{ fila.ipc_aplicado }}%</span>
                          </td>
                          <td :class="fila.anio === ANIO_ACTUAL ? 'text-primary' : 'text-foreground'" class="px-4 py-2.5 text-right font-semibold tabular-nums"
                           >
                            {{ formatCOP(fila.valor) }}
                          </td>
                          <td class="px-4 py-2.5 text-center">
                            <span v-if="fila.ipc_aplicado == null || fila.anio < ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success"
                             >
                              <CheckIcon class="size-3" />Pagado
                            </span>
                            <span v-else-if="fila.anio === ANIO_ACTUAL"
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                             >
                              Vigente
                            </span>
                            <span v-else
                              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                             >
                              Pendiente
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/60 text-xs text-muted-foreground">
                      <ZapIcon class="size-3 text-primary" />
                      Calculado automáticamente desde la Fecha de contrato y el IPC por año.
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <!-- Dialog Arrendador (crear/editar) -->
            <Dialog v-model:open="arrendadorDialog.visible">
              <DialogContent class="sm:max-w-md" @open-auto-focus.prevent>
              <DialogHeader>
                <DialogTitle>{{ arrendadorDialog.modo === 'editar' ? 'Editar arrendador' : 'Agregar arrendador' }}</DialogTitle>
                <DialogDescription class="sr-only">Quién recibe el pago del arriendo y en qué condiciones.</DialogDescription>
              </DialogHeader>
              <div class="flex flex-col gap-3">
                <!-- El arrendador FACTURA, así que necesita NIT y razón social:
                     por eso se vincula a un cliente en vez de escribirse. -->
                <SelectorCliente
                  v-model:id="arrendadorDialog.form.cliente_id"
                  v-model:nombre="arrendadorDialog.form.nombre"
                  label="Nombre / Razón social"
                  requerido
                />
                <div>
                  <label class="text-xs font-medium text-muted-foreground">Valor base</label>
                  <NumberField :step-snapping="false" v-model="arrendadorDialog.form.valor_base" :format-options="FORMATO_COP">
                    <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                  </NumberField>
                </div>
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="arrendadorDialog.form.responsable_iva" /> Responsable de IVA
                </label>
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="arrendadorDialog.form.activo" /> Activo
                </label>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-muted-foreground">Anticipo pagado desde</label>
                  <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_desde" clearable />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-muted-foreground">Anticipo pagado hasta</label>
                  <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_hasta" clearable />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium text-muted-foreground">Observaciones</label>
                  <Textarea v-model="arrendadorDialog.form.observaciones" rows="2" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" @click="arrendadorDialog.visible = false">Cancelar</Button>
                <Button :disabled="arrendadorDialog.guardando" @click="guardarArrendador"><Spinner v-if="arrendadorDialog.guardando" class="size-4" /> Guardar</Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-primary/30 bg-primary/40 p-10 text-center">
              <div class="size-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-primary/5"
               >
                <HouseIcon class="size-6 text-primary" />
              </div>
              <p class="text-sm font-medium text-muted-foreground mb-1">Sin contrato de arriendo registrado</p>
              <p class="text-xs text-muted-foreground mb-4">No se encontró contrato de arriendo para este proyecto</p>
              <div class="flex items-center justify-center gap-2">
                <SincronizarArriendoTsf v-if="unergyAuth" :proyecto-id="pid" @actualizado="recargarArriendo" />
                <Button size="sm" class="bg-primary border-primary" @click="openWizard('arriendo')"><PlusIcon class="size-4" /> Crear contrato</Button>
              </div>
            </div>
          </template>

        </div>
      </GTabsContent>

      <!-- ══════════ INTERNET ══════════ -->
      <GTabsContent value="internet" force-mount class="data-[state=inactive]:hidden">
        <div class="space-y-5 pt-3">

          <template v-if="contratos.internet">
            <div class="rounded-xl border bg-card p-5 border-chart-2/25">
              <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-2.5">
                  <div class="size-8 rounded-lg flex items-center justify-center bg-chart-2/10">
                    <WifiIcon class="size-4 text-chart-2" />
                  </div>
                  <span class="text-sm font-semibold text-foreground">Servicio de Internet</span>
                  <GBadge :color="CONTRATO_SEVERITY[contratos.internet.estado]">{{ CONTRATO_LABELS[contratos.internet.estado] }}</GBadge>
                </div>
<Button v-if="embebido && !contratoId" variant="ghost" size="sm" as-child><NuxtLink :to="`/contratos/${contratos.internet.id}`"><ExternalLinkIcon class="size-4" /> Abrir ficha</NuxtLink></Button>
                <Button variant="ghost" size="sm" @click="openEditContrato('internet')"><PencilIcon class="size-4" /> Editar</Button>
                <Button variant="outline" size="sm" class="border-chart-2 text-chart-2" @click="openWizard('internet')"><PlusIcon class="size-4" /> Nuevo servicio</Button>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <InfoIcon :icon="BuildingIcon" color="var(--chart-2)" label="Proveedor"
                  :value="contratos.internet.prestador_nombre" />
                <InfoIcon :icon="DatabaseIcon" color="var(--chart-2)" label="Plan de datos"
                  :value="contratos.internet.plan_datos_gb" />
                <InfoIcon :icon="GaugeIcon" color="var(--chart-2)" label="Velocidad"
                  :value="contratos.internet.velocidad_mbps != null ? `${contratos.internet.velocidad_mbps} Mbps` : null" />
                <InfoIcon :icon="WifiIcon" color="var(--chart-2)" label="Tipo de conexión"
                  :value="contratos.internet.tipo_conexion" />
                <InfoIcon :icon="NetworkIcon" color="var(--chart-2)" label="Línea de servicio"
                  :value="contratos.internet.linea_servicio" />
                <InfoIcon :icon="MonitorIcon" color="var(--chart-2)" label="ID del router"
                  :value="contratos.internet.id_router" />
                <InfoIcon :icon="BoxIcon" color="var(--chart-2)" label="Número de kit"
                  :value="contratos.internet.numero_kit" />
                <InfoIcon :icon="ZapIcon" color="var(--chart-2)" label="Latencia"
                  :value="contratos.internet.latencia_ms != null ? `${contratos.internet.latencia_ms} ms` : null" />
                <InfoIcon :icon="ShieldIcon" color="var(--chart-2)" label="Seguridad del wifi"
                  :value="contratos.internet.wifi_seguridad" />
                <InfoSecret color="var(--chart-2)" label="Contraseña wifi"
                  :value="contratos.internet.wifi_password" />
                <InfoLink color="var(--chart-2)" label="Factura / Contrato en Drive"
                  :href="contratos.internet.enlace_drive" />
              </div>

              <!-- Ubicación del servicio -->
              <div v-if="contratos.internet.ubicacion_lat != null && contratos.internet.ubicacion_lng != null"
                class="mt-5 pt-4 border-t border-border">
                <p class="text-xs font-medium mb-2 text-muted-foreground">
                  Ubicación: {{ contratos.internet.ubicacion_lat }},{{ contratos.internet.ubicacion_lng }}
                </p>
                <div ref="internetMapEl" class="rounded-md overflow-hidden h-50 bg-muted"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="rounded-xl border border-dashed border-chart-2/30 bg-chart-2/40 p-10 text-center">
              <div class="size-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-chart-2/10"
               >
                <WifiIcon class="size-6 text-chart-2" />
              </div>
              <p class="text-sm font-medium text-muted-foreground mb-1">Sin servicio de internet registrado</p>
              <p class="text-xs text-muted-foreground mb-4">Registra el proveedor para iniciar el seguimiento de pagos</p>
              <Button size="sm" class="bg-chart-2 border-chart-2" @click="openWizard('internet')"><PlusIcon class="size-4" /> Registrar servicio</Button>
            </div>
          </template>
        </div>
      </GTabsContent>

    </GTabs>

    <!-- ── Dialog Mantenimiento (crear / editar) ─────────────────────────────── -->
    <Dialog v-model:open="dialogMant.visible">
      <DialogContent class="sm:max-w-2xl max-h-dvh overflow-y-auto" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-sm">
          <WrenchIcon class="size-4 text-warning" />
          {{ dialogMant.modo === 'crear' ? 'Crear contrato de mantenimiento' : 'Editar contrato de mantenimiento' }}
        </DialogTitle>
        <DialogDescription class="sr-only">Partes, fechas, periodicidad y valores del contrato de O&amp;M.</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 pt-1">
        <!-- Contratante / Prestador -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <SelectorCliente
              v-model:id="dialogMant.form.contratante_id"
              v-model:nombre="dialogMant.form.contratante_nombre"
              label="Contratante"
              requerido
            />
            <p v-if="dialogMant.errores.contratante_nombre" class="text-xs text-destructive">{{ dialogMant.errores.contratante_nombre }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <SelectorCliente
              v-model:id="dialogMant.form.prestador_id"
              v-model:nombre="dialogMant.form.prestador_nombre"
              label="Prestador"
              requerido
            />
            <p v-if="dialogMant.errores.prestador_nombre" class="text-xs text-destructive">{{ dialogMant.errores.prestador_nombre }}</p>
          </div>
        </div>
        <!-- Fecha / Estado -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Fecha de inicio O&amp;M <span class="text-destructive">*</span></label>
            <DatePicker v-model="dialogMant.form.fecha_inicio_om" clearable />
            <p class="text-xs text-muted-foreground">Es la fecha que Costos usa para indexar la tarifa.</p>
            <p v-if="dialogMant.errores.fecha_inicio_om" class="text-xs text-destructive">{{ dialogMant.errores.fecha_inicio_om }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Estado <span class="text-destructive">*</span></label>
            <Select v-model="dialogMant.form.estado">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="o in ESTADOS_MANT" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="dialogMant.errores.estado" class="text-xs text-destructive">{{ dialogMant.errores.estado }}</p>
          </div>
        </div>
        <!-- Fecha de suscripción (informativa; no interviene en la indexación) -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Fecha de suscripción del contrato</label>
            <DatePicker v-model="dialogMant.form.fecha_firma_contrato" clearable />
            <p class="text-xs text-muted-foreground">Solo informativa. La indexación usa la Fecha de inicio O&amp;M.</p>
          </div>
        </div>
        <!-- Periodicidad de cobro -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Periodicidad de cobro <span class="text-destructive">*</span></label>
            <Select v-model="dialogMant.form.periodicidad_pago">
              <SelectTrigger class="w-full"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in PERIODICIDADES" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">Define en qué meses se cobra en el panel de Mantenimiento.</p>
          </div>
        </div>
        <!-- Valor anual / Valor mensual -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Valor O&amp;M Anual (BASE) <span class="text-destructive">*</span></label>
            <NumberField :step-snapping="false" v-model="dialogMant.form.tarifa_base" :format-options="FORMATO_COP"
              @update:model-value="v => { if (Number.isFinite(v)) dialogMant.form.tarifa_mensual = Math.round(v / 12) }">
              <NumberFieldContent><NumberFieldInput placeholder="$ 0" /></NumberFieldContent>
            </NumberField>
            <p v-if="dialogMant.errores.tarifa_base" class="text-xs text-destructive">{{ dialogMant.errores.tarifa_base }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Valor mensual <span class="text-destructive">*</span></label>
            <NumberField :step-snapping="false" v-model="dialogMant.form.tarifa_mensual" :format-options="FORMATO_COP">
              <NumberFieldContent><NumberFieldInput placeholder="$ 0" /></NumberFieldContent>
            </NumberField>
            <p class="text-xs text-muted-foreground">Sugerido: Valor Anual ÷ 12</p>
          </div>
        </div>
        <!-- Administración: casi siempre se negocia en el contrato de representación y
             CGM; a veces aquí. Es un cargo adicional (% sobre el ingreso del mes). -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Administración (%) <span class="font-normal">— opcional</span></label>
          <NumberField :step-snapping="false" v-model="dialogMant.form.tarifa_admin_pct"
            :format-options="{ minimumFractionDigits: 1, maximumFractionDigits: 2 }">
            <NumberFieldContent><NumberFieldInput placeholder="Ej. 3,8" /></NumberFieldContent>
          </NumberField>
          <p class="text-xs text-muted-foreground">Solo si la administración se negoció en este contrato y no en el de representación.</p>
        </div>
        <!-- Enlace Drive -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Enlace del contrato en Drive</label>
          <Input v-model="dialogMant.form.enlace_drive" placeholder="https://drive.google.com/…" />
          <p v-if="dialogMant.errores.enlace_drive" class="text-xs text-destructive">{{ dialogMant.errores.enlace_drive }}</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="dialogMant.visible = false">Cancelar</Button>
        <Button class="bg-warning border-warning" :disabled="guardandoMant" @click="saveMantenimiento"><Spinner v-if="guardandoMant" class="size-4" /> <CheckIcon v-else class="size-4" /> {{ dialogMant.modo === 'crear' ? 'Crear contrato' : 'Guardar cambios' }}</Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Wizard nuevo contrato ──────────────────────────────────────────────── -->
    <ContratoServicioWizard
      v-if="wizardVisible"
      :visible="wizardVisible"
      :tipo="wizardTipo"
      :proyecto-id-default="pid"
      @cerrar="wizardVisible = false"
      @creado="onContratoCreado"
    />

    <!-- ── Dialog editar contrato ───────────────────────────────────────────── -->
    <Dialog v-model:open="dialogEdit.visible">
      <DialogContent class="sm:max-w-xl max-h-dvh overflow-y-auto" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-sm">
          <PencilIcon class="size-4" :class="DIALOG_EDIT_TEXT[dialogEdit.tipo]" />
          Editar — {{ DIALOG_EDIT_LABEL[dialogEdit.tipo] }}
        </DialogTitle>
        <DialogDescription class="sr-only">Datos editables del contrato.</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-4">
          <div v-if="dialogEdit.tipo === 'mantenimiento'" class="col-span-2 md:col-span-1 flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Fecha de inicio O&amp;M</label>
            <DatePicker v-model="dialogEdit.form.fecha_inicio" clearable />
          </div>
          <template v-else-if="dialogEdit.tipo === 'arriendo'">
            <div class="col-span-2 md:col-span-1 flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Fecha de inicio O&amp;M</label>
              <DatePicker v-model="dialogEdit.form.fecha_inicio_om" clearable />
              <p class="text-xs text-muted-foreground">Solo informativa; no interviene en la indexación.</p>
            </div>
            <div class="col-span-2 md:col-span-1 flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Fecha de contrato</label>
              <DatePicker v-model="dialogEdit.form.fecha_firma_contrato" clearable />
              <p class="text-xs text-muted-foreground">Fecha base para la indexación en Costos.</p>
            </div>
          </template>
          <div v-if="dialogEdit.tipo !== 'internet'" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">
              {{ dialogEdit.tipo === 'mantenimiento' ? 'Valor O&M Anual BASE (COP)' : 'Valor anual BASE (COP)' }}
            </label>
            <NumberField :step-snapping="false" v-model="dialogEdit.form.tarifa_base" :format-options="FORMATO_COP">
              <NumberFieldContent><NumberFieldInput placeholder="$ 0" /></NumberFieldContent>
            </NumberField>
          </div>
        </div>
        <template v-if="dialogEdit.tipo === 'internet'">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Plan de datos</label>
              <Input v-model="dialogEdit.form.plan_datos_gb" placeholder="50 GB / Ilimitado" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Velocidad contratada (Mbps)</label>
              <NumberField :step-snapping="false" v-model="dialogEdit.form.velocidad_mbps" :format-options="{ useGrouping: false }">
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">Tipo de conexión</label>
            <Input v-model="dialogEdit.form.tipo_conexion" list="operacion-tipos-conexion" placeholder="Selecciona o escribe…" />
            <datalist id="operacion-tipos-conexion">
              <option v-for="t in TIPOS_CONEXION" :key="t" :value="t" />
            </datalist>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Línea de servicio</label>
              <Input v-model="dialogEdit.form.linea_servicio" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">ID del router</label>
              <Input v-model="dialogEdit.form.id_router" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Número de kit</label>
              <Input v-model="dialogEdit.form.numero_kit" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Latencia (ms)</label>
              <NumberField :step-snapping="false" v-model="dialogEdit.form.latencia_ms" :format-options="{ useGrouping: false }">
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Seguridad del wifi</label>
              <Select :model-value="aValorSelect(dialogEdit.form.wifi_seguridad)"
                @update:model-value="dialogEdit.form.wifi_seguridad = deValorSelect($event) || null">
                <SelectTrigger class="w-full"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem>
                  <SelectItem v-for="w in WIFI_SEGURIDAD" :key="w" :value="w">{{ w }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Contraseña wifi</label>
              <Input v-model="dialogEdit.form.wifi_password" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">
              Ubicación del servicio
              <span class="text-muted-foreground font-normal">— escríbela, pégala o haz clic en el mapa</span>
            </label>
            <CoordenadasInput v-model:latitud="dialogEdit.form.ubicacion_lat" v-model:longitud="dialogEdit.form.ubicacion_lng"
              v-model:valido="coordenadasInternetValidas" />
            <div ref="dialogEditMapEl" class="rounded-md overflow-hidden h-50 bg-muted"></div>
          </div>
        </template>
        <div v-if="dialogEdit.tipo === 'arriendo'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Periodicidad de cobro</label>
          <Select v-model="dialogEdit.form.periodicidad_pago">
            <SelectTrigger class="w-full"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in PERIODICIDADES" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">Define en qué meses se cobra en el panel de Costos.</p>
        </div>
        <label v-if="dialogEdit.tipo === 'arriendo'" class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox v-model="dialogEdit.form.responsable_iva" /> Responsable de IVA
        </label>
        <div v-if="dialogEdit.tipo !== 'internet'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Estado del pago</label>
          <Select :model-value="aValorSelect(dialogEdit.form.estado_pago)"
            @update:model-value="dialogEdit.form.estado_pago = deValorSelect($event) || null">
            <SelectTrigger class="w-full"><SelectValue placeholder="Sin definir" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem>
              <SelectItem v-for="o in ESTADO_PAGO_OPCIONES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Enlace en Drive</label>
          <Input v-model="dialogEdit.form.enlace_drive" placeholder="https://drive.google.com/…" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="dialogEdit.visible = false">Cancelar</Button>
        <Button :disabled="guardandoContrato" :class="DIALOG_EDIT_BG[dialogEdit.tipo]" @click="saveContrato"><Spinner v-if="guardandoContrato" class="size-4" /> <CheckIcon v-else class="size-4" /> Guardar cambios</Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>

<script setup>
import { ArrowLeftIcon, BoxIcon, BuildingIcon, CalculatorIcon, CalendarIcon, CheckIcon, ChevronDownIcon, CirclePlusIcon, CreditCardIcon, DatabaseIcon, DollarSignIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, FileIcon, FileInputIcon, FileOutputIcon, FileSpreadsheetIcon, FileTextIcon, FilterIcon, GaugeIcon, HouseIcon, LinkIcon, LockIcon, MonitorIcon, NetworkIcon, PencilIcon, PlusIcon, ShieldIcon, TableIcon, Trash2Icon, UserIcon, UsersIcon, WifiIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'
import { toast } from 'vue-sonner'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { mostrarAvisos } from '~/features/contratos/avisos'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { formatCOP } from '~/utils/currency'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import SincronizarArriendoTsf from '~/features/proyectos/components/SincronizarArriendoTsf.vue'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
import {
  clientePorNombre,
  clientes as cargarClientes,
} from '~/features/clientes/services/catalogoClientes'
/**
 * `embebido`: dentro de otra ficha (la del proyecto o la del contrato), sin migas ni «atrás».
 * `proyectoId`: la planta, cuando la ruta no es la del proyecto (en /contratos/{id}).
 * `contratoId` + `tipo`: muestra solo ese contrato (mantenimiento, arriendo o
 * internet), sin las pestañas de los otros tipos.
 */
const props = defineProps({
  embebido: { type: Boolean, default: false },
  proyectoId: { type: Number, default: null },
  contratoId: { type: Number, default: null },
  tipo: { type: String, default: null },
})
// Perezoso: `route` se declara más abajo, y esto se evalúa ya montado.
const pid = computed(() => props.proyectoId ?? Number(route.params.id))

/** El contrato de un tipo que se muestra: el pedido, o el primero de la planta. */
function elegir(lista, tipo) {
  if (!lista?.length) return null
  if (props.contratoId && props.tipo === tipo) return lista.find(c => c.id === props.contratoId) ?? lista[0]
  return lista[0]
}

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

const CONTRATO_LABELS   = { firmado: 'Firmado', vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación', en_revision: 'En revisión' }
const CONTRATO_SEVERITY = { firmado: 'success', vigente: 'success', vencido: 'destructive', terminado: 'default', en_renovacion: 'warning', en_revision: 'warning' }

// Los estados que una persona decide. `vigente` y `vencido` los calcula el
// backend desde la fecha fin, y `en_revision` NUNCA existio en el enum -- elegir
// cualquiera de los tres devolvia 400 al guardar.
const ESTADOS_MANT = [
  { label: 'Firmado',       value: 'firmado' },
  { label: 'En renovación', value: 'en_renovacion' },
  { label: 'Terminado',     value: 'terminado' },
]

const FORMATO_COP = { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }

const TIPOS_CONEXION = ['Starlink', 'Fibra', '4G', 'Otro']
const WIFI_SEGURIDAD = ['WPA2', 'WPA3', 'WPA2/WPA3', 'WPA3-OWE', 'Remoto RADIUS', 'A bordo RADIUS', 'Abierta']

const PERIODICIDADES = [
  { label: 'Mensual',    value: 'mensual' },
  { label: 'Bimestral',  value: 'bimestral' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Semestral',  value: 'semestral' },
  { label: 'Anual',      value: 'anual' },
]

const TABS_TIPOS = ['mantenimiento', 'arriendo', 'internet']
const pestana = ref(
  TABS_TIPOS.includes(props.tipo) ? props.tipo
    : TABS_TIPOS.includes(route.query.subtab) ? route.query.subtab : TABS_TIPOS[0],
)

const DIALOG_EDIT_TEXT = { mantenimiento: 'text-warning', arriendo: 'text-primary', internet: 'text-chart-2' }
const DIALOG_EDIT_BG = { mantenimiento: 'bg-warning border-warning', arriendo: 'bg-primary border-primary', internet: 'bg-chart-2 border-chart-2' }
const DIALOG_EDIT_LABEL = { mantenimiento: 'Mantenimiento', arriendo: 'Arriendo', internet: 'Internet' }

// ── Estado reactivo ───────────────────────────────────────────────────────────
const loading          = ref(true)
const proyectoNombre   = ref('')
const guardandoContrato = ref(false)
const guardandoMant      = ref(false)
const excelInputRef      = ref(null)
const ANIO_ACTUAL        = new Date().getFullYear()
const showIndexacion          = reactive({ anual: false, mensual: false })
const showIndexacionArriendo  = reactive({ anual: false, mensual: false })

// Reservadas para un desarrollo posterior (decisión de Sara, 2026-10-08): hoy
// nada las llena y los acordeones salen vacíos. No borrarlas ni conectarlas a
// una fuente sin hablarlo primero.
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
    nombre: '', cliente_id: null, valor_base: null, responsable_iva: false,
    activo: true, anticipo_pagado_desde: null, anticipo_pagado_hasta: null,
    observaciones: '',
  },
})

const dialogMant = reactive({
  visible: false,
  modo: 'crear',
  form: {
    contratante_id: null,
    contratante_nombre: '',
    prestador_id: null,
    prestador_nombre: '',
    fecha_inicio_om: null,
    fecha_firma_contrato: null,
    tarifa_base: null,
    tarifa_mensual: null,
    tarifa_admin_pct: null,
    enlace_drive: '',
    estado: 'firmado',
    periodicidad_pago: 'mensual',
  },
  errores: {},
})

const contratos = reactive({ mantenimiento: null, arriendo: null, internet: null })

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
  new maplibregl.Marker({ color: 'var(--chart-2)' }).setLngLat([c.ubicacion_lng, c.ubicacion_lat]).addTo(internetMap)

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
let maplibreDialogo = null

// Ver CoordenadasInput: con una coordenada ilegible en pantalla no se guarda.
const coordenadasInternetValidas = ref(true)
let dialogEditMapRO = null

async function initDialogEditMap() {
  if (!dialogEditMapEl.value || dialogEditMap) return
  const { default: maplibregl } = await import('maplibre-gl')
  maplibreDialogo = maplibregl
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
    dialogEditMarker = new maplibregl.Marker({ color: 'var(--chart-2)' }).setLngLat(centro).addTo(dialogEditMap)
  }

  dialogEditMap.on('click', (e) => {
    const { lng, lat } = e.lngLat
    dialogEdit.form.ubicacion_lat = Number(lat.toFixed(6))
    dialogEdit.form.ubicacion_lng = Number(lng.toFixed(6))
    if (dialogEditMarker) dialogEditMarker.setLngLat([lng, lat])
    else dialogEditMarker = new maplibregl.Marker({ color: 'var(--chart-2)' }).setLngLat([lng, lat]).addTo(dialogEditMap)
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

// Escribir o pegar la coordenada mueve el marcador (el clic en el mapa hace lo
// inverso). El mapa solo se desplaza si el punto quedó fuera de la vista, para
// que un clic no lo recentre.
watch(() => [dialogEdit.form.ubicacion_lat, dialogEdit.form.ubicacion_lng], ([lat, lng]) => {
  if (!dialogEditMap || !maplibreDialogo || lat == null || lng == null) return
  const punto = [Number(lng), Number(lat)]
  if (dialogEditMarker) dialogEditMarker.setLngLat(punto)
  else dialogEditMarker = new maplibreDialogo.Marker({ color: 'var(--chart-2)' }).setLngLat(punto).addTo(dialogEditMap)
  if (!dialogEditMap.getBounds().contains(punto)) dialogEditMap.easeTo({ center: punto, zoom: Math.max(dialogEditMap.getZoom(), 12) })
})

// ── Carga inicial ─────────────────────────────────────────────────────────────
onMounted(async () => {
  const proyId = pid.value
  try {
    const [proyRes, mantRes, arrRes, netRes] = await Promise.allSettled([
      proyectosService.obtener(proyId),
      contratosServicioService.listar({ tipo: 'mantenimiento', proyecto_id: proyId }),
      contratosServicioService.listar({ tipo: 'arriendo', proyecto_id: proyId }),
      contratosServicioService.listar({ tipo: 'internet', proyecto_id: proyId }),
    ])

    if (proyRes.status === 'fulfilled') proyectoNombre.value = proyRes.value.nombre_comercial

    contratos.mantenimiento = mantRes.status === 'fulfilled' ? elegir(mantRes.value, 'mantenimiento') : null
    contratos.arriendo      = arrRes.status  === 'fulfilled' ? elegir(arrRes.value, 'arriendo') : null
    contratos.internet      = netRes.status  === 'fulfilled' ? elegir(netRes.value, 'internet') : null

    await cargarIndexacionOM()
    await cargarArrendadores()
    await cargarIndexacionArriendo()
  } catch (e) {
    toast.error('Error al cargar', { description: e.message, duration: 4000 })
  } finally {
    loading.value = false
  }
  // Después de quitar el "cargando": mientras se ve, las pestañas no existen y el
  // mapa no tiene contenedor donde dibujarse.
  await initInternetMap(contratos.internet)
})

// ── Edición de contrato ───────────────────────────────────────────────────────
function openEditContrato(tipo) {
  const c = contratos[tipo]
  if (!c) return
  dialogEdit.tipo = tipo
  dialogEdit.form.tarifa_base = c.tarifa_base
  dialogEdit.form.fecha_firma_contrato = aFecha(c.fecha_firma_contrato)
  dialogEdit.form.fecha_inicio = aFecha(c.fecha_inicio)
  dialogEdit.form.enlace_drive = c.enlace_drive || ''
  dialogEdit.form.estado_pago = c.estado_pago || null
  dialogEdit.form.periodicidad_pago = c.periodicidad_pago || 'mensual'
  dialogEdit.form.fecha_inicio_om = aFecha(c.fecha_inicio_om)
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
  if (tipo === 'internet' && !coordenadasInternetValidas.value) {
    toast.error('Coordenada inválida', { description: 'Revisa la latitud y la longitud del servicio.', duration: 4000 })
    return
  }
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

const unergyAuth = useRuntimeConfig().public.unergyAuthEnabled

/** Tras «Sincronizar con TSF»: el contrato, sus arrendadores y su indexación. */
async function recargarArriendo() {
  try {
    const data = await contratosServicioService.listar({ tipo: 'arriendo', proyecto_id: pid.value })
    contratos.arriendo = elegir(data, 'arriendo')
    await cargarArrendadores()
    await cargarIndexacionArriendo()
  } catch (e) {
    toast.error('No se pudo recargar el arriendo', { description: e.message })
  }
}

async function onContratoCreado() {
  const tipo = wizardTipo.value
  const proyId = pid.value
  try {
    const data = await contratosServicioService.listar({ tipo, proyecto_id: proyId })
    contratos[tipo] = elegir(data, tipo)
    if (tipo === 'arriendo') {
      await cargarArrendadores()
      await cargarIndexacionArriendo()
    }
    if (tipo === 'internet') await initInternetMap(contratos.internet)
  } catch { /* ignore */ }
}

// ── Mantenimiento modal (crear / editar) ──────────────────────────────────────
function openMantenimientoDialog(modo) {
  dialogMant.modo = modo
  dialogMant.errores = {}
  if (modo === 'editar' && contratos.mantenimiento) {
    const c = contratos.mantenimiento
    dialogMant.form.contratante_id     = c.contratante_id ?? null
    dialogMant.form.contratante_nombre = c.contratante_nombre || ''
    dialogMant.form.prestador_id       = c.prestador_id ?? null
    dialogMant.form.prestador_nombre   = c.prestador_nombre   || ''
    dialogMant.form.fecha_inicio_om    = aFecha(c.fecha_inicio_om || c.fecha_inicio)
    dialogMant.form.fecha_firma_contrato = aFecha(c.fecha_firma_contrato)
    dialogMant.form.tarifa_base        = c.tarifa_base ?? null
    dialogMant.form.tarifa_mensual     = c.tarifa_mensual ?? (c.tarifa_base != null ? Math.round(c.tarifa_base / 12) : null)
    dialogMant.form.tarifa_admin_pct   = c.tarifa_admin != null ? Number(c.tarifa_admin) * 100 : null
    dialogMant.form.enlace_drive       = c.enlace_drive || ''
    dialogMant.form.estado             = c.estado || 'firmado'
    dialogMant.form.periodicidad_pago  = c.periodicidad_pago || 'mensual'
  } else {
    dialogMant.form.contratante_id     = null
    dialogMant.form.contratante_nombre = ''
    dialogMant.form.prestador_id       = null
    dialogMant.form.prestador_nombre   = ''
    dialogMant.form.fecha_inicio_om    = null
    dialogMant.form.fecha_firma_contrato = null
    dialogMant.form.tarifa_base        = null
    dialogMant.form.tarifa_mensual     = null
    dialogMant.form.tarifa_admin_pct   = null
    dialogMant.form.enlace_drive       = ''
    dialogMant.form.estado             = 'firmado'
    dialogMant.form.periodicidad_pago  = 'mensual'
  }
  dialogMant.visible = true
}

function validarFormMant() {
  const e = {}
  // El vínculo, no el texto: un nombre escrito sin elegir de la lista deja el
  // contrato nombrando a alguien que el sistema no reconoce.
  if (!dialogMant.form.contratante_id) e.contratante_nombre = 'Vincula un cliente registrado'
  if (!dialogMant.form.prestador_id)   e.prestador_nombre   = 'Vincula un cliente registrado'
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
      contratante_id:     dialogMant.form.contratante_id,
      prestador_id:       dialogMant.form.prestador_id,
      fecha_inicio_om:    toISO(dialogMant.form.fecha_inicio_om),
      fecha_firma_contrato: toISO(dialogMant.form.fecha_firma_contrato),
      tarifa_base:        dialogMant.form.tarifa_base,
      tarifa_mensual:     dialogMant.form.tarifa_mensual ?? null,
      tarifa_admin:       dialogMant.form.tarifa_admin_pct != null ? dialogMant.form.tarifa_admin_pct / 100 : null,
      enlace_drive:       dialogMant.form.enlace_drive?.trim() || null,
      estado:             dialogMant.form.estado,
      periodicidad_pago:  dialogMant.form.periodicidad_pago,
    }
    if (dialogMant.modo === 'crear') {
      const proyId = pid.value
      payload.servicio_aplica = 'mantenimiento'
      payload.proyecto_id     = Number(proyId)
      mostrarAvisos(await contratosServicioService.crear(payload))
      const data = await contratosServicioService.listar({ tipo: 'mantenimiento', proyecto_id: proyId })
      contratos.mantenimiento = elegir(data, 'mantenimiento')
    } else {
      const data = await contratosServicioService.actualizar(contratos.mantenimiento.id, payload)
      contratos.mantenimiento = { ...contratos.mantenimiento, ...data }
      mostrarAvisos(data)
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

    // Las partes son clientes, no texto: se vincula el que se llama igual. Si no
    // hay ninguno, queda el nombre sin vínculo y el selector pide elegirlo o
    // crearlo antes de guardar.
    const catalogo = await cargarClientes()
    for (const [rol, columna] of [['contratante', 'Contratante'], ['prestador', 'Prestador']]) {
      const texto   = String(fila[columna] ?? '').trim()
      const cliente = clientePorNombre(catalogo, texto)
      dialogMant.form[`${rol}_id`]     = cliente?.id ?? null
      dialogMant.form[`${rol}_nombre`] = cliente?.razon_social_nombre ?? texto
    }
    dialogMant.form.fecha_inicio_om    = parseFecha(fila['Fecha de inicio O&M'])?.toISOString().slice(0, 10) ?? null
    dialogMant.form.tarifa_base        = parseNum(fila['Valor O&M Anual (BASE)'])
    const mensualExcel                 = parseNum(fila['Valor mensual'])
    dialogMant.form.tarifa_mensual     = mensualExcel ?? (dialogMant.form.tarifa_base != null ? Math.round(dialogMant.form.tarifa_base / 12) : null)
    dialogMant.form.enlace_drive       = String(fila['Enlace del contrato en Drive'] ?? '').trim()
    dialogMant.form.estado             = contratos.mantenimiento?.estado ?? 'firmado'
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
  arrendadorDialog.form.cliente_id = arrendador?.cliente_id ?? null
  arrendadorDialog.form.valor_base = arrendador?.valor_base ?? null
  arrendadorDialog.form.responsable_iva = arrendador?.responsable_iva ?? false
  arrendadorDialog.form.activo = arrendador?.activo ?? true
  arrendadorDialog.form.anticipo_pagado_desde = aFecha(arrendador?.anticipo_pagado_desde)
  arrendadorDialog.form.anticipo_pagado_hasta = aFecha(arrendador?.anticipo_pagado_hasta)
  arrendadorDialog.form.observaciones = arrendador?.observaciones || ''
  arrendadorDialog.visible = true
}

async function guardarArrendador() {
  if (!contratos.arriendo?.id) return
  // El arrendador factura: sin cliente vinculado no hay NIT con que emitir la
  // factura, y el nombre suelto no basta.
  if (!arrendadorDialog.form.cliente_id) {
    toast.error('Vincula el arrendador a un cliente registrado', { duration: 3500 })
    return
  }
  arrendadorDialog.guardando = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      nombre: arrendadorDialog.form.nombre.trim(),
      cliente_id: arrendadorDialog.form.cliente_id,
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
/** Fecha del API → 'aaaa-mm-dd', que es lo que usa `DatePicker`. */
function aFecha(f) {
  return f ? String(f).slice(0, 10) : null
}

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
import DataTable from '~/components/blocks/DataTable.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'

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
      <div :style="{ '--c': 'color-mix(in oklab, ' + color + ' 10%, transparent)' }" class="size-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-(--c)"
       >
        <component :style="{ '--c': color }" :is="icon" class="size-3 text-(--c)" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-medium leading-none mb-0.5 text-muted-foreground">{{ label }}</p>
        <p class="text-sm font-medium truncate text-foreground">{{ value ?? '—' }}</p>
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
      <div :style="{ '--c': 'color-mix(in oklab, ' + color + ' 10%, transparent)' }" class="size-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-(--c)"
       >
        <CreditCardIcon :style="{ '--c': color }" class="size-3 text-(--c)" />
      </div>
      <div>
        <p class="text-xs font-medium leading-none mb-1 text-muted-foreground">{{ label }}</p>
        <GBadge v-if="estado" :color="ESTADO_PAGO_SEVERITY_S[estado]">{{ ESTADO_PAGO_LABELS_S[estado] }}</GBadge>
        <span v-else class="text-sm text-muted-foreground">—</span>
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
      <div :style="{ '--c': 'color-mix(in oklab, ' + color + ' 10%, transparent)' }" class="size-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-(--c)"
       >
        <LockIcon :style="{ '--c': color }" class="size-3 text-(--c)" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-medium leading-none mb-0.5 text-muted-foreground">{{ label }}</p>
        <p v-if="!value" class="text-sm font-medium text-foreground">—</p>
        <button v-else type="button" class="text-sm font-medium inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-foreground"
         
          @click="visible = !visible">
          {{ visible ? value : '••••••••' }}
          <EyeOffIcon v-if="visible" class="size-3 text-muted-foreground" />
          <EyeIcon v-else class="size-3 text-muted-foreground" />
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
      <div :style="{ '--c': 'color-mix(in oklab, ' + color + ' 10%, transparent)' }" class="size-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-(--c)"
       >
        <LinkIcon :style="{ '--c': color }" class="size-3 text-(--c)" />
      </div>
      <div>
        <p class="text-xs font-medium leading-none mb-0.5 text-muted-foreground">{{ label }}</p>
        <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer"
          class="text-sm font-medium hover:underline inline-flex items-center gap-1 text-primary"
         >
          <ExternalLinkIcon class="size-3" />
          Ver en Drive
        </a>
        <template v-else>
          <button v-if="editable" type="button"
            class="text-xs font-medium inline-flex items-center gap-1 hover:underline transition-opacity bg-transparent border-0 cursor-pointer p-0 text-muted-foreground"
           
            @click="$emit('editar')">
            <CirclePlusIcon class="size-3" />
            Agregar enlace
          </button>
          <span v-else class="text-sm text-muted-foreground">—</span>
        </template>
      </div>
    </div>
  `,
}

const Acordeon = {
  props: {
    titulo: String,
    /** Componente de `@lucide/vue`. */
    icono: { type: [Object, Function], default: null },
    color: { type: String, default: 'var(--warning)' },
    count: { type: Number, default: 0 },
  },
  components: { ChevronDownIcon },
  setup(props) {
    const abierto = ref(false)
    return { ...toRefs(props), abierto }
  },
  template: `
    <div class="rounded-xl border bg-card overflow-hidden border-border">
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors text-left"
        @click="abierto = !abierto">
        <div class="flex items-center gap-2.5">
          <div :style="{ '--c': 'color-mix(in oklab, ' + color + ' 10%, transparent)' }" class="size-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-(--c)"
           >
            <component :style="{ '--c': color }" :is="icono" class="size-3 text-(--c)" />
          </div>
          <span class="text-sm font-semibold text-foreground">{{ titulo }}</span>
          <span :style="{ '--c': color, '--bg': 'color-mix(in oklab, ' + color + ' 8%, transparent)' }" class="inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5 leading-none bg-(--bg) text-(--c)"
           >{{ count }}</span>
        </div>
        <ChevronDownIcon :class="abierto ? 'rotate-180' : ''" class="text-muted-foreground transition-transform duration-200 size-3" />
      </button>
      <transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div v-if="abierto" class="border-t border-border">
          <slot />
        </div>
      </transition>
    </div>
  `,
}

const COLUMNAS_COBRADAS = [
  { key: 'mes', header: 'Mes', class: 'min-w-24' },
  { key: 'proyecto', header: 'Proyecto', class: 'min-w-32' },
  { key: 'inversionista', header: 'Inversionista', class: 'min-w-32' },
  { key: 'monto', header: 'Monto', class: 'min-w-36' },
  { key: 'nroFactura', header: 'N° Factura', class: 'min-w-28' },
  { key: 'soporte', header: 'Soporte', class: 'text-center' },
]

const COLUMNAS_EMITIDAS = [
  { key: 'fecha', header: 'Fecha', class: 'min-w-28' },
  { key: 'proyecto', header: 'Proyecto', class: 'min-w-32' },
  { key: 'nroFactura', header: 'N° Factura', class: 'min-w-28' },
  { key: 'monto', header: 'Monto', class: 'min-w-36' },
  { key: 'soporte', header: 'Soporte', class: 'text-center' },
]

// Acordeón 1: Facturas cobradas
const FacturasCobradas = {
  components: { DataTable, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Acordeon, FileIcon, FilterIcon, XIcon },
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
      COLUMNAS: COLUMNAS_COBRADAS,
      FileInputIcon,
      aValorSelect,
      deValorSelect,
      VALOR_SELECT_VACIO,
      datosFiltrados,
      hayFiltros,
      limpiarFiltros,
      formatCOP,
    }
  },
  template: `
    <Acordeon titulo="Facturas cobradas" :icono="FileInputIcon" color="var(--warning)" :count="datos.length">
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 bg-muted/60 border-b border-border">
        <div class="flex items-center gap-1.5">
          <FilterIcon class="text-muted-foreground size-3" />
          <span class="text-xs text-muted-foreground font-medium">Filtrar por:</span>
        </div>
        <Select :model-value="aValorSelect(filtroAño != null ? String(filtroAño) : null)"
          @update:model-value="v => { const a = deValorSelect(v); filtroAño = a ? Number(a) : null }">
          <SelectTrigger size="sm" class="min-w-24"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="a in AÑOS_STATIC" :key="a" :value="String(a)">{{ a }}</SelectItem>
          </SelectContent>
        </Select>
        <Select :model-value="aValorSelect(filtroMes != null ? String(filtroMes) : null)"
          @update:model-value="v => { const m = deValorSelect(v); filtroMes = m ? Number(m) : null }">
          <SelectTrigger size="sm" class="min-w-28"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="m in MESES_OPCIONES_STATIC" :key="m.value" :value="String(m.value)">{{ m.label }}</SelectItem>
          </SelectContent>
        </Select>
        <button v-if="hayFiltros" type="button"
          class="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1 transition-colors"
          @click="limpiarFiltros">
          <XIcon class="size-3" /> Limpiar
        </button>
        <span v-if="hayFiltros" class="text-xs text-muted-foreground ml-auto">
          {{ datosFiltrados.length }} resultado{{ datosFiltrados.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <DataTable :columns="COLUMNAS" :rows="datosFiltrados" empty-message="Sin facturas cobradas registradas.">
        <template #cell="{ row, column }">
          <span v-if="column.key === 'mes'" class="font-medium text-foreground">{{ MESES_NOMBRES_STATIC[row.mes] ?? row.mes }}</span>
          <span v-else-if="column.key === 'monto'" class="font-semibold tabular-nums text-foreground">{{ formatCOP(row.monto) }}</span>
          <template v-else-if="column.key === 'soporte'">
            <a v-if="row.soporteUrl" :href="row.soporteUrl" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center justify-center size-7 rounded-lg transition-colors hover:bg-warning/10 text-warning"
              title="Ver soporte">
              <FileIcon class="size-4" />
            </a>
            <span v-else class="text-muted-foreground text-sm">—</span>
          </template>
          <template v-else>{{ row[column.key] }}</template>
        </template>
      </DataTable>
    </Acordeon>
  `,
}

// Acordeón 2: Facturas emitidas
const FacturasEmitidas = {
  components: { DataTable, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Acordeon, FileIcon, FilterIcon, XIcon },
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
      COLUMNAS: COLUMNAS_EMITIDAS,
      FileOutputIcon,
      aValorSelect,
      deValorSelect,
      VALOR_SELECT_VACIO,
      datosFiltrados,
      hayFiltros,
      limpiarFiltros,
      formatCOP,
    }
  },
  template: `
    <Acordeon titulo="Facturas emitidas" :icono="FileOutputIcon" color="var(--warning)" :count="datos.length">
      <div class="flex flex-wrap items-center gap-3 px-5 py-3 bg-muted/60 border-b border-border">
        <div class="flex items-center gap-1.5">
          <FilterIcon class="text-muted-foreground size-3" />
          <span class="text-xs text-muted-foreground font-medium">Filtrar por:</span>
        </div>
        <Select :model-value="aValorSelect(filtroAño != null ? String(filtroAño) : null)"
          @update:model-value="v => { const a = deValorSelect(v); filtroAño = a ? Number(a) : null }">
          <SelectTrigger size="sm" class="min-w-24"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="a in AÑOS_STATIC" :key="a" :value="String(a)">{{ a }}</SelectItem>
          </SelectContent>
        </Select>
        <Select :model-value="aValorSelect(filtroMes != null ? String(filtroMes) : null)"
          @update:model-value="v => { const m = deValorSelect(v); filtroMes = m ? Number(m) : null }">
          <SelectTrigger size="sm" class="min-w-28"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="m in MESES_OPCIONES_STATIC" :key="m.value" :value="String(m.value)">{{ m.label }}</SelectItem>
          </SelectContent>
        </Select>
        <button v-if="hayFiltros" type="button"
          class="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1 transition-colors"
          @click="limpiarFiltros">
          <XIcon class="size-3" /> Limpiar
        </button>
        <span v-if="hayFiltros" class="text-xs text-muted-foreground ml-auto">
          {{ datosFiltrados.length }} resultado{{ datosFiltrados.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <DataTable :columns="COLUMNAS" :rows="datosFiltrados" empty-message="Sin facturas emitidas registradas.">
        <template #cell="{ row, column }">
          <span v-if="column.key === 'monto'" class="font-semibold tabular-nums text-foreground">{{ formatCOP(row.monto) }}</span>
          <template v-else-if="column.key === 'soporte'">
            <a v-if="row.soporteUrl" :href="row.soporteUrl" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center justify-center size-7 rounded-lg transition-colors hover:bg-warning/10 text-warning"
              title="Ver soporte">
              <FileIcon class="size-4" />
            </a>
            <span v-else class="text-muted-foreground text-sm">—</span>
          </template>
          <template v-else>{{ row[column.key] }}</template>
        </template>
      </DataTable>
    </Acordeon>
  `,
}

export default {
  components: { InfoIcon, InfoBadge, InfoLink, Acordeon, FacturasCobradas, FacturasEmitidas },
}
</script>
