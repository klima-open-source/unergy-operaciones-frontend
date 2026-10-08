<template>
  <form @submit.prevent="submit" class="space-y-4 pt-2">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="block text-xs font-medium text-muted-foreground mb-1">Nombre comercial *</label>
        <Input v-model="f.nombre_comercial" required />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo de proyecto</label>
        <Select :model-value="aValorSelect(f.tipo_proyecto)" @update:model-value="f.tipo_proyecto = deValorSelect($event) || null">
          <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem>
            <SelectItem v-for="o in tipos" :key="o" :value="o">{{ o }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
        <Select v-model="f.estado">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="e in estados" :key="e.value" :value="e.value">{{ e.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Potencia AC (kW)</label>
        <NumberField v-model="potenciaAcKw" :step-snapping="false" :format-options="{ maximumFractionDigits: 3 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Capacidad instalada (kWp)</label>
        <NumberField v-model="capacidadInstaladaKwp" :step-snapping="false" :format-options="{ maximumFractionDigits: 3 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo tecnología</label>
        <Select :model-value="aValorSelect(f.tipo_tecnologia)" @update:model-value="f.tipo_tecnologia = deValorSelect($event) || null">
          <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem>
            <SelectItem v-for="o in tecnologias" :key="o" :value="o">{{ o }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Cantidad de paneles</label>
        <NumberField v-model="cantidadTotalPaneles" :step-snapping="false" :format-options="{ useGrouping: false }" :min="0">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Departamento</label>
        <ComboBox :model-value="f.departamento" :options="opcionesDepartamento" placeholder="Seleccionar"
          @update:model-value="f.departamento = deValorSelect($event) || null" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Municipio</label>
        <!-- `key`: al cambiar de departamento cambian las opciones, y el input
             tiene que volver a calcular su texto. -->
        <ComboBox :key="f.departamento ?? ''" :model-value="f.municipio" :options="opcionesMunicipio" placeholder="Seleccionar"
          :disabled="!f.departamento" @update:model-value="f.municipio = deValorSelect($event) || null" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Operador de red{{ operadorRedObligatorio ? ' *' : '' }}</label>
        <ComboBox :key="opcionesOperadorRed.length" :model-value="f.operador_red_id != null ? String(f.operador_red_id) : null"
          :options="opcionesOperadorRed" placeholder="Seleccionar"
          @update:model-value="v => { const id = deValorSelect(v); f.operador_red_id = id ? Number(id) : null }" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Clasificación regulatoria</label>
        <Select :model-value="aValorSelect(f.clasificacion_regulatoria)" @update:model-value="f.clasificacion_regulatoria = deValorSelect($event) || null">
          <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem>
            <SelectItem v-for="o in clasificaciones" :key="o" :value="o">{{ o }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="col-span-2">
        <label class="block text-xs font-medium text-muted-foreground mb-1">Dirección / vereda</label>
        <Input v-model="f.direccion_vereda" placeholder="Ej: Vereda El Cerrito, km 4 vía Planeta Rica" />
      </div>
      <!-- Coordenadas: hasta ahora solo se podían cargar EDITANDO el proyecto, así
           que toda planta nacía sin ubicación en el mapa y sin coordenadas para
           quien integra por API. -->
      <CoordenadasInput v-model:latitud="f.latitud" v-model:longitud="f.longitud"
        v-model:valido="coordenadasValidas" class="col-span-2" />
      <!-- El backend acota la altitud a -100..6000 msnm (Colombia llega a ~5.700
           en el Ritacuba): un dedazo de 60.000 se rechaza con 422. -->
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Altitud (msnm)</label>
        <NumberField v-model="f.altitud_msnm" :step-snapping="false" :min="-100" :max="6000">
          <NumberFieldContent><NumberFieldInput placeholder="35" /></NumberFieldContent>
        </NumberField>
      </div>
      <!-- La comunidad energética se marca en el PPA, no acá: se negocia en ese
           contrato y de ahí deriva a la planta. `proyectos.es_comunidad_energetica`
           y `nombre_comunidad` se eliminaron del modelo (migración proyectos/0008),
           asi que este toggle ya no guardaba nada -- quien lo activaba creía
           haber marcado la planta y no pasaba nada. -->
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Carpeta Drive (código)</label>
        <Input v-model="f.carpeta_drive_codigo" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Código base (topic)</label>
        <Input v-model="f.sub_project" placeholder="ej: perija, vallenata" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Código TSF</label>
        <Input v-model="f.codigo_tsf" placeholder="ej: COLCEST58P2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de operación en MEM</label>
        <DatePicker v-model="fechaEntrada" clearable placeholder="Seleccionar" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de operación (mantenimiento)</label>
        <DatePicker v-model="fechaOperMant" clearable placeholder="Seleccionar" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de entrega del proyecto</label>
        <DatePicker v-model="fechaEntrega" clearable placeholder="Seleccionar" />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha fin de representación</label>
        <DatePicker v-model="fechaFinRep" clearable placeholder="Vigente" />
      </div>
    </div>

    <!-- Simulación P50 / P90 -->
    <div class="border border-border rounded-lg p-4 space-y-4">
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generación simulada mensual (kWh)</p>

      <!-- P90 -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2">P90</p>
        <div class="grid grid-cols-6 gap-2">
          <div v-for="(mes, i) in MESES" :key="'p90-' + i">
            <label class="block text-xs text-muted-foreground mb-0.5 text-center">{{ mes }}</label>
            <NumberField v-model="p90Array[i]" :step-snapping="false" :format-options="{ maximumFractionDigits: 1 }">
              <NumberFieldContent><NumberFieldInput class="px-1 text-center text-xs" placeholder="—" /></NumberFieldContent>
            </NumberField>
          </div>
        </div>
      </div>

      <!-- P50 -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2">P50</p>
        <div class="grid grid-cols-6 gap-2">
          <div v-for="(mes, i) in MESES" :key="'p50-' + i">
            <label class="block text-xs text-muted-foreground mb-0.5 text-center">{{ mes }}</label>
            <NumberField v-model="p50Array[i]" :step-snapping="false" :format-options="{ maximumFractionDigits: 1 }">
              <NumberFieldContent><NumberFieldInput class="px-1 text-center text-xs" placeholder="—" /></NumberFieldContent>
            </NumberField>
          </div>
        </div>
      </div>
    </div>

    <!-- Inversionista inicial, opcional. Antes la planta nacía suelta y había
         que ir a su detalle a vincular el cliente, que es un paso que se olvida.
         Acá cabe el caso común --un inversionista al 100%--; los demás se
         agregan en el detalle, que admite fechas y patrimonio autónomo. -->
    <div class="border-t border-muted pt-4 mt-2">
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Inversionista <span class="normal-case font-normal">(opcional)</span>
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectorCliente
          v-model:id="inversionistaInicial.cliente_id"
          v-model:nombre="inversionistaInicial.nombre"
          label="Cliente"
          placeholder="Buscar o crear el cliente…"
        />
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Participación (%)</label>
          <NumberField v-model="inversionistaInicial.porcentaje_pct" :step-snapping="false" :min="0" :max="100"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 7 }">
            <NumberFieldContent><NumberFieldInput placeholder="100" /></NumberFieldContent>
          </NumberField>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="ghost" :disabled="guardando" @click="$emit('cancel')">Cancelar</Button>
      <Button type="submit" :disabled="guardando || !puedeGuardar">
        <Spinner v-if="guardando" class="size-4" /> Crear proyecto
      </Button>
    </div>
    <p v-if="operadorRedObligatorio && !f.operador_red_id" class="text-xs text-muted-foreground text-right">
      Falta el operador de red: sin él no se puede crear la planta.
    </p>
  </form>
</template>

<script setup>
import { reactive, ref, watch, computed, onMounted } from 'vue'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import divipola from '~/data/colombia-divipola.json'

const operadoresRedService = new OperadoresRedService()

/** El inversionista que se vincula junto con la planta. Ver el bloque del form. */
const inversionistaInicial = reactive({
  cliente_id: null,
  nombre: null,
  porcentaje_pct: null,
})

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

// Mientras una coordenada escrita no se pueda leer, no se guarda: se mandaría
// la anterior sin que se note.
const coordenadasValidas = ref(true)

const puedeGuardar = computed(() =>
  !!f.nombre_comercial && coordenadasValidas.value
  && (!props.operadorRedObligatorio || !!f.operador_red_id))

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
  altitud_msnm: null,
  operador_red_id: null,
  clasificacion_regulatoria: null,
  carpeta_drive_codigo: null,
  sub_project: null,
  codigo_tsf: null,
})

// Departamento/municipio -- select en vez de texto libre (DIVIPOLA), para
// evitar variantes de escritura que luego no se puedan agrupar/filtrar bien.
const departamentos = Object.keys(divipola).sort()
const municipiosDisponibles = computed(() => f.departamento ? (divipola[f.departamento] || []) : [])

/** Opciones de un ComboBox con la primera para dejarlo vacío (el showClear de PrimeVue). */
function conVacio(opciones) {
  return [{ value: VALOR_SELECT_VACIO, label: 'Sin definir' }, ...opciones]
}
const opcionesDepartamento = conVacio(departamentos.map(d => ({ value: d, label: d })))
const opcionesMunicipio = computed(() => conVacio(municipiosDisponibles.value.map(m => ({ value: m, label: m }))))
watch(() => f.departamento, (nuevo, anterior) => {
  if (nuevo !== anterior && f.municipio && !(divipola[nuevo] || []).includes(f.municipio)) {
    f.municipio = null
  }
})

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref([])
const opcionesOperadorRed = computed(() =>
  conVacio(operadoresRed.value.map(o => ({ value: String(o.id), label: o.nombre_comercial || o.nombre_legal })))
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
// Ese PUT ya espeja capacidad_instalada_kwp a proyectos.potencia_ac_kw
// del lado del backend (ver app/api/v1/proyectos.py::upsert_info_tecnica) --
// no hace falta duplicarlo aquí.
const potenciaAcKw = ref(null)
const capacidadInstaladaKwp = ref(null)
// Cantidad de paneles -- también vive en proyecto_info_tecnica; opcional al crear.
const cantidadTotalPaneles = ref(null)

// Fechas del proyecto ('YYYY-MM-DD', lo mismo que espera el API)
const fechaEntrada = ref(null)
const fechaOperMant = ref(null)
const fechaEntrega = ref(null)
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
  payload.fecha_operacion_mantenimiento = formatFecha(fechaOperMant.value)
  payload.fecha_entrega_proyecto = formatFecha(fechaEntrega.value)
  payload.fecha_fin_representacion = formatFecha(fechaFinRep.value)
  // potencia_ac_kw NO se manda: el dual-write se quitó en d68837e
  // porque ahora lo sincroniza el backend desde info-tecnica.
  // La comunidad energética ya no viaja acá: se marca en el PPA y de ahí deriva
  // a la planta. Las dos columnas se eliminaron del modelo en proyectos/0008, y
  // seguir mandándolas era escribir en el vacío.

  const infoTecnica = {}
  if (potenciaAcKw.value !== null) infoTecnica.potencia_ac_kw = potenciaAcKw.value
  if (capacidadInstaladaKwp.value !== null) infoTecnica.capacidad_instalada_kwp = capacidadInstaladaKwp.value
  if (cantidadTotalPaneles.value !== null) infoTecnica.cantidad_total_paneles = cantidadTotalPaneles.value

  // El inversionista no va en el payload del proyecto: es otra tabla, y se
  // agrega después de crear la planta (necesita su id). Viaja aparte, como
  // `infoTecnica`.
  const inversionista = inversionistaInicial.cliente_id
    ? {
        cliente_id: inversionistaInicial.cliente_id,
        porcentaje_participacion: (inversionistaInicial.porcentaje_pct ?? 100) / 100,
      }
    : null

  emit('save', payload, infoTecnica, inversionista)
}
</script>
