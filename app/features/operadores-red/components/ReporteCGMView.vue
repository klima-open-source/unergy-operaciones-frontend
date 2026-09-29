<script setup lang="ts">
import type { FronteraCgm } from '~/features/operadores-red/types'
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, SendIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'
import { formatearNombre } from '~/utils/nombreFormato'
import HistorialEnviosCGM from './HistorialEnviosCGM.vue'

interface Proyecto {
  id: number | string
  nombre: string
}

interface Destinatario {
  key: string
  refTipo: 'operador' | 'cliente'
  refId: number | null
  tipo: 'Operador de Red' | 'Cliente'
  nombre: string | null
  sinVinculo: string
  correos: string[]
  linkCorregir: string | null
  textoCorregir: string
  proyectos: Proyecto[]
  etiquetaProyectos?: string
}

const reporteCgmService = new ReporteCgmService()

const innerTab = ref('enviar')
const fronterasQuery = useQuery<FronteraCgm[]>()
const enviando = ref(false)
const expanded = ref(new Set<string>())
const filtroTipo = ref<'todos' | 'Operador de Red' | 'Cliente'>('todos')
const busqueda = ref('')

const ayer = new Date(Date.now() - 86400000)
function isoDe(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fechaDesde = ref<string | null>(isoDe(ayer))
const fechaHasta = ref<string | null>(isoDe(ayer))

const tipoOpciones = [
  { value: 'todos', label: 'Todos' },
  { value: 'Operador de Red', label: 'Operador de Red' },
  { value: 'Cliente', label: 'Cliente' },
] as const

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

// Una fila por destinatario único (no por proyecto): agrupa generación+consumo
// de la misma planta y, si un mismo operador/cliente cubre varios proyectos,
// los junta en una sola fila con el detalle expandible.
const destinatarios = computed<Destinatario[]>(() => {
  const fronteras = fronterasQuery.data ?? []
  const proyectos = new Map<number | string, FronteraCgm>()
  for (const f of fronteras) {
    const key = f.proyecto_id ?? `frontera-${f.id}`
    if (!proyectos.has(key)) proyectos.set(key, f)
  }

  const grupos = new Map<string, Destinatario>()
  function addEntry(
    refTipo: Destinatario['refTipo'],
    refId: number | null | undefined,
    tipo: Destinatario['tipo'],
    nombre: string | null | undefined,
    sinVinculo: string,
    correos: string[] | undefined,
    linkCorregir: string | null,
    textoCorregir: string,
    proyecto: Proyecto,
  ) {
    const key = `${tipo}-${refId ?? 'sin-vinculo'}`
    let grupo = grupos.get(key)
    if (!grupo) {
      grupo = {
        key,
        refTipo,
        refId: refId ?? null,
        tipo,
        nombre: nombre ?? null,
        sinVinculo,
        correos: correos ?? [],
        linkCorregir,
        textoCorregir,
        proyectos: [],
      }
      grupos.set(key, grupo)
    }
    grupo.proyectos.push(proyecto)
  }

  for (const [proyectoId, f] of proyectos) {
    const proyecto: Proyecto = {
      id: proyectoId,
      nombre: f.proyecto_nombre || 'Proyecto sin nombre',
    }

    addEntry(
      'operador',
      f.operador_red_id,
      'Operador de Red',
      f.operador_comercial,
      'Sin operador vinculado',
      f.operador_correos,
      f.operador_red_id ? `/mem/operadores-red/${f.operador_red_id}` : null,
      'Sin correos — corregir',
      proyecto,
    )

    // Un proyecto puede tener varios inversionistas — cada uno es su propio
    // destinatario "Cliente", con solo sus propios correos CGM (no la unión).
    if (f.clientes_cgm?.length) {
      for (const c of f.clientes_cgm) {
        addEntry(
          'cliente',
          c.id,
          'Cliente',
          c.nombre,
          'Sin cliente vinculado',
          c.correos,
          `/clientes/${c.id}?tab=contactos`,
          'Sin correos CGM — corregir',
          proyecto,
        )
      }
    } else {
      addEntry(
        'cliente',
        null,
        'Cliente',
        null,
        'Sin inversionistas registrados',
        [],
        null,
        'Sin inversionistas — corregir',
        proyecto,
      )
    }
  }

  // 'Operaciones Unergy' (cliente id=157) es un caso especial del backend
  // (CLIENTES_TODAS_LAS_FRONTERAS en reporte_cgm.py): en vez de resolver sus
  // fronteras por vínculo real (como cualquier otro Cliente), recibe TODAS
  // las fronteras del sistema — a propósito no está vinculado a ninguna, así
  // que nunca aparecería en la construcción de arriba (que solo mira
  // clientes_cgm de cada frontera). Se agrega acá como fila fija; el correo
  // (operaciones@unergy.io) coincide con el contacto CGM ya creado para este
  // cliente en la BD — si cambia, hay que actualizarlo en los dos lados.
  const filas = [...grupos.values()]
  filas.push({
    key: 'cliente-157',
    refTipo: 'cliente',
    refId: 157,
    tipo: 'Cliente',
    nombre: 'Operaciones Unergy',
    sinVinculo: '',
    correos: ['operaciones@unergy.io'],
    linkCorregir: '/clientes/157?tab=contactos',
    textoCorregir: 'Sin correos CGM — corregir',
    proyectos: [],
    etiquetaProyectos: 'Todas las fronteras',
  })

  return filas.sort((a, b) => (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz'))
})

const destinatariosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return destinatarios.value.filter((row) => {
    if (filtroTipo.value !== 'todos' && row.tipo !== filtroTipo.value) return false
    if (texto && !(row.nombre || '').toLowerCase().includes(texto)) return false
    return true
  })
})

// Selección de a quién enviarle (checkbox por fila). Por defecto se marcan
// todos los que ya tienen correos cargados — los que no tienen, no se pueden
// seleccionar (no hay a dónde enviar).
const seleccionados = ref(new Set<string>())

watch(
  destinatarios,
  (rows) => {
    const next = new Set(seleccionados.value)
    for (const r of rows) {
      if (r.correos.length && !next.has(r.key)) next.add(r.key)
    }
    seleccionados.value = next
  },
  { immediate: true },
)

function toggleSeleccion(key: string) {
  const next = new Set(seleccionados.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  seleccionados.value = next
}

const seleccionablesFiltrados = computed(() =>
  destinatariosFiltrados.value.filter((r) => r.correos.length),
)
const todosSeleccionados = computed(
  () =>
    seleccionablesFiltrados.value.length > 0 &&
    seleccionablesFiltrados.value.every((r) => seleccionados.value.has(r.key)),
)
const totalSeleccionados = computed(
  () => destinatarios.value.filter((r) => seleccionados.value.has(r.key)).length,
)

function toggleTodos() {
  const next = new Set(seleccionados.value)
  if (todosSeleccionados.value) {
    for (const r of seleccionablesFiltrados.value) next.delete(r.key)
  } else {
    for (const r of seleccionablesFiltrados.value) next.add(r.key)
  }
  seleccionados.value = next
}

// Selección de proyectos DENTRO de un destinatario (independiente de a quién
// se le va a enviar). Vacío = "sin filtro", se manda todo lo del destinatario
// — así no hay que deseleccionar uno por uno cuando son decenas de proyectos,
// solo se marcan los pocos que sí se quieren mandar.
const proyectosSeleccionados = ref(new Map<string, Set<Proyecto['id']>>())

function proyectosDeFila(rowKey: string) {
  return proyectosSeleccionados.value.get(rowKey) ?? new Set<Proyecto['id']>()
}

function toggleProyecto(rowKey: string, proyectoId: Proyecto['id']) {
  const set = new Set(proyectosDeFila(rowKey))
  if (set.has(proyectoId)) set.delete(proyectoId)
  else set.add(proyectoId)
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, set)
  proyectosSeleccionados.value = next
}

function limpiarProyectos(rowKey: string) {
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, new Set())
  proyectosSeleccionados.value = next
}

function labelProyectos(row: Destinatario) {
  if (row.etiquetaProyectos) return row.etiquetaProyectos
  const total = row.proyectos.length
  const numSeleccionados = proyectosDeFila(row.key).size
  if (!numSeleccionados) return `${total} proyecto${total === 1 ? '' : 's'}`
  return `${numSeleccionados} de ${total} seleccionados`
}

async function enviarSeleccionados() {
  const filas = destinatarios.value.filter((r) => seleccionados.value.has(r.key) && r.refId != null)
  if (!filas.length) return

  enviando.value = true
  try {
    const respuesta = await reporteCgmService.enviar({
      fecha_inicio: fechaDesde.value ?? isoDe(ayer),
      fecha_fin: fechaHasta.value ?? fechaDesde.value ?? isoDe(ayer),
      destinatarios: filas.map((r) => {
        const proyectos = proyectosDeFila(r.key)
        return {
          tipo: r.refTipo,
          id: r.refId as number,
          proyectos: proyectos.size ? [...proyectos].map(Number) : null,
        }
      }),
    })
    const ok = respuesta.resultados.filter((r) => r.ok)
    const conError = respuesta.resultados.filter((r) => !r.ok)
    const resumen = `${ok.length} enviado${ok.length === 1 ? '' : 's'}${conError.length ? `, ${conError.length} con error` : ''}`
    if (conError.length) {
      toast.warning(resumen, {
        description: conError.map((r) => `${r.nombre}: ${r.error}`).join(' · '),
      })
    } else {
      toast.success(resumen)
    }
  } catch (err) {
    toast.error('Error al enviar', { description: normalizeError(err).message })
  } finally {
    enviando.value = false
  }
}

async function loadData() {
  try {
    await fronterasQuery.run(() => reporteCgmService.listarFronteras())
  } catch (err) {
    logger.error('operadores-red.reporte-cgm', err)
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-4">
    <GTabs v-model="innerTab">
      <GTabsList>
        <GTabsTrigger value="enviar">Enviar</GTabsTrigger>
        <GTabsTrigger value="historial">Historial</GTabsTrigger>
      </GTabsList>

      <GTabsContent value="historial">
        <HistorialEnviosCGM />
      </GTabsContent>

      <GTabsContent value="enviar" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="min-w-50 flex-1 text-xs text-muted-foreground">
            Destinatarios del reporte CGM (operador de red + cliente). Por defecto a cada uno le
            llega el Excel de todas sus fronteras — despliega "Proyectos" para elegir solo uno o
            algunos en particular.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-1.5">
              <GLabel>Desde</GLabel>
              <DatePicker v-model="fechaDesde" />
            </div>
            <div class="flex items-center gap-1.5">
              <GLabel>Hasta</GLabel>
              <DatePicker v-model="fechaHasta" />
            </div>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button :disabled="!totalSeleccionados || enviando" @click="enviarSeleccionados">
                  <SendIcon class="size-4" />
                  {{ enviando ? 'Enviando…' : `Enviar a ${totalSeleccionados}` }}
                </Button>
              </GTooltipTrigger>
              <GTooltipContent v-if="!totalSeleccionados"
                >Selecciona al menos un destinatario</GTooltipContent
              >
            </GTooltip>
          </div>
        </div>

        <AsyncView :query="fronterasQuery">
          <template #default>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <ToggleGroup v-model="filtroTipo" type="single" variant="outline">
                  <ToggleGroupItem v-for="opt in tipoOpciones" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </ToggleGroupItem>
                </ToggleGroup>
                <InputGroup class="max-w-60">
                  <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
                  <InputGroupInput v-model="busqueda" placeholder="Buscar destinatario…" />
                </InputGroup>
              </div>

              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Destinatario</GTableHead>
                    <GTableHead>Tipo</GTableHead>
                    <GTableHead>Correos</GTableHead>
                    <GTableHead>Proyectos</GTableHead>
                    <GTableHead>
                      <label class="flex cursor-pointer items-center gap-1.5 select-none">
                        <Checkbox
                          :model-value="todosSeleccionados"
                          @update:model-value="toggleTodos"
                        />
                        Enviar
                      </label>
                    </GTableHead>
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <template v-for="row in destinatariosFiltrados" :key="row.key">
                    <GTableRow>
                      <GTableCell>
                        <p v-if="row.nombre" class="font-medium">
                          {{ formatearNombre(row.nombre) }}
                        </p>
                        <p v-else class="text-xs text-muted-foreground italic">
                          {{ row.sinVinculo }}
                        </p>
                      </GTableCell>
                      <GTableCell>
                        <GBadge :color="row.tipo === 'Operador de Red' ? 'action' : 'success'">
                          {{ row.tipo }}
                        </GBadge>
                      </GTableCell>
                      <GTableCell>
                        <NuxtLink
                          v-if="row.linkCorregir && row.correos.length"
                          :to="row.linkCorregir"
                          class="font-medium text-primary underline"
                        >
                          {{ row.correos.length }} correo{{ row.correos.length > 1 ? 's' : '' }}
                        </NuxtLink>
                        <NuxtLink
                          v-else-if="row.linkCorregir"
                          :to="row.linkCorregir"
                          class="text-xs font-medium text-destructive underline"
                        >
                          {{ row.textoCorregir }}
                        </NuxtLink>
                        <span v-else class="text-xs text-muted-foreground italic">—</span>
                      </GTableCell>
                      <GTableCell>
                        <button
                          type="button"
                          class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                          @click="toggle(row.key)"
                        >
                          <ChevronDownIcon v-if="expanded.has(row.key)" class="size-3" />
                          <ChevronRightIcon v-else class="size-3" />
                          {{ labelProyectos(row) }}
                        </button>
                      </GTableCell>
                      <GTableCell>
                        <GTooltip>
                          <GTooltipTrigger as-child>
                            <Checkbox
                              :model-value="seleccionados.has(row.key)"
                              :disabled="!row.correos.length"
                              @update:model-value="toggleSeleccion(row.key)"
                            />
                          </GTooltipTrigger>
                          <GTooltipContent v-if="!row.correos.length">
                            Sin correos, no se puede enviar
                          </GTooltipContent>
                        </GTooltip>
                      </GTableCell>
                    </GTableRow>
                    <GTableRow v-if="expanded.has(row.key)" class="bg-muted/30">
                      <GTableCell colspan="5">
                        <div
                          v-if="proyectosDeFila(row.key).size"
                          class="mb-2 flex items-center justify-end gap-3"
                        >
                          <button
                            type="button"
                            class="text-xs font-semibold text-primary underline"
                            @click="limpiarProyectos(row.key)"
                          >
                            Quitar selección (volver a todos)
                          </button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <Button
                            v-for="p in row.proyectos"
                            :key="p.id"
                            size="sm"
                            :variant="proyectosDeFila(row.key).has(p.id) ? 'default' : 'outline'"
                            @click="toggleProyecto(row.key, p.id)"
                          >
                            {{ formatearNombre(p.nombre) }}
                          </Button>
                        </div>
                      </GTableCell>
                    </GTableRow>
                  </template>
                  <GTableRow v-if="!destinatariosFiltrados.length">
                    <GTableCell
                      colspan="5"
                      class="py-8 text-center text-xs text-muted-foreground italic"
                    >
                      Ningún destinatario coincide con el filtro.
                    </GTableCell>
                  </GTableRow>
                </GTableBody>
              </GTable>
            </div>
          </template>
        </AsyncView>
      </GTabsContent>
    </GTabs>
  </div>
</template>
