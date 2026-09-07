<template>
  <div class="cgm-root">
    <header class="cgm-topbar">
      <span class="cgm-brand"><MailIcon class="size-[1em]" /> Reporte CGM</span>
      <button class="cgm-icon-btn" :disabled="loading" @click="loadData" title="Actualizar">
        <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
        <RefreshCwIcon v-else class="size-[1em]" />
      </button>
    </header>

    <main class="cgm-scroll">
      <div class="cgm-dates">
        <label class="cgm-date-field">
          <span>Desde</span>
          <input type="date" v-model="fechaDesdeStr" :max="fechaHastaStr || ayerStr" />
        </label>
        <label class="cgm-date-field">
          <span>Hasta</span>
          <input type="date" v-model="fechaHastaStr" :min="fechaDesdeStr" :max="ayerStr" />
        </label>
      </div>

      <div class="cgm-filters">
        <button v-for="opt in tipoOpciones" :key="opt.value" type="button"
          class="cgm-filter-pill" :class="{ 'cgm-filter-pill--on': filtroTipo === opt.value }"
          @click="filtroTipo = opt.value">
          {{ opt.label }}
        </button>
      </div>

      <input v-model="busqueda" type="text" placeholder="Buscar destinatario…" class="cgm-search" />

      <div v-if="loading" class="cgm-loading"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>

      <template v-else>
        <div v-if="!destinatariosFiltrados.length" class="cgm-empty">Ningún destinatario coincide con el filtro.</div>

        <div v-for="row in destinatariosFiltrados" :key="row.key" class="cgm-card">
          <label class="cgm-check" @click.stop>
            <input type="checkbox" :checked="seleccionados.has(row.key)" :disabled="!row.correos.length"
              @change="toggleSeleccion(row.key)" />
          </label>

          <div class="cgm-card-main" @click="toggle(row.key)">
            <div class="cgm-card-top">
              <span class="cgm-pill" :class="row.tipo === 'Operador de Red' ? 'cgm-pill--or' : 'cgm-pill--cliente'">
                {{ row.tipo }}
              </span>
              <span class="cgm-proj-count">
                <ChevronDownIcon class="cgm-chev size-[1em]" :class="{ 'cgm-chev--open': expanded.has(row.key) }" />
                {{ labelProyectos(row) }}
              </span>
            </div>
            <div class="cgm-nombre" :class="{ 'cgm-nombre--muted': !row.nombre }">{{ row.nombre ? formatearNombre(row.nombre) : row.sinVinculo }}</div>

            <RouterLink v-if="row.linkCorregir && row.correos.length" :to="row.linkCorregir"
              class="cgm-correos" @click.stop>
              {{ row.correos.length }} correo{{ row.correos.length > 1 ? 's' : '' }}
            </RouterLink>
            <RouterLink v-else-if="row.linkCorregir" :to="row.linkCorregir" class="cgm-correos cgm-correos--bad" @click.stop>
              {{ row.textoCorregir }}
            </RouterLink>
            <span v-else class="cgm-correos cgm-correos--muted">—</span>

            <div v-if="expanded.has(row.key)">
              <button v-if="proyectosDeFila(row.key).size" type="button" class="cgm-clear-sel"
                @click.stop="limpiarProyectos(row.key)">
                Quitar selección (volver a todos)
              </button>
              <div class="cgm-chips">
                <button v-for="p in row.proyectos" :key="p.id" type="button" class="cgm-chip"
                  :class="{
                    'cgm-chip--on': proyectosDeFila(row.key).has(p.id),
                    'cgm-chip--dim': proyectosDeFila(row.key).size && !proyectosDeFila(row.key).has(p.id),
                  }"
                  @click.stop="toggleProyecto(row.key, p.id)">
                  {{ formatearNombre(p.nombre) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="cgm-bottom-space" />
    </main>

    <div class="cgm-send-bar">
      <button class="cgm-send-btn" :disabled="!totalSeleccionados || enviando" @click="enviarSeleccionados">
        <LoaderCircleIcon v-if="enviando" class="size-[1em] animate-spin" />
        <SendIcon v-else class="size-[1em]" />
        {{ enviando ? 'Enviando…' : `Enviar a ${totalSeleccionados}` }}
      </button>
    </div>

    <MobileTabBar />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { logger } from '~/core/logger'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'
import { formatearNombre } from '~/utils/nombreFormato'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import { ChevronDownIcon, LoaderCircleIcon, MailIcon, RefreshCwIcon, SendIcon } from '@lucide/vue'


function fechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ayerStr = fechaStr(new Date(Date.now() - 86400000))

const reporteCgmService = new ReporteCgmService()
const fronteras = ref([])
const loading = ref(true)
const enviando = ref(false)
const expanded = ref(new Set())
const filtroTipo = ref('todos')
const busqueda = ref('')
const fechaDesdeStr = ref(ayerStr)
const fechaHastaStr = ref(ayerStr)

const tipoOpciones = [
  { value: 'todos', label: 'Todos' },
  { value: 'Operador de Red', label: 'Operador' },
  { value: 'Cliente', label: 'Cliente' },
]

function toggle(key) {
  const next = new Set(expanded.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expanded.value = next
}

// Misma lógica de agrupación que la vista de escritorio (ReporteCGMView.vue):
// una fila por destinatario único, agrupando los proyectos que cubre.
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

  return [...grupos.values()].sort((a, b) => (a.nombre || 'zzz').localeCompare(b.nombre || 'zzz'))
})

const destinatariosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return destinatarios.value.filter(row => {
    if (filtroTipo.value !== 'todos' && row.tipo !== filtroTipo.value) return false
    if (texto && !(row.nombre || '').toLowerCase().includes(texto)) return false
    return true
  })
})

// Selección: marcados por defecto los que ya tienen correos; sin correos no se pueden seleccionar.
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

const totalSeleccionados = computed(() => destinatarios.value.filter(r => seleccionados.value.has(r.key)).length)

// Selección de proyectos DENTRO de un destinatario -- vacío = sin filtro, se
// manda todo lo del destinatario (mismo criterio que la vista de escritorio).
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
  const total = row.proyectos.length
  const numSeleccionados = proyectosDeFila(row.key).size
  if (!numSeleccionados) return `${total} proy.`
  return `${numSeleccionados}/${total} proy.`
}

async function loadData() {
  loading.value = true
  try {
    fronteras.value = await reporteCgmService.listarFronteras()
  } catch (e) {
    logger.error('mobile', e)
  } finally {
    loading.value = false
  }
}

async function enviarSeleccionados() {
  const filas = destinatarios.value.filter(r => seleccionados.value.has(r.key) && r.refId != null)
  if (!filas.length) return

  enviando.value = true
  try {
    const data = await reporteCgmService.enviar({
      fecha_inicio: fechaDesdeStr.value,
      fecha_fin: fechaHastaStr.value || fechaDesdeStr.value,
      destinatarios: filas.map(r => {
        const proyectos = proyectosDeFila(r.key)
        return {
          tipo: r.refTipo,
          id: r.refId,
          proyectos: proyectos.size ? [...proyectos] : null,
        }
      }),
    })
    const ok = data.resultados.filter(r => r.ok)
    const conError = data.resultados.filter(r => !r.ok)
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

onMounted(loadData)
</script>

<style scoped>
.cgm-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh; overflow: hidden;
  background: #f3f4f6; color: var(--color-unergy-deep);
  font-family: system-ui, -apple-system, sans-serif;
}

.cgm-topbar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: var(--color-unergy-deep); color: #fff;
}
.cgm-brand { flex: 1; font-size: clamp(15px, 4.2vw, 17px); font-weight: 700; letter-spacing: .2px; }
.cgm-brand svg { color: var(--color-unergy-yellow); margin-right: 6px; }
.cgm-icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.1); color: #fff; font-size: 15px; flex-shrink: 0;
}
.cgm-icon-btn:disabled { opacity: .5; }

.cgm-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 13px; }

.cgm-dates { display: flex; gap: 10px; margin-bottom: 10px; }
.cgm-date-field { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: #6b5a8a; text-transform: uppercase; letter-spacing: .3px; }
.cgm-date-field input {
  font-family: inherit; font-size: 14px; font-weight: 600; color: var(--color-unergy-deep);
  border: 1.5px solid #e8e0f0; border-radius: 10px; padding: 8px 10px; background: #fff;
}

.cgm-filters { display: flex; gap: 6px; margin-bottom: 10px; }
.cgm-filter-pill {
  flex: 1; font-size: 12px; font-weight: 700; padding: 8px 0; border-radius: 10px;
  border: 1.5px solid #e8e0f0; background: #fff; color: #6b5a8a;
}
.cgm-filter-pill--on { border-color: var(--color-unergy-purple); background: var(--color-unergy-purple); color: #fff; }

.cgm-search {
  width: 100%; font-family: inherit; font-size: 14px; margin-bottom: 12px;
  border: 1.5px solid #e8e0f0; border-radius: 10px; padding: 9px 12px; background: #fff; color: var(--color-unergy-deep);
}
.cgm-search::placeholder { color: #c4b8d4; }

.cgm-loading { display: flex; align-items: center; gap: 8px; color: #6b5a8a; font-size: 13.5px; padding: 14px 4px; }
.cgm-loading svg { color: var(--color-unergy-purple); }
.cgm-empty { color: #9ca3af; font-size: 13px; padding: 20px 4px; text-align: center; }

.cgm-card {
  display: flex; align-items: flex-start; gap: 10px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 14px;
  padding: 11px 12px; margin-bottom: 9px;
}
.cgm-check { flex-shrink: 0; padding-top: 2px; }
.cgm-check input { width: 18px; height: 18px; accent-color: var(--color-unergy-purple); }
.cgm-card-main { flex: 1; min-width: 0; }

.cgm-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.cgm-pill { font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.cgm-pill--or { background: rgba(145,91,216,0.12); color: var(--color-unergy-purple-dark); }
.cgm-pill--cliente { background: rgba(16,185,129,0.12); color: #059669; }
.cgm-proj-count { display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #9b8db5; flex-shrink: 0; }
.cgm-chev { font-size: 9px; transition: transform .12s ease; }
.cgm-chev--open { transform: rotate(180deg); }

.cgm-nombre { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); margin-bottom: 4px; }
.cgm-nombre--muted { font-style: italic; font-weight: 500; color: #c4b8d4; }

.cgm-correos { display: inline-block; font-size: 12.5px; font-weight: 600; color: var(--color-unergy-purple-dark); text-decoration: underline; }
.cgm-correos--bad { color: #D64455; }
.cgm-correos--muted { color: #c4b8d4; text-decoration: none; font-style: italic; }

.cgm-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.cgm-chip {
  font-family: inherit; font-size: 11px; padding: 3px 8px; border-radius: 7px;
  background: #f9f7ff; border: 1px solid #eceaf2; color: #6b5a8a; transition: opacity .12s ease;
}
.cgm-chip--on { background: var(--color-unergy-purple); border-color: var(--color-unergy-purple); color: #fff; }
.cgm-chip--dim { color: #c4b8d4; }
.cgm-clear-sel {
  display: block; margin: 0 0 6px auto; font-family: inherit;
  font-size: 11px; font-weight: 700; color: var(--color-unergy-purple); text-decoration: underline;
}

.cgm-bottom-space { height: 74px; }

.cgm-send-bar {
  position: absolute; left: 0; right: 0; bottom: calc(56px + env(safe-area-inset-bottom));
  padding: 10px 13px; background: linear-gradient(to top, #f3f4f6 70%, transparent);
}
.cgm-send-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--color-unergy-purple); color: #fff; font-size: 14px; font-weight: 700;
  border: none; border-radius: 12px; padding: 13px 0; box-shadow: 0 4px 14px rgba(145,91,216,0.35);
}
.cgm-send-btn:disabled { opacity: .4; box-shadow: none; }
</style>
