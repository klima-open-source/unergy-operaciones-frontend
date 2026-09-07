<template>
  <form @submit.prevent="submit" class="ff-form">

    <!-- ── SECCIÓN: Identificación ──────────────────────────── -->
    <div class="ff-section">
      <div class="ff-section-title"><TagIcon class="size-[1em]" /> Identificación</div>
      <div class="ff-grid">

        <!-- Al crear: MultiSelect (varios proyectos → una falla por cada uno) -->
        <div v-if="!initial" class="ff-field ff-span2">
          <label class="ff-label">
            Proyecto(s) *
            <span class="ff-hint">(selecciona varios para crear una falla por cada uno)</span>
          </label>
          <MultiSelect v-model="form.proyecto_ids" :options="proyectos"
            optionLabel="nombre_comercial" optionValue="id"
            placeholder="Seleccionar proyecto(s)" filter class="w-full"
            :class="{ 'p-invalid': errors.proyecto_ids }"
            display="chip" />
          <small v-if="errors.proyecto_ids" class="ff-error">{{ errors.proyecto_ids }}</small>
        </div>
        <!-- Al editar: Select simple -->
        <div v-else class="ff-field ff-span2">
          <label class="ff-label">Proyecto *</label>
          <Select v-model="form.proyecto_id" :options="proyectos"
            optionLabel="nombre_comercial" optionValue="id"
            placeholder="Seleccionar proyecto" filter class="w-full"
            :class="{ 'p-invalid': errors.proyecto_id }" />
          <small v-if="errors.proyecto_id" class="ff-error">{{ errors.proyecto_id }}</small>
        </div>

        <!-- ── Clasificación jerárquica por sistema afectado (fallas nuevas) ── -->
        <div v-if="usarEstructura" class="ff-field ff-span2 ff-estructura">
          <label class="ff-label">Sistema afectado *</label>
          <div class="ff-sysgrid">
            <button v-for="c in estructura" :key="c.codigo" type="button"
              :class="['ff-syscard', cls.categoria === c.codigo && 'ff-syscard--on']"
              @click="seleccionarCategoria(c.codigo)">
              <component :is="iconoCategoriaFalla(c.codigo)" class="size-[1em]" :style="{ color: c.color_hex }" />
              <span>{{ c.etiqueta }}</span>
            </button>
          </div>
          <small v-if="errors.categoria" class="ff-error">{{ errors.categoria }}</small>

          <!-- RED / EVENTOS ADVERSOS: opción única -->
          <div v-if="catActual && catActual.tipo === 'opcion'" class="ff-sub">
            <label class="ff-label">{{ labelOpciones }} *</label>
            <Select v-model="cls.subtipo" :options="catActual.opciones"
              optionLabel="etiqueta" optionValue="codigo" placeholder="Seleccionar…"
              class="w-full" :class="{ 'p-invalid': errors.subtipo }" />
            <small v-if="errors.subtipo" class="ff-error">{{ errors.subtipo }}</small>
            <div v-if="opcionActual?.pendiente_reclasificar" class="ff-banner ff-banner--warn">
              <ClockIcon class="size-[1em]" /> Quedará <strong>pendiente de reclasificar</strong> hasta conocer la causa definitiva.
            </div>
            <div v-if="opcionActual?.requiere_detalle" class="ff-subfield">
              <label class="ff-label">{{ opcionActual.detalle_label || 'Detalle *' }}</label>
              <Textarea v-model="cls.detalle" rows="2" autoResize class="w-full"
                :class="{ 'p-invalid': errors.detalle }" placeholder="Describe el motivo específico…" />
              <small v-if="errors.detalle" class="ff-error">{{ errors.detalle }}</small>
            </div>
          </div>

          <!-- FRONTERA: equipo + flags -->
          <div v-else-if="catActual && catActual.tipo === 'equipo'" class="ff-sub">
            <label class="ff-label">Equipo de frontera *</label>
            <Select v-model="cls.subtipo" :options="catActual.opciones"
              optionLabel="etiqueta" optionValue="codigo" placeholder="Seleccionar equipo…"
              class="w-full" :class="{ 'p-invalid': errors.subtipo }" />
            <small v-if="errors.subtipo" class="ff-error">{{ errors.subtipo }}</small>
            <div class="ff-flags">
              <label class="ff-check"><input type="checkbox" v-model="cls.afecta_medicion" /> Afecta la medición de la frontera</label>
              <label class="ff-check"><input type="checkbox" v-model="cls.perdida_comunicacion" /> Pérdida de comunicación (datos) de la frontera</label>
            </div>
            <div v-if="cls.perdida_comunicacion" class="ff-banner ff-banner--info">
              <BellIcon class="size-[1em]" /> Generará una alarma de comunicaciones de frontera.
            </div>
          </div>

          <!-- INVERSORES: selección múltiple + tipos + gestión parametrizable -->
          <div v-else-if="catActual && catActual.tipo === 'inversores'" class="ff-sub">
            <div v-if="!proyectoUnicoId" class="ff-banner ff-banner--warn">
              <InfoIcon class="size-[1em]" /> Para reportar inversores selecciona <strong>un solo proyecto</strong> arriba.
            </div>
            <template v-else>
              <div class="ff-invhead">
                <label class="ff-label" style="margin:0">Inversores afectados *</label>
                <button type="button" class="ff-link" @click="gestionInversores = !gestionInversores">
                  <SettingsIcon class="size-[1em]" /> {{ gestionInversores ? 'Cerrar gestión' : 'Gestionar inversores' }}
                </button>
              </div>
              <div v-if="cargandoInv" class="ff-hint">Cargando inversores…</div>
              <div v-else-if="!inversoresProyecto.length && !gestionInversores" class="ff-banner ff-banner--warn">
                Este proyecto no tiene inversores configurados.
                <button type="button" class="ff-link" @click="gestionInversores = true">Configurar</button>
              </div>
              <MultiSelect v-else-if="inversoresProyecto.length" v-model="cls.inversores_ids" :options="inversoresProyecto"
                optionLabel="_label" optionValue="id" placeholder="Seleccionar inversor(es)"
                display="chip" class="w-full" :class="{ 'p-invalid': errors.inversores }" />
              <small v-if="errors.inversores" class="ff-error">{{ errors.inversores }}</small>

              <!-- gestión parametrizable de inversores del proyecto -->
              <div v-if="gestionInversores" class="ff-invmanage">
                <div class="ff-invmanage-head">
                  <span>Potencia AC: <strong>{{ potenciaAc != null ? potenciaAc + ' kW' : 'sin definir' }}</strong>
                    · Suma inversores: <strong :class="{ 'ff-text-danger': sumaExcede }">{{ sumaInversores }} kW</strong></span>
                  <button v-if="!inversoresProyecto.length" type="button" class="ff-link" @click="prefillMinigranja">
                    Usar config típica minigranja
                  </button>
                </div>
                <div v-for="inv in inversoresProyecto" :key="inv.id" class="ff-invrow">
                  <InputText v-model="inv.nombre" placeholder="Nombre" class="ff-invname" @blur="guardarInv(inv)" />
                  <InputNumber v-model="inv.potencia_nominal_kw" placeholder="kW" suffix=" kW" :min="0"
                    class="ff-invkw" @blur="guardarInv(inv)" />
                  <button type="button" class="ff-invdel" @click="eliminarInv(inv)"><Trash2Icon class="size-[1em]" /></button>
                </div>
                <div class="ff-invrow ff-invrow--new">
                  <InputText v-model="nuevoInv.nombre" placeholder="Nombre nuevo inversor" class="ff-invname" />
                  <InputNumber v-model="nuevoInv.potencia_nominal_kw" placeholder="kW" suffix=" kW" :min="0" class="ff-invkw" />
                  <button type="button" class="ff-invadd" @click="agregarInv"><PlusIcon class="size-[1em]" /></button>
                </div>
                <small v-if="invError" class="ff-error">{{ invError }}</small>
              </div>

              <div class="ff-subfield">
                <label class="ff-label">Tipo(s) de falla *</label>
                <MultiSelect v-model="cls.inversores_tipos" :options="catActual.tipos_falla"
                  optionLabel="etiqueta" optionValue="codigo" placeholder="Seleccionar tipo(s)"
                  display="chip" class="w-full" :class="{ 'p-invalid': errors.invtipos }" />
                <small v-if="errors.invtipos" class="ff-error">{{ errors.invtipos }}</small>
                <div v-if="cls.inversores_tipos.includes('perdida_comunicacion')" class="ff-banner ff-banner--info">
                  <BellIcon class="size-[1em]" /> Generará una alarma de comunicaciones de inversores.
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Tipo de falla LEGACY (solo edición de fallas viejas sin categoría) -->
        <div v-else class="ff-field">
          <label class="ff-label">Tipo de falla *</label>
          <Select v-model="form.tipo_id" :options="tiposAgrupados"
            optionLabel="etiqueta" optionValue="id"
            optionGroupLabel="categoria" optionGroupChildren="items"
            placeholder="Seleccionar tipo" filter filterPlaceholder="Buscar tipo..."
            showClear class="w-full" :class="{ 'p-invalid': errors.tipo_id }" />
          <small v-if="errors.tipo_id" class="ff-error">{{ errors.tipo_id }}</small>
        </div>

        <div class="ff-field">
          <label class="ff-label">Prioridad *</label>
          <Select v-model="form.prioridad_id" :options="catalogos.prioridades"
            optionLabel="etiqueta" optionValue="id"
            placeholder="Seleccionar prioridad" class="w-full"
            :class="{ 'p-invalid': errors.prioridad_id }" />
          <small v-if="errors.prioridad_id" class="ff-error">{{ errors.prioridad_id }}</small>
        </div>

        <div class="ff-field">
          <label class="ff-label">Estado *</label>
          <Select v-model="form.estado_id" :options="catalogos.estados"
            optionLabel="etiqueta" optionValue="id"
            placeholder="Seleccionar estado" class="w-full"
            :class="{ 'p-invalid': errors.estado_id }" />
          <small v-if="errors.estado_id" class="ff-error">{{ errors.estado_id }}</small>
        </div>

        <!-- Límite SLA personalizado — solo al editar, caso puntual que se sale del default de su prioridad -->
        <div v-if="initial" class="ff-field ff-span2">
          <div class="ff-sla-override-row">
            <label class="ff-label" style="margin:0">Límite SLA personalizado <span class="ff-hint">(horas)</span></label>
            <span v-if="!form.sla_limite_horas" class="ff-sla-override-ref">
              Por defecto para esta prioridad: <strong>{{ initial?.sla_limite_horas_efectivo }}h</strong>
            </span>
          </div>
          <div class="ff-sla-override-input">
            <InputNumber v-model="form.sla_limite_horas" placeholder="Sin personalizar" :min="1" :max="999" class="flex-1" />
            <button v-if="form.sla_limite_horas" type="button" class="ff-sla-override-clear"
              title="Quitar personalización" @click="form.sla_limite_horas = null">
              <XIcon class="size-[1em]" />
            </button>
          </div>
          <span class="ff-hint ff-sla-override-hint">
            Opcional. Dejalo vacío para usar el límite automático de la prioridad — solo llenalo si este caso puntual necesita más o menos tiempo.
          </span>
        </div>

        <div class="ff-field">
          <label class="ff-label">
            Fecha y hora de identificación *
            <span class="ff-hint">(sugerida: momento actual)</span>
          </label>
          <DatePicker v-model="form.fecha_identificacion" dateFormat="yy-mm-dd"
            showTime hourFormat="24" placeholder="AAAA-MM-DD HH:mm" class="w-full" showIcon
            :class="{ 'p-invalid': errors.fecha_identificacion }" />
          <small v-if="errors.fecha_identificacion" class="ff-error">{{ errors.fecha_identificacion }}</small>
        </div>

        <div class="ff-field">
          <label class="ff-label">
            Fecha y hora ocurrencia
            <span class="ff-hint">(inicio de la afectación; si difiere de la identificación)</span>
          </label>
          <DatePicker v-model="form.fecha_ocurrencia" dateFormat="yy-mm-dd"
            showTime hourFormat="24" class="w-full" showIcon />
        </div>

        <!-- Fecha programada — solo visible cuando el estado es "programado" -->
        <div v-if="esEstadoProgramado" class="ff-field ff-highlight">
          <label class="ff-label">
            <CalendarIcon class="size-[1em]" style="color:#3B82F6" />
            Fecha programada *
            <span class="ff-hint">(fecha de intervención planificada)</span>
          </label>
          <DatePicker v-model="form.fecha_programada" dateFormat="yy-mm-dd"
            placeholder="AAAA-MM-DD" class="w-full"
            :class="{ 'p-invalid': errors.fecha_programada }" />
          <small v-if="errors.fecha_programada" class="ff-error">{{ errors.fecha_programada }}</small>
        </div>

      </div>
    </div>

    <!-- ── SECCIÓN: Descripción ─────────────────────────────── -->
    <div class="ff-section">
      <div class="ff-section-title"><AlignLeftIcon class="size-[1em]" /> Descripción del evento</div>
      <div class="ff-grid">

        <div class="ff-field ff-span2">
          <label class="ff-label">Descripción *</label>
          <Textarea v-model="form.descripcion" rows="3" autoResize
            placeholder="Describe la falla, síntomas observados, impacto en la operación..."
            class="w-full" :class="{ 'p-invalid': errors.descripcion }" />
          <small v-if="errors.descripcion" class="ff-error">{{ errors.descripcion }}</small>
        </div>

      </div>
    </div>

    <!-- ── SECCIÓN: Análisis ────────────────────────────────── -->
    <div class="ff-section">
      <div class="ff-section-title"><SearchIcon class="size-[1em]" /> Análisis</div>
      <div class="ff-grid">

        <div class="ff-field ff-span2">
          <label class="ff-label">Causa raíz</label>
          <Textarea v-model="form.causa_raiz" rows="2" autoResize
            placeholder="Descripción de la causa raíz identificada..."
            class="w-full" />
        </div>

        <div class="ff-field ff-span2">
          <label class="ff-label">Acciones correctivas</label>
          <Textarea v-model="form.acciones_correctivas" rows="2" autoResize
            placeholder="Acciones correctivas tomadas o planeadas..."
            class="w-full" />
        </div>

      </div>
    </div>

    <!-- ── SECCIÓN: Resolución (solo cuando el estado es final/cerrada) ── -->
    <div v-if="esEstadoFinal" class="ff-section ff-section--resolve">
      <div class="ff-section-title">
        <CircleCheckIcon class="size-[1em]" style="color:#16a34a" /> Resolución
        <span class="ff-hint" style="color:#dc2626">(obligatoria al cerrar la falla)</span>
      </div>
      <div class="ff-grid">

        <div class="ff-field">
          <label class="ff-label">
            Fecha y hora de solución *
            <span class="ff-hint">(fin de la afectación)</span>
          </label>
          <DatePicker v-model="form.fecha_resolucion" dateFormat="yy-mm-dd"
            placeholder="AAAA-MM-DD HH:mm" class="w-full" showButtonBar showIcon
            showTime hourFormat="24" :class="{ 'p-invalid': errors.fecha_resolucion }" />
          <small v-if="errors.fecha_resolucion" class="ff-error">{{ errors.fecha_resolucion }}</small>
        </div>

        <div class="ff-field">
          <label class="ff-label">Tipo de solución</label>
          <Select v-model="form.resolucion_id" :options="catalogos.resoluciones"
            optionLabel="etiqueta" optionValue="id"
            placeholder="Seleccionar tipo" showClear class="w-full" />
        </div>

        <!-- Tiempo de afectación calculado automáticamente -->
        <div v-if="tiempoAfectacionTexto" class="ff-field ff-span2 ff-afectacion">
          <ClockIcon class="size-[1em]" style="color:#16a34a" />
          <span>Tiempo de afectación: <strong>{{ tiempoAfectacionTexto }}</strong></span>
          <span class="ff-hint">(solución − ocurrencia, automático)</span>
        </div>

      </div>
    </div>

    <!-- ── SECCIÓN: Nota inicial (solo al crear) ────────────── -->
    <div v-if="!initial" class="ff-section">
      <div class="ff-section-title"><MessageSquareIcon class="size-[1em]" /> Nota inicial</div>
      <div class="ff-grid">
        <div class="ff-field ff-span2">
          <label class="ff-label">
            Nota
            <span class="ff-hint">(crea el primer seguimiento automáticamente)</span>
          </label>
          <Textarea v-model="form.nota_inicial" rows="2" autoResize
            placeholder="Ej: Se identificó durante monitoreo remoto..."
            class="w-full" />
        </div>
      </div>
    </div>

    <!-- ── SECCIÓN: Archivos adjuntos ─────── -->
    <div class="ff-section">
      <div class="ff-section-title"><PaperclipIcon class="size-[1em]" /> Archivos adjuntos</div>
      <!-- Dropzone -->
      <div class="ff-dropzone"
        :class="{ 'ff-dropzone--over': dropOver }"
        @dragover.prevent="dropOver = true"
        @dragleave.prevent="dropOver = false"
        @drop.prevent="onDrop"
        @click="fileInputRef.click()">
        <UploadIcon class="size-[1em]" style="font-size:18px;color:#9b89b5" />
        <span class="ff-dropzone-text">Arrastra archivos aquí o <span class="ff-dropzone-link">haz clic</span></span>
        <span class="ff-dropzone-hint">Imágenes, PDF, Excel, Word, CSV</span>
        <input ref="fileInputRef" type="file" class="ff-hidden-input"
          accept="*" multiple
          @change="onFileInputChange" />
      </div>
      <!-- Lista de archivos staged -->
      <div v-if="archivosStaged.length" class="ff-staged-list">
        <div v-for="(f, i) in archivosStaged" :key="i" class="ff-staged-row">
          <component :is="iconoArchivo(f)" class="size-[1em]" style="font-size:13px;color:#7c3aed" />
          <span class="ff-staged-name">{{ f.name }}</span>
          <span class="ff-staged-size">{{ formatSize(f.size) }}</span>
          <button type="button" class="ff-staged-remove" @click="archivosStaged.splice(i, 1)">
            <XIcon class="size-[1em]" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Notificación por correo ── -->
    <div class="ff-notif-wrap">
      <label class="ff-notif-label">
        <input type="checkbox" v-model="form.notificacion" class="ff-notif-check" />
        <SendIcon class="size-[1em]" style="color:var(--color-unergy-purple);font-size:13px" />
        <span>Enviar notificación por correo a los contactos operacionales del proyecto</span>
      </label>
      <span v-if="form.notificacion" class="ff-notif-hint">
        Se enviará a los contactos tipo "Operacional" del cliente (o del proyecto, si tiene uno propio) — configúralos en la ficha del Cliente o del Proyecto, tab Contactos.
      </span>
    </div>

    <div class="ff-footer">
      <Button label="Cancelar" severity="secondary" type="button" @click="$emit('cancel')" />
      <Button :label="initial ? 'Guardar cambios' : 'Registrar falla'" type="submit" :loading="saving">
        <template #icon><CheckIcon class="size-[1em]" /></template>
      </Button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { getEstructuraFallas } from '~/features/fallas/utils/fallasEstructuraCache'
import { AlignLeftIcon, BellIcon, CalendarIcon, CheckIcon, CircleCheckIcon, ClockIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, FileTypeIcon, ImageIcon, InfoIcon, MessageSquareIcon, PaperclipIcon, PlusIcon, SearchIcon, SendIcon, SettingsIcon, TagIcon, Trash2Icon, UploadIcon, XIcon } from '@lucide/vue'
import { iconoCategoriaFalla } from '~/features/fallas/utils/fallaTitulo'

const proyectosService = new ProyectosService()

const props = defineProps({
  initial:            { type: Object, default: null },
  catalogos:          { type: Object, required: true },
  prefillProyectoIds: { type: Array,  default: () => [] },  // pre-seleccionar proyectos al crear
  proyectos:          { type: Array,  default: () => [] },  // si el padre ya los tiene cargados, se reusan (evita refetch cada vez que se abre el diálogo)
})
const emit = defineEmits(['save', 'cancel'])

const proyectos      = ref(props.proyectos)
const saving         = ref(false)
const errors         = ref({})
const archivosStaged = ref([])  // File[] — solo al crear
const dropOver       = ref(false)
const fileInputRef   = ref(null)

function iconoArchivo(file) {
  const name = file.name || ''
  if (/\.(pdf)$/i.test(name)) return FileTextIcon
  if (/\.(xls|xlsx|csv)$/i.test(name)) return FileSpreadsheetIcon
  if (/\.(doc|docx)$/i.test(name)) return FileTypeIcon
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)) return ImageIcon
  return FileIcon
}
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function addFiles(files) {
  for (const f of Array.from(files)) {
    if (!archivosStaged.value.find(x => x.name === f.name && x.size === f.size)) {
      archivosStaged.value.push(f)
    }
  }
}
function onDrop(e) {
  dropOver.value = false
  addFiles(e.dataTransfer.files)
}
function onFileInputChange(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

const form = ref({
  proyecto_id:          props.initial?.proyecto?.id ?? props.initial?.proyecto_id ?? null,
  proyecto_ids:         [...(props.prefillProyectoIds ?? [])],  // pre-seleccionados al crear
  tipo_id:              props.initial?.tipo?.id ?? null,
  estado_id:            props.initial?.estado?.id ?? null,
  prioridad_id:         props.initial?.prioridad?.id ?? null,
  descripcion:          props.initial?.descripcion ?? '',
  // Fecha + hora de identificación en un solo campo. Al crear se sugiere el momento actual.
  fecha_identificacion: props.initial
                          ? combinaFechaHora(props.initial.fecha_identificacion, props.initial.hora_identificacion)
                          : new Date(),
  fecha_ocurrencia:     props.initial?.fecha_ocurrencia ? new Date(props.initial.fecha_ocurrencia) : null,
  fecha_resolucion:     props.initial?.fecha_resolucion ? new Date(props.initial.fecha_resolucion) : null,
  resolucion_id:        props.initial?.resolucion?.id ?? null,
  sla_limite_horas:     props.initial?.sla_limite_horas ?? null,
  causa_raiz:           props.initial?.causa_raiz ?? '',
  acciones_correctivas: props.initial?.acciones_correctivas ?? '',
  nota_inicial:         '',
  fecha_programada:     props.initial?.fecha_programada ? new Date(props.initial.fecha_programada) : null,
  notificacion:         false,   // siempre OFF por defecto — el usuario lo activa explícitamente
})

// Detectar si el estado seleccionado es "programado"
const esEstadoProgramado = computed(() => {
  if (!form.value.estado_id) return false
  const estado = props.catalogos.estados?.find(e => e.id === form.value.estado_id)
  return estado?.codigo === 'programado'
})

// Detectar si el estado seleccionado es final (falla cerrada/resuelta)
const esEstadoFinal = computed(() => {
  if (!form.value.estado_id) return false
  const estado = props.catalogos.estados?.find(e => e.id === form.value.estado_id)
  return !!estado?.es_estado_final
})

// Auto-populate description when tipo changes (only if description is empty or matches a previous auto-fill)
let lastAutoDesc = ''
watch(() => form.value.tipo_id, (newId) => {
  if (!newId) return
  const allTipos = props.catalogos.tipos ?? []
  const tipo = allTipos.find(t => t.id === newId)
  if (!tipo?.descripcion) return
  // Only auto-fill if description is empty or was previously auto-filled
  const current = form.value.descripcion?.trim() ?? ''
  if (!current || current === lastAutoDesc) {
    form.value.descripcion = tipo.descripcion
    lastAutoDesc = tipo.descripcion
  }
})

const tiposAgrupados = computed(() => {
  const groups = {}
  for (const t of props.catalogos.tipos ?? []) {
    const cat = t.categoria?.etiqueta ?? 'General'
    if (!groups[cat]) groups[cat] = { categoria: cat, items: [] }
    groups[cat].items.push(t)
  }
  return Object.values(groups)
})

// ── Reporte estructurado (jerárquico por sistema) ───────────────────────────
const estructura = ref([])  // categorías canónicas desde GET /fallas/estructura
const cls = ref({
  categoria: props.initial?.categoria_codigo ?? null,
  subtipo: props.initial?.subtipo_codigo ?? null,
  detalle: props.initial?.subtipo_detalle ?? '',
  afecta_medicion: props.initial?.frontera_afecta_medicion ?? false,
  perdida_comunicacion: props.initial?.frontera_perdida_comunicacion ?? false,
  inversores_ids: (props.initial?.inversores_afectados ?? [])
    .map(i => i.proyecto_inversor_id).filter(Boolean),
  inversores_tipos: [...new Set((props.initial?.inversores_afectados ?? [])
    .flatMap(i => i.tipos ?? []))],
})

// Editar una falla legacy (sin categoría) usa el form viejo; crear o editar
// una falla estructurada usa la jerarquía nueva.
const usarEstructura = computed(() => !props.initial || !!props.initial?.categoria_codigo)
const catActual = computed(() => estructura.value.find(c => c.codigo === cls.value.categoria) || null)
const opcionActual = computed(() => {
  if (!catActual.value || !cls.value.subtipo) return null
  return (catActual.value.opciones ?? []).find(o => o.codigo === cls.value.subtipo) || null
})
const proyectoUnicoId = computed(() => {
  if (props.initial) return form.value.proyecto_id
  return form.value.proyecto_ids?.length === 1 ? form.value.proyecto_ids[0] : null
})
// Etiqueta del selector de opciones: la define la propia estructura
// (`opciones_label`) para categorías cuyas opciones no son "eventos"
// (p.ej. la verificación en sitio de "generando pero sin datos").
const labelOpciones = computed(() =>
  catActual.value?.opciones_label || (catActual.value?.codigo === 'red' ? 'Evento de red' : 'Evento'))

function seleccionarCategoria(codigo) {
  if (cls.value.categoria === codigo) return
  cls.value.categoria = codigo
  cls.value.subtipo = null
  cls.value.detalle = ''
  cls.value.afecta_medicion = false
  cls.value.perdida_comunicacion = false
  cls.value.inversores_ids = []
  cls.value.inversores_tipos = []
}

// ── Inversores del proyecto (parametrizable) ────────────────────────────────
const inversoresProyecto = ref([])
const cargandoInv = ref(false)
const gestionInversores = ref(false)
const nuevoInv = ref({ nombre: '', potencia_nominal_kw: null })
const invError = ref('')
const potenciaAc = ref(null)

function _label(inv) {
  const kw = inv.potencia_nominal_kw != null ? `${inv.potencia_nominal_kw} kW` : 's/d'
  return `${inv.nombre || 'Inversor'} · ${kw}`
}
const sumaInversores = computed(() =>
  inversoresProyecto.value.reduce((s, i) => s + (Number(i.potencia_nominal_kw) || 0), 0))
const sumaExcede = computed(() => potenciaAc.value != null && sumaInversores.value > potenciaAc.value + 0.001)

async function cargarInversores(pid) {
  if (!pid) { inversoresProyecto.value = []; return }
  cargandoInv.value = true
  try {
    const data = await proyectosService.listarInversores(pid)
    inversoresProyecto.value = (data ?? []).map(i => ({ ...i, _label: _label(i) }))
    // potencia AC nominal del proyecto (para feedback de la regla de suma)
    try {
      const p = await proyectosService.obtener(pid)
      potenciaAc.value = p?.info_tecnica?.potencia_ac_kw != null ? Number(p.info_tecnica.potencia_ac_kw) : null
    } catch { potenciaAc.value = null }
  } catch { inversoresProyecto.value = [] }
  finally { cargandoInv.value = false }
}

async function guardarInv(inv) {
  invError.value = ''
  try {
    const data = await proyectosService.actualizarInversor(proyectoUnicoId.value, inv.id,
      { nombre: inv.nombre, potencia_nominal_kw: inv.potencia_nominal_kw })
    Object.assign(inv, data, { _label: _label(data) })
  } catch (e) {
    invError.value = e.data?.detail || 'No se pudo guardar el inversor'
    await cargarInversores(proyectoUnicoId.value)
  }
}
async function agregarInv() {
  invError.value = ''
  if (!nuevoInv.value.nombre && nuevoInv.value.potencia_nominal_kw == null) return
  try {
    await proyectosService.crearInversor(proyectoUnicoId.value, {
      nombre: nuevoInv.value.nombre || null,
      potencia_nominal_kw: nuevoInv.value.potencia_nominal_kw,
      orden: inversoresProyecto.value.length,
    })
    nuevoInv.value = { nombre: '', potencia_nominal_kw: null }
    await cargarInversores(proyectoUnicoId.value)
  } catch (e) {
    invError.value = e.data?.detail || 'No se pudo agregar el inversor'
  }
}
async function eliminarInv(inv) {
  invError.value = ''
  try {
    await proyectosService.eliminarInversor(proyectoUnicoId.value, inv.id)
    cls.value.inversores_ids = cls.value.inversores_ids.filter(id => id !== inv.id)
    await cargarInversores(proyectoUnicoId.value)
  } catch (e) {
    invError.value = e.data?.detail || 'No se pudo eliminar el inversor'
  }
}
// Config típica de minigranja (Baraya/San Pedro son excepciones → se ajustan a mano)
async function prefillMinigranja() {
  const tipica = [
    { nombre: 'Inversor 1', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 2', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 3', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 4', potencia_nominal_kw: 50 },
    { nombre: 'Inversor 5', potencia_nominal_kw: 40 },
  ]
  invError.value = ''
  for (let i = 0; i < tipica.length; i++) {
    try {
      await proyectosService.crearInversor(proyectoUnicoId.value, { ...tipica[i], orden: i })
    } catch (e) {
      invError.value = e.data?.detail || 'No se pudieron crear todos los inversores'
      break
    }
  }
  await cargarInversores(proyectoUnicoId.value)
}

// Cargar inversores cuando se elige la categoría inversores y hay un único proyecto.
watch([() => cls.value.categoria, proyectoUnicoId], ([cat, pid]) => {
  if (cat === 'inversores' && pid) cargarInversores(pid)
}, { immediate: true })

function validate() {
  const e = {}
  if (props.initial) {
    if (!form.value.proyecto_id) e.proyecto_id = 'Requerido'
  } else {
    if (!form.value.proyecto_ids?.length) e.proyecto_ids = 'Selecciona al menos un proyecto'
  }
  if (usarEstructura.value) {
    // Clasificación jerárquica por sistema
    if (!cls.value.categoria) {
      e.categoria = 'Selecciona el sistema afectado'
    } else if (catActual.value?.tipo === 'inversores') {
      if (!props.initial && form.value.proyecto_ids?.length !== 1) {
        e.proyecto_ids = 'Para inversores selecciona un solo proyecto'
      }
      if (!cls.value.inversores_ids.length) e.inversores = 'Selecciona al menos un inversor'
      if (!cls.value.inversores_tipos.length) e.invtipos = 'Selecciona al menos un tipo de falla'
    } else {
      if (!cls.value.subtipo) e.subtipo = 'Requerido'
      if (opcionActual.value?.requiere_detalle && !cls.value.detalle?.trim()) e.detalle = 'Requerido'
    }
  } else if (!form.value.tipo_id) {
    e.tipo_id = 'Requerido'
  }
  if (!form.value.estado_id)            e.estado_id = 'Requerido'
  if (!form.value.prioridad_id)         e.prioridad_id = 'Requerido'
  if (!form.value.descripcion?.trim())  e.descripcion = 'Requerido'
  if (!form.value.fecha_identificacion) e.fecha_identificacion = 'Requerido'
  if (esEstadoProgramado.value && !form.value.fecha_programada) e.fecha_programada = 'Requerido cuando el estado es Programado'
  if (esEstadoFinal.value && !form.value.fecha_resolucion) e.fecha_resolucion = 'Obligatoria al cerrar la falla (fecha y hora)'
  errors.value = e
  return Object.keys(e).length === 0
}

function formatDate(d) {
  if (!d) return null
  if (typeof d === 'string') return d
  return d.toISOString().split('T')[0]
}

// Combina una fecha "YYYY-MM-DD" y una hora "HH:MM[:SS]" en un Date local.
// Se construye con componentes locales para no desfasar el día por zona horaria.
function combinaFechaHora(fecha, hora) {
  if (!fecha) return null
  if (fecha instanceof Date) return fecha
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number)
  let hh = 0, mm = 0
  if (hora) { const p = String(hora).split(':'); hh = Number(p[0]) || 0; mm = Number(p[1]) || 0 }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0)
}

// Date → "YYYY-MM-DD" usando componentes locales (no UTC, evita corrimiento de día).
function formatFechaLocal(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Date (timeOnly) → "HH:MM" para enviar al backend
function formatHora(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Convierte horas decimales a un texto legible: "3 h 30 min", "1 d 4 h", "45 min"
function fmtDuracion(horas) {
  if (horas == null || horas < 0) return null
  const totalMin = Math.round(horas * 60)
  if (totalMin === 0) return '0 min'
  const dias = Math.floor(totalMin / 1440)
  const hrs = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  const parts = []
  if (dias) parts.push(`${dias} d`)
  if (hrs) parts.push(`${hrs} h`)
  if (min) parts.push(`${min} min`)
  return parts.join(' ')
}

// Tiempo de afectación calculado automáticamente: solución − ocurrencia.
// Si no se registró fecha de ocurrencia, usa la fecha/hora de identificación.
const tiempoAfectacionTexto = computed(() => {
  const fin = form.value.fecha_resolucion
  if (!fin) return null
  const inicio = form.value.fecha_ocurrencia || form.value.fecha_identificacion
  if (!inicio) return null
  const iniDate = inicio instanceof Date ? inicio : new Date(inicio)
  const finDate = fin instanceof Date ? fin : new Date(fin)
  const horas = (finDate - iniDate) / 3_600_000
  if (!Number.isFinite(horas) || horas < 0) return null
  return fmtDuracion(horas)
})

async function submit() {
  if (!validate()) return
  saving.value = true
  try {
    const base = {
      tipo_id:              form.value.tipo_id,
      estado_id:            form.value.estado_id,
      prioridad_id:         form.value.prioridad_id,
      descripcion:          form.value.descripcion,
      fecha_identificacion: formatFechaLocal(form.value.fecha_identificacion),
    }
    // La hora se deriva del mismo campo combinado de identificación.
    base.hora_identificacion = formatHora(form.value.fecha_identificacion)
    // Al editar se manda explícito (incluso null, para poder quitar una personalización
    // ya guardada) -- al crear el campo ni se muestra, así que no hay nada que mandar.
    if (props.initial) base.sla_limite_horas = form.value.sla_limite_horas || null
    if (form.value.fecha_ocurrencia)              base.fecha_ocurrencia     = form.value.fecha_ocurrencia.toISOString()
    // La fecha de solución solo aplica cuando el estado es final (cerrada).
    if (esEstadoFinal.value && form.value.fecha_resolucion)
      base.fecha_resolucion = form.value.fecha_resolucion instanceof Date ? form.value.fecha_resolucion.toISOString() : form.value.fecha_resolucion
    if (esEstadoFinal.value && form.value.resolucion_id)  base.resolucion_id        = form.value.resolucion_id
    if (form.value.causa_raiz?.trim())            base.causa_raiz           = form.value.causa_raiz.trim()
    if (form.value.acciones_correctivas?.trim())  base.acciones_correctivas = form.value.acciones_correctivas.trim()
    if (form.value.nota_inicial?.trim())          base.nota_inicial         = form.value.nota_inicial.trim()
    if (form.value.fecha_programada)             base.fecha_programada     = formatDate(form.value.fecha_programada)
    base.notificacion = !!form.value.notificacion

    // ── Clasificación estructurada ─────────────────────────────────────────
    let forzarProyectoUnico = null
    if (usarEstructura.value && cls.value.categoria) {
      base.categoria_codigo = cls.value.categoria
      const cat = catActual.value
      if (cat?.tipo === 'inversores') {
        // tipos compartidos aplicados a cada inversor seleccionado
        const tipos = [...cls.value.inversores_tipos]
        base.inversores = cls.value.inversores_ids.map(id => {
          const inv = inversoresProyecto.value.find(x => x.id === id) || {}
          return {
            proyecto_inversor_id: id,
            nombre: inv.nombre ?? null,
            potencia_kw: inv.potencia_nominal_kw ?? null,
            tipos,
          }
        })
        base.tipo_id = null  // el backend deriva el tipo
        forzarProyectoUnico = proyectoUnicoId.value
      } else {
        base.subtipo_codigo = cls.value.subtipo
        if (cls.value.detalle?.trim()) base.subtipo_detalle = cls.value.detalle.trim()
        if (cat?.tipo === 'equipo') {
          base.frontera_afecta_medicion = !!cls.value.afecta_medicion
          base.frontera_perdida_comunicacion = !!cls.value.perdida_comunicacion
        }
        base.tipo_id = null  // el backend mapea subtipo → tipo
      }
    }

    if (props.initial) {
      emit('save', { ...base, proyecto_id: form.value.proyecto_id, _archivos: archivosStaged.value })
    } else {
      // Para inversores se fuerza un único proyecto (los inversores le pertenecen).
      const ids = forzarProyectoUnico ? [forzarProyectoUnico] : form.value.proyecto_ids
      emit('save', { ...base, proyecto_ids: ids, _archivos: archivosStaged.value })
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  // Si el padre ya cargó proyectos (ej. GestionFallasView), se reusan --
  // solo se pide aparte si no llegaron (uso del form fuera de esa vista).
  if (!proyectos.value.length) {
    try {
      proyectos.value = await proyectosService.listar({ size: 500 })
    } catch { /* no crítico */ }
  }
  estructura.value = await getEstructuraFallas()
})
</script>

<style scoped>
.ff-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  font-family: 'Sora', system-ui, sans-serif;
}

.ff-section {
  padding: 14px 0 10px;
  border-bottom: 1px solid #f0eaf8;
}
.ff-section:last-of-type { border-bottom: none; }

.ff-section--resolve {
  background: #f0fdf4;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #bbf7d0;
  margin-bottom: 4px;
}

/* ── Clasificación estructurada (jerárquica por sistema) ───────────────── */
.ff-estructura { background: #faf8ff; border: 1px solid #ece4fb; border-radius: 12px; padding: 12px; }
.ff-sysgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px; }
.ff-syscard {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px; border: 1.5px solid #e8e0f0; border-radius: 10px; background: #fff;
  font-size: 12px; font-weight: 600; color: #4a3b6b; cursor: pointer; transition: all .12s;
}
.ff-syscard svg { font-size: 18px; }
.ff-syscard:hover { border-color: #c9b6ee; }
.ff-syscard--on { border-color: var(--color-unergy-purple); background: #f3ecff; box-shadow: 0 0 0 2px #915BD833; }
@media (max-width: 640px) { .ff-sysgrid { grid-template-columns: repeat(2, 1fr); } }

.ff-sub { margin-top: 12px; }
.ff-subfield { margin-top: 10px; }
.ff-flags { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.ff-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4a3b6b; cursor: pointer; }
.ff-check input { accent-color: var(--color-unergy-purple); width: 16px; height: 16px; }

.ff-banner {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
  font-size: 12.5px; border-radius: 8px; padding: 8px 10px;
}
.ff-banner--warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
.ff-banner--info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.ff-link { background: none; border: none; color: var(--color-unergy-purple); font-weight: 600; font-size: 12px; cursor: pointer; padding: 0; }
.ff-link svg { font-size: 11px; margin-right: 3px; }
.ff-text-danger { color: #dc2626; }

.ff-invhead { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.ff-invmanage { margin-top: 10px; background: #fff; border: 1px solid #ece4fb; border-radius: 10px; padding: 10px; }
.ff-invmanage-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #6b5a8a; margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
.ff-invrow { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ff-invrow--new { margin-top: 6px; padding-top: 8px; border-top: 1px dashed #ece4fb; }
.ff-invname { flex: 1; }
.ff-invkw { width: 120px; }
.ff-invadd, .ff-invdel { border: none; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; flex-shrink: 0; }
.ff-invadd { background: var(--color-unergy-purple); color: #fff; }
.ff-invdel { background: #fef2f2; color: #dc2626; }

.ff-section-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #6b5a8a;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.ff-section-title svg { font-size: 11px; }

.ff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}

.ff-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ff-span2 { grid-column: span 2; }

.ff-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #4a3b6b;
}
.ff-hint {
  font-weight: 400;
  color: #9b89b5;
  margin-left: 4px;
}
.ff-error {
  color: #dc2626;
  font-size: 11px;
}
.ff-afectacion {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #166534;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 8px 12px;
}
.ff-afectacion strong { font-weight: 700; }
.ff-highlight {
  background: #eff6ff;
  border: 1.5px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 12px;
}

/* ── Límite SLA personalizado ── */
.ff-sla-override-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  margin-bottom: 4px;
}
.ff-sla-override-row .ff-label { font-size: 11.5px; font-weight: 600; }
.ff-sla-override-ref { font-size: 12.5px; color: #9b89b5; }
.ff-sla-override-ref strong { color: #4a3b6b; font-weight: 700; }
.ff-sla-override-input { display: flex; align-items: center; gap: 6px; }
.ff-sla-override-clear {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; border: none;
  background: #f1eef7; color: #6b5a8a; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ff-sla-override-clear:hover { background: #e5e0ef; }
.ff-sla-override-hint { display: block; margin-top: 4px; font-size: 11px; line-height: 1.4; }

/* ── Dropzone ── */
.ff-dropzone {
  border: 1.5px dashed #c4b5e0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  background: #faf8ff;
}
.ff-dropzone:hover, .ff-dropzone--over {
  border-color: #7c3aed;
  background: #f5f0ff;
}
.ff-dropzone-text { font-size: 12px; color: #4a3b6b; }
.ff-dropzone-link { color: #7c3aed; font-weight: 600; }
.ff-dropzone-hint { font-size: 10.5px; color: #9b89b5; }
.ff-hidden-input  { display: none; }

/* ── Staged files ── */
.ff-staged-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ff-staged-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  background: #f5f0ff;
  border-radius: 6px;
  font-size: 11.5px;
}
.ff-staged-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #3b1f6b;
}
.ff-staged-size { color: #9b89b5; white-space: nowrap; }
.ff-staged-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: #dc2626;
  padding: 0 2px;
  font-size: 10px;
  opacity: .7;
}
.ff-staged-remove:hover { opacity: 1; }

.ff-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0eaf8;
  margin-top: 4px;
}

/* ── Notificación por correo ── */
.ff-notif-wrap {
  display: flex; flex-direction: column; gap: 4px;
  background: #faf8ff; border: 1.5px solid #e8e0f0; border-radius: 10px;
  padding: 10px 14px;
}
.ff-notif-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--color-unergy-deep); cursor: pointer;
}
.ff-notif-check {
  width: 16px; height: 16px; accent-color: var(--color-unergy-purple); cursor: pointer; flex-shrink: 0;
}
.ff-notif-hint {
  font-size: 11px; color: var(--color-unergy-purple); margin-left: 24px; line-height: 1.4;
}
</style>
