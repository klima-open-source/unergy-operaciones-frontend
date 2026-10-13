<script setup lang="ts">
/**
 * «Sincronizar con TSF» en la ficha del proyecto.
 *
 * Trae de TSF todo lo que hay de la planta —minigranja, datos técnicos de la
 * pre-simulación (PVsyst), generación simulada, nivel de tensión y ECS—, lo
 * compara con lo que tiene Operaciones y muestra SOLO lo que difiere, valor
 * actual → valor de TSF. La persona elige qué aplicar (todo marcado por
 * defecto) y confirma; nada se escribe solo. Ver `~/features/proyectos/sincronizacionTsf`.
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
import {
  cambiosDesdeTsf,
  payloadsDe,
  type CambioTsf,
  type ProyectoActual,
} from '~/features/proyectos/sincronizacionTsf'
import { useVinculoOperadorTsf } from '~/features/proyectos/vinculoOperadorTsf'

const props = defineProps<{
  proyecto: ProyectoActual & { id: number; originabot_minifarm_id?: number | null }
}>()
const emit = defineEmits<{ actualizado: [] }>()

const proyectos = new ProyectosService()
const originabot = new OriginabotService()
const operadoresRed = new OperadoresRedService()
const { vincularOperador } = useVinculoOperadorTsf()

const consultando = ref(false)
const aplicando = ref(false)
const abierto = ref(false)
const cambios = ref<CambioTsf[]>([])
const elegidos = ref<Set<string>>(new Set())

const clave = (c: CambioTsf) => `${c.destino}:${c.clave}`
const seleccionados = computed(() => cambios.value.filter((c) => elegidos.value.has(clave(c))))

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
    if (!cambios.value.length) {
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
  aplicando.value = true
  try {
    if (Object.keys(proyecto).length) await proyectos.actualizar(props.proyecto.id, proyecto)
    if (Object.keys(infoTecnica).length) await proyectos.guardarInfoTecnica(props.proyecto.id, infoTecnica)
    toast.success(`${seleccionados.value.length} datos actualizados desde TSF`)
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
      <div class="flex flex-col divide-y divide-border rounded-md border border-border">
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
      <DialogFooter>
        <Button variant="outline" @click="abierto = false">Cancelar</Button>
        <Button :disabled="aplicando || !seleccionados.length" @click="aplicar">
          <Spinner v-if="aplicando" class="size-4" />
          Aplicar {{ seleccionados.length }} {{ seleccionados.length === 1 ? 'cambio' : 'cambios' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
