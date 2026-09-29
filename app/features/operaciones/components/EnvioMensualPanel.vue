<template>
  <!-- Panel inline (no overlay) — vive dentro de /operaciones/informes-mensuales -->
  <div class="flex w-full flex-col gap-3">
    <!-- ══ TOOLBAR (una sola fila) ═══════════════════════════════════════ -->
    <header class="flex flex-wrap items-center gap-2.5 rounded-t-xl border bg-card px-3.5 py-2">
      <span
        class="flex shrink-0 items-center gap-1.5 text-xs font-bold whitespace-nowrap text-muted-foreground"
        title="Pipeline: Edición → Revisión → Comentarios → Aprobación → Envío"
      >
        <SendIcon class="size-3.5 text-primary" /> Revisión y envío
      </span>

      <Button
        v-if="puedeEnviarBatch.length > 0 && permisoEnviar"
        size="sm"
        :disabled="enviandoBatch"
        title="Enviar todos los informes verificados al cliente"
        class="bg-success text-primary-foreground hover:bg-success/90"
        @click="abrirConfirmEnvio"
      >
        <SendIcon />
        Enviar {{ puedeEnviarBatch.length }} verificado{{
          puedeEnviarBatch.length !== 1 ? 's' : ''
        }}
      </Button>

      <div class="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
        <InputGroup class="h-8 w-48">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput v-model="busqueda" placeholder="Buscar…" />
          <InputGroupAddon v-if="busqueda" align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Limpiar" @click="busqueda = ''">
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <ButtonGroup>
          <Button variant="ghost" size="icon-sm" title="Mes anterior" @click="cambiarMes(-1)">
            <ChevronLeftIcon />
          </Button>
          <Input v-model="mesSel" type="month" :max="mesMax" class="h-8 w-auto" />
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="mesSel === mesMax"
            title="Mes siguiente"
            @click="cambiarMes(1)"
          >
            <ChevronRightIcon />
          </Button>
        </ButtonGroup>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="loading"
          title="Actualizar"
          @click="cargar"
        >
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <RefreshCwIcon v-else />
        </Button>
      </div>
    </header>

    <!-- ══ TABLA ═══════════════════════════════════════════════════════ -->
    <div class="rounded-b-xl border border-t-0 bg-card px-3 py-3">
      <div v-if="loading" class="flex flex-col items-center gap-2 py-14 text-muted-foreground">
        <LoaderCircleIcon class="size-8 animate-spin text-primary" />
        <span class="text-sm">Cargando informes del mes…</span>
      </div>
      <div
        v-else-if="!filtrados.length"
        class="flex flex-col items-center gap-1.5 py-16 text-center text-muted-foreground"
      >
        <InboxIcon class="size-8 text-muted-foreground/50" />
        <p class="text-sm font-bold text-foreground">
          {{ filtro ? 'Sin informes en este estado' : 'No hay informes guardados para este mes' }}
        </p>
        <p class="max-w-sm text-xs">
          {{
            filtro
              ? 'Quita el filtro para ver todos.'
              : 'Genera informes desde el wizard de arriba y aparecerán aquí.'
          }}
        </p>
      </div>

      <GTable v-else>
        <GTableHeader>
          <GTableRow>
            <GTableHead class="w-32">Estado</GTableHead>
            <GTableHead>Proyecto</GTableHead>
            <GTableHead>Tipo</GTableHead>
            <GTableHead>Editado</GTableHead>
            <GTableHead>Verificado por</GTableHead>
            <GTableHead>Enviado</GTableHead>
            <GTableHead class="w-36 text-right">Acciones</GTableHead>
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <template v-for="row in filasAgrupadas" :key="esGrupo(row) ? row._group : row.id">
            <GTableRow v-if="esGrupo(row)" class="bg-primary/5 hover:bg-primary/5">
              <GTableCell
                colspan="7"
                class="text-xs font-extrabold tracking-wide text-primary uppercase"
              >
                <component :is="row._icon" class="mr-1 inline size-3.5" /> {{ row._group }}
                <Badge variant="secondary" class="ml-1.5">{{ row._count }}</Badge>
              </GTableCell>
            </GTableRow>
            <GTableRow
              v-else
              class="cursor-pointer"
              :class="drawerInf?.id === row.id ? 'bg-primary/10 hover:bg-primary/10' : ''"
              @click="abrirDrawer(row)"
            >
              <GTableCell>
                <GBadge :color="ESTADO_BADGE_COLOR[pipelineEstado(row)]" size="sm">
                  {{ estadoLabel(pipelineEstado(row)) }}
                </GBadge>
              </GTableCell>
              <GTableCell>
                <div class="font-semibold text-foreground">
                  {{ row.proyecto_nombre || row.sub_project }}
                </div>
                <div v-if="row.tipo === 'port'" class="text-xs text-muted-foreground">
                  {{ (row.miembros || []).length }} proyecto{{
                    (row.miembros || []).length !== 1 ? 's' : ''
                  }}
                </div>
                <div
                  v-else-if="row.proyecto_nombre && row.sub_project !== row.proyecto_nombre"
                  class="text-xs text-muted-foreground"
                >
                  {{ row.sub_project }}
                </div>
              </GTableCell>
              <GTableCell>
                <Badge variant="outline" class="text-xs">{{ tipoLabel(row.tipo) }}</Badge>
              </GTableCell>
              <GTableCell class="text-xs">
                <div>{{ row.editado_en ? formatFecha(row.editado_en) : '—' }}</div>
                <div v-if="row.editado_por_nombre" class="text-muted-foreground">
                  {{ row.editado_por_nombre }}
                </div>
              </GTableCell>
              <GTableCell class="text-xs">
                <span v-if="row.aprobado_por_nombre" class="text-muted-foreground">{{
                  row.aprobado_por_nombre
                }}</span>
                <span v-else class="text-muted-foreground/50">—</span>
              </GTableCell>
              <GTableCell class="text-xs">
                <template v-if="row.correo_enviado">
                  <span class="font-semibold text-success">
                    <MailIcon class="inline size-3" />
                    {{ row.correo_enviado_en ? formatFecha(row.correo_enviado_en) : '✓' }}
                  </span>
                  <div v-if="row.enviado_por_nombre" class="text-muted-foreground">
                    {{ row.enviado_por_nombre }}
                  </div>
                </template>
                <span v-else class="text-muted-foreground/50">—</span>
              </GTableCell>
              <GTableCell class="text-right whitespace-nowrap" @click.stop>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Editar informe en pantalla completa"
                  @click="editar(row)"
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="relative"
                  :class="
                    comentariosPendientes(row) > 0
                      ? 'text-destructive hover:text-destructive'
                      : comentariosTotales(row) > 0
                        ? 'text-primary hover:text-primary'
                        : ''
                  "
                  :title="comentariosTooltip(row)"
                  @click="abrirDrawer(row, 'comentarios')"
                >
                  <MessagesSquareIcon />
                  <span
                    v-if="comentariosTotales(row) > 0"
                    class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-xs font-bold text-white"
                    :class="comentariosPendientes(row) > 0 ? 'bg-destructive' : 'bg-primary'"
                  >
                    {{ comentariosPendientes(row) || comentariosTotales(row) }}
                  </span>
                </Button>
                <Button
                  v-if="puedeVerificar(row)"
                  variant="ghost"
                  size="icon-sm"
                  class="text-warning hover:text-warning"
                  :disabled="!permisoVerificar"
                  :title="
                    permisoVerificar
                      ? 'Revisar y verificar (aprobar)'
                      : 'Sólo Juan José puede verificar'
                  "
                  @click="abrirDrawer(row, 'verificar')"
                >
                  <CircleCheckIcon />
                </Button>
                <Button
                  v-if="row.estado === 'aprobado' && !row.correo_enviado"
                  variant="ghost"
                  size="icon-sm"
                  class="text-primary hover:text-primary"
                  :disabled="!permisoEnviar || enviandoIds.has(row.id)"
                  :title="
                    permisoEnviar
                      ? 'Enviar al correo del cliente'
                      : 'Sólo Laura H. (o admin) puede enviar'
                  "
                  @click="enviarUno(row)"
                >
                  <LoaderCircleIcon v-if="enviandoIds.has(row.id)" class="animate-spin" />
                  <SendIcon v-else />
                </Button>
                <Button
                  v-if="row.estado !== 'aprobado' && !row.correo_enviado"
                  variant="ghost"
                  size="icon-sm"
                  class="hover:bg-destructive/10 hover:text-destructive"
                  :title="
                    row.tipo === 'op'
                      ? 'Eliminar (no afecta a los portafolios que lo incluyen)'
                      : 'Eliminar informe'
                  "
                  @click="eliminarInforme(row)"
                >
                  <Trash2Icon />
                </Button>
              </GTableCell>
            </GTableRow>
          </template>
        </GTableBody>
      </GTable>

      <!-- Faltantes -->
      <Collapsible
        v-if="!loading && faltantes.length > 0"
        v-model:open="showFaltantes"
        class="mt-3 rounded-lg border border-warning/30 bg-warning/10"
      >
        <CollapsibleTrigger as-child>
          <Button
            variant="ghost"
            class="h-auto w-full justify-start gap-2 rounded-none py-2 text-warning hover:text-warning"
          >
            <Badge variant="secondary">{{ faltantes.length }}</Badge>
            <span
              >Proyecto{{ faltantes.length !== 1 ? 's' : '' }} sin informe en {{ mesLabel }}</span
            >
            <ChevronUpIcon v-if="showFaltantes" class="ml-auto text-muted-foreground" />
            <ChevronDownIcon v-else class="ml-auto text-muted-foreground" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent class="flex flex-col gap-1 px-3.5 pb-2.5">
          <div
            v-for="p in faltantes"
            :key="p"
            class="flex items-center gap-2 rounded-md bg-warning/10 px-1.5 py-1"
          >
            <span class="size-1.5 shrink-0 rounded-full bg-warning" />
            <span class="flex-1 text-sm font-semibold text-warning">{{ p }}</span>
            <span class="text-xs text-warning/80 italic">Sin informe operacional</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>

    <!-- ══ PANEL DETALLE (overlay) ═══════════════════════════════════════ -->
    <div v-if="drawerInf" class="fixed inset-0 z-30 flex justify-end">
      <div class="absolute inset-0 bg-black/35 backdrop-blur-xs" @click="cerrarDrawer" />
      <div
        class="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl"
      >
        <!-- Header -->
        <header
          class="flex shrink-0 items-start justify-between gap-2 border-b bg-muted/40 px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-extrabold text-foreground">
              {{ drawerInf.proyecto_nombre || drawerInf.sub_project }}
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" class="text-xs">{{ tipoLabel(drawerInf.tipo) }}</Badge>
              <span>·</span>
              <span>{{ drawerInf.periodo_display || formatPeriodo(drawerInf.periodo_desde) }}</span>
              <span>·</span>
              <GBadge :color="ESTADO_BADGE_COLOR[pipelineEstado(drawerInf)]" size="sm">
                {{ estadoLabel(pipelineEstado(drawerInf)) }}
              </GBadge>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" title="Cerrar panel" @click="cerrarDrawer">
            <XIcon />
          </Button>
        </header>

        <!-- Tabs -->
        <GTabs
          :model-value="drawerTab"
          class="shrink-0 border-b bg-background px-3.5"
          @update:model-value="(v) => (drawerTab = v as DrawerTab)"
        >
          <GTabsList variant="outline">
            <GTabsTrigger value="preview" variant="outline">
              <EyeIcon class="size-4" /> Previsualización
            </GTabsTrigger>
            <GTabsTrigger value="comentarios" variant="outline">
              <MessagesSquareIcon class="size-4" /> Comentarios
              <GBadge
                v-if="comentariosTotales(drawerInf) > 0"
                :color="comentariosPendientes(drawerInf) > 0 ? 'destructive' : 'action'"
                size="sm"
              >
                {{ comentariosPendientes(drawerInf) || comentariosTotales(drawerInf) }}
              </GBadge>
            </GTabsTrigger>
            <GTabsTrigger v-if="puedeVerificar(drawerInf)" value="verificar" variant="outline">
              <CircleCheckIcon class="size-4" /> Verificar
            </GTabsTrigger>
          </GTabsList>
        </GTabs>

        <div class="flex flex-1 flex-col gap-3 overflow-y-auto p-3.5">
          <!-- ── PREVIEW ── -->
          <div v-if="drawerTab === 'preview'" class="flex h-full flex-col gap-2">
            <div
              v-if="loadingDetalle"
              class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <LoaderCircleIcon class="size-7 animate-spin text-primary" />
              <span class="text-sm">Cargando informe…</span>
            </div>
            <div
              v-else-if="!detalleHtml"
              class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <FileIcon class="size-6" />
              <p class="text-sm">Sin contenido del informe</p>
            </div>
            <template v-else>
              <div
                class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-1.5"
              >
                <span v-if="drawerInf.estado === 'aprobado'" class="text-xs text-warning italic">
                  🔒 Aprobado — reabre desde Verificar para editar
                </span>
                <div class="ml-auto flex items-center gap-1.5">
                  <Button
                    v-if="drawerInf.estado !== 'aprobado'"
                    variant="outline"
                    size="sm"
                    @click="editar(drawerInf)"
                  >
                    <PencilIcon /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Imprimir / exportar PDF"
                    @click="imprimirDetalle"
                  >
                    <PrinterIcon /> PDF
                  </Button>
                </div>
              </div>
              <div class="min-h-96 flex-1 overflow-hidden rounded-lg border bg-muted">
                <iframe
                  :key="previewKey"
                  class="size-full min-h-96 border-0"
                  :srcdoc="previewDoc"
                  sandbox="allow-same-origin"
                />
              </div>
            </template>
          </div>

          <!-- ── COMENTARIOS ── -->
          <div v-else-if="drawerTab === 'comentarios'" class="flex h-full flex-col gap-3">
            <div
              v-if="!drawerInf.comentarios?.length"
              class="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg bg-muted/40 py-8 text-center text-muted-foreground"
            >
              <MessagesSquareIcon class="size-6" />
              <p class="text-sm font-bold text-foreground">Sin comentarios todavía</p>
              <p class="max-w-sm text-xs">
                {{
                  permisoVerificar
                    ? 'Agrega observaciones que el equipo deba subsanar antes de enviar.'
                    : 'Cuando el verificador deje observaciones, aparecerán aquí.'
                }}
              </p>
            </div>
            <div v-else class="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
              <div
                v-for="c in drawerInf.comentarios || []"
                :key="c.id"
                class="rounded-lg border p-2.5"
                :class="
                  c.resuelto
                    ? 'border-success/30 bg-success/10'
                    : 'border-destructive/30 bg-destructive/10'
                "
              >
                <div class="mb-1.5 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div
                      class="flex size-6.5 items-center justify-center rounded-full bg-(--c) text-xs font-extrabold text-white"
                      :style="{ '--c': avatarColor(c.autor_email) }"
                    >
                      {{ (c.autor_nombre || c.autor_email || '?').charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="text-xs font-bold text-foreground">
                        {{ c.autor_nombre || c.autor_email }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ formatFechaCorta(c.created_at) }}
                      </div>
                    </div>
                  </div>
                  <span v-if="c.resuelto" class="text-xs font-bold text-success">✅ Subsanado</span>
                  <span v-else class="text-xs font-bold text-destructive">⚠️ Pendiente</span>
                </div>
                <div class="mb-1.5 text-sm whitespace-pre-wrap text-foreground">
                  {{ c.mensaje }}
                </div>
                <div
                  v-if="c.resuelto && c.respuesta"
                  class="mt-1.5 rounded-r-lg border-l-3 border-success bg-background/60 px-2.5 py-2"
                >
                  <div class="mb-0.5 text-xs font-bold tracking-wide text-success uppercase">
                    Respuesta de quien subsanó:
                  </div>
                  <div class="text-sm text-foreground">{{ c.respuesta }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    {{ c.resuelto_por_nombre || c.resuelto_por_email }} ·
                    {{ formatFechaCorta(c.resuelto_en) }}
                  </div>
                </div>
                <div v-if="!c.resuelto" class="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    class="bg-success text-primary-foreground hover:bg-success/90"
                    :disabled="actuandoComentarioId === c.id"
                    @click="abrirResolver(c)"
                  >
                    <CheckIcon /> Marcar subsanado
                  </Button>
                  <Button
                    v-if="puedeBorrarComentario(c)"
                    variant="outline"
                    size="sm"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    :disabled="actuandoComentarioId === c.id"
                    @click="borrarComentario(c)"
                  >
                    <Trash2Icon /> Eliminar
                  </Button>
                </div>
                <!-- Inline form para subsanar -->
                <div v-if="resolviendoId === c.id" class="mt-2 rounded-lg bg-background/70 p-2.5">
                  <label class="mb-1 block text-xs font-bold tracking-wide text-success uppercase">
                    ¿Cómo se subsanó? (opcional)
                  </label>
                  <Textarea
                    v-model="resolviendoTexto"
                    rows="2"
                    placeholder="Describe brevemente qué se cambió o ajustó…"
                  />
                  <div class="mt-1.5 flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" @click="resolviendoId = null"
                      >Cancelar</Button
                    >
                    <Button
                      size="sm"
                      class="bg-success text-primary-foreground hover:bg-success/90"
                      :disabled="actuandoComentarioId === c.id"
                      @click="resolverComentario(c)"
                    >
                      Confirmar subsanación
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="drawerInf.estado !== 'aprobado'"
              class="shrink-0 rounded-lg border border-dashed p-3"
            >
              <Textarea
                v-model="nuevoComentario"
                rows="3"
                :placeholder="
                  permisoVerificar
                    ? 'Escribe una observación para que el equipo subsane…'
                    : 'Sólo el verificador puede agregar observaciones. Tú puedes subsanar los comentarios existentes.'
                "
                :disabled="!permisoVerificar"
              />
              <div class="mt-2 flex justify-end">
                <Button
                  size="sm"
                  :disabled="!permisoVerificar || !nuevoComentario.trim() || agregandoComentario"
                  @click="agregarComentario"
                >
                  <LoaderCircleIcon v-if="agregandoComentario" class="animate-spin" />
                  <PlusIcon v-else />
                  Agregar comentario
                </Button>
              </div>
            </div>
            <p
              v-else
              class="shrink-0 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success"
            >
              ✅ Informe aprobado/verificado · ya no se aceptan más observaciones
            </p>
          </div>

          <!-- ── VERIFICAR ── -->
          <div v-else-if="drawerTab === 'verificar'" class="flex flex-col gap-3.5">
            <div
              v-if="!permisoVerificar"
              class="flex flex-col items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 py-10 text-center"
            >
              <LockIcon class="size-6 text-warning" />
              <p class="text-sm font-bold text-foreground">Verificación restringida</p>
              <p class="max-w-sm text-xs text-muted-foreground">
                Sólo <b>Juan José Pacheco</b> ({{ EMAIL_VERIFICADOR }}) o un administrador pueden
                verificar informes.
              </p>
            </div>
            <template v-else>
              <div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                <div
                  class="flex items-center gap-2.5 text-sm text-foreground"
                  :class="comentariosPendientes(drawerInf) > 0 ? 'text-destructive' : ''"
                >
                  <span>{{ comentariosPendientes(drawerInf) > 0 ? '⚠️' : '✅' }}</span>
                  <span>
                    <b>{{ comentariosPendientes(drawerInf) }}</b>
                    comentario{{ comentariosPendientes(drawerInf) !== 1 ? 's' : '' }} sin subsanar
                    {{
                      comentariosPendientes(drawerInf) > 0
                        ? '— se debe subsanar antes de aprobar'
                        : ''
                    }}
                  </span>
                </div>
                <div class="flex items-center gap-2.5 text-sm text-foreground">
                  <span>{{ drawerInf.editado_por_nombre ? '✅' : '—' }}</span>
                  <span>
                    Última edición: <b>{{ drawerInf.editado_por_nombre || 'sin registro' }}</b>
                    {{ drawerInf.editado_en ? ' · ' + formatFecha(drawerInf.editado_en) : '' }}
                  </span>
                </div>
                <div class="flex items-center gap-2.5 text-sm text-foreground">
                  <span>{{ drawerInf.estado === 'aprobado' ? '✅' : '🕒' }}</span>
                  <span
                    >Estado actual: <b>{{ estadoLabel(pipelineEstado(drawerInf)) }}</b></span
                  >
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <Button
                  v-if="drawerInf.estado !== 'aprobado'"
                  :disabled="comentariosPendientes(drawerInf) > 0 || verificando"
                  class="bg-success text-primary-foreground hover:bg-success/90"
                  @click="verificarYAprobar"
                >
                  <LoaderCircleIcon v-if="verificando" class="animate-spin" />
                  {{ verificando ? 'Verificando…' : '✅ Verificar y aprobar' }}
                </Button>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  class="text-warning hover:bg-warning/10 hover:text-warning"
                  @click="reabrir"
                >
                  ↩ Reabrir para corrección
                </Button>
                <p class="text-xs text-muted-foreground italic">
                  {{
                    drawerInf.estado === 'aprobado'
                      ? 'Si necesitas devolver el informe para corregir algo, reábrelo y agrega comentarios.'
                      : 'Aprueba sólo si el contenido es correcto y todas las observaciones están subsanadas.'
                  }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ DIALOG: CONFIRMAR ENVÍO MASIVO ═══════════════════════════════ -->
    <Dialog v-model:open="confirmEnvio">
      <DialogContent
        class="flex max-h-11/12 max-w-lg flex-col"
        :show-close-button="!enviandoBatch"
        @escape-key-down="(e) => enviandoBatch && e.preventDefault()"
        @pointer-down-outside="(e) => enviandoBatch && e.preventDefault()"
      >
        <DialogHeader>
          <DialogTitle>
            Enviar {{ puedeEnviarBatch.length }} informe{{
              puedeEnviarBatch.length !== 1 ? 's' : ''
            }}
            verificado{{ puedeEnviarBatch.length !== 1 ? 's' : '' }}
          </DialogTitle>
          <DialogDescription>
            Se enviará por correo al cliente operacional registrado de cada proyecto.
          </DialogDescription>
        </DialogHeader>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="!enviandoBatch && !resultadoBatch" class="flex flex-col gap-2">
            <div
              v-for="(inf, i) in puedeEnviarBatch"
              :key="inf.id"
              class="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-2.5 py-2"
            >
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-bold text-foreground">
                  {{ inf.proyecto_nombre || inf.sub_project }}
                </div>
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" class="text-xs">{{ tipoLabel(inf.tipo) }}</Badge>
                  {{ inf.periodo_display || formatPeriodo(inf.periodo_desde) }}
                </div>
              </div>
              <MailIcon class="size-4 shrink-0 text-muted-foreground" />
            </div>
          </div>

          <div v-else-if="enviandoBatch" class="py-2">
            <Progress
              :model-value="(progBatch.hechos / progBatch.total) * 100"
              class="mb-2 *:bg-success"
            />
            <div class="flex justify-between gap-2">
              <span class="text-sm font-extrabold text-success"
                >{{ progBatch.hechos }} / {{ progBatch.total }}</span
              >
              <span class="truncate text-xs text-muted-foreground">{{ progBatch.actual }}</span>
            </div>
          </div>

          <div v-else-if="resultadoBatch" class="flex flex-col gap-2">
            <div class="mb-1 flex justify-center gap-3 border-b pb-2.5 text-xl font-black">
              <span v-if="resultadoBatch.ok" class="text-success">✅ {{ resultadoBatch.ok }}</span>
              <span v-if="resultadoBatch.err" class="text-destructive"
                >⚠️ {{ resultadoBatch.err }}</span
              >
            </div>
            <div
              v-for="d in resultadoBatch.detalles"
              :key="d.id"
              class="flex items-start gap-2.5 rounded-lg border px-2.5 py-1.5"
              :class="
                d.ok ? 'border-success/30 bg-success/10' : 'border-destructive/30 bg-destructive/10'
              "
            >
              <span>{{ d.ok ? '✅' : '⚠️' }}</span>
              <div>
                <div class="text-xs font-bold text-foreground">{{ d.nombre }}</div>
                <div class="text-xs text-muted-foreground">{{ d.msg }}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            v-if="!enviandoBatch && !resultadoBatch"
            variant="outline"
            size="sm"
            @click="cerrarConfirmEnvio"
          >
            Cancelar
          </Button>
          <Button
            v-if="!enviandoBatch && !resultadoBatch"
            size="sm"
            class="bg-success text-primary-foreground hover:bg-success/90"
            @click="ejecutarEnvioBatch"
          >
            <SendIcon /> Confirmar envío de {{ puedeEnviarBatch.length }}
          </Button>
          <Button v-if="resultadoBatch" size="sm" @click="cerrarConfirmEnvio">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ══ EDITOR PANTALLA COMPLETA (teleport al body para cubrir TODO) ══ -->
    <Teleport to="body">
      <div v-if="editandoFullscreen" class="fixed inset-0 z-100 flex flex-col bg-background">
        <div
          class="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-foreground px-5 py-2.5 shadow-lg"
        >
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <PencilIcon class="size-3.5 text-primary" />
            <span class="truncate text-sm font-extrabold text-background">
              {{ editorInf?.proyecto_nombre || editorInf?.sub_project }}
            </span>
            <Badge v-if="editorInf" variant="outline" class="text-xs text-background">
              {{ tipoLabel(editorInf.tipo) }}
            </Badge>
            <span v-if="editorInf" class="text-xs text-background/60">
              · {{ editorInf.periodo_display || formatPeriodo(editorInf.periodo_desde) }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="text-background hover:bg-background/10 hover:text-background"
              @click="imprimirEditor"
            >
              <PrinterIcon /> PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-background hover:bg-background/10 hover:text-background"
              :disabled="guardandoEditor"
              @click="cerrarEditor"
            >
              <XIcon /> Cerrar sin guardar
            </Button>
            <Button
              size="sm"
              class="bg-success text-primary-foreground hover:bg-success/90"
              :disabled="guardandoEditor"
              @click="guardarEditor"
            >
              <LoaderCircleIcon v-if="guardandoEditor" class="animate-spin" />
              <SaveIcon v-else />
              {{ guardandoEditor ? 'Guardando…' : 'Guardar versión' }}
            </Button>
          </div>
        </div>
        <div class="relative flex-1 overflow-hidden bg-muted">
          <iframe
            ref="editorIframeRef"
            class="size-full border-0"
            :srcdoc="editorDoc"
            sandbox="allow-same-origin"
            title="Editor de informe"
          />
        </div>
        <div
          class="flex shrink-0 items-center gap-1.5 bg-foreground px-4 py-1.5 text-xs text-background/55"
        >
          <InfoIcon class="size-3.5 text-primary" />
          Haz clic en cualquier texto para editarlo directamente · Los cambios no se guardan hasta
          presionar "Guardar versión"
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  InboxIcon,
  InfoIcon,
  LoaderCircleIcon,
  LockIcon,
  MailIcon,
  MessagesSquareIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import { InformesService } from '~/features/operaciones/services/informes'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { buildReportHtmlDoc } from '~/features/operaciones/utils/rptStyles'
import type { ComentarioInforme, Informe, TipoInforme } from '~/features/operaciones/types'

const { user } = useAuth()
const confirm = useConfirm()
const informesService = new InformesService()
const monitoreoLegacyService = new MonitoreoLegacyService()

const EMAIL_VERIFICADOR = 'juan.jose@unergy.io'
const EMAIL_VERIFICADOR_ALT = 'juanjose@unergy.io'
const EMAIL_REMITENTE = 'laura.h@unergy.io'
const LS_MES_KEY = 'em_pipeline_mes'

const userEmail = computed(() => (user.value?.email || '').toLowerCase())
const userRol = computed(() => user.value?.role || '')
const permisoVerificar = computed(
  () =>
    userRol.value === 'admin' ||
    [EMAIL_VERIFICADOR, EMAIL_VERIFICADOR_ALT].includes(userEmail.value),
)
const permisoEnviar = computed(() => permisoVerificar.value || userEmail.value === EMAIL_REMITENTE)

// ── Estado ───────────────────────────────────────────────────────────────
const today = new Date()
const mesMax = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
const mesPrevio = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
const mesGuardado = import.meta.client ? localStorage.getItem(LS_MES_KEY) : null
const mesSel = ref(mesGuardado && mesGuardado <= mesMax ? mesGuardado : mesPrevio)

const informes = ref<Informe[]>([])
const loading = ref(false)
const filtro = ref('')
const busqueda = ref('')

const todosProyectos = ref<string[]>([])
const showFaltantes = ref(false)

// Drawer / panel detalle
type DrawerTab = 'preview' | 'comentarios' | 'verificar'
const drawerInf = ref<Informe | null>(null)
const drawerTab = ref<DrawerTab>('preview')
const detalleHtml = ref('')
const loadingDetalle = ref(false)
const previewKey = ref(0) // ← fuerza reload del iframe

// Editor pantalla completa
const editandoFullscreen = ref(false)
const editorInf = ref<Informe | null>(null)
const editorHtml = ref('')
const editorIframeRef = ref<HTMLIFrameElement | null>(null)
const guardandoEditor = ref(false)

// Comentarios
const nuevoComentario = ref('')
const agregandoComentario = ref(false)
const resolviendoId = ref<number | null>(null)
const resolviendoTexto = ref('')
const actuandoComentarioId = ref<number | null>(null)

// Verificación
const verificando = ref(false)

// Envío masivo
const confirmEnvio = ref(false)
const enviandoBatch = ref(false)
const progBatch = ref({ hechos: 0, total: 0, actual: '' })
interface ResultadoBatchDetalle {
  id: number
  nombre: string
  ok: boolean
  msg?: string
}
const resultadoBatch = ref<{ ok: number; err: number; detalles: ResultadoBatchDetalle[] } | null>(
  null,
)
const enviandoIds = ref<Set<number>>(new Set())

// ── Estados del pipeline ─────────────────────────────────────────────────
type PipelineEstado = 'pendiente' | 'comentado' | 'resuelto' | 'verificado' | 'enviado'

function pipelineEstado(inf: Informe): PipelineEstado {
  if (inf.correo_enviado) return 'enviado'
  if (inf.estado === 'aprobado') return 'verificado'
  const total = (inf.comentarios || []).length
  const pend = (inf.comentarios || []).filter((c) => !c.resuelto).length
  if (pend > 0) return 'comentado'
  if (total > 0) return 'resuelto'
  if (inf.estado === 'revisado') return 'resuelto'
  return 'pendiente'
}

// Mismo criterio de severidad en colores semánticos de GBadge.
const ESTADO_BADGE_COLOR: Record<PipelineEstado, GandalfBadgeColor> = {
  pendiente: 'warning',
  comentado: 'destructive',
  resuelto: 'information',
  verificado: 'success',
  enviado: 'action',
}

const mesLabel = computed(() => {
  if (!mesSel.value) return ''
  const [y, m] = mesSel.value.split('-')
  const n = [
    '',
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
  ][Number(m)]
  return `${n} ${y}`
})

const proyectosConInforme = computed(
  () => new Set(informes.value.filter((i) => i.tipo === 'op').map((i) => i.sub_project)),
)
const faltantes = computed(() =>
  todosProyectos.value.filter((p) => !proyectosConInforme.value.has(p)),
)
const filtrados = computed(() => {
  let list = informes.value
  if (filtro.value) list = list.filter((i) => pipelineEstado(i) === filtro.value)
  if (busqueda.value.trim()) {
    const q = busqueda.value.trim().toLowerCase()
    list = list.filter(
      (i) =>
        (i.proyecto_nombre || '').toLowerCase().includes(q) ||
        (i.sub_project || '').toLowerCase().includes(q),
    )
  }
  return list
})
// Separar portafolio vs individuales (op/fmo) y aplanar con marcadores de grupo
interface GrupoFila {
  _group: string
  _icon: Component
  _count: number
}
type FilaTabla = Informe | GrupoFila
function esGrupo(row: FilaTabla): row is GrupoFila {
  return '_group' in row
}

const filtradosPort = computed(() => filtrados.value.filter((i) => i.tipo === 'port'))
const filtradosIndiv = computed(() => filtrados.value.filter((i) => i.tipo !== 'port'))
const filasAgrupadas = computed<FilaTabla[]>(() => {
  const out: FilaTabla[] = []
  if (filtradosPort.value.length) {
    out.push({
      _group: 'Informes de portafolio',
      _icon: FolderIcon,
      _count: filtradosPort.value.length,
    })
    out.push(...filtradosPort.value)
  }
  if (filtradosIndiv.value.length) {
    out.push({
      _group: 'Informes individuales',
      _icon: FileIcon,
      _count: filtradosIndiv.value.length,
    })
    out.push(...filtradosIndiv.value)
  }
  return out
})
const puedeEnviarBatch = computed(() =>
  informes.value.filter((i) => i.estado === 'aprobado' && !i.correo_enviado),
)

// Iframe preview doc (computado de detalleHtml)
const previewDoc = computed(() => {
  if (!detalleHtml.value) return '<html><body></body></html>'
  return buildReportHtmlDoc(detalleHtml.value, {
    title: drawerInf.value?.proyecto_nombre || 'Informe',
    bgGray: true,
  })
})

// Iframe editor doc (editable) — sólo cambia al abrir el editor, no durante la edición
const editorDoc = computed(() => {
  if (!editorHtml.value) return '<html><body></body></html>'
  return buildReportHtmlDoc(editorHtml.value, {
    title: editorInf.value?.proyecto_nombre || 'Editor',
    bgGray: false,
    editable: true,
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────
function comentariosTotales(inf: Informe): number {
  return (inf.comentarios || []).length
}
function comentariosPendientes(inf: Informe): number {
  return (inf.comentarios || []).filter((c) => !c.resuelto).length
}
function comentariosTooltip(inf: Informe): string {
  const t = comentariosTotales(inf)
  const p = comentariosPendientes(inf)
  if (t === 0) return 'Sin comentarios'
  if (p === 0) return `${t} comentario(s) — todos subsanados`
  return `${p} de ${t} comentarios sin subsanar`
}
function puedeVerificar(inf: Informe): boolean {
  return inf.estado !== 'aprobado'
}
function puedeBorrarComentario(c: ComentarioInforme): boolean {
  return (c.autor_email || '').toLowerCase() === userEmail.value || userRol.value === 'admin'
}
const TIPO_LABELS: Record<string, string> = { op: 'Operacional', fmo: 'FMO', port: 'Portafolio' }
function tipoLabel(t: TipoInforme): string {
  return TIPO_LABELS[t] || (t || '—').toUpperCase()
}
const ESTADO_LABELS: Record<PipelineEstado, string> = {
  pendiente: 'Pendiente',
  comentado: 'Con comentarios',
  resuelto: 'Comentarios resueltos',
  verificado: 'Verificado',
  enviado: 'Enviado',
}
function estadoLabel(e: PipelineEstado): string {
  return ESTADO_LABELS[e] || e
}
function formatFecha(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
function formatFechaCorta(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function formatPeriodo(iso?: string): string {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  const mes =
    ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][
      Number(m)
    ] || m
  return `${mes} ${y}`
}
function avatarColor(email?: string): string {
  const colors = [
    'var(--primary)',
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--success)',
    'var(--warning)',
  ]
  let h = 0
  for (const c of email || '') h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return colors[Math.abs(h) % colors.length]!
}

// ── Cargar informes ──────────────────────────────────────────────────────
async function cargar() {
  if (!mesSel.value) return
  loading.value = true
  if (import.meta.client) localStorage.setItem(LS_MES_KEY, mesSel.value)
  try {
    const [y, m] = mesSel.value.split('-').map(Number) as [number, number]
    const desde = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const hasta = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    informes.value = await informesService.listar({
      periodo_desde_gte: desde,
      periodo_desde_lte: hasta,
      limit: 500,
    })
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    loading.value = false
  }
}

async function cargarProyectos() {
  try {
    const data = await monitoreoLegacyService.obtenerProyectos()
    todosProyectos.value = (data.projects || [])
      .map((p) => p.sub_project || p.nombre_comercial || p.name || '')
      .filter(Boolean)
  } catch {
    /* no crítico */
  }
}

function cambiarMes(delta: number) {
  if (!mesSel.value) return
  const [y, m] = mesSel.value.split('-').map(Number) as [number, number]
  const d = new Date(y, m - 1 + delta, 1)
  const nuevo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (nuevo > mesMax) return
  mesSel.value = nuevo
}
watch(mesSel, () => {
  filtro.value = ''
  busqueda.value = ''
  cargar()
})
onMounted(() => {
  cargar()
  cargarProyectos()
})

// ── Panel detalle ────────────────────────────────────────────────────────
async function abrirDrawer(inf: Informe, tab: DrawerTab = 'preview') {
  drawerInf.value = inf
  drawerTab.value = tab
  detalleHtml.value = ''
  loadingDetalle.value = true
  try {
    const data = await informesService.obtener(inf.id)
    const idx = informes.value.findIndex((i) => i.id === inf.id)
    if (idx >= 0) Object.assign(informes.value[idx]!, data)
    drawerInf.value = informes.value[idx] || data
    if (data.tipo === 'port') {
      // Portafolio: previsualizar el documento COMPUESTO (consolidada + secciones vivas)
      const comp = await informesService.obtenerCompuesto(inf.id)
      detalleHtml.value = comp.html_content || ''
    } else {
      detalleHtml.value = data.html_content || ''
    }
  } catch {
    toast.error('Error al cargar el informe')
  } finally {
    loadingDetalle.value = false
  }
}
function cerrarDrawer() {
  drawerInf.value = null
  detalleHtml.value = ''
  resolviendoId.value = null
  nuevoComentario.value = ''
}

// ── Imprimir desde el panel detalle ──────────────────────────────────────
function imprimirDetalle() {
  if (!detalleHtml.value) return
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    toast.error('No se pudo abrir ventana de impresión (popup bloqueado)')
    return
  }
  const doc = buildReportHtmlDoc(detalleHtml.value, {
    title: drawerInf.value?.proyecto_nombre || 'Informe Operacional',
    bgGray: false,
  })
  w.document.open()
  w.document.write(doc)
  w.document.close()
  w.focus()
  // Esperar a que se cargue la fuente antes de imprimir
  setTimeout(() => w.print(), 600)
}

// ── Editor pantalla completa ─────────────────────────────────────────────
async function editar(inf: Informe) {
  // Si no tenemos el HTML todavía (informe no cargado en drawer), lo buscamos
  let htmlToEdit = ''
  if (drawerInf.value?.id === inf.id && detalleHtml.value) {
    htmlToEdit = detalleHtml.value
  } else {
    try {
      const data = await informesService.obtener(inf.id)
      // Portafolio: se edita el documento COMPUESTO (consolidada + secciones vivas)
      if (data.tipo === 'port') {
        const comp = await informesService.obtenerCompuesto(inf.id)
        htmlToEdit = comp.html_content || ''
      } else {
        htmlToEdit = data.html_content || ''
      }
      // Actualizar el cache local también
      const idx = informes.value.findIndex((i) => i.id === inf.id)
      if (idx >= 0) Object.assign(informes.value[idx]!, data)
      if (drawerInf.value?.id === inf.id) {
        drawerInf.value = informes.value[idx] || data
        detalleHtml.value = htmlToEdit
      }
    } catch {
      toast.error('No se pudo cargar el informe para editar')
      return
    }
  }
  if (!htmlToEdit) {
    toast.error('El informe no tiene contenido para editar')
    return
  }
  editorInf.value = inf
  editorHtml.value = htmlToEdit
  editandoFullscreen.value = true
}

function cerrarEditor() {
  if (guardandoEditor.value) return
  editandoFullscreen.value = false
  editorInf.value = null
  editorHtml.value = ''
}

async function guardarEditor() {
  if (!editorInf.value || !editorIframeRef.value) return
  guardandoEditor.value = true
  try {
    const body = editorIframeRef.value.contentDocument?.body
    if (!body) throw new Error('No se pudo acceder al contenido del editor')
    const newHtml = body.innerHTML
    const inf = editorInf.value

    if (inf.tipo === 'port') {
      // Edición bidireccional del portafolio:
      //  - página consolidada → html_content del portafolio (sin tocar miembros)
      //  - cada sección de proyecto → write-back al individual vinculado (si editable)
      //    o al html_inline del miembro, vía PATCH /seccion.
      const pages = [...body.querySelectorAll('.rpt-page')]
      const consolidada = pages.length ? pages[0]!.outerHTML : newHtml
      const secciones = pages.slice(1)
      const data = await informesService.guardar({
        tipo: 'port',
        sub_project: inf.sub_project || '',
        periodo_desde: inf.periodo_desde || '',
        periodo_hasta: inf.periodo_hasta || '',
        periodo_display: inf.periodo_display || '',
        proyecto_nombre: inf.proyecto_nombre || '',
        html_content: consolidada,
      })
      const bloqueadas: string[] = []
      for (const el of secciones) {
        const sp = el.getAttribute('data-sub-project')
        if (!sp) continue
        try {
          await informesService.guardarSeccion(inf.id, {
            sub_project: sp,
            html_content: el.outerHTML,
          })
        } catch (err) {
          bloqueadas.push(normalizeError(err).message || sp)
        }
      }
      const idx = informes.value.findIndex((i) => i.id === inf.id)
      if (idx >= 0) Object.assign(informes.value[idx]!, data)
      if (drawerInf.value?.id === inf.id) {
        drawerInf.value = informes.value[idx] || data
        detalleHtml.value = newHtml
        previewKey.value++
      }
      if (bloqueadas.length) {
        toast.error('Guardado parcial', {
          description: 'Secciones bloqueadas: ' + bloqueadas.join(' | '),
        })
      } else {
        toast.success('Cambios guardados (portafolio + individuales)')
      }
      cerrarEditor()
      return
    }

    const data = await informesService.guardar({
      tipo: inf.tipo,
      sub_project: inf.sub_project || '',
      periodo_desde: inf.periodo_desde || '',
      periodo_hasta: inf.periodo_hasta || '',
      periodo_display: inf.periodo_display || '',
      proyecto_nombre: inf.proyecto_nombre || '',
      html_content: newHtml,
    })
    // Actualizar cache local
    const idx = informes.value.findIndex((i) => i.id === inf.id)
    if (idx >= 0) Object.assign(informes.value[idx]!, data)
    // Actualizar el drawer si está abierto con este mismo informe
    if (drawerInf.value?.id === inf.id) {
      drawerInf.value = informes.value[idx] || data
      detalleHtml.value = newHtml
      previewKey.value++ // fuerza refresh del iframe de previsualización
    }
    toast.success('Cambios guardados correctamente')
    cerrarEditor()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    guardandoEditor.value = false
  }
}

function imprimirEditor() {
  if (!editorIframeRef.value) return
  const body = editorIframeRef.value.contentDocument?.body
  if (!body) return
  const currentHtml = body.innerHTML
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    toast.error('No se pudo abrir ventana de impresión (popup bloqueado)')
    return
  }
  const doc = buildReportHtmlDoc(currentHtml, {
    title: editorInf.value?.proyecto_nombre || 'Informe Operacional',
    bgGray: false,
  })
  w.document.open()
  w.document.write(doc)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 600)
}

// ── Eliminar informe ─────────────────────────────────────────────────────
function eliminarInforme(inf: Informe) {
  const esPort = inf.tipo === 'port'
  const aviso =
    inf.tipo === 'op'
      ? ' Su sección quedará conservada en los portafolios que lo incluyen (no se verán afectados).'
      : ''
  confirm({
    title: `Eliminar ${esPort ? 'portafolio' : 'informe'}`,
    description: `¿Eliminar el ${esPort ? 'portafolio' : 'informe'} de "${inf.proyecto_nombre || inf.sub_project}"?${aviso}`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await informesService.eliminar(inf.id)
        informes.value = informes.value.filter((i) => i.id !== inf.id)
        if (drawerInf.value?.id === inf.id) cerrarDrawer()
        toast.success('Informe eliminado')
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message })
      }
    },
  })
}

// ── Comentarios ──────────────────────────────────────────────────────────
async function agregarComentario() {
  if (!nuevoComentario.value.trim() || !drawerInf.value) return
  agregandoComentario.value = true
  try {
    const data = await informesService.agregarComentario(
      drawerInf.value.id,
      nuevoComentario.value.trim(),
    )
    const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
    if (idx >= 0) Object.assign(informes.value[idx]!, data)
    drawerInf.value = informes.value[idx]!
    nuevoComentario.value = ''
    toast.success('Comentario agregado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    agregandoComentario.value = false
  }
}
function abrirResolver(c: ComentarioInforme) {
  resolviendoId.value = c.id
  resolviendoTexto.value = ''
}
async function resolverComentario(c: ComentarioInforme) {
  if (!drawerInf.value) return
  actuandoComentarioId.value = c.id
  try {
    const data = await informesService.resolverComentario(
      drawerInf.value.id,
      c.id,
      resolviendoTexto.value || null,
    )
    const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
    if (idx >= 0) Object.assign(informes.value[idx]!, data)
    drawerInf.value = informes.value[idx]!
    resolviendoId.value = null
    resolviendoTexto.value = ''
    toast.success('Comentario subsanado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    actuandoComentarioId.value = null
  }
}
function borrarComentario(c: ComentarioInforme) {
  if (!drawerInf.value) return
  confirm({
    title: 'Eliminar comentario',
    description: '¿Eliminar este comentario? Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      if (!drawerInf.value) return
      actuandoComentarioId.value = c.id
      try {
        const data = await informesService.eliminarComentario(drawerInf.value.id, c.id)
        const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
        if (idx >= 0) Object.assign(informes.value[idx]!, data)
        drawerInf.value = informes.value[idx]!
        toast.success('Comentario eliminado')
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message })
      } finally {
        actuandoComentarioId.value = null
      }
    },
  })
}

// ── Verificar ────────────────────────────────────────────────────────────
async function verificarYAprobar() {
  if (!drawerInf.value) return
  if (comentariosPendientes(drawerInf.value) > 0) {
    toast.error('Resuelve todos los comentarios pendientes antes de aprobar')
    return
  }
  verificando.value = true
  try {
    if (drawerInf.value.estado === 'borrador') {
      const data = await informesService.cambiarEstado(drawerInf.value.id, 'revisado')
      const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
      if (idx >= 0) Object.assign(informes.value[idx]!, data)
      drawerInf.value = informes.value[idx]!
    }
    const d2 = await informesService.cambiarEstado(drawerInf.value.id, 'aprobado')
    const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
    if (idx >= 0) Object.assign(informes.value[idx]!, d2)
    drawerInf.value = informes.value[idx]!
    drawerTab.value = 'preview'
    toast.success('Informe verificado y aprobado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    verificando.value = false
  }
}
function reabrir() {
  if (!drawerInf.value) return
  confirm({
    title: 'Reabrir informe',
    description:
      '¿Reabrir este informe? Volverá a borrador y se podrán agregar nuevos comentarios.',
    confirmLabel: 'Reabrir',
    cancelLabel: 'Cancelar',
    onConfirm: async () => {
      if (!drawerInf.value) return
      try {
        const data = await informesService.cambiarEstado(drawerInf.value.id, 'borrador')
        const idx = informes.value.findIndex((i) => i.id === drawerInf.value!.id)
        if (idx >= 0) Object.assign(informes.value[idx]!, data)
        drawerInf.value = informes.value[idx]!
        toast.success('Informe reabierto para corrección')
      } catch (err) {
        toast.error('Error', {
          description: normalizeError(err).message + ' — usa "Devolver a borrador" en el editor.',
        })
      }
    },
  })
}

// ── Envío individual ─────────────────────────────────────────────────────
async function enviarUno(inf: Informe) {
  if (!permisoEnviar.value || enviandoIds.value.has(inf.id)) return
  const newSet = new Set(enviandoIds.value)
  newSet.add(inf.id)
  enviandoIds.value = newSet
  try {
    const data = await informesService.enviar(inf.id)
    const idx = informes.value.findIndex((i) => i.id === inf.id)
    if (idx >= 0) {
      informes.value[idx]!.correo_enviado = true
      informes.value[idx]!.correo_enviado_en = new Date().toISOString()
      informes.value[idx]!.enviado_por_nombre = user.value?.name || ''
    }
    if (drawerInf.value?.id === inf.id) drawerInf.value = informes.value[idx]!
    toast.success(`Enviado a ${data.enviado_a}`)
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    const ns = new Set(enviandoIds.value)
    ns.delete(inf.id)
    enviandoIds.value = ns
  }
}

// ── Envío masivo ─────────────────────────────────────────────────────────
function abrirConfirmEnvio() {
  resultadoBatch.value = null
  progBatch.value = { hechos: 0, total: 0, actual: '' }
  confirmEnvio.value = true
}
function cerrarConfirmEnvio() {
  if (enviandoBatch.value) return
  confirmEnvio.value = false
  if (resultadoBatch.value) resultadoBatch.value = null
}
async function ejecutarEnvioBatch() {
  const items = [...puedeEnviarBatch.value]
  if (!items.length) return
  enviandoBatch.value = true
  progBatch.value = { hechos: 0, total: items.length, actual: '' }
  const detalles: ResultadoBatchDetalle[] = []
  const CONC = 3
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const my = idx++
      const inf = items[my]!
      progBatch.value = { ...progBatch.value, actual: inf.proyecto_nombre || inf.sub_project || '' }
      const nombre = `${inf.proyecto_nombre || inf.sub_project} · ${inf.periodo_display || inf.periodo_desde}`
      try {
        const data = await informesService.enviar(inf.id)
        const ix = informes.value.findIndex((i) => i.id === inf.id)
        if (ix >= 0) {
          informes.value[ix]!.correo_enviado = true
          informes.value[ix]!.correo_enviado_en = new Date().toISOString()
          informes.value[ix]!.enviado_por_nombre = user.value?.name || ''
        }
        detalles.push({ id: inf.id, nombre, ok: true, msg: `Enviado a ${data.enviado_a}` })
      } catch (err) {
        detalles.push({ id: inf.id, nombre, ok: false, msg: normalizeError(err).message })
      } finally {
        progBatch.value = { ...progBatch.value, hechos: progBatch.value.hechos + 1 }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, items.length) }, worker))
  resultadoBatch.value = {
    ok: detalles.filter((d) => d.ok).length,
    err: detalles.filter((d) => !d.ok).length,
    detalles: detalles.sort((a, b) => Number(a.ok) - Number(b.ok)),
  }
  enviandoBatch.value = false
}
</script>
