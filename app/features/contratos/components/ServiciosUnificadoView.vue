<!--
  Servicios — vista unificada.

  Clientes, Proyectos y Servicios miran casi siempre la misma realidad (un
  cliente, sus plantas y los contratos que las cubren) desde tres ángulos. En
  vez de tres pestañas separadas, acá el ángulo es un selector: la página, la
  búsqueda, la densidad y el Excel son los mismos; sólo cambian las columnas.

  Las tres vistas clásicas (/clientes, /proyectos, /servicios) siguen vivas y
  sin tocar. Esta es aditiva: mismos endpoints, misma semántica de datos.
-->
<template>
  <div class="space-y-3">
    <PageHeader title="Proyectos" :subtitle="subtitulo">
      <template #actions>
        <IconField v-if="vista" class="w-full! sm:max-w-48!">
          <InputIcon><SearchIcon class="size-4" /></InputIcon>
          <InputText v-model="q" :placeholder="placeholderBusqueda" size="small" class="w-full" />
        </IconField>
        <Button v-if="vista"
                severity="secondary" outlined size="small"
                v-tooltip.bottom="compacta ? 'Densidad cómoda' : 'Densidad compacta'"
                @click="compacta = !compacta">
          <template #icon><component :is="compacta ? MoveVerticalIcon : AlignJustifyIcon" class="size-4" /></template>
        </Button>
        <Button v-if="vista" label="Excel" severity="secondary" outlined size="small" :disabled="!filasVisibles.length" @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-4" /></template>
        </Button>
        <Button v-if="vista === 'clientes'" label="Nuevo cliente" size="small" @click="dialogCliente = true">
          <template #icon><PlusIcon class="size-4" /></template>
        </Button>
        <Button v-else-if="vista === 'proyectos'" label="Nuevo proyecto" size="small" @click="dialogProyecto = true">
          <template #icon><PlusIcon class="size-4" /></template>
        </Button>
        <Button v-else-if="vista === 'servicios' && servicio === 'ppa'" label="Nuevo PPA" size="small" class="bg-warning border-warning hover:bg-warning/90" @click="abrirWizardPPA(null)">
          <template #icon><PlusIcon class="size-4" /></template>
        </Button>
        <template v-else-if="vista === 'servicios'">
          <Button :label="`Nuevo ${servicioInfo?.label}`"
                  size="small"
                  class="bg-(--c) border-(--c)"
                  :style="{ '--c': servicioInfo?.color }"
                  @click="nuevoContrato($event)">
            <template #icon><component :is="tiposDelServicio.length > 1 ? ChevronDownIcon : PlusIcon" class="size-4" /></template>
          </Button>
          <Menu ref="menuNuevoContrato" :model="opcionesNuevoContrato" :popup="true">
            <template #itemicon="{ item }"><component :is="item.icon" class="size-4" /></template>
          </Menu>
        </template>
      </template>
    </PageHeader>

    <!-- Selector de ángulo (nivel 1) + tipo de servicio (nivel 2) -->
    <div class="flex flex-wrap items-center gap-2">
      <button v-for="v in VISTAS" :key="v.key" type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer select-none transition-colors duration-150"
              :class="vista === v.key
                ? 'bg-(--bg) border-(--bd) text-(--c) shadow-xs [&>svg]:text-(--c)'
                : 'bg-card border-border text-muted-foreground [&>svg]:text-muted-foreground/60 hover:border-unergy-purple/30 hover:text-unergy-deep'"
              :style="vista === v.key ? { '--bg': tinte(v.color, 10), '--bd': tinte(v.color, 33), '--c': v.color } : undefined"
              @click="seleccionarVista(v.key)">
        <component :is="v.icon" class="size-4" />
        <span>{{ v.label }}</span>
        <span v-if="conteoVista(v.key) !== null" class="rounded-full text-xs font-extrabold px-1.5 min-w-4.5 text-center"
              :class="vista === v.key ? 'bg-(--bg) text-(--c)' : 'bg-muted text-muted-foreground'"
              :style="vista === v.key ? { '--bg': tinte(v.color, 13), '--c': v.color } : undefined">
          {{ conteoVista(v.key) }}
        </span>
      </button>

      <template v-if="vista === 'servicios'">
        <span class="mx-1 h-6 w-px bg-border" />
        <button v-for="s in SERVICIOS" :key="s.key" type="button"
                class="inline-flex items-center gap-1.5 px-2 py-1 border rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors duration-150"
                :class="servicio === s.key
                  ? 'bg-(--bg) border-(--bd) text-(--c) shadow-xs [&>svg]:text-(--c)'
                  : 'bg-card border-border text-muted-foreground [&>svg]:text-muted-foreground/60 hover:border-unergy-purple/30 hover:text-unergy-deep'"
                :style="servicio === s.key ? { '--bg': tinte(s.color, 10), '--bd': tinte(s.color, 33), '--c': s.color } : undefined"
                @click="seleccionarServicio(s.key)">
          <component :is="s.icon" class="size-4" />
          <span>{{ s.label }}</span>
        </button>
      </template>
    </div>

    <!-- Sin fila de filtros en Clientes/Servicios (decisión de 2026-08-20): el
         buscador de la cabecera cubre el caso y la fila le robaba alto a la
         tabla, que es lo que interesa maximizar ahí. Las columnas siguen
         siendo ordenables, así que acotar por estado/tipo se hace con un clic
         en el encabezado.

         Proyectos SÍ tiene una fila de filtros fija (Estado/Tipo/Portafolio/
         PPA) -- decisión explícita del usuario, 2026-09-08, revirtiendo un
         panel "Filtros" centralizado que se probó primero. El buscador de
         Proyectos sigue siendo el de la cabecera, compartido con los otros
         ángulos. -->
    <!-- Proyectos que las fuentes externas proponen. Vivia en /proyectos, que
         salio del menu cuando llego esta vista: el aviso quedo inalcanzable y
         nadie lo noto por semanas. -->
    <ProyectosPendientesPanel v-if="vista === 'proyectos'" @cambio="cargarProyectos" />

    <div v-if="vista === 'proyectos'"
         class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border">
      <div>
        <label class="text-xs font-semibold text-muted-foreground">Estado</label>
        <Select v-model="filtrosProyectos.estado.value" :options="estadoOpcionesProyectos"
                optionLabel="label" optionValue="value" placeholder="Todos" showClear
                size="small" />
      </div>
      <div>
        <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
        <Select v-model="filtrosProyectos.tipo_proyecto.value" :options="tipoOpcionesProyectos"
                optionLabel="label" optionValue="value" placeholder="Todos" showClear
                size="small" />
      </div>
      <div>
        <label class="text-xs font-semibold text-muted-foreground">Portafolio</label>
        <Select v-model="filtrosProyectos.portafolio_id.value" :options="portafolios"
                optionLabel="nombre" optionValue="id" filter placeholder="Todos" showClear
                size="small" />
      </div>
      <div>
        <label class="text-xs font-semibold text-muted-foreground">PPA</label>
        <MultiSelect v-model="filtrosProyectos.ppa_contratos.value" :options="ppaOpcionesProyectos"
                     optionLabel="label" optionValue="value" filter display="chip"
                     placeholder="Todos" :maxSelectedLabels="1" selectedItemsLabel="{0} PPAs"
                     size="small" />
      </div>
      <Button v-if="nFiltrosProyectosActivos" label="Limpiar filtros" text size="small"
              @click="limpiarFiltrosProyectos" />
    </div>

    <!-- Filtros de Servicios. Misma fila fija que la de Proyectos; los controles
         cambian según la pestaña porque las tres tablas no comparten columnas.
         Los predicados viven en `~/features/contratos/filtrosServicios`. -->
    <div v-if="vista === 'servicios'"
         class="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border">
      <template v-if="servicio === 'ppa'">
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Estado</label>
          <Select v-model="filtrosPpa.estado" :options="VIGENCIA_OPCIONES"
                  optionLabel="label" optionValue="value" placeholder="Todos" showClear
                  size="small" />
        </div>
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
          <Select v-model="filtrosPpa.tipo" :options="opcionesPpaTipo"
                  optionLabel="label" optionValue="value" placeholder="Todos" showClear
                  size="small" />
        </div>
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Comprador</label>
          <Select v-model="filtrosPpa.comprador" :options="opcionesPpaComprador"
                  optionLabel="label" optionValue="value" filter placeholder="Todos" showClear
                  size="small" />
        </div>
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Vendedor</label>
          <Select v-model="filtrosPpa.vendedor" :options="opcionesPpaVendedor"
                  optionLabel="label" optionValue="value" filter placeholder="Todos" showClear
                  size="small" />
        </div>
        <Button v-if="nFiltrosPpaActivos" label="Limpiar filtros" text size="small"
                @click="limpiarFiltrosPpa" />
      </template>

      <template v-else>
        <div v-if="tiposDelServicio.length > 1">
          <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
          <Select v-model="filtrosServicio.tipo" :options="opcionesServicioTipo"
                  optionLabel="label" optionValue="value" placeholder="Todos" showClear
                  size="small" />
        </div>
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Estado</label>
          <Select v-model="filtrosServicio.estado" :options="ESTADO_CONTRATO_OPCIONES"
                  optionLabel="label" optionValue="value" placeholder="Todos" showClear
                  size="small" />
        </div>
        <div v-if="esRepresentacion">
          <label class="text-xs font-semibold text-muted-foreground">Inversionista</label>
          <Select v-model="filtrosServicio.inversionista" :options="opcionesInversionista"
                  optionLabel="label" optionValue="value" filter placeholder="Todos" showClear
                  size="small" />
        </div>
        <div v-if="esRepresentacion">
          <label class="text-xs font-semibold text-muted-foreground">Portafolio</label>
          <Select v-model="filtrosServicio.portafolio" :options="opcionesPortafolio"
                  optionLabel="label" optionValue="value" filter placeholder="Todos" showClear
                  size="small" />
        </div>
        <!-- Solo si hay más de una clase entre los contratos cargados: con una
             sola, el desplegable no seleccionaría nada distinto. -->
        <div v-if="opcionesTipoPlanta.length > 1">
          <label class="text-xs font-semibold text-muted-foreground">Tipo de planta</label>
          <Select v-model="filtrosServicio.tipoPlanta" :options="opcionesTipoPlanta"
                  optionLabel="label" optionValue="value" placeholder="Todos" showClear
                  size="small" />
        </div>
        <!-- Sin desplegable de "Proyecto": aislar los huérfanos sigue estando en
             el botón "Ver solo estos" de la barra de aviso, que es de donde salió
             y donde tiene el contexto (dice cuántos son). El filtro sigue
             existiendo en el estado; lo que se quitó es el control duplicado. -->
        <Button v-if="nFiltrosServicioActivos" label="Limpiar filtros" text size="small"
                @click="limpiarFiltrosServicio" />
      </template>
    </div>

    <!-- ══════════════════ CLIENTES ══════════════════ -->
    <div v-if="vista === 'clientes'" class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <DataTable :value="clientesFiltrados" :loading="loadingClientes" size="small"
                 class="tabla tabla--clickable" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight" :rowClass="rowClassCliente"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="razon_social_nombre" :sortOrder="1" rowHover
                 @row-click="e => ir(`/clientes/${e.data.id}`)"
                 emptyMessage="No hay clientes.">
        <Column field="razon_social_nombre" header="Razón social" sortable>
          <template #body="{ data }">
            <div class="flex items-center gap-1 min-w-0">
              <TruncatedText :text="formatearNombre(data.razon_social_nombre)" class="min-w-0 max-w-full font-semibold text-unergy-deep" />
              <span v-if="data.alerta_contrato && data.alerta_contrato !== 'vigente'"
                    class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-(--bg) text-(--c)"
                    :style="{ '--c': SEMAFORO[data.alerta_contrato].color, '--bg': SEMAFORO[data.alerta_contrato].bg }">
                {{ SEMAFORO[data.alerta_contrato].label }}
              </span>
            </div>
          </template>
        </Column>
        <Column field="nit_cedula" header="NIT" sortable>
          <template #body="{ data }"><span class="font-mono text-xs text-muted-foreground">{{ fmt(data.nit_cedula) }}</span></template>
        </Column>
        <Column field="num_plantas" header="Plantas" sortable bodyStyle="text-align:right">
          <template #body="{ data }">
            <span class="font-semibold tabular-nums text-unergy-deep">{{ data.num_plantas }}</span>
          </template>
        </Column>
        <Column header="Servicios">
          <template #body="{ data }">
            <div class="flex gap-0.5 overflow-hidden min-w-0">
              <span v-for="sv in data.servicios" :key="sv" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-unergy-purple/10 text-unergy-purple">{{ servicioLabel(sv) }}</span>
              <span v-if="!data.servicios?.length" class="text-xs text-muted-foreground/50">—</span>
            </div>
          </template>
        </Column>
        <Column field="contacto_comercial_nombre" header="Contacto" sortable>
          <template #body="{ data }">
            <TruncatedText :text="fmt(data.contacto_comercial_nombre)" class="min-w-0 max-w-full" />
          </template>
        </Column>
        <Column field="contacto_comercial_correo" header="Correo" sortable>
          <template #body="{ data }">
            <TruncatedText :text="fmt(data.contacto_comercial_correo)" class="min-w-0 max-w-full text-xs text-muted-foreground" />
          </template>
        </Column>
        <Column header="Falta">
          <template #body="{ data }">
            <div class="flex gap-1">
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-4" />{{ faltanCampos(data).length }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-4" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column>
          <template #body="{ data }">
            <div class="flex justify-end gap-0">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/clientes/${data.id}`)">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarCliente(data)">
                <template #icon><Trash2Icon class="size-4" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════════════════ PROYECTOS ══════════════════ -->
    <div v-else-if="vista === 'proyectos'" class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <DataTable :value="proyectosFiltrados"
                 :loading="loadingProyectos" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="nombre_comercial" :sortOrder="1" rowHover
                 emptyMessage="No se encontraron proyectos.">
        <Column field="nombre_comercial" header="Nombre comercial" sortable>
          <template #body="{ data }">
            <span class="block text-xs leading-none font-mono"
                  :class="data.codigo_tsf ? 'text-muted-foreground' : 'text-muted-foreground/50'">
              {{ data.codigo_tsf || '—' }}
            </span>
            <button type="button" class="block max-w-full text-left text-xs font-semibold text-unergy-deep cursor-pointer transition-colors duration-150 hover:text-unergy-purple hover:underline underline-offset-2" @click="ir(`/proyectos/${data.id}`)">
              <TruncatedText :text="formatearNombre(data.nombre_comercial)" class="min-w-0" />
            </button>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable>
          <template #body="{ data }">
            <span class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap gap-1"
                  :class="ESTADO_CLASS[data.estado] || 'bg-muted text-muted-foreground'">
              <span v-if="data.estado === 'en_operacion'" class="pulse-dot inline-block size-1.5 rounded-full bg-success shrink-0" />
              {{ ESTADO_LABELS[data.estado] || data.estado || '—' }}
            </span>
          </template>
        </Column>
        <Column field="tipo_proyecto" header="Tipo" sortable>
          <template #body="{ data }">
            <span class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap" :class="TIPO_BADGE_CLASS[data.tipo_proyecto] || 'bg-muted text-muted-foreground'">
              {{ TIPO_LABELS[data.tipo_proyecto] || data.tipo_proyecto || '—' }}
            </span>
          </template>
        </Column>
        <Column field="portafolio_id" header="Portafolio" sortable>
          <template #body="{ data }">
            <TruncatedText :text="nombrePortafolio(data.portafolio_id) || '—'" class="min-w-0 max-w-full text-xs text-muted-foreground" />
          </template>
        </Column>
        <Column field="municipio" header="Ubicación" sortable>
          <template #body="{ data }">
            <TruncatedText v-if="data.municipio || data.departamento" :text="[data.municipio, data.departamento].filter(Boolean).join(', ')" class="min-w-0 max-w-full text-xs text-muted-foreground" />
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
        </Column>
        <Column field="info_tecnica.capacidad_instalada_kwp" header="kWp" sortable bodyStyle="text-align:right">
          <template #body="{ data }">
            <span class="font-mono text-xs text-muted-foreground" v-tooltip.bottom="`AC: ${num(data.info_tecnica?.potencia_ac_kw)} kW`">
              {{ num(data.info_tecnica?.capacidad_instalada_kwp) }}
            </span>
          </template>
        </Column>
        <Column header="Servicios">
          <template #body="{ data }">
            <div class="flex gap-0.5 overflow-hidden min-w-0">
              <template v-for="srv in SERVICIOS_BADGES" :key="srv.key">
                <span v-if="data[srv.key]" class="inline-flex items-center shrink-0 text-xs font-bold leading-normal px-1.5 rounded-full whitespace-nowrap bg-success/10 text-success"
                      v-tooltip.bottom="srv.tooltip">{{ srv.badge }}</span>
              </template>
              <span v-if="!SERVICIOS_BADGES.some(sb => data[sb.key])" class="text-xs text-muted-foreground/50">—</span>
            </div>
          </template>
        </Column>
        <Column header="PPA">
          <template #body="{ data }">
            <div v-if="ppaVigentes(data).length" class="flex gap-0.5 overflow-hidden min-w-0">
              <button v-for="c in ppaVigentes(data)" :key="c.id" type="button" class="min-w-0 truncate bg-unergy-purple/10 text-unergy-purple-dark text-xs font-semibold px-1.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-unergy-purple hover:text-white"
                      v-tooltip.bottom="ppaTooltip(c)" @click="ir(`/proyectos/${data.id}/ppa`)">
                {{ ppaLabel(c) }}
              </button>
            </div>
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
        </Column>
        <Column header="Falta">
          <template #body="{ data }">
            <div class="flex gap-1">
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-4" />{{ faltanCampos(data).length }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-4" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column>
          <template #body="{ data }">
            <div class="flex justify-end gap-0">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/proyectos/${data.id}?edit=true`)">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarProyecto(data)">
                <template #icon><Trash2Icon class="size-4" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════════════════ SERVICIOS · PPA ══════════════════ -->
    <div v-else-if="servicio === 'ppa'" class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <DataTable :value="ppaFiltrados" :loading="loadingPpa" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="fecha_inicio" :sortOrder="1" rowHover
                 emptyMessage="No hay contratos PPA registrados.">
        <Column field="nombre_interno" header="Nombre interno" sortable>
          <template #body="{ data }">
            <button type="button" class="block max-w-full text-left text-xs font-semibold text-unergy-deep cursor-pointer transition-colors duration-150 hover:text-unergy-purple hover:underline underline-offset-2" @click="ir(`/contratos/${data.id}`)">
              <TruncatedText :text="data.nombre_interno || data.numero_codigo_contrato || '—'" class="min-w-0" />
            </button>
          </template>
        </Column>
        <Column field="numero_codigo_contrato" header="N° contrato" sortable>
          <template #body="{ data }">
            <TruncatedText v-if="data.numero_codigo_contrato" :text="data.numero_codigo_contrato" class="font-mono text-xs text-muted-foreground min-w-0 max-w-full" />
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
        </Column>
        <Column field="tipo_contrato" header="Tipo" sortable>
          <template #body="{ data }">
            <span class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap"
                  :class="data.tipo_contrato === 'compra'
                    ? 'bg-unergy-purple text-primary-foreground'
                    : 'bg-unergy-yellow text-unergy-deep'">
              {{ data.tipo_contrato === 'compra' ? 'Compra' : 'Venta' }}
            </span>
          </template>
        </Column>
        <!-- Estado de vigencia: derivado de las fechas, mismo cálculo que el
             detalle del contrato (utils/ppaVigencia.js). Ordena por urgencia. -->
        <Column field="_vigencia.orden" header="Estado" sortable>
          <template #body="{ data }">
            <span class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-(--bg) text-(--c)"
                  :style="{ '--bg': data._vigencia.bg, '--c': data._vigencia.color }"
                  v-tooltip.bottom="data._vigencia.detalle">
              {{ data._vigencia.label }}
            </span>
          </template>
        </Column>
        <Column field="comprador_nombre" header="Comprador" sortable>
          <template #body="{ data }">
            <TruncatedText :text="data.comprador_nombre || '—'" class="min-w-0 max-w-full" />
          </template>
        </Column>
        <Column field="vendedor_nombre" header="Vendedor" sortable>
          <template #body="{ data }">
            <TruncatedText :text="data.vendedor_nombre || '—'" class="min-w-0 max-w-full" />
          </template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable>
          <template #body="{ data }"><span class="font-mono text-xs text-muted-foreground">{{ fmtFecha(data.fecha_inicio) }}</span></template>
        </Column>
        <!-- Resaltado y tooltip salen de _vigencia, no de dias_restantes: el
             listado de /ppa devuelve las filas del ORM y ese campo llega null,
             así que este aviso nunca se veía. -->
        <Column field="fecha_fin" header="Fin" sortable>
          <template #body="{ data }">
            <span class="font-mono text-xs"
                  :class="['vencido', 'por_vencer'].includes(data._vigencia.clave) ? 'font-bold text-(--c)' : 'text-muted-foreground'"
                  :style="{ '--c': data._vigencia.color }"
                  v-tooltip.bottom="data._vigencia.detalle">
              {{ fmtFecha(data.fecha_fin) }}
            </span>
          </template>
        </Column>
        <Column field="cobertura_actual_pct" header="Cobertura" sortable>
          <template #body="{ data }">
            <div v-if="data.cobertura_actual_pct != null" class="flex items-center gap-1">
              <div class="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                <div class="h-full rounded-full w-(--w)"
                     :class="data.cobertura_actual_pct >= 90 ? 'bg-success'
                       : data.cobertura_actual_pct >= 70 ? 'bg-warning' : 'bg-destructive'"
                     :style="{ '--w': Math.min(data.cobertura_actual_pct, 100) + '%' }" />
              </div>
              <span class="font-mono text-xs text-muted-foreground">{{ data.cobertura_actual_pct }}%</span>
            </div>
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
        </Column>
        <Column header="Falta">
          <template #body="{ data }">
            <div class="flex gap-1">
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-4" />{{ faltanCampos(data).length }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-4" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column>
          <template #body="{ data }">
            <div class="flex justify-end gap-0">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/contratos/${data.id}`)">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarPpa(data)">
                <template #icon><Trash2Icon class="size-4" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════ SERVICIOS · REPRESENTACIÓN / OPERACIÓN / REC ══════
         Los tres son contratos de `contratos_servicio`; Operación agrupa
         mantenimiento, arriendo e internet, así que lleva columna Tipo. -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <!-- Todo contrato de representación pertenece a una planta. Los que no la
           tienen son un error de datos, no un estado válido: la barra los cuenta
           y deja aislarlos para irlos cerrando hasta llegar a cero. -->
      <div v-if="nHuerfanos" class="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-warning/10 text-warning border-b border-warning/30">
        <TriangleAlertIcon class="size-4" />
        <span><strong>{{ nHuerfanos }}</strong> de {{ contratosServicio.length }} contratos sin proyecto asociado</span>
        <Button :label="soloHuerfanos ? 'Ver todos' : 'Ver solo estos'" text size="small"
                class="ml-auto" @click="alternarHuerfanos" />
      </div>

      <!-- Duplicados: el mismo contrato escrito por varias fuentes. Se limpian
           desde acá porque ir planta por planta no es viable con 126 contratos. -->
      <div v-if="esRepresentacion && nDuplicados" class="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-primary/10 text-primary border-b border-primary/30">
        <CopyIcon class="size-4" />
        <span>
          <strong>{{ nDuplicados }}</strong> registros duplicados en
          {{ duplicados.grupos_fusionables.length }}
          planta{{ duplicados.grupos_fusionables.length === 1 ? '' : 's' }}
          <template v-if="nEnConflicto">
            · {{ nEnConflicto }} grupo{{ nEnConflicto === 1 ? '' : 's' }} necesita revisión
          </template>
        </span>
        <Button label="Ver solo estos" text size="small" class="ml-auto"
                @click="soloDuplicados = !soloDuplicados" v-if="!soloDuplicados" />
        <Button label="Ver todos" text size="small" class="ml-auto"
                @click="soloDuplicados = false" v-else />
        <Button label="Fusionar duplicados" size="small" :loading="fusionando" @click="confirmarFusion">
          <template #icon><CheckIcon class="size-4" /></template>
        </Button>
      </div>
      <DataTable :value="contratosServicioFiltrados" :loading="loadingServicio" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="fecha_inicio" :sortOrder="1" rowHover
                 :emptyMessage="`No hay contratos de ${servicioInfo?.label} registrados.`">
        <!-- Proyecto va PRIMERO y con el nombre más grande: es lo que identifica
             la fila. Un contrato de servicio se firma SOBRE una planta, así que
             sin esta columna la tabla no dice de qué habla cada fila. Cuando el
             contrato quedó huérfano (proyecto_id NULL) la celda es el botón para
             arreglarlo, en vez de un "—" que no lleva a ninguna parte. -->
        <Column field="proyecto.nombre_comercial" header="Proyecto"
                sortable>
          <template #body="{ data }">
            <button v-if="data.proyecto" type="button" class="group flex items-center gap-1 min-w-0 w-full text-left cursor-pointer text-unergy-deep"
                    v-tooltip.bottom="'Ver la planta'"
                    @click.stop="ir(rutaDeLaPlanta(data))">
              <TruncatedText :text="data.proyecto.nombre_comercial" class="min-w-0 max-w-full text-sm font-semibold group-hover:text-unergy-purple group-hover:underline" />
            </button>
            <button v-else type="button" class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-2 rounded-full cursor-pointer bg-warning/10 text-warning border border-dashed border-warning/50 transition-colors duration-150 hover:bg-warning/20"
                    v-tooltip.bottom="'Este contrato no está asociado a ninguna planta. Click para asociarlo.'"
                    @click.stop="abrirAsociarProyecto(data)">
              <LinkIcon class="size-4" />Sin proyecto
            </button>
          </template>
        </Column>
        <!-- La clase de planta, en columna propia: pegada al nombre competía con
             él por el ancho y no se podía ordenar ni leer en vertical. Se llama
             "Tipo de planta" y no "Tipo" porque en Operación ya hay una columna
             Tipo, la del contrato (mantenimiento/arriendo/internet). El 13% es
             para que el encabezado entre entero: con 10% se cortaba.
             Va junto al nombre —y antes que el tipo de contrato— porque describe
             la PLANTA: las dos primeras columnas hablan de la misma cosa. -->
        <Column field="proyecto.tipo_proyecto" header="Tipo de planta" sortable>
          <template #body="{ data }">
            <span v-if="data.proyecto" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap"
                  :class="TIPO_BADGE_CLASS[data.proyecto.tipo_proyecto] || 'bg-muted text-muted-foreground'">
              {{ TIPO_LABELS[data.proyecto.tipo_proyecto] || data.proyecto.tipo_proyecto || 'Sin tipo' }}
            </span>
            <span v-else class="text-muted-foreground">—</span>
          </template>
        </Column>
        <!-- Un chip por subservicio: en Representación y CGM un mismo contrato
             cubre los dos, y pintar solo `servicio_aplica` ocultaba el CGM. -->
        <Column v-if="tiposDelServicio.length > 1" field="servicio_aplica" header="Tipo"
                sortable>
          <template #body="{ data }">
            <span v-for="sub in subserviciosDeFila(data)" :key="sub" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap mr-1 bg-(--bg) text-(--c)"
                  :style="{
                    '--c': colorTipoContrato(sub),
                    '--bg': tinte(colorTipoContrato(sub), 12) }">
              {{ TIPO_CONTRATO_LABELS[sub] || sub }}
            </span>
            <span v-if="!subserviciosDeFila(data).length" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap text-muted-foreground bg-muted">—</span>
          </template>
        </Column>
        <!-- El inversionista es lo que distingue dos contratos de la misma
             planta: La Reserva tiene dos, Baraya tres. -->
        <Column v-if="esRepresentacion" field="inversionista_nombre" header="Inversionista"
                sortable>
          <template #body="{ data }">
            <TruncatedText :text="data.inversionista_nombre ? formatearNombre(data.inversionista_nombre) : '—'" class="min-w-0 max-w-full" />
          </template>
        </Column>
        <!-- Solo en Representación: ahí el número está cargado y sirve para
             identificar el contrato. En Operación ninguno lo trae, así que era
             una columna de 66 guiones ocupando el 15% del ancho. El buscador de
             la cabecera sigue mirando `numero_contrato` en las dos pestañas. -->
        <Column v-if="esRepresentacion" field="numero_contrato" header="N° contrato" sortable>
          <template #body="{ data }"><TruncatedText :text="data.numero_contrato || '—'" class="min-w-0 max-w-full font-mono text-xs text-muted-foreground" /></template>
        </Column>
        <!-- Contratante y prestador salen del cuadro en Representación: el seed
             CGM no los llena y el par real es Unergy ↔ inversionista, que ya
             tiene columna propia. El buscador sí sigue mirándolos. -->
        <Column v-if="!esRepresentacion" field="contratante_nombre" header="Contratante" sortable>
          <template #body="{ data }"><TruncatedText :text="data.contratante_nombre || '—'" class="min-w-0 max-w-full" /></template>
        </Column>
        <Column v-if="!esRepresentacion" field="prestador_nombre" header="Prestador" sortable>
          <template #body="{ data }"><TruncatedText :text="data.prestador_nombre || '—'" class="min-w-0 max-w-full" /></template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable>
          <template #body="{ data }"><span class="font-mono text-xs text-muted-foreground">{{ fmtFecha(data.fecha_inicio) }}</span></template>
        </Column>
        <Column field="fecha_fin" header="Fin" sortable>
          <template #body="{ data }"><span class="font-mono text-xs text-muted-foreground">{{ fmtFecha(data.fecha_fin) }}</span></template>
        </Column>
        <Column field="estado" header="Estado" sortable>
          <template #body="{ data }">
            <span class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap" :class="ESTADO_CONTRATO_CLASS[data.estado] || 'bg-muted text-muted-foreground'">
              {{ ESTADO_CONTRATO_LABELS[data.estado] || data.estado || '—' }}
            </span>
          </template>
        </Column>
        <Column header="Falta">
          <template #body="{ data }">
            <div class="flex gap-1">
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-4" />{{ faltanCampos(data).length }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(data).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-4" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column>
          <template #body="{ data }">
            <div class="flex justify-end gap-0">
              <Button text size="small" severity="secondary" v-tooltip.bottom="data.proyecto ? 'Cambiar de proyecto' : 'Asociar a un proyecto'" @click.stop="abrirAsociarProyecto(data)">
                <template #icon><LinkIcon class="size-4" /></template>
              </Button>
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="irAEditarContratoServicio(data)">
                <template #icon><PencilIcon class="size-4" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarContratoServicio(data)">
                <template #icon><Trash2Icon class="size-4" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ── Creación ─────────────────────────────────────────────────────────── -->
    <Dialog v-model:visible="dialogCliente" header="Nuevo cliente" modal class="w-full max-w-lg">
      <ClienteForm :initial="{}" @save="crearCliente" @cancel="dialogCliente = false" />
    </Dialog>

    <Dialog v-model:visible="dialogProyecto" header="Nuevo proyecto" modal class="w-full max-w-xl">
      <ProyectoForm @save="crearProyecto" @cancel="dialogProyecto = false" />
    </Dialog>

    <!-- Asociar un contrato de representación a su planta. Se muestran los datos
         que el contrato trae del acta (nombre de referencia, código Sun Factory)
         porque son la única pista para elegir bien. -->
    <Dialog v-model:visible="dialogAsociarProyecto" header="Asociar contrato a un proyecto"
            modal class="w-full max-w-lg">
      <div v-if="contratoAAsociar" class="space-y-3">
        <!-- Los datos que sirven de pista son distintos por tipo: un contrato de
             Operación no tiene inversionista ni código Sun Factory, y mostrarlos
             vacíos solo estorba al decidir. -->
        <div class="rounded-lg p-3 text-xs space-y-0.5 bg-muted text-muted-foreground">
          <template v-if="contratoAAsociar.servicio_aplica === 'representacion'">
            <p><span class="font-semibold">Inversionista:</span>
              {{ contratoAAsociar.inversionista_nombre || '—' }}</p>
            <p><span class="font-semibold">Código Sun Factory:</span>
              {{ contratoAAsociar.codigo_sun_factory || '—' }}</p>
          </template>
          <template v-else>
            <p><span class="font-semibold">Tipo:</span>
              {{ TIPO_CONTRATO_LABELS[contratoAAsociar.servicio_aplica] || contratoAAsociar.servicio_aplica }}</p>
            <p><span class="font-semibold">Prestador:</span>
              {{ contratoAAsociar.prestador_nombre || '—' }}</p>
            <p><span class="font-semibold">N° de contrato:</span>
              {{ contratoAAsociar.numero_contrato || '—' }}</p>
          </template>
          <p><span class="font-semibold">Proyecto según el contrato:</span>
            {{ contratoAAsociar.nombre_proyecto_ref || '—' }}</p>
        </div>
        <div>
          <label class="text-xs font-semibold text-muted-foreground">Planta</label>
          <Select v-model="proyectoElegido" :options="proyectos" optionLabel="nombre_comercial"
                  optionValue="id" filter :loading="loadingProyectos" size="small" class="w-full mt-1"
                  placeholder="Buscar planta…" filterPlaceholder="Escribe para filtrar…" />
          <p v-if="proyectoSugerido" class="text-xs mt-1 text-muted-foreground">
            Sugerido a partir del {{ proyectoSugerido }}. Verifica antes de guardar.
          </p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" text severity="secondary" size="small"
                @click="dialogAsociarProyecto = false" />
        <Button label="Asociar" size="small" :disabled="!proyectoElegido" :loading="guardandoProyecto"
                @click="guardarProyectoContrato" />
      </template>
    </Dialog>

    <!-- Un solo diálogo para los dos avisos de nombre parecido: el de proyectos
         y el de clientes. El de clientes no existía --el 409 salía como un toast
         de error sin salida-- y quien lo veía cerraba y escribía el nombre a
         mano, que es justo lo que duplica los clientes. -->
    <Dialog v-model:visible="duplicadoVisible"
      :header="duplicadoTipo === 'cliente' ? 'Cliente parecido ya existe' : 'Proyecto parecido ya existe'"
      modal class="w-full max-w-sm">
      <p class="text-sm text-muted-foreground">{{ duplicadoInfo?.mensaje }}</p>
      <p v-if="duplicadoInfo?.candidato_nombre" class="text-sm mt-2 font-medium text-unergy-deep">
        {{ duplicadoInfo.candidato_nombre }}
      </p>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="duplicadoVisible = false" />
        <Button label="Crear igual" :loading="forzando" @click="crearForzado" />
      </template>
    </Dialog>

    <PPAContratoWizard v-if="showWizardPPA" :visible="showWizardPPA" :initialData="ppaADuplicar"
                       @cerrar="cerrarWizardPPA" @creado="cargarPpa" @editado="cargarPpa" />

    <!-- `servicio` es la llave de la pestaña; el wizard guarda servicio_aplica
         tal cual, asi que tiene que recibir un tipo real del enum o crea filas
         que ninguna vista lee. -->
    <ContratoServicioWizard v-if="showWizardServicio" :visible="showWizardServicio"
                            :tipo="tipoAcrear"
                            @cerrar="showWizardServicio = false"
                            @creado="cargarContratosServicio(servicio)" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Menu from 'primevue/menu'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { FilterMatchMode } from '@primevue/core/api'
import ProyectosPendientesPanel from '~/features/proyectos/components/ProyectosPendientesPanel.vue'
import { ClientesService } from '~/features/clientes/services/clientes'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import { PpaService } from '~/features/contratos/services/ppa'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ServiciosService } from '~/features/contratos/services/servicios'
import { formatearNombre } from '~/utils/nombreFormato'
import { mensajeDeError } from '~/utils/mensajeDeError'
import { exportarExcel } from '~/utils/exportarExcel'
import { estadoVigenciaPPA } from '~/features/contratos/utils/ppaVigencia'
import { sugerirProyecto as calcularSugerencia } from '~/features/contratos/sugerirProyecto'
import {
  ConProyecto,
  FILTROS_PPA_VACIOS,
  FILTROS_SERVICIO_VACIOS,
  contarActivos,
  depurarFiltros,
  filtrarPpa,
  filtrarServicios,
  opcionesDe,
  tiposDePlantaPresentes,
} from '~/features/contratos/filtrosServicios'
import { SEMAFORO, servicioLabel, fmt } from '~/features/clientes/components/clientesUi'
import { AlignJustifyIcon, BadgeCheckIcon, BuildingIcon, ChartColumnIcon, CheckIcon, ChevronDownIcon, CopyIcon, FilePenIcon, FileSpreadsheetIcon, LinkIcon, ListIcon, MoveVerticalIcon, PaperclipIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const clientesService = new ClientesService()
const proyectosService = new ProyectosService()
const portafoliosService = new PortafoliosService()
const ppaService = new PpaService()
const contratosServicioService = new ContratosServicioService()
const serviciosService = new ServiciosService()

// Los formularios y wizards pesan; sólo se descargan cuando alguien crea algo.
const ClienteForm = defineAsyncComponent(() => import('~/features/clientes/components/ClienteForm.vue'))
const ProyectoForm = defineAsyncComponent(() => import('~/features/proyectos/components/ProyectoForm.vue'))
const PPAContratoWizard = defineAsyncComponent(() => import('~/features/contratos/components/PPAContratoWizard.vue'))
const ContratoServicioWizard = defineAsyncComponent(() => import('~/features/contratos/components/ContratoServicioWizard.vue'))

const router = useRouter()
const route = useRoute()
const confirm = useConfirm()

// ── Catálogos ────────────────────────────────────────────────────────────────
const VISTAS = [
  // Proyectos va primero y es el que abre: la planta es la base, y clientes y
  // contratos son formas de mirar ese mismo portafolio.
  { key: 'proyectos', label: 'Proyectos', icon: ZapIcon,      color: 'var(--success)' },
  { key: 'clientes',  label: 'Clientes',  icon: BuildingIcon,  color: 'var(--color-unergy-purple)' },
  { key: 'servicios', label: 'Servicios', icon: FilePenIcon, color: 'var(--primary)' },
]

const SERVICIOS = [
  { key: 'ppa',            label: 'PPA',            icon: ZapIcon,      color: 'var(--warning)' },
  // La clave sigue siendo `representacion` porque viaja en la URL (`?srv=`);
  // la etiqueta sí nombra los dos subservicios que la pestaña muestra.
  { key: 'representacion', label: 'Representación y CGM', icon: FilePenIcon, color: 'var(--chart-3)' },
  { key: 'operacion',      label: 'Operación',      icon: ChartColumnIcon, color: 'var(--success)' },
]

// El enum `servicio_aplica` del backend NO tiene un valor "operacion": lo que
// se firma por planta son tres contratos distintos -- mantenimiento, arriendo e
// internet -- que es como los pide OperacionView.vue. Pedir ?tipo=operacion
// devolvia siempre 0 filas y dejaba 65 contratos reales sin ninguna pestana, asi
// que Operacion junta los tres y los distingue con la columna Tipo.
const TIPOS_POR_SERVICIO = {
  representacion: ['representacion'],
  operacion: ['mantenimiento', 'arriendo', 'internet'],
}

// La pestana y el grupo del backend NO se llaman igual: `srv=representacion`
// viaja en la URL desde siempre y renombrarla romperia los links compartidos,
// mientras que el backend nombra al grupo `representacion_cgm` -- a secas seria
// ambiguo, porque nombraria al grupo Y a uno de sus subservicios.
const GRUPO_POR_PESTANA = {
  ppa: 'ppa',
  representacion: 'representacion_cgm',
  operacion: 'operacion',
}

const TIPO_CONTRATO_LABELS = {
  mantenimiento: 'Mantenimiento', arriendo: 'Arriendo', internet: 'Internet',
  representacion: 'Representación', cgm: 'CGM',
}
const TIPO_CONTRATO_COLOR = {
  mantenimiento: 'var(--warning)', arriendo: 'var(--color-unergy-purple)', internet: 'var(--chart-2)',
  representacion: 'var(--chart-3)', cgm: 'var(--chart-1)',
}

// Tinte translúcido de un color del tema (fondos de píldoras y chips activos).
const tinte = (c, pct) => `color-mix(in oklab, ${c} ${pct}%, transparent)`

const colorTipoContrato = (sub) => TIPO_CONTRATO_COLOR[sub] || 'var(--muted-foreground)'

const SERVICIOS_BADGES = [
  { key: 'srv_operacion',      badge: 'OP',   tooltip: 'Operación' },
  { key: 'srv_representacion', badge: 'REP',  tooltip: 'Reporte de energía producida' },
  { key: 'srv_cgm',            badge: 'CGM',  tooltip: 'Control y gestión de medición' },
  { key: 'srv_ppa',            badge: 'PPA',  tooltip: 'PPA' },
]

const TIPO_LABELS = {
  minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD',
  movilidad_electrica: 'Movilidad', otro: 'Otro',
}
const TIPO_BADGE_CLASS = {
  minigranja: 'bg-success/10 text-success', autoconsumo: 'bg-chart-2/10 text-chart-2', gd: 'bg-primary/10 text-primary',
  movilidad_electrica: 'bg-unergy-purple/10 text-unergy-purple-dark', otro: 'bg-muted text-muted-foreground',
}
// `estado` real de Proyecto (apps/proyectos/models.py). "en_construccion" NO es
// un valor de este campo -- es de `fase_construccion`, un campo distinto -- pero
// se conserva en ESTADO_LABELS/ESTADO_CLASS por si algun dato viejo lo tiene, así
// que el filtro (más abajo) usa su propia lista, no `Object.keys(ESTADO_LABELS)`.
const ESTADOS = ['en_operacion', 'en_desarrollo', 'suspendido', 'cancelado']
const ESTADO_LABELS = {
  en_operacion: 'En operación', en_desarrollo: 'En desarrollo', suspendido: 'Suspendido',
  cancelado: 'Cancelado', en_construccion: 'En construcción',
}
const ESTADO_CLASS = {
  en_operacion: 'bg-success/10 text-success', suspendido: 'bg-warning/10 text-warning',
  en_construccion: 'bg-primary/10 text-primary', en_desarrollo: 'bg-muted text-muted-foreground', cancelado: 'bg-muted text-muted-foreground',
}
const CUMPLIMIENTO_LABELS = { on_track: 'Al día', at_risk: 'En riesgo', deficit: 'Déficit' }
const CUMPLIMIENTO_CLASS = { on_track: 'bg-success/10 text-success', at_risk: 'bg-warning/10 text-warning', deficit: 'bg-destructive/10 text-destructive' }
const ESTADO_CONTRATO_LABELS = {
  firmado: 'Firmado', vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación',
}
// Chips propios en vez de <Tag>: los estilos de PrimeVue se inyectan después de
// Tailwind y ganan el empate de especificidad, así que un Tag no se deja
// encoger a la tipografía compacta del resto de la tabla.
const ESTADO_CONTRATO_CLASS = {
  firmado: 'bg-success/10 text-success', vigente: 'bg-success/10 text-success', vencido: 'bg-destructive/10 text-destructive', terminado: 'bg-muted text-muted-foreground', en_renovacion: 'bg-warning/10 text-warning',
}

// ── Estado de la vista (se sincroniza con la URL para poder compartirla) ─────
const VISTAS_VALIDAS = VISTAS.map(v => v.key)
const SERVICIOS_VALIDOS = SERVICIOS.map(s => s.key)

// La base son los proyectos: la vista abre directo en su tabla. Igual solo se
// pide lo del angulo activo, nunca los tres a la vez.
const vista = ref(VISTAS_VALIDAS.includes(route.query.vista) ? route.query.vista : 'proyectos')
const servicio = ref(SERVICIOS_VALIDOS.includes(route.query.srv) ? route.query.srv : 'ppa')
const q = ref(route.query.q || '')
const compacta = ref(localStorage.getItem('servicios_unificado_compacta') !== '0')

watch(compacta, v => localStorage.setItem('servicios_unificado_compacta', v ? '1' : '0'))

// ── Filtros de Servicios (PPA / Representación / Operación) ─────────────────
// Los predicados viven en `~/features/contratos/filtrosServicios` (con pruebas);
// acá solo está el estado y su ida y vuelta con la URL.
//
// Van en la URL por lo mismo que `vista`, `srv` y `q`, que es lo que dice el
// comentario de la sincronización de abajo: poder compartir la vista tal cual se
// está viendo. Se prefijan para que los dos grupos no se pisen entre pestañas.
const PREFIJO_PPA = 'fp_'
const PREFIJO_SRV = 'fs_'

function leerFiltros(vacios, prefijo) {
  const f = { ...vacios }
  for (const clave of Object.keys(vacios)) {
    const valor = route.query[prefijo + clave]
    if (typeof valor === 'string' && valor !== '') f[clave] = valor
  }
  return f
}

function volcarFiltros(query, filtros, prefijo) {
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== null && valor !== undefined && valor !== '') query[prefijo + clave] = valor
  }
}

const filtrosPpa = ref(leerFiltros(FILTROS_PPA_VACIOS, PREFIJO_PPA))
const filtrosServicio = ref(leerFiltros(FILTROS_SERVICIO_VACIOS, PREFIJO_SRV))

// Los filtros se sincronizan con la URL para poder compartir la vista tal cual
// se esta viendo.
watch([vista, servicio, q, filtrosPpa, filtrosServicio], () => {
  const query = {}
  if (vista.value) query.vista = vista.value
  if (vista.value === 'servicios') {
    query.srv = servicio.value
    if (servicio.value === 'ppa') volcarFiltros(query, filtrosPpa.value, PREFIJO_PPA)
    else volcarFiltros(query, filtrosServicio.value, PREFIJO_SRV)
  }
  if (q.value) query.q = q.value
  router.replace({ query })
}, { deep: true })

const filasPorPagina = computed(() => (compacta.value ? 100 : 50))
// Los filtros de Proyectos ocupan una fila extra, así que la tabla dispone de
// algo menos de alto que en los demás ángulos.
// Ningún ángulo lleva fila de filtros, así que todos disponen del mismo alto.
const scrollHeight = 'calc(100vh - 250px)'

// Cuantas filas pide esta vista de una sola vez. El servidor entrega 100 por
// respuesta y `completarPaginas` (`~/core/paginacion.ts`) junta las que falten,
// asi que pedir 500 trae hasta 500 filas completas. Mientras no haya
// paginacion de servidor en esta tabla, avisamos si el total las pasa.
const TOPE_PAGINA = 500

function avisarSiTrunca(total, mostrados, etiqueta) {
  if (total == null || total <= mostrados) return
  toast.warning('Listado incompleto', {
    description: `Se muestran ${mostrados} de ${total} ${etiqueta}: la vista pide como máximo ${TOPE_PAGINA}.`,
    duration: 8000,
  })
}

// ── Completitud del registro ───────────────────────────────────
// Se cuentan TODOS los campos del registro, no una lista curada. Lo unico que
// se saca son los que no son "campos por llenar":
//   - tecnicos (id, created_at, updated_at)
//   - derivados por el backend (num_plantas, dias_restantes, cobertura...)
//   - relaciones a otras entidades (proyectos, inversionistas, contactos...)
// Un booleano en false y un numero en 0 SI cuentan como llenos: son un dato.
// Los objetos anidados (info_tecnica, servicio_representacion) se aplanan un
// nivel, asi que sus campos tambien entran en la cuenta.
const TECNICOS = ['id', 'created_at', 'updated_at', 'deleted_at', '__grupo']

const DERIVADOS = {
  // proximo_vencimiento y alerta_contrato los calcula la proyeccion a partir
  // de los contratos: no son datos que alguien llene en la ficha.
  clientes: ['num_plantas', 'servicios', 'alerta_contrato', 'contactos_comerciales_extra',
             'proximo_vencimiento'],
  proyectos: ['ppa_contratos', 'inversionistas', 'servicios', 'info_tecnica'],
  ppa: ['proyectos', 'dias_restantes', 'estado_cumplimiento', 'cobertura_actual_pct',
        'fecha_fin_efectiva', 'comprador', 'vendedor'],
  // `proyecto` es el objeto que el backend arma a partir de proyecto_id: el
  // campo por llenar es el id, y contarlos los dos inflaría el pendiente.
  // facturas_solenium/facturas_inversionistas salieron de la lista: el backend
  // dejo de exponerlas cuando esos JSONB se reemplazaron por la tabla
  // contrato_factura (2026-08-30), asi que ya no hay nada que excluir.
  contrato: ['contratante', 'prestador', 'proyecto',
             'indexacion_anual', 'indexacion_mensual',
             'nombre_proyecto_ref'],
}

// Objetos que se aplanan un nivel para que sus campos cuenten uno por uno.
const ANIDADOS = ['info_tecnica', 'servicio_representacion']

// Campos de enlace a documento por entidad. El backend no tiene una lista de
// documentos esperados por entidad, asi que hoy esto solo puede valer 0 o 1
// (2 en cliente). Para un checklist real ("faltan 3 de 7") hace falta backend.
const DOCS = {
  clientes: [['rut_url', 'RUT'], ['documentos_comerciales', 'Documentos comerciales']],
  proyectos: [['carpeta_drive_codigo', 'Carpeta Drive']],
  ppa: [['carpeta_link', 'Carpeta del contrato']],
  contrato: [['enlace_drive', 'Enlace Drive']],
}

// La misma clave que usa el Excel: cada angulo cuenta contra su propia entidad.
const claveRequeridos = computed(() => (
  vista.value === 'clientes' ? 'clientes'
  : vista.value === 'proyectos' ? 'proyectos'
  : servicio.value === 'ppa' ? 'ppa'
  : 'contrato'
))

function estaVacio(v) {
  if (v == null || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  return false
}

// "nombre_interno" -> "Nombre interno"
function etiquetar(clave) {
  const t = clave.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Pares [clave, valor] del registro que cuentan como campo por llenar.
function camposDe(fila) {
  const fuera = new Set([...TECNICOS, ...(DERIVADOS[claveRequeridos.value] || []),
                         ...(DOCS[claveRequeridos.value] || []).map(([k]) => k)])
  const pares = []
  for (const [k, v] of Object.entries(fila || {})) {
    if (fuera.has(k)) continue
    if (ANIDADOS.includes(k)) continue          // se aplanan aparte, abajo
    if (v && typeof v === 'object' && !Array.isArray(v)) continue   // otro objeto: no es un campo
    pares.push([etiquetar(k), v])
  }
  for (const anidado of ANIDADOS) {
    const obj = fila?.[anidado]
    if (!obj || typeof obj !== 'object') continue
    for (const [k, v] of Object.entries(obj)) {
      if (TECNICOS.includes(k) || k.endsWith('_id')) continue
      if (v && typeof v === 'object') continue
      pares.push([etiquetar(k), v])
    }
  }
  return pares
}

function faltanCampos(fila) {
  return camposDe(fila).filter(([, v]) => estaVacio(v)).map(([et]) => et)
}

function totalCampos(fila) {
  return camposDe(fila).length
}

// `rut_url` era la columna vieja (eliminada, migracion 122): el RUT ahora
// vive como un documento tipo='rut' dentro de documentos_comerciales.
function valorDoc(fila, clave) {
  if (clave === 'rut_url') {
    return (fila?.documentos_comerciales || []).filter(d => d.tipo === 'rut')
  }
  return fila?.[clave]
}

function faltanDocs(fila) {
  const lista = DOCS[claveRequeridos.value] || []
  return lista.filter(([k]) => estaVacio(valorDoc(fila, k))).map(([, et]) => et)
}

function tipFalta(fila, tipo) {
  const esCampos = tipo === 'campos'
  const nombre = esCampos ? 'campos' : 'documentos'
  const lista = esCampos ? faltanCampos(fila) : faltanDocs(fila)
  const total = esCampos ? totalCampos(fila) : (DOCS[claveRequeridos.value] || []).length
  if (!lista.length) return `Sin ${nombre} pendientes (${total}/${total})`
  // Con "todos los campos" la lista puede ser larga: se muestran los primeros.
  const muestra = lista.slice(0, 12).join(', ')
  const resto = lista.length > 12 ? ` y ${lista.length - 12} más` : ''
  return `Falta${lista.length === 1 ? '' : 'n'} ${lista.length} de ${total} ${nombre}: ${muestra}${resto}`
}

// ── Formateo ─────────────────────────────────────────────────────────────────
function fmtFecha(v) { return v ? String(v).slice(0, 10) : '—' }
function num(v) { return v == null || v === '' ? '—' : Number(v).toLocaleString('es-CO') }
function ir(path) { router.push(path) }

// La ficha de la planta que corresponde al contrato: Representación y Operación
// son pestañas distintas dentro del proyecto, y mandar a la equivocada hace
// parecer que la planta no tiene el contrato que se acaba de ver en la tabla.
function rutaDeLaPlanta(contrato) {
  const seccion = contrato.servicio_aplica === 'representacion' ? 'representacion' : 'operacion'
  return `/proyectos/${contrato.proyecto.id}/${seccion}`
}

// ── Clientes ─────────────────────────────────────────────────────────────────
const clientes = ref([])
const loadingClientes = ref(false)
const clientesCargados = ref(false)

const clientesFiltrados = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (!t) return clientes.value
  return clientes.value.filter(c =>
    (c.razon_social_nombre || '').toLowerCase().includes(t) ||
    (c.nit_cedula || '').toLowerCase().includes(t) ||
    (c.contacto_comercial_nombre || '').toLowerCase().includes(t) ||
    (c.contacto_comercial_correo || '').toLowerCase().includes(t))
})

function rowClassCliente(data) {
  if (data.alerta_contrato === 'vencido') return 'row-vencido'
  if (data.alerta_contrato === 'por_vencer') return 'row-por-vencer'
  return ''
}

async function cargarClientes() {
  loadingClientes.value = true
  try {
    // Dos fuentes, fusionadas por id:
    //  - /clientes/vista-comercial trae lo derivado (num_plantas, servicios,
    //    contacto comercial, alerta de contrato) pero NO las columnas crudas.
    //  - /clientes trae la ficha (direccion, ciudad, iva_pct...), que es
    //    lo que necesita el contador de campos faltantes.
    // Sin la segunda, el indicador solo podria mirar 8 campos y mentiria.
    const [vista, ficha] = await Promise.all([
      clientesService.listarVistaComercial(),
      // size tope 500 en el backend: pedir mas devuelve 422, no una lista corta.
      clientesService.listarPaginado({ page: 1, size: TOPE_PAGINA }),
    ])
    const porId = new Map((ficha.items ?? []).map(c => [c.id, c]))
    clientes.value = vista.map(c => ({ ...(porId.get(c.id) || {}), ...c }))
    avisarSiTrunca(ficha.total, porId.size, 'clientes')
    clientesCargados.value = true
  } catch (e) {
    toast.error('Error al cargar clientes', { description: e.message, duration: 4000 })
  } finally {
    loadingClientes.value = false
  }
}

// ── Proyectos ────────────────────────────────────────────────────────────────
const proyectos = ref([])
const loadingProyectos = ref(false)
const proyectosCargados = ref(false)

function ppaLabel(c) { return c?.nombre_interno || c?.numero_codigo_contrato || `PPA ${c?.id}` }

function ppaTooltip(c) {
  const partes = []
  if (c?.nombre_interno && c?.numero_codigo_contrato) partes.push(c.numero_codigo_contrato)
  if (c?.comprador_nombre) partes.push(`Comprador: ${c.comprador_nombre}`)
  const desde = c?.fecha_inicio ? fmtFecha(c.fecha_inicio) : null
  const hasta = c?.fecha_fin ? fmtFecha(c.fecha_fin) : null
  if (desde || hasta) partes.push(`${desde || '—'} → ${hasta || '—'}`)
  return partes.length ? `${ppaLabel(c)} · ${partes.join(' · ')}` : ppaLabel(c)
}

// ppa_contratos es una relación viewonly: puede traer contratos ya borrados.
function ppaVigentes(p) {
  return (p.ppa_contratos || []).filter(c => !c.deleted_at && !c.eliminado)
}

// ── Filtros de Proyectos (Estado/Tipo/Portafolio/PPA) ───────────────────────
// Fila de filtros fija, visible siempre (decisión del usuario, 2026-09-08).
//
// El filtrado real vive en `proyectosFiltrados` (JS plano): así el contador
// del subtítulo ("X de Y plantas") y el Excel -- que leen `filasVisibles`, no
// la tabla -- quedan siempre consistentes con lo que se ve.
const portafolios = ref([])

// Valor centinela "sin ningun PPA vigente" -- ningun contrato real tiene id
// negativo, asi que convive con los ids reales en la misma lista de opciones.
const PPA_SIN = -1

const filtrosProyectos = ref({
  estado: { value: null, matchMode: FilterMatchMode.EQUALS },
  tipo_proyecto: { value: null, matchMode: FilterMatchMode.EQUALS },
  portafolio_id: { value: null, matchMode: FilterMatchMode.EQUALS },
  ppa_contratos: { value: null, matchMode: 'ppaSeleccionado' },
})

const nFiltrosProyectosActivos = computed(() => {
  const f = filtrosProyectos.value
  let n = 0
  if (f.estado.value) n++
  if (f.tipo_proyecto.value) n++
  if (f.portafolio_id.value) n++
  if (f.ppa_contratos.value?.length) n++
  return n
})

function limpiarFiltrosProyectos() {
  filtrosProyectos.value.estado.value = null
  filtrosProyectos.value.tipo_proyecto.value = null
  filtrosProyectos.value.portafolio_id.value = null
  filtrosProyectos.value.ppa_contratos.value = null
}

const estadoOpcionesProyectos = computed(() =>
  ESTADOS.map(value => ({ value, label: ESTADO_LABELS[value] })))
const tipoOpcionesProyectos = computed(() =>
  Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label })))

// Contratos presentes en los proyectos cargados, deduplicados por id.
const ppaOpcionesProyectos = computed(() => {
  const porId = new Map()
  let sinPpa = 0
  for (const p of proyectos.value) {
    const vivos = ppaVigentes(p)
    if (!vivos.length) { sinPpa++; continue }
    for (const c of vivos) if (!porId.has(c.id)) porId.set(c.id, c)
  }
  const opciones = [...porId.values()]
    .map(c => ({ value: c.id, label: ppaLabel(c) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  if (sinPpa) opciones.unshift({ value: PPA_SIN, label: `Sin PPA (${sinPpa})` })
  return opciones
})

function nombrePortafolio(id) {
  return portafolios.value.find(pf => pf.id === id)?.nombre ?? null
}

const proyectosFiltrados = computed(() => {
  const f = filtrosProyectos.value
  let lista = proyectos.value
  if (f.estado.value)         lista = lista.filter(p => p.estado === f.estado.value)
  if (f.tipo_proyecto.value)  lista = lista.filter(p => p.tipo_proyecto === f.tipo_proyecto.value)
  if (f.portafolio_id.value)  lista = lista.filter(p => p.portafolio_id === f.portafolio_id.value)
  if (f.ppa_contratos.value?.length) {
    const sel = new Set(f.ppa_contratos.value)
    lista = lista.filter(p => {
      const vivos = ppaVigentes(p)
      if (!vivos.length) return sel.has(PPA_SIN)
      return vivos.some(c => sel.has(c.id))
    })
  }

  const t = q.value.trim().toLowerCase()
  if (!t) return lista
  return lista.filter(p =>
    (p.nombre_comercial || '').toLowerCase().includes(t) ||
    (p.codigo_tsf || '').toLowerCase().includes(t) ||
    (p.municipio || '').toLowerCase().includes(t) ||
    (p.departamento || '').toLowerCase().includes(t) ||
    // El PPA es una columna visible y el inversionista es una agrupacion: si
    // se muestran, tienen que poder buscarse.
    ppaVigentes(p).some(c => ppaLabel(c).toLowerCase().includes(t)) ||
    (p.inversionistas || []).some(i => (i.cliente_nombre || '').toLowerCase().includes(t)))
})

async function cargarProyectos() {
  loadingProyectos.value = true
  try {
    // allSettled, no all: portafolios solo alimenta el filtro de esa columna.
    // Si esa llamada falla (permisos, error transitorio) no debe tumbar la
    // carga de proyectos, de la que dependen otros flujos -- ej. el selector
    // de "Asociar a un proyecto" en Servicios > Representación, que quedaba
    // sin ninguna planta para elegir cuando portafolios fallaba.
    const [proyectosResult, portafoliosResult] = await Promise.allSettled([
      proyectosService.listarPaginado({ page: 1, size: TOPE_PAGINA }),
      portafoliosService.listar(),
    ])
    if (proyectosResult.status === 'fulfilled') {
      const data = proyectosResult.value
      proyectos.value = data.items ?? []
      avisarSiTrunca(data.total, proyectos.value.length, 'plantas')
      proyectosCargados.value = true
    } else {
      toast.error('Error al cargar proyectos', { description: proyectosResult.reason?.message, duration: 4000 })
    }
    if (portafoliosResult.status === 'fulfilled') {
      portafolios.value = portafoliosResult.value.portafolios ?? []
    } else {
      toast.error('Error al cargar portafolios', { description: portafoliosResult.reason?.message, duration: 4000 })
    }
  } finally {
    loadingProyectos.value = false
  }
}

// ── Servicios · PPA ──────────────────────────────────────────────────────────
const ppa = ref([])
const loadingPpa = ref(false)
const ppaCargados = ref(false)

// Las mismas claves y etiquetas que produce `estadoVigenciaPPA`, para que el
// filtro diga lo mismo que la columna Estado.
const VIGENCIA_OPCIONES = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'por_iniciar', label: 'Por iniciar' },
  { value: 'sin_fechas', label: 'Sin fechas' },
]

// Opciones derivadas de lo ya cargado: no hace falta pedirle nada más a la API.
const opcionesPpaTipo = computed(() => opcionesDe(ppa.value, 'tipo_contrato'))
const opcionesPpaComprador = computed(() => opcionesDe(ppa.value, 'comprador_nombre'))
const opcionesPpaVendedor = computed(() => opcionesDe(ppa.value, 'vendedor_nombre'))

const nFiltrosPpaActivos = computed(() => contarActivos(filtrosPpa.value))

function limpiarFiltrosPpa() {
  filtrosPpa.value = { ...FILTROS_PPA_VACIOS }
}

const ppaFiltrados = computed(() => {
  const t = q.value.trim().toLowerCase()
  const base = !t ? ppa.value : ppa.value.filter(c =>
    (c.nombre_interno || '').toLowerCase().includes(t) ||
    (c.numero_codigo_contrato || '').toLowerCase().includes(t) ||
    (c.comprador_nombre || '').toLowerCase().includes(t) ||
    (c.vendedor_nombre || '').toLowerCase().includes(t) ||
    (c.proyectos || []).some(p => (p.nombre_comercial || '').toLowerCase().includes(t)))
  // `_vigencia` se precalcula acá y no en la celda para que la columna Estado
  // sea ordenable (PrimeVue ordena por campo, no por lo que pinta el template).
  // Los filtros se aplican DESPUÉS del map porque el de estado lee `_vigencia`.
  return filtrarPpa(base.map(c => ({ ...c, _vigencia: estadoVigenciaPPA(c) })), filtrosPpa.value)
})

async function cargarPpa() {
  loadingPpa.value = true
  try {
    ppa.value = await ppaService.listar()
    ppaCargados.value = true
    filtrosPpa.value = depurarFiltros(filtrosPpa.value, {
      tipo: opcionesPpaTipo.value.map(o => o.value),
      comprador: opcionesPpaComprador.value.map(o => o.value),
      vendedor: opcionesPpaVendedor.value.map(o => o.value),
    })
  } catch (e) {
    toast.error('Error al cargar contratos PPA', { description: e.message, duration: 4000 })
  } finally {
    loadingPpa.value = false
  }
}

// ── Servicios · Operación / REC ──────────────────────────────────────────────
const contratosServicio = ref([])
const loadingServicio = ref(false)
const servicioCargado = ref(null)   // el tipo que hay en memoria

// Catálogo de grupos y subservicios, del backend. Se pide una vez al abrir la
// vista; mientras no llegue, `tiposDelServicio` cae a la lista local. Un fallo
// acá NO puede romper la pantalla: lo peor que pasa es que Representación y CGM
// no ofrezca el filtro por subservicio, que es como se veía antes.
const catalogoServicios = ref(null)

async function cargarCatalogoServicios() {
  try {
    catalogoServicios.value = await serviciosService.catalogo()
  }
  catch {
    catalogoServicios.value = null
  }
}

// Representación es el único servicio con columnas propias (proyecto e
// inversionista en lugar de contratante y prestador), así que la bandera se
// nombra una vez y la usan el template y los filtros.
const esRepresentacion = computed(() => servicio.value === 'representacion')

// Contratos de representación sin planta asociada: son datos por corregir, no
// una categoría del negocio. Aislarlos es hoy el filtro "Proyecto" — ver
// `soloHuerfanos` más abajo, que deriva de él para que la barra de aviso y el
// desplegable no puedan decir cosas distintas.

// ── Duplicados de representación ─────────────────────────────────────────────
// Quién es duplicado y si se puede fusionar sin perder datos lo decide el
// backend (services/representacion_dedup.py). Acá solo se cuenta y se dispara.
const duplicados = ref({ grupos_fusionables: [], grupos_con_conflicto: [] })
const soloDuplicados = ref(false)
const fusionando = ref(false)

const nDuplicados = computed(() =>
  (duplicados.value.grupos_fusionables || []).reduce((n, g) => n + g.ids.length, 0))
const nEnConflicto = computed(() => (duplicados.value.grupos_con_conflicto || []).length)

// Todos los ids involucrados, para poder aislarlos en la tabla.
const idsDuplicados = computed(() => new Set([
  ...(duplicados.value.grupos_fusionables || []).flatMap(g => g.ids),
  ...(duplicados.value.grupos_con_conflicto || []).flatMap(g => g.ids),
]))

async function cargarDuplicados() {
  if (!esRepresentacion.value) return
  try {
    duplicados.value = await contratosServicioService.buscarDuplicadosRepresentacion()
  } catch { /* el aviso es un extra: la tabla funciona sin él */ }
}

function confirmarFusion() {
  const n = nDuplicados.value
  const grupos = duplicados.value.grupos_fusionables.length
  confirm({
    title: 'Fusionar contratos duplicados',
    description: `Se conservará un contrato por planta (${grupos}) con la unión de todos `
           + `los datos y se eliminarán ${n - grupos} registros sobrantes. Ningún `
           + `valor se sobreescribe, y los grupos que se contradicen no se tocan.`,
    confirmLabel: 'Fusionar',
    cancelLabel: 'Cancelar',
    onConfirm: fusionarDuplicados,
  })
}

async function fusionarDuplicados() {
  fusionando.value = true
  try {
    const data = await contratosServicioService.fusionarRepresentacion()
    toast.success('Duplicados fusionados', {
      description: `${data.grupos_fusionados} contrato(s) consolidado(s), `
                      + `${data.contratos_eliminados} registro(s) eliminado(s)`,
      duration: 5000,
    })
    soloDuplicados.value = false
    await cargarContratosServicio(servicio.value)
    await cargarDuplicados()
  } catch (e) {
    toast.error('No se pudo fusionar', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    fusionando.value = false
  }
}
const nHuerfanos = computed(() =>
  contratosServicio.value.filter(c => !c.proyecto_id).length)

// Los estados que una persona elige. 'Vigente' y 'Vencido' ya no son opciones:
// los calcula el backend desde la fecha fin. Las etiquetas de arriba sí los
// conservan, para las filas que todavía los traigan.
const ESTADO_CONTRATO_OPCIONES = [
  { value: 'firmado', label: 'Firmado' },
  { value: 'en_renovacion', label: 'En renovación' },
  { value: 'terminado', label: 'Terminado' },
]

// Tipo solo aplica a Operación, que junta mantenimiento, arriendo e internet;
// Representación tiene un único tipo y el desplegable no aportaría nada.
const opcionesServicioTipo = computed(() =>
  tiposDelServicio.value.map(t => ({ value: t, label: TIPO_CONTRATO_LABELS[t] || t })))
const opcionesInversionista = computed(() => opcionesDe(contratosServicio.value, 'inversionista_nombre'))
const opcionesPortafolio = computed(() => opcionesDe(contratosServicio.value, 'portafolio'))

// Los tipos se muestran con la misma etiqueta y el mismo color que el chip de la
// columna, para que el filtro y la tabla hablen igual.
const opcionesTipoPlanta = computed(() =>
  tiposDePlantaPresentes(contratosServicio.value)
    .map(tipo => ({ value: tipo, label: TIPO_LABELS[tipo] || tipo })))

const nFiltrosServicioActivos = computed(() => contarActivos(filtrosServicio.value))

function limpiarFiltrosServicio() {
  filtrosServicio.value = { ...FILTROS_SERVICIO_VACIOS }
}

// El aviso de huérfanos y el filtro "Proyecto" son la MISMA decisión: el botón
// de la barra solo pone o quita el filtro, para que no puedan contradecirse.
const soloHuerfanos = computed(() => filtrosServicio.value.proyecto === ConProyecto.SIN)

function alternarHuerfanos() {
  filtrosServicio.value.proyecto = soloHuerfanos.value ? null : ConProyecto.SIN
}

const contratosServicioFiltrados = computed(() => {
  let base = filtrarServicios(contratosServicio.value, filtrosServicio.value)
  if (esRepresentacion.value && soloDuplicados.value) {
    base = base.filter(c => idsDuplicados.value.has(c.id))
  }
  const t = q.value.trim().toLowerCase()
  if (!t) return base
  return base.filter(c =>
    (c.numero_contrato || '').toLowerCase().includes(t) ||
    (c.contratante_nombre || '').toLowerCase().includes(t) ||
    (c.prestador_nombre || '').toLowerCase().includes(t) ||
    (c.inversionista_nombre || '').toLowerCase().includes(t) ||
    (c.proyecto?.nombre_comercial || '').toLowerCase().includes(t) ||
    // `nombre_proyecto_ref` es el nombre de planta que trae el contrato; buscar
    // por él es lo que permite encontrar los huérfanos por su planta.
    (c.nombre_proyecto_ref || '').toLowerCase().includes(t))
})

async function cargarContratosServicio(servicioKey) {
  // El endpoint filtra por un solo `tipo`, asi que un servicio que agrupa
  // varios necesita una llamada por tipo.
  const tipos = TIPOS_POR_SERVICIO[servicioKey] || [servicioKey]
  loadingServicio.value = true
  try {
    const respuestas = await Promise.all(tipos.map(
      t => contratosServicioService.listar({ tipo: t, limit: 500 })))
    contratosServicio.value = respuestas.flat()
    servicioCargado.value = servicioKey
    // Un link viejo puede nombrar un inversionista o un prestador que ya no
    // esta: aplicarlo dejaria la tabla vacia con un filtro que nadie entiende.
    filtrosServicio.value = depurarFiltros(filtrosServicio.value, {
      tipo: tiposDelServicio.value,
      inversionista: opcionesInversionista.value.map(o => o.value),
      portafolio: opcionesPortafolio.value.map(o => o.value),
      tipoPlanta: opcionesTipoPlanta.value.map(o => o.value),
    })
    soloDuplicados.value = false
    if (servicioKey === 'representacion') cargarDuplicados()
  } catch (e) {
    toast.error('Error al cargar contratos', { description: e.message, duration: 4000 })
  } finally {
    loadingServicio.value = false
  }
}

// ── Asociar un contrato de representación a su planta ─────────────────────────
const dialogAsociarProyecto = ref(false)
const contratoAAsociar = ref(null)
const proyectoElegido = ref(null)
const proyectoSugerido = ref('')
const guardandoProyecto = ref(false)

async function abrirAsociarProyecto(contrato) {
  contratoAAsociar.value = contrato
  proyectoElegido.value = contrato.proyecto_id || null
  proyectoSugerido.value = ''
  dialogAsociarProyecto.value = true
  // El selector necesita el catálogo de plantas, que hasta ahora sólo se pedía
  // al entrar al ángulo Proyectos.
  if (!proyectosCargados.value) await cargarProyectos()
  if (!proyectoElegido.value) sugerirProyecto(contrato)
}

// Mismo criterio que el seed del backend (`_buscar` en main.py): primero código
// Sun Factory, después el número de cuatro dígitos del nombre de referencia. Es
// una sugerencia que el operador confirma, nunca una asignación automática:
// donde el seed ya acertó, el contrato no está huérfano.
// El criterio vive en `~/features/contratos/sugerirProyecto` (con pruebas). Ahí
// se agregó el emparejamiento por NOMBRE de planta, que es la única pista de los
// contratos de Operación: muchos traen la planta escrita en `prestador_nombre`.
// Ante dos plantas posibles no propone nada, a propósito.
function sugerirProyecto(contrato) {
  const sugerencia = calcularSugerencia(contrato, proyectos.value)
  if (!sugerencia) return
  proyectoElegido.value = sugerencia.proyectoId
  proyectoSugerido.value = sugerencia.motivo
}

async function guardarProyectoContrato() {
  guardandoProyecto.value = true
  try {
    const data = await contratosServicioService.actualizar(contratoAAsociar.value.id,
                                     { proyecto_id: proyectoElegido.value })
    // Se reemplaza la fila con lo que devolvió el backend (trae ya el objeto
    // `proyecto` anidado) en vez de recargar los 112 contratos.
    const i = contratosServicio.value.findIndex(c => c.id === data.id)
    if (i !== -1) contratosServicio.value[i] = data
    dialogAsociarProyecto.value = false
    toast.success('Contrato asociado', { description: data.proyecto?.nombre_comercial || '', duration: 3000 })
  } catch (e) {
    toast.error('No se pudo asociar', { description: e.message, duration: 4000 })
  } finally {
    guardandoProyecto.value = false
  }
}

// ── Orquestación: cargar sólo lo que se mira, cachear el resto ──────────────
const servicioInfo = computed(() => SERVICIOS.find(s => s.key === servicio.value))

// Subservicios que ofrece la pestana activa, en el filtro Tipo y en la columna
// Tipo. NO es lo mismo que TIPOS_POR_SERVICIO, que es lo que se le PIDE al
// backend: en Representacion y CGM un solo contrato cubre los dos subservicios
// (91 de 94 al 2026-09-17) y `servicio_aplica` solo puede nombrar uno, asi que
// pedir ?tipo=cgm devolveria 0 filas -- el mismo error que ya costo
// ?tipo=operacion. Sale del catalogo del backend para no mantener la lista dos
// veces; si el catalogo no cargo todavia, cae a los tipos que se piden.
const tiposDelServicio = computed(() => {
  const grupo = catalogoServicios.value?.find(g => g.grupo === GRUPO_POR_PESTANA[servicio.value])
  return grupo?.subservicios || TIPOS_POR_SERVICIO[servicio.value] || [servicio.value]
})

/** Los subservicios que cubre una fila; respaldo para las que aun no los traen. */
function subserviciosDeFila(fila) {
  return fila?.subservicios?.length ? fila.subservicios : [fila?.servicio_aplica].filter(Boolean)
}

function asegurarDatos() {
  if (vista.value === 'clientes') { if (!clientesCargados.value) cargarClientes(); return }
  if (vista.value === 'proyectos') { if (!proyectosCargados.value) cargarProyectos(); return }
  if (servicio.value === 'ppa') { if (!ppaCargados.value) cargarPpa(); return }
  if (servicioCargado.value !== servicio.value) cargarContratosServicio(servicio.value)
}

function seleccionarVista(key) {
  vista.value = key
  asegurarDatos()
}

function seleccionarServicio(key) {
  if (key !== servicio.value) {
    // Las tres pestanas no comparten columnas: arrastrar el filtro de una a
    // otra solo produce tablas vacias sin explicacion.
    limpiarFiltrosPpa()
    limpiarFiltrosServicio()
  }
  servicio.value = key
  asegurarDatos()
}

// Solo se pide lo de la vista elegida. Entrar sin ?vista= no dispara ninguna
// peticion: la pagina espera en el selector. Los contadores de cada pestana
// aparecen a medida que se visitan, no de entrada.
onMounted(() => {
  cargarCatalogoServicios()
  asegurarDatos()
})

function conteoVista(key) {
  if (key === 'clientes')  return clientesCargados.value  ? clientesFiltrados.value.length  : null
  if (key === 'proyectos') return proyectosCargados.value ? proyectosFiltrados.value.length : null
  // Antes devolvia siempre ppaFiltrados: el badge decia 33 mirando "0 de 0".
  if (servicio.value === 'ppa') return ppaCargados.value ? ppaFiltrados.value.length : null
  return servicioCargado.value === servicio.value ? contratosServicioFiltrados.value.length : null
}

// ── Subtítulo / búsqueda / Excel según el ángulo activo ─────────────────────
const filasVisibles = computed(() => {
  if (vista.value === 'clientes')  return clientesFiltrados.value
  if (vista.value === 'proyectos') return proyectosFiltrados.value
  if (servicio.value === 'ppa')    return ppaFiltrados.value
  return contratosServicioFiltrados.value
})

const totalCrudo = computed(() => {
  if (vista.value === 'clientes')  return clientes.value.length
  if (vista.value === 'proyectos') return proyectos.value.length
  if (servicio.value === 'ppa')    return ppa.value.length
  return contratosServicio.value.length
})

const subtitulo = computed(() => {
  const etiqueta = vista.value === 'clientes' ? 'clientes'
    : vista.value === 'proyectos' ? 'plantas'
    : `contratos de ${servicioInfo.value?.label}`
  return `${filasVisibles.value.length} de ${totalCrudo.value} ${etiqueta} · vista unificada`
})

const placeholderBusqueda = computed(() => {
  if (vista.value === 'clientes')  return 'Buscar cliente, NIT, contacto…'
  if (vista.value === 'proyectos') return 'Buscar planta, código TSF, ubicación, PPA, inversionista…'
  if (servicio.value === 'ppa')    return 'Buscar contrato, comprador, planta…'
  if (esRepresentacion.value)      return 'Buscar planta, inversionista, número…'
  return 'Buscar número, contratante, prestador…'
})

const COLUMNAS_EXCEL = {
  clientes: () => [
    { header: 'Razón social', value: c => formatearNombre(c.razon_social_nombre) },
    { header: 'NIT', value: c => c.nit_cedula || '' },
    { header: 'Plantas', value: c => c.num_plantas ?? 0 },
    { header: 'Servicios', value: c => (c.servicios || []).map(servicioLabel).join(', ') },
    { header: 'Contacto comercial', value: c => c.contacto_comercial_nombre || '' },
    { header: 'Teléfono', value: c => c.contacto_comercial_telefono || '' },
    { header: 'Correo comercial', value: c => c.contacto_comercial_correo || '' },
    { header: 'Estado contrato', value: c => c.alerta_contrato || 'vigente' },
  ],
  proyectos: () => [
    { header: 'Cód. TSF', value: p => p.codigo_tsf || '' },
    { header: 'Nombre comercial', value: p => formatearNombre(p.nombre_comercial) },
    { header: 'Estado', value: p => ESTADO_LABELS[p.estado] || p.estado || '' },
    { header: 'Tipo', value: p => TIPO_LABELS[p.tipo_proyecto] || p.tipo_proyecto || '' },
    { header: 'Portafolio', value: p => nombrePortafolio(p.portafolio_id) || '' },
    { header: 'Municipio', value: p => p.municipio || '' },
    { header: 'Departamento', value: p => p.departamento || '' },
    { header: 'Inicio comercialización', value: p => p.fecha_inicio_comercializacion ? fmtFecha(p.fecha_inicio_comercializacion) : '' },
    { header: 'Capacidad instalada (kWp)', value: p => p.info_tecnica?.capacidad_instalada_kwp ?? '' },
    { header: 'Potencia AC (kW)', value: p => p.info_tecnica?.potencia_ac_kw ?? '' },
    { header: 'Servicios', value: p => SERVICIOS_BADGES.filter(s => p[s.key]).map(s => s.badge).join(', ') },
    { header: 'PPA', value: p => ppaVigentes(p).map(ppaLabel).join(', ') },
    { header: 'Inversionistas', value: p => (p.inversionistas || []).map(i => i.cliente_nombre).join(', ') },
  ],
  ppa: () => [
    { header: 'Nombre interno', value: c => c.nombre_interno || '' },
    { header: 'Tipo', value: c => c.tipo_contrato === 'compra' ? 'Compra' : 'Venta' },
    { header: 'N° contrato', value: c => c.numero_codigo_contrato || '' },
    { header: 'Estado', value: c => (c._vigencia || estadoVigenciaPPA(c)).label },
    { header: 'Comprador', value: c => c.comprador_nombre || '' },
    { header: 'Vendedor', value: c => c.vendedor_nombre || '' },
    { header: 'Inicio', value: c => fmtFecha(c.fecha_inicio) },
    { header: 'Fin', value: c => fmtFecha(c.fecha_fin) },
    { header: 'Días restantes', value: c => c.dias_restantes ?? '' },
    { header: 'Cumplimiento', value: c => CUMPLIMIENTO_LABELS[c.estado_cumplimiento] || c.estado_cumplimiento || '' },
    { header: 'Cobertura (%)', value: c => c.cobertura_actual_pct ?? '' },
  ],
  contrato: () => [
    { header: 'Tipo', value: c => TIPO_CONTRATO_LABELS[c.servicio_aplica] || c.servicio_aplica || '' },
    // El proyecto va en el Excel de todos los servicios, no sólo de
    // Representación: es la llave con la que se cruza contra cualquier otro
    // reporte de la plataforma.
    { header: 'Proyecto', value: c => c.proyecto?.nombre_comercial || '' },
    { header: 'Tipo de planta', value: c =>
        TIPO_LABELS[c.proyecto?.tipo_proyecto] || c.proyecto?.tipo_proyecto || '' },
    { header: 'Proyecto según contrato', value: c => c.nombre_proyecto_ref || '' },
    { header: 'Inversionista', value: c => c.inversionista_nombre || '' },
    { header: 'N° contrato', value: c => c.numero_contrato || '' },
    { header: 'Contratante', value: c => c.contratante_nombre || '' },
    { header: 'Prestador', value: c => c.prestador_nombre || '' },
    { header: 'Inicio', value: c => fmtFecha(c.fecha_inicio) },
    { header: 'Fin', value: c => fmtFecha(c.fecha_fin) },
    { header: 'Estado', value: c => ESTADO_CONTRATO_LABELS[c.estado] || c.estado || '' },
  ],
}

async function descargarExcel() {
  const clave = vista.value === 'clientes' ? 'clientes'
    : vista.value === 'proyectos' ? 'proyectos'
    : servicio.value === 'ppa' ? 'ppa'
    : 'contrato'
  const hoja = vista.value === 'clientes' ? 'Clientes'
    : vista.value === 'proyectos' ? 'Proyectos'
    : (servicioInfo.value?.label || 'Servicios')
  const nombre = vista.value === 'servicios' && clave === 'contrato' ? servicio.value : clave
  const fecha = new Date().toISOString().slice(0, 10)
  await exportarExcel(filasVisibles.value, COLUMNAS_EXCEL[clave](), `${nombre}_${fecha}.xlsx`, hoja)
}

// ── Creación de cliente ──────────────────────────────────────────────────────
const dialogCliente = ref(false)

async function crearCliente(payload, forzar = false) {
  try {
    const cliente = await clientesService.crear(payload, forzar)
    toast.success('Cliente creado', { duration: 3000 })
    dialogCliente.value = false
    duplicadoVisible.value = false
    router.push(`/clientes/${cliente.id}`)
  } catch (e) {
    // El aviso de nombre parecido abre el diálogo con "Crear igual". Antes salía
    // como un toast de error y no había salida: la única forma de seguir era
    // cerrar y escribir el nombre a mano -- justo lo que duplica los clientes.
    const aviso = duplicadoDe(e)
    if (aviso) {
      duplicadoInfo.value = aviso
      duplicadoTipo.value = 'cliente'
      pendingPayload.value = payload
      duplicadoVisible.value = true
      return
    }
    // `mensajeDeError` y no `e.data?.detail`: la validacion por campo de DRF no
    // manda `detail` y la descripcion salia vacia -- un toast que decia "Error"
    // y nada mas.
    toast.error('No se pudo crear el cliente', {
      description: mensajeDeError(e, 'Revisá los datos e intentá de nuevo.'),
      duration: 6000,
    })
  }
}

async function crearClienteForzado() {
  forzando.value = true
  try {
    await crearCliente(pendingPayload.value, true)
  } finally {
    forzando.value = false
  }
}

function confirmarBorrarCliente(row) {
  confirm({
    title: 'Eliminar cliente',
    description: `¿Eliminar "${formatearNombre(row.razon_social_nombre)}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await clientesService.eliminar(row.id)
        clientes.value = clientes.value.filter(c => c.id !== row.id)
        toast.success('Cliente eliminado', { duration: 2500 })
      } catch (e) {
        toast.error('No se pudo eliminar', {
          description: e.data?.detail || 'Error al eliminar',
          duration: 5000,
        })
      }
    },
  })
}

// Los contratos de servicio no tienen vista de detalle propia: se administran
// desde la pestaña Operación de su planta, que es donde viven tarifas y pagos.
function irAEditarContratoServicio(row) {
  if (!row.proyecto_id) {
    toast.warning('Sin planta asociada', {
      description: 'Este contrato no tiene proyecto_id, así que no hay página donde editarlo.',
      duration: 5000,
    })
    return
  }
  ir(`/proyectos/${row.proyecto_id}/operacion`)
}

function confirmarBorrarContratoServicio(row) {
  const nombre = row.numero_contrato || row.contratante_nombre || 'sin número'
  confirm({
    title: 'Eliminar contrato',
    description: `¿Eliminar el contrato "${nombre}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await contratosServicioService.eliminar(row.id)
        contratosServicio.value = contratosServicio.value.filter(c => c.id !== row.id)
        toast.success('Contrato eliminado', { duration: 2500 })
      } catch (e) {
        toast.error('No se pudo eliminar', {
          description: e.data?.detail || 'Error al eliminar',
          duration: 5000,
        })
      }
    },
  })
}

// ── Creación de proyecto (con el aviso de nombre parecido) ───────────────────
const dialogProyecto = ref(false)
const duplicadoVisible = ref(false)
const duplicadoInfo = ref(null)
// 'proyecto' | 'cliente': el mismo aviso sirve para los dos, y el tipo decide a
// quién se le manda el `forzar=true` al confirmar.
const duplicadoTipo = ref('proyecto')
const pendingPayload = ref(null)
const pendingInfoTecnica = ref(null)
const pendingInversionista = ref(null)
const forzando = ref(false)

/** El 409 de nombre parecido, si el error es ese. `null` para cualquier otro. */
function duplicadoDe(e) {
  const detail = e?.data?.detail ?? e?.response?.data?.detail
  return e?.status === 409 && detail?.duplicado_nombre ? detail : null
}

function crearForzado() {
  return duplicadoTipo.value === 'cliente'
    ? crearClienteForzado()
    : crearProyectoForzado()
}

async function guardarInfoTecnicaSiAplica(proyectoId, infoTecnica) {
  if (!infoTecnica) return
  const vacia = infoTecnica.potencia_ac_kw == null
    && infoTecnica.capacidad_instalada_kwp == null
    && infoTecnica.cantidad_total_paneles == null
  if (vacia) return
  try {
    await proyectosService.guardarInfoTecnica(proyectoId, infoTecnica)
  } catch (e) {
    toast.warning('Proyecto creado, pero la ficha técnica no se pudo guardar', {
      description: e.data?.detail,
      duration: 5000,
    })
  }
}

/**
 * Vincula el inversionista que se eligió junto con la planta.
 *
 * Va DESPUÉS de crear el proyecto porque necesita su id, y no tumba la creación
 * si falla: la planta ya existe, y el vínculo se puede agregar desde su detalle.
 */
async function vincularInversionistaSiAplica(proyectoId, inversionista) {
  if (!inversionista?.cliente_id) return
  try {
    await proyectosService.agregarInversionista(proyectoId, inversionista)
  } catch (e) {
    toast.warning('Proyecto creado, pero el inversionista no se pudo vincular', {
      description: e.data?.detail,
      duration: 5000,
    })
  }
}

async function crearProyecto(payload, infoTecnica, inversionista) {
  try {
    const proyecto = await proyectosService.crear(payload)
    await guardarInfoTecnicaSiAplica(proyecto.id, infoTecnica)
    await vincularInversionistaSiAplica(proyecto.id, inversionista)
    toast.success('Proyecto creado', { duration: 3000 })
    dialogProyecto.value = false
    cargarProyectos()
  } catch (e) {
    const detail = e.data?.detail
    // 409 estructurado = "hay un nombre parecido"; se puede confirmar y crear
    // igual. Distinto de un choque real de columna única (detail es string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      duplicadoTipo.value = 'proyecto'
      pendingPayload.value = payload
      pendingInfoTecnica.value = infoTecnica
      pendingInversionista.value = inversionista
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'Error al guardar',
      duration: 4000,
    })
  }
}

async function crearProyectoForzado() {
  forzando.value = true
  try {
    const proyecto = await proyectosService.crear(pendingPayload.value, true)
    await guardarInfoTecnicaSiAplica(proyecto.id, pendingInfoTecnica.value)
    await vincularInversionistaSiAplica(proyecto.id, pendingInversionista.value)
    toast.success('Proyecto creado', { duration: 3000 })
    duplicadoVisible.value = false
    dialogProyecto.value = false
    cargarProyectos()
  } catch (e) {
    const detail = e.data?.detail
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'Error al guardar',
      duration: 4000,
    })
  } finally {
    forzando.value = false
  }
}

function confirmarBorrarProyecto(row) {
  confirm({
    title: 'Eliminar proyecto',
    description: `¿Eliminar "${formatearNombre(row.nombre_comercial)}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await proyectosService.eliminar(row.id)
        proyectos.value = proyectos.value.filter(p => p.id !== row.id)
        toast.success('Proyecto eliminado', { duration: 2500 })
      } catch (e) {
        toast.error('No se pudo eliminar', {
          description: e.data?.detail || 'Error al eliminar',
          duration: 5000,
        })
      }
    },
  })
}

// ── Contratos: wizards y borrado ─────────────────────────────────────────────
const showWizardPPA = ref(false)
const showWizardServicio = ref(false)
const ppaADuplicar = ref(null)
// Que tipo se va a crear. Con un solo tipo es directo; con varios lo escoge el
// menu, porque el wizard guarda este valor en servicio_aplica sin traducirlo.
const tipoAcrear = ref(null)
const menuNuevoContrato = ref(null)

const opcionesNuevoContrato = computed(() => tiposDelServicio.value.map(t => ({
  label: TIPO_CONTRATO_LABELS[t] || t,
  icon: PlusIcon,
  command: () => { tipoAcrear.value = t; showWizardServicio.value = true },
})))

function nuevoContrato(evento) {
  if (tiposDelServicio.value.length === 1) {
    tipoAcrear.value = tiposDelServicio.value[0]
    showWizardServicio.value = true
    return
  }
  menuNuevoContrato.value?.toggle(evento)
}

function abrirWizardPPA(contrato) {
  ppaADuplicar.value = contrato
  showWizardPPA.value = true
}
function cerrarWizardPPA() {
  showWizardPPA.value = false
  ppaADuplicar.value = null
}

function confirmarBorrarPpa(contrato) {
  const nombre = contrato.nombre_interno || contrato.numero_codigo_contrato || 'sin nombre'
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Seguro que deseas eliminar el contrato "${nombre}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminar(contrato.id)
        ppa.value = ppa.value.filter(c => c.id !== contrato.id)
        toast.success('Contrato eliminado', { duration: 2500 })
      } catch (e) {
        toast.error('No se puede eliminar', {
          description: e.data?.detail || 'Error al eliminar el contrato.',
          duration: 6000,
        })
      }
    },
  })
}
</script>

<style scoped>
/* Animación propia del punto "en operación" (los @keyframes no tienen utilidad). */
.pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
@keyframes pulse-dot {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%      { transform: scale(1.4); opacity: .65; }
}

/* ── Densidad ──────────────────────────────────────────────────────────────────
   El objetivo es meter la mayor cantidad de filas y columnas en pantalla sin
   perder legibilidad: encabezado en versalitas chicas, celdas de una línea. El
   botón de la cabecera alterna a "cómoda" para quien prefiera aire.
   Las reglas siguientes estilan el markup interno de PrimeVue DataTable, que no
   controlamos: por eso viven aquí y no como utilidades.                       */
.tabla :deep(.p-datatable-thead > tr > th) {
  padding: var(--spacing) calc(var(--spacing) * 2); font-size: var(--text-xs); font-weight: 700;
  letter-spacing: var(--tracking-wide); text-transform: uppercase;
  color: var(--muted-foreground); background: color-mix(in oklab, var(--muted) 50%, transparent); white-space: nowrap;
}
.tabla :deep(.p-datatable-tbody > tr > td) {
  padding: var(--spacing) calc(var(--spacing) * 2); font-size: var(--text-xs); line-height: 1.3; white-space: nowrap;
}
.tabla--compacta :deep(.p-datatable-thead > tr > th) { padding: calc(var(--spacing) * 0.75) calc(var(--spacing) * 1.5); }
.tabla--compacta :deep(.p-datatable-tbody > tr > td) { padding: calc(var(--spacing) * 0.25) calc(var(--spacing) * 1.5); line-height: 1.2; }
.tabla :deep(.p-datatable-tbody > tr > td .p-button) { width: 1.5rem; height: 1.5rem; }
.tabla :deep(.p-datatable-tbody > tr > td .p-button .p-button-icon) { font-size: .7rem; }
.tabla :deep(.p-paginator) {
  padding: calc(var(--spacing) * 0.5) calc(var(--spacing) * 1.5); font-size: var(--text-xs);
  border-top: 1px solid var(--border);
}
.tabla :deep(.p-paginator .p-paginator-page),
.tabla :deep(.p-paginator .p-paginator-first),
.tabla :deep(.p-paginator .p-paginator-prev),
.tabla :deep(.p-paginator .p-paginator-next),
.tabla :deep(.p-paginator .p-paginator-last) { min-width: 1.75rem; height: 1.75rem; }
.tabla :deep(.p-datatable-sort-icon) { width: .65rem; height: .65rem; }

/* Fila resaltada por vencimiento (misma semántica que la vista Clientes) */
.tabla :deep(.row-vencido) > td    { background: color-mix(in oklab, var(--destructive) 10%, transparent) !important; }
.tabla :deep(.row-por-vencer) > td { background: color-mix(in oklab, var(--warning) 10%, transparent) !important; }

/* La fila entera abre el detalle (sólo donde row-click está cableado) */
.tabla--clickable :deep(.p-datatable-tbody > tr) { cursor: pointer; }

/* ── Sin scroll horizontal ────────────────────────────────────────
   `table-layout: fixed` hace que los porcentajes de cada <Column> manden: la
   tabla se reparte el ancho disponible y NUNCA lo excede. Lo que no cabe se
   recorta con puntos suspensivos (y el dato completo queda en el tooltip o en
   el Excel), en vez de empujar la tabla y aparecer una barra horizontal. */
.tabla :deep(.p-datatable-table) { table-layout: fixed; width: 100%; }
.tabla :deep(.p-datatable-table-container) { overflow-x: hidden; }
.tabla :deep(.p-datatable-thead > tr > th) { overflow: hidden; }
.tabla :deep(.p-datatable-tbody > tr > td) { overflow: hidden; text-overflow: ellipsis; }
</style>
