<script setup lang="ts">
/**
 * Búsqueda global: ⌘K (Ctrl+K) o el botón del encabezado, desde cualquier página.
 * Busca plantas, clientes, contratos y fronteras en el backend y lleva a la ficha
 * del que se elija. Fase 5 de la propuesta de UX.
 */
import { BuildingIcon, FilePenIcon, GlobeIcon, SearchIcon, ZapIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { BusquedaService } from '~/features/busqueda/services/busqueda'
import type { RespuestaBusqueda } from '~/features/busqueda/types'

const servicio = new BusquedaService()
const abierto = ref(false)
const q = ref('')
const cargando = ref(false)
const error = ref<string | null>(null)
const resultados = ref<RespuestaBusqueda | null>(null)

const GRUPOS = [
  { key: 'proyectos', label: 'Proyectos', icon: ZapIcon },
  { key: 'clientes', label: 'Clientes', icon: BuildingIcon },
  { key: 'contratos', label: 'Contratos', icon: FilePenIcon },
  { key: 'fronteras', label: 'Fronteras', icon: GlobeIcon },
] as const

const conResultados = computed(() =>
  GRUPOS.map((g) => ({ ...g, items: resultados.value?.[g.key] ?? [] })).filter(
    (g) => g.items.length,
  ),
)

/** Los resultados en orden de pantalla, para moverse con las flechas. */
const planos = computed(() =>
  conResultados.value.flatMap((g) => g.items.map((item) => ({ ...item, grupo: g.key }))),
)
const activo = ref(0)
watch(planos, () => (activo.value = 0))

function teclas(e: KeyboardEvent) {
  const n = planos.value.length
  if (!n) return
  if (e.key === 'ArrowDown') activo.value = (activo.value + 1) % n
  else if (e.key === 'ArrowUp') activo.value = (activo.value - 1 + n) % n
  else if (e.key === 'Enter') ir(planos.value[activo.value]!.url)
  else return
  e.preventDefault()
}
const indice = (grupo: string, id: number) =>
  planos.value.findIndex((p) => p.grupo === grupo && p.id === id)

// Una búsqueda por pausa al teclear, y solo la última respuesta cuenta.
let temporizador: ReturnType<typeof setTimeout> | undefined
let ultima = 0
watch(q, (texto) => {
  clearTimeout(temporizador)
  error.value = null
  if (texto.trim().length < 2) {
    resultados.value = null
    cargando.value = false
    return
  }
  cargando.value = true
  temporizador = setTimeout(async () => {
    const esta = ++ultima
    try {
      const r = await servicio.buscar(texto.trim())
      if (esta === ultima) resultados.value = r
    } catch (e) {
      if (esta === ultima) error.value = normalizeError(e).message
    } finally {
      if (esta === ultima) cargando.value = false
    }
  }, 250)
})

function ir(url: string) {
  abierto.value = false
  navigateTo(url)
}

function atajo(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    abierto.value = !abierto.value
  }
}
onMounted(() => window.addEventListener('keydown', atajo))
onBeforeUnmount(() => window.removeEventListener('keydown', atajo))

watch(abierto, (si) => {
  if (!si) q.value = ''
})
</script>

<template>
  <Button variant="outline" size="sm" class="text-muted-foreground" @click="abierto = true">
    <SearchIcon class="size-4" />
    <span class="max-sm:hidden">Buscar…</span>
    <kbd class="rounded border border-border px-1 font-mono text-xs max-sm:hidden">⌘K</kbd>
  </Button>

  <!-- Un diálogo propio y no CommandDialog: Command filtra en el navegador y
       oculta los grupos que se montan después de teclear, y estos resultados ya
       vienen filtrados del backend. -->
  <Dialog v-model:open="abierto">
    <DialogContent
      class="top-1/4 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      :show-close-button="false"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Buscar</DialogTitle>
        <DialogDescription>Proyectos, clientes, contratos y fronteras</DialogDescription>
      </DialogHeader>
      <div class="flex items-center gap-2 border-b border-border px-3">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
        <input
          id="busqueda-global"
          v-model="q"
          autofocus
          autocomplete="off"
          placeholder="Planta, código TSF, cliente, NIT, contrato, frontera…"
          class="h-11 w-full border-0 bg-transparent px-0 text-sm shadow-none outline-hidden placeholder:text-muted-foreground focus:ring-0"
          @keydown="teclas"
        />
      </div>
      <div class="max-h-96 overflow-y-auto p-1" role="listbox" aria-label="Resultados">
        <p v-if="q.trim().length < 2" class="px-3 py-6 text-center text-sm text-muted-foreground">
          Escribe al menos dos letras. ↑ ↓ para moverte, Enter para abrir.
        </p>
        <p
          v-else-if="cargando && !planos.length"
          class="px-3 py-6 text-center text-sm text-muted-foreground"
        >
          Buscando…
        </p>
        <p v-else-if="error" class="px-3 py-6 text-center text-sm text-destructive">{{ error }}</p>
        <p v-else-if="!planos.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
          Nada coincide con «{{ q.trim() }}».
        </p>
        <template v-for="g in conResultados" v-else :key="g.key">
          <p class="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">{{ g.label }}</p>
          <button
            v-for="r in g.items"
            :key="`${g.key}:${r.id}`"
            type="button"
            role="option"
            :aria-selected="indice(g.key, r.id) === activo"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            :class="
              indice(g.key, r.id) === activo ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            "
            @mouseenter="activo = indice(g.key, r.id)"
            @click="ir(r.url)"
          >
            <component :is="g.icon" class="size-4 shrink-0 text-muted-foreground" />
            <span class="flex min-w-0 flex-col">
              <span class="truncate font-medium">{{ r.titulo }}</span>
              <span v-if="r.detalle" class="truncate text-xs text-muted-foreground">{{
                r.detalle
              }}</span>
            </span>
          </button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
