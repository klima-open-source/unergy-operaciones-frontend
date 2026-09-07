<!--
  Representación CGM de una planta.

  Antes esta vista leía de `/representacion`, que arma los contratos desde los
  JSON de `data/` y solo cruza con la BD para sacar un `db_id`. Eso tenía dos
  consecuencias: los campos que no están en el JSON (número de contrato, partes,
  vigencia) no se podían ni ver ni capturar, y un contrato que existe solo en la
  base —los que se crean a mano en el wizard, como el UNERGY-RC-002-2025 de
  Naos 2— no aparecía en ninguna parte.

  Ahora lee de `contratos_servicio`, que es la fuente editable y la misma que
  alimenta Servicios > Representación. El layout copia el del detalle de PPA
  (ContratoDetailView): resumen arriba y secciones que se editan una por una.
-->
<template>
  <div class="space-y-4">

    <!-- Migas -->
    <div class="flex items-center gap-2">
      <Button text severity="secondary" @click="$router.back()" class="-ml-1">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <div>
        <p class="text-xs leading-none mb-0.5" style="color:#9b89b5">
          <span class="cursor-pointer hover:underline"
            @click="$router.push(`/proyectos/${route.params.id}`)">{{ proyectoNombre || '…' }}</span>
          <span class="mx-1.5">›</span><span>Servicios</span>
          <span class="mx-1.5">›</span>
          <span class="font-medium" style="color:var(--color-unergy-deep)">Representación</span>
        </p>
        <h2 class="text-lg font-bold" style="color:var(--color-unergy-deep)">Representación CGM</h2>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <Button v-if="c" label="Eliminar" size="small" outlined severity="danger" @click="confirmarEliminar">
          <template #icon><Trash2Icon class="size-[1em]" /></template>
        </Button>
        <Button label="Nuevo contrato" size="small" @click="nuevoContrato">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20"><ProgressSpinner /></div>

    <div v-else-if="!contratos.length"
      class="rounded-xl border border-dashed p-10 text-center" style="border-color:#3b82f640">
      <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style="background:#eff6ff">
        <FilePenIcon class="text-xl size-[1em]" style="color:#3b82f6" />
      </div>
      <p class="text-sm font-medium text-gray-600 mb-1">Sin contratos de representación</p>
      <p class="text-xs text-gray-400">
        Esta planta no tiene contratos de representación asociados.
      </p>
      <Button label="Crear el primero" size="small" class="mt-3" @click="nuevoContrato">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <template v-else>
      <!-- Selector: un contrato por inversionista. Los creados a mano pueden no
           traer inversionista, así que se rotulan con lo que tengan. -->
      <div v-if="contratos.length > 1" class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-semibold text-gray-500">Contrato:</span>
        <button v-for="c in contratos" :key="c.id" type="button"
          class="text-xs px-3 py-1.5 rounded-full font-medium transition-all border"
          :class="idSeleccionado === c.id ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'"
          :style="idSeleccionado === c.id ? 'background:#3b82f6' : ''"
          @click="idSeleccionado = c.id">
          {{ etiquetaContrato(c) }}
        </button>
      </div>

      <!-- Duplicados: la planta tiene varios registros que son el mismo contrato.
           Los sembraron tres fuentes distintas (los dos seeds y el wizard) sin
           que ninguna reconociera a las otras. -->
      <div v-if="grupoDuplicado" class="dup-aviso">
        <CopyIcon class="size-[1em]" />
        <div class="min-w-0">
          <p class="font-semibold">
            {{ grupoDuplicado.ids.length }} registros de esta planta son el mismo contrato
          </p>
          <p class="text-[11px] opacity-80">
            Al fusionar se conserva uno con la unión de todos los datos y se
            eliminan los demás. Ningún valor se sobreescribe.
          </p>
        </div>
        <Button label="Fusionar" size="small" class="ml-auto shrink-0" :loading="fusionando" @click="fusionar">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <div v-else-if="grupoEnConflicto" class="dup-aviso dup-aviso--frena">
        <TriangleAlertIcon class="size-[1em]" />
        <div class="min-w-0">
          <p class="font-semibold">
            {{ grupoEnConflicto.ids.length }} registros parecen el mismo contrato, pero se contradicen
          </p>
          <p class="text-[11px] opacity-80">
            No se fusionan solos porque hay que decidir cuál valor vale:
            {{ grupoEnConflicto.conflictos.map(c => c.campo).join(', ') }}.
            Corrige el campo en los registros y el aviso pasará a ofrecer la fusión.
          </p>
        </div>
      </div>

      <template v-if="c">
        <!-- ── Resumen ──────────────────────────────────────────────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="cd-stat" :style="`background:${vigencia.bg};border-color:${vigencia.borde}`">
            <p class="cd-stat-lbl" :style="`color:${vigencia.color}`">
              <CircleIcon class="size-[1em] fill-current" style="font-size:6px" />Estado
            </p>
            <p class="cd-stat-val" :style="`color:${vigencia.color}`">{{ vigencia.label }}</p>
            <p class="cd-stat-sub" :style="`color:${vigencia.color};opacity:.7`">{{ vigencia.detalle }}</p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><ClockIcon class="size-[1em]" style="font-size:9px" />Duración</p>
            <p class="cd-stat-val">{{ duracion || '—' }}</p>
            <p class="cd-stat-sub">{{ fmtFecha(c.fecha_inicio) }} → {{ fmtFecha(c.fecha_fin) }}</p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><ChartLineIcon class="size-[1em]" style="font-size:9px" />Tarifa CGM</p>
            <p class="cd-stat-val">{{ fmtVal(valorVigente(idxCgm) ?? c.tarifa_cgm) }}
              <span class="text-[10px] font-normal" style="color:#9b89b5">$/kWh</span>
            </p>
            <p class="cd-stat-sub">{{ idxCgm.length ? `${idxCgm.length} aniversarios` : 'sin indexación' }}</p>
          </div>

          <div class="cd-stat">
            <p class="cd-stat-lbl"><ChartLineIcon class="size-[1em]" style="font-size:9px" />Tarifa Repr.</p>
            <p class="cd-stat-val">{{ fmtVal(valorVigente(idxRep) ?? c.tarifa_representacion) }}
              <span class="text-[10px] font-normal" style="color:#9b89b5">$/kWh</span>
            </p>
            <p class="cd-stat-sub">{{ idxRep.length ? `${idxRep.length} aniversarios` : 'sin indexación' }}</p>
          </div>
        </div>

        <!-- ── Identificación ───────────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#915BD818"><IdCardIcon class="size-[1em]" style="color:var(--color-unergy-purple)" /></span>
            <h3 class="cd-sec-title">Identificación</h3>
            <div class="cd-sec-act">
              <Button v-if="edit !== 'id'" label="Editar" size="small" text severity="secondary" @click="abrir('id')">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="edit = null" />
                <Button label="Guardar" size="small" :loading="guardando" @click="guardar(['numero_contrato', 'inversionista_nombre', 'portafolio',
                                   'codigo_sun_factory', 'nombre_proyecto_ref'])">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <div v-if="edit !== 'id'" class="cd-grid">
              <InfoField label="Número de contrato" :value="c.numero_contrato" />
              <InfoField label="Inversionista" :value="c.inversionista_nombre" />
              <InfoField label="Portafolio" :value="c.portafolio" />
              <InfoField label="Código Sun Factory" :value="c.codigo_sun_factory" />
              <InfoField label="Proyecto según el contrato" :value="c.nombre_proyecto_ref" />
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Planta asociada</span>
                <span v-if="c.proyecto" class="text-sm" style="color:var(--color-unergy-deep)">
                  {{ c.proyecto.nombre_comercial }}
                </span>
                <span v-else class="text-sm font-semibold" style="color:#92400E">Sin proyecto</span>
              </div>
            </div>
            <div v-else class="cd-grid">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Número de contrato</label>
                <InputText v-model="form.numero_contrato" placeholder="Ej: UNERGY-RC-002-2025" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Inversionista</label>
                <InputText v-model="form.inversionista_nombre" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Portafolio</label>
                <InputText v-model="form.portafolio" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Código Sun Factory</label>
                <InputText v-model="form.codigo_sun_factory" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Proyecto según el contrato</label>
                <InputText v-model="form.nombre_proyecto_ref" class="w-full" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Partes del contrato ──────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#3b82f618"><UsersIcon class="size-[1em]" style="color:#3b82f6" /></span>
            <h3 class="cd-sec-title">Partes del contrato</h3>
            <div class="cd-sec-act">
              <Button v-if="edit !== 'partes'" label="Editar" size="small" text severity="secondary" @click="abrir('partes')">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="edit = null" />
                <Button label="Guardar" size="small" :loading="guardando" @click="guardar(['contratante_nombre', 'contratante_nit',
                                   'prestador_nombre', 'prestador_nit'])">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <div v-if="edit !== 'partes'" class="cd-partes">
              <div class="cd-parte">
                <p class="cd-parte-rol"><BuildingIcon class="size-[1em]" style="font-size:9px" />Contratante</p>
                <p class="cd-parte-nom">{{ c.contratante_nombre || '—' }}</p>
                <p class="cd-parte-nit">NIT {{ c.contratante_nit || '—' }}</p>
              </div>
              <ArrowRightIcon class="cd-partes-flecha size-[1em]" />
              <div class="cd-parte">
                <p class="cd-parte-rol"><BriefcaseIcon class="size-[1em]" style="font-size:9px" />Prestador</p>
                <p class="cd-parte-nom">{{ c.prestador_nombre || '—' }}</p>
                <p class="cd-parte-nit">NIT {{ c.prestador_nit || '—' }}</p>
              </div>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="cd-parte space-y-3">
                <p class="cd-parte-rol"><BuildingIcon class="size-[1em]" style="font-size:9px" />Contratante</p>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">Nombre / Razón social</label>
                  <InputText v-model="form.contratante_nombre" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">NIT</label>
                  <InputText v-model="form.contratante_nit" class="w-full" />
                </div>
              </div>
              <div class="cd-parte space-y-3">
                <p class="cd-parte-rol"><BriefcaseIcon class="size-[1em]" style="font-size:9px" />Prestador</p>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">Nombre / Razón social</label>
                  <InputText v-model="form.prestador_nombre" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="cd-lbl">NIT</label>
                  <InputText v-model="form.prestador_nit" class="w-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Vigencia ─────────────────────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#10b98118"><CalendarIcon class="size-[1em]" style="color:#10b981" /></span>
            <h3 class="cd-sec-title">Vigencia</h3>
            <div class="cd-sec-act">
              <Button v-if="edit !== 'vigencia'" label="Editar" size="small" text severity="secondary" @click="abrir('vigencia')">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="edit = null" />
                <Button label="Guardar" size="small" :loading="guardando" @click="guardar(['estado', 'fecha_firma_contrato', 'fecha_inicio', 'fecha_fin',
                                   'renovacion_automatica'])">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <div v-if="edit !== 'vigencia'" class="cd-grid">
              <InfoField label="Fecha de firma" :value="fmtFecha(c.fecha_firma_contrato)" />
              <InfoField label="Fecha inicio" :value="fmtFecha(c.fecha_inicio)" />
              <InfoField label="Fecha fin" :value="fmtFecha(c.fecha_fin)" />
              <!-- `duracion` es '' cuando faltan fechas, e InfoField solo pone
                   el guion ante null/undefined. -->
              <InfoField label="Duración" :value="duracion || null" />
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Estado</span>
                <div>
                  <GBadge :color="ESTADO_SEVERITY[c.estado] || 'default'" class="text-[10px]">{{ ESTADO_LABELS[c.estado] || c.estado || '—' }}</GBadge>
                </div>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Renovación automática</span>
                <div>
                  <GBadge v-if="c.renovacion_automatica != null"
                    :color="c.renovacion_automatica ? 'success' : 'default'"
                    class="text-[10px]">{{ c.renovacion_automatica ? 'Sí' : 'No' }}</GBadge>
                  <span v-else class="text-sm" style="color:var(--color-unergy-deep)">—</span>
                </div>
              </div>
            </div>
            <div v-else class="cd-grid">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Estado</label>
                <Select v-model="form.estado" :options="ESTADOS_OPCIONES" optionLabel="label"
                  optionValue="value" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Fecha de firma</label>
                <DatePicker v-model="form.fecha_firma_contrato" dateFormat="yy-mm-dd" showIcon
                  :manualInput="true" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Fecha inicio</label>
                <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon
                  :manualInput="true" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Fecha fin</label>
                <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon
                  :manualInput="true" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Renovación automática</label>
                <Select v-model="form.renovacion_automatica" :options="SI_NO" optionLabel="label"
                  optionValue="value" class="w-full" placeholder="Sin dato" showClear />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Condiciones comerciales ──────────────────────────────────── -->
        <section class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#f59e0b18"><DollarSignIcon class="size-[1em]" style="color:#f59e0b" /></span>
            <h3 class="cd-sec-title">Condiciones comerciales</h3>
            <div class="cd-sec-act">
              <Button v-if="edit !== 'comercial'" label="Editar" size="small" text severity="secondary" @click="abrir('comercial')">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="edit = null" />
                <Button label="Guardar" size="small" :loading="guardando" @click="guardar(['tarifa_admin', 'tarifa_cgm', 'tarifa_representacion',
                                   'indice_indexacion', 'periodicidad_pago', 'responsable_iva',
                                   'enlace_drive'])">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>
          <div class="cd-sec-body">
            <div v-if="edit !== 'comercial'" class="cd-grid">
              <InfoField label="Tarifa admin"
                :value="c.tarifa_admin != null ? (c.tarifa_admin * 100).toFixed(2) + ' %' : null" />
              <InfoField label="Tarifa CGM base ($/kWh)" :value="fmtVal(c.tarifa_cgm)" />
              <InfoField label="Tarifa representación base ($/kWh)" :value="fmtVal(c.tarifa_representacion)" />
              <InfoField label="Índice de indexación" :value="c.indice_indexacion" />
              <InfoField label="Periodicidad de pago" :value="c.periodicidad_pago" />
              <div class="flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Responsable de IVA</span>
                <div>
                  <GBadge :color="c.responsable_iva ? 'success' : 'default'"
                    class="text-[10px]">{{ c.responsable_iva ? 'Sí' : 'No' }}</GBadge>
                </div>
              </div>
              <div class="cd-ancho flex flex-col gap-0.5">
                <span class="cd-campo-lbl">Contrato en Drive</span>
                <a v-if="c.enlace_drive" :href="c.enlace_drive" target="_blank" rel="noopener"
                  class="text-sm inline-flex items-center gap-1 hover:underline" style="color:#3b82f6">
                  <ExternalLinkIcon class="text-[10px] size-[1em]" />Ver contrato
                </a>
                <span v-else class="text-sm" style="color:var(--color-unergy-deep)">—</span>
              </div>
            </div>
            <div v-else class="cd-grid">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Tarifa admin (%)</label>
                <InputNumber v-model="form.tarifa_admin_pct" :minFractionDigits="1" :maxFractionDigits="2"
                  suffix=" %" locale="en-US" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Tarifa CGM base ($/kWh)</label>
                <InputNumber v-model="form.tarifa_cgm" :minFractionDigits="0" :maxFractionDigits="6"
                  locale="en-US" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Tarifa representación base ($/kWh)</label>
                <InputNumber v-model="form.tarifa_representacion" :minFractionDigits="0"
                  :maxFractionDigits="6" locale="en-US" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Índice de indexación</label>
                <InputText v-model="form.indice_indexacion" placeholder="Ej: IPC" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Periodicidad de pago</label>
                <Select v-model="form.periodicidad_pago" :options="PERIODICIDADES" optionLabel="label"
                  optionValue="value" class="w-full" placeholder="Sin dato" showClear />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Responsable de IVA</label>
                <Select v-model="form.responsable_iva" :options="SI_NO" optionLabel="label"
                  optionValue="value" class="w-full" />
              </div>
              <div class="cd-ancho flex flex-col gap-1">
                <label class="cd-lbl">Contrato en Drive</label>
                <InputText v-model="form.enlace_drive" placeholder="https://drive.google.com/..."
                  class="w-full" />
              </div>
            </div>
          </div>
        </section>

        <!-- ── Indexación ───────────────────────────────────────────────── -->
        <section v-for="t in TABLAS_IDX" :key="t.clave" class="cd-sec">
          <header class="cd-sec-head">
            <span class="cd-ico" style="background:#1e40af18"><TableIcon class="size-[1em]" style="color:#1e40af" /></span>
            <h3 class="cd-sec-title">{{ t.titulo }}</h3>
            <div class="cd-sec-act">
              <span v-if="edit !== t.clave" class="text-xs mr-1" style="color:#9b89b5">Hoy: {{ hoy }}</span>
              <Button v-if="edit !== t.clave" label="Editar" size="small" text severity="secondary" @click="abrirIdx(t.clave)">
                <template #icon><PencilIcon class="size-[1em]" /></template>
              </Button>
              <template v-else>
                <Button label="Cancelar" size="small" text severity="secondary" @click="edit = null" />
                <Button label="Guardar" size="small" :loading="guardando" @click="guardarIdx(t.clave)">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
              </template>
            </div>
          </header>

          <!-- Modo edición: una fila por aniversario. El año base no lleva IPC. -->
          <div v-if="edit === t.clave" class="cd-sec-body space-y-2">
            <div v-for="(f, i) in filasEdit" :key="i" class="idx-fila">
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Año</label>
                <InputNumber v-model="f.anio" :useGrouping="false" :min="2000" :max="2100"
                  class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">IPC (%)</label>
                <InputNumber v-model="f.ipc" :minFractionDigits="1" :maxFractionDigits="3"
                  :disabled="f.esBase" placeholder="—" locale="en-US" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Valor ($/kWh)</label>
                <InputNumber v-model="f.valor" :minFractionDigits="0" :maxFractionDigits="6"
                  locale="en-US" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="cd-lbl">Base</label>
                <div class="flex items-center gap-2 h-9">
                  <Checkbox v-model="f.esBase" :binary="true" @change="marcarBase(i)" />
                  <Button text severity="danger" size="small" v-tooltip.bottom="'Quitar fila'" @click="filasEdit.splice(i, 1)">
                    <template #icon><Trash2Icon class="size-[1em]" /></template>
                  </Button>
                </div>
              </div>
            </div>
            <Button label="Agregar año" size="small" text @click="agregarFilaIdx">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
            <p class="text-[11px]" style="color:#9b89b5">
              El año marcado como base es la tarifa inicial y no lleva IPC. Los demás llevan el
              IPC con que se indexó ese aniversario.
            </p>
          </div>

          <div v-else class="cd-sec-body !p-0">
            <div v-if="!t.filas.length" class="px-4 py-6 text-center text-xs" style="color:#9b89b5">
              Sin datos de indexación. Usa <strong>Editar</strong> para capturarlos.
            </div>
            <table v-else class="w-full text-sm border-collapse">
              <thead>
                <tr style="background:#faf8fd">
                  <th class="cd-th">{{ c.fecha_firma_contrato ? 'Fecha aniversario' : 'Año' }}</th>
                  <th class="cd-th">IPC aplicado</th>
                  <th class="cd-th" style="text-align:right">Valor ($/kWh)</th>
                  <th class="cd-th" style="text-align:center">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in t.filas" :key="i" class="border-b" style="border-color:#f4f1f9"
                  :style="iVigente(t.filas) === i ? 'background:#fff7ed' : ''">
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono font-semibold"
                        :style="iVigente(t.filas) === i ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                        {{ etiquetaAnio(f) }}
                      </span>
                      <span v-if="f.esBase" class="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style="background:#e0f2fe;color:#0369a1">base</span>
                      <span v-if="iVigente(t.filas) === i && !f.esBase"
                        class="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style="background:#fef3c7;color:#d97706">actual</span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5">
                    <!-- El año base no lleva IPC por definición; en cualquier otro
                         año un IPC vacío es un dato que falta, no "base". -->
                    <span v-if="f.ipc == null" class="text-xs" style="color:#9b89b5">
                      {{ f.esBase ? '— (base)' : '—' }}
                    </span>
                    <span v-else class="font-mono tabular-nums" style="color:#374151">{{ f.ipc }}%</span>
                  </td>
                  <td class="px-4 py-2.5 text-right font-semibold tabular-nums"
                    :style="iVigente(t.filas) === i ? 'color:#d97706' : 'color:var(--color-unergy-deep)'">
                    {{ fmtVal(f.valor) }}
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full"
                      :style="ESTILO_FILA[estadoFila(t.filas, i)]">
                      {{ LABEL_FILA[estadoFila(t.filas, i)] }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import InfoField from '~/components/blocks/InfoField.vue'
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, ChartLineIcon, CheckIcon, CircleIcon, ClockIcon, CopyIcon, DollarSignIcon, ExternalLinkIcon, FilePenIcon, IdCardIcon, PencilIcon, PlusIcon, TableIcon, Trash2Icon, TriangleAlertIcon, UsersIcon } from '@lucide/vue'

const contratosServicioService = new ContratosServicioService()
const proyectosService = new ProyectosService()

const route = useRoute()
const confirm = useConfirm()

const ESTADO_LABELS = {
  vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación',
}
const ESTADO_SEVERITY = {
  vigente: 'success', vencido: 'destructive', terminado: 'default', en_renovacion: 'warning',
}
const ESTADOS_OPCIONES = Object.entries(ESTADO_LABELS).map(([value, label]) => ({ value, label }))
const SI_NO = [{ value: true, label: 'Sí' }, { value: false, label: 'No' }]
const PERIODICIDADES = ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual']
  .map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))

const LABEL_FILA = { pagado: 'Pagado', vigente: 'Vigente', pendiente: 'Pendiente' }
const ESTILO_FILA = {
  pagado:    'background:#dcfce7;color:#166534',
  vigente:   'background:#fef3c7;color:#d97706',
  pendiente: 'background:#f3f4f6;color:#9ca3af',
}

const loading = ref(true)
const proyectoNombre = ref('')
const contratos = ref([])
const idSeleccionado = ref(null)
const edit = ref(null)          // 'id' | 'partes' | 'vigencia' | 'comercial'
const guardando = ref(false)

const c = computed(() => contratos.value.find(x => x.id === idSeleccionado.value) || null)

const hoy = new Date().toISOString().slice(0, 10)

// ── Formato ──────────────────────────────────────────────────────────────────
function fmtFecha(v) { return v ? String(v).slice(0, 10) : '—' }
function fmtVal(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 4) : '—'
}

// Dos registros duplicados traen el mismo inversionista, así que la etiqueta a
// secas los deja indistinguibles. Cuando eso pasa se añade lo que los separa.
function etiquetaContrato(x) {
  const base = x.numero_contrato || x.inversionista_nombre || `Contrato ${x.id}`
  const repetida = contratos.value.filter(o =>
    (o.numero_contrato || o.inversionista_nombre || `Contrato ${o.id}`) === base).length > 1
  if (!repetida) return base
  const detalle = x.numero_contrato ? null
    : (x.nombre_proyecto_ref ? `ref ${x.nombre_proyecto_ref}` : `#${x.id}`)
  return detalle ? `${base} · ${detalle}` : `${base} · #${x.id}`
}

// ── Duplicados ───────────────────────────────────────────────────────────────
// El backend decide qué es duplicado y si se puede fusionar sin perder datos;
// acá solo se muestra el grupo que corresponde a esta planta.
const duplicados = ref({ grupos_fusionables: [], grupos_con_conflicto: [] })
const fusionando = ref(false)

const idsVista = computed(() => new Set(contratos.value.map(x => x.id)))
function delaVista(g) { return g.ids.some(id => idsVista.value.has(id)) }

const grupoDuplicado = computed(() =>
  (duplicados.value.grupos_fusionables || []).find(delaVista) || null)
const grupoEnConflicto = computed(() =>
  (duplicados.value.grupos_con_conflicto || []).find(delaVista) || null)

async function cargarDuplicados() {
  try {
    duplicados.value = await contratosServicioService.buscarDuplicadosRepresentacion()
  } catch (e) {
    // Antes esto se tragaba el error y el aviso simplemente no aparecía, sin
    // forma de saber si no había duplicados o si la consulta había fallado.
    toast.warning('No se pudo revisar duplicados', {
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  }
}

// Eliminar el contrato seleccionado. Hace falta para deshacer un "Nuevo
// contrato" creado por error y para dejar un solo registro cuando la fusión no
// aplica (por ejemplo si uno de los duplicados no aporta ningún dato).
function confirmarEliminar() {
  const x = c.value
  confirm({
    title: 'Eliminar contrato',
    description: `Se eliminará "${etiquetaContrato(x)}" de ${proyectoNombre.value || 'esta planta'}. `
      + 'Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: () => eliminar(x.id),
  })
}

async function eliminar(id) {
  try {
    await contratosServicioService.eliminar(id)
    contratos.value = contratos.value.filter(x => x.id !== id)
    idSeleccionado.value = contratos.value[0]?.id ?? null
    toast.success('Contrato eliminado', { duration: 2500 })
    await cargarDuplicados()
  } catch (e) {
    toast.error('No se pudo eliminar', { description: e.data?.detail || e.message, duration: 4000 })
  }
}

async function fusionar() {
  fusionando.value = true
  try {
    const data = await contratosServicioService.fusionarRepresentacion(grupoDuplicado.value.ids)
    toast.success('Registros fusionados', {
      description: `${data.contratos_eliminados} duplicado(s) eliminado(s)`,
      duration: 3500,
    })
    await cargar()
    await cargarDuplicados()
  } catch (e) {
    toast.error('No se pudo fusionar', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    fusionando.value = false
  }
}

// ── Indexación ───────────────────────────────────────────────────────────────
// El JSONB guarda {año, ipc, valor, esBase}. La fecha exacta del aniversario no
// se persiste: se deriva de la firma manteniendo mes y día, igual que hace
// `_anniversary_date` en el backend. Sin firma solo se puede mostrar el año.
const idxCgm = computed(() => ordenar(c.value?.indexacion_cgm))
const idxRep = computed(() => ordenar(c.value?.indexacion_representacion))

const TABLAS_IDX = computed(() => [
  { clave: 'cgm', titulo: 'Indexación CGM', filas: idxCgm.value },
  { clave: 'rep', titulo: 'Indexación Representación', filas: idxRep.value },
])

function ordenar(filas) {
  if (!Array.isArray(filas)) return []
  return [...filas].sort((a, b) => (anio(a) || 0) - (anio(b) || 0))
}
function anio(f) { return Number(f?.año ?? f?.anio ?? f?.year) || null }

function etiquetaAnio(f) {
  const a = anio(f)
  if (!a) return '—'
  const firma = c.value?.fecha_firma_contrato
  return firma && String(firma).length >= 10 ? `${a}-${String(firma).slice(5, 10)}` : String(a)
}

// Fila vigente: la del aniversario más reciente que ya pasó.
function iVigente(filas) {
  let idx = -1
  for (let i = 0; i < filas.length; i++) {
    if (etiquetaAnio(filas[i]) <= hoy || String(anio(filas[i])) <= hoy.slice(0, 4)) idx = i
  }
  return idx
}
function valorVigente(filas) {
  const i = iVigente(filas)
  return i >= 0 ? filas[i].valor : null
}
function estadoFila(filas, i) {
  const v = iVigente(filas)
  if (i < v) return 'pagado'
  if (i === v) return 'vigente'
  return 'pendiente'
}

// ── Resumen ──────────────────────────────────────────────────────────────────
const duracion = computed(() => {
  const ini = c.value?.fecha_inicio, fin = c.value?.fecha_fin
  if (!ini || !fin) return ''
  const a = new Date(ini), b = new Date(fin)
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (meses < 0) return ''
  const años = Math.floor(meses / 12)
  meses = meses % 12
  const partes = []
  if (años) partes.push(`${años} año${años === 1 ? '' : 's'}`)
  if (meses) partes.push(`${meses} mes${meses === 1 ? '' : 'es'}`)
  return partes.join(' ') || 'menos de un mes'
})

const vigencia = computed(() => {
  const x = c.value
  const neutro = { label: '—', detalle: 'sin fechas', color: '#6b5a8a', bg: '#fff', borde: '#ECE7F2' }
  if (!x) return neutro
  if (x.estado === 'terminado') {
    return { label: 'Terminado', detalle: 'cerrado', color: '#374151', bg: '#f9fafb', borde: '#e5e7eb' }
  }
  if (!x.fecha_fin) {
    return { label: ESTADO_LABELS[x.estado] || x.estado || '—', detalle: 'sin fecha fin',
             color: '#0369a1', bg: '#f0f9ff', borde: '#bae6fd' }
  }
  const dias = Math.round((new Date(x.fecha_fin) - new Date(hoy)) / 86400000)
  if (dias < 0) {
    return { label: 'Vencido', detalle: `venció hace ${Math.abs(dias)} días`,
             color: '#b91c1c', bg: '#fef2f2', borde: '#fecaca' }
  }
  if (dias <= 60) {
    return { label: 'Por vencer', detalle: `en ${dias} días`,
             color: '#b45309', bg: '#fffbeb', borde: '#fde68a' }
  }
  return { label: 'Vigente', detalle: `${dias} días restantes`,
           color: '#15803d', bg: '#f0fdf4', borde: '#bbf7d0' }
})

// ── Edición por sección ──────────────────────────────────────────────────────
const form = reactive({})

function abrir(seccion) {
  const x = c.value
  if (!x) return
  Object.assign(form, {
    numero_contrato: x.numero_contrato || '',
    inversionista_nombre: x.inversionista_nombre || '',
    portafolio: x.portafolio || '',
    codigo_sun_factory: x.codigo_sun_factory || '',
    nombre_proyecto_ref: x.nombre_proyecto_ref || '',
    contratante_nombre: x.contratante_nombre || '',
    contratante_nit: x.contratante_nit || '',
    prestador_nombre: x.prestador_nombre || '',
    prestador_nit: x.prestador_nit || '',
    estado: x.estado || 'vigente',
    fecha_firma_contrato: aFecha(x.fecha_firma_contrato),
    fecha_inicio: aFecha(x.fecha_inicio),
    fecha_fin: aFecha(x.fecha_fin),
    renovacion_automatica: x.renovacion_automatica,
    tarifa_admin_pct: x.tarifa_admin != null ? Number(x.tarifa_admin) * 100 : null,
    tarifa_cgm: x.tarifa_cgm != null ? Number(x.tarifa_cgm) : null,
    tarifa_representacion: x.tarifa_representacion != null ? Number(x.tarifa_representacion) : null,
    indice_indexacion: x.indice_indexacion || '',
    periodicidad_pago: x.periodicidad_pago || null,
    responsable_iva: !!x.responsable_iva,
    enlace_drive: x.enlace_drive || '',
  })
  edit.value = seccion
}

function aFecha(v) { return v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null }
function deFecha(v) {
  if (!v) return null
  if (typeof v === 'string') return v.slice(0, 10)
  // DatePicker entrega Date local; toISOString pasaría a UTC y podría restar un día.
  const p = n => String(n).padStart(2, '0')
  return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
}

// Solo se envían los campos de la sección que se editó: un PATCH con todo
// pisaría lo que otra pestaña haya cambiado mientras tanto.
function guardar(campos) {
  const payload = {}
  for (const k of campos) {
    if (k === 'tarifa_admin') {
      payload.tarifa_admin = form.tarifa_admin_pct != null ? form.tarifa_admin_pct / 100 : null
    } else if (['fecha_firma_contrato', 'fecha_inicio', 'fecha_fin'].includes(k)) {
      payload[k] = deFecha(form[k])
    } else {
      const v = form[k]
      payload[k] = v === '' ? null : v
    }
  }
  return enviar(payload)
}

async function enviar(payload) {
  guardando.value = true
  try {
    const data = await contratosServicioService.actualizar(c.value.id, payload)
    const i = contratos.value.findIndex(x => x.id === data.id)
    if (i !== -1) contratos.value[i] = data
    edit.value = null
    toast.success('Cambios guardados', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo guardar', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

// ── Edición de la indexación ─────────────────────────────────────────────────
// El JSONB guarda las claves con tilde ("año") y en camelCase ("esBase"), que es
// como las escribió el seed. Acá se trabaja con `anio` para no pelear con la
// tilde en el binding y se traduce al guardar.
const filasEdit = ref([])

function abrirIdx(clave) {
  const origen = clave === 'cgm' ? idxCgm.value : idxRep.value
  filasEdit.value = origen.map(f => ({
    anio: anio(f),
    ipc: f.ipc != null ? Number(f.ipc) : null,
    valor: f.valor != null ? Number(f.valor) : null,
    esBase: !!f.esBase,
  }))
  edit.value = clave
}

function agregarFilaIdx() {
  const ultimo = filasEdit.value.reduce((m, f) => Math.max(m, f.anio || 0), 0)
  filasEdit.value.push({
    anio: ultimo ? ultimo + 1 : new Date().getFullYear(),
    ipc: null, valor: null, esBase: !filasEdit.value.length,
  })
}

// Solo un año puede ser la base: marcar uno desmarca el resto.
function marcarBase(i) {
  if (!filasEdit.value[i].esBase) return
  filasEdit.value.forEach((f, j) => { if (j !== i) f.esBase = false })
  filasEdit.value[i].ipc = null
}

function guardarIdx(clave) {
  const filas = filasEdit.value
    .filter(f => f.anio)
    .sort((a, b) => a.anio - b.anio)
    .map(f => ({
      año: f.anio,
      ipc: f.esBase ? null : (f.ipc ?? null),
      valor: f.valor ?? 0,
      esBase: f.esBase || undefined,
    }))
  const campo = clave === 'cgm' ? 'indexacion_cgm' : 'indexacion_representacion'
  return enviar({ [campo]: filas })
}

async function nuevoContrato() {
  try {
    const data = await contratosServicioService.crear({
      servicio_aplica: 'representacion',
      proyecto_id: Number(route.params.id),
      estado: 'vigente',
    })
    contratos.value.push(data)
    idSeleccionado.value = data.id
    toast.success('Contrato creado', { description: 'Completa los datos con Editar', duration: 3000 })
  } catch (e) {
    toast.error('No se pudo crear', { description: e.data?.detail || e.message, duration: 4000 })
  }
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function cargar() {
  const pid = Number(route.params.id)
  const data = await contratosServicioService.listar({
    tipo: 'representacion',
    proyecto_id: pid,
    limit: 500,
  })
  // El endpoint ensancha la búsqueda con codigo_tsf y con el número de la planta
  // en nombre_proyecto_ref, lo que puede traer contratos de otras plantas. Acá
  // interesa solo lo que está asociado a ESTA, que es lo que la vista dice ser.
  contratos.value = data.filter(x => x.proyecto_id === pid)
  if (contratos.value.length && !contratos.value.some(x => x.id === idSeleccionado.value)) {
    idSeleccionado.value = contratos.value[0].id
  }
}

onMounted(async () => {
  try {
    const proyecto = await proyectosService.obtener(route.params.id)
    proyectoNombre.value = proyecto.nombre_comercial || ''
  } catch { /* el nombre es decorativo: la vista funciona sin él */ }
  try {
    await cargar()
    await cargarDuplicados()
  } catch (e) {
    toast.error('Error al cargar contratos', {
      description: e.data?.detail || e.message,
      duration: 4000,
    })
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* Mismo lenguaje visual que el detalle de PPA (ContratoDetailView). */
.cd-stat {
  background: #fff; border: 1px solid #ECE7F2; border-radius: 12px;
  padding: 11px 14px; min-width: 0;
}
.cd-stat-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: #9b89b5; margin-bottom: 3px;
}
.cd-stat-val {
  font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cd-stat-val::first-letter { text-transform: uppercase; }
.cd-stat-sub {
  font-size: 11px; color: #9b89b5; margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.cd-sec { background: #fff; border: 1.5px solid #e8e0f0; border-radius: 12px; overflow: hidden; }
.cd-sec-head {
  display: flex; align-items: center; gap: 9px; min-height: 42px;
  padding: 6px 14px; background: #faf8fd; border-bottom: 1px solid #f0eaf8;
}
.cd-sec-title {
  font-size: 12px; font-weight: 700; letter-spacing: .03em;
  text-transform: uppercase; color: var(--color-unergy-deep);
}
.cd-sec-act { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.cd-sec-body { padding: 14px; }
.cd-ico {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.cd-ico svg { font-size: 11px; }

.cd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (min-width: 768px) { .cd-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.cd-ancho { grid-column: 1 / -1; }
.cd-campo-lbl { font-size: 12px; font-weight: 500; color: #9b89b5; }
.cd-lbl { font-size: 12px; font-weight: 500; color: #4b5563; }

.cd-partes { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
.cd-partes-flecha { font-size: 12px; color: #c5b9db; }
@media (max-width: 640px) {
  .cd-partes { grid-template-columns: 1fr; }
  .cd-partes-flecha { transform: rotate(90deg); justify-self: center; }
}
.cd-parte {
  border: 1px solid #ECE7F2; border-radius: 10px; padding: 11px 13px;
  background: #fcfbfe; min-width: 0;
}
.cd-parte-rol {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  color: #9b89b5; margin-bottom: 3px;
}
.cd-parte-nom { font-size: 13px; font-weight: 600; color: var(--color-unergy-deep); }
.cd-parte-nit {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: #9b8fb0; margin-top: 1px;
}

.dup-aviso {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 13px; border-radius: 10px; font-size: 12px;
  background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af;
}
.dup-aviso--frena { background: #fffbeb; border-color: #fde68a; color: #92400E; }
.dup-aviso svg { font-size: 13px; margin-top: 1px; flex-shrink: 0; }

.idx-fila {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
  border: 1px solid #ECE7F2; border-radius: 10px; padding: 10px 12px; background: #fcfbfe;
}
@media (min-width: 768px) { .dup-aviso {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 13px; border-radius: 10px; font-size: 12px;
  background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af;
}
.dup-aviso--frena { background: #fffbeb; border-color: #fde68a; color: #92400E; }
.dup-aviso svg { font-size: 13px; margin-top: 1px; flex-shrink: 0; }

.idx-fila { grid-template-columns: 1fr 1fr 1fr auto; } }

.cd-th {
  padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 700;
  color: #9b89b5; border-bottom: 1px solid #f0eaf8;
}
</style>
