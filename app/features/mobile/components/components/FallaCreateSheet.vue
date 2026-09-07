<template>
  <Teleport to="body">
    <Transition name="fsheet">
      <div v-if="open" class="fc-backdrop" @click.self="close">
        <div class="fc-sheet">
          <div class="fc-grab" />
          <div class="fc-header">
            <span class="fc-title"><CirclePlusIcon class="size-[1em]" /> Registrar falla</span>
            <button class="fc-close" @click="close"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="fc-body">
            <!-- Proyecto -->
            <label class="fc-label">Proyecto <span class="fc-req">*</span>
              <select v-model="f.proyecto_id" class="fc-select" :class="{ 'fc-invalid': err.proyecto_id }">
                <option :value="null" disabled>Selecciona un proyecto…</option>
                <option v-for="p in proyectos" :key="p.id" :value="p.id">{{ p.nombre_comercial }}</option>
              </select>
            </label>

            <!-- Sistema afectado -->
            <div class="fc-field">
              <span class="fc-label-txt">Sistema afectado <span class="fc-req">*</span></span>
              <div class="fc-chips">
                <button v-for="c in estructura" :key="c.codigo" type="button"
                  :class="['fc-chip', f.categoria === c.codigo && 'fc-chip--on']"
                  :style="f.categoria === c.codigo ? chipOn(c.color_hex) : {}"
                  @click="seleccionarCategoria(c.codigo)">
                  <component :is="iconoCategoriaFalla(c.codigo)" class="size-[1em]" /> {{ c.etiqueta }}
                </button>
              </div>
              <small v-if="err.categoria" class="fc-fielderr">Selecciona el sistema</small>
            </div>

            <!-- RED / EVENTOS: opción única -->
            <template v-if="catActual && catActual.tipo === 'opcion'">
              <label class="fc-label">{{ labelOpciones }} <span class="fc-req">*</span>
                <select v-model="f.subtipo" class="fc-select" :class="{ 'fc-invalid': err.subtipo }">
                  <option :value="null" disabled>Selecciona…</option>
                  <option v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">{{ o.etiqueta }}</option>
                </select>
              </label>
              <div v-if="opcionActual?.pendiente_reclasificar" class="fc-banner fc-banner--warn">
                Quedará <strong>pendiente de reclasificar</strong> hasta conocer la causa.
              </div>
              <label v-if="opcionActual?.requiere_detalle" class="fc-label">
                {{ opcionActual.detalle_label || 'Detalle' }} <span class="fc-req">*</span>
                <textarea v-model="f.detalle" rows="2" class="fc-textarea" :class="{ 'fc-invalid': err.detalle }"
                  placeholder="Describe el motivo específico…"></textarea>
              </label>
            </template>

            <!-- FRONTERA: equipo + flags -->
            <template v-else-if="catActual && catActual.tipo === 'equipo'">
              <label class="fc-label">Equipo de frontera <span class="fc-req">*</span>
                <select v-model="f.subtipo" class="fc-select" :class="{ 'fc-invalid': err.subtipo }">
                  <option :value="null" disabled>Selecciona equipo…</option>
                  <option v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">{{ o.etiqueta }}</option>
                </select>
              </label>
              <label class="fc-check"><input type="checkbox" v-model="f.afecta_medicion" /> Afecta la medición de la frontera</label>
              <label class="fc-check"><input type="checkbox" v-model="f.perdida_comunicacion" /> Pérdida de comunicación de la frontera</label>
              <div v-if="f.perdida_comunicacion" class="fc-banner fc-banner--info">Generará alarma de comunicaciones de frontera.</div>
            </template>

            <!-- INVERSORES -->
            <template v-else-if="catActual && catActual.tipo === 'inversores'">
              <div v-if="!f.proyecto_id" class="fc-banner fc-banner--warn">Selecciona primero el proyecto.</div>
              <template v-else>
                <span class="fc-label-txt">Inversores afectados <span class="fc-req">*</span></span>
                <div v-if="cargandoInv" class="fc-hint">Cargando…</div>
                <div v-else-if="!inversores.length" class="fc-banner fc-banner--warn">
                  Sin inversores configurados.
                  <button type="button" class="fc-linkb" @click="prefillMinigranja">Crear config típica minigranja</button>
                </div>
                <div v-else class="fc-chips">
                  <button v-for="inv in inversores" :key="inv.id" type="button"
                    :class="['fc-chip', f.inversores_ids.includes(inv.id) && 'fc-chip--on']"
                    :style="f.inversores_ids.includes(inv.id) ? chipOn('var(--color-unergy-purple)') : {}"
                    @click="toggleInv(inv.id)">{{ inv.nombre || 'Inversor' }} · {{ inv.potencia_nominal_kw || '?' }}kW</button>
                </div>
                <small v-if="err.inversores" class="fc-fielderr">Selecciona al menos un inversor</small>

                <!-- mini-agregar inversor -->
                <div v-if="inversores.length" class="fc-invadd">
                  <input v-model="nuevoInv.nombre" class="fc-input fc-invname" placeholder="Nuevo inversor" />
                  <input v-model.number="nuevoInv.potencia_nominal_kw" type="number" class="fc-input fc-invkw" placeholder="kW" />
                  <button type="button" class="fc-invaddbtn" @click="agregarInv"><PlusIcon class="size-[1em]" /></button>
                </div>
                <small v-if="invError" class="fc-fielderr">{{ invError }}</small>

                <span class="fc-label-txt" style="margin-top:8px;display:block">Tipo(s) de falla <span class="fc-req">*</span></span>
                <div class="fc-chips">
                  <button v-for="t in catActual.tipos_falla" :key="t.codigo" type="button"
                    :class="['fc-chip', f.inversores_tipos.includes(t.codigo) && 'fc-chip--on']"
                    :style="f.inversores_tipos.includes(t.codigo) ? chipOn('var(--color-unergy-purple)') : {}"
                    @click="toggleTipo(t.codigo)">{{ t.etiqueta }}</button>
                </div>
                <small v-if="err.invtipos" class="fc-fielderr">Selecciona al menos un tipo</small>
                <div v-if="f.inversores_tipos.includes('perdida_comunicacion')" class="fc-banner fc-banner--info">Generará alarma de comunicaciones de inversores.</div>
              </template>
            </template>

            <!-- Prioridad -->
            <div class="fc-field">
              <span class="fc-label-txt">Prioridad <span class="fc-req">*</span></span>
              <div class="fc-chips">
                <button v-for="p in catalogos.prioridades" :key="p.id" type="button"
                  :class="['fc-chip', f.prioridad_id === p.id && 'fc-chip--on']"
                  :style="f.prioridad_id === p.id ? chipOn(colorPrioridad(p.codigo)) : {}"
                  @click="f.prioridad_id = p.id">{{ p.etiqueta }}</button>
              </div>
            </div>

            <!-- Estado -->
            <div class="fc-field">
              <span class="fc-label-txt">Estado <span class="fc-req">*</span></span>
              <div class="fc-chips">
                <button v-for="e in catalogos.estados" :key="e.id" type="button"
                  :class="['fc-chip', f.estado_id === e.id && 'fc-chip--on']"
                  :style="f.estado_id === e.id ? chipOn(colorEstado(e.codigo)) : {}"
                  @click="f.estado_id = e.id">{{ e.etiqueta }}</button>
              </div>
            </div>

            <!-- Descripción -->
            <label class="fc-label">Descripción <span class="fc-req">*</span>
              <textarea v-model="f.descripcion" rows="3" class="fc-textarea" :class="{ 'fc-invalid': err.descripcion }"
                placeholder="¿Qué está pasando?"></textarea>
            </label>

            <!-- Fecha -->
            <label class="fc-label">Fecha de identificación <span class="fc-req">*</span>
              <input v-model="f.fecha_identificacion" type="date" class="fc-input" />
            </label>

            <!-- Nota opcional -->
            <label class="fc-label">Nota inicial (opcional)
              <textarea v-model="f.nota" rows="2" class="fc-textarea" placeholder="Detalle / observación…"></textarea>
            </label>

            <div v-if="error" class="fc-error"><TriangleAlertIcon class="size-[1em]" /> {{ error }}</div>
          </div>

          <button class="fc-submit" :disabled="saving" @click="submit">
            <LoaderCircleIcon class="size-[1em] animate-spin" v-if="saving" /><CheckIcon class="size-[1em]" v-else />
            {{ saving ? 'Registrando…' : 'Registrar falla' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { FallasService } from '~/features/fallas/services/fallas'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { CheckIcon, CirclePlusIcon, LoaderCircleIcon, PlusIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import { iconoCategoriaFalla } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()

const props = defineProps({
  open:            { type: Boolean, default: false },
  catalogos:       { type: Object, default: () => ({ estados: [], prioridades: [], tipos: [] }) },
  proyectos:       { type: Array, default: () => [] },
  prefillProyectoId: { type: [Number, String], default: null },
})
const emit = defineEmits(['close', 'created'])

const f = reactive({
  proyecto_id: null,
  categoria: null, subtipo: null, detalle: '',
  afecta_medicion: false, perdida_comunicacion: false,
  inversores_ids: [], inversores_tipos: [],
  prioridad_id: null, estado_id: null, descripcion: '',
  fecha_identificacion: '', nota: '',
})
const err = reactive({})
const error = ref('')
const saving = ref(false)

const estructura = ref([])
const inversores = ref([])
const cargandoInv = ref(false)
const nuevoInv = reactive({ nombre: '', potencia_nominal_kw: null })
const invError = ref('')

const catActual = computed(() => estructura.value.find(c => c.codigo === f.categoria) || null)
const opcionActual = computed(() => {
  if (!catActual.value || !f.subtipo) return null
  return (catActual.value.opciones ?? []).find(o => o.codigo === f.subtipo) || null
})
// La estructura puede nombrar su propio selector (`opciones_label`) cuando las
// opciones no son "eventos" (p.ej. verificación en sitio).
const labelOpciones = computed(() =>
  catActual.value?.opciones_label || (catActual.value?.codigo === 'red' ? 'Evento de red' : 'Evento'))

function chipOn(color) {
  const c = color || '#915BD8'
  return { background: c, borderColor: c, color: '#fff' }
}

function seleccionarCategoria(codigo) {
  f.categoria = codigo
  f.subtipo = null; f.detalle = ''
  f.afecta_medicion = false; f.perdida_comunicacion = false
  f.inversores_ids = []; f.inversores_tipos = []
  if (codigo === 'inversores' && f.proyecto_id) cargarInversores()
}
function toggleInv(id) {
  const i = f.inversores_ids.indexOf(id)
  if (i >= 0) f.inversores_ids.splice(i, 1); else f.inversores_ids.push(id)
}
function toggleTipo(codigo) {
  const i = f.inversores_tipos.indexOf(codigo)
  if (i >= 0) f.inversores_tipos.splice(i, 1); else f.inversores_tipos.push(codigo)
}

async function cargarInversores() {
  if (!f.proyecto_id) { inversores.value = []; return }
  cargandoInv.value = true
  try {
    const data = await proyectosService.listarInversores(f.proyecto_id)
    inversores.value = data ?? []
  } catch { inversores.value = [] }
  finally { cargandoInv.value = false }
}
async function agregarInv() {
  invError.value = ''
  if (!nuevoInv.nombre && nuevoInv.potencia_nominal_kw == null) return
  try {
    await proyectosService.crearInversor(f.proyecto_id,
      { nombre: nuevoInv.nombre || null, potencia_nominal_kw: nuevoInv.potencia_nominal_kw, orden: inversores.value.length })
    nuevoInv.nombre = ''; nuevoInv.potencia_nominal_kw = null
    await cargarInversores()
  } catch (e) { invError.value = e.data?.detail || 'No se pudo agregar' }
}
async function prefillMinigranja() {
  invError.value = ''
  const tipica = [['Inversor 1', 300], ['Inversor 2', 300], ['Inversor 3', 300], ['Inversor 4', 50], ['Inversor 5', 40]]
  for (let i = 0; i < tipica.length; i++) {
    try { await proyectosService.crearInversor(f.proyecto_id, { nombre: tipica[i][0], potencia_nominal_kw: tipica[i][1], orden: i }) }
    catch (e) { invError.value = e.data?.detail || 'Error creando inversores'; break }
  }
  await cargarInversores()
}

// recargar inversores al cambiar de proyecto si la categoría es inversores
watch(() => f.proyecto_id, () => { if (f.categoria === 'inversores') cargarInversores() })

// Al abrir: limpiar + defaults + cargar estructura
watch(() => props.open, async (o) => {
  if (!o) return
  const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  Object.assign(f, {
    proyecto_id: props.prefillProyectoId ?? null,
    categoria: null, subtipo: null, detalle: '',
    afecta_medicion: false, perdida_comunicacion: false,
    inversores_ids: [], inversores_tipos: [],
    prioridad_id: null, estado_id: null, descripcion: '', fecha_identificacion: today, nota: '',
  })
  Object.keys(err).forEach(k => delete err[k])
  error.value = ''; invError.value = ''
  inversores.value = []
  const abierta = (props.catalogos.estados || []).find(e => e.codigo === 'abierta')
    || (props.catalogos.estados || []).find(e => !e.es_estado_final)
  if (abierta) f.estado_id = abierta.id
  const media = (props.catalogos.prioridades || []).find(p => p.codigo === 'media')
  if (media) f.prioridad_id = media.id
  if (!estructura.value.length) {
    try { estructura.value = await fallasService.obtenerEstructura() } catch { /* */ }
  }
})

function validate() {
  Object.keys(err).forEach(k => delete err[k])
  if (!f.proyecto_id) err.proyecto_id = true
  if (!f.categoria) err.categoria = true
  else if (catActual.value?.tipo === 'inversores') {
    if (!f.inversores_ids.length) err.inversores = true
    if (!f.inversores_tipos.length) err.invtipos = true
  } else {
    if (!f.subtipo) err.subtipo = true
    if (opcionActual.value?.requiere_detalle && !f.detalle.trim()) err.detalle = true
  }
  if (!f.prioridad_id) err.prioridad = true
  if (!f.estado_id) err.estado = true
  if (!f.descripcion.trim()) err.descripcion = true
  return Object.keys(err).length === 0
}

function close() { emit('close') }

async function submit() {
  error.value = ''
  if (!validate()) { error.value = 'Completa los campos obligatorios (*)'; return }
  saving.value = true
  try {
    const payload = {
      proyecto_id: f.proyecto_id,
      estado_id: f.estado_id,
      prioridad_id: f.prioridad_id,
      descripcion: f.descripcion.trim(),
      fecha_identificacion: f.fecha_identificacion,
      categoria_codigo: f.categoria,
      notificacion: false,
    }
    const cat = catActual.value
    if (cat?.tipo === 'inversores') {
      const tipos = [...f.inversores_tipos]
      payload.inversores = f.inversores_ids.map(id => {
        const inv = inversores.value.find(x => x.id === id) || {}
        return { proyecto_inversor_id: id, nombre: inv.nombre ?? null, potencia_kw: inv.potencia_nominal_kw ?? null, tipos }
      })
    } else {
      payload.subtipo_codigo = f.subtipo
      if (f.detalle.trim()) payload.subtipo_detalle = f.detalle.trim()
      if (cat?.tipo === 'equipo') {
        payload.frontera_afecta_medicion = !!f.afecta_medicion
        payload.frontera_perdida_comunicacion = !!f.perdida_comunicacion
      }
    }

    const nueva = await fallasService.crear(payload)
    if (f.nota.trim()) {
      try { await fallasService.crearSeguimiento(nueva.id, { nota: f.nota.trim() }) } catch { /* no crítico */ }
    }
    emit('created', nueva)
    emit('close')
  } catch (e) {
    error.value = e.data?.detail || 'No se pudo registrar la falla'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.fc-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(28,18,50,0.45); display: flex; align-items: flex-end; }
.fc-sheet {
  width: 100%; max-height: 92vh; display: flex; flex-direction: column; background: #fff;
  border-radius: 22px 22px 0 0; padding: 10px 18px calc(14px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0,0,0,0.2);
}
.fc-grab { width: 40px; height: 4px; border-radius: 2px; background: #e5e7eb; margin: 4px auto 12px; }
.fc-header { display: flex; align-items: center; margin-bottom: 12px; }
.fc-title { flex: 1; font-size: 16px; font-weight: 700; color: var(--color-unergy-deep); }
.fc-title svg { color: var(--color-unergy-purple); margin-right: 6px; }
.fc-close { background: none; border: none; color: #9ca3af; font-size: 16px; padding: 4px; }

.fc-body { overflow-y: auto; flex: 1; }
.fc-label { display: block; font-size: 12.5px; font-weight: 600; color: #6b5a8a; margin-bottom: 14px; }
.fc-label-txt { font-size: 12.5px; font-weight: 600; color: #6b5a8a; }
.fc-req { color: #dc2626; }
.fc-field { margin-bottom: 14px; }
.fc-hint { font-size: 12px; color: #9ca3af; margin: 6px 0; }
.fc-select, .fc-input, .fc-textarea {
  width: 100%; margin-top: 6px; padding: 13px 14px; font-size: 16px;
  border: 1.5px solid #e8e0f0; border-radius: 12px; color: var(--color-unergy-deep); background: #fff;
  font-family: inherit;
}
.fc-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L2 4h8z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }
.fc-textarea { resize: none; }
.fc-input:focus, .fc-select:focus, .fc-textarea:focus { outline: none; border-color: var(--color-unergy-purple); }
.fc-invalid { border-color: #dc2626 !important; }
.fc-fielderr { display: block; color: #dc2626; font-size: 11.5px; margin-top: 4px; }

.fc-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.fc-chip {
  padding: 9px 14px; border-radius: 11px; border: 1.5px solid #e5e7eb; background: #fff;
  font-size: 14px; font-weight: 600; color: #6b5a8a;
}
.fc-chip svg { font-size: 12px; margin-right: 4px; }

.fc-check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #4a3b6b; margin: 10px 0 0; }
.fc-check input { accent-color: var(--color-unergy-purple); width: 18px; height: 18px; }

.fc-banner { font-size: 12.5px; border-radius: 8px; padding: 8px 10px; margin-top: 10px; }
.fc-banner--warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
.fc-banner--info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.fc-linkb { background: none; border: none; color: var(--color-unergy-purple); font-weight: 700; font-size: 12.5px; padding: 0; margin-left: 4px; }

.fc-invadd { display: flex; gap: 8px; margin-top: 8px; }
.fc-invname { flex: 1; margin-top: 0; }
.fc-invkw { width: 90px; margin-top: 0; }
.fc-invaddbtn { background: var(--color-unergy-purple); color: #fff; border: none; border-radius: 12px; width: 46px; flex-shrink: 0; }

.fc-error { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #b91c1c; background: #fef2f2; border-radius: 10px; padding: 10px 12px; margin: 4px 0; }
.fc-submit {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 15px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700;
  color: #fff; background: var(--color-unergy-purple); margin-top: 10px; flex-shrink: 0;
}
.fc-submit:disabled { opacity: .5; }

.fsheet-enter-active, .fsheet-leave-active { transition: opacity .2s ease; }
.fsheet-enter-active .fc-sheet, .fsheet-leave-active .fc-sheet { transition: transform .25s ease; }
.fsheet-enter-from, .fsheet-leave-to { opacity: 0; }
.fsheet-enter-from .fc-sheet, .fsheet-leave-to .fc-sheet { transform: translateY(100%); }
</style>
