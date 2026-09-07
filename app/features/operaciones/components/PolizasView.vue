<!-- unergy-operaciones-frontend-master/src/views/Operaciones/PolizasView.vue -->
<template>
  <div class="pz-page">

    <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
    <div class="pz-header">
      <div class="flex items-center gap-2">
        <ShieldIcon class="size-[1em]" style="color:#0F9D8C;font-size:16px" />
        <h2 class="pz-title">Pólizas</h2>
        <span class="pz-badge">{{ filas.length }}</span>
      </div>
      <Button outlined size="small" :loading="loading" @click="cargar" class="pz-btn-refresh">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- ══ BANNER 30 DÍAS ═══════════════════════════════════════════════════ -->
    <button v-if="venceEn30.length && filtroEstado !== 'proxima'" class="pz-banner" @click="filtroEstado = 'proxima'">
      <TriangleAlertIcon class="size-[1em]" />
      {{ venceEn30.length }} {{ venceEn30.length === 1 ? 'póliza vence' : 'pólizas vencen' }} en los próximos 30 días
    </button>

    <!-- ══ STATS BAR ════════════════════════════════════════════════════════ -->
    <div class="pz-stats">
      <div class="pz-stat">
        <span class="pz-stat-label">Total pólizas</span>
        <span class="pz-stat-value">{{ conDatos.length }}</span>
      </div>
      <div class="pz-stat-div" />
      <div class="pz-stat">
        <span class="pz-stat-label">Próximas a vencer</span>
        <span class="pz-stat-value" style="color:#B45309">{{ contarPorEstado('proxima') }}</span>
      </div>
      <div class="pz-stat-div" />
      <div class="pz-stat">
        <span class="pz-stat-label">Vencidas</span>
        <span class="pz-stat-value" style="color:#B91C1C">{{ contarPorEstado('vencida') }}</span>
      </div>
      <div class="pz-stat-div" />
      <div class="pz-stat">
        <span class="pz-stat-label">Valor asegurado total</span>
        <span class="pz-stat-value" style="color:#0F9D8C">{{ formatCurrency(totalAsegurado) }}</span>
      </div>
    </div>

    <!-- ══ FILTROS ══════════════════════════════════════════════════════════ -->
    <div class="pz-filters">
      <div class="pz-search-wrap">
        <SearchIcon class="pz-search-ico size-[1em]" />
        <input v-model="busqueda" placeholder="Buscar por proyecto o ciudad…" class="pz-search" />
      </div>
      <Select v-model="filtroTipo" :options="OPCIONES_TIPO" optionLabel="label" optionValue="value"
        placeholder="Tipo" showClear class="pz-sel" size="small" />
      <Select v-model="filtroEstado" :options="OPCIONES_ESTADO" optionLabel="label" optionValue="value"
        placeholder="Estado" showClear class="pz-sel" size="small" />
      <Select v-model="filtroOm" :options="OPCIONES_OM" optionLabel="label" optionValue="value"
        placeholder="Póliza O&M" showClear class="pz-sel" size="small" />
      <button v-if="hayFiltros" class="pz-clear-btn" @click="limpiarFiltros" title="Limpiar filtros">
        <XIcon class="text-[10px] size-[1em]" /> Limpiar
      </button>
    </div>

    <!-- ══ TABLA ════════════════════════════════════════════════════════════ -->
    <div class="pz-table-wrap">
      <table class="pz-table">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Tipo</th>
            <th>Ciudad</th>
            <th>N° Póliza</th>
            <th>Póliza O&M</th>
            <th>Fecha vencimiento</th>
            <th>Valor póliza</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="fila in ordenadas" :key="fila.proyecto_id">
            <tr class="pz-row" @click="toggleExpandir(fila.proyecto_id)">
              <td>{{ fila.nombre_comercial }}</td>
              <td><span class="pz-badge-tipo" :style="estiloTipo(fila.tipo_proyecto)">{{ TIPO_LABELS[fila.tipo_proyecto] || '—' }}</span></td>
              <td>{{ ciudad(fila) }}</td>
              <td>{{ fila.numero_poliza || '—' }}</td>
              <td>{{ fila.numero_poliza ? (fila.poliza_om ? 'Sí' : 'No') : '—' }}</td>
              <td>{{ fila.fecha_vencimiento ? formatFecha(fila.fecha_vencimiento) : '—' }}</td>
              <td>{{ formatCurrency(fila.valor_poliza) }}</td>
              <td><span class="pz-badge-estado" :style="estiloEstado(estadoDe(fila))">{{ ESTADO_LABELS[estadoDe(fila)] }}</span></td>
              <td>
                <button class="pz-btn-editar" @click.stop="abrirEdicion(fila)" title="Editar">
                  <PencilIcon class="size-[1em]" />
                </button>
              </td>
            </tr>
            <tr v-if="expandidoId === fila.proyecto_id" class="pz-row-detalle">
              <td colspan="9">
                <div class="pz-detalle-grid">
                  <div class="pz-card">
                    <h4>Datos generales</h4>
                    <p><strong>Ciudad:</strong> {{ ciudad(fila) }}</p>
                    <p><strong>Dirección:</strong> {{ fila.direccion_vereda || '—' }}</p>
                    <p><strong>Estudio de suelos:</strong>
                      <a v-if="fila.link_estudio_suelos" :href="fila.link_estudio_suelos" target="_blank" rel="noopener">Ver enlace</a>
                      <span v-else>—</span>
                    </p>
                  </div>
                  <div class="pz-card">
                    <h4>Detalles del sistema</h4>
                    <p><strong>Paneles:</strong> {{ fila.marca_paneles || '—' }} ({{ fila.cantidad_total_paneles ?? '—' }})</p>
                    <p><strong>Inversores:</strong> {{ fila.marca_inversores || '—' }} ({{ fila.cantidad_inversores ?? '—' }})</p>
                    <p><strong>Capacidad:</strong> {{ fila.capacidad_instalada_kwp != null ? fila.capacidad_instalada_kwp + ' kWp' : '—' }}</p>
                    <p><strong>Operador de red:</strong> {{ fila.operador_red || '—' }}</p>
                    <p><strong>Voltaje de red:</strong> {{ fila.voltaje_red || '—' }}</p>
                    <p><strong>Potencia panel:</strong> {{ fila.potencia_panel_kwp || '—' }}</p>
                    <p><strong>Potencia inversores:</strong> {{ fila.potencia_inversores_kwp || '—' }}</p>
                    <p><strong>Potencia AC:</strong> {{ fila.potencia_ac_kw != null ? fila.potencia_ac_kw + ' kW' : '—' }}</p>
                  </div>
                  <div class="pz-card">
                    <h4>Presupuesto</h4>
                    <p><strong>Mano de obra:</strong> {{ formatCurrency(fila.mano_obra) }}</p>
                    <p><strong>Estructura:</strong> {{ formatCurrency(fila.estructura) }}</p>
                    <p><strong>Paneles:</strong> {{ formatCurrency(fila.paneles) }}</p>
                    <p><strong>Inversores:</strong> {{ formatCurrency(fila.inversores) }}</p>
                    <p><strong>Otros:</strong> {{ formatCurrency(fila.otros) }}</p>
                    <p><strong>Valor total del proyecto:</strong> {{ formatCurrency(fila.valor_total_proyecto) }}</p>
                    <p><strong>Valor lucro cesante:</strong> {{ formatCurrency(fila.valor_lucro_cesante) }}</p>
                  </div>
                  <div class="pz-card">
                    <h4>Póliza</h4>
                    <p><strong>N° póliza:</strong> {{ fila.numero_poliza || '—' }}</p>
                    <p><strong>Póliza O&M:</strong> {{ fila.numero_poliza ? (fila.poliza_om ? 'Sí' : 'No') : '—' }}</p>
                    <p><strong>Vencimiento:</strong> {{ fila.fecha_vencimiento ? formatFecha(fila.fecha_vencimiento) : '—' }}</p>
                    <p><strong>Valor:</strong> {{ formatCurrency(fila.valor_poliza) }}</p>
                  </div>
                  <div class="pz-card pz-card-ipp">
                    <h4>Cálculo de lucro cesante (indexación IPP)</h4>
                    <p><strong>IPP base:</strong> {{ fila.ipp_base ?? '—' }} <span v-if="fila.ipp_base_fecha">({{ formatFecha(fila.ipp_base_fecha) }})</span></p>
                    <p><strong>IPP provisional:</strong> {{ fila.ipp_provisional ?? '—' }} <span v-if="fila.ipp_provisional_fecha">({{ formatFecha(fila.ipp_provisional_fecha) }})</span></p>
                    <p><strong>% de indexación:</strong> {{ pctIndexacion(fila) != null ? (pctIndexacion(fila) * 100).toFixed(2) + '%' : '—' }}</p>
                    <p><strong>Tarifa base:</strong> {{ fila.tarifa_base != null ? formatCurrency(fila.tarifa_base) : '—' }}</p>
                    <p><strong>Tarifa indexada:</strong> {{ tarifaIndexada(fila) != null ? formatCurrency(tarifaIndexada(fila)) : '—' }}</p>
                    <p><strong>Generación anual P90:</strong> {{ fila.generacion_anual_p90_kwh != null ? fila.generacion_anual_p90_kwh.toLocaleString('es-CO') + ' kWh' : '—' }}</p>
                    <p class="pz-resultado">
                      <strong>Ingresos (= valor lucro cesante):</strong>
                      <span>{{ formatCurrency(fila.valor_lucro_cesante) }}</span>
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!ordenadas.length">
            <td colspan="9" class="pz-empty">
              <InboxIcon class="text-2xl mb-1 size-[1em]" style="color:#9CA3AF" />
              <p>Sin resultados</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══ PANEL DE EDICIÓN ═════════════════════════════════════════════════ -->
    <transition name="pz-slide">
      <div v-if="edicion" class="pz-panel-overlay" @click.self="cerrarEdicion">
        <div class="pz-panel">
          <div class="pz-panel-header">
            <h3>{{ edicion.nombre_comercial }}</h3>
            <button class="pz-panel-close" @click="cerrarEdicion"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="pz-panel-body">
            <section class="pz-section">
              <h4>Póliza</h4>
              <label>N° póliza</label>
              <input v-model="form.numero_poliza" class="pz-input" />
              <label class="pz-switch-row"><ToggleSwitch v-model="form.poliza_om" /> Póliza O&M</label>
              <label>Fecha de vencimiento</label>
              <DatePicker v-model="form.fecha_vencimiento" dateFormat="yy-mm-dd" showIcon class="pz-input" />
              <label>Valor de la póliza (COP)</label>
              <InputNumber v-model="form.valor_poliza" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
            </section>

            <section class="pz-section">
              <h4>Presupuesto</h4>
              <label>Mano de obra</label>
              <InputNumber v-model="form.mano_obra" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <label>Estructura</label>
              <InputNumber v-model="form.estructura" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <label>Paneles</label>
              <InputNumber v-model="form.paneles" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <label>Inversores</label>
              <InputNumber v-model="form.inversores" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <label>Otros</label>
              <InputNumber v-model="form.otros" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <p class="pz-total-vivo">Total: {{ formatCurrency(totalPresupuestoForm) }}</p>
            </section>

            <section class="pz-section">
              <h4>Estudio de suelos</h4>
              <label>Link</label>
              <input v-model="form.link_estudio_suelos" class="pz-input" placeholder="https://…" />
            </section>

            <section class="pz-section">
              <h4>Cálculo IPP</h4>
              <label>IPP base</label>
              <InputNumber v-model="form.ipp_base" class="pz-input" :minFractionDigits="0" :maxFractionDigits="4" />
              <label>Fecha IPP base</label>
              <DatePicker v-model="form.ipp_base_fecha" dateFormat="yy-mm-dd" showIcon class="pz-input" />
              <label>IPP provisional</label>
              <InputNumber v-model="form.ipp_provisional" class="pz-input" :minFractionDigits="0" :maxFractionDigits="4" />
              <label>Fecha IPP provisional</label>
              <DatePicker v-model="form.ipp_provisional_fecha" dateFormat="yy-mm-dd" showIcon class="pz-input" />
              <label>Tarifa base</label>
              <InputNumber v-model="form.tarifa_base" mode="currency" currency="COP" locale="es-CO" class="pz-input" />
              <label>Generación anual P90 (kWh)</label>
              <InputNumber v-model="form.generacion_anual_p90_kwh" class="pz-input" />
              <p class="pz-total-vivo">
                % indexación: {{ pctIndexacionForm != null ? (pctIndexacionForm * 100).toFixed(2) + '%' : '—' }}<br>
                Lucro cesante estimado: {{ lucroCesanteForm != null ? formatCurrency(lucroCesanteForm) : '—' }}
              </p>
            </section>
          </div>

          <div class="pz-panel-footer">
            <Button label="Cancelar" outlined size="small" @click="cerrarEdicion" />
            <Button label="Guardar" size="small" :loading="guardando" @click="guardar" class="pz-btn-primary">
              <template #icon><CheckIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import { PolizasService } from '~/features/operaciones/services/polizas'
import { formatCurrency } from '~/features/operaciones/utils/financialCalculations'
import { CheckIcon, InboxIcon, PencilIcon, RefreshCwIcon, SearchIcon, ShieldIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'

const polizasService = new PolizasService()

const TIPO_LABELS = {
  minigranja: 'Minigranja',
  autoconsumo: 'Autoconsumo',
  gd: 'GD',
  movilidad_electrica: 'Movilidad',
  otro: 'Otro',
}
const TIPO_COLOR = {
  minigranja: '#10B981',
  autoconsumo: '#6366F1',
  gd: '#3B82F6',
  movilidad_electrica: '#8B5CF6',
  otro: '#9CA3AF',
}
const ESTADO_LABELS = {
  vigente: 'Vigente',
  proxima: 'Próxima a vencer',
  vencida: 'Vencida',
  sin_datos: 'Sin datos',
}
const ESTADO_COLOR = {
  vigente: { color: '#166534', bg: '#F0FDF4' },
  proxima: { color: '#92400E', bg: '#FFFBEB' },
  vencida: { color: '#991B1B', bg: '#FEF2F2' },
  sin_datos: { color: '#4B5563', bg: '#F3F4F6' },
}
const OPCIONES_TIPO = Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))
const OPCIONES_ESTADO = Object.entries(ESTADO_LABELS).map(([value, label]) => ({ value, label }))
const OPCIONES_OM = [{ value: true, label: 'Sí' }, { value: false, label: 'No' }]

const filas = ref([])
const loading = ref(false)
const busqueda = ref('')
const filtroTipo = ref(null)
const filtroEstado = ref(null)
const filtroOm = ref(null)
const expandidoId = ref(null)

async function cargar() {
  loading.value = true
  try {
    filas.value = await polizasService.listar()
  } catch {
    toast.error('Error', { description: 'No se pudieron cargar las pólizas', duration: 4000 })
  } finally {
    loading.value = false
  }
}
onMounted(cargar)

function ciudad(fila) {
  const partes = [fila.municipio, fila.departamento].filter(Boolean)
  return partes.length ? partes.join(', ') : '—'
}

function diasHastaVencimiento(fechaVencimiento) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento + 'T00:00:00')
  return Math.round((venc - hoy) / (1000 * 60 * 60 * 24))
}

function estadoDe(fila) {
  if (!fila.fecha_vencimiento) return 'sin_datos'
  const dias = diasHastaVencimiento(fila.fecha_vencimiento)
  if (dias < 0) return 'vencida'
  if (dias <= 60) return 'proxima'
  return 'vigente'
}

function estiloTipo(tipo) {
  const c = TIPO_COLOR[tipo] || TIPO_COLOR.otro
  return { color: c, background: `${c}1A` }
}
function estiloEstado(estado) {
  const c = ESTADO_COLOR[estado] || ESTADO_COLOR.sin_datos
  return { color: c.color, background: c.bg }
}

function formatFecha(f) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const conDatos = computed(() => filas.value.filter(f => f.fecha_vencimiento))
const totalAsegurado = computed(() => filas.value.reduce((acc, f) => acc + (f.valor_poliza || 0), 0))

function contarPorEstado(estado) {
  return filas.value.filter(f => estadoDe(f) === estado).length
}

const venceEn30 = computed(() =>
  filas.value.filter(f => f.fecha_vencimiento && diasHastaVencimiento(f.fecha_vencimiento) >= 0 && diasHastaVencimiento(f.fecha_vencimiento) <= 30)
)

const hayFiltros = computed(() => !!(busqueda.value || filtroTipo.value || filtroEstado.value || filtroOm.value !== null))
function limpiarFiltros() {
  busqueda.value = ''
  filtroTipo.value = null
  filtroEstado.value = null
  filtroOm.value = null
}

const filtradas = computed(() => {
  return filas.value.filter(f => {
    if (busqueda.value) {
      const q = busqueda.value.toLowerCase()
      const texto = `${f.nombre_comercial} ${ciudad(f)}`.toLowerCase()
      if (!texto.includes(q)) return false
    }
    if (filtroTipo.value && f.tipo_proyecto !== filtroTipo.value) return false
    if (filtroEstado.value && estadoDe(f) !== filtroEstado.value) return false
    if (filtroOm.value !== null && !!f.poliza_om !== filtroOm.value) return false
    return true
  })
})

const ordenadas = computed(() => {
  return [...filtradas.value].sort((a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0
    if (!a.fecha_vencimiento) return 1
    if (!b.fecha_vencimiento) return -1
    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)
  })
})

function toggleExpandir(id) {
  expandidoId.value = expandidoId.value === id ? null : id
}

function pctIndexacion(fila) {
  if (fila.ipp_base == null || fila.ipp_base === 0 || fila.ipp_provisional == null) return null
  return fila.ipp_provisional / fila.ipp_base
}
function tarifaIndexada(fila) {
  const pct = pctIndexacion(fila)
  if (pct == null || fila.tarifa_base == null) return null
  return fila.tarifa_base * pct
}

// ── Edición ──────────────────────────────────────────────────────────────────
const edicion = ref(null)
const guardando = ref(false)
const form = ref({})

function abrirEdicion(fila) {
  edicion.value = fila
  form.value = {
    numero_poliza: fila.numero_poliza,
    poliza_om: fila.poliza_om,
    fecha_vencimiento: fila.fecha_vencimiento ? new Date(fila.fecha_vencimiento) : null,
    valor_poliza: fila.valor_poliza,
    mano_obra: fila.mano_obra,
    estructura: fila.estructura,
    paneles: fila.paneles,
    inversores: fila.inversores,
    otros: fila.otros,
    link_estudio_suelos: fila.link_estudio_suelos,
    ipp_base: fila.ipp_base,
    ipp_base_fecha: fila.ipp_base_fecha ? new Date(fila.ipp_base_fecha) : null,
    ipp_provisional: fila.ipp_provisional,
    ipp_provisional_fecha: fila.ipp_provisional_fecha ? new Date(fila.ipp_provisional_fecha) : null,
    tarifa_base: fila.tarifa_base,
    generacion_anual_p90_kwh: fila.generacion_anual_p90_kwh,
  }
}
function cerrarEdicion() {
  edicion.value = null
}

const totalPresupuestoForm = computed(() => {
  const c = [form.value.mano_obra, form.value.estructura, form.value.paneles, form.value.inversores, form.value.otros]
  const presentes = c.filter(v => v != null)
  return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null
})
const pctIndexacionForm = computed(() => {
  if (!form.value.ipp_base || form.value.ipp_provisional == null) return null
  return form.value.ipp_provisional / form.value.ipp_base
})
const lucroCesanteForm = computed(() => {
  const pct = pctIndexacionForm.value
  if (pct == null || form.value.tarifa_base == null || form.value.generacion_anual_p90_kwh == null) return null
  return form.value.tarifa_base * pct * form.value.generacion_anual_p90_kwh
})

function toISODate(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

async function guardar() {
  if (!edicion.value) return
  guardando.value = true
  try {
    const body = {
      ...form.value,
      fecha_vencimiento: toISODate(form.value.fecha_vencimiento),
      ipp_base_fecha: toISODate(form.value.ipp_base_fecha),
      ipp_provisional_fecha: toISODate(form.value.ipp_provisional_fecha),
    }
    await polizasService.guardar(edicion.value.proyecto_id, body)
    await cargar()
    cerrarEdicion()
  } catch {
    toast.error('Error', { description: 'No se pudo guardar la póliza', duration: 4000 })
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.pz-page { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.pz-header { display: flex; align-items: center; justify-content: space-between; }
.pz-title { font-size: 15px; font-weight: 600; color: #111827; margin: 0; }
.pz-badge { background: #0F9D8C1A; color: #0F9D8C; font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 8px; }
.pz-banner { display: flex; align-items: center; gap: 8px; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; font-size: 13px; padding: 8px 12px; border-radius: 8px; cursor: pointer; text-align: left; }
.pz-stats { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 16px; }
.pz-stat { display: flex; flex-direction: column; gap: 2px; }
.pz-stat-label { font-size: 11px; color: #6B7280; }
.pz-stat-value { font-size: 15px; font-weight: 600; color: #111827; }
.pz-stat-div { width: 1px; height: 28px; background: #E5E7EB; }
.pz-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pz-search-wrap { position: relative; flex: 1; min-width: 220px; }
.pz-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9CA3AF; font-size: 12px; }
.pz-search { width: 100%; padding: 6px 10px 6px 28px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; }
.pz-sel { min-width: 160px; }
.pz-clear-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6B7280; background: none; border: 1px solid #D1D5DB; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
.pz-table-wrap { overflow-x: auto; background: #fff; border: 1px solid #E5E7EB; border-radius: 10px; }
.pz-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pz-table th { text-align: left; padding: 10px 12px; color: #6B7280; font-weight: 600; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #E5E7EB; }
.pz-table td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; }
.pz-row { cursor: pointer; }
.pz-row:hover { background: #F9FAFB; }
.pz-badge-tipo, .pz-badge-estado { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.pz-btn-editar { background: none; border: none; color: #6B7280; cursor: pointer; padding: 4px; }
.pz-btn-editar:hover { color: #0F9D8C; }
.pz-empty { text-align: center; padding: 32px; color: #9CA3AF; }
.pz-row-detalle td { background: #FAFAFA; }
.pz-detalle-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; padding: 8px 0; }
.pz-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; font-size: 12px; }
.pz-card h4 { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #374151; }
.pz-card p { margin: 4px 0; color: #4B5563; }
.pz-card-ipp { border-color: #0F9D8C; }
.pz-resultado { margin-top: 8px; padding-top: 8px; border-top: 1px solid #E5E7EB; font-size: 13px; }
.pz-resultado span { color: #0F9D8C; font-weight: 700; }
.pz-panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; justify-content: flex-end; z-index: 50; }
.pz-panel { width: 420px; max-width: 100%; background: #fff; height: 100%; display: flex; flex-direction: column; }
.pz-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #E5E7EB; }
.pz-panel-close { background: none; border: none; cursor: pointer; color: #6B7280; }
.pz-panel-body { flex: 1; overflow-y: auto; padding: 16px; }
.pz-section { margin-bottom: 20px; }
.pz-section h4 { font-size: 12px; font-weight: 600; color: #374151; margin: 0 0 8px; }
.pz-section label { display: block; font-size: 11px; color: #6B7280; margin-top: 8px; margin-bottom: 2px; }
.pz-input { width: 100%; }
.pz-switch-row { display: flex; align-items: center; gap: 8px; }
.pz-total-vivo { font-size: 12px; color: #374151; margin-top: 8px; }
.pz-panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #E5E7EB; }
.pz-btn-primary { background: #0F9D8C; border-color: #0F9D8C; }
.pz-slide-enter-active, .pz-slide-leave-active { transition: opacity 0.2s; }
.pz-slide-enter-from, .pz-slide-leave-to { opacity: 0; }
</style>
