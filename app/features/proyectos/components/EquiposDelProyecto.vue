<script setup lang="ts">
/**
 * Los equipos de la planta y sus inversores, en Información › Técnico.
 *
 * Modelo de Sara (2026-10-15): un equipo por tipo (cantidad, marca, potencia de
 * una unidad, detalle) y los inversores, cada uno con su potencia, colgados del
 * equipo de inversores. La marca de los inversores es la de su equipo: en una
 * planta todos son de la misma (16-oct). Reemplaza a las marcas sueltas de la info técnica.
 *
 * Fuera del modo edición a propósito: cada cambio se guarda al momento.
 */
import type {
  EquipoProyecto,
  InversorProyecto,
  PayloadEquipo,
  PayloadInversorProyecto,
} from '~/features/proyectos/types'
import { PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, ArchiveIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import {
  AYUDA_DETALLE_EQUIPO,
  ETIQUETA_TIPO_EQUIPO,
  EstadoInversor,
  TipoEquipo,
} from '~/features/proyectos/types'

const props = defineProps<{
  proyectoId: number
}>()

const proyectosService = new ProyectosService()
const confirm = useConfirm()

const query = useQuery<EquipoProyecto[]>()

async function cargar() {
  await query.run(() => proyectosService.listarEquipos(props.proyectoId))
}
onMounted(cargar)

const equipos = computed(() => query.data ?? [])
const equipoInversores = computed(
  () => equipos.value.find((e) => e.tipo === TipoEquipo.INVERSOR) ?? null,
)
const inversores = computed(() => equipoInversores.value?.inversores ?? [])
const activos = computed(() => inversores.value.filter((i) => i.estado !== EstadoInversor.RETIRADO))
const potenciaActivos = computed(() =>
  activos.value.reduce((suma, i) => suma + (Number(i.potencia_nominal_kw) || 0), 0),
)

/** Los tipos que la planta todavía no tiene: uno por tipo. */
const tiposLibres = computed(() =>
  Object.values(TipoEquipo).filter((t) => !equipos.value.some((e) => e.tipo === t)),
)

function numero(valor: number | null | undefined, decimales = 3) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('es-CO', { maximumFractionDigits: decimales })
}

function texto(valor: string | null | undefined) {
  return valor?.trim() ? valor : null
}

// ── Equipo: agregar / editar ──────────────────────────────────────────────────
const showEquipo = ref(false)
const guardandoEquipo = ref(false)
const equipoEditado = ref<EquipoProyecto | null>(null)

function equipoEnBlanco() {
  return {
    tipo: null as TipoEquipo | null,
    cantidad: null as number | null,
    marca: '',
    potencia: null as number | null,
    detalle: '',
  }
}
const formEquipo = reactive(equipoEnBlanco())

/** Con inversores cargados, la cantidad es la de ellos: no se escribe a mano. */
const cantidadAutomatica = computed(
  () => formEquipo.tipo === TipoEquipo.INVERSOR && inversores.value.length > 0,
)

function abrirAgregarEquipo() {
  equipoEditado.value = null
  Object.assign(formEquipo, equipoEnBlanco(), { tipo: tiposLibres.value[0] ?? null })
  showEquipo.value = true
}

function abrirEditarEquipo(e: EquipoProyecto) {
  equipoEditado.value = e
  Object.assign(formEquipo, {
    tipo: e.tipo,
    cantidad: e.cantidad,
    marca: e.marca ?? '',
    potencia: e.potencia != null ? Number(e.potencia) : null,
    detalle: e.detalle ?? '',
  })
  showEquipo.value = true
}

async function guardarEquipo() {
  guardandoEquipo.value = true
  const payload: PayloadEquipo = {
    marca: texto(formEquipo.marca),
    potencia: formEquipo.potencia,
    detalle: texto(formEquipo.detalle),
  }
  if (!cantidadAutomatica.value) payload.cantidad = formEquipo.cantidad
  try {
    if (equipoEditado.value) {
      await proyectosService.actualizarEquipo(props.proyectoId, equipoEditado.value.id, payload)
      toast.success('Equipo actualizado')
    } else {
      await proyectosService.crearEquipo(props.proyectoId, {
        ...payload,
        tipo: formEquipo.tipo ?? undefined,
      })
      toast.success('Equipo agregado')
    }
    showEquipo.value = false
  } catch (err) {
    toast.error('No se pudo guardar el equipo', { description: normalizeError(err).message })
  } finally {
    guardandoEquipo.value = false
    await cargar()
  }
}

function eliminarEquipo(e: EquipoProyecto) {
  confirm({
    title: `Eliminar ${ETIQUETA_TIPO_EQUIPO[e.tipo]}`,
    description:
      e.tipo === TipoEquipo.INVERSOR
        ? 'Solo se puede eliminar sin inversores cargados. No se puede deshacer.'
        : 'Se borran su cantidad, marca, potencia y detalle. No se puede deshacer.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await proyectosService.eliminarEquipo(props.proyectoId, e.id)
        toast.success('Equipo eliminado')
      } catch (err) {
        toast.error('No se pudo eliminar', { description: normalizeError(err).message })
      } finally {
        await cargar()
      }
    },
  })
}

// ── Inversor: agregar / editar / retirar ──────────────────────────────────────
const showInversor = ref(false)
const guardandoInversor = ref(false)
const inversorEditado = ref<InversorProyecto | null>(null)

function inversorEnBlanco() {
  return {
    nombre: '',
    potencia_nominal_kw: null as number | null,
    cantidad_strings: null as number | null,
  }
}
const formInversor = reactive(inversorEnBlanco())

function abrirAgregarInversor() {
  inversorEditado.value = null
  Object.assign(formInversor, inversorEnBlanco(), {
    nombre: `Inversor ${inversores.value.length + 1}`,
  })
  showInversor.value = true
}

function abrirEditarInversor(i: InversorProyecto) {
  inversorEditado.value = i
  Object.assign(formInversor, {
    nombre: i.nombre ?? '',
    potencia_nominal_kw: i.potencia_nominal_kw != null ? Number(i.potencia_nominal_kw) : null,
    cantidad_strings: i.cantidad_strings ?? null,
  })
  showInversor.value = true
}

async function guardarInversor() {
  guardandoInversor.value = true
  const payload: PayloadInversorProyecto = {
    nombre: formInversor.nombre.trim(),
    potencia_nominal_kw: formInversor.potencia_nominal_kw,
    cantidad_strings: formInversor.cantidad_strings,
  }
  try {
    if (inversorEditado.value) {
      await proyectosService.actualizarInversor(props.proyectoId, inversorEditado.value.id, payload)
      toast.success('Inversor actualizado')
    } else {
      await proyectosService.crearInversor(props.proyectoId, {
        ...payload,
        orden: inversores.value.length + 1,
      })
      toast.success('Inversor agregado')
    }
    showInversor.value = false
  } catch (err) {
    toast.error('No se pudo guardar el inversor', { description: normalizeError(err).message })
  } finally {
    guardandoInversor.value = false
    await cargar()
  }
}

async function cambiarEstado(i: InversorProyecto) {
  const estado =
    i.estado === EstadoInversor.RETIRADO ? EstadoInversor.ACTIVO : EstadoInversor.RETIRADO
  try {
    await proyectosService.actualizarInversor(props.proyectoId, i.id, { estado })
    toast.success(estado === EstadoInversor.RETIRADO ? 'Inversor retirado' : 'Inversor reactivado')
  } catch (err) {
    toast.error('No se pudo cambiar el estado', { description: normalizeError(err).message })
  } finally {
    await cargar()
  }
}

function eliminarInversor(i: InversorProyecto) {
  confirm({
    title: `Eliminar ${i.nombre ?? 'inversor'}`,
    description:
      'Si tiene fallas registradas, mejor retíralo: al eliminarlo sale del historial de esas fallas. No se puede deshacer.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await proyectosService.eliminarInversor(props.proyectoId, i.id)
        toast.success('Inversor eliminado')
      } catch (err) {
        toast.error('No se pudo eliminar', { description: normalizeError(err).message })
      } finally {
        await cargar()
      }
    },
  })
}
</script>

<template>
  <div class="space-y-6">
    <AsyncView :query="query">
      <template #default>
        <!-- Equipos -->
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Equipos</p>
            <Button v-if="tiposLibres.length" size="sm" variant="outline" @click="abrirAgregarEquipo">
              <PlusIcon class="size-4" />
              Agregar equipo
            </Button>
          </div>
          <EmptyState
            v-if="!equipos.length"
            title="Sin equipos"
            description="Esta planta no tiene equipos registrados."
          />
          <GTable v-else>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Equipo</GTableHead>
                <GTableHead class="text-right">Cantidad</GTableHead>
                <GTableHead>Marca</GTableHead>
                <GTableHead class="text-right">Potencia unitaria</GTableHead>
                <GTableHead>Detalle</GTableHead>
                <GTableHead />
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <GTableRow v-for="e in equipos" :key="e.id">
                <GTableCell class="font-medium">{{ ETIQUETA_TIPO_EQUIPO[e.tipo] }}</GTableCell>
                <GTableCell class="text-right tabular-nums">{{ numero(e.cantidad, 0) }}</GTableCell>
                <GTableCell>{{ e.marca || '—' }}</GTableCell>
                <GTableCell class="text-right tabular-nums">{{ numero(e.potencia) }}</GTableCell>
                <GTableCell class="max-w-72 whitespace-pre-line">{{ e.detalle || '—' }}</GTableCell>
                <GTableCell>
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Editar"
                      aria-label="Editar"
                      @click="abrirEditarEquipo(e)"
                    >
                      <PencilIcon class="size-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Eliminar"
                      aria-label="Eliminar"
                      @click="eliminarEquipo(e)"
                    >
                      <Trash2Icon class="size-4 text-destructive" />
                    </Button>
                  </div>
                </GTableCell>
              </GTableRow>
            </GTableBody>
          </GTable>
        </div>

        <!-- Inversores -->
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Inversores</p>
              <p v-if="activos.length" class="text-xs text-muted-foreground">
                {{ activos.length }} activos · {{ numero(potenciaActivos, 1) }} kW en total
              </p>
            </div>
            <Button size="sm" variant="outline" @click="abrirAgregarInversor">
              <PlusIcon class="size-4" />
              Agregar inversor
            </Button>
          </div>
          <EmptyState
            v-if="!inversores.length"
            title="Sin inversores"
            description="Los inversores son los que se eligen al reportar una falla por inversor."
          />
          <GTable v-else>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Nombre</GTableHead>
                <GTableHead class="text-right">Potencia (kW)</GTableHead>
                <GTableHead class="text-right">Strings</GTableHead>
                <GTableHead>Estado</GTableHead>
                <GTableHead />
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <GTableRow
                v-for="i in inversores"
                :key="i.id"
                :class="{ 'text-muted-foreground': i.estado === EstadoInversor.RETIRADO }"
              >
                <GTableCell class="font-medium">{{ i.nombre || '—' }}</GTableCell>
                <GTableCell class="text-right tabular-nums">{{ numero(i.potencia_nominal_kw) }}</GTableCell>
                <GTableCell class="text-right tabular-nums">{{ numero(i.cantidad_strings, 0) }}</GTableCell>
                <GTableCell>
                  <GBadge :color="i.estado === EstadoInversor.RETIRADO ? 'default' : 'success'">
                    {{ i.estado === EstadoInversor.RETIRADO ? 'Retirado' : 'Activo' }}
                  </GBadge>
                </GTableCell>
                <GTableCell>
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Editar"
                      aria-label="Editar"
                      @click="abrirEditarInversor(i)"
                    >
                      <PencilIcon class="size-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      :title="i.estado === EstadoInversor.RETIRADO ? 'Reactivar' : 'Retirar'"
                      :aria-label="i.estado === EstadoInversor.RETIRADO ? 'Reactivar' : 'Retirar'"
                      @click="cambiarEstado(i)"
                    >
                      <RotateCcwIcon v-if="i.estado === EstadoInversor.RETIRADO" class="size-4" />
                      <ArchiveIcon v-else class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Eliminar"
                      aria-label="Eliminar"
                      @click="eliminarInversor(i)"
                    >
                      <Trash2Icon class="size-4 text-destructive" />
                    </Button>
                  </div>
                </GTableCell>
              </GTableRow>
            </GTableBody>
          </GTable>
        </div>
      </template>
    </AsyncView>

    <Dialog v-model:open="showEquipo">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ equipoEditado ? `Editar ${ETIQUETA_TIPO_EQUIPO[equipoEditado.tipo]}` : 'Agregar equipo' }}
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="!equipoEditado" class="space-y-1.5">
            <GLabel required>Tipo</GLabel>
            <Select v-model="formEquipo.tipo">
              <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in tiposLibres" :key="t" :value="t">
                  {{ ETIQUETA_TIPO_EQUIPO[t] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <GLabel>Cantidad</GLabel>
            <NumberField
              v-model="formEquipo.cantidad"
              :step-snapping="false"
              :min="0"
              :disabled="cantidadAutomatica"
              :format-options="{ useGrouping: false }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
            <p v-if="cantidadAutomatica" class="text-xs text-muted-foreground">
              Es la de los inversores activos cargados.
            </p>
          </div>
          <div class="space-y-1.5">
            <GLabel>Marca</GLabel>
            <Input v-model="formEquipo.marca" />
            <p v-if="formEquipo.tipo === TipoEquipo.INVERSOR" class="text-xs text-muted-foreground">
              La de todos los inversores de la planta.
            </p>
          </div>
          <template v-if="formEquipo.tipo !== TipoEquipo.INVERSOR">
            <div class="space-y-1.5">
              <GLabel>Potencia de una unidad</GLabel>
              <NumberField
                v-model="formEquipo.potencia"
                :step-snapping="false"
                :min="0"
                :format-options="{ maximumFractionDigits: 3 }"
              >
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
              <p v-if="formEquipo.tipo === TipoEquipo.PANEL" class="text-xs text-muted-foreground">
                En kWp: un panel de 575 W es 0,575.
              </p>
            </div>
          </template>
          <div class="space-y-1.5">
            <GLabel>Detalle</GLabel>
            <Textarea v-model="formEquipo.detalle" rows="2" />
            <p v-if="formEquipo.tipo && AYUDA_DETALLE_EQUIPO[formEquipo.tipo]" class="text-xs text-muted-foreground">
              {{ AYUDA_DETALLE_EQUIPO[formEquipo.tipo] }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showEquipo = false">Cancelar</Button>
          <Button :disabled="!formEquipo.tipo || guardandoEquipo" @click="guardarEquipo">
            {{ equipoEditado ? 'Guardar' : 'Agregar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showInversor">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ inversorEditado ? 'Editar inversor' : 'Agregar inversor' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <GLabel required>Nombre</GLabel>
            <Input v-model="formInversor.nombre" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Potencia (kW)</GLabel>
            <NumberField
              v-model="formInversor.potencia_nominal_kw"
              :step-snapping="false"
              :min="0"
              :format-options="{ maximumFractionDigits: 3 }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1.5">
            <GLabel>Strings</GLabel>
            <NumberField
              v-model="formInversor.cantidad_strings"
              :step-snapping="false"
              :min="0"
              :format-options="{ useGrouping: false }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showInversor = false">Cancelar</Button>
          <Button :disabled="!formInversor.nombre.trim() || guardandoInversor" @click="guardarInversor">
            {{ inversorEditado ? 'Guardar' : 'Agregar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
