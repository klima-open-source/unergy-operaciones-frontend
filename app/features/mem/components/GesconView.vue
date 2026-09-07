<template>
  <div class="space-y-4">
    <PageHeader title="GESCON — Contratos ASIC" :subtitle="`${total} registros`">
      <template #actions>
        <Button label="Completar nombres internos" size="small" outlined @click="previewBackfill" :loading="backfillLoading" v-tooltip.bottom="'Rellena el nombre interno de los registros que lo tengan vacío, tomándolo del contrato PPA'" style="color:#6b5a8a; border-color:#d8cfe8;">
          <template #icon><WandSparklesIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Completar terminaciones" size="small" outlined @click="previewBackfillTerm" :loading="backfillTermLoading" v-tooltip.bottom="'Rellena contrato, nombre interno y demás datos de las terminaciones registradas antes, tomándolos de los registros del mismo código SIC'" style="color:#6b5a8a; border-color:#d8cfe8;">
          <template #icon><FlagIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar Excel" size="small" outlined @click="descargarGesconExcel" :loading="exportando" style="color:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Registrar" @click="abrirNuevo" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);" size="small">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <!-- flex-nowrap + overflow-x-auto: si no caben todos los filtros en el
         ancho disponible, se desplaza horizontal en vez de partirse en dos
         líneas o truncar el texto de los selects. -->
    <div class="bg-white rounded-xl px-4 py-3 flex flex-nowrap gap-3 items-center overflow-x-auto"
      style="border: 1px solid #e8e0f0;">
      <IconField class="flex-1 min-w-[200px]">
        <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
        <InputText v-model="filtroTexto" placeholder="Buscar SIC, contrato, planta…" class="w-full" />
      </IconField>

      <SelectButton v-model="filtroEstado" :options="opcionesEstado" optionLabel="label" optionValue="value"
        class="flex-shrink-0" :pt="{ button: { style: 'font-size:12px; padding:6px 14px;' } }" />

      <Select v-model="filtroTipo" :options="opcionesTipo" optionLabel="label" optionValue="value"
        placeholder="Tipo" showClear class="flex-shrink-0 min-w-[160px]" />

      <Select v-model="filtroMes" :options="opcionesMes" optionLabel="label" optionValue="value"
        placeholder="Mes" showClear class="flex-shrink-0 min-w-[150px]"
        v-tooltip.bottom="'Vigencia en ese mes'" />

      <Select v-model="filtroAnio" :options="opcionesAnio" optionLabel="label" optionValue="value"
        placeholder="Año" showClear class="flex-shrink-0 min-w-[110px]"
        v-tooltip.bottom="'Vigencia en ese año'" />

      <Button v-if="filtroTexto || filtroTipo || filtroMes || filtroAnio" label="Limpiar" severity="secondary" size="small" @click="limpiar">
        <template #icon><XIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-xl overflow-hidden shadow-sm" style="border: 1px solid #e8e0f0;">
      <DataTable :value="rowsMostrar" :loading="loading" class="text-sm" rowHover
        :rows="50" paginator :rowsPerPageOptions="[25, 50, 100]">
        <template #empty>
          <div class="py-12 text-center text-sm" style="color: #9b89b5;">
            No hay contratos con los filtros actuales.
          </div>
        </template>

        <Column field="codigo_sic_contrato" header="SIC" sortable style="width:100px;">
          <template #body="{ data }">
            <span class="font-mono text-xs" style="color:#5b3fa6;">{{ data.codigo_sic_contrato || '—' }}</span>
          </template>
        </Column>

        <Column field="contrato_interno" header="Contrato" sortable style="min-width:160px;">
          <template #body="{ data }">
            <span class="font-medium text-xs" style="color:var(--color-unergy-deep);">{{ data.contrato_interno || '—' }}</span>
          </template>
        </Column>

        <Column field="nombre_interno" header="Nombre interno" style="min-width:140px;">
          <template #body="{ data }">
            <span class="text-xs" style="color:#6b5a8a;">{{ data.nombre_interno || '—' }}</span>
          </template>
        </Column>

        <Column header="Planta" style="min-width:160px;">
          <template #body="{ data }">
            <span class="text-xs font-medium" style="color:var(--color-unergy-deep);">{{ data.planta_nombre || '—' }}</span>
          </template>
        </Column>

        <Column field="tipo_solicitud" header="Tipo" sortable style="width:130px;">
          <template #body="{ data }">
            <GBadge :color="tipoSeverity(data.tipo_solicitud)" class="text-xs">{{ tipoLabel(data.tipo_solicitud) }}</GBadge>
          </template>
        </Column>

        <Column field="requerimiento_asic" header="Req." sortable style="width:115px;">
          <template #body="{ data }">
            <span class="font-mono text-xs" style="color:#6b5a8a;">{{ data.requerimiento_asic || '—' }}</span>
          </template>
        </Column>

        <Column field="fecha_inicio" header="Inicio" sortable style="width:95px;">
          <template #body="{ data }">
            <span class="text-xs" style="color:#6b5a8a;">{{ fmt(data.fecha_inicio) }}</span>
          </template>
        </Column>

        <Column field="fecha_fin" header="Fin" sortable style="width:95px;">
          <template #body="{ data }">
            <span v-if="finRecortado(data)" class="text-xs inline-flex items-center gap-1"
              :style="{ color: esVencido(finEfectivo(data)) ? '#ef4444' : '#6b5a8a' }"
              v-tooltip.top="`Vigencia recortada: un relevo o modificación posterior en este SIC superó esta fila. Fecha registrada: ${fmt(data.fecha_fin)}`">
              {{ fmt(finEfectivo(data)) }}
              <HistoryIcon class="size-[1em]" style="font-size:9px; color:#e6a817;" />
            </span>
            <span v-else class="text-xs" :style="{ color: esVencido(data.fecha_fin) ? '#ef4444' : '#6b5a8a' }">
              {{ fmt(data.fecha_fin) }}
            </span>
          </template>
        </Column>

        <Column field="estado_solicitud" header="Estado" sortable style="width:110px;">
          <template #body="{ data }">
            <GBadge :color="estadoSeverity(data.estado_solicitud)" class="text-xs">{{ estadoLabel(data.estado_solicitud) }}</GBadge>
          </template>
        </Column>

        <Column field="porcentaje_despacho" header="Desp." style="width:68px;">
          <template #body="{ data }">
            <span class="text-xs" :style="{ color: despachoAnomalo(data.porcentaje_despacho) ? '#D64455' : '#6b5a8a' }"
              v-tooltip.top="despachoAnomalo(data.porcentaje_despacho) ? 'Valor fuera de escala canónica (0-1). Revisar: rompe el cálculo de cumplimiento.' : ''">
              {{ data.porcentaje_despacho != null ? despachoPct(data.porcentaje_despacho) + '%' : '—' }}
            </span>
          </template>
        </Column>

        <Column header="Coex." style="width:50px;">
          <template #body="{ data }">
            <LinkIcon class="text-xs size-[1em]" v-if="!data.reemplaza_anterior" style="color:#e6a817;" v-tooltip.top="'Coexiste con otras plantas en este SIC'" />
          </template>
        </Column>

        <Column header="Modalidad" style="width:88px;">
          <template #body="{ data }">
            <span v-if="data.uso_del_recurso" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style="background: rgba(2,132,199,0.14); color: #0369a1;"
              v-tooltip.top="'Uso del recurso — planta en bolsa; se le paga al cliente a precio bolsa. No genera garantías.'"><RefreshCwIcon class="size-[1em]" style="font-size:9px;" />Uso recurso</span>
            <span v-else-if="data.es_duplicado" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style="background: rgba(240,192,64,0.22); color: #9a6700;"
              v-tooltip.top="'Compra en bolsa (duplicado) — cuenta para el contrato, origen bolsa. Genera garantías.'"><ShoppingCartIcon class="size-[1em]" style="font-size:9px;" />Bolsa</span>
          </template>
        </Column>

        <Column header="" style="width:100px;">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <button @click="abrirEditar(data)" class="p-1 rounded hover:bg-purple-50 transition-colors"
                title="Editar" style="color: var(--color-unergy-purple);">
                <PencilIcon class="text-xs size-[1em]" />
              </button>
              <a v-if="data.link_archivo" :href="data.link_archivo" target="_blank"
                class="p-1 rounded hover:bg-purple-50 transition-colors text-purple-500 hover:text-purple-700">
                <ExternalLinkIcon class="text-xs size-[1em]" />
              </a>
              <button @click="confirmarEliminar(data)" class="p-1 rounded hover:bg-red-50 transition-colors"
                title="Eliminar" style="color: #ef4444;">
                <Trash2Icon class="text-xs size-[1em]" />
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>


    <!-- ── Dialog Registro ─────────────────────────────────────── -->
    <Dialog v-model:visible="dialogVisible" :header="tituloDialogo" modal
      :style="{ width: '700px' }" :breakpoints="{ '768px': '95vw' }">
      <div class="space-y-5 pt-1">

        <!-- Fila 1: Tipo + Estado (comunes a todos los modos) -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Tipo solicitud *</label>
            <Select v-model="form.tipo_solicitud" :options="opcionesTipo"
              optionLabel="label" optionValue="value" placeholder="Seleccionar" class="w-full"
              :class="{ 'p-invalid': errores.tipo_solicitud }" />
            <small v-if="errores.tipo_solicitud" class="text-red-500 text-xs">{{ errores.tipo_solicitud }}</small>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Estado *</label>
            <Select v-model="form.estado_solicitud" :options="opcionesEstadoForm"
              optionLabel="label" optionValue="value" placeholder="Seleccionar" class="w-full"
              :class="{ 'p-invalid': errores.estado_solicitud }" />
            <small v-if="errores.estado_solicitud" class="text-red-500 text-xs">{{ errores.estado_solicitud }}</small>
          </div>
        </div>

        <!-- Modificación: formulario asistido. Solo pide lo que cambia (fecha
             de fin, planta, % y modalidad) + la fecha en que entra en vigencia;
             el resto lo hereda el backend de la versión vigente del SIC. -->
        <GesconModificacionForm v-if="modoModificacionAsistida"
          :rows="rows" :proyectos="proyectos" :estado="form.estado_solicitud"
          @cancelar="dialogVisible = false" @guardado="onAsistidoGuardado" />

        <!-- Terminación: misma dinámica. Hereda la identidad del contrato en vez
             de guardarla vacía, que era lo que pasaba antes. -->
        <GesconTerminacionForm v-else-if="modoTerminacionAsistida"
          :rows="rows" :estado="form.estado_solicitud"
          @cancelar="dialogVisible = false" @guardado="onAsistidoGuardado" />

        <form v-else @submit.prevent="guardar" class="space-y-5">

        <!-- ── Terminación: solo los datos que XM exige ─────────────── -->
        <template v-if="esTerminacion">
          <div class="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
            style="background:#FFF7ED; border:1px solid #FED7AA; color:#9A3412;">
            <InfoIcon class="mt-0.5 size-[1em]" />
            <span>Al publicar, el contrato con este código SIC terminará en la fecha indicada:
              dejará de aportar energía en Cumplimiento después de esa fecha (el histórico previo se conserva).</span>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium" style="color:#6b5a8a;">Código SIC del contrato a terminar *</label>
              <InputText v-model="form.codigo_sic_contrato" placeholder="87552" class="w-full"
                :class="{ 'p-invalid': errores.codigo_sic_contrato }" />
              <small v-if="errores.codigo_sic_contrato" class="text-red-500 text-xs">{{ errores.codigo_sic_contrato }}</small>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha de terminación *</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="dd/mm/yy"
                placeholder="dd/mm/aa" showIcon class="w-full"
                :class="{ 'p-invalid': errores.fecha_fin }" />
              <small v-if="errores.fecha_fin" class="text-red-500 text-xs">{{ errores.fecha_fin }}</small>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">N° Requerimiento ASIC</label>
            <InputText v-model="form.requerimiento_asic" placeholder="20260419002" class="w-full" />
            <small class="text-xs" style="color:#9b8ab5;">El SIC puede repetir el del registro, pero el requerimiento de la terminación es distinto.</small>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium" style="color:#6b5a8a;">Cédula agente vendedor</label>
              <InputText v-model="form.cedula_agente_vendedor" placeholder="1037625350" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium" style="color:#6b5a8a;">Cédula agente comprador</label>
              <InputText v-model="form.cedula_agente_comprador" placeholder="1107047209" class="w-full" />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Link archivo</label>
            <InputText v-model="form.link_archivo" placeholder="https://..." class="w-full" />
          </div>
        </template>

        <!-- ── Campos completos (registro / modificación / desistimiento) ── -->
        <template v-if="!esTerminacion">

        <!-- Selector de contrato: al elegir, llena código interno + nombre interno de una vez -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">
            Contrato <span style="color:#9b89b5;">— elígelo y se llenan código + nombre interno</span>
          </label>
          <Select v-model="form.contrato_ppa_id" :options="contratos" optionValue="id" optionLabel="_label"
            filter showClear placeholder="Buscar contrato por código o nombre…" class="w-full"
            @change="onSelectContrato">
            <template #option="{ option }">
              <div class="flex flex-col leading-tight py-0.5">
                <span class="font-medium" style="color:var(--color-unergy-deep);">{{ option.numero_codigo_contrato || '(sin código)' }}</span>
                <span class="text-xs" style="color:#6b5a8a;">{{ option.nombre_interno || '(sin nombre interno)' }}</span>
              </div>
            </template>
          </Select>
        </div>

        <!-- Fila 2: SIC Contrato + Contrato interno + Nombre interno -->
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Código SIC contrato</label>
            <InputText v-model="form.codigo_sic_contrato" placeholder="88806" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Contrato interno</label>
            <InputText v-model="form.contrato_interno" placeholder="UNERGY 001-2024" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Nombre interno</label>
            <InputText v-model="form.nombre_interno" placeholder="Terpel 1" class="w-full" />
          </div>
        </div>

        <!-- Fila 3: Vendedor + Comprador + P.S -->
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">SIC Vendedor</label>
            <InputText v-model="form.codigo_sic_vendedor" placeholder="UNGG" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">SIC Comprador</label>
            <InputText v-model="form.codigo_sic_comprador" placeholder="BIAC" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Prioridad (P.S)</label>
            <InputNumber v-model="form.prioridad_limitacion" :min="0" :max="999"
              placeholder="83" class="w-full" inputClass="w-full" />
          </div>
        </div>

        <!-- Fila 4: Proyecto + coexistencia + duplicado -->
        <div class="grid grid-cols-[1fr_auto_auto] gap-4 items-end">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Planta / Proyecto</label>
            <Select v-model="form.proyecto_id" :options="proyectos"
              optionLabel="nombre_comercial" optionValue="id"
              placeholder="Seleccionar proyecto (opcional)" filter showClear class="w-full" />
          </div>
          <div class="flex items-center gap-2 pb-1">
            <Checkbox v-model="form.reemplaza_anterior" :binary="true" inputId="reemplaza" />
            <label for="reemplaza" class="text-xs font-medium cursor-pointer" style="color:#6b5a8a;">
              Reemplaza anterior
            </label>
            <InfoIcon class="text-xs cursor-help size-[1em]" style="color:#9b89b5;" v-tooltip.top="'Activado: esta planta reemplaza la anterior en este SIC. Desactivado: coexiste con las demás plantas del mismo SIC.'" />
          </div>
          <div class="flex flex-col gap-1 pb-1">
            <div class="flex items-center gap-2">
              <label class="text-xs font-medium" style="color:#6b5a8a;">Modalidad de suministro</label>
              <InfoIcon class="text-xs cursor-help size-[1em]" style="color:#9b89b5;" v-tooltip.top="'Normal: suministro propio de la planta. Compra en bolsa (duplicado): la planta ya está comprometida en otro contrato; aquí su aporte cuenta pero se compra en bolsa (genera garantías). Uso del recurso: la planta está en bolsa y se mete al contrato pagándole al cliente su generación a precio bolsa (sin garantías).'" />
            </div>
            <SelectButton v-model="modalidadSuministro" :options="MODALIDADES_SUMINISTRO"
              optionLabel="label" optionValue="value" :allowEmpty="false"
              :pt="{ button: { style: 'font-size:12px; padding:5px 12px;' } }" />
            <span v-if="modalidadSuministro === 'uso_recurso'" class="text-[11px]" style="color:#0369a1;">
              Uso del recurso: se le paga al cliente su generación a precio bolsa. No genera compra en bolsa ni garantías.
            </span>
            <span v-else-if="modalidadSuministro === 'duplicado'" class="text-[11px]" style="color:#9a6700;">
              Compra en bolsa: la planta ya está en otro contrato; su aporte aquí se cubre comprando en bolsa (genera garantías).
            </span>
          </div>
        </div>

        <!-- Fila 5: Fechas -->
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha solicitud</label>
            <DatePicker v-model="form.fecha_solicitud" dateFormat="dd/mm/yy"
              placeholder="dd/mm/aa" showIcon class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha inicio</label>
            <DatePicker v-model="form.fecha_inicio" dateFormat="dd/mm/yy"
              placeholder="dd/mm/aa" showIcon class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha fin</label>
            <DatePicker v-model="form.fecha_fin" dateFormat="dd/mm/yy"
              placeholder="dd/mm/aa" showIcon class="w-full" />
          </div>
        </div>

        <!-- Aviso en tiempo real: solapamiento de fechas de la misma planta ─── -->
        <div v-if="conflictosSolapamiento.length" class="rounded-lg px-3 py-2 text-xs"
          :style="conflictoNoResuelto
            ? 'background:#FEF2F2; border:1px solid #FECACA; color:#991B1B;'
            : 'background:#FFF7ED; border:1px solid #FED7AA; color:#9A3412;'">
          <div class="flex items-start gap-2">
            <TriangleAlertIcon class="mt-0.5 size-[1em]" />
            <div class="flex-1">
              <p class="font-medium">
                Se detectó {{ conflictosSolapamiento.length }} contrato{{ conflictosSolapamiento.length > 1 ? 's' : '' }}
                activo{{ conflictosSolapamiento.length > 1 ? 's' : '' }} de esta planta con fechas que se cruzan.
              </p>
              <ul class="mt-1 pl-4 list-disc">
                <li v-for="c in conflictosSolapamiento" :key="c.id">
                  {{ c.codigo_sic_contrato || c.contrato_interno || ('ID ' + c.id) }}
                  · {{ fmt(c.fecha_inicio) }} → {{ fmt(c.fecha_fin) }}
                </li>
              </ul>
              <p v-if="conflictoNoResuelto" class="mt-1.5">
                Para no duplicar la generación en Cumplimiento: marca
                <b>Reemplaza anterior</b> si sustituye al registro previo, o define la
                <b>Modalidad de suministro</b> (Compra en bolsa / Uso del recurso) si coexiste.
              </p>
              <p v-else class="mt-1.5">
                Resuelto —
                {{ form.reemplaza_anterior ? 'reemplaza al registro anterior en este SIC.'
                   : form.uso_del_recurso ? 'marcado como uso del recurso.'
                   : 'marcado como compra en bolsa.' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Fila 6: Tipo mercado + Tipo asignación + % FNCER + % Despacho -->
        <div class="grid grid-cols-4 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Tipo mercado</label>
            <InputText v-model="form.tipo_mercado" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Tipo asignación</label>
            <InputText v-model="form.tipo_asignacion" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">% FNCER</label>
            <InputNumber v-model="form.porcentaje_fncer" :min="0" :max="100"
              :minFractionDigits="0" :maxFractionDigits="2" suffix="%" locale="en-US" class="w-full" inputClass="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">% Despacho</label>
            <InputNumber v-model="form.porcentaje_despacho" :min="0" :max="100"
              :minFractionDigits="0" :maxFractionDigits="2" suffix="%" locale="en-US" class="w-full" inputClass="w-full" />
          </div>
        </div>

        <!-- Modalidad de pago: marca el par PLG/PLC de una planta repartida -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Modalidad de pago del contrato</label>
            <InfoIcon class="text-xs cursor-help size-[1em]" style="color:#9b89b5;" v-tooltip.top="'Cuando una planta se reparte entre dos contratos, uno PLG y otro PLC, entre los dos cubren su 100%: marcarlos evita que se reporte como duplicada. Déjalo en “No aplica” si el contrato no es de ese par.'" />
          </div>
          <SelectButton v-model="modalidadPago" :options="MODALIDADES_PAGO"
            optionLabel="label" optionValue="value" :allowEmpty="false"
            :pt="{ button: { style: 'font-size:12px; padding:5px 12px;' } }" />
        </div>

        <!-- Fila 7: Requerimiento + Contacto -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">N° Requerimiento ASIC</label>
            <InputText v-model="form.requerimiento_asic" placeholder="20260419002" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Nombre contacto solicitante</label>
            <InputText v-model="form.nombre_contacto_solicitante" class="w-full" />
          </div>
        </div>

        <!-- Fila 8: Link archivo -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Link archivo</label>
          <InputText v-model="form.link_archivo" placeholder="https://..." class="w-full" />
        </div>

        <!-- Observaciones -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Observaciones</label>
          <Textarea v-model="form.observaciones" rows="2" class="w-full" autoResize />
        </div>

        </template>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Cancelar" severity="secondary" @click="dialogVisible = false" type="button" />
          <Button :label="editandoId ? 'Actualizar' : 'Guardar'" type="submit" :loading="guardando" :disabled="conflictoNoResuelto" v-tooltip.top="conflictoNoResuelto ? 'Resuelve el solapamiento de fechas antes de guardar' : ''" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
        </form>
      </div>
    </Dialog>

    <!-- Diálogo: completar la identidad de las terminaciones viejas -->
    <Dialog v-model:visible="backfillTermDialog" modal header="Completar terminaciones" :style="{ width: '46rem' }">
      <div v-if="backfillTermReport" class="space-y-3 text-sm">
        <p style="color:#5a5168;">
          Las terminaciones registradas antes se guardaban solo con el código SIC y la fecha,
          sin contrato ni nombre interno. Esto los rellena tomándolos de los registros del
          <b>mismo código SIC</b>, y de paso estampa la fecha de terminación en los registros
          que quedaron sin recortar. No se les asigna planta: una terminación se guarda sin
          planta a propósito.
        </p>
        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <span><b>{{ backfillTermReport.a_actualizar }}</b> con datos por completar</span>
          <span v-if="backfillTermReport.a_recortar" style="color:#D64455;">
            <b>{{ backfillTermReport.a_recortar }}</b> registro(s) con fecha por recortar
          </span>
          <span style="color:#9a6700;"><b>{{ backfillTermReport.sin_resolver }}</b> sin resolver</span>
          <span style="color:#7a6e8a;">{{ backfillTermReport.total_terminaciones }} terminaciones en total</span>
        </div>

        <!-- Registros que una terminación publicada debió cerrar y no cerró -->
        <div v-if="backfillTermReport.sin_recortar?.length" class="rounded-lg px-3 py-2"
          style="background:#FEF2F2; border:1px solid #FECACA;">
          <p class="text-xs" style="color:#991B1B;">
            Estas terminaciones no alcanzaron a estampar su fecha en los registros de su SIC.
            El cálculo de Cumplimiento <b>ya sale bien igual</b> —la vigencia efectiva se resuelve
            sola—, pero la fecha que se ve en la tabla y en el Excel sigue diciendo la vieja.
          </p>
          <ul class="mt-1.5 pl-4 list-disc text-xs" style="color:#7a2020;">
            <li v-for="s in backfillTermReport.sin_recortar" :key="s.id">
              SIC <b>{{ s.codigo_sic_contrato }}</b>
              <span v-if="s.requerimiento_asic"> · req. {{ s.requerimiento_asic }}</span>
              — termina {{ fmt(s.termina) }}:
              {{ s.registros.map(r => `${r.planta} (${fmt(r.fecha_fin_actual)})`).join(', ') }}
            </li>
          </ul>
        </div>
        <div v-if="backfillTermReport.resueltos.length" class="max-h-60 overflow-y-auto border rounded-lg" style="border-color:#eee;">
          <table class="w-full text-xs border-collapse">
            <thead><tr style="background:#faf8fd;">
              <th class="text-left p-1.5">SIC</th><th class="text-left p-1.5">Termina</th><th class="text-left p-1.5">Datos a completar</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in backfillTermReport.resueltos" :key="r.id" class="border-t" style="border-color:#f0f0f0;">
                <td class="p-1.5 font-mono">{{ r.codigo_sic_contrato }}</td>
                <td class="p-1.5">{{ fmt(r.fecha_fin) }}</td>
                <td class="p-1.5" style="color:#6b5a8a;">{{ Object.values(r.cambios).join(' · ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <details v-if="backfillTermReport.no_resueltos.length" class="text-xs">
          <summary class="cursor-pointer" style="color:#9a6700;">{{ backfillTermReport.no_resueltos.length }} sin resolver (ver)</summary>
          <ul class="mt-1 pl-4 list-disc" style="color:#7a6e8a;">
            <li v-for="r in backfillTermReport.no_resueltos" :key="r.id">SIC {{ r.codigo_sic_contrato }} — {{ r.motivo }}</li>
          </ul>
        </details>
        <p v-if="!backfillTermPendiente" class="text-xs" style="color:#7a6e8a;">No hay nada para completar.</p>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="backfillTermDialog = false" :disabled="backfillTermExecuting" />
        <Button label="Aplicar" :loading="backfillTermExecuting" :disabled="!backfillTermPendiente" @click="applyBackfillTerm" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

    <!-- Diálogo: completar nombres internos faltantes (backfill) -->
    <Dialog v-model:visible="backfillDialog" modal header="Completar nombres internos" :style="{ width: '46rem' }">
      <div v-if="backfillReport" class="space-y-3 text-sm">
        <p style="color:#5a5168;">
          Se rellenará el <b>nombre interno</b> de los registros que lo tengan vacío, tomándolo del
          contrato PPA correspondiente. No se inventan nombres: los que no tengan un PPA con nombre se
          listan sin tocar.
        </p>
        <div class="flex gap-6">
          <span><b>{{ backfillReport.a_actualizar }}</b> se completarán</span>
          <span style="color:#9a6700;"><b>{{ backfillReport.sin_resolver }}</b> sin resolver</span>
          <span style="color:#7a6e8a;">{{ backfillReport.total_sin_nombre }} sin nombre en total</span>
        </div>
        <div v-if="backfillReport.resueltos.length" class="max-h-60 overflow-y-auto border rounded-lg" style="border-color:#eee;">
          <table class="w-full text-xs border-collapse">
            <thead><tr style="background:#faf8fd;"><th class="text-left p-1.5">Contrato</th><th class="text-left p-1.5">Nombre interno a aplicar</th></tr></thead>
            <tbody>
              <tr v-for="r in backfillReport.resueltos" :key="r.id" class="border-t" style="border-color:#f0f0f0;">
                <td class="p-1.5 font-mono">{{ r.contrato_interno || '—' }}</td>
                <td class="p-1.5">{{ r.nombre_propuesto }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <details v-if="backfillReport.no_resueltos.length" class="text-xs">
          <summary class="cursor-pointer" style="color:#9a6700;">{{ backfillReport.no_resueltos.length }} sin resolver (ver)</summary>
          <ul class="mt-1 pl-4 list-disc" style="color:#7a6e8a;">
            <li v-for="r in backfillReport.no_resueltos" :key="r.id">{{ r.contrato_interno || ('ID ' + r.id) }} — {{ r.motivo }}</li>
          </ul>
        </details>
        <p v-if="!backfillReport.a_actualizar" class="text-xs" style="color:#7a6e8a;">No hay nada para completar.</p>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="backfillDialog = false" :disabled="backfillExecuting" />
        <Button label="Aplicar" :loading="backfillExecuting" :disabled="!backfillReport || !backfillReport.a_actualizar" @click="applyBackfill" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { PpaService } from '~/features/contratos/services/ppa'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { conflictosAtribucion } from '~/features/mem/utils/validacionContratos'

const ppaService = new PpaService()
const proyectosService = new ProyectosService()
import GesconModificacionForm from './GesconModificacionForm.vue'
import GesconTerminacionForm from './GesconTerminacionForm.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import { toast } from 'vue-sonner'
import { CheckIcon, ExternalLinkIcon, FileSpreadsheetIcon, FlagIcon, HistoryIcon, InfoIcon, LinkIcon, PencilIcon, PlusIcon, RefreshCwIcon, SearchIcon, ShoppingCartIcon, Trash2Icon, TriangleAlertIcon, WandSparklesIcon, XIcon } from '@lucide/vue'

const confirm = useConfirm()

// ── Tabla ─────────────────────────────────────────────────────────
const loading = ref(false)
const rows = ref([])
const rowsMostrar = ref([])
const total = ref(0)
const filtroTexto = ref('')
const filtroEstado = ref('vigentes')
const filtroTipo = ref(null)
const filtroMes = ref(null)
const filtroAnio = ref(null)
const hoy = new Date().toISOString().slice(0, 10)

const opcionesEstado = [
  { label: 'Vigentes', value: 'vigentes' },
  { label: 'Todos', value: 'todos' },
]
const opcionesTipo = [
  { label: 'Registro', value: 'registro' },
  { label: 'Modificación', value: 'modificacion' },
  { label: 'Terminación', value: 'terminacion' },
  { label: 'Desistimiento', value: 'desistimiento' },
]

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const opcionesMes = MESES.map((label, i) => ({ label, value: i + 1 }))

const opcionesAnio = computed(() => {
  const seen = new Set()
  for (const x of rows.value) {
    if (x.fecha_inicio) seen.add(Number(x.fecha_inicio.slice(0, 4)))
    if (x.fecha_fin) seen.add(Number(x.fecha_fin.slice(0, 4)))
  }
  return [...seen].sort((a, b) => b - a).map(v => ({ label: String(v), value: v }))
})

// Fin EFECTIVO de la fila: si un relevo/modificación posterior en su SIC la
// superó, el backend manda fecha_fin_efectiva (< fecha_fin cruda). Una fila
// superada NO está vigente aunque su fecha registrada diga 2039 — caso real:
// SIC 89116, la fila vieja de La Reserva tras la modificación que cambió la
// planta. Fallback a la cruda si el backend aún no manda el campo.
function finEfectivo(x) { return x.fecha_fin_efectiva || x.fecha_fin }
function finRecortado(x) {
  return !!(x.fecha_fin_efectiva && x.fecha_fin && x.fecha_fin_efectiva < x.fecha_fin)
}

function filtrar() {
  let r = rows.value.slice()
  if (filtroEstado.value === 'vigentes')
    r = r.filter(x => finEfectivo(x) && finEfectivo(x) >= hoy)
  if (filtroTipo.value)
    r = r.filter(x => x.tipo_solicitud === filtroTipo.value)
  if (filtroMes.value || filtroAnio.value) {
    // Vigencia en el mes/año elegido, no fecha_inicio exacta: si solo se
    // elige año, cubre el año completo; si solo se elige mes, usa el año
    // actual. Igual criterio de "vigente" que el filtro Estado (requiere
    // finEfectivo, ver comentario en esa función).
    const anio = filtroAnio.value || new Date().getFullYear()
    const mesDesde = filtroMes.value || 1
    const mesHasta = filtroMes.value || 12
    const desde = `${anio}-${String(mesDesde).padStart(2, '0')}-01`
    const ultimoDia = new Date(anio, mesHasta, 0).getDate()
    const hasta = `${anio}-${String(mesHasta).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    r = r.filter(x => {
      const fin = finEfectivo(x)
      return !!fin && x.fecha_inicio <= hasta && fin >= desde
    })
  }
  const q = filtroTexto.value.trim().toLowerCase()
  if (q) r = r.filter(x =>
    (x.codigo_sic_contrato || '').toLowerCase().includes(q) ||
    (x.contrato_interno || '').toLowerCase().includes(q) ||
    (x.nombre_interno || '').toLowerCase().includes(q) ||
    (x.planta_nombre || '').toLowerCase().includes(q) ||
    (x.requerimiento_asic || '').toLowerCase().includes(q)
  )
  rowsMostrar.value = r
  total.value = r.length
}
watch([rows, filtroEstado, filtroTipo, filtroMes, filtroAnio, filtroTexto], filtrar)

async function cargar() {
  loading.value = true
  try {
    rows.value = await ppaService.listarAsic()
  } finally {
    loading.value = false
  }
}
function limpiar() { filtroTexto.value = ''; filtroTipo.value = null; filtroMes.value = null; filtroAnio.value = null }

// ── Exportar a Excel (identidad de marca Unergy) ──────────────────
const exportando = ref(false)
async function descargarGesconExcel() {
  if (exportando.value) return
  if (!rows.value.length) {
    toast.warning('Sin datos', { description: 'No hay registros GESCON para exportar.', duration: 3000 })
    return
  }
  exportando.value = true
  try {
    const XLSX = await import('xlsx-js-style')

    // Paleta de marca Unergy
    const C = { morado: '915BD8', oscuro: '2C2039', lila: 'F4F1FA', blanco: 'FFFFFF', gris: '6B5A8A', borde: 'ECE4F5', rojo: 'D64455', rojoBg: 'FBE9EC', dorado: '9A6700', doradoBg: 'FBF3DB', azul: '0369A1', azulBg: 'E1F0FA' }
    const bf = { style: 'thin', color: { rgb: C.borde } }
    const bAll = { top: bf, bottom: bf, left: bf, right: bf }
    const siNo = v => (v ? 'Sí' : 'No')
    const fechaFmt = d => {
      if (!d) return ''
      const [y, m, day] = String(d).slice(0, 10).split('-')
      return `${day}/${m}/${y}`
    }

    // Definición de columnas (todos los campos GESCON)
    const COLS = [
      { h: 'SIC contrato', w: 12, get: r => r.codigo_sic_contrato || '' },
      { h: 'Contrato interno', w: 18, get: r => r.contrato_interno || '' },
      { h: 'Nombre interno', w: 18, get: r => r.nombre_interno || '' },
      { h: 'Planta', w: 24, get: r => r.planta_nombre || '' },
      { h: 'Tipo solicitud', w: 14, get: r => tipoLabel(r.tipo_solicitud) },
      { h: 'Estado', w: 12, get: r => estadoLabel(r.estado_solicitud) },
      { h: 'SIC vendedor', w: 12, get: r => r.codigo_sic_vendedor || '' },
      { h: 'SIC comprador', w: 13, get: r => r.codigo_sic_comprador || '' },
      { h: 'Prioridad (P.S)', w: 13, get: r => r.prioridad_limitacion, num: true, align: 'center' },
      { h: 'Fecha solicitud', w: 13, get: r => fechaFmt(r.fecha_solicitud), align: 'center' },
      { h: 'Fecha inicio', w: 12, get: r => fechaFmt(r.fecha_inicio), align: 'center' },
      { h: 'Fecha fin', w: 12, get: r => fechaFmt(r.fecha_fin), align: 'center', venc: true },
      { h: 'Tipo mercado', w: 14, get: r => r.tipo_mercado || '' },
      { h: 'Tipo asignación', w: 15, get: r => r.tipo_asignacion || '' },
      { h: '% FNCER', w: 10, get: r => r.porcentaje_fncer, num: true, pct: true, align: 'right' },
      { h: '% Despacho', w: 11, get: r => despachoPct(r.porcentaje_despacho), num: true, pct: true, align: 'right' },
      { h: 'Req. ASIC', w: 15, get: r => r.requerimiento_asic || '' },
      { h: 'Contacto solicitante', w: 22, get: r => r.nombre_contacto_solicitante || '' },
      { h: 'Coexiste', w: 9, get: r => siNo(!r.reemplaza_anterior), align: 'center' },
      { h: 'Modalidad', w: 14, get: r => r.uso_del_recurso ? 'Uso del recurso' : r.es_duplicado ? 'Compra en bolsa' : 'Normal', align: 'center', dup: true },
      { h: 'Link archivo', w: 32, get: r => r.link_archivo || '' },
      { h: 'Observaciones', w: 40, get: r => r.observaciones || '' },
    ]
    const ncols = COLS.length
    const data = rows.value
    const fechaExport = new Date().toLocaleString('es-CO')

    // Filas: 0 título · 1 subtítulo · 2 vacía · 3 encabezados · 4+ datos
    const HEADER_ROW = 3
    const FIRST_DATA = 4
    const aoa = [
      ['UNERGY — GESCON · Contratos ASIC'],
      [`${data.length} registros · Exportado: ${fechaExport}`],
      [],
      COLS.map(c => c.h),
      ...data.map(r => COLS.map(c => {
        const v = c.get(r)
        if (c.num) return (v == null || v === '') ? null : Number(v)
        return v
      })),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const enc = (r, c) => XLSX.utils.encode_cell({ r, c })
    const setStyle = (r, c, s) => { const ref = enc(r, c); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = s }

    // Banner + subtítulo
    setStyle(0, 0, { font: { bold: true, sz: 14, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.oscuro } }, alignment: { vertical: 'center' } })
    setStyle(1, 0, { font: { sz: 10, color: { rgb: C.gris } } })

    // Encabezados
    COLS.forEach((c, ci) => setStyle(HEADER_ROW, ci, {
      font: { bold: true, sz: 10, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.morado } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: bAll,
    }))

    // Datos (zebra + resaltados semánticos)
    data.forEach((r, ri) => {
      const rowIdx = FIRST_DATA + ri
      const zebra = ri % 2 === 1
      COLS.forEach((c, ci) => {
        const style = {
          font: { sz: 10, color: { rgb: C.oscuro } },
          alignment: { horizontal: c.align || (c.num ? 'right' : 'left'), vertical: 'center', wrapText: c.h === 'Observaciones' },
          border: bAll,
        }
        if (zebra) style.fill = { fgColor: { rgb: C.lila } }
        if (c.pct) style.numFmt = '0.##"%"'
        if (c.venc && r.fecha_fin && String(r.fecha_fin).slice(0, 10) < hoy)
          style.font = { sz: 10, bold: true, color: { rgb: C.rojo } }
        if (c.dup && r.uso_del_recurso) {
          style.font = { sz: 10, bold: true, color: { rgb: C.azul } }
          style.fill = { fgColor: { rgb: C.azulBg } }
        } else if (c.dup && r.es_duplicado) {
          style.font = { sz: 10, bold: true, color: { rgb: C.dorado } }
          style.fill = { fgColor: { rgb: C.doradoBg } }
        }
        setStyle(rowIdx, ci, style)
      })
    })

    // Merges, anchos, alturas, autofiltro
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
    ]
    ws['!cols'] = COLS.map(c => ({ wch: c.w }))
    ws['!rows'] = [{ hpt: 26 }, { hpt: 16 }, { hpt: 6 }, { hpt: 30 }]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: FIRST_DATA + data.length - 1, c: ncols - 1 } }) }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'GESCON')
    XLSX.writeFile(wb, `GESCON_Contratos_ASIC_${hoy}.xlsx`)
    toast.success('Excel descargado', { description: `${data.length} registros exportados`, duration: 2500 })
  } catch (e) {
    toast.error('No se pudo generar el Excel', { description: e?.message, duration: 4000 })
  } finally {
    exportando.value = false
  }
}

function confirmarEliminar(row) {
  const label = row.codigo_sic_contrato || row.contrato_interno || `ID ${row.id}`
  const planta = row.planta_nombre ? ` (${row.planta_nombre})` : ''
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar el registro GESCON "${label}"${planta}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminarAsic(row.id)
        rows.value = rows.value.filter(r => r.id !== row.id)
        toast.success('Registro eliminado', { duration: 2000 })
      } catch (e) {
        const detail = e.data?.detail
        toast.error('No se puede eliminar', {
          description: detail || 'Error al eliminar el registro GESCON.',
          duration: 6000,
        })
      }
    },
  })
}

// ── Proyectos ─────────────────────────────────────────────────────
const proyectos = ref([])
async function cargarProyectos() {
  try {
    const data = await proyectosService.listar({ size: 500 })
    proyectos.value = data.sort((a, b) =>
      a.nombre_comercial.localeCompare(b.nombre_comercial))
  } catch { /* silencioso */ }
}

// ── Contratos PPA (fuente del selector que llena código + nombre interno) ──
const contratos = ref([])
async function cargarContratos() {
  try {
    const items = await ppaService.listar()
    contratos.value = items.map(c => ({
      ...c,
      // _label = "código — nombre" pegados, para la búsqueda y la vista cerrada del Select
      _label: `${c.numero_codigo_contrato || '(sin código)'} — ${c.nombre_interno || '(sin nombre)'}`,
    }))
  } catch { /* silencioso */ }
}

// Al elegir un contrato, llena ambos campos (código interno + nombre interno) de una vez.
function onSelectContrato() {
  const c = contratos.value.find(x => x.id === form.value.contrato_ppa_id)
  if (!c) return  // showClear -> no borra lo ya escrito
  if (c.numero_codigo_contrato) form.value.contrato_interno = c.numero_codigo_contrato
  if (c.nombre_interno) form.value.nombre_interno = c.nombre_interno
}

// ── Formulario ────────────────────────────────────────────────────
const dialogVisible = ref(false)
const guardando = ref(false)
const errores = ref({})
const editandoId = ref(null)

const FORM_INICIAL = () => ({
  tipo_solicitud: null,
  estado_solicitud: 'en_proceso',
  codigo_sic_contrato: '',
  contrato_interno: '',
  nombre_interno: '',
  contrato_ppa_id: null,
  codigo_sic_vendedor: 'UNGG',
  codigo_sic_comprador: '',
  cedula_agente_vendedor: '',
  cedula_agente_comprador: '',
  prioridad_limitacion: null,
  proyecto_id: null,
  fecha_solicitud: null,
  fecha_inicio: null,
  fecha_fin: null,
  tipo_mercado: 'No regulado',
  tipo_asignacion: '',
  porcentaje_fncer: 100,
  porcentaje_despacho: null,
  requerimiento_asic: '',
  nombre_contacto_solicitante: '',
  link_archivo: '',
  observaciones: '',
  reemplaza_anterior: true,
  es_duplicado: false,
  uso_del_recurso: false,
  modalidad_pago: null,
})
const form = ref(FORM_INICIAL())

// Modalidad de suministro: es_duplicado y uso_del_recurso son mutuamente
// excluyentes (el backend rechaza ambos con 422). Un solo control de 3 estados
// traduce a los dos flags, así es imposible marcarlos juntos por error.
const MODALIDADES_SUMINISTRO = [
  { label: 'Normal', value: 'normal' },
  { label: 'Compra en bolsa', value: 'duplicado' },
  { label: 'Uso del recurso', value: 'uso_recurso' },
]
// Modalidad de PAGO del contrato (distinta de la de suministro): marca el par
// PLG/PLC de una planta repartida entre dos contratos. El SelectButton no
// maneja null, así que '' hace de "no aplica" y se traduce a null al guardar.
const MODALIDADES_PAGO = [
  { label: 'No aplica', value: '' },
  { label: 'PLG', value: 'plg' },
  { label: 'PLC', value: 'plc' },
]
const modalidadPago = computed({
  get() { return form.value.modalidad_pago || '' },
  set(v) { form.value.modalidad_pago = v || null },
})

const modalidadSuministro = computed({
  get() {
    if (form.value.uso_del_recurso) return 'uso_recurso'
    if (form.value.es_duplicado) return 'duplicado'
    return 'normal'
  },
  set(v) {
    form.value.es_duplicado = v === 'duplicado'
    form.value.uso_del_recurso = v === 'uso_recurso'
  },
})

// Una terminación solo necesita: SIC del contrato a terminar, fecha de terminación,
// cédulas de los agentes y el link del archivo. El resto de campos se ocultan.
const esTerminacion = computed(() => form.value.tipo_solicitud === 'terminacion')

// Registrar una modificación NO es capturar un contrato nuevo: es otra versión
// del mismo SIC, y el formulario asistido solo pide lo que cambia. Editar una
// fila ya existente (lápiz) sí usa el formulario completo: ahí se corrigen
// datos de ese registro puntual, no se registra una modificación ante XM.
const modoModificacionAsistida = computed(() =>
  form.value.tipo_solicitud === 'modificacion' && !editandoId.value)
const modoTerminacionAsistida = computed(() =>
  form.value.tipo_solicitud === 'terminacion' && !editandoId.value)
const modoAsistido = computed(() => modoModificacionAsistida.value || modoTerminacionAsistida.value)

// Solo las solicitudes publicadas cuentan para la vigencia y para Cumplimiento:
// una guardada "en proceso" no cambiaría nada y el usuario no tendría cómo
// notarlo. Se propone Publicado (el selector queda editable).
watch(modoAsistido, asistido => {
  if (asistido && form.value.estado_solicitud === 'en_proceso') {
    form.value.estado_solicitud = 'publicado'
  }
})

const tituloDialogo = computed(() => {
  if (editandoId.value) return 'Editar contrato ASIC'
  if (modoModificacionAsistida.value) return 'Registrar modificación'
  if (modoTerminacionAsistida.value) return 'Registrar terminación'
  return 'Registrar contrato ASIC'
})

function onAsistidoGuardado() {
  dialogVisible.value = false
  // Recarga completa: la solicitud puede haber cerrado filas del mismo SIC y
  // recalculado la vigencia efectiva de otras.
  cargar()
}

// ── Validación de solapamiento (integridad de atribución de generación) ──
// Contratos ACTIVOS de la MISMA planta cuya ventana de fechas se cruza con la que
// se está capturando. Si existen y la planta no reemplaza a la anterior ni se marca
// como compra en bolsa, su generación se contaría dos veces en Cumplimiento.
const conflictosSolapamiento = computed(() => {
  if (esTerminacion.value) return []
  return conflictosAtribucion(
    { id: editandoId.value, proyecto_id: form.value.proyecto_id,
      fecha_inicio: form.value.fecha_inicio, fecha_fin: form.value.fecha_fin },
    rows.value,
  )
})
// El cruce queda resuelto si la planta reemplaza a la anterior, se marca como
// compra en bolsa (es_duplicado) o como uso del recurso (uso_del_recurso): en
// las tres la coexistencia es legítima. Si no, es un conflicto bloqueante.
const conflictoNoResuelto = computed(() =>
  conflictosSolapamiento.value.length > 0 &&
  !form.value.reemplaza_anterior &&
  !form.value.es_duplicado &&
  !form.value.uso_del_recurso,
)

const opcionesEstadoForm = [
  { label: 'En proceso', value: 'en_proceso' },
  { label: 'Publicado', value: 'publicado' },
  { label: 'Rechazado', value: 'rechazado' },
  { label: 'Desistido', value: 'desistido' },
]

function abrirNuevo() {
  editandoId.value = null
  form.value = FORM_INICIAL()
  errores.value = {}
  dialogVisible.value = true
}

function parseDateField(v) {
  if (!v) return null
  return new Date(v + 'T12:00:00')
}

function abrirEditar(row) {
  editandoId.value = row.id
  form.value = {
    tipo_solicitud: row.tipo_solicitud,
    estado_solicitud: row.estado_solicitud,
    codigo_sic_contrato: row.codigo_sic_contrato || '',
    contrato_interno: row.contrato_interno || '',
    nombre_interno: row.nombre_interno || '',
    contrato_ppa_id: row.contrato_ppa_id ?? null,
    codigo_sic_vendedor: row.codigo_sic_vendedor || '',
    codigo_sic_comprador: row.codigo_sic_comprador || '',
    cedula_agente_vendedor: row.cedula_agente_vendedor || '',
    cedula_agente_comprador: row.cedula_agente_comprador || '',
    prioridad_limitacion: row.prioridad_limitacion,
    proyecto_id: row.proyecto_id,
    fecha_solicitud: parseDateField(row.fecha_solicitud),
    fecha_inicio: parseDateField(row.fecha_inicio),
    fecha_fin: parseDateField(row.fecha_fin),
    tipo_mercado: row.tipo_mercado || '',
    tipo_asignacion: row.tipo_asignacion || '',
    porcentaje_fncer: row.porcentaje_fncer,
    // despacho se almacena como fracción 0-1; el form lo edita en escala 0-100
    porcentaje_despacho: row.porcentaje_despacho != null ? Number((row.porcentaje_despacho * 100).toFixed(2)) : null,
    requerimiento_asic: row.requerimiento_asic || '',
    nombre_contacto_solicitante: row.nombre_contacto_solicitante || '',
    link_archivo: row.link_archivo || '',
    observaciones: row.observaciones || '',
    reemplaza_anterior: row.reemplaza_anterior ?? true,
    es_duplicado: row.es_duplicado ?? false,
    uso_del_recurso: row.uso_del_recurso ?? false,
    modalidad_pago: row.modalidad_pago || null,
  }
  errores.value = {}
  dialogVisible.value = true
}

function toIso(v) {
  if (!v) return null
  if (typeof v === 'string') return v.slice(0, 10)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return null
}

async function guardar() {
  errores.value = {}
  if (!form.value.tipo_solicitud) { errores.value.tipo_solicitud = 'Requerido'; return }
  if (!form.value.estado_solicitud) { errores.value.estado_solicitud = 'Requerido'; return }
  // En una terminación, el SIC del contrato a terminar y la fecha de terminación son
  // obligatorios: con ellos el sistema cierra el contrato en esa fecha.
  if (esTerminacion.value) {
    if (!form.value.codigo_sic_contrato) { errores.value.codigo_sic_contrato = 'Requerido'; return }
    if (!form.value.fecha_fin) { errores.value.fecha_fin = 'Requerido'; return }
  }

  // Solapamiento de generación sin resolver: bloquea el guardado para no duplicar
  // el aporte de la planta en Cumplimiento.
  if (conflictoNoResuelto.value) {
    toast.warning('Solapamiento sin resolver', {
      description: 'Otra planta igual tiene fechas que se cruzan. Marca "Reemplaza anterior" si la sustituye, o define la modalidad ("Compra en bolsa" o "Uso del recurso") si coexiste.',
      duration: 6000,
    })
    return
  }

  guardando.value = true
  try {
    const payload = {
      ...form.value,
      codigo_sic_contrato: form.value.codigo_sic_contrato || null,
      codigo_sic_vendedor: form.value.codigo_sic_vendedor || null,
      codigo_sic_comprador: form.value.codigo_sic_comprador || null,
      cedula_agente_vendedor: form.value.cedula_agente_vendedor || null,
      cedula_agente_comprador: form.value.cedula_agente_comprador || null,
      contrato_interno: form.value.contrato_interno || null,
      nombre_interno: form.value.nombre_interno || null,
      requerimiento_asic: form.value.requerimiento_asic || null,
      nombre_contacto_solicitante: form.value.nombre_contacto_solicitante || null,
      tipo_asignacion: form.value.tipo_asignacion || null,
      link_archivo: form.value.link_archivo || null,
      observaciones: form.value.observaciones || null,
      modalidad_pago: form.value.modalidad_pago || null,
      fecha_solicitud: toIso(form.value.fecha_solicitud),
      fecha_inicio: toIso(form.value.fecha_inicio),
      fecha_fin: toIso(form.value.fecha_fin),
      // despacho: el form usa escala 0-100 pero la BD/cumplimiento usa fracción 0-1
      porcentaje_despacho: form.value.porcentaje_despacho != null
        ? Number((form.value.porcentaje_despacho / 100).toFixed(4)) : null,
    }

    // Invariantes de una terminación (las mismas que aplica POST /asic/terminacion):
    // sin planta —con proyecto_id, Cumplimiento borra la planta del mes de la
    // terminación en vez de prorratearla hasta la fecha— y sin porcentajes, que
    // no aplican a una fila que no aporta energía.
    // La identidad del contrato (contrato interno, nombre interno, vendedor,
    // comprador, prioridad, PPA) SÍ se conserva: antes se borraba aquí y por eso
    // las terminaciones salían en blanco en la tabla y en el Excel.
    if (esTerminacion.value) {
      Object.assign(payload, {
        proyecto_id: null,
        fecha_inicio: null,
        porcentaje_fncer: null,
        porcentaje_despacho: null,
        reemplaza_anterior: true,
        es_duplicado: false,
        uso_del_recurso: false,
      })
    }

    if (editandoId.value) {
      const data = await ppaService.actualizarAsic(editandoId.value, payload)
      const idx = rows.value.findIndex(r => r.id === editandoId.value)
      if (idx !== -1) rows.value.splice(idx, 1, data)
      else rows.value = [data, ...rows.value]
      rows.value = [...rows.value]
      toast.success('Actualizado', { description: 'Contrato ASIC actualizado', duration: 3000 })
    } else {
      const data = await ppaService.crearAsic(payload)
      rows.value = [data, ...rows.value]
      toast.success('Guardado', { description: 'Contrato ASIC registrado', duration: 3000 })
    }
    dialogVisible.value = false
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'Error al guardar', duration: 4000 })
  } finally {
    guardando.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}
function esVencido(d) { return d && d < hoy }

// porcentaje_despacho se almacena como fracción 0-1 (1 = 100%); el backend de
// cumplimiento lo usa como multiplicador directo (gen × pct_despacho). Para mostrar
// se multiplica ×100, igual que en CumplimientoV2View.
function despachoPct(v) {
  if (v == null || v === '') return null
  const n = Number(v) * 100
  if (Number.isNaN(n)) return null
  return Number.isInteger(n) ? n : Number(n.toFixed(2))
}
// Valor fuera de la escala canónica 0-1 (p.ej. un 100 guardado por el formulario
// antiguo). Se resalta para que se corrija: rompe el cálculo de cumplimiento.
function despachoAnomalo(v) { return v != null && v !== '' && Number(v) > 1 }

const TIPO_LABELS = { registro: 'Registro', modificacion: 'Modificación', terminacion: 'Terminación', desistimiento: 'Desistimiento' }
const TIPO_SEV = { registro: 'success', modificacion: 'information', terminacion: 'warning', desistimiento: 'default' }
function tipoLabel(v) { return TIPO_LABELS[v] || v }
function tipoSeverity(v) { return TIPO_SEV[v] || 'default' }

const ESTADO_LABELS = { publicado: 'Publicado', en_proceso: 'En proceso', rechazado: 'Rechazado', desistido: 'Desistido', terminado: 'Terminado' }
const ESTADO_SEV = { publicado: 'success', en_proceso: 'information', rechazado: 'destructive', desistido: 'default', terminado: 'warning' }
function estadoLabel(v) { return ESTADO_LABELS[v] || v }
function estadoSeverity(v) { return ESTADO_SEV[v] || 'default' }

// ── Backfill de nombres internos faltantes ─────────────────────────
const backfillDialog    = ref(false)
const backfillReport    = ref(null)
const backfillLoading   = ref(false)
const backfillExecuting = ref(false)

async function previewBackfill() {
  backfillLoading.value = true
  try {
    const data = await ppaService.backfillNombreInterno(true)
    backfillReport.value = data
    backfillDialog.value = true
  } catch (e) {
    toast.error('No se pudo previsualizar', {
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  } finally {
    backfillLoading.value = false
  }
}

async function applyBackfill() {
  backfillExecuting.value = true
  try {
    const data = await ppaService.backfillNombreInterno(false)
    toast.success('Nombres internos completados', {
      description: `${data.a_actualizar} registro(s) actualizados.`,
      duration: 4000,
    })
    backfillDialog.value = false
    backfillReport.value = null
    await cargar()  // recarga la tabla ya con los nombres completos
  } catch (e) {
    toast.error('El backfill falló (se revirtió)', {
      description: e.data?.detail || e.message,
      duration: 7000,
    })
  } finally {
    backfillExecuting.value = false
  }
}

// ── Backfill de la identidad de las terminaciones viejas ──────────────────
const backfillTermDialog    = ref(false)
const backfillTermReport    = ref(null)
const backfillTermLoading   = ref(false)
const backfillTermExecuting = ref(false)

// Hay algo que aplicar si faltan datos de identidad O fechas por estampar.
const backfillTermPendiente = computed(() =>
  !!backfillTermReport.value
  && ((backfillTermReport.value.a_actualizar || 0) + (backfillTermReport.value.a_recortar || 0)) > 0)

async function previewBackfillTerm() {
  backfillTermLoading.value = true
  try {
    const data = await ppaService.backfillTerminaciones(true)
    backfillTermReport.value = data
    backfillTermDialog.value = true
  } catch (e) {
    toast.error('No se pudo previsualizar', {
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  } finally {
    backfillTermLoading.value = false
  }
}

async function applyBackfillTerm() {
  backfillTermExecuting.value = true
  try {
    const data = await ppaService.backfillTerminaciones(false)
    toast.success('Terminaciones completadas', {
      description: `${data.a_actualizar} terminación(es) con datos completados · `
            + `${data.a_recortar || 0} registro(s) con la fecha estampada.`,
      duration: 5000,
    })
    backfillTermDialog.value = false
    backfillTermReport.value = null
    await cargar()
  } catch (e) {
    toast.error('El backfill falló (se revirtió)', {
      description: e.data?.detail || e.message,
      duration: 7000,
    })
  } finally {
    backfillTermExecuting.value = false
  }
}

onMounted(() => { cargar(); cargarProyectos(); cargarContratos() })
</script>
