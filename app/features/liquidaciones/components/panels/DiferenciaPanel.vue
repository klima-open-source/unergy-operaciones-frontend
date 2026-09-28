<script setup lang="ts">
/**
 * Preliquidación vs Oficial, embebida en la vista de Liquidaciones — mismo
 * endpoint que `PanelContableService.obtenerDiferencia` (ver también
 * `features/panel-contable/components/DiferenciaTab.vue`), pero con las
 * secciones de proyecto colapsables y el toggle 100% / por inversionista que
 * necesita este contexto.
 */
import { ChevronDownIcon, ChevronRightIcon, ClockIcon } from '@lucide/vue'
import { GRUPOS_DIFERENCIA } from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import type { LineaDiferencia, RespuestaDiferencia } from '~/features/panel-contable/types'
import { fmtCompact, formatPeriodo } from '~/features/liquidaciones/utils/liquidaciones'
import DiferenciaTabla from './DiferenciaTabla.vue'

const props = defineProps<{ periodo: string }>()

const panelContableService = new PanelContableService()

function diferenciaVacia(): RespuestaDiferencia {
  return { proyectos: [], resumen: {}, tiene_oficial: false }
}

const loading = ref(false)
const diff = ref<RespuestaDiferencia>(diferenciaVacia())
const abiertos = reactive(new Set<number>())
const vistas = reactive<Record<number, '100' | 'inv'>>({}) // proyecto_id → '100' | 'inv'

function toggle(pid: number) {
  if (abiertos.has(pid)) abiertos.delete(pid)
  else abiertos.add(pid)
}
const vista = (pid: number) => vistas[pid] || '100'
function setVista(pid: number, v: '100' | 'inv') {
  vistas[pid] = v
}

function arrow(v: number | null | undefined): string {
  return v == null || v === 0 ? '' : v > 0 ? '▲ ' : '▼ '
}
function colorDif(v: number | null | undefined): string {
  if (!v) return 'text-muted-foreground'
  return v > 0 ? 'text-success' : 'text-destructive'
}

// Suma las líneas de todos los inversionistas por (grupo, concepto) → vista 100%.
function lineas100(proy: RespuestaDiferencia['proyectos'][number]): LineaDiferencia[] {
  const map = new Map<string, LineaDiferencia>()
  for (const inv of proy.inversionistas || []) {
    for (const ln of inv.lineas || []) {
      const k = ln.grupo + '|' + ln.concepto
      let row = map.get(k)
      if (!row) {
        row = {
          grupo: ln.grupo,
          concepto: ln.concepto,
          preliquidacion: 0,
          oficial: null,
          diferencia: null,
          pct_variacion: null,
        }
        map.set(k, row)
      }
      if (ln.preliquidacion != null)
        row.preliquidacion = (row.preliquidacion || 0) + ln.preliquidacion
      if (ln.oficial != null) row.oficial = (row.oficial || 0) + ln.oficial
    }
  }
  return [...map.values()].map((r) => {
    const dif = r.preliquidacion != null && r.oficial != null ? r.oficial - r.preliquidacion : null
    const pct = dif != null && r.preliquidacion ? (dif / Math.abs(r.preliquidacion)) * 100 : null
    return { ...r, diferencia: dif, pct_variacion: pct }
  })
}

const kpis = computed(() => {
  const r = diff.value.resumen || {}
  const utilidadEstimada = Number(r.utilidad_estimada) || 0
  const utilidadReal = Number(r.utilidad_real) || 0
  const diferencia = Number(r.diferencia) || 0
  return [
    {
      label: 'Utilidad estimada (preliq.)',
      value: utilidadEstimada,
      colorClass: 'text-foreground',
      arrowVal: 0,
    },
    {
      label: 'Utilidad real (oficial)',
      value: utilidadReal,
      colorClass: 'text-foreground',
      arrowVal: 0,
    },
    {
      label: 'Diferencia (se liquida)',
      value: diferencia,
      colorClass: colorDif(diferencia),
      arrowVal: diferencia,
    },
  ]
})

async function load() {
  const per = (props.periodo || '').slice(0, 7)
  if (!per) return
  loading.value = true
  try {
    diff.value = await panelContableService.obtenerDiferencia(per)
    // Abrir el primero por comodidad.
    abiertos.clear()
    if (diff.value.proyectos[0]) abiertos.add(diff.value.proyectos[0].proyecto_id)
  } catch {
    diff.value = diferenciaVacia()
  } finally {
    loading.value = false
  }
}

watch(() => props.periodo, load)
onMounted(load)
</script>

<template>
  <div class="space-y-4 p-4 sm:p-5">
    <Spinner v-if="loading" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-bold text-foreground"
          >Preliquidación vs Oficial · {{ formatPeriodo(periodo) }}</span
        >
        <span class="text-[11px] text-muted-foreground"
          >La diferencia (oficial − preliquidación) es lo que se liquida oficialmente</span
        >
      </div>

      <div
        v-if="!diff.tiene_oficial"
        class="rounded-lg border bg-primary/5 px-3 py-3 text-center text-xs text-muted-foreground"
      >
        <ClockIcon class="mx-auto mb-1.5 block size-5 text-primary" />
        Aún no hay liquidación <b class="text-foreground">oficial</b> para comparar en
        {{ formatPeriodo(periodo) }}.<br />
        Carga el ER oficial en Panel Contable (pestaña Oficial).
      </div>

      <template v-else>
        <!-- Resumen global -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div v-for="k in kpis" :key="k.label" class="rounded-xl border bg-card p-4">
            <p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {{ k.label }}
            </p>
            <p class="mt-1 text-xl font-bold" :class="k.colorClass">
              {{ arrow(k.arrowVal) }}{{ fmtCompact(k.value) }}
            </p>
          </div>
        </div>

        <!-- Por proyecto (desplegable) -->
        <div
          v-for="proy in diff.proyectos"
          :key="proy.proyecto_id"
          class="overflow-hidden rounded-xl border bg-card"
        >
          <!-- Encabezado clickeable -->
          <div
            class="flex cursor-pointer items-center gap-2 border-b px-4 py-2.5 select-none hover:bg-muted/40"
            @click="toggle(proy.proyecto_id)"
          >
            <ChevronDownIcon
              v-if="abiertos.has(proy.proyecto_id)"
              class="size-3.5 text-muted-foreground"
            />
            <ChevronRightIcon v-else class="size-3.5 text-muted-foreground" />
            <h3 class="text-sm font-bold text-foreground">{{ proy.proyecto_nombre }}</h3>
            <span class="ml-auto font-mono text-xs">
              <span class="text-muted-foreground">Preliq</span> {{ fmtCompact(proy.utilidad_pre) }}
              <span class="ml-2 text-muted-foreground">Oficial</span>
              {{ proy.tiene_oficial ? fmtCompact(proy.utilidad_oficial) : '—' }}
              <span class="ml-2 font-semibold" :class="colorDif(proy.utilidad_dif)"
                >{{ arrow(proy.utilidad_dif) }}{{ fmtCompact(proy.utilidad_dif) }}</span
              >
            </span>
          </div>

          <div v-if="abiertos.has(proy.proyecto_id)" class="px-3 py-2">
            <!-- Toggle 100% | Por inversionista -->
            <div class="mb-2 flex justify-end">
              <ToggleGroup
                :model-value="vista(proy.proyecto_id)"
                type="single"
                variant="outline"
                size="sm"
                @update:model-value="(v) => v && setVista(proy.proyecto_id, v as '100' | 'inv')"
              >
                <ToggleGroupItem value="100">100%</ToggleGroupItem>
                <ToggleGroupItem value="inv">Por inversionista</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <!-- Vista 100% (total del proyecto, sumando inversionistas) -->
            <DiferenciaTabla
              v-if="vista(proy.proyecto_id) === '100'"
              :grupos="GRUPOS_DIFERENCIA"
              :lineas="lineas100(proy)"
              :utilidad="{
                pre: proy.utilidad_pre,
                ofi: proy.utilidad_oficial,
                dif: proy.utilidad_dif,
              }"
            />

            <!-- Vista por inversionista -->
            <template v-else>
              <div
                v-for="inv in proy.inversionistas"
                :key="inv.proyecto_inversionista_id || inv.nombre"
                class="mb-3"
              >
                <p class="mb-1 text-[11px] font-semibold text-muted-foreground">
                  {{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%
                </p>
                <DiferenciaTabla
                  :grupos="GRUPOS_DIFERENCIA"
                  :lineas="inv.lineas || []"
                  :utilidad="{
                    pre: inv.utilidad_pre,
                    ofi: inv.utilidad_oficial,
                    dif: inv.utilidad_dif,
                  }"
                />
              </div>
            </template>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
