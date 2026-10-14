<script setup lang="ts">
/**
 * Los clientes que tienen que ver con la planta por sus contratos: compradores y
 * vendedores de sus PPA; contratante, prestador e inversionista de cada contrato
 * de servicio (representación, CGM, mantenimiento, arriendo, internet) y los
 * arrendadores de su arriendo. Uno por cliente, con todos sus papeles.
 *
 * Los inversionistas (dueños de la planta) se ven aparte, en su propia tabla.
 * Una parte que el contrato nombra sin vincularla a un cliente también sale,
 * marcada, para que se vea que falta vincularla.
 */
import { ExternalLinkIcon, UsersIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { PpaService } from '~/features/contratos/services/ppa'
import type { ContratoPpa, ContratoServicio } from '~/features/contratos/types'

const props = defineProps<{ proyectoId: number }>()

interface Papel {
  rol: string
  contrato: string
}
interface ClienteRelacionado {
  clave: string
  clienteId: number | null
  nombre: string
  nit: string | null
  papeles: Papel[]
}

const contratosServicio = new ContratosServicioService()
const ppas = new PpaService()

const cargando = ref(true)
const error = ref<string | null>(null)
const clientes = ref<ClienteRelacionado[]>([])

const SERVICIO: Record<string, string> = {
  representacion: 'Representación',
  cgm: 'CGM',
  mantenimiento: 'Mantenimiento',
  arriendo: 'Arriendo',
  internet: 'Internet',
}
/** Cómo se llaman las partes en cada servicio (en un arriendo, el prestador es el arrendador). */
const PARTES: Record<string, { contratante: string; prestador: string }> = {
  arriendo: { contratante: 'Arrendatario', prestador: 'Arrendador' },
}

function agregar(
  mapa: Map<string, ClienteRelacionado>,
  id: number | null | undefined,
  nombre: string | null | undefined,
  nit: string | null | undefined,
  papel: Papel,
) {
  if (id == null && !nombre) return
  const clave = id != null ? `id:${id}` : `nombre:${nombre!.trim().toLowerCase()}`
  const actual = mapa.get(clave) ?? {
    clave,
    clienteId: id ?? null,
    nombre: nombre || `Cliente #${id}`,
    nit: nit ?? null,
    papeles: [],
  }
  if (!actual.papeles.some((p) => p.rol === papel.rol && p.contrato === papel.contrato)) {
    actual.papeles.push(papel)
  }
  mapa.set(clave, actual)
}

function deServicio(mapa: Map<string, ClienteRelacionado>, c: ContratoServicio) {
  const servicio = SERVICIO[c.servicio_aplica] ?? c.servicio_aplica
  const contrato = c.numero_contrato ? `${servicio} · ${c.numero_contrato}` : servicio
  const partes = PARTES[c.servicio_aplica] ?? { contratante: 'Contratante', prestador: 'Prestador' }
  agregar(mapa, c.contratante_id, c.contratante_nombre, c.contratante_nit, { rol: partes.contratante, contrato })
  agregar(mapa, c.prestador_id, c.prestador_nombre, c.prestador_nit, { rol: partes.prestador, contrato })
  agregar(mapa, c.inversionista_id, c.inversionista_nombre, null, { rol: 'Inversionista', contrato })
}

function dePpa(mapa: Map<string, ClienteRelacionado>, c: ContratoPpa) {
  const contrato = `PPA · ${c.nombre_interno || c.numero_codigo_contrato || `#${c.id}`}`
  agregar(mapa, c.comprador_id, c.comprador_nombre, c.comprador_nit, { rol: 'Comprador', contrato })
  agregar(mapa, c.vendedor_id, c.vendedor_nombre, c.vendedor_nit, { rol: 'Vendedor', contrato })
}

onMounted(async () => {
  try {
    const [servicios, contratosPpa] = await Promise.all([
      contratosServicio.listar({ proyecto_id: props.proyectoId }),
      ppas.listar({ proyecto_id: props.proyectoId }),
    ])
    const arriendos = servicios.filter((c) => c.servicio_aplica === 'arriendo')
    const arrendadores = await Promise.all(arriendos.map((c) => contratosServicio.listarArrendadores(c.id)))

    const mapa = new Map<string, ClienteRelacionado>()
    contratosPpa.forEach((c) => dePpa(mapa, c))
    servicios.forEach((c) => deServicio(mapa, c))
    arrendadores.flat().forEach((a) =>
      agregar(mapa, a.cliente_id, a.nombre, null, {
        rol: a.activo === false ? 'Arrendador (inactivo)' : 'Arrendador',
        contrato: 'Arriendo',
      }),
    )
    clientes.value = [...mapa.values()].sort(
      (a, b) => Number(a.clienteId == null) - Number(b.clienteId == null) || a.nombre.localeCompare(b.nombre),
    )
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <div v-if="cargando" class="flex justify-center py-8"><Spinner class="size-5" /></div>

  <Alert v-else-if="error" variant="destructive">
    <AlertDescription>{{ error }}</AlertDescription>
  </Alert>

  <div
    v-else-if="!clientes.length"
    class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center"
  >
    <UsersIcon class="size-5 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">Ningún contrato de esta planta nombra a un cliente.</p>
  </div>

  <div v-else class="flex flex-col divide-y divide-border rounded-xl border border-border">
    <div v-for="c in clientes" :key="c.clave" class="flex flex-wrap items-start gap-3 px-4 py-3">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <TruncatedText :text="c.nombre" class="max-w-md text-sm font-semibold text-foreground" />
          <span v-if="c.nit" class="font-mono text-xs text-muted-foreground">NIT {{ c.nit }}</span>
          <GBadge v-if="c.clienteId == null" color="warning" class="text-xs">Sin vincular a un cliente</GBadge>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <GBadge v-for="p in c.papeles" :key="`${p.rol}:${p.contrato}`" color="default" class="text-xs">
            {{ p.rol }} · {{ p.contrato }}
          </GBadge>
        </div>
      </div>
      <Button v-if="c.clienteId != null" variant="ghost" size="sm" as-child>
        <NuxtLink :to="`/clientes/${c.clienteId}`"><ExternalLinkIcon class="size-4" /> Ver cliente</NuxtLink>
      </Button>
    </div>
  </div>
</template>
