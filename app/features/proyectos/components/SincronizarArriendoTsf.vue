<script setup lang="ts">
/**
 * «Sincronizar con TSF» en la pestaña Arriendos de la operación: solo el
 * contrato de arrendamiento (canon, fecha, periodicidad, partes) y sus
 * arrendadores. Es la misma parte del arriendo que trae el botón de la ficha del
 * proyecto, sin el resto de datos de la planta. Ver
 * `~/features/proyectos/sincronizacionArriendo`.
 *
 * Escribe solo en Operaciones; en TSF no cambia nada.
 */
import { RefreshCwIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import {
  accionesSeleccionadas as accionesMarcadas,
  hayCambiosArriendo,
  seleccionInicial,
} from '~/features/proyectos/arriendoTsf'
import PlanArriendoTsf from '~/features/proyectos/components/PlanArriendoTsf.vue'
import { OriginabotService } from '~/features/proyectos/services/originabot'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import {
  useSincronizacionArriendo,
  type ArriendoPreparado,
} from '~/features/proyectos/sincronizacionArriendo'

const props = defineProps<{ proyectoId: number }>()
const emit = defineEmits<{ actualizado: [] }>()

const proyectos = new ProyectosService()
const originabot = new OriginabotService()
const sincronizacion = useSincronizacionArriendo()

const consultando = ref(false)
const aplicando = ref(false)
const abierto = ref(false)
const preparado = ref<ArriendoPreparado | null>(null)
const conContrato = ref(false)
const elegidas = ref<boolean[]>([])

const acciones = computed(() =>
  preparado.value ? accionesMarcadas(preparado.value.plan, conContrato.value, elegidas.value) : [],
)
const total = computed(() => (conContrato.value ? 1 : 0) + acciones.value.length)

async function consultar() {
  consultando.value = true
  try {
    const proyecto = await proyectos.obtener(props.proyectoId)
    const vinculada = proyecto.originabot_minifarm_id
    const minigranja =
      typeof vinculada === 'number'
        ? vinculada
        : (await proyectos.minigranjaOriginabot(props.proyectoId)).originabot_minifarm_id
    const tsf = await originabot.arriendo(minigranja)
    if (!tsf) {
      toast.info('TSF no tiene contrato de arriendo para este proyecto', {
        description: 'El proyecto no tiene contrato de arrendamiento ni termsheet en TSF.',
      })
      return
    }
    const p = await sincronizacion.preparar(props.proyectoId, proyecto.inversionistas ?? [], tsf)
    if (!hayCambiosArriendo(p.plan)) {
      toast.success('El arriendo coincide con TSF', {
        description: p.plan.nota ?? 'No hay cambios para traer.',
      })
      return
    }
    preparado.value = p
    const inicial = seleccionInicial(p.plan)
    conContrato.value = inicial.conContrato
    elegidas.value = inicial.elegidas
    abierto.value = true
  } catch (e) {
    toast.error('No se pudo consultar TSF', { description: normalizeError(e).message })
  } finally {
    consultando.value = false
  }
}

async function aplicar() {
  if (!preparado.value) return
  const n = total.value
  aplicando.value = true
  try {
    const hecho = await sincronizacion.aplicar(
      props.proyectoId,
      preparado.value,
      conContrato.value,
      acciones.value,
    )
    if (!hecho) return
    toast.success(`${n} ${n === 1 ? 'cambio aplicado' : 'cambios aplicados'} desde TSF`)
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
        <DialogTitle>Arriendo según TSF</DialogTitle>
        <DialogDescription>
          Solo lo que difiere de Operaciones. Desmarca lo que no quieras traer; en TSF no se
          cambia nada.
        </DialogDescription>
      </DialogHeader>
      <PlanArriendoTsf
        v-if="preparado"
        v-model:con-contrato="conContrato"
        v-model:elegidas="elegidas"
        :plan="preparado.plan"
      />
      <DialogFooter>
        <Button variant="outline" @click="abierto = false">Cancelar</Button>
        <Button :disabled="aplicando || !total" @click="aplicar">
          <Spinner v-if="aplicando" class="size-4" />
          Aplicar {{ total }} {{ total === 1 ? 'cambio' : 'cambios' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
