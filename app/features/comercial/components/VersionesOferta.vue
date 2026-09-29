<!--
  Las propuestas de una oferta: reofertar sin borrar la anterior.

  Antes la oferta tenia UN `documento_url` y UN `precio_detalle` de texto libre,
  y reofertar los sobrescribia: la propuesta anterior desaparecia sin rastro.
  Ahora cada propuesta es una version, y son APPEND-ONLY -- no hay editar ni
  borrar, corregir es agregar la siguiente. Ver DOMINIO_COMERCIAL.md, O-8 y O-9.

  La version ACEPTADA es la que importa: de sus condiciones nacera el contrato
  PPA al firmar. Por eso solo puede haber una, y se marca aparte.

  El precio va como tabla por anio porque asi viene en la oferta real (2026:330,
  2027:318…) y asi se convierte en `ppa_tarifas` al firmar.
-->
<script setup lang="ts">
import type { PayloadVersionOferta, VersionOferta } from '~/features/comercial/types'
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'
import { readDetail } from '~/core/errors'
import { ComercialService } from '~/features/comercial/services/comercial'

const props = defineProps<{ ofertaId: number }>()

const servicio = new ComercialService()

const versiones = ref<VersionOferta[]>([])
const cargando = ref(false)
const guardando = ref(false)
const aceptando = ref<number | null>(null)
const error = ref('')
const agregando = ref(false)

interface FilaPrecio {
  anio: number | null
  precio: number | null
}

const nueva = reactive<{
  fecha_envio: string | null
  documento_url: string
  indice_indexacion: string
  periodo_indexacion_base: string
  que_cambio: string
  precios: FilaPrecio[]
}>({
  fecha_envio: null,
  documento_url: '',
  indice_indexacion: '',
  periodo_indexacion_base: '',
  que_cambio: '',
  precios: [],
})

const hayAceptada = computed(() => versiones.value.some((v) => v.fecha_aceptacion))

function detalleError(e: unknown): string {
  const err = e as { data?: unknown; message?: string } | undefined
  return readDetail(err?.data) ?? err?.message ?? 'Error desconocido'
}

async function cargar() {
  if (!props.ofertaId) return
  cargando.value = true
  error.value = ''
  try {
    versiones.value = await servicio.versiones(props.ofertaId)
  } catch (e) {
    error.value = detalleError(e)
  } finally {
    cargando.value = false
  }
}

function abrir() {
  Object.assign(nueva, {
    fecha_envio: null,
    documento_url: '',
    indice_indexacion: '',
    periodo_indexacion_base: '',
    que_cambio: '',
    precios: [],
  })
  // Arranca con los años de la propuesta anterior: reofertar casi siempre es
  // cambiar los precios del mismo período, no inventar uno nuevo.
  const previa = versiones.value[0]
  if (previa?.precios?.length) {
    nueva.precios = previa.precios.map((p) => ({ anio: p.anio, precio: p.precio }))
    nueva.indice_indexacion = previa.indice_indexacion ?? ''
    nueva.periodo_indexacion_base = previa.periodo_indexacion_base ?? ''
  }
  agregando.value = true
}

async function guardar() {
  guardando.value = true
  error.value = ''
  try {
    const payload: PayloadVersionOferta = {
      fecha_envio: nueva.fecha_envio,
      documento_url: nueva.documento_url || null,
      indice_indexacion: nueva.indice_indexacion || null,
      periodo_indexacion_base: nueva.periodo_indexacion_base || null,
      que_cambio: nueva.que_cambio || null,
      precios: nueva.precios
        .filter(
          (p): p is { anio: number; precio: number } => !!p.anio && !!p.precio && p.precio > 0,
        )
        .map((p) => ({ anio: p.anio, precio: p.precio })),
    }
    await servicio.agregarVersion(props.ofertaId, payload)
    agregando.value = false
    await cargar()
    toast.success('Propuesta agregada')
  } catch (e) {
    error.value = detalleError(e)
  } finally {
    guardando.value = false
  }
}

async function aceptar(version: VersionOferta) {
  aceptando.value = version.numero
  error.value = ''
  try {
    await servicio.aceptarVersion(
      props.ofertaId,
      version.numero,
      new Date().toISOString().slice(0, 10),
    )
    await cargar()
    toast.success(`Propuesta v${version.numero} aceptada`, {
      description: 'Es la que se usará para crear el contrato al firmar.',
    })
  } catch (e) {
    error.value = detalleError(e)
  } finally {
    aceptando.value = null
  }
}

watch(() => props.ofertaId, cargar, { immediate: true })
</script>

<template>
  <section>
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Propuestas
      </h3>
      <Button v-if="!agregando" variant="ghost" size="sm" @click="abrir">
        <PlusIcon class="size-4" />
        Nueva propuesta
      </Button>
    </div>

    <p
      v-if="!cargando && !versiones.length && !agregando"
      class="mb-2 text-xs text-muted-foreground"
    >
      Esta oferta no tiene propuestas registradas. Al agregar la primera, el documento y el precio
      dejan de sobrescribirse cada vez que se reoferta.
    </p>

    <p v-if="cargando" class="text-xs text-muted-foreground">Cargando propuestas…</p>
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>

    <!-- ── Formulario de una propuesta nueva ─────────────────────────────── -->
    <div v-if="agregando" class="mb-3 rounded-md border bg-primary/5 p-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <GLabel>Fecha de envío</GLabel>
          <DatePicker v-model="nueva.fecha_envio" clearable />
          <p class="mt-1 text-xs text-muted-foreground">
            Sin fecha queda como borrador y no se puede aceptar.
          </p>
        </div>
        <div>
          <GLabel>Documento (link)</GLabel>
          <Input v-model.trim="nueva.documento_url" placeholder="https://…" />
        </div>
        <div>
          <GLabel>Índice de indexación</GLabel>
          <Input
            v-model.trim="nueva.indice_indexacion"
            placeholder="IPP serie Oferta Interna provisional"
          />
        </div>
        <div>
          <GLabel>Mes base (YYYY-MM)</GLabel>
          <Input v-model.trim="nueva.periodo_indexacion_base" placeholder="2026-05" />
          <p class="mt-1 text-xs text-muted-foreground">
            La fila «Precio Base» del PDF: los precios son pesos constantes de ese mes.
          </p>
        </div>
        <div class="sm:col-span-2">
          <GLabel>Qué cambió</GLabel>
          <Input
            v-model.trim="nueva.que_cambio"
            placeholder="Ej: bajamos el precio del primer año"
          />
        </div>
      </div>

      <!-- Precio por año -->
      <div class="mt-3">
        <GLabel>Precio por año ($COP/kWh)</GLabel>
        <div v-for="(fila, i) in nueva.precios" :key="i" class="mb-1.5 flex items-center gap-2">
          <NumberField v-model="fila.anio" :format-options="{ useGrouping: false }" class="flex-1">
            <NumberFieldContent><NumberFieldInput placeholder="2026" /></NumberFieldContent>
          </NumberField>
          <NumberField
            v-model="fila.precio"
            :format-options="{ maximumFractionDigits: 4 }"
            class="flex-1"
          >
            <NumberFieldContent><NumberFieldInput placeholder="330" /></NumberFieldContent>
          </NumberField>
          <Button variant="ghost" size="icon-sm" @click="nueva.precios.splice(i, 1)">
            <Trash2Icon class="size-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" @click="nueva.precios.push({ anio: null, precio: null })">
          <PlusIcon class="size-4" />
          Agregar año
        </Button>
      </div>

      <div class="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" :disabled="guardando" @click="agregando = false"
          >Cancelar</Button
        >
        <Button size="sm" :disabled="guardando" @click="guardar">
          <LoaderCircleIcon v-if="guardando" class="animate-spin" />
          Guardar propuesta
        </Button>
      </div>
    </div>

    <!-- ── Las propuestas ────────────────────────────────────────────────── -->
    <div
      v-for="v in versiones"
      :key="v.id"
      class="mb-2 rounded-md border p-3"
      :class="v.fecha_aceptacion ? 'border-success/40 bg-success/5' : 'bg-card'"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-sm font-semibold text-foreground">v{{ v.numero }}</span>
          <span
            v-if="v.fecha_aceptacion"
            class="rounded bg-success/15 px-1.5 py-0.5 text-xs font-medium text-success"
            >Aceptada {{ v.fecha_aceptacion }}</span
          >
          <span
            v-else-if="!v.fecha_envio"
            class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
            >Borrador</span
          >
          <span v-else class="text-xs text-muted-foreground">Enviada {{ v.fecha_envio }}</span>
        </div>
        <div class="flex items-center gap-1">
          <a
            v-if="v.documento_url"
            :href="v.documento_url"
            target="_blank"
            rel="noopener"
            class="text-xs text-primary underline"
            >Documento</a
          >
          <Button
            v-if="v.fecha_envio && !hayAceptada"
            variant="ghost"
            size="sm"
            :disabled="aceptando === v.numero"
            @click="aceptar(v)"
          >
            <LoaderCircleIcon v-if="aceptando === v.numero" class="animate-spin" />
            Aceptar
          </Button>
        </div>
      </div>

      <p v-if="v.que_cambio" class="mt-1 text-xs text-muted-foreground">{{ v.que_cambio }}</p>

      <div v-if="v.precios.length" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="p in v.precios"
          :key="p.anio"
          class="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary"
          >{{ p.anio }}: {{ p.precio }}</span
        >
      </div>

      <p v-if="v.indice_indexacion" class="mt-1.5 text-xs text-muted-foreground">
        {{ v.indice_indexacion
        }}<span v-if="v.periodo_indexacion_base"> · base {{ v.periodo_indexacion_base }}</span>
      </p>
    </div>
  </section>
</template>
