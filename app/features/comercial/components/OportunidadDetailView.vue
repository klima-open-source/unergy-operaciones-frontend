<!--
  Ficha comercial del CLIENTE. Deja de ser el destino de cada click del tablero
  (eso ahora es el drawer de la oferta, que no te saca de la vista) y vuelve a ser
  lo que es: el cliente, sus contactos, sus ofertas, sus proyectos y contratos.

  Cambios frente a la versión anterior:
  · Se fue el dropdown «Tipo de servicio», que mandaba valores del enum de la
    OFERTA (servicios_operacionales…) contra el enum de la oportunidad
    (representacion | comunidad_energetica): cada autosave respondía 422. Además
    quedó vestigial cuando la etapa se mudó a la oferta, que ya tiene su `tipo`.
  · De 7 pestañas a 4: «Oferta» (documentos) y «Ofertas» (sub-ofertas) se llamaban
    casi igual, y Proyectos y Contratos se leen juntos.
  · Un cliente NO tiene etapa: arriba se resume en qué etapa está cada oferta.
-->
<template>
  <div class="p-4 md:p-6" v-if="op">
    <!-- Encabezado -->
    <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div class="flex items-start gap-3">
        <Button text rounded @click="$router.push('/comercial')" v-tooltip.bottom="'Volver al tablero'">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div>
          <h1 class="text-xl font-semibold" style="color:var(--color-unergy-deep)">{{ op.nombre }}</h1>
          <div class="flex items-center gap-2 text-sm">
            <router-link :to="`/clientes/${op.cliente_id}`" class="underline" style="color:var(--color-unergy-purple)">
              {{ op.cliente_razon_social }}
            </router-link>
            <span v-if="op.cliente_nit" style="color:#9b89b5">NIT {{ op.cliente_nit }}</span>
          </div>
        </div>
        <GBadge v-if="op.alerta" color="destructive">⚠ {{ op.dias_sin_respuesta }} días sin movimiento</GBadge>
      </div>
    </div>

    <!-- En qué etapa está cada oferta del cliente -->
    <div class="flex items-center gap-2 mb-5 flex-wrap">
      <span class="text-sm" style="color:#7a6e8a">{{ totalOfertas }} oferta(s):</span>
      <GBadge v-for="e in etapasPresentes" :key="e.value"
           :color="severidadEtapa(e.value)">{{ e.n }} {{ e.label.toLowerCase() }}</GBadge>
      <span v-if="!totalOfertas" class="text-sm" style="color:#9b89b5">
        todavía sin ofertas — se agregan en la pestaña Ofertas
      </span>
    </div>

    <!-- Datos del negocio: pocos y de identificación, no merecen pestaña -->
    <details class="mb-5 rounded-lg" style="background:#FAF8FC;border:1px solid #e8e0f0">
      <summary class="px-3 py-2 text-xs font-semibold cursor-pointer select-none" style="color:#7a6e8a">
        DATOS DEL NEGOCIO
        <span class="font-normal" style="color:#9b89b5">— {{ estadoGuardado || 'nombre, consecutivo, fechas tentativas, notas' }}</span>
      </summary>
      <div class="px-3 pb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="etiqueta">Nombre del negocio</label>
          <InputText v-model.trim="seg.nombre" class="w-full" @update:modelValue="autosave" />
        </div>
        <div>
          <label class="etiqueta">Nº de oferta (consecutivo manual)</label>
          <InputText v-model.trim="seg.numero_oferta" class="w-full" @update:modelValue="autosave" />
        </div>
        <div>
          <label class="etiqueta">Fecha estimada de firma</label>
          <DatePicker v-model="seg.fecha_estimada_firma" dateFormat="yy-mm-dd" showIcon class="w-full"
                      @update:modelValue="autosave" />
        </div>
        <div>
          <label class="etiqueta">Inicio tentativo — representación</label>
          <DatePicker v-model="seg.fecha_tentativa_inicio_representacion" dateFormat="yy-mm-dd" showIcon
                      class="w-full" @update:modelValue="autosave" />
        </div>
        <div>
          <label class="etiqueta">Inicio tentativo — compra de energía</label>
          <DatePicker v-model="seg.fecha_tentativa_inicio_compra_energia" dateFormat="yy-mm-dd" showIcon
                      class="w-full" @update:modelValue="autosave" />
        </div>
        <div class="md:col-span-3">
          <label class="etiqueta">Notas</label>
          <Textarea v-model="seg.notas" rows="2" autoResize class="w-full" @update:modelValue="autosave" />
        </div>
      </div>
    </details>

    <TabView>
      <!-- Las ofertas primero: son la unidad del negocio -->
      <TabPanel header="Ofertas">
        <OfertasPanel :oportunidad-id="op.id" :ofertas="op.ofertas || []" @changed="recargar" />
      </TabPanel>

      <TabPanel header="Cliente y contactos">
        <div class="max-w-4xl flex flex-col gap-6">
          <ClienteForm :initial="clienteFull" @save="patchCliente" @cancel="() => {}" />
          <ContactosPanel :cliente-id="op.cliente_id" />
        </div>
      </TabPanel>

      <TabPanel header="Proyectos y contratos">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold" style="color:var(--color-unergy-deep)">
            {{ op.proyectos.length }} proyecto(s) vinculados
          </h3>
          <Button label="Agregar proyecto" size="small" @click="showAgregarProyecto = true">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
        </div>
        <DataTable :value="proyectosFilas" class="text-sm mb-6" dataKey="id" selectionMode="single"
                   @row-click="$router.push(`/proyectos/${$event.data.id}`)">
          <Column field="nombre_comercial" header="Nombre" />
          <Column header="Potencia AC">
            <template #body="{ data }">
              {{ data.potencia_instalada_kwp ? `${data.potencia_instalada_kwp} kW` : '—' }}
            </template>
          </Column>
          <Column field="municipio" header="Municipio" />
          <Column field="operador_red" header="Operador de red" />
          <Column header="Gen. proyectada (MWh/mes)">
            <template #body="{ data }">{{ data.mwh_mes_estimado ?? '—' }}</template>
          </Column>
          <Column field="fecha_estimada_energizacion" header="Operación estimada" />
          <Column field="fecha_inicio_comercializacion" header="Inicio compra energía" />
          <template #empty><span style="color:#9b89b5">Sin proyectos vinculados.</span></template>
        </DataTable>

        <h3 class="text-sm font-semibold mb-1" style="color:var(--color-unergy-deep)">Contratos PPA del cliente</h3>
        <p class="text-xs mb-2" style="color:#9b89b5">
          Los que salen de una oferta se crean con <strong>Firmar → crear PPA</strong> desde el
          tablero, para que queden enlazados a ella.
        </p>
        <DataTable :value="contratosPpaFilas" class="text-sm mb-6" dataKey="id" selectionMode="single"
                   @row-click="$router.push(`/contratos/${$event.data.id}`)">
          <Column field="numero_codigo_contrato" header="Código" />
          <Column field="nombre_interno" header="Nombre interno" />
          <Column field="fecha_inicio" header="Inicio" />
          <Column field="fecha_fin" header="Fin" />
          <template #empty><span style="color:#9b89b5">Sin contratos PPA.</span></template>
        </DataTable>

        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Contratos de representación</h3>
          <Button label="Nuevo contrato de representación" size="small" severity="secondary" outlined @click="showRepWizard = true">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
        </div>
        <DataTable :value="contratosRepFilas" class="text-sm" dataKey="id" selectionMode="single"
                   @row-click="$router.push(`/contratos/${$event.data.id}`)">
          <Column field="numero_contrato" header="Número" />
          <Column field="contratante_nombre" header="Contratante" />
          <Column field="fecha_inicio" header="Inicio" />
          <Column field="fecha_fin" header="Fin" />
          <template #empty><span style="color:#9b89b5">Sin contratos de representación.</span></template>
        </DataTable>

        <ProyectoDesdeCRMDialog v-model:visible="showAgregarProyecto" :oportunidad-id="op.id"
                                @creado="recargar" />
        <!-- ContratoServicioWizard no expone prop de cliente (solo `tipo` y
             `proyectoIdDefault`): el cliente se selecciona dentro del wizard. -->
        <ContratoServicioWizard v-model:visible="showRepWizard" tipo="representacion"
                                @creado="recargarContratos" @cerrar="showRepWizard = false" />
      </TabPanel>

      <TabPanel header="Documentos y bitácora">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 class="text-sm font-semibold mb-1" style="color:var(--color-unergy-deep)">Documentos comerciales</h3>
            <p class="text-xs mb-3" style="color:#9b89b5">
              Se guardan como documentos del cliente, vinculados a este negocio. La subida
              del archivo y el cambio de estado se hacen en la ficha del cliente.
            </p>
            <div class="flex flex-col gap-2">
              <div v-for="t in TIPOS_DOC" :key="t.value" class="rounded-md p-3"
                   style="border:1px solid #e8e0f0">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm">{{ t.label }}</span>
                    <template v-if="docPorTipo(t.value)">
                      <GBadge>{{ docPorTipo(t.value).estado }}</GBadge>
                      <span v-if="docPorTipo(t.value).numero" class="text-xs" style="color:#9b89b5">
                        Nº {{ docPorTipo(t.value).numero }}
                      </span>
                      <a v-if="docPorTipo(t.value).archivo_url" :href="docPorTipo(t.value).archivo_url"
                         target="_blank" rel="noopener" class="text-xs underline" style="color:var(--color-unergy-purple)">
                        {{ docPorTipo(t.value).archivo_nombre || 'archivo' }}
                      </a>
                    </template>
                    <span v-else class="text-xs" style="color:#c4b8d4">sin registrar</span>
                  </div>
                  <Button v-if="!docPorTipo(t.value)" label="Registrar" size="small" text @click="crearDoc(t.value, t.label)">
                    <template #icon><PlusIcon class="size-[1em]" /></template>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <BitacoraPanel :oportunidad-id="op.id" :gestiones="op.gestiones" :historial="op.historial"
                         :ofertas="op.ofertas || []" @registrada="recargar" />
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { toast } from 'vue-sonner'
import { ComercialService } from '~/features/comercial/services/comercial'
import { ClientesService } from '~/features/clientes/services/clientes'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import ClienteForm from '~/features/clientes/components/ClienteForm.vue'
import ContactosPanel from '~/components/blocks/ContactosPanel.vue'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import ProyectoDesdeCRMDialog from './ProyectoDesdeCRMDialog.vue'
import BitacoraPanel from './BitacoraPanel.vue'
import OfertasPanel from './OfertasPanel.vue'
import { ETAPAS, severidadEtapa, aFecha, aFechaStr } from './comercial.js'
import { ArrowLeftIcon, PlusIcon } from '@lucide/vue'

const route = useRoute()
const comercialService = new ComercialService()
const clientesService = new ClientesService()
const contratosServicioService = new ContratosServicioService()

const TIPOS_DOC = [
  { label: 'Oferta', value: 'oferta' },
  { label: 'Cámara de Comercio', value: 'camara_comercio' },
  { label: 'RUT', value: 'rut' },
]

const op = ref(null)
const clienteFull = ref({})
const seg = ref({})
const proyectosFilas = ref([])
const contratosPpaFilas = ref([])
const contratosRepFilas = ref([])
const showAgregarProyecto = ref(false)
const showRepWizard = ref(false)
const estadoGuardado = ref('')
let saveTimer = null

watch(op, (v) => { proyectosFilas.value = v?.proyectos ?? [] })

// `etapas` viene del backend como {etapa: n}; se ordena según el pipeline.
const totalOfertas = computed(() =>
  Object.values(op.value?.etapas ?? {}).reduce((a, b) => a + b, 0))
const etapasPresentes = computed(() => ETAPAS
  .filter((e) => (op.value?.etapas ?? {})[e.value])
  .map((e) => ({ ...e, n: op.value.etapas[e.value] })))

function docPorTipo(tipo) { return (op.value?.documentos ?? []).find((d) => d.tipo === tipo) }

async function recargar() {
  const data = await comercialService.obtenerOportunidad(route.params.id)
  op.value = data
  seg.value = {
    nombre: data.nombre === data.cliente_razon_social ? '' : data.nombre,
    numero_oferta: data.numero_oferta,
    fecha_estimada_firma: aFecha(data.fecha_estimada_firma),
    fecha_tentativa_inicio_representacion: aFecha(data.fecha_tentativa_inicio_representacion),
    fecha_tentativa_inicio_compra_energia: aFecha(data.fecha_tentativa_inicio_compra_energia),
    notas: data.notas,
  }
}

async function cargarCliente() {
  clienteFull.value = await clientesService.obtener(op.value.cliente_id)
}

async function recargarContratos() {
  showRepWizard.value = false
  const cid = op.value.cliente_id
  const [ppa, rep] = await Promise.all([
    clientesService.listarContratosPpa(cid),
    contratosServicioService.listar({ tipo: 'representacion' }),
  ])
  contratosPpaFilas.value = ppa
  contratosRepFilas.value = rep.filter((c) => c.contratante_id === cid || c.prestador_id === cid)
}

function autosave() {
  estadoGuardado.value = 'Guardando…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await comercialService.actualizarOportunidad(op.value.id, {
        nombre: seg.value.nombre || null,
        numero_oferta: seg.value.numero_oferta || null,
        fecha_estimada_firma: aFechaStr(seg.value.fecha_estimada_firma),
        fecha_tentativa_inicio_representacion: aFechaStr(seg.value.fecha_tentativa_inicio_representacion),
        fecha_tentativa_inicio_compra_energia: aFechaStr(seg.value.fecha_tentativa_inicio_compra_energia),
        notas: seg.value.notas || null,
      })
      estadoGuardado.value = 'Guardado ✓'
    } catch (err) {
      estadoGuardado.value = `No se guardó: ${err.data?.detail ?? 'error'}`
    }
  }, 800)
}

async function patchCliente(payload) {
  try {
    await clientesService.actualizar(op.value.cliente_id, payload)
    toast.success('Cliente actualizado', { duration: 2500 })
    await cargarCliente()
  } catch (err) {
    toast.error('Error al guardar cliente', { description: err.data?.detail ?? '', duration: 5000 })
  }
}

async function crearDoc(tipo, label) {
  try {
    await clientesService.crearDocumento(op.value.cliente_id, {
      tipo,
      nombre: label,
      numero: tipo === 'oferta' ? (seg.value.numero_oferta || op.value.numero_oferta || null) : null,
      fecha: null,
      estado: 'aceptado',
      archivo_url: null,
      archivo_nombre: null,
      notas: null,
      oportunidad_id: op.value.id,
    })
    await recargar()
  } catch (err) {
    toast.error('No se pudo registrar el documento', {
      description: err.data?.detail ?? '',
      duration: 5000,
    })
  }
}

onMounted(async () => {
  await recargar()
  await Promise.all([cargarCliente(), recargarContratos()])
})

// Evita que un PATCH de autosave pendiente dispare tras desmontar la vista.
onBeforeUnmount(() => clearTimeout(saveTimer))
</script>

<style scoped>
.etiqueta {
  display: block;
  font-size: 11px;
  color: #7a6e8a;
  margin-bottom: 0.15rem;
}
</style>
