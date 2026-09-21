<template>
  <div class="flex flex-col gap-4">
    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastMsg" class="pg-toast" :class="toastErr ? 'pg-toast-err' : 'pg-toast-ok'">
        {{ toastMsg }}
      </div>
    </transition>

    <!-- Barra superior: crear portafolio -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <InfoIcon class="size-3.5 shrink-0" />
        Arrastra proyectos entre capas. Cada capa es un portafolio; el cambio se guarda
        automáticamente.
      </p>
      <div class="flex items-center gap-2">
        <ButtonGroup>
          <Input
            v-model="nuevoNombre"
            placeholder="Nombre del nuevo portafolio…"
            class="w-56"
            @keyup.enter="crear"
          />
          <Button :disabled="!nuevoNombre.trim() || creando" @click="crear">
            <PlusIcon /> Crear capa
          </Button>
        </ButtonGroup>
        <Button
          variant="outline"
          size="icon"
          :disabled="loading"
          title="Recargar"
          @click="cargar"
        >
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <RefreshCwIcon v-else />
        </Button>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
    >
      <LoaderCircleIcon class="size-7 animate-spin text-primary" />
      <span class="text-sm">Cargando portafolios...</span>
    </div>

    <div v-else class="flex items-start gap-3.5 overflow-x-auto pb-2.5">
      <!-- Pool: proyectos sin portafolio -->
      <Card class="flex max-h-[calc(100vh-200px)] w-[270px] shrink-0 flex-col border-dashed bg-muted/30">
        <CardHeader>
          <CardTitle class="flex items-center gap-1.5 text-sm">
            <InboxIcon class="size-4 text-primary" /> Sin portafolio
          </CardTitle>
          <CardAction>
            <Badge variant="secondary">{{ sinPortafolio.length }}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent class="min-h-0 flex-1 overflow-y-auto">
          <draggable
            v-model="sinPortafolio"
            :group="{ name: 'proyectos' }"
            item-key="id"
            class="flex flex-col gap-1.5"
            :animation="160"
            @change="onChange($event, null)"
          >
            <template #item="{ element }">
              <div
                class="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary active:cursor-grabbing"
              >
                <ZapIcon class="size-4 shrink-0 text-warning" />
                <div class="min-w-0">
                  <div class="truncate text-xs font-bold text-foreground">
                    {{ element.nombre }}
                  </div>
                  <div v-if="element.municipio" class="text-[10px] text-muted-foreground">
                    {{ element.municipio }}
                  </div>
                </div>
              </div>
            </template>
            <template #footer>
              <p v-if="!sinPortafolio.length" class="py-3.5 text-center text-xs text-muted-foreground">
                Todos los proyectos operativos están asignados ✓
              </p>
            </template>
          </draggable>
        </CardContent>
      </Card>

      <!-- Capas (portafolios) -->
      <Card
        v-for="pt in portafolios"
        :key="pt.id"
        class="flex max-h-[calc(100vh-200px)] w-[270px] shrink-0 flex-col"
      >
        <CardHeader>
          <template v-if="editandoId === pt.id">
            <Input
              v-model="editandoNombre"
              class="h-8 text-sm font-bold"
              @keyup.enter="renombrar(pt)"
              @keyup.esc="editandoId = null"
            />
            <CardAction>
              <ButtonGroup>
                <Button variant="ghost" size="icon-sm" title="Guardar" @click="renombrar(pt)">
                  <CheckIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Cancelar" @click="editandoId = null">
                  <XIcon />
                </Button>
              </ButtonGroup>
            </CardAction>
          </template>
          <template v-else>
            <CardTitle class="flex min-w-0 items-center gap-1.5 text-sm">
              <FolderIcon class="size-4 shrink-0 text-primary" />
              <span class="truncate">{{ pt.nombre }}</span>
            </CardTitle>
            <CardAction class="flex items-center gap-1">
              <Badge variant="secondary">{{ pt.proyectos.length }}</Badge>
              <ButtonGroup>
                <Button variant="ghost" size="icon-sm" title="Renombrar" @click="empezarEdicion(pt)">
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Eliminar capa"
                  class="hover:bg-destructive/10 hover:text-destructive"
                  @click="eliminar(pt)"
                >
                  <Trash2Icon />
                </Button>
              </ButtonGroup>
            </CardAction>
          </template>
        </CardHeader>
        <CardContent class="min-h-0 flex-1 overflow-y-auto">
          <draggable
            v-model="pt.proyectos"
            :group="{ name: 'proyectos' }"
            item-key="id"
            class="flex flex-col gap-1.5"
            :animation="160"
            @change="onChange($event, pt.id)"
          >
            <template #item="{ element }">
              <div
                class="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary active:cursor-grabbing"
              >
                <ZapIcon class="size-4 shrink-0 text-warning" />
                <div class="min-w-0">
                  <div class="truncate text-xs font-bold text-foreground">
                    {{ element.nombre }}
                  </div>
                  <div v-if="element.municipio" class="text-[10px] text-muted-foreground">
                    {{ element.municipio }}
                  </div>
                </div>
              </div>
            </template>
            <template #footer>
              <p
                v-if="!pt.proyectos.length"
                class="rounded-md border border-dashed border-border py-3.5 text-center text-xs text-muted-foreground"
              >
                Arrastra proyectos aquí
              </p>
            </template>
          </draggable>
        </CardContent>
      </Card>

      <div
        v-if="!portafolios.length"
        class="flex w-full flex-col items-center gap-2 py-10 text-center"
      >
        <FolderOpenIcon class="size-8 text-muted-foreground/50" />
        <p class="text-sm text-muted-foreground">
          No hay portafolios todavía. Crea uno arriba y arrástrale proyectos.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import draggable from 'vuedraggable'
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
.pg-toast {
  position: fixed; top: 80px; right: 24px; padding: 11px 16px; border-radius: 10px;
  font-size: 13px; font-weight: 700; z-index: 60; box-shadow: 0 4px 18px rgba(0,0,0,.16);
}
.pg-toast-ok  { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
.pg-toast-err { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* clase de vuedraggable mientras se arrastra */
.sortable-ghost { opacity: .5; background: #F3E8FF; }
</style>
