<template>
  <div v-if="loading" class="flex items-center justify-center py-12">
    <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
  </div>
  <div v-else-if="detalle" class="space-y-5">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <p class="text-sm font-bold" style="color: var(--color-unergy-deep);">{{ detalle.nombre_proyecto }}</p>
        <div class="text-xs font-mono" style="color: #9b89b5;">
          {{ detalle.fecha }}
          <span v-if="detalle.estado_reporte && detalle.estado_reporte !== 'WARNING'"> · Estado reporte {{ detalle.estado_reporte }}</span>
        </div>
      </div>
      <GBadge v-if="detalle.revisar_manualmente" color="destructive">Revisar manualmente</GBadge>
      <GBadge v-else color="success">OK</GBadge>
    </div>

    <!-- Frontera de terceros: el CGM lo maneja otra empresa (ej. Cedillanos);
         se reporta con el Excel que ellos envían, no con este árbol de
         Casos -- ver FRONTERAS_TERCEROS en clasificador.py. -->
    <div v-if="String(detalle.caso) === '0'" class="rounded-xl p-4"
         style="border: 1px solid #e8e0f0; background: #f9f7ff;">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">
            <CircleCheckIcon v-if="detalle.medidor_usado === 'excel_terceros'" class="text-xs mr-1.5 size-[1em]" :style="detalle.medidor_usado === 'excel_terceros' ? 'color: #059669;' : ''" />
            <FileSpreadsheetIcon v-else class="text-xs mr-1.5 size-[1em]" :style="detalle.medidor_usado === 'excel_terceros' ? 'color: #059669;' : ''" />
            {{ detalle.medidor_usado === 'excel_terceros' ? 'Cargado desde Excel de terceros' : 'Esperando Excel de terceros' }}
          </p>
          <p v-if="detalle.medidor_usado === 'excel_terceros'" class="text-xs mt-1" style="color: #6b5a8a;">
            Ya hay un Excel cargado para este día -- {{ fmtKwh(detalle.energia_final_kwh) }}. Puedes
            reemplazarlo subiendo otro, o quitarlo con "Eliminar carga".
          </p>
          <p v-else class="text-xs mt-1" style="color: #6b5a8a;">
            El CGM de esta frontera lo maneja otra empresa; sube su Excel (Primary/Backup ×
            ENERGIA EXPORTADA ACTIVA) para reportar este día.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input ref="fileInputExcelTerceros" type="file" accept=".xlsx,.xls" class="hidden"
                 @change="onArchivoExcelTercerosSeleccionado" />
          <Button label="Cargar Excel" size="small" :loading="subiendoExcelTerceros" @click="fileInputExcelTerceros?.click()">
            <template #icon><UploadIcon class="size-[1em]" /></template>
          </Button>
          <Button v-if="detalle.medidor_usado === 'excel_terceros'" label="Eliminar carga" size="small" severity="danger" outlined :loading="eliminandoExcelTerceros" @click="eliminarExcelTerceros">
            <template #icon><Trash2Icon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </div>

    <!-- Detalle de la clasificación -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <p class="text-xs font-semibold uppercase mb-3" style="color: #6b5a8a;">Detalle de la clasificación</p>
      <div class="flex items-start gap-3 mb-3">
        <div class="flex-none rounded-lg px-2.5 py-1.5 flex items-center justify-center font-bold text-sm whitespace-nowrap"
             :style="{ background: casoColor.bg, color: casoColor.fg, minWidth: '2.25rem' }">
          {{ detalle.caso }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-bold" style="color: var(--color-unergy-deep);">{{ casoInfo.nombre }}</p>
          <p class="text-xs" style="color: #6b5a8a;">{{ casoInfo.descripcion }}</p>
        </div>
      </div>
      <p v-if="detalle.error_clasificacion" class="text-xs rounded-lg px-2.5 py-1.5 mb-3 font-mono"
         style="background: rgba(214,68,85,0.08); color: #D64455;">
        {{ detalle.error_clasificacion }}
      </p>
      <dl class="grid grid-cols-2 gap-y-2 text-sm">
        <dt style="color: #9b89b5;">Fuente usada</dt><dd class="font-mono">{{ etiquetaFuente(detalle.medidor_usado, detalle) }}</dd>
        <dt style="color: #9b89b5;">Energía Total</dt><dd class="font-mono">{{ fmtKwh(detalle.energia_final_kwh) }}</dd>
        <template v-if="detalle.tipo === 'generacion'">
          <dt style="color: #9b89b5;">Factor de pérdida (FP)</dt>
          <dd class="font-mono">{{ fpUsadoHoy && detalle.fp != null ? detalle.fp.toFixed(4) : '—' }}</dd>
        </template>
        <template v-if="(detalle.horas_rellenadas_medidor_cruzado || []).length">
          <dt style="color: #9b89b5;">Rellenado (Medidor cruzado)</dt>
          <dd class="font-mono">{{ formatearRangosHoras(detalle.horas_rellenadas_medidor_cruzado) }}</dd>
        </template>
        <template v-if="(detalle.horas_rellenadas_reconectador || []).length">
          <dt style="color: #9b89b5;">Horas rellenadas (reconectador)</dt>
          <dd class="font-mono">{{ formatearRangosHoras(detalle.horas_rellenadas_reconectador) }}</dd>
        </template>
        <template v-if="(detalle.horas_rellenadas_solenium || []).length">
          <dt style="color: #9b89b5;">Horas rellenadas (Solenium × FP)</dt>
          <dd class="font-mono">{{ formatearRangosHoras(detalle.horas_rellenadas_solenium) }}</dd>
        </template>
        <template v-if="(detalle.horas_rellenadas_historico || []).length">
          <dt style="color: #9b89b5;">Horas rellenadas (histórico)</dt>
          <dd class="font-mono">{{ formatearRangosHoras(detalle.horas_rellenadas_historico) }}</dd>
        </template>
        <template v-if="!(detalle.horas_rellenadas_medidor_cruzado || []).length && !(detalle.horas_rellenadas_reconectador || []).length && !(detalle.horas_rellenadas_solenium || []).length && !(detalle.horas_rellenadas_historico || []).length">
          <dt style="color: #9b89b5;">Horas rellenadas</dt>
          <dd class="font-mono">—</dd>
        </template>
      </dl>
    </div>

    <!-- Fallas activas del proyecto (Gestión de Fallas) -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-semibold uppercase" style="color: #6b5a8a;">Fallas activas del proyecto</p>
        <RouterLink v-if="fallasActivas.length" :to="`/operaciones/gestion-fallas?proyecto=${detalle.proyecto_id}`"
          class="text-xs underline" style="color: var(--color-unergy-purple);">Ver todas</RouterLink>
      </div>
      <p v-if="!fallasActivas.length" class="text-xs" style="color: #9b89b5;">
        <CircleCheckIcon class="text-xs mr-1 size-[1em]" style="color: #10B981;" />Sin fallas activas registradas.
      </p>
      <div v-else class="space-y-2">
        <RouterLink v-for="f in fallasActivas" :key="f.id" :to="`/fallas/${f.id}`"
          class="falla-activa-row flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
          style="border: 1px solid #e8e0f0;">
          <span class="flex-none rounded-full" style="width: 8px; height: 8px;"
                :style="{ background: prioColorFalla(f.prioridad?.codigo) }" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <code class="text-xs font-mono" style="color: #9b89b5;">{{ f.codigo_interno }}</code>
              <span class="text-xs font-semibold px-1.5 py-0.5 rounded" :style="estadoPillStyleFalla(f.estado?.codigo)">
                {{ f.estado?.etiqueta }}
              </span>
            </div>
            <p class="text-sm truncate" style="color: var(--color-unergy-deep);">{{ f.tipo?.etiqueta || f.descripcion }}</p>
          </div>
          <span v-if="f.dias_abierta != null" class="text-xs font-mono flex-none" style="color: #9b89b5;">
            {{ f.dias_abierta }}d
          </span>
        </RouterLink>
      </div>
    </div>

    <!-- Curva -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <p class="text-xs font-semibold uppercase mb-3" style="color: #6b5a8a;">Curva reportada (24 h)</p>
      <CurvaChart
        :final="detalle.curva_final"
        :medidor="detalle.curva_medidor_principal || detalle.curva_medidor_respaldo"
        :medidorLabel="medidorGraficadoLabel"
        :solenium="detalle.curva_solenium"
        :reconectador="detalle.curva_reconectador"
        :horasReconectador="detalle.horas_rellenadas_reconectador"
        :horasSolenium="detalle.horas_rellenadas_solenium"
        :horasHistorico="detalle.horas_rellenadas_historico"
        :horasMedidorCruzado="detalle.horas_rellenadas_medidor_cruzado"
        :capacidadMw="detalle.capacidad_efectiva_mw"
        :editadoManualmente="detalle.editado_manualmente"
      />
    </div>

    <!-- Detalle de las fuentes -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-semibold uppercase" style="color: #6b5a8a;">Detalle de las fuentes</p>
        <Button label="Recuperar medidor" size="small" severity="secondary" outlined :loading="recuperandoMedidor" @click="recuperarMedidor">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
      </div>
      <div v-for="aviso in avisosMedidor" :key="aviso.etiqueta" class="flex items-start gap-2.5 rounded-lg px-3 py-2.5 mb-3"
           style="background: rgba(37,124,214,0.08); border: 1px solid #257CD6;">
        <span class="flex-none rounded-full w-[18px] h-[18px] flex items-center justify-center text-[11px] font-bold text-white"
              style="background: #257CD6; margin-top: 1px;">i</span>
        <p class="text-xs flex-1" style="color: #1B5DA3; line-height: 1.5;">
          {{ aviso.etiqueta }} muestra un valor distinto en Quoia
          (<strong style="color: var(--color-unergy-deep);">{{ fmtKwh(aviso.actual) }}</strong> ahora
          vs. <strong style="color: var(--color-unergy-deep);">{{ fmtKwh(aviso.clasificacion) }}</strong> al momento de clasificar).
        </p>
        <Button v-if="aviso.tipo === 'respaldo'" label="Usar" size="small" text
                :loading="usandoRespaldoEnVivo" @click="usarRespaldoEnVivo" class="flex-none" />
      </div>
      <div class="space-y-0">
        <div v-for="f in fuentes" :key="f.clave"
             class="flex items-center gap-3 py-2.5 border-t first:border-t-0" style="border-color: #f0ecf6;">
          <div class="flex-none rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
               :style="fuenteIconStyle(f.estado)">
            {{ f.estado === 'ok' ? '✓' : (f.estado === 'na' ? '–' : (f.estado === 'error' ? '!' : '✕')) }}
          </div>
          <span class="text-sm font-semibold flex-none" style="color: var(--color-unergy-deep); width: 160px;">{{ f.nombre }}</span>
          <span class="text-xs flex-1 min-w-0" style="color: #6b5a8a;">{{ f.detalle }}</span>
          <span class="text-xs font-mono flex-none text-right" style="color: var(--color-unergy-deep); min-width: 90px;">
            {{ f.valor != null ? fmtKwh(f.valor) : (f.estado === 'na' ? 'n/a' : '—') }}
          </span>
          <span v-if="f.usado" class="text-[10px] font-bold text-white rounded-full px-2 py-0.5 flex-none" style="background: var(--color-unergy-purple);">USADO</span>
        </div>
      </div>
      <p v-if="medianaHistorica" class="text-[11px] mt-3" style="color: #9b89b5;">
        <strong>Mediana histórica:</strong> {{ fmtKwh(medianaHistorica.mediana) }}
        <span v-if="medianaHistorica.dias">({{ medianaHistorica.dias }} días)</span>
      </p>
      <p v-if="detalle.recuperacion_datos" class="text-[11px] mt-3" style="color: #9b89b5;">
        <strong>Última recuperación de medidores:</strong> {{ detalle.recuperacion_datos }}
      </p>
    </div>

    <!-- Edición manual -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <p class="text-xs font-semibold uppercase mb-3" style="color: #6b5a8a;">Corrección manual (kWh)</p>
      <div class="flex flex-wrap gap-4">
        <table class="tabla-horas">
          <thead><tr><th>Hora</th><th>Principal</th><th>Respaldo ({{ etiquetaOrigenRespaldo }})</th></tr></thead>
          <tbody>
            <tr v-for="h in 12" :key="h - 1" :class="esHoraRellenada(h - 1) ? 'fila-rellenada' : ''">
              <td>{{ h - 1 }}h</td>
              <td>
                <InputText v-model="curvaEditable[h - 1]" inputmode="decimal"
                           class="w-full text-xs text-right celda-input"
                           @paste="onPasteHora($event, h - 1)" />
              </td>
              <td>
                <InputText v-model="curvaRespaldoEditable[h - 1]" inputmode="decimal"
                           :placeholder="respaldoPlaceholder(h - 1)"
                           class="w-full text-xs text-right celda-input"
                           :class="{ 'celda-respaldo-real': respaldoEsDatoReal }"
                           @paste="onPasteHoraRespaldo($event, h - 1)" />
              </td>
            </tr>
          </tbody>
        </table>
        <table class="tabla-horas">
          <thead><tr><th>Hora</th><th>Principal</th><th>Respaldo ({{ etiquetaOrigenRespaldo }})</th></tr></thead>
          <tbody>
            <tr v-for="h in 12" :key="h + 11" :class="esHoraRellenada(h + 11) ? 'fila-rellenada' : ''">
              <td>{{ h + 11 }}h</td>
              <td>
                <InputText v-model="curvaEditable[h + 11]" inputmode="decimal"
                           class="w-full text-xs text-right celda-input"
                           @paste="onPasteHora($event, h + 11)" />
              </td>
              <td>
                <InputText v-model="curvaRespaldoEditable[h + 11]" inputmode="decimal"
                           :placeholder="respaldoPlaceholder(h + 11)"
                           class="w-full text-xs text-right celda-input"
                           :class="{ 'celda-respaldo-real': respaldoEsDatoReal }"
                           @paste="onPasteHoraRespaldo($event, h + 11)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center gap-1.5 text-xs mt-2" style="color: #9b89b5;">
        <span class="inline-block rounded-sm" style="width: 12px; height: 12px; background: rgba(240, 192, 64, 0.35); border: 1px solid #F0C040;"></span>
        Hora rellenada
      </div>
      <p class="text-xs mt-1" style="color: #9b89b5;">
        Tip: pega varios valores seguidos (ej. una columna copiada de Excel) en cualquier celda -- se reparten en las horas siguientes en orden.
      </p>
      <div class="flex items-center justify-between mt-2">
        <div class="flex items-center gap-2">
          <Button label="Limpiar curva" size="small" severity="danger" outlined @click="limpiarCurva">
            <template #icon><EraserIcon class="size-[1em]" /></template>
          </Button>
          <!-- El relleno horario (medidor cruzado / reconectador / Solenium
               × FP / histórico) ya no aplica solo durante la clasificación
               -- queda a criterio de la persona: reportar la curva tal como
               está (con el hueco) o rellenarla con este botón. Generación y
               Consumo. -->
          <!-- Si ya hubo un relleno antes (hayHorasRelleno) y todavía queda
               un hueco, es porque esa hora YA se intentó contra las 4
               fuentes en cascada y ninguna tenía dato -- un dato histórico
               que no cambia. Mostrar el botón otra vez solo invita a un
               clic que va a fallar con el mismo error (ver captura
               2026-08-20: 6h vacía después de rellenar 7h-11h/17h-18h). -->
          <Button v-if="hayHuecosSinRellenar && !hayHorasRelleno(detalle)" label="Rellenar horas" size="small" severity="secondary" outlined
            :loading="rellenando" :disabled="hayCambiosSinGuardar" @click="rellenarHorario" />
          <Button v-if="hayHorasRelleno(detalle)" label="Deshacer relleno" size="small" severity="secondary" outlined :loading="deshaciendoRelleno" :disabled="hayCambiosSinGuardar" @click="deshacerRelleno">
            <template #icon><UndoIcon class="size-[1em]" /></template>
          </Button>
          <div v-if="!esCasoConfiado" class="relative">
            <Button label="Reportar con otra fuente" class="flex-row-reverse" size="small"
              style="background: #F0C040; border-color: #F0C040; color: #4a3200;"
              @click="mostrarMenuReportar = !mostrarMenuReportar">
              <template #icon><ChevronDownIcon class="size-[1em]" /></template>
            </Button>
            <div v-if="mostrarMenuReportar" class="fixed inset-0 z-10" @click="mostrarMenuReportar = false"></div>
            <div v-if="mostrarMenuReportar" class="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden z-20"
                 style="background: white; border: 1px solid #e8e0f0; box-shadow: 0 10px 30px rgba(44,32,57,0.16);">
              <div v-for="op in opcionesReportarCon" :key="op.key"
                   class="flex items-center justify-between gap-3 px-3 py-2.5"
                   :class="op.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-[#f9f7ff]'"
                   style="border-bottom: 1px solid #e8e0f0;"
                   @click="!op.disabled && elegirFuenteReportar(op)">
                <div class="min-w-0">
                  <div class="text-xs font-semibold" style="color: var(--color-unergy-deep);">{{ op.nombre }}</div>
                  <div v-if="op.nota" class="text-[10.5px]" style="color: #9b89b5;">{{ op.nota }}</div>
                </div>
                <div class="text-xs font-mono flex-none" style="color: var(--color-unergy-deep);">
                  {{ op.valor != null ? fmtKwh(op.valor) : 'Sin dato' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button label="Guardar corrección" size="small" :loading="guardando" :disabled="!hayCambiosSinGuardar" @click="guardarCurva" />
      </div>
    </div>

    <!-- Exclusion temporal: para cuando no se quiere reportar NADA mientras
         se resuelve algo externo (ej. un CT en falla ya reportado a XM) --
         no depende de Fallas (requiere monitoreo/representación, que no
         todas las fronteras tienen). -->
    <div class="rounded-xl p-4" style="border: 1px solid #e8e0f0;">
      <template v-if="exclusionActiva && !editandoExclusion">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold" style="color: #A8590B;">
              <BanIcon class="text-xs mr-1.5 size-[1em]" />Excluida temporalmente
            </p>
            <p class="text-xs mt-1" style="color: #6b5a8a;">
              {{ exclusionActiva.motivo }}
              <span v-if="exclusionActiva.fecha_fin_estimada"> -- hasta {{ exclusionActiva.fecha_fin_estimada }}</span>
            </p>
            <p class="text-xs mt-1" style="color: #9b89b5;">
              Registrada por {{ exclusionActiva.creado_por || 'desconocido' }} el {{ fmtFechaHora(exclusionActiva.created_at) }}
            </p>
          </div>
          <button type="button" class="text-xs font-semibold flex-none" style="color: var(--color-unergy-purple-dark);" @click="iniciarEdicionExclusion">
            <PencilIcon class="text-[10px] mr-1 size-[1em]" />Editar
          </button>
        </div>
        <Button label="Marcar resuelta" severity="secondary" outlined size="small" class="mt-3"
          :loading="resolviendoExclusion" @click="resolverExclusionActual" />
      </template>
      <template v-else-if="exclusionActiva && editandoExclusion">
        <p class="text-sm font-semibold mb-2" style="color: var(--color-unergy-deep);">Editar exclusión</p>
        <div class="flex flex-col gap-2 max-w-lg">
          <div class="flex gap-2 items-start">
            <Textarea v-model="nuevaExclusionMotivo" rows="1" placeholder="Motivo" class="text-xs flex-1" />
            <Calendar v-model="nuevaExclusionFechaFin" dateFormat="yy-mm-dd" placeholder="Hasta" class="w-48 text-xs" showIcon showClear />
          </div>
          <div class="flex gap-2">
            <Button label="Guardar" size="small" :disabled="!nuevaExclusionMotivo.trim()" :loading="editandoExclusionGuardando" @click="guardarEdicionExclusion" />
            <Button label="Cancelar" severity="secondary" outlined size="small" @click="editandoExclusion = false" />
          </div>
        </div>
      </template>
      <template v-else>
        <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Excluir temporalmente</p>
        <p class="text-xs mb-3" style="color: #9b89b5;">
          No reporta ningún número automático mientras se resuelve el inconveniente/falla.
        </p>
        <div class="flex flex-col gap-2 max-w-lg">
          <div class="flex gap-2 items-start">
            <Textarea v-model="nuevaExclusionMotivo" rows="1" placeholder="Motivo" class="text-xs flex-1" />
            <Calendar v-model="nuevaExclusionFechaFin" dateFormat="yy-mm-dd" placeholder="Hasta" class="w-48 text-xs" showIcon />
          </div>
          <Button label="Excluir temporalmente" severity="danger" outlined size="small"
            :disabled="!nuevaExclusionMotivo.trim()" :loading="creandoExclusion" @click="crearExclusionActual" />
        </div>
      </template>
    </div>

    <!-- Validar: accion final, independiente de la correccion manual --
         confirma que el numero automatico esta bien tal cual, sin tocar
         ningun valor. Separada de "Guardar correccion" para no parecer
         dos formas de guardar lo mismo. -->
    <div class="rounded-xl p-4 flex items-center justify-between gap-3" style="border: 1px solid #e8e0f0;">
      <div>
        <p class="text-sm font-semibold" style="color: var(--color-unergy-deep);">Confirmar revisión</p>
        <p class="text-xs" style="color: #9b89b5;">
          Marca este día como revisado y listo para reportar.
        </p>
        <p v-if="hayCambiosSinGuardar" class="text-xs mt-1" style="color: #D64455;">
          Hay cambios sin guardar en la curva -- guarda la corrección primero, o se validaría el número anterior.
        </p>
      </div>
      <Button label="Validar Frontera" severity="success" :loading="validando" :disabled="hayCambiosSinGuardar" @click="validar" />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { ReporteEnergiaService } from '~/features/fronteras/services/reporte-energia'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Calendar from 'primevue/calendar'
import Textarea from 'primevue/textarea'
import CurvaChart from './ReporteEnergiaCurvaChart.vue'
import { BanIcon, ChevronDownIcon, CircleCheckIcon, EraserIcon, FileSpreadsheetIcon, LoaderCircleIcon, PencilIcon, RefreshCwIcon, Trash2Icon, UndoIcon, UploadIcon } from '@lucide/vue'

const props = defineProps({
  fronteraId: { type: Number, required: true },
  fecha: { type: String, required: true },
})
const emit = defineEmits(['actualizado'])

const reporteEnergiaService = new ReporteEnergiaService()
const fallasService = new FallasService()
const loading = ref(true)
const detalle = ref(null)
const curvaEditable = ref(Array(24).fill(null))
const curvaRespaldoEditable = ref(Array(24).fill(null))
const guardando = ref(false)
const rellenando = ref(false)
const deshaciendoRelleno = ref(false)
const recuperandoMedidor = ref(false)
const mostrarMenuReportar = ref(false)
// Cuál opción de 'Reportar con otra fuente' llenó el editor por última vez
// -- se manda al guardar para que 'Fuente usada' diga esa fuente específica
// en vez de un genérico "Editado manualmente". Null si la persona edita
// celdas a mano sin pasar por ese desplegable.
const fuenteManualElegida = ref(null)
// { curva, energia_total_kwh, dias_usados } | null si no hay histórico
// confiable todavía -- se precarga para que el desplegable "Reportar con
// otra fuente" muestre el valor real de Curva típica en vez de "Sin dato"
// fijo (era un placeholder, no reflejaba si de verdad había histórico).
const curvaTipicaPreview = ref(null)
const validando = ref(false)
const subiendoExcelTerceros = ref(false)
const eliminandoExcelTerceros = ref(false)
const fileInputExcelTerceros = ref(null)

// Exclusion temporal (no depende de Fallas -- ver ReporteEnergiaExclusion en
// el backend). El historial trae todas (activas y resueltas); "activa" es
// la que aplica al día que se está viendo.
const exclusiones = ref([])
const nuevaExclusionMotivo = ref('')
const nuevaExclusionFechaFin = ref(null)
const creandoExclusion = ref(false)
const resolviendoExclusion = ref(false)
const editandoExclusion = ref(false)
const editandoExclusionGuardando = ref(false)

async function cargarExclusiones() {
  try {
    exclusiones.value = await reporteEnergiaService.listarExclusiones(props.fronteraId)
  } catch (e) {
    exclusiones.value = []
  }
}

const exclusionActiva = computed(() => {
  const fecha = props.fecha
  return exclusiones.value.find((e) =>
    !e.resuelta_en && e.fecha_inicio <= fecha && (!e.fecha_fin_estimada || e.fecha_fin_estimada >= fecha)
  ) || null
})

async function crearExclusionActual() {
  creandoExclusion.value = true
  try {
    await reporteEnergiaService.crearExclusion(props.fronteraId, {
      frontera_id: props.fronteraId,
      motivo: nuevaExclusionMotivo.value.trim(),
      fecha_inicio: props.fecha,
      fecha_fin_estimada: nuevaExclusionFechaFin.value ? nuevaExclusionFechaFin.value.toISOString().slice(0, 10) : null,
    })
    nuevaExclusionMotivo.value = ''
    nuevaExclusionFechaFin.value = null
    toast.success('Frontera excluida', { duration: 2500 })
    await cargarExclusiones()
  } catch (e) {
    toast.error('Error', { description: 'No se pudo crear la exclusión.', duration: 4000 })
  } finally {
    creandoExclusion.value = false
  }
}

async function resolverExclusionActual() {
  if (!exclusionActiva.value) return
  resolviendoExclusion.value = true
  try {
    await reporteEnergiaService.resolverExclusion(exclusionActiva.value.id)
    toast.success('Exclusión resuelta', { duration: 2500 })
    await cargarExclusiones()
  } catch (e) {
    toast.error('Error', { description: 'No se pudo resolver la exclusión.', duration: 4000 })
  } finally {
    resolviendoExclusion.value = false
  }
}

function iniciarEdicionExclusion() {
  if (!exclusionActiva.value) return
  nuevaExclusionMotivo.value = exclusionActiva.value.motivo
  nuevaExclusionFechaFin.value = exclusionActiva.value.fecha_fin_estimada
    ? new Date(exclusionActiva.value.fecha_fin_estimada + 'T00:00:00')
    : null
  editandoExclusion.value = true
}

async function guardarEdicionExclusion() {
  if (!exclusionActiva.value) return
  editandoExclusionGuardando.value = true
  try {
    await reporteEnergiaService.actualizarExclusion(exclusionActiva.value.id, {
      motivo: nuevaExclusionMotivo.value.trim(),
      fecha_fin_estimada: nuevaExclusionFechaFin.value ? nuevaExclusionFechaFin.value.toISOString().slice(0, 10) : null,
    })
    toast.success('Exclusión actualizada', { duration: 2500 })
    editandoExclusion.value = false
    nuevaExclusionMotivo.value = ''
    nuevaExclusionFechaFin.value = null
    await cargarExclusiones()
  } catch (e) {
    toast.error('Error', { description: 'No se pudo actualizar la exclusión.', duration: 4000 })
  } finally {
    editandoExclusionGuardando.value = false
  }
}

function fmtFechaHora(iso) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function cargar() {
  loading.value = true
  try {
    const data = await reporteEnergiaService.obtenerDetalle(props.fronteraId, props.fecha)
    detalle.value = data
    curvaEditable.value = [...(data.curva_final || Array(24).fill(null))]
    curvaRespaldoEditable.value = Array(24).fill(null)
    fuenteManualElegida.value = null
    cargarFallasActivas(data.proyecto_id)
  } catch (e) {
    toast.error('Error', { description: 'No se pudo cargar el detalle.', duration: 4000 })
  } finally {
    loading.value = false
  }
}

// Fallas activas del proyecto (módulo Gestión de Fallas) -- da contexto de
// por qué una frontera puede estar reportando con estimación/en falla sin
// tener que salir a buscarlo en otra vista.
const fallasActivas = ref([])

// Varias fallas del mismo tipo no aportan nada distinto en este resumen --
// se deja solo una por tipo. Pero "más reciente" a secas no basta: una
// CERRADA puede tener fecha más reciente que una ABIERTA del mismo tipo
// (ver "Problema en cadena fotovoltaico" 2026-08-21: la cerrada 11506 es
// más nueva que las abiertas 11406/11405, y con "más reciente sin más"
// tapaba las dos abiertas -- parecía que ya estaba resuelto cuando en
// realidad seguían sin resolver). Por eso una ABIERTA siempre gana sobre
// una CERRADA del mismo tipo, sin importar fecha; solo se muestra una
// cerrada si no hay ninguna abierta de ese tipo. Este panel es solo
// contexto rápido (con link "Ver todas" a Gestión de Fallas, la fuente de
// verdad completa), así que ocultar acá una segunda abierta del mismo
// tipo no pierde el dato, solo lo deja fuera de esta vista compacta.
// Depende de que /fallas ya venga ordenado por más reciente primero
// (created_at desc) -- dentro de "abiertas" o "cerradas", gana la primera
// vista (la más nueva de ese subgrupo).
function tipoKeyFalla(f) {
  return f.tipo?.id ?? f.tipo_libre ?? f.descripcion
}
function colapsarDuplicadas(items) {
  const elegidoPorTipo = new Map()
  for (const f of items) {
    const key = tipoKeyFalla(f)
    const actual = elegidoPorTipo.get(key)
    if (!actual) { elegidoPorTipo.set(key, f); continue }
    const actualAbierta = !actual.estado?.es_estado_final
    const estaAbierta = !f.estado?.es_estado_final
    if (estaAbierta && !actualAbierta) elegidoPorTipo.set(key, f)
  }
  const elegidos = new Set(elegidoPorTipo.values())
  return items.filter(f => elegidos.has(f))
}

async function cargarFallasActivas(proyectoId) {
  if (!proyectoId) { fallasActivas.value = []; return }
  try {
    // activa_en_fecha (no solo_activas): esta vista es el detalle de UN día
    // ya clasificado -- debe mostrar las fallas que estaban abiertas en ese
    // momento, no las que están abiertas hoy consultando en vivo.
    const data = await fallasService.listar({ proyecto_id: proyectoId, activa_en_fecha: props.fecha, size: 10 })
    fallasActivas.value = colapsarDuplicadas(data.items || [])
  } catch (e) {
    fallasActivas.value = []
  }
}
function prioColorFalla(codigo) { return colorPrioridad(codigo, '#9ca3af') }
function estadoPillStyleFalla(codigo) {
  const c = colorEstado(codigo)
  return { background: c + '1a', color: c, border: `1px solid ${c}40` }
}
async function cargarCurvaTipicaPreview() {
  curvaTipicaPreview.value = null
  try {
    curvaTipicaPreview.value = await reporteEnergiaService.obtenerCurvaTipica(props.fronteraId, props.fecha)
  } catch (e) {
    curvaTipicaPreview.value = null
  }
}
onMounted(() => { cargar(); cargarExclusiones(); cargarCurvaTipicaPreview() })
watch(() => [props.fronteraId, props.fecha], () => {
  cargar(); cargarExclusiones(); cargarCurvaTipicaPreview()
})

// Frontera de terceros (caso=0, ver FRONTERAS_TERCEROS en clasificador.py) --
// el Excel puede traer varios días; recargamos el detalle del día actual
// para reflejar si quedó incluido en la carga.
async function onArchivoExcelTercerosSeleccionado(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  subiendoExcelTerceros.value = true
  try {
    const data = await reporteEnergiaService.cargarExcelTerceros(props.fronteraId, file)
    toast.success('Excel cargado', {
      description: `Se cargaron ${data.fechas_cargadas.length} día(s): ${data.fechas_cargadas.join(', ')}`,
      duration: 4000,
    })
    await cargar()
    emit('actualizado')
  } catch (e) {
    toast.error('Error', {
      description: e?.data?.detail || 'No se pudo cargar el Excel.',
      duration: 5000,
    })
  } finally {
    subiendoExcelTerceros.value = false
  }
}

// Sin confirmación a propósito -- volver a cargar el archivo correcto ya
// sobrescribe (mismo endpoint hace upsert), así que esto es solo para el
// caso más raro de querer dejar el día vacío otra vez.
async function eliminarExcelTerceros() {
  eliminandoExcelTerceros.value = true
  try {
    await reporteEnergiaService.eliminarExcelTerceros(props.fronteraId, props.fecha)
    toast.success('Carga eliminada', { duration: 2500 })
    await cargar()
    emit('actualizado')
  } catch (e) {
    toast.error('Error', {
      description: e?.data?.detail || 'No se pudo eliminar la carga.',
      duration: 5000,
    })
  } finally {
    eliminandoExcelTerceros.value = false
  }
}

// Pegado tipo Excel: si lo pegado trae varios valores (columna o fila
// copiada), se distribuyen empezando en la celda donde se pegó -- un solo
// valor suelto no activa nada, se comporta como un input normal.
function onPasteHora(event, indiceInicio) {
  const texto = event.clipboardData?.getData('text') || ''
  const valores = texto.split(/[\n\t,]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n))
  if (valores.length <= 1) return
  event.preventDefault()
  valores.forEach((v, i) => {
    const idx = indiceInicio + i
    if (idx < 24) curvaEditable.value[idx] = v
  })
}

function limpiarCurva() {
  curvaEditable.value = Array(24).fill(null)
  curvaRespaldoEditable.value = Array(24).fill(null)
}

// Pegado tipo Excel para la columna Respaldo (mismo comportamiento que
// onPasteHora para Principal).
function onPasteHoraRespaldo(event, indiceInicio) {
  const texto = event.clipboardData?.getData('text') || ''
  const valores = texto.split(/[\n\t,]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n))
  if (valores.length <= 1) return
  event.preventDefault()
  valores.forEach((v, i) => {
    const idx = indiceInicio + i
    if (idx < 24) curvaRespaldoEditable.value[idx] = v
  })
}

// Placeholder de la columna Respaldo: la celda queda VACÍA a propósito
// (vacío = "no la toqué, calcúlala sola", ver guardarCurva) -- sin esto no
// había forma de ver en la tabla lo que ya se está reportando, solo en el
// gráfico. Solo dos opciones en el encabezado -- "Medidor" agrupa
// cualquier dato real (terceros, el medidor de respaldo detectado solo, o
// confirmado a mano). "Estimado ±1%" es la única otra opción.
const etiquetaOrigenRespaldo = computed(() => {
  const origen = detalle.value?.respaldo_reportado_origen
  if (origen === 'terceros' || origen === 'medidor' || origen === 'manual') return 'Medidor'
  if (origen === 'estimado') return 'Estimado ±1%'
  return 'sin calcular aún'
})

// Estimado (o sin calcular) es un número provisional, inventado por la
// fórmula -- tiene sentido que se vea como placeholder tenue. Los otros
// tres orígenes son dato real y definitivo que YA se está reportando --
// mostrarlo desvanecido como si fuera una sugerencia sería engañoso.
const respaldoEsDatoReal = computed(() => {
  const origen = detalle.value?.respaldo_reportado_origen
  return origen === 'terceros' || origen === 'medidor' || origen === 'manual'
})

function respaldoPlaceholder(h) {
  const v = detalle.value?.curva_respaldo_reportada?.[h]
  return v === null || v === undefined
    ? ''
    : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

function esHoraRellenada(h) {
  const d = detalle.value
  if (!d) return false
  return (d.horas_rellenadas_reconectador || []).includes(h)
    || (d.horas_rellenadas_solenium || []).includes(h)
    || (d.horas_rellenadas_historico || []).includes(h)
    || (d.horas_rellenadas_medidor_cruzado || []).includes(h)
}

// 'Validar Frontera' confirma el numero YA GUARDADO tal cual, sin tocar
// nada (a proposito, ver comentario en el template) -- pero si la persona
// eligio una fuente en 'Reportar con otra fuente' (o edito una celda) y le
// da a Validar SIN pasar por 'Guardar corrección' primero, ese cambio nunca
// llega al backend y queda validado el valor anterior sin que se note.
// Comparar contra curva_final (lo persistido) detecta ese caso y bloquea
// Validar hasta que se guarde.
const hayCambiosSinGuardar = computed(() => {
  const persistida = detalle.value?.curva_final || Array(24).fill(null)
  for (let h = 0; h < 24; h++) {
    const a = curvaEditable.value[h]
    const b = persistida[h]
    // 'sin dato' (null/undefined/'') y un cero explícito NO son lo mismo --
    // Number(a || 0) los volvía indistinguibles (Number(null || 0) ===
    // Number('0' || 0) === 0), así que editar una hora vacía poniéndole 0
    // no se detectaba como cambio y dejaba 'Validar Frontera' habilitado
    // sin haber guardado (ver Uruaco 2026-08-10).
    const aVacio = a === null || a === undefined || a === ''
    const bVacio = b === null || b === undefined
    if (aVacio !== bVacio) return true
    if (!aVacio && Number(a).toFixed(2) !== Number(b).toFixed(2)) return true
  }
  // Respaldo vacío por completo = no lo tocaron -- no cuenta como cambio
  // sin guardar (comparar contra curva_respaldo_reportada sería engañoso
  // igual, porque el estimado ±1% cambia solo de recalcularse).
  if (curvaRespaldoEditable.value.some((v) => v !== null && v !== undefined && v !== '')) {
    return true
  }
  return false
})

// Generación y Consumo -- se basa en lo YA PERSISTIDO (curva_final), no en
// curvaEditable, porque 'Rellenar horas' actúa sobre lo guardado en el
// backend -- por eso además se deshabilita con cambios sin guardar (mismo
// motivo que Validar).
const hayHuecosSinRellenar = computed(() => {
  const d = detalle.value
  if (!d) return false
  return (d.curva_final || []).some(v => v === null || v === undefined)
})

async function rellenarHorario() {
  rellenando.value = true
  try {
    const data = await reporteEnergiaService.rellenarHorario(props.fronteraId, props.fecha)
    detalle.value = data
    curvaEditable.value = [...(data.curva_final || Array(24).fill(null))]
    curvaRespaldoEditable.value = Array(24).fill(null)
    toast.success('Horas rellenadas', { duration: 2500 })
    emit('actualizado')
  } catch (e) {
    toast.error('No se pudo rellenar', {
      description: e?.data?.detail || 'Ninguna fuente tenía dato para las horas faltantes.',
      duration: 4000,
    })
  } finally {
    rellenando.value = false
  }
}

async function deshacerRelleno() {
  deshaciendoRelleno.value = true
  try {
    const data = await reporteEnergiaService.deshacerRelleno(props.fronteraId, props.fecha)
    detalle.value = data
    curvaEditable.value = [...(data.curva_final || Array(24).fill(null))]
    curvaRespaldoEditable.value = Array(24).fill(null)
    toast.success('Relleno deshecho', { duration: 2500 })
    emit('actualizado')
  } catch (e) {
    toast.error('No se pudo deshacer', {
      description: e?.data?.detail || 'No se pudo deshacer el relleno.',
      duration: 4000,
    })
  } finally {
    deshaciendoRelleno.value = false
  }
}

// Dispara a demanda la misma recuperación activa que la corrida diaria
// dispara sola bajo ciertas condiciones, pero para AMBOS medidores y sin
// ese filtro -- puede tardar hasta 90 segundos (interroga el medidor
// físico por WebSocket). No toca curva_final/medidor_usado/caso: solo
// refresca los datos de referencia para que el aviso de arriba y
// 'Reportar con otra fuente' reflejen el valor recuperado (2026-08-20).
async function recuperarMedidor() {
  recuperandoMedidor.value = true
  toast.info('Recuperando medidor', { description: 'Puede tardar hasta 90 segundos...', duration: 4000 })
  try {
    const data = await reporteEnergiaService.recuperarMedidor(props.fronteraId, props.fecha)
    detalle.value = data
    toast.success('Recuperación completada', {
      description: data.recuperacion_datos || 'Sin medidores para recuperar.',
      duration: 5000,
    })
  } catch (e) {
    toast.error('No se pudo recuperar', {
      description: e?.data?.detail || 'Falló la recuperación del medidor.',
      duration: 4000,
    })
  } finally {
    recuperandoMedidor.value = false
  }
}

// Botón "Usar" del banner de respaldo -- acción liviana (sin la
// interrogación activa de 90s de "Recuperar medidor", sin tocar
// Principal) para cuando el valor en vivo ya está disponible pasivamente
// en el propio banner. Adopta el snapshot SOLO si pasa la tolerancia de
// coherencia -- si no, el backend lo deja igual y el aviso sigue apareciendo.
const usandoRespaldoEnVivo = ref(false)
async function usarRespaldoEnVivo() {
  usandoRespaldoEnVivo.value = true
  try {
    const data = await reporteEnergiaService.revisarRespaldo(props.fronteraId, props.fecha)
    detalle.value = data
    if (data.respaldo_reportado_origen === 'medidor') {
      toast.success('Respaldo actualizado', { description: 'Se adoptó el valor real del medidor.', duration: 4000 })
    } else {
      toast.warning('Sigue en estimado', { description: 'El valor en vivo no quedó dentro de la tolerancia -- no se adoptó.', duration: 5000 })
    }
  } catch (e) {
    toast.error('No se pudo revisar', { description: e?.data?.detail || 'Falló la revisión del respaldo.', duration: 4000 })
  } finally {
    usandoRespaldoEnVivo.value = false
  }
}

// Mismo criterio que separa 'confiado' de 'corregido_automatico' en el
// resumen del día (ver reporte_energia.py) -- Caso 1 (Generación) / 'CGM'
// (Consumo) sin Revisar Manualmente es la única combinación 100% automática
// sin ninguna corrección de por medio. Todo lo demás (revisar_manualmente=
// True, o un Caso distinto de 1/CGM aunque haya quedado automático) sí pasó
// por alguna decisión del clasificador que quien revisa podría querer
// cambiar -- por eso el botón de 'Reportar con otra fuente' aparece ahí
// también, no solo cuando queda marcado para revisar.
const esCasoConfiado = computed(() => {
  const d = detalle.value
  if (!d) return true
  return !d.revisar_manualmente && (String(d.caso) === '1' || d.caso === 'CGM')
})

// Alternativas manuales para cuando quien revisa decide que el resultado
// automático no fue el correcto -- usan las mismas curvas que ya se cargan
// para 'Detalle de las fuentes' (medidor principal/respaldo/Solenium + fp),
// no piden nada nuevo al backend. 'Curva típica' es la excepción: ya vivía
// como su propio endpoint/botón, así que solo se reusa aquí.
//
// 'Inversores × FP' depende de 'd.fp' -- desde 2026-09-02 el backend lo
// calcula y persiste SIEMPRE (ver orquestador._upsert_generacion), no solo
// cuando el Caso ganador lo usó, así que esta opción se habilita solo con
// que 'd.curva_solenium' tenga dato real, sin importar el Caso (antes
// quedaba deshabilitada con Solenium completo si el Caso no necesitaba FP,
// ver GD Garza / Chiriguaná Norte 1). Que 'd.fp' tenga valor no dice si
// influyó en el número reportado hoy -- eso es 'fpUsadoHoy', usado solo
// para el resumen de arriba, no para esta lista.
const opcionesReportarCon = computed(() => {
  const d = detalle.value
  if (!d) return []
  const conFp = (curva) => (curva || []).map(v => (v == null || d.fp == null) ? null : v * d.fp)
  const suma = (curva) => {
    const vals = (curva || []).filter(v => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  }
  const curvaInversoresFp = conFp(d.curva_solenium)
  const tipica = curvaTipicaPreview.value
  // Cada medidor (principal/respaldo) chequea su PROPIO "¿Quoia ya cambió?"
  // -- independiente de cuál esté marcado medidor_usado (2026-08-20): si el
  // clasificador usó 'Histórico' porque el medidor estaba mal, y luego se
  // recupera ESE medidor, la opción "(actualizado)" tiene que poder
  // aparecer igual, no solo para el medidor que ganó el Caso.
  const opcionMedidor = (key, nombre, curvaPersistida) => {
    const actualizado = key === 'respaldo' ? d.respaldo_actualizado_en_quoia : d.principal_actualizado_en_quoia
    const curvaActual = key === 'respaldo' ? d.respaldo_curva_actual : d.principal_curva_actual
    const valorActual = key === 'respaldo' ? d.respaldo_energia_actual_kwh : d.principal_energia_actual_kwh
    if (actualizado && curvaActual != null) {
      return { key, nombre: `${nombre} (actualizado)`, curva: curvaActual, valor: valorActual }
    }
    return { key, nombre, curva: curvaPersistida, valor: suma(curvaPersistida), disabled: suma(curvaPersistida) == null }
  }
  return [
    {
      key: 'tipica', nombre: 'Curva típica (histórico)', curva: tipica?.curva,
      nota: tipica ? `mediana de ${tipica.dias_usados} días` : 'sin histórico suficiente',
      valor: tipica ? tipica.energia_total_kwh : null, disabled: !tipica,
    },
    opcionMedidor('principal', 'Medidor principal', d.curva_medidor_principal),
    opcionMedidor('respaldo', 'Medidor respaldo', d.curva_medidor_respaldo),
    { key: 'inversores', nombre: 'Inversores × FP', curva: curvaInversoresFp, valor: suma(curvaInversoresFp), disabled: suma(curvaInversoresFp) == null },
    { key: 'ceros', nombre: 'Matriz de ceros', curva: Array(24).fill(0), valor: 0 },
  ]
})

function elegirFuenteReportar(op) {
  mostrarMenuReportar.value = false
  curvaEditable.value = [...op.curva]
  // Respaldo siempre queda vacío acá, sin importar la opción elegida -- NO
  // se precarga con curva_medidor_respaldo aunque se elija 'Medidor
  // principal', porque eso mandaría el dato del medidor de respaldo como
  // confirmación manual SIN el chequeo de coherencia (1.5 kWh vs el nuevo
  // Principal) que sí aplica actualizar_respaldo_final() en el backend al
  // guardar -- adoptar 'Medidor principal' no implica que el de respaldo
  // sea confiable ese día (bug real 2026-08-25: se estaba precargando a
  // ciegas). Dejarlo vacío deja que el backend decida solo con el mismo
  // criterio de siempre.
  curvaRespaldoEditable.value = Array(24).fill(null)
  fuenteManualElegida.value = op.key === 'tipica' ? 'historico' : op.key
  toast.info(`${op.nombre} aplicado`, {
    description: `${fmtKwh(op.valor)} -- revisa y guarda si está bien.`,
    duration: 4000,
  })
}

// Las celdas son InputText (texto libre, no InputNumber) para que el cursor
// no salte al editar un dígito del medio -- así que acá pueden llegar
// strings ("45.6"), vacías (""), o numeros ya normales (paste, carga
// inicial). Se normaliza a float | null justo antes de enviar.
function _normalizarCurva(valores) {
  return valores.map(v => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  })
}

async function guardarCurva() {
  guardando.value = true
  try {
    const payload = {
      curva_final: _normalizarCurva(curvaEditable.value),
      fuente: fuenteManualElegida.value,
    }
    // Columna de Respaldo vacía por completo = no la tocaron -> no se manda
    // (el backend la recalcula sola). Al menos un valor = confirmación
    // manual, se manda tal cual (incluidas las horas que sí quedaron vacías).
    if (curvaRespaldoEditable.value.some((v) => v !== null && v !== undefined && v !== '')) {
      payload.curva_respaldo_final = _normalizarCurva(curvaRespaldoEditable.value)
    }
    const data = await reporteEnergiaService.guardarCurva(props.fronteraId, props.fecha, payload)
    detalle.value = data
    curvaRespaldoEditable.value = Array(24).fill(null)
    toast.success('Corrección guardada', { duration: 2500 })
    emit('actualizado')
  } catch (e) {
    toast.error('Error', { description: 'No se pudo guardar la corrección.', duration: 4000 })
  } finally {
    guardando.value = false
  }
}

async function validar() {
  validando.value = true
  try {
    await reporteEnergiaService.validar(props.fronteraId, props.fecha)
    detalle.value.revisar_manualmente = false
    toast.success('Validado', { duration: 2000 })
    emit('actualizado')
  } catch (e) {
    toast.error('Error', { description: 'No se pudo validar.', duration: 4000 })
  } finally {
    validando.value = false
  }
}

// Nombre + descripcion de cada Caso, para no obligar a memorizar el arbol
// de decision del clasificador (ver app/services/reporte_energia/clasificador.py
// y clasificador_consumo.py en el backend).
const CASO_INFO_GENERACION = {
  // '0' no tiene una sola descripcion fija -- ver casoInfo0() abajo.
  '0': { nombre: 'Reporta a otra empresa', descripcion: 'Frontera de terceros, fuera de este árbol de decisión' },
  '1': { nombre: 'Reporte CGM válido', descripcion: 'El envío automático de Quoia al ASIC fue válido hoy y coincide con los inversores' },
  '2': { nombre: 'Medidor valida', descripcion: 'El reporte automático no fue válido, pero un medidor coincide con los inversores' },
  // '3' tampoco tiene una sola descripcion fija -- ver casoInfo3() abajo.
  '4': { nombre: 'Medidor de mayor valor', descripcion: 'Los medidores registran más energía que los inversores; se usa el de mayor valor' },
  // '5' no tiene una sola descripcion fija -- el arbol real (clasificador.py)
  // tiene 4 caminos distintos que todos terminan en el mismo numero de Caso
  // (CGM ya valido sin inversores completos para cruzar, inversores parciales
  // x FP, reconectador, o medidor sin inversores). Ver casoInfo5() abajo.
  '6': { nombre: 'Apagado', descripcion: 'Ninguna fuente -- CGM, medidor, inversores ni reconectador -- registra generación hoy' },
  '7': { nombre: 'Reconstruido con reconectador o crudos', descripcion: 'Sin reporte automático ni medidor; se reconstruye con reconectador, Solenium (power) o datos crudos completos' },
  '8': { nombre: 'Datos crudos parciales', descripcion: 'Datos crudos incompletos; se rellenan las horas faltantes con reconectador, Solenium o histórico' },
  '-1': { nombre: 'Error de clasificación', descripcion: 'El clasificador falló para esta frontera' },
  '-2': { nombre: 'Excluida temporalmente', descripcion: '' },
}
const CASO_INFO_CONSUMO = {
  'CGM': { nombre: 'Reporte válido', descripcion: 'El reporte automático fue válido y el canal CGM trae dato real' },
  // 'Medidor' tampoco tiene una sola descripcion fija -- ver casoInfoMedidorConsumo() abajo.
  'Histórico': { nombre: 'Histórico propio', descripcion: 'Ni CGM ni medidor creíbles; se usa la mediana y forma horaria del histórico' },
  'Sin dato': { nombre: 'Sin dato', descripcion: 'Ninguna fuente disponible para este día' },
  'Error': { nombre: 'Error de clasificación', descripcion: 'El clasificador falló para esta frontera' },
  'Excluida': { nombre: 'Excluida temporalmente', descripcion: '' },
}
// Caso 3 (Generación) junta 2 resultados muy distintos bajo el mismo numero:
// medidor_usado='revisar' significa que no habia Factor de Perdida
// disponible -- energia_final_kwh queda en None y la curva vacia, no se
// corrigio nada (ver clasificador.py lineas 122 y 185, dos rutas de codigo
// distintas que llegan a lo mismo). medidor_usado='inversores' es el caso
// normal, con curva real corregida por FP.
function casoInfo0(d) {
  if (d.medidor_usado === 'excel_terceros') {
    return { nombre: 'Cargado desde Excel de terceros', descripcion: 'El CGM de esta frontera lo maneja otra empresa; se reportó con el Excel que subieron para este día' }
  }
  return { nombre: 'Esperando Excel de terceros', descripcion: 'El CGM de esta frontera lo maneja otra empresa; falta subir su Excel para este día' }
}
// medidor_usado='revisar' junta 2 caminos reales del clasificador
// (clasificador.py:137-141 y :216-219) que no se distinguen entre sí --
// solenium_completo sí los diferencia: es False solo en el segundo (por eso
// e_inv se trató como incompleto y se cayó a esa rama, ver :349-353).
function casoInfo3(d) {
  // 'relleno_horario': _decidir_caso() no encontró ninguna fuente y devolvió
  // curva vacía, pero el relleno horario centralizado (después, con
  // reconectador/Solenium×FP/histórico) sí logró llenar horas -- ver
  // clasificador.py, comentario sobre Granja Solar Uruaco 2026-08-03.
  if (d.medidor_usado === 'relleno_horario') {
    return { nombre: 'Reconstruido con relleno horario', descripcion: 'Sin inversores completos, CGM ni medidor ese día -- se reconstruyó hora por hora con reconectador, Solenium × Factor de Pérdida o histórico (ver abajo qué horas)' }
  }
  if (d.medidor_usado === 'revisar') {
    if (d.solenium_completo === false) {
      return { nombre: 'Inversores parciales, sin más fuentes', descripcion: 'Los inversores solo reportaron parcial ese día y ni CGM ni el medidor tienen dato -- no se pudo construir ninguna curva automática' }
    }
    return { nombre: 'Sin Factor de Pérdida disponible', descripcion: 'Los medidores registran menos energía que los inversores, pero no hay suficiente histórico para calcular el Factor de Pérdida -- no se pudo generar ninguna curva automática' }
  }
  return { nombre: 'Inversores × Factor de Pérdida', descripcion: 'Los medidores registran menos energía que los inversores; se corrige con el histórico de pérdida' }
}

// 'Medidor' (Consumo) junta el mismo tipo de conflacion que Caso 3/5 de
// Generación. medidor_usado='revisar' es un valor heredado -- ya no lo
// produce el clasificador actual, pero sigue vivo en filas viejas de la BD
// clasificadas antes de este fix (energia_final_kwh en None, no se validó
// nada). 'principal_sin_historico'/'respaldo_sin_historico' es el camino
// vigente: sin mediana con qué comparar, se usa el dato disponible del
// medidor esté completo o no (antes se vaciaba la curva entera por un
// hueco parcial, ver GD Polaris 2 Consumo 2026-08-03).
function casoInfoMedidorConsumo(d) {
  if (d.medidor_usado === 'revisar') {
    return { nombre: 'Sin histórico para comparar', descripcion: 'CGM no válido; hay medidor con dato, pero no hay suficiente histórico para calcular su mediana -- no se pudo validar ni generar curva automática' }
  }
  if (d.medidor_usado === 'principal_sin_historico' || d.medidor_usado === 'respaldo_sin_historico') {
    return { nombre: 'Medidor sin histórico para validar', descripcion: 'CGM no válido; el medidor tiene dato pero no hay mediana histórica para confirmar que el nivel es correcto -- se reporta con lo disponible, revisar a mano' }
  }
  return { nombre: 'Medidor valida contra histórico', descripcion: 'CGM no válido; el medidor se comparó contra su propia mediana histórica' }
}

// Caso 5 (Generación) junta 4 caminos reales del clasificador bajo un mismo
// numero -- distinguirlos por medidor_usado, que sí refleja cuál se tomó:
//  - 'cgm': el reporte CGM ya era válido; el único motivo de no quedar en
//    Caso 1 es que Solenium no tenía dato completo para cruzar ese día
//    (o de plano no hay inversores registrados -- nota_solenium lo dice).
//  - 'inversores': CGM no válido y medidor caído; se usa el total parcial
//    de inversores corregido con el Factor de Pérdida.
//  - 'reconectador': CGM no válido, medidor caído y sin FP; se reconstruye
//    con el reconectador.
//  - 'principal' / 'respaldo': el caso "clásico" -- sí hay medidor con
//    dato, de verdad no hay inversores contra qué validarlo.
function casoInfo5(d) {
  if (d.medidor_usado === 'cgm') {
    if (d.nota_solenium) {
      return { nombre: 'Sin inversores registrados', descripcion: 'El reporte CGM fue válido; el proyecto no tiene inversores registrados en SolarView' }
    }
    // Solenium incompleto no significa "no se pudo usar" -- si SÍ se
    // comparó contra las horas que reportó (error_final_pct presente), la
    // descripción vieja decía lo contrario de lo que en realidad pasó (ver
    // Minigranja 0018 La Paz Leyenda 2026-08-10: 1,53% de diferencia, sí se
    // cruzó y coincidió).
    if (d.error_final_pct != null) {
      return {
        nombre: 'CGM válido, Solenium incompleto',
        descripcion: `El reporte CGM ya era válido; se comparó contra los inversores en las horas que sí reportaron ese día (${Math.abs(d.error_final_pct).toFixed(1)}% de diferencia)`,
      }
    }
    return { nombre: 'CGM válido, Solenium incompleto', descripcion: 'El reporte CGM ya era válido; los inversores no reportaron nada ese día, no hubo con qué cruzar' }
  }
  if (d.medidor_usado === 'inversores') {
    return { nombre: 'Inversores parciales × Factor de Pérdida', descripcion: 'CGM no válido y el medidor está caído; se usa el total parcial de inversores corregido con el histórico de pérdida' }
  }
  if (d.medidor_usado === 'reconectador') {
    return { nombre: 'Reconstruido con reconectador', descripcion: 'CGM no válido, el medidor está caído y Solenium no tiene dato completo; se reconstruye con el reconectador' }
  }
  if (d.medidor_usado === 'principal_sin_cgm' || d.medidor_usado === 'respaldo_sin_cgm') {
    if (d.error_final_pct != null) {
      return {
        nombre: 'Medidor sin CGM, validado contra inversores',
        descripcion: `CGM no reportó nada ese día; se usa el medidor directo, comparado contra los inversores en las horas que sí reportaron (${Math.abs(d.error_final_pct).toFixed(1)}% de diferencia)`,
      }
    }
    return { nombre: 'Medidor sin CGM ni inversores', descripcion: 'CGM no reportó nada ese día y no hay inversores con qué comparar; se usa el medidor directo' }
  }
  return { nombre: 'Sin inversores registrados', descripcion: 'Hay medidor con dato, pero el proyecto no tiene inversores en SolarView contra qué validarlo' }
}
// 'fp' ahora se calcula y persiste SIEMPRE en el backend (no solo cuando el
// Caso ganador lo usó para 'energia_final_kwh'), para que 'Reportar con
// otra fuente' pueda ofrecer "Inversores × FP" sin importar el Caso del día
// (ver opcionesReportarCon abajo). Que 'fp' tenga valor ya NO implica que
// influyó en el número reportado hoy -- este computed es la señal de eso:
// 'medidor_usado' === 'inversores' cubre Caso 3 y los fallbacks de
// inversores×FP (Caso 5 con Solenium parcial); 'horas_rellenadas_solenium'
// cubre el relleno horario parcial, que puede usar FP para algunas horas
// sin que 'medidor_usado' del día cambie (2026-09-02).
const fpUsadoHoy = computed(() => {
  const d = detalle.value
  if (!d) return false
  return d.medidor_usado === 'inversores' || (d.horas_rellenadas_solenium || []).length > 0
})
const casoInfo = computed(() => {
  const d = detalle.value
  if (!d) return { nombre: '', descripcion: '' }
  if (d.tipo === 'generacion' && String(d.caso) === '0') return casoInfo0(d)
  if (d.tipo === 'generacion' && String(d.caso) === '3') return casoInfo3(d)
  if (d.tipo === 'generacion' && String(d.caso) === '5') return casoInfo5(d)
  if (d.tipo === 'consumo' && String(d.caso) === 'Medidor') return casoInfoMedidorConsumo(d)
  const mapa = d.tipo === 'generacion' ? CASO_INFO_GENERACION : CASO_INFO_CONSUMO
  return mapa[String(d.caso)] || { nombre: `Caso ${d.caso}`, descripcion: '' }
})
const casoColor = computed(() => {
  const d = detalle.value
  if (!d) return { bg: '#f9f7ff', fg: '#9b89b5' }
  if (d.revisar_manualmente) return { bg: 'rgba(199,119,0,0.1)', fg: '#A8590B' }
  const casosOk = d.tipo === 'generacion' ? ['1', '2'] : ['CGM']
  if (casosOk.includes(String(d.caso))) return { bg: 'rgba(16,185,129,0.1)', fg: '#10B981' }
  return { bg: '#f9f7ff', fg: '#6b5a8a' }
})

// Suma una curva de 24h solo si trae al menos un valor real -- distingue
// "0 kWh real" (curva con datos, todos en 0) de "sin lectura en absoluto"
// (curva null o completamente vacía).
function sumaCurva(arr) {
  if (!arr || !arr.some((v) => v !== null && v !== undefined)) return null
  return arr.reduce((s, v) => s + (Number(v) || 0), 0)
}

// 0-2 avisos, uno por cada medidor (principal/respaldo) cuyo valor EN VIVO
// ya difiere del que quedó guardado al clasificar -- por medidor, no solo
// el que ganó medidor_usado (2026-08-20), para que recuperar un medidor
// que el clasificador no usó también se note. `clasificacion` es el total
// TAL COMO QUEDÓ AL CLASIFICAR -- distinto de energia_final_kwh, que puede
// ya haber sido corregido a mano con el valor en vivo (ver 'Reportar con
// otra fuente' -> 'Medidor X (actualizado)'); si no, la comparación se
// vuelve redundante contra sí misma justo después de aplicar esa corrección.
// La gráfica grafica curva_medidor_principal, con fallback a respaldo si el
// principal no existe (ver :medidor más arriba) -- la etiqueta "Medidor" a
// secas era ambigua, no dejaba claro cuál de los dos es (pedido 2026-08-20).
const medidorGraficadoLabel = computed(() => {
  const d = detalle.value
  if (!d) return 'Medidor'
  if (d.curva_medidor_principal) return 'Medidor principal'
  if (d.curva_medidor_respaldo) return 'Medidor respaldo'
  return 'Medidor'
})

// Mediana histórica de la frontera, con los días que la sostienen -- es el
// criterio contra el que el clasificador compara el día para decidir la marca
// de revisión en Consumo, así que tenerlo acá evita abrir "Curva Típica" solo
// para leerlo de paso (2026-09-02). Se muestra el número y nada más: el
// desvío del día contra él se calcula solo mirando los dos valores, y el
// panel ya trae el total del día al lado (decisión de Sara, 2026-09-03).
const medianaHistorica = computed(() => {
  const d = detalle.value
  const mediana = d?.mediana_historica_kwh
  if (!d || mediana == null || mediana <= 0) return null
  return { mediana, dias: d.dias_historial ?? null }
})

const avisosMedidor = computed(() => {
  const d = detalle.value
  if (!d) return []
  const avisos = []
  if (d.principal_actualizado_en_quoia) {
    avisos.push({ tipo: 'principal', etiqueta: 'Medidor principal', actual: d.principal_energia_actual_kwh, clasificacion: sumaCurva(d.curva_medidor_principal) })
  }
  if (d.respaldo_actualizado_en_quoia) {
    avisos.push({ tipo: 'respaldo', etiqueta: 'Medidor respaldo', actual: d.respaldo_energia_actual_kwh, clasificacion: sumaCurva(d.curva_medidor_respaldo) })
  }
  return avisos
})
// Comprime horas en rangos legibles: [0,1,2,3,19,20] -> "0-3h, 19-20h".
function formatearRangosHoras(horas) {
  if (!horas.length) return ''
  const rangos = []
  let inicio = horas[0], fin = horas[0]
  for (let i = 1; i <= horas.length; i++) {
    if (i < horas.length && horas[i] === fin + 1) {
      fin = horas[i]
    } else {
      rangos.push(inicio === fin ? `${inicio}h` : `${inicio}-${fin}h`)
      if (i < horas.length) { inicio = horas[i]; fin = horas[i] }
    }
  }
  return rangos.join(', ')
}
function horasFaltantes(arr) {
  if (!arr) return []
  const faltan = []
  for (let h = 0; h < 24; h++) {
    if (arr[h] === null || arr[h] === undefined) faltan.push(h)
  }
  return faltan
}
// Mismo criterio que HORAS_SOLARES en utils.py (backend) -- de noche no hay
// generacion posible, asi que un hueco ahi no es información útil para el
// usuario. Sin este filtro, 'Dato incompleto' mostraba TODAS las horas sin
// dato (ej. 0h-7h) cuando lo que de verdad importaba eran solo 2 (6h-7h).
const HORAS_SOLARES_FRONT = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
function horasFaltantesSolares(arr) {
  const faltan = horasFaltantes(arr)
  const enVentana = faltan.filter(h => HORAS_SOLARES_FRONT.has(h))
  // Si por algún motivo las horas sin dato caen TODAS fuera de la ventana
  // (ej. dejó de reportar justo a las 17h -- 'faltan' 18h-23h, ninguna
  // dentro de la ventana), mejor mostrar la lista completa que un texto
  // vacío después de 'faltan'.
  return enVentana.length ? enVentana : faltan
}
function fuenteIconStyle(estado) {
  if (estado === 'ok') return { background: 'rgba(16,185,129,0.1)', color: '#10B981' }
  if (estado === 'na') return { background: '#f9f7ff', color: '#9b89b5' }
  if (estado === 'error') return { background: 'rgba(240,192,64,0.15)', color: '#A8590B' }
  return { background: 'rgba(214,68,85,0.08)', color: '#D64455' }
}
// Agrupa el estado tecnico de Quoia en dos categorias que no requieren
// conocer el detalle interno: OK/WARNING son parte del flujo automatico
// normal (se confia en el dato); cualquier ERROR/ERRORn es una falla real
// del envio automatico ese dia.
function categoriaEstadoReporte(estado) {
  if (!estado) return null
  if (estado === 'OK' || estado === 'WARNING') return 'ok'
  return 'error'
}
const fuentes = computed(() => {
  const d = detalle.value
  if (!d) return []
  const lista = []

  // energia_cgm_kwh nunca es null (el backend lo deja en 0 por defecto,
  // haya o no reporte real) -- la señal real de "hubo respuesta de Quoia"
  // es estado_reporte, no la energía.
  const catCgm = categoriaEstadoReporte(d.estado_reporte)
  lista.push({
    clave: 'cgm', nombre: 'Reporte CGM (Quoia)',
    estado: catCgm === 'ok' ? 'ok' : (catCgm === 'error' ? 'error' : 'no'),
    detalle: catCgm === 'ok' ? 'Automático' : (catCgm === 'error' ? 'Error' : 'Sin dato para hoy'),
    valor: d.estado_reporte ? d.energia_cgm_kwh : null,
    usado: d.medidor_usado === 'cgm',
  })

  // 'Detalle de las fuentes' muestra SIEMPRE lo persistido al clasificar --
  // lo que de verdad informa 'Energía Total' de hoy -- sin importar si
  // Quoia ya cambió el valor en vivo (eso es el aviso azul de arriba, y la
  // opción "(actualizado)" en 'Reportar con otra fuente'; mezclarlo acá
  // hacía parecer que el valor actualizado YA era el reportado, sin que la
  // persona lo hubiera elegido -- ver Detalle de las fuentes 2026-08-12).
  lista.push({
    clave: 'principal', nombre: 'Medidor principal',
    estado: sumaCurva(d.curva_medidor_principal) !== null ? 'ok' : 'no',
    detalle: sumaCurva(d.curva_medidor_principal) !== null ? 'Lectura disponible' : 'Sin lectura',
    valor: sumaCurva(d.curva_medidor_principal),
    usado: d.medidor_usado === 'principal',
  })

  lista.push({
    clave: 'respaldo', nombre: 'Medidor respaldo',
    estado: sumaCurva(d.curva_medidor_respaldo) !== null ? 'ok' : 'no',
    detalle: sumaCurva(d.curva_medidor_respaldo) !== null ? 'Lectura disponible' : 'Sin lectura',
    valor: sumaCurva(d.curva_medidor_respaldo),
    usado: d.medidor_usado === 'respaldo',
  })

  if (d.tipo === 'generacion') {
    // energia_solenium_kwh tampoco es nunca null (mismo patron que CGM --
    // el backend lo deja en 0 por defecto si Solenium no respondio nada). La
    // señal confiable de "¿hubo alguna lectura real?" es la curva de
    // referencia (curva_solenium): si esta vacia, no hubo respuesta real,
    // sin importar lo que diga el total.
    const sinRegistro = !!d.nota_solenium
    const sumaSolenium = sumaCurva(d.curva_solenium)
    lista.push({
      clave: 'inversores', nombre: 'Inversores (Solenium)',
      estado: sinRegistro ? 'na' : (sumaSolenium !== null ? 'ok' : 'no'),
      detalle: sinRegistro
        ? d.nota_solenium
        : (sumaSolenium !== null
            ? (d.solenium_completo
                ? 'Dato completo'
                : `Dato incompleto -- faltan ${formatearRangosHoras(horasFaltantesSolares(d.curva_solenium))}`)
            : 'Solenium respondió sin dato para esta fecha'),
      // Se muestra la suma de la curva EN VIVO (misma fuente que el icono y
      // que la grafica de arriba), no energia_solenium_kwh -- ese es el total
      // que quedo guardado al momento de la clasificacion, y puede no
      // coincidir con lo que Solenium responde ahora mismo (ej. si esa vez
      // fallo la consulta y quedo en 0, aunque la curva de referencia si
      // tenga datos reales hoy).
      valor: sinRegistro ? null : sumaSolenium,
      usado: d.medidor_usado === 'inversores',
    })

    // Mismo patrón que Inversores -- si hay dato se muestra (total + qué
    // horas faltan si está incompleto), si no hay dato no se muestra nada
    // alarmante, solo 'na'. El backend lo consulta y persiste SIEMPRE en
    // la clasificación diaria (igual que medidor/Solenium, ver
    // clasificador.clasificar_generacion), así que null acá significa que
    // el proyecto no tiene reconectador instalado o la consulta falló ese
    // día -- no que "no hizo falta revisarlo" (pedido 2026-08-21).
    const sumaReconectador = sumaCurva(d.curva_reconectador)
    lista.push({
      clave: 'reconectador', nombre: 'Reconectador',
      estado: sumaReconectador !== null ? 'ok' : 'na',
      detalle: sumaReconectador !== null
        ? (horasFaltantesSolares(d.curva_reconectador).length
            ? `Dato incompleto -- faltan ${formatearRangosHoras(horasFaltantesSolares(d.curva_reconectador))}`
            : 'Dato completo')
        : 'Sin dato del reconectador',
      valor: sumaReconectador,
      usado: d.medidor_usado === 'reconectador',
    })
  }

  return lista
})

const ETIQUETAS_FUENTE = {
  cgm: 'CGM', principal: 'Medidor principal', respaldo: 'Medidor respaldo',
  inversores: 'Inversores × FP', crudos: 'Datos crudos', crudos_parcial: 'Datos crudos (parcial)',
  reconectador: 'Reconectador', solenium_power: 'Solenium (power)', ninguno: 'Apagado',
  revisar: 'Sin fuente', relleno_horario: 'Relleno horario',
  externo: 'Reporta otra empresa', historico: 'Histórico propio',
  historico_vecino: 'Histórico (vecino de predio)',
  principal_sin_historico: 'Medidor principal', respaldo_sin_historico: 'Medidor respaldo',
  principal_sin_cgm: 'Medidor principal', respaldo_sin_cgm: 'Medidor respaldo',
  excluida: 'Excluida', excel_terceros: 'Excel de terceros', editado_manualmente: 'Editado manualmente',
}
function hayHorasRelleno(d) {
  return !!(d && (
    (d.horas_rellenadas_medidor_cruzado || []).length ||
    (d.horas_rellenadas_reconectador || []).length ||
    (d.horas_rellenadas_solenium || []).length ||
    (d.horas_rellenadas_historico || []).length
  ))
}

function etiquetaFuente(v, d) {
  if (v === 'relleno_horario' && d) {
    // El label generico no decia CUAL de las fuentes de relleno se usó de
    // verdad -- ver MGS 0022 La Cumbia 2026-08-05, donde solo entró el
    // reconectador pero el texto sugería que podían ser todas.
    const partes = []
    if ((d.horas_rellenadas_medidor_cruzado || []).length) partes.push('medidor cruzado')
    if ((d.horas_rellenadas_reconectador || []).length) partes.push('reconectador')
    if ((d.horas_rellenadas_solenium || []).length) partes.push('Solenium × FP')
    if ((d.horas_rellenadas_historico || []).length) partes.push('histórico')
    if (partes.length) return `Relleno horario (${partes.join(' + ')})`
  }
  const base = ETIQUETAS_FUENTE[v] || v || '—'
  // Cuando el medidor SÍ tenía fuente propia (principal/respaldo/cgm/...) y
  // solo se completó un hueco puntual con otra fuente, medidor_usado no
  // cambia -- sin este aviso, "Fuente usada" no daba ninguna pista de que
  // hay que revisar las filas "Horas rellenadas (...)" más abajo.
  return hayHorasRelleno(d) ? `${base} (Horas rellenadas)` : base
}
function fmtKwh(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kWh'
}
</script>

<style scoped>
.falla-activa-row:hover { background: #faf9fc; }

/* Tabla vertical estilo Excel (Hora | kWh) -- dos columnas de 12 horas cada
   una, lado a lado, para no obligar a un scroll larguísimo de 24 filas. */
.tabla-horas {
  border-collapse: collapse;
}
.tabla-horas th, .tabla-horas td {
  border: 1px solid #e8e0f0;
  padding: 0;
}
.tabla-horas th {
  background: #f9f7ff;
  color: #6b5a8a;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
}
.tabla-horas td:first-child {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  padding: 0 10px;
  white-space: nowrap;
  background: #f9f7ff;
}
.tabla-horas tr.fila-rellenada td:last-child { background: rgba(240, 192, 64, 0.14); }
:deep(.celda-input) {
  width: 110px;
  height: 32px;
  border: none !important;
  background: transparent !important;
}
:deep(.celda-input:focus) {
  outline: 2px solid var(--color-unergy-purple);
  outline-offset: -2px;
}
/* Respaldo con dato real (Medidor) -- el placeholder se ve como texto
   normal, no como la pista tenue de siempre, porque no es una sugerencia:
   es el valor real que ya se está reportando (ver respaldoEsDatoReal). El
   caso 'Estimado ±1%' se queda con el gris tenue por defecto del navegador,
   ahí sí es un número provisional. */
:deep(.celda-respaldo-real::placeholder) {
  color: #2c2039;
  opacity: 1;
}
</style>
