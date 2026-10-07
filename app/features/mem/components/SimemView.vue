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
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { obtenerRegistroAgentes } from '~/features/mem/services/simem'
import type { AgenteSimem, FilaAgente, PlantaDeAgente, PlantaSimem } from '~/features/mem/utils/simemAgentes'
import { TECNOLOGIAS, agentesDesdeCatalogo, filtrarAgentes } from '~/features/mem/utils/simemAgentes'
import { exportarExcel } from '~/utils/exportarExcel'

interface FilaExportacion {
  f: FilaAgente
  p: PlantaDeAgente | null
}

/** Agentes de la casa: se muestran primero y resaltados. */
const UNERGY = new Set(['UNGG'])

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

onMounted(cargar)
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="SIMEM · Códigos de agente"
      subtitle="Registro de agentes del mercado y sus plantas, con los códigos Uns del SIMEM y Pls del SRC"
    >
      <template #actions>
        <Button size="sm" variant="outline" :disabled="exportando || !filas.length" @click="exportar">
          <DownloadIcon class="size-3" />
          Exportar
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      No se pudo cargar el catálogo de plantas: {{ error }}
    </div>

    <template v-else>
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
  </div>
</template>
