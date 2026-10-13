<script setup lang="ts">
/**
 * «Sincronizar con TSF» en la ficha del proyecto.
 *
 * Trae de TSF todo lo que hay de la planta —minigranja, datos técnicos de la
 * pre-simulación (PVsyst), generación simulada, nivel de tensión, ECS y el
 * contrato de arrendamiento con sus arrendadores—, lo
 * compara con lo que tiene Operaciones y muestra SOLO lo que difiere, valor
 * actual → valor de TSF. La persona elige qué aplicar (todo marcado por
 * defecto) y confirma; nada se escribe solo. Ver `~/features/proyectos/sincronizacionTsf`
 * y, para el arriendo, `~/features/proyectos/sincronizacionArriendo`.
 *
 * Escribe solo en Operaciones; en TSF no cambia nada.
 */
import { RefreshCwIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import divipola from '~/data/colombia-divipola.json'
import { normalizeError } from '~/core/errors'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import type { OperadorRedCatalogo } from '~/features/proyectos/prellenadoTsf'
import { OriginabotService } from '~/features/proyectos/services/originabot'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import PlanArriendoTsf from '~/features/proyectos/components/PlanArriendoTsf.vue'
import {
  accionesSeleccionadas as accionesMarcadas,
  hayCambiosArriendo,
  seleccionInicial,
} from '~/features/proyectos/arriendoTsf'
import {
  useSincronizacionArriendo,
  type ArriendoPreparado,
} from '~/features/proyectos/sincronizacionArriendo'
import type { InversionistaProyecto, ProyectoTsf } from '~/features/proyectos/types'
import {
  cambiosDesdeTsf,
  payloadsDe,
  type CambioTsf,
  type ProyectoActual,
} from '~/features/proyectos/sincronizacionTsf'
import { useVinculoOperadorTsf } from '~/features/proyectos/vinculoOperadorTsf'

const props = defineProps<{
  proyecto: ProyectoActual & {
    id: number
    originabot_minifarm_id?: number | null
    inversionistas?: InversionistaProyecto[]
  }
}>()
const emit = defineEmits<{ actualizado: [] }>()

const proyectos = new ProyectosService()
const originabot = new OriginabotService()
const operadoresRed = new OperadoresRedService()
const { vincularOperador } = useVinculoOperadorTsf()
const sincronizacionArriendo = useSincronizacionArriendo()

const consultando = ref(false)
const aplicando = ref(false)
const abierto = ref(false)
const cambios = ref<CambioTsf[]>([])
const elegidos = ref<Set<string>>(new Set())

const clave = (c: CambioTsf) => `${c.destino}:${c.clave}`
const seleccionados = computed(() => cambios.value.filter((c) => elegidos.value.has(clave(c))))

// ── Arriendo ──
const arriendo = ref<ArriendoPreparado | null>(null)
const conContrato = ref(false)
const accionesElegidas = ref<boolean[]>([])
const planArriendo = computed(() => arriendo.value?.plan ?? null)
const accionesSeleccionadas = computed(() =>
  planArriendo.value
    ? accionesMarcadas(planArriendo.value, conContrato.value, accionesElegidas.value)
    : [],
)
const totalElegidos = computed(
  () =>
    seleccionados.value.length +
    (conContrato.value ? 1 : 0) +
    accionesSeleccionadas.value.length,
)

/** El arriendo nunca impide sincronizar lo demás: si falla, se avisa y sigue. */
async function prepararArriendo(tsf: ProyectoTsf) {
  arriendo.value = null
  if (!tsf.arriendo) return
  try {
    const p = await sincronizacionArriendo.preparar(
      props.proyecto.id,
      props.proyecto.inversionistas ?? [],
      tsf.arriendo,
    )
    arriendo.value = p
    const inicial = seleccionInicial(p.plan)
    conContrato.value = inicial.conContrato
    accionesElegidas.value = inicial.elegidas
  } catch (e) {
    toast.warning('No se pudo comparar el arriendo', { description: normalizeError(e).message })
  }
}

function alternar(c: CambioTsf, marcado: boolean | 'indeterminate') {
  const nuevo = new Set(elegidos.value)
  if (marcado === true) nuevo.add(clave(c))
  else nuevo.delete(clave(c))
  elegidos.value = nuevo
}

async function consultar() {
  consultando.value = true
  try {
    const minigranja =
      props.proyecto.originabot_minifarm_id ??
      (await proyectos.minigranjaOriginabot(props.proyecto.id)).originabot_minifarm_id
    const tsf = await originabot.minigranja(minigranja)
    if (tsf.operadorRedCodigo && tsf.operadorRed) {
      await vincularOperador(
        tsf.operadorRedCodigo,
        tsf.operadorRed,
        'Si no, el operador de red no se propone en la sincronización.',
      )
    }
    const catalogo = (await operadoresRed.listar()) as OperadorRedCatalogo[]
    cambios.value = cambiosDesdeTsf(tsf, props.proyecto, divipola, catalogo)
    await prepararArriendo(tsf)
    if (!cambios.value.length && !hayCambiosArriendo(planArriendo.value)) {
      toast.success('Todo coincide con TSF', { description: 'No hay datos nuevos para traer.' })
      return
    }
    elegidos.value = new Set(cambios.value.map(clave))
    abierto.value = true
  } catch (e) {
    toast.error('No se pudo consultar TSF', { description: normalizeError(e).message })
  } finally {
    consultando.value = false
  }
}

async function aplicar() {
  const { proyecto, infoTecnica } = payloadsDe(seleccionados.value)
  const total = totalElegidos.value
  aplicando.value = true
  try {
    if (arriendo.value && (conContrato.value || accionesSeleccionadas.value.length)) {
      const hecho = await sincronizacionArriendo.aplicar(
        props.proyecto.id,
        arriendo.value,
        conContrato.value,
        accionesSeleccionadas.value,
      )
      if (!hecho) return
    }
    if (Object.keys(proyecto).length) await proyectos.actualizar(props.proyecto.id, proyecto)
    if (Object.keys(infoTecnica).length) await proyectos.guardarInfoTecnica(props.proyecto.id, infoTecnica)
    toast.success(`${total} ${total === 1 ? 'cambio aplicado' : 'cambios aplicados'} desde TSF`)
    abierto.value = false
    emit('actualizado')
  } catch (e) {
    toast.error('No se pudo guardar', { description: normalizeError(e).message })
  } finally {
    aplicando.value = false
  }
}
</script>

<template>
  <Button variant="outline" size="sm" :disabled="consultando" @click="consultar">
    <RefreshCwIcon class="size-4" :class="consultando ? 'animate-spin' : undefined" />
    Sincronizar con TSF
  </Button>

  <Dialog v-model:open="abierto">
    <DialogContent class="sm:max-w-2xl max-h-dvh overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Datos de TSF para esta planta</DialogTitle>
        <DialogDescription>
          Solo lo que difiere de Operaciones. Desmarca lo que no quieras traer; en TSF no se cambia nada.
        </DialogDescription>
      </DialogHeader>
      <div v-if="cambios.length" class="flex flex-col divide-y divide-border rounded-md border border-border">
        <label v-for="c in cambios" :key="clave(c)" class="flex items-start gap-3 px-3 py-2 text-sm">
          <Checkbox
            :model-value="elegidos.has(clave(c))"
            class="mt-0.5"
            @update:model-value="alternar(c, $event)"
          />
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="font-medium">{{ c.etiqueta }}</span>
            <span class="flex flex-wrap items-center gap-1.5 text-xs">
              <TruncatedText :text="c.actualTexto" class="max-w-xs text-muted-foreground line-through" />
              <span class="text-muted-foreground">→</span>
              <TruncatedText :text="c.propuestoTexto" class="max-w-xs text-foreground" />
            </span>
          </span>
        </label>
      </div>
      <template v-if="planArriendo && hayCambiosArriendo(planArriendo)">
        <p class="text-sm font-semibold text-foreground">Contrato de arrendamiento</p>
        <PlanArriendoTsf
          v-model:con-contrato="conContrato"
          v-model:elegidas="accionesElegidas"
          :plan="planArriendo"
        />
      </template>
      <DialogFooter>
        <Button variant="outline" @click="abierto = false">Cancelar</Button>
        <Button :disabled="aplicando || !totalElegidos" @click="aplicar">
          <Spinner v-if="aplicando" class="size-4" />
          Aplicar {{ totalElegidos }} {{ totalElegidos === 1 ? 'cambio' : 'cambios' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
