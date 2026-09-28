<!--
  Crear la planta de una oferta como un PROYECTO de verdad.

  Reemplaza a AgregarProyectoDialog, que pedía cinco campos (nombre, kWp,
  departamento, municipio, operador) y creaba plantas vacías. El CRM no guarda
  datos de proyecto propios: lee de la tabla `proyectos` o crea filas ahí, así
  que acá se usa el MISMO formulario de /proyectos (ProyectoForm.vue) y no una
  copia reducida — que es justo como los dos formularios habían divergido.

  Y lo que faltaba y rompía la integración: la planta creada queda **vinculada a
  la oferta** (`?oferta_id=`). Antes se colgaba solo de la oportunidad, y
  GET /comercial/proyectos-operando —que resuelve las plantas de cada contrato
  por la oferta— devolvía nodos con `"proyectos": []`. La planta podía existir
  con todos sus datos cargados (La Catedral, de la oferta OP.COM No.0021-1-2026)
  y la integración no la veía.
-->
<script setup lang="ts">
import type { ProyectoEditable, ProyectoInfoTecnica } from '~/types/proyecto'
import type { Oferta, Oportunidad } from '~/features/comercial/types'
import type { PayloadInversionista } from '~/features/proyectos/types'
import { TriangleAlertIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { readDetail } from '~/core/errors'
import { ComercialService } from '~/features/comercial/services/comercial'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import ProyectoForm from '~/features/proyectos/components/ProyectoForm.vue'

const props = defineProps<{
  visible: boolean
  oportunidadId: Oportunidad['id']
  /** La oferta a la que se le pega la planta. Sin ella se crea suelta. */
  oferta?: Oferta | null
}>()
const emit = defineEmits<{ 'update:visible': [visible: boolean]; creado: [proyecto: { id: number; nombre_comercial: string }] }>()

const confirm = useConfirm()
const comercialService = new ComercialService()
const proyectosService = new ProyectosService()

const guardando = ref(false)
const error = ref('')

const codigoOferta = computed(
  () => props.oferta?.codigo_seguimiento || props.oferta?.numero_oferta || `la oferta #${props.oferta?.id}`,
)

watch(
  () => props.visible,
  (v) => {
    if (!v) error.value = ''
  },
)

function mensajeError(err: unknown): string {
  const e = err as { data?: unknown } | undefined
  return readDetail(e?.data) ?? 'No se pudo crear el proyecto'
}

/**
 * ProyectoForm emite (payload, infoTecnica, inversionista). Las dos últimas
 * necesitan un proyecto ya creado, así que van en llamadas posteriores — igual
 * que en /proyectos. Si alguna falla no se deshace la planta: existe y está
 * vinculada, que es lo que importa; se avisa y se completa desde el proyecto.
 *
 * `forzar` va al FINAL y ya no en la tercera posición: ahí llega ahora el
 * inversionista, y un objeto en ese lugar se habría leído como `forzar=true`,
 * saltándose el aviso de posible duplicado sin que nadie lo notara.
 */
async function crear(
  payload: ProyectoEditable,
  infoTecnica?: ProyectoInfoTecnica | null,
  inversionista: PayloadInversionista | null = null,
  forzar = false,
) {
  guardando.value = true
  error.value = ''
  try {
    const filtros = { ...(forzar ? { forzar: true } : {}), ...(props.oferta?.id ? { oferta_id: props.oferta.id } : {}) }
    const data = await comercialService.crearProyectoDesdeCRM(props.oportunidadId, payload, filtros)

    if (infoTecnica && Object.keys(infoTecnica).length) {
      try {
        await proyectosService.guardarInfoTecnica(data.id, infoTecnica)
      } catch {
        toast.warning('La planta se creó, pero la ficha técnica no', {
          description: 'Completá potencia AC y paneles desde el proyecto.',
          duration: 6000,
        })
      }
    }

    if (inversionista?.cliente_id) {
      try {
        await proyectosService.agregarInversionista(data.id, inversionista)
      } catch {
        toast.warning('La planta se creó, pero el inversionista no se vinculó', {
          description: 'Agregalo desde el proyecto.',
          duration: 6000,
        })
      }
    }

    toast.success(`Planta «${data.nombre_comercial}» creada`, {
      description: props.oferta ? `Vinculada a ${codigoOferta.value}.` : 'Sin vincular a ninguna oferta.',
    })
    emit('creado', data)
    emit('update:visible', false)
  } catch (err) {
    const e = err as { status?: number; data?: { detail?: { codigo?: string; mensaje?: string } } }
    const det = e.data?.detail
    if (e.status === 409 && det?.codigo === 'posible_duplicado') {
      confirm({
        title: 'Posible duplicado',
        description: `${det.mensaje}. ¿Crear de todos modos?`,
        confirmLabel: 'Crear igual',
        cancelLabel: 'Cancelar',
        onConfirm: () => crear(payload, infoTecnica, inversionista, true),
      })
    } else {
      error.value = mensajeError(err)
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="(v: boolean) => !guardando && emit('update:visible', v)">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Crear planta</DialogTitle>
        <DialogDescription>
          Se crea en <strong>Proyectos</strong>, con todos sus datos.
          <span v-if="oferta"> Queda vinculada a {{ codigoOferta }}.</span>
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="!oferta">
        <TriangleAlertIcon class="text-warning" />
        <AlertDescription>
          Se va a crear sin vincular a ninguna oferta. Cumplimiento y
          <code>/comercial/proyectos-operando</code> no la van a ver hasta que la
          vincules desde el panel de una oferta.
        </AlertDescription>
      </Alert>

      <ProyectoForm
        operador-red-obligatorio
        :guardando="guardando"
        @save="crear"
        @cancel="emit('update:visible', false)"
      />

      <Alert v-if="error" variant="destructive">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </DialogContent>
  </Dialog>
</template>
