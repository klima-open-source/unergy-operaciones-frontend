<template>
  <div class="flex flex-col gap-4">
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
            @keyup.enter="crear"
          />
          <Button :disabled="!nuevoNombre.trim() || creando" @click="crear">
            <PlusIcon /> Crear capa
          </Button>
        </ButtonGroup>
        <Button variant="outline" size="icon" :disabled="loading" title="Recargar" @click="cargar">
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
      <Card class="flex max-h-160 max-w-72 min-w-64 shrink-0 flex-col border-dashed bg-muted/30">
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
            <template #item="{ element }: { element: ProyectoPortafolio }">
              <div
                class="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary active:cursor-grabbing"
              >
                <ZapIcon class="size-4 shrink-0 text-warning" />
                <div class="min-w-0">
                  <TruncatedText :text="element.nombre" class="text-xs font-bold text-foreground" />
                  <div v-if="element.municipio" class="text-xs text-muted-foreground">
                    {{ element.municipio }}
                  </div>
                </div>
              </div>
            </template>
            <template #footer>
              <p
                v-if="!sinPortafolio.length"
                class="py-3.5 text-center text-xs text-muted-foreground"
              >
                Todos los proyectos operativos están asignados
              </p>
            </template>
          </draggable>
        </CardContent>
      </Card>

      <!-- Capas (portafolios) -->
      <Card
        v-for="pt in portafolios"
        :key="pt.id"
        class="flex max-h-160 max-w-72 min-w-64 shrink-0 flex-col"
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
              <TruncatedText :text="pt.nombre" class="min-w-0" />
            </CardTitle>
            <CardAction class="flex items-center gap-1">
              <Badge variant="secondary">{{ pt.proyectos.length }}</Badge>
              <ButtonGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Renombrar"
                  @click="empezarEdicion(pt)"
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Eliminar capa"
                  class="hover:bg-destructive/10 hover:text-destructive"
                  @click="confirmarEliminar(pt)"
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
            <template #item="{ element }: { element: ProyectoPortafolio }">
              <div
                class="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary active:cursor-grabbing"
              >
                <ZapIcon class="size-4 shrink-0 text-warning" />
                <div class="min-w-0">
                  <TruncatedText :text="element.nombre" class="text-xs font-bold text-foreground" />
                  <div v-if="element.municipio" class="text-xs text-muted-foreground">
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

<script setup lang="ts">
import {
  CheckIcon,
  FolderIcon,
  FolderOpenIcon,
  InboxIcon,
  InfoIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import draggable from 'vuedraggable'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { Portafolio, ProyectoPortafolio } from '~/features/operaciones/types'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'

/** El drag-and-drop muta las listas en el sitio; `Portafolio.proyectos` deja de ser de solo lectura acá. */
type PortafolioEditable = Omit<Portafolio, 'proyectos'> & { proyectos: ProyectoPortafolio[] }

interface CambioDraggable {
  added?: { element: ProyectoPortafolio }
}

const portafoliosService = new PortafoliosService()
const confirm = useConfirm()

const loading = ref(false)
const creando = ref(false)
const portafolios = ref<PortafolioEditable[]>([])
const sinPortafolio = ref<ProyectoPortafolio[]>([])
const nuevoNombre = ref('')
const editandoId = ref<number | null>(null)
const editandoNombre = ref('')

function ordenarPorNombre(lista: PortafolioEditable[]) {
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

async function cargar() {
  loading.value = true
  try {
    const data = await portafoliosService.listar()
    portafolios.value = data.portafolios.map((p) => ({ ...p, proyectos: p.proyectos ?? [] }))
    sinPortafolio.value = data.sin_portafolio ?? []
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    loading.value = false
  }
}

// Persistir la asignación cuando un proyecto entra a una lista (added = destino).
async function onChange(evt: CambioDraggable, portafolioId: number | null) {
  if (!evt.added) return
  const proyecto = evt.added.element
  try {
    await portafoliosService.asignarProyecto(proyecto.id, portafolioId)
    toast.success(
      portafolioId ? `${proyecto.nombre} → portafolio` : `${proyecto.nombre} sin portafolio`,
    )
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
    cargar() // revertir al estado real
  }
}

async function crear() {
  const nombre = nuevoNombre.value.trim()
  if (!nombre) return
  creando.value = true
  try {
    const data = await portafoliosService.crear(nombre)
    portafolios.value.push({ ...data, proyectos: data.proyectos ?? [] })
    ordenarPorNombre(portafolios.value)
    nuevoNombre.value = ''
    toast.success('Portafolio creado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    creando.value = false
  }
}

function empezarEdicion(pt: PortafolioEditable) {
  editandoId.value = pt.id
  editandoNombre.value = pt.nombre
}

async function renombrar(pt: PortafolioEditable) {
  const nombre = editandoNombre.value.trim()
  if (!nombre || nombre === pt.nombre) {
    editandoId.value = null
    return
  }
  try {
    await portafoliosService.renombrar(pt.id, nombre)
    pt.nombre = nombre
    ordenarPorNombre(portafolios.value)
    toast.success('Renombrado')
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    editandoId.value = null
  }
}

function confirmarEliminar(pt: PortafolioEditable) {
  confirm({
    title: 'Eliminar portafolio',
    description: pt.proyectos.length
      ? `¿Eliminar el portafolio "${pt.nombre}"? Sus ${pt.proyectos.length} proyecto(s) volverán a "Sin portafolio".`
      : `¿Eliminar el portafolio "${pt.nombre}"?`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminar(pt),
  })
}

async function eliminar(pt: PortafolioEditable) {
  try {
    await portafoliosService.eliminar(pt.id)
    toast.success('Portafolio eliminado')
    cargar()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  }
}

onMounted(cargar)
</script>
