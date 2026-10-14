<script setup lang="ts">
/**
 * «Traer de TSF» en Costos → Arriendos: las cuentas de cobro del período que los
 * propietarios subieron a originabot, con su valor por planta y su documento.
 *
 * Primero se consulta (no escribe) y se muestra todo, también lo que en TSF
 * todavía espera documento; la persona elige qué importar y el backend descarga
 * esos documentos y los guarda donde ya quedan los de la carga por ZIP. Ver
 * `apps/arriendos/services/cuentas_cobro_originabot.py` en el backend.
 */
import { CloudDownloadIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { ArriendosDocsService } from '~/features/finanzas/services/arriendos-docs'
import type { ConsultaCuentasCobroTsf, CuentaCobroTsf } from '~/features/finanzas/types'
import { formatCOP } from '~/utils/currency'

const props = defineProps<{ periodo: string; periodoLabel: string }>()
const emit = defineEmits<{ importados: [] }>()

const servicio = new ArriendosDocsService()

const consultando = ref(false)
const importando = ref(false)
const abierto = ref(false)
const consulta = ref<ConsultaCuentasCobroTsf | null>(null)
/** Por pago: un pago de TSF que cubre varias plantas se importa entero. */
const elegidos = ref<Set<string>>(new Set())

const ESTADOS: Record<string, 'success' | 'warning' | 'default'> = {
  paid: 'success',
  scheduled: 'success',
  uploaded_documents: 'default',
  wait_for_document: 'warning',
}

const importable = (c: CuentaCobroTsf) => c.tiene_documento
const cuentas = computed(() => consulta.value?.cuentas ?? [])
const seleccionadas = computed(() => cuentas.value.filter((c) => elegidos.value.has(c.pago_id)))
const totalSeleccionado = computed(() => seleccionadas.value.reduce((s, c) => s + c.valor, 0))
const pendientes = computed(() => cuentas.value.filter((c) => !c.tiene_documento).length)

function alternar(c: CuentaCobroTsf, marcado: boolean | 'indeterminate') {
  const nuevo = new Set(elegidos.value)
  if (marcado === true) nuevo.add(c.pago_id)
  else nuevo.delete(c.pago_id)
  elegidos.value = nuevo
}

async function consultar() {
  consultando.value = true
  try {
    const r = await servicio.cuentasCobroTsf(props.periodo)
    if (!r.cuentas.length) {
      toast.info(`TSF no tiene cuentas de cobro de ${props.periodoLabel}`, {
        description: r.errores[0] ?? 'Ningún propietario tiene pagos de ese mes en TSF.',
      })
      return
    }
    consulta.value = r
    // Marcado por defecto: lo que tiene documento y aún no está en Operaciones.
    elegidos.value = new Set(r.cuentas.filter((c) => importable(c) && !c.importado).map((c) => c.pago_id))
    abierto.value = true
  } catch (e) {
    toast.error('No se pudo consultar TSF', { description: normalizeError(e).message })
  } finally {
    consultando.value = false
  }
}

async function importar() {
  importando.value = true
  try {
    const r = await servicio.importarCuentasCobroTsf(props.periodo, [...elegidos.value])
    if (r.errores.length) {
      toast.warning(`${r.importados} documentos guardados; ${r.errores.length} no se pudieron traer`, {
        description: r.errores.slice(0, 3).join(' · '),
      })
    } else {
      toast.success(`${r.importados} ${r.importados === 1 ? 'documento guardado' : 'documentos guardados'} desde TSF`)
    }
    abierto.value = false
    emit('importados')
  } catch (e) {
    toast.error('No se pudo importar', { description: normalizeError(e).message })
  } finally {
    importando.value = false
  }
}
</script>

<template>
  <Button variant="outline" size="sm" class="border-primary text-primary" :disabled="consultando" @click="consultar">
    <Spinner v-if="consultando" class="size-4" /><CloudDownloadIcon v-else class="size-4" /> Traer de TSF
  </Button>

  <Dialog v-model:open="abierto">
    <DialogContent class="sm:max-w-5xl max-h-dvh overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Cuentas de cobro de TSF · {{ periodoLabel }}</DialogTitle>
        <DialogDescription>
          Lo que cada propietario subió a TSF este mes, por proyecto. Se guarda el documento con el valor de cada proyecto;
          en TSF no se cambia nada.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="consulta && (consulta.errores.length || consulta.sin_minigranja.length || pendientes)"
        class="flex flex-col gap-1 rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs text-foreground"
      >
        <span v-if="pendientes">
          {{ pendientes }} {{ pendientes === 1 ? 'cuenta todavía espera' : 'cuentas todavía esperan' }} documento en TSF:
          se muestran pero no se pueden importar.
        </span>
        <span v-if="consulta.sin_minigranja.length">
          Sin minigranja de TSF (no se consultan): {{ consulta.sin_minigranja.join(', ') }}.
        </span>
        <span v-for="e in consulta.errores" :key="e">{{ e }}</span>
      </div>

      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2" />
              <th class="px-3 py-2 text-left font-medium">Proyecto</th>
              <th class="px-3 py-2 text-left font-medium">Propietario</th>
              <th class="px-3 py-2 text-left font-medium">Fecha</th>
              <th class="px-3 py-2 text-left font-medium">Estado en TSF</th>
              <th class="px-3 py-2 text-right font-medium">Valor del proyecto</th>
              <th class="px-3 py-2 text-left font-medium">Documento</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="c in cuentas" :key="`${c.pago_id}:${c.proyecto_id}`" :class="importable(c) ? '' : 'opacity-60'">
              <td class="px-3 py-2">
                <Checkbox
                  :model-value="elegidos.has(c.pago_id)"
                  :disabled="!importable(c)"
                  @update:model-value="alternar(c, $event)"
                />
              </td>
              <td class="px-3 py-2"><TruncatedText :text="c.proyecto_nombre" class="max-w-xs" /></td>
              <td class="px-3 py-2">
                <span class="flex flex-col">
                  <TruncatedText :text="c.landlord_nombre" class="max-w-xs" />
                  <span v-if="!c.arrendador_id" class="whitespace-nowrap text-xs text-muted-foreground">Sin vincular a un arrendador</span>
                </span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap tabular-nums">{{ c.fecha }}</td>
              <td class="px-3 py-2"><GBadge :color="ESTADOS[c.estado] ?? 'default'" class="text-xs">{{ c.estado_texto }}</GBadge></td>
              <td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">{{ formatCOP(c.valor) }}</td>
              <td class="px-3 py-2 whitespace-nowrap text-xs">
                <span v-if="!c.tiene_documento" class="text-muted-foreground">Pendiente en TSF</span>
                <span v-else-if="c.importado" class="text-success">Ya está en Operaciones</span>
                <span v-else>{{ c.tipo_documento === 'factura_electronica' ? 'Factura electrónica' : 'Cuenta de cobro' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DialogFooter class="items-center">
        <span class="mr-auto text-xs text-muted-foreground tabular-nums">
          {{ seleccionadas.length }} seleccionadas · {{ formatCOP(totalSeleccionado) }}
        </span>
        <Button variant="outline" @click="abierto = false">Cancelar</Button>
        <Button :disabled="importando || !elegidos.size" @click="importar">
          <Spinner v-if="importando" class="size-4" />
          Importar {{ elegidos.size }} {{ elegidos.size === 1 ? 'pago' : 'pagos' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
