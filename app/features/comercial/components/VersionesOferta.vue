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
<template>
  <section>
    <div class="flex items-baseline justify-between gap-3 mb-2">
      <h3 class="seccion">Propuestas</h3>
      <Button v-if="!agregando" label="Nueva propuesta" text size="small" @click="abrir">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <p v-if="!cargando && !versiones.length && !agregando" class="ayuda mb-2">
      Esta oferta no tiene propuestas registradas. Al agregar la primera, el
      documento y el precio dejan de sobrescribirse cada vez que se reoferta.
    </p>

    <p v-if="cargando" class="ayuda">Cargando propuestas…</p>
    <p v-if="error" class="text-xs" style="color:#b91c1c">{{ error }}</p>

    <!-- ── Formulario de una propuesta nueva ─────────────────────────────── -->
    <div v-if="agregando" class="rounded-md border p-3 mb-3" style="border-color:#e0d3f5;background:#FAF7FE">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="etiqueta">Fecha de envío</label>
          <DatePicker v-model="nueva.fecha_envio" dateFormat="yy-mm-dd" showIcon class="w-full" />
          <p class="ayuda">Sin fecha queda como borrador y no se puede aceptar.</p>
        </div>
        <div>
          <label class="etiqueta">Documento (link)</label>
          <InputText v-model.trim="nueva.documento_url" class="w-full" placeholder="https://…" />
        </div>
        <div>
          <label class="etiqueta">Índice de indexación</label>
          <InputText v-model.trim="nueva.indice_indexacion" class="w-full"
                     placeholder="IPP serie Oferta Interna provisional" />
        </div>
        <div>
          <label class="etiqueta">Mes base (YYYY-MM)</label>
          <InputText v-model.trim="nueva.periodo_indexacion_base" class="w-full" placeholder="2026-05" />
          <p class="ayuda">La fila «Precio Base» del PDF: los precios son pesos constantes de ese mes.</p>
        </div>
        <div class="sm:col-span-2">
          <label class="etiqueta">Qué cambió</label>
          <InputText v-model.trim="nueva.que_cambio" class="w-full"
                     placeholder="Ej: bajamos el precio del primer año" />
        </div>
      </div>

      <!-- Precio por año -->
      <div class="mt-3">
        <label class="etiqueta">Precio por año ($COP/kWh)</label>
        <div v-for="(fila, i) in nueva.precios" :key="i" class="flex items-center gap-2 mb-1.5">
          <InputNumber v-model="fila.anio" :useGrouping="false" placeholder="2026" class="w-28" />
          <InputNumber v-model="fila.precio" :maxFractionDigits="4" placeholder="330" class="w-36" />
          <Button text severity="secondary" size="small" @click="nueva.precios.splice(i, 1)">
            <template #icon><Trash2Icon class="size-[1em]" /></template>
          </Button>
        </div>
        <Button label="Agregar año" text size="small" @click="nueva.precios.push({ anio: null, precio: null })">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <div class="flex justify-end gap-2 mt-3">
        <Button label="Cancelar" text severity="secondary" size="small" :disabled="guardando"
                @click="agregando = false" />
        <Button label="Guardar propuesta" size="small" :loading="guardando" @click="guardar" />
      </div>
    </div>

    <!-- ── Las propuestas ────────────────────────────────────────────────── -->
    <div v-for="v in versiones" :key="v.id" class="rounded-md border p-3 mb-2"
         :style="v.fecha_aceptacion
           ? 'border-color:#a7f3d0;background:#ecfdf5'
           : 'border-color:#ece7f2;background:white'">
      <div class="flex items-baseline justify-between gap-3 flex-wrap">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">v{{ v.numero }}</span>
          <span v-if="v.fecha_aceptacion"
                class="text-[11px] rounded px-1.5 py-0.5 font-medium"
                style="background:#a7f3d0;color:#065f46">Aceptada {{ v.fecha_aceptacion }}</span>
          <span v-else-if="!v.fecha_envio"
                class="text-[11px] rounded px-1.5 py-0.5 font-medium"
                style="background:#f1f5f9;color:#64748b">Borrador</span>
          <span v-else class="text-[11px]" style="color:#9b89b5">Enviada {{ v.fecha_envio }}</span>
        </div>
        <div class="flex items-center gap-1">
          <a v-if="v.documento_url" :href="v.documento_url" target="_blank" rel="noopener"
             class="text-xs underline" style="color:var(--color-unergy-purple)">Documento</a>
          <Button v-if="v.fecha_envio && !hayAceptada" label="Aceptar" text size="small"
                  :loading="aceptando === v.numero" @click="aceptar(v)" />
        </div>
      </div>

      <p v-if="v.que_cambio" class="text-xs mt-1" style="color:#6b5b7e">{{ v.que_cambio }}</p>

      <div v-if="v.precios.length" class="flex flex-wrap gap-1.5 mt-2">
        <span v-for="p in v.precios" :key="p.anio"
              class="text-[11px] rounded px-1.5 py-0.5 font-mono"
              style="background:#EFF6FF;color:#1D4ED8">{{ p.anio }}: {{ p.precio }}</span>
      </div>

      <p v-if="v.indice_indexacion" class="text-[11px] mt-1.5" style="color:#9b89b5">
        {{ v.indice_indexacion }}<span v-if="v.periodo_indexacion_base"> · base {{ v.periodo_indexacion_base }}</span>
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { toast } from 'vue-sonner'
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { ComercialService } from '~/features/comercial/services/comercial'

const props = defineProps({
  ofertaId: { type: Number, required: true },
})

const servicio = new ComercialService()

const versiones = ref([])
const cargando = ref(false)
const guardando = ref(false)
const aceptando = ref(null)
const error = ref('')
const agregando = ref(false)

const nueva = reactive({
  fecha_envio: null,
  documento_url: '',
  indice_indexacion: '',
  periodo_indexacion_base: '',
  que_cambio: '',
  precios: [],
})

const hayAceptada = computed(() => versiones.value.some((v) => v.fecha_aceptacion))

function fechaStr(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

async function cargar() {
  if (!props.ofertaId) return
  cargando.value = true
  error.value = ''
  try {
    versiones.value = await servicio.versiones(props.ofertaId)
  } catch (e) {
    error.value = e.data?.detail || e.message
  } finally {
    cargando.value = false
  }
}

function abrir() {
  Object.assign(nueva, {
    fecha_envio: null, documento_url: '', indice_indexacion: '',
    periodo_indexacion_base: '', que_cambio: '', precios: [],
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
    await servicio.agregarVersion(props.ofertaId, {
      fecha_envio: fechaStr(nueva.fecha_envio),
      documento_url: nueva.documento_url || null,
      indice_indexacion: nueva.indice_indexacion || null,
      periodo_indexacion_base: nueva.periodo_indexacion_base || null,
      que_cambio: nueva.que_cambio || null,
      precios: nueva.precios
        .filter((p) => p.anio && p.precio > 0)
        .map((p) => ({ anio: p.anio, precio: p.precio })),
    })
    agregando.value = false
    await cargar()
    toast.success('Propuesta agregada', { duration: 2500 })
  } catch (e) {
    error.value = e.data?.detail || e.message
  } finally {
    guardando.value = false
  }
}

async function aceptar(version) {
  aceptando.value = version.numero
  error.value = ''
  try {
    await servicio.aceptarVersion(
      props.ofertaId, version.numero, new Date().toISOString().slice(0, 10),
    )
    await cargar()
    toast.success(`Propuesta v${version.numero} aceptada`, {
      description: 'Es la que se usará para crear el contrato al firmar.',
      duration: 4000,
    })
  } catch (e) {
    error.value = e.data?.detail || e.message
  } finally {
    aceptando.value = null
  }
}

watch(() => props.ofertaId, cargar, { immediate: true })
</script>
