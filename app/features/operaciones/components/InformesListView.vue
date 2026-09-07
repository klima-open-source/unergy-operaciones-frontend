<template>
  <div class="inf-page">

    <!-- ══ Hero Header ══════════════════════════════════════════════ -->
    <div class="inf-hero">
      <div class="inf-hero-left">
        <h1 class="inf-hero-title">Informes</h1>
        <p class="inf-hero-sub">Informes operacionales y FMO · equipo Unergy</p>
      </div>
      <button class="inf-refresh-btn" :disabled="loading" @click="cargar" title="Actualizar">
        <span :class="loading ? 'spin-icon' : ''">↻</span>
        Actualizar
      </button>
    </div>

    <!-- ══ KPIs ═════════════════════════════════════════════════════ -->
    <div class="inf-kpis">
      <button
        class="kpi-card kpi-total"
        :class="{ 'kpi-active': !filtroEstado }"
        @click="setFiltroEstado('')"
      >
        <span class="kpi-num">{{ todosLoaded.length }}</span>
        <span class="kpi-label">Total</span>
      </button>
      <button
        class="kpi-card kpi-borrador"
        :class="{ 'kpi-active': filtroEstado === 'borrador' }"
        @click="setFiltroEstado('borrador')"
      >
        <span class="kpi-num">{{ kpis.borrador }}</span>
        <span class="kpi-label">Borrador</span>
      </button>
      <button
        class="kpi-card kpi-revisado"
        :class="{ 'kpi-active': filtroEstado === 'revisado' }"
        @click="setFiltroEstado('revisado')"
      >
        <span class="kpi-num">{{ kpis.revisado }}</span>
        <span class="kpi-label">Revisado</span>
      </button>
      <button
        class="kpi-card kpi-aprobado"
        :class="{ 'kpi-active': filtroEstado === 'aprobado' }"
        @click="setFiltroEstado('aprobado')"
      >
        <span class="kpi-num">{{ kpis.aprobado }}</span>
        <span class="kpi-label">Aprobado</span>
      </button>
    </div>

    <!-- ══ Filtros ═══════════════════════════════════════════════════ -->
    <div class="inf-filtros-bar">
      <div class="inf-filtros-group">
        <label class="inf-filtro-label">Año</label>
        <select v-model="filtroAnio" class="inf-select">
          <option value="">Todos</option>
          <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <div class="inf-filtros-group">
        <label class="inf-filtro-label">Mes</label>
        <select v-model="filtroMes" class="inf-select">
          <option value="">Todos</option>
          <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.label }}</option>
        </select>
      </div>
      <div class="inf-filtros-group">
        <label class="inf-filtro-label">Estado</label>
        <select v-model="filtroEstado" class="inf-select">
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="revisado">Revisado</option>
          <option value="aprobado">Aprobado</option>
        </select>
      </div>
      <button v-if="filtroAnio || filtroMes || filtroEstado" class="inf-clear-btn" @click="limpiarFiltros">
        ✕ Limpiar filtros
      </button>

      <!-- contador -->
      <span class="inf-count-label" v-if="!loading">
        {{ informesFiltrados.length }} resultado{{ informesFiltrados.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- ══ Loading ═══════════════════════════════════════════════════ -->
    <div v-if="loading" class="inf-loading">
      <div class="spin-ring" />
      <span>Cargando informes…</span>
    </div>

    <!-- ══ Error ═════════════════════════════════════════════════════ -->
    <div v-else-if="error" class="inf-error-box">
      <span class="inf-error-icon">⚠️</span>
      <div>
        <div class="inf-error-title">Error al cargar informes</div>
        <div class="inf-error-msg">{{ error }}</div>
      </div>
      <button class="inf-refresh-btn" @click="cargar">Reintentar</button>
    </div>

    <!-- ══ Empty ═════════════════════════════════════════════════════ -->
    <div v-else-if="!informesFiltrados.length" class="inf-empty">
      <div class="inf-empty-icon">📄</div>
      <div class="inf-empty-title">
        {{ (filtroAnio || filtroMes || filtroEstado) ? 'Sin resultados para los filtros aplicados' : 'No hay informes guardados' }}
      </div>
      <div class="inf-empty-sub">
        {{ (filtroAnio || filtroMes || filtroEstado) ? 'Prueba con otros filtros' : 'Genera un informe desde Monitoreo Fallas' }}
      </div>
      <button v-if="filtroAnio || filtroMes || filtroEstado" class="inf-clear-btn" style="margin-top:12px" @click="limpiarFiltros">
        ✕ Limpiar filtros
      </button>
    </div>

    <!-- ══ Lista ═════════════════════════════════════════════════════ -->
    <div v-else class="inf-table-wrapper">
      <table class="inf-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Proyecto</th>
            <th>Tipo</th>
            <th>Periodo</th>
            <th>Última edición</th>
            <th>Aprobado por</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="inf in informesFiltrados"
            :key="inf.id"
            class="inf-row"
            @click="abrirInforme(inf.id)"
          >
            <td>
              <span :class="['estado-pill', 'pill-' + inf.estado]">
                {{ estadoLabel(inf.estado) }}
              </span>
            </td>
            <td class="td-proyecto">
              <div class="td-nombre">{{ inf.proyecto_nombre || inf.sub_project }}</div>
              <div class="td-sub" v-if="inf.proyecto_nombre && inf.sub_project !== inf.proyecto_nombre">{{ inf.sub_project }}</div>
            </td>
            <td>
              <span class="tipo-tag">{{ tipoLabel(inf.tipo) }}</span>
            </td>
            <td class="td-periodo">
              {{ inf.periodo_display || formatPeriodo(inf.periodo_desde) }}
              <span v-if="inf.correo_enviado" class="enviado-dot" title="Correo enviado">📧</span>
            </td>
            <td class="td-fecha">
              <div>{{ inf.editado_en ? formatFecha(inf.editado_en) : '—' }}</div>
              <div class="td-autor" v-if="inf.editado_por_nombre">{{ inf.editado_por_nombre }}</div>
            </td>
            <td class="td-fecha">
              <div v-if="inf.aprobado_por_nombre" class="td-autor">{{ inf.aprobado_por_nombre }}</div>
              <div v-else class="td-empty">—</div>
            </td>
            <td class="td-acciones" @click.stop>
              <button class="action-btn action-open" @click="abrirInforme(inf.id)" title="Abrir informe">
                →
              </button>
              <button
                v-if="inf.estado !== 'aprobado'"
                class="action-btn action-del"
                :title="`Eliminar ${inf.proyecto_nombre || inf.sub_project}`"
                @click="eliminarInforme(inf)"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { InformesService } from '~/features/operaciones/services/informes'

const informesService = new InformesService()

const router = useRouter()

const todosLoaded  = ref([])
const loading      = ref(false)
const error        = ref(null)
const filtroEstado = ref('')
const filtroAnio   = ref('')
const filtroMes    = ref('')

const meses = [
  { v: '01', label: 'Enero' },   { v: '02', label: 'Febrero' },
  { v: '03', label: 'Marzo' },   { v: '04', label: 'Abril' },
  { v: '05', label: 'Mayo' },    { v: '06', label: 'Junio' },
  { v: '07', label: 'Julio' },   { v: '08', label: 'Agosto' },
  { v: '09', label: 'Septiembre' }, { v: '10', label: 'Octubre' },
  { v: '11', label: 'Noviembre' }, { v: '12', label: 'Diciembre' },
]

const kpis = computed(() => ({
  borrador: todosLoaded.value.filter(i => i.estado === 'borrador').length,
  revisado: todosLoaded.value.filter(i => i.estado === 'revisado').length,
  aprobado: todosLoaded.value.filter(i => i.estado === 'aprobado').length,
}))

const aniosDisponibles = computed(() => {
  const set = new Set()
  todosLoaded.value.forEach(i => { if (i.periodo_desde) set.add(i.periodo_desde.slice(0, 4)) })
  return [...set].sort((a, b) => b - a)
})

const informesFiltrados = computed(() =>
  todosLoaded.value.filter(i => {
    if (filtroEstado.value && i.estado !== filtroEstado.value) return false
    if (filtroAnio.value && (!i.periodo_desde || !i.periodo_desde.startsWith(filtroAnio.value))) return false
    if (filtroMes.value && (!i.periodo_desde || i.periodo_desde.slice(5, 7) !== filtroMes.value)) return false
    return true
  })
)

function setFiltroEstado(val) {
  // toggle: si ya está activo, lo quita
  filtroEstado.value = filtroEstado.value === val ? '' : val
}

async function cargar() {
  loading.value = true
  error.value = null
  try {
    todosLoaded.value = await informesService.listar({ limit: 200 })
  } catch (e) {
    error.value = e.data?.detail || e.message
  } finally {
    loading.value = false
  }
}

function limpiarFiltros() {
  filtroEstado.value = ''; filtroAnio.value = ''; filtroMes.value = ''
}

function abrirInforme(id) { router.push(`/informes/${id}`) }

async function eliminarInforme(inf) {
  const nombre = inf.proyecto_nombre || inf.sub_project
  const periodo = inf.periodo_display || inf.periodo_desde || ''
  if (!confirm(`¿Eliminar el informe "${nombre} · ${periodo}"?\n\nEsta acción no se puede deshacer.`)) return
  try {
    await informesService.eliminar(inf.id)
    todosLoaded.value = todosLoaded.value.filter(i => i.id !== inf.id)
  } catch (e) {
    alert('⚠️ ' + (e.data?.detail || e.message))
  }
}

function estadoLabel(e) {
  return { borrador: 'Borrador', revisado: 'Revisado', aprobado: 'Aprobado' }[e] || e
}
function tipoLabel(t) {
  return { op: 'Operacional', fmo: 'FMO', port: 'Portafolio' }[t] || (t || '—').toUpperCase()
}
function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatPeriodo(iso) {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  const mes = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][+m] || m
  return `${mes} ${y}`
}

onMounted(cargar)
</script>

<style scoped>
/* ── Página ─────────────────────────────────────────────────────── */
.inf-page {
  min-height: 100%;
  background: #f8f7fa;
  padding: 0;
  font-family: 'Sora', system-ui, sans-serif;
}

/* ── Hero ───────────────────────────────────────────────────────── */
.inf-hero {
  background: linear-gradient(135deg, var(--color-unergy-deep) 0%, #3d2b52 60%, #4a2d6e 100%);
  padding: 28px 32px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(145,91,216,.2);
}
.inf-hero-title {
  font-size: 24px;
  font-weight: 900;
  color: var(--color-unergy-avena);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}
.inf-hero-sub {
  font-size: 13px;
  color: rgba(253,250,247,.55);
  margin: 0;
}

/* ── KPIs ───────────────────────────────────────────────────────── */
.inf-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-bottom: 1px solid #e5e2ec;
}
@media (max-width: 640px) { .inf-kpis { grid-template-columns: repeat(2, 1fr); } }

.kpi-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  border: none;
  background: #fff;
  cursor: pointer;
  transition: background .15s;
  border-right: 1px solid #e5e2ec;
  position: relative;
  font-family: inherit;
}
.kpi-card:last-child { border-right: none; }
.kpi-card:hover { background: #f4f1fa; }

.kpi-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  opacity: 0;
  transition: opacity .15s;
}
.kpi-card.kpi-active::after { opacity: 1; }
.kpi-card.kpi-active { background: #f9f7ff; }

.kpi-total::after    { background: var(--color-unergy-purple); }
.kpi-borrador::after { background: #d4a017; }
.kpi-revisado::after { background: #2563EB; }
.kpi-aprobado::after { background: #16a34a; }

.kpi-num {
  font-size: 32px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 5px;
}
.kpi-total    .kpi-num { color: #6d28d9; }
.kpi-borrador .kpi-num { color: #d4a017; }
.kpi-revisado .kpi-num { color: #2563EB; }
.kpi-aprobado .kpi-num { color: #16a34a; }

.kpi-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: #9ca3af;
}
.kpi-card.kpi-active .kpi-label { color: #6b7280; }

/* ── Filtros ────────────────────────────────────────────────────── */
.inf-filtros-bar {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 32px;
  background: #fff;
  border-bottom: 1px solid #e5e2ec;
}
.inf-filtros-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.inf-filtro-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #9ca3af;
}
.inf-select {
  background: #fff;
  border: 1.5px solid #e5e2ec;
  border-radius: 8px;
  padding: 7px 12px;
  color: var(--color-unergy-deep);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  min-width: 130px;
  transition: border-color .15s;
}
.inf-select:focus { border-color: var(--color-unergy-purple); }

.inf-clear-btn {
  background: transparent;
  border: 1.5px solid #e5e2ec;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
  align-self: flex-end;
}
.inf-clear-btn:hover { border-color: var(--color-unergy-purple); color: #6d28d9; }

.inf-count-label {
  margin-left: auto;
  align-self: flex-end;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
}

/* ── Refresh btn ────────────────────────────────────────────────── */
.inf-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 8px;
  padding: 8px 16px;
  color: var(--color-unergy-avena);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background .15s;
}
.inf-refresh-btn:hover:not(:disabled) { background: rgba(255,255,255,.2); }
.inf-refresh-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── Loading ─────────────────────────────────────────────────────── */
.inf-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 80px 32px;
  color: #9ca3af;
  font-size: 13px;
}
.spin-ring {
  width: 32px; height: 32px;
  border: 3px solid #e5e2ec;
  border-top-color: var(--color-unergy-purple);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.spin-icon { display: inline-block; animation: spin .8s linear infinite; }

/* ── Error ───────────────────────────────────────────────────────── */
.inf-error-box {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 32px;
  background: #fff5f5;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 16px 20px;
}
.inf-error-icon { font-size: 22px; flex-shrink: 0; }
.inf-error-title { font-size: 13px; font-weight: 700; color: #dc2626; margin-bottom: 2px; }
.inf-error-msg { font-size: 12px; color: #ef4444; }

/* ── Empty ───────────────────────────────────────────────────────── */
.inf-empty {
  text-align: center;
  padding: 80px 32px;
}
.inf-empty-icon { font-size: 48px; margin-bottom: 14px; opacity: .3; }
.inf-empty-title { font-size: 16px; font-weight: 700; color: #6b7280; margin-bottom: 6px; }
.inf-empty-sub { font-size: 13px; color: #9ca3af; }

/* ── Tabla ───────────────────────────────────────────────────────── */
.inf-table-wrapper {
  padding: 24px 32px;
  overflow-x: auto;
}
.inf-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04);
}
.inf-table thead tr {
  background: #f8f7fa;
  border-bottom: 2px solid #e5e2ec;
}
.inf-table thead th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #9ca3af;
  white-space: nowrap;
}
.inf-row {
  border-bottom: 1px solid #f0edf7;
  cursor: pointer;
  transition: background .12s;
}
.inf-row:last-child { border-bottom: none; }
.inf-row:hover { background: #f9f7ff; }
.inf-row td {
  padding: 13px 16px;
  vertical-align: middle;
}

.td-proyecto { min-width: 180px; }
.td-nombre {
  font-size: 13px;
  font-weight: 700;
  color: #1a1025;
}
.td-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}
.td-periodo {
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
}
.td-fecha { min-width: 120px; }
.td-fecha > div:first-child { font-size: 12px; color: #374151; }
.td-autor { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.td-empty { color: #d1d5db; font-size: 13px; }

/* Estado pills */
.estado-pill {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 20px;
  letter-spacing: .4px;
  white-space: nowrap;
  text-transform: uppercase;
}
.pill-borrador { background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
.pill-revisado { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
.pill-aprobado { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

/* Tipo tag */
.tipo-tag {
  font-size: 11px;
  font-weight: 700;
  background: #f3f0ff;
  color: #7c3aed;
  border: 1px solid #e9d5ff;
  border-radius: 5px;
  padding: 2px 7px;
}

.enviado-dot { margin-left: 5px; font-size: 12px; }

/* Acciones */
.td-acciones {
  width: 80px;
  white-space: nowrap;
}
.action-btn {
  background: transparent;
  border: 1px solid #e5e2ec;
  border-radius: 6px;
  padding: 4px 9px;
  cursor: pointer;
  font-size: 13px;
  transition: all .14s;
  font-family: inherit;
}
.action-open { color: #6d28d9; margin-right: 4px; font-weight: 800; }
.action-open:hover { background: #f3f0ff; border-color: #7c3aed; }
.action-del { color: #ef4444; }
.action-del:hover { background: #fff5f5; border-color: #ef4444; }
</style>
