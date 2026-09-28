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
<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type { ClienteDetalle, ContratoPpaClienteResumen } from '~/features/clientes/types'
import type { Oportunidad, ProyectoOportunidad } from '~/features/comercial/types'
import type { ContratoServicio } from '~/features/contratos/types'
import { ArrowLeftIcon, PlusIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Imports explícitos: bug conocido de tipos de `blocks/DataTable`/`blocks/DatePicker`.
import DataTable from '~/components/blocks/DataTable.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { readDetail } from '~/core/errors'
import ClienteForm from '~/features/clientes/components/ClienteForm.vue'
import { ClientesService } from '~/features/clientes/services/clientes'
import { ComercialService } from '~/features/comercial/services/comercial'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { aFecha, aFechaStr, ETAPAS, severidadEtapa } from './comercial'
import BitacoraPanel from './BitacoraPanel.vue'
import OfertasPanel from './OfertasPanel.vue'
import ProyectoDesdeCRMDialog from './ProyectoDesdeCRMDialog.vue'

const route = useRoute()
const router = useRouter()
const comercialService = new ComercialService()
const clientesService = new ClientesService()
const contratosServicioService = new ContratosServicioService()

const TIPOS_DOC = [
  { label: 'Oferta', value: 'oferta' as const },
  { label: 'Cámara de Comercio', value: 'camara_comercio' as const },
  { label: 'RUT', value: 'rut' as const },
]

const op = ref<Oportunidad | null>(null)
const clienteFull = ref<ClienteDetalle | null>(null)
const seg = reactive<{
  nombre: string
  numero_oferta: string
  fecha_estimada_firma: Date | null
  fecha_tentativa_inicio_representacion: Date | null
  fecha_tentativa_inicio_compra_energia: Date | null
  notas: string
}>({
  nombre: '',
  numero_oferta: '',
  fecha_estimada_firma: null,
  fecha_tentativa_inicio_representacion: null,
  fecha_tentativa_inicio_compra_energia: null,
  notas: '',
})
const proyectosFilas = ref<ProyectoOportunidad[]>([])
const contratosPpaFilas = ref<ContratoPpaClienteResumen[]>([])
const contratosRepFilas = ref<ContratoServicio[]>([])
const showAgregarProyecto = ref(false)
const showRepWizard = ref(false)
const estadoGuardado = ref('')
let saveTimer: ReturnType<typeof setTimeout> | undefined

watch(op, (v) => {
  proyectosFilas.value = v?.proyectos ?? []
})

// `etapas` viene del backend como {etapa: n}; se ordena según el pipeline.
const totalOfertas = computed(() =>
  Object.values(op.value?.etapas ?? {}).reduce((a, b) => a + b, 0),
)
const etapasPresentes = computed(() =>
  ETAPAS.filter((e) => (op.value?.etapas ?? {})[e.value]).map((e) => ({
    ...e,
    n: op.value!.etapas![e.value]!,
  })),
)

function docPorTipo(tipo: string) {
  return (op.value?.documentos ?? []).find((d) => d.tipo === tipo)
}

async function recargar() {
  const data = await comercialService.obtenerOportunidad(Number(route.params.id))
  op.value = data
  Object.assign(seg, {
    nombre: data.nombre === data.cliente_razon_social ? '' : (data.nombre ?? ''),
    numero_oferta: data.numero_oferta ?? '',
    fecha_estimada_firma: aFecha(data.fecha_estimada_firma),
    fecha_tentativa_inicio_representacion: aFecha(data.fecha_tentativa_inicio_representacion),
    fecha_tentativa_inicio_compra_energia: aFecha(data.fecha_tentativa_inicio_compra_energia),
    notas: data.notas ?? '',
  })
}

async function cargarCliente() {
  if (!op.value) return
  clienteFull.value = await clientesService.obtener(op.value.cliente_id)
}

async function recargarContratos() {
  showRepWizard.value = false
  if (!op.value) return
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
    if (!op.value) return
    try {
      await comercialService.actualizarOportunidad(op.value.id, {
        nombre: seg.nombre || null,
        numero_oferta: seg.numero_oferta || null,
        fecha_estimada_firma: aFechaStr(seg.fecha_estimada_firma),
        fecha_tentativa_inicio_representacion: aFechaStr(seg.fecha_tentativa_inicio_representacion),
        fecha_tentativa_inicio_compra_energia: aFechaStr(seg.fecha_tentativa_inicio_compra_energia),
        notas: seg.notas || null,
      })
      estadoGuardado.value = 'Guardado ✓'
    } catch (err) {
      const e = err as { data?: unknown }
      estadoGuardado.value = `No se guardó: ${readDetail(e.data) ?? 'error'}`
    }
  }, 800)
}

async function patchCliente(payload: Record<string, unknown>) {
  if (!op.value) return
  try {
    await clientesService.actualizar(op.value.cliente_id, payload)
    toast.success('Cliente actualizado')
    await cargarCliente()
  } catch (err) {
    const e = err as { data?: unknown }
    toast.error('Error al guardar cliente', { description: readDetail(e.data) ?? '' })
  }
}

async function crearDoc(tipo: string, label: string) {
  if (!op.value) return
  try {
    await clientesService.crearDocumento(op.value.cliente_id, {
      tipo,
      nombre: label,
      numero: tipo === 'oferta' ? (seg.numero_oferta || op.value.numero_oferta || null) : null,
      fecha: null,
      estado: 'aceptado',
      archivo_url: null,
      archivo_nombre: null,
      notas: null,
      oportunidad_id: op.value.id,
    })
    await recargar()
  } catch (err) {
    const e = err as { data?: unknown }
    toast.error('No se pudo registrar el documento', { description: readDetail(e.data) ?? '' })
  }
}

const columnasProyectos: DataTableColumn[] = [
  { key: 'nombre_comercial', header: 'Nombre' },
  { key: 'potencia_ac_kw', header: 'Potencia AC' },
  { key: 'municipio', header: 'Municipio' },
  { key: 'operador_red', header: 'Operador de red' },
  { key: 'mwh_mes_estimado', header: 'Gen. proyectada (MWh/mes)' },
  { key: 'fecha_estimada_energizacion', header: 'Operación estimada' },
  { key: 'fecha_inicio_comercializacion', header: 'Inicio compra energía' },
]

const columnasPpa: DataTableColumn[] = [
  { key: 'numero_codigo_contrato', header: 'Código' },
  { key: 'nombre_interno', header: 'Nombre interno' },
  { key: 'fecha_inicio', header: 'Inicio' },
  { key: 'fecha_fin', header: 'Fin' },
]

const columnasRep: DataTableColumn[] = [
  { key: 'numero_contrato', header: 'Número' },
  { key: 'contratante_nombre', header: 'Contratante' },
  { key: 'fecha_inicio', header: 'Inicio' },
  { key: 'fecha_fin', header: 'Fin' },
]

function asProyecto(row: DataTableRow): ProyectoOportunidad {
  return row as unknown as ProyectoOportunidad
}

onMounted(async () => {
  await recargar()
  await Promise.all([cargarCliente(), recargarContratos()])
})

// Evita que un PATCH de autosave pendiente dispare tras desmontar la vista.
onBeforeUnmount(() => clearTimeout(saveTimer))
</script>

<template>
  <div v-if="op">
    <!-- Encabezado -->
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <Button variant="ghost" size="icon" aria-label="Volver al tablero" @click="router.push('/comercial')">
          <ArrowLeftIcon class="size-4" />
        </Button>
        <div>
          <h1 class="text-xl font-semibold text-foreground">{{ op.nombre }}</h1>
          <div class="flex items-center gap-2 text-sm">
            <NuxtLink :to="`/clientes/${op.cliente_id}`" class="text-primary underline">
              {{ op.cliente_razon_social }}
            </NuxtLink>
            <span v-if="op.cliente_nit" class="text-muted-foreground">NIT {{ op.cliente_nit }}</span>
          </div>
        </div>
        <GBadge v-if="op.alerta" color="destructive">⚠ {{ op.dias_sin_respuesta }} días sin movimiento</GBadge>
      </div>
    </div>

    <!-- En qué etapa está cada oferta del cliente -->
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted-foreground">{{ totalOfertas }} oferta(s):</span>
      <GBadge v-for="e in etapasPresentes" :key="e.value" :color="severidadEtapa(e.value)"
        >{{ e.n }} {{ e.label.toLowerCase() }}</GBadge
      >
      <span v-if="!totalOfertas" class="text-sm text-muted-foreground">
        todavía sin ofertas — se agregan en la pestaña Ofertas
      </span>
    </div>

    <!-- Datos del negocio: pocos y de identificación, no merecen pestaña -->
    <details class="mb-5 rounded-lg border bg-muted/30">
      <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground select-none">
        DATOS DEL NEGOCIO
        <span class="font-normal">— {{ estadoGuardado || 'nombre, consecutivo, fechas tentativas, notas' }}</span>
      </summary>
      <div class="grid grid-cols-1 gap-3 px-3 pb-3 md:grid-cols-3">
        <div>
          <GLabel>Nombre del negocio</GLabel>
          <Input v-model.trim="seg.nombre" @update:model-value="autosave" />
        </div>
        <div>
          <GLabel>Nº de oferta (consecutivo manual)</GLabel>
          <Input v-model.trim="seg.numero_oferta" @update:model-value="autosave" />
        </div>
        <div>
          <GLabel>Fecha estimada de firma</GLabel>
          <DatePicker
            :model-value="seg.fecha_estimada_firma ? aFechaStr(seg.fecha_estimada_firma) : null"
            clearable
            @update:model-value="
              (v) => {
                seg.fecha_estimada_firma = aFecha(v)
                autosave()
              }
            "
          />
        </div>
        <div>
          <GLabel>Inicio tentativo — representación</GLabel>
          <DatePicker
            :model-value="
              seg.fecha_tentativa_inicio_representacion ? aFechaStr(seg.fecha_tentativa_inicio_representacion) : null
            "
            clearable
            @update:model-value="
              (v) => {
                seg.fecha_tentativa_inicio_representacion = aFecha(v)
                autosave()
              }
            "
          />
        </div>
        <div>
          <GLabel>Inicio tentativo — compra de energía</GLabel>
          <DatePicker
            :model-value="
              seg.fecha_tentativa_inicio_compra_energia
                ? aFechaStr(seg.fecha_tentativa_inicio_compra_energia)
                : null
            "
            clearable
            @update:model-value="
              (v) => {
                seg.fecha_tentativa_inicio_compra_energia = aFecha(v)
                autosave()
              }
            "
          />
        </div>
        <div class="md:col-span-3">
          <GLabel>Notas</GLabel>
          <Textarea v-model="seg.notas" rows="2" @update:model-value="autosave" />
        </div>
      </div>
    </details>

    <GTabs default-value="ofertas">
      <GTabsList>
        <!-- Las ofertas primero: son la unidad del negocio -->
        <GTabsTrigger value="ofertas">Ofertas</GTabsTrigger>
        <GTabsTrigger value="cliente">Cliente y contactos</GTabsTrigger>
        <GTabsTrigger value="proyectos">Proyectos y contratos</GTabsTrigger>
        <GTabsTrigger value="documentos">Documentos y bitácora</GTabsTrigger>
      </GTabsList>

      <GTabsContent value="ofertas">
        <OfertasPanel :oportunidad-id="op.id" :ofertas="op.ofertas || []" @changed="recargar" />
      </GTabsContent>

      <GTabsContent value="cliente">
        <div class="flex max-w-4xl flex-col gap-6">
          <ClienteForm :initial="clienteFull" @save="patchCliente" @cancel="() => {}" />
          <ContactosPanel :cliente-id="op.cliente_id" />
        </div>
      </GTabsContent>

      <GTabsContent value="proyectos">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-foreground">
            {{ op.proyectos?.length ?? 0 }} proyecto(s) vinculados
          </h3>
          <Button size="sm" @click="showAgregarProyecto = true">
            <PlusIcon class="size-4" />
            Agregar proyecto
          </Button>
        </div>
        <DataTable
          :columns="columnasProyectos"
          :rows="proyectosFilas as unknown as DataTableRow[]"
          row-key="id"
          class="mb-6"
          empty-message="Sin proyectos vinculados."
          @row-click="(row) => router.push(`/proyectos/${asProyecto(row).id}`)"
        >
          <template #cell="{ row, column }">
            <template v-if="column.key === 'potencia_ac_kw'">
              {{ asProyecto(row).potencia_ac_kw ? `${asProyecto(row).potencia_ac_kw} kW` : '—' }}
            </template>
            <template v-else-if="column.key === 'mwh_mes_estimado'">
              {{ asProyecto(row).mwh_mes_estimado ?? '—' }}
            </template>
          </template>
        </DataTable>

        <h3 class="mb-1 text-sm font-semibold text-foreground">Contratos PPA del cliente</h3>
        <p class="mb-2 text-xs text-muted-foreground">
          Los que salen de una oferta se crean con <strong>Firmar → crear PPA</strong> desde el
          tablero, para que queden enlazados a ella.
        </p>
        <DataTable
          :columns="columnasPpa"
          :rows="contratosPpaFilas as unknown as DataTableRow[]"
          row-key="id"
          class="mb-6"
          empty-message="Sin contratos PPA."
          @row-click="(row) => router.push(`/contratos/${(row as unknown as ContratoPpaClienteResumen).id}`)"
        />

        <div class="mb-1 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-foreground">Contratos de representación</h3>
          <Button size="sm" variant="outline" @click="showRepWizard = true">
            <PlusIcon class="size-4" />
            Nuevo contrato de representación
          </Button>
        </div>
        <DataTable
          :columns="columnasRep"
          :rows="contratosRepFilas as unknown as DataTableRow[]"
          row-key="id"
          empty-message="Sin contratos de representación."
          @row-click="(row) => router.push(`/contratos/${(row as unknown as ContratoServicio).id}`)"
        />

        <ProyectoDesdeCRMDialog v-model:visible="showAgregarProyecto" :oportunidad-id="op.id" @creado="recargar" />
        <!-- ContratoServicioWizard no expone prop de cliente (solo `tipo` y
             `proyectoIdDefault`): el cliente se selecciona dentro del wizard. -->
        <ContratoServicioWizard
          v-model:visible="showRepWizard"
          tipo="representacion"
          @creado="recargarContratos"
          @cerrar="showRepWizard = false"
        />
      </GTabsContent>

      <GTabsContent value="documentos">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 class="mb-1 text-sm font-semibold text-foreground">Documentos comerciales</h3>
            <p class="mb-3 text-xs text-muted-foreground">
              Se guardan como documentos del cliente, vinculados a este negocio. La subida
              del archivo y el cambio de estado se hacen en la ficha del cliente.
            </p>
            <div class="flex flex-col gap-2">
              <div v-for="t in TIPOS_DOC" :key="t.value" class="rounded-md border p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{{ t.label }}</span>
                    <template v-if="docPorTipo(t.value)">
                      <GBadge>{{ docPorTipo(t.value)!.estado }}</GBadge>
                      <span v-if="docPorTipo(t.value)!.numero" class="text-xs text-muted-foreground">
                        Nº {{ docPorTipo(t.value)!.numero }}
                      </span>
                      <a
                        v-if="docPorTipo(t.value)!.archivo_url"
                        :href="docPorTipo(t.value)!.archivo_url!"
                        target="_blank"
                        rel="noopener"
                        class="text-xs text-primary underline"
                      >
                        {{ docPorTipo(t.value)!.archivo_nombre || 'archivo' }}
                      </a>
                    </template>
                    <span v-else class="text-xs text-muted-foreground/60">sin registrar</span>
                  </div>
                  <Button v-if="!docPorTipo(t.value)" variant="ghost" size="sm" @click="crearDoc(t.value, t.label)">
                    <PlusIcon class="size-4" />
                    Registrar
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <BitacoraPanel
            :oportunidad-id="op.id"
            :gestiones="op.gestiones"
            :historial="op.historial"
            :ofertas="op.ofertas || []"
            @registrada="recargar"
          />
        </div>
      </GTabsContent>
    </GTabs>
  </div>
</template>
