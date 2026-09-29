<template>
  <div class="relative flex h-dvh flex-col overflow-hidden bg-muted font-sans text-foreground">
    <header
      class="cgm-topbar flex shrink-0 items-center gap-2.5 bg-foreground px-3.5 pb-2.5 text-background"
    >
      <span class="flex-1 text-base font-bold tracking-wide"
        ><MailIcon class="mr-1.5 inline size-4 text-highlight" /> Reporte CGM</span
      >
      <button
        class="size-9 shrink-0 rounded-xl bg-white/10 text-white disabled:opacity-50"
        :disabled="loading"
        @click="loadData"
        title="Actualizar"
      >
        <LoaderCircleIcon v-if="loading" class="size-4 animate-spin" />
        <RefreshCwIcon v-else class="size-4" />
      </button>
    </header>

    <main class="flex-1 overflow-y-auto px-3 py-3">
      <div class="mb-2.5 flex gap-2.5">
        <label
          class="flex flex-1 flex-col gap-1 text-xs font-bold tracking-wide text-muted-foreground uppercase"
        >
          <span>Desde</span>
          <input
            type="date"
            class="rounded-lg border-2 border-border bg-card px-2.5 py-2 text-sm font-semibold tracking-normal text-foreground normal-case"
            v-model="fechaDesdeStr"
            :max="fechaHastaStr || ayerStr"
          />
        </label>
        <label
          class="flex flex-1 flex-col gap-1 text-xs font-bold tracking-wide text-muted-foreground uppercase"
        >
          <span>Hasta</span>
          <input
            type="date"
            class="rounded-lg border-2 border-border bg-card px-2.5 py-2 text-sm font-semibold tracking-normal text-foreground normal-case"
            v-model="fechaHastaStr"
            :min="fechaDesdeStr"
            :max="ayerStr"
          />
        </label>
      </div>

      <div class="mb-2.5 flex gap-1.5">
        <button
          v-for="opt in tipoOpciones"
          :key="opt.value"
          type="button"
          :class="[
            'h-10 flex-1 rounded-lg border-2 text-xs font-bold',
            filtroTipo === opt.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground',
          ]"
          @click="filtroTipo = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar destinatario…"
        class="mb-3 w-full rounded-lg border-2 border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
      />

      <div v-if="loading" class="flex items-center gap-2 px-1 py-3.5 text-sm text-muted-foreground">
        <LoaderCircleIcon class="size-4 animate-spin text-primary" /> Cargando…
      </div>

      <template v-else>
        <div
          v-if="!destinatariosFiltrados.length"
          class="px-1 py-5 text-center text-sm text-muted-foreground"
        >
          Ningún destinatario coincide con el filtro.
        </div>

        <div
          v-for="row in destinatariosFiltrados"
          :key="row.key"
          class="mb-2 flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-3"
        >
          <label class="shrink-0 pt-0.5" @click.stop>
            <input
              type="checkbox"
              class="size-4.5 accent-primary"
              :checked="seleccionados.has(row.key)"
              :disabled="!row.correos.length"
              @change="toggleSeleccion(row.key)"
            />
          </label>

          <div class="min-w-0 flex-1" @click="toggle(row.key)">
            <div class="mb-1 flex items-center justify-between gap-2">
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-extrabold whitespace-nowrap',
                  row.tipo === 'Operador de Red'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-success/15 text-success',
                ]"
              >
                {{ row.tipo }}
              </span>
              <span
                class="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground"
              >
                <ChevronDownIcon
                  class="size-3 transition-transform duration-150"
                  :class="{ 'rotate-180': expanded.has(row.key) }"
                />
                {{ labelProyectos(row) }}
              </span>
            </div>
            <div
              :class="[
                'mb-1 text-sm',
                row.nombre
                  ? 'font-bold text-foreground'
                  : 'font-medium text-muted-foreground italic',
              ]"
            >
              {{ row.nombre ? formatearNombre(row.nombre) : row.sinVinculo }}
            </div>

            <RouterLink
              v-if="row.linkCorregir && row.correos.length"
              :to="row.linkCorregir"
              class="inline-block text-xs font-semibold text-primary underline"
              @click.stop
            >
              {{ row.correos.length }} correo{{ row.correos.length > 1 ? 's' : '' }}
            </RouterLink>
            <RouterLink
              v-else-if="row.linkCorregir"
              :to="row.linkCorregir"
              class="inline-block text-xs font-semibold text-destructive underline"
              @click.stop
            >
              {{ row.textoCorregir }}
            </RouterLink>
            <span v-else class="inline-block text-xs font-semibold text-muted-foreground italic"
              >—</span
            >

            <div v-if="expanded.has(row.key)">
              <button
                v-if="proyectosDeFila(row.key).size"
                type="button"
                class="mb-1.5 ml-auto block text-xs font-bold text-primary underline"
                @click.stop="limpiarProyectos(row.key)"
              >
                Quitar selección (volver a todos)
              </button>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="p in row.proyectos"
                  :key="p.id"
                  type="button"
                  :class="[
                    'rounded-md border px-2 py-1 text-xs transition-opacity duration-150',
                    proyectosDeFila(row.key).has(p.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : proyectosDeFila(row.key).size
                        ? 'border-border bg-muted/30 text-muted-foreground/50'
                        : 'border-border bg-muted/30 text-muted-foreground',
                  ]"
                  @click.stop="toggleProyecto(row.key, p.id)"
                >
                  {{ formatearNombre(p.nombre) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="h-18" />
    </main>

    <div
      class="cgm-send-bar absolute inset-x-0 bg-linear-to-t from-muted from-70% to-transparent px-3 py-2.5"
    >
      <button
        class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md disabled:opacity-40 disabled:shadow-none"
        :disabled="!totalSeleccionados || enviando"
        @click="enviarSeleccionados"
      >
        <LoaderCircleIcon v-if="enviando" class="size-4 animate-spin" />
        <SendIcon v-else class="size-4" />
        {{ enviando ? 'Enviando…' : `Enviar a ${totalSeleccionados}` }}
      </button>
    </div>

    <MobileTabBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { ChevronDownIcon, LoaderCircleIcon, MailIcon, RefreshCwIcon, SendIcon } from '@lucide/vue'
import type { DestinatarioEnvioCgm, FronteraCgm } from '~/features/operadores-red/types'
import { logger } from '~/core/logger'
import { normalizeError } from '~/core/errors'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'
import { formatearNombre } from '~/utils/nombreFormato'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'

function fechaStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ayerStr = fechaStr(new Date(Date.now() - 86400000))

/** Una fila del reporte: un destinatario (operador o cliente), con los proyectos que cubre. */
interface GrupoDestinatarioCgm {
  key: string
  refTipo: 'operador' | 'cliente'
  refId: number | null
  tipo: string
  nombre: string | null
  sinVinculo: string
  correos: string[]
  linkCorregir: string | null
  textoCorregir: string
  proyectos: { id: number; nombre: string }[]
}

const reporteCgmService = new ReporteCgmService()
const fronteras = ref<FronteraCgm[]>([])
const loading = ref(true)
const enviando = ref(false)
const expanded = ref(new Set<string>())
const filtroTipo = ref('todos')
const busqueda = ref('')
const fechaDesdeStr = ref(ayerStr)
const fechaHastaStr = ref(ayerStr)

const tipoOpciones = [
  { value: 'todos', label: 'Todos' },
  { value: 'Operador de Red', label: 'Operador' },
  { value: 'Cliente', label: 'Cliente' },
]

function toggle(key: string): void {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

// Misma lógica de agrupación que la vista de escritorio (ReporteCGMView.vue):
// una fila por destinatario único, agrupando los proyectos que cubre.
const destinatarios = computed<GrupoDestinatarioCgm[]>(() => {
  const proyectos = new Map<number, FronteraCgm>()
  for (const f of fronteras.value) {
    // `f.id` (siempre presente) respalda a `proyecto_id` para que la clave sea
    // siempre numérica: la fila igual muestra "Proyecto sin nombre".
    const key = f.proyecto_id ?? f.id
    if (!proyectos.has(key)) proyectos.set(key, f)
  }

  const grupos = new Map<string, GrupoDestinatarioCgm>()
  function addEntry(
    refTipo: 'operador' | 'cliente',
    refId: number | null | undefined,
    tipo: string,
    nombre: string | null | undefined,
    sinVinculo: string,
    correos: string[] | undefined,
    linkCorregir: string | null,
    textoCorregir: string,
    proyecto: { id: number; nombre: string },
  ): void {
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
    const proyecto = { id: proyectoId, nombre: f.proyecto_nombre || 'Proyecto sin nombre' }

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

    if (f.clientes_cgm && f.clientes_cgm.length) {
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

  return [...grupos.values()].sort((a, b) => (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz'))
})

const destinatariosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return destinatarios.value.filter((row) => {
    if (filtroTipo.value !== 'todos' && row.tipo !== filtroTipo.value) return false
    if (texto && !(row.nombre || '').toLowerCase().includes(texto)) return false
    return true
  })
})

// Selección: marcados por defecto los que ya tienen correos; sin correos no se pueden seleccionar.
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

function toggleSeleccion(key: string): void {
  const next = new Set(seleccionados.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  seleccionados.value = next
}

const totalSeleccionados = computed(
  () => destinatarios.value.filter((r) => seleccionados.value.has(r.key)).length,
)

// Selección de proyectos DENTRO de un destinatario -- vacío = sin filtro, se
// manda todo lo del destinatario (mismo criterio que la vista de escritorio).
const proyectosSeleccionados = ref(new Map<string, Set<number>>()) // key: row.key -> Set<proyecto_id>

function proyectosDeFila(rowKey: string): Set<number> {
  return proyectosSeleccionados.value.get(rowKey) || new Set()
}

function toggleProyecto(rowKey: string, proyectoId: number): void {
  const set = new Set(proyectosDeFila(rowKey))
  if (set.has(proyectoId)) set.delete(proyectoId)
  else set.add(proyectoId)
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, set)
  proyectosSeleccionados.value = next
}

function limpiarProyectos(rowKey: string): void {
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, new Set())
  proyectosSeleccionados.value = next
}

function labelProyectos(row: GrupoDestinatarioCgm): string {
  const total = row.proyectos.length
  const numSeleccionados = proyectosDeFila(row.key).size
  if (!numSeleccionados) return `${total} proy.`
  return `${numSeleccionados}/${total} proy.`
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    fronteras.value = await reporteCgmService.listarFronteras()
  } catch (e) {
    logger.error('mobile', e)
  } finally {
    loading.value = false
  }
}

async function enviarSeleccionados(): Promise<void> {
  const filas = destinatarios.value.filter((r) => seleccionados.value.has(r.key) && r.refId != null)
  if (!filas.length) return

  enviando.value = true
  try {
    const destinatariosPayload: DestinatarioEnvioCgm[] = filas.map((r) => {
      const proyectos = proyectosDeFila(r.key)
      return {
        tipo: r.refTipo,
        id: r.refId!,
        proyectos: proyectos.size ? [...proyectos] : null,
      }
    })
    const data = await reporteCgmService.enviar({
      fecha_inicio: fechaDesdeStr.value,
      fecha_fin: fechaHastaStr.value || fechaDesdeStr.value,
      destinatarios: destinatariosPayload,
    })
    const ok = data.resultados.filter((r) => r.ok)
    const conError = data.resultados.filter((r) => !r.ok)
    const resumen = `${ok.length} enviado${ok.length === 1 ? '' : 's'}${conError.length ? `, ${conError.length} con error` : ''}`
    if (conError.length) {
      toast.warning(resumen, {
        description: conError.map((r) => `${r.nombre}: ${r.error}`).join(' · '),
        duration: 6000,
      })
    } else {
      toast.success(resumen, { duration: 6000 })
    }
  } catch (e) {
    toast.error('Error al enviar', { description: normalizeError(e).message, duration: 5000 })
  } finally {
    enviando.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
/* safe-area: notch superior e inferior en la PWA */
.cgm-topbar {
  padding-top: calc(0.625rem + env(safe-area-inset-top));
}
.cgm-send-bar {
  bottom: calc(3.5rem + env(safe-area-inset-bottom));
}
</style>
