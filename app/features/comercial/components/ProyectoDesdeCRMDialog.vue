<!--
  Crear la planta de una oferta como un PROYECTO de verdad.

  Reemplaza a AgregarProyectoDialog, que pedía cinco campos (nombre, kWp,
  departamento, municipio, operador) y creaba plantas vacías. El CRM no guarda
  datos de proyecto propios: lee de la tabla `proyectos` o crea filas ahí, así
  que acá se usa el MISMO formulario de /proyectos (ProyectoForm.vue) y no una
  copia reducida — que es justo como los dos formularios habían divergido.

  Y lo que faltaba y rompía la integración: la planta creada queda **vinculada a
  la oferta** (`?oferta_id=`). Antes se colgaba solo de la oportunidad, y
  GET /comercial/proyectos-operando resuelve las plantas por la oferta: la
  planta existía y la API seguía devolviendo `"proyectos": []`.
-->
<template>
  <Dialog :visible="visible" modal :style="{ width: '46rem' }" :closable="!guardando"
          @update:visible="$emit('update:visible', $event)">
    <template #header>
      <div>
        <h2 class="text-base font-semibold" style="color:var(--color-unergy-deep)">Crear planta</h2>
        <p class="text-xs" style="color:#9b89b5">
          Se crea en <strong>Proyectos</strong>, con todos sus datos.
          <span v-if="oferta"> Queda vinculada a {{ codigoOferta }}.</span>
        </p>
      </div>
    </template>

    <Message v-if="!oferta" severity="warn" :closable="false" class="mb-3">
      <span class="text-xs">
        Se va a crear sin vincular a ninguna oferta. Cumplimiento y
        <code>/comercial/proyectos-operando</code> no la van a ver hasta que la
        vincules desde el panel de una oferta.
      </span>
    </Message>

    <ProyectoForm operador-red-obligatorio :guardando="guardando"
                  @save="crear" @cancel="$emit('update:visible', false)" />

    <Message v-if="error" severity="error" :closable="false" class="mt-3">
      <span class="text-xs">{{ error }}</span>
    </Message>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { toast } from 'vue-sonner'
import { ComercialService } from '~/features/comercial/services/comercial'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import ProyectoForm from '~/features/proyectos/components/ProyectoForm.vue'

const props = defineProps({
  visible: Boolean,
  oportunidadId: { type: [Number, String], required: true },
  /** La oferta a la que se le pega la planta. Sin ella se crea suelta. */
  oferta: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'creado'])

const confirm = useConfirm()
const comercialService = new ComercialService()
const proyectosService = new ProyectosService()

const guardando = ref(false)
const error = ref('')

const codigoOferta = computed(() =>
  props.oferta?.codigo_seguimiento || props.oferta?.numero_oferta || `la oferta #${props.oferta?.id}`)

watch(() => props.visible, (v) => { if (!v) error.value = '' })

function mensajeError(det) {
  if (typeof det === 'string') return det
  if (Array.isArray(det)) return det.map((e) => e.msg).filter(Boolean).join('; ') || 'Datos inválidos'
  if (det && typeof det === 'object') return det.mensaje ?? det.msg ?? 'No se pudo crear el proyecto'
  return 'No se pudo crear el proyecto'
}

/**
 * ProyectoForm emite (payload, infoTecnica). La info técnica necesita un
 * proyecto ya creado, así que va en un PUT posterior — igual que en /proyectos.
 * Si ese PUT falla no se deshace la planta: existe y está vinculada, que es lo
 * que importa; se avisa y se completa desde el proyecto.
 */
async function crear(payload, infoTecnica, forzar = false) {
  guardando.value = true
  error.value = ''
  try {
    const filtros = { ...(forzar ? { forzar: true } : {}) }
    if (props.oferta?.id) filtros.oferta_id = props.oferta.id
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

    toast.success(`Planta «${data.nombre_comercial}» creada`, {
      description: props.oferta ? `Vinculada a ${codigoOferta.value}.` : 'Sin vincular a ninguna oferta.',
      duration: 4000,
    })
    emit('creado', data)
    emit('update:visible', false)
  } catch (err) {
    const det = err.data?.detail
    if (err.status === 409 && det?.codigo === 'posible_duplicado') {
      confirm({
        title: 'Posible duplicado',
        description: `${det.mensaje}. ¿Crear de todos modos?`,
        confirmLabel: 'Crear igual',
        cancelLabel: 'Cancelar',
        onConfirm: () => crear(payload, infoTecnica, true),
      })
    } else {
      error.value = mensajeError(det)
    }
  } finally {
    guardando.value = false
  }
}
</script>
