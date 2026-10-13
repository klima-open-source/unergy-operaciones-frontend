<script setup lang="ts">
/**
 * Página de ancho completo para crear (`/fallas/nueva`) o editar
 * (`/fallas/:id/editar`) una falla. Antes era un diálogo chico encima de la
 * lista; el formulario es largo y en el diálogo había que hacer scroll dentro
 * de un scroll.
 *
 * La query de la lista (sus filtros) llega con la navegación y se devuelve
 * intacta al volver, así la lista queda como se dejó.
 */
import type { LocationQuery } from 'vue-router'
import type { CatalogosFalla, Falla, PayloadFallaForm } from '~/features/fallas/types'
import { ArrowLeftIcon, CircleAlertIcon } from '@lucide/vue'
import { FallasService } from '~/features/fallas/services/fallas'
import { useGuardarFalla } from '~/features/fallas/composables/useGuardarFalla'
import { ParamQueryFallas, RUTAS_FALLAS } from '~/features/fallas/utils/rutas'
import FallaForm from './FallaForm.vue'

const props = defineProps<{
  /** Sin id: crear. Con id: editar esa falla. */
  fallaId?: Falla['id'] | null
}>()

interface DatosFormulario {
  catalogos: CatalogosFalla
  falla: Falla | null
}

const fallasService = new FallasService()
const route = useRoute()
const router = useRouter()
const query = useQuery<DatosFormulario>()
const { guardando, guardar } = useGuardarFalla()

const editando = computed(() => props.fallaId != null)

/** `?proyectos=12,45` → `[12, 45]`. */
const prefillProyectoIds = computed<number[]>(() => {
  const crudo = route.query[ParamQueryFallas.PREFILL_PROYECTOS]
  const texto = Array.isArray(crudo) ? crudo.join(',') : (crudo ?? '')
  return texto
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
})

/** La query de la lista, sin los parámetros propios del formulario. */
function queryDeLista(): LocationQuery {
  const { [ParamQueryFallas.PREFILL_PROYECTOS]: _prefill, ...resto } = route.query
  return resto
}

function cargar() {
  return query.run(async () => {
    const [catalogos, falla] = await Promise.all([
      fallasService.obtenerCatalogos(),
      props.fallaId != null ? fallasService.obtener(props.fallaId) : Promise.resolve(null),
    ])
    return { catalogos, falla }
  })
}

/**
 * De vuelta a la lista con sus filtros. Al editar (guardando o cancelando) se
 * vuelve con el panel de esa falla abierto, como pasaba con el diálogo.
 */
function volver() {
  const destino = queryDeLista()
  if (props.fallaId != null) destino[ParamQueryFallas.ABRIR_FALLA] = String(props.fallaId)
  return router.push({ path: RUTAS_FALLAS.lista, query: destino })
}

async function onSave(payload: PayloadFallaForm) {
  const ids = await guardar(payload, query.data?.falla ?? null)
  if (ids) await volver()
}

onMounted(cargar)
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader
      :title="
        editando ? `Editar falla ${query.data?.falla?.codigo_interno ?? ''}`.trim() : 'Nueva falla'
      "
      :subtitle="
        editando
          ? query.data?.falla?.proyecto?.nombre_comercial
          : 'Registra una falla; si eliges varios proyectos se crea una por cada uno.'
      "
    >
      <template #lead>
        <Button variant="ghost" size="icon" title="Volver a Gestión de Fallas" @click="volver()">
          <ArrowLeftIcon />
        </Button>
      </template>
      <template #actions>
        <Button variant="outline" size="sm" @click="volver()">
          <ArrowLeftIcon /> Volver a Gestión de Fallas
        </Button>
      </template>
    </PageHeader>

    <AsyncView :query="query">
      <template #error="{ error }">
        <div class="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <CircleAlertIcon class="size-10 text-destructive" />
          <p class="text-sm font-semibold text-foreground">
            {{
              error.code === 'NOT_FOUND' ? 'Falla no encontrada' : 'No se pudo cargar el formulario'
            }}
          </p>
          <p class="text-sm text-muted-foreground">{{ error.message }}</p>
          <Button variant="outline" size="sm" @click="cargar">Reintentar</Button>
        </div>
      </template>

      <template #default="{ data }">
        <div class="rounded-xl border bg-card p-4 md:p-6">
          <FallaForm
            :initial="data.falla"
            :catalogos="data.catalogos"
            :prefill-proyecto-ids="prefillProyectoIds"
            :guardando="guardando"
            @save="onSave"
            @cancel="volver()"
          />
        </div>
      </template>
    </AsyncView>
  </div>
</template>
