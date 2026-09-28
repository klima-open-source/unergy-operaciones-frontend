<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Informes" subtitle="Informes operacionales y FMO · equipo Unergy">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="query.isLoading" @click="cargar">
          <LoaderCircleIcon v-if="query.isLoading" class="animate-spin" />
          <RefreshCwIcon v-else />
          Actualizar
        </Button>
      </template>
    </PageHeader>

    <!-- ══ KPIs ══ -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        size="sm"
        class="cursor-pointer border-t-2 transition-colors"
        :class="filtroEstado === null ? 'border-t-primary bg-primary/5' : 'border-t-transparent'"
        @click="setFiltroEstado(null)"
      >
        <CardContent class="items-center text-center">
          <p class="text-2xl font-extrabold text-primary">{{ todos.length }}</p>
          <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total</p>
        </CardContent>
      </Card>
      <Card
        v-for="estado in ESTADOS"
        :key="estado"
        size="sm"
        class="cursor-pointer border-t-2 transition-colors"
        :class="filtroEstado === estado ? 'border-t-primary bg-primary/5' : 'border-t-transparent'"
        @click="setFiltroEstado(estado)"
      >
        <CardContent class="items-center text-center">
          <p class="text-2xl font-extrabold text-foreground">{{ kpis[estado] }}</p>
          <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {{ ESTADO_LABELS[estado] }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- ══ Filtros ══ -->
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <Label class="text-xs text-muted-foreground">Año</Label>
        <Select v-model="filtroAnio">
          <SelectTrigger size="sm" class="w-28">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="anio in aniosDisponibles" :key="anio" :value="anio">{{
              anio
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs text-muted-foreground">Mes</Label>
        <Select v-model="filtroMes">
          <SelectTrigger size="sm" class="w-36">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="mes in MESES" :key="mes.value" :value="mes.value">{{
              mes.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs text-muted-foreground">Estado</Label>
        <Select v-model="filtroEstado">
          <SelectTrigger size="sm" class="w-36">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="estado in ESTADOS" :key="estado" :value="estado">{{
              ESTADO_LABELS[estado]
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button v-if="hayFiltros" variant="ghost" size="sm" @click="limpiarFiltros">
        <XIcon /> Limpiar filtros
      </Button>

      <span v-if="!query.isLoading" class="ml-auto text-xs text-muted-foreground">
        {{ informesFiltrados.length }} resultado{{ informesFiltrados.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <AsyncView :query="query">
      <template #empty>
        <div class="flex flex-col items-center gap-1 py-16 text-center">
          <FileIcon class="size-8 text-muted-foreground/50" />
          <p class="text-sm font-medium text-foreground">No hay informes guardados</p>
          <p class="text-xs text-muted-foreground">Genera un informe desde Monitoreo Fallas</p>
        </div>
      </template>

      <template #default>
        <DataTable
          v-if="informesFiltrados.length"
          :columns="columns"
          :rows="informesFiltrados"
          row-key="id"
          @row-click="(row) => abrirInforme(asInforme(row).id)"
        >
          <template #cell="{ row, column }">
            <GBadge v-if="column.key === 'estado'" :color="estadoColor(asInforme(row).estado)">
              {{ estadoLabel(asInforme(row).estado) }}
            </GBadge>
            <div v-else-if="column.key === 'proyecto'">
              <div class="font-semibold text-foreground">
                {{ asInforme(row).proyecto_nombre || asInforme(row).sub_project }}
              </div>
              <div
                v-if="
                  asInforme(row).proyecto_nombre &&
                  asInforme(row).sub_project !== asInforme(row).proyecto_nombre
                "
                class="text-xs text-muted-foreground"
              >
                {{ asInforme(row).sub_project }}
              </div>
            </div>
            <GBadge v-else-if="column.key === 'tipo'" variant="outline">{{
              tipoLabel(asInforme(row).tipo)
            }}</GBadge>
            <span v-else-if="column.key === 'periodo'" class="whitespace-nowrap">
              {{ asInforme(row).periodo_display || formatPeriodo(asInforme(row).periodo_desde) }}
              <MailIcon
                v-if="asInforme(row).correo_enviado"
                class="inline size-3.5 text-muted-foreground"
                title="Correo enviado"
              />
            </span>
            <div v-else-if="column.key === 'edicion'">
              <div>
                {{ asInforme(row).editado_en ? formatFecha(asInforme(row).editado_en!) : '—' }}
              </div>
              <div v-if="asInforme(row).editado_por_nombre" class="text-xs text-muted-foreground">
                {{ asInforme(row).editado_por_nombre }}
              </div>
            </div>
            <span v-else-if="column.key === 'aprobado'" class="text-muted-foreground">
              {{ asInforme(row).aprobado_por_nombre || '—' }}
            </span>
            <div v-else-if="column.key === 'acciones'" class="flex items-center gap-1" @click.stop>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Abrir informe"
                @click="abrirInforme(asInforme(row).id)"
              >
                <ArrowRightIcon class="size-4" />
              </Button>
              <Button
                v-if="asInforme(row).estado !== 'aprobado'"
                variant="ghost"
                size="icon-sm"
                class="hover:bg-destructive/10 hover:text-destructive"
                :title="`Eliminar ${asInforme(row).proyecto_nombre || asInforme(row).sub_project}`"
                @click="confirmarEliminar(asInforme(row))"
              >
                <Trash2Icon class="size-4" />
              </Button>
            </div>
          </template>
        </DataTable>
        <div v-else class="flex flex-col items-center gap-1 py-16 text-center">
          <FileIcon class="size-8 text-muted-foreground/50" />
          <p class="text-sm font-medium text-foreground">
            {{
              hayFiltros ? 'Sin resultados para los filtros aplicados' : 'No hay informes guardados'
            }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{
              hayFiltros ? 'Prueba con otros filtros' : 'Genera un informe desde Monitoreo Fallas'
            }}
          </p>
          <Button v-if="hayFiltros" variant="ghost" size="sm" class="mt-2" @click="limpiarFiltros">
            <XIcon /> Limpiar filtros
          </Button>
        </div>
      </template>
    </AsyncView>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRightIcon,
  FileIcon,
  LoaderCircleIcon,
  MailIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable, {
  type DataTableRow,
  type DataTableColumn,
} from '~/components/blocks/DataTable.vue'
import { normalizeError } from '~/core/errors'
import type { EstadoInforme, Informe, TipoInforme } from '~/features/operaciones/types'
import { InformesService } from '~/features/operaciones/services/informes'

const columns: DataTableColumn[] = [
  { key: 'estado', header: 'Estado' },
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'tipo', header: 'Tipo' },
  { key: 'periodo', header: 'Periodo' },
  { key: 'edicion', header: 'Última edición' },
  { key: 'aprobado', header: 'Aprobado por' },
  { key: 'acciones', header: '' },
]

const ESTADOS = ['borrador', 'revisado', 'aprobado'] as const
const ESTADO_LABELS: Record<(typeof ESTADOS)[number], string> = {
  borrador: 'Borrador',
  revisado: 'Revisado',
  aprobado: 'Aprobado',
}
const TIPO_LABELS: Record<string, string> = { op: 'Operacional', fmo: 'FMO', port: 'Portafolio' }
const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
] as const
const NOMBRES_MES = [
  '',
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

const informesService = new InformesService()
const confirm = useConfirm()
const router = useRouter()

const query = useQuery<Informe[]>()
const filtroEstado = ref<EstadoInforme | null>(null)
const filtroAnio = ref<string | null>(null)
const filtroMes = ref<string | null>(null)

function asInforme(row: DataTableRow): Informe {
  return row as unknown as Informe
}

const todos = computed(() => query.data ?? [])

const kpis = computed(() => {
  const conteo: Record<string, number> = { borrador: 0, revisado: 0, aprobado: 0 }
  for (const inf of todos.value) {
    if (inf.estado && inf.estado in conteo) conteo[inf.estado]!++
  }
  return conteo as Record<(typeof ESTADOS)[number], number>
})

const aniosDisponibles = computed(() => {
  const set = new Set<string>()
  todos.value.forEach((i) => {
    if (i.periodo_desde) set.add(i.periodo_desde.slice(0, 4))
  })
  return [...set].sort((a, b) => Number(b) - Number(a))
})

const informesFiltrados = computed(() =>
  todos.value.filter((i) => {
    if (filtroEstado.value && i.estado !== filtroEstado.value) return false
    if (filtroAnio.value && (!i.periodo_desde || !i.periodo_desde.startsWith(filtroAnio.value)))
      return false
    if (filtroMes.value && (!i.periodo_desde || i.periodo_desde.slice(5, 7) !== filtroMes.value))
      return false
    return true
  }),
)

function setFiltroEstado(estado: EstadoInforme | null) {
  // Toggle: si ya está activo, lo quita.
  filtroEstado.value = filtroEstado.value === estado ? null : estado
}

async function cargar() {
  await query.run(() => informesService.listar({ limit: 200 }))
}
onMounted(cargar)

const hayFiltros = computed(() => !!(filtroAnio.value || filtroMes.value || filtroEstado.value))
function limpiarFiltros() {
  filtroEstado.value = null
  filtroAnio.value = null
  filtroMes.value = null
}

function abrirInforme(id: number) {
  router.push(`/informes/${id}`)
}

function confirmarEliminar(inf: Informe) {
  const nombre = inf.proyecto_nombre || inf.sub_project
  const periodo = inf.periodo_display || inf.periodo_desde || ''
  confirm({
    title: 'Eliminar informe',
    description: `¿Eliminar el informe "${nombre} · ${periodo}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminarInforme(inf),
  })
}

async function eliminarInforme(inf: Informe) {
  try {
    await informesService.eliminar(inf.id)
    if (query.data) query.data = query.data.filter((i) => i.id !== inf.id)
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  }
}

function estadoColor(estado?: EstadoInforme) {
  return estado === 'aprobado' ? 'success' : estado === 'revisado' ? 'information' : 'warning'
}
function estadoLabel(estado?: EstadoInforme) {
  return (estado && ESTADO_LABELS[estado as (typeof ESTADOS)[number]]) || estado || '—'
}
function tipoLabel(tipo: TipoInforme) {
  return TIPO_LABELS[tipo] || (tipo || '—').toUpperCase()
}
function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
function formatPeriodo(iso?: string) {
  if (!iso) return '—'
  const [anio, mes] = iso.split('-')
  return `${NOMBRES_MES[Number(mes)] || mes} ${anio}`
}
</script>
