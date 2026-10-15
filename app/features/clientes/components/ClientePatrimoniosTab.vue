<script setup lang="ts">
/**
 * Pestaña Patrimonios de la ficha del cliente.
 *
 * Una fiduciaria es un cliente más; sus patrimonios autónomos se administran
 * desde su ficha. Por dentro el backend guarda un patrimonio "general" atado a
 * la ficha de la fiduciaria, con los patrimonios colgando de él: acá no se ve,
 * se crea solo con el primer patrimonio y se borra con el último.
 *
 * El dueño de cada planta sigue siendo el inversionista; al patrimonio se le
 * factura. Qué planta va por cuál patrimonio se elige en la ficha del proyecto.
 */
import type {
  ParticipacionEnPatrimonio,
  Patrimonio,
  PatrimonioGeneral,
} from '~/features/clientes/types'
import type { ClienteLiviano } from '~/types/cliente'
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { clientes as cargarClientes } from '~/features/clientes/services/catalogoClientes'
import { PatrimoniosService } from '~/features/clientes/services/patrimonios'

const props = defineProps<{
  clienteId: number
  nombreCliente: string
}>()

const patrimoniosService = new PatrimoniosService()
const catalogoPatrimonios = useCatalogoPatrimonios()
const confirm = useConfirm()

const query = useQuery<PatrimonioGeneral[]>()

// Acá se administran: siempre lo último, y cada cambio termina recargando, así
// que acá también se invalida el catálogo compartido de los desplegables.
async function loadData() {
  catalogoPatrimonios.invalidar()
  await query.run(() => patrimoniosService.listar())
}

const catalogo = ref<ClienteLiviano[]>([])
onMounted(() => {
  loadData()
  cargarClientes()
    .then((filas) => {
      catalogo.value = filas
    })
    .catch(() => {
      catalogo.value = []
    })
})

const opcionesClientes = computed(() =>
  catalogo.value.map((c) => ({
    value: String(c.id),
    label: c.nit_cedula ? `${c.razon_social_nombre} · ${c.nit_cedula}` : c.razon_social_nombre,
  })),
)

/** El general de esta fiduciaria, si ya tiene patrimonios. */
const general = computed(() => query.data?.find((g) => g.cliente_id === props.clienteId) ?? null)

/** Si este cliente es la ficha propia de un patrimonio de otra fiduciaria. */
const esFichaDe = computed(() => {
  for (const g of query.data ?? []) {
    const sub = g.subpatrimonios.find((s) => s.cliente_id === props.clienteId)
    if (sub) return { patrimonio: sub, fiduciaria: g }
  }
  return null
})

function pct(p: ParticipacionEnPatrimonio) {
  if (p.porcentaje_participacion == null) return '—'
  const valor = Number(p.porcentaje_participacion) * 100
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`
}

/** Una línea por planta con sus dueños: Sol de la Sierra tiene dos por planta. */
function porPlanta(participaciones: ParticipacionEnPatrimonio[]) {
  const plantas = new Map<number, { id: number; nombre: string | null; duenos: string[] }>()
  for (const p of participaciones) {
    const planta = plantas.get(p.proyecto_id) ?? {
      id: p.proyecto_id,
      nombre: p.proyecto_nombre,
      duenos: [],
    }
    planta.duenos.push(`${p.inversionista_nombre ?? '—'} ${pct(p)}`)
    plantas.set(p.proyecto_id, planta)
  }
  return [...plantas.values()]
}

// ── Crear / editar ────────────────────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

function blankForm() {
  return { nombre: '', codigo: '', cliente: null as string | null }
}
const form = reactive(blankForm())

function abrirCrear() {
  editingId.value = null
  Object.assign(form, blankForm())
  showForm.value = true
}

function abrirEditar(p: Patrimonio) {
  editingId.value = p.id
  Object.assign(form, {
    nombre: p.nombre,
    codigo: p.codigo ?? '',
    cliente: p.cliente_id != null ? String(p.cliente_id) : null,
  })
  showForm.value = true
}

/** El general de la fiduciaria; lo crea con el primer patrimonio. */
async function asegurarGeneral(): Promise<number> {
  if (general.value) return general.value.id
  const creado = await patrimoniosService.crear({
    nombre: props.nombreCliente,
    codigo: null,
    padre_id: null,
    cliente_id: props.clienteId,
  })
  return creado.id
}

async function onGuardar() {
  saving.value = true
  try {
    const datos = {
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim() || null,
      cliente_id: form.cliente ? Number(form.cliente) : null,
    }
    if (editingId.value) {
      await patrimoniosService.actualizar(editingId.value, {
        ...datos,
        padre_id: general.value?.id ?? null,
      })
      toast.success('Patrimonio actualizado')
    } else {
      await patrimoniosService.crear({ ...datos, padre_id: await asegurarGeneral() })
      toast.success('Patrimonio creado')
    }
    showForm.value = false
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message })
  } finally {
    saving.value = false
    await loadData()
  }
}

function eliminar(p: Patrimonio) {
  confirm({
    title: `Eliminar ${p.nombre}`,
    description: 'Solo se puede eliminar un patrimonio sin plantas. No se puede deshacer.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await patrimoniosService.eliminar(p.id)
        // Con el último patrimonio se va también el general, que no se ve.
        const g = general.value
        if (g && g.subpatrimonios.length === 1 && !g.participaciones.length) {
          await patrimoniosService.eliminar(g.id)
        }
        toast.success('Patrimonio eliminado')
      } catch (err) {
        toast.error('No se pudo eliminar', { description: normalizeError(err).message })
      } finally {
        await loadData()
      }
    },
  })
}
</script>

<template>
  <div class="space-y-4">
    <AsyncView :query="query">
      <template #default>
        <p v-if="esFichaDe" class="rounded-lg border border-border bg-muted p-3 text-sm">
          Esta es la ficha con la que se factura el patrimonio
          <span class="font-semibold">
            {{ esFichaDe.patrimonio.codigo }} {{ esFichaDe.patrimonio.nombre }}
          </span>
          de
          <NuxtLink
            v-if="esFichaDe.fiduciaria.cliente_id"
            :to="`/clientes/${esFichaDe.fiduciaria.cliente_id}?tab=patrimonios`"
            class="text-primary hover:underline"
          >
            {{ esFichaDe.fiduciaria.cliente_nombre }}
          </NuxtLink>
          <span v-else>{{ esFichaDe.fiduciaria.nombre }}</span
          >.
        </p>

        <div v-if="!esFichaDe" class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-muted-foreground">
            Si este cliente es una fiduciaria, aquí van sus patrimonios autónomos. El dueño de cada
            planta es el inversionista; al patrimonio se le factura.
          </p>
          <Button size="sm" @click="abrirCrear">
            <PlusIcon class="size-4" />
            Agregar patrimonio
          </Button>
        </div>

        <EmptyState
          v-if="!general && !esFichaDe"
          title="Sin patrimonios"
          description="Este cliente no tiene patrimonios autónomos registrados."
        />
        <GTable v-else-if="general">
          <GTableHeader>
            <GTableRow>
              <GTableHead>Código</GTableHead>
              <GTableHead>Patrimonio</GTableHead>
              <GTableHead>Se factura a</GTableHead>
              <GTableHead>Plantas (dueño · participación)</GTableHead>
              <GTableHead />
            </GTableRow>
          </GTableHeader>
          <GTableBody>
            <GTableRow v-if="general.participaciones.length">
              <GTableCell>—</GTableCell>
              <GTableCell class="text-muted-foreground italic">Directo en la fiduciaria</GTableCell>
              <GTableCell class="text-muted-foreground">La fiduciaria</GTableCell>
              <GTableCell>
                <div
                  v-for="planta in porPlanta(general.participaciones)"
                  :key="planta.id"
                  class="text-sm"
                >
                  <NuxtLink
                    :to="`/proyectos/${planta.id}?tab=inversionistas`"
                    class="text-primary hover:underline"
                  >
                    {{ planta.nombre }}
                  </NuxtLink>
                  <span class="text-muted-foreground"> · {{ planta.duenos.join(' + ') }}</span>
                </div>
              </GTableCell>
              <GTableCell />
            </GTableRow>
            <GTableRow v-for="sub in general.subpatrimonios" :key="sub.id">
              <GTableCell>{{ sub.codigo || '—' }}</GTableCell>
              <GTableCell class="font-medium">{{ sub.nombre }}</GTableCell>
              <GTableCell>
                <!-- La razón social de un P.A. repite la de la fiduciaria entera:
                     el NIT es lo que lo distingue; el nombre completo, en el title. -->
                <NuxtLink
                  v-if="sub.cliente_id"
                  :to="`/clientes/${sub.cliente_id}`"
                  :title="sub.cliente_nombre ?? undefined"
                  class="whitespace-nowrap text-primary hover:underline"
                >
                  Ficha propia · NIT {{ sub.cliente_nit ?? '—' }}
                </NuxtLink>
                <span v-else class="text-muted-foreground">La fiduciaria</span>
              </GTableCell>
              <GTableCell>
                <span v-if="!sub.participaciones.length" class="text-muted-foreground"
                  >Sin plantas</span
                >
                <div
                  v-for="planta in porPlanta(sub.participaciones)"
                  :key="planta.id"
                  class="text-sm"
                >
                  <NuxtLink
                    :to="`/proyectos/${planta.id}?tab=inversionistas`"
                    class="text-primary hover:underline"
                  >
                    {{ planta.nombre }}
                  </NuxtLink>
                  <span class="text-muted-foreground"> · {{ planta.duenos.join(' + ') }}</span>
                </div>
              </GTableCell>
              <GTableCell>
                <div class="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Editar"
                    aria-label="Editar"
                    @click="abrirEditar(sub)"
                  >
                    <PencilIcon class="size-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Eliminar"
                    aria-label="Eliminar"
                    @click="eliminar(sub)"
                  >
                    <Trash2Icon class="size-4 text-destructive" />
                  </Button>
                </div>
              </GTableCell>
            </GTableRow>
          </GTableBody>
        </GTable>
      </template>
    </AsyncView>

    <Dialog v-model:open="showForm">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Editar patrimonio' : 'Agregar patrimonio' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <GLabel>Código</GLabel>
            <Input v-model="form.codigo" placeholder="Ej: 17434" />
          </div>
          <div class="space-y-1.5">
            <GLabel required>Nombre</GLabel>
            <Input v-model="form.nombre" placeholder="Ej: P.A. Valle de Gandalf" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Ficha propia (si factura con otro NIT)</GLabel>
            <div class="flex items-center gap-1">
              <div class="min-w-0 flex-1">
                <ComboBox
                  v-model="form.cliente"
                  :options="opcionesClientes"
                  placeholder="Buscar cliente…"
                />
              </div>
              <Button
                v-if="form.cliente"
                variant="ghost"
                size="icon-sm"
                title="Quitar ficha"
                aria-label="Quitar ficha"
                @click="form.cliente = null"
              >
                <XIcon class="size-4" />
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">Vacío: se le factura a {{ nombreCliente }}.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showForm = false">Cancelar</Button>
          <Button :disabled="!form.nombre.trim() || saving" @click="onGuardar">
            {{ editingId ? 'Guardar' : 'Agregar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
