<script setup lang="ts">
/**
 * Actualizar el catálogo de plantas desde el archivo `capains` de XM.
 *
 * El archivo llega por el FTP de XM como `capainsMMDD.tx1`. Se lee, se compara
 * contra el catálogo en uso y solo entonces se adopta: reemplazar a ciegas el
 * catálogo que da nombre a todas las plantas es la clase de cambio que hay que
 * ver antes de hacer.
 *
 * El catálogo adoptado queda en ESTE navegador. Para que lo vean todos habría
 * que guardarlo en el backend; está dicho en pantalla para que nadie suponga lo
 * contrario.
 */
import { CircleCheckIcon, DownloadIcon, UploadIcon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { fechaDeNombre, parsearCapains } from '~/features/mem/utils/capains'
import type { DiferenciasCatalogo } from '~/features/mem/utils/catalogoPlantas'
import { cargarCatalogo, comparar, guardar, olvidar } from '~/features/mem/utils/catalogoPlantas'
import type { PlantaSimem } from '~/features/mem/utils/simemAgentes'

const emit = defineEmits<{ actualizado: [] }>()

const actual = ref<Record<string, PlantaSimem>>({})
const origen = ref<'cargado' | 'aplicación'>('aplicación')
const fechaActual = ref<string | null>(null)

const propuesto = ref<Record<string, PlantaSimem> | null>(null)
const fechaPropuesta = ref<string | null>(null)
const nombreArchivo = ref('')
const diff = ref<DiferenciasCatalogo | null>(null)
const arrastrando = ref(false)
const entrada = ref<HTMLInputElement | null>(null)

const hayCambios = computed(() =>
  !!diff.value && (diff.value.nuevas.length + diff.value.retiradas.length + diff.value.cambiadas.length) > 0,
)

async function refrescarActual() {
  const c = await cargarCatalogo()
  actual.value = c.plantas
  origen.value = c.origen
  fechaActual.value = c.fecha
}

async function leerArchivo(file: File) {
  try {
    // El FTP de XM escribe en latin-1: con UTF-8 las tildes salen rotas.
    const texto = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
    const plantas = parsearCapains(texto)
    if (!Object.keys(plantas).length) {
      toast.error('Ese archivo no parece un capains', {
        description: 'Se esperaba un CSV con «;» y la cabecera AGENTE;PLANTA;NOMBRE…',
        duration: 7000,
      })
      return
    }
    propuesto.value = plantas
    nombreArchivo.value = file.name
    fechaPropuesta.value = fechaDeNombre(file.name, new Date().getFullYear())
    diff.value = comparar(actual.value, plantas)
  } catch (e) {
    toast.error('No se pudo leer el archivo', { description: normalizeError(e).message, duration: 6000 })
  }
}

function alSoltar(ev: DragEvent) {
  arrastrando.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (file) leerArchivo(file)
}

function alElegir(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) leerArchivo(file)
}

async function adoptar() {
  if (!propuesto.value) return
  guardar(propuesto.value, fechaPropuesta.value)
  await refrescarActual()
  propuesto.value = null
  diff.value = null
  emit('actualizado')
  toast.success('Catálogo actualizado', {
    description: 'Las vistas del SIMEM ya usan los nombres nuevos en este navegador.',
    duration: 6000,
  })
}

async function volverAlDeLaApp() {
  olvidar()
  await refrescarActual()
  emit('actualizado')
  toast.info('Se volvió al catálogo que trae la aplicación')
}

/** Para poder commitearlo y que lo vean todos, que es lo que falta. */
function descargarJson() {
  const datos = propuesto.value ?? actual.value
  const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantasSimem.json'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(refrescarActual)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-4 text-sm">
      <span>
        Catálogo en uso: <b>{{ Object.keys(actual).length.toLocaleString('es-CO') }}</b> plantas
      </span>
      <span class="text-muted-foreground">
        <template v-if="origen === 'cargado'">
          cargado a mano<template v-if="fechaActual"> · archivo del {{ fechaActual }}</template>
        </template>
        <template v-else>el que trae la aplicación</template>
      </span>
      <Button v-if="origen === 'cargado'" size="sm" variant="outline" @click="volverAlDeLaApp">
        Volver al de la aplicación
      </Button>
    </div>

    <!-- Decirlo acá y no en una nota al pie: es la limitación que más importa. -->
    <div class="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      El catálogo que cargues queda <b>en este navegador</b>. Para que lo vean todos hay que
      guardarlo en el servidor — todavía no está hecho. Mientras tanto, el botón
      «Descargar JSON» saca el archivo para dejarlo en la aplicación.
    </div>

    <div
      class="rounded-md border-2 border-dashed p-8 text-center transition-colors"
      :class="arrastrando ? 'border-primary bg-primary/5' : 'border-muted'"
      @dragover.prevent="arrastrando = true"
      @dragleave="arrastrando = false"
      @drop.prevent="alSoltar"
    >
      <UploadIcon class="mx-auto mb-2 size-6 text-muted-foreground" />
      <p class="text-sm">Arrastra aquí el archivo <code>capainsMMDD.tx1</code> del FTP de XM</p>
      <p class="mt-1 text-xs text-muted-foreground">o</p>
      <Button size="sm" variant="outline" class="mt-2" @click="entrada?.click()">
        Elegir archivo
      </Button>
      <input ref="entrada" type="file" accept=".tx1,.txt,.csv" class="hidden" @change="alElegir">
    </div>

    <template v-if="diff && propuesto">
      <div class="rounded-md border p-4">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <b class="text-sm">{{ nombreArchivo }}</b>
          <span class="text-xs text-muted-foreground">
            {{ Object.keys(propuesto).length.toLocaleString('es-CO') }} plantas
            <template v-if="fechaPropuesta"> · archivo del {{ fechaPropuesta }}</template>
          </span>
        </div>

        <div v-if="!hayCambios" class="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheckIcon class="size-4" />
          Idéntico al catálogo en uso: no hay nada que adoptar.
        </div>

        <template v-else>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded border px-3 py-2">
              <div class="text-xs text-muted-foreground">Plantas nuevas</div>
              <div class="text-xl font-semibold tabular-nums">{{ diff.nuevas.length }}</div>
            </div>
            <div class="rounded border px-3 py-2">
              <div class="text-xs text-muted-foreground">Ya no están</div>
              <div class="text-xl font-semibold tabular-nums">{{ diff.retiradas.length }}</div>
            </div>
            <div class="rounded border px-3 py-2">
              <div class="text-xs text-muted-foreground">Con cambios</div>
              <div class="text-xl font-semibold tabular-nums">{{ diff.cambiadas.length }}</div>
            </div>
          </div>

          <!-- El detalle de lo que cambia: adoptar sin verlo sería a ciegas. -->
          <div v-if="diff.cambiadas.length" class="mt-3 max-h-56 overflow-auto rounded border">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-muted">
                <tr class="border-b">
                  <th class="px-2 py-1.5 text-left font-medium text-muted-foreground">Planta</th>
                  <th class="px-2 py-1.5 text-left font-medium text-muted-foreground">Antes</th>
                  <th class="px-2 py-1.5 text-left font-medium text-muted-foreground">Ahora</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in diff.cambiadas" :key="c.codigo" class="border-t">
                  <td class="px-2 py-1 font-mono">{{ c.codigo }}</td>
                  <td class="px-2 py-1 text-muted-foreground">
                    {{ c.antes.nm }} · {{ (c.antes.kw ?? 0).toLocaleString('es-CO') }} kW · {{ c.antes.tc }}
                  </td>
                  <td class="px-2 py-1">
                    {{ c.ahora.nm }} · {{ (c.ahora.kw ?? 0).toLocaleString('es-CO') }} kW · {{ c.ahora.tc }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul v-if="diff.nuevas.length" class="mt-3 text-xs text-muted-foreground">
            <li>
              <b class="text-foreground">Nuevas:</b>
              {{ diff.nuevas.map((c) => `${c} ${propuesto![c]!.nm}`).join(' · ') }}
            </li>
          </ul>
        </template>

        <div class="mt-4 flex gap-2">
          <Button size="sm" :disabled="!hayCambios" @click="adoptar">Adoptar este catálogo</Button>
          <Button size="sm" variant="outline" @click="descargarJson">
            <DownloadIcon class="size-3" />
            Descargar JSON
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>
