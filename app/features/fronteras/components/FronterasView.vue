<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader
      title="Fronteras Comerciales"
      :subtitle="
        errorCarga ? 'No se pudo cargar' : `${filteredFronteras.length} fronteras registradas`
      "
    >
      <template #actions>
        <Button variant="outline" size="sm" @click="descargarExcel">
          <FileSpreadsheetIcon class="size-4" />
          Descargar Excel
        </Button>
        <Button size="sm" @click="abrirCrear">
          <PlusIcon class="size-4" />
          Nueva Frontera
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      <div class="flex-shrink-0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
        <InputGroup>
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput v-model="search" placeholder="Buscar frontera..." />
        </InputGroup>
      </div>
      <div class="flex-shrink-0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <Select
          :model-value="estadoFilter ?? ''"
          @update:model-value="(v) => (estadoFilter = (v as string) || null)"
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem v-for="op in estadoOptions" :key="op.value" :value="op.value">{{
              op.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex-shrink-0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Proyecto</label>
        <ComboBox v-model="proyectoFilterStr" :options="proyectoOpciones" placeholder="Todos" />
      </div>
      <div class="flex-shrink-0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Operador</label>
        <Select
          :model-value="operadorFilter ?? ''"
          @update:model-value="(v) => (operadorFilter = (v as string) || null)"
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem v-for="op in operadorOptions" :key="op.value" :value="op.value">{{
              op.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex-shrink-0">
        <label class="mb-1 block text-xs font-medium text-muted-foreground">Registro ASIC</label>
        <div class="flex gap-2">
          <Select
            :model-value="mesFilter != null ? String(mesFilter) : ''"
            @update:model-value="(v) => (mesFilter = v ? Number(v) : null)"
          >
            <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Mes</SelectItem>
              <SelectItem v-for="op in mesOptions" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="anioFilter != null ? String(anioFilter) : ''"
            @update:model-value="(v) => (anioFilter = v ? Number(v) : null)"
          >
            <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Año</SelectItem>
              <SelectItem v-for="op in anioOptions" :key="op.value" :value="String(op.value)">{{
                op.label
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <!-- Resumen Card -->
    <div class="flex flex-wrap gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex h-20 min-w-36 flex-1 flex-col justify-center rounded-xl border bg-card p-4"
        :class="[
          stat.clave ? 'cursor-pointer select-none' : '',
          stat.clave && soloGenerando ? 'border-primary bg-primary/5' : '',
        ]"
        :title="stat.clave ? 'Clic para filtrar' : undefined"
        @click="stat.clave === 'generando' && (soloGenerando = !soloGenerando)"
      >
        <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {{ stat.label }}
        </p>
        <p class="mt-1 text-2xl font-bold" :class="stat.color">{{ stat.value }}</p>
      </div>
    </div>

    <!-- Aviso: fronteras nuevas detectadas en Quoia -->
    <div
      v-if="pendientesQuoia.length"
      class="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
    >
      <span class="text-sm font-medium text-destructive">
        <TriangleAlertIcon class="mr-1.5 inline size-3" />
        {{ pendientesQuoia.length }}
        {{
          pendientesQuoia.length === 1 ? 'frontera nueva detectada' : 'fronteras nuevas detectadas'
        }}
        en Quoia, sin registrar aquí
      </span>
      <Button variant="ghost" size="sm" class="text-destructive" @click="abrirPendientes"
        >Revisar</Button
      >
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="size-8 animate-spin text-primary" />
    </div>

    <!-- Fallo de carga: explicito, para no confundirlo con "no hay fronteras" -->
    <div
      v-else-if="errorCarga"
      class="rounded-xl border border-destructive/30 bg-card p-8 text-center"
    >
      <p class="font-semibold text-destructive">No se pudo cargar el listado</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ errorCarga }}</p>
      <Button size="sm" class="mt-4" @click="loadData">Reintentar</Button>
    </div>

    <!-- Table -->
    <div v-else class="overflow-hidden rounded-xl border bg-card">
      <DataTable
        :columns="columns"
        :rows="filteredFronteras as unknown as DataTableRow[]"
        row-key="id"
      >
        <template #cell="{ row: rawRow, column }">
          <span
            v-if="column.key === 'codigo_frontera'"
            class="font-mono text-sm font-semibold text-primary"
          >
            {{ asFrontera(rawRow).codigo_frontera || '—' }}
          </span>
          <span v-else-if="column.key === 'nombre_frontera'">{{
            formatearNombre(asFrontera(rawRow).nombre_frontera)
          }}</span>
          <template v-else-if="column.key === 'proyecto_nombre'">
            <RouterLink
              v-if="asFrontera(rawRow).proyecto_id"
              :to="`/proyectos/${asFrontera(rawRow).proyecto_id}`"
              class="text-sm text-primary underline"
              @click.stop
            >
              {{ asFrontera(rawRow).proyecto_nombre || `#${asFrontera(rawRow).proyecto_id}` }}
            </RouterLink>
            <span v-else class="text-sm text-muted-foreground">—</span>
          </template>
          <GBadge
            v-else-if="column.key === 'tipo_frontera'"
            :color="tipoSeverity(asFrontera(rawRow).tipo_frontera)"
          >
            {{ tipoLabel(asFrontera(rawRow).tipo_frontera) }}
          </GBadge>
          <GBadge
            v-else-if="column.key === 'estado'"
            :color="estadoSeverity(asFrontera(rawRow).estado)"
          >
            {{ asFrontera(rawRow).estado }}
          </GBadge>
          <template v-else-if="column.key === 'fecha_registro_asic'">
            <span
              v-if="asFrontera(rawRow).fecha_registro_asic"
              class="text-sm text-muted-foreground"
              >{{ asFrontera(rawRow).fecha_registro_asic }}</span
            >
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <template v-else-if="column.key === 'nro_serie_med_ppal'">
            <span
              v-if="asFrontera(rawRow).nro_serie_med_ppal"
              class="font-mono text-xs text-muted-foreground"
              >{{ asFrontera(rawRow).nro_serie_med_ppal }}</span
            >
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <template v-else-if="column.key === 'nro_serie_med_resp'">
            <span
              v-if="asFrontera(rawRow).nro_serie_med_resp"
              class="font-mono text-xs text-muted-foreground"
              >{{ asFrontera(rawRow).nro_serie_med_resp }}</span
            >
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <span v-else-if="column.key === 'operador_comercial'">
            {{ asFrontera(rawRow).operador_comercial || asFrontera(rawRow).operador_red || '—' }}
          </span>
          <template v-else-if="column.key === 'cap_mw'">
            <span v-if="capacidadMw(asFrontera(rawRow)) !== null">{{
              capacidadMw(asFrontera(rawRow))!.toFixed(3)
            }}</span>
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <template v-else-if="column.key === 'proyecto_municipio'">
            <span v-if="asFrontera(rawRow).proyecto_municipio">{{
              asFrontera(rawRow).proyecto_municipio
            }}</span>
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <template v-else-if="column.key === 'proyecto_departamento'">
            <span v-if="asFrontera(rawRow).proyecto_departamento">{{
              asFrontera(rawRow).proyecto_departamento
            }}</span>
            <span v-else class="text-xs text-muted-foreground/60">—</span>
          </template>
          <div v-else-if="column.key === 'acciones'" class="flex items-center gap-1">
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  @click.stop="editFrontera(asFrontera(rawRow))"
                >
                  <PencilIcon class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Editar</GTooltipContent>
            </GTooltip>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-destructive"
                  :disabled="borrandoId !== null"
                  @click.stop="deleteFrontera(asFrontera(rawRow))"
                >
                  <LoaderCircleIcon
                    v-if="borrandoId === asFrontera(rawRow).id"
                    class="animate-spin"
                  />
                  <Trash2Icon v-else class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Eliminar</GTooltipContent>
            </GTooltip>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Edit Dialog -->
    <Dialog v-model:open="showEdit">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingFrontera ? 'Editar Frontera' : 'Frontera' }}</DialogTitle>
        </DialogHeader>
        <div v-if="editForm" class="space-y-4 pt-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <GLabel>Código frontera</GLabel>
              <Input
                :model-value="editForm.codigo_frontera ?? ''"
                @update:model-value="(v) => (editForm!.codigo_frontera = (v as string) || null)"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel>Nombre</GLabel>
              <Input
                :model-value="editForm.nombre_frontera ?? ''"
                @update:model-value="(v) => (editForm!.nombre_frontera = (v as string) || null)"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel>Estado</GLabel>
              <Select v-model="editForm.estado">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in estadoOptions" :key="op.value" :value="op.value">{{
                    op.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <GLabel>Operador red</GLabel>
              <ComboBox
                :model-value="
                  editForm.operador_red_id != null ? String(editForm.operador_red_id) : null
                "
                :options="operadoresRedOptions"
                placeholder="Seleccionar"
                @update:model-value="(v) => (editForm!.operador_red_id = v ? Number(v) : null)"
              />
            </div>
            <div class="col-span-2 space-y-1.5">
              <GLabel>Proyecto</GLabel>
              <ComboBox
                :model-value="editForm.proyecto_id != null ? String(editForm.proyecto_id) : null"
                :options="proyectosAllOptions"
                placeholder="Seleccionar"
                @update:model-value="(v) => (editForm!.proyecto_id = v ? Number(v) : null)"
              />
            </div>
          </div>

          <!-- Ficha técnica medidor/módem (2026-08-14) -- antes solo vivía la
               marca a nivel de proyecto (un valor para las 4 combinaciones
               posibles ppal/resp x generación/consumo), acá sí se distingue
               cada medidor/módem real de esta frontera. -->
          <div class="space-y-3 border-t pt-3">
            <p class="text-xs font-semibold text-muted-foreground uppercase">Medidor principal</p>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <GLabel>Tipo de extracción</GLabel>
                <Input
                  :model-value="editForm.tipo_extraccion_ppal ?? ''"
                  placeholder="Ej. DLMS"
                  @update:model-value="
                    (v) => (editForm!.tipo_extraccion_ppal = (v as string) || null)
                  "
                />
              </div>
              <div class="space-y-1.5">
                <GLabel>Contraseña del medidor</GLabel>
                <Input
                  :model-value="editForm.password_medidor_ppal ?? ''"
                  @update:model-value="
                    (v) => (editForm!.password_medidor_ppal = (v as string) || null)
                  "
                />
              </div>
            </div>
            <p class="text-xs font-semibold text-muted-foreground uppercase">Módem asociado</p>
            <div class="grid grid-cols-3 gap-4">
              <div class="space-y-1.5">
                <GLabel>Dirección IP</GLabel>
                <Input
                  :model-value="editForm.ip_modem_ppal ?? ''"
                  placeholder="10.10.10.1"
                  @update:model-value="(v) => (editForm!.ip_modem_ppal = (v as string) || null)"
                />
              </div>
              <div class="space-y-1.5">
                <GLabel>Puerto</GLabel>
                <NumberField
                  v-model="editForm.puerto_modem_ppal"
                  :format-options="{ useGrouping: false }"
                >
                  <NumberFieldContent>
                    <NumberFieldInput />
                  </NumberFieldContent>
                </NumberField>
              </div>
              <div class="space-y-1.5">
                <GLabel>Canal de comunicación</GLabel>
                <Input
                  :model-value="editForm.canal_comunicacion_ppal ?? ''"
                  placeholder="Ej. IPsec"
                  @update:model-value="
                    (v) => (editForm!.canal_comunicacion_ppal = (v as string) || null)
                  "
                />
              </div>
            </div>
          </div>

          <div class="space-y-3 border-t pt-3">
            <p class="text-xs font-semibold text-muted-foreground uppercase">Medidor respaldo</p>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <GLabel>Tipo de extracción</GLabel>
                <Input
                  :model-value="editForm.tipo_extraccion_resp ?? ''"
                  placeholder="Ej. DLMS"
                  @update:model-value="
                    (v) => (editForm!.tipo_extraccion_resp = (v as string) || null)
                  "
                />
              </div>
              <div class="space-y-1.5">
                <GLabel>Contraseña del medidor</GLabel>
                <Input
                  :model-value="editForm.password_medidor_resp ?? ''"
                  @update:model-value="
                    (v) => (editForm!.password_medidor_resp = (v as string) || null)
                  "
                />
              </div>
            </div>
            <p class="text-xs font-semibold text-muted-foreground uppercase">Módem asociado</p>
            <div class="grid grid-cols-3 gap-4">
              <div class="space-y-1.5">
                <GLabel>Dirección IP</GLabel>
                <Input
                  :model-value="editForm.ip_modem_resp ?? ''"
                  placeholder="10.10.10.1"
                  @update:model-value="(v) => (editForm!.ip_modem_resp = (v as string) || null)"
                />
              </div>
              <div class="space-y-1.5">
                <GLabel>Puerto</GLabel>
                <NumberField
                  v-model="editForm.puerto_modem_resp"
                  :format-options="{ useGrouping: false }"
                >
                  <NumberFieldContent>
                    <NumberFieldInput />
                  </NumberFieldContent>
                </NumberField>
              </div>
              <div class="space-y-1.5">
                <GLabel>Canal de comunicación</GLabel>
                <Input
                  :model-value="editForm.canal_comunicacion_resp ?? ''"
                  placeholder="Ej. IPsec"
                  @update:model-value="
                    (v) => (editForm!.canal_comunicacion_resp = (v as string) || null)
                  "
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showEdit = false">Cancelar</Button>
          <Button :disabled="saving" @click="saveFrontera">
            <LoaderCircleIcon v-if="saving" class="animate-spin" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Dialog -->
    <Dialog v-model:open="showCreate">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Frontera</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 pt-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 space-y-1.5">
              <GLabel>Proyecto</GLabel>
              <ComboBox
                :model-value="
                  createForm.proyecto_id != null ? String(createForm.proyecto_id) : null
                "
                :options="proyectosAllOptions"
                placeholder="Seleccionar"
                @update:model-value="(v) => (createForm.proyecto_id = v ? Number(v) : null)"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel>Código frontera</GLabel>
              <Input
                :model-value="createForm.codigo_frontera ?? ''"
                @update:model-value="(v) => (createForm.codigo_frontera = (v as string) || null)"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel required>Nombre</GLabel>
              <Input
                :model-value="createForm.nombre_frontera ?? ''"
                @update:model-value="(v) => (createForm.nombre_frontera = (v as string) || null)"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel required>Tipo</GLabel>
              <Select
                :model-value="createForm.tipo_frontera ?? undefined"
                @update:model-value="(v) => (createForm.tipo_frontera = v as string)"
              >
                <SelectTrigger class="w-full"
                  ><SelectValue placeholder="Seleccionar"
                /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in tipoOptions" :key="op.value" :value="op.value">{{
                    op.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <GLabel>Estado</GLabel>
              <Select v-model="createForm.estado">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in estadoOptions" :key="op.value" :value="op.value">{{
                    op.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <GLabel>Operador red</GLabel>
              <ComboBox
                :model-value="
                  createForm.operador_red_id != null ? String(createForm.operador_red_id) : null
                "
                :options="operadoresRedOptions"
                placeholder="Seleccionar"
                @update:model-value="(v) => (createForm.operador_red_id = v ? Number(v) : null)"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showCreate = false">Cancelar</Button>
          <Button
            :disabled="creating || !createForm.nombre_frontera || !createForm.tipo_frontera"
            @click="crearFrontera"
          >
            <LoaderCircleIcon v-if="creating" class="animate-spin" />
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog: nombre parecido a una frontera existente -->
    <Dialog v-model:open="duplicadoVisible">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Frontera parecida ya existe</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          Ya existe una frontera con un nombre muy parecido:
          <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
          (ID {{ duplicadoInfo?.candidato_id }}). Si de verdad es una frontera distinta, puedes
          {{ pendingConfirmar ? 'agregarla' : 'crearla' }} igual.
        </p>
        <DialogFooter>
          <Button variant="secondary" @click="cancelarDuplicado">Cancelar</Button>
          <Button :disabled="forzando" @click="forzarDuplicado">
            <LoaderCircleIcon v-if="forzando" class="animate-spin" />
            {{ pendingConfirmar ? 'Agregar de todos modos' : 'Crear de todos modos' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Pendientes de Quoia Dialog -->
    <Dialog v-model:open="showPendientesDialog">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fronteras nuevas en Quoia</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          Estas fronteras existen en Quoia pero todavía no tienen fila aquí. Asígnales un proyecto
          para agregarlas, o ignóralas si no aplican.
        </p>
        <div v-if="loadingPendientes" class="flex items-center justify-center py-8">
          <LoaderCircleIcon class="size-6 animate-spin text-primary" />
        </div>
        <div
          v-else-if="!pendientesQuoia.length"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          No hay fronteras pendientes por revisar.
        </div>
        <div v-else class="max-h-96 space-y-3 overflow-y-auto pr-1">
          <div
            v-for="p in pendientesQuoia"
            :key="p.frt_code"
            class="flex items-center gap-3 rounded-xl border p-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-foreground">{{ p.nombre_quoia }}</p>
              <p class="font-mono text-xs text-muted-foreground">
                {{ p.frt_code }} · {{ p.categoria }}
              </p>
            </div>
            <ComboBox
              :model-value="p.proyectoId != null ? String(p.proyectoId) : null"
              :options="proyectosAllOptions"
              placeholder="Proyecto..."
              @update:model-value="(v) => (p.proyectoId = v ? Number(v) : null)"
            />
            <Button
              size="sm"
              :disabled="p.loading === 'confirmar' || !p.proyectoId"
              @click="confirmarPendiente(p)"
            >
              <LoaderCircleIcon v-if="p.loading === 'confirmar'" class="animate-spin" />
              <CheckIcon v-else class="size-4" />
              Agregar
            </Button>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :disabled="p.loading === 'ignorar'"
                  @click="ignorarPendiente(p)"
                >
                  <LoaderCircleIcon v-if="p.loading === 'ignorar'" class="animate-spin" />
                  <XIcon v-else class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Ignorar</GTooltipContent>
            </GTooltip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type { OperadorRed } from '~/features/operadores-red/types'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import type {
  DuplicadoFrontera,
  Frontera,
  FronteraPendienteQuoia,
  PayloadFrontera,
} from '~/features/fronteras/types'
import {
  CheckIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { isFetchError, normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `DataTable` (ver `AdminUsuariosView.vue`).
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
import { FronterasService } from '~/features/fronteras/services/fronteras'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { exportarExcel } from '~/utils/exportarExcel'
import { formatearNombre } from '~/utils/nombreFormato'

const columns: DataTableColumn[] = [
  { key: 'codigo_frontera', header: 'Código', sortable: true },
  { key: 'nombre_frontera', header: 'Nombre', sortable: true },
  { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
  { key: 'tipo_frontera', header: 'Tipo', sortable: true },
  { key: 'estado', header: 'Estado', sortable: true },
  { key: 'fecha_registro_asic', header: 'Fecha Registro ASIC', sortable: true },
  { key: 'nro_serie_med_ppal', header: 'Serial Medidor Principal' },
  { key: 'nro_serie_med_resp', header: 'Serial Medidor Respaldo' },
  { key: 'operador_comercial', header: 'Operador', sortable: true },
  { key: 'cap_mw', header: 'Cap. MW', sortable: true },
  { key: 'proyecto_municipio', header: 'Municipio', sortable: true },
  { key: 'proyecto_departamento', header: 'Departamento', sortable: true },
  { key: 'acciones', header: '' },
]

const confirm = useConfirm()
const fronterasService = new FronterasService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()
const operadoresRedService = new OperadoresRedService()

const route = useRoute()
const router = useRouter()

const fronteras = ref<Frontera[]>([])
const loading = ref(true)
/** Mensaje del ultimo fallo de carga; null si la ultima carga salio bien. */
const errorCarga = ref<string | null>(null)
const saving = ref(false)

function asFrontera(row: DataTableRow): Frontera {
  return row as unknown as Frontera
}

function queryStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function queryNum(v: unknown): number | null {
  const s = queryStr(v)
  return s ? Number(s) : null
}

// Filtros sincronizados con la URL (?q=&estado=&proyecto=&operador=&mes=&anio=&generando=)
// para que se sostengan al volver con el boton "atras" o al refrescar.
const search = ref(queryStr(route.query.q) || '')
const estadoFilter = ref<string | null>(queryStr(route.query.estado))
const proyectoFilter = ref<number | null>(queryNum(route.query.proyecto))
const operadorFilter = ref<string | null>(queryStr(route.query.operador))
const mesFilter = ref<number | null>(queryNum(route.query.mes))
const anioFilter = ref<number | null>(queryNum(route.query.anio))
const soloGenerando = ref(route.query.generando === '1')

const proyectoFilterStr = computed<string | null>({
  get: () => (proyectoFilter.value != null ? String(proyectoFilter.value) : null),
  set: (v) => {
    proyectoFilter.value = v ? Number(v) : null
  },
})

watch(
  [search, estadoFilter, proyectoFilter, operadorFilter, mesFilter, anioFilter, soloGenerando],
  ([q, estado, proyecto, operador, mes, anio, generando]) => {
    const query: Record<string, string> = {}
    if (q) query.q = q
    if (estado) query.estado = estado
    if (proyecto) query.proyecto = String(proyecto)
    if (operador) query.operador = operador
    if (mes) query.mes = String(mes)
    if (anio) query.anio = String(anio)
    if (generando) query.generando = '1'
    router.replace({ query })
  },
)

const showEdit = ref(false)
const editingFrontera = ref<Frontera | null>(null)
const editForm = ref<PayloadFrontera | null>(null)

function blankCreateForm(): PayloadFrontera {
  return {
    proyecto_id: null,
    codigo_frontera: '',
    nombre_frontera: '',
    tipo_frontera: null,
    estado: 'activa',
    operador_red_id: null,
  }
}

const showCreate = ref(false)
const creating = ref(false)
const createForm = ref<PayloadFrontera>(blankCreateForm())

// Aviso de nombre parecido (409 estructurado, igual que en Proyectos): se
// puede confirmar y crear igual con forzar=true.
const duplicadoVisible = ref(false)
const duplicadoInfo = ref<DuplicadoFrontera | null>(null)
const forzando = ref(false)

const estadoOptions = [
  { label: 'Activa', value: 'activa' },
  { label: 'En registro', value: 'en_registro' },
  { label: 'En falla', value: 'en_falla' },
  { label: 'Cancelada', value: 'cancelada' },
]

const tipoOptions = [
  { label: 'Generación', value: 'generacion' },
  { label: 'Consumo', value: 'consumo' },
  { label: 'Gen+Consumo', value: 'generacion_consumo' },
  { label: 'Auxiliar', value: 'consumo_auxiliar' },
  { label: 'Propio', value: 'consumo_propio' },
]

const proyectoOpciones = computed<ComboBoxOption[]>(() => {
  const seen = new Map<number, string>()
  for (const f of fronteras.value) {
    if (f.proyecto_id != null && !seen.has(f.proyecto_id)) {
      seen.set(f.proyecto_id, f.proyecto_nombre || `#${f.proyecto_id}`)
    }
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value: String(value), label }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const operadorOptions = computed(() => {
  const seen = new Set<string>()
  for (const f of fronteras.value) {
    const nombre = f.operador_comercial || f.operador_red
    if (nombre) seen.add(nombre)
  }
  return [...seen].sort().map((v) => ({ label: v, value: v }))
})

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const mesOptions = MESES.map((label, i) => ({ label, value: i + 1 }))

const anioOptions = computed(() => {
  const seen = new Set<number>()
  for (const f of fronteras.value) {
    if (!f.fecha_registro_asic) continue
    const anio = new Date(f.fecha_registro_asic).getFullYear()
    if (!isNaN(anio)) seen.add(anio)
  }
  return [...seen].sort((a, b) => b - a).map((v) => ({ label: String(v), value: v }))
})

const filteredFronteras = computed(() => {
  let list = fronteras.value
  if (estadoFilter.value) list = list.filter((f) => f.estado === estadoFilter.value)
  if (proyectoFilter.value) list = list.filter((f) => f.proyecto_id === proyectoFilter.value)
  if (operadorFilter.value)
    list = list.filter((f) => (f.operador_comercial || f.operador_red) === operadorFilter.value)
  if (mesFilter.value || anioFilter.value) {
    list = list.filter((f) => {
      if (!f.fecha_registro_asic) return false
      const d = new Date(f.fecha_registro_asic)
      if (isNaN(d.getTime())) return false
      if (mesFilter.value && d.getMonth() + 1 !== mesFilter.value) return false
      if (anioFilter.value && d.getFullYear() !== anioFilter.value) return false
      return true
    })
  }
  if (soloGenerando.value) list = list.filter(generaDeVerdad)
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(
      (f) =>
        (f.codigo_frontera || '').toLowerCase().includes(s) ||
        (f.nombre_frontera || '').toLowerCase().includes(s) ||
        (f.proyecto_nombre || '').toLowerCase().includes(s) ||
        (f.operador_red || '').toLowerCase().includes(s) ||
        (f.operador_comercial || '').toLowerCase().includes(s) ||
        (f.proyecto_municipio || '').toLowerCase().includes(s) ||
        (f.proyecto_departamento || '').toLowerCase().includes(s),
    )
  }
  return list
})

const TIPOS_GENERACION = ['generacion', 'generacion_consumo']

// "Genera de verdad" = tipo Generacion Y la corrida mas reciente del
// pipeline Reporte Energia (reporte_energia_generacion, via
// f.generando_actual) reporto energia real > 0. Reemplaza el criterio
// anterior (fecha_inicio_comercializacion contra la API de Unergy): esa
// fuente dejaba fuera fronteras sin identificador de monitoreo resuelto o
// sin datos en Unergy (ej. San Pelayo, Chiriguana N1 -- ambas confirmadas
// generando) aunque el pipeline propio ya las viera generar. f.generando_actual
// es null si el pipeline todavia no ha corrido para esa frontera (no
// implica que no genere) -- esas quedan fuera del conteo igual que antes.
function generaDeVerdad(f: Frontera): boolean {
  return TIPOS_GENERACION.includes(f.tipo_frontera || '') && f.generando_actual === true
}

// La capacidad y la ubicacion son del PROYECTO, no de la frontera. Las columnas
// `capacidad_efectiva_mw`/`municipio`/`departamento` de `fronteras` se
// eliminaron el 2026-08-25 por ser una segunda copia del mismo dato (52 de 53
// fronteras de generacion tenian la capacidad identica a
// `potencia_ac_kw` del proyecto, solo con la conversion kWp->MW; ver
// app/schemas/fronteras.py). La API manda el dato del proyecto como
// `proyecto_potencia_instalada_mw` / `proyecto_municipio` /
// `proyecto_departamento`, pero esta vista siguio leyendo los nombres viejos:
// las dos columnas mostraban "—" en todas las filas, la tarjeta de capacidad
// total daba 0.0, el buscador por municipio no encontraba nada y el Excel
// exportaba las columnas vacias.

/** Los MW del proyecto, solo en fronteras de generacion -- es la regla que
 *  tenia la columna vieja, que no traia dato para consumo ni auxiliar. Se usa
 *  `TIPOS_GENERACION` (el mismo criterio que "Generando actualmente" de esta
 *  vista) para que una frontera Gen+Consumo no muestre capacidad en un lado y
 *  no en el otro. `null` cuando no aplica o el proyecto no tiene potencia. */
function capacidadMw(f: Frontera): number | null {
  if (!TIPOS_GENERACION.includes(f.tipo_frontera || '')) return null
  const mw = Number(f.proyecto_potencia_instalada_mw)
  return Number.isFinite(mw) && mw > 0 ? mw : null
}

/** La capacidad total, sumada POR PROYECTO y no por fila: un proyecto con dos
 *  fronteras de generacion aporta sus MW una vez, no dos. */
function capacidadTotalMw(lista: Frontera[]): number {
  const porProyecto = new Map<number | string, number>()
  for (const f of lista) {
    const mw = capacidadMw(f)
    if (mw === null) continue
    // Sin `proyecto_id` no hay con quien agrupar: la fila cuenta por si sola.
    porProyecto.set(f.proyecto_id ?? `sin-proyecto:${f.id}`, mw)
  }
  return [...porProyecto.values()].reduce((suma, mw) => suma + mw, 0)
}

interface Stat {
  label: string
  value: number | string
  color: string
  clave?: 'generando'
}

const stats = computed<Stat[]>(() => {
  const all = fronteras.value
  return [
    { label: 'Total', value: all.length, color: 'text-foreground' },
    {
      label: 'Activas',
      value: all.filter((f) => f.estado === 'activa').length,
      color: 'text-success',
    },
    {
      label: 'En registro',
      value: all.filter((f) => f.estado === 'en_registro').length,
      color: 'text-warning',
    },
    {
      label: 'Generando actualmente',
      value: all.filter(generaDeVerdad).length,
      color: 'text-primary',
      clave: 'generando',
    },
    { label: 'Cap. total MW', value: capacidadTotalMw(all).toFixed(1), color: 'text-chart-2' },
  ]
})

function tipoLabel(t: string | null): string {
  const map: Record<string, string> = {
    generacion: 'Generación',
    consumo: 'Consumo',
    generacion_consumo: 'Gen+Consumo',
    consumo_auxiliar: 'Auxiliar',
    consumo_propio: 'Propio',
  }
  return (t && map[t]) || t || '—'
}
function tipoSeverity(t: string | null): string {
  if (t === 'generacion') return 'success'
  if (t === 'consumo') return 'information'
  return 'warning'
}
function estadoSeverity(e: string | null): string {
  const map: Record<string, string> = {
    activa: 'success',
    en_registro: 'warning',
    en_falla: 'destructive',
    cancelada: 'default',
  }
  return (e && map[e]) || 'information'
}

async function descargarExcel() {
  await exportarExcel(
    filteredFronteras.value,
    [
      { header: 'Código', value: (f: Frontera) => f.codigo_frontera || '' },
      { header: 'Nombre', value: (f: Frontera) => formatearNombre(f.nombre_frontera) || '' },
      { header: 'Proyecto', value: (f: Frontera) => f.proyecto_nombre || '' },
      { header: 'Tipo', value: (f: Frontera) => tipoLabel(f.tipo_frontera) },
      { header: 'Estado', value: (f: Frontera) => f.estado || '' },
      { header: 'Fecha Registro ASIC', value: (f: Frontera) => f.fecha_registro_asic || '' },
      { header: 'Serial Medidor Principal', value: (f: Frontera) => f.nro_serie_med_ppal || '' },
      { header: 'Serial Medidor Respaldo', value: (f: Frontera) => f.nro_serie_med_resp || '' },
      { header: 'Operador', value: (f: Frontera) => f.operador_comercial || f.operador_red || '' },
      {
        header: 'Cap. MW',
        value: (f: Frontera) => (capacidadMw(f) !== null ? capacidadMw(f)!.toFixed(3) : ''),
      },
      { header: 'Municipio', value: (f: Frontera) => f.proyecto_municipio || '' },
      { header: 'Departamento', value: (f: Frontera) => f.proyecto_departamento || '' },
    ],
    `fronteras_${new Date().toISOString().slice(0, 10)}.xlsx`,
    'Fronteras',
  )
}

function editFrontera(f: Frontera) {
  loadProyectosAll()
  editingFrontera.value = f
  editForm.value = {
    codigo_frontera: f.codigo_frontera,
    nombre_frontera: f.nombre_frontera,
    estado: f.estado,
    operador_red_id: f.operador_red_id || null,
    proyecto_id: f.proyecto_id || null,
    tipo_extraccion_ppal: f.tipo_extraccion_ppal || null,
    password_medidor_ppal: f.password_medidor_ppal || null,
    ip_modem_ppal: f.ip_modem_ppal || null,
    puerto_modem_ppal: f.puerto_modem_ppal || null,
    canal_comunicacion_ppal: f.canal_comunicacion_ppal || null,
    tipo_extraccion_resp: f.tipo_extraccion_resp || null,
    password_medidor_resp: f.password_medidor_resp || null,
    ip_modem_resp: f.ip_modem_resp || null,
    puerto_modem_resp: f.puerto_modem_resp || null,
    canal_comunicacion_resp: f.canal_comunicacion_resp || null,
  }
  showEdit.value = true
}

async function saveFrontera() {
  if (!editingFrontera.value || !editForm.value) return
  saving.value = true
  try {
    await fronterasService.actualizar(editingFrontera.value.id, editForm.value)
    toast.success('Frontera actualizada', { duration: 2000 })
    showEdit.value = false
    await loadData()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    saving.value = false
  }
}

function abrirCrear() {
  createForm.value = blankCreateForm()
  showCreate.value = true
  loadProyectosAll()
}

const pendingCreatePayload = ref<PayloadFrontera | null>(null) // body a reintentar con forzar=true

async function crearFrontera() {
  creating.value = true
  const body: PayloadFrontera = {
    ...createForm.value,
    codigo_frontera: createForm.value.codigo_frontera || null,
  }
  try {
    await fronterasService.crear(body)
    toast.success('Frontera creada', { duration: 2500 })
    showCreate.value = false
    await loadData()
  } catch (err) {
    // Aviso de nombre parecido (409 estructurado): se puede confirmar y crear
    // igual. Distinto de un choque real de columna unica (detail es un string).
    if (
      isFetchError<{ detail?: DuplicadoFrontera }>(err) &&
      err.status === 409 &&
      err.data?.detail?.duplicado_nombre
    ) {
      duplicadoInfo.value = err.data.detail
      pendingCreatePayload.value = body
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    creating.value = false
  }
}

async function crearFronteraForzado() {
  if (!pendingCreatePayload.value) return
  forzando.value = true
  try {
    await fronterasService.crear(pendingCreatePayload.value, true)
    toast.success('Frontera creada', { duration: 2500 })
    duplicadoVisible.value = false
    showCreate.value = false
    await loadData()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    forzando.value = false
  }
}

/**
 * Que frontera se esta borrando ahora mismo. Deshabilita TODOS los botones de
 * borrar, no solo el de su fila: el problema no era clickear dos veces la
 * misma, era clickear la de al lado.
 */
const borrandoId = ref<number | null>(null)

/**
 * Borrar una frontera.
 *
 * **El 2026-09-15 esto borro dos fronteras de mas** (BARAYA y BRAYA SERV AUX,
 * ids 5 y 6, que estaban reportando). No fue un clic torpe: era la pantalla.
 *
 * Antes, al confirmar, se esperaba el DELETE y despues se recargaba el listado
 * ENTERO (`limit: 500`). Durante esos segundos la tabla seguia mostrando la
 * lista vieja --parecia que no habia pasado nada-- y al terminar las filas
 * subian una posicion. Un segundo clic en el mismo punto de la pantalla caia
 * sobre la frontera SIGUIENTE. Con vecinas que ademas se llaman parecido, el
 * error es invisible hasta que se cuentan las filas.
 *
 * Ahora: los botones se apagan mientras hay un borrado en curso, y la fila se
 * quita de la lista local en vez de recargar las 500. Nada se reacomoda debajo
 * del cursor.
 */
function deleteFrontera(f: Frontera) {
  confirm({
    title: 'Confirmar eliminación',
    // El nombre primero: con codigos como frt55044 y frt55050 nadie nota que
    // se equivoco de fila. Y el aviso ya no promete que sea irreversible,
    // porque no lo es: es borrado logico, y se revierte poniendo `deleted_at`
    // en NULL. Un aviso falso asusta y no protege.
    description:
      `¿Eliminar ${f.nombre_frontera} (${f.codigo_frontera})? ` +
      'Dejará de aparecer en el listado y de reportar al ASIC.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      borrandoId.value = f.id
      try {
        await fronterasService.eliminar(f.id)
        fronteras.value = fronteras.value.filter((x) => x.id !== f.id)
        toast.success(`${f.nombre_frontera} eliminada`, { duration: 2000 })
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
      } finally {
        borrandoId.value = null
      }
    },
  })
}

/**
 * Un fallo de carga tiene que VERSE como fallo.
 *
 * Antes este catch solo hacia logger.error() y dejaba `fronteras` en []. El
 * 2026-09-05 el listado llevaba cuatro dias respondiendo 500 (el backend
 * pedia `operador` a un campo que se llama `operador_red`) y la pantalla
 * decia "0 fronteras registradas": indistinguible de no tener ninguna. Nadie
 * lo reporto como error porque no parecia uno.
 */
async function loadData() {
  loading.value = true
  errorCarga.value = null
  try {
    fronteras.value = await fronterasService.listar({ limit: 500 })
  } catch (err) {
    logger.error('fronteras', err)
    const mensaje = normalizeError(err).message
    errorCarga.value = mensaje
    fronteras.value = []
    toast.error('Error al cargar fronteras', { description: mensaje, duration: 6000 })
  } finally {
    loading.value = false
  }
}

// ── Fronteras pendientes de Quoia (detectar + confirmar manual) ────────────────
interface PendienteQuoiaUI extends FronteraPendienteQuoia {
  proyectoId: number | null
  loading: 'confirmar' | 'ignorar' | null
}

const pendientesQuoia = ref<PendienteQuoiaUI[]>([])
const loadingPendientes = ref(false)
const showPendientesDialog = ref(false)
const proyectosAll = ref<ProyectoConDetalle[]>([])
const proyectosAllOptions = computed<ComboBoxOption[]>(() =>
  proyectosAll.value.map((p) => ({ value: String(p.id), label: p.nombre_comercial || `#${p.id}` })),
)
const operadoresRedOptions = computed<ComboBoxOption[]>(() =>
  operadoresRed.value.map((o) => ({
    value: String(o.id),
    label: o.nombre_comercial || o.nombre_legal,
  })),
)

async function loadPendientesQuoia() {
  try {
    const data = await fronterasService.listarPendientesQuoia()
    pendientesQuoia.value = data.map((p) => ({
      ...p,
      proyectoId: p.proyecto_sugerido_id ?? null,
      loading: null,
    }))
  } catch {
    // Gaia sin configurar u otro error -- no bloquea la vista, solo no se muestra el aviso.
    pendientesQuoia.value = []
  }
}

async function loadProyectosAll() {
  if (proyectosAll.value.length) return
  try {
    proyectosAll.value = await catalogoProyectos.cargar()
  } catch {
    proyectosAll.value = []
  }
}

function abrirPendientes() {
  showPendientesDialog.value = true
  loadingPendientes.value = true
  Promise.all([loadPendientesQuoia(), loadProyectosAll()]).finally(() => {
    loadingPendientes.value = false
  })
}

/** Pendiente a reintentar con forzar=true tras confirmar el aviso de parecido. */
const pendingConfirmar = ref<PendienteQuoiaUI | null>(null)

/**
 * Agrega una frontera que Quoia ya tiene y aca todavia no.
 *
 * El 409 de "ya existe una con nombre parecido" es un AVISO reintentable, no un
 * rechazo: el backend acepta `?forzar=true`. crearFrontera() ya lo trataba asi
 * desde siempre, pero este camino no, y el usuario quedaba sin salida -- solo
 * un "No se pudo agregar la frontera" (2026-09-05, al agregar la minigranja de
 * San Luis de Since).
 */
async function confirmarPendiente(p: PendienteQuoiaUI, forzar = false) {
  if (!p.proyectoId) return
  p.loading = 'confirmar'
  try {
    await fronterasService.confirmarPendienteQuoia(p.frt_code, p.proyectoId, forzar)
    pendientesQuoia.value = pendientesQuoia.value.filter((x) => x.frt_code !== p.frt_code)
    duplicadoVisible.value = false
    pendingConfirmar.value = null
    toast.success('Frontera agregada', { duration: 2500 })
    await loadData()
  } catch (err) {
    if (
      !forzar &&
      isFetchError<{ detail?: DuplicadoFrontera }>(err) &&
      err.status === 409 &&
      err.data?.detail?.duplicado_nombre
    ) {
      duplicadoInfo.value = err.data.detail
      pendingConfirmar.value = p
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', { description: normalizeError(err).message, duration: 5000 })
  } finally {
    p.loading = null
  }
}

/** El boton del dialogo de parecidos sirve a los dos caminos: crear y agregar pendiente. */
async function forzarDuplicado() {
  if (pendingConfirmar.value) {
    forzando.value = true
    try {
      await confirmarPendiente(pendingConfirmar.value, true)
    } finally {
      forzando.value = false
    }
    return
  }
  await crearFronteraForzado()
}

function cancelarDuplicado() {
  duplicadoVisible.value = false
  pendingConfirmar.value = null
}

function ignorarPendiente(p: PendienteQuoiaUI) {
  confirm({
    title: 'Ignorar frontera de Quoia',
    description: `¿Ignorar "${p.nombre_quoia}" (${p.frt_code})? No volverá a aparecer como pendiente.`,
    confirmLabel: 'Ignorar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      p.loading = 'ignorar'
      try {
        await fronterasService.ignorarPendienteQuoia(p.frt_code)
        pendientesQuoia.value = pendientesQuoia.value.filter((x) => x.frt_code !== p.frt_code)
        toast.success('Ignorada', { duration: 2000 })
      } catch {
        toast.error('Error', { description: 'No se pudo ignorar', duration: 4000 })
      } finally {
        p.loading = null
      }
    },
  })
}

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref<OperadorRed[]>([])
async function loadOperadoresRed() {
  try {
    operadoresRed.value = await operadoresRedService.listar()
  } catch {
    /* graceful degrade -- el select queda vacío */
  }
}

onMounted(() => {
  loadData()
  loadPendientesQuoia()
  loadOperadoresRed()
})

// Nota: el backfill de marca/modelo/serie de medidor (Quoia) ya no tiene
// botón aquí -- ya se corrió y hoy no queda nada por completar (Quoia no
// tiene más info para dar). El endpoint POST /fronteras/backfill-medidor
// sigue vivo en el backend por si hace falta correrlo puntualmente.
</script>
