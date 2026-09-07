<template>
  <Teleport to="body">
    <Transition name="fdsheet">
      <div v-if="open && fa" class="fd-backdrop" @click.self="close">
        <div class="fd-sheet">
          <div class="fd-grab" />

          <!-- Header -->
          <div class="fd-header">
            <div class="fd-head-text">
              <code class="fd-code">{{ fa.codigo_interno }}</code>
              <span class="fd-type">{{ titulo }}</span>
            </div>
            <span v-if="saving" class="fd-saving"><LoaderCircleIcon class="size-[1em] animate-spin" /></span>
            <button class="fd-close" @click="close"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="fd-body">
            <p class="fd-desc">{{ fa.descripcion }}</p>

            <!-- Clasificación (metodología estructurada) -->
            <div v-if="clasif" class="fd-clasif">
              <div class="fd-clasif-head">
                <span class="fd-clasif-cat" :style="{ background: clasif.categoriaColor + '1a', color: clasif.categoriaColor }">
                  <component :is="clasif.icono" class="size-[1em]" /> {{ clasif.categoriaEtiqueta }}
                </span>
                <span v-if="clasif.subtitulo" class="fd-clasif-sub">{{ clasif.subtitulo }}</span>
                <span v-if="clasif.pendienteReclasificar" class="fd-clasif-pend">Pendiente reclasificar</span>
              </div>

              <p v-if="clasif.detalle" class="fd-clasif-detalle">{{ clasif.detalle }}</p>

              <!-- Frontera -->
              <div v-if="clasif.frontera" class="fd-clasif-flags">
                <span :class="['fd-flag', clasif.frontera.afectaMedicion ? 'fd-flag--bad' : 'fd-flag--ok']">
                  {{ clasif.frontera.afectaMedicion ? 'Afecta medición' : 'No afecta medición' }}
                </span>
                <span :class="['fd-flag', clasif.frontera.perdidaComunicacion ? 'fd-flag--warn' : 'fd-flag--ok']">
                  {{ clasif.frontera.perdidaComunicacion ? 'Pérdida de comunicación' : 'Comunicación OK' }}
                </span>
              </div>

              <!-- Inversores afectados -->
              <div v-if="clasif.inversores.length" class="fd-inv-list">
                <div v-for="(inv, idx) in clasif.inversores" :key="idx" class="fd-inv">
                  <div class="fd-inv-top">
                    <ServerIcon class="size-[1em]" />
                    <b>{{ inv.nombre }}</b>
                    <span v-if="inv.potenciaKw != null" class="fd-inv-pot">{{ inv.potenciaKw }} kW</span>
                  </div>
                  <div v-if="inv.tipos.length" class="fd-inv-tipos">
                    <span v-for="(t, ti) in inv.tipos" :key="ti" class="fd-inv-tag">{{ t }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Estado -->
            <div class="fd-field">
              <span class="fd-label">Estado</span>
              <div class="fd-chips">
                <button v-for="e in catalogos.estados" :key="e.id" type="button"
                  :class="['fd-chip', fa.estado?.id === e.id && 'fd-chip--on']"
                  :style="fa.estado?.id === e.id ? chipOn(colorEstado(e.codigo)) : {}"
                  @click="cambiar({ estado_id: e.id })">{{ e.etiqueta }}</button>
              </div>
            </div>

            <!-- Prioridad -->
            <div class="fd-field">
              <span class="fd-label">Prioridad</span>
              <div class="fd-chips">
                <button v-for="p in catalogos.prioridades" :key="p.id" type="button"
                  :class="['fd-chip', fa.prioridad?.id === p.id && 'fd-chip--on']"
                  :style="fa.prioridad?.id === p.id ? chipOn(colorPrioridad(p.codigo)) : {}"
                  @click="cambiar({ prioridad_id: p.id })">{{ p.etiqueta }}</button>
              </div>
            </div>

            <!-- Datos -->
            <div class="fd-facts">
              <div class="fd-fact"><span>Proyecto</span><b>{{ fa.proyecto?.nombre_comercial || '—' }}</b></div>
              <div class="fd-fact"><span>Identificada</span><b>{{ fmtFecha(fa.fecha_identificacion) }}</b></div>
              <div class="fd-fact"><span>Registró</span><b>{{ fa.registrado_por?.nombre || '—' }}</b></div>
              <div v-if="fa.fecha_resolucion" class="fd-fact"><span>Resuelta</span><b class="fd-ok">{{ fmtFecha(fa.fecha_resolucion?.slice?.(0,10) || fa.fecha_resolucion) }}</b></div>
              <div v-if="fa.kwh_perdidos_estimado != null" class="fd-fact"><span>Energía perdida</span><b class="fd-bad">{{ Number(fa.kwh_perdidos_estimado).toLocaleString('es-CO') }} kWh</b></div>
            </div>

            <!-- Causa raíz / acciones -->
            <div v-if="fa.causa_raiz" class="fd-block"><span class="fd-label">Causa raíz</span><p>{{ fa.causa_raiz }}</p></div>
            <div v-if="fa.acciones_correctivas" class="fd-block"><span class="fd-label">Acciones correctivas</span><p>{{ fa.acciones_correctivas }}</p></div>

            <!-- Seguimientos -->
            <div class="fd-segs">
              <span class="fd-label">Seguimiento ({{ fa.seguimientos?.length || 0 }})</span>
              <div class="fd-add">
                <textarea v-model="nota" rows="2" class="fd-textarea" placeholder="Agregar nota…"></textarea>
                <div class="fd-add-row">
                  <select v-model="notaEstadoId" class="fd-select fd-select--sm">
                    <option :value="null">Sin cambiar estado</option>
                    <option v-for="e in catalogos.estados" :key="e.id" :value="e.id">→ {{ e.etiqueta }}</option>
                  </select>
                  <button class="fd-send" :disabled="addingSeg || (!nota.trim() && !notaEstadoId)" @click="agregarSeg">
                    <LoaderCircleIcon class="size-[1em] animate-spin" v-if="addingSeg" /><SendIcon class="size-[1em]" v-else />
                  </button>
                </div>
              </div>
              <div v-for="s in (fa.seguimientos || [])" :key="s.id" class="fd-seg">
                <div class="fd-seg-top">
                  <span class="fd-seg-user">{{ s.usuario?.nombre || '—' }}</span>
                  <span class="fd-seg-time">{{ relativeTime(s.created_at) }}</span>
                </div>
                <p v-if="s.nota" class="fd-seg-nota">{{ s.nota }}</p>
                <span v-if="s.estado_nuevo" class="fd-seg-estado" :style="chipOn(colorEstado(s.estado_nuevo.codigo))">{{ s.estado_nuevo.etiqueta }}</span>
              </div>
            </div>
          </div>

          <!-- Acción principal -->
          <button v-if="!fa.estado?.es_estado_final" class="fd-resolve" :disabled="saving" @click="resolver">
            <CircleCheckIcon class="size-[1em]" /> Marcar resuelta
          </button>
          <button v-else class="fd-reopen" :disabled="saving" @click="reabrir">
            <RotateCcwIcon class="size-[1em]" /> Reabrir falla
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { tituloFalla, clasificacionDetalle } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { FallasService } from '~/features/fallas/services/fallas'
import { CircleCheckIcon, LoaderCircleIcon, RotateCcwIcon, SendIcon, ServerIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'

const props = defineProps({
  open:      { type: Boolean, default: false },
  falla:     { type: Object, default: null },
  catalogos: { type: Object, default: () => ({ estados: [], prioridades: [] }) },
})
const emit = defineEmits(['close', 'updated'])

const fallasService = new FallasService()
const fa = ref(null)
const saving = ref(false)
const addingSeg = ref(false)
const nota = ref('')
const notaEstadoId = ref(null)

// Título y clasificación derivados de lo realmente reportado (metodología nueva),
// con respaldo al tipo legacy para fallas viejas.
const titulo = computed(() => tituloFalla(fa.value))
const clasif = computed(() => clasificacionDetalle(fa.value))

watch(() => props.open, (o) => {
  if (o && props.falla) {
    fa.value = props.falla
    nota.value = ''
    notaEstadoId.value = null
    refrescar()
  }
})

function chipOn(color) {
  const c = color || '#915BD8'
  return { background: c, borderColor: c, color: '#fff' }
}
function fmtFecha(d) {
  if (!d) return '—'
  try { return new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function relativeTime(s) {
  if (!s) return ''
  const min = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function close() { emit('close') }

async function refrescar() {
  if (!fa.value) return
  try {
    fa.value = await fallasService.obtener(fa.value.id)
  } catch { /* mantiene la copia del listado */ }
}

async function cambiar(payload) {
  if (!fa.value) return
  saving.value = true
  try {
    const data = await fallasService.actualizar(fa.value.id, payload)
    fa.value = data
    emit('updated', data)
  } catch (e) {
    toast.error('No se pudo guardar', { description: e.data?.detail, duration: 3000 })
  } finally {
    saving.value = false
  }
}

async function agregarSeg() {
  if (!fa.value || (!nota.value.trim() && !notaEstadoId.value)) return
  addingSeg.value = true
  try {
    const payload = {}
    if (nota.value.trim()) payload.nota = nota.value.trim()
    if (notaEstadoId.value) payload.estado_nuevo_id = notaEstadoId.value
    await fallasService.crearSeguimiento(fa.value.id, payload)
    nota.value = ''
    notaEstadoId.value = null
    await refrescar()
    emit('updated', fa.value)
    toast.success('Seguimiento agregado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: e.data?.detail, duration: 3000 })
  } finally {
    addingSeg.value = false
  }
}

async function resolver() {
  const final = (props.catalogos.estados || []).find((e) => e.es_estado_final)
  if (!final) { toast.warning('Sin estado final configurado', { duration: 3000 }); return }
  await cambiar({ estado_id: final.id, fecha_resolucion: new Date().toISOString() })
  toast.success('Falla resuelta', { duration: 2500 })
}

async function reabrir() {
  const abierta = (props.catalogos.estados || []).find((e) => e.codigo === 'abierta')
    || (props.catalogos.estados || []).find((e) => !e.es_estado_final)
  if (!abierta) return
  await cambiar({ estado_id: abierta.id, fecha_resolucion: null })
}
</script>

<style scoped>
.fd-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(28,18,50,0.45); display: flex; align-items: flex-end; }
.fd-sheet {
  width: 100%; max-height: 92vh; display: flex; flex-direction: column; background: #fff;
  border-radius: 22px 22px 0 0; padding: 10px 18px calc(14px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0,0,0,0.2);
}
.fd-grab { width: 40px; height: 4px; border-radius: 2px; background: #e5e7eb; margin: 4px auto 12px; }
.fd-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.fd-head-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fd-code { font-family: ui-monospace, monospace; font-size: 12px; color: var(--color-unergy-purple-dark); background: #f3edfb; padding: 1px 7px; border-radius: 6px; align-self: flex-start; }
.fd-type { font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); }
.fd-saving { color: var(--color-unergy-purple); font-size: 14px; }
.fd-close { background: none; border: none; color: #9ca3af; font-size: 16px; padding: 4px; }

.fd-body { overflow-y: auto; flex: 1; }
.fd-desc { font-size: 15px; color: var(--color-unergy-deep); line-height: 1.45; margin: 0 0 16px; }

/* Clasificación estructurada */
.fd-clasif { border: 1px solid #f0eaf8; border-radius: 14px; padding: 12px 14px; margin-bottom: 16px; background: #fcfaff; }
.fd-clasif-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fd-clasif-cat { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 8px; }
.fd-clasif-sub { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); }
.fd-clasif-pend { font-size: 10.5px; font-weight: 800; color: #b45309; background: #fef3c7; padding: 3px 8px; border-radius: 7px; text-transform: uppercase; letter-spacing: .3px; }
.fd-clasif-detalle { font-size: 14px; color: #4b5563; line-height: 1.45; margin: 10px 0 0; }
.fd-clasif-flags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.fd-flag { font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
.fd-flag--ok { background: #f3f4f6; color: #6b7280; }
.fd-flag--bad { background: #fee2e2; color: #b91c1c; }
.fd-flag--warn { background: #fef3c7; color: #b45309; }
.fd-inv-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.fd-inv { border: 1px solid #eee6fa; border-radius: 11px; padding: 10px 12px; background: #fff; }
.fd-inv-top { display: flex; align-items: center; gap: 7px; font-size: 14px; color: var(--color-unergy-deep); }
.fd-inv-top svg { color: var(--color-unergy-purple); font-size: 12px; }
.fd-inv-pot { color: #9b8db5; font-size: 12.5px; font-weight: 600; }
.fd-inv-tipos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.fd-inv-tag { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 7px; background: #915BD81a; color: var(--color-unergy-purple-dark); }

.fd-field { margin-bottom: 16px; }
.fd-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #9b8db5; }
.fd-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.fd-chip { padding: 9px 14px; border-radius: 11px; border: 1.5px solid #e5e7eb; background: #fff; font-size: 14px; font-weight: 600; color: #6b5a8a; }

.fd-select {
  width: 100%; margin-top: 8px; padding: 12px 14px; font-size: 16px;
  border: 1.5px solid #e8e0f0; border-radius: 12px; color: var(--color-unergy-deep); background: #fff; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
}
.fd-select:focus { outline: none; border-color: var(--color-unergy-purple); }
.fd-select--sm { margin-top: 0; flex: 1; font-size: 14px; padding: 10px 12px; }

.fd-facts { display: flex; flex-direction: column; gap: 0; border: 1px solid #f0eaf8; border-radius: 12px; padding: 4px 12px; margin-bottom: 16px; }
.fd-fact { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f1fa; font-size: 14px; }
.fd-fact:last-child { border-bottom: none; }
.fd-fact span { color: #9b8db5; }
.fd-fact b { color: var(--color-unergy-deep); text-align: right; }
.fd-ok { color: #15803d; }
.fd-bad { color: #b91c1c; }

.fd-block { margin-bottom: 16px; }
.fd-block p { font-size: 14px; color: #4b5563; line-height: 1.45; margin: 6px 0 0; }

.fd-segs { margin-bottom: 8px; }
.fd-add { margin: 8px 0 14px; }
.fd-textarea { width: 100%; padding: 12px 14px; font-size: 16px; border: 1.5px solid #e8e0f0; border-radius: 12px; resize: none; font-family: inherit; color: var(--color-unergy-deep); }
.fd-textarea:focus { outline: none; border-color: var(--color-unergy-purple); }
.fd-add-row { display: flex; gap: 8px; margin-top: 8px; align-items: stretch; }
.fd-send { width: 48px; border: none; border-radius: 11px; background: var(--color-unergy-purple); color: #fff; font-size: 16px; flex-shrink: 0; }
.fd-send:disabled { opacity: .4; }

.fd-seg { border-left: 2px solid #e8e0f0; padding: 4px 0 10px 12px; margin-bottom: 4px; }
.fd-seg-top { display: flex; justify-content: space-between; font-size: 12px; }
.fd-seg-user { font-weight: 700; color: var(--color-unergy-deep); }
.fd-seg-time { color: #9ca3af; }
.fd-seg-nota { font-size: 14px; color: #4b5563; margin: 4px 0 0; line-height: 1.4; }
.fd-seg-estado { display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }

.fd-resolve, .fd-reopen {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 15px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; margin-top: 10px; flex-shrink: 0;
}
.fd-resolve { background: #16a34a; color: #fff; }
.fd-reopen { background: #f3edfb; color: var(--color-unergy-purple-dark); }
.fd-resolve:disabled, .fd-reopen:disabled { opacity: .5; }

.fdsheet-enter-active, .fdsheet-leave-active { transition: opacity .2s ease; }
.fdsheet-enter-active .fd-sheet, .fdsheet-leave-active .fd-sheet { transition: transform .25s ease; }
.fdsheet-enter-from, .fdsheet-leave-to { opacity: 0; }
.fdsheet-enter-from .fd-sheet, .fdsheet-leave-to .fd-sheet { transform: translateY(100%); }
</style>
