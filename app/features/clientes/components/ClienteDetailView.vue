<template>
  <div class="space-y-4" v-if="cliente">
    <!-- Dialog: eliminar cliente -->
    <Dialog v-model:visible="deleteVisible" header="Eliminar cliente" modal class="w-full max-w-sm">
      <p class="text-sm text-gray-700 mb-4">
        ¿Estás seguro de que deseas eliminar
        <strong>{{ formatearNombre(cliente.razon_social_nombre) }}</strong>? Esta acción no se puede deshacer.
      </p>
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" @click="deleteVisible = false" />
        <Button label="Eliminar" severity="danger" :loading="deleting" @click="doDelete" />
      </div>
    </Dialog>

    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=clientes', label: 'Clientes' }"
                   :titulo="formatearNombre(cliente.razon_social_nombre)"
                   :codigo="cliente.nit_cedula || ''"
                   :tabs="tabs" v-model="activeTab">
      <template #acciones>
        <Button label="Eliminar" text size="small" severity="danger" @click="deleteVisible = true">
          <template #icon><Trash2Icon class="size-[1em]" /></template>
        </Button>
      </template>
      <template #default>

        <!-- ── Tab: Resumen 360 ── -->
        <div v-if="activeTab === 'resumen'">
          <ClienteResumen :cliente-id="route.params.id" />
        </div>

        <!-- ── Tab: Información ── -->
        <div v-if="activeTab === 'info'" class="space-y-6">
          <ClienteForm :initial="cliente" @save="saveInfo" @cancel="() => {}" :inline="true" />
        </div>

        <!-- ── Tab: Contactos ── -->
        <div v-if="activeTab === 'contactos'" class="space-y-4">
          <ContactosPanel :cliente-id="cliente.id" />
        </div>

        <!-- ── Tab: Servicios ── -->
        <div v-if="activeTab === 'servicios'" class="space-y-6">

          <!-- Servicios contratados (derivados de los contratos de las plantas) -->
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wide mb-2" style="color: #9b89b5;">
              Servicios contratados
            </h3>
            <div v-if="loadingServiciosContratos" class="flex justify-center py-6">
              <LoaderCircleIcon class="text-xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
            </div>
            <div v-else-if="serviciosContratos.length === 0"
              class="text-sm text-center py-4 rounded-xl" style="color:#bba8d4; border: 1.5px dashed #e8e0f0;">
              Este cliente no tiene contratos de servicio en sus plantas.
            </div>
            <div v-else class="space-y-3">
              <div v-for="g in serviciosContratos" :key="g.servicio"
                class="rounded-xl overflow-hidden" style="border: 1.5px solid #e8e0f0;">
                <div class="flex items-center gap-2 px-4 py-2.5" style="background: #faf8fd;">
                  <span class="text-sm font-bold" style="color: var(--color-unergy-deep);">{{ servicioAplicaLabel(g.servicio) }}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background:#f0ebfd;color:var(--color-unergy-purple);">
                    {{ g.num_plantas }} {{ g.num_plantas === 1 ? 'planta' : 'plantas' }}
                  </span>
                  <span v-if="g.semaforo && g.semaforo !== 'vigente'"
                    class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                    :style="{ color: SEMAFORO[g.semaforo].color, background: SEMAFORO[g.semaforo].bg }">
                    {{ SEMAFORO[g.semaforo].label }}
                  </span>
                </div>
                <div class="divide-y" style="border-color: #f3eefa;">
                  <div v-for="c in g.contratos" :key="c.contrato_id"
                    class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold truncate" style="color: var(--color-unergy-deep);">
                        {{ c.proyecto_nombre || 'Sin planta' }}
                      </p>
                      <p class="text-xs" style="color: #6b5a8a;">
                        {{ c.numero_contrato ? 'N° ' + c.numero_contrato + ' · ' : '' }}{{ formatDate(c.fecha_inicio) || '—' }} → {{ formatDate(c.fecha_fin) || '—' }}
                        <span v-if="c.tarifa !== null"> · tarifa {{ c.tarifa }}</span>
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span v-if="c.semaforo" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        :style="{ color: SEMAFORO[c.semaforo].color, background: SEMAFORO[c.semaforo].bg }">
                        {{ SEMAFORO[c.semaforo].label }}
                      </span>
                      <a v-if="c.enlace_drive" :href="c.enlace_drive" target="_blank" rel="noopener"
                        class="text-xs font-semibold flex items-center gap-1 hover:underline" style="color: var(--color-unergy-purple);">
                        <ExternalLinkIcon class="text-xs size-[1em]" /> Abrir contrato
                      </a>
                      <span v-else class="text-xs italic" style="color:#bba8d4;">Sin link</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Excepciones de tasa por servicio -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-bold uppercase tracking-wide" style="color: #9b89b5;">
                Excepciones de tasa por servicio
              </h3>
              <button @click="abrirDialogoTasa(null)"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                style="background: var(--color-unergy-purple);">
                <PlusIcon class="text-xs size-[1em]" /> Agregar excepción
              </button>
            </div>
            <p class="text-xs mb-3" style="color: #9b89b5;">
              Sobrescribe el IVA/retención/ReteIVA/ReteICA general del cliente solo para un servicio
              (y opcionalmente un proyecto) puntual. Un % vacío hereda la tasa general del cliente.
            </p>
            <div v-if="loadingTasas" class="flex justify-center py-4">
              <LoaderCircleIcon class="text-xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
            </div>
            <div v-else-if="tasasServicio.length === 0"
              class="text-sm text-center py-4 rounded-xl" style="color:#bba8d4; border: 1.5px dashed #e8e0f0;">
              Sin excepciones — este cliente usa sus tasas generales para todos los servicios.
            </div>
            <div v-else class="space-y-2">
              <div v-for="t in tasasServicio" :key="t.id"
                class="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
                style="border: 1.5px solid #e8e0f0;">
                <div>
                  <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">
                    {{ t.servicio }}
                    <span class="text-xs font-normal" style="color:#9b89b5;"> · {{ nombreProyectoTasa(t.proyecto_id) }}</span>
                  </p>
                  <p class="text-xs" style="color: #6b5a8a;">
                    <span v-if="t.iva_pct != null">IVA {{ t.iva_pct }}% · </span>
                    <span v-if="t.retencion_pct != null">Retención {{ t.retencion_pct }}% · </span>
                    <span v-if="t.reteiva_pct != null">ReteIVA {{ t.reteiva_pct }}% · </span>
                    <span v-if="t.reteica_pct != null">ReteICA {{ t.reteica_pct }}%</span>
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button @click="abrirDialogoTasa(t)" style="color: #6b5a8a;" class="hover:text-purple-700">
                    <PencilIcon class="text-sm size-[1em]" />
                  </button>
                  <button @click="eliminarTasa(t)" class="text-red-400 hover:text-red-600">
                    <Trash2Icon class="text-sm size-[1em]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Tab: Documentos ── -->
        <div v-if="activeTab === 'documentos'" class="space-y-5">
          <div class="flex items-center justify-between">
            <p class="text-sm" style="color: #6b5a8a;">Documentos del cliente: identificación y comerciales.</p>
            <button @click="abrirDialogoDocumento(null)"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5"
              style="background: var(--color-unergy-purple);">
              <PlusIcon class="text-xs size-[1em]" /> Agregar documento
            </button>
          </div>

          <!-- Identificación -->
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wide mb-2" style="color: #9b89b5;">
              Identificación del cliente
            </h3>
            <div v-if="docsIdentificacion.length === 0"
              class="text-sm text-center py-6 rounded-xl" style="color:#bba8d4; border: 1.5px dashed #e8e0f0;">
              Sin documentos de identificación. Agrega el RUT, certificado bancario o cámara de comercio.
            </div>
            <div v-else class="space-y-2">
              <div v-for="doc in docsIdentificacion" :key="doc.id"
                class="flex items-center justify-between rounded-xl px-4 py-3"
                style="border: 1.5px solid #e8e0f0;">
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    :style="badgeStyle(doc.tipo)">
                    {{ tipoLabel(doc.tipo) }}
                  </span>
                  <div>
                    <p class="text-sm font-medium" style="color: var(--color-unergy-deep);">
                      {{ doc.archivo_nombre || doc.nombre }}
                    </p>
                    <p v-if="doc.notas" class="text-xs" style="color: #9b89b5;">{{ doc.notas }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a v-if="doc.archivo_url" :href="doc.archivo_url" target="_blank"
                    class="text-xs hover:underline flex items-center gap-1" style="color: var(--color-unergy-purple);">
                    <ExternalLinkIcon class="text-xs size-[1em]" /> Ver
                  </a>
                  <button @click="abrirDialogoDocumento(doc)" style="color: #6b5a8a;" class="hover:text-purple-700">
                    <PencilIcon class="text-sm size-[1em]" />
                  </button>
                  <button @click="eliminarDocumento(doc)" class="text-red-400 hover:text-red-600">
                    <Trash2Icon class="text-sm size-[1em]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Contratos y Ofertas generales (sin servicio vinculado) -->
          <div v-if="docsComerciales.length > 0">
            <h3 class="text-xs font-bold uppercase tracking-wide mb-2" style="color: #9b89b5;">
              Contratos y Ofertas (generales)
            </h3>
            <div class="space-y-2">
              <div v-for="doc in docsComerciales" :key="doc.id"
                class="flex items-center justify-between rounded-xl px-4 py-3"
                style="border: 1.5px solid #e8e0f0;">
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                    :style="badgeStyle(doc.tipo)">
                    {{ tipoLabel(doc.tipo) }}
                  </span>
                  <div>
                    <p class="text-sm font-medium" style="color: var(--color-unergy-deep);">{{ doc.nombre }}</p>
                    <p class="text-xs" style="color: #9b89b5;">
                      {{ doc.numero ? `N° ${doc.numero} · ` : '' }}{{ estadoLabel(doc.estado) }}{{ doc.fecha ? ' · ' + formatDate(doc.fecha) : '' }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a v-if="doc.archivo_url" :href="doc.archivo_url" target="_blank"
                    class="text-xs hover:underline flex items-center gap-1" style="color: var(--color-unergy-purple);">
                    <ExternalLinkIcon class="text-xs size-[1em]" /> Ver
                  </a>
                  <button @click="abrirDialogoDocumento(doc)" style="color: #6b5a8a;" class="hover:text-purple-700">
                    <PencilIcon class="text-sm size-[1em]" />
                  </button>
                  <button @click="eliminarDocumento(doc)" class="text-red-400 hover:text-red-600">
                    <Trash2Icon class="text-sm size-[1em]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Tab: Proyectos vinculados ── -->
        <div v-if="activeTab === 'proyectos'" class="space-y-4">
          <p class="text-sm" style="color: #6b5a8a;">Proyectos asociados a este cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <LoaderCircleIcon class="text-xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
          </div>
          <div v-else-if="clienteProyectos.length === 0" class="text-center py-10 text-sm" style="color: #9b89b5;">
            No hay proyectos vinculados a este cliente.
          </div>
          <div v-else class="space-y-2">
            <RouterLink v-for="p in clienteProyectos" :key="p.id" :to="`/proyectos/${p.id}`"
              class="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-gray-50"
              style="border: 1.5px solid #e8e0f0;">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(145,91,216,0.1);">
                  <ZapIcon class="text-sm size-[1em]" style="color: var(--color-unergy-purple);" />
                </div>
                <div>
                  <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ p.nombre_comercial }}</p>
                  <p class="text-xs" style="color: #6b5a8a;">
                    {{ [p.municipio, p.departamento].filter(Boolean).join(', ') || '—' }}
                    <span v-if="p.potencia_instalada_kwp" class="ml-2">{{ p.potencia_instalada_kwp }} kW AC</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="p.estado" class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :style="p.estado === 'en_operacion' ? 'background:rgba(16,185,129,0.1);color:#10B981' : 'background:rgba(240,192,64,0.1);color:#CA8A04'">
                  {{ p.estado === 'en_operacion' ? 'En operación' : p.estado }}
                </span>
                <ChevronRightIcon class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
              </div>
            </RouterLink>
          </div>
        </div>

        <!-- ── Tab: Fronteras ── -->
        <div v-if="activeTab === 'fronteras'" class="space-y-4">
          <p class="text-sm" style="color: #6b5a8a;">Fronteras comerciales del cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <LoaderCircleIcon class="text-xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
          </div>
          <div v-else-if="clienteFronteras.length === 0" class="text-center py-10 text-sm" style="color: #9b89b5;">
            No hay fronteras registradas para este cliente.
          </div>
          <div v-else class="space-y-2">
            <div v-for="f in clienteFronteras" :key="f.id"
              class="flex items-center justify-between rounded-xl px-4 py-3"
              style="border: 1.5px solid #e8e0f0;">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
                  <GlobeIcon class="text-sm size-[1em]" style="color: #3B82F6;" />
                </div>
                <div>
                  <p class="text-sm font-semibold font-mono" style="color: var(--color-unergy-deep);">{{ f.codigo_frontera }}</p>
                  <p class="text-xs" style="color: #6b5a8a;">{{ f.nombre_frontera || '—' }}</p>
                </div>
              </div>
              <span v-if="f.estado" class="text-xs px-2 py-0.5 rounded-full font-medium"
                :style="f.estado === 'activa' ? 'background:rgba(16,185,129,0.1);color:#10B981' : 'background:rgba(240,192,64,0.1);color:#CA8A04'">
                {{ f.estado }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── Tab: Contratos PPA ── -->
        <div v-if="activeTab === 'ppa'" class="space-y-4">
          <p class="text-sm" style="color: #6b5a8a;">Contratos PPA vinculados al cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <LoaderCircleIcon class="text-xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
          </div>
          <div v-else-if="clientePPA.length === 0" class="text-center py-10 text-sm" style="color: #9b89b5;">
            No hay contratos PPA para este cliente.
          </div>
          <div v-else class="space-y-2">
            <RouterLink v-for="c in clientePPA" :key="c.id" :to="`/contratos/${c.id}`"
              class="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-gray-50"
              style="border: 1.5px solid #e8e0f0;">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(245,158,11,0.1);">
                  <FilePenIcon class="text-sm size-[1em]" style="color: #F59E0B;" />
                </div>
                <div>
                  <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ c.nombre_interno || c.numero_codigo_contrato || 'Sin nombre' }}</p>
                  <p class="text-xs" style="color: #6b5a8a;">
                    {{ c.comprador_nombre || '—' }} → {{ c.vendedor_nombre || '—' }}
                    <span v-if="c.fecha_inicio"> · {{ c.fecha_inicio }} a {{ c.fecha_fin || '—' }}</span>
                  </p>
                </div>
              </div>
              <ChevronRightIcon class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
            </RouterLink>
          </div>
        </div>

      </template>
    </DetalleLayout>
  </div>

  <!-- Loading -->
  <div v-else class="flex items-center justify-center py-20">
    <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
  </div>

  <!-- ── Dialog: Documento ── -->
  <Dialog v-model:visible="dialogDocumento" modal
    :header="editandoDocumento?.id ? 'Editar documento' : 'Nuevo documento'"
    class="w-full max-w-lg">
    <div class="space-y-4 pt-2">
      <div class="grid grid-cols-2 gap-4">

        <!-- Tipo -->
        <div class="col-span-2">
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Tipo *</label>
          <Select v-model="formDoc.tipo" :options="TIPOS_DOC" optionLabel="label" optionValue="value"
            class="w-full" placeholder="Seleccionar tipo" @change="onTipoChange" />
        </div>


        <!-- Nombre -->
        <div class="col-span-2">
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Nombre *</label>
          <InputText v-model="formDoc.nombre" class="w-full" placeholder="Ej: RUT Empresa XYZ" />
        </div>

        <!-- Estado (solo oferta/contrato) -->
        <template v-if="formDoc.tipo === 'oferta' || formDoc.tipo === 'contrato'">
          <div>
            <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Estado</label>
            <Select v-model="formDoc.estado" :options="ESTADOS_DOC" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Número</label>
            <InputText v-model="formDoc.numero" class="w-full" placeholder="Ej: OFR-001" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Fecha</label>
            <DatePicker v-model="formDoc.fecha" class="w-full" dateFormat="dd/mm/yy" showButtonBar />
          </div>
          <div />
        </template>

        <!-- Archivo -->
        <div class="col-span-2">
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">
            Archivo (PDF, JPG, PNG — máx. 20 MB)
          </label>
          <div class="flex items-center gap-3">
            <label class="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
              style="background: #6b5a8a;">
              <UploadIcon class="text-xs size-[1em]" />
              {{ archivoSeleccionado ? 'Cambiar' : 'Seleccionar archivo' }}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" class="hidden" @change="onArchivoChange" />
            </label>
            <span v-if="archivoSeleccionado" class="text-sm truncate max-w-48" style="color: var(--color-unergy-deep);">
              {{ archivoSeleccionado.name }}
            </span>
            <span v-else-if="formDoc.archivo_nombre" class="text-sm truncate max-w-48" style="color: #9b89b5;">
              Actual: {{ formDoc.archivo_nombre }}
            </span>
          </div>
        </div>

        <!-- URL alternativa -->
        <div class="col-span-2">
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">
            O pega un enlace (Google Drive, OneDrive)
          </label>
          <InputText v-model="formDoc.archivo_url" class="w-full" placeholder="https://drive.google.com/..."
            :disabled="!!archivoSeleccionado" />
        </div>

        <!-- Notas -->
        <div class="col-span-2">
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Notas</label>
          <Textarea v-model="formDoc.notas" class="w-full" rows="2" />
        </div>

      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" severity="secondary" @click="dialogDocumento = false" />
      <Button label="Guardar" :disabled="!formDoc.tipo || !formDoc.nombre || guardando"
        :loading="guardando" @click="guardarDocumento"
        style="background: var(--color-unergy-purple); border-color: var(--color-unergy-purple);" />
    </template>
  </Dialog>

  <!-- ── Dialog: Excepción de tasa por servicio ── -->
  <Dialog v-model:visible="dialogTasa" modal
    :header="editandoTasa?.id ? 'Editar excepción de tasa' : 'Nueva excepción de tasa'"
    class="w-full max-w-lg">
    <div class="space-y-4 pt-2">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Servicio *</label>
          <Select v-model="formTasa.servicio" :options="SERVICIOS_TASA" class="w-full" placeholder="Seleccionar" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Proyecto</label>
          <Select v-model="formTasa.proyecto_id" :options="clienteProyectos" optionLabel="nombre_comercial" optionValue="id"
            class="w-full" placeholder="Todos los proyectos" showClear />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">IVA %</label>
          <InputNumber v-model="formTasa.iva_pct" suffix="%" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="Hereda del cliente" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Retención %</label>
          <InputNumber v-model="formTasa.retencion_pct" suffix="%" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="Hereda del cliente" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">ReteIVA %</label>
          <InputNumber v-model="formTasa.reteiva_pct" suffix="%" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="Hereda del cliente" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">ReteICA %</label>
          <InputNumber v-model="formTasa.reteica_pct" suffix="%" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" placeholder="Hereda del cliente" />
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" severity="secondary" @click="dialogTasa = false" />
      <Button label="Guardar" :disabled="!formTasa.servicio || guardando"
        :loading="guardando" @click="guardarTasa"
        style="background: var(--color-unergy-purple); border-color: var(--color-unergy-purple);" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import { ClientesService } from '~/features/clientes/services/clientes'
import ClienteForm from './ClienteForm.vue'
import DetalleLayout from '~/components/blocks/DetalleLayout.vue'
import ClienteResumen from './ClienteResumen.vue'
import ContactosPanel from '~/components/blocks/ContactosPanel.vue'
import { formatearNombre } from '~/utils/nombreFormato'
import { SEMAFORO, servicioLabel as servicioAplicaLabel } from './clientesUi'
import { BriefcaseIcon, ChevronRightIcon, ExternalLinkIcon, FilePenIcon, FolderIcon, GlobeIcon, LayoutGridIcon, LoaderCircleIcon, MailIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon, UserIcon, ZapIcon } from '@lucide/vue'

const clientesService = new ClientesService()

const route = useRoute()
const router = useRouter()
const cliente = ref(null)
const deleteVisible = ref(false)
const deleting = ref(false)
const activeTab = ref('resumen')   // DetalleLayout sincroniza con ?tab=
const guardando = ref(false)
const archivoSeleccionado = ref(null)

const tabs = [
  { key: 'resumen',    label: 'Resumen',       icon: LayoutGridIcon },
  { key: 'info',       label: 'Información',  icon: UserIcon },
  { key: 'contactos',  label: 'Contactos',     icon: MailIcon },
  { key: 'servicios',  label: 'Servicios',     icon: BriefcaseIcon },
  { key: 'documentos', label: 'Documentos',    icon: FolderIcon },
  { key: 'proyectos',  label: 'Proyectos',     icon: ZapIcon },
  { key: 'fronteras',  label: 'Fronteras',     icon: GlobeIcon },
  { key: 'ppa',        label: 'Contratos PPA', icon: FilePenIcon },
]

const clienteProyectos = ref([])
const clienteFronteras = ref([])
const clientePPA = ref([])
const loadingRelated = ref(false)

const serviciosContratos = ref([])
const loadingServiciosContratos = ref(false)

const tasasServicio = ref([])
const loadingTasas = ref(false)

const TIPOS_DOC = [
  { value: 'rut',                label: 'RUT' },
  { value: 'certificado_bancario', label: 'Certificado bancario' },
  { value: 'camara_comercio',    label: 'Cámara de comercio' },
  { value: 'oferta',             label: 'Oferta de servicio' },
  { value: 'contrato',           label: 'Contrato de servicio' },
]

const ESTADOS_DOC = [
  { value: 'borrador',  label: 'Borrador' },
  { value: 'enviado',   label: 'Enviado' },
  { value: 'aceptado',  label: 'Aceptado' },
  { value: 'firmado',   label: 'Firmado' },
  { value: 'rechazado', label: 'Rechazado' },
]

const TIPOS_IDENTIFICACION = ['rut', 'certificado_bancario', 'camara_comercio']
const TIPOS_COMERCIAL = ['oferta', 'contrato']

// ── Computed ──────────────────────────────────────────────────────────────────

const docsIdentificacion = computed(() =>
  (cliente.value?.documentos_comerciales || []).filter(d => TIPOS_IDENTIFICACION.includes(d.tipo))
)

const docsComerciales = computed(() =>
  (cliente.value?.documentos_comerciales || [])
    .filter(d => TIPOS_COMERCIAL.includes(d.tipo))
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'oferta' ? -1 : 1))
)

// ── Documentos ────────────────────────────────────────────────────────────────

const dialogDocumento = ref(false)
const editandoDocumento = ref(null)
const formDoc = reactive({
  tipo: '', nombre: '', numero: '', fecha: null,
  estado: 'borrador', archivo_url: '', archivo_nombre: '',
  notas: '',
})

function abrirDialogoDocumento(doc, tipoPreset = null) {
  editandoDocumento.value = doc
  archivoSeleccionado.value = null
  if (doc) {
    Object.assign(formDoc, {
      ...doc,
      fecha: doc.fecha ? new Date(doc.fecha) : null,
      archivo_url: doc.archivo_url || '',
      archivo_nombre: doc.archivo_nombre || '',
    })
  } else {
    Object.assign(formDoc, {
      tipo: tipoPreset || '',
      nombre: tipoPreset ? nombreSugerido(tipoPreset) : '',
      numero: '', fecha: null, estado: 'borrador',
      archivo_url: '', archivo_nombre: '',
      notas: '',
    })
  }
  dialogDocumento.value = true
}

function onTipoChange() {
  if (!editandoDocumento.value) {
    formDoc.nombre = nombreSugerido(formDoc.tipo)
  }
}

function nombreSugerido(tipo) {
  const labels = {
    rut: 'RUT',
    certificado_bancario: 'Certificado bancario',
    camara_comercio: 'Cámara de comercio',
    oferta: 'Oferta de servicio',
    contrato: 'Contrato de servicio',
  }
  const base = labels[tipo] || ''
  return base ? `${base} — ${formatearNombre(cliente.value?.razon_social_nombre) || ''}` : ''
}

function onArchivoChange(e) {
  archivoSeleccionado.value = e.target.files[0] || null
  if (archivoSeleccionado.value) {
    formDoc.archivo_url = ''
  }
}

async function guardarDocumento() {
  guardando.value = true
  try {
    const payload = {
      tipo: formDoc.tipo,
      nombre: formDoc.nombre,
      numero: formDoc.numero || null,
      fecha: formDoc.fecha ? new Date(formDoc.fecha).toISOString().split('T')[0] : null,
      estado: formDoc.estado,
      archivo_url: archivoSeleccionado.value ? null : (formDoc.archivo_url || null),
      archivo_nombre: formDoc.archivo_nombre || null,
      notas: formDoc.notas || null,
    }

    let docId
    if (editandoDocumento.value?.id) {
      await clientesService.actualizarDocumento(route.params.id, editandoDocumento.value.id, payload)
      docId = editandoDocumento.value.id
    } else {
      const documento = await clientesService.crearDocumento(route.params.id, payload)
      docId = documento.id
    }

    // Upload archivo si se seleccionó uno
    if (archivoSeleccionado.value) {
      await clientesService.subirArchivoDocumento(route.params.id, docId, archivoSeleccionado.value)
    }

    dialogDocumento.value = false
    toast.success('Documento guardado', { duration: 3000 })
    await cargar()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

async function eliminarDocumento(doc) {
  if (!confirm(`¿Eliminar "${doc.archivo_nombre || doc.nombre}"?`)) return
  await clientesService.eliminarDocumento(route.params.id, doc.id)
  toast.success('Eliminado', { duration: 3000 })
  await cargar()
}

// ── Info ──────────────────────────────────────────────────────────────────────

async function saveInfo(payload) {
  await clientesService.actualizar(route.params.id, payload)
  toast.success('Información actualizada', { duration: 3000 })
  await cargar()
}

async function doDelete() {
  deleting.value = true
  try {
    await clientesService.eliminar(route.params.id)
    toast.success('Cliente eliminado', { duration: 3000 })
    router.push('/clientes')
  } catch (e) {
    const detail = e.data?.detail || 'Error al eliminar'
    toast.error('No se pudo eliminar', { description: detail, duration: 5000 })
  } finally {
    deleting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tipoLabel(tipo) {
  return TIPOS_DOC.find(t => t.value === tipo)?.label || tipo
}

function estadoLabel(estado) {
  return ESTADOS_DOC.find(e => e.value === estado)?.label || estado
}

function badgeStyle(tipo) {
  const styles = {
    rut:                  'background:#e3f0fd; color:#1976D2',
    certificado_bancario: 'background:#e8f5e9; color:#388E3C',
    camara_comercio:      'background:#fff3e0; color:#F57C00',
    oferta:               'background:#f5f0fb; color:#915BD8',
    contrato:             'background:#e8f5e9; color:#2e7d32',
  }
  return styles[tipo] || 'background:#f3f3f3; color:#555'
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function cargar() {
  cliente.value = await clientesService.obtener(route.params.id)
}

// Fix 2026-08-19: cada llamada tenia su propio .catch(() => ({data: []})),
// asi que un error real (500, timeout) se veia identico a "este cliente no
// tiene nada" -- sin forma de distinguir un dato vacio de una peticion
// fallida. Ahora el error sube al catch de afuera y avisa con un toast.
async function loadRelatedData(tab) {
  loadingRelated.value = true
  try {
    if (tab === 'proyectos' && clienteProyectos.value.length === 0) {
      clienteProyectos.value = await clientesService.listarProyectos(route.params.id)
    } else if (tab === 'fronteras' && clienteFronteras.value.length === 0) {
      clienteFronteras.value = await clientesService.listarFronteras(route.params.id)
    } else if (tab === 'ppa' && clientePPA.value.length === 0) {
      clientePPA.value = await clientesService.listarContratosPpa(route.params.id)
    }
  } catch (e) {
    toast.error('No se pudo cargar', {
      description: e.data?.detail || 'Intenta de nuevo en un momento',
      duration: 4000,
    })
  } finally {
    loadingRelated.value = false
  }
}

watch(activeTab, (tab) => {
  if (['proyectos', 'fronteras', 'ppa'].includes(tab)) {
    loadRelatedData(tab)
  }
})

async function loadServiciosContratos() {
  loadingServiciosContratos.value = true
  try {
    serviciosContratos.value = await clientesService.listarServiciosContratos(route.params.id)
  } catch {
    serviciosContratos.value = []
  } finally {
    loadingServiciosContratos.value = false
  }
}

// ── Tasas de servicio (excepciones de IVA/retencion/ReteIVA/ReteICA) ──────────
// Sobrescriben las tasas generales del cliente SOLO para un servicio puntual
// (y opcionalmente un proyecto puntual). Ver app/utils/impuestos_factura.py
// (tasas_efectivas) en el backend -- esto es lo que aplica el Panel Contable
// y las Liquidaciones.
const SERVICIOS_TASA = ['Representación', 'CGM', 'Administración']

async function loadTasasServicio() {
  loadingTasas.value = true
  try {
    tasasServicio.value = await clientesService.listarTasasServicio(route.params.id)
  } catch {
    tasasServicio.value = []
  } finally {
    loadingTasas.value = false
  }
}

const dialogTasa = ref(false)
const editandoTasa = ref(null)
const formTasa = reactive({
  servicio: '', proyecto_id: null,
  iva_pct: null, retencion_pct: null, reteiva_pct: null, reteica_pct: null,
})

async function abrirDialogoTasa(tasa) {
  editandoTasa.value = tasa
  if (tasa) {
    Object.assign(formTasa, {
      servicio: tasa.servicio, proyecto_id: tasa.proyecto_id ?? null,
      iva_pct: tasa.iva_pct ?? null, retencion_pct: tasa.retencion_pct ?? null,
      reteiva_pct: tasa.reteiva_pct ?? null, reteica_pct: tasa.reteica_pct ?? null,
    })
  } else {
    Object.assign(formTasa, {
      servicio: '', proyecto_id: null,
      iva_pct: null, retencion_pct: null, reteiva_pct: null, reteica_pct: null,
    })
  }
  if (clienteProyectos.value.length === 0) await loadRelatedData('proyectos')
  dialogTasa.value = true
}

async function guardarTasa() {
  guardando.value = true
  try {
    await clientesService.guardarTasaServicio(route.params.id, {
      servicio: formTasa.servicio,
      proyecto_id: formTasa.proyecto_id || null,
      iva_pct: formTasa.iva_pct ?? null,
      retencion_pct: formTasa.retencion_pct ?? null,
      reteiva_pct: formTasa.reteiva_pct ?? null,
      reteica_pct: formTasa.reteica_pct ?? null,
    })
    dialogTasa.value = false
    toast.success('Tasa de servicio guardada', { duration: 3000 })
    await loadTasasServicio()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

async function eliminarTasa(tasa) {
  if (!confirm(`¿Eliminar la excepción de "${tasa.servicio}"${tasa.proyecto_id ? '' : ' (todos los proyectos)'}?`)) return
  await clientesService.eliminarTasaServicio(route.params.id, tasa.id)
  toast.success('Eliminada', { duration: 3000 })
  await loadTasasServicio()
}

function nombreProyectoTasa(proyectoId) {
  if (!proyectoId) return 'Todos los proyectos'
  return clienteProyectos.value.find(p => p.id === proyectoId)?.nombre_comercial || `Proyecto #${proyectoId}`
}

onMounted(() => {
  cargar()
  loadServiciosContratos()
  loadTasasServicio()
})
</script>
