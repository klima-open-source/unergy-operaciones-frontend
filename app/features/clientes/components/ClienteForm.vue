<script setup lang="ts">
import type { TipoContactoCliente } from '~/features/clientes/types'
import type { Cliente, ClienteEditable } from '~/types/cliente'
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import divipolaRaw from '~/data/colombia-divipola.json'

const divipola = divipolaRaw as Record<string, string[]>

const ORIGENES = [
  { label: 'Prospección propia', value: 'prospeccion_propia' },
  { label: 'Recomendación', value: 'recomendacion' },
  { label: 'Referido', value: 'referido' },
  { label: 'Otro', value: 'otro' },
]

const TIPOS_CONTACTO: { label: string; value: TipoContactoCliente }[] = [
  { label: 'Comercial', value: 'comercial' },
  { label: 'Operacional', value: 'operacional' },
  { label: 'CGM', value: 'cgm' },
  { label: 'Liquidación', value: 'liquidacion' },
  { label: 'Contable', value: 'contable' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function emailValido(email: string) {
  return !email || EMAIL_RE.test(email.trim())
}

const props = defineProps<{ initial?: Partial<Cliente> | null }>()
const emit = defineEmits<{ save: [payload: Record<string, unknown>]; cancel: [] }>()

// Contactos solo se cargan al CREAR — al editar, se gestionan desde sus propias
// pestañas en la ficha del cliente (evita mandar de vuelta objetos ya
// existentes con forma distinta a la de creación).
const esNuevo = computed(() => !props.initial?.id)

interface ContactoDraft {
  nombre: string
  telefono: string
  email: string
  tipo: TipoContactoCliente
}

// `ui/input` no acepta `null` en su `modelValue` — los campos de texto se
// guardan siempre como string ('' cuando el backend manda null) y el payload
// solo incluye los que quedaron con contenido real (ver `submit`).
interface FormState {
  razon_social_nombre: string
  nit_cedula: string
  tipo_persona: ClienteEditable['tipo_persona']
  representante_legal: string
  departamento: string | null
  ciudad: string | null
  direccion: string
  origen_tipo: string | null
  origen_detalle: string
  iva_pct: number | null
  retencion_pct: number | null
  reteiva_pct: number | null
  reteica_pct: number | null
  contactos: ContactoDraft[]
}

function estadoDesde(initial?: Partial<Cliente> | null): FormState {
  return {
    razon_social_nombre: initial?.razon_social_nombre ?? '',
    nit_cedula: initial?.nit_cedula ?? '',
    tipo_persona: initial?.tipo_persona ?? null,
    representante_legal: initial?.representante_legal ?? '',
    departamento: initial?.departamento ?? null,
    ciudad: initial?.ciudad ?? null,
    direccion: initial?.direccion ?? '',
    origen_tipo: initial?.origen_tipo ?? null,
    origen_detalle: initial?.origen_detalle ?? '',
    iva_pct: initial?.iva_pct ?? null,
    retencion_pct: initial?.retencion_pct ?? null,
    reteiva_pct: initial?.reteiva_pct ?? null,
    reteica_pct: initial?.reteica_pct ?? null,
    contactos: [],
  }
}

const f = reactive(estadoDesde(props.initial))

// Departamento/ciudad — select en vez de texto libre (DIVIPOLA), mismo patrón
// que ProyectoForm, para evitar variantes de escritura.
const departamentoOptions = Object.keys(divipola)
  .sort()
  .map((d) => ({ label: d, value: d }))
const ciudadOptions = computed(() =>
  f.departamento ? (divipola[f.departamento] ?? []).map((c) => ({ label: c, value: c })) : [],
)

watch(
  () => f.departamento,
  (nuevo, anterior) => {
    if (nuevo !== anterior && f.ciudad && !(divipola[nuevo ?? ''] ?? []).includes(f.ciudad)) {
      f.ciudad = null
    }
  },
)
watch(
  () => props.initial,
  (v) => Object.assign(f, estadoDesde(v)),
  { deep: true },
)

function agregarContacto() {
  f.contactos = [...f.contactos, { nombre: '', telefono: '', email: '', tipo: 'comercial' }]
}
function eliminarContacto(idx: number) {
  f.contactos = f.contactos.filter((_, i) => i !== idx)
}

function submit() {
  // El NIT y la razón social son obligatorios en el backend, al crear Y al
  // editar: el NIT es la única identidad real del cliente. Se marcan
  // `required` arriba para que el navegador lo pida antes de la llamada.
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f)) {
    if (k === 'contactos') continue
    if (v !== null && v !== undefined && v !== '') payload[k] = v
  }
  if (esNuevo.value) {
    payload.contactos = f.contactos.filter((c) => c.email && emailValido(c.email))
  }
  emit('save', payload)
}
</script>

<template>
  <form class="space-y-4 pt-2" @submit.prevent="submit">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2 space-y-1.5">
        <GLabel required>Razón social / Nombre</GLabel>
        <Input v-model="f.razon_social_nombre" required />
      </div>
      <div class="space-y-1.5">
        <GLabel required>NIT / Cédula</GLabel>
        <Input v-model="f.nit_cedula" required />
        <p class="text-xs text-muted-foreground">
          Se guarda solo con los números: los puntos y el guion no cambian nada.
        </p>
      </div>
      <div class="space-y-1.5">
        <GLabel>Tipo de persona</GLabel>
        <Select v-model="f.tipo_persona">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="natural">Natural</SelectItem>
            <SelectItem value="juridica">Jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1.5">
        <GLabel>Representante legal</GLabel>
        <Input v-model="f.representante_legal" />
      </div>
      <div class="space-y-1.5">
        <GLabel>Departamento</GLabel>
        <ComboBox
          v-model="f.departamento"
          :options="departamentoOptions"
          placeholder="Seleccionar"
        />
      </div>
      <div class="space-y-1.5">
        <GLabel>Ciudad</GLabel>
        <ComboBox
          v-model="f.ciudad"
          :options="ciudadOptions"
          :disabled="!f.departamento"
          placeholder="Seleccionar"
        />
      </div>
      <div class="col-span-2 space-y-1.5">
        <GLabel>Dirección</GLabel>
        <Input v-model="f.direccion" />
      </div>
      <div class="space-y-1.5">
        <GLabel>Origen del cliente</GLabel>
        <ComboBox v-model="f.origen_tipo" :options="ORIGENES" placeholder="—" />
      </div>
      <div class="space-y-1.5">
        <GLabel>Quién lo recomendó/consiguió</GLabel>
        <Input v-model="f.origen_detalle" />
      </div>

      <div class="space-y-1.5">
        <GLabel>IVA %</GLabel>
        <NumberField v-model="f.iva_pct" :format-options="{ maximumFractionDigits: 2 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div class="space-y-1.5">
        <GLabel>ReteFuente %</GLabel>
        <NumberField v-model="f.retencion_pct" :format-options="{ maximumFractionDigits: 2 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div class="space-y-1.5">
        <GLabel>ReteIVA %</GLabel>
        <NumberField v-model="f.reteiva_pct" :format-options="{ maximumFractionDigits: 2 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div class="space-y-1.5">
        <GLabel>ReteICA %</GLabel>
        <NumberField v-model="f.reteica_pct" :format-options="{ maximumFractionDigits: 4 }">
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>

      <!-- ── Contactos (solo al crear) ── -->
      <div v-if="esNuevo" class="col-span-2">
        <div class="mt-1 border-t pt-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Contactos
            </p>
            <Button type="button" size="sm" variant="outline" @click="agregarContacto">
              <PlusIcon class="size-4" />
              Agregar
            </Button>
          </div>
          <div class="space-y-3 rounded-xl bg-muted/30 p-4">
            <p v-if="!f.contactos.length" class="py-1 text-xs text-muted-foreground italic">
              Sin contactos agregados
            </p>

            <div v-for="(c, idx) in f.contactos" :key="idx" class="flex items-center gap-2">
              <Input v-model="c.nombre" placeholder="Nombre" class="min-w-0 flex-1" />
              <Input v-model="c.telefono" placeholder="Teléfono" class="min-w-0 flex-1" />
              <Input v-model="c.email" type="email" placeholder="Correo *" class="min-w-0 flex-1" />
              <Select v-model="c.tipo">
                <SelectTrigger class="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in TIPOS_CONTACTO" :key="t.value" :value="t.value">
                    {{ t.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="shrink-0"
                @click="eliminarContacto(idx)"
              >
                <Trash2Icon class="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" @click="emit('cancel')">Cancelar</Button>
      <Button type="submit">Guardar</Button>
    </div>
  </form>
</template>
