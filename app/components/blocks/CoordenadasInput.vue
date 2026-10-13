<script setup lang="ts">
/**
 * Latitud y longitud como texto: acepta punto o coma decimal y, si se pega el
 * par completo (como lo copia Google Maps) en cualquiera de los dos campos,
 * llena los dos. Ver `~/utils/coordenadas`.
 *
 * `valido` dice si lo escrito se pudo leer: quien guarda lo consulta para no
 * mandar una coordenada vieja mientras el campo muestra otra cosa.
 */
import { ExternalLinkIcon, LockIcon } from '@lucide/vue'
import {
  avisosCoordenadas,
  enlaceGoogleMaps,
  leerCoordenada,
  leerPar,
  mostrarCoordenada,
} from '~/utils/coordenadas'

type Valor = number | string | null | undefined

/** Solo lectura: p. ej. coordenadas que vienen de TSF al importar un proyecto. */
defineProps<{ disabled?: boolean }>()

const latitud = defineModel<Valor>('latitud', { default: null })
const longitud = defineModel<Valor>('longitud', { default: null })
const valido = defineModel<boolean>('valido', { default: true })

const textoLatitud = ref(mostrarCoordenada(latitud.value))
const textoLongitud = ref(mostrarCoordenada(longitud.value))

const errorLatitud = computed(() => leerCoordenada(textoLatitud.value) === undefined)
const errorLongitud = computed(() => leerCoordenada(textoLongitud.value) === undefined)

const numero = (v: Valor): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)
const avisos = computed(() => avisosCoordenadas(numero(latitud.value), numero(longitud.value)))
const enlace = computed(() => {
  const lat = numero(latitud.value)
  const lon = numero(longitud.value)
  return lat != null && lon != null && !errorLatitud.value && !errorLongitud.value
    ? enlaceGoogleMaps(lat, lon)
    : null
})

watch(
  [errorLatitud, errorLongitud],
  ([a, b]) => {
    valido.value = !a && !b
  },
  { immediate: true },
)

function alEscribir(campo: 'latitud' | 'longitud', texto: string) {
  const par = leerPar(texto)
  if (par) {
    latitud.value = par.latitud
    longitud.value = par.longitud
    textoLatitud.value = mostrarCoordenada(par.latitud)
    textoLongitud.value = mostrarCoordenada(par.longitud)
    return
  }
  if (campo === 'latitud') textoLatitud.value = texto
  else textoLongitud.value = texto
  const leido = leerCoordenada(texto)
  if (leido === undefined) return // queda el error a la vista; el modelo no cambia
  if (campo === 'latitud') latitud.value = leido
  else longitud.value = leido
}

// Si el valor cambia desde afuera (clic en un mapa, carga de Excel), el texto lo sigue.
watch(latitud, (v) => {
  if (numero(v) !== leerCoordenada(textoLatitud.value)) textoLatitud.value = mostrarCoordenada(v)
})
watch(longitud, (v) => {
  if (numero(v) !== leerCoordenada(textoLongitud.value)) textoLongitud.value = mostrarCoordenada(v)
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-muted-foreground">
        Latitud <LockIcon v-if="disabled" class="inline size-3" />
      </label>
      <Input
        :model-value="textoLatitud"
        :disabled="disabled"
        inputmode="decimal"
        placeholder="6,244203"
        :aria-invalid="errorLatitud || undefined"
        @update:model-value="alEscribir('latitud', String($event))"
      />
      <p v-if="errorLatitud" class="text-xs text-destructive">
        No es una coordenada: usa un número como 6,244203.
      </p>
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium text-muted-foreground">
        Longitud <LockIcon v-if="disabled" class="inline size-3" />
      </label>
      <Input
        :model-value="textoLongitud"
        :disabled="disabled"
        inputmode="decimal"
        placeholder="-75,581211"
        :aria-invalid="errorLongitud || undefined"
        @update:model-value="alEscribir('longitud', String($event))"
      />
      <p v-if="errorLongitud" class="text-xs text-destructive">
        No es una coordenada: usa un número como -75,581211.
      </p>
    </div>
    <div class="flex flex-col gap-1 md:col-span-2">
      <p v-for="aviso in avisos" :key="aviso" class="text-xs text-warning">{{ aviso }}</p>
      <p class="text-xs text-muted-foreground">
        <template v-if="!disabled"
          >Puedes pegar las dos juntas, como las copia Google Maps («6.244203,
          -75.581211»).</template
        >
        <a
          v-if="enlace"
          :href="enlace"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLinkIcon class="size-3" /> Ver en Google Maps
        </a>
      </p>
    </div>
  </div>
</template>
