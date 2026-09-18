<!--
  /comercial — una sola pantalla.

  El TABLERO es la vista por defecto (antes arrancaba en tabla) y la tabla queda
  como segunda vista para filtrar en volumen y exportar. Ambas comparten la misma
  carga, los mismos filtros y el mismo drawer, que se abre con ?oferta=<id> para
  que el enlace se pueda pegar en un chat y sobreviva un F5.
-->
<template>
  <!-- Sin padding propio: el <main> del shell ya lo paga en todos los
       breakpoints (px-4 pt-4 pb-8 md:px-8 md:pt-6). Agregar el propio dejaba
       padding anidado, más grueso mientras más ancha la pantalla. -->
  <div>
    <PageHeader class="mb-4" title="Comercial"
                subtitle="Pipeline de ofertas — la oferta es la unidad del negocio, no el cliente">
      <template #actions>
        <SelectButton v-model="vista" :options="VISTAS" optionLabel="label" optionValue="value"
                      :allowEmpty="false" />
        <Button label="Registrar oferta" class="whitespace-nowrap" @click="mostrarWizard = true">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <KpisComercial :banda="banda" :alerta-dias="alertaDias" @filtrar="aplicarAtajo" />

    <!-- Filtros, compartidos por las dos vistas.

         Los anchos fijos (w-72/w-52/w-48) no encogían: debajo de ~1100px cada
         control caía en su propia fila y en celular eran cinco filas apiladas
         que empujaban la primera fila de datos una pantalla entera hacia abajo.
         Ahora: a ancho completo debajo de `sm`, con los mismos anchos de antes
         desde `sm`, y debajo de `lg` los secundarios se pliegan detrás del
         botón "Filtros". En `lg`+ el botón no existe y todo va expandido en una
         sola fila, exactamente como hasta ahora. -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <IconField class="w-full sm:w-auto">
        <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
        <InputText v-model.trim="filtros.texto" placeholder="Código, cliente, planta, municipio…"
                   class="w-full sm:w-72" />
      </IconField>

      <!-- El conteo es lo que evita que un filtro quede activo y escondido:
           plegado, el botón sigue diciendo cuántos hay puestos. -->
      <Button v-if="!esEscritorio" :label="filtrosAbiertos ? 'Ocultar' : etiquetaFiltros"
              outlined size="small"
              @click="filtrosAbiertos = !filtrosAbiertos">
        <template #icon><component :is="filtrosAbiertos ? ChevronUpIcon : FilterIcon" class="size-[1em]" /></template>
      </Button>

      <MultiSelect v-show="filtrosVisibles" v-model="filtros.tipos" :options="TIPOS_OFERTA"
                   optionLabel="label" optionValue="value" placeholder="Tipo de oferta"
                   :maxSelectedLabels="1" class="w-full sm:w-52" />
      <MultiSelect v-show="filtrosVisibles" v-model="filtros.clientes" :options="clientesDisponibles"
                   optionLabel="nombre" optionValue="id" filter placeholder="Cliente"
                   :maxSelectedLabels="1" class="w-full sm:w-52" />
      <MultiSelect v-if="vista === 'tabla'" v-show="filtrosVisibles" v-model="filtros.etapas"
                   :options="ETAPAS" optionLabel="label" optionValue="value" placeholder="Etapa"
                   :maxSelectedLabels="1" class="w-full sm:w-48" />
      <Select v-if="vista === 'tabla'" v-show="filtrosVisibles" v-model="orden" :options="ORDENES"
              optionLabel="label" optionValue="value" class="w-full sm:w-48" />
      <div v-show="filtrosVisibles" class="flex items-center gap-1.5">
        <Checkbox v-model="filtros.soloAlerta" binary inputId="soloAlerta" />
        <label for="soloAlerta" class="text-sm" style="color:#7a6e8a">Solo con alerta</label>
      </div>
      <div v-show="filtrosVisibles" class="flex items-center gap-1.5">
        <Checkbox v-model="filtros.soloSinRespuesta" binary inputId="soloSinResp" />
        <label for="soloSinResp" class="text-sm" style="color:#7a6e8a">Solo sin respuesta</label>
      </div>
      <Button v-if="hayFiltros" v-show="filtrosVisibles" label="Limpiar" text size="small" @click="limpiarFiltros">
        <template #icon><FilterXIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Falla de carga: se distingue de "no hay ofertas" a propósito -->
    <div v-if="errorCarga" class="rounded-lg p-4 text-center space-y-2 mb-4"
         style="background:#FEF2F2;border:1px solid rgba(214,68,85,0.2)">
      <p class="text-sm" style="color:#D64455">No se pudieron cargar las ofertas: {{ errorCarga }}</p>
      <Button label="Reintentar" size="small" outlined @click="cargar()">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <div v-else-if="cargando && !ofertas.length" class="flex justify-center py-16">
      <ProgressSpinner style="width:2.5rem;height:2.5rem" strokeWidth="4" />
    </div>

    <!-- Vacío real: no hay nada registrado todavía -->
    <div v-else-if="!ofertas.length" class="rounded-lg p-10 text-center"
         style="background:#FAF8FC;border:1px dashed #e0d3f5">
      <BriefcaseIcon class="text-3xl mb-3 block size-[1em]" style="color:#c4b8d4" />
      <p class="text-sm mb-3" style="color:#7a6e8a">Todavía no hay ofertas registradas.</p>
      <Button label="Registrar la primera" @click="mostrarWizard = true">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <template v-else>
      <TableroOfertas v-if="vista === 'tablero'" :por-columna="porColumna"
                      :oferta-abierta-id="ofertaAbierta?.id"
                      @abrir="abrirOferta" @mover="mover" @firmar="pedirFirma" @declinar="pedirDeclinar" />
      <TablaOfertas v-else :ofertas="filtradas" @abrir="abrirOferta" />
    </template>

    <OfertaDrawer v-model:visible="drawerAbierto" :oferta="ofertaAbierta" :acciones="acciones"
                  @firmar="pedirFirma" />

    <RegistrarOfertaWizard v-model:visible="mostrarWizard" :acciones="acciones"
                           @registrada="trasRegistrar" />

    <FirmarOfertaDialog v-model:visible="mostrarFirmar" :oferta="ofertaAFirmar" :acciones="acciones"
                        @firmada="cargar()" />

    <!-- Declinar pide el motivo: sin él, el histórico solo dice que se perdió. -->
    <Dialog v-model:visible="mostrarDeclinar" modal header="Declinar oferta" :style="{ width: '28rem' }">
      <p class="text-sm mb-3" style="color:#7a6e8a">
        {{ ofertaADeclinar?.planta_nombre || ofertaADeclinar?.cliente_razon_social }}
      </p>
      <label class="block text-xs mb-1" style="color:#7a6e8a">Motivo *</label>
      <Textarea v-model="motivoDeclinar" rows="3" autoResize class="w-full"
                placeholder="Por qué se cayó el negocio" />
      <template #footer>
        <Button label="Cancelar" text severity="secondary" @click="mostrarDeclinar = false" />
        <Button label="Declinar" severity="danger" :disabled="!motivoDeclinar.trim()"
                :loading="declinando" @click="declinar" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import ProgressSpinner from 'primevue/progressspinner'
import { toast } from 'vue-sonner'
import PageHeader from '~/components/blocks/PageHeader.vue'
import KpisComercial from './KpisComercial.vue'
import TableroOfertas from './TableroOfertas.vue'
import TablaOfertas from './TablaOfertas.vue'
import OfertaDrawer from './OfertaDrawer.vue'
import RegistrarOfertaWizard from './RegistrarOfertaWizard.vue'
import FirmarOfertaDialog from './FirmarOfertaDialog.vue'
import { useOfertas } from './useOfertas.js'
import { ETAPAS, TIPOS_OFERTA } from './comercial.js'
import { BriefcaseIcon, ChevronUpIcon, FilterIcon, FilterXIcon, PlusIcon, RefreshCwIcon, SearchIcon } from '@lucide/vue'

const route = useRoute()
const router = useRouter()

const VISTAS = [
  { label: 'Tablero', value: 'tablero' },
  { label: 'Tabla', value: 'tabla' },
]
const ORDENES = [
  { label: 'Más reciente', value: 'reciente' },
  { label: 'Más rezagadas', value: 'rezagadas' },
  { label: 'Mayor energía', value: 'energia' },
  { label: 'Cliente (A-Z)', value: 'cliente' },
  { label: 'Más antiguo', value: 'antiguo' },
]

// El tablero es la vista de entrada. Se recuerda la última elección para no
// pelear con quien trabaja siempre en la tabla.
const vista = ref(localStorage.getItem('comercial:vista') || 'tablero')
watch(vista, (v) => localStorage.setItem('comercial:vista', v))

const {
  ofertas, cargando, errorCarga, alertaDias,
  filtros, orden, filtradas, porColumna, banda, clientesDisponibles, hayFiltros, limpiarFiltros,
  cargar, moverEtapa, guardarOferta, registrarSeguimiento, registrarGestion,
  eliminarOferta, firmar, registrar,
} = useOfertas()

// Las mutaciones se pasan como un objeto a los hijos: el drawer y los diálogos
// necesitan el RESULTADO de cada acción, que un emit no devuelve.
const acciones = {
  moverEtapa, guardarOferta, registrarSeguimiento, registrarGestion,
  eliminarOferta, firmar, registrar,
}

// ── Filtros secundarios plegables (solo debajo de lg) ───────────────────────
// El plegado se decide en JS, no con clases `lg:hidden`, porque PrimeVue va
// montado sin cssLayer: sus estilos entran al <head> DESPUÉS de la hoja de
// Tailwind y con la misma especificidad (`.p-multiselect` vs `.hidden`, ambos
// 0-1-0), así que empatan y gana el que llegó último — PrimeVue. Sobre la raíz
// de un componente suyo, las utilidades de display de Tailwind son inertes.
// `v-show` escribe estilo inline, que gana siempre.
const LG = '(min-width: 1024px)'
// Se lee sincrónicamente en el setup para que el primer pintado ya sea el
// correcto: arrancar en false hacía parpadear los filtros en escritorio.
const esEscritorio = ref(window.matchMedia(LG).matches)
const consultaLg = window.matchMedia(LG)
function alCambiarAncho(e) { esEscritorio.value = e.matches }
onMounted(() => consultaLg.addEventListener('change', alCambiarAncho))
onUnmounted(() => consultaLg.removeEventListener('change', alCambiarAncho))

const filtrosAbiertos = ref(false)
const filtrosVisibles = computed(() => esEscritorio.value || filtrosAbiertos.value)

// El buscador queda fuera del conteo porque nunca se esconde.
const nFiltrosSecundarios = computed(() =>
  (filtros.tipos.length ? 1 : 0)
  + (filtros.clientes.length ? 1 : 0)
  + (filtros.etapas.length ? 1 : 0)
  + (filtros.soloAlerta ? 1 : 0)
  + (filtros.soloSinRespuesta ? 1 : 0))

const etiquetaFiltros = computed(() =>
  nFiltrosSecundarios.value ? `Filtros (${nFiltrosSecundarios.value})` : 'Filtros')

const mostrarWizard = ref(false)
const mostrarFirmar = ref(false)
const ofertaAFirmar = ref(null)
const mostrarDeclinar = ref(false)
const ofertaADeclinar = ref(null)
const motivoDeclinar = ref('')
const declinando = ref(false)

// ── Drawer con deep-link (?oferta=<id>) ─────────────────────────────────────
const ofertaAbiertaId = computed(() => {
  const v = route.query.oferta
  return v ? Number(v) : null
})
const ofertaAbierta = computed(() =>
  ofertas.value.find((o) => o.id === ofertaAbiertaId.value) ?? null)

const drawerAbierto = computed({
  get: () => !!ofertaAbierta.value,
  set: (v) => { if (!v) router.replace({ query: { ...route.query, oferta: undefined } }) },
})

function abrirOferta(oferta) {
  router.replace({ query: { ...route.query, oferta: oferta.id } })
}

// Un id en la URL que no existe (oferta borrada, enlace viejo) se avisa y se
// limpia: dejarlo puesto deja el drawer cerrado sin explicar por qué.
watch([ofertaAbiertaId, ofertas], () => {
  if (ofertaAbiertaId.value && ofertas.value.length && !ofertaAbierta.value) {
    toast.warning('Esa oferta ya no existe', {
      description: `No se encontró la oferta #${ofertaAbiertaId.value}.`,
      duration: 4000,
    })
    router.replace({ query: { ...route.query, oferta: undefined } })
  }
})

// ── Acciones del tablero ────────────────────────────────────────────────────
async function mover(oferta, estado) {
  const r = await moverEtapa(oferta, estado)
  if (!r.ok) {
    toast.error('No se pudo cambiar la etapa', { description: r.error, duration: 5000 })
  }
}

function pedirFirma(oferta) {
  // Servicios operacionales no deriva en PPA: el backend responde 422.
  if (oferta.tipo === 'servicios_operacionales') {
    toast.info('Esta oferta no genera un PPA', {
      description: 'Las de servicios derivan en un contrato de representación, que se crea en Servicios.',
      duration: 6000,
    })
    return
  }
  if (oferta.ppa_contrato_id) {
    toast.info('Ya tiene contrato', {
      description: `Contrato PPA #${oferta.ppa_contrato_id}.`,
      duration: 4000,
    })
    return
  }
  ofertaAFirmar.value = oferta
  mostrarFirmar.value = true
}

function pedirDeclinar(oferta) {
  ofertaADeclinar.value = oferta
  motivoDeclinar.value = ''
  mostrarDeclinar.value = true
}

async function declinar() {
  declinando.value = true
  const oferta = ofertaADeclinar.value
  const r = await moverEtapa(oferta, 'declinado')
  if (r.ok) {
    // El motivo va a la bitácora de ESTA oferta: el histórico de etapas solo
    // guarda el "de dónde a dónde", no el por qué.
    await registrarGestion(oferta.oportunidad_id, {
      tipo: 'nota',
      descripcion: `Oferta declinada: ${motivoDeclinar.value.trim()}`,
      ofertaId: oferta.id,
    })
    mostrarDeclinar.value = false
  } else {
    toast.error('No se pudo declinar', { description: r.error, duration: 5000 })
  }
  declinando.value = false
}

async function trasRegistrar(oportunidad) {
  await cargar()
  // Se abre la primera oferta recién creada: el registro termina donde empieza
  // el trabajo, no en una pantalla de éxito.
  const primera = oportunidad?.ofertas?.[0]
  if (primera) abrirOferta(primera)
}

// Atajos de la banda de indicadores.
function aplicarAtajo(cual) {
  if (cual === 'alerta') {
    filtros.soloAlerta = !filtros.soloAlerta
    filtros.soloSinRespuesta = false
  } else if (cual === 'sinRespuesta') {
    filtros.soloSinRespuesta = !filtros.soloSinRespuesta
    filtros.soloAlerta = false
  }
}

onMounted(cargar)
</script>
