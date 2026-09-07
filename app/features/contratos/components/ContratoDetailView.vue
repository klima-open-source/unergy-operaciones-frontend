<template>
  <div v-if="contrato">
    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=servicios&srv=ppa', label: 'Servicios' }"
                   :titulo="contrato.nombre_interno || contrato.numero_codigo_contrato || 'Contrato PPA'"
                   :codigo="contrato.numero_codigo_contrato || ''"
                   :tabs="TABS" v-model="activeTab">
      <template #chips>
        <GBadge color="warning" class="text-[10px]">PPA</GBadge>
        <GBadge :color="(contrato.tipo_contrato === 'compra') ? '#915BD8' : '#F6FF72'" class="text-[10px]">{{ (contrato.tipo_contrato === 'compra') ? 'Compra' : 'Venta' }}</GBadge>
      </template>
      <template #acciones>
        <!-- Atajo al contrato: el enlace se guarda en la pestaña Datos -->
        <a v-if="enlaceContrato" :href="enlaceContrato" target="_blank" rel="noopener noreferrer"
          class="cd-head-link" v-tooltip.bottom="'Abrir el contrato en Drive'">
          <ExternalLinkIcon class="size-[1em]" />Contrato
        </a>
        <Button label="Editar contrato" severity="secondary" outlined size="small" @click="abrirEdicionCompleta">
          <template #icon><PencilIcon class="size-[1em]" /></template>
        </Button>
      </template>
      <template #default="{ tab }">
      <!-- ══ DATOS ══ -->
      <div v-if="tab === 'datos'" class="space-y-4">

        <!-- ── Resumen: lo que se quiere saber de un vistazo ─────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="cd-stat"
            :style="`background:${estadoVigencia.bg};border-color:${estadoVigencia.borde}`">
            <p class="cd-stat-lbl" :style="`color:${estadoVigencia.color}`">
              <CircleIcon class="size-[1em] fill-current" style="font-size:6px" />Estado
            </p>
            <p class="cd-stat-val" :style="`color:${estadoVigencia.color}`">{{ estadoVigencia.label }}</p>
            <p class="cd-stat-sub" :style="`color:${estadoVigencia.color};opacity:.7`">{{ estadoVigencia.detalle }}</p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><ClockIcon class="size-[1em]" style="font-size:9px" />Duración</p>
            <p class="cd-stat-val">{{ duracion || '—' }}</p>
            <p class="cd-stat-sub">
              {{ formatFecha(contrato.fecha_inicio) || '—' }} → {{ formatFecha(contrato.fecha_fin) || '—' }}
            </p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><ChartLineIcon class="size-[1em]" style="font-size:9px" />Indexación</p>
            <p class="cd-stat-val">{{ contrato.indice_indexacion || '—' }}</p>
            <p class="cd-stat-sub">
              {{ contrato.periodicidad_indexacion || 'sin periodicidad' }}<template v-if="contrato.periodo_indexacion_base"> · base {{ contrato.periodo_indexacion_base }}</template>
            </p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><FileIcon class="size-[1em]" style="font-size:9px" />Facturación</p>
            <p class="cd-stat-val">{{ contrato.periodicidad_facturacion || '—' }}</p>
            <p class="cd-stat-sub">
              {{ contrato.tiempo_pago != null ? ('pago a ' + contrato.tiempo_pago + ' días') : 'sin plazo de pago' }}
            </p>
          </div>
        </div>

        <!-- ── Identificación ────────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#915BD818"><IdCardIcon class="size-[1em]" style="color:var(--color-unergy-purple)" /></span>
            <h3 class="cd-sec-title">Identificación</h3>
            <div class="cd-sec-act">
              <Button v-if="!editandoId" label="Editar" size="small" text severity="secondary" @click="iniciarEdicionId">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="cancelarEdicionId" />
                <Button label="Guardar" size="small" :loading="guardandoId" @click="guardarId">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <!-- Modo lectura -->
            <div v-if="!editandoId" class="cd-grid">
              <InfoField label="Nombre interno" :value="contrato.nombre_interno" />
              <InfoField label="Número de contrato" :value="contrato.numero_codigo_contrato" />
              <InfoField label="Tipo de contrato" :value="contrato.tipo_contrato === 'compra' ? 'Compra' : 'Venta'" />
              <InfoField label="Responsable" :value="contrato.responsable?.nombre" />
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Comunidad energética</span>
                <div>
                  <GBadge v-if="contrato.es_comunidad_energetica" color="success" class="text-[10px]">🏘 Sí</GBadge>
                  <span v-else class="text-sm" style="color:var(--color-unergy-deep)">{{ contrato.es_comunidad_energetica === false ? 'No' : '—' }}</span>
                </div>
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="cd-grid">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Nombre interno</label>
                <InputText v-model="formId.nombre_interno" placeholder="Ej: Terpel 1" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Número de contrato</label>
                <InputText v-model="formId.numero_codigo_contrato" placeholder="Ej: UNERGY 001-2023" class="w-full" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Partes del contrato ───────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#3b82f618"><UsersIcon class="size-[1em]" style="color:#3b82f6" /></span>
            <h3 class="cd-sec-title">Partes del contrato</h3>
            <div class="cd-sec-act">
              <Button v-if="!editandoPartes" label="Editar" size="small" text severity="secondary" @click="iniciarEdicionPartes">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="cancelarEdicionPartes" />
                <Button label="Guardar" size="small" :loading="guardandoPartes" @click="guardarPartes">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <!-- Modo lectura: la energía va del vendedor al comprador -->
            <div v-if="!editandoPartes" class="cd-partes">
              <div class="cd-parte">
                <p class="cd-parte-rol"><SunIcon class="size-[1em]" style="font-size:9px" />Vendedor</p>
                <p class="cd-parte-nom">{{ contrato.vendedor_nombre || '—' }}</p>
                <p class="cd-parte-nit">NIT {{ contrato.vendedor_nit || '—' }}</p>
              </div>
              <ArrowRightIcon class="cd-partes-flecha size-[1em]" />
              <div class="cd-parte">
                <p class="cd-parte-rol"><BuildingIcon class="size-[1em]" style="font-size:9px" />Comprador</p>
                <p class="cd-parte-nom">{{ contrato.comprador_nombre || '—' }}</p>
                <p class="cd-parte-nit">NIT {{ contrato.comprador_nit || '—' }}</p>
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="cd-parte space-y-3">
                <p class="cd-parte-rol"><SunIcon class="size-[1em]" style="font-size:9px" />Vendedor</p>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">Nombre / Razón social</label>
                  <InputText v-model="formPartes.vendedor_nombre" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">NIT</label>
                  <InputText v-model="formPartes.vendedor_nit" class="w-full" />
                </div>
              </div>
              <div class="cd-parte space-y-3">
                <p class="cd-parte-rol"><BuildingIcon class="size-[1em]" style="font-size:9px" />Comprador</p>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">Nombre / Razón social</label>
                  <InputText v-model="formPartes.comprador_nombre" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">NIT</label>
                  <InputText v-model="formPartes.comprador_nit" class="w-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Vigencia ──────────────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#10b98118"><CalendarIcon class="size-[1em]" style="color:#10b981" /></span>
            <h3 class="cd-sec-title">Vigencia</h3>
          </header>
          <div class="cd-sec-body">
            <div class="cd-grid">
              <InfoField label="Fecha inicio" :value="formatFecha(contrato.fecha_inicio)" />
              <InfoField label="Fecha fin" :value="formatFecha(contrato.fecha_fin)" />
              <InfoField label="Duración" :value="duracion" />
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Renovación automática</span>
                <div>
                  <GBadge v-if="contrato.renovacion_automatica != null"
                    :color="contrato.renovacion_automatica ? 'success' : 'default'"
                    class="text-[10px]">{{ contrato.renovacion_automatica ? 'Sí' : 'No' }}</GBadge>
                  <span v-else class="text-sm" style="color:var(--color-unergy-deep)">—</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Condiciones comerciales ───────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#f59e0b18"><DollarSignIcon class="size-[1em]" style="color:#f59e0b" /></span>
            <h3 class="cd-sec-title">Condiciones comerciales</h3>
          </header>
          <div class="cd-sec-body">
            <div class="cd-grid">
              <InfoField label="Índice de indexación" :value="contrato.indice_indexacion" />
              <InfoField label="Periodicidad indexación" :value="contrato.periodicidad_indexacion" />
              <InfoField label="Período base indexación" :value="contrato.periodo_indexacion_base" />
              <InfoField label="Valor indexación base"
                :value="contrato.valor_indexacion_base != null ? String(contrato.valor_indexacion_base) : null" />
              <InfoField label="Tarifa base ($/kWh)" :value="tarifaBaseFmt" />
              <InfoField label="Periodicidad facturación" :value="contrato.periodicidad_facturacion" />
              <InfoField label="Tiempo de pago (días)"
                :value="contrato.tiempo_pago != null ? String(contrato.tiempo_pago) : null" />
              <div v-if="contrato.condiciones_pago" class="cd-ancho flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Condiciones de pago</span>
                <span class="text-sm whitespace-pre-line" style="color:var(--color-unergy-deep)">{{ contrato.condiciones_pago }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ── GESCON / SIC ──────────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#6366f118"><BookIcon class="size-[1em]" style="color:#6366f1" /></span>
            <h3 class="cd-sec-title">GESCON / SIC</h3>
            <div class="cd-sec-act">
              <Button v-if="!editandoGescon" label="Editar" size="small" text severity="secondary" @click="editandoGescon = true">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="editandoGescon = false" />
                <Button label="Guardar" size="small" :loading="guardandoGescon" @click="guardarGescon">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <!-- Modo lectura -->
            <div v-if="!editandoGescon" class="cd-grid">
              <InfoField label="Código SIC" :value="contrato.codigo_sic" />
              <InfoField label="Código GESCON" :value="contrato.gescon_codigo" />
              <InfoField label="GESCON inicio" :value="formatFecha(contrato.gescon_fecha_inicio)" />
              <InfoField label="GESCON fin" :value="formatFecha(contrato.gescon_fecha_fin)" />
              <InfoField label="Precio GESCON" :value="gesconPrecioFmt" />
              <InfoField label="Cantidades GESCON (kWh)" :value="gesconCantidadesFmt" />
            </div>
            <!-- Modo edición -->
            <div v-else class="cd-grid">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Código SIC</label>
                <InputText v-model="formGescon.codigo_sic" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Código GESCON</label>
                <InputText v-model="formGescon.gescon_codigo" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Precio GESCON ($/kWh)</label>
                <InputNumber v-model="formGescon.gescon_precio" :maxFractionDigits="4" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">GESCON inicio</label>
                <DatePicker v-model="formGescon.gescon_fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">GESCON fin</label>
                <DatePicker v-model="formGescon.gescon_fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Cantidades GESCON (kWh)</label>
                <InputNumber v-model="formGescon.gescon_cantidades_kwh" :maxFractionDigits="3" locale="en-US" class="w-full" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Documentos y enlaces ──────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#d9770618"><LinkIcon class="size-[1em]" style="color:#d97706" /></span>
            <h3 class="cd-sec-title">Documentos y enlaces</h3>
            <div class="cd-sec-act">
              <Button v-if="!editandoEnlace"
                :label="enlaceContrato ? 'Editar' : 'Agregar enlace'"
                size="small" text severity="secondary" @click="iniciarEdicionEnlace">
                <template #icon><component :is="enlaceContrato ? PencilIcon : PlusIcon" class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="editandoEnlace = false" />
                <Button label="Guardar" size="small" :loading="guardandoEnlace" @click="guardarEnlace">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <!-- Modo lectura -->
            <div v-if="!editandoEnlace" class="cd-link" :class="{ 'cd-link--vacio': !enlaceContrato }">
              <span class="cd-ico" style="background:#fef3c7">
                <FileTextIcon class="size-[1em]" style="color:#d97706" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium mb-0.5" style="color:#92400e">Contrato en Drive</p>
                <a v-if="enlaceContrato" :href="enlaceContrato" target="_blank" rel="noopener noreferrer"
                  class="text-sm font-semibold inline-flex items-center gap-1.5 hover:underline" style="color:#d97706">
                  <ExternalLinkIcon class="text-xs size-[1em]" />Ver contrato
                </a>
                <button v-else type="button" class="cd-link-add" @click="iniciarEdicionEnlace">
                  <CirclePlusIcon class="text-xs size-[1em]" />Agregar enlace
                </button>
                <p v-if="enlaceContrato" class="text-[11px] truncate mt-0.5" style="color:#b4884f">
                  {{ enlaceContrato }}
                </p>
              </div>
            </div>
            <!-- Modo edición -->
            <div v-else class="flex flex-col gap-1 max-w-xl">
              <label class="cd-lbl">Enlace al contrato (Drive, Dropbox, SharePoint…)</label>
              <InputText v-model.trim="formEnlace.carpeta_link" class="w-full"
                placeholder="https://drive.google.com/…" @keyup.enter="guardarEnlace" />
              <small class="text-[11px]" style="color:#9b89b5">
                Debe empezar por <span class="font-mono">http://</span> o <span class="font-mono">https://</span>.
                Déjalo vacío para quitar el enlace.
              </small>
            </div>
          </div>
        </section>

        <!-- ── Detalles operacionales (solo si el contrato los trae) ─── -->
        <section v-if="tieneDetallesOperacionales" class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#64748b18"><ListIcon class="size-[1em]" style="color:#64748b" /></span>
            <h3 class="cd-sec-title">Detalles operacionales y contractuales</h3>
          </header>
          <div class="cd-sec-body space-y-3">
            <div v-if="contrato.service_scope" class="flex flex-col gap-0.5">
              <span class="cd-campo-lbl">Alcance del servicio</span>
              <span class="text-sm whitespace-pre-line" style="color:var(--color-unergy-deep)">{{ contrato.service_scope }}</span>
            </div>
            <div v-if="contrato.specific_service_terms" class="flex flex-col gap-0.5">
              <span class="cd-campo-lbl">Términos específicos del servicio</span>
              <span class="text-sm whitespace-pre-line" style="color:var(--color-unergy-deep)">{{ contrato.specific_service_terms }}</span>
            </div>
            <div v-if="contrato.slas" class="flex flex-col gap-0.5">
              <span class="cd-campo-lbl">SLAs (Acuerdos de nivel de servicio)</span>
              <span class="text-sm whitespace-pre-line" style="color:var(--color-unergy-deep)">{{ contrato.slas }}</span>
            </div>
            <div v-if="contrato.responsibilities" class="flex flex-col gap-0.5">
              <span class="cd-campo-lbl">Responsabilidades</span>
              <span class="text-sm whitespace-pre-line" style="color:var(--color-unergy-deep)">{{ contrato.responsibilities }}</span>
            </div>
          </div>
        </section>

      </div>

      <!-- ══ CANTIDADES ══ -->
      <div v-if="tab === 'cantidades'" class="space-y-4">

        <!-- Resumen -->
        <div v-if="resumenCantidades && !editandoCantidades" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="cd-stat">
            <p class="cd-stat-lbl"><CalendarIcon class="size-[1em]" style="font-size:9px" />Períodos</p>
            <p class="cd-stat-val">{{ resumenCantidades.periodos }} meses</p>
            <p class="cd-stat-sub">{{ resumenCantidades.añoMin }} – {{ resumenCantidades.añoMax }}</p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><ZapIcon class="size-[1em]" style="font-size:9px" />Compromiso {{ hoyPeriodo.año }}</p>
            <p class="cd-stat-val">{{ fmtNum(resumenCantidades.totalAñoActual) }} MWh</p>
            <p class="cd-stat-sub">
              {{ resumenCantidades.tieneAñoActual ? 'suma de mínimos del año' : 'sin compromisos este año' }}
            </p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><ClockIcon class="size-[1em]" style="font-size:9px" />Mes en curso</p>
            <p class="cd-stat-val">
              {{ resumenCantidades.actual ? fmtNum(resumenCantidades.actual.energia_minima) + ' MWh' : '—' }}
            </p>
            <p class="cd-stat-sub">
              <template v-if="resumenCantidades.actual">
                {{ resumenCantidades.actual.plantas_inscritas ?? '—' }} de
                {{ resumenCantidades.actual.cantidad_proyectos ?? '—' }} plantas
              </template>
              <template v-else>{{ MESES[hoyPeriodo.mes - 1] }} sin registro</template>
            </p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><MoveHorizontalIcon class="size-[1em]" style="font-size:9px" />Flexibilidad</p>
            <p class="cd-stat-val">
              {{ resumenCantidades.flex != null ? resumenCantidades.flex.toFixed(0) + '%' : '—' }}
            </p>
            <p class="cd-stat-sub">
              {{ resumenCantidades.flex != null ? 'promedio máx sobre mín' : 'sin rangos máx/mín' }}
            </p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="cd-toolbar">
          <SelectButton v-if="!editandoCantidades" v-model="vistaCantidades" :options="VISTAS"
            optionLabel="label" optionValue="value" size="small" />
          <span v-else class="cd-toolbar-titulo">
            <UploadIcon class="size-[1em]" />Cargar compromisos desde Excel
          </span>
          <div class="cd-toolbar-act">
            <template v-if="!editandoCantidades">
              <Button label="Editar" size="small" text severity="secondary" @click="editandoCantidades = true">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
            </template>
            <template v-else>
              <Button label="Cancelar" size="small" text severity="secondary"
                @click="editandoCantidades = false; energiaPaste = ''; energiaRows = []; energiaError = ''" />
              <Button label="Guardar" size="small" :loading="guardandoCantidades" :disabled="!energiaRows.length" @click="guardarCantidades">
                <template #icon><CheckIcon class="size-[1em]" /></template>
              </Button>
            </template>
          </div>
        </div>

        <!-- Modo edición cantidades -->
        <template v-if="editandoCantidades">
          <div class="cd-aviso">
            <TriangleAlertIcon class="size-[1em]" />
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
              <template #icon><RefreshCwIcon class="size-[1em]" /></template>
            </Button>
            <Button v-if="energiaRows.length" label="Limpiar" size="small" severity="danger" text @click="energiaRows = []; energiaPaste = ''; energiaError = ''">
              <template #icon><XIcon class="size-[1em]" /></template>
            </Button>
            <span v-if="energiaRows.length" class="cd-pill cd-pill--ok">
              <CircleCheckIcon class="size-[1em]" />{{ energiaRows.length }} filas listas
            </span>
            <span v-if="energiaError" class="cd-pill cd-pill--err">
              <CircleXIcon class="size-[1em]" />{{ energiaError }}
            </span>
          </div>
          <div v-if="energiaRows.length" class="cd-tabla">
            <table class="cd-preview">
              <thead>
                <tr>
                  <th>Año</th><th>Mes</th>
                  <th class="cd-der">Mín (MWh)</th><th class="cd-der">Máx (MWh)</th>
                  <th class="cd-der">Plantas contrato</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in energiaRows.slice(0, 8)" :key="i">
                  <td>{{ r.año }}</td>
                  <td>{{ MESES[r.mes - 1] }}</td>
                  <td class="cd-der cd-num">{{ r.energia_minima }}</td>
                  <td class="cd-der cd-num">{{ r.energia_maxima ?? '—' }}</td>
                  <td class="cd-der cd-num">{{ r.cantidad_proyectos ?? '—' }}</td>
                </tr>
                <tr v-if="energiaRows.length > 8">
                  <td colspan="5" class="cd-preview-mas">… y {{ energiaRows.length - 8 }} filas más</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Modo lectura cantidades -->
        <template v-else>
          <div v-if="!cantidadesMensuales.length" class="cd-vacio">
            <ChartColumnIcon class="size-[1em]" />
            <p class="cd-vacio-tit">Sin compromisos de energía</p>
            <p class="cd-vacio-sub">Usa <strong>Editar</strong> para pegarlos desde Excel.</p>
          </div>
          <div v-else class="cd-tabla">
            <DataTable
              :value="vistaCantidades === 'anual' ? cantidadesAnuales : cantidadesMensuales"
              stripedRows rowHover class="text-sm" paginator :rows="24"
              :rowsPerPageOptions="[12, 24, 60, 120]"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            >
              <Column field="año" header="Año" style="width:80px">
                <template #body="{ data }"><span class="cd-num">{{ data.año }}</span></template>
              </Column>
              <Column v-if="vistaCantidades === 'mensual'" header="Mes" style="width:130px">
                <template #body="{ data }">{{ MESES[data.mes - 1] }}</template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Mín (MWh/año)' : 'Mín (MWh/mes)'"
                headerClass="cd-th-der" bodyClass="cd-der">
                <template #body="{ data }">
                  <span class="cd-num cd-fuerte">{{ fmtNum(data.energia_minima) }}</span>
                </template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Máx (MWh/año)' : 'Máx (MWh/mes)'"
                headerClass="cd-th-der" bodyClass="cd-der">
                <template #body="{ data }"><span class="cd-num">{{ fmtNum(data.energia_maxima) }}</span></template>
              </Column>
              <Column style="width:160px" headerClass="cd-th-der" bodyClass="cd-der">
                <template #header>
                  <span v-tooltip.top="'Plantas registradas y despachando energía al contrato. La calcula la plataforma vía GESCON.'">
                    {{ vistaCantidades === 'anual' ? 'Plantas inscritas (máx)' : 'Plantas inscritas' }}
                  </span>
                </template>
                <template #body="{ data }">
                  <span v-if="data.plantas_inscritas != null" class="cd-pill"
                    :class="plantasClase(data)">{{ data.plantas_inscritas }}</span>
                  <span v-else class="cd-nulo">—</span>
                </template>
              </Column>
              <Column :header="vistaCantidades === 'anual' ? 'Plantas contrato (máx)' : 'Plantas contrato'"
                style="width:150px" headerClass="cd-th-der" bodyClass="cd-der">
                <template #body="{ data }">
                  <span class="cd-num">{{ data.cantidad_proyectos != null ? data.cantidad_proyectos : '—' }}</span>
                </template>
              </Column>
              <Column header="Rango" style="width:110px">
                <template #body="{ data }">
                  <span v-if="data.energia_minima > 0 && data.energia_maxima != null" class="cd-pill cd-pill--flex">
                    {{ ((data.energia_maxima / data.energia_minima - 1) * 100).toFixed(0) }}% flex
                  </span>
                  <span v-else class="cd-nulo">—</span>
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
          <div class="cd-stat" style="background:#fffbeb;border-color:#fde68a">
            <p class="cd-stat-lbl" style="color:#b45309"><DollarSignIcon class="size-[1em]" style="font-size:9px" />
              {{ resumenTarifas.esDelMes ? 'Tarifa del mes' : 'Última tarifa' }}</p>
            <p class="cd-stat-val" style="color:#b45309">{{ fmtCOP(resumenTarifas.vigente.tarifa) }}</p>
            <p class="cd-stat-sub" style="color:#b45309;opacity:.75">
              {{ MESES[resumenTarifas.vigente.mes - 1] }} {{ resumenTarifas.vigente.año }} · COP/kWh
            </p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><ChartLineIcon class="size-[1em]" style="font-size:9px" />Variación</p>
            <p class="cd-stat-val" :style="`color:${varColor(resumenTarifas.varPct)}`">
              {{ resumenTarifas.varPct != null ? (resumenTarifas.varPct > 0 ? '+' : '') + resumenTarifas.varPct.toFixed(1) + '%' : '—' }}
            </p>
            <p class="cd-stat-sub">frente al período anterior</p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><MoveVerticalIcon class="size-[1em]" style="font-size:9px" />Rango histórico</p>
            <p class="cd-stat-val">{{ fmtCOP(resumenTarifas.min) }} – {{ fmtCOP(resumenTarifas.max) }}</p>
            <p class="cd-stat-sub">mínimo y máximo registrados</p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><CalendarIcon class="size-[1em]" style="font-size:9px" />Períodos</p>
            <p class="cd-stat-val">{{ resumenTarifas.periodos }} meses</p>
            <p class="cd-stat-sub">{{ resumenTarifas.añoMin }} – {{ resumenTarifas.añoMax }}</p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="cd-toolbar">
          <SelectButton v-if="!editandoTarifas" v-model="vistaTarifas" :options="VISTAS"
            optionLabel="label" optionValue="value" size="small" />
          <span v-else class="cd-toolbar-titulo">
            <UploadIcon class="size-[1em]" />Cargar tarifas desde Excel
          </span>
          <div class="cd-toolbar-act">
            <template v-if="!editandoTarifas">
              <Button label="Editar" size="small" text severity="secondary" @click="editandoTarifas = true">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
            </template>
            <template v-else>
              <Button label="Cancelar" size="small" text severity="secondary"
                @click="editandoTarifas = false; tarifasPaste = ''; tarifasRows = []; tarifasError = ''" />
              <Button label="Guardar" size="small" :loading="guardandoTarifas" :disabled="!tarifasRows.length" @click="guardarTarifas">
                <template #icon><CheckIcon class="size-[1em]" /></template>
              </Button>
            </template>
          </div>
        </div>

        <!-- Modo edición tarifas -->
        <template v-if="editandoTarifas">
          <div class="cd-aviso">
            <TriangleAlertIcon class="size-[1em]" />
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
              <template #icon><RefreshCwIcon class="size-[1em]" /></template>
            </Button>
            <Button v-if="tarifasRows.length" label="Limpiar" size="small" severity="danger" text @click="tarifasRows = []; tarifasPaste = ''; tarifasError = ''">
              <template #icon><XIcon class="size-[1em]" /></template>
            </Button>
            <span v-if="tarifasRows.length" class="cd-pill cd-pill--ok">
              <CircleCheckIcon class="size-[1em]" />{{ tarifasRows.length }} filas listas
            </span>
            <span v-if="tarifasError" class="cd-pill cd-pill--err">
              <CircleXIcon class="size-[1em]" />{{ tarifasError }}
            </span>
          </div>
          <div v-if="tarifasRows.length" class="cd-tabla">
            <table class="cd-preview">
              <thead>
                <tr><th>Año</th><th>Mes</th><th class="cd-der">Tarifa ($/kWh)</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in tarifasRows.slice(0, 8)" :key="i">
                  <td>{{ r.año }}</td>
                  <td>{{ MESES[r.mes - 1] }}</td>
                  <td class="cd-der cd-num">{{ r.tarifa }}</td>
                </tr>
                <tr v-if="tarifasRows.length > 8">
                  <td colspan="3" class="cd-preview-mas">… y {{ tarifasRows.length - 8 }} filas más</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Modo lectura tarifas -->
        <template v-else>
          <div v-if="!tarifasMensuales.length" class="cd-vacio">
            <DollarSignIcon class="size-[1em]" />
            <p class="cd-vacio-tit">Sin tarifas registradas</p>
            <p class="cd-vacio-sub">Usa <strong>Editar</strong> para pegarlas desde Excel.</p>
          </div>
          <div v-else class="cd-tabla">
            <DataTable
              :value="vistaTarifas === 'anual' ? tarifasAnuales : tarifasMensuales"
              stripedRows rowHover class="text-sm" paginator :rows="24"
              :rowsPerPageOptions="[12, 24, 60, 120]"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            >
              <Column field="año" header="Año" style="width:80px">
                <template #body="{ data }"><span class="cd-num">{{ data.año }}</span></template>
              </Column>
              <Column v-if="vistaTarifas === 'mensual'" header="Mes" style="width:130px">
                <template #body="{ data }">{{ MESES[data.mes - 1] }}</template>
              </Column>
              <Column header="Tarifa (COP/kWh)" headerClass="cd-th-der" bodyClass="cd-der">
                <template #body="{ data }">
                  <span class="cd-num cd-tarifa">{{ fmtCOP(data.tarifa) }}</span>
                  <span v-if="vistaTarifas === 'anual' && !data._uniforme" class="cd-nulo ml-1">prom.</span>
                </template>
              </Column>
              <Column header="Variación" style="width:130px" headerClass="cd-th-der" bodyClass="cd-der">
                <template #body="{ data, index }">
                  <span v-if="index > 0 && currentTarifas[index - 1]?.tarifa != null && data.tarifa != null"
                    class="cd-pill" :style="`color:${varColor(varPct(currentTarifas[index-1].tarifa, data.tarifa))};background:${varBg(varPct(currentTarifas[index-1].tarifa, data.tarifa))}`">
                    <component :is="varIcono(varPct(currentTarifas[index-1].tarifa, data.tarifa))" class="size-[1em]" />
                    {{ variacion(currentTarifas[index-1].tarifa, data.tarifa) }}
                  </span>
                  <span v-else class="cd-nulo">—</span>
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
          <div class="cd-stat">
            <p class="cd-stat-lbl"><BookIcon class="size-[1em]" style="font-size:9px" />Registros</p>
            <p class="cd-stat-val">{{ resumenAsic.total }}</p>
            <p class="cd-stat-sub">histórico completo</p>
          </div>
          <div class="cd-stat" style="background:#ecfdf5;border-color:#a7f3d0">
            <p class="cd-stat-lbl" style="color:#059669"><CircleCheckIcon class="size-[1em]" style="font-size:9px" />Vigentes</p>
            <p class="cd-stat-val" style="color:#059669">{{ resumenAsic.vigentes }}</p>
            <p class="cd-stat-sub" style="color:#059669;opacity:.75">con fecha fin en el futuro</p>
          </div>
          <div class="cd-stat">
            <p class="cd-stat-lbl"><BadgeCheckIcon class="size-[1em]" style="font-size:9px" />Publicados</p>
            <p class="cd-stat-val">{{ resumenAsic.publicados }}</p>
            <p class="cd-stat-sub">estado de la solicitud</p>
          </div>
          <div class="cd-stat" :style="resumenAsic.enProceso ? 'background:#fffbeb;border-color:#fde68a' : ''">
            <p class="cd-stat-lbl" :style="resumenAsic.enProceso ? 'color:#b45309' : ''">
              <HourglassIcon class="size-[1em]" style="font-size:9px" />En proceso</p>
            <p class="cd-stat-val" :style="resumenAsic.enProceso ? 'color:#b45309' : ''">{{ resumenAsic.enProceso }}</p>
            <p class="cd-stat-sub" :style="resumenAsic.enProceso ? 'color:#b45309;opacity:.75' : ''">
              pendientes ante el ASIC
            </p>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div class="cd-toolbar">
          <SelectButton v-model="vistaAsic" size="small"
            :options="[{ label: 'Vigentes', value: 'vigentes' }, { label: 'Históricos', value: 'historicos' }]"
            optionLabel="label" optionValue="value" />
          <div class="cd-toolbar-act">
            <span class="cd-toolbar-nota">{{ asicFiltrados.length }} de {{ asicRows.length }} registros</span>
          </div>
        </div>

        <div v-if="loadingAsic" class="cd-cargando">
          <LoaderCircleIcon class="size-[1em] animate-spin" /><span>Cargando registros ASIC…</span>
        </div>
        <div v-else-if="!asicFiltrados.length" class="cd-vacio">
          <BookIcon class="size-[1em]" />
          <p class="cd-vacio-tit">Sin registros ASIC {{ vistaAsic === 'vigentes' ? 'vigentes' : '' }}</p>
          <p class="cd-vacio-sub">
            Se buscan por número de contrato interno o código SIC.
            <template v-if="vistaAsic === 'vigentes' && asicRows.length">
              Hay {{ asicRows.length }} en el histórico.
            </template>
          </p>
        </div>
        <div v-else class="cd-tabla">
          <DataTable :value="asicFiltrados" stripedRows rowHover class="text-sm"
            sortField="fecha_solicitud" :sortOrder="-1">
            <Column field="codigo_sic_contrato" header="Código SIC" sortable style="width:110px">
              <template #body="{ data }">
                <span class="cd-num">{{ data.codigo_sic_contrato || '—' }}</span>
              </template>
            </Column>
            <Column field="planta_nombre" header="Planta" sortable>
              <template #body="{ data }">
                <router-link v-if="data.proyecto_id" :to="`/proyectos/${data.proyecto_id}`" class="cd-enlace">
                  {{ data.planta_nombre || data.proyecto_id }}
                </router-link>
                <span v-else class="cd-nulo">—</span>
              </template>
            </Column>
            <Column field="tipo_solicitud" header="Tipo" style="width:120px">
              <template #body="{ data }">
                <GBadge :color="{ registro: 'success', modificacion: 'information', terminacion: 'destructive', desistimiento: 'default' }[data.tipo_solicitud] || 'default'" class="text-[10px] capitalize">{{ data.tipo_solicitud }}</GBadge>
              </template>
            </Column>
            <Column field="estado_solicitud" header="Estado" style="width:115px">
              <template #body="{ data }">
                <GBadge :color="{ publicado: 'success', en_proceso: 'warning', rechazado: 'destructive', desistido: 'default' }[data.estado_solicitud] || 'default'" class="text-[10px] capitalize">{{ data.estado_solicitud.replace('_', ' ') }}</GBadge>
              </template>
            </Column>
            <Column field="fecha_inicio" header="Inicio" sortable style="width:105px">
              <template #body="{ data }"><span class="cd-num">{{ data.fecha_inicio || '—' }}</span></template>
            </Column>
            <Column field="fecha_fin" header="Fin" sortable style="width:105px">
              <template #body="{ data }"><span class="cd-num">{{ data.fecha_fin || '—' }}</span></template>
            </Column>
            <Column field="porcentaje_despacho" header="% Despacho" style="width:115px"
              headerClass="cd-th-der" bodyClass="cd-der">
              <template #body="{ data }">
                <span v-if="data.porcentaje_despacho != null" class="cd-pill"
                  :class="data.porcentaje_despacho > 100 ? 'cd-pill--err' : 'cd-pill--neutro'">
                  {{ Number(data.porcentaje_despacho).toFixed(1) }}%
                </span>
                <span v-else class="cd-nulo">—</span>
              </template>
            </Column>
            <Column field="fecha_solicitud" header="F. solicitud" sortable style="width:120px">
              <template #body="{ data }"><span class="cd-num">{{ data.fecha_solicitud || '—' }}</span></template>
            </Column>
            <Column header="Observaciones">
              <template #body="{ data }">
                <span class="text-xs" style="color:#6b5a8a">{{ data.observaciones || '—' }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- ══ PROYECTOS ══ -->
      <div v-if="tab === 'proyectos'" class="space-y-4">
        <div class="cd-toolbar">
          <span class="cd-toolbar-titulo">
            <ZapIcon class="size-[1em]" />
            {{ contrato.proyectos?.length || 0 }}
            {{ (contrato.proyectos?.length === 1) ? 'planta asociada' : 'plantas asociadas' }}
          </span>
          <div class="cd-toolbar-act">
            <Button label="Asociar proyecto" size="small" severity="secondary" outlined @click="abrirAsociar">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <div v-if="contrato.proyectos?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <router-link v-for="p in proyectosOrdenados" :key="p.id" :to="`/proyectos/${p.id}`" class="cd-proy">
            <span class="cd-ico" style="background:#915BD818"><ZapIcon class="size-[1em]" style="color:var(--color-unergy-purple)" /></span>
            <div class="min-w-0 flex-1">
              <p class="cd-proy-nom">{{ p.nombre_comercial }}</p>
              <p class="cd-proy-id">ID {{ p.id }}</p>
            </div>
            <ChevronRightIcon class="cd-proy-chev size-[1em]" />
          </router-link>
        </div>
        <div v-else class="cd-vacio">
          <NetworkIcon class="size-[1em]" />
          <p class="cd-vacio-tit">Sin plantas asociadas</p>
          <p class="cd-vacio-sub">Usa <strong>Asociar proyecto</strong> para vincular las que despachan a este PPA.</p>
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
    <Dialog v-model:visible="showAsociar" header="Asociar proyecto" modal :style="{ width: '420px' }">
      <div class="flex flex-col gap-2 pt-1">
        <label class="text-xs font-medium text-gray-600">Buscar proyecto</label>
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
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>
  </div>

  <!-- Loading -->
  <div v-else-if="loading" class="cd-cargando" style="padding:96px 20px">
    <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:18px" />
    <span>Cargando contrato…</span>
  </div>

  <!-- Error -->
  <div v-else class="cd-vacio" style="padding:80px 20px">
    <TriangleAlertIcon class="size-[1em]" style="color:#fbbf24" />
    <p class="cd-vacio-tit">No se encontró el contrato</p>
    <p class="cd-vacio-sub">Puede que lo hayan eliminado o que el enlace esté mal.</p>
    <Button label="Volver" text size="small" class="mt-2" @click="$router.back()">
      <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
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
import { estadoVigenciaPPA } from '~/features/contratos/utils/ppaVigencia'
import { PpaService } from '~/features/contratos/services/ppa'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ArrowDownRightIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, BadgeCheckIcon, BookIcon, BuildingIcon, CalendarIcon, ChartColumnIcon, ChartLineIcon, CheckIcon, ChevronRightIcon, CircleCheckIcon, CircleIcon, CirclePlusIcon, CircleXIcon, ClockIcon, DollarSignIcon, ExternalLinkIcon, FileIcon, FileTextIcon, HourglassIcon, IdCardIcon, InfoIcon, LinkIcon, ListIcon, LoaderCircleIcon, MinusIcon, MoveHorizontalIcon, MoveVerticalIcon, NetworkIcon, PencilIcon, PlusIcon, RefreshCwIcon, SunIcon, TriangleAlertIcon, UploadIcon, UsersIcon, XIcon, ZapIcon } from '@lucide/vue'

const ppaService = new PpaService()
const proyectosService = new ProyectosService()

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

// Edición inline de GESCON
const editandoGescon = ref(false)
const guardandoGescon = ref(false)
const formGescon = reactive({
  codigo_sic: null,
  gescon_codigo: null,
  gescon_fecha_inicio: null,
  gescon_fecha_fin: null,
  gescon_precio: null,
  gescon_cantidades_kwh: null,
})

function toISODate(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

async function guardarGescon() {
  guardandoGescon.value = true
  try {
    const payload = {
      codigo_sic: formGescon.codigo_sic || null,
      gescon_codigo: formGescon.gescon_codigo || null,
      gescon_fecha_inicio: toISODate(formGescon.gescon_fecha_inicio),
      gescon_fecha_fin: toISODate(formGescon.gescon_fecha_fin),
      gescon_precio: formGescon.gescon_precio,
      gescon_cantidades_kwh: formGescon.gescon_cantidades_kwh,
    }
    await ppaService.actualizar(contrato.value.id, payload)
    Object.assign(contrato.value, payload)
    editandoGescon.value = false
    toast.success('GESCON actualizado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardandoGescon.value = false
  }
}

// Edición inline de partes
const editandoPartes = ref(false)
const guardandoPartes = ref(false)
const formPartes = reactive({ comprador_nombre: null, comprador_nit: null, vendedor_nombre: null, vendedor_nit: null })

function iniciarEdicionPartes() {
  formPartes.comprador_nombre = contrato.value.comprador_nombre
  formPartes.comprador_nit = contrato.value.comprador_nit
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
    const data = await ppaService.actualizar(contrato.value.id, formPartes)
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

const gesconPrecioFmt = computed(() => {
  const v = contrato.value?.gescon_precio
  return v != null ? `$${Number(v).toFixed(4)}` : null
})

const gesconCantidadesFmt = computed(() => {
  const v = contrato.value?.gescon_cantidades_kwh
  return v != null ? Number(v).toLocaleString('es-CO') : null
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
  if (row.cantidad_proyectos == null) return 'cd-pill--neutro'
  return row.plantas_inscritas >= row.cantidad_proyectos ? 'cd-pill--ok' : 'cd-pill--warn'
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
    const proyectos = await proyectosService.listar({ size: 500 })
    todosProyectos.value = proyectos.sort((a, b) =>
      (a.nombre_comercial ?? '').localeCompare(b.nombre_comercial ?? ''))
  } catch (e) {
    toast.error('Error', { description: e.message, duration: 3000 })
  } finally {
    cargandoProyectos.value = false
  }
}

async function asociarProyecto() {
  if (!proyectoSeleccionado.value) return
  asociando.value = true
  try {
    await ppaService.vincularProyecto(contrato.value.id, proyectoSeleccionado.value.id)
    contrato.value.proyectos = [...(contrato.value.proyectos ?? []), proyectoSeleccionado.value]
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
    Object.assign(formGescon, {
      codigo_sic: data.codigo_sic ?? null,
      gescon_codigo: data.gescon_codigo ?? null,
      gescon_fecha_inicio: data.gescon_fecha_inicio ?? null,
      gescon_fecha_fin: data.gescon_fecha_fin ?? null,
      gescon_precio: data.gescon_precio ?? null,
      gescon_cantidades_kwh: data.gescon_cantidades_kwh ?? null,
    })
    if (data.numero_codigo_contrato || data.codigo_sic) cargarAsic(data)
  } catch (e) {
    toast.error('Error', { description: e.message, duration: 3000 })
  } finally {
    loading.value = false
  }
}

async function cargarAsic(c) {
  loadingAsic.value = true
  try {
    // Primero intenta por numero_codigo_contrato (un contrato PPA agrupa varios SIC)
    // y si tiene codigo_sic lo usa como filtro adicional de respaldo
    const filtros = c.numero_codigo_contrato
      ? { contrato_interno: c.numero_codigo_contrato }
      : { codigo_sic_contrato: c.codigo_sic }
    asicRows.value = await ppaService.listarAsic(filtros)
  } catch (e) {
    toast.warning('ASIC', { description: 'No se pudieron cargar registros ASIC', duration: 3000 })
  } finally {
    loadingAsic.value = false
  }
}

onMounted(cargar)
</script>
<style scoped>
/*
  Paleta y formas heredadas de las otras vistas de detalle (Cliente / Proyecto)
  y de Operación: tarjeta blanca con borde lila, cabecera #faf8fd, texto var(--color-unergy-deep),
  etiquetas #9b89b5 y un chip de ícono de color por sección. Antes esta pestaña
  era una lista plana de campos separados por <Divider> con títulos ámbar, que
  no se parecía a ninguna otra pantalla de la plataforma.
*/

/* ── Tarjetas de resumen ──────────────────────────────────────────────────── */
.cd-stat {
  background: #fff; border: 1px solid #ECE7F2; border-radius: 12px;
  padding: 11px 14px; min-width: 0;
}
.cd-stat-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: #9b89b5; margin-bottom: 3px;
}
.cd-stat-val {
  font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Los valores llegan en minúscula de la BD ("mensual"). `capitalize` a secas
   convertía "16 años 1 mes" en "16 Años 1 Mes"; con ::first-letter solo sube
   la inicial y las cifras quedan intactas. */
.cd-stat-val::first-letter { text-transform: uppercase; }
.cd-stat-sub {
  font-size: 11px; color: #9b89b5; margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Secciones ────────────────────────────────────────────────────────────── */
.cd-sec {
  background: #fff; border: 1.5px solid #e8e0f0; border-radius: 12px; overflow: hidden;
}
.cd-sec-head {
  display: flex; align-items: center; gap: 9px; min-height: 42px;
  padding: 6px 14px; background: #faf8fd; border-bottom: 1px solid #f0eaf8;
}
.cd-sec-title {
  font-size: 12px; font-weight: 700; letter-spacing: .03em;
  text-transform: uppercase; color: var(--color-unergy-deep);
}
.cd-sec-act { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.cd-sec-body { padding: 14px; }
.cd-ico {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.cd-ico svg { font-size: 11px; }

/* Rejilla de campos: 2 columnas en móvil, 3 desde tablet (como Proyecto) */
.cd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (min-width: 768px) { .cd-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.cd-ancho { grid-column: 1 / -1; }
.cd-campo-lbl { font-size: 12px; font-weight: 500; color: #9b89b5; }
.cd-lbl { font-size: 12px; font-weight: 500; color: #4b5563; }

/* ── Partes: vendedor → comprador ─────────────────────────────────────────── */
.cd-partes {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px;
}
.cd-partes-flecha { font-size: 12px; color: #c5b9db; }
@media (max-width: 640px) {
  .cd-partes { grid-template-columns: 1fr; }
  .cd-partes-flecha { transform: rotate(90deg); justify-self: center; }
}
.cd-parte {
  border: 1px solid #ECE7F2; border-radius: 10px; padding: 11px 13px;
  background: #fcfbfe; min-width: 0;
}
.cd-parte-rol {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  color: #9b89b5; margin-bottom: 3px;
}
.cd-parte-nom { font-size: 13px; font-weight: 600; color: var(--color-unergy-deep); }
.cd-parte-nit {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: #9b8fb0; margin-top: 1px;
}

/* ── Enlace al contrato ───────────────────────────────────────────────────── */
.cd-link {
  display: flex; align-items: flex-start; gap: 10px;
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 11px 13px;
}
.cd-link--vacio { background: #fdfcf8; border-style: dashed; border-color: #ecdcb8; }
.cd-link-add {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #d97706;
}
.cd-link-add:hover { text-decoration: underline; }

/* Atajo al contrato en la cabecera, junto a "Editar contrato" */
.cd-head-link {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid #fde68a; background: #fffbeb;
  font-size: 12px; font-weight: 600; color: #d97706;
  transition: background .12s;
}
.cd-head-link:hover { background: #fef3c7; }
.cd-head-link svg { font-size: 10px; }
/* ── Barra de acciones de las pestañas de tabla ───────────────────────────── */
.cd-toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 12px; border-radius: 10px;
  background: #faf8fd; border: 1px solid #f0eaf8;
}
.cd-toolbar-titulo {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; letter-spacing: .03em;
  text-transform: uppercase; color: var(--color-unergy-deep);
}
.cd-toolbar-titulo svg { font-size: 11px; color: var(--color-unergy-purple); }
.cd-toolbar-act { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.cd-toolbar-nota { font-size: 11px; color: #9b89b5; }

/* ── Contenedor de tabla: mismo marco que las secciones ───────────────────── */
.cd-tabla { border: 1.5px solid #e8e0f0; border-radius: 12px; overflow: hidden; background: #fff; }
.cd-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}
.cd-fuerte { font-weight: 600; color: var(--color-unergy-deep); }
.cd-tarifa { font-weight: 600; color: #b45309; }
.cd-nulo { color: #c5b9db; }
.cd-enlace { font-weight: 500; color: var(--color-unergy-purple); }
.cd-enlace:hover { text-decoration: underline; text-underline-offset: 2px; }

/* PrimeVue renderiza la tabla fuera del alcance de :scoped: hace falta :deep */
.cd-tabla :deep(.p-datatable-thead > tr > th) {
  background: #faf8fd; color: #6b5a8a;
  font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
  border-bottom: 1px solid #ECE7F2; padding: 8px 12px;
}
.cd-tabla :deep(.p-datatable-tbody > tr > td) {
  padding: 8px 12px; border-bottom: 1px solid #f6f2fb; color: var(--color-unergy-deep);
}
.cd-tabla :deep(.p-datatable-tbody > tr:last-child > td) { border-bottom: none; }
.cd-tabla :deep(.p-datatable-tbody > tr.p-row-odd) { background: #fdfcfe; }
.cd-tabla :deep(.p-datatable-tbody > tr:hover) { background: #f7f3fd; }
.cd-tabla :deep(.p-paginator) {
  background: #faf8fd; border-top: 1px solid #ECE7F2; padding: 5px 8px;
}
.cd-tabla :deep(.cd-th-der .p-datatable-column-header-content) { justify-content: flex-end; }
.cd-tabla :deep(td.cd-der), .cd-der { text-align: right; }

/* ── Píldoras de estado / variación ───────────────────────────────────────── */
.cd-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: #f4f1f9; color: #6b5a8a;
}
.cd-pill svg { font-size: 9px; }
.cd-pill--neutro { background: #f4f1f9; color: #6b5a8a; }
.cd-pill--ok { background: #ecfdf5; color: #059669; }
.cd-pill--warn { background: #fffbeb; color: #b45309; }
.cd-pill--err { background: #fef2f2; color: #dc2626; }
.cd-pill--flex { background: #eef2ff; color: #4f46e5; }

/* ── Aviso de "esto reemplaza todo" en los modos de pegado ────────────────── */
.cd-aviso {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 13px; border-radius: 10px;
  background: #fffbeb; border: 1px solid #fde68a;
  font-size: 12px; line-height: 1.5; color: #92400e;
}
.cd-aviso > svg { font-size: 13px; color: #d97706; margin-top: 1px; flex-shrink: 0; }

/* ── Tabla de vista previa del pegado ─────────────────────────────────────── */
.cd-preview { width: 100%; border-collapse: collapse; font-size: 12px; }
.cd-preview th {
  background: #faf8fd; color: #6b5a8a; text-align: left;
  font-size: 10px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
  padding: 7px 12px; border-bottom: 1px solid #ECE7F2;
}
.cd-preview td { padding: 6px 12px; border-bottom: 1px solid #f6f2fb; color: var(--color-unergy-deep); }
.cd-preview tr:last-child td { border-bottom: none; }
.cd-preview .cd-der { text-align: right; }
.cd-preview-mas { color: #c5b9db; font-style: italic; }

/* ── Estados vacíos y de carga ────────────────────────────────────────────── */
.cd-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 44px 20px; border-radius: 12px;
  border: 1.5px dashed #e8e0f0; background: #fdfcfe; text-align: center;
}
.cd-vacio > svg { font-size: 26px; color: #d8cce9; margin-bottom: 5px; }
.cd-vacio-tit { font-size: 13px; font-weight: 600; color: #6b5a8a; }
.cd-vacio-sub { font-size: 12px; color: #9b89b5; }
.cd-cargando {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 56px 20px; font-size: 13px; color: #9b89b5;
}

/* ── Tarjetas de plantas asociadas ────────────────────────────────────────── */
.cd-proy {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 13px; border-radius: 10px;
  border: 1px solid #ECE7F2; background: #fff;
  transition: border-color .12s, background .12s;
}
.cd-proy:hover { border-color: #d9c9f5; background: #fdfcfe; }
.cd-proy-nom {
  font-size: 13px; font-weight: 600; color: var(--color-unergy-deep);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cd-proy-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: #9b8fb0;
}
.cd-proy-chev { font-size: 10px; color: #c5b9db; flex-shrink: 0; }
.cd-proy:hover .cd-proy-chev { color: var(--color-unergy-purple); }
</style>
