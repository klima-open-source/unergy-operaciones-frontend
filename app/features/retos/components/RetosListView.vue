<script setup lang="ts">
import type { RetoResumen } from '~/features/retos/types'
import { ArrowRightIcon, FlagIcon } from '@lucide/vue'
import { RetosService } from '~/features/retos/services/retos'
import RetoQCard from './RetoQCard.vue'

const retosService = new RetosService()

const route = useRoute()
const router = useRouter()

const ANIO_ACTUAL = new Date().getFullYear()

function anioInicial() {
  const q = Number(route.query.anio)
  return Number.isFinite(q) && q > 1900 && q < 3000 ? Math.trunc(q) : ANIO_ACTUAL
}

const anio = ref(String(anioInicial()))
const aniosDisponibles = ref([anio.value])
const retos = ref<RetoResumen[]>([])
const cargandoInicial = ref(true)
const recargando = ref(false)
const error = ref(false)

const retoEnCurso = computed(() => retos.value.find((r) => r.estado_periodo === 'en_curso') || null)

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
    const data = await retosService.listarPorAnio(Number(anio.value))
    const lista = Array.isArray(data?.retos) ? data.retos : []
    retos.value = lista

    const anios = Array.isArray(data?.anios_disponibles) ? data.anios_disponibles.map(Number) : []
    if (!anios.includes(Number(anio.value))) anios.push(Number(anio.value))
    aniosDisponibles.value = [...new Set(anios.filter((n) => Number.isFinite(n)))]
      .sort((a, b) => a - b)
      .map(String)

    // El GET autocrea los 4 trimestres; una lista vacía es una anomalía y se
    // trata como error (§2.6).
    if (!lista.length) error.value = true
  } catch {
    retos.value = []
    error.value = true
  } finally {
    cargandoInicial.value = false
    recargando.value = false
  }
}

watch(anio, (nuevo) => {
  router.replace({ query: { ...route.query, anio: nuevo } })
  cargar()
})

function abrir(reto: RetoResumen) {
  if (!reto?.id) return
  router.push(`/general/retos/${reto.id}`)
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="relative">
      <PageHeader title="Retos Q" :subtitle="subtituloAnio">
        <template #lead>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FlagIcon class="size-5 fill-current text-primary" />
          </div>
        </template>
        <template #actions>
          <Select v-model="anio" :disabled="cargandoInicial">
            <SelectTrigger aria-label="Año">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</SelectItem>
            </SelectContent>
          </Select>
          <Button v-if="retoEnCurso" variant="outline" size="sm" @click="abrir(retoEnCurso)">
            Ir al Q en curso
            <ArrowRightIcon class="size-4" />
          </Button>
        </template>
      </PageHeader>
      <!-- Recarga (cambio de año): barra indeterminada pegada bajo el header -->
      <div v-if="recargando" class="rq-barra" role="presentation" />
    </div>

    <!-- Error (y también el caso improbable de `retos: []`) -->
    <Alert v-if="error" variant="destructive">
      <AlertDescription class="flex flex-wrap items-center gap-2">
        <span>No se pudieron cargar los retos del año.</span>
        <Button variant="ghost" size="sm" @click="cargar">Reintentar</Button>
      </AlertDescription>
    </Alert>

    <!-- Grilla -->
    <div
      v-else
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      :class="{ 'rq-recargando': recargando }"
      :aria-busy="cargandoInicial || recargando"
    >
      <template v-if="cargandoInicial">
        <Skeleton v-for="n in 4" :key="`sk-${n}`" class="h-59.5 rounded-2xl" />
      </template>
      <template v-else>
        <RetoQCard v-for="reto in retos" :key="reto.id" :reto="reto" @abrir="abrir" />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Barra indeterminada de recarga, pegada bajo el PageHeader */
.rq-barra {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -8px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--primary) 14%, transparent);
  overflow: hidden;
}
.rq-barra::after {
  content: '';
  display: block;
  height: 100%;
  width: 38%;
  border-radius: 999px;
  background: var(--primary);
  animation: rq-indeterminada 1.1s ease-in-out infinite;
}
@keyframes rq-indeterminada {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

.rq-recargando {
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 0.14s ease;
}

@media (prefers-reduced-motion: reduce) {
  .rq-barra::after {
    animation: none;
    width: 100%;
    opacity: 0.6;
  }
  .rq-recargando {
    transition: none;
  }
}
</style>
