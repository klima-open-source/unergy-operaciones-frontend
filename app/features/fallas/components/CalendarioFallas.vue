<template>
  <div class="cal-root">

    <!-- ── Filtros + navegación ─────────────────────────────────────────── -->
    <div class="cal-toolbar">
      <div class="cal-nav">
        <button class="cal-nav-btn" @click="mesAnterior"><ChevronLeftIcon class="size-[1em]" /></button>
        <span class="cal-mes-label">{{ mesLabel }}</span>
        <button class="cal-nav-btn" @click="mesSiguiente"><ChevronRightIcon class="size-[1em]" /></button>
        <button class="cal-hoy-btn" @click="irAHoy">Hoy</button>
      </div>

      <div class="cal-filtros">
        <Select v-model="filtroProyecto" :options="proyectos" optionLabel="nombre_comercial"
          optionValue="id" placeholder="Proyecto" showClear filter class="cal-select" size="small" />
        <Select v-model="filtroEstado" :options="estados" optionLabel="etiqueta"
          optionValue="codigo" placeholder="Estado" showClear class="cal-select" size="small" />
        <button v-if="hayFiltros" class="cal-clear-btn" @click="limpiarFiltros">
          <XIcon class="size-[1em]" /> Limpiar
        </button>
      </div>

      <div class="cal-kpis">
        <span class="cal-kpi">
          <span class="cal-kpi-num" style="color:#9CA3AF">{{ kpiMes.pendientes }}</span>
          <span class="cal-kpi-lbl">pendientes</span>
        </span>
        <span class="cal-kpi">
          <span class="cal-kpi-num" style="color:var(--color-unergy-purple)">{{ kpiMes.ejecutadas }}</span>
          <span class="cal-kpi-lbl">ejecutadas</span>
        </span>
        <span class="cal-kpi">
          <span class="cal-kpi-num">{{ kpiMes.total }}</span>
          <span class="cal-kpi-lbl">este mes</span>
        </span>
      </div>
    </div>

    <!-- ── Leyenda ─────────────────────────────────────────────────────────── -->
    <div class="cal-leyenda">
      <span class="cal-ley-item">
        <span class="cal-ley-dot" style="background:#9CA3AF" />
        Programada (pendiente)
      </span>
      <span class="cal-ley-item">
        <span class="cal-ley-dot" style="background:var(--color-unergy-purple)" />
        Ejecutada / Cerrada
      </span>
      <span class="cal-ley-item">
        <span class="cal-ley-dot" style="background:#EF4444" />
        Abierta
      </span>
      <span class="cal-ley-item">
        <span class="cal-ley-dot" style="background:#F97316" />
        En gestión
      </span>
      <span class="cal-ley-item">
        <span class="cal-ley-dot" style="background:#EAB308" />
        En espera
      </span>
    </div>

    <!-- ── Loading ─────────────────────────────────────────────────────── -->
    <div v-if="loading" class="cal-loading">
      <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:24px;color:var(--color-unergy-purple)" />
      <span>Cargando fallas...</span>
    </div>

    <!-- ── Grilla del calendario ────────────────────────────────────────── -->
    <div v-else class="cal-grid-wrap">
      <!-- Cabecera días -->
      <div class="cal-week-header">
        <div v-for="d in DIAS" :key="d" class="cal-weekday">{{ d }}</div>
      </div>

      <!-- Celda de días -->
      <div class="cal-grid">
        <div
          v-for="cell in celdas" :key="cell.key"
          :class="['cal-cell',
            !cell.esDelMes && 'cal-cell--fuera',
            cell.esHoy && 'cal-cell--hoy',
            cell.eventos.length > 0 && 'cal-cell--con-eventos'
          ]"
        >
          <span class="cal-cell-num">{{ cell.dia }}</span>

          <div class="cal-eventos-list">
            <div
              v-for="ev in cell.eventos.slice(0, 3)" :key="ev.id"
              :class="['cal-evento', esFinal(ev) && 'cal-evento--final']"
              :style="{ background: estadoColor(ev.estado?.codigo) + '18', borderLeft: `3px solid ${estadoColor(ev.estado?.codigo)}` }"
              @click="abrirDetalle(ev)"
              :title="`[${ev.estado?.etiqueta}] ${ev.proyecto?.nombre_comercial} — ${ev.descripcion}`"
            >
              <CircleCheckIcon class="cal-evento-icon size-[1em]" v-if="esFinal(ev)" style="color:var(--color-unergy-purple)" />
              <ClockIcon class="cal-evento-icon size-[1em]" v-else style="color:#9CA3AF" />
              <span class="cal-evento-nombre">{{ ev.proyecto?.nombre_comercial }}</span>
            </div>
            <div v-if="cell.eventos.length > 3" class="cal-evento-mas"
              @click="abrirListaDia(cell)">
              +{{ cell.eventos.length - 3 }} más
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal detalle falla ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="detalle" class="cal-modal-backdrop" @click.self="detalle = null">
        <div class="cal-modal">
          <div class="cal-modal-header">
            <div class="cal-modal-title">
              <span class="cal-modal-code">{{ detalle.codigo_interno }}</span>
              <span class="cal-estado-badge"
                :style="{ background: estadoColor(detalle.estado?.codigo) + '22', color: estadoColor(detalle.estado?.codigo), border: `1px solid ${estadoColor(detalle.estado?.codigo)}40` }">
                {{ detalle.estado?.etiqueta }}
              </span>
            </div>
            <button class="cal-modal-close" @click="detalle = null"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="cal-modal-body">
            <div class="cal-detail-grid">
              <div class="cal-detail-item">
                <span class="cal-detail-lbl"><ZapIcon class="size-[1em]" /> Proyecto</span>
                <span class="cal-detail-val">{{ detalle.proyecto?.nombre_comercial }}</span>
              </div>
              <div class="cal-detail-item">
                <span class="cal-detail-lbl"><CalendarIcon class="size-[1em]" /> Fecha programada</span>
                <span class="cal-detail-val cal-detail-val--highlight">{{ detalle.fecha_programada ?? '—' }}</span>
              </div>
              <div class="cal-detail-item">
                <span class="cal-detail-lbl"><FlagIcon class="size-[1em]" /> Prioridad</span>
                <span class="cal-detail-val">
                  <span class="cal-prio-dot" :style="{ background: prioColor(detalle.prioridad?.codigo) }" />
                  {{ detalle.prioridad?.etiqueta }}
                </span>
              </div>
              <div class="cal-detail-item cal-detail-item--full">
                <span class="cal-detail-lbl"><AlignLeftIcon class="size-[1em]" /> Descripción</span>
                <p class="cal-detail-desc">{{ detalle.descripcion }}</p>
              </div>
              <div v-if="detalle.causa_raiz" class="cal-detail-item cal-detail-item--full">
                <span class="cal-detail-lbl"><SearchIcon class="size-[1em]" /> Causa raíz</span>
                <p class="cal-detail-desc">{{ detalle.causa_raiz }}</p>
              </div>
              <div v-if="detalle.acciones_correctivas" class="cal-detail-item cal-detail-item--full">
                <span class="cal-detail-lbl"><SquareCheckIcon class="size-[1em]" /> Acciones correctivas</span>
                <p class="cal-detail-desc">{{ detalle.acciones_correctivas }}</p>
              </div>
              <div class="cal-detail-item">
                <span class="cal-detail-lbl"><CalendarClockIcon class="size-[1em]" /> Identificado</span>
                <span class="cal-detail-val">{{ detalle.fecha_identificacion }}</span>
              </div>
              <div class="cal-detail-item">
                <span class="cal-detail-lbl"><ClockIcon class="size-[1em]" /> SLA</span>
                <span class="cal-detail-val">{{ detalle.sla_limite_horas_efectivo }}h ({{ detalle.sla_limite_dias }}d)</span>
              </div>
            </div>
          </div>

          <div class="cal-modal-footer">
            <button class="cal-modal-link" @click="irAFalla(detalle)">
              <ArrowRightIcon class="size-[1em]" /> Ver en Gestión de Fallas
            </button>
            <button class="cal-modal-edit" @click="emitEditar(detalle)">
              <PencilIcon class="size-[1em]" /> Editar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal lista día ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="diaModal" class="cal-modal-backdrop" @click.self="diaModal = null">
        <div class="cal-modal cal-modal--sm">
          <div class="cal-modal-header">
            <div class="cal-modal-title">
              Fallas — {{ diaModal.label }}
            </div>
            <button class="cal-modal-close" @click="diaModal = null"><XIcon class="size-[1em]" /></button>
          </div>
          <div class="cal-modal-body">
            <div v-for="ev in diaModal.eventos" :key="ev.id"
              class="cal-dia-row"
              @click="abrirDetalle(ev); diaModal = null">
              <span class="cal-dia-dot" :style="{ background: estadoColor(ev.estado?.codigo) }" />
              <div>
                <div class="cal-dia-code">{{ ev.codigo_interno }}</div>
                <div class="cal-dia-proy">{{ ev.proyecto?.nombre_comercial }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import { FallasService } from '~/features/fallas/services/fallas'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { AlignLeftIcon, ArrowRightIcon, CalendarClockIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, ClockIcon, FlagIcon, LoaderCircleIcon, PencilIcon, SearchIcon, SquareCheckIcon, XIcon, ZapIcon } from '@lucide/vue'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  // Incrementado por el padre cada vez que se guarda una falla → recarga automática
  refreshKey: { type: Number, default: 0 },
})
const emit = defineEmits(['editar', 'ver-falla'])

// ── Estado ───────────────────────────────────────────────────────────────────
const loading    = ref(false)
const fallas     = ref([])
const proyectos  = ref([])
const estados    = ref([])
const detalle    = ref(null)
const diaModal   = ref(null)

const hoy = new Date()
const mesActual  = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

const filtroProyecto = ref(null)
const filtroEstado   = ref(null)

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── Colores ───────────────────────────────────────────────────────────────────
// Fallas EJECUTADAS (estado final) → morado plataforma #915BD8
// Fallas PENDIENTES (programado)   → gris #9CA3AF
// Otros estados activos            → colores propios
const ESTADO_COLORES = {
  cerrada:      '#915BD8',   // morado plataforma = ejecutada
  sin_solucion: '#915BD8',   // también final, mismo color
  programado:   '#9CA3AF',   // gris = pendiente / por ejecutar
  abierta:      '#EF4444',
  en_gestion:   '#F97316',
  en_espera:    '#EAB308',
}
const PRIO_COLORES = {
  critica: '#DC2626',
  grave:   '#EA580C',
  media:   '#CA8A04',
  leve:    '#16A34A',
}

function estadoColor(codigo) {
  // Si el estado viene del servidor con es_estado_final=true pero no está mapeado,
  // también usamos el morado para indicar "ejecutada"
  return ESTADO_COLORES[codigo] ?? '#915BD8'
}
function esFinal(falla) {
  return falla?.estado?.es_estado_final === true
}
function prioColor(codigo) { return PRIO_COLORES[codigo] ?? '#915BD8' }

// ── Computed ─────────────────────────────────────────────────────────────────
const mesLabel = computed(() => {
  return mesActual.value.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
})

const hayFiltros = computed(() =>
  filtroProyecto.value || filtroEstado.value
)

const eventosFiltrados = computed(() => {
  let list = fallas.value
  if (filtroProyecto.value) list = list.filter(f => f.proyecto_id === filtroProyecto.value)
  if (filtroEstado.value)   list = list.filter(f => f.estado?.codigo === filtroEstado.value)
  return list
})

const eventosMes = computed(() => {
  const año  = mesActual.value.getFullYear()
  const mes  = mesActual.value.getMonth()
  return eventosFiltrados.value.filter(f => {
    if (!f.fecha_programada) return false
    const d = new Date(f.fecha_programada + 'T00:00:00')
    return d.getFullYear() === año && d.getMonth() === mes
  })
})

// KPIs del mes visible
const kpiMes = computed(() => ({
  pendientes: eventosMes.value.filter(f => !esFinal(f)).length,
  ejecutadas: eventosMes.value.filter(f =>  esFinal(f)).length,
  total:      eventosMes.value.length,
}))

const celdas = computed(() => {
  const año  = mesActual.value.getFullYear()
  const mes  = mesActual.value.getMonth()
  const primer = new Date(año, mes, 1)
  const offsetLun = (primer.getDay() + 6) % 7
  const ultimoDia = new Date(año, mes + 1, 0).getDate()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

  const cells = []
  for (let i = offsetLun - 1; i >= 0; i--) {
    const d = new Date(año, mes, -i)
    cells.push({ key: `prev-${i}`, dia: d.getDate(), esDelMes: false, esHoy: false, eventos: [], label: '' })
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const dStr = `${año}-${String(mes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const eventos = eventosMes.value.filter(f => f.fecha_programada === dStr)
    cells.push({
      key: dStr, dia: d, esDelMes: true, esHoy: dStr === hoyStr,
      eventos,
      label: new Date(dStr + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
    })
  }
  const resto = (7 - cells.length % 7) % 7
  for (let i = 1; i <= resto; i++) {
    cells.push({ key: `next-${i}`, dia: i, esDelMes: false, esHoy: false, eventos: [], label: '' })
  }
  return cells
})

// ── Navegación ────────────────────────────────────────────────────────────────
function mesAnterior()  { const m = mesActual.value; mesActual.value = new Date(m.getFullYear(), m.getMonth() - 1, 1) }
function mesSiguiente() { const m = mesActual.value; mesActual.value = new Date(m.getFullYear(), m.getMonth() + 1, 1) }
function irAHoy()       { mesActual.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1) }
function limpiarFiltros() { filtroProyecto.value = null; filtroEstado.value = null }

// ── Acciones ──────────────────────────────────────────────────────────────────
function abrirDetalle(falla) { detalle.value = falla }
function abrirListaDia(cell) { diaModal.value = { label: cell.label, eventos: cell.eventos } }
function irAFalla(falla)     { emit('ver-falla', falla); detalle.value = null }
function emitEditar(falla)   { emit('editar', falla);    detalle.value = null }

// ── Carga de datos ────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const [resFallas, listaProyectos, catalogos] = await Promise.all([
      // Traer TODAS las fallas con fecha_programada (programadas + ejecutadas = historial completo)
      fallasService.listar({ size: 5000, con_fecha_programada: true }),
      proyectosService.listar({ size: 500 }),
      fallasService.obtenerCatalogos(),
    ])
    fallas.value    = resFallas.items ?? []
    proyectos.value = listaProyectos
    estados.value   = catalogos.estados ?? []
  } finally {
    loading.value = false
  }
}

// Recarga automática cuando el padre guarda una falla
watch(() => props.refreshKey, (newVal, oldVal) => {
  if (newVal !== oldVal) cargar()
})

onMounted(cargar)
</script>

<style scoped>
.cal-root {
  display: flex; flex-direction: column; gap: 16px;
  padding: 20px; font-family: 'Sora', system-ui, sans-serif;
  min-height: 0; flex: 1;
}

/* ── Toolbar ── */
.cal-toolbar {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  background: #fff; border: 1px solid #e9e6f5; border-radius: 12px;
  padding: 12px 16px;
}
.cal-nav { display: flex; align-items: center; gap: 8px; }
.cal-nav-btn {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; cursor: pointer; font-size: 12px; color: #6b7280;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.cal-nav-btn:hover { background: #f3f4f6; color: #374151; }
.cal-mes-label { font-size: 15px; font-weight: 800; color: var(--color-unergy-deep); min-width: 160px; text-align: center; }
.cal-hoy-btn {
  padding: 4px 12px; border-radius: 6px; border: 1px solid var(--color-unergy-purple);
  background: #fff; color: var(--color-unergy-purple); font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.cal-hoy-btn:hover { background: #f5f0ff; }

.cal-filtros { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; }
.cal-select { min-width: 130px !important; }
.cal-clear-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 6px; border: none;
  background: #f3f4f6; color: #6b7280; font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: inherit;
}

.cal-kpis { display: flex; gap: 16px; margin-left: auto; }
.cal-kpi { display: flex; flex-direction: column; align-items: center; }
.cal-kpi-num { font-size: 18px; font-weight: 800; color: var(--color-unergy-deep); line-height: 1.2; }
.cal-kpi-lbl { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }

/* ── Loading ── */
.cal-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: #6b7280; font-size: 14px; }

/* ── Grid ── */
.cal-grid-wrap { display: flex; flex-direction: column; background: #fff; border: 1px solid #e9e6f5; border-radius: 12px; overflow: hidden; }

.cal-week-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  background: #f9f8ff; border-bottom: 1px solid #e9e6f5;
}
.cal-weekday {
  padding: 8px 0; text-align: center;
  font-size: 11px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.5px; color: #7c6a9a;
}

.cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr);
}

.cal-cell {
  min-height: 110px; padding: 6px 8px;
  border-right: 1px solid #f3f1f8; border-bottom: 1px solid #f3f1f8;
  display: flex; flex-direction: column; gap: 3px;
  transition: background 0.15s;
}
.cal-cell:nth-child(7n) { border-right: none; }
.cal-cell--fuera { background: #fafafa; }
.cal-cell--fuera .cal-cell-num { color: #d1d5db; }
.cal-cell--hoy { background: #faf5ff; }
.cal-cell--hoy .cal-cell-num {
  background: var(--color-unergy-purple); color: #fff; border-radius: 50%;
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  font-weight: 800;
}
.cal-cell--con-eventos { background: #fdfcff; }

.cal-cell-num {
  font-size: 12px; font-weight: 700; color: #374151;
  line-height: 1; margin-bottom: 2px; align-self: flex-start;
}

/* ── Leyenda ── */
.cal-leyenda {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  background: #fff; border: 1px solid #e9e6f5; border-radius: 10px;
  padding: 8px 16px;
}
.cal-ley-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; font-weight: 500; }
.cal-ley-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ── Eventos ── */
.cal-eventos-list { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: hidden; }
.cal-evento {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 6px; border-radius: 4px;
  cursor: pointer; transition: opacity 0.15s;
  overflow: hidden;
}
.cal-evento:hover { opacity: 0.82; }
.cal-evento--final { opacity: 0.9; }
.cal-evento-icon { font-size: 9px; flex-shrink: 0; }
.cal-evento-nombre {
  font-size: 10px; font-weight: 600; color: #374151;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.cal-evento--final .cal-evento-nombre { color: #6b7280; text-decoration: line-through; text-decoration-color: #c4b5e0; }
.cal-evento-mas {
  font-size: 10px; font-weight: 700; color: var(--color-unergy-purple);
  cursor: pointer; padding: 1px 4px; border-radius: 3px;
}
.cal-evento-mas:hover { background: #f0edf8; }

/* ── Modal backdrop ── */
.cal-modal-backdrop {
  position: fixed; inset: 0; background: rgba(44,32,57,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(2px);
}

/* ── Modal detalle ── */
.cal-modal {
  background: #fff; border-radius: 16px; width: 100%; max-width: 520px;
  max-height: 85vh; overflow-y: auto;
  box-shadow: 0 24px 48px rgba(0,0,0,0.18);
  display: flex; flex-direction: column;
  font-family: 'Sora', system-ui, sans-serif;
}
.cal-modal--sm { max-width: 360px; }

.cal-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px; border-bottom: 1px solid #f3f1f8;
  position: sticky; top: 0; background: #fff; z-index: 1;
}
.cal-modal-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: var(--color-unergy-deep); }
.cal-modal-code { font-size: 13px; font-weight: 800; color: var(--color-unergy-deep); font-family: monospace; }
.cal-modal-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px; padding: 4px; border-radius: 6px; }
.cal-modal-close:hover { color: #6b7280; }

.cal-estado-badge {
  font-size: 11px; font-weight: 700; padding: 2px 10px;
  border-radius: 999px; letter-spacing: 0.3px;
}

.cal-modal-body { padding: 16px 24px; flex: 1; }

.cal-detail-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.cal-detail-item { display: flex; flex-direction: column; gap: 3px; }
.cal-detail-item--full { grid-column: 1 / -1; }
.cal-detail-lbl {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: #9ca3af;
  display: flex; align-items: center; gap: 4px;
}
.cal-detail-val {
  font-size: 13px; font-weight: 600; color: #374151;
  display: flex; align-items: center; gap: 6px;
}
.cal-detail-val--highlight {
  color: #3B82F6; font-weight: 800;
}
.cal-detail-desc {
  font-size: 13px; color: #4b5563; line-height: 1.5; margin: 0;
  background: #f9f8ff; border-radius: 6px; padding: 8px 10px;
}
.cal-prio-dot { width: 8px; height: 8px; border-radius: 50%; }

.cal-modal-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 24px; border-top: 1px solid #f3f1f8;
  position: sticky; bottom: 0; background: #fff;
}
.cal-modal-link {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: 1.5px solid #e5e7eb;
  background: #fff; color: #6b7280; font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.cal-modal-link:hover { border-color: var(--color-unergy-purple); color: var(--color-unergy-purple); }
.cal-modal-edit {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none;
  background: var(--color-unergy-purple); color: #fff; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: background 0.15s;
}
.cal-modal-edit:hover { background: #7c3aed; }

/* ── Modal lista día ── */
.cal-dia-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid #f3f1f8;
  cursor: pointer;
}
.cal-dia-row:hover { background: #faf8ff; border-radius: 6px; padding-inline: 6px; }
.cal-dia-row:last-child { border-bottom: none; }
.cal-dia-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cal-dia-code { font-size: 12px; font-weight: 700; color: var(--color-unergy-deep); font-family: monospace; }
.cal-dia-proy { font-size: 11px; color: #6b7280; }
</style>
