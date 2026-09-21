<!--
  Firmar la oferta = crear su contrato PPA con las tarifas y enlazarlo.

  Cablea POST /comercial/ofertas/{id}/firmar, que no estaba usado en ninguna línea
  del front: la pestaña «Contratos» abría el wizard genérico de PPA, que deja
  `ppa_contrato_id` en NULL y rompe la cadena hacia Cumplimiento, Liquidaciones y
  la vista PPA-céntrica.

  Las condiciones NO se guardan en la oferta: alimentan el contrato, que es donde
  ya viven y donde las leen los demás módulos.
-->
<template>
  <Dialog :visible="visible" modal :style="{ width: '40rem' }" :closable="!firmando"
          @update:visible="cerrar">
    <template #header>
      <div v-if="oferta">
        <h2 class="text-base font-semibold" style="color:var(--color-unergy-deep)">Firmar → crear contrato PPA</h2>
        <p class="text-xs" style="color:#9b89b5">
          {{ oferta.planta_nombre || 'Sin planta' }} · {{ oferta.cliente_razon_social }}
        </p>
      </div>
    </template>

    <div v-if="oferta" class="flex flex-col gap-4">
      <!-- Firmar sin plantas es legítimo (la planta puede no existir todavía como
           proyecto) pero Cumplimiento no puede medir ese PPA. Se avisa fuerte. -->
      <Message v-if="!plantas.length" severity="warn" :closable="false">
        <div class="text-xs">
          <strong>Esta oferta no tiene ninguna planta vinculada.</strong>
          El contrato se crearía sin plantas y Cumplimiento no podría medirlo contra
          la generación. Vinculá el proyecto en el panel de la oferta antes de firmar,
          o seguí si la planta todavía no existe en la plataforma.
        </div>
      </Message>
      <div v-else class="rounded-md px-3 py-2" style="background:#F4EEFB;border:1px solid #e0d3f5">
        <div class="text-[11px] font-semibold mb-0.5" style="color:var(--color-unergy-purple-dark)">
          {{ plantas.length }} PLANTA(S) AL CONTRATO
        </div>
        <div class="text-xs" style="color:var(--color-unergy-purple-dark)">
          {{ plantas.map((p) => p.nombre_comercial).join(' · ') }}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="etiqueta">Código del contrato</label>
          <InputText v-model.trim="f.numero_codigo_contrato" class="w-full" />
          <p class="ayuda">Si lo dejás vacío hereda el código de seguimiento de la oferta.</p>
        </div>
        <div>
          <label class="etiqueta">Nombre interno</label>
          <InputText v-model.trim="f.nombre_interno" class="w-full" />
        </div>
        <div>
          <label class="etiqueta">Inicio del suministro *</label>
          <DatePicker v-model="f.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
        </div>
        <div>
          <label class="etiqueta">Fin del suministro *</label>
          <DatePicker v-model="f.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
        </div>
      </div>

      <div>
        <label class="etiqueta">Precio *</label>
        <SelectButton v-model="f.modo_precio" :options="MODOS_PRECIO" optionLabel="label"
                      optionValue="value" :allowEmpty="false" class="mb-2" />

        <div v-if="f.modo_precio === 'unica'" class="w-56">
          <InputNumber v-model="f.tarifa_base" class="w-full" suffix=" $/kWh" :maxFractionDigits="2"
                       placeholder="p. ej. 300" />
        </div>

        <div v-else>
          <div class="flex items-center gap-2 mb-2">
            <Button label="Llenar los años del periodo" size="small" outlined :disabled="!aniosPeriodo.length" @click="llenarAnios">
              <template #icon><ListIcon class="size-[1em]" /></template>
            </Button>
            <span class="text-[11px]" style="color:#9b89b5">
              {{ aniosPeriodo.length ? `${aniosPeriodo.length} año(s) entre inicio y fin` : 'Definí las fechas primero' }}
            </span>
          </div>
          <div v-for="(p, i) in f.precios_anuales" :key="i" class="flex items-center gap-2 mb-1.5">
            <InputNumber v-model="p.anio" class="w-24" :useGrouping="false" placeholder="Año" />
            <InputNumber v-model="p.precio" class="w-40" suffix=" $/kWh" :maxFractionDigits="2"
                         placeholder="Precio" />
            <Button text severity="danger" size="small" @click="f.precios_anuales.splice(i, 1)">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </div>
          <Button label="Agregar año" text size="small" @click="f.precios_anuales.push({ anio: null, precio: null })">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
          <p v-if="filasMensuales" class="ayuda">
            Se expandirá a <strong>{{ filasMensuales }}</strong> filas mensuales de tarifa,
            recortadas al periodo del suministro.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="etiqueta">Índice de indexación</label>
          <InputText v-model.trim="f.indice_indexacion" class="w-full" placeholder="IPP / IPC" />
        </div>
        <div>
          <label class="etiqueta">Mes base (YYYY-MM)</label>
          <InputText v-model.trim="f.periodo_indexacion_base" class="w-full" placeholder="2025-10" />
        </div>
        <div>
          <label class="etiqueta">Cantidad mínima (kWh/mes)</label>
          <InputNumber v-model="f.cantidad_minima_kwh_mes" class="w-full" :maxFractionDigits="0" />
        </div>
      </div>

      <div>
        <label class="etiqueta">Carpeta de soporte</label>
        <InputText v-model.trim="f.carpeta_link" class="w-full" placeholder="https://drive.google.com/…" />
      </div>

      <!-- Las mismas reglas que FirmarOfertaIn, para enterarse antes del 422. -->
      <Message v-if="errores.length" severity="error" :closable="false">
        <ul class="text-xs list-disc pl-4">
          <li v-for="e in errores" :key="e">{{ e }}</li>
        </ul>
      </Message>
      <Message v-if="errorServidor" severity="error" :closable="false">
        <span class="text-xs">{{ errorServidor }}</span>
      </Message>
    </div>

    <template #footer>
      <Button label="Cancelar" text severity="secondary" :disabled="firmando" @click="cerrar(false)" />
      <Button label="Firmar y crear contrato" :loading="firmando" :disabled="errores.length > 0" @click="firmar">
        <template #icon><FileCheckIcon class="size-[1em]" /></template>
      </Button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import { toast } from 'vue-sonner'
import { FileCheckIcon, ListIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import {
  aFecha, aFechaStr, validarFirma, tarifasMensualesQueGenera, aniosDelPeriodo,
} from './comercial.js'

const props = defineProps({
  visible: Boolean,
  oferta: { type: Object, default: null },
  acciones: { type: Object, required: true },
})
const emit = defineEmits(['update:visible', 'firmada'])


const MODOS_PRECIO = [
  { label: 'Tarifa única', value: 'unica' },
  { label: 'Tabla por año', value: 'tabla' },
]

const firmando = ref(false)
const errorServidor = ref('')

const f = reactive({
  numero_codigo_contrato: '',
  nombre_interno: '',
  fecha_inicio: null,
  fecha_fin: null,
  modo_precio: 'unica',
  tarifa_base: null,
  precios_anuales: [],
  indice_indexacion: '',
  periodo_indexacion_base: '',
  cantidad_minima_kwh_mes: null,
  carpeta_link: '',
})

const plantas = computed(() => props.oferta?.plantas ?? [])
const errores = computed(() => validarFirma(f))
const filasMensuales = computed(() => tarifasMensualesQueGenera(f))
const aniosPeriodo = computed(() => aniosDelPeriodo(f.fecha_inicio, f.fecha_fin))

watch(() => props.visible, (abierto) => {
  if (!abierto) return
  const o = props.oferta
  errorServidor.value = ''
  Object.assign(f, {
    // El backend hereda el código de seguimiento si va vacío; se precarga para
    // que se vea qué va a quedar.
    numero_codigo_contrato: o?.codigo_seguimiento ?? '',
    nombre_interno: o?.planta_nombre ?? '',
    fecha_inicio: aFecha(o?.fecha_tentativa_inicio),
    fecha_fin: aFecha(o?.fecha_fin_tentativa),
    modo_precio: 'unica',
    tarifa_base: null,
    precios_anuales: [],
    indice_indexacion: '',
    periodo_indexacion_base: '',
    cantidad_minima_kwh_mes: null,
    carpeta_link: '',
  })
})

// Al pasar a tabla por año, se precargan los años que cubre el periodo: es lo
// que evita la tabla a mano y los años fuera de rango que el backend descarta.
watch(() => f.modo_precio, (modo) => {
  if (modo === 'tabla' && !f.precios_anuales.length) llenarAnios()
})

function llenarAnios() {
  const existentes = new Map(f.precios_anuales.filter((p) => p.anio).map((p) => [p.anio, p.precio]))
  f.precios_anuales = aniosPeriodo.value.map((a) => ({ anio: a, precio: existentes.get(a) ?? null }))
}

function cerrar(v) {
  if (firmando.value) return
  emit('update:visible', v === true)
}

async function firmar() {
  firmando.value = true
  errorServidor.value = ''
  const payload = {
    numero_codigo_contrato: f.numero_codigo_contrato || null,
    nombre_interno: f.nombre_interno || null,
    fecha_inicio: aFechaStr(f.fecha_inicio),
    fecha_fin: aFechaStr(f.fecha_fin),
    indice_indexacion: f.indice_indexacion || null,
    periodo_indexacion_base: f.periodo_indexacion_base || null,
    cantidad_minima_kwh_mes: f.cantidad_minima_kwh_mes ?? null,
    carpeta_link: f.carpeta_link || null,
  }
  if (f.modo_precio === 'tabla') {
    payload.precios_anuales = f.precios_anuales
      .filter((p) => p.anio && p.precio > 0)
      .map((p) => ({ anio: p.anio, precio: p.precio }))
  } else {
    payload.tarifa_base = f.tarifa_base
  }

  const r = await props.acciones.firmar(props.oferta.id, payload)
  firmando.value = false

  if (!r.ok) {
    errorServidor.value = r.error
    return
  }
  toast.success(`Contrato PPA #${r.ppa_contrato_id} creado`, {
    description: r.plantas_del_contrato
      ? `${r.plantas_del_contrato} planta(s) · ${r.tarifas_creadas} tarifas mensuales`
      : 'Sin plantas: Cumplimiento no podrá medirlo hasta que vincules el proyecto.',
    duration: 6000,
  })

  // El backend ya mandaba `avisos` y esta pantalla los tiraba. Ahí viaja, entre
  // otras cosas, el «ya existe un PPA que cubre esto»: el CRM no puede rechazar
  // la firma --no tiene dónde confirmar "crear igual"-- pero sí tiene que
  // decirlo.
  for (const aviso of r.avisos ?? []) {
    toast.warning('Revisa el contrato', { description: aviso, duration: 8000 })
  }

  emit('firmada', r)
  emit('update:visible', false)
}
</script>

<style scoped>
.etiqueta {
  display: block;
  font-size: 11px;
  color: #7a6e8a;
  margin-bottom: 0.15rem;
}
.ayuda {
  font-size: 11px;
  color: #9b89b5;
  margin-top: 0.35rem;
}
</style>
