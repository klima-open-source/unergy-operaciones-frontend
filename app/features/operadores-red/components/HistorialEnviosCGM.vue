<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, TriangleAlertIcon } from '@lucide/vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { logger } from '~/core/logger'
import { ReporteCgmService } from '~/features/operadores-red/services/reporte-cgm'

interface EnvioParseado {
  id: number
  nombre: string
  periodo: string | null
  exitoso: boolean
  error?: string
  enviadoEn: string
  proyectos: string[]
  proyectosTotal: number | null
}

// Ventana para agrupar filas de email_envios en un solo "envío" (acción de
// clic en Enviar): cada fila se guarda con su propio enviado_at (segundos
// aparte entre destinatarios de un mismo click), así que se agrupan por
// cercanía en el tiempo, no por igualdad exacta ni por día calendario — el
// envío es manual e irregular, puede no haber ninguno un día y varios otro.
const VENTANA_BATCH_MIN = 10

const reporteCgmService = new ReporteCgmService()

const query = useQuery<EnvioParseado[]>()
const subvista = ref('envio')
const busquedaDest = ref('')
const filtroDesde = ref<string | null>(null)
const filtroHasta = ref<string | null>(null)
const batchesAbiertos = ref(new Set<string>())
// Nombres de quienes HOY realmente recibirían el reporte (mismo criterio que
// la pestaña Enviar: operador_comercial y clientes_cgm de las fronteras
// vivas). Un destinatario del log puede ser un contacto de prueba ya
// eliminado, o un inversionista que dejó de ser el punto de contacto CGM de
// su proyecto — a esos no se les marca "no recibió el envío más reciente"
// porque no van a volver a recibir nada, la advertencia sería ruido permanente.
const nombresVigentes = ref(new Set<string>())

function normalizarNombre(s: string | null | undefined) {
  return (s || '').trim().toUpperCase()
}

async function cargarNombresVigentes() {
  try {
    const fronteras = await reporteCgmService.listarFronteras()
    const set = new Set<string>()
    for (const f of fronteras) {
      if (f.operador_comercial) set.add(normalizarNombre(f.operador_comercial))
      for (const c of f.clientes_cgm ?? []) set.add(normalizarNombre(c.nombre))
    }
    nombresVigentes.value = set
  } catch (err) {
    logger.error('operadores-red.historial-cgm', err)
  }
}

function toggleBatch(key: string) {
  const next = new Set(batchesAbiertos.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  batchesAbiertos.value = next
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// El asunto siempre tiene la forma "Reporte CGM — {periodo} — {nombre}" (ver
// email_service.py::send_reporte_cgm_email) — el destinatario real guardado
// en la BD es el correo, no el nombre, así que se extrae del asunto para
// mostrar algo legible.
function parsearAsunto(asunto: string | undefined) {
  const partes = (asunto ?? '').split(' — ')
  if (partes.length >= 3) return { periodo: partes[1] ?? null, nombre: partes.slice(2).join(' — ') }
  return { periodo: null, nombre: asunto || '(sin asunto)' }
}

// Un envío es "parcial" cuando no incluyó todos los proyectos vigentes de ese
// destinatario en ese momento (ej. reenvío puntual a un solo proyecto) —
// proyectosTotal es null para envíos de antes de esta migración o de otros
// tipos de correo, así que no se muestra nada en esos casos.
function esParcial(item: EnvioParseado) {
  return (
    item.proyectosTotal != null &&
    item.proyectos.length > 0 &&
    item.proyectos.length !== item.proyectosTotal
  )
}

async function cargar() {
  await query.run(async () => {
    const historial = await reporteCgmService.listarHistorialEnvios()
    return historial
      .map((row) => {
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
      .sort((a, b) => new Date(b.enviadoEn).getTime() - new Date(a.enviadoEn).getTime())
  })
}

// Agrupa envíos en "batches" (una acción de Enviar): mismo criterio para
// ambas sub-vistas, calculado una sola vez.
const batches = computed(() => {
  const envios = query.data ?? []
  const ordenAsc = [...envios].sort(
    (a, b) => new Date(a.enviadoEn).getTime() - new Date(b.enviadoEn).getTime(),
  )
  const grupos: EnvioParseado[][] = []
  for (const item of ordenAsc) {
    const ultimo = grupos.at(-1)
    const anterior = ultimo?.at(-1)
    const t = new Date(item.enviadoEn).getTime()
    if (
      ultimo &&
      anterior &&
      t - new Date(anterior.enviadoEn).getTime() <= VENTANA_BATCH_MIN * 60000
    ) {
      ultimo.push(item)
    } else {
      grupos.push([item])
    }
  }
  return grupos
    .map((items) => ({
      enviadoEn: items[0]!.enviadoEn,
      periodo: items[0]!.periodo || '—',
      items,
      ok: items.filter((i) => i.exitoso).length,
      err: items.filter((i) => !i.exitoso).length,
    }))
    .sort((a, b) => new Date(b.enviadoEn).getTime() - new Date(a.enviadoEn).getTime())
})

const ultimoEnvio = computed(() => batches.value[0]?.items[0] ?? null)

const batchesFiltrados = computed(() => {
  const desde = filtroDesde.value ? new Date(filtroDesde.value) : null
  const hasta = filtroHasta.value ? new Date(filtroHasta.value) : null
  return batches.value.filter((b) => {
    const f = new Date(b.enviadoEn)
    if (desde && f < desde) return false
    if (hasta && f > new Date(hasta.getTime() + 86399999)) return false
    return true
  })
})

// Abrir el batch más reciente por defecto cuando cambian los datos/filtros.
function abrirMasReciente() {
  const primero = batchesFiltrados.value[0]
  if (primero) batchesAbiertos.value = new Set([primero.enviadoEn])
}

// El "envío más reciente" para efectos de la alerta es el PERIODO (fecha del
// reporte) más reciente, no el último lote por hora de envío — un reenvío
// puntual a una sola persona (ej. corregir un correo que rebotó) es, por
// hora, "el lote más reciente", pero es del MISMO período que el lote
// completo de esa mañana. Comparar por lote marcaba como "faltante" a todo
// el mundo que sí había recibido el reporte de ese día, solo porque el envío
// puntual más reciente no los incluyó a ellos.
//
// Pero tampoco hay un solo período global: Operador de Red siempre recibe el
// reporte de UN SOLO DÍA ("2026-08-18") y Cliente siempre recibe "mes a la
// fecha" ("2026-08-01 a 2026-08-18"), ver reporte_cgm.py fecha_str_envio —
// son formatos que conviven en el mismo envío. Comparar todo contra el
// período del último correo procesado (sin importar de qué forma es) marca
// como "faltante" a cualquier Operador en cuanto el último correo de ese
// lote resulta ser de un Cliente (o viceversa), aunque sí haya recibido el
// suyo — por eso se compara por FORMA de período (rango vs día), no por un
// único string global.
function formaPeriodo(periodo: string | null) {
  return periodo && periodo.includes(' a ') ? 'rango' : 'dia'
}

const ultimoPeriodoPorForma = computed(() => {
  const mapa: Record<string, EnvioParseado> = {}
  for (const item of query.data ?? []) {
    if (!item.periodo) continue
    const forma = formaPeriodo(item.periodo)
    const actual = mapa[forma]
    if (!actual || new Date(item.enviadoEn) > new Date(actual.enviadoEn)) mapa[forma] = item
  }
  return mapa
})

interface Destinatario {
  nombre: string
  total: number
  ultima: EnvioParseado
  periodos: Set<string>
}

const porDestinatario = computed(() => {
  const mapa = new Map<string, Destinatario>()
  for (const item of query.data ?? []) {
    let d = mapa.get(item.nombre)
    if (!d) {
      d = { nombre: item.nombre, total: 0, ultima: item, periodos: new Set() }
      mapa.set(item.nombre, d)
    }
    d.total += 1
    if (new Date(item.enviadoEn) > new Date(d.ultima.enviadoEn)) d.ultima = item
    if (item.periodo) d.periodos.add(item.periodo)
  }
  return [...mapa.values()].map((d) => {
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

const faltantesUltimoEnvio = computed(() => porDestinatario.value.filter((d) => d.faltoUltimoEnvio))

const destinatariosFiltrados = computed(() => {
  const texto = busquedaDest.value.trim().toLowerCase()
  const lista = porDestinatario.value.filter(
    (d) => !texto || d.nombre.toLowerCase().includes(texto),
  )
  return lista.sort((a, b) => {
    const aFlag = a.faltoUltimoEnvio || !a.ultima.exitoso ? 0 : 1
    const bFlag = b.faltoUltimoEnvio || !b.ultima.exitoso ? 0 : 1
    if (aFlag !== bFlag) return aFlag - bFlag
    return new Date(b.ultima.enviadoEn).getTime() - new Date(a.ultima.enviadoEn).getTime()
  })
})

onMounted(async () => {
  await Promise.all([cargar(), cargarNombresVigentes()])
  abrirMasReciente()
})
</script>

<template>
  <AsyncView :query="query">
    <template #default>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-muted-foreground">
            {{ query.data?.length ?? 0 }} envío{{
              query.data?.length === 1 ? '' : 's'
            }}
            registrado{{ query.data?.length === 1 ? '' : 's' }}
            <template v-if="ultimoEnvio">
              · último: {{ fmtFechaHora(ultimoEnvio.enviadoEn) }}</template
            >
          </p>
        </div>

        <!-- Aviso: destinatarios que faltaron en el envío más reciente -->
        <Alert v-if="faltantesUltimoEnvio.length">
          <TriangleAlertIcon class="text-warning" />
          <AlertTitle class="flex flex-wrap items-center justify-between gap-2">
            <span>
              {{ faltantesUltimoEnvio.length }} destinatario{{
                faltantesUltimoEnvio.length === 1 ? '' : 's'
              }}
              no recibi{{ faltantesUltimoEnvio.length === 1 ? 'ó' : 'eron' }} su reporte más
              reciente
            </span>
            <button
              type="button"
              class="text-xs font-semibold underline"
              @click="subvista = 'destinatario'"
            >
              Ver quiénes →
            </button>
          </AlertTitle>
        </Alert>

        <GTabs v-model="subvista">
          <GTabsList>
            <GTabsTrigger value="envio">Por envío</GTabsTrigger>
            <GTabsTrigger value="destinatario">Por destinatario</GTabsTrigger>
          </GTabsList>

          <GTabsContent value="envio" class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-1.5">
                <GLabel>Desde</GLabel>
                <DatePicker v-model="filtroDesde" clearable />
              </div>
              <div class="flex items-center gap-1.5">
                <GLabel>Hasta</GLabel>
                <DatePicker v-model="filtroHasta" clearable />
              </div>
            </div>

            <p
              v-if="!batchesFiltrados.length"
              class="rounded-xl border p-8 text-center text-sm text-muted-foreground"
            >
              Ningún envío en este rango de fechas.
            </p>

            <Collapsible
              v-for="batch in batchesFiltrados"
              :key="batch.enviadoEn"
              :open="batchesAbiertos.has(batch.enviadoEn)"
              class="rounded-xl border"
              @update:open="toggleBatch(batch.enviadoEn)"
            >
              <CollapsibleTrigger
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span class="flex flex-col gap-0.5">
                  <span class="text-sm font-bold">{{ fmtFechaHora(batch.enviadoEn) }}</span>
                  <span class="text-xs text-muted-foreground">Reporte del {{ batch.periodo }}</span>
                </span>
                <span class="flex items-center gap-3 text-xs">
                  <span class="font-bold text-success">{{ batch.ok }} enviados</span>
                  <span v-if="batch.err" class="font-bold text-destructive"
                    >{{ batch.err }} con error</span
                  >
                  <ChevronDownIcon
                    v-if="batchesAbiertos.has(batch.enviadoEn)"
                    class="size-3 text-muted-foreground"
                  />
                  <ChevronRightIcon v-else class="size-3 text-muted-foreground" />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent class="divide-y border-t">
                <div
                  v-for="item in batch.items"
                  :key="item.id"
                  class="flex items-start justify-between gap-3 px-4 py-2.5"
                >
                  <div class="min-w-0">
                    <span class="block text-sm font-medium">{{ item.nombre }}</span>
                    <span
                      v-if="
                        item.proyectosTotal != null && item.proyectos.length && !esParcial(item)
                      "
                      class="text-xs text-muted-foreground"
                    >
                      {{ item.proyectosTotal }} proyecto{{ item.proyectosTotal === 1 ? '' : 's' }}
                    </span>
                    <div
                      v-else-if="esParcial(item)"
                      class="mt-0.5 flex flex-wrap items-center gap-1"
                    >
                      <GBadge v-for="p in item.proyectos" :key="p" variant="outline">{{
                        p
                      }}</GBadge>
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1 text-right">
                    <GBadge :color="item.exitoso ? 'success' : 'destructive'">
                      {{ item.exitoso ? 'Enviado' : 'Error' }}
                    </GBadge>
                    <GBadge v-if="esParcial(item)" color="warning">
                      Parcial · {{ item.proyectos.length }} de {{ item.proyectosTotal }}
                    </GBadge>
                    <span v-if="!item.exitoso" class="mt-1 block text-xs text-destructive">{{
                      item.error
                    }}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </GTabsContent>

          <GTabsContent value="destinatario" class="space-y-3">
            <InputGroup class="max-w-70">
              <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
              <InputGroupInput v-model="busquedaDest" placeholder="Buscar destinatario…" />
            </InputGroup>

            <p
              v-if="!destinatariosFiltrados.length"
              class="rounded-xl border p-8 text-center text-sm text-muted-foreground"
            >
              Ningún destinatario coincide con la búsqueda.
            </p>

            <div v-else class="divide-y rounded-xl border">
              <div
                v-for="d in destinatariosFiltrados"
                :key="d.nombre"
                class="flex items-center justify-between gap-3 px-4 py-3"
                :class="d.faltoUltimoEnvio ? 'bg-warning/5' : ''"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold">{{ d.nombre }}</p>
                  <p v-if="!d.ultima.exitoso" class="mt-0.5 text-xs text-destructive">
                    Último intento falló — {{ d.ultima.error }}
                  </p>
                  <p
                    v-if="d.faltoUltimoEnvio"
                    class="mt-0.5 flex items-center gap-1 text-xs font-semibold text-warning"
                  >
                    <TriangleAlertIcon class="size-3" />
                    No recibió el reporte del {{ d.periodoEsperado }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-xs font-medium">{{ fmtFecha(d.ultima.enviadoEn) }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ d.total }} envío{{ d.total === 1 ? '' : 's' }} en total
                  </p>
                </div>
              </div>
            </div>
          </GTabsContent>
        </GTabs>
      </div>
    </template>
  </AsyncView>
</template>
