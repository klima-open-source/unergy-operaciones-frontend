<script setup lang="ts">
import type { ContactoOperadorRed, OperadorRed } from '~/features/operadores-red/types'
import { MailIcon, PlusIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'

const operadoresRedService = new OperadoresRedService()
const confirm = useConfirm()

const route = useRoute()
const query = useQuery<OperadorRed>()
const nuevo = ref<{ email: string; nombre: string } | null>(null)

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')
}

async function cargar() {
  await query.run(() => operadoresRedService.obtener(Number(route.params.id)))
}

async function crearContacto() {
  if (!nuevo.value || !emailValido(nuevo.value.email) || !query.data) return
  try {
    const contacto = await operadoresRedService.crearContacto(query.data.id, {
      email: nuevo.value.email.trim().toLowerCase(),
      nombre: nuevo.value.nombre.trim() || null,
    })
    query.data.contactos.push(contacto)
    nuevo.value = null
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  }
}

async function guardarContacto(contacto: ContactoOperadorRed) {
  if (!emailValido(contacto.email)) return
  try {
    await operadoresRedService.actualizarContacto(contacto.id, {
      email: contacto.email.trim().toLowerCase(),
      nombre: contacto.nombre?.trim() || null,
    })
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  }
}

function confirmarEliminar(contacto: ContactoOperadorRed) {
  confirm({
    title: 'Eliminar contacto',
    description: `¿Eliminar el correo "${contacto.email}"?`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminarContacto(contacto),
  })
}

async function eliminarContacto(contacto: ContactoOperadorRed) {
  if (!query.data) return
  try {
    await operadoresRedService.eliminarContacto(contacto.id)
    query.data.contactos = query.data.contactos.filter((c) => c.id !== contacto.id)
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message })
  }
}

onMounted(cargar)
</script>

<template>
  <AsyncView :query="query">
    <template #default="{ data: operador }">
      <div class="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <NuxtLink to="/mem/operadores-red">Operadores de Red</NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{{
                operador.nombre_comercial || operador.nombre_legal
              }}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 class="text-lg font-bold">
            {{ operador.nombre_comercial || operador.nombre_legal }}
          </h1>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ operador.nombre_legal }} · {{ operador.fronteras_vinculadas }} frontera{{
              operador.fronteras_vinculadas === 1 ? '' : 's'
            }}
            vinculada{{ operador.fronteras_vinculadas === 1 ? '' : 's' }}
          </p>
        </div>

        <!-- Solo hay una pestaña hoy (Contactos); GTabs deja agregar más
             información del operador (zonas, SLAs, documentos...) sin rehacer la vista. -->
        <GTabs default-value="contactos">
          <GTabsList>
            <GTabsTrigger value="contactos">
              <MailIcon class="size-4" />
              Contactos
            </GTabsTrigger>
          </GTabsList>
          <GTabsContent value="contactos" class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground">
                Correos que reciben el reporte CGM de las fronteras de este operador.
              </p>
              <Button
                v-if="!nuevo"
                size="sm"
                variant="outline"
                @click="nuevo = { email: '', nombre: '' }"
              >
                <PlusIcon class="size-4" />
                Agregar contacto
              </Button>
            </div>

            <p
              v-if="!operador.contactos.length && !nuevo"
              class="py-8 text-center text-sm text-muted-foreground italic"
            >
              Sin correos configurados
            </p>

            <div v-for="c in operador.contactos" :key="c.id" class="flex items-center gap-2">
              <InputGroup :class="!emailValido(c.email) ? 'border-destructive' : ''">
                <InputGroupAddon>
                  <MailIcon class="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  v-model="c.email"
                  type="email"
                  placeholder="correo@empresa.com"
                  @blur="guardarContacto(c)"
                />
              </InputGroup>
              <Input
                :model-value="c.nombre ?? ''"
                placeholder="Nombre (opcional)"
                class="w-40"
                @update:model-value="c.nombre = String($event)"
                @blur="guardarContacto(c)"
              />
              <Button variant="ghost" size="icon-sm" @click="confirmarEliminar(c)">
                <Trash2Icon class="size-4 text-destructive" />
              </Button>
            </div>

            <div v-if="nuevo" class="flex items-center gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <MailIcon class="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  v-model="nuevo.email"
                  type="email"
                  placeholder="correo@empresa.com"
                  autofocus
                  @blur="crearContacto"
                />
              </InputGroup>
              <Input
                v-model="nuevo.nombre"
                placeholder="Nombre (opcional)"
                class="w-40"
                @blur="crearContacto"
              />
              <Button variant="ghost" size="icon-sm" @click="nuevo = null">
                <XIcon class="size-4" />
              </Button>
            </div>
          </GTabsContent>
        </GTabs>
      </div>
    </template>
  </AsyncView>
</template>
