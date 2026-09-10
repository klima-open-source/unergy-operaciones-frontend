<!--
  Registro comercial en un solo flujo: cliente → ofertas → confirmar.

  El registro viejo creaba una OPORTUNIDAD sin ofertas, y el tablero y la tabla
  se alimentan de las ofertas: quien registraba veía "creado" y después no
  encontraba nada. Había que entrar al detalle, buscar la pestaña «Ofertas» y
  agregar una. Acá el paso 2 exige al menos una oferta y todo entra en una sola
  transacción (POST /comercial/registrar).

  También manda al backend lo que el formulario viejo descartaba: la etapa de
  cada oferta, sus plantas y la fecha de envío.
-->
<template>
  <Dialog :visible="visible" modal :style="{ width: '46rem' }" :closable="!guardando"
          @update:visible="cerrar">
    <template #header>
      <div>
        <h2 class="text-base font-semibold" style="color:var(--color-unergy-deep)">Registrar oferta</h2>
        <p class="text-xs" style="color:#9b89b5">{{ SUBTITULOS[paso] }}</p>
      </div>
    </template>

    <!-- Pasos -->
    <ol class="flex items-center gap-1 mb-5 text-xs">
      <li v-for="(t, i) in PASOS" :key="t" class="flex items-center gap-1">
        <button class="flex items-center gap-1.5 rounded px-2 py-1 transition-colors"
                :class="i === paso ? 'font-semibold' : ''"
                :style="{ color: i <= paso ? 'var(--color-unergy-purple)' : '#c4b8d4',
                          background: i === paso ? '#F4EEFB' : 'transparent' }"
                :disabled="i > paso" @click="paso = i">
          <span class="w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white"
                :style="{ background: i <= paso ? 'var(--color-unergy-purple)' : '#c4b8d4' }">{{ i + 1 }}</span>
          {{ t }}
        </button>
        <ChevronRightIcon class="size-[1em]" v-if="i < PASOS.length - 1" style="color:#c4b8d4;font-size:10px" />
      </li>
    </ol>

    <!-- ── Paso 1: cliente ─────────────────────────────────────────────── -->
    <div v-if="paso === 0" class="flex flex-col gap-4">
      <SelectButton v-model="modo" :options="MODOS" optionLabel="label" optionValue="value"
                    :allowEmpty="false" />

      <div v-if="modo === 'existente'">
        <label class="etiqueta">Cliente *</label>
        <AutoComplete v-model="clienteSel" :suggestions="sugerencias" optionLabel="razon_social_nombre"
                      dropdown forceSelection class="w-full" inputClass="w-full"
                      placeholder="Buscar por razón social o NIT…" @complete="buscarCliente" />
        <p v-if="clienteSel?.nit_cedula" class="ayuda">NIT {{ clienteSel.nit_cedula }}</p>
      </div>

      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="etiqueta">Razón social *</label>
            <InputText v-model.trim="nuevo.razon_social_nombre" class="w-full" />
          </div>
          <div>
            <label class="etiqueta">NIT / Cédula</label>
            <InputText v-model.trim="nuevo.nit_cedula" class="w-full" />
          </div>
          <div>
            <label class="etiqueta">Origen del cliente</label>
            <Select v-model="nuevo.origen_tipo" :options="ORIGENES_CLIENTE" optionLabel="label"
                    optionValue="value" showClear class="w-full" placeholder="—" />
          </div>
          <div>
            <label class="etiqueta">Quién lo consiguió / recomendó</label>
            <InputText v-model.trim="nuevo.origen_detalle" class="w-full" />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="etiqueta !mb-0">Contactos * (al menos uno con correo)</label>
            <Button label="Agregar" text size="small" @click="nuevo.contactos.push({ nombre: '', telefono: '', email: '', tipo: 'comercial' })">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <div v-for="(c, i) in nuevo.contactos" :key="i"
               class="grid grid-cols-[1fr_1fr_1.2fr_auto_auto] gap-2 mb-2">
            <InputText v-model.trim="c.nombre" placeholder="Nombre" />
            <InputText v-model.trim="c.telefono" placeholder="Teléfono" />
            <InputText v-model.trim="c.email" placeholder="Correo *" />
            <Select v-model="c.tipo" :options="TIPOS_CONTACTO" optionLabel="label" optionValue="value"
                    class="w-32" />
            <Button text severity="danger" :disabled="nuevo.contactos.length === 1" @click="nuevo.contactos.splice(i, 1)">
              <template #icon><Trash2Icon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <!-- El 409 de duplicado deja de ser un error rojo sin salida. -->
        <Message v-if="duplicado" severity="warn" :closable="false">
          <div class="text-xs">
            <p class="mb-2">{{ duplicado.mensaje }}</p>
            <div class="flex gap-2">
              <Button label="Usar ese cliente" size="small" @click="usarCandidato" />
              <Button label="Crear uno nuevo igual" size="small" outlined severity="secondary"
                      @click="forzarDuplicado = true; duplicado = null; guardar()" />
            </div>
          </div>
        </Message>
      </template>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="etiqueta">Nombre del negocio (opcional)</label>
          <InputText v-model.trim="negocio.nombre" class="w-full"
                     placeholder="Ej: Comunidad energética 2027" />
        </div>
        <div>
          <label class="etiqueta">Notas</label>
          <InputText v-model.trim="negocio.notas" class="w-full" />
        </div>
      </div>
    </div>

    <!-- ── Paso 2: ofertas ─────────────────────────────────────────────── -->
    <div v-else-if="paso === 1" class="flex flex-col gap-3">
      <div v-for="(o, i) in ofertas" :key="i" class="rounded-lg p-3"
           style="background:#FAF8FC;border:1px solid #e8e0f0">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold" style="color:#7a6e8a">Oferta {{ i + 1 }}</span>
          <Button v-if="ofertas.length > 1" text severity="danger" size="small" @click="ofertas.splice(i, 1)">
            <template #icon><Trash2Icon class="size-[1em]" /></template>
          </Button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="etiqueta">Tipo de oferta *</label>
            <Select v-model="o.tipo" :options="TIPOS_OFERTA" optionLabel="label" optionValue="value"
                    class="w-full" placeholder="Seleccionar…" />
          </div>
          <div>
            <label class="etiqueta">Planta (nombre libre)</label>
            <InputText v-model.trim="o.planta_nombre" class="w-full" placeholder="Ej: Balmora 1 y 2" />
          </div>
          <!-- El vínculo a la planta REAL. Sin él la oferta queda sin proyecto y
               /comercial/proyectos-operando la devuelve sin ubicación, sin operador
               de red y sin ningún dato técnico: todo eso vive en el Proyecto. -->
          <div class="sm:col-span-2">
            <label class="etiqueta">Plantas ya creadas en Proyectos</label>
            <MultiSelect v-model="o.proyecto_ids" :options="proyectos" optionLabel="nombre_comercial"
                       :filterFields="['nombre_comercial', 'municipio', 'departamento']"
                         optionValue="id" filter display="chip" class="w-full"
                         :loading="cargandoCatalogos"
                         placeholder="Buscá la planta por nombre, municipio o departamento…"
                         filterPlaceholder="Buscar…" :emptyMessage="cargandoCatalogos ? 'Cargando…' : 'No hay plantas cargadas'">
              <template #option="{ option }">
                <div class="min-w-0">
                  <div class="text-sm" style="color:var(--color-unergy-deep)">{{ option.nombre_comercial }}</div>
                  <div class="text-[11px]" style="color:#9b89b5">
                    {{ [option.municipio, option.departamento].filter(Boolean).join(', ') || 'Sin ubicación' }}
                    <span v-if="option.potencia_ac_kw">
                      · {{ Number(option.potencia_ac_kw).toLocaleString('es-CO', { maximumFractionDigits: 0 }) }} kWp
                    </span>
                  </div>
                </div>
              </template>
            </MultiSelect>
            <p class="ayuda" :style="o.proyecto_ids?.length ? '' : 'color:#D64455'">
              <template v-if="o.proyecto_ids?.length">
                {{ o.proyecto_ids.length }} planta(s) vinculadas: la oferta va a traer su
                ubicación, operador de red y ficha técnica.
              </template>
              <template v-else>
                Sin vincular, la oferta queda con el nombre y nada más. Si la planta
                todavía no existe, se crea desde el panel de la oferta después de registrar.
              </template>
            </p>
          </div>
          <div>
            <label class="etiqueta">Etapa inicial</label>
            <Select v-model="o.estado" :options="ETAPAS_INICIALES" optionLabel="label" optionValue="value"
                    class="w-full" />
          </div>
          <div>
            <label class="etiqueta">Fecha de envío</label>
            <DatePicker v-model="o.fecha_oferta" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
          <div>
            <label class="etiqueta">{{ etiquetaPrecio(o.tipo) }}</label>
            <InputText v-model.trim="o.precio_detalle" class="w-full"
                       :placeholder="placeholderPrecio(o.tipo)" />
          </div>
          <div>
            <label class="etiqueta">Inicio tentativo</label>
            <DatePicker v-model="o.fecha_tentativa_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
        </div>
        <p v-if="ayudaPrecio(o.tipo)" class="ayuda">{{ ayudaPrecio(o.tipo) }}</p>
        <p v-if="o.tipo && o.fecha_oferta && o.estado === 'oportunidad'" class="ayuda">
          Tiene fecha de envío pero la etapa dice «Oportunidad». Si ya se envió, movela a «Oferta».
        </p>
      </div>

      <Button label="Agregar otra oferta" outlined size="small" class="self-start" @click="agregarOferta">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
      <p class="ayuda">
        Una oferta por planta × servicio. Es la unidad del tablero: sin al menos una,
        el registro no aparecería en ninguna vista.
      </p>
    </div>

    <!-- ── Paso 3: confirmar ───────────────────────────────────────────── -->
    <div v-else class="flex flex-col gap-3">
      <div class="rounded-lg p-3" style="background:#FAF8FC;border:1px solid #e8e0f0">
        <div class="text-xs font-semibold mb-1" style="color:#7a6e8a">CLIENTE</div>
        <div class="text-sm font-medium" style="color:var(--color-unergy-deep)">{{ resumenCliente }}</div>
        <div v-if="modo === 'nuevo'" class="text-xs mt-1" style="color:#9b89b5">
          Se crea nuevo, con {{ contactosValidos.length }} contacto(s).
        </div>
      </div>

      <div class="rounded-lg p-3" style="background:#FAF8FC;border:1px solid #e8e0f0">
        <div class="text-xs font-semibold mb-2" style="color:#7a6e8a">
          {{ ofertas.length }} OFERTA(S)
        </div>
        <div v-for="(o, i) in ofertas" :key="i"
             class="flex items-center justify-between py-1.5 text-sm"
             :class="i ? 'border-t' : ''" style="border-color:#e8e0f0">
          <div class="min-w-0">
            <div style="color:var(--color-unergy-deep)">{{ o.planta_nombre || 'Sin planta' }}</div>
            <div class="text-xs" style="color:#9b89b5">
              {{ labelTipo(o.tipo) }} · {{ labelEtapa(o.estado) }}
              <span v-if="o.proyecto_ids?.length">· {{ o.proyecto_ids.length }} proyecto(s)</span>
            </div>
          </div>
          <span class="text-[10px] rounded px-1.5 py-0.5 flex-shrink-0"
                style="background:#F4EEFB;color:var(--color-unergy-purple-dark)">OP.{{ segmentoTipo(o.tipo) }} No.…</span>
        </div>
        <p class="ayuda">
          El código de seguimiento lo genera el backend con el consecutivo global y el
          mes de la fecha de envío.
        </p>
      </div>

      <Message v-if="errorGuardado" severity="error" :closable="false">
        <span class="text-xs">{{ errorGuardado }}</span>
      </Message>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <Button v-if="paso > 0" label="Atrás" text :disabled="guardando" @click="paso -= 1">
          <template #icon><ChevronLeftIcon class="size-[1em]" /></template>
        </Button>
        <span v-else />
        <div class="flex items-center gap-2">
          <Button label="Cancelar" text severity="secondary" :disabled="guardando" @click="cerrar(false)" />
          <Button v-if="paso < PASOS.length - 1" label="Continuar" class="flex-row-reverse"
                  :disabled="!pasoCompleto" @click="paso += 1">
            <template #icon><ChevronRightIcon class="size-[1em]" /></template>
          </Button>
          <Button v-else label="Registrar" :loading="guardando" :disabled="!pasoCompleto" @click="guardar">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import { toast } from 'vue-sonner'
import {
  TIPOS_OFERTA, ORIGENES_CLIENTE, labelTipo, labelEtapa, segmentoTipo, aFechaStr,
  etiquetaPrecio, placeholderPrecio, ayudaPrecio,
} from './comercial.js'
import { cargarClientes, cargarProyectos } from './catalogos.js'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from '@lucide/vue'

const props = defineProps({
  visible: Boolean,
  acciones: { type: Object, required: true },
})
const emit = defineEmits(['update:visible', 'registrada'])


const PASOS = ['Cliente', 'Ofertas', 'Confirmar']
const SUBTITULOS = [
  'A quién le vendemos',
  'Qué le ofrecemos — una oferta por planta × servicio',
  'Revisá antes de crear',
]
const MODOS = [
  { label: 'Cliente existente', value: 'existente' },
  { label: 'Cliente nuevo', value: 'nuevo' },
]
// Al registrar solo tienen sentido las dos primeras etapas: un contrato firmado
// no se "registra" acá, se firma desde su oferta para que quede el PPA enlazado.
const ETAPAS_INICIALES = [
  { label: 'Oportunidad — todavía no se envió', value: 'oportunidad' },
  { label: 'Oferta — ya se envió al cliente', value: 'oferta' },
]
const TIPOS_CONTACTO = [
  { label: 'Comercial', value: 'comercial' },
  { label: 'Liquidación', value: 'liquidacion' },
  { label: 'Operacional', value: 'operacional' },
  { label: 'CGM', value: 'cgm' },
  { label: 'Contable', value: 'contable' },
]

const paso = ref(0)
const modo = ref('existente')
const guardando = ref(false)
const errorGuardado = ref('')
const duplicado = ref(null)
const forzarDuplicado = ref(false)

const clientes = ref([])
const sugerencias = ref([])
const clienteSel = ref(null)
const proyectos = ref([])
const cargandoCatalogos = ref(false)

const negocio = reactive({ nombre: '', notas: '' })
const nuevo = reactive({
  razon_social_nombre: '', nit_cedula: '', origen_tipo: null, origen_detalle: '',
  contactos: [{ nombre: '', telefono: '', email: '', tipo: 'comercial' }],
})

function ofertaVacia() {
  return {
    tipo: null, planta_nombre: '', proyecto_ids: [], estado: 'oportunidad',
    fecha_oferta: null, precio_detalle: '', fecha_tentativa_inicio: null,
  }
}
const ofertas = ref([ofertaVacia()])

function agregarOferta() {
  // Hereda planta y tipo de la anterior: casi siempre se registran dos ofertas
  // del mismo cliente que se diferencian en poco.
  const ultima = ofertas.value[ofertas.value.length - 1]
  ofertas.value.push({ ...ofertaVacia(), tipo: ultima?.tipo ?? null })
}

const contactosValidos = computed(() =>
  nuevo.contactos.filter((c) => c.email.includes('@') && !c.email.startsWith('@') && !c.email.endsWith('@')))

const resumenCliente = computed(() =>
  modo.value === 'existente'
    ? (clienteSel.value?.razon_social_nombre ?? '—')
    : (nuevo.razon_social_nombre || '—'))

const pasoCompleto = computed(() => {
  if (paso.value === 0) {
    return modo.value === 'existente'
      ? !!clienteSel.value?.id
      : nuevo.razon_social_nombre.length > 0 && contactosValidos.value.length > 0
  }
  if (paso.value === 1) return ofertas.value.length > 0 && ofertas.value.every((o) => !!o.tipo)
  return true
})

async function cargarCatalogos() {
  const [cl, pr] = await Promise.allSettled([cargarClientes(), cargarProyectos()])
  if (cl.status === 'fulfilled') clientes.value = cl.value
  else toast.warning('No se pudo cargar la lista de clientes', { duration: 4000 })
  if (pr.status === 'fulfilled') proyectos.value = pr.value
  // El fallo de proyectos también se avisa: quedarse sin la lista de plantas y
  // no enterarse es cómo se registraban ofertas sin vincular a ningún proyecto.
  else toast.warning('No se pudo cargar la lista de plantas', { duration: 4000 })
  cargandoCatalogos.value = false
}

watch(() => props.visible, (abierto) => {
  if (abierto) {
    if (!clientes.value.length && !proyectos.value.length) {
      cargandoCatalogos.value = true
      cargarCatalogos()
    }
  } else {
    reiniciar()
  }
})

function reiniciar() {
  paso.value = 0
  modo.value = 'existente'
  clienteSel.value = null
  errorGuardado.value = ''
  duplicado.value = null
  forzarDuplicado.value = false
  negocio.nombre = ''
  negocio.notas = ''
  Object.assign(nuevo, {
    razon_social_nombre: '', nit_cedula: '', origen_tipo: null, origen_detalle: '',
    contactos: [{ nombre: '', telefono: '', email: '', tipo: 'comercial' }],
  })
  ofertas.value = [ofertaVacia()]
}

function buscarCliente(e) {
  const q = (e.query ?? '').toLowerCase()
  sugerencias.value = clientes.value.filter((c) =>
    `${c.razon_social_nombre ?? ''} ${c.nit_cedula ?? ''}`.toLowerCase().includes(q))
}

function usarCandidato() {
  const candidato = clientes.value.find((c) => c.id === duplicado.value.candidato_id)
  modo.value = 'existente'
  clienteSel.value = candidato ?? {
    id: duplicado.value.candidato_id,
    razon_social_nombre: duplicado.value.candidato_nombre,
  }
  duplicado.value = null
  paso.value = PASOS.length - 1
}

function cerrar(v) {
  if (guardando.value) return
  emit('update:visible', v === true)
}

function payload() {
  const base = {
    nombre: negocio.nombre || null,
    notas: negocio.notas || null,
    forzar_cliente_duplicado: forzarDuplicado.value,
    ofertas: ofertas.value.map((o) => ({
      tipo: o.tipo,
      planta_nombre: o.planta_nombre || null,
      proyecto_ids: o.proyecto_ids?.length ? o.proyecto_ids : null,
      estado: o.estado,
      fecha_oferta: aFechaStr(o.fecha_oferta),
      precio_detalle: o.precio_detalle || null,
      fecha_tentativa_inicio: aFechaStr(o.fecha_tentativa_inicio),
    })),
  }
  if (modo.value === 'existente') return { ...base, cliente_id: clienteSel.value.id }
  return {
    ...base,
    cliente_nuevo: {
      razon_social_nombre: nuevo.razon_social_nombre,
      nit_cedula: nuevo.nit_cedula || null,
      origen_tipo: nuevo.origen_tipo,
      origen_detalle: nuevo.origen_detalle || null,
      contactos: contactosValidos.value.map((c) => ({
        nombre: c.nombre || null, telefono: c.telefono || null,
        email: c.email.toLowerCase(), tipo: c.tipo,
      })),
    },
  }
}

async function guardar() {
  guardando.value = true
  errorGuardado.value = ''
  duplicado.value = null
  const r = await props.acciones.registrar(payload())
  guardando.value = false

  if (r.ok) {
    const n = r.oportunidad.ofertas?.length ?? 0
    toast.success(`${n} oferta(s) registrada(s)`, { description: 'Ya están en el tablero.', duration: 3500 })
    emit('registrada', r.oportunidad)
    emit('update:visible', false)
    return
  }
  if (r.duplicado?.duplicado_nombre || r.duplicado?.duplicado_nit) {
    duplicado.value = r.duplicado
    paso.value = 0
    return
  }
  errorGuardado.value = r.error
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
