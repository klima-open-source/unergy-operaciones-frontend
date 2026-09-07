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
        <IconField v-if="vista" class="ph-buscar">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" :placeholder="placeholderBusqueda" size="small" class="w-full" />
        </IconField>
        <Button v-if="vista"
                severity="secondary" outlined size="small"
                v-tooltip.bottom="compacta ? 'Densidad cómoda' : 'Densidad compacta'"
                @click="compacta = !compacta">
          <template #icon><component :is="compacta ? MoveVerticalIcon : AlignJustifyIcon" class="size-[1em]" /></template>
        </Button>
        <Button v-if="vista" label="Excel" severity="secondary" outlined size="small" :disabled="!filasVisibles.length" @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
        <Button v-if="vista === 'clientes'" label="Nuevo cliente" size="small" @click="dialogCliente = true">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else-if="vista === 'proyectos'" label="Nuevo proyecto" size="small" @click="dialogProyecto = true">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else-if="vista === 'servicios' && servicio === 'ppa'" label="Nuevo PPA" size="small" class="bg-amber-500 border-amber-500 hover:bg-amber-600" @click="abrirWizardPPA(null)">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
        <template v-else-if="vista === 'servicios'">
          <Button :label="`Nuevo ${servicioInfo?.label}`"
                  size="small"
                  :style="`background:${servicioInfo?.color}; border-color:${servicioInfo?.color}`"
                  @click="nuevoContrato($event)">
            <template #icon><component :is="tiposDelServicio.length > 1 ? ChevronDownIcon : PlusIcon" class="size-[1em]" /></template>
          </Button>
          <Menu ref="menuNuevoContrato" :model="opcionesNuevoContrato" :popup="true">
            <template #itemicon="{ item }"><component :is="item.icon" class="size-[1em]" /></template>
          </Menu>
        </template>
      </template>
    </PageHeader>

    <!-- Selector de ángulo (nivel 1) + tipo de servicio (nivel 2) -->
    <div class="flex flex-wrap items-center gap-2">
      <button v-for="v in VISTAS" :key="v.key" type="button"
              class="svc-tab" :class="{ 'svc-tab--on': vista === v.key }"
              :style="vista === v.key ? `background:${v.bg}; border-color:${v.color}55; color:${v.color}` : ''"
              @click="seleccionarVista(v.key)">
        <component :is="v.icon" class="size-[1em]" :style="vista === v.key ? `color:${v.color}` : ''" />
        <span>{{ v.label }}</span>
        <span v-if="conteoVista(v.key) !== null" class="svc-tab-count"
              :style="vista === v.key ? `background:${v.color}22; color:${v.color}` : ''">
          {{ conteoVista(v.key) }}
        </span>
      </button>

      <template v-if="vista === 'servicios'">
        <span class="mx-1 h-6 w-px" style="background:#E5E2EC" />
        <button v-for="s in SERVICIOS" :key="s.key" type="button"
                class="svc-tab svc-tab--sm" :class="{ 'svc-tab--on': servicio === s.key }"
                :style="servicio === s.key ? `background:${s.bg}; border-color:${s.color}55; color:${s.color}` : ''"
                @click="seleccionarServicio(s.key)">
          <component :is="s.icon" class="size-[1em]" :style="servicio === s.key ? `color:${s.color}` : ''" />
          <span>{{ s.label }}</span>
        </button>
      </template>
    </div>

    <!-- Agrupar el portafolio: reorganiza las mismas plantas por la dimensión
         que interese, en vez de mandar al usuario a otra tabla. -->
    <div v-if="vista === 'proyectos'" class="flex flex-wrap items-center gap-2">
      <label class="text-xs font-semibold" style="color:#6b5a8a">Agrupar por</label>
      <Select v-model="agruparPor" :options="AGRUPACIONES" optionLabel="label" optionValue="value"
              size="small" class="w-52" />
      <span v-if="agruparPor" class="text-xs" style="color:#9b8fb0">
        {{ nGrupos }} grupo{{ nGrupos === 1 ? '' : 's' }} ·
        {{ proyectosAgrupados.length }} fila{{ proyectosAgrupados.length === 1 ? '' : 's' }}
      </span>
    </div>

    <!-- Sin fila de filtros en ningún ángulo (decisión de 2026-08-20): el
         buscador de la cabecera cubre el caso y la fila le robaba alto a la
         tabla, que es lo que interesa maximizar. Las columnas siguen siendo
         ordenables, así que acotar por estado/tipo se hace con un clic en el
         encabezado. -->

    <!-- ══════════════════ CLIENTES ══════════════════ -->
    <div v-if="vista === 'clientes'" class="tabla-caja">
      <DataTable :value="clientesFiltrados" :loading="loadingClientes" size="small"
                 class="tabla tabla--clickable" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight" :rowClass="rowClassCliente"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="razon_social_nombre" :sortOrder="1" rowHover
                 @row-click="e => ir(`/clientes/${e.data.id}`)"
                 emptyMessage="No hay clientes.">
        <Column field="razon_social_nombre" header="Razón social" sortable style="width:26%">
          <template #body="{ data }">
            <div class="flex items-center gap-1 min-w-0">
              <span class="celda-txt font-semibold" style="color:var(--color-unergy-deep)">
                {{ formatearNombre(data.razon_social_nombre) }}
              </span>
              <span v-if="data.alerta_contrato && data.alerta_contrato !== 'vigente'"
                    class="mini-chip shrink-0"
                    :style="{ color: SEMAFORO[data.alerta_contrato].color, background: SEMAFORO[data.alerta_contrato].bg }">
                {{ SEMAFORO[data.alerta_contrato].label }}
              </span>
            </div>
          </template>
        </Column>
        <Column field="nit_cedula" header="NIT" sortable style="width:9%">
          <template #body="{ data }"><span class="mono">{{ fmt(data.nit_cedula) }}</span></template>
        </Column>
        <Column field="num_plantas" header="Plantas" sortable style="width:6%" bodyStyle="text-align:right">
          <template #body="{ data }">
            <span class="font-semibold tabular-nums" style="color:var(--color-unergy-deep)">{{ data.num_plantas }}</span>
          </template>
        </Column>
        <Column header="Servicios" style="width:15%">
          <template #body="{ data }">
            <div class="chips-fila">
              <span v-for="sv in data.servicios" :key="sv" class="mini-chip"
                    style="background:#f0ebfd;color:var(--color-unergy-purple)">{{ servicioLabel(sv) }}</span>
              <span v-if="!data.servicios?.length" class="vacio">—</span>
            </div>
          </template>
        </Column>
        <Column field="contacto_comercial_nombre" header="Contacto" sortable style="width:14%">
          <template #body="{ data }">
            <span class="celda-txt">{{ fmt(data.contacto_comercial_nombre) }}</span>
          </template>
        </Column>
        <Column field="contacto_comercial_correo" header="Correo" sortable style="width:15%">
          <template #body="{ data }">
            <span class="celda-txt sutil">{{ fmt(data.contacto_comercial_correo) }}</span>
          </template>
        </Column>
        <Column header="Falta" style="width:9%">
          <template #body="{ data }">
            <div class="falta-celda">
              <span class="falta-chip" :class="faltanCampos(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-[1em]" />{{ faltanCampos(data).length }}
              </span>
              <span class="falta-chip" :class="faltanDocs(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-[1em]" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column style="width:6%">
          <template #body="{ data }">
            <div class="acciones">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/clientes/${data.id}`)">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarCliente(data)">
                <template #icon><Trash2Icon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════════════════ PROYECTOS ══════════════════ -->
    <div v-else-if="vista === 'proyectos'" class="tabla-caja">
      <DataTable :value="proyectosAgrupados" :loading="loadingProyectos" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 :sortField="agruparPor ? '__grupo' : 'nombre_comercial'" :sortOrder="1" rowHover
                 :rowGroupMode="agruparPor ? 'subheader' : null"
                 :groupRowsBy="agruparPor ? '__grupo' : null"
                 emptyMessage="No se encontraron proyectos.">
        <template v-if="agruparPor" #groupheader="{ data }">
          <span class="grupo-titulo">{{ data.__grupo }}</span>
          <span class="grupo-conteo">{{ conteoGrupo(data.__grupo) }}</span>
        </template>
        <Column field="nombre_comercial" header="Nombre comercial" sortable style="width:21%">
          <template #body="{ data }">
            <span class="block text-[9px] leading-none mono"
                  :style="{ color: data.codigo_tsf ? '#9ca3af' : '#d1d5db' }">
              {{ data.codigo_tsf || '—' }}
            </span>
            <button type="button" class="nombre-link" @click="ir(`/proyectos/${data.id}`)"
                    v-tooltip.bottom="'Ver detalle'">
              {{ formatearNombre(data.nombre_comercial) }}
            </button>
          </template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width:10%">
          <template #body="{ data }">
            <span class="mini-chip inline-flex items-center gap-1"
                  :class="ESTADO_CLASS[data.estado] || 'estado-default'">
              <span v-if="data.estado === 'en_operacion'" class="pulse-dot" />
              {{ ESTADO_LABELS[data.estado] || data.estado || '—' }}
            </span>
          </template>
        </Column>
        <Column field="tipo_proyecto" header="Tipo" sortable style="width:9%">
          <template #body="{ data }">
            <span class="mini-chip" :class="TIPO_BADGE_CLASS[data.tipo_proyecto] || 'badge-otro'">
              {{ TIPO_LABELS[data.tipo_proyecto] || data.tipo_proyecto || '—' }}
            </span>
          </template>
        </Column>
        <Column field="municipio" header="Ubicación" sortable style="width:12%">
          <template #body="{ data }">
            <span v-if="data.municipio || data.departamento" class="celda-txt sutil"
                  v-tooltip.bottom="[data.municipio, data.departamento].filter(Boolean).join(', ')">
              {{ [data.municipio, data.departamento].filter(Boolean).join(', ') }}
            </span>
            <span v-else class="vacio">—</span>
          </template>
        </Column>
        <Column field="info_tecnica.capacidad_instalada_kwp" header="kWp" sortable
                style="width:7%" bodyStyle="text-align:right">
          <template #body="{ data }">
            <span class="mono" v-tooltip.bottom="`AC: ${num(data.info_tecnica?.potencia_ac_kw)} kW`">
              {{ num(data.info_tecnica?.capacidad_instalada_kwp) }}
            </span>
          </template>
        </Column>
        <Column header="Servicios" style="width:12%">
          <template #body="{ data }">
            <div class="chips-fila">
              <template v-for="srv in SERVICIOS_BADGES" :key="srv.key">
                <span v-if="data[srv.key]" class="mini-chip srv-badge"
                      v-tooltip.bottom="srv.tooltip">{{ srv.badge }}</span>
              </template>
              <span v-if="!SERVICIOS_BADGES.some(sb => data[sb.key])" class="vacio">—</span>
            </div>
          </template>
        </Column>
        <Column header="PPA" style="width:14%">
          <template #body="{ data }">
            <div v-if="ppaVigentes(data).length" class="chips-fila">
              <button v-for="c in ppaVigentes(data)" :key="c.id" type="button" class="ppa-chip"
                      v-tooltip.bottom="ppaTooltip(c)" @click="ir(`/proyectos/${data.id}/ppa`)">
                {{ ppaLabel(c) }}
              </button>
            </div>
            <span v-else class="vacio">—</span>
          </template>
        </Column>
        <Column header="Falta" style="width:9%">
          <template #body="{ data }">
            <div class="falta-celda">
              <span class="falta-chip" :class="faltanCampos(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-[1em]" />{{ faltanCampos(data).length }}
              </span>
              <span class="falta-chip" :class="faltanDocs(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-[1em]" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column style="width:6%">
          <template #body="{ data }">
            <div class="acciones">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/proyectos/${data.id}?edit=true`)">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarProyecto(data)">
                <template #icon><Trash2Icon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════════════════ SERVICIOS · PPA ══════════════════ -->
    <div v-else-if="servicio === 'ppa'" class="tabla-caja">
      <DataTable :value="ppaFiltrados" :loading="loadingPpa" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="fecha_inicio" :sortOrder="1" rowHover
                 emptyMessage="No hay contratos PPA registrados.">
        <Column field="nombre_interno" header="Nombre interno" sortable style="width:16%">
          <template #body="{ data }">
            <button type="button" class="nombre-link" @click="ir(`/contratos/${data.id}`)"
                    v-tooltip.bottom="'Ver detalle'">
              {{ data.nombre_interno || data.numero_codigo_contrato || '—' }}
            </button>
          </template>
        </Column>
        <Column field="numero_codigo_contrato" header="N° contrato" sortable style="width:9%">
          <template #body="{ data }">
            <span v-if="data.numero_codigo_contrato" class="mono celda-txt"
                  v-tooltip.bottom="data.numero_codigo_contrato">
              {{ data.numero_codigo_contrato }}
            </span>
            <span v-else class="vacio">—</span>
          </template>
        </Column>
        <Column field="tipo_contrato" header="Tipo" sortable style="width:6%">
          <template #body="{ data }">
            <span class="mini-chip"
                  :style="data.tipo_contrato === 'compra'
                    ? 'background:var(--color-unergy-purple);color:#fff'
                    : 'background:var(--color-unergy-yellow);color:var(--color-unergy-deep)'">
              {{ data.tipo_contrato === 'compra' ? 'Compra' : 'Venta' }}
            </span>
          </template>
        </Column>
        <!-- Estado de vigencia: derivado de las fechas, mismo cálculo que el
             detalle del contrato (utils/ppaVigencia.js). Ordena por urgencia. -->
        <Column field="_vigencia.orden" header="Estado" sortable style="width:8%">
          <template #body="{ data }">
            <span class="mini-chip"
                  :style="`background:${data._vigencia.bg};color:${data._vigencia.color}`"
                  v-tooltip.bottom="data._vigencia.detalle">
              {{ data._vigencia.label }}
            </span>
          </template>
        </Column>
        <Column field="comprador_nombre" header="Comprador" sortable style="width:14%">
          <template #body="{ data }">
            <span class="celda-txt">{{ data.comprador_nombre || '—' }}</span>
          </template>
        </Column>
        <Column field="vendedor_nombre" header="Vendedor" sortable style="width:14%">
          <template #body="{ data }">
            <span class="celda-txt">{{ data.vendedor_nombre || '—' }}</span>
          </template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable style="width:7%">
          <template #body="{ data }"><span class="mono">{{ fmtFecha(data.fecha_inicio) }}</span></template>
        </Column>
        <!-- Resaltado y tooltip salen de _vigencia, no de dias_restantes: el
             listado de /ppa devuelve las filas del ORM y ese campo llega null,
             así que este aviso nunca se veía. -->
        <Column field="fecha_fin" header="Fin" sortable style="width:7%">
          <template #body="{ data }">
            <span class="mono"
                  :style="['vencido', 'por_vencer'].includes(data._vigencia.clave)
                    ? { color: data._vigencia.color, fontWeight: 700 } : null"
                  v-tooltip.bottom="data._vigencia.detalle">
              {{ fmtFecha(data.fecha_fin) }}
            </span>
          </template>
        </Column>
        <Column field="cobertura_actual_pct" header="Cobertura" sortable style="width:8%">
          <template #body="{ data }">
            <div v-if="data.cobertura_actual_pct != null" class="flex items-center gap-1">
              <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:#f3f0f7">
                <div class="h-full rounded-full" :style="{
                  width: Math.min(data.cobertura_actual_pct, 100) + '%',
                  backgroundColor: data.cobertura_actual_pct >= 90 ? '#10B981'
                    : data.cobertura_actual_pct >= 70 ? '#F0C040' : '#D64455' }" />
              </div>
              <span class="mono">{{ data.cobertura_actual_pct }}%</span>
            </div>
            <span v-else class="vacio">—</span>
          </template>
        </Column>
        <Column header="Falta" style="width:6%">
          <template #body="{ data }">
            <div class="falta-celda">
              <span class="falta-chip" :class="faltanCampos(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-[1em]" />{{ faltanCampos(data).length }}
              </span>
              <span class="falta-chip" :class="faltanDocs(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-[1em]" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column style="width:5%">
          <template #body="{ data }">
            <div class="acciones">
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="ir(`/contratos/${data.id}`)">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarPpa(data)">
                <template #icon><Trash2Icon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ══════ SERVICIOS · REPRESENTACIÓN / OPERACIÓN / REC ══════
         Los tres son contratos de `contratos_servicio`; Operación agrupa
         mantenimiento, arriendo e internet, así que lleva columna Tipo. -->
    <div v-else class="tabla-caja">
      <!-- Todo contrato de representación pertenece a una planta. Los que no la
           tienen son un error de datos, no un estado válido: la barra los cuenta
           y deja aislarlos para irlos cerrando hasta llegar a cero. -->
      <div v-if="esRepresentacion && nHuerfanos" class="barra-huerfanos">
        <TriangleAlertIcon class="size-[1em]" />
        <span><strong>{{ nHuerfanos }}</strong> de {{ contratosServicio.length }} contratos sin proyecto asociado</span>
        <Button :label="soloHuerfanos ? 'Ver todos' : 'Ver solo estos'" text size="small"
                class="ml-auto" @click="soloHuerfanos = !soloHuerfanos" />
      </div>

      <!-- Duplicados: el mismo contrato escrito por varias fuentes. Se limpian
           desde acá porque ir planta por planta no es viable con 126 contratos. -->
      <div v-if="esRepresentacion && nDuplicados" class="barra-duplicados">
        <CopyIcon class="size-[1em]" />
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
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </div>
      <DataTable :value="contratosServicioFiltrados" :loading="loadingServicio" size="small"
                 class="tabla" :class="{ 'tabla--compacta': compacta }"
                 scrollable :scrollHeight="scrollHeight"
                 paginator :rows="filasPorPagina" :rowsPerPageOptions="[50, 100, 200]"
                 sortField="fecha_inicio" :sortOrder="1" rowHover
                 :emptyMessage="`No hay contratos de ${servicioInfo?.label} registrados.`">
        <Column v-if="tiposDelServicio.length > 1" field="servicio_aplica" header="Tipo"
                sortable style="width:11%">
          <template #body="{ data }">
            <span class="mini-chip" :style="{
              color: TIPO_CONTRATO_COLOR[data.servicio_aplica] || '#6b7280',
              background: (TIPO_CONTRATO_COLOR[data.servicio_aplica] || '#6b7280') + '1f' }">
              {{ TIPO_CONTRATO_LABELS[data.servicio_aplica] || data.servicio_aplica || '—' }}
            </span>
          </template>
        </Column>
        <!-- Proyecto: un contrato de representación se firma SOBRE una planta,
             así que sin esta columna la tabla no dice de qué habla cada fila.
             Cuando el contrato quedó huérfano (proyecto_id NULL) la celda es el
             botón para arreglarlo, en vez de un "—" que no lleva a ninguna
             parte. -->
        <Column v-if="esRepresentacion" field="proyecto.nombre_comercial" header="Proyecto"
                sortable style="width:24%">
          <template #body="{ data }">
            <button v-if="data.proyecto" type="button" class="celda-enlace"
                    v-tooltip.bottom="'Ver representación de la planta'"
                    @click.stop="ir(`/proyectos/${data.proyecto.id}/representacion`)">
              <span class="celda-txt font-semibold">{{ data.proyecto.nombre_comercial }}</span>
              <span class="mini-chip shrink-0"
                    :class="TIPO_BADGE_CLASS[data.proyecto.tipo_proyecto] || 'badge-otro'">
                {{ TIPO_LABELS[data.proyecto.tipo_proyecto] || data.proyecto.tipo_proyecto || 'Sin tipo' }}
              </span>
            </button>
            <button v-else type="button" class="chip-huerfano"
                    v-tooltip.bottom="'Este contrato no está asociado a ninguna planta. Click para asociarlo.'"
                    @click.stop="abrirAsociarProyecto(data)">
              <LinkIcon class="size-[1em]" />Sin proyecto
            </button>
          </template>
        </Column>
        <!-- El inversionista es lo que distingue dos contratos de la misma
             planta: La Reserva tiene dos, Baraya tres. -->
        <Column v-if="esRepresentacion" field="inversionista_nombre" header="Inversionista"
                sortable style="width:20%">
          <template #body="{ data }">
            <span class="celda-txt">
              {{ data.inversionista_nombre ? formatearNombre(data.inversionista_nombre) : '—' }}
            </span>
          </template>
        </Column>
        <Column field="numero_contrato" header="N° contrato" sortable
                :style="esRepresentacion ? 'width:11%' : 'width:15%'">
          <template #body="{ data }"><span class="celda-txt mono">{{ data.numero_contrato || '—' }}</span></template>
        </Column>
        <!-- Contratante y prestador salen del cuadro en Representación: el seed
             CGM no los llena y el par real es Unergy ↔ inversionista, que ya
             tiene columna propia. El buscador sí sigue mirándolos. -->
        <Column v-if="!esRepresentacion" field="contratante_nombre" header="Contratante" sortable style="width:21%">
          <template #body="{ data }"><span class="celda-txt">{{ data.contratante_nombre || '—' }}</span></template>
        </Column>
        <Column v-if="!esRepresentacion" field="prestador_nombre" header="Prestador" sortable style="width:21%">
          <template #body="{ data }"><span class="celda-txt">{{ data.prestador_nombre || '—' }}</span></template>
        </Column>
        <Column field="fecha_inicio" header="Inicio" sortable style="width:8%">
          <template #body="{ data }"><span class="mono">{{ fmtFecha(data.fecha_inicio) }}</span></template>
        </Column>
        <Column field="fecha_fin" header="Fin" sortable style="width:8%">
          <template #body="{ data }"><span class="mono">{{ fmtFecha(data.fecha_fin) }}</span></template>
        </Column>
        <Column field="estado" header="Estado" sortable style="width:12%">
          <template #body="{ data }">
            <span class="mini-chip" :class="ESTADO_CONTRATO_CLASS[data.estado] || 'chip-neutral'">
              {{ ESTADO_CONTRATO_LABELS[data.estado] || data.estado || '—' }}
            </span>
          </template>
        </Column>
        <Column header="Falta" style="width:9%">
          <template #body="{ data }">
            <div class="falta-celda">
              <span class="falta-chip" :class="faltanCampos(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'campos')">
                <ListIcon class="size-[1em]" />{{ faltanCampos(data).length }}
              </span>
              <span class="falta-chip" :class="faltanDocs(data).length ? 'falta--mal' : 'falta--ok'"
                    v-tooltip.bottom="tipFalta(data, 'docs')">
                <PaperclipIcon class="size-[1em]" />{{ faltanDocs(data).length }}
              </span>
            </div>
          </template>
        </Column>
        <Column :style="esRepresentacion ? 'width:8%' : 'width:6%'">
          <template #body="{ data }">
            <div class="acciones">
              <Button v-if="esRepresentacion" text size="small" severity="secondary" v-tooltip.bottom="data.proyecto ? 'Cambiar de proyecto' : 'Asociar a un proyecto'" @click.stop="abrirAsociarProyecto(data)">
                <template #icon><LinkIcon class="size-[1em]" /></template>
              </Button>
              <Button text size="small" severity="secondary" v-tooltip.bottom="'Editar'" @click.stop="irAEditarContratoServicio(data)">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <Button text size="small" severity="danger" v-tooltip.bottom="'Eliminar'" @click.stop="confirmarBorrarContratoServicio(data)">
                <template #icon><Trash2Icon class="size-[1em]" /></template>
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
        <div class="rounded-lg p-3 text-xs space-y-0.5" style="background:#F7F5FB; color:#6b5a8a">
          <p><span class="font-semibold">Inversionista:</span>
            {{ contratoAAsociar.inversionista_nombre || '—' }}</p>
          <p><span class="font-semibold">Proyecto según el contrato:</span>
            {{ contratoAAsociar.nombre_proyecto_ref || '—' }}</p>
          <p><span class="font-semibold">Código Sun Factory:</span>
            {{ contratoAAsociar.codigo_sun_factory || '—' }}</p>
        </div>
        <div>
          <label class="text-xs font-semibold" style="color:#6b5a8a">Planta</label>
          <Select v-model="proyectoElegido" :options="proyectos" optionLabel="nombre_comercial"
                  optionValue="id" filter :loading="loadingProyectos" size="small" class="w-full mt-1"
                  placeholder="Buscar planta…" filterPlaceholder="Escribe para filtrar…" />
          <p v-if="proyectoSugerido" class="text-[11px] mt-1" style="color:#9b8fb0">
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

    <Dialog v-model:visible="duplicadoVisible" header="Proyecto parecido ya existe" modal class="w-full max-w-sm">
      <p class="text-sm text-gray-600">{{ duplicadoInfo?.mensaje }}</p>
      <p v-if="duplicadoInfo?.candidato_nombre" class="text-sm mt-2 font-medium" style="color:var(--color-unergy-deep)">
        {{ duplicadoInfo.candidato_nombre }}
      </p>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="duplicadoVisible = false" />
        <Button label="Crear igual" :loading="forzando" @click="crearProyectoForzado" />
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
import Menu from 'primevue/menu'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { ClientesService } from '~/features/clientes/services/clientes'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { PpaService } from '~/features/contratos/services/ppa'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { formatearNombre } from '~/utils/nombreFormato'
import { exportarExcel } from '~/utils/exportarExcel'
import { estadoVigenciaPPA } from '~/features/contratos/utils/ppaVigencia'
import { SEMAFORO, servicioLabel, fmt } from '~/features/clientes/components/clientesUi'
import { AlignJustifyIcon, BadgeCheckIcon, BuildingIcon, ChartColumnIcon, CheckIcon, ChevronDownIcon, CopyIcon, FilePenIcon, FileSpreadsheetIcon, LinkIcon, ListIcon, MoveVerticalIcon, PaperclipIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const clientesService = new ClientesService()
const proyectosService = new ProyectosService()
const ppaService = new PpaService()
const contratosServicioService = new ContratosServicioService()

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
  { key: 'proyectos', label: 'Proyectos', icon: ZapIcon,      color: '#10b981', bg: '#f0fdf4' },
  { key: 'clientes',  label: 'Clientes',  icon: BuildingIcon,  color: '#915BD8', bg: '#f5f0fd' },
  { key: 'servicios', label: 'Servicios', icon: FilePenIcon, color: '#0C447C', bg: '#eff6ff' },
]

const SERVICIOS = [
  { key: 'ppa',            label: 'PPA',            icon: ZapIcon,      color: '#f59e0b', bg: '#fffbeb' },
  { key: 'representacion', label: 'Representación', icon: FilePenIcon, color: '#3b82f6', bg: '#eff6ff' },
  { key: 'operacion',      label: 'Operación',      icon: ChartColumnIcon, color: '#10b981', bg: '#f0fdf4' },
  { key: 'rec',            label: 'REC',            icon: BadgeCheckIcon,  color: '#14b8a6', bg: '#f0fdfa' },
]

// El enum `servicio_aplica` del backend NO tiene un valor "operacion": lo que
// se firma por planta son tres contratos distintos -- mantenimiento, arriendo e
// internet -- que es como los pide OperacionView.vue. Pedir ?tipo=operacion
// devolvia siempre 0 filas y dejaba 65 contratos reales sin ninguna pestana, asi
// que Operacion junta los tres y los distingue con la columna Tipo.
const TIPOS_POR_SERVICIO = {
  representacion: ['representacion'],
  operacion: ['mantenimiento', 'arriendo', 'internet'],
  rec: ['rec'],
}

const TIPO_CONTRATO_LABELS = {
  mantenimiento: 'Mantenimiento', arriendo: 'Arriendo', internet: 'Internet',
  representacion: 'Representación', rec: 'REC',
}
const TIPO_CONTRATO_COLOR = {
  mantenimiento: '#f59e0b', arriendo: '#8b5cf6', internet: '#06b6d4',
  representacion: '#3b82f6', rec: '#14b8a6',
}

const SERVICIOS_BADGES = [
  { key: 'srv_operacion',      badge: 'OP',   tooltip: 'Operación' },
  { key: 'srv_representacion', badge: 'REP',  tooltip: 'Reporte de energía producida' },
  { key: 'srv_cgm',            badge: 'CGM',  tooltip: 'Control y gestión de medición' },
  { key: 'srv_ppa',            badge: 'PPA',  tooltip: 'PPA' },
  { key: 'srv_promotor',       badge: 'PROM', tooltip: 'Promotor' },
  { key: 'srv_rec',            badge: 'REC',  tooltip: 'REC' },
]

const TIPO_LABELS = {
  minigranja: 'Minigranja', autoconsumo: 'Autoconsumo', gd: 'GD',
  movilidad_electrica: 'Movilidad', otro: 'Otro',
}
const TIPO_BADGE_CLASS = {
  minigranja: 'badge-minigranja', autoconsumo: 'badge-autoconsumo', gd: 'badge-gd',
  movilidad_electrica: 'badge-movilidad', otro: 'badge-otro',
}
const ESTADO_LABELS = {
  en_operacion: 'En operación', en_desarrollo: 'En desarrollo', suspendido: 'Suspendido',
  cancelado: 'Cancelado', en_construccion: 'En construcción',
}
const ESTADO_CLASS = {
  en_operacion: 'estado-operacion', suspendido: 'estado-suspendido',
  en_construccion: 'estado-construccion', en_desarrollo: 'estado-default', cancelado: 'estado-default',
}
const CUMPLIMIENTO_LABELS = { on_track: 'Al día', at_risk: 'En riesgo', deficit: 'Déficit' }
const CUMPLIMIENTO_CLASS = { on_track: 'chip-ok', at_risk: 'chip-warn', deficit: 'chip-danger' }
const ESTADO_CONTRATO_LABELS = {
  vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación',
}
// Chips propios en vez de <Tag>: los estilos de PrimeVue se inyectan después de
// Tailwind y ganan el empate de especificidad, así que un Tag no se deja
// encoger a la tipografía compacta del resto de la tabla.
const ESTADO_CONTRATO_CLASS = {
  vigente: 'chip-ok', vencido: 'chip-danger', terminado: 'chip-neutral', en_renovacion: 'chip-warn',
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

// El watch que sincroniza la URL vive mas abajo, junto a `agruparPor`: watch()
// evalua su arreglo de fuentes en el acto, asi que nombrar ahi una const que
// todavia no se declaro rompe la vista entera al montarla.

const filasPorPagina = computed(() => (compacta.value ? 100 : 50))
// Los filtros de Proyectos ocupan una fila extra, así que la tabla dispone de
// algo menos de alto que en los demás ángulos.
// Ningún ángulo lleva fila de filtros, así que todos disponen del mismo alto.
const scrollHeight = 'calc(100vh - 250px)'



// ── Agrupar el portafolio ─────────────────────────────────────────────────────
// Cliente, PPA y Servicio son multivaluados: una planta puede tener dos
// inversionistas o estar en dos PPA. En esos casos la planta aparece en cada
// grupo al que pertenece, que es justo lo que se quiere ver -- por eso la lista
// agrupada puede tener MAS filas que plantas, y el contador de arriba lo dice.
const AGRUPACIONES = [
  { value: '',             label: 'Sin agrupar' },
  { value: 'cliente',      label: 'Cliente / inversionista' },
  { value: 'ppa',          label: 'Contrato PPA' },
  { value: 'servicio',     label: 'Servicio' },
  { value: 'tipo',         label: 'Tipo de proyecto' },
  { value: 'estado',       label: 'Estado' },
  { value: 'departamento', label: 'Departamento' },
]

const agruparPor = ref(AGRUPACIONES.some(a => a.value === route.query.grupo) ? route.query.grupo : '')

// Los filtros se sincronizan con la URL para poder compartir la vista tal cual
// se esta viendo. Tiene que ir despues de `agruparPor`: es una de sus fuentes.
watch([vista, servicio, q, agruparPor], () => {
  const query = {}
  if (vista.value) query.vista = vista.value
  if (vista.value === 'proyectos' && agruparPor.value) query.grupo = agruparPor.value
  if (vista.value === 'servicios') query.srv = servicio.value
  if (q.value) query.q = q.value
  router.replace({ query })
})

const SIN_DATO = 'Sin asignar'

// Tope de `size` en /proyectos y /clientes: 501 devuelve 422, no una lista
// corta. Mientras no haya paginacion de servidor, avisamos si se corta.
const TOPE_PAGINA = 500

function avisarSiTrunca(total, mostrados, etiqueta) {
  if (total == null || total <= mostrados) return
  toast.warning('Listado incompleto', {
    description: `Se muestran ${mostrados} de ${total} ${etiqueta}: la vista pide como máximo ${TOPE_PAGINA}.`,
    duration: 8000,
  })
}

// Devuelve los grupos a los que pertenece una planta (uno o varios).
function gruposDe(p) {
  switch (agruparPor.value) {
    case 'cliente': {
      const n = (p.inversionistas || []).map(i => i.cliente_nombre).filter(Boolean)
      return n.length ? [...new Set(n)] : [SIN_DATO]
    }
    case 'ppa': {
      const n = ppaVigentes(p).map(ppaLabel).filter(Boolean)
      return n.length ? [...new Set(n)] : ['Sin PPA']
    }
    case 'servicio': {
      const n = SERVICIOS_BADGES.filter(sb => p[sb.key]).map(sb => sb.tooltip)
      return n.length ? n : ['Sin servicios']
    }
    case 'tipo':
      return [TIPO_LABELS[p.tipo_proyecto] || p.tipo_proyecto || SIN_DATO]
    case 'estado':
      return [ESTADO_LABELS[p.estado] || p.estado || SIN_DATO]
    case 'departamento':
      return [p.departamento || SIN_DATO]
    default:
      return []
  }
}

const proyectosAgrupados = computed(() => {
  if (!agruparPor.value) return proyectosFiltrados.value
  const filas = []
  for (const p of proyectosFiltrados.value) {
    for (const g of gruposDe(p)) filas.push({ ...p, __grupo: g })
  }
  // PrimeVue pinta subencabezados solo si las filas del grupo vienen juntas.
  // "Sin asignar" / "Sin PPA" al final: son el pendiente, no el encabezado.
  return filas.sort((a, b) => {
    const av = a.__grupo.startsWith('Sin ') ? 1 : 0
    const bv = b.__grupo.startsWith('Sin ') ? 1 : 0
    if (av !== bv) return av - bv
    const g = a.__grupo.localeCompare(b.__grupo)
    return g !== 0 ? g : (a.nombre_comercial || '').localeCompare(b.nombre_comercial || '')
  })
})

const conteosPorGrupo = computed(() => {
  const m = new Map()
  for (const f of proyectosAgrupados.value) m.set(f.__grupo, (m.get(f.__grupo) || 0) + 1)
  return m
})

function conteoGrupo(g) { return conteosPorGrupo.value.get(g) || 0 }
const nGrupos = computed(() => conteosPorGrupo.value.size)

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

const proyectosFiltrados = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (!t) return proyectos.value
  return proyectos.value.filter(p =>
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
    const data = await proyectosService.listarPaginado({ page: 1, size: TOPE_PAGINA })
    proyectos.value = data.items ?? []
    avisarSiTrunca(data.total, proyectos.value.length, 'plantas')
    proyectosCargados.value = true
  } catch (e) {
    toast.error('Error al cargar proyectos', { description: e.message, duration: 4000 })
  } finally {
    loadingProyectos.value = false
  }
}

// ── Servicios · PPA ──────────────────────────────────────────────────────────
const ppa = ref([])
const loadingPpa = ref(false)
const ppaCargados = ref(false)

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
  return base.map(c => ({ ...c, _vigencia: estadoVigenciaPPA(c) }))
})

async function cargarPpa() {
  loadingPpa.value = true
  try {
    ppa.value = await ppaService.listar()
    ppaCargados.value = true
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

// Representación es el único servicio con columnas propias (proyecto e
// inversionista en lugar de contratante y prestador), así que la bandera se
// nombra una vez y la usan el template y los filtros.
const esRepresentacion = computed(() => servicio.value === 'representacion')

// Contratos de representación sin planta asociada: son datos por corregir, no
// una categoría del negocio. `soloHuerfanos` los aísla para poder cerrarlos.
const soloHuerfanos = ref(false)

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

const contratosServicioFiltrados = computed(() => {
  let base = contratosServicio.value
  if (esRepresentacion.value && soloHuerfanos.value) base = base.filter(c => !c.proyecto_id)
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
    soloHuerfanos.value = false
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
function sugerirProyecto(contrato) {
  const sf = (contrato.codigo_sun_factory || '').trim().toLowerCase()
  if (sf) {
    const porTsf = proyectos.value.find(p => (p.codigo_tsf || '').trim().toLowerCase() === sf)
    if (porTsf) {
      proyectoElegido.value = porTsf.id
      proyectoSugerido.value = `código Sun Factory ${contrato.codigo_sun_factory}`
      return
    }
  }
  const ref_ = contrato.nombre_proyecto_ref || ''
  for (const num of ref_.match(/\d{4}/g) || []) {
    const porNum = proyectos.value.find(p => (p.nombre_comercial || '').includes(num))
    if (porNum) {
      proyectoElegido.value = porNum.id
      proyectoSugerido.value = `número ${num} de "${ref_}"`
      return
    }
  }
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

// Tipos reales de `servicio_aplica` que alimentan la pestana activa.
const tiposDelServicio = computed(() => TIPOS_POR_SERVICIO[servicio.value] || [servicio.value])

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
  servicio.value = key
  asegurarDatos()
}

// Solo se pide lo de la vista elegida. Entrar sin ?vista= no dispara ninguna
// peticion: la pagina espera en el selector. Los contadores de cada pestana
// aparecen a medida que se visitan, no de entrada.
onMounted(asegurarDatos)

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

async function crearCliente(payload) {
  try {
    const cliente = await clientesService.crear(payload)
    toast.success('Cliente creado', { duration: 3000 })
    dialogCliente.value = false
    router.push(`/clientes/${cliente.id}`)
  } catch (e) {
    toast.error('Error', { description: e.data?.detail, duration: 4000 })
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
const pendingPayload = ref(null)
const pendingInfoTecnica = ref(null)
const forzando = ref(false)

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

async function crearProyecto(payload, infoTecnica) {
  try {
    const proyecto = await proyectosService.crear(payload)
    await guardarInfoTecnicaSiAplica(proyecto.id, infoTecnica)
    toast.success('Proyecto creado', { duration: 3000 })
    dialogProyecto.value = false
    cargarProyectos()
  } catch (e) {
    const detail = e.data?.detail
    // 409 estructurado = "hay un nombre parecido"; se puede confirmar y crear
    // igual. Distinto de un choque real de columna única (detail es string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      pendingPayload.value = payload
      pendingInfoTecnica.value = infoTecnica
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
/* ── Selector de ángulo ─────────────────────────────────────────────────────── */
.svc-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid #E5E2EC; border-radius: 9px;
  background: #fff; font-size: 13px; font-weight: 700; color: #6b7280;
  cursor: pointer; transition: border-color .12s, color .12s, background .12s; user-select: none;
}
.svc-tab:hover { border-color: #cbb8e8; color: var(--color-unergy-deep); }
.svc-tab svg { font-size: 13px; color: #9ca3af; }
.svc-tab--on { box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.svc-tab--sm { padding: 4px 9px; font-size: 12px; font-weight: 600; }
.svc-tab--sm svg { font-size: 11px; }
.svc-tab-count {
  background: #EEF0F2; color: #6b7280; border-radius: 999px;
  font-size: 10px; font-weight: 800; padding: 0 6px; min-width: 18px; text-align: center;
}

/* ── Buscador de la cabecera ─────────────────────────────────────
   Angosto a propósito: cada píxel que ocupa la cabecera se lo quita a la tabla,
   y lo que se teclea acá suele ser una palabra. En móvil pasa a ancho completo. */
.ph-buscar { width: 100%; }
@media (min-width: 640px) { .ph-buscar { width: 190px; } }

/* ── Caja de la tabla ──────────────────────────────────────────────────────── */
.tabla-caja {
  background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}

/* ── Densidad ──────────────────────────────────────────────────────────────────
   El objetivo es meter la mayor cantidad de filas y columnas en pantalla sin
   perder legibilidad: encabezado en versalitas chicas, celdas de una línea. El
   botón de la cabecera alterna a "cómoda" para quien prefiera aire.          */
.tabla :deep(.p-datatable-thead > tr > th) {
  padding: 5px 8px; font-size: 10px; font-weight: 700; letter-spacing: .04em;
  text-transform: uppercase; color: #8b7fa3; background: #FAF9FC; white-space: nowrap;
}
.tabla :deep(.p-datatable-tbody > tr > td) {
  padding: 4px 8px; font-size: 12px; line-height: 1.3; white-space: nowrap;
}
.tabla--compacta :deep(.p-datatable-thead > tr > th) { padding: 3px 6px; font-size: 9.5px; }
.tabla--compacta :deep(.p-datatable-tbody > tr > td) { padding: 1px 6px; font-size: 11px; line-height: 1.2; }
.tabla :deep(.p-datatable-tbody > tr > td .p-button) { width: 1.5rem; height: 1.5rem; }
.tabla :deep(.p-datatable-tbody > tr > td .p-button .p-button-icon) { font-size: .7rem; }
.tabla :deep(.p-paginator) { padding: 2px 6px; font-size: 12px; border-top: 1px solid #F1EDF7; }
.tabla :deep(.p-paginator .p-paginator-page),
.tabla :deep(.p-paginator .p-paginator-first),
.tabla :deep(.p-paginator .p-paginator-prev),
.tabla :deep(.p-paginator .p-paginator-next),
.tabla :deep(.p-paginator .p-paginator-last) { min-width: 1.75rem; height: 1.75rem; }
.tabla :deep(.p-datatable-sort-icon) { width: .65rem; height: .65rem; }

/* Fila resaltada por vencimiento (misma semántica que la vista Clientes) */
.tabla :deep(.row-vencido) > td    { background: #FEF2F2 !important; }
.tabla :deep(.row-por-vencer) > td { background: #FFFBEB !important; }

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

/* Texto de una línea que se recorta dentro de su celda */
.celda-txt {
  display: block; min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Chips en una sola línea: si sobran, se recortan en vez de agrandar la fila */
.chips-fila { display: flex; gap: 2px; overflow: hidden; min-width: 0; }

/* Subencabezado de grupo (cuando se agrupa el portafolio) */
.grupo-titulo { font-size: 12px; font-weight: 800; color: var(--color-unergy-deep); }
.grupo-conteo {
  margin-left: 7px; background: #f0ebfd; color: var(--color-unergy-purple);
  border-radius: 999px; font-size: 10px; font-weight: 800; padding: 0 6px;
}
.tabla :deep(.p-rowgroup-header) { background: #FAF9FC; }
.tabla :deep(.p-rowgroup-header > td) { padding: 4px 8px; }

/* Celda "Falta": dos contadores, campos y documentos */
.falta-celda { display: flex; gap: 3px; }
.falta-chip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 700; line-height: 1.5;
  padding: 0 5px; border-radius: 999px; cursor: default; white-space: nowrap;
}
.falta-chip svg { font-size: 8px; }
.falta--ok  { background: #D1FAE5; color: #065F46; }
.falta--mal { background: #FEF3C7; color: #92400E; }

/* Celda de acciones: mismos dos iconos, misma posicion, en las 5 tablas */
.acciones { display: flex; justify-content: flex-end; gap: 0; }

/* ── Celda Proyecto ──────────────────────────────────────────────────────────
   El nombre de la planta es un enlace: lleva a su ficha de representación. Se
   pinta como botón (no <a>) porque la navegación la hace el router.          */
.celda-enlace {
  display: flex; align-items: center; gap: 5px; min-width: 0; width: 100%;
  background: none; border: none; padding: 0; text-align: left; cursor: pointer;
  color: var(--color-unergy-deep);
}
.celda-enlace:hover .celda-txt { color: var(--color-unergy-purple); text-decoration: underline; }

/* Contrato sin planta: es un pendiente, así que se pinta como acción por hacer
   y no como un dato más. */
.chip-huerfano {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; line-height: 1.6;
  padding: 0 7px; border-radius: 999px; cursor: pointer;
  background: #FEF3C7; color: #92400E; border: 1px dashed #F59E0B;
}
.chip-huerfano:hover { background: #FDE68A; }

.barra-duplicados {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 10px; font-size: 12px;
  background: #EFF6FF; color: #1E40AF; border-bottom: 1px solid #BFDBFE;
}

.barra-huerfanos {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 10px; font-size: 12px;
  background: #FFFBEB; color: #92400E; border-bottom: 1px solid #FDE68A;
}

/* ── Piezas de celda ──────────────────────────────────────────────────────── */
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #6b5a8a; }
.sutil { font-size: 11px; color: #6b7280; }
.vacio { font-size: 11px; color: #d1d5db; }

.mini-chip {
  display: inline-flex; align-items: center; flex: 0 0 auto;
  font-size: 9.5px; font-weight: 600; line-height: 1.5;
  padding: 0 5px; border-radius: 999px; white-space: nowrap;
}
.srv-badge { background: #D1FAE5; color: #065F46; font-weight: 700; }
.chip-ok      { background: #D1FAE5; color: #065F46; }
.chip-warn    { background: #FEF3C7; color: #92400E; }
.chip-danger  { background: #FEE2E2; color: #991B1B; }
.chip-neutral { background: #F3F4F6; color: #374151; }

.estado-operacion    { background: #D1FAE5; color: #065F46; }
.estado-suspendido   { background: #FEF3C7; color: #92400E; }
.estado-construccion { background: #DBEAFE; color: #1E40AF; }
.estado-default      { background: #F3F4F6; color: #374151; }
.badge-minigranja    { background: #D1FAE5; color: #065F46; }
.badge-gd            { background: #DBEAFE; color: #1E40AF; }
.badge-autoconsumo   { background: #E1F5EE; color: #085041; }
.badge-movilidad     { background: #EEEDFE; color: #3C3489; }
.badge-otro          { background: #F3F4F6; color: #374151; }

.nombre-link {
  display: block; max-width: 100%; text-align: left;
  font-size: 11.5px; font-weight: 600; color: var(--color-unergy-deep);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  cursor: pointer; transition: color .12s;
}
.nombre-link:hover { color: var(--color-unergy-purple); text-decoration: underline; text-underline-offset: 2px; }

.ppa-chip {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: #EEEDFE; color: #3C3489; font-size: 9.5px; font-weight: 600;
  padding: 0 5px; border-radius: 999px; cursor: pointer; transition: background .12s, color .12s;
}
.ppa-chip:hover { background: var(--color-unergy-purple); color: #fff; }

.pulse-dot {
  display: inline-block; width: 5px; height: 5px; border-radius: 50%;
  background: #10B981; flex-shrink: 0; animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%      { transform: scale(1.4); opacity: .65; }
}

</style>
