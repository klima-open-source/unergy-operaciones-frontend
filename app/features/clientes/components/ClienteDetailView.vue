<script setup lang="ts">
import type {
  ClienteDetalle,
  ContratoPpaClienteResumen,
  FronteraClienteResumen,
  ProyectoClienteResumen,
} from '~/features/clientes/types'
import {
  BriefcaseIcon,
  ChevronRightIcon,
  FilePenIcon,
  FolderIcon,
  GlobeIcon,
  LayoutGridIcon,
  MailIcon,
  Trash2Icon,
  UserIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { isFetchError, normalizeError } from '~/core/errors'
import { ClientesService } from '~/features/clientes/services/clientes'
import { formatearNombre } from '~/utils/nombreFormato'
import ClienteDocumentosTab from './ClienteDocumentosTab.vue'
import ClienteForm from './ClienteForm.vue'
import ClienteResumen from './ClienteResumen.vue'
import ClienteServiciosTab from './ClienteServiciosTab.vue'

// Por qué una planta aparece en la ficha del cliente. Los devuelve
// `GET /clientes/{id}/proyectos` en `roles`, y son los tres caminos de
// `proyectos_por_cliente`: participación, contrato de servicio (como quien lo
// firma o quien lo presta) y PPA.
const ROL_LABELS: Record<string, string> = {
  inversionista: 'Inversionista',
  contratante: 'Contratante',
  prestador: 'Prestador',
  ppa: 'PPA',
}

const tabs = [
  { key: 'resumen', label: 'Resumen', icon: LayoutGridIcon },
  { key: 'info', label: 'Información', icon: UserIcon },
  { key: 'contactos', label: 'Contactos', icon: MailIcon },
  { key: 'servicios', label: 'Servicios', icon: BriefcaseIcon },
  { key: 'documentos', label: 'Documentos', icon: FolderIcon },
  { key: 'proyectos', label: 'Proyectos', icon: ZapIcon },
  { key: 'fronteras', label: 'Fronteras', icon: GlobeIcon },
  { key: 'ppa', label: 'Contratos PPA', icon: FilePenIcon },
]

const clientesService = new ClientesService()
const confirm = useConfirm()

const route = useRoute()
const router = useRouter()
const clienteId = computed(() => Number(route.params.id))

const cliente = ref<ClienteDetalle | null>(null)
const activeTab = ref('resumen') // DetalleLayout sincroniza con ?tab=
const deleting = ref(false)

async function cargar() {
  cliente.value = await clientesService.obtener(clienteId.value)
}

onMounted(cargar)

// ── Registros relacionados (proyectos / fronteras / PPA) ─────────────────────

const clienteProyectos = ref<ProyectoClienteResumen[]>([])
const clienteFronteras = ref<FronteraClienteResumen[]>([])
const clientePPA = ref<ContratoPpaClienteResumen[]>([])
const loadingRelated = ref(false)

// Fix 2026-08-19: cada llamada tenía su propio `catch` que devolvía `[]`, así
// que un error real (500, timeout) se veía idéntico a "este cliente no tiene
// nada". Ahora el error sube y avisa con un toast.
async function loadRelatedData(tab: string) {
  loadingRelated.value = true
  try {
    if (tab === 'proyectos' && clienteProyectos.value.length === 0) {
      clienteProyectos.value = await clientesService.listarProyectos(clienteId.value)
    } else if (tab === 'fronteras' && clienteFronteras.value.length === 0) {
      clienteFronteras.value = await clientesService.listarFronteras(clienteId.value)
    } else if (tab === 'ppa' && clientePPA.value.length === 0) {
      clientePPA.value = await clientesService.listarContratosPpa(clienteId.value)
    }
  } catch (err) {
    toast.error('No se pudo cargar', { description: normalizeError(err).message })
  } finally {
    loadingRelated.value = false
  }
}

watch(activeTab, (tab) => {
  if (['proyectos', 'fronteras', 'ppa'].includes(tab)) loadRelatedData(tab)
})

// ── Información (aviso de nombre parecido al editar) ─────────────────────────

async function saveInfo(payload: Record<string, unknown>) {
  try {
    await clientesService.actualizar(clienteId.value, payload)
    toast.success('Información actualizada')
    await cargar()
  } catch (err) {
    if (
      isFetchError<{
        detail?: { duplicado_nombre?: boolean; candidato_id: number; candidato_nombre: string }
      }>(err) &&
      err.status === 409 &&
      err.data?.detail?.duplicado_nombre
    ) {
      const { candidato_id, candidato_nombre } = err.data.detail
      confirm({
        title: 'Cliente parecido ya existe',
        description: `Ya existe otro cliente con un nombre muy parecido: "${candidato_nombre}" (ID ${candidato_id}). Si de verdad son clientes distintos, puedes guardar igual.`,
        confirmLabel: 'Guardar de todos modos',
        onConfirm: () => guardarForzado(payload),
      })
      return
    }
    toast.error('No se pudo guardar', { description: normalizeError(err).message })
  }
}

async function guardarForzado(payload: Record<string, unknown>) {
  try {
    await clientesService.actualizar(clienteId.value, payload, true)
    toast.success('Información actualizada')
    await cargar()
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message })
  }
}

// ── Eliminar cliente ──────────────────────────────────────────────────────────

function confirmarEliminar() {
  if (!cliente.value) return
  confirm({
    title: 'Eliminar cliente',
    description: `¿Estás seguro de que deseas eliminar ${formatearNombre(cliente.value.razon_social_nombre)}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: doDelete,
  })
}

async function doDelete() {
  deleting.value = true
  try {
    await clientesService.eliminar(clienteId.value)
    toast.success('Cliente eliminado')
    // A la vista unificada: /clientes se retiró el 2026-09-15 por ser un
    // duplicado de su pestaña Clientes.
    router.push('/servicios-unificado?vista=clientes')
  } catch (err) {
    toast.error('No se pudo eliminar', { description: normalizeError(err).message })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="cliente" class="space-y-4">
    <DetalleLayout
      v-model="activeTab"
      :volver="{ to: '/servicios-unificado?vista=clientes', label: 'Clientes' }"
      :titulo="formatearNombre(cliente.razon_social_nombre) ?? ''"
      :codigo="cliente.nit_cedula || ''"
      :tabs="tabs"
    >
      <template #acciones>
        <Button variant="ghost" size="sm" class="text-destructive" @click="confirmarEliminar">
          <Trash2Icon class="size-4" />
          Eliminar
        </Button>
      </template>
      <template #default>
        <!-- ── Tab: Resumen 360 ── -->
        <div v-if="activeTab === 'resumen'">
          <ClienteResumen :cliente-id="clienteId" />
        </div>

        <!-- ── Tab: Información ── -->
        <div v-if="activeTab === 'info'" class="space-y-6">
          <ClienteForm :initial="cliente" @save="saveInfo" @cancel="() => {}" />
        </div>

        <!-- ── Tab: Contactos ── -->
        <div v-if="activeTab === 'contactos'" class="space-y-4">
          <ContactosPanel :cliente-id="cliente.id" />
        </div>

        <!-- ── Tab: Servicios ── -->
        <div v-if="activeTab === 'servicios'">
          <ClienteServiciosTab :cliente-id="clienteId" />
        </div>

        <!-- ── Tab: Documentos ── -->
        <div v-if="activeTab === 'documentos'">
          <ClienteDocumentosTab
            :cliente-id="clienteId"
            :documentos="cliente.documentos_comerciales ?? []"
            :nombre-cliente="formatearNombre(cliente.razon_social_nombre) ?? ''"
            @changed="cargar"
          />
        </div>

        <!-- ── Tab: Proyectos vinculados ── -->
        <div v-if="activeTab === 'proyectos'" class="space-y-4">
          <p class="text-sm text-muted-foreground">Proyectos asociados a este cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <Spinner class="size-5" />
          </div>
          <p
            v-else-if="clienteProyectos.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            No hay proyectos vinculados a este cliente.
          </p>
          <div v-else class="space-y-2">
            <Item v-for="p in clienteProyectos" :key="p.id" as-child variant="outline">
              <NuxtLink :to="`/proyectos/${p.id}`">
                <ItemMedia variant="icon" class="bg-primary/10 text-primary">
                  <ZapIcon class="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{{ p.nombre_comercial }}</ItemTitle>
                  <ItemDescription>
                    {{ [p.municipio, p.departamento].filter(Boolean).join(', ') || '—' }}
                    <span v-if="p.potencia_ac_kw"> · {{ p.potencia_ac_kw }} kW AC</span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <GBadge v-for="rol in p.roles ?? []" :key="rol" variant="outline">
                    {{ ROL_LABELS[rol] ?? rol }}
                  </GBadge>
                  <GBadge
                    v-if="p.estado"
                    :color="p.estado === 'en_operacion' ? 'success' : 'warning'"
                  >
                    {{ p.estado === 'en_operacion' ? 'En operación' : p.estado }}
                  </GBadge>
                  <ChevronRightIcon class="size-4 text-muted-foreground" />
                </ItemActions>
              </NuxtLink>
            </Item>
          </div>
        </div>

        <!-- ── Tab: Fronteras ── -->
        <div v-if="activeTab === 'fronteras'" class="space-y-4">
          <p class="text-sm text-muted-foreground">Fronteras comerciales del cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <Spinner class="size-5" />
          </div>
          <p
            v-else-if="clienteFronteras.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            No hay fronteras registradas para este cliente.
          </p>
          <div v-else class="space-y-2">
            <Item v-for="f in clienteFronteras" :key="f.id" variant="outline">
              <ItemMedia variant="icon" class="bg-accent text-accent-foreground">
                <GlobeIcon class="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle class="font-mono">{{ f.codigo_frontera }}</ItemTitle>
                <ItemDescription>{{ f.nombre_frontera || '—' }}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <GBadge v-if="f.estado" :color="f.estado === 'activa' ? 'success' : 'warning'">
                  {{ f.estado }}
                </GBadge>
              </ItemActions>
            </Item>
          </div>
        </div>

        <!-- ── Tab: Contratos PPA ── -->
        <div v-if="activeTab === 'ppa'" class="space-y-4">
          <p class="text-sm text-muted-foreground">Contratos PPA vinculados al cliente.</p>
          <div v-if="loadingRelated" class="flex justify-center py-8">
            <Spinner class="size-5" />
          </div>
          <p
            v-else-if="clientePPA.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            No hay contratos PPA para este cliente.
          </p>
          <div v-else class="space-y-2">
            <Item v-for="c in clientePPA" :key="c.id" as-child variant="outline">
              <NuxtLink :to="`/contratos/${c.id}`">
                <ItemMedia variant="icon" class="bg-warning/10 text-warning">
                  <FilePenIcon class="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{{
                    c.nombre_interno || c.numero_codigo_contrato || 'Sin nombre'
                  }}</ItemTitle>
                  <ItemDescription>
                    {{ c.comprador_nombre || '—' }} → {{ c.vendedor_nombre || '—' }}
                    <span v-if="c.fecha_inicio">
                      · {{ c.fecha_inicio }} a {{ c.fecha_fin || '—' }}</span
                    >
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon class="size-4 text-muted-foreground" />
                </ItemActions>
              </NuxtLink>
            </Item>
          </div>
        </div>
      </template>
    </DetalleLayout>
  </div>

  <div v-else class="flex items-center justify-center py-20">
    <Spinner class="size-6" />
  </div>
</template>
