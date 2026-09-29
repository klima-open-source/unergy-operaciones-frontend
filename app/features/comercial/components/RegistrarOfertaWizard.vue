<!--
  Registro comercial en un solo flujo: cliente → ofertas → confirmar.

  El registro viejo creaba una OPORTUNIDAD sin ofertas, y el tablero y la tabla
  se alimentan de las ofertas: quien registraba veía "creado" y después no
  encontraba nada. Había que entrar al detalle, buscar la pestaña «Ofertas» y
  agregar una. Acá el paso 2 exige al menos una oferta y todo entra en una sola
  transacción (POST /comercial/registrar).

  También manda al backend lo que el formulario viejo descartaba: la etapa de
  cada oferta, sus plantas y la fecha de envío.

  No existe un patrón de "wizard" ya establecido en el codebase: este es un
  estado de paso simple (`paso` 0/1/2) con botones Atrás/Continuar sobre
  componentes shadcn, sin ningún componente de "steps" nuevo.
-->
<script setup lang="ts">
import type { Cliente } from '~/types/cliente'
import type { Oportunidad, PayloadRegistrarOportunidad } from '~/features/comercial/types'
import type { UseOfertas } from './useOfertas'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'
import { cargarClientes, cargarProyectos, type ProyectoCatalogo } from './catalogos'
import {
  ayudaPrecio,
  etiquetaPrecio,
  labelEtapa,
  labelTipo,
  ORIGENES_CLIENTE,
  placeholderPrecio,
  segmentoTipo,
  TIPOS_OFERTA,
  aFechaStr,
} from './comercial'

const props = defineProps<{
  visible: boolean
  acciones: Pick<UseOfertas, 'registrar'>
}>()
const emit = defineEmits<{
  'update:visible': [visible: boolean]
  registrada: [oportunidad: Oportunidad]
}>()

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

interface DuplicadoCliente {
  mensaje?: string
  candidato_id?: number
  candidato_nombre?: string
  [clave: string]: unknown
}

const paso = ref(0)
const modo = ref<'existente' | 'nuevo'>('existente')
const guardando = ref(false)
const errorGuardado = ref('')
const duplicado = ref<DuplicadoCliente | null>(null)
const forzarDuplicado = ref(false)

/** Lo justo que el paso 1 necesita mostrar — el candidato de un 409 duplicado
 *  no trae el `Cliente` completo, solo id y nombre. */
type ClienteResumen = Pick<Cliente, 'id' | 'razon_social_nombre'> &
  Pick<Partial<Cliente>, 'nit_cedula'>

const clientes = ref<Cliente[]>([])
const clienteSel = ref<ClienteResumen | null>(null)
const proyectos = ref<ProyectoCatalogo[]>([])
const cargandoCatalogos = ref(false)

const negocio = reactive({ nombre: '', notas: '' })
const nuevo = reactive({
  razon_social_nombre: '',
  nit_cedula: '',
  origen_tipo: null as string | null,
  origen_detalle: '',
  contactos: [{ nombre: '', telefono: '', email: '', tipo: 'comercial' }],
})

interface OfertaWizard {
  tipo: string | null
  planta_nombre: string
  proyecto_ids: number[]
  estado: string
  fecha_oferta: string | null
  precio_detalle: string
  fecha_tentativa_inicio: string | null
}

function ofertaVacia(): OfertaWizard {
  return {
    tipo: null,
    planta_nombre: '',
    proyecto_ids: [],
    estado: 'oportunidad',
    fecha_oferta: null,
    precio_detalle: '',
    fecha_tentativa_inicio: null,
  }
}
const ofertas = ref<OfertaWizard[]>([ofertaVacia()])

function agregarOferta() {
  // Hereda planta y tipo de la anterior: casi siempre se registran dos ofertas
  // del mismo cliente que se diferencian en poco.
  const ultima = ofertas.value[ofertas.value.length - 1]
  ofertas.value.push({ ...ofertaVacia(), tipo: ultima?.tipo ?? null })
}

const opcionesCliente = computed(() =>
  clientes.value.map((c) => ({
    label: c.nit_cedula ? `${c.razon_social_nombre} — NIT ${c.nit_cedula}` : c.razon_social_nombre,
    value: String(c.id),
  })),
)

const clienteSelStr = computed<string | null>({
  get: () => (clienteSel.value ? String(clienteSel.value.id) : null),
  set: (v) => {
    clienteSel.value = v ? (clientes.value.find((c) => String(c.id) === v) ?? null) : null
  },
})

const opcionesProyecto = computed(() =>
  proyectos.value.map((p) => ({
    label: [p.nombre_comercial, [p.municipio, p.departamento].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' — '),
    value: String(p.id),
  })),
)

const contactosValidos = computed(() =>
  nuevo.contactos.filter(
    (c) => c.email.includes('@') && !c.email.startsWith('@') && !c.email.endsWith('@'),
  ),
)

const resumenCliente = computed(() =>
  modo.value === 'existente'
    ? (clienteSel.value?.razon_social_nombre ?? '—')
    : nuevo.razon_social_nombre || '—',
)

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
  else toast.warning('No se pudo cargar la lista de clientes')
  if (pr.status === 'fulfilled') proyectos.value = pr.value
  // El fallo de proyectos también se avisa: quedarse sin la lista de plantas y
  // no enterarse es cómo se registraban ofertas sin vincular a ningún proyecto.
  else toast.warning('No se pudo cargar la lista de plantas')
  cargandoCatalogos.value = false
}

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
    razon_social_nombre: '',
    nit_cedula: '',
    origen_tipo: null,
    origen_detalle: '',
    contactos: [{ nombre: '', telefono: '', email: '', tipo: 'comercial' }],
  })
  ofertas.value = [ofertaVacia()]
}

watch(
  () => props.visible,
  (abierto) => {
    if (abierto) {
      if (!clientes.value.length && !proyectos.value.length) {
        cargandoCatalogos.value = true
        cargarCatalogos()
      }
    } else {
      reiniciar()
    }
  },
)

function usarCandidato() {
  const candidato = clientes.value.find((c) => c.id === duplicado.value?.candidato_id)
  modo.value = 'existente'
  clienteSel.value = candidato ?? {
    id: duplicado.value?.candidato_id ?? 0,
    razon_social_nombre: duplicado.value?.candidato_nombre ?? '',
  }
  duplicado.value = null
  paso.value = PASOS.length - 1
}

function cerrar(v: boolean) {
  if (guardando.value) return
  emit('update:visible', v === true)
}

function payload(): PayloadRegistrarOportunidad {
  const base = {
    nombre: negocio.nombre || null,
    notas: negocio.notas || null,
    forzar_cliente_duplicado: forzarDuplicado.value,
    ofertas: ofertas.value.map((o) => ({
      tipo: o.tipo,
      planta_nombre: o.planta_nombre || null,
      proyecto_ids: o.proyecto_ids.length ? o.proyecto_ids : null,
      estado: o.estado,
      fecha_oferta: aFechaStr(o.fecha_oferta),
      precio_detalle: o.precio_detalle || null,
      fecha_tentativa_inicio: aFechaStr(o.fecha_tentativa_inicio),
    })),
  }
  if (modo.value === 'existente') return { ...base, cliente_id: clienteSel.value!.id }
  return {
    ...base,
    cliente_nuevo: {
      razon_social_nombre: nuevo.razon_social_nombre,
      nit_cedula: nuevo.nit_cedula || null,
      origen_tipo: nuevo.origen_tipo,
      origen_detalle: nuevo.origen_detalle || null,
      contactos: contactosValidos.value.map((c) => ({
        nombre: c.nombre || null,
        telefono: c.telefono || null,
        email: c.email.toLowerCase(),
        tipo: c.tipo,
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
    toast.success(`${n} oferta(s) registrada(s)`, { description: 'Ya están en el tablero.' })
    emit('registrada', r.oportunidad)
    emit('update:visible', false)
    return
  }
  const dup = r.duplicado as DuplicadoCliente | null
  if (dup?.candidato_id || dup?.candidato_nombre) {
    duplicado.value = dup
    paso.value = 0
    return
  }
  errorGuardado.value = r.error
}
</script>

<template>
  <Dialog :open="visible" @update:open="cerrar">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Registrar oferta</DialogTitle>
        <DialogDescription>{{ SUBTITULOS[paso] }}</DialogDescription>
      </DialogHeader>

      <!-- Pasos -->
      <ol class="mb-2 flex items-center gap-1 text-xs">
        <li v-for="(t, i) in PASOS" :key="t" class="flex items-center gap-1">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded px-2 py-1 transition-colors"
            :class="
              i === paso ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'
            "
            :disabled="i > paso"
            @click="paso = i"
          >
            <span
              class="flex size-4 items-center justify-center rounded-full text-xs text-primary-foreground"
              :class="i <= paso ? 'bg-primary' : 'bg-muted-foreground/40'"
              >{{ i + 1 }}</span
            >
            {{ t }}
          </button>
          <ChevronRightIcon v-if="i < PASOS.length - 1" class="size-3 text-muted-foreground" />
        </li>
      </ol>

      <!-- ── Paso 1: cliente ─────────────────────────────────────────────── -->
      <div v-if="paso === 0" class="flex flex-col gap-4">
        <ToggleGroup v-model="modo" type="single" variant="outline">
          <ToggleGroupItem v-for="m in MODOS" :key="m.value" :value="m.value">{{
            m.label
          }}</ToggleGroupItem>
        </ToggleGroup>

        <div v-if="modo === 'existente'">
          <GLabel required>Cliente</GLabel>
          <ComboBox
            v-model="clienteSelStr"
            :options="opcionesCliente"
            placeholder="Buscar por razón social o NIT…"
          />
          <p v-if="clienteSel?.nit_cedula" class="mt-1 text-xs text-muted-foreground">
            NIT {{ clienteSel.nit_cedula }}
          </p>
        </div>

        <template v-else>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <GLabel required>Razón social</GLabel>
              <Input v-model.trim="nuevo.razon_social_nombre" />
            </div>
            <div>
              <GLabel>NIT / Cédula</GLabel>
              <Input v-model.trim="nuevo.nit_cedula" />
            </div>
            <div>
              <GLabel>Origen del cliente</GLabel>
              <Select
                :model-value="nuevo.origen_tipo ?? ''"
                @update:model-value="(v) => (nuevo.origen_tipo = (v as string) || null)"
              >
                <SelectTrigger class="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  <SelectItem v-for="o in ORIGENES_CLIENTE" :key="o.value" :value="o.value">{{
                    o.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <GLabel>Quién lo consiguió / recomendó</GLabel>
              <Input v-model.trim="nuevo.origen_detalle" />
            </div>
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between">
              <GLabel class="!mb-0">Contactos (al menos uno con correo)</GLabel>
              <Button
                variant="ghost"
                size="sm"
                @click="
                  nuevo.contactos.push({ nombre: '', telefono: '', email: '', tipo: 'comercial' })
                "
              >
                <PlusIcon class="size-4" />
                Agregar
              </Button>
            </div>
            <div v-for="(c, i) in nuevo.contactos" :key="i" class="mb-2 flex gap-2">
              <Input v-model.trim="c.nombre" placeholder="Nombre" class="flex-1" />
              <Input v-model.trim="c.telefono" placeholder="Teléfono" class="flex-1" />
              <Input v-model.trim="c.email" placeholder="Correo *" class="flex-1" />
              <Select v-model="c.tipo">
                <SelectTrigger class="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in TIPOS_CONTACTO" :key="t.value" :value="t.value">{{
                    t.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="nuevo.contactos.length === 1"
                @click="nuevo.contactos.splice(i, 1)"
              >
                <Trash2Icon class="size-4 text-destructive" />
              </Button>
            </div>
          </div>

          <!-- El 409 de duplicado deja de ser un error rojo sin salida. -->
          <Alert v-if="duplicado">
            <AlertTitle>Posible duplicado</AlertTitle>
            <AlertDescription class="flex flex-col gap-2">
              <p>{{ duplicado.mensaje }}</p>
              <div class="flex gap-2">
                <Button size="sm" @click="usarCandidato">Usar ese cliente</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="
                    () => {
                      forzarDuplicado = true
                      duplicado = null
                      guardar()
                    }
                  "
                  >Crear uno nuevo igual</Button
                >
              </div>
            </AlertDescription>
          </Alert>
        </template>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <GLabel>Nombre del negocio (opcional)</GLabel>
            <Input v-model.trim="negocio.nombre" placeholder="Ej: Comunidad energética 2027" />
          </div>
          <div>
            <GLabel>Notas</GLabel>
            <Input v-model.trim="negocio.notas" />
          </div>
        </div>
      </div>

      <!-- ── Paso 2: ofertas ─────────────────────────────────────────────── -->
      <div v-else-if="paso === 1" class="flex flex-col gap-3">
        <div v-for="(o, i) in ofertas" :key="i" class="rounded-lg border bg-muted/30 p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-muted-foreground">Oferta {{ i + 1 }}</span>
            <Button
              v-if="ofertas.length > 1"
              variant="ghost"
              size="icon-sm"
              @click="ofertas.splice(i, 1)"
            >
              <Trash2Icon class="size-4 text-destructive" />
            </Button>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <GLabel required>Tipo de oferta</GLabel>
              <Select
                :model-value="o.tipo ?? undefined"
                @update:model-value="(v) => (o.tipo = v as string)"
              >
                <SelectTrigger class="w-full"
                  ><SelectValue placeholder="Seleccionar…"
                /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in TIPOS_OFERTA" :key="t.value" :value="t.value">{{
                    t.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <GLabel>Planta (nombre libre)</GLabel>
              <Input v-model.trim="o.planta_nombre" placeholder="Ej: Balmora 1 y 2" />
            </div>
            <!-- El vínculo a la planta REAL. Sin él la oferta queda sin proyecto y
                 /comercial/proyectos-operando la devuelve sin ubicación, sin operador
                 de red y sin ningún dato técnico: todo eso vive en el Proyecto. -->
            <div class="sm:col-span-2">
              <GLabel>Plantas ya creadas en Proyectos</GLabel>
              <MultiComboBox
                :model-value="o.proyecto_ids.map(String)"
                :options="opcionesProyecto"
                :placeholder="
                  cargandoCatalogos
                    ? 'Cargando…'
                    : 'Buscá la planta por nombre, municipio o departamento…'
                "
                @update:model-value="(v) => (o.proyecto_ids = v.map(Number))"
              />
              <p
                class="mt-1 text-xs"
                :class="o.proyecto_ids.length ? 'text-muted-foreground' : 'text-destructive'"
              >
                <template v-if="o.proyecto_ids.length">
                  {{ o.proyecto_ids.length }} planta(s) vinculadas: la oferta va a traer su
                  ubicación, operador de red y ficha técnica.
                </template>
                <template v-else>
                  Sin vincular, la oferta queda con el nombre y nada más. Si la planta todavía no
                  existe, se crea desde el panel de la oferta después de registrar.
                </template>
              </p>
            </div>
            <div>
              <GLabel>Etapa inicial</GLabel>
              <Select v-model="o.estado">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="e in ETAPAS_INICIALES" :key="e.value" :value="e.value">{{
                    e.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <GLabel>Fecha de envío</GLabel>
              <DatePicker v-model="o.fecha_oferta" clearable />
            </div>
            <div>
              <GLabel>{{ etiquetaPrecio(o.tipo) }}</GLabel>
              <Input v-model.trim="o.precio_detalle" :placeholder="placeholderPrecio(o.tipo)" />
            </div>
            <div>
              <GLabel>Inicio tentativo</GLabel>
              <DatePicker v-model="o.fecha_tentativa_inicio" clearable />
            </div>
          </div>
          <p v-if="ayudaPrecio(o.tipo)" class="mt-2 text-xs text-muted-foreground">
            {{ ayudaPrecio(o.tipo) }}
          </p>
          <p
            v-if="o.tipo && o.fecha_oferta && o.estado === 'oportunidad'"
            class="mt-1 text-xs text-muted-foreground"
          >
            Tiene fecha de envío pero la etapa dice «Oportunidad». Si ya se envió, movela a
            «Oferta».
          </p>
        </div>

        <Button variant="outline" size="sm" class="self-start" @click="agregarOferta">
          <PlusIcon class="size-4" />
          Agregar otra oferta
        </Button>
        <p class="text-xs text-muted-foreground">
          Una oferta por planta × servicio. Es la unidad del tablero: sin al menos una, el registro
          no aparecería en ninguna vista.
        </p>
      </div>

      <!-- ── Paso 3: confirmar ───────────────────────────────────────────── -->
      <div v-else class="flex flex-col gap-3">
        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="mb-1 text-xs font-semibold text-muted-foreground">CLIENTE</div>
          <div class="text-sm font-medium text-foreground">{{ resumenCliente }}</div>
          <div v-if="modo === 'nuevo'" class="mt-1 text-xs text-muted-foreground">
            Se crea nuevo, con {{ contactosValidos.length }} contacto(s).
          </div>
        </div>

        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="mb-2 text-xs font-semibold text-muted-foreground">
            {{ ofertas.length }} OFERTA(S)
          </div>
          <div
            v-for="(o, i) in ofertas"
            :key="i"
            class="flex items-center justify-between py-1.5 text-sm"
            :class="i ? 'border-t' : ''"
          >
            <div class="min-w-0">
              <div class="text-foreground">{{ o.planta_nombre || 'Sin planta' }}</div>
              <div class="text-xs text-muted-foreground">
                {{ labelTipo(o.tipo) }} · {{ labelEtapa(o.estado) }}
                <span v-if="o.proyecto_ids.length">· {{ o.proyecto_ids.length }} proyecto(s)</span>
              </div>
            </div>
            <span class="flex-shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >OP.{{ segmentoTipo(o.tipo) }} No.…</span
            >
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            El código de seguimiento lo genera el backend con el consecutivo global y el mes de la
            fecha de envío.
          </p>
        </div>

        <Alert v-if="errorGuardado" variant="destructive">
          <AlertDescription>{{ errorGuardado }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter class="flex items-center justify-between sm:justify-between">
        <Button v-if="paso > 0" variant="ghost" :disabled="guardando" @click="paso -= 1">
          <ChevronLeftIcon class="size-4" />
          Atrás
        </Button>
        <span v-else />
        <div class="flex items-center gap-2">
          <Button variant="ghost" :disabled="guardando" @click="cerrar(false)">Cancelar</Button>
          <Button v-if="paso < PASOS.length - 1" :disabled="!pasoCompleto" @click="paso += 1">
            Continuar
            <ChevronRightIcon class="size-4" />
          </Button>
          <Button v-else :disabled="!pasoCompleto || guardando" @click="guardar">
            <LoaderCircleIcon v-if="guardando" class="animate-spin" />
            <CheckIcon v-else class="size-4" />
            Registrar
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
