<!--
  /comercial — una sola pantalla.

  El TABLERO es la vista por defecto (antes arrancaba en tabla) y la tabla queda
  como segunda vista para filtrar en volumen y exportar. Ambas comparten la misma
  carga, los mismos filtros y el mismo drawer, que se abre con ?oferta=<id> para
  que el enlace se pueda pegar en un chat y sobreviva un F5.
-->
<script setup lang="ts">
import type { Oferta } from '~/features/comercial/types'
import {
  BriefcaseIcon,
  ChevronUpIcon,
  FilterIcon,
  FilterXIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ETAPAS, TIPOS_OFERTA } from './comercial'
import FirmarOfertaDialog from './FirmarOfertaDialog.vue'
import KpisComercial from './KpisComercial.vue'
import OfertaDrawer from './OfertaDrawer.vue'
import RegistrarOfertaWizard from './RegistrarOfertaWizard.vue'
import TablaOfertas from './TablaOfertas.vue'
import TableroOfertas from './TableroOfertas.vue'
import { useOfertas } from './useOfertas'

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
const vista = ref<'tablero' | 'tabla'>('tablero')
onMounted(() => {
  const guardada = localStorage.getItem('comercial:vista')
  if (guardada === 'tablero' || guardada === 'tabla') vista.value = guardada
})
watch(vista, (v) => localStorage.setItem('comercial:vista', v))

const {
  ofertas,
  cargando,
  errorCarga,
  alertaDias,
  filtros,
  orden,
  filtradas,
  porColumna,
  banda,
  clientesDisponibles,
  hayFiltros,
  limpiarFiltros,
  cargar,
  moverEtapa,
  guardarOferta,
  registrarSeguimiento,
  registrarGestion,
  eliminarOferta,
  firmar,
  registrar,
} = useOfertas()

// Las mutaciones se pasan como un objeto a los hijos: el drawer y los diálogos
// necesitan el RESULTADO de cada acción, que un emit no devuelve.
const acciones = {
  moverEtapa,
  guardarOferta,
  registrarSeguimiento,
  registrarGestion,
  eliminarOferta,
  firmar,
  registrar,
}

// ── Filtros secundarios plegables (solo debajo de lg) ───────────────────────
const LG = '(min-width: 1024px)'
// Arranca asumiendo escritorio: en SSR no hay `window`, y el resultado real
// llega en el próximo tick vía `onMounted` sin que se note un parpadeo.
const esEscritorio = ref(true)
function alCambiarAncho(e: MediaQueryListEvent) {
  esEscritorio.value = e.matches
}
let consultaLg: MediaQueryList | undefined
onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  consultaLg = window.matchMedia(LG)
  esEscritorio.value = consultaLg.matches
  consultaLg.addEventListener('change', alCambiarAncho)
})
onUnmounted(() => consultaLg?.removeEventListener('change', alCambiarAncho))

const filtrosAbiertos = ref(false)
const filtrosVisibles = computed(() => esEscritorio.value || filtrosAbiertos.value)

// El buscador queda fuera del conteo porque nunca se esconde.
const nFiltrosSecundarios = computed(
  () =>
    (filtros.tipos.length ? 1 : 0) +
    (filtros.clientes.length ? 1 : 0) +
    (filtros.etapas.length ? 1 : 0) +
    (filtros.soloAlerta ? 1 : 0) +
    (filtros.soloSinRespuesta ? 1 : 0),
)

const etiquetaFiltros = computed(() =>
  nFiltrosSecundarios.value ? `Filtros (${nFiltrosSecundarios.value})` : 'Filtros',
)

const mostrarWizard = ref(false)
const mostrarFirmar = ref(false)
const ofertaAFirmar = ref<Oferta | null>(null)
const mostrarDeclinar = ref(false)
const ofertaADeclinar = ref<Oferta | null>(null)
const motivoDeclinar = ref('')
const declinando = ref(false)

// ── Drawer con deep-link (?oferta=<id>) ─────────────────────────────────────
const ofertaAbiertaId = computed(() => {
  const v = route.query.oferta
  return v ? Number(v) : null
})
const ofertaAbierta = computed(
  () => ofertas.value.find((o) => o.id === ofertaAbiertaId.value) ?? null,
)

const drawerAbierto = computed({
  get: () => !!ofertaAbierta.value,
  set: (v) => {
    if (!v) router.replace({ query: { ...route.query, oferta: undefined } })
  },
})

function abrirOferta(oferta: Oferta) {
  router.replace({ query: { ...route.query, oferta: oferta.id } })
}

// Un id en la URL que no existe (oferta borrada, enlace viejo) se avisa y se
// limpia: dejarlo puesto deja el drawer cerrado sin explicar por qué.
watch([ofertaAbiertaId, ofertas], () => {
  if (ofertaAbiertaId.value && ofertas.value.length && !ofertaAbierta.value) {
    toast.warning('Esa oferta ya no existe', {
      description: `No se encontró la oferta #${ofertaAbiertaId.value}.`,
    })
    router.replace({ query: { ...route.query, oferta: undefined } })
  }
})

// ── Acciones del tablero ────────────────────────────────────────────────────
async function mover(oferta: Oferta, estado: string) {
  const r = await moverEtapa(oferta, estado)
  if (!r.ok) {
    toast.error('No se pudo cambiar la etapa', { description: r.error })
  }
}

function pedirFirma(oferta: Oferta) {
  // Servicios operacionales no deriva en PPA: el backend responde 422.
  if (oferta.tipo === 'servicios_operacionales') {
    toast.info('Esta oferta no genera un PPA', {
      description:
        'Las de servicios derivan en un contrato de representación, que se crea en Servicios.',
      duration: 6000,
    })
    return
  }
  if (oferta.ppa_contrato_id) {
    toast.info('Ya tiene contrato', { description: `Contrato PPA #${oferta.ppa_contrato_id}.` })
    return
  }
  ofertaAFirmar.value = oferta
  mostrarFirmar.value = true
}

function pedirDeclinar(oferta: Oferta) {
  ofertaADeclinar.value = oferta
  motivoDeclinar.value = ''
  mostrarDeclinar.value = true
}

async function declinar() {
  declinando.value = true
  const oferta = ofertaADeclinar.value
  if (!oferta) {
    declinando.value = false
    return
  }
  const r = await moverEtapa(oferta, 'declinado')
  if (r.ok) {
    // El motivo va a la bitácora de ESTA oferta: el histórico de etapas solo
    // guarda el "de dónde a dónde", no el por qué.
    await registrarGestion(oferta.oportunidad_id!, {
      tipo: 'nota',
      // La escribimos nosotros al declinar, aunque la decision haya sido del
      // cliente: la bitacora registra quien puso la entrada, y esto no debe
      // apagar la alerta de «no nos responden».
      direccion: 'saliente',
      descripcion: `Oferta declinada: ${motivoDeclinar.value.trim()}`,
      ofertaId: oferta.id,
    })
    mostrarDeclinar.value = false
  } else {
    toast.error('No se pudo declinar', { description: r.error })
  }
  declinando.value = false
}

async function trasRegistrar(oportunidad: { ofertas?: Oferta[] }) {
  await cargar()
  // Se abre la primera oferta recién creada: el registro termina donde empieza
  // el trabajo, no en una pantalla de éxito.
  const primera = oportunidad?.ofertas?.[0]
  if (primera) abrirOferta(primera)
}

// Atajos de la banda de indicadores.
function aplicarAtajo(cual: string) {
  if (cual === 'alerta') {
    filtros.soloAlerta = !filtros.soloAlerta
    filtros.soloSinRespuesta = false
  } else if (cual === 'sinRespuesta') {
    filtros.soloSinRespuesta = !filtros.soloSinRespuesta
    filtros.soloAlerta = false
  }
}

function alReintentar() {
  cargar()
}

onMounted(cargar)
</script>

<template>
  <!-- Sin padding propio: el <main> del shell ya lo paga en todos los
       breakpoints (px-4 pt-4 pb-8 md:px-8 md:pt-6). Agregar el propio dejaba
       padding anidado, más grueso mientras más ancha la pantalla. -->
  <div>
    <PageHeader
      class="mb-4"
      title="Comercial"
      subtitle="Pipeline de ofertas — la oferta es la unidad del negocio, no el cliente"
    >
      <template #actions>
        <ToggleGroup v-model="vista" type="single" variant="outline">
          <ToggleGroupItem v-for="v in VISTAS" :key="v.value" :value="v.value">{{
            v.label
          }}</ToggleGroupItem>
        </ToggleGroup>
        <Button class="whitespace-nowrap" @click="mostrarWizard = true">
          <PlusIcon class="size-4" />
          Registrar oferta
        </Button>
      </template>
    </PageHeader>

    <KpisComercial :banda="banda" :alerta-dias="alertaDias" @filtrar="aplicarAtajo" />

    <!-- Filtros, compartidos por las dos vistas.

         Los anchos fijos no encogían: debajo de ~1100px cada control caía en
         su propia fila y en celular eran cinco filas apiladas que empujaban la
         primera fila de datos una pantalla entera hacia abajo. Ahora: a ancho
         completo debajo de `sm`, con ancho repartido por el layout desde `sm`, y debajo de `lg`
         los secundarios se pliegan detrás del botón "Filtros". -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <InputGroup class="w-full sm:max-w-xs sm:flex-1">
        <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
        <InputGroupInput
          v-model.trim="filtros.texto"
          placeholder="Código, cliente, planta, municipio…"
        />
      </InputGroup>

      <!-- El conteo es lo que evita que un filtro quede activo y escondido:
           plegado, el botón sigue diciendo cuántos hay puestos. -->
      <Button
        v-if="!esEscritorio"
        variant="outline"
        size="sm"
        @click="filtrosAbiertos = !filtrosAbiertos"
      >
        <component :is="filtrosAbiertos ? ChevronUpIcon : FilterIcon" class="size-4" />
        {{ filtrosAbiertos ? 'Ocultar' : etiquetaFiltros }}
      </Button>

      <MultiComboBox
        v-show="filtrosVisibles"
        v-model="filtros.tipos"
        :options="TIPOS_OFERTA.map((t) => ({ label: t.label, value: t.value }))"
        placeholder="Tipo de oferta"
        class="w-full sm:max-w-56 sm:min-w-40 sm:flex-1"
      />
      <MultiComboBox
        v-show="filtrosVisibles"
        :model-value="filtros.clientes.map(String)"
        :options="
          clientesDisponibles.map((c) => ({
            label: c.nombre ?? `Cliente #${c.id}`,
            value: String(c.id),
          }))
        "
        placeholder="Cliente"
        class="w-full sm:max-w-56 sm:min-w-40 sm:flex-1"
        @update:model-value="(v) => (filtros.clientes = v.map(Number))"
      />
      <MultiComboBox
        v-if="vista === 'tabla'"
        v-show="filtrosVisibles"
        v-model="filtros.etapas"
        :options="ETAPAS.map((e) => ({ label: e.label, value: e.value }))"
        placeholder="Etapa"
        class="w-full sm:max-w-56 sm:min-w-40 sm:flex-1"
      />
      <Select v-if="vista === 'tabla'" v-show="filtrosVisibles" v-model="orden">
        <SelectTrigger class="w-full sm:max-w-56 sm:min-w-40 sm:flex-1"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in ORDENES" :key="o.value" :value="o.value">{{
            o.label
          }}</SelectItem>
        </SelectContent>
      </Select>
      <label
        v-show="filtrosVisibles"
        class="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Checkbox v-model="filtros.soloAlerta" /> Solo con alerta
      </label>
      <label
        v-show="filtrosVisibles"
        class="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Checkbox v-model="filtros.soloSinRespuesta" /> Solo sin respuesta
      </label>
      <Button
        v-if="hayFiltros"
        v-show="filtrosVisibles"
        variant="ghost"
        size="sm"
        @click="limpiarFiltros"
      >
        <FilterXIcon class="size-4" />
        Limpiar
      </Button>
    </div>

    <!-- Falla de carga: se distingue de "no hay ofertas" a propósito -->
    <div
      v-if="errorCarga"
      class="mb-4 space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center"
    >
      <p class="text-sm text-destructive">No se pudieron cargar las ofertas: {{ errorCarga }}</p>
      <Button variant="outline" size="sm" @click="alReintentar">
        <RefreshCwIcon class="size-4" />
        Reintentar
      </Button>
    </div>

    <div v-else-if="cargando && !ofertas.length" class="flex justify-center py-16">
      <LoaderCircleIcon class="size-10 animate-spin text-muted-foreground" />
    </div>

    <!-- Vacío real: no hay nada registrado todavía -->
    <div v-else-if="!ofertas.length" class="rounded-lg border border-dashed p-10 text-center">
      <BriefcaseIcon class="mx-auto mb-3 size-8 text-muted-foreground/60" />
      <p class="mb-3 text-sm text-muted-foreground">Todavía no hay ofertas registradas.</p>
      <Button @click="mostrarWizard = true">
        <PlusIcon class="size-4" />
        Registrar la primera
      </Button>
    </div>

    <template v-else>
      <TableroOfertas
        v-if="vista === 'tablero'"
        :por-columna="porColumna"
        :oferta-abierta-id="ofertaAbierta?.id"
        @abrir="abrirOferta"
        @mover="mover"
        @firmar="pedirFirma"
        @declinar="pedirDeclinar"
      />
      <TablaOfertas v-else :ofertas="filtradas" @abrir="abrirOferta" />
    </template>

    <OfertaDrawer
      v-model:visible="drawerAbierto"
      :oferta="ofertaAbierta"
      :acciones="acciones"
      @firmar="pedirFirma"
    />

    <RegistrarOfertaWizard
      v-model:visible="mostrarWizard"
      :acciones="acciones"
      @registrada="trasRegistrar"
    />

    <FirmarOfertaDialog
      v-model:visible="mostrarFirmar"
      :oferta="ofertaAFirmar"
      :acciones="acciones"
      @firmada="cargar()"
    />

    <!-- Declinar pide el motivo: sin él, el histórico solo dice que se perdió. -->
    <Dialog v-model:open="mostrarDeclinar">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declinar oferta</DialogTitle>
          <DialogDescription>
            {{ ofertaADeclinar?.planta_nombre || ofertaADeclinar?.cliente_razon_social }}
          </DialogDescription>
        </DialogHeader>
        <GLabel required>Motivo</GLabel>
        <Textarea v-model="motivoDeclinar" rows="3" placeholder="Por qué se cayó el negocio" />
        <DialogFooter>
          <Button variant="ghost" @click="mostrarDeclinar = false">Cancelar</Button>
          <Button
            variant="destructive"
            :disabled="!motivoDeclinar.trim() || declinando"
            @click="declinar"
          >
            <LoaderCircleIcon v-if="declinando" class="animate-spin" />
            Declinar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
