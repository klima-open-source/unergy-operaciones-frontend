<script setup lang="ts">
import {
  ArrowUpRightIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  MinusIcon,
  SearchIcon,
  WalletIcon,
  ZapIcon,
} from '@lucide/vue'
import type { ProyectoResumenPanel } from '~/features/liquidaciones/types'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import {
  borrarClave,
  fmtCompact,
  formatPeriodo,
} from '~/features/liquidaciones/utils/liquidaciones'
import NetoMensualBar from './components/NetoMensualBar.vue'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    /** "YYYY-MM-01". */
    periodo?: string | null
    tipo?: string
  }>(),
  { embedded: false, periodo: null, tipo: 'preliquidacion' },
)

const router = useRouter()
const liquidacionesService = new LiquidacionesService()

const periodoYYYYMM = computed(() => (props.periodo || '').slice(0, 7))
const ventana = computed(() => {
  const [y, m] = (props.periodo || '').split('-').map(Number)
  const ini = new Date(y!, (m ?? 1) - 12, 1)
  return {
    desde: `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`,
    hasta: periodoYYYYMM.value,
  }
})

const loading = ref(false)
interface PeriodoEntry {
  periodo: string
  proyectos: ProyectoResumenPanel[]
}
const periodosData = ref<PeriodoEntry[]>([])

const TABS_TIPO = [
  { key: 'todas', label: 'Todas' },
  { key: 'minigranja', label: 'Minigranjas' },
  { key: 'autoconsumo', label: 'Autoconsumo' },
] as const
type TabTipo = (typeof TABS_TIPO)[number]['key']
const tabTipo = ref<TabTipo>('todas')
const q = ref('')

const expandidos = reactive<Record<string, boolean>>({})
const tablasAbiertas = reactive<Record<string, boolean>>({})
function toggleCliente(k: string) {
  if (expandidos[k]) borrarClave(expandidos, k)
  else expandidos[k] = true
}
function toggleTabla(k: string) {
  if (tablasAbiertas[k]) borrarClave(tablasAbiertas, k)
  else tablasAbiertas[k] = true
}

interface ClienteAgregado {
  key: string
  cliente_id?: number | null
  cliente_nombre: string
  proyectos: string[]
  kpis: {
    ingresoBruto: number
    comercializacion: number
    costosOperativos: number
    serviciosUnergy: number
    ingresoNeto: number
  }
  meses: string[]
  barData: { mes: string; neto: number }[]
  tablaRows: {
    nombre: string
    liquidacion_id: number | null
    meses: (number | null)[]
    total: number
  }[]
  totalRow: { meses: number[]; total: number }
}

// Pivota el Panel (rango) por cliente, con series multi-mes.
const clientes = computed<ClienteAgregado[]>(() => {
  interface Acum {
    key: string
    cliente_id?: number | null
    cliente_nombre: string
    _proy: Record<
      string,
      {
        proyecto_id: number
        liquidacion_id: number | null
        porcentaje?: number | null
        meses: Record<string, number>
      }
    >
    _monthKPI: Record<
      string,
      { bruto: number; comercializacion: number; costos: number; facturas: number }
    >
    _mesSet: Set<string>
  }
  const map: Record<string, Acum> = {}
  for (const entry of periodosData.value) {
    const mes = entry.periodo
    for (const proy of entry.proyectos || []) {
      if (tabTipo.value !== 'todas' && proy.tipo_proyecto !== tabTipo.value) continue
      for (const inv of proy.inversionistas || []) {
        const key =
          inv.cliente_id != null ? `c${inv.cliente_id}` : `n${inv.cliente_nombre || inv.nombre}`
        if (!map[key]) {
          map[key] = {
            key,
            cliente_id: inv.cliente_id,
            cliente_nombre: inv.cliente_nombre || inv.nombre || '—',
            _proy: {},
            _monthKPI: {},
            _mesSet: new Set(),
          }
        }
        const c = map[key]
        c._mesSet.add(mes)
        const g = inv.grupos_totales || {}
        if (!c._monthKPI[mes])
          c._monthKPI[mes] = { bruto: 0, comercializacion: 0, costos: 0, facturas: 0 }
        c._monthKPI[mes]!.bruto += g.ingresos || 0
        c._monthKPI[mes]!.comercializacion += g.comercializacion || 0
        c._monthKPI[mes]!.costos += g.costos || 0
        c._monthKPI[mes]!.facturas += g.facturas || 0

        const nom = proy.proyecto || ''
        if (!c._proy[nom])
          c._proy[nom] = {
            proyecto_id: proy.proyecto_id,
            liquidacion_id: proy.liquidacion_id ?? null,
            porcentaje: inv.porcentaje,
            meses: {},
          }
        if (proy.liquidacion_id) c._proy[nom]!.liquidacion_id = proy.liquidacion_id
        c._proy[nom]!.meses[mes] = (c._proy[nom]!.meses[mes] || 0) + (inv.valor_a_pagar || 0)
      }
    }
  }

  return Object.values(map)
    .map((c): ClienteAgregado => {
      const meses = [...c._mesSet].sort()
      const proyNames = Object.keys(c._proy)

      let ingresoBruto = 0
      let comercializacion = 0
      let costosOperativos = 0
      let serviciosUnergy = 0
      for (const k of Object.values(c._monthKPI)) {
        ingresoBruto += k.bruto
        comercializacion += k.comercializacion
        costosOperativos += k.costos
        serviciosUnergy += k.facturas
      }
      const barData = meses.map((mes) => {
        let neto = 0
        for (const nom of proyNames) neto += c._proy[nom]!.meses[mes] || 0
        return { mes, neto }
      })
      const ingresoNeto = barData.reduce((s, b) => s + b.neto, 0)

      const tablaRows = proyNames
        .map((nom) => ({
          nombre: nom,
          liquidacion_id: c._proy[nom]!.liquidacion_id,
          meses: meses.map((m) => c._proy[nom]!.meses[m] ?? null),
          total: meses.reduce((a, m) => a + (c._proy[nom]!.meses[m] || 0), 0),
        }))
        .sort((a, b) => b.total - a.total)
      const totalRow = {
        meses: meses.map((m) => proyNames.reduce((a, nom) => a + (c._proy[nom]!.meses[m] || 0), 0)),
        total: tablaRows.reduce((s, r) => s + r.total, 0),
      }

      return {
        key: c.key,
        cliente_id: c.cliente_id,
        cliente_nombre: c.cliente_nombre,
        proyectos: proyNames,
        kpis: { ingresoBruto, comercializacion, costosOperativos, serviciosUnergy, ingresoNeto },
        meses,
        barData,
        tablaRows,
        totalRow,
      }
    })
    .sort((a, b) => b.kpis.ingresoNeto - a.kpis.ingresoNeto)
})

const clientesMostrados = computed(() => {
  const term = q.value.toLowerCase().trim()
  if (!term) return clientes.value
  return clientes.value.filter((c) => (c.cliente_nombre || '').toLowerCase().includes(term))
})

function kpiCards(cli: ClienteAgregado) {
  const k = cli.kpis
  return [
    {
      label: 'Ingreso Bruto',
      value: k.ingresoBruto,
      icon: ArrowUpRightIcon,
      color: 'text-foreground',
    },
    {
      label: 'Comercialización',
      value: k.comercializacion,
      icon: ChartColumnIcon,
      color: 'text-destructive',
    },
    {
      label: 'Costos Operativos',
      value: k.costosOperativos,
      icon: MinusIcon,
      color: 'text-destructive',
    },
    {
      label: 'Servicios Unergy',
      value: k.serviciosUnergy,
      icon: ZapIcon,
      color: 'text-foreground',
    },
    {
      label: 'Valor a pagar',
      value: k.ingresoNeto,
      icon: WalletIcon,
      color: k.ingresoNeto >= 0 ? 'text-primary' : 'text-destructive',
    },
  ]
}

function shortMes(ym: string): string {
  const [y, m] = ym.split('-')
  const M = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${M[parseInt(m ?? '', 10) - 1]} ${y!.slice(2)}`
}

async function load() {
  if (!periodoYYYYMM.value) return
  loading.value = true
  try {
    const data = await liquidacionesService.obtenerResumenPanelRango({
      periodo_desde: ventana.value.desde,
      periodo_hasta: ventana.value.hasta,
      tipo: props.tipo ?? 'preliquidacion',
    })
    periodosData.value = data.periodos || []
  } catch {
    periodosData.value = []
  } finally {
    loading.value = false
  }
}

watch([() => props.periodo, () => props.tipo], load)
onMounted(load)
</script>

<template>
  <div class="space-y-4" :class="{ 'p-4 sm:p-5': embedded }">
    <PageHeader v-if="!embedded" title="Liquidaciones por Inversionista" />

    <!-- Tabs tipo proyecto + aviso de espejo -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex gap-0 border-b">
        <button
          v-for="t in TABS_TIPO"
          :key="t.key"
          class="relative px-4 py-2 text-xs font-medium transition-colors"
          :class="
            tabTipo === t.key
              ? 'text-foreground after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="tabTipo = t.key"
        >
          {{ t.label }}
        </button>
      </div>
      <InputGroup class="ml-2 max-w-xs min-w-48 flex-1">
        <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
        <InputGroupInput v-model="q" placeholder="Buscar inversionista…" />
      </InputGroup>
      <span class="ml-auto text-xs text-muted-foreground">
        Espejo del Panel Contable · ventana 12 meses a {{ formatPeriodo(periodo) }}
      </span>
    </div>

    <Spinner v-if="loading" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <div
      v-else-if="!clientesMostrados.length"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      {{
        clientes.length
          ? 'Sin inversionistas para la búsqueda.'
          : 'Sin paneles para este período/tipo. Cárgalos en Panel Contable.'
      }}
    </div>

    <div v-else class="overflow-hidden rounded-xl bg-muted/20 shadow-sm">
      <div v-for="cli in clientesMostrados" :key="cli.key">
        <!-- Nivel 1: Inversionista -->
        <div
          class="flex cursor-pointer items-center gap-2 bg-muted/40 px-4 py-2.5 transition-colors select-none hover:bg-muted/60"
          @click="toggleCliente(cli.key)"
        >
          <ChevronDownIcon
            v-if="expandidos[cli.key]"
            class="size-2.5 shrink-0 text-muted-foreground"
          />
          <ChevronRightIcon v-else class="size-2.5 shrink-0 text-muted-foreground" />
          <span class="flex-1 text-sm font-bold tracking-wide text-foreground uppercase">
            {{ cli.cliente_nombre }}
          </span>
          <span
            class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
          >
            {{ cli.proyectos.length }} proyectos
          </span>
          <span class="ml-2 font-mono text-xs font-bold text-primary">
            {{ fmtCompact(cli.kpis.ingresoNeto) }}
          </span>
        </div>

        <template v-if="expandidos[cli.key]">
          <div class="mx-3 my-2 rounded-xl bg-card p-4 shadow-sm">
            <!-- KPI cards -->
            <div class="mb-5 flex flex-wrap gap-3">
              <div
                v-for="k in kpiCards(cli)"
                :key="k.label"
                class="min-w-35 flex-1 rounded-xl border p-4 shadow-sm"
              >
                <div class="mb-2 flex items-start justify-between">
                  <span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{
                    k.label
                  }}</span>
                  <component :is="k.icon" class="size-3.5 text-muted-foreground/50" />
                </div>
                <div class="text-xl font-bold" :class="k.color">
                  {{ fmtCompact(k.value) }}
                </div>
              </div>
            </div>

            <!-- Gráfico: valor a pagar por mes -->
            <div v-if="cli.barData.length" class="mb-4">
              <div class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Valor a pagar por mes
              </div>
              <NetoMensualBar
                :bars="cli.barData.map((b) => ({ label: shortMes(b.mes), neto: b.neto }))"
              />
            </div>

            <!-- Tabla colapsable por proyecto × mes -->
            <div>
              <button
                class="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                @click="toggleTabla(cli.key)"
              >
                <ChevronDownIcon v-if="tablasAbiertas[cli.key]" class="size-2" />
                <ChevronRightIcon v-else class="size-2" />
                Detalle por proyecto
              </button>
              <div v-show="tablasAbiertas[cli.key]" class="overflow-x-auto">
                <table class="w-full min-w-max text-xs">
                  <thead>
                    <tr class="bg-muted/30">
                      <th
                        class="sticky left-0 border-r bg-muted/40 px-2 py-1.5 text-left font-medium text-muted-foreground"
                      >
                        Proyecto
                      </th>
                      <th
                        v-for="mes in cli.meses"
                        :key="mes"
                        class="px-2 py-1.5 text-right font-normal whitespace-nowrap text-muted-foreground"
                      >
                        {{ shortMes(mes) }}
                      </th>
                      <th
                        class="border-l px-2 py-1.5 text-right font-semibold whitespace-nowrap text-foreground"
                      >
                        Total
                      </th>
                      <th class="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in cli.tablaRows"
                      :key="row.nombre"
                      class="border-b hover:bg-muted/20"
                    >
                      <td
                        class="sticky left-0 max-w-40 border-r bg-card px-2 py-1.5 whitespace-nowrap text-foreground"
                      >
                        <TruncatedText :text="row.nombre" />
                      </td>
                      <td
                        v-for="(val, mi) in row.meses"
                        :key="mi"
                        class="px-2 py-1.5 text-right font-mono whitespace-nowrap"
                        :class="val ? 'text-foreground' : 'text-muted-foreground/40'"
                      >
                        {{ val ? fmtCompact(val) : '—' }}
                      </td>
                      <td
                        class="border-l px-2 py-1.5 text-right font-mono font-semibold whitespace-nowrap text-foreground"
                      >
                        {{ fmtCompact(row.total) }}
                      </td>
                      <td class="px-2 py-1.5 text-right">
                        <button
                          v-if="row.liquidacion_id"
                          class="inline-flex size-6 items-center justify-center rounded transition-colors hover:bg-muted"
                          title="Ver detalle operativo"
                          @click="router.push(`/liquidaciones/${row.liquidacion_id}`)"
                        >
                          <EyeIcon class="size-3.5 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                    <tr class="border-t-2">
                      <td
                        class="sticky left-0 border-r bg-muted/30 px-2 py-1.5 font-bold text-foreground"
                      >
                        TOTAL
                      </td>
                      <td
                        v-for="(val, mi) in cli.totalRow.meses"
                        :key="mi"
                        class="px-2 py-1.5 text-right font-mono font-bold whitespace-nowrap text-foreground"
                      >
                        {{ fmtCompact(val) }}
                      </td>
                      <td
                        class="border-l px-2 py-1.5 text-right font-mono font-bold whitespace-nowrap text-foreground"
                      >
                        {{ fmtCompact(cli.totalRow.total) }}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
