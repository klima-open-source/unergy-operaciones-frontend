<script setup lang="ts">
/**
 * Vista «Portafolios» de la pantalla de Proyectos: agrupaciones de plantas para
 * los informes «Por portafolio».
 *
 * Un proyecto está en un solo portafolio (Sara, 15-oct): agregar una planta la
 * saca del que tenía, y el diálogo lo avisa antes. A la izquierda los
 * portafolios; a la derecha las plantas del elegido. Reemplaza a la pestaña
 * «Gestión de portafolios» de Informes mensuales.
 */
import type {
  DuplicadoPortafolio,
  Portafolio,
  ProyectoPortafolio,
} from '~/features/operaciones/types'
import type { ProyectoLiviano } from '~/features/proyectos/types'
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { isFetchError, normalizeError } from '~/core/errors'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

/** El elemento de la izquierda que no es un portafolio: las plantas sin ninguno. */
const SIN_PORTAFOLIO = 'sin'

const portafoliosService = new PortafoliosService()
const proyectosService = new ProyectosService()
const confirm = useConfirm()

const query = useQuery<{ portafolios: Portafolio[]; sinPortafolio: ProyectoPortafolio[] }>()
const plantas = ref<ProyectoLiviano[]>([])

async function cargar() {
  await query.run(async () => {
    const data = await portafoliosService.listar()
    return { portafolios: data.portafolios, sinPortafolio: data.sin_portafolio ?? [] }
  })
}

onMounted(() => {
  cargar()
  proyectosService
    .listarLiviano()
    .then((filas) => {
      plantas.value = filas
    })
    .catch(() => {
      plantas.value = []
    })
})

const portafolios = computed(() => query.data?.portafolios ?? [])
const sinPortafolio = computed(() => query.data?.sinPortafolio ?? [])

// ── Izquierda: la lista ─────────────────────────────────────────────────────────
const buscarPortafolio = ref('')
const portafoliosVisibles = computed(() => {
  const q = buscarPortafolio.value.trim().toLowerCase()
  return q ? portafolios.value.filter((p) => p.nombre.toLowerCase().includes(q)) : portafolios.value
})

const elegido = ref<number | typeof SIN_PORTAFOLIO | null>(null)
watch(portafolios, (lista) => {
  const sigue = lista.some((p) => p.id === elegido.value)
  if (elegido.value !== SIN_PORTAFOLIO && !sigue) elegido.value = lista[0]?.id ?? null
})
const portafolio = computed(() => portafolios.value.find((p) => p.id === elegido.value) ?? null)

// ── Derecha: las plantas del elegido ────────────────────────────────────────────
const buscarPlanta = ref('')
const plantasDelElegido = computed(() => {
  const lista = elegido.value === SIN_PORTAFOLIO ? sinPortafolio.value : (portafolio.value?.proyectos ?? [])
  const q = buscarPlanta.value.trim().toLowerCase()
  return q ? lista.filter((p) => (p.nombre ?? '').toLowerCase().includes(q)) : lista
})

function elegir(id: number | typeof SIN_PORTAFOLIO) {
  elegido.value = id
  buscarPlanta.value = ''
}

async function quitar(planta: ProyectoPortafolio) {
  if (!portafolio.value) return
  try {
    await portafoliosService.asignarProyecto(planta.id, null)
    toast.success(`${planta.nombre} salió de ${portafolio.value.nombre}`)
  } catch (err) {
    toast.error('No se pudo quitar', { description: normalizeError(err).message })
  } finally {
    await cargar()
  }
}

// ── Agregar plantas ─────────────────────────────────────────────────────────────
const showAgregar = ref(false)
const aAgregar = ref<string[]>([])
const agregando = ref(false)

/** `{proyecto_id: nombre de su portafolio}`, para avisar quién se mueve. */
const portafolioDe = computed(() => {
  const mapa = new Map<number, string>()
  for (const p of portafolios.value) for (const planta of p.proyectos) mapa.set(planta.id, p.nombre)
  return mapa
})

const opcionesPlantas = computed(() => {
  const ya = new Set((portafolio.value?.proyectos ?? []).map((p) => p.id))
  return plantas.value
    .filter((p) => !ya.has(p.id))
    .map((p) => {
      const actual = portafolioDe.value.get(p.id)
      const base = p.municipio ? `${p.nombre_comercial} · ${p.municipio}` : p.nombre_comercial
      return { value: String(p.id), label: actual ? `${base} (en ${actual})` : base }
    })
})

/** Las elegidas que ya están en otro portafolio: al agregarlas salen de ese. */
const seMueven = computed(() =>
  aAgregar.value
    .map((id) => {
      const planta = plantas.value.find((p) => p.id === Number(id))
      const actual = portafolioDe.value.get(Number(id))
      return planta && actual ? `${planta.nombre_comercial} (de ${actual})` : null
    })
    .filter((x): x is string => x !== null),
)

function abrirAgregar() {
  aAgregar.value = []
  showAgregar.value = true
}

async function agregar() {
  if (!portafolio.value) return
  agregando.value = true
  const destino = portafolio.value
  try {
    for (const id of aAgregar.value) {
      await portafoliosService.asignarProyecto(Number(id), destino.id)
    }
    toast.success(`${aAgregar.value.length} planta(s) agregada(s) a ${destino.nombre}`)
    showAgregar.value = false
  } catch (err) {
    toast.error('No se pudieron agregar todas', { description: normalizeError(err).message })
  } finally {
    agregando.value = false
    await cargar()
  }
}

// ── Crear, renombrar, eliminar ──────────────────────────────────────────────────
const showNombre = ref(false)
const renombrandoId = ref<number | null>(null)
const nombre = ref('')
const guardandoNombre = ref(false)

function abrirCrear() {
  renombrandoId.value = null
  nombre.value = ''
  showNombre.value = true
}

function abrirRenombrar(p: Portafolio) {
  renombrandoId.value = p.id
  nombre.value = p.nombre
  showNombre.value = true
}

function avisoParecido(err: unknown): DuplicadoPortafolio | null {
  if (!isFetchError<{ detail?: DuplicadoPortafolio }>(err) || err.status !== 409) return null
  return err.data?.detail?.duplicado_nombre ? err.data.detail : null
}

async function guardarNombre(forzar = false) {
  const valor = nombre.value.trim()
  guardandoNombre.value = true
  try {
    if (renombrandoId.value) {
      await portafoliosService.renombrar(renombrandoId.value, valor, forzar)
      toast.success('Portafolio renombrado')
    } else {
      const creado = await portafoliosService.crear(valor, forzar)
      elegido.value = creado.id
      toast.success('Portafolio creado')
    }
    showNombre.value = false
    await cargar()
  } catch (err) {
    const parecido = avisoParecido(err)
    if (parecido) {
      confirm({
        title: 'Ya hay un portafolio parecido',
        description: `Existe "${parecido.candidato_nombre}". Si de verdad es otro portafolio, puedes guardarlo igual.`,
        confirmLabel: 'Guardar de todos modos',
        onConfirm: () => guardarNombre(true),
      })
      return
    }
    toast.error('No se pudo guardar', { description: normalizeError(err).message })
  } finally {
    guardandoNombre.value = false
  }
}

function eliminar(p: Portafolio) {
  confirm({
    title: `Eliminar ${p.nombre}`,
    description: p.proyectos.length
      ? `Sus ${p.proyectos.length} planta(s) no se borran: solo dejan de estar en este portafolio.`
      : 'No tiene plantas.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await portafoliosService.eliminar(p.id)
        toast.success('Portafolio eliminado')
      } catch (err) {
        toast.error('No se pudo eliminar', { description: normalizeError(err).message })
      } finally {
        await cargar()
      }
    },
  })
}
</script>

<template>
  <AsyncView :query="query">
    <template #default>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Izquierda: los portafolios -->
        <div class="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
          <!-- Arriba lo que se usa para actuar: con 24 portafolios, al fondo no se ve. -->
          <Button size="sm" variant="outline" @click="abrirCrear">
            <PlusIcon class="size-4" />
            Nuevo portafolio
          </Button>
          <button
            v-if="sinPortafolio.length"
            type="button"
            class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
            :class="elegido === SIN_PORTAFOLIO ? 'bg-warning/10 font-semibold' : 'hover:bg-muted'"
            @click="elegir(SIN_PORTAFOLIO)"
          >
            <TriangleAlertIcon class="size-4 shrink-0 text-warning" />
            {{ sinPortafolio.length }} plantas operativas sin portafolio
          </button>
          <Separator />
          <InputGroup>
            <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
            <InputGroupInput v-model="buscarPortafolio" placeholder="Buscar portafolio…" />
          </InputGroup>
          <div class="flex flex-col gap-0.5">
            <button
              v-for="p in portafoliosVisibles"
              :key="p.id"
              type="button"
              class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
              :class="
                elegido === p.id
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-foreground hover:bg-muted'
              "
              @click="elegir(p.id)"
            >
              <TruncatedText :text="p.nombre" class="min-w-0 flex-1" />
              <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
                {{ p.proyectos.length }}
              </span>
            </button>
            <p v-if="!portafoliosVisibles.length" class="px-2.5 py-2 text-sm text-muted-foreground">
              Sin resultados.
            </p>
          </div>
        </div>

        <!-- Derecha: las plantas del elegido -->
        <div class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <template v-if="portafolio">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="font-semibold text-foreground">{{ portafolio.nombre }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ portafolio.proyectos.length }} plantas
                </p>
              </div>
              <div class="flex items-center gap-1">
                <Button size="sm" @click="abrirAgregar">
                  <PlusIcon class="size-4" />
                  Agregar plantas
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Renombrar"
                  aria-label="Renombrar"
                  @click="abrirRenombrar(portafolio)"
                >
                  <PencilIcon class="size-4 text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Eliminar"
                  aria-label="Eliminar"
                  @click="eliminar(portafolio)"
                >
                  <Trash2Icon class="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </template>
          <div v-else-if="elegido === SIN_PORTAFOLIO">
            <p class="font-semibold text-foreground">Plantas operativas sin portafolio</p>
            <p class="text-xs text-muted-foreground">
              No salen en ningún informe «Por portafolio». Para asignarlas, elige un portafolio y
              usa «Agregar plantas».
            </p>
          </div>
          <EmptyState
            v-else
            title="Sin portafolios"
            description="Crea el primero con «Nuevo portafolio»."
          />

          <template v-if="portafolio || elegido === SIN_PORTAFOLIO">
            <InputGroup>
              <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
              <InputGroupInput v-model="buscarPlanta" placeholder="Buscar planta…" />
            </InputGroup>
            <div class="divide-y divide-border">
              <div
                v-for="planta in plantasDelElegido"
                :key="planta.id"
                class="flex items-center justify-between gap-2 py-1.5 text-sm"
              >
                <NuxtLink
                  :to="`/proyectos/${planta.id}`"
                  class="min-w-0 flex-1 text-primary hover:underline"
                >
                  <TruncatedText :text="planta.nombre ?? `#${planta.id}`" />
                </NuxtLink>
                <span class="shrink-0 text-xs text-muted-foreground">{{ planta.municipio }}</span>
                <Button
                  v-if="portafolio"
                  variant="ghost"
                  size="icon-sm"
                  :title="`Quitar de ${portafolio.nombre}`"
                  :aria-label="`Quitar de ${portafolio.nombre}`"
                  @click="quitar(planta)"
                >
                  <XIcon class="size-4" />
                </Button>
              </div>
              <p v-if="!plantasDelElegido.length" class="py-3 text-sm text-muted-foreground">
                {{ buscarPlanta ? 'Sin resultados.' : 'Este portafolio no tiene plantas.' }}
              </p>
            </div>
          </template>
        </div>
      </div>
    </template>
  </AsyncView>

  <Dialog v-model:open="showAgregar">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Agregar plantas a {{ portafolio?.nombre }}</DialogTitle>
        <DialogDescription>
          Un proyecto está en un solo portafolio: si ya estaba en otro, sale de ese.
        </DialogDescription>
      </DialogHeader>
      <MultiComboBox
        v-model="aAgregar"
        :options="opcionesPlantas"
        placeholder="Buscar planta…"
        empty-message="Sin plantas para agregar."
      />
      <p v-if="seMueven.length" class="text-sm text-warning">
        Saldrán de su portafolio actual: {{ seMueven.join(', ') }}.
      </p>
      <DialogFooter>
        <Button variant="secondary" @click="showAgregar = false">Cancelar</Button>
        <Button :disabled="!aAgregar.length || agregando" @click="agregar">
          Agregar {{ aAgregar.length || '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showNombre">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ renombrandoId ? 'Renombrar portafolio' : 'Nuevo portafolio' }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-1.5">
        <GLabel required>Nombre</GLabel>
        <Input v-model="nombre" placeholder="Ej: Fondo Caribe" @keyup.enter="guardarNombre()" />
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="showNombre = false">Cancelar</Button>
        <Button :disabled="!nombre.trim() || guardandoNombre" @click="guardarNombre()">
          {{ renombrandoId ? 'Guardar' : 'Crear' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
