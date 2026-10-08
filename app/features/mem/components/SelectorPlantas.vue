<script setup lang="ts">
/**
 * Selector de plantas para los paneles del SIMEM.
 *
 * Las opciones salen de lo que la consulta TRAJO, no del catálogo entero: si un
 * mes no tiene datos de una planta, ofrecerla sería ofrecer un filtro que deja
 * la tabla vacía. Cada opción muestra el código y el nombre, porque los códigos
 * (`4Z8P`, `5LSO`) no se reconocen a ojo.
 *
 * Multi-selección con casillas en vez de `<select multiple>`: el Ctrl+clic no se
 * descubre solo y perder la selección entera por un clic de más es fácil.
 */
import { SearchIcon, XIcon } from '@lucide/vue'
import { computed, ref } from 'vue'

export interface OpcionPlanta {
  codigo: string
  nombre: string
}

const props = defineProps<{ opciones: OpcionPlanta[] }>()
const modelo = defineModel<Set<string>>({ required: true })

const abierto = ref(false)
const busqueda = ref('')

const filtradas = computed(() => {
  const q = busqueda.value.trim().toUpperCase()
  const todas = [...props.opciones].sort((a, b) => a.nombre.localeCompare(b.nombre))
  if (!q) return todas
  return todas.filter((o) => o.nombre.toUpperCase().includes(q) || o.codigo.toUpperCase().includes(q))
})

function alternar(codigo: string) {
  const siguiente = new Set(modelo.value)
  if (siguiente.has(codigo)) siguiente.delete(codigo)
  else siguiente.add(codigo)
  modelo.value = siguiente
}

const etiqueta = computed(() => {
  const n = modelo.value.size
  if (!n) return 'Todas'
  if (n === 1) {
    const codigo = [...modelo.value][0]!
    return props.opciones.find((o) => o.codigo === codigo)?.nombre ?? codigo
  }
  return `${n} plantas`
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label class="text-xs font-semibold tracking-wider text-primary uppercase">Planta</label>
    <div class="relative">
      <button
        type="button"
        class="flex h-9 w-56 items-center justify-between gap-2 rounded-md border bg-background px-2 text-left text-sm"
        :disabled="!opciones.length"
        @click="abierto = !abierto"
      >
        <span class="truncate" :class="{ 'text-muted-foreground': !modelo.size }">{{ etiqueta }}</span>
        <XIcon
          v-if="modelo.size" class="size-3 shrink-0 text-muted-foreground"
          @click.stop="modelo = new Set()"
        />
      </button>

      <div
        v-if="abierto"
        class="absolute z-20 mt-1 w-72 rounded-md border bg-background p-2 shadow-lg"
      >
        <div class="relative mb-2">
          <SearchIcon class="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="busqueda" class="h-8 pl-7 text-xs" placeholder="Buscar planta o código…" />
        </div>
        <div class="max-h-64 overflow-auto">
          <label
            v-for="o in filtradas" :key="o.codigo"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
          >
            <input
              type="checkbox" class="size-3.5"
              :checked="modelo.has(o.codigo)" @change="alternar(o.codigo)"
            >
            <span class="font-mono text-[11px] text-muted-foreground">{{ o.codigo }}</span>
            <span class="truncate">{{ o.nombre }}</span>
          </label>
          <p v-if="!filtradas.length" class="px-1.5 py-2 text-xs text-muted-foreground">
            Sin coincidencias.
          </p>
        </div>
        <div class="mt-2 flex justify-between border-t pt-2">
          <button type="button" class="text-xs text-muted-foreground hover:text-foreground" @click="modelo = new Set()">
            Limpiar
          </button>
          <button type="button" class="text-xs text-primary" @click="abierto = false">Listo</button>
        </div>
      </div>
    </div>
  </div>
</template>
