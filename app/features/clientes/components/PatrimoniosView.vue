<script setup lang="ts">
/**
 * Patrimonios autónomos: las fiducias a través de las que se tiene una planta.
 *
 * El dueño de la participación es el inversionista (Ayura, Solenium…); al
 * patrimonio se le factura y se le liquida. Dos niveles: el general (la
 * fiduciaria) y sus subpatrimonios. Qué planta va por cuál patrimonio se elige
 * en la ficha del proyecto, pestaña Inversionistas; acá se ve y se administra el
 * catálogo.
 */
import type {
  ParticipacionEnPatrimonio,
  Patrimonio,
  PatrimonioGeneral,
  PayloadPatrimonio,
} from '~/features/clientes/types'
import type { Cliente } from '~/types/cliente'
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { clientes as cargarClientes } from '~/features/clientes/services/catalogoClientes'
import { PatrimoniosService } from '~/features/clientes/services/patrimonios'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'

const patrimoniosService = new PatrimoniosService()
const confirm = useConfirm()

const query = useQuery<PatrimonioGeneral[]>()

async function loadData() {
  await query.run(() => patrimoniosService.listar())
}

const catalogo = ref<Cliente[]>([])
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

const generales = computed(() => query.data ?? [])
const totalSub = computed(() => generales.value.reduce((n, g) => n + g.subpatrimonios.length, 0))

function pct(p: ParticipacionEnPatrimonio) {
  if (p.porcentaje_participacion == null) return '—'
  const valor = Number(p.porcentaje_participacion) * 100
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`
}

// ── Crear / editar ────────────────────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
/** Un general con subpatrimonios no puede pasar a ser uno: el backend da 409. */
const tieneSubpatrimonios = ref(false)

function blankForm() {
  return { nombre: '', codigo: '', padre: '', cliente: null as string | null }
}
const form = reactive(blankForm())

function abrirCrear(padre: PatrimonioGeneral | null = null) {
  editingId.value = null
  tieneSubpatrimonios.value = false
  Object.assign(form, blankForm(), { padre: padre ? String(padre.id) : '' })
  showForm.value = true
}

function abrirEditar(p: Patrimonio, subpatrimonios = 0) {
  editingId.value = p.id
  tieneSubpatrimonios.value = subpatrimonios > 0
  Object.assign(form, {
    nombre: p.nombre,
    codigo: p.codigo ?? '',
    padre: p.padre_id != null ? String(p.padre_id) : '',
    cliente: p.cliente_id != null ? String(p.cliente_id) : null,
  })
  showForm.value = true
}

/** Los generales a los que puede colgarse: todos menos él mismo. */
const opcionesPadre = computed(() => generales.value.filter((g) => g.id !== editingId.value))

async function onGuardar() {
  const body: PayloadPatrimonio = {
    nombre: form.nombre.trim(),
    codigo: form.codigo.trim() || null,
    padre_id: form.padre ? Number(form.padre) : null,
    cliente_id: form.cliente ? Number(form.cliente) : null,
  }
  saving.value = true
  try {
    if (editingId.value) {
      await patrimoniosService.actualizar(editingId.value, body)
      toast.success('Patrimonio actualizado')
    } else {
      await patrimoniosService.crear(body)
      toast.success('Patrimonio creado')
    }
    showForm.value = false
    await loadData()
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message })
  } finally {
    saving.value = false
  }
}

function eliminar(p: Patrimonio) {
  confirm({
    title: `Eliminar ${p.nombre}`,
    description:
      'Solo se puede eliminar un patrimonio sin plantas ni subpatrimonios. No se puede deshacer.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await patrimoniosService.eliminar(p.id)
        toast.success('Patrimonio eliminado')
        await loadData()
      } catch (err) {
        toast.error('No se pudo eliminar', { description: normalizeError(err).message })
      }
    },
  })
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader
      title="Patrimonios autónomos"
      :subtitle="`${generales.length} generales · ${totalSub} subpatrimonios · el dueño es el inversionista, al patrimonio se le factura`"
    >
      <template #actions>
        <Button size="sm" @click="abrirCrear()">
          <PlusIcon class="size-4" />
          Nuevo patrimonio
        </Button>
      </template>
    </PageHeader>

    <AsyncView :query="query">
      <template #default="{ data }">
        <EmptyState
          v-if="!data.length"
          title="Sin patrimonios"
          description="Crea la fiduciaria (el general) y después sus subpatrimonios."
        />
        <div v-for="general in data" :key="general.id" class="rounded-lg border border-border">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div>
              <p class="font-semibold text-foreground">{{ general.nombre }}</p>
              <p class="text-sm text-muted-foreground">
                <template v-if="general.cliente_id">
                  Se factura a {{ general.cliente_nombre }}
                  <span v-if="general.cliente_nit">· NIT {{ general.cliente_nit }}</span>
                </template>
                <span v-else class="text-warning"
                  >Sin ficha de cliente: no hay a quién facturar</span
                >
              </p>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="sm" @click="abrirCrear(general)">
                <PlusIcon class="size-4" />
                Subpatrimonio
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Editar"
                aria-label="Editar"
                @click="abrirEditar(general, general.subpatrimonios.length)"
              >
                <PencilIcon class="size-4 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Eliminar"
                aria-label="Eliminar"
                @click="eliminar(general)"
              >
                <Trash2Icon class="size-4 text-destructive" />
              </Button>
            </div>
          </div>

          <GTable>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Patrimonio</GTableHead>
                <GTableHead>Código</GTableHead>
                <GTableHead>Se factura a</GTableHead>
                <GTableHead>Plantas (dueño · participación)</GTableHead>
                <GTableHead />
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <GTableRow v-if="general.participaciones.length">
                <GTableCell class="text-muted-foreground italic">Directo en el general</GTableCell>
                <GTableCell>—</GTableCell>
                <GTableCell class="text-muted-foreground">La del general</GTableCell>
                <GTableCell>
                  <div v-for="p in general.participaciones" :key="p.id" class="text-sm">
                    <NuxtLink
                      :to="`/proyectos/${p.proyecto_id}`"
                      class="text-primary hover:underline"
                    >
                      {{ p.proyecto_nombre }}
                    </NuxtLink>
                    <span class="text-muted-foreground">
                      · {{ p.inversionista_nombre }} · {{ pct(p) }}</span
                    >
                  </div>
                </GTableCell>
                <GTableCell />
              </GTableRow>
              <TableEmpty
                v-if="!general.subpatrimonios.length && !general.participaciones.length"
                :colspan="5"
              >
                <p class="py-2 text-center text-muted-foreground">Sin subpatrimonios ni plantas.</p>
              </TableEmpty>
              <GTableRow v-for="sub in general.subpatrimonios" :key="sub.id">
                <GTableCell class="font-medium">{{ sub.nombre }}</GTableCell>
                <GTableCell>{{ sub.codigo || '—' }}</GTableCell>
                <GTableCell>
                  <template v-if="sub.cliente_id">
                    {{ sub.cliente_nombre }}
                    <span v-if="sub.cliente_nit" class="text-muted-foreground"
                      >· {{ sub.cliente_nit }}</span
                    >
                  </template>
                  <span v-else class="text-muted-foreground">La del general</span>
                </GTableCell>
                <GTableCell>
                  <span v-if="!sub.participaciones.length" class="text-muted-foreground"
                    >Sin plantas</span
                  >
                  <div v-for="p in sub.participaciones" :key="p.id" class="text-sm">
                    <NuxtLink
                      :to="`/proyectos/${p.proyecto_id}`"
                      class="text-primary hover:underline"
                    >
                      {{ p.proyecto_nombre }}
                    </NuxtLink>
                    <span class="text-muted-foreground">
                      · {{ p.inversionista_nombre }} · {{ pct(p) }}</span
                    >
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
        </div>
      </template>
    </AsyncView>

    <Dialog v-model:open="showForm">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Editar patrimonio' : 'Nuevo patrimonio' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <GLabel required>Nombre</GLabel>
            <Input v-model="form.nombre" placeholder="Ej: P.A. Valle de Gandalf" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Pertenece a</GLabel>
            <Select
              :model-value="aValorSelect(form.padre)"
              :disabled="tieneSubpatrimonios"
              @update:model-value="(v) => (form.padre = deValorSelect(v))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="VALOR_SELECT_VACIO"
                  >Ninguno: es un general (fiduciaria)</SelectItem
                >
                <SelectItem v-for="g in opcionesPadre" :key="g.id" :value="String(g.id)">
                  {{ g.nombre }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="tieneSubpatrimonios" class="text-xs text-muted-foreground">
              Tiene subpatrimonios: sigue siendo un general.
            </p>
          </div>
          <div v-if="form.padre" class="space-y-1.5">
            <GLabel>Código</GLabel>
            <Input v-model="form.codigo" placeholder="Ej: 17434" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Ficha de cliente (a quién se factura)</GLabel>
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
            <p class="text-xs text-muted-foreground">
              {{
                form.padre
                  ? 'Opcional: sin ficha propia, se le factura a la de su general.'
                  : 'La fiduciaria: razón social y NIT con los que se factura.'
              }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showForm = false">Cancelar</Button>
          <Button :disabled="!form.nombre.trim() || saving" @click="onGuardar">
            {{ editingId ? 'Guardar' : 'Crear' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
