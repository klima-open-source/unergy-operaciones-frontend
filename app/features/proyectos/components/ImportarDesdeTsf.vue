<script setup lang="ts">
/**
 * Paso 1 de «Importar desde TSF»: buscar el proyecto en Portfolio Manager
 * (originabot) y traer su detalle. El paso 2 es `ProyectoForm` con `importado`.
 *
 * Antes de seguir se comprueba que la planta no exista ya en Operaciones (mismo
 * `codigo_tsf` u `origina_code`, como cruza `tsf_sync`): importarla de nuevo sería
 * el duplicado que esa sincronización existe para evitar.
 */
import { LoaderCircleIcon, SearchIcon } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { normalizeError } from '~/core/errors'
import { proyectoExistente } from '~/features/proyectos/prellenadoTsf'
import { ClientesService } from '~/features/clientes/services/clientes'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { OriginabotService } from '~/features/proyectos/services/originabot'
import type {
  ImportacionTsf,
  InversionistaTsfResuelto,
  ProyectoTsf,
  ResultadoTsf,
} from '~/features/proyectos/types'

const props = defineProps<{
  /** Los proyectos ya cargados en la vista, para detectar el duplicado. */
  proyectosExistentes: { nombre_comercial: string; codigo_tsf?: string | null; origina_code?: string | null }[]
}>()

const emit = defineEmits<{
  seleccionar: [importacion: ImportacionTsf]
  volver: []
}>()

const MINIMO = 3

const servicio = new OriginabotService()
const operadoresRed = new OperadoresRedService()
const clientes = new ClientesService()
const confirm = useConfirm()

function confirmar(titulo: string, descripcion: string): Promise<boolean> {
  return new Promise((resolver) =>
    confirm({
      title: titulo,
      description: descripcion,
      confirmLabel: 'Sí, crear',
      onConfirm: () => resolver(true),
      onCancel: () => resolver(false),
    }),
  )
}

/** Vincula el operador de TSF; si eso lo CREARÍA en Operaciones, pregunta antes. */
/**
 * El cliente de Operaciones de cada inversionista de TSF. Si vincularlo lo
 * CREARÍA, pregunta antes; el que no se confirme (o falle) no entra: el
 * formulario permite agregarlo a mano.
 */
async function resolverInversionistas(
  inversionistas: ProyectoTsf['inversionistas'],
): Promise<InversionistaTsfResuelto[]> {
  const resueltos: InversionistaTsfResuelto[] = []
  for (const inv of inversionistas) {
    try {
      const simulacion = await clientes.simularInversionistaOriginabot(inv.id, inv.nombre)
      if (simulacion.estado === 'creado') {
        const si = await confirmar(
          `Esta acción creará el cliente «${inv.nombre}» en Operaciones`,
          'Es inversionista del proyecto en TSF y aún no existe como cliente. ¿Desea continuar? Si no, puedes agregarlo a mano en el formulario.',
        )
        if (!si) continue
      }
      const cliente = await clientes.vincularInversionistaOriginabot(inv.id, inv.nombre)
      if (cliente.id) resueltos.push({ cliente_id: cliente.id, nombre: cliente.razon_social_nombre })
    } catch {
      // Sin vínculo no entra; se agrega a mano en el formulario.
    }
  }
  return resueltos
}

async function vincularOperador(codigo: string, nombre: string) {
  try {
    const simulacion = await operadoresRed.simularVinculoOriginabot(codigo, nombre)
    if (simulacion.estado === 'existente') return
    if (simulacion.estado === 'creado') {
      const si = await confirmar(
        `Esta acción creará el operador de red «${nombre}» en Operaciones`,
        'Viene de TSF y aún no está en el catálogo. ¿Desea continuar? Si no, el operador queda para elegirlo a mano en el formulario.',
      )
      if (!si) return
    }
    await operadoresRed.vincularOriginabot(codigo, nombre)
  } catch {
    // Sin vínculo el formulario cae al nombre y, si no encaja, lo deja editable.
  }
}

const busqueda = ref('')
const resultados = ref<ResultadoTsf[]>([])
const truncado = ref(false)
const buscando = ref(false)
const buscado = ref(false)
const cargandoId = ref<number | null>(null)
const error = ref('')

// La última búsqueda gana: si una lenta llega después de una rápida, se descarta.
let ultima = 0

const buscar = useDebounceFn(async (texto: string) => {
  const propia = ++ultima
  error.value = ''
  if (texto.trim().length < MINIMO) {
    resultados.value = []
    buscado.value = false
    return
  }
  buscando.value = true
  try {
    const r = await servicio.buscar(texto.trim())
    if (propia !== ultima) return
    resultados.value = r.resultados
    truncado.value = r.truncado
    buscado.value = true
  } catch (e) {
    if (propia === ultima) error.value = normalizeError(e).message
  } finally {
    if (propia === ultima) buscando.value = false
  }
}, 400)

watch(busqueda, (texto) => buscar(texto))

async function elegir(resultado: ResultadoTsf) {
  error.value = ''
  cargandoId.value = resultado.minigranjaId
  try {
    const proyecto = await servicio.minigranja(resultado.minigranjaId)
    const existente = proyectoExistente(proyecto, props.proyectosExistentes)
    if (existente) {
      error.value = `${proyecto.codigoOrigina} ya existe en Operaciones como «${existente.nombre_comercial}».`
      return
    }
    // Que el operador de TSF exista en el catálogo con su llave antes de abrir
    // el formulario, que cruza por ella. Si falla o la persona no confirma crearlo,
    // el formulario cae al nombre y, si tampoco encaja, deja el campo editable.
    if (proyecto.operadorRedCodigo && proyecto.operadorRed) {
      await vincularOperador(proyecto.operadorRedCodigo, proyecto.operadorRed)
    }
    const inversionistasResueltos = await resolverInversionistas(proyecto.inversionistas)
    emit('seleccionar', { ...proyecto, inversionistasResueltos })
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    cargandoId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pt-2">
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput v-model="busqueda" placeholder="Código o municipio, p. ej. colce" autofocus />
      <InputGroupAddon v-if="buscando" align="inline-end">
        <LoaderCircleIcon class="animate-spin" />
      </InputGroupAddon>
    </InputGroup>

    <Alert v-if="error" variant="destructive">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <p v-if="busqueda.trim().length < MINIMO" class="text-sm text-muted-foreground">
      Escribe al menos {{ MINIMO }} caracteres para buscar en Portfolio Manager.
    </p>
    <EmptyState
      v-else-if="buscado && !resultados.length && !buscando"
      title="Sin resultados en TSF"
      description="Prueba con otra parte del código o con el municipio."
    />

    <ul v-if="resultados.length" class="flex max-h-96 flex-col gap-2 overflow-y-auto">
      <li v-for="r in resultados" :key="r.minigranjaId">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted disabled:opacity-50"
          :disabled="cargandoId !== null"
          @click="elegir(r)"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <TruncatedText :text="r.codigo" class="text-sm font-medium" />
            <span class="text-xs text-muted-foreground">
              {{ [r.ubicacion, r.operadorRed].filter(Boolean).join(' · ') || 'Sin ubicación en TSF' }}
            </span>
          </div>
          <GBadge>{{ r.etapaLabel }}</GBadge>
          <LoaderCircleIcon v-if="cargandoId === r.minigranjaId" class="size-4 animate-spin" />
        </button>
      </li>
    </ul>
    <p v-if="truncado" class="text-xs text-muted-foreground">
      Hay más resultados de los que se muestran: afina la búsqueda.
    </p>

    <div class="flex justify-start">
      <Button type="button" variant="ghost" @click="emit('volver')">Volver</Button>
    </div>
  </div>
</template>
