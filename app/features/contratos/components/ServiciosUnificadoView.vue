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
    <PageHeader :title="titulo" :subtitle="subtitulo">
      <template #actions>
        <InputGroup v-if="vista && !enProximos && !enPortafolios" class="w-full sm:max-w-48">
          <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
          <InputGroupInput v-model="q" :placeholder="placeholderBusqueda" />
        </InputGroup>
        <GTooltip v-if="vista && !enPortafolios">
          <GTooltipTrigger as-child>
            <Button variant="outline" size="icon-sm" @click="compacta = !compacta">
              <component :is="compacta ? MoveVerticalIcon : AlignJustifyIcon" class="size-4" />
            </Button>
          </GTooltipTrigger>
          <GTooltipContent>{{ compacta ? 'Densidad cómoda' : 'Densidad compacta' }}</GTooltipContent>
        </GTooltip>
        <Button v-if="vista && !enProximos && !enPortafolios" variant="outline" size="sm" :disabled="!filasVisibles.length" @click="descargarExcel">
          <FileSpreadsheetIcon class="size-4" /> Excel
        </Button>
        <Button v-if="vista === 'clientes'" size="sm" @click="dialogCliente = true">
          <PlusIcon class="size-4" /> Nuevo cliente
        </Button>
        <Button v-else-if="vista === 'proyectos'" size="sm" @click="abrirNuevoProyecto">
          <PlusIcon class="size-4" /> Nuevo proyecto
        </Button>
        <Button v-else-if="vista === 'servicios' && servicio === 'ppa'" size="sm" class="bg-warning border-warning hover:bg-warning/90" @click="abrirWizardPPA(null)">
          <PlusIcon class="size-4" /> Nuevo PPA
        </Button>
        <template v-else-if="vista === 'servicios'">
          <!-- Con varios tipos (Operación: mantenimiento, arriendo, internet) se
               elige cuál crear: el wizard guarda el tipo tal cual en servicio_aplica. -->
          <DropdownMenu v-if="tiposDelServicio.length > 1">
            <DropdownMenuTrigger as-child>
              <Button size="sm" class="bg-(--c) border-(--c) hover:bg-(--c)/90" :style="{ '--c': servicioInfo?.color }">
                <ChevronDownIcon class="size-4" /> Nuevo {{ servicioInfo?.label }}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem v-for="o in opcionesNuevoContrato" :key="o.tipo" @select="crearContratoDeTipo(o.tipo)">
                <PlusIcon class="size-4" /> {{ o.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button v-else size="sm" class="bg-(--c) border-(--c) hover:bg-(--c)/90" :style="{ '--c': servicioInfo?.color }"
                  @click="crearContratoDeTipo(tiposDelServicio[0])">
            <PlusIcon class="size-4" /> Nuevo {{ servicioInfo?.label }}
          </Button>
        </template>
      </template>
    </PageHeader>

    <!-- Selector de ángulo (nivel 1) + tipo de servicio (nivel 2) -->
    <div class="flex flex-wrap items-center gap-2">
      <template v-if="!vistaFija">
      <button v-for="v in VISTAS" :key="v.key" type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-bold cursor-pointer select-none transition-colors duration-150"
              :class="vista === v.key
                ? 'bg-(--bg) border-(--bd) text-(--c) shadow-xs [&>svg]:text-(--c)'
                : 'bg-card border-border text-muted-foreground [&>svg]:text-muted-foreground/60 hover:border-primary/30 hover:text-foreground'"
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
      </template>

      <!-- Proyectos: todos, o solo los próximos a energizar (antes, una página aparte). -->
      <template v-if="vistaFija === 'proyectos'">
        <button v-for="o in VER_PROYECTOS" :key="o.key" type="button"
                class="inline-flex items-center gap-1.5 px-2 py-1 border rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors duration-150"
                :class="verProyectos === o.key
                  ? 'bg-primary/10 border-primary/30 text-primary shadow-xs'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'"
                @click="verProyectos = o.key">
          <component :is="o.icon" class="size-4" />
          <span>{{ o.label }}</span>
        </button>
      </template>
      <template v-if="vista === 'servicios'">
        <span v-if="!vistaFija" class="mx-1 h-6 w-px bg-border" />
        <button v-for="s in SERVICIOS" :key="s.key" type="button"
                class="inline-flex items-center gap-1.5 px-2 py-1 border rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors duration-150"
                :class="servicio === s.key
                  ? 'bg-(--bg) border-(--bd) text-(--c) shadow-xs [&>svg]:text-(--c)'
                  : 'bg-card border-border text-muted-foreground [&>svg]:text-muted-foreground/60 hover:border-primary/30 hover:text-foreground'"
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
    <ProyectosPendientesPanel v-if="vista === 'proyectos' && !enProximos && !enPortafolios" @cambio="cargarProyectos" />

    <!-- Los desplegables con buscador (ComboBox) llevan una opción «Todos» en vez
         del botón de limpiar de PrimeVue: elegirla quita el filtro. -->
    <div v-if="vista === 'proyectos' && !enProximos && !enPortafolios"
         class="bg-card rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-muted-foreground">Estado</label>
        <Select :model-value="aValorSelect(filtrosProyectos.estado.value)"
                @update:model-value="filtrosProyectos.estado.value = deValorSelect($event) || null">
          <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="o in estadoOpcionesProyectos" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
        <Select :model-value="aValorSelect(filtrosProyectos.tipo_proyecto.value)"
                @update:model-value="filtrosProyectos.tipo_proyecto.value = deValorSelect($event) || null">
          <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
            <SelectItem v-for="o in tipoOpcionesProyectos" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1 w-52">
        <label class="text-xs font-semibold text-muted-foreground">Portafolio</label>
        <ComboBox :model-value="filtrosProyectos.portafolio_id.value != null ? String(filtrosProyectos.portafolio_id.value) : null"
                  :options="conTodos(opcionesPortafolioProyectos)" placeholder="Todos"
                  @update:model-value="v => { const id = deValorSelect(v); filtrosProyectos.portafolio_id.value = id ? Number(id) : null }" />
      </div>
      <div class="flex flex-col gap-1 w-64">
        <label class="text-xs font-semibold text-muted-foreground">PPA</label>
        <MultiComboBox :model-value="(filtrosProyectos.ppa_contratos.value || []).map(String)"
                       :options="ppaOpcionesProyectos" placeholder="Todos"
                       @update:model-value="v => { filtrosProyectos.ppa_contratos.value = v.length ? v.map(Number) : null }" />
      </div>
      <Button v-if="nFiltrosProyectosActivos" variant="ghost" size="sm" @click="limpiarFiltrosProyectos">Limpiar filtros</Button>
    </div>

    <!-- Filtros de Servicios. Misma fila fija que la de Proyectos; los controles
         cambian según la pestaña porque las tres tablas no comparten columnas.
         Los predicados viven en `~/features/contratos/filtrosServicios`. -->
    <div v-if="vista === 'servicios'"
         class="bg-card rounded-xl shadow-sm p-3 flex flex-wrap gap-3 items-end border">
      <template v-if="servicio === 'ppa'">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-muted-foreground">Estado</label>
          <Select :model-value="aValorSelect(filtrosPpa.estado)"
                  @update:model-value="filtrosPpa.estado = deValorSelect($event) || null">
            <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
              <SelectItem v-for="o in VIGENCIA_OPCIONES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
          <Select :model-value="aValorSelect(filtrosPpa.tipo)"
                  @update:model-value="filtrosPpa.tipo = deValorSelect($event) || null">
            <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
              <SelectItem v-for="o in opcionesPpaTipo" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1 w-56">
          <label class="text-xs font-semibold text-muted-foreground">Comprador</label>
          <ComboBox placeholder="Todos" :model-value="filtrosPpa.comprador" :options="conTodos(opcionesPpaComprador)"
                    @update:model-value="filtrosPpa.comprador = deValorSelect($event) || null" />
        </div>
        <div class="flex flex-col gap-1 w-56">
          <label class="text-xs font-semibold text-muted-foreground">Vendedor</label>
          <ComboBox placeholder="Todos" :model-value="filtrosPpa.vendedor" :options="conTodos(opcionesPpaVendedor)"
                    @update:model-value="filtrosPpa.vendedor = deValorSelect($event) || null" />
        </div>
        <Button v-if="nFiltrosPpaActivos" variant="ghost" size="sm" @click="limpiarFiltrosPpa">Limpiar filtros</Button>
      </template>

      <template v-else>
        <div v-if="tiposDelServicio.length > 1" class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-muted-foreground">Tipo</label>
          <Select :model-value="aValorSelect(filtrosServicio.tipo)"
                  @update:model-value="filtrosServicio.tipo = deValorSelect($event) || null">
            <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
              <SelectItem v-for="o in opcionesServicioTipo" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-muted-foreground">Estado</label>
          <Select :model-value="aValorSelect(filtrosServicio.estado)"
                  @update:model-value="filtrosServicio.estado = deValorSelect($event) || null">
            <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
              <SelectItem v-for="o in ESTADO_CONTRATO_OPCIONES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="esRepresentacion" class="flex flex-col gap-1 w-56">
          <label class="text-xs font-semibold text-muted-foreground">Inversionista</label>
          <ComboBox placeholder="Todos" :model-value="filtrosServicio.inversionista" :options="conTodos(opcionesInversionista)"
                    @update:model-value="filtrosServicio.inversionista = deValorSelect($event) || null" />
        </div>
        <!-- Solo si hay más de una clase entre los contratos cargados: con una
             sola, el desplegable no seleccionaría nada distinto. -->
        <div v-if="opcionesTipoPlanta.length > 1" class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-muted-foreground">Tipo de planta</label>
          <Select :model-value="aValorSelect(filtrosServicio.tipoPlanta)"
                  @update:model-value="filtrosServicio.tipoPlanta = deValorSelect($event) || null">
            <SelectTrigger size="sm" class="min-w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="VALOR_SELECT_VACIO">Todos</SelectItem>
              <SelectItem v-for="o in opcionesTipoPlanta" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <!-- Sin desplegable de "Proyecto": aislar los huérfanos sigue estando en
             el botón "Ver solo estos" de la barra de aviso, que es de donde salió
             y donde tiene el contexto (dice cuántos son). El filtro sigue
             existiendo en el estado; lo que se quitó es el control duplicado. -->
        <Button v-if="nFiltrosServicioActivos" variant="ghost" size="sm" @click="limpiarFiltrosServicio">Limpiar filtros</Button>
      </template>
    </div>

    <!-- Los avisos de las celdas van en `title` y no en GTooltip: con 100 filas
         por página serían cientos de tooltips montados. -->

    <!-- ══════════════════ PRÓXIMOS A ENERGIZAR ══════════════════ -->
    <ProyectosProximosEnergizar v-if="enProximos" />

    <!-- ══════════════════ CLIENTES ══════════════════ -->
    <!-- Portafolios (Proyectos › Portafolios): lista y detalle, sin tabla ni Excel. -->
    <PortafoliosPanel v-if="enPortafolios" />

    <div v-else-if="vista === 'clientes'" :class="claseTabla">
      <DataTable :columns="COLUMNAS_CLIENTES" :rows="tablaClientes.filasPagina" row-key="id"
                 v-model:sort="tablaClientes.orden" v-model:page="tablaClientes.pagina"
                 :page-size="porPagina" :total="tablaClientes.total" :page-size-options="OPCIONES_POR_PAGINA"
                 :loading="loadingClientes" :max-height="scrollHeight" fixed-layout :row-class="rowClassCliente"
                 empty-message="No hay clientes."
                 @update:page-size="porPagina = $event"
                 @row-click="row => ir(`/clientes/${row.id}`)">
        <template #cell="{ row, column }">
          <div v-if="column.key === 'razon_social_nombre'" class="flex items-center gap-1 min-w-0">
            <TruncatedText :text="formatearNombre(row.razon_social_nombre)" class="min-w-0 max-w-full font-semibold text-foreground" />
            <span v-if="row.alerta_contrato && row.alerta_contrato !== 'vigente'"
                  class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-(--bg) text-(--c)"
                  :style="{ '--c': SEMAFORO[row.alerta_contrato].color, '--bg': SEMAFORO[row.alerta_contrato].bg }">
              {{ SEMAFORO[row.alerta_contrato].label }}
            </span>
          </div>
          <span v-else-if="column.key === 'nit_cedula'" class="font-mono text-xs text-muted-foreground">{{ fmt(row.nit_cedula) }}</span>
          <span v-else-if="column.key === 'num_plantas'" class="font-semibold tabular-nums text-foreground">{{ row.num_plantas }}</span>
          <div v-else-if="column.key === 'servicios'" class="flex gap-0.5 overflow-hidden min-w-0">
            <span v-for="sv in row.servicios" :key="sv" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-primary/10 text-primary">{{ servicioLabel(sv) }}</span>
            <span v-if="!row.servicios?.length" class="text-xs text-muted-foreground/50">—</span>
          </div>
          <TruncatedText v-else-if="column.key === 'contacto_comercial_nombre'" :text="fmt(row.contacto_comercial_nombre)" class="min-w-0 max-w-full" />
          <TruncatedText v-else-if="column.key === 'contacto_comercial_correo'" :text="fmt(row.contacto_comercial_correo)" class="min-w-0 max-w-full text-xs text-muted-foreground" />
          <div v-else-if="column.key === 'falta'" class="flex gap-1">
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'campos')">
              <ListIcon class="size-4" />{{ faltanCampos(row).length }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'docs')">
              <PaperclipIcon class="size-4" />{{ faltanDocs(row).length }}
            </span>
          </div>
          <div v-else-if="column.key === 'acciones'" class="flex justify-end gap-0">
            <Button variant="ghost" size="icon-sm" class="size-6" title="Editar" @click.stop="ir(`/clientes/${row.id}`)"><PencilIcon class="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" class="size-6" title="Eliminar" @click.stop="confirmarBorrarCliente(row)"><Trash2Icon class="size-3.5 text-destructive" /></Button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ══════════════════ PROYECTOS ══════════════════ -->
    <div v-else-if="vista === 'proyectos' && !enProximos && !enPortafolios" :class="claseTabla">
      <DataTable :columns="COLUMNAS_PROYECTOS" :rows="tablaProyectos.filasPagina" row-key="id"
                 v-model:sort="tablaProyectos.orden" v-model:page="tablaProyectos.pagina"
                 :page-size="porPagina" :total="tablaProyectos.total" :page-size-options="OPCIONES_POR_PAGINA"
                 :loading="loadingProyectos" :max-height="scrollHeight" fixed-layout
                 empty-message="No se encontraron proyectos."
                 @update:page-size="porPagina = $event">
        <template #cell="{ row, column }">
          <template v-if="column.key === 'nombre_comercial'">
            <span class="block text-xs leading-none font-mono"
                  :class="row.codigo_tsf ? 'text-muted-foreground' : 'text-muted-foreground/50'">
              {{ row.codigo_tsf || '—' }}
            </span>
            <button type="button" class="block max-w-full text-left text-xs font-semibold text-foreground cursor-pointer transition-colors duration-150 hover:text-primary hover:underline underline-offset-2" @click="ir(`/proyectos/${row.id}`)">
              <TruncatedText :text="formatearNombre(row.nombre_comercial)" class="min-w-0" />
            </button>
          </template>
          <span v-else-if="column.key === 'estado'" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap gap-1"
                :class="ESTADO_CLASS[row.estado] || 'bg-muted text-muted-foreground'">
            <span v-if="row.estado === 'en_operacion'" class="pulse-dot inline-block size-1.5 rounded-full bg-success shrink-0" />
            {{ ESTADO_LABELS[row.estado] || row.estado || '—' }}
          </span>
          <span v-else-if="column.key === 'tipo_proyecto'" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap" :class="TIPO_BADGE_CLASS[row.tipo_proyecto] || 'bg-muted text-muted-foreground'">
            {{ TIPO_LABELS[row.tipo_proyecto] || row.tipo_proyecto || '—' }}
          </span>
          <TruncatedText v-else-if="column.key === 'portafolios'" :text="nombresPortafolios(row) || '—'" class="min-w-0 max-w-full text-xs text-muted-foreground" />
          <template v-else-if="column.key === 'municipio'">
            <TruncatedText v-if="row.municipio || row.departamento" :text="[row.municipio, row.departamento].filter(Boolean).join(', ')" class="min-w-0 max-w-full text-xs text-muted-foreground" />
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
          <span v-else-if="column.key === 'info_tecnica.capacidad_instalada_kwp'" class="font-mono text-xs text-muted-foreground" :title="`AC: ${num(row.info_tecnica?.potencia_ac_kw)} kW`">
            {{ num(row.info_tecnica?.capacidad_instalada_kwp) }}
          </span>
          <div v-else-if="column.key === 'servicios'" class="flex gap-0.5 overflow-hidden min-w-0">
            <template v-for="srv in SERVICIOS_BADGES" :key="srv.key">
              <span v-if="row.servicios?.[srv.key]" class="inline-flex items-center shrink-0 text-xs font-bold leading-normal px-1.5 rounded-full whitespace-nowrap bg-success/10 text-success"
                    :title="srv.tooltip">{{ srv.badge }}</span>
            </template>
            <span v-if="!SERVICIOS_BADGES.some(sb => row.servicios?.[sb.key])" class="text-xs text-muted-foreground/50">—</span>
          </div>
          <template v-else-if="column.key === 'ppa'">
            <div v-if="ppaVigentes(row).length" class="flex gap-0.5 overflow-hidden min-w-0">
              <button v-for="c in ppaVigentes(row)" :key="c.id" type="button" class="min-w-0 truncate bg-primary/10 text-primary text-xs font-semibold px-1.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-primary hover:text-primary-foreground"
                      :title="ppaTooltip(c)" @click="ir(`/contratos/${c.id}`)">
                {{ ppaLabel(c) }}
              </button>
            </div>
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
          <div v-else-if="column.key === 'falta'" class="flex gap-1">
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'campos')">
              <ListIcon class="size-4" />{{ faltanCampos(row).length }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'docs')">
              <PaperclipIcon class="size-4" />{{ faltanDocs(row).length }}
            </span>
          </div>
          <div v-else-if="column.key === 'acciones'" class="flex justify-end gap-0">
            <Button variant="ghost" size="icon-sm" class="size-6" title="Editar" @click.stop="ir(`/proyectos/${row.id}?edit=true`)"><PencilIcon class="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" class="size-6" title="Eliminar" @click.stop="confirmarBorrarProyecto(row)"><Trash2Icon class="size-3.5 text-destructive" /></Button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ══════════════════ SERVICIOS · PPA ══════════════════ -->
    <div v-else-if="servicio === 'ppa'" :class="claseTabla">
      <DataTable :columns="COLUMNAS_PPA" :rows="tablaPpa.filasPagina" row-key="id"
                 v-model:sort="tablaPpa.orden" v-model:page="tablaPpa.pagina"
                 :page-size="porPagina" :total="tablaPpa.total" :page-size-options="OPCIONES_POR_PAGINA"
                 :loading="loadingPpa" :max-height="scrollHeight" fixed-layout
                 empty-message="No hay contratos PPA registrados."
                 @update:page-size="porPagina = $event">
        <template #cell="{ row, column }">
          <button v-if="column.key === 'nombre_interno'" type="button" class="block max-w-full text-left text-xs font-semibold text-foreground cursor-pointer transition-colors duration-150 hover:text-primary hover:underline underline-offset-2" @click="ir(`/contratos/${row.id}`)">
            <TruncatedText :text="row.nombre_interno || row.numero_codigo_contrato || '—'" class="min-w-0" />
          </button>
          <template v-else-if="column.key === 'numero_codigo_contrato'">
            <TruncatedText v-if="row.numero_codigo_contrato" :text="row.numero_codigo_contrato" class="font-mono text-xs text-muted-foreground min-w-0 max-w-full" />
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
          <span v-else-if="column.key === 'tipo_contrato'" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap"
                :class="row.tipo_contrato === 'compra'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-highlight text-foreground'">
            {{ row.tipo_contrato === 'compra' ? 'Compra' : 'Venta' }}
          </span>
          <!-- Estado de vigencia: derivado de las fechas, mismo cálculo que el
               detalle del contrato (utils/ppaVigencia.js). Ordena por urgencia. -->
          <span v-else-if="column.key === '_vigencia.orden'" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap bg-(--bg) text-(--c)"
                :style="{ '--bg': row._vigencia.bg, '--c': row._vigencia.color }"
                :title="row._vigencia.detalle">
            {{ row._vigencia.label }}
          </span>
          <TruncatedText v-else-if="column.key === 'comprador_nombre'" :text="row.comprador_nombre || '—'" class="min-w-0 max-w-full" />
          <TruncatedText v-else-if="column.key === 'vendedor_nombre'" :text="row.vendedor_nombre || '—'" class="min-w-0 max-w-full" />
          <span v-else-if="column.key === 'fecha_inicio'" class="font-mono text-xs text-muted-foreground">{{ fmtFecha(row.fecha_inicio) }}</span>
          <!-- Resaltado y aviso salen de _vigencia, no de dias_restantes: el
               listado de /ppa devuelve las filas del ORM y ese campo llega null,
               así que este aviso nunca se veía. -->
          <span v-else-if="column.key === 'fecha_fin'" class="font-mono text-xs"
                :class="['vencido', 'por_vencer'].includes(row._vigencia.clave) ? 'font-bold text-(--c)' : 'text-muted-foreground'"
                :style="{ '--c': row._vigencia.color }"
                :title="row._vigencia.detalle">
            {{ fmtFecha(row.fecha_fin) }}
          </span>
          <template v-else-if="column.key === 'cobertura_actual_pct'">
            <div v-if="row.cobertura_actual_pct != null" class="flex items-center gap-1">
              <div class="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                <div class="h-full rounded-full w-(--w)"
                     :class="row.cobertura_actual_pct >= 90 ? 'bg-success'
                       : row.cobertura_actual_pct >= 70 ? 'bg-warning' : 'bg-destructive'"
                     :style="{ '--w': Math.min(row.cobertura_actual_pct, 100) + '%' }" />
              </div>
              <span class="font-mono text-xs text-muted-foreground">{{ row.cobertura_actual_pct }}%</span>
            </div>
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </template>
          <div v-else-if="column.key === 'falta'" class="flex gap-1">
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'campos')">
              <ListIcon class="size-4" />{{ faltanCampos(row).length }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                  :title="tipFalta(row, 'docs')">
              <PaperclipIcon class="size-4" />{{ faltanDocs(row).length }}
            </span>
          </div>
          <div v-else-if="column.key === 'acciones'" class="flex justify-end gap-0">
            <Button variant="ghost" size="icon-sm" class="size-6" title="Editar" @click.stop="ir(`/contratos/${row.id}`)"><PencilIcon class="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" class="size-6" title="Eliminar" @click.stop="confirmarBorrarPpa(row)"><Trash2Icon class="size-3.5 text-destructive" /></Button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ══════ SERVICIOS · REPRESENTACIÓN / OPERACIÓN / REC ══════
         Los tres son contratos de `contratos_servicio`; Operación agrupa
         mantenimiento, arriendo e internet, así que lleva columna Tipo. -->
    <div v-else class="space-y-2">
      <!-- Todo contrato de representación pertenece a una planta. Los que no la
           tienen son un error de datos, no un estado válido: la barra los cuenta
           y deja aislarlos para irlos cerrando hasta llegar a cero. -->
      <div v-if="nHuerfanos" class="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-warning/10 text-warning border border-warning/30">
        <TriangleAlertIcon class="size-4" />
        <span><strong>{{ nHuerfanos }}</strong> de {{ contratosServicio.length }} contratos sin proyecto asociado</span>
        <Button variant="ghost" size="sm" class="ml-auto" @click="alternarHuerfanos">{{ soloHuerfanos ? 'Ver todos' : 'Ver solo estos' }}</Button>
      </div>

      <!-- Duplicados: el mismo contrato escrito por varias fuentes. Se limpian
           desde acá porque ir planta por planta no es viable con 126 contratos. -->
      <div v-if="esRepresentacion && nDuplicados" class="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30">
        <CopyIcon class="size-4" />
        <span>
          <strong>{{ nDuplicados }}</strong> registros duplicados en
          {{ duplicados.grupos_fusionables.length }}
          planta{{ duplicados.grupos_fusionables.length === 1 ? '' : 's' }}
          <template v-if="nEnConflicto">
            · {{ nEnConflicto }} grupo{{ nEnConflicto === 1 ? '' : 's' }} necesita revisión
          </template>
        </span>
        <Button v-if="!soloDuplicados" variant="ghost" size="sm" class="ml-auto" @click="soloDuplicados = !soloDuplicados">Ver solo estos</Button>
        <Button v-else variant="ghost" size="sm" class="ml-auto" @click="soloDuplicados = false">Ver todos</Button>
        <Button size="sm" :disabled="fusionando" @click="confirmarFusion">
          <Spinner v-if="fusionando" class="size-4" /><CheckIcon v-else class="size-4" /> Fusionar duplicados
        </Button>
      </div>
      <div :class="claseTabla">
        <DataTable :columns="columnasServicio" :rows="tablaServicios.filasPagina" row-key="id"
                   v-model:sort="tablaServicios.orden" v-model:page="tablaServicios.pagina"
                   :page-size="porPagina" :total="tablaServicios.total" :page-size-options="OPCIONES_POR_PAGINA"
                   :loading="loadingServicio" :max-height="scrollHeight" fixed-layout
                   :empty-message="`No hay contratos de ${servicioInfo?.label} registrados.`"
                   @row-click="row => ir(`/contratos/${row.id}`)"
                   @update:page-size="porPagina = $event">
          <template #cell="{ row, column }">
            <!-- Proyecto va PRIMERO y con el nombre más grande: es lo que identifica
                 la fila. Un contrato de servicio se firma SOBRE una planta, así que
                 sin esta columna la tabla no dice de qué habla cada fila. Cuando el
                 contrato quedó huérfano (proyecto_id NULL) la celda es el botón para
                 arreglarlo, en vez de un "—" que no lleva a ninguna parte. -->
            <template v-if="column.key === 'proyecto.nombre_comercial'">
              <button v-if="row.proyecto" type="button" class="group flex items-center gap-1 min-w-0 w-full text-left cursor-pointer text-foreground"
                      title="Ver la planta"
                      @click.stop="ir(rutaDeLaPlanta(row))">
                <TruncatedText :text="row.proyecto.nombre_comercial" class="min-w-0 max-w-full text-sm font-semibold group-hover:text-primary group-hover:underline" />
              </button>
              <button v-else type="button" class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-2 rounded-full cursor-pointer bg-warning/10 text-warning border border-dashed border-warning/50 transition-colors duration-150 hover:bg-warning/20"
                      title="Este contrato no está asociado a ninguna planta. Click para asociarlo."
                      @click.stop="abrirAsociarProyecto(row)">
                <LinkIcon class="size-4" />Sin proyecto
              </button>
            </template>
            <template v-else-if="column.key === 'proyecto.tipo_proyecto'">
              <span v-if="row.proyecto" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap"
                    :class="TIPO_BADGE_CLASS[row.proyecto.tipo_proyecto] || 'bg-muted text-muted-foreground'">
                {{ TIPO_LABELS[row.proyecto.tipo_proyecto] || row.proyecto.tipo_proyecto || 'Sin tipo' }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </template>
            <!-- Un chip por subservicio: en Representación y CGM un mismo contrato
                 cubre los dos, y pintar solo `servicio_aplica` ocultaba el CGM. -->
            <template v-else-if="column.key === 'servicio_aplica'">
              <span v-for="sub in subserviciosDeFila(row)" :key="sub" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap mr-1 bg-(--bg) text-(--c)"
                    :style="{
                      '--c': colorTipoContrato(sub),
                      '--bg': tinte(colorTipoContrato(sub), 12) }">
                {{ TIPO_CONTRATO_LABELS[sub] || sub }}
              </span>
              <span v-if="!subserviciosDeFila(row).length" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap text-muted-foreground bg-muted">—</span>
            </template>
            <TruncatedText v-else-if="column.key === 'inversionista_nombre'" :text="row.inversionista_nombre ? formatearNombre(row.inversionista_nombre) : '—'" class="min-w-0 max-w-full" />
            <TruncatedText v-else-if="column.key === 'numero_contrato'" :text="row.numero_contrato || '—'" class="min-w-0 max-w-full font-mono text-xs text-muted-foreground" />
            <TruncatedText v-else-if="column.key === 'contratante_nombre'" :text="row.contratante_nombre || '—'" class="min-w-0 max-w-full" />
            <TruncatedText v-else-if="column.key === 'prestador_nombre'" :text="row.prestador_nombre || '—'" class="min-w-0 max-w-full" />
            <span v-else-if="column.key === 'fecha_inicio'" class="font-mono text-xs text-muted-foreground">{{ fmtFecha(row.fecha_inicio) }}</span>
            <span v-else-if="column.key === 'fecha_fin'" class="font-mono text-xs text-muted-foreground">{{ fmtFecha(row.fecha_fin) }}</span>
            <span v-else-if="column.key === 'estado'" class="inline-flex items-center shrink-0 text-xs font-semibold leading-normal px-1.5 rounded-full whitespace-nowrap" :class="ESTADO_CONTRATO_CLASS[row.estado] || 'bg-muted text-muted-foreground'">
              {{ ESTADO_CONTRATO_LABELS[row.estado] || row.estado || '—' }}
            </span>
            <div v-else-if="column.key === 'falta'" class="flex gap-1">
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanCampos(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    :title="tipFalta(row, 'campos')">
                <ListIcon class="size-4" />{{ faltanCampos(row).length }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold leading-normal px-1.5 rounded-full cursor-default whitespace-nowrap" :class="faltanDocs(row).length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                    :title="tipFalta(row, 'docs')">
                <PaperclipIcon class="size-4" />{{ faltanDocs(row).length }}
              </span>
            </div>
            <div v-else-if="column.key === 'acciones'" class="flex justify-end gap-0">
              <Button variant="ghost" size="icon-sm" class="size-6" :title="row.proyecto ? 'Cambiar de proyecto' : 'Asociar a un proyecto'" @click.stop="abrirAsociarProyecto(row)"><LinkIcon class="size-3.5" /></Button>
              <Button variant="ghost" size="icon-sm" class="size-6" title="Editar" @click.stop="irAEditarContratoServicio(row)"><PencilIcon class="size-3.5" /></Button>
              <Button variant="ghost" size="icon-sm" class="size-6" title="Eliminar" @click.stop="confirmarBorrarContratoServicio(row)"><Trash2Icon class="size-3.5 text-destructive" /></Button>
            </div>
          </template>
        </DataTable>
      </div>
    </div>

    <!-- ── Creación ─────────────────────────────────────────────────────────── -->
    <Dialog v-model:open="dialogCliente">
      <DialogContent class="sm:max-w-lg max-h-dvh overflow-y-auto" @open-auto-focus.prevent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription class="sr-only">Datos del cliente nuevo.</DialogDescription>
        </DialogHeader>
        <ClienteForm :initial="{}" @save="crearCliente" @cancel="dialogCliente = false" />
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="dialogProyecto">
      <DialogContent class="sm:max-w-xl max-h-dvh overflow-y-auto" @open-auto-focus.prevent>
        <DialogHeader>
          <DialogTitle>{{ modoProyecto === 'tsf' ? 'Importar proyecto desde TSF' : 'Nuevo proyecto' }}</DialogTitle>
          <DialogDescription :class="modoProyecto === 'elegir' ? undefined : 'sr-only'">
            {{ modoProyecto === 'elegir' ? '¿De dónde sale la planta?' : 'Datos de la planta nueva.' }}
          </DialogDescription>
        </DialogHeader>
        <!-- Importar desde TSF trae los datos de originabot y los deja en solo
             lectura; desde cero es el formulario de siempre. -->
        <div v-if="modoProyecto === 'elegir'" class="grid gap-3 pt-2 sm:grid-cols-2">
          <button type="button" class="flex flex-col gap-2 rounded-lg border border-border p-4 text-left hover:bg-muted"
            @click="modoProyecto = 'cero'">
            <FilePlusIcon class="size-5 text-primary" />
            <span class="text-sm font-medium">Crear desde cero</span>
            <span class="text-xs text-muted-foreground">Llenas todos los datos a mano.</span>
          </button>
          <button type="button" :disabled="!unergyAuthActivo"
            class="flex flex-col gap-2 rounded-lg border border-border p-4 text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
            @click="modoProyecto = 'tsf'">
            <DownloadIcon class="size-5 text-primary" />
            <span class="text-sm font-medium">Importar desde TSF</span>
            <span class="text-xs text-muted-foreground">
              {{ unergyAuthActivo
                ? 'Buscas el proyecto en originabot y sus datos llegan prellenados.'
                : 'Requiere iniciar sesión con Unergy Auth.' }}
            </span>
          </button>
          <div v-if="unergyAuthActivo" class="flex flex-col gap-2 border-t border-border pt-3 sm:col-span-2">
            <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              En TSF y aún no en Operaciones
              <span v-if="!cargandoSugerencias && !errorSugerencias" class="normal-case font-normal">· construcción u operación</span>
            </p>
            <p v-if="cargandoSugerencias" class="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner class="size-3" /> Revisando los proyectos de TSF…
            </p>
            <p v-else-if="errorSugerencias" class="text-xs text-muted-foreground">{{ errorSugerencias }}</p>
            <p v-else-if="!sugerenciasTsf.length" class="text-xs text-muted-foreground">
              Todos los proyectos de TSF en construcción u operación ya están aquí.
            </p>
            <ul v-else class="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              <li v-for="r in sugerenciasTsf" :key="r.minigranjaId"
                class="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <div class="flex min-w-0 flex-1 flex-col">
                  <TruncatedText :text="r.codigo" class="text-sm font-medium" />
                  <span class="text-xs text-muted-foreground">{{ r.ubicacion || 'Sin ubicación en TSF' }}</span>
                </div>
                <GBadge class="text-xs">{{ r.etapaLabel }}</GBadge>
                <Button size="sm" variant="outline" @click="importarSugerido(r)">
                  <DownloadIcon class="size-4" /> Importar
                </Button>
              </li>
            </ul>
          </div>
        </div>
        <ImportarDesdeTsf v-else-if="modoProyecto === 'tsf' && !proyectoTsf" :proyectos-existentes="proyectos"
          :preseleccion="preseleccionTsf"
          @seleccionar="proyectoTsf = $event" @volver="modoProyecto = 'elegir'; preseleccionTsf = null" />
        <ProyectoForm v-else :key="proyectoTsf?.minigranjaId ?? 'cero'" :importado="proyectoTsf"
          @save="crearProyecto" @cancel="dialogProyecto = false" />
      </DialogContent>
    </Dialog>

    <!-- Asociar un contrato de representación a su planta. Se muestran los datos
         que el contrato trae del acta (nombre de referencia, código Sun Factory)
         porque son la única pista para elegir bien. -->
    <Dialog v-model:open="dialogAsociarProyecto">
      <DialogContent class="sm:max-w-lg" @open-auto-focus.prevent>
        <DialogHeader>
          <DialogTitle>Asociar contrato a un proyecto</DialogTitle>
          <DialogDescription class="sr-only">Elige la planta a la que pertenece el contrato.</DialogDescription>
        </DialogHeader>
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
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-muted-foreground">Planta</label>
            <!-- `key`: el texto del input se calcula al montar; si las plantas llegan
                 después (se piden al abrir), sin volver a montarlo queda vacío aunque
                 haya una planta elegida. -->
            <ComboBox :key="opcionesPlantas.length"
                      :model-value="proyectoElegido != null ? String(proyectoElegido) : null"
                      :options="opcionesPlantas" :disabled="loadingProyectos"
                      :placeholder="loadingProyectos ? 'Cargando plantas…' : 'Buscar planta…'"
                      empty-message="Sin plantas"
                      @update:model-value="v => { proyectoElegido = v ? Number(v) : null }" />
            <p v-if="proyectoSugerido" class="text-xs mt-1 text-muted-foreground">
              Sugerido a partir del {{ proyectoSugerido }}. Verifica antes de guardar.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="dialogAsociarProyecto = false">Cancelar</Button>
          <Button :disabled="!proyectoElegido || guardandoProyecto" @click="guardarProyectoContrato">
            <Spinner v-if="guardandoProyecto" class="size-4" /> Asociar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Un solo diálogo para los dos avisos de nombre parecido: el de proyectos
         y el de clientes. El de clientes no existía --el 409 salía como un toast
         de error sin salida-- y quien lo veía cerraba y escribía el nombre a
         mano, que es justo lo que duplica los clientes. -->
    <Dialog v-model:open="duplicadoVisible">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ duplicadoTipo === 'cliente' ? 'Cliente parecido ya existe' : 'Proyecto parecido ya existe' }}</DialogTitle>
          <DialogDescription>{{ duplicadoInfo?.mensaje }}</DialogDescription>
        </DialogHeader>
        <p v-if="duplicadoInfo?.candidato_nombre" class="text-sm font-medium text-foreground">
          {{ duplicadoInfo.candidato_nombre }}
        </p>
        <DialogFooter>
          <Button variant="ghost" @click="duplicadoVisible = false">Cancelar</Button>
          <Button :disabled="forzando" @click="crearForzado">
            <Spinner v-if="forzando" class="size-4" /> Crear igual
          </Button>
        </DialogFooter>
      </DialogContent>
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
import { ref, reactive, computed, watch, onMounted, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from '~/components/blocks/DataTable.vue'
import { useTablaLocal } from '~/composables/useTablaLocal'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'
import ProyectosPendientesPanel from '~/features/proyectos/components/ProyectosPendientesPanel.vue'
import ProyectosProximosEnergizar from '~/features/proyectos/components/ProyectosProximosEnergizar.vue'
import PortafoliosPanel from '~/features/proyectos/components/PortafoliosPanel.vue'
import { ClientesService } from '~/features/clientes/services/clientes'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { OriginabotService } from '~/features/proyectos/services/originabot'
import { faltanEnOperaciones } from '~/features/proyectos/prellenadoTsf'
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
import { AlignJustifyIcon, BadgeCheckIcon, BuildingIcon, ChartColumnIcon, CheckIcon, ChevronDownIcon, ClockIcon, CopyIcon, DownloadIcon, FilePenIcon, FilePlusIcon, FileSpreadsheetIcon, LayersIcon, LinkIcon, ListIcon, MoveVerticalIcon, PaperclipIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const clientesService = new ClientesService()
const proyectosService = new ProyectosService()
const catalogoPortafolios = useCatalogoPortafolios()
const catalogoProyectos = useProyectosCatalogo()
const ppaService = new PpaService()
const contratosServicioService = new ContratosServicioService()
const serviciosService = new ServiciosService()

// Los formularios y wizards pesan; sólo se descargan cuando alguien crea algo.
const ClienteForm = defineAsyncComponent(() => import('~/features/clientes/components/ClienteForm.vue'))
const ProyectoForm = defineAsyncComponent(() => import('~/features/proyectos/components/ProyectoForm.vue'))
const ImportarDesdeTsf = defineAsyncComponent(() => import('~/features/proyectos/components/ImportarDesdeTsf.vue'))
const PPAContratoWizard = defineAsyncComponent(() => import('~/features/contratos/components/PPAContratoWizard.vue'))
const ContratoServicioWizard = defineAsyncComponent(() => import('~/features/contratos/components/ContratoServicioWizard.vue'))

/**
 * `vistaFija`: la página muestra un solo ángulo, sin el selector Proyectos ·
 * Clientes · Servicios. Así sirven /proyectos, /clientes y /contratos, cada una
 * con su entrada en el menú; /servicios-unificado redirige a ellas.
 */
const props = defineProps({ vistaFija: { type: String, default: null } })

const router = useRouter()
const route = useRoute()
const confirm = useConfirm()

// ── Catálogos ────────────────────────────────────────────────────────────────
const VISTAS = [
  // Proyectos va primero y es el que abre: la planta es la base, y clientes y
  // contratos son formas de mirar ese mismo portafolio.
  { key: 'proyectos', label: 'Proyectos', icon: ZapIcon,      color: 'var(--success)' },
  { key: 'clientes',  label: 'Clientes',  icon: BuildingIcon,  color: 'var(--primary)' },
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
  mantenimiento: 'var(--warning)', arriendo: 'var(--primary)', internet: 'var(--chart-2)',
  representacion: 'var(--chart-3)', cgm: 'var(--chart-1)',
}

// Tinte translúcido de un color del tema (fondos de píldoras y chips activos).
const tinte = (c, pct) => `color-mix(in oklab, ${c} ${pct}%, transparent)`

const colorTipoContrato = (sub) => TIPO_CONTRATO_COLOR[sub] || 'var(--muted-foreground)'

// Los servicios de cada planta: `servicios` de GET /proyectos, calculado de los
// contratos vigentes (antes, las banderas `srv_*` que se prendian a mano).
const SERVICIOS_BADGES = [
  { key: 'operacion',      badge: 'OP',   tooltip: 'Operación' },
  { key: 'representacion', badge: 'REP',  tooltip: 'Reporte de energía producida' },
  { key: 'cgm',            badge: 'CGM',  tooltip: 'Control y gestión de medición' },
  { key: 'ppa',            badge: 'PPA',  tooltip: 'PPA' },
]

const TIPO_LABELS = {
  minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD',
  movilidad_electrica: 'Movilidad', otro: 'Otro',
}
const TIPO_BADGE_CLASS = {
  minigranja: 'bg-success/10 text-success', autoconsumo: 'bg-chart-2/10 text-chart-2', gd: 'bg-primary/10 text-primary',
  movilidad_electrica: 'bg-primary/10 text-primary', otro: 'bg-muted text-muted-foreground',
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
const vista = ref(props.vistaFija ?? (VISTAS_VALIDAS.includes(route.query.vista) ? route.query.vista : 'proyectos'))

// Proyectos: todos, los próximos a energizar (`?ver=proximos`) o los portafolios
// (`?ver=portafolios`): agrupaciones de plantas para los informes, donde una
// planta puede estar en varias. Antes vivían en Informes mensuales, con arrastre.
const VER_PROYECTOS = [
  { key: 'todos', label: 'Todos', icon: ZapIcon },
  { key: 'proximos', label: 'Próximos a energizar', icon: ClockIcon },
  { key: 'portafolios', label: 'Portafolios', icon: LayersIcon },
]
const verProyectos = ref(VER_PROYECTOS.some(o => o.key === route.query.ver) ? route.query.ver : 'todos')
const enProximos = computed(() => props.vistaFija === 'proyectos' && verProyectos.value === 'proximos')
const enPortafolios = computed(() => props.vistaFija === 'proyectos' && verProyectos.value === 'portafolios')

const TITULOS = { proyectos: 'Proyectos', clientes: 'Clientes', servicios: 'Contratos' }
const titulo = computed(() => TITULOS[props.vistaFija] ?? 'Proyectos')
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
watch([vista, servicio, q, filtrosPpa, filtrosServicio, verProyectos], () => {
  const query = {}
  // Con vista fija la página ya dice cuál es (/proyectos, /clientes, /contratos).
  if (vista.value && !props.vistaFija) query.vista = vista.value
  if (enProximos.value || enPortafolios.value) query.ver = verProyectos.value
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

const OPCIONES_POR_PAGINA = [50, 100, 200]
// Lo elegido en el selector de la tabla manda hasta que se cambie la densidad.
const porPagina = ref(filasPorPagina.value)
watch(filasPorPagina, v => { porPagina.value = v })

// ── Densidad ──────────────────────────────────────────────────────────────────
// El objetivo es meter la mayor cantidad de filas y columnas en pantalla sin
// perder legibilidad: celdas de una línea, y lo que no cabe se recorta con
// puntos suspensivos (el dato completo queda en el `title` o en el Excel). El
// botón de la cabecera alterna a "cómoda" para quien prefiera aire.
const CLASE_TABLA_BASE = '[&_th]:whitespace-nowrap [&_th]:overflow-hidden [&_td]:text-xs [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis'
const claseTabla = computed(() => [
  CLASE_TABLA_BASE,
  compacta.value
    ? '[&_th]:h-auto [&_th]:px-1.5 [&_th]:py-0.75 [&_td]:h-auto [&_td]:px-1.5 [&_td]:py-0.25 [&_td]:leading-[1.2]'
    : '[&_th]:h-auto [&_th]:px-2 [&_th]:py-1 [&_td]:h-auto [&_td]:px-2 [&_td]:py-1 [&_td]:leading-[1.3]',
])

// ── Columnas ──────────────────────────────────────────────────────────────────
// La `key` de una columna ordenable es la ruta del campo por el que se ordena
// (con puntos para los anidados): es lo que lee `useTablaLocal`.
const COLUMNAS_CLIENTES = [
  { key: 'razon_social_nombre', header: 'Razón social', sortable: true },
  { key: 'nit_cedula', header: 'NIT', sortable: true },
  { key: 'num_plantas', header: 'Plantas', sortable: true, class: 'text-right' },
  { key: 'servicios', header: 'Servicios' },
  { key: 'contacto_comercial_nombre', header: 'Contacto', sortable: true },
  { key: 'contacto_comercial_correo', header: 'Correo', sortable: true },
  { key: 'falta', header: 'Falta' },
  { key: 'acciones', header: '' },
]
const COLUMNAS_PROYECTOS = [
  { key: 'nombre_comercial', header: 'Nombre comercial', sortable: true },
  { key: 'estado', header: 'Estado', sortable: true },
  { key: 'tipo_proyecto', header: 'Tipo', sortable: true },
  // Una planta puede estar en varios portafolios: se listan todos.
  { key: 'portafolios', header: 'Portafolios' },
  { key: 'municipio', header: 'Ubicación', sortable: true },
  { key: 'info_tecnica.capacidad_instalada_kwp', header: 'kWp', sortable: true, class: 'text-right' },
  { key: 'servicios', header: 'Servicios' },
  { key: 'ppa', header: 'PPA' },
  { key: 'falta', header: 'Falta' },
  { key: 'acciones', header: '' },
]
const COLUMNAS_PPA = [
  { key: 'nombre_interno', header: 'Nombre interno', sortable: true },
  { key: 'numero_codigo_contrato', header: 'N° contrato', sortable: true },
  { key: 'tipo_contrato', header: 'Tipo', sortable: true },
  { key: '_vigencia.orden', header: 'Estado', sortable: true },
  { key: 'comprador_nombre', header: 'Comprador', sortable: true },
  { key: 'vendedor_nombre', header: 'Vendedor', sortable: true },
  { key: 'fecha_inicio', header: 'Inicio', sortable: true },
  { key: 'fecha_fin', header: 'Fin', sortable: true },
  { key: 'cobertura_actual_pct', header: 'Cobertura', sortable: true },
  { key: 'falta', header: 'Falta' },
  { key: 'acciones', header: '' },
]

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
/** La pestaña Servicios de la planta, abierta en el servicio del contrato. */
function rutaDeLaPlanta(contrato, proyectoId = contrato.proyecto?.id) {
  const seccion = ['representacion', 'cgm'].includes(contrato.servicio_aplica) ? 'representacion' : 'operacion'
  return `/proyectos/${proyectoId}?tab=servicios&servicio=${seccion}`
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
  if (data.alerta_contrato === 'vencido') return 'bg-destructive/10'
  if (data.alerta_contrato === 'por_vencer') return 'bg-warning/10'
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
  estado: { value: null },
  tipo_proyecto: { value: null },
  portafolio_id: { value: null },
  ppa_contratos: { value: null },
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
    .map(c => ({ value: String(c.id), label: ppaLabel(c) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  if (sinPpa) opciones.unshift({ value: String(PPA_SIN), label: `Sin PPA (${sinPpa})` })
  return opciones
})

const opcionesPortafolioProyectos = computed(() =>
  portafolios.value.map(pf => ({ value: String(pf.id), label: pf.nombre })))

/** Opciones de un ComboBox de filtro, con «Todos» primero para poder quitarlo. */
function conTodos(opciones) {
  return [{ value: VALOR_SELECT_VACIO, label: 'Todos' }, ...opciones]
}

function nombresPortafolios(proyecto) {
  return (proyecto.portafolios || []).map(pf => pf.nombre).join(', ')
}

const proyectosFiltrados = computed(() => {
  const f = filtrosProyectos.value
  let lista = proyectos.value
  if (f.estado.value)         lista = lista.filter(p => p.estado === f.estado.value)
  if (f.tipo_proyecto.value)  lista = lista.filter(p => p.tipo_proyecto === f.tipo_proyecto.value)
  if (f.portafolio_id.value)  lista = lista.filter(p => (p.portafolios || []).some(pf => pf.id === f.portafolio_id.value))
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

// `fresco` después de crear: el catálogo compartido puede tener hasta 60 s.
async function cargarProyectos({ fresco = false } = {}) {
  loadingProyectos.value = true
  try {
    // allSettled, no all: portafolios solo alimenta el filtro de esa columna.
    // Si esa llamada falla (permisos, error transitorio) no debe tumbar la
    // carga de proyectos, de la que dependen otros flujos -- ej. el selector
    // de "Asociar a un proyecto" en Servicios > Representación, que quedaba
    // sin ninguna planta para elegir cuando portafolios fallaba.
    //
    // Las plantas salen del catálogo compartido (`useProyectosCatalogo`): trae
    // todas las páginas y lo reusan las demás vistas. Antes se pedía una sola
    // página de 500 que el backend corta en 100, y la tabla mostraba 100.
    const [proyectosResult, portafoliosResult] = await Promise.allSettled([
      fresco ? catalogoProyectos.refrescar() : catalogoProyectos.cargar(),
      catalogoPortafolios.cargar(),
    ])
    if (proyectosResult.status === 'fulfilled') {
      proyectos.value = [...proyectosResult.value]
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

// Las columnas de Representación y Operación no son las mismas: ver los
// comentarios de cada una en el template.
const columnasServicio = computed(() => [
  { key: 'proyecto.nombre_comercial', header: 'Proyecto', sortable: true },
  { key: 'proyecto.tipo_proyecto', header: 'Tipo de planta', sortable: true },
  ...(tiposDelServicio.value.length > 1 ? [{ key: 'servicio_aplica', header: 'Tipo', sortable: true }] : []),
  ...(esRepresentacion.value
    ? [
        { key: 'inversionista_nombre', header: 'Inversionista', sortable: true },
        { key: 'numero_contrato', header: 'N° contrato', sortable: true },
      ]
    : [
        { key: 'contratante_nombre', header: 'Contratante', sortable: true },
        { key: 'prestador_nombre', header: 'Prestador', sortable: true },
      ]),
  { key: 'fecha_inicio', header: 'Inicio', sortable: true },
  { key: 'fecha_fin', header: 'Fin', sortable: true },
  { key: 'estado', header: 'Estado', sortable: true },
  { key: 'falta', header: 'Falta' },
  { key: 'acciones', header: '' },
])

// Orden y página de cada tabla. `reactive` para que el template lea los refs
// sin `.value` y pueda usar `v-model` sobre ellos.
const tablaClientes = reactive(useTablaLocal(clientesFiltrados, { key: 'razon_social_nombre', direction: 'asc' }, porPagina))
const tablaProyectos = reactive(useTablaLocal(proyectosFiltrados, { key: 'nombre_comercial', direction: 'asc' }, porPagina))
const tablaPpa = reactive(useTablaLocal(ppaFiltrados, { key: 'fecha_inicio', direction: 'asc' }, porPagina))
const tablaServicios = reactive(useTablaLocal(contratosServicioFiltrados, { key: 'fecha_inicio', direction: 'asc' }, porPagina))

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

const opcionesPlantas = computed(() =>
  proyectos.value.map(p => ({ value: String(p.id), label: p.nombre_comercial || `Proyecto ${p.id}` })))

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
    // El 400 del backend dice por qué: p. ej. el inversionista del contrato no es
    // uno de los de esa planta.
    const motivo = e.data?.inversionista_id?.[0] || e.data?.proyecto_id?.[0] || e.message
    toast.error('No se pudo asociar', { description: motivo, duration: 6000 })
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
  if (enPortafolios.value) return 'Agrupaciones de plantas para los informes · una planta puede estar en varias'
  const etiqueta = vista.value === 'clientes' ? 'clientes'
    : vista.value === 'proyectos' ? 'plantas'
    : `contratos de ${servicioInfo.value?.label}`
  if (enProximos.value) return 'Pipeline de TSF: proyectos en construcción cuya fecha de energización aún no llega'
  return `${filasVisibles.value.length} de ${totalCrudo.value} ${etiqueta}${props.vistaFija ? '' : ' · vista unificada'}`
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
    { header: 'Portafolios', value: p => nombresPortafolios(p) },
    { header: 'Municipio', value: p => p.municipio || '' },
    { header: 'Departamento', value: p => p.departamento || '' },
    { header: 'Inicio comercialización', value: p => p.fecha_inicio_comercializacion ? fmtFecha(p.fecha_inicio_comercializacion) : '' },
    { header: 'Capacidad instalada (kWp)', value: p => p.info_tecnica?.capacidad_instalada_kwp ?? '' },
    { header: 'Potencia AC (kW)', value: p => p.info_tecnica?.potencia_ac_kw ?? '' },
    { header: 'Servicios', value: p => SERVICIOS_BADGES.filter(s => p.servicios?.[s.key]).map(s => s.badge).join(', ') },
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

// Cada contrato tiene su ficha en /contratos/{id}, sea del tipo que sea.
function irAEditarContratoServicio(row) {
  ir(`/contratos/${row.id}`)
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
/** 'elegir' → 'cero' (form vacío) o 'tsf' (buscar en originabot → form prellenado). */
const modoProyecto = ref('elegir')
const proyectoTsf = ref(null)
// originabot valida el token de Unergy Auth: con el login propio no hay con qué.
const unergyAuthActivo = useRuntimeConfig().public.unergyAuthEnabled

function abrirNuevoProyecto() {
  modoProyecto.value = 'elegir'
  proyectoTsf.value = null
  preseleccionTsf.value = null
  dialogProyecto.value = true
  cargarSugerenciasTsf()
}

// Proyectos de TSF en construcción u operación que aún no están aquí: se sugieren
// al abrir «Nuevo proyecto». Qué falta se decide contra las plantas ya cargadas,
// primero por minigranja (`originabot_minifarm_id`) y luego por códigos.
const originabotService = new OriginabotService()
const sugerenciasTsf = ref([])
const cargandoSugerencias = ref(false)
const errorSugerencias = ref('')
const preseleccionTsf = ref(null)

async function cargarSugerenciasTsf() {
  if (!unergyAuthActivo) return
  cargandoSugerencias.value = true
  errorSugerencias.value = ''
  try {
    if (!proyectosCargados.value) await cargarProyectos()
    const enTsf = await originabotService.sugerencias()
    sugerenciasTsf.value = faltanEnOperaciones(enTsf, proyectos.value)
  } catch (e) {
    sugerenciasTsf.value = []
    errorSugerencias.value = mensajeDeError(e, 'No se pudo consultar TSF.')
  } finally {
    cargandoSugerencias.value = false
  }
}

function importarSugerido(resultado) {
  preseleccionTsf.value = resultado
  modoProyecto.value = 'tsf'
}
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
/** `ProyectoForm` emite la lista de inversionistas (puede venir vacía). */
async function vincularInversionistaSiAplica(proyectoId, inversionistas) {
  for (const inversionista of inversionistas ?? []) {
    if (!inversionista?.cliente_id) continue
    try {
      await proyectosService.agregarInversionista(proyectoId, inversionista)
    } catch (e) {
      toast.warning('Proyecto creado, pero un inversionista no se pudo vincular', {
        description: e.data?.detail,
        duration: 5000,
      })
    }
  }
}

async function crearProyecto(payload, infoTecnica, inversionistas) {
  try {
    const proyecto = await proyectosService.crear(payload)
    await guardarInfoTecnicaSiAplica(proyecto.id, infoTecnica)
    await vincularInversionistaSiAplica(proyecto.id, inversionistas)
    toast.success('Proyecto creado', { duration: 3000 })
    dialogProyecto.value = false
    cargarProyectos({ fresco: true })
  } catch (e) {
    const detail = e.data?.detail
    // 409 estructurado = "hay un nombre parecido"; se puede confirmar y crear
    // igual. Distinto de un choque real de columna única (detail es string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      duplicadoTipo.value = 'proyecto'
      pendingPayload.value = payload
      pendingInfoTecnica.value = infoTecnica
      pendingInversionista.value = inversionistas
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
    cargarProyectos({ fresco: true })
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

const opcionesNuevoContrato = computed(() => tiposDelServicio.value.map(t => ({
  tipo: t,
  label: TIPO_CONTRATO_LABELS[t] || t,
})))

function crearContratoDeTipo(tipo) {
  tipoAcrear.value = tipo
  showWizardServicio.value = true
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
</style>
