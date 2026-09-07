<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs" style="color: #9b89b5;">
          {{ envios.length }} envío{{ envios.length === 1 ? '' : 's' }} registrado{{ envios.length === 1 ? '' : 's' }}
          <template v-if="ultimoEnvio"> · último: {{ fmtFechaHora(ultimoEnvio.enviadoEn) }}</template>
        </p>
      </div>

      <!-- Aviso: destinatarios que faltaron en el envio mas reciente -->
      <div v-if="faltantesUltimoEnvio.length" class="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style="background: rgba(199,119,0,0.08); border: 1.5px solid rgba(199,119,0,0.3);">
        <span class="text-sm font-medium" style="color: #A8590B;">
          <TriangleAlertIcon class="text-xs mr-1.5 size-[1em]" />
          {{ faltantesUltimoEnvio.length }} destinatario{{ faltantesUltimoEnvio.length === 1 ? '' : 's' }}
          no recibi{{ faltantesUltimoEnvio.length === 1 ? 'ó' : 'eron' }} su reporte más reciente
        </span>
        <button type="button" class="text-xs font-semibold underline" style="color: #A8590B;"
          @click="subvista = 'destinatario'">Ver quiénes →</button>
      </div>

      <!-- Sub-pestanas: Por envio / Por destinatario -->
      <div class="flex gap-1 border-b" style="border-color: #e8e0f0;">
        <button type="button" class="text-xs font-bold px-1 pb-2 mr-4"
          :style="subvista === 'envio' ? 'color:var(--color-unergy-purple-dark); border-bottom: 2.5px solid var(--color-unergy-purple);' : 'color:#9b89b5; border-bottom: 2.5px solid transparent;'"
          @click="subvista = 'envio'">Por envío</button>
        <button type="button" class="text-xs font-bold px-1 pb-2"
          :style="subvista === 'destinatario' ? 'color:var(--color-unergy-purple-dark); border-bottom: 2.5px solid var(--color-unergy-purple);' : 'color:#9b89b5; border-bottom: 2.5px solid transparent;'"
          @click="subvista = 'destinatario'">Por destinatario</button>
      </div>

      <!-- Por envio -->
      <template v-if="subvista === 'envio'">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-medium" style="color: #6b5a8a;">Desde</label>
            <DatePicker v-model="filtroDesde" dateFormat="dd/mm/yy" showIcon iconDisplay="input" style="width: 140px;" showClear />
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-medium" style="color: #6b5a8a;">Hasta</label>
            <DatePicker v-model="filtroHasta" dateFormat="dd/mm/yy" showIcon iconDisplay="input" style="width: 140px;" showClear />
          </div>
        </div>

        <div v-if="!batchesFiltrados.length" class="bg-white rounded-xl shadow-sm p-8 text-center text-sm"
          style="border: 1px solid #e8e0f0; color: #9b89b5;">
          Ningún envío en este rango de fechas.
        </div>

        <div v-for="(batch, i) in batchesFiltrados" :key="batch.enviadoEn"
          class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
          <button type="button" class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            @click="toggleBatch(batch.enviadoEn)">
            <span class="flex flex-col gap-0.5">
              <span class="text-sm font-bold" style="color: var(--color-unergy-deep);">{{ fmtFechaHora(batch.enviadoEn) }}</span>
              <span class="text-xs" style="color: #9b89b5;">Reporte del {{ batch.periodo }}</span>
            </span>
            <span class="flex items-center gap-3 text-xs">
              <span class="font-bold" style="color: #10B981;">{{ batch.ok }} enviados</span>
              <span v-if="batch.err" class="font-bold" style="color: #D64455;">{{ batch.err }} con error</span>
              <ChevronDownIcon v-if="batchesAbiertos.has(batch.enviadoEn)" class="text-[10px] size-[1em]" style="color:#9b89b5;" />
              <ChevronRightIcon v-else class="text-[10px] size-[1em]" style="color:#9b89b5;" />
            </span>
          </button>
          <div v-if="batchesAbiertos.has(batch.enviadoEn)" class="border-t" style="border-color: #e8e0f0;">
            <div v-for="item in batch.items" :key="item.id" class="flex items-start justify-between gap-3 px-4 py-2.5 border-t first:border-t-0"
              style="border-color: #f0ecf6;">
              <div class="min-w-0">
                <span class="text-sm font-medium block" style="color: var(--color-unergy-deep);">{{ item.nombre }}</span>
                <span v-if="item.proyectosTotal != null && item.proyectos.length && !esParcial(item)" class="text-xs" style="color: #9b89b5;">
                  {{ item.proyectosTotal }} proyecto{{ item.proyectosTotal === 1 ? '' : 's' }}
                </span>
                <div v-else-if="esParcial(item)" class="flex flex-wrap items-center gap-1 mt-0.5">
                  <span v-for="p in item.proyectos" :key="p" class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style="background: rgba(145,91,216,0.08); color: var(--color-unergy-purple-dark);">{{ p }}</span>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="flex flex-col items-end gap-1">
                  <span v-if="item.exitoso" class="text-xs font-bold px-2 py-0.5 rounded-full" style="background: rgba(16,185,129,0.1); color: #10B981;">Enviado</span>
                  <span v-else class="text-xs font-bold px-2 py-0.5 rounded-full" style="background: rgba(214,68,85,0.1); color: #D64455;">Error</span>
                  <span v-if="esParcial(item)" class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style="background: rgba(199,119,0,0.1); color: #A8590B;">
                    Parcial · {{ item.proyectos.length }} de {{ item.proyectosTotal }}
                  </span>
                </div>
                <span v-if="!item.exitoso" class="block text-xs mt-1" style="color: #D64455;">{{ item.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Por destinatario -->
      <template v-else>
        <IconField style="max-width: 280px;">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="busquedaDest" placeholder="Buscar destinatario…" class="w-full" />
        </IconField>

        <div v-if="!destinatariosFiltrados.length" class="bg-white rounded-xl shadow-sm p-8 text-center text-sm"
          style="border: 1px solid #e8e0f0; color: #9b89b5;">
          Ningún destinatario coincide con la búsqueda.
        </div>

        <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
          <div v-for="d in destinatariosFiltrados" :key="d.nombre"
            class="flex items-center justify-between gap-3 px-4 py-3 border-t first:border-t-0"
            :style="`border-color: #f0ecf6; ${d.faltoUltimoEnvio ? 'background: rgba(199,119,0,0.06);' : ''}`">
            <div class="min-w-0">
              <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ d.nombre }}</p>
              <p v-if="!d.ultima.exitoso" class="text-xs mt-0.5" style="color: #D64455;">
                Último intento falló — {{ d.ultima.error }}
              </p>
              <p v-if="d.faltoUltimoEnvio" class="text-xs font-semibold mt-0.5" style="color: #A8590B;">
                <TriangleAlertIcon class="text-[10px] mr-1 size-[1em]" />No recibió el reporte del {{ d.periodoEsperado }}
              </p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs font-medium" style="color: #6b5a8a;">{{ fmtFecha(d.ultima.enviadoEn) }}</p>
              <p class="text-xs" style="color: #9b89b5;">{{ d.total }} envío{{ d.total === 1 ? '' : 's' }} en total</p>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'
import { logger } from '~/core/logger'
import { ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon, SearchIcon, TriangleAlertIcon } from '@lucide/vue'

const reporteCgmService = new ReporteCgmService()

// Ventana para agrupar filas de email_envios en un solo "envio" (accion de
// clic en Enviar): cada fila se guarda con su propio enviado_at (segundos
// aparte entre destinatarios de un mismo click), asi que se agrupan por
// cercania en el tiempo, no por igualdad exacta ni por dia calendario --
// el envio es manual e irregular, puede no haber ninguno un dia y varios otro.
const VENTANA_BATCH_MIN = 10

const loading = ref(true)
const envios = ref([]) // filas parseadas: { id, nombre, periodo, exitoso, error, enviadoEn }
const subvista = ref('envio')
const busquedaDest = ref('')
const filtroDesde = ref(null)
const filtroHasta = ref(null)
const batchesAbiertos = ref(new Set())
// Nombres de quienes HOY realmente recibirian el reporte (mismo criterio que
// la pestana Enviar: operador_comercial y clientes_cgm de las fronteras
// vivas). Un destinatario del log puede ser un contacto de prueba ya
// eliminado, o un inversionista que dejo de ser el punto de contacto CGM de
// su proyecto (ej. reemplazado en ProyectoInversionista/ProyectoAreaContacto)
// -- a esos no se les marca "no recibio el envio mas reciente" porque no van
// a volver a recibir nada, la advertencia seria ruido permanente.
const nombresVigentes = ref(new Set())

function normalizarNombre(s) {
  return (s || '').trim().toUpperCase()
}

async function cargarNombresVigentes() {
  try {
    const fronteras = await reporteCgmService.listarFronteras()
    const set = new Set()
    for (const f of fronteras) {
      if (f.operador_comercial) set.add(normalizarNombre(f.operador_comercial))
      for (const c of f.clientes_cgm || []) set.add(normalizarNombre(c.nombre))
    }
    nombresVigentes.value = set
  } catch (e) {
    logger.error('operadores-red.historial-cgm', e)
  }
}

function toggleBatch(key) {
  const next = new Set(batchesAbiertos.value)
  next.has(key) ? next.delete(key) : next.add(key)
  batchesAbiertos.value = next
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtFechaHora(iso) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// El asunto siempre tiene la forma "Reporte CGM — {periodo} — {nombre}"
// (ver email_service.py::send_reporte_cgm_email) -- el destinatario real
// guardado en la BD es el correo, no el nombre, asi que se extrae del asunto
// para mostrar algo legible.
function parsearAsunto(asunto) {
  const partes = (asunto || '').split(' — ')
  if (partes.length >= 3) {
    return { periodo: partes[1], nombre: partes.slice(2).join(' — ') }
  }
  return { periodo: null, nombre: asunto || '(sin asunto)' }
}

// Un envio es "parcial" cuando no incluyo todos los proyectos vigentes de ese
// destinatario en ese momento (ej. reenvio puntual a un solo proyecto) --
// proyectosTotal es null para envios de antes de esta migracion o de otros
// tipos de correo, asi que no se muestra nada en esos casos.
function esParcial(item) {
  return item.proyectosTotal != null && item.proyectos.length > 0 && item.proyectos.length !== item.proyectosTotal
}

async function cargar() {
  loading.value = true
  try {
    const historial = await reporteCgmService.listarHistorialEnvios()
    envios.value = historial
      .map(row => {
        const { periodo, nombre } = parsearAsunto(row.asunto)
        return {
          id: row.id,
          nombre,
          periodo,
          exitoso: row.exitoso,
          error: row.error,
          enviadoEn: row.enviado_at,
          proyectos: row.proyectos ? row.proyectos.split(',').filter(Boolean) : [],
          proyectosTotal: row.proyectos_total ?? null,
        }
      })
      .sort((a, b) => new Date(b.enviadoEn) - new Date(a.enviadoEn))
  } catch (e) {
    logger.error('operadores-red.historial-cgm', e)
    envios.value = []
  } finally {
    loading.value = false
  }
}

// Agrupa envios en "batches" (una accion de Enviar): mismo criterio para
// ambas sub-vistas, calculado una sola vez.
const batches = computed(() => {
  const ordenAsc = [...envios.value].sort((a, b) => new Date(a.enviadoEn) - new Date(b.enviadoEn))
  const grupos = []
  for (const item of ordenAsc) {
    const ultimo = grupos[grupos.length - 1]
    const t = new Date(item.enviadoEn).getTime()
    if (ultimo && (t - new Date(ultimo.items[ultimo.items.length - 1].enviadoEn).getTime()) <= VENTANA_BATCH_MIN * 60000) {
      ultimo.items.push(item)
    } else {
      grupos.push({ items: [item] })
    }
  }
  return grupos
    .map(g => ({
      enviadoEn: g.items[0].enviadoEn,
      periodo: g.items[0].periodo || '—',
      items: g.items,
      ok: g.items.filter(i => i.exitoso).length,
      err: g.items.filter(i => !i.exitoso).length,
    }))
    .sort((a, b) => new Date(b.enviadoEn) - new Date(a.enviadoEn))
})

const ultimoEnvio = computed(() => batches.value[0]?.items[0] || null)

const batchesFiltrados = computed(() => {
  const desde = filtroDesde.value ? new Date(filtroDesde.value) : null
  const hasta = filtroHasta.value ? new Date(filtroHasta.value) : null
  return batches.value.filter(b => {
    const f = new Date(b.enviadoEn)
    if (desde && f < desde) return false
    if (hasta && f > new Date(hasta.getTime() + 86399999)) return false
    return true
  })
})

// Abrir el batch mas reciente por defecto cuando cambian los datos/filtros.
function abrirMasReciente() {
  if (batchesFiltrados.value.length) batchesAbiertos.value = new Set([batchesFiltrados.value[0].enviadoEn])
}

// El "envio mas reciente" para efectos de la alerta es el PERIODO (fecha del
// reporte) mas reciente, no el ultimo lote por hora de envio -- un reenvio
// puntual a una sola persona (ej. corregir un correo que rebotó) es, por
// hora, "el lote mas reciente", pero es del MISMO periodo que el lote
// completo de esa manana. Comparar por lote marcaba como "faltante" a todo
// el mundo que sí habia recibido el reporte de ese dia, solo porque el
// envio puntual mas reciente no los incluyo a ellos.
//
// Pero tampoco hay un solo periodo global: Operador de Red siempre recibe
// el reporte de UN SOLO DIA ("2026-08-18") y Cliente siempre recibe "mes a
// la fecha" ("2026-08-01 a 2026-08-18"), ver reporte_cgm.py fecha_str_envio
// -- son formatos que conviven en el mismo envio. Comparar todo contra el
// periodo del ultimo correo procesado (sin importar de qué forma es) marca
// como "faltante" a cualquier Operador en cuanto el ultimo correo de ese
// lote resulta ser de un Cliente (o viceversa), aunque sí haya recibido el
// suyo -- por eso se compara por FORMA de periodo (rango vs día), no por
// un único string global.
function formaPeriodo(periodo) {
  return periodo && periodo.includes(' a ') ? 'rango' : 'dia'
}

const ultimoPeriodoPorForma = computed(() => {
  const mapa = {}
  for (const item of envios.value) {
    if (!item.periodo) continue
    const forma = formaPeriodo(item.periodo)
    const actual = mapa[forma]
    if (!actual || new Date(item.enviadoEn) > new Date(actual.enviadoEn)) mapa[forma] = item
  }
  return mapa
})

const porDestinatario = computed(() => {
  const mapa = new Map()
  for (const item of envios.value) {
    if (!mapa.has(item.nombre)) mapa.set(item.nombre, { nombre: item.nombre, total: 0, ultima: item, periodos: new Set() })
    const d = mapa.get(item.nombre)
    d.total += 1
    if (new Date(item.enviadoEn) > new Date(d.ultima.enviadoEn)) d.ultima = item
    if (item.periodo) d.periodos.add(item.periodo)
  }
  return [...mapa.values()].map(d => {
    const existe = nombresVigentes.value.has(normalizarNombre(d.nombre))
    const forma = formaPeriodo(d.ultima.periodo)
    const periodoEsperado = ultimoPeriodoPorForma.value[forma]?.periodo || null
    return {
      ...d,
      periodoEsperado,
      faltoUltimoEnvio: existe && periodoEsperado ? !d.periodos.has(periodoEsperado) : false,
    }
  })
})

const faltantesUltimoEnvio = computed(() => porDestinatario.value.filter(d => d.faltoUltimoEnvio))

const destinatariosFiltrados = computed(() => {
  const texto = busquedaDest.value.trim().toLowerCase()
  const lista = porDestinatario.value.filter(d => !texto || d.nombre.toLowerCase().includes(texto))
  return lista.sort((a, b) => {
    const aFlag = (a.faltoUltimoEnvio || !a.ultima.exitoso) ? 0 : 1
    const bFlag = (b.faltoUltimoEnvio || !b.ultima.exitoso) ? 0 : 1
    if (aFlag !== bFlag) return aFlag - bFlag
    return new Date(b.ultima.enviadoEn) - new Date(a.ultima.enviadoEn)
  })
})

onMounted(async () => {
  await Promise.all([cargar(), cargarNombresVigentes()])
  abrirMasReciente()
})
</script>
