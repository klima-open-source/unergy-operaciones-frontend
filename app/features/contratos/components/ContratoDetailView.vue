<template>
  <div v-if="contrato">
    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=servicios&srv=ppa', label: 'Servicios' }"
                   :titulo="contrato.nombre_interno || contrato.numero_codigo_contrato || 'Contrato PPA'"
                   :codigo="contrato.numero_codigo_contrato || ''"
                   :tabs="TABS" v-model="activeTab">
      <template #chips>
        <GBadge color="warning" class="text-xs">PPA</GBadge>
        <GBadge :color="(contrato.tipo_contrato === 'compra') ? '#915BD8' : '#F6FF72'" class="text-xs">{{ (contrato.tipo_contrato === 'compra') ? 'Compra' : 'Venta' }}</GBadge>
      </template>
      <template #acciones>
        <!-- Atajo al contrato: el enlace se guarda en la pestaña Datos -->
        <a v-if="enlaceContrato" :href="enlaceContrato" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-warning/30 bg-warning/10 text-xs font-semibold text-warning transition-colors duration-150 hover:bg-warning/20" v-tooltip.bottom="'Abrir el contrato en Drive'">
          <ExternalLinkIcon class="size-4" />Contrato
        </a>
        <Button label="Editar contrato" severity="secondary" outlined size="small" @click="abrirEdicionCompleta">
          <template #icon><PencilIcon class="size-4" /></template>
        </Button>
      </template>
      <template #default="{ tab }">
      <!-- ══ DATOS ══ -->
      <div v-if="tab === 'datos'" class="space-y-4">

        <!-- ── Resumen: lo que se quiere saber de un vistazo ─────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3 bg-(--bg)! border-(--bd)!"
            :style="{ '--c': estadoVigencia.color, '--bg': estadoVigencia.bg, '--bd': estadoVigencia.borde }">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1 text-(--c)!">
              <CircleIcon class="size-1.5 fill-current" />Estado
            </p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase text-(--c)!">{{ estadoVigencia.label }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate text-(--c)! opacity-70">{{ estadoVigencia.detalle }}</p>
          </div>

          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><ClockIcon class="size-3" />Duración</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ duracion || '—' }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              {{ formatFecha(contrato.fecha_inicio) || '—' }} → {{ formatFecha(contrato.fecha_fin) || '—' }}
            </p>
          </div>

          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><ChartLineIcon class="size-3" />Indexación</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ contrato.indice_indexacion || '—' }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              {{ contrato.periodicidad_indexacion || 'sin periodicidad' }}<template v-if="contrato.periodo_indexacion_base"> · base {{ contrato.periodo_indexacion_base }}</template>
            </p>
          </div>

          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><FileIcon class="size-3" />Facturación</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ contrato.periodicidad_facturacion || '—' }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              {{ contrato.tiempo_pago != null ? ('pago a ' + contrato.tiempo_pago + ' días') : 'sin plazo de pago' }}
            </p>
          </div>
        </div>

        <!-- ── Identificación ────────────────────────────────────────── -->
        <section class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-primary/10"><IdCardIcon class="size-3 text-primary" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Identificación</h3>
            <div class="ml-auto flex items-center gap-1">
              <Button v-if="!editandoId" label="Editar" size="small" text severity="secondary" @click="iniciarEdicionId">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="cancelarEdicionId" />
                <Button label="Guardar" size="small" :loading="guardandoId" @click="guardarId">
                  <template #icon><CheckIcon class="size-4" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="p-3.5">
            <!-- Modo lectura -->
            <div v-if="!editandoId" class="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              <InfoField label="Nombre interno" :value="contrato.nombre_interno" />
              <InfoField label="Número de contrato" :value="contrato.numero_codigo_contrato" />
              <InfoField label="Tipo de contrato" :value="contrato.tipo_contrato === 'compra' ? 'Compra' : 'Venta'" />
              <InfoField label="Responsable" :value="contrato.responsable?.nombre" />
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium text-muted-foreground">Comunidad energética</span>
                <div>
                  <GBadge v-if="contrato.es_comunidad_energetica" color="success" class="text-xs">🏘 Sí</GBadge>
                  <span v-else class="text-sm text-foreground">{{ contrato.es_comunidad_energetica === false ? 'No' : '—' }}</span>
                </div>
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">Nombre interno</label>
                <InputText v-model="formId.nombre_interno" placeholder="Ej: Terpel 1" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-muted-foreground">Número de contrato</label>
                <InputText v-model="formId.numero_codigo_contrato" placeholder="Ej: UNERGY 001-2023" class="w-full" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Partes del contrato ───────────────────────────────────── -->
        <section class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-primary/10"><UsersIcon class="size-3 text-primary" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Partes del contrato</h3>
            <div class="ml-auto flex items-center gap-1">
              <Button v-if="!editandoPartes" label="Editar" size="small" text severity="secondary" @click="iniciarEdicionPartes">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="cancelarEdicionPartes" />
                <Button label="Guardar" size="small" :loading="guardandoPartes"
                  :disabled="!formPartes.comprador_id || !formPartes.vendedor_id"
                  v-tooltip="(formPartes.comprador_id && formPartes.vendedor_id) ? undefined : 'Vincula las dos partes a un cliente registrado.'"
                  @click="guardarPartes">
                  <template #icon><CheckIcon class="size-4" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="p-3.5">
            <!-- Modo lectura: la energía va del vendedor al comprador -->
            <div v-if="!editandoPartes" class="flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
              <div class="border border-border rounded-lg px-3 py-3 bg-muted/30 min-w-0 sm:flex-1">
                <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><SunIcon class="size-3" />Vendedor</p>
                <p class="text-sm font-semibold text-foreground">{{ contrato.vendedor_nombre || '—' }}</p>
                <p class="font-mono text-xs text-muted-foreground mt-px">NIT {{ contrato.vendedor_nit || '—' }}</p>
              </div>
              <ArrowRightIcon class="text-muted-foreground/50 self-center rotate-90 sm:rotate-0 size-3" />
              <div class="border border-border rounded-lg px-3 py-3 bg-muted/30 min-w-0 sm:flex-1">
                <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><BuildingIcon class="size-3" />Comprador</p>
                <p class="text-sm font-semibold text-foreground">{{ contrato.comprador_nombre || '—' }}</p>
                <p class="font-mono text-xs text-muted-foreground mt-px">NIT {{ contrato.comprador_nit || '—' }}</p>
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="border border-border rounded-lg px-3 py-3 bg-muted/30 min-w-0 sm:flex-1 space-y-3">
                <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><SunIcon class="size-3" />Vendedor</p>
                <SelectorCliente
                  v-model:id="formPartes.vendedor_id"
                  v-model:nombre="formPartes.vendedor_nombre"
                  v-model:nit="formPartes.vendedor_nit"
                  label="Nombre / Razón social"
                  requerido
                />
                <NitDeCliente :nit="formPartes.vendedor_nit" />
              </div>
              <div class="border border-border rounded-lg px-3 py-3 bg-muted/30 min-w-0 sm:flex-1 space-y-3">
                <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><BuildingIcon class="size-3" />Comprador</p>
                <SelectorCliente
                  v-model:id="formPartes.comprador_id"
                  v-model:nombre="formPartes.comprador_nombre"
                  v-model:nit="formPartes.comprador_nit"
                  label="Nombre / Razón social"
                  requerido
                />
                <NitDeCliente :nit="formPartes.comprador_nit" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Vigencia ──────────────────────────────────────────────── -->
        <section class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-success/10"><CalendarIcon class="size-3 text-success" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Vigencia</h3>
          </header>
          <div class="p-3.5">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              <InfoField label="Fecha inicio" :value="formatFecha(contrato.fecha_inicio)" />
              <InfoField label="Fecha fin" :value="formatFecha(contrato.fecha_fin)" />
              <InfoField label="Duración" :value="duracion" />
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium text-muted-foreground">Renovación automática</span>
                <div>
                  <GBadge v-if="contrato.renovacion_automatica != null"
                    :color="contrato.renovacion_automatica ? 'success' : 'default'"
                    class="text-xs">{{ contrato.renovacion_automatica ? 'Sí' : 'No' }}</GBadge>
                  <span v-else class="text-sm text-foreground">—</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Condiciones comerciales ───────────────────────────────── -->
        <section class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-warning/10"><DollarSignIcon class="size-3 text-warning" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Condiciones comerciales</h3>
          </header>
          <div class="p-3.5">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              <InfoField label="Índice de indexación" :value="contrato.indice_indexacion" />
              <InfoField label="Periodicidad indexación" :value="contrato.periodicidad_indexacion" />
              <InfoField label="Período base indexación" :value="contrato.periodo_indexacion_base" />
              <InfoField label="Valor indexación base"
                :value="contrato.valor_indexacion_base != null ? String(contrato.valor_indexacion_base) : null" />
              <InfoField label="Tarifa base ($/kWh)" :value="tarifaBaseFmt" />
              <InfoField label="Periodicidad facturación" :value="contrato.periodicidad_facturacion" />
              <InfoField label="Tiempo de pago (días)"
                :value="contrato.tiempo_pago != null ? String(contrato.tiempo_pago) : null" />
              <div v-if="contrato.condiciones_pago" class="col-span-full flex flex-col gap-0.5">
                <span class="text-xs font-medium text-muted-foreground">Condiciones de pago</span>
                <span class="text-sm whitespace-pre-line text-foreground">{{ contrato.condiciones_pago }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Documentos y enlaces ──────────────────────────────────── -->
        <section class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-warning/10"><LinkIcon class="size-3 text-warning" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Documentos y enlaces</h3>
            <div class="ml-auto flex items-center gap-1">
              <Button v-if="!editandoEnlace"
                :label="enlaceContrato ? 'Editar' : 'Agregar enlace'"
                size="small" text severity="secondary" @click="iniciarEdicionEnlace">
                <template #icon><component :is="enlaceContrato ? PencilIcon : PlusIcon" class="size-4" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="editandoEnlace = false" />
                <Button label="Guardar" size="small" :loading="guardandoEnlace" @click="guardarEnlace">
                  <template #icon><CheckIcon class="size-4" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="p-3.5">
            <!-- Modo lectura -->
            <div v-if="!editandoEnlace" class="flex items-start gap-2.5 border rounded-lg px-3 py-3" :class="enlaceContrato ? 'bg-warning/10 border-warning/30' : 'bg-muted/30 border-dashed border-warning/20'">
              <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-warning/15">
                <FileTextIcon class="size-3 text-warning" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium mb-0.5 text-warning">Contrato en Drive</p>
                <a v-if="enlaceContrato" :href="enlaceContrato" target="_blank" rel="noopener noreferrer"
                  class="text-sm font-semibold inline-flex items-center gap-1.5 hover:underline text-warning">
                  <ExternalLinkIcon class="size-3" />Ver contrato
                </a>
                <button v-else type="button" class="inline-flex items-center gap-1 cursor-pointer text-sm font-semibold text-warning hover:underline" @click="iniciarEdicionEnlace">
                  <CirclePlusIcon class="size-3" />Agregar enlace
                </button>
                <TruncatedText v-if="enlaceContrato" :text="enlaceContrato" class="text-xs mt-0.5 text-warning" />
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="flex flex-col gap-1 max-w-xl">
              <label class="text-xs font-medium text-muted-foreground">Enlace al contrato (Drive, Dropbox, SharePoint…)</label>
              <InputText v-model.trim="formEnlace.carpeta_link" class="w-full"
                placeholder="https://drive.google.com/…" @keyup.enter="guardarEnlace" />
              <small class="text-xs text-muted-foreground">
                Debe empezar por <span class="font-mono">http://</span> o <span class="font-mono">https://</span>.
                Déjalo vacío para quitar el enlace.
              </small>
            </div>
          </div>
        </section>

        <!-- ── Detalles operacionales (solo si el contrato los trae) ─── -->
        <section v-if="tieneDetallesOperacionales" class="bg-card border border-border rounded-xl overflow-hidden">
          <header class="flex items-center gap-2 min-h-10 px-3.5 py-1.5 bg-muted/50 border-b border-border">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-muted-foreground/10"><ListIcon class="size-3 text-muted-foreground" /></span>
            <h3 class="text-xs font-bold tracking-wide uppercase text-foreground">Detalles operacionales y contractuales</h3>
          </header>
          <div class="p-3.5 space-y-3">
            <div v-if="contrato.service_scope" class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-muted-foreground">Alcance del servicio</span>
              <span class="text-sm whitespace-pre-line text-foreground">{{ contrato.service_scope }}</span>
            </div>
            <div v-if="contrato.specific_service_terms" class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-muted-foreground">Términos específicos del servicio</span>
              <span class="text-sm whitespace-pre-line text-foreground">{{ contrato.specific_service_terms }}</span>
            </div>
            <div v-if="contrato.slas" class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-muted-foreground">SLAs (Acuerdos de nivel de servicio)</span>
              <span class="text-sm whitespace-pre-line text-foreground">{{ contrato.slas }}</span>
            </div>
            <div v-if="contrato.responsibilities" class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-muted-foreground">Responsabilidades</span>
              <span class="text-sm whitespace-pre-line text-foreground">{{ contrato.responsibilities }}</span>
            </div>
          </div>
        </section>

      </div>

      <!-- ══ CANTIDADES ══ -->
      <div v-if="tab === 'cantidades'" class="space-y-4">

        <!-- Resumen -->
        <div v-if="resumenCantidades && !editandoCantidades" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><CalendarIcon class="size-3" />Períodos</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ resumenCantidades.periodos }} meses</p>
            <p class="text-xs text-muted-foreground mt-px truncate">{{ resumenCantidades.añoMin }} – {{ resumenCantidades.añoMax }}</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><ZapIcon class="size-3" />Compromiso {{ hoyPeriodo.año }}</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ fmtNum(resumenCantidades.totalAñoActual) }} MWh</p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              {{ resumenCantidades.tieneAñoActual ? 'suma de mínimos del año' : 'sin compromisos este año' }}
            </p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><ClockIcon class="size-3" />Mes en curso</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">
              {{ resumenCantidades.actual ? fmtNum(resumenCantidades.actual.energia_minima) + ' MWh' : '—' }}
            </p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              <template v-if="resumenCantidades.actual">
                {{ resumenCantidades.actual.plantas_inscritas ?? '—' }} de
                {{ resumenCantidades.actual.cantidad_proyectos ?? '—' }} plantas
              </template>
              <template v-else>{{ MESES[hoyPeriodo.mes - 1] }} sin registro</template>
            </p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><MoveHorizontalIcon class="size-3" />Flexibilidad</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">
              {{ resumenCantidades.flex != null ? resumenCantidades.flex.toFixed(0) + '%' : '—' }}
            </p>
            <p class="text-xs text-muted-foreground mt-px truncate">
              {{ resumenCantidades.flex != null ? 'promedio máx sobre mín' : 'sin rangos máx/mín' }}
            </p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <SelectButton v-if="!editandoCantidades" v-model="vistaCantidades" :options="VISTAS"
            optionLabel="label" optionValue="value" size="small" />
          <span v-else class="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-foreground [&>svg]:text-primary">
            <UploadIcon class="size-4" />Cargar compromisos desde Excel
          </span>
          <div class="ml-auto flex items-center gap-1.5">
            <template v-if="!editandoCantidades">
              <Button label="Editar" size="small" text severity="secondary" @click="editandoCantidades = true">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
            </template>
            <template v-else>
              <Button label="Cancelar" size="small" text severity="secondary"
                @click="editandoCantidades = false; energiaPaste = ''; energiaRows = []; energiaError = ''" />
              <Button label="Guardar" size="small" :loading="guardandoCantidades" :disabled="!energiaRows.length" @click="guardarCantidades">
                <template #icon><CheckIcon class="size-4" /></template>
              </Button>
            </template>
          </div>
        </div>

        <!-- Modo edición cantidades -->
        <template v-if="editandoCantidades">
          <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs leading-normal text-warning [&>svg]:mt-px [&>svg]:shrink-0">
            <TriangleAlertIcon class="size-4" />
            <div>
              Copia las columnas <strong>Año · Mes · Mín · Máx · Plantas contrato</strong> desde Excel y pégalas
              abajo (Mín/Máx en MWh/mes; <strong>Plantas contrato</strong> = nº de plantas que el contrato exige
              ese mes). Máx y Plantas contrato son opcionales.
              Al guardar se <strong>reemplazan todos</strong> los compromisos actuales.
            </div>
          </div>
          <Textarea v-model="energiaPaste" rows="7"
            placeholder="2024&#9;Enero&#9;90&#9;180&#9;4&#10;2024&#9;Febrero&#9;90&#9;180&#9;4"
            class="w-full font-mono text-xs" @paste="onPasteEnergia" />
          <div class="flex items-center gap-2 flex-wrap">
            <Button label="Procesar" size="small" severity="secondary" outlined @click="parseEnergia">
              <template #icon><RefreshCwIcon class="size-4" /></template>
            </Button>
            <Button v-if="energiaRows.length" label="Limpiar" size="small" severity="danger" text @click="energiaRows = []; energiaPaste = ''; energiaError = ''">
              <template #icon><XIcon class="size-4" /></template>
            </Button>
            <span v-if="energiaRows.length" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-success/10 text-success">
              <CircleCheckIcon class="size-4" />{{ energiaRows.length }} filas listas
            </span>
            <span v-if="energiaError" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-destructive/10 text-destructive">
              <CircleXIcon class="size-4" />{{ energiaError }}
            </span>
          </div>
          <div v-if="energiaRows.length" class="cd-tabla border border-border rounded-xl overflow-hidden bg-card">
            <table class="w-full border-collapse text-xs [&_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-left">Año</th><th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-left">Mes</th>
                  <th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-right">Mín (MWh)</th><th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-right">Máx (MWh)</th>
                  <th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-right">Plantas contrato</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in energiaRows.slice(0, 8)" :key="i">
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground">{{ r.año }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground">{{ MESES[r.mes - 1] }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground text-right font-mono tabular-nums">{{ r.energia_minima }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground text-right font-mono tabular-nums">{{ r.energia_maxima ?? '—' }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground text-right font-mono tabular-nums">{{ r.cantidad_proyectos ?? '—' }}</td>
                </tr>
                <tr v-if="energiaRows.length > 8">
                  <td colspan="5" class="px-3 py-1.5 border-b border-border/50 text-foreground text-muted-foreground/50 italic">… y {{ energiaRows.length - 8 }} filas más</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Modo lectura cantidades -->
        <template v-else>
          <div v-if="!cantidadesMensuales.length" class="flex flex-col items-center gap-1 px-5 py-11 rounded-xl border border-dashed border-border bg-muted/30 text-center [&>svg]:text-muted-foreground/40 [&>svg]:mb-1">
            <ChartColumnIcon class="size-6" />
            <p class="text-sm font-semibold text-muted-foreground">Sin compromisos de energía</p>
            <p class="text-xs text-muted-foreground/70">Usa <strong>Editar</strong> para pegarlos desde Excel.</p>
          </div>
          <div v-else class="cd-tabla border border-border rounded-xl overflow-hidden bg-card">
            <DataTable
              :value="vistaCantidades === 'anual' ? cantidadesAnuales : cantidadesMensuales"
              stripedRows rowHover class="text-sm" paginator :rows="24"
              :rowsPerPageOptions="[12, 24, 60, 120]"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            >
              <Column field="año" header="Año">
                <template #body="{ data }"><span class="font-mono tabular-nums">{{ data.año }}</span></template>
              </Column>
              <Column v-if="vistaCantidades === 'mensual'" header="Mes">
                <template #body="{ data }">{{ MESES[data.mes - 1] }}</template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Mín (MWh/año)' : 'Mín (MWh/mes)'"
                headerClass="cd-th-der" bodyClass="text-right!">
                <template #body="{ data }">
                  <span class="font-mono tabular-nums font-semibold text-foreground">{{ fmtNum(data.energia_minima) }}</span>
                </template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Máx (MWh/año)' : 'Máx (MWh/mes)'"
                headerClass="cd-th-der" bodyClass="text-right!">
                <template #body="{ data }"><span class="font-mono tabular-nums">{{ fmtNum(data.energia_maxima) }}</span></template>
              </Column>
              <Column headerClass="cd-th-der" bodyClass="text-right!">
                <template #header>
                  <span v-tooltip.top="'Plantas registradas y despachando energía al contrato. La calcula la plataforma vía GESCON.'">
                    {{ vistaCantidades === 'anual' ? 'Plantas inscritas (máx)' : 'Plantas inscritas' }}
                  </span>
                </template>
                <template #body="{ data }">
                  <span v-if="data.plantas_inscritas != null" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                    :class="plantasClase(data)">{{ data.plantas_inscritas }}</span>
                  <span v-else class="text-muted-foreground/50">—</span>
                </template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Plantas contrato (máx)' : 'Plantas contrato'"
                headerClass="cd-th-der" bodyClass="text-right!">
                <template #body="{ data }">
                  <span class="font-mono tabular-nums">{{ data.cantidad_proyectos != null ? data.cantidad_proyectos : '—' }}</span>
                </template>
              </Column>
              <Column header="Rango">
                <template #body="{ data }">
                  <span v-if="data.energia_minima > 0 && data.energia_maxima != null" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-primary/10 text-primary">
                    {{ ((data.energia_maxima / data.energia_minima - 1) * 100).toFixed(0) }}% flex
                  </span>
                  <span v-else class="text-muted-foreground/50">—</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </div>

      <!-- ══ TARIFAS ══ -->
      <div v-if="tab === 'tarifas'" class="space-y-4">

        <!-- Resumen -->
        <div v-if="resumenTarifas && !editandoTarifas" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3 bg-warning/10! border-warning/30!">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1 text-warning!"><DollarSignIcon class="size-3" />
              {{ resumenTarifas.esDelMes ? 'Tarifa del mes' : 'Última tarifa' }}</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase text-warning!">{{ fmtCOP(resumenTarifas.vigente.tarifa) }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate text-warning! opacity-75">
              {{ MESES[resumenTarifas.vigente.mes - 1] }} {{ resumenTarifas.vigente.año }} · COP/kWh
            </p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><ChartLineIcon class="size-3" />Variación</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase text-(--c)!" :style="{ '--c': varColor(resumenTarifas.varPct) }">
              {{ resumenTarifas.varPct != null ? (resumenTarifas.varPct > 0 ? '+' : '') + resumenTarifas.varPct.toFixed(1) + '%' : '—' }}
            </p>
            <p class="text-xs text-muted-foreground mt-px truncate">frente al período anterior</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><MoveVerticalIcon class="size-3" />Rango histórico</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ fmtCOP(resumenTarifas.min) }} – {{ fmtCOP(resumenTarifas.max) }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">mínimo y máximo registrados</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><CalendarIcon class="size-3" />Períodos</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ resumenTarifas.periodos }} meses</p>
            <p class="text-xs text-muted-foreground mt-px truncate">{{ resumenTarifas.añoMin }} – {{ resumenTarifas.añoMax }}</p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <SelectButton v-if="!editandoTarifas" v-model="vistaTarifas" :options="VISTAS"
            optionLabel="label" optionValue="value" size="small" />
          <span v-else class="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-foreground [&>svg]:text-primary">
            <UploadIcon class="size-4" />Cargar tarifas desde Excel
          </span>
          <div class="ml-auto flex items-center gap-1.5">
            <template v-if="!editandoTarifas">
              <Button label="Editar" size="small" text severity="secondary" @click="editandoTarifas = true">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
            </template>
            <template v-else>
              <Button label="Cancelar" size="small" text severity="secondary"
                @click="editandoTarifas = false; tarifasPaste = ''; tarifasRows = []; tarifasError = ''" />
              <Button label="Guardar" size="small" :loading="guardandoTarifas" :disabled="!tarifasRows.length" @click="guardarTarifas">
                <template #icon><CheckIcon class="size-4" /></template>
              </Button>
            </template>
          </div>
        </div>

        <!-- Modo edición tarifas -->
        <template v-if="editandoTarifas">
          <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs leading-normal text-warning [&>svg]:mt-px [&>svg]:shrink-0">
            <TriangleAlertIcon class="size-4" />
            <div>
              Copia las columnas <strong>Año · Mes · Tarifa</strong> desde Excel y pégalas abajo.
              Al guardar se <strong>reemplazan todas</strong> las tarifas actuales.
            </div>
          </div>
          <Textarea v-model="tarifasPaste" rows="7"
            placeholder="2024&#9;Enero&#9;460&#10;2024&#9;Febrero&#9;460"
            class="w-full font-mono text-xs" @paste="onPasteTarifas" />
          <div class="flex items-center gap-2 flex-wrap">
            <Button label="Procesar" size="small" severity="secondary" outlined @click="parseTarifas">
              <template #icon><RefreshCwIcon class="size-4" /></template>
            </Button>
            <Button v-if="tarifasRows.length" label="Limpiar" size="small" severity="danger" text @click="tarifasRows = []; tarifasPaste = ''; tarifasError = ''">
              <template #icon><XIcon class="size-4" /></template>
            </Button>
            <span v-if="tarifasRows.length" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-success/10 text-success">
              <CircleCheckIcon class="size-4" />{{ tarifasRows.length }} filas listas
            </span>
            <span v-if="tarifasError" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-destructive/10 text-destructive">
              <CircleXIcon class="size-4" />{{ tarifasError }}
            </span>
          </div>
          <div v-if="tarifasRows.length" class="cd-tabla border border-border rounded-xl overflow-hidden bg-card">
            <table class="w-full border-collapse text-xs [&_tr:last-child_td]:border-b-0">
              <thead>
                <tr><th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-left">Año</th><th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-left">Mes</th><th class="bg-muted/50 text-muted-foreground text-xs font-bold tracking-wide uppercase px-3 py-2 border-b border-border text-right">Tarifa ($/kWh)</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in tarifasRows.slice(0, 8)" :key="i">
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground">{{ r.año }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground">{{ MESES[r.mes - 1] }}</td>
                  <td class="px-3 py-1.5 border-b border-border/50 text-foreground text-right font-mono tabular-nums">{{ r.tarifa }}</td>
                </tr>
                <tr v-if="tarifasRows.length > 8">
                  <td colspan="3" class="px-3 py-1.5 border-b border-border/50 text-foreground text-muted-foreground/50 italic">… y {{ tarifasRows.length - 8 }} filas más</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Modo lectura tarifas -->
        <template v-else>
          <div v-if="!tarifasMensuales.length" class="flex flex-col items-center gap-1 px-5 py-11 rounded-xl border border-dashed border-border bg-muted/30 text-center [&>svg]:text-muted-foreground/40 [&>svg]:mb-1">
            <DollarSignIcon class="size-6" />
            <p class="text-sm font-semibold text-muted-foreground">Sin tarifas registradas</p>
            <p class="text-xs text-muted-foreground/70">Usa <strong>Editar</strong> para pegarlas desde Excel.</p>
          </div>
          <div v-else class="cd-tabla border border-border rounded-xl overflow-hidden bg-card">
            <DataTable
              :value="vistaTarifas === 'anual' ? tarifasAnuales : tarifasMensuales"
              stripedRows rowHover class="text-sm" paginator :rows="24"
              :rowsPerPageOptions="[12, 24, 60, 120]"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            >
              <Column field="año" header="Año">
                <template #body="{ data }"><span class="font-mono tabular-nums">{{ data.año }}</span></template>
              </Column>
              <Column v-if="vistaTarifas === 'mensual'" header="Mes">
                <template #body="{ data }">{{ MESES[data.mes - 1] }}</template>
              </Column>
              <Column header="Tarifa (COP/kWh)" headerClass="cd-th-der" bodyClass="text-right!">
                <template #body="{ data }">
                  <span class="font-mono tabular-nums font-semibold text-warning">{{ fmtCOP(data.tarifa) }}</span>
                  <span v-if="vistaTarifas === 'anual' && !data._uniforme" class="text-muted-foreground/50 ml-1">prom.</span>
                </template>
              </Column>
              <Column header="Variación" headerClass="cd-th-der" bodyClass="text-right!">
                <template #body="{ data, index }">
                  <span v-if="index > 0 && currentTarifas[index - 1]?.tarifa != null && data.tarifa != null"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums text-(--c)! bg-(--bg)!" :style="{ '--c': varColor(varPct(currentTarifas[index-1].tarifa, data.tarifa)), '--bg': varBg(varPct(currentTarifas[index-1].tarifa, data.tarifa)) }">
                    <component :is="varIcono(varPct(currentTarifas[index-1].tarifa, data.tarifa))" class="size-3" />
                    {{ variacion(currentTarifas[index-1].tarifa, data.tarifa) }}
                  </span>
                  <span v-else class="text-muted-foreground/50">—</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </div>

      <!-- ══ CONTRATOS ASIC ══ -->
      <div v-if="tab === 'asic'" class="space-y-4">

        <!-- Resumen -->
        <div v-if="!loadingAsic && asicRows.length" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><BookIcon class="size-3" />Registros</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ resumenAsic.total }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">histórico completo</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3 bg-success/10! border-success/30!">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1 text-success!"><CircleCheckIcon class="size-3" />Vigentes</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase text-success!">{{ resumenAsic.vigentes }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate text-success! opacity-75">con fecha fin en el futuro</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1"><BadgeCheckIcon class="size-3" />Publicados</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase">{{ resumenAsic.publicados }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate">estado de la solicitud</p>
          </div>
          <div class="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3" :class="resumenAsic.enProceso && 'bg-warning/10! border-warning/30!'">
            <p class="flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1" :class="resumenAsic.enProceso && 'text-warning!'">
              <HourglassIcon class="size-3" />En proceso</p>
            <p class="text-base font-bold text-foreground leading-tight truncate first-letter:uppercase" :class="resumenAsic.enProceso && 'text-warning!'">{{ resumenAsic.enProceso }}</p>
            <p class="text-xs text-muted-foreground mt-px truncate" :class="resumenAsic.enProceso && 'text-warning! opacity-75'">
              pendientes ante el ASIC
            </p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <SelectButton v-model="vistaAsic" size="small"
            :options="[{ label: 'Vigentes', value: 'vigentes' }, { label: 'Históricos', value: 'historicos' }]"
            optionLabel="label" optionValue="value" />
          <div class="ml-auto flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground">{{ asicFiltrados.length }} de {{ asicRows.length }} registros</span>
          </div>
        </div>

        <div v-if="loadingAsic" class="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted-foreground">
          <LoaderCircleIcon class="size-4 animate-spin" /><span>Cargando registros ASIC…</span>
        </div>
        <div v-else-if="!asicFiltrados.length" class="flex flex-col items-center gap-1 px-5 py-11 rounded-xl border border-dashed border-border bg-muted/30 text-center [&>svg]:text-muted-foreground/40 [&>svg]:mb-1">
          <BookIcon class="size-6" />
          <p class="text-sm font-semibold text-muted-foreground">Sin registros ASIC {{ vistaAsic === 'vigentes' ? 'vigentes' : '' }}</p>
          <p class="text-xs text-muted-foreground/70">
            Se buscan por número de contrato interno o código SIC.
            <template v-if="vistaAsic === 'vigentes' && asicRows.length">
              Hay {{ asicRows.length }} en el histórico.
            </template>
          </p>
        </div>
        <div v-else class="cd-tabla border border-border rounded-xl overflow-hidden bg-card">
          <DataTable :value="asicFiltrados" stripedRows rowHover class="text-sm"
            sortField="fecha_solicitud" :sortOrder="-1">
            <Column field="codigo_sic_contrato" header="Código SIC" sortable>
              <template #body="{ data }">
                <span class="font-mono tabular-nums">{{ data.codigo_sic_contrato || '—' }}</span>
              </template>
            </Column>
            <Column field="planta_nombre" header="Planta" sortable>
              <template #body="{ data }">
                <router-link v-if="data.proyecto_id" :to="`/proyectos/${data.proyecto_id}`" class="font-medium text-primary hover:underline underline-offset-2">
                  {{ data.planta_nombre || data.proyecto_id }}
                </router-link>
                <span v-else class="text-muted-foreground/50">—</span>
              </template>
            </Column>
            <Column field="tipo_solicitud" header="Tipo">
              <template #body="{ data }">
                <GBadge :color="{ registro: 'success', modificacion: 'information', terminacion: 'destructive', desistimiento: 'default' }[data.tipo_solicitud] || 'default'" class="text-xs capitalize">{{ data.tipo_solicitud }}</GBadge>
              </template>
            </Column>
            <Column field="estado_solicitud" header="Estado">
              <template #body="{ data }">
                <GBadge :color="{ publicado: 'success', en_proceso: 'warning', rechazado: 'destructive', desistido: 'default' }[data.estado_solicitud] || 'default'" class="text-xs capitalize">{{ data.estado_solicitud.replace('_', ' ') }}</GBadge>
              </template>
            </Column>
            <Column field="fecha_inicio" header="Inicio" sortable>
              <template #body="{ data }"><span class="font-mono tabular-nums">{{ data.fecha_inicio || '—' }}</span></template>
            </Column>
            <Column field="fecha_fin" header="Fin" sortable>
              <template #body="{ data }"><span class="font-mono tabular-nums">{{ data.fecha_fin || '—' }}</span></template>
            </Column>
            <Column field="porcentaje_despacho" header="% Despacho"
              headerClass="cd-th-der" bodyClass="text-right!">
              <template #body="{ data }">
                <span v-if="data.porcentaje_despacho != null" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                  :class="data.porcentaje_despacho > 100 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'">
                  {{ Number(data.porcentaje_despacho).toFixed(1) }}%
                </span>
                <span v-else class="text-muted-foreground/50">—</span>
              </template>
            </Column>
            <Column field="fecha_solicitud" header="F. solicitud" sortable>
              <template #body="{ data }"><span class="font-mono tabular-nums">{{ data.fecha_solicitud || '—' }}</span></template>
            </Column>
            <Column header="Observaciones">
              <template #body="{ data }">
                <span class="text-xs text-muted-foreground">{{ data.observaciones || '—' }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- ══ PROYECTOS ══ -->
      <div v-if="tab === 'proyectos'" class="space-y-4">
        <div class="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <span class="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-foreground [&>svg]:text-primary">
            <ZapIcon class="size-4" />
            {{ contrato.proyectos?.length || 0 }}
            {{ (contrato.proyectos?.length === 1) ? 'planta asociada' : 'plantas asociadas' }}
          </span>
          <div class="ml-auto flex items-center gap-1.5">
            <Button label="Asociar proyecto" size="small" severity="secondary" outlined @click="abrirAsociar">
              <template #icon><PlusIcon class="size-4" /></template>
            </Button>
          </div>
        </div>

        <div v-if="contrato.proyectos?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <router-link v-for="p in proyectosOrdenados" :key="p.id" :to="`/proyectos/${p.id}`" class="group flex items-center gap-2.5 px-3 py-3 rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/30 hover:bg-muted/30">
            <span class="size-6 rounded-lg shrink-0 inline-flex items-center justify-center bg-primary/10"><ZapIcon class="size-3 text-primary" /></span>
            <div class="min-w-0 flex-1">
              <TruncatedText :text="p.nombre_comercial" class="text-sm font-semibold text-foreground" />
              <p class="font-mono text-xs text-muted-foreground">ID {{ p.id }}</p>
            </div>
            <ChevronRightIcon class="text-muted-foreground/50 shrink-0 group-hover:text-primary size-2.5" />
          </router-link>
        </div>
        <div v-else class="flex flex-col items-center gap-1 px-5 py-11 rounded-xl border border-dashed border-border bg-muted/30 text-center [&>svg]:text-muted-foreground/40 [&>svg]:mb-1">
          <NetworkIcon class="size-6" />
          <p class="text-sm font-semibold text-muted-foreground">Sin plantas asociadas</p>
          <p class="text-xs text-muted-foreground/70">Usa <strong>Asociar proyecto</strong> para vincular las que despachan a este PPA.</p>
        </div>
      </div>
      </template>
    </DetalleLayout>

    <!-- Wizard edición completa -->
    <PPAContratoWizard v-if="showWizard" :visible="showWizard"
      :initialData="wizardInitialData"
      :editandoId="wizardEditandoId"
      @cerrar="showWizard = false"
      @editado="onWizardEditado"
      @creado="onWizardCreado" />

    <!-- Dialog asociar proyecto -->
    <Dialog v-model:visible="showAsociar" header="Asociar proyecto" modal class="w-full max-w-md">
      <div class="flex flex-col gap-2 pt-1">
        <label class="text-xs font-medium text-muted-foreground">Buscar proyecto</label>
        <Select
          v-model="proyectoSeleccionado"
          :options="todosProyectosDisponibles"
          optionLabel="nombre_comercial"
          placeholder="Seleccionar proyecto…"
          filter
          filterPlaceholder="Buscar…"
          class="w-full"
          :loading="cargandoProyectos"
        />
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showAsociar = false" />
        <Button label="Asociar" :loading="asociando" :disabled="!proyectoSeleccionado" @click="asociarProyecto">
          <template #icon><CheckIcon class="size-4" /></template>
        </Button>
      </template>
    </Dialog>
  </div>

  <!-- Loading -->
  <div v-else-if="loading" class="flex items-center justify-center gap-2 text-sm text-muted-foreground py-24 px-5">
    <LoaderCircleIcon class="size-4.5 animate-spin" />
    <span>Cargando contrato…</span>
  </div>

  <!-- Error -->
  <div v-else class="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 text-center [&>svg]:text-muted-foreground/40 [&>svg]:mb-1 py-20 px-5">
    <TriangleAlertIcon class="size-6 text-warning!" />
    <p class="text-sm font-semibold text-muted-foreground">No se encontró el contrato</p>
    <p class="text-xs text-muted-foreground/70">Puede que lo hayan eliminado o que el enlace esté mal.</p>
    <Button label="Volver" text size="small" class="mt-2" @click="$router.back()">
      <template #icon><ArrowLeftIcon class="size-4" /></template>
    </Button>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import DetalleLayout from '~/components/blocks/DetalleLayout.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InfoField from '~/components/blocks/InfoField.vue'
import PPAContratoWizard from '~/features/contratos/components/PPAContratoWizard.vue'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
import NitDeCliente from '~/features/clientes/components/NitDeCliente.vue'
import { estadoVigenciaPPA } from '~/features/contratos/utils/ppaVigencia'
import { idsConPlantaAgregada, yaEstaVinculada } from '~/features/contratos/plantasDelContrato'
import { PpaService } from '~/features/contratos/services/ppa'
import { ArrowDownRightIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, BadgeCheckIcon, BookIcon, BuildingIcon, CalendarIcon, ChartColumnIcon, ChartLineIcon, CheckIcon, ChevronRightIcon, CircleCheckIcon, CircleIcon, CirclePlusIcon, CircleXIcon, ClockIcon, DollarSignIcon, ExternalLinkIcon, FileIcon, FileTextIcon, HourglassIcon, IdCardIcon, InfoIcon, LinkIcon, ListIcon, LoaderCircleIcon, MinusIcon, MoveHorizontalIcon, MoveVerticalIcon, NetworkIcon, PencilIcon, PlusIcon, RefreshCwIcon, SunIcon, TriangleAlertIcon, UploadIcon, UsersIcon, XIcon, ZapIcon } from '@lucide/vue'

const ppaService = new PpaService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const VISTAS = [{ label: 'Mensual', value: 'mensual' }, { label: 'Anual', value: 'anual' }]

const route = useRoute()
const activeTab = ref('datos')
const TABS = computed(() => [
  { key: 'datos',      label: 'Datos',          icon: InfoIcon },
  { key: 'cantidades', label: 'Cantidades',     icon: ChartColumnIcon,
    badge: contrato.value?.compromisos_energia?.length || null },
  { key: 'tarifas',    label: 'Tarifas',        icon: DollarSignIcon,
    badge: contrato.value?.tarifas?.length || null },
  { key: 'asic',       label: 'Contratos ASIC', icon: BookIcon,
    badge: asicFiltrados.value?.length || null },
  { key: 'proyectos',  label: 'Proyectos',      icon: ZapIcon,
    badge: contrato.value?.proyectos?.length || null },
])

const contrato = ref(null)
const loading = ref(true)

// Edición inline de identificación
const editandoId = ref(false)
const guardandoId = ref(false)
const formId = reactive({ nombre_interno: null, numero_codigo_contrato: null })

function iniciarEdicionId() {
  formId.nombre_interno = contrato.value.nombre_interno
  formId.numero_codigo_contrato = contrato.value.numero_codigo_contrato
  editandoId.value = true
}

function cancelarEdicionId() {
  editandoId.value = false
}

async function guardarId() {
  guardandoId.value = true
  try {
    const data = await ppaService.actualizar(contrato.value.id, {
      nombre_interno: formId.nombre_interno || null,
      numero_codigo_contrato: formId.numero_codigo_contrato || null,
    })
    contrato.value = { ...contrato.value, ...data }
    editandoId.value = false
    toast.success('Guardado', { description: 'Identificación actualizada', duration: 2500 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoId.value = false
  }
}

// Edición inline de partes
const editandoPartes = ref(false)
const guardandoPartes = ref(false)
// Los `*_id` son los que de verdad vinculan la parte con el cliente. Un contrato
// viejo llega con el nombre y sin id: el selector lo muestra como pendiente y no
// deja guardar hasta resolverlo.
const formPartes = reactive({
  comprador_id: null, comprador_nombre: null, comprador_nit: null,
  vendedor_id: null, vendedor_nombre: null, vendedor_nit: null,
})

function iniciarEdicionPartes() {
  formPartes.comprador_id = contrato.value.comprador_id ?? null
  formPartes.comprador_nombre = contrato.value.comprador_nombre
  formPartes.comprador_nit = contrato.value.comprador_nit
  formPartes.vendedor_id = contrato.value.vendedor_id ?? null
  formPartes.vendedor_nombre = contrato.value.vendedor_nombre
  formPartes.vendedor_nit = contrato.value.vendedor_nit
  editandoPartes.value = true
}

function cancelarEdicionPartes() {
  editandoPartes.value = false
}

async function guardarPartes() {
  guardandoPartes.value = true
  try {
    // Solo el cliente de cada lado: nombre y NIT son los de su ficha.
    const data = await ppaService.actualizar(contrato.value.id, {
      comprador_id: formPartes.comprador_id,
      vendedor_id: formPartes.vendedor_id,
    })
    contrato.value = { ...contrato.value, ...data }
    editandoPartes.value = false
    toast.success('Guardado', { description: 'Partes del contrato actualizadas', duration: 3000 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoPartes.value = false
  }
}

// ── Enlace al contrato (carpeta_link) ───────────────────────────────────────
// El campo ya existía en el modelo pero no se veía ni se editaba en ningún
// lado: el PPA se creaba con enlace desde la oferta firmada y después no había
// forma de ponerlo o corregirlo. Acá se edita inline como las demás secciones.
const editandoEnlace = ref(false)
const guardandoEnlace = ref(false)
const formEnlace = reactive({ carpeta_link: '' })

// Solo se muestra como enlace si es navegable: un texto suelto en el campo no
// debe convertirse en un <a href> roto (o peor, en una ruta relativa del SPA).
const enlaceContrato = computed(() => {
  const url = (contrato.value?.carpeta_link || '').trim()
  return /^https?:\/\//i.test(url) ? url : ''
})

function iniciarEdicionEnlace() {
  formEnlace.carpeta_link = contrato.value.carpeta_link || ''
  editandoEnlace.value = true
}

async function guardarEnlace() {
  const url = (formEnlace.carpeta_link || '').trim()
  if (url && !/^https?:\/\//i.test(url)) {
    toast.warning('Enlace inválido', { description: 'Debe empezar por http:// o https://', duration: 3500 })
    return
  }
  guardandoEnlace.value = true
  try {
    const data = await ppaService.actualizar(contrato.value.id, { carpeta_link: url || null })
    contrato.value = { ...contrato.value, ...data }
    editandoEnlace.value = false
    toast.success('Guardado', {
      description: url ? 'Enlace del contrato actualizado' : 'Enlace eliminado',
      duration: 2500,
    })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoEnlace.value = false
  }
}

// ── Tarjetas de resumen de la pestaña Datos ─────────────────────────────────
// El estado de vigencia se calcula en utils/ppaVigencia.js porque el listado
// de /servicios-unificado muestra el mismo estado en su columna Estado.
const estadoVigencia = computed(() => estadoVigenciaPPA(contrato.value))

const tarifaBaseFmt = computed(() => {
  const v = contrato.value?.tarifa_base
  return v != null ? `$${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 4 })}` : null
})

// Estos cuatro campos son de los contratos de SERVICIO, no de los PPA: el
// endpoint /ppa nunca los devuelve. Se mantiene la sección por si algún día
// llegan, pero oculta mientras estén vacíos en vez de mostrar cuatro guiones.
const tieneDetallesOperacionales = computed(() => {
  const c = contrato.value
  return !!(c?.service_scope || c?.specific_service_terms || c?.slas || c?.responsibilities)
})

const vistaCantidades = ref('mensual')
const vistaTarifas = ref('mensual')

// Plantas inscritas (calculadas por la plataforma): "año-mes" -> nº de plantas registradas
// y despachando energía al contrato vía GESCON. Numerador del cumplimiento de plantas.
const plantasInscritasMap = ref({})

// Edición tarifas
const editandoTarifas = ref(false)
const guardandoTarifas = ref(false)
const tarifasPaste = ref('')
const tarifasRows = ref([])
const tarifasError = ref('')

// Edición cantidades
const editandoCantidades = ref(false)
const guardandoCantidades = ref(false)
const energiaPaste = ref('')
const energiaRows = ref([])
const energiaError = ref('')

const MESES_ES = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12,
}

function splitRow(line) {
  return line.includes('\t') ? line.split('\t') : line.split(',')
}

function parseMes(raw) {
  const s = String(raw).trim()
  const num = parseInt(s, 10)
  if (!isNaN(num) && num >= 1 && num <= 12) return num
  return MESES_ES[s.toLowerCase()] ?? null
}

function parseTarifas() {
  tarifasError.value = ''
  const lines = tarifasPaste.value.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  for (const [i, line] of lines.entries()) {
    const cols = splitRow(line)
    if (cols.length < 3) { tarifasError.value = `Fila ${i + 1}: se esperan 3 columnas`; tarifasRows.value = []; return }
    const año = parseInt(cols[0].trim(), 10)
    const mes = parseMes(cols[1].trim())
    const tarifa = parseFloat(cols[2].trim().replace(',', '.'))
    if (isNaN(año) || !mes || isNaN(tarifa)) { tarifasError.value = `Fila ${i + 1}: datos inválidos`; tarifasRows.value = []; return }
    rows.push({ año, mes, tarifa })
  }
  tarifasRows.value = rows
}

function parseEnergia() {
  energiaError.value = ''
  const lines = energiaPaste.value.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  for (const [i, line] of lines.entries()) {
    const cols = splitRow(line)
    if (cols.length < 3) { energiaError.value = `Fila ${i + 1}: se esperan al menos 3 columnas (Año · Mes · Mín)`; energiaRows.value = []; return }
    const año = parseInt(cols[0].trim(), 10)
    const mes = parseMes(cols[1].trim())
    const min = parseFloat(cols[2].trim().replace(',', '.'))
    const max = cols[3] ? parseFloat(cols[3].trim().replace(',', '.')) : null
    const plantasRaw = cols[4] ? cols[4].trim() : ''
    const plantas = plantasRaw ? parseInt(plantasRaw.replace(',', '.'), 10) : null
    if (isNaN(año) || !mes || isNaN(min)) { energiaError.value = `Fila ${i + 1}: datos inválidos`; energiaRows.value = []; return }
    rows.push({
      año, mes,
      energia_minima: min,
      energia_maxima: (max !== null && !isNaN(max)) ? max : null,
      cantidad_proyectos: (plantas !== null && !isNaN(plantas)) ? plantas : null,
    })
  }
  energiaRows.value = rows
}

function onPasteTarifas() { setTimeout(parseTarifas, 50) }
function onPasteEnergia() { setTimeout(parseEnergia, 50) }

async function guardarTarifas() {
  guardandoTarifas.value = true
  try {
    const data = await ppaService.guardarTarifas(contrato.value.id, tarifasRows.value)
    contrato.value = { ...contrato.value, tarifas: data }
    editandoTarifas.value = false
    tarifasPaste.value = ''; tarifasRows.value = []
    toast.success('Guardado', { description: `${data.length} tarifas actualizadas`, duration: 2500 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoTarifas.value = false
  }
}

async function guardarCantidades() {
  guardandoCantidades.value = true
  try {
    const data = await ppaService.guardarCompromisos(contrato.value.id, energiaRows.value)
    contrato.value = { ...contrato.value, compromisos_energia: data }
    editandoCantidades.value = false
    energiaPaste.value = ''; energiaRows.value = []
    cargarPlantasInscritas()  // los periodos pudieron cambiar → recalcular inscritas
    toast.success('Guardado', { description: `${data.length} compromisos actualizados`, duration: 2500 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoCantidades.value = false
  }
}
const asicRows = ref([])
const loadingAsic = ref(false)
const vistaAsic = ref('vigentes')

const asicFiltrados = computed(() => {
  if (vistaAsic.value === 'historicos') return asicRows.value
  const hoy = new Date().toISOString().slice(0, 10)
  return asicRows.value.filter(r => r.fecha_fin && r.fecha_fin >= hoy)
})

const duracion = computed(() => {
  if (!contrato.value?.fecha_inicio || !contrato.value?.fecha_fin) return null
  const a = new Date(contrato.value.fecha_inicio)
  const b = new Date(contrato.value.fecha_fin)
  const meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  const años = Math.floor(meses / 12)
  const resto = meses % 12
  return años > 0
    ? `${años} año${años !== 1 ? 's' : ''}${resto > 0 ? ` ${resto} mes${resto !== 1 ? 'es' : ''}` : ''}`
    : `${meses} mes${meses !== 1 ? 'es' : ''}`
})

function formatFecha(f) {
  if (!f) return null
  return String(f).slice(0, 10)
}

function variacion(prev, curr) {
  const pct = ((curr - prev) / prev) * 100
  if (pct === 0) return '—'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

// ── Formato y semáforos compartidos por las pestañas de datos ───────────────
const hoyPeriodo = { año: new Date().getFullYear(), mes: new Date().getMonth() + 1 }

function fmtNum(v, dec = 1) {
  if (v == null) return '—'
  return Number(v).toLocaleString('es-CO', { maximumFractionDigits: dec })
}

function fmtCOP(v, dec = 2) {
  if (v == null) return '—'
  return `$${Number(v).toLocaleString('es-CO', { maximumFractionDigits: dec })}`
}

function varPct(prev, curr) {
  if (!prev) return null
  return ((curr - prev) / prev) * 100
}

// En una tarifa de venta, subir es bueno para nosotros; el color solo marca la
// dirección (verde sube / rojo baja), no un juicio de valor.
function varColor(pct) {
  if (pct == null || pct === 0) return '#9b89b5'
  return pct > 0 ? '#059669' : '#dc2626'
}

function varBg(pct) {
  if (pct == null || pct === 0) return '#f4f1f9'
  return pct > 0 ? '#ecfdf5' : '#fef2f2'
}

function varIcono(pct) {
  if (pct == null || pct === 0) return MinusIcon
  return pct > 0 ? ArrowUpRightIcon : ArrowDownRightIcon
}

// Verde si las plantas inscritas ya cubren lo que el contrato exige ese mes.
// Sin cantidad_proyectos no hay contra qué comparar: se muestra neutro.
function plantasClase(row) {
  if (row.cantidad_proyectos == null) return 'bg-muted text-muted-foreground'
  return row.plantas_inscritas >= row.cantidad_proyectos ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
}

const resumenCantidades = computed(() => {
  const rows = cantidadesMensuales.value
  if (!rows.length) return null
  const años = rows.map(r => r.año)
  const delAñoActual = rows.filter(r => r.año === hoyPeriodo.año)
  const conRango = rows.filter(r => r.energia_minima > 0 && r.energia_maxima != null)
  return {
    periodos: rows.length,
    añoMin: Math.min(...años),
    añoMax: Math.max(...años),
    tieneAñoActual: delAñoActual.length > 0,
    totalAñoActual: delAñoActual.reduce((acc, r) => acc + (r.energia_minima ?? 0), 0),
    actual: rows.find(r => r.año === hoyPeriodo.año && r.mes === hoyPeriodo.mes) || null,
    flex: conRango.length
      ? conRango.reduce((acc, r) => acc + (r.energia_maxima / r.energia_minima - 1), 0) / conRango.length * 100
      : null,
  }
})

const resumenTarifas = computed(() => {
  const rows = tarifasMensuales.value
  if (!rows.length) return null
  const vals = rows.map(r => Number(r.tarifa)).filter(v => !isNaN(v))
  // Si no hay tarifa del mes en curso se muestra la última cargada, que es la
  // que el equipo va a querer ver (los PPA se cargan con meses de adelanto).
  const iMes = rows.findIndex(r => r.año === hoyPeriodo.año && r.mes === hoyPeriodo.mes)
  const i = iMes >= 0 ? iMes : rows.length - 1
  const años = rows.map(r => r.año)
  return {
    periodos: rows.length,
    añoMin: Math.min(...años),
    añoMax: Math.max(...años),
    vigente: rows[i],
    esDelMes: iMes >= 0,
    varPct: i > 0 ? varPct(Number(rows[i - 1].tarifa), Number(rows[i].tarifa)) : null,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
  }
})

const resumenAsic = computed(() => {
  const rows = asicRows.value
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    total: rows.length,
    vigentes: rows.filter(r => r.fecha_fin && r.fecha_fin >= hoy).length,
    publicados: rows.filter(r => r.estado_solicitud === 'publicado').length,
    enProceso: rows.filter(r => r.estado_solicitud === 'en_proceso').length,
  }
})

const proyectosOrdenados = computed(() =>
  [...(contrato.value?.proyectos ?? [])].sort((a, b) =>
    (a.nombre_comercial ?? '').localeCompare(b.nombre_comercial ?? '')))

function agregarPorAño(rows, campos, modo) {
  const byYear = {}
  for (const r of rows) {
    ;(byYear[r.año] = byYear[r.año] || []).push(r)
  }
  return Object.keys(byYear).sort((a, b) => a - b).map(año => {
    const filas = byYear[año]
    const uniforme = campos.every(c => filas.every(f => f[c] === filas[0][c]))
    const entry = { año: Number(año), _uniforme: uniforme }
    for (const c of campos) {
      const sum = filas.reduce((acc, f) => acc + (f[c] ?? 0), 0)
      entry[c] = modo === 'suma' ? sum : sum / filas.length
    }
    return entry
  })
}

const tarifasMensuales = computed(() => {
  if (!contrato.value?.tarifas) return []
  return [...contrato.value.tarifas].sort((a, b) => a.año - b.año || a.mes - b.mes)
})

const tarifasAnuales = computed(() => {
  if (!contrato.value?.tarifas) return []
  return agregarPorAño(tarifasMensuales.value, ['tarifa'], 'promedio')
})

const currentTarifas = computed(() =>
  vistaTarifas.value === 'anual' ? tarifasAnuales.value : tarifasMensuales.value
)

const cantidadesMensuales = computed(() => {
  if (!contrato.value?.compromisos_energia) return []
  return [...contrato.value.compromisos_energia]
    .sort((a, b) => a.año - b.año || a.mes - b.mes)
    .map(r => ({ ...r, plantas_inscritas: plantasInscritasMap.value[`${r.año}-${r.mes}`] ?? null }))
})

const cantidadesAnuales = computed(() => {
  if (!contrato.value?.compromisos_energia) return []
  const base = agregarPorAño(cantidadesMensuales.value, ['energia_minima', 'energia_maxima'], 'suma')
  // Plantas (contrato e inscritas) no se suman entre meses: por año mostramos el máximo.
  const maxContratoByYear = {}
  const maxInscritasByYear = {}
  for (const r of cantidadesMensuales.value) {
    if (r.cantidad_proyectos != null)
      maxContratoByYear[r.año] = Math.max(maxContratoByYear[r.año] ?? 0, r.cantidad_proyectos)
    if (r.plantas_inscritas != null)
      maxInscritasByYear[r.año] = Math.max(maxInscritasByYear[r.año] ?? 0, r.plantas_inscritas)
  }
  return base.map(e => ({
    ...e,
    cantidad_proyectos: maxContratoByYear[e.año] ?? null,
    plantas_inscritas: maxInscritasByYear[e.año] ?? null,
  }))
})

// Wizard edición completa
const showWizard = ref(false)
const wizardInitialData = ref(null)
const wizardEditandoId = ref(null)

function abrirEdicionCompleta() {
  wizardInitialData.value = { ...contrato.value }
  wizardEditandoId.value = contrato.value.id
  showWizard.value = true
}

function onWizardEditado() {
  showWizard.value = false
  cargar()
  toast.success('Contrato actualizado', { duration: 2000 })
}

function onWizardCreado() {
  showWizard.value = false
  cargar()
}

// Asociar proyecto
const showAsociar = ref(false)
const proyectoSeleccionado = ref(null)
const todosProyectos = ref([])
const cargandoProyectos = ref(false)
const asociando = ref(false)

const todosProyectosDisponibles = computed(() => {
  const asociadosIds = new Set((contrato.value?.proyectos ?? []).map(p => p.id))
  return todosProyectos.value.filter(p => !asociadosIds.has(p.id))
})

async function abrirAsociar() {
  showAsociar.value = true
  proyectoSeleccionado.value = null
  if (todosProyectos.value.length) return
  cargandoProyectos.value = true
  try {
    const proyectos = await catalogoProyectos.cargar()
    todosProyectos.value = proyectos.sort((a, b) =>
      (a.nombre_comercial ?? '').localeCompare(b.nombre_comercial ?? ''))
  } catch (e) {
    toast.error('Error', { description: e.message, duration: 3000 })
  } finally {
    cargandoProyectos.value = false
  }
}

/**
 * Asocia una planta al contrato con `PATCH /ppa/:id`.
 *
 * Antes llamaba a `POST /ppa/:id/proyectos`, que NO EXISTE —ni en Django ni en
 * el FastAPI de antes—: siempre respondió 404 y la planta nunca se guardó.
 *
 * Dos cuidados, los dos por lo mismo: `proyecto_ids` REEMPLAZA el conjunto.
 *
 * 1. Se manda la lista completa (`idsConPlantaAgregada`). Mandar solo la nueva
 *    borraría las demás en la base.
 * 2. Se relee el contrato JUSTO ANTES de armarla. Dos personas con el detalle
 *    abierto tienen cada una su copia; la segunda en guardar mandaría su lista
 *    —sin la planta que agregó la primera— y la borraría. El GET extra ocurre
 *    solo al guardar.
 *
 * La pantalla se actualiza con lo que devuelve el PATCH, no con el objeto del
 * catálogo: quién está vinculado al contrato lo decide el backend.
 */
async function asociarProyecto() {
  if (!proyectoSeleccionado.value) return
  asociando.value = true
  try {
    const actual = await ppaService.obtener(contrato.value.id)
    if (yaEstaVinculada(actual.proyectos, proyectoSeleccionado.value)) {
      contrato.value.proyectos = actual.proyectos
      showAsociar.value = false
      toast.info('Ya estaba asociado', {
        description: proyectoSeleccionado.value.nombre_comercial,
        duration: 2500,
      })
      return
    }

    const data = await ppaService.actualizar(contrato.value.id, {
      proyecto_ids: idsConPlantaAgregada(actual.proyectos, proyectoSeleccionado.value),
    })
    contrato.value.proyectos = data.proyectos
    showAsociar.value = false
    toast.success('Proyecto asociado', {
      description: proyectoSeleccionado.value.nombre_comercial,
      duration: 2500,
    })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    asociando.value = false
  }
}

async function cargarPlantasInscritas() {
  if (!contrato.value?.id) return
  try {
    const filas = await ppaService.listarPlantasInscritasPorMes(contrato.value.id)
    const map = {}
    for (const r of filas) map[`${r.año}-${r.mes}`] = r.plantas_inscritas
    plantasInscritasMap.value = map
  } catch (e) {
    // No bloquea la pestaña: si falla, la columna muestra "—".
    plantasInscritasMap.value = {}
  }
}

async function cargar() {
  loading.value = true
  try {
    const data = await ppaService.obtener(route.params.id)
    contrato.value = data
    cargarPlantasInscritas()
    cargarAsic(data)
  } catch (e) {
    toast.error('Error', { description: e.message, duration: 3000 })
  } finally {
    loading.value = false
  }
}

/**
 * Los registros GESCON del contrato, por LLAVE y no por texto.
 *
 * Antes filtraba por `contrato_interno`, que empareja el codigo del contrato
 * como cadena: si alguien edita `numero_codigo_contrato`, los registros dejan de
 * aparecer y nadie se entera. `contrato_ppa_id` es la FK, y es la fuente de
 * verdad del vinculo PPA-GESCON.
 *
 * El texto se conserva como RESPALDO para los registros historicos que nunca
 * recibieron la FK -- el mismo criterio que usa el backend en
 * `validar_fecha_fin_vs_asic`, que busca por llave O por codigo.
 */
async function cargarAsic(c) {
  loadingAsic.value = true
  try {
    let filas = await ppaService.listarAsic({ contrato_ppa_id: c.id })
    if (!filas.length && c.numero_codigo_contrato) {
      filas = await ppaService.listarAsic({ contrato_interno: c.numero_codigo_contrato })
    }
    asicRows.value = filas
  } catch (e) {
    toast.warning('ASIC', { description: 'No se pudieron cargar registros ASIC', duration: 3000 })
  } finally {
    loadingAsic.value = false
  }
}

onMounted(cargar)
</script>
<style scoped>
/* PrimeVue renderiza la tabla fuera del alcance de :scoped: hace falta :deep.
   No controlamos el markup de DataTable, por eso estas reglas viven aquí. */
.cd-tabla :deep(.p-datatable-thead > tr > th) {
  background: color-mix(in oklab, var(--muted) 50%, transparent);
  color: var(--muted-foreground);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
}
.cd-tabla :deep(.p-datatable-tbody > tr > td) {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
  color: var(--foreground);
}
.cd-tabla :deep(.p-datatable-tbody > tr:last-child > td) { border-bottom: none; }
.cd-tabla :deep(.p-datatable-tbody > tr.p-row-odd) { background: color-mix(in oklab, var(--muted) 20%, transparent); }
.cd-tabla :deep(.p-datatable-tbody > tr:hover) { background: color-mix(in oklab, var(--primary) 6%, transparent); }
.cd-tabla :deep(.p-paginator) {
  background: color-mix(in oklab, var(--muted) 50%, transparent);
  border-top: 1px solid var(--border);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);
}
.cd-tabla :deep(.cd-th-der .p-datatable-column-header-content) { justify-content: flex-end; }
</style>
