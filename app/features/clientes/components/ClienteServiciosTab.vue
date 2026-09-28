<script setup lang="ts">
import type {
  PayloadTasaServicioCliente,
  ProyectoClienteResumen,
  ServicioContratosResumen,
  TasaServicioCliente,
} from '~/features/clientes/types'
import type { Vigencia } from '~/types/cliente'
import { PencilIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { ClientesService } from '~/features/clientes/services/clientes'
import { fmtFecha, SEMAFORO, servicioLabel } from './clientesUi'

type BadgeColor = 'default' | 'success' | 'warning' | 'destructive'

const SEMAFORO_COLOR: Record<Vigencia, BadgeColor> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'destructive',
}

// Ver `app/utils/impuestos_factura.py` (`tasas_efectivas`) en el backend: es lo
// que aplica el Panel Contable y las Liquidaciones.
const SERVICIOS_TASA = ['Representación', 'CGM', 'Administración']

const props = defineProps<{ clienteId: number }>()

const clientesService = new ClientesService()
const confirm = useConfirm()

const serviciosQuery = useQuery<ServicioContratosResumen[]>()
const tasasQuery = useQuery<TasaServicioCliente[]>()
const proyectos = ref<ProyectoClienteResumen[]>([])
const guardando = ref(false)

async function cargarServicios() {
  await serviciosQuery.run(() => clientesService.listarServiciosContratos(props.clienteId))
}
async function cargarTasas() {
  await tasasQuery.run(() => clientesService.listarTasasServicio(props.clienteId))
}
async function cargarProyectos() {
  if (proyectos.value.length) return
  proyectos.value = await clientesService.listarProyectos(props.clienteId)
}

onMounted(() => {
  cargarServicios()
  cargarTasas()
})

function nombreProyectoTasa(proyectoId: number | null | undefined) {
  if (!proyectoId) return 'Todos los proyectos'
  return (
    proyectos.value.find((p) => p.id === proyectoId)?.nombre_comercial ?? `Proyecto #${proyectoId}`
  )
}

function blankTasa() {
  return {
    servicio: '',
    // El ComboBox trabaja con valores string; se convierte a number al armar el payload.
    proyecto_id: null as string | null,
    iva_pct: null as number | null,
    retencion_pct: null as number | null,
    reteiva_pct: null as number | null,
    reteica_pct: null as number | null,
  }
}

const dialogTasa = ref(false)
const editandoTasa = ref<TasaServicioCliente | null>(null)
const formTasa = reactive(blankTasa())

async function abrirDialogoTasa(tasa: TasaServicioCliente | null) {
  editandoTasa.value = tasa
  Object.assign(
    formTasa,
    tasa
      ? {
          servicio: tasa.servicio,
          proyecto_id: tasa.proyecto_id ? String(tasa.proyecto_id) : null,
          iva_pct: tasa.iva_pct ?? null,
          retencion_pct: tasa.retencion_pct ?? null,
          reteiva_pct: tasa.reteiva_pct ?? null,
          reteica_pct: tasa.reteica_pct ?? null,
        }
      : blankTasa(),
  )
  await cargarProyectos()
  dialogTasa.value = true
}

async function guardarTasa() {
  guardando.value = true
  try {
    const payload: PayloadTasaServicioCliente = {
      servicio: formTasa.servicio,
      proyecto_id: formTasa.proyecto_id ? Number(formTasa.proyecto_id) : null,
      iva_pct: formTasa.iva_pct,
      retencion_pct: formTasa.retencion_pct,
      reteiva_pct: formTasa.reteiva_pct,
      reteica_pct: formTasa.reteica_pct,
    }
    await clientesService.guardarTasaServicio(props.clienteId, payload)
    dialogTasa.value = false
    toast.success('Tasa de servicio guardada')
    await cargarTasas()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    guardando.value = false
  }
}

function confirmarEliminarTasa(tasa: TasaServicioCliente) {
  confirm({
    title: 'Eliminar excepción de tasa',
    description: `¿Eliminar la excepción de "${tasa.servicio}"${tasa.proyecto_id ? '' : ' (todos los proyectos)'}?`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminarTasa(tasa),
  })
}

async function eliminarTasa(tasa: TasaServicioCliente) {
  try {
    await clientesService.eliminarTasaServicio(props.clienteId, tasa.id)
    toast.success('Eliminada')
    await cargarTasas()
  } catch (err) {
    toast.error('Error al eliminar', { description: normalizeError(err).message })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Servicios contratados (derivados de los contratos de las plantas) -->
    <div>
      <h3 class="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Servicios contratados
      </h3>
      <AsyncView :query="serviciosQuery">
        <template #empty>
          <p class="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
            Este cliente no tiene contratos de servicio en sus plantas.
          </p>
        </template>
        <template #default="{ data: grupos }">
          <div class="space-y-3">
            <Card v-for="g in grupos" :key="g.servicio">
              <CardHeader class="flex flex-row flex-wrap items-center gap-2">
                <CardTitle>{{ servicioLabel(g.servicio) }}</CardTitle>
                <GBadge
                  >{{ g.num_plantas }} {{ g.num_plantas === 1 ? 'planta' : 'plantas' }}</GBadge
                >
                <GBadge
                  v-if="g.semaforo && g.semaforo !== 'vigente'"
                  :color="SEMAFORO_COLOR[g.semaforo]"
                  class="ml-auto"
                >
                  {{ SEMAFORO[g.semaforo].label }}
                </GBadge>
              </CardHeader>
              <CardContent class="divide-y p-0">
                <div
                  v-for="c in g.contratos"
                  :key="c.contrato_id"
                  class="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold">
                      {{ c.proyecto_nombre || 'Sin planta' }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ c.numero_contrato ? `N° ${c.numero_contrato} · ` : ''
                      }}{{ fmtFecha(c.fecha_inicio) }} → {{ fmtFecha(c.fecha_fin) }}
                      <span v-if="c.tarifa != null"> · tarifa {{ c.tarifa }}</span>
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <GBadge v-if="c.semaforo" :color="SEMAFORO_COLOR[c.semaforo]">
                      {{ SEMAFORO[c.semaforo].label }}
                    </GBadge>
                    <a
                      v-if="c.enlace_drive"
                      :href="c.enlace_drive"
                      target="_blank"
                      rel="noopener"
                      class="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Abrir contrato
                    </a>
                    <span v-else class="text-xs text-muted-foreground italic">Sin link</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </template>
      </AsyncView>
    </div>

    <!-- Excepciones de tasa por servicio -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Excepciones de tasa por servicio
        </h3>
        <Button size="sm" variant="outline" @click="abrirDialogoTasa(null)">
          <PlusIcon class="size-4" />
          Agregar excepción
        </Button>
      </div>
      <p class="mb-3 text-xs text-muted-foreground">
        Sobrescribe el IVA/retención/ReteIVA/ReteICA general del cliente solo para un servicio (y
        opcionalmente un proyecto) puntual. Un % vacío hereda la tasa general del cliente.
      </p>
      <AsyncView :query="tasasQuery">
        <template #empty>
          <p class="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
            Sin excepciones — este cliente usa sus tasas generales para todos los servicios.
          </p>
        </template>
        <template #default="{ data: tasas }">
          <div class="space-y-2">
            <Item v-for="t in tasas" :key="t.id" variant="outline">
              <ItemContent>
                <ItemTitle>
                  {{ t.servicio }}
                  <span class="font-normal text-muted-foreground">
                    · {{ nombreProyectoTasa(t.proyecto_id) }}</span
                  >
                </ItemTitle>
                <ItemDescription>
                  <span v-if="t.iva_pct != null">IVA {{ t.iva_pct }}% · </span>
                  <span v-if="t.retencion_pct != null">Retención {{ t.retencion_pct }}% · </span>
                  <span v-if="t.reteiva_pct != null">ReteIVA {{ t.reteiva_pct }}% · </span>
                  <span v-if="t.reteica_pct != null">ReteICA {{ t.reteica_pct }}%</span>
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="icon-sm" @click="abrirDialogoTasa(t)">
                  <PencilIcon class="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" @click="confirmarEliminarTasa(t)">
                  <Trash2Icon class="size-4 text-destructive" />
                </Button>
              </ItemActions>
            </Item>
          </div>
        </template>
      </AsyncView>
    </div>

    <Dialog v-model:open="dialogTasa">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{
            editandoTasa?.id ? 'Editar excepción de tasa' : 'Nueva excepción de tasa'
          }}</DialogTitle>
        </DialogHeader>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <GLabel required>Servicio</GLabel>
            <ComboBox
              v-model="formTasa.servicio"
              :options="SERVICIOS_TASA.map((s) => ({ label: s, value: s }))"
              placeholder="Seleccionar"
            />
          </div>
          <div class="space-y-1.5">
            <GLabel>Proyecto</GLabel>
            <ComboBox
              v-model="formTasa.proyecto_id"
              :options="proyectos.map((p) => ({ label: p.nombre_comercial, value: String(p.id) }))"
              placeholder="Todos los proyectos"
            />
          </div>
          <div class="space-y-1.5">
            <GLabel>IVA %</GLabel>
            <NumberField v-model="formTasa.iva_pct" :format-options="{ maximumFractionDigits: 2 }">
              <NumberFieldContent
                ><NumberFieldInput placeholder="Hereda del cliente"
              /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1.5">
            <GLabel>Retención %</GLabel>
            <NumberField
              v-model="formTasa.retencion_pct"
              :format-options="{ maximumFractionDigits: 2 }"
            >
              <NumberFieldContent
                ><NumberFieldInput placeholder="Hereda del cliente"
              /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1.5">
            <GLabel>ReteIVA %</GLabel>
            <NumberField
              v-model="formTasa.reteiva_pct"
              :format-options="{ maximumFractionDigits: 2 }"
            >
              <NumberFieldContent
                ><NumberFieldInput placeholder="Hereda del cliente"
              /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1.5">
            <GLabel>ReteICA %</GLabel>
            <NumberField
              v-model="formTasa.reteica_pct"
              :format-options="{ maximumFractionDigits: 2 }"
            >
              <NumberFieldContent
                ><NumberFieldInput placeholder="Hereda del cliente"
              /></NumberFieldContent>
            </NumberField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="dialogTasa = false">Cancelar</Button>
          <Button :disabled="!formTasa.servicio || guardando" @click="guardarTasa">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
