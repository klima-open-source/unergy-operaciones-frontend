<template>
  <div class="pg-wrap">
    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastMsg" class="pg-toast" :class="toastErr ? 'pg-toast-err' : 'pg-toast-ok'">{{ toastMsg }}</div>
    </transition>

    <!-- Barra superior: crear portafolio -->
    <div class="pg-toolbar">
      <div class="pg-hint">
        <InfoIcon class="size-[1em]" />
        Arrastra proyectos entre capas. Cada capa es un portafolio; el cambio se guarda automáticamente.
      </div>
      <div class="pg-create">
        <input v-model="nuevoNombre" class="pg-input" placeholder="Nombre del nuevo portafolio…"
               @keyup.enter="crear" />
        <button class="pg-btn pg-btn-primary" :disabled="!nuevoNombre.trim() || creando" @click="crear">
          <PlusIcon class="size-[1em]" /> Crear capa
        </button>
        <button class="pg-btn pg-btn-ghost" :disabled="loading" @click="cargar" v-tooltip.bottom="'Recargar'">
          <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
          <RefreshCwIcon v-else class="size-[1em]" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="pg-state">
      <ProgressSpinner style="width:32px;height:32px" /> <span>Cargando portafolios…</span>
    </div>

    <div v-else class="pg-board">
      <!-- Pool: proyectos sin portafolio -->
      <section class="pg-col pg-col-pool">
        <header class="pg-col-head">
          <div class="pg-col-title"><InboxIcon class="size-[1em]" /> Sin portafolio</div>
          <span class="pg-col-count">{{ sinPortafolio.length }}</span>
        </header>
        <draggable v-model="sinPortafolio" :group="{ name: 'proyectos' }" item-key="id"
                   class="pg-col-body" :animation="160"
                   @change="onChange($event, null)">
          <template #item="{ element }">
            <div class="pg-card pg-card-pool">
              <ZapIcon class="pg-card-ico size-[1em]" />
              <div class="pg-card-info">
                <div class="pg-card-nombre">{{ element.nombre }}</div>
                <div class="pg-card-sub" v-if="element.municipio">{{ element.municipio }}</div>
              </div>
            </div>
          </template>
          <template #footer>
            <div v-if="!sinPortafolio.length" class="pg-empty">Todos los proyectos operativos están asignados ✓</div>
          </template>
        </draggable>
      </section>

      <!-- Capas (portafolios) -->
      <section v-for="pt in portafolios" :key="pt.id" class="pg-col pg-col-layer">
        <header class="pg-col-head">
          <template v-if="editandoId === pt.id">
            <input v-model="editandoNombre" class="pg-input pg-input-sm" @keyup.enter="renombrar(pt)"
                   @keyup.esc="editandoId = null" />
            <button class="pg-icon-btn" @click="renombrar(pt)" v-tooltip.bottom="'Guardar'"><CheckIcon class="size-[1em]" /></button>
            <button class="pg-icon-btn" @click="editandoId = null" v-tooltip.bottom="'Cancelar'"><XIcon class="size-[1em]" /></button>
          </template>
          <template v-else>
            <div class="pg-col-title"><FolderIcon class="size-[1em]" /> {{ pt.nombre }}</div>
            <span class="pg-col-count">{{ pt.proyectos.length }}</span>
            <div class="pg-col-actions">
              <button class="pg-icon-btn" @click="empezarEdicion(pt)" v-tooltip.bottom="'Renombrar'"><PencilIcon class="size-[1em]" /></button>
              <button class="pg-icon-btn pg-icon-del" @click="eliminar(pt)" v-tooltip.bottom="'Eliminar capa'"><Trash2Icon class="size-[1em]" /></button>
            </div>
          </template>
        </header>
        <draggable v-model="pt.proyectos" :group="{ name: 'proyectos' }" item-key="id"
                   class="pg-col-body" :animation="160"
                   @change="onChange($event, pt.id)">
          <template #item="{ element }">
            <div class="pg-card">
              <ZapIcon class="pg-card-ico size-[1em]" />
              <div class="pg-card-info">
                <div class="pg-card-nombre">{{ element.nombre }}</div>
                <div class="pg-card-sub" v-if="element.municipio">{{ element.municipio }}</div>
              </div>
            </div>
          </template>
          <template #footer>
            <div v-if="!pt.proyectos.length" class="pg-empty pg-drop-hint">Arrastra proyectos aquí</div>
          </template>
        </draggable>
      </section>

      <div v-if="!portafolios.length" class="pg-state pg-state-empty">
        <FolderOpenIcon class="text-3xl size-[1em]" style="color:#A89EC0" />
        <p>No hay portafolios todavía. Crea uno arriba y arrástrale proyectos.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import draggable from 'vuedraggable'
import ProgressSpinner from 'primevue/progressspinner'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import { CheckIcon, FolderIcon, FolderOpenIcon, InboxIcon, InfoIcon, LoaderCircleIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon, ZapIcon } from '@lucide/vue'

const portafoliosService = new PortafoliosService()

const loading = ref(false)
const creando = ref(false)
const portafolios = ref([])      // [{id, nombre, descripcion, activo, proyectos:[...]}]
const sinPortafolio = ref([])    // [{id, nombre, sub_project, municipio}]
const nuevoNombre = ref('')
const editandoId = ref(null)
const editandoNombre = ref('')

const toastMsg = ref('')
const toastErr = ref(false)
let _t = null
function toast(msg, err = false) {
  toastMsg.value = msg; toastErr.value = err
  if (_t) clearTimeout(_t)
  _t = setTimeout(() => { toastMsg.value = '' }, 3500)
}

async function cargar() {
  loading.value = true
  try {
    const data = await portafoliosService.listar()
    portafolios.value = (data.portafolios || []).map(p => ({ ...p, proyectos: p.proyectos || [] }))
    sinPortafolio.value = data.sin_portafolio || []
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  } finally {
    loading.value = false
  }
}

// Persistir la asignación cuando un proyecto entra a una lista (added = destino)
async function onChange(evt, portafolioId) {
  if (!evt.added) return
  const proyecto = evt.added.element
  try {
    await portafoliosService.asignarProyecto(proyecto.id, portafolioId)
    toast(portafolioId ? `✅ ${proyecto.nombre} → portafolio` : `✅ ${proyecto.nombre} sin portafolio`)
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
    cargar()  // revertir al estado real
  }
}

async function crear() {
  const nombre = nuevoNombre.value.trim()
  if (!nombre) return
  creando.value = true
  try {
    const data = await portafoliosService.crear(nombre)
    portafolios.value.push({ ...data, proyectos: data.proyectos || [] })
    portafolios.value.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    nuevoNombre.value = ''
    toast('✅ Portafolio creado')
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  } finally {
    creando.value = false
  }
}

function empezarEdicion(pt) { editandoId.value = pt.id; editandoNombre.value = pt.nombre }
async function renombrar(pt) {
  const nombre = editandoNombre.value.trim()
  if (!nombre || nombre === pt.nombre) { editandoId.value = null; return }
  try {
    await portafoliosService.renombrar(pt.id, nombre)
    pt.nombre = nombre
    portafolios.value.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    toast('✅ Renombrado')
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  } finally {
    editandoId.value = null
  }
}

async function eliminar(pt) {
  const msg = pt.proyectos.length
    ? `¿Eliminar el portafolio "${pt.nombre}"? Sus ${pt.proyectos.length} proyecto(s) volverán a "Sin portafolio".`
    : `¿Eliminar el portafolio "${pt.nombre}"?`
  if (!confirm(msg)) return
  try {
    await portafoliosService.eliminar(pt.id)
    toast('🗑️ Portafolio eliminado')
    cargar()
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  }
}

onMounted(cargar)
</script>

<style scoped>
.pg-wrap { font-family: 'Sora', system-ui, sans-serif; padding: 12px 16px 30px; }

.pg-toast {
  position: fixed; top: 80px; right: 24px; padding: 11px 16px; border-radius: 10px;
  font-size: 13px; font-weight: 700; z-index: 60; box-shadow: 0 4px 18px rgba(0,0,0,.16);
}
.pg-toast-ok  { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
.pg-toast-err { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.pg-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 12px;
}
.pg-hint { font-size: 11px; color: #6B5A8A; display: inline-flex; align-items: center; gap: 6px; }
.pg-create { display: inline-flex; align-items: center; gap: 8px; }
.pg-input {
  border: 1px solid #E5E2EC; border-radius: 8px; padding: 7px 10px; font-size: 13px;
  font-family: inherit; min-width: 220px; outline: none;
}
.pg-input:focus { border-color: var(--color-unergy-purple); box-shadow: 0 0 0 3px rgba(145,91,216,.12); }
.pg-input-sm { min-width: 120px; padding: 4px 8px; font-size: 12px; font-weight: 700; }
.pg-btn {
  display: inline-flex; align-items: center; gap: 5px; border: none; border-radius: 8px;
  padding: 7px 12px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.pg-btn-primary { background: var(--color-unergy-purple); color: #fff; }
.pg-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.pg-btn-ghost { background: #F4F1FA; color: #6B5A8A; border: 1px solid #E5E2EC; }

.pg-state { display: flex; align-items: center; gap: 10px; color: #6B5A8A; font-size: 13px; padding: 40px; justify-content: center; }
.pg-state-empty { flex-direction: column; }

.pg-board {
  display: flex; gap: 14px; align-items: flex-start; overflow-x: auto; padding-bottom: 10px;
}
.pg-col {
  flex: 0 0 270px; background: #fff; border: 1px solid #ECE7F2; border-radius: 12px;
  display: flex; flex-direction: column; max-height: calc(100vh - 200px);
}
.pg-col-pool { background: #FAF8FE; border-style: dashed; }
.pg-col-head {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid #ECE7F2;
}
.pg-col-title {
  font-size: 13px; font-weight: 800; color: var(--color-unergy-deep); display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
}
.pg-col-title svg { color: var(--color-unergy-purple); font-size: 13px; }
.pg-col-count {
  background: #EDE9FE; color: #6D28D9; border-radius: 9px; padding: 0 8px;
  font-size: 11px; font-weight: 800;
}
.pg-col-actions { display: inline-flex; gap: 2px; }
.pg-icon-btn {
  width: 24px; height: 24px; border: 1px solid #E5E2EC; background: #fff; border-radius: 6px;
  cursor: pointer; color: #6B5A8A; font-size: 11px; display: inline-flex; align-items: center; justify-content: center;
}
.pg-icon-btn:hover { background: #F4F1FA; color: var(--color-unergy-deep); }
.pg-icon-del:hover { background: #FEE2E2; color: #DC2626; border-color: #FECACA; }

.pg-col-body { padding: 8px; overflow-y: auto; min-height: 60px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
.pg-card {
  display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #E9D5FF;
  border-radius: 9px; padding: 8px 10px; cursor: grab; transition: box-shadow .12s, border-color .12s;
}
.pg-card:hover { border-color: var(--color-unergy-purple); box-shadow: 0 2px 8px rgba(145,91,216,.15); }
.pg-card:active { cursor: grabbing; }
.pg-card-pool { border-color: #E5E2EC; }
.pg-card-ico { color: #F59E0B; font-size: 13px; }
.pg-card-info { min-width: 0; }
.pg-card-nombre { font-size: 12px; font-weight: 700; color: var(--color-unergy-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-card-sub { font-size: 10px; color: #9CA3AF; }
.pg-empty { font-size: 11px; color: #A89EC0; text-align: center; padding: 14px 8px; }
.pg-drop-hint { border: 1px dashed #DAD3EA; border-radius: 8px; }
/* clase de vuedraggable mientras se arrastra */
.sortable-ghost { opacity: .5; background: #F3E8FF; }
</style>
