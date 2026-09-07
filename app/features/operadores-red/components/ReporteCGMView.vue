<template>
  <div class="space-y-4">
    <div class="flex gap-1 border-b" style="border-color: #e8e0f0;">
      <button type="button" class="text-xs font-bold px-1 pb-2 mr-4"
        :style="innerTab === 'enviar' ? 'color:var(--color-unergy-purple-dark); border-bottom: 2.5px solid var(--color-unergy-purple);' : 'color:#9b89b5; border-bottom: 2.5px solid transparent;'"
        @click="innerTab = 'enviar'">Enviar</button>
      <button type="button" class="text-xs font-bold px-1 pb-2"
        :style="innerTab === 'historial' ? 'color:var(--color-unergy-purple-dark); border-bottom: 2.5px solid var(--color-unergy-purple);' : 'color:#9b89b5; border-bottom: 2.5px solid transparent;'"
        @click="innerTab = 'historial'">Historial</button>
    </div>

    <HistorialEnviosCGM v-if="innerTab === 'historial'" />

    <template v-else>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs flex-1 min-w-[200px]" style="color: #9b89b5;">
        Destinatarios del reporte CGM (operador de red + cliente). Por defecto a cada uno le llega el Excel de todas sus fronteras — despliega "Proyectos" para elegir solo uno o algunos en particular.
      </p>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-medium" style="color: #6b5a8a;">Desde</label>
          <DatePicker v-model="fechaDesde" dateFormat="dd/mm/yy" :maxDate="fechaHasta || ayer"
            showIcon iconDisplay="input" style="width: 150px;" />
        </div>
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-medium" style="color: #6b5a8a;">Hasta</label>
          <DatePicker v-model="fechaHasta" dateFormat="dd/mm/yy" :minDate="fechaDesde" :maxDate="ayer"
            showIcon iconDisplay="input" style="width: 150px;" />
        </div>
        <button type="button" :disabled="!totalSeleccionados || enviando"
          @click="enviarSeleccionados"
          v-tooltip.top="!totalSeleccionados ? 'Selecciona al menos un destinatario' : ''"
          class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
          :style="!totalSeleccionados || enviando ? 'background:var(--color-unergy-purple);color:#fff;opacity:.4;cursor:not-allowed;' : 'background:var(--color-unergy-purple);color:#fff;cursor:pointer;'">
          <LoaderCircleIcon v-if="enviando" class="text-xs size-[1em] animate-spin" />
          <SendIcon v-else class="text-xs size-[1em]" />
          {{ enviando ? 'Enviando…' : `Enviar a ${totalSeleccionados}` }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <div v-else class="space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <button v-for="opt in tipoOpciones" :key="opt.value" type="button" @click="filtroTipo = opt.value"
          class="text-xs font-bold rounded-full transition-colors"
          :style="`height:34px;padding:0 14px;box-sizing:border-box;border:1.5px solid ${filtroTipo === opt.value ? 'var(--color-unergy-purple)' : '#e8e0f0'};background:${filtroTipo === opt.value ? 'var(--color-unergy-purple)' : '#fff'};color:${filtroTipo === opt.value ? '#fff' : '#6b5a8a'};`">
          {{ opt.label }}
        </button>
        <IconField style="max-width: 240px; flex: 1;">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="busqueda" placeholder="Buscar destinatario…" class="w-full" style="height: 34px;" />
        </IconField>
      </div>

      <div class="bg-white rounded-xl shadow-sm overflow-x-auto" style="border: 1px solid #e8e0f0;">
        <table class="w-full text-sm" style="min-width: 680px; table-layout: fixed;">
          <colgroup>
            <col style="width: 34%;" />
            <col style="width: 18%;" />
            <col style="width: 20%;" />
            <col style="width: 16%;" />
            <col style="width: 12%;" />
          </colgroup>
          <thead>
            <tr style="background: #f9f7ff;">
              <th class="text-left px-4 py-2.5 font-semibold" style="color: #6b5a8a;">Destinatario</th>
              <th class="text-left px-4 py-2.5 font-semibold" style="color: #6b5a8a;">Tipo</th>
              <th class="text-left px-4 py-2.5 font-semibold" style="color: #6b5a8a;">Correos</th>
              <th class="text-left px-4 py-2.5 font-semibold" style="color: #6b5a8a;">Proyectos</th>
              <th class="text-left px-4 py-2.5 font-semibold" style="color: #6b5a8a;">
                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" :checked="todosSeleccionados" @change="toggleTodos"
                    style="accent-color: var(--color-unergy-purple); width: 14px; height: 14px;" />
                  Enviar
                </label>
              </th>
            </tr>
          </thead>
          <tbody>
          <template v-for="row in destinatariosFiltrados" :key="row.key">
            <tr class="border-t" style="border-color: #f0ecf6;">
              <td class="px-4 py-2.5">
                <p v-if="row.nombre" class="font-medium" style="color: var(--color-unergy-deep);">{{ formatearNombre(row.nombre) }}</p>
                <p v-else class="text-xs italic" style="color: #c4b8d4;">{{ row.sinVinculo }}</p>
              </td>
              <td class="px-4 py-2.5">
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                  :style="row.tipo === 'Operador de Red'
                    ? 'background: rgba(145,91,216,0.1); color: var(--color-unergy-purple-dark);'
                    : 'background: rgba(16,185,129,0.1); color: #059669;'">
                  {{ row.tipo }}
                </span>
              </td>
              <td class="px-4 py-2.5">
                <RouterLink v-if="row.linkCorregir && row.correos.length"
                  :to="row.linkCorregir" class="font-medium underline" style="color: var(--color-unergy-purple-dark);"
                  v-tooltip.top="'Ver y editar correos'">
                  {{ row.correos.length }} correo{{ row.correos.length > 1 ? 's' : '' }}
                </RouterLink>
                <RouterLink v-else-if="row.linkCorregir"
                  :to="row.linkCorregir" class="text-xs font-medium underline" style="color: #D64455;">
                  {{ row.textoCorregir }}
                </RouterLink>
                <span v-else class="text-xs italic" style="color: #c4b8d4;">—</span>
              </td>
              <td class="px-4 py-2.5">
                <button type="button" @click="toggle(row.key)"
                  class="flex items-center gap-1.5 text-xs font-medium" style="color: #6b5a8a;">
                  <ChevronDownIcon v-if="expanded.has(row.key)" class="text-[10px] size-[1em]" />
                  <ChevronRightIcon v-else class="text-[10px] size-[1em]" />
                  {{ labelProyectos(row) }}
                </button>
              </td>
              <td class="px-4 py-2.5">
                <input type="checkbox" :checked="seleccionados.has(row.key)" :disabled="!row.correos.length"
                  @change="toggleSeleccion(row.key)"
                  v-tooltip.left="!row.correos.length ? 'Sin correos, no se puede enviar' : ''"
                  style="accent-color: var(--color-unergy-purple); width: 14px; height: 14px;"
                  :style="!row.correos.length ? 'opacity:.35;cursor:not-allowed;' : 'cursor:pointer;'" />
              </td>
            </tr>
            <tr v-if="expanded.has(row.key)" class="border-t" style="border-color: #f0ecf6; background: #fbfaff;">
              <td colspan="5" class="px-4 py-3">
                <div v-if="proyectosDeFila(row.key).size" class="flex items-center justify-end gap-3 mb-2">
                  <button type="button" @click="limpiarProyectos(row.key)"
                    class="text-[11px] font-semibold underline" style="color: var(--color-unergy-purple);">
                    Quitar selección (volver a todos)
                  </button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="p in row.proyectos" :key="p.id" type="button"
                    @click="toggleProyecto(row.key, p.id)"
                    class="text-xs px-2.5 py-1 rounded-lg transition-colors"
                    :style="proyectosDeFila(row.key).has(p.id)
                      ? 'background:var(--color-unergy-purple); border:1px solid var(--color-unergy-purple); color:#fff;'
                      : proyectosDeFila(row.key).size
                        ? 'background:#fff; border:1px solid #e8e0f0; color:#c4b8d4;'
                        : 'background:#fff; border:1px solid #e8e0f0; color:#6b5a8a;'">
                    {{ formatearNombre(p.nombre) }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!destinatariosFiltrados.length">
            <td colspan="5" class="px-4 py-8 text-center text-xs italic" style="color: #c4b8d4;">
              Ningún destinatario coincide con el filtro.
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import DatePicker from 'primevue/datepicker'
import { toast } from 'vue-sonner'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'
import { logger } from '~/core/logger'
import { formatearNombre } from '~/utils/nombreFormato'
import HistorialEnviosCGM from './HistorialEnviosCGM.vue'
import { ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon, SearchIcon, SendIcon } from '@lucide/vue'

const reporteCgmService = new ReporteCgmService()

const innerTab = ref('enviar')
const fronteras = ref([])
const loading = ref(true)
const enviando = ref(false)
const expanded = ref(new Set())
const filtroTipo = ref('todos')
const busqueda = ref('')

const ayer = new Date(Date.now() - 86400000)
const fechaDesde = ref(new Date(ayer))
const fechaHasta = ref(new Date(ayer))

function formatFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const tipoOpciones = [
  { value: 'todos', label: 'Todos' },
  { value: 'Operador de Red', label: 'Operador de Red' },
  { value: 'Cliente', label: 'Cliente' },
]

function toggle(key) {
  const next = new Set(expanded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expanded.value = next
}

// Una fila por destinatario único (no por proyecto): agrupa generación+consumo
// de la misma planta y, si un mismo operador/cliente cubre varios proyectos,
// los junta en una sola fila con el detalle expandible.
const destinatarios = computed(() => {
  const proyectos = new Map()
  for (const f of fronteras.value) {
    const key = f.proyecto_id ?? `frontera-${f.id}`
    if (!proyectos.has(key)) proyectos.set(key, f)
  }

  const grupos = new Map()
  function addEntry(refTipo, refId, tipo, nombre, sinVinculo, correos, linkCorregir, textoCorregir, proyecto) {
    const key = `${tipo}-${refId ?? 'sin-vinculo'}`
    if (!grupos.has(key)) {
      grupos.set(key, { key, refTipo, refId, tipo, nombre, sinVinculo, correos, linkCorregir, textoCorregir, proyectos: [] })
    }
    grupos.get(key).proyectos.push(proyecto)
  }

  for (const [proyectoId, f] of proyectos) {
    const proyecto = { id: proyectoId, nombre: f.proyecto_nombre || 'Proyecto sin nombre' }

    addEntry('operador', f.operador_red_id, 'Operador de Red', f.operador_comercial,
      'Sin operador vinculado', f.operador_correos,
      f.operador_red_id ? `/mem/operadores-red/${f.operador_red_id}` : null, 'Sin correos — corregir', proyecto)

    // Un proyecto puede tener varios inversionistas -- cada uno es su propio
    // destinatario "Cliente", con solo sus propios correos CGM (no la unión).
    if (f.clientes_cgm && f.clientes_cgm.length) {
      for (const c of f.clientes_cgm) {
        addEntry('cliente', c.id, 'Cliente', c.nombre,
          'Sin cliente vinculado', c.correos,
          `/clientes/${c.id}?tab=contactos`, 'Sin correos CGM — corregir', proyecto)
      }
    } else {
      addEntry('cliente', null, 'Cliente', null,
        'Sin inversionistas registrados', [], null, 'Sin inversionistas — corregir', proyecto)
    }
  }

  // 'Operaciones Unergy' (cliente id=157) es un caso especial del backend
  // (CLIENTES_TODAS_LAS_FRONTERAS en reporte_cgm.py): en vez de resolver sus
  // fronteras por vínculo real (como cualquier otro Cliente), recibe TODAS
  // las fronteras del sistema -- a propósito no está vinculado a ninguna,
  // así que nunca aparecería en la construcción de arriba (que solo mira
  // clientes_cgm de cada frontera). Se agrega acá como fila fija; el correo
  // (operaciones@unergy.io) coincide con el contacto CGM ya creado para
  // este cliente en la BD -- si cambia, hay que actualizarlo en los dos lados.
  const filas = [...grupos.values()]
  filas.push({
    key: 'cliente-157', refTipo: 'cliente', refId: 157, tipo: 'Cliente',
    nombre: 'Operaciones Unergy', sinVinculo: null,
    correos: ['operaciones@unergy.io'],
    linkCorregir: '/clientes/157?tab=contactos', textoCorregir: 'Sin correos CGM — corregir',
    proyectos: [], etiquetaProyectos: 'Todas las fronteras',
  })

  return filas.sort((a, b) => (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz'))
})

const destinatariosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return destinatarios.value.filter(row => {
    if (filtroTipo.value !== 'todos' && row.tipo !== filtroTipo.value) return false
    if (texto && !(row.nombre || '').toLowerCase().includes(texto)) return false
    return true
  })
})

// Selección de a quién enviarle (checkbox por fila). Por defecto se marcan
// todos los que ya tienen correos cargados -- los que no tienen, no se
// pueden seleccionar (no hay a dónde enviar).
const seleccionados = ref(new Set())

watch(destinatarios, (rows) => {
  const next = new Set(seleccionados.value)
  for (const r of rows) {
    if (r.correos.length && !next.has(r.key)) next.add(r.key)
  }
  seleccionados.value = next
}, { immediate: true })

function toggleSeleccion(key) {
  const next = new Set(seleccionados.value)
  next.has(key) ? next.delete(key) : next.add(key)
  seleccionados.value = next
}

const seleccionablesFiltrados = computed(() => destinatariosFiltrados.value.filter(r => r.correos.length))
const todosSeleccionados = computed(() =>
  seleccionablesFiltrados.value.length > 0 && seleccionablesFiltrados.value.every(r => seleccionados.value.has(r.key))
)
const totalSeleccionados = computed(() => destinatarios.value.filter(r => seleccionados.value.has(r.key)).length)

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
// -- así no hay que deseleccionar uno por uno cuando son decenas de proyectos,
// solo se marcan los pocos que sí se quieren mandar.
const proyectosSeleccionados = ref(new Map()) // key: row.key -> Set<proyecto_id>

function proyectosDeFila(rowKey) {
  return proyectosSeleccionados.value.get(rowKey) || new Set()
}

function toggleProyecto(rowKey, proyectoId) {
  const set = new Set(proyectosDeFila(rowKey))
  set.has(proyectoId) ? set.delete(proyectoId) : set.add(proyectoId)
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, set)
  proyectosSeleccionados.value = next
}

function limpiarProyectos(rowKey) {
  const next = new Map(proyectosSeleccionados.value)
  next.set(rowKey, new Set())
  proyectosSeleccionados.value = next
}

function labelProyectos(row) {
  if (row.etiquetaProyectos) return row.etiquetaProyectos
  const total = row.proyectos.length
  const numSeleccionados = proyectosDeFila(row.key).size
  if (!numSeleccionados) return `${total} proyecto${total === 1 ? '' : 's'}`
  return `${numSeleccionados} de ${total} seleccionados`
}

async function enviarSeleccionados() {
  const filas = destinatarios.value.filter(r => seleccionados.value.has(r.key) && r.refId != null)
  if (!filas.length) return

  enviando.value = true
  try {
    const respuesta = await reporteCgmService.enviar({
      fecha_inicio: formatFecha(fechaDesde.value),
      fecha_fin: formatFecha(fechaHasta.value || fechaDesde.value),
      destinatarios: filas.map(r => {
        const proyectos = proyectosDeFila(r.key)
        return {
          tipo: r.refTipo,
          id: r.refId,
          proyectos: proyectos.size ? [...proyectos] : null,
        }
      }),
    })
    const ok = respuesta.resultados.filter(r => r.ok)
    const conError = respuesta.resultados.filter(r => !r.ok)
    const resumen = `${ok.length} enviado${ok.length === 1 ? '' : 's'}${conError.length ? `, ${conError.length} con error` : ''}`
    if (conError.length) {
      toast.warning(resumen, {
        description: conError.map(r => `${r.nombre}: ${r.error}`).join(' · '),
        duration: 6000,
      })
    } else {
      toast.success(resumen, { duration: 6000 })
    }
  } catch (e) {
    toast.error('Error al enviar', { description: e.data?.detail || e.message, duration: 5000 })
  } finally {
    enviando.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    fronteras.value = await reporteCgmService.listarFronteras()
  } catch (e) {
    logger.error('operadores-red.reporte-cgm', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
