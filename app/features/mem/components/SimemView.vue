<script setup lang="ts">
/**
 * SIMEM · Códigos de Agente.
 *
 * Primera pestaña portada del HTML suelto que se usaba por fuera de la
 * plataforma. El catálogo de plantas (archivo `capains` de XM) viaja como JSON
 * estático y se carga perezosamente —84 KB que no tienen por qué pesar en las
 * demás vistas—; la razón social y las actividades salen en vivo del SIMEM.
 */
import { BuildingIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, SearchIcon, ZapIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { obtenerRegistroAgentes } from '~/features/mem/services/simem'
import type { AgenteSimem, FilaAgente, PlantaDeAgente, PlantaSimem } from '~/features/mem/utils/simemAgentes'
import { TECNOLOGIAS, agentesDesdeCatalogo, filtrarAgentes } from '~/features/mem/utils/simemAgentes'
import { exportarExcel } from '~/utils/exportarExcel'
import type { BolsaSimemMes } from '~/features/mem/services/bolsaSimem'
import { BolsaSimemService } from '~/features/mem/services/bolsaSimem'

const bolsaService = new BolsaSimemService()

interface FilaExportacion {
  f: FilaAgente
  p: PlantaDeAgente | null
}

/** Las pestañas portadas del HTML suelto. Las demás entran con este mismo molde. */
const PESTANAS = [
  { id: 'agentes', label: 'Códigos de agente' },
  { id: 'bolsa', label: 'Precio de bolsa' },
] as const
type Pestana = (typeof PESTANAS)[number]['id']

/** Agentes de la casa: se muestran primero y resaltados. */
const UNERGY = new Set(['UNGG'])

const pestana = ref<Pestana>('agentes')

const cargando = ref(true)
const error = ref<string | null>(null)
const fechaRegistro = ref<string | null>(null)
const catalogo = ref<Record<string, PlantaSimem>>({})
const registro = ref<Record<string, AgenteSimem>>({})
const exportando = ref(false)

const q = ref('')
const tecnologia = ref('')
const actividad = ref('')
const soloUnergy = ref(false)
const abiertos = ref(new Set<string>())

const todas = computed(() => agentesDesdeCatalogo(catalogo.value, registro.value, UNERGY))
const filas = computed(() => filtrarAgentes(todas.value, {
  q: q.value, tecnologia: tecnologia.value, actividad: actividad.value, soloUnergy: soloUnergy.value,
}))
const totalPlantas = computed(() => filas.value.reduce((s, f) => s + f.plantas.length, 0))

/** Las actividades que de verdad existen en el registro, no una lista inventada. */
const actividades = computed(() =>
  [...new Set(todas.value.flatMap((f) => f.actividades))].sort(),
)
const tecnologias = computed(() =>
  [...new Set(todas.value.flatMap((f) => f.tecnologias))].sort(),
)

function alternar(codigo: string) {
  const abierto = new Set(abiertos.value)
  if (abierto.has(codigo)) abierto.delete(codigo)
  else abierto.add(codigo)
  abiertos.value = abierto
}

const fmtMw = (kw: number) => kw > 0 ? `${(kw / 1000).toFixed(2).replace('.', ',')} MW` : '—'

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    // El catálogo es un JSON estático; el registro, una llamada al SIMEM. Si el
    // SIMEM falla, el catálogo igual sirve —se ven las plantas sin razón social—
    // así que se cargan por separado y solo el primero puede tumbar la vista.
    const { default: plantas } = await import('~/features/mem/data/plantasSimem.json')
    catalogo.value = plantas as unknown as Record<string, PlantaSimem>
    try {
      const reg = await obtenerRegistroAgentes()
      registro.value = reg.agentes
      fechaRegistro.value = reg.fecha
      if (!reg.fecha) {
        toast.warning('El SIMEM no respondió con el registro de agentes', {
          description: 'Se muestran las plantas del catálogo, sin razón social ni actividades.',
          duration: 7000,
        })
      }
    } catch (e) {
      toast.warning('No se pudo consultar el registro de agentes', {
        description: normalizeError(e).message,
        duration: 7000,
      })
    }
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    cargando.value = false
  }
}

async function exportar() {
  if (!filas.value.length) return
  exportando.value = true
  try {
    // Una fila por PLANTA, no por agente: en una hoja de cálculo se filtra y se
    // cruza por planta, y el agente se repite sin estorbar.
    // Un agente sin plantas igual sale, con la celda de planta vacía: si se
    // omitiera, el Excel no cuadraría con el conteo de la pantalla.
    const planas = filas.value.flatMap<FilaExportacion>((f) =>
      f.plantas.length
        ? f.plantas.map((p) => ({ f, p }))
        : [{ f, p: null }],
    )
    await exportarExcel<FilaExportacion>(planas, [
      { header: 'Código SIC', value: (r) => r.f.codigo },
      { header: 'Razón social', value: (r) => r.f.nombre },
      { header: 'Actividad', value: (r) => r.f.actividades.join(' · ') },
      { header: 'Unergy', value: (r) => r.f.esUnergy ? 'SÍ' : '' },
      { header: 'Planta', value: (r) => r.p?.codigo ?? '' },
      { header: 'Nombre planta', value: (r) => r.p?.nombre ?? '' },
      { header: 'Tecnología', value: (r) => r.p ? (TECNOLOGIAS[r.p.tecnologia] ?? r.p.tecnologia) : '' },
      { header: 'Capacidad (kW)', value: (r) => r.p?.capacidadKw ?? '' },
      { header: 'Uns (SIMEM)', value: (r) => r.p?.unidades.join(', ') ?? '' },
      { header: 'Pls (SRC)', value: (r) => r.p?.pls ?? '' },
      { header: 'Despacho', value: (r) => r.p?.despacho ?? '' },
      { header: 'FPO', value: (r) => r.p?.fpo ?? '' },
    ], 'SIMEM_codigos_de_agente.xlsx', 'Agentes')
  } catch (e) {
    toast.error('No se pudo exportar', { description: normalizeError(e).message, duration: 6000 })
  } finally {
    exportando.value = false
  }
}

// ── Precio de bolsa ────────────────────────────────────────────────────────
const hoy = new Date()
const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
const periodo = ref(`${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`)
const bolsa = ref<BolsaSimemMes | null>(null)
const cargandoBolsa = ref(false)
const errorBolsa = ref<string | null>(null)

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

const diasBolsa = computed(() => Object.keys(bolsa.value?.detalle ?? {}).sort())

/** Promedio del día, sobre las horas que haya. */
function promedioDia(dia: string): number | null {
  const horas = Object.values(bolsa.value?.detalle?.[dia] ?? {})
  return horas.length ? horas.reduce((s, v) => s + v, 0) / horas.length : null
}

const fmtPrecio = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function cargarBolsa() {
  cargandoBolsa.value = true
  errorBolsa.value = null
  try {
    bolsa.value = await bolsaService.obtenerMes(periodo.value)
  } catch (e) {
    errorBolsa.value = normalizeError(e).message
    bolsa.value = null
  } finally {
    cargandoBolsa.value = false
  }
}

watch(pestana, (p) => {
  if (p === 'bolsa' && !bolsa.value && !cargandoBolsa.value) cargarBolsa()
})

onMounted(cargar)
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="SIMEM · Códigos de agente"
      subtitle="Registro de agentes del mercado y sus plantas, con los códigos Uns del SIMEM y Pls del SRC"
    >
      <template #actions>
        <Button
          v-if="pestana === 'agentes'" size="sm" variant="outline"
          :disabled="exportando || !filas.length" @click="exportar"
        >
          <DownloadIcon class="size-3" />
          Exportar
        </Button>
      </template>
    </PageHeader>

    <div class="flex gap-1 border-b">
      <button
        v-for="p in PESTANAS" :key="p.id"
        class="border-b-2 px-3 py-2 text-sm transition-colors"
        :class="pestana === p.id
          ? 'border-primary font-medium text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="pestana = p.id"
      >
        {{ p.label }}
      </button>
    </div>

    <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      No se pudo cargar el catálogo de plantas: {{ error }}
    </div>

    <template v-else-if="pestana === 'agentes'">
      <!-- Filtros -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="relative min-w-64 flex-1">
          <SearchIcon class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="q" class="pl-8"
            placeholder="Agente, razón social, planta, Uns o Pls…"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Tecnología</label>
          <select v-model="tecnologia" class="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Todas</option>
            <option v-for="t in tecnologias" :key="t" :value="t">{{ TECNOLOGIAS[t] ?? t }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Actividad</label>
          <select v-model="actividad" class="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Todas</option>
            <option v-for="a in actividades" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <label class="flex h-9 items-center gap-2 text-sm">
          <input v-model="soloUnergy" type="checkbox" class="size-4"> Solo Unergy
        </label>
      </div>

      <!-- Conteos -->
      <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <BuildingIcon class="size-3.5" />
          <b class="text-foreground">{{ filas.length.toLocaleString('es-CO') }}</b> agentes
        </span>
        <span class="flex items-center gap-1.5">
          <ZapIcon class="size-3.5" />
          <b class="text-foreground">{{ totalPlantas.toLocaleString('es-CO') }}</b> plantas
        </span>
        <span v-if="fechaRegistro" class="text-xs">Registro del SIMEM · {{ fechaRegistro }}</span>
      </div>

      <Spinner v-if="cargando" class="mx-auto my-10 block size-6 text-muted-foreground" />

      <div v-else-if="!filas.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Sin resultados.
      </div>

      <div v-else class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr class="border-b">
              <th class="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">Código SIC</th>
              <th class="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">Razón social</th>
              <th class="px-3 py-2.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">Actividad</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">Plantas</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">Capacidad</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="f in filas" :key="f.codigo">
              <tr
                class="cursor-pointer border-t hover:bg-muted/40"
                :class="{ 'bg-primary/5': f.esUnergy }"
                @click="alternar(f.codigo)"
              >
                <td class="px-3 py-2 font-medium whitespace-nowrap">
                  <component
                    :is="abiertos.has(f.codigo) ? ChevronDownIcon : ChevronRightIcon"
                    class="mr-1 inline size-3 text-muted-foreground"
                  />
                  {{ f.codigo }}
                  <Badge v-if="f.esUnergy" class="ml-1.5 text-[10px]">UNERGY</Badge>
                </td>
                <td class="px-3 py-2">{{ f.nombre }}</td>
                <td class="px-3 py-2 text-xs text-muted-foreground">{{ f.actividades.join(' · ') || '—' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ f.plantas.length }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ fmtMw(f.capacidadKw) }}</td>
              </tr>
              <tr v-if="abiertos.has(f.codigo) && f.plantas.length" class="border-t bg-muted/20">
                <td colspan="5" class="px-3 py-2">
                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div v-for="p in f.plantas" :key="p.codigo" class="rounded border bg-background p-2">
                      <div class="text-xs font-medium">{{ p.codigo }} — {{ p.nombre }}</div>
                      <div class="mt-0.5 text-[11px] text-muted-foreground">
                        {{ TECNOLOGIAS[p.tecnologia] ?? p.tecnologia }} · {{ fmtMw(p.capacidadKw) }}
                        <template v-if="p.unidades.length">
                          <br>
                          <span class="font-mono">{{ p.unidades.join(', ') }}</span>
                          <!-- El Pls no viene en ninguna fuente: se deriva del Uns. -->
                          <span v-if="p.pls" class="font-mono"> · {{ p.pls }}</span>
                        </template>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ═══ Precio de bolsa (SIMEM 709b84) ═══ -->
    <template v-else-if="pestana === 'bolsa'">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Período</label>
          <Input v-model="periodo" type="month" class="w-40" @change="cargarBolsa" />
        </div>
        <Button size="sm" variant="outline" :disabled="cargandoBolsa" @click="cargarBolsa">
          Consultar
        </Button>
      </div>

      <p class="text-xs text-muted-foreground">
        Mismo cálculo que el valor a indemnizar (SIMEM 709b84). No es el precio de bolsa de
        EVO que muestra «Precio de Bolsa»: esa es otra fuente.
      </p>

      <div v-if="errorBolsa" class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        {{ errorBolsa }}
      </div>

      <Spinner v-else-if="cargandoBolsa" class="mx-auto my-10 block size-6 text-muted-foreground" />

      <template v-else-if="bolsa">
        <div class="flex flex-wrap gap-4 text-sm">
          <div class="rounded-md border px-4 py-2">
            <div class="text-xs text-muted-foreground">PNBA del mes</div>
            <div class="text-lg font-semibold tabular-nums">{{ fmtPrecio(bolsa.precio_bolsa) }}</div>
            <div class="text-[11px] text-muted-foreground">COP/kWh</div>
          </div>
          <div class="rounded-md border px-4 py-2">
            <div class="text-xs text-muted-foreground">Horas</div>
            <div class="text-lg font-semibold tabular-nums">{{ bolsa.horas }}</div>
            <div class="text-[11px] text-muted-foreground">{{ bolsa.dias }} días</div>
          </div>
          <!-- Se nombra siempre que exista: son horas con el precio por encima
               del de escasez, y antes salían como huecos. -->
          <div v-if="bolsa.horas_ptb" class="rounded-md border border-amber-300 bg-amber-50 px-4 py-2">
            <div class="text-xs text-amber-900">Horas del PTB</div>
            <div class="text-lg font-semibold text-amber-900 tabular-nums">{{ bolsa.horas_ptb }}</div>
            <div class="text-[11px] text-amber-900">precio sobre el de escasez</div>
          </div>
        </div>

        <div v-if="!diasBolsa.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
          El SIMEM no devolvió datos para este período.
        </div>

        <div v-else class="overflow-x-auto rounded-md border">
          <table class="w-full text-xs">
            <thead class="bg-muted/50">
              <tr class="border-b">
                <th class="px-2 py-2 text-left font-medium tracking-wide text-muted-foreground uppercase">Fecha</th>
                <th v-for="h in HORAS" :key="h" class="px-1.5 py-2 text-right font-medium text-muted-foreground tabular-nums">
                  {{ h }}
                </th>
                <th class="px-2 py-2 text-right font-medium tracking-wide text-muted-foreground uppercase">Prom.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in diasBolsa" :key="d" class="border-t hover:bg-muted/40">
                <td class="px-2 py-1.5 whitespace-nowrap">{{ d }}</td>
                <td
                  v-for="h in HORAS" :key="h"
                  class="px-1.5 py-1.5 text-right tabular-nums"
                  :class="{ 'text-muted-foreground': bolsa.detalle[d]?.[h] == null }"
                >
                  {{ fmtPrecio(bolsa.detalle[d]?.[h]) }}
                </td>
                <td class="px-2 py-1.5 text-right font-medium tabular-nums">{{ fmtPrecio(promedioDia(d)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
