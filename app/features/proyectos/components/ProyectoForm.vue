<template>
  <form @submit.prevent="submit" class="space-y-4 pt-2">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="field-label">Nombre comercial *</label>
        <InputText v-model="f.nombre_comercial" class="w-full" required />
      </div>
      <div>
        <label class="field-label">Tipo de proyecto</label>
        <Select v-model="f.tipo_proyecto" :options="tipos" class="w-full" placeholder="Seleccionar" showClear />
      </div>
      <div>
        <label class="field-label">Estado</label>
        <Select v-model="f.estado" :options="estados" optionLabel="label" optionValue="value" class="w-full" />
      </div>
      <div>
        <label class="field-label">Potencia AC (kW)</label>
        <InputNumber v-model="potenciaAcKw" :maxFractionDigits="3" locale="en-US" class="w-full" />
      </div>
      <div>
        <label class="field-label">Capacidad instalada (kWp)</label>
        <InputNumber v-model="capacidadInstaladaKwp" :maxFractionDigits="3" locale="en-US" class="w-full" />
      </div>
      <div>
        <label class="field-label">Tipo tecnología</label>
        <Select v-model="f.tipo_tecnologia" :options="tecnologias" class="w-full" placeholder="Seleccionar" showClear />
      </div>
      <div>
        <label class="field-label">Cantidad de paneles</label>
        <InputNumber v-model="cantidadTotalPaneles" :useGrouping="false" class="w-full" />
      </div>
      <div>
        <label class="field-label">Departamento</label>
        <Select v-model="f.departamento" :options="departamentos" class="w-full" placeholder="Seleccionar" showClear filter />
      </div>
      <div>
        <label class="field-label">Municipio</label>
        <Select v-model="f.municipio" :options="municipiosDisponibles" class="w-full" placeholder="Seleccionar" showClear filter
          :disabled="!f.departamento" />
      </div>
      <div>
        <label class="field-label">Operador de red{{ operadorRedObligatorio ? ' *' : '' }}</label>
        <Select v-model="f.operador_red_id" :options="operadoresRedOptions" optionLabel="label"
          optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
      </div>
      <div>
        <label class="field-label">Clasificación regulatoria</label>
        <Select v-model="f.clasificacion_regulatoria" :options="clasificaciones" class="w-full" placeholder="Seleccionar" showClear />
      </div>
      <div class="col-span-2">
        <label class="field-label">Dirección / vereda</label>
        <InputText v-model="f.direccion_vereda" class="w-full" placeholder="Ej: Vereda El Cerrito, km 4 vía Planeta Rica" />
      </div>
      <!-- Coordenadas: hasta ahora solo se podían cargar EDITANDO el proyecto, así
           que toda planta nacía sin ubicación en el mapa y sin coordenadas para
           quien integra por API. -->
      <div>
        <label class="field-label">Latitud</label>
        <InputNumber v-model="f.latitud" :maxFractionDigits="6" locale="en-US" class="w-full" placeholder="8.748000" />
      </div>
      <div>
        <label class="field-label">Longitud</label>
        <InputNumber v-model="f.longitud" :maxFractionDigits="6" locale="en-US" class="w-full" placeholder="-75.881000" />
      </div>
      <!-- Ortogonal al tipo y a la clasificación: cualquier planta puede o no
           pertenecer a una comunidad energética. -->
      <div>
        <label class="field-label">Comunidad energética</label>
        <div class="flex items-center gap-2 h-[38px]">
          <ToggleSwitch v-model="f.es_comunidad_energetica" />
          <span class="text-sm text-gray-500">{{ f.es_comunidad_energetica ? 'Sí' : 'No' }}</span>
        </div>
      </div>
      <div v-if="f.es_comunidad_energetica">
        <label class="field-label">Nombre de la comunidad</label>
        <InputText v-model="f.nombre_comunidad" class="w-full" placeholder="Opcional" />
      </div>
      <div>
        <label class="field-label">Carpeta Drive (código)</label>
        <InputText v-model="f.carpeta_drive_codigo" class="w-full" />
      </div>
      <div>
        <label class="field-label">Código base (topic)</label>
        <InputText v-model="f.sub_project" class="w-full" placeholder="ej: perija, vallenata" />
      </div>
      <div>
        <label class="field-label">Código TSF</label>
        <InputText v-model="f.codigo_tsf" class="w-full" placeholder="ej: COLCEST58P2" />
      </div>
      <div>
        <label class="field-label">Fecha de entrada en operación</label>
        <DatePicker v-model="fechaEntrada" dateFormat="yy-mm-dd" showIcon showClear class="w-full" placeholder="Seleccionar" />
      </div>
      <div>
        <label class="field-label">Fecha fin de representación</label>
        <DatePicker v-model="fechaFinRep" dateFormat="yy-mm-dd" showIcon showClear class="w-full" placeholder="Vigente" />
      </div>
    </div>

    <!-- Simulación P50 / P90 -->
    <div class="border border-gray-200 rounded-lg p-4 space-y-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Generación simulada mensual (kWh)</p>

      <!-- P90 -->
      <div>
        <p class="text-xs font-medium text-gray-600 mb-2">P90</p>
        <div class="grid grid-cols-6 gap-2">
          <div v-for="(mes, i) in MESES" :key="'p90-' + i">
            <label class="block text-[10px] text-gray-400 mb-0.5 text-center">{{ mes }}</label>
            <InputNumber
              v-model="p90Array[i]"
              :maxFractionDigits="1"
              class="w-full"
              inputClass="text-center text-xs px-1 py-1"
              :placeholder="'—'"
            />
          </div>
        </div>
      </div>

      <!-- P50 -->
      <div>
        <p class="text-xs font-medium text-gray-600 mb-2">P50</p>
        <div class="grid grid-cols-6 gap-2">
          <div v-for="(mes, i) in MESES" :key="'p50-' + i">
            <label class="block text-[10px] text-gray-400 mb-0.5 text-center">{{ mes }}</label>
            <InputNumber
              v-model="p50Array[i]"
              :maxFractionDigits="1"
              class="w-full"
              inputClass="text-center text-xs px-1 py-1"
              :placeholder="'—'"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" label="Cancelar" severity="secondary" :disabled="guardando"
        @click="$emit('cancel')" />
      <Button type="submit" label="Crear proyecto"
        :loading="guardando" :disabled="!puedeGuardar" />
    </div>
    <p v-if="operadorRedObligatorio && !f.operador_red_id" class="text-xs text-gray-500 text-right">
      Falta el operador de red: sin él no se puede crear la planta.
    </p>
  </form>
</template>

<script setup>
import { reactive, ref, watch, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import divipola from '~/data/colombia-divipola.json'

const operadoresRedService = new OperadoresRedService()

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const props = defineProps({
  /**
   * El CRM comercial exige operador de red del catálogo (validación bloqueante:
   * el backend responde 422 sin él). En /proyectos es opcional y se deja así,
   * para no volver obligatorio un campo que hoy no lo es.
   */
  operadorRedObligatorio: { type: Boolean, default: false },
  guardando: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel'])

const puedeGuardar = computed(() =>
  !!f.nombre_comercial && (!props.operadorRedObligatorio || !!f.operador_red_id))

const estados = [
  { label: 'En desarrollo', value: 'en_desarrollo' },
  { label: 'En operacion', value: 'en_operacion' },
  { label: 'Suspendido', value: 'suspendido' },
  { label: 'Cancelado', value: 'cancelado' },
]
const tipos = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica']
const tecnologias = ['solar', 'eolica', 'hidraulica', 'biomasa', 'otra']
const clasificaciones = ['AGP', 'AGPE', 'AGGE', 'GD', 'DER', 'otra']

const f = reactive({
  nombre_comercial: '',
  estado: 'en_desarrollo',
  tipo_proyecto: null,
  tipo_tecnologia: null,
  departamento: null,
  municipio: null,
  direccion_vereda: null,
  latitud: null,
  longitud: null,
  operador_red_id: null,
  clasificacion_regulatoria: null,
  carpeta_drive_codigo: null,
  sub_project: null,
  codigo_tsf: null,
  es_comunidad_energetica: false,
  nombre_comunidad: null,
})

// Departamento/municipio -- select en vez de texto libre (DIVIPOLA), para
// evitar variantes de escritura que luego no se puedan agrupar/filtrar bien.
const departamentos = Object.keys(divipola).sort()
const municipiosDisponibles = computed(() => f.departamento ? (divipola[f.departamento] || []) : [])
watch(() => f.departamento, (nuevo, anterior) => {
  if (nuevo !== anterior && f.municipio && !(divipola[nuevo] || []).includes(f.municipio)) {
    f.municipio = null
  }
})

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref([])
const operadoresRedOptions = computed(() =>
  operadoresRed.value.map(o => ({ id: o.id, label: o.nombre_comercial || o.nombre_legal }))
)
onMounted(async () => {
  try {
    operadoresRed.value = await operadoresRedService.listar()
  } catch { /* graceful degrade -- el select queda vacío */ }
})

// Potencia AC y capacidad instalada -- viven en proyecto_info_tecnica (pestaña
// Técnico), que requiere un proyecto_id existente, así que no son parte de `f`
// (el payload de POST/PATCH /proyectos). El submit las emite aparte para que
// quien las reciba haga el PUT a /proyectos/{id}/info-tecnica después de crear.
// Ese PUT ya espeja capacidad_instalada_kwp a proyectos.potencia_instalada_kwp
// del lado del backend (ver app/api/v1/proyectos.py::upsert_info_tecnica) --
// no hace falta duplicarlo aquí.
const potenciaAcKw = ref(null)
const capacidadInstaladaKwp = ref(null)
// Cantidad de paneles -- también vive en proyecto_info_tecnica; opcional al crear.
const cantidadTotalPaneles = ref(null)

// Fechas del proyecto (DatePicker usa Date; el API espera 'YYYY-MM-DD')
const fechaEntrada = ref(null)
const fechaFinRep = ref(null)

function toDate(v) {
  if (!v) return null
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d) // medianoche local (evita corrimiento de zona horaria)
}
function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}

function parseMonthArray(jsonStr) {
  if (!jsonStr) return Array(12).fill(null)
  try {
    const arr = JSON.parse(jsonStr)
    if (!Array.isArray(arr)) return Array(12).fill(null)
    return arr.map(v => (v === null || v === undefined ? null : Number(v)))
  } catch {
    return Array(12).fill(null)
  }
}

const p90Array = ref(Array(12).fill(null))
const p50Array = ref(Array(12).fill(null))

function serializeMonthArray(arr) {
  if (arr.every(v => v === null || v === undefined)) return null
  return JSON.stringify(arr.map(v => (v === null || v === undefined ? null : v)))
}

function submit() {
  const payload = {}
  for (const [k, v] of Object.entries(f)) {
    if (v !== null && v !== undefined && v !== '') payload[k] = v
  }
  const p90json = serializeMonthArray(p90Array.value)
  const p50json = serializeMonthArray(p50Array.value)
  if (p90json !== null) payload.p90_mensual_kwh = p90json
  if (p50json !== null) payload.p50_mensual_kwh = p50json
  // Fechas del proyecto (null = sin fecha / vigente)
  payload.fecha_entrada_operacion = formatFecha(fechaEntrada.value)
  payload.fecha_fin_representacion = formatFecha(fechaFinRep.value)
  // potencia_instalada_kwp NO se manda: el dual-write se quitó en d68837e
  // porque ahora lo sincroniza el backend desde info-tecnica.
  // Comunidad energética: el flag viaja siempre (el bucle de arriba lo dejaría
  // fuera cuando es false) y el nombre solo si el flag está prendido, para que
  // apagarlo no deje colgado el nombre de una comunidad a la que ya no pertenece.
  payload.es_comunidad_energetica = !!f.es_comunidad_energetica
  payload.nombre_comunidad = f.es_comunidad_energetica ? (f.nombre_comunidad || null) : null

  const infoTecnica = {}
  if (potenciaAcKw.value !== null) infoTecnica.potencia_ac_kw = potenciaAcKw.value
  if (capacidadInstaladaKwp.value !== null) infoTecnica.capacidad_instalada_kwp = capacidadInstaladaKwp.value
  if (cantidadTotalPaneles.value !== null) infoTecnica.cantidad_total_paneles = cantidadTotalPaneles.value

  emit('save', payload, infoTecnica)
}
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
