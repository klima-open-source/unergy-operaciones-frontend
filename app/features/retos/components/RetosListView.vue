<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="rq-header-wrap">
      <PageHeader title="Retos Q" :subtitle="subtituloAnio">
        <template #lead>
          <div class="rq-icon-tile"><FlagIcon class="size-[1em] fill-current" /></div>
        </template>
        <template #actions>
          <Select
            v-model="anio"
            :options="aniosDisponibles"
            size="small"
            class="w-[104px]"
            :disabled="cargandoInicial"
            aria-label="Año"
          />
          <Button
            v-if="retoEnCurso"
            label="Ir al Q en curso"
            class="flex-row-reverse"
            size="small"
            outlined
            severity="secondary"
            @click="abrir(retoEnCurso)"
          >
            <template #icon><ArrowRightIcon class="size-[1em]" /></template>
          </Button>
        </template>
      </PageHeader>
      <!-- Recarga (cambio de año): barra indeterminada pegada bajo el header -->
      <div v-if="recargando" class="rq-barra" role="presentation" />
    </div>

    <!-- Error (y también el caso improbable de `retos: []`) -->
    <Message v-if="error" severity="error" :closable="false">
      <div class="rq-error">
        <span>No se pudieron cargar los retos del año.</span>
        <Button label="Reintentar" size="small" text @click="cargar" />
      </div>
    </Message>

    <!-- Grilla -->
    <div
      v-else
      class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      :class="{ 'rq-recargando': recargando }"
      :aria-busy="cargandoInicial || recargando"
    >
      <template v-if="cargandoInicial">
        <Skeleton v-for="n in 4" :key="`sk-${n}`" height="238px" borderRadius="14px" />
      </template>
      <template v-else>
        <RetoQCard v-for="reto in retos" :key="reto.id" :reto="reto" @abrir="abrir" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Message from 'primevue/message'
import { RetosService } from '~/features/retos/services/retos'
import RetoQCard from './RetoQCard.vue'
import { ArrowRightIcon, FlagIcon } from '@lucide/vue'

const retosService = new RetosService()

const route = useRoute()
const router = useRouter()

const ANIO_ACTUAL = new Date().getFullYear()

function anioInicial() {
  const q = Number(route.query.anio)
  return Number.isFinite(q) && q > 1900 && q < 3000 ? Math.trunc(q) : ANIO_ACTUAL
}

const anio = ref(anioInicial())
const aniosDisponibles = ref([anio.value])
const retos = ref([])
const cargandoInicial = ref(true)
const recargando = ref(false)
const error = ref(false)

const retoEnCurso = computed(() => retos.value.find(r => r.estado_periodo === 'en_curso') || null)

const subtituloAnio = computed(() => {
  const r = retoEnCurso.value
  if (r) {
    const semana = r.semana_actual
    if (semana !== null && semana !== undefined) {
      return `Tablero trimestral del equipo · Q${r.trimestre} en curso, semana ${semana} de ${r.total_semanas}`
    }
    return `Tablero trimestral del equipo · Q${r.trimestre} en curso`
  }
  return `Tablero trimestral del equipo · ${anio.value}`
})

async function cargar() {
  const primeraVez = !retos.value.length
  error.value = false
  if (primeraVez) cargandoInicial.value = true
  else recargando.value = true

  try {
    const data = await retosService.listarPorAnio(anio.value)
    const lista = Array.isArray(data?.retos) ? data.retos : []
    retos.value = lista

    const anios = Array.isArray(data?.anios_disponibles) ? data.anios_disponibles.map(Number) : []
    if (!anios.includes(anio.value)) anios.push(anio.value)
    aniosDisponibles.value = [...new Set(anios.filter(Number.isFinite))].sort((a, b) => a - b)

    // El GET autocrea los 4 trimestres; una lista vacía es una anomalía y se
    // trata como error (§2.6).
    if (!lista.length) error.value = true
  } catch (e) {
    retos.value = []
    error.value = true
  } finally {
    cargandoInicial.value = false
    recargando.value = false
  }
}

watch(anio, (nuevo) => {
  router.replace({ query: { ...route.query, anio: String(nuevo) } })
  cargar()
})

function abrir(reto) {
  if (!reto?.id) return
  router.push(`/general/retos/${reto.id}`)
}

onMounted(cargar)
</script>

<style scoped>
.rq-header-wrap { position: relative; }

.rq-icon-tile {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: rgba(145, 91, 216, 0.12);
  color: var(--color-unergy-purple);
  font-size: 17px;
}

/* Barra indeterminada de recarga, pegada bajo el PageHeader */
.rq-barra {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -8px;
  height: 2px;
  border-radius: 999px;
  background: rgba(145, 91, 216, .14);
  overflow: hidden;
}
.rq-barra::after {
  content: '';
  display: block;
  height: 100%;
  width: 38%;
  border-radius: 999px;
  background: var(--color-unergy-purple);
  animation: rq-indeterminada 1.1s ease-in-out infinite;
}
@keyframes rq-indeterminada {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

.rq-recargando {
  opacity: .5;
  pointer-events: none;
  transition: opacity .14s ease;
}

.rq-error { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) {
  .rq-barra::after { animation: none; width: 100%; opacity: .6; }
  .rq-recargando { transition: none; }
}
</style>
