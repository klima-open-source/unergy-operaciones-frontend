<script setup lang="ts">
import type { ClienteDetalle } from '~/features/clientes/types'
import { CheckIcon } from '@lucide/vue'
import { isFetchError } from '~/core/errors'
import { ClientesService } from '~/features/clientes/services/clientes'
import { mensajeDeError } from '~/utils/mensajeDeError'

interface DuplicadoInfo {
  candidato_id: number
  candidato_nombre: string
}

function detalleDuplicado(err: unknown): DuplicadoInfo | null {
  if (!isFetchError<{ detail?: { duplicado_nombre?: boolean } & DuplicadoInfo }>(err)) return null
  if (err.status !== 409) return null
  const detail = err.data?.detail
  return detail?.duplicado_nombre ? detail : null
}

const clientesService = new ClientesService()

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** Lo que el usuario ya escribió en el selector, para no teclearlo dos veces. */
    nombreInicial?: string
  }>(),
  { nombreInicial: '' },
)
const emit = defineEmits<{ 'update:visible': [visible: boolean]; creado: [cliente: ClienteDetalle] }>()

const guardando = ref(false)
const vinculando = ref(false)
const errores = reactive<{ nombre?: string | null; nit?: string | null }>({})
const duplicado = ref<DuplicadoInfo | null>(null)
const rutUrl = ref('')
const ccUrl = ref('')
const certUrl = ref('')

const form = reactive({
  razon_social_nombre: '',
  nit_cedula: '',
  tipo_persona: null as 'natural' | 'juridica' | null,
})

// El diálogo se monta una vez y se reabre muchas: sin esto conserva el nombre,
// el NIT y el aviso de duplicado de la vez anterior, y el segundo cliente nace
// con los datos del primero.
watch(
  () => props.visible,
  (abierto) => {
    if (!abierto) return
    form.razon_social_nombre = props.nombreInicial
    form.nit_cedula = ''
    form.tipo_persona = null
    rutUrl.value = ''
    ccUrl.value = ''
    certUrl.value = ''
    duplicado.value = null
    errores.nombre = null
    errores.nit = null
  },
)

/** Vincula el cliente que ya existía, en vez de crear otro. */
async function usarCandidato() {
  if (!duplicado.value) return
  const { candidato_id, candidato_nombre } = duplicado.value
  vinculando.value = true
  try {
    // Se pide el detalle para traer el NIT: el 409 solo manda id y nombre, y la
    // parte del contrato necesita el NIT para llenar su campo.
    const cliente = await clientesService.obtener(candidato_id)
    emit('creado', cliente)
  } catch {
    emit('creado', { id: candidato_id, razon_social_nombre: candidato_nombre })
  } finally {
    vinculando.value = false
    emit('update:visible', false)
  }
}

async function guardar(forzar: boolean) {
  errores.nombre = form.razon_social_nombre.trim() ? null : 'Campo obligatorio'
  errores.nit = form.nit_cedula.trim() ? null : 'Campo obligatorio'
  if (errores.nombre || errores.nit) return

  guardando.value = true
  try {
    const cliente = await clientesService.crear(
      {
        razon_social_nombre: form.razon_social_nombre.trim(),
        nit_cedula: form.nit_cedula.trim(),
        tipo_persona: form.tipo_persona,
      },
      forzar,
    )

    const docs = [
      { tipo: 'rut' as const, url: rutUrl.value.trim(), nombre: 'RUT' },
      { tipo: 'camara_comercio' as const, url: ccUrl.value.trim(), nombre: 'Cámara de comercio' },
      { tipo: 'certificado_bancario' as const, url: certUrl.value.trim(), nombre: 'Certificación bancaria' },
    ].filter((d) => d.url)

    for (const d of docs) {
      await clientesService.crearDocumento(cliente.id, {
        tipo: d.tipo,
        nombre: d.nombre,
        numero: null,
        fecha: null,
        estado: 'aceptado',
        archivo_url: d.url,
        archivo_nombre: null,
        notas: null,
      })
    }

    emit('creado', cliente)
    emit('update:visible', false)
  } catch (err) {
    const aviso = detalleDuplicado(err)
    if (aviso) {
      duplicado.value = aviso
      return
    }
    // El motivo real: la validación por campo de DRF no viene en `detail`, y el
    // aviso de nombre parecido lo manda como objeto — `mensajeDeError` lee las
    // dos formas (a diferencia de `normalizeError`, que solo lee `detail`).
    errores.nombre = mensajeDeError(err, 'No se pudo crear el cliente.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Nuevo cliente</DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Aviso de nombre parecido. NO es un error: es la bifurcación que evita
             que nazca el duplicado. -->
        <Alert v-if="duplicado">
          <AlertTitle>Ya existe un cliente con un nombre muy parecido</AlertTitle>
          <AlertDescription class="space-y-3">
            <p>
              <strong>{{ duplicado.candidato_nombre }}</strong> (ID {{ duplicado.candidato_id }}).
              Si es el mismo, vincúlalo en vez de crear otro: dos fichas de la misma empresa
              parten sus contratos y sus cobros en dos.
            </p>
            <div class="flex gap-2">
              <Button size="sm" :disabled="vinculando" @click="usarCandidato">
                Es el mismo, vincularlo
              </Button>
              <Button size="sm" variant="outline" :disabled="guardando" @click="guardar(true)">
                Es otro, crear igual
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-1.5">
            <GLabel required>Nombre / Razón social</GLabel>
            <Input v-model="form.razon_social_nombre" placeholder="Ej: Terpel Energía S.A.S." />
            <p v-if="errores.nombre" class="text-xs text-destructive">{{ errores.nombre }}</p>
          </div>
          <div class="space-y-1.5">
            <GLabel required>NIT / Cédula</GLabel>
            <Input v-model="form.nit_cedula" placeholder="Ej: 900123456-7" />
            <p v-if="errores.nit" class="text-xs text-destructive">{{ errores.nit }}</p>
          </div>
          <div class="space-y-1.5">
            <GLabel>Tipo persona</GLabel>
            <Select v-model="form.tipo_persona">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="juridica">Jurídica</SelectItem>
                <SelectItem value="natural">Natural</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-3 border-t pt-3">
          <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Documentos <span class="font-normal normal-case">(links de Google Drive)</span>
          </p>
          <div class="space-y-1.5">
            <GLabel>RUT</GLabel>
            <Input v-model="rutUrl" placeholder="https://drive.google.com/…" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Cámara de comercio</GLabel>
            <Input v-model="ccUrl" placeholder="https://drive.google.com/…" />
          </div>
          <div class="space-y-1.5">
            <GLabel>Certificación bancaria</GLabel>
            <Input v-model="certUrl" placeholder="https://drive.google.com/…" />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="emit('update:visible', false)">Cancelar</Button>
        <Button :disabled="guardando || !!duplicado" @click="guardar(false)">
          <CheckIcon class="size-4" />
          Crear cliente
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
